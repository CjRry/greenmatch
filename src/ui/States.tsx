import type { ReactNode } from 'react'
import { cx } from './cx'

/** Says what will appear here and how to add the first item. */
export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center gap-2 rounded-md border border-dashed border-line-strong px-6 py-10 text-center', className)}>
      {icon ? <div className="text-muted">{icon}</div> : null}
      <p className="font-medium text-ink">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-sm bg-sunken', className)} />
}

/** Placeholder list while a collection loads. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="載入中">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}

/**
 * Wide tables and charts scroll inside this box so the page never scrolls sideways. `relative` makes it
 * the containing block for absolutely positioned children (e.g. `sr-only` text in a far-right column),
 * which would otherwise escape the scroll box and widen the page.
 */
export function ScrollX({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('relative w-full min-w-0 max-w-full overflow-x-auto', className)}>{children}</div>
}
