import * as data from './data.js';
// 試玩版：一間房間、會走路的小人、可以點的東西
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (parent) parent.append(e); return e; };

const stage = document.getElementById('stage');
const IMG = 'room.webp', W = 1536, H = 1024;
const DEBUG = location.search.includes('debug');

// ---- 地板座標：u 沿右牆往右下、v 沿左牆往左下，0~1 ----
const O = [769, 303], EU = [636, 365], EV = [-597, 327];
const DET = EU[0] * EV[1] - EV[0] * EU[1];
const toXY = (u, v) => [O[0] + u * EU[0] + v * EV[0], O[1] + u * EU[1] + v * EV[1]];
const toUV = (x, y) => { const dx = x - O[0], dy = y - O[1]; return [(dx * EV[1] - dy * EV[0]) / DET, (EU[0] * dy - EU[1] * dx) / DET]; };

// 家具佔的地方（u0, u1, v0, v1）
const BLOCKS = {
  shelf: [0, .13, .7, 1], bed: [0, .24, .18, .7], nightstand: [.2, .33, 0, .24], deskchair: [.34, .58, 0, .32],
  tv: [.58, .84, 0, .18], stool: [.84, 1, .04, .23], back: [0, 1, 0, .1],
};
const MIN = .03, MAX = .97, PAD = .015;
const free = (u, v) => u >= MIN && u <= MAX && v >= MIN && v <= MAX
  && !Object.values(BLOCKS).some(([u0, u1, v0, v1]) => u > u0 - PAD && u < u1 + PAD && v > v0 - PAD && v < v1 + PAD);

