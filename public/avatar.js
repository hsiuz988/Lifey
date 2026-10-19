// 像素小人：大頭細身的 Q 版，由「身體＋頭＋頭髮＋臉＋衣服＋配件」一層層疊出來，20×22 格（含描邊，最後一列是腳底的描邊）
// 性別只影響學生制服的下半身，髮型、衣服、配件全部自由搭配

export const W = 20; // 含描邊
export const H = 22;

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

// 大頭細身的比例：頭寬、頭高、身寬、身高、腿長（寬度都是偶數，左右對稱）
const P = { hw: 10, hh: 9, tw: 6, th: 3, lh: 2 };
const IW = W - 2; // 不含描邊的寬高
const IH = H - 2;
const CX = IW / 2; // 中線在 CX-1 和 CX 之間

// 回傳 { grid, waist }：grid[y][x] 是顏色或 null（含描邊）；waist 以上的列在呼吸時會往下沉 1px
// 畫法：先把每一格標上材質（皮膚、頭髮、衣服…），再依材質上明暗（光從左上來），最後在外圍描一圈深色邊
// 眼睛和寵物同一套：大眼 2×2 加反光、圓眼直的兩格、瞇瞇眼是 ^ ^ 笑眼
export function composeAvatar(avatar, age, stageKey, { blink = false, step = false, emo = '' } = {}) {
  const a = normalizeAvatar(avatar);
  const kind = kindFor(age);
  const baby = kind === 'baby';
  const g = Array.from({ length: IH }, () => Array(IW).fill(null)); // 顏色
  const mat = Array.from({ length: IH }, () => Array(IW).fill(null)); // 材質
  const put = (x, y, c, m = 'other') => { if (c && x >= 0 && x < IW && y >= 0 && y < IH) { g[y][x] = c; mat[y][x] = m; } };
  const row = (x1, x2, y, c, m) => { for (let x = x1; x <= x2; x++) put(x, y, c, m); };
  const mid = (w, y, c, m) => row(CX - w / 2, CX - 1 + w / 2, y, c, m); // 置中的一列
  const pair = (x, y, c, m) => { put(x, y, c, m); put(IW - 1 - x, y, c, m); }; // 左右對稱各一格

  const skin = SKINS[a.skin] || SKINS[2];
  const skinShade = shade(skin, 0.86);
  let hair = HAIRS[a.hair] || HAIRS[0];
  if (age >= 65) hair = '#e4e4ea';
  else if (age >= 50) hair = shade(hair, 1.25);
  const hairDark = shade(hair, 0.75);

  const school = a.uniform && UNIFORMS[stageKey];
  const cloth = school ? school.top : OUTFIT_COLORS[a.outfitColor] || OUTFIT_COLORS[0];
  const outfit = school ? 'uniform' : a.outfit;
  const skirt = school ? a.gender === 'female' : outfit === 'dress';
  const lower = skirt ? (school ? school.bottom : cloth) : '#4a5578';
  const shoes = '#3a3340';

  // 小孩身體短一點、寶寶坐著
  const th = kind === 'adult' ? P.th : kind === 'child' ? P.th - 1 : 3;
  const lh = kind === 'adult' ? P.lh : kind === 'child' ? P.lh - 1 : 0;
  const hw = baby ? P.hw - 2 : P.hw;
  const hh = baby ? P.hh - 1 : P.hh;
  const FOOT = IH - 1; // 腳底
  const by = FOOT - lh - th + (baby ? 1 : 0); // 身體第一列
  const y0 = by - hh; // 頭頂（皮膚）第一列
  const hx1 = CX - hw / 2;
  const hx2 = CX - 1 + hw / 2;
  const tx1 = CX - P.tw / 2;
  const tx2 = CX - 1 + P.tw / 2;

  // ---- 身體 ----
  if (baby) {
    mid(P.tw, by, cloth, 'cloth');
    mid(P.tw + 2, by + 1, cloth, 'cloth');
    pair(tx1 - 2, by + 1, skin, 'skin');
    row(tx1, tx1 + 1, by + 2, skin, 'skin'); row(tx2 - 1, tx2, by + 2, skin, 'skin'); // 坐著的腳
  } else {
    for (let y = by; y < by + th; y++) mid(P.tw, y, cloth, 'cloth');
    pair(tx1 - 1, by, cloth, 'cloth'); // 袖子
    for (let y = by + 1; y < by + Math.min(3, th); y++) pair(tx1 - 1, y, skin, 'skin');
    const accent = school ? school.collar : '#ffffff';
    if (outfit === 'shirt' || outfit === 'uniform') mid(2, by, accent, 'trim');
    if (outfit === 'shirt') for (let y = by + 1; y < by + th; y++) put(CX, y, shade(cloth, 0.8), 'trim');
    if (outfit === 'hoodie') { mid(P.tw - 2, by, shade(cloth, 0.78), 'trim'); pair(CX - 2, by + 1, '#ffffff', 'trim'); }
    if (outfit === 'sport') for (let y = by; y < by + th; y++) pair(tx1, y, '#ffffff', 'trim');
    if (outfit === 'uniform' && stageKey === 'senior' && a.gender !== 'female') for (let y = by + 1; y < by + th; y++) put(CX - 1, y, school.collar, 'trim');

    // 下半身：裙子往外開一格，褲子是兩隻腳
    const ly = by + th;
    if (skirt) {
      mid(P.tw + 2, ly - 1, lower, 'skirt');
      for (let y = ly; y < FOOT; y++) { put(tx1 + 1, y, skin, 'skin'); put(tx2 - 1, y, skin, 'skin'); }
    } else {
      for (let y = ly; y < FOOT; y++) { row(tx1, tx1 + 1, y, lower, 'pants'); row(tx2 - 1, tx2, y, lower, 'pants'); }
    }
    row(tx2 - 1, tx2, FOOT, shoes, 'shoe');
    if (step) { row(tx1, tx1 + 1, FOOT - 1, shoes, 'shoe'); } // 抬左腳
    else row(tx1, tx1 + 1, FOOT, shoes, 'shoe');

    if (age >= 75) { for (let y = by + 1; y <= FOOT; y++) put(tx2 + 2, y, '#9a6a3f', 'cane'); put(tx2 + 1, by + 1, '#9a6a3f', 'cane'); } // 拐杖
  }

  // ---- 頭：圓角 ----
  mid(hw - 4, y0, skin, 'skin');
  mid(hw - 2, y0 + 1, skin, 'skin');
  for (let y = y0 + 2; y < y0 + hh - 2; y++) mid(hw, y, skin, 'skin');
  mid(hw - 2, y0 + hh - 2, skin, 'skin');
  mid(hw - 4, y0 + hh - 1, skin, 'skin');

  // ---- 臉 ----
  const dark = '#2a2230';
  const ey = y0 + Math.floor(hh / 2); // 眼睛在頭的中間偏下，額頭留給瀏海
  const eL = CX - 4; // 左眼（2 格寬）的左邊那格，兩眼中間留 4 格
  const eR = IW - eL - 2;
  const eyes = baby ? 'round' : a.eyes;
  // 今天的情緒（garden.js 的 EMOTIONS）：換眼睛和嘴巴，其他表情符號由場景畫在頭旁邊
  const E = baby ? '' : emo;
  const caret = () => [eL - 1, eR - 1].forEach((x) => { put(x + 1, ey + 1, dark, 'face'); put(x + 2, ey, dark, 'face'); put(x + 3, ey + 1, dark, 'face'); });
  if (!blink && E === 'happy') caret();
  else if (!blink && E === 'excited') [eL, eR].forEach((x) => { row(x, x + 1, ey, dark, 'face'); row(x, x + 1, ey + 1, dark, 'face'); put(x + 1, ey, '#ffffff', 'face'); });
  else if (!blink && (E === 'calm' || E === 'tired')) { row(eL, eL + 1, ey + 1, dark, 'face'); row(eR, eR + 1, ey + 1, dark, 'face'); }
  else if (!blink && E === 'moved') [eL, eR].forEach((x) => { row(x, x + 1, ey, dark, 'face'); row(x, x + 1, ey + 1, dark, 'face'); put(x + 1, ey, '#ffffff', 'face'); put(x + 1, ey + 1, '#9fd3ff', 'face'); });
  else if (!blink && E === 'miss') { pair(eL, ey, dark, 'face'); pair(eL + 1, ey, dark, 'face'); }
  else if (blink) { row(eL, eL + 1, ey + 1, skinShade, 'face'); row(eR, eR + 1, ey + 1, skinShade, 'face'); }
  else if (eyes === 'sleepy') [eL - 1, eR - 1].forEach((x) => { put(x, ey + 1, dark, 'face'); put(x + 1, ey, dark, 'face'); put(x + 2, ey + 1, dark, 'face'); });
  else if (eyes === 'big') [eL, eR].forEach((x) => { row(x, x + 1, ey, dark, 'face'); row(x, x + 1, ey + 1, dark, 'face'); put(x + 1, ey, '#ffffff', 'face'); });
  else { pair(eL + 1, ey, dark, 'face'); pair(eL + 1, ey + 1, dark, 'face'); }
  if (a.lashes && !baby && !blink && eyes !== 'sleepy') pair(eyes === 'big' ? eL - 1 : eL, ey, dark, 'face');
  if (a.blush || baby) pair(hx1 + 1, ey + 2, '#f4a3a8', 'face');
  if (a.freckles) pair(eL + 2, ey + 2, shade(skin, 0.7), 'face');
  const lip = '#c9636b';
  const cheek = '#f08a9a';
  if (E === 'happy') { mid(4, ey + 2, lip, 'face'); mid(2, ey + 3, '#8a3a44', 'face'); pair(hx1 + 1, ey + 2, cheek, 'face'); }
  else if (E === 'excited') { mid(4, ey + 2, lip, 'face'); mid(4, ey + 3, '#8a3a44', 'face'); pair(hx1 + 1, ey + 2, cheek, 'face'); }
  else if (E === 'love') { mid(2, ey + 2, lip, 'face'); row(hx1, hx1 + 2, ey + 2, cheek, 'face'); row(hx2 - 2, hx2, ey + 2, cheek, 'face'); }
  else if (E === 'tired') mid(2, ey + 3, shade(lip, 0.8), 'face');
  else if (E === 'sad') { put(CX - 1, ey + 3, lip, 'face'); put(CX, ey + 3, lip, 'face'); put(CX - 2, ey + 4, lip, 'face'); put(CX + 1, ey + 4, lip, 'face'); put(eR + 1, ey + 2, '#8fc8f0', 'face'); }
  else if (E === 'angry') { mid(4, ey + 3, '#8a3a44', 'face'); pair(eL, ey - 1, dark, 'face'); }
  else if (E === 'nervous') { put(CX - 2, ey + 3, lip, 'face'); put(CX - 1, ey + 2, lip, 'face'); put(CX, ey + 3, lip, 'face'); put(CX + 1, ey + 2, lip, 'face'); }
  else mid(2, ey + 2, lip, 'face');
  if (kind === 'adult' && age >= 18) {
    if (a.beard === 'stubble') mid(hw - 4, y0 + hh - 1, shade(hairDark, 1.2), 'face');
    if (a.beard === 'full') {
      pair(hx1, ey + 2, hairDark, 'face');
      row(hx1, CX - 2, ey + 3, hairDark, 'face'); row(CX + 1, hx2, ey + 3, hairDark, 'face');
      mid(hw - 2, y0 + hh - 2, hairDark, 'face'); mid(hw - 4, y0 + hh - 1, hairDark, 'face');
    }
  }

  // ---- 頭髮（只往外 1 格，不會太蓬）----
  const sides = (x, y1, y2) => { for (let y = y1; y <= y2; y++) pair(x, y, hair, 'hair'); };
  if (baby) {
    mid(2, y0 - 1, hair, 'hair'); put(CX, y0 - 2, hair, 'hair'); mid(hw - 4, y0, hair, 'hair');
  } else {
    const style = a.hairStyle;
    const cap = () => {
      mid(hw - 2, y0 - 1, hair, 'hair');
      mid(hw, y0, hair, 'hair');
      mid(hw + 2, y0 + 1, hair, 'hair');
      row(hx1 - 1, CX - 1, y0 + 2, hair, 'hair'); row(hx2 - 1, hx2 + 1, y0 + 2, hair, 'hair'); // 斜瀏海
      row(hx1 - 1, hx1, y0 + 3, hair, 'hair'); put(hx2 + 1, y0 + 3, hair, 'hair');
    };
    if (style === 'buzz') {
      mid(hw - 2, y0 - 1, hairDark, 'hair'); mid(hw, y0, hairDark, 'hair'); pair(hx1, y0 + 1, hairDark, 'hair');
    } else if (style === 'curly') {
      [hx1 + 1, CX - 1, hx2 - 2].forEach((x) => row(x, x + 1, y0 - 2, hair, 'hair'));
      mid(hw, y0 - 1, hair, 'hair'); mid(hw + 2, y0, hair, 'hair'); mid(hw + 2, y0 + 1, hair, 'hair');
      row(hx1 - 1, hx1 + 2, y0 + 2, hair, 'hair'); row(hx2 - 2, hx2 + 1, y0 + 2, hair, 'hair');
      for (let y = y0 + 3; y <= ey + 2; y++) pair(hx1 - 1, y, y % 2 ? hair : hairDark, 'hair');
    } else {
      cap();
      if (style === 'short') sides(hx1 - 1, y0 + 3, ey);
      if (style === 'medium') sides(hx1 - 1, y0 + 3, y0 + hh - 1);
      if (style === 'long') { const end = Math.max(y0 + hh, by + th - 2); sides(hx1 - 1, y0 + 3, end); sides(hx1 - 2, y0 + 3, end); }
      if (style === 'ponytail') {
        sides(hx1 - 1, y0 + 3, ey);
        for (let y = y0 + 1; y <= y0 + 6; y++) put(hx2 + 2, y, hair, 'hair');
        for (let y = y0 + 2; y <= y0 + 5; y++) put(hx2 + 3, y, hair, 'hair');
        put(hx2 + 2, y0 + 1, '#e0607e', 'trim');
      }
      if (style === 'bun') { mid(4, y0 - 3, hair, 'hair'); mid(4, y0 - 2, hair, 'hair'); sides(hx1 - 1, y0 + 3, ey); }
    }
  }

  // ---- 配件 ----
  if (!baby) {
    if (a.glasses) {
      const frame = '#a7afbd'; // 淺色鏡框，鏡片不畫，眼睛才看得到
      [eL - 1, eR - 1].forEach((x) => { row(x, x + 3, ey - 1, frame, 'trim'); put(x, ey, frame, 'trim'); put(x + 3, ey, frame, 'trim'); put(x, ey + 1, frame, 'trim'); put(x + 3, ey + 1, frame, 'trim'); });
    }
    if (a.hat) {
      const hat = '#e0607e';
      mid(hw - 4, y0 - 2, hat, 'hat'); mid(hw - 2, y0 - 1, hat, 'hat'); mid(hw, y0, hat, 'hat'); mid(hw + 2, y0 + 1, hat, 'hat');
      row(hx1 - 3, CX, y0 + 2, shade(hat, 0.8), 'trim');
    }
    if (a.headphones) {
      const band = '#3a3f4b';
      mid(hw - 2, y0 - 2, band, 'trim'); pair(hx1, y0 - 1, band, 'trim');
      for (let y = y0; y < ey - 1; y++) pair(hx1 - 1, y, band, 'trim');
      for (let y = ey - 1; y <= ey + 1; y++) { pair(hx1 - 1, y, '#e6b84f', 'trim'); pair(hx1 - 2, y, '#e6b84f', 'trim'); }
    }
    if (a.hairclip) { put(hx2 - 1, y0 + 1, '#ffd36b', 'trim'); put(hx2, y0 + 2, '#ffd36b', 'trim'); }
  }

  // ---- 明暗：光從左上來，右邊緣與下緣暗一階，頭髮頂端亮一階 ----
  const same = (x, y, m) => x >= 0 && x < IW && y >= 0 && y < IH && mat[y][x] === m;
  const shaded = g.map((r) => r.slice());
  for (let y = 0; y < IH; y++) {
    for (let x = 0; x < IW; x++) {
      const m = mat[y][x];
      if (!m) continue;
      if (m === 'skin' && x >= CX && !same(x + 1, y, 'skin')) shaded[y][x] = skinShade;
      if (m === 'skin' && same(x, y - 1, 'hair')) shaded[y][x] = skinShade; // 瀏海下的陰影
      if ((m === 'cloth' || m === 'skirt' || m === 'pants' || m === 'hat') && x >= CX && (!same(x + 1, y, m) || !same(x, y + 1, m))) shaded[y][x] = shade(g[y][x], 0.82);
      if (m === 'hair' && !same(x, y - 1, 'hair') && x >= hx1 && x < CX) shaded[y][x] = shade(g[y][x], 1.3);
      if (m === 'hair' && x >= hx2 - 1 && !same(x + 1, y, 'hair')) shaded[y][x] = shade(g[y][x], 0.8);
    }
  }

  // ---- 描邊：外面多留一圈，任何空格只要旁邊有東西就塗成深色 ----
  const padded = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (shaded[y - 1] && shaded[y - 1][x - 1]) || null));
  const out = padded.map((r) => r.slice());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (padded[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => padded[y + dy] && padded[y + dy][x + dx])) out[y][x] = OUTLINE;
    }
  }

  return { grid: out, waist: by + 2 };
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

// 靜態圖（身分卡、另一半的頭像）：裁掉上方空白，畫成正方形；crop: 'head' 只看頭（捏人的選項小圖）
export function avatarSvg(avatar, age, stageKey, { crop = 'body' } = {}) {
  const { grid, waist } = composeAvatar(avatar, age, stageKey);
  let rects = '';
  let top = H;
  grid.forEach((r, y) => r.forEach((c, x) => { if (c) { rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`; top = Math.min(top, y); } }));
  let box;
  if (crop === 'head') {
    const hgt = waist - top + 1; // 到衣領為止
    box = `${(W - Math.max(W, hgt)) / 2} ${top - 1} ${Math.max(W, hgt)} ${hgt + 1}`;
  } else {
    const ch = H - top; // 內容的高度
    const size = Math.max(W, ch) + 2;
    box = `${(W - size) / 2} ${top - (size - ch) / 2} ${size} ${size}`;
  }
  return `<svg viewBox="${box}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${rects}</svg>`;
}
