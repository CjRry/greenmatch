import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BOARD = path.join(ROOT, 'docs', 'board')

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function cmdOk(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim()
  } catch {
    return ''
  }
}

const deploymentMd = readText(path.join(BOARD, 'deployment.md'))
const urlMatch = deploymentMd.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
const publicUrl = urlMatch ? urlMatch[0] : null

const originHealth = cmdOk('curl -s -m 3 http://127.0.0.1:4173/api/health')
const devUp = Boolean(cmdOk('lsof -ti :5173'))
const cloudflaredPids = cmdOk('pgrep -f "cloudflared tunnel"')
const publicStatus = publicUrl ? cmdOk(`curl -s -o /dev/null -w "%{http_code}" -m 5 ${publicUrl}/api/health`) : 'NO_URL'

const distFile = path.join(ROOT, 'dist', 'index.html')
let distInfo = null
if (fs.existsSync(distFile)) {
  const buf = fs.readFileSync(distFile)
  const st = fs.statSync(distFile)
  distInfo = {
    bytes: buf.length,
    mtime: st.mtime.toISOString(),
    sha256_8: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8),
  }
}

const logText = readText(path.join(BOARD, 'outreach-log.md'))
const sentIds = new Set()
const counts = { SENT: 0, BOUNCED: 0, AUTO_REPLY: 0, REPLY: 0, OPT_OUT: 0, FOLLOWUP_SENT: 0 }
let lastLogTime = null
for (const line of logText.split('\n')) {
  if (!line.startsWith('| 20')) continue
  const cols = line.split('|').map((s) => s.trim()).filter(Boolean)
  if (cols.length < 6) continue
  const [time, , id, , , action] = cols
  lastLogTime = time
  if (action in counts) counts[action]++
  if (action === 'SENT') sentIds.add(id)
}

const wave2 = readJson(path.join(BOARD, 'outreach-wave2.json')) ?? []
const pending = wave2.filter((t) => !sentIds.has(t.id))
const pendingByBatch = {}
for (const t of pending) {
  const key = `Batch ${t.batch}`
  pendingByBatch[key] = (pendingByBatch[key] ?? 0) + 1
}
const nextBatchNum = pending.length ? Math.min(...pending.map((t) => Number(t.batch) || 999)) : null
const nextBatchTargets = nextBatchNum !== null ? pending.filter((t) => Number(t.batch) === nextBatchNum) : []

const feedbackRaw = readText(path.join(BOARD, 'live-feedback.jsonl'))
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
const parsedFeedback = feedbackRaw.map((l) => {
  try {
    return JSON.parse(l)
  } catch {
    return { _invalid: true }
  }
})
// 現行欄位是 source、browserFamily（伺服器寫入）；isTest、ua 只為相容舊紀錄。
const isTestFeedback = (f) =>
  Boolean(f.isTest) ||
  f.source !== 'web-form' ||
  /HeadlessChrome|Playwright/i.test(String(f.browserFamily ?? f.ua ?? ''))
const testFeedback = parsedFeedback.filter((f) => !f._invalid && isTestFeedback(f))
const realWebFeedback = parsedFeedback.filter((f) => !f._invalid && !isTestFeedback(f))

const handoffState = readJson(path.join(BOARD, 'handoff-state.json'))

const report = {
  checkedAt: new Date().toISOString(),
  baton: handoffState,
  services: {
    publicUrl,
    publicHealthHttp: publicStatus || 'DOWN',
    origin4173Health: originHealth || 'DOWN',
    cloudflaredPids: cloudflaredPids ? cloudflaredPids.split('\n') : [],
    dev5173Up: devUp,
  },
  dist: distInfo,
  outreach: {
    counts,
    lastLogTime,
    pendingInWave2: pending.length,
    pendingByBatch,
    nextBatch: nextBatchNum !== null ? `Batch ${nextBatchNum}` : null,
    nextBatchIds: nextBatchTargets.map((t) => `${t.id}:${t.email}`),
  },
  feedback: {
    webTotalLines: parsedFeedback.length,
    webRealHuman: realWebFeedback.length,
    webExcludedTests: testFeedback.length,
  },
}

console.log(JSON.stringify(report, null, 2))
