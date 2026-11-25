import { describe, expect, it } from 'vitest'
import { STAGE_KEYS } from '../../core/constants/stages'
import { COLLECTIONS, type Case, type Company } from '../../core/types'
import { seedData } from '.'

const seed = seedData()
const ids = (col: keyof typeof seed) => new Set((seed[col] ?? []).map((d) => d.id))

describe('demo seed', () => {
  it('has the agreed volume', () => {
    const companies = seed.companies as Company[]
    expect(companies.filter((c) => c.role === 'factory').length).toBeGreaterThanOrEqual(12)
    expect(companies.filter((c) => c.role === 'vendor').length).toBeGreaterThanOrEqual(9)
    expect(seed.reviews!.length).toBeGreaterThanOrEqual(20)
    expect(new Set(seed.carbon!.map((c) => c.factoryId)).size).toBeGreaterThanOrEqual(4)
  })

  it('has an active case at every stage after 需求登記', () => {
    const stages = new Set((seed.cases as Case[]).map((c) => c.stage))
    for (const key of STAGE_KEYS.slice(1)) expect(stages.has(key), key).toBe(true)
  })

  it('marks every record as demo and uses unique, path-safe ids under 256 KiB', () => {
    for (const col of COLLECTIONS) {
      const docs = seed[col] ?? []
      expect(new Set(docs.map((d) => d.id)).size, col).toBe(docs.length)
      for (const d of docs) {
        expect(d.id).toMatch(/^[A-Za-z0-9_\-.~:@+]+$/)
        expect((d as { isDemo?: boolean }).isDemo, `${col}/${d.id}`).toBe(true)
        expect(JSON.stringify(d).length).toBeLessThan(256 * 1024)
      }
    }
  })

  it('every reference resolves', () => {
    const companies = ids('companies')
    const needs = ids('needs')
    const cases = ids('cases')
    for (const n of seed.needs!) {
      expect(companies.has(n.factoryId)).toBe(true)
      if (n.caseId) expect(cases.has(n.caseId)).toBe(true)
      for (const v of n.interestedVendorIds) expect(companies.has(v)).toBe(true)
    }
    for (const c of seed.cases!) {
      expect(needs.has(c.needId)).toBe(true)
      expect(companies.has(c.factoryId)).toBe(true)
      for (const v of [...c.shortlist, ...c.recommendations.map((r) => r.vendorId)]) expect(companies.has(v)).toBe(true)
      if (c.selectedVendorId) expect(c.shortlist).toContain(c.selectedVendorId)
    }
    for (const e of seed.caseEvents!) expect(cases.has(e.caseId)).toBe(true)
    for (const q of seed.quotes!) {
      expect(cases.has(q.caseId)).toBe(true)
      expect(companies.has(q.vendorId)).toBe(true)
    }
    for (const r of seed.reviews!) {
      expect(companies.has(r.vendorId)).toBe(true)
      expect(companies.has(r.factoryId)).toBe(true)
      if (r.caseId) expect(cases.has(r.caseId)).toBe(true)
    }
    for (const c of seed.carbon!) expect(companies.has(c.factoryId)).toBe(true)
  })

  it('c01 is the deck example: stage 4/8 with two quotes and no saved comparison', () => {
    const c01 = seed.cases!.find((c) => c.id === 'c01')!
    expect(c01.stage).toBe('quote')
    expect(seed.quotes!.filter((q) => q.caseId === 'c01')).toHaveLength(2)
    expect(seed.quoteComparisons!.find((q) => q.caseId === 'c01')).toBeUndefined()
  })
})
