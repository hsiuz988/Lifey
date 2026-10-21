# wowo — 交接文件（給接手的 Claude／開發者）

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
- **產品名稱是 `wowo`（全小寫）**，舊名「Lifey」「人生紀錄」不要再出現在畫面、分享文字、檔名或 AI 提示裡。
  - 內部名稱**刻意保留** `lifey`：IndexedDB `lifey`、localStorage／sessionStorage 的 `lifey.*`、測試的 `LIFEY_URL`、GitHub repo、D1／R2 名稱、`lifey.workers.dev` 網址。改了會讓使用者的資料、設定或 Face ID 登入不見，要搬家得另外做轉移。

| | 網址 | 分支 | 資料庫／照片 |
|---|---|---|---|
| 正式 | https://app.lifey.workers.dev | `main`（上次上線：23ff8f4，SW cache v25） | D1 `lifey-db`、R2 `lifey-photos` |
| 測試 | https://develop-app.lifey.workers.dev | `develop` | D1 `lifey-db-dev`、R2 `lifey-photos-dev`（`wrangler.jsonc` 的 `previews`） |

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
| 點人物 | 跳一下、說句話（換裝從「我」的個人卡進去） |
| 檯燈、床、時鐘、窗戶 | 小互動：開關燈、睡覺、報時、天氣 |
| 門 `door` | 尚未接功能（「其他房間還在裝潢中」） |

### 像素房間

- 素材 `art/source/room2/`：`full.webp` 完整房間（目前直接當背景）、`empty.webp` 空房間、`furniture.webp` 大型家具（床畫錯方向，之後從 full 切）、`small.webp` 小物件。
- `python3 art/tools/room_pixel.py` → `public/room/pixel_room/room.webp`（地板前角補齊，畫布 1536×1064；書桌上方層架用 `shelf_empty.png` 清空，改了圖要把 room.js 和 sw.js 的 `room.webp?v=` +1）、`tv_on.webp`（電視畫面用仿射貼到房間電視上）。
- `room.js`：地板 `O/EU/EV`、`BLOCKS`（家具佔的地板，u 沿右牆、v 沿左牆）、`HOTS` 都是照這張圖量的；換房間圖要一起重量。
- 之後做金幣商店：空房間＋一件件家具疊上去。

### 首頁的順序（使用者在設計稿「首頁 V3」定案）

1. 最上面：**「16 歲又 15 天」**（從今年生日算起，生日當天顯示「生日快樂！」）｜**♡ N 個小幸福**（`state.joyLog` 筆數，愛心會撲通跳），右邊 BGM。
2. 個人區：大頭照（點了換樣子）；名字＋**MSN 狀態**（`state.profile.status`：在線上／忙碌中／馬上回來／外出中／想一個人靜靜／正在耍廢，點了出選單）；下面是 **MSN 個人訊息框**（`state.profile.msg`，最多 40 字，使用者自己寫，空的時候顯示「<寫下想說的話>」）。
3. 最新動態（原 Updated news）：最近三筆日記（日期、[日記]／[相簿]、內容），「全部 ›」去日記分頁。
4. 房間（沒有「Mini Room」標題、沒有歲數小標）→ 累積幸福 → 備份提醒 → 今日卡（一次一張）→ 家人說（只有連結了家人才出現）。
- 首頁**沒有**「今天過得怎麼樣？」入口和四格數字（數字在「我的」）。

### 房間小人說話的口吻

- **小人＝玩家自己**，一律用第一人稱說心聲（「這是我的小窩～」「有一封信在等我打開」），不是旁白，也不安慰玩家；安慰之後交給寵物、家人。
- 記一筆後照那則的心情說 `room.js` 的 `MOOD_LINES`（使用者定案的台詞，10 種心情各 2～3 句隨機）；累、難過、生氣、緊張、想念（`QUIET_MOODS`）不跳、不冒星星。

### 第一次使用（OB）

名字、生日 → 選樣子 → **直接進房間**，小人說「點書桌上的日記本，寫下今天吧」。沒有歡迎頁。
- 被邀請的人（`#invite=`）填完資料就先問 Face ID 建帳號（才能連結）。
- 其他人**記完第一筆**才問要不要開雲端（`offerCloudAfterFirst`，`state.prefs.cloudOffered` 記住只問一次）。
- 「已經有帳號了？用 Face ID 登入」放在註冊頁最上面。

### 日記、地圖、返回鍵（第三批流程優化定案）

