import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Col, Collections, DataStore, DeepPartial, StoreError, StoreMode } from '../types'
import { LocalStore } from './local'

type Entry = {
  docs: readonly unknown[] | undefined
  error: StoreError | null
  listeners: Set<() => void>
  started: boolean
}

/** One live subscription per collection for the whole app; components derive views in render. */
class CollectionCache {
  private entries = new Map<Col, Entry>()
  private readonly store: DataStore

  constructor(store: DataStore) {
    this.store = store
  }

  private entry(col: Col): Entry {
    let e = this.entries.get(col)
    if (!e) {
      e = { docs: undefined, error: null, listeners: new Set(), started: false }
      this.entries.set(col, e)
    }
    return e
  }

  subscribe(col: Col, cb: () => void): () => void {
    const e = this.entry(col)
    if (!e.started) {
      e.started = true
      this.store.subscribe(
        col,
        (docs) => {
          e.docs = docs
          e.listeners.forEach((l) => l())
        },
        (err) => {
          e.error = err
          if (e.docs === undefined) e.docs = []
          e.listeners.forEach((l) => l())
        },
      )
    }
    e.listeners.add(cb)
    return () => {
      e.listeners.delete(cb)
    }
  }

  docs(col: Col): readonly unknown[] | undefined {
    return this.entry(col).docs
  }

  error(col: Col): StoreError | null {
    return this.entry(col).error
  }
}

interface StoreContextValue {
  store: DataStore
  cache: CollectionCache
  mode: StoreMode
  readOnly: boolean
  /** LocalStore only: discard local changes and reload the demo seed. */
  resetDemo: (() => Promise<void>) | null
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({
  store: raw,
  initialReadOnly = false,
  children,
}: {
  store: DataStore
  initialReadOnly?: boolean
  children: ReactNode
}) {
  const [readOnly, setReadOnly] = useState(initialReadOnly)

  // Writes that come back read_only switch the whole session to read-only.
  const guard = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    try {
      return await p
    } catch (e) {
      if ((e as StoreError)?.code === 'read_only') setReadOnly(true)
      throw e
    }
  }, [])

  // The cache must survive readOnly changes, so it is keyed on the raw store only.
  const base = useMemo<Omit<StoreContextValue, 'readOnly'>>(() => {
    const store: DataStore = {
      mode: raw.mode,
      subscribe: (col, next, error) => raw.subscribe(col, next, error),
      get: (col, id) => raw.get(col, id),
      set: (col, doc) => guard(raw.set(col, doc)),
      update: <C extends Col>(col: C, id: string, patch: DeepPartial<Collections[C]>) => guard(raw.update(col, id, patch)),
      remove: (col, id) => guard(raw.remove(col, id)),
      newId: (prefix) => raw.newId(prefix),
    }
    return {
      store,
      cache: new CollectionCache(raw),
      mode: raw.mode,
      resetDemo: raw instanceof LocalStore ? () => raw.reset() : null,
    }
  }, [raw, guard])

  const ctx = useMemo(() => ({ ...base, readOnly }), [base, readOnly])
  return <StoreContext.Provider value={ctx}>{children}</StoreContext.Provider>
}

function useStoreContext(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('StoreProvider is missing')
  return ctx
}

/** The data API for writes and one-off reads. */
export function useStore(): DataStore {
  return useStoreContext().store
}

/** Backend facts for banners and gating write controls. */
export function useStoreInfo(): { mode: StoreMode; readOnly: boolean; resetDemo: (() => Promise<void>) | null } {
  const { mode, readOnly, resetDemo } = useStoreContext()
  return { mode, readOnly, resetDemo }
}

/**
 * Live documents of a collection. `undefined` while loading (show a skeleton), `[]` when empty
 * (show an empty state). Order is not guaranteed: sort in the component.
 */
export function useCollection<C extends Col>(col: C): readonly Collections[C][] | undefined {
  const { cache } = useStoreContext()
  const subscribe = useCallback((cb: () => void) => cache.subscribe(col, cb), [cache, col])
  const get = useCallback(() => cache.docs(col), [cache, col])
  return useSyncExternalStore(subscribe, get, get) as readonly Collections[C][] | undefined
}

/** One document: `undefined` while loading, `null` when it does not exist. */
export function useDoc<C extends Col>(col: C, id: string | null | undefined): Collections[C] | null | undefined {
  const docs = useCollection(col)
  return useMemo(() => {
    if (docs === undefined) return undefined
    if (!id) return null
    return docs.find((d) => d.id === id) ?? null
  }, [docs, id])
}

/** The subscription error for a collection, if the backend reported one. */
export function useCollectionError(col: Col): StoreError | null {
  const { cache } = useStoreContext()
  const subscribe = useCallback((cb: () => void) => cache.subscribe(col, cb), [cache, col])
  const get = useCallback(() => cache.error(col), [cache, col])
  return useSyncExternalStore(subscribe, get, get)
}
