/**
 * 卡住偵測（stall watch）：不靠任何代理醒著，也能發現「有人在等一個沒醒的人」。
 *
 *   node scripts/stall-watch.mjs check      # 只印出目前卡住的項目（JSON），不通知
 *   node scripts/stall-watch.mjs run        # 檢查並對「新的」卡住項目發一則 macOS 通知（launchd 每 10 分鐘跑這個）
 *   node scripts/stall-watch.mjs plist      # 只印出 launchd plist
 *   node scripts/stall-watch.mjs install    # 寫入 ~/Library/LaunchAgents 並載入
 *   node scripts/stall-watch.mjs status     # 印出 launchd 狀態與狀態檔
 *   node scripts/stall-watch.mjs uninstall  # 卸載並刪除 plist
 *
 * 為什麼需要它（C-32，2026-11-15）：Fable 與觀察者是 Claude Code 工作階段，兩次對話之間不會執行；
 * Argon 的巡檢雖然看得到「Fable 未回覆」，但只能記錄。11/14 22:00 → 11/15 09:2x，4b 因此空等約 11 小時，
 * 沒有任何人收到提醒。這支程式只讀 `docs/governance/channel.jsonl`，不用模型額度、不寫 repo、不碰 git、
 * 不碰 `cloudflared`。唯一的對外動作是在本機桌面跳通知給使用者；同一則訊息只通知一次。
 *
 * 卡住的定義：頻道裡一則**指名給某位代理**（不是「全體」）的訊息，超過門檻（預設 60 分鐘）
 * 對方都沒有在頻道再發過任何一則訊息。只看最近 48 小時，避免把舊帳翻出來。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const CHANNEL_PATH = path.join(ROOT_DIR, 'docs', 'governance', 'channel.jsonl')
const STATE_PATH = path.join(os.homedir(), '.greenmatch', 'stall-watch-state.json')

export const STALL_WATCH_LABEL = 'com.greenmatch.stall-watch'
export const DEFAULT_THRESHOLD_MS = 60 * 60 * 1000
const LOOKBACK_MS = 48 * 60 * 60 * 1000
const BROADCAST = new Set(['全體', 'all', 'All', '*'])

export function parseChannel(raw) {
  const out = []
  for (const line of String(raw).split('\n')) {
    if (!line.trim()) continue
    try {
      const m = JSON.parse(line)
      if (m && typeof m.from === 'string' && typeof m.at === 'string') out.push(m)
    } catch {
      // 壞行略過
    }
  }
  return out
}

/**
 * 找出「指名給某人、超過門檻沒有回音」的訊息。每位被等的人只回報最早那一則（等最久的）。
 * @returns {{ id: string, from: string, waitingOn: string, topic: string, at: string, minutes: number }[]}
 */
export function findStalls(messages, nowMs, { thresholdMs = DEFAULT_THRESHOLD_MS, lookbackMs = LOOKBACK_MS } = {}) {
  const lastPostBy = new Map()
  for (const m of messages) {
    const t = Date.parse(m.at)
    if (Number.isNaN(t)) continue
    if (t > (lastPostBy.get(m.from) ?? -Infinity)) lastPostBy.set(m.from, t)
  }
  const oldestByTarget = new Map()
  for (const m of messages) {
    const to = typeof m.to === 'string' ? m.to.trim() : ''
    if (!to || BROADCAST.has(to) || to === m.from) continue
    const t = Date.parse(m.at)
    if (Number.isNaN(t) || nowMs - t > lookbackMs || nowMs - t < thresholdMs) continue
    if ((lastPostBy.get(to) ?? -Infinity) > t) continue
    const prev = oldestByTarget.get(to)
    if (!prev || t < Date.parse(prev.at)) oldestByTarget.set(to, m)
  }
  return [...oldestByTarget.values()].map((m) => ({
    id: m.id,
    from: m.from,
    waitingOn: m.to.trim(),
    topic: m.topic ?? '',
    at: m.at,
    minutes: Math.floor((nowMs - Date.parse(m.at)) / 60000),
  }))
}

const ROUND_SUMMARY_RE = /第\s*\d+[a-z]?\s*輪摘要/i
export const REVIEW_THRESHOLD_MS = 2 * 60 * 60 * 1000

/**
 * 流程審閱逾期（C-36）：最新一則「第 N 輪摘要」發出超過 2 小時，流程長在那之後沒有在頻道發過任何訊息。
 * 流程長不常駐，這是唯一會叫到它的訊號；結果當成「某人在等流程長」，和 findStalls 同一種輸出。
 */
export function findReviewOverdue(messages, nowMs, { thresholdMs = REVIEW_THRESHOLD_MS, lookbackMs = LOOKBACK_MS } = {}) {
  let latest = null
  let latestT = -Infinity
  let lastChief = -Infinity
  for (const m of messages) {
    const t = Date.parse(m.at)
    if (Number.isNaN(t)) continue
    if (m.from === '流程長' && t > lastChief) lastChief = t
    if (m.from !== '流程長' && ROUND_SUMMARY_RE.test(m.topic ?? '') && t > latestT) {
      latest = m
      latestT = t
    }
  }
  if (!latest || nowMs - latestT < thresholdMs || nowMs - latestT > lookbackMs || lastChief > latestT) return []
  return [{
    id: `review:${latest.id}`,
    from: latest.from,
    waitingOn: '流程長',
    topic: latest.topic ?? '',
    at: latest.at,
    minutes: Math.floor((nowMs - latestT) / 60000),
  }]
}

