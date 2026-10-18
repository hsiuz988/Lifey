# Lifey · 人生紀錄

🔗 **網址：https://lifey.hsiuz988.workers.dev**

只給自己用的手機網頁 App（PWA），靈感來自《80 億分之 1》：把真實人生中值得記住的時刻，依「幾歲」排成時間軸，長期累積、隨時回顧。

## 目前功能（階段 1）

- 第一次開啟設定名字與生日，頂部顯示目前幾歲、這一歲過了多少
- 「＋ 記一筆」：日期（可改到過去補回憶）、一句話、心情（選填）、標籤（選填）、☆ 值得記住
- 時間軸依年歲分組，最新的在前；點 ☆ 直接標記，點文字可編輯／刪除
- 篩選（全部／☆／標籤）與搜尋
- 身分紀錄卡（含護照式 MRZ 裝飾）
- 匯出／匯入 JSON 備份（可整個取代或合併），超過 30 天沒備份會提醒
- 可加入主畫面、離線使用

**資料只存在手機瀏覽器的 localStorage**，不會上傳。換手機或清除網站資料前一定要先匯出備份。

## 本機試用

```bash
cd public
python3 -m http.server 8000
# 打開 http://localhost:8000
```

## 部署（Cloudflare）

網站檔案都在 `public/`，不需要建置。每次推到 `main` 會自動重新發布。

- **Workers 流程**（Cloudflare 現在的預設）：專案名稱填 `lifey`，Build command 留空，Deploy command 用預設的 `npx wrangler deploy`，會讀 `wrangler.jsonc`
- **Pages 流程**：Framework preset 選 None，Build command 留空，Build output directory 填 `public`

## 更新程式後

修改任何檔案後，把 `public/sw.js` 裡的 `CACHE` 版本號 +1（例如 `lifelog-v2`），手機開兩次就會換成新版。

## 規劃

1. ✅ 階段 1：記錄、時間軸、☆、備份
2. 階段 2：回憶模式（補填過去每一歲）、一格一年的人生地圖、年度總結卡
3. 階段 3：四項狀態養成、成就、年度重心、像素頭像與場景
4. 階段 4：LINE 推播提醒、跨裝置同步
