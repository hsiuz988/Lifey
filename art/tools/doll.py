# 【舊版・正正面】現在 App 用的是 doll34.py（四分之三側面）；這支只輸出到 preview/doll_front 留作參考
# 復古娃娃（會走路的版本）：把素體切成 身體＋頭、左右手、左右腳，App 走路時讓手腳繞關節擺動
#   source/doll_base.webp            光頭素體（手臂離開身體、兩腿分開）
#   source/doll_hair_long.webp       同一張圖＋長直髮
#   source/doll_hair_long_tpose.webp 長直髮、雙手平舉：拿來補手臂後面被擋住的頭髮
#   source/doll_cloth_<名稱>.webp    光頭素體穿上衣服：整套當作那件衣服的身體和手腳
#   source/doll_expr_<名稱>.webp     光頭素體換表情：只取臉的範圍（眉、眼、嘴、腮紅）
# 輸出 ../public/room/doll/*.webp，並印出 room.js 要用的尺寸、腳底、關節位置
import os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage
B = np.array(Image.open('source/doll_base.webp').convert('RGBA')).astype(float)
Lg = np.array(Image.open('source/doll_hair_long.webp').convert('RGBA')).astype(float)
for a in (B, Lg): a[:, :, 3] = np.where(a[:, :, 3] > 240, 255, a[:, :, 3])
H, W = B.shape[:2]
ma = B[:, :, 3] > 20
def poly(pts):
    im = Image.new('L', (W, H), 0); ImageDraw.Draw(im).polygon(pts, fill=1); return np.array(im) > 0
OX, OY = 380, 640
c = lambda pts: [(x + OX, y + OY) for x, y in pts]
armL = poly(c([(176, 28), (178, 150), (90, 300), (-40, 300), (-40, 180), (120, 28)])) & ma
armR = poly(c([(318, 28), (316, 150), (400, 300), (540, 300), (540, 180), (370, 28)])) & ma
mid = 625
legL = ma & ~(armL | armR) & (np.arange(H)[:, None] > 895) & (np.arange(W)[None, :] < mid)
legR = ma & ~(armL | armR) & (np.arange(H)[:, None] > 895) & (np.arange(W)[None, :] >= mid)
hem = 935
shoulder = 700
torso = ma.copy()
yy = np.arange(H)[:, None]
torso &= ~((armL | armR) & (yy > shoulder))
torso &= ~((legL | legR) & (yy > hem))
def layer(src, m):
    o = src.copy(); o[:, :, 3] *= ndimage.gaussian_filter(m.astype(float), .6); return Image.fromarray(o.astype(np.uint8))
parts = {k: layer(B, m) for k, m in (('armL', armL), ('armR', armR), ('legL', legL), ('legR', legR), ('torso', torso))}

def outfit(path):
    """穿了衣服的整張圖 → 身體、左右手、左右腳（用它自己的輪廓，切的位置跟素體一樣）"""
    C = np.array(Image.open(path).convert('RGBA')).astype(float)
    C[:, :, 3] = np.where(C[:, :, 3] > 240, 255, C[:, :, 3])
    mc = C[:, :, 3] > 20
    pts = lambda q: poly(c(q)) & mc
    aL = pts([(176, 28), (178, 150), (90, 300), (-40, 300), (-40, 180), (100, 28)])
    aR = pts([(318, 28), (316, 150), (400, 300), (540, 300), (540, 180), (390, 28)])
    lL = mc & ~(aL | aR) & (yy > 895) & (np.arange(W)[None, :] < mid)
    lR = mc & ~(aL | aR) & (yy > 895) & (np.arange(W)[None, :] >= mid)
    t = mc & ~((aL | aR) & (yy > shoulder)) & ~((lL | lR) & (yy > hem))
    return {'body': layer(C, t), 'arm_l': layer(C, aL), 'arm_r': layer(C, aR), 'leg_l': layer(C, lL), 'leg_r': layer(C, lR)}

def face(path):
    """表情圖 → 只留臉（橢圓範圍、邊緣柔和），疊在身體上面、前髮下面"""
    E = np.array(Image.open(path).convert('RGBA')).astype(float)
    yx = np.mgrid[:H, :W]
    reg = ((yx[1] - 625) / 245) ** 2 + ((yx[0] - 460) / 168) ** 2 <= 1
    E[:, :, 3] = 255 * ndimage.gaussian_filter(reg.astype(float), 6) * (E[:, :, 3] > 128)
    return Image.fromarray(E.astype(np.uint8))
