import type { City } from '../core/constants/geo'
import type { ScaleTier, Specialty } from '../core/types'

/**
 * Extra installation history for the demo vendors (v01–v11), shown on each vendor's
 * collection page next to the portfolio items in the store. Fictional demonstration data:
 * every card that shows one carries a 「示範」 badge. Never used for vendors a person registered.
 *
 * Each record is the same 8-stage process with small differences (subsidy application,
 * a second site survey, night work, how savings were verified), which is what makes two
 * installs of the same vendor look different.
 */
export interface InstallSeed {
  title: string
  industry: string
  city: City
  equip: Specialty
  year: number
  /** 1–12; derived from the title when missing. */
  month?: number
  savingPct: number | null
  scale?: ScaleTier
  /** The vendor helped apply for a government subsidy before signing. */
  subsidy?: boolean
  /** 2 = a second site survey was needed. */
  surveyVisits?: 1 | 2
  /** Days the line was stopped for the work; 0 with nightWork = no stoppage. */
  downtimeDays?: number
  /** Work done at night or on weekends so production kept running. */
  nightWork?: boolean
  /** How the result was checked: metered before/after, or compared on electricity bills. */
  verify?: 'metered' | 'bill'
  /** One sentence on what was special about this install. */
  note?: string
}

export const EXTRA_INSTALLS: Record<string, InstallSeed[]> = {
  v01: [
    { title: '扣件廠 3 台空壓機改變頻', industry: '金屬加工', city: '台南市', equip: 'air_compressor', year: 2026, month: 3, savingPct: 27, scale: 'M', subsidy: true, downtimeDays: 1, verify: 'metered', note: '先修管路洩漏再換機，壓力從 7.5 bar 降到 6.8 bar。' },
    { title: '彩印廠空壓與乾燥機整合', industry: '印刷包裝', city: '高雄市', equip: 'air_compressor', year: 2025, month: 9, savingPct: 21, scale: 'S', surveyVisits: 2, downtimeDays: 2, verify: 'bill', note: '第一次場勘遇到停機，第二次補量乾燥機耗電。' },
    { title: '烘焙廠攪拌機馬達變頻', industry: '食品加工', city: '嘉義市', equip: 'motor_vfd', year: 2025, month: 6, savingPct: 15, scale: 'S', nightWork: true, verify: 'metered' },
    { title: '機械廠分區電表與契約容量調整', industry: '機械設備', city: '屏東縣', equip: 'ems', year: 2025, month: 11, savingPct: 6, scale: 'M', subsidy: true, nightWork: true, verify: 'bill', note: '用分區電表找出夜間待機負載，契約容量下修 40 kW。' },
    { title: '鍛造廠空壓機台數控制', industry: '金屬加工', city: '高雄市', equip: 'air_compressor', year: 2024, month: 8, savingPct: 19, scale: 'M', downtimeDays: 0, nightWork: true, verify: 'metered' },
    { title: '紙箱廠抽風機變頻', industry: '印刷包裝', city: '台南市', equip: 'motor_vfd', year: 2024, month: 4, savingPct: 23, scale: 'S', subsidy: true, downtimeDays: 1, verify: 'bill' },
  ],
  v02: [
    { title: '電子廠冰水主機汰換 300RT', industry: '電子零組件', city: '高雄市', equip: 'chiller', year: 2026, month: 2, savingPct: 34, scale: 'L', subsidy: true, surveyVisits: 2, downtimeDays: 3, verify: 'metered', note: '利用年節停線吊裝，複勘時補量冷卻水塔。' },
    { title: '化工廠冷卻水泵變頻', industry: '化工', city: '屏東縣', equip: 'pump_fan', year: 2025, month: 10, savingPct: 22, scale: 'M', nightWork: true, verify: 'metered' },
    { title: '食品廠熱泵取代電熱水', industry: '食品加工', city: '台南市', equip: 'heat_pump', year: 2025, month: 5, savingPct: 58, scale: 'M', subsidy: true, downtimeDays: 1, verify: 'bill' },
    { title: '冷藏倉儲空調群控', industry: '食品加工', city: '嘉義縣', equip: 'hvac', year: 2024, month: 7, savingPct: 14, scale: 'M', nightWork: true, verify: 'bill' },
    { title: '電子組裝廠空調汰換', industry: '電子零組件', city: '台南市', equip: 'hvac', year: 2024, month: 3, savingPct: 20, scale: 'L', subsidy: true, downtimeDays: 0, nightWork: true, verify: 'metered' },
  ],
  v03: [
    { title: '射出廠廠房 LED 與感應控制', industry: '塑膠射出', city: '彰化縣', equip: 'lighting', year: 2026, month: 1, savingPct: 61, scale: 'S', nightWork: true, verify: 'bill', note: '加裝人體感應，倉儲區夜間只留 20% 照明。' },
    { title: '五金廠倉庫高天井燈', industry: '金屬加工', city: '台中市', equip: 'lighting', year: 2025, month: 8, savingPct: 52, scale: 'S', nightWork: true, verify: 'bill' },
    { title: '機械廠照明迴路監測', industry: '機械設備', city: '南投縣', equip: 'ems', year: 2025, month: 4, savingPct: 8, scale: 'M', nightWork: true, verify: 'metered' },
    { title: '模具廠辦公區與廠區 LED', industry: '機械設備', city: '苗栗縣', equip: 'lighting', year: 2024, month: 10, savingPct: 48, scale: 'S', surveyVisits: 2, nightWork: true, verify: 'bill', note: '廠區挑高 12 米，複勘確認吊車軌道位置。' },
  ],
  v04: [
    { title: '染整廠空壓系統壓力最佳化', industry: '紡織染整', city: '彰化縣', equip: 'air_compressor', year: 2026, month: 2, savingPct: 18, scale: 'M', subsidy: true, downtimeDays: 0, nightWork: true, verify: 'metered' },
    { title: '射出廠空壓機汰換 2 台', industry: '塑膠射出', city: '台中市', equip: 'air_compressor', year: 2025, month: 7, savingPct: 25, scale: 'S', subsidy: true, downtimeDays: 2, verify: 'metered' },
    { title: '電子廠冷卻泵浦變頻', industry: '電子零組件', city: '苗栗縣', equip: 'pump_fan', year: 2025, month: 3, savingPct: 19, scale: 'M', nightWork: true, verify: 'bill' },
    { title: '紡紗廠空壓洩漏檢測', industry: '紡織染整', city: '雲林縣', equip: 'air_compressor', year: 2024, month: 11, savingPct: 9, scale: 'M', surveyVisits: 2, nightWork: true, verify: 'metered', note: '超音波巡檢找到 46 處洩漏點，只修不換機。' },
    { title: '塑膠廠研磨機馬達變頻', industry: '塑膠射出', city: '南投縣', equip: 'motor_vfd', year: 2024, month: 6, savingPct: 14, scale: 'S', downtimeDays: 1, verify: 'bill' },
  ],
  v05: [
    { title: '汽車零件廠碳盤查與減碳路徑', industry: '汽機車零件', city: '台南市', equip: 'carbon_consulting', year: 2026, month: 3, savingPct: null, scale: 'M', subsidy: true, verify: 'metered', note: '客戶要求供應鏈揭露，盤查後接續規劃空壓改善。' },
    { title: '螺絲廠第一次組織型盤查', industry: '金屬加工', city: '高雄市', equip: 'carbon_consulting', year: 2025, month: 9, savingPct: null, scale: 'S', surveyVisits: 2, verify: 'bill' },
    { title: '食品廠分區電表建置', industry: '食品加工', city: '嘉義縣', equip: 'ems', year: 2025, month: 6, savingPct: 5, scale: 'S', nightWork: true, verify: 'bill' },
    { title: '機車零件廠產品碳足跡', industry: '汽機車零件', city: '屏東縣', equip: 'carbon_consulting', year: 2024, month: 12, savingPct: null, scale: 'M', subsidy: true, verify: 'metered' },
  ],
  v06: [
    { title: '金屬加工廠屋頂 299kWp', industry: '金屬加工', city: '高雄市', equip: 'solar_pv', year: 2026, month: 1, savingPct: null, scale: 'M', surveyVisits: 2, nightWork: true, verify: 'metered', note: '屋頂浪板老舊，複勘後先補強再上支架。' },
    { title: '電子廠自發自用 150kWp', industry: '電子零組件', city: '台南市', equip: 'solar_pv', year: 2025, month: 8, savingPct: 12, scale: 'M', nightWork: true, verify: 'metered' },
    { title: '機械廠屋頂 499kWp 躉售', industry: '機械設備', city: '台中市', equip: 'solar_pv', year: 2024, month: 9, savingPct: null, scale: 'L', nightWork: true, verify: 'bill' },
    { title: '五金廠發電監控平台', industry: '金屬加工', city: '屏東縣', equip: 'ems', year: 2024, month: 5, savingPct: null, scale: 'S', nightWork: true, verify: 'metered' },
  ],
  v07: [
    { title: '面板零件廠冰水主機 ESPC', industry: '電子零組件', city: '新竹市', equip: 'chiller', year: 2026, month: 2, savingPct: 29, scale: 'L', subsidy: true, surveyVisits: 2, downtimeDays: 2, verify: 'metered', note: '節能績效保證合約，5 年內未達 25% 由廠商補差額。' },
    { title: '射出廠空調群控', industry: '塑膠射出', city: '桃園市', equip: 'hvac', year: 2025, month: 7, savingPct: 16, scale: 'M', nightWork: true, verify: 'metered' },
    { title: '汽車零件廠冷卻水塔變頻', industry: '汽機車零件', city: '新北市', equip: 'motor_vfd', year: 2025, month: 4, savingPct: 21, scale: 'M', subsidy: true, nightWork: true, verify: 'bill' },
    { title: '電子廠全廠能源管理系統', industry: '電子零組件', city: '台中市', equip: 'ems', year: 2024, month: 10, savingPct: 11, scale: 'L', nightWork: true, verify: 'metered' },
    { title: '半導體設備廠冰水群控', industry: '電子零組件', city: '新竹縣', equip: 'chiller', year: 2024, month: 3, savingPct: 23, scale: 'L', subsidy: true, downtimeDays: 1, verify: 'metered' },
  ],
  v08: [
    { title: '食品廠蒸汽管路保溫與疏水器', industry: '食品加工', city: '雲林縣', equip: 'boiler', year: 2026, month: 1, savingPct: 17, scale: 'M', nightWork: true, verify: 'bill' },
    { title: '化工廠鍋爐廢熱回收', industry: '化工', city: '高雄市', equip: 'boiler', year: 2025, month: 6, savingPct: 22, scale: 'M', subsidy: true, surveyVisits: 2, downtimeDays: 4, verify: 'metered', note: '煙道加裝節熱器，複勘時確認排氣溫度。' },
    { title: '染整廠熱泵預熱水', industry: '紡織染整', city: '彰化縣', equip: 'heat_pump', year: 2025, month: 2, savingPct: 36, scale: 'M', subsidy: true, downtimeDays: 1, verify: 'metered' },
    { title: '豆製品廠鍋爐改天然氣', industry: '食品加工', city: '台中市', equip: 'boiler', year: 2024, month: 9, savingPct: 31, scale: 'S', downtimeDays: 3, verify: 'bill' },
  ],
  v09: [
    { title: '電子廠分區電表與異常告警', industry: '電子零組件', city: '新竹市', equip: 'ems', year: 2026, month: 3, savingPct: 7, scale: 'M', nightWork: true, verify: 'metered' },
    { title: '汽車零件廠空壓馬達變頻', industry: '汽機車零件', city: '桃園市', equip: 'motor_vfd', year: 2025, month: 10, savingPct: 17, scale: 'M', subsidy: true, downtimeDays: 1, verify: 'metered' },
    { title: '五金廠碳盤查加用電監測', industry: '金屬加工', city: '苗栗縣', equip: 'carbon_consulting', year: 2025, month: 5, savingPct: null, scale: 'S', verify: 'bill' },
    { title: '精密加工廠契約容量最佳化', industry: '金屬加工', city: '台中市', equip: 'ems', year: 2024, month: 7, savingPct: 4, scale: 'S', surveyVisits: 2, nightWork: true, verify: 'bill', note: '原本每年超約 4 次，調整後一年零超約。' },
  ],
  v10: [
    { title: '塑膠射出廠第一次碳盤查', industry: '塑膠射出', city: '彰化縣', equip: 'carbon_consulting', year: 2026, month: 2, savingPct: null, scale: 'S', verify: 'bill' },
    { title: '五金廠線上輔導碳盤查', industry: '金屬加工', city: '台南市', equip: 'carbon_consulting', year: 2025, month: 10, savingPct: null, scale: 'S', surveyVisits: 2, verify: 'bill', note: '全程線上，只到廠一次確認柴油堆高機與冷媒。' },
    { title: '機械廠盤查與第三方查證', industry: '機械設備', city: '桃園市', equip: 'carbon_consulting', year: 2025, month: 4, savingPct: null, scale: 'S', subsidy: true, verify: 'metered' },
    { title: '金屬表面處理廠碳盤查', industry: '金屬加工', city: '雲林縣', equip: 'carbon_consulting', year: 2024, month: 11, savingPct: null, scale: 'S', verify: 'bill' },
  ],
  v11: [
    { title: '射出廠冷氣汰換 8 台', industry: '塑膠射出', city: '台南市', equip: 'hvac', year: 2026, month: 3, savingPct: 26, scale: 'S', nightWork: true, verify: 'bill' },
    { title: '食品廠廠房 LED 汰換', industry: '食品加工', city: '高雄市', equip: 'lighting', year: 2025, month: 9, savingPct: 50, scale: 'S', nightWork: true, verify: 'bill' },
    { title: '鐵工廠馬達更換 IE3', industry: '金屬加工', city: '台南市', equip: 'motor_vfd', year: 2025, month: 5, savingPct: 9, scale: 'S', downtimeDays: 1, verify: 'bill' },
    { title: '五金廠空壓管路重拉', industry: '金屬加工', city: '高雄市', equip: 'air_compressor', year: 2024, month: 8, savingPct: 13, scale: 'S', surveyVisits: 2, downtimeDays: 2, verify: 'bill', note: '舊管路多處鏽蝕，改走環狀管路降低壓損。' },
  ],
}
