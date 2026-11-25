import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { STAGE_BY_KEY } from '../../../core/constants/stages'
import { CITY_INFO } from '../../../core/constants/geo'
import { paths } from '../../../core/paths'
import { relativeTime } from '../../../core/format'
import type { Case, Company, Role } from '../../../core/types'
import { Badge, Card, DemoBadge, StageBadge, StageProgress } from '../../../ui'
import { handlerText } from '../lib/views'

/** One case in the 我的 list: title, stage, who is handling it, the other party, last update. */
export function CaseRow({
  c,
  viewer,
  companies,
  reason,
  prep,
  statusBadge,
  handlerOverride,
}: {
  c: Case
  viewer: Role
  companies: ReadonlyMap<string, Company>
  /** Why the platform recommended this vendor (vendor view, stage assess). */
  reason?: string | null
  /** 「下一步，你需要準備」 text for the factory's to-do list. */
  prep?: string | null
  /** Extra status pill (e.g. 已報價・待工廠決定 or 未得標). */
  statusBadge?: { label: string; tone: 'brand' | 'navy' | 'warn' | 'neutral' } | null
  /** Override handler text when all shortlist vendors quoted and it's the factory's turn. */
  handlerOverride?: string | null
}) {
  const completed = c.status === 'completed'
  const factory = companies.get(c.factoryId)
  const vendorId = c.selectedVendorId ?? null
  const vendorNames = (vendorId ? [vendorId] : c.shortlist.length ? c.shortlist : c.recommendations.map((r) => r.vendorId))
    .map((id) => companies.get(id)?.name)
    .filter((n): n is string => !!n)
  const vendorLabel = vendorId ? '入選廠商' : c.shortlist.length ? '受邀廠商' : '推薦廠商'

  return (
    <li>
      <Link to={paths.case(c.id)} className="group block rounded-md focus-visible:outline-2 focus-visible:outline-brand">
        <Card className="flex flex-col gap-3 transition-colors group-hover:border-brand">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-bold text-ink">{c.title}</h3>
                {c.isDemo ? <DemoBadge /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                <StageBadge stage={c.stage} completed={completed} />
                <span>{handlerOverride ?? handlerText(c)}</span>
                {statusBadge ? <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge> : null}
              </div>
            </div>
            <ChevronRight className="mt-1 size-5 shrink-0 text-muted group-hover:text-brand" aria-hidden />
          </div>

          <StageProgress stage={c.stage} completed={completed} />

          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-muted">
            <span className="min-w-0 break-words">
              {viewer === 'vendor' ? (
                <>
                  工廠：<span className="text-ink-soft">{factory?.name ?? '—'}</span>
                  {factory ? `（${factory.city}・${CITY_INFO[factory.city].region}）` : ''}
                </>
              ) : vendorNames.length ? (
                <>
                  {vendorLabel}：<span className="text-ink-soft">{vendorNames.join('、')}</span>
                </>
              ) : (
                '尚未推薦廠商'
              )}
            </span>
            <span>更新於 {relativeTime(c.updatedAt)}</span>
          </div>

          {reason ? (
            <p className="rounded-sm bg-brand-soft px-3 py-2 text-sm text-brand-strong">平台推薦理由：{reason}</p>
          ) : null}
          {prep ? (
            <p className="rounded-sm bg-warn-soft px-3 py-2 text-sm text-warn">
              下一步，你需要準備：{prep}
              <span className="sr-only">（{STAGE_BY_KEY[c.stage].label}階段）</span>
            </p>
          ) : null}
        </Card>
      </Link>
    </li>
  )
}
