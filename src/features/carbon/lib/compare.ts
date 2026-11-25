import type { InventorySummary } from '../../../core/domain/carbon'

export interface YearComparison {
  prevYear: number
  /** Month numbers compared (those filled in the current year). */
  months: number[]
  currentT: number
  prevT: number
  /** (current − prev) / prev, or null when prev is 0. */
  changePct: number | null
}

/** Same-period comparison: only months filled in the current year, in both years. Null without a previous year or data. */
export function compareSamePeriod(current: InventorySummary, prev: InventorySummary | null): YearComparison | null {
  if (!prev) return null
  const months = current.months.filter((m) => m.filled).map((m) => m.m)
  if (months.length === 0) return null
  const sum = (s: InventorySummary) => s.months.filter((m) => months.includes(m.m)).reduce((n, m) => n + m.totalT, 0)
  const currentT = sum(current)
  const prevT = sum(prev)
  return { prevYear: prev.year, months, currentT, prevT, changePct: prevT > 0 ? ((currentT - prevT) / prevT) * 100 : null }
}
