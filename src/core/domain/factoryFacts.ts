/**
 * Single source of truth for factory operational facts, platform estimation defaults,
 * provenance explanations, and in-place updates.
 */
import { ELECTRICITY_FACTOR } from '../constants/carbon'
import { EQUIP_INFO } from '../constants/equipment'
import { formatKwh, formatNtd, formatNumber } from '../format'
import type {
  CarbonInventory,
  Equip,
  EquipmentItem,
  FactSourceKind,
  Factory,
  FactoryFactKey,
  FactoryFactSource,
  ISO,
} from '../types'
import { summarizeInventory } from './carbon'

export { ELECTRICITY_FACTOR }
export const DEFAULT_ELECTRICITY_PRICE_NTD = 4.2
export const DEFAULT_DAILY_HOURS = 16
export const DEFAULT_ANNUAL_DAYS = 300
export const DEFAULT_ANNUAL_OPERATING_HOURS = DEFAULT_DAILY_HOURS * DEFAULT_ANNUAL_DAYS
export const DEFAULT_FALLBACK_MONTHLY_KWH = 45_000
export const CARBON_FEE_THRESHOLD_TONS = 25_000
export const CARBON_FEE_PER_TON_NTD = 300
export const DEFAULT_EQUIPMENT_SHARES: Partial<Record<Equip, number>> = {
  air_compressor: 35,
  hvac: 25,
  lighting: 15,
  pump_fan: 15,
  boiler: 10,
}

export interface FactoryFactEntry<T> {
  key: FactoryFactKey
  label: string
  unit?: string
  value: T
  source: FactSourceKind
  note: string
  /** True when Factory.factory stores a non-null positive value (or non-empty equipment array). */
  isExplicit: boolean
  updatedAt?: ISO
}

export interface ResolvedFactoryFacts {
  monthlyKwh: FactoryFactEntry<number | null>
  monthlyElectricBillNtd: FactoryFactEntry<number | null>
  avgElectricityPriceNtd: FactoryFactEntry<number>
  contractKw: FactoryFactEntry<number | null>
  dailyHours: FactoryFactEntry<number>
  annualDays: FactoryFactEntry<number>
  annualOperatingHours: number
  equipment: FactoryFactEntry<EquipmentItem[]>
  byKey: {
    monthlyKwh: FactoryFactEntry<number | null>
    monthlyElectricBillNtd: FactoryFactEntry<number | null>
    avgElectricityPriceNtd: FactoryFactEntry<number>
    contractKw: FactoryFactEntry<number | null>
    dailyHours: FactoryFactEntry<number>
    annualDays: FactoryFactEntry<number>
    equipment: FactoryFactEntry<EquipmentItem[]>
  }
  derived: {
    monthlyKwh: number | null
    monthlyKwhSource: FactSourceKind
    monthlyKwhNote: string
    annualKwh: number | null
    annualScope2T: number | null
    annualBillNtd: number | null
  }
}

export type NumericFactoryFactKey = Exclude<FactoryFactKey, 'equipment'>

export interface FactoryFactUpdates {
  monthlyKwh?: number | null
  monthlyElectricBillNtd?: number | null
  avgElectricityPriceNtd?: number | null
  contractKw?: number | null
  dailyHours?: number | null
  annualDays?: number | null
  equipment?: EquipmentItem[]
}

const NUMERIC_FACT_KEYS: readonly NumericFactoryFactKey[] = [
  'monthlyKwh',
  'monthlyElectricBillNtd',
  'avgElectricityPriceNtd',
  'contractKw',
  'dailyHours',
  'annualDays',
]

