# 治理精簡紀錄（STREAMLINE_LOG）

這份文件記錄「簡化官僚體制」工作做過的每一項更動，以及每一項怎麼還原。目的是：精簡之後如果某個流程壞掉、腳本讀不到格式、或使用者想回到原本的制度，任何一方（董事長、CEO、使用者）都能照著這裡修回去。

- **建立時間**：2026-11-13（Asia/Taipei）
- **記錄者**：Claude Code 工作階段 `distracted-wright-11f81f`（記錄專職，不做精簡本身）
- **精簡執行者**：Claude Code 工作階段 `streamline-bureaucracy-efficiency-c01ae2`（使用者授權，權限高於董事會，只負責精簡制度、提高效率；每次向董事會報告時做審閱）
- **紀錄規則**：只增不改。寫錯就在下方再加一筆更正。

---

## 1. 還原點（精簡前的原狀）

| 項目 | 位置 |
|---|---|
| 精簡前的 commit | `48924ea`（`docs(governance): Fable walk-through findings for PROP-0005 phase 1`），即 `main` 當時的最新版 |
| git 標籤 | `governance-baseline-pre-streamline`（指向 `48924ea`，本機標籤） |
| 檔案原樣副本 | `docs/governance/archive/pre-streamline-48924ea/`（16 個檔案，依原路徑排列，附 `SHA256SUMS`） |

副本收了這些檔案（精簡可能動到的全部治理與規則檔）：

- `CLAUDE.md`、`AGENTS.md`
- `docs/governance/BOARD_PROTOCOL.md`、`TEAM.md`、`STATUS.md`、`PROMPTS.md`
- `docs/governance/proposals/TEMPLATE.md`、`docs/governance/observer-reports/TEMPLATE.md`
- `docs/board/RELAY.md`、`docs/board/handoff-state.json`
- `.claude/commands/board-sync.md`、`ceo-sync.md`、`observer-review.md`、`worker-status.md`
- `scripts/agent-areas.json`、`scripts/guard-ownership.mjs`（精簡不應改動這兩個，留副本只為比對）

已核可與已完成的提案（`PROP-0001`～`PROP-0005`）、觀察報告（`OBS-0001`～`OBS-0003`）與 `channel.jsonl` 是歷史紀錄，不在副本內；它們在 git 歷史裡，且依規則只增不改。

---

## 2. 精簡前的制度（摘要，方便對照）

1. **雙簽**：董事長交辦 CEO 的任何指令都要先寫 `PROP-XXXX.md`，Fable 與 Argon 雙方 `APPROVED` 後改為 `APPROVED_READY_FOR_CEO` 才能交辦。對方達用量上限或聯絡不上時，可註記 `BYPASSED (Fable usage limit)` 先推進。
2. **觀察者關卡**：向使用者報備前要先由 Opus 5.5 產出 `OBS-XXXX.md`，結論只能是 `PASS`／`PASS_WITH_IMPROVEMENTS`／`HOLD_FOR_FIX`；一輪做完才送驗一次。
3. **CEO**：只能執行已雙簽的提案（`ceo-sync` 寫「嚴禁執行」未雙簽提案），開工前要在頻道宣告。
4. **上線**：巡檢界線寫明「新版上線走雙簽提案，且先過 `npm run check`」，CEO 不能自行 build 上線。
5. **工程師**：只能寫自己的區域（`guard-ownership.mjs` 強制），共用檔案要在 Paperclip 任務留言請 CEO 改；完成後標 `done` 或 `in_review`。
6. **狀態文件**：`STATUS.md`、`TEAM.md`、`channel.jsonl`、`RELAY.md`、`handoff-state.json`、`deployment.md` 各自記一部分現況，開工收工要多處更新。
7. **只有使用者本人能做的事**：解除寄信暫停；需要使用者帳號登入的動作。

---

## 3. 不能改壞的格式（腳本會讀）

精簡改文件時，下面這些字串或欄位如果改名、刪掉，`scripts/ops-core.mjs`、`scripts/board-watchdog.mjs`、`scripts/board-chat.mjs` 與 `:4174`／`:4175` 介面會讀不到資料。要改就連同腳本與測試一起改，並記在第 4 節。

| 讀取方 | 依賴的格式 |
|---|---|
| `ops-core.mjs` 讀提案 | 中繼欄位 `- **狀態**:`、`- **提案發起人**:`、`- **建立時間**:`、`- **影響範圍**:`；章節 `### Fable`、`### Gemini 4 Argon`、`## 3. 雙簽確認` |
| `ops-core.mjs` / `board-watchdog.mjs` | 狀態值 `DISCUSSING`、`APPROVED_READY_FOR_CEO`、`DONE`（watchdog 據此產生「待 CEO 執行」「討論中」「待觀察者複審」） |
| `ops-core.mjs` 讀觀察報告 | `- **整體建議**:`、`- **觀察者**:`、`- **審查時間**:`、`- **對應報備主題 / 提案**:`；章節 `## 2. 建議改善項目`、`## 3. 呈報給最終拍板者` |
| `ops-core.mjs` 讀 `STATUS.md` | 章節 `## 待討論 / 待雙簽提案`、`## 已雙簽可交辦 CEO`、`## 使用者已拍板`、`## 待使用者拍板`、`## 待外部觀察者審查`、`## 最近完成的觀察報告`（精簡前的 `STATUS.md` 其實沒有這些章節，所以這幾欄本來就是空的） |
| `ops-core.mjs` 讀 `BOARD_PROTOCOL.md` | 字串 `BYPASSED (Fable usage limit)` 存在與否決定「繞過條款已生效」 |
| `board-chat.mjs` | 檔名 `TEAM.md`、`STATUS.md`、`proposals/PROP-XXXX.md`（網頁共編白名單） |
| `board-watchdog.test.mjs` | 「巡檢界線（PROP-0003 B）」：只有 `origin-4173-down` 可自動處置 |

---

## 4. 更動紀錄（每一項都要寫，最新的寫在最下面）

格式：

```
### C-NN｜YYYY-MM-DD HH:mm｜<一句話說改了什麼>
- 檔案：<路徑>
- 原本：<原規則，或「見副本 <路徑>」>
- 改成：<新規則>
- 原因：<省掉哪一道手續、誰因此可以直接做>
- 影響的腳本／格式：<無，或第 3 節的哪一項>
- commit：<雜湊>
- 單項還原：git checkout governance-baseline-pre-streamline -- <路徑>
```

