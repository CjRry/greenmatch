import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router'
import { AlertTriangle, ArrowRight, Calculator, ChevronDown, Printer, RotateCcw, Sparkles } from 'lucide-react'
import { aiAvailable, askJson } from '../../../core/ai/askJson'
import {
  buildFactoryFactPatch,
  overallFactSource,
  resolveFactoryFacts,
  type FactoryFactUpdates,
} from '../../../core/domain/factoryFacts'
import { evaluateQuoteAlerts, extractStandardQuoteFields } from '../../../core/domain/quoteStandard'
import { formatNtd, formatNtdRange, formatNumber, nowIso } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection, useDoc, useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import { matchSubsidies } from '../../../core/subsidies'
import type { QuoteComparison, QuoteComparisonRow, QuoteFields } from '../../../core/types'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  FactProvenance,
  FactSourceBadge,
  FeedbackNudge,
  Field,
  PageHeader,
  ScrollX,
  SectionTitle,
  SimilarCasePayback,
  SkeletonList,
  SourceTag,
  TextInput,
  useToast,
  type ProvenanceItem,
} from '../../../ui'
import { PUBLIC_CASES } from '../../../data/publicCases'
import { quotePrompt } from '../lib/prompts'
import {
  buildComparison,
  computeInteractiveRoi,
  DEFAULT_ROI_DAILY_HOURS,
  DEFAULT_ROI_DAYS_PER_YEAR,
  DEFAULT_ROI_RATE_NTD,
  entriesFromQuotes,
  guardComparison,
  totalNtd,
} from '../lib/quoteParser'

const NA = '未載明'

interface RowDef {
  key: string
  label: string
  value: (f: QuoteFields) => string | null
  field?: keyof QuoteFields
}

const ROWS: RowDef[] = [
  { key: 'model', label: '機型', value: (f) => f.equipmentModel?.trim() || null },
  { key: 'kw', label: '功率 (kW)', value: (f) => (f.ratedKw != null ? `${formatNumber(f.ratedKw)} kW` : null) },
  { key: 'eff', label: '效率等級', value: (f) => f.efficiencyGrade?.trim() || null },
  {
    key: 'subReg',
    label: '是否登錄補助產品',
    value: (f) =>
      f.subsidyRegistered === true ? '是（已登錄補助系統）' : f.subsidyRegistered === false ? '否（未登錄）' : '未確認',
  },
  { key: 'equip', label: '設備費', field: 'equipmentNtd', value: (f) => (f.equipmentNtd == null ? null : formatNtd(f.equipmentNtd)) },
  { key: 'install', label: '施工費', field: 'installNtd', value: (f) => (f.installNtd == null ? null : formatNtd(f.installNtd)) },
  { key: 'total', label: '合計', value: (f) => (totalNtd(f) == null ? null : formatNtd(totalNtd(f))) },
  { key: 'warranty', label: '保固年限', field: 'warrantyYears', value: (f) => (f.warrantyYears == null ? null : `${formatNumber(f.warrantyYears)} 年`) },
  { key: 'kwh', label: '預估每月省電', field: 'monthlySaveKwh', value: (f) => (f.monthlySaveKwh == null ? null : `${formatNumber(f.monthlySaveKwh)} 度`) },
  { key: 'ntd', label: '預估每月省下金額', field: 'monthlySaveNtd', value: (f) => (f.monthlySaveNtd == null ? null : formatNtd(f.monthlySaveNtd)) },
  { key: 'pct', label: '預估省電比例', field: 'savePct', value: (f) => (f.savePct == null ? null : `${formatNumber(f.savePct)}%`) },
  {
    key: 'basis',
    label: '節電依據（實測或假設）',
    value: (f) =>
      f.savingsBasis === 'metered' ? '實測（掛表量測）' : f.savingsBasis === 'assumed' ? '假設／經驗估算' : '未說明',
  },
  // The vendor's own claim, in the same unit (年) as the platform's payback; the platform's figure
  // (依貴廠電價試算) is the one shown as the answer (OBS-0004 §2-5).
  {
    key: 'payback',
    label: '報價單寫的回本（僅供參考）',
    field: 'paybackMonths',
    value: (f) => (f.paybackMonths == null ? null : `約 ${formatNumber(f.paybackMonths / 12, 1)} 年`),
  },
  { key: 'baseline', label: '比較基準期間', field: 'baseline', value: (f) => f.baseline },
  { key: 'mv', label: '量測驗證方式（M&V）', value: (f) => f.mvMethod?.trim() || null },
]

