/** Demo carbon inventories: monthly electricity and fuel use with a summer air-conditioning peak. */
import type { CarbonInventory, Equip, Fuel, InvStep, StepState } from '../../core/types'
import { at } from './util'

// Share of a factory's yearly average used in each month (Jan–Dec): higher in summer for cooling.
const SEASON = [0.92, 0.88, 0.95, 0.98, 1.04, 1.1, 1.14, 1.15, 1.08, 1.0, 0.94, 0.92]

/** Deterministic wobble so months don't look generated. */
function wobble(seed: number, m: number): number {
  const x = Math.sin(seed * 97.13 + m * 12.9898) * 43758.5453
  return 1 + ((x - Math.floor(x)) - 0.5) * 0.06
}

interface Plan {
  factoryId: string
  year: number
  monthlyKwh: number
  /** Months filled so far (1–12). */
  filled: number
  fuels: { fuel: Fuel; monthly: number }[]
  steps: Partial<Record<InvStep, StepState>>
  share: { equip: Equip; share: number }[]
  seed: number
  /** Multiply kWh from this month on (a retrofit took effect). */
  savingFrom?: { m: number; factor: number }
}

function build(p: Plan): CarbonInventory {
  const steps: Record<InvStep, StepState> = {
    boundary: 'todo',
    sources: 'todo',
    activity: 'todo',
    calc: 'todo',
    report: 'todo',
    verify: 'todo',
    ...p.steps,
  }
  return {
    id: `${p.factoryId}_${p.year}`,
    factoryId: p.factoryId,
    year: p.year,
    steps,
    months: Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      if (m > p.filled) return { m, kwh: null, fuels: [] }
      const saving = p.savingFrom && m >= p.savingFrom.m ? p.savingFrom.factor : 1
      return {
        m,
        kwh: Math.round((p.monthlyKwh * SEASON[i] * wobble(p.seed, m) * saving) / 10) * 10,
        fuels: p.fuels.map((f) => ({ fuel: f.fuel, amount: Math.round(f.monthly * wobble(p.seed + 7, m)) })),
      }
    }),
    electricityShare: p.share,
    updatedAt: at(`${p.year === 2026 ? '2026-10-15' : '2026-02-20'} 17:00`),
    isDemo: true,
  }
}

export const carbon: CarbonInventory[] = [
  build({
    factoryId: 'f01',
    year: 2025,
    monthlyKwh: 94000,
    filled: 12,
    fuels: [{ fuel: 'diesel', monthly: 320 }],
    steps: { boundary: 'done', sources: 'done', activity: 'done', calc: 'done', report: 'done', verify: 'todo' },
    share: [
      { equip: 'air_compressor', share: 0.36 },
      { equip: 'motor_vfd', share: 0.27 },
      { equip: 'hvac', share: 0.21 },
      { equip: 'lighting', share: 0.08 },
    ],
    seed: 1,
  }),
  build({
    factoryId: 'f01',
    year: 2026,
    monthlyKwh: 92000,
    filled: 9,
    fuels: [{ fuel: 'diesel', monthly: 300 }],
    steps: { boundary: 'done', sources: 'done', activity: 'doing' },
    share: [
      { equip: 'air_compressor', share: 0.36 },
      { equip: 'motor_vfd', share: 0.27 },
      { equip: 'hvac', share: 0.21 },
      { equip: 'lighting', share: 0.08 },
    ],
    seed: 2,
  }),
  build({
    factoryId: 'f02',
    year: 2026,
    monthlyKwh: 68000,
    filled: 9,
    fuels: [],
    steps: { boundary: 'done', sources: 'doing' },
    share: [
      { equip: 'motor_vfd', share: 0.52 },
      { equip: 'chiller', share: 0.26 },
      { equip: 'air_compressor', share: 0.12 },
    ],
    seed: 3,
  }),
  build({
    factoryId: 'f03',
    year: 2026,
    monthlyKwh: 150000,
    filled: 9,
    fuels: [{ fuel: 'fuel_oil', monthly: 7800 }],
    steps: { boundary: 'done', sources: 'done', activity: 'done', calc: 'done', report: 'doing' },
    share: [
      { equip: 'chiller', share: 0.48 },
      { equip: 'pump_fan', share: 0.17 },
      { equip: 'lighting', share: 0.06 },
    ],
    seed: 4,
  }),
  build({
    factoryId: 'f04',
    year: 2026,
    monthlyKwh: 210000,
    filled: 9,
    fuels: [{ fuel: 'natural_gas', monthly: 26000 }],
    steps: { boundary: 'done', sources: 'done', activity: 'done', calc: 'done', report: 'done', verify: 'done' },
    share: [
      { equip: 'motor_vfd', share: 0.38 },
      { equip: 'pump_fan', share: 0.31 },
      { equip: 'boiler', share: 0.08 },
    ],
    seed: 5,
  }),
  build({
    factoryId: 'f06',
    year: 2026,
    monthlyKwh: 70000,
    filled: 9,
    fuels: [{ fuel: 'diesel', monthly: 180 }],
    steps: { boundary: 'done', sources: 'done', activity: 'done', calc: 'doing' },
    share: [
      { equip: 'lighting', share: 0.24 },
      { equip: 'air_compressor', share: 0.31 },
      { equip: 'motor_vfd', share: 0.3 },
    ],
    seed: 6,
    savingFrom: { m: 6, factor: 0.88 },
  }),
]
