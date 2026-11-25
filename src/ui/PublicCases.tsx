import { Link } from 'react-router'
import { ExternalLink, FileCheck2 } from 'lucide-react'
import { EQUIP_INFO } from '../core/constants/equipment'
import { backtestPublicCase, summarizeBacktest, type PublicCaseBacktestRow, type PublicCaseBacktestSummary } from '../core/domain/publicCaseBacktest'
import { formatKwh, formatNtd, formatNumber } from '../core/format'
import type { FactSourceKind, PublicCase, Specialty } from '../core/types'
import { Badge } from './Badge'
import { Card } from './Card'
import { Stat } from './Domain'
import { FactSourceBadge } from './FactProvenance'
import { EmptyState, ScrollX } from './States'
import { cx } from './cx'

/** Shown wherever a value is missing from the source. Never replace it with an estimate. */
export const NOT_DISCLOSED = '來源未揭露'

/**
 * Marks a real, published case. It is not a platform user and not a demo record, so it never
 * appears next to `DemoBadge` on the same item.
 */
export function PublicCaseBadge({ className }: { className?: string }) {
  return (
    <Badge tone="navy" icon={<FileCheck2 className="size-3" aria-hidden />} className={className}>
      公開案例
    </Badge>
  )
}

/** One sentence that has to sit next to any list of public cases. */
export const PUBLIC_CASE_DISCLAIMER = '以下為經濟部能源署公開的節能標竿案例，數字照錄來源並附出處；這些企業沒有使用本平台，案例也不代表本平台的服務成果。'

