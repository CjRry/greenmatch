/**
 * 台電電價與能源署電力排碳係數官方規則表（PROP-0007 4a 電費單健檢使用）。
 *
 * 原則：
 * - 每筆費率與公式都對應台電／經濟部能源署官方公告，附網址、生效日與查核日期。
 * - 不確定或未涵蓋的細節（如個別產業電價凍漲／減調係數）明示由使用者依電費單為準，不臆測。
 */

export const TARIFF_CHECKED_DATE = '2026-11-14'

export interface TariffSourceRef {
  id: string
  title: string
  agency: string
  effectiveDate: string
  checkedDate: string
  url: string
  note: string
}

export const TARIFF_SOURCES: readonly TariffSourceRef[] = [
  {
    id: 'taipower-114h2',
    title: '台灣電力公司《114年10月電價公告》（114/10/01 起實施・經能源署電價揭露專區查核）',
    agency: '台灣電力公司／經濟部能源署電價揭露專區',
    effectiveDate: '2025-10-01（114/10/01 零時起實施；115/3、115/9 審議會維持不調整）',
    checkedDate: TARIFF_CHECKED_DATE,
    url: 'https://www3.moeaea.gov.tw/ele102/Content/Messagess/contents.aspx?&SiteID=654246032665636316&MmmID=654246034110677254&MSID=1343206640732631102',
    note: '已依台電《114年10月電價公告》PDF（1140930_114年10月電價公告.pdf）逐項核對高壓二段式／三段式、低壓二段式與低壓非時間（需量）之基本電費、按戶基本費、流動電費與夏月起訖日期一致。',
  },
  {
    id: 'taipower-detail-pdf',
    title: '台電《詳細電價表》及營業規則（功率因數與超約計收規定・依台電營業規則整理）',
    agency: '台灣電力公司',
    effectiveDate: '2025-10-01',
    checkedDate: TARIFF_CHECKED_DATE,
    url: 'https://www.taipower.com.tw/media/xtofy2yw/%E8%A9%B3%E7%B4%B0%E9%9B%BB%E5%83%B9%E8%A1%A8.pdf?mediaDL=true',
    note: '依台電營業規則整理：功率因數基準 80%、每差 1% 增減電費 0.1%（上限 95%）；超約 10% 以內 2 倍、超過 10% 3 倍計收（官網 PDF 自動下載受 403 阻擋，此兩條尚待人工開啟原文 PDF 逐條核對）。',
  },
  {
    id: 'taipower-examples-pdf',
    title: '台電《各類電價表及計算範例》',
    agency: '台灣電力公司',
    effectiveDate: '2025-10-01',
    checkedDate: TARIFF_CHECKED_DATE,
    url: 'https://www.taipower.com.tw/media/wzicn04w/%E5%90%84%E9%A1%9E%E9%9B%BB%E5%83%B9%E8%A1%A8%E5%8F%8A%E8%A8%88%E7%AE%97%E7%AF%84%E4%BE%8B.pdf?mediaDL=true',
    note: '各時間電價時段劃分（二段式／三段式）與需量基本電費計算公式。',
  },
  {
    id: 'moea-emission-114',
    title: '114 年度電力排碳係數公告（產業 0.466 kgCO₂e/度）',
    agency: '經濟部能源署',
    effectiveDate: '2026-06-02（適用 114 年度排放量盤查）',
    checkedDate: TARIFF_CHECKED_DATE,
    url: 'https://www.moeaea.gov.tw/ECW/PDA.aspx?kind=1&news_id=34473',
    note: '公用售電業係數 0.467 kgCO₂e/度、產業電力排碳係數 0.466 kgCO₂e/度（113 年度舊值為 0.474）。',
  },
]

export type TariffPlanId = 'hv_2stage' | 'hv_3stage' | 'lv_2stage' | 'lv_non_tou' | 'unknown'
export type ConcreteTariffPlanId = Exclude<TariffPlanId, 'unknown'>
export type SeasonKind = 'summer' | 'non_summer'

export interface TariffEnergyRates {
  /** Non-TOU flat rate per kWh (applicable to lv_non_tou). */
  flat?: { summer: number; nonSummer: number }
  /** Weekday peak rate per kWh (summer; nonSummer null when scheme has no peak in non-summer, e.g. hv_3stage). */
  peak?: { summer: number; nonSummer: number | null }
  /** Weekday semi-peak rate per kWh (hv_3stage). */
  semiPeak?: { summer: number; nonSummer: number }
  /** Saturday semi-peak rate per kWh. */
  satSemiPeak?: { summer: number; nonSummer: number }
  /** Off-peak rate per kWh (weekday off-peak + Sunday & off-peak holidays). */
  offPeak?: { summer: number; nonSummer: number }
}

export interface TariffPlanSpec {
  id: ConcreteTariffPlanId
  label: string
  voltage: 'high' | 'low'
  summerPeriodText: string
  /** Regularly contracted demand fee (經常契約基本電費), NTD / kW / month. */
  basicFeePerKw: { summer: number; nonSummer: number }
  /** Per-customer monthly basic charge (按戶計收基本電費, 3-phase low voltage), NTD / month. */
  customerFeeNtd: number
  isTou: boolean
  scheduleHint: string
  energyRates: TariffEnergyRates
}

