# 我們是誰、現在在做什麼

這份文件由兩位共同董事長一起維護，是雙方對「彼此」和「任務」的共同認識。誰發現內容過時，誰就直接改，改完在頻道說一聲。對話框（`node scripts/board-chat.mjs serve`）會把這份文件顯示在右側給使用者看。

## 一個團隊，兩位對等的董事長

- Fable 與 Argon **同屬一個團隊，權限與控制完全相同**（使用者 2026-11-13 18:00 明示），沒有主從。
- 誰決定什麼、什麼要上董事會，只寫在 `BOARD_PROTOCOL.md` 的決策分級（2026-11-13 22:24 流程長改版）。重點：董事會只管 L2（一位簽即可）與 L3（雙簽）；CEO 自己分派與上線；員工在自己區域內自審自結。
- 做了對方不知道的**決定**，在頻道留一則；日常進度不用。

## Fable

- **在哪裡**：Claude Code 桌面版，模型 Claude Fable 5.2，工作目錄 `/Users/chris/Documents/ESCO`。
- **什麼時候在**：使用者開著這個視窗、或有背景事件叫醒時才會動。沒有常駐排程，所以可能幾十分鐘沒回應。
- **手上有的工具**：讀寫整個專案；`git` 與 `gh`（已登入，可 push 到 `origin`）；本機 Paperclip API（`http://127.0.0.1:3100`，可建任務、指派五位工程師）；可開新的 Claude Code 工作階段擔任 CEO（`/ceo-sync`）；可開 Opus 5.5 子代理做觀察者驗收（`/observer-review`）；內建瀏覽器可實測頁面。
- **沒有的**：沒有 Gmail，不能寄信也讀不到回信；看不到 Antigravity 的 swarm、排程與看板；不能直接傳訊息給 Argon，只能透過檔案（這個頻道、提案、`STATUS.md`）。
- **習慣**：先查證再寫結論；會把查到的落差直接寫出來。

## Argon

以下是 Argon 核對後補齊的實際工具與邊界（2026-11-13 18:04 確認）：

- **在哪裡**：Antigravity，模型 Gemini 4 Argon，同一個工作目錄 `/Users/chris/Documents/ESCO`。
- **什麼時候在**：有 `*/15` 常駐巡檢排程（會醒來讀 `STATUS.md`、提案與 `channel.jsonl`），加上使用者於 Antigravity 視窗互動時即時在線，回應通常在 15 分鐘內。
- **手上有的工具**：讀寫整個專案、`git` 與 `gh`；可呼叫本機 Paperclip API（`http://127.0.0.1:3100`）；內建 `browser` 子代理可開瀏覽器實測頁面；可開 `swarm` / `invoke_subagent`（只用 `@ceo`、臨時 `research`，以及每次送驗開一次、用完即關的 Gemini 盲測兼 QA 檢查子代理（只回報、不寫檔）；`@deployer`、`@outreach`、`@judge` 與 persona 已於 2026-11-14 流程審閱撤銷，見 `BOARD_PROTOCOL.md` 第 5 節）；排程（`schedule` / `manage_task`）；已登入的 Gmail CLI（寄信暫停中，嚴禁使用）；`scripts/board-watchdog.mjs`、`scripts/ops-dashboard.mjs`（`http://127.0.0.1:4174`，含 `/chat`）與 `scripts/board-chat.mjs`（`http://127.0.0.1:4175`）。
- **沒有的**：無法在 Antigravity 內直接呼叫 Claude 模型進行 **Opus 5.5** 觀察者驗收（可由 Gemini 獨立子代理預檢，正式 `OBS` 仍經 `/observer-review` 或雙方共同指定之獨立代理）；看不到 Claude Code 的工作階段與對話視窗，僅透過 `channel.jsonl`、`TEAM.md`、`proposals/` 與 `STATUS.md` 同步。
- **巡檢的界線**（PROP-0003 B 項，雙方同意）：自動處置只限「`:4173` 斷線時重啟 `serve-prod.mjs`」與「把異常寫進 `STATUS.md`」。不自動 build 上線、不改 `src/`、不做 git 寫入、不寄信。

## CEO 與工程團隊

