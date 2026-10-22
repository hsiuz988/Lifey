// 生活印記的設定：門檻和每件家具（改數字不用動程式）
// 某個小幸福收藏滿 DAYS 個不同的日子，房間就多一件跟它的圖示對應的家具；拿到就永遠是你的
export const IMPRINT_DAYS = 10;

// key 是小幸福的圖示（joys.js 的 JOY_ICONS）；圖在 room/imprints/<key>.webp（art/tools/imprint_items.py 產生）
// x, y：家具底部中間在房間裡的位置；w, h：大小；r：放在地板上的家具擋住走路的半徑（地板座標 0~1，沒有就是放在家具上）
// z：疊的順序（小的先畫，被後面的蓋住）
export const IMPRINTS = {
  cat: { name: '小貓抱枕', where: '床上', x: 520, y: 520, w: 130, h: 81, z: 2 },
  coffee: { name: '拿鐵和咖啡壺', where: '書桌上', x: 705, y: 330, w: 70, h: 30, z: 1 },
  meal: { name: '小矮桌和碗筷', where: '電視前的地毯上', x: 975, y: 705, w: 170, h: 121, r: .07, z: 3 },
  hearts: { name: '愛心氣球', where: '禮物旁邊', x: 280, y: 650, w: 115, h: 189, z: 3 },
  gift: { name: '禮物盒', where: '書櫃旁邊', x: 245, y: 705, w: 105, h: 141, r: .04, z: 4 },
  bear: { name: '熊熊玩偶', where: '床邊', x: 330, y: 720, w: 95, h: 126, r: .035, z: 5 },
  paw: { name: '貓狗玩偶', where: '書櫃上', x: 150, y: 430, w: 92, h: 62, z: 2 },
  moon: { name: '月亮小夜燈', where: '床頭', x: 300, y: 468, w: 44, h: 56, z: 1 },
  star: { name: '星星吊飾', where: '書桌旁的牆上', x: 1022, y: 240, w: 200, h: 135, z: 1 },
  sneaker: { name: '地球儀', where: '書櫃上', x: 212, y: 396, w: 62, h: 86, z: 1 },
};
