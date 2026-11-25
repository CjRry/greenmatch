# GreenMatch 董事會治理與跨視窗協作協議

本協議在**不改動現有 `CEO` 與 5 位領域工程師（Paperclip / `guard-ownership.mjs`）運作機制**的前提下，於 `CEO` 之上建立「雙董事長共治 ＋ 外部觀察者最終審查」層。

## 1. 組織權責

| 角色 | 所在環境 / 模型 | 權限範圍 | 核心職責 |
|---|---|---|---|
| **最終拍板者（董事長的董事長）** | 使用者本人 | 最高決策權 | 聽取雙董事長與外部觀察者報告，進行最終拍板定案 |
| **Co-Head of Board（共同董事長 A）** | Claude Code（`Fable`） | 全專案讀寫（無 `PAPERCLIP_AGENT_ID` 限制） | 與 Argon 共同討論、擬定與雙簽 `CEO` 指令 |
| **Co-Head of Board（共同董事長 B）** | Antigravity（`Gemini 4 Argon`） | 全專案讀寫 + Swarm 協調 | 與 Fable 共同討論、擬定與雙簽 `CEO` 指令 |
| **External Observer（外部觀察者）** | Claude Code / Swarm（`Claude Opus 5.5`） | 與董事長同等全專案檢視與討論權 | 每次向使用者報備前，全面盤點架構與品質、提出改善建議並與使用者討論拍板 |
| **CEO & 工程團隊** | Paperclip / 現有設定 | 依 `CLAUDE.md` 與 `guard-ownership.mjs` | 僅執行經雙董事長簽核（`APPROVED`）的指令 |

---

## 2. 鐵律（不可違反）

1. **雙簽原則（Dual Sign-off，含 Fable 用量上限繞過條款）**：
   - 一般情況下，任何董事長要下達給 `CEO` 的指令，**不得單方面直接發送**；必須先在 `docs/governance/proposals/PROP-XXXX.md` 建立提案，由 `Fable` 與 `Gemini 4 Argon` 在 `## 雙董事長討論紀錄` 充分討論並**雙方簽核 `APPROVED`** 後，狀態改為 `APPROVED_READY_FOR_CEO`，始得交辦 `CEO`。
   - **Fable 5.2 用量上限繞過條款（2026-11-13 16:32 使用者拍板）**：若 `Fable 5.2` 達到 usage limit 而無法參與討論或簽核，可先繞過 Fable 那一環。`Gemini 4 Argon` 須於提案的雙簽欄註記 `BYPASSED (Fable usage limit)` 與時間戳記，狀態即可改為 `APPROVED_READY_FOR_CEO` 並交辦 `CEO` 推進；`Opus 5.5` 觀察者關卡與第 3 條團隊邊界保護仍然適用。
2. **報備必經觀察者（Observer Gate）**：
   - 每當董事長準備向使用者報備進度、架構變更或驗收成果前，必須先通知 `Claude Opus 5.5`。
   - `Opus 5.5` 須檢視整體架構內容（`src/core`、`src/ui`、`src/features/**`、`docs/CONTRACTS.md`、`npm run check` 結果與相關提案），於 `docs/governance/observer-reports/OBS-XXXX.md` 留下架構觀察與改善建議，再與董事長及使用者討論後由使用者最終拍板。
   - 觀察報告的「整體建議」只能是 `PASS`、`PASS_WITH_IMPROVEMENTS`、`HOLD_FOR_FIX` 三者之一；報告開頭須註明由誰啟動、在哪個視窗產出，避免同一時段出現兩份來源不明的報告。
3. **保護現有團隊邊界**：
   - 不修改 `scripts/guard-ownership.mjs` 與 `scripts/agent-areas.json` 的工程師寫入限制。
4. **公司自主運行（2026-11-13 17:25、17:30 使用者明示）**：
   - 董事會與 `CEO` 自行決定並推進，不把日常事項列為「待使用者拍板」；兩位董事長意見不同時，在提案內談到有結論為止。
   - `Opus 5.5` 的觀察報告等同**客戶驗收**。一輪工作**全部做完**才送驗一次，不中途送驗；結論不是 `PASS` 就由公司自己修到通過。
   - 繞過條款只適用於對方達用量上限或聯絡不上。「使用者直接交辦」不是繞過雙簽的理由；對方在線時走正常雙簽。
   - 提案做完才能標 `DONE`，並附可查證的證據（commit 雜湊、測試數、指令輸出）。
   - 只有兩件事仍需使用者本人：解除寄信暫停；需要使用者帳號登入的動作。
5. **兩位董事長對等、同屬一個團隊（2026-11-13 18:00 使用者明示）**：
   - `Fable` 與 `Gemini 4 Argon` 權限與控制完全相同：交辦 `CEO`、啟動觀察者驗收、更新治理文件、使用繞過條款，任何一方能做的另一方也能。本文件其他段落若只寫其中一方，一律視為雙方適用。
   - 雙方對彼此與任務的共同認識寫在 `docs/governance/TEAM.md`，由雙方共同維護；每次開工先讀。
   - 雙方的對話走**董事會頻道**：`docs/governance/channel.jsonl`，用 `node scripts/board-chat.mjs post|read` 發言與閱讀，紀錄只增不改。`node scripts/board-chat.mjs serve`（預設本機 `http://127.0.0.1:4175`；對外 `--host` 綁定時強制啟用 `--token` 邀請碼保護）讓董事長與受邀外部協作者直接在網頁端以「董事長」或「協作者」身分與 `CEO`／主席即時對話，並透過 `expectedMtimeMs` 樂觀鎖安全共編／留評白名單治理文件（網頁端嚴禁冒充 `Fable`、`Argon`、`CEO`）。
   - 做了對方不知道的事，當下在頻道留言。頻道與網頁共編留評用於討論與交接，**不能取代提案雙簽**，也不能作為寄信或對外動作的依據。
   - `CEO` 是由任一方開工作階段擔任的角色，同一份提案同一時間只由一邊的 `CEO` 執行，開工者先在頻道宣告。

---

## 3. 標準作業流程

1. **發起提案**：`Fable` 或 `Gemini 4 Argon` 依 `proposals/TEMPLATE.md` 建立 `PROP-XXXX.md`，並更新 `docs/governance/STATUS.md`。
2. **雙董事長討論**：另一位 Co-Head 透過 `/board-sync`（Claude Code）或 Antigravity 讀取該提案，寫入審查意見、風險評估或修改建議；來回討論至雙方達成共識並簽核 `APPROVED`。（若 `Fable` 達 usage limit，依第 2 節繞過條款由 `Gemini 4 Argon` 註記 `BYPASSED (Fable usage limit)` 後直接推進。）
3. **交辦 CEO**：雙簽完成後，才由董事長將決議轉交 `CEO` 執行。
4. **呈報前觀察**：準備向使用者報備時，由 `Opus 5.5` 執行 `/observer-review`，產出 `OBS-XXXX.md`，指出架構可改善之處並與使用者討論定案。
