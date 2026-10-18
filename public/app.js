import * as db from './db.js';
import { createZip, readZip } from './zip.js';
import { processPhoto, makeThumb } from './photos.js';
import { STATS, statsFor, countsToward, ACHIEVEMENTS, unlockedNow } from './game.js';
import {
  SKINS, HAIRS, OUTFIT_COLORS, GENDERS, HAIR_STYLES, EYES, BEARDS, OUTFITS,
  normalizeAvatar, randomAvatar, composeAvatar, drawAvatar, avatarSvg,
} from './avatar.js';
import { Scene, propsForTags, festivalOf } from './scene.js';
import * as weather from './weather.js';
import * as cloudApi from './cloud.js';
import { EVENT_CATS, LIFE_EVENTS, eventById, RELATIONS } from './events.js';
import { PET_TYPES, PET_ICONS, PET_COLORS, petSvg } from './pets.js';

// ---------- 常數 ----------
const LEGACY_KEY = 'lifelog.v1'; // 階段 1 存在 localStorage 的資料
const DATA_VERSION = 2;
const MOODS = ['😞', '🙁', '😐', '🙂', '😄']; // 對應 1–5
const MOOD_COLORS = ['#56608f', '#4f86a6', '#3fa89a', '#7fbf6a', '#e6b84f'];
const DEFAULT_TAGS = ['家人', '朋友', '愛情', '工作', '學習', '健康', '運動', '旅行', '興趣', '里程碑'];
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
  people: new Set(), event: null, eventCat: 'school', eventFor: 'moment', person: null,
};
const thumbUrls = new Map(); // photoId -> Promise<objectURL|null>
const cloud = { me: null, status: 'off', message: '', lastSync: null, timer: null, running: false, again: false, invite: null, inviter: null, inviteLink: null, invitePerson: null, partnerTab: 'timeline', memberId: null, views: new Map() };
let scene = null;

function emptyState() {
  return { version: DATA_VERSION, profile: null, moments: [], years: {}, deleted: {}, people: [], prefs: {}, lastExportAt: null, achievements: {} };
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
const personLabel = (p) => `${personIcon(p)} ${p.name}`;
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
  if (view && view.profile && view.profile.avatar && view.profile.avatar.v === 2) return memberAvatarHtml(view);
  return `<span class="person-initial">${(p.name || '?').slice(0, 1)}</span>`;
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
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
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
  const hasProfile = !!state.profile;
  $('#setup').hidden = hasProfile;
  $('#app').hidden = !hasProfile;
  if (!hasProfile) return;
  renderHeader();
  renderNow();
  renderIdCard();
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
  $('#age-num').textContent = age;
  $('#age-sub').textContent = `${now.getFullYear()}年 · ${age} 歲的第 ${passed} 天 · 距離 ${age + 1} 歲還有 ${total - passed} 天`;
  $('#age-progress').style.width = `${Math.min(100, (passed / total) * 100)}%`;
}

function renderIdCard() {
  const { name, birthday } = state.profile;
  const today = todayStr();
  const ages = new Set(state.moments.map((m) => ageAt(birthday, m.date)));
  const stars = state.moments.filter((m) => m.starred).length;
  const photos = state.moments.reduce((n, m) => n + m.photoIds.length, 0);
  $('#id-year').textContent = new Date().getFullYear();
  const myAge = ageAt(birthday, today);
  $('#id-avatar').innerHTML = avatarSvg(myAvatar(), myAge, lifeStage(myAge).key);
  $('#id-name').textContent = name;
  $('#id-birth').textContent = fmtDate(parseDate(birthday));
  $('#id-count').textContent = `${state.moments.length} 則 · 照片 ${photos} 張`;
  $('#id-stars').textContent = `${stars} 則`;
  $('#id-ages').textContent = `${ages.size} / ${ageAt(birthday, today) + 1} 個年歲`;

  // 護照式機器可讀區（MRZ），純裝飾
  const latin = name.toUpperCase().replace(/[^A-Z ]/g, '').trim().replace(/\s+/g, '<') || 'LIFE<LOG';
  const line1 = `L<LOG${latin}`.padEnd(30, '<').slice(0, 30);
  const line2 = `${birthday.replace(/-/g, '').slice(2)}<${String(state.moments.length).padStart(4, '0')}<${String(stars).padStart(3, '0')}`.padEnd(30, '<');
  $('#id-mrz').textContent = `${line1}\n${line2}`;
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
      props: propsForTags(new Set(list.flatMap((m) => m.tags))), weather: ui.weather, messages: sceneMessages, pets: scenePets(),
    });
  }
  const w = ui.weather;
  $('#now-caption').textContent = `${age} 歲 · ${stage.key === 'adult' ? '出社會' : `大約是${stage.label}`} · 今年記了 ${list.length} 則`
    + (w ? ` · ${w.icon} ${w.temp}° ${w.label}` : '');
  $('#avatar-banner').hidden = avatarSaved();
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
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 2).map((p) => ({ type: p.petType, color: p.petColor || 0, name: p.name }));
  const key = JSON.stringify(pets);
  if (key !== lastPetsKey) { lastPetsKey = key; lastPets = pets; } // 沒變就沿用同一個陣列，場景才不會重來
  return lastPets;
}

