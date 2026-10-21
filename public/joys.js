// 我的幸福：重複發生的小幸福（喝到好喝的、看見漂亮的天空…），點一下就收藏，再問一句（有寫就變成日記），App 幫忙數次數、畫月曆
// 資料：state.joys（幸福項目）、state.joyLog（每點一次一筆，刪除留墓碑在 state.deleted）
// 每點一次存一筆，兩台手機同一天各點的次數合併時都會留下；次數、天數都從紀錄即時算，不另存計數

import { IMPRINT_DAYS, IMPRINTS } from './joys-config.js';

// 圖示：像素圖 joys/<key>.webp（art/tools/joy_icons.py 切的）；emoji 只在圖還沒做好時當備用
export const JOY_ICONS = {
  cat: '🐈', coffee: '☕', meal: '🍚', camera: '📷', gift: '🎁', sunset: '🌅', bear: '🧸', letter: '💌',
  book: '📖', sneaker: '👟', plant: '🪴', music: '🎧', cake: '🧁', star: '⭐', umbrella: '☂️', moon: '🌙',
  bike: '🚲', icecream: '🍦', hearts: '💕', home: '🏠', paw: '🐾', bath: '🛁', sparkle: '✨', sun: '☀️',
};
const JOY_PIX = new Set(Object.keys(JOY_ICONS));
export function iconEl(key) {
  if (!JOY_PIX.has(key)) return JOY_ICONS[key] || '✨';
  const img = new Image();
  img.src = `joys/${key}.webp`; img.alt = ''; img.className = 'joy-pix'; img.draggable = false;
  return img;
}
// 預設的 10 個（每個人都會遇到的日常，新使用者一進來就有；可以刪，刪了不會再出現）
// id 固定（joy-<圖示>），兩台手機各自建立時同步會合成同一個；updatedAt 用很早的時間，任何編輯或刪除都比它新
export const DEFAULT_JOYS = [
  { title: '喝到好喝的', icon: 'coffee', mode: 'many' },
  { title: '吃到好吃的', icon: 'meal', mode: 'many' },
  { title: '看見漂亮的天空', icon: 'sunset', mode: 'once' },
  { title: '好好睡了一覺', icon: 'moon', mode: 'once' },
  { title: '被稱讚了', icon: 'star', mode: 'many' },
  { title: '收到小驚喜', icon: 'gift', mode: 'many' },
  { title: '聽到喜歡的歌', icon: 'music', mode: 'many' },
  { title: '遇到可愛的貓狗', icon: 'paw', mode: 'many' },
  { title: '出門走走', icon: 'sneaker', mode: 'once' },
  { title: '和重要的人在一起', icon: 'hearts', mode: 'once' },
];
// 新增時的建議（預設以外的）
const SUGGESTIONS = [
  { title: '和貓一起睡', icon: 'cat', mode: 'once' },
  { title: '出門拍照', icon: 'camera', mode: 'once' },
  { title: '好好泡個澡', icon: 'bath', mode: 'once' },
  { title: '吃到甜點', icon: 'cake', mode: 'many' },
  { title: '讀了一本好書', icon: 'book', mode: 'once' },
  { title: '天氣很好', icon: 'sun', mode: 'once' },
  { title: '和家人吃飯', icon: 'home', mode: 'once' },
  { title: '收到一封訊息', icon: 'letter', mode: 'many' },
];
export const JOY_PRESETS = [...DEFAULT_JOYS, ...SUGGESTIONS];
// 收藏之後的延伸提問（照圖示）；有寫就變成一篇日記
const ASK = {
  coffee: '喝了什麼？好喝在哪裡？', meal: '吃了什麼好吃的？', sunset: '天空是什麼顏色的？', moon: '睡得怎麼樣？做了什麼夢嗎？',
  star: '被誰稱讚了？說了什麼？', gift: '是什麼樣的驚喜？', music: '是哪一首歌？', paw: '遇到什麼樣的小傢伙？',
  sneaker: '去了哪裡走走？', hearts: '和誰在一起？做了什麼？', cat: '貓咪今天睡在哪裡？', camera: '拍到了什麼？',
  bath: '泡澡的時候在想什麼？', cake: '吃了什麼甜點？', book: '讀了哪本書？', sun: '天氣好的時候做了什麼？',
  home: '吃了什麼？聊了什麼？', letter: '是誰傳來的？',
};
const askOf = (joy) => ASK[joy.icon] || '想多記一點嗎？';
const SEED_AT = '2000-01-01T00:00:00.000Z';
// 還沒有任何小幸福的人放進預設的 10 個（只做一次）；回傳有沒有改動
export function seedJoys(state) {
  state.prefs = state.prefs || {};
  if (state.prefs.joysSeeded) return false;
  state.prefs.joysSeeded = true;
  if ((state.joys || []).length) return true;
  const now = new Date().toISOString();
  state.joys = DEFAULT_JOYS.filter((p) => !(state.deleted || {})[`joy-${p.icon}`]).map((p, i) => ({
    id: `joy-${p.icon}`, title: p.title, icon: p.icon, mode: p.mode, order: i, createdAt: now, updatedAt: SEED_AT, archivedAt: null,
  }));
  return true;
}
export const MAX_TITLE = 20;
const HOME_MAX = 10; // 首頁最多擺幾顆（2 排 × 5），其他在「全部」

