/**
 * 董事會巡檢（board watchdog）。
 *
 * 巡檢界線（PROP-0003 B，2026-11-13 Fable × Argon 雙簽）
 * ------------------------------------------------------------
 * 這支程式本身只讀取狀態並回報；唯一的寫入是 `--write` 時更新
 * `docs/board/watchdog-state.json`。任何依本報告行動的排程或代理
 * （含 Antigravity 的每 15 分鐘巡檢），自動處置只限兩件事：
 *   1. `:4173` 斷線（`origin-4173-down`）時，重啟 serve-prod：
 *      `node scripts/serve-prod-agent.mjs restart`（launchd 常駐，OBS-0004 §2-1）。
 *      不得停止或重啟 `cloudflared`。`:4173` 被別的行程占住（`origin-4173-foreign-listener`）
 *      只回報，不得自動停掉對方。
 *   2. 把異常寫進 `docs/governance/STATUS.md`。
 * 其餘一律只回報、不處置。明確禁止：
 *   - 自動 `npm run build` 或把新版上線（`dist-stale`、`dist-missing` 只回報）。
 *   - 修改 `src/`。
 *   - 任何 git 寫入（commit、push、刪分支、刪 worktree）。
 *   - 寄信，或讀寫 Gmail。
 * 新版上線由 CEO 在 `npm run check` 通過後執行（BOARD_PROTOCOL L1），巡檢不代勞。
 *
 * 每筆 finding 的 `autoFixable` 就是這條界線：只有 `AUTO_FIXABLE_IDS`
 * 列出的項目為 true，測試見 `board-watchdog.test.mjs`。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ROOT, collectOverview, readJsonSafe } from './ops-core.mjs'
import { inspectPeerHealth } from './peer-health.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_PATH = path.join(ROOT, 'docs', 'board', 'watchdog-state.json')

/** 巡檢可以自動處置的 finding。其餘只回報（見檔頭「巡檢界線」）。 */
export const AUTO_FIXABLE_IDS = Object.freeze(['origin-4173-down'])

function runSafe(cmd, cwd = ROOT) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', timeout: 4000 }).trim()
  } catch {
    return ''
  }
}

function newestSourceMtimeMs(root = ROOT) {
  let latest = 0
  const targets = [path.join(root, 'index.html'), path.join(root, 'src')]
  const visit = (p) => {
    if (!fs.existsSync(p)) return
    const st = fs.statSync(p)
    if (st.isFile()) {
      if (st.mtimeMs > latest) latest = st.mtimeMs
      return
    }
    if (st.isDirectory()) {
      for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue
        visit(path.join(p, entry.name))
      }
    }
  }
  for (const t of targets) visit(t)
  return latest
}

function probeOriginHealth() {
  const out = runSafe('curl -s -m 2 http://127.0.0.1:4173/api/health')
  if (!out) return 'DOWN'
  if (out.includes('"ok":true')) return 'UP'
  if (/Direct IP access is not allowed|Access denied/i.test(out)) return 'SANDBOX_RESTRICTED'
  return 'DOWN'
}

/**
 * 解析 `lsof -nP -iTCP:4173 -sTCP:LISTEN -F pcn` 的輸出。
 * @returns {{ pid: number, command: string, address: string }[]}
 */
export function parseLsofListeners(output) {
  const listeners = []
  let pid = null
  let command = ''
  for (const line of String(output ?? '').split('\n')) {
    const tag = line[0]
    const value = line.slice(1).trim()
    if (tag === 'p') {
      pid = Number(value)
      command = ''
    } else if (tag === 'c') {
      command = value
    } else if (tag === 'n' && pid !== null) {
      listeners.push({ pid, command, address: value })
    }
  }
  return listeners
}

/** 只有 node 而且只聽 127.0.0.1 才算正常；其他（非 node、`*:4173`、IPv6、區網 IP）都是 finding。 */
export function foreignOriginListeners(listeners) {
  return (listeners ?? []).filter((l) => l.command !== 'node' || !/^127\.0\.0\.1:\d+$/.test(l.address))
}

function probeOriginListeners() {
  return parseLsofListeners(runSafe('lsof -nP -iTCP:4173 -sTCP:LISTEN -F pcn'))
}

export function collectWatchdogExtras(root = ROOT) {
  const remotes = runSafe('git remote', root).split('\n').map((s) => s.trim()).filter(Boolean)
  const currentBranch = runSafe('git rev-parse --abbrev-ref HEAD', root) || 'unknown'
  const headCommit = runSafe('git rev-parse --short HEAD', root) || 'unknown'
  const extraBranches = runSafe('git branch --format="%(refname:short)|%(objectname:short)"', root)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, commit] = line.split('|')
      return { name, commit }
    })
    .filter((b) => b.name && b.name !== 'main')

  const distPath = path.join(root, 'dist', 'index.html')
  const distExists = fs.existsSync(distPath)
  const distMtimeMs = distExists ? fs.statSync(distPath).mtimeMs : 0
  const latestSrcMtimeMs = newestSourceMtimeMs(root)
  const prevState = readJsonSafe(STATE_PATH)

  return {
    remotes,
    currentBranch,
    headCommit,
    extraBranches,
    distExists,
    distMtimeMs,
    latestSrcMtimeMs,
    originProbe: probeOriginHealth(),
    originListeners: probeOriginListeners(),
    lastSeenRealFeedback: prevState?.metrics?.realFeedback ?? 0,
  }
}

