# wowo — 交接文件（給接手的 Claude／開發者）

> Claude Code 會自動讀這個檔案。換帳號、換電腦（例如 Warp 終端機）時：
> ```bash
> git clone https://github.com/hsiuz988/wowo.git && cd wowo
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

### 產品原則（參考 Cyworld、無名小站的成功與失敗；使用者定案，做功能前先對照）

**核心定位**：懷舊是入口，不是護城河。真正的護城河是「我的朋友都在這、我的回憶安全地在這」。在分享太公開、太表演、太累的時代，提供一個私密、輕鬆、有歸屬感的空間。

該做：
1. **一個人也好用，朋友來了更好**（最重要）：日記、小幸福、給未來的信一個人就有價值，社交是加分。Cyworld 的小窩要有人來看才有意義，朋友一走就塌了。
2. **小圈子、真關係**：只有互相連結的人（像 Cyworld 的「一村」），沒有追蹤數、公開頁、陌生人。
3. **個人空間即身分**：小窩、換裝、家具、MSN 狀態是自我表達，而且要確保有人會來看（串門子）。
4. **慢節奏的回訪儀式**：誰來過、紙條、一起的回憶、給未來的信，取代演算法推播。**知道「誰」來過，不顯示「幾個人」來過。**
5. **從成對的關係冷啟動**：邀一個最重要的人一起用（情侶、閨蜜、家人），不是一次拉一大群。
6. **回憶不被鎖住**：從第一天就有完整匯出，而且匯出的東西不用 wowo 也看得懂（備份 ZIP 裡的「回憶.html」）。
7. **不靠廣告的收入**：雲端空間訂閱、房間主題和家具、實體年度回憶冊。裝飾類收入要「自己看也開心」，不能只靠朋友來看才有價值。

不該做：
1. 只把懷舊網頁搬到手機：要手機原生；但**不追短影音、即時聊天**（會變回快節奏、要回應、要表演），AI 只用來幫人「記下來」。
2. 為了成長稀釋核心：每加一個功能都問「它讓回憶更安心，還是讓人更累？」（無名被併購後拿掉功能、強迫合併帳號、變慢，用戶就走了）。
3. 輕忽資安與隱私：信任就是產品本身。私人是預設、每一層分享各自有開關（紀錄、小窩、心情表情、每一歲的一句話）、伺服器端過濾。
4. 製造數字焦慮：不打卡、不連續天數、不排行、不顯示訪客數或人氣。
5. 把懷舊當護城河：懷舊讓人回來看一眼，留住人的是關係和回憶。
- 承諾（寫在隱私權頁）：停止服務至少提前 6 個月通知、期間照常可匯出、之後雲端資料全部刪除。


- 首頁是**等角視角的小房間**（大頭妹風格），點家具會打開對應功能。
- 整體比例是 **40% 遊戲感、60% 日記工具**。
- 插畫以外的工具介面都用**乾淨簡約的白色介面**：白底，粉色只當強調色。**不要用「粉色＋墨色」的組合**。
- 預設淺色主題；設定裡可以切換深色。
- **配色有六套**（使用者定案），在「我 → 外觀與其他 → 配色」選，存在 localStorage `lifey.palette`（每台裝置不同），`<html data-palette>`；`index.html` head 的 inline script 開機前就套用。
  - 花系列（基礎色）：繡球花 `hydrangea`（原本的冷灰藍＋邦迪藍）、**長春花 `periwinkle`（預設，不設 data-palette）**、櫻花 `sakura`（奶油＋粉）。
  - 甜點系列：草莓巧克力 `berrycocoa`（粉＋咖啡）、芒果布丁 `mango`（黃＋橘）、薄荷巧克力 `mintcocoa`（薄荷＋可可）。
  - **主要按鈕是「柔光果凍」**（使用者定案，原本的邦迪藍果凍負擔太重）：`--cy-cta-top`／`--cy-cta-bot`（主色和白色混 72%／90% 的上下漸層）、`--cy-cta-edge`（3px 底邊），沒有中間的硬反光線，按下去往下沉 2px；全站 `.btn.primary`、`.save-pill`、註冊頁的大按鈕都用它，跟著配色自動算。
  - 顏色都在 `cy.css` 最上面的變數（`--cy-desk`、`--cy-frame`、`--cy-aqua` 主色、`--cy-blue` 標題字、`--cy-pop` 數字標籤…）；**其他規則不要再直接寫色號**。新增一套：多寫一段 `:root[data-palette="…"]`，再加進 `app.js` 的 `PALETTES` 和 `tests/e2e/palette.test.cjs`。
  - 房間、電視、記一筆的日期黃章這些插畫色不跟著換。
- 底部有四個分頁：首頁、回憶、地圖、我。中間的 ＋ 是「記一筆」。

### 房間裡的熱點 → 功能（`public/room.js` 的 `.hot[data-name]`，處理函式由 `app.js` 傳入）

| 物件 | 功能 |
|---|---|
| 書桌日記本 `diary` | 記一筆 |
| 牆上月曆 `calendar` | 心情月曆（目前打開心情花園） |
| 電視 `tv` | 出生那年的世界大事（`room/tv_on.webp` 是開機貼片） |
| 書桌抽屜 `letter` | 給未來自己的信（桌上的信紙拿掉了，使用者定案） |
| 書架 `shelf` | 隨機一則回憶 |
| 牆上照片 `photos` | 照片 |
| 盆栽 `plant` | 心情花園 |
| 點人物 | 跳一下、說句話（換裝從「我」的個人卡進去） |
| 檯燈、床、時鐘、窗戶 | 小互動：開關燈、睡覺、報時、天氣 |
| 門 `door` | 串門子：去連結的人的小窩（只有一位就直接去，多位先問去誰家；沒連結的人時小人說先去邀請） |
| 書桌上的紙條 `note` | 有人留紙條時才出現（`Room.showNote`），點了打開紙條匣 |

### 像素房間

- 素材 `art/source/room2/`：`full_v3.webp` **現在的房間**（GPT 照 `full_crt.png` 重畫、拿掉書櫃左邊的垂吊植物；使用者定案）、`full_crt.png` 上一版（GPT 拿舊房間改的：粉色映像管電視、拿掉桌上信紙、清空層架上的擺設和窗邊吊盆、電視櫃上的鬧鐘）、`full.webp` 最早的完整房間（熱點、走路範圍、窗戶、夜晚圖都是照它量的）、`empty.webp` 空房間、`furniture.webp` 大型家具（床畫錯方向，之後從 full 切）、`small.webp` 小物件。
- `python3 art/tools/room_pixel.py` → `public/room/pixel_room/room.webp`（`full.webp` 補齊地板前角、畫布 1536×1064，再把現在的房間（`room_pixel.py` 的 `EDIT`）放大、用邊緣比對對回去，所以座標不用重量）、`tv_on.webp`（電視畫面用仿射貼到映像管螢幕上，照螢幕的圓角裁）。換圖後依序跑 `room_pixel.py` → `room_night.py` → `room_window.py`，再把 `sw.js` 的 VERSION +1。GPT 畫的外框左右不一致（左牆頂太細、右前方地板底邊沒有線），`even_outline` 沿量出來的直線補一條約 3px 的深咖啡線（左牆頂、左右兩條地板底邊），四邊才一樣粗。地板前角維持尖角（試過水平切角，使用者決定不要）。**房間背景、夜晚、窗外、生活印記家具用平滑縮小（`.room-art`，`image-rendering: auto`）**：它們是柔和插畫，用 `pixelated` 縮小會跳掉像素，邊緣鋸齒、外框斷斷續續（使用者說「破破爛爛」）；只有小人維持 `pixelated`。
- 再請 GPT 改房間：**附舊房間、用編輯模式、一次只改一兩樣**，並列出要保留的細節（重畫整間的版本使用者都覺得比較差：比例變真實、家具變小、前面地板太空、透視歪）。
- `room.js`：地板 `O/EU/EV`、`BLOCKS`（家具佔的地板，u 沿右牆、v 沿左牆）、`HOTS` 都是照這張圖量的；換房間圖要一起重量。
- 之後做金幣商店：空房間＋一件件家具疊上去。

### 首頁的順序（使用者在設計稿「首頁 V3」定案）

1. 最上面：**「16 歲又 15 天」**（從今年生日算起，生日當天顯示「生日快樂！」）｜**♡ N 個小幸福**（`state.joyLog` 筆數，愛心會撲通跳），右邊 BGM。
2. 個人區：大頭照（點了換樣子）；名字＋**MSN 狀態**（`state.profile.status`：在線上／忙碌中／馬上回來／外出中／想一個人靜靜／正在耍廢，點了出選單）；下面是 **MSN 個人訊息框**（`state.profile.msg`，最多 40 字，使用者自己寫，空的時候顯示「<寫下想說的話>」）。
3. 最新動態（原 Updated news）：最近三筆日記（日期、[日記]／[相簿]、內容），「全部 ›」去日記分頁。
4. 房間（沒有「Mini Room」標題、沒有歲數小標）→ 累積幸福 → 備份提醒 → 今日卡（一次一張）→ 親友說（只有連結了家人或朋友才出現；最上面是「去○○家」和一起的回憶卡）。
- 首頁**沒有**「今天過得怎麼樣？」入口和四格數字（數字在「我的」）。

### 房間小人說話的口吻

- **小人＝玩家自己**，一律用第一人稱說心聲（「這是我的小窩～」「有一封信在等我打開」），不是旁白，也不安慰玩家；安慰之後交給寵物、家人。
- 記一筆後照那則的心情說 `room.js` 的 `MOOD_LINES`（使用者定案的台詞，10 種心情各 2～3 句隨機）；累、難過、生氣、緊張、想念（`QUIET_MOODS`）不跳、不冒星星。

### 第一次使用（OB）

名字、生日 → 選樣子 → **直接進房間**，小人說「點書桌上的日記本，寫下今天吧」。沒有歡迎頁。
- 被邀請的人（`#invite=`）填完資料就先問 Face ID 建帳號（才能連結）。
- 其他人**記完第一筆**才問要不要開雲端（`offerCloudAfterFirst`，`state.prefs.cloudOffered` 記住只問一次）。
- **註冊頁沒有 Face ID**（使用者定案）：換手機的人也先填名字生日進來，再到「我 → 雲端與家人」用 Face ID 登入；手機上還沒寫東西時，登入後直接換成雲端的資料（`afterLogin`）。
- 註冊頁是老視窗風格，**只有 logo 和表單**（使用者嫌標語、跑馬燈、狀態列太雜，拿掉了）：logo 一進註冊頁主動說第一句（只說一次），之後點了才跳一下說下一句；打字機等插圖說完第一句約 1 秒後才開始打（錯開，視覺不跳）、視窗標題固定是「建立你的小窩」（不放名字）、選好生日**不**顯示星座和在地球上幾天（使用者拿掉了）、標題列 _ □ × 點了視窗抖一下、logo 說話（`setupDelight`）。

