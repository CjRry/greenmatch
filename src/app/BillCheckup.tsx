import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Leaf,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { clearBillDraft, loadBillDraft, saveBillDraft } from '../core/billDraft'
import {
  analyzeBillCheckup,
  type BillPeriodInput,
  type ContractHealthStatus,
  type PowerFactorStatus,
} from '../core/domain/billCheckup'
import { buildFactoryFactPatch, resolveFactoryFacts } from '../core/domain/factoryFacts'
import { DEFAULT_ROI_RATE_NTD } from '../core/domain/roi'
import { formatKwh, formatNtd, formatNumber, formatPct, formatTons, nowIso } from '../core/format'
import { paths } from '../core/paths'
import { useSession } from '../core/session'
import { useStore, useStoreInfo } from '../core/store/StoreProvider'
import { matchSubsidies } from '../core/subsidies'
import type { Factory, Need } from '../core/types'
import { PUBLIC_CASES } from '../data/publicCases'
import {
  BILL_INDUSTRY_DISCOUNT_CAVEAT,
  INDUSTRY_EMISSION_FACTOR,
  TARIFF_CHECKED_DATE,
  TARIFF_PLAN_OPTIONS,
  TARIFF_PLANS,
  TARIFF_SOURCES,
  type SeasonKind,
  type TariffPlanId,
} from '../data/taipowerTariffs'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CompressorHonestSection,
  Field,
  PageHeader,
  SectionTitle,
  Select,
  Stat,
  SubsidyCard,
  TextInput,
  useToast,
  type BadgeTone,
} from '../ui'

interface DraftPeriod {
  id: string
  label: string
  season: SeasonKind
  contractKw: string
  maxDemandKw: string
  powerFactorPct: string
  totalKwh: string
  peakKwh: string
  semiPeakKwh: string
  satSemiPeakKwh: string
  offPeakKwh: string
  billAmountNtd: string
}

function emptyDraftPeriod(index: number): DraftPeriod {
  return {
    id: `p-${Date.now()}-${index}`,
    label: index === 0 ? '最近一期' : `第 ${index + 1} 期`,
    season: 'summer',
    contractKw: '',
    maxDemandKw: '',
    powerFactorPct: '',
    totalKwh: '',
    peakKwh: '',
    semiPeakKwh: '',
    satSemiPeakKwh: '',
    offPeakKwh: '',
    billAmountNtd: '',
  }
}

function demoSampleDraft(): { planId: TariffPlanId; periods: DraftPeriod[] } {
  return {
    planId: 'hv_2stage',
    periods: [
      {
        id: 'sample-1',
        label: '2026-08（夏月示範）',
        season: 'summer',
        contractKw: '200',
        maxDemandKw: '235',
        powerFactorPct: '74',
        totalKwh: '80000',
        peakKwh: '48000',
        semiPeakKwh: '',
        satSemiPeakKwh: '6000',
        offPeakKwh: '26000',
        billAmountNtd: '419006',
      },
    ],
  }
}

function numOrNull(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function toInput(d: DraftPeriod): BillPeriodInput {
  return {
    label: d.label.trim() || '未命名期別',
    season: d.season,
    contractKw: numOrNull(d.contractKw),
    maxDemandKw: numOrNull(d.maxDemandKw),
    powerFactorPct: numOrNull(d.powerFactorPct),
    totalKwh: numOrNull(d.totalKwh),
    peakKwh: numOrNull(d.peakKwh),
    semiPeakKwh: numOrNull(d.semiPeakKwh),
    satSemiPeakKwh: numOrNull(d.satSemiPeakKwh),
    offPeakKwh: numOrNull(d.offPeakKwh),
    billAmountNtd: numOrNull(d.billAmountNtd),
  }
}

const CONTRACT_BADGE: Record<ContractHealthStatus, { label: string; tone: BadgeTone }> = {
  over_contract: { label: '已超約（加倍計收）', tone: 'danger' },
  near_limit: { label: '快超約（風險邊緣）', tone: 'warn' },
  healthy: { label: '契約容量剛好', tone: 'brand' },
  oversized: { label: '契約容量偏高，可評估調降', tone: 'navy' },
  unknown: { label: '待補契約／需量', tone: 'neutral' },
}

const PF_BADGE: Record<PowerFactorStatus, { label: string; tone: BadgeTone }> = {
  penalty: { label: '未達 80%（加收調整費）', tone: 'danger' },
  below_target: { label: '80%–94%（還有折扣空間）', tone: 'warn' },
  optimal: { label: '已達 95% 滿額獎勵', tone: 'brand' },
  exempt: { label: '未滿 30 kW 免計功因', tone: 'neutral' },
  unknown: { label: '待補功率因數', tone: 'neutral' },
}

function scrollToSources() {
  const el = document.getElementById('bill-sources')
  if (!el) return
  el.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  el.focus?.({ preventScroll: true })
}

function SourceChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={scrollToSources}
      className="inline-flex w-fit items-center gap-1 text-xs font-medium text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 print:hidden"
    >
      {label}
    </button>
  )
}

