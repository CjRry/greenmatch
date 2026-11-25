import { describe, expect, it } from 'vitest'
import { buildInitialCarbonFromQuick, buildQuickFactory, buildQuickVendor, validateQuickCompany } from './quickRegister'

describe('quickRegister', () => {
  it('validates required quick fields', () => {
    const errs = validateQuickCompany({
      role: 'factory',
      name: '',
      city: '',
      employees: 0,
      industry: '金屬加工',
      electricityTierKey: 'm',
      customMonthlyKwh: '',
      equips: [],
      specialties: [],
      assistsSubsidy: false,
    })
    expect(errs.name).toBeTruthy()
    expect(errs.city).toBeTruthy()
    expect(errs.employees).toBeTruthy()
    expect(errs.items).toBeTruthy()
  })

  it('builds a clean non-demo factory and initial carbon inventory', () => {
    const f = buildQuickFactory(
      {
        role: 'factory',
        name: '明光精密',
        city: '台中市',
        employees: 45,
        industry: '機械設備',
        electricityTierKey: 'm',
        customMonthlyKwh: '72000',
        equips: ['air_compressor', 'hvac'],
        specialties: [],
        assistsSubsidy: false,
      },
      { id: 'f_test', now: '2026-06-10T00:00:00Z', ownerId: 'u1' },
    )
    expect(f.isDemo).toBe(false)
    expect(f.factory.monthlyKwh).toBe(72000)
    expect(f.factory.dataSources?.monthlyKwh).toEqual({
      source: 'user',
      note: '註冊時自行輸入每月平均用電度數',
      updatedAt: '2026-06-10T00:00:00Z',
    })
    expect(f.factory.contractKw).toBeNull()
    expect(f.factory.dataSources?.equipment?.source).toBe('estimate')
    expect(f.factory.equipment).toHaveLength(2)

    const inv = buildInitialCarbonFromQuick(f.id, f.factory.monthlyKwh ?? null, ['air_compressor', 'hvac'], '2026-06-10T00:00:00Z', 2026)
    expect(inv).not.toBeNull()
    expect(inv!.months.every((m) => m.kwh === null)).toBe(true)
    expect(inv!.electricityShare).toEqual([])
    expect(inv!.electricityShareSource).toBe('estimate')
  })

  it('marks monthlyKwh and contractKw as estimate when created from an electricity tier', () => {
    const f = buildQuickFactory(
      {
        role: 'factory',
        name: '旭昇金屬',
        city: '台中市',
        employees: 60,
        industry: '金屬加工',
        electricityTierKey: 'm',
        customMonthlyKwh: '',
        equips: ['air_compressor'],
        specialties: [],
        assistsSubsidy: false,
      },
      { id: 'f_tier', now: '2026-11-13T00:00:00Z', ownerId: 'u1' },
    )
    expect(f.factory.monthlyKwh).toBe(65000)
    expect(f.factory.contractKw).toBe(240)
    expect(f.factory.dataSources?.monthlyKwh?.source).toBe('estimate')
    expect(f.factory.dataSources?.contractKw?.source).toBe('estimate')
  })

  it('builds a clean non-demo vendor', () => {
    const v = buildQuickVendor(
      {
        role: 'vendor',
        name: '節能好幫手',
        city: '桃園市',
        employees: 18,
        industry: '',
        electricityTierKey: 'm',
        customMonthlyKwh: '',
        equips: [],
        specialties: ['hvac', 'ems'],
        assistsSubsidy: true,
      },
      { id: 'v_test', now: '2026-06-10T00:00:00Z', ownerId: 'u1' },
    )
    expect(v.isDemo).toBe(false)
    expect(v.vendor.specialties).toEqual(['hvac', 'ems'])
    expect(v.vendor.assistsSubsidy).toBe(true)
  })

  it('leaves fields it never asked for empty and marks ticked equipment as estimates (OBS-0004 §2-2)', () => {
    const f = buildQuickFactory(
      {
        role: 'factory',
        name: '觀察者測試五金',
        city: '台南市',
        employees: 48,
        industry: '金屬加工',
        electricityTierKey: '',
        customMonthlyKwh: '52000',
        equips: ['air_compressor', 'lighting'],
        specialties: [],
        assistsSubsidy: false,
      },
      { id: 'f_q', now: '2026-11-14T00:00:00Z', ownerId: 'u1' },
    )
    expect(f.contactName).toBe('')
    expect(f.intro).toBe('')
    expect(f.factory.products).toBe('')
    expect(f.factory.equipment.every((e) => e.source === 'estimate')).toBe(true)
    expect(f.factory.dataSources?.equipment?.source).toBe('estimate')
  })
})
