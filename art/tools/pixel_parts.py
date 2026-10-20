"""像素女孩（紙娃娃做法）：頭和身體是分開畫的零件，疊起來就是一個人。

素材（art/source/pixel2/，GPT 生的去背圖，一列排好）：
  head_<髮型>.png/webp   3 顆頭：正面、側面（朝右）、背面。只有頭，下巴有完整外框
  body_<衣服>.png/webp   7 個沒有頭的身體：正面、側面、背面、側面走路 4 格。脖子是一小截皮膚
每張圖都用自己的外框量出「一格像素多大」，統一縮放，所以 GPT 畫多大都沒關係，不用和別張對齊。
組合：頭的下巴疊在脖子上，下巴的外框蓋住接縫。
輸出（public/room/pixel/，267×420）：
  body_<衣服>_front|side|back|walk0-3.webp：脖子固定在 NECK 這一點，走路時腳會自然上下
  head_<髮型>_front|side|back.webp：下巴固定在 NECK 上方一點，所有身體都能直接疊
用法：python3 art/tools/pixel_parts.py
"""
from PIL import Image
import numpy as np, glob, os, re
from collections import Counter

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'art/source/pixel2')
OUT = os.path.join(ROOT, 'public/room/pixel')
CW, CH = 267, 420
UNIT = 5.2            # 輸出時一格像素的大小（畫布 px）
NECK = (133.5, 225)   # 脖子頂端在畫布上的位置
CHIN_OVER = {'front': 2.4, 'side': 1.2, 'back': 2.4}   # 下巴蓋住脖子幾格（正面、背面露出的脖子比較長，壓低一點）
BODY_VIEWS = ['front', 'side', 'back', 'walk0', 'walk1', 'walk2', 'walk3']
HEAD_VIEWS = ['front', 'side', 'back']

def load(f):
    a = np.array(Image.open(f).convert('RGBA')); a[..., 3] = np.where(a[..., 3] >= 128, 255, 0); return a

def parts(a, gap=12):
    op = a[..., 3] > 0; cols = np.where(op.any(0))[0]; g = []; s = p = cols[0]
    for c in cols[1:]:
        if c > p + gap: g.append((s, p)); s = c
        p = c
    g.append((s, p)); out = []
    for x0, x1 in g:
        ys = np.where(op[:, x0:x1 + 1].any(1))[0]; out.append(a[ys[0]:ys[-1] + 1, x0:x1 + 1])
    return out

def unit(a):
    """一格像素多大：深色外框橫向連續的長度裡，最常見的那個（排除 1～2 px 的雜邊）。"""
    d = (a[..., 3] > 0) & (a[..., :3].astype(int).sum(-1) < 180); c = Counter()
    for row in d:
        r = 0
        for v in row:
            if v: r += 1
            elif r: c[r] += 1; r = 0
    return next(k for k, _ in c.most_common() if k >= 4)

def skin(a):
    c = a[..., :3].astype(int)
    return (a[..., 3] > 0) & (c[..., 0] > 220) & (c[..., 1] > 170) & (c[..., 1] < 225) & (c[..., 2] > 140) & (c[..., 2] < 210)

def save(a, k, anchor, at, name):
    """a 縮放 k 倍（最近鄰，保留像素），讓 a 上的 anchor 點落在畫布的 at。"""
    im = Image.fromarray(a); im = im.resize((round(im.width * k), round(im.height * k)), Image.NEAREST)
    c = Image.new('RGBA', (CW, CH)); c.alpha_composite(im, (round(at[0] - anchor[0] * k), round(at[1] - anchor[1] * k)))
    c.save(os.path.join(OUT, f'{name}.webp'), lossless=True)

def files(prefix):
    for f in sorted(glob.glob(f'{SRC}/{prefix}_*')):
        yield re.match(rf'{prefix}_(\w+)\.\w+$', os.path.basename(f)).group(1), f

def main():
    os.makedirs(OUT, exist_ok=True)
    for name, f in files('body'):
        a = load(f); ps = parts(a); u = unit(a); k = UNIT / u
        print(f'衣服 {name}：{len(ps)} 個身體，一格 {u}px')
        for v, p in zip(BODY_VIEWS, ps):
            ys, xs = np.where(skin(p)[:max(3, round(u * 1.5))])   # 脖子：最上面那一截皮膚
            save(p, k, ((xs.min() + xs.max()) / 2, 0), NECK, f'body_{name}_{v}')
    for name, f in files('head'):
        a = load(f); ps = parts(a); u = unit(a); k = UNIT / u
        print(f'髮型 {name}：{len(ps)} 顆頭，一格 {u}px')
        for v, p in zip(HEAD_VIEWS, ps):
            sk = skin(p); H = p.shape[0]
            if v == 'back' or not sk.any():
                chin = (p.shape[1] / 2, H - u * 1.5)
            else:
                ys, xs = np.where(sk); b = ys.max(); xb = xs[ys > b - u * 2]
                cx = (xb.min() + xb.max()) / 2
                if v == 'side': cx = (cx + p.shape[1] / 2) / 2   # 側面：脖子在臉和後腦中間
                chin = (cx, b + u)
            save(p, k, chin, (NECK[0], NECK[1] + CHIN_OVER[v] * UNIT), f'head_{name}_{v}')

if __name__ == '__main__':
    main()
