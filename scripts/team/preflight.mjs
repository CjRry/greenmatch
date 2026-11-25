// Check that the Paperclip team can actually run before dispatching work.
//
//   node scripts/team/preflight.mjs              read-only checks
//   node scripts/team/preflight.mjs --fix        also resume errored agents and re-apply the agent template
//   node scripts/team/preflight.mjs --smoke      then send each agent a one-line task, one at a time
//   node scripts/team/preflight.mjs --smoke qa   ...only the named area(s), comma-separated
//
// Exits 1 when any check fails. Smoke tasks cost one short agent run each.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { AREAS, COMPANY, TEAM, TEMPLATE, agentIdOf, api, items, parseArgs, sleep, versionAtLeast } from './lib.mjs'
import { decide } from '../guard-ownership.mjs'

const args = parseArgs()
const results = []
const report = (level, name, detail = '') => {
  results.push({ level, name, detail })
  console.log(`${level.padEnd(4)}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const sh = (cmd, argv) => {
  try {
    return execFileSync(cmd, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

// 1. Server
try {
  const health = await api('GET', '/api/health')
  report(health?.status === 'ok' ? 'OK' : 'FAIL', 'Paperclip server', `${health?.status} ${health?.version ?? ''}`)
} catch (e) {
  report('FAIL', 'Paperclip server', e.message)
  process.exit(1)
}

// 2. Agents (read first; later checks depend on their config)
const agents = []
for (const id of Object.keys(AREAS)) {
  try {
    agents.push(await api('GET', `/api/agents/${id}`))
  } catch (e) {
    report('FAIL', `agent ${AREAS[id].area}`, e.message)
  }
}

// 3. The server process can find `claude` (or every agent has an absolute command)
const allAbsolute = agents.length > 0 && agents.every((a) => a.adapterConfig?.command?.startsWith('/'))
const pid = sh('lsof', ['-nP', '-t', `-iTCP:${TEAM.serverPort}`, '-sTCP:LISTEN']).split('\n')[0]
const serverPath = (sh('ps', ['eww', '-o', 'command=', '-p', pid]).match(/(?:^|\s)PATH=(\S+)/) ?? [])[1] ?? ''
const claudeDir = serverPath.split(':').find((d) => d && existsSync(join(d, 'claude')))
if (allAbsolute) report('OK', 'claude command', 'every agent has an absolute command')
else if (claudeDir) report('OK', 'claude on the server PATH', `${claudeDir}/claude (lost if \`paperclipai install\` rewrites the service file)`)
else
  report(
    'FAIL',
    'claude on the server PATH',
    'the Paperclip service cannot find `claude`; re-add PATH to ~/Library/LaunchAgents/ing.paperclip.paperclipai.plist or set an absolute command per agent (board access)',
  )

// 4. Local Claude CLI new enough for every model in use
const cliVersion = (sh('claude', ['--version']).match(/\d+\.\d+\.\d+/) ?? [])[0]
const models = [...new Set(agents.map((a) => a.adapterConfig?.model).filter(Boolean))]
if (!cliVersion) report('FAIL', 'Claude CLI', '`claude --version` did not answer')
for (const m of models) {
  const min = TEAM.minClaudeCli[m]
  if (cliVersion && min) report(versionAtLeast(cliVersion, min) ? 'OK' : 'FAIL', `Claude CLI for ${m}`, `${cliVersion} (needs ${min})`)
}

// 5. Workspace and project policy
const gitOk = existsSync(join(TEAM.workspaceCwd, '.git'))
report(gitOk ? 'OK' : 'FAIL', 'workspace is a git repo', TEAM.workspaceCwd)
const project = items(await api('GET', '/api/companies/{c}/projects'), 'projects').find((p) => p.id === TEAM.projectId)
const policy = project?.executionWorkspacePolicy ?? {}
report(
  policy.defaultMode === 'shared_workspace' && policy.sharedWorkspaceConcurrency === 'allow' ? 'OK' : 'WARN',
  'project runs agents in parallel in one folder',
  `${policy.defaultMode ?? '?'} / ${policy.sharedWorkspaceConcurrency ?? '?'}`,
)

// 6. Each agent: state and drift from the template
const drift = (a) => {
  const out = []
  for (const [k, v] of Object.entries(TEMPLATE.adapterConfig)) if (a.adapterConfig?.[k] !== v) out.push(`${k}=${a.adapterConfig?.[k]}`)
  for (const [k, v] of Object.entries(TEMPLATE.runtimeConfig.heartbeat)) if (a.runtimeConfig?.heartbeat?.[k] !== v) out.push(`heartbeat.${k}=${a.runtimeConfig?.heartbeat?.[k]}`)
  return out
}
for (const a of agents) {
  const area = AREAS[a.id].area
  const problems = drift(a)
  if (args.fix && problems.length) {
    await api('PATCH', `/api/agents/${a.id}`, { adapterConfig: TEMPLATE.adapterConfig, runtimeConfig: TEMPLATE.runtimeConfig })
    report('FIX', `agent ${area}`, `applied template (was ${problems.join(', ')})`)
    problems.length = 0
  }
  if (args.fix && a.status === 'error') {
    await api('POST', `/api/agents/${a.id}/resume`, {})
    report('FIX', `agent ${area}`, 'resumed after an errored run')
    a.status = 'idle'
  }
  const level = a.lifecycleState !== 'ready' || ['paused', 'pending_approval', 'terminated'].includes(a.status) || problems.length ? 'FAIL' : a.status === 'error' ? 'WARN' : 'OK'
  const notes = [
    `${a.status}/${a.lifecycleState}`,
    problems.length ? `differs from template: ${problems.join(', ')} (run with --fix)` : '',
    a.status === 'error' ? 'last run failed (run with --fix to resume)' : '',
  ]
  report(level, `agent ${area}`, notes.filter(Boolean).join('; '))
}
try {
  const ceo = await api('GET', `/api/agents/${TEAM.ceoAgentId}`)
  report('INFO', 'CEO identity', `${ceo.status}${ceo.status === 'paused' ? ' (expected: the CEO works from the chat)' : ''}`)
} catch {
  // The CEO identity is optional for these checks.
}

// 7. Ownership guard still behaves
const g = (command) => decide({ tool: 'Bash', input: { command }, cwd: TEAM.workspaceCwd, area: 'market', projectDir: TEAM.workspaceCwd })
const guardOk = g("cat > src/features/market/a.ts <<'EOF'\nconst f = () => 1\nEOF").allow && !g('echo x > src/core/types.ts').allow && !g('npm run check:market &').allow
report(guardOk ? 'OK' : 'FAIL', 'ownership guard', guardOk ? 'allows area writes, blocks shared files and background jobs' : 'unexpected decisions; run npx vitest run scripts')

// 8. Tasks held by a run that already ended (they block bookkeeping until Paperclip recovers them)
for (const issue of items(await api('GET', '/api/companies/{c}/issues'), 'issues')) {
  if (!issue.checkoutRunId || ['done', 'cancelled'].includes(issue.status)) continue
  try {
    const run = await api('GET', `/api/heartbeat-runs/${issue.checkoutRunId}`)
    if (!['running', 'queued', 'scheduled_retry'].includes(run.status)) report('WARN', `${issue.identifier} lock`, `held by a ${run.status} run`)
  } catch {
    // Run records can be pruned; nothing to report then.
  }
}

// 9. Smoke test: one tiny task per agent, one at a time
if (args.smoke) {
  const wanted = args.smoke === true ? Object.values(AREAS).map((x) => x.area) : String(args.smoke).split(',')
  for (const area of wanted) {
    const id = agentIdOf(area)
    if (!id) {
      report('FAIL', `smoke ${area}`, 'no agent with that area')
      continue
    }
    const issue = await api('POST', '/api/companies/{c}/issues', {
      projectId: TEAM.projectId,
      goalId: TEAM.goalId,
      title: `Preflight 測試：${area}`,
      description:
        '這是啟動前的連線測試，不要修改任何檔案。\n\n1. 執行 `claude --version` 與 `git status --short | head -3`。\n2. 留一則留言，貼上兩個指令的輸出。\n3. 把本任務標為 done。',
      assigneeAgentId: id,
      status: 'todo',
      priority: 'low',
    })
    const started = Date.now()
    let state = issue.status
    while (!['done', 'blocked', 'cancelled'].includes(state) && Date.now() - started < 6 * 60_000) {
      await sleep(10_000)
      state = (await api('GET', `/api/issues/${issue.id}`)).status
    }
    const runs = items(await api('GET', '/api/companies/{c}/heartbeat-runs'), 'runs').filter((r) => r.agentId === id)
    const last = runs.sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1))[0]
    const secs = Math.round((Date.now() - started) / 1000)
    report(state === 'done' ? 'OK' : 'FAIL', `smoke ${area}`, `${issue.identifier} ${state} in ${secs}s; last run ${last?.status ?? '?'} ${last?.error ?? ''}`.trim())
    if (/session limit|usage limit|limit failure/i.test(last?.error ?? '')) {
      report('FAIL', 'usage limit reached', 'stopping the smoke test; retry after the limit resets')
      break
    }
  }
}

const failed = results.filter((r) => r.level === 'FAIL').length
console.log(`\n${failed ? `${failed} check(s) failed` : 'Ready to dispatch'} (company ${COMPANY.slice(0, 8)})`)
process.exit(failed ? 1 : 0)
