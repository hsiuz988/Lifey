// 養成系統：狀態、成就、像素頭像與場景（純函式，不碰 DOM 與資料庫）

// ---------- 四項狀態 ----------
export const STATS = [
  { key: 'health', label: '健康', color: '#5cc28a', tags: ['健康', '運動'] },
  { key: 'happy', label: '幸福', color: '#e0b050' },
  { key: 'knowledge', label: '知識', color: '#3fb8a8', tags: ['學習', '工作'] },
  { key: 'social', label: '人際關係', color: '#e0607e', tags: ['家人', '朋友', '愛情'] },
];

const weight = (m) => (m.starred ? 2 : 1);
// 邊際遞減：第一則加最多，記越多越接近 100，不會一下子就滿
const grow = (points) => Math.round(20 + 80 * (1 - 0.8 ** points));

// 這個時刻算不算在某一項狀態裡（用來計算重心的進度）
export function countsToward(stat, m) {
  if (stat.key === 'happy') return (m.mood || 0) >= 4;
  return m.tags.some((t) => stat.tags.includes(t));
}

export function statsFor(moments) {
  const points = (tags) => moments.filter((m) => m.tags.some((t) => tags.includes(t))).reduce((n, m) => n + weight(m), 0);
  const moods = moments.map((m) => m.mood).filter(Boolean);
  const avgMood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const happyBase = avgMood ? 10 + ((avgMood - 1) / 4) * 80 : 50; // 沒填心情就是普通的 50
  const fun = Math.min(10, points(['旅行', '興趣', '里程碑']) * 2);
  const out = { happy: Math.round(Math.min(100, happyBase + fun)) };
  for (const s of STATS) if (s.tags) out[s.key] = grow(points(s.tags));
  return out;
}

// ---------- 成就 ----------
const covers = (c, from, to) => {
  if (c.current < to) return false;
  for (let a = from; a <= to; a++) if (!c.recorded.has(a)) return false;
  return true;
};

