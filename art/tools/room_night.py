"""夜晚房間：art/source/room2/night_lamp.webp（GPT 照白天房間改光線）→ public/room/pixel_room/room_night.webp

GPT 改圖時會把整張圖輕微縮放、平移（左右差 5～8px），熱點和走路範圍會對不上。
這裡先用邊緣比對，自動找出把夜晚圖對回白天圖的仿射變換，再用白天房間的外形（alpha）裁切，
最後照 room_pixel.py 補地板前角（顏色從夜晚圖旁邊取）。
用法：python3 art/tools/room_night.py
"""
from PIL import Image
import numpy as np, os
from scipy import ndimage
from room_pixel import SRC, OUT, W, H, fix_corner, edgeL, edgeR

def edges(g):
    return np.hypot(ndimage.sobel(g, 0), ndimage.sobel(g, 1))

def fit(day, night, step=80, blk=100, r=14):
    """每一小塊找最吻合的位移，再擬合成仿射（剔除離群點）：白天座標 → 夜晚座標"""
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

def corner_colors(a):
    """地板前角各層（地板、線、亮邊、粉邊、暗線）的顏色，從左右兩側被切掉之前的地方取"""
    def at(x, e):
        return [a[int(round(e(x) + d)), x, :3].astype(int) for d in (-6, 0, 2, 12, 24)]
    return at(680, edgeL), at(890, edgeR)

def main():
    day = np.array(Image.open(f'{OUT}/room.webp').convert('RGBA'))
    night = Image.open(f'{SRC}/night_lamp.webp').convert('RGB')
    gd = np.array(Image.open(f'{SRC}/full.webp').convert('L'), float)
    cx, cy = fit(gd, np.array(night.convert('L'), float))
    a = np.array(night.transform((W, H), Image.AFFINE, (*cx, *cy), resample=Image.BICUBIC).convert('RGBA'))
    L, R = corner_colors(a)
    a = fix_corner(a, lambda x: [tuple(int(l + (r - l) * min(max((x - 680) / 210, 0), 1)) for l, r in zip(cl, cr)) for cl, cr in zip(L, R)])
    a[..., 3] = day[..., 3]                      # 外形和白天房間一模一樣
    Image.fromarray(a).save(f'{OUT}/room_night.webp', quality=92, method=6)
    print('room_night', a.shape, f'{os.path.getsize(f"{OUT}/room_night.webp") // 1024}KB')

if __name__ == '__main__':
    main()
