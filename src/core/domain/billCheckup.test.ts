import { describe, expect, it } from 'vitest'
import { TARIFF_PLANS, INDUSTRY_EMISSION_FACTOR } from '../../data/taipowerTariffs'
import { analyzeBillCheckup, analyzeBillPeriod } from './billCheckup'

describe('analyzeBillPeriod / analyzeBillCheckup（電費單健檢手算驗證）', () => {
  it('手算驗證 1：高壓二段式夏月超約 2 倍＋3 倍與功因低於 80% 罰款', () => {
    // 契約 200 kW、最高需量 235 kW → 10% 內 20 kW (×2)、超過 10% 15 kW (×3)
    // 夏月高壓基本費單價 223.60 元/kW
    // 超約罰款 = 20*223.6*2 + 15*223.6*3 = 8,944 + 10,062 = 19,006 元
    const res = analyzeBillCheckup({
      planId: 'hv_2stage',
      periods: [
        {
          label: '2026-08',
          season: 'summer',
          contractKw: 200,
          maxDemandKw: 235,
          powerFactorPct: 74,
          totalKwh: 80_000,
          billAmountNtd: 419_006,
        },
      ],
    })

    const p = res.periods[0]
    expect(p.basicFeeNtd).toBe(Math.round(200 * 223.6))
    expect(p.within10Kw).toBe(20)
    expect(p.over10Kw).toBe(15)
    expect(p.overContractPenaltyNtd).toBe(19_006)
    expect(p.contractStatus).toBe('over_contract')

    // 功因 74%：<80% 每低 1% 加收 0.1% => +0.6%
    // 功因基數 = 419,006 - 19,006 = 400,000 => 加收 2,400 元；升至 95% (-1.5%) 差 2.1% => 月省 8,400 元
    expect(p.pfStatus).toBe('penalty')
    expect(p.pfAdjustmentPct).toBe(0.6)
    expect(p.pfAdjustmentNtd).toBe(2_400)
    expect(p.pfPotentialSaveNtd).toBe(8_400)
    // 僅填夏月（單季 < 12 期）不年化功因節省，避免單季代表全年（OBS-0005）
    expect(res.annualPfPotentialSaveNtd).toBeNull()
    expect(res.pfAnnualBasisNote).toContain('單季不推估年省')
    expect(res.pfAdvice).toContain('補非夏月後可換算')

    // 僅 1 期（< 3 期）時不推算年度最佳契約容量，避免單期波動誤導工廠長期調整契約
    expect(res.contractOptimization).toBeNull()
    expect(res.suggestedContractKw).toBeNull()
    expect(res.contractAdvice).toContain('尚不足 3 期，不進行年度最佳契約容量推薦')

    // 只填總度數、沒填分時度數 → 必須誠實提示，不硬猜比例
    expect(res.touComparison.status).toBe('needs_tou_breakdown')

    // 年化排碳 = 80,000 * 12 * 0.466 / 1000 = 447.36 => 447.4 tCO2e
    expect(res.annualizedFromSingleOrPartial).toBe(true)
    expect(res.annualKwh).toBe(960_000)
    expect(res.emissionFactorKgPerKwh).toBe(INDUSTRY_EMISSION_FACTOR.kgPerKwh)
    expect(res.annualScope2T).toBe(447.4)
  })

  it('手算驗證 2：功率因數獎勵上限只計至 95%（填 98% 仍只扣 1.5%），低壓 <30 kW 契約免計功因', () => {
    const capped = analyzeBillPeriod(
      {
        label: '2026-07',
        season: 'summer',
        contractKw: 150,
        maxDemandKw: 120,
        powerFactorPct: 98,
        totalKwh: 50_000,
        billAmountNtd: 300_000,
      },
      'hv_2stage',
    )
    expect(capped.pfStatus).toBe('optimal')
    expect(capped.pfAdjustmentPct).toBe(-1.5)
    expect(capped.pfPotentialSaveNtd).toBe(0)

    const exempt = analyzeBillPeriod(
      {
        label: '2026-07',
        season: 'summer',
        contractKw: 20,
        maxDemandKw: 15,
        powerFactorPct: 70,
        totalKwh: 3_000,
        billAmountNtd: 18_000,
      },
      'lv_non_tou',
    )
    expect(exempt.pfStatus).toBe('exempt')
    expect(exempt.pfAdjustmentNtd).toBeNull()
  })

  it('手算驗證 3：高壓三段式與二段式精確分時試算比較', () => {
    // 非夏月高壓：hv_3stage 無 9.39 尖峰，全部日間半尖峰 5.47 + 離峰 2.32
    // hv_2stage 為 6.37 + 2.46
    // peak=30,000 + semiPeak=20,000 => 合併平日尖峰 50,000 度；offPeak=50,000 度
    // costHv3 = 50,000 * 5.47 + 50,000 * 2.32 = 273,500 + 116,000 = 389,500
    // costHv2 = 50,000 * 6.37 + 50,000 * 2.46 = 318,500 + 123,000 = 441,500
    // 若使用者在 hv_3stage，換去 hv_2stage 會多花 52,000 元
    const res = analyzeBillCheckup({
      planId: 'hv_3stage',
      periods: [
        {
          label: '2026-11',
          season: 'non_summer',
          contractKw: 250,
          maxDemandKw: 210,
          powerFactorPct: 92,
          totalKwh: 100_000,
          peakKwh: 0,
          semiPeakKwh: 50_000,
          offPeakKwh: 50_000,
          billAmountNtd: 430_000,
        },
      ],
    })
    expect(res.touComparison.status).toBe('compared')
    expect(res.touComparison.alternativeLabel).toBe(TARIFF_PLANS.hv_2stage.label)
    expect(res.touComparison.estimatedPeriodDiffRangeNtd).toEqual({ min: 52_000, max: 52_000 })
    expect(res.touComparison.offPeakSharePct).toBe(50)
  })

  it('手算驗證 4：低壓非時間電價 vs 低壓二段式時間電價精確試算', () => {
    // 夏月：平 4.08；二段式 5.54 / 2.27
    // 尖峰 4,000 度、離峰 6,000 度（總 10,000 度）
    // costFlat = 40,800；costLv2 = 4,000*5.54 + 6,000*2.27 = 22,160 + 13,620 = 35,780
    // diff (lv2 - flat) = -5,020 元（改二段式可省 5,020 元）
    const res = analyzeBillCheckup({
      planId: 'lv_non_tou',
      periods: [
        {
          label: '2026-08',
          season: 'summer',
          contractKw: 50,
          maxDemandKw: 40,
          powerFactorPct: 88,
          totalKwh: 10_000,
          peakKwh: 4_000,
          offPeakKwh: 6_000,
          billAmountNtd: 52_873,
        },
      ],
    })
    expect(res.touComparison.status).toBe('compared')
    expect(res.touComparison.estimatedPeriodDiffRangeNtd).toEqual({ min: -5_020, max: -5_020 })
    expect(res.touComparison.summary).toContain('5,020')
  })

  it('分時度數與總度數差超過 15% 時發出提醒、不硬算方案比較', () => {
    const res = analyzeBillCheckup({
      planId: 'hv_2stage',
      periods: [
        {
          label: '2026-09',
          season: 'summer',
          contractKw: 200,
          maxDemandKw: 180,
          powerFactorPct: 90,
          totalKwh: 100_000,
          peakKwh: 10_000,
          offPeakKwh: 10_000,
          billAmountNtd: 450_000,
        },
      ],
    })
    expect(res.touComparison.status).toBe('mismatch_warning')
  })

  it('12 個月完整輸入時不標年化估算，且契約偏高能算出每月節費潛力', () => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      label: `2026-${String(i + 1).padStart(2, '0')}`,
      season: (i + 1 >= 6 && i + 1 <= 10 ? 'summer' : 'non_summer') as 'summer' | 'non_summer',
      contractKw: 300,
      maxDemandKw: 180, // 負載率 60% (<75%)
      powerFactorPct: 95,
      totalKwh: 50_000,
      billAmountNtd: 260_000,
    }))
    const res = analyzeBillCheckup({ planId: 'hv_2stage', periods: months })
    expect(res.monthsEntered).toBe(12)
    expect(res.annualizedFromSingleOrPartial).toBe(false)
    expect(res.annualKwh).toBe(600_000)
    expect(res.overallContractStatus).toBe('oversized')
    // 全年穩定 180 kW：最佳契約容量為 180 kW，年基本費＋超約費由 685,890 降至 411,534（省 274,356）
    expect(res.suggestedContractKw).toBe(180)
    expect(res.contractOptimization?.annualSavingsNtd).toBe(274_356)
    expect(res.contractOptimization?.isPartialAnnualized).toBe(false)
    expect(res.estimatedMonthlyExcessSaveNtd).toBeGreaterThan(15_000)
  })

  it('手算驗證 5：只有 2 個夏月尖峰 250 kW、其餘 10 個月 180 kW 時，最佳契約不是無條件拉高到 250 kW', () => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const isSummerSpike = i === 6 || i === 7
      return {
        label: `2026-${String(i + 1).padStart(2, '0')}`,
        season: (isSummerSpike ? 'summer' : 'non_summer') as 'summer' | 'non_summer',
        contractKw: 200,
        maxDemandKw: isSummerSpike ? 250 : 180,
        powerFactorPct: 95,
        totalKwh: 60_000,
        billAmountNtd: 300_000,
      }
    })
    const res = analyzeBillCheckup({ planId: 'hv_2stage', periods: months })
    // 180 kW 年費 = 180*(2*223.6 + 10*166.9) + 2*(18*2 + 52*3)*223.6 = 380,916 + 85,862 = 466,778
    // 200 kW 年費 = 423,240 + 58,136 = 481,376；250 kW 年費 = 529,050（最貴）
    expect(res.contractOptimization?.optimalContractKw).toBe(180)
    expect(res.contractOptimization?.optimalAnnualTotalNtd).toBe(466_778)
    expect(res.contractOptimization?.currentAnnualTotalNtd).toBe(481_376)
    expect(res.contractOptimization?.annualSavingsNtd).toBe(14_598)
  })

  it('手算驗證 6：負載率雖高於 75%（如 300 kW／250 kW），填滿 3 期且跨夏／非夏月可調降省錢即判定為 oversized 並提醒保留餘裕', () => {
    const res = analyzeBillCheckup({
      planId: 'hv_2stage',
      periods: [
        { label: '2026-07', season: 'summer' as const },
        { label: '2026-08', season: 'summer' as const },
        { label: '2026-11', season: 'non_summer' as const },
      ].map((p) => ({
        ...p,
        contractKw: 300,
        maxDemandKw: 250,
        powerFactorPct: 92,
        totalKwh: 90_000,
        billAmountNtd: 420_000,
      })),
    })
    expect(res.overallContractStatus).toBe('oversized')
    expect(res.contractOptimization?.optimalContractKw).toBe(250)
    expect(res.contractOptimization?.annualSavingsNtd).toBe(114_315)
    expect(res.contractAdvice).toContain('需量餘裕')
    expect(res.annualPfPotentialSaveNtd).toBe(15_120)
    expect(res.annualScope2T).toBe(503.3)
  })

  it('手算驗證 7：填滿 3 期含夏月與非夏月即可啟動 5/7 季節加權契約最佳化；僅填單季時不推算年度最佳契約', () => {
    const singleSeason = analyzeBillCheckup({
      planId: 'hv_2stage',
      periods: ['2026-07', '2026-08', '2026-09'].map((label) => ({
        label,
        season: 'summer' as const,
        contractKw: 200,
        maxDemandKw: 235,
        powerFactorPct: 76,
        totalKwh: 80_000,
        billAmountNtd: 500_000,
      })),
    })
    expect(singleSeason.contractOptimization).toBeNull()
    expect(singleSeason.annualPfPotentialSaveNtd).toBeNull()
    expect(singleSeason.contractAdvice).toContain('單一季節不推算全年最適契約與年省金額')

    const mixedSeason = analyzeBillCheckup({
      planId: 'hv_2stage',
      periods: [
        { label: '2026-07', season: 'summer' as const },
        { label: '2026-08', season: 'summer' as const },
        { label: '2026-11', season: 'non_summer' as const },
      ].map((p) => ({
        ...p,
        contractKw: 200,
        maxDemandKw: 235,
        powerFactorPct: 76,
        totalKwh: 80_000,
        billAmountNtd: 500_000,
      })),
    })
    expect(mixedSeason.contractOptimization).not.toBeNull()
    expect(mixedSeason.contractOptimization!.optimalContractKw).toBe(235)
    expect(mixedSeason.contractOptimization!.currentAnnualTotalNtd).toBe(651_596)
    expect(mixedSeason.contractOptimization!.optimalAnnualTotalNtd).toBe(537_281)
    expect(mixedSeason.contractOptimization!.annualSavingsNtd).toBe(114_315)
    expect(mixedSeason.contractOptimization!.isPartialAnnualized).toBe(true)
    expect(mixedSeason.contractAdvice).toContain('依夏月 5 個月＋非夏月 7 個月加權推算')
    expect(mixedSeason.contractAdvice).toContain('建議補滿 12 期')
  })

  it('手算驗證 8（OBS-0005 回歸）：2 夏 1 非夏（300 kW／345,320,290 kW）依夏 5 非夏 7 加權算出最佳 314 kW 年省 7,681 元', () => {
    const res = analyzeBillCheckup({
      planId: 'hv_2stage',
      periods: [
        { label: '2026-07', season: 'summer', contractKw: 300, maxDemandKw: 345, powerFactorPct: 76, totalKwh: 120_000, billAmountNtd: 480_000 },
        { label: '2026-08', season: 'summer', contractKw: 300, maxDemandKw: 320, powerFactorPct: 78, totalKwh: 110_000, billAmountNtd: 440_000 },
        { label: '2026-11', season: 'non_summer', contractKw: 300, maxDemandKw: 290, powerFactorPct: 80, totalKwh: 100_000, billAmountNtd: 360_000 },
      ],
    })
    expect(res.contractOptimization).not.toBeNull()
    expect(res.contractOptimization!.optimalContractKw).toBe(314)
    expect(res.contractOptimization!.currentAnnualTotalNtd).toBe(766_945)
    expect(res.contractOptimization!.optimalAnnualTotalNtd).toBe(759_264)
    expect(res.contractOptimization!.annualSavingsNtd).toBe(7_681)
    expect(res.annualPfPotentialSaveNtd).toBe(77_805)
    expect(res.pfAnnualBasisNote).toContain('依夏月 2 期×5＋非夏月 1 期×7 加權')
  })

  it('全空白輸入不丟錯、不產生 NaN', () => {
    const res = analyzeBillCheckup({ planId: 'unknown', periods: [] })
    expect(res.monthsEntered).toBe(0)
    expect(res.avgPriceNtd).toBeNull()
    expect(res.annualScope2T).toBeNull()
    expect(res.overallContractStatus).toBe('unknown')
    expect(res.overallPfStatus).toBe('unknown')
  })
})
