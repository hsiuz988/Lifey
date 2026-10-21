import * as db from './db.js';
import { createZip, readZip } from './zip.js';
import { processPhoto, makeThumb } from './photos.js';
import { STATS, statsFor, countsToward, ACHIEVEMENTS, unlockedNow } from './game.js';
import {
  SKINS, HAIRS, OUTFIT_COLORS, GENDERS, HAIR_STYLES, EYES, BEARDS, OUTFITS,
  normalizeAvatar, randomAvatar, composeAvatar, drawAvatar, avatarSvg, W as AVATAR_W,
} from './avatar.js';
import { Scene, propsForTags, festivalOf } from './scene.js';
import { Room, lookHtml, LOOKS, normalizeLook, faceFor, looksFor, STYLES } from './room.js';
import * as weather from './weather.js';
import { moodFace } from './moods.js';
import { initJoys, renderJoyRow, openJoyList, mergeJoyData, shownImprints } from './joys.js';
import { initMusic, setMusic, musicPref, TRACKS, trackPref, setTrack, nextTrack as nextTrackOf } from './music.js';
import * as cloudApi from './cloud.js';
import { EVENT_CATS, LIFE_EVENTS, eventById, RELATIONS } from './events.js';
import * as world from './world.js';
import { EMOTIONS, emotionByKey, detectEmotion, detectItems, ITEMS, flowerGrid, drawFlower, flowerStage, dayFlower, FLOWER_W, FLOWER_H } from './garden.js';
import { PET_TYPES, PET_ICONS, PET_COLORS, petSvg, petSwatchStyle } from './pets.js';

// ---------- 常數 ----------
const LEGACY_KEY = 'lifelog.v1'; // 階段 1 存在 localStorage 的資料
const DATA_VERSION = 2;
// 列表前面的小臉：有選情緒就用它，沒有就用 1–5 分對應的表情
const MOOD_KEYS = ['sad', 'tired', 'calm', 'happy', 'excited'];
const momentFace = (m) => (m.emo && emotionByKey(m.emo) ? moodFace(m.emo, 16) : m.mood ? moodFace(MOOD_KEYS[m.mood - 1], 16) : null);
const MOOD_COLORS = ['#cfcbe0', '#c4dbe9', '#c7e8dd', '#ffdcb2', '#f7b3c6'];
const DEFAULT_TAGS = ['家人', '朋友', '愛情', '寵物', '工作', '學習', '健康', '運動', '旅行', '興趣', '里程碑'];
// 依寫的字建議標籤（不會自動加上，點了才算）：每個詞有自己的小圖示，第一個是標籤本身的
const TAG_WORDS = {
  家人: ['👨‍👩‍👧', ['爸', '👨'], ['媽', '👩'], ['家人', '🏠'], ['阿嬤', '👵'], ['外婆', '👵'], ['奶奶', '👵'], ['阿公', '👴'], ['外公', '👴'], ['爺爺', '👴'], ['哥', '👦'], ['姊', '👧'], ['姐', '👧'], ['弟', '👦'], ['妹', '👧'], ['回家', '🏠']],
  朋友: ['🧑‍🤝‍🧑', ['朋友', '🧑‍🤝‍🧑'], ['同學', '🎒'], ['聚餐', '🍻'], ['聚會', '🎉'], ['閨蜜', '👯'], ['同事', '💼']],
  愛情: ['💕', ['約會', '💑'], ['男友', '💙'], ['女友', '💗'], ['老公', '💍'], ['老婆', '💍'], ['告白', '💌'], ['交往', '💕'], ['紀念日', '🌹']],
  寵物: ['🐾', ['狗', '🐶'], ['遛狗', '🐶'], ['貓', '🐱'], ['寵物', '🐾'], ['毛孩', '🐾'], ['兔', '🐰'], ['金魚', '🐠'], ['鸚鵡', '🦜']],
  工作: ['💼', ['上班', '💼'], ['工作', '💼'], ['開會', '🗓'], ['加班', '🌙'], ['公司', '🏢'], ['主管', '👔'], ['專案', '📁'], ['簡報', '📊'], ['面試', '🤝']],
  學習: ['📚', ['書', '📖'], ['閱讀', '📖'], ['讀', '📖'], ['上課', '🏫'], ['考試', '📝'], ['課程', '🎓'], ['學', '✏️'], ['筆記', '📒']],
  健康: ['🩺', ['看醫生', '🩺'], ['生病', '🤒'], ['感冒', '🤧'], ['醫院', '🏥'], ['吃藥', '💊'], ['體檢', '🩺'], ['牙醫', '🦷'], ['睡', '😴']],
  運動: ['🏃', ['跑步', '🏃'], ['健身', '🏋️'], ['游泳', '🏊'], ['瑜珈', '🧘'], ['籃球', '🏀'], ['羽球', '🏸'], ['打球', '⚽'], ['爬山', '⛰️'], ['騎車', '🚴'], ['散步', '🚶'], ['運動', '🏃']],
  旅行: ['✈️', ['出國', '✈️'], ['機場', '🛫'], ['旅行', '🧳'], ['旅遊', '🧳'], ['飯店', '🏨'], ['露營', '🏕️'], ['看海', '🌊']],
  興趣: ['🎨', ['電影', '🎬'], ['畫畫', '🎨'], ['音樂', '🎵'], ['唱歌', '🎤'], ['遊戲', '🎮'], ['看劇', '📺'], ['追劇', '📺'], ['攝影', '📷'], ['拍照', '📷'], ['手作', '🧶'], ['烘焙', '🧁']],
};
// 回傳 [{ tag, icon }]：icon 用文字裡最先出現的那個詞的圖示
function suggestTags(text) {
  const src = text || '';
  return Object.entries(TAG_WORDS).map(([tag, [, ...words]]) => {
    let best = null;
    for (const [w, icon] of words) { const i = src.indexOf(w); if (i >= 0 && (!best || i < best.i)) best = { i, icon }; }
    return best && { tag, icon: best.icon, i: best.i };
  }).filter(Boolean).sort((a, b) => a.i - b.i);
}
const BACKUP_REMIND_DAYS = 30;
const MAP_YEARS = 90;
const MAX_PHOTOS = 4;

// 回憶模式的提示問題，依人生階段不同
const PROMPTS = {
  baby: ['家人說過你小時候的什麼故事？', '你出生時住在哪裡？家裡有誰？', '有這時期的老照片嗎？照片裡發生了什麼事？', '你的名字是誰取的？有什麼意思？'],
  kinder: ['你最早的記憶是什麼？', '還記得幼兒園的名字或老師嗎？', '小時候最喜歡的玩具或卡通是什麼？', '那時候和誰最親？'],
  elementary: ['那年的導師是誰？', '那年最要好的同學是誰？', '下課最常玩什麼？', '那年家裡有沒有發生什麼大事？搬家、轉學、多了弟弟妹妹？', '那年有沒有什麼「第一次」？第一次騎腳踏車、得獎、出遠門？'],
  junior: ['那年最常聽的歌是什麼？', '有參加社團或補習班嗎？', '那年最煩惱的事是什麼？', '那年有沒有喜歡的人？', '那年的好朋友是誰？現在還有聯絡嗎？'],
  senior: ['讀的是哪所學校、什麼類組？', '那年最要好的朋友是誰？', '最難忘的一次出遊或活動？', '那時候想成為什麼樣的人？', '那年最常待的地方是哪裡？'],
  college: ['那年住在哪裡？宿舍還是外宿？', '參加了什麼社團或活動？', '打工做過什麼？', '那年談戀愛了嗎？', '那年最常去的地方是哪裡？'],
  adult: ['那年住在哪裡？', '那年在做什麼工作？', '那年最大的改變是什麼？', '那年去了哪裡旅行？', '那年最感謝的人是誰？', '如果用一個詞形容那一年，會是什麼？'],
  now: ['今年到目前為止，最難忘的事是什麼？', '今年最大的改變是什麼？', '今年最常見面的人是誰？', '今年想完成、但還沒做的事？'],
};
const GRADE_NAMES = ['一', '二', '三', '四', '五', '六'];

// ---------- 狀態 ----------
let state = emptyState();
const ui = {
  filter: 'all', query: '', collapsed: new Set(),
  editingId: null, mood: null, tags: new Set(), photos: [], busy: false,
  yearAge: null, preparedExport: null, recall: { age: 0, q: 0 }, recallDone: false,
  lightbox: { ids: [], index: 0, url: null },
  people: new Set(), event: null, eventCat: 'school', eventFor: 'moment', person: null, openSecs: null, momentSnapshot: null, selAge: null,
};
const thumbUrls = new Map(); // photoId -> Promise<objectURL|null>
const cloud = { me: null, status: 'off', message: '', lastSync: null, timer: null, running: false, again: false, invite: null, inviter: null, inviteLink: null, invitePerson: null, partnerTab: 'timeline', memberId: null, views: new Map() };
let scene = null;

function emptyState() {
  return { version: DATA_VERSION, profile: null, moments: [], years: {}, deleted: {}, people: [], letters: [], joys: [], joyLog: [], imprints: [], prefs: {}, lastExportAt: null, achievements: {} };
}

// 升級舊版資料並補齊欄位
function normalize(data) {
  const out = { ...emptyState(), ...data, version: DATA_VERSION };
  out.years = data.years && typeof data.years === 'object' ? data.years : {};
  out.deleted = data.deleted && typeof data.deleted === 'object' ? data.deleted : {};
  // 舊資料沒有成就紀錄：設成 null，第一次檢查時安靜補上，不會一次跳一堆通知
  out.achievements = data.achievements && typeof data.achievements === 'object' ? data.achievements : null;
  out.moments = data.moments.map((m) => ({
    ...m,
    tags: Array.isArray(m.tags) ? m.tags : [],
    photoIds: Array.isArray(m.photoIds) ? m.photoIds : [],
    approx: !!m.approx,
    shared: !!m.shared,
    people: Array.isArray(m.people) ? m.people : [],
    event: m.event || null,
    createdAt: m.createdAt || m.updatedAt || new Date().toISOString(),
  }));
  out.people = Array.isArray(data.people) ? data.people : [];
  out.letters = Array.isArray(data.letters) ? data.letters : [];
  out.joys = Array.isArray(data.joys) ? data.joys : [];
  out.joyLog = Array.isArray(data.joyLog) ? data.joyLog : [];
  out.imprints = Array.isArray(data.imprints) ? data.imprints : [];
  out.prefs = data.prefs && typeof data.prefs === 'object' ? data.prefs : {};
  delete out.photos;
  return out;
}

async function loadState() {
  const saved = await db.getMeta('state');
  if (saved) return normalize(saved);
  // 從階段 1（localStorage）搬到 IndexedDB，舊資料留一份備查
  let legacy = null;
  try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)); } catch (e) { /* 沒有舊資料 */ }
  if (legacy && legacy.version === 1 && Array.isArray(legacy.moments)) {
    const migrated = normalize(legacy);
    await db.putMeta('state', migrated);
    try {
      localStorage.setItem(`${LEGACY_KEY}.migrated`, localStorage.getItem(LEGACY_KEY));
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) { /* 留著也無妨，下次會直接讀 IndexedDB */ }
    return migrated;
  }
  return emptyState();
}

