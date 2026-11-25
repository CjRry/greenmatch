import { describe, expect, it } from 'vitest'
import { vendors } from '../../data/seed/companies'
import { EXTRA_INSTALLS } from '../../data/vendorInstalls'
import type { Vendor } from '../types'
import { buildInstall, collectionStats, stageDeltaDays, traitShare, vendorInstalls } from './installs'

const v01 = vendors.find((v) => v.id === 'v01') as Vendor

describe('vendorInstalls', () => {
  it('turns portfolio plus demo extras into installs, newest first, each with 8 stages', () => {
    const list = vendorInstalls(v01, EXTRA_INSTALLS.v01)
    expect(list).toHaveLength(v01.vendor.portfolio.length + EXTRA_INSTALLS.v01.length)
    for (const i of list) {
      expect(i.steps.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
      expect(i.totalDays).toBe(i.steps.reduce((s, x) => s + x.days, 0))
      expect(i.traits).toHaveLength(9)
    }
    const keys = list.map((i) => i.year * 100 + i.month)
    expect(keys).toEqual([...keys].sort((a, b) => b - a))
  })

  it('is deterministic', () => {
    expect(vendorInstalls(v01, EXTRA_INSTALLS.v01)).toEqual(vendorInstalls(v01, EXTRA_INSTALLS.v01))
  })

  it('ignores extras for vendors a person registered', () => {
    const real: Vendor = { ...v01, isDemo: false }
    expect(vendorInstalls(real, EXTRA_INSTALLS.v01)).toHaveLength(v01.vendor.portfolio.length)
  })
})

describe('buildInstall variations', () => {
  const base = { title: '測試案', industry: '金屬加工', city: '台南市' as const, equip: 'air_compressor' as const, year: 2025, month: 5, savingPct: 20 }

  it('a subsidy adds 14 days to signing and marks the stage', () => {
    const plain = buildInstall(v01, { ...base, subsidy: false, surveyVisits: 1, downtimeDays: 1, verify: 'metered' }, 1)
    const sub = buildInstall(v01, { ...base, subsidy: true, surveyVisits: 1, downtimeDays: 1, verify: 'metered' }, 1)
    const c = (i: typeof plain) => i.steps.find((s) => s.stage === 'contract')!
    expect(c(sub).days - c(plain).days).toBe(14)
    expect(c(sub).extra).toMatch(/補助/)
    expect(sub.traits.find((t) => t.key === 'subsidy')?.value).toBe('有申請補助')
  })

  it('bill comparison takes 90 days, metering 30', () => {
    const bill = buildInstall(v01, { ...base, verify: 'bill' }, 1)
    const metered = buildInstall(v01, { ...base, verify: 'metered' }, 1)
    expect(bill.steps.find((s) => s.stage === 'compare')?.days).toBe(90)
    expect(metered.steps.find((s) => s.stage === 'compare')?.days).toBe(30)
  })

  it('night work with no downtime reads as 不停線', () => {
    const i = buildInstall(v01, { ...base, nightWork: true, downtimeDays: 0 }, 1)
    expect(i.traits.find((t) => t.key === 'work')?.value).toBe('不停線（夜間／假日）')
  })
})

describe('collection helpers', () => {
  const list = vendorInstalls(v01, EXTRA_INSTALLS.v01)

  it('collectionStats averages only reported savings', () => {
    const s = collectionStats(list)
    const reported = list.map((i) => i.savingPct).filter((p): p is number => p != null)
    expect(s.count).toBe(list.length)
    expect(s.avgSavingPct).toBe(Math.round(reported.reduce((a, b) => a + b, 0) / reported.length))
    expect(s.bestSavingPct).toBe(Math.max(...reported))
    expect(s.topEquips[0]).toBe('air_compressor')
    expect(collectionStats([])).toMatchObject({ count: 0, avgSavingPct: null, medianDays: null })
  })

  it('traitShare and stageDeltaDays compare against the collection', () => {
    const first = list[0]
    const region = first.traits.find((t) => t.key === 'region')!
    expect(traitShare(list, region)).toBe(1) // all v01 installs are in the south
    const total = list.reduce((s, i) => s + stageDeltaDays(list, i, 'compare'), 0)
    expect(Math.abs(total)).toBeLessThanOrEqual(list.length)
  })
})
