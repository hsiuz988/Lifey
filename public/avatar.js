// 像素小人：由「身體＋頭＋頭髮＋臉＋衣服＋配件」一層層疊出來，16×20 格
// 性別只影響體型和學生制服的下半身，髮型、衣服、配件全部自由搭配

export const W = 16;
export const H = 20;

export const SKINS = ['#fbe0cc', '#f6d5bd', '#e8b48f', '#c58a62', '#8d5a3b'];
export const HAIRS = ['#2b211c', '#5a3825', '#a0522d', '#d9b36a', '#8e939a', '#c0566e', '#4a6fa5', '#7d5ba6'];
export const OUTFIT_COLORS = ['#e0607e', '#3f7fd1', '#5cc28a', '#e6b84f', '#8a6fd1', '#f2f2f2', '#2e2e36', '#e98f73'];

export const GENDERS = [['female', '女生'], ['male', '男生']];
export const HAIR_STYLES = [['short', '短髮'], ['buzz', '平頭'], ['medium', '中長'], ['long', '長直'], ['ponytail', '馬尾'], ['bun', '包頭'], ['curly', '捲髮']];
export const EYES = [['round', '圓眼'], ['big', '大眼'], ['sleepy', '瞇瞇眼']];
export const BEARDS = [['none', '無'], ['stubble', '鬍渣'], ['full', '大鬍子']];
export const OUTFITS = [['tshirt', 'T 恤'], ['shirt', '襯衫'], ['hoodie', '帽 T'], ['sport', '運動服'], ['dress', '洋裝']];

export const DEFAULT_AVATAR = {
  v: 2, gender: 'female', skin: 2, hair: 0, hairStyle: 'long', eyes: 'round', lashes: true, blush: true, freckles: false,
  beard: 'none', outfit: 'tshirt', outfitColor: 0, glasses: false, hat: false, headphones: false, hairclip: false, uniform: true,
};

// 階段 3 的舊頭像（膚色只有 4 種、欄位叫 style）轉成新格式，盡量保持原本的樣子
export function normalizeAvatar(a) {
  if (!a) return { ...DEFAULT_AVATAR };
  if (a.v === 2) return { ...DEFAULT_AVATAR, ...a };
  return {
    ...DEFAULT_AVATAR,
    v: 1, // 還沒在新的捏人畫面存過
    gender: null, lashes: false, blush: false,
    skin: (a.skin ?? 1) + 1, hair: a.hair ?? 0, hairStyle: a.style || 'short', glasses: !!a.glasses,
  };
}

export function randomAvatar() {
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const chance = (p) => Math.random() < p;
  return {
    ...DEFAULT_AVATAR,
    gender: pick(GENDERS)[0], skin: Math.floor(Math.random() * SKINS.length), hair: Math.floor(Math.random() * HAIRS.length),
    hairStyle: pick(HAIR_STYLES)[0], eyes: pick(EYES)[0], lashes: chance(0.5), blush: chance(0.6), freckles: chance(0.2),
    beard: chance(0.2) ? pick(BEARDS)[0] : 'none', outfit: pick(OUTFITS)[0], outfitColor: Math.floor(Math.random() * OUTFIT_COLORS.length),
    glasses: chance(0.3), hat: chance(0.15), headphones: chance(0.15), hairclip: chance(0.2), uniform: true,
  };
}

// ---------- 顏色工具 ----------
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---------- 組合 ----------
const UNIFORMS = {
  elementary: { top: '#f4f4f0', bottom: '#2e3a5c', collar: '#3f7fd1' },
  junior: { top: '#f4f4f0', bottom: '#2e3a5c', collar: '#2e3a5c' },
  senior: { top: '#f4f4f0', bottom: '#3d4f7a', collar: '#c0565e' },
};

function kindFor(age) {
  if (age < 3) return 'baby';
  if (age < 12) return 'child';
  return 'adult';
}