function validPositive(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

function metaOf(factory: Factory | null | undefined, key: FactoryFactKey): FactoryFactSource | undefined {
  return factory?.factory.dataSources?.[key]
}

/** Missing dataSources entries default to 'estimate' on read. */
export function factSourceKind(factory: Factory | null | undefined, key: FactoryFactKey): FactSourceKind {
  return metaOf(factory, key)?.source === 'user' ? 'user' : 'estimate'
}

export function overallFactSource(sources: readonly FactSourceKind[]): FactSourceKind {
  return sources.length > 0 && sources.every((s) => s === 'user') ? 'user' : 'estimate'
}

export function formatEquipmentSummary(equipment: readonly EquipmentItem[]): string {
  if (!equipment.length) return '尚未填寫'
  return equipment
    .map((e) => {
      const parts = [
        e.source === 'estimate'
          ? `${EQUIP_INFO[e.type].label}（台數待確認）`
          : `${EQUIP_INFO[e.type].label} ${formatNumber(e.quantity)} 台`,
      ]
      if (e.ratedKw != null && e.ratedKw > 0) parts.push(`${formatNumber(e.ratedKw)} kW`)
      if (e.dailyHours != null && e.dailyHours > 0) parts.push(`每日 ${formatNumber(e.dailyHours)} 小時`)
      return parts.join('・')
    })
    .join('；')
}

function resolveScalarWithDefault(
  factory: Factory | null | undefined,
  key: NumericFactoryFactKey,
  label: string,
  unit: string,
  defaultValue: number,
  userNote: string,
  defaultNote: string,
  legacyNote: string,
): FactoryFactEntry<number> {
  const raw = validPositive(factory?.factory[key])
  const meta = metaOf(factory, key)
  if (raw != null) {
    const source: FactSourceKind = meta?.source === 'user' ? 'user' : 'estimate'
    return {
      key,
      label,
      unit,
      value: raw,
      source,
      note: meta?.note ?? (source === 'user' ? userNote : legacyNote),
      isExplicit: true,
      updatedAt: meta?.updatedAt,
    }
  }
  return {
    key,
    label,
    unit,
    value: defaultValue,
    source: 'estimate',
    note: defaultNote,
    isExplicit: false,
  }
}

/**
 * Resolve all operational facts for a factory, returning values, provenance ('user' | 'estimate'),
 * and Traditional Chinese explanations of how estimates were derived.
 */
export function resolveFactoryFacts(
  factory: Factory | null | undefined,
  latestCarbonInventory?: CarbonInventory | null,
): ResolvedFactoryFacts {
  const rawBill = validPositive(factory?.factory.monthlyElectricBillNtd)
  const billMeta = metaOf(factory, 'monthlyElectricBillNtd')
  const rawKwh = validPositive(factory?.factory.monthlyKwh)
  const kwhMeta = metaOf(factory, 'monthlyKwh')

  const rawExplicitPrice = validPositive(factory?.factory.avgElectricityPriceNtd)
  const avgPriceMeta = metaOf(factory, 'avgElectricityPriceNtd')
  const derivedRatio =
    rawExplicitPrice == null && rawKwh != null && rawBill != null
      ? Math.round((rawBill / rawKwh) * 100) / 100
      : null
  const derivedPriceSource: FactSourceKind = overallFactSource([
    billMeta?.source === 'user' ? 'user' : 'estimate',
    kwhMeta?.source === 'user' ? 'user' : 'estimate',
  ])
  const avgElectricityPriceNtd: FactoryFactEntry<number> =
    derivedRatio != null && derivedRatio >= 0.5 && derivedRatio <= 20
      ? {
          key: 'avgElectricityPriceNtd',
          label: '平均電價',
          unit: '元/度',
          value: derivedRatio,
          source: derivedPriceSource,
          note:
            derivedPriceSource === 'user'
              ? `依你填的每月電費 ${formatNtd(rawBill!)} ÷ 月用電 ${formatNumber(rawKwh!)} 度推算`
              : `依每月電費 ${formatNtd(rawBill!)} ÷ 月用電 ${formatNumber(rawKwh!)} 度推估`,
          isExplicit: derivedPriceSource === 'user',
          updatedAt: avgPriceMeta?.updatedAt,
        }
      : resolveScalarWithDefault(
          factory,
          'avgElectricityPriceNtd',
          '平均電價',
          '元/度',
          DEFAULT_ELECTRICITY_PRICE_NTD,
          '依貴廠填寫之平均電價',
          `未填寫，暫用平台平均工業電價 ${DEFAULT_ELECTRICITY_PRICE_NTD} 元/度估算`,
          '既有欄位未標註來源，暫依欄位數值估算',
        )

  const dailyHours = resolveScalarWithDefault(
    factory,
    'dailyHours',
    '每日運轉時數',
    '小時',
    DEFAULT_DAILY_HOURS,
    '依貴廠填寫之每日運轉時數',
    `未填寫，暫用平台預設每日 ${DEFAULT_DAILY_HOURS} 小時估算`,
    '既有欄位未標註來源，暫依欄位數值估算',
  )

  const annualDays = resolveScalarWithDefault(
    factory,
    'annualDays',
    '年運轉天數',
    '天',
    DEFAULT_ANNUAL_DAYS,
    '依貴廠填寫之年運轉天數',
    `未填寫，暫用平台預設每年 ${DEFAULT_ANNUAL_DAYS} 天估算`,
    '既有欄位未標註來源，暫依欄位數值估算',
  )

  let monthlyKwh: FactoryFactEntry<number | null>
  if (rawKwh != null) {
    const source: FactSourceKind = kwhMeta?.source === 'user' ? 'user' : 'estimate'
    monthlyKwh = {
      key: 'monthlyKwh',
      label: '月平均用電度數',
      unit: '度',
      value: rawKwh,
      source,
      note: kwhMeta?.note ?? (source === 'user' ? '依貴廠填寫之月平均用電度數' : '依既有資料或電費區間估算，尚未確認為貴廠實測值'),
      isExplicit: true,
      updatedAt: kwhMeta?.updatedAt,
    }
  } else if (rawBill != null) {
    const derivedKwh = Math.round(rawBill / avgElectricityPriceNtd.value)
    monthlyKwh = {
      key: 'monthlyKwh',
      label: '月平均用電度數',
      unit: '度',
      value: derivedKwh,
      source: 'estimate',
      note: `未直接填寫度數，依每月電費 ${formatNtd(rawBill)} ÷ 電價 ${avgElectricityPriceNtd.value} 元/度估算`,
      isExplicit: false,
    }
  } else if (latestCarbonInventory) {
    const invSummary = summarizeInventory(latestCarbonInventory)
    const filled = invSummary.months.filter((m) => m.filled && (m.kwh ?? 0) > 0)
    if (filled.length > 0) {
      const avg = Math.round(filled.reduce((s, m) => s + (m.kwh ?? 0), 0) / filled.length)
      monthlyKwh = {
        key: 'monthlyKwh',
        label: '月平均用電度數',
        unit: '度',
        value: avg,
        source: 'estimate',
        note: `依 ${latestCarbonInventory.year} 年碳盤查已填 ${filled.length} 個月用電平均估算`,
        isExplicit: false,
      }
    } else {
      monthlyKwh = {
        key: 'monthlyKwh',
        label: '月平均用電度數',
        unit: '度',
        value: null,
        source: 'estimate',
        note: '尚未填寫每月用電度數或電費',
        isExplicit: false,
      }
    }
  } else {
    monthlyKwh = {
      key: 'monthlyKwh',
      label: '月平均用電度數',
      unit: '度',
      value: null,
      source: 'estimate',
      note: '尚未填寫每月用電度數或電費',
      isExplicit: false,
    }
  }

  let monthlyElectricBillNtd: FactoryFactEntry<number | null>
  if (rawBill != null) {
    const source: FactSourceKind = billMeta?.source === 'user' ? 'user' : 'estimate'
    monthlyElectricBillNtd = {
      key: 'monthlyElectricBillNtd',
      label: '每月電費',
      unit: '元',
      value: rawBill,
      source,
      note: billMeta?.note ?? (source === 'user' ? '依貴廠填寫之每月電費' : '依既有資料估算'),
      isExplicit: true,
      updatedAt: billMeta?.updatedAt,
    }
  } else if (monthlyKwh.value != null) {
    monthlyElectricBillNtd = {
      key: 'monthlyElectricBillNtd',
      label: '每月電費',
      unit: '元',
      value: Math.round(monthlyKwh.value * avgElectricityPriceNtd.value),
      source: 'estimate',
      note: `未填寫，依月用電 ${formatKwh(monthlyKwh.value)} × 電價 ${avgElectricityPriceNtd.value} 元/度估算`,
      isExplicit: false,
    }
  } else {
    monthlyElectricBillNtd = {
      key: 'monthlyElectricBillNtd',
      label: '每月電費',
      unit: '元',
      value: null,
      source: 'estimate',
      note: '尚未填寫每月電費',
      isExplicit: false,
    }
  }

  const rawContract = validPositive(factory?.factory.contractKw)
  const contractMeta = metaOf(factory, 'contractKw')
  const contractKw: FactoryFactEntry<number | null> =
    rawContract != null
      ? {
          key: 'contractKw',
          label: '契約容量',
          unit: 'kW',
          value: rawContract,
          source: contractMeta?.source === 'user' ? 'user' : 'estimate',
          note:
            contractMeta?.note ??
            (contractMeta?.source === 'user'
              ? '依貴廠填寫之台電契約容量'
              : '依註冊所選電費區間或既有資料估算，請確認實際台電契約容量'),
          isExplicit: true,
          updatedAt: contractMeta?.updatedAt,
        }
      : {
          key: 'contractKw',
          label: '契約容量',
          unit: 'kW',
          value: null,
          source: 'estimate',
          note: '尚未填寫契約容量（kW）',
          isExplicit: false,
        }

  const rawEquipment = factory?.factory.equipment ?? []
  const equipMeta = metaOf(factory, 'equipment')
  const equipSource: FactSourceKind = rawEquipment.length > 0 && equipMeta?.source === 'user' ? 'user' : 'estimate'
  const equipment: FactoryFactEntry<EquipmentItem[]> = {
    key: 'equipment',
    label: '主要設備清單',
    value: [...rawEquipment],
    source: equipSource,
    note:
      rawEquipment.length === 0
        ? '尚未填寫主要耗能設備明細'
        : (equipMeta?.note ??
          (equipSource === 'user' ? '依貴廠填寫之設備清單' : '既有設備資料未標註來源（請確認台數、額定 kW 與每日時數）')),
    isExplicit: rawEquipment.length > 0,
    updatedAt: equipMeta?.updatedAt,
  }

  const annualKwh = monthlyKwh.value != null ? Math.round(monthlyKwh.value * 12) : null
  const annualScope2T = annualKwh != null ? (annualKwh * ELECTRICITY_FACTOR) / 1000 : null
  const annualBillNtd =
    monthlyElectricBillNtd.value != null
      ? Math.round(monthlyElectricBillNtd.value * 12)
      : annualKwh != null
        ? Math.round(annualKwh * avgElectricityPriceNtd.value)
        : null

  return {
    monthlyKwh,
    monthlyElectricBillNtd,
    avgElectricityPriceNtd,
    contractKw,
    dailyHours,
    annualDays,
    annualOperatingHours: dailyHours.value * annualDays.value,
    equipment,
    byKey: {
      monthlyKwh,
      monthlyElectricBillNtd,
      avgElectricityPriceNtd,
      contractKw,
      dailyHours,
      annualDays,
      equipment,
    },
    derived: {
      monthlyKwh: monthlyKwh.value,
      monthlyKwhSource: monthlyKwh.source,
      monthlyKwhNote: monthlyKwh.note,
      annualKwh,
      annualScope2T,
      annualBillNtd,
    },
  }
}

/**
 * Build a minimal DataStore update patch for `store.update('companies', factory.id, patch)`
 * that records updated values and marks their provenance ('user' by default).
 */
export function buildFactoryFactPatch(
  factory: Factory,
  updates: FactoryFactUpdates,
  now: ISO,
  options?: { source?: FactSourceKind; notes?: Partial<Record<FactoryFactKey, string>> },
): { factory: Factory['factory']; updatedAt: ISO } {
  const source: FactSourceKind = options?.source ?? 'user'
  const nextFactory: Factory['factory'] = { ...factory.factory }
  const nextSources: Partial<Record<FactoryFactKey, FactoryFactSource>> = {
    ...(factory.factory.dataSources ?? {}),
  }

  for (const key of NUMERIC_FACT_KEYS) {
    if (!(key in updates)) continue
    const val = updates[key]
    if (val != null && Number.isFinite(val) && val > 0) {
      nextFactory[key] = val
      nextSources[key] = {
        source,
        ...(options?.notes?.[key] ? { note: options.notes[key] } : {}),
        updatedAt: now,
      }
    } else {
      nextFactory[key] = null
      nextSources[key] = {
        source: 'estimate',
        note: '尚未填寫',
        updatedAt: now,
      }
    }
  }

  if ('equipment' in updates && updates.equipment !== undefined) {
    nextFactory.equipment = updates.equipment
    if (updates.equipment.length > 0) {
      nextSources.equipment = {
        source,
        ...(options?.notes?.equipment ? { note: options.notes.equipment } : {}),
        updatedAt: now,
      }
    } else {
      nextSources.equipment = {
        source: 'estimate',
        note: '尚未填寫主要耗能設備明細',
        updatedAt: now,
      }
    }
  }

  // Keep derived monthlyKwh / monthlyElectricBillNtd coherent when one side is updated
  const effectivePrice = validPositive(nextFactory.avgElectricityPriceNtd) ?? DEFAULT_ELECTRICITY_PRICE_NTD
  if (
    'monthlyElectricBillNtd' in updates &&
    !('monthlyKwh' in updates) &&
    nextFactory.monthlyElectricBillNtd != null &&
    nextFactory.monthlyElectricBillNtd > 0 &&
    nextSources.monthlyKwh?.source !== 'user'
  ) {
    nextFactory.monthlyKwh = Math.round(nextFactory.monthlyElectricBillNtd / effectivePrice)
    nextSources.monthlyKwh = {
      source: 'estimate',
      note: `依每月電費 ${formatNtd(nextFactory.monthlyElectricBillNtd)} ÷ 電價 ${effectivePrice} 元/度估算`,
      updatedAt: now,
    }
  } else if (
    'avgElectricityPriceNtd' in updates &&
    !('monthlyKwh' in updates) &&
    nextFactory.monthlyElectricBillNtd != null &&
    nextFactory.monthlyElectricBillNtd > 0 &&
    nextSources.monthlyElectricBillNtd?.source === 'user' &&
    nextSources.monthlyKwh?.source !== 'user'
  ) {
    nextFactory.monthlyKwh = Math.round(nextFactory.monthlyElectricBillNtd / effectivePrice)
    nextSources.monthlyKwh = {
      source: 'estimate',
      note: `依每月電費 ${formatNtd(nextFactory.monthlyElectricBillNtd)} ÷ 電價 ${effectivePrice} 元/度估算`,
      updatedAt: now,
    }
  } else if (
    'monthlyKwh' in updates &&
    !('monthlyElectricBillNtd' in updates) &&
    nextSources.monthlyElectricBillNtd?.source !== 'user'
  ) {
    nextFactory.monthlyElectricBillNtd = null
    nextSources.monthlyElectricBillNtd = {
      source: 'estimate',
      note: '依月平均用電與電價估算',
      updatedAt: now,
    }
  }

  nextFactory.dataSources = nextSources
  return {
    factory: nextFactory,
    updatedAt: now,
  }
}

export interface AnnualCarbonSummary {
  year: number
  filledMonths: number
  /** Months filled by 「套用試算」 (estimates, never counted as filled). */
  estimatedMonths: number
  isMonthlyAverageFallback: boolean
  displayAnnualKwh: number
  scope1T: number
  displayScope2T: number
  displayTotalT: number
  factSource: FactSourceKind
}

/**
 * Single shared calculation for annual carbon display across Landing, Hub, and CarbonDashboard.
 * Uses filled monthly inventory when available; when 0 months are filled, falls back cleanly
 * to `facts.monthlyKwh * 12` so pages never show 0.0 tCO2e next to 369.7 tCO2e.
 */
export function resolveAnnualCarbonSummary(
  inv: CarbonInventory,
  facts: Pick<ResolvedFactoryFacts, 'monthlyKwh'>,
): AnnualCarbonSummary {
  const s = summarizeInventory(inv)
  const isMonthlyAverageFallback = s.filledMonths === 0 && s.estimatedMonths === 0 && facts.monthlyKwh.value != null
  const displayAnnualKwh = isMonthlyAverageFallback ? facts.monthlyKwh.value! * 12 : s.totalKwh
  const displayScope2T = isMonthlyAverageFallback ? (displayAnnualKwh * ELECTRICITY_FACTOR) / 1000 : s.scope2T
  const displayTotalT = s.scope1T + displayScope2T
  const filledSource: FactSourceKind = s.filledMonths === 12 ? 'user' : 'estimate'
  const factSource = overallFactSource([filledSource, facts.monthlyKwh.source])
  return {
    year: s.year,
    filledMonths: s.filledMonths,
    estimatedMonths: s.estimatedMonths,
    isMonthlyAverageFallback,
    displayAnnualKwh,
    scope1T: s.scope1T,
    displayScope2T,
    displayTotalT,
    factSource,
  }
}
