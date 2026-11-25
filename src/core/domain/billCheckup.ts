import {
  BILL_INDUSTRY_DISCOUNT_CAVEAT,
  INDUSTRY_EMISSION_FACTOR,
  OVER_CONTRACT_RULES,
  POWER_FACTOR_RULES,
  TARIFF_PLANS,
  type ConcreteTariffPlanId,
  type SeasonKind,
  type TariffPlanId,
  type TariffPlanSpec,
} from '../../data/taipowerTariffs'

export interface BillPeriodInput {
  /** Period label, e.g. "2026-08" or "最近一期". */
  label: string
  season: SeasonKind
  /** Contract demand capacity in kW. */
  contractKw: number | null
  /** Maximum 15-min demand in kW. */
  maxDemandKw: number | null
  /** Average power factor in % (0-100). */
  powerFactorPct: number | null
  /** Total monthly electricity consumption in kWh. */
  totalKwh: number | null
  /** Weekday peak kWh (TOU optional). */
  peakKwh?: number | null
  /** Weekday semi-peak kWh (for 3-stage TOU; optional). */
  semiPeakKwh?: number | null
  /** Saturday semi-peak kWh (TOU optional). */
  satSemiPeakKwh?: number | null
  /** Off-peak kWh (TOU optional). */
  offPeakKwh?: number | null
  /** Actual billed electricity amount in NTD. */
  billAmountNtd: number | null
}

export interface BillCheckupInput {
  planId: TariffPlanId
  periods: readonly BillPeriodInput[]
}

export type ContractHealthStatus = 'over_contract' | 'near_limit' | 'healthy' | 'oversized' | 'unknown'
export type PowerFactorStatus = 'penalty' | 'below_target' | 'optimal' | 'exempt' | 'unknown'

export interface BillPeriodAnalysis {
  label: string
  season: SeasonKind
  effectivePlan: TariffPlanSpec
  planInferred: boolean
  contractKw: number | null
  maxDemandKw: number | null
  powerFactorPct: number | null
  totalKwh: number | null
  billAmountNtd: number | null
  avgPriceNtd: number | null
  basicFeeNtd: number | null
  basicFeeSharePct: number | null
  /** Over-contract breakdown (2x within 10%, 3x over 10%). */
  excessKw: number
  within10Kw: number
  over10Kw: number
  overContractPenaltyNtd: number
  loadRatioPct: number | null
  contractStatus: ContractHealthStatus
  /** Power factor adjustment relative to 80% threshold. */
  pfStatus: PowerFactorStatus
  pfAdjustmentPct: number | null
  /** Positive = surcharge paid, negative = reward discount received, null = unknown/exempt. */
  pfAdjustmentNtd: number | null
  /** Estimated extra monthly saving if PF improves to 95%. */
  pfPotentialSaveNtd: number | null
  /** Off-peak ratio when TOU breakdown is supplied & consistent. */
  offPeakSharePct: number | null
  touBreakdownConsistent: boolean
}

export interface TouComparisonResult {
  status: 'compared' | 'needs_tou_breakdown' | 'mismatch_warning'
  currentLabel: string
  alternativeLabel?: string
  summary: string
  /** Positive means current period total estimated energy cost is higher with alternative by this amount; negative means alternative is cheaper. */
  estimatedPeriodDiffRangeNtd?: { min: number; max: number }
  isSensitivityRange?: boolean
  offPeakSharePct?: number
}

export interface ContractCandidateComparison {
  contractKw: number
  annualBasicFeeNtd: number
  annualOverPenaltyNtd: number
  annualTotalNtd: number
  label: string
}

export interface ContractOptimizationResult {
  currentContractKw: number
  optimalContractKw: number
  currentAnnualTotalNtd: number
  optimalAnnualTotalNtd: number
  annualSavingsNtd: number
  periodsCount: number
  isPartialAnnualized: boolean
  singleSeasonBias: SeasonKind | null
  candidates: ContractCandidateComparison[]
}

export interface BillCheckupSummary {
  monthsEntered: number
  planLabel: string
  planInferred: boolean
  periods: BillPeriodAnalysis[]
  /** Output 1: basic charge ratio & avg price. */
  totalBillNtd: number | null
  totalKwh: number | null
  avgPriceNtd: number | null
  avgMonthlyBillNtd: number | null
  avgMonthlyKwh: number | null
  totalEstimatedBasicFeeNtd: number | null
  basicFeeSharePct: number | null
  /** Output 2: contract demand & over-contract risk. */
  latestContractKw: number | null
  peakDemandKw: number | null
  totalOverContractPenaltyNtd: number
  overContractMonths: number
  overallContractStatus: ContractHealthStatus
  suggestedContractKw: number | null
  estimatedMonthlyExcessSaveNtd: number | null
  contractOptimization: ContractOptimizationResult | null
  contractAdvice: string
  /** Output 3: power factor summary. */
  avgPowerFactorPct: number | null
  overallPfStatus: PowerFactorStatus
  totalPfAdjustmentNtd: number | null
  totalPfPotentialSaveNtd: number | null
  annualPfPotentialSaveNtd: number | null
  pfAnnualBasisNote: string | null
  pfAdvice: string
  /** Output 4: TOU comparison (only computed with breakdown). */
  touComparison: TouComparisonResult
  /** Output 5: carbon footprint & threshold. */
  annualKwh: number | null
  annualizedFromSingleOrPartial: boolean
  annualScope2T: number | null
  emissionFactorKgPerKwh: number
  caveat: string
}

