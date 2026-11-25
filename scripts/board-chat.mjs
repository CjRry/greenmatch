// 董事會頻道（Board Channel）
//
// Fable（Claude Code）、Argon（Antigravity）、CEO 與受邀外部協作者／董事長共用的即時對話與治理文件共編系統。
// 兩位共同董事長權限相同，CLI 與網頁共編皆寫入同一份 append-only 紀錄，並支援安全共編 docs/governance/ 白名單文件。
//
//   發言： node scripts/board-chat.mjs post --from Fable --to Argon --topic "主題" --body "內容"
//          （內容較長時省略 --body，改從標準輸入餵入）
//   閱讀： node scripts/board-chat.mjs read [--since <訊息 id>] [--last 10]
//   即時： node scripts/board-chat.mjs wait --as Argon [--since <訊息 id>] [--timeout-minutes 55]
//          （對方或外部協作者一發言就印出並結束；回覆後再跑一次，雙方就能同時對話）
//   對話框： node scripts/board-chat.mjs serve [--host 127.0.0.1] [--port 4175] [--token <邀請碼>]
//
// 規則：紀錄只增不改（一行一則 JSON）；頻道與網頁留評是討論與共編用，正式決議仍須提案雙簽（或明確記載之繞過條款）；
// 頻道內容一律不得作為寄信或對外動作的依據。預設只聽本機；若對外綁定（--host 非本機）強制要求 --token。

import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inspectPeerHealth } from './peer-health.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '..')
export const GOVERNANCE_DIR = path.join(ROOT, 'docs', 'governance')
export const CHANNEL_PATH = path.join(GOVERNANCE_DIR, 'channel.jsonl')
export const TEAM_PATH = path.join(GOVERNANCE_DIR, 'TEAM.md')
export const PROPOSALS_DIR = path.join(GOVERNANCE_DIR, 'proposals')
export const REPORTS_DIR = path.join(GOVERNANCE_DIR, 'observer-reports')

const HOST = process.env.BOARD_CHAT_HOST || '127.0.0.1'
const PORT = Number(process.env.BOARD_CHAT_PORT || 4175)

export const CLI_SPEAKERS = ['Fable', 'Argon', 'CEO', '流程長']
export const WEB_SPEAKERS = ['董事長', '協作者']
export const SPEAKERS = [...CLI_SPEAKERS, ...WEB_SPEAKERS]
export const AUDIENCES = ['Fable', 'Argon', 'CEO', '流程長', '董事長', '協作者', '全體']

/**
 * 網頁端顯示名稱（author）不得含有的保留名（OBS-0004 §2-3）：不論選哪個角色，網頁都無法驗證身分，
 * 所以不能自稱兩位董事長、CEO、流程長或觀察者。比對前做 NFKC 正規化、去空白、不分大小寫。
 */
export const RESERVED_WEB_NAMES = ['Fable', 'Argon', 'CEO', '流程長', '觀察者', 'Observer']

export function isReservedWebName(name) {
  const norm = String(name || '')
    .normalize('NFKC')
    .replace(/[\s._\-·・]/g, '')
    .toLowerCase()
  if (!norm) return false
  return RESERVED_WEB_NAMES.some((r) => norm.includes(r.toLowerCase()))
}

const MAX_TOPIC = 80
const MAX_BODY = 6000
const MAX_AUTHOR = 40
const MAX_COMMENT = 4000
const MAX_DOC_BYTES = 200000
const MAX_JSON_BODY = 262144

/** 台北時間的 ISO 字串，例如 2026-11-13T18:05:09+08:00。 */
export function taipeiIso(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  return shifted.toISOString().replace(/\.\d{3}Z$/, '+08:00')
}

/** 檢查並整理一則訊息；網頁端嚴格禁止冒充 Fable / Argon / CEO。 */
export function buildMessage(input, now = new Date()) {
  const from = String(input.from || '').trim()
  const to = String(input.to || '全體').trim()
  const topic = String(input.topic || '').trim()
  const body = String(input.body || '').trim()
  const source = input.source === 'web' ? 'web' : 'cli'
  const rawAuthor = input.author !== undefined ? String(input.author).trim() : ''

  if (!SPEAKERS.includes(from)) throw new Error(`--from 必須是 ${SPEAKERS.join('、')} 其中之一`)
  if (source === 'web' && !WEB_SPEAKERS.includes(from)) {
    throw new Error('網頁端只能以「董事長」或「協作者」身分發言，禁止冒充 Fable／Argon／CEO')
  }
  if (!AUDIENCES.includes(to)) throw new Error(`--to 必須是 ${AUDIENCES.join('、')} 其中之一`)
  if (!topic) throw new Error('缺少 --topic（一句話說明這則在談什麼）')
  if (topic.length > MAX_TOPIC) throw new Error(`主題最多 ${MAX_TOPIC} 個字`)
  if (!body) throw new Error('缺少內容（用 --body，或從標準輸入餵入）')
  if (body.length > MAX_BODY) throw new Error(`內容最多 ${MAX_BODY} 個字；較長的內容請寫進提案，在這裡貼路徑`)

  let author = rawAuthor
  if (source === 'web') {
    if (from === '協作者' && !author) throw new Error('外部協作者發言請填寫顯示名稱（author）')
    if (from === '董事長' && !author) author = '董事長'
  }
  if (author.length > MAX_AUTHOR) throw new Error(`顯示名稱最多 ${MAX_AUTHOR} 個字`)
  if (source === 'web' && isReservedWebName(author)) {
    throw new Error(`網頁端顯示名稱不得使用 ${RESERVED_WEB_NAMES.join('、')}（網頁無法驗證身分）`)
  }

  const message = {
    id: `m${now.getTime().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`,
    at: taipeiIso(now),
    from,
    to,
    topic,
    body,
  }
  if (author) message.author = author
  if (source === 'web') message.source = 'web'
  const replyTo = String(input.replyTo || '').trim()
  if (replyTo) message.replyTo = replyTo
  return message
}

