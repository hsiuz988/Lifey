const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 雲端測試：要連到 wrangler dev（本機模擬 D1、R2），而且資料庫要是空的。用 tests/run-cloud.sh 執行
const URL = process.env.LIFEY_URL || 'http://localhost:8787/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');
const S = OUT;
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const errors = [];
async function device(b, label) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); await require('./adapt.cjs')(p);
  p.on('pageerror', e => errors.push(`${label}: ${e.message}`)); p.on('dialog', d => d.accept());
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  p.k = { cdp, authenticatorId };
  return p;
}
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
const synced = (p) => p.waitForFunction(() => { const b = document.querySelector('#sync-btn'); return b && !b.hidden && b.classList.contains('ok'); }, null, { timeout: 20000 });
const closed = (p, sel) => p.waitForFunction((s) => !document.querySelector(s).open, sel);
async function setup(p, name, bday, { keepEditor = false } = {}) {
  await p.fill('#setup-form [name=name]', name); await p.fill('#setup-form [name=birthday]', bday); await p.click('#setup-form button');
  await p.waitForTimeout(300);
  if (!keepEditor) await p.evaluate(() => { const d = document.querySelector('#avatar-dialog'); if (d.open) d.close(); });
}
async function register(p) {
  await p.waitForSelector('#cloud-section button:text-is("用 Face ID 建立帳號")', { timeout: 15000 });
  await p.click('#cloud-section button:text-is("用 Face ID 建立帳號")');
  await p.waitForFunction(() => document.querySelector('#sync-btn') && !document.querySelector('#sync-btn').hidden, null, { timeout: 20000 });
}
async function addPerson(p, name, relation) {
  await p.click('#add-person-btn');
  await p.fill('#person-body input[aria-label=名字]', name);
  await p.click(`#person-body .field:has-text("關係") button:text-is("${relation}")`);
  await p.click('#person-body button:text-is("儲存")');
  await p.waitForSelector(`#person-body h3:text-is("${name}")`);
  await p.click('#person-body button:text-is("關閉")');
}
async function makeAvatar(p, opts) {
  await p.click('#id-avatar');
  await p.click('#avatar-random');
  await p.click('#avatar-save'); await closed(p, '#avatar-dialog');
}
const sceneCompanions = (p) => p.$eval('#scene', e => e.dataset.companions);

