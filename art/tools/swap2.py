# 新素體（source/base.webp）：擦掉五官、從同畫布的表情圖取五官貼回
from PIL import Image
import numpy as np
from scipy import ndimage
SK=np.array([252,216,192.])
BOXES=[(408,296,520,356),(723,296,835,356),(380,362,552,572),(694,362,866,572),(604,478,633,507),(570,510,676,600)]
def ell(shape,cx,cy,rx,ry):
    yy,xx=np.mgrid[:shape[0],:shape[1]]; return ((xx-cx)/rx)**2+((yy-cy)/ry)**2<=1
def region(shape,pad):
    r=np.zeros(shape[:2],bool)
    for x0,y0,x1,y1 in BOXES: r|=ell(shape,(x0+x1)/2,(y0+y1)/2,(x1-x0)/2+pad,(y1-y0)/2+pad)
    return r
def blank(b):
    rgb=b[:,:,:3]; feat=region(b.shape,6)
    good=(~feat)&(b[:,:,3]>200)&(np.abs(rgb-SK).sum(2)<70)
    fill=None
    for sg in (8,20,45):
        w=ndimage.gaussian_filter(good.astype(float),sg)
        f=np.stack([ndimage.gaussian_filter(rgb[:,:,c]*good,sg) for c in range(3)],2)/np.maximum(w,1e-6)[:,:,None]
        ok=(w>.15)[:,:,None]
        fill=np.where(ok,f,np.nan) if fill is None else np.where(np.isnan(fill)&ok,f,fill)
    fill=np.where(np.isnan(fill),SK,fill); out=b.copy(); out[feat,:3]=fill[feat]; return out
def feats(h):
    rgb=h[:,:,:3]; reg=ndimage.gaussian_filter(region(h.shape,16).astype(float),3)
    dist=np.abs(rgb-SK).sum(2); red=(rgb[:,:,0]-rgb[:,:,1])-(SK[0]-SK[1])
    a=np.clip(np.maximum((dist-40)/30,(red-14)/22),0,1)*reg
    out=h.copy(); out[:,:,3]=a*255; return out
L=lambda p: np.array(Image.open(p).convert('RGBA')).astype(float)
def compose(base_path, expr_path):
    b=Image.fromarray(blank(L(base_path)).astype(np.uint8)); b.alpha_composite(Image.fromarray(feats(L(expr_path)).astype(np.uint8))); return b
if __name__=='__main__':
    base=Image.open('source/base.webp').convert('RGBA'); empty=Image.fromarray(blank(L('source/base.webp')).astype(np.uint8))
    happy=compose('source/base.webp','source/expr_happy.webp'); gen=Image.open('source/expr_happy.webp').convert('RGBA')
    sheet=Image.new('RGBA',(4*640,700),(255,248,250,255))
    for k,im in enumerate([base,empty,gen,happy]): sheet.alpha_composite(im.crop((307,20,947,720)),(k*640,0))
    sheet.convert('RGB').resize((2048,560)).save('preview/new_face.png')
    # 正面／背面疊在一起看輪廓
    back=Image.open('source/base_back.webp').convert('RGBA')
    ov=Image.new('RGBA',base.size,(255,255,255,255)); a=np.array(base)[:,:,3]>128; c=np.array(back)[:,:,3]>128
    o=np.full(a.shape+(3,),255,np.uint8); o[a&c]=(200,200,200); o[a&~c]=(240,90,120); o[c&~a]=(80,140,230)
    trip=Image.new('RGB',(3*1254,1254),'white'); trip.paste(base.convert('RGB'),(0,0)); trip.paste(back.convert('RGB'),(1254,0)); trip.paste(Image.fromarray(o),(2508,0))
    trip.resize((1881,627)).save('preview/front_back.png')
