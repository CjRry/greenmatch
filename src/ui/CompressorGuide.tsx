import { useState } from 'react'
import { CheckSquare, ClipboardCopy, Gauge, Square } from 'lucide-react'
import {
  formatPreSurveyChecklistText,
  PRE_SURVEY_FACTORY_PREP,
  PRE_SURVEY_VENDOR_QUESTIONS,
  summarizeAirCompressorPublicBenchmark,
  type PreSurveyOptionalInputs,
} from '../core/domain/compressorReport'
import { formatKwh, formatNtd, formatNumber } from '../core/format'
import type { FactSourceKind, PublicCase } from '../core/types'
import { Badge } from './Badge'
import { Button } from './Button'
import { Card } from './Card'
import { FactSourceBadge } from './FactProvenance'
import { PublicCaseBadge, SourceLink } from './PublicCases'
import { useToast } from './Toast'

export interface CompressorHonestSectionProps {
  cases: readonly PublicCase[]
  electricityRate: number
  rateSource: FactSourceKind
  optionalInputs?: PreSurveyOptionalInputs
  allCasesTo?: string
}

/**
 * PROP-0007 4b shared block for factories with air compressors:
 * - Honest range from PROP-0006 public cases only (never fabricates a % when source omits baseline kWh)
 * - Explicit optional handling of 風量 (m³/min) — missing values never block the report
 * - Interactive pre-survey checklist (工廠要準備 4 項 + 要問廠商 3 項) with 1-click copy
 */
export function CompressorHonestSection({
  cases,
  electricityRate,
  rateSource,
  optionalInputs = {},
}: CompressorHonestSectionProps) {
  const toast = useToast()
  const benchmark = summarizeAirCompressorPublicBenchmark(cases, electricityRate)
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(() => new Set())

  const toggleItem = (id: string) => {
    setCheckedIds((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyChecklist = async () => {
    const text = formatPreSurveyChecklistText(optionalInputs)
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast({ title: '已複製場勘前清單', body: '可直接貼到 LINE 或 Email 備忘，場勘時逐項對照。', tone: 'success' })
        return
      }
    } catch {
      // Clipboard API can be blocked in non-HTTPS or test environments; fall through to friendly notice.
    }
    toast({ title: '請手動複製下方清單項目', body: '目前瀏覽器環境無法自動寫入剪貼簿，可直接勾選對照使用。', tone: 'info' })
  }

  const totalChecklist = PRE_SURVEY_FACTORY_PREP.length + PRE_SURVEY_VENDOR_QUESTIONS.length

  return (
    <Card className="flex flex-col gap-4 border-line-strong" aria-label="空壓機誠實區間與場勘前清單">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="navy" icon={<Gauge className="size-3.5" aria-hidden />}>
              公開案例實績範圍（非本廠預測）
            </Badge>
            <Badge tone="outline">
              {optionalInputs.airFlowM3Min != null
                ? `風量已填 ${formatNumber(optionalInputs.airFlowM3Min, 1)} m³/min`
                : '風量 m³/min 未填（選填・不卡報告）'}
            </Badge>
          </div>
          <h3 className="mt-2 font-display text-base font-bold text-ink">空壓機公開案例實績範圍與場勘前準備</h3>
        </div>
        <Button type="button" size="sm" variant="secondary" icon={<ClipboardCopy className="size-3.5" aria-hidden />} onClick={() => void copyChecklist()}>
          複製場勘前清單（{checkedIds.size}/{totalChecklist}）
        </Button>
      </div>

      {/* 公開案例實績說明（僅供量級參考，非貴廠節電預測） */}
      <div className="rounded-sm border border-brand/30 bg-brand-soft px-3.5 py-3 text-sm text-ink">
        <p className="font-semibold text-brand-strong">{benchmark.honestSummary}</p>
        <p className="mt-1 text-xs text-ink-soft">
          以下為他廠公開案例的實績範圍，僅供量級參考，不是對貴廠能省多少的預測；空壓系統實際耗電受管路洩漏率、空重車比例與設定壓力影響極大，沒看過 12 個月電費變化與掛表實測一週前，任何先喊固定省電 % 的承諾都要保留查證。
        </p>
      </div>

      {/* 同類公開案例逐筆出處 */}
      {benchmark.cases.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>
              以下同類空壓機公開案例共 {benchmark.totalCases} 筆（依目前電價{' '}
              <span className="tabular font-mono font-semibold text-ink">{formatNumber(electricityRate, 2)} 元/度</span> 重算扣補助前回本）：
            </span>
            <FactSourceBadge source={rateSource} />
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {benchmark.cases.map((c, idx) => {
              const row = benchmark.backtestRows[idx]
              return (
                <li key={c.id} className="flex min-w-0 flex-col gap-2 rounded-sm border border-line bg-sunken p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <PublicCaseBadge />
                    <span className="font-semibold text-ink">{c.title}</span>
                  </div>
                  <p className="text-ink-soft">
                    {c.industry}・{c.equipmentNote}
                  </p>
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <dt className="text-muted">改善前／後</dt>
                      <dd className="font-mono text-ink">
                        {c.beforeKwhPerYear != null && c.afterKwhPerYear != null
                          ? `${formatKwh(c.beforeKwhPerYear)} → ${formatKwh(c.afterKwhPerYear)}`
                          : '來源未揭露'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">年節電</dt>
                      <dd className="tabular font-mono text-ink">{c.savedKwhPerYear != null ? formatKwh(c.savedKwhPerYear) : '來源未揭露'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">投資額</dt>
                      <dd className="tabular font-mono text-ink">{c.investmentNtd != null ? formatNtd(c.investmentNtd) : '來源未揭露'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">來源／重算回本</dt>
                      <dd className="tabular font-mono font-semibold text-brand-strong">
                        {c.reportedPaybackYears != null ? `${formatNumber(c.reportedPaybackYears, 1)} 年` : '—'}
                        {row?.platformPaybackYears != null ? ` / ${formatNumber(row.platformPaybackYears, 1)} 年` : ''}
                      </dd>
                    </div>
                  </dl>
                  <SourceLink c={c} />
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {/* 場勘前清單：工廠要準備 4 項 ＋ 要問廠商 3 項 */}
      <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h4 className="font-display text-sm font-bold text-ink">場勘前清單：工廠要先準備（4 項）</h4>
          <ul className="flex flex-col gap-2">
            {PRE_SURVEY_FACTORY_PREP.map((item) => {
              const checked = checkedIds.has(item.id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleItem(item.id)}
                    className="flex w-full items-start gap-2.5 rounded-sm border border-line bg-surface p-2.5 text-left transition-colors hover:border-brand"
                  >
                    {checked ? (
                      <CheckSquare className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                    ) : (
                      <Square className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={checked ? 'block text-sm font-semibold text-muted line-through' : 'block text-sm font-semibold text-ink'}>
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-soft">{item.detail}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="font-display text-sm font-bold text-ink">場勘與報價時：一定要問廠商（3 項）</h4>
          <ul className="flex flex-col gap-2">
            {PRE_SURVEY_VENDOR_QUESTIONS.map((item) => {
              const checked = checkedIds.has(item.id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleItem(item.id)}
                    className="flex w-full items-start gap-2.5 rounded-sm border border-line bg-surface p-2.5 text-left transition-colors hover:border-brand"
                  >
                    {checked ? (
                      <CheckSquare className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                    ) : (
                      <Square className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={checked ? 'block text-sm font-semibold text-muted line-through' : 'block text-sm font-semibold text-ink'}>
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-soft">{item.detail}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Card>
  )
}
