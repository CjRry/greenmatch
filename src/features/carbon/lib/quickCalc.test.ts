import { describe, expect, it } from 'vitest'
import { applyEstimatedMonthlyKwh, emptyInventory, monthsUpToToday, summarizeInventory } from '../../../core/domain/carbon'
import {
  billToKwh,
  computeQuickCarbon,
  DEFAULT_ELECTRICITY_PRICE_NTD,
  evenSharesFor,
  initialQuickInput,
  normalizedShareEntries,
  sameShares,
} from './quickCalc'
import { draftFromInventory, monthsFromDraft } from './entryForm'

describe('quickCalc', () => {
  it('converts monthly bill to kWh using custom rate', () => {
    expect(billToKwh(420000, 4.2)).toBe(100000)
    expect(billToKwh(0, 4.2)).toBe(0)
    expect(billToKwh(50000, 0)).toBe(Math.round(50000 / DEFAULT_ELECTRICITY_PRICE_NTD))
  })

  it('computes Scope 1 + Scope 2 emissions and equipment hotspots from bill mode', () => {
    const res = computeQuickCarbon({
      mode: 'bill',
      monthlyKwh: 0,
      monthlyBillNtd: 420000,
      electricityPrice: 4.2,
      emissionFactor: 0.474,
      annualScope1T: 12.5,
      shares: { air_compressor: 50, hvac: 30, lighting: 20 },
    })
    expect(res.monthlyKwh).toBe(100000)
    expect(res.annualKwh).toBe(1200000)
    expect(res.scope2T).toBeCloseTo(568.8, 1)
    expect(res.totalT).toBeCloseTo(581.3, 1)
    expect(res.aboveFeeThreshold).toBe(false)
    expect(res.hotspots[0].equip).toBe('air_compressor')
    expect(res.hotspots[0].pct).toBeCloseTo(0.5, 4)
  })

  it('normalises shares to sum to ~1', () => {
    const entries = normalizedShareEntries({ air_compressor: 60, hvac: 60 })
    const sum = entries.reduce((s, e) => s + e.share, 0)
    expect(sum).toBeCloseTo(1, 2)
  })

  it('seeds initialQuickInput from existing inventory months and shares', () => {
    const inv = emptyInventory('f99', 2026, '2026-01-01T00:00:00Z')
    inv.months[0].kwh = 50000
    inv.months[1].kwh = 70000
    inv.electricityShare = [{ equip: 'hvac', share: 0.4 }]
    const init = initialQuickInput(inv)
    expect(init.monthlyKwh).toBe(60000)
    expect(init.shares.hvac).toBe(40)
  })

  it('never seeds shares from the platform template: even split over the factory\'s own equipment, else empty', () => {
    const inv = emptyInventory('f', 2026, '2026-11-14T00:00:00Z')
    expect(initialQuickInput(inv).shares).toEqual({})
    expect(initialQuickInput(inv, 50000, 3.6, ['air_compressor', 'lighting', 'air_compressor']).shares).toEqual({
      air_compressor: 50,
      lighting: 50,
    })
    expect(evenSharesFor([])).toEqual({})
    expect(sameShares({ hvac: 0, lighting: 50 }, { lighting: 50 })).toBe(true)
    expect(sameShares({ lighting: 55 }, { lighting: 50 })).toBe(false)
  })
})

describe('套用試算 writes estimates only up to today (OBS-0004 §2-2)', () => {
  it('fills past years fully, the current year up to this month, future years not at all', () => {
    expect(monthsUpToToday(2025, '2026-11-14')).toHaveLength(12)
    expect(monthsUpToToday(2026, '2026-11-14')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(monthsUpToToday(2027, '2026-11-14')).toEqual([])
  })

  it('keeps months the factory typed, marks the rest as estimates, and never counts them as filled', () => {
    const inv = emptyInventory('f', 2026, '2026-11-14T00:00:00Z')
    inv.months[0] = { m: 1, kwh: 40000, fuels: [] }
    const months = applyEstimatedMonthlyKwh(inv.months, 52000, monthsUpToToday(2026, '2026-11-14'))
    expect(months[0]).toEqual({ m: 1, kwh: 40000, fuels: [] })
    expect(months[1]).toEqual({ m: 2, kwh: 52000, kwhSource: 'estimate', fuels: [] })
    expect(months[11].kwh).toBeNull()
    const s = summarizeInventory({ ...inv, months })
    expect(s.filledMonths).toBe(1)
    expect(s.estimatedMonths).toBe(10)

    // Saving the month table without touching an estimate keeps it an estimate; typing over it makes it the factory's.
    const draft = draftFromInventory({ ...inv, months })
    expect(monthsFromDraft(draft)[1].kwhSource).toBe('estimate')
    draft.months[1] = { ...draft.months[1], kwh: '51000', estimated: false }
    expect(monthsFromDraft(draft)[1].kwhSource).toBeUndefined()
  })
})

