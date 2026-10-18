// 寵物像素圖：6 種，每種有幾款毛色（含花紋），每種 2 格動畫（搖尾巴、跳一下）
// 字母代表部位，顏色由毛色決定：
// x 主色、d 深色（耳朵）、s 斑紋、w 白色部位（嘴邊、胸口）、b 腳掌、t 尾巴、e 眼睛、n 鼻子、o 橘色（鳥腳、嘴）

export const PET_TYPES = [['dog', '狗'], ['cat', '貓'], ['rabbit', '兔子'], ['bird', '鳥'], ['hamster', '倉鼠'], ['fish', '魚']];
export const PET_ICONS = { dog: '🐶', cat: '🐱', rabbit: '🐰', bird: '🐦', hamster: '🐹', fish: '🐟' };

const OUTLINE = '#2a2230';

// 毛色：前四款保留原本的順序（舊資料的編號不會跑掉），新的加在後面
export const PET_COLORS = {
  dog: [
    { label: '黃狗', x: '#c98a4b', d: '#8b5a2b', w: '#ead2b4' },
    { label: '白狗', x: '#f2f0ea', d: '#c9c4bc' },
    { label: '黑狗', x: '#3a3a40', d: '#1e1e24', w: '#6a6a74' },
    { label: '黃金獵犬', x: '#e6c27a', d: '#b8914a' },
    { label: '柴犬', x: '#d9863a', d: '#a85f22', w: '#fbefe0', b: '#fbefe0' },
    { label: '黑白狗', x: '#33333a', d: '#1e1e24', w: '#f4f2ee', b: '#f4f2ee' },
  ],
  cat: [
    { label: '橘貓', x: '#e8954a', d: '#c06a2a', s: '#c06a2a', w: '#f6c48e' },
    { label: '灰虎斑', x: '#9aa0aa', d: '#6e747e', s: '#6e747e', w: '#d8dbe0' },
    { label: '黑貓', x: '#33333a', d: '#1c1c22', w: '#44444c' },
    { label: '白貓', x: '#f4f4f0', d: '#f0b8c0', w: '#ffffff' },
    { label: '橘白貓', x: '#ea9a4e', d: '#c46e2c', s: '#c46e2c', w: '#fbf6ef', b: '#fbf6ef' },
    { label: '賓士貓', x: '#2e2e36', d: '#1c1c22', w: '#f4f2ee', b: '#f4f2ee' },
  ],
  rabbit: [
    { label: '白兔', x: '#f4f4f0', d: '#f0b8c0', w: '#ffffff' },
    { label: '棕兔', x: '#a8774f', d: '#7a5232', w: '#f4f0e8' },
    { label: '灰兔', x: '#9aa0aa', d: '#6e747e', w: '#e4e6ea' },
    { label: '黑兔', x: '#3a3a40', d: '#22222a', w: '#f4f0e8' },
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
    { label: '橘色', x: '#f08a3a', d: '#ffffff' },
    { label: '紅色', x: '#e0473a', d: '#ffd36b' },
    { label: '藍色', x: '#4a8fd8', d: '#ffd36b' },
    { label: '金色', x: '#ffd36b', d: '#e0473a' },
  ],
};

// 面向右邊；[frame0, frame1]
const SPRITES = {
  dog: [
    ['........dd..', '.......xxxx.', 't......xexwn', '.txxxxxxxw..', '..xxxxxxxx..', '..xb.xb.xb.b'],
    ['t.......dd..', '.t.....xxxx.', '.......xexwn', '.txxxxxxxw..', '..xxxxxxxx..', '..bx.bx.bx.b'],
  ],
  // 貓：大一點的頭，白色嘴邊與胸口、背上虎斑
  cat: [
    ['.......d...d', 't......xxxxx', 't......xexex', '.t..xxxxwnwx', '..xsxsxsxww.', '..xxxxxxxww.', '..b.b..b.b..'],
    ['.......d...d', '.t.....xxxxx', '..t....xexex', '..t.xxxxwnwx', '..xsxsxsxww.', '..xxxxxxxww.', '...b.b..b.b.'],
  ],
  rabbit: [
    ['.......d.d', '.......d.d', '......xxxx', '......xexn', '.wxxxxxxw.', '..xxxxxxw.', '..b....b..'],
    ['..........', '.......d.d', '.......d.d', '......xxxx', '.wxxxxxexn', '..xxxxxxw.', '...b...b..'],
  ],
  bird: [
    ['..xx..', '.xxexo', 'dxxwx.', '.xxx..', '..o.o.'],
    ['..xx..', 'dxxexo', '.dxwx.', '.xxx..', '..o.o.'],
  ],
  hamster: [
    ['..d.d..', '.xxxxx.', 'xwexxwx', 'xxxxwnx', '.b...b.'],
    ['..d.d..', '.xxxxx.', 'xwexxwx', 'xxxxwnx', '..b.b..'],
  ],
};