(async () => {
  const b = await chromium.launch();
  // ===== A：我，先建人物卡，再建立帳號 =====
  const A = await device(b, 'A');
  await A.goto(URL);
  await setup(A, 'Hsiu', '1995-03-02');
  await A.click('#open-settings');
  await addPerson(A, 'Ken', '伴侶');
  await addPerson(A, '媽媽', '媽媽');
  await register(A);
  await A.waitForSelector('#cloud-section >> text=已登入');
  await A.click('#settings-dialog [data-close] >> nth=-1');
  await synced(A);
  let sA = await st(A);
  const kenCard = sA.people.find(x => x.name === 'Ken'), momCard = sA.people.find(x => x.name === '媽媽');
  const remote = await A.evaluate(() => fetch('/api/sync').then(r => r.json()));
  assert(remote.doc.people.length === 2, '人物卡同步到雲端');

  // 從 Ken 的人物卡發邀請
  await A.click('#open-settings');
  await A.click('#people-section button:has-text("Ken")');
  await A.click('#person-body button:text-is("邀請Ken加入")');
  const kenLink = await A.inputValue('#person-body input[readonly]');
  assert(kenLink.includes('#invite='), '從人物卡產生邀請連結');
  await A.click('#person-body button:text-is("完成")');
  await A.click('#person-body button:text-is("關閉")');
  await A.click('#settings-dialog [data-close] >> nth=-1');

  // ===== C：Ken 用連結加入 =====
  const C = await device(b, 'C');
  await C.goto(kenLink);
  await C.waitForFunction(() => document.querySelector('#setup-invite').textContent.includes('Hsiu 邀請你'));
  await setup(C, 'Ken', '1993-05-05');
  await register(C);
  await C.waitForFunction(() => document.querySelector('#avatar-dialog').open, null, { timeout: 15000 });
  assert(true, '被邀請的人建立帳號後，自動打開捏小人');
  await C.click('#avatar-dialog [data-close]');
  const cMe = await C.evaluate(() => fetch('/api/me').then(r => r.json()));
  assert(cMe.links.length === 1 && cMe.links[0].name === 'Hsiu', 'Ken 建立帳號後自動和 Hsiu 連結');
  await synced(C);

  // A：Ken 還沒捏小人 → 不會出現在場景
  await A.reload(); await synced(A);
  await A.waitForFunction(() => !document.querySelector('#partner-btn').hidden);
  let me = await A.evaluate(() => fetch('/api/me').then(r => r.json()));
  assert(me.links.length === 1 && me.links[0].personId === kenCard.id, '連結自動對上「Ken」人物卡');
  await A.waitForTimeout(800);
  assert(await sceneCompanions(A) === '0', 'Ken 還沒捏小人：還不會出現在場景');

  // Ken 捏好小人
  await makeAvatar(C);
  await C.waitForTimeout(2600); await synced(C);
  await A.reload(); await synced(A);
  await A.waitForFunction(() => document.querySelector('#scene').dataset.companions === '1', null, { timeout: 15000 });
  assert(true, 'Ken 捏好小人後出現在 A 的場景');
  await A.click('#open-settings'); await A.click('#people-section button:has-text("Ken")');
  assert((await A.textContent('#person-body')).includes('已連結 Ken 的帳號') && await A.$eval('#person-body .person-avatar svg', e => e.querySelectorAll('rect').length > 40), 'Ken 的人物卡顯示已連結＋他的小人');
  await A.click('#person-body button:text-is("關閉")');

  // 從設定邀請媽媽（下拉選人物卡）
  await A.selectOption('#cloud-section select[aria-label=邀請誰]', momCard.id);
  await A.click('#cloud-section button:text-is("產生邀請連結")');
  const momLink = await A.inputValue('#cloud-section input[readonly]');
  await A.click('#cloud-section button:text-is("完成")');
  await A.click('#settings-dialog [data-close] >> nth=-1');

  const D = await device(b, 'D');
  await D.goto(momLink);
  await setup(D, 'Mom', '1965-08-08');
  await register(D);
  await D.waitForFunction(() => document.querySelector('#avatar-dialog').open, null, { timeout: 15000 });
  await D.click('#avatar-dialog [data-close]');
  await synced(D);
  // D 看不到 Ken（沒有直接連結）
  const kenId = me.links[0].id;
  assert(await D.evaluate((id) => fetch('/api/members/' + id).then(r => r.status), kenId) === 404, '媽媽看不到 Ken 的資料（兩人沒有連結）');

  await A.reload(); await synced(A);
  me = await A.evaluate(() => fetch('/api/me').then(r => r.json()));
  assert(me.links.length === 2 && me.links.find(l => l.name === 'Mom').personId === momCard.id, '媽媽加入後對上「媽媽」人物卡');
  await A.waitForTimeout(800);
  assert(await sceneCompanions(A) === '1', '媽媽還沒捏小人：場景仍只有 Ken');
  await makeAvatar(D); await D.waitForTimeout(2600); await synced(D);
  await A.reload(); await synced(A);
  await A.waitForFunction(() => document.querySelector('#scene').dataset.companions === '2', null, { timeout: 15000 });
  assert(true, '媽媽捏好小人後也出現在場景（2 位）');

  // 分享給所有連結的人
  await A.click('#add-btn');
  assert((await A.textContent('#share-label')).includes('Ken') && (await A.textContent('#share-label')).includes('Mom'), '分享開關列出所有連結的人');
  await A.fill('#moment-form [name=text]', '全家一起吃飯'); await A.check('#moment-form [name=shared]');
  await A.click('#people-picker button:text-is("👤 媽媽")'); await A.click('#people-picker button:text-is("👤 Ken")');
  await A.click('#moment-save'); await closed(A, '#moment-dialog');
  await A.waitForTimeout(2600); await synced(A);
  const momView = await D.evaluate((id) => fetch('/api/members/' + id).then(r => r.json()), me.user.id);
  assert(momView.view.moments.length === 1 && momView.view.moments[0].text === '全家一起吃飯', '媽媽看得到 A 分享的紀錄');

  // Ken 分享一則 → A 的全家福
  await C.click('#add-btn'); await C.fill('#moment-form [name=text]', 'Ken 的分享'); await C.check('#moment-form [name=shared]');
  await C.click('#moment-save'); await closed(C, '#moment-dialog'); await C.waitForTimeout(2600); await synced(C);
  await A.click('#partner-btn');
  await A.waitForSelector('#partner-lineup .lineup-item >> nth=1');
  assert((await A.$$('#partner-lineup .lineup-item')).length === 2, '全家福列出 2 位');
  await A.click('#partner-lineup .lineup-item:has-text("Ken")');
  await A.waitForSelector('#partner-body .moment');
  assert((await A.textContent('#partner-body')).includes('Ken 的分享') && (await A.textContent('#partner-sub')).includes('伴侶'), '看 Ken 的紀錄（顯示關係「伴侶」）');
  await A.screenshot({ path: S + '/s8-family.png' });
  await A.click('#partner-dialog [data-close]');

  // 我的第二支手機：人物卡也同步過來
  const B = await device(b, 'B');
  const { credentials } = await A.k.cdp.send('WebAuthn.getCredentials', { authenticatorId: A.k.authenticatorId });
  for (const credential of credentials) await B.k.cdp.send('WebAuthn.addCredential', { authenticatorId: B.k.authenticatorId, credential });
  await B.goto(URL); await B.click('#setup-login'); await B.waitForSelector('#app:not([hidden])', { timeout: 20000 }); await synced(B);
  let sB = await st(B);
  assert(sB.people.length === 2 && sB.moments.find(m => m.text === '全家一起吃飯').people.length === 2, '第二支手機：人物卡與「和誰」都同步');
  // 刪除人物卡會同步（墓碑）
  await A.click('#open-settings'); await A.click('#people-section button:has-text("媽媽")'); await A.click('#person-body button:text-is("編輯")'); await A.click('#person-body .danger-zone button');
  await closed(A, '#person-dialog'); await A.click('#settings-dialog [data-close] >> nth=-1');
  await A.waitForTimeout(2600); await synced(A);
  await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await B.waitForTimeout(1500); await synced(B);
  sB = await st(B);
  assert(sB.people.length === 1 && !sB.people.some(x => x.name === '媽媽'), '刪除的人物卡在第二支手機也消失');
  me = await A.evaluate(() => fetch('/api/me').then(r => r.json()));
  assert(me.links.find(l => l.name === 'Mom').personId === null, '刪掉人物卡後，媽媽的帳號連結還在但不再對應');

  // 解除連結
  await A.click('#open-settings');
  await A.click('#cloud-section .member-row:has-text("Mom") button:text-is("解除連結")');
  await A.waitForFunction(() => document.querySelectorAll('#cloud-section .member-row').length === 1);
  await A.click('#settings-dialog [data-close] >> nth=-1');
  await A.waitForFunction(() => document.querySelector('#scene').dataset.companions === '1', null, { timeout: 15000 });
  assert(await D.evaluate((id) => fetch('/api/members/' + id).then(r => r.status), me.user.id) === 404, '解除後媽媽就看不到了，場景剩 Ken');
  console.log('errors', errors);
  await b.close();
})().catch(e => { console.log('💥', e.message.split('\n').slice(0,4).join(' | ')); console.log('errors', errors); process.exit(1); });
