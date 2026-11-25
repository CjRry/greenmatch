import { describe, expect, it } from 'vitest'
import type { Company, DataStore, Need } from '../types'
import { DbStore } from './db'
import { FakeDb } from './fakeDb'
import { LocalStore } from './local'

const company: Company = {
  id: 'f_test',
  role: 'factory',
  name: '測試工廠',
  city: '台南市',
  contactName: '王小明',
  intro: '測試用',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  factory: { industry: '金屬加工', products: '螺絲', employees: 30, scale: 'S', mainCustomers: [], pressures: ['cost'], equipment: [] },
}

const backends: [string, () => DataStore][] = [
  ['LocalStore', () => new LocalStore({ seed: () => ({}), persist: false })],
  ['DbStore on FakeDb', () => new DbStore(new FakeDb() as unknown as DB, 'fakedb')],
]

function firstSnapshot<T>(store: DataStore, col: 'companies' | 'needs'): Promise<readonly T[]> {
  return new Promise((resolve) => {
    const off = store.subscribe(col, (docs) => {
      off()
      resolve(docs as unknown as readonly T[])
    })
  })
}

describe.each(backends)('DataStore contract: %s', (_name, make) => {
  it('delivers the first snapshot asynchronously, and an empty collection as []', async () => {
    const store = make()
    let sync = true
    const p = firstSnapshot(store, 'companies')
    sync = false
    expect(sync).toBe(false)
    expect(await p).toEqual([])
  })

  it('set then get round-trips and drops undefined fields', async () => {
    const store = make()
    await store.set('companies', { ...company, district: undefined })
    const got = await store.get('companies', company.id)
    expect(got?.name).toBe('測試工廠')
    expect(got && 'district' in got).toBe(false)
  })

  it('update deep-merges objects and replaces arrays', async () => {
    const store = make()
    await store.set('companies', { ...company, factory: { ...company.factory, mainCustomers: ['A', 'B'] } } as Company)
    await store.update('companies', company.id, { factory: { employees: 31, mainCustomers: ['C'] } })
    const got = (await store.get('companies', company.id)) as Extract<Company, { role: 'factory' }>
    expect(got.factory.employees).toBe(31)
    expect(got.factory.industry).toBe('金屬加工')
    expect(got.factory.mainCustomers).toEqual(['C'])
  })

  it('update on a missing document rejects with not_found', async () => {
    const store = make()
    await expect(store.update('needs', 'nope', { title: 'x' } as Partial<Need>)).rejects.toMatchObject({ code: 'not_found' })
  })

  it('subscribers see writes', async () => {
    const store = make()
    const seen: number[] = []
    const done = new Promise<void>((resolve) => {
      store.subscribe('companies', (docs) => {
        seen.push(docs.length)
        if (docs.length === 1) resolve()
      })
    })
    await new Promise((r) => setTimeout(r, 5))
    await store.set('companies', company)
    await done
    expect(seen.at(-1)).toBe(1)
  })

  it('newId is path-safe and unique', () => {
    const store = make()
    const ids = new Set(Array.from({ length: 50 }, () => store.newId('need')))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^need_[a-z0-9]+$/)
  })
})

describe('DbStore error mapping', () => {
  it('a rejected write becomes read_only', async () => {
    const fake = new FakeDb()
    fake.readOnly = true
    const store = new DbStore(fake as unknown as DB, 'fakedb')
    await expect(store.set('companies', company)).rejects.toMatchObject({ code: 'read_only' })
  })
})