- **日記**：一次看一歲，自己的紀錄和打開過的信**新的在上面**，「這一年」（不確定日期）排最後；世界大事收成「🌏 N 歲那一年的世界 · N 件」一列，點了才展開，台灣／全球在展開後選。篩選只有一排，多的左右滑。
- **地圖**：點過去的格子打開「這一歲」抽屜（`openYear`：一句話、狀態、看日記、記一筆、補回憶、年度卡），**不跳分頁**；按「看這一歲的日記」才去日記分頁。未來的格子是寫信。「最幸福的一歲」要那一歲至少 3 則有心情才顯示。
- **返回鍵**：有抽屜開著時，瀏覽紀錄上固定墊**一筆**（`syncHistory`）；返回鍵關最上層的抽屜（草稿照樣先問），全部關掉再退掉那一筆。不要改成每個抽屜各墊一筆（「繼續編輯」之後會少算一筆，下一次返回就離開 App）。

### 累積幸福（`public/joys.js`，依 PRD v1.0 分階段做）

- 首頁房間下面**常駐 2 排 × 5 顆**按鈕（最多 10 個，多的在「全部」）。新使用者一進來就有預設的 10 個（`DEFAULT_JOYS`：喝到好喝的、吃到好吃的、看見漂亮的天空、好好睡了一覺、被稱讚了、收到小驚喜、聽到喜歡的歌、遇到可愛的貓狗、出門走走、和重要的人在一起），可以刪除或新增；`seedJoys` 只放一次（`state.prefs.joysSeeded`），id 固定 `joy-<圖示>`、`updatedAt` 是 2000 年，兩台手機同步不會變兩份，刪掉也不會復活。
- **點一下＝收藏**，按鈕下面滑出延伸提問卡（`showAsk`，問題照圖示 `ASK`）：有寫按「記成日記」就存成今天的一篇日記（moment 帶 `joy: joyId`）；「復原」取消這次收藏。長按打開詳情。「我」選單也有入口。
- 資料：`state.joys`（`{id,title,icon,mode:'once'|'many',order,archivedAt,updatedAt}`）、`state.joyLog`（一次一筆 `{id,joyId,date}`）。次數、天數、本月、今年都從 log 算，不另外存。
- 刪除＝墓碑（`state.deleted`）；同步和匯入都用 `mergeJoyData` 逐筆合併，兩台手機同一天各點一次會留兩筆。
- 規則：可以補記過去、不能記未來；每天一次的同一天再點會打開詳情；一天多次改成每天一次要先確認才合併；連點 350ms 內只算一次。
- 用語：收藏／發生了／小幸福，**不要**打卡／達標／積分／連續天數／排行榜。
- 圖示：`python3 art/tools/joy_icons.py` 把 `art/source/joys/sheet.png`（6×4 張圖示表）去背切成 `public/joys/<key>.webp`（白底預覽 `preview.png`）。太陽、閃光、耳機在表裡光暈太重（`SKIP`），改用單張白底重畫的 `art/source/joys/<key>.png`（會蓋過表裡的）。24 個都有像素圖了；新增圖示要加進 `joys.js` 的 `JOY_ICONS`（emoji 備用）和 `sw.js`。
- **生活印記**（Phase 3）：同一個圖示的小幸福收藏滿 `IMPRINT_DAYS`（10）個不同日子 → 跳出「房間多了一件東西」，選「放到房間」或「先收著」；拿到就永久（刪紀錄不收回）。
  - 資料 `state.imprints`：`{id:key, key, joyId, at, shown, updatedAt}`；同步用 `mergeImprints`：日期留最早、`shown` 照最新。
  - 設定 `public/joys-config.js` 的 `IMPRINTS`：每件家具在房間的位置（底部中間 x,y）、大小、疊放順序 z、放在地板上的擋路半徑 r；改數字不用動程式。
  - 圖：`python3 art/tools/imprint_items.py` 把 `art/source/furniture/<key>.png`（GPT 白底單張）去背、縮到房間大小、外框重畫成房間的粗細顏色 → `public/room/imprints/<key>.webp`；新增要加進 `WIDTH`、`IMPRINTS`、`sw.js`。
  - 房間不清空：新家具直接疊上去蓋住舊的（使用者定案）。目前有圖的：cat 小貓抱枕、coffee 拿鐵、meal 小矮桌（電視前地毯上）、gift 禮物、bear 熊熊、hearts 愛心氣球；其他 18 個拿到會顯示「家具製作中」。
  - 收藏冊在「累積幸福 → 全部」最下面，24 格。
- 之後：Phase 2 幸福星罐、Phase 4 年度回顧卡、日記時間軸上的小印章；新房間草稿在 `art/source/room2/room_*.webp`（之後做換房間時用）。

### 「我」分頁

**「我的」就是設定首頁**，沒有 ⚙ 和第二份選單。依序是：個人卡（點頭像換樣子；「換我的樣子」「編輯名字、生日」兩顆按鈕）、統計、**家人／伴侶與寵物**（「全部 ›」是人物與寵物唯一的入口），以及選單：給未來的信、雲端與家人、天氣、備份與資料、外觀與其他。
- 選單用 `data-open` 打開 `#settings-dialog` 的子頁（`openSettings(page)`）；子頁的「返回」、× 都是直接關掉回到「我的」。
- 選單名稱要和子頁標題一樣。
- 確認視窗用 `ask()`（不要用 `confirm`／`prompt`）；刪除紀錄、信用 toast 的「復原」。

