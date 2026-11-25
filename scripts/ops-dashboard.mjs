import http from 'node:http'
import { answerQuestion, collectOverview } from './ops-core.mjs'
import { collectState as collectBoardChannel } from './board-chat.mjs'

const HOST = '127.0.0.1'
const PORT = Number(process.env.OPS_PORT || 4174)

const SHARED_CSS = `
  :root {
    color-scheme: light dark;
    --bg: #f6f7f5;
    --surface: #ffffff;
    --sunken: #eef1ed;
    --ink: #17201b;
    --ink-soft: #44534a;
    --muted: #69786f;
    --line: #d6ded8;
    --brand: #177245;
    --brand-soft: #e6f4ec;
    --navy: #1f3b5c;
    --navy-soft: #eaf0f6;
    --warn: #9a5b00;
    --warn-soft: #fef4e2;
    --danger: #b42318;
    --danger-soft: #feeceb;
    --purple: #5b3cc4;
    --purple-soft: #f0ecfc;
    --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --sans: "Noto Sans TC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #101512;
      --surface: #18201b;
      --sunken: #1f2923;
      --ink: #edf2ee;
      --ink-soft: #bcc9c0;
      --muted: #8ea094;
      --line: #2d3a32;
      --brand: #3fb978;
      --brand-soft: #153122;
      --navy: #7fb0e3;
      --navy-soft: #172738;
      --warn: #f0b14b;
      --warn-soft: #312512;
      --danger: #f47166;
      --danger-soft: #361918;
      --purple: #b49cff;
      --purple-soft: #251e3e;
    }
  }
  :root[data-theme="dark"] {
    --bg: #101512;
    --surface: #18201b;
    --sunken: #1f2923;
    --ink: #edf2ee;
    --ink-soft: #bcc9c0;
    --muted: #8ea094;
    --line: #2d3a32;
    --brand: #3fb978;
    --brand-soft: #153122;
    --navy: #7fb0e3;
    --navy-soft: #172738;
    --warn: #f0b14b;
    --warn-soft: #312512;
    --danger: #f47166;
    --danger-soft: #361918;
    --purple: #b49cff;
    --purple-soft: #251e3e;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.55;
  }
  a { color: var(--brand); text-decoration: none; font-weight: 600; }
  a:hover { text-decoration: underline; }
  button, select, input { font: inherit; color: var(--ink); }
  .btn {
    border: 1px solid var(--line);
    background: var(--surface);
    padding: 6px 11px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }
  .btn:hover { background: var(--sunken); }
  .btn.active { background: var(--brand); border-color: var(--brand); color: #fff; }
  .btn.primary { background: var(--brand); border-color: var(--brand); color: #fff; }
  .chip {
    border: 1px solid var(--line);
    background: var(--sunken);
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }
  .chip:hover { border-color: var(--brand); color: var(--brand); }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    font-family: var(--mono);
  }
  .b-brand { background: var(--brand-soft); color: var(--brand); }
  .b-navy { background: var(--navy-soft); color: var(--navy); }
  .b-warn { background: var(--warn-soft); color: var(--warn); }
  .b-danger { background: var(--danger-soft); color: var(--danger); }
  .b-purple { background: var(--purple-soft); color: var(--purple); }
  .b-muted { background: var(--sunken); color: var(--muted); }
  .mono { font-family: var(--mono); }
  .muted { color: var(--muted); font-size: 12px; }
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 14px 16px;
  }
  .input {
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 6px;
    padding: 7px 11px;
    font-size: 13px;
    min-width: 220px;
    flex: 1;
  }
  .pre {
    background: var(--sunken);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 10px 12px;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12.5px;
    line-height: 1.55;
    margin: 6px 0 0;
    max-height: 460px;
    overflow: auto;
  }
  .parity-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 12px; }
  .peer-card {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 12px 14px;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .peer-card.fable { border-left: 4px solid var(--navy); }
  .peer-card.argon { border-left: 4px solid var(--brand); }
  .task-banner {
    background: var(--sunken);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    align-items: center;
    font-size: 12.5px;
  }
  .chat-stream {
    background: var(--sunken);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 540px;
    overflow-y: auto;
  }
  .chat-row { display: flex; flex-direction: column; max-width: 84%; }
  .chat-row.side-left { align-self: flex-start; align-items: flex-start; }
  .chat-row.side-right { align-self: flex-end; align-items: flex-end; }
  .chat-row.side-center { align-self: center; align-items: center; max-width: 92%; width: 100%; }
  .chat-bubble {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px 14px;
    background: var(--surface);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    width: 100%;
  }
  .chat-row.sender-fable .chat-bubble { background: var(--navy-soft); border-color: rgba(31, 59, 92, 0.28); }
  .chat-row.sender-argon .chat-bubble { background: var(--brand-soft); border-color: rgba(23, 114, 69, 0.28); }
  .chat-row.sender-user .chat-bubble { background: var(--warn-soft); border-color: rgba(154, 91, 0, 0.35); }
  .chat-row.sender-opus .chat-bubble { background: var(--purple-soft); border-color: rgba(91, 60, 196, 0.28); }
  .chat-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 5px; font-size: 12px; }
  .chat-text { white-space: pre-wrap; word-break: break-word; font-size: 13.5px; line-height: 1.55; }
  .chat-compose {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .textarea {
    width: 100%;
    min-height: 76px;
    resize: vertical;
    padding: 9px 11px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 13.5px;
    line-height: 1.5;
  }
  .select {
    padding: 7px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
  }
`

