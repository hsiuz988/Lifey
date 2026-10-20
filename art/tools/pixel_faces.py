"""像素女孩的表情：art/source/pixel2/faces.png（GPT 畫的 10 顆正面頭）→ public/room/pixel/face_<心情>.webp

只取每顆頭「臉」的部分（瀏海下面的皮膚＋五官），縮放到房間用的正面頭（head_bob_front.webp）的臉上，
存成只有臉的透明圖，疊在頭上面。頭髮、耳朵、外框都用原本的，所以不會有接縫、換髮型也能共用。
GPT 每次畫的大小不一樣也沒關係：每張臉各自量範圍再縮放。
重畫某一個表情：放一張單獨的圖，加進 EXTRA（檔名、裁切範圍），會蓋掉 faces.png 裡那一格。
用法：python3 art/tools/pixel_faces.py
"""
from PIL import Image
import numpy as np, os
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'art/source/pixel2')
OUT = os.path.join(ROOT, 'public/room/pixel')
# faces.png：5 欄 × 2 列，順序照提示詞
GRID = [['happy', 'excited', 'calm', 'moved', 'love'], ['tired', 'sad', 'angry', 'nervous', 'miss']]
ROWS, COL_W = [(180, 470), (540, 830)], 300
# 單獨重畫的：心情 → (檔名, 裁切範圍 x0, y0, x1, y1)
EXTRA = {'miss': ('face_miss.png', (1340, 100, 2000, 600))}

def face_mask(a, opaque=None):
    """臉＝最大一塊皮膚色；每一列最左到最右之間都算（把眼睛、嘴巴包進來）"""
    r, g, b = (a[..., i].astype(int) for i in range(3))
    skin = (r > 225) & (g > 185) & (b > 150) & (r - b < 80)
    if opaque is not None: skin &= opaque
    lab, n = ndimage.label(skin)
    m = lab == np.argmax(ndimage.sum(skin, lab, range(1, n + 1))) + 1
    f = np.zeros_like(m)
    for y in np.nonzero(m.any(1))[0]:
        xs = np.nonzero(m[y])[0]; f[y, xs.min():xs.max() + 1] = True
    return f

def bbox(m):
    ys, xs = np.nonzero(m)
    return xs.min(), xs.max(), ys.min(), ys.max()

def main():
    head = np.array(Image.open(f'{OUT}/head_bob_front.webp').convert('RGBA'))
    T = face_mask(head, head[..., 3] > 200)
    tb = bbox(T); yy, xx = np.nonzero(T)
    sheet = np.array(Image.open(f'{SRC}/faces.png').convert('RGB'))
    srcs = {k: sheet[y0:y1, c * COL_W + 5:(c + 1) * COL_W + 5] for (y0, y1), row in zip(ROWS, GRID) for c, k in enumerate(row)}
    for k, (f, (x0, y0, x1, y1)) in EXTRA.items():
        srcs[k] = np.array(Image.open(f'{SRC}/{f}').convert('RGB'))[y0:y1, x0:x1]
    for k, src in srcs.items():
        sb = bbox(face_mask(src))
        sx = sb[0] + (xx - tb[0]) * (sb[1] - sb[0]) / (tb[1] - tb[0])
        sy = sb[2] + (yy - tb[2]) * (sb[3] - sb[2]) / (tb[3] - tb[2])
        out = np.zeros_like(head)
        out[yy, xx, :3] = src[np.round(sy).astype(int), np.round(sx).astype(int)]
        out[yy, xx, 3] = 255
        Image.fromarray(out).save(f'{OUT}/face_{k}.webp', lossless=True)
        print(k)

if __name__ == '__main__':
    main()
