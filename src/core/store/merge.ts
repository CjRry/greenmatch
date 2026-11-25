/** Shared helpers so the local and db backends produce identical documents. */

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** JSON round-trip: drops undefined, copies deeply, rejects non-JSON values. */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Nested objects merge recursively; arrays and scalars replace. Same rule as the claude.ai db `update`. */
export function deepMerge<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    const cur = out[k]
    out[k] = isPlainObject(v) && isPlainObject(cur) ? deepMerge(cur, v) : v
  }
  return out as T
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v)
  }
  return value
}

/** Path-safe id: letters, digits and underscore only. */
export function makeId(prefix: string): string {
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  return `${prefix.replace(/[^a-zA-Z0-9]/g, '')}_${time}${rand}`
}
