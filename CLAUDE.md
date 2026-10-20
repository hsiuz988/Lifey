# 人生紀錄 Lifey — 交接文件（給接手的 Claude／開發者）

> Claude Code 會自動讀這個檔案。換帳號、換電腦（例如 Warp 終端機）時：
> ```bash
> git clone https://github.com/hsiuz988/Lifey.git && cd Lifey
> git checkout develop
> npm install
> ```
> 然後跟 Claude 說「讀 CLAUDE.md，接著做」即可。

## 跟使用者合作的規則

- **一律用繁體中文回覆**。使用者是產品負責人，不寫程式，重視美術精緻度與 UI 質感。
- **所有開發都在 `develop` 分支**；推上去會自動部署到測試網址。
- **只有使用者說「上線」才把 develop 合併進 `main`**（main 會自動部署到正式網址）。
- 沒被要求就不要開 PR。
- 刪除、覆寫等不可逆動作先確認。
- 不要把使用者的 email 寫進公開頁面。
- AI 金鑰（`ANTHROPIC_API_KEY`）只放在 Worker secret，不能出現在前端。
- 美術是參考《大頭妹》的風格，但不能抄它的角色或素材。

| | 網址 | 分支 |
|---|---|---|
| 正式 | https://app.lifey.workers.dev | `main`（上次上線：23ff8f4，SW cache v25） |
| 測試 | https://develop-app.lifey.workers.dev | `develop` |

部署方式是 Cloudflare Workers Builds：推上 GitHub 後自動執行 `npx wrangler deploy`。

## 產品方向（已和使用者定案）

- 首頁是**等角視角的小房間**（大頭妹風格），點家具會打開對應功能。
- 整體比例是 **40% 遊戲感、60% 日記工具**。
- 插畫以外的工具介面都用**乾淨簡約的白色介面**：白底，粉色只當強調色。**不要用「粉色＋墨色」的組合**。
- 預設淺色主題；設定裡可以切換深色。
- 底部有四個分頁：首頁、回憶、地圖、我。中間的 ＋ 是「記一筆」。

### 房間裡的熱點 → 功能（`public/room.js` 的 `.hot[data-name]`，處理函式由 `app.js` 傳入）

| 物件 | 功能 |
|---|---|
| 書桌日記本 `diary` | 記一筆 |
| 牆上月曆 `calendar` | 心情月曆（目前打開心情花園） |
| 電視 `tv` | 出生那年的世界大事（`room/tv_on.webp` 是開機貼片） |
| 信紙 `letter` | 給未來自己的信 |
| 書架 `shelf` | 隨機一則回憶 |
| 牆上照片 `photos` | 照片 |
| 盆栽 `plant` | 心情花園 |
| 點人物 | 換裝（look dialog） |
| 檯燈、床、時鐘、窗戶 | 小互動：開關燈、睡覺、報時、天氣 |
| 門 `door` | 尚未接功能（「其他房間還在裝潢中」） |

### 「我」分頁

依序是：個人卡（頭像、名字、年齡）、統計、**家人／伴侶與寵物**（`＋ 家人／伴侶`、`＋ 寵物`），以及選單。選單包含人物、信、雲端／好友邀請、天氣、備份、其他；原本設定頁的內容都在這裡。

## 架構

純前端 PWA，沒有建置步驟，不用 framework。

```
public/            網站本體（ES modules）
  index.html       #setup（註冊／OB）、#app（4 個分頁）、各種 <dialog>、#boot-fail
  app.js           主程式：狀態、render、分頁 showTab()、記一筆、回憶、地圖、我、OB
  room.js          房間：等角座標、A* 走路、分層人物、熱點、泡泡、表情動作
  room/            room.webp、tv_on.webp、char/*.webp（人物圖層）
  ptr.js           獨立的下拉更新＋註冊 SW（app.js 壞掉也能用）
  sw.js            Service worker（CACHE = 'lifelog-vNN'，每次改前端檔案都要 +1）
  db.js            IndexedDB
  cloud.js         登入（Passkey/Face ID）、同步
  scene.js / avatar.js / game.js   舊的像素場景（只剩「人生重播」在用）
  garden.js pets.js weather.js world.js events.js photos.js zip.js
worker/            Cloudflare Worker，只處理 /api/*
  auth.js          Passkey 登入、session cookie
  data.js          同步（逐筆合併＋墓碑＋樂觀鎖）、照片（R2）、邀請、家人互看（sharedView）
  story.js         AI 故事（ANTHROPIC_API_KEY secret）
  schema.js        D1 資料表（第一次請求自動建立）
art/               美術原圖與疊圖腳本（見 art/README.md）
tests/             Playwright 端對端測試
```

### Service worker 的重要原則（iPhone 白畫面教訓）

- html/js/css/json 用 network-first，圖片用 cache-first。
- **絕對不能快取或回傳 redirected response**：Safari 會整頁空白，而 `/index.html` 會 307 轉到 `/`。`clean()` 會把它拆掉。
- install 時某個檔案抓不到也不能整個失敗。
- 改了 `public/` 的檔案就要把 `sw.js` 的 `CACHE` 版號 +1，新檔案也要加進 assets 清單。

### 開機安全網

- `index.html` head 的 inline script 會把錯誤收集到 `window.__bootErrors`。
- 4 秒後如果 #setup 和 #app 都沒出現，就顯示 `#boot-fail`：錯誤清單、UA，以及「重新載入最新版本」按鈕（會清快取、移除 SW、重新載入）。
- `render()` 有 try/catch，出錯時用 toast 顯示。

