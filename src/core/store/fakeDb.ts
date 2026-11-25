import { deepFreeze, deepMerge, isPlainObject, makeId, toPlain } from './merge'

/**
 * In-memory stand-in for the claude.ai `db` capability (the subset DbStore uses), so the shared
 * backend can be exercised locally (?fakedb) and in tests. Mirrors its rules: async snapshots,
 * frozen documents, `update` rejects `invalid_argument` on a missing document.
 */
type Body = Record<string, unknown>
type Listener = { col: string; next: (snap: unknown) => void }

function dbError(code: string, message: string) {
  return { code, message }
}

function docSnap(id: string, body: Body | undefined) {
  const frozen = body ? deepFreeze(toPlain(body)) : undefined
  return {
    id,
    exists: !!body,
    data: () => frozen,
    metadata: { fromCache: false, hasPendingWrites: false },
  }
}

export class FakeDb {
  private data = new Map<string, Map<string, Body>>()
  private listeners = new Set<Listener>()
  /** When true, every write rejects like a viewer without write access. */
  readOnly = false

  constructor(seed?: Record<string, readonly { id: string }[]>) {
    if (seed) {
      for (const [col, docs] of Object.entries(seed)) {
        for (const d of docs) this.colMap(col).set(d.id, toPlain(d) as unknown as Body)
      }
    }
  }

  collection(path: string) {
    if (path.split('/').length % 2 !== 1) throw new TypeError(`Collection path needs an odd number of segments: ${path}`)
    const self = this
    const ref = {
      path,
      doc: (id?: string) => self.doc(`${path}/${id ?? makeId('doc')}`),
      add: async (data: Body) => {
        const d = self.doc(`${path}/${makeId('doc')}`)
        await d.set(data)
        return d
      },
      where: () => ref,
      orderBy: () => ref,
      limit: () => ref,
      get: async () => self.querySnap(path),
      onSnapshot: (next: (snap: unknown) => void, _error?: (e: unknown) => void) => {
        const l: Listener = { col: path, next }
        self.listeners.add(l)
        let active = true
        setTimeout(() => active && next(self.querySnap(path)), 0)
        return () => {
          active = false
          self.listeners.delete(l)
        }
      },
    }
    return ref
  }

  doc(path: string) {
    const parts = path.split('/')
    if (parts.length % 2 !== 0) throw new TypeError(`Document path needs an even number of segments: ${path}`)
    const id = parts[parts.length - 1]
    const col = parts.slice(0, -1).join('/')
    const self = this
    return {
      id,
      path,
      get: async () => docSnap(id, self.colMap(col).get(id)),
      set: async (data: Body) => {
        self.guardWrite(data)
        self.colMap(col).set(id, toPlain(data))
        self.notify(col)
      },
      update: async (data: Body) => {
        self.guardWrite(data)
        const cur = self.colMap(col).get(id)
        if (!cur) throw dbError('invalid_argument', `update: ${path} does not exist`)
        self.colMap(col).set(id, deepMerge(cur, toPlain(data)))
        self.notify(col)
      },
      delete: async () => {
        if (self.readOnly) throw dbError('invalid_argument', 'write not allowed')
        self.colMap(col).delete(id)
        self.notify(col)
      },
      acquire: async () => ({ acquired: true }),
      onSnapshot: (next: (snap: unknown) => void) => {
        const l: Listener = { col, next: () => next(docSnap(id, self.colMap(col).get(id))) }
        self.listeners.add(l)
        setTimeout(() => l.next(null), 0)
        return () => self.listeners.delete(l)
      },
      collection: (sub: string) => self.collection(`${path}/${sub}`),
    }
  }

  private guardWrite(data: Body) {
    if (this.readOnly) throw dbError('invalid_argument', 'write not allowed')
    if (!isPlainObject(data)) throw dbError('invalid_argument', 'body must be an object')
    if (JSON.stringify(data).length > 256 * 1024) throw dbError('invalid_argument', 'document over 256 KiB')
  }

  private colMap(col: string): Map<string, Body> {
    let m = this.data.get(col)
    if (!m) {
      m = new Map()
      this.data.set(col, m)
    }
    return m
  }

  private querySnap(col: string) {
    const docs = [...this.colMap(col).entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, b]) => docSnap(id, b))
    return {
      docs,
      size: docs.length,
      empty: docs.length === 0,
      docChanges: () => docs.map((doc, i) => ({ type: 'added', doc, oldIndex: -1, newIndex: i })),
      metadata: { fromCache: false, hasPendingWrites: false },
    }
  }

  private notify(col: string) {
    const snap = this.querySnap(col)
    for (const l of this.listeners) {
      if (l.col === col) setTimeout(() => l.next(snap), 0)
    }
  }
}
