/**
 * A vendor's installation history as a "collection": every install follows the same 8 standard
 * stages, with small differences (subsidy, a second survey, night work, how savings were checked).
 * Pure functions over a vendor's portfolio (store) plus optional extra demo records (src/data).
 */
import { CITY_INFO, type City, type Region } from '../constants/geo'
import { SCALE_SHORT, SPECIALTY_LABEL } from '../constants/equipment'
import { STAGES } from '../constants/stages'
import type { ScaleTier, Specialty, StageKey, Vendor } from '../types'

export interface InstallInput {
  title: string
  industry?: string
  city: City
  equip: Specialty
  year: number
  month?: number
  savingPct?: number | null
  scale?: ScaleTier
  subsidy?: boolean
  surveyVisits?: 1 | 2
  downtimeDays?: number
  nightWork?: boolean
  verify?: 'metered' | 'bill'
  note?: string
}

export interface InstallStep {
  stage: StageKey
  n: number
  label: string
  days: number
  /** What happened in this stage for this install. */
  note: string
  /** Set when this install did something its standard template does not (e.g. a subsidy application). */
  extra?: string
}

export type TraitKey = 'equip' | 'industry' | 'region' | 'scale' | 'subsidy' | 'survey' | 'work' | 'verify' | 'duration'

export interface InstallTrait {
  key: TraitKey
  label: string
  value: string
}

export interface VendorInstall {
  /** `${vendorId}-${n}`, n from 1. */
  id: string
  vendorId: string
  title: string
  industry: string
  city: City
  region: Region
  equip: Specialty
  year: number
  month: number
  savingPct: number | null
  scale: ScaleTier
  note: string | null
  steps: InstallStep[]
  totalDays: number
  traits: InstallTrait[]
}