### 記一筆：電子手帳（使用者定案：介面跟著家具的造型走，但要好用）

- 點點桌面上一本活頁筆記本：上面一頁是**液晶日期戳記**（`dateStamp`：今天 · 10.21 WED／不是今天變黃色）、**橫線紙**（行高 32px，預設 4 行，`growText` 跟著字長高）、照片小格；下面三張小卡 **MOOD／TAG／MORE 全部攤開**，沒有「更多」開關，也沒有底部工具列。
- 區塊標題用像素字（DotGothic16）白字邦迪藍底，和首頁的 TODAY IS.. 一致。
- **標籤、人物是原地亮燈**（`.chip.led`）：順序固定、字的粗細不變，點了左邊 LED 亮起來；依寫的字建議的是虛線＋右上小黃點，不會搬到前面。
- 心情 10 個表情排 5×2；值得記住、分享是 LED 撥桿開關。
- **電視是新聞報導**：映像管畫面（LIVE、CH.出生年 WOWO NEWS、頭條、跑馬燈），下面是好讀的列表。
- 其他家具之後也照這個方向（信紙、月曆…），但工具本身要保持清楚好按。

### 註冊頁

- logo 是兩張圖：插圖 `brand/setup_hero.webp`（女孩和貓趴在床上，**不會一直飄**，點了才跳一下說話）＋ `brand/logo_text.webp`（wowo! 字，壓在床緣上）。原圖在 `art/source/brand/setup_hero.png`、`logo_text.png`，換圖後跑 `python3 art/tools/setup_logo.py`（清掉 AI 去背的雜點、裁邊、縮成 2 倍大小）→ 打字機一句話（`typeTagline`：輪流打出三個特點，停在「把一輩子，慢慢記下來」只跑一輪；**點表單或其他東西都不會打斷**，使用者定案）→「建立你的小窩」視窗（名字、生日）→ 視窗底部凹下去的狀態列寫四個特點。
- 標題列的縮小／放大／關閉**只是裝飾，不能點**（使用者定案，不要再加互動）。
- **App 圖示**：原圖 `art/source/brand/app_icon.png`（女孩和貓趴在床上的圓角方框），`python3 art/tools/app_icon.py` → `public/icons/`（切掉白底和最外圈深藍線，淡藍邊框填滿；maskable 縮到 80%；favicon 保留外框、透明底）。檔名不變，換圖要把 `sw.js` 的 VERSION +1；已經加到主畫面的 iPhone 要重新加入才會換圖示。舊的 `brand_icons.py` 不再輸出圖示。

