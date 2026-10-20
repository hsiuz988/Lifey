import os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); sys.path.insert(0, 'tools')
_s=open('tools/cloth.py').read(); exec(_s[:_s.rindex('if __name__')])
OUT='../public/room/char'; os.makedirs(OUT,exist_ok=True)
layers={}
# 身體（擦掉五官）
layers['body']=Image.fromarray(blank(BASE).astype(np.uint8))
# 表情五官＋符號
def feat_only(expr_path):
    if expr_path is None:
        e=BASE.copy()
    else:
        e=align_head(L(expr_path))
    rgb=e[:,:,:3]; reg=ell(e.shape,622,455,252,172)
    dist=np.abs(rgb-SK).sum(2); red=(rgb[:,:,0]-rgb[:,:,1])-(SK[0]-SK[1])
    a=np.clip(np.maximum((dist-40)/30,(red-14)/22),0,1)*ndimage.gaussian_filter(reg.astype(float),3)
    f=e.copy(); f[:,:,3]=a*255; return Image.fromarray(f.astype(np.uint8))
for name,p in (('smile',None),('happy','source/expr_happy.webp'),('angry','source/expr_angry.webp')):
    layers[f'face_{name}']=feat_only(p)
    if p:
        sym=face_layers(p)[1]
        if np.array(sym)[:,:,3].max()>30: layers[f'sym_{name}']=sym
# 頭髮前後
hl=np.array(Image.open('layers/hair_ponytail.png')).astype(float)
inside=ndimage.binary_erosion(BASE[:,:,3]>250,iterations=2)
inside=ndimage.binary_dilation(inside,iterations=2)|(np.arange(BASE.shape[0])[:,None]<640)&(BASE[:,:,3]>20)
b=hl.copy(); b[:,:,3]*=~inside; f=hl.copy(); f[:,:,3]*=inside
layers['hair_ponytail_back']=Image.fromarray(b.astype(np.uint8)); layers['hair_ponytail_front']=Image.fromarray(f.astype(np.uint8))
for nm in ('tee','hoodie'): layers[f'cloth_{nm}']=Image.open(f'layers/cloth_{nm}.png')
# 共同裁切框
bb=None
for im in layers.values():
    a=np.array(im)[:,:,3]>10; ys,xs=np.where(a)
    if not len(xs): continue
    box=(xs.min(),ys.min(),xs.max()+1,ys.max()+1)
    bb=box if bb is None else (min(bb[0],box[0]),min(bb[1],box[1]),max(bb[2],box[2]),max(bb[3],box[3]))
print('bbox',bb)
H=420; s=H/(bb[3]-bb[1]); W=round((bb[2]-bb[0])*s)
for k,im in layers.items():
    im.crop(bb).resize((W,H),Image.LANCZOS).save(f'{OUT}/{k}.webp','WEBP',quality=90)
foot=((626-bb[0])*s, (1222-bb[1])*s)
print('size',W,H,'foot',[round(v,1) for v in foot], 'files',len(layers))