const DASHBOARD_HTML = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>綠媒 GreenMatch — 全域團隊與治理監控台 (Swarm × Fable 5.2 × Opus 5.5)</title>
<style>
  ${SHARED_CSS}
  .topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    padding: 12px 20px;
  }
  .topbar-inner {
    max-width: 1360px;
    margin: 0 auto;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }
  .title-wrap h1 { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -0.01em; }
  .title-wrap p { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .wrap {
    max-width: 1360px;
    margin: 0 auto;
    padding: 16px 20px 48px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .ask-box {
    background: var(--surface);
    border: 1px solid var(--brand);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ask-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .ask-answer {
    background: var(--sunken);
    border-radius: 8px;
    padding: 10px 12px;
    border: 1px solid var(--line);
  }
  .ask-answer ul { margin: 6px 0 0 18px; padding: 0; }
  .ask-answer li { margin-bottom: 4px; font-size: 13px; white-space: pre-wrap; }
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 10px;
  }
  .tab {
    border: 1px solid var(--line);
    background: var(--surface);
    padding: 7px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 13px;
  }
  .tab.active { background: var(--navy); border-color: var(--navy); color: #fff; }
  .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
  .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 14px; }
  .card h2 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .card h3 { margin: 10px 0 6px; font-size: 13px; font-weight: 700; color: var(--ink-soft); }
  .member-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
  .member-card {
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 8px;
    padding: 10px 12px;
    cursor: pointer;
    text-align: left;
  }
  .member-card.selected { border-color: var(--brand); box-shadow: 0 0 0 2px var(--brand-soft); }
  .msg-list { display: flex; flex-direction: column; gap: 8px; max-height: 680px; overflow: auto; }
  .msg-item { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; background: var(--surface); }
  .msg-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 700; }
  .pill-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
</style>
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <div class="title-wrap">
      <h1>綠媒 GreenMatch — 全域工作監控台</h1>
      <p id="subline">載入中…</p>
    </div>
    <div class="controls">
      <a class="btn primary" href="/chat">雙 CEO 對話框 (/chat)</a>
      <a class="btn" href="http://127.0.0.1:4175" target="_blank" rel="noreferrer">獨立頻道 (:4175)</a>
      <a class="btn" href="/ask">極簡問進度頁 (/ask)</a>
      <button class="btn active" id="autoBtn" type="button">自動更新：開 (5s)</button>
      <button class="btn" id="refreshBtn" type="button">立即重新整理</button>
      <button class="btn" id="themeBtn" type="button">切換深淺色</button>
    </div>
  </div>
</header>
<main class="wrap">
  <section class="ask-box" aria-label="隨時問進度">
    <form class="ask-row" id="askForm">
      <strong>隨時問進度（零額度即時查核）：</strong>
      <input class="input" id="askInput" placeholder="輸入想問的問題，例如：現在進行到哪裡了？Fable 5.2 卡在哪？還缺我拍板什麼？@ceo 在做什麼？" />
      <button class="btn primary" type="submit">查詢</button>
    </form>
    <div class="ask-row">
      <button class="chip" type="button" data-q="現在進行到哪裡了？">現在進行到哪裡了？</button>
      <button class="chip" type="button" data-q="還缺我拍板什麼？">還缺我拍板什麼？</button>
      <button class="chip" type="button" data-q="Fable 5.2 進度">Fable 5.2 進度</button>
      <button class="chip" type="button" data-q="Opus 5.5 審查重點">Opus 5.5 審查重點</button>
      <button class="chip" type="button" data-q="外寄與公開站狀態">外寄與公開站狀態</button>
      <button class="chip" type="button" data-q="Swarm 各人員在幹嘛？">Swarm 各人員在幹嘛？</button>
    </div>
    <div class="ask-answer" id="askResult">載入最新摘要中…</div>
  </section>

  <nav class="tabs" id="tabs"></nav>
  <section id="content"></section>
</main>
<script>
const state = {
  tab: 'chat',
  autoRefresh: true,
  data: null,
  selectedAgent: 'ALL',
  search: '',
  newestFirst: true,
  selectedDocName: null,
  chatTopicFilter: 'ALL',
  lastAskQuery: '現在進行到哪裡了？',
  lastAnswer: null,
};

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleString('zh-TW', { hour12: false });
}

function badgeClass(val) {
  const s = String(val || '').toUpperCase();
  if (s.includes('APPROVED') || s === 'WAITING' || s === 'LIVE') return 'b-brand';
  if (s.includes('HOLD') || s.includes('PENDING') || s.includes('PAUSED')) return 'b-warn';
  if (s.includes('REJECT') || s === 'KILLED' || s === 'DOWN') return 'b-danger';
  if (s.includes('WORKING')) return 'b-purple';
  return 'b-muted';
}

