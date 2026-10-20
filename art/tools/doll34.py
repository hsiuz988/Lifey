# 復古娃娃・四分之三側面（臉朝畫面右下）：切成身體＋頭、近手、遠手、近腳、遠腳，App 走路時手腳前後擺
#   source/doll34_base.webp          光頭素體（四分之三側面）
#   source/doll34_hair_<名稱>.webp   素體＋髮型（同一張畫布）
#   source/doll34_cloth_<名稱>.webp  素體穿衣服：只取脖子以下，頭一律用素體的（頭髮是畫在素體上的，才對得齊）
# 輸出 ../public/room/doll/*.webp，並印出 room.js 要用的尺寸、腳底、關節位置
import os, glob
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

def load(p):
    a = np.array(Image.open(p).convert('RGBA')).astype(float)
    a[:, :, 3] = np.where(a[:, :, 3] > 240, 255, a[:, :, 3]); return a
B = load('source/doll34_base.webp')
H, W = B.shape[:2]
yy = np.arange(H)[:, None]; xx = np.arange(W)[None, :]
ma = B[:, :, 3] > 20
NECK = 645   # 下巴線：以上是頭

def poly(pts):
    im = Image.new('L', (W, H), 0); ImageDraw.Draw(im).polygon([(x + 400, y + 620) for x, y in pts], fill=1); return np.array(im) > 0
ARM_N = poly([(190, 30), (178, 130), (150, 205), (110, 310), (-60, 310), (-60, 200), (120, 25)])   # 近的手（畫面左）
ARM_F = poly([(318, 25), (328, 120), (345, 200), (380, 310), (520, 310), (520, 200), (370, 25)])   # 遠的手（畫面右）

def layer(src, m):
    o = src.copy(); o[:, :, 3] *= ndimage.gaussian_filter(m.astype(float), .6); return Image.fromarray(o.astype(np.uint8))

def cut(C):
    m = C[:, :, 3] > 20
    an, af = ARM_N & m, ARM_F & m
    legs = m & ~(an | af) & (yy > 880)
    ln, lf = legs & (xx < 650), legs & (xx >= 650)
    body = m & ~((an | af) & (yy > 690)) & ~(legs & (yy > 940))
    return {'body': layer(C, body), 'arm_n': layer(C, an), 'arm_f': layer(C, af), 'leg_n': layer(C, ln), 'leg_f': layer(C, lf)}, an | af

def shift_to_base(C):
    """衣服圖用腿和鞋對齊素體（AI 重畫時整個人常常偏幾 px）"""
    T = C[:, :, 3] > 128; ref = ma[960:1245]; best = None
    for dx in range(-20, 21):
        for dy in range(-20, 21):
            v = (np.roll(np.roll(T, dy, 0), dx, 1)[960:1245] != ref).sum()
            if best is None or v < best[0]: best = (v, dx, dy)
    return np.roll(np.roll(C, best[2], 0), best[1], 1), best[1:]

def with_base_head(C):
    """脖子以下用衣服圖，頭用素體的；接縫在脖子，用 8px 漸層接起來"""
    w = np.clip((yy - (NECK - 8)) / 16, 0, 1) * np.ones((1, W))
    w = np.where(ma & (yy < NECK + 8), w, 1.0)          # 素體頭以外照用衣服圖
    w = np.where(yy < NECK - 8, np.where(ma, 0.0, 1.0), w)
    out = C.copy()
    hb = B.copy()
    for k in range(3): out[:, :, k] = C[:, :, k] * w + hb[:, :, k] * (1 - w)
    out[:, :, 3] = np.where(yy < NECK - 8, np.where(ma, B[:, :, 3], 0), C[:, :, 3] * w + B[:, :, 3] * (1 - w))
    return out

layers = {}
parts, arms = cut(B)
layers.update(parts)
for f in sorted(glob.glob('source/doll34_cloth_*.webp')):
    name = f.split('doll34_cloth_')[1][:-5]
    C, off = shift_to_base(load(f)); print(name, 'offset', off)
    for k, im in cut(with_base_head(C))[0].items(): layers[f'{k}_{name}'] = im