// ---------- 計算（純函式，測試和合併也用） ----------
export const iconOf = (joy) => iconEl(joy && joy.icon);
export const activeJoys = (state) => (state.joys || []).filter((j) => !j.archivedAt).sort((a, b) => a.order - b.order);
const logsOf = (state, joyId) => (state.joyLog || []).filter((l) => l.joyId === joyId);
// 日期 → 那天記了幾次（每日一次模式最多 1）
export function dayCounts(state, joy) {
  const m = new Map();
  for (const l of logsOf(state, joy.id)) m.set(l.date, (m.get(l.date) || 0) + 1);
  if (joy.mode !== 'many') for (const k of m.keys()) m.set(k, 1);
  return m;
}
export function joyStats(state, joy, today) {
  const days = dayCounts(state, joy);
  const dates = [...days.keys()].sort();
  const sum = (pred) => [...days].filter(([d]) => pred(d)).reduce((n, [, c]) => n + c, 0);
  const month = today.slice(0, 7), year = today.slice(0, 4);
  return {
    total: sum(() => true), // 總發生次數
    days: dates.length, // 有效紀錄日數（之後的星罐、生活印記用這個）
    month: sum((d) => d.startsWith(month)),
    year: sum((d) => d.startsWith(year)),
    first: dates[0] || null,
    last: dates[dates.length - 1] || null,
    today: days.get(today) || 0,
  };
}

// 合併兩台裝置的資料：同一筆保留較新的，墓碑比較新的不再出現（和日記、人物同一套規則）
export function mergeJoyData(local, remote, deleted) {
  const pick = (a = [], b = []) => {
    const byId = new Map();
    for (const x of [...a, ...b]) { const cur = byId.get(x.id); if (!cur || (x.updatedAt || '') > (cur.updatedAt || '')) byId.set(x.id, x); }
    return [...byId.values()].filter((x) => !(deleted[x.id] && deleted[x.id] >= (x.updatedAt || '')));
  };
  return { joys: pick(remote.joys, local.joys), joyLog: pick(remote.joyLog, local.joyLog), imprints: mergeImprints(local.imprints, remote.imprints) };
}

