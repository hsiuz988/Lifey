// 寵物像素圖：6 種，正面坐姿、大眼睛加反光點，每種有幾款毛色；第 2 格是輕輕跳一下（走路、搖尾巴時交替）
// 字母代表部位，顏色由毛色決定：
// x 主色、d 深色（耳朵、花紋、魚鰭）、w 白色部位（嘴邊、肚子）、e 眼睛、l 眼睛反光、k 腮紅／耳朵內側、n 鼻子、o 橘色（鳥嘴、鳥腳）

export const PET_TYPES = [['dog', '狗'], ['cat', '貓'], ['rabbit', '兔子'], ['bird', '鳥'], ['hamster', '倉鼠'], ['fish', '魚']];
export const PET_ICONS = { dog: '🐶', cat: '🐱', rabbit: '🐰', bird: '🐦', hamster: '🐹', fish: '🐟' };

const OUTLINE = '#2a2230';

// 毛色：前四款保留原本的順序（舊資料的編號不會跑掉），新的加在後面
export const PET_COLORS = {
  dog: [
    { label: '黃狗', x: '#c98a4b', d: '#8b5a2b', w: '#ead2b4' },
    { label: '白狗', x: '#f2f0ea', d: '#c9c4bc' },
    { label: '黑狗', x: '#4b4b57', d: '#34343e', w: '#6e6e7a' },
    { label: '黃金獵犬', x: '#e6c27a', d: '#b8914a' },
    { label: '柴犬', x: '#d9863a', d: '#a85f22', w: '#fbefe0', b: '#fbefe0' },
    { label: '黑白狗', x: '#4b4b57', d: '#34343e', w: '#f4f2ee', b: '#f4f2ee' },
  ],
  cat: [
    { label: '橘貓', x: '#e8954a', d: '#c06a2a', s: '#c06a2a', w: '#f6c48e' },
    { label: '灰虎斑', x: '#9aa0aa', d: '#6e747e', s: '#6e747e', w: '#d8dbe0' },
    { label: '黑貓', x: '#4b4b57', d: '#34343e', w: '#5c5c68' },
    { label: '白貓', x: '#f4f4f0', d: '#f0b8c0', w: '#ffffff' },
    { label: '橘白貓', x: '#ea9a4e', d: '#c46e2c', s: '#c46e2c', w: '#fbf6ef', b: '#fbf6ef' },
    { label: '賓士貓', x: '#4b4b57', d: '#34343e', w: '#f4f2ee', b: '#f4f2ee' },
  ],
  rabbit: [
    { label: '白兔', x: '#f4f4f0', d: '#f0b8c0', w: '#ffffff' },
    { label: '棕兔', x: '#a8774f', d: '#7a5232', w: '#f4f0e8' },
    { label: '灰兔', x: '#9aa0aa', d: '#6e747e', w: '#e4e6ea' },
    { label: '黑兔', x: '#4b4b57', d: '#34343e', w: '#f4f0e8' },
  ],
  bird: [
    { label: '黃色', x: '#ffd36b', d: '#e0a93a' },
    { label: '藍色', x: '#6fb6e3', d: '#3f86b8', w: '#f4f4f0' },
    { label: '綠色', x: '#7fc96a', d: '#4f9a3c', w: '#ffe27a' },
    { label: '白色', x: '#f4f4f0', d: '#c9c9c9' },
  ],
  hamster: [
    { label: '奶茶', x: '#e6b07a', d: '#b8834a', w: '#fbf1e4' },
    { label: '白色', x: '#f4f4f0', d: '#d8c8b8', w: '#ffffff' },
    { label: '灰色', x: '#9aa0aa', d: '#6e747e', w: '#eceef0' },
    { label: '金黃', x: '#e8c46a', d: '#b8943a', w: '#fbf1d8' },
  ],
  fish: [
    { label: '橘色', x: '#f08a3a', d: '#ffb27a' },
    { label: '紅色', x: '#e0473a', d: '#ff9a8a' },
    { label: '藍色', x: '#4a8fd8', d: '#9cc8f2' },
    { label: '金色', x: '#ffd36b', d: '#ffeaa8' },
  ],
};