### 輸入框、下拉選單（全站同一套，在 `cy.css`）

- 淡底（`--panel-2`）、細框（`--cy-field-line`）、圓角 4px、內側淡陰影；聚焦是白底＋主色框＋淡光暈（都跟著配色走）；至少 44px 高、字 16px、**字重 500**（不跟著外層 label 變粗）；下拉選單右邊是像素 ▼。
- 各頁**不要再自己改**框線、底色、圓角（只能改寬度、排版）。例外：記一筆的橫線紙、首頁個人訊息的小欄位。
- 生日一律用「年／月／日」三個下拉選單（`enhanceBirthday`，輸入框加 `bday-native`），包括人物、寵物；記一筆的日期、回憶的確切日期用原生日曆。
- **下拉選單不用原生的彈窗**：`fancySelect(select, { title, cols, short, group, start })` 在 `<select>` 前面放一顆長得跟輸入框一樣的按鈕，點了開復古小視窗（年每 10 年一組、一排 5 格，沒選過先停在 30 年前；月 4×3；日一排 7 格）。原本的 `<select>` 藏著存值（`.fselect-native`），程式改了值要呼叫 `select.refreshFancy()`。雲端頁的選單也用它。
- 測試要點「送出」請寫 `#setup-form button[type=submit]`（表單裡第一顆按鈕現在是年份選單）；找下拉選單用 `select:nth-of-type()`，不要用 `nth-child`。
- `replaceChildren` 不能傳 `null`（會印出「null」字樣），可能沒有的區塊要先 `.filter(Boolean)`。