export function auditBoardHealth(overview, extra) {
  const findings = []
  const gitStatusCount = overview.workspace?.gitStatusCount ?? 0
  const worktrees = overview.workspace?.worktrees ?? []
  const proposals = overview.governance?.proposals ?? []
  const observerReports = overview.governance?.observerReports ?? []
  const pendingObsText = overview.governance?.statusSections?.pendingObserver ?? ''
  const realFeedback = overview.relay?.feedback?.realCount ?? 0
  const outreachPaused = Boolean(overview.services?.outreachPaused)
  const relayPaused = /OUTREACH PAUSED/i.test(overview.relay?.relayMd ?? '')

  if (gitStatusCount > 0) {
    findings.push({
      id: 'dirty-tree',
      severity: gitStatusCount >= 15 ? 'high' : 'medium',
      title: `工作區有 ${gitStatusCount} 項未提交變更`,
      detail: '未 commit 的程式與文件若發生誤操作會遺失，且 dist 無法自 git 歷史重現。',
      autoFixable: true,
      owner: 'board',
    })
  }

  if (!extra.remotes || extra.remotes.length === 0) {
    findings.push({
      id: 'no-git-remote',
      severity: 'high',
      title: '缺少 git remote 遠端備份',
      detail: '目前 git remote 為空；需由使用者完成 GitHub 登入（gh auth login）或指定私有遠端 URL 並 push。',
      autoFixable: false,
      owner: 'user',
    })
  }

  if (worktrees.length > 1) {
    findings.push({
      id: 'stale-worktrees',
      severity: 'medium',
      title: `存在 ${worktrees.length - 1} 個額外 worktree`,
      detail: worktrees
        .filter((w) => w.branch !== 'main')
        .map((w) => `${w.name}(${w.branch}, dirty:${w.dirtyCount})`)
        .join('、'),
      autoFixable: true,
      owner: 'board',
    })
  }

  if (extra.extraBranches && extra.extraBranches.length > 0) {
    findings.push({
      id: 'stale-branches',
      severity: 'low',
      title: `存在 ${extra.extraBranches.length} 個非 main 分支`,
      detail: extra.extraBranches.map((b) => `${b.name}@${b.commit}`).join('、'),
      autoFixable: true,
      owner: 'board',
    })
  }

  if (!extra.distExists) {
    findings.push({
      id: 'dist-missing',
      severity: 'high',
      title: '缺少 dist/index.html 建置產物',
      detail: '公開站與 single-file 產物不存在。巡檢只回報；由 CEO 執行 npm run check 與 npm run build。',
      autoFixable: true,
      owner: 'ceo',
    })
  } else if (extra.latestSrcMtimeMs > extra.distMtimeMs + 1000) {
    findings.push({
      id: 'dist-stale',
      severity: 'high',
      title: 'dist/index.html 落後於 src/ 原始碼',
      detail: '有較新的原始碼尚未重新建置到 dist/。巡檢只回報、不自動建置上線；由 CEO 執行 npm run check，通過後 npm run build 上線（L1，不需提案）。',
      autoFixable: true,
      owner: 'ceo',
    })
  }

  for (const p of proposals) {
    if (p.status === 'APPROVED_READY_FOR_CEO') {
      findings.push({
        id: `ready-prop:${p.id}`,
        severity: 'high',
        title: `${p.id} 已核可，待 CEO 執行`,
        detail: p.title,
        autoFixable: true,
        owner: 'ceo',
      })
    } else if (p.status === 'DISCUSSING') {
      findings.push({
        id: `discussing-prop:${p.id}`,
        severity: 'medium',
        title: `${p.id} 尚在雙董事長討論中`,
        detail: `${p.title}（若 Fable 達 usage limit，Argon 可依繞過條款推進）`,
        autoFixable: false,
        owner: 'board',
      })
    }
  }

  const latestDoneProp = proposals.find((p) => p.status === 'DONE')
  const latestObs = observerReports[0]
  const waitingObsInStatus = /READY FOR REVIEW/i.test(pendingObsText)
  if (waitingObsInStatus || (latestDoneProp && (!latestObs || latestDoneProp.mtime > latestObs.mtime))) {
    findings.push({
      id: 'pending-observer-review',
      severity: 'medium',
      title: '等待外部觀察者（Claude Opus 5.5）複審',
      detail: latestDoneProp
        ? `${latestDoneProp.id} 已完工，尚待 Opus 5.5 執行 /observer-review 產出下一份 OBS 報告。`
        : 'STATUS.md 標記待觀察者審查。',
      autoFixable: false,
      owner: 'opus',
    })
  }

  if (realFeedback > (extra.lastSeenRealFeedback ?? 0)) {
    findings.push({
      id: 'new-real-feedback',
      severity: 'medium',
      title: `收到新真實人類網頁回饋（累計 ${realFeedback} 筆）`,
      detail: '請啟動獨立評分寫入 docs/board/human-scores.md，並檢視是否需開立新一輪產品改善提案。',
      autoFixable: true,
      owner: 'board',
    })
  }

  if (outreachPaused !== relayPaused) {
    findings.push({
      id: 'outreach-pause-drift',
      severity: 'high',
      title: '外寄暫停旗標與 RELAY.md 不一致',
      detail: `handoff-state.outreachPaused=${outreachPaused}，RELAY.md=${relayPaused}`,
      autoFixable: true,
      owner: 'board',
    })
  }

  if (extra.originProbe === 'DOWN') {
    findings.push({
      id: 'origin-4173-down',
      severity: 'high',
      title: '本機公開站來源 :4173 未回應',
      detail: '請僅執行 node scripts/serve-prod-agent.mjs restart（launchd 常駐；勿中斷 cloudflared）。',
      autoFixable: true,
      owner: 'deployer',
    })
  }

  const foreign = foreignOriginListeners(extra.originListeners)
  if (foreign.length > 0) {
    findings.push({
      id: 'origin-4173-foreign-listener',
      severity: 'high',
      title: ':4173 被非 serve-prod 或非本機位址的行程占用',
      detail: `${foreign.map((l) => `${l.command} pid ${l.pid} ${l.address}`).join('；')}。只應有 node 聽 127.0.0.1:4173；請 CEO 查明後處理，巡檢不得自動停掉對方。`,
      autoFixable: false,
      owner: 'deployer',
    })
  }

  const peerHealth = extra.peerHealth ?? { status: 'unknown' }
  if (peerHealth.status === 'rate_limited') {
    findings.push({
      id: 'peer-fable-rate-limited',
      severity: 'medium',
      title: `Fable 已觸及 usage limit${peerHealth.resetText ? `（${peerHealth.resetText}）` : ''}`,
      detail: `${peerHealth.reason}；未完成提案依 BOARD_PROTOCOL.md 可由 Argon 接手推進或註記 BYPASSED (Fable usage limit)。`,
      autoFixable: false,
      owner: 'board',
    })
  } else if (peerHealth.status === 'offline_unresponsive') {
    findings.push({
      id: 'peer-fable-unresponsive',
      severity: 'medium',
      title: 'Fable wait 監聽未運行且尚未回覆',
      detail: peerHealth.reason,
      autoFixable: false,
      owner: 'board',
    })
  }

  // 巡檢界線：不論上面各項怎麼標，只有 AUTO_FIXABLE_IDS 內的項目可以自動處置。
  for (const f of findings) {
    f.autoFixable = AUTO_FIXABLE_IDS.includes(f.id)
  }

  const hasHigh = findings.some((f) => f.severity === 'high')
  const status = findings.length === 0 ? 'OK' : hasHigh ? 'ACTION_NEEDED' : 'WARN'

  return {
    checkedAt: new Date().toISOString(),
    status,
    branch: extra.currentBranch,
    head: extra.headCommit,
    originProbe: extra.originProbe,
    originListeners: extra.originListeners ?? [],
    metrics: {
      gitStatusCount,
      remotesCount: extra.remotes?.length ?? 0,
      worktreesCount: worktrees.length,
      extraBranchesCount: extra.extraBranches?.length ?? 0,
      realFeedback,
      outreachPaused,
    },
    findings,
  }
}

