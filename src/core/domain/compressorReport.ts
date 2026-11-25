/**
 * Pure domain logic for PROP-0007 4b:
 * 1) Air-compressor honest benchmark strictly derived from PROP-0006 `PUBLIC_CASES`.
 *    When sources omit baseline before-kWh, never fabricate a saving % range;
 *    disclose the exact case count and only report verified public metrics.
 * 2) Pre-survey checklist (工廠要準備 + 要問廠商) with optional air-flow support
 *    (風量 m³/min is strictly optional and never blocks the diagnostic report).
 */
import type { PublicCase } from '../types'
import { backtestPublicCase, type PublicCaseBacktestRow } from './publicCaseBacktest'
import { DEFAULT_ROI_RATE_NTD } from './roi'

export interface NumericRange {
  min: number
  max: number
}

export interface AirCompressorPublicBenchmark {
  totalCases: number
  pctDisclosedCount: number
  savingPctRange: NumericRange | null
  savedKwhRange: NumericRange | null
  paybackYearsRange: NumericRange | null
  cases: readonly PublicCase[]
  backtestRows: readonly PublicCaseBacktestRow[]
  honestSummary: string
  measurementNote: string
}

export interface PreSurveyChecklistItem {
  id: string
  title: string
  detail: string
}

export interface PreSurveyOptionalInputs {
  airFlowM3Min?: number | null
  pressureBar?: number | null
  dailyHours?: number | null
}

export const PRE_SURVEY_FACTORY_PREP: readonly PreSurveyChecklistItem[] = [
  {
    id: 'bills-12m',
    title: '12 個月電費單',
    detail: '備妥近一年電費單（含契約容量、最高需量、功率因數與總度數），才能對齊淡旺季負載基準。',
  },
  {
    id: 'nameplate-photos',
    title: '銘牌照片',
    detail: '拍下現有空壓機馬達／機台銘牌，含型號、馬力（HP／kW）、出廠年份、額定壓力與排氣量。',
  },
  {
    id: 'operating-hours',
    title: '運轉時數',
    detail: '記錄每日開機小時數、輪班方式、週休停機日，以及空載或低負載運轉的大致時段。',
  },
  {
    id: 'required-pressure',
    title: '需要的壓力',
    detail: '確認產線現場真正需要的最低工作壓力（bar 或 kg/cm²）；降壓空間與實際耗電差異須由廠商掛表實測確認。',
  },
] as const

export const PRE_SURVEY_VENDOR_QUESTIONS: readonly PreSurveyChecklistItem[] = [
  {
    id: 'subsidy-registered',
    title: '機型是否已登錄補助產品系統？',
    detail: '確認廠商擬報價的新機型是否列於經濟部能源署「動力與公用設備補助」登錄產品名錄，未登錄無法請領每 kW 補助。',
  },
  {
    id: 'one-week-metering',
    title: '會不會實測一週風量與壓力？',
    detail: '要求在提出正式節電保證與報價前，先掛表實測至少一週的風量（m³/min）、壓力與電流曲線，不憑經驗口頭估算。',
  },
  {
    id: 'performance-guarantee',
    title: '有沒有節能績效保證？',
    detail: '確認報價是否寫明改善後比功率或年節電度數承諾、完工後量測驗證方法（M&V），以及未達保證值時的處理條件。',
  },
] as const

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function minMax(values: readonly number[]): NumericRange | null {
  if (!values.length) return null
  return { min: Math.min(...values), max: Math.max(...values) }
}

/**
 * Computes an honest benchmark for `air_compressor` projects from sourced `PUBLIC_CASES` only.
 * Never extrapolates saving percentages when `beforeKwhPerYear` is not disclosed in the source.
 */
