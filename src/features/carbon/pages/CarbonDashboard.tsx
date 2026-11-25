import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Calculator, Check, Factory, Leaf, Pencil, RotateCcw } from 'lucide-react'
import { useCollection, useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import { useSession } from '../../../core/session'
import { paths } from '../../../core/paths'
import { getCheckupCarbonBridge } from '../../../core/billDraft'
import { applyEstimatedMonthlyKwh, emptyInventory, monthsUpToToday, summarizeInventory } from '../../../core/domain/carbon'
import {
  buildFactoryFactPatch,
  overallFactSource,
  resolveAnnualCarbonSummary,
  resolveFactoryFacts,
  type FactoryFactUpdates,
} from '../../../core/domain/factoryFacts'
import { CARBON_FEE_NOTE, ELECTRICITY_FACTOR, ELECTRICITY_FACTOR_NOTE, FUEL_FACTOR_NOTE, INV_STEPS } from '../../../core/constants/carbon'
import { EQUIPS, EQUIP_INFO } from '../../../core/constants/equipment'
import { formatDate, formatKwh, formatNtd, formatNumber, formatPct, formatTons, nowIso } from '../../../core/format'
import { matchSubsidies, taipeiToday } from '../../../core/subsidies'
import type { CarbonInventory, Equip, Factory as FactoryDoc, InvStep, StepState } from '../../../core/types'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DemoBadge,
  EmptyState,
  FactProvenance,
  FactSourceBadge,
  FeedbackNudge,
  Field,
  PageHeader,
  SectionTitle,
  Skeleton,
  Stat,
  SubsidyCard,
  Tabs,
  TextInput,
  useToast,
  type ProvenanceItem,
} from '../../../ui'
import MonthlyChart, { type ChartMetric } from '../charts/MonthlyChart'
import { EntryForm } from '../components/EntryForm'
import { compareSamePeriod } from '../lib/compare'
import { computeHotspots } from '../lib/hotspots'
import {
  computeQuickCarbon,
  DEFAULT_ELECTRICITY_PRICE_NTD,
  initialQuickInput,
  normalizedShareEntries,
  sameShares,
  type QuickCarbonInput,
  type QuickInputMode,
} from '../lib/quickCalc'

const STATE_LABEL: Record<StepState, string> = { todo: '未開始', doing: '進行中', done: '已完成' }
const STATES: readonly StepState[] = ['todo', 'doing', 'done']
const START_YEAR = 2026

export default function CarbonDashboard() {
  const { company, role } = useSession()
  const all = useCollection('carbon')

  const header = <PageHeader title="碳盤查" description="看懂工廠一年排放多少、熱點在哪、盤查做到哪一步。" />

  if (company === undefined || all === undefined) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="載入中">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }
  const guestBridge = !company ? getCheckupCarbonBridge() : null
  if (!company && guestBridge) {
    return <GuestCarbonBridge bridge={guestBridge} header={header} />
  }
  if (role !== 'factory' || !company || company.role !== 'factory') {
    return (
      <>
        {header}
        <EmptyState
          icon={<Factory className="size-8" aria-hidden />}
          title="碳盤查只提供給工廠"
          body="請用工廠身分登入，或先到「電費單健檢」試算年度用電後直接帶入本頁計算範疇二碳排。"
          action={
            !company ? (
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink to={paths.billCheckup()} size="sm">
                  先做電費單健檢
                </ButtonLink>
                <ButtonLink to={`${paths.register('factory')}&mode=quick`} variant="secondary" size="sm">
                  建立空白工廠帳號
                </ButtonLink>
              </div>
            ) : undefined
          }
        />
      </>
    )
  }
  const mine = all.filter((c) => c.factoryId === company.id).sort((a, b) => b.year - a.year)
  return <Dashboard factory={company} inventories={mine} header={header} />
}