### C-00｜2026-11-13｜建立還原點與本紀錄（尚無制度更動）
- 檔案：`docs/governance/STREAMLINE_LOG.md`、`docs/governance/archive/pre-streamline-48924ea/**`
- 原本：無
- 改成：新增精簡前副本與本紀錄
- 原因：使用者要求把精簡記下來並保存，以免日後無法修復
- 影響的腳本／格式：無
- 精簡工作階段當時進度：已讀完全部治理文件與腳本格式，**尚未改動任何檔案**（其分支 `claude/streamline-bureaucracy-efficiency-c01ae2` 仍停在 `48924ea`）。規劃方向（未落地，僅供對照）：
  - 決策分級：員工在自己區域內自審自改；CEO 直接派工、改共用檔、通過 `npm run check` 後自行上線 `:4173`；只有產品方向、對外動作（寄信、公開網址、`cloudflared`）、治理規則、資安隱私、不可逆動作才進董事會雙簽；使用者本人的兩件事不變。
  - 報告分級：董事會只看重大決定與每輪摘要，不再逐項報告；觀察者只在向董事會／使用者報告時審閱。
  - 保留提案狀態值與第 3 節格式，避免腳本壞掉。
  - 不改 `guard-ownership.mjs` 與 `agent-areas.json`。

> 以下 C-01～C-14 由精簡工作階段 `streamline-bureaucracy-efficiency-c01ae2` 於 2026-11-13 22:37 補記。C-01～C-13 的改動在記錄者建立 C-00 之前已寫好，於 `a177671` 一次 commit；C-03 與 C-02 中有三處腳本格式被改壞，已在 `9ca9f77`（C-14）修回。

### C-01｜2026-11-13 22:24｜雙簽一律化改為決策分級 L0–L4
- 檔案：`docs/governance/BOARD_PROTOCOL.md`（整份改寫）
- 原本：見副本 `archive/pre-streamline-48924ea/docs/governance/BOARD_PROTOCOL.md`。任何給 CEO 的指令都要雙簽；報備前必經觀察者。
- 改成：L0 員工區域內自審自結、QA 可退回；L1 CEO 自行派工、改共用檔（向下相容）、check 通過後 build 上線；L2 一位董事長簽即可交辦，另一位異議即升 L3；L3 雙簽只限對外、改方向、改規則、不可逆、安全隱私；L4 使用者本人兩件事不變。報告改為每輪一份 CEO 摘要＋`STATUS.md` 一次。新增流程長角色（流程規則高於董事會，新增關卡須其同意）。新增「每件事只寫在一個地方」對照表。繞過條款保留。
- 原因：省掉 L0／L1 事項的提案與雙簽、逐筆報告；CEO 與員工可直接做。
- 影響的腳本／格式：第 3 節「`BYPASSED (Fable usage limit)`」— 已保留，`fableBypassEnabled` 照常為 true。
- commit：`a177671`
- 單項還原：`git checkout governance-baseline-pre-streamline -- docs/governance/BOARD_PROTOCOL.md`

### C-02｜2026-11-13 22:24｜提案範本精簡並加「級別」欄位
- 檔案：`docs/governance/proposals/TEMPLATE.md`
- 原本：見副本同路徑。欄位：提案發起人、建立時間、狀態、影響範圍；第 1 節「擬下達給 CEO 的指令內容」；第 2 節兩位董事長意見；第 3 節雙簽。
- 改成：新增 `級別`（L2／L3）欄位；狀態值多列一個 `HOLD`；第 1 節改為目標／驗收標準／不做的事；第 2 節註明 L3 必填、L2 有異議才寫；第 3 節註明 L2 只需任一位；新增第 4 節完工證據。
- 原因：L2 提案只寫第 1 節即可交辦，不必來回討論。
- 影響的腳本／格式：第 3 節「`ops-core.mjs` 讀提案」。`a177671` 誤刪 `影響範圍` 欄位與 `### Fable`、`### Gemini 4 Argon` 小節，已於 C-14 補回。`HOLD` 不是腳本認得的狀態值：watchdog 不會為它產生 finding，dashboard 照原字顯示，不會出錯。
- commit：`a177671`、`9ca9f77`
- 單項還原：`git checkout governance-baseline-pre-streamline -- docs/governance/proposals/TEMPLATE.md`

### C-03｜2026-11-13 22:24｜觀察報告範本第 3 節改為只列 L4 事項
- 檔案：`docs/governance/observer-reports/TEMPLATE.md`
- 原本：第 3 節「建議方案／需使用者拍板事項」。
- 改成：「結論與建議方案／需使用者本人處理的事（只限 L4；其餘由公司自己修）」。
- 原因：避免觀察報告把日常事項變成待使用者拍板。
- 影響的腳本／格式：第 3 節「`ops-core.mjs` 讀觀察報告」的 `## 3. 呈報給最終拍板者`。`a177671` 誤改成 `## 3. 呈報給使用者`，已於 C-14 改回 `## 3. 呈報給最終拍板者（使用者）`。
- commit：`a177671`、`9ca9f77`
- 單項還原：`git checkout governance-baseline-pre-streamline -- docs/governance/observer-reports/TEMPLATE.md`

### C-04｜2026-11-13 22:24｜`/board-sync` 只處理 L2／L3
- 檔案：`.claude/commands/board-sync.md`
- 原本：見副本同路徑。每份 `DISCUSSING` 提案都要寫意見、雙方 `APPROVED` 才可交辦；每次都要更新 `STATUS.md`、頻道、`TEAM.md`。
- 改成：L2 自己同意即簽並改 `APPROVED_READY_FOR_CEO`；L3 才等雙簽；L0／L1 的提案退回 CEO；使用者新指示先判斷級別；只有做了對方不知道的決定才發頻道。
- 原因：董事長不用為每件事開提案、等對方、更新三份文件。
- 影響的腳本／格式：無
- commit：`a177671`
- 單項還原：`git checkout governance-baseline-pre-streamline -- .claude/commands/board-sync.md`

### C-05｜2026-11-13 22:24｜`/ceo-sync` 授權 CEO 直接做 L1
- 檔案：`.claude/commands/ceo-sync.md`
- 原本：見副本同路徑。「嚴禁執行」未雙簽提案；要先向使用者或董事會回報執行計畫。
- 改成：列出 CEO 可直接做的 L1 事項（派工、共用檔、修 bug、check 通過後上線、已核方向內的產品細節）；L2／L3 才需核可提案（繞過條款照舊）；不逐件審員工區域內工作；一輪結束寫一份輪摘要並更新 `STATUS.md` 一次。
- 原因：CEO 不再因等簽核而停工，也不用逐筆報告。
- 影響的腳本／格式：無
- commit：`a177671`
- 單項還原：`git checkout governance-baseline-pre-streamline -- .claude/commands/ceo-sync.md`

