import { describe, expect, it } from 'vitest'
import { guardNeedForm, mentionsCarbonInventory, parseAge, parseMonthlyBillNtd, parseNeed, parseRatedKw, suggestTitle } from './needParser'

const DECK = '我們工廠空壓機有 3 台，都用了十幾年，最近電費越來越高，夏天冷氣也很耗電'

describe('parseNeed golden (deck example)', () => {
  const form = parseNeed(DECK)
  it('finds the air compressors with count and age', () => {
    expect(form.items[0]).toMatchObject({ equip: 'air_compressor', quantity: 3, ageYears: 10, ageText: '10 年以上' })
  })
  it('finds the air conditioning without a count', () => {
    expect(form.items[1]).toMatchObject({ equip: 'hvac', quantity: null, ageYears: null })
    expect(form.items).toHaveLength(2)
  })
  it('lists problems, directions and open questions', () => {
    expect(form.mainProblems).toContain('電費上升')
    expect(form.directions.some((d) => d.includes('空壓機汰換'))).toBe(true)
    expect(form.directions.some((d) => d.includes('空調效率改善'))).toBe(true)
    expect(form.openQuestions.some((q) => q.includes('空調') && q.includes('幾台'))).toBe(true)
  })
})

describe('parseNeed edge cases', () => {
  it('empty text gives an empty form and a question', () => {
    const f = parseNeed('   ')
    expect(f.items).toEqual([])
    expect(f.openQuestions.length).toBeGreaterThan(0)
  })
  it('binds Chinese numerals and quantifiers to the nearest item', () => {
    const f = parseNeed('有兩台空壓機和三台冷氣')
    expect(f.items.find((i) => i.equip === 'air_compressor')?.quantity).toBe(2)
    expect(f.items.find((i) => i.equip === 'hvac')?.quantity).toBe(3)
  })
  it('does not give one number to two items', () => {
    const f = parseNeed('空壓機 3 台 冷氣 5 台')
    expect(f.items.map((i) => i.quantity)).toEqual([3, 5])
  })
  it('does not turn carbon inventory words into a need item (no consultants on the platform)', () => {
    const f = parseNeed('客戶要求我們做 ISO 14064 碳盤查')
    expect(f.items).toEqual([])
    expect(mentionsCarbonInventory('客戶要求我們做 ISO 14064 碳盤查')).toBe(true)
    expect(mentionsCarbonInventory('空壓機用了十幾年')).toBe(false)
  })
  it('drops carbon_consulting items that Claude returns anyway', () => {
    const f = guardNeedForm({ items: [{ equip: 'carbon_consulting' }, { equip: 'hvac', quantity: 2 }], mainProblems: [], directions: [], openQuestions: [] })
    expect(f?.items.map((i) => i.equip)).toEqual(['hvac'])
  })
  it('does not turn 變頻空壓機 into a motor drive item', () => {
    const f = parseNeed('想換 2 台變頻空壓機')
    expect(f.items.map((i) => i.equip)).toEqual(['air_compressor'])
    expect(f.items[0].quantity).toBe(2)
  })
  it('reads 「想換變頻的」 as the wish for the compressor, not an extra motor row (OBS-0004 §2-4)', () => {
    const f = parseNeed('廠裡兩台30馬力的空壓機用了十二年，每個月電費大概 18 萬，想換變頻的')
    expect(f.items.map((i) => i.equip)).toEqual(['air_compressor'])
    expect(f.items[0].quantity).toBe(2)
    expect(suggestTitle(f)).not.toContain('馬達')
    // A bare 變頻 with nothing else, or a real 變頻器, still makes a motor/drive row.
    expect(parseNeed('想把產線改成變頻').items.map((i) => i.equip)).toEqual(['motor_vfd'])
    expect(parseNeed('空壓機 2 台，另外 5 台變頻器要換').items.map((i) => i.equip)).toEqual(['air_compressor', 'motor_vfd'])
  })
  it('prefers the longer keyword where they overlap', () => {
    expect(parseNeed('鍋爐是加熱爐').items.map((i) => i.equip)).toEqual(['boiler'])
  })
  it('merges a repeated item', () => {
    const f = parseNeed('空壓機很吵。空壓機 4 台')
    expect(f.items).toHaveLength(1)
    expect(f.items[0].quantity).toBe(4)
    expect(f.mainProblems).toContain('噪音過大')
  })
  it('asks about missing counts and ages, and about problems when none are given', () => {
    const f = parseNeed('照明')
    expect(f.openQuestions).toEqual(expect.arrayContaining(['照明共有幾台（組）？', '照明大約用了幾年，或哪一年購置？']))
    expect(f.openQuestions.some((q) => q.includes('最困擾'))).toBe(true)
  })
  it('adds the leak direction when the text mentions air leaks', () => {
    expect(parseNeed('空壓機 2 台，管路常漏氣').directions).toContain('管路洩漏檢測與修補')
  })
  it('handles full-width digits', () => {
    expect(parseNeed('空壓機３台').items[0].quantity).toBe(3)
  })
  it('extracts rated kW from kW and converts HP to kW', () => {
    expect(parseRatedKw('37kW')).toBe(37)
    expect(parseRatedKw('50HP 空壓機')).toBe(37)
    expect(parseNeed('37kW 空壓機 3 台').items[0].ratedKw).toBe(37)
    expect(parseNeed('50馬力空壓機 2 台').items[0].ratedKw).toBe(37)
  })
  it('parses pre-noun modifier gap up to 16 chars and monthly electricity bill without asking duplicate quantity', () => {
    const f = parseNeed('2 台 50 馬力的空壓機，用了 12 年，漏氣嚴重，每月電費大概 27 萬')
    expect(f.items[0]).toMatchObject({ equip: 'air_compressor', quantity: 2, ratedKw: 37, ageYears: 12 })
    expect(f.monthlyElectricBillNtd).toBe(270000)
    expect(f.mainProblems).toContain('管路洩漏')
    expect(f.openQuestions.some((q) => q.includes('幾台'))).toBe(false)
  })
  it('parses monthly bill in 萬元 and 元 formats', () => {
    expect(parseMonthlyBillNtd('每月電費 18 萬')).toBe(180000)
    expect(parseMonthlyBillNtd('電費大概 27.5 萬')).toBe(275000)
    expect(parseMonthlyBillNtd('每月電費 240,000 元')).toBe(240000)
    expect(parseMonthlyBillNtd('空壓機 2 台')).toBeNull()
  })
})

