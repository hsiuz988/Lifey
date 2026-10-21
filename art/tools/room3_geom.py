"""新房間（room_final）的地板座標：用四個角算 homography（GPT 的圖左右斜度不一樣，不能用平行四邊形）。
python3 art/tools/room3_geom.py → 印出給 room.js 的 H、HI，並畫一張 BLOCKS／熱點檢查圖到 scratchpad"""
import sys
import numpy as np
from PIL import Image, ImageDraw

# 地板四個角（房間座標）：後角 O、右角、左角、前角（前角被切平，這是兩條邊延長的交點）
O, R, L, F = (766, 395), (1457, 723), (100, 649), (824, 1047)

def homography(src, dst):
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u]); A.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, Vt = np.linalg.svd(np.array(A, float)); h = Vt[-1] / Vt[-1][-1]
    return h.reshape(3, 3)

# uv → xy：u 沿右牆（O→R），v 沿左牆（O→L）
H = homography([(0, 0), (1, 0), (0, 1), (1, 1)], [O, R, L, F])
HI = np.linalg.inv(H); HI /= HI[2, 2]
def xy(u, v):
    p = H @ [u, v, 1]; return p[:2] / p[2]
def uv(x, y):
    p = HI @ [x, y, 1]; return p[:2] / p[2]

if __name__ == '__main__':
    np.set_printoptions(precision=6, suppress=True)
    print('H', [round(float(x), 6) for x in H.ravel()])
    print('HI', [round(float(x), 9) for x in HI.ravel()])
    for name, pts in [(n, p) for n, p in [a.split('=') for a in sys.argv[1:]]]:
        x, y = map(float, pts.split(','))
        print(name, np.round(uv(x, y), 3))