export const TARIFF_PLANS: Record<ConcreteTariffPlanId, TariffPlanSpec> = {
  hv_2stage: {
    id: 'hv_2stage',
    label: '高壓電力・二段式時間電價',
    voltage: 'high',
    summerPeriodText: '夏月 5/16–10/15；非夏月 10/16–5/15',
    basicFeePerKw: { summer: 223.6, nonSummer: 166.9 },
    customerFeeNtd: 0,
    isTou: true,
    scheduleHint: '平日尖峰夏月 09:00–24:00（6.75 元）、非夏月 06:00–11:00 及 14:00–24:00（6.37 元）；其餘與週日為離峰（2.71／2.46 元）。',
    energyRates: {
      peak: { summer: 6.75, nonSummer: 6.37 },
      satSemiPeak: { summer: 2.77, nonSummer: 2.54 },
      offPeak: { summer: 2.71, nonSummer: 2.46 },
    },
  },
  hv_3stage: {
    id: 'hv_3stage',
    label: '高壓電力・三段式時間電價',
    voltage: 'high',
    summerPeriodText: '夏月 5/16–10/15；非夏月 10/16–5/15',
    basicFeePerKw: { summer: 223.6, nonSummer: 166.9 },
    customerFeeNtd: 0,
    isTou: true,
    scheduleHint: '夏月週一至五 16:00–22:00 為高價尖峰（9.39 元），其餘日間半尖峰（5.85 元），離峰（2.53 元）；非夏月無尖峰段（僅半尖峰 5.47 元與離峰 2.32 元）。',
    energyRates: {
      peak: { summer: 9.39, nonSummer: null },
      semiPeak: { summer: 5.85, nonSummer: 5.47 },
      satSemiPeak: { summer: 2.6, nonSummer: 2.41 },
      offPeak: { summer: 2.53, nonSummer: 2.32 },
    },
  },
  lv_2stage: {
    id: 'lv_2stage',
    label: '低壓電力・二段式時間電價',
    voltage: 'low',
    summerPeriodText: '夏月 6/1–9/30；非夏月 10/1–5/31',
    basicFeePerKw: { summer: 236.2, nonSummer: 173.2 },
    customerFeeNtd: 262.5,
    isTou: true,
    scheduleHint: '適用於未滿 100 kW 工廠；平日尖峰 5.54／5.39 元、離峰 2.27／2.15 元，另含三相按戶基本費 262.5 元/月。',
    energyRates: {
      peak: { summer: 5.54, nonSummer: 5.39 },
      satSemiPeak: { summer: 2.76, nonSummer: 2.65 },
      offPeak: { summer: 2.27, nonSummer: 2.15 },
    },
  },
  lv_non_tou: {
    id: 'lv_non_tou',
    label: '低壓電力・非時間電價（需量契約）',
    voltage: 'low',
    summerPeriodText: '夏月 6/1–9/30；非夏月 10/1–5/31',
    basicFeePerKw: { summer: 236.2, nonSummer: 173.2 },
    customerFeeNtd: 262.5,
    isTou: false,
    scheduleHint: '不分時段單一電價（夏月 4.08 元/度、非夏月 3.87 元/度），另含經常契約基本電費與三相按戶基本費 262.5 元/月。',
    energyRates: {
      flat: { summer: 4.08, nonSummer: 3.87 },
    },
  },
}

export const TARIFF_PLAN_OPTIONS: readonly { id: TariffPlanId; label: string; hint: string }[] = [
  { id: 'hv_2stage', label: '高壓電力・二段式時間電價', hint: '契約容量常為 100 kW 以上（有尖峰／離峰度數）' },
  { id: 'hv_3stage', label: '高壓電力・三段式時間電價', hint: '契約容量常為 100 kW 以上（含夏月 16–22 時尖峰與半尖峰）' },
  { id: 'lv_2stage', label: '低壓電力・二段式時間電價', hint: '契約容量未滿 100 kW，有區分尖峰／離峰度數' },
  { id: 'lv_non_tou', label: '低壓電力・非時間電價（需量）', hint: '契約容量未滿 100 kW，不分尖離峰單一度數計費' },
  { id: 'unknown', label: '不確定／照電費單數字先健檢', hint: '平台依契約容量推估（≥100 kW 先比照高壓二段式、<100 kW 先比照低壓）' },
]

export const OVER_CONTRACT_RULES = {
  /** <= 10% excess over contracted demand is billed at 2x basic rate. */
  within10PctThreshold: 0.1,
  within10PctMultiplier: 2,
  /** > 10% excess over contracted demand is billed at 3x basic rate. */
  over10PctMultiplier: 3,
} as const

export const POWER_FACTOR_RULES = {
  baselinePct: 80,
  rewardCapPct: 95,
  /** Each 1% point below/above 80% adjusts monthly bill by +/- 0.1%. */
  stepRatePct: 0.1,
  minDemandContractKw: 30,
  minInstalledContractKw: 20,
} as const

export const INDUSTRY_EMISSION_FACTOR = {
  /** 114 年度產業電力排碳係數（2026-06-02 能源署公告）, kgCO2e/kWh. */
  kgPerKwh: 0.466,
  utilityKgPerKwh: 0.467,
  prev113KgPerKwh: 0.474,
  announcedDate: '2026-06-02',
  sourceId: 'moea-emission-114',
} as const

export const BILL_INDUSTRY_DISCOUNT_CAVEAT =
  '平台採用台電標準產業電價表（114 年下半年公告現行版）試算；若貴廠屬特定景氣衰退凍漲或減調業別，電費單實收單價可能略低，建議仍以帳單所載為準。'