async function saveState({ fromSync = false } = {}) {
  try {
    await db.putMeta('state', state);
    if (!fromSync) scheduleSync();
    return true;
  } catch (e) {
    toast('儲存失敗：手機空間不足或瀏覽器封鎖，請先匯出備份');
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
const fmtSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function groupByAge(moments) {
  const groups = new Map();
  for (const m of moments) {
    const age = ageAt(state.profile.birthday, m.date);
    if (!groups.has(age)) groups.set(age, []);
    groups.get(age).push(m);
  }
  return groups;
}

const lifeStage = (age) => lifeStageFor(state.profile.birthday, age);

function lifeStageFor(birthday, age) {
  const [by, bm, bd] = birthday.split('-').map(Number);
  const mid = new Date(by + age, bm - 1 + 6, 1); // 用這一歲的年中判斷
  const schoolYear = mid.getMonth() >= 8 ? mid.getFullYear() : mid.getFullYear() - 1;
  const late = bm > 9 || (bm === 9 && bd > 1);
  const grade = schoolYear - (by + 6 + (late ? 1 : 0));
  if (grade < 0) return age < 3 ? { key: 'baby', label: '嬰幼兒時期' } : { key: 'kinder', label: '幼兒園' };
  if (grade < 6) return { key: 'elementary', label: `國小${GRADE_NAMES[grade]}年級` };
  if (grade < 9) return { key: 'junior', label: `國中${GRADE_NAMES[grade - 6]}年級` };
  if (grade < 12) return { key: 'senior', label: `高中${GRADE_NAMES[grade - 9]}年級` };
  if (grade < 16) return { key: 'college', label: `大學${GRADE_NAMES[grade - 12]}年級（如果有念）` };
  return { key: 'adult', label: '出社會' };
}

const yearTitle = (age) => (state.years[String(age)] || {}).title || '';
const yearFocus = (age) => (state.years[String(age)] || {}).focus || null;

function setYearField(age, field, value) {
  const key = String(age);
  const entry = { ...(state.years[key] || {}) };
  if (value) entry[field] = value;
  else delete entry[field];
  delete entry.updatedAt;
  state.years[key] = { ...entry, updatedAt: new Date().toISOString() };
}

const myAvatar = () => normalizeAvatar(state.profile.avatar);
// 有沒有在捏人畫面存過（沒存過時 myAvatar() 也會給預設造型）
const avatarSaved = () => !!(state.profile.avatar && state.profile.avatar.v === 2);

// ---------- 人物 ----------
const personById = (id) => state.people.find((p) => p.id === id) || null;
const personIcon = (p) => (p.kind === 'pet' ? PET_ICONS[p.petType] || '🐾' : '👤');
// 名字可以不填：人物先用關係（例如「媽媽」），寵物用毛色（例如「橘白貓」）
function personName(p) {
  if (p.name) return p.name;
  if (p.kind === 'pet') {
    const coat = (PET_COLORS[p.petType] || [])[p.petColor || 0];
    return coat ? coat.label : (PET_TYPES.find(([k]) => k === p.petType) || [, '寵物'])[1];
  }
  return p.relation || '人物';
}
const personLabel = (p) => `${personIcon(p)} ${personName(p)}`;
// 寵物有沒有去彩虹橋，由「寵物去了彩虹橋」那則紀錄決定（刪掉那則就會回來）
const petGoneMoment = (pet) => state.moments.find((m) => m.event === 'pet-farewell' && m.people.includes(pet.id)) || null;

function peopleByUse() {
  const count = new Map();
  for (const m of state.moments) for (const id of m.people) count.set(id, (count.get(id) || 0) + 1);
  return [...state.people].sort((a, b) => (count.get(b.id) || 0) - (count.get(a.id) || 0) || a.createdAt.localeCompare(b.createdAt));
}

function personAvatarHtml(p) {
  if (p.kind === 'pet') return petSvg(p.petType, p.petColor || 0);
  const link = linkFor(p.id);
  const view = link && cloud.views.get(link.id);
  if (memberReady(view)) return memberAvatarHtml(view);
  return `<span class="person-initial">${personName(p).slice(0, 1)}</span>`;
}

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
// action：{ label, fn } 時，提示旁邊多一顆按鈕（例如「復原」）
function toast(msg, ms = 2600, action = null) {
  const el = $('#toast');
  // 有抽屜打開時，放進最上層的抽屜裡，才不會被蓋住、按鈕也按得到
  const dialogs = [...document.querySelectorAll('dialog[open]')];
  const host = dialogs[dialogs.length - 1] || document.body;
  if (el.parentNode !== host) host.append(el);
  el.replaceChildren(h('span', {}, msg), ...(action ? [h('button', {
    type: 'button', class: 'toast-act', onclick: () => { clearTimeout(toastTimer); el.hidden = true; action.fn(); },
  }, action.label)] : []));
  el.classList.toggle('has-act', !!action);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// 自己畫的確認視窗（取代 confirm／prompt）：按鈕直接寫出結果，不用猜「確定」「取消」是什麼
// actions：[{ label, value, kind: 'primary' | 'danger' }]；點遮罩、✕ 或 Esc 會回傳 null
// typed：要求先輸入這幾個字，危險的按鈕才按得下去
let askResolve = null;
function ask({ title, body = '', actions, typed = null }) {
  const dlg = $('#ask-dialog');
  if (askResolve) askResolve(null);
  const input = typed ? h('input', { 'aria-label': `輸入「${typed}」`, placeholder: `輸入「${typed}」`, autocomplete: 'off' }) : null;
  const done = (value) => { const r = askResolve; askResolve = null; dlg.close(); if (r) r(value); };
  const btns = actions.map((a) => h('button', {
    type: 'button', class: `btn${a.kind ? ` ${a.kind}` : ''}`, onclick: () => done(a.value),
  }, a.label));
  if (input) {
    const gated = btns.filter((b, i) => actions[i].kind === 'danger');
    const sync = () => gated.forEach((b) => { b.disabled = input.value.trim() !== typed; });
    input.addEventListener('input', sync);
    sync();
  }
  $('#ask-body').replaceChildren(
    h('div', { class: 'sheet-top' }, h('h3', {}, title)),
    ...[].concat(body).filter(Boolean).map((p) => (p instanceof Node ? p : h('p', {}, p))),
    ...(input ? [input] : []),
    h('div', { class: 'ask-actions' }, btns));
  return new Promise((resolve) => {
    askResolve = resolve;
    if (!dlg.open) dlg.showModal();
    if (input) input.focus();
  });
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function requestPersist() {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// ---------- 照片網址快取 ----------
function thumbUrl(id) {
  if (!thumbUrls.has(id)) {
    // 找不到（例如還在從雲端下載）就不要快取，下次再試
    thumbUrls.set(id, db.getPhoto(id).then((p) => {
      if (!p) thumbUrls.delete(id);
      return p ? URL.createObjectURL(p.thumb) : null;
    }).catch(() => { thumbUrls.delete(id); return null; }));
  }
  return thumbUrls.get(id);
}

function forgetThumb(id) {
  const p = thumbUrls.get(id);
  if (p) p.then((url) => url && URL.revokeObjectURL(url));
  thumbUrls.delete(id);
}

function hydrateThumbs(root) {
  root.querySelectorAll('img[data-photo-id]').forEach(async (img) => {
    const url = await thumbUrl(img.dataset.photoId);
    if (url) img.src = url;
    else img.closest('.thumb')?.classList.add('missing');
  });
}

// ---------- 畫面 ----------
function render() {
  try { renderAll(); } catch (e) {
    console.error(e);
    toast(`畫面有一部分沒載入：${e.message}`, 8000);
  }
}
function renderAll() {
  const hasProfile = !!state.profile;
  const entering = hasProfile && $('#app').hidden;
  $('#setup').hidden = hasProfile;
  $('#app').hidden = !hasProfile;
  if (entering) window.scrollTo(0, 0); // 從設定頁進來：不要停在設定頁捲到的位置
  if (!hasProfile) return;
  renderHeader();
  renderNow();
  renderQuickNote();
  renderJoyRow();
  renderToday();
  renderMe();
  renderCyHome();
  renderBackupBanner();
  renderLifeMap();
  renderFilters();
  renderTimeline();
  renderAchievements();
  checkAchievements();
}

function renderHeader() {
  const { birthday } = state.profile;
  const today = todayStr();
  const age = ageAt(birthday, today);
  const [start, end] = ageRange(birthday, age);
  const now = parseDate(today);
  const total = daysBetween(start, end) + 1;
  const passed = daysBetween(start, now) + 1;
  $('#hud-age').textContent = `${age} 歲 · 第 ${passed} 天`;
  $('#age-sub').textContent = `${fmtDate(parseDate(birthday))} · ${age} 歲 · 距離 ${age + 1} 歲還有 ${total - passed} 天`;
}

// 累積幸福收藏後回答的那一句，存成今天的一篇日記（記得是哪個小幸福）
async function addJoyDiary({ text, joyId }) {
  const now = new Date().toISOString();
  state.moments.push({ id: newId(), date: todayStr(), approx: false, text, mood: null, tags: [], photoIds: [], people: [], event: null, starred: false, joy: joyId, createdAt: now, updatedAt: now });
  if (!(await saveState())) return;
  toast('寫進日記了 ✏️');
  render();
  if (scene) scene.celebrate({ emo: 'happy' });
}

// MSN 狀態：名字旁邊的小燈，家人來串門子時也看得到
const STATUSES = [
  { key: 'online', label: '在線上', color: '#3cc46a' },
  { key: 'busy', label: '忙碌中', color: '#e5484d' },
  { key: 'brb', label: '馬上回來', color: '#f2b13a' },
  { key: 'away', label: '外出中', color: '#a3adb8' },
  { key: 'alone', label: '想一個人靜靜', color: '#8e7cc3' },
  { key: 'lazy', label: '正在耍廢', color: '#4fa9e8' },
];
const statusOf = (key) => STATUSES.find((x) => x.key === key) || STATUSES[0];
async function setProfileField(field, value) {
  state.profile = { ...state.profile, [field]: value, updatedAt: new Date().toISOString() };
  await saveState();
  render();
}
function toggleStatusMenu(open) {
  const menu = $('#cy-status-menu');
  const show = open ?? menu.hidden;
  menu.hidden = !show;
  $('#cy-status').setAttribute('aria-expanded', String(show));
  if (!show) return;
  const cur = statusOf(state.profile.status).key;
  menu.replaceChildren(h('span', { class: 'cy-status-head' }, '我的狀態'), ...STATUSES.map((x) => h('button', {
    type: 'button', role: 'menuitemradio', 'aria-checked': String(x.key === cur), class: `cy-status-opt${x.key === cur ? ' on' : ''}`,
    onclick: () => { toggleStatusMenu(false); setProfileField('status', x.key); },
  }, h('i', { class: 'cy-dot', style: `--dot: ${x.color}` }), x.label)));
}
function editMsg() {
  const btn = $('#cy-msg'), input = $('#cy-msg-input');
  input.value = state.profile.msg || '';
  if (!input.hidden) return;
  btn.hidden = true; input.hidden = false; input.focus();
  let done = false;
  const finish = (save) => {
    if (done) return; done = true;
    input.hidden = true; btn.hidden = false;
    const v = input.value.trim().slice(0, 40);
    if (save && v !== (state.profile.msg || '')) setProfileField('msg', v);
  };
  input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') finish(false); };
  input.onblur = () => finish(true);
}

// 首頁的迷你小窩：今天／總共記了幾則（全站的數字都用「則」）、個人小卡、最近更新
function renderCyHome() {
  const { name, birthday } = state.profile;
  const today = todayStr();
  const age = ageAt(birthday, today);
  // 最上面：○ 歲又 ○ 天（從今年生日算起）、收藏過幾次小幸福
  const days = daysBetween(ageRange(birthday, age)[0], parseDate(today));
  $('#cy-age-n').textContent = String(age);
  $('#cy-age-d').textContent = days ? `又 ${days} 天` : '生日快樂！';
  $('#cy-joy-count').textContent = String((state.joyLog || []).length);
  $('#cy-title').textContent = name;
  const emo = emotionByKey(todayInScene().emo);
  $('#cy-look').replaceChildren(lookHtml(state.profile.look, faceFor(emo && emo.key), 'look look-head', emo && emo.key));
  // MSN 的狀態和個人訊息（使用者自己選、自己寫）
  const st = statusOf(state.profile.status);
  $('#cy-status-dot').style.setProperty('--dot', st.color);
  $('#cy-status-label').textContent = st.label;
  $('#cy-status').setAttribute('aria-label', `我的狀態：${st.label}，點一下換`);
  const msg = (state.profile.msg || '').trim();
  $('#cy-msg').textContent = msg || '寫下想說的話';
  $('#cy-msg').classList.toggle('empty', !msg);
  const recent = state.moments.slice().sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || ''))).slice(0, 3);
  const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
  $('#cy-news').replaceChildren(...(recent.length ? recent.map((m) => h('button', { type: 'button', class: 'cy-news-item', onclick: () => openMoment(m.id) },
    h('span', { class: 'cy-news-date' }, m.approx ? '這一年' : md(m.date)),
    h('span', { class: 'cy-tag' }, m.photoIds.length ? '[相簿]' : '[日記]'), h('span', { class: 'cy-news-text' }, m.text || '（照片）'), h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')))
    : [h('button', { type: 'button', class: 'cy-news-item cy-news-empty', onclick: () => openMoment() }, h('span', { class: 'cy-news-text' }, '寫下第一筆，小窩就會熱鬧起來'), h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'))]));
  renderCyFamily();
}
// 家人說：連結的家人最近分享的一句話；還沒連結家人就整塊不出現
function renderCyFamily() {
  const links = cloud.me ? cloud.me.links : [];
  $('#cy-family-box').hidden = !links.length;
  if (!links.length) return;
  const said = links.flatMap((l) => {
    const v = cloud.views.get(l.id);
    if (!v || !v.moments) return [];
    return v.moments.filter((m) => m.text).map((m) => ({ m, who: l.name || (v.profile && v.profile.name) || '家人', id: l.id }));
  }).sort((a, b) => b.m.date.localeCompare(a.m.date)).slice(0, 3);
  $('#cy-family').replaceChildren(...(said.length ? said.map(({ m, who, id }) => h('button', { type: 'button', class: 'cy-family-item', onclick: () => openMembers(id) },
    h('span', { class: 'cy-family-text' }, m.text), h('span', { class: 'cy-family-who' }, `${who} · ${m.date.slice(5).replace('-', '/')}`)))
    : [h('p', { class: 'cy-empty' }, '家人還沒有分享紀錄。')]));
}

// 我：個人卡（房間裡的小人）、三個數字、各項摘要
function renderMe() {
  const { name, birthday } = state.profile;
  const today = todayStr();
  const ages = new Set(state.moments.map((m) => ageAt(birthday, m.date)));
  const photos = state.moments.reduce((n, m) => n + m.photoIds.length, 0);
  $('#me-look').replaceChildren(lookHtml(state.profile.look, faceFor(todayInScene().emo), 'look look-head', todayInScene().emo));
  $('#me-name').textContent = name;
  const tile = (n, label) => h('div', { class: 'me-stat' }, h('b', {}, String(n)), h('span', {}, label));
  $('#me-stats').replaceChildren(tile(state.moments.length, '則日記'), tile(photos, '張照片'), tile(state.letters.length, '封信'), tile(`${ages.size}/${ageAt(birthday, today) + 1}`, '個年歲'));
  // 家人與寵物：伴侶、家人在前，寵物在後；點了看人物卡
  const order = (p) => (p.kind === 'pet' ? 2 : p.relation === '伴侶' ? 0 : 1);
  const fam = state.people.slice().sort((a, b) => order(a) - order(b));
  $('#me-family').replaceChildren(...(fam.length ? fam.slice(0, 12).map((p) => {
    const pic = h('span', { class: `person-avatar${p.kind === 'pet' ? ' pet' : ''}` }); pic.innerHTML = personAvatarHtml(p);
    return h('button', { type: 'button', class: 'family-item', onclick: () => openPerson(p.id) }, pic,
      h('span', {}, personName(p)), p.relation && p.kind !== 'pet' ? h('small', {}, p.relation) : null);
  }) : [h('p', { class: 'hint' }, '把伴侶、家人、朋友和寵物加進來，記一筆時可以標「和誰」，也能邀請他們一起用。')]));
  const pets = state.people.filter((p) => p.kind === 'pet').length;
  const sealed = state.letters.filter((l) => !l.openedAt).length;
  $('#me-letters').textContent = readyLetters().length ? `${readyLetters().length} 封可以打開了` : sealed ? `封存 ${sealed} 封` : '寫一封';
  $('#me-cloud').textContent = cloud.me ? (cloud.me.links.length ? `連結 ${cloud.me.links.length} 人` : '邀請家人或好友') : '要先開啟雲端';
  $('#me-weather').textContent = weather.weatherEnabled() ? '已開啟' : '關閉';
  const days = state.lastExportAt ? daysBetween(new Date(state.lastExportAt), new Date()) : null;
  $('#me-backup').textContent = days == null ? '還沒備份' : days < 1 ? '今天備份過' : `${days} 天前備份`;
}

function renderStatBars(el, stats, focus) {
  el.replaceChildren(...STATS.map((s) => h('div', { class: `stat${focus === s.key ? ' focus' : ''}` },
    h('span', { class: 'stat-label' }, s.label, focus === s.key ? ' ★' : ''),
    h('span', { class: 'stat-track' }, h('span', { class: 'stat-fill', style: `width:${stats[s.key]}%;background:${s.color}` })),
    h('span', { class: 'stat-num' }, stats[s.key]))));
}

function renderNow() {
  const { birthday } = state.profile;
  const today = todayStr();
  const age = ageAt(birthday, today);
  const stage = lifeStage(age);
  const list = state.moments.filter((m) => ageAt(birthday, m.date) === age);
  const focus = yearFocus(age);
  if (scene) {
    scene.update({
      stageKey: stage.key, age, avatar: state.profile.avatar || null, birthday,
      props: propsForTags(new Set(list.flatMap((m) => m.tags))), weather: ui.weather, messages: sceneMessages, pets: scenePets(), look: state.profile.look,
      garden: gardenLevel(), quiet: isQuiet(), mail: readyLetters().length > 0, imprints: shownImprints(state), ...todayInScene(),
    });
  }
  const w = ui.weather;
  $('#now-caption').textContent = `${age} 歲 · ${stage.key === 'adult' ? '出社會' : `大約是${stage.label}`} · 今年記了 ${list.length} 則`
    + (w ? ` · ${w.icon} ${w.temp}° ${w.label}` : '');
  $('#hud-weather').hidden = !w;
  if (w) $('#hud-weather').textContent = `${w.icon} ${w.temp}°`;
  renderStatBars($('#stat-bars'), statsFor(list), focus);

  $('#focus-chips').replaceChildren(...STATS.map((s) => h('button', {
    type: 'button', class: `chip${focus === s.key ? ' on' : ''}`,
    onclick: async () => { setYearField(age, 'focus', focus === s.key ? null : s.key); await saveState(); render(); },
  }, s.label)));
  const stat = STATS.find((s) => s.key === focus);
  if (!stat) {
    $('#focus-note').textContent = '選一項今年想多投入的方向，記下相關的事，它就會成長。';
  } else {
    const n = list.filter((m) => countsToward(stat, m)).length;
    const how = stat.key === 'happy' ? '心情 🙂 以上的事' : `標籤是「${stat.tags.join('／')}」的事`;
    $('#focus-note').textContent = n
      ? `今年已經記了 ${n} 則跟「${stat.label}」有關的事，繼續加油！`
      : `記下${how}，「${stat.label}」就會成長。`;
  }
}

// 場景裡的寵物：還在、而且選了「陪著我」的，最多兩隻（最新來的優先）
let lastPetsKey = '';
let lastPets = [];
function scenePets() {
  const pets = state.people.filter((p) => p.kind === 'pet' && p.inScene !== false && !petGoneMoment(p))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2).map((p) => ({ type: p.petType, color: p.petColor || 0, name: personName(p) }));
  const key = JSON.stringify(pets);
  if (key !== lastPetsKey) { lastPetsKey = key; lastPets = pets; } // 沒變就沿用同一個陣列，場景才不會重來
  return lastPets;
}

// 點小人時冒出來的話：節日、天氣、時間、今年的重心
// ---------- 今天的心情、小東西與花園 ----------
// 今天的情緒（最後一則有情緒的）、今天記的事配到的小圖（最多兩個）、最近三天的花
function todayInScene() {
  const today = todayStr();
  const mine = state.moments.filter((m) => m.date === today && !m.approx)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const withEmo = mine.find((m) => m.emo);
  const items = [...new Set(mine.flatMap((m) => (m.item ? [m.item] : detectItems(m.text))))].filter((k) => ITEMS[k]).slice(0, 4);
  return { emo: withEmo ? withEmo.emo : null, items, flowers: recentFlowers(3) };
}

// 有紀錄的日子 → 那天的花（只算有確切日期的）
function flowersByDay() {
  const days = new Map();
  for (const m of state.moments) {
    if (m.approx) continue;
    if (!days.has(m.date)) days.set(m.date, []);
    days.get(m.date).push(m);
  }
  return days;
}
function recentFlowers(n) {
  const today = parseDate(todayStr());
  return [...flowersByDay()].sort((a, b) => a[0].localeCompare(b[0])).slice(-n)
    .map(([date, list]) => ({ ...dayFlower(list), stage: flowerStage(daysBetween(parseDate(date), today)) }));
}

function flowerCanvas(f, cls = '') {
  const cv = h('canvas', { class: cls, width: String(FLOWER_W + 2), height: String(FLOWER_H + 2), 'aria-hidden': 'true' });
  drawFlower(cv.getContext('2d'), flowerGrid(f.emo, f.mood, f.stage), 1, 1);
  return cv;
}

function openGarden(year, month) {
  const now = parseDate(todayStr());
  const birth = parseDate(state.profile.birthday);
  if (year == null) { year = now.getFullYear(); month = now.getMonth(); }
  const first = new Date(year, month, 1);
  const days = flowersByDay();
  const inMonth = [...days.keys()].filter((d) => d.startsWith(`${year}-${pad(month + 1)}-`));
  const count = {};
  inMonth.forEach((d) => { const f = dayFlower(days.get(d)); count[f.emo] = (count[f.emo] || 0) + 1; });
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  const go = (dm) => { const d = new Date(year, month + dm, 1); openGarden(d.getFullYear(), d.getMonth()); };
  const canPrev = first > new Date(birth.getFullYear(), birth.getMonth(), 1);
  const canNext = new Date(year, month + 1, 1) <= now;
  const detail = h('div', { class: 'garden-detail' }, h('p', { class: 'hint' }, inMonth.length ? '點一朵花，看那天記了什麼' : '這個月還沒有花。記下一句話，就會種下一朵 🌱'));

  const showDay = (date, cell) => {
    $('#garden-body').querySelectorAll('.garden-day.sel').forEach((el) => el.classList.remove('sel'));
    cell.classList.add('sel');
    const list = days.get(date).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const f = dayFlower(list);
    const emo = emotionByKey(f.emo);
    const d = parseDate(date);
    detail.replaceChildren(h('div', { class: 'garden-card' },
      h('small', {}, `${pad(d.getMonth() + 1)}/${pad(d.getDate())}（${'日一二三四五六'[d.getDay()]}）· `, emo ? moodFace(emo.key, 16) : null, emo ? ` ${emo.label}` : ''),
      ...list.map((m) => h('button', { type: 'button', class: 'garden-entry', onclick: () => { $('#garden-dialog').close(); openMoment(m.id); } },
        m.story ? h('b', {}, m.story.title) : null,
        h('span', {}, m.story ? m.story.text : m.text),
        m.feel && !m.story ? h('span', { class: 'moment-feel' }, m.feel) : null))));
  };

  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(h('div', { class: 'garden-day empty' }));
  const last = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= last; day++) {
    const date = `${year}-${pad(month + 1)}-${pad(day)}`;
    const d = new Date(year, month, day);
    const list = days.get(date);
    const label = h('span', { class: 'garden-num' }, String(day));
    if (!list) { cells.push(h('div', { class: `garden-day${d > now ? ' future' : ''}` }, label)); continue; }
    const f = { ...dayFlower(list), stage: flowerStage(daysBetween(d, now)) };
    const emo = emotionByKey(f.emo);
    const cell = h('button', { type: 'button', class: 'garden-day has', 'aria-label': `${month + 1} 月 ${day} 日 ${emo ? emo.label : ''}` }, label, flowerCanvas(f));
    cell.addEventListener('click', () => showDay(date, cell));
    cells.push(cell);
  }

  $('#garden-body').replaceChildren(
    h('div', { class: 'sheet-top garden-head' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '上個月', disabled: !canPrev, onclick: () => go(-1) }, '‹'),
      h('h3', {}, `🌷 ${year} 年 ${month + 1} 月的花園`),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '下個月', disabled: !canNext, onclick: () => go(1) }, '›')),
    h('p', { class: 'hint garden-sum' }, inMonth.length
      ? `這個月開了 ${inMonth.length} 朵花${top ? `，最常出現的是「${emotionByKey(top[0]).label}」` : ''}` : ''),
    h('div', { class: 'garden-week' }, ...'日一二三四五六'.split('').map((c) => h('span', {}, c))),
    h('div', { class: 'garden-bed' }, ...cells),
    detail,
    h('details', { class: 'garden-legend' }, h('summary', {}, '每種花代表什麼？'),
      h('p', { class: 'hint' }, '花的種類是那天的情緒，顏色是心情好壞（越開心越暖、越低落越灰藍）。今天種下的是小芽，過兩天才開花；沒記錄的日子不會有枯萎的花。'),
      h('div', { class: 'legend-grid' }, ...EMOTIONS.map((e) => h('span', {}, flowerCanvas({ emo: e.key, mood: 4, stage: 'bloom' }, 'legend-flower'), `${e.flower}＝${e.label}`)))),
    h('div', { class: 'sheet-actions' }, h('span', { class: 'spacer' }), h('button', { type: 'button', class: 'btn primary', onclick: () => $('#garden-dialog').close() }, '關閉')));
  if (!$('#garden-dialog').open) $('#garden-dialog').showModal();
}

function sceneMessages() {
  const { birthday } = state.profile;
  const now = new Date();
  const hour = now.getHours();
  const age = ageAt(birthday, todayStr());
  const out = ['今天有什麼值得記住的嗎？', '要記一筆嗎？✏️', `你已經記了 ${state.moments.length} 則回憶了`];
  // 今天寫成故事的那一句，小人會說出來；累或難過的時候說溫柔一點的話
  const todays = state.moments.filter((m) => m.date === todayStr());
  const story = todays.filter((m) => m.story).pop();
  if (story) out.push(story.story.text, story.story.text, story.story.text);
  const emo = todayInScene().emo;
  const kind = { tired: '今天辛苦了，早點休息吧', sad: '不開心的時候，我陪你坐一下', nervous: '深呼吸，會沒事的', angry: '氣消了再說，先喝口水', miss: '想念的人，也會想著你吧', excited: '耶！今天好棒！', love: '心裡甜甜的 💗' }[emo];
  if (kind) out.push(kind, kind);
  const gap = daysSinceLastRecord();
  if (gap != null && gap >= 3) out.push('好想你，最近過得好嗎？', '想到什麼就記一句吧，我在這裡等你 🌱');
  if (readyLetters().length) out.push('有一封信在等我打開 ✉️', '有一封信在等我打開 ✉️');
  if (gardenLevel() >= 1) out.push('院子裡的花是你一則一則記出來的 🌼');
  const fest = {
    birthday: '生日快樂！🎂 又長大一歲了', lny: '新年快樂！🧧', midautumn: '中秋節快樂 🥮', christmas: '聖誕快樂 🎄', newyear: '新年快樂！🎆',
  }[festivalOf(now, birthday)];
  if (fest) out.push(fest, fest, fest);
  const w = ui.weather;
  if (w) {
    const say = {
      rain: '下雨了，出門記得帶傘 ☔', heavyrain: '雨好大，待在室內也不錯', thunder: '打雷了，注意安全 ⚡', drizzle: '飄著毛毛雨～',
      fog: '起霧了，慢慢來', snow: '下雪了！好冷 ❄️', clear: hour >= 6 && hour < 18 ? '天氣真好 ☀️' : '今晚天空很清楚 ✨',
    }[w.kind];
    if (say) out.push(say, say);
    if (w.temp >= 32) out.push('好熱，記得多喝水 💧');
    if (w.temp <= 14) out.push('有點冷，多穿一件 🧣');
  }
  if (hour >= 23 || hour < 5) out.push('這麼晚了，早點休息 🌙');
  else if (hour < 10) out.push('早安！今天想做什麼？');
  const stat = STATS.find((s) => s.key === yearFocus(age));
  if (stat) out.push(`今年的重心是「${stat.label}」，一起加油！`);
  for (const pet of scenePets()) out.push(`${pet.name} 在旁邊陪著你 🐾`);
  // 好一陣子沒一起記錄的人
  const last = new Map();
  for (const m of state.moments) for (const id of m.people) if (!last.has(id) || m.date > last.get(id)) last.set(id, m.date);
  const quiet = state.people.filter((p) => p.kind === 'person' && !p.hideInMemories && last.has(p.id) && daysBetween(parseDate(last.get(p.id)), new Date()) > 60);
  if (quiet.length) out.push(`好久沒記到 ${personName(quiet[Math.floor(Math.random() * quiet.length)])} 了，最近好嗎？`);
  return out;
}

function achievementContext() {
  const { birthday } = state.profile;
  const byAge = groupByAge(state.moments);
  const recorded = new Set(byAge.keys());
  Object.keys(state.years).forEach((k) => { if (state.years[k].title) recorded.add(Number(k)); });
  return {
    moments: state.moments, byAge, recorded,
    current: ageAt(birthday, todayStr()),
    photos: state.moments.reduce((n, m) => n + m.photoIds.length, 0),
    titles: Object.values(state.years).filter((y) => y.title).length,
    focusSet: Object.values(state.years).some((y) => y.focus),
    backedUp: !!state.lastExportAt,
  };
}

// 成就一旦解鎖就保留（之後刪掉紀錄也不會收回），像遊戲一樣
function checkAchievements() {
  const now = new Date().toISOString();
  const ids = unlockedNow(achievementContext());
  if (!state.achievements) {
    state.achievements = Object.fromEntries(ids.map((id) => [id, now]));
    saveState();
    renderAchievements();
    return;
  }
  const fresh = ids.filter((id) => !state.achievements[id]);
  if (!fresh.length) return;
  fresh.forEach((id) => { state.achievements[id] = now; });
  saveState();
  renderAchievements();
  if (!state.prefs.showAchievements) return; // 隱藏時只在背後記錄，不打擾
  const first = ACHIEVEMENTS.find((a) => a.id === fresh[0]);
  toast(`🏅 解鎖成就：${first.icon} ${first.name}${fresh.length > 1 ? ` 等 ${fresh.length} 個` : ''}`, 3500);
  if (scene) scene.celebrate({ text: `解鎖成就：${first.icon} ${first.name}` });
}

function renderAchievements() {
  $('#achievements-panel').hidden = !state.prefs.showAchievements;
  const got = state.achievements || {};
  const count = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  $('#ach-count').textContent = `已解鎖 ${count} / ${ACHIEVEMENTS.length}`;
  $('#achievements').replaceChildren(...ACHIEVEMENTS.map((a) => {
    const at = got[a.id];
    return h('div', { class: `badge${at ? ' on' : ''}`, title: at ? `${fmtDate(new Date(at))} 解鎖` : '尚未解鎖' },
      h('span', { class: 'badge-icon' }, at ? a.icon : '🔒'),
      h('span', { class: 'badge-name' }, a.name),
      h('span', { class: 'badge-desc' }, a.desc));
  }));
}

function renderBackupBanner() {
  const banner = $('#backup-banner');
  // 登入雲端後，雲端就是備份
  if (state.moments.length === 0 || cloud.me) { banner.hidden = true; return; }
  if (!state.lastExportAt) {
    $('#backup-text').textContent = '還沒備份過。資料只存在這支手機裡。';
    banner.hidden = false;
    return;
  }
  const days = daysBetween(new Date(state.lastExportAt), new Date());
  banner.hidden = days < BACKUP_REMIND_DAYS;
  $('#backup-text').textContent = `已經 ${days} 天沒有備份了。`;
}

// 人生地圖：一格一年，顏色是那一年的平均心情
function renderLifeMap() {
  const current = ageAt(state.profile.birthday, todayStr());
  const byAge = groupByAge(state.moments);
  let happiest = null;
  let lit = 0;
  const cells = [];

  for (let age = 0; age < MAP_YEARS; age++) {
    const list = byAge.get(age) || [];
    const moods = list.map((m) => m.mood).filter(Boolean);
    const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
    const stars = list.filter((m) => m.starred).length;
    const title = yearTitle(age);
    const big = list.map((m) => eventById(m.event)).find((e) => e && e.big) || list.map((m) => eventById(m.event)).find(Boolean);
    if (avg && moods.length >= 3 && (!happiest || avg > happiest.avg)) happiest = { age, avg }; // 至少 3 則有心情才算，免得記一則就說「最幸福」

    if (list.length >= LIT_AT) lit++;
    const cls = ['cell',
      age > current && 'future', age === current && 'now',
      (list.length || title) && 'filled', list.length >= LIT_AT && 'lit', stars && 'starred'].filter(Boolean).join(' ');
    const style = avg ? `--c:${MOOD_COLORS[Math.round(avg) - 1]};--c-text:#2c2c30` : null;

    if (age > current) {
      const sealed = state.letters.filter((l) => !l.openedAt && l.toAge === age).length;
      cells.push(h('button', {
        type: 'button', class: `${cls}${sealed ? ' has-letter' : ''}`, 'aria-label': `寫信給 ${age} 歲的自己${sealed ? `（已封存 ${sealed} 封）` : ''}`,
        onclick: () => openLetterEditor(age),
      }, sealed ? '✉️' : age));
    } else {
      const label = `${age} 歲${big ? ` ${big.label}` : ''}${title ? `：${title}` : ''} · ${list.length} 則${stars ? ` · ☆${stars}` : ''}`;
      cells.push(h('button', {
        type: 'button', class: `${cls}${big ? ' has-event' : ''}${age === selectedAge() && ui.filter === 'all' && !ui.query ? ' selected' : ''}`,
        style, title: label, 'aria-label': label, 'aria-pressed': String(age === selectedAge()), onclick: () => openYear(age), // 在地圖上看這一歲，不跳分頁
      },
        big ? h('span', { class: 'cell-event' }, big.icon) : age));
    }
  }

  $('#life-map').replaceChildren(...cells);
  const resume = state.recall && state.recall.age > 0 && state.recall.age <= current;
  $('#recall-btn').textContent = resume ? `🕰 繼續回憶（${state.recall.age} 歲）` : '🕰 回憶模式';
  const recorded = new Set([...byAge.keys(), ...Object.keys(state.years).filter((k) => state.years[k].title).map(Number)]).size;
  $('#map-summary').textContent = `已記錄 ${recorded} / ${current + 1} 個年歲 · 點亮 ${lit} 格（一歲記滿 ${LIT_AT} 則就會亮）${happiest ? ` · 最幸福的一歲：${happiest.age} 歲` : ''}`;
}

function allTags() {
  const tags = new Set(DEFAULT_TAGS);
  state.moments.forEach((m) => m.tags.forEach((t) => tags.add(t)));
  return [...tags];
}

function renderFilters() {
  const used = new Set(state.moments.flatMap((m) => m.tags));
  const usedPeople = new Set(state.moments.flatMap((m) => m.people));
  const options = [['all', '全部'], ['star', '☆ 值得記住'], ['photo', '📷 有照片'], ['event', '⭐ 人生大事'],
    ...peopleByUse().filter((p) => usedPeople.has(p.id)).slice(0, 8).map((p) => [`person:${p.id}`, personLabel(p)]),
    ...allTags().filter((t) => used.has(t)).map((t) => [`tag:${t}`, t])];
  if (!options.some(([v]) => v === ui.filter)) ui.filter = 'all';
  $('#filter-chips').replaceChildren(...options.map(([value, label]) =>
    h('button', {
      class: `chip${ui.filter === value ? ' on' : ''}`, type: 'button',
      onclick: () => { ui.filter = value; renderFilters(); renderTimeline(); },
    }, label)));
}

function matchesFilter(m) {
  if (ui.filter === 'star' && !m.starred) return false;
  if (ui.filter === 'photo' && m.photoIds.length === 0) return false;
  if (ui.filter === 'event' && !m.event) return false;
  if (ui.filter.startsWith('person:') && !m.people.includes(ui.filter.slice(7))) return false;
  if (ui.filter.startsWith('tag:') && !m.tags.includes(ui.filter.slice(4))) return false;
  if (ui.query && ![m.text, m.feel, m.story && m.story.title, m.story && m.story.text].some((t) => t && t.toLowerCase().includes(ui.query.toLowerCase()))) return false;
  return true;
}

// 現在選中的是哪一歲（預設今年）
function selectedAge() {
  const current = ageAt(state.profile.birthday, todayStr());
  return ui.selAge == null ? current : Math.max(0, Math.min(current, ui.selAge));
}

function selectAge(age, scroll = false) {
  ui.selAge = age;
  ui.filter = 'all';
  ui.query = '';
  $('#search').value = '';
  renderLifeMap();
  renderFilters();
  renderTimeline();
  if (scroll) showTab('memories');
}

function renderTimeline() {
  const { birthday } = state.profile;
  const root = $('#timeline');
  // 有篩選或搜尋時，跨所有年份列出結果（最新的在前）
  if (ui.filter !== 'all' || ui.query) { renderSearchResults(root); return; }

  const age = selectedAge();
  const current = ageAt(birthday, todayStr());
  const [start, end] = ageRange(birthday, age);
  const last = age === current ? parseDate(todayStr()) : end;
  // 舊版的「只看我的」已經不需要了（世界大事本來就收起來），當成「全部」
  const mode = ['tw', 'world'].includes(state.prefs.worldMode) ? state.prefs.worldMode : 'all';
  const showSad = state.prefs.worldSad !== false;
  const mine = state.moments.filter((m) => ageAt(birthday, m.date) === age);
  let events = world.eventsBetween(start, last, () => { if (selectedAge() === age) renderTimeline(); });
  const waiting = events === null;
  events = (events || []).filter((e) => showSad || !e.sad);
  const shown = events.filter((e) => mode === 'all' || e.region === mode)
    .sort((a, b) => (a.m ? world.eventDate(a).getTime() : 0) - (b.m ? world.eventDate(b).getTime() : 0));

  // 自己的紀錄和打開過的信：新的在上面（同一天時，後記的在上面）；只記得這一歲的排在最後
  const letters = state.letters.filter((l) => l.openedAt && ageAt(birthday, l.openOn) === age);
  const rows = [
    ...mine.map((m) => ({ t: m.approx ? 0 : parseDate(m.date).getTime() + 1, c: m.createdAt || '', el: () => renderMoment(m) })),
    ...letters.map((l) => ({ t: parseDate(l.openOn).getTime() + 2, c: l.openedAt, el: () => renderLetterItem(l) })),
  ].sort((a, b) => b.t - a.t || b.c.localeCompare(a.c));

  // 那一年的世界：收成一列，點了才展開；展開後可以選台灣／全球
  const worldBox = events.length || waiting ? h('section', { class: `world-box${ui.worldOpen ? ' open' : ''}` },
    h('button', {
      type: 'button', class: 'world-toggle', 'aria-expanded': String(!!ui.worldOpen),
      onclick: () => { ui.worldOpen = !ui.worldOpen; renderTimeline(); },
    }, h('span', {}, `🌏 ${age} 歲那一年的世界`), h('span', { class: 'world-count' }, waiting ? '載入中…' : `${events.length} 件 ${ui.worldOpen ? '▴' : '▾'}`)),
    ui.worldOpen ? h('div', { class: 'chips world-modes' }, [['all', '全部'], ['tw', '台灣'], ['world', '全球']].map(([v, label]) => h('button', {
      type: 'button', class: `chip${mode === v ? ' on' : ''}`,
      onclick: async () => { state.prefs = { ...state.prefs, worldMode: v }; renderTimeline(); await saveState(); },
    }, label))) : null,
    ui.worldOpen ? h('ul', { class: 'moments' }, shown.map((e) => renderWorldEvent(e, age))) : null) : null;

  const title = yearTitle(age);
  const stars = mine.filter((m) => m.starred).length;
  const nav = (delta, label, text) => h('button', {
    type: 'button', class: 'icon-btn year-nav', 'aria-label': label, disabled: age + delta < 0 || age + delta > current,
    onclick: () => selectAge(age + delta),
  }, text);
  root.replaceChildren(
    h('div', { class: 'year-head' },
      nav(-1, '上一歲', '‹'),
      h('div', { class: 'year-head-main' },
        h('span', { class: 'age-label' }, `${age} 歲`),
        h('span', { class: 'age-range' }, `${fmtDate(start)} – ${fmtDate(end)}`),
        h('span', { class: 'age-count' }, `${mine.length} 則${stars ? ` · ☆${stars}` : ''}`)),
      nav(1, '下一歲', '›')),
    h('button', { class: `year-title-btn${title ? '' : ' empty'}`, type: 'button', onclick: () => openYear(age) },
      title ? `「${title}」` : '＋ 這一歲的一句話'),
    rows.length ? h('ul', { class: 'moments' }, rows.map((r) => r.el()))
      : h('div', { class: 'empty' }, h('p', { class: 'muted' }, '這一歲還沒有紀錄。')),
    h('div', { class: 'row year-add' }, h('button', {
      type: 'button', class: 'btn', onclick: () => openMoment(null, age === current ? {} : { date: toDateStr(start), approx: true }),
    }, `＋ 在 ${age} 歲記一筆`)),
    worldBox);
  hydrateThumbs(root);
}

// 那一年的世界：字小一點、淡一點，旁邊可以「我記得」
function renderWorldEvent(e, age) {
  return h('li', { class: `world-item${e.sad ? ' sad' : ''}` },
    h('span', { class: 'moment-date' }, e.m ? `${String(e.m).padStart(2, '0')} 月` : '這年'),
    h('div', { class: 'moment-main' },
      h('span', { class: 'world-meta' }, `${world.CATS[e.cat] || '🌏'} ${world.REGIONS[e.region] || ''} · ${world.eventDateLabel(e)}`),
      h('b', { class: 'world-title' }, e.title),
      e.text ? h('span', { class: 'world-text' }, e.text) : null),
    h('button', { type: 'button', class: 'btn small remember-btn', onclick: () => rememberWorldEvent(e, age) }, '✏️ 我記得'));
}

// 「我記得」：開一則新的紀錄，日期帶到那件事，開頭寫好那件事
function rememberWorldEvent(e, age) {
  const { birthday } = state.profile;
  const [start, end] = ageRange(birthday, age);
  const today = parseDate(todayStr());
  let d = e.m ? new Date(e.y, e.m - 1, e.d || 1) : new Date(e.y, 6, 1);
  if (d < start) d = start;
  if (d > end) d = end;
  if (d > today) d = today;
  openMoment(null, { date: toDateStr(d), approx: !e.d, text: `${e.title}那時候，` });
}

function renderSearchResults(root) {
  const { birthday } = state.profile;
  const items = state.moments.filter(matchesFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const back = h('button', { type: 'button', class: 'link-btn', onclick: () => selectAge(selectedAge()) }, `‹ 回到 ${selectedAge()} 歲`);
  if (items.length === 0) {
    root.replaceChildren(back, h('div', { class: 'empty' }, h('p', { class: 'muted' }, '沒有符合條件的紀錄。')));
    return;
  }
  root.replaceChildren(back, ...[...groupByAge(items)].map(([age, list]) => {
    const [start, end] = ageRange(birthday, age);
    return h('section', { class: 'age-group', id: `age-${age}` },
      h('button', { class: 'age-head', type: 'button', onclick: () => selectAge(age) },
        h('span', { class: 'age-label' }, `${age} 歲`),
        h('span', { class: 'age-range' }, `${fmtDate(start)} – ${fmtDate(end)}`),
        h('span', { class: 'age-count' }, `${list.length} 則 ›`)),
      h('ul', { class: 'moments' }, list.map(renderMoment)));
  }));
  hydrateThumbs(root);
}

// 自己選的情緒，或寫了心情時自動判斷的情緒，顯示在心情前面
const emoTag = (m) => { const e = emotionByKey(m.emo); return e && (m.feel || !m.emoAuto) ? h('span', { class: 'emo-tag' }, moodFace(e.key, 16), e.label) : null; };

function renderMoment(m) {
  const d = parseDate(m.date);
  return h('li', { class: `moment${m.starred ? ' starred' : ''}` },
    h('span', { class: 'moment-date' }, m.approx ? '這一年' : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`),
    h('div', { class: 'moment-main' },
      h('button', { class: 'moment-body', type: 'button', onclick: () => openMoment(m.id) },
        h('span', { class: 'moment-text' }, eventById(m.event) ? h('span', { class: 'event-icon' }, `${eventById(m.event).icon} `) : null,
          momentFace(m), m.story ? h('b', { class: 'story-title' }, m.story.title) : m.text,
          m.shared ? h('span', { class: 'shared-mark', title: '已分享' }, ' 💞') : null),
        m.story ? h('span', { class: 'story-text' }, m.story.text) : null,
        // 有故事版時，原文和心情縮小放在下面；沒有時心情接在事件下面
        m.story ? h('span', { class: 'moment-orig' }, `✏️ ${m.text}${m.feel ? `　${m.feel}` : ''}`)
          : m.feel || (m.emo && !m.emoAuto) ? h('span', { class: 'moment-feel' }, emoTag(m), m.feel ? ` ${m.feel}` : null) : null,
        m.tags.length ? h('span', { class: 'moment-tags' }, m.tags.map((t) => h('span', { class: 'tag' }, t))) : null),
      m.people.length ? h('div', { class: 'moment-people' }, m.people.map(personById).filter(Boolean).map((p) =>
        h('button', { type: 'button', class: 'person-chip', onclick: () => openPerson(p.id) }, personLabel(p)))) : null,
      m.photoIds.length ? h('div', { class: 'moment-photos' }, m.photoIds.map((id, i) =>
        h('button', { type: 'button', class: 'thumb', 'aria-label': '看大圖', onclick: () => openLightbox(m.photoIds, i) },
          h('img', { alt: '', 'data-photo-id': id, decoding: 'async' })))) : null),
    h('button', {
      class: 'star-btn', type: 'button', 'aria-label': m.starred ? '取消標記' : '標記為值得記住',
      onclick: () => toggleStar(m.id),
    }, m.starred ? '★' : '☆'));
}

// ---------- 時刻 ----------
async function toggleStar(id) {
  const m = state.moments.find((x) => x.id === id);
  if (!m) return;
  m.starred = !m.starred;
  m.updatedAt = new Date().toISOString();
  await saveState();
  render();
}

async function openMoment(id = null, preset = {}) {
  const form = $('#moment-form');
  const m = id ? state.moments.find((x) => x.id === id) : null;
  ui.editingId = m ? m.id : null;
  ui.mood = m ? m.mood || null : null;
  ui.baseMood = ui.mood; // 舊紀錄的心情程度（沒有情緒時用）
  ui.emo = m ? m.emo || null : null;
  ui.emoManual = !!(m && m.emo && !m.emoAuto);
  ui.tags = new Set(m ? m.tags : []);
  ui.people = new Set(m ? m.people : []);
  ui.event = m ? m.event : preset.event || null;
  ui.photos = m ? await Promise.all(m.photoIds.map(async (pid) => ({ id: pid, existing: true, url: await thumbUrl(pid) }))) : [];
  $('#moment-title').textContent = m ? '編輯時刻' : '記一筆';
  form.date.value = m ? m.date : preset.date || todayStr();
  form.date.min = state.profile.birthday;
  form.date.max = todayStr();
  form.text.value = m ? m.text : preset.text || '';
  form.feel.value = m ? m.feel || '' : '';
  // 舊紀錄只有心情程度、沒有情緒時，用程度推一個情緒出來（之後存檔會照情緒重算程度）
  renderEmoPicker();
  form.starred.checked = m ? !!m.starred : false;
  form.approx.checked = m ? m.approx : !!preset.approx;
  $('#moment-menu').hidden = !m;
  $('#moment-menu-list').hidden = true;
  $('#moment-story').hidden = !(m && storyOn());
  $('#moment-story').textContent = m && m.story ? '✨ 重寫故事' : '✨ 寫成故事';
  $('#moment-story-remove').hidden = !(m && m.story);
  // 一開始只有輸入框和心情；編輯有填「更多」裡東西的舊紀錄時，才把「更多」打開
  ui.openSecs = new Set();
  if (m && (m.people.length || m.tags.length || m.event || m.starred || m.shared)) ui.openSecs.add('more');
  if (!m && preset.date) ui.openSecs.add('date');
  form.shared.checked = m ? m.shared : false;
  const links = cloud.me ? cloud.me.links : [];
  $('#share-row').hidden = !links.length;
  if (links.length) {
    const names = links.map((l) => l.name);
    $('#share-label').textContent = `💞 分享給 ${names.length > 3 ? `${names.slice(0, 2).join('、')} 等 ${names.length} 人` : names.join('、')}`;
  }
  renderTagPicker();
  renderPhotoPicker();
  renderPeoplePicker();
  renderEventBadge();
  updateAgeHint();
  $('#moment-dialog').showModal();
  if (!m && preset.event) applyEvent(eventById(preset.event));
  else if (!m) { form.text.focus(); form.text.setSelectionRange(form.text.value.length, form.text.value.length); }
  ui.momentSnapshot = preset.text ? null : momentSnapshot();
}

// 用來判斷有沒有改過，關閉時才知道要不要問「放棄這筆嗎？」
function momentSnapshot() {
  const form = $('#moment-form');
  return JSON.stringify([form.text.value, form.feel.value, form.date.value, form.approx.checked, form.starred.checked, ui.mood, ui.emo, [...ui.tags], [...ui.people], ui.event, ui.photos.map((p) => p.id)]);
}
const momentDirty = () => $('#moment-dialog').open && ui.momentSnapshot != null && momentSnapshot() !== ui.momentSnapshot;

// 抽屜上的狀態：日期標籤、「更多」的摘要和每一列的值、「記下來」按鈕
function renderOptBar() {
  const form = $('#moment-form');
  const open = (sec) => ui.openSecs.has(sec);
  document.querySelectorAll('#moment-form .opt-sec').forEach((el) => { el.hidden = !open(el.dataset.sec); });
  document.querySelectorAll('#moment-form button[data-sec]').forEach((btn) => btn.setAttribute('aria-expanded', String(open(btn.dataset.sec))));
  const date = form.date.value;
  let label = '今天';
  if (isValidDateStr(date) && date !== todayStr()) {
    const age = ageAt(state.profile.birthday, date);
    label = form.approx.checked ? `${age} 歲時` : `${pad(parseDate(date).getMonth() + 1)}/${pad(parseDate(date).getDate())} · ${age} 歲`;
  }
  $('#date-btn-label').textContent = label;
  $('#date-chip').classList.toggle('filled', label !== '今天');

  // 「更多」裡每一列右邊的值，有填的亮起來
  const names = [...ui.people].map(personById).filter(Boolean).map(personName);
  const ev = eventById(ui.event);
  const set = (id, text) => { const el = $(id); el.textContent = text ? `${text} ›` : '›'; el.classList.toggle('set', !!text); };
  set('#people-sum', names.length > 2 ? `${names.slice(0, 2).join('、')} 等 ${names.length} 位` : names.join('、'));
  set('#event-sum', ev ? `${ev.icon} ${ev.label}` : '');
  const star = $('#star-toggle');
  star.classList.toggle('filled', form.starred.checked);
  star.setAttribute('aria-pressed', String(form.starred.checked));
  star.querySelector('.ic').textContent = form.starred.checked ? '★' : '☆';
  $('#star-sum').textContent = form.starred.checked ? '開' : '關';
  $('#star-sum').classList.toggle('set', form.starred.checked);
  const filled = [names.length && '和誰', ev && '人生大事', form.starred.checked && '值得記住', form.shared.checked && '分享'].filter(Boolean);
  $('#more-summary').textContent = open('more') ? '' : filled.length ? `已填：${filled.join('、')}` : '和誰、人生大事…';
  $('#more-summary').classList.toggle('set', !!filled.length && !open('more'));
  $('#more-toggle .chev').textContent = open('more') ? '▴' : '▾';

  // 寫一句或放一張照片就能記
  const ready = !!form.text.value.trim() || ui.photos.length > 0;
  $('#moment-save').classList.toggle('off', !ready);
  $('#save-hint').textContent = ready ? '' : '一句話、或一張照片就好';
}

function toggleSec(sec, force) {
  const open = force ?? !ui.openSecs.has(sec);
  if (open) ui.openSecs.add(sec); else ui.openSecs.delete(sec);
  renderOptBar();
  if (open) {
    const el = document.querySelector(`#moment-form .opt-sec[data-sec="${sec}"]`);
    if (sec !== 'date' && sec !== 'more') ui.openSecs.add('more'); // 「更多」裡的項目要先把「更多」打開
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function renderEventBadge() {
  const ev = eventById(ui.event);
  const badge = $('#event-badge');
  badge.hidden = !ev;
  if (!ev) return;
  badge.replaceChildren(`${ev.icon} ${ev.label} `, h('button', {
    type: 'button', class: 'badge-x', 'aria-label': '取消人生大事', onclick: () => { ui.event = null; renderEventBadge(); renderPeoplePicker(); },
  }, '×'));
}

function renderPeoplePicker() {
  const ev = eventById(ui.event);
  const ask = ev && ev.ask;
  const label = $('#people-label');
  label.textContent = ask === 'pet' || ask === 'petGone' ? '是哪一隻？' : ask === 'child' ? '寶寶是誰？' : ask === 'people' ? '和誰？' : '和誰';
  label.classList.toggle('ask', !!ask && ui.people.size === 0);
  let list = peopleByUse();
  if (ask === 'pet' || ask === 'petGone') list = list.filter((p) => p.kind === 'pet');
  const chips = list.map((p) => h('button', {
    type: 'button', class: `chip${ui.people.has(p.id) ? ' on' : ''}`,
    onclick: () => { ui.people.has(p.id) ? ui.people.delete(p.id) : ui.people.add(p.id); renderPeoplePicker(); },
  }, personLabel(p)));
  const addKind = ask === 'pet' ? 'pet' : 'person';
  chips.push(h('button', {
    type: 'button', class: 'chip add-chip',
    onclick: () => openPersonEditor(null, {
      kind: addKind, relation: ask === 'child' ? '子女' : ask === 'people' && ev.cat === 'love' ? '伴侶' : null,
      onSaved: (person) => { ui.people.add(person.id); renderPeoplePicker(); },
    }),
  }, addKind === 'pet' ? '＋ 新增寵物' : '＋ 新增人物'));
  $('#people-picker').replaceChildren(...chips);
  if (ui.openSecs) renderOptBar();
}

// 選了人生大事：帶入文字、標籤、☆；需要時接著問「和誰」
function applyEvent(ev) {
  if (!ev) return;
  const form = $('#moment-form');
  const prevEv = eventById(ui.event);
  ui.event = ev.id;
  const text = form.text.value.trim();
  if (!text || (prevEv && text === prevEv.text)) form.text.value = ev.text;
  ev.tags.forEach((t) => ui.tags.add(t));
  if (!ui.editingId) form.starred.checked = !ev.sad;
  renderEventBadge();
  renderTagPicker();
  if (ev.ask) { ui.openSecs.add('more'); ui.openSecs.add('people'); } // 需要「和誰」的大事，直接展開讓你選
  renderPeoplePicker();
  if (ev.ask === 'pet' && !state.people.some((p) => p.kind === 'pet' && !petGoneMoment(p))) {
    openPersonEditor(null, { kind: 'pet', onSaved: (person) => { ui.people.add(person.id); renderPeoplePicker(); } });
  } else if (ev.ask === 'child' && !ui.people.size) {
    openPersonEditor(null, { kind: 'person', relation: '子女', onSaved: (person) => { ui.people.add(person.id); renderPeoplePicker(); } });
  }
}

function openEventPicker(forWhat = 'moment') {
  ui.eventFor = forWhat;
  $('#event-search').value = '';
  renderEventPicker();
  $('#event-dialog').showModal();
}

function renderEventPicker() {
  const q = ($('#event-search').value || '').trim();
  $('#event-cats').hidden = !!q;
  $('#event-cats').replaceChildren(...EVENT_CATS.map(([key, label]) => h('button', {
    type: 'button', class: `chip${ui.eventCat === key ? ' on' : ''}`, onclick: () => { ui.eventCat = key; renderEventPicker(); },
  }, label)));
  const list = q ? LIFE_EVENTS.filter((e) => e.label.includes(q) || e.text.includes(q)) : LIFE_EVENTS.filter((e) => e.cat === ui.eventCat);
  if (!list.length) { $('#event-grid').replaceChildren(h('p', { class: 'hint' }, '找不到，可以直接在「發生了什麼」寫下來。')); return; }
  $('#event-grid').replaceChildren(...list.map((e) => h('button', {
    type: 'button', class: `event-btn${e.sad ? ' sad' : ''}`, onclick: () => chooseEvent(e),
  }, h('span', { class: 'event-btn-icon' }, e.icon), h('span', {}, e.label))));
}

async function chooseEvent(ev) {
  $('#event-dialog').close();
  if (ui.eventFor === 'recall') {
    const added = await commitRecall();
    if (added === null) return;
    const age = ui.recall.age;
    const current = ageAt(state.profile.birthday, todayStr());
    openMoment(null, age === current ? { event: ev.id } : { date: recallDateBounds(age)[0], approx: true, event: ev.id });
    return;
  }
  applyEvent(ev);
}

function updateAgeHint() {
  const date = $('#moment-form').date.value;
  const el = $('#moment-age');
  if (!isValidDateStr(date)) { el.textContent = ''; return; }
  const age = ageAt(state.profile.birthday, date);
  el.textContent = age < 0 ? '這一天你還沒出生喔' : `這是你 ${age} 歲的時候`;
  if (ui.openSecs) renderOptBar();
}

// 情緒：沒自己選時，依心情欄（沒寫就看事件）自動判斷；點了就以自己選的為準，再點一次取消
// 心情好壞（1–5）不用另外選，跟著情緒走；點了情緒才出現「想多說一點嗎」
function renderEmoPicker() {
  const form = $('#moment-form');
  if (!ui.emoManual) ui.emo = detectEmotion(form.feel.value, form.text.value, ui.emoManual ? null : ui.baseMood);
  $('#emo-picker').replaceChildren(...EMOTIONS.map((e) => h('button', {
    type: 'button', class: `chip emo${ui.emo === e.key ? ' on' : ''}${ui.emo === e.key && !ui.emoManual ? ' auto' : ''}`,
    'aria-pressed': String(ui.emo === e.key), 'aria-label': e.label,
    onclick: () => {
      const same = ui.emo === e.key && ui.emoManual;
      ui.emoManual = !same;
      ui.emo = same ? null : e.key;
      renderEmoPicker();
      if (!same && !form.feel.value) form.feel.focus();
    },
  }, h('span', { class: 'emo-icon' }, h('img', { src: `room/pixel/icon_${e.key}.webp`, alt: '', width: 44, height: 36 })), h('span', { class: 'emo-label' }, e.label))));
  const cur = emotionByKey(ui.emo);
  ui.mood = cur ? cur.mood : ui.baseMood;
  $('#emo-hint').textContent = !cur ? '' : ui.emoManual ? `你選了「${cur.label}」，再點一次可以取消` : `自動判斷是「${cur.label}」，不對的話點別的`;
  $('#emo-hint').hidden = !cur;
  form.feel.hidden = !cur && !form.feel.value;
  if (ui.openSecs) renderOptBar();
}

// 標籤：建議的排在最前面（虛線），選了的實心；一個標籤只出現一次
function renderTagPicker() {
  const form = $('#moment-form');
  const hints = suggestTags(`${form.text.value} ${form.feel.value}`).filter((x) => !ui.tags.has(x.tag));
  const icons = Object.fromEntries(hints.map((x) => [x.tag, x.icon]));
  const suggested = hints.map((x) => x.tag);
  const all = allTags();
  const order = [...all.filter((t) => ui.tags.has(t)), ...suggested.filter((t) => all.includes(t)), ...all.filter((t) => !ui.tags.has(t) && !suggested.includes(t))];
  $('#tag-picker').replaceChildren(...order.map((t) =>
    h('button', {
      type: 'button', class: `chip${ui.tags.has(t) ? ' on' : suggested.includes(t) ? ' suggest' : ''}`, 'data-icon': icons[t] || null,
      onclick: () => { ui.tags.has(t) ? ui.tags.delete(t) : ui.tags.add(t); renderTagPicker(); },
    }, t)));
  if (ui.openSecs) renderOptBar();
}

function renderPhotoPicker() {
  const items = ui.photos.map((p, i) => h('div', { class: 'photo-item' },
    p.url ? h('img', { src: p.url, alt: '' }) : h('span', { class: 'photo-missing' }, '?'),
    h('button', {
      type: 'button', class: 'photo-remove', 'aria-label': '移除照片',
      onclick: () => removePendingPhoto(i),
    }, '×')));
  if (ui.busy) items.push(h('div', { class: 'photo-item busy' }, '處理中…'));
  // 灰色虛線框：沒照片時是一大塊「加照片」，有照片時是後面的小格子
  else if (ui.photos.length < MAX_PHOTOS) {
    items.push(h('label', { class: `photo-add${ui.photos.length ? '' : ' empty'}`, for: 'photo-input' },
      '📷', h('span', {}, ui.photos.length ? '再加一張' : '加照片')));
  }
  const picker = $('#photo-picker');
  picker.replaceChildren(...items);
  picker.classList.toggle('single', ui.photos.length === 1 && !ui.busy); // 只有一張時放大
  picker.classList.toggle('none', !ui.photos.length && !ui.busy);
  $('#photo-add').hidden = ui.photos.length >= MAX_PHOTOS;
  $('#photo-add-label').textContent = ui.photos.length ? '再加一張' : '照片';
  $('#moment-form').text.placeholder = ui.photos.length ? '想說點什麼嗎？（可以不寫）' : '今天發生了什麼？';
  if (ui.openSecs) renderOptBar();
}

function removePendingPhoto(i) {
  const [p] = ui.photos.splice(i, 1);
  if (!p.existing) URL.revokeObjectURL(p.url);
  renderPhotoPicker();
}

async function addPhotos(fileList) {
  const room = MAX_PHOTOS - ui.photos.length;
  const files = [...fileList].slice(0, room);
  if (fileList.length > room) toast(`每則最多 ${MAX_PHOTOS} 張照片`);
  if (!files.length) return;
  ui.busy = true;
  $('#moment-save').disabled = true;
  renderPhotoPicker();
  for (const f of files) {
    try {
      const p = await processPhoto(f);
      ui.photos.push({ id: newId(), existing: false, ...p, url: URL.createObjectURL(p.thumb) });
      renderPhotoPicker();
    } catch (e) {
      toast(e.message);
    }
  }
  ui.busy = false;
  $('#moment-save').disabled = false;
  renderPhotoPicker();
  requestPersist();
}

async function saveMoment(e) {
  e.preventDefault();
  if (ui.busy) return;
  const form = e.target;
  const date = form.date.value;
  const text = form.text.value.trim();
  const feel = form.feel.value.trim();
  if (!text && !ui.photos.length) { toast('寫一句話，或放一張照片'); form.text.focus(); return; }
  if (!isValidDateStr(date)) { ui.openSecs.add('date'); renderOptBar(); return; }
  if (!ui.emoManual) ui.emo = detectEmotion(feel, text, ui.mood);
  if (date < state.profile.birthday || date > todayStr()) {
    toast('日期要在生日到今天之間');
    return;
  }

  const saveBtn = $('#moment-save');
  saveBtn.disabled = true;
  try {
    const now = new Date().toISOString();
    const prev = ui.editingId ? state.moments.find((x) => x.id === ui.editingId) : null;
    const momentId = prev ? prev.id : newId();
    const newPhotos = ui.photos.filter((p) => !p.existing);
    const removed = prev ? prev.photoIds.filter((id) => !ui.photos.some((p) => p.id === id)) : [];

    // 先存照片再存文字：中途失敗頂多留下沒被引用的照片，下次啟動會清掉
    if (newPhotos.length) {
      try {
        await db.putPhotos(newPhotos.map((p) => ({ id: p.id, momentId, blob: p.blob, thumb: p.thumb, w: p.w, h: p.h, createdAt: now })));
      } catch (err) {
        toast('照片儲存失敗，可能是手機空間不足');
        return;
      }
    }

    const fields = {
      date, text, feel, mood: ui.mood, emo: ui.emo, emoAuto: !ui.emoManual, tags: [...ui.tags], photoIds: ui.photos.map((p) => p.id), starred: form.starred.checked, approx: form.approx.checked,
      shared: form.shared.checked, people: [...ui.people].filter(personById), event: ui.event, updatedAt: now,
    };
    // 事件或心情改了，舊的故事版就對不上了，拿掉（可以再寫一次）
    const rewrite = !prev || prev.text !== text || (prev.feel || '') !== feel;
    if (prev && rewrite) { fields.story = null; fields.item = null; }
    if (prev) Object.assign(prev, fields);
    else state.moments.push({ id: momentId, createdAt: now, ...fields });
    if (!(await saveState())) return;

    newPhotos.forEach((p) => { p.saved = true; thumbUrls.set(p.id, Promise.resolve(p.url)); });
    if (removed.length) {
      await db.deletePhotos(removed).catch(() => {});
      removed.forEach(forgetThumb);
    }
    ui.selAge = ageAt(state.profile.birthday, date);
    ui.momentSnapshot = null;
    $('#moment-dialog').close();
    const ev = eventById(fields.event);
    // 難過的大事不慶祝，用溫和的語氣
    toast(prev ? '已更新' : ev && ev.sad ? '已經好好記下來了 🤍' : '記下來了');
    render();
    if (!prev && scene) scene.celebrate({ emo: fields.emo, sad: !!(ev && ev.sad) });
    if (!prev) offerCloudAfterFirst();
    if (rewrite && text && storyOn()) openStory(momentId);
  } finally {
    saveBtn.disabled = false;
  }
}

// 刪除不先問，改成 toast 上可以「復原」；照片等復原時間過了才真的刪
const UNDO_MS = 6000;
const undoKeep = new Set(); // 還能復原的照片，清孤兒照片時先跳過
async function deleteMoment() {
  if (!ui.editingId) return;
  const m = state.moments.find((x) => x.id === ui.editingId);
  state.moments = state.moments.filter((x) => x.id !== ui.editingId);
  state.deleted[m.id] = new Date().toISOString(); // 讓其他裝置同步時也刪掉
  if (!(await saveState())) return;
  m.photoIds.forEach((id) => undoKeep.add(id));
  let undone = false;
  setTimeout(async () => {
    m.photoIds.forEach((id) => undoKeep.delete(id));
    if (undone) return;
    await db.deletePhotos(m.photoIds).catch(() => {});
    m.photoIds.forEach(forgetThumb);
  }, UNDO_MS);
  ui.momentSnapshot = null;
  $('#moment-dialog').close();
  toast('已刪除這則紀錄', UNDO_MS, { label: '復原', fn: async () => {
    undone = true;
    delete state.deleted[m.id];
    state.moments.push({ ...m, updatedAt: new Date().toISOString() }); // 比墓碑新，其他裝置同步時也會留下
    await saveState();
    toast('已復原');
    render();
  } });
  render();
}

// ---------- 留存：小世界、一秒日記、今天的小卡片 ----------
const LIT_AT = 3; // 一歲記滿幾則，人生地圖那一格就會亮
// 院子的等級：記得越多，花越多、還有長椅和信箱
function gardenLevel() {
  const n = state.moments.length;
  return n >= 100 ? 5 : n >= 50 ? 4 : n >= 25 ? 3 : n >= 10 ? 2 : n >= 3 ? 1 : 0;
}
function daysSinceLastRecord() {
  if (!state.moments.length) return null;
  const last = state.moments.reduce((a, m) => ((m.createdAt || '') > a ? m.createdAt : a), '');
  return last ? Math.max(0, daysBetween(new Date(last), new Date())) : null;
}
const isQuiet = () => { const d = daysSinceLastRecord(); return d != null && d >= 7; };
const readyLetters = () => state.letters.filter((l) => !l.openedAt && l.openOn <= todayStr());

// 一秒日記：一句話或一個心情就算記過
function renderQuickNote() {
  const n = state.moments.filter((m) => m.date === todayStr()).length;
  $('#quick-done').hidden = !n;
  $('#quick-done').textContent = n ? `今天記了 ${n} 則 ✓ 想到什麼再記一句` : '';
}

// ---------- AI 故事 ----------
// 要開啟設定、登入雲端、而且有網路；離線記的之後可以從「⋯ → 寫成故事」補
const storyOn = () => !!(state.prefs.aiStory && cloud.me && navigator.onLine);

async function openStory(id) {
  const m = state.moments.find((x) => x.id === id);
  if (!m) return;
  const body = $('#letter-body');
  const close = () => $('#letter-dialog').close();
  const actions = (...btns) => h('div', { class: 'sheet-actions' }, ...btns);
  const btn = (label, onclick, cls = 'btn') => h('button', { type: 'button', class: cls, onclick }, label);
  const top = h('div', { class: 'sheet-top' }, h('h3', {}, '✨ 寫成故事'));
  const original = h('p', { class: 'hint story-src' }, `✏️ ${m.text}${m.feel ? `　${m.feel}` : ''}`);

  body.replaceChildren(top, original, h('div', { class: 'story-card loading' }, h('p', { class: 'muted' }, '正在把這件事寫成故事…')), actions(btn('保留原文', close)));
  if (!$('#letter-dialog').open) $('#letter-dialog').showModal();

  const ev = eventById(m.event);
  let story;
  try {
    story = await cloudApi.writeStory({
      event: m.text, feel: m.feel || '', mood: m.mood || null,
      people: m.people.map(personById).filter(Boolean).map(personName),
      lifeEvent: ev ? ev.label : '', sad: !!(ev && ev.sad),
    });
  } catch (err) {
    if (!$('#letter-dialog').open) return;
    const retry = ![429, 503].includes(err.status) || err.message.includes('忙');
    body.replaceChildren(top, original, h('p', { class: 'story-error' }, err.message || '故事暫時寫不出來'),
      actions(btn('關閉', close), h('span', { class: 'spacer' }), retry ? btn('再試一次', () => openStory(id), 'btn primary') : null));
    return;
  }
  if (!$('#letter-dialog').open) return; // 等的時候已經關掉了

  const use = async () => {
    const cur = state.moments.find((x) => x.id === id);
    if (!cur) { close(); return; }
    cur.story = { title: story.title, text: story.text, at: new Date().toISOString() };
    // AI 順便判斷的情緒和小東西：自己選過情緒的不覆蓋
    if (story.emo && emotionByKey(story.emo) && (!cur.emo || cur.emoAuto)) { cur.emo = story.emo; cur.emoAuto = true; }
    if (story.item && ITEMS[story.item]) cur.item = story.item;
    cur.updatedAt = cur.story.at;
    if (!(await saveState())) return;
    close();
    toast('寫進你的故事裡了 ✨');
    render();
  };
  body.replaceChildren(top,
    h('div', { class: 'story-card' }, h('b', { class: 'story-title' }, story.title), h('p', { class: 'story-text' }, story.text)),
    original,
    h('p', { class: 'hint' }, `今天還可以寫 ${story.left} 次`),
    actions(btn('保留原文', close), h('span', { class: 'spacer' }),
      story.left > 0 ? btn('再寫一次', () => openStory(id)) : null,
      btn('用這個', use, 'btn primary')));
}

async function removeStory() {
  const m = state.moments.find((x) => x.id === ui.editingId);
  if (!m || !m.story) return;
  m.story = null;
  m.updatedAt = new Date().toISOString();
  if (!(await saveState())) return;
  $('#moment-story-remove').hidden = true;
  $('#moment-story').textContent = '✨ 寫成故事';
  $('#moment-menu-list').hidden = true;
  toast('已拿掉故事版，原文還在');
  render();
}

// 回顧時要避開的：難過的人生大事、設成「回顧時避開」的人、設成「輕輕帶過」的年歲
const quietAge = (age) => !!(state.years[String(age)] || {}).quiet;
function avoidInMemories(m) {
  const ev = eventById(m.event);
  if (ev && ev.sad) return true;
  if (quietAge(ageAt(state.profile.birthday, m.date))) return true;
  return m.people.some((id) => { const p = personById(id); return p && p.hideInMemories; });
}

// 每週回憶題：從記得最少的幾歲裡輪流挑一題，每週換一次
function weeklyQuestion() {
  const { birthday } = state.profile;
  const current = ageAt(birthday, todayStr());
  if (current < 1) return null;
  const counts = Array(current).fill(0);
  for (const m of state.moments) { const a = ageAt(birthday, m.date); if (a < current) counts[a]++; }
  const order = [...counts.keys()].sort((a, b) => counts[a] - counts[b] || a - b).slice(0, 6);
  const week = Math.floor(Date.now() / (7 * 86400000));
  const age = order[week % order.length];
  const qs = PROMPTS[lifeStage(age).key];
  const qi = Math.floor(week / order.length) % qs.length;
  return { age, qi, q: qs[qi] };
}

function openRecallAt(age, q) {
  ui.recallDone = false;
  setRecallAge(age);
  ui.recall.q = q;
  renderRecall();
  $('#recall-dialog').showModal();
}

function todayCard(kind, icon, title, body, actions) {
  return h('div', { class: `today-card ${kind}` },
    h('div', { class: 'today-icon', 'aria-hidden': 'true' }, icon),
    h('div', { class: 'today-main' },
      h('b', {}, title),
      body ? h('p', {}, body) : null,
      h('div', { class: 'row' }, actions.map(([label, fn], i) => h('button', { type: 'button', class: `btn small${i === 0 ? ' primary' : ''}`, onclick: fn }, label)))));
}

function renderToday() {
  const root = $('#today-panel');
  const { birthday } = state.profile;
  const today = todayStr();
  const age = ageAt(birthday, today);
  // 照重要程度排：信（都在生日那天到期）> 生日 > 那年今日 > 本週回憶題
  const cards = [];
  for (const l of readyLetters()) {
    cards.push(todayCard('letter', '✉️', `一封來自 ${ageAt(birthday, l.writtenOn)} 歲的信`, `寫於 ${fmtDate(parseDate(l.writtenOn))}，今天可以打開了。`,
      [['打開信', () => openLetter(l.id)]]));
  }
  if (birthday.slice(5) === today.slice(5) && age > 0) {
    cards.push(todayCard('birthday', '🎂', `生日快樂！${age} 歲了`, `來看看 ${age - 1} 歲的你，做一張年度卡留作紀念。`,
      [[`🎴 ${age - 1} 歲的年度卡`, () => showYearCard(age - 1)]]));
  }
  // 那年今日：先找自己的紀錄，沒有的話找那天的時事
  const md = today.slice(5);
  const past = state.moments.filter((m) => !m.approx && m.date < today && m.date.slice(5) === md && !avoidInMemories(m)).sort((a, b) => b.date.localeCompare(a.date));
  if (past.length) {
    const m = past[0];
    const a = ageAt(birthday, m.date);
    cards.push(todayCard('onthisday', '📅', `那年今日 · ${Number(today.slice(0, 4)) - Number(m.date.slice(0, 4))} 年前（${a} 歲）`, m.text,
      [['看那一歲', () => selectAge(a, true)], ['打開', () => openMoment(m.id)]]));
  } else {
    const [mm, dd] = md.split('-').map(Number);
    const evs = world.eventsOnDay(mm, dd, Number(birthday.slice(0, 4)), () => renderToday());
    const fit = (evs || []).filter((e) => (state.prefs.worldSad !== false || !e.sad) && `${e.y}-${md}` >= birthday && e.y < Number(today.slice(0, 4)) && !quietAge(ageAt(birthday, `${e.y}-${md}`)));
    if (fit.length) {
      const e = fit[Number(today.slice(0, 4)) % fit.length];
      const a = ageAt(birthday, `${e.y}-${md}`);
      cards.push(todayCard('onthisday', world.CATS[e.cat] || '🌏', `那年今日 · ${Number(today.slice(0, 4)) - e.y} 年前（你 ${a} 歲）`, `${e.title}。${e.text || ''}`,
        [['✏️ 我記得', () => rememberWorldEvent(e, a)], ['看那一歲', () => selectAge(a, true)]]));
    }
  }
  const wq = weeklyQuestion();
  if (wq) cards.push(todayCard('weekly', '🕰', `本週回憶題 · ${wq.age} 歲`, wq.q, [['回答', () => openRecallAt(wq.age, wq.qi)]]));
  // 一次只放最重要的一張，其他的收在「還有 N 張」裡，點了才展開
  root.hidden = !cards.length;
  const rest = cards.length - 1;
  const more = rest > 0 && !ui.todayMore ? h('button', {
    type: 'button', class: 'link-btn today-more', onclick: () => { ui.todayMore = true; renderToday(); },
  }, `還有 ${rest} 張小卡片 ▾`) : null;
  root.replaceChildren(...(ui.todayMore ? cards : cards.slice(0, 1)), more);
}

// ---------- 底部分頁 ----------
function showTab(tab) {
  if (tab !== 'home') setRoomFull(false);
  document.querySelectorAll('#app .tab-page').forEach((p) => { p.hidden = p.dataset.tab !== tab; });
  document.querySelectorAll('#tabbar [data-tab-btn]').forEach((b) => {
    if (b.dataset.tabBtn === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  ui.tab = tab;
  window.scrollTo(0, 0);
  if (tab === 'home' && scene) scene.update({});
}

// ---------- 我的樣子（房間裡的小人） ----------
function openLook({ onboarding = false } = {}) {
  ui.look = { draft: normalizeLook(state.profile.look), onboarding };
  $('#look-title').textContent = onboarding ? '選你的樣子' : '我的樣子';
  $('#look-sub').textContent = onboarding ? '這就是住在房間裡的你，之後在「我」或點房間裡的自己都可以換。' : '點房間裡的自己也可以來這裡換裝。';
  $('#look-save').textContent = onboarding ? '就是我了' : '好了';
  renderLook();
  if (!$('#look-dialog').open) $('#look-dialog').showModal();
}
function renderLook() {
  const { draft } = ui.look;
  $('#look-preview').replaceChildren(lookHtml(draft, 'happy', 'look look-full'));
  const opts = looksFor(draft.style);
  const pick = (opt) => { ui.look.draft = normalizeLook(opt); renderLook(); };
  const styleRow = h('div', { class: 'field' }, h('span', { class: 'field-label' }, '角色'),
    h('div', { class: 'look-row' }, STYLES.map(([v, name]) => h('button', {
      type: 'button', class: `look-opt${draft.style === v ? ' on' : ''}`, 'aria-pressed': String(draft.style === v), 'data-style': v,
      onclick: () => pick({ style: v }),
    }, lookHtml({ style: v }, 'smile', 'look look-body'), h('span', {}, name)))));
  const row = (label, key) => opts[key].length < 2 ? null : h('div', { class: 'field' }, h('span', { class: 'field-label' }, label),
    h('div', { class: 'look-row' }, opts[key].map(([v, name]) => {
      const opt = { ...draft, [key]: v };
      return h('button', {
        type: 'button', class: `look-opt${draft[key] === v ? ' on' : ''}`, 'aria-pressed': String(draft[key] === v),
        onclick: () => pick(opt),
      }, lookHtml(opt, 'smile', `look look-${key === 'hair' ? 'head' : 'body'}`), h('span', {}, name));
    })));
  $('#look-options').replaceChildren(...[styleRow, row('頭髮', 'hair'), row('衣服', 'cloth'),
    h('p', { class: 'hint' }, draft.style === 'doll' ? '復古娃娃走路會擺手擺腳！更多表情和衣服陸續加入中。' : '更多髮型和衣服陸續加入中。')].filter(Boolean));
}
async function saveLook() {
  state.profile = { ...state.profile, look: { ...ui.look.draft }, updatedAt: new Date().toISOString() };
  if (!(await saveState())) return;
  const onboarding = ui.look.onboarding;
  $('#look-dialog').close();
  render();
}

// ---------- 房間裡的東西 ----------
// 電視：你出生那一年的世界
async function openTv(done) {
  const { birthday } = state.profile;
  const y = Number(birthday.slice(0, 4));
  ui.infoClosed = done || null;
  $('#info-body').replaceChildren(h('div', { class: 'sheet-top' }, h('h3', {}, `📺 你出生的 ${y} 年`)), h('p', { class: 'hint' }, '載入中…'));
  if (!$('#info-dialog').open) $('#info-dialog').showModal();
  const evs = (await worldFor(new Date(y, 0, 1), new Date(y, 11, 31))).filter((e) => state.prefs.worldSad !== false || !e.sad);
  $('#info-body').replaceChildren(
    h('div', { class: 'sheet-top' }, h('h3', {}, `📺 你出生的 ${y} 年`)),
    evs.length ? h('ul', { class: 'tv-list' }, evs.slice(0, 12).map((e) => h('li', {},
      h('small', {}, `${world.eventDateLabel ? world.eventDateLabel(e) : e.y} · ${world.REGIONS[e.region] || ''}`),
      h('b', {}, `${world.CATS[e.cat] || '🌏'} ${e.title}`), e.text ? h('span', {}, e.text) : null))) : h('p', { class: 'hint' }, '還沒有這一年的新聞。'),
    h('button', { type: 'button', class: 'link-btn', onclick: () => { $('#info-dialog').close(); selectAge(0, true); } }, '在回憶裡看 0 歲那一年 →'));
}
// 書架：以前的今天；沒有就去回憶
function shelfMemory() {
  const today = todayStr(), md = today.slice(5);
  const past = state.moments.filter((m) => !m.approx && m.date < today && m.date.slice(5) === md && !avoidInMemories(m) && m.text);
  if (past.length) {
    const m = past[Math.floor(Math.random() * past.length)];
    const n = Number(today.slice(0, 4)) - Number(m.date.slice(0, 4));
    scene.feel('happy');
    scene.say(`${n} 年前的今天：${m.text.length > 16 ? `${m.text.slice(0, 16)}…` : m.text}`, 4000);
  } else {
    showTab('memories');
    toast('以前的今天還沒有紀錄，這裡是你的回憶');
  }
}
// 牆上的照片：最近的照片
function wallPhotos() {
  const ids = state.moments.slice().sort((a, b) => b.date.localeCompare(a.date)).flatMap((m) => m.photoIds).slice(0, 20);
  if (ids.length) openLightbox(ids, 0);
  else scene.say('記一筆時放照片，就會掛在這面牆上 📷');
}
// 給未來的信：可以打開的先打開，不然寫一封給下一歲
function openLetters() {
  const ready = readyLetters();
  if (ready.length) openLetter(ready[0].id);
  else openLetterEditor(ageAt(state.profile.birthday, todayStr()) + 1);
}

// ---------- 第一次使用：選好樣子後直接進房間，小人提示去書桌寫第一筆 ----------
function welcomeHome() {
  showTab('home');
  if (scene) setTimeout(() => { scene.feel('happy'); scene.say('這是我的小窩～點書桌上的日記本，寫下今天吧！✏️', 6000); }, 300);
}

// 記完第一筆才問要不要開雲端備份（這時候才有值得保護的東西）；只問一次
async function offerCloudAfterFirst() {
  if (cloud.me || state.prefs.cloudOffered || state.moments.length !== 1) return;
  state.prefs = { ...state.prefs, cloudOffered: true };
  await saveState();
  setTimeout(() => offerFaceIdSignup(() => {}, { first: true }), 1800);
}

// ---------- 給未來的信 ----------
function openLetterEditor(age) {
  const { birthday } = state.profile;
  const openOn = toDateStr(ageRange(birthday, age)[0]);
  const sealed = state.letters.filter((l) => !l.openedAt && l.toAge === age);
  const text = h('textarea', { rows: '7', maxlength: '2000', placeholder: `想對 ${age} 歲的自己說什麼？現在的煩惱、期待、想記得的事…`, 'aria-label': '信的內容' });
  const save = h('button', { type: 'button', class: 'btn primary' }, '封存');
  save.addEventListener('click', async () => {
    const body = text.value.trim();
    if (!body) { text.focus(); return; }
    const now = new Date().toISOString();
    state.letters.push({ id: newId(), toAge: age, writtenOn: todayStr(), openOn, text: body, createdAt: now, updatedAt: now, openedAt: null });
    if (!(await saveState())) return;
    $('#letter-dialog').close();
    toast(`已封存，${fmtDate(parseDate(openOn))} 才能打開 ✉️`);
    render();
  });
  $('#letter-body').replaceChildren(
    h('div', { class: 'sheet-top' }, h('h3', {}, `✉️ 寫給 ${age} 歲的自己`)),
    h('p', { class: 'hint' }, `信會封存到 ${fmtDate(parseDate(openOn))}（你 ${age} 歲生日）才能打開，在那之前誰都看不到內容。`),
    text,
    sealed.length ? h('div', { class: 'field' }, h('span', { class: 'field-label' }, `已經封存 ${sealed.length} 封`), h('ul', { class: 'sealed-list' }, sealed.map((l) => h('li', {},
      h('span', {}, `寫於 ${fmtDate(parseDate(l.writtenOn))}`),
      h('button', { type: 'button', class: 'link-btn', onclick: async () => {
        state.letters = state.letters.filter((x) => x.id !== l.id);
        state.deleted[l.id] = new Date().toISOString(); // 讓其他裝置同步時也刪掉
        await saveState(); render(); openLetterEditor(age);
        toast('已刪除這封信', UNDO_MS, { label: '復原', fn: async () => {
          delete state.deleted[l.id];
          state.letters.push({ ...l, updatedAt: new Date().toISOString() });
          await saveState(); render();
          if ($('#letter-dialog').open) openLetterEditor(age);
          toast('已復原');
        } });
      } }, '刪除'))))) : null,
    h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => $('#letter-dialog').close() }, '取消'), h('span', { class: 'spacer' }), save));
  if (!$('#letter-dialog').open) $('#letter-dialog').showModal();
}

async function openLetter(id) {
  const l = state.letters.find((x) => x.id === id);
  if (!l || l.openOn > todayStr()) return;
  const { birthday } = state.profile;
  if (!l.openedAt) { l.openedAt = new Date().toISOString(); l.updatedAt = l.openedAt; await saveState(); render(); }
  const current = ageAt(birthday, todayStr());
  $('#letter-body').replaceChildren(
    h('div', { class: 'sheet-top' }, h('h3', {}, `✉️ 來自 ${ageAt(birthday, l.writtenOn)} 歲的你`)),
    h('p', { class: 'hint' }, `寫於 ${fmtDate(parseDate(l.writtenOn))}，給 ${l.toAge} 歲的自己`),
    h('div', { class: 'letter-paper pre' }, l.text),
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => $('#letter-dialog').close() }, '關閉'),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn primary', onclick: () => openLetterEditor(current + 1) }, '回信給未來的自己')));
  if (!$('#letter-dialog').open) $('#letter-dialog').showModal();
  if (scene) scene.celebrate({ text: '收到一封來自過去的信 ✉️' });
}

function renderLetterItem(l) {
  return h('li', { class: 'moment letter-item' },
    h('span', { class: 'moment-date' }, l.openOn.slice(5).replace('-', '/')),
    h('div', { class: 'moment-main' }, h('button', { type: 'button', class: 'moment-body', onclick: () => openLetter(l.id) },
      h('span', { class: 'moment-text' }, `✉️ 來自 ${ageAt(state.profile.birthday, l.writtenOn)} 歲的信`),
      h('span', { class: 'world-text' }, l.text.length > 40 ? `${l.text.slice(0, 40)}…` : l.text))));
}

// ---------- 年度卡 ----------
// 某一歲的時事（還沒載入就等載入完）
const worldFor = (start, end) => new Promise((resolve) => {
  const ev = world.eventsBetween(start, end, () => resolve(world.eventsBetween(start, end) || []));
  if (ev) resolve(ev);
});

async function makeYearCard(age) {
  const { birthday } = state.profile;
  const [start, end] = ageRange(birthday, age);
  const list = state.moments.filter((m) => ageAt(birthday, m.date) === age);
  const stats = statsFor(list);
  const stage = lifeStage(age);
  const Wc = 1080;
  const Hc = 1350;
  const c = document.createElement('canvas');
  c.width = Wc; c.height = Hc;
  const ctx = c.getContext('2d');
  const font = (size, weight = 400) => `${weight} ${size}px -apple-system, "PingFang TC", "Noto Sans TC", "Noto Sans CJK TC", sans-serif`;
  const g = ctx.createLinearGradient(0, 0, 0, Hc);
  g.addColorStop(0, '#fff6e6'); g.addColorStop(1, '#f3ecff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, Wc, Hc);
  ctx.fillStyle = '#2a2230';
  ctx.font = font(34, 600); ctx.fillText('wowo · LIFE LOG', 80, 110);
  ctx.font = font(120, 800); ctx.fillText(`${age} 歲`, 80, 250);
  ctx.font = font(36); ctx.fillStyle = '#6b6476';
  ctx.fillText(`${fmtDate(start)} – ${fmtDate(end)} · ${stage.key === 'adult' ? '出社會' : stage.label}`, 80, 310);
  // 那一歲的小人
  const { grid } = composeAvatar(myAvatar(), age, stage.key);
  const px = 16;
  grid.forEach((r, y) => r.forEach((col, x) => { if (col) { ctx.fillStyle = col; ctx.fillRect(Wc - 80 - AVATAR_W * px + x * px, 120 + y * px - 4 * px, px, px); } }));
  let y = 400;
  const title = yearTitle(age);
  if (title) { ctx.fillStyle = '#2a2230'; ctx.font = font(48, 700); ctx.fillText(`「${title}」`, 70, y); y += 40; }
  // 狀態
  y += 40;
  ctx.font = font(34);
  STATS.forEach((s, i) => {
    const yy = y + i * 64;
    ctx.fillStyle = '#2a2230'; ctx.fillText(s.label, 80, yy + 28);
    ctx.fillStyle = 'rgba(42,34,48,.1)'; ctx.fillRect(280, yy + 6, 600, 26);
    ctx.fillStyle = s.color; ctx.fillRect(280, yy + 6, 6 * (stats[s.key] || 0), 26);
    ctx.fillStyle = '#2a2230'; ctx.fillText(String(stats[s.key] || 0), 910, yy + 30);
  });
  y += 64 * STATS.length + 30;
  // 數字
  const photos = list.reduce((n, m) => n + m.photoIds.length, 0);
  const counts = new Map();
  for (const m of list) for (const id of m.people) counts.set(id, (counts.get(id) || 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1]).map(([id]) => personById(id)).find(Boolean);
  ctx.font = font(36, 600); ctx.fillStyle = '#2a2230';
  ctx.fillText(`記了 ${list.length} 則 · ☆ ${list.filter((m) => m.starred).length} · 照片 ${photos} 張${top ? ` · 最常一起：${personName(top)}` : ''}`, 80, y);
  y += 70;
  const best = [...list].sort((a, b) => (b.starred - a.starred) || ((b.mood || 0) - (a.mood || 0)))[0];
  const wrap = (text, x, yy, max, lh) => {
    let line = '';
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > max) { ctx.fillText(line, x, yy); yy += lh; line = ch; } else line += ch;
    }
    if (line) { ctx.fillText(line, x, yy); yy += lh; }
    return yy;
  };
  if (best) {
    ctx.font = font(30); ctx.fillStyle = '#6b6476'; ctx.fillText('這一歲最想記得的事', 80, y); y += 52;
    ctx.font = font(40, 700); ctx.fillStyle = '#2a2230';
    y = wrap(`${best.date.slice(5).replace('-', '/')}　${best.text}`, 80, y, 920, 54) + 20;
  }
  const events = (await worldFor(start, end)).filter((e) => !e.sad).slice(0, 3);
  if (events.length) {
    ctx.font = font(30); ctx.fillStyle = '#6b6476'; ctx.fillText('那一年的世界', 80, y); y += 50;
    ctx.font = font(34); ctx.fillStyle = '#2a2230';
    for (const e of events) { if (y > Hc - 120) break; y = wrap(`${world.CATS[e.cat] || '🌏'} ${e.title}`, 80, y, 920, 48); }
  }
  ctx.font = font(28); ctx.fillStyle = '#9a93a6'; ctx.fillText(`${state.profile.name} 的人生紀錄 · wowo`, 80, Hc - 70);
  return new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/png'));
}

// 兩段式：先產生圖片給你看，再按一次分享或儲存（iPhone 的分享選單要由點擊直接觸發）
async function showYearCard(age) {
  $('#letter-body').replaceChildren(h('div', { class: 'sheet-top' }, h('h3', {}, `🎴 ${age} 歲的年度卡`)), h('p', { class: 'hint' }, '產生中…'));
  if (!$('#letter-dialog').open) $('#letter-dialog').showModal();
  const blob = await makeYearCard(age);
  const url = URL.createObjectURL(blob);
  const file = new File([blob], `wowo-${age}歲.png`, { type: 'image/png' });
  const share = h('button', { type: 'button', class: 'btn primary' }, '分享或儲存');
  share.addEventListener('click', async () => {
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: `${age} 歲的我` });
      else h('a', { href: url, download: file.name }).click();
    } catch (e) { if (e.name !== 'AbortError') toast('分享失敗'); }
  });
  $('#letter-body').replaceChildren(
    h('div', { class: 'sheet-top' }, h('h3', {}, `🎴 ${age} 歲的年度卡`)),
    h('img', { class: 'year-card-img', src: url, alt: `${age} 歲的年度卡` }),
    h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => $('#letter-dialog').close() }, '關閉'), h('span', { class: 'spacer' }), share));
}

