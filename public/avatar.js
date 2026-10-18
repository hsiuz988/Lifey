// 像素小人：由「身體＋頭＋頭髮＋臉＋衣服＋配件」一層層疊出來，16×21 格（最後一列是腳底的描邊）
// 性別只影響體型和學生制服的下半身，髮型、衣服、配件全部自由搭配

export const W = 16;
export const H = 21;

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

export const OUTLINE = '#2a2230';

function kindFor(age) {
  if (age < 3) return 'baby';
  if (age < 12) return 'child';
  return 'adult';
}

// 回傳 { grid, waist }：grid[y][x] 是顏色或 null；waist 以上的列在呼吸時會往下沉 1px
// 畫法：先把每一格標上材質（皮膚、頭髮、衣服…），再依材質上明暗（光從左上來），最後在外圍描一圈深色邊
export function composeAvatar(avatar, age, stageKey, { blink = false, step = false } = {}) {
  const a = normalizeAvatar(avatar);
  const kind = kindFor(age);
  const g = Array.from({ length: H }, () => Array(W).fill(null)); // 顏色
  const mat = Array.from({ length: H }, () => Array(W).fill(null)); // 材質
  const put = (x, y, c, m = 'other') => { if (c && x >= 0 && x < W && y >= 0 && y < H) { g[y][x] = c; mat[y][x] = m; } };
  const row = (x1, x2, y, c, m) => { for (let x = x1; x <= x2; x++) put(x, y, c, m); };
  const clear = (x, y) => { if (x >= 0 && x < W && y >= 0 && y < H) { g[y][x] = null; mat[y][x] = null; } };

  const skin = SKINS[a.skin] || SKINS[2];
  const skinShade = shade(skin, 0.84);
  let hair = HAIRS[a.hair] || HAIRS[0];
  if (age >= 65) hair = '#dfe1e6';
  else if (age >= 50) hair = shade(hair, 1.25);
  const hairDark = shade(hair, 0.78);

  const school = a.uniform && UNIFORMS[stageKey];
  const cloth = school ? school.top : OUTFIT_COLORS[a.outfitColor] || OUTFIT_COLORS[0];
  const pants = school ? school.bottom : '#3a4668';
  const shoes = '#2a2a32';
  const outfit = school ? 'uniform' : a.outfit;
  const skirt = school ? a.gender === 'female' : outfit === 'dress';
  const lower = skirt ? (school ? school.bottom : cloth) : pants;
  const lowerMat = skirt && !school ? 'cloth' : 'pants';
  const narrow = a.gender === 'female';

  const hy = kind === 'adult' ? 4 : kind === 'child' ? 6 : 7; // 頭頂所在列
  const by = hy + 8; // 身體第一列
  const FOOT = 19; // 腳底；第 20 列留給描邊

  // ---- 身體 ----
  if (kind === 'baby') {
    row(5, 10, by, cloth, 'cloth');
    row(4, 11, by + 1, cloth, 'cloth'); put(4, by + 1, skin, 'skin'); put(11, by + 1, skin, 'skin');
    row(4, 11, by + 2, cloth, 'cloth');
    row(5, 10, by + 3, cloth, 'cloth');
    row(5, 6, by + 4, skin, 'skin'); row(9, 10, by + 4, skin, 'skin');
  } else {
    const left = kind === 'adult' ? (narrow ? 4 : 3) : 4;
    const right = W - 1 - left;
    row(left, right, by, cloth, 'cloth');
    if (kind === 'adult') row(left - 1, right + 1, by + 1, cloth, 'cloth');
    const armTop = kind === 'adult' ? by + 2 : by + 1;
    for (let y = armTop; y < armTop + 2; y++) { row(left, right, y, cloth, 'cloth'); put(left - 1, y, skin, 'skin'); put(right + 1, y, skin, 'skin'); }

    // 衣服細節
    const accent = school ? school.collar : '#ffffff';
    if (outfit === 'shirt' || outfit === 'uniform') { put(7, by, accent, 'trim'); put(8, by, accent, 'trim'); }
    if (outfit === 'shirt') for (let y = by + 1; y < armTop + 2; y++) put(8, y, shade(cloth, 0.8), 'trim');
    if (outfit === 'hoodie') { row(6, 9, by, shade(cloth, 0.78), 'trim'); put(7, armTop + 1, shade(cloth, 0.78), 'trim'); put(8, armTop + 1, shade(cloth, 0.78), 'trim'); }
    if (outfit === 'sport') for (let y = by + 1; y < armTop + 2; y++) { put(left, y, '#ffffff', 'trim'); put(right, y, '#ffffff', 'trim'); }
    if (outfit === 'uniform' && stageKey === 'senior' && a.gender !== 'female') { put(7, by + 1, school.collar, 'trim'); put(7, by + 2, school.collar, 'trim'); }

    // 下半身
    const legY = armTop + 2;
    if (skirt) {
      row(4, 11, legY, lower, lowerMat);
      row(3, 12, legY + 1, lower, lowerMat);
      for (let y = legY + 2; y < FOOT; y++) { row(5, 6, y, skin, 'skin'); row(9, 10, y, skin, 'skin'); }
    } else {
      row(4, 11, legY, lower, lowerMat);
      for (let y = legY + 1; y < FOOT; y++) { row(4, 6, y, lower, lowerMat); row(9, 11, y, lower, lowerMat); }
    }
    const lx = skirt ? [5, 6] : [4, 6];
    const rx = skirt ? [9, 10] : [9, 11];
    row(rx[0], rx[1], FOOT, shoes, 'shoe');
    if (step) { for (let x = lx[0]; x <= lx[1]; x++) clear(x, FOOT); row(lx[0], lx[1], FOOT - 1, shoes, 'shoe'); } // 抬左腳
    else row(lx[0], lx[1], FOOT, shoes, 'shoe');

    if (age >= 75) { for (let y = by + 2; y <= FOOT; y++) put(13, y, '#8b5a2b', 'cane'); put(12, by + 2, '#8b5a2b', 'cane'); } // 拐杖
  }

  // ---- 頭（含脖子）----
  row(5, 10, hy, skin, 'skin');
  for (let y = hy + 1; y <= hy + 5; y++) row(4, 11, y, skin, 'skin');
  row(5, 10, hy + 6, skin, 'skin');
  row(7, 8, hy + 7, skinShade, 'neck');

  // ---- 臉 ----
  const eyeY = hy + 3;
  const dark = '#2a2230';
  if (blink) { row(5, 6, eyeY, skinShade, 'face'); row(9, 10, eyeY, skinShade, 'face'); }
  else if (a.eyes === 'sleepy') { row(5, 6, eyeY, dark, 'face'); row(9, 10, eyeY, dark, 'face'); }
  else if (a.eyes === 'big') {
    // 2×2 的大眼睛，左上角一格反光
    [[5, 6], [9, 10]].forEach(([x1, x2]) => { row(x1, x2, eyeY - 1, dark, 'face'); row(x1, x2, eyeY, dark, 'face'); put(x1, eyeY - 1, '#ffffff', 'face'); });
  } else { put(6, eyeY - 1, dark, 'face'); put(6, eyeY, dark, 'face'); put(9, eyeY - 1, dark, 'face'); put(9, eyeY, dark, 'face'); }
  if (a.lashes && kind !== 'baby' && !blink && a.eyes !== 'big') { put(5, eyeY - 1, dark, 'face'); put(10, eyeY - 1, dark, 'face'); }
  if (a.blush) { put(5, hy + 4, '#f29b9b', 'face'); put(10, hy + 4, '#f29b9b', 'face'); }
  if (a.freckles) { put(6, hy + 4, shade(skin, 0.72), 'face'); put(9, hy + 4, shade(skin, 0.72), 'face'); }
  row(7, 8, hy + 5, '#c9636b', 'face');
  if (kind === 'adult' && age >= 18) {
    if (a.beard === 'stubble') row(6, 9, hy + 6, shade(hairDark, 1.15), 'face');
    if (a.beard === 'full') { put(5, hy + 5, hairDark, 'face'); put(6, hy + 5, hairDark, 'face'); put(9, hy + 5, hairDark, 'face'); put(10, hy + 5, hairDark, 'face'); row(5, 10, hy + 6, hairDark, 'face'); row(7, 8, hy + 7, hairDark, 'face'); }
  }

  // ---- 頭髮 ----
  if (kind === 'baby') {
    row(7, 8, hy - 1, hair, 'hair'); put(8, hy - 2, hair, 'hair');
  } else {
    const style = a.hairStyle;
    const H_ = (x, y) => put(x, y, hair, 'hair');
    const cap = () => {
      row(5, 10, hy - 1, hair, 'hair');
      row(4, 11, hy, hair, 'hair');
      row(4, 6, hy + 1, hair, 'hair'); row(9, 11, hy + 1, hair, 'hair'); // 中分瀏海
      H_(4, hy + 2); H_(11, hy + 2);
    };
    if (style === 'buzz') {
      row(5, 10, hy, hairDark, 'hair'); put(4, hy + 1, hairDark, 'hair'); put(11, hy + 1, hairDark, 'hair');
    } else if (style === 'curly') {
      for (let x = 4; x <= 11; x += 2) H_(x, hy - 1);
      row(3, 12, hy, hair, 'hair'); row(3, 5, hy + 1, hair, 'hair'); row(10, 12, hy + 1, hair, 'hair');
      for (let y = hy + 2; y <= hy + 4; y++) { H_(3, y); H_(12, y); }
      put(3, hy + 5, hairDark, 'hair'); put(12, hy + 5, hairDark, 'hair');
    } else {
      cap();
      if (style === 'medium') {
        for (let y = hy + 1; y <= hy + 5; y++) { H_(3, y); H_(12, y); }
        H_(4, hy + 3); H_(11, hy + 3);
      }
      if (style === 'long') {
        const end = Math.min(FOOT - 3, hy + (kind === 'adult' ? 10 : 9));
        for (let y = hy + 1; y <= end; y++) { H_(3, y); H_(12, y); }
        for (let y = hy + 2; y <= hy + 4; y++) { H_(4, y); H_(11, y); }
      }
      if (style === 'ponytail') {
        for (let y = hy + 1; y <= hy + 6; y++) H_(12, y);
        for (let y = hy + 2; y <= hy + 5; y++) H_(13, y);
        put(12, hy + 1, '#e0607e', 'trim');
      }
      if (style === 'bun') { row(7, 8, hy - 3, hair, 'hair'); row(6, 9, hy - 2, hair, 'hair'); }
    }
  }

  // ---- 配件 ----
  if (a.glasses && kind !== 'baby') {
    const frame = '#9aa3b2';
    // 兩側、鼻樑、上框；鏡片不畫，眼睛才看得到
    [4, 7, 8, 11].forEach((x) => put(x, eyeY, frame, 'trim'));
    [5, 6, 9, 10].forEach((x) => put(x, eyeY - 2, frame, 'trim'));
  }
  if (a.hat && kind !== 'baby') {
    const hat = '#e0607e';
    row(5, 10, hy - 2, hat, 'hat'); row(4, 11, hy - 1, hat, 'hat'); row(4, 11, hy, hat, 'hat');
    row(2, 6, hy + 1, shade(hat, 0.82), 'trim');
  }
  if (a.headphones && kind !== 'baby') {
    row(5, 10, hy - 2, '#3a3f4b', 'trim'); put(4, hy - 1, '#3a3f4b', 'trim'); put(11, hy - 1, '#3a3f4b', 'trim');
    for (let y = hy; y <= hy + 1; y++) { put(3, y, '#3a3f4b', 'trim'); put(12, y, '#3a3f4b', 'trim'); }
    for (let y = hy + 2; y <= hy + 3; y++) { put(3, y, '#e6b84f', 'trim'); put(12, y, '#e6b84f', 'trim'); }
  }
  if (a.hairclip && kind !== 'baby') { put(10, hy, '#ffd36b', 'trim'); put(11, hy + 1, '#ffd36b', 'trim'); }

  // ---- 明暗：光從左上來，右邊緣與下緣暗一階，頭髮頂端亮一階 ----
  const same = (x, y, m) => x >= 0 && x < W && y >= 0 && y < H && mat[y][x] === m;
  const out = g.map((r) => r.slice());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const m = mat[y][x];
      if (!m || !g[y][x]) continue;
      if (m === 'skin' && !same(x + 1, y, 'skin') && x >= 8) out[y][x] = skinShade;
      if (m === 'skin' && y === hy + 1 && mat[hy][x] === 'hair') out[y][x] = skinShade; // 瀏海下的陰影
      if ((m === 'cloth' || m === 'pants' || m === 'hat') && (!same(x + 1, y, m) || !same(x, y + 1, m)) && x >= 7) out[y][x] = shade(g[y][x], 0.8);
      if (m === 'hair' && !same(x, y - 1, 'hair') && x >= 5 && x <= 7) out[y][x] = shade(g[y][x], 1.25);
      if (m === 'hair' && !same(x + 1, y, 'hair') && x >= 10) out[y][x] = shade(g[y][x], 0.8);
    }
  }

  // ---- 描邊：任何空格只要旁邊有東西，就塗成深色 ----
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g[y][x]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx; const ny = y + dy; return nx >= 0 && nx < W && ny >= 0 && ny < H && g[ny][nx]; });
      if (near) out[y][x] = OUTLINE;
    }
  }

  return { grid: out, waist: by + (kind === 'adult' ? 4 : kind === 'child' ? 3 : 2) };
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
  return `<svg viewBox="-1 -1 ${W + 2} ${H + 1}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${rects}</svg>`;
}
