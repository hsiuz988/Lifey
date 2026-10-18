// /api/* 由這裡處理，其餘交給靜態網站（public/）
import { HttpError, json } from './util.js';
import { ensureSchema } from './schema.js';
import * as auth from './auth.js';
import * as data from './data.js';

async function route(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  // 擋掉跨站請求：會改資料的請求必須來自自己的網址
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) throw new HttpError(403, '不允許的來源');
  }

  await ensureSchema(env);

  if (method === 'GET' && pathname === '/api/signup') return auth.signupStatus(request, env);
  if (method === 'POST' && pathname === '/api/auth/register/options') return auth.registerOptions(request, env);
  if (method === 'POST' && pathname === '/api/auth/register/verify') return auth.registerVerify(request, env);
  if (method === 'POST' && pathname === '/api/auth/login/options') return auth.loginOptions(request, env);
  if (method === 'POST' && pathname === '/api/auth/login/verify') return auth.loginVerify(request, env);
  if (method === 'POST' && pathname === '/api/auth/logout') return auth.logout(request, env);

  // 沒登入時回傳 user: null（不用 401，免得瀏覽器在主控台記錯誤）
  if (method === 'GET' && pathname === '/api/me') {
    const me = await auth.currentUser(request, env);
    return me ? data.me(me, env) : json({ user: null, links: [] });
  }

  const user = await auth.requireUser(request, env);
  if (method === 'GET' && pathname === '/api/sync') return data.getSync(user, env);
  if (method === 'PUT' && pathname === '/api/sync') return data.putSync(request, user, env);
  if (method === 'GET' && pathname === '/api/photos') return data.listPhotos(user, env);
  if (method === 'POST' && pathname === '/api/invite') return data.createInvite(request, user, env);
  if (method === 'POST' && pathname === '/api/invite/accept') return data.acceptInvite(request, user, env);

  let m = pathname.match(/^\/api\/photos\/([^/]+)$/);
  if (m && method === 'PUT') return data.putPhoto(request, user, env, m[1]);
  if (m && method === 'GET') return data.getPhoto(request, user, env, m[1]);
  m = pathname.match(/^\/api\/links\/([^/]+)$/);
  if (m && method === 'DELETE') return data.unlink(user, env, m[1]);
  if (m && method === 'PUT') return data.bindPerson(request, user, env, m[1]);
  m = pathname.match(/^\/api\/members\/([^/]+)$/);
  if (m && method === 'GET') return data.getMember(user, env, m[1]);
  m = pathname.match(/^\/api\/members\/([^/]+)\/photos\/([^/]+)$/);
  if (m && method === 'GET') return data.getMemberPhoto(request, user, env, m[1], m[2]);

  throw new HttpError(404, '找不到這個 API');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: '伺服器發生錯誤' }, 500);
    }
  },
};