/** 只留還沒通知過的；狀態檔只記 id。 */
export function newStalls(stalls, notifiedIds) {
  const seen = new Set(notifiedIds)
  return stalls.filter((s) => !seen.has(s.id))
}

export function notificationText(s) {
  const hours = s.minutes >= 120 ? `${Math.floor(s.minutes / 60)} 小時` : `${s.minutes} 分鐘`
  return {
    title: `綠媒：${s.from} 在等 ${s.waitingOn}（${hours}）`,
    body: `「${s.topic.slice(0, 60)}」沒有回音。請叫醒 ${s.waitingOn} 的工作階段，或請 ${s.from} 依「不空等」規則自行推進。`,
  }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  } catch {
    return { notifiedIds: [] }
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

function notify({ title, body }) {
  // 以參數傳入，不把訊息內容拼進 AppleScript 原始碼。
  execFileSync('osascript', [
    '-e', 'on run argv',
    '-e', 'display notification (item 2 of argv) with title (item 1 of argv)',
    '-e', 'end run',
    title, body,
  ])
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildStallWatchPlist({ nodePath, rootDir, logDir, label = STALL_WATCH_LABEL, intervalSec = 600 }) {
  const script = path.join(rootDir, 'scripts', 'stall-watch.mjs')
  const logBase = path.join(logDir, 'greenmatch-stall-watch')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>${xmlEscape(label)}</string>
	<key>ProgramArguments</key>
	<array>
		<string>${xmlEscape(nodePath)}</string>
		<string>${xmlEscape(script)}</string>
		<string>run</string>
	</array>
	<key>WorkingDirectory</key>
	<string>${xmlEscape(rootDir)}</string>
	<key>StartInterval</key>
	<integer>${intervalSec}</integer>
	<key>RunAtLoad</key>
	<true/>
	<key>ProcessType</key>
	<string>Background</string>
	<key>StandardOutPath</key>
	<string>${xmlEscape(logBase)}.log</string>
	<key>StandardErrorPath</key>
	<string>${xmlEscape(logBase)}.err.log</string>
</dict>
</plist>
`
}

function plistPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${STALL_WATCH_LABEL}.plist`)
}

function launchctl(args, allowFail = false) {
  try {
    return execFileSync('launchctl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    if (allowFail) return ''
    throw err
  }
}

function main(cmd) {
  const domain = `gui/${process.getuid()}`
  const plist = () => buildStallWatchPlist({
    nodePath: process.execPath,
    rootDir: ROOT_DIR,
    logDir: path.join(os.homedir(), 'Library', 'Logs'),
  })
  if (cmd === 'check' || cmd === 'run') {
    const messages = fs.existsSync(CHANNEL_PATH) ? parseChannel(fs.readFileSync(CHANNEL_PATH, 'utf8')) : []
    const stalls = [...findStalls(messages, Date.now()), ...findReviewOverdue(messages, Date.now())]
    if (cmd === 'check') {
      console.log(JSON.stringify(stalls, null, 2))
      return
    }
    const state = readState()
    const fresh = newStalls(stalls, state.notifiedIds)
    for (const s of fresh) notify(notificationText(s))
    // 只保留最近 200 筆 id，狀態檔不會無限長大。
    writeState({ notifiedIds: [...state.notifiedIds, ...fresh.map((s) => s.id)].slice(-200), lastRunAt: new Date().toISOString() })
    if (fresh.length) console.log(`${new Date().toISOString()} 通知 ${fresh.length} 則：${fresh.map((s) => s.id).join(', ')}`)
    return
  }
  if (cmd === 'plist') {
    process.stdout.write(plist())
    return
  }
  if (cmd === 'install') {
    fs.mkdirSync(path.dirname(plistPath()), { recursive: true })
    fs.writeFileSync(plistPath(), plist())
    launchctl(['bootout', `${domain}/${STALL_WATCH_LABEL}`], true)
    launchctl(['bootstrap', domain, plistPath()])
    console.log(`已安裝 ${STALL_WATCH_LABEL}（每 10 分鐘）：${plistPath()}`)
    return
  }
  if (cmd === 'uninstall') {
    launchctl(['bootout', `${domain}/${STALL_WATCH_LABEL}`], true)
    if (fs.existsSync(plistPath())) fs.rmSync(plistPath())
    console.log(`已卸載 ${STALL_WATCH_LABEL}`)
    return
  }
  if (cmd === 'status') {
    console.log(launchctl(['print', `${domain}/${STALL_WATCH_LABEL}`], true).split('\n').slice(0, 12).join('\n') || '（未安裝）')
    console.log(JSON.stringify(readState(), null, 2))
    return
  }
  console.log('用法：node scripts/stall-watch.mjs check|run|plist|install|status|uninstall')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2])
}
