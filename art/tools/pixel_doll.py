"""像素女孩：把 GPT 生的圖對齊到光頭素體，切成「身體」和「頭」兩層，輸出 App 用的 webp。

素材（art/source/pixel/，都是去背 PNG）：
  base.png            光頭素體三面（正面、側面、背面）
  base_walk.png       光頭素體側面走路 4 格
  hair_<名稱>.png     在光頭素體三面上加頭髮
  cloth_<名稱>.png    光頭素體三面換衣服
  cloth_<名稱>_walk.png  光頭素體走路 4 格換衣服
GPT 每張圖都會稍微縮放、偏移，所以每張都用剪影重新對齊：
  站姿用腿和鞋子（頭髮、衣服不會改到那裡），走路用光頭的頭形。
輸出（public/room/pixel/，267×420，腳底在 (133.5, 418)）：
  body[_衣服]_front/side.webp、body[_衣服]_walk0..3.webp：脖子以下
  head[_髮型]_front/side.webp：脖子以上（含臉）；走路共用 side
用法：python3 art/tools/pixel_doll.py
"""
from PIL import Image
import numpy as np, glob, os, re

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'art/source/pixel')
OUT = os.path.join(ROOT, 'public/room/pixel')
CW, CH, FOOT, K = 267, 420, (133.5, 418), 0.47   # 畫布、腳底、master → 畫布的縮放
VIEWS = ['front', 'side']                        # 背面之後要用再加

def load(f):
    a = np.array(Image.open(f).convert('RGBA')); a[..., 3] = np.where(a[..., 3] >= 128, 255, 0); return a

def figs(a, gap=15):
    op = a[..., 3] > 0; cols = np.where(op.any(0))[0]; g = []; s = p = cols[0]
    for c in cols[1:]:
        if c > p + gap: g.append((s, p)); s = c
        p = c
    g.append((s, p))
    return [(x0, x1, *np.where(op[:, x0:x1 + 1].any(1))[0][[0, -1]]) for x0, x1 in g]

def crop(a, f, pad=60):
    x0, x1, y0, y1 = f; c = np.zeros((y1 - y0 + 1 + 2 * pad, x1 - x0 + 1 + 2 * pad, 4), np.uint8)
    c[pad:pad + y1 - y0 + 1, pad:pad + x1 - x0 + 1] = a[y0:y1 + 1, x0:x1 + 1]; return c

def warp(img, s, dx, dy, shape):
    """img 縮放 s、平移 (dx,dy) 後放進 shape 大小（最近鄰，保留像素）。"""
    H, W = shape[:2]; yy, xx = np.mgrid[0:H, 0:W]
    sx = np.round((xx - dx) / s).astype(int); sy = np.round((yy - dy) / s).astype(int)
    ok = (sx >= 0) & (sx < img.shape[1]) & (sy >= 0) & (sy < img.shape[0])
    out = np.zeros((H, W, img.shape[2]), img.dtype); out[ok] = img[sy[ok], sx[ok]]; return out

def register(A, B, ra, rb, srange, step=0.005, k=2):
    """找 A→B 的縮放＋平移，讓兩個剪影（只看 ra/rb 這幾列）最吻合。回傳 (吻合度, (s,dx,dy))。"""
    a = A.copy(); b = B.copy()
    a[:ra[0]] = 0; a[ra[1]:] = 0; b[:rb[0]] = 0; b[rb[1]:] = 0
    a2, b2 = a[::k, ::k], b[::k, ::k]
    ya, xa = np.where(a2); yb, xb = np.where(b2)
    H, W = b2.shape; yy, xx = np.mgrid[0:H, 0:W]; best = (-1, None)
    for s in np.arange(srange[0], srange[1] + 1e-9, step):
        dx0 = xb.mean() - s * xa.mean(); dy0 = yb.mean() - s * ya.mean()
        for ddx in np.arange(-3, 3.01, .5):
            for ddy in np.arange(-3, 3.01, .5):
                dx, dy = dx0 + ddx, dy0 + ddy
                sx = np.round((xx - dx) / s).astype(int); sy = np.round((yy - dy) / s).astype(int)
                ok = (sx >= 0) & (sx < a2.shape[1]) & (sy >= 0) & (sy < a2.shape[0])
                w = np.zeros_like(b2); w[ok] = a2[sy[ok], sx[ok]]
                iou = (w & b2).sum() / (w | b2).sum()
                if iou > best[0]: best = (iou, (s, dx * k, dy * k))
    return best

def check(name, iou):
    flag = '' if iou > 0.94 else '  ← 對不太齊，可能要重生這張'
    print(f'  {name}: 吻合度 {iou:.3f}{flag}')

def neck_row(a):
    """脖子：白色背心最上面那一列。"""
    c = a[..., :3].astype(int); white = (c.min(-1) > 235) & (a[..., 3] > 0); H = a.shape[0]
    return next(y for y in range(int(H * .45), int(H * .85)) if white[y].sum() > 8)