function longestStreak(moments) {
  const days = [...new Set(moments.filter((m) => !m.approx).map((m) => m.date))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    const t = Date.UTC(...d.split('-').map((n, i) => (i === 1 ? n - 1 : +n)));
    run = prev != null && t - prev === 86400000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

export const ACHIEVEMENTS = [
  { id: 'first', icon: '✏️', name: '第一步', desc: '記下第一個時刻', test: (c) => c.moments.length >= 1 },
  { id: 'star', icon: '⭐', name: '值得記住', desc: '標記第一個 ☆', test: (c) => c.moments.some((m) => m.starred) },
  { id: 'ten', icon: '📒', name: '十個時刻', desc: '累積 10 則紀錄', test: (c) => c.moments.length >= 10 },
  { id: 'fifty', icon: '📚', name: '五十個時刻', desc: '累積 50 則紀錄', test: (c) => c.moments.length >= 50 },
  { id: 'hundred', icon: '🏛️', name: '一百個時刻', desc: '累積 100 則紀錄', test: (c) => c.moments.length >= 100 },
  { id: 'photo', icon: '📷', name: '留下畫面', desc: '加上第一張照片', test: (c) => c.photos >= 1 },
  { id: 'album', icon: '🖼️', name: '相簿', desc: '累積 50 張照片', test: (c) => c.photos >= 50 },
  { id: 'origin', icon: '👶', name: '回到起點', desc: '記下 0 歲的回憶', test: (c) => c.recorded.has(0) },
  { id: 'childhood', icon: '🧩', name: '童年拼圖', desc: '0–12 歲每一歲都有紀錄', test: (c) => covers(c, 0, 12) },
  { id: 'youth', icon: '🎒', name: '青春回憶', desc: '13–18 歲每一歲都有紀錄', test: (c) => covers(c, 13, 18) },
  { id: 'wholelife', icon: '🌏', name: '完整的一生', desc: '到今年為止每一歲都有紀錄', test: (c) => covers(c, 0, c.current) },
  { id: 'titles', icon: '🔖', name: '一句話人生', desc: '寫下 10 個年歲的一句話', test: (c) => c.titles >= 10 },
  { id: 'happy', icon: '😄', name: '好日子', desc: '同一歲裡有 10 則 😄', test: (c) => [...c.byAge.values()].some((l) => l.filter((m) => m.mood === 5).length >= 10) },
  { id: 'travel', icon: '🧳', name: '旅人', desc: '記下 5 次旅行', test: (c) => c.moments.filter((m) => m.tags.includes('旅行')).length >= 5 },
  { id: 'streak', icon: '🔥', name: '連續一週', desc: '連續 7 天都有記錄', test: (c) => longestStreak(c.moments) >= 7 },
  { id: 'focus', icon: '🎯', name: '有方向的一年', desc: '選定一年的重心', test: (c) => c.focusSet },
  { id: 'backup', icon: '🛟', name: '守護者', desc: '第一次匯出備份', test: (c) => c.backedUp },
];

export const unlockedNow = (ctx) => ACHIEVEMENTS.filter((a) => a.test(ctx)).map((a) => a.id);

// ---------- 像素頭像 ----------
export const SKINS = ['#f6d5bd', '#e8b48f', '#c58a62', '#8d5a3b'];
export const HAIRS = ['#2b211c', '#5a3825', '#a0522d', '#d9b36a', '#8e939a'];
export const STYLES = [['short', '短髮'], ['long', '長髮'], ['bun', '包頭']];
export const DEFAULT_AVATAR = { skin: 1, hair: 0, style: 'short', glasses: false };

// h 頭髮、s 皮膚、e 眼睛、m 嘴巴、c 衣服、p 褲子、b 鞋子
const SPRITES = {
  baby: [
    '................', '................', '................', '................',
    '......hhhh......', '.....ssssss.....', '....ssessess....', '....ssssssss....',
    '....sssmmsss....', '.....ssssss.....', '....cccccccc....', '...sccccccccs...',
    '...cccccccccc...', '....cccccccc....', '....ss....ss....', '................',
  ],
  child: [
    '................', '................', '.....hhhhhh.....', '....hhhhhhhh....',
    '....hssssssh....', '....ssessess....', '....ssssssss....', '....sssmmsss....',
    '.....ssssss.....', '....cccccccc....', '...sccccccccs...', '...sccccccccs...',
    '....pppppppp....', '....ppp..ppp....', '....bbb..bbb....', '................',
  ],
  adult: [
    '................', '.....hhhhhh.....', '....hhhhhhhh....', '....hssssssh....',
    '....ssessess....', '....ssssssss....', '....sssmmsss....', '.....ssssss.....',
    '...cccccccccc...', '..cccccccccccc..', '..sccccccccccs..', '..sccccccccccs..',
    '....pppppppp....', '....ppp..ppp....', '....ppp..ppp....', '....bbb..bbb....',
  ],
};

const CLOTHES = { baby: '#f2a7b8', kinder: '#f2c14e', elementary: '#5cc28a', junior: '#3f7fd1', senior: '#3f7fd1', college: '#8a6fd1', adult: '#e0607e' };

function avatarGrid({ age, stageKey, style, glasses }) {
  const kind = age < 3 ? 'baby' : age < 12 ? 'child' : 'adult';
  const grid = SPRITES[kind].map((row) => row.split(''));
  const top = grid.findIndex((row) => row.includes('h'));
  if (kind !== 'baby' && style === 'long') {
    for (let r = top + 1; r <= top + 8; r++) { grid[r][3] = 'h'; grid[r][12] = 'h'; }
  }
  if (kind !== 'baby' && style === 'bun' && top > 0) { grid[top - 1][7] = 'h'; grid[top - 1][8] = 'h'; }
  if (glasses && kind !== 'baby') {
    const eyeRow = grid.findIndex((row) => row.includes('e'));
    [5, 7, 8, 10].forEach((c) => { grid[eyeRow][c] = 'g'; });
  }
  return { grid, clothes: CLOTHES[stageKey] || CLOTHES.adult };
}

export function avatarRects(opts) {
  const { grid, clothes } = avatarGrid(opts);
  const hair = opts.age >= 65 ? '#c9ccd1' : HAIRS[opts.hair] || HAIRS[0];
  const skin = SKINS[opts.skin] || SKINS[1];
  const colors = { h: hair, s: skin, e: '#1b1b22', m: '#c0565e', c: clothes, p: '#2e3a5c', b: '#1c1c1c', g: '#26262e' };
  let out = '';
  grid.forEach((row, y) => row.forEach((ch, x) => {
    if (colors[ch]) out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[ch]}"/>`;
  }));
  return out;
}

export const avatarSvg = (opts) =>
  `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${avatarRects(opts)}</svg>`;

// ---------- 像素場景 ----------
const W = 96;
const H = 40;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

function sprite(rows, x, y, colors) {
  let out = '';
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => { if (colors[ch]) out += rect(x + dx, y + dy, 1, 1, colors[ch]); }));
  return out;
}

const PROPS = {
  heart: { rows: ['.x.x.', 'xxxxx', '.xxx.', '..x..'], colors: { x: '#e0607e' } },
  book: { rows: ['xxxxx', 'xwxwx', 'xwxwx', 'xxxxx'], colors: { x: '#3f7fd1', w: '#f5f0e6' } },
  suitcase: { rows: ['.y.y.', 'xxxxx', 'xyxyx', 'xxxxx'], colors: { x: '#8b5a2b', y: '#d9a45b' } },
  ball: { rows: ['.xxx.', 'xxwxx', 'xwxwx', '.xxx.'], colors: { x: '#e05a3a', w: '#ffffff' } },
};

export function propsForTags(tags) {
  const out = [];
  if (tags.has('愛情')) out.push('heart');
  if (tags.has('學習')) out.push('book');
  if (tags.has('旅行')) out.push('suitcase');
  if (tags.has('健康') || tags.has('運動')) out.push('ball');
  return out.slice(0, 3);
}

function period(hour) {
  if (hour < 5 || hour >= 19) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 17) return 'day';
  return 'dusk';
}

