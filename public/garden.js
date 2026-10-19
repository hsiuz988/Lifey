// 心情與今天的小東西：10 種情緒（小人的表情、花園的花）、40 個小圖（今天記的事出現在場景裡）
// 情緒和小圖都是先畫好的一套，依紀錄的文字配對；開了 AI 故事時由 AI 從同一套裡挑
const OUTLINE = '#2a2230';

// 情緒：key、名稱、圖示、代表的花；順序也是自動判斷時比對的順序（越前面越優先）
export const EMOTIONS = [
  { key: 'happy', label: '開心', icon: '😊', flower: '向日葵' },
  { key: 'excited', label: '興奮', icon: '🤩', flower: '鬱金香' },
  { key: 'calm', label: '平靜', icon: '😌', flower: '雛菊' },
  { key: 'moved', label: '感動', icon: '🥹', flower: '康乃馨' },
  { key: 'love', label: '戀愛', icon: '🥰', flower: '玫瑰' },
  { key: 'tired', label: '累', icon: '😪', flower: '薰衣草' },
  { key: 'sad', label: '難過', icon: '😢', flower: '鈴蘭' },
  { key: 'angry', label: '生氣', icon: '😠', flower: '火鶴' },
  { key: 'nervous', label: '緊張', icon: '😰', flower: '風鈴草' },
  { key: 'miss', label: '想念', icon: '🥺', flower: '蒲公英' },
];
export const emotionByKey = (k) => EMOTIONS.find((e) => e.key === k) || null;

// 先比對否定和比較具體的詞（「不開心」要算難過、「好想睡」要算累）
const EMO_WORDS = [
  ['sad', ['不開心', '難過', '傷心', '哭', '失落', '低落', '沮喪', '心痛', '遺憾', '寂寞', '孤單', '懷疑自己', '想哭', '心碎', '崩潰']],
  ['angry', ['生氣', '氣死', '火大', '不爽', '討厭', '抓狂', '憤怒', '很煩', '好煩', '超煩', '氣炸']],
  ['nervous', ['緊張', '焦慮', '擔心', '害怕', '不安', '壓力', '忐忑', '怕怕']],
  ['tired', ['累', '疲憊', '想睡', '睏', '沒力', '好忙', '加班', '爆肝', '耗盡', '倦']],
  ['miss', ['想念', '思念', '懷念', '好想', '想你', '想他', '想她', '想家']],
  ['moved', ['感動', '感謝', '感恩', '暖心', '溫暖', '鼻酸', '謝謝']],
  ['love', ['心動', '戀愛', '害羞', '臉紅', '告白', '約會', '好愛', '我愛', '愛上', '喜歡你', '甜蜜', '幸福']],
  ['excited', ['興奮', '超開心', '太棒', '好期待', '期待', '好嗨', '爽', '激動', '耶']],
  ['happy', ['開心', '快樂', '高興', '好棒', '滿足', '好玩', '笑', '讚', '不錯']],
  ['calm', ['平靜', '放鬆', '舒服', '悠閒', '輕鬆', '自在', '安靜', '療癒', '慢慢']],
];

// 從心情欄（沒有就看事件）判斷情緒：最先寫到的情緒為準；重疊的詞（「不開心」「好想睡」）照清單順序挑
export function detectEmotion(feel, text, mood) {
  for (const src of [feel, text]) {
    if (!src) continue;
    const hits = [];
    EMO_WORDS.forEach(([key, words], prio) => words.forEach((w) => {
      for (let i = src.indexOf(w); i >= 0; i = src.indexOf(w, i + 1)) hits.push({ key, prio, start: i, end: i + w.length });
    }));
    if (!hits.length) continue;
    const first = hits.reduce((x, y) => (y.start < x.start ? y : x));
    return hits.filter((x) => x.start < first.end && first.start < x.end).sort((x, y) => x.prio - y.prio)[0].key;
  }
  if (mood >= 4) return 'happy';
  if (mood === 3) return 'calm';
  if (mood && mood <= 2) return 'sad';
  return null;
}

