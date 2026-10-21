// 首頁的房間：一張插畫房間＋用圖層疊出來的小人，點地板走路、點東西互動
// 房間裡只有遊戲的部分；點了東西要做什麼（記一筆、看月曆…）由 app.js 傳進來
import { IMPRINTS } from './joys-config.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (parent) parent.append(e); return e; };
const BASE = 'room/';
// 像素房間（art/tools/room_pixel.py）：1536×1064，地板前角已補齊
const W = 1536, H = 1064;
export const VIEW = [60, -8, 1416, 1081];

// 可以選的樣子（之後有新素材就加在這裡）
// 三種角色：像素女孩（logo 的女孩，走路是 4 格動畫）、經典（有表情、衣服）、復古娃娃（手腳分開，走路會擺手擺腳）
export const STYLES = [['pixel', '像素女孩'], ['classic', '經典'], ['doll', '復古娃娃']];
const STYLE_LOOKS = {
  pixel: {
    hair: [['bob', '妹妹頭']],
    cloth: [['sweater', '日常毛衣']],
  },
  classic: {
    hair: [['ponytail', '高馬尾'], ['', '光頭']],
    cloth: [['tee', 'T 恤'], ['hoodie', '帽 T'], ['', '運動服']],
  },
  doll: {
    hair: [['long', '長直髮'], ['bob', '鮑伯頭'], ['', '光頭']],
    cloth: [['tee', 'T 恤'], ['', '運動服']],
  },
};
const STYLE_DEFAULT = { pixel: { hair: 'bob', cloth: 'sweater' }, classic: { hair: 'ponytail', cloth: 'tee' }, doll: { hair: 'long', cloth: 'tee' } };
export const LOOKS = STYLE_LOOKS.classic;
export const looksFor = (style) => STYLE_LOOKS[style] || LOOKS;
export const DEFAULT_LOOK = { style: 'pixel', ...STYLE_DEFAULT.pixel };
// 還沒選過樣子的新使用者是像素女孩；舊資料沒有 style 的維持經典
export const normalizeLook = (l) => {
  const style = !l ? 'pixel' : STYLE_LOOKS[l.style] ? l.style : 'classic';
  const opts = STYLE_LOOKS[style], def = STYLE_DEFAULT[style];
  return {
    style,
    hair: l && opts.hair.some(([v]) => v === l.hair) ? l.hair : def.hair,
    cloth: l && opts.cloth.some(([v]) => v === l.cloth) ? l.cloth : def.cloth,
  };
};
// 小人只有三種臉：10 種心情對到最接近的
const EMO_FACE = { happy: 'happy', excited: 'happy', love: 'happy', moved: 'happy', angry: 'angry' };
export const faceFor = (emo) => EMO_FACE[emo] || 'smile';

