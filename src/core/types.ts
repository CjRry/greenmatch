/**
 * Domain contract for 綠媒 GreenMatch. Frozen once agents start: every feature reads and writes
 * these shapes through the DataStore. Ask the CEO before changing anything here.
 */
import type { City } from './constants/geo'

export type Role = 'factory' | 'vendor'
/** ISO 8601 timestamp, e.g. "2026-10-26T09:30:00.000Z". */
export type ISO = string

/** Energy-using equipment a factory owns and a vendor can improve. */
export type Equip =
  | 'air_compressor'
  | 'hvac'
  | 'chiller'
  | 'lighting'
  | 'motor_vfd'
  | 'boiler'
  | 'pump_fan'
  | 'heat_pump'
  | 'solar_pv'
  | 'ems'
/** What a vendor offers: equipment work, or carbon-inventory consulting. */
export type Specialty = Equip | 'carbon_consulting'
/** S: fewer than 50 employees, M: 50–199, L: 200 or more. */
export type ScaleTier = 'S' | 'M' | 'L'
/** Why the factory is acting on carbon now (from the team's survey). */
export type Pressure = 'customer' | 'regulation' | 'cost' | 'expansion'

/** The 8 standard stages of an energy-saving case, in order. */
export type StageKey =
  | 'register'
  | 'assess'
  | 'survey'
  | 'quote'
  | 'contract'
  | 'construction'
  | 'acceptance'
  | 'compare'
/** The 6 steps of a carbon inventory (碳盤查). */
export type InvStep = 'boundary' | 'sources' | 'activity' | 'calc' | 'report' | 'verify'
export type StepState = 'todo' | 'doing' | 'done'
/** Who produced a structured result: Claude, the rule-based fallback, or a person. */
export type Source = 'claude' | 'rules' | 'manual'

interface CompanyBase {
  id: string
  name: string
  city: City
  district?: string
  contactName: string
  contactTitle?: string
  phone?: string
  email?: string
  taxId?: string
  /** One or two sentences shown on cards and profile pages. */
  intro: string
  createdAt: ISO
  updatedAt: ISO
  /** Viewer id (shared mode) of whoever registered it; null for demo data. */
  ownerId?: string | null
  /** True for fictional demonstration records. The UI shows a 「示範」 badge. */
  isDemo?: boolean
}

export type FactSourceKind = 'user' | 'estimate'

export type FactoryFactKey =
  | 'monthlyKwh'
  | 'monthlyElectricBillNtd'
  | 'avgElectricityPriceNtd'
  | 'contractKw'
  | 'dailyHours'
  | 'annualDays'
  | 'equipment'

export interface FactoryFactSource {
  source: FactSourceKind
  note?: string
  updatedAt?: ISO
}

export interface EquipmentItem {
  type: Equip
  quantity: number
  yearInstalled?: number | null
  ratedKw?: number | null
  /** Daily operating hours, e.g. 16. */
  dailyHours?: number | null
  /**
   * Per-row provenance. 'user' once the factory typed or confirmed this row; 'estimate' for rows a
   * template put there. Missing = follows `dataSources.equipment`.
   */
  source?: FactSourceKind
}

export interface Factory extends CompanyBase {
  role: 'factory'
  factory: {
    industry: string
    products: string
    employees: number
    scale: ScaleTier
    mainCustomers: string[]
    pressures: Pressure[]
    /** Average monthly electricity use, kWh. */
    monthlyKwh?: number | null
    /** Average monthly electricity bill, NTD. */
    monthlyElectricBillNtd?: number | null
    /** Average electricity price, NTD / kWh. */
    avgElectricityPriceNtd?: number | null
    /** Contracted power capacity, kW. Used to check subsidy eligibility (e.g. ESPC >= 100 kW). */
    contractKw?: number | null
    /** Daily operating hours, e.g. 16. */
    dailyHours?: number | null
    /** Annual operating days, e.g. 300. */
    annualDays?: number | null
    /** Whether annual revenue is NT$ 100M or above (affects annual subsidy cap). */
    revenueOver100M?: boolean | null
    /** Whether the factory holds a factory registration (工廠登記). */
    hasFactoryReg?: boolean | null
    equipment: EquipmentItem[]
    /** Provenance metadata per factory fact key; missing entries default to 'estimate' on read. */
    dataSources?: Partial<Record<FactoryFactKey, FactoryFactSource>>
  }
}