// 尺寸含描邊
export const petSize = (type) => (type === 'fish' ? [8, 7] : [SPRITES[type][0][0].length + 2, SPRITES[type][0].length + 2]);

function palette(type, idx) {
  const list = PET_COLORS[type] || PET_COLORS.dog;
  const c = list[idx] || list[0];
  return {
    x: c.x, t: c.x, d: c.d, s: c.s || c.x, w: c.w || c.x, b: c.b || c.x,
    e: '#2a2230', n: type === 'cat' || type === 'hamster' || type === 'rabbit' ? '#e88a9a' : '#2a2230', o: '#f0a03a',
  };
}

// 寵物的格子（含描邊），快取起來，每一格只算一次
const cache = new Map();
function petGrid(type, idx, frame) {
  const key = `${type}:${idx}:${frame}`;
  if (cache.has(key)) return cache.get(key);
  const rows = SPRITES[type][frame % 2];
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

// 畫到 canvas：x, y 是左上角（含描邊），ctx 已縮放成 1 格 = 1 單位
export function drawPet(ctx, type, colorIdx, x, y, frame = 0, flip = false) {
  if (type === 'fish') {
    const c = palette('fish', colorIdx);
    const px = (dx, dy, color) => { ctx.fillStyle = color; ctx.fillRect(x + dx, y + dy, 1, 1); };
    // 魚缸：描邊、玻璃、水、游來游去的小魚
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x, y + 1, 1, 5); ctx.fillRect(x + 7, y + 1, 1, 5); ctx.fillRect(x + 1, y + 6, 6, 1); ctx.fillRect(x + 1, y, 6, 1);
    ctx.fillStyle = 'rgba(200,230,250,0.85)';
    ctx.fillRect(x + 1, y + 1, 6, 1);
    ctx.fillStyle = '#6fb6e3';
    ctx.fillRect(x + 1, y + 2, 6, 4);
    px(1, 2, '#a8d8f2');
    const fx = frame ? 4 : 2;
    const face = frame ? -1 : 1;
    px(fx, 3, c.x); px(fx + 1, 3, c.x); px(fx - face, 3, c.d); px(fx + (face > 0 ? 1 : 0), 4, c.x);
    px(fx + (face > 0 ? 1 : 0), 3, '#2a2230');
    return;
  }
  const g = petGrid(type, colorIdx, frame);
  const w = g[0].length;
  g.forEach((row, dy) => row.forEach((c, dx) => {
    if (!c) return;
    ctx.fillStyle = c;
    ctx.fillRect(x + (flip ? w - 1 - dx : dx), y + dy, 1, 1);
  }));
}

// 靜態小圖（人物清單、人物卡）
export function petSvg(type, colorIdx) {
  const [w, h] = petSize(type);
  const rects = [];
  const fake = { fillStyle: '', fillRect(x, y, rw, rh) { rects.push(`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${this.fillStyle}"/>`); } };
  drawPet(fake, type, colorIdx, 0, 0, 0, false);
  const size = Math.max(w, h) + 2;
  return `<svg viewBox="${-(size - w) / 2} ${-(size - h) / 2} ${size} ${size}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${rects.join('')}</svg>`;
}

// 毛色按鈕：雙色的用斜切顯示（例如橘白）
export const petSwatchStyle = (type, idx) => {
  const c = (PET_COLORS[type] || [])[idx];
  if (!c) return '';
  const second = c.b || (c.w && c.w !== c.x ? c.w : null);
  return second ? `--c:linear-gradient(135deg, ${c.x} 55%, ${second} 55%)` : `--c:${c.x}`;
};
