import { describe, expect, it } from 'vitest'
import { formatDateTime } from '../../../core/format'
import type { Case, StageKey } from '../../../core/types'
import { isError, transition, usageSaving, whyNot, type Actor, type CaseAction } from './transitions'

const NOW = '2026-10-26T08:00:00.000Z'
const factory: Actor = { role: 'factory', id: 'f01' }
const vendorA: Actor = { role: 'vendor', id: 'v01' }
const vendorB: Actor = { role: 'vendor', id: 'v11' }
const outsider: Actor = { role: 'vendor', id: 'v99' }
const otherFactory: Actor = { role: 'factory', id: 'f02' }

function makeCase(stage: StageKey, extra: Partial<Case> = {}): Case {
  return {
    id: 'cx',
    needId: 'nx',
    factoryId: 'f01',
    title: '空壓機汰換',
    stage,
    stageStartedAt: '2026-10-01T00:00:00.000Z',
    status: 'active',
    recommendations: [],
    shortlist: ['v01', 'v11'],
    selectedVendorId: ['contract', 'construction', 'acceptance', 'compare'].includes(stage) ? 'v01' : null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...extra,
  }
}

const ctx = { now: NOW, nameOf: (id: string) => `廠商${id}`, quotedVendorIds: ['v01'] }
const run = (c: Case, a: CaseAction, who: Actor) => transition(c, a, who, ctx)

describe('transition: survey', () => {
  const c = makeCase('survey')
  it('lets a shortlisted vendor schedule the survey', () => {
    const at = '2026-10-30T10:00:00.000Z'
    const r = run(c, { type: 'schedule_survey', at }, vendorA)
    if (isError(r)) throw new Error(r.error)
    expect(r.patch.surveyDate).toBe(at)
    expect(r.event).toMatchObject({ kind: 'schedule', stage: 'survey', actor: 'vendor', actorId: 'v01', at: NOW })
    expect(r.event.text).toContain(formatDateTime(at))
    expect(r.patch.stage).toBeUndefined()
  })
  it('rejects the factory scheduling, outsiders and bad dates', () => {
    expect(isError(run(c, { type: 'schedule_survey', at: '2026-10-30T10:00:00.000Z' }, factory))).toBe(true)
    expect(isError(run(c, { type: 'schedule_survey', at: '2026-10-30T10:00:00.000Z' }, outsider))).toBe(true)
    expect(isError(run(c, { type: 'schedule_survey', at: 'nope' }, vendorA))).toBe(true)
  })
  it('lets factory or vendor finish the survey and moves to quote', () => {
    for (const who of [factory, vendorB]) {
      const r = run(c, { type: 'finish_survey' }, who)
      if (isError(r)) throw new Error(r.error)
      expect(r.patch).toMatchObject({ stage: 'quote', stageStartedAt: NOW })
      expect(r.event).toMatchObject({ kind: 'stage_done', stage: 'survey' })
    }
  })
  it('rejects another factory', () => {
    expect(isError(run(c, { type: 'finish_survey' }, otherFactory))).toBe(true)
  })
})

describe('transition: quote', () => {
  const c = makeCase('quote')
  it('lets a shortlisted vendor submit or update a quote without changing stage', () => {
    const r = run(c, { type: 'submit_quote' }, vendorA)
    if (isError(r)) throw new Error(r.error)
    expect(r.event).toMatchObject({ kind: 'quote', stage: 'quote' })
    expect(r.event.text).toContain('提交報價')
    expect(r.patch.stage).toBeUndefined()
    const u = run(c, { type: 'submit_quote', updated: true }, vendorB)
    if (isError(u)) throw new Error(u.error)
    expect(u.event.text).toContain('更新報價')
  })
  it('rejects quotes from outsiders and from the factory', () => {
    expect(isError(run(c, { type: 'submit_quote' }, outsider))).toBe(true)
    expect(isError(run(c, { type: 'submit_quote' }, factory))).toBe(true)
  })
  it('lets the factory select a vendor who has quoted and moves to contract', () => {
    const r = run(c, { type: 'select_vendor', vendorId: 'v01' }, factory)
    if (isError(r)) throw new Error(r.error)
    expect(r.patch).toMatchObject({ stage: 'contract', selectedVendorId: 'v01' })
    expect(r.event).toMatchObject({ kind: 'select', stage: 'quote', actor: 'factory' })
  })
  it('rejects selecting a vendor who has not quoted, or is not shortlisted, or by a vendor', () => {
    expect(isError(run(c, { type: 'select_vendor', vendorId: 'v11' }, factory))).toBe(true)
    expect(isError(transition(c, { type: 'select_vendor', vendorId: 'v99' }, factory, { ...ctx, quotedVendorIds: ['v99'] }))).toBe(true)
    expect(isError(run(c, { type: 'select_vendor', vendorId: 'v01' }, vendorA))).toBe(true)
  })
})

