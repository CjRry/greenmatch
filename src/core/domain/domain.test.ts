import { describe, expect, it } from 'vitest'
import { seedData } from '../../data/seed'
import type { CarbonInventory, Case, Company, Factory, Need, Review, Vendor } from '../types'
import { emptyInventory, summarizeInventory } from './carbon'
import { DEFAULT_WEIGHTS, rankVendors, sameIndustrySummary, vendorIndustryExperience } from './matching'
import { vendorStats } from './vendorStats'

const seed = seedData()
const companies = seed.companies as Company[]
const reviews = seed.reviews as Review[]
const needs = seed.needs as Need[]
const factory = (id: string) => companies.find((c) => c.id === id) as Factory

describe('carbon', () => {
  it('100,000 kWh of electricity is 47.4 tCO2e (scope 2)', () => {
    const inv: CarbonInventory = emptyInventory('f', 2026, '2026-01-01T00:00:00.000Z')
    inv.months[0] = { m: 1, kwh: 100_000, fuels: [] }
    const s = summarizeInventory(inv)
    expect(s.scope2T).toBeCloseTo(47.4, 5)
    expect(s.scope1T).toBe(0)
    expect(s.filledMonths).toBe(1)
  })

  it('adds scope 1 from fuels', () => {
    const inv = emptyInventory('f', 2026, '2026-01-01T00:00:00.000Z')
    inv.months[0] = { m: 1, kwh: 0, fuels: [{ fuel: 'diesel', amount: 1000 }] }
    expect(summarizeInventory(inv).scope1T).toBeCloseTo(2.606, 5)
  })
})

describe('vendorStats', () => {
  it('uses a Bayesian average', () => {
    const st = vendorStats('vX', [{ id: 'r', vendorId: 'vX', factoryId: 'f', caseId: null, rating: 5, comment: '', createdAt: '' }])
    expect(st.avg).toBe(5)
    expect(st.bayes).toBeCloseTo((4 * 5 + 5) / 6, 5)
  })
})

