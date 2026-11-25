import { describe, expect, it } from 'vitest'
import { ELECTRICITY_FACTOR } from '../../src/core/constants/carbon'
import { emptyInventory, scope1Kg, scope2Kg, summarizeInventory } from '../../src/core/domain/carbon'

describe('碳計算', () => {
  it('電力排放係數為 0.474', () => {
    expect(ELECTRICITY_FACTOR).toBe(0.474)
  })

  it('100,000 度 → 47.4 tCO2e', () => {
    expect(scope2Kg(100_000) / 1000).toBeCloseTo(47.4, 6)
    const inv = emptyInventory('fx', 2026, '2026-01-01T00:00:00.000Z')
    inv.months[0] = { ...inv.months[0], kwh: 100_000 }
    const s = summarizeInventory(inv)
    expect(s.scope2T).toBeCloseTo(47.4, 6)
    expect(s.scope1T).toBe(0)
    expect(s.totalT).toBeCloseTo(47.4, 6)
    expect(s.filledMonths).toBe(1)
  })

  it('空值、0、負數都算 0，不丟錯', () => {
    expect(scope2Kg(null)).toBe(0)
    expect(scope2Kg(undefined)).toBe(0)
    expect(scope2Kg(0)).toBe(0)
    expect(scope2Kg(-5)).toBe(0)
    expect(scope1Kg(null)).toBe(0)
    expect(scope1Kg([])).toBe(0)
  })

  it('空白年度盤查：12 個月、0 噸、0 個已填', () => {
    const s = summarizeInventory(emptyInventory('fx', 2026, '2026-01-01T00:00:00.000Z'))
    expect(s.months).toHaveLength(12)
    expect(s.totalT).toBe(0)
    expect(s.filledMonths).toBe(0)
  })
})
