import type { CarbonInventory, CarbonMonth, Equip, Fuel } from '../../../core/types'
import { FUEL_KEYS } from '../../../core/constants/carbon'

/** Form state keeps raw strings so typing is never fought by number parsing. */
export interface MonthDraft {
  m: number
  kwh: string
  /** True while `kwh` is still the untouched 「套用試算」 estimate; typing in the cell clears it. */
  estimated: boolean
  fuels: Record<Fuel, string>
}
export interface EntryDraft {
  months: MonthDraft[]
  /** Percent (0–100) per equipment. */
  shares: Partial<Record<Equip, string>>
}

const numStr = (n: number | null | undefined) => (n == null ? '' : String(n))

export function draftFromInventory(inv: CarbonInventory): EntryDraft {
  const months = [...inv.months]
    .sort((a, b) => a.m - b.m)
    .map<MonthDraft>((mo) => ({
      m: mo.m,
      kwh: numStr(mo.kwh),
      estimated: mo.kwh != null && mo.kwhSource === 'estimate',
      fuels: Object.fromEntries(FUEL_KEYS.map((f) => [f, numStr(mo.fuels.find((u) => u.fuel === f)?.amount)])) as Record<Fuel, string>,
    }))
  const shares: Partial<Record<Equip, string>> = {}
  for (const s of inv.electricityShare ?? []) shares[s.equip] = String(Math.round(s.share * 1000) / 10)
  return { months, shares }
}

/** Blank is fine (null); otherwise a finite number ≥ 0. */
export function parseField(raw: string): { value: number | null; error: string | null } {
  const t = raw.trim().replace(/,/g, '')
  if (t === '') return { value: null, error: null }
  const n = Number(t)
  if (!Number.isFinite(n)) return { value: null, error: '請輸入數字' }
  if (n < 0) return { value: null, error: '不可為負數' }
  return { value: n, error: null }
}

export type DraftErrors = Record<string, string>
export const kwhKey = (m: number) => `kwh-${m}`
export const fuelKey = (m: number, f: Fuel) => `fuel-${m}-${f}`
export const shareKey = (e: Equip) => `share-${e}`

export function validateDraft(draft: EntryDraft): DraftErrors {
  const errors: DraftErrors = {}
  for (const mo of draft.months) {
    const k = parseField(mo.kwh)
    if (k.error) errors[kwhKey(mo.m)] = k.error
    for (const f of FUEL_KEYS) {
      const e = parseField(mo.fuels[f]).error
      if (e) errors[fuelKey(mo.m, f)] = e
    }
  }
  for (const [equip, raw] of Object.entries(draft.shares)) {
    const e = parseField(raw ?? '').error
    if (e) errors[shareKey(equip as Equip)] = e
  }
  return errors
}

/** Months as stored. Only call after validateDraft returns no errors. */
export function monthsFromDraft(draft: EntryDraft): CarbonMonth[] {
  return draft.months.map((mo) => {
    const kwh = parseField(mo.kwh).value
    return {
      m: mo.m,
      kwh,
      ...(mo.estimated && kwh != null ? { kwhSource: 'estimate' as const } : {}),
      fuels: FUEL_KEYS.flatMap((f) => {
        const v = parseField(mo.fuels[f]).value
        return v != null && v > 0 ? [{ fuel: f, amount: v }] : []
      }),
    }
  })
}

export function sharesFromDraft(draft: EntryDraft): { equip: Equip; share: number }[] {
  return (Object.entries(draft.shares) as [Equip, string][]).flatMap(([equip, raw]) => {
    const v = parseField(raw).value
    return v != null && v > 0 ? [{ equip, share: v / 100 }] : []
  })
}

export function shareTotalPct(draft: EntryDraft): number {
  return Object.values(draft.shares).reduce((n, raw) => n + (parseField(raw ?? '').value ?? 0), 0)
}

/** True when any month has electricity or fuel entered. */
export function hasAnyData(months: readonly CarbonMonth[]): boolean {
  return months.some((m) => m.kwh != null || m.fuels.length > 0)
}
