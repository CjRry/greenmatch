/**
 * Real, publicly listed ESCO & energy-efficiency equipment vendors curated manually from
 * official government / association registries (PROP-0007 4c).
 *
 * Guardrails:
 * - Never stored in DataStore and never mixed with `isDemo` vendors.
 * - Never display fabricated star ratings or review counts.
 * - Strictly public company websites and company switchboards ONLY — zero personal names/phones.
 */
import type { PublicVendor } from '../core/types'

export const PUBLIC_VENDORS_CHECKED_DATE = '2026-11-15'

export const PUBLIC_VENDOR_DISCLAIMER = '依公開資料整理，非平台合作廠商、未經對方確認'

export const PUBLIC_VENDOR_NO_CONTACT_NOTE = '平台不會代你聯絡，請依公開資訊自行洽詢'

export const PUBLIC_VENDORS: readonly PublicVendor[] = [
  {
    id: 'pv01',
    name: '復盛股份有限公司（FUSHENG）',
    shortDesc: '台灣空壓機製造與節能服務大廠，多款迴轉式／永磁變頻空壓機登錄動力設備補助系統，並為 ESCO 公會會員。',
    city: '新北市',
    serviceRegions: '北區（新北／桃園）、中區（台中 04-2359-5617）、南區（高雄）設有營業服務網',
    specialties: ['air_compressor', 'motor_vfd', 'ems'],
    registryTags: ['ESCO 公會／登錄名錄', '動力與公用設備補助登錄廠商'],
    publicWebsite: 'https://tw.fusheng.com',
    publicPhone: '02-2995-1411',
    branchNote: '台中營業所：04-2359-5617',
    source: {
      publisher: 'ESCO 公會會員名錄／能源署動力與公用設備補助產品系統',
      url: 'https://www.mdss.org.tw',
      checkedDate: PUBLIC_VENDORS_CHECKED_DATE,
    },
  },
  {
    id: 'pv02',
    name: '東正鐵工廠股份有限公司（SWAN 天鵝牌）',
    shortDesc: '台中在地空壓機製造商，SWAN 系列定速與變頻螺旋式／活塞式空壓機登錄於能源署動力設備補助系統。',
    city: '台中市',
    serviceRegions: '中區總公司（台中）及南區營業所（台南永康 06-253-9848）服務全台工廠',
    specialties: ['air_compressor', 'motor_vfd'],
    registryTags: ['動力與公用設備補助登錄廠商', '空壓機製造／服務商'],
    publicWebsite: 'https://www.swan-aircompressor.com/tw/',
    publicPhone: '04-2261-2135',
    branchNote: '台南營業所：06-253-9848',
    source: {
      publisher: '經濟部能源署動力與公用設備補助產品系統（mdss.org.tw）',
      url: 'https://www.mdss.org.tw',
      checkedDate: PUBLIC_VENDORS_CHECKED_DATE,
    },
  },
  {
    id: 'pv03',
    name: '漢鐘精機股份有限公司（HANBELL）',
    shortDesc: '精密壓縮機製造廠，螺桿式／迴轉式空壓機與壓縮機組登錄於動力與公用設備能效系統，並於桃園與台中設廠。',
    city: '桃園市',
    serviceRegions: '桃園觀音總廠、台中精科廠（04-2350-1886）及台南南科服務據點',
    specialties: ['air_compressor', 'chiller', 'motor_vfd'],
    registryTags: ['動力與公用設備補助登錄廠商', '空壓機製造／服務商'],
    publicWebsite: 'https://www.hanbell.com',
    publicPhone: '03-483-6215',
    branchNote: '台中廠：04-2350-1886',
    source: {
      publisher: '經濟部能源署動力與公用設備補助產品系統（mdss.org.tw）',
      url: 'https://www.mdss.org.tw',
      checkedDate: PUBLIC_VENDORS_CHECKED_DATE,
    },
  },
  {
    id: 'pv04',
    name: '東亞機械工業股份有限公司（JAGUAR 捷豹空壓機）',
    shortDesc: '永磁變頻與二級壓縮空壓機品牌，多款符合一級能效機種完成能源署動力設備補助產品系統登錄。',
    city: '新北市',
    serviceRegions: '新北台灣總部搭配桃園、台中、彰化、台南各地經銷商與服務據點',
    specialties: ['air_compressor', 'motor_vfd'],
    registryTags: ['動力與公用設備補助登錄廠商', '空壓機製造／服務商'],
    publicWebsite: 'https://www.jaguar-compressor.com.tw',
    publicPhone: '02-8970-7555',
    branchNote: '全台服務專線：0800-080-580',
    source: {
      publisher: '經濟部能源署動力與公用設備補助產品系統（mdss.org.tw）',
      url: 'https://www.mdss.org.tw',
      checkedDate: PUBLIC_VENDORS_CHECKED_DATE,
    },
  },
  {
    id: 'pv05',
    name: '東元電機股份有限公司（TECO）',
    shortDesc: 'IE3／IE4 高效率馬達、變頻器與廠務節能工程廠商，名列 ESCO 公會名錄並有馬達產品登錄補助系統。',
    city: '台北市',
    serviceRegions: '台北總公司、桃園觀音廠（03-483-2258）、台中（04-2317-3915）及台南聯絡處（06-269-7799）',
    specialties: ['motor_vfd', 'pump_fan', 'hvac', 'ems'],
    registryTags: ['ESCO 公會／登錄名錄', '動力與公用設備補助登錄廠商'],
    publicWebsite: 'https://www.teco.com.tw',
    publicPhone: '02-6615-9111',
    branchNote: '台中：04-2317-3915｜台南：06-269-7799',
    source: {
      publisher: 'ESCO 公會會員名錄（esco.org.tw）／動力補助系統',
      url: 'https://www.esco.org.tw',
      checkedDate: PUBLIC_VENDORS_CHECKED_DATE,
    },
  },
  {
    id: 'pv06',
    name: '台達能源股份有限公司（Delta Energy）',
    shortDesc: 'ESCO 公會會員，提供廠務空壓系統控制、高效空調冰水機、馬達變頻與能源管理（EMS）節能診斷整合方案。',
    city: '台北市',
    serviceRegions: '台北總部與全台工業區節能診斷及 ESCO 績效專案服務',
    specialties: ['ems', 'air_compressor', 'chiller', 'hvac', 'motor_vfd'],
    registryTags: ['ESCO 公會／登錄名錄'],
    publicWebsite: 'https://www.deltaww-energy.com',
    publicPhone: '02-8797-2088',
    source: {
      publisher: '中華民國能源技術服務商業同業公會（esco.org.tw）',
      url: 'https://www.esco.org.tw',
      checkedDate: PUBLIC_VENDORS_CHECKED_DATE,
    },
  },
]