// 點小人時冒出來的話：節日、天氣、時間、今年的重心
function sceneMessages() {
  const { birthday } = state.profile;
  const now = new Date();
  const hour = now.getHours();
  const age = ageAt(birthday, todayStr());
  const out = ['今天有什麼值得記住的嗎？', '要記一筆嗎？✏️', `你已經記了 ${state.moments.length} 則回憶了`];
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
  const quiet = state.people.filter((p) => p.kind === 'person' && last.has(p.id) && daysBetween(parseDate(last.get(p.id)), new Date()) > 60);
  if (quiet.length) out.push(`好久沒記到 ${quiet[Math.floor(Math.random() * quiet.length)].name} 了，最近好嗎？`);
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
  if (scene) scene.celebrate({ star: true });
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
  const cells = [];

  for (let age = 0; age < MAP_YEARS; age++) {
    const list = byAge.get(age) || [];
    const moods = list.map((m) => m.mood).filter(Boolean);
    const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
    const stars = list.filter((m) => m.starred).length;
    const title = yearTitle(age);
    const big = list.map((m) => eventById(m.event)).find((e) => e && e.big) || list.map((m) => eventById(m.event)).find(Boolean);
    if (avg && (!happiest || avg > happiest.avg)) happiest = { age, avg };

    const cls = ['cell',
      age > current && 'future', age === current && 'now',
      (list.length || title) && 'filled', stars && 'starred'].filter(Boolean).join(' ');
    const style = avg ? `--c:${MOOD_COLORS[Math.round(avg) - 1]};--c-text:#10131a` : null;

    if (age > current) {
      cells.push(h('span', { class: cls, 'aria-hidden': 'true' }, age));
    } else {
      const label = `${age} 歲${big ? ` ${big.label}` : ''}${title ? `：${title}` : ''} · ${list.length} 則${stars ? ` · ☆${stars}` : ''}`;
      cells.push(h('button', { type: 'button', class: `${cls}${big ? ' has-event' : ''}`, style, title: label, 'aria-label': label, onclick: () => openYear(age) },
        big ? h('span', { class: 'cell-event' }, big.icon) : age));
    }
  }

  $('#life-map').replaceChildren(...cells);
  const resume = state.recall && state.recall.age > 0 && state.recall.age <= current;
  $('#recall-btn').textContent = resume ? `🕰 繼續回憶（${state.recall.age} 歲）` : '🕰 回憶模式';
  const recorded = new Set([...byAge.keys(), ...Object.keys(state.years).filter((k) => state.years[k].title).map(Number)]).size;
  $('#map-summary').textContent = `已記錄 ${recorded} / ${current + 1} 個年歲${happiest ? ` · 最幸福的一歲：${happiest.age} 歲` : ''}`;
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
      h('p', { class: 'muted' }, '也可以按「🕰 回憶模式」，從 0 歲開始補上以前的回憶。')));
    return;
  }

  const items = state.moments.filter(matchesFilter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  if (items.length === 0) {
    root.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'muted' }, '沒有符合條件的紀錄。')));
    return;
  }

  root.replaceChildren(...[...groupByAge(items)].map(([age, list]) => {
    const [start, end] = ageRange(birthday, age);
    const stars = list.filter((m) => m.starred).length;
    const collapsed = ui.collapsed.has(age);
    const title = yearTitle(age);
    return h('section', { class: `age-group${collapsed ? ' collapsed' : ''}`, id: `age-${age}` },
      h('button', {
        class: 'age-head', type: 'button', 'aria-expanded': String(!collapsed),
        onclick: () => { collapsed ? ui.collapsed.delete(age) : ui.collapsed.add(age); renderTimeline(); },
      },
      h('span', { class: 'age-label' }, `${age} 歲`),
      h('span', { class: 'age-range' }, `${fmtDate(start)} – ${fmtDate(end)}`),
      h('span', { class: 'age-count' }, `${list.length} 則${stars ? ` · ☆${stars}` : ''}`)),
      h('button', { class: `year-title-btn${title ? '' : ' empty'}`, type: 'button', onclick: () => openYear(age) },
        title ? `「${title}」` : '＋ 這一歲的一句話'),
      collapsed ? null : h('ul', { class: 'moments' }, list.map(renderMoment)));
  }));
  hydrateThumbs(root);
}