### C-06｜2026-11-13 22:24｜`/observer-review` 限定在向使用者報告前
- 檔案：`.claude/commands/observer-review.md`
- 原本：見副本同路徑。最後一步「與董事長及使用者討論需要拍板定案的事項」。
- 改成：只在向使用者報告前做一次、不審單一提案；只列真正影響使用者或品質的問題；不是 `PASS` 的項目交回 CEO 修，不轉成待使用者拍板。
- 原因：觀察者不再成為每一份提案的關卡，也不再把修正項目推給使用者。
- 影響的腳本／格式：無（OBS 檔仍依範本，見 C-03）
- commit：`a177671`
- 單項還原：`git checkout governance-baseline-pre-streamline -- .claude/commands/observer-review.md`

### C-07｜2026-11-13 22:24｜新增 `/process-review`（流程長審閱）
- 檔案：`.claude/commands/process-review.md`（新檔）
- 原本：無此檔。
- 改成：CEO 每次發出輪摘要時，流程長檢查多餘上報、卡住的等待、重複文件、該上報卻沒上報、新冒出的關卡；直接修流程文件，在 `STATUS.md`「流程審閱」寫最多五行。
- 原因：使用者要求流程長只在每次向董事會報告時審閱。
- 影響的腳本／格式：無
- commit：`a177671`
- 單項還原：`git rm .claude/commands/process-review.md`（基準版沒有這個檔）

### C-08｜2026-11-13 22:24｜`CLAUDE.md` 新增「Who decides」
- 檔案：`CLAUDE.md`
- 原本：見副本同路徑。只說共用檔請求留言給 CEO，沒有說明員工可自行結案。
- 改成：共用檔請求由 CEO 直接決定、不上董事會；新增「Who decides」段落：區域內自己決定、`check:<area>` 通過即自行標 `done`；QA 可驗收或退回任何區域；CEO 派工、改共用檔、上線；董事會只管對外、不可逆、改方向、改規則；不要向董事會報進度。硬性規則 1–16 未改。
- 原因：讓員工知道自己有權自審自結，不往上推。
- 影響的腳本／格式：無
- commit：`a177671`
- 單項還原：`git checkout governance-baseline-pre-streamline -- CLAUDE.md`

### C-09｜2026-11-13 22:24｜`TEAM.md` 移除與協議重複的規則
- 檔案：`docs/governance/TEAM.md`
- 原本：見副本同路徑。「一個團隊」段落重述雙簽、繞過條款與只有兩件事要使用者；CEO 段寫「同一份提案」；觀察者段寫「一輪做完才送驗」。
- 改成：規則改為指向 `BOARD_PROTOCOL.md` 的決策分級並列出重點；只有「決定」才需在頻道留言；CEO 段改為「同一份工作」；員工區域內自審自結、QA 可退回；新增流程長一行；頻道段的「決定寫進提案」限 L2／L3。
- 原因：規則只寫一處，避免兩份文件不一致。
- 影響的腳本／格式：第 3 節 `board-chat.mjs` 的共編白名單檔名 — 檔名未變。
- commit：`a177671`
- 單項還原：`git checkout governance-baseline-pre-streamline -- docs/governance/TEAM.md`

### C-10｜2026-11-13 22:24｜`STATUS.md` 新增「4. 流程審閱」一節
- 檔案：`docs/governance/STATUS.md`
- 原本：見副本同路徑（三節）。
- 改成：在檔尾加上第 4 節，記錄本次改版與「`PROP-0005` 照原核可推進，後續 bug 修正與上線屬 L1」。前三節未改。
- 原因：流程審閱結果有固定位置，不另開文件。
- 影響的腳本／格式：第 3 節 `ops-core.mjs` 讀 `STATUS.md` 的章節 — 沒有新增或刪除被讀的章節。
- commit：`a177671`
- 單項還原：`git checkout governance-baseline-pre-streamline -- docs/governance/STATUS.md`（注意：會一併還原基準之後他人寫入的狀態；只想移除第 4 節時請手動刪除）

### C-11｜2026-11-13 22:24｜`PROMPTS.md` 改寫並新增 CEO 與流程長
- 檔案：`docs/governance/PROMPTS.md`
- 原本：見副本同路徑。只有 Fable 與觀察者兩段，Fable 段寫「任何要交辦給 CEO 的指令都必須先雙簽」。
- 改成：四段：Fable（只處理 L2／L3）、CEO、觀察者（向使用者報告前一次）、流程長（執行 `/process-review`）。
- 原因：與新分級一致。
- 影響的腳本／格式：無
- commit：`a177671`
- 單項還原：`git checkout governance-baseline-pre-streamline -- docs/governance/PROMPTS.md`

### C-12｜2026-11-13 22:24｜`RELAY.md` 上線不再需要雙簽提案
- 檔案：`docs/board/RELAY.md`（第 2 節第 2 步、巡檢界線、Baton #1 下一步，共三句）
- 原本：「Everything else goes through a dual-signed proposal」、「新版上線走雙簽提案，且先過 `npm run check`」、「product changes go through a dual-signed proposal」。
- 改成：依 `BOARD_PROTOCOL.md` 第 2 節分級；新版上線由 CEO 在 `npm run check` 通過後執行（L1）。巡檢的自動處置界線（只能重啟 `serve-prod.mjs`、寫 `STATUS.md`；不 build、不改 `src/`、不做 git 寫入、不寄信、不動 `cloudflared`）未改。
- 原因：上線是 CEO 的日常工作，不需董事會。
- 影響的腳本／格式：第 3 節「巡檢界線（PROP-0003 B）」— `autoFixable` 未改，測試照過。
- commit：`a177671`
- 單項還原：`git checkout governance-baseline-pre-streamline -- docs/board/RELAY.md`