## 架構

純前端 PWA，沒有建置步驟，不用 framework。

```
public/            網站本體（ES modules）
  index.html       #setup（註冊／OB）、#app（4 個分頁）、各種 <dialog>、#boot-fail
  app.js           主程式：狀態、render、分頁 showTab()、記一筆、回憶、地圖、我、OB
  room.js          房間：等角座標、A* 走路、分層人物、熱點、泡泡、表情動作
  room/            room.webp、tv_on.webp、char/*.webp（人物圖層）
  ptr.js           獨立的下拉更新＋註冊 SW（app.js 壞掉也能用）
  sw.js            Service worker（VERSION = '0.0.NN'，每次改前端檔案都要 +1，見「版本號」）
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
- 改了 `public/` 的檔案就要把 `sw.js` 的 `VERSION` 最後一位 +1，新檔案也要加進 assets 清單。

### 版本號

- 格式是 `主.次.修`（例如 `0.0.50`），寫在 `sw.js` 的 `VERSION`；快取名稱是 `lifelog-0.0.50`。設定頁和「我」最下面會顯示。
- **修**（最後一位）：每次推上去的更新都 +1（原本的 `v49` 接著變成 `0.0.50`）。
- **次**（中間）：使用者說「上線」、合併進 `main` 時 +1，最後一位歸零（例如 `0.0.57` → `0.1.0`）。
- **主**（第一位）：正式對外發表時才改成 `1.0.0`，由使用者決定。

### 開機安全網

- `index.html` head 的 inline script 會把錯誤收集到 `window.__bootErrors`。
- 4 秒後如果 #setup 和 #app 都沒出現，就顯示 `#boot-fail`：錯誤清單、UA，以及「重新載入最新版本」按鈕（會清快取、移除 SW、重新載入）。
- `render()` 有 try/catch，出錯時用 toast 顯示。

### 窗外天氣

- `room.js` 的 `windowView(weather, now)` 決定窗外：`clear`（房間原圖，不疊）、`cloudy`、`rain`、`snow`、`clear_night`、`rain_night`；`#scene` 的 `data-window` 是目前的值。
- 晚上：有開真實天氣就照日出日落，沒開就用 18 點到 6 點；每分鐘檢查一次。
- 對應：毛毛雨／大雨／雷雨 → 雨；陰天／有霧 → 多雲；夜晚多雲、夜晚下雪還沒有圖，先用 `clear_night`。
- 夜晚房間：晚上（`windowView` 回傳 `*_night`）整間換成 `pixel_room/room_night.webp`（檯燈亮著），`#scene` 的 `data-light` 是 day／night、`data-lamp` 是 on／off。晚上點檯燈關燈＝蓋一層 40% 深藍（`this.dark`），等之後有「夜晚關燈」的圖再換。
  - 來源 `art/source/room2/night_lamp.webp`（GPT 照白天房間只改光線），`python3 art/tools/room_night.py`：GPT 會把整張圖縮放、平移幾 px，工具會自動比對邊緣、對回白天房間，再套白天的外形、補地板前角。換新的夜晚圖直接覆蓋來源、重跑就好。
- 新增景色：用**同一間空房間只換窗外**的圖放進 `art/source/room2/window/<名稱>.webp`，加進 `art/tools/room_window.py` 的 `KINDS`，跑一次，再改 `windowView` 和 `sw.js`。

### 背景音樂

- `public/music.js` 的 `TRACKS` 有三首，玩家在「我 → 其他」選（`lifey.track`），選了就順便打開音樂。都是 Pixabay 授權（可商用、不需標註）：
  - 早晨咖啡 `music/room.mp3`：〈Cafe Lofi〉zephiramusic（預設）
  - 慵懶午後 `music/chill.mp3`：〈Chill Cafe Lofi Beat〉tunetank
  - 晴天爵士 `music/sunny.mp3`：〈Lofi Jazz Trio Sunny Cafe〉Alex Morgan
