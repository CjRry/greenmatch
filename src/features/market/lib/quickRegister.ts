import type { City } from '../../../core/constants/geo'
import { INDUSTRIES, scaleFromEmployees } from '../../../core/constants/equipment'
import { emptyInventory } from '../../../core/domain/carbon'
import type { CarbonInventory, Equip, Factory, FactoryFactKey, FactoryFactSource, Specialty, Vendor } from '../../../core/types'

export interface ElectricityTier {
  key: string
  label: string
  hint: string
  monthlyKwh: number
  contractKw: number
}

export const ELECTRICITY_TIERS: readonly ElectricityTier[] = [
  { key: 's', label: '約 8–15 萬 / 月', hint: '約 2–3.5 萬度 / 月', monthlyKwh: 28000, contractKw: 95 },
  { key: 'm', label: '約 15–40 萬 / 月', hint: '約 3.5–9.5 萬度 / 月', monthlyKwh: 65000, contractKw: 240 },
  { key: 'l', label: '約 40–100 萬 / 月', hint: '約 9.5–24 萬度 / 月', monthlyKwh: 160000, contractKw: 550 },
  { key: 'xl', label: '100 萬以上 / 月', hint: '24 萬度以上 / 月', monthlyKwh: 320000, contractKw: 1100 },
]

export interface QuickCompanyInput {
  role: 'factory' | 'vendor'
  name: string
  city: City | ''
  employees: number
  industry: string
  electricityTierKey: string
  customMonthlyKwh: string
  equips: Equip[]
  specialties: Specialty[]
  assistsSubsidy: boolean
}

export function validateQuickCompany(input: QuickCompanyInput): Partial<Record<'name' | 'city' | 'employees' | 'items', string>> {
  const errors: Partial<Record<'name' | 'city' | 'employees' | 'items', string>> = {}
  if (!input.name.trim()) errors.name = '請填公司名稱'
  if (!input.city) errors.city = '請選擇縣市'
  if (!Number.isFinite(input.employees) || input.employees <= 0) errors.employees = '請填寫員工人數（大於 0）'
  if (input.role === 'factory' && input.equips.length === 0) errors.items = '請至少勾選 1 項主要耗能設備'
  if (input.role === 'vendor' && input.specialties.length === 0) errors.items = '請至少勾選 1 項服務專長'
  return errors
}

function parseCustomKwh(raw: string): number | null {
  const normalized = raw
    .trim()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s]/g, '')
  if (!normalized) return null
  const custom = Number(normalized)
  return Number.isFinite(custom) && custom > 0 ? Math.round(custom) : null
}

export function resolveQuickMonthlyKwh(tierKey: string, customMonthlyKwh: string): number | null {
  const custom = parseCustomKwh(customMonthlyKwh)
  if (custom != null) return custom
  return ELECTRICITY_TIERS.find((t) => t.key === tierKey)?.monthlyKwh ?? null
}

/** Build a clean, non-demo Factory record from the 30-second blank-workspace wizard. */
export function buildQuickFactory(
  input: QuickCompanyInput,
  meta: { id: string; now: string; ownerId: string | null },
): Factory {
  const emp = Math.max(1, Math.round(input.employees))
  const tier = ELECTRICITY_TIERS.find((t) => t.key === input.electricityTierKey)
  const customKwh = parseCustomKwh(input.customMonthlyKwh)
  const hasCustomKwh = customKwh != null
  const monthlyKwh = customKwh ?? (tier?.monthlyKwh ?? null)
  const contractKw = hasCustomKwh ? null : (tier?.contractKw ?? null)
  const dataSources: Partial<Record<FactoryFactKey, FactoryFactSource>> = {
    equipment: {
      source: 'estimate',
      note: '快速建立只勾了設備類型，台數暫記 1 台；請到工廠數據改成實際台數、kW 與運轉時數',
      updatedAt: meta.now,
    },
  }
  if (monthlyKwh != null) {
    dataSources.monthlyKwh = hasCustomKwh
      ? { source: 'user', note: '註冊時自行輸入每月平均用電度數', updatedAt: meta.now }
      : { source: 'estimate', note: `依註冊所選電費區間（${tier?.label ?? input.electricityTierKey}）估算`, updatedAt: meta.now }
  }
  if (contractKw != null) {
    dataSources.contractKw = {
      source: 'estimate',
      note: `依註冊所選電費區間（${tier?.label ?? input.electricityTierKey}）估算`,
      updatedAt: meta.now,
    }
  }
  return {
    id: meta.id,
    role: 'factory',
    name: input.name.trim(),
    city: input.city as City,
    // Quick register never asks for these, so they stay empty (shown as 「尚未填寫」) instead of
    // looking like real data (OBS-0004 §2-2).
    contactName: '',
    intro: '',
    ownerId: meta.ownerId,
    isDemo: false,
    createdAt: meta.now,
    updatedAt: meta.now,
    factory: {
      scale: scaleFromEmployees(emp),
      employees: emp,
      industry: input.industry || INDUSTRIES[0],
      products: '',
      mainCustomers: [],
      pressures: ['cost'],
      monthlyKwh,
      contractKw,
      // The factory ticked the type; the count is unknown, so each row is an estimate until confirmed.
      equipment: input.equips.map((type) => ({ type, quantity: 1, yearInstalled: null, source: 'estimate' as const })),
      dataSources,
    },
  }
}

/** Build a clean, non-demo Vendor record from the 30-second blank-workspace wizard. */
export function buildQuickVendor(
  input: QuickCompanyInput,
  meta: { id: string; now: string; ownerId: string | null },
): Vendor {
  const emp = Math.max(1, Math.round(input.employees))
  const city = input.city as City
  return {
    id: meta.id,
    role: 'vendor',
    name: input.name.trim(),
    city,
    contactName: '',
    intro: '',
    ownerId: meta.ownerId,
    isDemo: false,
    createdAt: meta.now,
    updatedAt: meta.now,
    vendor: {
      tagline: '',
      specialties: input.specialties,
      serviceCities: [city],
      foundedYear: new Date().getFullYear(),
      employees: emp,
      completedCases: 0,
      sizeFit: [scaleFromEmployees(emp)],
      certifications: [],
      responseHours: 24,
      assistsSubsidy: input.assistsSubsidy,
      portfolio: [],
    },
  }
}

/** Seed a clean current-year CarbonInventory when the factory provided an estimated monthly kWh. */
export function buildInitialCarbonFromQuick(
  factoryId: string,
  monthlyKwh: number | null,
  _equips: readonly Equip[],
  now: string,
  year = 2026,
): CarbonInventory | null {
  if (!monthlyKwh || monthlyKwh <= 0) return null
  const inv = emptyInventory(factoryId, year, now)
  return {
    ...inv,
    steps: { ...inv.steps, boundary: 'doing' },
    months: inv.months,
    electricityShare: [],
    electricityShareSource: 'estimate',
  }
}
