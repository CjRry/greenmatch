import { ELECTRICITY_FACTOR } from '../../../core/constants/carbon'
import { STAGE_BY_KEY, nextStage } from '../../../core/constants/stages'
import { formatDateTime, nowIso } from '../../../core/format'
import type { Case, CaseEvent, DeepPartial, ISO, Role, StageKey, UsagePoint } from '../../../core/types'

/** Who is acting: the factory that owns the case, or one of the vendors on it. */
export interface Actor {
  role: Role
  id: string
}

export type CaseAction =
  | { type: 'schedule_survey'; at: ISO }
  | { type: 'finish_survey' }
  | { type: 'submit_quote'; updated?: boolean }
  | { type: 'select_vendor'; vendorId: string }
  | { type: 'sign_contract'; contractNtd: number; startDate: ISO; endDate: ISO }
  | { type: 'report_progress'; text: string }
  | { type: 'finish_construction' }
  | { type: 'accept' }
  | { type: 'review'; rating: number }
  | { type: 'add_usage'; month: string; kwh: number; phase: UsagePoint['phase'] }
  | { type: 'complete_compare' }

export type ActionType = CaseAction['type']

export interface TransitionContext {
  /** Vendors who have already submitted a quote on this case (needed by select_vendor). */
  quotedVendorIds?: readonly string[]
  /** Display name for event text. */
  nameOf?: (companyId: string) => string
  /** Clock override for tests. */
  now?: ISO
}

export type NewEvent = Omit<CaseEvent, 'id'>

export type TransitionResult = { patch: DeepPartial<Case>; event: NewEvent } | { error: string }

export function isError(r: TransitionResult): r is { error: string } {
  return 'error' in r
}

/** Which stages each action belongs to. */
const ACTION_STAGES: Record<ActionType, readonly StageKey[]> = {
  schedule_survey: ['survey'],
  finish_survey: ['survey'],
  submit_quote: ['quote'],
  select_vendor: ['quote'],
  sign_contract: ['contract'],
  report_progress: ['construction'],
  finish_construction: ['construction'],
  accept: ['acceptance'],
  review: ['acceptance', 'compare'],
  add_usage: ['compare'],
  complete_compare: ['compare'],
}

const ACTION_ROLES: Record<ActionType, readonly Role[]> = {
  schedule_survey: ['vendor'],
  finish_survey: ['factory', 'vendor'],
  submit_quote: ['vendor'],
  select_vendor: ['factory'],
  sign_contract: ['factory', 'vendor'],
  report_progress: ['vendor'],
  finish_construction: ['vendor'],
  accept: ['factory'],
  review: ['factory'],
  add_usage: ['factory'],
  complete_compare: ['factory'],
}

const ROLE_LABEL: Record<Role, string> = { factory: '工廠', vendor: '廠商' }

/** Vendors that may act in the current stage: the shortlist until a vendor is chosen, then only that vendor. */
function vendorMayAct(c: Case, vendorId: string, type: ActionType): boolean {
  if (type === 'submit_quote' || type === 'schedule_survey' || type === 'finish_survey') return c.shortlist.includes(vendorId)
  return c.selectedVendorId === vendorId
}

/**
 * Whether this actor may take this kind of action right now. Returns the reason in plain language
 * when not, or null when allowed. The UI uses it to disable buttons and explain why.
 */
export function whyNot(c: Case, type: ActionType, actor: Actor | null): string | null {
  if (!actor) return '請先登入'
  if (c.status === 'completed') return '這個案件已完成'
  if (c.status === 'cancelled') return '這個案件已取消'
  if (!ACTION_STAGES[type].includes(c.stage)) {
    return `目前在「${STAGE_BY_KEY[c.stage].label}」階段，現在不能做這個動作`
  }
  if (!ACTION_ROLES[type].includes(actor.role)) {
    const who = ACTION_ROLES[type].map((r) => ROLE_LABEL[r]).join('或')
    return `這個動作由${who}操作，目前由${STAGE_BY_KEY[c.stage].ownerLabel}處理`
  }
  if (actor.role === 'factory' && actor.id !== c.factoryId) return '這不是你公司的案件'
  if (actor.role === 'vendor' && !vendorMayAct(c, actor.id, type)) {
    return c.selectedVendorId ? '這個案件已由其他廠商承接' : '你不在這個案件邀請的廠商名單內'
  }
  return null
}

function sortedUsage(usage: readonly UsagePoint[]): UsagePoint[] {
  return [...usage].sort((a, b) => (a.month === b.month ? (a.phase < b.phase ? -1 : 1) : a.month < b.month ? -1 : 1))
}

const avg = (xs: readonly number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0)

/** Average monthly kWh before and after, from usage points; null when a phase has no points. */
export function usageAverages(usage: readonly UsagePoint[] | undefined): { before: number; after: number } | null {
  const b = (usage ?? []).filter((u) => u.phase === 'before').map((u) => u.kwh)
  const a = (usage ?? []).filter((u) => u.phase === 'after').map((u) => u.kwh)
  if (!b.length || !a.length) return null
  return { before: avg(b), after: avg(a) }
}

export interface UsageSaving {
  beforeKwh: number
  afterKwh: number
  savedKwh: number
  /** Saved share of the before level, in percent (negative when use went up). */
  savedPct: number
  /** Estimated monthly CO2e avoided, kg. */
  savedKgCo2e: number
}