- 新增曲子：用 ffmpeg 壓成 112kbps、頭尾 0.3s／2s 淡入淡出，音量調到平均約 -16 dB（三首一致，換歌不會忽大忽小），再加進 `TRACKS` 和測試。
- 一首播完自動換下一首（最後一首接回第一首），`initMusic` 的 `onTrackChange` 會更新首頁的歌名。
- 檔案抓不到時打開開關會提示並關回去。
- 預設關閉，開關存在 localStorage `lifey.music`（每台裝置不同）。首頁右上角的 `#cy-bgm`（▶ BGM，播放時顯示歌名，旁邊 `#cy-bgm-next` ⏭ 換下一首），以及「我 → 其他」的 `#pref-music`。
- iPhone 要等使用者點畫面才能出聲，`audio.volume` 也沒作用，所以用 Web Audio GainNode 調音量（30%）和淡入淡出；切到背景時暫停。
- `sw.js` 不處理 mp3/m4a（播放時是分段請求，cache.put 存不了 206）。
- 換歌：Suno 免費方案的歌不能商用也不能下載；換成別首要確認授權可商用。

### 小窩全畫面

- Mini Room 右下角 `#room-zoom`：`.room-box` 加 `.full`、`<html>` 加 `.room-full`，房間鋪滿畫面（蓋過分頁列），再按一次、按 Esc 或換分頁就離開。
- 寬螢幕整間放進畫面；手機直向放大到畫面高度的六成、可以左右滑，一開始捲到中間。HUD 和放大鈕在全畫面時是 `position: fixed`，泡泡照樣跟著房間。

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
- **像素女孩**（`style: 'pixel'`，新使用者的預設）：logo 女孩的像素風，**紙娃娃做法**。
  - 頭和身體是 GPT 分開畫的零件（`art/source/pixel2/`）：`head_<髮型>` 一列 3 顆頭（正、側朝右、背），只有頭、下巴有外框；`body_<衣服>` 一列 7 個沒頭的身體（正、側、背、側面走路 4 格），脖子是一小截皮膚；
  - 改了像素女孩的圖：`room.js` 的 `PIX_REV` 和 `sw.js` 清單的 `?v=` 一起 +1（檔名相同、內容不同時，舊程式才不會混到新圖）；
  - `python3 art/tools/pixel_parts.py`：每張用自己外框的粗細算出「一格像素多大」統一縮放，**不用和別張對齊**；輸出 `public/room/pixel/` 的 `body_<衣服>_front|side|back|walk0-3.webp`、`head_<髮型>_front|side|back.webp`，脖子固定在畫布 (133.5, 225)，頭的下巴蓋在脖子上；
  - 任何頭都能疊任何身體；站著正面、走路側面的頭＋4 格身體（每格 0.15 秒），往左走整個翻面；
  - 教訓：不要從「一整個人」的圖裡挖頭髮或切脖子——GPT 每張都會偏移縮放，疊起來會有雙線和接縫；
  - **表情**：日記的 10 種心情各一張「只有臉」的圖 `face_<心情>.webp`，站著時疊在正面的頭上（走路側面不疊）；房間顯示今天的心情，記完一筆時先顯示那則的心情 3 秒；首頁和「我」的頭像也一樣。`#scene` 的 `data-pixface` 是目前的表情。記一筆的心情選項用 `icon_<心情>.webp`（同一支工具輸出的小頭像）。
    - 來源 `art/source/pixel2/faces.png`（GPT 照 `head_bob.png` 畫的 5×2 顆正面頭）＋單獨重畫的 `face_miss.png`；`python3 art/tools/pixel_faces.py` 只取每顆的臉（瀏海下面的皮膚＋五官），各自量範圍縮放到房間正面頭的臉上，所以 GPT 畫的大小不同也沒關係。重畫某個表情：放單張圖、加進工具的 `EXTRA`。
    - 提示詞要點：附 `head_bob.png`＋`faces.png`，五官、眼淚、汗都要在臉的皮膚範圍內，頭外面不要有符號；「想念」要照 🥺 畫（水汪汪大眼、眉毛上揚、噘嘴），不然會跟感動、平靜撞在一起。
  - 髮色可以換色；加新髮型／衣服：放進 `art/source/pixel2/`、跑工具、在 `room.js` 的 `STYLE_LOOKS.pixel` 加選項、`sw.js` 加檔案。
- 表情由心情決定（經典角色）：`faceFor(emo)` 把 happy/excited/love/moved 對到 `happy`、angry 對到 `angry`、其他對到 `smile`。
- 圖層順序：`hair_*_back → body → cloth → face → hair_*_front → sym_*`。
- 圖層尺寸是 267×420，腳底在 (108.8, 418.6)。
- 新增髮型、衣服或表情：用 `art/` 的流程產出 webp，再加進 `LOOKS`／`faceFor`、`sw.js` 的 assets，並更新測試。

## 測試

```bash
npm i -D playwright && npx playwright install chromium   # 第一次
tests/run.sh                 # 離線測試，13 支約 330 項，應全部通過
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
3. `privacy.html` 的聯絡信箱還沒填（等使用者提供）。
4. 「人生重播」還在用舊的像素場景（scene.js／avatar.js），之後要改成房間風格。
5. 舊的遠端分支（ai-story、cloud、garden、redesign、release-prep 等）等使用者自己刪除。