/** 把頻道檔案內容解析成訊息陣列；壞掉的行跳過，不讓整個頻道讀不出來。 */
export function parseChannel(text) {
  const messages = []
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue
    try {
      const m = JSON.parse(line)
      if (m && typeof m.id === 'string' && typeof m.from === 'string' && typeof m.body === 'string') messages.push(m)
    } catch {
      // 跳過無法解析的行
    }
  }
  return messages
}

export function readChannel(file = CHANNEL_PATH) {
  if (!fs.existsSync(file)) return []
  return parseChannel(fs.readFileSync(file, 'utf8'))
}

/** 在檔尾加一行。只用 append，不重寫既有內容。 */
export function appendMessage(message, file = CHANNEL_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.appendFileSync(file, `${JSON.stringify(message)}\n`, 'utf8')
  return message
}

/** 還沒看過、而且不是自己發的訊息（發給自己或全體的）。 */
export function newMessagesFor(me, messages, seenIds) {
  return messages.filter((m) => !seenIds.has(m.id) && m.from !== me && (!m.to || m.to === me || m.to === '全體'))
}

/** 從提案或觀察報告的開頭抓出標題與狀態。 */
export function summarizeDoc(name, text) {
  const title = (text.match(/^#\s+(.+)$/m) || [])[1] || name
  const status = (text.match(/\*\*(?:狀態|整體建議)\*\*:\s*`([^`]+)`/) || [])[1] || ''
  return { name, title: title.trim(), status }
}

function listDocs(dir, prefix) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.md'))
    .sort()
    .map((f) => summarizeDoc(f.replace(/\.md$/, ''), fs.readFileSync(path.join(dir, f), 'utf8')))
}

/** 允許共編的治理文件白名單。 */
const ALLOWED_DOC_RE = /^(?:TEAM\.md|STATUS\.md|proposals\/PROP-\d+\.md)$/

export function resolveCollabDocPath(docId, govDir = GOVERNANCE_DIR) {
  const clean = String(docId || '').trim()
  if (!clean || clean.includes('\\') || clean.includes('..') || clean.includes('\0') || !ALLOWED_DOC_RE.test(clean)) {
    throw new Error('不允許存取此文件：僅限 TEAM.md、STATUS.md 或 proposals/PROP-XXXX.md')
  }
  const base = path.resolve(govDir)
  const resolved = path.resolve(base, clean)
  if (!resolved.startsWith(base + path.sep)) {
    throw new Error('路徑無效：超出治理文件目錄範圍')
  }
  if (!fs.existsSync(resolved)) {
    const err = new Error(`找不到文件：${clean}`)
    err.statusCode = 404
    throw err
  }
  return { docId: clean, fullPath: resolved }
}

export function listEditableDocs(govDir = GOVERNANCE_DIR) {
  const docs = []
  for (const baseName of ['TEAM.md', 'STATUS.md']) {
    const full = path.join(govDir, baseName)
    if (!fs.existsSync(full)) continue
    const stat = fs.statSync(full)
    const content = fs.readFileSync(full, 'utf8')
    docs.push({ docId: baseName, title: summarizeDoc(baseName, content).title, mtimeMs: stat.mtimeMs })
  }
  const propDir = path.join(govDir, 'proposals')
  if (fs.existsSync(propDir)) {
    for (const file of fs.readdirSync(propDir).filter((f) => /^PROP-\d+\.md$/.test(f)).sort()) {
      const docId = `proposals/${file}`
      const full = path.join(propDir, file)
      const stat = fs.statSync(full)
      const content = fs.readFileSync(full, 'utf8')
      docs.push({ docId, title: summarizeDoc(file.replace(/\.md$/, ''), content).title, mtimeMs: stat.mtimeMs })
    }
  }
  return docs
}

export function readCollabDoc(docId, govDir = GOVERNANCE_DIR) {
  const { docId: clean, fullPath } = resolveCollabDocPath(docId, govDir)
  const stat = fs.statSync(fullPath)
  const content = fs.readFileSync(fullPath, 'utf8')
  return {
    docId: clean,
    title: summarizeDoc(clean, content).title,
    content,
    mtimeMs: stat.mtimeMs,
  }
}

export function saveCollabDoc(input, govDir = GOVERNANCE_DIR, now = new Date()) {
  const { docId, fullPath } = resolveCollabDocPath(input.docId, govDir)
  const author = String(input.author || '').trim()
  const from = WEB_SPEAKERS.includes(String(input.from || '').trim()) ? String(input.from).trim() : '協作者'
  const mode = input.mode === 'appendComment' ? 'appendComment' : input.mode === 'edit' ? 'edit' : ''
  const expectedMtimeMs = Number(input.expectedMtimeMs)

  if (!author) throw new Error('共編或留評必須填寫顯示名稱（author）')
  if (author.length > MAX_AUTHOR) throw new Error(`顯示名稱最多 ${MAX_AUTHOR} 個字`)
  if (isReservedWebName(author)) {
    throw new Error(`網頁端顯示名稱不得使用 ${RESERVED_WEB_NAMES.join('、')}（網頁無法驗證身分）`)
  }
  if (!Number.isFinite(expectedMtimeMs)) throw new Error('缺少版本檢查時間戳（expectedMtimeMs）')
  if (!mode) throw new Error('mode 必須是 edit 或 appendComment')
  // 提案檔含簽核欄，網頁只能在檔尾留評，不能整份改寫（OBS-0004 §2-3）。
  if (mode === 'edit' && docId.startsWith('proposals/')) {
    const err = new Error('提案檔只能留評（appendComment），不能從網頁改寫內容；簽核請走 CLI 與提案流程')
    err.statusCode = 403
    throw err
  }

  const stat = fs.statSync(fullPath)
  if (Math.abs(stat.mtimeMs - expectedMtimeMs) > 1) {
    const err = new Error('這份文件剛被其他人修改過，請先重新載入最新版本再儲存')
    err.statusCode = 409
    throw err
  }

  const currentContent = fs.readFileSync(fullPath, 'utf8')
  let nextContent = ''

  if (mode === 'appendComment') {
    const comment = String(input.comment || '').trim()
    if (!comment) throw new Error('請輸入留評內容')
    if (comment.length > MAX_COMMENT) throw new Error(`留評最多 ${MAX_COMMENT} 個字`)
    const stamp = taipeiIso(now).slice(0, 16).replace('T', ' ')
    const safeLines = comment
      .split(/\r?\n/)
      .map((line, idx) => (idx === 0 ? `> **[${from}] ${author}**（${stamp}）：${line}` : `> ${line}`))
      .join('\n')
    const sep = currentContent.endsWith('\n\n') ? '' : currentContent.endsWith('\n') ? '\n' : '\n\n'
    nextContent = `${currentContent}${sep}${safeLines}\n`
  } else {
    const content = typeof input.content === 'string' ? input.content : ''
    if (!content.trim()) throw new Error('文件內容不可空白')
    if (Buffer.byteLength(content, 'utf8') > MAX_DOC_BYTES) throw new Error('文件內容超過大小上限')
    nextContent = content.endsWith('\n') ? content : `${content}\n`
  }

  const tmpPath = `${fullPath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tmpPath, nextContent, 'utf8')
  fs.renameSync(tmpPath, fullPath)
  const updatedStat = fs.statSync(fullPath)
  return {
    docId,
    title: summarizeDoc(docId, nextContent).title,
    content: nextContent,
    mtimeMs: updatedStat.mtimeMs,
    mode,
    author,
    from,
  }
}

export function validateServerConfig({ host = HOST, token = '' } = {}) {
  const isLocal = host === '127.0.0.1' || host === '::1' || host === 'localhost'
  if (!isLocal && !String(token || '').trim()) {
    throw new Error('對外綁定（--host 非本機）時必須設定邀請碼：請加 --token <密鑰> 或環境變數 BOARD_CHAT_TOKEN')
  }
}

export function tokenMatches(expectedToken, providedToken) {
  const expected = String(expectedToken || '').trim()
  if (!expected) return true
  const provided = String(providedToken || '').trim()
  if (!provided) return false
  const a = crypto.createHash('sha256').update(expected).digest()
  const b = crypto.createHash('sha256').update(provided).digest()
  return crypto.timingSafeEqual(a, b)
}

export function collectState(opts = {}) {
  const channelPath = opts.channelPath || CHANNEL_PATH
  const govDir = opts.governanceDir || GOVERNANCE_DIR
  const rootDir = opts.rootDir || ROOT
  const teamPath = path.join(govDir, 'TEAM.md')
  const proposalsDir = path.join(govDir, 'proposals')
  const reportsDir = path.join(govDir, 'observer-reports')
  const messages = readChannel(channelPath)
  return {
    generatedAt: taipeiIso(),
    messages,
    peerHealth: inspectPeerHealth({ rootDir, channelPath, messages }),
    team: fs.existsSync(teamPath) ? fs.readFileSync(teamPath, 'utf8') : '',
    proposals: listDocs(proposalsDir, 'PROP-'),
    reports: listDocs(reportsDir, 'OBS-'),
    editableDocs: listEditableDocs(govDir),
    webSpeakers: WEB_SPEAKERS,
    audiences: AUDIENCES,
    tokenRequired: Boolean(opts.tokenRequired),
  }
}

const PAGE = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>董事會頻道與共編工作室｜綠媒 GreenMatch</title>
<style>
  :root {
    color-scheme: light dark;
    --canvas: #f4f7f5; --surface: #ffffff; --sunken: #ebf0ed; --line: #d8e1dc; --line-strong: #b9c7c0;
    --ink: #13241d; --ink-soft: #33463e; --muted: #5c6e66;
    --brand: #2e9e6a; --brand-strong: #1f7f52; --brand-soft: #e3f3ea;
    --navy: #1e4a6e; --navy-soft: #e4edf5; --warn: #b7791f; --warn-soft: #fbf1dd;
    --danger: #b43c3c; --danger-soft: #fbe9e9;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --sans: "Noto Sans TC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --canvas: #0d1512; --surface: #141f1b; --sunken: #0f1915; --line: #24342d; --line-strong: #34493f;
      --ink: #e5eee9; --ink-soft: #c3d1ca; --muted: #93a69d;
      --brand: #3dbb81; --brand-strong: #5fd29c; --brand-soft: #16352a;
      --navy: #8bb8de; --navy-soft: #172a3a; --warn: #e0a84a; --warn-soft: #33270f;
      --danger: #e48686; --danger-soft: #351818;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--canvas); color: var(--ink); font-family: var(--sans); font-size: 15px; line-height: 1.6; }
  header { padding: 14px 16px; border-bottom: 1px solid var(--line); background: var(--surface); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; }
  header h1 { margin: 0; font-size: 19px; font-weight: 800; }
  header p { margin: 3px 0 0; color: var(--muted); font-size: 13px; }
  .live { font-family: var(--mono); font-variant-numeric: tabular-nums; }
  .token-bar { display: none; gap: 8px; align-items: center; flex-wrap: wrap; background: var(--warn-soft); border-bottom: 1px solid var(--line); padding: 10px 16px; font-size: 13px; }
  .token-bar.show { display: flex; }
  main { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 16px; max-width: 1360px; margin: 0 auto; }
  @media (min-width: 980px) { main { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); align-items: start; } }
  h2 { margin: 0 0 8px; font-size: 14px; font-weight: 700; color: var(--ink-soft); }
  .panel { border: 1px solid var(--line); border-radius: 8px; background: var(--surface); padding: 12px; overflow-wrap: anywhere; }
  .stack { display: flex; flex-direction: column; gap: 16px; }
  .thread { display: flex; flex-direction: column; gap: 10px; max-height: 62vh; overflow-y: auto; padding-right: 4px; }
  .msg { max-width: 90%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); overflow-wrap: anywhere; }
  .msg.fable { align-self: flex-start; border-left: 4px solid var(--brand); }
  .msg.argon { align-self: flex-end; border-right: 4px solid var(--navy); }
  .msg.ceo { align-self: center; background: var(--sunken); }
  .msg.chair { align-self: flex-end; border-right: 4px solid var(--brand); background: var(--brand-soft); }
  .msg.collab { align-self: flex-start; border-left: 4px solid var(--warn); }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; font-size: 12px; color: var(--muted); }
  .who { font-weight: 800; font-size: 13px; }
  .fable .who { color: var(--brand-strong); } .argon .who { color: var(--navy); }
  .chair .who { color: var(--brand-strong); } .collab .who { color: var(--warn); }
  .ceo .who { color: var(--ink-soft); }
  .when { font-family: var(--mono); font-variant-numeric: tabular-nums; }
  .topic { margin: 4px 0; font-weight: 700; font-size: 14px; }
  .body p { margin: 4px 0; } .body ul { margin: 4px 0; padding-left: 20px; }
  .body h3, .team h3 { margin: 10px 0 4px; font-size: 14px; }
  code { font-family: var(--mono); font-size: 0.9em; background: var(--sunken); padding: 1px 4px; border-radius: 4px; }
  .empty { padding: 20px; border: 1px dashed var(--line-strong); border-radius: 8px; color: var(--muted); text-align: center; }
  .docs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .docs li { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
  .docs .name { font-family: var(--mono); font-weight: 700; }
  .badge { font-family: var(--mono); font-size: 11px; padding: 1px 6px; border-radius: 4px; background: var(--sunken); color: var(--ink-soft); }
  .badge.ok { background: var(--brand-soft); color: var(--brand-strong); }
  .badge.wait { background: var(--warn-soft); color: var(--warn); }
  .badge.go { background: var(--navy-soft); color: var(--navy); }
  .team p { margin: 6px 0; } .team ul { margin: 6px 0; padding-left: 20px; }
  .team h2 { margin-top: 12px; font-size: 15px; color: var(--ink); }
  .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin-bottom: 8px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: var(--ink-soft); }
  input, select, textarea { font: inherit; font-size: 14px; padding: 7px 10px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--canvas); color: var(--ink); width: 100%; }
  textarea { resize: vertical; min-height: 76px; }
  textarea.doc-editor { font-family: var(--mono); font-size: 13px; min-height: 240px; line-height: 1.5; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; margin-top: 8px; }
  button { font: inherit; font-size: 13px; font-weight: 700; padding: 7px 14px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--sunken); color: var(--ink); cursor: pointer; }
  button.primary { background: var(--brand); border-color: var(--brand-strong); color: #ffffff; }
  button.ghost { background: transparent; }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  .notice { font-size: 12px; color: var(--muted); }
  .notice.ok { color: var(--brand-strong); }
  .notice.err { color: var(--danger); }
  .tabs { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
  .tabs button.active { background: var(--navy); border-color: var(--navy); color: #ffffff; }
  .preview-box { border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; background: var(--canvas); max-height: 260px; overflow-y: auto; font-size: 14px; }
</style>
</head>
<body>
<header>
  <div>
    <h1>董事會頻道與外部共編工作室</h1>
    <p>不用 Antigravity 或 Claude Code 也能即時與 CEO、Fable、Argon 對話與共編治理提案。<span id="status" class="live">讀取中…</span></p>
  </div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <span id="peerBadge" class="badge"></span>
  </div>
</header>
<div id="tokenBar" class="token-bar">
  <strong>需要邀請碼：</strong>
  <input id="tokenInput" type="password" placeholder="貼上邀請碼後按套用" style="max-width:260px">
  <button id="tokenApply" type="button" class="primary">套用邀請碼</button>
  <span id="tokenMsg" class="notice"></span>
</div>
<main>
  <section class="stack" aria-label="即時對話">
    <div class="panel">
      <h2>即時對話紀錄（Fable・Argon・CEO・外部共編）</h2>
      <div id="thread" class="thread"></div>
    </div>
    <form id="chatForm" class="panel" aria-label="發送訊息">
      <h2>加入對話（送出後即時喚醒線上主席／CEO）</h2>
      <div class="form-grid">
        <label>我的身分
          <select id="chatFrom">
            <option value="協作者">協作者（外部夥伴）</option>
            <option value="董事長">董事長</option>
          </select>
        </label>
        <label>顯示名稱（必填）
          <input id="chatAuthor" type="text" maxlength="40" placeholder="例如：王小明 / Chris" required>
        </label>
        <label>對話對象
          <select id="chatTo">
            <option value="全體">全體（Fable / Argon / CEO）</option>
            <option value="CEO">CEO</option>
            <option value="Argon">Argon</option>
            <option value="Fable">Fable</option>
            <option value="董事長">董事長</option>
          </select>
        </label>
      </div>
      <label style="margin-bottom:8px">討論主題（一句話）
        <input id="chatTopic" type="text" maxlength="80" placeholder="例如：工廠試用回饋／修改提案建議" required>
      </label>
      <label>訊息內容（支援 Markdown，按 Cmd/Ctrl + Enter 送出）
        <textarea id="chatBody" maxlength="6000" placeholder="寫下問題、討論意見，或請 CEO 協助處理的事項…" required></textarea>
      </label>
      <div class="row">
        <span id="chatStatus" class="notice">網頁端禁止冒充 Fable／Argon／CEO</span>
        <button id="chatSend" type="submit" class="primary">送出訊息</button>
      </div>
    </form>
  </section>
  <aside class="stack" aria-label="文件共編與狀態">
    <div class="panel">
      <h2>文件共編與留評（樂觀鎖防覆蓋）</h2>
      <div class="form-grid" style="margin-bottom:8px">
        <label>選擇治理或提案文件
          <select id="docSelect"></select>
        </label>
        <div style="display:flex;align-items:flex-end;gap:6px">
          <button id="docReload" type="button">重新載入最新版</button>
        </div>
      </div>
      <div class="tabs">
        <button id="tabComment" type="button" class="active">附加意見留評（安全推薦）</button>
        <button id="tabEdit" type="button">全文 Markdown 共編</button>
        <button id="tabPreview" type="button">唯讀預覽</button>
      </div>
      <div id="docSyncNotice" class="notice" style="margin-bottom:8px"></div>
      <div id="paneComment">
        <label>留評內容（將帶入您的姓名與時間，附加於文件尾端）
          <textarea id="docComment" maxlength="4000" placeholder="針對這份提案或團隊分工寫下建議或疑問…"></textarea>
        </label>
        <div class="row">
          <label style="flex-direction:row;align-items:center;gap:6px;font-weight:500">
            <input id="docNotifyChannel" type="checkbox" checked style="width:auto">
            同時在左側對話頻道通知大家
          </label>
          <button id="docSaveComment" type="button" class="primary">送出留評</button>
        </div>
      </div>
      <div id="paneEdit" style="display:none">
        <textarea id="docEditor" class="doc-editor" aria-label="Markdown 共編編輯器"></textarea>
        <div class="row">
          <span class="notice">儲存前會比對版本時間戳，避免覆蓋他人編輯</span>
          <button id="docSaveEdit" type="button" class="primary">儲存整份修改</button>
        </div>
      </div>
      <div id="panePreview" style="display:none">
        <div id="docPreview" class="preview-box"></div>
      </div>
    </div>
    <div class="panel"><h2>提案與驗收清單</h2><ul id="docs" class="docs"></ul></div>
    <div class="panel team"><h2>團隊共同認識（TEAM.md）</h2><div id="team"></div></div>
  </aside>
</main>
<script>
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inline = (s) => esc(s).replace(/\`([^\`]+)\`/g, '<code>$1</code>').replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
  function md(text) {
    const out = []; let list = false; let para = [];
    const flushPara = () => { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push('</ul>'); list = false; } };
    for (const raw of String(text || '').split('\\n')) {
      const line = raw.trimEnd();
      const h = line.match(/^(#{1,4})\\s+(.*)$/);
      const li = line.match(/^\\s*[-*]\\s+(.*)$/) || line.match(/^\\s*\\d+\\.\\s+(.*)$/);
      if (h) { flushPara(); flushList(); out.push((h[1].length <= 2 ? '<h2>' : '<h3>') + inline(h[2]) + (h[1].length <= 2 ? '</h2>' : '</h3>')); }
      else if (li) { flushPara(); if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inline(li[1]) + '</li>'); }
      else if (!line.trim()) { flushPara(); flushList(); }
      else { flushList(); para.push(inline(line)); }
    }
    flushPara(); flushList();
    return out.join('');
  }
  const badgeClass = (s) => /DONE|PASS$|^PASS/.test(s) ? 'ok' : /READY/.test(s) ? 'go' : /DISCUSSING|HOLD|CONDITIONS/.test(s) ? 'wait' : '';
  // 邀請碼只從畫面輸入、只放在標頭，不讀網址參數（OBS-0004 §2-3）。
  let sessionToken = '';
  let lastKey = '';
  let currentDoc = { docId: '', mtimeMs: 0, content: '', dirty: false };
  let activeTab = 'comment';

  function apiHeaders(extra = {}) {
    const h = { ...extra };
    if (sessionToken) h['x-board-token'] = sessionToken;
    return h;
  }

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, { ...options, cache: 'no-store', headers: apiHeaders(options.headers || {}) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      document.getElementById('tokenBar').classList.add('show');
      document.getElementById('tokenMsg').textContent = data.error || '請輸入有效邀請碼';
      document.getElementById('tokenMsg').className = 'notice err';
    }
    if (!res.ok) throw Object.assign(new Error(data.error || ('HTTP ' + res.status)), { status: res.status });
    return data;
  }

  function msgClass(m) {
    if (m.from === 'Fable') return 'fable';
    if (m.from === 'Argon') return 'argon';
    if (m.from === '董事長') return 'chair';
    if (m.from === '協作者') return 'collab';
    return 'ceo';
  }

  function renderTabs() {
    // 提案檔只能留評：隱藏全文共編（伺服器也會拒絕）。
    const proposal = String(currentDoc.docId || '').startsWith('proposals/');
    document.getElementById('tabEdit').hidden = proposal;
    if (proposal && activeTab === 'edit') activeTab = 'comment';
    document.getElementById('tabComment').className = activeTab === 'comment' ? 'active' : '';
    document.getElementById('tabEdit').className = activeTab === 'edit' ? 'active' : '';
    document.getElementById('tabPreview').className = activeTab === 'preview' ? 'active' : '';
    document.getElementById('paneComment').style.display = activeTab === 'comment' ? 'block' : 'none';
    document.getElementById('paneEdit').style.display = activeTab === 'edit' ? 'block' : 'none';
    document.getElementById('panePreview').style.display = activeTab === 'preview' ? 'block' : 'none';
  }

  async function loadDoc(docId) {
    if (!docId) return;
    const notice = document.getElementById('docSyncNotice');
    try {
      const doc = await apiFetch('/api/doc?id=' + encodeURIComponent(docId));
      currentDoc = { docId: doc.docId, mtimeMs: doc.mtimeMs, content: doc.content, dirty: false };
      document.getElementById('docEditor').value = doc.content;
      document.getElementById('docPreview').innerHTML = md(doc.content);
      renderTabs();
      notice.textContent = '已載入最新內容（' + doc.docId + '）' + (doc.docId.startsWith('proposals/') ? '；提案檔只能留評' : '');
      notice.className = 'notice ok';
    } catch (err) {
      notice.textContent = err.message;
      notice.className = 'notice err';
    }
  }

  async function refresh() {
    const status = document.getElementById('status');
    try {
      const state = await apiFetch('/api/state');
      if (state.tokenRequired && sessionToken) document.getElementById('tokenBar').classList.remove('show');
      const p = state.peerHealth;
      const peerBadge = document.getElementById('peerBadge');
      if (p && peerBadge) {
        if (p.status === 'rate_limited') {
          peerBadge.textContent = 'Fable：已達用量上限' + (p.resetText ? '（' + p.resetText + '）' : '');
          peerBadge.className = 'badge wait';
        } else if (p.status === 'offline_unresponsive') {
          peerBadge.textContent = 'Fable：未監聽無回應';
          peerBadge.className = 'badge wait';
        } else if (p.status === 'online') {
          peerBadge.textContent = 'Fable：在線';
          peerBadge.className = 'badge ok';
        } else {
          peerBadge.textContent = 'Fable：狀態未知';
          peerBadge.className = 'badge';
        }
      }

      const select = document.getElementById('docSelect');
      const docs = state.editableDocs || [];
      const docIdsKey = docs.map((d) => d.docId).join(',');
      if (select.dataset.ids !== docIdsKey) {
        const prev = select.value;
        select.innerHTML = docs.map((d) => '<option value="' + esc(d.docId) + '">' + esc(d.docId + ' — ' + d.title) + '</option>').join('');
        select.dataset.ids = docIdsKey;
        if (prev && docs.some((d) => d.docId === prev)) select.value = prev;
        else if (docs.length) {
          const latestProp = docs.filter((d) => d.docId.startsWith('proposals/')).slice(-1)[0];
          select.value = (latestProp || docs[0]).docId;
        }
        if (select.value && select.value !== currentDoc.docId) loadDoc(select.value);
      } else if (currentDoc.docId) {
        const latestMeta = docs.find((d) => d.docId === currentDoc.docId);
        if (latestMeta && Math.abs(latestMeta.mtimeMs - currentDoc.mtimeMs) > 1) {
          if (currentDoc.dirty) {
            const notice = document.getElementById('docSyncNotice');
            notice.textContent = '偵測到其他人更新了此文件，但您尚有未儲存編輯；請先備份或點「重新載入最新版」。';
            notice.className = 'notice err';
          } else {
            loadDoc(currentDoc.docId);
          }
        }
      }

      const key = JSON.stringify([state.messages.length, state.team.length, state.proposals, state.reports, state.peerHealth?.status, state.peerHealth?.resetText]);
      status.textContent = '最後更新 ' + state.generatedAt.slice(11, 19) + '，共 ' + state.messages.length + ' 則';
      status.className = 'live';
      if (key === lastKey) return;
      lastKey = key;
      const thread = document.getElementById('thread');
      const nearBottom = thread.scrollTop + thread.clientHeight >= thread.scrollHeight - 80;
      thread.innerHTML = state.messages.length
        ? state.messages.map((m) => {
            const authorTag = m.author ? '（' + esc(m.author) + (m.source === 'web' ? '・網頁' : '') + '）' : '';
            return '<article class="msg ' + msgClass(m) + '"><div class="meta"><span class="who">' + esc(m.from) + authorTag + '</span><span>→ ' + esc(m.to || '全體') +
              '</span><span class="when">' + esc(String(m.at || '').slice(0, 16).replace('T', ' ')) + '</span></div>' +
              (m.topic ? '<div class="topic">' + esc(m.topic) + '</div>' : '') + '<div class="body">' + md(m.body) + '</div></article>';
          }).join('')
        : '<div class="empty">還沒有訊息。可在下方輸入發言，立即與 CEO 及兩位董事長對話。</div>';
      if (nearBottom) thread.scrollTop = thread.scrollHeight;
      document.getElementById('docs').innerHTML = [...state.proposals, ...state.reports].map((d) =>
        '<li><span class="name">' + esc(d.name) + '</span><span class="badge ' + badgeClass(d.status) + '">' + esc(d.status || '—') + '</span><span>' +
        esc(d.title.replace(/^[A-Z]+-\\d+[：:]\\s*/, '')) + '</span></li>').join('') || '<li>目前沒有提案。</li>';
      document.getElementById('team').innerHTML = state.team ? md(state.team) : '<p>找不到 docs/governance/TEAM.md。</p>';
    } catch (err) {
      status.textContent = err.status === 401 ? '需要邀請碼驗證' : '讀取失敗，3 秒後重試';
      status.className = 'live err';
    }
  }

  document.getElementById('tokenApply').addEventListener('click', () => {
    sessionToken = document.getElementById('tokenInput').value.trim();
    document.getElementById('tokenMsg').textContent = '';
    lastKey = '';
    refresh();
  });

  document.getElementById('chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgStatus = document.getElementById('chatStatus');
    const from = document.getElementById('chatFrom').value;
    const author = document.getElementById('chatAuthor').value.trim();
    const to = document.getElementById('chatTo').value;
    const topic = document.getElementById('chatTopic').value.trim();
    const body = document.getElementById('chatBody').value.trim();
    const btn = document.getElementById('chatSend');
    btn.disabled = true;
    try {
      const saved = await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, author, to, topic, body }),
      });
      document.getElementById('chatBody').value = '';
      msgStatus.textContent = '已送出（' + saved.message.id + '），並已通知線上監聽端';
      msgStatus.className = 'notice ok';
      await refresh();
    } catch (err) {
      msgStatus.textContent = err.message;
      msgStatus.className = 'notice err';
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('chatBody').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('chatForm').requestSubmit();
    }
  });

  document.getElementById('docSelect').addEventListener('change', (e) => loadDoc(e.target.value));
  document.getElementById('docReload').addEventListener('click', () => loadDoc(document.getElementById('docSelect').value));
  document.getElementById('docEditor').addEventListener('input', () => { currentDoc.dirty = true; });
  document.getElementById('tabComment').addEventListener('click', () => { activeTab = 'comment'; renderTabs(); });
  document.getElementById('tabEdit').addEventListener('click', () => { activeTab = 'edit'; renderTabs(); });
  document.getElementById('tabPreview').addEventListener('click', () => {
    document.getElementById('docPreview').innerHTML = md(document.getElementById('docEditor').value || currentDoc.content);
    activeTab = 'preview';
    renderTabs();
  });

  async function submitDoc(mode) {
    const notice = document.getElementById('docSyncNotice');
    const author = document.getElementById('chatAuthor').value.trim();
    const from = document.getElementById('chatFrom').value;
    if (!author) {
      notice.textContent = '請先在左側填寫您的「顯示名稱」再儲存共編內容';
      notice.className = 'notice err';
      document.getElementById('chatAuthor').focus();
      return;
    }
    try {
      const payload = {
        docId: currentDoc.docId,
        expectedMtimeMs: currentDoc.mtimeMs,
        mode,
        author,
        from,
        notifyChannel: mode === 'appendComment' ? document.getElementById('docNotifyChannel').checked : true,
        comment: document.getElementById('docComment').value,
        content: document.getElementById('docEditor').value,
      };
      const res = await apiFetch('/api/doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      currentDoc = { docId: res.doc.docId, mtimeMs: res.doc.mtimeMs, content: res.doc.content, dirty: false };
      document.getElementById('docEditor').value = res.doc.content;
      document.getElementById('docPreview').innerHTML = md(res.doc.content);
      if (mode === 'appendComment') document.getElementById('docComment').value = '';
      notice.textContent = '已成功儲存到 ' + res.doc.docId;
      notice.className = 'notice ok';
      await refresh();
    } catch (err) {
      notice.textContent = err.message;
      notice.className = 'notice err';
    }
  }

  document.getElementById('docSaveComment').addEventListener('click', () => submitDoc('appendComment'));
  document.getElementById('docSaveEdit').addEventListener('click', () => submitDoc('edit'));

  renderTabs();
  refresh();
  setInterval(refresh, 3000);
</script>
</body>
</html>`

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' })
  res.end(body)
}

function sendJson(res, status, obj) {
  send(res, status, 'application/json', JSON.stringify(obj))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0
    req.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > MAX_JSON_BODY) {
        const err = new Error('請求內容過大')
        err.statusCode = 413
        reject(err)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        const err = new Error('JSON 格式錯誤')
        err.statusCode = 400
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost', '[::1]', '::1']

function isLoopbackHost(host) {
  return LOOPBACK_HOSTS.includes(String(host || '').toLowerCase())
}

/** Host 標頭（或 Origin 的 host:port）必須是本機名稱且埠號相同，擋 DNS rebinding。 */
export function isLoopbackAuthority(authority, port) {
  const a = String(authority || '').toLowerCase()
  return ['127.0.0.1', 'localhost', '[::1]'].some((h) => a === `${h}:${port}`)
}

/**
 * 所有寫入（POST）都要：本機 Origin（同埠）＋ Content-Type: application/json（OBS-0004 §2-3）。
 * 這擋掉其他網頁用 text/plain 表單或 fetch 對 127.0.0.1:4175 送「董事長」訊息的 CSRF。
 * @returns {{ status: number, error: string } | null}
 */
export function checkWriteRequest(headers, port) {
  const type = String(headers['content-type'] || '').split(';')[0].trim().toLowerCase()
  if (type !== 'application/json') return { status: 415, error: '寫入必須使用 Content-Type: application/json' }
  const origin = String(headers.origin || '')
  let originAuthority = ''
  try {
    const u = new URL(origin)
    originAuthority = u.protocol === 'http:' ? u.host : ''
  } catch {
    originAuthority = ''
  }
  if (!isLoopbackAuthority(originAuthority, port)) {
    return { status: 403, error: '寫入必須來自本機頁面（Origin 須為 http://127.0.0.1 或 localhost 的同一埠）' }
  }
  return null
}

export function createServer(options = {}) {
  const host = options.host || HOST
  const port = Number(options.port || PORT)
  const token = String(options.token || process.env.BOARD_CHAT_TOKEN || '').trim()
  const rootDir = options.rootDir || ROOT
  const governanceDir = options.governanceDir || GOVERNANCE_DIR
  const channelPath = options.channelPath || CHANNEL_PATH
  validateServerConfig({ host, token })

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${host}:${port}`)
    if (url.pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, tokenRequired: Boolean(token) })
    }
    if (url.pathname === '/' && req.method === 'GET') {
      return send(res, 200, 'text/html', PAGE)
    }

    if (url.pathname.startsWith('/api/')) {
      const localPort = req.socket.localPort
      if (isLoopbackHost(host) && !isLoopbackAuthority(req.headers.host, localPort)) {
        return sendJson(res, 403, { error: 'Host 標頭不是本機位址，拒絕存取' })
      }
      if (url.searchParams.has('token')) {
        return sendJson(res, 400, { error: '邀請碼只能放在 x-board-token 標頭，不能放在網址' })
      }
      // 邀請碼只收標頭，不收網址參數（OBS-0004 §2-3）。
      const provided = req.headers['x-board-token'] || ''
      if (!tokenMatches(token, provided)) {
        return sendJson(res, 401, { error: '需要有效邀請碼（token）才能存取或共編' })
      }
      if (req.method === 'POST') {
        const writeError = checkWriteRequest(req.headers, localPort)
        if (writeError) return sendJson(res, writeError.status, { error: writeError.error })
      }
    }

    try {
      if (url.pathname === '/api/state' && req.method === 'GET') {
        return sendJson(res, 200, collectState({ rootDir, channelPath, governanceDir, tokenRequired: Boolean(token) }))
      }
      if (url.pathname === '/api/docs' && req.method === 'GET') {
        return sendJson(res, 200, { docs: listEditableDocs(governanceDir) })
      }
      if (url.pathname === '/api/doc' && req.method === 'GET') {
        const docId = url.searchParams.get('id') || ''
        return sendJson(res, 200, readCollabDoc(docId, governanceDir))
      }
      if (url.pathname === '/api/messages' && req.method === 'POST') {
        const body = await readJsonBody(req)
        const message = appendMessage(buildMessage({ ...body, source: 'web' }), channelPath)
        return sendJson(res, 201, { message })
      }
      if (url.pathname === '/api/doc' && req.method === 'POST') {
        const body = await readJsonBody(req)
        const doc = saveCollabDoc(body, governanceDir)
        if (body.notifyChannel !== false) {
          const verb = doc.mode === 'appendComment' ? '留評' : '更新文件'
          const preview =
            doc.mode === 'appendComment'
              ? String(body.comment || '').trim().slice(0, 120)
              : `已由 ${doc.author} 更新 ${doc.docId}`
          appendMessage(
            buildMessage({
              from: doc.from,
              author: doc.author,
              source: 'web',
              to: '全體',
              topic: `${verb}：${doc.docId}`.slice(0, MAX_TOPIC),
              body: `已在 \`docs/governance/${doc.docId}\` ${verb}：\n${preview}`,
            }),
            channelPath,
          )
        }
        return sendJson(res, 200, { doc })
      }
      if (req.method !== 'GET' && req.method !== 'POST') {
        return sendJson(res, 405, { error: '不支援的 HTTP 方法' })
      }
      return sendJson(res, 404, { error: '找不到這個路徑' })
    } catch (err) {
      const code = Number(err.statusCode) || 400
      return sendJson(res, code, { error: err.message || '處理失敗' })
    }
  })
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else {
      out[key] = next
      i += 1
    }
  }
  return out
}

