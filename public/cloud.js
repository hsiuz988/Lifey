import { mergeJoyData } from './joys.js';
// 雲端：Face ID（Passkey）登入、同步合併、照片上傳下載、另一半
import * as db from './db.js';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function api(path, { method = 'GET', body, blob, allowConflict = false } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: blob ? { 'content-type': 'image/jpeg' } : body !== undefined ? { 'content-type': 'application/json' } : {},
      body: blob || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (e) {
    throw new ApiError(0, '連不上網路');
  }
  if (res.status === 409 && allowConflict) return res.json();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.error || `連線錯誤（${res.status}）`);
  }
  return res;
}
const apiJson = async (path, opts) => {
  const res = await api(path, opts);
  return res instanceof Response ? res.json() : res;
};

// ---------- WebAuthn（瀏覽器端） ----------
const toBuf = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)).buffer;
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const passkeySupported = () => typeof window.PublicKeyCredential === 'function' && !!navigator.credentials;

function friendlyWebAuthnError(e) {
  if (e.name === 'NotAllowedError') return new ApiError(0, '已取消，或這支手機在這個網址還沒有帳號。第一次使用請先開始記錄，再用 Face ID 建立帳號');
  if (e.name === 'InvalidStateError') return new ApiError(0, '這支手機已經有這個帳號的登入金鑰了');
  return e instanceof ApiError ? e : new ApiError(0, e.message || 'Face ID 驗證失敗');
}

export async function register(name, invite) {
  const { flowId, options } = await apiJson('/api/auth/register/options', { method: 'POST', body: { name, invite } });
  let cred;
  try {
    cred = await navigator.credentials.create({
      publicKey: {
        ...options,
        challenge: toBuf(options.challenge),
        user: { ...options.user, id: toBuf(options.user.id) },
        hints: ['client-device'],
        excludeCredentials: (options.excludeCredentials || []).map((c) => ({ ...c, id: toBuf(c.id) })),
      },
    });
  } catch (e) {
    throw friendlyWebAuthnError(e);
  }
  const response = {
    id: cred.id, rawId: toB64(cred.rawId), type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64(cred.response.clientDataJSON),
      attestationObject: toB64(cred.response.attestationObject),
      transports: cred.response.getTransports ? cred.response.getTransports() : [],
    },
  };
  return apiJson('/api/auth/register/verify', { method: 'POST', body: { flowId, response } });
}

export async function login() {
  const { flowId, options } = await apiJson('/api/auth/login/options', { method: 'POST', body: {} });
  let cred;
  try {
    cred = await navigator.credentials.get({
      publicKey: {
        ...options,
        challenge: toBuf(options.challenge),
        hints: ['client-device'], // 請瀏覽器直接用這支手機的 Face ID，不要先跳出掃條碼或安全金鑰
        allowCredentials: (options.allowCredentials || []).map((c) => ({ ...c, id: toBuf(c.id) })),
      },
    });
  } catch (e) {
    throw friendlyWebAuthnError(e);
  }
  const response = {
    id: cred.id, rawId: toB64(cred.rawId), type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment || undefined,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64(cred.response.clientDataJSON),
      authenticatorData: toB64(cred.response.authenticatorData),
      signature: toB64(cred.response.signature),
      userHandle: cred.response.userHandle ? toB64(cred.response.userHandle) : undefined,
    },
  };
  return apiJson('/api/auth/login/verify', { method: 'POST', body: { flowId, response } });
}

export const logout = () => apiJson('/api/auth/logout', { method: 'POST', body: {} });
export const signupStatus = (invite) => apiJson(`/api/signup${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`);

export async function fetchMe() {
  const me = await apiJson('/api/me');
  return me.user ? me : null;
}

// ---------- 合併（兩邊都有改動時，逐筆保留較新的版本） ----------
const newer = (a, b) => ((a && a.updatedAt) || '') >= ((b && b.updatedAt) || '');