def hairish(a):
    c = a[..., :3].astype(int); r, g, b = c[..., 0], c[..., 1], c[..., 2]
    return (r < 190) & (r >= g) & (g >= b - 10) & (c.sum(-1) < 430) & (a[..., 3] > 0)

def export(img, name, foot):
    """master 座標 → 267×420 畫布（腳底對齊），存 webp。"""
    big = Image.fromarray(img)
    w, h = round(big.width * K), round(big.height * K)
    small = big.resize((w, h), Image.LANCZOS)
    c = Image.new('RGBA', (CW, CH)); c.alpha_composite(small, (round(FOOT[0] - foot[0] * K), round(FOOT[1] - foot[1] * K)))
    c.save(os.path.join(OUT, f'{name}.webp'), quality=92, method=6)

def main():
    os.makedirs(OUT, exist_ok=True)
    base = load(f'{SRC}/base.png'); fb = figs(base)
    master = {v: crop(base, fb[i]) for i, v in enumerate(VIEWS)}
    neck = {v: neck_row(master[v]) for v in VIEWS}
    foot = {}
    for v in VIEWS:
        m = master[v]; ys, xs = np.where(m[..., 3] > 0); bottom = ys.max()
        foot[v] = (xs[ys > bottom - 40].mean(), bottom)
    rows_of = lambda a: np.mgrid[0:a.shape[0], 0:a.shape[1]][0]

    def body_head(img, v, hair=False):
        yy = rows_of(img)
        body = img.copy(); body[yy < neck[v]] = 0
        head = np.zeros_like(img); keep = yy < neck[v]
        if hair: keep |= (yy >= neck[v]) & (yy < neck[v] + 60) & hairish(img)
        head[keep] = img[keep]
        return body, head

    # 光頭素體
    print('光頭素體')
    for v in VIEWS:
        body, head = body_head(master[v], v)
        export(body, f'body_{v}', foot[v]); export(head, f'head_{v}', foot[v])
    # 走路：用光頭的頭形對齊到側面素體
    def walk_frames(path, prefix):
        a = load(path); fw = figs(a); m = master['side']
        for i, f in enumerate(fw[:4]):
            w = crop(a, f); Hw = w.shape[0]
            iou, (s, dx, dy) = register(w[..., 3] > 0, m[..., 3] > 0, (0, int(Hw * .55)), (0, int(neck['side'] * .95)), (1.0, 1.4))
            check(f'走路第 {i + 1} 格', iou)
            body, _ = body_head(warp(w, s, dx, dy, m.shape), 'side')
            export(body, f'{prefix}_walk{i}', foot['side'])
    walk_frames(f'{SRC}/base_walk.png', 'body')
    # 衣服：用腿對齊
    for path in sorted(glob.glob(f'{SRC}/cloth_*.png')):
        name = re.match(r'cloth_(\w+?)(_walk)?\.png', os.path.basename(path))
        if name.group(2): continue
        n = name.group(1); print(f'衣服 {n}'); a = load(path); fa = figs(a)
        for i, v in enumerate(VIEWS):
            o = crop(a, fa[i]); m = master[v]; Ho, Hm = o.shape[0], m.shape[0]
            iou, (s, dx, dy) = register(o[..., 3] > 0, m[..., 3] > 0, (int(Ho * .8), Ho), (int(Hm * .8), Hm), (0.9, 1.12))
            check(v, iou)
            body, _ = body_head(warp(o, s, dx, dy, m.shape), v)
            export(body, f'body_{n}_{v}', foot[v])
        if os.path.exists(f'{SRC}/cloth_{n}_walk.png'): walk_frames(f'{SRC}/cloth_{n}_walk.png', f'body_{n}')
    # 頭髮：用腿對齊，取脖子以上整顆頭（含臉）
    for path in sorted(glob.glob(f'{SRC}/hair_*.png')):
        n = re.match(r'hair_(\w+)\.png', os.path.basename(path)).group(1); print(f'髮型 {n}')
        a = load(path); fa = figs(a)
        for i, v in enumerate(VIEWS):
            h = crop(a, fa[i]); m = master[v]; Hh, Hm = h.shape[0], m.shape[0]
            iou, (s, dx, dy) = register(h[..., 3] > 0, m[..., 3] > 0, (int(Hh * .8), Hh), (int(Hm * .8), Hm), (0.9, 1.12))
            check(v, iou)
            hw = warp(h, s, dx, dy, (m.shape[0] + 60, m.shape[1] + 120, 4))[:m.shape[0]]
            hw = np.pad(hw, ((0, 0), (0, 0), (0, 0)))[:, :m.shape[1]] if hw.shape[1] >= m.shape[1] else hw
            _, head = body_head(hw, v, hair=True)
            export(head, f'head_{n}_{v}', foot[v])

if __name__ == '__main__':
    main()
