import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { HandCoins, Leaf, LogIn, Pencil, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { CITY_INFO } from '../../../core/constants/geo'
import { STAGE_BY_KEY } from '../../../core/constants/stages'
import { latestInventory, summarizeInventory } from '../../../core/domain/carbon'
import {
  buildFactoryFactPatch,
  formatEquipmentSummary,
  overallFactSource,
  resolveAnnualCarbonSummary,
  resolveFactoryFacts,
  type FactoryFactUpdates,
} from '../../../core/domain/factoryFacts'
import { vendorStats } from '../../../core/domain/vendorStats'
import { formatDate, formatKwh, formatNtd, formatNtdRange, formatNumber, formatTons, nowIso } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection, useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import { matchSubsidies, SUBSIDY_CHECKED_DATE, SUBSIDY_DISCLAIMER } from '../../../core/subsidies'
import type { Case, CarbonInventory, Company, Factory, Need, Quote, Review, Role } from '../../../core/types'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CompanyAvatar,
  DemoBadge,
  EmptyState,
  FactProvenance,
  FactSourceBadge,
  PageHeader,
  RatingStars,
  SectionTitle,
  SkeletonList,
  Skeleton,
  SubsidyDialog,
  Tabs,
  cx,
  useToast,
  type ProvenanceItem,
} from '../../../ui'
import { CaseRow } from '../components/CaseRow'
import {
  ALL_TAB,
  bucketCounts,
  bucketsFor,
  byRecent,
  factoryBucket,
  factoryTodos,
  parseTab,
  vendorBucket,
  vendorInvolved,
} from '../lib/views'

interface Row {
  c: Case
  bucket: string | null
}

export default function Hub() {
  const { company, role } = useSession()
  const cases = useCollection('cases')
  const needs = useCollection('needs')
  const companies = useCollection('companies')
  const quotes = useCollection('quotes')
  const reviews = useCollection('reviews')
  const carbon = useCollection('carbon')

  if (company === undefined || cases === undefined || companies === undefined) {
    return (
      <>
        <PageHeader title="我的資料" />
        <SkeletonList rows={4} />
      </>
    )
  }

  if (!company || !role) {
    return (
      <>
        <PageHeader title="我的資料" />
        <EmptyState
          icon={<LogIn className="size-8" aria-hidden />}
          title="登入後才看得到你的案件"
          body="按右上角的「示範登入」選一家公司來體驗，或登錄你自己的公司。"
          action={<ButtonLink to={paths.register()}>登錄公司</ButtonLink>}
        />
      </>
    )
  }

  return (
    <HubBody
      company={company}
      role={role}
      cases={cases}
      needs={needs ?? []}
      companies={companies}
      quotes={quotes ?? []}
      reviews={reviews ?? []}
      carbon={carbon}
    />
  )
}

