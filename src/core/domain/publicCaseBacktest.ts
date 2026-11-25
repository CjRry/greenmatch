/**
 * Backtest of the platform's payback calculation against published cases (PROP-0006).
 *
 * For each case we feed its "before" conditions into the exact function the quote-compare page uses
 * (`computeInteractiveRoi`): investment = the case's investment, savings = the case's annual kWh saved,
 * electricity rate and operating hours = the platform defaults a factory gets when it has not entered
 * its own bill (4.2 元/度, 16 h × 300 days, so the hours multiplier is 1). The source's own payback
 * is investment ÷ its reported annual bill saving, before any subsidy, so we compare it with the
 * platform's gross (pre-subsidy) payback.
 *
 * What this does NOT test: how many kWh a retrofit saves. The platform has no model for that; it
 * takes the savings figure from the vendor's quote, and here from the case itself.
 */
import type { PublicCase, QuoteFields } from '../types'
import { computeInteractiveRoi, DEFAULT_ROI_DAILY_HOURS, DEFAULT_ROI_DAYS_PER_YEAR, DEFAULT_ROI_RATE_NTD } from './roi'

export interface PublicCaseBacktestRow {
  caseId: string
  /** Platform payback before subsidy, years (0.1 precision, as the site shows it). */
  platformPaybackYears: number | null
  /** Platform payback after the source-stated subsidy, years; null when no subsidy is disclosed. */
  platformNetPaybackYears: number | null
  reportedPaybackYears: number | null
  /** platform − reported, years; negative = the platform is more optimistic. */
  errorYears: number | null
  /** |error| ÷ reported. */
  absPctError: number | null
  /** The source's bill saving ÷ kWh saved = the electricity price the case effectively used (元/度). */
  impliedPriceNtd: number | null
}

export interface PublicCaseBacktestSummary {
  rows: PublicCaseBacktestRow[]
  /** Cases with both a platform and a reported payback. */
  comparedCount: number
  /** Mean absolute error, years (2 decimals). */
  maeYears: number | null
  /** Mean signed error, years (2 decimals); negative = platform shorter than reported. */
  biasYears: number | null
  maxAbsErrorYears: number | null
  /** Mean absolute percentage error, % (1 decimal). */
  mapePct: number | null
  /** Range of the electricity price implied by the cases, 元/度 (2 decimals). */
  impliedPriceRange: { min: number; max: number } | null
  platformRateNtd: number
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d

/** The QuoteFields a factory would have if a vendor quoted exactly what the case reports. */
export function caseToQuoteFields(c: PublicCase): QuoteFields {
  return {
    equipmentNtd: c.investmentNtd,
    installNtd: null,
    warrantyYears: null,
    monthlySaveKwh: c.savedKwhPerYear / 12,
    monthlySaveNtd: null,
    savePct: null,
    paybackMonths: null,
    baseline: null,
  }
}

export function backtestPublicCase(c: PublicCase, rate = DEFAULT_ROI_RATE_NTD): PublicCaseBacktestRow {
  const subsidy = c.subsidyNtd != null && c.subsidyNtd > 0 ? { min: c.subsidyNtd, max: c.subsidyNtd } : null
  const roi = computeInteractiveRoi(caseToQuoteFields(c), subsidy, {
    electricityRate: rate,
    dailyHours: DEFAULT_ROI_DAILY_HOURS,
    daysPerYear: DEFAULT_ROI_DAYS_PER_YEAR,
  })
  const platform = roi.grossPaybackYears
  const reported = c.reportedPaybackYears
  const errorYears = platform != null && reported != null ? round(platform - reported, 1) : null
  return {
    caseId: c.id,
    platformPaybackYears: platform,
    platformNetPaybackYears: subsidy ? roi.netPaybackMinYears : null,
    reportedPaybackYears: reported,
    errorYears,
    absPctError: errorYears != null && reported != null && reported > 0 ? Math.abs(errorYears) / reported : null,
    impliedPriceNtd: c.savedNtdPerYear != null && c.savedKwhPerYear > 0 ? round(c.savedNtdPerYear / c.savedKwhPerYear, 2) : null,
  }
}

export function summarizeBacktest(cases: readonly PublicCase[], rate = DEFAULT_ROI_RATE_NTD): PublicCaseBacktestSummary {
  const rows = cases.map((c) => backtestPublicCase(c, rate))
  const errs = rows.filter((r) => r.errorYears != null).map((r) => r.errorYears as number)
  const pcts = rows.filter((r) => r.absPctError != null).map((r) => r.absPctError as number)
  const prices = rows.filter((r) => r.impliedPriceNtd != null).map((r) => r.impliedPriceNtd as number)
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return {
    rows,
    comparedCount: errs.length,
    maeYears: errs.length ? round(mean(errs.map(Math.abs)), 2) : null,
    biasYears: errs.length ? round(mean(errs), 2) : null,
    maxAbsErrorYears: errs.length ? Math.max(...errs.map(Math.abs)) : null,
    mapePct: pcts.length ? round(mean(pcts) * 100, 1) : null,
    impliedPriceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    platformRateNtd: rate,
  }
}
