import { describe, expect, it } from 'vitest'
import { rankVendors } from '../../src/core/domain/matching'
import type { Factory, Need } from '../../src/core/types'
import { fixtureData } from '../../src/test/fixtures'

const data = fixtureData()
const companies = data.companies ?? []
const reviews = data.reviews ?? []
const needs = data.needs ?? []
const n01 = needs.find((n) => n.id === 'n01') as Need
const f01 = companies.find((c) => c.id === 'f01') as Factory

describe('rankVendors（推薦 2 家）', () => {
  it('n01 推薦 v01 與 v11', () => {
    const recs = rankVendors(n01, f01, companies, reviews)
    expect(recs.map((r) => r.vendorId).sort()).toEqual(['v01', 'v11'])
    expect(recs.map((r) => r.rank)).toEqual([1, 2])
  })

  it('每筆推薦都有理由與五項分數', () => {
    for (const r of rankVendors(n01, f01, companies, reviews)) {
      expect(r.reasons.length).toBeGreaterThan(0)
      expect(r.reasonText.trim()).not.toBe('')
      expect(Object.keys(r.factors).sort()).toEqual(['distance', 'rating', 'scale', 'specialty', 'track'])
    }
  })

  it('只回傳廠商', () => {
    const recs = rankVendors(n01, f01, companies, reviews)
    for (const r of recs) expect(companies.find((c) => c.id === r.vendorId)?.role).toBe('vendor')
  })

  it('輸入順序打亂後結果不變（決勝規則穩定）', () => {
    const base = rankVendors(n01, f01, companies, reviews).map((r) => r.vendorId)
    const reversed = rankVendors(n01, f01, [...companies].reverse(), [...reviews].reverse()).map((r) => r.vendorId)
    expect(reversed).toEqual(base)
  })

  it('重複執行結果完全相同', () => {
    expect(rankVendors(n01, f01, companies, reviews)).toEqual(rankVendors(n01, f01, companies, reviews))
  })

  it('沒有廠商符合時回傳空陣列，不丟錯', () => {
    expect(rankVendors(n01, f01, [], [])).toEqual([])
  })

  it('分數相同時以 id 決勝（兩家完全相同的廠商）', () => {
    const v01 = companies.find((c) => c.id === 'v01')!
    const clone = (id: string) => ({ ...v01, id })
    const recs = rankVendors(n01, f01, [clone('vzz'), clone('vaa')], [])
    expect(recs.map((r) => r.vendorId)).toEqual(['vaa', 'vzz'])
  })
})
