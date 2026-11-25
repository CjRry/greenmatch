import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

/** A bordered surface. Use for objects the viewer can act on, not for every block of text. */
export function Card({
  padded = true,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean; children: ReactNode }) {
  return (
    <div className={cx('min-w-0 max-w-full rounded-md border border-line bg-surface', padded && 'p-4 sm:p-5', className)} {...rest}>
      {children}
    </div>
  )
}

/** Section heading inside a page: title on the left, optional action on the right. */
export function SectionTitle({ title, hint, action, className }: { title: ReactNode; hint?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-x-4 gap-y-1', className)}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      </div>
      {action}
    </div>
  )
}