### 今年的狀態

- 沒有相關紀錄的那一項是 **0**，畫面顯示「–」；一整歲都沒有紀錄時下面說「記下第一筆就會開始長大」。不要再給假的底分（舊版是 20／幸福 50）。

### 日記、地圖、返回鍵（第三批流程優化定案）

- **日記**：一次看一歲，自己的紀錄和打開過的信**新的在上面**，「這一年」（不確定日期）排最後；世界大事收成「🌏 N 歲那一年的世界 · N 件」一列，點了才展開，台灣／全球在展開後選。篩選只有一排，多的左右滑。
- **地圖**：點過去的格子打開「這一歲」抽屜（`openYear`：一句話、狀態、看日記、記一筆、補回憶、年度卡），**不跳分頁**；按「看這一歲的日記」才去日記分頁。未來的格子是寫信。「最幸福的一歲」要那一歲至少 3 則有心情才顯示。
- **返回鍵**：有抽屜開著時，瀏覽紀錄上固定墊**一筆**（`syncHistory`）；返回鍵關最上層的抽屜（草稿照樣先問），全部關掉再退掉那一筆。不要改成每個抽屜各墊一筆（「繼續編輯」之後會少算一筆，下一次返回就離開 App）。

### 我的幸福（原名「累積幸福」，`public/joys.js`，依 PRD v1.0 分階段做）

- 畫面上一律叫「**我的幸福**」（使用者定案），程式內部名稱照舊用 joys。

