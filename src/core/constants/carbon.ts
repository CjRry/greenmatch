import type { Fuel, InvStep } from '../types'

/** 2024 electricity emission factor announced by the Energy Administration (MOEA) in 2025. kgCO2e per kWh. */
export const ELECTRICITY_FACTOR = 0.474
export const ELECTRICITY_FACTOR_NOTE = '電力排碳係數 0.474 kgCO2e/度（經濟部能源署公告之 113 年度係數）'

export interface FuelInfo {
  label: string
  unit: 'L' | 'm³'
  /** kgCO2e per unit. Demonstration values derived from default heat content and IPCC CO2 factors. */
  factor: number
}

export const FUELS: Record<Fuel, FuelInfo> = {
  diesel: { label: '柴油', unit: 'L', factor: 2.606 },
  gasoline: { label: '車用汽油', unit: 'L', factor: 2.263 },
  natural_gas: { label: '天然氣', unit: 'm³', factor: 1.879 },
  lpg: { label: '液化石油氣', unit: 'L', factor: 1.753 },
  fuel_oil: { label: '燃料油', unit: 'L', factor: 3.111 },
}
export const FUEL_KEYS: readonly Fuel[] = ['diesel', 'gasoline', 'natural_gas', 'lpg', 'fuel_oil']
export const FUEL_FACTOR_NOTE = '燃料係數為示範用數值，正式盤查請以環境部「溫室氣體排放係數管理表」為準'

export interface InvStepInfo {
  key: InvStep
  n: number
  label: string
  what: string
}

/** The 6 steps of a carbon inventory (碳盤查). */
export const INV_STEPS: readonly InvStepInfo[] = [
  { key: 'boundary', n: 1, label: '邊界設定', what: '決定盤查的廠區、年度與營運控制範圍' },
  { key: 'sources', n: 2, label: '排放源鑑別', what: '列出用電、燃料、冷媒等排放源' },
  { key: 'activity', n: 3, label: '活動數據蒐集', what: '整理每月電費單、燃料採購與使用紀錄' },
  { key: 'calc', n: 4, label: '排放量計算', what: '活動數據乘上排放係數，算出範疇一、二排放' },
  { key: 'report', n: 5, label: '盤查報告', what: '彙整成盤查清冊與報告書' },
  { key: 'verify', n: 6, label: '第三方查證', what: '由查驗機構確認報告內容（客戶或法規要求時）' },
]
export const INV_STEP_KEYS: readonly InvStep[] = INV_STEPS.map((s) => s.key)

/** Context for the carbon-fee explainer. */
export const CARBON_FEE_NOTE =
  '碳費制度自 2025 年起計算排放量、2026 年首次繳交，對象為年排放 2.5 萬噸以上的企業。多數中小企業不是直接課徵對象，但大型客戶會要求供應商提供碳排數據並設定減碳目標。'
