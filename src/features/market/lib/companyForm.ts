import type { City } from '../../../core/constants/geo'
import { scaleFromEmployees } from '../../../core/constants/equipment'
import type {
  Company,
  Equip,
  EquipmentItem,
  Factory,
  FactSourceKind,
  FactoryFactKey,
  FactoryFactSource,
  PortfolioItem,
  Pressure,
  Role,
  ScaleTier,
  Specialty,
  Vendor,
} from '../../../core/types'

export interface EquipRow {
  type: Equip | ''
  quantity: string
  year: string
  kw?: string
  dailyHours?: string
  /** UI hint only: the row is still a template estimate (e.g. quick register's 「1 台」). */
  estimated?: boolean
}

export interface PortfolioRow {
  title: string
  industry?: string
  city: City | ''
  equip: Specialty | ''
  savingPct: string
  year: string
}

/** Everything the registration form edits, as strings so half-typed input is never lost. */
export interface CompanyDraft {
  name: string
  city: City | ''
  district: string
  contactName: string
  contactTitle: string
  phone: string
  email: string
  taxId: string
  intro: string
  employees: string
  // factory
  industry: string
  products: string
  mainCustomers: string[]
  pressures: Pressure[]
  monthlyKwh: string
  monthlyElectricBillNtd: string
  avgElectricityPriceNtd: string
  contractKw: string
  dailyHours: string
  annualDays: string
  revenueOver100M: '' | 'yes' | 'no'
  hasFactoryReg: '' | 'yes' | 'no'
  equipment: EquipRow[]
  // vendor
  tagline: string
  specialties: Specialty[]
  serviceCities: City[]
  servedIndustries: string[]
  foundedYear: string
  completedCases: string
  sizeFit: ScaleTier[]
  certifications: string[]
  responseHours: string
  assistsSubsidy: boolean
  portfolio: PortfolioRow[]
}

export type DraftErrors = Partial<Record<string, string>>

export const emptyDraft = (): CompanyDraft => ({
  name: '',
  city: '',
  district: '',
  contactName: '',
  contactTitle: '',
  phone: '',
  email: '',
  taxId: '',
  intro: '',
  employees: '',
  industry: '',
  products: '',
  mainCustomers: [],
  pressures: [],
  monthlyKwh: '',
  monthlyElectricBillNtd: '',
  avgElectricityPriceNtd: '',
  contractKw: '',
  dailyHours: '',
  annualDays: '',
  revenueOver100M: '',
  hasFactoryReg: '',
  equipment: [],
  tagline: '',
  specialties: [],
  serviceCities: [],
  servedIndustries: [],
  foundedYear: '',
  completedCases: '',
  sizeFit: [],
  certifications: [],
  responseHours: '',
  assistsSubsidy: false,
  portfolio: [],
})

const str = (n: number | null | undefined) => (n == null ? '' : String(n))

