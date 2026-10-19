// 試玩版：一間房間、會走路的小人、可以點的東西
import { chibi, CHARS, el } from './chibi.js';

const stage = document.getElementById('stage');
const IMG = 'bedroom.webp', W = 1536, H = 1024;
const DEBUG = location.search.includes('debug');

// ---- 地板座標：u 沿右牆往右下、v 沿左牆往左下，0~1 ----
const O = [780, 370], EU = [587, 294], EV = [-587, 294];
const toXY = (u, v) => [O[0] + u * EU[0] + v * EV[0], O[1] + u * EU[1] + v * EV[1]];
const toUV = (x, y) => { const dx = (x - O[0]) / 587, dy = (y - O[1]) / 294; return [(dx + dy) / 2, (dy - dx) / 2]; };

// 家具佔的地方（u0, u1, v0, v1）
const BLOCKS = {
  bed: [0, .24, 0, .33], nightstand: [.22, .33, 0, .1], desk: [.35, .67, 0, .15], chair: [.44, .57, .12, .25],
  vanity: [0, .24, .47, .8], plant: [0, .11, .8, 1], table: [.62, .86, .6, .84],
  cushionL: [.5, .59, .77, .9], cushionR: [.89, 1, .57, .69],
};
const MIN = .05, MAX = .96, PAD = .015;
const free = (u, v) => u >= MIN && u <= MAX && v >= MIN && v <= MAX
  && !Object.values(BLOCKS).some(([u0, u1, v0, v1]) => u > u0 - PAD && u < u1 + PAD && v > v0 - PAD && v < v1 + PAD);

// ---- 畫面圖層 ----
const defs = el('defs', {}, stage);
el('image', { href: IMG, x: 0, y: 0, width: W, height: H }, stage);
const lampGlow = el('circle', { cx: 900, cy: 370, r: 190, fill: 'url(#glow)', opacity: 0, style: 'transition: opacity .4s; pointer-events: none' }, stage);
{ const rg = el('radialGradient', { id: 'glow' }, defs); el('stop', { offset: 0, 'stop-color': '#fff3b0', 'stop-opacity': .75 }, rg); el('stop', { offset: 1, 'stop-color': '#fff3b0', 'stop-opacity': 0 }, rg); }
const markerLayer = el('g', {}, stage);
const meWrap = el('g', { id: 'me' }, stage);
// 擋在小人前面的家具：用同一張圖裁出來疊上去
const FRONTS = {
  table: { pts: '668,700 832,698 912,762 912,832 806,900 772,900 670,840', depth: 1.4 },
  cushionL: { pts: '552,742 610,732 664,758 664,800 616,812 556,792', depth: 1.3 },
  cushionR: { pts: '902,808 960,792 1022,820 1022,862 966,880 904,850', depth: 1.4 },
};
for (const [k, f] of Object.entries(FRONTS)) {
  const cp = el('clipPath', { id: `clip-${k}` }, defs); el('polygon', { points: f.pts }, cp);
  f.node = el('image', { href: IMG, x: 0, y: 0, width: W, height: H, 'clip-path': `url(#clip-${k})`, style: 'pointer-events: none' }, stage);
}
const fxLayer = el('g', { style: 'pointer-events: none' }, stage);
const night = el('rect', { x: -2000, y: -2000, width: W + 4000, height: H + 4000, fill: '#2c2f6b', opacity: 0, class: 'night', style: 'mix-blend-mode: multiply' }, stage);
const hotLayer = el('g', {}, stage);
const bubbleLayer = el('g', { style: 'pointer-events: none' }, stage);

if (DEBUG) {
  for (const [u0, u1, v0, v1] of Object.values(BLOCKS)) el('polygon', { points: [toXY(u0, v0), toXY(u1, v0), toXY(u1, v1), toXY(u0, v1)].map((p) => p.join(',')).join(' '), fill: 'rgba(255,0,0,.25)', stroke: 'red' }, stage);
  for (const f of Object.values(FRONTS)) el('polygon', { points: f.pts, fill: 'rgba(0,0,255,.2)', stroke: 'blue' }, stage);
  el('polygon', { points: [toXY(0, 0), toXY(1, 0), toXY(1, 1), toXY(0, 1)].map((p) => p.join(',')).join(' '), fill: 'none', stroke: 'lime', 'stroke-width': 3 }, stage);
}