function renderMoment(m) {
  const d = parseDate(m.date);
  return h('li', { class: `moment${m.starred ? ' starred' : ''}` },
    h('span', { class: 'moment-date' }, m.approx ? '這一年' : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`),
    h('div', { class: 'moment-main' },
      h('button', { class: 'moment-body', type: 'button', onclick: () => openMoment(m.id) },
        h('span', { class: 'moment-text' }, eventById(m.event) ? h('span', { class: 'event-icon' }, `${eventById(m.event).icon} `) : null,
          m.mood ? `${MOODS[m.mood - 1]} ` : '', m.text, m.shared ? h('span', { class: 'shared-mark', title: '已分享' }, ' 💞') : null),
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
  ui.tags = new Set(m ? m.tags : []);
  ui.people = new Set(m ? m.people : []);
  ui.event = m ? m.event : preset.event || null;
  ui.photos = m ? await Promise.all(m.photoIds.map(async (pid) => ({ id: pid, existing: true, url: await thumbUrl(pid) }))) : [];
  $('#moment-title').textContent = m ? '編輯時刻' : '記一筆';
  form.date.value = m ? m.date : preset.date || todayStr();
  form.date.min = state.profile.birthday;
  form.date.max = todayStr();
  form.text.value = m ? m.text : '';
  form.starred.checked = m ? !!m.starred : false;
  form.approx.checked = m ? m.approx : !!preset.approx;
  form.shared.checked = m ? m.shared : false;
  const links = cloud.me ? cloud.me.links : [];
  $('#share-row').hidden = !links.length;
  if (links.length) {
    const names = links.map((l) => l.name);
    $('#share-label').textContent = `💞 分享給 ${names.length > 3 ? `${names.slice(0, 2).join('、')} 等 ${names.length} 人` : names.join('、')}`;
  }
  $('#moment-delete').hidden = !m;
  renderMoodPicker();
  renderTagPicker();
  renderPhotoPicker();
  renderPeoplePicker();
  renderEventBadge();
  updateAgeHint();
  $('#moment-dialog').showModal();
  if (!m && preset.event) applyEvent(eventById(preset.event));
  else if (!m) form.text.focus();
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
  label.textContent = ask === 'pet' || ask === 'petGone' ? '是哪一隻？' : ask === 'child' ? '寶寶是誰？' : ask === 'people' ? '和誰？' : '和誰（選填）';
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
  renderPeoplePicker();
  if (ev.ask === 'pet' && !state.people.some((p) => p.kind === 'pet' && !petGoneMoment(p))) {
    openPersonEditor(null, { kind: 'pet', onSaved: (person) => { ui.people.add(person.id); renderPeoplePicker(); } });
  } else if (ev.ask === 'child' && !ui.people.size) {
    openPersonEditor(null, { kind: 'person', relation: '子女', onSaved: (person) => { ui.people.add(person.id); renderPeoplePicker(); } });
  }
}

function openEventPicker(forWhat = 'moment') {
  ui.eventFor = forWhat;
  renderEventPicker();
  $('#event-dialog').showModal();
}

function renderEventPicker() {
  $('#event-cats').replaceChildren(...EVENT_CATS.map(([key, label]) => h('button', {
    type: 'button', class: `chip${ui.eventCat === key ? ' on' : ''}`, onclick: () => { ui.eventCat = key; renderEventPicker(); },
  }, label)));
  $('#event-grid').replaceChildren(...LIFE_EVENTS.filter((e) => e.cat === ui.eventCat).map((e) => h('button', {
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

function renderPhotoPicker() {
  const items = ui.photos.map((p, i) => h('div', { class: 'photo-item' },
    p.url ? h('img', { src: p.url, alt: '' }) : h('span', { class: 'photo-missing' }, '?'),
    h('button', {
      type: 'button', class: 'photo-remove', 'aria-label': '移除照片',
      onclick: () => removePendingPhoto(i),
    }, '×')));
  if (ui.busy) items.push(h('div', { class: 'photo-item busy' }, '處理中…'));
  else if (ui.photos.length < MAX_PHOTOS) items.push(h('label', { class: 'photo-add', for: 'photo-input' }, '＋', h('span', {}, '加照片')));
  $('#photo-picker').replaceChildren(...items);
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
  if (!isValidDateStr(date) || !text) return;
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
      date, text, mood: ui.mood, tags: [...ui.tags], photoIds: ui.photos.map((p) => p.id), starred: form.starred.checked, approx: form.approx.checked,
      shared: form.shared.checked, people: [...ui.people].filter(personById), event: ui.event, updatedAt: now,
    };
    if (prev) Object.assign(prev, fields);
    else state.moments.push({ id: momentId, createdAt: now, ...fields });
    if (!(await saveState())) return;

    newPhotos.forEach((p) => { p.saved = true; thumbUrls.set(p.id, Promise.resolve(p.url)); });
    if (removed.length) {
      await db.deletePhotos(removed).catch(() => {});
      removed.forEach(forgetThumb);
    }
    ui.collapsed.delete(ageAt(state.profile.birthday, date));
    $('#moment-dialog').close();
    const ev = eventById(fields.event);
    // 難過的大事不慶祝，用溫和的語氣
    toast(prev ? '已更新' : ev && ev.sad ? '已經好好記下來了 🤍' : '記下來了');
    render();
    if (!prev && scene && !(ev && ev.sad)) scene.celebrate({ star: fields.starred });
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteMoment() {
  if (!ui.editingId || !confirm('確定要刪除這則紀錄嗎？照片也會一起刪除。')) return;
  const m = state.moments.find((x) => x.id === ui.editingId);
  state.moments = state.moments.filter((x) => x.id !== ui.editingId);
  state.deleted[m.id] = new Date().toISOString(); // 讓其他裝置同步時也刪掉
  if (!(await saveState())) return;
  await db.deletePhotos(m.photoIds).catch(() => {});
  m.photoIds.forEach(forgetThumb);
  $('#moment-dialog').close();
  toast('已刪除');
  render();
}

// ---------- 人物卡 ----------
// 人物卡上的帳號連結狀態：已連結／邀請加入
function personLinkBox(p) {
  const link = linkFor(p.id);
  if (link) {
    const view = cloud.views.get(link.id);
    const ready = view && view.profile && view.profile.avatar && view.profile.avatar.v === 2;
    return h('div', { class: 'invite-box' },
      h('p', {}, `💞 已連結 ${link.name} 的帳號`),
      h('p', { class: 'hint' }, ready ? '對方捏好小人了，會一起出現在你的場景裡。' : '對方捏好自己的小人後，就會出現在你的場景裡。'),
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
    const sub = [p.kind === 'pet' ? (PET_TYPES.find(([k]) => k === p.petType) || [, '寵物'])[1] : p.relation || '人物'];
    if (p.birthday && !gone) sub.push(`${ageAt(p.birthday, todayStr())} 歲`);
    const facts = [`一起記了 ${list.length} 則`];
    if (first) facts.push(`第一次是你 ${ageAt(birthday, first.date)} 歲的時候`);
    if (gone) facts.push(`🌈 你 ${ageAt(birthday, gone.date)} 歲時去了彩虹橋`);
    body.replaceChildren(
      h('div', { class: 'person-head' },
        (() => { const a = h('div', { class: `person-avatar${p.kind === 'pet' ? ' pet' : ''}` }); a.innerHTML = personAvatarHtml(p); return a; })(),
        h('div', {}, h('h3', {}, p.name), h('div', { class: 'hint' }, sub.join(' · ')))),
      h('p', { class: 'person-facts' }, facts.join(' · ')),
      p.kind === 'person' ? personLinkBox(p) : null,
      list.length ? h('ul', { class: 'person-moments' }, list.map((m) => h('li', {},
        h('button', { type: 'button', onclick: () => { $('#person-dialog').close(); openMoment(m.id); } },
          h('span', { class: 'moment-date' }, `${ageAt(birthday, m.date)} 歲`),
          h('span', {}, eventById(m.event) ? `${eventById(m.event).icon} ` : '', m.text))))) : h('p', { class: 'hint' }, '還沒有一起的紀錄。記一筆時在「和誰」點選就會出現在這裡。'),
      h('div', { class: 'sheet-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => { ui.filter = `person:${p.id}`; $('#person-dialog').close(); $('#settings-dialog').close(); renderFilters(); renderTimeline(); document.getElementById('timeline').scrollIntoView({ behavior: 'smooth' }); } }, '在時間軸篩選'),
        h('span', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn', onclick: () => openPersonEditor(p.id) }, '編輯'),
        h('button', { type: 'button', class: 'btn primary', onclick: () => $('#person-dialog').close() }, '關閉')));
    return;
  }

  const d = ui.person.draft;
  const isPet = d.kind === 'pet';
  const name = h('input', { value: d.name, maxlength: '20', placeholder: isPet ? '寵物的名字' : '名字或暱稱', 'aria-label': '名字' });
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
    const preview = h('div', { class: 'person-avatar pet' });
    preview.innerHTML = petSvg(d.petType, d.petColor);
    fields.push(
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, '種類'), h('div', { class: 'chips' }, PET_TYPES.map(([k, label]) => h('button', {
        type: 'button', class: `chip${d.petType === k ? ' on' : ''}`, onclick: () => { d.petType = k; d.petColor = 0; renderPersonDialog(); },
      }, `${PET_ICONS[k]} ${label}`)))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, '毛色'), h('div', { class: 'row' }, preview, h('div', { class: 'swatches' },
        PET_COLORS[d.petType].map(([c], i) => h('button', {
          type: 'button', class: `swatch-btn${d.petColor === i ? ' on' : ''}`, style: `--c:${c}`, 'aria-label': `毛色 ${i + 1}`,
          onclick: () => { d.petColor = i; renderPersonDialog(); },
        }))))),
    );
    const inScene = h('input', { type: 'checkbox' });
    inScene.checked = d.inScene !== false;
    inScene.addEventListener('change', () => { d.inScene = inScene.checked; });
    fields.push(h('label', { class: 'switch' }, inScene, h('span', {}, '在場景裡陪著我')));
  }

  const save = h('button', { type: 'button', class: 'btn primary' }, '儲存');
  save.addEventListener('click', () => savePerson());
  body.replaceChildren(
    h('h3', {}, id ? `編輯 ${personById(id).name}` : isPet ? '新增寵物' : '新增人物'),
    kindChips,
    h('label', {}, '名字', name),
    ...fields,
    h('label', {}, isPet ? '生日或到家的日子（選填）' : '生日（選填）', birthday),
    h('div', { class: 'sheet-actions' },
      id ? h('button', { type: 'button', class: 'btn danger', onclick: () => deletePerson(id) }, '刪除') : null,
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn', onclick: () => (id ? openPerson(id) : $('#person-dialog').close()) }, '取消'),
      save));
  if (!id) name.focus();
}

async function savePerson() {
  const { id, draft, onSaved } = ui.person;
  const name = (draft.name || '').trim();
  if (!name) { toast('請輸入名字'); return; }
  if (draft.kind === 'person' && !draft.relation) { toast('請選擇關係'); return; }
  const now = new Date().toISOString();
  const clean = {
    kind: draft.kind, name, birthday: isValidDateStr(draft.birthday) ? draft.birthday : '', updatedAt: now,
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
  if (!p || !confirm(`確定要刪除「${p.name}」嗎？紀錄會留著，只是不再標記這個人。`)) return;
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
  root.replaceChildren(
    h('p', { class: 'hint' }, '家人、朋友、寵物。記一筆時可以點選「和誰」，寵物會在場景裡陪著你。'),
    list.length ? h('div', { class: 'chips' }, list.map((p) => h('button', { type: 'button', class: 'chip', onclick: () => openPerson(p.id) }, personLabel(p)))) : null,
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn', onclick: () => openPersonEditor(null, { kind: 'person' }) }, '＋ 新增人物'),
      h('button', { type: 'button', class: 'btn', onclick: () => openPersonEditor(null, { kind: 'pet' }) }, '＋ 新增寵物')));
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
  $('#year-view').hidden = list.length === 0;
  renderStatBars($('#year-stats'), statsFor(list), yearFocus(age));
  $('#year-dialog').showModal();
}

async function saveYear(e) {
  e.preventDefault();
  const title = e.target.summary.value.trim();
  const key = String(ui.yearAge);
  setYearField(key, 'title', title);
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
  const age = ui.yearAge;
  $('#year-dialog').close();
  ui.filter = 'all';
  ui.query = '';
  $('#search').value = '';
  ui.collapsed.delete(age);
  renderFilters();
  renderTimeline();
  document.getElementById(`age-${age}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  if (early && !confirm(`有 ${early} 則紀錄早於這個生日，仍要儲存嗎？`)) return false;
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
  btn.classList.remove('primary');
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
    ui.preparedExport = { exportedAt, file: new File([zip], `lifey-${todayStr()}.zip`, { type: 'application/zip' }) };
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
  if (!data || ![1, 2].includes(data.version) || !Array.isArray(data.moments)) return '不是人生紀錄的備份檔';
  if (data.profile && (!data.profile.name || !isValidDateStr(data.profile.birthday))) return '個人資料格式不正確';
  for (const m of data.moments) {
    if (!m || typeof m.id !== 'string' || !isValidDateStr(m.date) || typeof m.text !== 'string') return '紀錄格式不正確';
    if (m.photoIds != null && !Array.isArray(m.photoIds)) return '紀錄格式不正確';
    if (m.people != null && !Array.isArray(m.people)) return '紀錄格式不正確';
  }
  if (data.people != null && !Array.isArray(data.people)) return '人物格式不正確';
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
  const replace = state.moments.length === 0 || confirm(
    `備份檔有 ${incoming.moments.length} 則紀錄。\n\n按「確定」：整個取代目前資料\n按「取消」：合併（同一則保留較新的版本）`);

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
  const referenced = new Set(state.moments.flatMap((m) => m.photoIds));
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
const AVATAR_TABS = [
  ['body', '身體', [{ key: 'gender', label: '性別', choices: GENDERS, note: '只影響體型和學生制服，其他都能自由搭配' }, { key: 'skin', label: '膚色', colors: SKINS }]],
  ['hair', '頭髮', [{ key: 'hairStyle', label: '髮型', choices: HAIR_STYLES }, { key: 'hair', label: '髮色', colors: HAIRS, note: '50 歲以後會慢慢變淡，65 歲變白髮' }]],
  ['face', '臉', [{ key: 'eyes', label: '眼睛', choices: EYES }, { key: 'lashes', label: '睫毛', toggle: true }, { key: 'blush', label: '腮紅', toggle: true },
    { key: 'freckles', label: '雀斑', toggle: true }, { key: 'beard', label: '鬍子', choices: BEARDS, note: '18 歲以後才會出現' }]],
  ['outfit', '衣服', [{ key: 'outfit', label: '款式', choices: OUTFITS }, { key: 'outfitColor', label: '顏色', colors: OUTFIT_COLORS },
    { key: 'uniform', label: '國小到高中穿制服', toggle: true }]],
  ['acc', '配件', [{ key: 'glasses', label: '眼鏡', toggle: true }, { key: 'hat', label: '帽子', toggle: true },
    { key: 'headphones', label: '耳機', toggle: true }, { key: 'hairclip', label: '髮夾', toggle: true }]],
];

function openAvatarEditor() {
  const age = ageAt(state.profile.birthday, todayStr());
  ui.avatar = { draft: { ...myAvatar(), v: 2 }, tab: 'body', age };
  const slider = $('#avatar-age');
  slider.max = String(Math.max(90, age));
  slider.value = String(age);
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
  if (canvas.width !== 22 * scale) { canvas.width = 22 * scale; canvas.height = 24 * scale; }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, 22, 24);
  ctx.fillStyle = '#2a3040'; ctx.fillRect(0, 22, 22, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(6, 22, 10, 1);
  const t = performance.now();
  const blink = t % 3600 < 160;
  const { age } = ui.avatar;
  const sprite = composeAvatar(ui.avatar.draft, age, lifeStage(age).key, { blink });
  drawAvatar(ctx, sprite, 3, 2, { breathe: Math.floor(t / 800) % 2 === 1 });
}

function renderAvatarEditor() {
  const { draft, tab, age } = ui.avatar;
  const stage = lifeStage(age);
  $('#avatar-age-label').textContent = `${age} 歲 · ${stage.key === 'adult' ? '出社會' : stage.label}`;
  $('#avatar-tabs').replaceChildren(...AVATAR_TABS.map(([key, label]) => h('button', {
    type: 'button', class: `chip${tab === key ? ' on' : ''}`, onclick: () => { ui.avatar.tab = key; renderAvatarEditor(); },
  }, label)));
  const set = (patch) => { Object.assign(ui.avatar.draft, patch); renderAvatarEditor(); drawAvatarPreview(); };
  const groups = AVATAR_TABS.find(([key]) => key === tab)[2];
  $('#avatar-options').replaceChildren(...groups.map((g) => {
    let control;
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
  const toggle = h('button', { type: 'button', class: `btn${on ? '' : ' primary'}` }, on ? '關閉真實天氣' : '開啟真實天氣');
  toggle.addEventListener('click', async () => {
    toggle.disabled = true;
    try {
      if (on) { weather.disableWeather(); ui.weather = null; render(); }
      else { ui.weather = await weather.enableWeather(); toast(ui.weather ? `${ui.weather.icon} ${ui.weather.temp}° ${ui.weather.label}` : '暫時抓不到天氣，稍後會自動再試'); render(); }
    } catch (e) { toast(e.message); }
    toggle.disabled = false;
    renderWeatherSection();
  });
  const items = [
    h('p', { class: 'hint' }, on
      ? (w ? `目前：${w.icon} ${w.temp}° ${w.label}（每 30 分鐘更新）` : '正在取得天氣…')
      : '開啟後，場景會跟著你那裡的真實天氣下雨、起霧、轉陰，日出日落也會更準。'),
    h('div', { class: 'row' }, toggle),
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

function openSettings() {
  const form = $('#profile-form');
  form.name.value = state.profile.name;
  form.birthday.value = state.profile.birthday;
  form.birthday.max = todayStr();
  resetExportButton();
  $('#settings-avatar').innerHTML = avatarSvg(myAvatar(), ageAt(state.profile.birthday, todayStr()), lifeStage(ageAt(state.profile.birthday, todayStr())).key);
  renderWeatherSection();
  renderCloudSection();
  renderPeopleSection();
  $('#pref-achievements').checked = !!state.prefs.showAchievements;
  renderSettingsStatus();
  renderStorageStatus();
  $('#settings-dialog').showModal();
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
    && !confirm(`這支手機上的資料（${local.name}）和雲端帳號（${remote.profile.name}）不一樣。\n\n按「確定」：合併兩邊\n按「取消」：只用雲端的資料（手機上的會被取代，建議先匯出備份）`)) {
    state = normalize(remote);
    await saveState({ fromSync: true });
  } else if (remote && !state.profile) {
    state = normalize(remote);
    await saveState({ fromSync: true });
  }
  setCloudStatus('ok', '');
  render();
  renderCloudSection();
  await runSync();
  renderCloudSection();
}

async function withBusy(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (e) { toast(e.message); } finally { btn.disabled = false; }
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
        // 被邀請的人：接著捏小人，才會出現在對方的場景裡
        if (invited && !avatarSaved()) {
          $('#settings-dialog').close();
          openAvatarEditor();
          toast('捏好你的小人，就會出現在對方的場景裡', 4000);
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
    if (!confirm('登出後這支手機不會再同步，但手機上的資料會留著。確定登出？')) return;
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
      if (!confirm(`確定要和 ${link.name} 解除連結嗎？之後彼此都看不到分享的紀錄。`)) return;
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
      if (navigator.share) await navigator.share({ title: '人生紀錄', text: `${cloud.me.user.name} 邀請你一起用人生紀錄`, url: cloud.inviteLink });
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
      if (!confirm(`要和 ${inviter} 連結嗎？之後可以互看彼此分享的紀錄。`)) return;
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
  const links = cloud.me ? cloud.me.links : [];
  const count = (personId) => state.moments.filter((m) => m.people.includes(personId)).length;
  const rank = (l) => {
    const p = personById(l.personId);
    return (p && p.relation === '伴侶' ? 1000 : 0) + (p ? count(p.id) : 0);
  };
  const list = links
    .map((l) => ({ l, view: cloud.views.get(l.id) }))
    .filter(({ view }) => view && view.profile && view.profile.birthday && view.profile.avatar && view.profile.avatar.v === 2)
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

function memberAvatarHtml(view) {
  if (!view || !view.profile || !view.profile.birthday || !view.profile.avatar || view.profile.avatar.v !== 2) return '<span class="person-initial">?</span>';
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
  $('#partner-sub').textContent = `${bound ? `${bound.relation} · ` : ''}${pAge} 歲 · 分享了 ${view.moments.length} 則${view.profile.avatar && view.profile.avatar.v === 2 ? '' : ' · 還沒捏小人'}`;

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
        h('span', { class: 'moment-text' }, m.mood ? `${MOODS[m.mood - 1]} ` : '', m.text),
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

// ---------- 綁定事件 ----------
function bind() {
  $('#setup-form').birthday.max = todayStr();
  $('#setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await saveProfile(e.target)) {
      requestPersist();
      render();
      if (cloud.invite) openSettings(); // 被邀請的人：接著建立帳號
      else openAvatarEditor(); // 第一次使用：接著捏自己的小人
    }
  });

  $('#add-btn').addEventListener('click', () => openMoment());
  $('#moment-form').addEventListener('submit', saveMoment);
  $('#moment-form').date.addEventListener('input', updateAgeHint);
  $('#moment-delete').addEventListener('click', deleteMoment);
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
  $('#year-view').addEventListener('click', viewYear);

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

  $('#open-settings').addEventListener('click', openSettings);
  $('#sync-btn').addEventListener('click', openSettings);
  $('#partner-btn').addEventListener('click', () => openMembers());
  $('#setup-login').addEventListener('click', (e) => withBusy(e.target, async () => afterLogin(await cloudApi.login())));
  $('#avatar-banner-btn').addEventListener('click', openAvatarEditor);
  $('#event-open').addEventListener('click', () => openEventPicker('moment'));
  $('#recall-event').addEventListener('click', () => openEventPicker('recall'));
  $('#pref-achievements').addEventListener('change', async (e) => {
    state.prefs = { ...state.prefs, showAchievements: e.target.checked };
    await saveState();
    render();
  });
  $('#id-avatar').addEventListener('click', openAvatarEditor);
  $('#settings-avatar-btn').addEventListener('click', () => { $('#settings-dialog').close(); openAvatarEditor(); });
  $('#avatar-save').addEventListener('click', saveAvatar);
  $('#avatar-random').addEventListener('click', () => {
    ui.avatar.draft = { ...randomAvatar(), v: 2 };
    renderAvatarEditor();
    drawAvatarPreview();
  });
  $('#avatar-age').addEventListener('input', (e) => { ui.avatar.age = Number(e.target.value); renderAvatarEditor(); drawAvatarPreview(); });
  $('#avatar-dialog').addEventListener('close', () => { clearInterval(ui.avatar && ui.avatar.timer); });
  $('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await saveProfile(e.target)) { toast('已儲存'); render(); }
  });
  $('#export-btn').addEventListener('click', onExportClick);
  $('#banner-export').addEventListener('click', () => { openSettings(); onExportClick(); });
  $('#settings-dialog').addEventListener('close', resetExportButton);
  $('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) importData(file);
  });
  $('#reset-btn').addEventListener('click', async () => {
    if (!confirm(`確定要清除這支手機上的所有資料（包含照片）嗎？${cloud.me ? '雲端的資料不受影響，會一併登出。' : '建議先匯出備份。'}`)) return;
    if (!confirm('真的要清除嗎？這個動作無法復原。')) return;
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

  document.querySelectorAll('[data-close]').forEach((btn) =>
    btn.addEventListener('click', () => btn.closest('dialog').close()));
  // 點對話框外的遮罩也可以關閉
  document.querySelectorAll('dialog.sheet').forEach((dlg) =>
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }));

  // 跨日或從背景回來時更新年齡與進度
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.profile) { render(); loadWeather(); scheduleSync(300); }
  });
  window.addEventListener('online', () => scheduleSync(300));
}

async function init() {
  bind();
  try {
    state = await loadState();
  } catch (e) {
    document.body.prepend(h('p', { class: 'fatal' }, '無法開啟資料庫。請確認不是在無痕模式，或重新開啟 App。'));
    return;
  }
  scene = new Scene($('#scene-canvas'), $('#scene-bubble'));
  ui.weather = weather.weatherEnabled() ? weather.cachedWeather() : null;
  render();
  scene.start();
  cleanupOrphanPhotos().catch(() => {});
  loadWeather();
  setInterval(() => { if (!document.hidden) loadWeather(); }, 10 * 60 * 1000);
  if (!cloudApi.passkeySupported()) $('#setup-login').hidden = true;
  try {
    cloud.me = await cloudApi.fetchMe();
  } catch (e) { /* 離線：照樣可以用，之後再同步 */ }
  setCloudStatus(cloud.me ? 'ok' : 'off', '');
  await handleInvite();
  if (cloud.me) { runSync(); loadCompanions(); }
}

init();

// ---------- 下拉重新整理 ----------
// 主畫面 App 沒有瀏覽器的重新整理按鈕，而且開啟時會先顯示手機裡存的版本。
// 下拉時直接向伺服器檢查新版，有就裝好、立刻換上。
const PTR_TRIGGER = 70; // 拉超過這個距離（px）放開才會更新
const PTR_MAX = 110;

// 開著 App 時，背景可能已經裝好新版（但畫面還是舊的）；記下來，下拉時直接重新載入
let updatedSinceLoad = false;
if ('serviceWorker' in navigator) {
  const bootController = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (bootController) updatedSinceLoad = true; // 第一次安裝時的接管不算更新
  });
}

// 等新版生效；新版可能在 update() 還沒結束前就已經裝好生效，所以也比對生效中的版本有沒有換
function waitForNewVersion(reg, oldActive, ms) {
  return new Promise((resolve) => {
    if (reg.active !== oldActive) { resolve(true); return; }
    const timer = setTimeout(() => resolve(reg.active !== oldActive), ms);
    navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(true); }, { once: true });
    const worker = reg.installing || reg.waiting;
    if (worker) {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') { clearTimeout(timer); resolve(true); }
        if (worker.state === 'redundant') { clearTimeout(timer); resolve(false); }
      });
    }
  });
}

