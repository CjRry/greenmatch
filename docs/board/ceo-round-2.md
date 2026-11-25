# CEO Round 2 Plan — 綠媒 GreenMatch

**時間**：2026-11-13 Round 2（目標 14:20 前完成 BUILD READY round 2）
**輸入來源**：
- 董事會 Round 0 基準稽核（`docs/board/round-0.md`：81/100，NPS 7/10）
- 節能廠商 Persona Round 0 & Round 1 稽核（`docs/board/persona-vendor-round-0.md` 64/100 → `persona-vendor-round-1.md` 68/100，NPS 6/10）
- 製造工廠 Persona Round 1 稽核（`docs/board/persona-factory-round-1.md`：65/100，NPS 6/10）
- 董事會 `#14` 與 `#20` 指示

---

## 0. Round 1 雙角色稽核新增最高優先修復（`#17`、`#19`、`#20`）

1. **`#/feedback` 預設分數改為「未選擇（`null`）」（解決雙角色最大信任扣分）**：
   - **問題**：Round 1 預設 5 項皆預選 `5/5（100 分）` 且 NPS 預選 `9/10`，讓工廠陳老闆與廠商林經理都覺得「還沒填就先幫我打滿分，有誘導灌水之嫌」。
   - **修復**：將 5 項評分與 NPS 預設全部改為 `null`（未選擇），介面顯示「請點選 1–5 分（共 5 題）」與「已評 X / 5 題」；若尚未完成評分即點擊寄出或複製，顯示溫和明確提示請先點選分數（同時提供一鍵快速評分互動）。
2. **375px 手機版 3 處橫向爆版徹底修復（Hard Rule #9：`scrollWidth === 375`）**：
   - **`#/new-need` 第 2 步（原 `scrollW=625/375`）**：在 `<640px` 手機版將「標準需求表」每列設備改為直向堆疊卡片（含設備下拉、數量、kW／馬力 HP 快速換算晶片、設備年數、備註、刪除鈕），桌面版維持表格；同時在 `parseNeed` 自動將「十幾年」帶入 `ageText` 欄位。
   - **`#/cases/c01/match` 與 `#/new-need` 第 3 步（原 `scrollW=481/375`、`459/375`）**：修正 `SubsidyCard` 內每列補助項目的排版（金額與「來源與條件」改為 `flex-wrap` 且文字 `break-words min-w-0`，不再因長字串 `若貸 NT$ 200 萬...` 把右側撐出 375px）；修正 `FeedbackNudge` 在手機版改為上下堆疊（`flex-col sm:flex-row`），避免標題被右側按鈕擠成單字直排。
3. **種子資料日期更新至 2026-11 近期＋`c01` 責任方與價差 88.6 萬提醒**：
   - **問題**：今天為 `2026-11-13`，10 月初種子時間讓進行中案件顯示「預估 1–2 天・已進行 19 天」或「已進行 29 天」，像平台沒人在顧；且 `c01` 兩家廠商皆已報價，卻仍顯示「目前由廠商處理」。
   - **修復**：
     - 將進行中案件（`c01`、`c02`、`c08`～`c13`）的階段時間更新至 2026-11-10～2026-11-12（例如已進行 1–3 天），符合預估天數。
     - 當第 4 階段（`quote`）已有報價送達時（如 `c01` 已有 2 家報價），`views.ts` 的 `handlerText` 與 `factoryTodos` 及 `CaseTracker.tsx` 明確顯示「**已有 2 家廠商報價，輪到工廠比較與選商**」。
     - 在 `QuoteCompare.tsx` 自動偵測兩家報價總價差（如 `c01` 差價 NT$ 88.6 萬，約 39%），醒目提示「兩家總價相差 NT$ 88.6 萬（約 39%），主要差異在是否包含舊機拆除、管路抓漏修補與變頻機台數（3 台 vs 2 台＋1 台舊機備援）」，並在底部加上「**回到案件進度選擇簽約廠商 →**」主按鈕。
4. **白話用語取代內部工程詞＋支援馬力（HP）換算與行內補填契約容量**：
   - 按鈕移除「（規則式示範）」字樣（保持「AI 整理需求」、「AI 解說報價」清楚行動呼籲，結果旁維持 `<SourceTag>` 標明來源）；`轉述基準` 改為白話「經銷商參考區間」。
   - 當工廠未填設備 kW 而由公司檔案自動帶入時，在補助理由明確註記「（依貴廠檔案登記之 37 kW 估算，約 50 馬力）」。
   - 在 `SubsidyCard` 缺少契約容量時，除連結外直接提供**行內快速輸入契約容量（kW）**並即時寫入公司資料重算 ESCO 補助資格，免跳離頁面！
