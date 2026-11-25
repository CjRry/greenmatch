import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  to?: string
}

/** Top of every page: optional breadcrumbs/back link, title, one-line description, actions. */
export function PageHeader({
  title,
  description,
  back,
  breadcrumbs,
  actions,
  eyebrow,
}: {
  title: ReactNode
  description?: ReactNode
  back?: { to: string; label: string }
  breadcrumbs?: BreadcrumbItem[]
  actions?: ReactNode
  eyebrow?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-2 pb-4">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="麵包屑" className="flex flex-wrap items-center gap-1 text-xs text-muted">
          {breadcrumbs.map((item, idx) => (
            <span key={`${item.label}-${idx}`} className="inline-flex min-w-0 items-center gap-1">
              {idx > 0 ? <ChevronRight className="size-3.5 shrink-0 text-muted" aria-hidden /> : null}
              {item.to && idx < breadcrumbs.length - 1 ? (
                <Link to={item.to} className="truncate hover:text-ink hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="truncate font-medium text-ink-soft" aria-current={idx === breadcrumbs.length - 1 ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      {back ? (
        <Link to={back.to} className="inline-flex w-fit items-center gap-0.5 text-sm text-muted hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <div className="mb-1 text-xs font-medium tracking-wide text-brand-strong">{eyebrow}</div> : null}
          <h1 className="font-display text-2xl font-extrabold text-ink sm:text-[28px]">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-ink-soft">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