# 頭髮：身體外面的放最後面，蓋在頭上的（瀏海、側髮）放前面；臉（瀏海以下）留給身體
yx = np.mgrid[:H, :W]
face = (((yx[1] - 715) / 190) ** 2 + ((yx[0] - 490) / 125) ** 2 <= 1) & (yx[0] > 405) & (yx[1] < 885)
arms_d = ndimage.binary_dilation(arms, iterations=10)
for f in sorted(glob.glob('source/doll34_hair_*.webp')):
    name = f.split('doll34_hair_')[1][:-5]
    Hh = load(f); la = Hh[:, :, 3] > 20
    diff = np.abs(Hh[:, :, :3] - B[:, :, :3]).sum(2)
    back = la & ~ndimage.binary_dilation(ma, iterations=3) & (yy < 1000)
    back = ndimage.binary_opening(back, iterations=2)
    lab, n = ndimage.label(back); sz = ndimage.sum(back, lab, range(1, n + 1)); back = np.isin(lab, np.where(sz > 800)[0] + 1)
    # 頭髮緊貼身體輪廓的地方，把剛剛 dilation 去掉的那圈補回來
    back |= la & ndimage.binary_dilation(back, iterations=3) & ~ma & (diff > 60)
    front = la & ma & (ndimage.uniform_filter(diff, 5) > 60) & (yy < NECK + 40) & ~face
    front = ndimage.binary_opening(front, iterations=1)
    hb = Hh.copy()
    # 手擺開時會露出手後面的頭髮：用頭髮的底色補（只補在頭髮範圍內）
    span = np.zeros_like(back)
    for y in range(NECK - 20, 1000):
        xs = np.where(back[y])[0]
        if len(xs): span[y, xs.min():xs.max() + 1] = True
    bottom = np.full(W, -1)
    for x in range(W):
        ys = np.where(back[:, x])[0]
        if len(ys): bottom[x] = ys.max()
    ok = bottom >= 0
    if ok.any():
        bot = np.interp(np.arange(W), np.arange(W)[ok], bottom[ok])
        hole = arms_d & span & ~back & (yy <= bot[None, :])
        base = np.median(Hh[back & (Hh[:, :, :3].sum(2) < 200)][:, :3], axis=0) if (back & (Hh[:, :, :3].sum(2) < 200)).any() else [45, 38, 36]
        hb[hole, :3] = base; hb[hole, 3] = 255
        back |= hole
    hb[:, :, 3] *= back
    layers[f'hair_{name}_back'] = Image.fromarray(hb.astype(np.uint8))
    hf = Hh.copy(); hf[:, :, 3] *= ndimage.gaussian_filter(front.astype(float), .6)
    layers[f'hair_{name}_front'] = Image.fromarray(hf.astype(np.uint8))

PIV = {'arm_n': (572, 690), 'arm_f': (716, 700), 'leg_n': (600, 875), 'leg_f': (700, 875)}
FOOT = (640, 1226)
bb = None
for im in layers.values():
    ys, xs = np.where(np.array(im)[:, :, 3] > 10)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    bb = box if bb is None else (min(bb[0], box[0]), min(bb[1], box[1]), max(bb[2], box[2]), max(bb[3], box[3]))
OUT_H = 420; k = OUT_H / (bb[3] - bb[1]); OUT_W = round((bb[2] - bb[0]) * k)
OUT = '../public/room/doll'; os.makedirs(OUT, exist_ok=True)
for f in glob.glob(f'{OUT}/*.webp'): os.remove(f)
for name, im in layers.items():
    im.crop(bb).resize((OUT_W, OUT_H), Image.LANCZOS).save(f'{OUT}/{name}.webp', 'WEBP', quality=90)
t = lambda p: [round((p[0] - bb[0]) * k, 1), round((p[1] - bb[1]) * k, 1)]
print('layers', sorted(layers))
print('size', OUT_W, OUT_H, 'foot', t(FOOT), 'pivots', {n: t(p) for n, p in PIV.items()})
