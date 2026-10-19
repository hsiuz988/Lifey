const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 用法：先在 public/ 開一個本機伺服器，再執行 tests/run.sh（詳見 tests/README.md）
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');
const S = OUT;
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); await require('./adapt.js')(p);
  const errors = [];
  p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL);
  await p.fill('#setup-form [name=name]', 'Hsiu'); await p.fill('#setup-form [name=birthday]', '1995-03-02'); await p.click('#setup-form button'); await p.waitForTimeout(200); await p.evaluate(() => { const d = document.querySelector('#avatar-dialog'); if (d && d.open) d.close(); });
  const st = () => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('meta').objectStore('meta').get('state'); t.onsuccess = () => r(t.result); }; }));
  const age = () => p.textContent('#recall-age');
  const next = async () => { const a = await age(); await p.click('#recall-next'); await p.waitForFunction((a) => document.querySelector('#recall-age').textContent !== a || !document.querySelector('#recall-dialog').open, a); };
  const save = async () => { await p.click('#recall-save'); await p.waitForTimeout(400); };

  await p.click('#recall-btn');
  assert(await age() === '0 歲' && await p.textContent('#recall-stage') === '大約是嬰幼兒時期', '從 0 歲開始，嬰幼兒時期');
  const q1 = await p.textContent('#recall-question');
  await p.click('#recall-next-q');
  assert(await p.textContent('#recall-question') !== q1, '換一題');
  await p.fill('#recall-summary', '在高雄出生');
  await p.fill('#recall-text', '媽媽說我出生那天颱風');
  await next();
  assert(await age() === '1 歲', '下一歲');
  let s = await st();
  assert(s.years['0'].title === '在高雄出生', '翻頁自動存這一歲的一句話');
  assert(s.moments.length === 1 && s.moments[0].approx && s.moments[0].date === '1995-03-02', '翻頁自動存回憶（不確定日期，記在 0 歲生日）');

  // 學制推算
  const stageAt = async (n) => { while (Number((await age()).split(' ')[0]) < n) await next(); return p.textContent('#recall-stage'); };
  assert(await stageAt(5) === '大約是幼兒園', '5 歲：幼兒園');
  assert(await stageAt(6) === '大約是國小一年級', '6 歲：國小一年級');
  assert(await stageAt(12) === '大約是國中一年級', '12 歲：國中一年級');
  assert(await stageAt(15) === '大約是高中一年級', '15 歲：高中一年級');
  assert(await stageAt(18) === '大約是大學一年級（如果有念）', '18 歲：大學一年級');

  // 確切日期超出範圍
  await p.fill('#recall-text', '上大學第一天');
  await p.click('#recall-date-wrap summary');
  await p.fill('#recall-date', '2020-01-01');
  await save();
  assert(await age() === '18 歲' && (await st()).moments.length === 1, '日期超出這一歲會擋下來');
  await p.fill('#recall-date', '2013-09-01');
  await p.check('#recall-star');
  await save();
  s = await st();
  const m18 = s.moments.find(m => m.text === '上大學第一天');
  assert(m18 && !m18.approx && m18.date === '2013-09-01' && m18.starred, '記下確切日期 + ☆');
  assert((await p.textContent('#recall-list')).includes('上大學第一天'), '這一歲的清單出現新紀錄');

  // 完整記一筆（加照片）
  await p.click('#recall-more');
  await p.waitForFunction(() => document.querySelector('#moment-dialog').open);
  assert(await p.inputValue('#moment-form [name=date]') === '2013-03-02' && await p.isChecked('#moment-form [name=approx]'), '完整記一筆：預設這一歲、不確定日期');
  await p.fill('#moment-form [name=text]', '搬進宿舍');
  await p.setInputFiles('#photo-input', FIXTURES + '/p0.jpg');
  await p.waitForFunction(() => document.querySelectorAll('#photo-picker .photo-item img').length === 1);
  await p.click('#moment-save');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  assert(await p.evaluate(() => document.querySelector('#recall-dialog').open), '存完回到回憶模式');
  assert((await p.textContent('#recall-list')).includes('搬進宿舍 📷1'), '清單顯示照片數');
  await p.screenshot({ path: S + '/s3-recall.png' });

  // 先到這裡：沒按記下來的文字也會存，下次接著回憶
  await p.fill('#recall-text', '第一次自己住');
  await p.click('#recall-dialog [data-close]');
  await p.waitForFunction(() => document.querySelector('#recall-btn').textContent.includes('18'));
  assert((await st()).moments.some(m => m.text === '第一次自己住'), '關閉時自動存');
  assert(await p.textContent('#recall-btn') === '🕰 繼續回憶（18 歲）', '地圖按鈕顯示繼續回憶');
  await p.click('#life-map .cell >> nth=18'); assert((await p.textContent('#timeline')).includes('這一年'), '時間軸顯示「這一年」');
  await p.reload();
  await p.click('#recall-btn');
  assert(await age() === '18 歲', '重新開啟後從 18 歲繼續');

  // 走到今年 → 完成
  while ((await age()) !== '31 歲') await next();
  assert(await p.textContent('#recall-stage') === '今年' && await p.textContent('#recall-next') === '完成 ✓', '今年：完成按鈕');
  await p.click('#recall-next');
  await p.waitForFunction(() => !document.querySelector('#recall-dialog').open);
  assert(await p.textContent('#recall-btn') === '🕰 回憶模式', '完成後按鈕復原');
  // 完成後再開：從第一個空白年歲開始，關閉也照樣存
  await p.click('#recall-btn');
  assert(await age() === '1 歲', '再開時從第一個空白的年歲（1 歲）開始');
  await p.fill('#recall-summary', '學會走路');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  assert((await st()).years['1']?.title === '學會走路', '按返回鍵關閉也會存');
  console.log('errors', errors);
  await b.close();
})();
