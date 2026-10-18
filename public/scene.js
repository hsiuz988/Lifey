// 會動的像素場景：天空跟著真實時間與天氣變化，小人會呼吸、眨眼、散步
// 約每秒 10 格（像素風、省電）；切到背景或捲出畫面就暫停；系統開了「減少動態效果」就只每分鐘更新一次靜態畫面
import { composeAvatar, drawAvatar, H as AVATAR_H } from './avatar.js';
import { drawPet, petSize } from './pets.js';

export const W = 120;
export const H = 50;
const FEET = 47; // 小人腳底所在列
const FPS = 10;

// ---------- 小工具 ----------
const hex = (c) => { const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
export function mix(a, b, t) {
  const x = hex(a);
  const y = hex(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const pad = (n) => String(n).padStart(2, '0');

function sprite(ctx, rows, x, y, colors) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const c = colors[row[dx]];
      if (c) { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, 1, 1); }
    }
  });
}

// ---------- 時間、季節、節日 ----------
const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

// 沒有天氣資料時，用台灣的日出日落近似值（夏天約 5:05／18:50，冬天約 6:35／17:10）
function defaultSun(d) {
  const k = Math.cos((2 * Math.PI * (dayOfYear(d) - 172)) / 365);
  return { sunrise: 5.85 - 0.75 * k, sunset: 18.0 + 0.85 * k };
}

const toHour = (iso) => { const m = /T(\d{2}):(\d{2})/.exec(iso || ''); return m ? +m[1] + m[2] / 60 : null; };

export function seasonOf(d) {
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

// 農曆節日（除夕前一天到初四、中秋前後一天）
const LUNAR_NEW_YEAR = ['2025-01-29', '2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03', '2031-01-23', '2032-02-11', '2033-01-31', '2034-02-19', '2035-02-08'];
const MID_AUTUMN = ['2025-10-06', '2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12', '2031-10-01', '2032-09-19', '2033-09-08', '2034-09-27', '2035-09-16'];
const near = (d, list, before, after) => list.some((s) => {
  const [y, m, dd] = s.split('-').map(Number);
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(y, m - 1, dd)) / 86400000);
  return diff >= -before && diff <= after;
});

export function festivalOf(d, birthday) {
  const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (birthday && birthday.slice(5) === md) return 'birthday';
  if (near(d, LUNAR_NEW_YEAR, 1, 4)) return 'lny';
  if (near(d, MID_AUTUMN, 1, 1)) return 'midautumn';
  if (md === '12-24' || md === '12-25') return 'christmas';
  if (md === '12-31' || md === '01-01') return 'newyear';
  return null;
}

