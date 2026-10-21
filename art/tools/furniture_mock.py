# 生活印記家具試放：把 art/source/furniture/*.png 去背縮放貼進房間，輸出預覽（還沒進 app）
import sys; sys.path.insert(0,'art/tools')
from joy_icons import white_cut
from PIL import Image
import numpy as np
from scipy import ndimage

LINE = (62, 23, 11)  # 房間外框的顏色
def reline(im, w=3):
    """縮小後外框會變細變淡：沿著外輪廓重畫一圈跟房間一樣粗、一樣深的線"""
    a = np.array(im)
    m = a[..., 3] > 128
    ring = m & ~ndimage.binary_erosion(m, iterations=w)
    a[ring, :3] = LINE
    a[..., 3] = np.where(m, 255, 0)
    return Image.fromarray(a)
import sys
RELINE='--raw' not in sys.argv
room=Image.open('public/room/pixel_room/room.webp').convert('RGBA')
# key: (中心x, 底部y, 寬)
PLACE={'cat':(520,520,130),'coffee':(705,330,70),'meal':(470,830,190),'camera':(190,300,170),'gift':(1130,930,120),'sunset':(1290,780,130),'bear':(330,720,95)}
for k,(cx,by,w) in PLACE.items():
    im=white_cut(f'art/source/furniture/{k}.png')
    im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
    if RELINE: im=reline(im)
    room.alpha_composite(im,(cx-w//2,by-im.height))
room.save('art/source/furniture/mock.png')
