/** zh-TW display formatting. All number output in the UI goes through these. */

const nf0 = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 1, maximumFractionDigits: 2 })

export function formatNumber(n: number | null | undefined, digits: 0 | 1 | 2 = 0): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (digits === 2) return nf2.format(n)
  return digits === 1 ? nf1.format(n) : nf0.format(n)
}

/** NT$ 1,234,000 → 「NT$ 123.4 萬」 when large, otherwise 「NT$ 8,500」. */
export function formatNtd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 10_000) return `NT$ ${formatNumber(n / 10_000, 1).replace(/\.0$/, '')} 萬`
  return `NT$ ${formatNumber(n)}`
}

/** NT$ 440,000–670,000 → 「約 NT$ 44–67 萬」. */
export function formatNtdRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max)) return '—'
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  if (lo === hi) return `約 ${formatNtd(lo)}`
  if (lo >= 10_000 && hi >= 10_000) {
    const a = formatNumber(lo / 10_000, 1).replace(/\.0$/, '')
    const b = formatNumber(hi / 10_000, 1).replace(/\.0$/, '')
    return `約 NT$ ${a}–${b} 萬`
  }
  return `約 ${formatNtd(lo)}–${formatNtd(hi)}`
}

/** kWh shown as 「度」, the unit on Taiwan power bills. */
export function formatKwh(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${formatNumber(n)} 度`
}

/** Tonnes CO2e with one decimal. */
export function formatTons(t: number | null | undefined): string {
  if (t == null || !Number.isFinite(t)) return '—'
  return `${formatNumber(t, 1)} tCO2e`
}

export function formatPct(p: number | null | undefined, digits: 0 | 1 = 0): string {
  if (p == null || !Number.isFinite(p)) return '—'
  return `${formatNumber(p, digits)}%`
}

/** 2026/10/26 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

/** 2026/10/26 14:05 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 「3 天前」「2 小時前」「剛剛」; falls back to the date after 30 days. */
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = now.getTime() - t
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (diff < 0) return formatDate(iso)
  if (diff < min) return '剛剛'
  if (diff < hour) return `${Math.floor(diff / min)} 分鐘前`
  if (diff < day) return `${Math.floor(diff / hour)} 小時前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(iso)
}

/** "2026-03" → 「3 月」 */
export function monthLabel(month: string | number): string {
  const m = typeof month === 'number' ? month : Number(month.split('-')[1])
  return `${m} 月`
}

export function nowIso(): string {
  return new Date().toISOString()
}
