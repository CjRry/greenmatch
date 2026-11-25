/**
 * Collection-style widgets (OpenSea-like): a vendor is a collection, each past install is an item
 * with its own process "fingerprint" drawn from how long each of the 8 stages took.
 */
import { Link } from 'react-router'
import { AirVent, Cog, Fan, Flame, Gauge, Leaf, Lightbulb, Snowflake, Sun, Thermometer, Wind, type LucideIcon } from 'lucide-react'
import { SPECIALTY_LABEL } from '../core/constants/equipment'
import type { CollectionStats, InstallStep, VendorInstall } from '../core/domain/installs'
import { paths } from '../core/paths'
import type { Specialty, Vendor } from '../core/types'
import { DemoBadge } from './Badge'
import { CompanyAvatar, RatingStars } from './Domain'
import { cx } from './cx'

const SPECIALTY_ICON: Record<Specialty, LucideIcon> = {
  air_compressor: Wind,
  hvac: AirVent,
  chiller: Snowflake,
  lighting: Lightbulb,
  motor_vfd: Cog,
  boiler: Flame,
  pump_fan: Fan,
  heat_pump: Thermometer,
  solar_pv: Sun,
  ems: Gauge,
  carbon_consulting: Leaf,
}

export function SpecialtyIcon({ equip, className }: { equip: Specialty; className?: string }) {
  const Icon = SPECIALTY_ICON[equip]
  return <Icon className={className} aria-hidden />
}

const PETAL_COLORS = ['var(--gm-chart-1)', 'var(--gm-chart-2)', 'var(--gm-chart-3)', 'var(--gm-chart-4)', 'var(--gm-chart-5)']

/**
 * The install's process as a flower: 8 petals clockwise from 12 o'clock, one per stage, length by
 * days spent. Petals with something non-standard (subsidy, second survey…) get a dot at the tip.
 */