export const TRAIT_LABEL: Record<TraitKey, string> = {
  equip: '設備',
  industry: '產業',
  region: '地區',
  scale: '工廠規模',
  subsidy: '補助協助',
  survey: '場勘',
  work: '施工方式',
  verify: '成效驗證',
  duration: '總工期',
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

type Template = { days: Partial<Record<StageKey, number>>; notes: Partial<Record<StageKey, string>> }

const BASE_DAYS: Record<StageKey, number> = {
  register: 1,
  assess: 2,
  survey: 4,
  quote: 7,
  contract: 7,
  construction: 7,
  acceptance: 3,
  compare: 30,
}

const BASE_NOTES: Record<StageKey, string> = {
  register: '工廠用口語描述設備與困擾，整理成標準需求表',
  assess: '平台推薦 2 家廠商並附理由',
  survey: '到廠了解設備與用電型態',
  quote: '提出改善方案與報價',
  contract: '確認範圍、工期與保固後簽約',
  construction: '進場施工',
  acceptance: '試車並由工廠驗收',
  compare: '比對改善前後用電',
}

const TEMPLATES: Record<Specialty, Template> = {
  air_compressor: {
    days: { survey: 7, construction: 4 },
    notes: { survey: '掛表量測一週風量、壓力與電流', quote: '變頻機種與管路改善兩案併陳', construction: '換機並修補管路洩漏', acceptance: '試車確認壓力穩定' },
  },
  hvac: {
    days: { construction: 7 },
    notes: { survey: '盤點冷氣台數、噸數與運轉時段', construction: '分區輪流汰換，辦公區不停冷', acceptance: '確認各區溫度與噪音' },
  },
  chiller: {
    days: { survey: 5, quote: 10, construction: 12 },
    notes: { survey: '量測冰水進出水溫與主機耗電', quote: '主機汰換與群控方案比較', construction: '吊裝新主機並配置群控', acceptance: '滿載試車確認 COP' },
  },
  lighting: {
    days: { survey: 2, quote: 4, construction: 3, compare: 30 },
    notes: { survey: '照度量測與燈具盤點', quote: '依照度需求選燈具與控制方式', construction: '分區汰換燈具', acceptance: '複測照度', compare: '比對照明迴路用電' },
  },
  motor_vfd: {
    days: { construction: 3 },
    notes: { survey: '量測馬達負載率與運轉曲線', construction: '加裝變頻器並調整參數', acceptance: '確認轉速與產線節拍' },
  },
  boiler: {
    days: { survey: 5, quote: 10, contract: 21, construction: 20 },
    notes: { survey: '盤點蒸汽用量與燃料耗用', contract: '申請燃料轉換與管線許可', construction: '更換燃燒機並施作管線', acceptance: '燃燒調整與排氣檢測', compare: '比對燃料費與蒸汽單耗' },
  },
  pump_fan: {
    days: { construction: 4 },
    notes: { survey: '量測流量、揚程與運轉電流', construction: '加裝變頻與控制邏輯', acceptance: '確認流量與壓力符合製程' },
  },
  heat_pump: {
    days: { construction: 8 },
    notes: { survey: '盤點熱水用量與加熱溫度', construction: '安裝熱泵機組與儲熱桶配管', acceptance: '確認出水溫度與回溫時間' },
  },
  solar_pv: {
    days: { survey: 5, quote: 10, contract: 30, construction: 35, acceptance: 7 },
    notes: { survey: '評估屋頂結構與遮蔭', contract: '送台電併聯審查與同意備案', construction: '架設支架、模組並併網', acceptance: '台電掛表併聯', compare: '比對發電量與自發自用比例' },
  },
  ems: {
    days: { construction: 10 },
    notes: { survey: '盤點配電盤並規劃分區電表', construction: '安裝分區電表與監控平台', acceptance: '確認讀值與告警設定', compare: '產出第一份用電月報' },
  },
  carbon_consulting: {
    days: { survey: 3, quote: 5, contract: 5, construction: 30, acceptance: 7, compare: 21 },
    notes: {
      survey: '訪談確認組織邊界與排放源',
      quote: '依排放源數量與廠區數報價',
      construction: '蒐集活動數據並計算排放量',
      acceptance: '完成盤查清冊與報告書',
      compare: '內部審查或第三方查證',
    },
  },
}

const NO_DOWNTIME: ReadonlySet<Specialty> = new Set(['carbon_consulting', 'ems', 'solar_pv'])

/** Fill in the variation fields a plain portfolio item doesn't have, deterministically. */
function withDefaults(vendor: Vendor, input: InstallInput): Required<Omit<InstallInput, 'note' | 'industry' | 'savingPct'>> & InstallInput {
  const h = hash(vendor.id + input.title)
  const lightWork = input.equip === 'lighting' || NO_DOWNTIME.has(input.equip)
  return {
    ...input,
    month: input.month ?? (h % 12) + 1,
    scale: input.scale ?? vendor.vendor.sizeFit[h % vendor.vendor.sizeFit.length] ?? 'S',
    subsidy: input.subsidy ?? (Boolean(vendor.vendor.assistsSubsidy) && h % 2 === 0),
    surveyVisits: input.surveyVisits ?? (h % 3 === 0 ? 2 : 1),
    nightWork: input.nightWork ?? (lightWork || h % 4 === 0),
    downtimeDays: input.downtimeDays ?? (lightWork ? 0 : 1 + (h % 3)),
    verify: input.verify ?? (h % 2 === 0 ? 'metered' : 'bill'),
  }
}

function durationBucket(days: number): string {
  if (days <= 45) return '1.5 個月內'
  if (days <= 75) return '1.5–2.5 個月'
  if (days <= 120) return '2.5–4 個月'
  return '4 個月以上'
}

export function buildInstall(vendor: Vendor, input: InstallInput, n: number): VendorInstall {
  const id = `${vendor.id}-${n}`
  const x = withDefaults(vendor, input)
  const t = TEMPLATES[x.equip]
  const carbon = x.equip === 'carbon_consulting'

  const steps: InstallStep[] = STAGES.map((s) => {
    let days = t.days[s.key] ?? BASE_DAYS[s.key]
    // Small per-install jitter on the stages that really vary between jobs.
    if (s.key === 'survey' || s.key === 'quote' || s.key === 'contract' || s.key === 'construction') {
      days = Math.max(1, days + (hash(id + s.key) % 5) - 2)
    }
    const note = t.notes[s.key] ?? BASE_NOTES[s.key]
    let extra: string | undefined
    if (s.key === 'survey' && x.surveyVisits === 2) {
      days += 5
      extra = '安排第二次複勘補量數據'
    }
    if (s.key === 'contract' && x.subsidy) {
      days += 14
      extra = carbon ? '協助申請盤查輔導補助，核定後簽約' : '協助申請能源署補助，核定後簽約'
    }
    if (s.key === 'construction' && !carbon) {
      if (x.nightWork && x.downtimeDays === 0) extra = '夜間／假日施工，產線不停'
      else if (x.downtimeDays > 0) extra = `停機 ${x.downtimeDays} 天${x.nightWork ? '，其餘夜間施工' : ''}`
    }
    if (s.key === 'compare') {
      if (carbon) {
        days = x.verify === 'metered' ? 35 : days
        extra = x.verify === 'metered' ? '委託第三方查證' : '內部審查'
      } else if (x.verify === 'bill') {
        days = 90
        extra = '用前後 3 個月電費單比對'
      } else {
        extra = '掛表實測改善前後各 30 天'
      }
    }
    return { stage: s.key, n: s.n, label: s.label, days, note, extra }
  })

  const totalDays = steps.reduce((sum, s) => sum + s.days, 0)
  const region = CITY_INFO[x.city].region
  const work = carbon
    ? x.surveyVisits === 2
      ? '到廠 2 次＋線上'
      : '到廠 1 次＋線上'
    : x.nightWork && x.downtimeDays === 0
      ? '不停線（夜間／假日）'
      : `停機 ${x.downtimeDays} 天`
  const verify = carbon ? (x.verify === 'metered' ? '第三方查證' : '內部審查') : x.verify === 'metered' ? '掛表實測' : '電費單比對'

  const traits: InstallTrait[] = [
    { key: 'equip', label: TRAIT_LABEL.equip, value: SPECIALTY_LABEL[x.equip] },
    { key: 'industry', label: TRAIT_LABEL.industry, value: x.industry ?? '未註明' },
    { key: 'region', label: TRAIT_LABEL.region, value: region },
    { key: 'scale', label: TRAIT_LABEL.scale, value: `${SCALE_SHORT[x.scale]}工廠` },
    { key: 'subsidy', label: TRAIT_LABEL.subsidy, value: x.subsidy ? '有申請補助' : '未申請補助' },
    { key: 'survey', label: TRAIT_LABEL.survey, value: x.surveyVisits === 2 ? '2 次（含複勘）' : '1 次' },
    { key: 'work', label: TRAIT_LABEL.work, value: work },
    { key: 'verify', label: TRAIT_LABEL.verify, value: verify },
    { key: 'duration', label: TRAIT_LABEL.duration, value: durationBucket(totalDays) },
  ]

  return {
    id,
    vendorId: vendor.id,
    title: x.title,
    industry: x.industry ?? '未註明',
    city: x.city,
    region,
    equip: x.equip,
    year: x.year,
    month: x.month,
    savingPct: x.savingPct ?? null,
    scale: x.scale,
    note: x.note ?? null,
    steps,
    totalDays,
    traits,
  }
}

/** Newest first. Portfolio items (store) come first in numbering, then the extra demo records. */
export function vendorInstalls(vendor: Vendor, extras: readonly InstallInput[] = []): VendorInstall[] {
  const inputs: InstallInput[] = [...vendor.vendor.portfolio, ...(vendor.isDemo ? extras : [])]
  return inputs
    .map((p, i) => buildInstall(vendor, p, i + 1))
    .sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month) || a.id.localeCompare(b.id))
}

