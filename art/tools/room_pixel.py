"""像素房間：art/source/room2/ 的 GPT 圖 → public/room/pixel_room/。

- full.webp：擺好家具的完整房間（目前直接當房間背景）
- small.webp：小物件（檯燈開／關、電視開機…），切出來疊在房間上
GPT 的房間地板前角被畫布切掉一塊，這裡補成完整的菱形，畫布往下加高到 1064。
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
FLOOR, LINE, TRIM, TRIM_HI, TRIM_LINE = (253, 208, 166), (150, 92, 66), (252, 152, 151), (255, 228, 229), (110, 45, 45)

def fix_corner(a):
    x0, x1 = 690, 880
    for x in range(x0, x1):
        e = min(edgeL(x), edgeR(x))
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
    Image.fromarray(a).save(f'{OUT}/room.webp', quality=95, method=6)
    tv_on()
    print('room', a.shape)

# 電視開機：把小物件圖裡電視的畫面，用仿射變換貼到房間電視的螢幕上（房間座標 TV_BOX）
TV_BOX = (1040, 405, 140, 145)
def tv_on():
    from PIL import ImageDraw
    s = Image.open(f'{SRC}/small.webp').convert('RGBA')
    dst = [(1053, 419), (1161, 465), (1053, 489)]   # 房間電視螢幕：左上、右上、左下
    src = [(1096, 540), (1292, 600), (1096, 655)]   # 小物件圖裡的同三個角
    A = np.array([[x, y, 1] for x, y in dst], float)
    cx = np.linalg.solve(A, [p[0] for p in src]); cy = np.linalg.solve(A, [p[1] for p in src])
    X0, Y0, w, h = TV_BOX
    patch = s.transform((w, h), Image.AFFINE, (cx[0], cx[1], cx[0] * X0 + cx[1] * Y0 + cx[2], cy[0], cy[1], cy[0] * X0 + cy[1] * Y0 + cy[2]), resample=Image.NEAREST)
    TL, TR, BL = dst; BR = (TR[0] + BL[0] - TL[0], TR[1] + BL[1] - TL[1])
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).polygon([(p[0] - X0, p[1] - Y0) for p in (TL, TR, BR, BL)], fill=255)
    patch.putalpha(m); patch.save(f'{OUT}/tv_on.webp', lossless=True)

if __name__ == '__main__':
    main()
