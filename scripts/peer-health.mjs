// 同儕可用性與用量上限偵測（Peer Health / Rate-Limit Detector）
//
// 自動偵測 Fable（Claude Code）是否觸及 usage / rate limit 或斷線未監聽，
// 不必由使用者每次手動轉告 Argon。只讀本機檔案與行程狀態，不消耗任何模型額度。

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = path.resolve(__dirname, '..')
const DEFAULT_CHANNEL_PATH = path.join(DEFAULT_ROOT, 'docs', 'governance', 'channel.jsonl')
const TAIL_BYTES = 64 * 1024
const RECENT_FILE_WINDOW_MS = 6 * 60 * 60 * 1000
const UNRESPONSIVE_MS = 3 * 60 * 1000

/** Claude Code 依工作目錄路徑編碼的本機專案紀錄目錄。 */
export function defaultClaudeProjectDir(rootDir = DEFAULT_ROOT) {
  const abs = path.resolve(rootDir)
  const slug = `-${abs.replace(/^[\\/]/, '').replace(/[\\/.]/g, '-')}`
  return path.join(os.homedir(), '.claude', 'projects', slug)
}

function readChannelMessages(channelPath) {
  if (!channelPath || !fs.existsSync(channelPath)) return []
  const out = []
  for (const line of fs.readFileSync(channelPath, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const m = JSON.parse(line)
      if (m && typeof m.from === 'string') out.push(m)
    } catch {
      // ignore malformed line
    }
  }
  return out
}

function readTailText(filePath, maxBytes = TAIL_BYTES) {
  const stat = fs.statSync(filePath)
  if (stat.size <= maxBytes) return fs.readFileSync(filePath, 'utf8')
  const fd = fs.openSync(filePath, 'r')
  try {
    const buf = Buffer.allocUnsafe(maxBytes)
    const offset = stat.size - maxBytes
    const read = fs.readSync(fd, buf, 0, maxBytes, offset)
    const chunk = buf.subarray(0, read).toString('utf8')
    const firstNewline = chunk.indexOf('\n')
    return firstNewline >= 0 ? chunk.slice(firstNewline + 1) : chunk
  } finally {
    fs.closeSync(fd)
  }
}