- 首頁房間下面**常駐 2 排 × 5 顆**按鈕（最多 10 個，多的在「全部」）。新使用者一進來就有預設的 10 個（`DEFAULT_JOYS`：喝到好喝的、吃到好吃的、看見漂亮的風景、好好睡了一覺、被稱讚了、收到小驚喜、聽到喜歡的歌、遇到可愛的貓狗、出外旅行、和重要的人在一起），可以刪除或新增；`seedJoys` 只放一次（`state.prefs.joysSeeded`），id 固定 `joy-<圖示>`、`updatedAt` 是 2000 年，兩台手機同步不會變兩份，刪掉也不會復活。
- **每個小幸福一天只記一次**（使用者定案，不要再加「一天多次」）：今天有就點亮 ✓，想留細節就寫成日記，不數次數、沒有 ×N。
- **點一下＝收藏**，按鈕原地亮起（位置不動），跳出**從底部打開的抽屜** `#joy-ask-dialog`（`showAsk`，問題照圖示 `ASK`；使用者定案：modal、從底部打開，不是按鈕下面的卡片，也不是置中）：有寫按「記成日記」就存成今天的一篇日記（moment 帶 `joy: joyId`）；「不用了」關掉；「復原」取消這次。**今天已經亮的再點一下＝直接取消勾選**（使用者定案，不跳視窗），提示上有「復原」。長按放開打開詳情。「我」選單也有入口。
- **排序用拖曳**（使用者定案，`sortable`）：「全部」頁按住右邊的 ⠿ 把手拖（清單比畫面長時拖到邊緣會自動捲動）；首頁按鈕長按 0.45 秒後拖。前 10 個放首頁。
- `show()`／`replaceChildren` 收到 null 會印出「null」字樣，可能沒有的區塊一律 `.filter(Boolean)`（之前編輯頁、全部頁出現過「null」）。
- 首頁最上面是「**今天 ♡ N 個小幸福**」（`todayJoyCount`：今天點亮了幾個不同的），不累加。點了要呼叫 `ctx.onCount` 立刻更新。
- 資料：`state.joys`（`{id,title,icon,order,archivedAt,updatedAt}`；舊資料可能還有 `mode`，不用理）、`state.joyLog`（`{id,joyId,date}`）。天數、本月、今年都從 log 算；**舊版同一天留下好幾筆不刪，只算一天**（`dayCounts` 每天最多 1），取消那天就全部一起拿掉。
- 刪除＝墓碑（`state.deleted`）；同步和匯入都用 `mergeJoyData` 逐筆合併，兩台手機同一天各點一次會留兩筆。
- 規則：可以補記過去、不能記未來；月曆點一天就是有／沒有；統計一律用「天」；連點 350ms 內只算一次。
- 用語：收藏／發生了／小幸福，**不要**打卡／達標／積分／連續天數／排行榜。
- 圖示：`python3 art/tools/joy_icons.py` 把 `art/source/joys/sheet.png`（6×4 張圖示表）去背切成 `public/joys/<key>.webp`（白底預覽 `preview.png`）。太陽、閃光、耳機在表裡光暈太重（`SKIP`），改用單張白底重畫的 `art/source/joys/<key>.png`（會蓋過表裡的）。24 個都有像素圖了；新增圖示要加進 `joys.js` 的 `JOY_ICONS`（emoji 備用）和 `sw.js`。
- **生活印記**（Phase 3）：同一個圖示的小幸福收藏滿 `IMPRINT_DAYS`（10）個不同日子 → 跳出「房間多了一件東西」，選「放到房間」或「先收著」；拿到就永久（刪紀錄不收回）。
  - 資料 `state.imprints`：`{id:key, key, joyId, at, shown, updatedAt}`；同步用 `mergeImprints`：日期留最早、`shown` 照最新。
  - 設定 `public/joys-config.js` 的 `IMPRINTS`：每件家具在房間的位置（底部中間 x,y）、大小、疊放順序 z、放在地板上的擋路半徑 r；改數字不用動程式。
  - 圖：`python3 art/tools/imprint_items.py` 把 `art/source/furniture/<key>.png`（GPT 白底單張）去背、縮到房間大小、外框重畫成房間的粗細顏色 → `public/room/imprints/<key>.webp`；新增要加進 `WIDTH`、`IMPRINTS`、`sw.js`。
  - **多選一的擺放位置**（使用者定案，取代原本的「新家具直接疊上去」）：`joys-config.js` 的 `SLOT_OF` 把 32 個圖示分到 22 個位置（`SLOTS` 是位置名稱），同一個位置一次只放一件。拿到新家具時位置已經有東西，視窗問「換上（原本的收起來）／先收著」；收藏冊的按鈕是「放到房間／換上／收起來」。`shownImprints` 和伺服器 `sharedView` 都是新放的在前，`onePerSlot` 每個位置只留第一件（兩台手機各放一件時，留最後放的）。多選一的位置：書桌左邊 coffee／cake、床上 cat／game、書櫃旁地板 gift／workout、地毯中間 meal／cook、電視櫃上（電視右邊）sun／movie／sing／call、門邊地板 umbrella／shop／clean、門上掛鉤 bath／bike。
  - 擺放規劃（使用者定案）：**32 件家具都有圖了**，完整的 22 個位置見 `SLOT_OF`、座標見 `IMPRINTS`。**大小以熊熊為現實比例參考**（使用者定案：瑜珈墊比熊熊高、書和熊熊差不多高）。
    - 書桌左邊 coffee 拿鐵（只有杯子，和蛋糕一樣大）／cake；書桌上的紙條位置不變。角落層架長邊：home 全家福（左）、camera 拍立得（右，只有相機）；角落層架短邊：music 旋轉木馬音樂盒（使用者把唱片機換掉，舊圖 `music_turntable.png`）。窗台 plant、窗簾桿 sparkle 串燈、窗戶旁的牆 sunset 明信片（兩個 `SHEAR` -0.49：負的是往右上升）。
    - 床上 cat／game；書櫃頂 sneaker 地球儀、paw；書櫃旁 gift／workout；小熊旁 book；地毯中間 meal／cook（同一張小矮桌換成一鍋湯）；地毯左前方 hearts 兩雙室內拖鞋（放在地毯外面，不疊到地毯；取代愛心氣球，舊圖 `hearts_balloons.png`）；前方地板 icecream 懶骨頭。
    - 電視櫃最左格目前空著；電視櫃上（電視右邊）call／sun／movie／sing（站在桌面中間；電話用 `imprint_items.py` 的 `ROTATE` 轉 11 度，和櫃子平行）；門邊地板 umbrella／shop（只有一個袋子，舊的兩袋 `shop_two_bags.png`）／clean；門前 letter；門上掛鉤 bath／bike（GPT 直接畫成斜掛在門上的角度，**不要再用 `SHEAR` 自己斜**，使用者定案；舊的正面圖 `bath_front.png`、`bike_front.png`）。
    - 舊模型圖留著備用：`camera_tripod.png`、`cloud_beanbag.png`、`coffee_pot.png`、`hearts_balloons.png`、`shoes.png`、`music_turntable.png`、`shop_two_bags.png`。
  - 收藏冊在「累積幸福 → 全部」最下面，32 格（`JOY_ICONS` 全部）。