function pos(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

function nonNeg(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null
}

export function resolveEffectivePlan(planId: TariffPlanId, contractKw: number | null): { spec: TariffPlanSpec; inferred: boolean } {
  if (planId !== 'unknown') return { spec: TARIFF_PLANS[planId], inferred: false }
  const guessed: ConcreteTariffPlanId = contractKw != null && contractKw < 100 ? 'lv_non_tou' : 'hv_2stage'
  return { spec: TARIFF_PLANS[guessed], inferred: true }
}

/** Round to 1 decimal place for readable display metrics. */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Round to 2 decimal places (NTD/kWh). */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function analyzeBillPeriod(period: BillPeriodInput, planId: TariffPlanId): BillPeriodAnalysis {
  const contractKw = pos(period.contractKw)
  const maxDemandKw = pos(period.maxDemandKw)
  const pf = nonNeg(period.powerFactorPct)
  const powerFactorPct = pf != null && pf <= 100 ? pf : null
  const totalKwh = pos(period.totalKwh)
  const billAmountNtd = pos(period.billAmountNtd)

  const { spec: effectivePlan, inferred: planInferred } = resolveEffectivePlan(planId, contractKw)
  const basicUnit = period.season === 'summer' ? effectivePlan.basicFeePerKw.summer : effectivePlan.basicFeePerKw.nonSummer

  const avgPriceNtd = totalKwh != null && billAmountNtd != null ? round2(billAmountNtd / totalKwh) : null

  const basicFeeNtd = contractKw != null ? Math.round(contractKw * basicUnit + effectivePlan.customerFeeNtd) : null
  const basicFeeSharePct =
    basicFeeNtd != null && billAmountNtd != null ? round1(Math.min(100, (basicFeeNtd / billAmountNtd) * 100)) : null

  // Over-contract: 2x within +10%, 3x above +10%
  let excessKw = 0
  let within10Kw = 0
  let over10Kw = 0
  let overContractPenaltyNtd = 0
  let loadRatioPct: number | null = null
  let contractStatus: ContractHealthStatus = 'unknown'

  if (contractKw != null && maxDemandKw != null) {
    loadRatioPct = round1((maxDemandKw / contractKw) * 100)
    if (maxDemandKw > contractKw) {
      excessKw = round1(maxDemandKw - contractKw)
      const cap10 = contractKw * OVER_CONTRACT_RULES.within10PctThreshold
      within10Kw = round1(Math.min(excessKw, cap10))
      over10Kw = round1(Math.max(0, excessKw - cap10))
      overContractPenaltyNtd = Math.round(
        within10Kw * basicUnit * OVER_CONTRACT_RULES.within10PctMultiplier +
          over10Kw * basicUnit * OVER_CONTRACT_RULES.over10PctMultiplier,
      )
      contractStatus = 'over_contract'
    } else if (loadRatioPct >= 90) {
      contractStatus = 'near_limit'
    } else if (loadRatioPct >= 75) {
      contractStatus = 'healthy'
    } else {
      contractStatus = 'oversized'
    }
  }

  // Power factor adjustment: 80% baseline, +/-0.1% per 1% point, reward capped at 95%
  let pfStatus: PowerFactorStatus = 'unknown'
  let pfAdjustmentPct: number | null = null
  let pfAdjustmentNtd: number | null = null
  let pfPotentialSaveNtd: number | null = null

  const pfExempt = contractKw != null && contractKw < POWER_FACTOR_RULES.minDemandContractKw && effectivePlan.voltage === 'low'
  if (pfExempt) {
    pfStatus = 'exempt'
  } else if (powerFactorPct != null) {
    const cappedPf = Math.min(powerFactorPct, POWER_FACTOR_RULES.rewardCapPct)
    // diff > 0 => surcharge; diff < 0 => discount
    pfAdjustmentPct = round2((POWER_FACTOR_RULES.baselinePct - cappedPf) * POWER_FACTOR_RULES.stepRatePct)
    if (powerFactorPct < POWER_FACTOR_RULES.baselinePct) {
      pfStatus = 'penalty'
    } else if (powerFactorPct >= POWER_FACTOR_RULES.rewardCapPct) {
      pfStatus = 'optimal'
    } else {
      pfStatus = 'below_target'
    }

    const pfBase =
      billAmountNtd != null
        ? Math.max(0, billAmountNtd - overContractPenaltyNtd - effectivePlan.customerFeeNtd)
        : basicFeeNtd != null
          ? Math.max(0, basicFeeNtd - effectivePlan.customerFeeNtd)
          : null

    if (pfBase != null && pfBase > 0) {
      pfAdjustmentNtd = Math.round(pfBase * (pfAdjustmentPct / 100))
      const targetRatePct = -((POWER_FACTOR_RULES.rewardCapPct - POWER_FACTOR_RULES.baselinePct) * POWER_FACTOR_RULES.stepRatePct)
      const savePct = Math.max(0, round2(pfAdjustmentPct - targetRatePct))
      pfPotentialSaveNtd = Math.round(pfBase * (savePct / 100))
    }
  }

  // TOU breakdown check
  const pKwh = nonNeg(period.peakKwh) ?? 0
  const spKwh = nonNeg(period.semiPeakKwh) ?? 0
  const satKwh = nonNeg(period.satSemiPeakKwh) ?? 0
  const opKwh = nonNeg(period.offPeakKwh) ?? 0
  const hasAnyTou = [period.peakKwh, period.semiPeakKwh, period.satSemiPeakKwh, period.offPeakKwh].some(
    (v) => typeof v === 'number' && Number.isFinite(v) && v > 0,
  )
  const touSum = pKwh + spKwh + satKwh + opKwh
  const touBreakdownConsistent =
    hasAnyTou && totalKwh != null && Math.abs(touSum - totalKwh) <= Math.max(totalKwh * 0.15, 50)
  const offPeakSharePct = hasAnyTou && touSum > 0 ? round1(((opKwh + satKwh) / touSum) * 100) : null

  return {
    label: period.label,
    season: period.season,
    effectivePlan,
    planInferred,
    contractKw,
    maxDemandKw,
    powerFactorPct,
    totalKwh,
    billAmountNtd,
    avgPriceNtd,
    basicFeeNtd,
    basicFeeSharePct,
    excessKw,
    within10Kw,
    over10Kw,
    overContractPenaltyNtd,
    loadRatioPct,
    contractStatus,
    pfStatus,
    pfAdjustmentPct,
    pfAdjustmentNtd,
    pfPotentialSaveNtd,
    offPeakSharePct,
    touBreakdownConsistent,
  }
}

function comparePeriodTouCost(
  period: BillPeriodInput,
  currentPlan: ConcreteTariffPlanId,
): { altLabel: string; minDiff: number; maxDiff: number; isRange: boolean } | null {
  const pKwh = nonNeg(period.peakKwh) ?? 0
  const spKwh = nonNeg(period.semiPeakKwh) ?? 0
  const satKwh = nonNeg(period.satSemiPeakKwh) ?? 0
  const opKwh = nonNeg(period.offPeakKwh) ?? 0
  const total = pos(period.totalKwh) ?? pKwh + spKwh + satKwh + opKwh
  if (total <= 0) return null

  const s = period.season === 'summer' ? 'summer' : 'nonSummer'

  if (currentPlan === 'hv_2stage') {
    const hv2 = TARIFF_PLANS.hv_2stage.energyRates
    const hv3 = TARIFF_PLANS.hv_3stage.energyRates
    const costHv2 = pKwh * hv2.peak![s]! + satKwh * hv2.satSemiPeak![s] + opKwh * hv2.offPeak![s]
    if (period.season === 'non_summer') {
      // Non-summer hv_3stage has NO high peak tier; daytime weekday becomes semi-peak (5.47 vs 6.37)
      const costHv3 = (pKwh + spKwh) * hv3.semiPeak!.nonSummer + satKwh * hv3.satSemiPeak!.nonSummer + opKwh * hv3.offPeak!.nonSummer
      const diff = Math.round(costHv3 - costHv2)
      return { altLabel: TARIFF_PLANS.hv_3stage.label, minDiff: diff, maxDiff: diff, isRange: false }
    }
    // Summer hv_3stage depends on what fraction of daytime peak occurs during 16:00-22:00 (typically 30%-55%)
    const combinedPeak = pKwh + spKwh
    const costLowEvening =
      combinedPeak * (0.3 * hv3.peak!.summer! + 0.7 * hv3.semiPeak!.summer) +
      satKwh * hv3.satSemiPeak!.summer +
      opKwh * hv3.offPeak!.summer
    const costHighEvening =
      combinedPeak * (0.55 * hv3.peak!.summer! + 0.45 * hv3.semiPeak!.summer) +
      satKwh * hv3.satSemiPeak!.summer +
      opKwh * hv3.offPeak!.summer
    const d1 = Math.round(costLowEvening - costHv2)
    const d2 = Math.round(costHighEvening - costHv2)
    return { altLabel: TARIFF_PLANS.hv_3stage.label, minDiff: Math.min(d1, d2), maxDiff: Math.max(d1, d2), isRange: true }
  }

  if (currentPlan === 'hv_3stage') {
    const hv2 = TARIFF_PLANS.hv_2stage.energyRates
    const hv3 = TARIFF_PLANS.hv_3stage.energyRates
    const costHv3 =
      (period.season === 'summer' ? pKwh * (hv3.peak!.summer ?? 0) : 0) +
      (period.season === 'summer' ? spKwh : pKwh + spKwh) * hv3.semiPeak![s] +
      satKwh * hv3.satSemiPeak![s] +
      opKwh * hv3.offPeak![s]
    const costHv2 = (pKwh + spKwh) * hv2.peak![s]! + satKwh * hv2.satSemiPeak![s] + opKwh * hv2.offPeak![s]
    const diff = Math.round(costHv2 - costHv3)
    return { altLabel: TARIFF_PLANS.hv_2stage.label, minDiff: diff, maxDiff: diff, isRange: false }
  }

  if (currentPlan === 'lv_non_tou' || currentPlan === 'lv_2stage') {
    const nonTou = TARIFF_PLANS.lv_non_tou.energyRates
    const lv2 = TARIFF_PLANS.lv_2stage.energyRates
    const costFlat = total * nonTou.flat![s]
    const costLv2 = pKwh * lv2.peak![s]! + satKwh * lv2.satSemiPeak![s] + opKwh * lv2.offPeak![s]
    if (currentPlan === 'lv_non_tou') {
      const diff = Math.round(costLv2 - costFlat)
      return { altLabel: TARIFF_PLANS.lv_2stage.label, minDiff: diff, maxDiff: diff, isRange: false }
    }
    const diff = Math.round(costFlat - costLv2)
    return { altLabel: TARIFF_PLANS.lv_non_tou.label, minDiff: diff, maxDiff: diff, isRange: false }
  }

  return null
}

function evalCandidateContractCost(
  candidateKw: number,
  demandAnalyses: readonly BillPeriodAnalysis[],
): { annualBasicFeeNtd: number; annualOverPenaltyNtd: number; annualTotalNtd: number; rawPeriodSum: number } {
  const summer = demandAnalyses.filter((a) => a.season === 'summer')
  const nonSummer = demandAnalyses.filter((a) => a.season === 'non_summer')
  const calcGroup = (group: readonly BillPeriodAnalysis[]) => {
    let basic = 0
    let penalty = 0
    for (const a of group) {
      const unit = a.season === 'summer' ? a.effectivePlan.basicFeePerKw.summer : a.effectivePlan.basicFeePerKw.nonSummer
      basic += candidateKw * unit + a.effectivePlan.customerFeeNtd
      const demand = a.maxDemandKw ?? 0
      if (demand > candidateKw) {
        const excess = demand - candidateKw
        const cap10 = candidateKw * OVER_CONTRACT_RULES.within10PctThreshold
        const w10 = Math.min(excess, cap10)
        const o10 = Math.max(0, excess - cap10)
        penalty +=
          w10 * unit * OVER_CONTRACT_RULES.within10PctMultiplier +
          o10 * unit * OVER_CONTRACT_RULES.over10PctMultiplier
      }
    }
    return {
      avgBasic: group.length > 0 ? basic / group.length : 0,
      avgPenalty: group.length > 0 ? penalty / group.length : 0,
      sumBasic: basic,
      sumPenalty: penalty,
    }
  }

  // When 12+ months are supplied, scale proportionally; when 3–11 mixed-season periods are supplied, weight 5 summer + 7 non-summer months (Taipower 5/16–10/15 schedule).
  let annualBasicExact: number
  let annualPenaltyExact: number
  if (demandAnalyses.length >= 12) {
    const all = calcGroup(demandAnalyses)
    annualBasicExact = (all.sumBasic / demandAnalyses.length) * 12
    annualPenaltyExact = (all.sumPenalty / demandAnalyses.length) * 12
  } else {
    const sGroup = calcGroup(summer)
    const nGroup = calcGroup(nonSummer)
    annualBasicExact = sGroup.avgBasic * 5 + nGroup.avgBasic * 7
    annualPenaltyExact = sGroup.avgPenalty * 5 + nGroup.avgPenalty * 7
  }

  const annualBasicFeeNtd = Math.round(annualBasicExact)
  const annualOverPenaltyNtd = Math.round(annualPenaltyExact)
  return {
    annualBasicFeeNtd,
    annualOverPenaltyNtd,
    annualTotalNtd: annualBasicFeeNtd + annualOverPenaltyNtd,
    rawPeriodSum: annualBasicExact + annualPenaltyExact,
  }
}

function optimizeContractCapacity(
  demandAnalyses: readonly BillPeriodAnalysis[],
  currentContractKw: number,
): ContractOptimizationResult | null {
  if (!demandAnalyses.length) return null
  const isPartialAnnualized = demandAnalyses.length < 12
  const summerCount = demandAnalyses.filter((a) => a.season === 'summer').length
  const nonSummerCount = demandAnalyses.filter((a) => a.season === 'non_summer').length
  // Single-season partial data (< 12 periods) must not extrapolate an annual contract recommendation.
  if (isPartialAnnualized && (summerCount === 0 || nonSummerCount === 0)) return null

  const demands = demandAnalyses.map((a) => a.maxDemandKw!).filter((d) => d > 0)
  if (!demands.length) return null

  const peakDemand = Math.max(...demands)
  const minDemand = Math.min(...demands)
  const searchMin = Math.max(1, Math.floor(minDemand / (1 + OVER_CONTRACT_RULES.within10PctThreshold)))
  const searchMax = Math.max(Math.ceil(peakDemand), Math.ceil(currentContractKw))

  const currentEval = evalCandidateContractCost(currentContractKw, demandAnalyses)
  let bestKw = currentContractKw
  let bestEval = currentEval

  if (searchMax - searchMin <= 10_000) {
    for (let k = searchMin; k <= searchMax; k++) {
      const ev = evalCandidateContractCost(k, demandAnalyses)
      if (ev.rawPeriodSum < bestEval.rawPeriodSum - 1e-6) {
        bestKw = k
        bestEval = ev
      }
    }
  } else {
    const probes = new Set<number>([Math.round(currentContractKw), searchMin, searchMax])
    for (const d of demands) {
      const b1 = d
      const b2 = d / (1 + OVER_CONTRACT_RULES.within10PctThreshold)
      for (const b of [b1, b2]) {
        probes.add(Math.max(1, Math.floor(b)))
        probes.add(Math.max(1, Math.ceil(b)))
      }
    }
    for (const k of Array.from(probes).sort((a, b) => a - b)) {
      const ev = evalCandidateContractCost(k, demandAnalyses)
      if (ev.rawPeriodSum < bestEval.rawPeriodSum - 1e-6) {
        bestKw = k
        bestEval = ev
      }
    }
  }

  // Avoid recommending a change if rounded annual totals tie
  if (bestEval.annualTotalNtd >= currentEval.annualTotalNtd) {
    bestKw = currentContractKw
    bestEval = currentEval
  }

  const periodsCount = demandAnalyses.length
  const singleSeasonBias: SeasonKind | null =
    isPartialAnnualized && (summerCount === 0 || nonSummerCount === 0) ? (summerCount > 0 ? 'summer' : 'non_summer') : null

  const candidateSpecs: { kw: number; label: string }[] = []
  const pushCandidate = (kw: number, label: string) => {
    if (kw > 0 && !candidateSpecs.some((c) => c.kw === kw)) candidateSpecs.push({ kw, label })
  }

  if (bestKw === currentContractKw) {
    pushCandidate(currentContractKw, '現行契約（已最划算）')
  } else {
    pushCandidate(currentContractKw, '現行契約')
    pushCandidate(bestKw, '試算最划算')
  }
  const no3xKw = Math.ceil(peakDemand / (1 + OVER_CONTRACT_RULES.within10PctThreshold))
  pushCandidate(no3xKw, '免 3 倍超約附加費門檻')
  pushCandidate(Math.ceil(peakDemand), '完全免超約門檻')

  const candidates: ContractCandidateComparison[] = candidateSpecs
    .sort((a, b) => a.kw - b.kw)
    .map((spec) => {
      const ev = spec.kw === bestKw ? bestEval : spec.kw === currentContractKw ? currentEval : evalCandidateContractCost(spec.kw, demandAnalyses)
      return {
        contractKw: spec.kw,
        annualBasicFeeNtd: ev.annualBasicFeeNtd,
        annualOverPenaltyNtd: ev.annualOverPenaltyNtd,
        annualTotalNtd: ev.annualTotalNtd,
        label: spec.label,
      }
    })

  return {
    currentContractKw,
    optimalContractKw: bestKw,
    currentAnnualTotalNtd: currentEval.annualTotalNtd,
    optimalAnnualTotalNtd: bestEval.annualTotalNtd,
    annualSavingsNtd: Math.max(0, currentEval.annualTotalNtd - bestEval.annualTotalNtd),
    periodsCount,
    isPartialAnnualized,
    singleSeasonBias,
    candidates,
  }
}

export function analyzeBillCheckup(input: BillCheckupInput): BillCheckupSummary {
  const validPeriods = input.periods.filter(
    (p) =>
      pos(p.contractKw) != null ||
      pos(p.maxDemandKw) != null ||
      pos(p.totalKwh) != null ||
      pos(p.billAmountNtd) != null ||
      nonNeg(p.powerFactorPct) != null,
  )

  const analyses = validPeriods.map((p) => analyzeBillPeriod(p, input.planId))
  const monthsEntered = analyses.length

  const primarySpec = analyses[0]?.effectivePlan ?? resolveEffectivePlan(input.planId, null).spec
  const planInferred = analyses.some((a) => a.planInferred) || input.planId === 'unknown'
  const planLabel = planInferred ? `${primarySpec.label}（依契約容量推估）` : primarySpec.label

  const billedAnalyses = analyses.filter((a) => a.billAmountNtd != null)
  const kwhAnalyses = analyses.filter((a) => a.totalKwh != null)

  const totalBillNtd = billedAnalyses.length ? billedAnalyses.reduce((s, a) => s + a.billAmountNtd!, 0) : null
  const totalKwh = kwhAnalyses.length ? kwhAnalyses.reduce((s, a) => s + a.totalKwh!, 0) : null
  const avgPriceNtd = totalBillNtd != null && totalKwh != null && totalKwh > 0 ? round2(totalBillNtd / totalKwh) : null
  const avgMonthlyBillNtd = billedAnalyses.length ? Math.round(totalBillNtd! / billedAnalyses.length) : null
  const avgMonthlyKwh = kwhAnalyses.length ? Math.round(totalKwh! / kwhAnalyses.length) : null

  const basicAnalyses = analyses.filter((a) => a.basicFeeNtd != null && a.billAmountNtd != null)
  const totalEstimatedBasicFeeNtd = basicAnalyses.length ? basicAnalyses.reduce((s, a) => s + a.basicFeeNtd!, 0) : null
  const basicBillDenominator = basicAnalyses.reduce((s, a) => s + a.billAmountNtd!, 0)
  const basicFeeSharePct =
    totalEstimatedBasicFeeNtd != null && basicBillDenominator > 0
      ? round1(Math.min(100, (totalEstimatedBasicFeeNtd / basicBillDenominator) * 100))
      : null

  // Contract demand diagnosis across all entered months
  const contractEntries = analyses.filter((a) => a.contractKw != null)
  const demandEntries = analyses.filter((a) => a.maxDemandKw != null)
  const latestContractKw = contractEntries.length ? contractEntries[contractEntries.length - 1].contractKw! : null
  const peakDemandKw = demandEntries.length ? Math.max(...demandEntries.map((a) => a.maxDemandKw!)) : null
  const totalOverContractPenaltyNtd = analyses.reduce((s, a) => s + a.overContractPenaltyNtd, 0)
  const overContractMonths = analyses.filter((a) => a.contractStatus === 'over_contract').length

  let overallContractStatus: ContractHealthStatus = 'unknown'
  let suggestedContractKw: number | null = null
  let estimatedMonthlyExcessSaveNtd: number | null = null
  const contractOptimization =
    latestContractKw != null && demandEntries.length >= 3 ? optimizeContractCapacity(demandEntries, latestContractKw) : null
  let contractAdvice = '填入「契約容量」與「最高需量」後，即可試算超約附加費與需量裕度（補滿 3 期以上可試算全年最划算契約容量）。'

  if (latestContractKw != null && peakDemandKw != null) {
    const peakLoadRatio = (peakDemandKw / latestContractKw) * 100
    suggestedContractKw = contractOptimization?.optimalContractKw ?? null
    estimatedMonthlyExcessSaveNtd =
      contractOptimization && contractOptimization.annualSavingsNtd > 0
        ? Math.round(contractOptimization.annualSavingsNtd / 12)
        : null

    if (overContractMonths > 0 || peakDemandKw > latestContractKw) {
      overallContractStatus = 'over_contract'
    } else if (peakLoadRatio >= 90) {
      overallContractStatus = 'near_limit'
    } else if (
      peakLoadRatio < 75 ||
      (contractOptimization != null &&
        contractOptimization.optimalContractKw < latestContractKw &&
        contractOptimization.annualSavingsNtd > 0)
    ) {
      overallContractStatus = 'oversized'
    } else {
      overallContractStatus = 'healthy'
    }

    const allSummerDemand = demandEntries.every((a) => a.season === 'summer')
    const singleSeasonDemandLabel = allSummerDemand ? '夏月' : '非夏月'
    const partialSuffix = contractOptimization
      ? contractOptimization.isPartialAnnualized
        ? `（以上依夏月 5 個月＋非夏月 7 個月加權推算，採用已填 ${contractOptimization.periodsCount} 期；建議補滿 12 期電費單再正式向台電申請調整）`
        : '（已綜合 12 期完整帳單估算，仍建議確認明年產能變化）'
      : demandEntries.length >= 3
        ? `（目前雖已填 ${demandEntries.length} 期，但全屬${singleSeasonDemandLabel}，單一季節不推算全年最適契約與年省金額，請補入另一季節帳單再比對）`
        : `（目前僅填 ${demandEntries.length} 期，尚不足 3 期，不進行年度最佳契約容量推薦；請補滿至少 3 期含夏月／非夏月帳單後再試算最適契約）`

    const optText = contractOptimization
      ? contractOptimization.annualSavingsNtd > 0
        ? `依已填 ${contractOptimization.periodsCount} 期最高需量，對候選契約容量逐一計算「基本費＋超約附加費」年總額，最划算契約容量為 ${contractOptimization.optimalContractKw.toLocaleString('zh-TW')} kW（年合計 ${contractOptimization.optimalAnnualTotalNtd.toLocaleString('zh-TW')} 元，比現況 ${contractOptimization.currentContractKw.toLocaleString('zh-TW')} kW 每年 ${contractOptimization.currentAnnualTotalNtd.toLocaleString('zh-TW')} 元可少繳約 ${contractOptimization.annualSavingsNtd.toLocaleString('zh-TW')} 元）`
        : `依已填 ${contractOptimization.periodsCount} 期最高需量逐一試算「基本費＋超約附加費」，現行 ${contractOptimization.currentContractKw.toLocaleString('zh-TW')} kW 已是目前最划算設定（年合計約 ${contractOptimization.currentAnnualTotalNtd.toLocaleString('zh-TW')} 元）`
      : null

    if (overallContractStatus === 'over_contract') {
      contractAdvice = optText
        ? `已有 ${overContractMonths} 期最高需量超過現行契約（最高達 ${peakDemandKw} kW），超約部分依台電規定按 2 倍／3 倍基本電費加收超約附加費。${optText}。若想免繳固定契約上調費用，也可評估排程削峰或裝設需量控制。${partialSuffix}`
        : `已有 ${overContractMonths} 期最高需量超過現行契約（最高達 ${peakDemandKw} kW），超約部分依台電規定按 2 倍／3 倍基本電費加收超約附加費。可先檢視排程削峰或需量控制，或補齊 3 期以上電費單再比較調高契約容量是否更划算。${partialSuffix}`
    } else if (overallContractStatus === 'near_limit') {
      contractAdvice = optText
        ? `最高需量已達契約容量的 ${round1(peakLoadRatio)}%，只差 ${round1(latestContractKw - peakDemandKw)} kW 就會觸發 2 倍超約附加費，屬於高風險邊緣。${optText}。建議盤點尖峰並存設備或設需量警報。${partialSuffix}`
        : `最高需量已達契約容量的 ${round1(peakLoadRatio)}%，只差 ${round1(latestContractKw - peakDemandKw)} kW 就會觸發 2 倍超約附加費，屬於高風險邊緣。建議盤點尖峰並存設備或設需量警報。${partialSuffix}`
    } else if (overallContractStatus === 'oversized') {
      contractAdvice = optText
        ? `最高需量為契約容量的 ${round1(peakLoadRatio)}%，現行契約容量偏高。${optText}。正式向台電申請調降前，請預留尖峰生產與夏月氣溫波動的需量餘裕，避免反過來觸發 2 倍／3 倍超約附加費。${partialSuffix}`
        : `最高需量為契約容量的 ${round1(peakLoadRatio)}%，本期契約容量偏高。正式評估向台電申請調降前，請預留夏月氣溫與尖峰生產餘裕，避免反過來觸發 2 倍／3 倍超約附加費。${partialSuffix}`
    } else {
      contractAdvice = optText
        ? `最高需量為契約容量的 ${round1(peakLoadRatio)}%，留有合理餘裕。${optText}。${partialSuffix}`
        : `最高需量為契約容量的 ${round1(peakLoadRatio)}%，本期留有合理餘裕。${partialSuffix}`
    }
  }

  // Power factor summary
  const pfEntries = analyses.filter((a) => a.powerFactorPct != null)
  const avgPowerFactorPct = pfEntries.length ? round1(pfEntries.reduce((s, a) => s + a.powerFactorPct!, 0) / pfEntries.length) : null
  let overallPfStatus: PowerFactorStatus = analyses.some((a) => a.pfStatus === 'exempt') ? 'exempt' : 'unknown'
  if (avgPowerFactorPct != null && overallPfStatus !== 'exempt') {
    if (avgPowerFactorPct < POWER_FACTOR_RULES.baselinePct) overallPfStatus = 'penalty'
    else if (avgPowerFactorPct >= POWER_FACTOR_RULES.rewardCapPct) overallPfStatus = 'optimal'
    else overallPfStatus = 'below_target'
  }

  const pfAdjEntries = analyses.filter((a) => a.pfAdjustmentNtd != null)
  const totalPfAdjustmentNtd = pfAdjEntries.length ? pfAdjEntries.reduce((s, a) => s + a.pfAdjustmentNtd!, 0) : null
  const pfSaveEntries = analyses.filter((a) => a.pfPotentialSaveNtd != null)
  const totalPfPotentialSaveNtd = pfSaveEntries.length ? pfSaveEntries.reduce((s, a) => s + a.pfPotentialSaveNtd!, 0) : null
  const avgPeriodPfSaveNtd =
    totalPfPotentialSaveNtd != null && pfSaveEntries.length > 0 ? Math.round(totalPfPotentialSaveNtd / pfSaveEntries.length) : null

  const pfSummerEntries = pfSaveEntries.filter((a) => a.season === 'summer')
  const pfNonSummerEntries = pfSaveEntries.filter((a) => a.season === 'non_summer')

  let annualPfPotentialSaveNtd: number | null = null
  let pfAnnualBasisNote: string | null = null
  if (pfSaveEntries.length > 0 && totalPfPotentialSaveNtd != null) {
    if (pfSaveEntries.length >= 12) {
      annualPfPotentialSaveNtd = Math.round((totalPfPotentialSaveNtd / pfSaveEntries.length) * 12)
      pfAnnualBasisNote = pfSaveEntries.length === 12 ? '依 12 期合計' : `依 ${pfSaveEntries.length} 期平均年化`
    } else if (pfSummerEntries.length > 0 && pfNonSummerEntries.length > 0) {
      const summerAvg = pfSummerEntries.reduce((s, a) => s + a.pfPotentialSaveNtd!, 0) / pfSummerEntries.length
      const nonSummerAvg = pfNonSummerEntries.reduce((s, a) => s + a.pfPotentialSaveNtd!, 0) / pfNonSummerEntries.length
      annualPfPotentialSaveNtd = Math.round(summerAvg * 5 + nonSummerAvg * 7)
      pfAnnualBasisNote = `依夏月 ${pfSummerEntries.length} 期×5＋非夏月 ${pfNonSummerEntries.length} 期×7 加權`
    } else {
      annualPfPotentialSaveNtd = null
      pfAnnualBasisNote =
        pfSummerEntries.length > 0
          ? '僅填夏月，單季不推估年省（補非夏月後可換算）'
          : '僅填非夏月，單季不推估年省（補夏月後可換算）'
    }
  }

  let pfAdvice = '填入電費單「功率因數（%）」即可檢查是否有被加收功率因數調整費，或還有多少 95% 上限減收空間。'
  if (overallPfStatus === 'exempt') {
    pfAdvice = `依台電規定，需量契約需達 ${POWER_FACTOR_RULES.minDemandContractKw} kW 以上才計收功率因數調整費；貴廠目前未達適用門檻。`
  } else if (avgPowerFactorPct != null) {
    const basisTag = pfAnnualBasisNote ? `（${pfAnnualBasisNote}）` : ''
    const savePhrase =
      annualPfPotentialSaveNtd != null
        ? `推估每年可省約 ${annualPfPotentialSaveNtd.toLocaleString('zh-TW')} 元${basisTag}`
        : `平均每期可多省約 ${(avgPeriodPfSaveNtd ?? 0).toLocaleString('zh-TW')} 元${basisTag}`
    if (overallPfStatus === 'penalty') {
      pfAdvice = `平均功率因數僅 ${avgPowerFactorPct}%，低於台電 80% 門檻！依規定計收功率因數調整費（每低 1% 加收 0.1% 電費），加裝自動功因改善電容器提升至 95%（最高減收上限 1.5%），${savePhrase}。`
    } else if (overallPfStatus === 'below_target') {
      pfAdvice = `平均功率因數 ${avgPowerFactorPct}%，已高於 80%（無加收功率因數調整費），但台電減收優惠最高可算到 95%（每超過 1% 減收 0.1%）。再提升至 95%，${savePhrase}。`
    } else {
      pfAdvice = `平均功率因數 ${avgPowerFactorPct}%，已達台電 95% 最高減收上限（享 1.5% 折扣），這項表現非常標準！`
    }
  }

  // TOU Plan Comparison
  const hasAnyBreakdown = validPeriods.some((p) =>
    [p.peakKwh, p.semiPeakKwh, p.satSemiPeakKwh, p.offPeakKwh].some((v) => typeof v === 'number' && Number.isFinite(v) && v > 0),
  )
  let touComparison: TouComparisonResult = {
    status: 'needs_tou_breakdown',
    currentLabel: primarySpec.label,
    summary:
      '你目前只填了總用電度數、未填尖峰／半尖峰／離峰度數，平台不硬猜分時比例。請看電費單正面明細或至台電高壓用戶入口網查詢後再試算方案切換。',
  }

  if (hasAnyBreakdown) {
    const inconsistent = analyses.some((a) => !a.touBreakdownConsistent)
    if (inconsistent) {
      touComparison = {
        status: 'mismatch_warning',
        currentLabel: primarySpec.label,
        summary: '你填寫的尖峰＋半尖峰＋離峰度數加總與「總用電度數」誤差超過 15%，請核對電費單度數欄位後再比較電價方案。',
      }
    } else {
      let minSum = 0
      let maxSum = 0
      let altLabel = ''
      let hasRange = false
      let totalTouKwh = 0
      let totalOffPeakKwh = 0

      for (let i = 0; i < validPeriods.length; i++) {
        const vp = validPeriods[i]
        const effId = analyses[i].effectivePlan.id
        const cmp = comparePeriodTouCost(vp, effId)
        if (cmp) {
          altLabel = cmp.altLabel
          minSum += cmp.minDiff
          maxSum += cmp.maxDiff
          hasRange = hasRange || cmp.isRange
        }
        const op = (nonNeg(vp.offPeakKwh) ?? 0) + (nonNeg(vp.satSemiPeakKwh) ?? 0)
        const pk = (nonNeg(vp.peakKwh) ?? 0) + (nonNeg(vp.semiPeakKwh) ?? 0)
        totalOffPeakKwh += op
        totalTouKwh += op + pk
      }

      const offPeakPct = totalTouKwh > 0 ? round1((totalOffPeakKwh / totalTouKwh) * 100) : undefined
      if (altLabel) {
        const fmtSpan = (lo: number, hi: number) =>
          lo === hi ? lo.toLocaleString('zh-TW') : `${lo.toLocaleString('zh-TW')}–${hi.toLocaleString('zh-TW')}`
        const touPeriodScope = validPeriods.length === 1 ? '當期' : `已填 ${validPeriods.length} 期累計`
        const direction =
          maxSum < 0
            ? `依已填 ${validPeriods.length} 期分時度數試算，改用「${altLabel}」${touPeriodScope}流動電費約可再省 ${fmtSpan(Math.abs(maxSum), Math.abs(minSum))} 元。`
            : minSum > 0
              ? `依已填 ${validPeriods.length} 期分時度數試算，現有「${primarySpec.label}」比「${altLabel}」${touPeriodScope}少繳約 ${fmtSpan(minSum, maxSum)} 元（建議維持原方案，除非大幅移轉產線到離峰）。`
              : `依已填 ${validPeriods.length} 期試算，兩方案${touPeriodScope}流動電費接近（差異約 ${minSum.toLocaleString('zh-TW')} 至 +${maxSum.toLocaleString('zh-TW')} 元），主要取決於夏月傍晚 16:00–22:00 尖峰時段用電佔比。`

        const extraRangeHint = hasRange ? '（夏月因二段式無分列 16–22 時度數，採 30%–55% 傍晚尖峰比例敏感度估算）' : ''
        touComparison = {
          status: 'compared',
          currentLabel: primarySpec.label,
          alternativeLabel: altLabel,
          summary: `${direction}${extraRangeHint}`,
          estimatedPeriodDiffRangeNtd: { min: minSum, max: maxSum },
          isSensitivityRange: hasRange,
          offPeakSharePct: offPeakPct,
        }
      }
    }
  }

  // Output 5: Annual KWh & Scope 2 emissions using 114-year official industry factor (0.466 kgCO2e/kWh)
  const annualizedFromSingleOrPartial = avgMonthlyKwh != null && kwhAnalyses.length < 12
  const annualKwh =
    totalKwh != null
      ? kwhAnalyses.length >= 12
        ? totalKwh
        : Math.round((totalKwh / kwhAnalyses.length) * 12)
      : null
  const annualScope2T =
    annualKwh != null ? round1((annualKwh * INDUSTRY_EMISSION_FACTOR.kgPerKwh) / 1000) : null

  return {
    monthsEntered,
    planLabel,
    planInferred,
    periods: analyses,
    totalBillNtd,
    totalKwh,
    avgPriceNtd,
    avgMonthlyBillNtd,
    avgMonthlyKwh,
    totalEstimatedBasicFeeNtd,
    basicFeeSharePct,
    latestContractKw,
    peakDemandKw,
    totalOverContractPenaltyNtd,
    overContractMonths,
    overallContractStatus,
    suggestedContractKw,
    estimatedMonthlyExcessSaveNtd,
    contractOptimization,
    contractAdvice,
    avgPowerFactorPct,
    overallPfStatus,
    totalPfAdjustmentNtd,
    totalPfPotentialSaveNtd,
    annualPfPotentialSaveNtd,
    pfAnnualBasisNote,
    pfAdvice,
    touComparison,
    annualKwh,
    annualizedFromSingleOrPartial,
    annualScope2T,
    emissionFactorKgPerKwh: INDUSTRY_EMISSION_FACTOR.kgPerKwh,
    caveat: BILL_INDUSTRY_DISCOUNT_CAVEAT,
  }
}
