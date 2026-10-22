const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 用法：先在 public/ 開一個本機伺服器，再執行 tests/run.sh（詳見 tests/README.md）
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();
const FIXTURES = require('path').join(__dirname, '..', 'fixtures');
const S = OUT, IMG = FIXTURES;
// 自己畫的確認視窗：點寫著某個字的按鈕
const pick = async (p, label) => { await p.waitForFunction(() => document.querySelector('#ask-dialog').open); await p.click(`#ask-body .ask-actions button:text-is("${label}")`); await p.waitForTimeout(100); };
const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
// 地圖點格子會打開「這一歲」抽屜；要看日記再按「看這一歲的日記」
const openAge = async (p, sel) => { await tab(p, 'map'); await p.click(sel); await p.click('#year-view'); await p.waitForTimeout(100); };
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const idb = (p, fn) => p.evaluate(fn);
const photoCount = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('photos').objectStore('photos').count(); t.onsuccess = () => r(t.result); }; }));
const photoDims = (p) => p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('photos').objectStore('photos').getAll(); t.onsuccess = () => r(t.result.map(x => [x.w, x.h, x.blob.size, x.thumb.size])); }; }));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
  const p = await ctx.newPage(); await require('./adapt.cjs')(p);
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  p.on('dialog', d => d.accept());

  // 1. 階段 1 資料搬家
  await p.goto(URL);
  await p.evaluate(() => localStorage.setItem('lifelog.v1', JSON.stringify({ version: 1, profile: { name: 'Hsiu', birthday: '1995-03-02' }, lastExportAt: null,
    moments: [{ id: 'old1', date: '2013-09-01', text: '上大學第一天', mood: 4, tags: ['學習'], starred: true, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }] })));
  await p.reload();
  await tab(p, 'map'); await p.waitForSelector('#life-map .cell.filled'); await openAge(p, '#life-map .cell >> nth=18');
  await p.waitForSelector('.moment');
  assert(await p.textContent('.moment') .then(t => t.includes('上大學第一天')), '階段 1 資料搬到 IndexedDB');
  assert(await p.evaluate(() => !localStorage.getItem('lifelog.v1') && !!localStorage.getItem('lifelog.v1.migrated')), '舊資料改名保留');
  await p.reload(); await tab(p, 'map'); await p.waitForSelector('#life-map .cell.filled'); await openAge(p, '#life-map .cell >> nth=18'); await p.waitForSelector('.moment');
  assert((await p.$$('.moment')).length === 1, '重新整理後不會重複搬家');

  // 2. 人生地圖
  assert((await p.$$('#life-map .cell')).length === 90, '人生地圖 90 格');
  assert(await p.textContent('#life-map .cell.now') === '31', '今年 31 歲閃爍');
  assert(await p.$eval('#life-map .cell:nth-child(19)', e => e.classList.contains('filled') && e.classList.contains('starred')), '18 歲有紀錄、有 ☆');
  assert((await p.$$('#life-map .cell.future')).length === 58, '未來 58 格（可以寫信給未來）');

  // 3. 新增有照片的時刻
  await p.click('#add-btn');
  await p.fill('#moment-form [name=text]', '和朋友去花蓮');
  await p.setInputFiles('#photo-input', [IMG + '/rotated.jpg', IMG + '/transparent.png']);
  await p.waitForFunction(() => document.querySelectorAll('#photo-picker .photo-item img').length === 2);
  await p.click('#emo-picker .chip >> text=開心');
  await p.screenshot({ path: S + '/s2-sheet.png' });
  await p.click('#moment-save');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  await p.waitForFunction(() => [...document.querySelectorAll('.thumb img')].length === 2 && [...document.querySelectorAll('.thumb img')].every(i => i.complete && i.naturalWidth > 0));
  assert(true, '時間軸顯示 2 張縮圖');
  const dims = await photoDims(p);
  console.log('   照片尺寸', dims);
  assert(dims.some(([w, h]) => w === 1536 && h === 2048), 'EXIF 方向轉正（直式 1536x2048）');
  assert(dims.every(([w, h, full, thumb]) => thumb < full), '縮圖比原圖小');
  // GPS 被去掉：檢查 JPEG 裡沒有 Exif
  const hasExif = await p.evaluate(() => new Promise(r => { const q = indexedDB.open('lifey'); q.onsuccess = () => { const t = q.result.transaction('photos').objectStore('photos').getAll(); t.onsuccess = async () => { const txt = new TextDecoder('latin1').decode(await t.result[0].blob.slice(0, 2000).arrayBuffer()); r(txt.includes('Exif')); }; }; }));
  assert(!hasExif, '照片的 EXIF / GPS 已移除');

  // 4. 大圖
  await p.click('.thumb >> nth=0');
  await p.waitForFunction(() => document.querySelector('#lightbox-img').src.startsWith('blob:'));
  assert(await p.textContent('#lb-count') === '1 / 2', '大圖顯示 1 / 2');
  await p.click('#lb-next');
  assert(await p.textContent('#lb-count') === '2 / 2', '下一張');
  await p.click('#lightbox-img');
  assert(!(await p.evaluate(() => document.querySelector('#lightbox').open)), '點一下關閉大圖');

  // 5. 年歲的一句話 + 在這一歲記一筆
  await openAge(p, '#life-map .cell:nth-child(19)'); await tab(p, 'memories').then(() => p.click('#timeline .year-title-btn'));
  await p.fill('#year-form [name=summary]', '離家上大學的一年');
  await p.click('#year-form button[type=submit]');
  await p.waitForFunction(() => !document.querySelector('#year-dialog').open);
  assert((await p.textContent('#timeline .year-title-btn')).includes('離家上大學的一年'), '時間軸顯示這一歲的一句話');
  await openAge(p, '#life-map .cell:nth-child(8)'); // 7 歲
  await tab(p, 'memories').then(() => p.click('#timeline .year-add button'));
  assert(await p.inputValue('#moment-form [name=date]') === '2002-03-02', '在 7 歲記一筆，日期預設 7 歲生日');
  await p.fill('#moment-form [name=text]', '小學一年級');
  await p.click('#moment-save');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);

  // 6. 編輯：移除一張照片 + 加一張，取消不留垃圾
  await openAge(p, '#life-map .cell.now'); await tab(p, 'memories'); await p.click('.moment-body:has-text("花蓮")');
  await p.waitForFunction(() => document.querySelectorAll('#photo-picker .photo-item img').length === 2);
  await p.setInputFiles('#photo-input', [IMG + '/p0.jpg']);
  await p.waitForFunction(() => document.querySelectorAll('#photo-picker .photo-item img').length === 3);
  await p.click('#moment-dialog [data-close]'); await pick(p, '放棄');
  assert(await photoCount(p) === 2, '取消編輯不會多存照片');
  await tab(p, 'memories'); await p.click('.moment-body:has-text("花蓮")');
  await p.waitForFunction(() => document.querySelectorAll('#photo-picker .photo-item img').length === 2);
  await p.click('#photo-picker .photo-remove >> nth=1');
  await p.click('#moment-save');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  assert(await photoCount(p) === 1, '移除照片後資料庫只剩 1 張');
  // 上限 4 張
  await tab(p, 'memories'); await p.click('.moment-body:has-text("花蓮")');
  await p.setInputFiles('#photo-input', [IMG + '/p0.jpg', IMG + '/p1.jpg', IMG + '/p2.jpg', IMG + '/rotated.jpg']);
  await p.waitForFunction(() => document.querySelectorAll('#photo-picker .photo-item img').length === 4 && !document.querySelector('.photo-item.busy'));
  assert(!(await p.$('.photo-add')), '滿 4 張就不能再加');
  await p.click('#moment-save');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  assert(await photoCount(p) === 4, '存了 4 張');

  // 篩選
  await tab(p, 'memories'); await p.click('.chip:text-is("📷 有照片")');
  assert((await p.$$('.moment')).length === 1, '「有照片」篩選');
  await tab(p, 'memories'); await p.click('.chip:text-is("全部")');

  await p.reload(); await p.waitForSelector('#app:not([hidden])'); await tab(p, 'memories'); await p.waitForSelector('.thumb img[src^="blob:"]');
  await p.screenshot({ path: S + '/s2-main.png', fullPage: true });

  // 7. 匯出 ZIP（兩段式）
  await tab(p, 'me').then(() => p.click('.me-menu [data-open=backup]'));
  await p.click('#export-btn');
  await p.waitForFunction(() => document.querySelector('#export-btn').textContent.startsWith('儲存備份檔'));
  console.log('  ', await p.textContent('#export-btn'), '|', await p.textContent('#storage-status'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#export-btn')]);
  await dl.saveAs(S + '/backup.zip');
  // 備份裡的「回憶.html」：瀏覽器直接打開就是照年齡排好的日記，照片指向同一包裡的 photos/
  const html = require('child_process').execFileSync('python3', ['-c', 'import sys,zipfile; sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read("回憶.html").decode())', S + '/backup.zip']).toString();
  const imgs = [...html.matchAll(/<img src="(photos\/[^"]+\.jpg)"/g)].map((x) => x[1]);
  const names = require('child_process').execFileSync('python3', ['-c', 'import sys,zipfile; print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', S + '/backup.zip']).toString().split('\n');
  assert(html.includes('花蓮') && html.includes('的回憶') && imgs.length >= 1 && imgs.every((x) => names.includes(x)), `備份裡有看得懂的「回憶.html」，照片都在同一包（${imgs.length} 張）`);
  assert(await p.textContent('#export-btn') === '匯出備份', '匯出後按鈕復原');
  assert(await p.waitForFunction(() => document.querySelector('#backup-banner').hidden, null, { timeout: 5000 }).then(() => true, () => false), '匯出後不再提醒備份');

  // 8. 刪除時刻會刪照片
  await p.click('#settings-dialog .win-x').catch(() => {});
  await tab(p, 'memories'); await p.click('.moment-body:has-text("花蓮")');
  const before = await photoCount(p);
  await p.click('#moment-menu-btn'); await p.click('#moment-delete');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  assert(!(await p.isVisible('.moment-body:has-text("花蓮")')) && await p.isVisible('.toast-act:text-is("復原")'), '刪除不先問，直接刪，提示上有「復原」');
  await p.click('.toast-act'); await p.waitForTimeout(300);
  assert(await p.isVisible('.moment-body:has-text("花蓮")') && await photoCount(p) === before, '按「復原」紀錄和照片都回來');
  await p.click('.moment-body:has-text("花蓮")'); await p.click('#moment-menu-btn'); await p.click('#moment-delete');
  await p.waitForFunction(() => !document.querySelector('#moment-dialog').open);
  assert(await photoCount(p) === before, '復原時間內照片先留著');
  await p.waitForTimeout(6500);
  assert(await photoCount(p) === 0, '復原時間過了，照片也刪掉');

  // 9. 匯入 ZIP（取代）
  await tab(p, 'me').then(() => p.click('.me-menu [data-open=backup]'));
  await p.setInputFiles('#import-file', S + '/backup.zip');
  await pick(p, '整個取代成備份檔');
  await p.waitForFunction(() => !document.querySelector('#settings-dialog').open, null, { timeout: 15000 });
  assert(await photoCount(p) === 4, '匯入 ZIP 還原 4 張照片');
  await p.waitForFunction(() => [...document.querySelectorAll('.thumb img')].length === 4 && [...document.querySelectorAll('.thumb img')].every(i => i.complete && i.naturalWidth > 0));
  await openAge(p, '#life-map .cell:nth-child(19)'); assert((await p.textContent('#timeline .year-title-btn')).includes('離家上大學'), '匯入後這一歲的一句話也在');
  console.log('errors', errors);
  await b.close();
})();
