import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FUELS, FUEL_KEYS } from '../../../core/constants/carbon'
import { EQUIPS, EQUIP_INFO } from '../../../core/constants/equipment'
import { monthEmission } from '../../../core/domain/carbon'
import { formatNumber, formatPct, nowIso } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import type { CarbonInventory, Equip, Fuel } from '../../../core/types'
import { Button, Card, Field, ScrollX, SectionTitle, TextInput, useToast } from '../../../ui'
import {
  draftFromInventory,
  fuelKey,
  hasAnyData,
  kwhKey,
  monthsFromDraft,
  sharesFromDraft,
  shareKey,
  shareTotalPct,
  validateDraft,
  type DraftErrors,
  type EntryDraft,
} from '../lib/entryForm'
import { useIsWide } from '../lib/useIsWide'

export function EntryForm({ inv, onSaved }: { inv: CarbonInventory; onSaved?: () => void }) {
  const store = useStore()
  const { readOnly } = useStoreInfo()
  const toast = useToast()
  const navigate = useNavigate()
  const wide = useIsWide()
  const [draft, setDraft] = useState<EntryDraft>(() => draftFromInventory(inv))
  const [errors, setErrors] = useState<DraftErrors>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showMobileFuels, setShowMobileFuels] = useState(false)

  const edit = (fn: (d: EntryDraft) => EntryDraft) => {
    setDraft(fn)
    setSaved(false)
  }
  const setKwh = (m: number, v: string) => edit((d) => ({ ...d, months: d.months.map((x) => (x.m === m ? { ...x, kwh: v, estimated: false } : x)) }))
  const setFuel = (m: number, f: Fuel, v: string) =>
    edit((d) => ({ ...d, months: d.months.map((x) => (x.m === m ? { ...x, fuels: { ...x.fuels, [f]: v } } : x)) }))
  const [sharesTouched, setSharesTouched] = useState(false)
  const setShare = (e: Equip, v: string) => {
    setSharesTouched(true)
    edit((d) => ({ ...d, shares: { ...d.shares, [e]: v } }))
  }

  const monthT = (m: number): number => {
    const mo = monthsFromDraft(draft).find((x) => x.m === m)
    return mo ? monthEmission(mo).totalT : 0
  }
  const totalPct = shareTotalPct(draft)
  const hasShares = Object.values(draft.shares).some((v) => v && v.trim() !== '')
  const near100 = Math.abs(totalPct - 100) <= 1

  async function save() {
    const errs = validateDraft(draft)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast({ title: '有欄位需要修正', body: `共 ${Object.keys(errs).length} 個欄位不是有效數字，請看紅字提示。`, tone: 'error' })
      return
    }
    const months = monthsFromDraft(draft)
    const shares = sharesFromDraft(draft)
    const patch: Parameters<typeof store.update<'carbon'>>[2] = {
      months,
      electricityShare: shares,
      // Saving the month table doesn't make an untouched estimated split the factory's own.
      electricityShareSource: shares.length === 0 ? 'estimate' : sharesTouched ? 'user' : (inv.electricityShareSource ?? 'estimate'),
      updatedAt: nowIso(),
    }
    if (hasAnyData(months) && inv.steps.activity === 'todo') patch.steps = { activity: 'doing' }
    setSaving(true)
    try {
      await store.update('carbon', inv.id, patch)
      setSaved(true)
      toast({ title: '已儲存', tone: 'success' })
      onSaved?.()
    } catch {
      toast({ title: '儲存失敗', body: '資料沒有寫入，請稍後再按一次「儲存」。', tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const err = (k: string) => errors[k] ?? null
  const numInput = (label: string, value: string, key: string, onChange: (v: string) => void, hint?: string) => (
    <Field label={label} error={err(key)} hint={hint}>
      {(p) => <TextInput {...p} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="tabular font-mono" />}
    </Field>
  )
  const bareInput = (label: string, value: string, key: string, onChange: (v: string) => void) => (
    <div className="flex flex-col gap-1">
      <TextInput
        aria-label={label}
        aria-invalid={err(key) ? true : undefined}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular w-28 font-mono"
      />
      {err(key) ? <span className="text-xs text-danger">{err(key)}</span> : null}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <SectionTitle title="逐月用電與燃料" hint="沒有的月份或燃料留空即可。用電看電費單的「用電度數」。" />
        {wide ? (
          <ScrollX>
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong text-left text-muted">
                  <th className="px-2 py-2 font-medium">月份</th>
                  <th className="px-2 py-2 font-medium">用電（度）</th>
                  {FUEL_KEYS.map((f) => (
                    <th key={f} className="px-2 py-2 font-medium">
                      {FUELS[f].label}（{FUELS[f].unit}）
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-medium">該月 tCO2e</th>
                </tr>
              </thead>
              <tbody>
                {draft.months.map((mo) => (
                  <tr key={mo.m} className="border-b border-line align-top">
                    <th scope="row" className="px-2 py-2 text-left font-medium whitespace-nowrap text-ink">
                      {mo.m} 月
                      {mo.estimated ? <span className="ml-1.5 rounded-sm bg-warn-soft px-1 text-xs font-normal text-warn">估算</span> : null}
                    </th>
                    <td className="px-2 py-2">{bareInput(`${mo.m} 月用電（度）`, mo.kwh, kwhKey(mo.m), (v) => setKwh(mo.m, v))}</td>
                    {FUEL_KEYS.map((f) => (
                      <td key={f} className="px-2 py-2">
                        {bareInput(`${mo.m} 月${FUELS[f].label}用量`, mo.fuels[f], fuelKey(mo.m, f), (v) => setFuel(mo.m, f, v))}
                      </td>
                    ))}
                    <td className="tabular px-2 py-2 text-right font-mono text-ink">{formatNumber(monthT(mo.m), 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-sunken px-3 py-2 text-xs text-ink-soft">
              <span>手機版預設顯示「用電度數」與已填寫的燃料；若需新增鍋爐天然氣、柴油等範疇一燃料可展開。</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowMobileFuels((v) => !v)}>
                {showMobileFuels ? '收合空白燃料欄位' : '展開全部燃料欄位'}
              </Button>
            </div>
            {draft.months.map((mo) => {
              const visibleFuels = FUEL_KEYS.filter(
                (f) => showMobileFuels || (mo.fuels[f] && mo.fuels[f].trim() !== '') || !!err(fuelKey(mo.m, f)),
              )
              return (
                <Card key={mo.m} className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display font-bold text-ink">{mo.m} 月</h3>
                    <span className="tabular font-mono text-sm text-ink-soft">{formatNumber(monthT(mo.m), 1)} tCO2e</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                    {numInput(`${mo.m} 月用電（度）`, mo.kwh, kwhKey(mo.m), (v) => setKwh(mo.m, v), mo.estimated ? '試算估計，改成電費單上的度數' : undefined)}
                    {visibleFuels.map((f) => (
                      <div key={f}>{numInput(`${mo.m} 月${FUELS[f].label}（${FUELS[f].unit}）`, mo.fuels[f], fuelKey(mo.m, f), (v) => setFuel(mo.m, f, v))}</div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle title="用電分配" hint="估計各設備大約用掉幾成電（填百分比），儀表板會用它找出排放熱點。" />
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3">
          {EQUIPS.map((e) => (
            <div key={e}>{numInput(`${EQUIP_INFO[e].label}（%）`, draft.shares[e] ?? '', shareKey(e), (v) => setShare(e, v))}</div>
          ))}
        </div>
        <p className={hasShares ? (near100 ? 'text-sm text-brand-strong' : 'text-sm text-warn') : 'text-sm text-muted'} role="status">
          {hasShares
            ? near100
              ? `合計 ${formatPct(totalPct, 1)}，分配完整。`
              : `合計 ${formatPct(totalPct, 1)}，離 100% 還差 ${formatNumber(Math.abs(100 - totalPct), 1)}。系統仍會依比例換算。`
            : '還沒填也可以，之後再補。'}
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button onClick={save} busy={saving} disabled={readOnly}>
          儲存
        </Button>
        {saved && !onSaved ? (
          <Button variant="secondary" onClick={() => navigate(paths.carbon())}>
            回到碳盤查儀表板
          </Button>
        ) : null}
        {readOnly ? <span className="text-sm text-muted">目前是唯讀模式，無法儲存。</span> : null}
      </div>
    </div>
  )
}
