const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 用法：先在 public/ 開一個本機伺服器，再執行 tests/run.sh（詳見 tests/README.md）
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');

const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
// 自己畫的確認視窗：點寫著某個字的按鈕
const pick = async (p, label) => { await p.waitForFunction(() => document.querySelector('#ask-dialog').open); await p.click(`#ask-body .ask-actions button:text-is("${label}")`); await p.waitForTimeout(100); };
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const native = []; p.on('dialog', d => { native.push(d.message()); d.dismiss(); });
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open);
  // 第一次使用：選自己的樣子（房間裡的小人）
  assert((await p.textContent('#look-title')) === '選你的樣子' && (await p.textContent('#look-save')) === '就是我了', '註冊後接著選樣子');
  await p.click('#look-options .look-opt[data-style="classic"]');
  assert(await p.$$eval('#look-preview img', (a) => a.length >= 4), '預覽是疊起來的小人');
  await p.click('#look-options .look-opt:has-text("帽 T")');
  assert(await p.$eval('#look-options .look-opt:has-text("帽 T")', e => e.classList.contains('on')), '選了帽 T');
  assert(await p.$$eval('#look-preview img', (a) => a.some((i) => i.src.includes('cloth_hoodie'))), '預覽換成帽 T');
  await p.click('#look-save');
  assert((await st(p)).profile.look.cloth === 'hoodie', '存下帽 T');
  await p.waitForFunction(() => document.querySelector('#letter-dialog').open); await p.evaluate(() => document.querySelector('#letter-dialog').close());

  // 記一筆：一句話就能存
  await p.click('#add-btn');
  assert(await p.$$eval('#moment-form .opt-sec', els => els.every(e => e.hidden)), '選填區塊一開始都收起來');
  assert(await p.textContent('#date-btn-label') === '今天', '日期按鈕顯示今天');
  await p.fill('#moment-form [name=text]', '只寫一句');
  await p.keyboard.press('Escape'); await pick(p, '繼續編輯');
  assert(await p.$eval('#moment-dialog', d => d.open) && await p.inputValue('#moment-form [name=text]') === '只寫一句', '寫了東西按返回鍵，選「繼續編輯」就不關、字還在');
  await p.click('#moment-save'); await p.waitForTimeout(200);
  let s = await st(p);
  assert(s.moments.length === 1 && s.moments[0].text === '只寫一句', '一句話直接存');
  await p.waitForTimeout(150);
  assert(await p.textContent('#cy-today') === '1' && await p.textContent('#cy-total') === '1', '迷你小窩：TODAY／TOTAL 算到這一筆');
  assert((await p.textContent('#cy-news')).includes('只寫一句'), '迷你小窩：最近更新出現這一筆');
  assert((await p.textContent('#cy-family')).includes('邀請家人'), '迷你小窩：還沒有家人時邀請');
  // 只放一張照片也能存；什麼都沒有時不會存
  await tab(p, 'home').then(() => p.click('#quick-open'));
  assert(await p.$eval('#moment-save', (e) => e.classList.contains('off')), '還沒寫也沒照片時，「記下來」是淡的');
  await p.click('#moment-save'); await p.waitForTimeout(150);
  assert(await p.$eval('#moment-dialog', d => d.open) && (await st(p)).moments.length === 1, '什麼都沒有時按了不會存');
  await p.setInputFiles('#photo-input', require('path').join(__dirname, '..', 'fixtures', 'p0.jpg'));
  await p.waitForFunction(() => document.querySelector('#photo-picker.single img'));
  assert(!(await p.$eval('#moment-save', (e) => e.classList.contains('off'))), '放了照片就可以記');
  await p.click('#moment-save'); await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  s = await st(p);
  assert(s.moments.length === 2 && s.moments.some((m) => m.text === '' && m.photoIds.length === 1), '只有一張照片、沒有文字也存起來');
  // 展開日期、改成不確定
  await p.click('#add-btn'); await p.fill('#moment-form [name=text]', '小時候');
  await p.click('#date-chip'); await p.fill('#moment-form [name=date]', '2003-05-01'); await p.check('#moment-form [name=approx]');
  assert((await p.textContent('#date-btn-label')).includes('8 歲時'), '日期按鈕顯示「8 歲時（日期不確定）」');
  await p.click('#more-toggle'); assert(await p.isVisible('#star-toggle'), '「更多」打開後看得到和誰、標籤、人生大事、值得記住');
  await p.click('#star-toggle'); assert(await p.$eval('#star-toggle', e => e.classList.contains('filled')), '值得記住亮起來');
  await p.click('#moment-save'); await p.waitForTimeout(200);
  s = await st(p); const old = s.moments.find(m => m.text === '小時候');
  assert(old && old.approx && old.starred && old.date === '2003-05-01', '日期、不確定、值得記住都存下來');
  // 人生大事收在「更多」裡
  await p.click('#add-btn'); await p.click('#more-toggle'); await p.click('#event-open'); await p.fill('#event-search', '搬家'); await p.click('#event-grid .event-btn >> nth=0');
  assert(await p.inputValue('#moment-form [name=text]') === '搬家了', '人生大事一點就帶入');
  await p.click('#event-open'); await p.fill('#event-search', '馬拉松');
  assert((await p.$$('#event-grid .event-btn')).length === 1, '人生大事可以搜尋');
  await p.click('#event-grid .event-btn'); assert(await p.inputValue('#moment-form [name=text]') === '完成了馬拉松', '搜尋後選到');
  await p.click('#moment-dialog [data-close]'); await pick(p, '放棄');
  assert(!(await p.$eval('#moment-dialog', d => d.open)), '選「放棄」就關閉');

  // 設定：清單、人物名字選填
  await tab(p, 'me').then(() => p.click('#open-settings'));
  assert((await p.textContent('#profile-card-name')) === 'Hsiu' && (await p.textContent('#menu-people')) === '還沒有', '設定首頁有個人卡與摘要');
  await p.click('[data-go=people]'); await p.click('#add-person-btn'); await p.click('#person-body button:text-is("媽媽")'); await p.click('#person-body button:text-is("儲存")');
  await p.waitForSelector('#person-body h3:text-is("媽媽")'); assert(true, '人物沒填名字，用關係「媽媽」顯示');
  await p.click('#person-body button:text-is("關閉")');
  await p.click('#add-pet-btn'); await p.click('#person-body button:has-text("貓")'); await p.click('#person-body .coat-btn:has-text("橘白貓")'); await p.click('#person-body button:text-is("儲存")');
  await p.waitForSelector('#person-body h3:text-is("橘白貓")'); assert(true, '寵物沒填名字，用毛色「橘白貓」顯示');
  await p.click('#person-body button:text-is("關閉")');
  assert((await p.textContent('#people-section')).includes('橘白貓') && (await p.textContent('#menu-people')) === '1 位 · 1 隻', '人物清單與摘要更新');
  s = await st(p); assert(s.people.every(x => x.name === ''), '名字存成空的（之後對方加入可以帶入）');
  // 個人資料
  await p.click('[data-page=people] [data-back]'); await p.click('#profile-card'); await p.fill('#profile-form [name=name]', 'Hsiu2'); await p.click('#profile-form button[type=submit]');
  await p.waitForTimeout(200);
  assert(!(await p.isHidden('[data-page=home]')) && (await p.textContent('#profile-card-name')) === 'Hsiu2', '儲存個人資料後回到首頁');
  // 清除要輸入「清除」
  await p.click('[data-go=backup]'); await p.click('#reset-btn'); await p.waitForFunction(() => document.querySelector('#ask-dialog').open);
  assert(await p.$eval('#ask-body button.danger', b => b.disabled), '還沒輸入「清除」時，清除按鈕按不下去');
  await p.fill('#ask-body input', '不要');
  assert(await p.$eval('#ask-body button.danger', b => b.disabled), '輸入別的字也按不下去');
  await pick(p, '先不要');
  s = await st(p); assert(s && s.moments.length === 3, '沒輸入「清除」就不清除');
  assert(native.length === 0, `沒有跳出瀏覽器原生的確認視窗（${native.join(' / ')}）`);
  console.log('errors', errors); await b.close();
})().catch(e => { console.log('💥', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