/** Fill the form from an existing company (edit page). */
export function draftFromCompany(c: Company): CompanyDraft {
  const d: CompanyDraft = {
    ...emptyDraft(),
    name: c.name,
    city: c.city,
    district: c.district ?? '',
    contactName: c.contactName,
    contactTitle: c.contactTitle ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    taxId: c.taxId ?? '',
    intro: c.intro,
  }
  if (c.role === 'factory') {
    const f = c.factory
    return {
      ...d,
      employees: String(f.employees),
      industry: f.industry,
      products: f.products,
      mainCustomers: [...f.mainCustomers],
      pressures: [...f.pressures],
      monthlyKwh: str(f.monthlyKwh),
      monthlyElectricBillNtd: str(f.monthlyElectricBillNtd),
      avgElectricityPriceNtd: str(f.avgElectricityPriceNtd),
      contractKw: str(f.contractKw),
      dailyHours: str(f.dailyHours),
      annualDays: str(f.annualDays),
      revenueOver100M: f.revenueOver100M == null ? '' : f.revenueOver100M ? 'yes' : 'no',
      hasFactoryReg: f.hasFactoryReg == null ? '' : f.hasFactoryReg ? 'yes' : 'no',
      equipment: f.equipment.map((e) => ({
        type: e.type,
        quantity: String(e.quantity),
        year: str(e.yearInstalled),
        ...(e.ratedKw != null ? { kw: String(e.ratedKw) } : {}),
        ...(e.dailyHours != null ? { dailyHours: String(e.dailyHours) } : {}),
        ...(e.source === 'estimate' ? { estimated: true } : {}),
      })),
    }
  }
  const v = c.vendor
  return {
    ...d,
    employees: String(v.employees),
    tagline: v.tagline,
    specialties: [...v.specialties],
    serviceCities: [...v.serviceCities],
    servedIndustries: [...(v.servedIndustries ?? [])],
    foundedYear: String(v.foundedYear),
    completedCases: String(v.completedCases),
    sizeFit: [...v.sizeFit],
    certifications: [...v.certifications],
    responseHours: String(v.responseHours),
    assistsSubsidy: !!v.assistsSubsidy,
    portfolio: v.portfolio.map((p) => ({
      title: p.title,
      industry: p.industry ?? '',
      city: p.city,
      equip: p.equip,
      savingPct: str(p.savingPct),
      year: String(p.year),
    })),
  }
}

const THIS_YEAR = new Date().getFullYear()

function toInt(s: string): number | null {
  const t = s.trim()
  if (!/^\d+$/.test(t)) return null
  return Number(t)
}

function toNum(s: string): number | null {
  const t = s.trim()
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null
  return Number(t)
}

/** Same equipment row ignoring provenance (used to keep an untouched row's source on save). */
export function sameEquipRow(a: EquipmentItem, b: EquipmentItem): boolean {
  return (
    a.type === b.type &&
    a.quantity === b.quantity &&
    (a.yearInstalled ?? null) === (b.yearInstalled ?? null) &&
    (a.ratedKw ?? null) === (b.ratedKw ?? null) &&
    (a.dailyHours ?? null) === (b.dailyHours ?? null)
  )
}

const blankEquip = (r: EquipRow) =>
  !r.type && !r.quantity.trim() && !r.year.trim() && !(r.kw ?? '').trim() && !(r.dailyHours ?? '').trim()
const blankPortfolio = (r: PortfolioRow) => !r.title.trim() && !(r.industry ?? '').trim() && !r.city && !r.equip && !r.savingPct.trim() && !r.year.trim()

/**
 * Step 0 fields: shared by both roles. For factories, contact name and intro are optional
 * (quick register doesn't ask for them; OBS-0004 §2-2), so saving energy data never blocks on them.
 */
export function validateBasic(d: CompanyDraft, role?: Role): DraftErrors {
  const e: DraftErrors = {}
  if (!d.name.trim()) e.name = '請填寫公司名稱'
  if (!d.city) e.city = '請選擇公司所在縣市'
  if (role !== 'factory' && !d.contactName.trim()) e.contactName = '請填寫聯絡人姓名'
  if (role !== 'factory' && !d.intro.trim()) e.intro = '請用一兩句話介紹公司'
  if (d.email.trim() && !/^\S+@\S+\.\S+$/.test(d.email.trim())) e.email = 'Email 格式不正確，請檢查是否漏了 @ 或網域'
  if (d.taxId.trim() && !/^\d{8}$/.test(d.taxId.trim())) e.taxId = '統一編號為 8 位數字'
  return e
}

