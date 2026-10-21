# 生活印記家具試放：把 art/source/furniture/*.png 去背縮放貼進房間，輸出預覽（還沒進 app）
import sys; sys.path.insert(0,'art/tools')
from joy_icons import white_cut
from PIL import Image
room=Image.open('public/room/pixel_room/room.webp').convert('RGBA')
# key: (中心x, 底部y, 寬)
PLACE={'cat':(520,520,130),'coffee':(705,330,70),'meal':(470,830,190),'camera':(190,300,170),'gift':(1270,760,120)}
for k,(cx,by,w) in PLACE.items():
    im=white_cut(f'art/source/furniture/{k}.png')
    im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS)
    room.alpha_composite(im,(cx-w//2,by-im.height))
room.save('art/source/furniture/mock.png')
