import { formatEquipmentSummary, overallFactSource, resolveFactoryFacts, type NumericFactoryFactKey } from '../domain/factoryFacts'
import { formatNtd, formatNtdRange, formatNumber, nowIso } from '../format'
import type { Equip, FactSourceKind, Factory, FactoryFactKey, Need, QuoteFields, StageKey } from '../types'

export const SUBSIDY_CHECKED_DATE = '2026/11/13'
export const SUBSIDY_DISCLAIMER = '估算，以官方公告為準'
export const COMMERCIAL_EXCLUSION_NOTE =
  '新聞常見的「商業服務業節能設備汰換補助」（最高 50 萬）明文規定安裝地點不得為製造工廠，因此平台已自動排除，避免工廠白跑一趟。'

export type SubsidyId =
  | 'power-equipment'
  | 'espc'
  | 'moenv-grant'
  | 'moenv-loan'
  | 'tax-credit'
  | 'low-carbon-guidance'
  | 'green-tools'

export type SubsidyKind = '補助' | '貸款' | '稅務' | '輔導'
export type SubsidyStatus = 'likely' | 'needs_info' | 'not_applicable' | 'closed'
export type Reliability = 'official' | 'relayed'

export interface SubsidyDef {
  id: SubsidyId
  name: string
  agency: string
  kind: SubsidyKind
  plainDesc: string
  amountRule: string
  eligibility: string
  periodText: string
  deadlineIso?: string
  sourceUrl: string
  sourceLabel: string
  checkedDate: string
  reliability: Reliability
  reliabilityNote: string
  stageReminders: Partial<Record<StageKey, string>>
}

