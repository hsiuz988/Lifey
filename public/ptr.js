// 下拉重新整理：拉下來放開，就向伺服器拿最新版本、重新載入。
// 獨立於 app.js：就算 App 某次沒順利啟動（例如新舊版本混在一起），下拉一樣能更新。
(function () {
  var TRIGGER = 70; // 拉超過這個距離（px）放開才會更新
  var MAX = 110;
  var el, icon, text;
  function setPtr(dist, mode, msg) {
    if (!el) { el = document.getElementById('ptr'); icon = document.getElementById('ptr-icon'); text = document.getElementById('ptr-text'); }
    if (!el) return;
    el.style.transform = 'translateY(' + (dist - 60) + 'px)';
    el.className = 'ptr' + (dist > 0 ? ' show' : '') + (mode ? ' ' + mode : '');
    text.textContent = msg || '下拉更新到最新版本';
    icon.textContent = mode === 'loading' ? '⟳' : '↓';
    document.body.classList.toggle('ptr-pulling', dist > 0 && mode !== 'loading');
  }
  function reload() {
    try { sessionStorage.setItem('lifey.refreshed', '1'); } catch (e) { /* 無痕模式 */ }
    location.reload();
  }
  // 先請 service worker 檢查新版；有新版就等它裝好（最多 8 秒），然後一律重新載入
  function refresh() {
    setPtr(TRIGGER, 'loading', '下載最新版本…');
    if (!('serviceWorker' in navigator)) { reload(); return; }
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (!reg) { reload(); return; }
      var done = false;
      var finish = function () { if (!done) { done = true; reload(); } };
      navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true });
      setTimeout(finish, 8000);
      reg.update().then(function () {
        var w = reg.installing || reg.waiting;
        if (!w) { finish(); return; }
        w.addEventListener('statechange', function () { if (w.state === 'activated' || w.state === 'redundant') finish(); });
      }, finish);
    }, reload);
  }
  var startY = null, dist = 0, busy = false;
  var canPull = function () { return !busy && window.scrollY <= 0 && !document.querySelector('dialog[open]'); };
  window.addEventListener('touchstart', function (e) {
    startY = e.touches.length === 1 && canPull() ? e.touches[0].clientY : null;
    dist = 0;
  }, { passive: true });
  window.addEventListener('touchmove', function (e) {
    if (startY == null) return;
    var dy = e.touches[0].clientY - startY;
    if (dy <= 0 || window.scrollY > 0) { if (dist) setPtr(0); startY = null; dist = 0; return; }
    dist = Math.min(MAX, dy * 0.5); // 阻尼：手指拉 2px，指示器走 1px
    setPtr(dist, dist >= TRIGGER ? 'ready' : '', dist >= TRIGGER ? '放開以更新' : '下拉更新到最新版本');
  }, { passive: true });
  window.addEventListener('touchend', function () {
    if (startY == null) return;
    startY = null;
    if (dist < TRIGGER) { setPtr(0); return; }
    busy = true;
    refresh();
  });
  window.lifeyRefresh = refresh;

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
