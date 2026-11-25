import { describe, expect, it } from 'vitest'
import { emptyInventory, summarizeInventory } from '../../../core/domain/carbon'
import { compareSamePeriod } from './compare'

function inv(year: number, kwhByMonth: Record<number, number>) {
  const i = emptyInventory('f99', year, 'x')
  i.months = i.months.map((m) => ({ ...m, kwh: kwhByMonth[m.m] ?? null }))
  return summarizeInventory(i)
}

describe('compareSamePeriod', () => {
  it('compares only the months filled this year', () => {
    const cur = inv(2026, { 1: 100000, 2: 100000 })
    const prev = inv(2025, { 1: 100000, 2: 100000, 3: 900000 })
    const c = compareSamePeriod(cur, prev)!
    expect(c.months).toEqual([1, 2])
    expect(c.currentT).toBeCloseTo(94.8)
    expect(c.prevT).toBeCloseTo(94.8)
    expect(c.changePct).toBeCloseTo(0)
  })
  it('returns null without previous year or data', () => {
    expect(compareSamePeriod(inv(2026, { 1: 1 }), null)).toBeNull()
    expect(compareSamePeriod(inv(2026, {}), inv(2025, { 1: 1 }))).toBeNull()
  })
  it('has no percentage when the previous period is zero', () => {
    expect(compareSamePeriod(inv(2026, { 1: 1000 }), inv(2025, { 2: 1000 }))!.changePct).toBeNull()
  })
})