// ---------- 今天的小東西 ----------
const S = (rows, colors) => ({ rows, colors: { o: OUTLINE, ...colors } });
const W_ = '#f5f0e6';
export const ITEMS = {
  coffee: { label: '咖啡', words: ['咖啡', '拿鐵', '美式', '星巴克', 'cafe', 'coffee'], ...S(['.ooo..', 'owwwoo', 'oxxxo.o', 'oxxxoo', '.ooo.'], { x: '#8a5a3c', w: W_ }) },
  milktea: { label: '奶茶', words: ['奶茶', '珍奶', '手搖', '飲料', '綠茶', '紅茶'], ...S(['...o.', '...o.', 'ooooo', 'owwwo', 'oxxxo', 'oxyxo', 'ooooo'], { x: '#d9b38c', y: '#3a2a20', w: W_ }) },
  cake: { label: '蛋糕', words: ['蛋糕', '甜點', '慶生', '生日'], ...S(['...y...', '...o...', 'ooooooo', 'oxxxxxo', 'owwwwwo', 'oxxxxxo', 'ooooooo'], { x: '#f6b3c8', w: '#fff5e8', y: '#ffd36b' }) },
  ramen: { label: '拉麵', words: ['拉麵', '牛肉麵', '麵', '湯'], ...S(['.w.w.w.', 'ooooooo', 'oyyyyyo', 'oxxxxxo', '.oxxxo.', '..ooo..'], { x: '#e05a3a', y: '#f3d27a', w: '#ffffff' }) },
  hotpot: { label: '火鍋', words: ['火鍋', '麻辣鍋', '涮涮鍋', '燒肉', '烤肉'], ...S(['o.....o', 'ooooooo', 'oyryryo', 'oxxxxxo', '.ooooo.'], { x: '#8a8f99', y: '#ffd36b', r: '#e05a3a' }) },
  bento: { label: '便當', words: ['便當', '午餐', '晚餐', '早餐', '吃飯', '餐廳', '吃了'], ...S(['ooooooo', 'owwoyyo', 'owwoggo', 'ooooooo'], { w: '#ffffff', y: '#ffd36b', g: '#7fbf6a' }) },
  beer: { label: '啤酒', words: ['啤酒', '喝酒', '調酒', '酒吧', '乾杯', '紅酒'], ...S(['.www.', 'ooooo.', 'oyyyoo', 'oyyyo.o', 'oyyyoo', 'ooooo.'], { y: '#f3b33d', w: '#ffffff' }) },
  icecream: { label: '冰淇淋', words: ['冰淇淋', '霜淇淋', '冰', '剉冰'], ...S(['.ooo.', 'oxxxo', 'oxxxo', '.oyo.', '.oyo.', '..o..'], { x: '#f6b3c8', y: '#d9a45b' }) },
  run: { label: '跑步', words: ['跑步', '慢跑', '馬拉松', '路跑', '跑了'], ...S(['oooo...', 'oxxxo..', 'oxxxxoo', 'owwwwwo', 'ooooooo'], { x: '#e05a3a', w: '#ffffff' }) },
  swim: { label: '游泳', words: ['游泳', '泳池', '潛水'], ...S(['.ooooo.', 'orwrwro', 'ow...wo', 'or...ro', 'ow...wo', 'orwrwro', '.ooooo.'], { r: '#e05a3a', w: '#ffffff' }) },
  gym: { label: '健身', words: ['健身', '重訓', '運動', '瑜珈', '有氧', '打球', '籃球', '羽球'], ...S(['oo.....oo', 'oxo...oxo', 'oxoooooxo', 'oxo...oxo', 'oo.....oo'], { x: '#8a8f99' }) },
  book: { label: '書', words: ['看書', '閱讀', '小說', '書店', '圖書館', '讀了'], ...S(['ooooooo', 'oxxwxxo', 'oxxwxxo', 'oxxwxxo', 'ooooooo'], { x: '#3f7fd1', w: W_ }) },
  movie: { label: '電影', words: ['電影', '看片', '影集', '追劇', 'netflix', '戲院'], ...S(['.w.w.', 'wwwww', 'ororo', 'orwro', 'ororo', 'ooooo'], { r: '#e05a3a', w: '#ffffff' }) },
  game: { label: '遊戲', words: ['遊戲', '打電動', '電玩', 'switch', '手遊', '桌遊'], ...S(['.ooooo.', 'oxxxxxo', 'oyxxxro', 'oxxxxxo', '.oo.oo.'], { x: '#b8bcc8', y: '#ffd36b', r: '#e05a3a' }) },
  music: { label: '音樂', words: ['音樂', '唱歌', 'ktv', '演唱會', '聽歌', '樂團', '鋼琴', '吉他'], ...S(['..ooo', '..oxo', '..o..', '..o..', 'ooo..', 'oxo..', 'ooo..'], { x: '#c9b6ff' }) },
  paint: { label: '畫畫', words: ['畫畫', '繪畫', '畫了', '手作', '插畫'], ...S(['.oooo.', 'oxrxxo', 'oxxbxo', 'oyxxo.', '.ooo..'], { x: '#f5e6c8', r: '#e05a3a', b: '#3f7fd1', y: '#ffd36b' }) },
  camera: { label: '相機', words: ['拍照', '相機', '攝影', '照片', '合照'], ...S(['.oo....', 'ooooooo', 'oxxwwxo', 'oxwbwxo', 'oxxwwxo', 'ooooooo'], { x: '#8a8f99', w: '#ffffff', b: '#3f7fd1' }) },
  suitcase: { label: '行李箱', words: ['旅行', '出國', '行李', '飛機', '機場', '出差', '旅遊'], ...S(['..ooo..', 'ooyoyoo', 'oxxxxxo', 'oyyyyyo', 'oxxxxxo', 'ooooooo'], { x: '#9a6634', y: '#d9a45b' }) },
  mountain: { label: '山', words: ['爬山', '登山', '山上', '健行', '步道'], ...S(['...o...', '..owo..', '.oxxxo.', 'oxxxxxo', 'ooooooo'], { x: '#6cb67a', w: '#ffffff' }) },
  beach: { label: '海邊', words: ['海邊', '沙灘', '衝浪', '看海', '海'], ...S(['..ooo..', '.orwro.', 'orwrwro', 'ooooooo', '...o...', '...o...', 'yyyyyyy'], { r: '#e05a3a', w: '#ffffff', y: '#f3d27a' }) },
  bike: { label: '腳踏車', words: ['腳踏車', '單車', 'ubike', '騎車'], ...S(['....oo.', '.o..o..', '.ooooo.', 'ooo.ooo', 'o.o.o.o', 'ooo.ooo'], {}) },
  scooter: { label: '機車', words: ['機車', '騎機車', '摩托車'], ...S(['....oo', '...oo.', 'ooooo.', 'oxxxxo', 'oxxxxxo', '.o..o.'], { x: '#3fa89a' }) },
  train: { label: '捷運', words: ['捷運', '火車', '高鐵', '通勤', '公車'], ...S(['.ooooo.', 'owwwwwo', 'oxxxxxo', 'oxxxxxo', 'ooooooo', '.o...o.'], { x: '#4f86a6', w: '#bfe6ff' }) },
  laptop: { label: '筆電', words: ['上班', '工作', '電腦', '開會', '簡報', '加班', '寫程式', '專案', '主管'], ...S(['.ooooo.', 'obbbbbo', 'obbbbbo', '.ooooo.', 'ooooooo'], { b: '#9fd3ff' }) },
  document: { label: '文件', words: ['文件', '報告', '作業', '論文', '企劃'], ...S(['oooo.', 'owwoo', 'owwwo', 'oxxwo', 'owwwo', 'ooooo'], { w: '#ffffff', x: '#9aa6c8' }) },
  exam: { label: '考卷', words: ['考試', '考卷', '讀書', '唸書', '期中', '期末', '補習'], ...S(['ooooo', 'owwwo', 'orwro', 'owrwo', 'owwwo', 'ooooo'], { w: '#ffffff', r: '#e05a3a' }) },
  gradcap: { label: '畢業帽', words: ['畢業', '學位', '學士', '碩士'], ...S(['...o...', '.ooooo.', 'ooooooo', '..ooo.y', '..ooo.y'], { y: '#ffd36b' }) },
  umbrella: { label: '雨傘', words: ['下雨', '雨傘', '颱風', '淋雨'], ...S(['..ooo..', '.oxxxo.', 'oxxxxxo', 'ooooooo', '...o...', '...o...', '..oo...'], { x: '#4f86a6' }) },
  bouquet: { label: '花束', words: ['花束', '送花', '買花', '花'], ...S(['.r.p.', 'rpypr', '.ryr.', '..g..', '.ogo.', '.ooo.'], { r: '#e0607e', p: '#f6b3c8', y: '#ffd36b', g: '#7fbf6a' }) },
  gift: { label: '禮物', words: ['禮物', '收到', '驚喜', '交換禮物'], ...S(['.o.o.', 'ooroo', 'oxrxo', 'ooroo', 'oxrxo', 'ooooo'], { x: '#9fd3ff', r: '#e0607e' }) },
  balloon: { label: '氣球', words: ['派對', '慶祝', '聚會', '聚餐', '同學會'], ...S(['.ooo.', 'oxwxo', 'oxxxo', 'oxxxo', '.ooo.', '..o..'], { x: '#e0607e', w: '#f6b3c8' }) },
  box: { label: '紙箱', words: ['搬家', '紙箱', '打包', '整理', '大掃除'], ...S(['ooooooo', 'oxxyxxo', 'oxxyxxo', 'oxxxxxo', 'ooooooo'], { x: '#d9a45b', y: '#f3d27a' }) },
  medicine: { label: '藥袋', words: ['看醫生', '生病', '感冒', '醫院', '發燒', '吃藥', '診所', '牙醫'], ...S(['.ooo.', 'owwwo', 'owrwo', 'orrro', 'owrwo', 'ooooo'], { w: '#ffffff', r: '#e05a3a' }) },
  shopping: { label: '購物袋', words: ['逛街', '購物', '買了', '網購', '百貨', '超市'], ...S(['..o.o..', '.o...o.', 'ooooooo', 'oxxxxxo', 'oxxxxxo', 'ooooooo'], { x: '#f6b3c8' }) },
  bone: { label: '骨頭', words: ['狗', '貓', '寵物', '遛狗', '毛孩'], ...S(['oo...oo', 'owoooow', 'owwwwwo', 'owoooow', 'oo...oo'], { w: '#ffffff' }) },
  plant: { label: '盆栽', words: ['種花', '植物', '盆栽', '園藝', '澆花'], ...S(['..g..', '.ggg.', 'g.g.g', '..g..', 'ooooo', 'oxxxo', '.ooo.'], { g: '#5aa65a', x: '#c97a4a' }) },
  pan: { label: '平底鍋', words: ['煮飯', '做菜', '料理', '烘焙', '下廚', '煮了'], ...S(['.ooooo....', 'owwwwwoooo', 'owwyywo...', 'owwwwwo...', '.ooooo....'], { w: '#ffffff', y: '#ffd36b' }) },
  star: { label: '星星', words: ['升職', '得獎', '完成', '成功', '錄取', '考上', '加薪', '達成'], ...S(['...o...', '..oyo..', 'ooyyyoo', '.oyyyo.', '.oyoyo.', 'oo...oo'], { y: '#ffd36b' }) },
  letter: { label: '信', words: ['寫信', '卡片', '信', '明信片'], ...S(['ooooooo', 'owoooow', 'owwowwo', 'owwwwwo', 'ooooooo'], { w: '#ffffff' }) },
  heart: { label: '愛心', words: ['約會', '告白', '紀念日', '交往', '情人節'], ...S(['.o.o.', 'oxoxo', 'oxxxo', '.oxo.', '..o..'], { x: '#e0607e' }) },
};
export const ITEM_KEYS = Object.keys(ITEMS);

