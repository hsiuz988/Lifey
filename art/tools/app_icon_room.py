"""App 圖示：只有房間。牆上的東西（相框＋檯燈、對話框）拆成圖層各自移動，也輸出給 Figma。"""
from PIL import Image
import numpy as np, json, sys
SP='/tmp/claude-0/-home-user/4fb27509-4de8-5fda-baf4-f048a2ab49a7/scratchpad/icon/'
a=np.asarray(Image.open('art/source/brand/wowo_logo.png').convert('RGBA')).astype(int)
cfg=dict(X0=305,W=700,T=160,lift=90,bub_dx=-31,bub_dy=-35)
for kv in sys.argv[1:]: k,v=kv.split('='); cfg[k]=int(v)
X0,W,T=cfg['X0'],cfg['W'],cfg['T']; X1=X0+W
Y0,Y1=391,827
WALL=np.array([253,221,207,255]); WHITE=np.array([252,252,248,255])
HL,WL=a.shape[:2]; yy,xx=np.mgrid[0:HL,0:WL]
def box(xa,xb,ya,yb): return (xx>=xa)&(xx<xb)&(yy>=ya)&(yy<yb)
c=a[...,:3]
notwall=np.abs(c-WALL[:3]).sum(-1)>18
dark=(c.sum(-1)<380)&(c[...,0]>=c[...,2]); orange=(c[...,2]<120)&(c[...,1]>140)&(c[...,0]>220)
objs={
 'frames_lamp': (box(738,906,380,600)|box(746,906,600,645)|box(906,1066,380,540))&notwall&~box(926,944,373,404),  # 燈線留在底圖，被往上移的燈罩接住
 'bubble': box(906,1035,555,695)&notwall&~dark&~orange,
}
# 檯燈的線：上方延伸區是重複第一列，線也會留在原位，所以線跟著燈一起上移就好（底圖已含）
moves={'frames_lamp':(0,-cfg['lift']),'bubble':(cfg['bub_dx'],cfg['bub_dy'])}
# 底圖：先把物件抹成牆色
b=a.copy()
for m in objs.values(): b[m]=WALL
b[box(926,944,373,404)]=a[box(926,944,373,404)]
region=box(738,1066,372,700)
b[region&(np.abs(b[...,:3]-WALL[:3]).sum(-1)<60)]=WALL
R=b[Y0:Y1,X0:X1]
C=np.vstack([np.repeat(b[Y0:Y0+1,X0:X1],T,0),R,np.zeros((W-T-len(R),W,4),int)+WHITE])
H=C.shape[0]; cy=lambda y:y-Y0+T
bed=np.zeros((H,W),bool); bed[cy(780):,:]=True
C[bed&(C[...,:3].min(-1)>215)]=WHITE
base=C.copy(); out=C.copy(); meta={}; s=1024/W
for n,m in objs.items():
    dx,dy=moves[n]; ys,xs=np.where(m)
    ny=ys-Y0+T+dy; nx=xs-X0+dx; k=(ny>=0)&(ny<H)&(nx>=0)&(nx<W)
    out[ny[k],nx[k]]=a[ys[k],xs[k]]
    # Figma 圖層
    y0,y1,x0,x1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
    L=np.zeros((y1-y0,x1-x0,4),np.uint8); L[ys-y0,xs-x0]=a[ys,xs]
    w,h=round((x1-x0)*s),round((y1-y0)*s)
    Image.fromarray(L,'RGBA').resize((w,h),Image.LANCZOS).save(SP+f'figma_{n}.png')
    meta[n]=dict(x=round((x0-X0+dx)*s),y=round((y0-Y0+T+dy)*s),w=w,h=h)
Image.fromarray(base.astype('uint8')).convert('RGB').resize((1024,1024),Image.LANCZOS).save(SP+'figma_base.png')
im=Image.fromarray(out.astype('uint8')).convert('RGB'); im.save(SP+'room_sq_raw.png'); im.resize((1024,1024),Image.LANCZOS).save(SP+'room_icon.png')
json.dump(meta,open(SP+'figma_layers.json','w')); print(meta)