5. **精簡手機頂部導覽高度＆修正廠商 `TrialGuideBar` 第 2 步連結**：
   - 手機版頂部 Header 隱藏重複的「試用回饋」鈕（`hidden sm:inline-flex`），`TrialGuideBar` 在手機版改為單行緊湊導覽；廠商 `TrialGuideBar` 與首頁廠商試用卡第 2 步改連符合專長與地區的空壓機需求（新增台中空壓機開放需求 `n14`）。
   - `index.html` 加上內嵌 SVG data URI favicon，消除瀏覽器 `favicon.ico` 404 console error。
   - `CarbonDashboard.tsx` 熱點「針對這項設備登記節能需求」連結帶入 `?equip=` 參數，`NeedWizard.tsx` 自動帶入對應設備範例描述；`CarbonEntry.tsx` 預設聚焦「每月用電度數」，燃料欄位提供「展開／收合燃料欄位（範疇一）」切換，不再一次攤開 72 格嚇退中小工廠。

---

## 1. 稽核問題全量對照與修復方案

### A. 信任感與商務機密修復（最高優先，解決廠商信任感 11/20 痛點）
1. **`/cases/c04` 未得標廠商看到對手得標合約金額與排程（機密外洩）**：
   - **根因**：`CaseTracker.tsx` 與 `StageActions.tsx` 未檢查 `viewer.role === 'vendor' && c.selectedVendorId && c.selectedVendorId !== viewer.id`。
   - **修復**：
     - 當廠商為未入選（`isUnselectedVendor`）時，隱藏 `c.contractNtd`、`c.startDate`、`c.endDate`，改顯示「此案件已由工廠選定其他合作廠商承接；合約金額與施工排程僅對工廠與得標廠商公開」。
     - 將「下一步，你要做：提供合約與施工排程」改為中性提示「工廠已於報價比較後選擇其他廠商承接本案，感謝參與場勘與報價」。
     - `StageActions.tsx` 對未得標廠商顯示專屬說明面板，不顯示簽約操作提示。
2. **廠商頁「階段責任歸屬」與操作提示倒置（`/cases/c10`、`/cases/c01`、`/cases/c05`）**：
   - **`/cases/c10`（第 2 階段 平台評估）**：廠商視角黃底提示改為「你已被平台推薦給工廠，目前等待工廠確認邀請場勘（最多 2 家、無須競標）」。
   - **`/cases/c01`（第 4 階段 方案與報價，且該廠商已送出報價）**：廠商視角提示改為「你已提交報價，目前等待工廠比較與決定（工廠決定前仍可更新報價）」，並在案件頁直接展示「你已提交的報價摘要」卡片，不必點進編輯頁才能看自己報了多少。
   - **`/cases/c05`（第 7 階段 驗收，廠商視角）**：`StageActions.tsx` 的 `AcceptanceActions` 在廠商視角不再渲染給工廠用的「留下評價 1–5 顆星」停用表單，改顯示「你已回報完工並上傳試運轉紀錄，目前等待工廠驗收通過與留下評價」。
   - **`Timeline.tsx`（8 階段時間軸）**：同時清楚標示「工廠準備」與「廠商負責」（依檢視者身分優先突顯），不再對廠商只顯示「工廠準備：…」。
3. **`/cases/c02` 預約場勘時間 UTC 時區 -8 小時錯誤**：
   - **根因**：`src/features/workspace/lib/transitions.ts` 的 `schedule_survey` 使用 `action.at.slice(0, 16).replace('T', ' ')` 擷取 UTC 字串，導致台灣時間 14:00 變成 06:00。
   - **修復**：改用 `formatDateTime(action.at)` 轉為台灣時間格式，並新增單元測試驗證。

### B. 廠商工作台 `/me` 與報價表單 `/cases/:id/quotes/new` 體驗升級
4. **廠商 `/me` 狀態列數字與「全部」加總落差（`c01` 已報價待決定、`c04` 未得標消失於狀態格）**：
   - **修復**：保留既有 `vendorBucket` 契約（確保既有測試相容），在 `/me` 狀態列下方與案件卡片（`CaseRow.tsx`）新增明確的狀態標籤與計數說明（例如標示「已提交報價・待工廠決定」2 件、「未得標」1 件），讓廠商一眼看懂為何「全部」有 3 件而「待報價」為 0 件。