- **使用者在小幸福選單（artifact）選了 32 個**：原本 24 個，加上 game 玩了喜歡的遊戲、cook 自己做了一頓飯、shop 買到喜歡的東西、workout 去運動了、movie 看了好看的電影、clean 把房間整理乾淨、call 和好久不見的人聊天、sing 大聲唱了歌。這 8 個已加進 `JOY_ICONS`（emoji）和 `ASK`，但**還沒有像素圖示**：不在 `JOY_PIX`，所以不能選來當小幸福或紙條貼圖（`PICKABLE_ICONS`），收藏冊顯示「即將推出」；圖做好放進 `public/joys/`、加進 `JOY_PIX` 和 `sw.js`，再加進 `SUGGESTIONS`。原本只有圖示的 6 個補了名稱，加進建議：被抱抱了 bear、照顧了植物 plant、完成了一件事 sparkle、雨天也很好 umbrella、吃到冰淇淋 icecream、騎車出去晃晃 bike。
- 之後：Phase 2 幸福星罐、Phase 4 年度回顧卡、日記時間軸上的小印章；新房間草稿在 `art/source/room2/room_*.webp`（之後做換房間時用）。

### 串門子＋一起的回憶（Cyworld／無名小站方向；使用者定案，三期都做完了）

產品方向：wowo 整體往 Cyworld／無名小站靠。
1. **串門子**（Cyworld）：去連結的人的小窩、留紙條、誰來過。
2. **一起的回憶**（無名「在別人的相簿找到自己」）：見下面。
3. 收進我的日記、客人站在門口、開放連結朋友。

原則：只在連結的人之間；私人是預設（只有「💞 分享」的紀錄看得到）；**不顯示訪客數、人氣、排行**，只說「誰來過」；紙條不做已讀、不做回覆串（想回就去對方家留一張）。