// 從事件文字找出今天的小東西（最多 n 個，依出現的先後）
export function detectItems(text, n = 2) {
  const src = (text || '').toLowerCase();
  const hits = [];
  for (const [key, it] of Object.entries(ITEMS)) {
    let pos = Infinity;
    for (const w of it.words) { const i = src.indexOf(w); if (i >= 0 && i < pos) pos = i; }
    if (pos < Infinity) hits.push([pos, key]);
  }
  return hits.sort((a, b) => a[0] - b[0]).slice(0, n).map(([, k]) => k);
}

// ---------- 花：種類看情緒、顏色看心情好壞 ----------
export const FLOWER_W = 13;
export const FLOWER_H = 16;
const MOOD_PETAL = ['#9aa6c8', '#9fc4e6', '#a8e0d2', '#ffc6d6', '#ffd36b']; // 心情 1–5
const STEM = '#5aa65a';
const LEAF = '#7fcf6a';

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
}
const disc = (g, cx, cy, r, c) => {
  for (let y = 0; y < FLOWER_H; y++) for (let x = 0; x < FLOWER_W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5) g[y][x] = c;
};

// 每一種花的花朵（花莖在 x=6，從 y=6 往下）
const HEADS = {
  happy(g, c) { // 向日葵：一圈花瓣、咖啡色的花心
    disc(g, 6, 5, 4.3, c);
    [[6, 0], [6, 10], [1, 5], [11, 5]].forEach(([x, y]) => { g[y][x] = c; });
    disc(g, 6, 5, 1.8, '#9a6634');
  },
  excited(g, c) { // 鬱金香：杯子形、上面三個尖
    for (let y = 2; y <= 8; y++) for (let x = 3; x <= 9; x++) if (y > 3 || x === 3 || x === 6 || x === 9) g[y][x] = c;
    g[8][3] = g[8][9] = null;
    for (let y = 4; y <= 7; y++) g[y][6] = shade(c, 0.85);
  },
  calm(g, c) { // 雛菊：八片圓花瓣、黃色花心
    [[6, 2], [6, 8], [3, 5], [9, 5], [4, 3], [8, 3], [4, 7], [8, 7]].forEach(([x, y]) => disc(g, x, y, 1.2, c));
    disc(g, 6, 5, 1.3, '#ffd36b');
  },
  moved(g, c) { // 康乃馨：圓圓一團、上緣鋸齒
    disc(g, 6, 6, 3.6, c);
    for (let x = 3; x <= 9; x += 2) g[2][x] = c;
    for (let x = 4; x <= 8; x += 2) g[5][x] = shade(c, 0.85);
  },
  love(g, c) { // 玫瑰：圓的花、中間捲起來
    disc(g, 6, 5, 3.7, c);
    [[5, 4], [6, 4], [7, 5], [6, 6], [5, 6], [4, 5]].forEach(([x, y]) => { g[y][x] = shade(c, 0.78); });
    g[5][6] = c;
  },
  tired(g, c) { // 薰衣草：一串小花穗
    for (let y = 0; y <= 8; y += 2) { g[y][5] = c; g[y][7] = c; g[y + 1][6] = shade(c, 0.85); }
  },
  sad(g, c) { // 鈴蘭：彎彎的花莖、垂下來的小鈴鐺
    for (let x = 3; x <= 9; x++) g[3][x] = STEM;
    g[4][2] = g[4][10] = STEM;
    for (const x of [2, 6, 10]) { if (x !== 6) { g[5][x - 1] = g[5][x] = g[5][x + 1] = c; g[6][x - 1] = g[6][x + 1] = c; } }
    g[4][6] = STEM; g[5][5] = g[5][6] = g[5][7] = c; g[6][5] = g[6][7] = c;
  },
  angry(g, c) { // 火鶴：一片愛心形的大苞片、往上翹的花穗
    disc(g, 5, 6, 2.6, c); disc(g, 8, 6, 2.6, c);
    g[9][6] = g[9][7] = c;
    for (let y = 1; y <= 5; y++) g[y][8 + (y < 3 ? 1 : 0)] = '#ffd36b';
  },
  nervous(g, c) { // 風鈴草：兩朵往下開的鐘形花
    for (const [x0, y0] of [[2, 2], [7, 5]]) {
      g[y0][x0 + 1] = g[y0][x0 + 2] = c;
      for (let x = x0; x <= x0 + 3; x++) { g[y0 + 1][x] = c; g[y0 + 2][x] = c; }
      g[y0 + 3][x0 - 1] = g[y0 + 3][x0 + 4] = c; for (let x = x0; x <= x0 + 3; x++) g[y0 + 3][x] = shade(c, 0.85);
    }
    g[1][4] = g[1][5] = g[2][6] = STEM; g[3][6] = g[4][6] = STEM;
  },
  miss(g, c) { // 蒲公英：毛茸茸的白色圓球
    for (let y = 0; y <= 10; y++) for (let x = 1; x <= 11; x++) {
      const r = (x - 6) ** 2 + (y - 5) ** 2;
      if (r <= 22 && (r >= 11 || (x + y) % 2 === 0)) g[y][x] = '#f4f6fa';
    }
    disc(g, 6, 5, 1.2, c);
  },
};

