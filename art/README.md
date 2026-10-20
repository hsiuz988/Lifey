# 美術：原圖與人物疊圖流程

人物是分層的 AI 生成圖，疊起來變成換裝小人。目前 MVP 只做**正面**。

```
source/   AI 生成的原圖（1254×1254，人物站在同一位置）
layers/   中間產物：從原圖摳出來、已對齊素體的頭髮／衣服（全尺寸 PNG）
tools/    Python 腳本（PIL、numpy、scipy）
preview/  腳本輸出的對照圖（不進 git）
```

需要的套件：`pip install pillow numpy scipy`

## 原圖

| 檔案 | 用途 |
|---|---|
| `base.webp` | **素體**：穿白色運動內衣褲、微笑。身體圖層和微笑表情都來自它 |
| `base_back.webp` | 背面素體（還沒用到） |
| `base_no_brows.png` | 從素體擦掉眉毛的版本：**生成頭髮時上傳這張** |
| `base_no_face.png` | 擦掉整個五官的版本 |
| `expr_happy.webp`、`expr_angry.webp` | 表情：用原素體生成 |
| `hair_ponytail.webp` | 高馬尾：用無眉毛素體生成，保留原本的長瀏海 |
| `cloth_tee.webp`、`cloth_hoodie.webp` | 衣服：用原素體生成 |
| `room.webp`、`room_tv_on.webp` | 房間（電視關／開）。`public/room/tv_on.webp` 是從 x1095、y400 裁出的 120×120 貼片 |
| `ref_*.webp` | 風格參考（頭髮、臉） |

## AI 生成規則（和使用者一起試出來的）

1. 每次都要**上傳對應的素體**，並要求「人物大小、位置、姿勢完全不變，背景透明或純白」。
2. **頭髮**：上傳 `base_no_brows.png`，要求「不要畫眉毛」，並**保留原本的長瀏海**（使用者不要短瀏海）。眉毛一律來自表情圖層。
3. **表情**：上傳原素體，只改五官（眉、眼、嘴、腮紅、符號），不要改臉型和頭髮。
4. **衣服**：上傳原素體，只換衣服；衣服要蓋住白色運動內衣褲。
5. 素體穿合身的運動內衣褲，是因為比較好疊圖，也比較不會被內容政策擋。

## 流程（在 `art/` 底下執行）

```bash
# 新髮型：從生成圖摳出頭髮 → layers/hair_<名稱>.png，並輸出對照圖到 preview/
python3 tools/compose2.py source/hair_<名稱>.webp <名稱>

# 衣服：目前會處理 tee、hoodie → layers/cloth_*.png（新衣服要加進 cloth.py 的清單）
python3 tools/cloth.py

# 輸出 App 用的圖層 → ../public/room/char/*.webp（267×420）
python3 tools/export.py
```

### 原理

- **對齊**：`hair.py` 的 `align_to` 用兩隻眼睛對齊生成圖和素體，修正縮放和位移。表情圖的眼睛形狀會變，所以改用頭的外框對齊（`compose.py` 的 `align_head`）。
- **摳圖**：`extract` 比對生成圖和素體，留下不一樣的部分。
  - 頭髮邊緣在臉上會多帶 3px 生成圖的皮膚（ring），消除粉色光暈。
  - 衣服用平滑過的差異加上 fill-holes，避免淺色衣服和皮膚太像而變半透明。
- **前後分層**：在身體範圍內的頭髮（瀏海、側髮）放在臉前面（`hair_*_front`），身體外的（長髮、馬尾）放在身體後面（`hair_*_back`）。
- **表情符號**（生氣記號、眼淚）另外存成 `sym_*`，疊在頭髮上面。

### 輸出

- 所有圖層用同一個裁切框，縮成 267×420，腳底在 (108.8, 418.6)，和 `public/room.js` 寫死的數字一致。
- 如果新素材讓裁切框變大，`export.py` 會印出新的 size 和 foot，`room.js` 也要跟著改。
- 新增的圖層要加進 `room.js` 的 `LOOKS`／`faceFor`，以及 `sw.js` 的 assets。

### 新增表情

1. 原圖放進 `source/`。
2. 把它加進 `export.py` 的表情清單（`('smile', None), ('happy', ...)` 那行）。
3. 執行 `export.py`。
4. 如果是會改變眉毛的表情（生氣、難過、緊張），`compose.py` 的 `BROW_CHANGES` 已經有列。

## 復古娃娃（會走路的角色）

另一套角色，手腳分開畫，App 裡走路時會擺手擺腳。

| 檔案 | 用途 |
|---|---|
| `doll_base.webp` | 光頭素體：手臂離開身體約 20 度、兩腿分開，有眉毛 |
| `doll_hair_long.webp` | 同一張圖＋長直髮 |
| `doll_hair_long_tpose.webp` | 長直髮、雙手平舉成 T 字：用來補手臂後面被擋住的頭髮 |
| `doll_cloth_<名稱>.webp` | 光頭素體穿上衣服（例：`doll_cloth_tee`）；放進來就會自動輸出那件衣服的身體和手腳 |
| `doll_expr_<名稱>.webp` | 光頭素體換表情（例：`doll_expr_happy`）；只取臉的範圍 |

```bash
python3 tools/doll.py   # → ../public/room/doll/*.webp，並印出尺寸、腳底、關節位置
```

- 新衣服、新表情：照上面的檔名放進 `source/` 再執行 `doll.py`，然後把名稱加進 `room.js`（`STYLE_LOOKS.doll` 或 `DOLL_FACES`）和 `sw.js`。
- 若印出的數字變了，要同步改 `room.js` 的 `DOLL_W`、`DOLL_H`、`DOLL_FOOT`、`DOLL_JOINTS`。
- 新的長髮型（長過肩膀）需要兩張圖：一般姿勢一張，雙手平舉的 T 字版一張。短髮只要一張。
- 衣服要用光頭素體生成，袖子只包住手臂、褲管不要蓋住兩腿之間的空隙，之後才能切成手腳。

## 復古娃娃・四分之三側面（App 現在用的版本）

| 檔案 | 用途 |
|---|---|
| `doll34_base.webp` | 女生光頭素體，四分之三側面（臉朝畫面右下） |
| `doll34_hair_<名稱>.webp` | 素體＋髮型（`long` 長直髮、`bob` 鮑伯頭） |
| `doll34_cloth_<名稱>.webp` | 素體穿衣服（`tee`） |
| `ref_doll_front_*.webp` | 同一套髮型、衣服的正面設計圖，給 AI 當參考 |

```bash
python3 tools/doll34.py   # → ../public/room/doll/*.webp（會先清空），並印出尺寸、腳底、關節位置
```

- 生成方式：附「四分之三素體」＋「正面設計圖」兩張，要 AI 照正面設計畫成側面角度。
- 衣服圖的頭常常和素體差幾 px，所以只取脖子以下（`NECK`），頭用素體的。
- 長髮沒有 T 字版時，手擺開露出來的頭髮用髮色補。
- 新的髮型、衣服：照檔名放進 `source/`，執行 `doll34.py`，再把名稱加進 `room.js` 的 `STYLE_LOOKS.doll` 和 `sw.js`。
- 舊的正正面版本（`doll.py`）只輸出到 `preview/doll_front` 留作參考。