function extractResetText(rawLine, parsed) {
  const haystack = `${rawLine}\n${JSON.stringify(parsed?.message ?? '')}`
  const m = haystack.match(/resets\s+[^\n"\\]+/i)
  return m ? m[0].trim() : ''
}

function isRateLimitRow(rawLine, parsed) {
  if (parsed?.error === 'rate_limit') return true
  if (parsed?.isApiErrorMessage && /rate_limit|hit your limit|usage limit/i.test(rawLine)) return true
  if (/"error"\s*:\s*"rate_limit"/.test(rawLine)) return true
  if (/You've hit your limit|hit your limit\s*·\s*resets/i.test(rawLine)) return true
  return false
}

function isBlockingApiErrorRow(rawLine, parsed) {
  if (isRateLimitRow(rawLine, parsed)) return 'rate_limit'
  if (parsed?.error === 'authentication_failed' || parsed?.error === 'billing_error') return String(parsed.error)
  return ''
}

function parseTimestampMs(row) {
  const ts = row?.timestamp || row?.at || row?.createdAt
  if (!ts) return 0
  const ms = Date.parse(String(ts))
  return Number.isFinite(ms) ? ms : 0
}

/** 解析單一 Claude Code transcript 檔尾的最新成功回應與 API 阻塞錯誤時間。 */
export function scanTranscriptTail(rawTail) {
  let latestOkMs = 0
  let latestRateLimitMs = 0
  let latestErrorKind = ''
  let resetText = ''

  for (const line of String(rawTail || '').split('\n')) {
    if (!line.trim()) continue
    let row = null
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    const ms = parseTimestampMs(row)
    if (!ms) continue
    const blockErr = isBlockingApiErrorRow(line, row)
    if (blockErr) {
      if (ms >= latestRateLimitMs) {
        latestRateLimitMs = ms
        latestErrorKind = blockErr
        resetText = extractResetText(line, row) || resetText
      }
      continue
    }
    const isHealthyAssistantTurn =
      row.type === 'assistant' &&
      !row.error &&
      !row.isApiErrorMessage &&
      row.message?.model !== '<synthetic>'
    if (isHealthyAssistantTurn && ms > latestOkMs) {
      latestOkMs = ms
    }
  }
  return { latestOkMs, latestRateLimitMs, latestErrorKind, resetText }
}

/** 檢查本機是否有 `board-chat.mjs wait --as <speaker>` 行程正在執行。 */
export function isWaitListenerAlive(speaker = 'Fable') {
  try {
    const out = execSync('ps -axo command', { encoding: 'utf8', timeout: 8000 })
    const needle = `board-chat.mjs wait --as ${speaker}`
    return out.split('\n').some((line) => line.includes(needle))
  } catch {
    return null
  }
}

/**
 * 綜合 Claude Code 紀錄檔、董事會頻道最後發言、與 wait 行程存活狀態，
 * 判斷 Fable 目前狀態：`rate_limited` | `offline_unresponsive` | `online` | `unknown`。
 */
export function inspectPeerHealth(options = {}) {
  const nowMs = Number(options.nowMs ?? Date.now())
  const rootDir = options.rootDir ?? DEFAULT_ROOT
  const projectDir = options.projectDir ?? defaultClaudeProjectDir(rootDir)
  const channelPath = options.channelPath ?? DEFAULT_CHANNEL_PATH
  const checkListener = options.checkListener ?? isWaitListenerAlive
  const messages = Array.isArray(options.messages) ? options.messages : readChannelMessages(channelPath)

  let latestChannelFableMs = 0
  let latestToFableFromArgonMs = 0
  for (const m of messages) {
    const ms = Date.parse(String(m.at || '')) || 0
    if (m.from === 'Fable' && ms > latestChannelFableMs) latestChannelFableMs = ms
    if (m.from === 'Argon' && (m.to === 'Fable' || m.to === '全體') && ms > latestToFableFromArgonMs) {
      latestToFableFromArgonMs = ms
    }
  }

  let latestOkMs = 0
  let latestRateLimitMs = 0
  let latestErrorKind = ''
  let resetText = ''
  let inspectedFiles = 0

  if (projectDir && fs.existsSync(projectDir)) {
    const recentFiles = fs
      .readdirSync(projectDir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => {
        const full = path.join(projectDir, f)
        return { name: f, full, mtimeMs: fs.statSync(full).mtimeMs }
      })
      .filter((f) => nowMs - f.mtimeMs <= RECENT_FILE_WINDOW_MS)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, 5)

    for (const file of recentFiles) {
      inspectedFiles += 1
      const scan = scanTranscriptTail(readTailText(file.full))
      if (scan.latestOkMs > latestOkMs) latestOkMs = scan.latestOkMs
      if (scan.latestRateLimitMs > latestRateLimitMs) {
        latestRateLimitMs = scan.latestRateLimitMs
        latestErrorKind = scan.latestErrorKind || 'rate_limit'
      }
      if (scan.resetText && !resetText) resetText = scan.resetText
    }
  }

  const listenerAlive = checkListener('Fable')
  const latestActivityAfterLimit = Math.max(latestOkMs, latestChannelFableMs)

  if (latestRateLimitMs > 0 && latestRateLimitMs >= latestActivityAfterLimit) {
    return {
      peer: 'Fable',
      status: 'rate_limited',
      errorKind: latestErrorKind,
      resetText,
      rateLimitAt: new Date(latestRateLimitMs).toISOString(),
      lastOkAt: latestOkMs ? new Date(latestOkMs).toISOString() : '',
      lastChannelFableAt: latestChannelFableMs ? new Date(latestChannelFableMs).toISOString() : '',
      listenerAlive,
      inspectedFiles,
      bypassEligible: true,
      reason: `Claude Code 本機紀錄於 ${new Date(latestRateLimitMs).toLocaleTimeString('zh-TW', { hour12: false })} 回報 ${latestErrorKind || 'rate_limit'}${resetText ? `（${resetText}）` : ''}，且之後尚無新成功回應`,
    }
  }

  const awaitingReplyMs = latestToFableFromArgonMs > latestChannelFableMs
    ? nowMs - latestToFableFromArgonMs
    : 0
  if (listenerAlive === false && awaitingReplyMs >= UNRESPONSIVE_MS) {
    return {
      peer: 'Fable',
      status: 'offline_unresponsive',
      resetText: '',
      rateLimitAt: '',
      lastOkAt: latestOkMs ? new Date(latestOkMs).toISOString() : '',
      lastChannelFableAt: latestChannelFableMs ? new Date(latestChannelFableMs).toISOString() : '',
      listenerAlive: false,
      inspectedFiles,
      bypassEligible: false,
      reason: `Fable wait 監聽行程未運行，且未回覆 Argon 訊息已超過 ${Math.round(awaitingReplyMs / 60000)} 分鐘`,
    }
  }

  if (listenerAlive === null && awaitingReplyMs >= UNRESPONSIVE_MS) {
    return {
      peer: 'Fable',
      status: 'unknown',
      resetText: '',
      rateLimitAt: '',
      lastOkAt: latestOkMs ? new Date(latestOkMs).toISOString() : '',
      lastChannelFableAt: latestChannelFableMs ? new Date(latestChannelFableMs).toISOString() : '',
      listenerAlive: null,
      inspectedFiles,
      bypassEligible: false,
      reason: '無法確認 Fable wait 監聽行程狀態（暫不判定在線）',
    }
  }

  if (listenerAlive === true || latestOkMs > 0 || latestChannelFableMs > 0) {
    return {
      peer: 'Fable',
      status: 'online',
      resetText: '',
      rateLimitAt: latestRateLimitMs ? new Date(latestRateLimitMs).toISOString() : '',
      lastOkAt: latestOkMs ? new Date(latestOkMs).toISOString() : '',
      lastChannelFableAt: latestChannelFableMs ? new Date(latestChannelFableMs).toISOString() : '',
      listenerAlive,
      inspectedFiles,
      bypassEligible: false,
      reason: listenerAlive === true ? 'Fable wait 監聽中且最近無未恢復之 rate_limit' : '近期有正常對話或工作紀錄',
    }
  }

  return {
    peer: 'Fable',
    status: 'unknown',
    resetText: '',
    rateLimitAt: '',
    lastOkAt: '',
    lastChannelFableAt: '',
    listenerAlive,
    inspectedFiles,
    bypassEligible: false,
    reason: '找不到近期 Claude Code 紀錄或頻道訊息',
  }
}
