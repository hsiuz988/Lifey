// 寵物像素圖：6 種 × 4 色，每種 2 格動畫（搖尾巴、跳一下）
// x 身體、d 深色（耳朵、斑點）、e 眼睛、n 鼻子／嘴、w 白色、t 尾巴、o 橘色（鳥腳、嘴）

export const PET_TYPES = [['dog', '狗'], ['cat', '貓'], ['rabbit', '兔子'], ['bird', '鳥'], ['hamster', '倉鼠'], ['fish', '魚']];
export const PET_ICONS = { dog: '🐶', cat: '🐱', rabbit: '🐰', bird: '🐦', hamster: '🐹', fish: '🐟' };

export const PET_COLORS = {
  dog: [['#c98a4b', '#8b5a2b'], ['#f2f2f2', '#c9c4bc'], ['#3a3a40', '#1e1e24'], ['#e6c27a', '#b8914a']],
  cat: [['#e8954a', '#b8682a'], ['#9aa0aa', '#6e747e'], ['#33333a', '#1c1c22'], ['#f4f4f0', '#d0cdc4']],
  rabbit: [['#f4f4f0', '#d8c8c8'], ['#a8774f', '#7a5232'], ['#9aa0aa', '#6e747e'], ['#3a3a40', '#22222a']],
  bird: [['#ffd36b', '#e0a93a'], ['#6fb6e3', '#3f86b8'], ['#7fc96a', '#4f9a3c'], ['#f4f4f0', '#c9c9c9']],
  hamster: [['#e6b07a', '#b8834a'], ['#f4f4f0', '#d8c8b8'], ['#9aa0aa', '#6e747e'], ['#e8c46a', '#b8943a']],
  fish: [['#f08a3a', '#ffffff'], ['#e0473a', '#ffd36b'], ['#4a8fd8', '#ffd36b'], ['#ffd36b', '#e0473a']],
};

// 面向右邊；[frame0, frame1]
const SPRITES = {
  dog: [
    ['.......dd.', '......xxxx', 't.....xexn', '.txxxxxxx.', '..xxxxxxx.', '..x.x..x.x'],
    ['t......dd.', '.t....xxxx', '......xexn', '.txxxxxxx.', '..xxxxxxx.', '..x.x..x.x'],
  ],
  cat: [
    ['t.....d.d.', 't.....xxx.', '.t....exe.', '..xxxxxxx.', '..xxxxxxx.', '..x.x.x.x.'],
    ['.t....d.d.', '..t...xxx.', '..t...exe.', '..xxxxxxx.', '..xxxxxxx.', '..x.x.x.x.'],
  ],
  rabbit: [
    ['.......d.d', '.......d.d', '......xxxx', '......xexn', '.wxxxxxxx.', '..xxxxxxx.', '..x....x..'],
    ['..........', '.......d.d', '.......d.d', '......xxxx', '.wxxxxxexn', '..xxxxxxx.', '...x...x..'],
  ],
  bird: [
    ['..xx..', '.xxexo', 'dxxxx.', '.xxx..', '..o.o.'],
    ['..xx..', 'dxxexo', '.dxxx.', '.xxx..', '..o.o.'],
  ],
  hamster: [
    ['..d.d..', '.xxxxx.', 'xwexxwx', 'xxxxxnx', '.x...x.'],
    ['..d.d..', '.xxxxx.', 'xwexxwx', 'xxxxxnx', '..x.x..'],
  ],
};

export const petSize = (type) => (type === 'fish' ? [8, 7] : [SPRITES[type][0][0].length, SPRITES[type][0].length]);

// 畫到 canvas：x, y 是左上角，ctx 已縮放成 1 格 = 1 單位
export function drawPet(ctx, type, colorIdx, x, y, frame = 0, flip = false) {
  const [main, dark] = (PET_COLORS[type] || PET_COLORS.dog)[colorIdx] || PET_COLORS[type][0];
  const px = (dx, dy, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, 1, 1); };

  if (type === 'fish') {
    // 魚缸：玻璃、水、游來游去的小魚
    ctx.fillStyle = 'rgba(200,230,250,0.55)';
    ctx.fillRect(x + 1, y, 6, 1);
    ctx.fillStyle = 'rgba(111,182,227,0.55)';
    ctx.fillRect(x, y + 2, 8, 4); ctx.fillRect(x + 1, y + 6, 6, 1);
    ctx.fillStyle = 'rgba(200,230,250,0.8)';
    ctx.fillRect(x, y + 1, 1, 5); ctx.fillRect(x + 7, y + 1, 1, 5);
    const fx = frame ? 4 : 2;
    const face = frame ? -1 : 1;
    px(fx, 3, main); px(fx + 1, 3, main); px(fx - face, 3, dark); px(fx + (face > 0 ? 1 : 0), 4, main);
    px(fx + (face > 0 ? 1 : 0), 3, '#1b1b22');
    return;
  }

  const rows = SPRITES[type][frame % 2];
  const w = rows[0].length;
  const colors = { x: main, d: dark, t: main, e: '#1b1b22', n: type === 'cat' || type === 'hamster' ? '#e88a9a' : '#1b1b22', w: '#ffffff', o: '#f0a03a' };
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < w; dx++) {
      const c = colors[row[dx]];
      if (c) px(flip ? w - 1 - dx : dx, dy, c);
    }
  });
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