function HubBody({
  company,
  role,
  cases,
  needs,
  companies,
  quotes,
  reviews,
  carbon,
}: {
  company: Company
  role: Role
  cases: readonly Case[]
  needs: readonly Need[]
  companies: readonly Company[]
  quotes: readonly Quote[]
  reviews: readonly Review[]
  carbon: readonly CarbonInventory[] | undefined
}) {
  const store = useStore()
  const { readOnly } = useStoreInfo()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const rawTab = params.get('tab')
  const tab = role === 'vendor' && (rawTab === 'quoted_waiting' || rawTab === 'unselected') ? rawTab : parseTab(role, rawTab)
  const byId = useMemo(() => new Map(companies.map((c) => [c.id, c] as const)), [companies])

  const handleUpdateFacts =
    company.role === 'factory' && !readOnly
      ? async (updates: FactoryFactUpdates) => {
          await store.update('companies', company.id, buildFactoryFactPatch(company, updates, nowIso()))
          toast({ title: '已更新工廠數據並重算', tone: 'success' })
        }
      : undefined

  const rows: Row[] = useMemo(() => {
    const mine =
      role === 'factory'
        ? cases.filter((c) => c.factoryId === company.id)
        : cases.filter((c) => vendorInvolved(c, company.id))
    return [...mine]
      .sort(byRecent)
      .map((c) => ({ c, bucket: role === 'factory' ? factoryBucket(c) : vendorBucket(c, company.id, quotes) }))
  }, [cases, quotes, role, company.id])

  const buckets = bucketsFor(role)
  const counts = bucketCounts(
    buckets.map((b) => b.key),
    rows,
  )
  const isVendorQuotedWaiting = (c: Case) =>
    role === 'vendor' &&
    c.status === 'active' &&
    c.stage === 'quote' &&
    c.shortlist.includes(company.id) &&
    quotes.some((q) => q.caseId === c.id && q.vendorId === company.id)
  const isVendorUnselected = (c: Case) => role === 'vendor' && !!c.selectedVendorId && c.selectedVendorId !== company.id

  const quotedWaitingCount = rows.filter(({ c }) => isVendorQuotedWaiting(c)).length
  const unselectedCount = rows.filter(({ c }) => isVendorUnselected(c)).length

  const shown =
    tab === ALL_TAB
      ? rows
      : tab === 'quoted_waiting'
        ? rows.filter((r) => isVendorQuotedWaiting(r.c))
        : tab === 'unselected'
          ? rows.filter((r) => isVendorUnselected(r.c))
          : rows.filter((r) => r.bucket === tab)
  const isAllQuoted = (c: Case) =>
    c.status === 'active' &&
    c.stage === 'quote' &&
    c.shortlist.length > 0 &&
    c.shortlist.every((vid) => quotes.some((q) => q.caseId === c.id && q.vendorId === vid))
  const todos = useMemo(() => {
    if (role !== 'factory') return []
    const base = factoryTodos(rows.map((r) => r.c))
    const baseIds = new Set(base.map((c) => c.id))
    const quoteReady = rows.map((r) => r.c).filter((c) => !baseIds.has(c.id) && isAllQuoted(c))
    return [...quoteReady, ...base]
  }, [role, rows, quotes])
  const todoIds = new Set(todos.map((c) => c.id))

  const setTab = (key: string) => {
    const next = new URLSearchParams(params)
    if (key === ALL_TAB) next.delete('tab')
    else next.set('tab', key)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="我的資料"
        description={role === 'factory' ? '追蹤你的需求、案件進度與碳盤查。' : '追蹤被推薦、受邀與承接的案件。'}
        actions={
          role === 'factory' ? (
            <ButtonLink to={paths.newNeed()} icon={<Plus className="size-4" aria-hidden />}>
              登記新需求
            </ButtonLink>
          ) : (
            <ButtonLink to={paths.needs()} icon={<Search className="size-4" aria-hidden />}>
              瀏覽需求市集
            </ButtonLink>
          )
        }
      />

      <div className="flex flex-col gap-6">
        <ProfileCard company={company} />

        <nav aria-label="案件狀態" className={cx('grid gap-2', role === 'factory' ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-6')}>
          {buckets.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setTab(b.key)}
              aria-label={`${b.label} ${counts[b.key]} 件`}
              className={cx(
                'flex flex-col items-center gap-0.5 rounded-md border px-2 py-3 transition-colors',
                tab === b.key ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-brand',
              )}
            >
              <span className="font-mono text-xl font-bold tabular text-ink">{counts[b.key]}</span>
              <span className="text-sm text-ink-soft">{b.label}</span>
            </button>
          ))}
        </nav>
        {role === 'vendor' && (quotedWaitingCount > 0 || unselectedCount > 0) ? (
          <p className="rounded-sm bg-sunken px-3 py-2 text-xs text-ink-soft">
            全部共 <span className="font-mono font-bold text-ink">{counts[ALL_TAB]}</span> 件案件（含{' '}
            {quotedWaitingCount > 0 ? (
              <span>
                <strong className="text-brand-strong">{quotedWaitingCount} 件已提交報價・待工廠決定</strong>
              </span>
            ) : null}
            {quotedWaitingCount > 0 && unselectedCount > 0 ? '、' : null}
            {unselectedCount > 0 ? <span>{unselectedCount} 件未得標（由其他廠商承接）</span> : null}
            ，可於下方「全部」分頁查看明細與原始報價）。
          </p>
        ) : null}

        {role === 'factory' && company.role === 'factory' ? (
          <FactoryFactsCard
            factory={company}
            carbon={carbon}
            readOnly={readOnly}
            onUpdateFacts={handleUpdateFacts}
          />
        ) : null}
        {role === 'factory' ? (
          <CarbonCard
            factoryId={company.id}
            factory={company.role === 'factory' ? company : null}
            carbon={carbon}
            readOnly={readOnly}
            onUpdateFacts={handleUpdateFacts}
          />
        ) : null}
        {role === 'factory' && company.role === 'factory' ? (
          <MySubsidyCard
            factory={company}
            cases={rows.map((r) => r.c)}
            needs={needs}
            readOnly={readOnly}
            onUpdateFacts={handleUpdateFacts}
          />
        ) : null}

        {todos.length ? (
          <section className="flex flex-col gap-3" aria-label="待辦">
            <SectionTitle title="待你處理" hint="這些案件目前輪到工廠" />
            <ul className="flex flex-col gap-3">
              {todos.map((c) => (
                <CaseRow
                  key={c.id}
                  c={c}
                  viewer="factory"
                  companies={byId}
                  handlerOverride={isAllQuoted(c) ? '目前輪到工廠決定' : null}
                  statusBadge={isAllQuoted(c) ? { label: `${c.shortlist.length} 家已報價・待貴廠決定`, tone: 'warn' } : null}
                  prep={
                    isAllQuoted(c)
                      ? `${c.shortlist.length} 家受邀廠商皆已提交報價，請查看 AI 報價解說並選擇簽約廠商。`
                      : STAGE_BY_KEY[c.stage].factoryPrep
                  }
                />
              ))}
            </ul>
          </section>
        ) : null}

        <section className="flex flex-col gap-3" aria-label="案件列表">
          <SectionTitle title="我的案件" />
          <Tabs
            wrap
            label="案件分類"
            value={tab}
            onChange={setTab}
            items={[
              { key: ALL_TAB, label: '全部', count: counts[ALL_TAB] },
              ...buckets.map((b) => ({ key: b.key, label: b.label, count: counts[b.key] })),
              ...(role === 'vendor' && quotedWaitingCount > 0 ? [{ key: 'quoted_waiting', label: '已報價待決定', count: quotedWaitingCount }] : []),
              ...(role === 'vendor' && unselectedCount > 0 ? [{ key: 'unselected', label: '已結案／未得標', count: unselectedCount }] : []),
            ]}
          />
          {shown.length ? (
            <ul className="flex flex-col gap-3">
              {shown
                .filter((r) => !(role === 'factory' && tab === ALL_TAB && todoIds.has(r.c.id)))
                .map(({ c, bucket }) => {
                  const vendorQuotedWaiting =
                    role === 'vendor' &&
                    c.status === 'active' &&
                    c.stage === 'quote' &&
                    c.shortlist.includes(company.id) &&
                    quotes.some((q) => q.caseId === c.id && q.vendorId === company.id)
                  const vendorUnselected = role === 'vendor' && !!c.selectedVendorId && c.selectedVendorId !== company.id
                  const badge = vendorQuotedWaiting
                    ? ({ label: '已提交報價・待工廠決定', tone: 'brand' } as const)
                    : vendorUnselected
                      ? ({ label: '未得標（其他廠商承接）', tone: 'neutral' } as const)
                      : role === 'factory' && isAllQuoted(c)
                        ? ({ label: `${c.shortlist.length} 家已報價・待貴廠決定`, tone: 'warn' } as const)
                        : null
                  return (
                    <CaseRow
                      key={c.id}
                      c={c}
                      viewer={role}
                      companies={byId}
                      handlerOverride={
                        (role === 'factory' && isAllQuoted(c)) || vendorQuotedWaiting
                          ? '目前輪到工廠決定'
                          : vendorUnselected
                            ? '由得標廠商與工廠處理'
                            : null
                      }
                      statusBadge={badge}
                      reason={
                        role === 'vendor' && bucket === 'invited'
                          ? (c.recommendations.find((r) => r.vendorId === company.id)?.reasonText ?? null)
                          : null
                      }
                    />
                  )
                })}
            </ul>
          ) : (
            <EmptyState
              title={rows.length ? '這個分類目前沒有案件' : role === 'factory' ? '還沒有案件' : '還沒有被推薦的案件'}
              body={
                rows.length
                  ? '切換上方分類，或看「全部」。'
                  : role === 'factory'
                    ? '用一段話描述設備與問題，AI 幫你整理成需求表並推薦 2 家廠商。'
                    : '到需求市集看看工廠的需求，按「我有興趣」讓平台記得你。'
              }
              action={
                !rows.length ? (
                  role === 'factory' ? (
                    <ButtonLink to={paths.newNeed()}>登記新需求</ButtonLink>
                  ) : (
                    <ButtonLink to={paths.needs()}>瀏覽需求市集</ButtonLink>
                  )
                ) : undefined
              }
            />
          )}
        </section>

        {role === 'vendor' ? <ReviewSummary vendorId={company.id} reviews={reviews} /> : null}
      </div>
    </>
  )
}

