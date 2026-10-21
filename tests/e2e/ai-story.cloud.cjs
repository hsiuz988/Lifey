const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const http = require('http');
// AI 故事：用假的 Claude API（FAKE_AI_PORT）測流程，不會真的花錢。用 tests/run-cloud.sh 執行
const URL = process.env.LIFEY_URL || 'http://localhost:8787/';
const AI_PORT = Number(process.env.FAKE_AI_PORT || 9787);
const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const errors = [];

// 假的 Claude API：記下收到的請求；內容有「拒絕」就回 refusal
const calls = [];
let n = 0;
const fake = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    calls.push({ url: req.url, headers: req.headers, body });
    const entry = body.messages[0].content;
    const refused = entry.includes('拒絕');
    n += 1;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: `msg_${n}`, type: 'message', role: 'assistant', model: body.model,
      content: refused ? [] : [{ type: 'text', text: JSON.stringify({ title: `淡水的夕陽${n}`, text: `你和小美沿著河岸慢慢走，心也跟著鬆了下來。（第 ${n} 版）`, emo: 'calm', item: 'coffee' }) }],
      stop_reason: refused ? 'refusal' : 'end_turn', stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    }));
  });
});

const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
const synced = (p) => p.waitForFunction(() => { const b = document.querySelector('#sync-btn'); return b && !b.hidden && b.classList.contains('ok') && !b.classList.contains('syncing'); }, null, { timeout: 20000 });
const sheet = (p) => p.waitForFunction(() => { const d = document.querySelector('#letter-dialog'); return d.open && !d.querySelector('.story-card.loading'); }, null, { timeout: 15000 });
const sheetBtn = (p, label) => p.click(`#letter-dialog button:text-is("${label}")`);
const closed = (p) => p.waitForFunction(() => !document.querySelector('#letter-dialog').open);