/** Unauthenticated Scope 2 carbon calculator prefilled from the browser's Bill Checkup draft. */
function GuestCarbonBridge({
  bridge,
  header,
}: {
  bridge: NonNullable<ReturnType<typeof getCheckupCarbonBridge>>
  header: ReactNode
}) {
  const [annualKwhDraft, setAnnualKwhDraft] = useState(() => String(bridge.annualKwh))
  const parsedAnnualKwh = Number(annualKwhDraft.replaceAll(',', ''))
  const effectiveAnnualKwh = Number.isFinite(parsedAnnualKwh) && parsedAnnualKwh > 0 ? Math.round(parsedAnnualKwh) : bridge.annualKwh
  const scope2Tons = Math.round(((effectiveAnnualKwh * ELECTRICITY_FACTOR) / 1000) * 10) / 10
  const isEditedFromDraft = effectiveAnnualKwh !== bridge.annualKwh
  const carbonSubsidies = useMemo(() => matchSubsidies({ factory: null, context: 'carbon' }), [])

  return (
    <div className="flex flex-col gap-6">
      {header}
      <Card className="flex flex-col gap-4 border-brand-200 bg-brand-50/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">你填的</Badge>
            <span className="text-sm font-semibold text-ink">已從電費單健檢帶入用電推估（無須登入即可試算）</span>
          </div>
          <ButtonLink to={paths.billCheckup()} variant="ghost" size="sm">
            回電費單健檢修改
          </ButtonLink>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="推估年用電量" value={formatKwh(effectiveAnnualKwh)} note={isEditedFromDraft ? '手動調整年用電量' : '依電費單健檢年化'} />
          <Stat label="範疇二電力碳排（年）" value={formatTons(scope2Tons)} note={`× ${ELECTRICITY_FACTOR} kgCO2e/度`} tone="brand" />
          <Stat
            label="平均每度電價"
            value={bridge.avgPriceNtd != null ? `${bridge.avgPriceNtd} 元/度` : '—'}
            note={bridge.latestContractKw != null ? `目前契約容量 ${bridge.latestContractKw} kW` : '可在健檢補填契約容量'}
          />
          <Stat label="碳費門檻參考" value={scope2Tons >= 25_000 ? '達 2.5 萬噸課徵門檻' : '未達直接課徵門檻'} note="供應鏈買家仍常要求揭露" />
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,260px)_1fr] md:items-end">
          <Field label="試算年用電量（度／年）" hint={ELECTRICITY_FACTOR_NOTE}>
            {(inputProps) => (
              <TextInput
                {...inputProps}
                inputMode="numeric"
                value={annualKwhDraft}
                onChange={(e) => setAnnualKwhDraft(e.target.value)}
                aria-label="試算年用電量（度／年）"
              />
            )}
          </Field>
          <p className="text-xs leading-relaxed text-ink-3">{CARBON_FEE_NOTE}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <ButtonLink to={`${paths.register('factory')}&mode=quick`} size="sm">
            建檔永久保存 12 個月碳清冊
          </ButtonLink>
          <span className="text-xs text-ink-3">建檔後可補填柴油／天然氣範疇一燃料與設備耗電熱點。</span>
        </div>
      </Card>

      <SubsidyCard title="碳盤查與減碳補助參考" summary={carbonSubsidies} showProfileHint={false} readOnly />
    </div>
  )
}