/** Step 1 fields: factory or vendor specific. */
export function validateRole(d: CompanyDraft, role: Role): DraftErrors {
  const e: DraftErrors = {}
  const emp = toInt(d.employees)
  if (!d.employees.trim()) e.employees = '請填寫員工人數'
  else if (emp == null || emp < 1) e.employees = '員工人數請填 1 以上的整數'

  if (d.monthlyKwh.trim() && toNum(d.monthlyKwh) == null) e.monthlyKwh = '用電度數請填數字'

  if (role === 'factory') {
    if (d.monthlyElectricBillNtd.trim()) {
      const bill = toNum(d.monthlyElectricBillNtd)
      if (bill == null || bill <= 0) e.monthlyElectricBillNtd = '每月電費請填大於 0 的數字'
    }
    if (d.avgElectricityPriceNtd.trim()) {
      const price = toNum(d.avgElectricityPriceNtd)
      if (price == null || price <= 0) e.avgElectricityPriceNtd = '平均電價請填大於 0 的數字（元／度）'
    }
    if (d.contractKw.trim()) {
      const kw = toNum(d.contractKw)
      if (kw == null || kw <= 0) e.contractKw = '契約容量請填大於 0 的數字（kW）'
    }
    if (d.dailyHours.trim()) {
      const hrs = toNum(d.dailyHours)
      if (hrs == null || hrs <= 0 || hrs > 24) e.dailyHours = '每日運轉時數請填 0–24 的數字'
    }
    if (d.annualDays.trim()) {
      const days = toInt(d.annualDays)
      if (days == null || days < 1 || days > 366) e.annualDays = '年運轉天數請填 1–366 的整數'
    }
    if (!d.industry) e.industry = '請選擇產業'
    if (!d.pressures.length) e.pressures = '請至少選擇 1 項推動減碳的原因'
    d.equipment.forEach((r, i) => {
      if (blankEquip(r)) return
      const q = toInt(r.quantity)
      if (!r.type) e[`equipment.${i}.type`] = '請選擇設備類型'
      if (q == null || q < 1) e[`equipment.${i}.quantity`] = '數量請填 1 以上的整數'
      if (r.year.trim()) {
        const y = toInt(r.year)
        if (y == null || y < 1950 || y > THIS_YEAR) e[`equipment.${i}.year`] = `啟用年份請填 1950–${THIS_YEAR}`
      }
      if (r.kw?.trim()) {
        const kw = toNum(r.kw)
        if (kw == null || kw <= 0) e[`equipment.${i}.kw`] = '每台功率請填大於 0 的數字'
      }
      if (r.dailyHours?.trim()) {
        const hrs = toNum(r.dailyHours)
        if (hrs == null || hrs <= 0 || hrs > 24) e[`equipment.${i}.dailyHours`] = '每日時數請填 0–24 的數字'
      }
    })
    return e
  }

  if (!d.tagline.trim()) e.tagline = '請用一句話介紹你的服務'
  if (!d.specialties.length) e.specialties = '請至少選擇 1 項服務項目'
  if (!d.serviceCities.length) e.serviceCities = '請至少選擇 1 個服務縣市'
  const y = toInt(d.foundedYear)
  if (!d.foundedYear.trim()) e.foundedYear = '請填寫成立年份'
  else if (y == null || y < 1900 || y > THIS_YEAR) e.foundedYear = `成立年份請填 1900–${THIS_YEAR}`
  if (!d.sizeFit.length) e.sizeFit = '請至少選擇 1 種適合的客戶規模'
  if (d.completedCases.trim() && toInt(d.completedCases) == null) e.completedCases = '完成案件數請填整數'
  if (d.responseHours.trim() && toNum(d.responseHours) == null) e.responseHours = '回覆時間請填數字（小時）'
  d.portfolio.forEach((r, i) => {
    if (blankPortfolio(r)) return
    if (!r.title.trim()) e[`portfolio.${i}.title`] = '請填寫案例名稱'
    if (!r.city) e[`portfolio.${i}.city`] = '請選擇縣市'
    if (!r.equip) e[`portfolio.${i}.equip`] = '請選擇項目'
    if (r.savingPct.trim()) {
      const p = toNum(r.savingPct)
      if (p == null || p > 100) e[`portfolio.${i}.savingPct`] = '節電 % 請填 0–100'
    }
    const py = toInt(r.year)
    if (py == null || py < 1990 || py > THIS_YEAR) e[`portfolio.${i}.year`] = `年份請填 1990–${THIS_YEAR}`
  })
  return e
}

