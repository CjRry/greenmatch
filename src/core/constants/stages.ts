import type { Role, StageKey } from '../types'

export type StageOwner = Role | 'platform'

export interface StageInfo {
  key: StageKey
  /** 1–8 */
  n: number
  label: string
  /** What happens in this stage, in one sentence. */
  what: string
  owners: StageOwner[]
  ownerLabel: string
  /** Estimated duration. The deck notes these will be revised with pilot cases. */
  eta: string
  /** 「下一步，工廠需準備…」 */
  factoryPrep: string
  /** What the vendor does in this stage. */
  vendorTodo: string
}

/** The 8 standard stages from the team's deck, in order. */
export const STAGES: readonly StageInfo[] = [
  {
    key: 'register',
    n: 1,
    label: '需求登記',
    what: '用口語描述設備與問題，AI 整理成標準需求表，工廠確認後送出。',
    owners: ['factory'],
    ownerLabel: '工廠',
    eta: '約 10 分鐘',
    factoryPrep: '近 3 個月電費單、主要設備清單（數量與使用年份）',
    vendorTodo: '—',
  },
  {
    key: 'assess',
    n: 2,
    label: '初步評估',
    what: '平台依需求表推薦 2 家合適廠商，並附上推薦理由。',
    owners: ['platform'],
    ownerLabel: '平台',
    eta: '1–2 個工作天',
    factoryPrep: '查看推薦理由，選擇要邀請場勘的廠商',
    vendorTodo: '確認是否接案並回覆可到廠的時間',
  },
  {
    key: 'survey',
    n: 3,
    label: '現場場勘',
    what: '廠商到廠了解設備、產線與用電型態，必要時量測。',
    owners: ['vendor', 'factory'],
    ownerLabel: '廠商、工廠',
    eta: '3–7 天',
    factoryPrep: '安排熟悉設備的同仁陪同，準備配電盤與設備位置',
    vendorTodo: '到廠場勘，記錄設備與用電狀況',
  },
  {
    key: 'quote',
    n: 4,
    label: '方案與報價',
    what: '廠商提出改善方案與報價，AI 統一格式並用白話解說。',
    owners: ['vendor'],
    ownerLabel: '廠商',
    eta: '5–10 天',
    factoryPrep: '確認報價內容、安排內部評估',
    vendorTodo: '提交改善方案與報價單',
  },
  {
    key: 'contract',
    n: 5,
    label: '簽約',
    what: '確認施工範圍、費用、時程與保固。',
    owners: ['factory', 'vendor'],
    ownerLabel: '工廠、廠商',
    eta: '3–7 天',
    factoryPrep: '確認付款條件與可停機的時段，完成內部核決',
    vendorTodo: '提供合約與施工排程',
  },
  {
    key: 'construction',
    n: 6,
    label: '施工',
    what: '廠商依排程施工，並在平台回報進度。',
    owners: ['vendor'],
    ownerLabel: '廠商',
    eta: '1–4 週',
    factoryPrep: '配合停機與工安管理，指派現場窗口',
    vendorTodo: '依排程施工並回報進度',
  },
  {
    key: 'acceptance',
    n: 7,
    label: '驗收',
    what: '工廠確認施工成果與試運轉結果。',
    owners: ['factory'],
    ownerLabel: '工廠',
    eta: '1–3 天',
    factoryPrep: '對照合約逐項檢查，保留試運轉紀錄',
    vendorTodo: '陪同驗收並提供保固文件',
  },
  {
    key: 'compare',
    n: 8,
    label: '用電比較',
    what: '比較改善前後的用電，確認實際節能成效。',
    owners: ['platform', 'factory'],
    ownerLabel: '平台、工廠',
    eta: '改善後 1–3 個月',
    factoryPrep: '每月上傳電費單或電表讀數',
    vendorTodo: '協助說明節能成效',
  },
]

export const STAGE_KEYS: readonly StageKey[] = STAGES.map((s) => s.key)

export const STAGE_BY_KEY: Record<StageKey, StageInfo> = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<
  StageKey,
  StageInfo
>

/** 0-based position of a stage. */
export function stageIndex(key: StageKey): number {
  return STAGE_KEYS.indexOf(key)
}

export function nextStage(key: StageKey): StageKey | null {
  const i = stageIndex(key)
  return i >= 0 && i < STAGE_KEYS.length - 1 ? STAGE_KEYS[i + 1] : null
}

/** Whether the given side is responsible for acting in this stage. */
export function isOwner(key: StageKey, who: StageOwner): boolean {
  return STAGE_BY_KEY[key].owners.includes(who)
}

/** Shown wherever stage durations appear. */
export const ETA_NOTE = '各階段預估時間將依試行案例修正'