### C-13｜2026-11-13 22:24｜`board-watchdog.mjs` 文字對齊新分級（不改邏輯）
- 檔案：`scripts/board-watchdog.mjs`（三個字串）
- 原本：檔頭註解「新版上線一律走雙簽提案，且先過 `npm run check`。」；`dist-stale` 的 detail「由 CEO 依雙簽提案執行 npm run check 與 npm run build。」；`APPROVED_READY_FOR_CEO` 的 finding 標題「`${p.id} 已雙簽核可，待 CEO 執行`」。
- 改成：「新版上線由 CEO 在 `npm run check` 通過後執行（BOARD_PROTOCOL L1），巡檢不代勞。」；「由 CEO 執行 npm run check，通過後 npm run build 上線（L1，不需提案）。」；「`${p.id} 已核可，待 CEO 執行`」（L2 只需一位簽）。
- 原因：巡檢訊息不再指示 CEO 等雙簽。
- 影響的腳本／格式：只改顯示文字，判斷邏輯與 `autoFixable` 未動；`board-watchdog.test.mjs` 沒有比對這些字串，19 項測試全過。
- commit：`a177671`
- 單項還原：`git checkout governance-baseline-pre-streamline -- scripts/board-watchdog.mjs`

### C-14｜2026-11-13 22:37｜補回範本中腳本會讀的格式
- 檔案：`docs/governance/proposals/TEMPLATE.md`、`docs/governance/observer-reports/TEMPLATE.md`
- 原本（`a177671` 版）：提案範本缺 `- **影響範圍**:` 與 `### Fable`、`### Gemini 4 Argon` 小節；觀察報告第 3 節標題是 `## 3. 呈報給使用者`。
- 改成：補回 `影響範圍` 欄位；第 2 節補回兩位董事長的意見小節；觀察報告標題改回 `## 3. 呈報給最終拍板者（使用者）`。
- 原因：`ops-core.mjs` 讀這些欄位，缺少時 `:4174` 與 `:4175` 介面上的發起範圍、雙方意見與待拍板欄位會是空的。
- 影響的腳本／格式：第 3 節「`ops-core.mjs` 讀提案」與「`ops-core.mjs` 讀觀察報告」— 已逐項確認範本含所有被讀的欄位與章節；`board-chat`／`board-watchdog` 19 項測試全過；`guard-ownership.mjs`、`agent-areas.json` 與基準相同。
- commit：`9ca9f77`
- 單項還原：`git checkout a177671 -- docs/governance/proposals/TEMPLATE.md docs/governance/observer-reports/TEMPLATE.md`（回到 C-02／C-03 的初版，會再次缺少上述格式，不建議）；回到精簡前請用 C-02、C-03 的還原指令。

> 以下 C-15～C-22 是第 1 輪流程審閱（2026-11-14 15:23，依 CEO「第 1 輪摘要」`mmwg1yly8yq`），由流程長補記。審閱前的版本是 `f0ff1ad`；只想撤銷這次審閱、保留 C-01～C-14 時，用各項的「單項還原」。

### C-15｜2026-11-14 15:23｜全公司只留一個 CEO 工作階段；CEO 交接 30 分鐘無回應即接手
- 檔案：`docs/governance/BOARD_PROTOCOL.md` 第 5 節 CEO 列與新增「CEO 交接」段；`docs/governance/TEAM.md`「CEO 與工程團隊」；`.claude/commands/ceo-sync.md` 第 2 步
- 原本：「同一份工作同一時間只由一邊的 CEO 執行」，實際上每份提案開一個 CEO 工作階段；交接沒有時限，11-14 12:26 Fable 提出接手後等使用者同意到 14:26。
- 改成：同一時間全公司只有一個 CEO 工作階段，一輪做完就結束；交接時對方 30 分鐘沒回應，提出方直接接手並宣告，不需使用者同意。
- 原因：省掉約 2 小時的等待與多個並行 CEO 的協調。
- 影響的腳本／格式：無
- commit：`adcc701`
- 單項還原：`git checkout f0ff1ad -- docs/governance/BOARD_PROTOCOL.md docs/governance/TEAM.md .claude/commands/ceo-sync.md`（會一併撤銷 C-16～C-21 中寫在這三個檔的部分）

### C-16｜2026-11-14 15:23｜新增「使用者的入口」：交辦一律先進 CEO
- 檔案：`docs/governance/BOARD_PROTOCOL.md` 第 2 節後新增段落；`docs/governance/TEAM.md`；`.claude/commands/ceo-sync.md` 第 2 步
- 原本：沒寫使用者的意見從哪裡進來；PROP-0005 那次一句「軟體很難用」變成雙簽提案。
- 改成：使用者的問題與網站意見交 CEO，同一輪處理；L2／L3 由 CEO 往上送；也可直接找董事長；流程抱怨找流程長。
- 原因：使用者不必判斷級別，一般改良不必開提案。
- 影響的腳本／格式：無
- commit：`adcc701`
- 單項還原：同 C-15

### C-17｜2026-11-14 15:23｜觀察者為唯一驗收關卡；L1 上線前由 CEO 自己實走
- 檔案：`docs/governance/BOARD_PROTOCOL.md` 第 2 節 L1 列、第 4 節觀察者段；`.claude/commands/ceo-sync.md` 第 3 步；`docs/governance/STATUS.md` 第 3 節 CEO 下一步
- 原本：L1 上線只要求 `npm run check`（Fable 11:31 指出「L1 上線前沒有實走」的漏洞）；實務上每輪送驗前都要先等董事長實走（「Fable 以空白工廠實走，過了再送 OBS-0005」）。
- 改成：CEO 上線前自己用內建瀏覽器實走改到的頁面（375px＋深色）；觀察者是唯一驗收關卡，董事長實走可同時進行但不擋送驗；STATUS 下一步改為直接送 OBS-0005。
- 原因：補上品質漏洞，同時拿掉一道等待董事長的關卡。
- 影響的腳本／格式：無
- commit：`adcc701`
- 單項還原：同 C-15；STATUS 那句用 `git show f0ff1ad:docs/governance/STATUS.md` 對照手動改回

### C-18｜2026-11-14 15:23｜流程長不得刪減 L3 清單、第 7 節底線與 L4
- 檔案：`docs/governance/BOARD_PROTOCOL.md` 第 3 節第 3 項、第 5 節流程長列
- 原本：流程長可直接修改本協議全文（Fable 11:31 指出「流程長能改 §3、§7 與 L4」的漏洞）。
- 改成：流程長仍可精簡流程，但第 3 節清單、第 7 節底線與 L4 只有使用者本人能刪減或放寬。
- 原因：寄信暫停、對外動作、權限邊界等安全底線不應由任何代理單方面放寬。這是收窄流程長自己的權限，不增加關卡。
- 影響的腳本／格式：無（`BYPASSED (Fable usage limit)` 字串未動）
- commit：`adcc701`
- 單項還原：同 C-15

