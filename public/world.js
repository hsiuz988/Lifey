// 那一年的世界：內建的國內外大事，穿插在自己的紀錄裡
// 資料在 world/1970s.json、world/1980s.json…，一個年代一個檔案；每月新增事件只要改資料，不用動程式
// 每一則：{ y, m, d, region: 'tw'|'world', cat: 'pop'|'tech'|'sport'|'society', title, text, sad? }
// m、d 查不到時是 null

export const FIRST_YEAR = 1970;
export const REGIONS = { tw: '台灣', world: '全球' };
export const CATS = { pop: '🎵', tech: '📱', sport: '⚾', society: '🌏' };

const loaded = new Map(); // 年代 → 事件陣列
const loading = new Map(); // 年代 → Promise

function loadDecade(dec) {
  if (!loading.has(dec)) {
    loading.set(dec, fetch(`world/${dec}s.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((list) => {
        const events = (Array.isArray(list) ? list : [])
          .filter((e) => e && Number.isInteger(e.y) && e.title)
          .map((e, i) => ({ ...e, id: `${e.y}-${e.m || 0}-${e.d || 0}-${i}` }));
        loaded.set(dec, events);
        return events;
      }));
  }
  return loading.get(dec);
}

const decadesBetween = (y1, y2) => {
  const out = [];
  for (let d = Math.floor(Math.max(y1, FIRST_YEAR) / 10) * 10; d <= y2; d += 10) out.push(d);
  return out;
};

// 事件落在哪一天：只知道年份的算在年中、只知道月份的算在那個月 1 號
export const eventDate = (e) => new Date(e.y, e.m ? e.m - 1 : 6, e.m ? e.d || 1 : 1);

// 某段日期之間的事件。還沒載入完成就先回傳 null，並在載入後呼叫 onReady
export function eventsBetween(start, end, onReady) {
  const decs = decadesBetween(start.getFullYear(), end.getFullYear());
  const missing = decs.filter((d) => !loaded.has(d));
  if (missing.length) {
    Promise.all(missing.map(loadDecade)).then(() => onReady && onReady());
    return null;
  }
  return decs.flatMap((d) => loaded.get(d)).filter((e) => { const t = eventDate(e); return t >= start && t <= end; });
}

// 顯示用的日期：1999/09/21、1999/09、1999 年
export function eventDateLabel(e) {
  const p = (n) => String(n).padStart(2, '0');
  if (!e.m) return `${e.y} 年`;
  return e.d ? `${e.y}/${p(e.m)}/${p(e.d)}` : `${e.y}/${p(e.m)}`;
}

// 「那年今日」：某月某日、從某一年之後發生的事（只算有確切日期的）
export function eventsOnDay(month, day, fromYear, onReady) {
  const decs = decadesBetween(fromYear, new Date().getFullYear());
  const missing = decs.filter((d) => !loaded.has(d));
  if (missing.length) {
    Promise.all(missing.map(loadDecade)).then(() => onReady && onReady());
    return null;
  }
  return decs.flatMap((d) => loaded.get(d)).filter((e) => e.y >= fromYear && e.m === month && e.d === day);
}