export const SUBSIDIES: readonly SubsidyDef[] = [
  {
    id: 'power-equipment',
    name: '動力與公用設備補助',
    agency: '經濟部能源署',
    kind: '補助',
    plainDesc: '汰換或新設高效率空壓機、風機、泵浦，按額定功率（kW）直接補助現金，中小企業再乘 1.2 倍。',
    amountRule:
      '空壓機：固定轉速迴轉式 700–2,500、可變轉速迴轉式 1,200–3,200、活塞式 1,000–1,100 元／kW（3.7–200 kW）；風機 2,000–2,400、泵浦 2,800–4,500 元／kW（0.75–200 kW）；低壓感應電動機 IE4 700 元／kW；中小企業 × 1.2；每年上限 500 萬（年營業額 1 億以上為 1,500 萬）。',
    eligibility:
      '依法登記之法人（另含公法人與核准設立醫療機構）；須為新品並內含 IE3 以上電動機，且已登錄於「動力與公用設備補助產品系統」；同一設備未領取其他政府補助（空壓機 3.7–200 kW、風機／泵浦 0.75–200 kW）。',
    periodText: '115 年購買期間至 2026/12/31，須於 2027/01/15（民國 116/1/15）前送件申請。',
    deadlineIso: '2027-01-15',
    sourceUrl: 'https://www.mdss.org.tw/subsidy/info/index.aspx',
    sourceLabel: '動力與公用設備補助作業要點（115/01/29 經能字第11558000230號令修正）',
    checkedDate: '2026/11/14',
    reliability: 'official',
    reliabilityNote:
      '每 kW 基準單價、功率級距、上限與中小企業 1.2 倍加成均對照經濟部能源署「動力與公用設備補助作業要點」（115/01/29 修正版）第三點官方基準表。',
    stageReminders: {
      assess: '確認需求設備的額定功率（kW 或馬力），系統才能估算動力設備補助。',
      survey: '請廠商場勘時確認汰換機種是否為新品且具 IE3 以上效率。',
      quote: '務必確認報價機型是否已登錄於「動力與公用設備補助產品系統」。',
      contract: '確認購買日期在 2026/12/31 前，合約應載明設備型號與額定 kW。',
      construction: '保留統一發票（買受人須為工廠）、舊機汰換與新機安裝前後照片、銘牌近照。',
      acceptance: '動力與公用設備補助須於 116/1/15 前送件，驗收後請儘速整理發票與照片申請。',
      compare: '若尚未送出動力設備補助申請，請注意 116/1/15 截止期限。',
    },
  },
  {
    id: 'espc',
    name: '節能績效保證專案示範推廣補助（ESCO）',
    agency: '經濟部能源署',
    kind: '補助',
    plainDesc: '搭配 ESCO 廠商簽訂績效保證合約進行系統節能改善，依計畫經費比例補助。',
    amountRule: '原則補助計畫經費 20%，中小企業可提高至 30%，屬優先示範項目再提高 10%；單一計畫上限 500 萬。',
    eligibility: '契約容量 100 kW 以上、節能率須達 10% 以上；須搭配 ESCO 績效保證合約並於施工前申請；未獲其他政府補助。',
    periodText: '115 年度受理期（114/8/18–9/30）已截止；116 年度計畫已公告，受理期間請依能源署最新公告為準。',
    sourceUrl: 'https://www.moeaea.gov.tw/ecw/populace/Law/Content.aspx?menu_id=26792',
    sourceLabel: '能源署：節能績效保證專案示範推廣補助',
    checkedDate: SUBSIDY_CHECKED_DATE,
    reliability: 'official',
    reliabilityNote: '補助比例、契約容量與節能率條件來自能源署官方公告。',
    stageReminders: {
      assess: '若契約容量達 100 kW 以上，可優先挑選具 ESCO 資格與可協助申請補助的廠商。',
      survey: '場勘時量測基線用電，確認預估節能率是否可達 10% 以上。',
      quote: '比較報價時注意節能率需 ≥ 10%，且同一設備不可同時領動力設備補助。',
      contract: 'ESCO 補助須在施工前申請並核定，116 年度受理期間請先確認官方公告再動工。',
      construction: '依核定計畫施工並保留量測紀錄，作為後續節能績效驗證依據。',
      acceptance: '完成節能率量測與驗證（M&V），準備結案請款文件。',
    },
  },
  {
    id: 'tax-credit',
    name: '產創條例第 10 條之 1 投資抵減',
    agency: '經濟部產業發展署／財政部',
    kind: '稅務',
    plainDesc: '購置全新節能減碳設備支出達 100 萬元以上，可直接抵減企業營所稅。',
    amountRule: '當年度支出金額 5% 抵減當年度營所稅，或 3% 分三年抵減；抵減額不超過當年度應納營所稅額 30%。',
    eligibility: '當年度購置節能減碳設備支出 100 萬至 20 億元；適用期間至 2029 年底。',
    periodText: '於設備交貨之次年 1 月至 5 月提出申請（配合營所稅申報）。',
    deadlineIso: '2029-12-31',
    sourceUrl: 'https://udn.com/news/story/7243/9187991',
    sourceLabel: '新版產創條例第 10-1 條投資抵減重點',
    checkedDate: SUBSIDY_CHECKED_DATE,
    reliability: 'relayed',
    reliabilityNote: '抵減比率（5%／3%）與 100 萬–20 億門檻係依報導整理產創條例第 10 條之 1 規定，實際適用條文以全國法規資料庫最新公告為準。',
    stageReminders: {
      quote: '報價滿 100 萬元即可適用投資抵減（5% 抵當年營所稅），可與動力設備補助併同評估。',
      contract: '合約與發票品名應明確列出設備名稱、規格與交貨日期。',
      construction: '保留設備交貨驗收單與統一發票，作為次年 1–5 月申請投資抵減憑證。',
      acceptance: '記錄設備實際交貨與驗收日期，於交貨次年 1–5 月向產發署系統提出申請。',
    },
  },
  {
    id: 'moenv-grant',
    name: '溫室氣體減量技術及氣候變遷調適補助',
    agency: '環境部（碳費基金）',
    kind: '補助',
    plainDesc: '鼓勵導入減碳技術、節能措施或低碳燃料轉換，由碳費基金補助計畫經費。',
    amountRule: '原則以全案總經費 50% 為補助上限。',
    eligibility: '公司、行號、工廠皆可申請；涵蓋節能措施、低碳燃料轉換等，單純碳盤查不在補助範圍。',
    periodText: '2026/7/14 發布辦法，當期具體受理方式與截止日待官方公告。',
    sourceUrl: 'https://udn.com/news/story/7266/9630638',
    sourceLabel: '環境部發布碳費補助辦法',
    checkedDate: SUBSIDY_CHECKED_DATE,
    reliability: 'relayed',
    reliabilityNote: '依據辦法發布報導整理，具體受理梯次、申請方式與能否與能源署補助併用尚待官方公告確認。',
    stageReminders: {
      quote: '若方案屬於大幅減碳或低碳燃料轉換，可留意環境部碳費基金補助受理公告。',
    },
  },
  {
    id: 'moenv-loan',
    name: '減碳專案貸款信保與利息補貼',
    agency: '環境部（碳費基金）',
    kind: '貸款',
    plainDesc: '針對減碳設備資本支出提供專案貸款信用保證與利息補貼，減輕初期資金壓力。',
    amountRule: '貸款額度最高 5,000 萬元（不超過專案經費 8 成）；信保最高 9 成；利息補貼年利率 1%，最長 5 年。',
    eligibility: '用於能效提升、低碳燃料轉換、再生能源或製程改善等減碳設備資本支出。',
    periodText: '預計 2026 年 11 月底開辦（依報導資訊，實際開辦日期以環境部公告為準）。',
    sourceUrl: 'https://n.yam.com/Article/20260917187457',
    sourceLabel: '碳費基金增訂減碳專案貸款信保與利息補貼',
    checkedDate: SUBSIDY_CHECKED_DATE,
    reliability: 'relayed',
    reliabilityNote: '依據新聞報導整理，開辦日與申貸銀行窗口待正式開辦後確認。',
    stageReminders: {
      contract: '若需分期融資，可評估環境部減碳專案貸款（最高 5,000 萬、利息補貼 1%）。',
    },
  },
  {
    id: 'low-carbon-guidance',
    name: '中小型製造業低碳輔導計畫',
    agency: '經濟部產業發展署',
    kind: '輔導',
    plainDesc: '提供碳盤查查證輔導、節能診斷與能源監視輔導，協助製造業建立碳排與用電基準。',
    amountRule: '碳盤查查證輔導企業自籌 9 萬元；節能診斷、能源監視輔導免費。',
    eligibility: '依法辦理工廠登記之製造業（節能診斷主要針對契約容量 800 kW 以下用戶）。',
    periodText: '年度輔導受理名額依產業發展署公告為準（頁面未載明固定截止日）。',
    sourceUrl: 'https://assist.nat.gov.tw/wSite/ct?xItem=289522&ctNode=150&mp=2',
    sourceLabel: '產業競爭力發展中心：中小型製造業低碳輔導計畫',
    checkedDate: SUBSIDY_CHECKED_DATE,
    reliability: 'official',
    reliabilityNote: '金額與資格來自經濟部產業競爭力發展中心頁面。',
    stageReminders: {
      register: '若有碳盤查或查證需求，可同步申請產發署低碳輔導（查證輔導自籌 9 萬元）。',
    },
  },
  {
    id: 'green-tools',
    name: '中小企業綠色競爭力計畫',
    agency: '經濟部中小及新創企業署',
    kind: '輔導',
    plainDesc: '提供免費碳估算工具、空壓機與空調減碳菜單及診斷輔導，適合剛起步的中小企業。',
    amountRule: '線上碳估算工具與減碳菜單免費使用，另提供診斷輔導資源。',
    eligibility: '符合中小企業認定標準之企業。',
    periodText: '線上工具常態開放，診斷輔導名額依年度公告。',
    sourceUrl: 'https://assist.nat.gov.tw/wSite/ct?xItem=289683&ctNode=150&mp=2',
    sourceLabel: '產業競爭力發展中心：中小企業提升綠色競爭力計畫',
    checkedDate: SUBSIDY_CHECKED_DATE,
    reliability: 'official',
    reliabilityNote: '資源內容來自經濟部產業競爭力發展中心官方頁面。',
    stageReminders: {},
  },
]

