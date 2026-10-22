"""像素房間：art/source/room2/ 的 GPT 圖 → public/room/pixel_room/。

- full.webp：擺好家具的完整房間（最早的版本，地板前角被畫布切掉一塊，這裡補成完整的菱形，畫布往下加高到 1064）
- full_crt.png：GPT 拿上面做好的房間改過的版本（粉色映像管電視、拿掉信紙、清掉層架上的東西）。
- full_v3.webp：GPT 照 full_crt.png 重畫、拿掉書櫃左邊的垂吊植物＝現在的房間背景（EDIT）。
  GPT 改圖會整張輕微縮放（1536 → 1507），這裡先放大回來，再用邊緣比對對回原本的房間，熱點和走路範圍才不用重量
- small.webp：小物件（檯燈開／關、電視開機…），切出來疊在房間上
層架：shelf_empty.png 是 GPT 改過「層架清空」的整張房間，EMPTY_SHELF = True 時只切層架那一塊貼回來；
  目前不用（房間維持原樣，獲得新家具時直接疊上去蓋住舊的），需要空層架的獎勵再打開。
用法：python3 art/tools/room_pixel.py
"""
from PIL import Image
import numpy as np, os
from scipy import ndimage

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

def edges(g):
    return np.hypot(ndimage.sobel(g, 0), ndimage.sobel(g, 1))

def fit(day, night, step=80, blk=100, r=14):
    """每一小塊找最吻合的位移，再擬合成仿射（剔除離群點）：白天座標 → 另一張圖的座標（給 Image.transform 用）"""
    EA, EB = edges(night), edges(day)
    pts = []
    for y0 in range(120, 900, step):
        for x0 in range(80, 1400, step):
            b = EB[y0:y0 + blk, x0:x0 + blk]
            if b.mean() < 15: continue
            s = max(((EA[y0 + dy:y0 + blk + dy, x0 + dx:x0 + blk + dx] * b).sum(), dx, dy) for dy in range(-r, r + 1) for dx in range(-r, r + 1))
            pts.append((x0 + blk / 2, y0 + blk / 2, s[1], s[2]))
    P = np.array(pts, float)
    for _ in range(3):
        X = np.c_[P[:, 0], P[:, 1], np.ones(len(P))]
        cx = np.linalg.lstsq(X, P[:, 2], rcond=None)[0]; cy = np.linalg.lstsq(X, P[:, 3], rcond=None)[0]
        P = P[np.hypot(X @ cx - P[:, 2], X @ cy - P[:, 3]) < 2.5]
    print(f'對齊：{len(P)} 個點，誤差約 {np.abs(np.c_[P[:, :2], np.ones(len(P))] @ cx - P[:, 2]).mean():.2f}px')
    return cx + [1, 0, 0], cy + [0, 1, 0]

def old_room():
    """最早的房間（full.webp 補好地板前角）：熱點、走路範圍、窗戶、夜晚房間都是照它量的"""
    full = np.array(Image.open(f'{SRC}/full.webp').convert('RGBA'))
    a = np.zeros((H, W, 4), np.uint8); a[:full.shape[0]] = full
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    a = fix_corner(a)
    if EMPTY_SHELF: a = empty_shelf(a)
    return a

EDIT = 'full_v3.webp'
def apply_edit(base):
    """GPT 改過的房間：放大回原本的寬度、對齊原本的房間，外形（alpha）用原本的"""
    e = Image.open(f'{SRC}/{EDIT}').convert('RGBA')
    e = e.resize((W, round(e.height * W / e.width)), Image.BICUBIC)
    c = Image.new('RGBA', (W, H)); c.paste(e, (0, 0))
    gray = lambda im: np.array(im.convert('L'), float)
    cx, cy = fit(gray(Image.fromarray(base)), gray(c))
    a = np.array(c.transform((W, H), Image.AFFINE, (*cx, *cy), resample=Image.BICUBIC))
    a[..., 3] = base[..., 3]
    return a

def room():
    a = old_room()
    return apply_edit(a) if os.path.exists(f'{SRC}/{EDIT}') else a

def main():
    os.makedirs(OUT, exist_ok=True)
    a = room()
    Image.fromarray(a).save(f'{OUT}/room.webp', quality=95, method=6)
    tv_on(a)
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
def tv_on(room):
    s = Image.open(f'{SRC}/small.webp').convert('RGBA')
    dst = [(1050, 441), (1118, 475), (1050, 500)]     # 映像管螢幕：左上、右上、左下（上下邊斜率約 0.5）
    src = [(1098, 538), (1292, 625), (1098, 656)]   # 小物件圖裡的同三個角
    A = np.array([[x, y, 1] for x, y in dst], float)
    cx = np.linalg.solve(A, [p[0] for p in src]); cy = np.linalg.solve(A, [p[1] for p in src])
    X0, Y0, w, h = TV_BOX
    patch = s.transform((w, h), Image.AFFINE, (cx[0], cx[1], cx[0] * X0 + cx[1] * Y0 + cx[2], cy[0], cy[1], cy[0] * X0 + cy[1] * Y0 + cy[2]), resample=Image.NEAREST)
    # 螢幕是圓角的：照房間裡深灰色的螢幕像素裁（最大的一塊、補洞）
    box = room[Y0:Y0 + h, X0:X0 + w, :3].astype(int)
    dark = (box.sum(2) < 330) & (np.abs(box[..., 0] - box[..., 2]) < 25)
    lab, n = ndimage.label(dark)
    m = ndimage.binary_fill_holes(lab == 1 + np.argmax(ndimage.sum(dark, lab, range(1, n + 1))))
    patch.putalpha(Image.fromarray((m * 255).astype(np.uint8))); patch.save(f'{OUT}/tv_on.webp', lossless=True)

if __name__ == '__main__':
    main()
