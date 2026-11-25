import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, useLocation, type RouteObject } from 'react-router'
import { SessionProvider } from '../core/session'
import { LocalStore, type SeedData } from '../core/store/local'
import { StoreProvider } from '../core/store/StoreProvider'
import type { DataStore } from '../core/types'
import { ToastProvider } from '../ui'
import { fixtureData } from './fixtures'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

export interface RenderOptions {
  /** Starting URL, e.g. '/cases/c01'. */
  url?: string
  /** Route pattern for the page, e.g. '/cases/:id', so useParams works. */
  path?: string
  /** Data to start from. Defaults to the full demo seed. Pass {} for an empty store. */
  data?: SeedData
  /** Act as this company (demo persona), or null for signed out. */
  companyId?: string | null
  /** Bring your own store (e.g. DbStore on a FakeDb). */
  store?: DataStore
}

function providers(store: DataStore, companyId: string | null, router: ReturnType<typeof createMemoryRouter>) {
  return (
    <StoreProvider store={store}>
      <SessionProvider initialCompanyId={companyId}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SessionProvider>
    </StoreProvider>
  )
}

/**
 * Render one page with all providers. Any navigation away lands on a probe:
 * `await screen.findByTestId('location')` shows where the page navigated.
 */
export function renderPage(page: ReactElement, options: RenderOptions = {}) {
  const store = options.store ?? new LocalStore({ seed: () => options.data ?? fixtureData(), persist: false })
  const router = createMemoryRouter(
    [
      { path: options.path ?? '/', element: page },
      { path: '*', element: <LocationProbe /> },
    ],
    { initialEntries: [options.url ?? options.path ?? '/'] },
  )
  const utils = render(providers(store, options.companyId ?? null, router))
  return { ...utils, store, router, screen }
}

/** Render the whole app (Shell + every route) at a URL. For QA flow tests. */
export function renderApp(routes: RouteObject[], options: Omit<RenderOptions, 'path'> = {}) {
  const store = options.store ?? new LocalStore({ seed: () => options.data ?? fixtureData(), persist: false })
  const router = createMemoryRouter(routes, { initialEntries: [options.url ?? '/'] })
  const utils = render(providers(store, options.companyId ?? null, router))
  return { ...utils, store, router, screen }
}