export default function BillCheckup() {
  const { company, role } = useSession()
  const store = useStore()
  const { readOnly } = useStoreInfo()
  const toast = useToast()

  const reportRef = useRef<HTMLElement>(null)
  const [initialDraft] = useState(() => loadBillDraft())
  const [planId, setPlanId] = useState<TariffPlanId>(() => initialDraft?.planId ?? 'hv_2stage')
  const [periods, setPeriods] = useState<DraftPeriod[]>(() =>
    initialDraft?.periods?.length ? initialDraft.periods : [emptyDraftPeriod(0)],
  )
  const [showTouFields, setShowTouFields] = useState(() => initialDraft?.showTouFields ?? false)
  const [savingFacts, setSavingFacts] = useState(false)

  const factoryDoc = role === 'factory' && company?.role === 'factory' ? company : null
  const factoryHasCompressor = Boolean(factoryDoc?.factory.equipment?.some((e) => e.type === 'air_compressor'))
  const [hasAirCompressor, setHasAirCompressor] = useState(() => initialDraft?.hasAirCompressor ?? factoryHasCompressor)
  const [airFlowM3Min, setAirFlowM3Min] = useState(() => initialDraft?.airFlowM3Min ?? '')
  const [pressureBar, setPressureBar] = useState(() => initialDraft?.pressureBar ?? '')
  const [compressorDailyHours, setCompressorDailyHours] = useState(() => initialDraft?.compressorDailyHours ?? '')

  useEffect(() => {
    if (factoryHasCompressor && !initialDraft) setHasAirCompressor(true)
  }, [factoryHasCompressor, initialDraft])

  const factoryFacts = useMemo(() => (factoryDoc ? resolveFactoryFacts(factoryDoc) : null), [factoryDoc])

  const parsedPeriods = useMemo(() => periods.map(toInput), [periods])
  const report = useMemo(() => analyzeBillCheckup({ planId, periods: parsedPeriods }), [planId, parsedPeriods])

  useEffect(() => {
    const hasAnyValue =
      periods.some((p) =>
        [p.contractKw, p.maxDemandKw, p.powerFactorPct, p.totalKwh, p.billAmountNtd, p.peakKwh, p.offPeakKwh].some(
          (v) => v.trim() !== '',
        ),
      ) ||
      hasAirCompressor ||
      airFlowM3Min.trim() !== '' ||
      pressureBar.trim() !== '' ||
      compressorDailyHours.trim() !== ''
    if (!hasAnyValue) return
    saveBillDraft({
      planId,
      periods,
      showTouFields,
      hasAirCompressor,
      airFlowM3Min,
      pressureBar,
      compressorDailyHours,
      annualKwh: report.annualKwh,
      avgMonthlyBillNtd: report.avgMonthlyBillNtd,
      avgPriceNtd: report.avgPriceNtd,
      latestContractKw: report.latestContractKw,
      monthsEntered: report.monthsEntered,
      updatedAt: nowIso(),
    })
  }, [
    planId,
    periods,
    showTouFields,
    hasAirCompressor,
    airFlowM3Min,
    pressureBar,
    compressorDailyHours,
    report.annualKwh,
    report.avgMonthlyBillNtd,
    report.avgPriceNtd,
    report.latestContractKw,
    report.monthsEntered,
  ])

  const billSubsidySummary = useMemo(() => {
    const ts = nowIso()
    const baseFactory: Factory = factoryDoc
      ? {
          ...factoryDoc,
          factory: {
            ...factoryDoc.factory,
            ...(report.latestContractKw != null ? { contractKw: report.latestContractKw } : {}),
            ...(report.avgMonthlyKwh != null ? { monthlyKwh: report.avgMonthlyKwh } : {}),
            ...(report.avgMonthlyBillNtd != null ? { monthlyElectricBillNtd: report.avgMonthlyBillNtd } : {}),
            ...(report.avgPriceNtd != null ? { avgElectricityPriceNtd: report.avgPriceNtd } : {}),
            ...(hasAirCompressor && !factoryDoc.factory.equipment?.some((e) => e.type === 'air_compressor')
              ? { equipment: [...(factoryDoc.factory.equipment ?? []), { type: 'air_compressor', quantity: 1, source: 'user' }] }
              : {}),
          },
        }
      : {
          id: 'bill-checkup-guest',
          role: 'factory',
          name: '電費單健檢訪客',
          city: '台中市',
          contactName: '',
          phone: '',
          email: '',
          intro: '',
          createdAt: ts,
          updatedAt: ts,
          factory: {
            industry: '',
            products: '',
            employees: 30,
            scale: 'S',
            mainCustomers: [],
            pressures: [],
            contractKw: report.latestContractKw ?? undefined,
            monthlyKwh: report.avgMonthlyKwh ?? undefined,
            monthlyElectricBillNtd: report.avgMonthlyBillNtd ?? undefined,
            avgElectricityPriceNtd: report.avgPriceNtd ?? undefined,
            equipment: hasAirCompressor ? [{ type: 'air_compressor', quantity: 1, source: 'user' }] : [],
            dataSources: {
              ...(report.latestContractKw != null ? { contractKw: { source: 'user', updatedAt: ts } } : {}),
              ...(report.avgMonthlyKwh != null ? { monthlyKwh: { source: 'user', updatedAt: ts } } : {}),
              ...(report.avgMonthlyBillNtd != null ? { monthlyElectricBillNtd: { source: 'user', updatedAt: ts } } : {}),
              ...(report.avgPriceNtd != null ? { avgElectricityPriceNtd: { source: 'user', updatedAt: ts } } : {}),
            },
          },
        }
    const syntheticNeed: Pick<Need, 'form' | 'budgetNtd'> | null = hasAirCompressor
      ? {
          form: {
            items: [{ equip: 'air_compressor', quantity: 1, ageYears: null }],
            monthlyElectricBillNtd: report.avgMonthlyBillNtd ?? null,
            mainProblems: [],
            directions: ['動力與公用設備節能改善'],
            openQuestions: [],
          },
          budgetNtd: null,
        }
      : null
    return matchSubsidies({
      factory: baseFactory,
      need: syntheticNeed,
      context: hasAirCompressor ? 'match' : 'hub',
    })
  }, [factoryDoc, report.latestContractKw, report.avgMonthlyKwh, report.avgMonthlyBillNtd, report.avgPriceNtd, hasAirCompressor])

  const selectedPlanSpec = useMemo(() => {
    if (planId !== 'unknown') return TARIFF_PLANS[planId]
    const firstKw = parsedPeriods.find((p) => p.contractKw != null)?.contractKw ?? null
    return firstKw != null && firstKw < 100 ? TARIFF_PLANS.lv_non_tou : TARIFF_PLANS.hv_2stage
  }, [planId, parsedPeriods])

  const patchPeriod = (idx: number, patch: Partial<DraftPeriod>) => {
    setPeriods((cur) => cur.map((p, i) => (i === idx ? { ...p, ...patch } : p)))
  }

  const addPeriod = () => {
    if (periods.length >= 12) return
    setPeriods((cur) => {
      const last = cur[cur.length - 1]
      const next = emptyDraftPeriod(cur.length)
      if (last) {
        next.contractKw = last.contractKw
        next.season = last.season
      }
      return [...cur, next]
    })
  }

  const removePeriod = (idx: number) => {
    if (periods.length <= 1) return
    setPeriods((cur) => cur.filter((_, i) => i !== idx))
  }

  const applySample = () => {
    const sample = demoSampleDraft()
    setPlanId(sample.planId)
    setPeriods(sample.periods)
    setShowTouFields(true)
    toast({ title: '已帶入高壓電示範電費單', body: '這張帳單同時有超約與功因未達 80% 的狀況，可直接看下方健檢報告。', tone: 'info' })
    window.requestAnimationFrame(() => {
      reportRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      reportRef.current?.focus?.({ preventScroll: true })
    })
  }

  const applyFactoryFacts = () => {
    if (!factoryFacts) return
    const contractKw = factoryFacts.contractKw.value
    const monthlyKwh = factoryFacts.monthlyKwh.value
    const monthlyBill = factoryFacts.monthlyElectricBillNtd.value
    setPlanId(contractKw != null && contractKw < 100 ? 'lv_non_tou' : 'hv_2stage')
    setPeriods([
      {
        ...emptyDraftPeriod(0),
        label: '貴廠預設數據',
        contractKw: contractKw != null ? String(contractKw) : '',
        totalKwh: monthlyKwh != null ? String(monthlyKwh) : '',
        billAmountNtd: monthlyBill != null ? String(monthlyBill) : '',
      },
    ])
    toast({ title: '已從貴廠檔案帶入契約容量與月用電', body: '補上電費單上的「最高需量」與「功率因數」就能完整診斷。', tone: 'info' })
  }

  const resetAll = () => {
    clearBillDraft()
    setPlanId('hv_2stage')
    setPeriods([emptyDraftPeriod(0)])
    setShowTouFields(false)
    setHasAirCompressor(factoryHasCompressor)
    setAirFlowM3Min('')
    setPressureBar('')
    setCompressorDailyHours('')
  }

  const saveBackToFactory = async () => {
    if (!factoryDoc || readOnly) return
    setSavingFacts(true)
    try {
      const updates: {
        contractKw?: number
        monthlyKwh?: number
        monthlyElectricBillNtd?: number
        avgElectricityPriceNtd?: number
      } = {}
      if (report.latestContractKw != null) updates.contractKw = report.latestContractKw
      if (report.avgMonthlyKwh != null) updates.monthlyKwh = report.avgMonthlyKwh
      if (report.avgMonthlyBillNtd != null) updates.monthlyElectricBillNtd = report.avgMonthlyBillNtd
      if (report.avgPriceNtd != null) updates.avgElectricityPriceNtd = report.avgPriceNtd

      await store.update('companies', factoryDoc.id, buildFactoryFactPatch(factoryDoc, updates, nowIso()))
      toast({ title: '已將電費單健檢數據存回貴廠檔案', body: '後續報價 ROI、補助資格與碳盤查會自動沿用這組數字。', tone: 'success' })
    } catch {
      toast({ title: '寫回工廠檔案失敗，請稍後再試', tone: 'error' })
    } finally {
      setSavingFacts(false)
    }
  }

  const hasResult = report.monthsEntered > 0
  const contractBadge = CONTRACT_BADGE[report.overallContractStatus]
  const pfBadge = PF_BADGE[report.overallPfStatus]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={
          <Badge tone="brand" icon={<FileSpreadsheet className="size-3.5" aria-hidden />}>
            免登入可用・電費單健檢
          </Badge>
        }
        title="電費單健檢：看有沒有冤枉錢與隱藏調整費"
        breadcrumbs={[{ label: '首頁', to: paths.home() }, { label: '電費單健檢' }]}
        description="照著台電電費單填入 5–6 個數字，立刻算出契約容量是否加收超約附加費、功率因數有沒有被加收調整費、時間電價是否適合，以及年度用電排碳量。所有規則附台電／能源署官方出處，不亂猜。"
      />

      {/* 快速起點與示範載入列 */}
      <Card className="flex flex-wrap items-center justify-between gap-3 bg-sunken">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">手邊有電費單可直接往下填；想先看功能效果也可試填範例</p>
          <p className="text-xs text-muted">每期填寫約 1 分鐘；可填最近一期，或按「再加一期（最多 12 期）」算全年總電費與排碳。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" icon={<Sparkles className="size-4" aria-hidden />} onClick={applySample}>
            試填高壓電範例（超約＋低功因）
          </Button>
          {factoryFacts ? (
            <Button type="button" size="sm" variant="secondary" onClick={applyFactoryFacts}>
              代入貴廠檔案數據
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" icon={<RotateCcw className="size-4" aria-hidden />} onClick={resetAll}>
            清空重填
          </Button>
        </div>
      </Card>

      {/* 輸入表單區 */}
      <section className="flex flex-col gap-4" aria-label="電費單輸入區">
        <SectionTitle title="1. 填入台電電費單數字" hint="每一格都標示在電費單上的位置；沒有的欄位可留白" />

        <Card className="flex flex-col gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="計費方案（用電種類）"
              hint="電費單正面「用電種類」欄（例如：高壓電力二段式時間電價、低壓電力非時間電價）"
            >
              {(p) => (
                <Select {...p} value={planId} onChange={(e) => setPlanId(e.target.value as TariffPlanId)}>
                  {TARIFF_PLAN_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="rounded-sm border border-line bg-sunken px-3 py-2.5 text-xs text-ink-soft">
              <p className="font-semibold text-ink">{selectedPlanSpec.label} 參考基準</p>
              <p className="mt-1">{selectedPlanSpec.summerPeriodText}</p>
              <p className="mt-0.5 text-muted">{selectedPlanSpec.scheduleHint}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {periods.map((period, idx) => {
              const touInputs = [period.peakKwh, period.semiPeakKwh, period.satSemiPeakKwh, period.offPeakKwh].map(numOrNull)
              const hasTouEntered = touInputs.some((v) => v != null && v > 0)
              const totalVal = numOrNull(period.totalKwh)
              const touSum = touInputs.reduce<number>((s, v) => s + (v != null && v > 0 ? v : 0), 0)
              const hasPeriodMismatch =
                hasTouEntered && totalVal != null && totalVal > 0 && Math.abs(touSum - totalVal) > Math.max(totalVal * 0.15, 50)
              return (
                <div key={period.id} className="rounded-md border border-line bg-surface p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-ink">期別 {idx + 1}</span>
                      {periods.length > 1 ? (
                        <TextInput
                          value={period.label}
                          onChange={(e) => patchPeriod(idx, { label: e.target.value })}
                          aria-label={`期別 ${idx + 1} 名稱`}
                          className="h-8 w-36 text-xs"
                          placeholder="例如 2026-08"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        aria-label={`期別 ${idx + 1} 夏月或非夏月`}
                        value={period.season}
                        onChange={(e) => patchPeriod(idx, { season: e.target.value as SeasonKind })}
                        className="h-8 w-auto text-xs"
                      >
                        <option value="summer">夏月計費（{selectedPlanSpec.voltage === 'high' ? '5/16–10/15' : '6/1–9/30'}）</option>
                        <option value="non_summer">非夏月計費</option>
                      </Select>
                      {periods.length > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`刪除期別 ${idx + 1}`}
                          icon={<Trash2 className="size-3.5" aria-hidden />}
                          onClick={() => removePeriod(idx)}
                        >
                          移除
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field
                      label="契約容量（kW）"
                      hint="電費單「契約容量（瓩）」或「經常契約」欄"
                    >
                      {(p) => (
                        <TextInput
                          {...p}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          placeholder="例如 200"
                          value={period.contractKw}
                          onChange={(e) => patchPeriod(idx, { contractKw: e.target.value })}
                          className="tabular font-mono"
                        />
                      )}
                    </Field>

                    <Field
                      label="最高需量（kW）"
                      hint="電費單「最高需量（瓩）」或台電高壓入口網需量紀錄"
                    >
                      {(p) => (
                        <TextInput
                          {...p}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          placeholder="例如 185"
                          value={period.maxDemandKw}
                          onChange={(e) => patchPeriod(idx, { maxDemandKw: e.target.value })}
                          className="tabular font-mono"
                        />
                      )}
                    </Field>

                    <Field
                      label="功率因數（%）"
                      hint="電費單「功率因數（%）」欄（基準 80%，最高獎勵至 95%）"
                    >
                      {(p) => (
                        <TextInput
                          {...p}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          placeholder="例如 92"
                          value={period.powerFactorPct}
                          onChange={(e) => patchPeriod(idx, { powerFactorPct: e.target.value })}
                          className="tabular font-mono"
                        />
                      )}
                    </Field>

                    <Field
                      label="總用電度數（kWh／度）"
                      hint="電費單「實用電度」或「總計費度數」"
                    >
                      {(p) => (
                        <TextInput
                          {...p}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="例如 80000"
                          value={period.totalKwh}
                          onChange={(e) => patchPeriod(idx, { totalKwh: e.target.value })}
                          className="tabular font-mono"
                        />
                      )}
                    </Field>

                    <Field
                      label="本期電費總金額（元）"
                      hint="電費單「應繳總金額（元）」"
                    >
                      {(p) => (
                        <TextInput
                          {...p}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="例如 385000"
                          value={period.billAmountNtd}
                          onChange={(e) => patchPeriod(idx, { billAmountNtd: e.target.value })}
                          className="tabular font-mono"
                        />
                      )}
                    </Field>

                    <div className="flex flex-col justify-end">
                      <button
                        type="button"
                        onClick={() => setShowTouFields((v) => !v)}
                        className="inline-flex h-10 items-center justify-center rounded-sm border border-line-strong bg-sunken px-3 text-xs font-medium text-ink hover:border-brand"
                      >
                        {showTouFields ? '隱藏尖離峰分時度數欄位' : '有分時度數明細？展開試算時間電價'}
                      </button>
                    </div>
                  </div>

                  {showTouFields ? (
                    <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field
                        label="平日尖峰度數（度）"
                        hint="電費單「尖峰用電度數」明細（非夏月三段式留 0）"
                      >
                        {(p) => (
                          <TextInput
                            {...p}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder="例如 45000"
                            value={period.peakKwh}
                            onChange={(e) => patchPeriod(idx, { peakKwh: e.target.value })}
                            className="tabular font-mono"
                          />
                        )}
                      </Field>
                      <Field
                        label="平日半尖峰度數（度）"
                        hint="僅高壓三段式有列；二段式留空即可"
                      >
                        {(p) => (
                          <TextInput
                            {...p}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder="選填"
                            value={period.semiPeakKwh}
                            onChange={(e) => patchPeriod(idx, { semiPeakKwh: e.target.value })}
                            className="tabular font-mono"
                          />
                        )}
                      </Field>
                      <Field
                        label="週六半尖峰度數（度）"
                        hint="電費單「週六半尖峰度數」（無單獨列可留 0）"
                      >
                        {(p) => (
                          <TextInput
                            {...p}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder="選填"
                            value={period.satSemiPeakKwh}
                            onChange={(e) => patchPeriod(idx, { satSemiPeakKwh: e.target.value })}
                            className="tabular font-mono"
                          />
                        )}
                      </Field>
                      <Field
                        label="離峰度數（度）"
                        hint="電費單「離峰用電度數」（含週日離峰）"
                      >
                        {(p) => (
                          <TextInput
                            {...p}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder="例如 30000"
                            value={period.offPeakKwh}
                            onChange={(e) => patchPeriod(idx, { offPeakKwh: e.target.value })}
                            className="tabular font-mono"
                          />
                        )}
                      </Field>
                      {hasPeriodMismatch ? (
                        <p className="text-xs font-medium text-warn sm:col-span-2 lg:col-span-4">
                          提醒：這期的尖峰＋半尖峰＋離峰度數加總與總度數誤差超過 15%，為避免失真，方案比較會先暫停計算直到數字對齊。
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          {/* PROP-0007 4b：廠內空壓機資訊（風量為選填，不填不卡報告） */}
          <div className="flex flex-col gap-3 rounded-md border border-line bg-sunken p-4">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={hasAirCompressor}
                onChange={(e) => setHasAirCompressor(e.target.checked)}
                className="mt-1 size-4 accent-brand"
              />
              <span>
                <span className="font-semibold text-ink">廠內有空壓機（加看空壓機誠實區間與場勘前清單）</span>
                <span className="mt-0.5 block text-xs text-muted">
                  下方風量（m³/min）、壓力與運轉時數皆為選填，不知道可以直接留白，完全不影響產生報告。
                </span>
              </span>
            </label>
            {hasAirCompressor ? (
              <div className="grid gap-4 border-t border-line pt-3 sm:grid-cols-3">
                <Field
                  label="空壓機風量（m³/min，選填）"
                  hint="不知道風量可留白，不卡報告；實際須等場勘掛表實測一週。"
                >
                  {(p) => (
                    <TextInput
                      {...p}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                      placeholder="不知道可留白"
                      value={airFlowM3Min}
                      onChange={(e) => setAirFlowM3Min(e.target.value)}
                      className="tabular font-mono"
                    />
                  )}
                </Field>
                <Field label="需要的工作壓力（bar／kg/cm²，選填）" hint="產線最低需要壓力；留白也可以">
                  {(p) => (
                    <TextInput
                      {...p}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                      placeholder="例如 6.5（選填）"
                      value={pressureBar}
                      onChange={(e) => setPressureBar(e.target.value)}
                      className="tabular font-mono"
                    />
                  )}
                </Field>
                <Field label="每日運轉時數（小時，選填）" hint="大概幾點到幾點開機；留白也可以">
                  {(p) => (
                    <TextInput
                      {...p}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={24}
                      step="0.5"
                      placeholder="例如 16（選填）"
                      value={compressorDailyHours}
                      onChange={(e) => setCompressorDailyHours(e.target.value)}
                      className="tabular font-mono"
                    />
                  )}
                </Field>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={periods.length >= 12}
              icon={<Plus className="size-4" aria-hidden />}
              onClick={addPeriod}
            >
              再加一期（已填 {periods.length} / 12 期）
            </Button>
            {factoryDoc ? (
              <Button
                type="button"
                size="sm"
                disabled={!hasResult || readOnly || savingFacts}
                onClick={saveBackToFactory}
              >
                {savingFacts ? '儲存中…' : '將結果存回我的工廠數據'}
              </Button>
            ) : null}
          </div>
        </Card>
      </section>

      {/* 健檢報告區 */}
      <section id="bill-report-section" ref={reportRef} tabIndex={-1} className="flex flex-col gap-4 outline-none" aria-label="電費單健檢報告">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle
            title="2. 電費單健檢報告"
            hint={hasResult ? `已彙整 ${report.monthsEntered} 期帳單（採用 ${report.planLabel}）` : '在上方填入任一欄位即自動顯示診斷'}
          />
          {hasResult ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="print:hidden"
              icon={<Printer className="size-4" aria-hidden />}
              onClick={() => window.print()}
            >
              列印／存成 PDF 健檢報告
            </Button>
          ) : null}
        </div>

        {!hasResult ? (
          <Card className="flex flex-col gap-2 text-sm text-ink-soft">
            <p className="font-medium text-ink">填完上面任一格，報告會立刻出現在這裡</p>
            <p>如果手邊剛好沒電費單，可先點上方的「試填高壓電範例（超約＋低功因）」看看報告長什麼樣子。</p>
          </Card>
        ) : (
          <>
            {/* Headline KPI row */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card>
                <Stat
                  label="每度平均電價"
                  value={report.avgPriceNtd != null ? `${report.avgPriceNtd.toFixed(2)}` : '待補度數／金額'}
                  unit={report.avgPriceNtd != null ? '元/度' : undefined}
                  note={report.totalBillNtd != null ? `累計電費 ${formatNtd(report.totalBillNtd)}` : undefined}
                  tone="ink"
                />
              </Card>
              <Card>
                <Stat
                  label="基本電費佔比（估算）"
                  value={report.basicFeeSharePct != null ? formatPct(report.basicFeeSharePct, 1) : '待補契約／金額'}
                  note={
                    report.totalEstimatedBasicFeeNtd != null
                      ? `估算固定基本費 ${formatNtd(report.totalEstimatedBasicFeeNtd)}`
                      : '需同時有契約容量與電費總額'
                  }
                  tone="ink"
                />
              </Card>
              <Card>
                <Stat
                  label={report.totalOverContractPenaltyNtd > 0 ? '累計超約附加費' : '超約與需量'}
                  value={
                    report.totalOverContractPenaltyNtd > 0
                      ? formatNtd(report.totalOverContractPenaltyNtd)
                      : report.peakDemandKw != null && report.latestContractKw != null
                        ? `${formatNumber(report.peakDemandKw)} / ${formatNumber(report.latestContractKw)} kW`
                        : '待補需量'
                  }
                  note={contractBadge.label}
                  tone={report.totalOverContractPenaltyNtd > 0 || report.overallContractStatus === 'over_contract' ? 'danger' : 'ink'}
                />
              </Card>
              <Card>
                <Stat
                  label="對應年排碳估算"
                  value={report.annualScope2T != null ? formatTons(report.annualScope2T) : '待補度數'}
                  note={
                    report.annualKwh != null
                      ? `${report.annualizedFromSingleOrPartial ? '單月年化約 ' : ''}${formatKwh(report.annualKwh)} × ${report.emissionFactorKgPerKwh}`
                      : undefined
                  }
                  tone="ink"
                />
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* 診斷 1 + 2：契約容量與超約 */}
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-ink">契約容量與超約附加費診斷</h3>
                      <Badge tone="warn">規則待原文 PDF 複核</Badge>
                    </div>
                    <SourceChip label="依據：台電 114/10 ×2／×3 倍規則 ↘" />
                  </div>
                  <Badge
                    tone={contractBadge.tone}
                    icon={
                      report.overallContractStatus === 'over_contract' || report.overallContractStatus === 'near_limit' ? (
                        <AlertTriangle className="size-3.5" aria-hidden />
                      ) : (
                        <CheckCircle2 className="size-3.5" aria-hidden />
                      )
                    }
                  >
                    {contractBadge.label}
                  </Badge>
                </div>
                <p
                  className={
                    report.totalOverContractPenaltyNtd > 0 || report.overallContractStatus === 'over_contract'
                      ? 'tabular font-mono text-base font-bold text-danger'
                      : report.contractOptimization && report.contractOptimization.annualSavingsNtd > 0
                        ? 'tabular font-mono text-base font-bold text-brand-strong'
                        : 'tabular font-mono text-base font-bold text-ink'
                  }
                >
                  {report.totalOverContractPenaltyNtd > 0
                    ? `超約附加費 ${formatNtd(report.totalOverContractPenaltyNtd)}（最高 ${formatNumber(report.peakDemandKw ?? 0)} / 契約 ${formatNumber(report.latestContractKw ?? 0)} kW）`
                    : report.contractOptimization
                      ? report.contractOptimization.annualSavingsNtd > 0
                        ? `最划算契約 ${report.contractOptimization.optimalContractKw} kW・預估年省 ${formatNtd(report.contractOptimization.annualSavingsNtd)}`
                        : `現行契約 ${report.contractOptimization.currentContractKw} kW 已屬區間最省`
                      : report.peakDemandKw != null && report.latestContractKw != null
                        ? `最高需量 ${formatNumber(report.peakDemandKw)} / 契約 ${formatNumber(report.latestContractKw)} kW（負荷率 ${Math.round((report.peakDemandKw / report.latestContractKw) * 100)}%）`
                        : '尚未填寫契約容量與最高需量'}
                </p>
                {!report.contractOptimization && report.peakDemandKw != null && report.latestContractKw != null ? (() => {
                  const demandPeriods = report.periods.filter((p) => p.contractKw != null && p.maxDemandKw != null)
                  const allSummer = demandPeriods.every((p) => p.season === 'summer')
                  return demandPeriods.length < 3 ? (
                    <div className="rounded-sm border border-line bg-sunken p-3 text-xs text-ink-soft">
                      <p className="font-semibold text-ink">契約容量最佳化需至少 3 期帳單</p>
                      <p className="mt-1">
                        目前僅填入 {demandPeriods.length}{' '}
                        期需量資料，單期生產尖峰或淡旺季波動容易誤判全年最適契約，因此本版不在此顯示長期調高／調降建議，先呈現當期負荷率與超約附加費。請補齊至少 3 期含夏月／非夏月帳單後再比對年度總額。
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-sm border border-line bg-sunken p-3 text-xs text-ink-soft">
                      <p className="font-semibold text-ink">契約容量最佳化需同時包含夏月與非夏月帳單</p>
                      <p className="mt-1">
                        目前已填 {demandPeriods.length} 期需量皆為{allSummer ? '夏月' : '非夏月'}；為避免誤將單季費率放大為全年 12 個月，請至少補入 1 期
                        {allSummer ? '非夏月' : '夏月'}帳單，系統即以夏月 5 月＋非夏月 7 月加權換算年度最划算契約容量。
                      </p>
                    </div>
                  )
                })() : null}
                <details className="rounded-sm border border-line bg-sunken px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-ink">
                    查看診斷說明、候選容量試算與各期超約明細
                  </summary>
                  <div className="mt-2.5 flex flex-col gap-3">
                    <p className="text-sm text-ink-soft">{report.contractAdvice}</p>
                    {report.contractOptimization ? (
                      <div className="flex flex-col gap-2 rounded-sm border border-line bg-surface p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-ink">
                            最划算契約試算：{report.contractOptimization.optimalContractKw} kW
                            {report.contractOptimization.annualSavingsNtd > 0
                              ? `（一年可少繳 ${formatNtd(report.contractOptimization.annualSavingsNtd)}）`
                              : '（現況已最划算）'}
                          </span>
                          <span className="text-muted">
                            {report.contractOptimization.isPartialAnnualized
                              ? `依夏月 5 月＋非夏月 7 月加權（共 ${report.contractOptimization.periodsCount} 期）・建議補滿 12 期`
                              : '依 12 期完整帳單估算'}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[260px] text-left">
                            <thead>
                              <tr className="border-b border-line text-muted">
                                <th className="py-1 pr-2 font-medium">試算契約</th>
                                <th className="py-1 px-2 text-right font-medium">年基本費</th>
                                <th className="py-1 px-2 text-right font-medium">年超約費</th>
                                <th className="py-1 pl-2 text-right font-medium">年合計</th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.contractOptimization.candidates.map((cand) => {
                                const isBest = cand.contractKw === report.contractOptimization!.optimalContractKw
                                return (
                                  <tr
                                    key={`${cand.contractKw}-${cand.label}`}
                                    className={isBest ? 'bg-brand-soft/60 font-semibold text-ink' : 'text-ink-soft'}
                                  >
                                    <td className="py-1 pr-2">
                                      <span className="tabular font-mono">{cand.contractKw} kW</span>{' '}
                                      <span className="text-[11px] text-muted">（{cand.label}）</span>
                                    </td>
                                    <td className="tabular py-1 px-2 text-right font-mono">{cand.annualBasicFeeNtd.toLocaleString('zh-TW')}</td>
                                    <td className="tabular py-1 px-2 text-right font-mono">{cand.annualOverPenaltyNtd.toLocaleString('zh-TW')}</td>
                                    <td className="tabular py-1 pl-2 text-right font-mono text-ink">{cand.annualTotalNtd.toLocaleString('zh-TW')}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {report.contractOptimization.annualSavingsNtd > 0 &&
                        report.contractOptimization.optimalContractKw < report.contractOptimization.currentContractKw ? (
                          <p className="text-[11px] text-ink-soft">
                            提醒：正式向台電申請調降前，請保留尖峰產能與夏月氣溫變化的需量餘裕，避免反過來觸發 2–3 倍超約附加費。
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {report.periods.some((p) => p.overContractPenaltyNtd > 0) ? (
                      <div className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-ink">
                        <p className="font-semibold text-danger">各期超約明細（10% 內 ×2 倍／超過 10% ×3 倍・依台電營業規則整理）</p>
                        <ul className="mt-1 flex flex-col gap-1">
                          {report.periods
                            .filter((p) => p.overContractPenaltyNtd > 0)
                            .map((p, idx) => (
                              <li key={`${idx}-${p.label}`} className="tabular font-mono">
                                {p.label}：超約 {p.excessKw} kW（2 倍計 {p.within10Kw} kW ＋ 3 倍計 {p.over10Kw} kW）→ 加收 {formatNtd(p.overContractPenaltyNtd)}
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </details>
              </Card>

              {/* 診斷 3：功率因數 */}
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-ink">功率因數（PF）與調整費試算</h3>
                      <Badge tone="warn">規則待原文 PDF 複核</Badge>
                    </div>
                    <SourceChip label="依據：台電營業規則第 44 條（功率因數調整費）↘" />
                  </div>
                  <Badge tone={pfBadge.tone}>{pfBadge.label}</Badge>
                </div>
                {(() => {
                  const pfCount = report.periods.filter((p) => p.pfAdjustmentNtd != null).length
                  const pfSaveCount = report.periods.filter((p) => p.pfPotentialSaveNtd != null).length
                  const avgPeriodSave =
                    report.totalPfPotentialSaveNtd != null && pfSaveCount > 0
                      ? Math.round(report.totalPfPotentialSaveNtd / pfSaveCount)
                      : null
                  return (
                    <>
                      <p
                        className={
                          report.overallPfStatus === 'penalty'
                            ? 'tabular font-mono text-base font-bold text-danger'
                            : report.annualPfPotentialSaveNtd != null && report.annualPfPotentialSaveNtd > 0
                              ? 'tabular font-mono text-base font-bold text-brand-strong'
                              : 'tabular font-mono text-base font-bold text-ink'
                        }
                      >
                        {report.totalPfAdjustmentNtd != null
                          ? report.totalPfAdjustmentNtd > 0
                            ? report.annualPfPotentialSaveNtd != null
                              ? `${pfCount > 1 ? `累計${pfCount}期` : '本期'}多繳 ${formatNtd(report.totalPfAdjustmentNtd)}・升至 95% 年省 ${formatNtd(report.annualPfPotentialSaveNtd)}`
                              : `${pfCount > 1 ? `累計${pfCount}期` : '本期'}多繳 ${formatNtd(report.totalPfAdjustmentNtd)}・平均每期可多省 ${avgPeriodSave != null ? formatNtd(avgPeriodSave) : '—'}`
                            : report.annualPfPotentialSaveNtd != null && report.annualPfPotentialSaveNtd > 0
                              ? `已減收 ${formatNtd(Math.abs(report.totalPfAdjustmentNtd))}・升至 95% 可再省 ${formatNtd(report.annualPfPotentialSaveNtd)}/年`
                              : avgPeriodSave != null && avgPeriodSave > 0
                                ? `已減收 ${formatNtd(Math.abs(report.totalPfAdjustmentNtd))}・升至 95% 每期可再省 ${formatNtd(avgPeriodSave)}`
                                : `已減收 ${formatNtd(Math.abs(report.totalPfAdjustmentNtd))}（已享 95% 滿額折扣）`
                          : report.overallPfStatus === 'exempt'
                            ? '契約容量未達功因計費門檻（免計收）'
                            : '尚未填寫功率因數（%）'}
                      </p>
                      <details className="rounded-sm border border-line bg-sunken px-3 py-2 text-xs">
                        <summary className="cursor-pointer font-semibold text-ink">
                          查看功因加減計算法與年省推估說明
                        </summary>
                        <div className="mt-2.5 flex flex-col gap-3">
                          <p className="text-sm text-ink-soft">{report.pfAdvice}</p>
                          {report.totalPfAdjustmentNtd != null ? (
                            <div className="grid grid-cols-2 gap-3 rounded-sm border border-line bg-surface px-3 py-2 text-xs">
                              <div>
                                <span className="text-muted">
                                  {pfCount > 1 ? `已填 ${pfCount} 期累計功因調整費` : '本期帳單功因增減估算'}
                                </span>
                                <p className="tabular font-mono text-sm font-bold text-ink">
                                  {report.totalPfAdjustmentNtd > 0
                                    ? `多繳 ${formatNtd(report.totalPfAdjustmentNtd)}`
                                    : report.totalPfAdjustmentNtd < 0
                                      ? `已減收 ${formatNtd(Math.abs(report.totalPfAdjustmentNtd))}`
                                      : '0 元（剛好 80%）'}
                                </p>
                                <span className="mt-0.5 block text-[11px] text-muted">依台電營業規則整理</span>
                              </div>
                              <div>
                                <span className="text-muted">
                                  {report.annualPfPotentialSaveNtd != null ? '提升至 95% 滿額年省潛力' : '提升至 95% 單期可省空間'}
                                </span>
                                <p className="tabular font-mono text-sm font-bold text-brand-strong">
                                  {report.annualPfPotentialSaveNtd != null
                                    ? formatNtd(report.annualPfPotentialSaveNtd)
                                    : avgPeriodSave != null
                                      ? `${formatNtd(avgPeriodSave)}／期`
                                      : '—'}
                                </p>
                                {report.pfAnnualBasisNote ? (
                                  <span className="mt-0.5 block text-[11px] text-muted">（{report.pfAnnualBasisNote}）</span>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    </>
                  )
                })()}
              </Card>

              {/* 診斷 4：電價方案適配度 */}
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-display text-base font-bold text-ink">時間電價方案適配度</h3>
                    <SourceChip label="依據：台電 114/10 電價表試算 ↘" />
                  </div>
                  <Badge tone={report.touComparison.status === 'compared' ? 'brand' : 'outline'}>
                    {report.touComparison.status === 'compared'
                      ? '已依分時度數試算'
                      : report.touComparison.status === 'mismatch_warning'
                        ? '分時度數加總不符'
                        : '待填分時度數'}
                  </Badge>
                </div>
                <p className="tabular font-mono text-base font-bold text-ink">
                  {report.touComparison.status === 'compared' && report.touComparison.estimatedPeriodDiffRangeNtd
                    ? report.touComparison.estimatedPeriodDiffRangeNtd.max < 0
                      ? `改用${report.touComparison.alternativeLabel ?? '替代方案'}預估省 ${formatNtd(Math.abs(report.touComparison.estimatedPeriodDiffRangeNtd.max))}～${formatNtd(Math.abs(report.touComparison.estimatedPeriodDiffRangeNtd.min))}`
                      : report.touComparison.estimatedPeriodDiffRangeNtd.min > 0
                        ? `維持現有${report.touComparison.currentLabel}較省（約少 ${formatNtd(report.touComparison.estimatedPeriodDiffRangeNtd.min)}～${formatNtd(report.touComparison.estimatedPeriodDiffRangeNtd.max)}）`
                        : `兩方案流動電費接近（約 ${formatNtd(report.touComparison.estimatedPeriodDiffRangeNtd.min)}～+${formatNtd(report.touComparison.estimatedPeriodDiffRangeNtd.max)}）`
                    : report.touComparison.offPeakSharePct != null
                      ? `離峰＋週六半尖峰佔比約 ${formatPct(report.touComparison.offPeakSharePct, 1)}`
                      : report.touComparison.status === 'mismatch_warning'
                        ? '分時度數加總與總度數誤差超過 15%，待核對'
                        : '尚未填入尖峰／半尖峰／離峰度數'}
                </p>
                <details className="rounded-sm border border-line bg-sunken px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-ink">
                    查看分時方案試算細節與計算前提
                  </summary>
                  <div className="mt-2.5 flex flex-col gap-2">
                    <p className="text-sm text-ink-soft">{report.touComparison.summary}</p>
                    {report.touComparison.offPeakSharePct != null ? (
                      <p className="tabular font-mono text-xs text-muted">
                        目前離峰＋週六半尖峰佔比：約 {formatPct(report.touComparison.offPeakSharePct, 1)}
                      </p>
                    ) : null}
                  </div>
                </details>
              </Card>

              {/* 診斷 5：年度排碳與下一步 */}
              <Card className="flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-display text-base font-bold text-ink">年度用電排碳量與下一步</h3>
                      <SourceChip label="依據：能源署 114 年度電力排碳係數 ↘" />
                    </div>
                    <Badge tone="navy" icon={<Leaf className="size-3.5" aria-hidden />}>
                      114 年度產業係數 {INDUSTRY_EMISSION_FACTOR.kgPerKwh}
                    </Badge>
                  </div>
                  <p className="tabular font-mono text-base font-bold text-ink">
                    {report.annualScope2T != null && report.annualKwh != null
                      ? `年電力排碳約 ${formatTons(report.annualScope2T)}（年用電 ${formatKwh(report.annualKwh)}）`
                      : '尚未填入總用電度數（kWh）'}
                  </p>
                  <details className="rounded-sm border border-line bg-sunken px-3 py-2 text-xs">
                    <summary className="cursor-pointer font-semibold text-ink">
                      查看係數出處與 2.5 萬噸碳費門檻說明
                    </summary>
                    <p className="mt-2 text-sm text-ink-soft">
                      {report.annualScope2T != null
                        ? `依能源署 114 年度產業電力排碳係數（${INDUSTRY_EMISSION_FACTOR.kgPerKwh} kgCO₂e/度）推算，年外購電力排放約 ${formatTons(report.annualScope2T)}（目前台灣碳費強制門檻為年排放 2.5 萬噸；多數中小製造廠雖非直接課徵對象，但供貨品牌客戶會要求盤查數據）。`
                        : '填入總用電度數（kWh）即可依經濟部能源署最新公告計算年度電力碳排放。'}
                    </p>
                  </details>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink
                    to={(() => {
                      const q = new URLSearchParams()
                      if (hasAirCompressor) q.set('specialty', 'air_compressor')
                      if (report.latestContractKw != null) q.set('kw', String(Math.round(report.latestContractKw)))
                      if (report.avgMonthlyBillNtd != null) q.set('bill', String(Math.round(report.avgMonthlyBillNtd)))
                      const flow = numOrNull(airFlowM3Min)
                      if (flow != null) q.set('flow', String(flow))
                      const hrs = numOrNull(compressorDailyHours)
                      if (hrs != null) q.set('hours', String(hrs))
                      const qs = q.toString()
                      return qs ? `${paths.vendors()}?${qs}` : paths.vendors()
                    })()}
                    size="sm"
                  >
                    找廠商工具包（真實廠商＋詢價）→
                  </ButtonLink>
                  <ButtonLink to={paths.newNeed()} size="sm" variant="secondary">
                    去登記節能改善需求
                  </ButtonLink>
                  <ButtonLink to={paths.carbon()} size="sm" variant="secondary">
                    {factoryDoc ? '開啟碳盤查計算機' : '帶入電費單開啟碳盤查'}
                  </ButtonLink>
                  <ButtonLink to={paths.publicCases()} size="sm" variant="ghost">
                    看真實公開案例
                  </ButtonLink>
                </div>
              </Card>
            </div>

            <SubsidyCard
              summary={billSubsidySummary}
              title="5. 適用政府補助初篩（依目前契約容量與設備）"
              showProfileHint={false}
            />
          </>
        )}

        {hasAirCompressor ? (
          <CompressorHonestSection
            cases={PUBLIC_CASES}
            electricityRate={report.avgPriceNtd ?? factoryFacts?.avgElectricityPriceNtd.value ?? DEFAULT_ROI_RATE_NTD}
            rateSource={
              report.avgPriceNtd != null
                ? 'user'
                : factoryFacts?.avgElectricityPriceNtd.source ?? 'estimate'
            }
            optionalInputs={{
              airFlowM3Min: numOrNull(airFlowM3Min),
              pressureBar: numOrNull(pressureBar),
              dailyHours: numOrNull(compressorDailyHours),
            }}
          />
        ) : null}

        {hasResult ? (
          <Card className="flex flex-col gap-1.5 bg-sunken text-xs text-ink-soft" aria-label="健檢報告產生資訊與免責說明">
            <div className="flex flex-wrap items-center justify-between gap-2 text-ink">
              <span className="font-semibold">綠媒 GreenMatch 電費單健檢試算摘要</span>
              <span className="font-mono tabular">產生時間：{new Date().toLocaleString('zh-TW', { hour12: false })}</span>
            </div>
            <p>
              依據基準：{report.planLabel}（台電電價表核對日 {TARIFF_CHECKED_DATE}）、能源署 114 年度電力排碳係數{' '}
              {INDUSTRY_EMISSION_FACTOR.kgPerKwh} kgCO₂e/度。
            </p>
            <p>
              資料隱私：所有數字僅於您的瀏覽器本機試算，不會在未操作送出前傳送到外部伺服器；正式調整契約容量或申請補助前，請以台電最新公告電價表及實際電費帳單為準。
            </p>
          </Card>
        ) : null}
      </section>

      {/* 官方出處與計算依據（全數可點擊） */}
      <section id="bill-sources" tabIndex={-1} className="flex flex-col gap-3 outline-none" aria-label="台電與能源署公式出處">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <SectionTitle
            title="3. 公式依據與官方出處"
            hint={`核對日期：${TARIFF_CHECKED_DATE}；電價表單價已依台電 114/10 公告原文核對，超約／功因規則依台電營業規則整理`}
          />
          <Link to={paths.methodology()} className="text-xs font-medium text-brand-ink hover:underline print:hidden">
            查看完整方法與公式出處（含誤差範圍）→
          </Link>
        </div>
        <Card className="flex flex-col gap-3">
          <p className="text-xs text-muted">{BILL_INDUSTRY_DISCOUNT_CAVEAT}</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {TARIFF_SOURCES.map((src) => (
              <li key={src.id} className="rounded-sm border border-line bg-sunken p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand-strong hover:underline"
                  >
                    <span>{src.title}</span>
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                </div>
                <p className="mt-1 text-ink-soft">{src.note}</p>
                <p className="mt-1 text-muted">
                  來源：{src.agency}・生效：{src.effectiveDate}・核對：{src.checkedDate}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  )
}
