/**
 * Rule-based vendor recommendation from the deck: score = Σ(weight × item score), 5 items,
 * exactly 2 vendors with reasons, no open bidding. Pure and deterministic.
 */
import { cityDistanceKm } from '../constants/geo'
import { EQUIP_INFO, RELATED_EQUIP, SCALE_SHORT, SPECIALTY_LABEL } from '../constants/equipment'
import { formatNumber } from '../format'
import type {
  Case,
  Company,
  Equip,
  Factory,
  FactorKey,
  FactorScore,
  Need,
  PortfolioItem,
  Recommendation,
  Review,
  ScaleTier,
  Specialty,
  Vendor,
} from '../types'
import { vendorStats } from './vendorStats'

export const FACTOR_KEYS: readonly FactorKey[] = ['specialty', 'distance', 'track', 'rating', 'scale']

export const FACTOR_LABEL: Record<FactorKey, string> = {
  specialty: '設備專長符合度',
  distance: '距離',
  track: '實績',
  rating: '評價',
  scale: '規模適配',
}

/** Starting weights (w1–w5). The deck sets them from the survey's 「最重視的推薦依據」 and calibrates later. */
export const DEFAULT_WEIGHTS: Record<FactorKey, number> = {
  specialty: 0.35,
  distance: 0.2,
  track: 0.2,
  rating: 0.15,
  scale: 0.1,
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** The specialties a need asks for, in form order, without duplicates. */
export function requiredSpecialties(need: Pick<Need, 'form'>): Specialty[] {
  return [...new Set(need.form.items.map((i) => i.equip))]
}

function isEquip(s: Specialty): s is Equip {
  return s !== 'carbon_consulting'
}

/** Best affinity of a vendor for one required specialty: same 1, related 0.5, EMS covers equipment 0.3. */
function affinity(vendor: Vendor, req: Specialty): number {
  const has = vendor.vendor.specialties
  if (has.includes(req)) return 1
  if (isEquip(req)) {
    if ((RELATED_EQUIP[req] ?? []).some((r) => has.includes(r))) return 0.5
    if (has.includes('ems')) return 0.3
  }
  return 0
}

function specialtyFactor(vendor: Vendor, required: Specialty[]): FactorScore & { exact: Specialty[] } {
  if (!required.length) return { s: 0, w: 0, detail: '未指定設備', exact: [] }
  const scores = required.map((r) => affinity(vendor, r))
  const exact = required.filter((_, i) => scores[i] === 1)
  const s = scores.reduce((a, b) => a + b, 0) / required.length
  const detail = exact.length ? `${exact.map((e) => SPECIALTY_LABEL[e]).join('、')}相符` : s > 0 ? '具相關設備經驗' : '不相符'
  return { s, w: 0, detail, exact }
}

function distanceFactor(vendor: Vendor, factory: Factory): FactorScore & { km: number; covered: boolean } {
  const km = cityDistanceKm(factory.city, vendor.city)
  const covered = vendor.vendor.serviceCities.includes(factory.city)
  let s = clamp01(1 - (km - 30) / 170)
  if (covered) s = Math.max(s, 0.8)
  const detail = km < 1 ? '同縣市' : `約 ${formatNumber(km)} 公里`
  return { s, w: 0, detail, km, covered }
}

const PORTFOLIO_INDUSTRY_KEYWORDS: readonly [string, readonly string[]][] = [
  ['金屬加工', ['金屬', '鋼鐵', '五金', '扣件', '沖壓', '鍛造', '鑄造']],
  ['塑膠射出', ['塑膠', '射出', '押出']],
  ['食品加工', ['食品', '烘焙', '飲料', '冷凍食品']],
  ['紡織染整', ['染整', '紡織', '織布', '印染']],
  ['電子零組件', ['電子', '半導體', '電路板', 'PCB', '光電']],
  ['機械設備', ['機械', '工具機', '精密加工']],
  ['化工', ['化工', '化學', '塗料', '樹脂']],
  ['印刷包裝', ['印刷', '紙器', '包裝', '紙箱']],
  ['汽機車零件', ['汽車', '機車', '汽機車', '車用']],
]

const COLLABORATED_STAGES = new Set<Case['stage']>(['contract', 'construction', 'acceptance', 'compare'])

/** Infer a portfolio project's customer industry from its explicit tag or title keywords. */
export function inferPortfolioIndustry(item: Pick<PortfolioItem, 'title' | 'industry'>): string | null {
  const explicit = item.industry?.trim()
  if (explicit) return explicit
  for (const [industry, words] of PORTFOLIO_INDUSTRY_KEYWORDS) {
    if (words.some((w) => item.title.includes(w))) return industry
  }
  return null
}

/** Aggregate all industries a vendor has served across declared tags, portfolio projects, and past cases. */
export function vendorIndustryExperience(
  vendor: Vendor,
  companies: readonly Company[] = [],
  cases: readonly Case[] = [],
): { industries: string[]; countByIndustry: Record<string, number> } {
  const countByIndustry: Record<string, number> = {}
  const industrySet = new Set<string>()

  for (const ind of vendor.vendor.servedIndustries ?? []) {
    const clean = ind.trim()
    if (clean) industrySet.add(clean)
  }
  for (const p of vendor.vendor.portfolio) {
    const ind = inferPortfolioIndustry(p)
    if (!ind) continue
    industrySet.add(ind)
    countByIndustry[ind] = (countByIndustry[ind] ?? 0) + 1
  }
  if (cases.length > 0 && companies.length > 0) {
    const factoryIndustryById = new Map<string, string>()
    for (const c of companies) {
      if (c.role === 'factory' && c.factory.industry) factoryIndustryById.set(c.id, c.factory.industry)
    }
    for (const c of cases) {
      if (c.selectedVendorId !== vendor.id || !COLLABORATED_STAGES.has(c.stage)) continue
      const ind = factoryIndustryById.get(c.factoryId)
      if (!ind) continue
      industrySet.add(ind)
      countByIndustry[ind] = (countByIndustry[ind] ?? 0) + 1
    }
  }
  return { industries: [...industrySet], countByIndustry }
}

/** Summarize a vendor's prior collaboration experience in a target factory industry. */
export function sameIndustrySummary(
  vendor: Vendor,
  factoryIndustry: string,
  companies: readonly Company[] = [],
  cases: readonly Case[] = [],
) {
  const target = factoryIndustry.trim()
  const exp = vendorIndustryExperience(vendor, companies, cases)
  const hasDeclared = Boolean(target) && (vendor.vendor.servedIndustries ?? []).includes(target)
  const caseCount = target ? exp.countByIndustry[target] ?? 0 : 0
  const matchedPortfolio = target
    ? vendor.vendor.portfolio.filter((p) => inferPortfolioIndustry(p) === target)
    : []
  const hasExperience = Boolean(target) && (hasDeclared || caseCount > 0)
  return { hasExperience, hasDeclared, caseCount, matchedPortfolio }
}

function trackFactor(
  vendor: Vendor,
  factoryIndustry: string,
  companies: readonly Company[],
  cases: readonly Case[],
): FactorScore & { sameIndustry: ReturnType<typeof sameIndustrySummary> } {
  const n = vendor.vendor.completedCases
  const baseTrack = clamp01(Math.log(1 + n) / Math.log(51))
  const sameIndustry = sameIndustrySummary(vendor, factoryIndustry, companies, cases)
  const sameBoost = !sameIndustry.hasExperience
    ? 0
    : sameIndustry.caseCount > 0
      ? Math.min(0.45, 0.25 + 0.1 * (sameIndustry.caseCount - 1))
      : 0.2
  const s = clamp01(baseTrack * 0.65 + sameBoost)
  const detail =
    sameIndustry.caseCount > 0
      ? `同業（${factoryIndustry}）實績 ${sameIndustry.caseCount} 件・共完成 ${n} 件`
      : sameIndustry.hasDeclared
        ? `曾服務${factoryIndustry}・共完成 ${n} 件`
        : `完成 ${n} 件`
  return { s, w: 0, detail, sameIndustry }
}

function ratingFactor(vendor: Vendor, reviews: readonly Review[]): FactorScore & { avg: number | null; count: number } {
  const st = vendorStats(vendor.id, reviews)
  if (!st.count) return { s: 0.5, w: 0, detail: '尚無評價', avg: null, count: 0 }
  return { s: clamp01((st.bayes - 3) / 2), w: 0, detail: `${formatNumber(st.avg, 1)}★・${st.count} 則`, avg: st.avg, count: st.count }
}

const ADJACENT: Record<ScaleTier, ScaleTier[]> = { S: ['M'], M: ['S', 'L'], L: ['M'] }

function scaleFactor(vendor: Vendor, tier: ScaleTier): FactorScore {
  const fit = vendor.vendor.sizeFit
  const s = fit.includes(tier) ? 1 : fit.some((t) => ADJACENT[tier].includes(t)) ? 0.5 : 0
  return { s, w: 0, detail: s === 1 ? `熟悉${SCALE_SHORT[tier]}工廠` : s > 0 ? '規模相近' : '規模不同' }
}

function normalize(weights: Record<FactorKey, number>): Record<FactorKey, number> {
  const sum = FACTOR_KEYS.reduce((a, k) => a + Math.max(0, weights[k]), 0) || 1
  return Object.fromEntries(FACTOR_KEYS.map((k) => [k, Math.max(0, weights[k]) / sum])) as Record<FactorKey, number>
}

interface Scored {
  vendor: Vendor
  score: number
  factors: Record<FactorKey, FactorScore>
  reasons: string[]
  km: number
  reviewCount: number
  interested: boolean
}

/**
 * Rank vendors for a need and return the top 2 (fewer when fewer qualify).
 * Hard filters: vendors only, at least some specialty match, never the factory itself.
 * Ties (score rounded to 0.1) break by: vendor already said 「我有興趣」, higher specialty match,
 * shorter distance, more reviews, then id.
 */
export function rankVendors(
  need: Pick<Need, 'form' | 'scale' | 'interestedVendorIds'>,
  factory: Factory,
  companies: readonly Company[],
  reviews: readonly Review[],
  weights: Record<FactorKey, number> = DEFAULT_WEIGHTS,
  cases: readonly Case[] = [],
): Recommendation[] {
  const w = normalize(weights)
  const required = requiredSpecialties(need)
  const scored: Scored[] = []
  for (const c of companies) {
    if (c.role !== 'vendor' || c.id === factory.id) continue
    const sp = specialtyFactor(c, required)
    if (sp.s <= 0) continue
    const di = distanceFactor(c, factory)
    const { sameIndustry, ...tr } = trackFactor(c, factory.factory.industry, companies, cases)
    const ra = ratingFactor(c, reviews)
    const sc = scaleFactor(c, need.scale)
    const factors: Record<FactorKey, FactorScore> = {
      specialty: { s: sp.s, w: w.specialty, detail: sp.detail },
      distance: { s: di.s, w: w.distance, detail: di.detail },
      track: { s: tr.s, w: w.track, detail: tr.detail },
      rating: { s: ra.s, w: w.rating, detail: ra.detail },
      scale: { s: sc.s, w: w.scale, detail: sc.detail },
    }
    const score = 100 * FACTOR_KEYS.reduce((a, k) => a + factors[k].w * factors[k].s, 0)

    // One phrase per factor that clears its bar; the two strongest contributions are kept.
    const phrases: { text: string; weight: number }[] = []
    if (sp.s === 1) phrases.push({ text: `${sp.exact.map((e) => SPECIALTY_LABEL[e]).join('、')}專長相符`, weight: w.specialty * sp.s })
    else if (sp.s >= 0.5) phrases.push({ text: '具相關設備經驗', weight: w.specialty * sp.s })
    if (sameIndustry.caseCount > 0) {
      phrases.push({
        text: `曾合作${factory.factory.industry}同業（${sameIndustry.caseCount} 件實績）`,
        weight: w.track * tr.s + 0.15,
      })
    } else if (sameIndustry.hasDeclared) {
      phrases.push({
        text: `具${factory.factory.industry}同業服務經驗`,
        weight: w.track * tr.s + 0.1,
      })
    } else if (c.vendor.completedCases >= 20) {
      phrases.push({ text: `實績豐富（完成 ${c.vendor.completedCases} 件）`, weight: w.track * tr.s })
    }
    if (di.km <= 30) phrases.push({ text: di.km < 1 ? '同縣市、距離近' : `距離近（約 ${formatNumber(di.km)} 公里）`, weight: w.distance * di.s })
    else if (di.covered) phrases.push({ text: `服務範圍涵蓋${factory.city}`, weight: w.distance * di.s })
    if (ra.avg != null && ra.avg >= 4.5 && ra.count >= 3) phrases.push({ text: `評價優良（${formatNumber(ra.avg, 1)}★・${ra.count} 則）`, weight: w.rating * ra.s })
    if (sc.s === 1) phrases.push({ text: `熟悉${SCALE_SHORT[need.scale]}工廠`, weight: w.scale * sc.s })
    phrases.sort((a, b) => b.weight - a.weight)
    const reasons = phrases.slice(0, 2).map((p) => p.text)
    if (!reasons.length) reasons.push(sp.detail)

    scored.push({
      vendor: c,
      score,
      factors,
      reasons,
      km: di.km,
      reviewCount: ra.count,
      interested: need.interestedVendorIds.includes(c.id),
    })
  }

  scored.sort((a, b) => {
    const ra = Math.round(a.score * 10)
    const rb = Math.round(b.score * 10)
    if (ra !== rb) return rb - ra
    if (a.interested !== b.interested) return a.interested ? -1 : 1
    if (a.factors.specialty.s !== b.factors.specialty.s) return b.factors.specialty.s - a.factors.specialty.s
    if (a.km !== b.km) return a.km - b.km
    if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount
    return a.vendor.id < b.vendor.id ? -1 : 1
  })

  return scored.slice(0, 2).map((x, i) => ({
    vendorId: x.vendor.id,
    rank: (i + 1) as 1 | 2,
    score: Math.round(x.score * 10) / 10,
    factors: x.factors,
    reasons: x.reasons,
    reasonText: x.reasons.join('、'),
  }))
}

/** Label for any need item, equipment or service. */
export function itemLabel(s: Specialty): string {
  return isEquip(s) ? EQUIP_INFO[s].label : SPECIALTY_LABEL[s]
}