// ---------- 人生重播：小人從 0 歲長到現在，一歲一歲播過你記下的事 ----------
let replay = null;
function openReplay() {
  if (!replay) replay = { scene: new Scene($('#replay-canvas'), $('#replay-bubble')) };
  replay.age = 0;
  replay.paused = false;
  replay.current = ageAt(state.profile.birthday, todayStr());
  $('#replay-toggle').textContent = '暫停';
  $('#replay-dialog').showModal();
  replay.scene.resize();
  replay.scene.start();
  stepReplay();
}

async function stepReplay() {
  clearTimeout(replay.timer);
  if (!$('#replay-dialog').open) return;
  const { birthday } = state.profile;
  const age = replay.age;
  const stage = lifeStage(age);
  const [start, end] = ageRange(birthday, age);
  const list = state.moments.filter((m) => ageAt(birthday, m.date) === age);
  const gentle = quietAge(age);
  const picks = gentle ? [] : [...list].filter((m) => !avoidInMemories(m)).sort((a, b) => (!!eventById(b.event) - !!eventById(a.event)) || (b.starred - a.starred) || a.date.localeCompare(b.date)).slice(0, 3);
  replay.scene.update({
    stageKey: stage.key, age, avatar: state.profile.avatar || null, birthday, props: propsForTags(new Set(list.flatMap((m) => m.tags))),
    weather: null, messages: () => [], pets: [], garden: Math.min(5, Math.floor(age / 6)), quiet: false, mail: false,
  });
  $('#replay-age').textContent = `${age} 歲 · ${stage.key === 'adult' ? '出社會' : stage.label}`;
  $('#replay-bar').style.width = `${((age + 1) / (replay.current + 1)) * 100}%`;
  const ev = (await worldFor(start, end > parseDate(todayStr()) ? parseDate(todayStr()) : end)).filter((e) => !e.sad);
  const lines = gentle ? [h('p', { class: 'replay-title' }, '這一年，輕輕帶過 🤍')] : [
    yearTitle(age) ? h('p', { class: 'replay-title' }, `「${yearTitle(age)}」`) : null,
    ...picks.map((m) => h('p', {}, `${eventById(m.event) ? eventById(m.event).icon : m.starred ? '★' : '·'} ${m.text}`)),
    ev.length ? h('p', { class: 'replay-world' }, `那一年：${ev[age % ev.length].title}`) : null,
  ].filter(Boolean);
  $('#replay-caption').replaceChildren(...lines);
  if (picks.length) replay.scene.jump(1);
  if (replay.paused) return;
  replay.timer = setTimeout(() => {
    if (replay.age < replay.current) { replay.age++; stepReplay(); return; }
    $('#replay-caption').replaceChildren(h('p', { class: 'replay-title' }, '這就是到現在的你 🌱'), h('p', {}, '未完待續…繼續記下去，重播就會越來越長。'));
    replay.done = true;
    $('#replay-toggle').textContent = '重播';
  }, !gentle && (picks.length || yearTitle(age)) ? 3200 : 1100);
}