// 正面坐姿（魚是側面）
const SPRITES = {
  dog: [
    '...xxxxxxx...',
    '.ddxxxxxxxdd.',
    'dddxxxxxxxddd',
    'dddxelxxelddd',
    'dddxeexxeeddd',
    '.ddkwwnwwkdd.',
    '...xwwwwwx...',
    '....xxxxx....',
    '...xxwwwxx...',
    '..xxxwwwxxx.d',
    '..xxxwwwxxxd.',
    '..wwx...xww..',
  ],
  cat: [
    '.d.......d..',
    '.dd.....dd..',
    '.xkxxxxxkx..',
    '.xxdxdxdxx..',
    'xxelxxxelxx.',
    'xxeexxxeexx.',
    'xkwwwnwwwkx.',
    '.xwwwwwwwx..',
    '..xwwwwwx...',
    '.xxwwwwwxx.d',
    '.xxwwwwwxxd.',
    '.ww.....ww..',
  ],
  rabbit: [
    '..xx...xx..',
    '..xk...kx..',
    '..xk...kx..',
    '..xk...kx..',
    '..xxxxxxx..',
    '.xxxxxxxxx.',
    'xxelxxxelxx',
    'xxeexxxeexx',
    'xkxxwnwxxkx',
    '.xxxwwwxxx.',
    '.xxwwwwwxx.',
    'xxxwwwwwxxx',
    '.www...www.',
  ],
  fish: [
    '.....dd.......',
    '....dxxx...dd.',
    '..xxxxxxx.ddd.',
    '.xwlxxxxxxddd.',
    'xxweexxxxxdd..',
    'xxxxxxdxxxddd.',
    '.xxxxxxxxx.ddd',
    '..xxxxxxx...dd',
    '....dd........',
  ],
  bird: [
    '...xxxx...',
    '..xxxxxx..',
    '.xxxelxxx.',
    '.xxxeexxoo',
    '.dkxxxxxo.',
    'ddxwwwwx..',
    'dddwwwwx..',
    '.ddxwwx...',
    '...o..o...',
  ],
  hamster: [
    '.kd.....dk.',
    '.dd.....dd.',
    '.xxxxxxxxx.',
    'xxelxxxelxx',
    'xxeexxxeexx',
    'xkxwwnwwxkx',
    'xxwwwwwwwxx',
    '.xwwwwwwwx.',
    '..ww...ww..',
  ],
};

// 場景用的縮小版：一樣的畫法，高度大約是小人的六成，寵物一定比人小
const MINI = {
  dog: [
    '...xxxxxxx...',
    '.ddxxxxxxxdd.',
    'dddxelxxelddd',
    'dddxeexxeeddd',
    '.ddkwwnwwkdd.',
    '...xwwwwwx...',
    '..xxxwwwxxx.d',
    '..xxxwwwxxxd.',
    '..wwx...xww..',
  ],
  cat: [
    '.d.....d..',
    '.dd...dd..',
    '.xxdxdxx..',
    'xelxxxelx.',
    'xeexxxeex.',
    'xkwwnwwkx.',
    '.xwwwwwx.d',
    '.xwwwwwxd.',
    '.ww...ww..',
  ],
  rabbit: [
    '..xx...xx..',
    '..xk...kx..',
    '..xk...kx..',
    '.xxxxxxxxx.',
    'xxelxxxelxx',
    'xxeexxxeexx',
    'xkxxwnwxxkx',
    '.xxwwwwwxx.',
    'xxxwwwwwxxx',
    '.www...www.',
  ],
  fish: [
    '...dd......',
    '..xxxxx..d.',
    '.xelxxxx.dd',
    'xxeexxxxxdd',
    '.xxxxxxx.dd',
    '..xxxxx..d.',
    '...dd......',
  ],
  bird: [
    '..xxx...',
    '.xxelxoo',
    '.xxeexo.',
    'dkxxxx..',
    'ddwwwx..',
    '.dwwx...',
    '..o.o...',
  ],
  hamster: [
    '.d.....d.',
    '.xxxxxxx.',
    'xelxxxelx',
    'xeexxxeex',
    'xkwwnwwkx',
    '.xwwwwwx.',
    '..w...w..',
  ],
};

// 尺寸含描邊；第 2 格跳起來 1 格，所以高度多留 1 格
export const petSize = (type) => [(MINI[type] || MINI.dog)[0].length + 2, (MINI[type] || MINI.dog).length + 3];

