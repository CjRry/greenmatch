import { describe, expect, it } from 'vitest'
import { PUBLIC_CASES } from '../../data/publicCases'
import type { PublicCase } from '../types'
import {
  formatPreSurveyChecklistText,
  PRE_SURVEY_FACTORY_PREP,
  PRE_SURVEY_VENDOR_QUESTIONS,
  summarizeAirCompressorPublicBenchmark,
} from './compressorReport'

describe('summarizeAirCompressorPublicBenchmark', () => {
  it('只使用 PROP-0006 公開案例，當來源未揭露改善前用電時誠實寫出 0 筆可換算比例且不編造區間', () => {
    const res = summarizeAirCompressorPublicBenchmark(PUBLIC_CASES, 4.15)
    expect(res.totalCases).toBe(2)
    expect(res.pctDisclosedCount).toBe(0)
    expect(res.savingPctRange).toBeNull()
    expect(res.savedKwhRange).toEqual({ min: 47_000, max: 168_000 })
    expect(res.paybackYearsRange).toEqual({ min: 1.5, max: 3.6 })
    expect(res.honestSummary).toContain('共 2 筆')
    expect(res.honestSummary).toContain('0 筆')
    expect(res.honestSummary).toContain('你的實際數字要場勘量測才知道')
    expect(res.backtestRows).toHaveLength(2)
  })

  it('當未來公開案例補齊改善前與改善後度數時，動態算出同類公開案例省了 X–Y%（N 筆）', () => {
    const mockCases: PublicCase[] = [
      ...PUBLIC_CASES,
      {
        id: 'pc-test-1',
        title: '測試空壓案例 A',
        industry: '金屬加工',
        equip: 'air_compressor',
        equipmentNote: '測試',
        beforeKwhPerYear: 100_000,
        afterKwhPerYear: 72_000,
        savedKwhPerYear: 28_000,
        savedNtdPerYear: 112_000,
        investmentNtd: 300_000,
        subsidyNtd: null,
        reportedPaybackYears: 2.7,
        source: {
          publisher: '經濟部能源署',
          collection: '測試',
          caseNo: 'TEST-1',
          url: 'https://top.energypark.org.tw/',
          section: '測試',
          checkedDate: '2026-11-15',
        },
      },
      {
        id: 'pc-test-2',
        title: '測試空壓案例 B',
        industry: '金屬加工',
        equip: 'air_compressor',
        equipmentNote: '測試',
        beforeKwhPerYear: 200_000,
        afterKwhPerYear: 130_000,
        savedKwhPerYear: 70_000,
        savedNtdPerYear: 280_000,
        investmentNtd: 560_000,
        subsidyNtd: null,
        reportedPaybackYears: 2.0,
        source: {
          publisher: '經濟部能源署',
          collection: '測試',
          caseNo: 'TEST-2',
          url: 'https://top.energypark.org.tw/',
          section: '測試',
          checkedDate: '2026-11-15',
        },
      },
    ]
    const res = summarizeAirCompressorPublicBenchmark(mockCases, 4.2)
    expect(res.totalCases).toBe(4)
    expect(res.pctDisclosedCount).toBe(2)
    expect(res.savingPctRange).toEqual({ min: 28, max: 35 })
    expect(res.honestSummary).toContain('同類公開案例省了 28–35%（2 筆')
    expect(res.honestSummary).toContain('你的實際數字要場勘量測才知道')
  })

  it('場勘前清單包含 PROP-0007 4b 要求的 4 項準備與 3 項必問廠商，且未填風量也可產生清單', () => {
    expect(PRE_SURVEY_FACTORY_PREP.map((i) => i.title)).toEqual([
      '12 個月電費單',
      '銘牌照片',
      '運轉時數',
      '需要的壓力',
    ])
    expect(PRE_SURVEY_VENDOR_QUESTIONS.map((i) => i.title)).toEqual([
      '機型是否已登錄補助產品系統？',
      '會不會實測一週風量與壓力？',
      '有沒有節能績效保證？',
    ])
    const txt = formatPreSurveyChecklistText()
    expect(txt).toContain('風量（m³/min）：尚未量測／待場勘實測')
    expect(txt).toContain('12 個月電費單')
    expect(txt).toContain('會不會實測一週風量與壓力？')
  })
})
