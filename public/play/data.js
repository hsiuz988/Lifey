// 試玩版讀寫正式 App 的資料（同一個 IndexedDB）；沒有資料時用示範內容
import * as db from '../db.js';
import { detectEmotion, emotionByKey } from '../garden.js';
import { eventById } from '../events.js';

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayStr = () => toDateStr(new Date());
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function ageAt(birthday, date) {
  const [by, bm, bd] = birthday.split('-').map(Number);
  const [y, m, d] = date.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}
const birthdayAt = (birthday, age) => { const b = parseDate(birthday); return new Date(b.getFullYear() + age, b.getMonth(), b.getDate()); };

let state = null;
export async function load() {
  try { state = await db.getMeta('state'); } catch { state = null; }
  return state;
}
export const hasProfile = () => !!(state && state.profile && state.profile.birthday);
export const birthday = () => (hasProfile() ? state.profile.birthday : '1995-03-02');

// 上方：幾歲・這一歲的第幾天
export function ageLine() {
  const bd = birthday(), today = todayStr(), age = ageAt(bd, today);
  const day = Math.round((parseDate(today) - birthdayAt(bd, age)) / 86400000) + 1;
  return `${age} 歲 · 第 ${day} 天`;
}

// 今天已經記了什麼
export function todayMoments() {
  if (!state) return [];
  const t = todayStr();
  return (state.moments || []).filter((m) => m.date === t && !(state.deleted || {})[m.id]);
}

// 這個月每天的心情（同一天取最後一筆）
export function monthMoods(year, month) {
  const out = {};
  if (!state) return out;
  const prefix = `${year}-${pad(month)}-`;
  for (const m of state.moments || []) {
    if (!m.date.startsWith(prefix) || !m.emo) continue;
    const e = emotionByKey(m.emo); if (e) out[Number(m.date.slice(8))] = e.icon;
  }
  return out;
}

// 那年今日：以前同一天的紀錄，難過的大事和安靜的年紀不出現
export function onThisDay() {
  if (!state) return null;
  const t = todayStr(), md = t.slice(5);
  const quiet = (age) => !!((state.years || {})[String(age)] || {}).quiet;
  const list = (state.moments || []).filter((m) => m.date.slice(5) === md && m.date < t && m.text
    && !(eventById(m.event) || {}).sad && !quiet(ageAt(birthday(), m.date)));
  if (!list.length) return null;
  const m = list[Math.floor(Math.random() * list.length)];
  return { years: Number(t.slice(0, 4)) - Number(m.date.slice(0, 4)), text: m.text };
}

// 記一筆：跟正式 App 一樣的欄位，回傳判斷出的情緒
export async function addMoment(text) {
  if (!hasProfile()) return detectEmotion('', text, 3);
  const now = new Date().toISOString();
  const emo = detectEmotion('', text, 3);
  state.moments.push({ id: newId(), createdAt: now, date: todayStr(), text, feel: '', mood: (emotionByKey(emo) || {}).mood || 3, emo, emoAuto: true,
    tags: [], photoIds: [], starred: false, approx: false, shared: false, people: [], event: null, updatedAt: now });
  await db.putMeta('state', state);
  return emo;
}

// 寫給下一歲的自己：到下一個生日才能打開
export async function addLetter(text) {
  const bd = birthday(), age = ageAt(bd, todayStr()) + 1, openOn = toDateStr(birthdayAt(bd, age));
  if (hasProfile()) {
    const now = new Date().toISOString();
    state.letters = state.letters || [];
    state.letters.push({ id: newId(), toAge: age, writtenOn: todayStr(), openOn, text, createdAt: now, updatedAt: now, openedAt: null });
    await db.putMeta('state', state);
  }
  return { age, openOn };
}

// 出生那年的世界大事（尊重「不顯示難過的新聞」設定）
export async function birthYearNews() {
  const y = Number(birthday().slice(0, 4));
  let items = [];
  try { items = await (await fetch(`../world/${Math.floor(y / 10) * 10}s.json`)).json(); } catch { /* 離線又沒快取 */ }
  const noSad = state && state.prefs && state.prefs.worldSad === false;
  return { year: y, items: items.filter((e) => e.y === y && !(noSad && e.sad)) };
}
