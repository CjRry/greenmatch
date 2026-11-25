import { Check } from 'lucide-react'
import { ETA_NOTE, STAGE_BY_KEY } from '../../../core/constants/stages'
import { formatDate } from '../../../core/format'
import type { Case, CaseEvent } from '../../../core/types'
import { cx } from '../../../ui'
import { timelineSteps } from '../lib/views'

/** Parcel-style vertical timeline of the 8 stages. */
export function Timeline({ c, events, isUnselectedVendor = false }: { c: Case; events: readonly CaseEvent[]; isUnselectedVendor?: boolean }) {
  const steps = timelineSteps(c, events)
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col">
        {steps.map((s, i) => {
          const info = STAGE_BY_KEY[s.key]
          const last = i === steps.length - 1
          return (
            <li key={s.key} className="flex gap-3" aria-current={s.state === 'current' ? 'step' : undefined}>
              <div className="flex flex-col items-center">
                <span
                  className={cx(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                    s.state === 'done' && 'border-brand bg-brand text-on-brand',
                    s.state === 'current' && 'border-brand bg-brand-soft text-brand-strong ring-4 ring-brand-soft',
                    s.state === 'upcoming' && 'border-line-strong bg-surface text-muted',
                  )}
                >
                  {s.state === 'done' ? <Check className="size-4" aria-hidden /> : <span className="tabular font-mono">{s.n}</span>}
                </span>
                {!last ? <span className={cx('my-1 w-0.5 flex-1', s.state === 'done' ? 'bg-brand' : 'bg-line')} /> : null}
              </div>
              <div className={cx('min-w-0 flex-1 pb-5', last && 'pb-0')}>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className={cx('font-display font-bold', s.state === 'upcoming' ? 'text-muted' : 'text-ink')}>{info.label}</span>
                  <span className="text-sm text-muted">
                    {s.state === 'done' ? `已完成 ${formatDate(s.doneAt)}` : s.state === 'current' ? '進行中' : '尚未開始'}
                  </span>
                </div>
                <p className="text-sm text-ink-soft">{info.what}</p>
                <p className="text-sm text-muted">
                  負責：{info.ownerLabel}・預估 {info.eta}
                </p>
                {s.state !== 'done' ? (
                  isUnselectedVendor ? (
                    <p className="mt-0.5 text-sm text-muted">後續階段將由得標廠商與工廠共同執行。</p>
                  ) : (
                    <div className="mt-0.5 flex flex-col gap-0.5 text-sm text-muted">
                      <p>工廠需準備：{info.factoryPrep}</p>
                      <p>廠商負責：{info.vendorTodo}</p>
                    </div>
                  )
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
      <p className="text-sm text-muted">{ETA_NOTE}</p>
    </div>
  )
}
