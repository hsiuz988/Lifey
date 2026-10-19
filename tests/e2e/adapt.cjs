// 舊測試沿用：把收起來的選填區塊、設定子頁都攤開，測的是資料流程而不是開合
module.exports = async (p) => {
  await p.addInitScript(() => {
    const css = '#moment-form .opt-sec[hidden], #settings-dialog .settings-page[hidden] { display: flex !important; }';
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style'); s.textContent = css; document.head.append(s);
      // 舊測試不測歡迎頁：一跳出來就關掉
      new MutationObserver(() => { const d = document.querySelector('#letter-dialog'); if (d && d.open && d.textContent.includes('歡迎，')) d.close(); })
        .observe(document.body, { subtree: true, childList: true, attributes: true });
    });
  });
};