// ---------- 生活印記：某個圖示的小幸福收藏滿 IMPRINT_DAYS 天，房間多一件家具（永久，不會因為刪紀錄而收回） ----------
// state.imprints：[{ id: 圖示 key, key, joyId, at: 第 N 天的日期, shown: 有沒有放到房間, createdAt, updatedAt }]
export function mergeImprints(a = [], b = []) {
  const byKey = new Map();
  for (const x of [...a, ...b]) {
    const cur = byKey.get(x.key);
    if (!cur) { byKey.set(x.key, { ...x }); continue; }
    const newer = (x.updatedAt || '') > (cur.updatedAt || '') ? x : cur;
    byKey.set(x.key, { ...newer, at: x.at < cur.at ? x.at : cur.at }); // 放不放出來看最新的，獲得日期留最早的
  }
  return [...byKey.values()];
}
// 這個圖示目前最多收藏了幾天（同一個圖示有好幾個小幸福時取最多的）
export function imprintDays(state, key) {
  return Math.max(0, ...(state.joys || []).filter((j) => j.icon === key).map((j) => dayCounts(state, j).size));
}
// 檢查有沒有新拿到的，有就加進 state.imprints 並回傳新的那幾筆
export function checkImprints(state) {
  state.imprints = state.imprints || [];
  const have = new Set(state.imprints.map((i) => i.key));
  const fresh = [];
  for (const joy of state.joys || []) {
    if (have.has(joy.icon)) continue;
    const dates = [...dayCounts(state, joy).keys()].sort();
    if (dates.length < IMPRINT_DAYS) continue;
    const now = new Date().toISOString();
    const rec = { id: joy.icon, key: joy.icon, joyId: joy.id, at: dates[IMPRINT_DAYS - 1], shown: false, createdAt: now, updatedAt: now };
    state.imprints.push(rec); have.add(joy.icon); fresh.push(rec);
  }
  return fresh;
}
export const shownImprints = (state) => (state.imprints || []).filter((i) => i.shown).map((i) => i.key);

// ---------- 畫面 ----------
let ctx; // { getState, save, refresh, ask, addDiary, h, toast, todayStr, toDateStr, newId, $ }
let lastTap = { id: null, t: 0 };
const isFuture = (date) => date > ctx.todayStr();
const unit = (joy) => (joy.mode === 'many' ? '次' : '天');
const since = (last) => {
  if (!last) return '還沒收藏過';
  const n = Math.round((new Date(`${ctx.todayStr()}T00:00`) - new Date(`${last}T00:00`)) / 864e5);
  return n === 0 ? '今天' : n === 1 ? '昨天' : `${n} 天前`;
};
const fmt = (d) => (d ? d.replace(/-/g, '/') : '—');

export function initJoys(c) { ctx = c; }

function record(joy, date) {
  const s = ctx.getState();
  if (isFuture(date)) return false;
  if (joy.mode !== 'many' && logsOf(s, joy.id).some((l) => l.date === date)) return false;
  const now = new Date().toISOString();
  s.joyLog.push({ id: ctx.newId(), joyId: joy.id, date, createdAt: now, updatedAt: now });
  return true;
}
// 拿掉那天最後一筆
function unrecord(joy, date) {
  const s = ctx.getState();
  const mine = logsOf(s, joy.id).filter((l) => l.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const last = mine[mine.length - 1];
  if (!last) return false;
  s.deleted[last.id] = new Date().toISOString();
  s.joyLog = s.joyLog.filter((l) => l.id !== last.id);
  return true;
}

// 首頁的按鈕列
export function renderJoyRow() {
  const { h, $ } = ctx;
  const s = ctx.getState();
  const row = $('#joy-row');
  if (!row) return;
  if (seedJoys(s)) ctx.save();
  const today = ctx.todayStr();
  const list = activeJoys(s);
  if (!list.length) {
    row.replaceChildren(h('p', { class: 'joy-empty' }, '把常常發生的小幸福做成按鈕，發生了就點一下。'),
      h('button', { type: 'button', class: 'joy-chip', onclick: () => openJoyEdit(null) }, '＋ 新增小幸福'));
    return;
  }
  row.replaceChildren(...list.slice(0, HOME_MAX).map((j) => joyButton(j, today)),
    ...(list.length < HOME_MAX ? [h('button', { type: 'button', class: 'joy-btn joy-more', 'aria-label': '新增小幸福', onclick: () => openJoyEdit(null) }, h('span', { class: 'joy-ic' }, '＋'), h('span', { class: 'joy-name' }, '新增'))] : []));
}

function joyButton(joy, today) {
  const { h } = ctx;
  const n = joyStats(ctx.getState(), joy, today).today;
  const btn = h('button', {
    type: 'button', class: `joy-btn${n ? ' on' : ''}`, 'data-joy': joy.id, 'aria-pressed': String(!!n),
    'aria-label': `${joy.title}${n ? `，今天已收藏${joy.mode === 'many' ? ` ${n} 次` : ''}` : ''}`,
  }, h('span', { class: 'joy-ic' }, iconOf(joy)), h('span', { class: 'joy-name' }, joy.title),
  n && joy.mode === 'many' ? h('span', { class: 'joy-count' }, `×${n}`) : n ? h('span', { class: 'joy-check' }, '✓') : null);
  // 長按：打開這一項（看月曆、調整、撤銷）
  let timer = null, long = false;
  btn.addEventListener('pointerdown', () => { long = false; timer = setTimeout(() => { long = true; openJoy(joy.id); }, 480); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, () => clearTimeout(timer)));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('click', () => { if (long) { long = false; return; } tap(joy); });
  return btn;
}

async function tap(joy) {
  const today = ctx.todayStr();
  const now = Date.now();
  if (lastTap.id === joy.id && now - lastTap.t < 350) return; // 手指抖一下不算兩次
  lastTap = { id: joy.id, t: now };
  if (joy.mode !== 'many' && joyStats(ctx.getState(), joy, today).today) { openJoy(joy.id); return; }
  record(joy, today);
  afterChange();
  await ctx.save();
  renderJoyRow();
  const el = ctx.$(`#joy-row [data-joy="${joy.id}"]`);
  if (el) { el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 600); }
  showAsk(joy);
}

