import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { cx } from './cx'

export type ToastTone = 'success' | 'info' | 'error'
interface ToastItem {
  id: number
  title: string
  body?: string
  tone: ToastTone
}

const ToastContext = createContext<((t: { title: string; body?: string; tone?: ToastTone }) => void) | null>(null)

/** Short confirmations after an action: 「已送出需求」. Errors say what happened and what to do. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((t: { title: string; body?: string; tone?: ToastTone }) => {
    const id = Date.now() + Math.random()
    setItems((cur) => [...cur.slice(-2), { id, tone: t.tone ?? 'success', title: t.title, body: t.body }])
    setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), t.tone === 'error' ? 7000 : 4000)
  }, [])
  const value = useMemo(() => push, [push])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cx(
              'pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-md border bg-surface px-4 py-3 text-sm shadow-card',
              t.tone === 'error' ? 'border-danger' : t.tone === 'info' ? 'border-navy' : 'border-brand',
            )}
          >
            {t.tone === 'error' ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            ) : t.tone === 'info' ? (
              <Info className="mt-0.5 size-4 shrink-0 text-navy" aria-hidden />
            ) : (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="font-medium text-ink">{t.title}</p>
              {t.body ? <p className="text-muted">{t.body}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('ToastProvider is missing')
  return ctx
}