export function mergeStates(local, remote) {
  if (!remote) return local;
  const deleted = { ...(remote.deleted || {}) };
  for (const [id, t] of Object.entries(local.deleted || {})) if (!deleted[id] || t > deleted[id]) deleted[id] = t;

  const byId = new Map();
  for (const m of [...(remote.moments || []), ...local.moments]) {
    const cur = byId.get(m.id);
    if (!cur || (m.updatedAt || '') > (cur.updatedAt || '')) byId.set(m.id, m);
  }
  const moments = [...byId.values()].filter((m) => !(deleted[m.id] && deleted[m.id] >= (m.updatedAt || '')));

  const years = { ...(remote.years || {}) };
  for (const [k, y] of Object.entries(local.years || {})) if (!years[k] || newer(y, years[k])) years[k] = y;

  const profile = !remote.profile ? local.profile : !local.profile ? remote.profile : newer(local.profile, remote.profile) ? local.profile : remote.profile;

  let achievements = local.achievements;
  if (remote.achievements) {
    achievements = { ...(local.achievements || {}) };
    for (const [id, t] of Object.entries(remote.achievements)) if (!achievements[id] || t < achievements[id]) achievements[id] = t;
  }

  // 人物：同一個人保留較新的版本，刪掉的（墓碑比較新）不再出現
  const peopleById = new Map();
  for (const p of [...(remote.people || []), ...(local.people || [])]) {
    const cur = peopleById.get(p.id);
    if (!cur || (p.updatedAt || '') > (cur.updatedAt || '')) peopleById.set(p.id, p);
  }
  const people = [...peopleById.values()].filter((p) => !(deleted[p.id] && deleted[p.id] >= (p.updatedAt || '')));

  // 給未來的信：同一封保留較新的版本（打開的時間也算），刪掉的不再出現
  const lettersById = new Map();
  for (const l of [...(remote.letters || []), ...(local.letters || [])]) {
    const cur = lettersById.get(l.id);
    if (!cur || (l.updatedAt || '') > (cur.updatedAt || '')) lettersById.set(l.id, l);
  }
  const letters = [...lettersById.values()].filter((l) => !(deleted[l.id] && deleted[l.id] >= (l.updatedAt || '')));

  const prefs = { ...(remote.prefs || {}), ...(local.prefs || {}) };
  const lastExportAt = [local.lastExportAt, remote.lastExportAt].filter(Boolean).sort().pop() || null;
  // 累積幸福：項目和每一次的紀錄都逐筆合併，兩台手機同一天各點的次數都會留下
  const { joys, joyLog } = mergeJoyData(local, remote, deleted);
  return { ...local, profile, moments, years, people, letters, joys, joyLog, prefs, deleted, achievements, lastExportAt };
}

// 只送需要同步的欄位（回憶模式進度是各裝置自己的）
function cloudDoc(state) {
  const { recall, ...rest } = state;
  return rest;
}

// ---------- 同步 ----------
async function uploadPhotos(state, onProgress) {
  const { ids } = await apiJson('/api/photos');
  const remote = new Set(ids);
  const todo = [...new Set(state.moments.flatMap((m) => m.photoIds))].filter((id) => !remote.has(id));
  let done = 0;
  for (const id of todo) {
    const p = await db.getPhoto(id);
    if (!p) continue; // 這支手機沒有這張（可能在別的裝置上），之後由那台上傳
    onProgress(`上傳照片 ${++done}/${todo.length}`);
    await api(`/api/photos/${id}?kind=thumb`, { method: 'PUT', blob: p.thumb });
    await api(`/api/photos/${id}?kind=full`, { method: 'PUT', blob: p.blob });
  }
  return new Set([...remote, ...todo]);
}

async function downloadPhotos(state, remoteIds, onProgress) {
  const local = new Set(await db.getAllPhotoIds());
  const todo = [...new Set(state.moments.flatMap((m) => m.photoIds))].filter((id) => !local.has(id) && remoteIds.has(id));
  let done = 0;
  for (const id of todo) {
    onProgress(`下載照片 ${++done}/${todo.length}`);
    const thumb = await (await api(`/api/photos/${id}?kind=thumb`)).blob();
    const blob = await (await api(`/api/photos/${id}?kind=full`)).blob();
    await db.putPhotos([{ id, blob, thumb, createdAt: new Date().toISOString() }]);
  }
  return todo.length;
}

// getLocal：取得目前本機資料；apply：把合併結果套用回本機並存檔
export async function syncNow(getLocal, apply, onProgress = () => {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    onProgress('同步中…');
    const remote = await apiJson('/api/sync');
    const merged = mergeStates(getLocal(), remote.doc);
    const remoteIds = await uploadPhotos(merged, onProgress);
    const res = await apiJson('/api/sync', { method: 'PUT', body: { doc: cloudDoc(merged), baseRev: remote.rev }, allowConflict: true });
    if (res.conflict) continue; // 別的裝置剛好也在同步，重新合併一次
    await apply(merged);
    const downloaded = await downloadPhotos(merged, remoteIds, onProgress);
    return { downloaded };
  }
  throw new ApiError(409, '同步衝突，請稍後再試');
}

// ---------- 連結的家人 ----------
export const createInvite = (personId) => apiJson('/api/invite', { method: 'POST', body: { personId: personId || null } });
export const acceptInvite = (code) => apiJson('/api/invite/accept', { method: 'POST', body: { code } });
export const unlink = (userId) => apiJson(`/api/links/${userId}`, { method: 'DELETE' });
export const bindPerson = (userId, personId) => apiJson(`/api/links/${userId}`, { method: 'PUT', body: { personId } });
export const memberView = (userId) => apiJson(`/api/members/${userId}`);

const memberUrls = new Map();
export function memberPhotoUrl(userId, id, kind = 'thumb') {
  const key = `${userId}:${id}:${kind}`;
  if (!memberUrls.has(key)) {
    memberUrls.set(key, api(`/api/members/${userId}/photos/${id}?kind=${kind}`).then((r) => r.blob()).then((b) => URL.createObjectURL(b)).catch(() => {
      memberUrls.delete(key);
      return null;
    }));
  }
  return memberUrls.get(key);
}

export const fetchRemote = () => apiJson('/api/sync');
export const writeStory = (entry) => apiJson('/api/story', { method: 'POST', body: entry });
