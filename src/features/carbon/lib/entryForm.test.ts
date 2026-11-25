import { describe, expect, it } from 'vitest'
import { emptyInventory } from '../../../core/domain/carbon'
import { draftFromInventory, hasAnyData, monthsFromDraft, parseField, sharesFromDraft, shareTotalPct, validateDraft } from './entryForm'

describe('parseField', () => {
  it('accepts blank, numbers and thousands separators', () => {
    expect(parseField('')).toEqual({ value: null, error: null })
    expect(parseField('12,500').value).toBe(12500)
  })
  it('rejects negatives and non-numbers', () => {
    expect(parseField('-1').error).toBe('不可為負數')
    expect(parseField('abc').error).toBe('請輸入數字')
  })
})

describe('draft round trip', () => {
  it('builds months, drops zero fuels and validates', () => {
    const d = draftFromInventory(emptyInventory('f99', 2026, '2026-01-01T00:00:00Z'))
    expect(d.months).toHaveLength(12)
    expect(hasAnyData(monthsFromDraft(d))).toBe(false)
    d.months[0].kwh = '100000'
    d.months[0].fuels.diesel = '50'
    d.months[0].fuels.lpg = '0'
    d.months[1].kwh = 'x'
    d.months[2].fuels.lpg = '-3'
    expect(Object.keys(validateDraft(d)).sort()).toEqual(['fuel-3-lpg', 'kwh-2'])
    d.months[1].kwh = ''
    d.months[2].fuels.lpg = ''
    expect(validateDraft(d)).toEqual({})
    const months = monthsFromDraft(d)
    expect(months[0]).toEqual({ m: 1, kwh: 100000, fuels: [{ fuel: 'diesel', amount: 50 }] })
    expect(months[1].kwh).toBeNull()
  })
  it('converts shares between percent and fraction', () => {
    const d = draftFromInventory(emptyInventory('f99', 2026, 'x'))
    d.shares = { hvac: '40', lighting: '60' }
    expect(shareTotalPct(d)).toBe(100)
    expect(sharesFromDraft(d)).toEqual([
      { equip: 'hvac', share: 0.4 },
      { equip: 'lighting', share: 0.6 },
    ])
  })
})
