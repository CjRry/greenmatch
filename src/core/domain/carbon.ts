import { ELECTRICITY_FACTOR, FUELS, INV_STEP_KEYS } from '../constants/carbon'
import type { CarbonInventory, CarbonMonth, FuelUse } from '../types'

/** Scope 2 (purchased electricity), kgCO2e. */
export function scope2Kg(kwh: number | null | undefined): number {
  return kwh && kwh > 0 ? kwh * ELECTRICITY_FACTOR : 0
}

/** Scope 1 (stationary and mobile fuel combustion), kgCO2e. */
export function scope1Kg(fuels: readonly FuelUse[] | null | undefined): number {
  if (!fuels) return 0
  return fuels.reduce((sum, f) => sum + (f.amount > 0 ? f.amount * FUELS[f.fuel].factor : 0), 0)
}

export interface MonthEmission {
  m: number
  kwh: number | null
  scope1T: number
  scope2T: number
  totalT: number
  /** True only when the factory typed this month's electricity reading (not a quick-calc estimate). */
  filled: boolean
  /** True when `kwh` came from 「套用試算」 (kwhSource 'estimate'). */
  estimated: boolean
}

export interface InventorySummary {
  year: number
  scope1T: number
  scope2T: number
  totalT: number
  totalKwh: number
  months: MonthEmission[]
  /** Months whose electricity the factory entered itself. */
  filledMonths: number
  /** Months holding a quick-calc estimate instead of a real reading. */
  estimatedMonths: number
  stepsDone: number
  stepsTotal: number
}

export function monthEmission(month: CarbonMonth): MonthEmission {
  const s1 = scope1Kg(month.fuels) / 1000
  const s2 = scope2Kg(month.kwh) / 1000
  const estimated = month.kwh != null && month.kwhSource === 'estimate'
  return { m: month.m, kwh: month.kwh, scope1T: s1, scope2T: s2, totalT: s1 + s2, filled: month.kwh != null && !estimated, estimated }
}

/**
 * Months the quick calculator may fill for `year`: every month of a past year, January up to the
 * current month of the current year, none of a future year. `today` is a Taiwan date `YYYY-MM-DD`.
 */
export function monthsUpToToday(year: number, today: string): number[] {
  const [y, m] = today.split('-').map(Number)
  const last = year < y ? 12 : year === y ? m : 0
  return Array.from({ length: Math.max(0, Math.min(12, last)) }, (_, i) => i + 1)
}

/**
 * Write a quick-calc monthly average into an inventory as estimates. Months the factory entered
 * itself are kept; only blank or previously estimated months up to today are (re)filled.
 */
export function applyEstimatedMonthlyKwh(months: readonly CarbonMonth[], kwh: number, fillable: readonly number[]): CarbonMonth[] {
  const allowed = new Set(fillable)
  return months.map((mo) => {
    const isUser = mo.kwh != null && mo.kwhSource !== 'estimate'
    if (isUser) return mo
    if (!allowed.has(mo.m)) {
      // A stale estimate for a month no longer allowed (e.g. future) is cleared.
      return mo.kwhSource === 'estimate' ? { m: mo.m, kwh: null, fuels: mo.fuels } : mo
    }
    return { ...mo, kwh, kwhSource: 'estimate' }
  })
}

/** Totals for one factory-year. 100,000 kWh of electricity and nothing else gives 47.4 t. */
export function summarizeInventory(inv: CarbonInventory): InventorySummary {
  const months = [...inv.months].sort((a, b) => a.m - b.m).map(monthEmission)
  const scope1T = months.reduce((s, m) => s + m.scope1T, 0)
  const scope2T = months.reduce((s, m) => s + m.scope2T, 0)
  const totalKwh = months.reduce((s, m) => s + (m.kwh ?? 0), 0)
  return {
    year: inv.year,
    scope1T,
    scope2T,
    totalT: scope1T + scope2T,
    totalKwh,
    months,
    filledMonths: months.filter((m) => m.filled).length,
    estimatedMonths: months.filter((m) => m.estimated).length,
    stepsDone: INV_STEP_KEYS.filter((k) => inv.steps[k] === 'done').length,
    stepsTotal: INV_STEP_KEYS.length,
  }
}

/** The latest inventory year for a factory, or null. */
export function latestInventory(all: readonly CarbonInventory[], factoryId: string): CarbonInventory | null {
  return all.filter((c) => c.factoryId === factoryId).sort((a, b) => b.year - a.year)[0] ?? null
}

export function inventoryId(factoryId: string, year: number): string {
  return `${factoryId}_${year}`
}

/** An empty inventory for a new year: all steps todo, 12 blank months. */
export function emptyInventory(factoryId: string, year: number, nowIso: string): CarbonInventory {
  return {
    id: inventoryId(factoryId, year),
    factoryId,
    year,
    steps: { boundary: 'todo', sources: 'todo', activity: 'todo', calc: 'todo', report: 'todo', verify: 'todo' },
    months: Array.from({ length: 12 }, (_, i) => ({ m: i + 1, kwh: null, fuels: [] })),
    updatedAt: nowIso,
  }
}
