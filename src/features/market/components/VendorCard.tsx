import { Link } from 'react-router'
import { Clock, MapPin } from 'lucide-react'
import { vendorIndustryExperience } from '../../../core/domain/matching'
import { paths } from '../../../core/paths'
import type { Vendor } from '../../../core/types'
import type { VendorStats } from '../../../core/domain/vendorStats'
import { Badge, Card, CompanyAvatar, DemoBadge, RatingStars, SpecialtyChips, VendorSubsidyBadge } from '../../../ui'

export function VendorCard({
  vendor,
  stats,
  compact = false,
  targetIndustry = '',
  sameIndustryCount = 0,
}: {
  vendor: Vendor
  stats: VendorStats
  compact?: boolean
  targetIndustry?: string
  sameIndustryCount?: number
}) {
  const d = vendor.vendor
  const { industries } = vendorIndustryExperience(vendor)
  const hasSameIndustry = Boolean(targetIndustry) && (industries.includes(targetIndustry) || sameIndustryCount > 0)
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <CompanyAvatar name={vendor.name} id={vendor.id} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold text-ink">
              <Link to={paths.vendor(vendor.id)} className="hover:text-brand-strong hover:underline">
                {vendor.name}
              </Link>
            </h3>
            {hasSameIndustry ? (
              <Badge tone="brand">
                {sameIndustryCount > 0 ? `同業實績：${targetIndustry}（${sameIndustryCount} 件）` : `曾服務${targetIndustry}`}
              </Badge>
            ) : null}
            {d.assistsSubsidy ? <VendorSubsidyBadge /> : null}
            {vendor.isDemo ? <DemoBadge /> : null}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">{d.tagline || '一句話介紹尚未填寫'}</p>
        </div>
      </div>
      <SpecialtyChips items={d.specialties} max={compact ? 3 : undefined} />
      {industries.length > 0 ? (
        <p className="text-xs text-muted">曾合作產業：{industries.slice(0, compact ? 3 : 5).join('、')}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" aria-hidden />
          {vendor.city}
        </span>
        <RatingStars avg={stats.avg} count={stats.count} />
        <span>
          完成 <span className="tabular font-mono">{d.completedCases}</span> 件
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden />
          平均 <span className="tabular font-mono">{d.responseHours}</span> 小時回覆
        </span>
      </div>
    </Card>
  )
}
