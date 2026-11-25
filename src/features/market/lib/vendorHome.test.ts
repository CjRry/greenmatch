import { describe, expect, it } from 'vitest'
import { seedData } from '../../../data/seed'
import type { Case, Company, Need, Quote, Review, Vendor } from '../../../core/types'
import { buildCollections, collectionFor } from './collections'
import { needsForVendor, profileCompleteness, savingBenchmark, stageTag, vendorPerformance, vendorTodos, vendorWaiting } from './vendorHome'

const seed = seedData()
const companies = seed.companies as Company[]
const cases = seed.cases as Case[]
const quotes = seed.quotes as Quote[]
const needs = seed.needs as Need[]
const reviews = seed.reviews as Review[]
const vendor = (id: string) => companies.find((c) => c.id === id) as Vendor
const nameOf = (id: string) => companies.find((c) => c.id === id)?.name ?? id

const base: Case = {
  id: 'x1',
  needId: 'n01',
  factoryId: 'f01',
  title: '測試案件',
  stage: 'survey',
  stageStartedAt: '2026-11-01 09:00',
  status: 'active',
  recommendations: [],
  shortlist: ['v01', 'v04'],
  createdAt: '2026-11-01 09:00',
  updatedAt: '2026-11-01 09:00',
}

describe('vendorTodos', () => {
  it('lists only the steps that are this vendor’s to take, oldest first', () => {
    const list: Case[] = [
      { ...base, id: 's1', stage: 'survey', stageStartedAt: '2026-11-10 09:00' },
      { ...base, id: 's2', stage: 'survey', surveyDate: '2026-11-20 10:00', stageStartedAt: '2026-11-02 09:00' },
      { ...base, id: 'q1', stage: 'quote' },
      { ...base, id: 'q2', stage: 'quote' },
      { ...base, id: 'k1', stage: 'contract', selectedVendorId: 'v01' },
      { ...base, id: 'k2', stage: 'contract', selectedVendorId: 'v04' },
      { ...base, id: 'b1', stage: 'construction', selectedVendorId: 'v01' },
      { ...base, id: 'a1', stage: 'acceptance', selectedVendorId: 'v01' },
      { ...base, id: 'o1', stage: 'survey', shortlist: ['v02', 'v04'] },
      { ...base, id: 'd1', stage: 'survey', status: 'cancelled' },
    ]
    const sent: Quote[] = [{ id: 'qq', caseId: 'q2', vendorId: 'v01', rawText: '', submittedAt: '2026-11-05 09:00' }]
    const todos = vendorTodos('v01', list, sent, nameOf, '2026-11-15 09:00')
    expect(todos.map((t) => [t.caseId, t.action])).toEqual([
      ['b1', '回報施工進度'],
      ['k1', '確認簽約內容'],
      ['q1', '提交報價'],
      ['s2', '完成場勘並記錄'],
      ['s1', '約場勘時間'],
    ])
    expect(todos[0].waitingDays).toBe(14)
    expect(todos[0].factoryName).toBe(nameOf('f01'))
  })
  it('counts cases waiting on the factory', () => {
    const list: Case[] = [
      { ...base, id: 'q2', stage: 'quote' },
      { ...base, id: 'r1', stage: 'assess', shortlist: [], recommendations: [{ vendorId: 'v01' } as Case['recommendations'][number]] },
    ]
    const sent: Quote[] = [{ id: 'qq', caseId: 'q2', vendorId: 'v01', rawText: '', submittedAt: '2026-11-05 09:00' }]
    expect(vendorWaiting('v01', list, sent)).toBe(2)
  })
  it('works on the seed: the demo vendor has something to do', () => {
    expect(vendorTodos('v01', cases, quotes, nameOf, '2026-11-25 12:00').length).toBeGreaterThan(0)
  })
})

describe('needsForVendor', () => {
  it('returns only open needs whose equipment this vendor offers, with reasons', () => {
    const v = vendor('v01')
    const fits = needsForVendor(needs, v, companies)
    expect(fits.length).toBeGreaterThan(0)
    expect(fits.length).toBeLessThanOrEqual(5)
    for (const f of fits) {
      expect(f.need.status).toBe('open')
      expect(f.matched.every((s) => v.vendor.specialties.includes(s))).toBe(true)
      expect(f.reasons[0]).toMatch(/^專長符合：/)
    }
    // High fits come first.
    const levels = fits.map((f) => f.level)
    expect(levels.indexOf('maybe') === -1 || levels.lastIndexOf('high') < levels.indexOf('maybe')).toBe(true)
  })
})

describe('profileCompleteness', () => {
  it('scores the six profile items and names what is missing', () => {
    const v = vendor('v01')
    const empty: Vendor = { ...v, intro: '', vendor: { ...v.vendor, tagline: '', certifications: [], portfolio: [], servedIndustries: [], assistsSubsidy: undefined } }
    expect(profileCompleteness(empty)).toEqual({
      pct: 0,
      missing: ['公司介紹（至少 20 字）', '一句話標語', '證照或資格', '至少 3 件過去實績', '服務過的產業', '是否協助申請補助'],
    })
    const c = profileCompleteness(v)
    expect(c.pct).toBeGreaterThan(0)
    expect(c.pct).toBeLessThanOrEqual(100)
  })
})

describe('vendorPerformance', () => {
  it('counts quoted cases and the ones the factory chose this vendor for', () => {
    const list: Case[] = [
      { ...base, id: 'w1', stage: 'contract', selectedVendorId: 'v01' },
      { ...base, id: 'l1', stage: 'contract', selectedVendorId: 'v04' },
      { ...base, id: 'p1', stage: 'quote' },
    ]
    const sent: Quote[] = ['w1', 'l1', 'p1'].map((caseId, i) => ({ id: `q${i}`, caseId, vendorId: 'v01', rawText: '', submittedAt: '2026-11-05 09:00' }))
    expect(vendorPerformance('v01', list, sent)).toEqual({ quoted: 3, won: 1 })
  })
})

describe('savingBenchmark', () => {
  it('compares the vendor’s main equipment with the anonymous median of other vendors', () => {
    const all = buildCollections(companies, reviews)
    const mine = collectionFor(vendor('v01'), reviews)
    const b = savingBenchmark(mine, all)
    expect(b).not.toBeNull()
    expect(b!.peerCount).toBeGreaterThanOrEqual(3)
    expect(mine.vendor.vendor.specialties.concat(mine.installs.map((i) => i.equip))).toContain(b!.equip)
  })
  it('returns null when there is nothing to compare', () => {
    const mine = collectionFor(vendor('v01'), reviews)
    expect(savingBenchmark(mine, [mine])).toBeNull()
  })
})

describe('stageTag', () => {
  it('shows the stage number and name', () => {
    expect(stageTag('quote')).toBe('4/8 方案與報價')
  })
})