// 收藏後在按鈕下面問一句；有寫就存成日記，也可以復原這次收藏
function showAsk(joy) {
  const { h, $ } = ctx;
  const s = ctx.getState();
  const today = ctx.todayStr();
  const st = joyStats(s, joy, today);
  let card = $('#joy-ask');
  if (!card) { card = h('div', { id: 'joy-ask', class: 'joy-ask', role: 'region', 'aria-label': '收藏了' }); $('#joy-row').after(card); }
  const close = () => card.remove();
  const input = h('input', { class: 'joy-ask-input', maxlength: '200', placeholder: askOf(joy), 'aria-label': askOf(joy), enterkeyhint: 'done' });
  const save = h('button', { type: 'button', class: 'btn small primary', disabled: true, onclick: async () => {
    const text = input.value.trim();
    if (!text) return;
    save.disabled = true;
    await ctx.addDiary({ text, joyId: joy.id, title: joy.title });
    close();
  } }, '記成日記');
  input.addEventListener('input', () => { save.disabled = !input.value.trim(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save.click(); } });
  const left = IMPRINTS[joy.icon] && !(s.imprints || []).some((i) => i.key === joy.icon) ? IMPRINT_DAYS - imprintDays(s, joy.icon) : 0;
  const count = joy.mode === 'many' ? `今天第 ${st.today} 次` : `第 ${st.days} 天`;
  card.replaceChildren(
    h('div', { class: 'joy-ask-head' }, h('span', { class: 'joy-ask-ic' }, iconOf(joy)),
      h('span', { class: 'joy-ask-title' }, h('b', {}, `收藏了！${joy.title}`), h('small', {}, left > 0 && left <= 3 ? `${count} · 再 ${left} 天房間會多一件東西 🎁` : count)),
      h('button', { type: 'button', class: 'icon-btn joy-ask-x', 'aria-label': '關掉', onclick: close }, '×')),
    input,
    h('div', { class: 'joy-ask-actions' },
      h('button', { type: 'button', class: 'link-btn', onclick: () => { unrecord(joy, today); ctx.save(); renderJoyRow(); close(); ctx.toast('取消這次收藏了'); } }, '復原'),
      h('span', { class: 'spacer' }), save));
}

function addJoy(p) {
  const s = ctx.getState();
  const now = new Date().toISOString();
  const order = Math.max(0, ...(s.joys || []).map((j) => j.order + 1));
  const joy = { id: ctx.newId(), title: p.title, icon: p.icon, mode: p.mode || 'once', order, createdAt: now, updatedAt: now, archivedAt: null };
  s.joys.push(joy);
  ctx.save();
  return joy;
}

// ---------- 對話框（一個 dialog，內容換來換去：詳情／編輯／全部） ----------
const dialog = () => ctx.$('#joy-dialog');
const body = () => ctx.$('#joy-body');
function show(children) {
  body().replaceChildren(...children);
  if (!dialog().open) dialog().showModal();
}
const done = () => { afterChange(); ctx.save(); renderJoyRow(); };
// 記了一筆之後：看看有沒有新的生活印記
function afterChange() {
  const fresh = checkImprints(ctx.getState());
  if (fresh.length) { queue.push(...fresh); setTimeout(nextImprint, 350); }
}

