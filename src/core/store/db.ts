import type { Col, Collections, DataStore, DeepPartial, StoreError } from '../types'
import { makeId, toPlain } from './merge'

/** Map a claude.ai db rejection onto the app's StoreError. */
export function mapDbError(e: unknown, writing: boolean): StoreError {
  const code = (e as { code?: string })?.code
  const message = (e as { message?: string })?.message ?? '資料服務暫時無法使用'
  switch (code) {
    case 'invalid_argument':
    case 'transform_error':
      // A well-formed write that is rejected means this viewer cannot write shared data.
      return writing ? { code: 'read_only', message } : { code: 'invalid', message }
    case 'quota_exceeded':
      return { code: 'quota', message }
    default:
      return { code: 'unavailable', message }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Shared backend on the claude.ai `db` capability (or FakeDb in tests and ?fakedb). One collection per Col. */
export class DbStore implements DataStore {
  readonly mode: 'db' | 'fakedb'
  private readonly db: DB

  constructor(db: DB, mode: 'db' | 'fakedb' = 'db') {
    this.db = db
    this.mode = mode
  }

  subscribe<C extends Col>(
    col: C,
    next: (docs: readonly Collections[C][]) => void,
    error?: (e: StoreError) => void,
  ): () => void {
    return this.db.collection(col).onSnapshot(
      (snap) => next(snap.docs.filter((d) => d.exists).map((d) => ({ ...d.data(), id: d.id }) as unknown as Collections[C])),
      (e) => error?.(mapDbError(e, false)),
    )
  }

  async get<C extends Col>(col: C, id: string): Promise<Collections[C] | null> {
    const snap = await this.retry(() => this.db.doc(`${col}/${id}`).get(), false)
    return snap.exists ? ({ ...toPlain(snap.data()), id: snap.id } as unknown as Collections[C]) : null
  }

  async set<C extends Col>(col: C, doc: Collections[C]): Promise<void> {
    if (!doc?.id) throw { code: 'invalid', message: 'Document needs an id' } satisfies StoreError
    await this.retry(() => this.db.doc(`${col}/${doc.id}`).set(toPlain(doc) as unknown as Record<string, unknown>), true)
  }

  async update<C extends Col>(col: C, id: string, patch: DeepPartial<Collections[C]>): Promise<void> {
    const ref = this.db.doc(`${col}/${id}`)
    const snap = await this.retry(() => ref.get(), false)
    if (!snap.exists) throw { code: 'not_found', message: `${col}/${id} does not exist` } satisfies StoreError
    await this.retry(() => ref.update(toPlain(patch) as Record<string, unknown>), true)
  }

  async remove(col: Col, id: string): Promise<void> {
    await this.retry(() => this.db.doc(`${col}/${id}`).delete(), true)
  }

  newId(prefix: string): string {
    return makeId(prefix)
  }

  /** Retry a transient `unavailable` once after a short randomized delay, as the db contract asks. */
  private async retry<T>(fn: () => Promise<T>, writing: boolean): Promise<T> {
    try {
      return await fn()
    } catch (e) {
      if ((e as { code?: string })?.code !== 'unavailable') throw mapDbError(e, writing)
      await sleep(300 + Math.random() * 500)
      try {
        return await fn()
      } catch (e2) {
        throw mapDbError(e2, writing)
      }
    }
  }
}
