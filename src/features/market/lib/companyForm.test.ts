import { describe, expect, it } from 'vitest'
import { seedData } from '../../../data/seed'
import type { Company } from '../../../core/types'
import { buildCompany, draftFromCompany, emptyDraft, parseRole, validateAll, validateBasic, validateRole } from './companyForm'

const companies = seedData().companies as Company[]

const basic = { name: '新創鋼鐵', city: '台中市' as const, contactName: '王小明', intro: '做鋼管的工廠。' }

describe('validation', () => {
  it('asks for every required basic field in Chinese', () => {
    const e = validateBasic(emptyDraft())
    expect(Object.keys(e).sort()).toEqual(['city', 'contactName', 'intro', 'name'])
    expect(e.name).toMatch(/公司名稱/)
  })

  it('checks email and tax id formats only when filled', () => {
    expect(validateBasic({ ...emptyDraft(), ...basic })).toEqual({})
    expect(validateBasic({ ...emptyDraft(), ...basic, email: 'abc', taxId: '123' })).toMatchObject({ email: expect.any(String), taxId: expect.any(String) })
  })

  it('requires factory fields and flags the broken equipment row', () => {
    const d = { ...emptyDraft(), equipment: [{ type: '' as const, quantity: '3', year: '' }] }
    const e = validateRole(d, 'factory')
    expect(e.industry).toBeTruthy()
    // Quick register doesn't ask for products, contact or intro, so factories may leave them empty (OBS-0004 §2-2).
    expect(e.products).toBeUndefined()
    expect(validateBasic({ ...emptyDraft(), name: 'x', city: '台中市' }, 'factory')).toEqual({})
    expect(e.employees).toBeTruthy()
    expect(e.pressures).toBeTruthy()
    expect(e['equipment.0.type']).toBeTruthy()
  })

  it('requires vendor fields', () => {
    const e = validateRole(emptyDraft(), 'vendor')
    expect(Object.keys(e).sort()).toEqual(['employees', 'foundedYear', 'serviceCities', 'sizeFit', 'specialties', 'tagline'])
  })

  it('ignores blank optional rows', () => {
    const d = { ...emptyDraft(), portfolio: [{ title: '', city: '' as const, equip: '' as const, savingPct: '', year: '' }] }
    expect(Object.keys(validateRole(d, 'vendor'))).not.toContain('portfolio.0.title')
  })
})

