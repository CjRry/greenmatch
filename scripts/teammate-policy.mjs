// 隊友角色的路徑政策（設計：docs/superpowers/specs/2026-11-22-teammate-role-design.md）。
// 同一份 scripts/teammate-paths.json 同時供兩處使用：隊友電腦上的護欄（guard-ownership.mjs 的 teammate 區域），
// 以及 CEO 合併隊友 PR 前的檢查程式（check-teammate-pr.mjs）。這裡只放純函式，方便測試。
import { readFileSync } from 'node:fs'
import { join, posix } from 'node:path'

/** 讀 scripts/teammate-paths.json。 */
export function loadPolicy(projectDir) {
  const raw = JSON.parse(readFileSync(join(projectDir, 'scripts/teammate-paths.json'), 'utf8'))
  const list = (k) => (Array.isArray(raw[k]) ? raw[k].map(String) : [])
  return {
    teammates: list('teammates'),
    alwaysForbidden: list('alwaysForbidden'),
    smallPaths: list('smallPaths'),
    reportPaths: list('reportPaths'),
    requestPaths: list('requestPaths'),
    forbiddenPaths: list('forbiddenPaths'),
  }
}

/** 專案內的相對路徑，統一成 a/b/c；跳出專案或是絕對路徑時回 null。 */
export function normalizeRel(p) {
  if (typeof p !== 'string' || p === '') return null
  const slashed = p.replace(/\\/g, '/')
  if (slashed.startsWith('/') || /^[A-Za-z]:\//.test(slashed)) return null
  const n = posix.normalize(slashed).replace(/^(\.\/)+/, '').replace(/\/+$/, '')
  if (n === '.' || n === '' || n === '..' || n.startsWith('../')) return null
  return n
}

const cache = new Map()

function toRegExp(pattern) {
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*' && pattern[i + 1] === '*') {
      if (pattern[i + 2] === '/') {
        out += '(?:.*/)?'
        i += 2
      } else {
        out += '.*'
        i += 1
      }
    } else if (c === '*') out += '[^/]*'
    else out += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  // 不分大小寫：macOS 的檔案系統不分大小寫，claude.md 與 CLAUDE.md、Routes.tsx 與 routes.tsx 是同一個檔案。
  return new RegExp(`^${out}$`, 'i')
}

/** `**` 比對任意多層（含零層），`*` 比對一層內的字元，不分大小寫。沒有 `/` 的樣式比對任一層的檔名。 */
export function matchGlob(pattern, rel) {
  let re = cache.get(pattern)
  if (!re) {
    re = toRegExp(pattern)
    cache.set(pattern, re)
  }
  const target = pattern.includes('/') ? rel : rel.slice(rel.lastIndexOf('/') + 1)
  return re.test(target)
}

const any = (patterns, rel) => patterns.some((g) => matchGlob(g, rel))

/**
 * 'report' | 'request' | 'forbidden' | 'small' | 'other'。
 * 先看 alwaysForbidden（隱藏檔、會被 AI 當成指示讀取的檔案，任何一層都不行），再依 report → request → forbidden → small。
 */
export function classifyPath(rel, policy) {
  const n = normalizeRel(rel)
  if (n === null) return 'forbidden'
  if (any(policy.alwaysForbidden ?? [], n)) return 'forbidden'
  if (any(policy.reportPaths, n)) return 'report'
  if (any(policy.requestPaths, n)) return 'request'
  if (any(policy.forbiddenPaths, n)) return 'forbidden'
  if (any(policy.smallPaths, n)) return 'small'
  return 'other'
}

/** 隊友可以直接寫的路徑：小事路徑與自己的報告、請求單資料夾。 */
export function isTeammateWritable(rel, policy) {
  return ['report', 'request', 'small'].includes(classifyPath(rel, policy))
}
