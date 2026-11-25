import { describe, expect, it } from 'vitest'
import { buildComparison, entriesFromQuotes, parseQuote } from '../../src/features/ai/lib/quoteParser'
import { fixtureData } from '../../src/test/fixtures'

const quotes = (fixtureData().quotes ?? []).filter((q) => q.caseId === 'c01')
const byVendor = (id: string) => quotes.find((q) => q.vendorId === id)!

describe('quoteParser（c01 兩張報價）', () => {
  it('c01 有兩張報價（v01、v11）', () => {
    expect(quotes.map((q) => q.vendorId).sort()).toEqual(['v01', 'v11'])
  })

  it('v01：金額、保固、省電與回本', () => {
    const { fields, questions } = parseQuote(byVendor('v01').rawText)
    expect(fields.warrantyYears).toBe(3)
    expect(fields.monthlySaveKwh).toBe(11000)
    expect(fields.monthlySaveNtd).toBe(50600)
    expect(fields.savePct).toBe(20)
    expect(fields.paybackMonths).toBe(45)
    expect(fields.equipmentNtd).not.toBeNull()
    expect(fields.installNtd).not.toBeNull()
    // v01 沒有寫比較基準期間
    expect(questions.some((q) => q.includes('比較基準期間'))).toBe(true)
  })

  it('v11：以萬元寫的金額、保固未載明、基準期間已載明', () => {
    const { fields, questions, unreadable } = parseQuote(byVendor('v11').rawText)
    expect(fields.monthlySaveKwh).toBe(8200)
    expect(fields.savePct).toBe(15)
    expect(fields.warrantyYears).toBeNull()
    expect(unreadable).toContain('warrantyYears')
    expect(fields.baseline).not.toBeNull()
    expect(questions.some((q) => q.includes('保固'))).toBe(true)
    expect(questions.some((q) => q.includes('比較基準期間'))).toBe(false)
  })

  it('v11 沒寫回本時間，會問', () => {
    const { fields, questions } = parseQuote(byVendor('v11').rawText)
    expect(fields.paybackMonths).toBeNull()
    expect(questions.some((q) => q.includes('回本'))).toBe(true)
  })

  it('buildComparison：兩列、問題都屬於這兩家，並說明比較基準不一致', () => {
    const cmp = buildComparison('c01', entriesFromQuotes(quotes, (id) => id), 'rules', '2026-10-27T00:00:00.000Z')
    expect(cmp.rows.map((r) => r.vendorId).sort()).toEqual(['v01', 'v11'])
    expect(cmp.questions.length).toBeGreaterThan(0)
    for (const q of cmp.questions) expect(['v01', 'v11']).toContain(q.vendorId)
    expect(cmp.summary).toMatch(/基準/)
    expect(cmp.source).toBe('rules')
  })

  it('空白報價不丟錯，所有欄位為 null', () => {
    const { fields, unreadable } = parseQuote('')
    expect(Object.values(fields).every((v) => v === null)).toBe(true)
    expect(unreadable.length).toBe(8)
  })
})