### C-19｜2026-11-14 15:23｜同一個異常只寫一次 `STATUS.md`
- 檔案：`docs/governance/BOARD_PROTOCOL.md` 第 6 節「目前狀態」列
- 原本：巡檢每 15 分鐘把公開站斷線重寫進 `STATUS.md`（Fable 11:19 要求降頻）。
- 改成：同一個異常只寫一次，之後每天最多再提一次。
- 原因：減少重複報告。
- 影響的腳本／格式：`board-watchdog.mjs` 未改；這是給 Argon 排程的規則，需 Argon 在 Antigravity 調整。
- commit：`adcc701`
- 單項還原：同 C-15

### C-20｜2026-11-14 15:23｜撤銷角色並新增「已撤銷的角色」表
- 檔案：`docs/governance/BOARD_PROTOCOL.md` 第 5 節；`docs/governance/TEAM.md` Argon 工具段；`docs/board/RELAY.md` Prompt B
- 原本：協議沒有限制角色數量；實際存在「董事長秘書助手」工作階段、每案一個 CEO、Antigravity 的 `@deployer`、`@outreach`、`@judge` 與 persona；沒有角色的獨立工作階段（網站內容運作與美觀）。
- 改成：角色表之外不設角色，新增角色須流程長同意；秘書不設；`@deployer` 併入 CEO；`@outreach`、`@judge`、persona 撤銷；Argon 只用 `@ceo` 與臨時 `research`；沒有角色的工作階段算 CEO 底下的工作。新增「巡檢」列（不是決策角色）。
- 原因：使用者要求刪除不需要的角色（Antigravity 與 Claude 兩邊）。
- 影響的腳本／格式：無。Antigravity 子代理只存在 Argon 的執行階段，沒有可直接修改的設定檔，需 Argon 依協議關閉。
- commit：`adcc701`
- 單項還原：同 C-15，另加 `git checkout f0ff1ad -- docs/board/RELAY.md`

### C-21｜2026-11-14 15:23｜`STATUS.md` 記錄第 1 輪流程審閱
- 檔案：`docs/governance/STATUS.md` 第 4 節（新增 3 行）、第 3 節 CEO 下一步
- 原本：第 4 節只有 11-13 改版的 3 行。
- 改成：加上本輪審閱發現、修法與撤銷角色清單。
- 原因：協議規定審閱結果寫在這裡。
- 影響的腳本／格式：沒有新增或刪除 `ops-core.mjs` 讀取的章節。
- commit：`adcc701`
- 單項還原：手動刪除第 4 節最後 3 行（整檔還原會一併蓋掉他人寫入的狀態）

### C-22｜2026-11-14 15:23｜Claude Code 端撤銷角色的實際動作（不在 git 內）
- 動作：
  - 「董事長秘書助手」工作階段已不在工作階段清單中（審閱前已移除）；刪除它留下的空 worktree `.claude/worktrees/ceo-secretary-assistant-2f6c09` 與本機分支 `claude/ceo-secretary-assistant-2f6c09`（指向 `851eb1d`，該 commit 已在 `main`，沒有獨有內容）。
  - 「CEO：執行 PROP-0003」「CEO: OBS-0004 修正清單（五項）」兩個 CEO 工作階段：確認已封存。現行唯一的 CEO 工作階段是「CEO」（`ceo-sync-772259`）。
  - 紀錄員分身「簡化官僚體制與效率 (fork)」：封存被自動模式拒絕，**未封存**，留給使用者決定。
  - 「網站內容運作與美觀」工作階段已不在清單中，但分支 `claude/website-content-operations-92b686`（3 個未合併 commit）仍在，交 CEO 決定合併。
- 原因：同 C-20。
- 影響的腳本／格式：`board-watchdog` 的 `stale-worktrees`／`stale-branches` 會少一筆。
- commit：無（不是檔案變更）
- 單項還原：`git worktree add .claude/worktrees/ceo-secretary-assistant-2f6c09 -b claude/ceo-secretary-assistant-2f6c09 851eb1d`；封存的工作階段可在 app 的 Archived 清單中取消封存。

### C-23｜2026-11-14｜補正 C-22：紀錄員分身已封存
- 動作：使用者同意後，封存「簡化官僚體制與效率 (fork)」工作階段（`local_92fba41d…`）。C-22 中「未封存」一句以本筆為準。
- 原因：紀錄工作已由流程長接手；`STREAMLINE_LOG.md` 與精簡前副本都在 `main`。
- 影響的腳本／格式：無。分支 `claude/distracted-wright-11f81f`（`dc5c51d`）仍保留，其內容已以 `acbf6d8` 進入 `main`；標籤 `governance-baseline-pre-streamline` 不受影響。
- commit：本筆紀錄所在的 commit（封存本身不是檔案變更）
- 單項還原：在 app 的 Archived 清單中取消封存該工作階段。

> 以下 C-24～C-27 依 `PLAN-efficiency-and-bias.md`（使用者 2026-11-14 同意三點全做）。執行前於頻道 `mmwga8i800q` 告知兩位董事長。

### C-24｜2026-11-14 18:47｜頻道新增「流程長」發言身分
- 檔案：`scripts/board-chat.mjs`（`CLI_SPEAKERS`、`AUDIENCES` 各加 `流程長`）、`scripts/board-chat.test.mjs`（新增 1 項測試）
- 原本：只有 Fable、Argon、CEO 能從命令列發言；流程長無法告知董事會。
- 改成：流程長可從命令列發言、也可被指名；網頁端仍不得使用此名稱（`RESERVED_WEB_NAMES` 與網頁只能用「董事長」「協作者」不變）。
- 原因：使用者要求動模型或人才前先告知董事長。
- 影響的腳本／格式：第 3 節 `board-chat.mjs` — 發言者白名單擴大一個，網頁防冒充不變；治理腳本測試 25 項全過。
- commit：`7f855d0`
- 單項還原：`git checkout 7f855d0~1 -- scripts/board-chat.mjs scripts/board-chat.test.mjs`

