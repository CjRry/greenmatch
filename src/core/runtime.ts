/**
 * The only module that touches `window.claude`. Features ask for capabilities through here.
 *
 * Inside the claude.ai viewer `window.claude.use` exists before any script runs, so the check is
 * synchronous: without it we are running locally and every capability is null immediately.
 */
type CapName = keyof ClaudeCapabilityMap & string

const cache = new Map<string, Promise<unknown>>()
const overrides = new Map<string, unknown>()

export function hasClaudeRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const c = (window as { claude?: { use?: unknown } }).claude
  return typeof c?.use === 'function'
}

/**
 * Resolve a capability namespace, or null when this view cannot run it. Memoized per name.
 * Never asks for consent: prompts only appear when a capability's function is called.
 */
export function capability<K extends CapName>(name: K, timeoutMs = 5000): Promise<ClaudeCapabilityMap[K] | null> {
  if (overrides.has(name)) return Promise.resolve(overrides.get(name) as ClaudeCapabilityMap[K] | null)
  const hit = cache.get(name)
  if (hit) return hit as Promise<ClaudeCapabilityMap[K] | null>
  let p: Promise<ClaudeCapabilityMap[K] | null>
  if (!hasClaudeRuntime()) {
    p = Promise.resolve(null)
  } else {
    p = Promise.race([
      window.claude.use(name).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])
  }
  cache.set(name, p)
  return p
}

/** Tests and the ?fakedb mode can stand in for a capability. Pass undefined to clear. */
export function setCapabilityOverride<K extends CapName>(name: K, value: ClaudeCapabilityMap[K] | null | undefined): void {
  if (value === undefined) overrides.delete(name)
  else overrides.set(name, value)
  cache.delete(name)
}

/** URL switches for local testing: ?local, ?fakedb, ?fakedb=seed. */
export function urlFlag(name: string): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.has(name) ? (params.get(name) ?? '') : null
}