// 小人的圖層（後髮 → 身體 → 衣服 → 五官 → 前髮 → 表情符號）；每張 267×420，腳底在 (108.8, 418.6)
const CHAR_W = 267, CHAR_H = 420, FOOT = [108.8, 418.6];
const SYM = { angry: true };
// 復古娃娃（四分之三側面，臉朝畫面右下；往左走就整個翻面）：每張 242×420，腳底在 (129.5, 418.6)
// n＝靠近我們的那側（畫面左），f＝遠的那側；手腳繞關節轉（art/tools/doll34.py 印出來的數字）
const DOLL_W = 242, DOLL_H = 420, DOLL_FOOT = [129.5, 418.6];
const DOLL_JOINTS = { arm_n: [105.9, 232.6], arm_f: [155.9, 236.0], leg_n: [115.6, 296.8], leg_f: [150.3, 296.8] };
const DOLL_FACES = new Set(); // 這一版沒有表情，臉畫在身體上
const dollFace = (face) => (DOLL_FACES.has(face) ? `face_${face}` : null);
// 正面（站著、換裝畫面）：不會動，只有 後髮 → 身體 → 前髮；每張 257×420，腳底在 (128.2, 419.7)（art/tools/doll_front.py）
const DOLL_SIZE = 272; // 復古娃娃在房間裡的高度（經典小人是 320）
const FRONT_W = 257, FRONT_FOOT = [128.2, 419.7];
const dollFrontParts = (hair, cloth) => [hair && `hair_${hair}_back`, cloth ? `body_${cloth}` : 'body', hair && `hair_${hair}_front`];
// 側面疊的順序：後髮 → 遠手 → 遠腳 → 近腳 → 身體 → 表情 → 前髮 → 近手
const dollParts = (hair, cloth, face) => {
  const c = cloth ? `_${cloth}` : '';
  return [hair && `hair_${hair}_back`, `arm_f${c}`, `leg_f${c}`, `leg_n${c}`, `body${c}`, dollFace(face), hair && `hair_${hair}_front`, `arm_n${c}`];
};
// 像素女孩（art/tools/pixel_parts.py）：紙娃娃做法，頭和身體分開畫，每張 267×420，腳底大約在 (133.5, 389)
// 頭的下巴疊在身體的脖子上；站著用正面；走路用側面的頭＋4 格身體輪流換（往左走整個翻面）
const PIX_W = 267, PIX_H = 420, PIX_FOOT = [133.5, 389];
const PIX_SIZE = 340; // 畫布在房間裡的高度（人物本身大約 272，和復古娃娃一樣高）
const PIX_FRAME = 0.15; // 走路每格幾秒
// 像素女孩的圖改過就把這個數字 +1（sw.js 的清單也要一起改）：網址不同，舊版程式和新圖才不會混在一起
const PIX_REV = 2;
const pixSrc = (f) => `${BASE}pixel/${f}.webp?v=${PIX_REV}`;
// 窗外（art/tools/room_window.py）：房間原圖的窗外就是白天晴天；其他天氣疊一張只有玻璃的圖
// 晚上：有日出日落就照當地時間，沒開天氣就用 18 點到 6 點
const WINDOW_BOX = [355, 180, 220, 260];
export function windowView(weather, now = new Date()) {
  const hm = (iso) => { const m = /T(\d\d):(\d\d)/.exec(iso || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const t = now.getHours() * 60 + now.getMinutes(), rise = weather && hm(weather.sunrise), set = weather && hm(weather.sunset);
  const night = rise != null && set != null ? t < rise || t >= set : t < 6 * 60 || t >= 18 * 60;
  const kind = weather ? weather.kind : 'clear';
  const wet = ['drizzle', 'rain', 'heavyrain', 'thunder'].includes(kind);
  if (night) return wet ? 'rain_night' : 'clear_night'; // 還沒有夜晚多雲、夜晚下雪，先用晴朗的夜空
  if (wet) return 'rain';
  if (kind === 'snow') return 'snow';
  if (['cloudy', 'overcast', 'fog'].includes(kind)) return 'cloudy';
  return 'clear';
}
// 像素女孩的表情（art/tools/pixel_faces.py）：日記的 10 種心情各一張「只有臉」的圖，站著時疊在正面的頭上
const PIX_FACES = ['happy', 'excited', 'calm', 'moved', 'love', 'tired', 'sad', 'angry', 'nervous', 'miss'];
const pixParts = (hair, cloth, view) => [`body_${cloth}_${view}`, `head_${hair}_${view === 'front' ? 'front' : 'side'}`];
export function lookLayers(look, face = 'smile', emo = null) {
  const l = normalizeLook(look);
  if (l.style === 'pixel') return [...pixParts(l.hair, l.cloth, 'front'), PIX_FACES.includes(emo) && `face_${emo}`].filter(Boolean).map(pixSrc);
  if (l.style === 'doll') return dollFrontParts(l.hair, l.cloth).filter(Boolean).map((f) => `${BASE}doll/front/${f}.webp`);
  return [
    l.hair && `hair_${l.hair}_back`, 'body', l.cloth && `cloth_${l.cloth}`, `face_${face}`, l.hair && `hair_${l.hair}_front`, SYM[face] && `sym_${face}`,
  ].filter(Boolean).map((f) => `${BASE}char/${f}.webp`);
}
// 一般 HTML 用的小人（捏小人、我的頁面）：一疊 <img>
export function lookHtml(look, face = 'smile', cls = 'look', emo = null) {
  const box = document.createElement('div');
  const style = normalizeLook(look).style;
  box.className = style === 'classic' ? cls : `${cls} ${style}`;
  for (const src of lookLayers(look, face, emo)) { const img = document.createElement('img'); img.src = src; img.alt = ''; box.append(img); }
  return box;
}

// ---- 地板座標：u 沿右牆往右下、v 沿左牆往左下，0~1 ----
const O = [763, 348], EU = [674, 352], EV = [-658, 320];
const DET = EU[0] * EV[1] - EV[0] * EU[1];
const toXY = (u, v) => [O[0] + u * EU[0] + v * EV[0], O[1] + u * EU[1] + v * EV[1]];
const toUV = (x, y) => { const dx = x - O[0], dy = y - O[1]; return [(dx * EV[1] - dy * EV[0]) / DET, (EU[0] * dy - EU[1] * dx) / DET]; };
// 家具佔的地方（u0, u1, v0, v1）
// 床、書架、書桌＋椅子、大盆栽、電視櫃（地毯可以走過去）
const BLOCKS = [[0, .27, .22, .87], [0, .1, .84, 1], [0, .37, 0, .25], [.38, .49, 0, .17], [.5, .83, 0, .21]];
const MIN = .03, MAX = .97, PAD = .015;
// 生活印記放在地板上的家具（圓形，[u, v, r]），房間 update 時換
let EXTRA = [];
const free = (u, v) => u >= MIN && u <= MAX && v >= MIN && v <= MAX
  && !BLOCKS.some(([u0, u1, v0, v1]) => u > u0 - PAD && u < u1 + PAD && v > v0 - PAD && v < v1 + PAD)
  && !EXTRA.some(([cu, cv, r]) => (u - cu) ** 2 + (v - cv) ** 2 < (r + PAD) ** 2);
const N = 48;
function nearestFree(u, v) {
  if (free(u, v)) return [u, v];
  let best = [.5, .6], bd = 1e9;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const a = i / N, b = j / N; if (!free(a, b)) continue;
    const d = (a - u) ** 2 + (b - v) ** 2; if (d < bd) { bd = d; best = [a, b]; }
  }
  return best;
}
const clear = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * N * 2) + 1; for (let i = 0; i <= n; i++) { const t = i / n; if (!free(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; } return true; };
// 格子 A*，再把能直接走到的點拉直
function findPath(start, goal) {
  if (clear(start, goal)) return [goal];
  const cell = (u, v) => [Math.round(u * N), Math.round(v * N)];
  const [si, sj] = cell(...start), [gi, gj] = cell(...goal);
  const key = (i, j) => i * (N + 1) + j;
  const open = [[si, sj]], g = new Map([[key(si, sj), 0]]), came = new Map();
  const h = (i, j) => Math.hypot(i - gi, j - gj);
  while (open.length) {
    open.sort((a, b) => (g.get(key(...a)) + h(...a)) - (g.get(key(...b)) + h(...b)));
    const [i, j] = open.shift();
    if (i === gi && j === gj) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni > N || nj > N || !free(ni / N, nj / N)) continue;
      const ng = g.get(key(i, j)) + Math.hypot(di, dj);
      if (ng < (g.get(key(ni, nj)) ?? 1e9)) { g.set(key(ni, nj), ng); came.set(key(ni, nj), [i, j]); if (!open.some(([a, b]) => a === ni && b === nj)) open.push([ni, nj]); }
    }
  }
  if (!came.has(key(gi, gj))) return [goal];
  const cells = []; let c = [gi, gj];
  while (c && !(c[0] === si && c[1] === sj)) { cells.unshift([c[0] / N, c[1] / N]); c = came.get(key(...c)); }
  cells[cells.length - 1] = goal;
  const out = []; let from = start, k = 0;
  while (k < cells.length) { let far = k; for (let t = cells.length - 1; t > k; t--) if (clear(from, cells[t])) { far = t; break; } out.push(cells[far]); from = cells[far]; k = far + 1; }
  return out;
}
const star = (cx, cy, r) => `M${cx},${cy - r} Q${cx},${cy} ${cx + r},${cy} Q${cx},${cy} ${cx},${cy + r} Q${cx},${cy} ${cx - r},${cy} Q${cx},${cy} ${cx},${cy - r} Z`;
const clock = () => new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

