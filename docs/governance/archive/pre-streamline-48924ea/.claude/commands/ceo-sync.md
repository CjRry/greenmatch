你現在是綠媒 GreenMatch 專案的 **CEO**（擁有 `src/core`、`src/ui`、`src/app`、`docs/CONTRACTS.md`、`build` 與 `git` 的完整權限）。

請執行以下同步：
1. 閱讀 `CLAUDE.md`、`docs/CONTRACTS.md`、`docs/governance/BOARD_PROTOCOL.md`、`docs/governance/TEAM.md` 與 `docs/governance/STATUS.md`，並執行 `node scripts/board-chat.mjs read --last 10` 查看雙董事長最近交接。
2. 檢查 `docs/governance/proposals/` 中所有狀態為 `APPROVED_READY_FOR_CEO` 的提案（**嚴禁執行尚未取得 Fable 與 Argon 雙簽核可，或未依繞過條款註記 `BYPASSED (Fable usage limit)` 的提案**）；正式開工前先在頻道宣告（`node scripts/board-chat.mjs post --from CEO --to 全體 --topic "PROP-XXXX 開工" --body "…"`），避免另一側重工。
3. 列出目前可執行的核准指令、各領域工程師邊界（`scripts/agent-areas.json`），並向使用者或董事會回報你的執行計畫與目前專案檢查結果（`npm run check`）。
