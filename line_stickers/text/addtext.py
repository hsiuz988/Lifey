import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
FONT='/tmp/claude-0/-home-user-wowo/2738fc30-8cc0-5d7d-a9fd-6292969169a7/scratchpad/font/Cubic_11.ttf'
def text_layer(text, fill, outline, scale=4):
    f=ImageFont.truetype(FONT,12)
    w=int(f.getlength(text))+4; h=16
    m=Image.new('L',(w,h),0); d=ImageDraw.Draw(m); d.fontmode='1'
    d.text((2,2),text,font=f,fill=255)
    m=m.crop(m.getbbox()); m=Image.fromarray(np.pad(np.array(m),1))
    o=m.filter(ImageFilter.MaxFilter(3))
    lay=Image.new('RGBA',m.size,(0,0,0,0))
    lay.paste(outline,(0,0),o); lay.paste(fill,(0,0),m)
    return lay.resize((lay.width*scale,lay.height*scale),Image.NEAREST)
def compose(base, text, fill, outline, top=10, scale=4):
    im=Image.open(base).convert('RGBA'); t=text_layer(text,fill,outline,scale)
    im.alpha_composite(t,((240-t.width)//2,top)); return im
if __name__=='__main__':
    base,text,out,fill,outline=sys.argv[1:6]
    compose(base,text,fill,outline).save(out)