- 入口：自己房間的門、首頁「親友說」最上面一排「去○○家」（`.cy-visit`）、「看家人的人生」標題旁的「🏠 去小窩」。
- 對方的小窩 `#visit-dialog`：MSN 狀態、個人訊息、對方的小人（今天的心情表情）、擺出來的生活印記。`Room` 的第二個實例（`new Room(box, on, { guest: true })`，id 加 `visit-` 前綴；擋路的生活印記是模組變數，`use()` 輪流換）。點對方的小人說出她最近分享的一則；點書桌留紙條、書架／電視／照片看紀錄、抽屜「不可以偷看」、門回自己的小窩。對方還沒選樣子：「還在佈置中」；對方關了：「把小窩的門關起來了」，還是可以留紙條。
- 紙條：一張貼圖（24 個小幸福圖示）＋最多 40 字，同一人一天最多 10 張，30 天後自動清掉；收到的人書桌上出現紙條（新的會跳），紙條匣可以「回訪」「收起來」。
- 誰來過：打開別人的小窩就記一筆（一天一列）；自己打開 App 時小人說「○○留了紙條給我耶」或「今天○○來過我的小窩耶！」，同樣的內容一天只說一次（localStorage `lifey.visitSaid`、`lifey.notesSeen`）。
- 隱私開關（「我 → 雲端與家人」，存在 `state.profile`，預設都開）：`shareRoom` 讓連結的人來我的小窩坐坐、`shareMood` 看到我今天的心情表情（只有最近一則的表情，不含內容，私人的紀錄也算）。
- 伺服器：`sharedView` 多了 `profile.status/msg` 和 `room: { imprints, mood }`；D1 `notes`、`visits`；API `POST /api/members/:id/visit`、`POST /api/members/:id/notes`、`GET /api/inbox`（紙條＋今天、昨天來過的人，只算還連結著的）、`DELETE /api/notes/:id`；解除連結時兩邊的紙條、來訪紀錄一起刪。
- **客人站在門口**（`Room.showGuests`，門邊最多兩位，`#scene` 的 `data-guests`）：自己的房間是今天來過的人（要對方選好樣子），點了小人說「今天○○來找我玩～」；別人的小窩是我自己。
- **一起的回憶**：對方記一筆時標了「對到我的人物卡」（對方那邊 `links.person_id`）而且分享 → `sharedView(doc, youId)` 給那則加 `withYou`（不送 `people`，不露出對方標的其他人）。
  - 首頁「親友說」最上面一張卡「📷 Ken記下了和你的一天」（`togetherCard`，一次一張，看過就收；localStorage `lifey.togetherSeen`）。
  - 日記那一歲穿插一則「Ken記下的」（`renderTogether`，紙膠帶虛線框），點了打開 `#together-dialog`。
  - 牆上照片（`wallPhotos`）也會輪到一起的回憶的照片。
  - **收進我的日記**（`collectTogether`）：複製成自己的一則（照片下載存一份、不分享、人物標成對方的人物卡），moment 帶 `from: { userId, name, momentId }`，時間軸顯示「📷 來自Ken的回憶」，原本那則就不再穿插；出生前的日子放到 0 歲（approx）。
- **連結朋友**：連結本來就不限家人（人物卡關係可以選朋友、同學、同事）；首頁區塊改叫「親友說」，雲端頁是「連結的家人和朋友」。
- 測試：`tests/e2e/visit.cloud.cjs`（兩個帳號互相串門子、紙條、客人、一起的回憶、收進日記、關起小窩的門）。

### 「我」分頁

**「我的」就是設定首頁**，沒有 ⚙ 和第二份選單。依序是：個人卡（點頭像打開衣櫃；「我的衣櫃」「編輯名字、生日」兩顆按鈕；換裝視窗標題也是「我的衣櫃」，第一次註冊時是「選你的樣子」）、統計、**家人／伴侶與寵物**（「全部 ›」是人物與寵物唯一的入口），以及選單：給未來的信、雲端與家人、天氣、備份與資料、外觀與其他。
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
  - 夜晚圖是照 `full.webp` 畫的；白天換成 GPT 改過的房間後，工具算出「夜晚／舊白天」的光線比例（模糊過），套到新的白天房間上；拿掉或換掉的東西（`room_night.py` 的 `CHANGED`）用周圍的光線補。之後白天房間再改，要把改的範圍加進 `CHANGED`。
- 新增景色：用**同一間空房間只換窗外**的圖放進 `art/source/room2/window/<名稱>.webp`，加進 `art/tools/room_window.py` 的 `KINDS`，跑一次，再改 `windowView` 和 `sw.js`。

### 備份匯出

- 「我 → 備份與資料」匯出 ZIP：`data.json`（匯回用）、`photos/<id>.jpg`／`-thumb.jpg`、**`回憶.html`**（`memoriesHtml`：照年齡排好、附照片、一年的一句話、打開過的信，inline CSS、印得出來；解壓縮後用瀏覽器打開，不用 wowo）。匯入只看 data.json 和 photos。

### 背景音樂

- `public/music.js` 的 `TRACKS` 有三首，玩家在「我 → 其他」選（`lifey.track`），選了就順便打開音樂。都是 Pixabay 授權（可商用、不需標註）：
  - 早晨咖啡 `music/room.mp3`：〈Cafe Lofi〉zephiramusic（預設）
  - 慵懶午後 `music/chill.mp3`：〈Chill Cafe Lofi Beat〉tunetank
  - 晴天爵士 `music/sunny.mp3`：〈Lofi Jazz Trio Sunny Cafe〉Alex Morgan