export function usageSaving(usage: readonly UsagePoint[] | undefined): UsageSaving | null {
  const a = usageAverages(usage)
  if (!a || a.before <= 0) return null
  const saved = a.before - a.after
  return {
    beforeKwh: a.before,
    afterKwh: a.after,
    savedKwh: saved,
    savedPct: (saved / a.before) * 100,
    savedKgCo2e: saved * ELECTRICITY_FACTOR,
  }
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * Apply an action to a case. Pure: returns the case patch and the new event to append, or an
 * error message. Callers write both (patch via update, event via set) and never edit old events.
 */
export function transition(c: Case, action: CaseAction, actor: Actor, ctx: TransitionContext = {}): TransitionResult {
  const blocked = whyNot(c, action.type, actor)
  if (blocked) return { error: blocked }

  const now = ctx.now ?? nowIso()
  const nameOf = ctx.nameOf ?? ((id: string) => id)
  const base = { caseId: c.id, stage: c.stage, actor: actor.role, actorId: actor.id, at: now } as const
  const stamp = { updatedAt: now }
  const advance = (text: string, extra: DeepPartial<Case> = {}, kind: CaseEvent['kind'] = 'stage_done'): TransitionResult => {
    const next = nextStage(c.stage)
    if (!next) return { error: '已經是最後一個階段' }
    return { patch: { ...extra, stage: next, stageStartedAt: now, ...stamp }, event: { ...base, kind, text } }
  }
  const who = actor.role === 'vendor' ? nameOf(actor.id) : '工廠'

  switch (action.type) {
    case 'schedule_survey': {
      if (Number.isNaN(new Date(action.at).getTime())) return { error: '請選擇場勘的日期與時間' }
      return {
        patch: { surveyDate: action.at, ...stamp },
        event: { ...base, kind: 'schedule', text: `${who}：預約 ${formatDateTime(action.at)} 到廠場勘` },
      }
    }
    case 'finish_survey':
      return advance(`${who} 回報場勘完成，進入方案與報價`)
    case 'submit_quote':
      return {
        patch: { ...stamp },
        event: { ...base, kind: 'quote', text: `${who} ${action.updated ? '更新報價' : '提交報價'}` },
      }
    case 'select_vendor': {
      if (!c.shortlist.includes(action.vendorId)) return { error: '只能從邀請場勘的廠商中選擇' }
      if (!ctx.quotedVendorIds?.includes(action.vendorId)) return { error: '這家廠商還沒有提交報價' }
      return advance(
        `工廠選擇 ${nameOf(action.vendorId)}，進入簽約`,
        { selectedVendorId: action.vendorId },
        'select',
      )
    }
    case 'sign_contract': {
      if (!(action.contractNtd > 0)) return { error: '請填寫大於 0 的合約金額' }
      const s = new Date(action.startDate).getTime()
      const e = new Date(action.endDate).getTime()
      if (Number.isNaN(s) || Number.isNaN(e)) return { error: '請填寫開工日與完工日' }
      if (e < s) return { error: '完工日不能早於開工日' }
      return advance(`${who} 確認並完成簽約`, {
        contractNtd: Math.round(action.contractNtd),
        startDate: action.startDate,
        endDate: action.endDate,
      })
    }
    case 'report_progress': {
      const text = action.text.trim()
      if (!text) return { error: '請寫下目前的施工進度' }
      return { patch: { ...stamp }, event: { ...base, kind: 'progress', text: `${who}：${text}` } }
    }
    case 'finish_construction':
      return advance(`${who} 完工並完成試運轉，等待工廠驗收`)
    case 'accept':
      return advance('工廠驗收通過，進入用電比較')
    case 'review': {
      if (!Number.isInteger(action.rating) || action.rating < 1 || action.rating > 5) return { error: '請選擇 1 到 5 顆星' }
      const target = c.selectedVendorId ? nameOf(c.selectedVendorId) : '廠商'
      return { patch: { ...stamp }, event: { ...base, kind: 'review', text: `工廠評價 ${target}：${action.rating} 顆星` } }
    }
    case 'add_usage': {
      if (!MONTH_RE.test(action.month)) return { error: '請選擇月份' }
      if (!Number.isFinite(action.kwh) || action.kwh <= 0) return { error: '請填寫大於 0 的用電度數' }
      const point: UsagePoint = { month: action.month, kwh: Math.round(action.kwh), phase: action.phase }
      const kept = (c.usage ?? []).filter((u) => !(u.month === point.month && u.phase === point.phase))
      const label = action.phase === 'after' ? '改善後' : '改善前'
      return {
        patch: { usage: sortedUsage([...kept, point]), ...stamp },
        event: { ...base, kind: 'note', text: `工廠登錄 ${action.month} ${label}用電 ${point.kwh.toLocaleString('en-US')} 度` },
      }
    }
    case 'complete_compare': {
      const a = usageAverages(c.usage)
      if (!a) return { error: '需要改善前與改善後各至少一個月的用電紀錄' }
      const pct = a.before > 0 ? ((a.before - a.after) / a.before) * 100 : 0
      return {
        patch: { status: 'completed', completedAt: now, baselineKwh: a.before, afterKwh: a.after, ...stamp },
        event: {
          ...base,
          kind: 'stage_done',
          text: `用電比較完成：改善後每月平均 ${a.after.toLocaleString('en-US')} 度，較改善前減少 ${pct.toFixed(1)}%`,
        },
      }
    }
  }
}
