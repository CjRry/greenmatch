import { describe, expect, it } from 'vitest'
import { fixtureData } from '../../../test/fixtures'
import type { Case, CaseEvent, Quote } from '../../../core/types'
import {
  bucketCounts,
  elapsedText,
  factoryBucket,
  factoryTodos,
  handlerText,
  latestFirst,
  mayView,
  parseTab,
  timelineSteps,
  vendorBucket,
} from './views'

const data = fixtureData()
const cases = data.cases as Case[]
const events = data.caseEvents as CaseEvent[]
const quotes = data.quotes as Quote[]
const byId = (id: string) => cases.find((c) => c.id === id)!

describe('factory buckets', () => {
  it('places each stage in its status-bar cell', () => {
    expect(factoryBucket(byId('c08'))).toBe('matching')
    expect(factoryBucket(byId('c01'))).toBe('quoting')
    expect(factoryBucket(byId('c02'))).toBe('quoting')
    expect(factoryBucket(byId('c04'))).toBe('building')
    expect(factoryBucket(byId('c03'))).toBe('building')
    expect(factoryBucket(byId('c05'))).toBe('accepting')
    expect(factoryBucket(byId('c06'))).toBe('done')
  })
  it('counts every case once and totals under all', () => {
    const rows = cases.map((c) => ({ bucket: factoryBucket(c) }))
    const counts = bucketCounts(['matching', 'quoting', 'building', 'accepting', 'done'], rows)
    expect(counts.all).toBe(cases.length)
    expect(counts.matching + counts.quoting + counts.building + counts.accepting + counts.done).toBe(cases.length)
  })
})

describe('vendor buckets', () => {
  it('marks a shortlisted vendor as 待報價 until they submit', () => {
    const c01 = byId('c01')
    const [a, b] = c01.shortlist
    expect(quotes.some((q) => q.caseId === 'c01' && q.vendorId === a)).toBe(true)
    expect(vendorBucket(c01, a, quotes)).toBeNull()
    expect(vendorBucket(c01, a, quotes.filter((q) => q.vendorId !== a))).toBe('quote')
    expect(vendorBucket(c01, b, [])).toBe('quote')
  })
  it('shows recommended vendors a new case at assess, and not other vendors', () => {
    const c = byId('c08')
    const rec = c.recommendations[0].vendorId
    expect(vendorBucket(c, rec, quotes)).toBe('invited')
    expect(vendorBucket(c, 'v99', quotes)).toBeNull()
  })
  it('puts the selected vendor on building, accepting and done', () => {
    const sel = (id: string) => byId(id).selectedVendorId!
    expect(vendorBucket(byId('c04'), sel('c04'), quotes)).toBe('building')
    expect(vendorBucket(byId('c05'), sel('c05'), quotes)).toBe('accepting')
    expect(vendorBucket(byId('c06'), sel('c06'), quotes)).toBe('done')
  })
  it('puts a shortlisted vendor at survey in 待場勘', () => {
    const c = byId('c02')
    expect(vendorBucket(c, c.shortlist[0], quotes)).toBe('survey')
  })
})

describe('todos, handler and tab parsing', () => {
  it('lists active cases whose stage the factory owns', () => {
    const todo = factoryTodos(cases)
    expect(todo.every((c) => c.status === 'active')).toBe(true)
    expect(todo.map((c) => c.id)).toContain('c05')
    expect(todo.map((c) => c.id)).not.toContain('c01')
  })
  it('names who is handling the case', () => {
    expect(handlerText(byId('c01'))).toBe('目前由廠商處理')
    expect(handlerText(byId('c06'))).toBe('案件已完成')
  })
  it('falls back to all for unknown tabs', () => {
    expect(parseTab('factory', 'building')).toBe('building')
    expect(parseTab('factory', 'invited')).toBe('all')
    expect(parseTab('vendor', 'invited')).toBe('invited')
    expect(parseTab('vendor', null)).toBe('all')
  })
})

describe('timelineSteps', () => {
  it('shows c01 with 3 done stages, quote current and later stages upcoming', () => {
    const steps = timelineSteps(byId('c01'), events)
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(steps[0].doneAt).toBeTruthy()
    expect(steps[3].n).toBe(4)
    expect(steps[3].doneAt).toBeNull()
  })
  it('shows every stage done for a completed case, including the quote selection date', () => {
    const steps = timelineSteps(byId('c06'), events)
    expect(steps.every((s) => s.state === 'done')).toBe(true)
    expect(steps.every((s) => s.doneAt)).toBe(true)
  })
})

describe('small helpers', () => {
  it('describes elapsed days', () => {
    expect(elapsedText('2026-10-20T00:00:00.000Z', new Date('2026-10-26T12:00:00.000Z'))).toBe('已進行 6 天')
    expect(elapsedText('2026-10-26T01:00:00.000Z', new Date('2026-10-26T12:00:00.000Z'))).toBe('今天開始')
  })
  it('sorts events newest first', () => {
    const sorted = latestFirst(events.filter((e) => e.caseId === 'c01'))
    for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1].at >= sorted[i].at).toBe(true)
  })
  it('limits who can view a case', () => {
    const c = byId('c01')
    expect(mayView(c, 'factory', c.factoryId)).toBe(true)
    expect(mayView(c, 'factory', 'f12')).toBe(false)
    expect(mayView(c, 'vendor', c.shortlist[0])).toBe(true)
    expect(mayView(c, 'vendor', 'v99')).toBe(false)
    expect(mayView(c, null, null)).toBe(false)
  })
})