export interface PortfolioItem {
  title: string
  /** Optional customer industry matching INDUSTRIES (e.g. 金屬加工). */
  industry?: string
  city: City
  equip: Specialty
  savingPct?: number | null
  year: number
}

export interface Vendor extends CompanyBase {
  role: 'vendor'
  vendor: {
    tagline: string
    specialties: Specialty[]
    serviceCities: City[]
    /** Industries this vendor has collaborated with (matching INDUSTRIES). */
    servedIndustries?: string[]
    foundedYear: number
    employees: number
    completedCases: number
    /** Factory sizes this vendor works well with. */
    sizeFit: ScaleTier[]
    certifications: string[]
    /** Typical first-response time, hours. */
    responseHours: number
    /** Whether the vendor assists factories with government subsidy applications. */
    assistsSubsidy?: boolean
    portfolio: PortfolioItem[]
  }
}

export type Company = Factory | Vendor

/**
 * One line of the standard need form (標準需求表): a piece of equipment. 'carbon_consulting' only
 * appears in needs saved before the platform dropped consulting firms; new needs never use it.
 */
export interface NeedItem {
  equip: Specialty
  quantity: number | null
  /** Rated power per unit in kW, when known. */
  ratedKw?: number | null
  /** Age in years when known; ageText keeps the factory's own words (「十幾年」). */
  ageYears: number | null
  ageText?: string | null
  note?: string | null
}

/** The standard need form: 設備類型、數量、設備年份、主要問題、可能改善方向. */
export interface NeedForm {
  items: NeedItem[]
  monthlyElectricBillNtd?: number | null
  mainProblems: string[]
  directions: string[]
  /** Things the AI could not tell from the description; the factory answers or leaves them. */
  openQuestions: string[]
}

export type NeedStatus = 'open' | 'matched' | 'closed'

export interface Need {
  id: string
  factoryId: string
  title: string
  /** The factory's own words, kept verbatim. */
  rawText: string
  form: NeedForm
  /** Who structured the form. The factory always confirms it before it is saved. */
  source: Source
  status: NeedStatus
  city: City
  scale: ScaleTier
  budgetNtd?: number | null
  /** Free text such as 「年底前完成」. */
  timeline?: string | null
  /** Vendors who clicked 「我有興趣」 on the needs board. */
  interestedVendorIds: string[]
  caseId?: string | null
  confirmedAt: ISO
  createdAt: ISO
  updatedAt: ISO
  isDemo?: boolean
}

export type FactorKey = 'specialty' | 'distance' | 'track' | 'rating' | 'scale'

export interface FactorScore {
  /** Item score, 0–1. */
  s: number
  /** Weight used, 0–1 (weights sum to 1). */
  w: number
  /** Human-readable basis, e.g. 「約 12 公里」. */
  detail: string
}

export interface Recommendation {
  vendorId: string
  rank: 1 | 2
  /** 0–100. */
  score: number
  factors: Record<FactorKey, FactorScore>
  reasons: string[]
  /** reasons joined with 「、」, e.g. 「空壓機專長相符、距離近（約 12 公里）」. */
  reasonText: string
}

export type CaseStatus = 'active' | 'completed' | 'cancelled'

export interface UsagePoint {
  /** "YYYY-MM" */
  month: string
  kwh: number
  phase: 'before' | 'after'
}

export interface Case {
  id: string
  needId: string
  factoryId: string
  title: string
  stage: StageKey
  stageStartedAt: ISO
  status: CaseStatus
  recommendations: Recommendation[]
  /** Vendors the factory invited for a site survey (normally the 2 recommended). */
  shortlist: string[]
  /** The vendor the factory signed with (from stage 'contract'). */
  selectedVendorId?: string | null
  surveyDate?: ISO | null
  contractNtd?: number | null
  startDate?: ISO | null
  endDate?: ISO | null
  /** Average monthly kWh before and after the retrofit (stage 'compare'). */
  baselineKwh?: number | null
  afterKwh?: number | null
  usage?: UsagePoint[]
  createdAt: ISO
  updatedAt: ISO
  completedAt?: ISO | null
  isDemo?: boolean
}