/** One payback wording in years, shared by the table and the 回本試算 card. */
function formatPaybackYears(roi: ReturnType<typeof computeInteractiveRoi>): string | null {
  if (roi.netPaybackMinYears != null && roi.netPaybackMaxYears != null) {
    return roi.netPaybackMinYears === roi.netPaybackMaxYears
      ? `約 ${formatNumber(roi.netPaybackMinYears, 1)} 年`
      : `約 ${formatNumber(roi.netPaybackMinYears, 1)}–${formatNumber(roi.netPaybackMaxYears, 1)} 年`
  }
  return roi.grossPaybackYears != null ? `未含補助約 ${formatNumber(roi.grossPaybackYears, 1)} 年` : null
}

export default function QuoteCompare({ embedded = false }: { embedded?: boolean } = {}) {
  const { id = '' } = useParams()
  const { company, role } = useSession()
  const { readOnly } = useStoreInfo()
  const store = useStore()
  const toast = useToast()
  const c = useDoc('cases', id)
  const need = useDoc('needs', c?.needId ?? null)
  const factory = useDoc('companies', c?.factoryId ?? null)
  const saved = useDoc('quoteComparisons', id)
  const quotes = useCollection('quotes')
  const companies = useCollection('companies')
  const [busy, setBusy] = useState(false)
  const [canAi, setCanAi] = useState<boolean | null>(null)
  const [roiRateOverride, setRoiRateOverride] = useState<string | null>(null)
  const [roiHoursOverride, setRoiHoursOverride] = useState<string | null>(null)
  const [roiDaysOverride, setRoiDaysOverride] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void aiAvailable().then(
      (ok) => {
        if (alive) setCanAi(ok)
      },
      () => {
        if (alive) setCanAi(false)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  if (c === undefined || need === undefined || factory === undefined || saved === undefined || quotes === undefined || companies === undefined || company === undefined) {
    return (
      <>
        {!embedded ? <PageHeader title="報價解說" /> : null}
        <SkeletonList rows={3} />
      </>
    )
  }
  if (!c) {
    return (
      <>
        {!embedded ? <PageHeader title="報價解說" back={{ to: paths.me(), label: '回我的工作台' }} /> : null}
        <EmptyState title="找不到這個案件" body="連結可能已失效。請回工作台，從案件列表重新進入。" action={<ButtonLink to={paths.me()}>回工作台</ButtonLink>} />
      </>
    )
  }

  const isOwner = company?.role === 'factory' && company.id === c.factoryId
  const isShortlisted = company?.role === 'vendor' && c.shortlist.includes(company.id)
  if (!company || !(isOwner || isShortlisted)) {
    return (
      <>
        {!embedded ? <PageHeader title="報價解說" back={{ to: paths.me(), label: '回我的工作台' }} /> : null}
        <EmptyState
          title={role ? '這個案件不是你的' : '請先登入'}
          body={role ? '報價只有案件的工廠與受邀報價的廠商看得到。' : '點右上角的「示範登入」，選擇這個案件的工廠。'}
          action={<ButtonLink to={paths.home()}>回首頁</ButtonLink>}
        />
      </>
    )
  }

  const aiOn = canAi === true

  const nameOf = (vid: string) => companies.find((x) => x.id === vid)?.name ?? '（已移除的廠商）'
  // A vendor only sees its own quote; the factory sees every quote of the case.
  const caseQuotes = quotes.filter((q) => q.caseId === c.id && (isOwner || q.vendorId === company.id))
  const entries = entriesFromQuotes(caseQuotes, nameOf)
  const cmp: QuoteComparison | null = saved && isOwner ? saved : null

  const explain = async () => {
    if (!entries.length) return
    setBusy(true)
    let result = buildComparison(c.id, entries, 'rules', nowIso())
    try {
      if (aiOn) {
        const res = await askJson(quotePrompt(entries), guardComparison(entries.map((e) => e.vendorId)), { tier: 'default' })
        if (res.ok) {
          result = { id: c.id, caseId: c.id, source: 'claude', generatedAt: nowIso(), rows: res.value.rows, questions: res.value.questions, summary: res.value.summary }
        }
      }
    } catch {
      // Fallback to native GreenMatch quote analyzer silently
    }
    try {
      await store.set('quoteComparisons', result)
      toast({ title: '已完成報價解說', tone: 'success' })
    } catch {
      toast({ title: '解說結果沒有儲存，請再按一次', tone: 'error' })
    }
    setBusy(false)
  }

  const entryByVendor = new Map(entries.map((e) => [e.vendorId, e]))
  const cols: QuoteComparisonRow[] = cmp
    ? cmp.rows.map((r) => {
        const entry = entryByVendor.get(r.vendorId)
        const fallbackStd = entry ? { ...extractStandardQuoteFields(entry.rawText), ...entry.declared } : {}
        const mergedFields: QuoteFields = {
          ...fallbackStd,
          ...r.fields,
          equipmentModel: r.fields.equipmentModel ?? fallbackStd.equipmentModel ?? null,
          ratedKw: r.fields.ratedKw ?? fallbackStd.ratedKw ?? null,
          efficiencyGrade: r.fields.efficiencyGrade ?? fallbackStd.efficiencyGrade ?? null,
          subsidyRegistered:
            r.fields.subsidyRegistered !== undefined ? r.fields.subsidyRegistered : (fallbackStd.subsidyRegistered ?? null),
          savingsBasis: r.fields.savingsBasis ?? fallbackStd.savingsBasis ?? null,
          mvMethod: r.fields.mvMethod ?? fallbackStd.mvMethod ?? null,
        }
        return { ...r, fields: mergedFields }
      })
    : []
  const hasAirCompressor = !!need?.form.items.some((it) => it.equip === 'air_compressor')
  const factoryDoc = factory?.role === 'factory' ? factory : null
  const facts = resolveFactoryFacts(factoryDoc)
  const colSubsidies = new Map(
    cols.map((r) => [
      r.vendorId,
      matchSubsidies({
        factory: factoryDoc,
        need,
        quoteFields: r.fields,
        totalQuoteNtd: totalNtd(r.fields),
        context: 'quote',
      }),
    ]),
  )
  const anyColUsesRelayed = Array.from(colSubsidies.values()).some((s) => Boolean(s.totalRange && s.usesRelayedRates))
  const anyColHasTaxCredit = Array.from(colSubsidies.values()).some((s) => Boolean(s.taxCreditRange))
  const hasPowerEquip = !!need?.form.items.some((it) => it.equip === 'air_compressor' || it.equip === 'pump_fan')
  const subsidyQuestion = '報價的機型是否已登錄動力設備補助產品系統？'
  const questions = cmp
    ? hasPowerEquip && !cmp.questions.some((q) => q.text.includes('補助產品系統'))
      ? [...cmp.questions, { vendorId: null, text: subsidyQuestion }]
      : cmp.questions
    : []

  const roiRate = roiRateOverride ?? String(facts.avgElectricityPriceNtd.value)
  const roiHours = roiHoursOverride ?? String(facts.dailyHours.value)
  const roiDays = roiDaysOverride ?? String(facts.annualDays.value)
  const parsedRate = Number(roiRate)
  const parsedHours = Number(roiHours)
  const parsedDays = Number(roiDays)
  const roiInput = {
    electricityRate: Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : facts.avgElectricityPriceNtd.value || DEFAULT_ROI_RATE_NTD,
    dailyHours: Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : facts.dailyHours.value || DEFAULT_ROI_DAILY_HOURS,
    daysPerYear: Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : facts.annualDays.value || DEFAULT_ROI_DAYS_PER_YEAR,
  }
  const rateSource = roiRateOverride != null ? 'user' : facts.avgElectricityPriceNtd.source
  const hoursSource = roiHoursOverride != null ? 'user' : facts.dailyHours.source
  const daysSource = roiDaysOverride != null ? 'user' : facts.annualDays.source
  const subsidyFactSource = overallFactSource(Array.from(colSubsidies.values()).map((s) => s.factSource))

  const roiProvenanceItems: ProvenanceItem[] = [
    {
      key: 'avgElectricityPriceNtd',
      label: facts.avgElectricityPriceNtd.label,
      displayValue: `${roiInput.electricityRate} 元／度`,
      source: rateSource,
      note:
        roiRateOverride != null
          ? '本次試算暫時輸入的電價（按下方「改成我的數字」可存回工廠數據）'
          : facts.avgElectricityPriceNtd.note,
      editable: {
        factKey: 'avgElectricityPriceNtd',
        initialValue: roiInput.electricityRate,
        unit: '元／度',
        placeholder: '例如 4.2',
        min: 0.1,
        max: 50,
      },
    },
    {
      key: 'dailyHours',
      label: facts.dailyHours.label,
      displayValue: `${roiInput.dailyHours} 小時／日`,
      source: hoursSource,
      note: roiHoursOverride != null ? '本次試算暫時輸入的每日運轉時數' : facts.dailyHours.note,
      editable: {
        factKey: 'dailyHours',
        initialValue: roiInput.dailyHours,
        unit: '小時',
        placeholder: '例如 16',
        min: 1,
        max: 24,
      },
    },
    {
      key: 'annualDays',
      label: facts.annualDays.label,
      displayValue: `${roiInput.daysPerYear} 天／年`,
      source: daysSource,
      note: roiDaysOverride != null ? '本次試算暫時輸入的年運轉天數' : facts.annualDays.note,
      editable: {
        factKey: 'annualDays',
        initialValue: roiInput.daysPerYear,
        unit: '天',
        placeholder: '例如 300',
        min: 1,
        max: 366,
      },
    },
    {
      key: 'contractKw',
      label: facts.contractKw.label,
      displayValue: facts.contractKw.value != null ? `${formatNumber(facts.contractKw.value)} kW` : '未填寫',
      source: facts.contractKw.source,
      note: facts.contractKw.note,
      editable: {
        factKey: 'contractKw',
        initialValue: facts.contractKw.value,
        unit: 'kW',
        placeholder: '例如 150',
        min: 1,
      },
    },
  ]
  const roiFactSource = overallFactSource(roiProvenanceItems.map((p) => p.source))

  const applyFactoryFacts = async (updates: FactoryFactUpdates) => {
    if (!factoryDoc) return
    const patch = buildFactoryFactPatch(factoryDoc, updates, nowIso())
    await store.update('companies', factoryDoc.id, patch)
    if (updates.avgElectricityPriceNtd !== undefined) setRoiRateOverride(null)
    if (updates.dailyHours !== undefined) setRoiHoursOverride(null)
    if (updates.annualDays !== undefined) setRoiDaysOverride(null)
    toast({ title: '已更新工廠數據並重算回本與補助', tone: 'success' })
  }

  return (
    <>
      {!embedded ? (
        <PageHeader
          title="報價解說"
          description="把各家報價整理成同一組欄位，方便比較。"
          breadcrumbs={[{ label: '我的資料', to: paths.me() }, { label: c.title, to: paths.case(c.id) }, { label: '報價解說' }]}
          back={{ to: paths.case(c.id), label: '回案件進度' }}
        />
      ) : null}

      <p className="mb-4 rounded-md border border-line-strong bg-sunken px-4 py-3 text-sm font-medium text-ink">以原始報價單為準。下方整理僅供參考，金額與條件請向廠商確認。</p>

      <section className="mb-6 flex flex-col gap-3">
        <SectionTitle title="原始報價" />
        {entries.length === 0 ? (
          <EmptyState
            title="還沒有廠商送出報價"
            body={isOwner ? '受邀的廠商在「方案與報價」階段送出報價後，這裡會出現。' : '你尚未送出報價，請從案件頁的「送出報價」進入。'}
            action={isShortlisted ? <ButtonLink to={paths.caseQuoteNew(c.id)}>送出報價</ButtonLink> : <ButtonLink to={paths.case(c.id)}>回案件進度</ButtonLink>}
          />
        ) : null}
        {entries.length === 0 && isOwner && need ? (
          <SimilarCasePayback
            equips={need.form.items.map((i) => i.equip)}
            electricityRate={facts.avgElectricityPriceNtd.value}
            rateSource={facts.avgElectricityPriceNtd.source}
            cases={PUBLIC_CASES}
            allCasesTo={paths.publicCases()}
          />
        ) : null}
        {entries.length === 0 ? null : (
          entries.map((e) => (
            <details key={e.vendorId} className="group rounded-md border border-line bg-surface">
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 font-medium text-ink">
                <span className="min-w-0 break-words">{e.vendorName}</span>
                <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <pre className="whitespace-pre-wrap break-words border-t border-line px-4 py-3 font-sans text-sm text-ink-soft">{e.rawText}</pre>
            </details>
          ))
        )}
      </section>

      {isOwner && entries.length > 0 ? (
        <section className="flex flex-col gap-4">
          <SectionTitle
            title="AI 報價解說"
            action={
              cmp ? (
                <Button variant="secondary" icon={<Sparkles className="size-4" aria-hidden />} busy={busy} disabled={readOnly} onClick={() => void explain()}>
                  重新解說
                </Button>
              ) : null
            }
          />
          {!cmp ? (
            <Card className="flex flex-col items-start gap-3">
              <p className="text-ink-soft">按下按鈕後，會把各家報價整理成同一組欄位、抓出缺漏項目，並自動試算扣除政府補助後的淨支出與回本時間。</p>
              <Button icon={<Sparkles className="size-4" aria-hidden />} busy={busy} disabled={readOnly} onClick={() => void explain()}>
                AI 解說報價
              </Button>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <SourceTag source={cmp.source} />
                <Badge tone="outline">以原始報價單為準</Badge>
              </div>
              {cmp.summary ? <p className="rounded-md bg-brand-soft px-4 py-3 text-brand-strong">{cmp.summary}</p> : null}
              {(() => {
                const validTotals = cols
                  .map((r) => ({ name: nameOf(r.vendorId), total: totalNtd(r.fields) }))
                  .filter((x): x is { name: string; total: number } => x.total != null && x.total > 0)
                if (validTotals.length < 2) return null
                const sorted = [...validTotals].sort((a, b) => b.total - a.total)
                const diff = sorted[0].total - sorted[sorted.length - 1].total
                const pct = Math.round((diff / sorted[0].total) * 100)
                if (pct < 20) return null
                return (
                  <div className="flex items-start gap-2.5 rounded-md border border-line-strong bg-warn-soft px-4 py-3 text-sm text-warn">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <div>
                      <p className="font-bold">
                        價差與規格範圍提醒：兩家總價相差 {formatNtd(diff)}（約 {pct}%）
                      </p>
                      <p className="mt-0.5 text-xs">
                        {sorted[0].name}（{formatNtd(sorted[0].total)}）與 {sorted[sorted.length - 1].name}（{formatNtd(sorted[sorted.length - 1].total)}）價差較大，常因「汰換台數不同（如 3 台全換 vs 2 台換新＋1 台舊機備援）」、「是否含管路抓漏修補與舊機拆除」所致，簽約前請先核對項目範圍。
                      </p>
                    </div>
                  </div>
                )
              })()}
              {(() => {
                const vendorAlerts = cols
                  .map((r) => ({
                    vendorId: r.vendorId,
                    name: nameOf(r.vendorId),
                    alerts: evaluateQuoteAlerts(r.fields, { hasAirCompressor }),
                  }))
                  .filter((x) => x.alerts.length > 0)
                if (!vendorAlerts.length) return null
                return (
                  <Card className="flex flex-col gap-2.5 bg-sunken" aria-label="標準報價風險提醒">
                    <div className="flex items-center gap-2 text-sm font-bold text-ink">
                      <AlertTriangle className="size-4 text-warn" aria-hidden />
                      <span>標準報價風險提醒（實測依據／補助登錄／驗收條款）</span>
                    </div>
                    <div className="grid gap-2.5 md:grid-cols-2">
                      {vendorAlerts.map((item) => (
                        <div key={item.vendorId} className="rounded-sm border border-line bg-surface p-3">
                          <p className="mb-1.5 font-display text-sm font-bold text-ink">{item.name}</p>
                          <ul className="flex flex-col gap-1">
                            {item.alerts.map((al) => (
                              <li
                                key={al.id}
                                className={`rounded-sm px-2.5 py-1.5 text-xs font-medium ${
                                  al.tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'
                                }`}
                              >
                                {al.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </Card>
                )
              })()}
              <ScrollX>
                <table className="w-full border-collapse text-sm sm:min-w-[480px]">
                  <thead className="hidden sm:table-header-group">
                    <tr className="border-b border-line-strong text-left">
                      <th scope="col" className="py-2 pr-3 font-medium text-muted">項目</th>
                      {cols.map((r) => (
                        <th key={r.vendorId} scope="col" className="py-2 pr-3 font-display font-bold text-ink">
                          <Link to={paths.vendor(r.vendorId)} className="hover:text-brand">{nameOf(r.vendorId)}</Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((def) => (
                      <tr key={def.key} className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-b border-line py-3 align-top sm:table-row sm:py-0">
                        <th scope="row" className="col-span-2 text-left text-xs font-semibold text-muted sm:table-cell sm:py-2 sm:pr-3 sm:text-sm sm:font-medium sm:text-ink-soft">
                          {def.label}
                        </th>
                        {cols.map((r) => {
                          const val = def.field && r.unreadable.includes(def.field) ? null : def.value(r.fields)
                          const note = def.field ? r.notes?.[def.field] : undefined
                          return (
                            <td key={r.vendorId} className="min-w-0 sm:table-cell sm:py-2 sm:pr-3">
                              <span className="mb-0.5 block truncate text-xs font-bold text-navy sm:hidden">{nameOf(r.vendorId)}</span>
                              <span className={val == null ? 'text-muted' : 'tabular font-mono text-ink'}>{val ?? NA}</span>
                              {note ? <p className="mt-0.5 text-xs text-muted">{note}</p> : null}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    <tr className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-b border-line py-3 align-top sm:table-row sm:py-0">
                      <th scope="row" className="col-span-2 text-left text-xs font-semibold text-muted sm:table-cell sm:py-2 sm:pr-3 sm:text-sm sm:font-medium sm:text-ink-soft">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <span>估計補助</span>
                          {anyColUsesRelayed ? <Badge tone="warn">經銷商參考區間</Badge> : null}
                        </span>
                      </th>
                      {cols.map((r) => {
                        const sub = colSubsidies.get(r.vendorId)
                        const range = sub?.totalRange ?? null
                        return (
                          <td key={r.vendorId} className="min-w-0 sm:table-cell sm:py-2 sm:pr-3">
                            <span className="mb-0.5 block truncate text-xs font-bold text-navy sm:hidden">{nameOf(r.vendorId)}</span>
                            <span className={range ? 'tabular font-mono text-brand-strong' : 'text-muted'}>
                              {range ? formatNtdRange(range.min, range.max) : '依條件估算'}
                            </span>
                            <p className="mt-0.5 text-xs text-muted">估算，以官方公告為準</p>
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-b border-line py-3 align-top sm:table-row sm:py-0">
                      <th scope="row" className="col-span-2 text-left text-xs font-semibold text-muted sm:table-cell sm:py-2 sm:pr-3 sm:text-sm sm:font-medium sm:text-ink-soft">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <span>扣除補助後</span>
                          <FactSourceBadge source={subsidyFactSource} variant="derived" />
                          {anyColUsesRelayed ? <Badge tone="warn">經銷商參考區間</Badge> : null}
                        </span>
                      </th>
                      {cols.map((r) => {
                        const total = totalNtd(r.fields)
                        const range = colSubsidies.get(r.vendorId)?.totalRange ?? null
                        if (total == null || !range) {
                          return (
                            <td key={r.vendorId} className="min-w-0 sm:table-cell sm:py-2 sm:pr-3">
                              <span className="mb-0.5 block truncate text-xs font-bold text-navy sm:hidden">{nameOf(r.vendorId)}</span>
                              <span className="text-muted">{NA}</span>
                            </td>
                          )
                        }
                        const netMin = Math.max(0, total - range.max)
                        const netMax = Math.max(0, total - range.min)
                        // Same calculation as the 回本試算 card below, so one vendor has one payback.
                        const pb = formatPaybackYears(computeInteractiveRoi(r.fields, range, roiInput))
                        return (
                          <td key={r.vendorId} className="min-w-0 sm:table-cell sm:py-2 sm:pr-3">
                            <span className="mb-0.5 block truncate text-xs font-bold text-navy sm:hidden">{nameOf(r.vendorId)}</span>
                            <span className="tabular font-mono font-semibold text-ink">{formatNtdRange(netMin, netMax)}</span>
                            {pb ? <p className="mt-0.5 text-xs text-muted">{pb}回本（依貴廠電價試算）</p> : null}
                          </td>
                        )
                      })}
                    </tr>
                    {anyColHasTaxCredit ? (
                      <tr className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-b border-line py-3 align-top sm:table-row sm:py-0">
                        <th scope="row" className="col-span-2 text-left text-xs font-semibold text-muted sm:table-cell sm:py-2 sm:pr-3 sm:text-sm sm:font-medium sm:text-ink-soft">
                          另可抵稅（產創 10-1）
                        </th>
                        {cols.map((r) => {
                          const taxRange = colSubsidies.get(r.vendorId)?.taxCreditRange ?? null
                          return (
                            <td key={r.vendorId} className="min-w-0 sm:table-cell sm:py-2 sm:pr-3">
                              <span className="mb-0.5 block truncate text-xs font-bold text-navy sm:hidden">{nameOf(r.vendorId)}</span>
                              {taxRange ? (
                                <>
                                  <span className="tabular font-mono text-ink">
                                    另可抵稅，上限{formatNtdRange(taxRange.min, taxRange.max)}
                                  </span>
                                  <p className="mt-0.5 text-xs text-muted">不計入現金補助，受當年應納營所稅 30% 限制</p>
                                </>
                              ) : (
                                <span className="text-muted">未達 100 萬門檻</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </ScrollX>
              <Card className="flex flex-col gap-4 border-brand bg-sunken" aria-label="回本試算">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-ink">
                      <Calculator className="size-4 text-brand-strong" aria-hidden />
                      <span>回本試算（依貴廠電價與運轉時數）</span>
                      <FactSourceBadge source={roiFactSource} variant="derived" />
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      用廠商報的每月省電度數，乘上貴廠電價與運轉時數算回本年數；沒填的部分先用平台預設（每天 16 小時、一年 300 天、每度 4.2 元）。上方表格的回本也是這個數字；報價單自己寫的回本只列在表格供參考。
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<RotateCcw className="size-3.5" aria-hidden />}
                    onClick={() => {
                      setRoiRateOverride(null)
                      setRoiHoursOverride(null)
                      setRoiDaysOverride(null)
                    }}
                  >
                    重設預設值
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="平均電價（元／度）">
                    {(p) => (
                      <TextInput
                        {...p}
                        inputMode="decimal"
                        value={roiRate}
                        onChange={(e) => setRoiRateOverride(e.target.value)}
                        className="tabular font-mono"
                      />
                    )}
                  </Field>
                  <Field label="每日運轉時數（小時）">
                    {(p) => (
                      <TextInput
                        {...p}
                        inputMode="decimal"
                        value={roiHours}
                        onChange={(e) => setRoiHoursOverride(e.target.value)}
                        className="tabular font-mono"
                      />
                    )}
                  </Field>
                  <Field label="年運轉天數（天）">
                    {(p) => (
                      <TextInput
                        {...p}
                        inputMode="numeric"
                        value={roiDays}
                        onChange={(e) => setRoiDaysOverride(e.target.value)}
                        className="tabular font-mono"
                      />
                    )}
                  </Field>
                </div>
                <FactProvenance
                  title="回本試算用了哪些工廠數據"
                  items={roiProvenanceItems}
                  onApply={isOwner && factoryDoc ? applyFactoryFacts : undefined}
                  readOnly={readOnly || !isOwner}
                  readOnlyReason={readOnly ? '目前是唯讀模式，資料無法儲存。' : '只有這家工廠本人可以修改工廠數據。'}
                  profileHref={isOwner ? paths.profile() : undefined}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  {cols.map((r) => {
                    const subRange = colSubsidies.get(r.vendorId)?.totalRange ?? null
                    const roi = computeInteractiveRoi(r.fields, subRange, roiInput)
                    return (
                      <div key={r.vendorId} className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-bold text-ink">{nameOf(r.vendorId)}</span>
                          <Badge tone="navy">{`運轉時數是平台基準的 ${formatNumber(roi.hoursMultiplier, 1)} 倍`}</Badge>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                          <div>
                            <dt className="text-muted">試算年省電度數</dt>
                            <dd className="tabular font-mono font-semibold text-ink">
                              {roi.annualSaveKwh != null ? `${formatNumber(roi.annualSaveKwh)} 度` : NA}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted">試算年省電費</dt>
                            <dd className="tabular font-mono font-semibold text-brand-strong">
                              {roi.annualSaveNtd != null ? formatNtd(roi.annualSaveNtd) : NA}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted">扣除補助後回本</dt>
                            <dd className="tabular font-mono font-bold text-ink">{formatPaybackYears(roi) ?? NA}</dd>
                          </div>
                          <div>
                            <dt className="text-muted">5 年預估淨省收益</dt>
                            <dd className="tabular font-mono font-semibold text-ink">
                              {roi.fiveYearNetGainMin != null && roi.fiveYearNetGainMax != null
                                ? roi.fiveYearNetGainMin === roi.fiveYearNetGainMax
                                  ? formatNtd(roi.fiveYearNetGainMin)
                                  : formatNtdRange(roi.fiveYearNetGainMin, roi.fiveYearNetGainMax)
                                : NA}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    )
                  })}
                </div>
              </Card>
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-base font-bold text-ink">建議向廠商確認的問題</h3>
                {questions.length ? (
                  <ul className="flex flex-col gap-2">
                    {questions.map((q, i) => (
                      <li key={i} className="flex flex-wrap items-start gap-2 text-sm text-ink-soft">
                        <Badge tone="warn">{q.vendorId ? nameOf(q.vendorId) : '各家'}</Badge>
                        <span className="min-w-0 flex-1 break-words">{q.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">各項欄位都已載明，沒有需要補問的項目。</p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-xs text-muted">解說時間：{new Date(cmp.generatedAt).toLocaleString('zh-TW')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<Printer className="size-4" aria-hidden />}
                    onClick={() => window.print()}
                  >
                    列印／存成 PDF 供內部簽核
                  </Button>
                  {c.stage === 'quote' ? (
                    <ButtonLink to={paths.case(c.id)} size="sm" icon={<ArrowRight className="size-4" aria-hidden />}>
                      前往案件進度選擇簽約廠商
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </section>
      ) : null}

      {!embedded ? (
        <div className="mt-6">
          <FeedbackNudge
            context="統一欄位比較報價、並自動算出扣除政府補助後的回本時間，對您評估方案有幫助嗎？"
            nextStep={{ to: paths.case(c.id), label: '下一步：看 8 階段追蹤' }}
          />
        </div>
      ) : null}
    </>
  )
}
