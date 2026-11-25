# 隊友怎麼參與綠媒

隊友用自己的 Claude Code 參與綠媒。**網站的規劃和設計這類小事，隊友直接做；綠媒的運作模式、管理架構、工作模式這類大方向，要專案負責人批准。**

設計與理由見 `docs/superpowers/specs/2026-11-22-teammate-role-design.md`。

## 三步上手

1. **取得專案。** 專案負責人在 GitHub 邀請你，權限是**唯讀（Read）**。接受邀請後，在專案頁面按「Fork」複製一份到你自己的帳號，再下載（clone）你的那一份，然後跑 `npm ci`。**一律在你自己的那一份上工作。**
2. **打開護欄。** 在專案裡建立 `.claude/settings.local.json`，內容如下。這個檔案只在你的電腦上，不會進版本控制。

   ```json
   { "env": { "GREENMATCH_ROLE": "teammate" } }
   ```

3. **開始。** 在專案資料夾打開 Claude Code，輸入 `/teammate`。

## 小事和大事

| | 小事（隊友直接做） | 大事（要專案負責人批准） |
|---|---|---|
| 網站畫面 | 版面、順序、文案、空狀態說明、標籤文字、用現有顏色調整樣式、修明顯的畫面問題 | 刪除頁面或功能 |
| 規劃與設計文件 | 網站規劃、頁面內容清單、設計說明（`docs/design/`） | — |
| 綠媒怎麼運作 | — | 8 個階段、只推薦 2 家、媒合怎麼計分、哪一方負責哪個階段、角色與權限 |
| 誰管什麼 | — | 工作區域、決策分級、董事會與 CEO 的分工 |
| 團隊怎麼合作 | — | 流程、規則、審核方式、`CLAUDE.md`、`.claude/` 內的設定 |
| 對外與花錢 | — | 寄信、公開網站與網域、帳號、任何付費 |
| 資料與程式核心 | — | 資料結構、`src/core`、`src/data`、`src/types`、設定檔、`scripts/`、新增套件 |

小事能改哪些檔案，以 `scripts/teammate-paths.json` 為準。要放寬或收緊，改那個檔案（這本身是大事）。

## 小事怎麼走

1. 你的 Claude 改好、跑 `npm run check` 通過。
2. 你 commit，推到你自己的那一份，在 GitHub 送 PR 給專案。
3. CEO 下一次工作時，用 `node scripts/check-teammate-pr.mjs <PR 編號>` 檢查：作者是唯讀協作者、改的檔案都在小事範圍、沒有刪檔、沒有讀檔或連網一類的寫法。通過後 CEO 再讀過整份改動、跑完整檢查，才合併、推回 GitHub 並更新網站。PR 會自動顯示為已合併。
4. 沒通過的，CEO 不合併，交給專案負責人決定。

小事不是即時合併，要等 CEO 下一次工作。開工前在你的那一份按「Sync fork」拿最新版本。

## 大事怎麼走

1. 你的 Claude 不動手改，在 `docs/governance/teammate/requests/` 寫一份請求單（照 `TEMPLATE.md`）。
2. 你把請求單放在另一個分支，**單獨**送一個 PR。
3. 專案負責人在 GitHub 按「合併」就是同意，按「關閉」就是不同意。CEO 永遠不替專案負責人合併請求單。
4. 同意後，CEO 照請求單執行，做完把狀態改成 `已完成`。需要董事會決定的事，CEO 照 `BOARD_PROTOCOL.md` 往上送，專案負責人的同意不取代董事會流程。

## 你看得到的內容

整個專案都看得到，包括治理文件、頻道紀錄（`channel.jsonl`）、過往的試用回饋評分與寄信模板，以及專案負責人的聯絡信箱。外寄名單與試用回饋原始資料不在版本控制內，你看不到。

## 護欄的限制

`.claude/settings.local.json` 的護欄只在你的電腦上擋 Claude 的誤操作，不是安全邊界。

## GitHub 權限（2026-11-23 專案負責人決定）

repo 放在專案負責人建立的**免費 GitHub 組織** `greenmatch-ncku` 底下（https://github.com/greenmatch-ncku/greenmatch）。專案負責人是組織唯一的管理員。隊友以**唯讀（Read）**協作者加入，系統從根本上不讓他改主要版本，所有改動都要經過 PR。組織已開啟「私有 repo 可以 Fork」，隊友才能複製一份來改。

- 隊友不用加進 `scripts/teammate-paths.json`：檢查程式直接問 GitHub，作者是唯讀協作者就算隊友。
- CEO 只執行「由專案負責人本人在 GitHub 合併」的請求單（`gh pr view <編號> --json mergedBy`）。
- 邀請隊友：repo 的 Settings → Collaborators and teams → Add people，角色選 **Read**。**不要選 Write 以上**，否則隊友能直接改主要版本，檢查程式也會把他的 PR 交給專案負責人。

## 收回權限

- 專案負責人在 GitHub 移除協作者，你就看不到新的內容。已經下載的舊版本收不回來。
- 只想暫停代為合併：告訴 CEO 暫停，所有隊友的 PR 都會停下來交給專案負責人。
