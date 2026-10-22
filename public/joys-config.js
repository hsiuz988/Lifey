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
  cake: { name: '杯子蛋糕', where: '書桌上', x: 705, y: 334, w: 58, h: 58, z: 1 },
  call: { name: '復古電話', where: '書桌上', x: 948, y: 380, w: 72, h: 57, z: 1 },
  camera: { name: '拍立得相機', where: '牆角的層架上', x: 715, y: 165, w: 58, h: 53, z: 1 },
  home: { name: '全家福相框', where: '牆角的層架上', x: 842, y: 180, w: 56, h: 55, z: 1 },
  plant: { name: '小多肉盆栽', where: '窗台上', x: 470, y: 398, w: 64, h: 49, z: 1 },
  sparkle: { name: '星光串燈', where: '窗簾桿上', x: 470, y: 312, w: 300, h: 178, z: 2 },
  sunset: { name: '風景明信片', where: '窗戶旁的牆上', x: 700, y: 270, w: 96, h: 79, z: 1 },
  game: { name: '掌上遊戲機', where: '床上', x: 520, y: 515, w: 110, h: 69, z: 2 },
  workout: { name: '瑜珈墊和啞鈴', where: '書櫃旁邊', x: 245, y: 705, w: 70, h: 106, r: .04, z: 4 },
  book: { name: '一疊書', where: '小熊旁邊', x: 420, y: 712, w: 66, h: 65, r: .03, z: 5 },
};

// 擺放位置（多選一，使用者定案）：同一個位置一次只放一件；換上新的，原本那件自動收起來，隨時可以換回來
// 每個圖示都要有位置（還沒有家具圖的也先排好）；SLOTS 是位置的名稱
export const SLOTS = {
  'desk-left': '書桌左邊', 'desk-right': '書桌右端', 'shelf-left': '角落層架左邊', 'shelf-right': '角落層架右邊',
  sill: '窗台', rod: '窗簾桿', 'window-wall': '窗戶旁的牆', 'bookcase-right': '書櫃頂', 'bookcase-left': '書櫃頂',
  bedhead: '床頭', bed: '床上', 'bookcase-floor': '書櫃旁的地板', bedside: '床邊的地板', 'bear-right': '小熊旁邊',
  rug: '地毯中間', 'rug-front': '地毯旁邊', 'front-floor': '房間前面的地板', 'tv-cubby': '電視櫃最左格', 'tv-top': '電視櫃上',
  'door-floor': '門邊的地板', 'door-front': '門前', 'door-hook': '門上的掛鉤', 'wall-right': '右邊的牆上',
};
const SLOT_OF = {
  coffee: 'desk-left', cake: 'desk-left', call: 'desk-right', camera: 'shelf-left', home: 'shelf-right',
  plant: 'sill', sparkle: 'rod', sunset: 'window-wall', sneaker: 'bookcase-right', paw: 'bookcase-left',
  moon: 'bedhead', cat: 'bed', game: 'bed', gift: 'bookcase-floor', workout: 'bookcase-floor', bear: 'bedside', book: 'bear-right',
  meal: 'rug', cook: 'rug', hearts: 'rug-front', icecream: 'front-floor', music: 'tv-cubby', sun: 'tv-top', movie: 'tv-top', sing: 'tv-top',
  umbrella: 'door-floor', shop: 'door-floor', clean: 'door-floor', letter: 'door-front', bath: 'door-hook', bike: 'door-hook', star: 'wall-right',
};
export const slotOf = (key) => SLOT_OF[key] || key;
// 一串放出來的家具（新的在前）→ 每個位置只留第一件
export function onePerSlot(keys) {
  const seen = new Set();
  return keys.filter((k) => { const s = slotOf(k); if (seen.has(s)) return false; seen.add(s); return true; });
}