// 回傳 { grid, waist }：grid[y][x] 是顏色或 null；waist 以上的列在呼吸時會往下沉 1px
export function composeAvatar(avatar, age, stageKey, { blink = false, step = false } = {}) {
  const a = normalizeAvatar(avatar);
  const kind = kindFor(age);
  const g = Array.from({ length: H }, () => Array(W).fill(null));
  const put = (x, y, c) => { if (c && x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const row = (x1, x2, y, c) => { for (let x = x1; x <= x2; x++) put(x, y, c); };

  const skin = SKINS[a.skin] || SKINS[2];
  const skinShade = shade(skin, 0.82);
  let hair = HAIRS[a.hair] || HAIRS[0];
  if (age >= 65) hair = '#d9dbe0';
  else if (age >= 50) hair = shade(hair, 1.25);
  const hairDark = shade(hair, 0.8);

  const school = a.uniform && UNIFORMS[stageKey];
  const cloth = school ? school.top : OUTFIT_COLORS[a.outfitColor] || OUTFIT_COLORS[0];
  const clothDark = shade(cloth, 0.8);
  const pants = school ? school.bottom : '#2e3a5c';
  const shoes = '#1c1c22';
  const outfit = school ? 'uniform' : a.outfit;
  const skirt = school ? a.gender === 'female' : outfit === 'dress';
  const lower = skirt ? (school ? school.bottom : cloth) : pants;
  const narrow = a.gender === 'female';

  const hy = kind === 'adult' ? 4 : kind === 'child' ? 6 : 7; // 頭頂所在列
  const by = hy + 8; // 身體第一列

  // ---- 身體 ----
  if (kind === 'baby') {
    row(5, 10, by, cloth);
    row(4, 11, by + 1, cloth); put(4, by + 1, skin); put(11, by + 1, skin);
    row(4, 11, by + 2, cloth);
    row(5, 10, by + 3, cloth);
    row(5, 6, by + 4, skin); row(9, 10, by + 4, skin);
  } else {
    const left = kind === 'adult' ? (narrow ? 4 : 3) : 4;
    const right = W - 1 - left;
    const arms = kind === 'adult' ? 2 : 2; // 上衣列數（不含肩）
    row(left, right, by, cloth);
    if (kind === 'adult') row(left - 1, right + 1, by + 1, cloth);
    const armTop = kind === 'adult' ? by + 2 : by + 1;
    for (let y = armTop; y < armTop + arms; y++) { row(left, right, y, cloth); put(left - 1, y, skin); put(right + 1, y, skin); }
    if (kind === 'adult') { put(left - 1, by + 1, cloth); put(right + 1, by + 1, cloth); }

    // 衣服細節
    if (outfit === 'shirt' || outfit === 'uniform') { put(7, by, school ? school.collar : '#ffffff'); put(8, by, school ? school.collar : '#ffffff'); }
    if (outfit === 'shirt') for (let y = by + 1; y < armTop + arms; y++) put(8, y, clothDark);
    if (outfit === 'hoodie') { row(6, 9, by, clothDark); put(7, armTop + 1, clothDark); put(8, armTop + 1, clothDark); }
    if (outfit === 'sport') for (let y = by + 1; y < armTop + arms; y++) { put(left, y, '#ffffff'); put(right, y, '#ffffff'); }
    if (outfit === 'uniform' && stageKey === 'senior' && a.gender !== 'female') { put(7, by + 1, school.collar); put(7, by + 2, school.collar); }

    // 下半身
    const legY = armTop + arms;
    const legRows = kind === 'adult' ? 3 : 2;
    if (skirt) {
      row(4, 11, legY, lower);
      row(3, 12, legY + 1, lower);
      for (let y = legY + 2; y < legY + legRows; y++) { row(5, 6, y, skin); row(9, 10, y, skin); }
      if (legRows === 2) { /* 小孩裙子比較短 */ }
    } else {
      row(4, 11, legY, lower);
      for (let y = legY + 1; y < legY + legRows; y++) { row(4, 6, y, lower); row(9, 11, y, lower); }
    }
    const footY = legY + legRows;
    const lx = skirt ? [5, 6] : [4, 6];
    const rx = skirt ? [9, 10] : [9, 11];
    if (step) { row(lx[0], lx[1], footY - 1, shoes); row(lx[0], lx[1], footY, null); } // 抬左腳
    else row(lx[0], lx[1], footY, shoes);
    row(rx[0], rx[1], footY, shoes);
    if (step) for (let x = lx[0]; x <= lx[1]; x++) g[footY][x] = null;

    if (age >= 75) { for (let y = by + 2; y <= footY; y++) put(13, y, '#8b5a2b'); put(12, by + 2, '#8b5a2b'); } // 拐杖
  }

  // ---- 頭（含脖子）----
  row(5, 10, hy, skin);
  for (let y = hy + 1; y <= hy + 5; y++) row(4, 11, y, skin);
  row(5, 10, hy + 6, skin);
  row(7, 8, hy + 7, skin);

  // ---- 臉 ----
  const eyeY = hy + 3;
  const eye = blink ? skinShade : '#1b1b22';
  if (a.eyes === 'sleepy') { row(5, 6, eyeY, eye); row(9, 10, eyeY, eye); }
  else if (a.eyes === 'big' && !blink) { put(6, eyeY - 1, eye); put(6, eyeY, eye); put(9, eyeY - 1, eye); put(9, eyeY, eye); }
  else { put(6, eyeY, eye); put(9, eyeY, eye); }
  if (a.lashes && kind !== 'baby' && !blink) { put(5, eyeY - 1, '#1b1b22'); put(10, eyeY - 1, '#1b1b22'); }
  if (a.blush) { put(5, hy + 4, '#f29b9b'); put(10, hy + 4, '#f29b9b'); }
  if (a.freckles) { put(6, hy + 4, shade(skin, 0.7)); put(9, hy + 4, shade(skin, 0.7)); }
  row(7, 8, hy + 5, '#c0565e');
  if (kind === 'adult' && age >= 18) {
    if (a.beard === 'stubble') row(6, 9, hy + 6, shade(hairDark, 1.1));
    if (a.beard === 'full') { put(5, hy + 5, hairDark); put(6, hy + 5, hairDark); put(9, hy + 5, hairDark); put(10, hy + 5, hairDark); row(5, 10, hy + 6, hairDark); row(7, 8, hy + 7, hairDark); }
  }

  // ---- 頭髮 ----
  if (kind === 'baby') {
    row(7, 8, hy - 1, hair); put(8, hy - 2, hair);
  } else {
    const style = a.hairStyle;
    const cap = () => {
      row(5, 10, hy - 1, hair);
      row(4, 11, hy, hair);
      row(4, 6, hy + 1, hair); row(9, 11, hy + 1, hair); // 中分瀏海
      put(4, hy + 2, hair); put(11, hy + 2, hair);
    };
    if (style === 'buzz') {
      row(5, 10, hy, hairDark); put(4, hy + 1, hairDark); put(11, hy + 1, hairDark);
    } else if (style === 'curly') {
      for (let x = 4; x <= 11; x += 2) put(x, hy - 1, hair);
      row(3, 12, hy, hair); row(3, 5, hy + 1, hair); row(10, 12, hy + 1, hair);
      for (let y = hy + 2; y <= hy + 4; y++) { put(3, y, hair); put(12, y, hair); }
      put(3, hy + 5, hairDark); put(12, hy + 5, hairDark);
    } else {
      cap();
      if (style === 'medium') {
        for (let y = hy + 1; y <= hy + 5; y++) { put(3, y, hair); put(12, y, hair); }
        put(4, hy + 3, hair); put(11, hy + 3, hair);
      }
      if (style === 'long') {
        const end = Math.min(H - 1, hy + (kind === 'adult' ? 10 : 9));
        for (let y = hy + 1; y <= end; y++) { put(3, y, y > hy + 6 ? hairDark : hair); put(12, y, y > hy + 6 ? hairDark : hair); }
        for (let y = hy + 2; y <= hy + 4; y++) { put(4, y, hair); put(11, y, hair); }
      }
      if (style === 'ponytail') {
        for (let y = hy + 1; y <= hy + 6; y++) put(12, y, y > hy + 3 ? hairDark : hair);
        for (let y = hy + 2; y <= hy + 5; y++) put(13, y, hairDark);
        put(12, hy + 1, '#e0607e');
      }
      if (style === 'bun') { row(7, 8, hy - 3, hair); row(6, 9, hy - 2, hair); }
    }
  }

  // ---- 配件 ----
  if (a.glasses && kind !== 'baby') {
    const gy = eyeY;
    // 淺色鏡框夾在眼睛兩側，眼睛才看得到（深色會變成墨鏡）
    [5, 7, 8, 10].forEach((x) => put(x, gy, '#aeb6c4'));
    const topY = a.eyes === 'big' ? gy - 2 : gy - 1;
    put(6, topY, '#aeb6c4'); put(9, topY, '#aeb6c4');
  }
  if (a.hat && kind !== 'baby') {
    row(5, 10, hy - 2, '#e0607e'); row(4, 11, hy - 1, '#e0607e'); row(4, 11, hy, '#e0607e');
    row(2, 6, hy + 1, '#c94f6c');
  }
  if (a.headphones && kind !== 'baby') {
    row(5, 10, hy - 2, '#3a3f4b'); put(4, hy - 1, '#3a3f4b'); put(11, hy - 1, '#3a3f4b');
    for (let y = hy; y <= hy + 1; y++) { put(3, y, '#3a3f4b'); put(12, y, '#3a3f4b'); }
    for (let y = hy + 2; y <= hy + 3; y++) { put(3, y, '#e6b84f'); put(12, y, '#e6b84f'); }
  }
  if (a.hairclip && kind !== 'baby') { put(10, hy, '#ffd36b'); put(11, hy + 1, '#ffd36b'); }

  return { grid: g, waist: by + (kind === 'adult' ? 4 : kind === 'child' ? 3 : 2) };
}

// 畫到 canvas（ctx 已經縮放成 1 格 = 1 單位）
export function drawAvatar(ctx, sprite, x, y, { flip = false, breathe = false } = {}) {
  const { grid, waist } = sprite;
  for (let gy = 0; gy < H; gy++) {
    const dy = breathe && gy < waist ? 1 : 0;
    for (let gx = 0; gx < W; gx++) {
      const c = grid[gy][gx];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + (flip ? W - 1 - gx : gx), y + gy + dy, 1, 1);
    }
  }
}

// 靜態圖（身分卡、另一半的頭像）
export function avatarSvg(avatar, age, stageKey) {
  const { grid } = composeAvatar(avatar, age, stageKey);
  let rects = '';
  grid.forEach((r, y) => r.forEach((c, x) => { if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`; }));
  return `<svg viewBox="0 -2 ${W} ${H + 2}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${rects}</svg>`;
}
