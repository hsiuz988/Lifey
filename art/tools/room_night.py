"""夜晚房間：art/source/room2/night_lamp.webp（GPT 照白天房間改光線）→ public/room/pixel_room/room_night.webp

GPT 改圖時會把整張圖輕微縮放、平移（左右差 5～8px），熱點和走路範圍會對不上。
這裡先用邊緣比對，自動找出把夜晚圖對回白天圖的仿射變換，再用白天房間的外形（alpha）裁切，
最後照 room_pixel.py 補地板前角（顏色從夜晚圖旁邊取）。
夜晚圖是照最早的房間（full.webp）畫的；白天房間換成 full_crt.png 之後，這裡算出「夜晚／白天」的光線比例
（模糊過、只看光線不看細節），再套到新的白天房間上，所以新電視、清空的層架晚上也對得上。
用法：python3 art/tools/room_night.py
"""
from PIL import Image
import numpy as np, os
from scipy import ndimage
from room_pixel import SRC, OUT, W, H, fix_corner, edgeL, edgeR, fit, old_room

def corner_colors(a):
    """地板前角各層（地板、線、亮邊、粉邊、暗線）的顏色，從左右兩側被切掉之前的地方取"""
    def at(x, e):
        return [a[int(round(e(x) + d)), x, :3].astype(int) for d in (-6, 0, 2, 12, 24)]
    return at(680, edgeL), at(890, edgeR)

# full_crt.png 拿掉或換掉的東西（房間座標 x0, y0, x1, y1）：層架上的擺設、窗邊吊盆、信紙、電視和櫃上的鬧鐘盆栽、門邊吊飾
# 這些地方舊的夜晚圖畫的是別的東西，光線比例不準，改用周圍的比例補
CHANGED = [(680, 95, 915, 255), (250, 295, 305, 375), (812, 340, 905, 398), (1030, 395, 1255, 580), (1400, 450, 1445, 575)]

def relight(night, old, day, sigma=5):
    """night 是照 old 畫的夜晚；把兩者的光線比例（模糊過）套到 day 上"""
    hole = np.zeros(old.shape[:2], bool)
    for x0, y0, x1, y1 in CHANGED: hole[y0:y1, x0:x1] = True
    inside = old[..., 3] > 0
    w = inside.astype(float)
    blur = lambda x: ndimage.gaussian_filter(x * w, sigma) / np.maximum(ndimage.gaussian_filter(w, sigma), 1e-3)
    valid = inside & ~ndimage.binary_dilation(hole, iterations=12)
    _, (iy, ix) = ndimage.distance_transform_edt(~valid, return_indices=True)   # 洞裡用最近的有效比例
    feather = ndimage.gaussian_filter(ndimage.binary_dilation(hole, iterations=8).astype(float), 4)
    out = night.copy()
    for i in range(3):
        near = blur(night[..., i].astype(float)) / np.maximum(blur(old[..., i].astype(float)), 8)
        fill = ndimage.gaussian_filter(near[iy, ix], 10)
        out[..., i] = np.clip(day[..., i] * (near * (1 - feather) + fill * feather), 0, 255)
    return out

def main():
    day = np.array(Image.open(f'{OUT}/room.webp').convert('RGBA'))
    night = Image.open(f'{SRC}/night_lamp.webp').convert('RGB')
    gd = np.array(Image.open(f'{SRC}/full.webp').convert('L'), float)
    cx, cy = fit(gd, np.array(night.convert('L'), float))
    a = np.array(night.transform((W, H), Image.AFFINE, (*cx, *cy), resample=Image.BICUBIC).convert('RGBA'))
    L, R = corner_colors(a)
    a = fix_corner(a, lambda x: [tuple(int(l + (r - l) * min(max((x - 680) / 210, 0), 1)) for l, r in zip(cl, cr)) for cl, cr in zip(L, R)])
    a = relight(a, old_room(), day)
    a[..., 3] = day[..., 3]                      # 外形和白天房間一模一樣
    Image.fromarray(a).save(f'{OUT}/room_night.webp', quality=92, method=6)
    print('room_night', a.shape, f'{os.path.getsize(f"{OUT}/room_night.webp") // 1024}KB')

if __name__ == '__main__':
    main()