async function refreshApp() {
  setPtr(PTR_TRIGGER, 'loading', '檢查新版本…');
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (updatedSinceLoad) {
      setPtr(PTR_TRIGGER, 'loading', '更新完成，重新載入…');
      location.reload();
      return;
    }
    if (reg) {
      const oldActive = reg.active;
      await reg.update();
      if (reg.installing || reg.waiting || reg.active !== oldActive) {
        setPtr(PTR_TRIGGER, 'loading', '下載新版本…');
        if (await waitForNewVersion(reg, oldActive, 15000)) {
          setPtr(PTR_TRIGGER, 'loading', '更新完成，重新載入…');
          location.reload();
          return;
        }
      }
    }
    if (cloud.me) {
      setPtr(PTR_TRIGGER, 'loading', '同步最新紀錄…');
      await runSync();
    }
    render();
    toast(cloud.me ? `已經是最新版本${cloud.status === 'error' ? '（同步失敗，稍後會自動重試）' : '，紀錄也同步好了'}` : '已經是最新版本');
  } catch (e) {
    toast('連不上網路，稍後再試');
  }
  setPtr(0);
}

function setPtr(dist, mode = '', text = '下拉重新整理') {
  const el = $('#ptr');
  el.style.transform = `translateY(${dist - 60}px)`;
  el.className = `ptr${dist > 0 ? ' show' : ''}${mode ? ` ${mode}` : ''}`;
  $('#ptr-text').textContent = text;
  $('#ptr-icon').textContent = mode === 'loading' ? '⟳' : '↓';
  document.body.classList.toggle('ptr-pulling', dist > 0 && mode !== 'loading');
}

