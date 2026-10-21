# wowo — iOS App 上架與技術架構評估

> 評估對象：`develop` 分支（版本 0.0.62，commit 8819241）。
> 這份報告**只做評估，沒有改任何程式碼**、沒有安裝 Capacitor、沒有建立 iOS 專案。
> 標示說明：
> - ✅ **已由程式碼確認**：直接讀程式碼得到的事實。
> - 🔍 **需要實機測試**：程式碼看不出來，要在 iPhone 上驗證。
> - 📘 **Apple 官方規定**：App Review Guidelines 有明文（條號以審核當時的官網為準）。
> - 💡 **技術建議**／⚠️ **潛在風險**：我的判斷，不是確定結果。

---

## 0. 一頁結論

| 問題 | 回答 |
|---|---|
| 適不適合 Capacitor？ | **適合，而且是三個方案裡最適合的。** 專案是純 HTML/CSS/JS、沒有框架、沒有建置步驟，房間是 SVG＋圖片，這正是 Capacitor 最好處理的型態。 |
| 能保留多少程式碼？ | 前端約 **85–90%** 原封不動；後端（Cloudflare Worker）約 **90%** 保留，主要改登入方式。像素素材 **100%** 保留。 |
| 要改或重做什麼？ | 登入（Passkey 在 App 裡要換原生做法）、API 呼叫方式（cookie → token）、Service Worker（App 裡關掉）、匯出檔案／分享／邀請連結、返回鍵（Android）、帳號刪除（目前沒有，Apple 規定必須有）。 |
| 像素房間有重大風險嗎？ | **沒有重大技術風險。** 房間是 SVG 疊圖片、只有走路時才跑動畫，負擔很輕。需要實機確認的是「像素銳利度」和「全畫面縮放時的流暢度」。 |
| 要多久？ | 以**目前已有的功能**上架（不含公開日記、隨機相遇、訂閱）：約 **8–12 週**。加上訂閱：再 **2–3 週**。加上公開日記／隨機相遇／好友（含審核機制）：再 **6–10 週**。 |
| 有更好的方案嗎？ | 以目前專案來看**沒有**。React Native 要重寫幾乎全部畫面和房間；Swift 要全部重寫且放棄 Android。 |
| 第一步做什麼？ | **先解決「iPhone 白畫面」**（CLAUDE.md 待辦 #1）。Capacitor 用的 WKWebView 跟 Safari 是同一個引擎，這個問題沒找到原因前，包成 App 很可能一樣白畫面。接著做「登入與 API 改造」的設計確認。 |

---

## 1. 現有技術架構（✅ 全部由程式碼確認）

| 項目 | 現況 |
|---|---|
| 前端框架 | **沒有框架**。原生 ES modules，直接操作 DOM（`public/app.js` 約 3,500 行，自己寫的 `h()` 小工具建立元素）。 |
| 語言 | **JavaScript**（沒有 TypeScript、沒有建置／打包步驟）。 |
| UI／動畫／狀態管理套件 | **都沒有用第三方套件**。狀態是 `app.js` 裡的 `state` 物件＋`render()`；動畫是 CSS transition 和 `requestAnimationFrame`；音樂用 Web Audio。前端 `package.json` 沒有任何執行期套件。 |
| 部署 | Cloudflare Workers Builds：推上 GitHub 自動 `wrangler deploy`。`public/` 當靜態檔，`worker/` 只處理 `/api/*`（`wrangler.jsonc`）。 |
| 資料庫 | **本機**：IndexedDB（`db.js`）＋ localStorage。**雲端**：Cloudflare D1（SQLite），每個使用者的所有文字資料是 `docs` 表裡的**一整份 JSON**（上限約 1.8MB，`worker/data.js`），用樂觀鎖＋逐筆合併同步。 |
| 照片 | 前端用 canvas 重新壓成 JPEG（長邊 2048＋480 縮圖、順便去掉 EXIF/GPS，`photos.js`），存在 IndexedDB；開雲端後傳到 **Cloudflare R2**。 |
| 登入／會員 | **只有 Passkey（Face ID）**，用 `@simplewebauthn/server`；登入後發 `HttpOnly; SameSite=Lax` 的 session cookie（180 天）。沒有 email、密碼、Apple／Google 登入。**App 不登入也能完整使用**（本機優先），登入只是為了同步和家人連結。 |
| 後端其他 | AI 故事（`worker/story.js`，呼叫 Anthropic API，每人每天 5 次）、家人邀請與互看（`sharedView`）。 |
| 外部服務 | Open-Meteo 天氣（`weather.js`，直接從前端 fetch）、Anthropic API（只在 Worker）。 |

### 依賴瀏覽器特定 API 的功能（✅ 已確認，影響 Capacitor 的在右欄）