function toggleReplay() {
  if (replay.done) { replay.done = false; replay.age = 0; replay.paused = false; $('#replay-toggle').textContent = '暫停'; stepReplay(); return; }
  replay.paused = !replay.paused;
  $('#replay-toggle').textContent = replay.paused ? '繼續' : '暫停';
  if (!replay.paused) { replay.age = Math.min(replay.age + 1, replay.current); stepReplay(); }
}

// ---------- 人物卡 ----------
// 人物卡上的帳號連結狀態：已連結／邀請加入
function personLinkBox(p) {
  const link = linkFor(p.id);
  if (link) {
    const view = cloud.views.get(link.id);
    const ready = memberReady(view);
    return h('div', { class: 'invite-box' },
      h('p', {}, `💞 已連結 ${link.name} 的帳號`),
      h('p', { class: 'hint' }, ready ? '對方選好自己的樣子了，可以看他分享的紀錄。' : '對方還沒選自己的樣子。'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: () => { $('#person-dialog').close(); openMembers(link.id); } }, `看 ${link.name} 分享的紀錄`)));
  }
  if (!cloud.me) return h('p', { class: 'hint' }, `登入雲端同步後，可以邀請${p.name}加入；對方捏好小人後，就會出現在你的場景裡。`);
  if (cloud.inviteLink && cloud.invitePerson && cloud.invitePerson.id === p.id) return inviteLinkBox();
  const btn = h('button', { type: 'button', class: 'btn small' }, `邀請${p.name}加入`);
  btn.addEventListener('click', () => withBusy(btn, () => makeInvite(p.id)));
  return h('div', { class: 'invite-box' },
    h('p', { class: 'hint' }, `邀請${p.name}用自己的帳號加入。對方捏好小人後，會和這張人物卡連起來，出現在你的場景裡。`),
    h('div', { class: 'row' }, btn));
}

