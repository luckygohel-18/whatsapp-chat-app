# 📱 WhatsApp Clone (Web & Mobile Installable PWA)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/luckygohel-18/whatsapp-chat-app)

A fully functional real-time WhatsApp clone styled identically to WhatsApp (Dark & Light modes, real-time messaging via WebSockets, delivery ticks, typing indicators, photo sharing, voice notes, audio effects, and phone install support).

---

## 🚀 How to Run Locally

1. Open PowerShell or Command Prompt in this folder:
   ```powershell
   cd C:\Users\abc\.gemini\antigravity\scratch\whatsapp-chat-app
   ```
2. Double-click `start_app.bat` or run:
   ```powershell
   .\venv\Scripts\python server.py
   ```
3. The server starts on your local network:
   - Local PC: `http://localhost:8000`
   - Phone & Friend's Phone (on same Wi-Fi): `http://192.168.1.116:8000`

---

## 📲 How to Download & Install on Android Phones

### On Your Phone:
1. Make sure your phone is connected to the same Wi-Fi network.
2. Open **Google Chrome** on your phone.
3. Open `http://192.168.1.116:8000` (or tap the QR code button in the app header and scan it with your camera).
4. Tap the **3 dots (⋮)** at the top right of Chrome.
5. Tap **"Install app"** (or **"Add to Home screen"**).
6. Tap **Add / Install**.
7. WhatsApp will appear on your phone home screen with the green WhatsApp icon and launch full-screen!
8. When prompted, enter your name (e.g. `Alex` or `Me`).

### On Your Friend's Phone:
1. Connect their phone to the same Wi-Fi (or share the public internet link below).
2. Open Chrome and visit `http://192.168.1.116:8000`.
3. Tap the **3 dots (⋮)** -> **"Install app"** / **"Add to Home screen"**.
4. Enter their name (e.g. `Sam` or `Friend`).
5. Open each other's chat and start texting in real-time!

---

## 🌐 How to Chat from Anywhere in the World (Different Wi-Fi / Mobile Data)

If your friend is at their house or using mobile data (4G/5G), you need a public URL:

### Option 1: Free 24/7 Cloud Hosting on Render (Recommended)
This gives you a permanent `https://your-whatsapp.onrender.com` link for free:
1. Create a free account at [Render.com](https://render.com).
2. Create a new **Web Service**.
3. Upload or connect this folder repository.
4. Set:
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Click **Deploy**. Render will give you a public HTTPS URL you can send to your friend on WhatsApp or SMS!

### Option 2: Instant Free Cloudflare Tunnel (No Sign-up)
You can expose your running local server to the internet right now:
1. Download `cloudflared.exe` or run:
   ```powershell
   winget install Cloudflare.cloudflared
   ```
2. Start the tunnel:
   ```powershell
   cloudflared tunnel --url http://localhost:8000
   ```
3. Cloudflare gives you a temporary `https://<random-name>.trycloudflare.com` URL.
4. Send that link to your friend! Both open it in Chrome and install the app!

---

## 🌟 Key Features

- **Authentic WhatsApp UI**: Dark & Light themes, WhatsApp green headers, classic chat wallpaper, chat list, tabs (Chats, Status, Calls).
- **Real-Time WebSockets**: Instant message delivery with no page refreshing.
- **Message Status Ticks**:
  - Single grey tick: Sent
  - Double grey tick: Delivered to recipient's phone
  - Double blue ticks: Read by recipient
- **Typing Indicator**: Real-time "typing..." banner when the other person is writing.
- **Voice Notes**: Hold/tap the microphone to record audio notes with waveforms and timer.
- **Photo Attachments**: Tap the paperclip to send pictures from your phone gallery.
- **Audio Sound Effects**: Realistic WhatsApp message sent pop, message received chime, and phone ringtone.
- **PWA (Progressive Web App)**: Service worker caching, offline capability, standalone mobile window, zero browser bars.
