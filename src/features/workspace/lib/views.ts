import { STAGES, STAGE_BY_KEY, isOwner, stageIndex } from '../../../core/constants/stages'
import type { Case, CaseEvent, Quote, Role, StageKey } from '../../../core/types'

/** One cell of the Shopee-style status bar, and the tab it switches to. */
export interface BucketDef {
  key: string
  label: string
}

export const FACTORY_BUCKETS: readonly BucketDef[] = [
  { key: 'matching', label: '媒合中' },
  { key: 'quoting', label: '場勘報價' },
  { key: 'building', label: '簽約施工' },
  { key: 'accepting', label: '待驗收' },
  { key: 'done', label: '已完成' },
]

export const VENDOR_BUCKETS: readonly BucketDef[] = [
  { key: 'invited', label: '新推薦' },
  { key: 'survey', label: '待場勘' },
  { key: 'quote', label: '待報價' },
  { key: 'building', label: '施工中' },
  { key: 'accepting', label: '待驗收' },
  { key: 'done', label: '已完成' },
]

export const ALL_TAB = 'all'

export function bucketsFor(role: Role): readonly BucketDef[] {
  return role === 'factory' ? FACTORY_BUCKETS : VENDOR_BUCKETS
}

/** A tab key from ?tab=, or 'all' when it is missing or not valid for this role. */
export function parseTab(role: Role, raw: string | null): string {
  return raw && bucketsFor(role).some((b) => b.key === raw) ? raw : ALL_TAB
}

export function factoryBucket(c: Case): string | null {
  if (c.status === 'completed') return 'done'
  if (c.status === 'cancelled') return null
  switch (c.stage) {
    case 'register':
    case 'assess':
      return 'matching'
    case 'survey':
    case 'quote':
      return 'quoting'
    case 'contract':
    case 'construction':
      return 'building'
    case 'acceptance':
      return 'accepting'
    case 'compare':
      return 'accepting'
  }
}

/** Does this vendor appear on the case at all (recommended, invited or chosen)? */
export function vendorInvolved(c: Case, vendorId: string): boolean {
  return (
    c.recommendations.some((r) => r.vendorId === vendorId) || c.shortlist.includes(vendorId) || c.selectedVendorId === vendorId
  )
}

export function vendorBucket(c: Case, vendorId: string, quotes: readonly Quote[]): string | null {
  if (c.status === 'cancelled') return null
  const selected = c.selectedVendorId === vendorId
  if (c.status === 'completed') return selected ? 'done' : null
  const listed = c.shortlist.includes(vendorId)
  switch (c.stage) {
    case 'assess':
      return c.recommendations.some((r) => r.vendorId === vendorId) ? 'invited' : null
    case 'survey':
      return listed ? 'survey' : null
    case 'quote':
      return listed && !quotes.some((q) => q.caseId === c.id && q.vendorId === vendorId) ? 'quote' : null
    case 'contract':
    case 'construction':
      return selected ? 'building' : null
    case 'acceptance':
    case 'compare':
      return selected ? 'accepting' : null
    default:
      return null
  }
}

export function bucketCounts(keys: readonly string[], rows: readonly { bucket: string | null }[]): Record<string, number> {
  const out: Record<string, number> = { [ALL_TAB]: rows.length }
  for (const k of keys) out[k] = rows.filter((r) => r.bucket === k).length
  return out
}

/** Cases the factory must act on now: the current stage lists the factory as an owner. */
export function factoryTodos(cases: readonly Case[]): Case[] {
  return cases.filter((c) => c.status === 'active' && isOwner(c.stage, 'factory'))
}

/** 「目前由 廠商 處理」 */
export function handlerText(c: Case): string {
  if (c.status === 'completed') return '案件已完成'
  if (c.status === 'cancelled') return '案件已取消'
  return `目前由${STAGE_BY_KEY[c.stage].ownerLabel}處理`
}

/** Most recently touched first. */
export function byRecent(a: Case, b: Case): number {
  return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0
}

export type StepState = 'done' | 'current' | 'upcoming'

export interface TimelineStep {
  key: StageKey
  n: number
  state: StepState
  /** When the stage was finished, from the case events. */
  doneAt: string | null
}

/** The 8 stages with their state, taking completion dates from stage_done / select events. */
export function timelineSteps(c: Case, events: readonly CaseEvent[]): TimelineStep[] {
  const cur = c.status === 'completed' ? STAGES.length : stageIndex(c.stage)
  return STAGES.map((s, i) => {
    const finished = events
      .filter((e) => e.caseId === c.id && e.stage === s.key && (e.kind === 'stage_done' || e.kind === 'select'))
      .map((e) => e.at)
      .sort()
    return {
      key: s.key,
      n: s.n,
      state: i < cur ? 'done' : i === cur ? 'current' : 'upcoming',
      doneAt: i < cur ? (finished.at(-1) ?? null) : null,
    }
  })
}

/** 「已進行 3 天」 / 「今天開始」; whole days since the stage began. */
export function elapsedText(since: string, now: Date = new Date()): string {
  const t = new Date(since).getTime()
  if (Number.isNaN(t)) return '—'
  const days = Math.floor((now.getTime() - t) / 86_400_000)
  if (days < 1) return '今天開始'
  return `已進行 ${days} 天`
}

export function latestFirst(events: readonly CaseEvent[]): CaseEvent[] {
  return [...events].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

/**
 * Filter case events for the current viewer.
 * An unselected vendor can only see events up to vendor selection (`select_vendor`),
 * hiding subsequent contract, construction, acceptance, and usage-comparison events.
 */
export function visibleEventsForViewer(events: readonly CaseEvent[], isUnselectedVendor: boolean): CaseEvent[] {
  if (!isUnselectedVendor) return [...events]
  const quoteIdx = stageIndex('quote')
  return events.filter((e) => stageIndex(e.stage) <= quoteIdx || e.kind === 'select')
}

/** Whether this company may view the case page: its factory, or a vendor recommended, invited or chosen. */
export function mayView(c: Case, role: Role | null, companyId: string | null): boolean {
  if (!role || !companyId) return false
  return role === 'factory' ? c.factoryId === companyId : vendorInvolved(c, companyId)
}
