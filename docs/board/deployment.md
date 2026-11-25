# GreenMatch 部署紀錄

- **最後部署與驗證時間**: `2026-11-14 15:0x (Asia/Taipei)`（第 1 輪，OBS-0004 修正）
- **公開站**: **沒有。** 舊 quick tunnel 網址 `greg-workshops-carlos-internship.trycloudflare.com` 自 `2026-11-14 04:31` 起 `NXDOMAIN`，**永久失效、無法恢復**。董事會 11:19 共識（`mmwfu7nvdnq`）不重開新的隨機網址；要恢復對外需使用者決定固定網域（L4）與是否補寄（L3）。已寄出的 79 封信連結全部失效。
- **`cloudflared` pid 36846**：行程仍在，但它的網址已失效，等於沒有對外入口。巡檢與 CEO 都不得停止、重啟或新開它。
- **本機生產伺服（唯一運作中的站）**: `http://127.0.0.1:4173`
  - 由 **launchd 常駐**：使用者代理 `com.greenmatch.serve-prod`（`~/Library/LaunchAgents/com.greenmatch.serve-prod.plist`，`RunAtLoad`＋`KeepAlive`，`ThrottleInterval 10`），執行 `node scripts/serve-prod.mjs`，**只聽 `127.0.0.1:4173`**。行程被結束時 launchd 會自動重啟（14:2x 實測：`kill` 後約 10 秒內新 pid 回來）。
  - 管理指令：`node scripts/serve-prod-agent.mjs status|restart|install|uninstall`（`plist` 只印出不安裝）。plist 由腳本依當下的 node 與 repo 路徑產生，不進 git。
  - 紀錄檔：`~/Library/Logs/greenmatch-serve-prod.log`、`greenmatch-serve-prod.err.log`。
  - 巡檢 `board-watchdog`：`:4173` 斷線時唯一可自動處置是 `serve-prod-agent.mjs restart`；`:4173` 被非 node 或非 `127.0.0.1` 的行程占住時報 `origin-4173-foreign-listener`（只回報，不自動停對方）。
- **目前線上建置 (`dist/index.html`)**:
  - 檔案大小: `1,180,060 bytes`
  - SHA-256: `1871aab556227eeebe840cd88d05563ba20a8b1eb1a2776accccaf353d607c17`
  - 離線單檔同步: `artifact/greenmatch.html` (`1,179,487 bytes`)
- **線上健康與一致性驗證**:
  - `curl -s http://127.0.0.1:4173/api/health` → `{"ok":true}`
  - `curl -s http://127.0.0.1:4173/ | shasum -a 256` → `1871aab5…7c17`（與 `dist/index.html` 一致）
  - `lsof -nP -iTCP:4173 -sTCP:LISTEN` → 只有 `node … 127.0.0.1:4173`
- **程式碼遠端**: `origin` = GitHub `chris0308/greenmatch`（2026-11-13 17:54 起推送）。是否為私有 repo 需使用者本人確認（OBS-0004 §3）。

---

## 部署沿革與事件紀錄（2026-11-13）

| 時間 (Asia/Taipei) | 事件 / 版本 | `dist/index.html` SHA-256 前 8 碼 | 備註 |
|---|---|---|---|
| **15:23** | 首次 `serve-prod` + Cloudflare Quick Tunnel 上線 | — | 建立目前固定測試網址，`cloudflared pid 36846` 持續運行至今 |
| **16:49** | `PROP-0001` 首版公開上線 | `99d14053` | 補助口徑修正、`/api/feedback` 白名單、事件金額移除 |
| **16:50–17:20** | **服務短暫中斷事件** | — | 原 `serve-prod.mjs`（`pid 52308`）於此區間意外結束，公開站於 `17:18–17:20` 回傳 `502 Bad Gateway`；**17:20 由 Antigravity 巡檢重啟 `:4173`（不動 `cloudflared`）恢復服務** |
| **17:23** | `PROP-0002`（含導覽列修正 `OBS-0002 #3`、麵包屑） | `9d955577` | `1,096,732 bytes`；同步結束 9 個停在 `7e42e86` 的舊 worktree/branch |
| **17:45** | `PROP-0003` 安全與巡檢底層強化 (`ae0a722`, `7ad5f68`) | — | `serve-prod` 改僅綁 `127.0.0.1`、寫入 `board-watchdog` 巡檢界線、補助台灣時區與 `tax-credit`「政策參考」 |
| **18:35** | `PROP-0004` 同業合作優先媒合 + `:4175` 外部協作模式 (`f411c41`) | `eadad17e` | `1,103,982 bytes`；重啟 `serve-prod.mjs` (`pid 54162`) 載入新端點／靜態服務 |
| **19:03–19:20** | **本輪收尾與體驗改版上線 (`PROP-0003 DONE`)** | `d39bb33b` | `1,138,496 bytes`；終止 `:5174` 殘留 Vite (`pid 50875`)、補齊 `c03` 活動紀錄遮蔽、`CaseCenter` 單頁 Tabs、權重滑桿、ROI 試算機、碳盤查即時試算器與 30 秒快速建立精靈 |
| **22:13–23:05** | **`PROP-0005` 單一工廠數據＋全站瘦身 (`2434a5a`)** | `c1926f39` | `1,175,621 bytes`；Phase 1 (`ccfa110`/`5091c6b`) ＋ Phase 2 (`52ad187`/`bf0e6c0`/`2434a5a`，含 Fable 終驗 2 項修正、4 項順手優化與 `QuoteCompare` 3.8 ROI 實測) 同步 `:4173` 與公開 HTTPS，待 Fable 復驗送交 `OBS-0004` |
| **11-14 04:31** | **公開站失效** | — | quick tunnel 網址 `NXDOMAIN`，永久失效；`cloudflared` 36846 仍在但無用。董事會決定不重開 |
| **11-14 11:25–12:3x** | **`:4173` 停擺** | — | `serve-prod`（pid 54162）結束原因不明；`*:4173` 被 Antigravity 11-13 18:49 遺留的 `python -m http.server`（pid 67183）占住。Fable 12:3x 停掉 67183、手動重啟 `serve-prod`（pid 54667） |
| **11-14 14:2x** | **改為 launchd 常駐（`f6d3e42`）** | `c1926f39` | 停 54667、立即載入 `com.greenmatch.serve-prod`，停機約 1 秒；`kill` 實測自動重啟。`cloudflared` 未碰 |
| **11-14 15:0x** | **第 1 輪：OBS-0004 修正上線（`7bcd38b`、`8de64d3`、`b52636b`、`f314202`）** | `1871aab5` | `1,180,060 bytes`；`npm run check` exit 0（43 檔／498 項）；375px＋深色實走（見 `docs/qa/report.md` §5） |

---

## 本機輔助常駐服務（僅供開發與團隊檢視，不對外隧道開放）

- **董事會雙工頻道與外部共編面板**: `http://127.0.0.1:4175` (`node scripts/board-chat.mjs serve`，需要時才開；11-14 15:00 未在執行)。寫入一律要本機同埠 `Origin` 與 `application/json`，邀請碼只收 `x-board-token` 標頭，提案檔只能留評，網頁顯示名稱不得含 Fable／Argon／CEO（`8de64d3`）
- **團隊看板**: `http://127.0.0.1:4174` (`node scripts/ops-dashboard.mjs`)
- **對外寄信狀態**: `outreachPaused: true`（由使用者於 `16:00` 下令暫停，維持未變更；已寄 60 初邀 + 19 跟催，Wave 2 Batch 4–5 共 40 筆待命）