export function validateAll(d: CompanyDraft, role: Role): DraftErrors {
  return { ...validateBasic(d, role), ...validateRole(d, role) }
}

export interface BuildMeta {
  id: string
  now: string
  ownerId?: string | null
  /** Edit: keep these from the existing record. */
  existing?: Company
  /** Fact keys whose estimated value the user explicitly confirmed as their actual figure. */
  confirmedFactKeys?: readonly FactoryFactKey[]
}

const clean = (s: string) => s.trim()

/** Turn a validated draft into a Company. Call only after validateAll returns no errors. */
export function buildCompany(d: CompanyDraft, role: Role, meta: BuildMeta): Company {
  const base = {
    id: meta.id,
    name: clean(d.name),
    city: d.city as City,
    district: clean(d.district),
    contactName: clean(d.contactName),
    contactTitle: clean(d.contactTitle),
    phone: clean(d.phone),
    email: clean(d.email),
    taxId: clean(d.taxId),
    intro: clean(d.intro),
    createdAt: meta.existing?.createdAt ?? meta.now,
    updatedAt: meta.now,
    ownerId: meta.existing ? (meta.existing.ownerId ?? null) : (meta.ownerId ?? null),
    isDemo: meta.existing ? !!meta.existing.isDemo : false,
  }
  const employees = Number(d.employees.trim())
  if (role === 'factory') {
    const equipment: EquipmentItem[] = d.equipment
      .filter((r) => !blankEquip(r))
      .map((r) => ({
        type: r.type as Equip,
        quantity: Number(r.quantity),
        yearInstalled: r.year.trim() ? Number(r.year) : null,
        ...(r.kw?.trim() ? { ratedKw: toNum(r.kw) } : {}),
        ...(r.dailyHours?.trim() ? { dailyHours: toNum(r.dailyHours) } : {}),
      }))
    const existingFactory = meta.existing?.role === 'factory' ? meta.existing.factory : null
    const prevSources = existingFactory?.dataSources ?? {}
    const confirmed = new Set(meta.confirmedFactKeys ?? [])
    const monthlyKwh = toNum(d.monthlyKwh)
    const monthlyElectricBillNtd = toNum(d.monthlyElectricBillNtd)
    const avgElectricityPriceNtd = toNum(d.avgElectricityPriceNtd)
    const contractKw = toNum(d.contractKw)
    const dailyHours = toNum(d.dailyHours)
    const annualDays = toInt(d.annualDays)

    const numericValues: Record<Exclude<FactoryFactKey, 'equipment'>, number | null> = {
      monthlyKwh,
      monthlyElectricBillNtd,
      avgElectricityPriceNtd,
      contractKw,
      dailyHours,
      annualDays,
    }
    const dataSources: Partial<Record<FactoryFactKey, FactoryFactSource>> = {}
    for (const k of Object.keys(numericValues) as Exclude<FactoryFactKey, 'equipment'>[]) {
      const val = numericValues[k]
      if (val != null && val > 0) {
        if (!existingFactory || val !== existingFactory[k] || prevSources[k]?.source === 'user' || confirmed.has(k)) {
          const preservedNote =
            existingFactory && val === existingFactory[k] && prevSources[k]?.source === 'user'
              ? prevSources[k]?.note
              : undefined
          dataSources[k] = {
            source: 'user',
            note: preservedNote ?? (confirmed.has(k) && val === existingFactory?.[k] ? '已確認為貴廠實際數字' : '貴廠填寫的實際數字'),
            updatedAt: meta.now,
          }
        } else {
          dataSources[k] = prevSources[k] ?? {
            source: 'estimate',
            note: '既有欄位未標註來源，暫依欄位數值估算',
            updatedAt: meta.now,
          }
        }
      } else if (existingFactory) {
        dataSources[k] = { source: 'estimate', note: '尚未填寫', updatedAt: meta.now }
      }
    }

    // Per-row provenance (OBS-0004 §2-2): a row becomes 'user' only when the factory typed it (new or
    // changed) or confirmed the list. Untouched template rows keep their 'estimate' source even when
    // another row in the same list was edited.
    const listSource: FactSourceKind = prevSources.equipment?.source === 'user' ? 'user' : 'estimate'
    const unmatched = [...(existingFactory?.equipment ?? [])]
    for (const row of equipment) {
      const i = unmatched.findIndex((e) => sameEquipRow(e, row))
      if (confirmed.has('equipment') || i < 0) {
        row.source = 'user'
      } else {
        row.source = unmatched[i].source ?? listSource
        unmatched.splice(i, 1)
      }
    }
    if (equipment.length > 0) {
      const estimated = equipment.filter((r) => r.source !== 'user').length
      if (estimated === 0) {
        const unchangedUserList =
          existingFactory != null && listSource === 'user' && unmatched.length === 0 && equipment.length === existingFactory.equipment.length
        dataSources.equipment = {
          source: 'user',
          note: (unchangedUserList ? prevSources.equipment?.note : undefined) ?? '貴廠填寫／確認的設備明細',
          updatedAt: meta.now,
        }
      } else {
        dataSources.equipment = {
          source: 'estimate',
          note: `${equipment.length} 項設備中有 ${estimated} 項是平台帶入的估算，還沒有確認；請改成實際台數或刪除`,
          updatedAt: meta.now,
        }
      }
    } else if (existingFactory) {
      dataSources.equipment = { source: 'estimate', note: '尚未填寫主要耗能設備明細', updatedAt: meta.now }
    }

    const f: Factory = {
      ...base,
      role: 'factory',
      factory: {
        industry: d.industry,
        products: clean(d.products),
        employees,
        scale: scaleFromEmployees(employees),
        mainCustomers: d.mainCustomers.map(clean).filter(Boolean),
        pressures: d.pressures,
        monthlyKwh,
        ...(existingFactory || monthlyElectricBillNtd != null ? { monthlyElectricBillNtd } : {}),
        ...(existingFactory || avgElectricityPriceNtd != null ? { avgElectricityPriceNtd } : {}),
        ...(existingFactory || contractKw != null ? { contractKw } : {}),
        ...(existingFactory || dailyHours != null ? { dailyHours } : {}),
        ...(existingFactory || annualDays != null ? { annualDays } : {}),
        ...(d.revenueOver100M ? { revenueOver100M: d.revenueOver100M === 'yes' } : {}),
        ...(d.hasFactoryReg ? { hasFactoryReg: d.hasFactoryReg === 'yes' } : {}),
        equipment,
        dataSources,
      },
    }
    return f
  }
  const portfolio: PortfolioItem[] = d.portfolio
    .filter((r) => !blankPortfolio(r))
    .map((r) => ({
      title: clean(r.title),
      ...(clean(r.industry ?? '') ? { industry: clean(r.industry ?? '') } : {}),
      city: r.city as City,
      equip: r.equip as Specialty,
      savingPct: r.savingPct.trim() ? Number(r.savingPct) : null,
      year: Number(r.year),
    }))
  const servedIndustries = d.servedIndustries.map(clean).filter(Boolean)
  const v: Vendor = {
    ...base,
    role: 'vendor',
    vendor: {
      tagline: clean(d.tagline),
      specialties: d.specialties,
      serviceCities: d.serviceCities,
      ...(servedIndustries.length ? { servedIndustries } : {}),
      foundedYear: Number(d.foundedYear),
      employees,
      completedCases: d.completedCases.trim() ? Number(d.completedCases) : 0,
      sizeFit: d.sizeFit,
      certifications: d.certifications.map(clean).filter(Boolean),
      responseHours: d.responseHours.trim() ? Number(d.responseHours) : 24,
      ...(d.assistsSubsidy ? { assistsSubsidy: true } : {}),
      portfolio,
    },
  }
  return v
}

/** Reads ?role= safely. */
export function parseRole(v: string | null): Role | null {
  return v === 'factory' || v === 'vendor' ? v : null
}
