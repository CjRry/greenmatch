import type { ReactNode } from 'react'
import { cx } from './cx'

export type BadgeTone = 'neutral' | 'brand' | 'navy' | 'warn' | 'danger' | 'outline'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-ink-soft',
  brand: 'bg-brand-soft text-brand-strong',
  navy: 'bg-navy-soft text-navy',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  outline: 'border border-line-strong text-ink-soft',
}

export function Badge({ tone = 'neutral', icon, className, children }: { tone?: BadgeTone; icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

/** Marks fictional demonstration records. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="outline" className={className}>
      示範
    </Badge>
  )
}
