import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AUTO_FIXABLE_IDS,
  auditBoardHealth,
  foreignOriginListeners,
  formatWatchdogSummary,
  parseLsofListeners,
} from './board-watchdog.mjs'
import { buildServeProdPlist } from './serve-prod-agent.mjs'

function baseOverview(overrides = {}) {
  return {
    services: { outreachPaused: true },
    governance: {
      proposals: [{ id: 'PROP-0001', title: 'Fix blockers', status: 'DONE', mtime: '2026-11-13T08:50:00Z' }],
      observerReports: [{ id: 'OBS-0001', mtime: '2026-11-13T07:56:00Z' }],
      statusSections: { pendingObserver: '' },
    },
    relay: {
      relayMd: '## OUTREACH PAUSED',
      feedback: { realCount: 0 },
    },
    workspace: {
      gitStatusCount: 0,
      worktrees: [{ path: '/repo', name: 'ESCO', branch: 'main', dirtyCount: 0 }],
    },
    ...overrides,
  }
}

function baseExtras(overrides = {}) {
  return {
    remotes: ['origin'],
    currentBranch: 'main',
    headCommit: 'abc1234',
    extraBranches: [],
    distExists: true,
    distMtimeMs: 20000,
    latestSrcMtimeMs: 10000,
    originProbe: 'UP',
    lastSeenRealFeedback: 0,
    ...overrides,
  }
}

describe('board-watchdog auditBoardHealth', () => {
  it('returns OK when repo, remote, build, and governance are clean and caught up', () => {
    const overview = baseOverview({
      governance: {
        proposals: [{ id: 'PROP-0001', title: 'Fix', status: 'DONE', mtime: '2026-11-13T08:50:00Z' }],
        observerReports: [{ id: 'OBS-0002', mtime: '2026-11-13T09:00:00Z' }],
        statusSections: { pendingObserver: '' },
      },
    })
    const report = auditBoardHealth(overview, baseExtras())
    expect(report.status).toBe('OK')
    expect(report.findings).toHaveLength(0)
  })

  it('flags dirty tree, missing remote, stale worktrees, extra branches, and stale dist', () => {
    const report = auditBoardHealth(
      baseOverview({
        workspace: {
          gitStatusCount: 20,
          worktrees: [
            { path: '/repo', name: 'ESCO', branch: 'main', dirtyCount: 20 },
            { path: '/wt1', name: 'wt1', branch: 'old-branch', dirtyCount: 0 },
          ],
        },
      }),
      baseExtras({
        remotes: [],
        extraBranches: [{ name: 'old-branch', commit: '7e42e86' }],
        distMtimeMs: 10000,
        latestSrcMtimeMs: 25000,
        originProbe: 'SANDBOX_BLOCKED',
      }),
    )

    expect(report.status).toBe('ACTION_NEEDED')
    const ids = report.findings.map((f) => f.id)
    expect(ids).toContain('dirty-tree')
    expect(ids).toContain('no-git-remote')
    expect(ids).toContain('stale-worktrees')
    expect(ids).toContain('stale-branches')
    expect(ids).toContain('dist-stale')
    expect(ids).toContain('pending-observer-review')
    expect(ids).not.toContain('origin-4173-down')
  })

  it('detects new real feedback, ready CEO proposals, and origin down', () => {
    const report = auditBoardHealth(
      baseOverview({
        governance: {
          proposals: [{ id: 'PROP-0002', title: 'Commit plan', status: 'APPROVED_READY_FOR_CEO', mtime: '2026-11-13T09:10:00Z' }],
          observerReports: [{ id: 'OBS-0002', mtime: '2026-11-13T09:20:00Z' }],
          statusSections: { pendingObserver: '' },
        },
        relay: {
          relayMd: '## OUTREACH PAUSED',
          feedback: { realCount: 2 },
        },
      }),
      baseExtras({
        originProbe: 'DOWN',
        lastSeenRealFeedback: 0,
      }),
    )

    const ids = report.findings.map((f) => f.id)
    expect(ids).toContain('ready-prop:PROP-0002')
    expect(ids).toContain('new-real-feedback')
    expect(ids).toContain('origin-4173-down')
    expect(formatWatchdogSummary(report)).toContain('ACTION_NEEDED')
  })
})

