# GreenMatch 品質驗收報告 (QA Report)

- **更新時間**：`2026-11-14 15:0x (Asia/Taipei)`（加入 §2b 第 1 輪 375／深色實看）
- **測試分支 / 基線**：`main`（`2434a5a`，含 `PROP-0005` Phase 1 `ccfa110`/`5091c6b` ＋ Phase 2 `52ad187`/`bf0e6c0`/`2434a5a`）
- **對應提案與觀察單**：`PROP-0003`、`PROP-0004`、`PROP-0005`，預備送交 `OBS-0004`

---

## 1. 自動化測試與靜態檢查結果

| 檢查項目 | 指令 | 結果 | 備註 |
|---|---|---|---|
| TypeScript 型別檢查 | `npm run typecheck` (`tsc -p tsconfig.app.json --noEmit`) | **PASS (0 error)** | — |
| 應用程式測試總數 | `vitest run` (`npm run check` 内含) | **PASS（43 個測試檔、484 項測試全過）** | 含 `resolveAnnualCarbonSummary`、`bill/kwh` 電價推估、`stageSubsidyReminders` 狀態感知與 `QuoteCompare` 3.8 元初始帶入測試 |
| 架構邊界檢查 | `node scripts/lint-boundaries.mjs` | **PASS (`lint-boundaries: ok (all)`)** | 各 feature 隔離與 shared contracts 合規 |
| 治理腳本測試 | `npx vitest run scripts/board-chat.test.mjs scripts/board-watchdog.test.mjs` | **PASS（2 個測試檔、19 項測試全過）** | 含外部協作、樂觀鎖、token 強制、`dist-stale` 只回報界線 |
| Design Token 與禁用檢查 | `grep` 稽核異動前後元件檔 | **PASS (`CLEAN`)** | 無硬編碼 hex/rgb、`dark:`、Tailwind 預設色或 `localStorage` |
| 正式版建置 | `npm run build` | **PASS（845ms）** | `dist/index.html` `1,175,621` bytes (`c1926f39…00a7`)、`artifact/greenmatch.html` `1,175,048` bytes |

### 本輪涵蓋的重點測試模組

1. **補助規則與台灣時區（`src/core/subsidies/subsidies.test.ts`、`src/ui/Subsidy.test.ts`）**：
   - `taipeiToday()` 以 UTC+8 判斷截止日；不傳 `today` 時以 `vi.setSystemTime('2027-02-01')` 與 `2027-01-15T15:59Z`/`16:30Z` 驗證跨日正確性。
   - `tax-credit`（產創 10-1）獨立另列「另可抵稅」，不計入現金補助合計；UI 顯示「政策參考」而不顯示「待開辦」。
2. **未得標廠商隱私隔離（`src/features/workspace/pages/CaseTracker.test.tsx`）**：
   - `c04` 驗證未得標廠商看不到合約金額與開/完工排程。
   - `c03`（`n03`）新增驗證（PROP-0003 E1）：未得標廠商僅看到至 `select_vendor` 為止之事件，「2 號機配管完成，預計 11/3 停機切換」與得標後施工進度皆完全不出現。
3. **同業合作經驗媒合與名錄篩選（`src/core/domain/matching.test.ts`、`src/features/market/pages/pages.test.tsx`）**：
   - 驗證 `servedIndustries` 與 `portfolio[].industry` 計入 `track` 實績分數與推薦理由文字，同時維持 `n01` 推薦順序與 5 項權重結構；`VendorDirectory` 支援依同業篩選。
4. **互動體驗升級模組**：
   - **單頁案件中心 `CaseCenter`**（`tests/flows/routes.test.tsx`）：`/cases/:id` 以 Tabs 整合「進度追蹤｜AI 推薦廠商｜報價比較與 ROI」。
   - **AI 推薦權重切換**（`src/features/ai/pages/MatchResult.test.tsx`）：預設組合（標準均衡／距離最近／實績最多／評價最高）與 5 項滑桿即時重算、套用與重設。
   - **工廠實務 ROI 互動試算機**（`src/features/ai/pages/QuoteCompare.test.tsx`、`src/features/ai/lib/quoteParser.test.ts`）：依平均電價、每日運轉時數、年運轉天數重算年省度數／電費／扣補助回本年數與 5 年淨收益。
   - **30 秒空白建立精靈 & 碳盤查試算整合**（`src/features/market/lib/quickRegister.test.ts`、`src/features/market/pages/pages.test.tsx`、`src/features/carbon/lib/quickCalc.test.ts`、`src/features/carbon/pages/CarbonDashboard.test.tsx`）：`?mode=quick` 建立無示範資料的乾淨工作台並播種年度碳盤查；`/carbon` 內建「電費／度數即時試算器」與頁內「12 個月明細編輯」分頁。
   - **試用導覽列不撞牆**（`tests/flows/routes.test.tsx`）與**麵包屑／表單／公開回饋端點白名單**。

