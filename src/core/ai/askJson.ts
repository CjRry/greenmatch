import { capability } from '../runtime'

/**
 * The only code that calls Claude (`sample.json`). Call it from a click handler only: the first
 * call shows the viewer a consent prompt. Every failure returns { ok: false } so the feature can
 * fall back to its rule-based version and say so.
 */
export type AskFailure =
  /** No Claude here (local run, signed out) or the viewer turned it off for this artifact. */
  | 'unavailable'
  /** Too many requests or the viewer's usage limit. The viewer may try again later. */
  | 'busy'
  /** Claude answered but not in the expected shape. */
  | 'bad_output'
  /** The caller aborted. Show nothing. */
  | 'cancelled'
  | 'error'

export type AskResult<T> =
  | { ok: true; value: T; source: 'claude' }
  | { ok: false; reason: AskFailure; message: string }

export interface AskOptions {
  signal?: AbortSignal
  /** 'quick' for short extraction, 'default' otherwise. */
  tier?: 'quick' | 'default' | 'complex'
}

const PERMANENT = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'])
let aiOff = false

/** Whether Claude can be asked in this view. Resolves without prompting anyone. */
export async function aiAvailable(): Promise<boolean> {
  if (aiOff) return false
  return (await capability('sample')) !== null
}

/**
 * Ask Claude for JSON and validate it. `guard` returns the typed value, or null when the shape is wrong.
 * Put untrusted text (quotes, user descriptions) inside clear delimiters in the prompt.
 */
export async function askJson<T>(prompt: string, guard: (value: unknown) => T | null, options: AskOptions = {}): Promise<AskResult<T>> {
  if (aiOff) return { ok: false, reason: 'unavailable', message: 'AI 功能在此瀏覽階段已關閉' }
  const sample = await capability('sample')
  if (!sample) return { ok: false, reason: 'unavailable', message: '目前無法使用 Claude' }
  try {
    const raw = await sample.json(prompt, { signal: options.signal, modelTier: options.tier ?? 'default' })
    const value = guard(raw)
    if (value === null) return { ok: false, reason: 'bad_output', message: 'AI 回覆的格式不完整' }
    return { ok: true, value, source: 'claude' }
  } catch (e) {
    const code = (e as { code?: string })?.code ?? 'upstream_error'
    if (code === 'cancelled') return { ok: false, reason: 'cancelled', message: '' }
    if (PERMANENT.has(code)) {
      aiOff = true
      return { ok: false, reason: 'unavailable', message: '未授權此頁面使用 Claude' }
    }
    if (code === 'rate_limited' || code === 'session_expired') {
      return { ok: false, reason: 'busy', message: 'AI 目前忙碌或已達使用上限，請稍後再試' }
    }
    if (code === 'invalid_json' || code === 'refused' || code === 'empty_completion') {
      return { ok: false, reason: 'bad_output', message: 'AI 這次沒有給出可用的結果' }
    }
    return { ok: false, reason: 'error', message: 'AI 連線中斷' }
  }
}

/** Test hook: reset the session-level "AI turned off" flag. */
export function resetAiState(): void {
  aiOff = false
}
