import { useState } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, Clock, ExternalLink, HandCoins, HelpCircle, Info, XCircle } from 'lucide-react'
import type { NumericFactoryFactKey } from '../core/domain/factoryFacts'
import { formatNtdRange } from '../core/format'
import { paths } from '../core/paths'
import {
  COMMERCIAL_EXCLUSION_NOTE,
  stageSubsidyReminders,
  type SubsidyId,
  type SubsidyMatchItem,
  type SubsidyMatchSummary,
  type SubsidyStatus,
} from '../core/subsidies'
import type { StageKey } from '../core/types'
import { Badge, type BadgeTone } from './Badge'
import { Button } from './Button'
import { Card } from './Card'
import { Dialog } from './Dialog'
import { FactProvenance, FactSourceBadge } from './FactProvenance'

const STATUS_META: Record<SubsidyStatus, { label: string; tone: BadgeTone }> = {
  likely: { label: '可能適用', tone: 'brand' },
  needs_info: { label: '需補資料／待確認', tone: 'warn' },
  closed: { label: '本期已截止', tone: 'neutral' },
  not_applicable: { label: '不適用', tone: 'outline' },
}

/**
 * 轉述來源（reliability: 'relayed'）的標籤文字。
 * 投資抵減（tax-credit）已經施行，只是比率依報導整理，所以不寫「待開辦」。
 */
export function relayedLabel(id: SubsidyId): string {
  if (id === 'tax-credit') return '政策參考'
  return '政策參考／待開辦'
}

function StatusIcon({ status }: { status: SubsidyStatus }) {
  if (status === 'likely') return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
  if (status === 'needs_info') return <HelpCircle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
  if (status === 'closed') return <Clock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
  return <XCircle className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
}

/** Shown on vendor cards, recommendations and profiles when the vendor assists with subsidy applications. */
export function VendorSubsidyBadge() {
  return (
    <Badge tone="brand" icon={<HandCoins className="size-3" aria-hidden />}>
      可協助申請補助
    </Badge>
  )
}

/** Schemes that are pending open, closed, or not applicable are folded into「其他方案」. */
function isOtherSubsidyItem(it: SubsidyMatchItem): boolean {
  return (
    it.status === 'closed' ||
    it.status === 'not_applicable' ||
    (it.def.reliability === 'relayed' && it.def.id !== 'tax-credit')
  )
}

function SubsidyDialogListItem({ item, onInspect }: { item: SubsidyMatchItem; onInspect: (id: SubsidyId) => void }) {
  const meta = STATUS_META[item.status]
  return (
    <li className="rounded-sm border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <Badge tone="navy">{item.def.kind}</Badge>
          <span className="font-medium text-ink">{item.def.name}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onInspect(item.def.id)}>
          規則與來源
        </Button>
      </div>
      <p className="mt-1.5 text-ink-soft">{item.reason}</p>
      <p className="mt-1 text-xs text-muted">
        {item.def.agency}・查核日 {item.def.checkedDate}
      </p>
    </li>
  )
}