---

## 2. 實機瀏覽器 QA 驗收（`http://127.0.0.1:4173`）

使用獨立 Browser 子代理針對最新建置（SHA-256 `d39bb33b…121193`）進行端到端實測，全程 `0` 個 Console Errors，且嚴守不觸發 `/#/feedback` 送出以保持後端資料庫乾淨（`webRealHuman = 0`）：

1. **未得標廠商隱私確認（`/#/cases/c03`）**：以 `熱力循環工程有限公司` 登入檢視 `c03`，畫面呈現「此案件已由工廠選定其他合作廠商承接；合約金額與施工排程僅對工廠與得標廠商公開」，實測頁面文字**完全不含** `3,280,000`、`2 號機配管完成`、`完成 1 號冰水主機拆除`。
2. **自行註冊工廠／廠商體驗流程（E4）**：
   - 於 `/#/register?role=factory&mode=quick` 建立 `實測光電工廠`（台中市、60 人、月用電 70,000 度），跳轉至 `/#/me` 成功。
   - 返回 `/#/` 顯示「實測光電工廠・工作台摘要」，展開「查看平台介紹與 8 階段說明」可正確顯示 3 大支柱與 8 個標準階段；前往 `/#/vendors` 與 `/#/carbon` 切換電費 420,000 → `100,000 度／月` 與「12 個月明細編輯」分頁皆無「沒有權限」錯誤。
   - 於 `/#/register?role=vendor&mode=quick` 建立 `實測節能科技`（桃園市），於 `/#/vendors` 篩選「金屬加工」同業合作廠商顯示 7 家並附同業徽章。
3. **單頁案件中心 Tabs & 互動計算（`/#/cases/c01`）**：以 `永豐金屬`（`f01`）測試 `進度追蹤`、`AI 推薦廠商`（切換「距離最近」即時重排）與 `報價比較與 ROI`（點選「AI 解說報價」後將電價由 4.2 改為 6 元，兩家年省電費與回本年數即時更新）。
4. **375×812 手機排版與深色主題驗證（F2）**：
   - 於 `375×812` 視窗實測 `/#/`、`/#/cases/c01?tab=quotes`、`/#/feedback`，三頁內容寬度皆為 `360px <= 375px`，零水平溢出，Console 0 error；並保留 `/#/feedback` 手機版實機截圖確認排版正常。
   - **（2026-11-14 更正）下面這段當時沒有實際看過深色畫面。第一次實看是 §2b。**
   - 深色主題透過全站語意化 CSS Token（`src/styles/tokens.css` 內建 `:root[data-theme=dark]` 與 `@media (prefers-color-scheme: dark)`，畫布 `#0d1512`、表面 `#141f1b`、文字 `#e5eee9`）與元件零硬編碼色票稽核驗證相容。（註：系統未設手動主題切換鈕且 Browser 子代理沙盒停用 `page.evaluate`，故深色視覺呈現為透過 CSS 規則與 Token 稽核確認。）
5. **`PROP-0005` 單一工廠數據＋全站瘦身（F.1–F.5 實走）**：
   - 於 `1024×768` 與 `375×812` 首屏（`/#/`）直接看見兩個主要入口，不需捲動且無水平溢出。
   - 建立空白工廠輸入 `65,000 度／月`、`180 kW`、`3.8 元／度`、`2×37 kW @ 16h` 後，`/me`、`#/me/profile`、`#/carbon`（三分頁：總覽／填數據／看懂碳盤查；單一年估算 `369.7 tCO2e`；`0/12` 月 `含平台估算` 不假算已填）、`/#/`（登入後首頁共用 `resolveAnnualCarbonSummary` 同步顯示 `369.7 tCO2e` ＋ `含平台估算`）、`/needs/new`（「`2 台 50 馬力的空壓機，用了 12 年，漏氣嚴重，每月電費大概 27 萬`」正確擷取數量 `2`、`37 kW`、每月電費 `270000` 且不再反問幾台；Step 3 核取方塊無障礙名稱正確綁定且 `SubsidySummaryBar` 顯示單一「估算約 NT$ 29–44 萬」）與 `/cases/...`（自建工廠有案件後隱藏「3 分鐘體驗」導覽列、內層分頁「案件步驟與紀錄｜政府補助」、動態「補助提醒」顯示已估算動力設備 `NT$ 29–44 萬` 與 `180 kW` 已符合 ESCO 門檻）皆於 `2434a5a` 實機複驗通過（`:4173` 與公開站 SHA-256 `c1926f39…00a7` 一致）。
   - **比價頁 ROI 帶入 `3.8 元／度` 實機證據（Fable 終驗補充）**：於 `2434a5a` 在 `:4173` 將示範工廠 `f01` 平均電價設為 `3.8` 元／度後開啟 `/#/cases/c01?tab=quotes` 點選「AI 解說報價」，ROI 互動試算機初始自動帶入 `3.8` 元／度（展開「回本試算用了哪些工廠數據」顯示 `平均電價・3.8 元／度・你填的`），府城機電年省 `98,400 度`／`NT$ 37.4 萬`（扣補助約 `1.9–2.5 年`回本）、綠能節電年省 `132,000 度`／`NT$ 50.2 萬`（扣補助約 `3.2–3.6 年`回本），全程 `0` Console/Page Errors 與 `0/27` 請求失敗（`/feedback` 未送出）。