function openPerson(id) {
  ui.person = { id, editing: false };
  renderPersonDialog();
  const dlg = $('#person-dialog');
  if (!dlg.open) dlg.showModal();
}

// draft 用在新增或編輯；opts.onSaved 讓「記一筆」新增完直接選起來
function openPersonEditor(id, opts = {}) {
  const p = id ? personById(id) : null;
  ui.person = {
    id, editing: true, onSaved: opts.onSaved || null,
    draft: p ? { ...p } : { kind: opts.kind || 'person', name: '', relation: opts.relation || null, petType: 'dog', petColor: 0, birthday: '', inScene: true },
  };
  renderPersonDialog();
  const dlg = $('#person-dialog');
  if (!dlg.open) dlg.showModal();
}

function renderPersonDialog() {
  const body = $('#person-body');
  const { id, editing } = ui.person;
  const p = id ? personById(id) : null;
  if (!editing && !p) { $('#person-dialog').close(); return; }

  if (!editing) {
    const list = state.moments.filter((m) => m.people.includes(p.id)).sort((a, b) => b.date.localeCompare(a.date));
    const { birthday } = state.profile;
    const first = list.length ? list[list.length - 1] : null;
    const gone = p.kind === 'pet' ? petGoneMoment(p) : null;
    const coat = p.kind === 'pet' ? (PET_COLORS[p.petType] || [])[p.petColor || 0] : null;
    const sub = [p.kind === 'pet' ? (coat ? coat.label : (PET_TYPES.find(([k]) => k === p.petType) || [, '寵物'])[1]) : p.relation || '人物'];
    if (p.birthday && !gone) sub.push(`${ageAt(p.birthday, todayStr())} 歲`);
    const facts = [`一起記了 ${list.length} 則`];
    if (first) facts.push(`第一次是你 ${ageAt(birthday, first.date)} 歲的時候`);
    if (gone) facts.push(`🌈 你 ${ageAt(birthday, gone.date)} 歲時去了彩虹橋`);
    body.replaceChildren(
      h('div', { class: 'person-head' },
        (() => { const a = h('div', { class: `person-avatar${p.kind === 'pet' ? ' pet' : ''}` }); a.innerHTML = personAvatarHtml(p); return a; })(),
        h('div', {}, h('h3', {}, personName(p)), h('div', { class: 'hint' }, sub.join(' · ')))),
      h('p', { class: 'person-facts' }, facts.join(' · ')),
      p.kind === 'person' ? personLinkBox(p) : null,
      list.length ? h('ul', { class: 'person-moments' }, list.map((m) => h('li', {},
        h('button', { type: 'button', onclick: () => { $('#person-dialog').close(); openMoment(m.id); } },
          h('span', { class: 'moment-date' }, `${ageAt(birthday, m.date)} 歲`),
          h('span', {}, eventById(m.event) ? `${eventById(m.event).icon} ` : '', m.text))))) : h('p', { class: 'hint' }, '還沒有一起的紀錄。記一筆時在「和誰」點選就會出現在這裡。'),
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => $('#person-dialog').close() }, '關閉'),
        h('button', { type: 'button', class: 'btn', onclick: () => { ui.filter = `person:${p.id}`; $('#person-dialog').close(); $('#settings-dialog').close(); renderFilters(); renderTimeline(); showTab('memories'); } }, '篩選紀錄'),
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn primary', onclick: () => openPersonEditor(p.id) }, '編輯')));
    return;
  }

  const d = ui.person.draft;
  const isPet = d.kind === 'pet';
  const name = h('input', { value: d.name, maxlength: '20', placeholder: isPet ? '沒填就顯示毛色，例如「橘白貓」' : '沒填就顯示關係，例如「媽媽」', 'aria-label': '名字' });
  name.addEventListener('input', () => { d.name = name.value; });
  const birthday = h('input', { type: 'date', value: d.birthday || '', max: todayStr(), 'aria-label': '生日' });
  birthday.addEventListener('input', () => { d.birthday = birthday.value; });
  const kindChips = id ? null : h('div', { class: 'chips' }, [['person', '👤 人物'], ['pet', '🐾 寵物']].map(([k, label]) => h('button', {
    type: 'button', class: `chip${d.kind === k ? ' on' : ''}`, onclick: () => { d.kind = k; renderPersonDialog(); },
  }, label)));

  const fields = [];
  if (!isPet) {
    fields.push(h('div', { class: 'field' }, h('span', { class: 'field-label' }, '關係'), h('div', { class: 'chips' }, RELATIONS.map((r) => h('button', {
      type: 'button', class: `chip${d.relation === r ? ' on' : ''}`, onclick: () => { d.relation = r; renderPersonDialog(); },
    }, r)))));
  } else {
    const coatBtn = (c, i) => {
      const b = h('button', {
        type: 'button', class: `coat-btn${d.petColor === i ? ' on' : ''}`, 'aria-label': c.label, 'aria-pressed': String(d.petColor === i),
        onclick: () => { d.petColor = i; renderPersonDialog(); },
      }, h('span', { class: 'coat-pic' }), h('span', {}, c.label));
      b.firstChild.innerHTML = petSvg(d.petType, i);
      return b;
    };
    fields.push(
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, '種類'), h('div', { class: 'chips' }, PET_TYPES.map(([k, label]) => h('button', {
        type: 'button', class: `chip${d.petType === k ? ' on' : ''}`, onclick: () => { d.petType = k; d.petColor = 0; renderPersonDialog(); },
      }, `${PET_ICONS[k]} ${label}`)))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, '毛色'), h('div', { class: 'coat-grid' }, PET_COLORS[d.petType].map(coatBtn))),
    );
    const inScene = h('input', { type: 'checkbox' });
    inScene.checked = d.inScene !== false;
    inScene.addEventListener('change', () => { d.inScene = inScene.checked; });
    fields.push(h('label', { class: 'switch' }, inScene, h('span', {}, '在場景裡陪著我')),
      h('p', { class: 'hint' }, '場景裡最多 2 隻，超過時會出現最新加入的 2 隻；不想出現的可以關掉。'));
  }

  const avoid = h('input', { type: 'checkbox' });
  avoid.checked = !!d.hideInMemories;
  avoid.addEventListener('change', () => { d.hideInMemories = avoid.checked; });
  fields.push(h('label', { class: 'switch small-switch' }, avoid, h('span', {}, '回顧時避開（「那年今日」、人生重播、小人的話都不會提到）')));
  const save = h('button', { type: 'button', class: 'btn primary' }, '儲存');
  save.addEventListener('click', () => savePerson());
  body.replaceChildren(
    h('div', { class: 'sheet-top' }, h('h3', {}, id ? `編輯 ${personName(personById(id))}` : isPet ? '新增寵物' : '新增人物')),
    kindChips,
    ...(isPet ? fields : []),
    h('label', {}, '名字（選填）', name),
    ...(isPet ? [] : fields),
    h('label', {}, isPet ? '生日或到家的日子（選填）' : '生日（選填）', birthday),
    id ? h('div', { class: 'danger-zone' }, h('button', { type: 'button', class: 'btn danger', onclick: () => deletePerson(id) }, `刪除${isPet ? '這隻寵物' : '這個人物'}`)) : null,
    h('div', { class: 'sheet-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => (id ? openPerson(id) : $('#person-dialog').close()) }, '取消'),
      h('span', { class: 'spacer' }),
      save));
}

async function savePerson() {
  const { id, draft, onSaved } = ui.person;
  const name = (draft.name || '').trim();
  if (draft.kind === 'person' && !draft.relation) { toast('請選擇關係'); return; }
  const now = new Date().toISOString();
  const clean = {
    kind: draft.kind, name, birthday: isValidDateStr(draft.birthday) ? draft.birthday : '', hideInMemories: !!draft.hideInMemories, updatedAt: now,
    ...(draft.kind === 'pet' ? { petType: draft.petType, petColor: draft.petColor || 0, inScene: draft.inScene !== false, relation: null } : { relation: draft.relation }),
  };
  let person;
  if (id) { person = personById(id); Object.assign(person, clean); }
  else { person = { id: newId(), createdAt: now, ...clean }; state.people.push(person); }
  if (!(await saveState())) return;
  toast(id ? '已更新' : `已新增 ${personLabel(person)}`);
  render();
  renderPeopleSection();
  if (onSaved) { $('#person-dialog').close(); onSaved(person); } else openPerson(person.id);
}

async function deletePerson(id) {
  const p = personById(id);
  if (!p || !(await ask({
    title: `刪除「${personName(p)}」？`,
    body: '紀錄會留著，只是不再標記這個人。',
    actions: [{ label: '先不要', value: false }, { label: '刪除', value: true, kind: 'danger' }],
  }))) return;
  const now = new Date().toISOString();
  state.people = state.people.filter((x) => x.id !== id);
  state.deleted[id] = now;
  const link = linkFor(id);
  if (link) cloudApi.bindPerson(link.id, null).then((me) => { cloud.me = me; }).catch(() => {});
  for (const m of state.moments) {
    if (m.people.includes(id)) { m.people = m.people.filter((x) => x !== id); m.updatedAt = now; }
  }
  if (ui.filter === `person:${id}`) ui.filter = 'all';
  if (!(await saveState())) return;
  $('#person-dialog').close();
  toast('已刪除');
  render();
  renderPeopleSection();
}

function renderPeopleSection() {
  const root = $('#people-section');
  if (!root || !state.profile) return;
  const list = peopleByUse();
  const count = new Map();
  for (const m of state.moments) for (const id of m.people) count.set(id, (count.get(id) || 0) + 1);
  root.replaceChildren(
    h('p', { class: 'hint' }, '家人、朋友、寵物。記一筆時可以點選「和誰」，寵物會在場景裡陪著你。'),
    list.length ? h('div', { class: 'person-list' }, list.map((p) => {
      const pic = h('span', { class: `person-avatar${p.kind === 'pet' ? ' pet' : ''}` });
      pic.innerHTML = personAvatarHtml(p);
      const sub = [p.kind === 'pet' ? ((PET_COLORS[p.petType] || [])[p.petColor || 0] || {}).label || '寵物' : p.relation || '人物', `${count.get(p.id) || 0} 則`];
      if (p.kind === 'pet' && petGoneMoment(p)) sub.push('🌈');
      else if (p.kind === 'pet' && p.inScene !== false) sub.push('在場景裡');
      return h('button', { type: 'button', class: 'person-row', onclick: () => openPerson(p.id) },
        pic, h('span', { class: 'profile-text' }, h('b', {}, personName(p)), h('span', { class: 'hint' }, sub.join(' · '))), h('span', { class: 'chev' }, '›'));
    })) : h('p', { class: 'empty hint' }, '還沒有人物。用下面的按鈕新增家人、朋友或寵物。'));
  renderMe();
}

// ---------- 年歲 ----------
function openYear(age) {
  const { birthday } = state.profile;
  const [start, end] = ageRange(birthday, age);
  const list = state.moments.filter((m) => ageAt(birthday, m.date) === age);
  const stars = list.filter((m) => m.starred).length;
  ui.yearAge = age;
  $('#year-heading').textContent = `${age} 歲`;
  $('#year-range').textContent = `${fmtDate(start)} – ${fmtDate(end)} · ${list.length} 則${stars ? ` · ☆${stars}` : ''}`;
  $('#year-form').summary.value = yearTitle(age);
  $('#year-form').quiet.checked = !!(state.years[String(age)] || {}).quiet;
  $('#year-recall').hidden = age >= ageAt(birthday, todayStr()); // 今年用「記一筆」就好
  renderStatBars($('#year-stats'), statsFor(list), yearFocus(age));
  $('#year-dialog').showModal();
}

async function saveYear(e) {
  e.preventDefault();
  const title = e.target.summary.value.trim();
  const key = String(ui.yearAge);
  setYearField(key, 'title', title);
  setYearField(key, 'quiet', e.target.quiet.checked || null);
  if (await saveState()) {
    $('#year-dialog').close();
    toast('已儲存');
    render();
  }
}

function addMomentInYear() {
  const { birthday } = state.profile;
  const age = ui.yearAge;
  const today = todayStr();
  const date = age === ageAt(birthday, today) ? today : toDateStr(ageRange(birthday, age)[0]);
  $('#year-dialog').close();
  openMoment(null, { date });
}

function viewYear() {
  $('#year-dialog').close();
  selectAge(ui.yearAge, true);
}

// ---------- 回憶模式 ----------
const isRecorded = (age) => !!yearTitle(age) || state.moments.some((m) => ageAt(state.profile.birthday, m.date) === age);

function openRecall() {
  const current = ageAt(state.profile.birthday, todayStr());
  let age = state.recall && state.recall.age <= current ? state.recall.age : null;
  if (age == null) {
    age = 0;
    while (age < current && isRecorded(age)) age++;
  }
  ui.recallDone = false;
  setRecallAge(age);
  $('#recall-dialog').showModal();
}

function setRecallAge(age) {
  ui.recall = { age, q: 0 };
  $('#recall-text').value = '';
  $('#recall-star').checked = false;
  $('#recall-date').value = '';
  $('#recall-date-wrap').open = false;
  $('#recall-summary').value = yearTitle(age);
  renderRecall();
  $('#recall-dialog').scrollTop = 0;
}

function recallDateBounds(age) {
  const { birthday } = state.profile;
  const [start, end] = ageRange(birthday, age);
  const today = todayStr();
  const min = toDateStr(start) < birthday ? birthday : toDateStr(start);
  const max = toDateStr(end) > today ? today : toDateStr(end);
  return [min, max];
}

