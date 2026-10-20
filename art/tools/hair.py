from PIL import Image
import numpy as np
from scipy import ndimage
import sys
sys.path.insert(0,'tools')
from swap2 import blank, feats, L, SK
def ell(shape,cx,cy,rx,ry):
    yy,xx=np.mgrid[:shape[0],:shape[1]]; return ((xx-cx)/rx)**2+((yy-cy)/ry)**2<=1
def extract(base, hair):
    d=np.abs(hair[:,:,:3]-base[:,:,:3]).sum(2)
    new=(base[:,:,3]<128)&(hair[:,:,3]>128)
    changed=(d>60)&(hair[:,:,3]>128)
    skinlike=(np.abs(hair[:,:,:3]-SK).sum(2)<45)&(base[:,:,3]>128)&~((hair[:,:,0]-hair[:,:,1]>40)&(hair[:,:,1]<200))
    m=(changed|new)&~skinlike
    yy=np.mgrid[:m.shape[0],:m.shape[1]][0]
    r,g,b=hair[:,:,0],hair[:,:,1],hair[:,:,2]
    brown=(r>g+18)&(g>b-3)&(r<205)&(r>85)&((r+g+b)>230)
    hairish=brown|((r+g+b<330)&ndimage.binary_dilation(brown,iterations=2))
    # 臉上：眼睛、鼻子嘴巴一律不要；眉毛只留頭髮色（不要生成圖的眉毛）；其他地方只留頭髮
    eyes=ell(m.shape,482,447,80,76)|ell(m.shape,764,447,80,76)
    mouth=np.zeros_like(m); mouth[470:610,560:690]=True
    brows=np.zeros_like(m); brows[288:364,400:528]=True; brows[288:364,715:843]=True
    face=ell(m.shape,622,485,232,135)&(yy>=398)
    m&=~(eyes|mouth)
    # 眉毛：保留生成圖畫的眉毛（和瀏海的交疊最自然）
    m&=~(face&~hairish)
    # 脖子以下：去掉素體身體外框附近、又不是頭髮顏色的細線（縮放後錯位的身體輪廓）
    body=np.zeros_like(m); body[630:,:]=True
    near=ndimage.binary_dilation(brown,iterations=4)
    bodyline=ndimage.binary_dilation((base[:,:,3]>128)&(base[:,:,:3].sum(2)<330),iterations=5)
    m&=~(body&bodyline&~near)
    m=ndimage.binary_opening(m,iterations=1)
    lab,n=ndimage.label(m); sz=ndimage.sum(m,lab,range(1,n+1))
    keep=[i+1 for i in range(n) if sz[i]>400 and (lab[:630]==i+1).any()]
    m=np.isin(lab,keep)
    m=ndimage.binary_closing(m,iterations=3)
    soft=ndimage.gaussian_filter(m.astype(float),.8)
    out=hair.copy(); out[:,:,3]=np.minimum(hair[:,:,3],soft*255)
    return out

def eyes_of(a, box=(380,330,880,560)):
    x0,y0,x1,y1=box; m=a[y0:y1,x0:x1,:3].sum(2)<200
    lab,n=ndimage.label(m); sz=ndimage.sum(m,lab,range(1,n+1)); idx=np.argsort(sz)[-2:]+1
    return sorted([(x+x0,y+y0) for y,x in [ndimage.center_of_mass(m,lab,i) for i in idx]])
def align_to(base, img):
    (bx0,by0),(bx1,by1)=eyes_of(base); (hx0,hy0),(hx1,hy1)=eyes_of(img)
    s=(bx1-bx0)/(hx1-hx0); cxh,cyh=(hx0+hx1)/2,(hy0+hy1)/2; cxb,cyb=(bx0+bx1)/2,(by0+by1)/2
    im=Image.fromarray(img.astype(np.uint8)); big=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    c=Image.new('RGBA',(base.shape[1],base.shape[0]),(0,0,0,0)); c.alpha_composite(big,(round(cxb-cxh*s),round(cyb-cyh*s)))
    return np.array(c).astype(float), s, (cxb-cxh*s, cyb-cyh*s)

BLANK=None
def dress(face_img, layer):
    """face_img: 已經有五官的臉（素體或表情）；在瀏海附近把眉毛蓋成皮膚，再疊頭髮"""
    global BLANK
    if BLANK is None: BLANK=blank(L('source/base.webp'))
    la=np.array(layer)[:,:,3]>128
    zone=np.zeros(la.shape,bool); zone[280:372,395:533]=True; zone[280:372,710:848]=True
    hide=zone&ndimage.binary_dilation(la,iterations=7)
    hide=ndimage.gaussian_filter(hide.astype(float),2)[:,:,None]
    f=np.array(face_img).astype(float); f[:,:,:3]=f[:,:,:3]*(1-hide)+BLANK[:,:,:3]*hide
    out=Image.fromarray(f.astype(np.uint8)); out.alpha_composite(layer); return out

BROWZ=[(404,290,528,362),(717,290,841,362)]
def brow_zone(shape, pad=0):
    z=np.zeros(shape[:2],bool)
    for x0,y0,x1,y1 in BROWZ: z|=ell(shape,(x0+x1)/2,(y0+y1)/2,(x1-x0)/2+pad,(y1-y0)/2+pad)
    return z
def brows_of(img):
    """從（已對齊的）臉上摳出眉毛：眉毛區域裡比皮膚深的筆畫"""
    a=np.array(img).astype(float); z=brow_zone(a.shape)
    dist=np.abs(a[:,:,:3]-SK).sum(2)
    al=np.clip((dist-40)/150,0,1)*z
    core=(al>.85)
    col=np.median(a[core][:,:3],axis=0) if core.any() else np.array([90,50,45.])
    out=np.zeros_like(a); out[:,:,:3]=col; out[:,:,3]=np.clip(al*1.15,0,1)*255
    return Image.fromarray(out.astype(np.uint8))
def dress2(face_img, layer, through=.55):
    """眉毛透過瀏海：臉（擦掉眉毛）→ 頭髮 → 眉毛（壓在頭髮上的部分半透明）"""
    global BLANK
    if BLANK is None: BLANK=blank(L('source/base.webp'))
    br=brows_of(face_img)
    f=np.array(face_img).astype(float); z=ndimage.gaussian_filter(brow_zone(f.shape,4).astype(float),2)[:,:,None]
    f[:,:,:3]=f[:,:,:3]*(1-z)+BLANK[:,:,:3]*z
    out=Image.fromarray(f.astype(np.uint8)); out.alpha_composite(layer)
    ha=np.array(layer)[:,:,3].astype(float)/255
    b=np.array(br).astype(float); b[:,:,3]*=1-(1-through)*ha
    out.alpha_composite(Image.fromarray(b.astype(np.uint8))); return out
