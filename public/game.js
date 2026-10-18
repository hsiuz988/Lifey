// 養成系統：狀態與成就（純函式，不碰 DOM 與資料庫）

// ---------- 四項狀態 ----------
export const STATS = [
  { key: 'health', label: '健康', color: '#5cc28a', tags: ['健康', '運動'] },
  { key: 'happy', label: '幸福', color: '#e0b050' },
  { key: 'knowledge', label: '知識', color: '#3fb8a8', tags: ['學習', '工作'] },
  { key: 'social', label: '人際關係', color: '#e0607e', tags: ['家人', '朋友', '愛情'] },
];

const weight = (m) => (m.starred ? 2 : 1);
// 邊際遞減：第一則加最多，記越多越接近 100，不會一下子就滿
const grow = (points) => Math.round(20 + 80 * (1 - 0.8 ** points));

// 這個時刻算不算在某一項狀態裡（用來計算重心的進度）
export function countsToward(stat, m) {
  if (stat.key === 'happy') return (m.mood || 0) >= 4;
  return m.tags.some((t) => stat.tags.includes(t));
}

export function statsFor(moments) {
  const points = (tags) => moments.filter((m) => m.tags.some((t) => tags.includes(t))).reduce((n, m) => n + weight(m), 0);
  const moods = moments.map((m) => m.mood).filter(Boolean);
  const avgMood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const happyBase = avgMood ? 10 + ((avgMood - 1) / 4) * 80 : 50; // 沒填心情就是普通的 50
  const fun = Math.min(10, points(['旅行', '興趣', '里程碑']) * 2);
  const out = { happy: Math.round(Math.min(100, happyBase + fun)) };
  for (const s of STATS) if (s.tags) out[s.key] = grow(points(s.tags));
  return out;
}

// ---------- 成就 ----------
const covers = (c, from, to) => {
  if (c.current < to) return false;
  for (let a = from; a <= to; a++) if (!c.recorded.has(a)) return false;
  return true;
};

function longestStreak(moments) {
  const days = [...new Set(moments.filter((m) => !m.approx).map((m) => m.date))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    const t = Date.UTC(...d.split('-').map((n, i) => (i === 1 ? n - 1 : +n)));
    run = prev != null && t - prev === 86400000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

export const ACHIEVEMENTS = [
  { id: 'first', icon: '✏️', name: '第一步', desc: '記下第一個時刻', test: (c) => c.moments.length >= 1 },
  { id: 'star', icon: '⭐', name: '值得記住', desc: '標記第一個 ☆', test: (c) => c.moments.some((m) => m.starred) },
  { id: 'ten', icon: '📒', name: '十個時刻', desc: '累積 10 則紀錄', test: (c) => c.moments.length >= 10 },
  { id: 'fifty', icon: '📚', name: '五十個時刻', desc: '累積 50 則紀錄', test: (c) => c.moments.length >= 50 },
  { id: 'hundred', icon: '🏛️', name: '一百個時刻', desc: '累積 100 則紀錄', test: (c) => c.moments.length >= 100 },
  { id: 'photo', icon: '📷', name: '留下畫面', desc: '加上第一張照片', test: (c) => c.photos >= 1 },
  { id: 'album', icon: '🖼️', name: '相簿', desc: '累積 50 張照片', test: (c) => c.photos >= 50 },
  { id: 'origin', icon: '👶', name: '回到起點', desc: '記下 0 歲的回憶', test: (c) => c.recorded.has(0) },
  { id: 'childhood', icon: '🧩', name: '童年拼圖', desc: '0–12 歲每一歲都有紀錄', test: (c) => covers(c, 0, 12) },
  { id: 'youth', icon: '🎒', name: '青春回憶', desc: '13–18 歲每一歲都有紀錄', test: (c) => covers(c, 13, 18) },
  { id: 'wholelife', icon: '🌏', name: '完整的一生', desc: '到今年為止每一歲都有紀錄', test: (c) => covers(c, 0, c.current) },
  { id: 'titles', icon: '🔖', name: '一句話人生', desc: '寫下 10 個年歲的一句話', test: (c) => c.titles >= 10 },
  { id: 'happy', icon: '😄', name: '好日子', desc: '同一歲裡有 10 則 😄', test: (c) => [...c.byAge.values()].some((l) => l.filter((m) => m.mood === 5).length >= 10) },
  { id: 'travel', icon: '🧳', name: '旅人', desc: '記下 5 次旅行', test: (c) => c.moments.filter((m) => m.tags.includes('旅行')).length >= 5 },
  { id: 'streak', icon: '🔥', name: '連續一週', desc: '連續 7 天都有記錄', test: (c) => longestStreak(c.moments) >= 7 },
  { id: 'focus', icon: '🎯', name: '有方向的一年', desc: '選定一年的重心', test: (c) => c.focusSet },
  { id: 'backup', icon: '🛟', name: '守護者', desc: '第一次匯出備份', test: (c) => c.backedUp },
];

export const unlockedNow = (ctx) => ACHIEVEMENTS.filter((a) => a.test(ctx)).map((a) => a.id);