export const SUBSIDY_BY_ID = Object.fromEntries(SUBSIDIES.map((s) => [s.id, s])) as Record<SubsidyId, SubsidyDef>

export function getSubsidyDef(id: SubsidyId): SubsidyDef {
  return SUBSIDY_BY_ID[id]
}

const HP_TO_KW_TABLE: Record<number, number> = {
  5: 3.7,
  7.5: 5.5,
  10: 7.5,
  15: 11,
  20: 15,
  25: 18.5,
  30: 22,
  40: 30,
  50: 37,
  60: 45,
  75: 55,
  100: 75,
  125: 90,
  150: 110,
  200: 150,
}

/** Convert horsepower (HP / 馬力) to standard industrial motor kW. */
export function hpToKw(hp: number): number {
  if (!Number.isFinite(hp) || hp <= 0) return 0
  if (HP_TO_KW_TABLE[hp] != null) return HP_TO_KW_TABLE[hp]
  return Math.round(hp * 0.746 * 10) / 10
}

function roundSubsidy(n: number): number {
  if (n >= 100_000) return Math.round(n / 10_000) * 10_000
  if (n >= 10_000) return Math.round(n / 1_000) * 1_000
  return Math.round(n / 100) * 100
}

export interface SubsidyRange {
  min: number
  max: number
}

export interface SubsidyMatchInput {
  factory?: Factory | null
  need?: Pick<Need, 'form' | 'budgetNtd'> | null
  quoteFields?: QuoteFields | null
  totalQuoteNtd?: number | null
  context?: 'match' | 'quote' | 'case' | 'hub' | 'carbon'
}

export interface SubsidyMatchItem {
  def: SubsidyDef
  status: SubsidyStatus
  amount: SubsidyRange | null
  amountNote?: string
  reason: string
  missingFields: string[]
  deadlineNote?: string
}