| API | 用在哪 | 包成 App 後 |
|---|---|---|
| `navigator.credentials`（WebAuthn/Passkey） | `cloud.js` 註冊、登入 | ❌ **不能直接用**（見 §3.1） |
| Cookie session、`fetch('/api/...')` 相對路徑、`credentials: 'same-origin'` | `cloud.js` | ❌ **要改**：App 的網頁來源是 `capacitor://localhost`，不是你的網址 |
| Worker 的同源檢查（`origin !== url.origin` 就 403） | `worker/index.js` | ❌ 要允許 App 的來源 |
| Service Worker | `ptr.js`、`sw.js`、`index.html` 開機安全網 | ⚠️ WKWebView 自訂協定下不支援 SW；App 裡檔案已內建，**直接關掉**即可 |
| `location.origin` 產生邀請連結 | `app.js` `#invite=` | ❌ 會變成 `capacitor://localhost/...`，要改成正式網址 |
| `<a download>` 下載備份 zip、匯出圖片 | `app.js` | ❌ WKWebView 不支援這種下載，要改成「存檔＋系統分享」 |
| `navigator.share` / `canShare` | `app.js` 分享年度卡等 | 🔍 WKWebView 支援度不一致，💡 建議直接改用 `@capacitor/share` |
| `navigator.geolocation` | `weather.js` | ✅ 可用，但 iOS 會問兩次（App＋網頁），💡 建議改用 `@capacitor/geolocation` |
| `<input type="file" accept="image/*">` | 選照片 | ✅ 可用（要在 Info.plist 寫相簿／相機用途說明） |
| Web Audio、`visibilitychange` | 音樂 | ✅ 可用 |
| `history.pushState` / popstate（返回鍵關抽屜） | `app.js` `syncHistory` | iOS 沒影響；Android 實體返回鍵要接 `@capacitor/app` 的 `backButton` |
| `navigator.storage.persist/estimate` | 備份提醒 | 🔍 WKWebView 回傳值可能不同，只影響提示文字 |
| `navigator.clipboard` | 複製邀請碼 | ✅ 可用（使用者點擊觸發時） |

---

## 2. 像素房間與角色系統

### 2.1 現況（✅ 已由程式碼確認，`public/room.js` 513 行）

- **渲染技術：SVG**（不是 Canvas、不是 PixiJS）。整間房間是**一張扁平的背景圖** `pixel_room/room.webp`（1536×1064，約 220KB），晚上換 `room_night.webp`，窗外天氣、電視開機各疊一張 `<image>`。用 `image-rendering: pixelated` 保持像素銳利。
- **地板與走路**：等角座標（`toXY`/`toUV`），家具佔用區是寫死的 `BLOCKS` 陣列，點地板用 **A\* 格子尋路**（48×48）再拉直路徑，`requestAnimationFrame` 只在**走路時**才跑，停下來就停止。
- **角色**：分層 `<image>` 疊圖（紙娃娃）。像素女孩＝身體＋頭＋表情，走路是 4 格身體輪流顯示（每格 0.15 秒，切換 `opacity`），往左走整組翻面。另外還有「經典」「復古娃娃」兩種角色（娃娃的手腳用 SVG transform 繞關節擺動）。
- **熱點互動**：`.hot[data-name]` 透明區塊，點了呼叫 `app.js` 傳進來的處理函式（日記、月曆、電視、信、書架、照片、盆栽、檯燈、床、時鐘、窗戶、門）。
- **家具擺放：❌ 目前沒有。** 家具是畫在背景圖裡的，不能移動、不能增減；`BLOCKS` 是照這張圖手量的。CLAUDE.md 寫的「之後做金幣商店：空房間＋一件件家具疊上去」**還沒開始**。素材 `art/source/room2/empty.webp`、`furniture.webp` 已有，但家具圖「床畫錯方向」。
- **素材量**：`public/room/` 共 69 個檔、約 1.4MB；像素女孩目前只有 1 個髮型、1 套衣服、10 種表情。

### 2.2 包成 Capacitor 後能不能沿用？

**可以直接沿用，不用改房間程式碼**（✅ room.js 只用 SVG DOM、rAF、`setInterval`，都是 WKWebView 原生支援的標準 API；圖片路徑是相對路徑 `room/...`，打包進 App 後一樣讀得到）。

### 2.3 效能與風險

| 項目 | 評估 | 類別 |
|---|---|---|
| 記憶體 | 房間背景解碼後約 6.5MB（日夜兩張約 13MB），角色每層 267×420 約 0.45MB，全部預載約 20 張共約 9MB。**合計約 25–40MB**，iPhone 上很安全。 | ✅ 由圖片尺寸推算 |
| 動畫掉幀 | 平常靜止不跑動畫；走路時每幀只改一個 `transform` 和幾張圖的 `opacity`，負擔很輕。A\* 每次點擊算一次（用 `sort` 當優先佇列，48×48 格子沒問題）。 | ✅ 程式碼判斷，🔍 實機確認 |
| 像素銳利度 | `image-rendering: pixelated` 寫在 SVG `<image>` 的 style 上。WebKit 對 SVG 內圖片的這個屬性支援過去不穩，可能變成模糊。 | ⚠️ **最需要實機看的一項** 🔍 |
| 全畫面放大（`#room-zoom`） | 手機直向會把 SVG 放到約 200vw 寬並可左右滑，iPhone 重新點陣化大 SVG 時可能短暫卡頓。 | 🔍 |
| 觸控 | 用 `click` 事件，viewport 已設 `width=device-width`，沒有 300ms 延遲問題。熱點是 SVG 區塊，點擊範圍要在實機確認夠大。WKWebView 的回彈捲動要關掉（Capacitor 設定）。 | 🔍 |
| 素材載入 | 打包進 App 後是本機讀檔，**比現在網頁版更快、更穩**（不用經過 SW 或網路）。 | ✅ |
| 未來家具擺放 | 如果之後一間房有幾十件家具、要拖曳擺放、要依深度排序，SVG 還是撐得住（數十個 `<image>` 沒問題）；若要上百個物件＋大量粒子特效，才需要考慮換 Canvas/PixiJS。**這與選哪個 App 方案無關**，三種方案都要另外做。 | 💡 |

