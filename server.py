import os
import io
import socket
import sqlite3
import datetime
from pathlib import Path
from typing import Dict, Set

import qrcode
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Query
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# Directories
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = BASE_DIR / "uploads"
DB_PATH = BASE_DIR / "chat.db"

UPLOADS_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

# Database Initialization
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                display_name TEXT,
                online INTEGER DEFAULT 0,
                last_seen TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                sender TEXT,
                recipient TEXT,
                content TEXT,
                message_type TEXT DEFAULT 'text',
                media_url TEXT,
                timestamp TEXT,
                status TEXT DEFAULT 'sent'
            )
        """)
        # Seed initial contacts
        conn.execute("""
            INSERT OR IGNORE INTO users (username, display_name, online, last_seen)
            VALUES 
                ('you', 'You', 0, datetime('now')),
                ('friend', 'Friend', 0, datetime('now')),
                ('alex', 'Alex', 0, datetime('now'))
        """)
        conn.commit()

init_db()

# Determine Local Network IP for Phone Connections
def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Does not actually connect, just determines route interface
        s.connect(('10.254.254.254', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

PORT = int(os.environ.get("PORT", 8000))
LOCAL_IP = get_local_ip()

def get_public_url() -> str:
    render_url = os.environ.get("RENDER_EXTERNAL_URL")
    if render_url:
        return render_url.rstrip("/")
    render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME")
    if render_host:
        return f"https://{render_host}"
    return f"http://{LOCAL_IP}:{PORT}"

# FastAPI App
app = FastAPI(title="WhatsApp Clone PWA")

# Mount static and uploads
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, username: str, websocket: WebSocket):
        await websocket.accept()
        if username not in self.active_connections:
            self.active_connections[username] = set()
        self.active_connections[username].add(websocket)

        # Mark user online
        with get_db() as conn:
            conn.execute("UPDATE users SET online = 1, last_seen = ? WHERE username = ?",
                         (datetime.datetime.now().isoformat(), username))
            conn.commit()

        await self.broadcast_user_status(username, True)

    async def disconnect(self, username: str, websocket: WebSocket):
        if username in self.active_connections:
            self.active_connections[username].discard(websocket)
            if not self.active_connections[username]:
                del self.active_connections[username]
                with get_db() as conn:
                    conn.execute("UPDATE users SET online = 0, last_seen = ? WHERE username = ?",
                                 (datetime.datetime.now().isoformat(), username))
                    conn.commit()
                await self.broadcast_user_status(username, False)

    async def send_to_user(self, username: str, data: dict):
        if username in self.active_connections:
            for ws in list(self.active_connections[username]):
                try:
                    await ws.send_json(data)
                except Exception:
                    pass

    async def broadcast_user_status(self, username: str, online: bool):
        payload = {"type": "user_status", "username": username, "online": online}
        for user, sockets in self.active_connections.items():
            if user != username:
                for ws in list(sockets):
                    try:
                        await ws.send_json(payload)
                    except Exception:
                        pass

manager = ConnectionManager()

# Routes
@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    return HTMLResponse(content=index_file.read_text(encoding="utf-8"))

@app.get("/api/ip")
async def get_ip_info():
    url = get_public_url()
    return {
        "ip": LOCAL_IP,
        "port": PORT,
        "url": url
    }

@app.get("/api/qr")
async def get_qr_code():
    url = get_public_url()
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#075e54", back_color="#ffffff")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")

@app.get("/api/users")
async def get_users():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM users").fetchall()
        users = []
        for r in rows:
            users.append({
                "username": r["username"],
                "display_name": r["display_name"],
                "online": bool(r["online"]) or (r["username"] in manager.active_connections),
                "last_seen": r["last_seen"]
            })
        return users

@app.get("/api/messages")
async def get_messages(user1: str = Query(...), user2: str = Query(...)):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT * FROM messages 
            WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)
            ORDER BY timestamp ASC
        """, (user1, user2, user2, user1)).fetchall()
        
        return [dict(r) for r in rows]

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix or ".bin"
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"media_{timestamp}{ext}"
    filepath = UPLOADS_DIR / filename
    
    content = await file.read()
    filepath.write_bytes(content)
    
    return {"url": f"/uploads/{filename}", "filename": filename}

# WebSocket Endpoint
@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    # Register user in DB if new
    with get_db() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO users (username, display_name, online, last_seen)
            VALUES (?, ?, 1, datetime('now'))
        """, (username, username.capitalize()))
        conn.commit()

    await manager.connect(username, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "chat_message":
                msg_id = data.get("id") or f"msg_{int(datetime.datetime.now().timestamp()*1000)}"
                recipient = data.get("recipient")
                content = data.get("content", "")
                m_type = data.get("message_type", "text")
                media_url = data.get("media_url", "")
                now_iso = datetime.datetime.now().isoformat()

                # Save message
                with get_db() as conn:
                    conn.execute("""
                        INSERT INTO messages (id, sender, recipient, content, message_type, media_url, timestamp, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'sent')
                    """, (msg_id, username, recipient, content, m_type, media_url, now_iso))
                    conn.commit()

                # Acknowledge to sender (single tick)
                await websocket.send_json({
                    "type": "message_ack",
                    "message_id": msg_id,
                    "status": "sent"
                })

                # Forward to recipient if online
                if recipient in manager.active_connections:
                    await manager.send_to_user(recipient, {
                        "type": "chat_message",
                        "id": msg_id,
                        "sender": username,
                        "recipient": recipient,
                        "content": content,
                        "message_type": m_type,
                        "media_url": media_url,
                        "timestamp": now_iso,
                        "status": "delivered"
                    })
                    # Update status to delivered (double tick)
                    with get_db() as conn:
                        conn.execute("UPDATE messages SET status = 'delivered' WHERE id = ?", (msg_id,))
                        conn.commit()

                    await websocket.send_json({
                        "type": "message_delivered",
                        "message_id": msg_id
                    })

            elif msg_type == "read_receipt":
                msg_id = data.get("message_id")
                sender = data.get("sender")
                with get_db() as conn:
                    conn.execute("UPDATE messages SET status = 'read' WHERE id = ?", (msg_id,))
                    conn.commit()
                if sender:
                    await manager.send_to_user(sender, {
                        "type": "message_read",
                        "message_id": msg_id,
                        "reader": username
                    })

            elif msg_type in ("typing", "stop_typing"):
                recipient = data.get("recipient")
                if recipient:
                    await manager.send_to_user(recipient, {
                        "type": msg_type,
                        "sender": username
                    })

    except WebSocketDisconnect:
        await manager.disconnect(username, websocket)
    except Exception as e:
        await manager.disconnect(username, websocket)

if __name__ == "__main__":
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    print("=" * 60)
    print(" WHATSAPP CHAT APP STARTED!")
    print(f" Open this on your phone & your friend's phone:")
    print(f" http://{LOCAL_IP}:{PORT}")
    print("=" * 60)
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, reload=False)