export interface SubsidyFactRef {
  key: FactoryFactKey | 'spend' | 'subsidyRate'
  label: string
  displayValue: string
  source: FactSourceKind
  note: string
  editable?: {
    factKey: NumericFactoryFactKey
    initialValue: number | null
    unit: string
    placeholder?: string
  }
}

export interface SubsidyMatchSummary {
  items: SubsidyMatchItem[]
  totalRange: SubsidyRange | null
  totalNote?: string
  usesRelayedRates: boolean
  taxCreditRange: SubsidyRange | null
  nearestDeadline?: { label: string; dateText: string }
  checkedDate: string
  disclaimer: string
  factSource: FactSourceKind
  provenance: SubsidyFactRef[]
}

const POWER_LABEL: Partial<Record<Equip, string>> = {
  air_compressor: '空壓機',
  pump_fan: '泵浦／風機',
}

interface PowerRateTier {
  label: string
  min: number
  max: number
  tierLabel: string
}

/**
 * 依《動力與公用設備補助作業要點》（115/01/29 修正版）第三點官方基準表，
 * 按設備類別與單台額定功率（kW）取得官方補助單價區間（元／kW）。
 * 若超出作業要點受理之單台功率範圍則回傳 null。
 */
export function resolvePowerRate(equip: Equip, kw: number): PowerRateTier | null {
  if (equip === 'air_compressor') {
    if (kw >= 3.7 && kw <= 75) return { label: '空壓機', min: 900, max: 3200, tierLabel: '3.7–75 kW' }
    if (kw > 75 && kw <= 200) return { label: '空壓機', min: 700, max: 3000, tierLabel: '>75–200 kW' }
    return null
  }
  if (equip === 'pump_fan') {
    if (kw >= 0.75 && kw <= 37) return { label: '泵浦／風機', min: 2200, max: 3500, tierLabel: '0.75–37 kW' }
    if (kw > 37 && kw <= 75) return { label: '泵浦／風機', min: 2000, max: 3300, tierLabel: '>37–75 kW' }
    if (kw > 75 && kw <= 150) return { label: '泵浦／風機', min: 2400, max: 4100, tierLabel: '>75–150 kW' }
    if (kw > 150 && kw <= 200) return { label: '泵浦／風機', min: 2400, max: 4500, tierLabel: '>150–200 kW' }
    return null
  }
  return null
}

const ESPC_PRIORITY_EQUIPS = new Set<Equip>(['air_compressor', 'chiller', 'hvac', 'boiler', 'ems', 'heat_pump'])

function isCarbonOnlyNeed(need: SubsidyMatchInput['need']): boolean {
  if (!need || !need.form.items.length) return false
  return need.form.items.every((it) => it.equip === 'carbon_consulting')
}

function hasCarbonNeed(need: SubsidyMatchInput['need']): boolean {
  return !!need?.form.items.some((it) => it.equip === 'carbon_consulting')
}

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000

/**
 * 台灣（UTC+8，無日光節約）當地的今天，格式 `YYYY-MM-DD`。
 * 補助截止日是台灣的日期；直接取 UTC 日期，台灣時間 00:00–08:00 會晚一天才判定截止。
 */
export function taipeiToday(now: string | Date = nowIso()): string {
  const ms = typeof now === 'string' ? Date.parse(now) : now.getTime()
  return new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(0, 10)
}

