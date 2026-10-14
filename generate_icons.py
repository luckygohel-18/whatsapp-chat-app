import math
from PIL import Image, ImageDraw

def create_whatsapp_icon(size, filename):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # WhatsApp brand color: #25D366 (or #00a884)
    green = (37, 211, 102, 255)
    white = (255, 255, 255, 255)
    shadow = (0, 0, 0, 45)
    
    # Outer circle diameter with padding
    pad = int(size * 0.05)
    radius = (size - 2 * pad) // 2
    cx, cy = size // 2, size // 2
    
    # Draw soft shadow
    draw.ellipse([cx - radius + 2, cy - radius + 4, cx + radius + 2, cy + radius + 4], fill=shadow)
    
    # Draw background green circle
    draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=green)
    
    # Draw speech bubble tail pointing to bottom-left
    tail_tip = (int(size * 0.32), int(size * 0.72))
    tail_base1 = (int(size * 0.42), int(size * 0.62))
    tail_base2 = (int(size * 0.32), int(size * 0.58))
    draw.polygon([tail_tip, tail_base1, tail_base2], fill=green)
    
    # White speech bubble ring/outline
    bubble_r = int(radius * 0.68)
    draw.ellipse([cx - bubble_r, cy - bubble_r - int(size * 0.02), cx + bubble_r, cy + bubble_r - int(size * 0.02)], fill=white)
    
    # Inner green circle to form speech bubble ring
    inner_r = int(bubble_r * 0.85)
    draw.ellipse([cx - inner_r, cy - inner_r - int(size * 0.02), cx + inner_r, cy + inner_r - int(size * 0.02)], fill=green)
    
    # White phone handset inside
    # Simplified modern phone handset coordinates scaled to size
    p_cx, p_cy = cx + int(size * 0.02), cy - int(size * 0.02)
    s = size / 512.0
    
    # Draw phone handset using arcs/thick lines
    phone_color = (255, 255, 255, 255)
    
    # Earpiece pill
    draw.rounded_rectangle(
        [p_cx - 45*s, p_cy - 75*s, p_cx + 45*s, p_cy - 40*s],
        radius=int(18*s), fill=phone_color
    )
    # Mouthpiece pill
    draw.rounded_rectangle(
        [p_cx - 85*s, p_cy + 15*s, p_cx - 45*s, p_cy + 85*s],
        radius=int(18*s), fill=phone_color
    )
    # Curved handle connecting them
    draw.ellipse([p_cx - 95*s, p_cy - 65*s, p_cx + 25*s, p_cy + 55*s], outline=phone_color, width=int(28*s))
    # Cutout inside of handle
    draw.ellipse([p_cx - 65*s, p_cy - 35*s, p_cx - 5*s, p_cy + 25*s], fill=green)
    
    img.save(filename, "PNG")
    print(f"Generated {filename} ({size}x{size})")

if __name__ == "__main__":
    create_whatsapp_icon(192, "static/icons/icon-192.png")
    create_whatsapp_icon(512, "static/icons/icon-512.png")