describe('rankVendors', () => {
  it('recommends exactly 2 vendors with reasons for the deck example (空壓機 3 台 + 空調)', () => {
    const need = needs.find((n) => n.id === 'n01')!
    const recs = rankVendors(need, factory('f01'), companies, reviews)
    expect(recs).toHaveLength(2)
    expect(recs.map((r) => r.vendorId).sort()).toEqual(['v01', 'v11'])
    for (const r of recs) {
      expect(r.reasons.length).toBeGreaterThan(0)
      expect(r.reasonText).toBe(r.reasons.join('、'))
      expect(r.score).toBeGreaterThan(0)
      expect(r.score).toBeLessThanOrEqual(100)
    }
    expect(recs[0].score).toBeGreaterThanOrEqual(recs[1].score)
  })

  it('weights sum to 1 and every factor is between 0 and 1', () => {
    const need = needs.find((n) => n.id === 'n09')!
    const [r] = rankVendors(need, factory('f07'), companies, reviews)
    const sum = Object.values(r.factors).reduce((a, f) => a + f.w, 0)
    expect(sum).toBeCloseTo(1, 5)
    for (const f of Object.values(r.factors)) {
      expect(f.s).toBeGreaterThanOrEqual(0)
      expect(f.s).toBeLessThanOrEqual(1)
    }
  })

  it('only recommends carbon consultants for a carbon-inventory need', () => {
    const need = needs.find((n) => n.id === 'n12')!
    const recs = rankVendors(need, factory('f01'), companies, reviews)
    for (const r of recs) {
      const v = companies.find((c) => c.id === r.vendorId)!
      expect(v.role === 'vendor' && v.vendor.specialties.includes('carbon_consulting')).toBe(true)
    }
  })

  it('is deterministic and respects custom weights', () => {
    const need = needs.find((n) => n.id === 'n02')!
    const a = rankVendors(need, factory('f02'), companies, reviews)
    const b = rankVendors(need, factory('f02'), companies, reviews)
    expect(a).toEqual(b)
    const distanceOnly = rankVendors(need, factory('f02'), companies, reviews, { ...DEFAULT_WEIGHTS, specialty: 0, track: 0, rating: 0, scale: 0, distance: 1 })
    expect(distanceOnly[0].factors.distance.w).toBe(1)
  })

  it('returns fewer than 2 when fewer vendors qualify', () => {
    const need: Pick<Need, 'form' | 'scale' | 'interestedVendorIds'> = {
      form: { items: [{ equip: 'solar_pv', quantity: null, ageYears: null }], mainProblems: [], directions: [], openQuestions: [] },
      scale: 'S',
      interestedVendorIds: [],
    }
    const onlyOne = companies.filter((c) => c.role === 'factory' || c.id === 'v06')
    expect(rankVendors(need, factory('f10'), onlyOne, reviews)).toHaveLength(1)
  })

  it('prefers vendors with same-industry collaboration experience over equal cross-industry peers', () => {
    const baseVendor = companies.find((c) => c.id === 'v01') as Vendor
    const targetFactory = factory('f01') // 金屬加工
    const need: Pick<Need, 'form' | 'scale' | 'interestedVendorIds'> = {
      form: { items: [{ equip: 'air_compressor', quantity: 1, ageYears: 10 }], mainProblems: [], directions: [], openQuestions: [] },
      scale: targetFactory.factory.scale,
      interestedVendorIds: [],
    }
    const peerA: Vendor = {
      ...baseVendor,
      id: 'va',
      vendor: {
        ...baseVendor.vendor,
        completedCases: 20,
        servedIndustries: ['塑膠射出'],
        portfolio: [{ title: '射出機油壓空壓改造', industry: '塑膠射出', city: '台南市', equip: 'air_compressor', savingPct: 20, year: 2025 }],
      },
    }
    const peerB: Vendor = {
      ...baseVendor,
      id: 'vb',
      vendor: {
        ...baseVendor.vendor,
        completedCases: 20,
        servedIndustries: ['金屬加工'],
        portfolio: [{ title: '精密扣件加工廠空壓改造', industry: '金屬加工', city: '台南市', equip: 'air_compressor', savingPct: 22, year: 2025 }],
      },
    }
    const recs = rankVendors(need, targetFactory, [targetFactory, peerA, peerB], [])
    expect(recs.map((r) => r.vendorId)).toEqual(['vb', 'va'])
    expect(recs[0].score).toBeGreaterThan(recs[1].score)
    expect(recs[0].factors.track.detail).toContain('同業（金屬加工）實績 1 件')
    expect(recs[0].reasons.join('、')).toContain('金屬加工同業')
  })

  it('counts completed/contracted Cases toward same-industry experience when summarizing', () => {
    const fFood = factory('f11') // 食品加工
    const vCustom: Vendor = {
      ...(companies.find((c) => c.id === 'v03') as Vendor),
      id: 'vc',
      vendor: {
        ...(companies.find((c) => c.id === 'v03') as Vendor).vendor,
        servedIndustries: [],
        portfolio: [{ title: '射出廠 LED 汰換', city: '台中市', equip: 'lighting', savingPct: 40, year: 2025 }],
      },
    }
    const pastCases: Case[] = [
      {
        id: 'c_hist',
        title: '食品廠歷史照明汰換',
        needId: 'n_hist',
        factoryId: fFood.id,
        stage: 'compare',
        stageStartedAt: '2025-01-01T00:00:00Z',
        recommendations: [],
        shortlist: ['vc'],
        selectedVendorId: 'vc',
        status: 'completed',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-06-01T00:00:00Z',
      },
    ]
    const exp = vendorIndustryExperience(vCustom, [fFood, vCustom], pastCases)
    expect(exp.industries).toEqual(expect.arrayContaining(['塑膠射出', '食品加工']))
    expect(sameIndustrySummary(vCustom, '食品加工', [fFood, vCustom], pastCases)).toMatchObject({
      hasExperience: true,
      caseCount: 1,
    })
  })
})