export function matchSubsidies(input: SubsidyMatchInput, today = taipeiToday()): SubsidyMatchSummary {
  const { factory, need, quoteFields, totalQuoteNtd, context = 'match' } = input
  const facts = resolveFactoryFacts(factory)
  const isSme = factory ? factory.factory.employees < 200 : true
  const spend = totalQuoteNtd ?? need?.budgetNtd ?? null
  const carbonOnly = context === 'carbon' || isCarbonOnlyNeed(need)
  const items: SubsidyMatchItem[] = []

  // 1. 動力與公用設備補助
  const powerDef = SUBSIDY_BY_ID['power-equipment']
  const factoryEquips = facts.equipment.value
  const candidateItems = need
    ? need.form.items.filter((it) => it.equip === 'air_compressor' || it.equip === 'pump_fan')
    : factoryEquips
        .filter((e) => e.type === 'air_compressor' || e.type === 'pump_fan')
        .map((e) => ({ equip: e.type, quantity: e.quantity, ratedKw: e.ratedKw ?? null }))

  if (context === 'carbon' || candidateItems.length === 0) {
    items.push({
      def: powerDef,
      status: 'not_applicable',
      amount: null,
      reason: '此方案僅適用空壓機、泵浦／風機汰換或新設。',
      missingFields: [],
    })
  } else if (today > '2027-01-15') {
    items.push({
      def: powerDef,
      status: 'closed',
      amount: null,
      reason: '115 年度已於 2027/01/15 截止送件，請留意 116 年度公告。',
      missingFields: [],
      deadlineNote: '本期已截止（116/1/15），待下一年度公告',
    })
  } else {
    let minSum = 0
    let maxSum = 0
    let completeCount = 0
    let outOfRangeCount = 0
    const missing = new Set<string>()
    const descParts: string[] = []

    for (const it of candidateItems) {
      const equip = it.equip as Equip
      const equipLabel = POWER_LABEL[equip] ?? equip
      const matchFactoryEq = factoryEquips.find((e) => e.type === equip)
      const qty = it.quantity ?? matchFactoryEq?.quantity ?? null
      const kw = it.ratedKw ?? matchFactoryEq?.ratedKw ?? null
      if (qty == null || qty <= 0) missing.add('設備數量')
      if (kw == null || kw <= 0) missing.add('每台額定功率（kW 或馬力）')
      if (qty != null && qty > 0 && kw != null && kw > 0) {
        const tier = resolvePowerRate(equip, kw)
        if (!tier) {
          outOfRangeCount++
          continue
        }
        completeCount++
        const mult = isSme ? 1.2 : 1
        minSum += qty * kw * tier.min * mult
        maxSum += qty * kw * tier.max * mult
        const kwSourceNote = it.ratedKw == null && matchFactoryEq?.ratedKw != null ? '（依貴廠檔案登記功率估算）' : ''
        descParts.push(`${equipLabel} ${qty} 台、各 ${kw} kW${kwSourceNote}`)
      }
    }

    if (completeCount === 0 && outOfRangeCount > 0 && missing.size === 0) {
      items.push({
        def: powerDef,
        status: 'not_applicable',
        amount: null,
        reason: '單台額定功率超出 115 年作業要點補助範圍（空壓機 3.7–200 kW、風機／泵浦 0.75–200 kW）。',
        missingFields: [],
      })
    } else if (completeCount === 0) {
      items.push({
        def: powerDef,
        status: 'needs_info',
        amount: null,
        amountNote: '補上功率後可估算',
        reason: `需要「${Array.from(missing).join('、')}」才能估算補助金額。`,
        missingFields: Array.from(missing),
        deadlineNote: '12/31 前購買，116/1/15 前送件',
      })
    } else {
      const cap = factory?.factory.revenueOver100M ? 15_000_000 : 5_000_000
      const min = Math.min(cap, roundSubsidy(minSum))
      const max = Math.min(cap, roundSubsidy(maxSum))
      const smeText = isSme ? '，中小企業加成 1.2 倍' : ''
      const missText = missing.size ? `（另有項目缺 ${Array.from(missing).join('、')}）` : ''
      const rangeText = outOfRangeCount > 0 ? '（已排除超出 200 kW 或低於下限機組）' : ''
      items.push({
        def: powerDef,
        status: 'likely',
        amount: { min, max },
        reason: `${descParts.join('、')}${smeText}${missText}${rangeText}。`,
        missingFields: Array.from(missing),
        deadlineNote: '12/31 前購買，116/1/15 前送件',
      })
    }
  }

  // 2. 節能績效保證專案補助（ESCO）
  const espcDef = SUBSIDY_BY_ID.espc
  const contractKw = facts.contractKw.value
  const contractSource = facts.contractKw.source
  const hasPriority = need?.form.items.some((it) => it.equip !== 'carbon_consulting' && ESPC_PRIORITY_EQUIPS.has(it.equip as Equip)) ?? false
  if (carbonOnly) {
    items.push({
      def: espcDef,
      status: 'not_applicable',
      amount: null,
      reason: '僅做碳盤查不適用 ESCO 設備節能績效保證補助。',
      missingFields: [],
    })
  } else if (contractKw == null) {
    items.push({
      def: espcDef,
      status: 'needs_info',
      amount: null,
      reason: '補上契約容量就能判斷（須達 100 kW 以上）。',
      missingFields: ['契約容量（kW）'],
      deadlineNote: '115 年度已截止；116 年度已公告，須於施工前申請',
    })
  } else if (contractSource === 'estimate') {
    items.push({
      def: espcDef,
      status: 'needs_info',
      amount: null,
      reason: `依估算的契約容量 ${formatNumber(contractKw)} kW；請確認實際台電契約容量是否達 100 kW 以上。`,
      missingFields: ['契約容量（kW）'],
      deadlineNote: '115 年度已截止；116 年度已公告，須於施工前申請',
    })
  } else if (contractKw < 100) {
    items.push({
      def: espcDef,
      status: 'not_applicable',
      amount: null,
      reason: `契約容量須達 100 kW 以上（目前填寫 ${contractKw} kW）。`,
      missingFields: [],
    })
  } else if (quoteFields?.savePct != null && quoteFields.savePct < 10) {
    items.push({
      def: espcDef,
      status: 'not_applicable',
      amount: null,
      reason: `節能率須達 10% 以上（本報價預估省電 ${quoteFields.savePct}%）。`,
      missingFields: [],
    })
  } else {
    const minRate = 0.2
    const maxRate = (isSme ? 0.3 : 0.2) + (hasPriority ? 0.1 : 0)
    const amount =
      spend != null && spend > 0
        ? {
            min: Math.min(5_000_000, roundSubsidy(spend * minRate)),
            max: Math.min(5_000_000, roundSubsidy(spend * maxRate)),
          }
        : null
    items.push({
      def: espcDef,
      status: 'likely',
      amount,
      amountNote: amount ? undefined : '報價後可估算',
      reason: `契約容量 ${contractKw} kW 符合 100 kW 門檻，補助比率 ${Math.round(minRate * 100)}–${Math.round(maxRate * 100)}%（上限 500 萬）。`,
      missingFields: [],
      deadlineNote: '115 年度已截止；116 年度已公告，須於施工前申請',
    })
  }

  // 3. 產創條例第 10 條之 1 投資抵減
  const taxDef = SUBSIDY_BY_ID['tax-credit']
  if (carbonOnly) {
    items.push({
      def: taxDef,
      status: 'not_applicable',
      amount: null,
      reason: '投資抵減僅適用購置節能減碳設備，不適用純盤查服務。',
      missingFields: [],
    })
  } else if (today > '2029-12-31') {
    items.push({
      def: taxDef,
      status: 'closed',
      amount: null,
      reason: '產創條例第 10 條之 1 優惠期間已於 2029 年底屆滿。',
      missingFields: [],
    })
  } else if (spend != null && spend < 1_000_000) {
    items.push({
      def: taxDef,
      status: 'not_applicable',
      amount: null,
      reason: `當年度設備支出須達 100 萬元以上（目前約 ${formatNtd(spend)}）。`,
      missingFields: [],
    })
  } else if (spend != null && spend >= 1_000_000) {
    const credit = Math.round(spend * 0.05)
    items.push({
      def: taxDef,
      status: 'likely',
      amount: { min: credit, max: credit },
      reason: '設備支出滿 100 萬，可抵減當年度營所稅 5%（受當年應納稅額 30% 限制）。',
      missingFields: [],
      deadlineNote: '交貨次年 1–5 月申請',
    })
  } else {
    items.push({
      def: taxDef,
      status: 'likely',
      amount: null,
      amountNote: '報價後可估算',
      reason: '設備支出滿 100 萬，可抵營所稅 5%（或 3% 分三年）。',
      missingFields: [],
      deadlineNote: '交貨次年 1–5 月申請',
    })
  }

  // 4. 環境部減量技術補助（碳費基金）
  const moenvGrantDef = SUBSIDY_BY_ID['moenv-grant']
  if (carbonOnly) {
    items.push({
      def: moenvGrantDef,
      status: 'not_applicable',
      amount: null,
      reason: '碳費基金補助辦法明定碳盤查不在補助範圍內。',
      missingFields: [],
    })
  } else {
    const cap50 = spend != null && spend > 0 ? roundSubsidy(spend * 0.5) : null
    items.push({
      def: moenvGrantDef,
      status: 'needs_info',
      amount: null,
      amountNote: cap50 ? `上限 50%（依預算約 ${formatNtd(cap50)}，待公告）` : '待官方公告受理方式',
      reason: '補助上限為全案經費 50%，惟 2026/7/14 發布辦法後具體受理方式與併領規則待確認，暫不計入合計。',
      missingFields: ['待官方公告受理方式'],
      deadlineNote: '待官方公告受理方式',
    })
  }

  // 5. 環境部減碳專案貸款信保與利息補貼
  const moenvLoanDef = SUBSIDY_BY_ID['moenv-loan']
  if (carbonOnly) {
    items.push({
      def: moenvLoanDef,
      status: 'not_applicable',
      amount: null,
      reason: '減碳專案貸款僅適用減碳設備資本支出。',
      missingFields: [],
    })
  } else {
    let loanNote = '最高貸款 5,000 萬、利息補貼 1% 最長 5 年（不計入補助合計）'
    if (spend != null && spend > 0) {
      const loanAmt = Math.min(50_000_000, Math.round(spend * 0.8))
      const y1 = Math.round(loanAmt * 0.01)
      const y5 = Math.round(loanAmt * 0.01 * 5)
      loanNote = `若貸 ${formatNtd(loanAmt)}，利息補貼 1 年約 ${formatNtd(y1)}–5 年約 ${formatNtd(y5)}`
    }
    items.push({
      def: moenvLoanDef,
      status: 'likely',
      amount: null,
      amountNote: loanNote,
      reason: '針對減碳設備資本支出提供最高 9 成信保與 1% 利息補貼，預計 11 月底開辦（不計入現金補助合計）。',
      missingFields: [],
      deadlineNote: '預計 2026 年 11 月底開辦（待確認）',
    })
  }

  // 6 & 7. 碳盤查／綠色競爭力輔導
  const guidanceDef = SUBSIDY_BY_ID['low-carbon-guidance']
  const greenToolsDef = SUBSIDY_BY_ID['green-tools']
  const showGuidance = context === 'carbon' || hasCarbonNeed(need)
  if (showGuidance) {
    const hasReg = factory?.factory.hasFactoryReg
    items.push({
      def: guidanceDef,
      status: hasReg === false ? 'not_applicable' : 'likely',
      amount: null,
      amountNote: '盤查查證自籌 9 萬／節能診斷免費',
      reason:
        hasReg === false
          ? '本輔導須具備工廠登記。'
          : hasReg === true
            ? '具備工廠登記之製造業，可申請碳盤查查證輔導（自籌 9 萬）與免費節能診斷。'
            : '製造業具工廠登記即可申請碳盤查查證輔導（自籌 9 萬）與免費節能診斷。',
      missingFields: hasReg == null ? ['是否有工廠登記'] : [],
    })
    items.push({
      def: greenToolsDef,
      status: isSme ? 'likely' : 'not_applicable',
      amount: null,
      amountNote: '免費碳估算工具與減碳菜單',
      reason: isSme ? '中小企業可免費使用碳估算工具、空壓機與空調減碳菜單及診斷輔導。' : '本計畫以中小企業（員工未滿 200 人）為主要對象。',
      missingFields: [],
    })
  } else {
    items.push({
      def: guidanceDef,
      status: 'not_applicable',
      amount: null,
      reason: '主要適用於碳盤查查證輔導（自籌 9 萬）與免費節能診斷，可於碳盤查頁面申請。',
      missingFields: [],
    })
    items.push({
      def: greenToolsDef,
      status: 'not_applicable',
      amount: null,
      reason: '提供免費碳估算工具與減碳菜單，可於碳盤查頁面查看。',
      missingFields: [],
    })
  }

  // Compute non-overlapping cash-grant totalRange: max(power-equipment, espc).
  // Tax credit (tax-credit) is reported separately (not cash; capped at 30% of corporate tax).
  const powerRes = items.find((i) => i.def.id === 'power-equipment')
  const espcRes = items.find((i) => i.def.id === 'espc')
  const taxRes = items.find((i) => i.def.id === 'tax-credit')

  const powerAmt = powerRes?.status === 'likely' ? powerRes.amount : null
  const espcAmt = espcRes?.status === 'likely' ? espcRes.amount : null
  const taxAmt = taxRes?.status === 'likely' ? taxRes.amount : null

  let baseGrant: SubsidyRange | null = null
  let usesRelayedRates = false
  let overlapNote: string | undefined
  if (powerAmt && espcAmt) {
    if (espcAmt.max >= powerAmt.max) {
      baseGrant = espcAmt
    } else {
      baseGrant = powerAmt
      usesRelayedRates = powerRes?.def.reliability === 'relayed'
    }
    overlapNote = '動力設備補助與 ESCO 補助同一設備不重複領取，合計已自動取較高者估算。'
  } else if (powerAmt) {
    baseGrant = powerAmt
    usesRelayedRates = powerRes?.def.reliability === 'relayed'
  } else if (espcAmt) {
    baseGrant = espcAmt
  }

  const totalRange: SubsidyRange | null = baseGrant
  const taxCreditRange: SubsidyRange | null = taxAmt

  let nearestDeadline: { label: string; dateText: string } | undefined
  if (powerRes?.status === 'likely' || powerRes?.status === 'needs_info') {
    nearestDeadline = { label: '動力與公用設備補助', dateText: '2026/12/31 前購買，116/1/15 前送件' }
  } else if (taxRes?.status === 'likely') {
    nearestDeadline = { label: '產創條例 10-1 投資抵減', dateText: '交貨次年 1–5 月申請' }
  }

  const provenance: SubsidyFactRef[] = []
  if (!carbonOnly) {
    provenance.push({
      key: 'contractKw',
      label: facts.contractKw.label,
      displayValue: facts.contractKw.value != null ? `${formatNumber(facts.contractKw.value)} kW` : '尚未填寫',
      source: facts.contractKw.source,
      note: facts.contractKw.note,
      editable: {
        factKey: 'contractKw',
        initialValue: facts.contractKw.value,
        unit: 'kW',
        placeholder: '例如 180',
      },
    })
    const needHasRatedPower =
      candidateItems.length > 0 && candidateItems.every((it) => it.quantity != null && it.quantity > 0 && it.ratedKw != null && it.ratedKw > 0)
    provenance.push({
      key: 'equipment',
      label: '設備台數與額定功率',
      displayValue: needHasRatedPower
        ? candidateItems.map((it) => `${POWER_LABEL[it.equip as Equip] ?? it.equip} ${it.quantity} 台・各 ${it.ratedKw} kW`).join('；')
        : formatEquipmentSummary(facts.equipment.value),
      source: needHasRatedPower ? 'user' : facts.equipment.source,
      note: needHasRatedPower ? '依需求表填寫之設備台數與功率' : facts.equipment.note,
    })
  } else {
    provenance.push({
      key: 'monthlyKwh',
      label: facts.monthlyKwh.label,
      displayValue: facts.monthlyKwh.value != null ? `${formatNumber(facts.monthlyKwh.value)} 度` : '尚未填寫',
      source: facts.monthlyKwh.source,
      note: facts.monthlyKwh.note,
      editable: {
        factKey: 'monthlyKwh',
        initialValue: facts.monthlyKwh.value,
        unit: '度',
        placeholder: '例如 65000',
      },
    })
  }
  if (usesRelayedRates) {
    provenance.push({
      key: 'subsidyRate',
      label: '補助單價基準',
      displayValue: '經銷商參考區間',
      source: 'estimate',
      note: '每 kW 補助基準採經銷商轉述之 115 年參考區間推估（尚未對齊能源署官方最新單價表）',
    })
  }
  if (spend != null && spend > 0) {
    provenance.push({
      key: 'spend',
      label: totalQuoteNtd != null ? '報價合計金額' : '需求預算金額',
      displayValue: formatNtd(spend),
      source: 'user',
      note: totalQuoteNtd != null ? '依廠商報價合計金額試算比例補助與投資抵減' : '依需求表填寫之預算金額試算',
    })
  }

  const factSource = overallFactSource(provenance.map((p) => p.source))

  return {
    items,
    totalRange,
    totalNote: overlapNote,
    usesRelayedRates,
    taxCreditRange,
    nearestDeadline,
    checkedDate: SUBSIDY_CHECKED_DATE,
    disclaimer: SUBSIDY_DISCLAIMER,
    factSource,
    provenance,
  }
}

