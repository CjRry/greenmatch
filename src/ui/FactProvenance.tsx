import { useState } from 'react'
import { Link } from 'react-router'
import { Calculator, ChevronDown, PencilLine, UserCheck } from 'lucide-react'
import type { NumericFactoryFactKey } from '../core/domain/factoryFacts'
import type { FactSourceKind, FactoryFactKey } from '../core/types'
import { Badge } from './Badge'
import { Button } from './Button'
import { TextInput } from './Field'
import { cx } from './cx'

/** Shows whether a raw field (`field`) or calculated result (`derived`) came from user data or platform estimate. */
export function FactSourceBadge({
  source,
  variant = 'field',
  className,
}: {
  source: FactSourceKind
  variant?: 'field' | 'derived'
  className?: string
}) {
  if (source === 'user') {
    return (
      <Badge tone="brand" className={className} icon={<UserCheck className="size-3" aria-hidden />}>
        {variant === 'derived' ? '依你填的資料' : '你填的'}
      </Badge>
    )
  }
  return (
    <Badge tone="warn" className={className} icon={<Calculator className="size-3" aria-hidden />}>
      {variant === 'derived' ? '含平台估算' : '平台估算'}
    </Badge>
  )
}

export interface ProvenanceItem {
  key: FactoryFactKey | string
  label: string
  displayValue: string
  source: FactSourceKind
  note: string
  editable?: {
    factKey: NumericFactoryFactKey
    initialValue: number | null
    unit: string
    placeholder?: string
    min?: number
    max?: number
  }
}

export interface FactProvenanceProps {
  title?: string
  items: readonly ProvenanceItem[]
  onApply?: (updates: Partial<Record<NumericFactoryFactKey, number>>) => Promise<void> | void
  readOnly?: boolean
  readOnlyReason?: string
  profileHref?: string
  defaultOpen?: boolean
  className?: string
}

/**
 * Expandable provenance panel: lists every input behind a calculated metric, marks whether
 * each input is user-supplied or estimated, and allows editing numbers in place.
 */
export function FactProvenance({
  title = '這個數字用了哪些資料',
  items,
  onApply,
  readOnly = false,
  readOnlyReason,
  profileHref,
  defaultOpen = false,
  className,
}: FactProvenanceProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!items.length) return null

  const estimateCount = items.filter((it) => it.source === 'estimate').length
  const hasEditable = items.some((it) => Boolean(it.editable)) && Boolean(onApply)

  const startEdit = (item: ProvenanceItem) => {
    if (!item.editable || readOnly) return
    setEditingKey(item.key)
    setDraft(item.editable.initialValue != null ? String(item.editable.initialValue) : '')
    setError(null)
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setDraft('')
    setError(null)
  }

  const submitEdit = async (item: ProvenanceItem) => {
    if (!item.editable || !onApply || readOnly) return
    const cleaned = draft.trim().replace(/,/g, '')
    const num = Number(cleaned)
    const min = item.editable.min ?? 0
    const max = item.editable.max
    if (!cleaned || !Number.isFinite(num) || num <= min || (max != null && num > max)) {
      setError(max != null ? `請輸入大於 ${min} 且不超過 ${max} 的數字` : `請輸入大於 ${min} 的有效數字`)
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onApply({ [item.editable.factKey]: num })
      setEditingKey(null)
      setDraft('')
    } catch {
      setError('儲存失敗，請稍後再試一次')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cx('rounded-sm border border-line bg-sunken text-sm', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-surface"
      >
        <span className="flex flex-wrap items-center gap-2 font-medium text-ink">
          <span>{title}</span>
          {estimateCount > 0 ? (
            <Badge tone="warn">含 {estimateCount} 項平台估算</Badge>
          ) : (
            <Badge tone="brand">均依你填的資料計算</Badge>
          )}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong">
          <span>{open ? '收合' : '查看依據與修改'}</span>
          <ChevronDown className={cx('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-2.5 border-t border-line px-3 py-3">
          {readOnly && hasEditable ? (
            <p className="rounded-sm bg-warn-soft px-2.5 py-1.5 text-xs text-warn">
              {readOnlyReason ?? '目前是唯讀模式，無法在此修改工廠數據。'}
            </p>
          ) : null}

          <ul className="flex flex-col divide-y divide-line">
            {items.map((it) => {
              const isEditing = editingKey === it.key && Boolean(it.editable)
              return (
                <li key={it.key} className="flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{it.label}</span>
                      <span className="tabular font-mono text-sm font-semibold text-ink">{it.displayValue}</span>
                      <FactSourceBadge source={it.source} />
                    </div>
                    {it.editable && onApply ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={readOnly}
                        icon={<PencilLine className="size-3.5" aria-hidden />}
                        onClick={() => startEdit(it)}
                      >
                        改成我的數字
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted">{it.note}</p>

                  {isEditing && it.editable ? (
                    <form
                      className="mt-1 flex flex-col gap-2 rounded-sm border border-line-strong bg-surface p-2.5"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void submitEdit(it)
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <TextInput
                            inputMode="decimal"
                            aria-label={`修改${it.label}`}
                            placeholder={it.editable.placeholder ?? '輸入實際數值'}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            className="h-9 max-w-[12rem] tabular font-mono text-sm"
                          />
                          <span className="shrink-0 text-xs text-ink-soft">{it.editable.unit}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button type="submit" size="sm" busy={saving} disabled={readOnly}>
                            套用並重算
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                            取消
                          </Button>
                        </div>
                      </div>
                      {error ? <p className="text-xs text-danger">{error}</p> : null}
                    </form>
                  ) : null}
                </li>
              )
            })}
          </ul>

          {profileHref ? (
            <div className="border-t border-line pt-2 text-xs">
              <Link to={profileHref} className="font-medium text-brand-strong hover:underline">
                前往「我的工廠數據」查看與編輯全部欄位 →
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