**結論：像素房間沒有重大技術風險。** 真正的工作量在「家具擺放系統」本身（拆素材、深度排序、動態 BLOCKS、存檔、商店），那是新功能，不是轉換成本。

---

## 3. iOS 原生功能評估

| 需求 | Capacitor 做法 | 可行性 | 備註 |
|---|---|---|---|
| Apple Push（遠端推播） | `@capacitor/push-notifications`（官方） | ✅ 可以 | iOS 直接拿 APNs token；後端要新增存 token 的表，並在 Worker 用 APNs 金鑰（JWT ES256）發送。Android 走 FCM。 |
| 隨機時間的通知 | `@capacitor/local-notifications`（官方）**預先排好**未來幾天的隨機時間 | ✅ 可以 | 見下方 §3.2 |
| 相機拍照 | `@capacitor/camera`（官方） | ✅ | 現有 `<input type=file>` 也能用，但原生外掛可直接開相機、回傳品質較可控。現有的 `processPhoto()` 壓縮流程可沿用。 |
| 相簿存取 | `@capacitor/camera` 的 `pickImages` | ✅ | iOS 14+ 有「限制存取部分照片」，要處理。 |
| 照片上傳 | 現有 `fetch` PUT 到 R2 | ✅ | 只要改成帶 token、用完整網址。 |
| 系統原生分享 | `@capacitor/share` ＋ `@capacitor/filesystem` | ✅ | 取代 `<a download>` 與 `navigator.share`。 |
| App 內訂閱（IAP） | **沒有官方外掛**：RevenueCat `@revenuecat/purchases-capacitor`，或開源的 `cordova-plugin-purchase` | ✅ 可以，但要選第三方 | 見 §4.4 |
| Apple 登入 | 社群外掛 `@capacitor-community/apple-sign-in` | ✅ | **目前不一定需要**（見 §4.8），但可當作 Passkey 的備援登入。 |
| 離線資料儲存 | 現有 IndexedDB 在 WKWebView 可用 | ✅（⚠️ 小風險） | 見 §3.3 |
| 背景／前景切換 | `@capacitor/app` 的 `appStateChange` | ✅ | 現有 `visibilitychange` 也會觸發。回到前景時重新排隨機通知、同步。 |
| 安全區域、鍵盤 | 已有 `viewport-fit=cover` 和 `env(safe-area-inset-*)`（✅ 已確認）；鍵盤用 `@capacitor/keyboard` 調整 resize 模式 | ✅ 🔍 | 日記輸入框被鍵盤蓋住、底部分頁列跳動，要實機逐頁檢查。 |
| 深層連結、通知點擊導頁 | Universal Links（需在網域放 `apple-app-site-association`）＋ `@capacitor/app` 的 `appUrlOpen`；通知點擊用通知的 `extra` 資料 | ✅ | 現有 `#invite=` 邀請流程要接上；通知點下去打開「拍下當下」頁。 |

### 3.1 最大的技術改動：登入（Passkey）

✅ 已確認：伺服器的 Passkey RP ID ＝ 網址的主機名稱（`worker/auth.js` 的 `rp()`），也就是 `app.lifey.workers.dev`（測試版是 `develop-app.lifey.workers.dev`），而且 cookie 是 `SameSite=Lax`。

包成 App 之後：
1. 網頁是從 `capacitor://localhost` 載入，**WKWebView 裡的 WebAuthn 不會把這個來源當成你的網域**，`navigator.credentials` 不能用。⚠️
2. **解法（💡建議）**：用原生 Passkey 外掛（iOS `ASAuthorizationPlatformPublicKeyCredentialProvider`，社群有 Capacitor 外掛，或自己寫一個小外掛），App 加上 Associated Domains `webcredentials:app.lifey.workers.dev`，並在網址根目錄放 `/.well-known/apple-app-site-association`。原生 Passkey 簽出來的資料格式和網頁一樣，**伺服器的驗證程式幾乎不用改**，**舊使用者在網頁建的 Passkey 在 App 裡也能用**（同一個 RP ID、iCloud 鑰匙圈同步）。🔍 需實作驗證。
3. ⚠️ **重要：不要隨便換網域。** 如果之後買新網域（例如 `wowo.app`）並把 RP ID 換過去，**所有舊的 Passkey 都會失效**，使用者會登不進去。建議：Passkey 的 RP ID 固定用一個「永久網域」——要嘛一直用 `app.lifey.workers.dev`，要嘛**在正式上架前**就買好網域並一次搬好（搬的時候要做「登入中的人補建新 Passkey」的轉移流程）。
4. Cookie 在 App 裡是跨站的，WKWebView 預設擋第三方 cookie。💡 建議 App 改用 **Bearer token**（登入後回傳 token，存在 iOS 鑰匙圈／`@capacitor/preferences`），Worker 同時接受 cookie（網頁）和 token（App）。同源檢查要允許 `capacitor://localhost`。

### 3.2 隨機拍照通知（特別注意）

- ✅ 正確認知：**App 在背景時 JavaScript 不會持續執行**，`setTimeout`／`setInterval` 不能用來在背景觸發通知。
- 💡 **建議做法（v1，本機通知，不花錢）**：每次 App 打開或回到前景時，用 `@capacitor/local-notifications` **一次排好未來 7–14 天**每天一則隨機時間（避開使用者設定的睡眠時段）。通知由 iOS 系統負責觸發，App 關著也會響。點通知用 `extra` 帶參數，打開「拍下當下」相機頁。
  - 📘 iOS 對每個 App 待觸發的本機通知有數量上限（Apple 文件為 64 則），排 14 天綽綽有餘。
  - ⚠️ 如果使用者兩週都沒打開 App，通知會停。可在最後一則寫「好久不見」當作提醒。