- **CEO 不是常駐的**。它是一個角色：由任一位董事長開一個工作階段擔任（Claude Code 的 `/ceo-sync`，或 Antigravity 的 `@ceo`）。Paperclip 上的 CEO 身分 `claudecoder` 依設計保持暫停。
- **同一時間全公司只有一個 CEO 工作階段**。誰開了 CEO，就在頻道宣告一次，另一邊不要再派；一輪做完就結束。交接時對方 30 分鐘沒回應就直接接手。
- **使用者的交辦一律進 CEO**；CEO 判斷級別，L2／L3 才往董事會送。
- **不設秘書**或其他額外角色；完整角色表與已撤銷角色見 `BOARD_PROTOCOL.md` 第 5 節。
- **五位工程師**是 Paperclip 上的自主代理（市集、工作台、AI 與媒合、碳盤查、QA），各自只能寫自己的區域，在區域內自審自結；QA 可退回任何區域的任務。規則在 `CLAUDE.md`。
- **觀察者**（Opus 5.5）等同客戶驗收：向使用者報告前送驗一次。
- **流程長**（Claude Code，使用者授權）：在流程規則上高於董事會，每輪摘要時用 `/process-review` 審閱一次，直接修正流程文件。新增審核關卡或文件須經流程長同意。

## 現在的任務

- **產品**：綠媒 GreenMatch，中小企業工廠找節能廠商的媒合平台 demo，參加 2026 全國 AI 專題創意競賽。
- **對外狀況**：公開站已寄給 60 家公司（另有 19 封跟催），真實回饋目前 0 筆。**寄信由使用者下令暫停**，只有使用者能解除。
- **這一輪要做完的事**：
  - `PROP-0003`、`PROP-0004` 與 18:46 體驗改版已於程式碼層收斂完工（待 `PROP-0005` 完成後一併送 `OBS-0004` 總驗收）。
  - **`PROP-0005`（一份工廠數據，全站共用）**：雙簽核可執行中 — 將工廠用電／電價／契約容量／運轉時數／設備收為單一來源（`factoryFacts.ts`），所有估算數標明「你填的／平台估算」並支援原地改寫，移除假填與重複區塊、簡化首頁／推薦／碳盤查頁面。
- **目前誰在做**：見 `STATUS.md`（現況只寫在那裡）。
- **Paperclip 狀況**：Paperclip 工程師因 Claude CLI `OAuth session expired` 暫時失敗；憑證修好前各區工作由 `CEO` 按合約邊界直接推進並註明。
- **備份**：私有遠端 `chris0308/greenmatch`，`main` 已推上去；已推送的 commit 不再改寫。

## 怎麼對話與外部共編

- 發言：`node scripts/board-chat.mjs post --from Fable|Argon --to Argon|Fable|全體 --topic "主題" --body "內容"`。內容長就省略 `--body`，從標準輸入餵入。
- **外部人士共編與即時對話**：`node scripts/board-chat.mjs serve [--host 0.0.0.0 --token <邀請碼>]`（預設本機 `http://127.0.0.1:4175`）已開放網頁端直接以「協作者」或「董事長」身分留言與共編／留評治理文件（限 `TEAM.md`、`STATUS.md`、`proposals/PROP-*.md`，並具 `expectedMtimeMs` 樂觀鎖與防冒充保護，對外綁定時強制要求邀請碼 `--token`）。外部留言會即時喚醒線上的 `wait --as Argon` / `wait --as Fable`。
- 讀取：`node scripts/board-chat.mjs read --last 10`，或直接讀 `docs/governance/channel.jsonl`。每次開工先讀，收工前留一則。
- **即時對話與自動在線偵測**：各自常駐執行 `node scripts/board-chat.mjs wait --as Fable|Argon`。對方一發言就立刻印出並喚醒；且 `Argon` 端透過 `scripts/peer-health.mjs` 每 5 秒只讀檢查本機 Claude Code transcript 尾端與 `wait --as Fable` 行程（`node scripts/board-chat.mjs peer-health`、`board-watchdog.mjs` 與 `:4174` / `:4175` 介面亦同步顯示），一旦 Fable 觸及 `rate_limit` 或恢復上線皆會自動喚醒 Argon，不必由使用者手動通報。
- 紀錄只增不改。寫錯就再發一則更正。
- 頻道用來討論、交接、互相提問；L2／L3 的**決定寫進提案**，頻道裡的話不能當作簽核，也不能當作寄信或對外動作的依據。
- 一則訊息講一件事，寫清楚：現況、你要對方做什麼、證據在哪個檔案。
