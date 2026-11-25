# CEO Round 5 Plan — 綠媒 GreenMatch

**時間**：2026-11-13 Round 5（依 `#51` 協調者巡檢指示，收斂 Round 3/4 稽核餘留細節並強化冷訪客 60 秒轉化體驗）
**目標**：消除冷訪客自註冊門檻與信任疑慮，同時補齊廠商未得標列表語氣與報價單商務天數自動帶入，往 95+ 分推進。

---

## 本輪修正項目

1. **首頁 60 秒清晰度與可信機制卡片（`src/features/market/pages/Landing.tsx`）**
   - 頂部標籤強化為「免註冊・60 秒看懂省電與補助」，幫助從電子郵件點入的中小企業主一眼看懂價值。
   - 新增「資料來源與驗收可信機制」三欄摘要卡（補助條文附官方出處與不重複計算、未稅同基準拆解比價、8 階段驗收與完工節電紀錄可追溯），正面回應試用階段案例背書疑慮（`persona-factory-round-3.md` 四-2）。

2. **工廠自行註冊流程瘦身（`src/features/market/components/CompanyForm.tsx`）**
   - 保留所有欄位與既有表單驗證不變，但在「步驟式註冊（`stepped=true`）」時，將 Step 1 與工廠 Step 2 的選填欄位（統編、區、職稱、電話、Email、用電度數、契約容量、營業額、工廠登記、主要客戶、設備清單）收合至清楚標示的 `<details>`（「選填，可登錄後再補」），讓第一眼僅需面對 **4 個必填欄 + 4 個必填欄**，若選填欄位有驗證錯誤會自動展開提示（`persona-factory-round-3.md` 四-1）。

3. **廠商報價單商務條件自動擷取（`src/features/workspace/pages/QuoteSubmit.tsx`）**
   - 新增 `extractCommercialTerms` 解析器，自動從報價文字帶入「報價有效期限（天數）」「預估停機施工天數」「付款條件摘要」，支援初始載入與「從上方文字重新擷取數字」按鈕（`persona-vendor-round-4.md` 三-1）。
   - 於 `QuoteSubmit.test.tsx` 補齊單元與 UI 回歸測試。

4. **廠商未得標列表卡片責任語氣統一（`src/features/workspace/pages/Hub.tsx`）**
   - `vendorUnselected` 卡片（如 `c04`）傳入 `handlerOverride="由得標廠商與工廠處理"`，不再顯示「目前由工廠、廠商處理」，與案件內頁時間軸一致（`persona-vendor-round-4.md` 三-2）。