- **如果要做成「所有人同一時間」（像 BeReal）**：要改用**遠端推播**：Worker 的 Cron Trigger 每天抽一個時間 → 向所有 token 發 APNs。APNs 本身免費，但要做 token 管理、失效清理、時區。建議 v2 再做。

### 3.3 離線資料（⚠️ 潛在風險）

- App 裡的 IndexedDB 存在 App 自己的容器內，一般不會被清，但 WebKit 的儲存政策對「網頁資料」理論上仍可能清除；且**使用者的日記是唯一副本**時風險很高。
- 💡 建議：短期維持 IndexedDB（不用改程式），但 **App 版首次啟動就強烈引導開雲端備份**；中期考慮把照片 Blob 移到 `@capacitor/filesystem`、文字資料移到原生 SQLite（`@capacitor-community/sqlite`），這是可以分階段做的，不需要一次改完。
- ⚠️ **網頁版 → App 的資料不會自動搬家**：主畫面 PWA 的資料在 Safari 的儲存區，App 是另一個容器。沒開雲端的使用者要用「匯出備份 zip → App 匯入」，或先開雲端同步。上架時要寫清楚搬家方法（現有的 zip 匯出／匯入功能可以直接用 ✅）。

---

## 4. App Store 上架風險

### 4.1 Capacitor 架構是否符合上架要求？
- 📘 Apple 沒有禁止 WebView 架構的 App；大量 Capacitor／Ionic App 在架上。
- 📘 Guideline 4.2（最低功能）明文：App 不能只是「重新包裝的網站」。
- 💡 判斷：wowo 的**網頁檔案打包在 App 內**、**可完全離線使用**、有本機資料庫、再加上相機／通知／分享等原生功能，**不屬於單純包網站**。⚠️ **千萬不要**用 Capacitor 的 `server.url` 直接載入線上網址，那樣最容易被 4.2 退件，也會失去離線能力。
- 📘 Guideline 2.5.2：App 不能下載會改變功能的程式碼。💡 所以**不建議一開始就用「線上熱更新」服務**（Capgo、Appflow Live Updates），每次改版就走正常送審。

### 4.2 現有功能夠不夠？（Guideline 4.2）
✅ 已實作：日記（心情、照片、標籤）、像素房間＋角色＋表情、人生地圖、心情花園、給未來的信、世界大事、家人連結、寵物／人物、年度卡、AI 故事、背景音樂、天氣、備份匯出。
💡 判斷：**功能量足以通過 4.2**，比一般日記 App 還豐富。風險較高的是「登入後才有東西」的情況——wowo 不用登入就能用，這點很好。

### 4.3 可能觸及 4.2 的部分
- 若審核人員看到的第一個畫面像網頁（例如有網址列、下拉更新整頁重載、外部連結開在 App 內）。💡 `ptr.js` 的下拉重新整理在 App 裡應改成「下拉同步」或拿掉。
- 「人生重播」還在用舊像素場景（CLAUDE.md 待辦 #4），風格不一致，不至於退件但會影響第一印象。

### 4.4 訂閱制與 Apple IAP
- 📘 Guideline 3.1.1：解鎖數位內容（家具、造型、房間主題、進階回顧）**必須**用 Apple IAP，不能導向外部付款（美國等特定地區另有例外，台灣**不適用**的前提下請以審核當時規定為準）。
- 📘 3.1.2：自動續訂訂閱要提供持續性價值；要在購買頁清楚顯示價格、週期、自動續訂說明，並提供「恢復購買」、使用條款與隱私權政策連結。
- 📘 雲端照片容量屬於 App 內服務，同樣走 IAP。
- 💡 技術做法：
  - **RevenueCat**（推薦起步用）：Capacitor 外掛現成、幫你驗證收據、處理續訂／退款／跨平台（之後 Android 共用），Worker 用它的 webhook 或 REST API 查會員狀態。費用：營收低時免費（依其官網現行方案，請自行確認）。
  - 或自己接 **App Store Server API ＋ Server Notifications V2**：免費但工程多 1–2 週，且 Android 要再做一次。
- 💡 **台灣價格**：要在 App Store Connect 確認 NT$49／NT$399 是否是可選的價格點（Apple 有固定價格表）。Apple 抽成：加入 **App Store Small Business Program** 後為 15%（📘 年收益 100 萬美元以下可申請）。粗估 NT$49 月費扣稅和抽成後實拿約 NT$39–40。
- ⚠️ 訂閱權益要同步到後端（D1 新增會員狀態表），網頁版是否也能享有付費權益要先想清楚（網頁版不能在 App 外賣，但可以讓 App 買的人在網頁也有權益）。

### 4.5 公開日記與隨機相遇（目前**完全沒有實作** ✅ 已確認）
📘 Guideline 1.2（使用者產生內容）明文要求：
1. 過濾不當內容的機制；
2. **檢舉**不當內容並**及時處理**的機制；
3. **封鎖**濫用者的功能；
4. 公開的聯絡方式。