// stage：'sprout' 今天剛種的芽、'bud' 花苞、'bloom' 開花
export function flowerGrid(emo, mood, stage) {
  const g = Array.from({ length: FLOWER_H }, () => Array(FLOWER_W).fill(null));
  const petal = MOOD_PETAL[(mood || 3) - 1];
  if (stage === 'sprout') {
    for (let y = 11; y < FLOWER_H - 1; y++) g[y][6] = STEM;
    g[11][5] = g[10][4] = g[11][7] = g[10][8] = LEAF;
    return g;
  }
  for (let y = 6; y < FLOWER_H - 1; y++) g[y][6] = STEM;
  g[11][4] = g[11][5] = g[12][4] = LEAF;
  g[10][7] = g[10][8] = g[9][8] = LEAF;
  if (stage === 'bud') { disc(g, 6, 5, 1.7, petal); g[7][6] = STEM; return g; }
  (HEADS[emo] || HEADS.calm)(g, petal);
  return g;
}

// 畫到 canvas（1 格 = 1 單位），外圍描一圈深色邊
export function drawFlower(ctx, g, ox, oy, dim = (c) => c) {
  const at = (x, y) => y >= 0 && y < FLOWER_H && x >= 0 && x < FLOWER_W && g[y][x];
  for (let y = -1; y <= FLOWER_H; y++) {
    for (let x = -1; x <= FLOWER_W; x++) {
      let c = at(x, y);
      if (!c && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy))) c = OUTLINE;
      if (c) { ctx.fillStyle = dim(c); ctx.fillRect(ox + x, oy + y, 1, 1); }
    }
  }
}

// 花長到哪個階段：今天是芽、1–2 天前是花苞、更早就開花了
export const flowerStage = (daysAgo) => (daysAgo <= 0 ? 'sprout' : daysAgo <= 2 ? 'bud' : 'bloom');

// 某一天的花：用那天最後一則有心情或情緒的紀錄
export function dayFlower(moments) {
  if (!moments.length) return null;
  const sorted = [...moments].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const pick = [...sorted].reverse().find((m) => m.emo || m.mood) || sorted[sorted.length - 1];
  return { emo: pick.emo || detectEmotion(pick.feel, pick.text, pick.mood) || 'calm', mood: pick.mood || 3 };
}