let b;
(async () => {
  await new Promise((r) => fake.listen(AI_PORT, '127.0.0.1', r));
  b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); await require('./adapt.cjs')(p);
  p.on('pageerror', e => errors.push(e.message));
  if (process.env.DEBUG_REQ) p.on('request', r => { if (r.url().includes('/api/')) console.log('REQ', r.method(), r.url().replace(/.*\/api/, '/api')); });
  p.on('dialog', d => d.accept());
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });

  await p.goto(URL);
  assert(await p.waitForFunction(() => document.querySelector('.setup-login').hidden, null, { timeout: 5000 }).then(() => true).catch(() => false), '還沒有任何帳號時，不顯示「用 Face ID 登入」');
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1998-03-02'); await p.click('#setup-form button');
  await p.waitForTimeout(300);
  await p.waitForFunction(() => document.querySelector('#letter-dialog').open, null, { timeout: 4000 }).catch(() => {});
  await p.click('#letter-dialog button:text-is("之後再說")').catch(() => {});
  await p.waitForFunction(() => document.querySelector('#look-dialog').open, null, { timeout: 8000 }).catch(() => {}); await p.evaluate(() => { const d = document.querySelector('#look-dialog'); if (d.open) d.close(); });

  // 沒登入不能開
  await tab(p, 'me').then(() => p.click('.me-menu [data-open=other]'));
  await p.click('#pref-ai-story');
  assert(!(await p.isChecked('#pref-ai-story')), '沒登入雲端時打不開 AI 故事');
  const anon = await p.evaluate(() => fetch('/api/story', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'x' }) }).then(r => r.status));
  assert(anon === 401, '沒登入呼叫 /api/story 會被擋');

  await p.click('#cloud-section button:text-is("用 Face ID 建立帳號")');
  await p.waitForSelector('#cloud-section >> text=已登入：Hsiu', { timeout: 20000 });
  await synced(p);
  await p.click('#pref-ai-story');
  assert(await p.isChecked('#pref-ai-story'), '登入後可以打開 AI 故事');
  assert((await st(p)).prefs.aiStory === true, '設定有存起來');
  await p.click('#settings-dialog .win-x');

  // 記一筆：事件＋心情 → 自動跳出故事
  await p.click('#add-btn');
  await p.fill('#moment-form [name=text]', '跟小美去淡水看夕陽，吃了阿給');
  await p.fill('#moment-form [name=feel]', '很放鬆，好久沒這樣');
  await p.click('#moment-save');
  await sheet(p);
  assert(await p.isVisible('#letter-dialog .story-card >> text=淡水的夕陽1'), '送出後跳出故事版');
  assert(await p.isVisible('#letter-dialog >> text=今天還可以寫 4 次'), '顯示今天剩下的次數');
  const c1 = calls[0];
  assert(c1 && c1.body.model === 'claude-opus-5-5', '用 Claude Opus 5.5');
  assert(c1.body.output_config.effort === 'low' && c1.body.output_config.format.type === 'json_schema', 'effort low、固定輸出格式');
  assert(c1.body.fallbacks === 'default' && String(c1.headers['anthropic-beta']).includes('server-side-fallback-2026-07-01'), '開啟拒絕時的備援');
  assert(c1.headers['x-api-key'] === 'test-key', '金鑰由 Worker 帶上（不在 App 裡）');
  assert(c1.body.messages[0].content.includes('事件：跟小美去淡水看夕陽') && c1.body.messages[0].content.includes('心情：很放鬆'), '事件和心情都有送出');
  assert(c1.body.system.includes('主詞一律用「你」'), '用「你」的語氣');
  const appJs = await p.evaluate(() => fetch('/app.js').then(r => r.text()));
  assert(!appJs.includes('test-key') && !appJs.includes('ANTHROPIC'), 'App 程式碼裡沒有金鑰');

  // 再寫一次 → 用這個
  await sheetBtn(p, '再寫一次');
  await sheet(p);
  assert(await p.isVisible('#letter-dialog .story-card >> text=淡水的夕陽2'), '再寫一次換一版');
  await sheetBtn(p, '用這個');
  await closed(p);
  let m = (await st(p)).moments[0];
  assert(m.feel === '很放鬆，好久沒這樣' && m.story && m.story.title === '淡水的夕陽2', '故事版和心情都存起來');
  assert(m.emo === 'calm' && m.item === 'coffee', 'AI 順便選的情緒和小東西也存起來');
  assert(c1.body.output_config.format.schema.properties.item.enum.length === 37, 'AI 只能從 36 個小圖裡選（或 none）');
  await tab(p, 'memories');
  assert(await p.isVisible('#timeline .story-title >> text=淡水的夕陽2'), '時間軸顯示故事標題');
  assert(await p.isVisible('#timeline .moment-orig >> text=跟小美去淡水看夕陽'), '原文縮小留在下面');

  // 搜尋找得到故事內容
  await tab(p, 'memories').then(() => p.fill('#search', '河岸'));
  await p.waitForTimeout(300);
  assert(await p.isVisible('#timeline .story-title'), '搜尋找得到故事內容');
  await tab(p, 'memories').then(() => p.fill('#search', ''));
  await p.waitForTimeout(300);

  // 同步到雲端
  // 最後一次改動後 2 秒才同步（連續改動會一直往後延），等雲端出現這一則
  let remoteStory = null;
  for (let i = 0; i < 20 && remoteStory !== '淡水的夕陽2'; i++) {
    await p.waitForTimeout(1000);
    remoteStory = await p.evaluate(() => fetch('/api/sync').then(r => r.json()).then(r => { const m = r.doc && r.doc.moments[0]; return m && m.story ? m.story.title : null; }));
  }
  assert(remoteStory === '淡水的夕陽2', '故事版有同步到雲端');

  // 改了事件 → 舊故事拿掉、重新問；選保留原文
  await tab(p, 'memories').then(() => p.click('#timeline .moment-body'));
  await p.fill('#moment-form [name=text]', '跟小美去淡水看夕陽');
  await p.click('#moment-save');
  await sheet(p);
  await sheetBtn(p, '保留原文');
  await closed(p);
  m = (await st(p)).moments[0];
  assert(m.story === null && m.text === '跟小美去淡水看夕陽', '改了原文後選保留原文，就沒有故事版');
  assert(!(await p.isVisible('#timeline .story-title')), '時間軸回到原文');

  // 從 ⋯ 補寫故事、再拿掉
  await tab(p, 'memories').then(() => p.click('#timeline .moment-body'));
  await p.click('#moment-menu-btn');
  assert(await p.isVisible('#moment-story >> text=✨ 寫成故事'), '⋯ 裡可以補寫故事');
  await p.click('#moment-story');
  await sheet(p);
  await sheetBtn(p, '用這個');
  await closed(p);
  assert(!!(await st(p)).moments[0].story, '補寫的故事存起來');
  await tab(p, 'memories').then(() => p.click('#timeline .moment-body'));
  await p.click('#moment-menu-btn');
  assert(await p.isVisible('#moment-story >> text=✨ 重寫故事'), '已經有故事時顯示「重寫故事」');
  await p.click('#moment-story-remove');
  await p.waitForTimeout(200);
  assert((await st(p)).moments[0].story === null, '可以拿掉故事版');
  await p.evaluate(() => document.querySelector('#moment-dialog').close());

  // 被拒絕：顯示溫和的訊息，次數退回
  await tab(p, 'home').then(() => p.click('#add-btn')); await p.fill('#moment-form [name=text]', '拒絕測試'); await p.click('#moment-save');
  await p.waitForSelector('#letter-dialog .story-error', { timeout: 15000 });
  assert(await p.isVisible('#letter-dialog >> text=這則沒辦法寫成故事'), '被拒絕時顯示訊息');
  await sheetBtn(p, '關閉');
  // 已用 4 次（拒絕那次退回），剩 1 次
  const left = await p.evaluate(() => fetch('/api/story', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: '測試' }) }).then(r => r.json()));
  assert(left.left === 0, '被拒絕的那次不算次數');
  const over = await p.evaluate(() => fetch('/api/story', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: '測試' }) }).then(async r => ({ s: r.status, j: await r.json() })));
  assert(over.s === 429 && over.j.error.includes('明天'), '每天 5 次用完就停');
  const empty = await p.evaluate(() => fetch('/api/story', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: '  ' }) }).then(r => r.status));
  assert(empty === 400, '沒有事件不會呼叫');

  // 關掉設定就不會跳出來
  await tab(p, 'me').then(() => p.click('.me-menu [data-open=other]'));
  await p.click('#pref-ai-story');
  await p.click('#settings-dialog .win-x');
  const before = calls.length;
  await tab(p, 'home').then(() => p.click('#add-btn')); await p.fill('#moment-form [name=text]', '普通的一天'); await p.click('#moment-save');
  await p.waitForTimeout(500);
  assert(!(await p.evaluate(() => document.querySelector('#letter-dialog').open)) && calls.length === before, '關掉設定就不會寫故事');

  assert(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
  await b.close();
  fake.close();
})().catch(async (e) => {
  console.log('💥', e); process.exitCode = 1;
  if (process.env.LIFEY_OUT && b) await Promise.all(b.contexts().flatMap((c) => c.pages()).map((pg) => pg.screenshot({ path: `${process.env.LIFEY_OUT}/ai-story-fail.png` }).catch(() => {})));
  if (b) await b.close();
  fake.close();
});