// ---- 小人 ----
const SCALE = 1.35;
const me = { u: .5, v: .55, dir: 1, path: [], then: null, hidden: false };
const pose = el('g', { class: 'idle' }, meWrap);
const bob = el('g', { class: 'bodybob' }, pose);
chibi(bob, CHARS[0]);
function placeMe() {
  const [x, y] = toXY(me.u, me.v);
  meWrap.setAttribute('transform', `translate(${x},${y}) scale(${SCALE * me.dir},${SCALE})`);
  for (const f of Object.values(FRONTS)) f.node.style.display = me.u + me.v < f.depth ? '' : 'none';
  if (bubble) positionBubble();
}

// ---- 走路（格子 A*，再拉直） ----
const N = 48;
const cell = (u, v) => [Math.round(u * N), Math.round(v * N)];
function nearestFree(u, v) {
  if (free(u, v)) return [u, v];
  let best = null, bd = 1e9;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const a = i / N, b = j / N; if (!free(a, b)) continue;
    const d = (a - u) ** 2 + (b - v) ** 2; if (d < bd) { bd = d; best = [a, b]; }
  }
  return best;
}
const clear = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * N * 2) + 1; for (let i = 0; i <= n; i++) { const t = i / n; if (!free(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; } return true; };
function findPath(goal) {
  const start = [me.u, me.v];
  if (clear(start, goal)) return [goal];
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
  // 拉直：能直接走到的點就跳過中間
  const out = []; let from = start, k = 0;
  while (k < cells.length) { let far = k; for (let t = cells.length - 1; t > k; t--) if (clear(from, cells[t])) { far = t; break; } out.push(cells[far]); from = cells[far]; k = far + 1; }
  return out;
}
function walkTo(u, v, then) {
  if (me.hidden) wake();
  const goal = nearestFree(u, v);
  me.path = findPath(goal); me.then = then || null;
  pose.setAttribute('class', 'walking');
}
let last = performance.now();
function tick(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (me.path.length) {
    const [tu, tv] = me.path[0];
    const du = tu - me.u, dv = tv - me.v, d = Math.hypot(du, dv), step = .42 * dt;
    const [x0] = toXY(me.u, me.v), [x1] = toXY(tu, tv);
    if (Math.abs(x1 - x0) > .5) me.dir = x1 > x0 ? 1 : -1;
    if (d <= step) { me.u = tu; me.v = tv; me.path.shift(); } else { me.u += du / d * step; me.v += dv / d * step; }
    if (!me.path.length) { pose.setAttribute('class', 'idle'); clearMarker(); const f = me.then; me.then = null; if (f) f(); }
    placeMe();
  }
  requestAnimationFrame(tick);
}

// ---- 地板標記、對話泡泡、特效 ----
function showMarker(u, v) {
  clearMarker();
  const [x, y] = toXY(u, v);
  const g = el('g', { class: 'marker' }, markerLayer);
  el('ellipse', { cx: x, cy: y, rx: 30, ry: 15, fill: 'none', stroke: '#f0708f', 'stroke-width': 6 }, g);
  el('ellipse', { cx: x, cy: y, rx: 14, ry: 7, fill: '#f0708f', opacity: .45 }, g);
  el('path', { d: `M${x},${y - 10} l-22,-28 h13 v-28 h18 v28 h13 z`, fill: '#ffe58a', stroke: '#5b3a3e', 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
}
const clearMarker = () => markerLayer.replaceChildren();
let bubble = null, bubbleTimer = 0;
function say(text, ms = 2600) {
  bubbleLayer.replaceChildren(); clearTimeout(bubbleTimer);
  const g = el('g', { class: 'pop' }, bubbleLayer);
  const r = el('rect', { rx: 26, fill: '#fff', stroke: '#5b3a3e', 'stroke-width': 5 }, g);
  const tail = el('path', { fill: '#fff', stroke: '#5b3a3e', 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
  const t = el('text', { 'font-size': 40, 'font-weight': 700, fill: '#5b3a3e', 'font-family': '-apple-system, "PingFang TC", sans-serif' }, g);
  t.textContent = text;
  const w = t.getComputedTextLength() + 52;
  bubble = { g, r, tail, t, w };
  positionBubble();
  bubbleTimer = setTimeout(() => { bubbleLayer.replaceChildren(); bubble = null; }, ms);
}
function positionBubble() {
  const { r, tail, t, w } = bubble;
  let [x, y] = toXY(me.u, me.v); y -= 112 * SCALE + 40;
  if (me.hidden) [x, y] = [740, 230];
  const bx = Math.max(160, Math.min(1380 - w, x - w / 2)), by = y - 76;
  r.setAttribute('x', bx); r.setAttribute('y', by); r.setAttribute('width', w); r.setAttribute('height', 70);
  t.setAttribute('x', bx + 26); t.setAttribute('y', by + 49);
  tail.setAttribute('d', `M${x - 14},${by + 66} L${x},${by + 92} L${x + 14},${by + 66}`);
}
function sparkle(x, y, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 50;
    const s = el('path', { d: star(x + Math.cos(a) * r, y + Math.sin(a) * r, 14 + Math.random() * 10), fill: i % 2 ? '#fff' : '#ffe58a', stroke: '#5b3a3e', 'stroke-width': 3, class: 'twinkle', style: `animation-iteration-count: 1; animation-duration: 1.2s; animation-delay: ${i * .08}s; opacity: 0` }, fxLayer);
    setTimeout(() => s.remove(), 1600);
  }
}
const star = (cx, cy, r) => `M${cx},${cy - r} Q${cx},${cy} ${cx + r},${cy} Q${cx},${cy} ${cx},${cy + r} Q${cx},${cy} ${cx - r},${cy} Q${cx},${cy} ${cx},${cy - r} Z`;
function jump() {
  pose.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-26px)' }, { transform: 'translateY(0)' }], { duration: 420, easing: 'ease-out' });
}

// ---- 睡覺 ----
let zzTimer = 0;
function sleep() {
  me.hidden = true; meWrap.style.display = 'none';
  night.setAttribute('opacity', .5);
  const z = () => { const t = el('text', { x: 760, y: 330, 'font-size': 56, 'font-weight': 900, fill: '#fff', stroke: '#5b3a3e', 'stroke-width': 4, 'paint-order': 'stroke', class: 'zz' }, fxLayer); t.textContent = 'Z'; setTimeout(() => t.remove(), 1600); };
  z(); zzTimer = setInterval(z, 600);
  say('晚安… 點一下叫醒我', 3000);
}
function wake() {
  if (!me.hidden) return;
  clearInterval(zzTimer); me.hidden = false; meWrap.style.display = '';
  night.setAttribute('opacity', 0); placeMe(); say('早安！☀️'); jump();
}

// ---- 面板 ----
const sheet = document.getElementById('sheet'), scrim = document.getElementById('scrim');
function openSheet(title, body) {
  document.getElementById('sheet-title').textContent = title;
  const b = document.getElementById('sheet-body'); b.replaceChildren(); body(b);
  sheet.classList.add('open'); scrim.classList.add('open');
}
function closeSheet() { sheet.classList.remove('open'); scrim.classList.remove('open'); document.activeElement?.blur(); }
document.getElementById('sheet-x').onclick = closeSheet; scrim.onclick = closeSheet;
const html = (tag, attrs = {}, text = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (text) e.textContent = text; return e; };

function compose() {
  openSheet('✏️ 記一筆', (b) => {
    const ta = html('textarea', { placeholder: '今天發生了什麼？一句話就好' });
    const btn = html('div', { className: 'rec' }, '記下來');
    btn.onclick = () => {
      const text = ta.value.trim(); if (!text) { ta.focus(); return; }
      closeSheet();
      document.getElementById('today-card').innerHTML = '<small>今天</small>';
      document.getElementById('today-card').append(text);
      setTimeout(() => { jump(); say('記下來了！✨'); sparkle(1070, 470, 8); }, 300);
    };
    b.append(ta, btn); setTimeout(() => ta.focus(), 250);
  });
}
function calendar() {
  const moods = ['😊', '😌', '🥰', '😪', '🤩', '😢', '😊', '', '😌', '😊'];
  openSheet('📅 十月的心情', (b) => {
    const g = html('div', { className: 'cal' });
    '日一二三四五六'.split('').forEach((d) => g.append(html('b', {}, d)));
    for (let i = 0; i < 4; i++) g.append(html('span'));
    const today = new Date().getDate();
    for (let d = 1; d <= 31; d++) { const s = html('span', {}, d < today ? moods[(d * 7) % moods.length] || '·' : d === today ? '✏️' : ''); if (d === today) s.className = 'today'; g.append(s); }
    b.append(g, html('p', { style: 'font-size:13px;color:#b07f8c;margin:10px 2px 0' }, '試玩版：之後接上你真的心情紀錄'));
  });
}
function rooms() {
  openSheet('🚪 要去哪裡？', (b) => {
    for (const r of ['🛋️ 客廳', '🍳 廚房', '🛁 浴室', '🌳 屋外']) {
      const d = html('div', { className: 'card', style: 'margin-bottom:8px;cursor:pointer' }, `${r}　（還在蓋）`);
      d.onclick = () => { closeSheet(); say('那邊還在裝潢中 🔨'); };
      b.append(d);
    }
  });
}

// ---- 可以點的東西 ----
const now = () => new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
const HOTS = [
  { name: 'calendar', r: [995, 205, 100, 180], go: [.4, .3, 1], act: calendar, spark: [1045, 230] },
  { name: 'desk', r: [980, 355, 140, 160], go: [.62, .21, 1], act: compose, spark: [1080, 470] },
  { name: 'lamp', r: [862, 322, 76, 84], go: [.29, .16, 1], act: () => { const on = lampGlow.getAttribute('opacity') !== '1'; lampGlow.setAttribute('opacity', on ? 1 : 0); say(on ? '開燈 💡' : '關燈'); } },
  { name: 'bed', r: [575, 280, 285, 250], go: [.28, .22, -1], act: sleep, spark: [800, 330] },
  { name: 'clock', r: [850, 148, 70, 76], act: () => say(`現在 ${now()} ⏰`) },
  { name: 'window', r: [430, 150, 215, 285], act: () => say('今天天氣很好 ☀️ 23°') },
  { name: 'door', r: [1188, 305, 160, 380], go: [.88, .09, 1], act: rooms, spark: [1270, 420] },
  { name: 'mirror', r: [296, 408, 100, 140], go: [.28, .64, -1], act: () => { say('今天也很可愛 💕'); sparkle(345, 470); } },
  { name: 'poster', r: [292, 265, 118, 160], act: () => say('我最喜歡的漫畫！') },
  { name: 'plant', r: [200, 515, 98, 160], go: [.17, .88, -1], act: () => { say('澆水 💧 長大一點了'); sparkle(250, 560, 5); } },
  { name: 'memory', r: [760, 735, 85, 75], go: [.75, .9, -1], act: () => say('3 年前的今天：第一次煮咖哩 🍛', 3200), spark: [800, 770] },
  { name: 'photos', r: [652, 182, 72, 104], act: () => say('之後這裡會放你的照片 📷') },
  { name: 'photos2', r: [890, 232, 92, 108], act: () => say('之後這裡會放你的照片 📷') },
];
for (const h of HOTS) {
  const [x, y, w, hh] = h.r;
  const node = el('rect', { x, y, width: w, height: hh, fill: DEBUG ? 'rgba(0,200,0,.2)' : 'transparent', class: 'hot' }, hotLayer);
  node.addEventListener('click', (e) => {
    e.stopPropagation(); hideHint();
    if (me.hidden && h.name !== 'bed') { wake(); return; }
    if (h.go) { const [u, v, dir] = h.go; showMarker(...nearestFree(u, v)); walkTo(u, v, () => { me.dir = dir; placeMe(); h.act(); }); } else h.act();
  });
}
// 會閃的提示
HOTS.filter((h) => h.spark).forEach((h, i) => el('path', { d: star(h.spark[0], h.spark[1], 16), fill: '#ffe58a', stroke: '#5b3a3e', 'stroke-width': 3, class: 'twinkle', style: `animation-delay: ${i * .55}s` }, fxLayer));

// ---- 點地板 ----
stage.addEventListener('click', (e) => {
  hideHint();
  if (me.hidden) { wake(); return; }
  const p = stage.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  const q = p.matrixTransform(stage.getScreenCTM().inverse());
  const [u, v] = toUV(q.x, q.y);
  if (u < -.05 || v < -.05 || u > 1.05 || v > 1.05) return;
  const goal = nearestFree(Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
  showMarker(...goal); walkTo(...goal);
});
document.getElementById('rec-btn').onclick = () => { hideHint(); const h = HOTS[1]; walkTo(h.go[0], h.go[1], () => { me.dir = 1; placeMe(); compose(); }); };
const hint = document.getElementById('hint');
function hideHint() { hint.style.opacity = 0; }

placeMe();
requestAnimationFrame(tick);
setTimeout(() => say('歡迎來我的房間！'), 600);
