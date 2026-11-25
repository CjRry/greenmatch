/**
 * The platform's one payback / ROI calculation. QuoteCompare shows it for vendor quotes and the
 * public-case backtest (publicCaseBacktest.ts) runs the same function on published cases, so the
 * number a factory sees and the number we test are produced by identical code.
 */
import type { QuoteFields } from '../types'
import {
  DEFAULT_ANNUAL_DAYS,
  DEFAULT_ANNUAL_OPERATING_HOURS,
  DEFAULT_DAILY_HOURS,
  DEFAULT_ELECTRICITY_PRICE_NTD,
} from './factoryFacts'

export const DEFAULT_ROI_RATE_NTD = DEFAULT_ELECTRICITY_PRICE_NTD
export const DEFAULT_ROI_DAILY_HOURS = DEFAULT_DAILY_HOURS
export const DEFAULT_ROI_DAYS_PER_YEAR = DEFAULT_ANNUAL_DAYS
export const BASE_ANNUAL_OPERATING_HOURS = DEFAULT_ANNUAL_OPERATING_HOURS

/** Equipment plus installation; null when neither is known. */
export function totalNtd(f: QuoteFields): number | null {
  if (f.equipmentNtd == null && f.installNtd == null) return null
  return (f.equipmentNtd ?? 0) + (f.installNtd ?? 0)
}

export interface InteractiveRoiInput {
  electricityRate: number
  dailyHours: number
  daysPerYear: number
}

export interface InteractiveRoiResult {
  annualOperatingHours: number
  hoursMultiplier: number
  annualSaveKwh: number | null
  annualSaveNtd: number | null
  grossPaybackYears: number | null
  netPaybackMinYears: number | null
  netPaybackMaxYears: number | null
  fiveYearNetGainMin: number | null
  fiveYearNetGainMax: number | null
}

/**
 * Recalculates annual kWh savings, NTD savings, and payback years using the factory's own
 * electricity rate and operating schedule instead of relying only on vendor-stated figures.
 */
export function computeInteractiveRoi(
  fields: QuoteFields,
  subsidyRange: { min: number; max: number } | null,
  input: InteractiveRoiInput,
): InteractiveRoiResult {
  const rate = Number.isFinite(input.electricityRate) && input.electricityRate > 0 ? input.electricityRate : DEFAULT_ROI_RATE_NTD
  const daily = Number.isFinite(input.dailyHours) && input.dailyHours > 0 ? input.dailyHours : DEFAULT_ROI_DAILY_HOURS
  const days = Number.isFinite(input.daysPerYear) && input.daysPerYear > 0 ? input.daysPerYear : DEFAULT_ROI_DAYS_PER_YEAR
  const annualOperatingHours = daily * days
  const hoursMultiplier = annualOperatingHours / BASE_ANNUAL_OPERATING_HOURS

  const annualSaveKwh = fields.monthlySaveKwh != null ? Math.round(fields.monthlySaveKwh * 12 * hoursMultiplier) : null
  const annualSaveNtd =
    annualSaveKwh != null
      ? Math.round(annualSaveKwh * rate)
      : fields.monthlySaveNtd != null
        ? Math.round(fields.monthlySaveNtd * 12 * hoursMultiplier)
        : null

  const total = totalNtd(fields)
  const validSave = annualSaveNtd != null && annualSaveNtd > 0 ? annualSaveNtd : null
  const grossPaybackYears = total != null && validSave != null ? Math.round((total / validSave) * 10) / 10 : null
  const netMin = total != null ? Math.max(0, total - (subsidyRange?.max ?? 0)) : null
  const netMax = total != null ? Math.max(0, total - (subsidyRange?.min ?? 0)) : null
  const netPaybackMinYears = netMin != null && validSave != null ? Math.round((netMin / validSave) * 10) / 10 : null
  const netPaybackMaxYears = netMax != null && validSave != null ? Math.round((netMax / validSave) * 10) / 10 : null
  const fiveYearNetGainMin = netMax != null && validSave != null ? Math.round(validSave * 5 - netMax) : null
  const fiveYearNetGainMax = netMin != null && validSave != null ? Math.round(validSave * 5 - netMin) : null

  return {
    annualOperatingHours,
    hoursMultiplier,
    annualSaveKwh,
    annualSaveNtd,
    grossPaybackYears,
    netPaybackMinYears,
    netPaybackMaxYears,
    fiveYearNetGainMin,
    fiveYearNetGainMax,
  }
}
