/**
 * Collection-style widgets (OpenSea-like): a vendor is a collection, each past install is an item
 * under the vendor's emblem.
 */
import { Link } from 'react-router'
import { AirVent, Cog, Fan, Flame, Gauge, Leaf, Lightbulb, Snowflake, Sun, Thermometer, Wind, type LucideIcon } from 'lucide-react'
import { SPECIALTY_LABEL } from '../core/constants/equipment'
import type { CollectionStats, VendorInstall } from '../core/domain/installs'
import { paths } from '../core/paths'
import type { Specialty, Vendor } from '../core/types'
import { DemoBadge } from './Badge'
import { RatingStars, companyMonogram, companyToneFamily } from './Domain'
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

/**
 * A vendor's cover: its monogram as a round seal on the vendor's own color, the same on every install
 * of that vendor so a collection reads as one brand.
 */
export function VendorEmblem({
  name,
  id,
  size = 'md',
  className,
}: {
  name: string
  id: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const navy = companyToneFamily(id) === 'navy'
  const seal =
    size === 'sm' ? 'size-12 text-base ring-4' : size === 'lg' ? 'size-28 text-4xl ring-8 sm:size-36 sm:text-5xl' : 'size-14 text-lg ring-4 sm:size-20 sm:text-2xl sm:ring-[6px]'
  return (
    <div className={cx('flex size-full items-center justify-center', navy ? 'bg-navy-soft' : 'bg-brand-soft', className)}>
      <span className="rounded-full border border-line-strong p-1.5">
        <span
          aria-hidden
          className={cx(
            'flex items-center justify-center rounded-full font-display font-extrabold tracking-wide ring-surface/60',
            navy ? 'bg-navy text-on-navy' : 'bg-brand text-on-brand',
            seal,
          )}
        >
          {companyMonogram(name)}
        </span>
      </span>
    </div>
  )
}

/** Top of the saving gauge scale: real installs rarely save more than half, so 50% fills the dial. */
export const SAVING_GAUGE_MAX = 50

/** Needle angle for a saving percentage: 0 at the left end of the dial, 1 at the right; null when not measured. */
export function savingGaugeRatio(pct: number | null | undefined): number | null {
  if (pct == null || !Number.isFinite(pct)) return null
  return Math.max(0, Math.min(pct, SAVING_GAUGE_MAX)) / SAVING_GAUGE_MAX
}

/**
 * The install's saving as an energy-meter dial: a half circle from 0 to 50%, filled in brand green up
 * to the value, with a needle. Installs without a saving rate (carbon inventory and the like) show an
 * empty dial with no needle.
 */
export function SavingGauge({ pct, className, scale = false }: { pct: number | null | undefined; className?: string; scale?: boolean }) {
  const r = savingGaugeRatio(pct)
  const a = Math.PI * (1 - (r ?? 0))
  const nx = 50 + 31 * Math.cos(a)
  const ny = 52 - 31 * Math.sin(a)
  const arc = 'M 10 52 A 40 40 0 0 1 90 52'
  return (
    <svg viewBox={scale ? '0 0 100 66' : '0 0 100 58'} role="img" aria-label={r == null ? '不計節電率' : `節電 ${pct}%，刻度 0 到 ${SAVING_GAUGE_MAX}%`} className={className}>
      <path d={arc} fill="none" stroke="var(--gm-line)" strokeWidth="9" strokeLinecap="round" />
      {r != null && r > 0 ? (
        <path d={arc} fill="none" stroke="var(--gm-brand)" strokeWidth="9" strokeLinecap="round" pathLength={100} strokeDasharray={`${r * 100} 100`} />
      ) : null}
      {r != null ? <line x1="50" y1="52" x2={nx} y2={ny} stroke="var(--gm-ink)" strokeWidth="3" strokeLinecap="round" /> : null}
      <circle cx="50" cy="52" r="4.5" fill={r != null ? 'var(--gm-ink)' : 'var(--gm-line-strong)'} />
      {scale ? (
        <>
          <text x="10" y="65" textAnchor="middle" fontSize="8" fill="var(--gm-muted)">0</text>
          <text x="90" y="65" textAnchor="middle" fontSize="8" fill="var(--gm-muted)">{SAVING_GAUGE_MAX}%</text>
        </>
      ) : null}
    </svg>
  )
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
export function InstallCard({ install, vendorName, isDemo }: { install: VendorInstall; vendorName: string; isDemo?: boolean }) {
  return (
    <Link to={paths.vendorInstall(install.vendorId, install.id)} className={INTERACTIVE_CARD}>
      <div className="relative aspect-[4/3]">
        <VendorEmblem name={vendorName} id={install.vendorId} />
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-sm bg-surface/90 px-1.5 py-0.5 text-xs font-medium text-ink-soft">
          <SpecialtyIcon equip={install.equip} className="size-3.5" />
          {SPECIALTY_LABEL[install.equip]}
        </span>
        {isDemo ? <DemoBadge className="absolute top-2 right-2 bg-surface/90" /> : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="truncate text-xs text-muted">{vendorName}</span>
        <span className="line-clamp-2 text-sm font-bold text-ink group-hover:text-brand-strong">{install.title}</span>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex items-end gap-1.5">
            <SavingGauge pct={install.savingPct} className="w-12 shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs text-muted">節電</span>
              <span className="tabular font-mono text-sm font-semibold text-brand-strong">{install.savingPct != null ? `${install.savingPct}%` : '—'}</span>
            </div>
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

/** A vendor as a collection card: its emblem, then name and stats. */
export function VendorCollectionCard({
  vendor,
  stats,
  rating,
}: {
  vendor: Vendor
  stats: CollectionStats
  rating: { avg: number | null; count: number }
}) {
  return (
    <Link to={paths.vendor(vendor.id)} className={INTERACTIVE_CARD}>
      <div className="relative h-28">
        <VendorEmblem name={vendor.name} id={vendor.id} size="sm" />
        {vendor.isDemo ? <DemoBadge className="absolute top-2 right-2 bg-surface/90" /> : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
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
            <dd className="flex items-end gap-1">
              <SavingGauge pct={stats.avgSavingPct} className="w-8 shrink-0" />
              <span className="tabular font-mono text-sm font-semibold text-brand-strong">{stats.avgSavingPct != null ? `${stats.avgSavingPct}%` : '—'}</span>
            </dd>
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