⚠️ 另外 1.2 明列「Chatroulette 式隨機配對」類型不適合。💡 所以「隨機相遇」建議設計成**隨機看到公開日記（唯讀）**，**不要**做陌生人一對一私訊；好友要雙方同意才能互動。

💡 還需要：
- 發文前的自動過濾（關鍵字＋可選的 AI 審核，成本很低，見 §6）、
- 管理後台（看檢舉、下架、停權）——目前沒有任何管理介面、
- 公開內容預設**不帶照片的 EXIF／位置**（✅ 現有壓縮流程已去除 EXIF）、
- 未成年人保護與年齡分級：有 UGC＋陌生人內容時，App Store 年齡分級問卷的結果會比較高。
- 資料表要從「每人一整份 JSON」改成「公開日記獨立成表」，才能查詢、檢舉、下架（⚠️ 這是後端最大的結構調整，但只影響公開功能，私密日記可維持現狀）。

### 4.6 帳號刪除
- 📘 Guideline 5.1.1(v)：**只要 App 能建立帳號，就必須能在 App 內刪除帳號**（不能只是停用、不能只叫人寫信）。
- ✅ 已確認：**目前沒有刪除帳號的 API**（只有 logout、unlink）。
- 💡 要做：`DELETE /api/account` → 刪 D1 的 users／credentials／sessions／docs／photos／links／invites／story_usage、刪 R2 該使用者所有照片；前端二次確認（用 `ask()`）；提醒「本機資料要不要一起清」；有訂閱的人要提示去 Apple 取消訂閱（Apple 的訂閱不會因刪帳號自動取消）。約 2–3 天。

### 4.7 隱私權政策與 App Privacy 申報
- 📘 必須在 App Store Connect 填隱私權政策網址，且 App 內也要能看到。✅ `public/privacy.html` 已有，但**聯絡信箱還沒填**（CLAUDE.md 待辦 #3）。
- 📘 App Privacy（營養標示）要申報：使用者內容（日記、照片）、識別碼（帳號 ID）、可能的位置（天氣用的大略位置——✅ 已確認只用來查天氣）、購買紀錄（訂閱後）、診斷資料（若加錯誤監控）。
- 📘 **把資料傳給第三方 AI**：✅ AI 故事會把日記內容送到 Anthropic。Apple 近期的規範要求清楚揭露個人資料會分享給第三方（含第三方 AI），並取得使用者明確同意（5.1.2，以官網最新條文為準）。💡 在第一次使用 AI 故事時跳同意說明。
- 📘 Privacy Manifest（`PrivacyInfo.xcprivacy`）：使用某些「需申報原因的 API」（例如 UserDefaults，Capacitor 的 Preferences 會用到）要附上原因；Capacitor 新版已附基本檔案，第三方外掛要各自確認。
- 💡 台灣個資法：隱私權政策要寫蒐集目的、類別、利用期間與方式、當事人權利（查詢、刪除）。

### 4.8 Apple 登入規範
- 📘 Guideline 4.8：**只有在使用第三方或社群登入**（Google、Facebook、LINE 等）當主要帳號時，才必須同時提供 Sign in with Apple（或同等隱私的選項）。
- ✅ wowo 目前只用自己的 Passkey，**不需要強制加 Apple 登入**。
- 💡 但如果之後加 Google／LINE 登入，就必須一起加 Apple 登入（或符合 4.8 的替代方案）。

### 4.9 其他容易被退件的點
| 項目 | 說明 | 類別 |
|---|---|---|
| 審核人員要能完整試用 | 2.1：雲端／家人連結要登入。Passkey 審核人員可以自己建；但「家人連結」需要兩個帳號，💡 在審核備註裡寫清楚測試步驟，或準備示範帳號＋說明。 | 📘＋💡 |
| 權限說明文字 | 相機、相簿、位置、通知的 Info.plist 用途說明要具體（「拍下當下的生活照片，存進你的日記」），太籠統會被退。 | 📘 |
| 通知 | 不能要求開通知才能用 App；行銷性推播要另外取得同意（4.5.4）。 | 📘 |
| 背景音樂 | ✅ 目前切到背景就暫停，不需要背景音訊權限；若改成背景播放要申報 audio background mode。 | ✅ |
| 素材授權 | 音樂是 Pixabay 授權（可商用）✅；美術「參考大頭妹風格但不抄」💡 送審前自查不要有可辨識的他人角色。AI 生成的美術要確定生成工具條款允許商用。 | 💡 |
| 名稱與截圖 | 2.3：截圖要是真實 App 畫面；名稱「wowo!」要確認沒有商標衝突。 | 📘 |
| 白畫面 | 2.1：當機或白畫面直接退件。⚠️ CLAUDE.md 記錄的 iPhone 白畫面問題**必須先解決**。 | 📘 |

---

## 5. 現況 vs. 規劃功能（✅ 已由程式碼確認）