let view = null; // 現在打開的是哪一個小幸福的詳情（拿到印記後要重畫那句話）
export function openJoy(id, month) {
  const { h } = ctx;
  view = { id, month };
  const s = ctx.getState();
  const joy = s.joys.find((j) => j.id === id);
  if (!joy) return;
  const today = ctx.todayStr();
  const st = joyStats(s, joy, today);
  const m = month || today.slice(0, 7);
  show([
    h('div', { class: 'sheet-top' }, h('h3', {}, joy.title)),
    h('div', { class: 'joy-hero' }, h('span', { class: 'joy-hero-ic' }, iconOf(joy)),
      h('div', {}, h('b', { class: 'joy-total' }, `累積 ${st.total} ${unit(joy)}`), h('span', { class: 'hint' }, `最近一次：${since(st.last)}`))),
    imprintLine(joy, st.days),
    h('div', { class: 'joy-stats' },
      stat('這個月', `${st.month} ${unit(joy)}`), stat('今年', `${st.year} ${unit(joy)}`),
      stat('第一次收藏', fmt(st.first)), stat('最近一次', fmt(st.last))),
    calendar(joy, m),
    h('p', { class: 'hint joy-cal-hint' }, joy.mode === 'many' ? '點日期可以調整那天的次數；可以補記以前的日子。' : '點日期可以收藏或取消；可以補記以前的日子。'),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => openJoyList() }, '全部小幸福'),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn', onclick: () => openJoyEdit(joy.id) }, '編輯')),
  ]);
}
function stat(label, value) { return ctx.h('div', { class: 'joy-stat' }, ctx.h('span', {}, label), ctx.h('b', {}, value)); }

function calendar(joy, month) {
  const { h } = ctx;
  const s = ctx.getState();
  const days = dayCounts(s, joy);
  const [y, mo] = month.split('-').map(Number);
  const first = new Date(y, mo - 1, 1), last = new Date(y, mo, 0).getDate();
  const today = ctx.todayStr();
  const shift = (d) => { const t = new Date(y, mo - 1 + d, 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; };
  const canNext = shift(1) <= today.slice(0, 7);
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(h('span', { class: 'joy-day empty' }));
  for (let d = 1; d <= last; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const n = days.get(date) || 0;
    const future = date > today;
    cells.push(h('button', {
      type: 'button', class: `joy-day${n ? ' on' : ''}${date === today ? ' today' : ''}`, disabled: future, 'data-date': date,
      'aria-label': `${mo} 月 ${d} 日${n ? `，收藏了${joy.mode === 'many' ? ` ${n} 次` : ''}` : ''}`,
      onclick: () => dayTap(joy, date, month),
    }, h('span', { class: 'joy-day-num' }, String(d)), n ? h('span', { class: 'joy-stamp' }, iconOf(joy)) : null,
    n > 1 ? h('span', { class: 'joy-day-n' }, `×${n}`) : null));
  }
  return h('div', { class: 'joy-cal' },
    h('div', { class: 'joy-cal-head' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '上個月', onclick: () => openJoy(joy.id, shift(-1)) }, '‹'),
      h('b', {}, `${y} 年 ${mo} 月`),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '下個月', disabled: !canNext, onclick: () => openJoy(joy.id, shift(1)) }, '›')),
    h('div', { class: 'joy-week' }, ...'日一二三四五六'.split('').map((w) => h('span', {}, w))),
    h('div', { class: 'joy-days' }, ...cells));
}