// ---- 畫面圖層 ----
const defs = el('defs', {}, stage);
el('image', { href: IMG, x: 0, y: 0, width: W, height: H }, stage);
const tvOn = el('image', { href: 'tv_on.webp', x: 1095, y: 400, width: 120, height: 120, opacity: 0, style: 'transition: opacity .3s; pointer-events: none' }, stage);
const lampGlow = el('circle', { cx: 778, cy: 345, r: 130, fill: 'url(#glow)', opacity: 0, style: 'transition: opacity .4s; pointer-events: none' }, stage);
{ const rg = el('radialGradient', { id: 'glow' }, defs); el('stop', { offset: 0, 'stop-color': '#fff3b0', 'stop-opacity': .75 }, rg); el('stop', { offset: 1, 'stop-color': '#fff3b0', 'stop-opacity': 0 }, rg); }
const markerLayer = el('g', {}, stage);
const meWrap = el('g', { id: 'me' }, stage);
// 擋在小人前面的家具：用同一張圖裁出來疊上去
const FRONTS = {};
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
// 圖層：後髮 → 身體 → 衣服 → 五官 → 前髮 → 表情符號；圖 267×420，腳底在 (108.8, 418.6)
const CH = 285, SCALE = CH / 420, FOOT = [108.8, 418.6];
const me = { u: .5, v: .6, dir: 1, path: [], then: null, hidden: false, cloth: 'tee', expr: 'smile', hair: 'ponytail' };
const pose = el('g', { class: 'idle' }, meWrap);
const bob = el('g', { class: 'bodybob' }, pose);
el('ellipse', { cx: 0, cy: -2, rx: 52, ry: 13, fill: 'rgba(160,70,100,.18)' }, bob);
const body = el('g', { transform: `scale(${SCALE}) translate(${-FOOT[0]},${-FOOT[1]})` }, bob);
const layer = (id) => el('image', { id, width: 267, height: 420 }, body);
const L = { hairBack: layer('l-hair-back'), body: layer('l-body'), cloth: layer('l-cloth'), face: layer('l-face'), hairFront: layer('l-hair-front'), sym: layer('l-sym') };
const SYM = { angry: true };
function dressMe() {
  const set = (n, f) => { if (f) { n.setAttribute('href', `char/${f}.webp`); n.style.display = ''; } else n.style.display = 'none'; };
  set(L.hairBack, me.hair && `hair_${me.hair}_back`);
  set(L.body, 'body');
  set(L.cloth, me.cloth && `cloth_${me.cloth}`);
  set(L.face, `face_${me.expr}`);
  set(L.hairFront, me.hair && `hair_${me.hair}_front`);
  set(L.sym, SYM[me.expr] && `sym_${me.expr}`);
}
let exprTimer = 0;
function feel(expr, ms = 2500) { clearTimeout(exprTimer); me.expr = expr; dressMe(); if (ms) exprTimer = setTimeout(() => { me.expr = 'smile'; dressMe(); }, ms); }
dressMe();
function placeMe() {
  const [x, y] = toXY(me.u, me.v);
  meWrap.setAttribute('transform', `translate(${x},${y}) scale(${me.dir},1)`);
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
  let [x, y] = toXY(me.u, me.v); y -= CH + 30;
  if (me.hidden) [x, y] = [560, 260];
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
  const z = () => { const t = el('text', { x: 560, y: 360, 'font-size': 56, 'font-weight': 900, fill: '#fff', stroke: '#5b3a3e', 'stroke-width': 4, 'paint-order': 'stroke', class: 'zz' }, fxLayer); t.textContent = 'Z'; setTimeout(() => t.remove(), 1600); };
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
let sheetClosed = null;
function closeSheet() { sheet.classList.remove('open'); scrim.classList.remove('open'); document.activeElement?.blur(); if (sheetClosed) { const f = sheetClosed; sheetClosed = null; f(); } }
document.getElementById('sheet-x').onclick = closeSheet; scrim.onclick = closeSheet;
const html = (tag, attrs = {}, text = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (text) e.textContent = text; return e; };

function compose() {
  openSheet('✏️ 記一筆', (b) => {
    const ta = html('textarea', { placeholder: '今天發生了什麼？一句話就好' });
    const btn = html('div', { className: 'rec' }, '記下來');
    btn.onclick = () => {
      const text = ta.value.trim(); if (!text) { ta.focus(); return; }
      closeSheet();
      data.addMoment(text).then((emo) => {
        renderCards(text);
        const face = EMO_FACE[emo] || 'happy';
        setTimeout(() => { feel(face, 3000); if (face !== 'angry') jump(); say(face === 'angry' ? '記下來了，氣消一點了嗎？' : '記下來了！✨'); sparkle(950, 400, 8); }, 300);
      });
    };
    b.append(ta, btn); setTimeout(() => ta.focus(), 250);
  });
}
function calendar() {
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth() + 1, today = now.getDate();
  const moods = data.monthMoods(y, mo);
  openSheet(`📅 ${mo} 月的心情`, (b) => {
    const g = html('div', { className: 'cal' });
    '日一二三四五六'.split('').forEach((d) => g.append(html('b', {}, d)));
    for (let i = 0; i < new Date(y, mo - 1, 1).getDay(); i++) g.append(html('span', { style: 'background:none' }));
    for (let d = 1; d <= new Date(y, mo, 0).getDate(); d++) {
      const s = html('span', { title: `${mo}/${d}` }, moods[d] || (d < today ? '·' : d === today ? '✏️' : ''));
      if (d === today) s.className = 'today';
      g.append(s);
    }
    const n = Object.keys(moods).length;
    b.append(g, html('p', { style: 'font-size:13px;color:#b07f8c;margin:10px 2px 0' }, n ? `這個月記了 ${n} 天的心情` : '這個月還沒有心情紀錄，點書桌上的日記本寫一句吧'));
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

async function worldNews() {
  tvOn.setAttribute('opacity', 1);
  const { year: born, items } = await data.birthYearNews();
  openSheet(`📺 你出生那年：${born}`, (b) => {
    if (!items.length) b.append(html('p', {}, '還沒有這一年的新聞'));
    for (const e of items.slice(0, 6)) {
      const d = html('div', { className: 'card', style: 'margin-bottom:8px' });
      d.append(html('small', {}, `${e.m} 月 ${e.d} 日 · ${e.region === 'tw' ? '台灣' : '世界'}`), html('b', {}, e.title), html('div', { style: 'font-size:14px;margin-top:2px' }, e.text));
      b.append(d);
    }
  });
  sheetClosed = () => tvOn.setAttribute('opacity', 0);
}
function letter() {
  openSheet('💌 寫給未來的自己', (b) => {
    const when = html('div', { style: 'font-size:13px;color:#b07f8c;margin:0 2px 8px' }, '信會封存到你下一個生日才能打開');
    const ta = html('textarea', { placeholder: '親愛的下一歲的我…' });
    const btn = html('div', { className: 'rec' }, '封好寄出');
    btn.onclick = () => {
      if (!ta.value.trim()) { ta.focus(); return; }
      closeSheet();
      data.addLetter(ta.value.trim()).then(({ age }) => setTimeout(() => { feel('happy', 2500); say(`封好了，${age} 歲生日見 💌`); sparkle(1255, 610, 6); }, 300));
    };
    b.append(when, ta, btn); setTimeout(() => ta.focus(), 250);
  });
}
function wardrobe() {
  openSheet('👗 換裝', (b) => {
    const row = (label, opts, key) => {
      b.append(html('div', { style: 'font-size:13px;color:#b07f8c;margin:10px 2px 6px' }, label));
      const r = html('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' });
      for (const [v, t] of opts) {
        const c = html('div', { className: 'card', style: `cursor:pointer;padding:8px 14px;${me[key] === v ? 'border-color:#f0708f;background:#fde6ed' : ''}` }, t);
        c.onclick = () => { me[key] = v; if (key === 'expr') clearTimeout(exprTimer); dressMe(); wardrobe(); };
        r.append(c);
      }
      b.append(r);
    };
    row('衣服', [['', '運動服'], ['tee', 'T 恤'], ['hoodie', '帽 T']], 'cloth');
    row('頭髮', [['ponytail', '高馬尾'], ['', '光頭']], 'hair');
    row('表情', [['smile', '😊 微笑'], ['happy', '😆 高興'], ['angry', '😠 生氣']], 'expr');
  });
}
// ---- 可以點的東西 ----
const now = () => new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
const HOTS = [
  { name: 'diary', r: [885, 360, 130, 75], go: [.47, .36, 1], act: compose, spark: [960, 375] },
  { name: 'calendar', r: [1010, 212, 105, 160], go: [.62, .25, 1], act: calendar, spark: [1095, 230] },
  { name: 'tv', r: [1095, 395, 135, 140], go: [.72, .27, 1], act: worldNews, spark: [1195, 410] },
  { name: 'letter', r: [1200, 570, 110, 130], go: [.83, .32, 1], act: letter, spark: [1290, 585] },
  { name: 'lamp', r: [745, 315, 65, 75], go: [.3, .3, 1], act: () => { const on = lampGlow.getAttribute('opacity') !== '1'; lampGlow.setAttribute('opacity', on ? 1 : 0); say(on ? '開燈 💡' : '關燈'); } },
  { name: 'bed', r: [375, 290, 360, 270], go: [.28, .48, -1], act: sleep },
  { name: 'clock', r: [768, 110, 82, 92], act: () => say(`現在 ${now()} ⏰`) },
  { name: 'window', r: [410, 105, 255, 270], act: () => say('今天天氣很好 ☀️ 23°') },
  { name: 'door', r: [1285, 355, 115, 315], go: [.95, .3, 1], act: rooms },
  { name: 'shelf', r: [195, 340, 175, 300], go: [.17, .82, -1], act: () => { const m = data.onThisDay(); if (m) { feel('happy'); say(`${m.years} 年前的今天：${m.text.length > 14 ? m.text.slice(0, 14) + '…' : m.text}`, 3600); } else say('以前的今天還沒有紀錄，從今天開始寫吧 📖', 3000); } },
  { name: 'plant', r: [715, 220, 80, 100], act: () => { say('澆水 💧 長大一點了'); sparkle(755, 260, 5); } },
  { name: 'photos', r: [865, 188, 95, 100], act: () => say('之後這裡會放你的照片 📷') },
];
for (const h of HOTS) {
  const [x, y, w, hh] = h.r;
  const node = el('rect', { x, y, width: w, height: hh, fill: DEBUG ? 'rgba(0,200,0,.2)' : 'transparent', class: 'hot', 'data-name': h.name }, hotLayer);
  node.addEventListener('click', (e) => {
    e.stopPropagation(); hideHint();
    if (me.hidden && h.name !== 'bed') { wake(); return; }
    if (h.go) { const [u, v, dir] = h.go; showMarker(...nearestFree(u, v)); walkTo(u, v, () => { me.dir = dir; placeMe(); h.act(); }); } else h.act();
  });
}
// 會閃的提示
HOTS.filter((h) => h.spark).forEach((h, i) => el('path', { d: star(h.spark[0], h.spark[1], 16), fill: '#ffe58a', stroke: '#5b3a3e', 'stroke-width': 3, class: 'twinkle', style: `animation-delay: ${i * .55}s` }, fxLayer));

// ---- 點小人：換裝 ----
stage.insertBefore(meWrap, bubbleLayer);
meWrap.style.cursor = 'pointer';
meWrap.addEventListener('click', (e) => { e.stopPropagation(); hideHint(); if (me.hidden) { wake(); return; } wardrobe(); });

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
document.getElementById('rec-btn').onclick = () => { hideHint(); const h = HOTS[0]; walkTo(h.go[0], h.go[1], () => { me.dir = 1; placeMe(); compose(); }); };
const hint = document.getElementById('hint');
function hideHint() { hint.style.opacity = 0; }

const EMO_FACE = { happy: 'happy', excited: 'happy', love: 'happy', moved: 'happy', angry: 'angry' };
function renderCards(justWrote) {
  document.getElementById('age-pill').textContent = data.ageLine();
  const card = document.getElementById('today-card');
  const list = data.todayMoments();
  card.replaceChildren(html('small', {}, '今天'));
  if (list.length) card.append(list.map((m) => m.text).filter(Boolean).slice(-2).join('、') || '放了一張照片');
  else card.append(justWrote || '還沒記錄喔。點書桌上的日記本，或下面的按鈕');
  const mc = document.getElementById('memory-card'), m = data.onThisDay();
  mc.hidden = !m;
  if (m) mc.replaceChildren(html('small', {}, `📅 那年今日 · ${m.years} 年前`), m.text);
}
data.load().then(() => renderCards());
placeMe();
requestAnimationFrame(tick);
setTimeout(() => say('歡迎來我的房間！'), 600);
