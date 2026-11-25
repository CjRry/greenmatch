import { afterEach, describe, expect, it } from 'vitest'
import {
  clearBillDraft,
  getCheckupCarbonBridge,
  loadBillDraft,
  saveBillDraft,
  type StoredBillDraft,
} from './billDraft'

function sampleDraft(overrides: Partial<StoredBillDraft> = {}): StoredBillDraft {
  return {
    planId: 'hv_2stage',
    periods: [
      {
        id: 'p1',
        label: '2026-08',
        season: 'summer',
        contractKw: '300',
        maxDemandKw: '345',
        powerFactorPct: '76',
        totalKwh: '120000',
        peakKwh: '',
        semiPeakKwh: '',
        satSemiPeakKwh: '',
        offPeakKwh: '',
        billAmountNtd: '480000',
      },
    ],
    showTouFields: false,
    hasAirCompressor: true,
    airFlowM3Min: '',
    pressureBar: '',
    compressorDailyHours: '',
    annualKwh: 1_270_000,
    avgMonthlyBillNtd: 426_667,
    avgPriceNtd: 3.88,
    latestContractKw: 300,
    monthsEntered: 3,
    updatedAt: '2026-11-15T05:00:00.000Z',
    ...overrides,
  }
}

describe('billDraft persistence & carbon bridge (OBS-0005)', () => {
  afterEach(() => {
    clearBillDraft()
    window.localStorage.clear()
  })

  it('persists entered bill periods across page reloads and exposes carbon bridge', () => {
    expect(loadBillDraft()).toBeNull()
    expect(getCheckupCarbonBridge()).toBeNull()

    saveBillDraft(sampleDraft())
    const loaded = loadBillDraft()
    expect(loaded).not.toBeNull()
    expect(loaded?.periods[0]?.contractKw).toBe('300')
    expect(loaded?.hasAirCompressor).toBe(true)

    const bridge = getCheckupCarbonBridge()
    expect(bridge).toEqual({
      annualKwh: 1_270_000,
      monthlyKwh: Math.round(1_270_000 / 12),
      avgPriceNtd: 3.88,
      latestContractKw: 300,
      hasAirCompressor: true,
      updatedAt: '2026-11-15T05:00:00.000Z',
    })
  })

  it('returns null carbon bridge when annualKwh is null or zero', () => {
    saveBillDraft(sampleDraft({ annualKwh: null }))
    expect(loadBillDraft()).not.toBeNull()
    expect(getCheckupCarbonBridge()).toBeNull()

    saveBillDraft(sampleDraft({ annualKwh: 0 }))
    expect(getCheckupCarbonBridge()).toBeNull()
  })

  it('clears both localStorage and in-memory draft fallback', () => {
    saveBillDraft(sampleDraft())
    clearBillDraft()
    expect(loadBillDraft()).toBeNull()
    expect(getCheckupCarbonBridge()).toBeNull()
  })
})