- 新增曲子：用 ffmpeg 壓成 112kbps、頭尾 0.3s／2s 淡入淡出，音量調到平均約 -16 dB（三首一致，換歌不會忽大忽小），再加進 `TRACKS` 和測試。
- 一首播完自動換下一首（最後一首接回第一首），`initMusic` 的 `onTrackChange` 會更新首頁的歌名。
- 檔案抓不到時打開開關會提示並關回去。
- 預設關閉，開關存在 localStorage `lifey.music`（每台裝置不同）。首頁右上角的 `#cy-bgm`（一直顯示歌名，播放時圖示是 ⏸、暫停時是 ▶；旁邊 `#cy-bgm-next` ⏭ 一直都在，按了播下一首），以及「我 → 其他」的 `#pref-music`。
- iPhone 要等使用者點畫面才能出聲，`audio.volume` 也沒作用，所以用 Web Audio GainNode 調音量（30%）和淡入淡出；切到背景時暫停。
- `sw.js` 不處理 mp3/m4a（播放時是分段請求，cache.put 存不了 206）。
- 換歌：Suno 免費方案的歌不能商用也不能下載；換成別首要確認授權可商用。

### 小窩全畫面

- Mini Room 右下角 `#room-zoom`：`.room-box` 加 `.full`、`<html>` 加 `.room-full`，房間鋪滿畫面（蓋過分頁列），再按一次、按 Esc 或換分頁就離開。
- 寬螢幕整間放進畫面；手機直向放大到畫面高度的六成、可以左右滑，一開始捲到中間。HUD 和放大鈕在全畫面時是 `position: fixed`，泡泡照樣跟著房間。

### 人物外觀（look）

> **只剩像素女孩**（使用者定案）：經典 `classic`、復古娃娃 `doll` 已經捨棄，換裝畫面不再有「角色」選項；`normalizeLook` 一律回傳 `style: 'pixel'`，舊資料裡的 classic／doll 也照像素女孩顯示。下面關於經典、娃娃的說明是舊程式的紀錄，那些程式和 `room/char/`、`room/doll/` 的圖之後可以整理掉。新的髮型、衣服由使用者生成後加進 `STYLE_LOOKS.pixel`。
>
> 換裝畫面（`renderLook`）：上面點點小舞台＋腳下影子，**點小人換表情**（10 種心情輪流，只是好玩不存）；下面 HAIR 髮型、CLOTH 衣服各一排小格（像素字標題同記一筆），選中的是主色框＋右上小勾，最後一格虛線「製作中」。

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

## 本機測試（使用者自己在電腦上開）

```bash
git pull origin develop
npm install          # 第一次，或 package.json 有變時
npm run local        # 打開 http://localhost:8787
```
- 用的是 wrangler 在本機模擬的資料庫和照片（存在 `.wrangler/`），**不會碰到正式或測試網址的資料**；Face ID（Passkey）在 localhost 也能用。
- 手機版面：Chrome 開發者工具（F12）→ 切換裝置（Ctrl+Shift+M）→ 選 iPhone。
- 手機實機要測（iPhone Safari、加到主畫面、Face ID）還是要推到 `develop` 用測試網址：手機連電腦的區網 IP 是 http，Service Worker 和 Face ID 都不能用。
- 在雲端 session 裡開的 localhost 使用者連不到；要給使用者先看，就推到 `develop`。

## 測試

```bash
npm i -D playwright && npx playwright install chromium   # 第一次
tests/run.sh                 # 離線測試，16 支約 390 項，應全部通過
tests/run-cloud.sh           # 雲端測試（本機 wrangler D1/R2 + 虛擬 Face ID），4 支
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
3. `privacy.html` 的聯絡信箱還沒填（等使用者提供）。隱私權頁已經寫了串門子、紙條、一起的回憶、匯出的回憶.html、停止服務的承諾。
6. 收入模式、冷啟動策略還沒做（見「產品原則」）；雲端帳號還沒有「自己刪除帳號」的按鈕（目前寫信要求）；日記在伺服器上不是端對端加密。
4. 「人生重播」還在用舊的像素場景（scene.js／avatar.js），之後要改成房間風格。
5. 舊的遠端分支（ai-story、cloud、garden、redesign、release-prep 等）等使用者自己刪除。
