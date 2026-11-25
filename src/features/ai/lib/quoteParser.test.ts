import { describe, expect, it } from 'vitest'
import { seedData } from '../../../data/seed'
import { buildComparison, computeInteractiveRoi, guardComparison, parseQuote, totalNtd } from './quoteParser'

const quotes = seedData().quotes ?? []
const c01 = (vendorId: string) => quotes.find((q) => q.caseId === 'c01' && q.vendorId === vendorId)!.rawText

describe('parseQuote golden: c01 綠能節電 (v01)', () => {
  const p = parseQuote(c01('v01'))
  it('reads the amounts, warranty and savings', () => {
    expect(totalNtd(p.fields)).toBe(2251000)
    expect(p.fields).toMatchObject({ warrantyYears: 3, monthlySaveKwh: 11000, monthlySaveNtd: 50600, savePct: 20, paybackMonths: 45, baseline: null })
  })
  it('asks about the missing baseline period', () => {
    expect(p.unreadable).toEqual(['baseline'])
    expect(p.questions.some((q) => q.includes('預估省電 20%，但未說明比較基準期間'))).toBe(true)
  })
})

describe('parseQuote golden: c01 府城機電 (v11)', () => {
  const p = parseQuote(c01('v11'))
  it('reads 萬 amounts and per-unit prices', () => {
    expect(p.fields.equipmentNtd).toBe(1205000)
    expect(p.fields.installNtd).toBe(160000)
    expect(p.fields).toMatchObject({ monthlySaveKwh: 8200, savePct: 15 })
    expect(p.fields.baseline).toContain('2026 年 7 月')
  })
  it('lists warranty and payback as unreadable with questions', () => {
    expect(p.fields.warrantyYears).toBeNull()
    expect(p.fields.paybackMonths).toBeNull()
    expect(p.unreadable).toEqual(expect.arrayContaining(['warrantyYears', 'paybackMonths', 'monthlySaveNtd']))
    expect(p.questions.some((q) => q.includes('保固') && q.includes('依原廠規定'))).toBe(true)
    expect(p.questions.some((q) => q.includes('回本'))).toBe(true)
  })
})

describe('parseQuote edge cases', () => {
  it('empty text: everything unreadable, asks for the basics', () => {
    const p = parseQuote('')
    expect(p.unreadable).toHaveLength(8)
    expect(p.questions.length).toBeGreaterThanOrEqual(4)
  })
  it('only a total: keeps it and says it is not split', () => {
    const p = parseQuote('合計 NT$ 1,200,000（未稅）')
    expect(p.fields.equipmentNtd).toBe(1200000)
    expect(p.fields.installNtd).toBeNull()
    expect(p.notes.equipmentNtd).toContain('合計')
  })
  it('reads 萬 and 千 forms', () => {
    const p = parseQuote('設備約 40 萬元，施工約 4 萬 5 千元')
    expect(p.fields).toMatchObject({ equipmentNtd: 400000, installNtd: 45000 })
  })
  it('OBS-0005 回歸：分離設備費與含括號安裝費用（不含括號合計混算）', () => {
    const sample = [
      '設備費：NT$ 1,450,000（2 台合計，未稅）',
      '安裝費用：NT$ 180,000（含配管試車）',
      '主機保固：3 年',
    ].join('\n')
    const p = parseQuote(sample)
    expect(p.fields.equipmentNtd).toBe(1_450_000)
    expect(p.fields.installNtd).toBe(180_000)
    expect(totalNtd(p.fields)).toBe(1_630_000)
  })
  it('converts yearly savings to monthly and years of payback to months', () => {
    const p = parseQuote('每年約可省 120,000 度，約 2.5 年回本，保固 18 個月')
    expect(p.fields).toMatchObject({ monthlySaveKwh: 10000, paybackMonths: 30, warrantyYears: 1.5 })
    expect(p.notes.monthlySaveKwh).toContain('換算')
  })
  it('reads the 「N 年保固」 order and Chinese numerals', () => {
    expect(parseQuote('主機三年保固').fields.warrantyYears).toBe(3)
    expect(parseQuote('保固：兩年').fields.warrantyYears).toBe(2)
  })
  it('does not mistake electricity price or tax for costs', () => {
    const p = parseQuote('平均電價每度 4.6 元，稅額 5%，每月約省 NT$ 9,000')
    expect(p.fields.equipmentNtd).toBeNull()
    expect(p.fields.monthlySaveNtd).toBe(9000)
    expect(p.fields.savePct).toBeNull()
  })
  it('reads an explicit baseline label', () => {
    expect(parseQuote('基準期間：2025 年 7–9 月\n可省電 12%').fields.baseline).toBe('2025 年 7–9 月')
  })
  it('keeps a baseline question out when no saving is claimed, but asks for the estimate', () => {
    const p = parseQuote('設備 NT$ 100,000')
    expect(p.questions.some((q) => q.includes('基準期間'))).toBe(false)
    expect(p.questions.some((q) => q.includes('節電效益'))).toBe(true)
  })
  it('declared fields fill gaps only', () => {
    const p = parseQuote('保固 3 年', { warrantyYears: 5, paybackMonths: 40 })
    expect(p.fields).toMatchObject({ warrantyYears: 3, paybackMonths: 40 })
  })
})