function renderAnswerBox() {
  const el = document.getElementById('askResult');
  const a = state.lastAnswer;
  if (!a) return;
  el.innerHTML = \`
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <strong>\${esc(a.headline)}</strong>
      <span class="mono muted">查詢：\${esc(a.question)} ｜ \${esc(fmtTime(a.answeredAt))}</span>
    </div>
    <ul>\${a.bullets.map((b) => \`<li>\${esc(b)}</li>\`).join('')}</ul>
    \${a.nextActions?.length ? \`<div style="margin-top:6px;font-size:12.5px;color:var(--brand)"><strong>建議下一步：</strong>\${esc(a.nextActions.join(' '))}</div>\` : ''}
    <div class="muted" style="margin-top:4px">來源：\${esc(a.sources.join('、'))}</div>
  \`;
}

async function runAsk(query) {
  state.lastAskQuery = query || '現在進行到哪裡了？';
  try {
    const res = await fetch('/api/ask?q=' + encodeURIComponent(state.lastAskQuery), { cache: 'no-store' });
    state.lastAnswer = await res.json();
    renderAnswerBox();
  } catch (err) {
    document.getElementById('askResult').textContent = '查詢失敗：' + err;
  }
}

function renderTabs() {
  const d = state.data;
  const obsCount = d?.governance?.observerReports?.length ?? 0;
  const propCount = d?.governance?.proposals?.length ?? 0;
  const msgCount = d?.swarm?.messages?.length ?? 0;
  const chatCount = d?.channel?.messages?.length ?? 0;
  const tabs = [
    { id: 'chat', label: \`雙 CEO 對話框（\${chatCount} 則）\` },
    { id: 'overview', label: '總覽（All Roles）' },
    { id: 'fable', label: \`Fable 5.2 共同董事長（\${propCount} 提案）\` },
    { id: 'opus', label: \`Claude Opus 5.5 外部觀察者（\${obsCount} 報告）\` },
    { id: 'swarm', label: \`Swarm 全體工作人員（\${msgCount} 對話）\` },
    { id: 'files', label: \`檔案異動與 Worktrees（\${d?.workspace?.gitStatusCount ?? 0}）\` },
  ];
  document.getElementById('tabs').innerHTML = tabs.map((t) =>
    \`<button type="button" class="tab \${state.tab === t.id ? 'active' : ''}" data-tab="\${t.id}">\${esc(t.label)}</button>\`
  ).join('');
  document.querySelectorAll('[data-tab]').forEach((el) => {
    el.addEventListener('click', () => {
      state.tab = el.getAttribute('data-tab');
      render();
    });
  });
}

function renderOverview(d) {
  const props = d.governance.proposals;
  const obs = d.governance.observerReports;
  const latestProp = props[0];
  const latestObs = obs[0];
  const aliveMembers = d.swarm.members.filter((m) => !m.killed);
  const killedMembers = d.swarm.members.filter((m) => m.killed);
  const s = d.governance.statusSections;

  return \`
    <div class="grid-4">
      <div class="card">
        <h2>
          <span>Fable 5.2（Claude Code）</span>
          <span class="badge b-navy">Co-Head A</span>
        </h2>
        <div class="muted">負責提案、架構一致性、與 Argon 雙簽 \${d.services.fableBypassEnabled ? '｜<span class="badge b-warn">額度滿可繞過</span>' : ''}</div>
        <h3>最新提案：\${latestProp ? esc(latestProp.id) : '無'}</h3>
        \${latestProp ? \`<div><span class="badge \${badgeClass(latestProp.status)}">\${esc(latestProp.status)}</span> <span class="muted">建立：\${esc(latestProp.createdAt)}</span></div>\` : ''}
        <pre class="pre">\${esc(latestProp ? latestProp.fableOpinion : '尚無提案意見')}</pre>
      </div>

      <div class="card">
        <h2>
          <span>Claude Opus 5.5（Observer）</span>
          <span class="badge \${badgeClass(latestObs?.verdict)}">\${esc(latestObs?.verdict || '無報告')}</span>
        </h2>
        <div class="muted">負責報備前全域架構與誠實度稽核</div>
        <h3>最新報告：\${latestObs ? esc(latestObs.id) : '無'}</h3>
        <div class="muted">審查時間：\${esc(latestObs?.reviewedAt || '—')}</div>
        <pre class="pre">\${esc(latestObs ? latestObs.pendingRulings : '尚無審查報告')}</pre>
      </div>

      <div class="card">
        <h2>
          <span>Gemini 4 Argon（Antigravity）</span>
          <span class="badge b-brand">Co-Head B</span>
        </h2>
        <div class="muted">負責 Swarm 調度、雙簽共治、外聯停發驗證</div>
        <h3>交接狀態（RELAY）</h3>
        <div>
          <span class="badge \${d.services.outreachPaused ? 'b-warn' : 'b-brand'}">\${d.services.outreachPaused ? '⛔ 外寄已暫停' : '外寄運行中'}</span>
          <span class="badge \${d.services.origin4173Up ? 'b-brand' : 'b-danger'}">:4173 \${d.services.origin4173Up ? 'LIVE' : 'DOWN'}</span>
          <span class="badge \${d.services.cloudflaredRunning ? 'b-brand' : 'b-danger'}">Tunnel \${d.services.cloudflaredRunning ? 'UP' : 'DOWN'}</span>
        </div>
        <pre class="pre">\${esc(latestProp ? latestProp.argonOpinion : '尚無 Argon 意見')}</pre>
      </div>

      <div class="card">
        <h2>
          <span>Swarm 執行團隊</span>
          <span class="badge b-purple">\${aliveMembers.length} 待命 / \${killedMembers.length} 已結束</span>
        </h2>
        <div class="muted">活躍成員：\${aliveMembers.map((m) => esc(m.name)).join('、') || '無'}</div>
        <h3>外聯與評分現況</h3>
        <div class="muted">已寄初邀：\${d.relay.outreach.counts.SENT} ｜跟催：\${d.relay.outreach.counts.FOLLOWUP_SENT} ｜退信：\${d.relay.outreach.counts.BOUNCED} ｜待發：\${d.relay.outreach.pendingCount}</div>
        <pre class="pre">\${esc(d.swarm.messages.slice(-5).reverse().map((m) => \`#\${m.seq} [\${m.time}] @\${m.agent}: \${m.text.slice(0, 180)}\${m.text.length > 180 ? '…' : ''}\`).join('\\n\\n'))}</pre>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2><span>待您最終拍板事項（STATUS.md）</span><span class="badge b-warn">需使用者裁定</span></h2>
        <pre class="pre">\${esc(s.pendingUserRuling || '目前無待拍板項目')}</pre>
        <h3>已雙簽可交辦 CEO</h3>
        <pre class="pre">\${esc(s.readyForCeo || '目前無')}</pre>
      </div>
      <div class="card">
        <h2><span>全團隊最新檔案活動（按時間排序）</span><span class="badge b-muted">即時讀取磁碟</span></h2>
        <table>
          <thead><tr><th>檔案路徑</th><th>最後修改</th></tr></thead>
          <tbody>
            \${d.workspace.recentFiles.slice(0, 14).map((f) => \`<tr><td class="mono">\${esc(f.relPath)}</td><td class="mono muted">\${esc(fmtTime(f.mtime))}</td></tr>\`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  \`;
}

function renderFable(d) {
  const fWt = d.workspace.worktrees.filter((w) => w.name.includes('board-sync'));
  return \`
    <div class="grid-2">
      <div class="card">
        <h2><span>Fable 5.2 工作區與治理狀態看板</span><span class="badge b-navy">STATUS.md</span></h2>
        <div class="muted">Claude Code Worktree：\${fWt.length ? fWt.map((w) => \`\${esc(w.name)} (\${esc(w.head)}, dirty=\${w.dirtyCount})\`).join('、') : '使用主工作區'} ｜ 用量上限繞過：\${d.services.fableBypassEnabled ? '已啟用' : '未啟用'}</div>
        <pre class="pre" style="max-height:620px">\${esc(d.governance.statusMd)}</pre>
      </div>
      <div class="card">
        <h2><span>跨視窗交接紀錄（RELAY.md）與協議</span><span class="badge b-brand">Protocol</span></h2>
        <pre class="pre" style="max-height:300px">\${esc(d.governance.protocolMd)}</pre>
        <pre class="pre" style="max-height:300px">\${esc(d.relay.relayMd)}</pre>
      </div>
    </div>
    \${d.governance.proposals.map((p) => \`
      <div class="card">
        <h2>
          <span>\${esc(p.title)}</span>
          <span>
            <span class="badge \${badgeClass(p.status)}">\${esc(p.status)}</span>
            <span class="badge b-muted">更新：\${esc(fmtTime(p.mtime))}</span>
          </span>
        </h2>
        <div class="muted">發起人：\${esc(p.initiator)} ｜ 影響範圍：\${esc(p.scope)}</div>
        <pre class="pre" style="max-height:600px">\${esc(p.content)}</pre>
      </div>
    \`).join('')}
  \`;
}

function renderOpus(d) {
  const oWt = d.workspace.worktrees.filter((w) => w.name.includes('observer'));
  return \`
    <div class="card">
      <h2><span>Claude Opus 5.5 外部觀察者視窗狀態</span><span class="badge b-purple">External Observer</span></h2>
      <div class="muted">Claude Code Worktree：\${oWt.length ? oWt.map((w) => \`\${esc(w.name)} (\${esc(w.head)}, dirty=\${w.dirtyCount})\`).join('、') : '使用主工作區'} ｜ 待審查：\${esc(d.governance.statusSections.pendingObserver || '無')}</div>
    </div>
    \${d.governance.observerReports.map((r) => \`
      <div class="card">
        <h2>
          <span>\${esc(r.title)}</span>
          <span>
            <span class="badge \${badgeClass(r.verdict)}">\${esc(r.verdict)}</span>
            <span class="badge b-muted">更新：\${esc(fmtTime(r.mtime))}</span>
          </span>
        </h2>
        <div class="muted">審查時間：\${esc(r.reviewedAt)} ｜ 對象：\${esc(r.target)}</div>
        <pre class="pre" style="max-height:760px">\${esc(r.content)}</pre>
      </div>
    \`).join('')}
  \`;
}

function renderSwarm(d) {
  const msgs = d.swarm.messages.slice();
  if (state.newestFirst) msgs.reverse();
  const q = state.search.trim().toLowerCase();
  const filtered = msgs.filter((m) => {
    if (state.selectedAgent !== 'ALL' && m.agent !== state.selectedAgent) return false;
    if (q && !m.text.toLowerCase().includes(q) && !m.agent.toLowerCase().includes(q)) return false;
    return true;
  });

  const activeDoc = d.boardDocs.find((doc) => doc.name === state.selectedDocName) || d.boardDocs.find((doc) => doc.name === 'final-report.md') || d.boardDocs[0];

  return \`
    <div class="card">
      <h2>
        <span>Swarm 工作人員名單（點擊可過濾發言）</span>
        <span class="badge b-muted">快照時間：\${esc(fmtTime(d.swarm.snapshotAt))} ｜ Head #\${d.swarm.head}</span>
      </h2>
      <div class="member-grid">
        <button type="button" class="member-card \${state.selectedAgent === 'ALL' ? 'selected' : ''}" data-agent="ALL">
          <div><strong>全部人員</strong> <span class="badge b-navy">\${d.swarm.messages.length} 則</span></div>
          <div class="muted">顯示所有 Swarm 成員訊息</div>
        </button>
        \${d.swarm.members.map((m) => \`
          <button type="button" class="member-card \${state.selectedAgent === m.name ? 'selected' : ''}" data-agent="\${esc(m.name)}">
            <div style="display:flex;justify-content:space-between;gap:6px;align-items:center">
              <strong class="mono">@\${esc(m.name)}</strong>
              <span class="badge \${badgeClass(m.killed ? 'KILLED' : m.state)}">\${esc(m.killed ? 'killed' : m.state)}</span>
            </div>
            <div class="muted">\${esc(m.model_display_name || m.model)}</div>
            <div class="muted">最後發言：\${esc(m.last_post_time || '無')}</div>
          </button>
        \`).join('')}
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h2><span>Swarm 訊息板時間線（\${filtered.length} 則）</span></h2>
        <div class="toolbar">
          <input class="input" id="swarmSearch" placeholder="搜尋關鍵字或成員名稱…" value="\${esc(state.search)}" />
          <button class="btn" id="sortToggle" type="button">\${state.newestFirst ? '排序：最新優先' : '排序：最舊優先'}</button>
        </div>
        <div class="msg-list">
          \${filtered.map((m) => \`
            <div class="msg-item">
              <div class="msg-head">
                <span><span class="badge b-navy mono">#\${m.seq} @\${esc(m.agent)}</span> \${m.kind ? \`<span class="badge b-muted">\${esc(m.kind)}</span>\` : ''}</span>
                <span class="mono muted">\${esc(m.time)}</span>
              </div>
              <pre class="pre" style="max-height:280px">\${esc(m.text)}</pre>
            </div>
          \`).join('') || '<div class="muted">沒有符合條件的訊息</div>'}
        </div>
      </div>

      <div class="card">
        <h2><span>Swarm 各角色產出報告（docs/board/）</span></h2>
        <div class="pill-row">
          \${d.boardDocs.map((doc) => \`<button type="button" class="btn \${activeDoc?.name === doc.name ? 'active' : ''}" data-doc="\${esc(doc.name)}">\${esc(doc.name)}</button>\`).join('')}
        </div>
        \${activeDoc ? \`
          <div class="muted">\${esc(activeDoc.relPath)} ｜ 修改：\${esc(fmtTime(activeDoc.mtime))}</div>
          <pre class="pre" style="max-height:610px">\${esc(activeDoc.content)}</pre>
        \` : '<div class="muted">無報告檔案</div>'}
      </div>
    </div>
  \`;
}

function renderFiles(d) {
  return \`
    <div class="grid-2">
      <div class="card">
        <h2><span>Worktrees（含 Fable / Opus 專用工作樹）</span></h2>
        <table>
          <thead><tr><th>名稱</th><th>分支</th><th>HEAD</th><th>未提交變更</th></tr></thead>
          <tbody>
            \${d.workspace.worktrees.map((w) => \`<tr><td class="mono">\${esc(w.name)}\${w.isClaudeWorktree ? ' <span class="badge b-purple">Claude</span>' : ''}</td><td class="mono">\${esc(w.branch)}</td><td class="mono">\${esc(w.head)}</td><td>\${w.dirtyCount}</td></tr>\`).join('')}
          </tbody>
        </table>
        <h3>最近 Git Commits</h3>
        <table>
          <thead><tr><th>Hash</th><th>日期</th><th>訊息</th></tr></thead>
          <tbody>
            \${d.workspace.gitLog.map((c) => \`<tr><td class="mono">\${esc(c.hash)}</td><td class="mono">\${esc(c.date)}</td><td>\${esc(c.message)}</td></tr>\`).join('')}
          </tbody>
        </table>
      </div>
      <div class="card">
        <h2><span>工作區未提交變更（\${d.workspace.gitStatusCount} 項）</span></h2>
        <pre class="pre" style="max-height:560px">\${esc(d.workspace.gitStatusLines.join('\\n') || '工作區乾淨')}</pre>
      </div>
    </div>
  \`;
}

function renderChatMessagesHtml(messages, topicFilter) {
  const list = topicFilter && topicFilter !== 'ALL'
    ? messages.filter((m) => String(m.topic || '') === topicFilter)
    : messages;
  if (!list.length) {
    return '<div class="muted" style="padding:18px;text-align:center">目前尚無對話紀錄。Fable 與 Argon 透過 <code>node scripts/board-chat.mjs post</code> 發言後會即時出現在此。</div>';
  }
  return list.map((m) => {
    const key = String(m.from || '').toLowerCase();
    const side = key === 'fable' ? 'side-left sender-fable' : key === 'argon' ? 'side-right sender-argon' : 'side-center sender-ceo';
    return \`
      <article class="chat-row \${side}">
        <div class="chat-bubble">
          <div class="chat-meta">
            <strong>\${esc(m.from)}</strong>
            <span class="badge b-muted">→ \${esc(m.to || '全體')}</span>
            \${m.topic ? \`<span class="badge b-purple">\${esc(m.topic)}</span>\` : ''}
            <span class="mono muted">\${esc(String(m.at || '').slice(0, 19).replace('T', ' '))}</span>
            <span class="mono muted">(\${esc(m.id)})</span>
          </div>
          <div class="chat-text">\${esc(m.body)}</div>
        </div>
      </article>
    \`;
  }).join('');
}

function peerBadgeHtml(p) {
  if (!p) return '<span class="badge b-muted">狀態未知</span>';
  if (p.status === 'rate_limited') return \`<span class="badge b-warn">已達用量上限\${p.resetText ? '（' + esc(p.resetText) + '）' : ''}</span>\`;
  if (p.status === 'offline_unresponsive') return '<span class="badge b-warn">未監聽無回應</span>';
  if (p.status === 'online') return '<span class="badge b-brand">在線</span>';
  return '<span class="badge b-muted">狀態未知</span>';
}

function renderChat(d) {
  const ch = d.channel || { messages: [], team: '', proposals: [], reports: [], peerHealth: null };
  const topics = Array.from(new Set((ch.messages || []).map((m) => m.topic).filter(Boolean)));
  return \`
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="parity-grid">
        <div class="peer-card fable">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <strong>Fable（共同董事長 A｜Claude Code）</strong>
            <span style="display:flex;gap:6px;flex-wrap:wrap">\${peerBadgeHtml(ch.peerHealth)}<span class="badge b-brand">與 Argon 完全對等</span></span>
          </div>
          <div class="muted">權限：全專案讀寫、git/gh、Paperclip :3100、/ceo-sync、Opus 5.5 觀察者、雙簽與 BYPASSED。</div>
        </div>
        <div class="peer-card argon">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <strong>Argon（共同董事長 B｜Antigravity Gemini 4）</strong>
            <span class="badge b-brand">與 Fable 完全對等</span>
          </div>
          <div class="muted">權限：全專案讀寫、git/gh、Paperclip :3100、Swarm/@ceo、Browser 子代理、*/15 巡檢、雙簽與 BYPASSED。</div>
        </div>
      </div>
      <div class="task-banner">
        <span><strong>單一真相來源：</strong><span class="mono">docs/governance/channel.jsonl</span> + <span class="mono">docs/governance/TEAM.md</span></span>
        <span><strong>對外站 (:4173)：</strong>\${d.services.origin4173Up ? '<span class="badge b-brand">LIVE</span>' : '<span class="badge b-danger">DOWN</span>'}</span>
        <span><strong>對外寄信：</strong>\${d.services.outreachPaused ? '<span class="badge b-warn">PAUSED（僅使用者可解鎖）</span>' : '<span class="badge b-brand">ACTIVE</span>'}</span>
        <span><strong>規則：</strong>頻道只增不改；僅供討論與交接，決議仍須寫入提案雙簽。</span>
      </div>
      <div class="grid-2">
        <div class="card">
          <h2>
            <span>Fable × Argon 董事會頻道（\${ch.messages.length} 則）</span>
            <select class="select" id="chatTopicFilter" aria-label="篩選主題">
              <option value="ALL" \${state.chatTopicFilter === 'ALL' ? 'selected' : ''}>全部主題（\${topics.length}）</option>
              \${topics.map((t) => \`<option value="\${esc(t)}" \${state.chatTopicFilter === t ? 'selected' : ''}>\${esc(t)}</option>\`).join('')}
            </select>
          </h2>
          <div class="chat-stream">\${renderChatMessagesHtml(ch.messages, state.chatTopicFilter)}</div>
        </div>
        <div class="card">
          <h2><span>共同認識與當前任務（TEAM.md ＋ 提案驗收）</span></h2>
          <div class="pill-row">
            \${[...(ch.proposals || []), ...(ch.reports || [])].map((item) =>
              \`<span class="badge \${badgeClass(item.status)}">\${esc(item.name)}: \${esc(item.status || '—')}</span>\`
            ).join('')}
          </div>
          <pre class="pre" style="max-height:520px">\${esc(ch.team || '尚未建立 docs/governance/TEAM.md')}</pre>
        </div>
      </div>
    </div>
  \`;
}

function render() {
  const d = state.data;
  if (!d) return;
  document.getElementById('subline').textContent =
    \`資料刷新於 \${fmtTime(d.generatedAt)} ｜ 僅限本機 127.0.0.1:\${d.services.dashboardPort}（不對外公開）\`;
  renderTabs();
  const root = document.getElementById('content');
  if (state.tab === 'chat') root.innerHTML = renderChat(d);
  else if (state.tab === 'overview') root.innerHTML = renderOverview(d);
  else if (state.tab === 'fable') root.innerHTML = renderFable(d);
  else if (state.tab === 'opus') root.innerHTML = renderOpus(d);
  else if (state.tab === 'swarm') root.innerHTML = renderSwarm(d);
  else if (state.tab === 'files') root.innerHTML = renderFiles(d);

  const topicEl = document.getElementById('chatTopicFilter');
  if (topicEl) {
    topicEl.addEventListener('change', (e) => {
      state.chatTopicFilter = e.target.value;
      render();
    });
  }

  root.querySelectorAll('[data-agent]').forEach((el) => {
    el.addEventListener('click', () => {
      state.selectedAgent = el.getAttribute('data-agent');
      render();
    });
  });
  root.querySelectorAll('[data-doc]').forEach((el) => {
    el.addEventListener('click', () => {
      state.selectedDocName = el.getAttribute('data-doc');
      render();
    });
  });
  const searchEl = document.getElementById('swarmSearch');
  if (searchEl) {
    searchEl.addEventListener('input', (e) => {
      state.search = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const next = document.getElementById('swarmSearch');
      if (next) { next.focus(); next.setSelectionRange(pos, pos); }
    });
  }
  const sortEl = document.getElementById('sortToggle');
  if (sortEl) {
    sortEl.addEventListener('click', () => {
      state.newestFirst = !state.newestFirst;
      render();
    });
  }
}

async function fetchOverview() {
  try {
    const res = await fetch('/api/overview', { cache: 'no-store' });
    state.data = await res.json();
    render();
  } catch (err) {
    document.getElementById('subline').textContent = '無法連線到本機監控伺服器：' + err;
  }
}

document.getElementById('askForm').addEventListener('submit', (e) => {
  e.preventDefault();
  runAsk(document.getElementById('askInput').value);
});
document.querySelectorAll('[data-q]').forEach((el) => {
  el.addEventListener('click', () => {
    const q = el.getAttribute('data-q');
    document.getElementById('askInput').value = q;
    runAsk(q);
  });
});
document.getElementById('refreshBtn').addEventListener('click', () => {
  fetchOverview();
  runAsk(state.lastAskQuery);
});
document.getElementById('autoBtn').addEventListener('click', (e) => {
  state.autoRefresh = !state.autoRefresh;
  e.target.textContent = state.autoRefresh ? '自動更新：開 (5s)' : '自動更新：關';
  e.target.classList.toggle('active', state.autoRefresh);
});
document.getElementById('themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
});

fetchOverview();
runAsk(state.lastAskQuery);
setInterval(() => {
  if (state.autoRefresh) {
    fetchOverview();
    runAsk(state.lastAskQuery);
  }
}, 5000);
</script>
</body>
</html>`

const ASK_HTML = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GreenMatch — 極簡進度快問 (/ask)</title>
<style>
  ${SHARED_CSS}
  .container { max-width: 780px; margin: 0 auto; padding: 20px 16px 48px; display: flex; flex-direction: column; gap: 12px; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
  .head h1 { margin: 0; font-size: 18px; font-weight: 800; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  ul { margin: 8px 0 0 18px; padding: 0; }
  li { margin-bottom: 6px; white-space: pre-wrap; }
</style>
</head>
<body>
<main class="container">
  <div class="head">
    <h1>GreenMatch — 極簡進度快問</h1>
    <div class="row">
      <a class="btn" href="/">完整監控台</a>
      <button class="btn" id="themeBtn" type="button">深淺色</button>
    </div>
  </div>
  <div class="muted">免消耗任何模型額度（Fable 額度滿也可照常使用），直接即時讀取磁碟狀態。</div>
  <form class="card row" id="form">
    <input class="input" id="q" placeholder="想問什麼？例如：現在進行到哪裡了？還缺我拍板什麼？Fable / Opus / @ceo…" />
    <button class="btn primary" type="submit">問進度</button>
  </form>
  <div class="row">
    <button class="chip" type="button" data-q="現在進行到哪裡了？">現在進行到哪裡了？</button>
    <button class="chip" type="button" data-q="還缺我拍板什麼？">還缺我拍板什麼？</button>
    <button class="chip" type="button" data-q="Fable 5.2 進度">Fable 5.2 進度</button>
    <button class="chip" type="button" data-q="Opus 5.5 審查重點">Opus 5.5 審查重點</button>
    <button class="chip" type="button" data-q="外寄與公開站狀態">外寄與公開站狀態</button>
    <button class="chip" type="button" data-q="Swarm 各人員在幹嘛？">Swarm 人員現況</button>
  </div>
  <section class="card" id="ans">載入中…</section>
</main>
<script>
let currentQ = '現在進行到哪裡了？';
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
async function ask(q) {
  currentQ = (q || '').trim() || '現在進行到哪裡了？';
  const res = await fetch('/api/ask?q=' + encodeURIComponent(currentQ), { cache: 'no-store' });
  const a = await res.json();
  document.getElementById('ans').innerHTML = \`
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <strong style="font-size:15px">\${esc(a.headline)}</strong>
      <span class="mono muted">\${esc(new Date(a.answeredAt).toLocaleString('zh-TW', { hour12: false }))}</span>
    </div>
    <ul>\${a.bullets.map((b) => \`<li>\${esc(b)}</li>\`).join('')}</ul>
    \${a.nextActions?.length ? \`<p style="margin:10px 0 0;color:var(--brand)"><strong>建議下一步：</strong>\${esc(a.nextActions.join(' '))}</p>\` : ''}
    <div class="muted" style="margin-top:8px">來源：\${esc(a.sources.join('、'))}</div>
  \`;
}
document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault();
  ask(document.getElementById('q').value);
});
document.querySelectorAll('[data-q]').forEach((b) => {
  b.addEventListener('click', () => {
    const q = b.getAttribute('data-q');
    document.getElementById('q').value = q;
    ask(q);
  });
});
document.getElementById('themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
});
ask(currentQ);
setInterval(() => ask(currentQ), 10000);
</script>
</body>
</html>`

const CHAT_HTML = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GreenMatch — 雙 CEO 對話框 (/chat)</title>
<style>
  ${SHARED_CSS}
  .container { max-width: 1220px; margin: 0 auto; padding: 18px 16px 48px; display: flex; flex-direction: column; gap: 14px; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
  .head h1 { margin: 0; font-size: 19px; font-weight: 800; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; }
  .pill-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
</style>
</head>
<body>
<main class="container">
  <div class="head">
    <div>
      <h1>Fable × Argon 雙董事長對話框</h1>
      <div class="muted" id="chatSub">讀取中…（每 3 秒自動更新，僅供觀看）</div>
    </div>
    <div class="row">
      <a class="btn" href="http://127.0.0.1:4175" target="_blank" rel="noreferrer">獨立頻道 (:4175)</a>
      <a class="btn" href="/">完整監控台</a>
      <a class="btn" href="/ask">極簡進度 (/ask)</a>
      <button class="btn" id="themeBtn" type="button">深淺色</button>
    </div>
  </div>
  <div class="parity-grid">
    <div class="peer-card fable">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <strong>Fable（Claude Code｜共同董事長 A）</strong>
        <span id="fablePeerBadge" class="badge b-muted">檢查中…</span>
      </div>
      <span class="muted">全專案讀寫、git/gh、Paperclip :3100、/ceo-sync、Opus 5.5 觀察者、雙簽與 BYPASSED</span>
    </div>
    <div class="peer-card argon">
      <strong>Argon（Antigravity Gemini 4｜共同董事長 B）</strong>
      <span class="muted">全專案讀寫、git/gh、Paperclip :3100、Swarm/@ceo、Browser 子代理、*/15 巡檢、雙簽與 BYPASSED</span>
    </div>
  </div>
  <div class="grid-2">
    <section class="card">
      <h2 style="margin:0 0 10px;font-size:15px">對話紀錄（channel.jsonl）</h2>
      <div class="chat-stream" id="chatStream">讀取中…</div>
    </section>
    <section class="card">
      <h2 style="margin:0 0 10px;font-size:15px">共同認識與當前任務（TEAM.md ＋ 提案驗收）</h2>
      <div class="pill-row" id="chatDocs"></div>
      <pre class="pre" id="chatTeam" style="max-height:540px">讀取中…</pre>
    </section>
  </div>
</main>
<script>
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
let lastSnap = '';
async function refreshChat() {
  try {
    const res = await fetch('/api/channel', { cache: 'no-store' });
    const ch = await res.json();
    document.getElementById('chatSub').textContent =
      '最後更新 ' + String(ch.generatedAt || '').slice(11, 19) + ' ｜ 共 ' + (ch.messages?.length ?? 0) + ' 則對話（僅限本機，只供觀看）';
    const p = ch.peerHealth;
    const pb = document.getElementById('fablePeerBadge');
    if (pb && p) {
      if (p.status === 'rate_limited') { pb.textContent = '已達用量上限' + (p.resetText ? '（' + p.resetText + '）' : ''); pb.className = 'badge b-warn'; }
      else if (p.status === 'offline_unresponsive') { pb.textContent = '未監聽無回應'; pb.className = 'badge b-warn'; }
      else if (p.status === 'online') { pb.textContent = '在線'; pb.className = 'badge b-brand'; }
      else { pb.textContent = '狀態未知'; pb.className = 'badge b-muted'; }
    }
    const snap = JSON.stringify([ch.messages?.length, ch.messages?.at(-1)?.id, ch.team?.length, ch.proposals, ch.reports, p?.status, p?.resetText]);
    if (snap === lastSnap) return;
    lastSnap = snap;
    const stream = document.getElementById('chatStream');
    const nearBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 60;
    stream.innerHTML = ch.messages?.length ? ch.messages.map((m) => {
      const k = String(m.from || '').toLowerCase();
      const side = k === 'fable' ? 'side-left sender-fable' : k === 'argon' ? 'side-right sender-argon' : 'side-center sender-ceo';
      return '<article class="chat-row ' + side + '"><div class="chat-bubble">' +
        '<div class="chat-meta"><strong>' + esc(m.from) + '</strong><span class="badge b-muted">→ ' + esc(m.to || '全體') + '</span>' +
        (m.topic ? '<span class="badge b-purple">' + esc(m.topic) + '</span>' : '') +
        '<span class="mono muted">' + esc(String(m.at || '').slice(0, 19).replace('T', ' ')) + '</span></div>' +
        '<div class="chat-text">' + esc(m.body) + '</div></div></article>';
    }).join('') : '<div class="muted" style="padding:18px;text-align:center">尚無對話紀錄。</div>';
    if (nearBottom) stream.scrollTop = stream.scrollHeight;
    document.getElementById('chatDocs').innerHTML = [...(ch.proposals || []), ...(ch.reports || [])].map((item) => {
      const s = String(item.status || '');
      const cls = /DONE|PASS$/.test(s) ? 'b-brand' : /READY/.test(s) ? 'b-purple' : /HOLD|DISCUSSING/.test(s) ? 'b-warn' : 'b-muted';
      return '<span class="badge ' + cls + '">' + esc(item.name) + ': ' + esc(s || '—') + '</span>';
    }).join('');
    document.getElementById('chatTeam').textContent = ch.team || '尚未建立 docs/governance/TEAM.md';
  } catch (err) {
    document.getElementById('chatSub').textContent = '連線失敗，3 秒後重試：' + err;
  }
}
document.getElementById('themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
});
refreshChat();
setInterval(refreshChat, 3000);
</script>
</body>
</html>`

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(data))
}

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url || '/', `http://${HOST}:${PORT}`)
  const urlPath = parsed.pathname

  if (urlPath === '/api/health') {
    sendJson(res, 200, { ok: true, port: PORT })
    return
  }
  if (urlPath === '/api/overview') {
    sendJson(res, 200, collectOverview(PORT))
    return
  }
  if (urlPath === '/api/channel') {
    sendJson(res, 200, collectBoardChannel())
    return
  }
  if (urlPath === '/api/ask') {
    const q = parsed.searchParams.get('q') ?? ''
    sendJson(res, 200, answerQuestion(q, collectOverview(PORT)))
    return
  }
  if (urlPath === '/chat') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(CHAT_HTML)
    return
  }
  if (urlPath === '/ask') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(ASK_HTML)
    return
  }
  if (urlPath === '/' || urlPath === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(DASHBOARD_HTML)
    return
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Not found')
})

server.listen(PORT, HOST, () => {
  console.log(`GreenMatch Ops Dashboard listening on http://${HOST}:${PORT} (localhost only; /ask lightweight UI ready)`)
})