function dayTap(joy, date, month) {
  if (isFuture(date)) return;
  const n = dayCounts(ctx.getState(), joy).get(date) || 0;
  if (joy.mode !== 'many') {
    if (n) unrecord(joy, date); else record(joy, date);
    done(); openJoy(joy.id, month); return;
  }
  // 每日多次：那天的加減
  const { h } = ctx;
  const panel = h('div', { class: 'joy-adjust' },
    h('span', {}, `${Number(date.slice(5, 7))}/${Number(date.slice(8))}：`), h('b', { class: 'joy-adjust-n' }, `${n} 次`),
    h('span', { class: 'spacer' }),
    h('button', { type: 'button', class: 'btn small', 'aria-label': '少一次', disabled: !n, onclick: () => { unrecord(joy, date); done(); openJoy(joy.id, month); dayTap(joy, date, month); } }, '−'),
    h('button', { type: 'button', class: 'btn small', 'aria-label': '多一次', onclick: () => { record(joy, date); done(); openJoy(joy.id, month); dayTap(joy, date, month); } }, '＋'));
  const old = body().querySelector('.joy-adjust');
  if (old) old.replaceWith(panel); else body().querySelector('.joy-cal').after(panel);
}

export function openJoyEdit(id) {
  const { h } = ctx;
  view = null;
  const s = ctx.getState();
  const joy = id ? s.joys.find((j) => j.id === id) : null;
  let icon = joy ? joy.icon : 'sparkle';
  const name = h('input', { value: joy ? joy.title : '', maxlength: String(MAX_TITLE), placeholder: '例如：和貓一起睡', 'aria-label': '小幸福的名字', class: 'joy-title-input' });
  const icons = h('div', { class: 'joy-icons', role: 'radiogroup', 'aria-label': '圖示' }, ...Object.keys(JOY_ICONS).map((k) => h('button', {
    type: 'button', class: `joy-icon-opt${k === icon ? ' on' : ''}`, role: 'radio', 'aria-checked': String(k === icon), 'data-icon': k,
    onclick: (ev) => { icon = k; icons.querySelectorAll('.joy-icon-opt').forEach((b) => { const on = b.dataset.icon === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); ev.preventDefault(); },
  }, iconEl(k))));
  const mode = (v, label, hint) => h('label', { class: 'joy-mode' }, h('input', { type: 'radio', name: 'joy-mode', value: v, checked: (joy ? joy.mode : 'once') === v }), h('span', {}, h('b', {}, label), h('small', { class: 'hint' }, hint)));
  const presets = joy ? null : h('div', { class: 'chips joy-presets' }, ...JOY_PRESETS.filter((p) => !s.joys.some((j) => j.title === p.title)).map((p) => h('button', {
    type: 'button', class: 'chip', onclick: () => { name.value = p.title; icon = p.icon; icons.querySelector(`[data-icon="${p.icon}"]`).click(); body().querySelector(`input[value="${p.mode}"]`).checked = true; },
  }, iconEl(p.icon), ` ${p.title}`)));
  const save = async () => {
    const title = name.value.trim().slice(0, MAX_TITLE);
    if (!title) { ctx.toast('幫這個小幸福取個名字'); name.focus(); return; }
    const newMode = body().querySelector('input[name="joy-mode"]:checked').value;
    const now = new Date().toISOString();
    if (!joy) { const j = addJoy({ title, icon, mode: newMode }); renderJoyRow(); openJoy(j.id); return; }
    if (joy.mode === 'many' && newMode === 'once') {
      const extra = [...dayCounts(s, { ...joy, mode: 'many' })].filter(([, n]) => n > 1);
      if (extra.length && !(await ctx.ask({
        title: '改成每天一次？', body: [`有 ${extra.length} 天記了不只一次。`, '改成「每天一次」後，這些日子每天只保留 1 次，多的會刪掉。'],
        actions: [{ label: '先不要', value: false }, { label: '改成每天一次', value: true, kind: 'primary' }],
      }))) return;
      for (const [date, n] of extra) for (let i = 1; i < n; i++) unrecord(joy, date);
    }
    Object.assign(joy, { title, icon, mode: newMode, updatedAt: now });
    done(); openJoy(joy.id);
  };
  show([
    h('div', { class: 'sheet-top' }, h('h3', {}, joy ? '編輯小幸福' : '新增小幸福')),
    presets && presets.childNodes.length ? h('div', { class: 'field' }, h('span', { class: 'field-label' }, '點一下帶入'), presets) : null,
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, '名字'), name),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, '圖示'), icons),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, '怎麼記'),
      mode('once', '每天一次', '例如：和貓一起睡、和家人吃飯'),
      mode('many', '一天可以很多次', '例如：喝咖啡、拍照，點幾下就記幾次')),
    joy ? h('div', { class: 'danger-zone' },
      h('button', { type: 'button', class: 'btn', onclick: () => { joy.archivedAt = joy.archivedAt ? null : now(); joy.updatedAt = now(); done(); openJoyList(); } }, joy.archivedAt ? '放回首頁' : '先收起來（紀錄都會留著）'),
      h('button', { type: 'button', class: 'btn danger', onclick: () => removeJoy(joy) }, '刪除這個小幸福')) : null,
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => (joy ? openJoy(joy.id) : dialog().close()) }, '取消'),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn primary', onclick: save }, '好了')),
  ]);
  if (!joy) name.focus();
}
const now = () => new Date().toISOString();

