// 舊測試沿用：把收起來的選填區塊、設定子頁都攤開，測的是資料流程而不是開合
module.exports = async (p) => {
  await p.addInitScript(() => {
    const css = '#moment-form .opt-sec[hidden], #settings-dialog .settings-page[hidden] { display: flex !important; } #moment-form textarea[name=feel][hidden] { display: block !important; }';
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style'); s.textContent = css; document.head.append(s);
    });
  });
};