// 記一筆之後小人說的話：用玩家自己的口吻（使用者定案的台詞）
export const MOOD_LINES = {
  happy: ['耶！今天超讚 (๑˃ᴗ˂)ﻭ', '嘿嘿，今天過得不錯！', '這一刻要好好收藏！'],
  excited: ['耶！好興奮呀！', '想跟全世界說！', '今天是我的主場 (ﾉ>ω<)ﾉ'],
  calm: ['平平淡淡也很好 ( ˘͈ ᵕ ˘͈♡)', '沒什麼特別的，但我喜歡！', '慢慢來～慢慢來～'],
  moved: ['感動的時刻，可以記很久！', '心裡暖暖的 ( ´•̥̥̥ω•̥̥̥` )', '被溫柔對待了'],
  love: ['心跳偷偷加速 …♡', '一直想到那個人 (⁄ ⁄•⁄ω⁄•⁄ ⁄)', '今天有粉紅泡泡 …♡'],
  tired: ['電量剩 1%', '想直接躺平 (¦3[▓▓]', '好想睡 (´-ωก`)'],
  sad: ['今天有點難過', '想一個人靜靜 (っ◞‸◟c)', '沒關係，會好起來的！'],
  angry: ['哼哼哼 (╬ Ò﹏Ó)', '吸氣…吐氣…'],
  nervous: ['等等！我還沒準備好！(⊙_⊙;)', '腦袋空白...', '拜託，要順利啊～～～'],
  miss: ['好想你！', '不知道你現在在做什麼呢', '如果能見一面就好了'],
};
const QUIET_MOODS = new Set(['tired', 'sad', 'angry', 'nervous', 'miss']);

