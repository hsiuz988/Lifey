# 復古娃娃・正面（站著、換裝畫面用；走路時 App 會換成 doll34.py 的側面）
#   source/doll_base.webp           正面光頭素體
#   source/doll_hair_<名稱>.webp    素體＋髮型（_tpose 結尾的是補頭髮用，這裡不用）
#   source/doll_cloth_<名稱>.webp   素體穿衣服（整張當身體）
# 正面不會動，所以不切手腳：只有 身體、後髮、前髮
# 輸出 ../public/room/doll/front/*.webp，並印出 room.js 要用的尺寸和腳底
import os, glob
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from PIL import Image
import numpy as np
from scipy import ndimage

def load(p):
    a = np.array(Image.open(p).convert('RGBA')).astype(float)
    a[:, :, 3] = np.where(a[:, :, 3] > 240, 255, a[:, :, 3]); return a
B = load('source/doll_base.webp')
H, W = B.shape[:2]
yy = np.arange(H)[:, None]
ma = B[:, :, 3] > 20
def img(a): return Image.fromarray(a.astype(np.uint8))

layers = {'body': img(B)}
for f in sorted(glob.glob('source/doll_cloth_*.webp')):
    layers[f'body_{f.split("doll_cloth_")[1][:-5]}'] = img(load(f))

yx = np.mgrid[:H, :W]
face = (((yx[1] - 625) / 228) ** 2 + ((yx[0] - 460) / 165) ** 2 <= 1) & (yx[0] > 362)   # 瀏海以下的臉留給身體
for f in sorted(glob.glob('source/doll_hair_*.webp')):
    name = f.split('doll_hair_')[1][:-5]
    if name.endswith('_tpose'): continue
    Hh = load(f); la = Hh[:, :, 3] > 20
    diff = np.abs(Hh[:, :, :3] - B[:, :, :3]).sum(2)
    back = la & ~ma & (yy < 1000)
    lab, n = ndimage.label(back); sz = ndimage.sum(back, lab, range(1, n + 1)); back = np.isin(lab, np.where(sz > 800)[0] + 1)
    front = la & ma & (ndimage.uniform_filter(diff, 5) > 60) & (yy < 660) & ~face
    front = ndimage.binary_opening(front, iterations=1)
    hb = Hh.copy(); hb[:, :, 3] *= back
    hf = Hh.copy(); hf[:, :, 3] *= ndimage.gaussian_filter(front.astype(float), .6)
    layers[f'hair_{name}_back'] = img(hb); layers[f'hair_{name}_front'] = img(hf)

FOOT = (625, 1228)
bb = None
for im in layers.values():
    ys, xs = np.where(np.array(im)[:, :, 3] > 10)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    bb = box if bb is None else (min(bb[0], box[0]), min(bb[1], box[1]), max(bb[2], box[2]), max(bb[3], box[3]))
OUT_H = 420; k = OUT_H / (bb[3] - bb[1]); OUT_W = round((bb[2] - bb[0]) * k)
OUT = '../public/room/doll/front'; os.makedirs(OUT, exist_ok=True)
for f in glob.glob(f'{OUT}/*.webp'): os.remove(f)
for name, im in layers.items():
    im.crop(bb).resize((OUT_W, OUT_H), Image.LANCZOS).save(f'{OUT}/{name}.webp', 'WEBP', quality=90)
print('layers', sorted(layers))
print('size', OUT_W, OUT_H, 'foot', [round((FOOT[0] - bb[0]) * k, 1), round((FOOT[1] - bb[1]) * k, 1)])