### C-25｜2026-11-14 18:55｜驗收改為兩家族、先盲測
- 檔案：`.claude/commands/observer-review.md`（改寫）、`docs/governance/observer-reports/TEMPLATE.md`（新增第 4、5 節）、`docs/governance/BOARD_PROTOCOL.md` 第 4 節、`.claude/commands/ceo-sync.md` 第 7 步
- 原本：觀察者第一步讀 `STATUS.md` 與輪摘要；只有 Claude 一個家族驗收。
- 改成：觀察者先盲測（只看驗收標準、全新空白工廠），再讀自述並列「自述與實測不符」；Argon 同時開一次性的 Gemini 子代理盲測同一版，發現附在同一份 OBS；觀察者仍是唯一關卡，Gemini 未到照常結案。
- 原因：減少「先讀自述被定錨」與同家族模型共同盲點。
- 影響的腳本／格式：第 3 節「`ops-core.mjs` 讀觀察報告」— 新增的兩節在 `## 3. 呈報給最終拍板者` 之後，被讀的欄位與章節不變。
- commit：`41ef1a4`
- 單項還原：`git checkout 7f855d0 -- .claude/commands/observer-review.md docs/governance/observer-reports/TEMPLATE.md`；協議與 `ceo-sync.md` 見 C-26

### C-26｜2026-11-14 18:55｜證據標籤與證據裁決
- 檔案：`docs/governance/BOARD_PROTOCOL.md` 第 4 節、`.claude/commands/ceo-sync.md` 第 6 步、`.claude/commands/process-review.md` 第 2 步
- 原本：品質判斷不標來源；persona 分數與 AI 意見可與實測混用；意見衝突沒有裁決規則。
- 改成：每個品質判斷標〔實測〕〔AI 評估〕〔真人〕之一，沒證據算「未驗證」，不能作為上線、寄信或結案依據；`STATUS.md` 固定一行「真人回饋：N 筆」；衝突時有〔實測〕的一方成立，兩邊都只有 AI 評估則「待真人確認」；流程審閱抽查未驗證比例，Gemini 連兩輪無獨有發現就提議拿掉。
- 原因：避免 AI 自評被當成品質證據、共用文件的錯誤被當成事實。
- 影響的腳本／格式：無。舊報告與分數不回頭改。`STATUS.md` 那一行由 CEO 下次更新時加上（本次 `main` 的 `STATUS.md` 正被 CEO 編輯，流程長未動）。
- commit：`41ef1a4`
- 單項還原：`git checkout 7f855d0 -- docs/governance/BOARD_PROTOCOL.md .claude/commands/ceo-sync.md .claude/commands/process-review.md`（會一併撤銷 C-25 寫在協議與 `ceo-sync.md` 的部分）

### C-27｜2026-11-14 18:55｜QA 換 Gemini：暫停，未切換
- 動作：無變更。查到 Paperclip `gemini_local` 轉接器可用（需 `@google/gemini-cli`，本機未安裝；Node v26 符合）。QA 工程師目前設定：`claude_local`、`claude-sonnet-5-5`、狀態 `error`。
- 原因：`guard-ownership.mjs` 是 Claude Code 的 PreToolUse 掛勾，Gemini CLI 不會執行；切換後 QA 的寫入邊界不再被強制，等於放寬協議第 7 節底線，只有使用者能決定。選項與建議記在 `PLAN-efficiency-and-bias.md`「第 3 點為什麼暫停」。
- 影響的腳本／格式：無
- commit：`41ef1a4`（計畫書中的執行紀錄）
- 單項還原：不需要

### C-28｜2026-11-14｜QA 唯讀 Gemini（使用者選 A）：試行失敗，未切換
- 動作：全域安裝 `@google/gemini-cli@0.68.0`（Google 官方套件）；使用者用 Google 帳號登入；在暫存複本實測。**未修改 QA 工程師**，仍為 `claude_local`、`claude-sonnet-5-5`。專案內沒有留下任何檔案（試用的唯讀設定檔已刪除，未 commit）。
- 發現：
  1. Google 回覆 `IneligibleTierError: UNSUPPORTED_CLIENT`：個人免費方案不再支援 Gemini CLI，要求改用 Antigravity。用個人帳號登入這條路走不通。
  2. Gemini CLI 的系統層級設定檔（唯讀白名單唯一能蓋過其他設定的位置）必須放在 root 擁有的資料夾，否則會被略過；要生效必須用 sudo 寫進全機路徑。
- 原因：照使用者選擇的方案 A 執行，測過才切換。
- 影響的腳本／格式：無
- commit：本筆紀錄所在的 commit
- 單項還原：移除 CLI 用 `npm uninstall -g @google/gemini-cli`；登入資料在 `~/.gemini/oauth_creds.json`、`~/.gemini/google_accounts.json`、`~/.gemini/settings.json`（Antigravity 自己的資料在 `~/.gemini/antigravity/`，不要動）。

### C-29｜2026-11-14｜Gemini QA 檢查改由 Antigravity 做，併入盲測員
- 檔案：`docs/governance/BOARD_PROTOCOL.md` 第 4 節「兩家族盲測」段、`docs/governance/TEAM.md` Argon 工具段、`.claude/commands/ceo-sync.md` 第 7 步、`docs/governance/PLAN-efficiency-and-bias.md`
- 原本：計畫第 3 點把 Paperclip QA 工程師換成唯讀 Gemini（C-28 試行失敗）。
- 改成：Paperclip QA 維持 Claude。Argon 每次送驗開的 Gemini 盲測員同時做 QA 檢查：跑 `npm run check`、對照驗收標準與 `tests/`，只回報、不寫檔、不做 git 寫入；測試缺口由 CEO 補。每輪仍只有一個 Gemini 子代理，不是新角色、不是新關卡。執行前於頻道 `mmwgazplccp` 告知兩位董事長。
- 原因：使用者選擇改用 Antigravity；不需要金鑰、安裝或 sudo。「不寫檔」靠 Argon 的子代理設定與 CEO 每輪 `git status` 檢查，沒有程式強制。
- 影響的腳本／格式：無
- commit：本筆紀錄所在的 commit
- 單項還原：`git checkout 34b46b2 -- docs/governance/BOARD_PROTOCOL.md docs/governance/TEAM.md .claude/commands/ceo-sync.md`（回到 C-25／C-26 的版本）

### C-30｜2026-11-14 19:10｜移除 Gemini CLI（使用者同意）
- 動作：停止使用者終端機裡兩個停在「信任資料夾」畫面的 `gemini` 行程；`npm uninstall -g @google/gemini-cli`；把 Gemini CLI 在 `~/.gemini/` 建立的檔案（`oauth_creds.json`、`google_accounts.json`、`settings.json`、`installation_id`、`projects.json`、`state.json`、`state.json.bak`、`trustedFolders.json`、`history/`、`tmp/`）移到垃圾桶 `~/.Trash/gemini-cli-20261114-191036/`。`~/.gemini/` 恢復成安裝前的內容（`antigravity`、`config`、`jetski-standalone-oauth-token`、`sandbox`、`tasks`、`users`），Antigravity 的資料未動。
- 原因：Gemini QA 改由 Antigravity 做（C-29），CLI 已無用途。
- 影響的腳本／格式：無
- commit：本筆紀錄所在的 commit
- 單項還原：`npm install -g @google/gemini-cli@0.68.0`，再把垃圾桶那個資料夾裡的檔案移回 `~/.gemini/`（清空垃圾桶前）。