function ProfileCard({ company }: { company: Company }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <CompanyAvatar name={company.name} id={company.id} size="lg" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-ink">{company.name}</h2>
            {company.isDemo ? <DemoBadge /> : null}
          </div>
          <p className="text-sm text-ink-soft">
            {company.role === 'factory' ? '工廠' : '節能廠商'}・{company.city}（{CITY_INFO[company.city].region}）
          </p>
        </div>
      </div>
      <ButtonLink to={paths.profile()} variant="secondary" size="sm" icon={<Pencil className="size-4" aria-hidden />}>
        {company.role === 'factory' ? '編輯工廠數據' : '編輯公司資料'}
      </ButtonLink>
    </Card>
  )
}

function FactoryFactsCard({
  factory,
  carbon,
  readOnly,
  onUpdateFacts,
}: {
  factory: Factory
  carbon: readonly CarbonInventory[] | undefined
  readOnly: boolean
  onUpdateFacts?: (updates: FactoryFactUpdates) => Promise<void>
}) {
  const inv = useMemo(() => (carbon ? latestInventory(carbon, factory.id) : null), [carbon, factory.id])
  const facts = useMemo(() => resolveFactoryFacts(factory, inv), [factory, inv])

  const provenanceItems: ProvenanceItem[] = [
    {
      key: 'monthlyKwh',
      label: facts.monthlyKwh.label,
      displayValue: facts.monthlyKwh.value != null ? formatKwh(facts.monthlyKwh.value) : '未填寫',
      source: facts.monthlyKwh.source,
      note: facts.monthlyKwh.note,
      editable: { factKey: 'monthlyKwh', initialValue: facts.monthlyKwh.value, unit: '度／月', placeholder: '例如 45000', min: 1 },
    },
    {
      key: 'monthlyElectricBillNtd',
      label: facts.monthlyElectricBillNtd.label,
      displayValue: facts.monthlyElectricBillNtd.value != null ? formatNtd(facts.monthlyElectricBillNtd.value) : '未填寫',
      source: facts.monthlyElectricBillNtd.source,
      note: facts.monthlyElectricBillNtd.note,
      editable: { factKey: 'monthlyElectricBillNtd', initialValue: facts.monthlyElectricBillNtd.value, unit: '元／月', placeholder: '例如 189000', min: 1 },
    },
    {
      key: 'avgElectricityPriceNtd',
      label: facts.avgElectricityPriceNtd.label,
      displayValue: `${facts.avgElectricityPriceNtd.value} 元／度`,
      source: facts.avgElectricityPriceNtd.source,
      note: facts.avgElectricityPriceNtd.note,
      editable: { factKey: 'avgElectricityPriceNtd', initialValue: facts.avgElectricityPriceNtd.value, unit: '元／度', placeholder: '例如 4.2', min: 0.1, max: 50 },
    },
    {
      key: 'contractKw',
      label: facts.contractKw.label,
      displayValue: facts.contractKw.value != null ? `${formatNumber(facts.contractKw.value)} kW` : '未填寫',
      source: facts.contractKw.source,
      note: facts.contractKw.note,
      editable: { factKey: 'contractKw', initialValue: facts.contractKw.value, unit: 'kW', placeholder: '例如 150', min: 1 },
    },
    {
      key: 'dailyHours',
      label: facts.dailyHours.label,
      displayValue: `${facts.dailyHours.value} 小時／日`,
      source: facts.dailyHours.source,
      note: facts.dailyHours.note,
      editable: { factKey: 'dailyHours', initialValue: facts.dailyHours.value, unit: '小時', placeholder: '例如 16', min: 1, max: 24 },
    },
    {
      key: 'annualDays',
      label: facts.annualDays.label,
      displayValue: `${facts.annualDays.value} 天／年`,
      source: facts.annualDays.source,
      note: facts.annualDays.note,
      editable: { factKey: 'annualDays', initialValue: facts.annualDays.value, unit: '天', placeholder: '例如 300', min: 1, max: 366 },
    },
    {
      key: 'equipment',
      label: facts.equipment.label,
      displayValue: formatEquipmentSummary(facts.equipment.value),
      source: facts.equipment.source,
      note: facts.equipment.note,
    },
  ]
  const summarySource = overallFactSource(provenanceItems.map((p) => p.source))

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="size-5 text-brand" aria-hidden />
          <h2 className="font-display text-base font-bold text-ink">我的工廠數據</h2>
          <FactSourceBadge source={summarySource} variant="derived" />
        </div>
        <Link to={paths.profile()} className="text-sm font-medium text-brand-strong hover:underline">
          前往完整編輯
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <span>月平均用電</span>
            <FactSourceBadge source={facts.monthlyKwh.source} variant="field" />
          </dt>
          <dd className="mt-0.5 font-mono text-base font-bold tabular text-ink">
            {facts.monthlyKwh.value != null ? formatKwh(facts.monthlyKwh.value) : '未填'}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <span>契約容量</span>
            <FactSourceBadge source={facts.contractKw.source} variant="field" />
          </dt>
          <dd className="mt-0.5 font-mono text-base font-bold tabular text-ink">
            {facts.contractKw.value != null ? `${formatNumber(facts.contractKw.value)} kW` : '未填'}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <span>平均電價</span>
            <FactSourceBadge source={facts.avgElectricityPriceNtd.source} variant="field" />
          </dt>
          <dd className="mt-0.5 font-mono text-base font-bold tabular text-ink">
            {facts.avgElectricityPriceNtd.value} 元／度
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <span>每日運轉（小時／日）</span>
            <FactSourceBadge source={facts.dailyHours.source} variant="field" />
          </dt>
          <dd className="mt-0.5 font-mono text-base font-bold tabular text-ink">{facts.dailyHours.value} 小時</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <span>年運轉天數（天／年）</span>
            <FactSourceBadge source={facts.annualDays.source} variant="field" />
          </dt>
          <dd className="mt-0.5 font-mono text-base font-bold tabular text-ink">{facts.annualDays.value} 天</dd>
        </div>
      </dl>
      <p className="text-xs text-ink-soft">主要設備：{formatEquipmentSummary(facts.equipment.value)}</p>
      <FactProvenance
        title="工廠數據明細與來源"
        items={provenanceItems}
        onApply={!readOnly ? onUpdateFacts : undefined}
        readOnly={readOnly}
        profileHref={paths.profile()}
      />
    </Card>
  )
}

