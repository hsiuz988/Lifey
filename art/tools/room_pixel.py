"""像素房間：art/source/room2/ 的 GPT 圖 → public/room/pixel_room/。

- full.webp：擺好家具的完整房間（目前直接當房間背景）
- small.webp：小物件（檯燈開／關、電視開機…），切出來疊在房間上
GPT 的房間地板前角被畫布切掉一塊，這裡補成完整的菱形，畫布往下加高到 1064。
層架：shelf_empty.png 是 GPT 改過「層架清空」的整張房間，EMPTY_SHELF = True 時只切層架那一塊貼回來；
  目前不用（房間維持原樣，獲得新家具時直接疊上去蓋住舊的），需要空層架的獎勵再打開。
用法：python3 art/tools/room_pixel.py
"""
from PIL import Image
import numpy as np, os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'art/source/room2')
OUT = os.path.join(ROOT, 'public/room/pixel_room')
W, H = 1536, 1064

# 地板前面兩條邊（量出來的）：左邊 y = 876 + 0.545 (x-500)，右邊 y = 978 - 0.5136 (x-880)
edgeL = lambda x: 876 + 0.545 * (x - 500)
edgeR = lambda x: 978 - 0.5136 * (x - 880)
DAY = (253, 208, 166), (150, 92, 66), (255, 228, 229), (252, 152, 151), (110, 45, 45)  # 地板、線、亮邊、粉邊、暗線

def fix_corner(a, colors=None):
    """colors(x) → [地板, 線, 亮邊, 粉邊, 暗線]；沒給就用白天的顏色（夜晚房間會傳自己的）"""
    x0, x1 = 690, 880
    for x in range(x0, x1):
        e = min(edgeL(x), edgeR(x))
        FLOOR, LINE, TRIM_HI, TRIM, TRIM_LINE = colors(x) if colors else DAY
        for y in range(970, H):
            d = y - e
            if y < 986 and d < -1: continue                     # 原本畫好的地板不動
            if d < -1: c = FLOOR
            elif d < 1.5: c = LINE
            elif d < 3.5: c = TRIM_HI
            elif d < 23.5: c = TRIM
            elif d < 26: c = TRIM_LINE
            else: a[y, x] = 0; continue
            a[y, x] = (*c, 255)
    return a

def main():
    os.makedirs(OUT, exist_ok=True)
    full = np.array(Image.open(f'{SRC}/full.webp').convert('RGBA'))
    a = np.zeros((H, W, 4), np.uint8); a[:full.shape[0]] = full
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    a = fix_corner(a)
    if EMPTY_SHELF: a = empty_shelf(a)
    Image.fromarray(a).save(f'{OUT}/room.webp', quality=95, method=6)
    tv_on()
    print('room', a.shape)

EMPTY_SHELF = False
# 書桌上方 L 形層架上原本的東西（植物、書、相框、貓）的範圍，避開書桌上的盆栽和檯燈
SHELF_POLY = [(662, 96), (915, 96), (915, 232), (850, 232), (812, 226), (735, 226), (732, 248), (700, 248), (700, 226), (662, 226)]
def empty_shelf(a):
    from PIL import ImageDraw, ImageFilter
    b = np.zeros_like(a); src = np.array(Image.open(f'{SRC}/shelf_empty.png').convert('RGBA'))
    b[:src.shape[0], :src.shape[1]] = src[:H, :W]
    hard = Image.new('L', (W, H), 0); ImageDraw.Draw(hard).polygon(SHELF_POLY, fill=255)
    hard = np.array(hard) > 0
    from scipy import ndimage
    ring = ndimage.binary_dilation(hard, iterations=4) & ~ndimage.binary_erosion(hard, iterations=4)
    shift = (a[ring, :3].astype(float) - b[ring, :3]).mean(0)
    b[..., :3] = np.clip(b[..., :3] + shift, 0, 255)
    m = np.array(Image.fromarray((hard * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), float)[..., None] / 255
    out = a.copy(); out[..., :3] = (b[..., :3] * m + a[..., :3] * (1 - m)).astype(np.uint8)
    return out

# 電視開機：把小物件圖裡電視的畫面，用仿射變換貼到房間電視的螢幕上（房間座標 TV_BOX）
TV_BOX = (1040, 405, 140, 145)
def tv_on():
    from PIL import ImageDraw
    s = Image.open(f'{SRC}/small.webp').convert('RGBA')
    dst = [(1055, 414), (1150, 461.5), (1055, 487)]   # 房間電視螢幕：左上、右上、左下（量內框，上下邊斜率都是 0.5）
    src = [(1098, 538), (1292, 625), (1098, 656)]   # 小物件圖裡的同三個角
    A = np.array([[x, y, 1] for x, y in dst], float)
    cx = np.linalg.solve(A, [p[0] for p in src]); cy = np.linalg.solve(A, [p[1] for p in src])
    X0, Y0, w, h = TV_BOX
    patch = s.transform((w, h), Image.AFFINE, (cx[0], cx[1], cx[0] * X0 + cx[1] * Y0 + cx[2], cy[0], cy[1], cy[0] * X0 + cy[1] * Y0 + cy[2]), resample=Image.NEAREST)
    TL, TR, BL = dst; BR = (TR[0] + BL[0] - TL[0], TR[1] + BL[1] - TL[1])
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon([(p[0] - X0, p[1] - Y0) for p in (TL, TR, BR, BL)], fill=255)
    patch.putalpha(m); patch.save(f'{OUT}/tv_on.webp', lossless=True)

if __name__ == '__main__':
    main()