export type CaseEventKind = 'stage_done' | 'note' | 'schedule' | 'quote' | 'select' | 'review' | 'progress'

/** Append-only timeline entry. Factory and vendor each add their own, so writes never collide. */
export interface CaseEvent {
  id: string
  caseId: string
  stage: StageKey
  kind: CaseEventKind
  actor: Role | 'platform'
  actorId?: string | null
  text: string
  at: ISO
  isDemo?: boolean
}

/** The unified quote fields the AI explanation compares. null = not stated in the quote. */
export interface QuoteFields {
  equipmentNtd: number | null
  installNtd: number | null
  warrantyYears: number | null
  monthlySaveKwh: number | null
  monthlySaveNtd: number | null
  savePct: number | null
  paybackMonths: number | null
  /** The baseline period the savings estimate is measured against, e.g. 「2025 年 7–9 月」. */
  baseline: string | null
  /** PROP-0007 4c standard quote fields (all optional for backwards compatibility). */
  equipmentModel?: string | null
  ratedKw?: number | null
  efficiencyGrade?: string | null
  subsidyRegistered?: boolean | null
  savingsBasis?: 'metered' | 'assumed' | null
  mvMethod?: string | null
}

export interface Quote {
  id: string
  caseId: string
  vendorId: string
  /** The quote as the vendor wrote it. Formats differ between vendors. */
  rawText: string
  /** Optional fields the vendor typed into the submit form. */
  declared?: Partial<QuoteFields>
  submittedAt: ISO
  isDemo?: boolean
}

export interface QuoteComparisonRow {
  vendorId: string
  fields: QuoteFields
  unreadable: (keyof QuoteFields)[]
  /** Plain-language notes per field, e.g. 「含 3 台 37kW 變頻空壓機」. */
  notes?: Partial<Record<keyof QuoteFields, string>>
}

/** Saved AI quote explanation for a case. Document id = caseId. */
export interface QuoteComparison {
  id: string
  caseId: string
  source: Source
  generatedAt: ISO
  rows: QuoteComparisonRow[]
  /** 建議向廠商確認的問題. */
  questions: { vendorId?: string | null; text: string }[]
  summary?: string | null
  isDemo?: boolean
}

export interface Review {
  id: string
  /** The platform case reviewed, or null for earlier work done outside the platform. */
  caseId: string | null
  vendorId: string
  factoryId: string
  rating: 1 | 2 | 3 | 4 | 5
  comment: string
  createdAt: ISO
  isDemo?: boolean
}

export type Fuel = 'diesel' | 'gasoline' | 'natural_gas' | 'lpg' | 'fuel_oil'

export interface FuelUse {
  fuel: Fuel
  /** In the fuel's unit from FUELS (L or m³). */
  amount: number
}

export interface CarbonMonth {
  /** 1–12 */
  m: number
  kwh: number | null
  /**
   * Provenance of `kwh`. Missing = 'user' (typed in month by month from the bill).
   * 'estimate' = written by the quick calculator's 「套用試算」; never counts as a filled month.
   */
  kwhSource?: FactSourceKind
  fuels: FuelUse[]
}

/** One document per factory and year. id = `${factoryId}_${year}`. */
export interface CarbonInventory {
  id: string
  factoryId: string
  year: number
  steps: Record<InvStep, StepState>
  months: CarbonMonth[]
  /** Factory's estimate of how electricity splits across equipment, shares summing to about 1. */
  electricityShare?: { equip: Equip; share: number }[]
  /** Provenance of electricityShare; missing defaults to 'estimate' on read. */
  electricityShareSource?: FactSourceKind
  updatedAt: ISO
  isDemo?: boolean
}