// 月相：0 新月、0.5 滿月
function moonPhase(d) {
  const days = (d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  return (((days % 29.530588) + 29.530588) % 29.530588) / 29.530588;
}

// ---------- 天空 ----------
const PAL = {
  night: ['#0b1026', '#141b3a', '#202b55'],
  dawn: ['#3b3a6b', '#c86f7f', '#f3b28a'],
  morning: ['#4f8fd0', '#8cc6ea', '#f2d9b0'],
  day: ['#4a9fd8', '#7ec0e8', '#b4e0f5'],
  golden: ['#5a8fc8', '#e9a66b', '#f7d08a'],
  dusk: ['#3e3a78', '#b2557a', '#ef8f5f'],
};

function skyAt(hour, sr, ss) {
  const keys = [[0, 'night'], [sr - 1.2, 'night'], [sr - 0.3, 'dawn'], [sr + 0.7, 'morning'], [sr + 2, 'day'],
    [ss - 2, 'day'], [ss - 0.6, 'golden'], [ss + 0.2, 'dusk'], [ss + 1.1, 'night'], [24, 'night']];
  for (let i = 0; i < keys.length - 1; i++) {
    const [h1, p1] = keys[i];
    const [h2, p2] = keys[i + 1];
    if (hour >= h1 && hour <= h2) {
      const t = h2 === h1 ? 0 : (hour - h1) / (h2 - h1);
      return PAL[p1].map((c, j) => mix(c, PAL[p2][j], t));
    }
  }
  return PAL.night;
}

// 0 = 深夜，1 = 白天
function daylight(hour, sr, ss) {
  if (hour < sr - 0.8 || hour > ss + 0.9) return 0;
  if (hour < sr + 0.8) return clamp((hour - (sr - 0.8)) / 1.6, 0, 1);
  if (hour > ss - 0.6) return clamp((ss + 0.9 - hour) / 1.5, 0, 1);
  return 1;
}

// ---------- 場景元件 ----------
const CLOUDS = [
  ['..xxx...', '.xxxxxx.', 'xxxxxxxx', '.yyyyyy.'],
  ['...xxxx.....', '.xxxxxxxxx..', 'xxxxxxxxxxxx', '.yyyyyyyyyy.'],
  ['....xxxx.......', '..xxxxxxxxx....', '.xxxxxxxxxxxxx.', 'xxxxxxxxxxxxxxx', '.yyyyyyyyyyyyy.'],
];

const CANOPY = ['...xxxxx...', '.xxxxxxxxx.', 'xxxxxxxxxxx', 'xxxyxxxxxxx', 'xxxxxxxyxxx', '.xxxxxxxxx.', '...xxxxx...'];

const SEASON_COLORS = {
  spring: { leaf: '#5cb84f', light: '#8fd47a', bloom: '#f6b3c8', grass: '#5aa548', fore: '#4a8f3c' },
  summer: { leaf: '#3f8f3a', light: '#5cb84f', bloom: null, grass: '#4f9a3c', fore: '#3f8331' },
  autumn: { leaf: '#d9822b', light: '#f0a64a', bloom: '#c2452f', grass: '#8a9a3c', fore: '#76843a' },
  winter: { leaf: '#4f6b4a', light: '#6a8564', bloom: null, grass: '#6b8a5a', fore: '#5a774c' },
};

const PROP_SPRITES = {
  heart: { rows: ['.x.x.', 'xxxxx', '.xxx.', '..x..'], colors: { x: '#e0607e' } },
  book: { rows: ['xxxxx', 'xwxwx', 'xwxwx', 'xxxxx'], colors: { x: '#3f7fd1', w: '#f5f0e6' } },
  suitcase: { rows: ['.y.y.', 'xxxxx', 'xyxyx', 'xxxxx'], colors: { x: '#8b5a2b', y: '#d9a45b' } },
  ball: { rows: ['.xxx.', 'xxwxx', 'xwxwx', '.xxx.'], colors: { x: '#e05a3a', w: '#ffffff' } },
};

export function propsForTags(tags) {
  const out = [];
  if (tags.has('愛情')) out.push('heart');
  if (tags.has('學習')) out.push('book');
  if (tags.has('旅行')) out.push('suitcase');
  if (tags.has('健康') || tags.has('運動')) out.push('ball');
  return out.slice(0, 3);
}

const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Scene {
  constructor(canvas, bubble) {
    this.canvas = canvas;
    this.bubble = bubble;
    this.ctx = canvas.getContext('2d');
    this.state = { stageKey: 'adult', age: 30, avatar: null, props: [], weather: null, birthday: null, messages: () => [], companions: [], pets: [] };
    this.petActors = [];
    this.companionActors = [];
    this.frames = null;
    this.actor = { x: 52, target: 52, dir: 1, mode: 'idle', until: 0, stepAt: 0, step: false, blinkAt: 2000, blinkUntil: 0, jumpAt: -1, jumpsLeft: 0 };
    this.particles = [];
    this.weatherDrops = [];
    this.ambient = [];
    this.birdAt = 8000;
    this.fireworkAt = 4000;
    this.windowsAt = 0;
    this.visible = true;
    this.running = false;
    this.last = 0;
    this.now = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('click', (e) => this.onTap(e));
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.start()));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        this.visible = entries.some((en) => en.isIntersecting);
        if (this.visible) this.start(); else this.stop();
      }).observe(canvas);
    }
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(1, Math.round(((this.canvas.clientWidth || W * 3) * dpr) / W));
    this.canvas.width = W * scale;
    this.canvas.height = H * scale;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.draw(performance.now());
  }

  update(partial) {
    const prev = this.state;
    this.state = { ...prev, ...partial };
    if (!this.frames || this.state.avatar !== prev.avatar || this.state.age !== prev.age || this.state.stageKey !== prev.stageKey) {
      const { avatar, age, stageKey } = this.state;
      this.frames = {
        base: composeAvatar(avatar, age, stageKey),
        blink: composeAvatar(avatar, age, stageKey, { blink: true }),
        step: composeAvatar(avatar, age, stageKey, { step: true }),
      };
    }
    // 連結的家人（最多 3 位），眨眼時間各自錯開
    if (this.state.companions !== prev.companions) {
      this.companionActors = (this.state.companions || []).slice(0, 3).map((c, i) => ({
        base: composeAvatar(c.avatar, c.age, c.stageKey),
        blink: composeAvatar(c.avatar, c.age, c.stageKey, { blink: true }),
        step: composeAvatar(c.avatar, c.age, c.stageKey, { step: true }),
        blinkOffset: 1700 + i * 1300,
      }));
    }
    if (this.state.pets !== prev.pets) {
      this.petActors = (this.state.pets || []).map((pet, i) => {
        const old = this.petActors[i];
        return { ...pet, x: old && old.type === pet.type ? old.x : this.actor.x + (i ? 19 : -11), dir: 1, frame: 0, frameAt: 0 };
      });
    }
    this.draw(performance.now());
  }

  start() {
    if (this.running || document.hidden || !this.visible) return;
    this.running = true;
    if (reduceMotion()) {
      this.draw(performance.now());
      this.timer = setInterval(() => this.draw(performance.now()), 60000);
      return;
    }
    const loop = (now) => {
      if (!this.running) return;
      if (now - this.last >= 1000 / FPS) {
        const dt = Math.min(0.5, (now - (this.last || now)) / 1000);
        this.last = now;
        this.tick(now, dt);
        this.draw(now);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
  }

  // 家人站在小人的哪一邊：靠左時站右邊，靠右時站左邊；沒有家人回傳 0
  companionSide() {
    if (!this.companionActors.length) return 0;
    return this.actor.x > 60 ? -1 : 1;
  }

  // ---------- 互動 ----------
  onTap(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const top = FEET + 1 - AVATAR_H;
    if (x >= this.actor.x - 2 && x <= this.actor.x + 18 && y >= top - 2 && y <= FEET + 2) {
      this.jump(1);
      const list = this.state.messages();
      if (list.length) this.say(list[Math.floor(Math.random() * list.length)]);
    }
  }

  jump(times = 1) {
    if (reduceMotion()) return;
    this.actor.jumpAt = this.now || performance.now();
    this.actor.jumpsLeft = times;
    this.actor.mode = 'idle';
    this.actor.until = this.actor.jumpAt + 1500;
  }

  // 記下一筆後：開心跳兩下、冒愛心；☆ 再加一小朵煙火
  celebrate({ star = false } = {}) {
    if (reduceMotion()) return;
    this.jump(2);
    const cx = this.actor.x + 8;
    const now = this.now || performance.now();
    for (let i = 0; i < 3; i++) {
      this.particles.push({ type: 'heart', x: cx - 4 + i * 4, y: FEET - AVATAR_H - 2, vy: -6 - i, born: now + i * 200, life: 1600 });
    }
    if (star) this.burst(cx, 12, now + 300);
  }

  burst(x, y, at) {
    const colors = ['#ffd36b', '#f6b3c8', '#9fd3ff', '#b8f0a8'];
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      this.particles.push({ type: 'spark', x, y, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, born: at, life: 900, color: colors[i % colors.length] });
    }
  }

  say(text) {
    const b = this.bubble;
    b.textContent = text;
    const rect = this.canvas.getBoundingClientRect();
    const px = ((this.actor.x + 8) / W) * rect.width;
    b.style.left = `${clamp(px, 70, rect.width - 70)}px`;
    b.style.bottom = `${((H - (FEET - AVATAR_H)) / H) * rect.height + 4}px`;
    b.classList.add('show');
    clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => b.classList.remove('show'), 3200);
  }

  // ---------- 每一格的狀態更新 ----------
  tick(now, dt) {
    this.now = now;
    const a = this.actor;

    // 散步：發呆幾秒 → 走到附近另一個點 → 再發呆
    if (a.mode === 'idle' && now > a.until && a.jumpsLeft === 0) {
      if (Math.random() < 0.6) {
        let t = a.x;
        while (Math.abs(t - a.x) < 4) t = 42 + Math.floor(Math.random() * 26);
        a.target = t;
        a.dir = t > a.x ? 1 : -1;
        a.mode = 'walk';
      } else {
        a.until = now + 3000 + Math.random() * 4000;
      }
    }
    if (a.mode === 'walk') {
      a.x += a.dir * 7 * dt;
      if ((a.dir > 0 && a.x >= a.target) || (a.dir < 0 && a.x <= a.target)) {
        a.x = a.target;
        a.mode = 'idle';
        a.step = false;
        a.until = now + 3000 + Math.random() * 5000;
      } else if (now > a.stepAt) {
        a.step = !a.step;
        a.stepAt = now + 250;
      }
    }
    if (now > a.blinkAt) { a.blinkUntil = now + 160; a.blinkAt = now + 2500 + Math.random() * 3000; }

    // 寵物：跟在小人旁邊（魚缸固定在左邊），走路時兩格交替，停下來偶爾搖尾巴
    this.petActors.forEach((p, i) => {
      if (p.type === 'fish') { if (now > p.frameAt) { p.frame = 1 - p.frame; p.frameAt = now + 1500; } return; }
      // 家人站在一邊時，寵物走另一邊
      const side = this.companionSide();
      const target = a.x + (side === 0 ? (i === 0 ? -11 : 19) : side > 0 ? -11 - i * 11 : 19 + i * 11);
      const diff = target - p.x;
      if (Math.abs(diff) > 1) {
        p.x += Math.sign(diff) * Math.min(Math.abs(diff), 9 * dt);
        p.dir = Math.sign(diff);
        if (now > p.frameAt) { p.frame = 1 - p.frame; p.frameAt = now + 200; }
      } else {
        p.dir = a.dir;
        if (now > p.frameAt) { p.frame = 1 - p.frame; p.frameAt = now + (p.frame ? 300 : 1200 + Math.random() * 1500); }
      }
    });

    // 鳥：白天、沒下大雨時偶爾飛過
    const w = this.state.weather;
    const wet = w && ['rain', 'heavyrain', 'thunder', 'snow'].includes(w.kind);
    if (now > this.birdAt) {
      if (this.light > 0.6 && !wet) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const n = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) this.ambient.push({ type: 'bird', x: dir > 0 ? -6 - i * 6 : W + 6 + i * 6, y: 8 + Math.random() * 10 + i * 2, vx: dir * 12, born: now });
      }
      this.birdAt = now + 18000 + Math.random() * 17000;
    }

    // 天氣粒子
    const want = !w ? 0 : { drizzle: 10, rain: 28, heavyrain: 55, thunder: 55, snow: 26 }[w.kind] || 0;
    while (this.weatherDrops.length < want) this.weatherDrops.push(this.newDrop(w.kind, true));
    if (this.weatherDrops.length > want) this.weatherDrops.length = want;
    for (const d of this.weatherDrops) {
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      if (d.y > H || d.x < -2 || d.x > W + 2) Object.assign(d, this.newDrop(w.kind, false));
    }

    // 季節小東西：春天花瓣、秋天落葉、夏夜螢火蟲
    const season = this.season;
    const wantAmbient = wet ? 0 : season === 'spring' || season === 'autumn' ? 5 : season === 'summer' && this.light < 0.3 ? 6 : 0;
    const kind = season === 'summer' ? 'firefly' : season === 'spring' ? 'petal' : 'leaf';
    const mine = this.ambient.filter((p) => p.type === kind);
    if (mine.length < wantAmbient) this.ambient.push(this.newAmbient(kind, now));
    for (const p of this.ambient) {
      if (p.type === 'bird') p.x += p.vx * dt;
      if (p.type === 'petal' || p.type === 'leaf') { p.x += p.vx * dt; p.y += p.vy * dt; p.x += Math.sin(now / 600 + p.seed) * 0.15; }
      if (p.type === 'firefly') { p.x += Math.sin(now / 1500 + p.seed) * 0.2; p.y += Math.cos(now / 1700 + p.seed) * 0.1; }
    }
    // 飄出畫面的移除；季節換了或開始下雨，就只留下鳥
    this.ambient = this.ambient.filter((p) => p.x > -12 && p.x < W + 12 && (p.type === 'bird' || p.type === 'firefly' || p.y < 46)
      && (p.type === 'bird' || (p.type === kind && wantAmbient > 0)));

    // 跨年夜的小煙火（安靜的那種，不閃爍整個畫面）
    if (this.festival === 'newyear' && this.light < 0.3 && now > this.fireworkAt) {
      this.burst(20 + Math.random() * 80, 6 + Math.random() * 10, now);
      this.fireworkAt = now + 5000 + Math.random() * 6000;
    }

    for (const p of this.particles) {
      if (now < p.born) continue;
      const s = dt;
      p.x += (p.vx || 0) * s;
      p.y += (p.vy || 0) * s;
      if (p.type === 'spark') p.vy += 6 * s;
    }
    this.particles = this.particles.filter((p) => now < p.born + p.life);
  }

  newDrop(kind, anywhere) {
    const snow = kind === 'snow';
    return {
      x: Math.random() * (W + 20) - 10,
      y: anywhere ? Math.random() * H : -3,
      vy: snow ? 6 + Math.random() * 4 : kind === 'drizzle' ? 26 + Math.random() * 6 : 45 + Math.random() * 15,
      vx: snow ? (Math.random() - 0.5) * 3 : -6,
      len: snow ? 1 : kind === 'drizzle' ? 1 : 2,
    };
  }

  newAmbient(type, now) {
    const seed = Math.random() * 10;
    if (type === 'firefly') return { type, x: 6 + Math.random() * 60, y: 34 + Math.random() * 9, seed, born: now };
    // 花瓣和落葉從樹上飄下來（樹冠在左邊 x 14–25、y 25–31），隨風往右飄
    return { type, x: 15 + Math.random() * 10, y: 26 + Math.random() * 5, vx: 2 + Math.random() * 3, vy: 1.5 + Math.random() * 1.5, seed, born: now };
  }

  // ---------- 畫面 ----------
  draw(now) {
    const ctx = this.ctx;
    const st = this.state;
    const date = new Date();
    const hour = date.getHours() + date.getMinutes() / 60;
    const w = st.weather;
    const def = defaultSun(date);
    const sr = (w && toHour(w.sunrise)) || def.sunrise;
    const ss = (w && toHour(w.sunset)) || def.sunset;
    let light = daylight(hour, sr, ss);
    const grey = !w ? 0 : { cloudy: 0.15, overcast: 0.4, fog: 0.45, drizzle: 0.45, rain: 0.55, heavyrain: 0.65, thunder: 0.75, snow: 0.35 }[w.kind] || 0;
    if (grey > 0.3) light *= 0.85;
    this.light = light;
    this.season = seasonOf(date);
    this.festival = festivalOf(date, st.birthday);
    const sc = SEASON_COLORS[this.season];
    const dim = (c, k = 0.6) => mix(c, '#141a33', (1 - light) * k);
    const t = now || 0;

    // 讓測試和樣式知道目前狀態
    const box = this.canvas.parentElement;
    if (box) Object.assign(box.dataset, { period: light > 0.6 ? 'day' : light > 0.05 ? 'twilight' : 'night', season: this.season, weather: w ? w.kind : 'none', festival: this.festival || 'none', companions: String(this.companionActors.length), pets: String(this.petActors.length) });

    // 天空（分成 10 條色帶，保留像素感）
    let [top, mid, bottom] = skyAt(hour, sr, ss);
    if (grey) { top = mix(top, light > 0.3 ? '#8d96a3' : '#1d2333', grey); mid = mix(mid, light > 0.3 ? '#a3abb6' : '#262d40', grey); bottom = mix(bottom, light > 0.3 ? '#b7bec7' : '#2e3548', grey); }
    const band = (y) => { const i = clamp(Math.floor((y * 10) / 42), 0, 9); const f = i / 9; return f < 0.5 ? mix(top, mid, f * 2) : mix(mid, bottom, (f - 0.5) * 2); };
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = band(Math.ceil((i * 42) / 10));
      ctx.fillRect(0, Math.floor((i * 42) / 10), W, 5);
    }

    // 星星（會慢慢閃）
    if (light < 0.5 && grey < 0.4) {
      const r = rng(date.getFullYear() * 1000 + dayOfYear(date));
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(r() * W);
        const y = Math.floor(r() * 26);
        const tw = Math.floor(t / 700 + i * 1.7) % 5 === 0;
        ctx.fillStyle = mix(tw ? '#ffffff' : '#aeb9e6', top, light * 2);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // 太陽沿弧線移動；晚上換月亮（有月相）
    const bigMoon = this.festival === 'midautumn';
    if (hour > sr - 0.3 && hour < ss + 0.3 && grey < 0.5) {
      const p = clamp((hour - sr) / (ss - sr), 0, 1);
      const x = Math.round(8 + p * (W - 20));
      const y = Math.round(4 + 22 * (1 - Math.sin(Math.PI * p)));
      const color = mix('#ff9a4d', '#ffe27a', Math.sin(Math.PI * p));
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y, 4, 6); ctx.fillRect(x, y + 1, 6, 4);
    } else if (light < 0.4) {
      const nightLen = 24 - (ss - sr);
      const p = clamp(((hour - ss + 24) % 24) / nightLen, 0, 1);
      const x = Math.round(8 + p * (W - 22));
      const y = Math.round(4 + 18 * (1 - Math.sin(Math.PI * p)));
      const size = bigMoon ? 8 : 6;
      const phase = bigMoon ? 0.5 : moonPhase(date);
      ctx.fillStyle = bigMoon ? '#ffe9a8' : '#f3e9c6';
      ctx.fillRect(x + 1, y, size - 2, size); ctx.fillRect(x, y + 1, size, size - 2);
      // 月相：用天空色蓋掉一部分
      const lit = Math.abs(phase - 0.5) * 2; // 0 滿月、1 新月
      if (lit > 0.08) {
        const cover = Math.round(lit * size);
        ctx.fillStyle = band(y + 2);
        const fromLeft = phase < 0.5;
        ctx.fillRect(fromLeft ? x : x + size - cover, y, cover, size);
      }
      if (bigMoon) { ctx.fillStyle = '#d9c78a'; ctx.fillRect(x + 4, y + 3, 1, 2); ctx.fillRect(x + 3, y + 5, 2, 1); } // 月兔
    }

    // 雲（雲量跟著真實天氣）
    const cloudN = !w ? 2 : clamp(Math.round((w.cloud ?? 30) / 22), 1, 5);
    const cloudColor = mix(light > 0.3 ? '#ffffff' : '#5a6380', '#9aa2ad', grey);
    const cloudShade = mix(cloudColor, '#8d96a3', 0.5);
    for (let i = 0; i < cloudN; i++) {
      const tpl = CLOUDS[i % 3];
      const span = W + 30;
      const x = Math.floor((((i * 47 + (t / 1000) * (0.6 + i * 0.25)) % span) + span) % span) - 18;
      sprite(ctx, tpl, x, 3 + ((i * 5) % 16), { x: cloudColor, y: cloudShade });
    }

    // 遠山
    const farHill = dim(this.season === 'autumn' ? '#a8b07a' : '#9cc48a', 0.7);
    const nearHill = dim(this.season === 'autumn' ? '#8e9a5a' : '#7aa86a', 0.7);
    for (let x = 0; x < W; x += 3) {
      const h1 = 7 + Math.round(3 * Math.sin(x / 13) + 2 * Math.sin(x / 5));
      ctx.fillStyle = farHill; ctx.fillRect(x, 42 - h1 - 3, 3, h1 + 3);
      const h2 = 4 + Math.round(2 * Math.sin(x / 9 + 1) + Math.sin(x / 4));
      ctx.fillStyle = nearHill; ctx.fillRect(x, 42 - h2, 3, h2);
    }

    this.drawBuilding(st.stageKey, light, dim, t);
    this.drawTree(14, sc, dim, t);

    // 地面
    ctx.fillStyle = dim(sc.grass); ctx.fillRect(0, 42, W, 3);
    ctx.fillStyle = dim('#d8c59a'); ctx.fillRect(0, 45, W, 3);
    ctx.fillStyle = dim(sc.fore); ctx.fillRect(0, 48, W, 2);
    if (this.season === 'spring') for (let x = 3; x < W; x += 11) { ctx.fillStyle = dim(x % 2 ? '#f6b3c8' : '#ffe27a'); ctx.fillRect(x, 43, 1, 1); }

    // 節日道具（地面）
    if (this.festival === 'birthday') {
      sprite(ctx, ['..y..', 'xxxxx', 'wwwww', 'xxxxx'], 32, 43, { x: '#f6b3c8', w: '#fff5e8', y: '#ffd36b' });
      const bx = Math.round(this.actor.x) - 4;
      const sway = Math.floor(t / 900) % 2;
      [['#e0607e', 0], ['#ffd36b', 4], ['#9fd3ff', 8]].forEach(([c, dx], i) => {
        const x = bx + dx - 6 + (i === 1 ? sway : -sway);
        ctx.fillStyle = c; ctx.fillRect(x, 12 + i, 3, 4); ctx.fillRect(x + 1, 11 + i, 1, 1);
        ctx.fillStyle = '#d9dbe0'; for (let y = 16 + i; y < 30; y += 2) ctx.fillRect(x + 1, y, 1, 1);
      });
    }

    // 今年標籤的小道具
    // 放在右邊建築物前，讓出小人和寵物走動的地方
    const slots = [88, 96, 104];
    st.props.forEach((name, i) => {
      const pr = PROP_SPRITES[name];
      const bob = name === 'heart' ? Math.floor(t / 600) % 2 : 0;
      sprite(ctx, pr.rows, slots[i], 43 - bob, pr.colors);
    });

    // 小人
    const a = this.actor;
    let jumpY = 0;
    if (a.jumpsLeft > 0 && a.jumpAt >= 0) {
      const p = (t - a.jumpAt) / 550;
      if (p >= 1) { a.jumpsLeft -= 1; a.jumpAt = a.jumpsLeft > 0 ? t : -1; } else jumpY = Math.round(5 * Math.sin(Math.PI * clamp(p, 0, 1)));
    }
    if (this.frames) {
      const frame = a.mode === 'walk' && a.step ? this.frames.step : t < a.blinkUntil ? this.frames.blink : this.frames.base;
      const breathe = a.mode === 'idle' && jumpY === 0 && Math.floor(t / 800) % 2 === 1;
      // 影子
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(Math.round(a.x) + 3, FEET + 1, 10, 1);
      // 家人：站在旁邊一起走、一起跳
      const side = this.companionSide();
      this.companionActors.forEach((c, i) => {
        const cx = clamp(Math.round(a.x) + side * 15 * (i + 1), 0, W - 16);
        const cFrame = a.mode === 'walk' && !a.step ? c.step : (t + c.blinkOffset) % 4300 < 160 ? c.blink : c.base;
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(cx + 3, FEET + 1, 10, 1);
        drawAvatar(ctx, cFrame, cx, FEET + 1 - AVATAR_H - jumpY, { flip: a.dir < 0, breathe: a.mode === 'idle' && jumpY === 0 && Math.floor((t + i * 400) / 800) % 2 === 0 });
      });
      drawAvatar(ctx, frame, Math.round(a.x), FEET + 1 - AVATAR_H - jumpY, { flip: a.dir < 0, breathe });
    }

    // 寵物
    for (const p of this.petActors) {
      const [, ph] = petSize(p.type);
      if (p.type === 'fish') { drawPet(ctx, 'fish', p.color, 4, FEET - 6, p.frame); continue; }
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(Math.round(p.x) + 1, FEET + 1, petSize(p.type)[0] - 2, 1);
      // 主人開心跳的時候，寵物也跟著跳一半高
      drawPet(ctx, p.type, p.color, Math.round(p.x), FEET + 1 - ph - (jumpY > 0 ? Math.ceil(jumpY / 2) : 0), p.frame, p.dir < 0);
    }

    // 季節小東西、鳥
    for (const p of this.ambient) {
      if (p.type === 'bird') {
        const up = Math.floor((t - p.born) / 250) % 2;
        ctx.fillStyle = dim('#2b2f3a', 0.3);
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        if (up) { ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x + 1, y + 1, 1, 1); }
        else { ctx.fillRect(x, y + 1, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x + 2, y + 1, 1, 1); }
      } else if (p.type === 'firefly') {
        if (Math.floor(t / 400 + p.seed * 3) % 4 !== 0) { ctx.fillStyle = '#e8f57a'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      } else {
        ctx.fillStyle = p.type === 'petal' ? '#f6b3c8' : Math.floor(p.seed) % 2 ? '#d9822b' : '#c2452f';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    }

    // 愛心、煙火
    for (const p of this.particles) {
      if (t < p.born) continue;
      const age = (t - p.born) / p.life;
      if (p.type === 'heart') {
        sprite(ctx, ['x.x', 'xxx', '.x.'], Math.round(p.x), Math.round(p.y), { x: age > 0.7 ? '#f29bb0' : '#e0607e' });
      } else {
        ctx.fillStyle = age > 0.6 ? mix(p.color, top, (age - 0.6) * 2.5) : p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    }

    // 天氣（前景）
    if (w) {
      const rainColor = light > 0.3 ? 'rgba(220,235,250,0.75)' : 'rgba(160,180,220,0.6)';
      ctx.fillStyle = w.kind === 'snow' ? '#ffffff' : rainColor;
      for (const d of this.weatherDrops) ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, d.len);
      if (w.kind === 'fog') {
        ctx.fillStyle = 'rgba(220,225,232,0.22)';
        for (let i = 0; i < 3; i++) {
          const x = Math.floor(((t / 400 + i * 40) % (W + 60)) - 60);
          ctx.fillRect(x, 26 + i * 6, 60, 4);
          ctx.fillRect(x - W - 60, 26 + i * 6, 60, 4);
        }
      }
    }

    // 過年燈籠（從畫面上方垂下來，輕輕晃）
    if (this.festival === 'lny') {
      [10, 104].forEach((x0, i) => {
        const sway = Math.floor(t / 1100 + i) % 2;
        const x = x0 + sway;
        ctx.fillStyle = '#7a2a1a'; ctx.fillRect(x + 2, 0, 1, 3);
        sprite(ctx, ['.ggg.', 'rrrrr', 'rrrrr', 'rrrrr', '.ggg.', '..g..', '..g..'], x, 3, { r: '#e0473a', g: '#ffd36b' });
      });
    }
  }

  drawTree(x0, sc, dim, t) {
    const ctx = this.ctx;
    ctx.fillStyle = dim('#6b4226');
    ctx.fillRect(x0 + 4, 32, 3, 10);
    const sway = Math.floor(t / 1300) % 2;
    CANOPY.forEach((row, dy) => {
      const off = dy < 3 ? sway : 0;
      for (let dx = 0; dx < row.length; dx++) {
        const ch = row[dx];
        if (ch === '.') continue;
        const bloom = sc.bloom && (dx * 7 + dy * 3) % 9 === 0;
        ctx.fillStyle = dim(bloom ? sc.bloom : ch === 'y' ? sc.light : sc.leaf);
        ctx.fillRect(x0 + dx + off, 25 + dy, 1, 1);
      }
    });
    // 小樹叢（一年四季都是綠的）
    sprite(ctx, ['.xxxx.', 'xxyxxx', 'xxxxxx'], x0 + 16, 39, { x: dim('#4f9a3c'), y: dim('#6cbf55') });
  }

  drawBuilding(stageKey, light, dim, t) {
    const ctx = this.ctx;
    const night = light < 0.35;
    // 晚上的窗戶大多亮著，每隔一陣子有幾格換開關
    const slot = Math.floor(t / 20000);
    const win = (i) => (night ? ((i * 7 + slot * 3) % 5 !== 0 ? '#ffd36b' : '#3a4466') : dim('#9cc4e4', 0.5));
    const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

    if (stageKey === 'baby' || stageKey === 'kinder') {
      R(74, 30, 24, 12, dim('#e3cfa8'));
      for (let i = 0; i < 7; i++) R(72 + i * 2, 29 - i, 28 - i * 4, 1, dim('#b0573a'));
      R(84, 35, 4, 7, dim('#6b4226'));
      R(77, 33, 4, 4, win(1)); R(91, 33, 4, 4, win(2));
      R(94, 20, 3, 6, dim('#8a5a4a')); // 煙囪
      if (!night && Math.floor(t / 900) % 3 !== 0) { ctx.fillStyle = 'rgba(230,230,235,0.7)'; ctx.fillRect(95, 18 - (Math.floor(t / 900) % 3), 2, 1); }
    } else if (['elementary', 'junior', 'senior'].includes(stageKey)) {
      R(68, 26, 44, 16, dim('#ece5d6')); R(68, 25, 44, 1, dim('#b5a98f'));
      R(86, 19, 6, 7, dim('#ece5d6')); R(88, 21, 2, 2, '#26262e');
      let i = 0;
      for (let c = 0; c < 7; c++) for (let r = 0; r < 2; r++) if (!(c === 3 && r === 1)) R(70 + c * 6, 28 + r * 6, 3, 3, win(i++));
      R(87, 35, 4, 7, dim('#6b4226'));
      R(114, 14, 1, 28, dim('#8e939a'));
      const wave = Math.floor(t / 500) % 2;
      R(115, 14 + wave, 4, 1, '#e0607e'); R(115, 15, 4, 1, '#e0607e'); R(115, 16 - wave, 3, 1, '#e0607e');
    } else if (stageKey === 'college') {
      R(72, 24, 34, 18, dim('#cdb9a2')); R(70, 23, 38, 1, dim('#8b6f55'));
      for (let c = 0; c < 5; c++) R(75 + c * 6, 27, 3, 5, win(c));
      R(85, 34, 8, 8, dim('#4a3a2c')); R(86, 33, 6, 1, dim('#4a3a2c'));
      R(111, 32, 1, 10, dim('#6b4226')); R(108, 26, 7, 7, dim('#3f7a3a'));
    } else {
      const towers = [[66, 22, 9], [76, 13, 10], [87, 26, 7], [95, 17, 9], [105, 24, 11]];
      let i = 0;
      for (const [x, y, w] of towers) {
        R(x, y, w, 42 - y, night ? '#2b3350' : dim('#8a96a8'));
        for (let wy = y + 2; wy < 40; wy += 3) {
          for (let wx = x + 1; wx < x + w - 1; wx += 2) {
            i++;
            if ((wx * 7 + wy * 13) % 5 !== 0) R(wx, wy, 1, 1, night ? win(i) : dim('#c8d6e6', 0.5));
          }
        }
      }
    }

    // 聖誕節：屋頂上一串慢慢輪流亮的小燈
    if (this.festival === 'christmas') {
      const colors = ['#e0473a', '#ffd36b', '#5cc28a', '#9fd3ff'];
      const shift = Math.floor(t / 1000);
      for (let x = 66; x < 118; x += 3) R(x, 22 + ((x / 3) % 2), 1, 1, colors[(x / 3 + shift) % 4 | 0]);
    }
  }
}