### 人物外觀（look）

- 存在 `state.profile.look = { style, hair, cloth }`，會同步給家人（`sharedView` 有帶 look）。
- `room.js` 的 `LOOKS` 定義可選項目：
  - 髮型：`ponytail` 或 ''（短髮＝素體本身）；
  - 衣服：`tee`、`hoodie` 或 ''。
- `style` 有兩種角色：`classic`（經典，預設）和 `doll`（復古娃娃）。`looksFor(style)` 回傳該角色可選的髮型和衣服。
- **復古娃娃**有兩個角度（使用者定案：**站著、換裝畫面、預設都是正面，只有走路變側面**）：
  - **正面** `public/room/doll/front/`（`art/tools/doll_front.py`）：不切手腳，只有 後髮 → 身體 → 前髮；正面永遠不左右翻；
  - **側面** `public/room/doll/`（`art/tools/doll34.py`）：走路時才顯示，`Room.showPose()` 切換，`#scene` 的 `data-pose` 是 front／side；
  - 每個髮型、衣服都要正面、側面各一張，名稱要一致；
- 側面娃娃的細節：
  - **四分之三側面**（臉朝畫面右下），往左走時整個左右翻面；
  - 切成身體＋頭、近手 `arm_n`、遠手 `arm_f`、近腳 `leg_n`、遠腳 `leg_f`，加上前後髮；
  - 疊的順序：後髮 → 遠手 → 遠腳 → 近腳 → 身體 → 前髮 → 近手；
  - 走路時 `Room.swing()` 每一幀讓手腳繞關節 `DOLL_JOINTS` 轉（用 SVG transform 屬性，不靠 CSS，iPhone 也穩）：腳前後跨步，近手往前、遠手往後（另一個方向會露出縫）；
  - 衣服：一整張「光頭素體穿衣服」的圖，先用腿和鞋對齊素體，只取脖子以下，頭一律用素體的（頭髮才對得齊）；
  - 目前有：女生、長直髮／鮑伯頭／光頭、T 恤／運動服；這一版沒有表情；
  - 男生素體 `art/source/doll34_boy_base.webp` 已有，髮型和衣服等使用者生成。
- 表情由心情決定（經典角色）：`faceFor(emo)` 把 happy/excited/love/moved 對到 `happy`、angry 對到 `angry`、其他對到 `smile`。
- 圖層順序：`hair_*_back → body → cloth → face → hair_*_front → sym_*`。
- 圖層尺寸是 267×420，腳底在 (108.8, 418.6)。
- 新增髮型、衣服或表情：用 `art/` 的流程產出 webp，再加進 `LOOKS`／`faceFor`、`sw.js` 的 assets，並更新測試。

## 測試

```bash
npm i -D playwright && npx playwright install chromium   # 第一次
tests/run.sh                 # 離線測試，10 支約 210 項，應全部通過
tests/run-cloud.sh           # 雲端測試（本機 wrangler D1/R2 + 虛擬 Face ID），3 支
node tests/e2e/room-weather.test.cjs   # 單跑一支（需要先自己開伺服器，見 run.sh）
LIFEY_URL=https://develop-app.lifey.workers.dev/ node tests/e2e/ux-flows.test.cjs
```

- 元素多半在不同分頁裡，測試要先切分頁：
  ```js
  const tab = (p, t) => p.click(`#tabbar [data-tab-btn="${t}"]`);
  ```
- `<dialog>` 的 close 事件是非同步的，關掉後等 100ms 再操作。
- 和日期有關的測試要固定時間：`p.clock.setSystemTime(...)`。
- `pkill -f` 會把自己的 shell 一起砍掉（exit 144），要分開執行。
- 測 iPhone Safari 可以用 Playwright WebKit；目前在 WebKit 下只有存照片的測試會失敗（環境限制）。

## Commit 慣例

- 英文標題，內文說明改了什麼。
- 結尾加上當時環境要求的 Co-Authored-By／Session 行（如果有）。
- 不要在 commit、程式碼或文件裡寫模型名稱。

## 待辦與已知問題

1. **iPhone 白畫面（還沒解決）**：使用者的 iPhone 在 Safari 和主畫面 App 上，測試網址都是白畫面；但 Playwright WebKit 不管是全新安裝或從 v26 升級都正常。
   - 已經做了：network-first、redirect-safe SW、開機安全網、錯誤回報、獨立的下拉更新。
   - 下一步：請使用者用 Safari 開測試網址，等 5 秒，截圖 `#boot-fail` 的錯誤資訊，依錯誤修。
   - **不要叫使用者刪掉主畫面圖示**：沒同步的本機資料可能會一起消失。
2. **等使用者提供的美術**（AI 生成規則見 art/README.md）：
   - 髮型：雙馬尾、公主頭、鮑伯、包頭、長直髮、男生髮型 ×2；
   - 表情：興奮、緊張、難過、疲勞、陶醉、想念、感動；
   - 衣服：制服、洋裝、男生套裝；
   - 房間裡的寵物和伴侶。
3. **測試和正式環境共用同一個 D1／R2**（`wrangler.jsonc` 的 env 用同一個 database_id）。需要建立 `lifey-db-dev` 並填入它的 ID。
4. `privacy.html` 的聯絡信箱還沒填（等使用者提供）。
5. 「人生重播」還在用舊的像素場景（scene.js／avatar.js），之後要改成房間風格。
6. 舊的遠端分支（ai-story、cloud、garden、redesign、release-prep 等）等使用者自己刪除。