# hair from long version
la = Lg[:, :, 3] > 20
diff = np.abs(Lg[:, :, :3] - B[:, :, :3]).sum(2)
back = la & ~ma & (yy < 960)
lab, n = ndimage.label(back); sz = ndimage.sum(back, lab, range(1, n + 1)); back = np.isin(lab, np.where(sz > 800)[0] + 1)
front = la & ma & (ndimage.uniform_filter(diff, 5) > 60) & (yy < 660)
front = ndimage.binary_opening(front, iterations=1)
# 臉（瀏海下緣以下、兩側頭髮以內）屬於表情圖層：不然長髮圖的眼睛嘴巴會蓋在別的表情上
_yx = np.mgrid[:H, :W]
front &= ~((((_yx[1] - 625) / 228) ** 2 + ((_yx[0] - 460) / 165) ** 2 <= 1) & (_yx[0] > 362))
# hair hidden behind the arms comes from the T-pose image (same character, arms lifted out of the way)
T = np.array(Image.open('source/doll_hair_long_tpose.webp').convert('RGBA')).astype(float)
Thair = (T[:, :, 3] > 128) & (T[:, :, :3].sum(2) < 420)
Thair = ndimage.binary_closing(Thair, iterations=2)
arms = ndimage.binary_dilation(armL | armR, iterations=12)
back &= ~(arms & ~Thair)                      # drops bits of the long image's hand outline
hole = arms & ~back & Thair & (yy > 690)      # T-pose arms sit at shoulder height, above this
hb = Lg.copy()
hb[hole] = T[hole]; hb[hole, 3] = 255
# just around the shoulders the T-pose arm is in the way too: plain hair colour there
span = np.zeros_like(back)
for y in range(640, 760):
    xs_ = np.where(back[y])[0]
    if len(xs_): span[y, xs_.min():xs_.max() + 1] = True
sh = arms & ~back & ~hole & span & (yy < 760)
hb[sh, :3] = np.median(Lg[back & (Lg[:, :, :3].sum(2) < 200)][:, :3], axis=0); hb[sh, 3] = 255
hole |= sh
hb[:, :, 3] *= (back | hole)
hairB = Image.fromarray(hb.astype(np.uint8))
hf = Lg.copy(); hf[:, :, 3] *= ndimage.gaussian_filter(front.astype(float), .6); hairF = Image.fromarray(hf.astype(np.uint8))
PIV = {'arm_l': (548, 705), 'arm_r': (702, 705), 'leg_l': (578, 905), 'leg_r': (672, 905)}
FOOT = (625, 1228)
layers = {'body': parts['torso'], 'arm_l': parts['armL'], 'arm_r': parts['armR'], 'leg_l': parts['legL'], 'leg_r': parts['legR'],
          'hair_long_back': hairB, 'hair_long_front': hairF}
import glob
for f in sorted(glob.glob('source/doll_cloth_*.webp')):
    name = f.split('doll_cloth_')[1][:-5]
    for k, im in outfit(f).items(): layers[f'{k}_{name}'] = im
for f in sorted(glob.glob('source/doll_expr_*.webp')):
    layers[f'face_{f.split("doll_expr_")[1][:-5]}'] = face(f)
bb = None
for im in layers.values():
    ys, xs = np.where(np.array(im)[:, :, 3] > 10)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    bb = box if bb is None else (min(bb[0], box[0]), min(bb[1], box[1]), max(bb[2], box[2]), max(bb[3], box[3]))
OUT_H = 420; k = OUT_H / (bb[3] - bb[1]); OUT_W = round((bb[2] - bb[0]) * k)
OUT = 'preview/doll_front'; os.makedirs(OUT, exist_ok=True)
for name, im in layers.items():
    im.crop(bb).resize((OUT_W, OUT_H), Image.LANCZOS).save(f'{OUT}/{name}.webp', 'WEBP', quality=90)
t = lambda p: [round((p[0] - bb[0]) * k, 1), round((p[1] - bb[1]) * k, 1)]
print('layers', sorted(layers))
print('size', OUT_W, OUT_H, 'foot', t(FOOT), 'pivots', {n: t(p) for n, p in PIV.items()})