export function ProcessGlyph({
  steps,
  savingPct,
  className,
  title,
  numbered = false,
}: {
  steps: readonly InstallStep[]
  /** Drawn as an outer meter arc from 12 o'clock, clockwise. */
  savingPct?: number | null
  className?: string
  title?: string
  /** Print the stage number at each petal tip, so the stages can be read without the colors. */
  numbered?: boolean
}) {
  // Petals are relative to this install's longest stage, so the shape shows where the time went.
  const max = Math.max(...steps.map((s) => s.days), 1)
  const arc = savingPct != null && savingPct > 0 ? Math.min(savingPct, 100) / 100 : 0
  const R = 46
  const C = 2 * Math.PI * R
  return (
    <svg viewBox="0 0 100 100" className={cx('block', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--gm-line)" strokeWidth="2" />
      {arc ? (
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="var(--gm-brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${C * arc} ${C}`}
          transform="rotate(-90 50 50)"
        />
      ) : null}
      <circle cx="50" cy="50" r="24" fill="none" stroke="var(--gm-line)" strokeWidth="0.6" />
      {steps.map((s, i) => {
        const a = ((i * 45 - 90) * Math.PI) / 180
        const r = 11 + 27 * Math.pow(s.days / max, 0.6)
        const x1 = 50 + Math.cos(a) * 9
        const y1 = 50 + Math.sin(a) * 9
        const x2 = 50 + Math.cos(a) * r
        const y2 = 50 + Math.sin(a) * r
        const color = PETAL_COLORS[i % PETAL_COLORS.length]
        return (
          <g key={s.stage}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="7" strokeLinecap="round" opacity="0.9" />
            {s.extra ? <circle cx={50 + Math.cos(a) * (r + 5.5)} cy={50 + Math.sin(a) * (r + 5.5)} r="2" fill="var(--gm-ink)" /> : null}
            {numbered ? (
              <text
                x={50 + Math.cos(a) * (s.extra ? r + 11 : r + 6.5)}
                y={50 + Math.sin(a) * (s.extra ? r + 11 : r + 6.5)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="4.5"
                fontWeight="700"
                fill="var(--gm-ink-soft)"
              >
                {s.n}
              </text>
            ) : null}
          </g>
        )
      })}
      <circle cx="50" cy="50" r="6" fill="var(--gm-surface)" stroke="var(--gm-line-strong)" strokeWidth="0.8" />
    </svg>
  )
}

/** Cover background by kind of work: electrical, thermal, or management/consulting. */
export function coverTone(equip: Specialty): string {
  if (equip === 'chiller' || equip === 'hvac' || equip === 'boiler' || equip === 'heat_pump') return 'bg-navy-soft'
  if (equip === 'ems' || equip === 'carbon_consulting' || equip === 'solar_pv') return 'bg-warn-soft'
  return 'bg-brand-soft'
}

/** A whole-card link: soft lift and shadow on hover (200 ms, transform only), pressed state, visible focus. */
const INTERACTIVE_CARD =
  'group flex h-full flex-col overflow-hidden rounded-md border border-line bg-surface transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-brand hover:shadow-[var(--gm-shadow)] active:translate-y-0 active:scale-[0.99] motion-reduce:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/**
 * Horizontal row of filter chips: one line that scrolls sideways on phones instead of wrapping into
 * several rows, 44 px tall touch targets, selected state shown by border + weight, not color alone.
 */
export function FilterChips<K extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: readonly { key: K; label: string; count?: number; icon?: Specialty }[]
  value: K
  onChange: (key: K) => void
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" role="group" aria-label={label}>
      <div className="flex w-max gap-2 pb-1 sm:w-auto sm:flex-wrap">
        {items.map((it) => {
          const active = it.key === value
          return (
            <button
              key={it.key || 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(it.key)}
              className={cx(
                'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-sm border px-3.5 text-sm whitespace-nowrap transition-colors duration-150',
                active ? 'border-brand bg-brand-soft font-bold text-brand-strong' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
              )}
            >
              {it.icon ? <SpecialtyIcon equip={it.icon} className="size-4" /> : null}
              {it.label}
              {it.count !== undefined ? <span className="tabular font-mono text-xs text-muted">{it.count}</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** One install as a gallery item. */
export function InstallCard({ install, vendorName, isDemo }: { install: VendorInstall; vendorName?: string; isDemo?: boolean }) {
  return (
    <Link to={paths.vendorInstall(install.vendorId, install.id)} className={INTERACTIVE_CARD}>
      <div className={cx('relative aspect-square', coverTone(install.equip))}>
        <ProcessGlyph steps={install.steps} savingPct={install.savingPct} className="size-full p-3" />
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-sm bg-surface/90 px-1.5 py-0.5 text-xs font-medium text-ink-soft">
          <SpecialtyIcon equip={install.equip} className="size-3.5" />
          {SPECIALTY_LABEL[install.equip]}
        </span>
        {isDemo ? <DemoBadge className="absolute top-2 right-2 bg-surface/90" /> : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {vendorName ? <span className="truncate text-xs text-muted">{vendorName}</span> : null}
        <span className="line-clamp-2 text-sm font-bold text-ink group-hover:text-brand-strong">{install.title}</span>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex flex-col">
            <span className="text-xs text-muted">節電</span>
            <span className="tabular font-mono text-sm font-semibold text-brand-strong">{install.savingPct != null ? `${install.savingPct}%` : '—'}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted">總工期</span>
            <span className="tabular font-mono text-sm font-semibold text-ink">{install.totalDays} 天</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

/** A vendor as a collection card: a mosaic of its latest installs, then name and stats. */
export function VendorCollectionCard({
  vendor,
  installs,
  stats,
  rating,
}: {
  vendor: Vendor
  installs: readonly VendorInstall[]
  stats: CollectionStats
  rating: { avg: number | null; count: number }
}) {
  const mosaic = installs.slice(0, 3)
  return (
    <Link to={paths.vendor(vendor.id)} className={INTERACTIVE_CARD}>
      <div className="grid h-28 grid-cols-3 gap-px bg-line">
        {[0, 1, 2].map((i) =>
          mosaic[i] ? (
            <div key={i} className={coverTone(mosaic[i].equip)}>
              <ProcessGlyph steps={mosaic[i].steps} savingPct={mosaic[i].savingPct} className="size-full p-1.5" />
            </div>
          ) : (
            <div key={i} className="bg-sunken" />
          ),
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="-mt-8 flex items-end gap-2">
          <span className="rounded-sm border-2 border-surface">
            <CompanyAvatar name={vendor.name} id={vendor.id} />
          </span>
          {vendor.isDemo ? <DemoBadge className="mb-0.5 bg-surface" /> : null}
        </div>
        <div className="min-w-0">
          <p className="font-display font-bold text-ink [overflow-wrap:anywhere] group-hover:text-brand-strong">{vendor.name}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">{vendor.vendor.tagline}</p>
        </div>
        <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-2.5">
          <div>
            <dt className="text-xs text-muted">安裝紀錄</dt>
            <dd className="tabular font-mono text-sm font-semibold text-ink">{stats.count}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">平均節電</dt>
            <dd className="tabular font-mono text-sm font-semibold text-brand-strong">{stats.avgSavingPct != null ? `${stats.avgSavingPct}%` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">評價</dt>
            <dd>
              <RatingStars avg={rating.avg} count={rating.count} showCount={false} className="text-xs" />
            </dd>
          </div>
        </dl>
      </div>
    </Link>
  )
}
