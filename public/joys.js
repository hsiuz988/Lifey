// 累積幸福：重複發生的小幸福（和貓一起睡、全家吃飯…），點一下就收藏，App 幫忙數次數、畫月曆
// 資料：state.joys（幸福項目）、state.joyLog（每點一次一筆，刪除留墓碑在 state.deleted）
// 每點一次存一筆，兩台手機同一天各點的次數合併時都會留下；次數、天數都從紀錄即時算，不另存計數

// 圖示：有像素圖（joys/<key>.webp，art/tools/joy_icons.py 切的）就用圖，還沒有的先用 emoji
export const JOY_ICONS = {
  cat: '🐈', coffee: '☕', meal: '🍚', camera: '📷', gift: '🎁', sunset: '🌅', bear: '🧸', letter: '💌',
  book: '📖', sneaker: '👟', plant: '🪴', music: '🎧', cake: '🧁', star: '⭐', umbrella: '☂️', moon: '🌙',
  bike: '🚲', icecream: '🍦', hearts: '💕', home: '🏠', paw: '🐾', bath: '🛁', sparkle: '✨', sun: '☀️',
};
const JOY_PIX = new Set(['cat', 'coffee', 'meal', 'camera', 'gift', 'sunset', 'bear', 'letter', 'book', 'sneaker', 'plant',
  'cake', 'star', 'umbrella', 'moon', 'bike', 'icecream', 'hearts', 'home', 'paw', 'bath', 'sun']);
export function iconEl(key) {
  if (!JOY_PIX.has(key)) return JOY_ICONS[key] || '✨';
  const img = new Image();
  img.src = `joys/${key}.webp`; img.alt = ''; img.className = 'joy-pix'; img.draggable = false;
  return img;
}
export const JOY_PRESETS = [
  { title: '和貓一起睡', icon: 'cat', mode: 'once' },
  { title: '喝到好咖啡', icon: 'coffee', mode: 'many' },
  { title: '和家人吃飯', icon: 'meal', mode: 'once' },
  { title: '出門拍照', icon: 'camera', mode: 'once' },
  { title: '收到小驚喜', icon: 'gift', mode: 'many' },
  { title: '看見漂亮的天空', icon: 'sunset', mode: 'once' },
  { title: '好好休息', icon: 'bear', mode: 'once' },
  { title: '和喜歡的人見面', icon: 'hearts', mode: 'once' },
];
export const MAX_TITLE = 20;
const HOME_MAX = 8; // 首頁最多擺幾顆，其他在「全部」
const CHEERS = ['又收藏了一個小幸福 ♡', '這個瞬間，收好囉！', '今天又多了一點點美好。', '小窩記住這件事了。', '一顆小星星，悄悄亮起來。'];

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
  return { joys: pick(remote.joys, local.joys), joyLog: pick(remote.joyLog, local.joyLog) };
}

// ---------- 畫面 ----------
let ctx; // { getState, save, h, toast, todayStr, toDateStr, newId, $ }
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
  const today = ctx.todayStr();
  const list = activeJoys(s);
  if (!list.length) {
    const used = new Set((s.joys || []).map((j) => j.title));
    row.replaceChildren(h('p', { class: 'joy-empty' }, '把常常發生的小幸福做成按鈕，發生了就點一下：'),
      ...JOY_PRESETS.filter((p) => !used.has(p.title)).slice(0, 6).map((p) => h('button', {
        type: 'button', class: 'joy-chip', onclick: () => { addJoy(p); renderJoyRow(); ctx.toast(`加入了「${p.title}」，發生的時候點一下就好`); },
      }, '＋ ', iconEl(p.icon), ` ${p.title}`)),
      h('button', { type: 'button', class: 'joy-chip', onclick: () => openJoyEdit(null) }, '＋ 自己做一個'));
    return;
  }
  row.replaceChildren(...list.slice(0, HOME_MAX).map((j) => joyButton(j, today)),
    h('button', { type: 'button', class: 'joy-btn joy-more', 'aria-label': '新增小幸福', onclick: () => openJoyEdit(null) }, h('span', { class: 'joy-ic' }, '＋'), h('span', { class: 'joy-name' }, '新增')));
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
  await ctx.save();
  renderJoyRow();
  const el = ctx.$(`#joy-row [data-joy="${joy.id}"]`);
  if (el) { el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 600); }
  ctx.toast(CHEERS[Math.floor(Math.random() * CHEERS.length)], 1800);
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
const done = () => { ctx.save(); renderJoyRow(); };

export function openJoy(id, month) {
  const { h } = ctx;
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
  const save = () => {
    const title = name.value.trim().slice(0, MAX_TITLE);
    if (!title) { ctx.toast('幫這個小幸福取個名字'); name.focus(); return; }
    const newMode = body().querySelector('input[name="joy-mode"]:checked').value;
    const now = new Date().toISOString();
    if (!joy) { const j = addJoy({ title, icon, mode: newMode }); renderJoyRow(); openJoy(j.id); return; }
    if (joy.mode === 'many' && newMode === 'once') {
      const extra = [...dayCounts(s, { ...joy, mode: 'many' })].filter(([, n]) => n > 1);
      if (extra.length && !confirm(`有 ${extra.length} 天記了不只一次。\n改成「每天一次」後，這些日子每天只保留 1 次，多的會刪掉。要改嗎？`)) return;
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

function removeJoy(joy) {
  const s = ctx.getState();
  const n = logsOf(s, joy.id).length;
  if (!confirm(`刪除「${joy.title}」？\n${n ? `${n} 筆紀錄也會一起刪掉，` : ''}刪了就救不回來。\n\n只想先不顯示的話，可以按「先收起來」。`)) return;
  const t = now();
  for (const l of logsOf(s, joy.id)) s.deleted[l.id] = t;
  s.joyLog = s.joyLog.filter((l) => l.joyId !== joy.id);
  s.deleted[joy.id] = t;
  s.joys = s.joys.filter((j) => j.id !== joy.id);
  done(); openJoyList();
}

export function openJoyList() {
  const { h } = ctx;
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
    h('div', { class: 'sheet-top' }, h('h3', {}, '累積幸福')),
    h('p', { class: 'hint' }, '常常發生的小幸福，發生了就在首頁點一下。這裡可以排順序、編輯，點進去看月曆。'),
    active.length ? h('ul', { class: 'joy-list' }, ...active.map(row)) : h('p', { class: 'hint' }, '還沒有小幸福，新增一個吧。'),
    archived.length ? h('details', { class: 'joy-archived' }, h('summary', {}, `收起來的（${archived.length}）`), h('ul', { class: 'joy-list' }, ...archived.map(row))) : null,
    h('div', { class: 'sheet-actions' }, h('span', { class: 'spacer' }), h('button', { type: 'button', class: 'btn primary', onclick: () => openJoyEdit(null) }, '＋ 新增小幸福')),
  ]);
}