async function removeJoy(joy) {
  const s = ctx.getState();
  const n = logsOf(s, joy.id).length;
  if (!(await ctx.ask({
    title: `刪除「${joy.title}」？`, body: [`${n ? `${n} 筆紀錄也會一起刪掉，` : ''}刪了就救不回來。`, '只想先不顯示的話，可以按「先收起來」。'],
    actions: [{ label: '先不要', value: false }, { label: '刪除', value: true, kind: 'danger' }],
  }))) return;
  const t = now();
  for (const l of logsOf(s, joy.id)) s.deleted[l.id] = t;
  s.joyLog = s.joyLog.filter((l) => l.joyId !== joy.id);
  s.deleted[joy.id] = t;
  s.joys = s.joys.filter((j) => j.id !== joy.id);
  done(); openJoyList();
}

export function openJoyList() {
  const { h } = ctx;
  view = null;
  const s = ctx.getState();
  const today = ctx.todayStr();
  const active = activeJoys(s), archived = s.joys.filter((j) => j.archivedAt);
  const move = (j, d) => {
    const i = active.indexOf(j), k = active[i + d];
    if (!k) return;
    [j.order, k.order] = [k.order, j.order];
    j.updatedAt = k.updatedAt = now();
    done(); openJoyList();
  };
  const row = (j, i, arr) => {
    const st = joyStats(s, j, today);
    return h('li', { class: 'joy-item' },
      h('button', { type: 'button', class: 'joy-item-main', onclick: () => openJoy(j.id) },
        h('span', { class: 'joy-ic' }, iconOf(j)),
        h('span', { class: 'joy-item-text' }, h('b', {}, j.title), h('small', { class: 'hint' }, `累積 ${st.total} ${unit(j)}${st.today ? ' · 今天收藏了 ✓' : ''}`))),
      j.archivedAt ? null : h('span', { class: 'joy-order' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${j.title}往前`, disabled: i === 0, onclick: () => move(j, -1) }, '↑'),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${j.title}往後`, disabled: i === arr.length - 1, onclick: () => move(j, 1) }, '↓')));
  };
  show([
    h('div', { class: 'sheet-top' }, h('h3', {}, '我的幸福')),
    h('p', { class: 'hint' }, '常常發生的小幸福，發生了就在首頁點一下。這裡可以排順序、編輯，點進去看月曆。'),
    active.length ? h('ul', { class: 'joy-list' }, ...active.map(row)) : h('p', { class: 'hint' }, '還沒有小幸福，新增一個吧。'),
    archived.length ? h('details', { class: 'joy-archived' }, h('summary', {}, `收起來的（${archived.length}）`), h('ul', { class: 'joy-list' }, ...archived.map(row))) : null,
    imprintBook(),
    h('div', { class: 'sheet-actions' }, h('span', { class: 'spacer' }), h('button', { type: 'button', class: 'btn primary', onclick: () => openJoyEdit(null) }, '＋ 新增小幸福')),
  ]);
}

// ---------- 生活印記：詳情裡的一句話、全部頁的收藏冊、拿到時的小視窗 ----------
const imprintName = (key) => (IMPRINTS[key] ? IMPRINTS[key].name : '小東西');
const imprintArt = (key, cls = 'imprint-art') => (IMPRINTS[key]
  ? ctx.h('img', { class: cls, src: `room/imprints/${key}.webp`, alt: '' }) : ctx.h('span', { class: `${cls} imprint-icon` }, iconEl(key)));