describe('transition: contract', () => {
  const c = makeCase('contract')
  const sign: CaseAction = { type: 'sign_contract', contractNtd: 1320000, startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-20T00:00:00.000Z' }
  it('lets factory or the selected vendor sign and moves to construction', () => {
    for (const who of [factory, vendorA]) {
      const r = run(c, sign, who)
      if (isError(r)) throw new Error(r.error)
      expect(r.patch).toMatchObject({ stage: 'construction', contractNtd: 1320000, startDate: '2026-11-01T00:00:00.000Z' })
      expect(r.event).toMatchObject({ kind: 'stage_done', stage: 'contract' })
      expect(r.event.text).not.toMatch(/NT\$|1,320,000|2026-11/)
    }
  })
  it('rejects the unselected vendor, bad amounts and reversed dates', () => {
    expect(isError(run(c, sign, vendorB))).toBe(true)
    expect(isError(run(c, { ...sign, contractNtd: 0 }, factory))).toBe(true)
    expect(isError(run(c, { ...sign, startDate: '2026-12-01T00:00:00.000Z' }, factory))).toBe(true)
  })
})

describe('transition: construction', () => {
  const c = makeCase('construction')
  it('lets the selected vendor report progress and finish', () => {
    const p = run(c, { type: 'report_progress', text: '主機已吊裝' }, vendorA)
    if (isError(p)) throw new Error(p.error)
    expect(p.event).toMatchObject({ kind: 'progress', stage: 'construction' })
    expect(p.event.text).toContain('主機已吊裝')
    const f = run(c, { type: 'finish_construction' }, vendorA)
    if (isError(f)) throw new Error(f.error)
    expect(f.patch.stage).toBe('acceptance')
  })
  it('rejects the factory, other vendors and empty progress', () => {
    expect(isError(run(c, { type: 'report_progress', text: 'x' }, factory))).toBe(true)
    expect(isError(run(c, { type: 'finish_construction' }, vendorB))).toBe(true)
    expect(isError(run(c, { type: 'report_progress', text: '  ' }, vendorA))).toBe(true)
  })
})

describe('transition: acceptance', () => {
  const c = makeCase('acceptance')
  it('lets the factory accept and review', () => {
    const a = run(c, { type: 'accept' }, factory)
    if (isError(a)) throw new Error(a.error)
    expect(a.patch.stage).toBe('compare')
    const r = run(c, { type: 'review', rating: 5 }, factory)
    if (isError(r)) throw new Error(r.error)
    expect(r.event).toMatchObject({ kind: 'review', stage: 'acceptance' })
  })
  it('rejects the vendor accepting and invalid ratings', () => {
    expect(isError(run(c, { type: 'accept' }, vendorA))).toBe(true)
    expect(isError(run(c, { type: 'review', rating: 0 }, factory))).toBe(true)
    expect(isError(run(c, { type: 'review', rating: 6 }, factory))).toBe(true)
  })
})

describe('transition: compare', () => {
  const usage = [
    { month: '2026-01', kwh: 100000, phase: 'before' as const },
    { month: '2026-02', kwh: 100000, phase: 'before' as const },
  ]
  it('adds an after point, replacing the same month', () => {
    const c = makeCase('compare', { usage })
    const r1 = run(c, { type: 'add_usage', month: '2026-08', kwh: 80000, phase: 'after' }, factory)
    if (isError(r1)) throw new Error(r1.error)
    expect(r1.patch.usage).toHaveLength(3)
    const c2 = makeCase('compare', { usage: r1.patch.usage as Case['usage'] })
    const r2 = run(c2, { type: 'add_usage', month: '2026-08', kwh: 75000, phase: 'after' }, factory)
    if (isError(r2)) throw new Error(r2.error)
    expect(r2.patch.usage).toHaveLength(3)
    expect(r2.event.kind).toBe('note')
  })
  it('rejects bad months, bad kWh and vendors', () => {
    const c = makeCase('compare', { usage })
    expect(isError(run(c, { type: 'add_usage', month: '2026-13', kwh: 1, phase: 'after' }, factory))).toBe(true)
    expect(isError(run(c, { type: 'add_usage', month: '2026-08', kwh: -5, phase: 'after' }, factory))).toBe(true)
    expect(isError(run(c, { type: 'add_usage', month: '2026-08', kwh: 5, phase: 'after' }, vendorA))).toBe(true)
  })
  it('completes only with before and after data, and computes averages', () => {
    expect(isError(run(makeCase('compare', { usage }), { type: 'complete_compare' }, factory))).toBe(true)
    const c = makeCase('compare', { usage: [...usage, { month: '2026-08', kwh: 80000, phase: 'after' }] })
    const r = run(c, { type: 'complete_compare' }, factory)
    if (isError(r)) throw new Error(r.error)
    expect(r.patch).toMatchObject({ status: 'completed', completedAt: NOW, baselineKwh: 100000, afterKwh: 80000 })
    expect(r.event.text).toContain('20.0%')
    expect(isError(run(c, { type: 'complete_compare' }, vendorA))).toBe(true)
  })
})

describe('transition: wrong stage and finished cases', () => {
  const all: CaseAction[] = [
    { type: 'schedule_survey', at: '2026-10-30T10:00:00.000Z' },
    { type: 'finish_survey' },
    { type: 'submit_quote' },
    { type: 'select_vendor', vendorId: 'v01' },
    { type: 'sign_contract', contractNtd: 1, startDate: '2026-11-01', endDate: '2026-11-02' },
    { type: 'report_progress', text: 'x' },
    { type: 'finish_construction' },
    { type: 'accept' },
    { type: 'review', rating: 5 },
    { type: 'add_usage', month: '2026-08', kwh: 1, phase: 'after' },
    { type: 'complete_compare' },
  ]
  it('allows nothing at register or assess (the platform and AI pages own them)', () => {
    for (const stage of ['register', 'assess'] as const) {
      for (const a of all) for (const who of [factory, vendorA]) expect(isError(transition(makeCase(stage), a, who, ctx))).toBe(true)
    }
  })
  it('allows nothing on completed or cancelled cases', () => {
    for (const status of ['completed', 'cancelled'] as const) {
      const c = makeCase('compare', { status })
      for (const a of all) expect(isError(transition(c, a, factory, ctx))).toBe(true)
    }
  })
  it('allows each action only in its own stage(s)', () => {
    const stages: StageKey[] = ['survey', 'quote', 'contract', 'construction', 'acceptance', 'compare']
    const okAt: Record<string, StageKey[]> = {
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
    for (const a of all) {
      for (const s of stages) {
        const who = ['schedule_survey', 'submit_quote', 'report_progress', 'finish_construction'].includes(a.type) ? vendorA : factory
        const reason = whyNot(makeCase(s), a.type, who)
        expect(reason === null).toBe(okAt[a.type].includes(s))
      }
    }
  })
  it('needs a signed-in actor', () => {
    expect(whyNot(makeCase('survey'), 'finish_survey', null)).toBeTruthy()
  })
})

describe('usageSaving', () => {
  it('computes percent and monthly CO2e from the electricity factor', () => {
    const s = usageSaving([
      { month: '2026-01', kwh: 100000, phase: 'before' },
      { month: '2026-08', kwh: 80000, phase: 'after' },
    ])
    expect(s?.savedPct).toBeCloseTo(20)
    expect(s?.savedKgCo2e).toBeCloseTo(20000 * 0.474)
  })
  it('is null without both phases', () => {
    expect(usageSaving([{ month: '2026-01', kwh: 1, phase: 'before' }])).toBeNull()
    expect(usageSaving(undefined)).toBeNull()
  })
})