function renderRecall() {
  const { birthday } = state.profile;
  const { age, q } = ui.recall;
  const current = ageAt(birthday, todayStr());
  const [start, end] = ageRange(birthday, age);
  const stage = lifeStage(age);
  const questions = PROMPTS[age === current ? 'now' : stage.key];

  $('#recall-age').textContent = `${age} 歲`;
  $('#recall-stage').textContent = age === current ? '今年' : `大約是${stage.label}`;
  $('#recall-range').textContent = `${fmtDate(start)} – ${fmtDate(end)}`;
  $('#recall-question').textContent = questions[q % questions.length];
  const [min, max] = recallDateBounds(age);
  $('#recall-date').min = min;
  $('#recall-date').max = max;

  let recorded = 0;
  for (let a = 0; a <= current; a++) if (isRecorded(a)) recorded++;
  $('#recall-bar').style.width = `${(recorded / (current + 1)) * 100}%`;
  $('#recall-progress-text').textContent = `已回憶 ${recorded} / ${current + 1} 個年歲`;

  const list = state.moments.filter((m) => ageAt(birthday, m.date) === age).sort((a, b) => a.date.localeCompare(b.date));
  $('#recall-list').replaceChildren(...(list.length ? [
    h('div', { class: 'field-label' }, `這一歲已經記了 ${list.length} 則`),
    h('ul', { class: 'recall-items' }, list.map((m) => h('li', {},
      h('button', { type: 'button', onclick: () => openMoment(m.id) },
        h('span', { class: 'moment-date' }, m.approx ? '這一年' : m.date.slice(5).replace('-', '/')),
        h('span', { class: 'recall-item-text' }, m.starred ? '★ ' : '', m.text, m.photoIds.length ? ` 📷${m.photoIds.length}` : ''))))),
  ] : []));

  $('#recall-prev').disabled = age === 0;
  $('#recall-next').textContent = age === current ? '完成 ✓' : '下一歲 ›';
}

// 換頁、關閉前自動存：這一歲的一句話＋還沒按「記下來」的文字
async function commitRecall() {
  const { age } = ui.recall;
  const now = new Date().toISOString();
  let added = false;

  const summary = $('#recall-summary').value.trim();
  if (summary !== yearTitle(age)) setYearField(age, 'title', summary);

  const text = $('#recall-text').value.trim();
  if (text) {
    const exact = $('#recall-date').value;
    const [min, max] = recallDateBounds(age);
    if (exact && (exact < min || exact > max)) {
      toast(`日期要在 ${min.replace(/-/g, '/')} – ${max.replace(/-/g, '/')} 之間`);
      return null;
    }
    state.moments.push({
      id: newId(), date: exact || min, approx: !exact, text, mood: null, tags: [], photoIds: [], people: [], event: null,
      starred: $('#recall-star').checked, createdAt: now, updatedAt: now,
    });
    $('#recall-text').value = '';
    $('#recall-star').checked = false;
    $('#recall-date').value = '';
    added = true;
  }

  state.recall = { age };
  return (await saveState()) ? added : null;
}

async function recallSave() {
  if (!$('#recall-text').value.trim()) { $('#recall-text').focus(); return; }
  if (await commitRecall()) {
    toast('記下來了');
    ui.recall.q++;
    renderRecall();
    render();
  }
}

async function recallGo(delta) {
  if (ui.recallBusy) return; // 連點時不要跳過年歲
  ui.recallBusy = true;
  try { await recallStep(delta); } finally { ui.recallBusy = false; }
}

async function recallStep(delta) {
  const added = await commitRecall();
  if (added === null) return;
  if (added) toast('記下來了');
  const current = ageAt(state.profile.birthday, todayStr());
  const next = ui.recall.age + delta;
  if (next > current) {
    state.recall = null;
    ui.recallDone = true;
    await saveState();
    $('#recall-dialog').close();
    toast('🎉 回憶到今年了！之後隨時可以再回來補');
  } else if (next >= 0) {
    setRecallAge(next);
  }
  render();
}

async function recallMore() {
  const added = await commitRecall();
  if (added === null) return;
  const { birthday } = state.profile;
  const age = ui.recall.age;
  const current = ageAt(birthday, todayStr());
  openMoment(null, age === current ? {} : { date: recallDateBounds(age)[0], approx: true });
}

// ---------- 大圖 ----------
function openLightbox(ids, index, loader = null) {
  ui.lightbox.ids = ids;
  ui.lightbox.index = index;
  ui.lightbox.loader = loader;
  $('#lightbox').showModal();
  showLightboxPhoto();
}

async function showLightboxPhoto() {
  const { ids, index } = ui.lightbox;
  const id = ids[index];
  $('#lb-count').textContent = ids.length > 1 ? `${index + 1} / ${ids.length}` : '';
  $('#lb-prev').hidden = index === 0;
  $('#lb-next').hidden = index === ids.length - 1;
  const img = $('#lightbox-img');
  if (ui.lightbox.loader) {
    img.src = (await ui.lightbox.loader(id, 'thumb')) || '';
    const full = await ui.lightbox.loader(id, 'full');
    if (full && ui.lightbox.ids[ui.lightbox.index] === id) img.src = full;
    return;
  }
  img.src = (await thumbUrl(id)) || ''; // 先放縮圖，大圖讀好再換
  const photo = await db.getPhoto(id).catch(() => null);
  if (!photo || ui.lightbox.ids[ui.lightbox.index] !== id || !$('#lightbox').open) return;
  if (ui.lightbox.url) URL.revokeObjectURL(ui.lightbox.url);
  ui.lightbox.url = URL.createObjectURL(photo.blob);
  img.src = ui.lightbox.url;
}

function stepLightbox(delta) {
  const next = ui.lightbox.index + delta;
  if (next < 0 || next >= ui.lightbox.ids.length) return;
  ui.lightbox.index = next;
  showLightboxPhoto();
}

// ---------- 個人資料 ----------
async function saveProfile(form) {
  const name = form.name.value.trim();
  const birthday = form.birthday.value;
  if (!name || !isValidDateStr(birthday)) return false;
  if (birthday > todayStr()) { toast('生日不能在未來'); return false; }
  const early = state.moments.filter((m) => m.date < birthday).length;
  if (early && !(await ask({
    title: '有紀錄比這個生日還早',
    body: `有 ${early} 則紀錄的日期早於這個生日，存了之後它們會算在「還沒出生」。`,
    actions: [{ label: '再改一下', value: false }, { label: '照樣儲存', value: true, kind: 'primary' }],
  }))) return false;
  state.profile = { ...state.profile, name, birthday, updatedAt: new Date().toISOString() };
  return saveState();
}

// ---------- 備份 ----------
// 兩段式：先準備 ZIP，再按一次分享。iPhone 規定分享面板必須由點擊直接觸發，
// 照片多時準備時間會超過這個時限，所以拆成兩步。
function resetExportButton() {
  ui.preparedExport = null;
  const btn = $('#export-btn');
  btn.textContent = '匯出備份';
}

async function onExportClick() {
  if (ui.preparedExport) { deliverExport(); return; }
  const btn = $('#export-btn');
  btn.disabled = true;
  btn.textContent = '準備備份檔中…';
  try {
    const exportedAt = new Date().toISOString();
    const referenced = new Set(state.moments.flatMap((m) => m.photoIds));
    const photos = (await db.getAllPhotos()).filter((p) => referenced.has(p.id));
    const data = { ...state, lastExportAt: exportedAt, photos: photos.map(({ blob, thumb, ...meta }) => meta) };
    const files = [{ name: 'data.json', blob: new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }) }];
    for (const p of photos) {
      files.push({ name: `photos/${p.id}.jpg`, blob: p.blob }, { name: `photos/${p.id}-thumb.jpg`, blob: p.thumb });
    }
    const zip = await createZip(files);
    ui.preparedExport = { exportedAt, file: new File([zip], `wowo-${todayStr()}.zip`, { type: 'application/zip' }) };
    btn.textContent = `儲存備份檔（${fmtSize(zip.size)}）`;
    btn.classList.add('primary');
  } catch (e) {
    toast('備份檔準備失敗');
    resetExportButton();
  } finally {
    btn.disabled = false;
  }
}

async function deliverExport() {
  const { file, exportedAt } = ui.preparedExport;
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: file.name });
    } else {
      const url = URL.createObjectURL(file);
      h('a', { href: url, download: file.name }).click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  } catch (e) {
    if (e.name !== 'AbortError') toast('匯出失敗');
    return;
  }
  resetExportButton();
  state.lastExportAt = exportedAt;
  await saveState();
  toast('已匯出備份');
  render();
  renderSettingsStatus();
}

function validateImport(data) {
  if (!data || ![1, 2].includes(data.version) || !Array.isArray(data.moments)) return '不是 wowo 的備份檔';
  if (data.profile && (!data.profile.name || !isValidDateStr(data.profile.birthday))) return '個人資料格式不正確';
  for (const m of data.moments) {
    if (!m || typeof m.id !== 'string' || !isValidDateStr(m.date) || typeof m.text !== 'string') return '紀錄格式不正確';
    if (m.photoIds != null && !Array.isArray(m.photoIds)) return '紀錄格式不正確';
    if (m.people != null && !Array.isArray(m.people)) return '紀錄格式不正確';
  }
  if (data.people != null && !Array.isArray(data.people)) return '人物格式不正確';
  if (data.letters != null && !Array.isArray(data.letters)) return '信件格式不正確';
  for (const x of data.people || []) {
    if (!x || typeof x.id !== 'string' || typeof x.name !== 'string') return '人物格式不正確';
  }
  return null;
}

// 從 ZIP 取出這些時刻用到的照片；找不到的照片會從時刻上移除
async function loadImportPhotos(zip, moments, photoMeta, localIds) {
  const records = [];
  const available = new Set(localIds);
  if (zip) {
    for (const id of new Set(moments.flatMap((m) => m.photoIds))) {
      const fullName = zip.find(`photos/${id}.jpg`);
      if (!fullName) continue;
      const blob = await zip.blob(fullName, 'image/jpeg');
      const thumbName = zip.find(`photos/${id}-thumb.jpg`);
      const thumb = thumbName ? await zip.blob(thumbName, 'image/jpeg') : await makeThumb(blob);
      const meta = photoMeta.get(id) || {};
      records.push({ id, momentId: meta.momentId, blob, thumb, w: meta.w, h: meta.h, createdAt: meta.createdAt || new Date().toISOString() });
      available.add(id);
    }
  }
  moments.forEach((m) => { m.photoIds = m.photoIds.filter((id) => available.has(id)); });
  return records;
}

async function importData(file) {
  toast('讀取備份檔中…', 10000);
  let data;
  let zip = null;
  try {
    const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    if (head[0] === 0x50 && head[1] === 0x4b) { // "PK"
      zip = await readZip(file);
      const name = zip.find('data.json');
      if (!name) throw new Error('備份檔裡找不到 data.json');
      data = JSON.parse(await (await zip.blob(name)).text());
    } else {
      data = JSON.parse(await file.text());
    }
  } catch (e) {
    toast(e instanceof SyntaxError ? '讀不懂這個檔案' : e.message);
    return;
  }
  const err = validateImport(data);
  if (err) { toast(err); return; }

  const incoming = normalize(data);
  const photoMeta = new Map((Array.isArray(data.photos) ? data.photos : []).map((p) => [p.id, p]));
  let replace = state.moments.length === 0;
  if (!replace) {
    const how = await ask({
      title: '要怎麼匯入這份備份？',
      body: [`備份檔有 ${incoming.moments.length} 則紀錄，這支手機上有 ${state.moments.length} 則。`,
        h('p', { class: 'hint' }, '合併：兩邊都留著，同一則保留比較新的版本。取代：手機上的資料換成備份檔的內容。')],
      actions: [{ label: '合併兩邊（建議）', value: 'merge', kind: 'primary' }, { label: '整個取代成備份檔', value: 'replace', kind: 'danger' }],
    });
    if (!how) return;
    replace = how === 'replace';
  }

  try {
    if (replace) {
      const records = await loadImportPhotos(zip, incoming.moments, photoMeta, []);
      await db.putPhotos(records);
      const now = new Date().toISOString();
      const keep = new Set(incoming.moments.map((m) => m.id));
      state.moments.filter((m) => !keep.has(m.id)).forEach((m) => { incoming.deleted[m.id] = now; });
      state = incoming;
    } else {
      const byId = new Map(state.moments.map((m) => [m.id, m]));
      const winners = incoming.moments.filter((m) => {
        const cur = byId.get(m.id);
        return !cur || (m.updatedAt || '') > (cur.updatedAt || '');
      });
      const records = await loadImportPhotos(zip, winners, photoMeta, await db.getAllPhotoIds());
      await db.putPhotos(records);
      winners.forEach((m) => byId.set(m.id, m));
      state.moments = [...byId.values()];
      state.years = { ...incoming.years, ...state.years };
      const people = new Map(state.people.map((x) => [x.id, x]));
      for (const x of incoming.people) {
        const cur = people.get(x.id);
        if (!cur || (x.updatedAt || '') > (cur.updatedAt || '')) people.set(x.id, x);
      }
      state.people = [...people.values()];
      const letters = new Map(state.letters.map((x) => [x.id, x]));
      for (const x of incoming.letters) {
        const cur = letters.get(x.id);
        if (!cur || (x.updatedAt || '') > (cur.updatedAt || '')) letters.set(x.id, x);
      }
      state.letters = [...letters.values()];
      Object.assign(state, mergeJoyData(state, incoming, state.deleted));
      if (!state.profile) state.profile = incoming.profile;
    }
  } catch (e) {
    toast('匯入照片失敗，可能是手機空間不足');
    return;
  }

  if (await saveState()) {
    await cleanupOrphanPhotos();
    toast(replace ? '已還原備份' : '已合併備份');
    $('#settings-dialog').close();
    render();
  }
}

// 刪掉沒有任何時刻引用的照片（中途失敗或匯入取代後留下的）
async function cleanupOrphanPhotos() {
  const referenced = new Set([...state.moments.flatMap((m) => m.photoIds), ...undoKeep]);
  const orphans = (await db.getAllPhotoIds()).filter((id) => !referenced.has(id));
  if (orphans.length) {
    await db.deletePhotos(orphans);
    orphans.forEach(forgetThumb);
  }
}

function renderSettingsStatus() {
  $('#backup-status').textContent = state.lastExportAt
    ? `上次備份：${fmtDate(new Date(state.lastExportAt))}`
    : '尚未備份過';
}

async function renderStorageStatus() {
  const photos = state.moments.reduce((n, m) => n + m.photoIds.length, 0);
  let text = `紀錄 ${state.moments.length} 則 · 照片 ${photos} 張`;
  if (navigator.storage && navigator.storage.estimate) {
    const { usage } = await navigator.storage.estimate();
    if (usage != null) text += ` · 約占用 ${fmtSize(usage)}`;
  }
  if (navigator.storage && navigator.storage.persisted) {
    text += (await navigator.storage.persisted()) ? '\n✓ 瀏覽器已允許長期保存資料' : '\n瀏覽器可能在空間不足時清除資料，請定期備份';
  }
  $('#storage-status').textContent = text;
}

// ---------- 捏小人 ----------
// pic：選項用小圖顯示（head 只看頭、body 看全身）；toggle 加 pic 就是可以開關的小圖卡
const AVATAR_TABS = [
  ['body', '身體', [{ key: 'gender', label: '性別', choices: GENDERS, note: '只影響學生制服（裙子或褲子），其他都能自由搭配' }, { key: 'skin', label: '膚色', colors: SKINS }]],
  ['hair', '頭髮', [{ key: 'hairStyle', label: '髮型', choices: HAIR_STYLES, pic: 'head' }, { key: 'hair', label: '髮色', colors: HAIRS, note: '50 歲以後會慢慢變淡，65 歲變白髮' }]],
  ['face', '臉', [{ key: 'eyes', label: '眼睛', choices: EYES, pic: 'head' }, { key: 'beard', label: '鬍子', choices: BEARDS, pic: 'head', note: '18 歲以後才會出現' },
    { label: '細節', toggles: ['lashes', 'blush', 'freckles'], pic: 'head' }]],
  ['outfit', '衣服', [{ key: 'outfit', label: '款式', choices: OUTFITS, pic: 'body' }, { key: 'outfitColor', label: '顏色', colors: OUTFIT_COLORS },
    { key: 'uniform', label: '國小到高中穿制服', toggle: true }]],
  ['acc', '配件', [{ label: '配件（可以同時戴好幾個）', toggles: ['glasses', 'hat', 'headphones', 'hairclip'], pic: 'head' }]],
];
const TOGGLE_LABELS = { lashes: '睫毛', blush: '腮紅', freckles: '雀斑', glasses: '眼鏡', hat: '帽子', headphones: '耳機', hairclip: '髮夾' };

function openAvatarEditor() {
  const age = ageAt(state.profile.birthday, todayStr());
  ui.avatar = { draft: { ...myAvatar(), v: 2 }, tab: 'body', age, history: [] };
  const stage = lifeStage(age);
  $('#avatar-age-label').textContent = `${age} 歲的你${stage.key === 'adult' ? '' : `（${stage.label}）`}。小人會跟著你的年紀長大，上學時會穿制服。`;
  renderAvatarEditor();
  $('#avatar-dialog').showModal();
  drawAvatarPreview(); // 先畫一次，不要等計時器
  clearInterval(ui.avatar.timer);
  ui.avatar.timer = setInterval(drawAvatarPreview, 120);
}

function drawAvatarPreview() {
  if (!ui.avatar) return;
  const canvas = $('#avatar-canvas');
  const ctx = canvas.getContext('2d');
  const scale = 8;
  if (canvas.width !== 22 * scale) { canvas.width = 22 * scale; canvas.height = 25 * scale; }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, 22, 25);
  ctx.fillStyle = '#2a3040'; ctx.fillRect(0, 23, 22, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(6, 23, 10, 1);
  const t = performance.now();
  const blink = t % 3600 < 160;
  const { age } = ui.avatar;
  const sprite = composeAvatar(ui.avatar.draft, age, lifeStage(age).key, { blink });
  drawAvatar(ctx, sprite, 1, 2, { breathe: Math.floor(t / 800) % 2 === 1 });
}

// 每一次修改前先記下來，「↺ 復原」可以一步一步退回去
function setAvatar(patch) {
  ui.avatar.history.push({ ...ui.avatar.draft });
  Object.assign(ui.avatar.draft, patch);
  renderAvatarEditor();
  drawAvatarPreview();
}

// 選項小圖：把這個選項套到目前的小人上畫出來
function avatarPic(patch, kind) {
  const { draft, age } = ui.avatar;
  const span = h('span', { class: `opt-pic ${kind}` });
  span.innerHTML = avatarSvg({ ...draft, ...patch }, age, lifeStage(age).key, { crop: kind });
  return span;
}

function renderAvatarEditor() {
  const { draft, tab } = ui.avatar;
  $('#avatar-undo').disabled = !ui.avatar.history.length;
  $('#avatar-tabs').replaceChildren(...AVATAR_TABS.map(([key, label]) => h('button', {
    type: 'button', class: `chip${tab === key ? ' on' : ''}`, onclick: () => { ui.avatar.tab = key; renderAvatarEditor(); },
  }, label)));
  const set = setAvatar;
  const groups = AVATAR_TABS.find(([key]) => key === tab)[2];
  $('#avatar-options').replaceChildren(...groups.map((g) => {
    let control;
    if (g.toggles) {
      control = h('div', { class: 'pic-grid' }, g.toggles.map((k) => h('button', {
        type: 'button', class: `pic-btn${draft[k] ? ' on' : ''}`, 'aria-pressed': String(!!draft[k]), onclick: () => set({ [k]: !draft[k] }),
      }, avatarPic({ [k]: true }, g.pic), h('span', {}, TOGGLE_LABELS[k]))));
      return h('div', { class: 'field' }, h('span', { class: 'field-label' }, g.label), control);
    }
    if (g.toggle) {
      const box = h('input', { type: 'checkbox' });
      box.checked = !!draft[g.key];
      box.addEventListener('change', () => set({ [g.key]: box.checked }));
      return h('label', { class: 'switch' }, box, h('span', {}, g.label));
    }
    if (g.colors) {
      control = h('div', { class: 'swatches' }, g.colors.map((c, i) => h('button', {
        type: 'button', class: `swatch-btn${draft[g.key] === i ? ' on' : ''}`, style: `--c:${c}`, 'aria-label': `${g.label} ${i + 1}`,
        onclick: () => set({ [g.key]: i }),
      })));
    } else if (g.pic) {
      control = h('div', { class: 'pic-grid' }, g.choices.map(([v, label]) => h('button', {
        type: 'button', class: `pic-btn${draft[g.key] === v ? ' on' : ''}`, 'aria-pressed': String(draft[g.key] === v), onclick: () => set({ [g.key]: v }),
      }, avatarPic({ [g.key]: v }, g.pic), h('span', {}, label))));
    } else {
      control = h('div', { class: 'chips' }, g.choices.map(([v, label]) => h('button', {
        type: 'button', class: `chip${draft[g.key] === v ? ' on' : ''}`, onclick: () => set({ [g.key]: v }),
      }, label)));
    }
    return h('div', { class: 'field' }, h('span', { class: 'field-label' }, g.label), control, g.note ? h('span', { class: 'hint' }, g.note) : null);
  }));
}

async function saveAvatar() {
  state.profile = { ...state.profile, avatar: { ...ui.avatar.draft, v: 2 }, updatedAt: new Date().toISOString() };
  if (await saveState()) {
    ui.avatar.history = [];
    $('#avatar-dialog').close();
    toast('小人更新好了');
    render();
    if (scene) scene.celebrate();
  }
}

// ---------- 真實天氣 ----------
async function loadWeather(force = false) {
  if (!weather.weatherEnabled()) { ui.weather = null; return; }
  const w = await weather.refreshWeather(force);
  ui.weather = w;
  if (state.profile) renderNow();
}

function renderWeatherSection() {
  const root = $('#weather-section');
  const on = weather.weatherEnabled();
  const w = ui.weather;
  const toggle = $('#weather-toggle');
  toggle.textContent = on ? '關閉真實天氣' : '開啟真實天氣';
  toggle.classList.toggle('primary', !on);
  toggle.onclick = async () => {
    toggle.disabled = true;
    try {
      if (on) { weather.disableWeather(); ui.weather = null; render(); }
      else { ui.weather = await weather.enableWeather(); toast(ui.weather ? `${ui.weather.icon} ${ui.weather.temp}° ${ui.weather.label}` : '暫時抓不到天氣，稍後會自動再試'); render(); }
    } catch (e) { toast(e.message); }
    toggle.disabled = false;
    renderWeatherSection();
    renderMe();
  };
  const items = [
    h('p', { class: 'hint' }, on
      ? (w ? `目前：${w.icon} ${w.temp}° ${w.label}（每 30 分鐘更新）` : '正在取得天氣…')
      : '開啟後，場景會跟著你那裡的真實天氣下雨、起霧、轉陰，日出日落也會更準。'),
    h('div', { class: 'row' }),
  ];
  if (on) {
    const relocate = h('button', { type: 'button', class: 'btn' }, '重新定位');
    relocate.addEventListener('click', async () => {
      relocate.disabled = true;
      try { ui.weather = await weather.enableWeather(); toast('已更新位置'); render(); } catch (e) { toast(e.message); }
      relocate.disabled = false;
      renderWeatherSection();
    });
    items[1].append(relocate);
  }
  items.push(h('p', { class: 'hint' }, '位置只在按下按鈕時取得一次，約略到 1 公里，只存在這支手機，用來向免費的 Open-Meteo 查天氣。'));
  root.replaceChildren(...items);
}

function openSettings(page = 'cloud') {
  const form = $('#profile-form');
  form.name.value = state.profile.name;
  form.birthday.value = state.profile.birthday;
  form.birthday.syncPicker();
  form.birthday.max = todayStr();
  resetExportButton();
  renderAppVersion();
  renderWeatherSection();
  renderCloudSection();
  renderPeopleSection();
  $('#pref-achievements').checked = !!state.prefs.showAchievements;
  $('#pref-world-sad').checked = state.prefs.worldSad !== false;
  $('#pref-ai-story').checked = !!state.prefs.aiStory;
  $('#pref-music').checked = musicPref();
  renderThemeChips();
  renderSettingsStatus();
  renderStorageStatus();
  settingsGo(page);
  if (!$('#settings-dialog').open) $('#settings-dialog').showModal();
}

function settingsGo(page) {
  document.querySelectorAll('#settings-dialog .settings-page').forEach((el) => { el.hidden = el.dataset.page !== page; });
  $('#settings-dialog').scrollTop = 0;
}

