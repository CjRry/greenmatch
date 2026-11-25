import { EQUIP_INFO } from '../../../core/constants/equipment'
import type { Equip } from '../../../core/types'

export interface Hotspot {
  equip: Equip
  label: string
  tons: number
  /** Share of scope 2, 0–1 (shares are normalised so the list always sums to 1). */
  pct: number
}

/** Split scope 2 tCO2e across equipment by the factory's electricity share estimate, largest first. */
export function computeHotspots(scope2T: number, shares: readonly { equip: Equip; share: number }[] | undefined): Hotspot[] {
  const valid = (shares ?? []).filter((s) => Number.isFinite(s.share) && s.share > 0)
  const sum = valid.reduce((n, s) => n + s.share, 0)
  if (sum <= 0) return []
  return valid
    .map((s) => ({ equip: s.equip, label: EQUIP_INFO[s.equip].label, tons: (scope2T * s.share) / sum, pct: s.share / sum }))
    .sort((a, b) => b.tons - a.tons)
}