export interface CollectionStats {
  count: number
  /** Mean of the installs that report a saving, rounded; null when none do. */
  avgSavingPct: number | null
  bestSavingPct: number | null
  /** Median total days, rounded. */
  medianDays: number | null
  industries: number
  latestYear: number | null
  /** Specialties ordered by how many installs used them. */
  topEquips: Specialty[]
}

export function collectionStats(installs: readonly VendorInstall[]): CollectionStats {
  const savings = installs.map((i) => i.savingPct).filter((p): p is number => p != null)
  const days = installs.map((i) => i.totalDays).sort((a, b) => a - b)
  const mid = days.length ? (days.length % 2 ? days[(days.length - 1) / 2] : (days[days.length / 2 - 1] + days[days.length / 2]) / 2) : null
  const equipCount = new Map<Specialty, number>()
  for (const i of installs) equipCount.set(i.equip, (equipCount.get(i.equip) ?? 0) + 1)
  return {
    count: installs.length,
    avgSavingPct: savings.length ? Math.round(savings.reduce((s, p) => s + p, 0) / savings.length) : null,
    bestSavingPct: savings.length ? Math.max(...savings) : null,
    medianDays: mid == null ? null : Math.round(mid),
    industries: new Set(installs.map((i) => i.industry)).size,
    latestYear: installs.length ? Math.max(...installs.map((i) => i.year)) : null,
    topEquips: [...equipCount.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e),
  }
}

/** Share (0–1) of the collection that has the same value for this trait. */
export function traitShare(installs: readonly VendorInstall[], trait: InstallTrait): number {
  if (!installs.length) return 0
  const same = installs.filter((i) => i.traits.some((t) => t.key === trait.key && t.value === trait.value)).length
  return same / installs.length
}

/** Days this install's stage differs from the collection's average for the same stage. */
export function stageDeltaDays(installs: readonly VendorInstall[], install: VendorInstall, stage: StageKey): number {
  const peers = installs.map((i) => i.steps.find((s) => s.stage === stage)?.days ?? 0)
  if (!peers.length) return 0
  const avg = peers.reduce((s, d) => s + d, 0) / peers.length
  const mine = install.steps.find((s) => s.stage === stage)?.days ?? 0
  return Math.round(mine - avg)
}