### C-31｜2026-11-15｜拿掉「Fable 實走」關卡，加「不空等」規則
- 檔案：`docs/governance/proposals/PROP-0007.md` 出貨順序段、`docs/governance/BOARD_PROTOCOL.md` 第 5 節「CEO 交接」後新增「不空等」段
- 原本：PROP-0007（547bc95）規定 4a 要「通過 Fable 實走」才開始 4b。Argon 11/14 22:00 交出 4a 複修（ceabc59）後，Fable 的工作階段沒有被叫醒，4b 空等約 11 小時；Argon 巡檢每 15 分鐘寫一則「無新變化」。
- 改成：段落「做完」由 CEO 實走＋Gemini 盲測判定，董事長實走為選擇性、不擋下一段。等某位代理超過 60 分鐘、且非 L3／L4 時，依現有證據推進並在頻道註記。巡檢「無新變化」不寫任何地方。
- 原因：547bc95 重新加回第 1 輪流程審閱已拿掉的「送驗前董事長實走」；而 Claude Code 工作階段在兩次對話之間不會執行，`wait` 監聽無法常駐。
- 影響的腳本／格式：無
- commit：本筆紀錄所在的 commit
- 單項還原：`git checkout 72c6bb0 -- docs/governance/proposals/PROP-0007.md docs/governance/BOARD_PROTOCOL.md`

### C-32｜2026-11-15｜卡住偵測：不靠代理醒著也能發現「有人在等」
- 檔案：新增 `scripts/stall-watch.mjs`、`scripts/stall-watch.test.mjs`；`docs/governance/BOARD_PROTOCOL.md`「不空等」段加一條
- 原本：Argon 的巡檢（`peer-health`）看得到「Fable 未回覆」，但只能記錄。Fable 與觀察者在兩次對話之間不會執行，所以沒有人收到提醒，使用者是自己看到 Argon 的巡檢紀錄才發現。
- 改成：`stall-watch` 只讀頻道。指名給某人的訊息，若對方超過 60 分鐘沒在頻道發言，就在使用者桌面跳一則 macOS 通知；同一則只通知一次。它不用模型額度、不寫 repo、不碰 git 與 `cloudflared`。拿 11/14 的真實頻道重播，23:00 就會發出第一則通知（當時 Argon 已等 64 分鐘），而不是隔天早上由使用者自己發現。要某人接手的訊息改成指名，不寫「全體」。
- 安裝：`node scripts/stall-watch.mjs install`（launchd `com.greenmatch.stall-watch`），須使用者同意才裝。
- 影響的腳本／格式：無（不改頻道格式）
- commit：本筆紀錄所在的 commit
- 單項還原：`node scripts/stall-watch.mjs uninstall`，再刪除兩個檔案並 `git checkout b491cfe -- docs/governance/BOARD_PROTOCOL.md`

### C-33｜2026-11-15｜Fable 排程巡視（初稿每 2 小時，13:15 改為每 4 小時備援；C-35 再修訂）
- 檔案：`.claude/commands/board-sync.md`（第 1 步改成先補齊上次以來的全部頻道與 commit；新增「巡視模式」：異常清單＋處置分級）
- 原本：C-32 的 `stall-watch` 只會在使用者桌面跳通知，等於把發現問題的工作推回使用者，也只認得「有人在等」這一種狀況。
- 改成：排程每 2 小時（08–22 時）叫醒一個全新的 Fable 照「巡視模式」看全局。自己的事直接做；別人卡住就指名推進；規則沒寫到或意見相反時交給觀察者決定；碰到底線或 L4 才記給使用者；沒事什麼都不寫。`stall-watch check` 是它收集事實的工具之一，launchd 通知不安裝。
- 狀態：排程（`greenmatch-fable-patrol`）建立時被權限擋下，**待使用者同意後建立**。
- 13:15 與 Argon 討論後定案（頻道 `mmwhdm9ym4a`／`mmwhdsu7hsm`）：
  - Argon 15 分鐘巡檢負責即時偵測與推進。BOARD_PROTOCOL「不空等」新增一條：等超過 60 分鐘就指名推進，不得以缺簽核為由空等。
  - Fable 排程降為每 4 小時備援。
  - 異常清單補上 Argon 提的 4 項：失聯、搶同一份檔、`:4173` 被別的行程占住、「待複核」被當完工。
  - 昨晚空等的原因有兩個：PROP-0007 的 Fable 實走關卡，以及 Argon 巡檢提示詞寫明「只做唯讀檢查」。
- 影響的腳本／格式：無
- commit：本筆紀錄所在的 commit
- 單項還原：刪除排程，並 `git checkout bcf31ec -- .claude/commands/board-sync.md`
- 註（C-35）：本筆原本誤寫在第 5 節「怎麼還原」之後，已移回這裡，內容未改。

### C-34｜2026-11-15｜記錄發現：第 2 輪審閱與 C-31～C-33 沒經流程長（無規則變更）
- 檔案：`docs/governance/STATUS.md` 第 4 節（新增 1 行）
- 原本：協議規定 CEO 發輪摘要時由流程長執行 `/process-review`；實際上 11/15 的第 2 輪審閱與 C-31、C-32、C-33 由 Fable 兼任流程長直接寫入，現任流程長對話未被叫醒。
- 改成：只記錄發現，不改任何規則。待 Fable 說的「全新流程長」結果出來後對照；是否明訂「流程長不由董事長兼任」、誰是正式流程長，由使用者決定。
- 原因：使用者要求寫成發現並等結果對照。
- 影響的腳本／格式：無
- commit：本筆紀錄所在的 commit
- 單項還原：刪除 STATUS 第 4 節最後一行。
- 註（C-35）：本筆原本寫在第 5 節「怎麼還原」之後，已移回這裡，內容未改。