const SKY = { night: ['#0f1530', '#18213f', '#222c52'], dawn: ['#e98f73', '#f3b28a', '#f7d6a8'], day: ['#5aa9db', '#7ec0e8', '#a6d8f2'], dusk: ['#7a4a8c', '#c8607a', '#f0a46a'] };

function building(stageKey, night) {
  const win = night ? '#ffd36b' : '#7fb2d9';
  let out = '';
  if (stageKey === 'baby' || stageKey === 'kinder') {
    out += rect(60, 22, 20, 12, '#d9c3a0');
    for (let i = 0; i < 6; i++) out += rect(58 + i * 2, 21 - i, 24 - i * 4, 1, '#a0522d');
    out += rect(68, 27, 4, 7, '#6b4226') + rect(62, 25, 4, 4, win) + rect(74, 25, 4, 4, win);
  } else if (['elementary', 'junior', 'senior'].includes(stageKey)) {
    out += rect(54, 19, 36, 15, '#e8e1d2') + rect(54, 18, 36, 1, '#b5a98f');
    out += rect(70, 13, 4, 6, '#e8e1d2') + rect(71, 14, 2, 2, '#26262e');
    for (let c = 0; c < 6; c++) for (let r = 0; r < 2; r++) if (!(c === 3 && r === 1)) out += rect(56 + c * 6, 21 + r * 6, 3, 3, win);
    out += rect(70, 28, 4, 6, '#6b4226');
    out += rect(92, 10, 1, 24, '#8e939a') + rect(93, 10, 3, 2, '#e0607e');
  } else if (stageKey === 'college') {
    out += rect(58, 16, 28, 18, '#c9b6a0') + rect(56, 15, 32, 1, '#8b6f55');
    for (let c = 0; c < 4; c++) out += rect(61 + c * 7, 19, 3, 5, win);
    out += rect(68, 26, 8, 8, '#4a3a2c') + rect(69, 25, 6, 1, '#4a3a2c');
    out += rect(50, 22, 1, 12, '#6b4226') + rect(47, 16, 7, 7, '#3f7a3a');
    out += rect(91, 24, 1, 10, '#6b4226') + rect(88, 18, 7, 7, '#3f7a3a');
  } else {
    const towers = [[52, 14, 8], [61, 8, 9], [71, 18, 6], [78, 11, 8], [87, 16, 9]];
    for (const [x, y, w] of towers) {
      out += rect(x, y, w, 34 - y, night ? '#2b3350' : '#8a96a8');
      for (let wy = y + 2; wy < 32; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) {
        if ((wx * 7 + wy * 13) % 5 !== 0) out += rect(wx, wy, 1, 1, night ? ((wx + wy) % 3 ? win : '#3a4466') : '#c8d6e6');
      }
    }
  }
  return out;
}

export function sceneSvg({ hour, stageKey, avatar, props = [], seed = 1 }) {
  const p = period(hour);
  const night = p === 'night';
  const rand = rng(seed);
  const sky = SKY[p];
  let out = rect(0, 0, W, 12, sky[0]) + rect(0, 12, W, 10, sky[1]) + rect(0, 22, W, 12, sky[2]);

  if (night) {
    for (let i = 0; i < 18; i++) out += rect(Math.floor(rand() * W), Math.floor(rand() * 20), 1, 1, i % 4 ? '#c9d3f2' : '#ffffff');
    out += rect(80, 4, 4, 6, '#f3e9c6') + rect(79, 5, 1, 4, '#f3e9c6') + rect(83, 5, 2, 4, sky[0]);
  } else {
    const sunY = p === 'day' ? 4 : 14;
    out += rect(78, sunY + 1, 6, 4, '#ffd96b') + rect(79, sunY, 4, 6, '#ffd96b');
    for (let i = 0; i < 2; i++) {
      const cx = Math.floor(rand() * 60) + 4;
      const cy = Math.floor(rand() * 8) + 3;
      out += rect(cx, cy + 1, 12, 2, '#ffffffcc') + rect(cx + 3, cy, 6, 1, '#ffffffcc');
    }
  }

  // 遠山
  const hill = night ? '#1d2a3d' : p === 'dusk' ? '#6a4a6a' : '#7aa86a';
  for (let x = 0; x < W; x += 4) {
    const hgt = 4 + Math.round(3 * Math.sin(x / 9) + 2 * Math.sin(x / 4 + seed));
    out += rect(x, 30 - hgt, 4, hgt + 4, hill);
  }

  out += building(stageKey, night);

  // 地面與小路
  out += rect(0, 34, W, 6, night ? '#2c4d25' : '#4f8a3c') + rect(0, 36, W, 2, night ? '#5e5440' : '#c9b38a');

  // 主角與道具
  out += `<svg x="38" y="20" width="16" height="16" viewBox="0 0 16 16">${avatar}</svg>`;
  const slots = [[30, 31], [57, 31], [22, 31]];
  props.forEach((name, i) => { const pr = PROPS[name]; out += sprite(pr.rows, slots[i][0], slots[i][1], pr.colors); });

  return `<svg viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="今年的場景">${out}</svg>`;
}
