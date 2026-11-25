import { describe, expect, it } from 'vitest'
import { PUBLIC_CASES } from '../../data/publicCases'
import type { PublicCase } from '../types'
import { backtestPublicCase, caseToQuoteFields, summarizeBacktest } from './publicCaseBacktest'
import { computeInteractiveRoi } from './roi'

const base: PublicCase = {
  id: 't1',
  title: 't',
  industry: 'x',
  equip: 'lighting',
  equipmentNote: 'x',
  beforeKwhPerYear: null,
  afterKwhPerYear: null,
  savedKwhPerYear: 10_000,
  savedNtdPerYear: 40_000,
  investmentNtd: 84_000,
  subsidyNtd: null,
  reportedPaybackYears: 2.1,
  source: { publisher: 'p', collection: 'c', caseNo: 'n', url: 'https://example.org', section: 's', checkedDate: '2026-11-14' },
}

describe('public case data', () => {
  it('has 5–10 cases, each with a source URL, case number and no estimated fields', () => {
    expect(PUBLIC_CASES.length).toBeGreaterThanOrEqual(5)
    expect(PUBLIC_CASES.length).toBeLessThanOrEqual(10)
    for (const c of PUBLIC_CASES) {
      expect(c.source.url).toMatch(/^https:\/\/top\.energypark\.org\.tw\/topfirm\/Case\/Detail\//)
      expect(c.source.caseNo).toMatch(/^114-/)
      expect(c.source.section.length).toBeGreaterThan(0)
      // Before/after come as a pair from the source and add up to the saving (pc05's source truncates
      // its before/after to whole kWh, so allow 1 kWh).
      expect(c.beforeKwhPerYear == null).toBe(c.afterKwhPerYear == null)
      if (c.beforeKwhPerYear != null && c.afterKwhPerYear != null)
        expect(Math.abs(c.beforeKwhPerYear - c.afterKwhPerYear - c.savedKwhPerYear)).toBeLessThanOrEqual(1)
    }
    expect(new Set(PUBLIC_CASES.map((c) => c.id)).size).toBe(PUBLIC_CASES.length)
  })

  it("the source's own payback equals investment ÷ bill saving (so it is a pre-subsidy payback)", () => {
    for (const c of PUBLIC_CASES) {
      if (c.investmentNtd == null || c.savedNtdPerYear == null || c.reportedPaybackYears == null) continue
      expect(Math.abs(c.investmentNtd / c.savedNtdPerYear - c.reportedPaybackYears)).toBeLessThanOrEqual(0.05)
    }
  })
})

describe('backtestPublicCase', () => {
  it('runs the same computeInteractiveRoi the quote page uses, at the platform default rate', () => {
    const row = backtestPublicCase(base)
    const direct = computeInteractiveRoi(caseToQuoteFields(base), null, { electricityRate: 4.2, dailyHours: 16, daysPerYear: 300 })
    expect(row.platformPaybackYears).toBe(direct.grossPaybackYears)
    expect(row.platformPaybackYears).toBe(2) // 84,000 ÷ (10,000 × 4.2)
    expect(row.errorYears).toBe(-0.1)
    expect(row.impliedPriceNtd).toBe(4)
    expect(row.platformNetPaybackYears).toBeNull()
  })

  it('reports a net payback only when the source states the subsidy', () => {
    const row = backtestPublicCase({ ...base, subsidyNtd: 42_000 })
    expect(row.platformNetPaybackYears).toBe(1)
    expect(row.platformPaybackYears).toBe(2)
  })

  it('leaves the error empty when the source does not state a payback', () => {
    const row = backtestPublicCase({ ...base, reportedPaybackYears: null })
    expect(row.errorYears).toBeNull()
    expect(summarizeBacktest([{ ...base, reportedPaybackYears: null }]).maeYears).toBeNull()
  })
})

describe('summarizeBacktest on the published cases', () => {
  const s = summarizeBacktest(PUBLIC_CASES)

  it('compares every case and keeps the mean absolute error under half a year', () => {
    expect(s.comparedCount).toBe(PUBLIC_CASES.length)
    expect(s.maeYears).not.toBeNull()
    expect(s.maeYears!).toBeLessThan(0.5)
  })

  it('is biased optimistic because the default 4.2 元/度 is above every price the cases imply', () => {
    expect(s.biasYears!).toBeLessThan(0)
    expect(s.impliedPriceRange!.max).toBeLessThan(4.2)
  })

  it('handles an empty list', () => {
    const e = summarizeBacktest([])
    expect(e.comparedCount).toBe(0)
    expect(e.maeYears).toBeNull()
    expect(e.impliedPriceRange).toBeNull()
  })
})
