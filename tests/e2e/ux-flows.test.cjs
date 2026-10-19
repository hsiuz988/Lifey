const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 用法：先在 public/ 開一個本機伺服器，再執行 tests/run.sh（詳見 tests/README.md）
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');

const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  let answer = true, prompted = []; p.on('dialog', d => { prompted.push(d.message()); d.type() === 'prompt' ? d.accept(answer === true ? '清除' : String(answer)) : (answer ? d.accept() : d.dismiss()); });
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button');
  await p.waitForFunction(() => document.querySelector('#avatar-dialog').open);
  // 捏小人：沒有年紀拉桿、復原
  assert(!(await p.$('#avatar-age')), '捏小人沒有預覽年紀');
  assert((await p.textContent('#avatar-age-label')).includes('31 歲'), '直接顯示現在的年紀');
  assert(await p.isDisabled('#avatar-undo'), '一開始不能復原');
  await p.click('#avatar-tabs button:text-is("頭髮")'); await p.click('#avatar-options .pic-btn:has-text("馬尾")');
  assert(await p.$eval('#avatar-options .pic-btn:has-text("馬尾")', e => e.classList.contains('on')), '選了馬尾');
  await p.click('#avatar-random'); await p.click('#avatar-undo');
  assert(await p.$eval('#avatar-options .pic-btn:has-text("馬尾")', e => e.classList.contains('on')), '隨機後復原回到馬尾');
  await p.click('#avatar-undo'); assert(await p.isDisabled('#avatar-undo'), '全部復原完就不能再按');
  await p.click('#avatar-options .pic-btn:has-text("包頭")');
  answer = false; await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  assert(await p.$eval('#avatar-dialog', d => d.open) && prompted.pop().includes('還沒存'), '有改過時，取消會先問，選否就留著');
  await p.click('#avatar-save'); answer = true;
  assert((await st(p)).profile.avatar.hairStyle === 'bun', '完成後存下包頭');
  await p.waitForFunction(() => document.querySelector('#letter-dialog').open); await p.evaluate(() => document.querySelector('#letter-dialog').close());

  // 記一筆：一句話就能存
  await p.click('#add-btn');
  assert(await p.$$eval('#moment-form .opt-sec', els => els.every(e => e.hidden)), '選填區塊一開始都收起來');
  assert(await p.textContent('#date-btn-label') === '今天', '日期按鈕顯示今天');
  await p.fill('#moment-form [name=text]', '只寫一句');
  answer = false; await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  assert(await p.$eval('#moment-dialog', d => d.open), '寫了東西按返回鍵，選否就不關');
  answer = true; await p.click('#moment-save'); await p.waitForTimeout(200);
  let s = await st(p);
  assert(s.moments.length === 1 && s.moments[0].text === '只寫一句', '一句話直接存');
  // 展開日期、改成不確定
  await p.click('#add-btn'); await p.fill('#moment-form [name=text]', '小時候');
  await p.click('#opt-bar .opt[data-sec=date]'); await p.fill('#moment-form [name=date]', '2003-05-01'); await p.check('#moment-form [name=approx]');
  assert((await p.textContent('#date-btn-label')).includes('8 歲時'), '日期按鈕顯示「8 歲時（日期不確定）」');
  await p.click('#star-toggle'); assert(await p.$eval('#star-toggle', e => e.classList.contains('filled')), '值得記住亮起來');
  await p.click('#moment-save'); await p.waitForTimeout(200);
  s = await st(p); const old = s.moments.find(m => m.text === '小時候');
  assert(old && old.approx && old.starred && old.date === '2003-05-01', '日期、不確定、值得記住都存下來');
  // 常用人生大事
  await p.click('#add-btn'); await p.click('#quick-events button:has-text("搬家")');
  assert(await p.inputValue('#moment-form [name=text]') === '搬家了', '常用大事一點就帶入');
  await p.click('#event-open'); await p.fill('#event-search', '馬拉松');
  assert((await p.$$('#event-grid .event-btn')).length === 1, '人生大事可以搜尋');
  await p.click('#event-grid .event-btn'); assert(await p.inputValue('#moment-form [name=text]') === '完成了馬拉松', '搜尋後選到');
  answer = true; await p.click('#moment-dialog [data-close]'); await p.waitForTimeout(150);
  assert(!(await p.$eval('#moment-dialog', d => d.open)), '確定放棄就關閉');

  // 設定：清單、人物名字選填
  await p.click('#open-settings');
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
  await p.click('[data-go=backup]'); answer = '不要'; await p.click('#reset-btn'); await p.waitForTimeout(200);
  s = await st(p); assert(s && s.moments.length === 2, '沒輸入「清除」就不清除');
  console.log('errors', errors); await b.close();
})().catch(e => { console.log('💥', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
