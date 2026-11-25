import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Lock, LogIn } from 'lucide-react'
import { ELECTRICITY_FACTOR } from '../../../core/constants/carbon'
import { SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { STAGE_BY_KEY, STAGES } from '../../../core/constants/stages'
import { buildFactoryFactPatch } from '../../../core/domain/factoryFacts'
import { formatDateTime, formatKwh, formatNtd, nowIso } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection, useDoc, useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import { matchSubsidies } from '../../../core/subsidies'
import type { Case, CaseEvent, Company, Need, Quote, Review } from '../../../core/types'
import { Badge, ButtonLink, Card, DemoBadge, EmptyState, FeedbackNudge, PageHeader, SectionTitle, Skeleton, SkeletonList, StageBadge, SubsidyCard, SubsidyStageBanner, Tabs, useToast } from '../../../ui'
import { StageActions } from '../components/StageActions'
import { Timeline } from '../components/Timeline'
import { UsageCompare } from '../components/UsageCompare'
import { isError, transition, usageSaving, type Actor, type CaseAction, type UsageSaving } from '../lib/transitions'
import { elapsedText, latestFirst, mayView, visibleEventsForViewer } from '../lib/views'

export default function CaseTracker({ embedded = false }: { embedded?: boolean } = {}) {
  const { id } = useParams()
  const { company, role } = useSession()
  const c = useDoc('cases', id)
  const need = useDoc('needs', c?.needId ?? null)
  const companies = useCollection('companies')
  const events = useCollection('caseEvents')
  const quotes = useCollection('quotes')
  const reviews = useCollection('reviews')

  if (company === undefined || c === undefined || need === undefined || companies === undefined || events === undefined) {
    return (
      <>
        {!embedded ? <PageHeader title="案件進度" back={{ to: paths.me(), label: '回我的' }} /> : null}
        <Skeleton className="mb-4 h-32 w-full" />
        <SkeletonList rows={4} />
      </>
    )
  }
  if (!c) {
    return (
      <>
        {!embedded ? <PageHeader title="案件進度" back={{ to: paths.me(), label: '回我的' }} /> : null}
        <EmptyState title="找不到這個案件" body="連結可能有誤，或案件已被刪除。回「我的」看你的案件列表。" action={<ButtonLink to={paths.me()}>回我的</ButtonLink>} />
      </>
    )
  }
  if (!company || !role) {
    return (
      <>
        {!embedded ? <PageHeader title="案件進度" back={{ to: paths.home(), label: '回首頁' }} /> : null}
        <EmptyState
          icon={<LogIn className="size-8" aria-hidden />}
          title="登入後才能查看案件進度"
          body="案件只給該案件的工廠與被推薦的廠商看。按右上角「示範登入」，或登錄你的公司。"
          action={<ButtonLink to={paths.register()}>登錄公司</ButtonLink>}
        />
      </>
    )
  }
  if (!mayView(c, role, company.id)) {
    return (
      <>
        {!embedded ? <PageHeader title="案件進度" back={{ to: paths.me(), label: '回我的' }} /> : null}
        <EmptyState
          icon={<Lock className="size-8" aria-hidden />}
          title="你沒有權限查看這個案件"
          body="只有案件的工廠，以及被推薦、受邀或入選的廠商可以查看。"
          action={<ButtonLink to={paths.me()}>回我的</ButtonLink>}
        />
      </>
    )
  }
  const caseQuotes = (quotes ?? []).filter((q) => q.caseId === c.id)
  return (
    <Tracker
      c={c}
      need={need}
      viewer={{ role, id: company.id }}
      companies={companies}
      events={events.filter((e) => e.caseId === c.id)}
      caseQuotes={caseQuotes}
      quoteVendorIds={caseQuotes.map((q) => q.vendorId)}
      reviews={reviews ?? []}
      embedded={embedded}
    />
  )
}

function Tracker({
  c,
  need,
  viewer,
  companies,
  events,
  caseQuotes,
  quoteVendorIds,
  reviews,
  embedded,
}: {
  c: Case
  need: Need | null
  viewer: Actor
  companies: readonly Company[]
  events: readonly CaseEvent[]
  caseQuotes: readonly Quote[]
  quoteVendorIds: readonly string[]
  reviews: readonly Review[]
  embedded: boolean
}) {
  const store = useStore()
  const { readOnly } = useStoreInfo()
  const toast = useToast()
  const [sectionTab, setSectionTab] = useState<'progress' | 'subsidy'>('progress')
  const byId = useMemo(() => new Map(companies.map((x) => [x.id, x] as const)), [companies])
  const nameOf = (id: string) => byId.get(id)?.name ?? id
  const stage = STAGE_BY_KEY[c.stage]
  const factory = byId.get(c.factoryId)
  const completed = c.status === 'completed'
  const quotedVendorIds = useMemo(() => [...new Set(quoteVendorIds)], [quoteVendorIds])

  const run = async (action: CaseAction, after?: () => Promise<void>): Promise<boolean> => {
    const quotedIds = quotedVendorIds
    const r = transition(c, action, viewer, { quotedVendorIds: quotedIds, nameOf })
    if (isError(r)) {
      toast({ title: r.error, tone: 'error' })
      return false
    }
    try {
      await store.update('cases', c.id, r.patch)
      await store.set('caseEvents', { id: store.newId('ev'), ...r.event })
      if (after) await after()
      toast({ title: successText(action) })
      return true
    } catch (e) {
      toast({ title: '儲存失敗', body: e instanceof Error ? e.message : '請稍後再試。', tone: 'error' })
      return false
    }
  }

  const onReview = async (rating: number, comment: string) => {
    if (!c.selectedVendorId) return
    await store.set('reviews', {
      id: store.newId('rev'),
      caseId: c.id,
      vendorId: c.selectedVendorId,
      factoryId: c.factoryId,
      rating: rating as 1 | 2 | 3 | 4 | 5,
      comment: comment || '（未填寫文字）',
      createdAt: nowIso(),
    })
  }

  const saving: UsageSaving | null = useMemo(() => {
    const s = usageSaving(c.usage)
    if (s) return s
    if (c.baselineKwh && c.afterKwh != null) {
      const saved = c.baselineKwh - c.afterKwh
      return {
        beforeKwh: c.baselineKwh,
        afterKwh: c.afterKwh,
        savedKwh: saved,
        savedPct: (saved / c.baselineKwh) * 100,
        savedKgCo2e: saved * ELECTRICITY_FACTOR,
      }
    }
    return null
  }, [c.usage, c.baselineKwh, c.afterKwh])

  const showCompare = c.stage === 'compare' || completed
  const isFactory = viewer.role === 'factory'
  const isUnselectedVendor = viewer.role === 'vendor' && !!c.selectedVendorId && c.selectedVendorId !== viewer.id
  const visibleEvents = useMemo(() => visibleEventsForViewer(events, isUnselectedVendor), [events, isUnselectedVendor])
  const myQuote = viewer.role === 'vendor' ? (caseQuotes.find((q) => q.vendorId === viewer.id) ?? null) : null
  const allShortlistQuoted = c.stage === 'quote' && c.shortlist.length > 0 && quotedVendorIds.length >= c.shortlist.length
  const subsidySummary = useMemo(
    () =>
      matchSubsidies({
        factory: factory?.role === 'factory' ? factory : null,
        need,
        totalQuoteNtd: isUnselectedVendor ? null : (c.contractNtd ?? null),
        context: 'case',
      }),
    [factory, need, c.contractNtd, isUnselectedVendor],
  )

  return (
    <>
      {!embedded ? (
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              {c.title}
              {c.isDemo ? <DemoBadge /> : null}
            </span>
          }
          breadcrumbs={[{ label: '我的資料', to: paths.me() }, { label: c.title }]}
          back={{ to: paths.me(), label: '回我的' }}
          description={
            factory ? (
              <>
                工廠：
                <Link to={paths.factory(factory.id)} className="text-brand-strong hover:underline">
                  {factory.name}
                </Link>
              </>
            ) : undefined
          }
        />
      ) : null}

      <div className="flex flex-col gap-6">
        {!isUnselectedVendor ? (
          <div>
            <Tabs<'progress' | 'subsidy'>
              label="案件詳情分頁"
              value={sectionTab}
              onChange={setSectionTab}
              items={[
                { key: 'progress', label: '案件步驟與紀錄' },
                { key: 'subsidy', label: '政府補助' },
              ]}
            />
          </div>
        ) : null}

        {!isUnselectedVendor && sectionTab === 'subsidy' ? (
          <SubsidyCard
            summary={subsidySummary}
            readOnly={readOnly || !isFactory}
            onUpdateFacts={
              isFactory && factory?.role === 'factory' && !readOnly
                ? async (updates) => {
                    await store.update('companies', factory.id, buildFactoryFactPatch(factory, updates, nowIso()))
                    toast({ title: '已更新工廠數據並重算補助資格', tone: 'success' })
                  }
                : undefined
            }
            onSaveContractKw={
              isFactory && factory?.role === 'factory' && !readOnly
                ? (kw) => {
                    void store
                      .update('companies', factory.id, buildFactoryFactPatch(factory, { contractKw: kw }, nowIso()))
                      .then(
                        () => toast({ title: `已更新契約容量為 ${kw} kW 並重算補助資格`, tone: 'success' }),
                        () => toast({ title: '契約容量更新失敗', tone: 'error' }),
                      )
                  }
                : undefined
            }
          />
        ) : (
          <>
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={c.stage} completed={completed} />
            <span className="font-display font-bold text-ink">
              {completed ? '案件已完成' : `目前階段：${stage.label}（${stage.n} / ${STAGES.length}）`}
            </span>
          </div>
          {completed ? (
            <p className="text-ink-soft">用電比較已完成，完成時間 {formatDateTime(c.completedAt)}。</p>
          ) : (
            <>
              <p className="text-ink-soft">{stage.what}</p>
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted">負責</dt>
                  <dd className="text-ink">
                    {allShortlistQuoted ? `工廠（${quotedVendorIds.length} 家已報價，待比較決定）` : stage.ownerLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">預估時間</dt>
                  <dd className="text-ink">{stage.eta}</dd>
                </div>
                <div>
                  <dt className="text-muted">已進行</dt>
                  <dd className="text-ink">{elapsedText(c.stageStartedAt)}</dd>
                </div>
              </dl>
              {isFactory ? (
                <p className="rounded-sm bg-warn-soft px-3 py-2 text-sm text-warn">
                  下一步，工廠需準備：{stage.factoryPrep}
                  {allShortlistQuoted ? `（已有 ${quotedVendorIds.length} 家廠商完成報價，現在輪到貴廠比較報價並選擇簽約廠商！）` : ''}
                </p>
              ) : isUnselectedVendor ? (
                <p className="rounded-sm bg-sunken px-3 py-2 text-sm text-ink-soft">
                  工廠已於報價比較後選擇其他廠商承接本案，感謝參與場勘與報價。
                </p>
              ) : c.stage === 'assess' ? (
                <p className="rounded-sm bg-brand-soft px-3 py-2 text-sm text-brand-strong">
                  你已被平台推薦給工廠，等待工廠確認邀請場勘（每案最多推薦 2 家、無須競標）。
                </p>
              ) : c.stage === 'quote' && quotedVendorIds.includes(viewer.id) ? (
                <p className="rounded-sm bg-brand-soft px-3 py-2 text-sm text-brand-strong">
                  你已提交報價，目前等待工廠比較與決定（決定前仍可更新報價）。
                </p>
              ) : (
                <p className="rounded-sm bg-warn-soft px-3 py-2 text-sm text-warn">
                  下一步，你要做：{stage.vendorTodo}
                </p>
              )}
              {!isUnselectedVendor ? <SubsidyStageBanner stage={c.stage} summary={subsidySummary} /> : null}
            </>
          )}
          {isUnselectedVendor ? (
            <p className="text-sm text-muted">
              此案件已由工廠選定其他合作廠商承接；合約金額與施工排程僅對工廠與得標廠商公開。
            </p>
          ) : c.contractNtd ? (
            <p className="text-sm text-muted">
              合約金額 <span className="font-mono tabular text-ink">{formatNtd(c.contractNtd)}</span>
              {c.startDate ? `・開工 ${formatDateTime(c.startDate).slice(0, 10)}` : ''}
              {c.endDate ? `・完工 ${formatDateTime(c.endDate).slice(0, 10)}` : ''}
            </p>
          ) : null}
        </Card>

        {need ? (
          <Card className="flex flex-col gap-2.5 bg-sunken">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-ink">需求規格與工廠規模摘要</h2>
              <Link to={paths.need(need.id)} className="text-xs font-medium text-brand-strong hover:underline">
                查看完整需求與場勘提問 →
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {need.form.items.map((it, idx) => (
                <Badge key={idx} tone="navy">
                  {SPECIALTY_LABEL[it.equip]}
                  {it.quantity ? ` × ${it.quantity}` : ''}
                  {it.ratedKw ? `・單台 ${it.ratedKw} kW（約 ${Math.round(it.ratedKw / 0.746)} HP）` : ''}
                  {it.ageText ? `・${it.ageText}` : it.ageYears ? `・約 ${it.ageYears} 年` : ''}
                </Badge>
              ))}
              {factory?.role === 'factory' && factory.factory.contractKw ? (
                <Badge tone="neutral">契約容量 {factory.factory.contractKw} kW</Badge>
              ) : null}
              {factory?.role === 'factory' && factory.factory.monthlyKwh ? (
                <Badge tone="neutral">月均用電 {formatKwh(factory.factory.monthlyKwh)}</Badge>
              ) : null}
            </div>
            <p className="text-xs text-ink-soft">{need.rawText}</p>
          </Card>
        ) : null}

        {myQuote ? (
          <Card className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-bold text-ink">你已提交的報價內容</h2>
              <span className="text-xs text-muted">提交於 {formatDateTime(myQuote.submittedAt)}</span>
            </div>
            <p className="whitespace-pre-line rounded-sm bg-sunken p-3 text-xs text-ink-soft">{myQuote.rawText}</p>
          </Card>
        ) : null}

        <section aria-label="可執行的動作" className="flex flex-col gap-3">
          <SectionTitle title="你可以做的事" />
          <StageActions
            c={c}
            actor={viewer}
            readOnly={readOnly}
            companies={byId}
            quotedVendorIds={quotedVendorIds}
            reviews={reviews}
            run={run}
            onReview={onReview}
          />
        </section>

        {showCompare ? (
          <section aria-label="用電比較" className="flex flex-col gap-3">
            <SectionTitle title="用電比較" hint="節電百分比與估計減碳，依改善前後每月平均用電計算。" />
            <Card>
              <UsageCompare usage={c.usage ?? []} saving={saving} />
            </Card>
          </section>
        ) : null}

        <section aria-label="8 階段進度" className="flex flex-col gap-3">
          <SectionTitle title="8 階段進度" />
          <Card>
            <Timeline c={c} events={visibleEvents} isUnselectedVendor={isUnselectedVendor} />
          </Card>
        </section>

        <section aria-label="廠商" className="flex flex-col gap-3">
          <SectionTitle title="廠商" />
          <VendorBlock c={c} byId={byId} />
        </section>

        <section aria-label="活動紀錄" className="flex flex-col gap-3">
          <SectionTitle title="活動紀錄" />
          {visibleEvents.length ? (
            <Card>
              <ul className="flex flex-col divide-y divide-line">
                {latestFirst(visibleEvents).map((e) => (
                  <li key={e.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                      <span className="font-medium text-ink">
                        {e.actor === 'platform' ? '平台' : e.actor === 'factory' ? '工廠' : e.actorId ? nameOf(e.actorId) : '廠商'}
                      </span>
                      <span className="text-muted">{formatDateTime(e.at)}</span>
                    </div>
                    <p className="text-ink-soft">{e.text}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <EmptyState title="還沒有活動紀錄" body="每一步操作都會記在這裡，雙方都看得到。" />
          )}
        </section>

        {!embedded ? (
          <FeedbackNudge
            context="像追包裹一樣追蹤 8 個標準階段與申請時程，是否能減少雙方來回確認的時間？"
            nextStep={isFactory ? { to: paths.carbon(), label: '看工廠碳盤查' } : { to: paths.needs(), label: '逛需求市集' }}
          />
        ) : null}
          </>
        )}
      </div>
    </>
  )
}

function VendorBlock({ c, byId }: { c: Case; byId: ReadonlyMap<string, Company> }) {
  const selected = c.selectedVendorId ? byId.get(c.selectedVendorId) : null
  if (!c.recommendations.length && !selected) {
    return <EmptyState title="尚未推薦廠商" body="需求送出後，平台會在 1–2 個工作天內推薦 2 家廠商。" />
  }
  return (
    <div className="flex flex-col gap-3">
      {selected ? (
        <Card className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-muted">入選廠商</p>
            <Link to={paths.vendor(selected.id)} className="font-display font-bold text-brand-strong hover:underline">
              {selected.name}
            </Link>
          </div>
        </Card>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {c.recommendations.map((r) => {
          const v = byId.get(r.vendorId)
          return (
            <li key={r.vendorId}>
              <Card className="h-full">
                <p className="text-sm text-muted">推薦 {r.rank}</p>
                <Link to={paths.vendor(r.vendorId)} className="font-display font-bold text-brand-strong hover:underline">
                  {v?.name ?? r.vendorId}
                </Link>
                <p className="mt-1 text-sm text-ink-soft">{r.reasonText}</p>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function successText(a: CaseAction): string {
  switch (a.type) {
    case 'schedule_survey':
      return '已預約場勘時間'
    case 'finish_survey':
      return '已回報場勘完成'
    case 'submit_quote':
      return '已提交報價'
    case 'select_vendor':
      return '已選擇廠商，進入簽約'
    case 'sign_contract':
      return '已完成簽約'
    case 'report_progress':
      return '已回報進度'
    case 'finish_construction':
      return '已回報完工'
    case 'accept':
      return '已驗收通過'
    case 'review':
      return '已送出評價'
    case 'add_usage':
      return '已登錄用電'
    case 'complete_compare':
      return '已完成用電比較'
  }
}
