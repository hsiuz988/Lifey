'use strict';

// ---------- 常數 ----------
const STORAGE_KEY = 'lifelog.v1';
const DATA_VERSION = 1;
const MOODS = ['😞', '🙁', '😐', '🙂', '😄']; // 對應 1–5
const DEFAULT_TAGS = ['家人', '朋友', '愛情', '工作', '學習', '健康', '旅行', '興趣', '里程碑'];
const BACKUP_REMIND_DAYS = 30;

// ---------- 狀態 ----------
let state = loadState();
const ui = { filter: 'all', query: '', collapsed: new Set(), editingId: null, mood: null, tags: new Set() };

function emptyState() {
  return { version: DATA_VERSION, profile: null, moments: [], lastExportAt: null };
}

function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && data.version === DATA_VERSION && Array.isArray(data.moments)) return data;
  } catch (e) { /* 讀不到就從空的開始 */ }
  return emptyState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    toast('儲存失敗：瀏覽器空間不足或被封鎖，請先匯出備份');
    return false;
  }
}

// ---------- 日期工具（一律用本地時區的 YYYY-MM-DD 字串） ----------
const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toDateStr(new Date());
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const isValidDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseDate(s));

function ageAt(birthday, date) {
  const [by, bm, bd] = birthday.split('-').map(Number);
  const [y, m, d] = date.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

// 某個年紀的起訖日期（生日當天 ～ 下次生日前一天）
function ageRange(birthday, age) {
  const b = parseDate(birthday);
  const start = new Date(b.getFullYear() + age, b.getMonth(), b.getDate());
  const end = new Date(b.getFullYear() + age + 1, b.getMonth(), b.getDate() - 1);
  return [start, end];
}

const fmtDate = (d) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
const daysBetween = (a, b) => Math.round((b - a) / 86400000);

// ---------- DOM 工具 ----------
const $ = (sel) => document.querySelector(sel);

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// ---------- 畫面 ----------
function render() {
  const hasProfile = !!state.profile;
  $('#setup').hidden = hasProfile;
  $('#app').hidden = !hasProfile;
  if (!hasProfile) return;
  renderHeader();
  renderIdCard();
  renderBackupBanner();
  renderFilters();
  renderTimeline();
}

function renderHeader() {
  const { birthday } = state.profile;
  const today = todayStr();
  const age = ageAt(birthday, today);
  const [start, end] = ageRange(birthday, age);
  const now = parseDate(today);
  const total = daysBetween(start, end) + 1;
  const passed = daysBetween(start, now) + 1;
  $('#age-num').textContent = age;
  $('#age-sub').textContent = `${now.getFullYear()}年 · ${age} 歲的第 ${passed} 天 · 距離 ${age + 1} 歲還有 ${total - passed} 天`;
  $('#age-progress').style.width = `${Math.min(100, (passed / total) * 100)}%`;
}

function renderIdCard() {
  const { name, birthday } = state.profile;
  const today = todayStr();
  const ages = new Set(state.moments.map((m) => ageAt(birthday, m.date)));
  const stars = state.moments.filter((m) => m.starred).length;
  $('#id-year').textContent = new Date().getFullYear();
  $('#id-name').textContent = name;
  $('#id-birth').textContent = fmtDate(parseDate(birthday));
  $('#id-count').textContent = `${state.moments.length} 則`;
  $('#id-stars').textContent = `${stars} 則`;
  $('#id-ages').textContent = `${ages.size} / ${ageAt(birthday, today) + 1} 個年歲`;

  // 護照式機器可讀區（MRZ），純裝飾
  const latin = name.toUpperCase().replace(/[^A-Z ]/g, '').trim().replace(/\s+/g, '<') || 'LIFE<LOG';
  const line1 = `L<LOG${latin}`.padEnd(30, '<').slice(0, 30);
  const line2 = `${birthday.replace(/-/g, '').slice(2)}<${String(state.moments.length).padStart(4, '0')}<${String(stars).padStart(3, '0')}`.padEnd(30, '<');
  $('#id-mrz').textContent = `${line1}\n${line2}`;
}

function renderBackupBanner() {
  const banner = $('#backup-banner');
  if (state.moments.length === 0) { banner.hidden = true; return; }
  if (!state.lastExportAt) {
    $('#backup-text').textContent = '還沒備份過。資料只存在這個瀏覽器裡。';
    banner.hidden = false;
    return;
  }
  const days = daysBetween(new Date(state.lastExportAt), new Date());
  banner.hidden = days < BACKUP_REMIND_DAYS;
  $('#backup-text').textContent = `已經 ${days} 天沒有備份了。`;
}

function allTags() {
  const tags = new Set(DEFAULT_TAGS);
  state.moments.forEach((m) => (m.tags || []).forEach((t) => tags.add(t)));
  return [...tags];
}

function renderFilters() {
  const used = new Set(state.moments.flatMap((m) => m.tags || []));
  const options = [['all', '全部'], ['star', '☆ 值得記住'], ...allTags().filter((t) => used.has(t)).map((t) => [`tag:${t}`, t])];
  if (!options.some(([v]) => v === ui.filter)) ui.filter = 'all';
  $('#filter-chips').replaceChildren(...options.map(([value, label]) =>
    h('button', {
      class: `chip${ui.filter === value ? ' on' : ''}`, type: 'button',
      onclick: () => { ui.filter = value; renderFilters(); renderTimeline(); },
    }, label)));
}

function matchesFilter(m) {
  if (ui.filter === 'star' && !m.starred) return false;
  if (ui.filter.startsWith('tag:') && !(m.tags || []).includes(ui.filter.slice(4))) return false;
  if (ui.query && !m.text.toLowerCase().includes(ui.query.toLowerCase())) return false;
  return true;
}

function renderTimeline() {
  const { birthday } = state.profile;
  const root = $('#timeline');
  const currentAge = ageAt(birthday, todayStr());

  if (state.moments.length === 0) {
    root.replaceChildren(h('div', { class: 'empty' },
      h('p', {}, `你現在 ${currentAge} 歲。`),
      h('p', {}, '按右下角「＋ 記一筆」，寫下第一個值得記住的時刻。'),
      h('p', { class: 'muted' }, '也可以把日期改到過去，補上以前的回憶。')));
    return;
  }

  const items = state.moments.filter(matchesFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  if (items.length === 0) {
    root.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, '沒有符合條件的紀錄。')));
    return;
  }

  const groups = new Map();
  for (const m of items) {
    const age = ageAt(birthday, m.date);
    if (!groups.has(age)) groups.set(age, []);
    groups.get(age).push(m);
  }

  root.replaceChildren(...[...groups].map(([age, list]) => {
    const [start, end] = ageRange(birthday, age);
    const stars = list.filter((m) => m.starred).length;
    const collapsed = ui.collapsed.has(age);
    return h('section', { class: `age-group${collapsed ? ' collapsed' : ''}` },
      h('button', {
        class: 'age-head', type: 'button', 'aria-expanded': String(!collapsed),
        onclick: () => { collapsed ? ui.collapsed.delete(age) : ui.collapsed.add(age); renderTimeline(); },
      },
      h('span', { class: 'age-label' }, `${age} 歲`),
      h('span', { class: 'age-range' }, `${fmtDate(start)} – ${fmtDate(end)}`),
      h('span', { class: 'age-count' }, `${list.length} 則${stars ? ` · ☆${stars}` : ''}`)),
      collapsed ? null : h('ul', { class: 'moments' }, list.map(renderMoment)));
  }));
}

