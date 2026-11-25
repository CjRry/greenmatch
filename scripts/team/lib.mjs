// Shared helpers for the team scripts: config, credentials and a small Paperclip API client.
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

export const TEAM = readJson('scripts/team/team.json')
export const TEMPLATE = readJson('scripts/team/agent-template.json')
/** agentId → { area, name } */
export const AREAS = readJson('scripts/agent-areas.json')

export const areaOf = (agentId) => AREAS[agentId]?.area ?? (agentId === TEAM.ceoAgentId ? 'CEO' : null)
export const agentIdOf = (area) => Object.keys(AREAS).find((id) => AREAS[id].area === area) ?? null
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const expandHome = (p) => (p.startsWith('~/') ? join(homedir(), p.slice(2)) : p)

/** Credentials come from the environment, else from the CEO agent's env file. Never printed. */
function loadCredentials() {
  const need = ['PAPERCLIP_API_URL', 'PAPERCLIP_API_KEY', 'PAPERCLIP_COMPANY_ID']
  if (need.every((k) => process.env[k])) return
  const file = expandHome(process.env.PAPERCLIP_ENV_FILE ?? TEAM.ceoEnvFile)
  if (!existsSync(file)) throw new Error(`No Paperclip credentials: set ${need.join(', ')} or create ${file}`)
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
}

loadCredentials()
export const COMPANY = process.env.PAPERCLIP_COMPANY_ID
const BASE = process.env.PAPERCLIP_API_URL.replace(/\/+$/, '').replace(/\/api$/, '')

/** Call the Paperclip API as the CEO agent. `{c}` in the path becomes the company id. */
export async function api(method, path, body) {
  const res = await fetch(BASE + path.replace('{c}', COMPANY), {
    method,
    headers: { Authorization: `Bearer ${process.env.PAPERCLIP_API_KEY}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → HTTP ${res.status}: ${data?.error ?? text.slice(0, 200)}`)
    err.status = res.status
    throw err
  }
  return data
}

/** List endpoints answer either an array or { <key>: [...] }. */
export const items = (data, key) => (Array.isArray(data) ? data : (data?.[key] ?? []))

/** --flag value / --flag / positional arguments. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) out._.push(a)
    else if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) out[a.slice(2)] = true
    else out[a.slice(2)] = argv[++i]
  }
  return out
}

/** "2.1.310 (Claude Code)" ≥ "2.1.284" */
export function versionAtLeast(version, min) {
  const a = version.split('.').map(Number)
  const b = min.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return true
}
