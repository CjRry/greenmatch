import { cx } from './cx'

export interface TabItem<K extends string> {
  key: K
  label: string
  count?: number
}

/** Horizontal tabs (Shopee-style order tabs). Scrolls sideways on narrow screens. */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  className,
  label,
  wrap = false,
}: {
  items: readonly TabItem<K>[]
  value: K
  onChange: (key: K) => void
  className?: string
  /** Accessible name for the tab list. */
  label: string
  /** Wrap tabs onto multiple rows instead of scrolling sideways. */
  wrap?: boolean
}) {
  return (
    <div className={cx(wrap ? '' : '-mx-1 overflow-x-auto', className)}>
      <div
        role="tablist"
        aria-label={label}
        className={cx(
          'flex border-b border-line',
          wrap ? 'flex-wrap gap-1.5 pb-2.5' : 'min-w-max gap-1 px-1',
        )}
      >
        {items.map((t) => {
          const active = t.key === value
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(t.key)}
              className={cx(
                'flex items-center gap-1.5 text-sm whitespace-nowrap transition-colors',
                wrap
                  ? cx(
                      'rounded-sm border px-2.5 py-1.5',
                      active
                        ? 'border-brand bg-brand-soft font-bold text-brand-strong'
                        : 'border-line bg-surface text-ink-soft hover:text-ink',
                    )
                  : cx(
                      '-mb-px border-b-2 px-3 py-2.5',
                      active ? 'border-brand font-bold text-ink' : 'border-transparent text-muted hover:text-ink',
                    ),
              )}
            >
              {t.label}
              {t.count !== undefined ? (
                <span className={cx('tabular rounded-sm px-1.5 text-xs', active ? 'bg-brand-soft text-brand-strong' : 'bg-sunken text-muted')}>
                  {t.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
