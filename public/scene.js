// 會動的像素場景：天空跟著真實時間與天氣變化，小人會呼吸、眨眼、散步
// 160×72 格；物件都有深色描邊與三階明暗，白天是清爽的粉彩色。約每秒 10 格，切到背景或捲出畫面就暫停；
// 系統開了「減少動態效果」就只每分鐘更新一次靜態畫面
import { composeAvatar, drawAvatar, W as AVATAR_W, H as AVATAR_H, OUTLINE } from './avatar.js';
import { drawPet, petSize, BOWL } from './pets.js';

export const W = 160;
export const H = 72;
const HORIZON = 52; // 草地開始的列
const FEET = 62; // 小人腳底所在列（在小路上）
const FPS = 10;
const WALK_MIN = 50;
const WALK_MAX = 84;

// ---------- 小工具 ----------
const hex = (c) => { const n = parseInt(c.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
export function mix(a, b, t) {
  const x = hex(a);
  const y = hex(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#000000', t);
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

// 像素圓
function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y + r * 0.6));
    ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
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
  night: ['#1b2350', '#283468', '#3a4782'],
  dawn: ['#7a78b6', '#e3a3b8', '#fbd8bc'],
  morning: ['#a6cdee', '#d2e8f4', '#fbefd8'],
  day: ['#a3d5f2', '#c8e7f7', '#eef8f2'],
  golden: ['#9dbbe0', '#f6c9a2', '#fde6ba'],
  dusk: ['#76699f', '#e09ab2', '#f8c3a0'],
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

// ---------- 雲（用幾個圓疊出形狀，再上三階明暗） ----------
const CLOUD_SHAPES = [
  [[6, 5, 4], [12, 4, 5], [18, 6, 3]],
  [[5, 6, 4], [11, 4, 6], [19, 5, 5], [26, 7, 3]],
  [[5, 4, 3], [10, 3, 4], [15, 5, 3]],
];
const cloudMasks = CLOUD_SHAPES.map((circles) => {
  const w = Math.max(...circles.map(([x, , r]) => x + r + 1));
  const bottom = Math.max(...circles.map(([, cy]) => cy)) + 1; // 雲底切平
  const m = Array.from({ length: bottom + 1 }, () => Array(w).fill(false));
  for (let y = 0; y <= bottom; y++) for (let x = 0; x < w; x++) m[y][x] = circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);
  return m;
});

function drawCloud(ctx, mask, x, y, base, light, shadow) {
  for (let dy = 0; dy < mask.length; dy++) {
    for (let dx = 0; dx < mask[0].length; dx++) {
      if (!mask[dy][dx]) continue;
      const up = dy > 0 && mask[dy - 1][dx];
      const down = dy < mask.length - 1 && mask[dy + 1][dx];
      ctx.fillStyle = !up ? light : !down ? shadow : base;
      ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  }
}

const SEASON_COLORS = {
  spring: { leaf: '#8fd07a', light: '#b8e8a2', dark: '#68b35c', bloom: '#ffbfd2', grass: '#bde6a2', grassDark: '#99d083', fore: '#acdc90' },
  summer: { leaf: '#72c268', light: '#9edc8a', dark: '#52a352', bloom: null, grass: '#addd90', grassDark: '#88c874', fore: '#9bd481' },
  autumn: { leaf: '#f2a65a', light: '#f9cb8c', dark: '#d8823e', bloom: '#e66a4a', grass: '#d3da9c', grassDark: '#b7c47e', fore: '#c5d18c' },
  winter: { leaf: '#8fb79c', light: '#b4d3bb', dark: '#6e987d', bloom: null, grass: '#c8e0c4', grassDark: '#a9c8a6', fore: '#b9d6b5' },
};

// 今年標籤的小道具（含描邊）
const PROP_SPRITES = {
  heart: { rows: ['.o.o.', 'oxoxo', 'oxxxo', '.oxo.', '..o..'], colors: { x: '#e0607e', o: OUTLINE } },
  book: { rows: ['ooooooo', 'oxxwxxo', 'oxxwxxo', 'oxxwxxo', 'ooooooo'], colors: { x: '#3f7fd1', w: '#f5f0e6', o: OUTLINE } },
  suitcase: { rows: ['..ooo..', 'ooyoyoo', 'oxxxxxo', 'oyyyyyo', 'oxxxxxo', 'ooooooo'], colors: { x: '#9a6634', y: '#d9a45b', o: OUTLINE } },
  ball: { rows: ['.ooo.', 'oxwxo', 'owxwo', 'oxwxo', '.ooo.'], colors: { x: '#e05a3a', w: '#ffffff', o: OUTLINE } },
};

const HEART = ['.o.o.', 'oxoxo', 'oxxxo', '.oxo.', '..o..'];
const LANTERN = ['.ooooo.', 'oggggg' + 'o', 'orrrrro', 'orwrrro', 'orrrrro', 'oggggg' + 'o', '.ooooo.', '...g...', '...g...'];
const BALLOON = ['.ooo.', 'oxwxo', 'oxxxo', 'oxxxo', '.ooo.', '..o..'];
const CAKE = ['...y...', '...o...', 'ooooooo', 'oxxxxxo', 'owwwwwo', 'oxxxxxo', 'ooooooo'];
const BUSH = ['.oooo.', 'oyxxxo', 'oxxxxo', 'oooooo'];

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
    this.frames = null;
    this.companionActors = [];
    this.petActors = [];
    this.actor = { x: 62, target: 62, dir: 1, mode: 'idle', until: 0, stepAt: 0, step: false, blinkAt: 2000, blinkUntil: 0, jumpAt: -1, jumpsLeft: 0 };
    this.particles = [];
    this.weatherDrops = [];
    this.ambient = [];
    this.birdAt = 8000;
    this.fireworkAt = 4000;
    this.visible = true;
    this.running = false;
    this.last = 0;
    this.now = 0;
    this.light = 1;
    this.roofLines = []; // 每棟建築的屋頂邊緣 [x1, x2, y]，聖誕燈掛在這裡

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
    const st = this.state;
    if (!this.frames || st.avatar !== prev.avatar || st.age !== prev.age || st.stageKey !== prev.stageKey) {
      this.frames = {
        base: composeAvatar(st.avatar, st.age, st.stageKey),
        blink: composeAvatar(st.avatar, st.age, st.stageKey, { blink: true }),
        step: composeAvatar(st.avatar, st.age, st.stageKey, { step: true }),
      };
    }
    // 連結的家人（最多 3 位），眨眼時間各自錯開
    if (st.companions !== prev.companions) {
      this.companionActors = (st.companions || []).slice(0, 3).map((c, i) => ({
        base: composeAvatar(c.avatar, c.age, c.stageKey),
        blink: composeAvatar(c.avatar, c.age, c.stageKey, { blink: true }),
        step: composeAvatar(c.avatar, c.age, c.stageKey, { step: true }),
        blinkOffset: 1700 + i * 1300,
      }));
    }
    if (st.pets !== prev.pets) {
      this.petActors = (st.pets || []).map((pet, i) => {
        const old = this.petActors[i];
        return { ...pet, x: old && old.type === pet.type ? old.x : this.actor.x + (i ? AVATAR_W : -16), dir: 1, frame: 0, frameAt: 0 };
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
    return this.actor.x > (WALK_MIN + WALK_MAX) / 2 ? -1 : 1;
  }

  // ---------- 互動 ----------
  onTap(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const top = FEET - AVATAR_H + 2;
    if (x >= this.actor.x && x <= this.actor.x + AVATAR_W && y >= top - 2 && y <= FEET + 2) {
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
    const cx = this.actor.x + AVATAR_W / 2;
    const now = this.now || performance.now();
    for (let i = 0; i < 3; i++) {
      this.particles.push({ type: 'heart', x: cx - 7 + i * 5, y: FEET - AVATAR_H, vy: -6 - i, born: now + i * 200, life: 1600 });
    }
    if (star) this.burst(cx, 16, now + 300);
  }

  burst(x, y, at) {
    const colors = ['#ffd36b', '#f6b3c8', '#9fd3ff', '#b8f0a8'];
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14;
      this.particles.push({ type: 'spark', x, y, vx: Math.cos(a) * 12, vy: Math.sin(a) * 12, born: at, life: 900, color: colors[i % colors.length] });
    }
  }

  say(text) {
    const b = this.bubble;
    b.textContent = text;
    const rect = this.canvas.getBoundingClientRect();
    const px = ((this.actor.x + AVATAR_W / 2) / W) * rect.width;
    b.style.left = `${clamp(px, 70, rect.width - 70)}px`;
    b.style.bottom = `${((H - (FEET - AVATAR_H + 2)) / H) * rect.height + 4}px`;
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
        while (Math.abs(t - a.x) < 5) t = WALK_MIN + Math.floor(Math.random() * (WALK_MAX - WALK_MIN));
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

    // 寵物：跟在小人旁邊（家人站一邊時走另一邊；魚缸固定），走路時兩格交替，停下來偶爾搖尾巴
    const side = this.companionSide();
    this.petActors.forEach((p, i) => {
      if (p.type === 'fish') { if (now > p.frameAt) { p.frame = 1 - p.frame; p.frameAt = now + 1500; } return; }
      const target = a.x + (side === 0 ? (i === 0 ? -16 : AVATAR_W) : side > 0 ? -16 - i * 16 : AVATAR_W + i * 16);
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
        for (let i = 0; i < n; i++) this.ambient.push({ type: 'bird', x: dir > 0 ? -6 - i * 7 : W + 6 + i * 7, y: 10 + Math.random() * 14 + i * 3, vx: dir * 14, born: now });
      }
      this.birdAt = now + 18000 + Math.random() * 17000;
    }

    // 天氣粒子
    const want = !w ? 0 : { drizzle: 14, rain: 40, heavyrain: 75, thunder: 75, snow: 36 }[w.kind] || 0;
    while (this.weatherDrops.length < want) this.weatherDrops.push(this.newDrop(w.kind, true));
    if (this.weatherDrops.length > want) this.weatherDrops.length = want;
    for (const d of this.weatherDrops) {
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      if (d.y > H || d.x < -2 || d.x > W + 2) Object.assign(d, this.newDrop(w.kind, false));
    }

    // 季節小東西：春天花瓣、秋天落葉、夏夜螢火蟲
    const season = this.season;
    const wantAmbient = wet ? 0 : season === 'spring' || season === 'autumn' ? 6 : season === 'summer' && this.light < 0.3 ? 8 : 0;
    const kind = season === 'summer' ? 'firefly' : season === 'spring' ? 'petal' : 'leaf';
    const mine = this.ambient.filter((p) => p.type === kind);
    if (mine.length < wantAmbient) this.ambient.push(this.newAmbient(kind, now));
    for (const p of this.ambient) {
      if (p.type === 'bird') p.x += p.vx * dt;
      if (p.type === 'petal' || p.type === 'leaf') { p.x += p.vx * dt; p.y += p.vy * dt; p.x += Math.sin(now / 600 + p.seed) * 0.15; }
      if (p.type === 'firefly') { p.x += Math.sin(now / 1500 + p.seed) * 0.2; p.y += Math.cos(now / 1700 + p.seed) * 0.1; }
    }
    // 飄出畫面的移除；季節換了或開始下雨，就只留下鳥
    this.ambient = this.ambient.filter((p) => p.x > -12 && p.x < W + 12 && (p.type === 'bird' || p.type === 'firefly' || p.y < FEET + 2)
      && (p.type === 'bird' || (p.type === kind && wantAmbient > 0)));

    // 跨年夜的小煙火（安靜的那種，不閃爍整個畫面）
    if (this.festival === 'newyear' && this.light < 0.3 && now > this.fireworkAt) {
      this.burst(24 + Math.random() * 110, 8 + Math.random() * 14, now);
      this.fireworkAt = now + 5000 + Math.random() * 6000;
    }

    for (const p of this.particles) {
      if (now < p.born) continue;
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      if (p.type === 'spark') p.vy += 6 * dt;
    }
    this.particles = this.particles.filter((p) => now < p.born + p.life);
  }

  newDrop(kind, anywhere) {
    const snow = kind === 'snow';
    return {
      x: Math.random() * (W + 20) - 10,
      y: anywhere ? Math.random() * H : -3,
      vy: snow ? 7 + Math.random() * 4 : kind === 'drizzle' ? 30 + Math.random() * 6 : 55 + Math.random() * 15,
      vx: snow ? (Math.random() - 0.5) * 3 : -7,
      len: snow ? 1 : kind === 'drizzle' ? 2 : 3,
      big: snow && Math.random() < 0.3,
    };
  }

  newAmbient(type, now) {
    const seed = Math.random() * 10;
    if (type === 'firefly') return { type, x: 6 + Math.random() * 84, y: 42 + Math.random() * 14, seed, born: now };
    // 花瓣和落葉從圓樹上飄下來，隨風往右
    return { type, x: 30 + Math.random() * 14, y: 28 + Math.random() * 10, vx: 2 + Math.random() * 3, vy: 1.6 + Math.random() * 1.5, seed, born: now };
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
    // 夜晚把地面與建築染成藍灰色
    const dim = (c, k = 0.62) => mix(c, '#151b36', (1 - light) * k);
    const t = now || 0;

    // 讓測試和樣式知道目前狀態
    const box = this.canvas.parentElement;
    if (box) {
      Object.assign(box.dataset, {
        period: light > 0.6 ? 'day' : light > 0.05 ? 'twilight' : 'night', season: this.season, weather: w ? w.kind : 'none',
        festival: this.festival || 'none', companions: String(this.companionActors.length), pets: String(this.petActors.length),
      });
    }

    // ---- 天空：14 條色帶，交界用棋盤格混色 ----
    let [top, mid, bottom] = skyAt(hour, sr, ss);
    if (grey) {
      top = mix(top, light > 0.3 ? '#8d96a3' : '#1d2333', grey);
      mid = mix(mid, light > 0.3 ? '#a3abb6' : '#262d40', grey);
      bottom = mix(bottom, light > 0.3 ? '#b7bec7' : '#2e3548', grey);
    }
    const BANDS = 14;
    const bandColor = (i) => { const f = i / (BANDS - 1); return f < 0.5 ? mix(top, mid, f * 2) : mix(mid, bottom, (f - 0.5) * 2); };
    const bandH = HORIZON / BANDS;
    for (let i = 0; i < BANDS; i++) {
      ctx.fillStyle = bandColor(i);
      ctx.fillRect(0, Math.floor(i * bandH), W, Math.ceil(bandH) + 1);
      if (i < BANDS - 1) {
        ctx.fillStyle = bandColor(i + 1);
        const yb = Math.floor((i + 1) * bandH) - 1;
        for (let x = i % 2; x < W; x += 2) ctx.fillRect(x, yb, 1, 1);
      }
    }
    const skyAtY = (y) => bandColor(clamp(Math.floor(y / bandH), 0, BANDS - 1));

    // ---- 星星（會慢慢閃） ----
    if (light < 0.5 && grey < 0.4) {
      const r = rng(date.getFullYear() * 1000 + dayOfYear(date));
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(r() * W);
        const y = Math.floor(r() * 34);
        const bright = Math.floor(t / 700 + i * 1.7) % 6 === 0;
        ctx.fillStyle = mix(bright ? '#ffffff' : '#aeb9e6', skyAtY(y), light * 2);
        ctx.fillRect(x, y, 1, 1);
        if (bright && i % 3 === 0) { ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1); }
      }
    }

    // ---- 太陽沿弧線移動（有光暈）；晚上換月亮（有月相） ----
    const bigMoon = this.festival === 'midautumn';
    if (hour > sr - 0.3 && hour < ss + 0.3 && grey < 0.5) {
      const p = clamp((hour - sr) / (ss - sr), 0, 1);
      const cx = Math.round(12 + p * (W - 24));
      const cy = Math.round(9 + 26 * (1 - Math.sin(Math.PI * p)));
      const color = mix('#ff9a4d', '#ffe27a', Math.sin(Math.PI * p));
      ctx.globalAlpha = 0.25; disc(ctx, cx, cy, 7, lighten(color, 0.4)); ctx.globalAlpha = 1;
      disc(ctx, cx, cy, 4, color);
      ctx.fillStyle = lighten(color, 0.5); ctx.fillRect(cx - 2, cy - 2, 2, 1);
    } else if (light < 0.4) {
      const nightLen = 24 - (ss - sr);
      const p = clamp(((hour - ss + 24) % 24) / nightLen, 0, 1);
      const cx = Math.round(14 + p * (W - 28));
      const cy = Math.round(9 + 20 * (1 - Math.sin(Math.PI * p)));
      const r = bigMoon ? 6 : 4;
      const phase = bigMoon ? 0.5 : moonPhase(date);
      ctx.globalAlpha = 0.18; disc(ctx, cx, cy, r + 3, '#fff6d8'); ctx.globalAlpha = 1;
      disc(ctx, cx, cy, r, bigMoon ? '#ffe9a8' : '#f3e9c6');
      ctx.fillStyle = bigMoon ? '#e6cf86' : '#ddd2ae';
      ctx.fillRect(cx + 1, cy - 1, 2, 1); ctx.fillRect(cx - 2, cy + 1, 1, 1);
      // 月相：用天空色的圓蓋住一部分
      const lit = Math.abs(phase - 0.5) * 2; // 0 滿月、1 新月
      if (lit > 0.08) disc(ctx, cx + (phase < 0.5 ? -1 : 1) * Math.round((1 - lit) * r * 2 + 1), cy, r, skyAtY(cy));
      if (bigMoon) { ctx.fillStyle = '#d9c78a'; ctx.fillRect(cx - 1, cy, 1, 2); ctx.fillRect(cx - 2, cy + 2, 2, 1); } // 月兔
    }

    // ---- 雲（雲量跟著真實天氣） ----
    const cloudN = !w ? 3 : clamp(Math.round((w.cloud ?? 30) / 18), 1, 6);
    const cloudBase = mix(light > 0.3 ? '#ffffff' : '#5a6380', '#a3abb6', grey);
    const cloudLight = light > 0.3 ? lighten(cloudBase, 0.6) : mix(cloudBase, '#8a93b0', 0.4);
    const cloudShadow = mix(cloudBase, light > 0.3 ? mix(bottom, '#9aa6c4', 0.5) : '#2a3150', 0.45);
    for (let i = 0; i < cloudN; i++) {
      const mask = cloudMasks[i % cloudMasks.length];
      const span = W + 40;
      const x = Math.floor((((i * 53 + (t / 1000) * (0.5 + i * 0.22)) % span) + span) % span) - 30;
      drawCloud(ctx, mask, x, 3 + ((i * 7) % 22), cloudBase, cloudLight, cloudShadow);
    }

    // ---- 遠景：淡淡的城市剪影＋山丘（越遠越淡） ----
    const far = mix(dim(mix(bottom, '#b3c6dc', 0.45), 0.5), bottom, 0.3);
    const r2 = rng(7);
    for (let x = 0; x < 100;) {
      const bw = 4 + Math.floor(r2() * 6);
      const bh = 5 + Math.floor(r2() * 12);
      ctx.fillStyle = far;
      ctx.fillRect(x, HORIZON - bh, bw, bh);
      x += bw + Math.floor(r2() * 3);
    }
    const hillFar = dim(this.season === 'autumn' ? '#e2e2b2' : '#cdeab8', 0.7);
    const hillNear = dim(this.season === 'autumn' ? '#d2d59c' : '#b6dfa2', 0.7);
    for (let x = 0; x < W; x++) {
      const h1 = 6 + Math.round(3 * Math.sin(x / 15) + 2 * Math.sin(x / 6 + 1));
      ctx.fillStyle = hillFar; ctx.fillRect(x, HORIZON - h1, 1, h1);
      ctx.fillStyle = lighten(hillFar, 0.15); ctx.fillRect(x, HORIZON - h1, 1, 1);
      const h2 = 3 + Math.round(2 * Math.sin(x / 11 + 2) + Math.sin(x / 4));
      ctx.fillStyle = hillNear; ctx.fillRect(x, HORIZON - h2, 1, h2);
    }

    this.drawBuilding(st.stageKey, light, dim, t);
    this.drawTrees(sc, dim, t, w && w.kind === 'snow');
    this.drawLamp(light, dim);

    // ---- 地面：草地（有亮邊與草叢）、小路（石磚紋）、前景草地 ----
    ctx.fillStyle = dim(sc.grass); ctx.fillRect(0, HORIZON, W, 5);
    ctx.fillStyle = dim(lighten(sc.grass, 0.18)); ctx.fillRect(0, HORIZON, W, 1);
    const rg = rng(11);
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(rg() * W);
      const y = HORIZON + 1 + Math.floor(rg() * 4);
      ctx.fillStyle = dim(i % 3 ? sc.grassDark : lighten(sc.grass, 0.25));
      ctx.fillRect(x, y, 1, 1);
      if (i % 4 === 0) ctx.fillRect(x + 1, y - 1, 1, 1);
    }
    ctx.fillStyle = dim(darken('#f6eedb', 0.1)); ctx.fillRect(0, HORIZON + 5, W, 1);
    ctx.fillStyle = dim('#f6eedb'); ctx.fillRect(0, HORIZON + 6, W, 8);
    ctx.fillStyle = dim(darken('#f6eedb', 0.06));
    for (let y = HORIZON + 7; y < HORIZON + 14; y += 3) for (let x = (y % 2) * 3; x < W; x += 7) ctx.fillRect(x, y, 3, 1);
    ctx.fillStyle = dim(sc.fore); ctx.fillRect(0, HORIZON + 14, W, H - HORIZON - 14);
    ctx.fillStyle = dim(darken('#f6eedb', 0.1)); ctx.fillRect(0, HORIZON + 14, W, 1);
    for (let x = 2; x < W; x += 9) {
      ctx.fillStyle = dim(lighten(sc.fore, 0.2)); ctx.fillRect(x, HORIZON + 16, 1, 2); ctx.fillRect(x + 1, HORIZON + 15, 1, 2);
      if (this.season === 'spring' && x % 2) { ctx.fillStyle = dim(x % 4 === 1 ? '#f7b6cb' : '#ffe27a'); ctx.fillRect(x + 4, HORIZON + 17, 1, 1); }
    }

    // ---- 節日道具（地面） ----
    if (this.festival === 'birthday') {
      sprite(ctx, CAKE, 40, FEET - 6, { x: '#f6b3c8', w: '#fff5e8', y: '#ffd36b', o: OUTLINE });
      const bx = Math.round(this.actor.x) - 6;
      const sway = Math.floor(t / 900) % 2;
      [['#e0607e', 0], ['#ffd36b', 5], ['#9fd3ff', 10]].forEach(([c, dx], i) => {
        const x = bx + dx - 8 + (i === 1 ? sway : -sway);
        const y = 16 + i * 2;
        sprite(ctx, BALLOON, x, y, { x: c, w: lighten(c, 0.6), o: OUTLINE });
        ctx.fillStyle = '#d9dbe0'; for (let yy = y + 6; yy < FEET - 12; yy += 2) ctx.fillRect(x + 2, yy, 1, 1);
      });
    }

    // ---- 今年標籤的小道具（放在建築物前的草地上，讓出走路的地方） ----
    const slots = [104, 113, 122];
    st.props.forEach((name, i) => {
      const pr = PROP_SPRITES[name];
      const bob = name === 'heart' ? Math.floor(t / 600) % 2 : 0;
      sprite(ctx, pr.rows, slots[i], HORIZON + 4 - pr.rows.length - bob, pr.colors);
    });

    // ---- 小人、家人、寵物 ----
    const a = this.actor;
    let jumpY = 0;
    if (a.jumpsLeft > 0 && a.jumpAt >= 0) {
      const p = (t - a.jumpAt) / 550;
      if (p >= 1) { a.jumpsLeft -= 1; a.jumpAt = a.jumpsLeft > 0 ? t : -1; } else jumpY = Math.round(6 * Math.sin(Math.PI * clamp(p, 0, 1)));
    }
    const spriteTop = FEET - (AVATAR_H - 2); // 腳底在 FEET，最後一列描邊在 FEET + 1
    const shadow = (x, wdt) => { ctx.fillStyle = 'rgba(30,20,40,0.22)'; ctx.fillRect(x, FEET + 1, wdt, 1); ctx.fillRect(x + 1, FEET + 2, wdt - 2, 1); };

    // 寵物先畫（站在後面）
    for (const p of this.petActors) {
      const [pw, ph] = petSize(p.type);
      if (p.type === 'fish') { drawPet(ctx, 'fish', p.color, 4, FEET + 2 - BOWL[1], p.frame, false, { bowl: true }); continue; } // 魚缸放在左邊，不擋到其他寵物
      shadow(Math.round(p.x) + 2, pw - 4);
      drawPet(ctx, p.type, p.color, Math.round(p.x), FEET + 2 - ph - (jumpY > 0 ? Math.ceil(jumpY / 2) : 0), p.frame, p.dir < 0);
    }

    if (this.frames) {
      // 家人：站在旁邊一起走、一起跳
      const side = this.companionSide();
      this.companionActors.forEach((c, i) => {
        const cx = clamp(Math.round(a.x) + side * (AVATAR_W - 2) * (i + 1), 0, W - AVATAR_W);
        const cFrame = a.mode === 'walk' && !a.step ? c.step : (t + c.blinkOffset) % 4300 < 160 ? c.blink : c.base;
        shadow(cx + 5, 10);
        drawAvatar(ctx, cFrame, cx, spriteTop - jumpY, { flip: a.dir < 0, breathe: a.mode === 'idle' && jumpY === 0 && Math.floor((t + i * 400) / 800) % 2 === 0 });
      });
      const frame = a.mode === 'walk' && a.step ? this.frames.step : t < a.blinkUntil ? this.frames.blink : this.frames.base;
      const breathe = a.mode === 'idle' && jumpY === 0 && Math.floor(t / 800) % 2 === 1;
      shadow(Math.round(a.x) + 5, 10);
      drawAvatar(ctx, frame, Math.round(a.x), spriteTop - jumpY, { flip: a.dir < 0, breathe });
    }

    // ---- 季節小東西、鳥 ----
    for (const p of this.ambient) {
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (p.type === 'bird') {
        const up = Math.floor((t - p.born) / 250) % 2;
        ctx.fillStyle = dim('#2b2f3a', 0.3);
        if (up) { ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 1, y + 1, 2, 1); ctx.fillRect(x + 3, y, 1, 1); }
        else { ctx.fillRect(x, y + 1, 1, 1); ctx.fillRect(x + 1, y, 2, 1); ctx.fillRect(x + 3, y + 1, 1, 1); }
      } else if (p.type === 'firefly') {
        if (Math.floor(t / 400 + p.seed * 3) % 4 !== 0) {
          ctx.fillStyle = 'rgba(232,245,122,0.35)'; ctx.fillRect(x - 1, y - 1, 3, 3);
          ctx.fillStyle = '#eef78a'; ctx.fillRect(x, y, 1, 1);
        }
      } else {
        ctx.fillStyle = p.type === 'petal' ? '#f7b6cb' : Math.floor(p.seed) % 2 ? '#df8a32' : '#c84a30';
        ctx.fillRect(x, y, 2, 1);
        if (Math.floor(t / 400 + p.seed) % 2) ctx.fillRect(x, y + 1, 1, 1);
      }
    }

    // ---- 愛心、煙火 ----
    for (const p of this.particles) {
      if (t < p.born) continue;
      const age = (t - p.born) / p.life;
      if (p.type === 'heart') {
        sprite(ctx, HEART, Math.round(p.x), Math.round(p.y), { x: age > 0.7 ? '#f29bb0' : '#e0607e', o: OUTLINE });
      } else {
        ctx.fillStyle = age > 0.6 ? mix(p.color, top, (age - 0.6) * 2.5) : p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    }

    // ---- 天氣（前景） ----
    if (w) {
      ctx.fillStyle = w.kind === 'snow' ? '#ffffff' : light > 0.3 ? 'rgba(225,238,250,0.75)' : 'rgba(160,180,220,0.6)';
      for (const d of this.weatherDrops) ctx.fillRect(Math.round(d.x), Math.round(d.y), d.big ? 2 : 1, d.big ? 2 : d.len);
      if (w.kind === 'fog') {
        ctx.fillStyle = 'rgba(222,227,234,0.22)';
        for (let i = 0; i < 4; i++) {
          const x = Math.floor(((t / 400 + i * 50) % (W + 80)) - 80);
          ctx.fillRect(x, 30 + i * 7, 80, 5);
          ctx.fillRect(x - W - 80, 30 + i * 7, 80, 5);
        }
      }
    }

    // ---- 過年燈籠（從畫面上方垂下來，輕輕晃） ----
    if (this.festival === 'lny') {
      [12, 140].forEach((x0, i) => {
        const x = x0 + (Math.floor(t / 1100 + i) % 2);
        ctx.fillStyle = '#7a2a1a'; ctx.fillRect(x + 3, 0, 1, 4);
        sprite(ctx, LANTERN, x, 4, { r: '#e0473a', g: '#ffd36b', w: '#ff8a70', o: OUTLINE });
      });
    }
  }

  drawTrees(sc, dim, t, snowy) {
    const ctx = this.ctx;
    const O = dim(OUTLINE, 0.3);
    const sway = Math.floor(t / 1300) % 2;

    // 針葉樹（三層），四季都是綠的，下雪時頂上有雪
    const cx = 14;
    ctx.fillStyle = O; ctx.fillRect(cx - 2, 44, 5, HORIZON - 44 + 1);
    ctx.fillStyle = dim('#b08a6a'); ctx.fillRect(cx - 1, 44, 3, HORIZON - 44);
    [[24, 4, 5], [30, 6, 6], [36, 8, 7]].forEach(([y0, half, hgt], i) => {
      const off = i === 0 ? sway : 0;
      for (let dy = 0; dy < hgt; dy++) {
        const wdt = Math.round(1 + (half * (dy + 1)) / hgt);
        const x0 = cx - wdt + off;
        ctx.fillStyle = O; ctx.fillRect(x0 - 1, y0 + dy, wdt * 2 + 3, 1);
        ctx.fillStyle = dim('#6cb67a'); ctx.fillRect(x0, y0 + dy, wdt * 2 + 1, 1);
        ctx.fillStyle = dim('#93d39a'); ctx.fillRect(x0, y0 + dy, Math.max(1, wdt - 1), 1);
        if (snowy && dy < 2) { ctx.fillStyle = '#f4f6fa'; ctx.fillRect(x0, y0 + dy, wdt * 2 + 1, 1); }
      }
      ctx.fillStyle = O; ctx.fillRect(cx - half - 1 + off, y0 + hgt, half * 2 + 3, 1);
    });
    ctx.fillStyle = O; ctx.fillRect(cx + sway, 23, 1, 1);

    // 圓樹（季節變色、春天開花），亮面在左上、暗面在右下
    const rx = 36;
    const ry = 34;
    ctx.fillStyle = O; ctx.fillRect(rx - 2, ry + 6, 5, HORIZON - ry - 6 + 1);
    ctx.fillStyle = dim('#b08a6a'); ctx.fillRect(rx - 1, ry + 6, 3, HORIZON - ry - 6);
    const blobs = [[0, 0, 7], [-5, 2, 5], [5, 2, 5], [0, -4, 5]];
    const inside = (x, y) => blobs.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 <= r * r);
    for (let y = -10; y <= 8; y++) {
      for (let x = -11; x <= 11; x++) {
        const off = y < -3 ? sway : 0;
        if (inside(x, y)) {
          const bloom = sc.bloom && (x * 7 + y * 13 + 100) % 11 === 0;
          ctx.fillStyle = dim(bloom ? sc.bloom : !inside(x - 1, y - 1) ? sc.light : !inside(x + 1, y + 1) ? sc.dark : sc.leaf);
          ctx.fillRect(rx + x + off, ry + y, 1, 1);
        } else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy))) {
          ctx.fillStyle = O;
          ctx.fillRect(rx + x + off, ry + y, 1, 1);
        }
      }
    }
    // 小樹叢
    sprite(ctx, BUSH, 86, HORIZON - 3, { x: dim('#86c873'), y: dim('#aee09a'), o: O });
  }

  // 路燈：晚上會亮，地上有一圈光
  drawLamp(light, dim) {
    const ctx = this.ctx;
    const x = 96;
    const O = dim(OUTLINE, 0.3);
    ctx.fillStyle = O; ctx.fillRect(x - 1, 39, 3, HORIZON + 4 - 39);
    ctx.fillStyle = dim('#7c8598'); ctx.fillRect(x, 40, 1, HORIZON + 3 - 40);
    sprite(ctx, ['ooooo', 'oxxxo', 'oyyyo', '.ooo.'], x - 2, 35, { x: dim('#7c8598'), y: light < 0.4 ? '#ffe69a' : dim('#e4ecf2'), o: O });
    if (light < 0.4) {
      ctx.globalAlpha = 0.16 * (1 - light);
      ctx.fillStyle = '#ffe69a';
      for (let i = 0; i < 14; i++) ctx.fillRect(x - Math.round(i * 0.7), 39 + i, Math.round(i * 1.4) + 1, 1);
      ctx.fillRect(x - 10, HORIZON + 4, 21, 2);
      ctx.globalAlpha = 1;
    }
  }

  drawBuilding(stageKey, light, dim, t) {
    const ctx = this.ctx;
    const night = light < 0.35;
    const O = dim(OUTLINE, 0.3);
    const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // 有描邊的方塊
    const box = (x, y, w, h, fill) => { R(x, y, w, h, O); R(x + 1, y + 1, w - 2, h - 2, fill); };
    // 晚上的窗戶大多亮著，每隔一陣子有幾格換開關
    const slot = Math.floor(t / 20000);
    const glass = (i) => (night ? ((i * 7 + slot * 3) % 5 !== 0 ? '#ffd36b' : '#3a4466') : dim('#a8d0ec', 0.5));
    const windowAt = (x, y, w, h, i) => {
      box(x, y, w, h, glass(i));
      R(x + 1, y + 1, 1, 1, night ? '#fff0b0' : dim('#e4f3fb', 0.5)); // 反光
      if (w >= 5) R(x + Math.floor(w / 2), y + 1, 1, h - 2, dim('#ffffff', 0.4)); // 窗格
      if (h >= 6) R(x + 1, y + Math.floor(h / 2), w - 2, 1, dim('#ffffff', 0.4));
    };

    if (stageKey === 'baby' || stageKey === 'kinder') {
      // 兩層樓的家：紅瓦屋頂、煙囪、花台
      const x0 = 106;
      const roof = '#f39ab0';
      R(x0 + 30, 18, 5, 10, O); R(x0 + 31, 19, 3, 8, dim('#d9b5a4'));
      for (let i = 0; i < 13; i++) {
        const y = 21 + i;
        const half = 6 + Math.round(i * 1.6);
        R(x0 + 22 - half - 1, y, half * 2 + 2, 1, O);
        R(x0 + 22 - half, y, half * 2, 1, dim(i % 3 === 2 ? darken(roof, 0.18) : i % 3 === 0 ? lighten(roof, 0.12) : roof));
      }
      this.roofLines = [[x0 + 2, x0 + 42, 34]];
      box(x0 + 3, 34, 38, HORIZON - 34 + 1, dim('#fffaf2'));
      R(x0 + 4, 35, 36, 1, dim(darken('#fffaf2', 0.1)));
      let i = 0;
      for (const wx of [x0 + 7, x0 + 19, x0 + 31]) windowAt(wx, 37, 6, 5, i++);
      windowAt(x0 + 7, 44, 6, 5, i++); windowAt(x0 + 31, 44, 6, 5, i++);
      box(x0 + 19, 43, 6, HORIZON - 43 + 1, dim('#c99a7a'));
      R(x0 + 23, 47, 1, 1, dim('#ffd36b'));
      R(x0 + 6, 49, 8, 2, dim('#8fd07a')); R(x0 + 7, 49, 1, 1, dim('#f7b6cb')); R(x0 + 11, 49, 1, 1, dim('#ffe27a'));
      if (!night) { const k = Math.floor(t / 900) % 3; ctx.fillStyle = 'rgba(235,235,240,0.7)'; ctx.fillRect(x0 + 32 + (k % 2), 16 - k, 2, 1); }
    } else if (['elementary', 'junior', 'senior'].includes(stageKey)) {
      // 學校：鐘樓、兩排窗、大門、旗桿
      const x0 = 100;
      this.roofLines = [[x0, x0 + 53, 28], [x0 + 18, x0 + 31, 16]];
      box(x0 + 18, 16, 14, 13, dim('#fffaf2'));
      R(x0 + 17, 15, 16, 2, O); R(x0 + 18, 14, 14, 1, dim('#7fb8e0'));
      disc(ctx, x0 + 25, 21, 3, O); disc(ctx, x0 + 25, 21, 2, dim('#ffffff'));
      R(x0 + 25, 19, 1, 2, OUTLINE); R(x0 + 25, 21, 2, 1, OUTLINE);
      box(x0, 28, 54, HORIZON - 28 + 1, dim('#fffaf2'));
      R(x0 + 1, 29, 52, 1, dim('#a8d3ee'));
      let i = 0;
      for (let c = 0; c < 7; c++) for (let r = 0; r < 2; r++) if (!(c === 3 && r === 1)) windowAt(x0 + 3 + c * 7, 32 + r * 8, 5, 5, i++);
      box(x0 + 23, 41, 8, HORIZON - 41 + 1, dim('#c99a7a'));
      R(x0 + 27, 42, 1, HORIZON - 42, O);
      R(x0 - 6, 18, 1, HORIZON - 18, dim('#8e939a'));
      const wave = Math.floor(t / 500) % 2;
      R(x0 - 5, 18, 6, 1, '#e0607e'); R(x0 - 5, 19 + wave, 6, 1, '#e0607e'); R(x0 - 5, 20, 5 + wave, 1, '#c94f6c');
    } else if (stageKey === 'college') {
      // 大學：紅磚、柱子、三角山牆、大門
      const x0 = 102;
      this.roofLines = [[x0, x0 + 49, 24]];
      for (let i = 0; i < 8; i++) R(x0 + 24 - 3 * i - 1, 16 + i, 6 * i + 2, 1, O);
      for (let i = 1; i < 8; i++) R(x0 + 24 - 3 * i, 16 + i, 6 * i, 1, dim('#fffaf2'));
      box(x0, 24, 50, HORIZON - 24 + 1, dim('#eaa98e'));
      for (let y = 26; y < HORIZON; y += 2) for (let x = x0 + 1 + (y % 4 === 0 ? 0 : 2); x < x0 + 49; x += 4) R(x, y, 1, 1, dim(darken('#eaa98e', 0.1)));
      let i = 0;
      for (const wx of [x0 + 4, x0 + 12, x0 + 33, x0 + 41]) { windowAt(wx, 28, 5, 7, i++); windowAt(wx, 39, 5, 6, i++); }
      for (const cx of [x0 + 19, x0 + 30]) box(cx, 26, 3, HORIZON - 26 + 1, dim('#fffaf2'));
      box(x0 + 22, 38, 8, HORIZON - 38 + 1, dim('#9a7460')); R(x0 + 23, 37, 6, 1, O);
      R(x0 - 1, HORIZON - 1, 52, 1, dim('#e8dcc0'));
    } else {
      // 城市：幾棟大樓，屋頂有天線和水塔
      const towers = [[100, 26, 12], [113, 15, 13], [127, 30, 10], [138, 20, 12], [151, 32, 9]];
      this.roofLines = towers.map(([x, y, w]) => [x, x + w - 1, y]);
      let i = 0;
      const pastel = ['#c9d8ee', '#f4d3de', '#d2e9cf', '#f3e3bf', '#dad1f2'];
      towers.forEach(([x, y, w], k) => {
        const wall = night ? '#2c3456' : pastel[k];
        box(x, y, w, HORIZON - y + 1, dim(wall, 0.4));
        R(x + 1, y + 1, 1, HORIZON - y - 1, dim(lighten(wall, 0.15), 0.4));
        for (let wy = y + 3; wy < HORIZON - 2; wy += 4) {
          for (let wx = x + 2; wx < x + w - 2; wx += 3) {
            i++;
            R(wx, wy, 2, 2, night ? ((i * 7 + slot * 3) % 5 !== 0 ? '#ffd36b' : '#3a4466') : dim((wx + wy) % 3 ? '#ffffff' : '#bfe3f2', 0.4));
          }
        }
        if (w >= 12) { R(x + 3, y - 3, 1, 3, O); R(x + 3, y - 4, 1, 1, night && Math.floor(t / 1000) % 2 ? '#ff6a5a' : O); }
        if (w === 10) box(x + 3, y - 3, 4, 4, dim('#b9c2d0', 0.4));
      });
    }

    // 聖誕節：屋頂上一串慢慢輪流亮的小燈
    if (this.festival === 'christmas') {
      const colors = ['#e0473a', '#ffd36b', '#5cc28a', '#9fd3ff'];
      const shift = Math.floor(t / 1000);
      for (const [x1, x2, y] of this.roofLines) {
        for (let x = x1 + 1; x < x2; x += 2) {
          R(x, y - 1 + (Math.floor(x / 2) % 2), 1, 1, O); // 電線
          if (x % 4 === (x1 + 1) % 4) R(x, y + (Math.floor(x / 2) % 2), 1, 1, colors[(Math.floor(x / 4) + shift) % 4]);
        }
      }
    }
  }
}
