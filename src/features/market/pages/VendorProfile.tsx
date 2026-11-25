import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Award, SearchX } from 'lucide-react'
import { SCALE_SHORT, SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { sameIndustrySummary } from '../../../core/domain/matching'
import { formatDate } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection, useDoc } from '../../../core/store/StoreProvider'
import type { Specialty } from '../../../core/types'
import {
  Badge,
  ButtonLink,
  Card,
  DemoBadge,
  EmptyState,
  FilterChips,
  InstallCard,
  PageHeader,
  RatingStars,
  SectionTitle,
  Select,
  SkeletonList,
  SpecialtyChips,
  Tabs,
  VendorSubsidyBadge,
  VendorEmblem,
} from '../../../ui'
import { collectionFor } from '../lib/collections'
import { groupByRegion, isFactory, isVendor } from '../lib/filters'

type ProfileTab = 'installs' | 'about' | 'reviews'
type InstallSort = 'newest' | 'saving' | 'fastest'

/** A vendor as a collection: banner, stats, then a gallery of its past installs. */
export default function VendorProfile() {
  const { id } = useParams()
  const company = useDoc('companies', id)
  const reviews = useCollection('reviews')
  const companies = useCollection('companies')
  const cases = useCollection('cases')
  const { company: me } = useSession()
  const [params, setParams] = useSearchParams()
  const tab = (['installs', 'about', 'reviews'] as const).find((t) => t === params.get('tab')) ?? 'installs'
  // Filters live in the URL so Back from an install page restores them.
  const equip = (params.get('equip') ?? '') as Specialty | ''
  const sort: InstallSort = (['saving', 'fastest'] as const).find((s) => s === params.get('sort')) ?? 'newest'
  const setQuery = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const names = useMemo(() => new Map((companies ?? []).map((c) => [c.id, c.name])), [companies])
  const collection = useMemo(() => (isVendor(company) && reviews ? collectionFor(company, reviews) : null), [company, reviews])

  if (company === undefined || reviews === undefined) return <SkeletonList rows={4} />
  if (!isVendor(company) || !collection) {
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
  const { installs, stats, rating } = collection
  const mine = reviews.filter((r) => r.vendorId === company.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const myFactoryIndustry = isFactory(me) ? me.factory.industry : ''
  const sameIndustry = myFactoryIndustry ? sameIndustrySummary(company, myFactoryIndustry, companies ?? [], cases ?? []) : null
  const equips = stats.topEquips

  const visible = installs
    .filter((i) => !equip || i.equip === equip)
    .sort((a, b) =>
      sort === 'saving'
        ? (b.savingPct ?? -1) - (a.savingPct ?? -1)
        : sort === 'fastest'
          ? a.totalDays - b.totalDays
          : b.year * 100 + b.month - (a.year * 100 + a.month),
    )

  const setTab = (t: ProfileTab) => setQuery('tab', t === 'installs' ? '' : t)

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="麵包屑" className="-my-3 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link to={paths.home()} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
          首頁
        </Link>
        <span aria-hidden>/</span>
        <Link to={paths.vendors()} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
          廠商名錄
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink-soft">廠商介紹</span>
      </nav>

      <section className="overflow-hidden rounded-md border border-line bg-surface" aria-label="廠商系列">
        <div className="h-36 sm:h-52">
          <VendorEmblem name={company.name} id={company.id} size="lg" />
        </div>
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold text-ink [overflow-wrap:anywhere] sm:text-3xl">{company.name}</h1>
                {company.isDemo ? <DemoBadge /> : null}
              </div>
              <p className="mt-1 text-ink-soft">{d.tagline}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {sameIndustry?.hasExperience ? (
                  <Badge tone="brand">
                    {sameIndustry.caseCount > 0 ? `與貴廠同業：${myFactoryIndustry}（${sameIndustry.caseCount} 件實績）` : `曾服務${myFactoryIndustry}同業`}
                  </Badge>
                ) : null}
                {d.assistsSubsidy ? <VendorSubsidyBadge /> : null}
                <span className="text-sm text-muted">
                  {company.city}
                  {company.district ?? ''}・{d.foundedYear} 年成立・員工 <span className="tabular font-mono">{d.employees}</span> 人
                </span>
              </div>
            </div>
            {isFactory(me) ? <ButtonLink to={paths.newNeed()}>登記需求，讓平台推薦</ButtonLink> : null}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatItem label="安裝紀錄" value={`${stats.count}`} unit="件" />
            <StatItem label="平均節電" value={stats.avgSavingPct != null ? `${stats.avgSavingPct}%` : '—'} tone="brand" />
            <StatItem label="最佳節電" value={stats.bestSavingPct != null ? `${stats.bestSavingPct}%` : '—'} />
            <StatItem label="中位工期" value={stats.medianDays != null ? `${stats.medianDays}` : '—'} unit={stats.medianDays != null ? '天' : undefined} />
            <StatItem label="服務產業" value={`${stats.industries}`} unit="種" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs text-muted">平台工廠評價</dt>
              <dd>
                <RatingStars avg={rating.avg} count={rating.count} />
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <Tabs
        label="廠商頁分頁"
        items={[
          { key: 'installs', label: '安裝紀錄', count: stats.count },
          { key: 'about', label: '關於廠商' },
          { key: 'reviews', label: '工廠評價', count: mine.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'installs' ? (
        <section className="flex flex-col gap-4" aria-label="安裝紀錄">
          {installs.length === 0 ? (
            <EmptyState
              title="這家廠商還沒有安裝紀錄"
              body="廠商在「編輯公司資料」填寫實績案例後，每一件都會出現在這裡。"
            />
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <FilterChips
                    label="依設備篩選"
                    items={(['', ...equips] as (Specialty | '')[]).map((e) => ({
                      key: e,
                      label: e ? SPECIALTY_LABEL[e] : '全部',
                      count: e ? installs.filter((i) => i.equip === e).length : installs.length,
                      icon: e || undefined,
                    }))}
                    value={equip}
                    onChange={(k) => setQuery('equip', k)}
                  />
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap text-muted">
                  排序
                  <Select value={sort} onChange={(ev) => setQuery('sort', ev.target.value === 'newest' ? '' : ev.target.value)} className="h-11 w-auto">
                    <option value="newest">最新完成</option>
                    <option value="saving">節電最多</option>
                    <option value="fastest">工期最短</option>
                  </Select>
                </label>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visible.map((i) => (
                  <li key={i.id}>
                    <InstallCard install={i} vendorName={company.name} isDemo={company.isDemo} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      {tab === 'about' ? (
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-2">
            <p className="text-ink-soft">{company.intro}</p>
            <p className="text-sm text-muted">
              廠商自述歷年完成 <span className="tabular font-mono">{d.completedCases}</span> 件・承諾 <span className="tabular font-mono">{d.responseHours}</span> 小時內回覆
            </p>
          </Card>
          {isFactory(me) ? (
            <p className="text-sm text-muted">平台以需求媒合：登記需求後，由平台推薦 2 家合適廠商並附上理由，不開放直接聯繫或競標。</p>
          ) : null}
          <section className="flex flex-col gap-2">
            <SectionTitle title="服務項目" />
            <SpecialtyChips items={d.specialties} />
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
                    <Badge tone="navy" icon={<Award className="size-3" aria-hidden />}>
                      {c}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">尚未填寫認證。</p>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'reviews' ? (
        <section className="flex flex-col gap-2" aria-label="工廠評價">
          {mine.length ? (
            <ul className="flex flex-col gap-3">
              {mine.map((r) => (
                <li key={r.id} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-ink">
                      {names.has(r.factoryId) ? (
                        <Link to={paths.factory(r.factoryId)} className="hover:underline">
                          {names.get(r.factoryId)}
                        </Link>
                      ) : (
                        '已移除的工廠'
                      )}
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
      ) : null}
    </div>
  )
}

function StatItem({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: 'brand' }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={tone === 'brand' ? 'tabular font-mono text-xl font-semibold text-brand-strong' : 'tabular font-mono text-xl font-semibold text-ink'}>
        {value}
        {unit ? <span className="ml-1 text-xs font-normal text-muted">{unit}</span> : null}
      </dd>
    </div>
  )
}