export type Collections = {
  companies: Company
  needs: Need
  cases: Case
  caseEvents: CaseEvent
  quotes: Quote
  quoteComparisons: QuoteComparison
  reviews: Review
  carbon: CarbonInventory
}
export type Col = keyof Collections
export const COLLECTIONS: readonly Col[] = [
  'companies',
  'needs',
  'cases',
  'caseEvents',
  'quotes',
  'quoteComparisons',
  'reviews',
  'carbon',
]

export type DeepPartial<T> = T extends readonly (infer _U)[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export type StoreErrorCode = 'read_only' | 'not_found' | 'invalid' | 'quota' | 'unavailable'
export interface StoreError {
  code: StoreErrorCode
  message: string
}

export type StoreMode = 'local' | 'db' | 'fakedb'

/**
 * The one data API. Both backends behave the same: the first snapshot arrives asynchronously,
 * documents are plain JSON (undefined fields are dropped), `update` deep-merges objects and
 * replaces arrays, and `update` on a missing document rejects with code 'not_found'.
 */
/**
 * A real, published energy-saving project (「公開案例」). Static data in src/data/publicCases.ts,
 * never stored in the DataStore and never mixed with `isDemo` records. These companies did not use
 * the platform. Every number is copied from `source`; `null` means the source does not state it
 * (shown as 「來源未揭露」) — never fill one in by estimation.
 */
export interface PublicCase {
  id: string
  /** Short neutral description in our own words, e.g. 「辦公室 T8 燈管汰換 LED」. */
  title: string
  /** Industry exactly as the source labels it. */
  industry: string
  equip: Equip
  /** What was changed, in our own words, e.g. 「T8 燈管 1,200 支 → LED」. */
  equipmentNote: string
  /** Annual kWh before / after, only when the source states both. */
  beforeKwhPerYear: number | null
  afterKwhPerYear: number | null
  /** Annual kWh saved as the source states it. */
  savedKwhPerYear: number
  /** Annual electricity-bill saving the source states (NTD/year). */
  savedNtdPerYear: number | null
  investmentNtd: number | null
  /** Subsidy amount the source states (NTD); null = not disclosed. */
  subsidyNtd: number | null
  /** Payback years the source reports. */
  reportedPaybackYears: number | null
  source: {
    publisher: string
    /** e.g. 「114 年度節能標竿獎標竿案例」 */
    collection: string
    /** The source's own case number, e.g. 「114-D04-111-LS01」 */
    caseNo: string
    url: string
    /** Where on the page each number sits. */
    section: string
    /** YYYY-MM-DD the CEO opened the page and checked every number. */
    checkedDate: string
  }
  /** Anything a reader must know to read the numbers correctly. */
  note?: string
}

/**
 * A real, publicly listed vendor from government registries (能源署 ESCO 登錄 / 動力與公用設備補助登錄系統).
 * Static data only: never stored in DataStore, never displays `DemoBadge`, star ratings, or review counts,
 * and contains ONLY company public website & company telephone (NO personal names or personal phones).
 */
export interface PublicVendor {
  id: string
  name: string
  shortDesc: string
  city: City
  serviceRegions: string
  specialties: Specialty[]
  registryTags: ('ESCO 公會／登錄名錄' | '動力與公用設備補助登錄廠商' | '空壓機製造／服務商')[]
  publicWebsite: string
  publicPhone: string
  branchNote?: string
  source: {
    publisher: string
    url: string
    checkedDate: string
  }
}

export interface DataStore {
  readonly mode: StoreMode
  subscribe<C extends Col>(
    col: C,
    next: (docs: readonly Collections[C][]) => void,
    error?: (e: StoreError) => void,
  ): () => void
  get<C extends Col>(col: C, id: string): Promise<Collections[C] | null>
  /** Full replace (creates the document if missing). */
  set<C extends Col>(col: C, doc: Collections[C]): Promise<void>
  /** Deep merge into an existing document. */
  update<C extends Col>(col: C, id: string, patch: DeepPartial<Collections[C]>): Promise<void>
  remove(col: Col, id: string): Promise<void>
  /** Path-safe unique id, e.g. newId('need') → "need_lq8x2k4f9a". */
  newId(prefix: string): string
}
