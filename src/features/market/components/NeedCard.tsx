import { Link } from 'react-router'
import { MapPin, Users, Zap } from 'lucide-react'
import { SCALE_SHORT } from '../../../core/constants/equipment'
import { itemLabel } from '../../../core/domain/matching'
import { formatNtd, formatNumber, relativeTime } from '../../../core/format'
import { paths } from '../../../core/paths'
import type { Company, Need } from '../../../core/types'
import { Badge, Card, DemoBadge } from '../../../ui'
import { InterestButton } from './InterestButton'

/** One need in a list, laid out like a job posting. */
export function NeedCard({
  need,
  factoryName,
  factoryDoc,
  fit = false,
  inServiceArea = true,
  vendorId,
  compact = false,
}: {
  need: Need
  factoryName?: string
  factoryDoc?: Company
  /** The signed-in vendor's specialties match this need. */
  fit?: boolean
  /** Whether the need's city is within the signed-in vendor's serviceCities. */
  inServiceArea?: boolean
  /** Signed-in vendor: shows the 「我有興趣」 toggle. */
  vendorId?: string | null
  compact?: boolean
}) {
  const equips = Array.from(new Set(need.form.items.map((i) => i.equip)))
  const specSummary = need.form.items
    .map((it) => {
      const parts = [itemLabel(it.equip)]
      if (it.quantity) parts.push(`${it.quantity} 台`)
      if (it.ratedKw) parts.push(`各 ${it.ratedKw} kW（約 ${Math.round(it.ratedKw / 0.746)} HP）`)
      else if (it.note) parts.push(it.note)
      return parts.join('・')
    })
    .join('；')
  const fInfo = factoryDoc?.role === 'factory' ? factoryDoc.factory : null

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-ink">
            <Link to={paths.need(need.id)} className="hover:text-brand-strong hover:underline">
              {need.title}
            </Link>
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            {factoryName ? (
              <Link to={paths.factory(need.factoryId)} className="font-medium text-navy hover:underline">
                {factoryName}
              </Link>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {need.city}
            </span>
            <span>{SCALE_SHORT[need.scale]}工廠</span>
            {fInfo?.contractKw ? (
              <span className="inline-flex items-center gap-1 font-mono text-xs text-ink">
                <Zap className="size-3 text-brand" aria-hidden />
                契約容量 {formatNumber(fInfo.contractKw)} kW
              </span>
            ) : null}
            {fInfo?.monthlyKwh ? (
              <span className="font-mono text-xs text-muted">月均用電 {formatNumber(fInfo.monthlyKwh)} 度</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {fit ? (
            inServiceArea ? (
              <Badge tone="brand">符合你的專長</Badge>
            ) : (
              <Badge tone="navy">符合你的專長（跨區案源）</Badge>
            )
          ) : null}
          {need.caseId ? <Badge tone="outline">已推薦 2 家評估中</Badge> : <Badge tone="brand">開放媒合中</Badge>}
          {need.isDemo ? <DemoBadge /> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {equips.map((e) => (
          <Badge key={e} tone={e === 'carbon_consulting' ? 'navy' : 'brand'}>
            {itemLabel(e)}
          </Badge>
        ))}
      </div>

      {!compact && specSummary ? <p className="text-xs text-ink-soft">設備規模：{specSummary}</p> : null}

      {!compact && need.form.mainProblems.length ? <p className="text-sm text-ink">主要問題：{need.form.mainProblems.join('、')}</p> : null}

      {!compact && (need.budgetNtd || need.timeline) ? (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          {need.budgetNtd ? <span>預算：<span className="tabular font-mono">{formatNtd(need.budgetNtd)}</span></span> : null}
          {need.timeline ? <span>時程：{need.timeline}</span> : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>{relativeTime(need.createdAt)}刊登</span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            <span className="tabular font-mono">{need.interestedVendorIds.length}</span> 家廠商有興趣
          </span>
        </span>
        {vendorId ? <InterestButton need={need} vendorId={vendorId} /> : null}
      </div>
    </Card>
  )
}