export function SubsidyDialog({
  open,
  onClose,
  summary,
  initialId = null,
}: {
  open: boolean
  onClose: () => void
  summary: SubsidyMatchSummary
  initialId?: SubsidyId | null
}) {
  const [selectedId, setSelectedId] = useState<SubsidyId | null>(initialId)

  const activeId = selectedId ?? initialId
  const focused = activeId ? summary.items.find((i) => i.def.id === activeId) ?? null : null
  const activeItems = summary.items.filter((i) => !isOtherSubsidyItem(i))
  const otherItems = summary.items.filter((i) => isOtherSubsidyItem(i))

  const handleClose = () => {
    setSelectedId(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={focused ? focused.def.name : '製造業節能補助與資源說明'}
      footer={
        <>
          {focused ? (
            <Button variant="secondary" onClick={() => setSelectedId(null)}>
              看全部 7 項方案
            </Button>
          ) : null}
          <Button onClick={handleClose}>關閉</Button>
        </>
      }
    >
      {focused ? (
        <SubsidyItemDetail item={focused} />
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <div className="rounded-sm bg-sunken px-3 py-2 text-ink-soft">
            <p className="font-medium text-ink">為什麼沒有新聞上常見的 50 萬補助？</p>
            <p className="mt-1">{COMMERCIAL_EXCLUSION_NOTE}</p>
          </div>
          {activeItems.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {activeItems.map((it) => (
                <SubsidyDialogListItem key={it.def.id} item={it} onInspect={setSelectedId} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">目前條件下暫無直接適用之主動申請補助，可展開下方查看其他方案與說明。</p>
          )}
          {otherItems.length > 0 ? (
            <details className="rounded-sm border border-line bg-sunken p-3">
              <summary className="cursor-pointer font-medium text-ink">
                其他方案（{otherItems.length} 項：待開辦／不適用／已截止）
              </summary>
              <ul className="mt-3 flex flex-col gap-3">
                {otherItems.map((it) => (
                  <SubsidyDialogListItem key={it.def.id} item={it} onInspect={setSelectedId} />
                ))}
              </ul>
            </details>
          ) : null}
          <p className="text-xs text-muted">
            {summary.disclaimer}・查核日 {summary.checkedDate}
          </p>
        </div>
      )}
    </Dialog>
  )
}

function SubsidyItemDetail({ item }: { item: SubsidyMatchItem }) {
  const { def } = item
  const meta = STATUS_META[item.status]
  const amt = item.amount ? formatNtdRange(item.amount.min, item.amount.max) : item.amountNote
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <Badge tone="navy">{def.kind}</Badge>
        <Badge tone={def.reliability === 'official' ? 'brand' : 'warn'}>
          {def.reliability === 'official' ? '官方原文' : '轉述（未對到官方基準表）'}
        </Badge>
      </div>
      <p className="text-ink">{def.plainDesc}</p>
      {amt ? (
        <p className="rounded-sm bg-brand-soft px-3 py-2 font-medium text-brand-strong">
          本次試算：{amt}（估算，以官方公告為準）
        </p>
      ) : null}
      <dl className="flex flex-col gap-2">
        <div>
          <dt className="text-xs text-muted">主辦機關</dt>
          <dd className="text-ink">{def.agency}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">比對結果</dt>
          <dd className="text-ink-soft">{item.reason}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">補助額度規則</dt>
          <dd className="text-ink-soft">{def.amountRule}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">資格條件</dt>
          <dd className="text-ink-soft">{def.eligibility}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">受理期間</dt>
          <dd className="text-ink-soft">{def.periodText}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">資料可信度說明</dt>
          <dd className="text-ink-soft">{def.reliabilityNote}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
        <span>查核日 {def.checkedDate}</span>
        <a
          href={def.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-brand-strong hover:underline"
        >
          {def.sourceLabel}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </div>
  )
}

function SubsidyCardRow({
  item: it,
  showProfileHint,
  onSaveContractKw,
  kwDraft,
  setKwDraft,
  openItem,
}: {
  item: SubsidyMatchItem
  showProfileHint: boolean
  onSaveContractKw?: (kw: number) => void
  kwDraft: string
  setKwDraft: (v: string) => void
  openItem: (id: SubsidyId) => void
}) {
  const amountText = it.amount ? formatNtdRange(it.amount.min, it.amount.max) : it.amountNote
  const needsContract = it.missingFields.includes('契約容量（kW）')
  return (
    <li className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <StatusIcon status={it.status} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => openItem(it.def.id)}
                className="text-left font-medium text-ink hover:text-brand-strong hover:underline"
              >
                {it.def.name}
              </button>
              <span className="text-xs text-muted">（{it.def.agency}）</span>
              {it.def.reliability === 'relayed' ? <Badge tone="warn">{relayedLabel(it.def.id)}</Badge> : null}
            </div>
            <p className="mt-0.5 break-words text-sm text-ink-soft">{it.reason}</p>
            {it.deadlineNote ? <p className="mt-0.5 text-xs text-muted">{it.deadlineNote}</p> : null}
            {needsContract && showProfileHint ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {onSaveContractKw ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="快速填入契約容量（kW）"
                      placeholder="填入契約容量 kW（如 250）"
                      value={kwDraft}
                      onChange={(e) => setKwDraft(e.target.value)}
                      className="h-8 w-44 rounded-sm border border-line-strong bg-surface px-2 font-mono text-xs text-ink"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!Number.isFinite(Number(kwDraft)) || Number(kwDraft) <= 0}
                      onClick={() => {
                        const n = Number(kwDraft)
                        if (Number.isFinite(n) && n > 0) onSaveContractKw(n)
                      }}
                    >
                      即時試算 ESCO
                    </Button>
                  </div>
                ) : null}
                <Link to={paths.profile()} className="inline-block text-xs font-medium text-brand-strong hover:underline">
                  前往公司資料補填契約容量
                </Link>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pl-6 sm:max-w-[15rem] sm:shrink-0 sm:flex-col sm:items-end sm:gap-1 sm:pl-0 sm:text-right">
          {amountText ? (
            <span
              className={
                it.amount
                  ? 'tabular font-mono text-sm font-semibold text-ink'
                  : 'break-words text-xs text-ink-soft'
              }
            >
              {amountText}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => openItem(it.def.id)}
            className="shrink-0 text-xs text-brand-strong hover:underline"
          >
            來源與條件
          </button>
        </div>
      </div>
    </li>
  )
}

/** One-line compact subsidy summary used on NeedWizard step 3 & MatchResult; full list stays on CaseTracker & SubsidyDialog. */
export function SubsidySummaryBar({
  summary,
  className = '',
}: {
  summary: SubsidyMatchSummary
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const applicable = summary.items.filter((i) => !isOtherSubsidyItem(i))
  const rangeText = summary.totalRange
    ? `，估算${formatNtdRange(summary.totalRange.min, summary.totalRange.max)}`
    : summary.taxCreditRange
      ? `，另可抵稅上限 ${formatNtdRange(summary.taxCreditRange.min, summary.taxCreditRange.max)}`
      : ''

  return (
    <>
      <div
        className={`flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-4 py-3 text-sm ${className}`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <HandCoins className="size-4 shrink-0 text-brand" aria-hidden />
          <span className="font-medium text-ink">
            {applicable.length > 0
              ? `可能適用 ${applicable.length} 項補助${rangeText}`
              : '目前條件暫無直接適用的補助'}
          </span>
          <FactSourceBadge source={summary.factSource} variant="derived" />
          <span className="text-xs text-muted">{summary.disclaimer}</span>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          看明細
        </Button>
      </div>
      <SubsidyDialog open={open} onClose={() => setOpen(false)} summary={summary} />
    </>
  )
}

export function SubsidyCard({
  summary,
  title = '可能適用的補助',
  showProfileHint = true,
  onSaveContractKw,
  onUpdateFacts,
  readOnly = false,
}: {
  summary: SubsidyMatchSummary
  title?: string
  showProfileHint?: boolean
  onSaveContractKw?: (kw: number) => void
  onUpdateFacts?: (updates: Partial<Record<NumericFactoryFactKey, number>>) => Promise<void> | void
  readOnly?: boolean
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogId, setDialogId] = useState<SubsidyId | null>(null)
  const [kwDraft, setKwDraft] = useState('')

  const applyFacts =
    onUpdateFacts ??
    (onSaveContractKw
      ? (updates: Partial<Record<NumericFactoryFactKey, number>>) => {
          if (updates.contractKw != null) onSaveContractKw(updates.contractKw)
        }
      : undefined)

  const order: Record<SubsidyStatus, number> = { likely: 0, needs_info: 1, closed: 2, not_applicable: 3 }
  const activeItems = summary.items
    .filter((i) => !isOtherSubsidyItem(i))
    .sort((a, b) => order[a.status] - order[b.status])
  const otherItems = summary.items
    .filter((i) => isOtherSubsidyItem(i))
    .sort((a, b) => order[a.status] - order[b.status])

  const openItem = (id: SubsidyId | null) => {
    setDialogId(id)
    setDialogOpen(true)
  }

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-bold text-ink">{title}</h2>
            <FactSourceBadge source={summary.factSource} variant="derived" />
            <Badge tone="outline">{summary.disclaimer}</Badge>
            {summary.totalRange && summary.usesRelayedRates ? <Badge tone="warn">經銷商參考區間</Badge> : null}
          </div>
          <div className="flex flex-col items-end gap-0.5">
            {summary.totalRange ? (
              <span className="tabular font-mono text-base font-bold text-brand-strong">
                估算合計 {formatNtdRange(summary.totalRange.min, summary.totalRange.max)}
              </span>
            ) : null}
            {summary.taxCreditRange ? (
              <span className="tabular text-xs font-medium text-ink-soft">
                另可抵稅，上限{formatNtdRange(summary.taxCreditRange.min, summary.taxCreditRange.max)}（受當年應納營所稅 30% 限制）
              </span>
            ) : null}
          </div>
        </div>

        {activeItems.length === 0 ? (
          <p className="text-sm text-ink-soft">目前條件下沒有直接適用的設備補助，可展開下方「其他方案」或查看全部 7 項方案。</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {activeItems.map((it) => (
              <SubsidyCardRow
                key={it.def.id}
                item={it}
                showProfileHint={showProfileHint}
                onSaveContractKw={onSaveContractKw}
                kwDraft={kwDraft}
                setKwDraft={setKwDraft}
                openItem={openItem}
              />
            ))}
          </ul>
        )}

        {otherItems.length > 0 ? (
          <details className="rounded-sm border border-line bg-sunken px-3 py-2 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-ink-soft hover:text-ink">
              其他方案（{otherItems.length} 項：待開辦／不適用／已截止）
            </summary>
            <ul className="mt-2 flex flex-col divide-y divide-line">
              {otherItems.map((it) => (
                <SubsidyCardRow
                  key={it.def.id}
                  item={it}
                  showProfileHint={false}
                  kwDraft={kwDraft}
                  setKwDraft={setKwDraft}
                  openItem={openItem}
                />
              ))}
            </ul>
          </details>
        ) : null}

        {summary.totalNote ? <p className="text-xs text-muted">{summary.totalNote}</p> : null}

        {summary.provenance.length ? (
          <FactProvenance
            items={summary.provenance}
            onApply={applyFacts}
            readOnly={readOnly || !applyFacts}
            readOnlyReason={readOnly ? '目前是唯讀模式，無法修改工廠數據。' : '只有這家工廠本人可以修改工廠數據。'}
            profileHref={paths.profile()}
          />
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-xs text-muted">
          <span>
            {summary.disclaimer}・查核日 {summary.checkedDate}
          </span>
          <button
            type="button"
            onClick={() => openItem(null)}
            className="font-medium text-brand-strong hover:underline"
          >
            查看全部方案與不適用說明
          </button>
        </div>
      </Card>
      <SubsidyDialog open={dialogOpen} onClose={() => setDialogOpen(false)} summary={summary} initialId={dialogId} />
    </>
  )
}

export function SubsidyStageBanner({ stage, summary }: { stage: StageKey; summary: SubsidyMatchSummary }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const reminders = stageSubsidyReminders(stage, summary)
  if (!reminders.length) return null

  return (
    <>
      <div className="rounded-sm border border-line bg-sunken px-3 py-2.5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-ink">
              <Info className="size-4 text-brand" aria-hidden />
              補助提醒（{summary.disclaimer}・查核日 {summary.checkedDate}）
            </span>
            <FactSourceBadge source={summary.factSource} variant="derived" />
          </div>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="text-xs font-medium text-brand-strong hover:underline"
          >
            查看補助明細
          </button>
        </div>
        <ul className="mt-1.5 flex flex-col gap-1 text-ink-soft">
          {reminders.map((r) => (
            <li key={r.id}>
              <strong className="font-medium text-ink">{r.title}：</strong>
              {r.body}
            </li>
          ))}
        </ul>
      </div>
      <SubsidyDialog open={dialogOpen} onClose={() => setDialogOpen(false)} summary={summary} />
    </>
  )
}
