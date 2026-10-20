import os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); sys.path.insert(0, 'tools')
_s=open('tools/compose2.py').read(); exec(_s[:_s.rindex('if __name__')])

def cloth_layer(path):
    cl, s, off = align_to(BASE, L(path))
    d = np.abs(cl[:, :, :3] - BASE[:, :, :3]).sum(2)
    ca = cl[:, :, 3] > 128; ba = BASE[:, :, 3] > 128
    skin_c = np.abs(cl[:, :, :3] - SK).sum(2) < 60
    skin_b = np.abs(BASE[:, :, :3] - SK).sum(2) < 60
    yy = np.arange(BASE.shape[0])[:, None]
    # 頭和臉一律不要（帽T的帽子在脖子後面，從下巴線以下開始）
    headm = ell(BASE.shape, 622, 345, 290, 288) & (yy < 640)
    dd = ndimage.uniform_filter(d, 5)
    changed = ca & ((dd > 40) | ~ba)
    m = changed & ~headm
    m |= ca & ~headm & ba & ~skin_b & (yy > 620)   # 素體的白色運動服一定要被蓋掉
    m = ndimage.binary_opening(m, iterations=3)
    m = ndimage.binary_fill_holes(m)
    lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n + 1))
    m = np.isin(lab, np.where(sz > 300)[0] + 1)
    m = ndimage.binary_closing(m, iterations=3) & ca
    alpha = ndimage.gaussian_filter(m.astype(float), .7)
    out = cl.copy(); out[:, :, 3] = np.minimum(cl[:, :, 3], alpha * 255)
    # 素體白衣服若有地方沒被蓋到（衣服比較短），用素體皮膚補不了 → 回報
    left = ba & ~skin_b & (yy > 640) & (BASE[:, :, :3].min(2) > 200) & ~m
    return Image.fromarray(out.astype(np.uint8)), s, off, int(left.sum())

def dressup(expr_path, hair_img, cloth_img):
    face, sym = face_layers(expr_path)
    hl = np.array(hair_img).astype(float)
    inside = ndimage.binary_erosion(BASE[:, :, 3] > 250, iterations=2)
    inside = ndimage.binary_dilation(inside, iterations=2) | (np.arange(BASE.shape[0])[:, None] < 640) & (BASE[:, :, 3] > 20)
    back = hl.copy(); back[:, :, 3] *= ~inside
    front = hl.copy(); front[:, :, 3] *= inside
    out = Image.fromarray(back.astype(np.uint8)); out.alpha_composite(face)
    if cloth_img is not None: out.alpha_composite(cloth_img)
    out.alpha_composite(Image.fromarray(front.astype(np.uint8)))
    if sym is not None: out.alpha_composite(sym)
    return out

if __name__ == '__main__':
    hair = Image.open('layers/hair_ponytail.png')
    cl = []
    for i, nm in ((42, 'tee'), (43, 'hoodie')):
        c, s, off, left = cloth_layer(f'source/cloth_{nm}.webp'); print(nm, 'scale', round(s, 4), 'off', [round(float(v), 1) for v in off], 'white left', left)
        c.save(f'layers/cloth_{nm}.png'); cl.append(c)
    combos = [(None, None, cl[0]), ('source/expr_happy.webp', hair, cl[0]), (None, None, cl[1]), ('source/expr_angry.webp', hair, cl[1])]
    sheet = Image.new('RGB', (4 * 860, 1214), (255, 248, 250))
    for k, (e, h, c) in enumerate(combos):
        if h is None:
            im = Image.fromarray(BASE.astype(np.uint8)) if e is None else face_layers(e)[0]
            im = im.copy(); im.alpha_composite(c)
        else:
            im = dressup(e, h, c)
        bg = Image.new('RGBA', im.size, (255, 248, 250, 255)); bg.alpha_composite(im)
        sheet.paste(bg.crop((192, 40, 1052, 1254)).convert('RGB'), (k * 860, 0))
    sheet.resize((1720, 607)).save('preview/cloth_sheet.png')