export function stageSubsidyReminders(stage: StageKey, summary: SubsidyMatchSummary): { id: SubsidyId; title: string; body: string }[] {
  const out: { id: SubsidyId; title: string; body: string }[] = []
  const kwRef = summary.provenance.find((p) => p.key === 'contractKw')
  for (const it of summary.items) {
    if (it.status === 'not_applicable' || it.status === 'closed') continue
    let body = it.def.stageReminders[stage]
    if (it.def.id === 'power-equipment' && stage === 'assess') {
      if (it.status === 'likely' && it.amount) {
        body = `已估算動力設備補助（${formatNtdRange(it.amount.min, it.amount.max)}，依 115 年作業要點官方單價試算）；場勘與報價時請確認機種為 IE3 以上新品並已登錄補助產品系統。`
      } else if (it.status === 'likely') {
        body = '可能適用動力設備補助（按 kW 計價）；補齊設備台數與額定功率即可試算預估補助區間。'
      }
    } else if (it.def.id === 'espc' && stage === 'assess') {
      if (it.status === 'likely') {
        body = `貴廠契約容量（${kwRef?.displayValue ?? '已達 100 kW 以上'}）已符合門檻，可優先挑選具 ESCO 資格與可協助申請補助的廠商（116 年度受理期間依能源署公告）。`
      } else {
        body = '尚未確認台電契約容量；若達 100 kW 以上，可優先挑選具 ESCO 資格與可協助申請補助的廠商。'
      }
    } else if (it.def.id === 'tax-credit' && stage === 'quote' && it.amount) {
      body = `設備支出已達 100 萬元門檻，預估可抵減當年度營所稅 ${formatNtd(it.amount.min)}（5%），可與動力設備補助併同評估。`
    }
    if (body) out.push({ id: it.def.id, title: it.def.name, body })
  }
  return out
}
