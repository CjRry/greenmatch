import { COLLECTIONS } from '../types'
import type { Col, Collections, DataStore, DeepPartial, StoreError } from '../types'
import { deepFreeze, deepMerge, makeId, toPlain } from './merge'

type Docs = { [C in Col]: Map<string, Collections[C]> }
export type SeedData = { [C in Col]?: readonly Collections[C][] }

const STORAGE_KEY = 'greenmatch:v1:data'

function emptyDocs(): Docs {
  return Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()])) as unknown as Docs
}

function storeError(code: StoreError['code'], message: string): StoreError {
  return { code, message }
}

/**
 * Browser-only store for local runs and signed-out viewers. Data lives in this browser's
 * localStorage (when available) and starts from the demo seed.
 */
export class LocalStore implements DataStore {
  readonly mode = 'local' as const
  private docs: Docs = emptyDocs()
  private listeners = new Map<Col, Set<(docs: readonly unknown[]) => void>>()
  private readonly seed: () => SeedData
  private readonly persist: boolean

  constructor(options: { seed: () => SeedData; persist?: boolean }) {
    this.seed = options.seed
    this.persist = options.persist ?? true
    if (!this.load()) this.applySeed()
    if (this.persist && typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && this.load()) COLLECTIONS.forEach((c) => this.emit(c))
      })
    }
  }

  subscribe<C extends Col>(col: C, next: (docs: readonly Collections[C][]) => void): () => void {
    const set = this.listeners.get(col) ?? new Set()
    this.listeners.set(col, set)
    const fn = next as (docs: readonly unknown[]) => void
    set.add(fn)
    let active = true
    queueMicrotask(() => {
      if (active) fn(this.snapshot(col))
    })
    return () => {
      active = false
      set.delete(fn)
    }
  }

  async get<C extends Col>(col: C, id: string): Promise<Collections[C] | null> {
    const doc = this.docs[col].get(id)
    return doc ? (toPlain(doc) as Collections[C]) : null
  }

  async set<C extends Col>(col: C, doc: Collections[C]): Promise<void> {
    if (!doc?.id) throw storeError('invalid', 'Document needs an id')
    ;(this.docs[col] as Map<string, Collections[C]>).set(doc.id, toPlain(doc))
    this.commit(col)
  }

  async update<C extends Col>(col: C, id: string, patch: DeepPartial<Collections[C]>): Promise<void> {
    const cur = this.docs[col].get(id)
    if (!cur) throw storeError('not_found', `${col}/${id} does not exist`)
    const merged = deepMerge(cur as unknown as Record<string, unknown>, toPlain(patch) as Record<string, unknown>)
    ;(this.docs[col] as Map<string, Collections[C]>).set(id, merged as unknown as Collections[C])
    this.commit(col)
  }

  async remove(col: Col, id: string): Promise<void> {
    this.docs[col].delete(id)
    this.commit(col)
  }

  newId(prefix: string): string {
    return makeId(prefix)
  }

  /** Discard local changes and start again from the demo seed. */
  async reset(): Promise<void> {
    this.applySeed()
    this.save()
    COLLECTIONS.forEach((c) => this.emit(c))
  }

  private snapshot<C extends Col>(col: C): readonly Collections[C][] {
    return deepFreeze(toPlain([...this.docs[col].values()])) as readonly Collections[C][]
  }

  private emit(col: Col): void {
    const set = this.listeners.get(col)
    if (!set?.size) return
    const snap = this.snapshot(col)
    queueMicrotask(() => set.forEach((fn) => fn(snap)))
  }

  private commit(col: Col): void {
    this.save()
    this.emit(col)
  }

  private applySeed(): void {
    this.docs = emptyDocs()
    const seed = this.seed()
    for (const col of COLLECTIONS) {
      for (const doc of seed[col] ?? []) (this.docs[col] as Map<string, unknown>).set(doc.id, toPlain(doc))
    }
  }

  private load(): boolean {
    if (!this.persist) return false
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const parsed = JSON.parse(raw) as Record<string, unknown[]>
      const docs = emptyDocs()
      for (const col of COLLECTIONS) {
        for (const d of parsed[col] ?? []) {
          const doc = d as { id?: string }
          if (doc?.id) (docs[col] as Map<string, unknown>).set(doc.id, doc)
        }
      }
      this.docs = docs
      return true
    } catch {
      return false
    }
  }

  private save(): void {
    if (!this.persist) return
    try {
      const out = Object.fromEntries(COLLECTIONS.map((c) => [c, [...this.docs[c].values()]]))
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(out))
    } catch {
      // Storage can be full or blocked (private window). The in-memory copy still works.
    }
  }
}
