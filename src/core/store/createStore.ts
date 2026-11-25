import { capability, hasClaudeRuntime, setCapabilityOverride, urlFlag } from '../runtime'
import type { DataStore } from '../types'
import { DbStore } from './db'
import { FakeDb } from './fakeDb'
import { LocalStore } from './local'
import { seedData } from '../../data/seed'

/**
 * Pick the backend once at startup.
 * - Local run (no window.claude): LocalStore at once, no waiting.
 * - claude.ai viewer: the shared db when granted within 5 s, otherwise LocalStore.
 * - ?local forces LocalStore; ?fakedb runs DbStore on an empty FakeDb; ?fakedb=seed loads the seed into it.
 */
export async function createStore(): Promise<DataStore> {
  if (urlFlag('local') !== null) return new LocalStore({ seed: seedData })
  const fake = urlFlag('fakedb')
  if (fake !== null) {
    const db = new FakeDb(fake === 'seed' ? seedData() : undefined) as unknown as DB
    setCapabilityOverride('db', db)
    return new DbStore(db, 'fakedb')
  }
  if (!hasClaudeRuntime()) return new LocalStore({ seed: seedData })
  const db = await capability('db')
  return db ? new DbStore(db, 'db') : new LocalStore({ seed: seedData })
}
