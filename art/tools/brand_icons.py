"""從 art/source/brand/wowo_logo.png 產生 App 圖示和註冊頁用的 logo。

圖示＝整個正方形小視窗（含 wowo! 字）填滿整張圖，手機的圓角會切掉視窗外框的四個角。
Android 的圓形裁切版（maskable）和網頁小圖示則縮小放在淡藍點點底上。python3 art/tools/brand_icons.py
"""
from PIL import Image, ImageDraw
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'art/source/brand/wowo_logo.png')
OUT = os.path.join(ROOT, 'public/icons')

logo = Image.open(SRC).convert('RGBA')
x0, y0, x1, y1 = logo.getbbox()
win = logo.crop((x0, y0, x1, y1))

BG, DOT = (227, 235, 250, 255), (204, 217, 242, 255)

def icon(size, scale):
    """scale：視窗寬度佔圖示寬度的比例。"""
    big = 1024
    im = Image.new('RGBA', (big, big), BG)
    d = ImageDraw.Draw(im)
    for y in range(8, big, 32):
        for x in range(8 + (16 if (y // 32) % 2 else 0), big, 32):
            d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=DOT)
    w = round(big * scale); h = round(win.height * w / win.width)
    im.alpha_composite(win.resize((w, h), Image.LANCZOS), ((big - w) // 2, (big - h) // 2))
    return im.convert('RGB').resize((size, size), Image.LANCZOS)

def full(size, zoom=1.04):
    """視窗填滿整張圖：高度撐滿再放大一點，四角露出的地方用視窗外框的藍色補上。"""
    big = 1024
    im = Image.new('RGBA', (big, big), win.getpixel((win.width // 2, 6)))
    h = round(big * zoom); w = round(win.width * h / win.height)
    im.alpha_composite(win.resize((w, h), Image.LANCZOS), ((big - w) // 2, (big - h) // 2))
    return im.convert('RGB').resize((size, size), Image.LANCZOS)

full(1024).save(os.path.join(ROOT, 'art/source/brand/app_icon_1024.png'))
full(512).save(os.path.join(OUT, 'icon-512.png'))
full(192).save(os.path.join(OUT, 'icon-192.png'))
full(180).save(os.path.join(OUT, 'apple-touch-icon.png'))
# Android 會把圖示裁成圓形或其他形狀：重要內容要在中間 80% 的圓裡
icon(512, 0.78).save(os.path.join(OUT, 'icon-maskable-512.png'))
icon(32, 0.98).save(os.path.join(OUT, 'favicon-32.png'))
# 註冊頁 logo：顯示 240px 寬，存 2 倍
l = logo.crop(logo.getbbox())
l.resize((480, round(l.height * 480 / l.width)), Image.LANCZOS).save(os.path.join(ROOT, 'public/logo.webp'), quality=92, method=6)
print('ok')
