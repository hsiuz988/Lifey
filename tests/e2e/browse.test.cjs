const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
// 瀏覽：日記時間軸（新的在上、世界大事收起來、篩選一排）、地圖點格子開「這一歲」抽屜、返回鍵關抽屜
const URL = process.env.LIFEY_URL || 'http://127.0.0.1:8770/';
const OUT = process.env.LIFEY_OUT || require('os').tmpdir();

const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
const assert = (c, msg) => { if (!c) { console.log('❌ FAIL', msg); process.exitCode = 1; } else console.log('✅', msg); };
const pick = async (p, label) => { await p.waitForFunction(() => document.querySelector('#ask-dialog').open); await p.click(`#ask-body .ask-actions button:text-is("${label}")`); await p.waitForTimeout(100); };
const open = (p, sel) => p.$eval(sel, (d) => d.open);

const old = '2026-01-01T00:00:00.000Z';
const m = (id, date, text, extra = {}) => ({ id, date, text, mood: 4, tags: [], photoIds: [], starred: false, approx: false, people: [], event: null, createdAt: `${date}T08:00:00.000Z`, updatedAt: old, ...extra });
const STATE = {
  version: 2, profile: { name: '秀', birthday: '1995-03-02', look: { style: 'pixel' } },
  moments: [
    m('a', '2026-04-01', '春天去爬山'),
    m('b', '2026-09-20', '中秋烤肉'),
    m('c', '2026-03-02', '這一歲記得的事', { approx: true, mood: null }),
    m('d', '2013-05-01', '十八歲的畢業旅行'),
  ],
  years: {}, people: [], prefs: {}, letters: [], lastExportAt: old, achievements: {},
};

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.clock.setSystemTime(new Date('2026-10-20T10:00:00'));
  await p.goto(URL);
  await p.evaluate((s) => new Promise((r) => { const q = indexedDB.open('lifey', 1); q.onupgradeneeded = () => { q.result.createObjectStore('meta'); q.result.createObjectStore('photos', { keyPath: 'id' }); }; q.onsuccess = () => { const t = q.result.transaction('meta', 'readwrite'); t.objectStore('meta').put(s, 'state'); t.oncomplete = () => { q.result.close(); r(); }; }; }), STATE);
  await p.reload(); await p.waitForSelector('#app:not([hidden])'); await p.waitForTimeout(600);

  // ---- 日記：今年新的在上面，只記得這一歲的排最後；世界大事收成一列
  await tab(p, 'memories');
  await p.waitForSelector('#timeline .world-box .world-count:not(:text("載入中…"))');
  const texts = await p.$$eval('#timeline > .moments .moment-text', (els) => els.map((e) => e.textContent.trim()));
  assert(texts[0].includes('中秋烤肉') && texts[1].includes('春天去爬山') && texts[2].includes('這一歲記得的事'), `新的在上面，不確定日期的在最後（${texts.join(' / ')}）`);
  assert((await p.$$('#timeline .world-item')).length === 0 && (await p.textContent('#timeline .world-toggle')).includes('那一年的世界'), '世界大事一開始收起來，只有一列');
  assert(!(await p.textContent('#timeline')).includes('只看我的'), '沒有「只看我的」（不用了）');
  await p.click('#timeline .world-toggle');
  assert((await p.$$('#timeline .world-item')).length > 0 && await p.isVisible('#timeline .world-box .chip:text-is("台灣")'), '展開後看得到時事和台灣／全球');
  assert(await p.$eval('#filter-chips', (e) => getComputedStyle(e).flexWrap) === 'nowrap', '篩選只有一排（多的左右滑）');
  await p.screenshot({ path: `${OUT}/browse-timeline.png`, fullPage: true });

  // ---- 地圖：點過去的格子在地圖上打開「這一歲」，不跳分頁
  await tab(p, 'map');
  assert((await p.textContent('.map-legend')).includes('寫信給那時的自己'), '圖例說明未來的格子可以寫信');
  assert(!(await p.textContent('#map-summary')).includes('最幸福'), '紀錄太少時不說「最幸福的一歲」');
  await p.click('#life-map .cell:nth-child(19)'); // 18 歲
  await p.waitForTimeout(150);
  assert(await open(p, '#year-dialog') && (await p.textContent('#year-heading')) === '18 歲', '點 18 歲的格子打開「18 歲」抽屜');
  assert(await p.getAttribute('#tabbar [data-tab-btn="map"]', 'aria-current') === 'page', '還停在地圖分頁');
  assert(await p.isVisible('#year-recall') && await p.isVisible('#year-card'), '抽屜裡有補回憶、年度卡');
  await p.screenshot({ path: `${OUT}/browse-year.png` });
  await p.click('#year-view'); await p.waitForTimeout(150);
  assert(await p.getAttribute('#tabbar [data-tab-btn="memories"]', 'aria-current') === 'page' && (await p.textContent('#timeline .age-label')) === '18 歲'
    && (await p.textContent('#timeline')).includes('十八歲的畢業旅行'), '「看這一歲的日記」才到日記分頁的 18 歲');
  await tab(p, 'map'); await p.click('#life-map .cell.now'); await p.waitForTimeout(150);
  assert(await p.isHidden('#year-recall'), '今年的抽屜不放「補回憶」（用記一筆就好）');
  await p.click('#year-dialog [data-close]'); await p.waitForTimeout(150);

  // ---- 返回鍵：關掉最上層的抽屜，不離開 App
  const here = p.url();
  await p.click('#add-btn'); await p.waitForTimeout(100);
  await p.goBack(); await p.waitForTimeout(200);
  assert(!(await open(p, '#moment-dialog')) && p.url() === here && await p.isVisible('#app'), '沒寫東西時按返回鍵：關掉記一筆，還在 App 裡');
  await p.click('#add-btn'); await p.fill('#moment-form [name=text]', '寫到一半');
  await p.goBack(); await pick(p, '繼續編輯');
  assert(await open(p, '#moment-dialog') && await p.inputValue('#moment-form [name=text]') === '寫到一半', '寫了東西按返回鍵：先問，選「繼續編輯」字還在');
  await p.goBack(); await pick(p, '放棄'); await p.waitForTimeout(100);
  assert(!(await open(p, '#moment-dialog')), '再按一次返回、選「放棄」就關掉');
  // 用按鈕關掉之後，返回鍵不會多關一個、也不會跑出 App
  await tab(p, 'me'); await p.click('.me-menu [data-open=backup]'); await p.waitForTimeout(100);
  await p.click('#settings-dialog .win-x'); await p.waitForTimeout(300);
  await p.click('#add-btn'); await p.waitForTimeout(100);
  await p.goBack(); await p.waitForTimeout(200);
  assert(!(await open(p, '#moment-dialog')) && p.url() === here && await p.isVisible('#app'), '按 × 關掉的抽屜不會留下多的一步');

  console.log('errors', errors);
  assert(errors.length === 0, '沒有錯誤');
  await b.close();
})().catch((e) => { console.log('💥', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
