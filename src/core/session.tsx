import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { capability } from './runtime'
import { useDoc } from './store/StoreProvider'
import type { Company, Role } from './types'

const SESSION_KEY = 'greenmatch:v1:session'

function readSaved(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function writeSaved(id: string | null) {
  try {
    if (id) window.localStorage.setItem(SESSION_KEY, id)
    else window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Blocked storage: the session simply lasts for this page load.
  }
}

interface SessionValue {
  /** The company the viewer is acting as (demo persona), or null when signed out. */
  companyId: string | null
  setCompanyId: (id: string | null) => void
  /** Shared mode only: the claude.ai viewer id, stored as ownerId on companies they register. */
  viewerId: string | null
}

const SessionContext = createContext<SessionValue | null>(null)

/** Demo sign-in: the viewer picks any company to act as. Kept in this browser only. */
export function SessionProvider({ children, initialCompanyId }: { children: ReactNode; initialCompanyId?: string | null }) {
  const [companyId, setState] = useState<string | null>(() => (initialCompanyId !== undefined ? initialCompanyId : readSaved()))
  const [viewerId, setViewerId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    capability('user').then(async (user) => {
      const id = user ? await user.id() : null
      if (alive) setViewerId(id)
    })
    return () => {
      alive = false
    }
  }, [])

  const setCompanyId = useCallback((id: string | null) => {
    setState(id)
    writeSaved(id)
  }, [])

  const value = useMemo(() => ({ companyId, setCompanyId, viewerId }), [companyId, setCompanyId, viewerId])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export interface Session {
  companyId: string | null
  /** undefined while loading, null when signed out or the company no longer exists. */
  company: Company | null | undefined
  role: Role | null
  viewerId: string | null
  /** Act as this company (after registering, or from the persona switcher). */
  signInAs: (companyId: string) => void
  signOut: () => void
}

export function useSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('SessionProvider is missing')
  const company = useDoc('companies', ctx.companyId)
  return {
    companyId: company ? ctx.companyId : null,
    company: ctx.companyId ? company : null,
    role: company ? company.role : null,
    viewerId: ctx.viewerId,
    signInAs: (id) => ctx.setCompanyId(id),
    signOut: () => ctx.setCompanyId(null),
  }
}
