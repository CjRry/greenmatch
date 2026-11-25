// What really happened in recent agent runs. Paperclip's own status can say `cancelled` for a run that
// finished its work, so this reads the run record and gives a plain verdict instead.
//
//   node scripts/team/runs.mjs               the last 30 runs
//   node scripts/team/runs.mjs --last 100
import { api, areaOf, items, parseArgs } from './lib.mjs'

const args = parseArgs()
const last = Number(args.last ?? 30)

function verdict(run) {
  const r = run.resultJson ?? {}
  const err = run.error ?? ''
  if (run.status === 'succeeded') return 'ok'
  if (r.unmanagedBackgroundTask?.stopped) return 'background job killed at end of turn'
  if (/session limit|limit failure/i.test(err)) return 'usage limit'
  if (/requires Claude Code/i.test(err)) return 'Claude CLI version check failed'
  if (/git workspace/i.test(err)) return 'workspace is not a git repo'
  if (/lifecycle stop/i.test(err)) return 'stopped: agent paused'
  if (run.status === 'cancelled' && run.exitCode === 0 && r.terminal_reason === 'completed') return 'finished (labelled cancelled)'
  if (r.cancellation?.source === 'provider') return 'stopped by the engine'
  return err.split('\n')[0].slice(0, 60) || run.status
}

const runs = items(await api('GET', '/api/companies/{c}/heartbeat-runs'), 'runs')
  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  .slice(0, last)

const rows = []
for (const r of runs) rows.push(await api('GET', `/api/heartbeat-runs/${r.id}`))

const pad = (s, n) => String(s).slice(0, n).padEnd(n)
console.log(`${pad('started', 17)}${pad('agent', 11)}${pad('status', 11)}${pad('verdict', 40)}${pad('blocked', 8)}cost`)
const perAgent = {}
const perVerdict = {}
for (const r of rows) {
  const who = areaOf(r.agentId) ?? r.agentId.slice(0, 8)
  const v = verdict(r)
  const cost = r.usageJson?.costUsd ?? 0
  const denied = r.resultJson?.permission_denials?.length ?? 0
  const when = (r.startedAt ?? r.createdAt ?? '').replace('T', ' ').slice(0, 16)
  console.log(`${pad(when, 17)}${pad(who, 11)}${pad(r.status, 11)}${pad(v, 40)}${pad(denied || '', 8)}$${cost.toFixed(2)}`)
  perAgent[who] = perAgent[who] ?? { runs: 0, cost: 0 }
  perAgent[who].runs++
  perAgent[who].cost += cost
  perVerdict[v] = (perVerdict[v] ?? 0) + 1
}

console.log('\nBy agent (cost at list price; a subscription may cover it):')
for (const [who, s] of Object.entries(perAgent)) console.log(`  ${pad(who, 11)}${pad(`${s.runs} runs`, 9)}$${s.cost.toFixed(2)}`)
console.log('\nBy verdict:')
for (const [v, n] of Object.entries(perVerdict).sort((a, b) => b[1] - a[1])) console.log(`  ${pad(n, 4)}${v}`)