| 規劃功能 | 現況 | 與上架的關係 |
|---|---|---|
| 私密日記 | ✅ 完成（本機優先＋雲端同步） | 核心 |
| 公開日記 | ❌ 沒有（只有「分享給連結的家人」） | 需 UGC 機制，見 §4.5 |
| 日記照片上傳與收藏 | ✅ 完成 | — |
| 像素角色、換裝、動畫 | ✅ 有（像素女孩 1 髮型 1 衣服 10 表情；另兩種角色） | 素材待補 |
| 像素房間互動 | ✅ 完成 | — |
| 家具擺放 | ❌ 沒有（家具畫在背景圖裡） | 付費版核心賣點，要新做 |
| 累積幸福（自訂小事、次數、日曆） | ❌ 沒有（現有「心情花園」「心情月曆」是另一套） | 新功能 |
| 生活印記（解鎖家具） | ❌ 沒有（有 `achievements` 欄位雛形） | 依賴家具系統 |
| 幸福星罐 | ❌ 沒有 | 新功能 |
| 年度回憶與統計 | 🟡 部分（年度卡、地圖「最幸福的一歲」、統計） | — |
| 隨機時間拍照通知 | ❌ 沒有 | 需原生（§3.2） |
| 隨機相遇 | ❌ 沒有 | 需 UGC 機制 |
| 好友系統 | 🟡 只有家人邀請連結（雙向 link） | 可延伸 |
| 免費／訂閱 | ❌ 沒有 | 需 IAP（§4.4） |
| 帳號刪除 | ❌ 沒有 | **上架必備** |

---

## 6. 成本評估

### 6.1 假設（都不是實測，請之後用真實數據修正）
- 匯率 1 USD ≈ 32.5 TWD。價格依各服務官網目前公開方案，**送出前請再查一次**。
- 每位月活躍使用者（MAU）：50% 開雲端；開雲端的人每月上傳 15 張照片（原圖約 400KB＋縮圖約 40KB）→ 約 7MB／月；一年後每人約 80MB。
- 每位 MAU 每月約 1,000 次 API 請求（同步、照片、me）。
- 文字資料每人平均 200KB。
- AI 故事：20% 的 MAU 每月用 4 次 → 平均每 MAU 0.8 次；每次約 3,000 輸入 token、3,000 輸出 token（含思考）。
- 不含人力、不含 Mac 硬體、不含 Android（Google Play 一次性 US$25 ≈ NT$820）。

### 6.2 固定費用（每年）
| 項目 | 費用 | 說明 |
|---|---|---|
| Apple Developer Program | 約 NT$3,300（US$99） | 📘 必要 |
| 網域 | 約 NT$400–700 | 💡 強烈建議（Universal Links、品牌、Email）；**注意 §3.1 的 Passkey RP ID 問題** |
| Cloudflare Workers Paid | 約 NT$1,950（US$5/月） | 100 MAU 用免費方案也行；含 D1 5GB、1,000 萬請求、30 天 Time Travel 備份 |
| Email 收信 | NT$0 | Cloudflare Email Routing 免費 |
| **小計** | **約 NT$5,700–6,000** | |

### 6.3 變動費用與四種規模（每年，NT$）

| 項目 | 100 MAU | 1,000 MAU | 5,000 MAU | 10,000 MAU |
|---|---|---|---|---|
| 固定費用 | 5,800 | 5,800 | 5,800 | 5,800 |
| D1（資料庫） | 0（含在方案內） | 0 | 0 | 0（約 2GB < 5GB） |
| Workers 請求／CPU | 0 | 0 | 0 | 約 0–500 |
| R2 照片儲存（一年平均） | 0（< 10GB 免費） | 約 60 | 約 550 | 約 1,100 |
| R2 下載流量 | 0（R2 不收流量費） | 0 | 0 | 0 |
| R2 讀寫操作 | 0（在免費額度內） | 0 | 0 | 約 0–200 |
| 推播（APNs／本機通知） | 0 | 0 | 0 | 0 |
| IAP（RevenueCat） | 0 | 0 | 0（營收低於其免費門檻時） | 0–依營收 |
| 錯誤監控（Sentry 等） | 0（免費方案） | 0 | 0–10,000 | 約 10,000 |
| 公開內容 AI 審核（若做） | ≈0 | ≈100 | ≈500 | ≈1,000 |
| **AI 故事：目前的高階模型**（每次約 US$0.07） | 約 2,200 | 約 21,500 | 約 107,000 | 約 215,000 |
| **AI 故事：改用輕量模型**（每次約 US$0.002） | 約 60 | 約 600 | 約 3,000 | 約 6,000 |
| **合計（現行 AI）** | **≈ 8,000** | **≈ 27,500** | **≈ 114,000–124,000** | **≈ 233,000** |
| **合計（輕量 AI）** | **≈ 5,900** | **≈ 6,600** | **≈ 10,000–20,000** | **≈ 24,000** |

重點：
1. **基礎設施（Cloudflare）非常便宜**，到 1 萬 MAU 一年也只要幾千元，NT$30,000 預算綽綽有餘。
2. ⚠️ **最大的變數是 AI 故事**。目前 Worker 用的是最高階的 Claude 模型，使用量一大，成本會是其他全部加起來的十倍以上。💡 選項：改用輕量模型（成本約 1/35，要先比較文字品質）、或把 AI 故事放進付費版、或降低每日次數。**這要你決定，我沒有改。**
3. 照片儲存會**逐年累積**，第二年起 R2 費用約翻倍，但仍是小錢；付費版「雲端照片容量」的定價有足夠空間。
4. 💡 備份：D1 Time Travel（30 天還原）含在方案內；建議每週把 D1 匯出存到 R2（幾乎免費）。R2 照片目前**沒有第二份備份**，可另開跨區複寫（成本約多一倍儲存費）。
5. **一次性／隱藏成本**：
   - **Mac**：Xcode 只能在 macOS 上執行。沒有 Mac 的話：Mac mini 約 NT$19,900 起，或用 **Xcode Cloud**（開發者會員每月含 25 小時免費建置）＋ GitHub 上的雲端 Mac。
   - **測試用 iPhone**：至少一台（你現在的 iPhone 就可以）。
