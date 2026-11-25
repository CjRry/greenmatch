import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Link } from 'react-router'
import { CalendarCheck, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { stageIndex } from '../../../core/constants/stages'
import { DEFAULT_WEIGHTS, FACTOR_KEYS, FACTOR_LABEL, itemLabel, rankVendors, sameIndustrySummary } from '../../../core/domain/matching'
import { formatNumber, nowIso } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection, useDoc, useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import { matchSubsidies } from '../../../core/subsidies'
import { resolveFactoryFacts } from '../../../core/domain/factoryFacts'
import { PUBLIC_CASES } from '../../../data/publicCases'
import type { Company, FactorKey, Recommendation, Vendor } from '../../../core/types'
import { Badge, Button, ButtonLink, Card, CompanyAvatar, CompressorHonestSection, ConfirmDialog, DemoBadge, EmptyState, FeedbackNudge, PageHeader, RatingStars, ScoreBar, SimilarCasePayback, SkeletonList, SpecialtyChips, SubsidySummaryBar, VendorSubsidyBadge, cx, useToast } from '../../../ui'
import { vendorStats } from '../../../core/domain/vendorStats'

type WeightPresetKey = 'balanced' | 'distance' | 'track' | 'rating' | 'custom'

const WEIGHT_PRESETS: readonly { key: Exclude<WeightPresetKey, 'custom'>; label: string; weights: Record<FactorKey, number> }[] = [
  { key: 'balanced', label: '標準均衡', weights: DEFAULT_WEIGHTS },
  { key: 'distance', label: '距離最近', weights: { specialty: 0.25, distance: 0.45, track: 0.12, rating: 0.1, scale: 0.08 } },
  { key: 'track', label: '實績最多', weights: { specialty: 0.25, distance: 0.1, track: 0.45, rating: 0.12, scale: 0.08 } },
  { key: 'rating', label: '評價最高', weights: { specialty: 0.25, distance: 0.1, track: 0.15, rating: 0.42, scale: 0.08 } },
]

export default function MatchResult({ embedded = false }: { embedded?: boolean } = {}) {
  const { id = '' } = useParams()
  const { company, role } = useSession()
  const { readOnly } = useStoreInfo()
  const store = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const c = useDoc('cases', id)
  const need = useDoc('needs', c?.needId ?? null)
  const factory = useDoc('companies', c?.factoryId ?? null)
  const companies = useCollection('companies')
  const reviews = useCollection('reviews')
  const cases = useCollection('cases')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [savingWeights, setSavingWeights] = useState(false)
  const [preset, setPreset] = useState<WeightPresetKey>('balanced')
  const [weights, setWeights] = useState<Record<FactorKey, number>>({ ...DEFAULT_WEIGHTS })
  const [weightsCustomized, setWeightsCustomized] = useState(false)
  const [slidersOpen, setSlidersOpen] = useState(false)
  const saved = useRef(false)

  const isOwner = company?.role === 'factory' && c?.factoryId === company.id
  const atAssess = c ? stageIndex(c.stage) <= stageIndex('assess') : false

  // An assess case with no stored recommendations gets them computed and saved once.
  useEffect(() => {
    if (saved.current || readOnly || !isOwner || !atAssess) return
    if (!c || !need || !factory || factory.role !== 'factory' || !companies || !reviews || !cases) return
    if (c.recommendations.length) return
    saved.current = true
    const recs = rankVendors(need, factory, companies, reviews, undefined, cases)
    store.update('cases', c.id, { recommendations: recs, updatedAt: nowIso() }).catch(() => {
      saved.current = false
      toast({ title: '推薦結果沒有儲存，重新整理頁面後會再計算一次', tone: 'error' })
    })
  }, [c, need, factory, companies, reviews, cases, isOwner, atAssess, readOnly, store, toast])

  const liveRecs = useMemo(() => {
    if (!weightsCustomized || !need || !factory || factory.role !== 'factory' || !companies || !reviews) return null
    return rankVendors(need, factory, companies, reviews, weights, cases ?? [])
  }, [weightsCustomized, need, factory, companies, reviews, weights, cases])

  if (c === undefined || need === undefined || factory === undefined || companies === undefined || reviews === undefined || company === undefined) {
    return (
      <>
        {!embedded ? <PageHeader title="推薦廠商" /> : null}
        <SkeletonList rows={2} />
      </>
    )
  }
  if (!c) {
    return (
      <>
        {!embedded ? <PageHeader title="推薦廠商" back={{ to: paths.me(), label: '回我的工作台' }} /> : null}
        <EmptyState title="找不到這個案件" body="連結可能已失效。請回工作台，從案件列表重新進入。" action={<ButtonLink to={paths.me()}>回工作台</ButtonLink>} />
      </>
    )
  }

  const storedRecs: Recommendation[] =
    c.recommendations.length || !need || !factory || factory.role !== 'factory'
      ? [...c.recommendations]
      : rankVendors(need, factory, companies, reviews, undefined, cases ?? [])
  const recs: Recommendation[] = [...(liveRecs ?? storedRecs)].sort((a, b) => a.rank - b.rank)

  const relatedVendor = company?.role === 'vendor' && (c.shortlist.includes(company.id) || recs.some((r) => r.vendorId === company.id))
  if (!company || !(isOwner || relatedVendor)) {
    return (
      <>
        {!embedded ? <PageHeader title="推薦廠商" back={{ to: paths.me(), label: '回我的工作台' }} /> : null}
        <EmptyState
          title={role ? '這個案件不是你的' : '請先登入'}
          body={role ? '推薦結果只有案件的工廠與被推薦的廠商看得到。' : '點右上角的「示範登入」，選擇這個案件的工廠。'}
          action={<ButtonLink to={paths.home()}>回首頁</ButtonLink>}
        />
      </>
    )
  }

  const facts = resolveFactoryFacts(factory?.role === 'factory' ? factory : null)

  const vendorOf = (vid: string): Vendor | undefined => {
    const v: Company | undefined = companies.find((x) => x.id === vid)
    return v?.role === 'vendor' ? v : undefined
  }
  const nameOf = (vid: string) => vendorOf(vid)?.name ?? '（已移除的廠商）'
  const canInvite = isOwner && atAssess && c.stage === 'assess' && recs.length > 0 && !readOnly

  const applyPreset = (key: Exclude<WeightPresetKey, 'custom'>) => {
    const found = WEIGHT_PRESETS.find((p) => p.key === key)!
    setPreset(key)
    setWeights({ ...found.weights })
    setWeightsCustomized(key !== 'balanced')
  }

  const updateFactorWeight = (k: FactorKey, pct: number) => {
    setPreset('custom')
    setWeights((cur) => ({ ...cur, [k]: pct / 100 }))
    setWeightsCustomized(true)
  }

  const resetWeights = () => {
    setPreset('balanced')
    setWeights({ ...DEFAULT_WEIGHTS })
    setWeightsCustomized(false)
  }

  const saveCustomRecs = async () => {
    if (!liveRecs || !isOwner || !atAssess || readOnly) return
    setSavingWeights(true)
    try {
      await store.update('cases', c.id, { recommendations: liveRecs, updatedAt: nowIso() })
      setWeightsCustomized(false)
      toast({ title: '已套用並儲存最新推薦排序', tone: 'success' })
    } catch {
      toast({ title: '儲存排序失敗，請稍後再試', tone: 'error' })
    } finally {
      setSavingWeights(false)
    }
  }

  const invite = async () => {
    setBusy(true)
    try {
      const now = nowIso()
      const ids = recs.map((r) => r.vendorId)
      await store.update('cases', c.id, {
        ...(weightsCustomized ? { recommendations: recs } : {}),
        shortlist: ids,
        stage: 'survey',
        stageStartedAt: now,
        updatedAt: now,
      })
      if (need) await store.update('needs', need.id, { status: 'matched', updatedAt: now })
      await store.set('caseEvents', {
        id: store.newId('ev'),
        caseId: c.id,
        stage: 'assess',
        kind: 'stage_done',
        actor: 'platform',
        actorId: null,
        text: `平台推薦 ${ids.map(nameOf).join('、')}，工廠邀請${ids.length > 1 ? '兩家' : '這家'}場勘`,
        at: now,
      })
      toast({ title: '已邀請場勘', body: '廠商會收到通知並與你約場勘時間', tone: 'success' })
      navigate(paths.case(c.id))
    } catch {
      toast({ title: '邀請沒有成功，資料未變更，請再按一次', tone: 'error' })
      setBusy(false)
      setConfirmOpen(false)
    }
  }

  const readonlyNote = !atAssess ? '案件已進入場勘之後的階段，以下是當時平台的推薦結果。' : null

  return (
    <>
      {!embedded ? (
        <PageHeader
          title="推薦廠商"
          description="平台依 5 項條件算出最適合的 2 家，附上理由。"
          breadcrumbs={[{ label: '我的資料', to: paths.me() }, { label: c.title, to: paths.case(c.id) }, { label: '推薦廠商' }]}
          back={{ to: paths.case(c.id), label: '回案件進度' }}
          actions={
            canInvite ? (
              <Button icon={<CalendarCheck className="size-4" aria-hidden />} onClick={() => setConfirmOpen(true)}>
                邀請這 {recs.length} 家場勘
              </Button>
            ) : null
          }
        />
      ) : canInvite ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand bg-brand-soft px-4 py-3">
          <span className="text-sm font-medium text-brand-strong">確認以下 2 家推薦廠商後，即可一鍵邀請場勘。</span>
          <Button icon={<CalendarCheck className="size-4" aria-hidden />} onClick={() => setConfirmOpen(true)}>
            邀請這 {recs.length} 家場勘
          </Button>
        </div>
      ) : null}

      <section className="mb-4 rounded-md border border-line bg-sunken px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-bold text-ink">{need?.title ?? c.title}</h2>
          {need?.isDemo ? <DemoBadge /> : null}
          {need ? (
            <span className="text-sm text-ink-soft">
              {need.form.items
                .map((it) => `${itemLabel(it.equip)}${it.quantity ? ` ${it.quantity} 台` : ''}${it.ageText ? `（${it.ageText}）` : ''}`)
                .join('、')}
            </span>
          ) : null}
        </div>
        {need?.form.mainProblems.length ? <p className="mt-1 text-xs text-muted">主要問題：{need.form.mainProblems.join('、')}</p> : null}
      </section>

      {readonlyNote ? <p className="mb-4 rounded-sm bg-sunken px-3 py-2 text-sm text-ink-soft">{readonlyNote}</p> : null}
      {!isOwner ? <p className="mb-4 rounded-sm bg-sunken px-3 py-2 text-sm text-ink-soft">你以廠商身分唯讀查看，只有工廠本人可以邀請場勘。</p> : null}

      {recs.length === 0 ? (
        <EmptyState title="目前沒有符合的廠商" body="平台會由專人協助媒合，有進展時案件進度會更新。你也可以到廠商名錄自行查看。" action={<ButtonLink to={paths.vendors()}>瀏覽廠商名錄</ButtonLink>} />
      ) : (
        <>
          {recs.length === 1 ? <p className="mb-3 rounded-sm bg-warn-soft px-3 py-2 text-sm text-warn">目前僅 1 家符合，平台將人工協助。</p> : null}
          <div className="grid gap-4 md:grid-cols-2">
            {recs.map((r) => {
              const v = vendorOf(r.vendorId)
              const st = vendorStats(r.vendorId, reviews)
              return (
                <Card key={r.vendorId} className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    {v ? <CompanyAvatar name={v.name} id={v.id} /> : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="navy">推薦第 {r.rank} 名</Badge>
                        {v && factory?.role === 'factory' ? (() => {
                          const same = sameIndustrySummary(v, factory.factory.industry, companies ?? [], cases ?? [])
                          return same.hasExperience ? (
                            <Badge tone="brand">
                              {same.caseCount > 0
                                ? `同業實績：${factory.factory.industry}（${same.caseCount} 件）`
                                : `曾服務${factory.factory.industry}`}
                            </Badge>
                          ) : null
                        })() : null}
                        {v?.vendor.assistsSubsidy ? <VendorSubsidyBadge /> : null}
                        {v?.isDemo ? <DemoBadge /> : null}
                      </div>
                      <h3 className="mt-1 break-words font-display text-lg font-bold text-ink">
                        {v ? (
                          <Link to={paths.vendor(v.id)} className="hover:text-brand">
                            {v.name}
                          </Link>
                        ) : (
                          nameOf(r.vendorId)
                        )}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="tabular font-mono text-3xl font-bold text-brand-strong">{formatNumber(r.score, 1)}</div>
                      <div className="text-xs text-muted">推薦分數 / 100</div>
                    </div>
                  </div>
                  <p className="rounded-sm bg-brand-soft px-3 py-2 font-medium text-brand-strong">推薦理由：{r.reasonText}</p>
                  <div className="flex flex-col gap-3">
                    {FACTOR_KEYS.map((k) => {
                      const f = r.factors[k]
                      return <ScoreBar key={k} label={`${FACTOR_LABEL[k]}（權重 ${Math.round(f.w * 100)}%）`} value={f.s} detail={f.detail} />
                    })}
                  </div>
                  {v ? (
                    <div className="flex flex-col gap-2 border-t border-line pt-3 text-sm text-ink-soft">
                      <SpecialtyChips items={v.vendor.specialties} max={4} />
                      {factory?.role === 'factory' ? (() => {
                        const same = sameIndustrySummary(v, factory.factory.industry, companies ?? [], cases ?? [])
                        return same.matchedPortfolio.length > 0 ? (
                          <p className="text-xs font-medium text-brand-strong">
                            同業案例：
                            {same.matchedPortfolio
                              .slice(0, 2)
                              .map((p) => `${p.title}${p.savingPct ? `（節電 ${p.savingPct}%）` : ''}`)
                              .join('、')}
                          </p>
                        ) : null
                      })() : null}
                      <p>
                        {v.city} ・ 完成 {v.vendor.completedCases} 件 ・ 約 {v.vendor.responseHours} 小時內回覆
                      </p>
                      <RatingStars avg={st.count ? st.avg : null} count={st.count} />
                      <Link to={paths.vendor(v.id)} className="w-fit text-brand-strong underline underline-offset-2">
                        查看廠商資料
                      </Link>
                    </div>
                  ) : null}
                </Card>
              )
            })}
          </div>
        </>
      )}

      {need && factory?.role === 'factory' ? (
        <details className="mt-5 rounded-md border border-line bg-surface p-4" aria-label="媒合偏好與權重調整">
          <summary className="cursor-pointer font-display text-sm font-bold text-ink">
            媒合偏好切換與推薦分數說明（預設均衡權重・點開可調整重算）
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">
                {atAssess ? '選擇貴廠最重視的條件或微調權重，結果會即時重排。' : '目前案件已過初步評估階段，仍可在此試算不同權重下的模擬排序。'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {weightsCustomized ? (
                  <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" aria-hidden />} onClick={resetWeights}>
                    重設標準權重
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<SlidersHorizontal className="size-3.5" aria-hidden />}
                  onClick={() => setSlidersOpen((v) => !v)}
                >
                  {slidersOpen ? '收合自訂權重' : '微調 5 項權重'}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="媒合偏好預設">
              {WEIGHT_PRESETS.map((p) => {
                const active = preset === p.key
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyPreset(p.key)}
                    className={cx(
                      'rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'border-brand bg-brand text-on-brand'
                        : 'border-line-strong bg-surface text-ink-soft hover:border-brand hover:text-ink',
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            {slidersOpen ? (
              <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-5">
                {FACTOR_KEYS.map((k) => {
                  const rawSum = FACTOR_KEYS.reduce((s, key) => s + weights[key], 0) || 1
                  const normPct = Math.round((weights[k] / rawSum) * 100)
                  const sliderVal = Math.round(weights[k] * 100)
                  return (
                    <label key={k} className="flex flex-col gap-1 text-xs">
                      <span className="flex items-center justify-between text-ink-soft">
                        <span>{FACTOR_LABEL[k]}</span>
                        <span className="tabular font-mono font-semibold text-ink">{normPct}%</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        step={5}
                        value={sliderVal}
                        aria-label={`${FACTOR_LABEL[k]}權重`}
                        onChange={(e) => updateFactorWeight(k, Number(e.target.value))}
                        className="accent-brand"
                      />
                    </label>
                  )
                })}
              </div>
            ) : null}

            {weightsCustomized ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-brand-soft px-3 py-2 text-xs text-brand-strong">
                <span>已依自訂權重即時重算推薦排序。</span>
                {isOwner && atAssess && !readOnly ? (
                  <Button size="sm" busy={savingWeights} onClick={() => void saveCustomRecs()}>
                    套用此排序並儲存
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="border-t border-line pt-3 text-xs text-muted">
              <p className="font-mono text-ink">推薦分數 = Σ（項目權重 × 項目得分）</p>
              <p className="mt-1">
                標準權重：{FACTOR_KEYS.map((k) => `${FACTOR_LABEL[k]} ${Math.round(DEFAULT_WEIGHTS[k] * 100)}%`).join('、')}。
                平台不收廣告費買榜，每案只推薦 2 家避免削價競標。
              </p>
            </div>
          </div>
        </details>
      ) : null}

      {need ? (
        <div className="mt-4">
          <SubsidySummaryBar
            summary={matchSubsidies({ factory: factory?.role === 'factory' ? factory : null, need, context: 'match' })}
          />
        </div>
      ) : null}

      {need && isOwner ? (
        <div className="mt-4 flex flex-col gap-4">
          {need.form.items.some((i) => i.equip === 'air_compressor') ? (
            <CompressorHonestSection
              cases={PUBLIC_CASES}
              electricityRate={facts.avgElectricityPriceNtd.value}
              rateSource={facts.avgElectricityPriceNtd.source}
              optionalInputs={{ dailyHours: facts.dailyHours.value }}
            />
          ) : null}
          <SimilarCasePayback
            equips={need.form.items.map((i) => i.equip)}
            electricityRate={facts.avgElectricityPriceNtd.value}
            rateSource={facts.avgElectricityPriceNtd.source}
            cases={PUBLIC_CASES}
            allCasesTo={paths.publicCases()}
          />
        </div>
      ) : null}

      {!embedded ? (
        <div className="mt-5">
          <FeedbackNudge
            context="看過推薦的 2 家廠商與政府補助試算後，覺得這樣的呈現清楚嗎？"
            nextStep={c.id === 'c01' ? { to: paths.caseQuotes('c01'), label: '下一步：看報價比價' } : undefined}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="邀請這 2 家場勘？"
        body={`案件會進入「場勘」階段，並通知 ${recs.map((r) => nameOf(r.vendorId)).join('、')} 與你約場勘時間。`}
        confirmLabel="邀請場勘"
        busy={busy}
        onConfirm={() => void invite()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
