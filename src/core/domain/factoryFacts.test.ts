import { describe, expect, it } from 'vitest'
import type { CarbonInventory, Factory } from '../types'
import { emptyInventory } from './carbon'
import {
  buildFactoryFactPatch,
  DEFAULT_ANNUAL_DAYS,
  DEFAULT_DAILY_HOURS,
  DEFAULT_ELECTRICITY_PRICE_NTD,
  ELECTRICITY_FACTOR,
  overallFactSource,
  resolveAnnualCarbonSummary,
  resolveFactoryFacts,
} from './factoryFacts'

function baseFactory(overrides: Partial<Factory['factory']> = {}): Factory {
  return {
    id: 'f_test',
    role: 'factory',
    name: '測試精密工業',
    city: '台中市',
    contactName: '林先生',
    intro: '金屬加工測試廠',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    factory: {
      industry: '金屬加工',
      products: '螺絲扣件',
      employees: 60,
      scale: 'M',
      mainCustomers: [],
      pressures: ['cost'],
      equipment: [],
      ...overrides,
    },
  }
}

describe('factoryFacts', () => {
  it('treats missing fields and missing dataSources as estimate with clear Traditional Chinese explanations', () => {
    const f = baseFactory({ monthlyKwh: 65000, contractKw: 240 })
    const resolved = resolveFactoryFacts(f)

    expect(resolved.avgElectricityPriceNtd.value).toBe(DEFAULT_ELECTRICITY_PRICE_NTD)
    expect(resolved.avgElectricityPriceNtd.source).toBe('estimate')
    expect(resolved.avgElectricityPriceNtd.note).toContain('4.2')

    expect(resolved.dailyHours.value).toBe(DEFAULT_DAILY_HOURS)
    expect(resolved.dailyHours.source).toBe('estimate')

    expect(resolved.annualDays.value).toBe(DEFAULT_ANNUAL_DAYS)
    expect(resolved.annualDays.source).toBe('estimate')

    // Existing fields without dataSources default to 'estimate'
    expect(resolved.monthlyKwh.value).toBe(65000)
    expect(resolved.monthlyKwh.source).toBe('estimate')
    expect(resolved.contractKw.value).toBe(240)
    expect(resolved.contractKw.source).toBe('estimate')

    expect(resolved.derived.annualKwh).toBe(65000 * 12)
    expect(resolved.derived.annualScope2T).toBeCloseTo((65000 * 12 * ELECTRICITY_FACTOR) / 1000, 4)
  })

  it('derives monthlyKwh from user-entered monthlyElectricBillNtd when monthlyKwh is absent', () => {
    const f = baseFactory({
      monthlyElectricBillNtd: 270000,
      avgElectricityPriceNtd: 3.8,
      dataSources: {
        monthlyElectricBillNtd: { source: 'user', updatedAt: '2026-11-13T10:00:00Z' },
        avgElectricityPriceNtd: { source: 'user', updatedAt: '2026-11-13T10:00:00Z' },
      },
    })
    const resolved = resolveFactoryFacts(f)
    expect(resolved.monthlyElectricBillNtd.value).toBe(270000)
    expect(resolved.monthlyElectricBillNtd.source).toBe('user')
    expect(resolved.avgElectricityPriceNtd.value).toBe(3.8)
    expect(resolved.avgElectricityPriceNtd.source).toBe('user')
    expect(resolved.monthlyKwh.value).toBe(Math.round(270000 / 3.8))
    expect(resolved.monthlyKwh.source).toBe('estimate')
    expect(resolved.monthlyKwh.note).toContain('每月電費')
  })

  it('falls back to latest carbon inventory filled months when factory monthlyKwh and bill are missing', () => {
    const f = baseFactory()
    const inv: CarbonInventory = emptyInventory('f_test', 2026, '2026-10-01T00:00:00.000Z')
    inv.months[0].kwh = 50000
    inv.months[1].kwh = 70000
    const resolved = resolveFactoryFacts(f, inv)
    expect(resolved.monthlyKwh.value).toBe(60000)
    expect(resolved.monthlyKwh.source).toBe('estimate')
    expect(resolved.monthlyKwh.note).toContain('2026 年碳盤查')
  })

  it('buildFactoryFactPatch marks updated fields as user and preserves other fields', () => {
    const initial = baseFactory({
      monthlyKwh: 65000,
      contractKw: 240,
      dataSources: {
        monthlyKwh: { source: 'estimate', note: '依註冊所選電費區間估算' },
        contractKw: { source: 'estimate', note: '依註冊所選電費區間估算' },
      },
    })

    const patch = buildFactoryFactPatch(
      initial,
      {
        avgElectricityPriceNtd: 3.8,
        contractKw: 180,
        dailyHours: 16,
        equipment: [{ type: 'air_compressor', quantity: 2, ratedKw: 37, dailyHours: 16 }],
      },
      '2026-11-13T12:00:00.000Z',
    )

    const updated: Factory = { ...initial, ...patch }
    const resolved = resolveFactoryFacts(updated)
    expect(resolved.avgElectricityPriceNtd.value).toBe(3.8)
    expect(resolved.avgElectricityPriceNtd.source).toBe('user')
    expect(resolved.contractKw.value).toBe(180)
    expect(resolved.contractKw.source).toBe('user')
    expect(resolved.dailyHours.value).toBe(16)
    expect(resolved.dailyHours.source).toBe('user')
    expect(resolved.equipment.source).toBe('user')
    expect(resolved.equipment.value[0].dailyHours).toBe(16)
    // Untouched field keeps its original estimate provenance
    expect(resolved.monthlyKwh.source).toBe('estimate')
  })

  it('updates derived monthlyKwh when monthlyElectricBillNtd is patched without monthlyKwh', () => {
    const initial = baseFactory({
      monthlyKwh: 65000,
      dataSources: { monthlyKwh: { source: 'estimate' } },
    })
    const patch = buildFactoryFactPatch(initial, { monthlyElectricBillNtd: 420000 }, '2026-11-13T12:00:00.000Z')
    expect(patch.factory.monthlyElectricBillNtd).toBe(420000)
    expect(patch.factory.dataSources?.monthlyElectricBillNtd?.source).toBe('user')
    expect(patch.factory.monthlyKwh).toBe(100000)
    expect(patch.factory.dataSources?.monthlyKwh?.source).toBe('estimate')
  })

  it('overallFactSource is user only when every source is user', () => {
    expect(overallFactSource(['user', 'user'])).toBe('user')
    expect(overallFactSource(['user', 'estimate'])).toBe('estimate')
    expect(overallFactSource([])).toBe('estimate')
  })

  it('derives avgElectricityPriceNtd as user when both user bill and user kWh exist and price is unset', () => {
    const f = baseFactory({
      monthlyKwh: 65000,
      monthlyElectricBillNtd: 270000,
      dataSources: {
        monthlyKwh: { source: 'user' },
        monthlyElectricBillNtd: { source: 'user' },
      },
    })
    const resolved = resolveFactoryFacts(f)
    expect(resolved.avgElectricityPriceNtd.value).toBe(4.15)
    expect(resolved.avgElectricityPriceNtd.source).toBe('user')
    expect(resolved.avgElectricityPriceNtd.note).toContain('NT$ 27 萬')
    expect(resolved.avgElectricityPriceNtd.note).toContain('65,000')
  })

  it('keeps derived avgElectricityPriceNtd as estimate if either bill or kWh is estimate', () => {
    const f = baseFactory({
      monthlyKwh: 65000,
      monthlyElectricBillNtd: 270000,
      dataSources: {
        monthlyKwh: { source: 'estimate' },
        monthlyElectricBillNtd: { source: 'user' },
      },
    })
    const resolved = resolveFactoryFacts(f)
    expect(resolved.avgElectricityPriceNtd.value).toBe(4.15)
    expect(resolved.avgElectricityPriceNtd.source).toBe('estimate')
  })

  it('resolveAnnualCarbonSummary falls back to monthlyKwh * 12 when 0 months are filled', () => {
    const f = baseFactory({
      monthlyKwh: 65000,
      dataSources: { monthlyKwh: { source: 'user' } },
    })
    const inv = emptyInventory('f_test', 2026, '2026-11-13T00:00:00.000Z')
    const facts = resolveFactoryFacts(f, inv)
    const annual = resolveAnnualCarbonSummary(inv, facts)
    expect(annual.filledMonths).toBe(0)
    expect(annual.isMonthlyAverageFallback).toBe(true)
    expect(annual.displayAnnualKwh).toBe(780000)
    expect(annual.displayTotalT).toBeCloseTo(369.72, 2)
    expect(annual.factSource).toBe('estimate')
  })
})