function bindPullToRefresh() {
  let startY = null;
  let dist = 0;
  let busy = false;
  const canPull = () => !busy && window.scrollY <= 0 && !document.querySelector('dialog[open]');

  window.addEventListener('touchstart', (e) => {
    startY = e.touches.length === 1 && canPull() ? e.touches[0].clientY : null;
    dist = 0;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || window.scrollY > 0) { if (dist) setPtr(0); startY = null; dist = 0; return; }
    dist = Math.min(PTR_MAX, dy * 0.5); // 阻尼：手指拉 2px，指示器走 1px
    setPtr(dist, dist >= PTR_TRIGGER ? 'ready' : '', dist >= PTR_TRIGGER ? '放開以更新' : '下拉重新整理');
  }, { passive: true });

  window.addEventListener('touchend', async () => {
    if (startY == null) return;
    startY = null;
    if (dist < PTR_TRIGGER) { setPtr(0); return; }
    busy = true;
    await refreshApp();
    busy = false;
  });
}

async function renderAppVersion() {
  const el = $('#app-version');
  if (!el || !('caches' in window)) return;
  const name = (await caches.keys()).find((k) => k.startsWith('lifelog-'));
  el.textContent = name ? `App 版本：${name.replace('lifelog-', '')} · 在主畫面下拉可以檢查新版本` : '';
}

bindPullToRefresh();
$('#open-settings').addEventListener('click', renderAppVersion);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