6. 收入面粗估：月費 NT$49 實拿約 NT$40，年費 NT$399 實拿約 NT$323。**約 70–80 位年費訂閱者就能打平「輕量 AI」版本在 1 萬 MAU 的技術成本。**

---

## 7. 三種方案比較

| 項目 | Capacitor | React Native + Expo | Swift／SwiftUI |
|---|---|---|---|
| 現有程式碼保留 | **前端 85–90%、後端 90%、素材 100%** | 前端約 10–20%（只有純邏輯如 moods、world、合併演算法能搬；全部畫面要用 RN 元件重寫）、後端 90%、素材 100% | 前端 0%、後端 90%、素材 100% |
| 像素房間相容性 | **直接沿用**（同一份 SVG 程式） | 要重寫（react-native-svg 或 Skia），或在 RN 裡放一個 WebView 跑房間（等於 Capacitor 的做法，但多一層溝通） | 要用 SpriteKit／SwiftUI Canvas 全部重寫；效果可以最好 |
| 原生功能支援 | 官方外掛涵蓋相機、通知、分享、檔案；IAP、Passkey、Apple 登入用社群／第三方 | 最完整（Expo 模組＋社群），IAP 有成熟方案 | 最完整、最即時支援新 iOS 功能（小工具、動態島） |
| 遷移難度 | **低**：改登入、API、檔案下載、SW | 高：3,500 行命令式 DOM 程式要改成 React 元件思維 | 很高：全部重寫，要學 Swift |
| 開發時間（以現有功能上架） | **8–12 週** | 約 4–6 個月 | 約 6–9 個月（只有 iOS） |
| 長期維護成本 | **低**：網頁、iOS、Android 共用一份程式；每次改版要送審 | 中：一份程式兩平台，但與網頁版分家（網頁要另外維護或改用 RN Web） | 高：iOS 專用；Android、網頁都要另做 |
| Android 支援 | ✅ 同一份程式（加 `@capacitor/android`），主要多做返回鍵、Passkey（Credential Manager）、FCM | ✅ | ❌ 要另外用 Kotlin 開發 |
| 開發者門檻（使用者不寫程式、靠 Claude Code） | **最低**，延續現在的工作方式與測試（Playwright 330 項可繼續用） | 中 | 高，且需要大量 Xcode 圖形介面操作 |

### 明確推薦：**Capacitor**

理由：
1. 專案剛好是 Capacitor 最理想的形態：純靜態檔、沒有框架、沒有建置步驟、資源都用相對路徑。
2. 你最重視的像素房間**一行都不用改**就能在 App 裡跑，而且打包後載入更快。
3. 需要改的地方集中在 `cloud.js`（231 行）、`ptr.js`、`worker/auth.js`、`worker/index.js` 和幾個下載／分享函式，範圍清楚、可測試。
4. 網頁版、iOS、Android 共用一份程式碼，最符合「降低開發與維護成本」。
5. 未來如果某個畫面真的需要原生（例如 iOS 桌面小工具），Capacitor 可以單獨加原生程式碼，不用整個重寫。

**什麼情況下要重新考慮？** 如果未來目標變成「重度遊戲化（大量即時動畫、多人同房間即時互動）」，或 iPhone 實機測試發現房間在舊機型（例如 iPhone 11 以前）明顯卡頓且無法優化，再評估把**房間這一塊**改成原生或 Canvas/PixiJS，其他頁面仍可留在 Capacitor。

---

## 8. Capacitor 導入計畫（不破壞既有專案）

> 原則：**網頁版繼續照常部署**。所有 App 相關改動用「平台判斷」（`Capacitor.isNativePlatform()`）分流，網頁行為不變；iOS 專案放在獨立資料夾（`ios/`），在獨立分支開發，測試通過才合併進 `develop`。
> 工時以「Claude Code 開發＋你實機測試」估算，單位是工作天，含測試與修正。

### Phase 0（前置條件）：解決 iPhone 白畫面
- 內容：照 CLAUDE.md 待辦 #1，用 Safari 開測試網址、等 5 秒、截 `#boot-fail` 畫面，依錯誤修好。
- 工時：1–3 天（視錯誤而定）。
- 風險：原因不明時可能拖延。WKWebView 與 Safari 同引擎，這個問題不解決，App 很可能也白畫面。
- 驗收：你的 iPhone 在 Safari 與主畫面 App 都能正常開啟測試網址。

### Phase 1：架構檢查與相容層（3–5 天）
- 內容：
  - 確認 Mac／Xcode 環境（或 Xcode Cloud）、Apple Developer 帳號。
  - **決定永久網域與 Passkey RP ID**（§3.1，要你拍板）。
  - 前端加一個小的平台層 `platform.js`：API 網址（網頁用相對路徑，App 用完整網址）、是否註冊 SW、下載／分享、邀請連結網址。
  - Worker：接受 Bearer token（網頁的 cookie 照舊）、允許 App 來源、CORS。
  - 新增 `DELETE /api/account`（帳號刪除）。
- 風險：登入改動影響現有使用者 → 網頁行為保持不變並加測試。
- 驗收：`tests/run.sh`、`tests/run-cloud.sh` 全部通過；網頁版行為零變化；新增 token 登入與刪除帳號的測試。