function imprintLine(joy, days) {
  const got = (ctx.getState().imprints || []).find((i) => i.key === joy.icon);
  if (got && got.shown) return ctx.h('p', { class: 'joy-imprint got' }, `房間裡的「${imprintName(joy.icon)}」就是它的紀念 ♡`);
  if (got) return ctx.h('p', { class: 'joy-imprint got' }, `已經拿到「${imprintName(joy.icon)}」，可以在「全部小幸福 → 生活印記」放到房間`);
  return ctx.h('p', { class: 'joy-imprint' }, `再收藏 ${Math.max(1, IMPRINT_DAYS - days)} 天，房間會多一件「${imprintName(joy.icon)}」`);
}
function toggleImprint(rec, shown) {
  rec.shown = shown; rec.updatedAt = now();
  ctx.save(); if (ctx.refresh) ctx.refresh();
}
function imprintBook() {
  const { h } = ctx;
  const s = ctx.getState();
  const got = new Map((s.imprints || []).map((i) => [i.key, i]));
  const cells = Object.keys(JOY_ICONS).map((key) => {
    const rec = got.get(key);
    if (rec) {
      return h('li', { class: 'imprint-cell got', 'data-imprint': key },
        imprintArt(key), h('b', {}, imprintName(key)), h('small', { class: 'hint' }, fmt(rec.at)),
        IMPRINTS[key]
          ? h('button', { type: 'button', class: `btn small${rec.shown ? '' : ' primary'}`, onclick: () => { toggleImprint(rec, !rec.shown); openJoyList(); } }, rec.shown ? '收起來' : '放到房間')
          : h('small', { class: 'hint' }, '家具製作中'));
    }
    const days = imprintDays(s, key);
    return h('li', { class: 'imprint-cell', 'data-imprint': key }, h('span', { class: 'imprint-art imprint-icon' }, iconEl(key)),
      h('small', { class: 'hint' }, days ? `${days} / ${IMPRINT_DAYS} 天` : '還沒有'));
  });
  return h('section', { class: 'imprint-book' },
    h('h4', {}, `生活印記 · ${got.size} / ${Object.keys(JOY_ICONS).length}`),
    h('p', { class: 'hint' }, `同一個小幸福收藏滿 ${IMPRINT_DAYS} 天，房間就會多一件紀念的家具。不用連續，慢慢來。`),
    h('ul', { class: 'imprint-grid' }, ...cells));
}
const queue = [];
function nextImprint() {
  const rec = queue.shift();
  if (!rec) return;
  const { h } = ctx;
  const s = ctx.getState();
  const joy = s.joys.find((j) => j.id === rec.joyId);
  let dlg = ctx.$('#imprint-dialog');
  const close = () => { dlg.close(); setTimeout(nextImprint, 200); };
  dlg.querySelector('#imprint-body').replaceChildren(
    h('div', { class: 'sheet-top' }, h('h3', {}, '房間多了一件東西')),
    h('div', { class: 'imprint-hero' }, imprintArt(rec.key, 'imprint-big')),
    h('p', { class: 'imprint-name' }, h('b', {}, imprintName(rec.key))),
    h('p', { class: 'hint' }, `「${joy ? joy.title : '小幸福'}」收藏滿 ${IMPRINT_DAYS} 天的紀念。`),
    IMPRINTS[rec.key]
      ? h('p', { class: 'hint' }, `會放在${IMPRINTS[rec.key].where}，之後也可以在「我的幸福 → 生活印記」收起來或放出來。`)
      : h('p', { class: 'hint' }, '這件家具還在製作中，做好會出現在「我的幸福 → 生活印記」。'),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn', onclick: close }, '先收著'),
      h('span', { class: 'spacer' }),
      IMPRINTS[rec.key] ? h('button', { type: 'button', class: 'btn primary', onclick: () => { toggleImprint(rec, true); ctx.toast('放好了，回小窩看看 ♡'); close(); if (view && dialog().open) openJoy(view.id, view.month); } }, '放到房間') : null));
  if (!dlg.open) dlg.showModal();
}
