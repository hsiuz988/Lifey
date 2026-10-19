const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 房間試玩頁（/play/）：讀寫正式 App 的資料
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
const pad = (n) => String(n).padStart(2, '0');
const d = new Date(), today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const hot = (name) => p.evaluate((n) => document.querySelector(`#stage .hot[data-name="${n}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), name);
  const sheetOpen = () => p.waitForFunction(() => document.querySelector('#sheet').classList.contains('open'), null, { timeout: 8000 });

  // 先在正式 App 建好個人資料
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button');
  await p.waitForFunction(() => document.querySelector('#avatar-dialog').open);

  await p.goto(URL + 'play/'); await p.waitForTimeout(800);
  assert(/歲 · 第 \d+ 天/.test(await p.textContent('#age-pill')), `上方顯示真的年紀（${await p.textContent('#age-pill')}）`);

  // 日記本：寫一句，存進正式 App 的紀錄
  await hot('diary'); await sheetOpen();
  await p.fill('#sheet-body textarea', '今天好開心，吃到草莓蛋糕');
  await p.click('#sheet-body .rec'); await p.waitForTimeout(600);
  let s = await st(p);
  const m = s.moments.find((x) => x.text === '今天好開心，吃到草莓蛋糕');
  assert(m && m.date === today && m.emo === 'happy', '日記本寫的一句話存成今天的紀錄，心情判斷為開心');
  assert((await p.textContent('#today-card')).includes('草莓蛋糕'), '下方「今天」卡片更新');
  await p.waitForTimeout(400);
  assert((await p.getAttribute('#l-face', 'href')).includes('face_happy'), '小人換成高興的表情');

  // 月曆：出現今天的心情
  await p.waitForTimeout(3200);
  await hot('calendar'); await sheetOpen();
  assert(await p.$eval('#sheet-body .cal .today', (e) => e.textContent) === '😊', '心情月曆的今天顯示 😊');
  await p.click('#sheet-x'); await p.waitForTimeout(400);

  // 電視：出生那年的新聞，關掉就關機
  await hot('tv'); await sheetOpen();
  assert((await p.textContent('#sheet-title')).includes('1995'), '電視播出生那年（1995）的世界大事');
  assert(await p.getAttribute('#stage image[href="tv_on.webp"]', 'opacity') === '1', '電視螢幕亮起來');
  await p.click('#sheet-x'); await p.waitForTimeout(400);
  assert(await p.getAttribute('#stage image[href="tv_on.webp"]', 'opacity') === '0', '關掉面板電視就關機');

  // 信：封存到下一個生日
  await hot('letter'); await sheetOpen();
  await p.fill('#sheet-body textarea', '希望你還是很喜歡吃蛋糕');
  await p.click('#sheet-body .rec'); await p.waitForTimeout(600);
  s = await st(p);
  const l = s.letters.find((x) => x.text === '希望你還是很喜歡吃蛋糕');
  assert(l && l.openOn.endsWith('-03-02') && l.openOn > today && !l.openedAt, `信封存到下一個生日（${l && l.openOn}）`);

  // 換裝
  await p.evaluate(() => document.querySelector('#me').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await sheetOpen();
  await p.click('#sheet-body .card:text-is("帽 T")');
  assert((await p.getAttribute('#l-cloth', 'href')).includes('cloth_hoodie'), '點小人可以換成帽 T');

  // 回正式 App 看得到剛剛的紀錄
  await p.goto(URL); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((x) => x.close()));
  assert((await p.textContent('body')).includes('草莓蛋糕'), '回到正式 App 也看得到這筆紀錄');

  assert(errors.length === 0, `沒有 JS 錯誤 ${errors.join(' | ')}`);
  await b.close();
})().catch((e) => { console.log('💥', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