### C-35｜2026-11-15 13:3x｜獨立流程長審閱 C-31～C-33：補空窗、分清角色、禁止自己審自己
- 審閱者：使用者另開、沒有兼任董事長或 CEO 的全新流程長工作階段，就是 C-34 等待對照的那份結果。C-31～C-33 都是 Fable 以流程長身分自己改的，本筆是事後的獨立確認。與 C-34 對照：發現一致（自己審自己）；本筆另外補了規則（第 4 點），正式流程長是誰仍由使用者決定。
- 結論：C-31 確認（減法）。C-32 確認 `stall-watch check` 與「指名 `--to`」，桌面通知維持不裝。C-33 確認方向，修訂如下。
- 檔案：`docs/governance/BOARD_PROTOCOL.md` 第 2 節異議機制、第 4 節證據標籤、第 5 節角色表（流程長、外部觀察者）與「不空等」；`.claude/commands/board-sync.md` 巡視模式；`.claude/commands/ceo-sync.md` 第 7 步
- 改成：
  1. **送驗不是停工理由**：只有 Claude Code 能開觀察者。CEO 送驗 `--to Fable`，送出後繼續下一件已核定的工作；沒有工作就指名董事長要下一件。依據：11/15 10:15 Argon 寫「可送 OBS-0005」給全體後，到 13:04 沒有任何 commit，設計審查 P2／P3（09:56 已發）卻放著沒做。
  2. **巡視排程**：每天 8、12、16、20、23 時，試行到 11/18。依據：原案 8、12、16、20 時，20 時到隔天 8 時有 12 小時空窗，11/14 22:00 那次照樣會空等 10 小時。加上「快篩」：沒事只跑兩個腳本就結束；每天 8 時跑完整一次。巡視專接只有 Claude Code 能做的事，主要是開觀察者驗收或複驗。
  3. **觀察者分工**：驗收（全新子代理）與代理使用者決定（產品、出貨、董事長意見相反）分開；第 3 節對外、不可逆、安全類爭議以「不做」為準；觀察者不裁決流程規則。規則沒寫到的事先依「不空等」推進，由流程長補寫。巡視交給觀察者送不出去或 60 分鐘沒回，就依證據推進。
  4. **不自己審自己**：董事長或 CEO 兼做流程長時，當場只能做減法；加法先試行，由沒有兼職的流程長下次審閱確認或撤銷，不擋工作。
  5. **證據標籤**：只寫 PASS、沒列出檢查值的算〔AI 評估〕；整則訊息開頭標一次〔實測〕不算數。還掛「待原文複核」的項目不能算進 `DONE`。依據：OBS-0005 §5 推翻 Gemini 盲測 3 項 PASS；PROP-0007 標 `DONE` 時仍有「規則待原文 PDF 複核」。
- 沒改、交給 CEO：`docs/board/RELAY.md` 巡檢界線第 2 點與 Prompt A 仍寫「異常寫進 `STATUS.md`」，和「巡檢在頻道指名推進」不一致，請 CEO 同步。`STATUS.md` §1 PROP-0005 列仍寫「待 Fable 實走」，這道關卡已拿掉。
- 提議（待使用者決定，未改）：Gemini 盲測員 4a～4d 連續四輪沒有獨有發現，3 項 PASS 被觀察者推翻。依流程審閱規則提議：不再算獨立盲測（OBS 第 5 節拿掉），只當 Argon 側 CEO 上線前的自走。
- 影響的腳本／格式：無
- commit：本筆紀錄所在的 commit
- 單項還原：`git checkout 92c0151 -- docs/governance/BOARD_PROTOCOL.md .claude/commands/board-sync.md .claude/commands/ceo-sync.md docs/governance/STREAMLINE_LOG.md docs/governance/STATUS.md`（會一併撤銷 C-33／C-34 移位與 STATUS 第 4 節的整併）

---

## 5. 怎麼還原

**只還原某一個檔案**

```bash
git checkout governance-baseline-pre-streamline -- docs/governance/BOARD_PROTOCOL.md
```

**還原全部治理與規則檔（不動程式碼與歷史提案）**

```bash
git checkout governance-baseline-pre-streamline -- CLAUDE.md AGENTS.md docs/governance/BOARD_PROTOCOL.md docs/governance/TEAM.md docs/governance/STATUS.md docs/governance/PROMPTS.md docs/governance/proposals/TEMPLATE.md docs/governance/observer-reports/TEMPLATE.md docs/board/RELAY.md docs/board/handoff-state.json .claude/commands
```

**沒有 git 標籤時**（例如在別台機器）：從副本複製回原路徑。

```bash
cp -R docs/governance/archive/pre-streamline-48924ea/. .
```

複製後先刪掉多出來的 `./SHA256SUMS`，再用下面這行確認副本沒有被改過：

```bash
cd docs/governance/archive/pre-streamline-48924ea && shasum -a 256 -c SHA256SUMS
```

還原後跑一次 `npx vitest run scripts/board-chat.test.mjs scripts/board-watchdog.test.mjs` 與 `node scripts/board-watchdog.mjs`，確認治理腳本仍讀得到格式。

### C-36｜2026-11-15 13:30｜補三個「資訊不對等」缺口（使用者要求處理）
- 檔案：`scripts/stall-watch.mjs`（新增 `findReviewOverdue`）、`scripts/stall-watch.test.mjs`（新增 1 項）、`docs/governance/BOARD_PROTOCOL.md` 第 6 節（新增兩段）、`.claude/commands/board-sync.md`（異常清單加一項）、`docs/governance/proposals/PROP-0009.md`（新增，L3）
- 原本：沒有任何機制叫到流程長（stall-watch、巡檢、`wait` 都只對 Fable／Argon）；規則沒寫誰能當流程長，Fable 兼任；各對話只讀各自的資料，改規則沒有人通知（C-34 的成因；與 C-35 的獨立審閱互補）。
- 改成：①最新「第 N 輪摘要」超過 2 小時、流程長沒發言，stall-watch 列「等流程長」並通知使用者，Fable 巡視也查；②改規則檔 commit 前先在頻道留一句；③PROP-0009（L3）提「流程長不由董事長兼任」，待雙簽與使用者決定正式流程長，**尚未生效**。
- 原因：資訊不對等來自三處：沒人叫得到流程長、角色定義沒寫、改動不留痕。
- 影響的腳本／格式：`stall-watch` 輸出多一種項目（`id` 以 `review:` 開頭，格式同原項目）；治理腳本測試 34 項全過；提案檔含 `ops-core` 讀取的欄位。
- commit：本筆紀錄所在的 commit
- 單項還原：`git checkout 92c0151 -- scripts/stall-watch.mjs scripts/stall-watch.test.mjs docs/governance/BOARD_PROTOCOL.md .claude/commands/board-sync.md`，並刪除 `PROP-0009.md`。
