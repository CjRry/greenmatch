/**
 * What a signed-in vendor's home shows: their own work, needs that fit them, their own collection,
 * and how they compare with the market as anonymous medians. Never other vendors by name.
 */
import { SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { STAGE_BY_KEY } from '../../../core/constants/stages'
import type { Case, Company, ISO, Need, Quote, Specialty, StageKey, Vendor } from '../../../core/types'
import type { VendorCollection } from './collections'
import { isFactory, matchedSpecialties, openNeeds } from './filters'

const DAY = 86_400_000

function daysBetween(from: ISO, now: ISO): number {
  const a = Date.parse(from.replace(' ', 'T'))
  const b = Date.parse(now.replace(' ', 'T'))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.floor((b - a) / DAY))
}

export interface VendorTodo {
  caseId: string
  title: string
  factoryName: string
  stage: StageKey
  /** What the vendor has to do now, as a button would say it. */
  action: string
  /** Days since the case entered this stage. */
  waitingDays: number
}

/**
 * Cases where the next move is this vendor's: schedule or finish a survey, send a quote, confirm the
 * contract, report construction. Oldest first, so nothing waits too long.
 */
export function vendorTodos(
  vendorId: string,
  cases: readonly Case[],
  quotes: readonly Quote[],
  nameOf: (companyId: string) => string,
  now: ISO,
): VendorTodo[] {
  const quoted = new Set(quotes.filter((q) => q.vendorId === vendorId).map((q) => q.caseId))
  const todos: VendorTodo[] = []
  for (const c of cases) {
    if (c.status !== 'active') continue
    const invited = c.shortlist.includes(vendorId)
    const chosen = c.selectedVendorId === vendorId
    let action: string | null = null
    if (c.stage === 'survey' && invited) action = c.surveyDate ? '完成場勘並記錄' : '約場勘時間'
    else if (c.stage === 'quote' && invited && !c.selectedVendorId && !quoted.has(c.id)) action = '提交報價'
    else if (c.stage === 'contract' && chosen) action = '確認簽約內容'
    else if (c.stage === 'construction' && chosen) action = '回報施工進度'
    if (!action) continue
    todos.push({
      caseId: c.id,
      title: c.title,
      factoryName: nameOf(c.factoryId),
      stage: c.stage,
      action,
      waitingDays: daysBetween(c.stageStartedAt, now),
    })
  }
  return todos.sort((a, b) => b.waitingDays - a.waitingDays || a.caseId.localeCompare(b.caseId))
}

/** Cases where this vendor is waiting on the factory (quoted, or recommended but not yet invited). */
export function vendorWaiting(vendorId: string, cases: readonly Case[], quotes: readonly Quote[]): number {
  const quoted = new Set(quotes.filter((q) => q.vendorId === vendorId).map((q) => q.caseId))
  return cases.filter(
    (c) =>
      c.status === 'active' &&
      ((c.stage === 'quote' && quoted.has(c.id) && !c.selectedVendorId) ||
        (c.stage === 'assess' && c.recommendations.some((r) => r.vendorId === vendorId))),
  ).length
}

export interface NeedFit {
  need: Need
  matched: Specialty[]
  reasons: string[]
  level: 'high' | 'maybe'
}

/**
 * Open needs this vendor could take: the equipment must match; service area, industry experience
 * and plant size add reasons. Needs already turned into a case are left out.
 */
export function needsForVendor(needs: readonly Need[], vendor: Vendor, companies: readonly Company[], limit = 5): NeedFit[] {
  const factories = new Map(companies.filter(isFactory).map((f) => [f.id, f]))
  const fits: NeedFit[] = []
  for (const need of openNeeds(needs)) {
    const matched = matchedSpecialties(need, vendor)
    if (!matched.length) continue
    const reasons = [`專長符合：${matched.map((s) => SPECIALTY_LABEL[s]).join('、')}`]
    const nearby = vendor.vendor.serviceCities.includes(need.city)
    if (nearby) reasons.push('在你的服務地區')
    const industry = factories.get(need.factoryId)?.factory.industry
    if (industry && vendor.vendor.servedIndustries?.includes(industry)) reasons.push(`做過${industry}`)
    if (vendor.vendor.sizeFit.includes(need.scale)) reasons.push('工廠規模適合')
    fits.push({ need, matched, reasons, level: nearby && reasons.length >= 3 ? 'high' : 'maybe' })
  }
  const rank = (f: NeedFit) => (f.level === 'high' ? 1 : 0) * 10 + f.reasons.length
  return fits.sort((a, b) => rank(b) - rank(a) || b.need.createdAt.localeCompare(a.need.createdAt)).slice(0, limit)
}

export interface Completeness {
  pct: number
  missing: string[]
}

/** How complete the vendor's public profile is; missing items are what to add next. */
export function profileCompleteness(vendor: Vendor): Completeness {
  const v = vendor.vendor
  const checks: [boolean, string][] = [
    [vendor.intro.trim().length >= 20, '公司介紹（至少 20 字）'],
    [v.tagline.trim().length > 0, '一句話標語'],
    [v.certifications.length > 0, '證照或資格'],
    [v.portfolio.length >= 3, '至少 3 件過去實績'],
    [(v.servedIndustries?.length ?? 0) > 0, '服務過的產業'],
    [v.assistsSubsidy !== undefined, '是否協助申請補助'],
  ]
  const done = checks.filter(([ok]) => ok).length
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter(([ok]) => !ok).map(([, label]) => label) }
}

export interface Performance {
  /** Cases this vendor sent a quote for. */
  quoted: number
  /** Of those, the ones where the factory chose this vendor. */
  won: number
}

export function vendorPerformance(vendorId: string, cases: readonly Case[], quotes: readonly Quote[]): Performance {
  const quotedIds = new Set(quotes.filter((q) => q.vendorId === vendorId).map((q) => q.caseId))
  const won = cases.filter((c) => quotedIds.has(c.id) && c.selectedVendorId === vendorId).length
  return { quoted: quotedIds.size, won }
}

export interface SavingBenchmark {
  equip: Specialty
  mine: number
  median: number
  /** Installs by other vendors the median is taken from. */
  peerCount: number
}

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10
}

/**
 * This vendor's average saving on its main equipment against the median of everyone else's installs
 * of that equipment. Anonymous: only the median and how many installs it is based on. Null when the
 * vendor has no measured saving or there are fewer than 3 peer installs to compare with.
 */
export function savingBenchmark(mine: VendorCollection, all: readonly VendorCollection[]): SavingBenchmark | null {
  for (const equip of mine.stats.topEquips) {
    const own = mine.installs.filter((i) => i.equip === equip && i.savingPct != null).map((i) => i.savingPct as number)
    if (!own.length) continue
    const peers = all
      .filter((c) => c.vendor.id !== mine.vendor.id)
      .flatMap((c) => c.installs)
      .filter((i) => i.equip === equip && i.savingPct != null)
      .map((i) => i.savingPct as number)
    if (peers.length < 3) continue
    return { equip, mine: Math.round(own.reduce((s, x) => s + x, 0) / own.length), median: median(peers), peerCount: peers.length }
  }
  return null
}

/** Label for the stage a to-do sits in, e.g. 「3/8 現場場勘」. */
export function stageTag(stage: StageKey): string {
  const s = STAGE_BY_KEY[stage]
  return `${s.n}/8 ${s.label}`
}
