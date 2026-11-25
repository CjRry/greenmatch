import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedData } from '../../data/seed'
import { buildFactoryFactPatch } from '../domain/factoryFacts'
import type { Company, Factory, Need } from '../types'
import { SUBSIDY_BY_ID, hpToKw, matchSubsidies, stageSubsidyReminders, taipeiToday } from './index'

const seed = seedData()
const companies = seed.companies as Company[]
const needs = seed.needs as Need[]
const factory = (id: string) => companies.find((c) => c.id === id) as Factory

describe('hpToKw', () => {
  it('converts standard industrial horsepower ratings', () => {
    expect(hpToKw(50)).toBe(37)
    expect(hpToKw(100)).toBe(75)
    expect(hpToKw(10)).toBe(7.5)
  })

  it('falls back to 0.746 multiplier for non-table values', () => {
    expect(hpToKw(12)).toBe(9)
    expect(hpToKw(0)).toBe(0)
  })
})

describe('matchSubsidies', () => {
  it('computes 12–43 萬 per 115/01/29 official rates for 3 × 37 kW air compressors (85 employees)', () => {
    const f01 = factory('f01')
    const n01 = needs.find((n) => n.id === 'n01')!
    const res = matchSubsidies({ factory: f01, need: { form: n01.form, budgetNtd: null } })
    const power = res.items.find((i) => i.def.id === 'power-equipment')!
    expect(power.status).toBe('likely')
    expect(power.amount).toEqual({ min: 120_000, max: 430_000 })
    // f01 has no contractKw yet -> espc is needs_info
    const espc = res.items.find((i) => i.def.id === 'espc')!
    expect(espc.status).toBe('needs_info')
    expect(espc.missingFields).toContain('契約容量（kW）')
    // Total matches power-equipment since budgetNtd is null; power now uses verified 115/01/29 official rates
    expect(res.totalRange).toEqual({ min: 120_000, max: 430_000 })
    expect(res.usesRelayedRates).toBe(false)
    expect(res.taxCreditRange).toBeNull()
  })

  it('uses official kW tier rates for large (>75 kW) compressors and marks >200 kW not_applicable', () => {
    const f01 = factory('f01')
    const largeRes = matchSubsidies({
      factory: f01,
      need: {
        form: {
          items: [{ equip: 'air_compressor', quantity: 1, ratedKw: 100, ageYears: null }],
          mainProblems: [],
          directions: [],
          openQuestions: [],
        },
        budgetNtd: null,
      },
    })
    const largePower = largeRes.items.find((i) => i.def.id === 'power-equipment')!
    expect(largePower.status).toBe('likely')
    // 100 kW (>75–200 tier): 700–3,000 × 1.2 (SME) = 84,000–360,000
    expect(largePower.amount).toEqual({ min: 84_000, max: 360_000 })

    const overRes = matchSubsidies({
      factory: f01,
      need: {
        form: {
          items: [{ equip: 'air_compressor', quantity: 1, ratedKw: 250, ageYears: null }],
          mainProblems: [],
          directions: [],
          openQuestions: [],
        },
        budgetNtd: null,
      },
    })
    expect(overRes.items.find((i) => i.def.id === 'power-equipment')!.status).toBe('not_applicable')
  })

  it('marks power-equipment as needs_info when kW is missing', () => {
    const f10 = factory('f10') // no ratedKw on equipment
    const n10 = needs.find((n) => n.id === 'n10')!
    const res = matchSubsidies({ factory: f10, need: n10 })
    const power = res.items.find((i) => i.def.id === 'power-equipment')!
    expect(power.status).toBe('needs_info')
    expect(power.missingFields).toContain('每台額定功率（kW 或馬力）')
  })

  it('avoids double-counting mutually exclusive grants and keeps tax-credit out of totalRange (A3)', () => {
    const f01 = factory('f01')
    const fWithContract: Factory = { ...f01, ...buildFactoryFactPatch(f01, { contractKw: 200 }, '2026-11-13T00:00:00Z') }
    const n01 = needs.find((n) => n.id === 'n01')!
    const res = matchSubsidies({
      factory: fWithContract,
      need: n01,
      totalQuoteNtd: 2_251_000,
      context: 'quote',
    })
    const power = res.items.find((i) => i.def.id === 'power-equipment')!
    const espc = res.items.find((i) => i.def.id === 'espc')!
    const tax = res.items.find((i) => i.def.id === 'tax-credit')!
    expect(power.status).toBe('likely')
    expect(espc.status).toBe('likely')
    expect(tax.status).toBe('likely')
    // power max is 670,000; espc on 2,251,000 * 0.2..0.4 = 450,000..900,000 -> higher max is espc
    // A3: tax credit = round(2,251,000 * 0.05) = 112,550 must NOT be added to totalRange
    expect(res.totalRange).toEqual({
      min: espc.amount!.min,
      max: espc.amount!.max,
    })
    expect(res.usesRelayedRates).toBe(false)
    expect(res.taxCreditRange).toEqual({ min: 112_550, max: 112_550 })
    expect(res.totalNote).toContain('不重複領取')
  })

  describe('「今天」的預設值（不傳 today）', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    const powerStatus = () => {
      const res = matchSubsidies({
        factory: factory('f01'),
        need: needs.find((n) => n.id === 'n01')!,
        totalQuoteNtd: 2_000_000,
      })
      return res.items.find((i) => i.def.id === 'power-equipment')!.status
    }

    it('不傳 today 時用系統時間：2027-02-01 動力設備補助已截止', () => {
      vi.useFakeTimers()
      vi.setSystemTime('2027-02-01')
      expect(powerStatus()).toBe('closed')
    })

    it('不傳 today 時用系統時間：2026-11-13 動力設備補助尚未截止', () => {
      vi.useFakeTimers()
      vi.setSystemTime('2026-11-13')
      expect(powerStatus()).not.toBe('closed')
    })

    it('以台灣時區換日：台灣 1/15 23:59 仍可申請，1/16 00:30（UTC 還在 1/15）已截止', () => {
      vi.useFakeTimers()
      vi.setSystemTime('2027-01-15T15:59:00Z')
      expect(taipeiToday()).toBe('2027-01-15')
      expect(powerStatus()).not.toBe('closed')

      vi.setSystemTime('2027-01-15T16:30:00Z')
      expect(taipeiToday()).toBe('2027-01-16')
      expect(powerStatus()).toBe('closed')
    })

    it('taipeiToday 接受明確時間，不受執行環境時區影響', () => {
      expect(taipeiToday('2026-12-31T16:00:00.000Z')).toBe('2027-01-01')
      expect(taipeiToday(new Date('2026-12-31T15:59:59.000Z'))).toBe('2026-12-31')
    })
  })

  it('marks subsidies closed when an explicit today is past their deadlines; tax-credit is relayed and espc has no deadline (A1/A4/A5)', () => {
    const f01 = factory('f01')
    const n01 = needs.find((n) => n.id === 'n01')!
    const res = matchSubsidies({ factory: f01, need: n01, totalQuoteNtd: 2_000_000 }, '2027-02-01')
    const power = res.items.find((i) => i.def.id === 'power-equipment')!
    expect(power.status).toBe('closed')
    expect(power.deadlineNote).toContain('已截止')

    const pastTax = matchSubsidies({ factory: f01, need: n01, totalQuoteNtd: 2_000_000 }, '2030-01-01')
    expect(pastTax.items.find((i) => i.def.id === 'tax-credit')!.status).toBe('closed')
    expect(SUBSIDY_BY_ID['tax-credit'].reliability).toBe('relayed')
    expect(SUBSIDY_BY_ID.espc.deadlineIso).toBeUndefined()
  })

  it('marks espc not_applicable when savePct < 10%', () => {
    const f01 = factory('f01')
    const fWithContract: Factory = { ...f01, ...buildFactoryFactPatch(f01, { contractKw: 200 }, '2026-11-13T00:00:00Z') }
    const n01 = needs.find((n) => n.id === 'n01')!
    const res = matchSubsidies({
      factory: fWithContract,
      need: n01,
      totalQuoteNtd: 2_000_000,
      quoteFields: {
        equipmentNtd: 1_800_000,
        installNtd: 200_000,
        warrantyYears: 2,
        monthlySaveKwh: 5000,
        monthlySaveNtd: 20000,
        savePct: 8,
        paybackMonths: 100,
        baseline: null,
      },
      context: 'quote',
    })
    expect(res.items.find((i) => i.def.id === 'espc')!.status).toBe('not_applicable')
  })

  it('shows carbon guidance subsidies for carbon_consulting need or carbon context', () => {
    const f01 = factory('f01')
    const res = matchSubsidies({ factory: f01, context: 'carbon' })
    expect(res.items.find((i) => i.def.id === 'low-carbon-guidance')!.status).toBe('likely')
    expect(res.items.find((i) => i.def.id === 'green-tools')!.status).toBe('likely')
    expect(res.items.find((i) => i.def.id === 'power-equipment')!.status).toBe('not_applicable')
  })

  it('returns stage-specific reminders for active cases', () => {
    const f01 = factory('f01')
    const n01 = needs.find((n) => n.id === 'n01')!
    const summary = matchSubsidies({ factory: f01, need: n01 })
    const reminders = stageSubsidyReminders('construction', summary)
    expect(reminders.some((r) => r.id === 'power-equipment' && r.body.includes('發票'))).toBe(true)
  })

  it('marks espc as needs_info when contractKw is an estimate or missing dataSources', () => {
    const f01 = factory('f01')
    const fEstimated: Factory = {
      ...f01,
      factory: {
        ...f01.factory,
        contractKw: 240,
        dataSources: { contractKw: { source: 'estimate', note: '依註冊所選電費區間估算' } },
      },
    }
    const n01 = needs.find((n) => n.id === 'n01')!
    const res = matchSubsidies({ factory: fEstimated, need: n01, totalQuoteNtd: 2_000_000 })
    const espc = res.items.find((i) => i.def.id === 'espc')!
    expect(espc.status).toBe('needs_info')
    expect(espc.reason).toContain('依估算的契約容量 240 kW')
    expect(espc.missingFields).toContain('契約容量（kW）')
    expect(res.factSource).toBe('estimate')
  })

  it('does not flag subsidyRate as relayed once power-equipment uses official 115/01/29 rates', () => {
    const f01 = factory('f01')
    const fUser: Factory = {
      ...f01,
      ...buildFactoryFactPatch(
        f01,
        { contractKw: 80, equipment: f01.factory.equipment },
        '2026-11-13T00:00:00Z',
      ),
    }
    const n01 = needs.find((n) => n.id === 'n01')!
    const res = matchSubsidies({ factory: fUser, need: n01, totalQuoteNtd: 2_000_000 })
    expect(res.usesRelayedRates).toBe(false)
    expect(SUBSIDY_BY_ID['power-equipment'].reliability).toBe('official')
    expect(res.provenance.find((p) => p.key === 'subsidyRate')).toBeUndefined()
    expect(res.factSource).toBe('user')
  })

  it('tailors assess stage reminders when rated power and contractKw >= 100 are already known', () => {
    const f01 = factory('f01')
    const fKnown: Factory = {
      ...f01,
      ...buildFactoryFactPatch(
        f01,
        {
          contractKw: 180,
          equipment: [{ type: 'air_compressor', quantity: 2, ratedKw: 37, dailyHours: 16 }],
        },
        '2026-11-13T10:00:00Z',
      ),
    }
    const n01 = needs.find((n) => n.id === 'n01')!
    const summary = matchSubsidies({ factory: fKnown, need: n01, totalQuoteNtd: 1_500_000 })
    const reminders = stageSubsidyReminders('assess', summary)
    const powerReminder = reminders.find((r) => r.id === 'power-equipment')
    const espcReminder = reminders.find((r) => r.id === 'espc')
    expect(powerReminder?.body).toContain('已估算動力設備補助')
    expect(powerReminder?.body).not.toContain('系統才能估算')
    expect(espcReminder?.body).toContain('180 kW')
    expect(espcReminder?.body).toContain('已符合門檻')
    expect(espcReminder?.body).not.toContain('若契約容量達')
  })
})
