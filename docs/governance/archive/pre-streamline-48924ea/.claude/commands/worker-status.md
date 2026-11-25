請先閱讀 `CLAUDE.md` 與 `docs/CONTRACTS.md`，並確認你目前的環境變數 `PAPERCLIP_AGENT_ID` 所對應的負責區域（見 `scripts/agent-areas.json`）。

請執行以下檢查與待命：
1. 確認你的寫入權限範圍（僅限你所屬的 `area`，不可跨越修改其他 feature 或 shared files）。
2. 執行你所屬區域的檢查指令：`npm run check:<area>`（例如 `npm run check:market`）。
3. 回報目前你負責區域的檔案現況、測試是否通過，以及是否有需要請 `CEO` 協助修改的 shared files。