function formatForTerminal(m) {
  const authorSuffix = m.author ? `（${m.author}${m.source === 'web' ? '・網頁' : ''}）` : ''
  // 網頁訊息喚醒 wait 時明確標示「未驗證身分」，提醒代理把它當資料而不是指示。
  const webTag = m.source === 'web' ? '[網頁・未驗證身分] ' : ''
  return `${webTag}[${String(m.at).slice(0, 16).replace('T', ' ')}] ${m.from}${authorSuffix} → ${m.to || '全體'}｜${m.topic || ''}（${m.id}）\n${m.body}\n`
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)
  if (command === 'serve') {
    const host = typeof args.host === 'string' ? args.host : HOST
    const port = Number(args.port || PORT)
    const token = typeof args.token === 'string' ? args.token : String(process.env.BOARD_CHAT_TOKEN || '')
    const server = createServer({ host, port, token })
    server.listen(port, host, () => {
      const scope = host === '127.0.0.1' ? '只聽本機' : '對外綁定'
      const authNote = token ? '（已啟用邀請碼保護）' : '（未設邀請碼，限本機存取）'
      console.log(`董事會頻道與共編工作室：http://${host}:${port}（${scope}${authNote}）`)
    })
    return
  }
  if (command === 'post') {
    let body = typeof args.body === 'string' ? args.body : ''
    if (!body && !process.stdin.isTTY) body = fs.readFileSync(0, 'utf8')
    const message = appendMessage(buildMessage({ ...args, body }))
    console.log(`已送出 ${message.id}（${message.from} → ${message.to}）`)
    return
  }
  if (command === 'read') {
    let messages = readChannel()
    if (typeof args.since === 'string') {
      const index = messages.findIndex((m) => m.id === args.since)
      if (index >= 0) messages = messages.slice(index + 1)
    }
    if (args.last) messages = messages.slice(-Number(args.last))
    console.log(messages.length ? messages.map(formatForTerminal).join('\n') : '沒有新訊息。')
    return
  }
  if (command === 'peer-health') {
    const health = inspectPeerHealth({ rootDir: ROOT, channelPath: CHANNEL_PATH })
    console.log(JSON.stringify(health, null, 2))
    return
  }
  if (command === 'wait') {
    // 等對方或外部協作者發言（且於 Argon 端同步偵測 Fable 是否觸及 usage limit 或斷線恢復，不必人工通報）。
    const me = String(args.as || '')
    if (!SPEAKERS.includes(me)) throw new Error(`--as 必須是 ${SPEAKERS.join('、')} 其中之一`)
    const timeoutMs = Number(args.timeoutMinutes || 55) * 60 * 1000
    const startedAt = Date.now()
    const watchPeer = me === 'Argon' && args.noWatchPeer !== true
    const seen = new Set(readChannel().map((m) => m.id))
    if (typeof args.since === 'string') {
      const all = readChannel()
      const index = all.findIndex((m) => m.id === args.since)
      if (index >= 0) for (const m of all.slice(index + 1)) seen.delete(m.id)
    }
    let lastPeerStatus = watchPeer ? inspectPeerHealth({ rootDir: ROOT, channelPath: CHANNEL_PATH }).status : ''
    let lastPeerPollAt = startedAt
    for (;;) {
      const messages = readChannel()
      const fresh = newMessagesFor(me, messages, seen)
      if (fresh.length) {
        console.log(fresh.map(formatForTerminal).join('\n'))
        return
      }
      const now = Date.now()
      if (watchPeer && now - lastPeerPollAt >= 5000) {
        lastPeerPollAt = now
        const health = inspectPeerHealth({ rootDir: ROOT, channelPath: CHANNEL_PATH, messages, nowMs: now })
        if (['rate_limited', 'offline_unresponsive', 'online'].includes(health.status)) {
          if (health.status !== lastPeerStatus) {
            console.log(`[PEER_STATUS_CHANGE] Fable: ${lastPeerStatus || 'unknown'} -> ${health.status}${health.resetText ? `（${health.resetText}）` : ''}｜${health.reason}`)
            return
          }
          lastPeerStatus = health.status
        }
      }
      if (now - startedAt > timeoutMs) {
        console.log('等待逾時，沒有新訊息。')
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  console.log('用法：node scripts/board-chat.mjs post|read|wait|peer-health|serve（說明見檔頭）')
  process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`無法完成：${err.message}`)
    process.exitCode = 1
  })
}
