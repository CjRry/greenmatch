import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { SearchX, Sparkles } from 'lucide-react'
import { SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { stageDeltaDays, traitShare } from '../../../core/domain/installs'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection, useDoc } from '../../../core/store/StoreProvider'
import {
  Badge,
  ButtonLink,
  Card,
  CompanyAvatar,
  DemoBadge,
  EmptyState,
  InstallCard,
  PageHeader,
  ProcessGlyph,
  SectionTitle,
  SkeletonList,
  SpecialtyIcon,
  coverTone,
  cx,
} from '../../../ui'
import { collectionFor } from '../lib/collections'
import { isFactory, isVendor } from '../lib/filters'

const STAGE_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5']
const STAGE_BORDERS = ['border-chart-1', 'border-chart-2', 'border-chart-3', 'border-chart-4', 'border-chart-5']

/** One past install, like an item page: the process fingerprint, its traits, and the 8 stages. */
export default function InstallDetail() {
  const { id, installId } = useParams()
  const company = useDoc('companies', id)
  const reviews = useCollection('reviews')
  const { company: me } = useSession()
  const collection = useMemo(() => (isVendor(company) && reviews ? collectionFor(company, reviews) : null), [company, reviews])

  if (company === undefined || reviews === undefined) return <SkeletonList rows={4} />
  const install = collection?.installs.find((i) => i.id === installId)
  if (!collection || !install) {
    return (
      <div>
        <PageHeader title="找不到這件安裝紀錄" back={{ to: id ? paths.vendor(id) : paths.vendors(), label: '回到廠商' }} />
        <EmptyState
          icon={<SearchX className="size-6" aria-hidden />}
          title="這件安裝紀錄不存在或已被移除"
          body="可能是連結有誤。回到廠商頁重新挑選。"
          action={<ButtonLink to={id ? paths.vendor(id) : paths.vendors()}>回到廠商頁</ButtonLink>}
        />
      </div>
    )
  }

  const { vendor, installs, stats } = collection
  const others = installs.filter((i) => i.id !== install.id).slice(0, 4)
  const daysVsMedian = stats.medianDays != null ? install.totalDays - stats.medianDays : null
  const differences = install.steps.filter((s) => s.extra)

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="麵包屑" className="-my-3 flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <Link to={paths.home()} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
          首頁
        </Link>
        <span aria-hidden>/</span>
        <Link to={paths.vendor(vendor.id)} className="inline-flex min-h-11 max-w-[14rem] items-center hover:text-ink hover:underline">
          {vendor.name}
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink-soft">安裝紀錄</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="flex flex-col gap-3">
          <div className={cx('relative overflow-hidden rounded-md border border-line', coverTone(install.equip))}>
            <ProcessGlyph steps={install.steps} savingPct={install.savingPct} numbered className="mx-auto aspect-square w-full max-w-md p-6" title={`${install.title} 的 8 階段流程圖`} />
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-sm bg-surface px-2 py-1 text-xs font-medium text-ink-soft">
              <SpecialtyIcon equip={install.equip} className="size-3.5" />
              {SPECIALTY_LABEL[install.equip]}
            </span>
          </div>
          <ol className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4" aria-label="圖例">
            {install.steps.map((s, i) => (
              <li key={s.stage} className="flex items-center gap-1.5 text-ink-soft">
                <span className={cx('size-2.5 shrink-0 rounded-full', STAGE_COLORS[i % STAGE_COLORS.length])} aria-hidden />
                <span className="truncate">
                  {s.n}. {s.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Link to={paths.vendor(vendor.id)} className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-brand-strong hover:underline">
              <CompanyAvatar name={vendor.name} id={vendor.id} size="sm" />
              {vendor.name}
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">{install.title}</h1>
              {vendor.isDemo ? <DemoBadge /> : null}
            </div>
            <p className="text-sm text-muted">
              業主：{install.industry}・{install.city}・{install.year} 年 {install.month} 月完成
            </p>
          </div>

          <Card className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted">節電</p>
              <p className="tabular font-mono text-2xl font-bold text-brand-strong">{install.savingPct != null ? `${install.savingPct}%` : '—'}</p>
              {install.savingPct == null ? <p className="text-xs text-muted">此類案件不計節電率</p> : null}
            </div>
            <div>
              <p className="text-xs text-muted">總工期</p>
              <p className="tabular font-mono text-2xl font-bold text-ink">
                {install.totalDays}
                <span className="ml-1 text-sm font-normal text-muted">天</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">比這家廠商中位數</p>
              <p className={cx('tabular font-mono text-2xl font-bold', daysVsMedian != null && daysVsMedian > 0 ? 'text-warn' : 'text-ink')}>
                {daysVsMedian == null ? '—' : daysVsMedian === 0 ? '持平' : `${daysVsMedian > 0 ? '+' : ''}${daysVsMedian}`}
                {daysVsMedian ? <span className="ml-1 text-sm font-normal text-muted">天</span> : null}
              </p>
            </div>
          </Card>

          {install.note ? (
            <p className="flex gap-2 rounded-sm border border-line bg-navy-soft px-3 py-2 text-sm text-ink">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-navy" aria-hidden />
              {install.note}
            </p>
          ) : null}

          <section className="flex flex-col gap-2" aria-label="流程特徵">
            <SectionTitle title="流程特徵" hint={`與這家廠商其他 ${installs.length - 1} 件比較，百分比是有相同特徵的比例`} />
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {install.traits.map((t) => {
                const share = Math.round(traitShare(installs, t) * 100)
                return (
                  <li key={t.key} className="flex min-w-0 flex-col rounded-sm border border-line bg-surface px-3 py-2">
                    <span className="text-xs text-muted">{t.label}</span>
                    <span className="truncate text-sm font-bold text-ink" title={t.value}>
                      {t.value}
                    </span>
                    <span className={cx('tabular font-mono text-xs', share <= 25 ? 'font-semibold text-navy' : 'text-muted')}>
                      {share}% 有此特徵{share <= 25 ? '・少見' : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          {isFactory(me) ? (
            <Card className="flex flex-wrap items-center justify-between gap-3 bg-brand-soft">
              <p className="max-w-md text-sm text-brand-strong">想做類似的改善？登記需求後，平台推薦 2 家合適廠商並附理由。</p>
              <ButtonLink to={paths.newNeed()} size="sm">
                登記需求，讓平台推薦
              </ButtonLink>
            </Card>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-label="安裝流程">
        <SectionTitle
          title="安裝流程"
          hint={differences.length ? `8 個標準階段，其中 ${differences.length} 個階段的做法與標準不同` : '8 個標準階段，全部照標準流程進行'}
        />
        <ol className="flex flex-col">
          {install.steps.map((s, i) => {
            const delta = stageDeltaDays(installs, install, s.stage)
            return (
              <li key={s.stage} className="relative flex gap-3 pb-4 last:pb-0">
                {i < install.steps.length - 1 ? <span className="absolute top-8 bottom-0 left-[0.9rem] w-px bg-line" aria-hidden /> : null}
                <span
                  className={cx(
                    'tabular relative flex size-7 shrink-0 items-center justify-center rounded-full border-[3px] bg-surface font-mono text-xs font-bold text-ink',
                    STAGE_BORDERS[i % STAGE_BORDERS.length],
                  )}
                >
                  {s.n}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-md border border-line bg-surface px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-ink">{s.label}</span>
                    <span className="flex items-center gap-2">
                      {Math.abs(delta) >= 3 && installs.length > 1 ? (
                        <span className={cx('tabular font-mono text-xs', delta > 0 ? 'text-warn' : 'text-brand-strong')}>
                          {delta > 0 ? `比平均多 ${delta} 天` : `比平均少 ${-delta} 天`}
                        </span>
                      ) : null}
                      <span className="tabular font-mono text-sm font-semibold text-ink">{s.days} 天</span>
                    </span>
                  </div>
                  <p className="text-sm text-ink-soft">{s.note}</p>
                  {s.extra ? (
                    <Badge tone="warn" className="w-fit whitespace-normal">
                      這件不同：{s.extra}
                    </Badge>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {others.length ? (
        <section className="flex flex-col gap-3" aria-label="同廠商其他安裝">
          <SectionTitle
            title={`${vendor.name} 的其他安裝`}
            action={
              <Link to={paths.vendor(vendor.id)} className="inline-flex min-h-11 items-center text-sm font-medium text-brand-strong hover:underline">
                看全部 {installs.length} 件
              </Link>
            }
          />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {others.map((i) => (
              <li key={i.id}>
                <InstallCard install={i} isDemo={vendor.isDemo} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
