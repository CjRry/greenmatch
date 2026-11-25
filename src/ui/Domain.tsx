/** Small widgets that know the GreenMatch domain: companies, stages, ratings, scores, AI source. */
import { Check, Sparkles, Star, Wand2, PencilLine } from 'lucide-react'
import { STAGES, STAGE_BY_KEY, stageIndex } from '../core/constants/stages'
import { SPECIALTY_LABEL } from '../core/constants/equipment'
import { formatNumber } from '../core/format'
import type { Source, Specialty, StageKey } from '../core/types'
import { Badge } from './Badge'
import { cx } from './cx'

const AVATAR_TONES = ['bg-navy text-on-navy', 'bg-brand text-on-brand', 'bg-navy-soft text-navy', 'bg-brand-soft text-brand-strong'] as const

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** The two characters a company is shown by: its name without 股份有限公司 and similar suffixes. */
export function companyMonogram(name: string): string {
  return name.replace(/(股份)?有限公司|企業社|工業|實業/g, '').slice(0, 2)
}

/** A company's color family, stable per id: the same one its avatar uses. */
export function companyToneFamily(id: string): 'navy' | 'brand' {
  return hash(id) % 2 === 0 ? 'navy' : 'brand'
}

/** Square monogram from the first two characters of the company name. */
export function CompanyAvatar({ name, id, size = 'md' }: { name: string; id: string; size?: 'sm' | 'md' | 'lg' }) {
  const tone = AVATAR_TONES[hash(id) % AVATAR_TONES.length]
  const dims = size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-14 text-lg' : 'size-11 text-sm'
  return (
    <span aria-hidden className={cx('inline-flex shrink-0 items-center justify-center rounded-sm font-bold', tone, dims)}>
      {companyMonogram(name)}
    </span>
  )
}

/** 「4/8 方案與報價」 */
export function StageBadge({ stage, completed }: { stage: StageKey; completed?: boolean }) {
  const s = STAGE_BY_KEY[stage]
  if (completed) return <Badge tone="brand" icon={<Check className="size-3" aria-hidden />}>已完成</Badge>
  return (
    <Badge tone={s.n >= 6 ? 'brand' : 'navy'}>
      <span className="tabular font-mono">{s.n}/8</span> {s.label}
    </Badge>
  )
}

/**
 * The compact 8-step tracker from the deck: done steps checked, the current one ringed,
 * upcoming ones numbered on a dotted line.
 */
export function StageProgress({ stage, completed, showLabels = false }: { stage: StageKey; completed?: boolean; showLabels?: boolean }) {
  const cur = completed ? STAGES.length : stageIndex(stage)
  return (
    <ol className="flex w-full items-start" aria-label={`案件進度：第 ${Math.min(cur + 1, 8)} 階段，共 8 階段`}>
      {STAGES.map((s, i) => {
        const done = i < cur
        const now = i === cur
        return (
          <li key={s.key} className="flex min-w-0 flex-1 flex-col items-center gap-1 last:flex-none">
            <div className="flex w-full items-center">
              <span
                className={cx(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  done && 'bg-brand text-on-brand',
                  now && 'border-2 border-brand bg-surface text-brand',
                  !done && !now && 'border border-line-strong bg-surface text-muted',
                )}
                aria-current={now ? 'step' : undefined}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : now ? <span className="size-2.5 rounded-full bg-brand" /> : s.n}
              </span>
              {i < STAGES.length - 1 ? (
                <span className={cx('mx-0.5 h-0.5 flex-1', i < cur ? 'bg-brand' : 'border-t-2 border-dotted border-line-strong')} />
              ) : null}
            </div>
            {showLabels ? (
              <span className={cx('w-full truncate pr-2 text-[11px]', now ? 'font-bold text-ink' : 'text-muted')}>{s.label}</span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export function SpecialtyChips({ items, max, className }: { items: readonly Specialty[]; max?: number; className?: string }) {
  const shown = max ? items.slice(0, max) : items
  return (
    <div className={cx('flex flex-wrap gap-1.5', className)}>
      {shown.map((s) => (
        <Badge key={s} tone={s === 'carbon_consulting' ? 'navy' : 'brand'}>
          {SPECIALTY_LABEL[s]}
        </Badge>
      ))}
      {max && items.length > max ? <Badge tone="neutral">+{items.length - max}</Badge> : null}
    </div>
  )
}

/** 「★ 4.7（12 則）」 or 「尚無評價」. */
export function RatingStars({
  avg,
  count,
  showCount = true,
  className,
}: {
  avg: number | null
  count: number
  showCount?: boolean
  className?: string
}) {
  if (!count || avg == null) return <span className={cx('text-sm text-muted', className)}>尚無評價</span>
  return (
    <span className={cx('inline-flex items-center gap-1 text-sm', className)}>
      <Star className="size-4 fill-current text-chart-3" aria-hidden />
      <span className="tabular font-mono font-medium text-ink">{formatNumber(avg, 1)}</span>
      {showCount ? <span className="text-muted">（{count} 則）</span> : null}
    </span>
  )
}

/** A 0–1 score as a labeled bar, e.g. one matching factor. */
export function ScoreBar({ label, value, detail }: { label: string; value: number; detail?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="tabular font-mono text-xs text-muted">{detail ?? `${pct}`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** A big number with unit, for dashboards. */
export function Stat({
  label,
  value,
  unit,
  note,
  tone = 'ink',
}: {
  label: string
  value: string
  unit?: string
  note?: string
  tone?: 'ink' | 'brand' | 'navy' | 'danger'
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={cx(
          'tabular font-mono text-2xl font-semibold',
          tone === 'brand'
            ? 'text-brand-strong'
            : tone === 'navy'
              ? 'text-navy'
              : tone === 'danger'
                ? 'text-danger'
                : 'text-ink',
        )}
      >
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-muted">{unit}</span> : null}
      </span>
      {note ? <span className="text-xs text-muted">{note}</span> : null}
    </div>
  )
}

/** Who produced a structured result. Required next to every AI output. */
export function SourceTag({ source }: { source: Source }) {
  if (source === 'claude')
    return (
      <Badge tone="brand" icon={<Sparkles className="size-3" aria-hidden />}>
        綠媒 AI 整理
      </Badge>
    )
  if (source === 'rules')
    return (
      <Badge tone="brand" icon={<Wand2 className="size-3" aria-hidden />}>
        規則整理（未使用 AI）
      </Badge>
    )
  return (
    <Badge tone="neutral" icon={<PencilLine className="size-3" aria-hidden />}>
      手動填寫
    </Badge>
  )
}
