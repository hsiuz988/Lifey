// 同步（整份文字資料＋照片）與另一半的唯讀檢視
import { HttpError, json, readJson, nowIso, addSeconds, randomToken, isValidId } from './util.js';
import { linkUsers, findInvite } from './auth.js';

const MAX_DOC_BYTES = 1_800_000; // D1 單筆上限約 2MB
const MAX_PHOTO_BYTES = 8_000_000;
const ORPHAN_GRACE_MS = 60 * 60 * 1000; // 剛上傳、還沒寫進文字資料的照片先不要刪
const INVITE_DAYS = 7;

const photoKey = (userId, id, kind) => `${userId}/${id}${kind === 'thumb' ? '.thumb' : ''}`;

async function loadDoc(env, userId) {
  const row = await env.DB.prepare('SELECT data, rev FROM docs WHERE user_id = ?').bind(userId).first();
  return row ? { doc: JSON.parse(row.data), rev: row.rev } : { doc: null, rev: 0 };
}

// ---------- 文字資料 ----------
export async function getSync(user, env) {
  return json(await loadDoc(env, user.id));
}

export async function putSync(request, user, env) {
  const body = await readJson(request, MAX_DOC_BYTES + 10_000);
  const doc = body.doc;
  if (!doc || !Array.isArray(doc.moments)) throw new HttpError(400, '資料格式錯誤');
  const data = JSON.stringify(doc);
  if (data.length > MAX_DOC_BYTES) throw new HttpError(413, '文字資料太大了');

  const baseRev = Number(body.baseRev) || 0;
  const now = nowIso();
  // 樂觀鎖：只有雲端版本還是 baseRev 時才寫入，否則請客戶端合併後重試
  const result = baseRev === 0
    ? await env.DB.prepare('INSERT INTO docs (user_id, data, rev, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT (user_id) DO NOTHING')
      .bind(user.id, data, now).run()
    : await env.DB.prepare('UPDATE docs SET data = ?, rev = rev + 1, updated_at = ? WHERE user_id = ? AND rev = ?')
      .bind(data, now, user.id, baseRev).run();
  if (!result.meta.changes) return json({ conflict: true, ...(await loadDoc(env, user.id)) }, 409);

  await cleanupPhotos(env, user.id, doc);
  return json({ rev: baseRev + 1 });
}

async function cleanupPhotos(env, userId, doc) {
  const referenced = new Set(doc.moments.flatMap((m) => (Array.isArray(m.photoIds) ? m.photoIds : [])));
  const cutoff = new Date(Date.now() - ORPHAN_GRACE_MS).toISOString();
  const { results } = await env.DB.prepare('SELECT id FROM photos WHERE user_id = ? AND created_at < ?').bind(userId, cutoff).all();
  const orphans = results.map((r) => r.id).filter((id) => !referenced.has(id));
  if (!orphans.length) return;
  await env.PHOTOS.delete(orphans.flatMap((id) => [photoKey(userId, id, 'full'), photoKey(userId, id, 'thumb')]));
  await env.DB.batch(orphans.map((id) => env.DB.prepare('DELETE FROM photos WHERE user_id = ? AND id = ?').bind(userId, id)));
}

// ---------- 照片 ----------
export async function listPhotos(user, env) {
  const { results } = await env.DB.prepare('SELECT id FROM photos WHERE user_id = ?').bind(user.id).all();
  return json({ ids: results.map((r) => r.id) });
}

const kindOf = (url) => (new URL(url).searchParams.get('kind') === 'thumb' ? 'thumb' : 'full');

export async function putPhoto(request, user, env, id) {
  if (!isValidId(id)) throw new HttpError(400, '照片編號錯誤');
  const kind = kindOf(request.url);
  const body = await request.arrayBuffer();
  if (!body.byteLength || body.byteLength > MAX_PHOTO_BYTES) throw new HttpError(413, '照片太大');
  await env.PHOTOS.put(photoKey(user.id, id, kind), body, { httpMetadata: { contentType: 'image/jpeg' } });
  // 客戶端先傳縮圖再傳原圖，原圖到了才算完整
  if (kind === 'full') {
    await env.DB.prepare('INSERT INTO photos (user_id, id, size, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')
      .bind(user.id, id, body.byteLength, nowIso()).run();
  }
  return json({ ok: true });
}

// 自己的照片內容不會變，可以長期快取；另一半的照片不快取，取消分享後才會立刻看不到
async function streamPhoto(env, ownerId, id, kind, cache) {
  const obj = await env.PHOTOS.get(photoKey(ownerId, id, kind));
  if (!obj) throw new HttpError(404, '找不到照片');
  return new Response(obj.body, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': cache ? 'private, max-age=31536000, immutable' : 'private, no-store' },
  });
}

