# 組合：素體＋表情＋頭髮，規則：
#   眉毛不變的表情 → 眉毛區整塊用頭髮生成圖（只會有一條眉毛，和瀏海的交疊跟原圖一樣）
#   眉毛會變的表情（生氣、難過、緊張）→ 頭髮圖層去掉生成圖的眉毛，用表情的眉毛
#   頭髮在臉上的邊緣多帶 3px 生成圖的皮膚，消除粉色光暈
#   表情的符號（生氣記號、眼淚等紅／藍色）疊在頭髮上面
import os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); sys.path.insert(0, 'tools')
from hair import *

BASE = L('source/base.webp')
BROW_CHANGES = {'angry', 'sad', 'nervous'}

def head_box(a):
    m = a[:, :, 3] > 128
    top = np.where(m.any(1))[0].min()
    xs = np.where(m[top + 224])[0]
    return top, xs.min(), xs.max()

def align_head(img):
    """表情圖：用頭的外框對齊（表情的眼睛形狀會變，不能用眼睛對）"""
    t0, l0, r0 = head_box(BASE); t1, l1, r1 = head_box(img)
    s = (r0 - l0) / (r1 - l1)
    im = Image.fromarray(img.astype(np.uint8)); big = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    c = Image.new('RGBA', im.size, (0, 0, 0, 0)); c.alpha_composite(big, (round((l0 + r0) / 2 - (l1 + r1) / 2 * s), round(t0 - t1 * s)))
    return np.array(c).astype(float)

def face_layers(expr_path):
    """回傳（臉，符號圖層）；None＝素體原本的微笑"""
    if expr_path is None:
        return Image.fromarray(BASE.astype(np.uint8)), None
    e = align_head(L(expr_path))
    rgb = e[:, :, :3]
    reg = ell(e.shape, 622, 455, 252, 172)
    dist = np.abs(rgb - SK).sum(2); red = (rgb[:, :, 0] - rgb[:, :, 1]) - (SK[0] - SK[1])
    a = np.clip(np.maximum((dist - 40) / 30, (red - 14) / 22), 0, 1) * ndimage.gaussian_filter(reg.astype(float), 3)
    f = e.copy(); f[:, :, 3] = a * 255
    face = Image.fromarray(blank(BASE).astype(np.uint8)); face.alpha_composite(Image.fromarray(f.astype(np.uint8)))
    # 符號：頭上鮮紅（生氣記號）或水藍（眼淚、汗）
    head = (BASE[:, :, 3] > 128) & (np.arange(e.shape[0])[:, None] < 640)
    above = np.zeros_like(head); above[:395, 385:865] = True
    sym = head & ((above & (rgb[:, :, 0] > 200) & (rgb[:, :, 1] < 130) & (rgb[:, :, 2] < 140)) | ((rgb[:, :, 2] > 200) & (rgb[:, :, 0] < 170)))
    sym = ndimage.binary_dilation(ndimage.binary_opening(sym, iterations=1), iterations=3) & ~reg
    s = e.copy(); s[:, :, 3] = ndimage.gaussian_filter(sym.astype(float), .8) * e[:, :, 3]
    return face, Image.fromarray(s.astype(np.uint8))

def hair_layer(hair_path, own_brows):
    hr, _, _ = align_to(BASE, L(hair_path))
    m = extract(BASE, hr)[:, :, 3] > 128
    r, g, b = hr[:, :, 0], hr[:, :, 1], hr[:, :, 2]
    skin_g = np.abs(hr[:, :, :3] - SK).sum(2) < 70
    if not own_brows:
        skinfrac = ndimage.uniform_filter(skin_g.astype(float), 11)
        browline = brow_zone(m.shape, 10) & (r + g + b < 450) & (skinfrac > .3)
        m &= ~ndimage.binary_dilation(browline, iterations=2)
        # 眉毛區：只留真正的髮絲（頭髮色＋緊貼它的外框），其他深色線都當成生成圖的眉毛丟掉
        bz = brow_zone(m.shape, 14)
        strand = (r > g + 12) & (r > 95) & (r + g + b > 260)
        strand = ndimage.binary_opening(strand, iterations=1)
        m &= ~(bz & ~ndimage.binary_dilation(strand, iterations=2))
    eyes = ell(m.shape, 482, 447, 80, 76) | ell(m.shape, 764, 447, 80, 76)
    mouth = np.zeros_like(m); mouth[470:610, 560:690] = True
    onface = BASE[:, :, 3] > 128
    ring = ndimage.binary_dilation(m, iterations=3) & ~m & onface & skin_g & ~eyes & ~mouth
    if not own_brows: ring &= ~brow_zone(m.shape, 14)
    alpha = ndimage.gaussian_filter((m | ring).astype(float), .7)
    if own_brows:
        patch = ndimage.gaussian_filter(brow_zone(m.shape, 16).astype(float), 3)
        alpha = np.maximum(alpha, patch)
    out = hr.copy(); out[:, :, 3] = np.minimum(hr[:, :, 3], alpha * 255)
    return Image.fromarray(out.astype(np.uint8))

def compose(expr, expr_path, hair_path):
    face, sym = face_layers(expr_path)
    hl = np.array(hair_layer(hair_path, expr not in BROW_CHANGES)).astype(float)
    # 身體外面的頭髮放在身體後面（長髮、馬尾），身體上面的（瀏海、側邊）放前面
    inside = ndimage.binary_erosion(BASE[:, :, 3] > 250, iterations=2)
    inside = ndimage.binary_dilation(inside, iterations=2) | (np.arange(BASE.shape[0])[:, None] < 640) & (BASE[:, :, 3] > 20)
    back = hl.copy(); back[:, :, 3] *= ~inside
    front = hl.copy(); front[:, :, 3] *= inside
    out = Image.fromarray(back.astype(np.uint8)); out.alpha_composite(face)
    out.alpha_composite(Image.fromarray(front.astype(np.uint8)))
    if sym is not None: out.alpha_composite(sym)
    return out