const years = (n: number | null) => (n == null ? NOT_DISCLOSED : `${formatNumber(n, 1)} 年`)
const kwh = (n: number | null) => (n == null ? NOT_DISCLOSED : formatKwh(n))
const ntd = (n: number | null) => (n == null ? NOT_DISCLOSED : formatNtd(n))
const signed = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n), 1)} 年`)

export function SourceLink({ c, className }: { c: PublicCase; className?: string }) {
  return (
    <a
      href={c.source.url}
      target="_blank"
      rel="noreferrer noopener"
      className={cx('inline-flex flex-wrap items-center gap-1 text-xs font-medium text-brand-strong hover:underline', className)}
    >
      <span>{c.source.publisher}・</span>
      <span className="whitespace-nowrap">案例 {c.source.caseNo}</span>
      <ExternalLink className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">（另開新視窗）</span>
    </a>
  )
}

/** A compact card for the home page. */
export function PublicCaseCard({ c, row }: { c: PublicCase; row?: PublicCaseBacktestRow }) {
  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <PublicCaseBadge />
        <Badge tone="outline">{EQUIP_INFO[c.equip].label}</Badge>
      </div>
      <div className="min-w-0">
        <h3 className="font-display font-bold text-ink">{c.title}</h3>
        <p className="text-xs text-muted">{c.industry}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3 sm:text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-muted">年節電</dt>
          <dd className="tabular whitespace-nowrap font-mono text-ink">{kwh(c.savedKwhPerYear)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted">投資</dt>
          <dd className="tabular whitespace-nowrap font-mono text-ink">{ntd(c.investmentNtd)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted">來源回本</dt>
          <dd className="tabular whitespace-nowrap font-mono text-ink">{years(c.reportedPaybackYears)}</dd>
        </div>
      </dl>
      {row && row.platformPaybackYears != null ? (
        <p className="text-xs text-ink-soft">
          平台試算 <span className="tabular font-mono text-ink">{years(row.platformPaybackYears)}</span>，誤差{' '}
          <span className="tabular font-mono text-ink">{signed(row.errorYears)}</span>
        </p>
      ) : null}
      <SourceLink c={c} className="mt-auto" />
    </Card>
  )
}

/**
 * Payback before any vendor has quoted: real cases with the same equipment, each re-run through the
 * platform calculation at this factory's electricity price. Every input number comes from a public
 * source; nothing is scaled to the factory's size (that would be an estimate we cannot source).
 */
export function SimilarCasePayback({
  equips,
  electricityRate,
  rateSource,
  cases,
  allCasesTo,
}: {
  equips: readonly Specialty[]
  electricityRate: number
  rateSource: FactSourceKind
  cases: readonly PublicCase[]
  /** Link to the full public-case page (paths.publicCases()). */
  allCasesTo: string
}) {
  const wanted = new Set(equips)
  const similar = cases.filter((c) => wanted.has(c.equip))
  const reported = similar.map((c) => c.reportedPaybackYears).filter((n): n is number => n != null)
  return (
    <section className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4" aria-label="回本參考">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-ink">回本參考：同設備的公開案例</h2>
          <p className="text-sm text-ink-soft">
            廠商還沒報價前，先看同類設備真實案例花多少、多久回本。收到報價後，平台會用貴廠的電價重算這一案的回本。
          </p>
        </div>
        <Link to={allCasesTo} className="text-sm font-medium text-brand-strong hover:underline">
          看全部公開案例與回測誤差
        </Link>
      </div>
      {similar.length === 0 ? (
        <p className="text-sm text-muted">目前還沒有同設備的公開案例。可以先看其他設備的案例，或等廠商場勘後報價，平台會依報價算回本。</p>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
            <span>
              {similar.length} 筆同設備公開案例，來源公布的回本
              <span className="tabular mx-1 font-mono font-semibold">
                {reported.length ? `${formatNumber(Math.min(...reported), 1)}–${formatNumber(Math.max(...reported), 1)}` : '—'}
              </span>
              年（未扣補助）。右欄用貴廠電價每度 <span className="tabular font-mono font-semibold">{formatNumber(electricityRate, 2)}</span> 元重算
            </span>
            <FactSourceBadge source={rateSource} />
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {similar.map((c) => {
              const row = backtestPublicCase(c, electricityRate)
              return (
                <li key={c.id} className="flex min-w-0 flex-col gap-2 rounded-sm border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <PublicCaseBadge />
                    <span className="font-medium text-ink">{c.title}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {c.industry}・{c.equipmentNote}
                  </p>
                  <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted">投資</dt>
                      <dd className="tabular whitespace-nowrap font-mono text-ink">{ntd(c.investmentNtd)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted">年節電</dt>
                      <dd className="tabular whitespace-nowrap font-mono text-ink">{kwh(c.savedKwhPerYear)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted">來源回本</dt>
                      <dd className="tabular whitespace-nowrap font-mono text-ink">{years(c.reportedPaybackYears)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted">用貴廠電價</dt>
                      <dd className="tabular whitespace-nowrap font-mono font-semibold text-brand-strong">{years(row.platformPaybackYears)}</dd>
                    </div>
                  </dl>
                  <SourceLink c={c} />
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-muted">
            案例的規模與運轉條件和貴廠不同，回本只能當量級參考；補助可再縮短回本，金額見補助明細。這些企業沒有使用本平台。
          </p>
        </>
      )}
    </section>
  )
}

/** The two acceptance numbers plus the bias, as a meter strip. */
export function PublicCaseStats({ cases, summary = summarizeBacktest(cases) }: { cases: readonly PublicCase[]; summary?: PublicCaseBacktestSummary }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-4 rounded-md border border-line bg-surface p-4 sm:grid-cols-4">
        <Stat label="有出處的公開案例" value={formatNumber(cases.length)} unit="筆" tone="navy" />
        <Stat
          label="已知節電量時，電費與回本換算誤差"
          value={summary.maeYears == null ? '—' : formatNumber(summary.maeYears, 1)}
          unit="年"
          tone="brand"
          note={summary.comparedCount ? `${summary.comparedCount} 筆回測，平均絕對誤差` : '尚無可回測案例'}
        />
        <Stat
          label="平均偏差"
          value={summary.biasYears == null ? '—' : signed(summary.biasYears).replace(' 年', '')}
          unit="年"
          note={summary.biasYears != null && summary.biasYears < 0 ? '負值＝平台算得比實際快回本' : undefined}
        />
        <Stat
          label="平均相對誤差"
          value={summary.mapePct == null ? '—' : formatNumber(summary.mapePct, 1)}
          unit="%"
          note={summary.maxAbsErrorYears != null ? `單筆最大 ${formatNumber(summary.maxAbsErrorYears, 1)} 年` : undefined}
        />
      </div>
      <p className="text-xs text-muted">
        本回測只驗證「節電量 → 電費 → 回本」的換算，未驗證節電量預測。
      </p>
    </div>
  )
}

/** Full backtest table: every source number, the platform's result and the error. */
export function PublicCaseBacktestTable({ cases, summary = summarizeBacktest(cases) }: { cases: readonly PublicCase[]; summary?: PublicCaseBacktestSummary }) {
  if (cases.length === 0)
    return (
      <EmptyState
        icon={<FileCheck2 className="size-6" aria-hidden />}
        title="還沒有查證完成的公開案例"
        body="公開案例要由平台人員打開來源逐一核對數字後才會加入；加入後，這裡會列出每筆的出處與回測誤差。"
      />
    )
  const rowOf = new Map(summary.rows.map((r) => [r.caseId, r]))
  const th = 'px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap'
  const td = 'px-3 py-2 align-top'
  const num = 'tabular font-mono whitespace-nowrap text-ink'
  return (
    <ScrollX className="rounded-md border border-line bg-surface">
      <table className="w-full min-w-[64rem] border-collapse text-sm">
        <caption className="sr-only">公開案例回本回測：來源公布的數字、平台試算結果與誤差</caption>
        <thead className="border-b border-line bg-sunken">
          <tr>
            <th scope="col" className={th}>案例</th>
            <th scope="col" className={th}>改善前／後年用電</th>
            <th scope="col" className={th}>年節電</th>
            <th scope="col" className={th}>年省電費</th>
            <th scope="col" className={th}>投資</th>
            <th scope="col" className={th}>補助</th>
            <th scope="col" className={th}>來源回本</th>
            <th scope="col" className={th}>平台試算回本</th>
            <th scope="col" className={th}>誤差</th>
            <th scope="col" className={th}>出處</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => {
            const r = rowOf.get(c.id)
            return (
              <tr key={c.id} className="border-b border-line last:border-b-0">
                <th scope="row" className={cx(td, 'min-w-[14rem] text-left font-normal')}>
                  <span className="block font-medium text-ink">{c.title}</span>
                  <span className="block text-xs text-muted">
                    {c.industry}・{EQUIP_INFO[c.equip].label}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-soft">{c.equipmentNote}</span>
                  {c.note ? <span className="mt-0.5 block text-xs text-muted">{c.note}</span> : null}
                </th>
                <td className={cx(td, num)}>
                  {c.beforeKwhPerYear != null && c.afterKwhPerYear != null ? (
                    <>
                      {formatKwh(c.beforeKwhPerYear)}
                      <span className="block text-muted">→ {formatKwh(c.afterKwhPerYear)}</span>
                    </>
                  ) : (
                    <span className="font-sans text-muted">{NOT_DISCLOSED}</span>
                  )}
                </td>
                <td className={cx(td, num)}>{kwh(c.savedKwhPerYear)}</td>
                <td className={cx(td, num)}>{ntd(c.savedNtdPerYear)}</td>
                <td className={cx(td, num)}>{ntd(c.investmentNtd)}</td>
                <td className={cx(td, c.subsidyNtd == null ? 'whitespace-nowrap text-muted' : num)}>{ntd(c.subsidyNtd)}</td>
                <td className={cx(td, num)}>{years(c.reportedPaybackYears)}</td>
                <td className={cx(td, num)}>
                  {years(r?.platformPaybackYears ?? null)}
                  {r?.platformNetPaybackYears != null ? <span className="block text-xs text-muted">扣補助 {years(r.platformNetPaybackYears)}</span> : null}
                </td>
                <td className={cx(td, num)}>{signed(r?.errorYears ?? null)}</td>
                <td className={cx(td, 'min-w-[12rem]')}>
                  <SourceLink c={c} />
                  <span className="mt-0.5 block text-xs text-muted">{c.source.section}</span>
                  <span className="block text-xs text-muted">{c.source.checkedDate} 核對</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ScrollX>
  )
}