// ---------- 外觀：深色、淺色、跟隨系統（存在這支手機，每台裝置可以不同） ----------
const THEMES = [['light', '淺色'], ['dark', '深色'], ['auto', '跟隨系統']];
function themePref() {
  try { return localStorage.getItem('lifey.theme') || 'light'; } catch (e) { return 'light'; }
}
function applyTheme() {
  const pref = themePref();
  const light = pref === 'light' || (pref === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = light ? '#ffffff' : '#141215';
}
function renderThemeChips() {
  const pref = themePref();
  $('#theme-chips').replaceChildren(...THEMES.map(([v, label]) => h('button', {
    type: 'button', class: `chip${pref === v ? ' on' : ''}`, 'aria-pressed': String(pref === v),
    onclick: () => { try { localStorage.setItem('lifey.theme', v); } catch (e) { /* 無痕模式存不了，只套用這次 */ } applyTheme(); renderThemeChips(); },
  }, label)));
}

// ---------- 背景音樂 ----------
function renderMusicBtn() {
  const on = musicPref();
  const cur = trackPref();
  $('#cy-bgm').classList.toggle('on', on);
  $('#cy-bgm').setAttribute('aria-pressed', String(on));
  $('#cy-bgm-label').textContent = on ? cur.name : 'BGM';
  $('#cy-bgm-next').hidden = !on;
  $('#pref-music').checked = on;
  $('#music-tracks').replaceChildren(...TRACKS.map((t) => h('button', {
    type: 'button', class: `chip${on && cur.id === t.id ? ' on' : ''}`, 'aria-pressed': String(on && cur.id === t.id),
    onclick: () => pickTrack(t.id),
  }, t.name)));
}
async function pickTrack(id) {
  const ok = await setTrack(id);
  renderMusicBtn();
  if (!ok) musicFailed();
}
function nextTrack() {
  pickTrack(nextTrackOf().id);
}
function musicFailed() {
  setMusic(false);
  renderMusicBtn();
  toast('音樂還沒準備好，晚點再試試');
}
async function toggleMusic(on) {
  const ok = await setMusic(on);
  renderMusicBtn();
  if (on && !ok) musicFailed();
}

// ---------- 小窩全畫面：房間放到最大，比較好點 ----------
function setRoomFull(on) {
  const box = document.querySelector('.home-page .room-box');
  box.classList.toggle('full', on);
  // 手機直向時房間比畫面寬：先捲到中間
  box.scrollLeft = on ? (box.scrollWidth - box.clientWidth) / 2 : 0;
  document.documentElement.classList.toggle('room-full', on);
  $('#room-zoom').setAttribute('aria-pressed', String(on));
  $('#room-zoom').setAttribute('aria-label', on ? '離開全畫面' : '全畫面');
}

// ---------- 雲端同步 ----------
function scheduleSync(delay = 2000) {
  if (!cloud.me) return;
  clearTimeout(cloud.timer);
  cloud.timer = setTimeout(runSync, delay);
}

async function applyMerged(merged) {
  state = normalize(cloudApi.mergeStates(state, merged)); // 同步途中本機若有新改動，一起保留
  await saveState({ fromSync: true });
  render();
}

async function runSync() {
  if (!cloud.me || !state.profile) return;
  if (cloud.running) { cloud.again = true; return; }
  cloud.running = true;
  setCloudStatus('syncing', '同步中…');
  try {
    const { downloaded } = await cloudApi.syncNow(() => state, applyMerged, (msg) => setCloudStatus('syncing', msg));
    cloud.lastSync = new Date();
    setCloudStatus('ok', '已同步');
    if (downloaded) render();
    cleanupOrphanPhotos().catch(() => {});
  } catch (e) {
    if (e.status === 401) {
      cloud.me = null;
      setCloudStatus('off', '登入已過期，請重新登入');
    } else {
      setCloudStatus('error', e.message);
    }
  } finally {
    cloud.running = false;
    if (cloud.again) { cloud.again = false; scheduleSync(500); }
  }
}

function setCloudStatus(status, message) {
  cloud.status = status;
  cloud.message = message;
  const btn = $('#sync-btn');
  btn.hidden = !cloud.me;
  btn.className = `icon-btn sync-btn ${status}`;
  btn.textContent = status === 'syncing' ? '⟳' : status === 'error' ? '⚠︎' : '☁︎';
  btn.title = message;
  $('#partner-btn').hidden = !(cloud.me && cloud.me.links.length);
  if (state.profile) renderBackupBanner();
  const line = $('#cloud-status');
  if (line) line.textContent = cloudStatusText();
}

function cloudStatusText() {
  if (cloud.status === 'syncing') return cloud.message;
  if (cloud.status === 'error') return `⚠︎ ${cloud.message}（會自動重試）`;
  if (cloud.lastSync) return `✓ 已同步 · ${pad(cloud.lastSync.getHours())}:${pad(cloud.lastSync.getMinutes())}`;
  return cloud.message;
}

async function afterLogin(result) {
  cloud.me = await cloudApi.fetchMe();
  toast(`已登入：${result.user.name}`);
  // 這支手機已經有別人的資料？先問要不要合併
  const remote = (await cloudApi.fetchRemote()).doc;
  const local = state.profile;
  if (remote && remote.profile && local && state.moments.length
    && (remote.profile.name !== local.name || remote.profile.birthday !== local.birthday)
    && await askCloudOnly(local, remote)) {
    state = normalize(remote);
    await saveState({ fromSync: true });
  } else if (remote && remote.profile && (!state.profile || !state.moments.length)) {
    // 註冊頁沒有登入：換手機的人先填名字生日進來，再到「我 → 雲端與家人」登入，這時手機上還沒寫東西，直接用雲端的
    state = normalize(remote);
    await saveState({ fromSync: true });
  }
  setCloudStatus('ok', '');
  render();
  renderCloudSection();
  await runSync();
  renderCloudSection();
}

// 手機和雲端是不同人的資料：預設合併（不會弄丟東西），要「只用雲端」得再確認一次
async function askCloudOnly(local, remote) {
  const n = state.moments.length;
  const how = await ask({
    title: '手機和雲端的資料不一樣',
    body: [`這支手機上是「${local.name}」的 ${n} 則紀錄，雲端帳號是「${remote.profile.name}」。`,
      h('p', { class: 'hint' }, '合併會把兩邊的紀錄放在一起，什麼都不會刪掉。')],
    actions: [{ label: '合併兩邊（建議）', value: 'merge', kind: 'primary' }, { label: '只用雲端的資料…', value: 'cloud' }],
  });
  if (how !== 'cloud') return false;
  const sure = await ask({
    title: `刪除手機上的 ${n} 則紀錄？`,
    body: ['手機上的紀錄和照片會被雲端的資料取代，刪掉就找不回來。', h('p', { class: 'hint' }, '不確定的話，先到「我 → 備份與資料」匯出一份。')],
    actions: [{ label: '改成合併', value: false, kind: 'primary' }, { label: '刪除，只用雲端的', value: true, kind: 'danger' }],
  });
  return !!sure;
}

async function withBusy(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message); } finally { btn.disabled = false; }
}

// 剛填完名字生日：如果可以建立帳號，跳出一個大按鈕，按了直接跳 Face ID 存登入金鑰；略過就照常繼續
async function offerFaceIdSignup(next, { first = false } = {}) {
  let signup = { open: false, invite: false };
  if (cloudApi.passkeySupported()) { try { signup = await cloudApi.signupStatus(cloud.invite); } catch (e) { /* 離線就略過 */ } }
  if (!signup.open && !signup.invite) { next(); return; }
  const close = (go) => { $('#letter-dialog').close(); if (go) next(); };
  const btn = h('button', { type: 'button', class: 'btn primary' }, '用 Face ID 建立帳號');
  btn.addEventListener('click', () => withBusy(btn, async () => {
    const result = await cloudApi.register(state.profile.name, cloud.invite);
    cloud.invite = null;
    close(false);
    await afterLogin(result);
    next();
  }));
  $('#letter-body').replaceChildren(
    h('div', { class: 'sheet-top' }, h('h3', {}, signup.invite ? `💞 ${signup.inviter} 邀請你` : first ? '☁︎ 記下第一筆了！要備份到雲端嗎？' : '☁︎ 要開啟雲端同步嗎？')),
    h('p', {}, signup.invite ? '用 Face ID 建立帳號，就會和對方連結，也能換手機不怕遺失。' : '用 Face ID 建立帳號，紀錄和照片會備份到雲端，換手機、手機壞掉都不怕遺失。'),
    h('p', { class: 'hint' }, '按下去會跳出 Face ID，確認就好，不用密碼。也可以之後再到「我的 → 雲端與家人」開啟。'),
    h('div', { class: 'sheet-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => close(true) }, '之後再說'), h('span', { class: 'spacer' }), btn));
  if (!$('#letter-dialog').open) $('#letter-dialog').showModal();
}

function cloudLoginButton() {
  const btn = h('button', { type: 'button', class: 'btn' }, '用 Face ID 登入');
  btn.addEventListener('click', () => withBusy(btn, async () => afterLogin(await cloudApi.login())));
  return btn;
}

async function renderCloudSection() {
  const root = $('#cloud-section');
  if (!root || !state.profile) return;
  if (!cloudApi.passkeySupported()) {
    root.replaceChildren(h('p', { class: 'hint' }, '這個瀏覽器不支援 Face ID／Passkey 登入。請用 iPhone 的 Safari 或主畫面 App 開啟。'));
    return;
  }

  if (!cloud.me) {
    const items = [h('p', { class: 'hint' }, '登入後，紀錄和照片會同步到雲端，換手機、手機壞掉都不怕遺失，也能和另一半互看。')];
    let signup = { open: false, invite: false };
    try { signup = await cloudApi.signupStatus(cloud.invite); } catch (e) { items.push(h('p', { class: 'hint' }, `⚠︎ ${e.message}`)); }
    if (signup.open || signup.invite) {
      if (signup.invite) items.push(h('p', { class: 'invite-note' }, `💞 ${signup.inviter} 邀請你一起使用。建立帳號後會自動連結。`));
      const name = h('input', { value: state.profile.name, maxlength: '40', 'aria-label': '帳號名稱' });
      const btn = h('button', { type: 'button', class: 'btn primary' }, '用 Face ID 建立帳號');
      btn.addEventListener('click', () => withBusy(btn, async () => {
        const invited = !!cloud.invite;
        const result = await cloudApi.register(name.value.trim() || state.profile.name, cloud.invite);
        cloud.invite = null;
        await afterLogin(result);
        // 被邀請的人：接著選自己的樣子
        if (invited && !state.profile.look) {
          $('#settings-dialog').close();
          openLook();
        }
      }));
      items.push(h('label', {}, '帳號名稱', name), h('div', { class: 'row' }, btn, cloudLoginButton()));
    } else {
      items.push(h('div', { class: 'row' }, cloudLoginButton()));
      items.push(h('p', { class: 'hint' }, '要建立新帳號，需要已註冊的人傳邀請連結給你。'));
    }
    root.replaceChildren(...items);
    return;
  }

  const syncBtn = h('button', { type: 'button', class: 'btn' }, '立即同步');
  syncBtn.addEventListener('click', () => withBusy(syncBtn, runSync));
  const logoutBtn = h('button', { type: 'button', class: 'btn' }, '登出');
  logoutBtn.addEventListener('click', () => withBusy(logoutBtn, async () => {
    if (!(await ask({
      title: '登出雲端？',
      body: '登出後這支手機不會再同步，但手機上的資料會留著。',
      actions: [{ label: '先不要', value: false }, { label: '登出', value: true, kind: 'danger' }],
    }))) return;
    await cloudApi.logout();
    cloud.me = null;
    setCloudStatus('off', '');
    renderCloudSection();
  }));
  const items = [
    h('p', {}, `已登入：${cloud.me.user.name}`),
    h('p', { id: 'cloud-status', class: 'hint' }, cloudStatusText()),
    h('div', { class: 'row' }, syncBtn, logoutBtn),
    h('h4', { class: 'sub-h' }, '連結的家人'),
    h('p', { class: 'hint' }, '連結之後可以互看彼此「💞 分享」的紀錄、對照同一個年紀；對方捏好小人後，會出現在你的場景裡。'),
  ];

  const links = cloud.me.links;
  const personOptions = (selected) => [h('option', { value: '' }, '（還沒對應人物卡）'),
    ...state.people.filter((x) => x.kind === 'person').map((x) => h('option', { value: x.id, selected: x.id === selected ? true : null }, `${x.name}（${x.relation}）`))];
  for (const link of links) {
    const select = h('select', { 'aria-label': `${link.name} 對應的人物卡` }, ...personOptions(link.personId));
    select.addEventListener('change', () => withBusy(select, async () => {
      cloud.me = await cloudApi.bindPerson(link.id, select.value || null);
      renderCloudSection();
      loadCompanions();
    }));
    const view = h('button', { type: 'button', class: 'btn small' }, `看 ${link.name} 的人生`);
    view.addEventListener('click', () => { $('#settings-dialog').close(); openMembers(link.id); });
    const unlinkBtn = h('button', { type: 'button', class: 'btn small danger' }, '解除連結');
    unlinkBtn.addEventListener('click', () => withBusy(unlinkBtn, async () => {
      if (!(await ask({
        title: `和 ${link.name} 解除連結？`,
        body: '之後彼此都看不到分享的紀錄。',
        actions: [{ label: '先不要', value: false }, { label: '解除連結', value: true, kind: 'danger' }],
      }))) return;
      cloud.me = await cloudApi.unlink(link.id);
      cloud.views.delete(link.id);
      setCloudStatus(cloud.status, cloud.message);
      renderCloudSection();
      loadCompanions();
    }));
    items.push(h('div', { class: 'member-row' }, h('div', { class: 'member-name' }, `💞 ${link.name}`),
      h('label', { class: 'member-bind' }, '是我的', select), h('div', { class: 'row' }, view, unlinkBtn)));
  }

  if (links.length) {
    const titles = h('input', { type: 'checkbox' });
    titles.checked = state.profile.shareTitles !== false;
    titles.addEventListener('change', async () => {
      state.profile = { ...state.profile, shareTitles: titles.checked, updatedAt: new Date().toISOString() };
      await saveState();
    });
    const shared = state.moments.filter((m) => m.shared).length;
    items.push(
      h('p', { class: 'hint' }, `你分享了 ${shared} 則。記一筆時打開「💞 分享」，連結的人才看得到；沒分享的都是私人的。`),
      h('label', { class: 'switch' }, titles, h('span', {}, '讓連結的人看到我每一歲的一句話')),
    );
  }

  items.push(cloud.inviteLink ? inviteLinkBox() : (() => {
    const candidates = state.people.filter((x) => x.kind === 'person' && !links.some((l) => l.personId === x.id));
    const select = h('select', { 'aria-label': '邀請誰' }, h('option', { value: '' }, '邀請誰？（可以先選人物卡）'),
      ...candidates.map((x) => h('option', { value: x.id }, `${x.name}（${x.relation}）`)));
    const invite = h('button', { type: 'button', class: 'btn' }, '產生邀請連結');
    invite.addEventListener('click', () => withBusy(invite, () => makeInvite(select.value || null)));
    return h('div', { class: 'row' }, select, invite);
  })());
  root.replaceChildren(...items);
}

async function makeInvite(personId) {
  const { code } = await cloudApi.createInvite(personId);
  cloud.inviteLink = `${location.origin}${location.pathname}#invite=${code}`;
  cloud.invitePerson = personId ? personById(personId) : null;
  renderCloudSection();
  if (ui.person && $('#person-dialog').open) renderPersonDialog();
}

// 邀請連結：兩段式（iPhone 的分享選單要由點擊直接觸發）
function inviteLinkBox() {
  const who = cloud.invitePerson ? cloud.invitePerson.name : '對方';
  const link = h('input', { value: cloud.inviteLink, readonly: true, 'aria-label': '邀請連結' });
  const share = h('button', { type: 'button', class: 'btn primary' }, `傳給${who}`);
  share.addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'wowo', text: `${cloud.me.user.name} 邀請你一起用 wowo`, url: cloud.inviteLink });
      else { await navigator.clipboard.writeText(cloud.inviteLink); toast('已複製連結'); }
    } catch (e) { /* 取消分享 */ }
  });
  const done = h('button', { type: 'button', class: 'btn' }, '完成');
  done.addEventListener('click', () => { cloud.inviteLink = null; cloud.invitePerson = null; renderCloudSection(); if ($('#person-dialog').open) renderPersonDialog(); });
  return h('div', { class: 'invite-box' },
    h('p', { class: 'hint' }, `把連結傳給${who}（7 天內有效，只能用一次）。對方用 Face ID 建立帳號後就會自動連結${cloud.invitePerson ? `，並對上「${who}」這張人物卡` : ''}。`),
    link, h('div', { class: 'row' }, share, done));
}