5. **`/cases/c01/quotes/new` 更新報價時結構化欄位空白、單位未標明未稅元**：
   - **根因**：種子資料 `c01_q1` 僅有 `rawText` 而無 `declared` 結構化欄位，導致進入更新報價頁時「選填數字」全空、右側即時預覽全「未載明」。
   - **修復**：在 `QuoteSubmit.tsx` 當既有報價無 `declared` 時，自動從 `rawText` 規則解析帶入初始結構化欄位（設備費、施工費、保固、省電度數、省下金額、省電比例、回本時間、比較基準），並加上「從報價內文自動帶入數字」按鈕；同時將欄位明確標示為「設備費（未稅，元）」、「施工費（未稅，元）」。

### C. 需求市集 `/needs`、需求詳情 `/needs/:id` 與案件頁規格連動
6. **中部地區開放需求為 0 筆、需求卡缺少設備功率（kW/HP）與用電規模**：
   - **修復**：
     - 在 `src/data/seed/needs.ts` 為既有開放需求補齊 `ratedKw`（例如 `n10` 空壓機 37 kW / 50 HP），並新增 2 筆中部（台中市、彰化縣）開放中需求（`n14`、`n15`），讓中部廠商篩選「中部」時立即看到真實可開發案源。
     - 在 `NeedCard.tsx` 與 `NeedDetail.tsx` 顯示設備 `ratedKw`（例如 `空壓機 2 台・37 kW`）以及刊登工廠的契約容量（kW）／月用電度數（度），讓廠商 3 秒判斷案源規模。
     - 在 `NeedCard.tsx` 與 `NeedDetail.tsx` 區分「符合你的專長與服務地區」與「符合專長（跨區案源）」，避免高雄廠商看到桃園案子誤以為是同區推薦。
7. **`NeedDetail.tsx` 廠商場勘前互動提問＆ `CaseTracker.tsx` 需求規格摘要卡**：
   - 在 `NeedDetail.tsx` 新增廠商專屬「向工廠提問／請工廠補銘牌或運轉資料」區塊，廠商可一鍵帶入常用專業問題（如銘牌 kW、每日運轉時數、電費單夏月契約容量）並寫入 `need.form.openQuestions`。
   - 在 `CaseTracker.tsx` 新增「需求規格與工廠規模摘要」卡片（顯示設備清單、kW、主要問題、工廠月用電與契約容量，並附「查看完整需求表」連結），解決從 `/me` 進案件頁看不到需求規格的斷裂感。

### D. 375px 手機版頂部導覽列、React Console Warning 與其他信任細節
8. **375px 手機版頂部導覽列換行與重複回饋按鈕**：
   - 在 `Shell.tsx` 將頂部 Header 的「試用回饋」按鈕設為 `hidden sm:inline-flex`（手機版已有底部導覽列「試用回饋」與試用引導列步驟 4），讓 375px 頂部導覽列維持單行俐落不擁擠。
9. **消除 React Console Warning（`Can't perform a React state update on a component that hasn't mounted yet`）**：
   - 將 `NeedWizard.tsx` 與 `QuoteCompare.tsx` 內 render 期間呼叫的 `aiAvailable().then(setCanAi)` 移入 `useEffect`。
   - 修正 `StoreProvider.tsx` 中 `QueryCache.subscribe` 初次同步觸發時對尚未掛載完成元件的通知順序。
10. **`VendorProfile.tsx` 單則評價顯示「（1 則）」與首頁／媒合頁信任資訊**：
    - `RatingStars` 新增 `showCount?: boolean`（預設 `true`），在 `VendorProfile.tsx` 單則評價列傳入 `showCount={false}`，不再每則評論都顯示「（1 則）」。
    - 在 `Landing.tsx` 與 `MatchResult.tsx` 強化廠商獲客價值主張（最多推薦 2 家不競標、AI 預先結構化規格、試用期免平台費、不收廣告費買榜）。
    - 在 `CompanyForm.tsx` 為廠商新增「可協助客戶申請政府節能補助（`assistsSubsidy`）」勾選開關，讓新登錄廠商也能獲得「可協助申請補助」徽章。