function renderMoment(m) {
  const d = parseDate(m.date);
  return h('li', { class: `moment${m.starred ? ' starred' : ''}` },
    h('span', { class: 'moment-date' }, `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`),
    h('button', { class: 'moment-body', type: 'button', onclick: () => openMoment(m.id) },
      h('span', { class: 'moment-text' }, m.mood ? `${MOODS[m.mood - 1]} ` : '', m.text),
      (m.tags || []).length ? h('span', { class: 'moment-tags' }, m.tags.map((t) => h('span', { class: 'tag' }, t))) : null),
    h('button', {
      class: 'star-btn', type: 'button', 'aria-label': m.starred ? '取消標記' : '標記為值得記住',
      onclick: () => toggleStar(m.id),
    }, m.starred ? '★' : '☆'));
}

// ---------- 動作 ----------
function toggleStar(id) {
  const m = state.moments.find((x) => x.id === id);
  if (!m) return;
  m.starred = !m.starred;
  m.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function openMoment(id = null) {
  const form = $('#moment-form');
  const m = id ? state.moments.find((x) => x.id === id) : null;
  ui.editingId = m ? m.id : null;
  ui.mood = m ? m.mood || null : null;
  ui.tags = new Set(m ? m.tags || [] : []);
  $('#moment-title').textContent = m ? '編輯時刻' : '記一筆';
  form.date.value = m ? m.date : todayStr();
  form.date.min = state.profile.birthday;
  form.date.max = todayStr();
  form.text.value = m ? m.text : '';
  form.starred.checked = m ? !!m.starred : false;
  $('#moment-delete').hidden = !m;
  renderMoodPicker();
  renderTagPicker();
  updateAgeHint();
  $('#moment-dialog').showModal();
  if (!m) form.text.focus();
}

function updateAgeHint() {
  const date = $('#moment-form').date.value;
  const el = $('#moment-age');
  if (!isValidDateStr(date)) { el.textContent = ''; return; }
  const age = ageAt(state.profile.birthday, date);
  el.textContent = age < 0 ? '這一天你還沒出生喔' : `這是你 ${age} 歲的時候`;
}

function renderMoodPicker() {
  $('#mood-picker').replaceChildren(...MOODS.map((emoji, i) =>
    h('button', {
      type: 'button', class: `mood${ui.mood === i + 1 ? ' on' : ''}`, 'aria-label': `心情 ${i + 1}`,
      onclick: () => { ui.mood = ui.mood === i + 1 ? null : i + 1; renderMoodPicker(); },
    }, emoji)));
}

function renderTagPicker() {
  $('#tag-picker').replaceChildren(...allTags().map((t) =>
    h('button', {
      type: 'button', class: `chip${ui.tags.has(t) ? ' on' : ''}`,
      onclick: () => { ui.tags.has(t) ? ui.tags.delete(t) : ui.tags.add(t); renderTagPicker(); },
    }, t)));
}

function saveMoment(e) {
  e.preventDefault();
  const form = e.target;
  const date = form.date.value;
  const text = form.text.value.trim();
  if (!isValidDateStr(date) || !text) return;
  if (date < state.profile.birthday || date > todayStr()) {
    toast('日期要在生日到今天之間');
    return;
  }
  const now = new Date().toISOString();
  const fields = { date, text, mood: ui.mood, tags: [...ui.tags], starred: form.starred.checked, updatedAt: now };
  if (ui.editingId) {
    Object.assign(state.moments.find((x) => x.id === ui.editingId), fields);
  } else {
    state.moments.push({ id: newId(), createdAt: now, ...fields });
  }
  ui.collapsed.delete(ageAt(state.profile.birthday, date));
  if (saveState()) {
    $('#moment-dialog').close();
    toast(ui.editingId ? '已更新' : '記下來了');
    render();
  }
}

function deleteMoment() {
  if (!ui.editingId || !confirm('確定要刪除這則紀錄嗎？')) return;
  state.moments = state.moments.filter((x) => x.id !== ui.editingId);
  saveState();
  $('#moment-dialog').close();
  toast('已刪除');
  render();
}

// ---------- 個人資料 ----------
function saveProfile(form) {
  const name = form.name.value.trim();
  const birthday = form.birthday.value;
  if (!name || !isValidDateStr(birthday)) return false;
  if (birthday > todayStr()) { toast('生日不能在未來'); return false; }
  const early = state.moments.filter((m) => m.date < birthday).length;
  if (early && !confirm(`有 ${early} 則紀錄早於這個生日，仍要儲存嗎？`)) return false;
  state.profile = { name, birthday };
  return saveState();
}

// ---------- 備份 ----------
async function exportData() {
  const exportedAt = new Date().toISOString();
  const json = JSON.stringify({ ...state, lastExportAt: exportedAt }, null, 2);
  const filename = `lifelog-${todayStr()}.json`;
  const file = new File([json], filename, { type: 'application/json' });
  try {
    // iOS 主畫面 App 裡下載連結不太可靠，優先用分享面板（可「儲存到檔案」）
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
    } else {
      const url = URL.createObjectURL(file);
      h('a', { href: url, download: filename }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch (e) {
    if (e.name !== 'AbortError') toast('匯出失敗');
    return;
  }
  state.lastExportAt = exportedAt;
  saveState();
  toast('已匯出備份');
  render();
  renderSettingsStatus();
}

function validateImport(data) {
  if (!data || data.version !== DATA_VERSION || !Array.isArray(data.moments)) return '不是人生紀錄的備份檔';
  if (data.profile && (!data.profile.name || !isValidDateStr(data.profile.birthday))) return '個人資料格式不正確';
  for (const m of data.moments) {
    if (!m || typeof m.id !== 'string' || !isValidDateStr(m.date) || typeof m.text !== 'string') return '紀錄格式不正確';
  }
  return null;
}

async function importData(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast('讀不懂這個檔案'); return; }
  const err = validateImport(data);
  if (err) { toast(err); return; }

  const replace = state.moments.length === 0 || confirm(
    `備份檔有 ${data.moments.length} 則紀錄。\n\n按「確定」：整個取代目前資料\n按「取消」：合併（同一則保留較新的版本）`);
  if (replace) {
    state = { ...emptyState(), ...data };
  } else {
    const byId = new Map(state.moments.map((m) => [m.id, m]));
    for (const m of data.moments) {
      const cur = byId.get(m.id);
      if (!cur || (m.updatedAt || '') > (cur.updatedAt || '')) byId.set(m.id, m);
    }
    state.moments = [...byId.values()];
    if (!state.profile) state.profile = data.profile;
  }
  for (const m of state.moments) {
    m.tags = Array.isArray(m.tags) ? m.tags : [];
    m.createdAt = m.createdAt || m.updatedAt || new Date().toISOString();
  }
  if (saveState()) {
    toast(replace ? '已還原備份' : '已合併備份');
    $('#settings-dialog').close();
    render();
  }
}

function renderSettingsStatus() {
  $('#backup-status').textContent = state.lastExportAt
    ? `上次備份：${fmtDate(new Date(state.lastExportAt))}`
    : '尚未備份過';
}

async function renderPersistStatus() {
  const el = $('#persist-status');
  if (!navigator.storage || !navigator.storage.persisted) { el.textContent = ''; return; }
  const persisted = await navigator.storage.persisted();
  el.textContent = persisted ? '✓ 瀏覽器已允許長期保存資料' : '瀏覽器可能在空間不足時清除資料，請定期備份';
}

function openSettings() {
  const form = $('#profile-form');
  form.name.value = state.profile.name;
  form.birthday.value = state.profile.birthday;
  form.birthday.max = todayStr();
  renderSettingsStatus();
  renderPersistStatus();
  $('#settings-dialog').showModal();
}

// ---------- 綁定事件 ----------
function bind() {
  $('#setup-form').birthday.max = todayStr();
  $('#setup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (saveProfile(e.target)) {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
      render();
    }
  });

  $('#add-btn').addEventListener('click', () => openMoment());
  $('#moment-form').addEventListener('submit', saveMoment);
  $('#moment-form').date.addEventListener('input', updateAgeHint);
  $('#moment-delete').addEventListener('click', deleteMoment);

  $('#open-settings').addEventListener('click', openSettings);
  $('#profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (saveProfile(e.target)) { toast('已儲存'); render(); }
  });
  $('#export-btn').addEventListener('click', exportData);
  $('#banner-export').addEventListener('click', exportData);
  $('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) importData(file);
  });
  $('#reset-btn').addEventListener('click', () => {
    if (!confirm('確定要清除所有資料嗎？建議先匯出備份。')) return;
    if (!confirm('真的要清除嗎？這個動作無法復原。')) return;
    state = emptyState();
    saveState();
    $('#settings-dialog').close();
    render();
  });

  $('#search').addEventListener('input', (e) => { ui.query = e.target.value.trim(); renderTimeline(); });

  document.querySelectorAll('[data-close]').forEach((btn) =>
    btn.addEventListener('click', () => btn.closest('dialog').close()));
  // 點對話框外的遮罩也可以關閉
  document.querySelectorAll('dialog').forEach((dlg) =>
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }));

  // 跨日或從背景回來時更新年齡與進度
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
}

bind();
render();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
