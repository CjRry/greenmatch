import { useState } from 'react'
import { RouterProvider, createHashRouter } from 'react-router'
import { SessionProvider } from '../core/session'
import { StoreProvider } from '../core/store/StoreProvider'
import type { DataStore } from '../core/types'
import { ToastProvider } from '../ui'
import { routes } from './routes'

/** Hash routing: the claude.ai viewer serves one page, so paths live after the #. */
export function App({ store, initialReadOnly }: { store: DataStore; initialReadOnly: boolean }) {
  const [router] = useState(() => createHashRouter(routes))
  return (
    <StoreProvider store={store} initialReadOnly={initialReadOnly}>
      <SessionProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SessionProvider>
    </StoreProvider>
  )
}

/** Shown for the moment before the data backend is chosen. */
export function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted" aria-busy="true">
      <span className="text-2xl font-black text-ink">
        綠媒 <span className="font-display text-lg font-bold text-brand-strong">GreenMatch</span>
      </span>
      <span className="text-sm">正在準備資料…</span>
    </div>
  )
}