export async function getPhoto(request, user, env, id) {
  if (!isValidId(id)) throw new HttpError(400, '照片編號錯誤');
  return streamPhoto(env, user.id, id, kindOf(request.url), true);
}

// ---------- 連結的家人 ----------
async function linksOf(env, userId) {
  const { results } = await env.DB.prepare(`SELECT u.id, u.name, l.person_id AS personId FROM links l JOIN users u ON u.id = l.partner_id
    WHERE l.user_id = ? ORDER BY l.created_at`).bind(userId).all();
  return results;
}

async function isLinked(env, userId, otherId) {
  return !!(await env.DB.prepare('SELECT 1 FROM links WHERE user_id = ? AND partner_id = ?').bind(userId, otherId).first());
}

export async function me(user, env) {
  return json({ user, links: await linksOf(env, user.id) });
}

// 可以先選好是哪張人物卡（例如「媽媽」），對方加入後就自動對上
export async function createInvite(request, user, env) {
  const body = await readJson(request);
  const personId = isValidId(body.personId) ? body.personId : null;
  await env.DB.prepare('DELETE FROM invites WHERE expires_at < ?').bind(nowIso()).run();
  if (personId) await env.DB.prepare('DELETE FROM invites WHERE user_id = ? AND person_id = ?').bind(user.id, personId).run();
  const code = randomToken(12);
  await env.DB.prepare('INSERT INTO invites (code, user_id, person_id, expires_at) VALUES (?, ?, ?, ?)')
    .bind(code, user.id, personId, addSeconds(INVITE_DAYS * 86400)).run();
  return json({ code, days: INVITE_DAYS });
}

// 已經有帳號的人收到邀請
export async function acceptInvite(request, user, env) {
  const { code } = await readJson(request);
  const invite = await findInvite(env, code);
  if (!invite) throw new HttpError(400, '邀請連結已失效');
  await linkUsers(env, invite.user_id, user.id, invite.person_id);
  await env.DB.prepare('DELETE FROM invites WHERE code = ?').bind(invite.code).run();
  return me(user, env);
}

export async function unlink(user, env, otherId) {
  await env.DB.prepare('DELETE FROM links WHERE (user_id = ? AND partner_id = ?) OR (user_id = ? AND partner_id = ?)')
    .bind(user.id, otherId, otherId, user.id).run();
  return me(user, env);
}

// 把連結的人對到自己的某張人物卡
export async function bindPerson(request, user, env, otherId) {
  const { personId } = await readJson(request);
  if (personId != null && !isValidId(personId)) throw new HttpError(400, '人物卡編號錯誤');
  const r = await env.DB.prepare('UPDATE links SET person_id = ? WHERE user_id = ? AND partner_id = ?').bind(personId || null, user.id, otherId).run();
  if (!r.meta.changes) throw new HttpError(404, '還沒有和這個人連結');
  return me(user, env);
}

// 只給對方標成「分享」的紀錄，私人的一律不出現
function sharedView(doc) {
  const deleted = doc.deleted || {};
  const moments = doc.moments
    .filter((m) => m.shared && !deleted[m.id])
    .map(({ id, date, approx, text, feel, story, mood, tags, photoIds, starred }) => ({ id, date, approx, text, feel, story, mood, tags, photoIds, starred }));
  const profile = doc.profile || {};
  const years = {};
  if (profile.shareTitles !== false) {
    for (const [age, y] of Object.entries(doc.years || {})) if (y && y.title) years[age] = { title: y.title };
  }
  return { profile: { name: profile.name, birthday: profile.birthday, avatar: profile.avatar }, moments, years };
}

export async function getMember(user, env, otherId) {
  if (!(await isLinked(env, user.id, otherId))) throw new HttpError(404, '還沒有和這個人連結');
  const { doc } = await loadDoc(env, otherId);
  return json({ view: doc ? sharedView(doc) : null });
}

export async function getMemberPhoto(request, user, env, otherId, id) {
  if (!isValidId(id) || !(await isLinked(env, user.id, otherId))) throw new HttpError(404, '找不到照片');
  const { doc } = await loadDoc(env, otherId);
  const allowed = doc && sharedView(doc).moments.some((m) => (m.photoIds || []).includes(id));
  if (!allowed) throw new HttpError(404, '找不到照片');
  return streamPhoto(env, otherId, id, kindOf(request.url), false);
}
