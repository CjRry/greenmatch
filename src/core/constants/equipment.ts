import type { Equip, Pressure, ScaleTier, Specialty } from '../types'

export interface EquipInfo {
  label: string
  /** Words a factory might use for this equipment; the rule-based parser matches these. */
  keywords: string[]
  /** Typical improvement directions shown in the need form. */
  directions: string[]
}

export const EQUIPS: readonly Equip[] = [
  'air_compressor',
  'hvac',
  'chiller',
  'lighting',
  'motor_vfd',
  'boiler',
  'pump_fan',
  'heat_pump',
  'solar_pv',
  'ems',
]

export const EQUIP_INFO: Record<Equip, EquipInfo> = {
  air_compressor: {
    label: '空壓機',
    keywords: ['空壓機', '空壓', '壓縮機', '空氣壓縮', '氣壓'],
    directions: ['空壓機汰換為變頻機種', '管路洩漏檢測與修補', '空壓系統壓力最佳化'],
  },
  hvac: {
    label: '空調',
    keywords: ['空調', '冷氣', '冷氣機', '箱型機', '分離式'],
    directions: ['空調效率改善', '老舊冷氣汰換為高效率機種', '溫度與排程控制'],
  },
  chiller: {
    label: '冰水主機',
    keywords: ['冰水主機', '冰水機', '冷凍機', '冰機', '冷卻水塔'],
    directions: ['冰水主機汰換', '冰水系統群控', '冷卻水塔變頻'],
  },
  lighting: {
    label: '照明',
    keywords: ['照明', '燈', '燈管', '水銀燈', '日光燈', '廠房燈'],
    directions: ['LED 照明汰換', '照明分區與感應控制'],
  },
  motor_vfd: {
    label: '馬達／變頻',
    keywords: ['馬達', '電動機', '變頻', '變頻器'],
    directions: ['更換高效率馬達（IE3 以上）', '加裝變頻器'],
  },
  boiler: {
    label: '鍋爐／熱能',
    keywords: ['鍋爐', '蒸汽', '熱媒', '燒油', '重油', '加熱爐'],
    directions: ['鍋爐燃料轉換（燃油改天然氣）', '廢熱回收', '蒸汽管路保溫'],
  },
  pump_fan: {
    label: '泵浦／風機',
    keywords: ['泵浦', '幫浦', '水泵', '抽水', '風機', '排風', '抽風'],
    directions: ['泵浦與風機變頻控制', '更換高效率泵浦'],
  },
  heat_pump: {
    label: '熱泵',
    keywords: ['熱泵', '熱水', '電熱', '加熱'],
    directions: ['以熱泵取代電熱或燃油加熱'],
  },
  solar_pv: {
    label: '太陽能',
    keywords: ['太陽能', '光電', '屋頂', '綠電'],
    directions: ['屋頂太陽光電', '自發自用或躉售評估'],
  },
  ems: {
    label: '能源管理系統',
    keywords: ['能源管理', 'EMS', '電表', '監控', '用電監測', '契約容量'],
    directions: ['建置能源管理系統（EMS）', '契約容量最佳化', '分區電表監測'],
  },
}

export const SPECIALTY_LABEL: Record<Specialty, string> = {
  ...Object.fromEntries(EQUIPS.map((e) => [e, EQUIP_INFO[e].label])),
  carbon_consulting: '碳盤查輔導',
} as Record<Specialty, string>

/**
 * What a vendor can offer and a need can ask for: equipment only. The platform has no consulting firms;
 * factories do their own carbon inventory on the carbon page. 'carbon_consulting' stays in the type and
 * its label only so data saved before this change still renders.
 */
export const SPECIALTIES: readonly Specialty[] = [...EQUIPS]

/** Equipment pairs that share know-how; used for the 0.5 「相關經驗」 match. */
export const RELATED_EQUIP: Partial<Record<Equip, Equip[]>> = {
  hvac: ['chiller', 'heat_pump'],
  chiller: ['hvac', 'pump_fan'],
  motor_vfd: ['pump_fan', 'air_compressor'],
  pump_fan: ['motor_vfd', 'chiller'],
  air_compressor: ['motor_vfd'],
  heat_pump: ['hvac', 'boiler'],
  boiler: ['heat_pump'],
}

export const SCALE_LABEL: Record<ScaleTier, string> = {
  S: '小型（50 人以下）',
  M: '中型（50–199 人）',
  L: '大型（200 人以上）',
}
export const SCALE_SHORT: Record<ScaleTier, string> = { S: '小型', M: '中型', L: '大型' }

export function scaleFromEmployees(employees: number): ScaleTier {
  if (employees < 50) return 'S'
  if (employees < 200) return 'M'
  return 'L'
}

export const PRESSURE_LABEL: Record<Pressure, string> = {
  customer: '客戶要求提供碳排數據',
  regulation: '準備未來的政府法規',
  cost: '想找出節省成本的機會',
  expansion: '擴廠或設備汰換計畫',
}

export const INDUSTRIES = [
  '金屬加工',
  '塑膠射出',
  '食品加工',
  '紡織染整',
  '電子零組件',
  '機械設備',
  '化工',
  '印刷包裝',
  '汽機車零件',
  '其他製造業',
] as const