// 收到邀請連結
async function handleInvite() {
  const m = location.hash.match(/^#invite=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  cloud.invite = m[1];
  if (cloud.me) {
    try {
      const { inviter } = await cloudApi.signupStatus(cloud.invite);
      if (!inviter) { toast('邀請連結已失效'); return; }
      if (!(await ask({
        title: `💞 ${inviter} 邀請你`,
        body: '連結之後，可以互看彼此「分享」的紀錄。沒分享的都是私人的。',
        actions: [{ label: '先不要', value: false }, { label: '連結', value: true, kind: 'primary' }],
      }))) return;
      cloud.me = await cloudApi.acceptInvite(cloud.invite);
      cloud.invite = null;
      setCloudStatus(cloud.status, cloud.message);
      toast(`💞 已和 ${inviter} 連結`);
      loadCompanions();
    } catch (e) { toast(e.message); }
  } else if (state.profile) {
    openSettings();
  } else {
    try {
      const { inviter } = await cloudApi.signupStatus(cloud.invite);
      if (inviter) $('#setup-invite').textContent = `💞 ${inviter} 邀請你一起使用。先填名字和生日，下一步用 Face ID 建立帳號。`;
    } catch (e) { /* 離線 */ }
  }
}

// ---------- 連結的家人 ----------
const linkFor = (personId) => (cloud.me && personId ? cloud.me.links.find((l) => l.personId === personId) : null) || null;

async function loadMemberViews() {
  if (!cloud.me) return;
  await Promise.all(cloud.me.links.map(async (l) => {
    try { cloud.views.set(l.id, (await cloudApi.memberView(l.id)).view); } catch (e) { /* 離線：沿用上次的 */ }
  }));
}

// 場景裡站在你旁邊的家人：要對方捏好小人才出現；伴侶優先，再來是一起記最多次的，最多 3 位
let lastCompanionsKey = '';
let lastCompanions = [];
async function loadCompanions() {
  if (!scene) return;
  if (cloud.me) await loadMemberViews();
  if (state.profile) renderCyFamily();
  const links = cloud.me ? cloud.me.links : [];
  const count = (personId) => state.moments.filter((m) => m.people.includes(personId)).length;
  const rank = (l) => {
    const p = personById(l.personId);
    return (p && p.relation === '伴侶' ? 1000 : 0) + (p ? count(p.id) : 0);
  };
  const list = links
    .map((l) => ({ l, view: cloud.views.get(l.id) }))
    .filter(({ view }) => memberReady(view))
    .sort((a, b) => rank(b.l) - rank(a.l))
    .slice(0, 3)
    .map(({ view }) => {
      const age = ageAt(view.profile.birthday, todayStr());
      return { avatar: view.profile.avatar, age, stageKey: lifeStageFor(view.profile.birthday, age).key };
    });
  const key = JSON.stringify(list);
  if (key !== lastCompanionsKey) { lastCompanionsKey = key; lastCompanions = list; }
  scene.update({ companions: lastCompanions });
}

async function openMembers(userId = null) {
  if (!cloud.me || !cloud.me.links.length) return;
  cloud.memberId = userId || cloud.memberId || cloud.me.links[0].id;
  if (!cloud.me.links.some((l) => l.id === cloud.memberId)) cloud.memberId = cloud.me.links[0].id;
  const dlg = $('#partner-dialog');
  $('#partner-body').replaceChildren(h('p', { class: 'hint' }, '讀取中…'));
  if (!dlg.open) dlg.showModal();
  await loadMemberViews();
  renderMembers();
  loadCompanions();
}

// 家人選好樣子了沒（新的房間小人，或舊版捏過的像素小人）
const memberReady = (view) => !!(view && view.profile && view.profile.birthday && (view.profile.look || (view.profile.avatar && view.profile.avatar.v === 2)));
function memberAvatarHtml(view) {
  if (!memberReady(view)) return '<span class="person-initial">?</span>';
  if (view.profile.look) return lookHtml(view.profile.look, 'smile', 'look look-head').outerHTML;
  const age = ageAt(view.profile.birthday, todayStr());
  return avatarSvg(normalizeAvatar(view.profile.avatar), age, lifeStageFor(view.profile.birthday, age).key);
}

function renderMembers() {
  const links = cloud.me.links;
  const link = links.find((l) => l.id === cloud.memberId);
  const view = cloud.views.get(link.id);
  const name = link.name;

  // 全家福：所有連結的人排成一排，人多就左右滑
  $('#partner-lineup').replaceChildren(...links.map((l) => {
    const v = cloud.views.get(l.id);
    const pic = h('div', { class: 'lineup-avatar' });
    pic.innerHTML = memberAvatarHtml(v);
    return h('button', { type: 'button', class: `lineup-item${l.id === link.id ? ' on' : ''}`, onclick: () => { cloud.memberId = l.id; renderMembers(); } },
      pic, h('span', {}, l.name));
  }));
  $('#partner-name').textContent = name;
  $('#partner-tabs').replaceChildren(...[['timeline', `${name} 的紀錄`], ['compare', '同一個年紀']].map(([key, label]) =>
    h('button', { type: 'button', class: `chip${cloud.partnerTab === key ? ' on' : ''}`, onclick: () => { cloud.partnerTab = key; renderMembers(); } }, label)));
  const body = $('#partner-body');
  if (!view || !view.profile || !view.profile.birthday) {
    $('#partner-sub').textContent = '還沒同步資料';
    $('#partner-avatar').innerHTML = memberAvatarHtml(null);
    body.replaceChildren(h('p', { class: 'hint' }, `${name} 還沒有同步資料。`));
    return;
  }
  const pAge = ageAt(view.profile.birthday, todayStr());
  $('#partner-avatar').innerHTML = memberAvatarHtml(view);
  const bound = personById(link.personId);
  $('#partner-sub').textContent = `${bound ? `${bound.relation} · ` : ''}${pAge} 歲 · 分享了 ${view.moments.length} 則${memberReady(view) ? '' : ' · 還沒選樣子'}`;

  const pByAge = new Map();
  for (const m of view.moments) {
    const a = ageAt(view.profile.birthday, m.date);
    if (!pByAge.has(a)) pByAge.set(a, []);
    pByAge.get(a).push(m);
  }
  const pTitle = (a) => (view.years[String(a)] || {}).title || '';
  const photoLoader = (id, kind) => cloudApi.memberPhotoUrl(link.id, id, kind);

  const momentEl = (m) => {
    const d = parseDate(m.date);
    return h('li', { class: `moment${m.starred ? ' starred' : ''}` },
      h('span', { class: 'moment-date' }, m.approx ? '這一年' : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`),
      h('div', { class: 'moment-main' },
        h('span', { class: 'moment-text' }, momentFace(m), m.text),
        (m.tags || []).length ? h('span', { class: 'moment-tags' }, m.tags.map((t) => h('span', { class: 'tag' }, t))) : null,
        (m.photoIds || []).length ? h('div', { class: 'moment-photos' }, m.photoIds.map((id, i) => {
          const img = h('img', { alt: '' });
          photoLoader(id, 'thumb').then((url) => { if (url) img.src = url; });
          return h('button', { type: 'button', class: 'thumb', onclick: () => openLightbox(m.photoIds, i, photoLoader) }, img);
        })) : null));
  };

  if (cloud.partnerTab === 'timeline') {
    const ages = [...new Set([...pByAge.keys(), ...Object.keys(view.years).map(Number)])].sort((a, b) => b - a);
    if (!ages.length) { body.replaceChildren(h('p', { class: 'hint' }, `${name} 還沒有分享任何紀錄。`)); return; }
    body.replaceChildren(...ages.map((a) => h('section', { class: 'age-group' },
      h('div', { class: 'age-head static' }, h('span', { class: 'age-label' }, `${a} 歲`)),
      pTitle(a) ? h('div', { class: 'year-title-btn' }, `「${pTitle(a)}」`) : null,
      h('ul', { class: 'moments' }, (pByAge.get(a) || []).sort((x, y) => y.date.localeCompare(x.date)).map(momentEl)))));
    return;
  }

  // 同一個年紀：左邊是我，右邊是對方
  const myByAge = groupByAge(state.moments);
  const maxAge = Math.max(ageAt(state.profile.birthday, todayStr()), pAge);
  const rows = [];
  for (let a = 0; a <= maxAge; a++) {
    const mine = myByAge.get(a) || [];
    const theirs = pByAge.get(a) || [];
    if (!mine.length && !theirs.length && !yearTitle(a) && !pTitle(a)) continue;
    const col = (title, list, who, notYet) => h('div', { class: 'compare-col' },
      h('div', { class: 'compare-who' }, who),
      title ? h('div', { class: 'compare-title' }, `「${title}」`) : null,
      list.length ? h('ul', { class: 'compare-list' }, list.map((m) => h('li', {}, m.starred ? '★ ' : '', m.text)))
        : (title ? null : h('div', { class: 'muted' }, notYet ? '還沒到這個年紀' : '—')));
    rows.push(h('section', { class: 'compare-row' },
      h('div', { class: 'age-label' }, `${a} 歲`),
      h('div', { class: 'compare-cols' },
        col(yearTitle(a), mine, '我', a > ageAt(state.profile.birthday, todayStr())),
        col(pTitle(a), theirs, name, a > pAge))));
  }
  body.replaceChildren(...(rows.length ? rows : [h('p', { class: 'hint' }, '還沒有可以對照的年紀。')]));
}

// 生日改成年／月／日三個下拉選單：iPhone 的日期面板選完月份會跳回月曆、要一路往回翻年份，選單比較快
// 真正的值還是放在原本的 <input type=date>（藏起來），表單和測試都照舊用它
function enhanceBirthday(input) {
  const thisYear = new Date().getFullYear();
  const opt = (v, label) => h('option', { value: v }, label);
  const year = h('select', { 'aria-label': '出生年' }, opt('', '年'), ...Array.from({ length: thisYear - 1919 }, (_, i) => opt(String(thisYear - i), `${thisYear - i} 年`)));
  const month = h('select', { 'aria-label': '出生月' }, opt('', '月'), ...Array.from({ length: 12 }, (_, i) => opt(String(i + 1), `${i + 1} 月`)));
  const day = h('select', { 'aria-label': '出生日' }, opt('', '日'));
  const fillDays = () => {
    const n = year.value && month.value ? new Date(Number(year.value), Number(month.value), 0).getDate() : 31;
    const keep = day.value;
    day.replaceChildren(opt('', '日'), ...Array.from({ length: n }, (_, i) => opt(String(i + 1), `${i + 1} 日`)));
    day.value = Number(keep) <= n ? keep : '';
  };
  const toInput = () => {
    fillDays();
    input.value = year.value && month.value && day.value ? `${year.value}-${pad(Number(month.value))}-${pad(Number(day.value))}` : '';
  };
  const fromInput = () => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.value);
    year.value = m ? String(Number(m[1])) : '';
    month.value = m ? String(Number(m[2])) : '';
    fillDays();
    day.value = m ? String(Number(m[3])) : '';
  };
  [year, month, day].forEach((s) => s.addEventListener('change', toInput));
  input.addEventListener('input', fromInput);
  input.addEventListener('change', fromInput);
  input.syncPicker = fromInput;
  fillDays();
  input.after(h('div', { class: 'bday' }, year, month, day));
  fromInput();
}

// 註冊頁的小巧思：點 logo 跳一下說句話、名字填進視窗標題、生日算出在地球上幾天、標題列的鈕點了視窗抖一下（logo 說話）
const LOGO_SAYS = ['嗨～歡迎光臨！', '要來我家玩嗎？', '我等你好久了 ♥', '先寫名字吧！', '噓，這裡只有你知道'];
const STAR_SIGNS = [[120, '摩羯座'], [219, '水瓶座'], [320, '雙魚座'], [420, '白羊座'], [521, '金牛座'], [621, '雙子座'], [722, '巨蟹座'], [823, '獅子座'], [923, '處女座'], [1023, '天秤座'], [1122, '天蠍座'], [1222, '射手座'], [1232, '摩羯座']];
function setupDelight() {
  const form = $('#setup-form');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sayTimer = 0, sayN = 0;
  const say = (text) => {
    const logo = $('#setup-logo'), bubble = $('#setup-logo-say');
    if (!calm) { logo.classList.remove('hop'); void logo.offsetWidth; logo.classList.add('hop'); }
    bubble.textContent = text;
    bubble.classList.add('on');
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => bubble.classList.remove('on'), 2200);
  };
  $('#setup-logo').addEventListener('click', () => say(LOGO_SAYS[sayN++ % LOGO_SAYS.length]));
  $('#setup-logo').addEventListener('animationend', (e) => { if (e.animationName === 'setup-hop') e.currentTarget.classList.remove('hop'); });
  const win = $('.setup-win');
  const WIN_SAYS = { min: '縮小了就找不到我了啦～', max: '已經是最大的小窩了！', close: '先別走嘛，填完名字就好 ♥' };
  win.querySelectorAll('[data-win]').forEach((b) => b.addEventListener('click', () => {
    win.classList.remove('shake'); void win.offsetWidth; win.classList.add('shake');
    say(WIN_SAYS[b.dataset.win]);
  }));
  win.addEventListener('animationend', (e) => { if (e.animationName === 'setup-shake') win.classList.remove('shake'); });
  form.name.addEventListener('input', () => {
    const name = form.name.value.trim();
    $('#setup-win-title').textContent = name ? `建立 ${name} 的小窩` : '建立我的小窩';
  });
  const days = $('#setup-days');
  const showDays = () => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(form.birthday.value);
    const n = m ? Math.round((new Date(todayStr()) - new Date(form.birthday.value)) / 86400000) : -1;
    days.hidden = n < 0;
    if (n < 0) return;
    const md = Number(m[2]) * 100 + Number(m[3]);
    const sign = STAR_SIGNS.find(([end]) => md < end)[1];
    days.replaceChildren(`${sign}的你，已經在地球上 `, h('b', {}, n.toLocaleString()), ' 天了。');
  };
  form.addEventListener('change', showDays);
  form.birthday.addEventListener('input', showDays);
}

// ---------- 綁定事件 ----------
function bind() {
  document.querySelectorAll('input.bday-native').forEach(enhanceBirthday);
  setupDelight();
  $('#setup-form').birthday.max = todayStr();
  $('#setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await saveProfile(e.target)) {
      requestPersist();
      render();
      // 被邀請的人：先用 Face ID 建帳號（才能和對方連結）；其他人直接選樣子，雲端等記完第一筆再問
      if (cloud.invite) offerFaceIdSignup(() => openLook({ onboarding: true }));
      else openLook({ onboarding: true });
    }
  });

  $('#add-btn').addEventListener('click', () => openMoment());
  $('#moment-form').addEventListener('submit', saveMoment);
  $('#moment-form').date.addEventListener('input', updateAgeHint);
  $('#moment-form').approx.addEventListener('change', renderOptBar);
  $('#moment-delete').addEventListener('click', deleteMoment);
  $('#moment-story').addEventListener('click', () => {
    if (momentDirty()) { toast('先儲存修改，再寫成故事'); return; }
    const id = ui.editingId;
    ui.momentSnapshot = null;
    $('#moment-dialog').close();
    openStory(id);
  });
  $('#moment-story-remove').addEventListener('click', removeStory);
  $('#moment-menu-btn').addEventListener('click', () => {
    const list = $('#moment-menu-list');
    list.hidden = !list.hidden;
    $('#moment-menu-btn').setAttribute('aria-expanded', String(!list.hidden));
  });
  document.querySelectorAll('#moment-form button[data-sec]').forEach((btn) => btn.addEventListener('click', () => toggleSec(btn.dataset.sec)));
  $('#star-toggle').addEventListener('click', () => { const box = $('#moment-form').starred; box.checked = !box.checked; renderOptBar(); });
  $('#event-open').addEventListener('click', () => openEventPicker('moment'));
  // 鍵盤上方的工具列：收起鍵盤，捲到心情或「更多」
  const reveal = (el) => { document.activeElement && document.activeElement.blur(); setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); };
  $('#tb-mood').addEventListener('click', () => reveal($('#emo-field')));
  $('#tb-tags').addEventListener('click', () => reveal($('#tag-field')));
  $('#tb-more').addEventListener('click', () => { ui.openSecs.add('more'); renderOptBar(); reveal($('#more-toggle')); });
  $('#moment-form').shared.addEventListener('change', renderOptBar);
  $('#moment-form').text.addEventListener('input', () => { renderOptBar(); renderTagPicker(); });
  $('#moment-form').feel.addEventListener('input', renderTagPicker);
  // 首頁的入口：點一下就打開「記一筆」；📷 直接選照片
  $('#joy-all').addEventListener('click', () => openJoyList());
  $('#joy-dialog').addEventListener('close', () => renderJoyRow());
  $('#event-search').addEventListener('input', renderEventPicker);
  $('#photo-input').addEventListener('change', (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (files.length) addPhotos(files);
  });
  // 取消時把還沒存的照片網址釋放掉
  $('#moment-dialog').addEventListener('close', () => {
    ui.photos.forEach((p) => { if (!p.existing && !p.saved) URL.revokeObjectURL(p.url); });
    ui.photos = [];
    if ($('#recall-dialog').open) renderRecall();
  });

  $('#recall-btn').addEventListener('click', openRecall);
  $('#replay-btn').addEventListener('click', openReplay);
  $('#garden-btn').addEventListener('click', () => openGarden());
  $('#moment-form').feel.addEventListener('input', () => { if (!ui.emoManual) renderEmoPicker(); });
  $('#moment-form').text.addEventListener('input', () => { if (!ui.emoManual) renderEmoPicker(); });
  $('#replay-toggle').addEventListener('click', toggleReplay);
  $('#replay-dialog').addEventListener('close', () => { if (replay) { clearTimeout(replay.timer); replay.scene.stop(); } });
  $('#recall-save').addEventListener('click', recallSave);
  $('#recall-prev').addEventListener('click', () => recallGo(-1));
  $('#recall-next').addEventListener('click', () => recallGo(1));
  $('#recall-more').addEventListener('click', recallMore);
  $('#recall-next-q').addEventListener('click', () => { ui.recall.q++; renderRecall(); });
  // 「先到這裡」、點遮罩或返回鍵關閉時也會自動存
  $('#recall-dialog').addEventListener('close', async () => {
    if (ui.recallDone) return;
    const added = await commitRecall();
    if (added) toast('記下來了');
    render();
  });

  $('#year-form').addEventListener('submit', saveYear);
  $('#year-add').addEventListener('click', addMomentInYear);
  $('#year-card').addEventListener('click', () => { $('#year-dialog').close(); showYearCard(ui.yearAge); });
  $('#year-view').addEventListener('click', viewYear);
  $('#year-recall').addEventListener('click', () => { const age = ui.yearAge; $('#year-dialog').close(); openRecallAt(age, 0); });

  $('#lightbox').addEventListener('click', (e) => { if (!e.target.closest('.lb-nav')) $('#lightbox').close(); });
  $('#lb-prev').addEventListener('click', () => stepLightbox(-1));
  $('#lb-next').addEventListener('click', () => stepLightbox(1));
  $('#lightbox').addEventListener('close', () => {
    if (ui.lightbox.url) URL.revokeObjectURL(ui.lightbox.url);
    ui.lightbox.url = null;
    $('#lightbox-img').removeAttribute('src');
  });
  let touchX = null;
  $('#lightbox').addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $('#lightbox').addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) { e.preventDefault(); stepLightbox(dx < 0 ? 1 : -1); }
  });

  $('#sync-btn').addEventListener('click', () => openSettings('cloud'));
  $('#partner-btn').addEventListener('click', () => openMembers());
  document.querySelectorAll('#settings-dialog [data-back]').forEach((btn) => btn.addEventListener('click', () => $('#settings-dialog').close()));
  $('#add-person-btn').addEventListener('click', () => openPersonEditor(null, { kind: 'person' }));
  $('#add-pet-btn').addEventListener('click', () => openPersonEditor(null, { kind: 'pet' }));
  $('#me-add-person').addEventListener('click', () => openPersonEditor(null, { kind: 'person' }));
  $('#me-add-pet').addEventListener('click', () => openPersonEditor(null, { kind: 'pet' }));
  $('#recall-event').addEventListener('click', () => openEventPicker('recall'));
  $('#cy-bgm').addEventListener('click', () => toggleMusic(!musicPref()));
  $('#cy-bgm-next').addEventListener('click', nextTrack);
  $('#room-zoom').addEventListener('click', () => setRoomFull(!document.documentElement.classList.contains('room-full')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.documentElement.classList.contains('room-full') && !document.querySelector('dialog[open]')) setRoomFull(false); });
  $('#pref-music').addEventListener('change', (e) => toggleMusic(e.target.checked));
  $('#pref-ai-story').addEventListener('change', async (e) => {
    if (e.target.checked && !cloud.me) {
      e.target.checked = false;
      toast('要先登入雲端同步才能用');
      return;
    }
    state.prefs = { ...state.prefs, aiStory: e.target.checked };
    await saveState();
  });
  $('#pref-world-sad').addEventListener('change', async (e) => {
    state.prefs = { ...state.prefs, worldSad: e.target.checked };
    await saveState();
    renderTimeline();
  });
  $('#pref-achievements').addEventListener('change', async (e) => {
    state.prefs = { ...state.prefs, showAchievements: e.target.checked };
    await saveState();
    render();
  });
  // 底部分頁
  document.querySelectorAll('#tabbar [data-tab-btn]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tabBtn)));
  $('#me-card').addEventListener('click', () => openLook());
  $('#me-look-btn').addEventListener('click', () => openLook());
  $('#me-profile').addEventListener('click', () => openSettings('profile'));
  $('#cy-card').addEventListener('click', () => openLook());
  $('#cy-status').addEventListener('click', (e) => { e.stopPropagation(); toggleStatusMenu(); });
  document.addEventListener('click', (e) => { if (!$('#cy-status-menu').hidden && !e.target.closest('.cy-status-box')) toggleStatusMenu(false); });
  $('.cy-msg-box').addEventListener('click', (e) => { if (e.target.id !== 'cy-msg-input') editMsg(); });
  $('#cy-news-all').addEventListener('click', () => showTab('memories'));
  $('#cy-family-more').addEventListener('click', () => (cloud.me && cloud.me.links.length ? openMembers() : openSettings('cloud')));
  document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
    const page = b.dataset.open;
    if (page === 'letters') openLetters(); else if (page === 'joys') openJoyList(); else openSettings(page);
  }));
  $('#look-save').addEventListener('click', saveLook);
  // 第一次選樣子：選好或關掉都進房間
  $('#look-dialog').addEventListener('close', () => { const first = ui.look && ui.look.onboarding; ui.look = null; if (first) welcomeHome(); });
  $('#info-dialog').addEventListener('close', () => { const f = ui.infoClosed; ui.infoClosed = null; if (f) f(); });
  $('#avatar-save').addEventListener('click', saveAvatar);
  $('#avatar-random').addEventListener('click', () => setAvatar({ ...randomAvatar(), v: 2 }));
  $('#avatar-undo').addEventListener('click', () => {
    if (!ui.avatar.history.length) return;
    ui.avatar.draft = ui.avatar.history.pop();
    renderAvatarEditor();
    drawAvatarPreview();
  });
  $('#avatar-dialog').addEventListener('close', () => {
    clearInterval(ui.avatar && ui.avatar.timer);
    if (ui.onboarding) { ui.onboarding = false; welcomeHome(); }
  });
  $('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await saveProfile(e.target)) { toast('已儲存'); render(); $('#settings-dialog').close(); }
  });
  $('#export-btn').addEventListener('click', onExportClick);
  $('#banner-export').addEventListener('click', () => { openSettings('backup'); onExportClick(); });
  $('#settings-dialog').addEventListener('close', () => { resetExportButton(); });
  $('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) importData(file);
  });
  $('#reset-btn').addEventListener('click', async () => {
    if (!(await ask({
      title: '清除這支手機上的所有資料？',
      body: [`${state.moments.length} 則紀錄和所有照片都會消失，無法復原。`, h('p', { class: 'hint' }, `${cloud.me ? '雲端的資料不受影響，會一併登出。' : '建議先匯出備份。'}確定的話，請在下面輸入「清除」。`)],
      typed: '清除',
      actions: [{ label: '先不要', value: false, kind: 'primary' }, { label: '全部清除', value: true, kind: 'danger' }],
    }))) return;
    if (cloud.me) await cloudApi.logout().catch(() => {});
    cloud.me = null;
    setCloudStatus('off', '');
    await db.clearAll();
    try {
      localStorage.removeItem(LEGACY_KEY);
      localStorage.removeItem(`${LEGACY_KEY}.migrated`);
    } catch (e) { /* 忽略 */ }
    [...thumbUrls.keys()].forEach(forgetThumb);
    state = emptyState();
    $('#settings-dialog').close();
    render();
  });

  $('#search').addEventListener('input', (e) => { ui.query = e.target.value.trim(); renderTimeline(); });

  // 有沒存的內容時，關閉前先問一下（取消、點遮罩、返回鍵都一樣）
  const discard = (title) => ask({ title, actions: [{ label: '繼續編輯', value: false, kind: 'primary' }, { label: '放棄', value: true, kind: 'danger' }] });
  const guards = {
    'moment-dialog': async () => !momentDirty() || !!(await discard('這筆還沒存，要放棄嗎？')),
    'avatar-dialog': async () => !(ui.avatar && ui.avatar.history.length) || !!(await discard('小人的修改還沒存，要放棄嗎？')),
  };
  const tryClose = async (dlg) => { const g = guards[dlg.id]; if (!g || await g()) dlg.close(); };
  $('#ask-dialog').addEventListener('close', () => { const r = askResolve; askResolve = null; if (r) r(null); });
  // 返回鍵／往右滑：關掉最上層的抽屜，而不是離開 App。
  // 只要有抽屜開著，就在瀏覽紀錄上多墊「剛好一筆」；全部關掉時再退掉（skipPop：自己退的那一下不要又去關抽屜）
  let histPushed = false;
  let skipPop = 0;
  const openDialogs = () => [...document.querySelectorAll('dialog[open]')];
  const syncHistory = () => {
    const any = openDialogs().length > 0;
    if (any && !histPushed) { histPushed = true; history.pushState({ wowoDialog: true }, ''); }
    else if (!any && histPushed) {
      histPushed = false;
      if (history.state && history.state.wowoDialog) { skipPop++; history.back(); }
    }
  };
  new MutationObserver(syncHistory).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  window.addEventListener('popstate', async () => {
    if (skipPop) { skipPop--; return; }
    histPushed = false; // 墊的那一筆被返回鍵用掉了
    const dlg = openDialogs().pop();
    if (dlg) await tryClose(dlg); // 有草稿的照樣先問；選「繼續編輯」就留著
    syncHistory(); // 還有抽屜開著（或選了繼續編輯）：再墊一筆
  });
  document.querySelectorAll('[data-close]').forEach((btn) =>
    btn.addEventListener('click', () => tryClose(btn.closest('dialog'))));
  // 點對話框外的遮罩也可以關閉
  document.querySelectorAll('dialog.sheet').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target !== dlg) return;
      // 只有點在抽屜外面（遮罩）才關；點到抽屜自己的留白不算
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) tryClose(dlg);
    });
    // Esc／返回鍵：有守門的抽屜先擋下來，問過再關
    dlg.addEventListener('cancel', (e) => { if (guards[dlg.id]) { e.preventDefault(); tryClose(dlg); } });
  });
  // 迷你小窩風：每個抽屜上面加一條藍色視窗標題列（標題取裡面第一個標題，原本的標題藏起來）
  document.querySelectorAll('dialog.sheet:not(.composer-page)').forEach((dlg) => {
    const title = h('span', { class: 'win-title' });
    const bar = h('header', { class: 'win-bar' }, title,
      h('button', { type: 'button', class: 'win-x', 'aria-label': '關閉', onclick: () => tryClose(dlg) }, '×'));
    dlg.prepend(bar);
    dlg.classList.add('win');
    const sync = () => {
      const heads = [...dlg.querySelectorAll(':scope > h3, :scope > form > h3, .sheet-top > h3, .settings-page > h3')]
        .filter((el) => !el.closest('[hidden]'));
      dlg.querySelectorAll('.win-dup').forEach((el) => { if (el !== heads[0]) el.classList.remove('win-dup'); });
      const text = heads[0] ? heads[0].textContent.replace(/^[^\p{L}\p{N}]+/u, '').trim() : '';
      if (heads[0] && !heads[0].classList.contains('win-dup')) heads[0].classList.add('win-dup');
      const next = text || dlg.dataset.win || 'wowo';
      if (title.textContent !== next) title.textContent = next;
    };
    let queued = false;
    new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; sync(); }); } }).observe(dlg, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'open'] });
    sync();
  });
  // 鍵盤打開時，把底部固定列墊高到鍵盤上方
  if (window.visualViewport) {
    const onViewport = () => {
      const vv = window.visualViewport;
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', `${Math.round(kb)}px`);
      // 寫字的全螢幕畫面直接貼齊「鍵盤上方看得到的範圍」
      document.documentElement.style.setProperty('--vv-h', `${Math.round(vv.height)}px`);
      document.documentElement.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
    };
    window.visualViewport.addEventListener('resize', onViewport);
    window.visualViewport.addEventListener('scroll', onViewport);
    onViewport();
  }

  // 跨日或從背景回來時更新年齡與進度
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.profile) { render(); loadWeather(); scheduleSync(300); }
  });
  window.addEventListener('online', () => scheduleSync(300));
}

// 目前是哪一版：service worker 的快取名稱 lifelog-0.0.50（主.次.修），回報問題時好對照
async function appVersion() {
  const keys = window.caches ? await caches.keys() : [];
  const nums = (v) => v.split('.').map(Number);
  const newer = (a, b) => { const x = nums(a), y = nums(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
  return keys.map((k) => (k.match(/^lifelog-(\d+\.\d+\.\d+)$/) || [])[1]).filter(Boolean).reduce((a, b) => (!a || newer(b, a) ? b : a), '');
}

// 「我的」最下面顯示版本
async function showVersion() {
  try {
    const v = await appVersion();
    $('#app-version').textContent = `wowo ${v}`.trim();
  } catch (e) { /* 拿不到就不顯示 */ }
}

async function init() {
  initJoys({ getState: () => state, save: () => saveState(), refresh: () => render(), ask, addDiary: addJoyDiary, h, toast, todayStr, toDateStr, newId, $ });
  showVersion();
  applyTheme();
  initMusic({ onFailed: musicFailed, onTrackChange: renderMusicBtn });
  renderMusicBtn();
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);
  bind();
  try {
    state = await loadState();
  } catch (e) {
    document.body.prepend(h('p', { class: 'fatal' }, '無法開啟資料庫。請確認不是在無痕模式，或重新開啟 App。'));
    return;
  }
  scene = new Room($('#scene'), {
    diary: () => openMoment(),
    calendar: () => openGarden(),
    plant: () => openGarden(),
    tv: (done) => openTv(done),
    letter: () => { const ready = readyLetters(); if (ready.length) openLetter(ready[0].id); else openLetterEditor(ageAt(state.profile.birthday, todayStr()) + 1); },
    shelf: () => shelfMemory(),
    photos: () => wallPhotos(),
  });
  ui.weather = weather.weatherEnabled() ? weather.cachedWeather() : null;
  render();
  scene.start();
  // 小人會想你：好幾天沒記錄時，打開就先打個招呼
  const gap = daysSinceLastRecord();
  if (gap != null && gap >= 3) setTimeout(() => scene.say(gap >= 14 ? '好久不見！好想你～' : `${gap} 天沒見了，好想你！`), 1200);
  else if (readyLetters().length) setTimeout(() => scene.say('有一封信在等我打開 ✉️'), 1200);
  cleanupOrphanPhotos().catch(() => {});
  loadWeather();
  setInterval(() => { if (!document.hidden) loadWeather(); }, 10 * 60 * 1000);
  try {
    cloud.me = await cloudApi.fetchMe();
  } catch (e) { /* 離線：照樣可以用，之後再同步 */ }
  setCloudStatus(cloud.me ? 'ok' : 'off', '');
  await handleInvite();
  if (cloud.me) { runSync(); loadCompanions(); }
  // 下拉更新後重新載入的：說一聲
  try { if (sessionStorage.getItem('lifey.refreshed')) { sessionStorage.removeItem('lifey.refreshed'); toast(cloud.me ? '已更新到最新版本，紀錄也同步了' : '已更新到最新版本'); } } catch (e) { /* 無痕模式 */ }
}

init();

async function renderAppVersion() {
  const el = $('#settings-version');
  if (!el || !('caches' in window)) return;
  const v = await appVersion();
  el.textContent = v ? `App 版本：${v} · 在主畫面往下拉就會更新到最新版本` : '';
}

