const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 用法：先在 public/ 開一個本機伺服器，再執行 tests/run.sh（詳見 tests/README.md）
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');
const S = OUT;
const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const errors = []; const toasts = [];
const st = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const p = await ctx.newPage(); await require('./adapt.cjs')(p);
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => (d.type() === 'prompt' ? d.accept('清除') : d.accept()));
  await p.exposeFunction('logToast', t => toasts.push(t));
  await p.addInitScript(() => { new MutationObserver(() => { const t = document.querySelector('#toast'); if (t && !t.hidden) window.logToast(t.textContent); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); });
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open); await p.keyboard.press('Escape');
  const closed = (sel) => p.waitForFunction((s) => !document.querySelector(s).open, sel);
  const save = async () => { await p.click('#moment-save'); await closed('#moment-dialog'); await p.waitForTimeout(150); };

  // 成就預設隱藏
  assert(await p.isHidden('#achievements-panel'), '成就面板預設隱藏');
  await p.click('#add-btn'); await p.fill('#moment-form [name=text]', '第一筆'); await save();
  await p.waitForTimeout(300);
  assert(!toasts.some(t => t.includes('解鎖')), '解鎖成就不跳通知');
  assert((await st(p)).achievements.first, '但背後有記錄（第一步）');

  // 新增人物與寵物
  await tab(p, 'me').then(() => p.click('#open-settings'));
  await p.click('#add-person-btn');
  await p.fill('#person-body input[aria-label=名字]', '媽媽');
  await p.click('#person-body button:text-is("媽媽")');
  await p.click('#person-body button:text-is("儲存")');
  await p.waitForSelector('#person-body h3:text-is("媽媽")');
  assert(true, '新增人物「媽媽」，存完顯示人物卡');
  await p.click('#person-body button:text-is("關閉")');
  await p.click('#add-pet-btn');
  await p.fill('#person-body input[aria-label=名字]', '小白');
  await p.click('#person-body button:text-is("🐶 狗")');
  await p.click('#person-body .coat-btn >> nth=1');
  await p.click('#person-body button:text-is("儲存")');
  await p.waitForSelector('#person-body h3:text-is("小白")');
  await p.click('#person-body button:text-is("關閉")');
  await p.check('#pref-achievements');
  await p.waitForTimeout(150);
  assert(!(await p.isHidden('#achievements-panel')), '設定打開「顯示成就」後出現');
  await p.uncheck('#pref-achievements');
  await p.click('#settings-dialog [data-close] >> nth=-1');
  assert(await p.$eval('#scene', e => e.dataset.pets) === '1', '小白出現在場景裡');
  let s = await st(p);
  const pet = s.people.find(x => x.name === '小白'); const mom = s.people.find(x => x.name === '媽媽');
  assert(pet.kind === 'pet' && pet.petType === 'dog' && pet.petColor === 1 && mom.relation === '媽媽', '人物資料正確');

  // 人生大事：養寵物（已有寵物 → 直接選）
  await p.click('#add-btn');
  await p.click('#event-open');
  await p.click('#event-cats button:text-is("家庭")');
  await p.click('#event-grid button:has-text("養寵物")');
  assert(await p.inputValue('#moment-form [name=text]') === '家裡多了新成員' && await p.isChecked('#moment-form [name=starred]'), '養寵物：帶入文字並預設 ☆');
  assert(await p.textContent('#people-label') === '是哪一隻？', '提示「是哪一隻？」');
  assert((await p.$$('#people-picker .chip:not(.add-chip)')).length === 1, '只列出寵物');
  await p.click('#people-picker button:text-is("🐶 小白")');
  await save();
  s = await st(p);
  let m = s.moments.find(x => x.event === 'pet');
  assert(m && m.people[0] === pet.id && m.tags.includes('家人') && m.tags.includes('里程碑'), '存下：事件、寵物、標籤');

  // 結婚：當場新增伴侶
  await p.click('#add-btn'); await p.click('#event-open'); await p.click('#event-cats button:text-is("感情")'); await p.click('#event-grid button:has-text("結婚")');
  await p.click('#people-picker button:text-is("＋ 新增人物")');
  assert(await p.$eval('#person-body .field:has-text("關係") button.chip.on', e => e.textContent) === '伴侶', '感情類事件新增人物時預設「伴侶」');
  await p.fill('#person-body input[aria-label=名字]', 'Ken');
  await p.click('#person-body button:text-is("儲存")');
  await closed('#person-dialog');
  assert(await p.$eval('#people-picker button.on', e => e.textContent) === '👤 Ken', '新增完自動選起來');
  await save();

  // 寶寶出生：自動跳出新增（子女）
  await p.click('#add-btn'); await p.click('#event-open'); await p.click('#event-cats button:text-is("家庭")'); await p.click('#event-grid button:has-text("寶寶出生")');
  await p.waitForFunction(() => document.querySelector('#person-dialog').open);
  assert(await p.$eval('#person-body .field:has-text("關係") button.chip.on', e => e.textContent) === '子女', '寶寶出生：自動新增人物，關係是子女');
  await p.fill('#person-body input[aria-label=名字]', '小寶'); await p.click('#person-body button:text-is("儲存")'); await closed('#person-dialog');
  await save();

  // 告別：溫和、不慶祝；寵物離開場景，刪掉那則就回來
  toasts.length = 0;
  await p.click('#add-btn'); await p.click('#event-open'); await p.click('#event-cats button:text-is("告別")'); await p.click('#event-grid button:has-text("彩虹橋")');
  assert(!(await p.isChecked('#moment-form [name=starred]')), '告別：不預設 ☆');
  await p.click('#people-picker button:text-is("🐶 小白")');
  await save();
  assert(toasts.some(t => t.includes('好好記下來了')), '告別：溫和的提示');
  assert(await p.$eval('#scene', e => e.dataset.pets) === '0', '小白去了彩虹橋，不再出現在場景');
  await tab(p, 'memories'); await p.click('.person-chip:has-text("小白") >> nth=0');
  assert((await p.textContent('#person-body')).includes('彩虹橋'), '人物卡顯示 🌈');
  await p.click('#person-body button:text-is("關閉")');
  await tab(p, 'memories'); await p.click('.moment-body:has-text("去了彩虹橋")'); await p.click('#moment-menu-btn'); await p.click('#moment-delete'); await closed('#moment-dialog');
  assert(await p.$eval('#scene', e => e.dataset.pets) === '1', '刪掉那則紀錄，小白回到場景');

  // 時間軸、篩選、人生地圖
  assert((await p.$$('.person-chip')).length >= 3, '時間軸顯示一起的人');
  await tab(p, 'memories'); await p.click('.chip:text-is("⭐ 人生大事")');
  assert((await p.$$('.moment')).length === 3, '「人生大事」篩選出 3 則');
  await tab(p, 'memories'); await p.click('.chip:text-is("全部")');
  await tab(p, 'memories'); await p.click('.person-chip:has-text("Ken")');
  assert((await p.textContent('#person-body .person-facts')).includes('一起記了 1 則'), 'Ken 的人物卡：一起記了 1 則');
  await p.click('#person-body button:text-is("篩選紀錄")');
  assert((await p.$$('.moment')).length === 1 && await p.$eval('.chip.on', e => e.textContent) === '👤 Ken', '從人物卡篩選時間軸');
  await tab(p, 'memories'); await p.click('.chip:text-is("全部")');
  assert(await p.$eval('#life-map .cell.now', e => e.classList.contains('has-event')), '人生地圖：今年那格顯示大事圖示');

  // 回憶模式：這一歲的人生大事
  await tab(p, 'map').then(() => p.click('#recall-btn'));
  while ((await p.textContent('#recall-age')) !== '18 歲') { const a = await p.textContent('#recall-age'); await p.click('#recall-next'); await p.waitForFunction((x) => document.querySelector('#recall-age').textContent !== x, a); }
  await p.click('#recall-event');
  await p.click('#event-cats button:text-is("學業")'); await p.click('#event-grid button:has-text("上大學")');
  await p.waitForFunction(() => document.querySelector('#moment-dialog').open);
  assert(await p.inputValue('#moment-form [name=date]') === '2013-03-02' && await p.isChecked('#moment-form [name=approx]') && await p.inputValue('#moment-form [name=text]') === '上大學了', '回憶模式：在 18 歲記「上大學」');
  await save();
  await p.click('#recall-dialog [data-close]');

  // 刪除人物：紀錄留著、標記拿掉
  await tab(p, 'map').then(() => p.click('#life-map .cell.now')); await p.click('.person-chip:has-text("小寶")'); await p.click('#person-body button:text-is("編輯")'); await p.click('#person-body .danger-zone button'); await closed('#person-dialog');
  s = await st(p);
  assert(!s.people.some(x => x.name === '小寶') && s.moments.some(x => x.event === 'baby' && x.people.length === 0), '刪除人物：紀錄還在，標記拿掉');

  // 備份還原保留人物
  await tab(p, 'me').then(() => p.click('#open-settings')); await p.click('#export-btn');
  await p.waitForFunction(() => document.querySelector('#export-btn').textContent.startsWith('儲存備份檔'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]); await dl.saveAs(S + '/people.zip');
  await p.click('#reset-btn'); await p.waitForSelector('#setup:not([hidden])');
  await p.fill('#setup-form [name=name]', 'X'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button');
  await p.waitForFunction(() => document.querySelector('#look-dialog').open); await p.keyboard.press('Escape');
  await tab(p, 'me').then(() => p.click('#open-settings')); await p.setInputFiles('#import-file', S + '/people.zip'); await closed('#settings-dialog');
  s = await st(p);
  assert(s.people.length === 3 && s.moments.find(x => x.event === 'wedding').people.length === 1, '匯出再匯入：人物與標記都在');
  await p.waitForTimeout(1500);
  await p.locator('.now-panel').screenshot({ path: S + '/s7-pets.png' });
  console.log('errors', errors);
  await b.close();
})().catch(e => { console.log('💥', e.message.split('\n').slice(0,4).join(' | ')); console.log('errors', errors); process.exit(1); });