export class Room {
  // box：放房間的元素（裡面會建 svg 和泡泡）；on：點了東西要做的事 { diary, calendar, tv, letter, shelf, door, plant, photos }
  constructor(box, on = {}) {
    this.box = box;
    this.on = on;
    this.state = { look: DEFAULT_LOOK, emo: null, weather: null, companions: [], pets: [], flowers: [], items: [] };
    this.me = { u: .5, v: .62, dir: 1, path: [], then: null, asleep: false };
    this.face = 'smile';
    const svg = this.svg = el('svg', { class: 'room-svg', viewBox: VIEW.join(' '), preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': '我的房間：點地板走路，點東西互動' }, box);
    const defs = el('defs', {}, svg);
    const rg = el('radialGradient', { id: 'room-glow' }, defs);
    el('stop', { offset: 0, 'stop-color': '#fff3b0', 'stop-opacity': .75 }, rg); el('stop', { offset: 1, 'stop-color': '#fff3b0', 'stop-opacity': 0 }, rg);
    el('image', { href: `${BASE}pixel_room/room.webp`, x: 0, y: 0, width: W, height: H, style: 'image-rendering:pixelated' }, svg);
    // 晚上換成夜晚的房間（art/tools/room_night.py，檯燈亮著）；第一次天黑才載入
    this.nightRoom = el('image', { x: 0, y: 0, width: W, height: H, style: 'image-rendering:pixelated', class: 'room-fade', opacity: 0 }, svg);
    const [wx, wy, ww, wh] = WINDOW_BOX;
    this.window = el('image', { x: wx, y: wy, width: ww, height: wh, style: 'image-rendering:pixelated', display: 'none' }, svg);
    setInterval(() => this.showWindow(), 60000); // 天黑、天亮時換窗外
    this.tvOn = el('image', { href: `${BASE}pixel_room/tv_on.webp`, x: 1040, y: 405, width: 140, height: 145, class: 'room-fade', opacity: 0 }, svg);
    this.lamp = el('circle', { cx: 860, cy: 290, r: 120, fill: 'url(#room-glow)', class: 'room-fade', opacity: 0 }, svg);
    this.itemsG = el('g', { class: 'room-items room-nohit' }, svg);
    this.itemKeys = '';
    this.markers = el('g', {}, svg);
    this.hots = el('g', {}, svg);
    this.fx = el('g', { class: 'room-nohit' }, svg);
    this.dark = el('rect', { x: -2000, y: -2000, width: W + 4000, height: H + 4000, fill: '#1c1f4a', opacity: 0, class: 'room-fade room-night' }, svg); // 晚上關檯燈
    this.night = el('rect', { x: -2000, y: -2000, width: W + 4000, height: H + 4000, fill: '#2c2f6b', opacity: 0, class: 'room-fade room-night' }, svg);
    // 小人
    this.meG = el('g', { id: 'room-me', class: 'room-me' }, svg);
    this.pose = el('g', { class: 'idle' }, this.meG);
    const bob = el('g', { class: 'bodybob' }, this.pose);
    el('ellipse', { cx: 0, cy: -2, rx: 52, ry: 13, fill: 'rgba(160,70,100,.16)' }, bob);
    const body = el('g', { transform: `scale(${320 / CHAR_H}) translate(${-FOOT[0]},${-FOOT[1]})` }, bob);
    this.classic = body;
    this.layers = ['hair-back', 'body', 'cloth', 'face', 'hair-front', 'sym'].map((k) => el('image', { id: `l-${k}`, width: CHAR_W, height: CHAR_H }, body));
    // 復古娃娃：手腳各在自己的 <g>，走路時由 tick() 轉
    this.doll = el('g', { transform: `scale(${DOLL_SIZE / DOLL_H}) translate(${-DOLL_FOOT[0]},${-DOLL_FOOT[1]})` }, bob);
    this.dollHair = {};
    this.joints = {};
    const dollImg = (name, parent) => el('image', { href: `${BASE}doll/${name}.webp`, width: DOLL_W, height: DOLL_H }, parent);
    const joint = (j) => { this.joints[j] = el('g', { class: `doll-${j}` }, this.doll); this.dollBody[j] = dollImg(j, this.joints[j]); };
    this.dollBody = {};
    this.dollHair.back = dollImg('hair_long_back', this.doll);
    joint('arm_f'); joint('leg_f'); joint('leg_n');
    this.dollBody.body = dollImg('body', this.doll);
    this.dollFace = dollImg('body', this.doll);
    this.dollFace.style.display = 'none';
    this.dollHair.front = dollImg('hair_long_front', this.doll);
    joint('arm_n');
    this.stride = 0;
    // 正面：站著的時候顯示；外面那層抵銷整個小人的左右翻面，正面永遠不翻
    this.dollFrontFlip = el('g', {}, bob);
    this.dollFront = el('g', { transform: `scale(${DOLL_SIZE / DOLL_H}) translate(${-FRONT_FOOT[0]},${-FRONT_FOOT[1]})` }, this.dollFrontFlip);
    this.frontImgs = ['hair-back', 'body', 'hair-front'].map((k) => el('image', { class: `front-${k}`, width: FRONT_W, height: DOLL_H }, this.dollFront));
    // 像素女孩：外層抵銷左右翻面（站著的正面不翻），裡面兩張圖（身體、頭）
    this.pixFlip = el('g', { class: 'pix' }, bob);
    const pix = el('g', { transform: `scale(${PIX_SIZE / PIX_H}) translate(${-PIX_FOOT[0]},${-PIX_FOOT[1]})` }, this.pixFlip);
    this.pixG = pix; this.pixImgs = {}; this.pixKey = '';
    this.pixT = 0;
    this.walking = false;
    // 泡泡（HTML，字比較清楚）
    this.bubble = document.createElement('div');
    this.bubble.id = 'scene-bubble';
    this.bubble.className = 'scene-bubble';
    this.bubble.setAttribute('role', 'status');
    box.append(this.bubble);

    this.bindHots();
    svg.addEventListener('click', (e) => this.onFloor(e));
    this.meG.addEventListener('click', (e) => { e.stopPropagation(); if (this.me.asleep) { this.wake(); return; } this.poke(); });
    this.dress();
    this.place();
  }

  // 跟舊場景一樣的介面：app.js 每次 render 會呼叫
  update(partial) {
    this.state = { ...this.state, ...partial };
    const st = this.state;
    const face = faceFor(st.emo);
    if (face !== this.face && !this.faceTimer) { this.face = face; }
    this.dress();
    this.showWindow();
    this.placeItems(st.imprints || []);
    // 讓測試和樣式知道目前狀態
    Object.assign(this.box.dataset, {
      weather: st.weather ? st.weather.kind : 'none', emo: st.emo || 'none', companions: String((st.companions || []).slice(0, 3).length),
      pets: String((st.pets || []).length), flowers: String((st.flowers || []).length), items: (st.items || []).join(' '),
      look: `${normalizeLook(st.look).hair}/${normalizeLook(st.look).cloth}`, face: this.face, style: normalizeLook(st.look).style,
    });
  }
  showWindow() {
    const v = windowView(this.state.weather);
    if (v === this.box.dataset.window) return;
    this.box.dataset.window = v;
    const night = v.endsWith('_night');
    if (night !== (this.box.dataset.light === 'night')) {
      this.box.dataset.light = night ? 'night' : 'day';
      if (night && !this.nightRoom.getAttribute('href')) this.nightRoom.setAttribute('href', `${BASE}pixel_room/room_night.webp`);
      this.nightRoom.setAttribute('opacity', night ? 1 : 0);
      this.lampOn = night; this.showLamp(); // 天黑時檯燈是亮著的
    }
    if (v === 'clear') { this.window.setAttribute('display', 'none'); return; }
    this.window.setAttribute('href', `${BASE}pixel_room/window_${v}.webp`);
    this.window.removeAttribute('display');
  }
  // 白天：檯燈旁邊一圈光；晚上：夜晚房間本身就有檯燈的光，關燈時整間暗下來
  showLamp() {
    const night = this.box.dataset.light === 'night';
    this.lamp.setAttribute('opacity', this.lampOn && !night ? 1 : 0);
    this.dark.setAttribute('opacity', !this.lampOn && night ? .4 : 0);
    this.box.dataset.lamp = this.lampOn ? 'on' : 'off';
  }
  // 生活印記的家具：照 z 疊，地板上的會擋路（小人剛好站在那裡就挪開）
  placeItems(keys) {
    const list = keys.filter((k) => IMPRINTS[k]).sort((a, b) => IMPRINTS[a].z - IMPRINTS[b].z);
    if (list.join() === this.itemKeys) return;
    this.itemKeys = list.join();
    this.itemsG.replaceChildren();
    EXTRA = [];
    for (const k of list) {
      const it = IMPRINTS[k];
      el('image', { href: `${BASE}imprints/${k}.webp`, x: it.x - it.w / 2, y: it.y - it.h, width: it.w, height: it.h, 'data-imprint': k, style: 'image-rendering:pixelated' }, this.itemsG);
      if (it.r) EXTRA.push([...toUV(it.x, it.y - 20), it.r]);
    }
    this.box.dataset.imprints = list.join(' ');
    if (!free(this.me.u, this.me.v)) { [this.me.u, this.me.v] = nearestFree(this.me.u, this.me.v); this.place(); }
  }
  start() {}
  stop() {}
  resize() {}

  dress() {
    const srcs = lookLayers(this.state.look, this.face);
    const look = normalizeLook(this.state.look);
    const doll = look.style === 'doll';
    this.isDoll = doll;
    this.isPixel = look.style === 'pixel';
    this.showPose();
    this.classic.style.display = doll || this.isPixel ? 'none' : '';
    if (this.isPixel) return srcs;
    if (doll) {
      dollFrontParts(look.hair, look.cloth).forEach((f, i) => {
        const img = this.frontImgs[i];
        if (f) { const href = `${BASE}doll/front/${f}.webp`; if (img.getAttribute('href') !== href) img.setAttribute('href', href); img.style.display = ''; } else img.style.display = 'none';
      });
      for (const k of ['back', 'front']) {
        const img = this.dollHair[k];
        if (look.hair) { img.setAttribute('href', `${BASE}doll/hair_${look.hair}_${k}.webp`); img.style.display = ''; } else img.style.display = 'none';
      }
      const c = look.cloth ? `_${look.cloth}` : '';
      for (const [k, img] of Object.entries(this.dollBody)) { const href = `${BASE}doll/${k}${c}.webp`; if (img.getAttribute('href') !== href) img.setAttribute('href', href); }
      const f = dollFace(this.face);
      if (f) { this.dollFace.setAttribute('href', `${BASE}doll/${f}.webp`); this.dollFace.style.display = ''; } else this.dollFace.style.display = 'none';
      return srcs;
    }
    const want = { 'hair-back': look.hair && `hair_${look.hair}_back`, body: 'body', cloth: look.cloth && `cloth_${look.cloth}`, face: `face_${this.face}`, 'hair-front': look.hair && `hair_${look.hair}_front`, sym: SYM[this.face] && `sym_${this.face}` };
    this.layers.forEach((img) => {
      const f = want[img.id.slice(2)];
      if (f) { const href = `${BASE}char/${f}.webp`; if (img.getAttribute('href') !== href) img.setAttribute('href', href); img.style.display = ''; } else img.style.display = 'none';
    });
    return srcs;
  }
  // 暫時換一個表情（記完一筆時），過一下回到今天的心情
  feel(face, ms = 3000, emo = null) {
    clearTimeout(this.faceTimer);
    this.face = face; this.feelEmo = emo; this.dress();
    this.faceTimer = setTimeout(() => { this.faceTimer = null; this.face = faceFor(this.state.emo); this.feelEmo = null; this.dress(); this.box.dataset.face = this.face; }, ms);
    this.box.dataset.face = face;
  }

  // 復古娃娃：走路時是側面，停下來轉回正面
  showPose() {
    const side = this.isDoll && this.walking;
    this.doll.style.display = side ? '' : 'none';
    this.dollFrontFlip.style.display = this.isDoll && !this.walking ? '' : 'none';
    this.pixFlip.style.display = this.isPixel ? '' : 'none';
    if (this.isPixel) this.pixFrame();
    this.box.dataset.pose = this.isDoll || this.isPixel ? (this.walking ? 'side' : 'front') : 'classic';
  }
  // 像素女孩：站著＝正面；走路＝側面的頭＋第幾格身體
  // 每個姿勢的圖都先放好、只切換哪張看得到：換 href 的話 iPhone 有時新圖還沒畫出來，會變成側面的頭配正面的身體
  pixFrame() {
    const look = normalizeLook(this.state.look);
    const key = `${look.hair}|${look.cloth}`;
    if (this.pixKey !== key) {
      this.pixKey = key;
      const views = ['front', 'walk0', 'walk1', 'walk2', 'walk3'].map((v) => pixParts(look.hair, look.cloth, v));
      const bodies = views.map(([b]) => b), heads = [...new Set(views.map(([, h]) => h))];
      this.pixImgs = {};
      this.pixG.replaceChildren();
      for (const [k, list] of [['body', bodies], ['head', heads]]) {
        for (const f of list) this.pixImgs[f] = el('image', { class: `pix-${k}`, href: pixSrc(f), width: PIX_W, height: PIX_H, opacity: 0, style: 'image-rendering:pixelated' }, this.pixG);
      }
      this.pixFace = el('image', { class: 'pix-face', width: PIX_W, height: PIX_H, display: 'none', style: 'image-rendering:pixelated' }, this.pixG);
    }
    const view = this.walking ? `walk${Math.floor(this.pixT / PIX_FRAME) % 4}` : 'front';
    const want = new Set(pixParts(look.hair, look.cloth, view));
    for (const [f, img] of Object.entries(this.pixImgs)) {
      const on = want.has(f);
      if (img.classList.contains('on') !== on) { img.classList.toggle('on', on); img.setAttribute('opacity', on ? 1 : 0); }
    }
    this.pixFlip.setAttribute('transform', this.walking ? '' : `scale(${this.me.dir},1)`);
    this.showPixFace();
  }
  // 表情：剛記下的那則心情（feel 帶進來的），不然是今天的心情；走路是側面，不疊
  showPixFace() {
    if (!this.pixFace) return;
    const emo = this.feelEmo || this.state.emo;
    const show = PIX_FACES.includes(emo) && !this.walking;
    if (show) { const href = pixSrc(`face_${emo}`); if (this.pixFace.getAttribute('href') !== href) this.pixFace.setAttribute('href', href); }
    this.pixFace.setAttribute('display', show ? 'inline' : 'none');
    this.box.dataset.pixface = show ? emo : 'none';
  }
  place() {
    const [x, y] = toXY(this.me.u, this.me.v);
    this.meG.setAttribute('transform', `translate(${x},${y}) scale(${this.me.dir},1)`);
    this.dollFrontFlip.setAttribute('transform', `scale(${this.me.dir},1)`);
    if (this.isPixel && !this.walking) this.pixFlip.setAttribute('transform', `scale(${this.me.dir},1)`);
    if (this.bubble.classList.contains('show')) this.placeBubble();
  }
  walkTo(u, v, then) {
    if (this.me.asleep) this.wake();
    const goal = nearestFree(u, v);
    this.me.path = findPath([this.me.u, this.me.v], goal);
    this.me.then = then || null;
    this.pose.setAttribute('class', 'walking');
    this.walking = true; this.showPose();
    if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.tick(t)); }
  }
  tick(now) {
    const dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
    const me = this.me;
    if (me.path.length) {
      const [tu, tv] = me.path[0];
      const du = tu - me.u, dv = tv - me.v, d = Math.hypot(du, dv), step = .42 * dt;
      const x0 = toXY(me.u, me.v)[0], x1 = toXY(tu, tv)[0];
      if (Math.abs(x1 - x0) > .5) me.dir = x1 > x0 ? 1 : -1;
      if (d <= step) { me.u = tu; me.v = tv; me.path.shift(); } else { me.u += du / d * step; me.v += dv / d * step; }
      this.place();
      this.swing(dt);
    }
    if (me.path.length) { this.raf = requestAnimationFrame((t) => this.tick(t)); return; }
    this.raf = 0;
    this.stride = 0; this.swing(0, false);
    this.walking = false; this.showPose();
    this.pose.setAttribute('class', 'idle');
    this.markers.replaceChildren();
    const f = me.then; me.then = null; if (f) f();
  }
  // 復古娃娃走路：腳前後跨步；手只往不會露出縫的方向擺（近手往前蓋過身體、遠手往後躲到身體後面）
  // 停下來（walking＝false）就回到站姿
  swing(dt, walking = true) {
    this.pixT = walking ? this.pixT + dt : 0;
    if (this.isPixel && walking) this.pixFrame();
    this.stride += dt * 2.6;
    const s = Math.sin(this.stride * 2 * Math.PI);
    const ang = walking ? { leg_n: -15 * s, leg_f: 15 * s, arm_n: -9 * (1 - s), arm_f: 8 * (1 - s) } : { leg_n: 0, leg_f: 0, arm_n: 0, arm_f: 0 };
    for (const [j, g] of Object.entries(this.joints)) {
      const [x, y] = DOLL_JOINTS[j];
      g.setAttribute('transform', `rotate(${ang[j].toFixed(2)} ${x} ${y})`);
    }
  }
  onFloor(e) {
    if (this.me.asleep) { this.wake(); return; }
    const p = this.svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(this.svg.getScreenCTM().inverse());
    const [u, v] = toUV(q.x, q.y);
    if (u < -.05 || v < -.05 || u > 1.05 || v > 1.05) return;
    const goal = nearestFree(Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
    this.marker(...goal); this.walkTo(...goal);
  }
  marker(u, v) {
    this.markers.replaceChildren();
    const [x, y] = toXY(u, v);
    const g = el('g', { class: 'room-marker' }, this.markers);
    el('ellipse', { cx: x, cy: y, rx: 30, ry: 15, fill: 'none', stroke: '#ec7896', 'stroke-width': 6 }, g);
    el('ellipse', { cx: x, cy: y, rx: 14, ry: 7, fill: '#ec7896', opacity: .4 }, g);
  }

  // ---- 泡泡、特效 ----
  say(text, ms = 3000) {
    clearTimeout(this.bubbleTimer);
    this.bubble.textContent = text;
    this.bubble.classList.add('show');
    this.placeBubble();
    this.bubbleTimer = setTimeout(() => this.bubble.classList.remove('show'), ms);
  }
  placeBubble() {
    const box = this.box.getBoundingClientRect();
    const m = this.svg.getScreenCTM();
    if (!m || !box.width) return;
    let [x, y] = toXY(this.me.u, this.me.v);
    y -= (this.isDoll || this.isPixel ? DOLL_SIZE : 320) + 15;
    if (this.me.asleep) [x, y] = [380, 380];
    const p = this.svg.createSVGPoint(); p.x = x; p.y = y;
    const s = p.matrixTransform(m);
    const half = Math.min(110, this.bubble.offsetWidth / 2 || 60);
    this.bubble.style.left = `${Math.max(half + 6, Math.min(box.width - half - 6, s.x - box.left))}px`;
    this.bubble.style.top = `${Math.max(6, s.y - box.top - this.bubble.offsetHeight)}px`;
  }
  sparkle(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 50;
      const s = el('path', { d: star(x + Math.cos(a) * r, y + Math.sin(a) * r, 14 + Math.random() * 10), fill: i % 2 ? '#fff' : '#ffe58a', stroke: '#5b3a3e', 'stroke-width': 3, class: 'room-twinkle once', style: `animation-delay: ${i * .08}s` }, this.fx);
      setTimeout(() => s.remove(), 1600);
    }
  }
  // 點自己：跳一下、說句話（換裝在「我」分頁）
  poke() {
    this.jump();
    const lines = ['嗨！👋', '今天過得好嗎？', '要不要記一筆？📖', '我在這裡 ✨', '嘿嘿 😊'];
    this.say(lines[Math.floor(Math.random() * lines.length)], 2000);
  }
  jump() {
    if (this.pose.animate) this.pose.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-26px)' }, { transform: 'translateY(0)' }], { duration: 420, easing: 'ease-out' });
  }
  // 記下一筆時：換成那則的心情，小人用「我」的口吻說出心情（台詞見 MOOD_LINES）；低落的心情不跳、不冒星星
  celebrate({ emo = null, sad = false, text = null } = {}) {
    if (this.me.asleep) this.wake(true);
    const face = sad ? 'smile' : faceFor(emo || 'happy');
    this.feel(face, 3000, emo || (sad ? null : 'happy'));
    const low = sad || QUIET_MOODS.has(emo);
    if (!low) { this.jump(); this.sparkle(...toXY(this.me.u, this.me.v).map((n, i) => n - (i ? 180 : 0)), 8); }
    const lines = MOOD_LINES[emo];
    this.say(text || (sad ? '已經好好記下來了' : lines ? lines[Math.floor(Math.random() * lines.length)] : '記下來了！✨'), 3200);
  }

  // ---- 睡覺 ----
  sleep() {
    this.me.asleep = true; this.meG.style.display = 'none';
    this.night.setAttribute('opacity', .5);
    const z = () => { const t = el('text', { x: 360, y: 430, 'font-size': 56, 'font-weight': 900, fill: '#fff', stroke: '#5b3a3e', 'stroke-width': 4, 'paint-order': 'stroke', class: 'room-zz' }, this.fx); t.textContent = 'Z'; setTimeout(() => t.remove(), 1600); };
    z(); this.zz = setInterval(z, 600);
    this.say('晚安… 點一下叫醒我', 3000);
    this.box.dataset.actor = 'sleep';
  }
  wake(quiet = false) {
    if (!this.me.asleep) return;
    clearInterval(this.zz); this.me.asleep = false; this.meG.style.display = '';
    this.night.setAttribute('opacity', 0); this.place();
    this.box.dataset.actor = 'idle';
    if (!quiet) { this.say('早安！☀️'); this.jump(); }
  }

  // ---- 可以點的東西 ----
  bindHots() {
    const on = this.on;
    const HOTS = [
      { name: 'diary', label: '書桌上的日記本：記一筆', r: [725, 300, 120, 75], go: [.3, .3, -1], act: () => on.diary && on.diary(), spark: [790, 325] },
      { name: 'letter', label: '信：寫給未來的自己', r: [815, 345, 90, 55], go: [.33, .28, -1], act: () => on.letter && on.letter(), spark: [870, 360] },
      { name: 'calendar', label: '牆上的月曆：心情月曆', r: [1110, 275, 90, 165], go: [.68, .26, 1], act: () => on.calendar && on.calendar(), spark: [1180, 295] },
      { name: 'tv', label: '電視：那一年的世界', r: [1040, 400, 140, 130], go: [.62, .27, 1], act: () => { this.tvOn.setAttribute('opacity', 1); on.tv && on.tv(() => this.tvOn.setAttribute('opacity', 0)); }, spark: [1120, 420] },
      { name: 'lamp', label: '檯燈', r: [828, 238, 85, 120], go: [.33, .28, -1], act: () => { this.lampOn = !this.lampOn; this.showLamp(); this.say(this.lampOn ? '開燈 💡' : '關燈'); } },
      { name: 'bed', label: '床', r: [255, 390, 445, 300], go: [.31, .55, -1], act: () => this.sleep() },
      { name: 'clock', label: '時鐘', r: [1215, 315, 90, 100], act: () => this.say(`現在 ${clock()} ⏰`) },
      { name: 'window', label: '窗戶', r: [365, 190, 225, 240], act: () => { const w = this.state.weather; this.say(w ? `外面 ${w.icon} ${w.label} ${w.temp}°` : '今天天氣不錯 ☀️（設定裡可以打開真實天氣）'); } },
      { name: 'door', label: '門', r: [1305, 380, 105, 320], go: [.91, .13, 1], act: () => (on.door ? on.door() : this.say('其他房間還在裝潢中 🔨')) },
      { name: 'shelf', label: '書架：回憶', r: [100, 340, 165, 355], go: [.16, .93, -1], act: () => on.shelf && on.shelf() },
      { name: 'plant', label: '盆栽：心情花園', r: [915, 390, 110, 160], go: [.45, .25, 1], act: () => (on.plant ? on.plant() : this.say('澆水 💧')) },
      { name: 'photos', label: '牆上的照片', r: [925, 200, 165, 195], act: () => on.photos && on.photos() },
    ];
    for (const h of HOTS) {
      const [x, y, w, hh] = h.r;
      const node = el('rect', { x, y, width: w, height: hh, fill: 'transparent', class: 'hot', 'data-name': h.name, role: 'button', 'aria-label': h.label }, this.hots);
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.me.asleep && h.name !== 'bed') { this.wake(); return; }
        if (h.go && !this.instant) { const [u, v, dir] = h.go; this.marker(...nearestFree(u, v)); this.walkTo(u, v, () => { this.me.dir = dir; this.place(); h.act(); }); } else h.act();
      });
    }
    HOTS.filter((h) => h.spark).forEach((h, i) => el('path', { d: star(h.spark[0], h.spark[1], 16), fill: '#ffe58a', stroke: '#5b3a3e', 'stroke-width': 3, class: 'room-twinkle', style: `animation-delay: ${i * .55}s` }, this.fx));
    this.svg.append(this.meG);
  }
  // 走到某樣東西再做事（首頁按鈕用）
  go(name) { const n = this.hots.querySelector(`[data-name="${name}"]`); if (n) n.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
}
