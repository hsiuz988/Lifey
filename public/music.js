// 背景音樂：預設關閉，開關存在這支手機（每台裝置可以不同）
// iPhone 不能自己開始播聲音，要等使用者點一下畫面；也不能用 audio.volume 調音量，所以用 Web Audio 的 GainNode
const SRC = 'music/room.mp3';
const VOLUME = 0.3;
const FADE = 0.8; // 秒

let audio = null;
let ctx = null;
let gain = null;
let wanted = false;
let failed = false;
let onFail = null;

export function musicPref() {
  try { return localStorage.getItem('lifey.music') === 'on'; } catch (e) { return false; }
}

function setup() {
  if (audio) return;
  audio = new Audio(SRC);
  audio.loop = true;
  audio.preload = 'none';
  audio.addEventListener('error', () => {
    failed = true;
    if (wanted && onFail) onFail();
  });
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    try {
      ctx = new AC();
      gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
    } catch (e) { ctx = null; gain = null; }
  }
  if (!gain) audio.volume = 0;
}

function fadeTo(v, done) {
  if (gain) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(v, t + FADE);
    if (done) setTimeout(done, FADE * 1000);
    return;
  }
  // 沒有 Web Audio：直接調 audio.volume
  const from = audio.volume;
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / (FADE * 1000));
    audio.volume = from + (v - from) * k;
    if (k < 1) requestAnimationFrame(step); else if (done) done();
  };
  requestAnimationFrame(step);
}

// 要在使用者點擊的當下呼叫，瀏覽器才肯出聲；被擋下就回傳 false
async function play() {
  setup();
  if (failed) return false;
  try {
    // 兩個都要在點擊的當下呼叫，不能先 await 其中一個
    const playing = audio.play();
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    await playing;
  } catch (e) { return false; }
  fadeTo(VOLUME);
  return true;
}

function pause() {
  if (!audio || audio.paused) return;
  fadeTo(0, () => { if (!wanted || document.hidden) audio.pause(); });
}

export function setMusic(on) {
  wanted = on;
  try { localStorage.setItem('lifey.music', on ? 'on' : 'off'); } catch (e) { /* 無痕模式存不了，只套用這次 */ }
  if (on) return play();
  pause();
  return Promise.resolve(true);
}

export function musicPlaying() {
  return !!audio && !audio.paused && wanted;
}

// 開機時呼叫：上次開著的話，等第一次點畫面就開始播；切到背景時暫停
export function initMusic({ onFailed } = {}) {
  onFail = onFailed;
  wanted = musicPref();
  // 一直掛著：從背景回來時被擋下的話，下一次點畫面會再接著播
  const kick = () => { if (wanted && !failed && !musicPlaying()) play(); };
  ['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, kick, true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else if (wanted) play();
  });
}
