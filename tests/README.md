# 自動測試

用真的瀏覽器（Playwright 的 Chromium）把 App 從頭操作一遍：設定、記一筆、照片、回憶模式、人物與寵物、捏小人、場景、天氣、時事、那年今日、給未來的信、年度卡、人生重播、外觀切換。

## 執行

```bash
npm i -D playwright && npx playwright install chromium   # 第一次
tests/run.sh
```

- 每支測試會印出 ✅／❌，`run.sh` 最後列出失敗的檔案，全部通過時結束碼是 0。
- 測試過程的截圖存在 `$LIFEY_OUT`（預設是暫存資料夾）。
- 要測其他網址（例如測試環境）：`LIFEY_URL=https://xxx-lifey.xxx.workers.dev/ node tests/e2e/ux-flows.test.js`
- `fixtures/` 是測試用的照片（含旋轉、透明背景）。