export function summarizeAirCompressorPublicBenchmark(
  cases: readonly PublicCase[],
  electricityRateNtd = DEFAULT_ROI_RATE_NTD,
): AirCompressorPublicBenchmark {
  const rate = Number.isFinite(electricityRateNtd) && electricityRateNtd > 0 ? electricityRateNtd : DEFAULT_ROI_RATE_NTD
  const compressorCases = cases.filter((c) => c.equip === 'air_compressor')
  const backtestRows = compressorCases.map((c) => backtestPublicCase(c, rate))

  const pcts = compressorCases
    .filter((c) => c.beforeKwhPerYear != null && c.beforeKwhPerYear > 0 && c.afterKwhPerYear != null)
    .map((c) => round1(((c.beforeKwhPerYear! - c.afterKwhPerYear!) / c.beforeKwhPerYear!) * 100))

  const savingPctRange = minMax(pcts)
  const savedKwhRange = minMax(compressorCases.map((c) => c.savedKwhPerYear).filter((v): v is number => v != null && v > 0))
  const paybackYearsRange = minMax(
    compressorCases.map((c) => c.reportedPaybackYears).filter((v): v is number => v != null && v > 0),
  )

  const measurementNote = '你的實際數字要場勘量測才知道。'
  let honestSummary: string

  if (compressorCases.length === 0) {
    honestSummary = `目前 PROP-0006 尚未收錄經核對的空壓機公開案例（0 筆）。平台不估算省電百分比；${measurementNote}`
  } else if (savingPctRange && pcts.length > 0) {
    const pctText =
      savingPctRange.min === savingPctRange.max
        ? `${savingPctRange.min}%`
        : `${savingPctRange.min}–${savingPctRange.max}%`
    honestSummary = `同類公開案例省了 ${pctText}（${pcts.length} 筆可換算節電率，全部共 ${compressorCases.length} 筆空壓機公開案例，皆附出處）。${measurementNote}`
  } else {
    const kwhPart = savedKwhRange
      ? `年節電 ${savedKwhRange.min.toLocaleString('zh-TW')}–${savedKwhRange.max.toLocaleString('zh-TW')} 度`
      : null
    const pbPart = paybackYearsRange ? `未扣補助回本 ${paybackYearsRange.min}–${paybackYearsRange.max} 年` : null
    const disclosedParts = [kwhPart, pbPart].filter(Boolean).join('、')
    honestSummary = `PROP-0006 收錄同類空壓機公開案例共 ${compressorCases.length} 筆（均附能源署出處），但來源皆未揭露改善前用電量，可換算「省了幾 %」的筆數為 0 筆——平台不編造區間；兩案已揭露實績為${disclosedParts}。${measurementNote}`
  }

  return {
    totalCases: compressorCases.length,
    pctDisclosedCount: pcts.length,
    savingPctRange,
    savedKwhRange,
    paybackYearsRange,
    cases: compressorCases,
    backtestRows,
    honestSummary,
    measurementNote,
  }
}

/** Formats the pre-survey checklist into plain Traditional Chinese text for 1-click copying. */
export function formatPreSurveyChecklistText(inputs: PreSurveyOptionalInputs = {}): string {
  const specs: string[] = []
  specs.push(inputs.airFlowM3Min != null ? `風量（選填）：${inputs.airFlowM3Min} m³/min` : '風量（m³/min）：尚未量測／待場勘實測')
  if (inputs.pressureBar != null) specs.push(`需要壓力：${inputs.pressureBar} bar（或 kg/cm²）`)
  if (inputs.dailyHours != null) specs.push(`每日運轉時數：${inputs.dailyHours} 小時`)

  const prepLines = PRE_SURVEY_FACTORY_PREP.map((item, idx) => `  ${idx + 1}. [ ] ${item.title}：${item.detail}`)
  const questionLines = PRE_SURVEY_VENDOR_QUESTIONS.map((item, idx) => `  ${idx + 1}. [ ] ${item.title}（${item.detail}）`)

  return [
    '【空壓機節能改善 — 場勘前準備清單】',
    ...specs.map((line) => `• ${line}`),
    '',
    '一、工廠要準備的資料（4 項）：',
    ...prepLines,
    '',
    '二、場勘與報價時要問廠商（3 項）：',
    ...questionLines,
    '',
    '※ 備註：未實測風量與壓力前，不預估確切省電百分比；實際節電率須待掛表實測一週後確認。',
  ].join('\n')
}
