import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ClipboardCheck, Gauge, IdCard, Target } from 'lucide-react'
import { SCALE_SHORT, SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { nowIso } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useCollection } from '../../../core/store/StoreProvider'
import type { ReactNode } from 'react'
import type { Vendor } from '../../../core/types'
import { Badge, ButtonLink, Card, CompanyAvatar, DemoBadge, EmptyState, RatingStars, SavingGauge, ScoreBar, Skeleton, cx } from '../../../ui'
import { buildCollections } from '../lib/collections'
import { needsForVendor, profileCompleteness, savingBenchmark, stageTag, vendorPerformance, vendorTodos, vendorWaiting } from '../lib/vendorHome'

function Panel({ icon, title, label, action, children }: { icon: ReactNode; title: string; label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const ROW = 'flex items-start justify-between gap-3 rounded-sm border border-line bg-canvas p-3 transition-colors duration-150 hover:border-brand'

/**
 * A signed-in vendor's home: the work that is theirs to do, needs that fit them, their own
 * collection as factories see it, and how they are doing. Other vendors are never named here; the
 * only comparison is an anonymous median.
 */
export function VendorHome({ vendor }: { vendor: Vendor }) {
  const companies = useCollection('companies')
  const reviews = useCollection('reviews')
  const cases = useCollection('cases')
  const quotes = useCollection('quotes')
  const needs = useCollection('needs')

  const data = useMemo(() => {
    if (!companies || !reviews || !cases || !quotes || !needs) return undefined
    const nameOf = (id: string) => companies.find((c) => c.id === id)?.name ?? '工廠'
    const all = buildCollections(companies, reviews)
    const mine = all.find((c) => c.vendor.id === vendor.id)
    return {
      todos: vendorTodos(vendor.id, cases, quotes, nameOf, nowIso()),
      waiting: vendorWaiting(vendor.id, cases, quotes),
      fits: needsForVendor(needs, vendor, companies),
      mine,
      completeness: profileCompleteness(vendor),
      perf: vendorPerformance(vendor.id, cases, quotes),
      bench: mine ? savingBenchmark(mine, all) : null,
    }
  }, [companies, reviews, cases, quotes, needs, vendor])

  const header = (
    <Card className="flex flex-wrap items-center gap-3">
      <CompanyAvatar name={vendor.name} id={vendor.id} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-extrabold text-ink sm:text-2xl">廠商工作台</h1>
          {vendor.isDemo ? <DemoBadge /> : null}
        </div>
        <p className="text-sm text-ink-soft [overflow-wrap:anywhere]">{vendor.name}</p>
        {data ? (
          <p className="mt-1 text-sm text-ink-soft">
            <span className="tabular font-mono font-semibold text-ink">{data.todos.length}</span> 件輪到你處理・
            <span className="tabular font-mono font-semibold text-ink">{data.waiting}</span> 件等工廠回覆
          </p>
        ) : null}
      </div>
    </Card>
  )

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-56" />
          ))}
        </div>
      </div>
    )
  }

  const { todos, fits, mine, completeness, perf, bench } = data

  return (
    <div className="flex flex-col gap-6">
      {header}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Panel icon={<ClipboardCheck className="size-5 text-brand-strong" aria-hidden />} title="輪到你處理" label="輪到你處理">
          {todos.length ? (
            <ul className="flex flex-col gap-2">
              {todos.map((t) => (
                <li key={t.caseId}>
                  <Link to={t.action === '提交報價' ? paths.caseQuoteNew(t.caseId) : paths.case(t.caseId)} className={ROW}>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink [overflow-wrap:anywhere]">{t.title}</p>
                      <p className="text-xs text-muted">
                        {t.factoryName}・{stageTag(t.stage)}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-strong">
                        {t.action}
                        <ArrowRight className="size-3.5" aria-hidden />
                      </p>
                    </div>
                    <Badge tone={t.waitingDays >= 7 ? 'warn' : 'neutral'}>
                      已等 <span className="tabular font-mono">{t.waitingDays}</span> 天
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="目前沒有輪到你的事"
              body="工廠邀請你場勘、或你的報價被選中後，要處理的步驟會出現在這裡。"
              action={<ButtonLink to={paths.needs()} variant="secondary">看需求市集</ButtonLink>}
            />
          )}
        </Panel>

        <Panel
          icon={<Target className="size-5 text-brand-strong" aria-hidden />}
          title="適合你的新需求"
          label="適合你的新需求"
          action={
            <Link to={paths.needs()} className="inline-flex min-h-11 items-center text-sm font-medium text-brand-strong hover:underline">
              看全部需求
            </Link>
          }
        >
          {fits.length ? (
            <ul className="flex flex-col gap-2">
              {fits.map((f) => (
                <li key={f.need.id}>
                  <Link to={paths.need(f.need.id)} className={ROW}>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink [overflow-wrap:anywhere]">{f.need.title}</p>
                      <p className="text-xs text-muted">
                        {f.need.city}・{SCALE_SHORT[f.need.scale]}
                      </p>
                      <p className="mt-1 text-xs text-ink-soft">{f.reasons.join('・')}</p>
                    </div>
                    <Badge tone={f.level === 'high' ? 'brand' : 'neutral'}>{f.level === 'high' ? '高度符合' : '可能符合'}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="目前沒有符合你專長的開放需求"
              body="在公司資料補上服務地區與專長，有新需求符合時會出現在這裡。"
              action={<ButtonLink to={paths.profile()} variant="secondary">補齊公司資料</ButtonLink>}
            />
          )}
          <p className="text-xs text-muted">這裡只列出需求內容；其他廠商是誰、報價多少都不會公開。</p>
        </Panel>

        <Panel icon={<IdCard className="size-5 text-navy" aria-hidden />} title="我的系列" label="我的系列">
          <p className="text-sm text-ink-soft">工廠打開你的廠商頁時，看到的就是這些。</p>
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-muted">安裝紀錄</dt>
              <dd className="tabular font-mono text-lg font-semibold text-ink">{mine?.stats.count ?? 0} 件</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">平均節電</dt>
              <dd className="flex items-end gap-1">
                <SavingGauge pct={mine?.stats.avgSavingPct} className="w-9 shrink-0" />
                <span className="tabular font-mono text-lg font-semibold text-brand-strong">
                  {mine?.stats.avgSavingPct != null ? `${mine.stats.avgSavingPct}%` : '—'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">評價</dt>
              <dd>
                <RatingStars avg={mine?.rating.avg ?? null} count={mine?.rating.count ?? 0} className="text-sm" />
              </dd>
            </div>
          </dl>
          <ScoreBar label="公司資料完整度" value={completeness.pct / 100} detail={`${completeness.pct}%`} />
          {completeness.missing.length ? (
            <p className="text-sm text-ink-soft">還缺：{completeness.missing.join('、')}。資料越完整，推薦時越容易說明你為什麼適合。</p>
          ) : (
            <p className="text-sm text-ink-soft">公司資料都填齊了。</p>
          )}
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={paths.profile()} variant={completeness.missing.length ? 'primary' : 'secondary'}>
              {completeness.missing.length ? '補齊公司資料' : '編輯公司資料'}
            </ButtonLink>
            <ButtonLink to={paths.vendor(vendor.id)} variant="secondary">
              預覽工廠看到的頁面
            </ButtonLink>
          </div>
        </Panel>

        <Panel icon={<Gauge className="size-5 text-navy" aria-hidden />} title="成效與評價" label="成效與評價">
          <dl className="flex flex-col divide-y divide-line text-sm">
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-ink-soft">報價後被選中</dt>
              <dd className="tabular font-mono font-semibold text-ink">
                {perf.quoted ? `${perf.won} / ${perf.quoted} 件` : '還沒有報價紀錄'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-ink-soft">登記的回覆時間</dt>
              <dd className="tabular font-mono font-semibold text-ink">{vendor.vendor.responseHours} 小時內</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <dt className="text-ink-soft">工廠評價</dt>
              <dd>
                <RatingStars avg={mine?.rating.avg ?? null} count={mine?.rating.count ?? 0} className="text-sm" />
              </dd>
            </div>
            <div className={cx('flex flex-col gap-1 py-2')}>
              <dt className="text-ink-soft">節電成效和市場比較</dt>
              <dd className="text-ink">
                {bench ? (
                  <>
                    你的{SPECIALTY_LABEL[bench.equip]}平均節電 <span className="tabular font-mono font-semibold text-brand-strong">{bench.mine}%</span>，
                    其他廠商中位數 <span className="tabular font-mono font-semibold">{bench.median}%</span>
                    <span className="text-xs text-muted">（{bench.peerCount} 件安裝）</span>
                  </>
                ) : (
                  <span className="text-muted">同設備的安裝紀錄還不夠，暫時無法比較</span>
                )}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted">比較只用匿名中位數，不列出其他廠商。</p>
        </Panel>
      </div>
    </div>
  )
}