---

## 2b. 2026-11-14 第 1 輪：375px＋深色實看（OBS-0004 §2-8）

由 CEO 代 QA 執行（Paperclip 工程師 OAuth 失效）。內建瀏覽器開 `http://127.0.0.1:4173`（建置 `1871aab5…7c17`），以 `375×812`、`prefers-color-scheme: dark` 實際看畫面，不是只做 token 稽核。

- **深色確實生效**：`matchMedia('(prefers-color-scheme: dark)')` 為 true，`body` 背景 `rgb(13, 21, 18)`；碳盤查總覽截圖文字、卡片、估算提示框、徽章對比清楚，沒有白底殘留。
- **375px 無水平捲動**：`/`、`/me`、`/me/profile`、`/new-need`、`/carbon`、`/cases/c01/quotes` 的 `scrollWidth` 皆為 `375`。Console 0 error。
- **空白工廠實走**（「驗收測試五金」／「驗收測試二廠」：台南、48 人、每月 52,000 度、勾空壓機＋照明）：
  1. `/me`：「主要設備：空壓機（台數待確認）；照明（台數待確認）」；聯絡人、簡介、產品沒有被填成「系統聯絡人／製造加工產品」。
  2. `/carbon` →「填數據」：占比滑桿只有空壓機、照明（各 50%，估算），沒有空調、鍋爐、泵浦。按「以估算填入 2026 年空白月份」後總覽為 **「已填月份 0/12」「另 11 個月為試算估計」**，黃色提示「範疇二含 11 個月的試算估計（每月約 52,000 度），不是電費單上的數字」，徽章「含平台估算」；熱點只有空壓機、照明。12 月沒有被填。
  3. `/me/profile`：兩列設備都顯示「平台暫填，請改成實際台數」；聯絡人、簡介、主要產品不再是必填。只把空壓機改成 2 台後儲存 → `/me` 顯示「空壓機 2 台；照明（台數待確認）」。**第一次走時照明被升成「1 台」**（`CompanyForm` 編輯任一列就把整份清單標確認），已修正於 `f314202` 並重走通過。
  4. `/new-need`：「廠裡兩台30馬力的空壓機用了十二年，每個月電費大概 18 萬，想換變頻的」→ 只有一列「空壓機」，標題「空壓機 2 台節能改善」，沒有「馬達／變頻」。
- **示範工廠永豐金屬**：導覽列 ③ 連到 `/cases/c01/quotes`（不再是沒有報價的 `c12`）。比價頁同一家只有一種回本：綠能節電表格「約 2.9–3.3 年回本（依貴廠電價試算）」＝下方回本試算「約 2.9–3.3 年」；報價單自己寫的「約 3.8 年」列在「報價單寫的回本（僅供參考）」。
- **沒有看的**：1024px 以上沒有重走；淺色模式本輪沒有重看（前幾輪已看過）；廠商身分頁面本輪沒有走。

## 3. 未覆蓋與已知邊界

- **真實 Anthropic AI 呼叫（`window.claude`）**：本機測試與公開試用站以原生結構化規則分析運行，未實測 `claude.ai` artifact 容器即時回應。
- **真實人類回饋回收**：目前 `/api/feedback` 已部署白名單驗證與頻率限制（`0` 筆真實回饋），對外批次邀測處於使用者暫停中（`outreachPaused: true`）。
- **公開協作綁定模式（`:4175`）**：網頁聊天／共編與 `expectedMtimeMs` 樂觀鎖已由 `scripts/board-chat.test.mjs` 11 項整合測試涵蓋，尚未進行多人間實際網際網路端對端壓測。