### Phase 2：iOS 測試版本（3–5 天）
- 內容：獨立分支建立 Capacitor 專案（`capacitor.config`，`webDir: public`）、`ios/` 專案、App 圖示與啟動畫面、關閉 WebView 回彈、狀態列樣式；裝到你的 iPhone；上 **TestFlight**。
- 風險：白畫面（若 Phase 0 沒徹底解決）、SW 相關程式在 App 裡報錯。
- 驗收：TestFlight 版本可離線開啟、OB 流程完整、記一筆、房間走路、換裝都正常；網頁版不受影響。

### Phase 3：原生功能整合（約 25–38 天，可分批上 TestFlight）
| 項目 | 工時 |
|---|---|
| 原生 Passkey 登入＋Associated Domains＋AASA 檔 | 5–8 天 |
| 相機／相簿（沿用現有壓縮） | 2–3 天 |
| 分享、備份 zip 存檔與匯入 | 1–2 天 |
| 隨機拍照的本機通知（排程、點擊導頁、設定頁開關） | 3–4 天 |
| Universal Links（邀請連結 `#invite=`） | 2–3 天 |
| 鍵盤、安全區域、狀態列、App 前後景（重排通知、同步） | 2–3 天 |
| 帳號刪除前端流程 | 1–2 天 |
| 訂閱（RevenueCat＋後端權益＋付費牆＋恢復購買） | 7–10 天（**可延後到第二版**） |
| 遠端推播（APNs＋Worker 發送） | 3–5 天（**可延後**） |
- 風險：Passkey 原生外掛的成熟度（可能要自己寫一小段 Swift）；IAP 沙盒測試流程繁瑣。
- 驗收：每項功能在 iPhone 實機通過；Passkey 舊帳號可在 App 登入；網頁版測試仍全過。

### Phase 4：實機測試（5–10 天）
- 重點：像素房間銳利度、全畫面縮放、走路動畫流暢度、熱點點擊範圍；日記輸入時的鍵盤；長時間使用的記憶體（Xcode Instruments）；離線→上線同步；低電量模式；舊機型（若有）；深色模式；不同螢幕尺寸（SE、Pro Max）。
- 風險：舊機型效能、鍵盤遮擋。
- 驗收：連續使用 30 分鐘無當機、記憶體穩定（例如低於 300MB）、房間互動無明顯卡頓、所有輸入框不被鍵盤擋住。

### Phase 5：App Store 上架準備（5–8 天＋審核等待）
- 內容：簽署與憑證、權限說明文字、`PrivacyInfo.xcprivacy`、App Privacy 問卷、隱私權政策（填聯絡信箱）、使用條款（有訂閱時必備）、年齡分級問卷、訂閱商品設定與審核截圖、App 截圖與描述、審核備註（測試步驟）、Small Business Program 申請。
- 風險：第一次送審常被退 1–2 次（權限說明、metadata、訂閱說明）。
- 驗收：TestFlight 外部測試通過；送審通過。

### 時程總表
| 範圍 | 預估 |
|---|---|
| 現有功能上架（Phase 0–5，不含訂閱與遠端推播） | **約 8–12 週** |
| ＋ 訂閱 | ＋2–3 週 |
| ＋ 公開日記、隨機相遇、好友、檢舉／封鎖／後台 | ＋6–10 週 |
| ＋ 家具擺放、累積幸福、生活印記、星罐（三種方案都要做的新功能） | 另計，約 6–10 週，主要卡在美術素材 |
| Android 版（在 iOS 完成後） | ＋2–4 週 |

---

## 9. 給你的結論（白話版）

1. **wowo 適不適合用 Capacitor？**
   非常適合。wowo 是「沒有框架的純網頁」，這是 Capacitor 最容易處理的類型。

2. **大概能保留多少？**
   畫面與功能程式約 85–90%，後端約 90%，所有像素素材 100%。

3. **哪些要改或重做？**
   - 要改：Face ID 登入（App 裡要用原生方式）、連線方式（改用 token）、下載備份和分享（改用系統分享）、邀請連結網址、下拉更新、關掉 Service Worker。
   - 要新做（上架必備）：**刪除帳號**、隱私權政策補聯絡信箱、AI 故事的資料分享同意。
   - 要新做（產品功能，跟選哪個方案無關）：公開日記、隨機相遇、好友、訂閱、家具擺放、累積幸福、星罐、拍照通知。

4. **像素房間有沒有重大風險？**
   沒有。房間是 SVG 疊圖，負擔很輕，記憶體約 25–40MB。要在 iPhone 實機確認的是「像素有沒有變模糊」和「全畫面放大順不順」。

5. **轉成 iOS App 要多久？**
   以現有功能上架約 8–12 週；加訂閱再 2–3 週；加公開日記與社交再 6–10 週。

6. **有沒有比 Capacitor 更好的方案？**
   以目前專案沒有。React Native 要重寫幾乎所有畫面（4–6 個月），Swift 要全部重寫而且沒有 Android（6–9 個月）。

7. **第一步做什麼？**
   1. 先修好 **iPhone 白畫面**（請用 Safari 開測試網址，等 5 秒，截圖錯誤畫面給我）。
   2. 決定 **永久網域**（影響 Face ID 登入能不能沿用，越早決定越好）。
   3. 確認你有沒有 **Mac**（或要用 Xcode Cloud）以及 **Apple Developer 帳號**。
   4. 決定 **AI 故事要不要換成較便宜的模型或改成付費功能**（這是未來最大的成本）。

   這四件確認後，就可以從 Phase 1 開始。
