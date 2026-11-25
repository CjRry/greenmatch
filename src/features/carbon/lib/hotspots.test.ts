import { describe, expect, it } from 'vitest'
import { computeHotspots } from './hotspots'

describe('computeHotspots', () => {
  it('allocates scope 2 by share, largest first', () => {
    const r = computeHotspots(47.4, [
      { equip: 'lighting', share: 0.2 },
      { equip: 'air_compressor', share: 0.8 },
    ])
    expect(r.map((h) => h.equip)).toEqual(['air_compressor', 'lighting'])
    expect(r[0].tons).toBeCloseTo(37.92, 5)
    expect(r[1].tons).toBeCloseTo(9.48, 5)
    expect(r[0].tons + r[1].tons).toBeCloseTo(47.4, 5)
  })
  it('normalises shares that do not sum to 1', () => {
    const r = computeHotspots(10, [
      { equip: 'hvac', share: 30 },
      { equip: 'chiller', share: 10 },
    ])
    expect(r[0].pct).toBeCloseTo(0.75)
    expect(r[0].tons + r[1].tons).toBeCloseTo(10)
  })
  it('returns nothing without usable shares', () => {
    expect(computeHotspots(10, undefined)).toEqual([])
    expect(computeHotspots(10, [{ equip: 'hvac', share: 0 }])).toEqual([])
  })
})