describe('buildCompany', () => {
  it('builds a Factory with scale from employees', () => {
    const d = { ...emptyDraft(), ...basic, employees: '120', industry: '金屬加工', products: '螺絲', pressures: ['cost' as const], monthlyKwh: '5000', equipment: [{ type: 'hvac' as const, quantity: '4', year: '2015' }] }
    expect(validateAll(d, 'factory')).toEqual({})
    const c = buildCompany(d, 'factory', { id: 'f_x', now: '2026-10-26T00:00:00.000Z', ownerId: 'u1' })
    expect(c.role).toBe('factory')
    if (c.role !== 'factory') return
    expect(c.factory.scale).toBe('M')
    expect(c.factory.equipment).toEqual([{ type: 'hvac', quantity: 4, yearInstalled: 2015, source: 'user' }])
    expect(c.isDemo).toBe(false)
    expect(c.ownerId).toBe('u1')
  })

  it('editing one equipment row does not upgrade an untouched template row to user (OBS-0004 §2-2)', () => {
    const d0 = { ...emptyDraft(), ...basic, employees: '48', industry: '金屬加工', products: '螺絲', pressures: ['cost' as const] }
    const first = buildCompany(d0, 'factory', { id: 'f_t', now: '2026-11-14T00:00:00.000Z', ownerId: 'u1' })
    if (first.role !== 'factory') throw new Error('factory expected')
    // As left by an older quick register: a template 「照明 1 台」 marked as an estimate.
    const existing = {
      ...first,
      factory: {
        ...first.factory,
        equipment: [{ type: 'lighting' as const, quantity: 1 }],
        dataSources: { equipment: { source: 'estimate' as const, note: '快速建立預設', updatedAt: '2026-11-14T00:00:00.000Z' } },
      },
    }
    const draft = draftFromCompany(existing)
    draft.equipment = [...draft.equipment, { type: 'air_compressor', quantity: '2', year: '2012', kw: '22' }]
    const saved = buildCompany(draft, 'factory', { id: 'f_t', now: '2026-11-14T01:00:00.000Z', existing })
    if (saved.role !== 'factory') throw new Error('factory expected')
    expect(saved.factory.equipment.find((e) => e.type === 'lighting')?.source).toBe('estimate')
    expect(saved.factory.equipment.find((e) => e.type === 'air_compressor')?.source).toBe('user')
    expect(saved.factory.dataSources?.equipment?.source).toBe('estimate')

    // Confirming the list makes every row the factory's own.
    const confirmed = buildCompany(draftFromCompany(saved), 'factory', {
      id: 'f_t',
      now: '2026-11-14T02:00:00.000Z',
      existing: saved,
      confirmedFactKeys: ['equipment'],
    })
    if (confirmed.role !== 'factory') throw new Error('factory expected')
    expect(confirmed.factory.equipment.every((e) => e.source === 'user')).toBe(true)
    expect(confirmed.factory.dataSources?.equipment?.source).toBe('user')
  })

  it('builds a Vendor', () => {
    const d = {
      ...emptyDraft(),
      ...basic,
      employees: '12',
      tagline: '空壓機節能專家',
      specialties: ['air_compressor' as const],
      serviceCities: ['台中市' as const],
      foundedYear: '2010',
      sizeFit: ['S' as const, 'M' as const],
      certifications: ['ISO 50001'],
    }
    expect(validateAll(d, 'vendor')).toEqual({})
    const c = buildCompany(d, 'vendor', { id: 'v_x', now: '2026-10-26T00:00:00.000Z', ownerId: null })
    expect(c.role).toBe('vendor')
    if (c.role !== 'vendor') return
    expect(c.vendor.completedCases).toBe(0)
    expect(c.vendor.specialties).toEqual(['air_compressor'])
  })

  it('round-trips an existing company and keeps its identity fields', () => {
    for (const company of companies.slice(0, 3).concat(companies.filter((c) => c.role === 'vendor').slice(0, 2))) {
      const d = draftFromCompany(company)
      expect(validateAll(d, company.role)).toEqual({})
      const back = buildCompany(d, company.role, { id: company.id, now: '2026-10-26T00:00:00.000Z', existing: company })
      expect(back.id).toBe(company.id)
      expect(back.createdAt).toBe(company.createdAt)
      expect(back.isDemo).toBe(company.isDemo)
      expect(back.name).toBe(company.name)
    }
  })

  it('preserves optional subsidy fields when provided and omits when empty', () => {
    const fd = {
      ...emptyDraft(),
      ...basic,
      employees: '85',
      industry: '金屬',
      products: '零件',
      pressures: ['cost' as const],
      monthlyKwh: '42000',
      contractKw: '180',
      revenueOver100M: 'no' as const,
      hasFactoryReg: 'yes' as const,
      equipment: [{ type: 'air_compressor' as const, quantity: '3', year: '2014', kw: '37' }],
    }
    expect(validateAll(fd, 'factory')).toEqual({})
    const f = buildCompany(fd, 'factory', { id: 'f_sub', now: '2026-10-26T00:00:00.000Z' })
    expect(f.role).toBe('factory')
    if (f.role === 'factory') {
      expect(f.factory.contractKw).toBe(180)
      expect(f.factory.revenueOver100M).toBe(false)
      expect(f.factory.hasFactoryReg).toBe(true)
      expect(f.factory.equipment[0].ratedKw).toBe(37)
      expect(draftFromCompany(f).contractKw).toBe('180')
      expect(draftFromCompany(f).equipment[0].kw).toBe('37')
    }

    const vd = {
      ...emptyDraft(),
      ...basic,
      employees: '12',
      tagline: '空壓機節能專家',
      specialties: ['air_compressor' as const],
      serviceCities: ['台中市' as const],
      foundedYear: '2010',
      sizeFit: ['S' as const, 'M' as const],
      assistsSubsidy: true,
    }
    expect(validateAll(vd, 'vendor')).toEqual({})
    const v = buildCompany(vd, 'vendor', { id: 'v_sub', now: '2026-10-26T00:00:00.000Z' })
    expect(v.role).toBe('vendor')
    if (v.role === 'vendor') {
      expect(v.vendor.assistsSubsidy).toBe(true)
      expect(draftFromCompany(v).assistsSubsidy).toBe(true)
    }
  })

  it('tracks factory numeric fields, equipment dailyHours, and dataSources accurately', () => {
    const fd = {
      ...emptyDraft(),
      ...basic,
      employees: '90',
      industry: '金屬加工',
      products: '扣件',
      pressures: ['cost' as const],
      monthlyKwh: '60000',
      monthlyElectricBillNtd: '252000',
      avgElectricityPriceNtd: '4.2',
      contractKw: '200',
      dailyHours: '18',
      annualDays: '310',
      equipment: [{ type: 'air_compressor' as const, quantity: '2', year: '2016', kw: '45', dailyHours: '18' }],
    }
    expect(validateAll(fd, 'factory')).toEqual({})
    const created = buildCompany(fd, 'factory', { id: 'f_facts', now: '2026-10-26T00:00:00.000Z' })
    expect(created.role).toBe('factory')
    if (created.role !== 'factory') return

    expect(created.factory.monthlyElectricBillNtd).toBe(252000)
    expect(created.factory.avgElectricityPriceNtd).toBe(4.2)
    expect(created.factory.dailyHours).toBe(18)
    expect(created.factory.annualDays).toBe(310)
    expect(created.factory.equipment[0].dailyHours).toBe(18)
    expect(created.factory.dataSources?.monthlyKwh?.source).toBe('user')
    expect(created.factory.dataSources?.contractKw?.source).toBe('user')
    expect(created.factory.dataSources?.dailyHours?.source).toBe('user')

    const roundTrip = draftFromCompany(created)
    expect(roundTrip.monthlyElectricBillNtd).toBe('252000')
    expect(roundTrip.avgElectricityPriceNtd).toBe('4.2')
    expect(roundTrip.dailyHours).toBe('18')
    expect(roundTrip.annualDays).toBe('310')
    expect(roundTrip.equipment[0].dailyHours).toBe('18')

    // Pre-existing estimate stays estimate if untouched, while edited field becomes user
    const withEstimates = {
      ...created,
      factory: {
        ...created.factory,
        contractKw: 240,
        dataSources: {
          ...created.factory.dataSources,
          contractKw: { source: 'estimate' as const, note: '依註冊電費區間估算' },
        },
      },
    }
    const editedDraft = { ...draftFromCompany(withEstimates), avgElectricityPriceNtd: '4.5' }
    const saved = buildCompany(editedDraft, 'factory', {
      id: withEstimates.id,
      now: '2026-10-27T00:00:00.000Z',
      existing: withEstimates,
    })
    if (saved.role === 'factory') {
      expect(saved.factory.dataSources?.contractKw?.source).toBe('estimate')
      expect(saved.factory.dataSources?.avgElectricityPriceNtd?.source).toBe('user')
    }
  })
})

describe('parseRole', () => {
  it('accepts only the two roles', () => {
    expect(parseRole('factory')).toBe('factory')
    expect(parseRole('x')).toBeNull()
    expect(parseRole(null)).toBeNull()
  })
})
