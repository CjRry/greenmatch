import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { collectState as collectBoardChannel } from './board-chat.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '..')
const GOV_DIR = path.join(ROOT, 'docs', 'governance')
const BOARD_DIR = path.join(ROOT, 'docs', 'board')

export function readTextSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

export function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function runCmdSafe(cmd, cwd = ROOT) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', timeout: 4000 }).trim()
  } catch {
    return ''
  }
}

function listMarkdownDir(dirPath, prefixFilter = null) {
  if (!fs.existsSync(dirPath)) return []
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.md') && d.name !== 'TEMPLATE.md')
    .filter((d) => (!prefixFilter ? true : d.name.startsWith(prefixFilter)))
    .map((d) => {
      const fullPath = path.join(dirPath, d.name)
      const stat = fs.statSync(fullPath)
      return {
        name: d.name,
        relPath: path.relative(ROOT, fullPath),
        mtime: stat.mtime.toISOString(),
        size: stat.size,
        content: readTextSafe(fullPath),
      }
    })
    .sort((a, b) => b.name.localeCompare(a.name))
}

function parseMetaField(md, label) {
  const re = new RegExp(`^-\\s*\\*\\*${label}\\*\\*:\\s*(.+)$`, 'm')
  const m = md.match(re)
  return m ? m[1].replace(/`/g, '').trim() : ''
}

function parseMarkdownSection(md, headingPrefix) {
  const lines = md.split('\n')
  const out = []
  let active = false
  const level = headingPrefix.match(/^#+/)?.[0]?.length ?? 2
  for (const line of lines) {
    const hMatch = line.match(/^(#+)\s+/)
    if (hMatch) {
      if (line.startsWith(headingPrefix)) {
        active = true
        continue
      }
      if (active && hMatch[1].length <= level) break
    }
    if (active) out.push(line)
  }
  return out.join('\n').trim()
}

function parseProposal(file) {
  const titleMatch = file.content.match(/^#\s+(.+)$/m)
  const statusLine = parseMetaField(file.content, '狀態')
  const statusCode = statusLine.split(/\s+/)[0] || 'UNKNOWN'
  return {
    ...file,
    id: file.name.replace(/\.md$/, ''),
    title: titleMatch ? titleMatch[1] : file.name,
    initiator: parseMetaField(file.content, '提案發起人'),
    createdAt: parseMetaField(file.content, '建立時間'),
    status: statusCode,
    statusRaw: statusLine,
    scope: parseMetaField(file.content, '影響範圍'),
    fableOpinion: parseMarkdownSection(file.content, '### Fable'),
    argonOpinion: parseMarkdownSection(file.content, '### Gemini 4 Argon'),
    signOff: parseMarkdownSection(file.content, '## 3. 雙簽確認'),
  }
}

function parseObserverReport(file) {
  const titleMatch = file.content.match(/^#\s+(.+)$/m)
  const verdict = parseMetaField(file.content, '整體建議')
  return {
    ...file,
    id: file.name.replace(/\.md$/, ''),
    title: titleMatch ? titleMatch[1] : file.name,
    observer: parseMetaField(file.content, '觀察者'),
    reviewedAt: parseMetaField(file.content, '審查時間'),
    target: parseMetaField(file.content, '對應報備主題 / 提案'),
    verdict: verdict || 'UNKNOWN',
    findingsSection: parseMarkdownSection(file.content, '## 2. 建議改善項目'),
    pendingRulings: parseMarkdownSection(file.content, '## 3. 呈報給最終拍板者'),
  }
}

function parseStatusSections(statusMd) {
  return {
    pendingDiscussion: parseMarkdownSection(statusMd, '## 待討論 / 待雙簽提案'),
    readyForCeo: parseMarkdownSection(statusMd, '## 已雙簽可交辦 CEO'),
    userRulings: parseMarkdownSection(statusMd, '## 使用者已拍板'),
    pendingUserRuling: parseMarkdownSection(statusMd, '## 待使用者拍板'),
    pendingObserver: parseMarkdownSection(statusMd, '## 待外部觀察者審查'),
    recentObserver: parseMarkdownSection(statusMd, '## 最近完成的觀察報告'),
  }
}

function collectRecentFiles(dirs, limit = 30) {
  const found = []
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) {
        const st = fs.statSync(full)
        found.push({
          relPath: path.relative(ROOT, full),
          mtime: st.mtime.toISOString(),
          mtimeMs: st.mtimeMs,
          size: st.size,
        })
      }
    }
  }
  for (const d of dirs) walk(path.join(ROOT, d))
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit)
}

function collectWorktrees() {
  const raw = runCmdSafe('git worktree list --porcelain')
  if (!raw) return []
  return raw
    .split('\n\n')
    .filter(Boolean)
    .map((b) => {
      const lines = b.split('\n')
      const worktreePath = lines.find((l) => l.startsWith('worktree '))?.slice(9) ?? ''
      const head = lines.find((l) => l.startsWith('HEAD '))?.slice(5) ?? ''
      const branch = lines.find((l) => l.startsWith('branch '))?.slice(7) ?? 'detached'
      const dirtyCount = worktreePath ? runCmdSafe('git status --short', worktreePath).split('\n').filter(Boolean).length : 0
      return {
        path: worktreePath,
        name: path.basename(worktreePath),
        head: head.slice(0, 8),
        branch: branch.replace('refs/heads/', ''),
        dirtyCount,
        isClaudeWorktree: worktreePath.includes('.claude/worktrees'),
      }
    })
}

function summarizeOutreach() {
  const logText = readTextSafe(path.join(BOARD_DIR, 'outreach-log.md'))
  const counts = { SENT: 0, BOUNCED: 0, AUTO_REPLY: 0, REPLY: 0, OPT_OUT: 0, FOLLOWUP_SENT: 0 }
  let lastTime = null
  const sentIds = new Set()
  for (const line of logText.split('\n')) {
    if (!line.startsWith('| 20')) continue
    const cols = line.split('|').map((s) => s.trim()).filter(Boolean)
    if (cols.length < 6) continue
    lastTime = cols[0]
    const action = cols[5]
    if (action in counts) counts[action]++
    if (action === 'SENT') sentIds.add(cols[2])
  }
  const wave2 = readJsonSafe(path.join(BOARD_DIR, 'outreach-wave2.json')) ?? []
  const pendingCount = Array.isArray(wave2) ? wave2.filter((t) => !sentIds.has(t.id)).length : 0
  return { counts, lastTime, pendingCount }
}

function summarizeFeedback() {
  const rawLines = readTextSafe(path.join(BOARD_DIR, 'live-feedback.jsonl'))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  let realCount = 0
  let testCount = 0
  for (const l of rawLines) {
    try {
      const row = JSON.parse(l)
      // 現行欄位是 source、browserFamily（伺服器寫入）；isTest、ua 只為相容舊紀錄。
      const family = String(row.browserFamily ?? row.ua ?? '')
      if (row.isTest || row.source !== 'web-form' || /HeadlessChrome|Playwright/i.test(family)) testCount++
      else realCount++
    } catch {
      // ignore malformed lines
    }
  }
  return { totalLines: rawLines.length, realCount, testCount }
}

export function collectOverview(dashboardPort = 4174) {
  const statusMd = readTextSafe(path.join(GOV_DIR, 'STATUS.md'))
  const protocolMd = readTextSafe(path.join(GOV_DIR, 'BOARD_PROTOCOL.md'))
  const promptsMd = readTextSafe(path.join(GOV_DIR, 'PROMPTS.md'))
  const relayMd = readTextSafe(path.join(BOARD_DIR, 'RELAY.md'))
  const handoff = readJsonSafe(path.join(BOARD_DIR, 'handoff-state.json')) ?? {}
  const finalReportMd = readTextSafe(path.join(BOARD_DIR, 'final-report.md'))
  const humanScoresMd = readTextSafe(path.join(BOARD_DIR, 'human-scores.md'))
  const deploymentMd = readTextSafe(path.join(BOARD_DIR, 'deployment.md'))

  const proposals = listMarkdownDir(path.join(GOV_DIR, 'proposals'), 'PROP-').map(parseProposal)
  const observerReports = listMarkdownDir(path.join(GOV_DIR, 'observer-reports'), 'OBS-').map(parseObserverReport)
  const boardDocs = listMarkdownDir(BOARD_DIR).filter(
    (d) => d.name !== 'outreach-targets.md' && d.name !== 'outreach-targets-mfg.md' && d.name !== 'outreach-targets-vendor.md',
  )
  const swarm = readJsonSafe(path.join(BOARD_DIR, 'swarm-snapshot.json')) ?? { members: [], messages: [], head: 0 }

  const gitStatusLines = runCmdSafe('git status --short').split('\n').filter(Boolean)
  const gitLogLines = runCmdSafe('git log -n 8 --pretty=format:"%h|%ad|%s" --date=short').split('\n').filter(Boolean)
  const origin4173Up = Boolean(runCmdSafe('lsof -ti :4173'))
  const dev5173Up = Boolean(runCmdSafe('lsof -ti :5173'))
  const cloudflaredRunning = Boolean(runCmdSafe('pgrep -f "cloudflared tunnel"'))

  const overview = {
    generatedAt: new Date().toISOString(),
    services: {
      dashboardPort,
      origin4173Up,
      dev5173Up,
      cloudflaredRunning,
      publicUrl: handoff.publicUrl || '',
      outreachPaused: Boolean(handoff.outreachPaused),
      outreachPausedAt: handoff.outreachPausedAt || '',
      fableBypassEnabled: protocolMd.includes('BYPASSED (Fable usage limit)'),
    },
    governance: {
      statusMd,
      statusSections: parseStatusSections(statusMd),
      protocolMd,
      promptsMd,
      proposals,
      observerReports,
    },
    relay: {
      relayMd,
      handoff,
      outreach: summarizeOutreach(),
      feedback: summarizeFeedback(),
      finalReportMd,
      humanScoresMd,
      deploymentMd,
    },
    swarm: {
      title: swarm.title || 'GreenMatch Swarm',
      snapshotAt: swarm.snapshotAt || '',
      head: swarm.head ?? 0,
      members: Array.isArray(swarm.members) ? swarm.members : [],
      messages: Array.isArray(swarm.messages) ? swarm.messages : [],
    },
    boardDocs,
    workspace: {
      gitStatusCount: gitStatusLines.length,
      gitStatusLines,
      gitLog: gitLogLines.map((l) => {
        const [hash, date, ...rest] = l.split('|')
        return { hash, date, message: rest.join('|') }
      }),
      worktrees: collectWorktrees(),
      recentFiles: collectRecentFiles(['docs/governance', 'docs/board', 'src', 'scripts', 'tests'], 30),
    },
  }
  overview.channel = collectBoardChannel()
  return overview
}

function nonEmptyLines(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

export function answerQuestion(rawQuery, overview) {
  const q = String(rawQuery || '').trim()
  const ql = q.toLowerCase()
  const props = overview.governance.proposals
  const obs = overview.governance.observerReports
  const latestProp = props[0]
  const latestObs = obs[0]
  const sec = overview.governance.statusSections
  const outreach = overview.relay.outreach
  const feedback = overview.relay.feedback
  const alive = overview.swarm.members.filter((m) => !m.killed)
  const pendingRulings = nonEmptyLines(sec.pendingUserRuling).filter((l) => !l.includes('（已拍板'))
  const readyForCeoLines = nonEmptyLines(sec.readyForCeo)

  const matchedMember = overview.swarm.members.find((m) => ql.includes(m.name.toLowerCase()))
  const asksFable = /fable|5\.2|提案|prop|雙簽|簽核|limit|繞過/.test(ql)
  const asksOpus = /opus|5\.5|obs|觀察|審查|審核|缺點|風險/.test(ql)
  const asksRuling = /拍板|決定|卡|block|等|缺|做什麼|next|下一步/.test(ql)
  const asksSwarm = Boolean(matchedMember) || /swarm|人員|團隊|工程師|對話|誰/.test(ql)
  const asksOutreach = /寄|外寄|信|mail|回饋|feedback|公開|4173|tunnel|網址/.test(ql)
  const asksFiles = /檔|改|git|commit|worktree/.test(ql)

  const bullets = []
  const nextActions = []
  const sources = []
  let intent = 'overall'
  let headline = ''

  if (matchedMember) {
    intent = `member:${matchedMember.name}`
    const memberMsgs = overview.swarm.messages.filter((m) => m.agent === matchedMember.name)
    const lastMsg = memberMsgs[memberMsgs.length - 1]
    headline = `@${matchedMember.name} 目前狀態：${matchedMember.killed ? 'killed（已結束）' : matchedMember.state}（模型：${matchedMember.model_display_name || matchedMember.model}）`
    bullets.push(`累計發言：${memberMsgs.length} 則；最後發言時間：${matchedMember.last_post_time || '無'}`)
    if (lastMsg) bullets.push(`最新發言 (#${lastMsg.seq})：${lastMsg.text.slice(0, 260)}${lastMsg.text.length > 260 ? '…' : ''}`)
    sources.push('docs/board/swarm-snapshot.json')
  } else if (asksFable && !asksOpus && !asksRuling) {
    intent = 'fable'
    headline = latestProp
      ? `Fable 5.2 最新動作：${latestProp.id} 目前為 ${latestProp.status}`
      : 'Fable 5.2 目前尚無進行中提案'
    if (latestProp) {
      bullets.push(`提案標題：${latestProp.title}（建立於 ${latestProp.createdAt}）`)
      bullets.push(`雙簽狀態：\n${latestProp.signOff}`)
      sources.push(latestProp.relPath)
    }
    bullets.push(
      overview.services.fableBypassEnabled
        ? '用量上限繞過規則：已生效（若 Fable 5.2 達 usage limit，Argon 可註記 BYPASSED (Fable usage limit) 後推進）。'
        : '用量上限繞過規則：未啟用。',
    )
    sources.push('docs/governance/BOARD_PROTOCOL.md', 'docs/governance/STATUS.md')
  } else if (asksOpus && !asksFable && !asksRuling) {
    intent = 'opus'
    headline = latestObs
      ? `Claude Opus 5.5 最新觀察報告：${latestObs.id}（建議：${latestObs.verdict}）`
      : 'Claude Opus 5.5 尚無觀察報告'
    if (latestObs) {
      bullets.push(`審查時間：${latestObs.reviewedAt}｜審查對象：${latestObs.target}`)
      for (const line of nonEmptyLines(latestObs.findingsSection).filter((l) => /^\d+\./.test(l)).slice(0, 6)) {
        bullets.push(line.replace(/\*\*/g, ''))
      }
      sources.push(latestObs.relPath)
    }
    bullets.push(`待複審狀態：${nonEmptyLines(sec.pendingObserver).join(' ') || '無'}`)
    sources.push('docs/governance/STATUS.md')
  } else if (asksRuling) {
    intent = 'rulings'
    headline = `目前共有 ${pendingRulings.length} 項待您拍板、${readyForCeoLines.length} 筆已雙簽提案待啟動`
    for (const line of pendingRulings) bullets.push(line)
    if (readyForCeoLines.length) bullets.push(`已雙簽可交辦：${readyForCeoLines.join(' ')}`)
    nextActions.push('確認後可直接告訴我您的拍板（例如 A3 抵稅不進合計 / B3 不存 IP / 提交方式），即可馬上交辦 CEO 執行（即使 Fable 額度滿也可依繞過條款直接推進）。')
    sources.push('docs/governance/STATUS.md')
  } else if (asksOutreach) {
    intent = 'outreach'
    headline = overview.services.outreachPaused
      ? `外寄狀態：⛔ 已暫停（於 ${overview.services.outreachPausedAt || '16:00'} 停發；待發 Batch 4–5 共 ${outreach.pendingCount} 封已鎖住）`
      : '外寄狀態：運行中'
    bullets.push(
      `信件累計：初邀 ${outreach.counts.SENT} 封、Batch 1 跟催 ${outreach.counts.FOLLOWUP_SENT} 封、退信 ${outreach.counts.BOUNCED} 封、自動回覆 ${outreach.counts.AUTO_REPLY} 封、真人回信 ${outreach.counts.REPLY} 封（最後寄出：${outreach.lastTime || '無'}）`,
    )
    bullets.push(`網頁一鍵回饋（live-feedback.jsonl）：真實人類 ${feedback.realCount} 筆（測試排除 ${feedback.testCount} 筆）`)
    bullets.push(
      `公開站服務：:4173 ${overview.services.origin4173Up ? 'LIVE' : 'DOWN'}｜Cloudflare Tunnel ${overview.services.cloudflaredRunning ? 'UP' : 'DOWN'}｜公開網址 ${overview.services.publicUrl || '未設定'}`,
    )
    sources.push('docs/board/outreach-log.md', 'docs/board/handoff-state.json', 'docs/board/live-feedback.jsonl')
  } else if (asksSwarm) {
    intent = 'swarm'
    headline = `Swarm 團隊：${alive.length} 位待命／運行中，${overview.swarm.members.length - alive.length} 位已結束（對話至 #${overview.swarm.head}）`
    bullets.push(`待命成員：${alive.map((m) => `@${m.name}(${m.state})`).join('、')}`)
    const latestMsgs = overview.swarm.messages.slice(-3).reverse()
    for (const m of latestMsgs) {
      bullets.push(`#${m.seq} [${m.time}] @${m.agent}：${m.text.slice(0, 140)}${m.text.length > 140 ? '…' : ''}`)
    }
    sources.push('docs/board/swarm-snapshot.json')
  } else if (asksFiles) {
    intent = 'files'
    headline = `工作區目前有 ${overview.workspace.gitStatusCount} 項未提交變更，${overview.workspace.worktrees.length} 個 Worktree`
    for (const f of overview.workspace.recentFiles.slice(0, 6)) {
      bullets.push(`${f.relPath}（${f.mtime.replace('T', ' ').slice(0, 19)}）`)
    }
    sources.push('git status', 'git worktree list')
  } else {
    intent = 'overall'
    headline = `${latestProp ? `${latestProp.id} 已雙簽 (${latestProp.status})` : '無待簽提案'} ｜ 外寄${overview.services.outreachPaused ? '已暫停 ⛔' : '運行中'} ｜ 現為 Round ${overview.relay.handoff.currentRound ?? '?'}`
    bullets.push(
      `治理雙簽（Fable 5.2 × Argon）：${latestProp ? `${latestProp.id} 為 ${latestProp.status}` : '無'}；${overview.services.fableBypassEnabled ? '已啟用 Fable usage limit 繞過條款' : '需雙簽'}`
    )
    bullets.push(
      `外部觀察者（Opus 5.5）：${latestObs ? `${latestObs.id} 建議 ${latestObs.verdict}（高/中/低共 10 項建議）` : '尚無報告'}`
    )
    bullets.push(
      `Swarm 執行端：Round ${overview.relay.handoff.currentRound ?? '?'} 線上（:4173 ${overview.services.origin4173Up ? 'LIVE' : 'DOWN'}）；${alive.length} 位成員待命中，@outreach 已 killed`
    )
    bullets.push(
      `外聯與回饋：已寄 ${outreach.counts.SENT} 初邀＋${outreach.counts.FOLLOWUP_SENT} 跟催（退信 ${outreach.counts.BOUNCED}）；Web 回饋 ${feedback.realCount} 筆；Batch 4–5（${outreach.pendingCount} 封）已停發`
    )
    bullets.push(`待您拍板：尚有 ${pendingRulings.filter((l) => !l.includes('（已拍板')).length} 項待裁示（見 STATUS.md）`)
    nextActions.push('接下來只差您拍板 PROP-0001 細項（尤其 A3 抵稅是否進合計、B3 是否存 IP／信箱）即可交辦 CEO 修正並由 Opus 5.5 複審。')
    sources.push('docs/governance/STATUS.md', 'docs/governance/BOARD_PROTOCOL.md', 'docs/board/handoff-state.json')
  }

  return {
    question: q || '現在進行到哪裡了？',
    answeredAt: new Date().toISOString(),
    intent,
    headline,
    bullets,
    nextActions,
    sources,
  }
}
