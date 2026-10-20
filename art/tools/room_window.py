"""窗外天氣：art/source/room2/window/*.webp（同一間空房間、只換窗外）→ public/room/pixel_room/window_*.webp

做法：把來源圖的窗口用仿射變換對到房間窗口，只填進房間裡「玻璃」的像素（窗框、窗簾不動）。
來源圖窗格位置和房間不一樣，所以先把來源的窗框、窗簾用最近的玻璃像素補掉，只留下景色。
房間本身的窗外就是白天晴天，不用另外做。
用法：python3 art/tools/room_window.py
"""
from PIL import Image, ImageDraw
import numpy as np, os
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'art/source/room2/window')
OUT = os.path.join(ROOT, 'public/room/pixel_room')
KINDS = ['cloudy', 'rain', 'snow', 'clear_night', 'rain_night']

# 窗口內緣（被窗簾蓋住的地方用窗框延伸）：左上、右上、左下（量出來的）
ROOM_WIN = [(367, 286), (562, 194), (367, 425)]
SRC_WIN = [(370, 291), (562, 196), (370, 427)]
BOX = (355, 180, 575, 440)  # 疊圖範圍（房間座標）

def glass(a):
    """玻璃＝天空、雲、樹（偏藍或偏綠）；窗框是橘、窗簾是暖白（紅 > 藍）"""
    r, g, b = (a[..., i].astype(int) for i in range(3))
    return (b >= r - 2) | (g > r + 4)

def window_poly(size, tri, grow=0):
    TL, TR, BL = tri
    BR = (TR[0] + BL[0] - TL[0], TR[1] + BL[1] - TL[1])
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).polygon([(TL[0] - grow, TL[1] - grow), (TR[0] + grow, TR[1] - grow), (BR[0] + grow, BR[1] + grow), (BL[0] - grow, BL[1] + grow)], fill=255)
    return np.array(m) > 0

def room_mask(room):
    win = window_poly((room.shape[1], room.shape[0]), ROOM_WIN, grow=2)
    m = glass(room) & win
    m = ndimage.binary_opening(m, iterations=1)           # 去掉窗簾上零星的偏藍點
    m = ndimage.binary_closing(m, iterations=2) & win     # 補雲裡的小洞
    return m

def scenery(src):
    """來源圖只留景色：窗框、窗簾的像素換成最近的玻璃像素"""
    win = window_poly((src.shape[1], src.shape[0]), SRC_WIN, grow=2)
    r, g, b = (src[..., i].astype(int) for i in range(3))
    moon = (r - g < 25) & (r - b > 60)                              # 月亮、星星是黃的，不要當成窗框
    keep = ndimage.binary_erosion((glass(src) | moon) & win, iterations=1)  # 去掉和窗框混色的邊
    _, (iy, ix) = ndimage.distance_transform_edt(~keep, return_indices=True)
    return src[iy, ix]

def main():
    room = np.array(Image.open(f'{OUT}/room.webp').convert('RGBA'))
    mask = room_mask(room)
    edge = ndimage.binary_dilation(mask, iterations=1) & ~mask & window_poly((room.shape[1], room.shape[0]), ROOM_WIN, grow=2)
    # 房間座標 → 來源座標
    A = np.array([[x, y, 1] for x, y in ROOM_WIN], float)
    cx = np.linalg.solve(A, [p[0] for p in SRC_WIN]); cy = np.linalg.solve(A, [p[1] for p in SRC_WIN])
    X0, Y0, X1, Y1 = BOX
    for k in KINDS:
        s = scenery(np.array(Image.open(f'{SRC}/{k}.webp').convert('RGB')))
        patch = Image.fromarray(s).transform((X1 - X0, Y1 - Y0), Image.AFFINE,
            (cx[0], cx[1], cx[0] * X0 + cx[1] * Y0 + cx[2], cy[0], cy[1], cy[0] * X0 + cy[1] * Y0 + cy[2]), resample=Image.BILINEAR)
        alpha = np.where(mask[Y0:Y1, X0:X1], 255, np.where(edge[Y0:Y1, X0:X1], 110, 0)).astype(np.uint8)
        out = np.dstack([np.array(patch), alpha])
        Image.fromarray(out).save(f'{OUT}/window_{k}.webp', quality=92, method=6)
        print(k, f'{os.path.getsize(f"{OUT}/window_{k}.webp") // 1024}KB')

if __name__ == '__main__':
    main()