describe('buildComparison', () => {
  it('builds rows, questions per vendor and a summary', () => {
    const cmp = buildComparison(
      'c01',
      [
        { vendorId: 'v01', vendorName: '綠能節電', rawText: c01('v01') },
        { vendorId: 'v11', vendorName: '府城機電', rawText: c01('v11') },
      ],
      'rules',
      '2026-10-26T00:00:00.000Z',
    )
    expect(cmp).toMatchObject({ id: 'c01', caseId: 'c01', source: 'rules' })
    expect(cmp.rows.map((r) => r.vendorId)).toEqual(['v01', 'v11'])
    expect(cmp.questions.filter((q) => q.vendorId === 'v11').length).toBeGreaterThanOrEqual(2)
    expect(cmp.summary).toContain('綠能節電')
  })
})

describe('guardComparison', () => {
  const good = {
    rows: [{ vendorId: 'a', fields: { equipmentNtd: 1, installNtd: null, warrantyYears: 2, monthlySaveKwh: null, monthlySaveNtd: null, savePct: 10, paybackMonths: null, baseline: ' ' } }],
    questions: [{ vendorId: 'zzz', text: ' 問 ' }, { text: '' }],
    summary: '摘要',
  }
  it('accepts and cleans a good reply', () => {
    const v = guardComparison(['a'])(good)
    expect(v?.rows[0].fields.baseline).toBeNull()
    expect(v?.rows[0].unreadable).toContain('installNtd')
    expect(v?.questions).toEqual([{ vendorId: null, text: '問' }])
  })
  it('rejects wrong types and missing vendors', () => {
    expect(guardComparison(['a'])({ ...good, rows: [{ vendorId: 'a', fields: { equipmentNtd: '1' } }] })).toBeNull()
    expect(guardComparison(['a', 'b'])(good)).toBeNull()
    expect(guardComparison(['a'])(null)).toBeNull()
  })
})

describe('computeInteractiveRoi', () => {
  it('recalculates annual savings and net payback from custom electricity rate and operating hours', () => {
    const p = parseQuote(c01('v01'))
    const roi = computeInteractiveRoi(p.fields, { min: 440000, max: 670000 }, {
      electricityRate: 5,
      dailyHours: 24,
      daysPerYear: 300,
    })
    expect(roi.hoursMultiplier).toBeCloseTo(1.5, 2)
    expect(roi.annualSaveKwh).toBe(11000 * 12 * 1.5)
    expect(roi.annualSaveNtd).toBe(11000 * 12 * 1.5 * 5)
    expect(roi.netPaybackMinYears).toBeCloseTo((2251000 - 670000) / (11000 * 12 * 1.5 * 5), 1)
  })
})
