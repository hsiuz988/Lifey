// 真實天氣：Open-Meteo（免費、不需要金鑰）
// 位置只在你按「開啟」時取得一次，四捨五入到小數點後兩位（約 1 公里），只存在這支手機，不會上傳到雲端

const KEY = 'lifey.weather';
const MAX_AGE_MS = 30 * 60 * 1000;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 存不了就下次再抓 */ }
}

export const weatherEnabled = () => !!load().enabled;

export function disableWeather() {
  save({ enabled: false });
}

function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('這個瀏覽器不支援定位')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 }),
      (err) => reject(new Error(err.code === 1 ? '沒有取得定位權限，可以到 iPhone 設定裡允許' : '暫時無法定位，稍後再試')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 6 * 60 * 60 * 1000 },
    );
  });
}

// 開啟或重新定位（要由使用者點按觸發，iPhone 才會跳出權限詢問）
export async function enableWeather() {
  const pos = await locate();
  save({ enabled: true, ...pos });
  return refreshWeather(true);
}

// 把 WMO 天氣代碼整理成場景用得到的幾種
export function describe(code, isDay = true) {
  if (code === 0) return { kind: 'clear', icon: isDay ? '☀️' : '🌙', label: '晴天' };
  if (code === 1) return { kind: 'clear', icon: isDay ? '🌤️' : '🌙', label: '晴時多雲' };
  if (code === 2) return { kind: 'cloudy', icon: '⛅', label: '多雲' };
  if (code === 3) return { kind: 'overcast', icon: '☁️', label: '陰天' };
  if (code === 45 || code === 48) return { kind: 'fog', icon: '🌫️', label: '有霧' };
  if (code >= 51 && code <= 57) return { kind: 'drizzle', icon: '🌦️', label: '毛毛雨' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    const heavy = code === 65 || code === 67 || code === 82;
    return { kind: heavy ? 'heavyrain' : 'rain', icon: '🌧️', label: heavy ? '大雨' : '下雨' };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: 'snow', icon: '🌨️', label: '下雪' };
  if (code >= 95) return { kind: 'thunder', icon: '⛈️', label: '雷雨' };
  return { kind: 'cloudy', icon: '⛅', label: '多雲' };
}

// 回傳 { kind, icon, label, temp, cloud, sunrise, sunset } 或 null（沒開啟）
export async function refreshWeather(force = false) {
  const data = load();
  if (!data.enabled || data.lat == null) return null;
  if (!force && data.weather && Date.now() - data.fetchedAt < MAX_AGE_MS) return data.weather;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${data.lat}&longitude=${data.lon}`
    + '&current=temperature_2m,weather_code,cloud_cover,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const c = j.current;
    const weather = {
      ...describe(c.weather_code, c.is_day !== 0),
      code: c.weather_code,
      temp: Math.round(c.temperature_2m),
      cloud: c.cloud_cover,
      sunrise: j.daily && j.daily.sunrise ? j.daily.sunrise[0] : null,
      sunset: j.daily && j.daily.sunset ? j.daily.sunset[0] : null,
    };
    save({ ...data, weather, fetchedAt: Date.now() });
    return weather;
  } catch (e) {
    return data.weather || null; // 沒網路就沿用上次的
  }
}

export const cachedWeather = () => load().weather || null;
