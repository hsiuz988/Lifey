# 無眉毛素體生的頭髮：頭髮裡沒有眉毛，眉毛一律來自表情（在頭髮下面）
import os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); sys.path.insert(0, 'tools')
exec(open('tools/compose.py').read().split("if __name__")[0])
NB = L('source/base_no_brows.png')

def hair_layer2(hair_path):
    hr, s, off = align_to(NB, L(hair_path))
    m = extract(NB, hr)[:, :, 3] > 128
    eyes = ell(m.shape, 482, 447, 80, 76) | ell(m.shape, 764, 447, 80, 76)
    mouth = np.zeros_like(m); mouth[470:610, 560:690] = True
    m &= ~(eyes | mouth)
    skin_g = np.abs(hr[:, :, :3] - SK).sum(2) < 70
    ring = ndimage.binary_dilation(m, iterations=3) & ~m & (NB[:, :, 3] > 128) & skin_g & ~eyes & ~mouth & ~brow_zone(m.shape, 6)
    alpha = ndimage.gaussian_filter((m | ring).astype(float), .7)
    out = hr.copy(); out[:, :, 3] = np.minimum(hr[:, :, 3], alpha * 255)
    return Image.fromarray(out.astype(np.uint8)), s, off

def compose2(expr_path, hair_img):
    face, sym = face_layers(expr_path)
    hl = np.array(hair_img).astype(float)
    inside = ndimage.binary_erosion(BASE[:, :, 3] > 250, iterations=2)
    inside = ndimage.binary_dilation(inside, iterations=2) | (np.arange(BASE.shape[0])[:, None] < 640) & (BASE[:, :, 3] > 20)
    back = hl.copy(); back[:, :, 3] *= ~inside
    front = hl.copy(); front[:, :, 3] *= inside
    out = Image.fromarray(back.astype(np.uint8)); out.alpha_composite(face)
    out.alpha_composite(Image.fromarray(front.astype(np.uint8)))
    if sym is not None: out.alpha_composite(sym)
    return out

if __name__ == '__main__':
    src, name = sys.argv[1], sys.argv[2]
    hl, s, off = hair_layer2(src); print('scale', round(s, 4), 'offset', [round(float(v), 1) for v in off])
    hl.save(f'layers/hair_{name}.png')
    exprs = [None, 'source/expr_happy.webp', 'source/expr_angry.webp']
    full = Image.new('RGB', (3 * 860, 1214), (255, 248, 250)); zoom = Image.new('RGB', (3 * 540, 320), (255, 248, 250))
    for j, ep in enumerate(exprs):
        im = compose2(ep, hl); bg = Image.new('RGBA', im.size, (255, 248, 250, 255)); bg.alpha_composite(im)
        full.paste(bg.crop((192, 40, 1052, 1254)).convert('RGB'), (j * 860, 0))
        zoom.paste(bg.crop((360, 240, 900, 560)).convert('RGB'), (j * 540, 0))
    full.resize((1290, 607)).save(f'preview/{name}2_full.png'); zoom.save(f'preview/{name}2_zoom.png')