// 深色毛的眼睛改成琥珀色，才看得到
const isDark = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 110; };

function palette(type, idx) {
  const list = PET_COLORS[type] || PET_COLORS.dog;
  const c = list[idx] || list[0];
  return {
    x: c.x, d: c.d, w: c.w || c.x,
    e: isDark(c.x) ? '#f4c45a' : '#2a2230', l: '#ffffff',
    k: type === 'rabbit' ? '#f2a6b6' : '#f4a8b4', n: '#e88a9a', o: '#f2a446',
  };
}

// 寵物的格子（含描邊），快取起來，每一種只算一次
const cache = new Map();
function petGrid(type, idx, small = false) {
  const key = `${type}:${idx}:${small ? 's' : 'b'}`;
  if (cache.has(key)) return cache.get(key);
  const set = small ? MINI : SPRITES;
  const rows = set[type] || set.dog;
  const w = rows[0].length + 2;
  const h = rows.length + 2;
  const colors = palette(type, idx);
  const g = Array.from({ length: h }, () => Array(w).fill(null));
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (colors[row[x]]) g[y + 1][x + 1] = colors[row[x]]; });
  const out = g.map((r) => r.slice());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx])) out[y][x] = OUTLINE;
    }
  }
  cache.set(key, out);
  return out;
}

function paint(ctx, g, x, y, flip) {
  const w = g[0].length;
  g.forEach((row, dy) => row.forEach((c, dx) => {
    if (!c) return;
    ctx.fillStyle = c;
    ctx.fillRect(x + (flip ? w - 1 - dx : dx), y + dy, 1, 1);
  }));
}

// 魚缸（場景用）：寬 17、高 13，魚在裡面左右游
export const BOWL = [17, 13];
function drawBowl(ctx, colorIdx, x, y, frame) {
  const R = (rx, ry, rw, rh, c) => { ctx.fillStyle = c; ctx.fillRect(x + rx, y + ry, rw, rh); };
  // 圓圓的玻璃缸：描邊、水、缸口
  const rows = [[3, 11], [1, 15], [0, 17], [0, 17], [0, 17], [0, 17], [0, 17], [0, 17], [1, 15], [1, 15], [2, 13], [3, 11]];
  rows.forEach(([ox, w], i) => { R(ox, i + 1, w, 1, OUTLINE); if (w > 2) R(ox + 1, i + 1, w - 2, 1, i < 2 ? '#eaf6fb' : '#bfe3f2'); });
  R(3, 0, 11, 1, OUTLINE);
  R(2, 4, 1, 3, '#ffffff'); // 玻璃反光
  R(3, 11, 11, 1, '#e8d9b8'); // 缸底的沙
  paint(ctx, petGrid('fish', colorIdx, true), x + (frame ? 3 : 1), y + 2, !!frame);
}

// 畫到場景（縮小版）：x, y 是左上角（含描邊），ctx 已縮放成 1 格 = 1 單位
// 第 2 格會往上跳 1 格；魚加上 { bowl: true } 就畫在魚缸裡
export function drawPet(ctx, type, colorIdx, x, y, frame = 0, flip = false, { bowl = false } = {}) {
  if (type === 'fish' && bowl) { drawBowl(ctx, colorIdx, x, y, frame); return; }
  paint(ctx, petGrid(type, colorIdx, true), x, y + (frame ? 0 : 1), flip);
}

// 靜態小圖（人物清單、人物卡）：用細節比較多的大版本
export function petSvg(type, colorIdx) {
  const g = petGrid(type, colorIdx);
  const w = g[0].length;
  const h = g.length;
  let rects = '';
  g.forEach((row, y) => row.forEach((c, x) => { if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`; }));
  const size = Math.max(w, h) + 2;
  return `<svg viewBox="${-(size - w) / 2} ${-(size - h) / 2} ${size} ${size}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${rects}</svg>`;
}

// 毛色按鈕：雙色的用斜切顯示（例如橘白）
export const petSwatchStyle = (type, idx) => {
  const c = (PET_COLORS[type] || [])[idx];
  if (!c) return '';
  const second = c.b || (c.w && c.w !== c.x ? c.w : null);
  return second ? `--c:linear-gradient(135deg, ${c.x} 55%, ${second} 55%)` : `--c:${c.x}`;
};