describe('parseAge', () => {
  it('reads each pattern', () => {
    expect(parseAge('用了十幾年')).toEqual({ ageYears: 10, ageText: '10 年以上' })
    expect(parseAge('二十幾年了')).toEqual({ ageYears: 20, ageText: '20 年以上' })
    expect(parseAge('快 20 年')).toMatchObject({ ageYears: 20 })
    expect(parseAge('2012 年買的')).toMatchObject({ ageYears: 14 })
    expect(parseAge('用了 8 年')).toEqual({ ageYears: 8, ageText: '8 年' })
    expect(parseAge('十五年')).toMatchObject({ ageYears: 15 })
  })
  it('ignores deadlines and unrelated text', () => {
    expect(parseAge('年底前完成')).toBeNull()
    expect(parseAge('2027 年底前')).toBeNull()
    expect(parseAge('電費很高')).toBeNull()
  })
})

describe('suggestTitle', () => {
  it('names the items', () => {
    expect(suggestTitle(parseNeed(DECK))).toBe('空壓機 3 台、空調節能改善')
    expect(suggestTitle({ items: [], mainProblems: [], directions: [], openQuestions: [] })).toBe('節能改善需求')
  })
})

describe('guardNeedForm', () => {
  const ok = { items: [{ equip: 'hvac', quantity: 2, ageYears: 5 }], mainProblems: ['電費上升'], directions: [], openQuestions: [] }
  it('accepts a good shape and cleans fields', () => {
    expect(guardNeedForm(ok)?.items[0]).toMatchObject({ equip: 'hvac', quantity: 2, ageYears: 5, ageText: null })
  })
  it('drops unknown codes and duplicates, keeps the rest', () => {
    const f = guardNeedForm({ ...ok, items: [{ equip: 'nuclear' }, ...ok.items, ok.items[0]] })
    expect(f?.items).toHaveLength(1)
  })
  it('rejects wrong shapes', () => {
    expect(guardNeedForm(null)).toBeNull()
    expect(guardNeedForm({ ...ok, items: 'x' })).toBeNull()
    expect(guardNeedForm({ ...ok, items: [{ equip: 'nuclear' }] })).toBeNull()
    expect(guardNeedForm({ ...ok, mainProblems: 'x' })).toBeNull()
  })
  it('nulls out non-numeric quantities and preserves valid monthlyElectricBillNtd', () => {
    expect(guardNeedForm({ ...ok, items: [{ equip: 'hvac', quantity: '3', ageYears: -1 }] })?.items[0]).toMatchObject({ quantity: null, ageYears: null })
    expect(guardNeedForm({ ...ok, monthlyElectricBillNtd: 270000 })?.monthlyElectricBillNtd).toBe(270000)
    expect(guardNeedForm({ ...ok, monthlyElectricBillNtd: -5 })?.monthlyElectricBillNtd).toBeUndefined()
  })
})
