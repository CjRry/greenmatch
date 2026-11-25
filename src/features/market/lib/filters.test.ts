import { describe, expect, it } from 'vitest'
import { seedData } from '../../../data/seed'
import type { Need, Review, Vendor } from '../../../core/types'
import { EMPTY_NEED_FILTER, EMPTY_VENDOR_FILTER, filterNeeds, filterVendors, groupByRegion, matchesVendor, openNeeds, sortByFit } from './filters'

const seed = seedData()
const needs = seed.needs as Need[]
const vendors = (seed.companies as unknown as { role: string }[]).filter((c) => c.role === 'vendor') as Vendor[]
const reviews = seed.reviews as Review[]
const names = new Map<string, string>()

describe('needs', () => {
  it('lists only open needs, newest first', () => {
    const open = openNeeds(needs)
    expect(open.length).toBeGreaterThan(0)
    expect(open.every((n) => n.status === 'open')).toBe(true)
    for (let i = 1; i < open.length; i++) expect(open[i - 1].createdAt >= open[i].createdAt).toBe(true)
  })

  it('filters by equipment, region, scale and keyword', () => {
    const open = openNeeds(needs)
    const air = filterNeeds(open, names, { ...EMPTY_NEED_FILTER, equips: ['air_compressor'] })
    expect(air.every((n) => n.form.items.some((i) => i.equip === 'air_compressor'))).toBe(true)
    expect(filterNeeds(open, names, { ...EMPTY_NEED_FILTER, region: '東部' }).every((n) => ['宜蘭縣', '花蓮縣', '台東縣'].includes(n.city))).toBe(true)
    expect(filterNeeds(open, names, { ...EMPTY_NEED_FILTER, scale: 'L' }).every((n) => n.scale === 'L')).toBe(true)
    expect(filterNeeds(open, names, { ...EMPTY_NEED_FILTER, q: '不存在的字串xyz' })).toEqual([])
  })

  it('sorts needs that fit the vendor first', () => {
    const open = openNeeds(needs)
    const v = vendors[0]
    const fits = sortByFit(open, v).map((n) => matchesVendor(n, v))
    expect(fits.indexOf(false) === -1 || fits.lastIndexOf(true) < fits.indexOf(false)).toBe(true)
  })
})

describe('vendors', () => {
  it('filters by specialty and by collaborated industry', () => {
    const list = filterVendors(vendors, reviews, { ...EMPTY_VENDOR_FILTER, specialty: 'carbon_consulting' })
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((v) => v.vendor.specialties.includes('carbon_consulting'))).toBe(true)

    const foodPeers = filterVendors(vendors, reviews, { ...EMPTY_VENDOR_FILTER, industry: '食品加工' })
    expect(foodPeers.map((v) => v.id)).toEqual(expect.arrayContaining(['v01', 'v02', 'v05', 'v08', 'v11']))
    expect(foodPeers.some((v) => v.id === 'v03')).toBe(false)
  })

  it('sorts by response speed and by cases', () => {
    const fast = filterVendors(vendors, reviews, { ...EMPTY_VENDOR_FILTER, sort: 'response' })
    expect(fast[0].vendor.responseHours).toBe(Math.min(...vendors.map((v) => v.vendor.responseHours)))
    const many = filterVendors(vendors, reviews, { ...EMPTY_VENDOR_FILTER, sort: 'cases' })
    expect(many[0].vendor.completedCases).toBe(Math.max(...vendors.map((v) => v.vendor.completedCases)))
  })

  it('groups cities by region', () => {
    expect(groupByRegion(['台南市', '台北市', '高雄市'])).toEqual([
      { region: '北部', cities: ['台北市'] },
      { region: '南部', cities: ['台南市', '高雄市'] },
    ])
  })
})
