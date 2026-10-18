// Face ID／Passkey 登入（WebAuthn），驗證交給 @simplewebauthn/server
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { HttpError, json, readJson, nowIso, addSeconds, randomToken, sha256, getCookie, b64url, fromB64url } from './util.js';

const COOKIE = 'lifey_session';
const SESSION_DAYS = 180;
const CHALLENGE_SECONDS = 300;
const RP_NAME = '人生紀錄 Lifey';

function rp(request) {
  const url = new URL(request.url);
  return { rpID: url.hostname, origin: url.origin };
}

async function saveChallenge(env, kind, challenge, data) {
  const id = randomToken(16);
  await env.DB.prepare('INSERT INTO challenges (id, challenge, kind, data, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, challenge, kind, JSON.stringify(data || {}), addSeconds(CHALLENGE_SECONDS)).run();
  // 順手清掉過期的
  await env.DB.prepare('DELETE FROM challenges WHERE expires_at < ?').bind(nowIso()).run();
  return id;
}

// 取出並刪除（一次性）
async function takeChallenge(env, id, kind) {
  if (typeof id !== 'string') throw new HttpError(400, '流程已失效，請再試一次');
  const row = await env.DB.prepare('DELETE FROM challenges WHERE id = ? AND kind = ? RETURNING challenge, data, expires_at').bind(id, kind).first();
  if (!row || row.expires_at < nowIso()) throw new HttpError(400, '流程逾時，請再試一次');
  return { challenge: row.challenge, data: JSON.parse(row.data || '{}') };
}

async function createSession(env, userId) {
  const token = randomToken(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, nowIso(), addSeconds(SESSION_DAYS * 86400)).run();
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export async function currentUser(request, env) {
  const token = getCookie(request, COOKIE);
  if (!token) return null;
  return env.DB.prepare(`SELECT u.id, u.name FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).bind(await sha256(token), nowIso()).first();
}

export async function requireUser(request, env) {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, '請先登入');
  return user;
}

async function findInvite(env, code) {
  if (!code) return null;
  const row = await env.DB.prepare('SELECT code, user_id FROM invites WHERE code = ? AND expires_at > ?').bind(String(code), nowIso()).first();
  return row || null;
}

export async function linkPartners(env, a, b) {
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM links WHERE user_id IN (?, ?) OR partner_id IN (?, ?)').bind(a, b, a, b),
    env.DB.prepare('INSERT INTO links (user_id, partner_id, created_at) VALUES (?, ?, ?)').bind(a, b, now),
    env.DB.prepare('INSERT INTO links (user_id, partner_id, created_at) VALUES (?, ?, ?)').bind(b, a, now),
  ]);
}

// ---------- 建立帳號 ----------
// 第一個帳號可以直接建立；之後只能用邀請碼（避免任何知道網址的人都能註冊、占用空間）
export async function registerOptions(request, env) {
  const body = await readJson(request);
  const name = String(body.name || '').trim().slice(0, 40);
  if (!name) throw new HttpError(400, '請輸入名字');
  const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first();
  const invite = await findInvite(env, body.invite);
  if (count > 0 && !invite) throw new HttpError(403, '需要邀請連結才能建立帳號');

  const userId = crypto.randomUUID();
  const { rpID } = rp(request);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(userId),
    userName: name,
    userDisplayName: name,
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
  const flowId = await saveChallenge(env, 'reg', options.challenge, { userId, name, invite: invite && invite.code });
  return json({ flowId, options });
}

export async function registerVerify(request, env) {
  const body = await readJson(request);
  const { challenge, data } = await takeChallenge(env, body.flowId, 'reg');
  const { rpID, origin } = rp(request);
  let result;
  try {
    result = await verifyRegistrationResponse({
      response: body.response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false,
    });
  } catch (e) {
    throw new HttpError(400, `驗證失敗：${e.message}`);
  }
  if (!result.verified) throw new HttpError(400, '驗證失敗');

  // 驗證期間狀況可能改變，再檢查一次
  const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first();
  const invite = await findInvite(env, data.invite);
  if (count > 0 && !invite) throw new HttpError(403, '邀請連結已失效');

  const { credential } = result.registrationInfo;
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)').bind(data.userId, data.name, now),
    env.DB.prepare('INSERT INTO credentials (id, user_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(credential.id, data.userId, b64url(credential.publicKey), credential.counter, JSON.stringify(credential.transports || []), now),
  ]);
  if (invite) {
    await linkPartners(env, invite.user_id, data.userId);
    await env.DB.prepare('DELETE FROM invites WHERE code = ?').bind(invite.code).run();
  }
  const cookie = await createSession(env, data.userId);
  return json({ user: { id: data.userId, name: data.name } }, 200, { 'set-cookie': cookie });
}

// ---------- 登入 ----------
export async function loginOptions(request, env) {
  const { rpID } = rp(request);
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred', allowCredentials: [] });
  const flowId = await saveChallenge(env, 'auth', options.challenge);
  return json({ flowId, options });
}

export async function loginVerify(request, env) {
  const body = await readJson(request);
  const { challenge } = await takeChallenge(env, body.flowId, 'auth');
  const credId = body.response && body.response.id;
  const row = credId && await env.DB.prepare('SELECT c.*, u.name FROM credentials c JOIN users u ON u.id = c.user_id WHERE c.id = ?').bind(credId).first();
  if (!row) throw new HttpError(400, '找不到這個登入金鑰，可能帳號已不存在');

  const { rpID, origin } = rp(request);
  let result;
  try {
    result = await verifyAuthenticationResponse({
      response: body.response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false,
      credential: { id: row.id, publicKey: fromB64url(row.public_key), counter: row.counter, transports: JSON.parse(row.transports || '[]') },
    });
  } catch (e) {
    throw new HttpError(400, `驗證失敗：${e.message}`);
  }
  if (!result.verified) throw new HttpError(400, '驗證失敗');

  await env.DB.prepare('UPDATE credentials SET counter = ? WHERE id = ?').bind(result.authenticationInfo.newCounter, row.id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso()).run();
  const cookie = await createSession(env, row.user_id);
  return json({ user: { id: row.user_id, name: row.name } }, 200, { 'set-cookie': cookie });
}

export async function logout(request, env) {
  const token = getCookie(request, COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
}

export async function signupStatus(request, env) {
  const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first();
  const url = new URL(request.url);
  const invite = await findInvite(env, url.searchParams.get('invite'));
  let inviter = null;
  if (invite) inviter = (await env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(invite.user_id).first())?.name || null;
  return json({ open: count === 0, invite: !!invite, inviter });
}
