import {
  CARBON_FEE_PER_TON_NTD,
  CARBON_FEE_THRESHOLD_TONS,
  DEFAULT_ELECTRICITY_PRICE_NTD,
  DEFAULT_FALLBACK_MONTHLY_KWH,
  ELECTRICITY_FACTOR,
} from '../../../core/domain/factoryFacts'
import { EQUIP_INFO, EQUIPS } from '../../../core/constants/equipment'
import type { CarbonInventory, Equip } from '../../../core/types'

export { CARBON_FEE_PER_TON_NTD, CARBON_FEE_THRESHOLD_TONS, DEFAULT_ELECTRICITY_PRICE_NTD }

export type QuickInputMode = 'kwh' | 'bill'

export interface QuickCarbonInput {
  mode: QuickInputMode
  /** Average monthly kWh (used when mode === 'kwh'). */
  monthlyKwh: number
  /** Average monthly electricity bill in NTD (used when mode === 'bill'). */
  monthlyBillNtd: number
  /** Custom electricity rate in NTD / kWh. */
  electricityPrice: number
  /** Custom grid emission factor in kgCO2e / kWh. */
  emissionFactor: number
  /** Annual Scope 1 fuel emissions in tCO2e. */
  annualScope1T: number
  /** Equipment electricity share weights (0–100 raw slider values). */
  shares: Partial<Record<Equip, number>>
}

export interface QuickHotspot {
  equip: Equip
  label: string
  pct: number
  tons: number
  annualKwh: number
  annualCostNtd: number
}

export interface QuickCarbonResult {
  monthlyKwh: number
  annualKwh: number
  annualBillNtd: number
  scope1T: number
  scope2T: number
  totalT: number
  estimatedCarbonFeeNtd: number
  aboveFeeThreshold: boolean
  hotspots: QuickHotspot[]
}

/** Convert monthly electricity bill (NTD) into kWh using a positive electricity rate. */
export function billToKwh(monthlyBillNtd: number, electricityPrice: number): number {
  if (!Number.isFinite(monthlyBillNtd) || monthlyBillNtd <= 0) return 0
  const rate = Number.isFinite(electricityPrice) && electricityPrice > 0 ? electricityPrice : DEFAULT_ELECTRICITY_PRICE_NTD
  return Math.round(monthlyBillNtd / rate)
}

/** Compute live Scope 1/2 emissions, electricity bill, carbon fee reference, and equipment hotspots. */
export function computeQuickCarbon(input: QuickCarbonInput): QuickCarbonResult {
  const rate = Number.isFinite(input.electricityPrice) && input.electricityPrice > 0 ? input.electricityPrice : DEFAULT_ELECTRICITY_PRICE_NTD
  const factor = Number.isFinite(input.emissionFactor) && input.emissionFactor > 0 ? input.emissionFactor : ELECTRICITY_FACTOR
  const monthlyKwh =
    input.mode === 'bill'
      ? billToKwh(input.monthlyBillNtd, rate)
      : Math.max(0, Number.isFinite(input.monthlyKwh) ? input.monthlyKwh : 0)
  const annualKwh = monthlyKwh * 12
  const annualBillNtd = Math.round(annualKwh * rate)
  const scope1T = Math.max(0, Number.isFinite(input.annualScope1T) ? input.annualScope1T : 0)
  const scope2T = (annualKwh * factor) / 1000
  const totalT = scope1T + scope2T
  const aboveFeeThreshold = totalT >= CARBON_FEE_THRESHOLD_TONS
  const estimatedCarbonFeeNtd = Math.round(totalT * CARBON_FEE_PER_TON_NTD)

  const rawEntries = EQUIPS.map((equip) => ({
    equip,
    weight: Math.max(0, Number.isFinite(input.shares[equip] ?? 0) ? (input.shares[equip] ?? 0) : 0),
  })).filter((x) => x.weight > 0)
  const sumWeight = rawEntries.reduce((s, x) => s + x.weight, 0)
  const hotspots: QuickHotspot[] =
    sumWeight > 0
      ? rawEntries
          .map((x) => {
            const pct = x.weight / sumWeight
            return {
              equip: x.equip,
              label: EQUIP_INFO[x.equip].label,
              pct,
              tons: scope2T * pct,
              annualKwh: annualKwh * pct,
              annualCostNtd: Math.round(annualBillNtd * pct),
            }
          })
          .sort((a, b) => b.tons - a.tons)
      : []

  return {
    monthlyKwh,
    annualKwh,
    annualBillNtd,
    scope1T,
    scope2T,
    totalT,
    estimatedCarbonFeeNtd,
    aboveFeeThreshold,
    hotspots,
  }
}

/**
 * Even split across the equipment types the factory actually listed (OBS-0004 §2-2): never the
 * platform template, never equipment the factory doesn't have. No equipment → no shares.
 */
export function evenSharesFor(equips: readonly Equip[]): Partial<Record<Equip, number>> {
  const unique = EQUIPS.filter((e) => equips.includes(e))
  if (unique.length === 0) return {}
  const each = Math.round(100 / unique.length)
  return Object.fromEntries(unique.map((e) => [e, each])) as Partial<Record<Equip, number>>
}

/** True when two slider share maps hold the same positive weights. */
export function sameShares(a: Partial<Record<Equip, number>>, b: Partial<Record<Equip, number>>): boolean {
  return EQUIPS.every((e) => Math.max(0, a[e] ?? 0) === Math.max(0, b[e] ?? 0))
}

/** Build a clean default QuickCarbonInput seeded from an existing inventory (or factory monthly kWh & price). */
export function initialQuickInput(
  inv: CarbonInventory,
  fallbackMonthlyKwh?: number | null,
  fallbackElectricityPrice?: number | null,
  factoryEquipment: readonly Equip[] = [],
): QuickCarbonInput {
  const filled = inv.months.filter((m) => m.kwh != null && m.kwh > 0)
  const avgKwh =
    filled.length > 0
      ? Math.round(filled.reduce((s, m) => s + (m.kwh ?? 0), 0) / filled.length)
      : (fallbackMonthlyKwh ?? DEFAULT_FALLBACK_MONTHLY_KWH)
  const price =
    fallbackElectricityPrice != null && Number.isFinite(fallbackElectricityPrice) && fallbackElectricityPrice > 0
      ? fallbackElectricityPrice
      : DEFAULT_ELECTRICITY_PRICE_NTD
  const existingShares: Partial<Record<Equip, number>> = {}
  for (const s of inv.electricityShare ?? []) {
    if (s.share > 0) existingShares[s.equip] = Math.round(s.share * 100)
  }
  const hasAnyShare = Object.keys(existingShares).length > 0
  return {
    mode: 'kwh',
    monthlyKwh: avgKwh,
    monthlyBillNtd: Math.round(avgKwh * price),
    electricityPrice: price,
    emissionFactor: ELECTRICITY_FACTOR,
    annualScope1T: 0,
    shares: hasAnyShare ? existingShares : evenSharesFor(factoryEquipment),
  }
}

/** Convert normalised equipment shares from QuickCarbonInput into CarbonInventory electricityShare entries. */
export function normalizedShareEntries(shares: Partial<Record<Equip, number>>): { equip: Equip; share: number }[] {
  const valid = EQUIPS.map((equip) => ({ equip, w: Math.max(0, shares[equip] ?? 0) })).filter((x) => x.w > 0)
  const sum = valid.reduce((s, x) => s + x.w, 0)
  if (sum <= 0) return []
  return valid.map((x) => ({ equip: x.equip, share: Math.round((x.w / sum) * 1000) / 1000 }))
}