function Dashboard({ factory, inventories, header }: { factory: FactoryDoc; inventories: CarbonInventory[]; header: ReactNode }) {
  const factoryId = factory.id
  const store = useStore()
  const { readOnly } = useStoreInfo()
  const toast = useToast()
  const navigate = useNavigate()
  const [pickedYear, setPickedYear] = useState<number | null>(null)
  const [viewTab, setViewTab] = useState<'overview' | 'entry' | 'guide'>('overview')
  const [metric, setMetric] = useState<ChartMetric>('emission')
  const [savingStep, setSavingStep] = useState<InvStep | null>(null)
  const [applyingCalc, setApplyingCalc] = useState(false)
  const carbonSubsidies = useMemo(() => matchSubsidies({ factory, context: 'carbon' }), [factory])

  const inv = inventories.find((i) => i.year === pickedYear) ?? inventories[0] ?? null
  const facts = useMemo(() => resolveFactoryFacts(factory, inv), [factory, inv])
  const summary = useMemo(() => (inv ? summarizeInventory(inv) : null), [inv])
  const prev = inv ? inventories.find((i) => i.year === inv.year - 1) : undefined
  const comparison = useMemo(() => (summary ? compareSamePeriod(summary, prev ? summarizeInventory(prev) : null) : null), [summary, prev])

  const [calcOverrides, setCalcOverrides] = useState<Record<string, QuickCarbonInput>>({})
  const factoryEquips = useMemo(() => facts.equipment.value.map((e) => e.type), [facts.equipment.value])
  const baseCalc = useMemo(
    () =>
      inv
        ? {
            ...initialQuickInput(inv, facts.monthlyKwh.value, facts.avgElectricityPriceNtd.value, factoryEquips),
            annualScope1T: Math.round((summary?.scope1T ?? 0) * 10) / 10,
          }
        : null,
    [inv, facts.monthlyKwh.value, facts.avgElectricityPriceNtd.value, summary?.scope1T, factoryEquips],
  )
  // Sliders only for equipment the factory has (plus any already in the shares); all types when none listed.
  const sliderEquips = useMemo(() => {
    const listed = EQUIPS.filter((e) => factoryEquips.includes(e) || (inv?.electricityShare ?? []).some((s) => s.equip === e))
    return listed.length > 0 ? listed : EQUIPS
  }, [factoryEquips, inv?.electricityShare])
  const calcInput = inv ? (calcOverrides[inv.id] ?? baseCalc!) : null
  const calcResult = useMemo(() => (calcInput ? computeQuickCarbon(calcInput) : null), [calcInput])

  const handleUpdateFacts = async (updates: FactoryFactUpdates) => {
    await store.update('companies', factory.id, buildFactoryFactPatch(factory, updates, nowIso()))
    if (inv && (updates.monthlyKwh !== undefined || updates.avgElectricityPriceNtd !== undefined)) {
      setCalcOverrides((cur) => {
        if (!(inv.id in cur)) return cur
        const next = { ...cur }
        delete next[inv.id]
        return next
      })
    }
    toast({ title: '已更新工廠數據並重算碳排與補助', tone: 'success' })
  }

  const patchCalc = (patch: Partial<QuickCarbonInput>) => {
    if (!inv || !calcInput) return
    setCalcOverrides((cur) => ({ ...cur, [inv.id]: { ...calcInput, ...patch } }))
  }
  const patchShare = (equip: Equip, val: number) => {
    if (!calcInput) return
    patchCalc({ shares: { ...calcInput.shares, [equip]: val } })
  }

  async function applyQuickCalcToInventory() {
    if (!inv || !calcInput || !calcResult || readOnly) return
    const fillable = monthsUpToToday(inv.year, taipeiToday())
    const sharesTouched = baseCalc != null && !sameShares(calcInput.shares, baseCalc.shares)
    const nextShares = normalizedShareEntries(calcInput.shares)
    if (fillable.length === 0 && !sharesTouched) {
      toast({ title: `${inv.year} 年還沒開始，沒有可以填入估算的月份`, body: '到了那一年再套用，或直接在下方表格填電費單上的度數。', tone: 'info' })
      return
    }
    setApplyingCalc(true)
    try {
      const kwh = Math.round(calcResult.monthlyKwh)
      const patch: Parameters<typeof store.update<'carbon'>>[2] = {
        months: applyEstimatedMonthlyKwh(inv.months, kwh, fillable),
        updatedAt: nowIso(),
      }
      if (nextShares.length > 0) {
        patch.electricityShare = nextShares
        // Only a slider the factory actually moved makes the split theirs; an untouched even split stays an estimate.
        patch.electricityShareSource = sharesTouched ? 'user' : (inv.electricityShareSource ?? 'estimate')
      }
      if (inv.steps.activity === 'todo') patch.steps = { activity: 'doing' }
      await store.update('carbon', inv.id, patch)
      const range = fillable.length > 0 ? `${fillable[0]}–${fillable[fillable.length - 1]} 月` : null
      toast({
        title: `已把試算套用到 ${inv.year} 年盤查（標為估算）`,
        body: range
          ? `${range}還沒填的月份先以每月 ${formatKwh(kwh)} 估算；你自己填過的月份不變。拿到電費單後請改成實際度數。`
          : '已更新設備用電占比。',
        tone: 'success',
      })
    } catch {
      toast({ title: '套用試算失敗，請稍後再試', tone: 'error' })
    } finally {
      setApplyingCalc(false)
    }
  }

  async function startInventory() {
    try {
      await store.set('carbon', emptyInventory(factoryId, START_YEAR, nowIso()))
      navigate(paths.carbonEntry())
    } catch {
      toast({ title: '無法建立盤查', body: '資料沒有寫入，請稍後再試一次。', tone: 'error' })
    }
  }

  async function setStep(key: InvStep, state: StepState) {
    if (!inv || inv.steps[key] === state) return
    setSavingStep(key)
    try {
      await store.update('carbon', inv.id, { steps: { [key]: state }, updatedAt: nowIso() })
    } catch {
      toast({ title: '無法更新進度', body: '這一步的狀態沒有儲存，請再點一次。', tone: 'error' })
    } finally {
      setSavingStep(null)
    }
  }

  if (!inv || !summary) {
    return (
      <>
        {header}
        <EmptyState
          icon={<Leaf className="size-8" aria-hidden />}
          title="還沒有任何盤查資料"
          body={`先建立 ${START_YEAR} 年的盤查，再逐月填入電費單的用電度數與燃料用量，系統會幫你算出排放量。`}
          action={
            <Button onClick={startInventory} disabled={readOnly}>
              開始 {START_YEAR} 年盤查
            </Button>
          }
        />
      </>
    )
  }

  const hotspots = computeHotspots(summary.scope2T, inv.electricityShare)
  const annualCarbon = resolveAnnualCarbonSummary(inv, facts)
  const isMonthlyAverageFallback = annualCarbon.isMonthlyAverageFallback
  const displayAnnualKwh = annualCarbon.displayAnnualKwh
  const displayScope2T = annualCarbon.displayScope2T
  const displayTotalT = annualCarbon.displayTotalT

  const carbonTotalProvenance: ProvenanceItem[] = [
    {
      key: 'filledMonths',
      label: `${inv.year} 年已填月份`,
      displayValue: `${summary.filledMonths}/12 月（${formatKwh(summary.totalKwh)}）`,
      source: summary.filledMonths === 12 ? 'user' : 'estimate',
      note:
        summary.filledMonths === 12
          ? '依碳盤查逐月電費與燃料資料計算（12 個月已完整填寫）'
          : summary.estimatedMonths > 0
            ? `你填了 ${summary.filledMonths}/12 月；另有 ${summary.estimatedMonths} 個月是「套用試算」的估算，不是電費單上的數字`
            : summary.filledMonths > 0
              ? `已填 ${summary.filledMonths}/12 月；尚未填滿 12 個月，累計尚未涵蓋全年`
              : '尚未逐月輸入電費單，依月平均 × 12 估算',
    },
    {
      key: 'monthlyKwh',
      label: facts.monthlyKwh.label,
      displayValue: facts.monthlyKwh.value != null ? formatKwh(facts.monthlyKwh.value) : '未填寫',
      source: facts.monthlyKwh.source,
      note: facts.monthlyKwh.note,
      editable: {
        factKey: 'monthlyKwh',
        initialValue: facts.monthlyKwh.value,
        unit: '度／月',
        placeholder: '例如 45000',
        min: 1,
      },
    },
    {
      key: 'avgElectricityPriceNtd',
      label: facts.avgElectricityPriceNtd.label,
      displayValue: `${facts.avgElectricityPriceNtd.value} 元／度`,
      source: facts.avgElectricityPriceNtd.source,
      note: facts.avgElectricityPriceNtd.note,
      editable: {
        factKey: 'avgElectricityPriceNtd',
        initialValue: facts.avgElectricityPriceNtd.value,
        unit: '元／度',
        placeholder: '例如 4.2',
        min: 0.1,
        max: 50,
      },
    },
  ]
  const carbonTotalSource = overallFactSource(carbonTotalProvenance.map((p) => p.source))
  const hasUserShares = Boolean(inv.electricityShare && inv.electricityShare.length > 0 && inv.electricityShareSource === 'user')
  const hotspotProvenance: ProvenanceItem[] = [
    {
      key: 'electricityShare',
      label: '設備用電占比',
      displayValue: inv.electricityShare?.length ? `已設定 ${inv.electricityShare.length} 項` : '尚未設定',
      source: hasUserShares ? 'user' : 'estimate',
      note: hasUserShares
        ? '依貴廠於碳盤查頁面調整並套用之設備用電占比分配範疇二'
        : inv.electricityShare?.length
          ? '目前為快速建立平均分配或未標註來源之估算占比，請於上方試算滑桿或明細表調整確認'
          : '尚未設定各設備用電占比，先以平台製造業常見比例估算',
    },
    {
      key: 'equipment',
      label: facts.equipment.label,
      displayValue: facts.equipment.value.length > 0 ? `${facts.equipment.value.length} 項設備` : '未填寫',
      source: facts.equipment.source,
      note: facts.equipment.note,
    },
    carbonTotalProvenance[1],
  ]
  const hotspotSource = overallFactSource(hotspotProvenance.map((p) => p.source))
  const currentStep = INV_STEPS.find((s) => inv.steps[s.key] !== 'done')
  const actions = (
    <>
      <Button
        variant={viewTab === 'entry' ? 'primary' : 'secondary'}
        icon={<Pencil className="size-4" aria-hidden />}
        onClick={() => setViewTab((v) => (v === 'entry' ? 'overview' : 'entry'))}
      >
        {viewTab === 'entry' ? '回到總覽' : '填寫數據'}
      </Button>
      <ButtonLink to={paths.billCheckup()} variant="secondary">
        電費單健檢
      </ButtonLink>
    </>
  )

  return (
    <>
      <PageHeader title="碳盤查" description="看懂工廠一年排放多少、熱點在哪、盤查做到哪一步，並可直接於「填數據」輸入或試算。" actions={actions} />
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {inventories.length > 1 ? (
              <div className="min-w-0">
                <Tabs
                  label="盤查年度"
                  value={String(inv.year)}
                  onChange={(k) => setPickedYear(Number(k))}
                  items={inventories.map((i) => ({ key: String(i.year), label: `${i.year} 年` }))}
                />
              </div>
            ) : (
              <Badge tone="navy">{inv.year} 年</Badge>
            )}
            {inv.isDemo ? <DemoBadge /> : null}
            <span className="text-sm text-muted">更新於 {formatDate(inv.updatedAt)}</span>
          </div>
          <Tabs<'overview' | 'entry' | 'guide'>
            label="碳盤查視圖"
            value={viewTab}
            onChange={setViewTab}
            items={[
              { key: 'overview', label: '總覽' },
              { key: 'entry', label: '填數據' },
              { key: 'guide', label: '看懂碳盤查' },
            ]}
          />
        </div>

        {viewTab === 'overview' ? (
          <>
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink">年度排放總量摘要</span>
            <FactSourceBadge source={carbonTotalSource} variant="derived" />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="範疇一（燃料）" value={formatNumber(summary.scope1T, 1)} unit="tCO2e" tone="navy" />
            <Stat
              label={isMonthlyAverageFallback ? '範疇二（估算）' : '範疇二（用電）'}
              value={formatNumber(displayScope2T, 1)}
              unit="tCO2e"
              tone="brand"
            />
            <Stat label={isMonthlyAverageFallback ? '全年推估合計' : '合計'} value={formatNumber(displayTotalT, 1)} unit="tCO2e" />
            <Stat
              label="已填月份"
              value={`${summary.filledMonths}/12`}
              unit="月"
              note={
                isMonthlyAverageFallback
                  ? `估算全年用電 ${formatKwh(displayAnnualKwh)}`
                  : summary.estimatedMonths > 0
                    ? `另 ${summary.estimatedMonths} 個月為試算估計`
                    : `全年用電 ${formatKwh(summary.totalKwh)}`
              }
            />
          </div>
          {summary.estimatedMonths > 0 ? (
            <p className="mt-3 rounded-sm bg-warn-soft px-3 py-2 text-xs text-ink">
              範疇二含 {summary.estimatedMonths} 個月的試算估計（每月約{' '}
              <span className="font-mono font-semibold tabular">
                {formatKwh(summary.months.find((m) => m.estimated)?.kwh ?? 0)}
              </span>
              ），不是電費單上的數字。拿到電費單後，到「填數據」分頁的表格改成實際度數。
            </p>
          ) : null}
          {isMonthlyAverageFallback ? (
            <p className="mt-3 rounded-sm bg-sunken px-3 py-2 text-xs text-ink-soft">
              已填 0/12 月；依{facts.monthlyKwh.source === 'user' ? '你給的' : '估算的'}月平均估算全年約{' '}
              <span className="font-mono font-semibold text-ink">{formatTons(displayTotalT)}</span>（欲改成實際逐月電費，請至「填數據」分頁）。
            </p>
          ) : null}
          {comparison ? (
            <p className="mt-4 border-t border-line pt-3 text-sm text-ink-soft">
              同期比較（{comparison.months[0]}–{comparison.months[comparison.months.length - 1]} 月）：{inv.year} 年{' '}
              <span className="tabular font-mono">{formatTons(comparison.currentT)}</span>，{comparison.prevYear} 年{' '}
              <span className="tabular font-mono">{formatTons(comparison.prevT)}</span>
              {comparison.changePct == null
                ? '。'
                : comparison.changePct === 0
                  ? '，兩年相同。'
                  : `，${comparison.changePct < 0 ? '減少' : '增加'} ${formatPct(Math.abs(comparison.changePct), 1)}。`}
            </p>
          ) : null}
          <FactProvenance
            className="mt-4"
            title="碳排總量用了哪些資料"
            items={carbonTotalProvenance}
            onApply={!readOnly ? handleUpdateFacts : undefined}
            readOnly={readOnly}
            profileHref={paths.profile()}
          />
        </Card>

        <section className="flex flex-col gap-3">
          <SectionTitle
            title="每月排放"
            action={
              <Tabs
                label="圖表內容"
                value={metric}
                onChange={setMetric}
                items={[
                  { key: 'emission', label: '排放量' },
                  { key: 'kwh', label: '用電度數' },
                ]}
              />
            }
          />
          {summary.filledMonths === 0 && summary.estimatedMonths === 0 ? (
            <EmptyState
              title="這一年還沒有月份資料"
              body="到「填數據」分頁輸入每月用電度數或使用試算器套用，圖表就會出現。"
              action={
                <Button variant="secondary" onClick={() => setViewTab('entry')}>
                  前往「填數據」
                </Button>
              }
            />
          ) : (
            <>
              <MonthlyChart months={summary.months} metric={metric} />
              {summary.estimatedMonths > 0 ? (
                <p className="text-xs text-muted">
                  其中 {summary.months.filter((m) => m.estimated).map((m) => `${m.m}`).join('、')} 月是試算估計。
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle title="排放熱點" hint="依你設定的用電占比，把範疇二分配到各設備" />
            <FactSourceBadge source={hotspotSource} variant="derived" />
          </div>
          <FactProvenance
            title="排放熱點用了哪些資料"
            items={hotspotProvenance}
            onApply={!readOnly ? handleUpdateFacts : undefined}
            readOnly={readOnly}
            profileHref={paths.profile()}
          />
          {hotspots.length === 0 ? (
            <EmptyState
              title="尚未設定設備用電占比"
              body="為了不以平台猜測取代貴廠實況，請至「填數據」分頁調整設備用電占比或輸入明細，即可查看排放熱點。"
              action={
                <Button variant="secondary" onClick={() => setViewTab('entry')}>
                  前往「填數據」設定
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {hotspots.map((h) => (
                <li key={h.equip} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-medium text-ink">{h.label}</span>
                    <span className="tabular font-mono text-sm text-ink-soft">
                      {formatTons(h.tons)}・{formatPct(h.pct * 100)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-sm bg-sunken" role="img" aria-label={`${h.label}占範疇二 ${formatPct(h.pct * 100)}`}>
                    <div className="h-full rounded-sm bg-brand" style={{ width: `${Math.max(h.pct * 100, 1)}%` }} />
                  </div>
                  <ButtonLink to={`${paths.newNeed()}?equip=${h.equip}`} variant="ghost" size="sm" className="w-fit">
                    針對這項設備登記節能需求
                  </ButtonLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle title="盤查進度" hint={`已完成 ${summary.stepsDone}/${summary.stepsTotal} 步`} />
          <ol className="flex flex-col gap-3">
            {INV_STEPS.map((s) => {
              const state = inv.steps[s.key]
              const isCurrent = currentStep?.key === s.key
              return (
                <li key={s.key} className="rounded-md border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={
                          state === 'done'
                            ? 'tabular flex size-7 shrink-0 items-center justify-center rounded-sm bg-brand font-mono text-sm text-on-brand'
                            : 'tabular flex size-7 shrink-0 items-center justify-center rounded-sm bg-sunken font-mono text-sm text-ink-soft'
                        }
                      >
                        {state === 'done' ? <Check className="size-4" aria-hidden /> : s.n}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                          {s.label}
                          <Badge tone={state === 'done' ? 'brand' : state === 'doing' ? 'warn' : 'neutral'}>{STATE_LABEL[state]}</Badge>
                          {isCurrent ? <Badge tone="navy">目前在這一步</Badge> : null}
                        </p>
                        <p className="text-sm text-muted">{s.what}</p>
                      </div>
                    </div>
                    <div role="group" aria-label={`${s.label}狀態`} className="flex gap-1">
                      {STATES.map((st) => (
                        <Button
                          key={st}
                          size="sm"
                          variant={state === st ? 'navy' : 'secondary'}
                          aria-pressed={state === st}
                          disabled={readOnly || savingStep === s.key}
                          onClick={() => setStep(s.key, st)}
                        >
                          {STATE_LABEL[st]}
                        </Button>
                      ))}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <FeedbackNudge context="用電費單算出範疇二排放、直接找出耗電設備熱點，對貴廠準備碳盤查有幫助嗎？" />
          </>
        ) : null}

        {viewTab === 'entry' ? (
          <>
            {calcInput && calcResult ? (
              <Card className="flex flex-col gap-4 border-brand bg-sunken" aria-label="碳排與電費即時試算器">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
                      <Calculator className="size-4 text-brand-strong" aria-hidden />
                      即時碳排與電費試算器（直接調整，立刻重算）
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      不用先填 12 個月大表格：輸入平均每月用電度數或電費金額、自訂電價／係數與設備占比滑桿，立即看年排放與設備熱點，滿意後可一鍵套用。
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {calcOverrides[inv.id] ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<RotateCcw className="size-3.5" aria-hidden />}
                        onClick={() =>
                          setCalcOverrides((cur) => {
                            const copy = { ...cur }
                            delete copy[inv.id]
                            return copy
                          })
                        }
                      >
                        重設為目前盤查值
                      </Button>
                    ) : null}
                    <Button size="sm" busy={applyingCalc} disabled={readOnly} onClick={() => void applyQuickCalcToInventory()}>
                      以估算填入 {inv.year} 年空白月份
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Tabs<QuickInputMode>
                    label="用電輸入方式"
                    value={calcInput.mode}
                    onChange={(mode) => patchCalc({ mode })}
                    items={[
                      { key: 'kwh', label: '依每月用電度數' },
                      { key: 'bill', label: '依每月電費金額（自動換算度數）' },
                    ]}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {calcInput.mode === 'kwh' ? (
                    <Field label="平均每月用電（度）">
                      {(p) => (
                        <TextInput
                          {...p}
                          inputMode="numeric"
                          value={String(calcInput.monthlyKwh)}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            patchCalc({ monthlyKwh: Number.isFinite(n) && n >= 0 ? n : 0 })
                          }}
                          className="tabular font-mono"
                        />
                      )}
                    </Field>
                  ) : (
                    <Field label="平均每月電費（元）" hint={`約換算 ${formatKwh(calcResult.monthlyKwh)}／月`}>
                      {(p) => (
                        <TextInput
                          {...p}
                          inputMode="numeric"
                          value={String(calcInput.monthlyBillNtd)}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            patchCalc({ monthlyBillNtd: Number.isFinite(n) && n >= 0 ? n : 0 })
                          }}
                          className="tabular font-mono"
                        />
                      )}
                    </Field>
                  )}
                  <Field
                    label="自訂平均電價（元／度）"
                    hint={`目前帶入 ${facts.avgElectricityPriceNtd.value} 元（平台預設 ${DEFAULT_ELECTRICITY_PRICE_NTD} 元）`}
                  >
                    {(p) => (
                      <TextInput
                        {...p}
                        inputMode="decimal"
                        value={String(calcInput.electricityPrice)}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          patchCalc({
                            electricityPrice:
                              Number.isFinite(n) && n > 0 ? n : facts.avgElectricityPriceNtd.value || DEFAULT_ELECTRICITY_PRICE_NTD,
                          })
                        }}
                        className="tabular font-mono"
                      />
                    )}
                  </Field>
                  <Field label="自訂電力排放係數（kgCO2e／度）" hint={`經濟部預設 ${ELECTRICITY_FACTOR}`}>
                    {(p) => (
                      <TextInput
                        {...p}
                        inputMode="decimal"
                        value={String(calcInput.emissionFactor)}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          patchCalc({ emissionFactor: Number.isFinite(n) && n > 0 ? n : ELECTRICITY_FACTOR })
                        }}
                        className="tabular font-mono"
                      />
                    )}
                  </Field>
                  <Field label="年燃料範疇一（tCO2e）">
                    {(p) => (
                      <TextInput
                        {...p}
                        inputMode="decimal"
                        value={String(calcInput.annualScope1T)}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          patchCalc({ annualScope1T: Number.isFinite(n) && n >= 0 ? n : 0 })
                        }}
                        className="tabular font-mono"
                      />
                    )}
                  </Field>
                </div>

                <div className="flex flex-col gap-2 border-t border-line pt-3">
                  <p className="text-xs font-medium text-ink">設備用電占比滑桿（即時分配範疇二熱點）</p>
                  <p className="text-xs text-ink-soft">
                    {factoryEquips.length > 0
                      ? '只列出工廠數據裡有的設備，起始為平均分配（估算）；拉動滑桿後套用，占比才算你填的。'
                      : '工廠數據還沒有設備清單，所以占比是空的。拉動滑桿設定，或先到「工廠數據」填設備。'}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    {sliderEquips.map((eq) => {
                      const val = calcInput.shares[eq] ?? 0
                      const hotspot = calcResult.hotspots.find((h) => h.equip === eq)
                      return (
                        <label key={eq} className="flex flex-col gap-1 text-xs">
                          <span className="flex items-center justify-between gap-1 text-ink-soft">
                            <span>{EQUIP_INFO[eq].label}</span>
                            <span className="tabular font-mono font-semibold text-ink">
                              {hotspot ? formatPct(hotspot.pct * 100, 0) : '0%'}
                            </span>
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={val}
                            aria-label={`${EQUIP_INFO[eq].label}用電占比`}
                            onChange={(e) => patchShare(eq, Number(e.target.value))}
                            className="accent-brand"
                          />
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-surface p-3.5 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted">試算範疇一</p>
                    <p className="tabular font-mono text-lg font-bold text-navy">{formatTons(calcResult.scope1T)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">試算範疇二</p>
                    <p className="tabular font-mono text-lg font-bold text-brand-strong">{formatTons(calcResult.scope2T)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">試算年總排放</p>
                    <p className="tabular font-mono text-lg font-bold text-ink">{formatTons(calcResult.totalT)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">預估年電費／碳費參考</p>
                    <p className="tabular font-mono text-sm font-semibold text-ink">
                      {formatNtd(calcResult.annualBillNtd)}
                    </p>
                    <p className="text-[11px] text-muted">
                      {calcResult.aboveFeeThreshold
                        ? `達 2.5 萬噸課徵門檻（參考約 ${formatNtd(calcResult.estimatedCarbonFeeNtd)}）`
                        : `未達 2.5 萬噸強制門檻（影子成本參考約 ${formatNtd(calcResult.estimatedCarbonFeeNtd)}）`}
                    </p>
                  </div>
                </div>
              </Card>
            ) : null}
            <Card>
              <EntryForm key={`${inv.id}-${inv.updatedAt}`} inv={inv} onSaved={() => setViewTab('overview')} />
            </Card>
          </>
        ) : null}

        {viewTab === 'guide' ? (
          <>
            <section className="flex flex-col gap-3">
              <SectionTitle title="看懂碳盤查" />
              <div className="grid gap-3 md:grid-cols-2">
                <Card className="flex flex-col gap-2 text-sm text-ink-soft">
                  <h3 className="font-display font-bold text-ink">什麼是範疇一、範疇二</h3>
                  <p>
                    <strong className="text-ink">範疇一</strong>是工廠自己燃燒燃料產生的排放，例如鍋爐用的天然氣、堆高機的柴油、公務車的汽油。
                  </p>
                  <p>
                    <strong className="text-ink">範疇二</strong>是買來的電產生的排放。電是發電廠燒出來的，但電費單上的度數算在用電的你身上。
                  </p>
                  <p>多數中小製造廠的排放以範疇二為主，所以先從電費單開始最快。</p>
                </Card>
                <Card className="flex flex-col gap-2 text-sm text-ink-soft">
                  <h3 className="font-display font-bold text-ink">排放量怎麼算</h3>
                  <p>排放量 ＝ 活動數據 × 排放係數。</p>
                  <p>{ELECTRICITY_FACTOR_NOTE}</p>
                  <p>{FUEL_FACTOR_NOTE}</p>
                </Card>
                <Card className="flex flex-col gap-2 text-sm text-ink-soft md:col-span-2">
                  <h3 className="font-display font-bold text-ink">碳費跟我有關嗎</h3>
                  <p>{CARBON_FEE_NOTE}</p>
                </Card>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <SectionTitle title="政府輔導與減碳工具" hint="盤查與查證可申請政府補助或免費工具" />
              <SubsidyCard
                summary={carbonSubsidies}
                title="碳盤查政府輔導與工具"
                readOnly={readOnly}
                onUpdateFacts={!readOnly ? handleUpdateFacts : undefined}
              />
            </section>
          </>
        ) : null}
      </div>
    </>
  )
}