export function formatWatchdogSummary(report) {
  const lines = [
    `[GreenMatch Watchdog] ${report.status} | branch=${report.branch}@${report.head} | origin4173=${report.originProbe}`,
    `metrics: dirty=${report.metrics.gitStatusCount}, remotes=${report.metrics.remotesCount}, worktrees=${report.metrics.worktreesCount}, extraBranches=${report.metrics.extraBranchesCount}, realFeedback=${report.metrics.realFeedback}, outreachPaused=${report.metrics.outreachPaused}`,
  ]
  if (report.findings.length === 0) {
    lines.push('No issues detected.')
  } else {
    for (const f of report.findings) {
      const action = f.autoFixable ? '可自動處置' : '只回報'
      lines.push(`- [${f.severity.toUpperCase()}] (${f.owner}, ${action}) ${f.id}: ${f.title} — ${f.detail}`)
    }
  }
  return lines.join('\n')
}

export function runWatchdog({ writeState = false } = {}) {
  const overview = collectOverview()
  const extras = {
    ...collectWatchdogExtras(ROOT),
    peerHealth: inspectPeerHealth({ rootDir: ROOT }),
  }
  const report = auditBoardHealth(overview, extras)
  if (writeState) {
    fs.writeFileSync(STATE_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  }
  return report
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  const args = new Set(process.argv.slice(2))
  const report = runWatchdog({ writeState: args.has('--write') })
  if (args.has('--json')) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(formatWatchdogSummary(report))
  }
  if (args.has('--strict') && report.status === 'ACTION_NEEDED') {
    process.exitCode = 1
  }
}
