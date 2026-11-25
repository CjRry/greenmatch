import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { Award, SearchX } from 'lucide-react'
import { SCALE_SHORT } from '../../../core/constants/equipment'
import { vendorStats } from '../../../core/domain/vendorStats'
import { inferPortfolioIndustry, itemLabel, sameIndustrySummary, vendorIndustryExperience } from '../../../core/domain/matching'
import { formatDate } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection, useDoc } from '../../../core/store/StoreProvider'
import { Badge, ButtonLink, Card, CompanyAvatar, DemoBadge, EmptyState, PageHeader, RatingStars, SectionTitle, SkeletonList, SpecialtyChips, Stat, VendorSubsidyBadge } from '../../../ui'
import { groupByRegion, isFactory, isVendor } from '../lib/filters'

export default function VendorProfile() {
  const { id } = useParams()
  const company = useDoc('companies', id)
  const reviews = useCollection('reviews')
  const companies = useCollection('companies')
  const cases = useCollection('cases')
  const { company: me } = useSession()
  const names = useMemo(() => new Map((companies ?? []).map((c) => [c.id, c.name])), [companies])

  if (company === undefined || reviews === undefined) return <SkeletonList rows={4} />
  if (!isVendor(company)) {
    return (
      <div>
        <PageHeader title="找不到這家廠商" back={{ to: paths.vendors(), label: '廠商名錄' }} />
        <EmptyState
          icon={<SearchX className="size-6" aria-hidden />}
          title="這家廠商不存在或已被移除"
          body="可能是連結有誤。回到廠商名錄重新挑選。"
          action={<ButtonLink to={paths.vendors()}>回到廠商名錄</ButtonLink>}
        />
      </div>
    )
  }

  const d = company.vendor
  const stats = vendorStats(company.id, reviews)
  const mine = reviews.filter((r) => r.vendorId === company.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const industryExp = vendorIndustryExperience(company, companies ?? [], cases ?? [])
  const myFactoryIndustry = isFactory(me) ? me.factory.industry : ''
  const sameIndustry = myFactoryIndustry ? sameIndustrySummary(company, myFactoryIndustry, companies ?? [], cases ?? []) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ to: paths.vendors(), label: '廠商名錄' }} title="廠商介紹" />
      <Card className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <CompanyAvatar name={company.name} id={company.id} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-extrabold text-ink">{company.name}</h2>
              {sameIndustry?.hasExperience ? (
                <Badge tone="brand">
                  {sameIndustry.caseCount > 0 ? `與貴廠同業：${myFactoryIndustry}（${sameIndustry.caseCount} 件實績）` : `曾服務${myFactoryIndustry}同業`}
                </Badge>
              ) : null}
              {d.assistsSubsidy ? <VendorSubsidyBadge /> : null}
              {company.isDemo ? <DemoBadge /> : null}
            </div>
            <p className="mt-1 text-ink-soft">{d.tagline}</p>
            <p className="mt-2 text-sm text-muted">
              {company.city}{company.district ?? ''}・{d.foundedYear} 年成立・員工 <span className="tabular font-mono">{d.employees}</span> 人
            </p>
          </div>
        </div>
        <p className="text-ink-soft">{company.intro}</p>
        <div className="grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-3">
          <Stat label="完成案件" value={String(d.completedCases)} unit="件" note="含廠商自述歷年實績" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-muted">平台工廠評價</span>
            <RatingStars avg={stats.avg} count={stats.count} className="text-base" />
          </div>
          <Stat label="平均回覆時間" value={String(d.responseHours)} unit="小時" note="廠商承諾回覆時效" />
        </div>
      </Card>

      {isFactory(me) ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-brand-soft">
          <p className="max-w-xl text-sm text-brand-strong">平台以需求媒合：登記需求後，由平台推薦 2 家合適廠商並附上理由，不開放直接聯繫或競標。</p>
          <ButtonLink to={paths.newNeed()}>登記需求，讓平台推薦</ButtonLink>
        </Card>
      ) : null}

      <section className="flex flex-col gap-2">
        <SectionTitle title="服務項目" />
        <SpecialtyChips items={d.specialties} />
        {industryExp.industries.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted">曾合作產業：</span>
            {industryExp.industries.map((ind) => (
              <Badge key={ind} tone={myFactoryIndustry === ind ? 'brand' : 'outline'}>
                {ind}
                {industryExp.countByIndustry[ind] ? `（${industryExp.countByIndustry[ind]} 件）` : ''}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-muted">適合客戶規模：{d.sizeFit.map((s) => `${SCALE_SHORT[s]}工廠`).join('、')}</p>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle title="服務範圍" />
        <dl className="flex flex-col gap-1.5">
          {groupByRegion(d.serviceCities).map((g) => (
            <div key={g.region} className="grid gap-0.5 sm:grid-cols-[4rem_1fr] sm:gap-3">
              <dt className="text-sm text-muted">{g.region}</dt>
              <dd className="text-ink">{g.cities.join('、')}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle title="認證" />
        {d.certifications.length ? (
          <ul className="flex flex-wrap gap-2">
            {d.certifications.map((c) => (
              <li key={c}>
                <Badge tone="navy" icon={<Award className="size-3" aria-hidden />}>{c}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">尚未填寫認證。</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle title="實績案例" />
        {d.portfolio.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {d.portfolio.map((p, i) => {
              const ind = inferPortfolioIndustry(p)
              const isSame = Boolean(myFactoryIndustry) && ind === myFactoryIndustry
              return (
                <li key={i} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink">{p.title}</p>
                    {ind ? <Badge tone={isSame ? 'brand' : 'outline'}>{isSame ? `同業・${ind}` : ind}</Badge> : null}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                    <span>{p.city}</span>
                    <span>{itemLabel(p.equip)}</span>
                    <span className="tabular font-mono">{p.year}</span>
                    {p.savingPct != null ? <Badge tone="brand">節電 {p.savingPct}%</Badge> : null}
                  </p>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">尚未填寫實績案例。</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle title="工廠評價" hint={mine.length ? `共 ${mine.length} 則` : undefined} />
        {mine.length ? (
          <ul className="flex flex-col gap-3">
            {mine.map((r) => (
              <li key={r.id} className="rounded-md border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-ink">
                    {names.has(r.factoryId) ? <Link to={paths.factory(r.factoryId)} className="hover:underline">{names.get(r.factoryId)}</Link> : '已移除的工廠'}
                  </span>
                  <span className="text-muted">{formatDate(r.createdAt)}</span>
                </div>
                <RatingStars avg={r.rating} count={1} showCount={false} className="mt-1" />
                <p className="mt-1 text-ink-soft [overflow-wrap:anywhere]">{r.comment}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">還沒有工廠留下評價。完成案件的工廠會在案件結束後評價。</p>
        )}
      </section>
    </div>
  )
}