describe('board-watchdog 巡檢界線（PROP-0003 B）', () => {
  it('dist-stale 只回報不處置：autoFixable 為 false，說明不叫巡檢自己 build', () => {
    const report = auditBoardHealth(
      baseOverview(),
      baseExtras({ distMtimeMs: 10000, latestSrcMtimeMs: 25000 }),
    )
    const stale = report.findings.find((f) => f.id === 'dist-stale')
    expect(stale).toBeDefined()
    expect(stale.autoFixable).toBe(false)
    expect(stale.detail).toContain('只回報')
    expect(formatWatchdogSummary(report)).toMatch(/只回報\) dist-stale/)
  })

  it('dist-missing 也只回報不處置', () => {
    const report = auditBoardHealth(baseOverview(), baseExtras({ distExists: false }))
    const missing = report.findings.find((f) => f.id === 'dist-missing')
    expect(missing.autoFixable).toBe(false)
  })

  it('唯一可自動處置的是 :4173 斷線（重啟 serve-prod.mjs）', () => {
    expect([...AUTO_FIXABLE_IDS]).toEqual(['origin-4173-down'])
    const report = auditBoardHealth(
      baseOverview({
        governance: {
          proposals: [{ id: 'PROP-0009', title: 'x', status: 'APPROVED_READY_FOR_CEO', mtime: '2026-11-13T09:10:00Z' }],
          observerReports: [{ id: 'OBS-0002', mtime: '2026-11-13T09:20:00Z' }],
          statusSections: { pendingObserver: '' },
        },
        relay: { relayMd: '', feedback: { realCount: 3 } },
        workspace: {
          gitStatusCount: 20,
          worktrees: [
            { path: '/repo', name: 'ESCO', branch: 'main', dirtyCount: 20 },
            { path: '/wt1', name: 'wt1', branch: 'old', dirtyCount: 0 },
          ],
        },
      }),
      baseExtras({
        remotes: [],
        extraBranches: [{ name: 'old', commit: '7e42e86' }],
        distMtimeMs: 10000,
        latestSrcMtimeMs: 25000,
        originProbe: 'DOWN',
      }),
    )
    const auto = report.findings.filter((f) => f.autoFixable).map((f) => f.id)
    expect(auto).toEqual(['origin-4173-down'])
    expect(report.findings.length).toBeGreaterThan(5)
  })

  it('檔頭寫明界線：不 build 上線、不改 src、不做 git 寫入、不寄信或碰 Gmail、不動 cloudflared', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'scripts', 'board-watchdog.mjs'), 'utf8')
    const header = source.slice(0, source.indexOf("import fs from 'node:fs'"))
    for (const phrase of ['npm run build', '修改 `src/`', 'git 寫入', 'Gmail', 'cloudflared', 'STATUS.md']) {
      expect(header).toContain(phrase)
    }
  })

  it(':4173 只允許 node 聽 127.0.0.1；非 node 或 *:4173 是只回報的 finding（OBS-0004 §2-1）', () => {
    const lsof = 'p67183\ncPython\nn*:4173\np54667\ncnode\nn127.0.0.1:4173\n'
    const listeners = parseLsofListeners(lsof)
    expect(listeners).toEqual([
      { pid: 67183, command: 'Python', address: '*:4173' },
      { pid: 54667, command: 'node', address: '127.0.0.1:4173' },
    ])
    expect(foreignOriginListeners(listeners).map((l) => l.pid)).toEqual([67183])
    expect(foreignOriginListeners([{ pid: 1, command: 'node', address: '*:4173' }])).toHaveLength(1)

    const report = auditBoardHealth(baseOverview(), baseExtras({ originListeners: listeners }))
    const item = report.findings.find((f) => f.id === 'origin-4173-foreign-listener')
    expect(item?.severity).toBe('high')
    expect(item?.autoFixable).toBe(false)
    expect(item?.detail).toContain('Python pid 67183 *:4173')

    const clean = auditBoardHealth(
      baseOverview(),
      baseExtras({ originListeners: [{ pid: 2, command: 'node', address: '127.0.0.1:4173' }] }),
    )
    expect(clean.findings.find((f) => f.id === 'origin-4173-foreign-listener')).toBeUndefined()
  })

  it('serve-prod 的 launchd plist：KeepAlive、RunAtLoad、只跑 serve-prod.mjs，不碰 cloudflared', () => {
    const plist = buildServeProdPlist({ nodePath: '/opt/node', rootDir: '/repo', logDir: '/logs' })
    expect(plist).toContain('<string>com.greenmatch.serve-prod</string>')
    expect(plist).toMatch(/<key>KeepAlive<\/key>\s*<true\/>/)
    expect(plist).toMatch(/<key>RunAtLoad<\/key>\s*<true\/>/)
    expect(plist).toContain('<string>/repo/scripts/serve-prod.mjs</string>')
    expect(plist).not.toContain('cloudflared')
    const server = fs.readFileSync(path.resolve(process.cwd(), 'scripts', 'serve-prod.mjs'), 'utf8')
    expect(server).toContain("const HOST = '127.0.0.1'")
  })

  it('自動偵測 Fable usage limit（peerHealth=rate_limited 只回報不自動修改程式碼）', () => {
    const report = auditBoardHealth(
      baseOverview(),
      baseExtras({
        peerHealth: {
          status: 'rate_limited',
          resetText: 'resets 9:50pm (Asia/Taipei)',
          reason: 'Claude Code 回報 rate_limit',
        },
      }),
    )
    const item = report.findings.find((f) => f.id === 'peer-fable-rate-limited')
    expect(item).toBeDefined()
    expect(item?.autoFixable).toBe(false)
    expect(item?.title).toContain('resets 9:50pm')
  })
})
