import type { SeasonKind, TariffPlanId } from '../data/taipowerTariffs'

export interface StoredBillPeriod {
  id: string
  label: string
  season: SeasonKind
  contractKw: string
  maxDemandKw: string
  powerFactorPct: string
  totalKwh: string
  peakKwh: string
  semiPeakKwh: string
  satSemiPeakKwh: string
  offPeakKwh: string
  billAmountNtd: string
}

export interface StoredBillDraft {
  planId: TariffPlanId
  periods: StoredBillPeriod[]
  showTouFields: boolean
  hasAirCompressor: boolean
  airFlowM3Min: string
  pressureBar: string
  compressorDailyHours: string
  /** Derived summary fields for cross-page bridges (e.g. unauthenticated carbon calculator). */
  annualKwh: number | null
  avgMonthlyBillNtd: number | null
  avgPriceNtd: number | null
  latestContractKw: number | null
  monthsEntered: number
  updatedAt: string
}

const DRAFT_KEY = 'greenmatch:v1:bill-checkup-draft'
let memoryFallback: StoredBillDraft | null = null

export function loadBillDraft(): StoredBillDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return memoryFallback
    const parsed = JSON.parse(raw) as Partial<StoredBillDraft>
    if (!parsed || !Array.isArray(parsed.periods) || parsed.periods.length === 0) return null
    return {
      planId: parsed.planId ?? 'hv_2stage',
      periods: parsed.periods,
      showTouFields: Boolean(parsed.showTouFields),
      hasAirCompressor: Boolean(parsed.hasAirCompressor),
      airFlowM3Min: typeof parsed.airFlowM3Min === 'string' ? parsed.airFlowM3Min : '',
      pressureBar: typeof parsed.pressureBar === 'string' ? parsed.pressureBar : '',
      compressorDailyHours: typeof parsed.compressorDailyHours === 'string' ? parsed.compressorDailyHours : '',
      annualKwh: typeof parsed.annualKwh === 'number' && Number.isFinite(parsed.annualKwh) ? parsed.annualKwh : null,
      avgMonthlyBillNtd:
        typeof parsed.avgMonthlyBillNtd === 'number' && Number.isFinite(parsed.avgMonthlyBillNtd) ? parsed.avgMonthlyBillNtd : null,
      avgPriceNtd: typeof parsed.avgPriceNtd === 'number' && Number.isFinite(parsed.avgPriceNtd) ? parsed.avgPriceNtd : null,
      latestContractKw:
        typeof parsed.latestContractKw === 'number' && Number.isFinite(parsed.latestContractKw) ? parsed.latestContractKw : null,
      monthsEntered: typeof parsed.monthsEntered === 'number' && Number.isFinite(parsed.monthsEntered) ? parsed.monthsEntered : 0,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    }
  } catch {
    return memoryFallback
  }
}

export function saveBillDraft(draft: StoredBillDraft): void {
  memoryFallback = draft
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Blocked browser storage falls back to in-memory draft for the session.
  }
}

export function clearBillDraft(): void {
  memoryFallback = null
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Ignore storage restriction on clear.
  }
}

export function getCheckupCarbonBridge(): {
  annualKwh: number
  monthlyKwh: number
  avgPriceNtd: number | null
  latestContractKw: number | null
  hasAirCompressor: boolean
  updatedAt: string
} | null {
  const draft = loadBillDraft()
  if (!draft || draft.annualKwh == null || draft.annualKwh <= 0) return null
  return {
    annualKwh: draft.annualKwh,
    monthlyKwh: Math.round(draft.annualKwh / 12),
    avgPriceNtd: draft.avgPriceNtd,
    latestContractKw: draft.latestContractKw,
    hasAirCompressor: draft.hasAirCompressor,
    updatedAt: draft.updatedAt,
  }
}