function MySubsidyCard({
  factory,
  cases,
  needs,
  readOnly,
  onUpdateFacts,
}: {
  factory: Factory
  cases: readonly Case[]
  needs: readonly Need[]
  readOnly: boolean
  onUpdateFacts?: (updates: FactoryFactUpdates) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const needById = useMemo(() => new Map(needs.map((n) => [n.id, n] as const)), [needs])
  const activeCases = useMemo(() => cases.filter((c) => c.status === 'active'), [cases])

  const caseSummaries = useMemo(
    () =>
      activeCases.map((c) => ({
        c,
        summary: matchSubsidies({
          factory,
          need: needById.get(c.needId) ?? null,
          totalQuoteNtd: c.contractNtd ?? null,
          context: 'hub',
        }),
      })),
    [activeCases, factory, needById],
  )

  const fallbackSummary = useMemo(() => matchSubsidies({ factory, context: 'hub' }), [factory])

  let totalMin = 0
  let totalMax = 0
  let anyRelayed = false
  const deadlines: { caseId: string; caseTitle: string; label: string; dateText: string }[] = []
  for (const { c, summary } of caseSummaries) {
    if (summary.totalRange) {
      totalMin += summary.totalRange.min
      totalMax += summary.totalRange.max
      if (summary.usesRelayedRates) anyRelayed = true
    }
    if (summary.nearestDeadline) {
      deadlines.push({ caseId: c.id, caseTitle: c.title, ...summary.nearestDeadline })
    }
  }

  const dialogSummary = caseSummaries[0]?.summary ?? fallbackSummary

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <HandCoins className="size-5 text-brand" aria-hidden />
            <h2 className="font-display text-base font-bold text-ink">我的補助</h2>
            <FactSourceBadge source={dialogSummary.factSource} variant="derived" />
            {totalMax > 0 && anyRelayed ? <Badge tone="warn">經銷商參考區間</Badge> : null}
          </div>
          {totalMax > 0 ? (
            <span className="tabular font-mono text-base font-bold text-brand-strong">
              進行中案件估算 {formatNtdRange(totalMin, totalMax)}
            </span>
          ) : null}
        </div>
        {deadlines.length ? (
          <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
            {deadlines.slice(0, 3).map((d) => (
              <li key={d.caseId} className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <Link to={paths.case(d.caseId)} className="font-medium text-brand-strong hover:underline">
                    {d.caseTitle}
                  </Link>
                  ：{d.label}
                </span>
                <span className="text-xs text-muted">{d.dateText}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">
            登記設備改善需求後，平台會自動依設備功率、契約容量與報價金額試算可申請的政府補助與期限。
          </p>
        )}
        {dialogSummary.provenance.length ? (
          <FactProvenance
            title="補助試算用了哪些資料"
            items={dialogSummary.provenance}
            onApply={!readOnly ? onUpdateFacts : undefined}
            readOnly={readOnly}
            profileHref={paths.profile()}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-xs text-muted">
          <span>
            {SUBSIDY_DISCLAIMER}・查核日 {SUBSIDY_CHECKED_DATE}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            查看 7 項補助規則與來源
          </Button>
        </div>
      </Card>
      <SubsidyDialog open={open} onClose={() => setOpen(false)} summary={dialogSummary} />
    </>
  )
}

function CarbonCard({
  factoryId,
  factory,
  carbon,
  readOnly,
  onUpdateFacts,
}: {
  factoryId: string
  factory: Factory | null
  carbon: readonly CarbonInventory[] | undefined
  readOnly: boolean
  onUpdateFacts?: (updates: FactoryFactUpdates) => Promise<void>
}) {
  if (carbon === undefined) return <Skeleton className="h-28 w-full" />
  const inv = latestInventory(carbon, factoryId)
  if (!inv) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Leaf className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div>
            <h2 className="font-display text-base font-bold text-ink">碳盤查</h2>
            <p className="text-sm text-ink-soft">還沒有盤查資料。填入每月電費單與燃料用量，就能算出排放量。</p>
          </div>
        </div>
        <ButtonLink to={paths.carbonEntry()}>開始碳盤查</ButtonLink>
      </Card>
    )
  }
  const s = summarizeInventory(inv)
  const facts = resolveFactoryFacts(factory, inv)
  const annualCarbon = resolveAnnualCarbonSummary(inv, facts)
  const isMonthlyAverageFallback = annualCarbon.isMonthlyAverageFallback
  const displayAnnualTotalT = annualCarbon.displayTotalT
  const carbonItems: ProvenanceItem[] = [
    {
      key: 'filledMonths',
      label: `${annualCarbon.year} 年已填月份`,
      displayValue: `${annualCarbon.filledMonths}/12 月`,
      source: annualCarbon.filledMonths === 12 ? 'user' : 'estimate',
      note:
        annualCarbon.filledMonths === 12
          ? '依碳盤查逐月用電與燃料紀錄統計（12 個月已完整填寫）'
          : annualCarbon.estimatedMonths > 0
            ? `你填了 ${annualCarbon.filledMonths}/12 月；另有 ${annualCarbon.estimatedMonths} 個月是試算估計`
            : annualCarbon.filledMonths > 0
              ? `已填 ${annualCarbon.filledMonths}/12 月；尚未填滿 12 個月`
              : '尚未逐月輸入電費單，依月平均 × 12 估算',
    },
    {
      key: 'monthlyKwh',
      label: facts.monthlyKwh.label,
      displayValue: facts.monthlyKwh.value != null ? formatKwh(facts.monthlyKwh.value) : '未填寫',
      source: facts.monthlyKwh.source,
      note: facts.monthlyKwh.note,
      editable: { factKey: 'monthlyKwh', initialValue: facts.monthlyKwh.value, unit: '度／月', placeholder: '例如 45000', min: 1 },
    },
  ]
  const carbonSource = overallFactSource(carbonItems.map((p) => p.source))
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Leaf className="size-5 text-brand" aria-hidden />
          <h2 className="font-display text-base font-bold text-ink">{s.year} 年碳盤查</h2>
          <FactSourceBadge source={carbonSource} variant="derived" />
        </div>
        <Link to={paths.carbon()} className="text-sm font-medium text-brand-strong hover:underline">
          查看碳盤查
        </Link>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-sm text-muted">盤查進度</dt>
          <dd className="font-mono text-lg font-bold tabular text-ink">
            {s.stepsDone} / {s.stepsTotal}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{isMonthlyAverageFallback ? '年估算排放' : '累計排放'}</dt>
          <dd className="font-mono text-lg font-bold tabular text-ink">{formatTons(displayAnnualTotalT)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">已填月份</dt>
          <dd className="font-mono text-lg font-bold tabular text-ink">{s.filledMonths} / 12</dd>
        </div>
      </dl>
      <FactProvenance
        title="碳排摘要用了哪些資料"
        items={carbonItems}
        onApply={!readOnly ? onUpdateFacts : undefined}
        readOnly={readOnly}
        profileHref={paths.profile()}
      />
    </Card>
  )
}

function ReviewSummary({ vendorId, reviews }: { vendorId: string; reviews: readonly Review[] }) {
  const stats = vendorStats(vendorId, reviews)
  const recent = reviews
    .filter((r) => r.vendorId === vendorId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 3)
  return (
    <section className="flex flex-col gap-3" aria-label="我的評價">
      <SectionTitle title="我的評價" />
      {stats.count ? (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl font-bold tabular text-ink">{stats.avg?.toFixed(1)}</span>
            <RatingStars avg={stats.avg} count={stats.count} />
          </div>
          <ul className="flex flex-col gap-2">
            {recent.map((r) => (
              <li key={r.id} className="border-t border-line pt-2 text-sm">
                <span className="font-mono tabular text-ink">{r.rating} 顆星</span>
                <span className="ml-2 text-muted">{formatDate(r.createdAt)}</span>
                <p className="text-ink-soft">{r.comment}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="還沒有評價" body="案件驗收後，工廠可以留下評價，這裡會顯示平均與最近 3 則。" />
      )}
    </section>
  )
}
