/**
 * 公開案例: real energy-saving projects published by 經濟部能源署 on its 節能標竿網 (114 年度節能標竿獎
 * 標竿案例). These companies did not use GreenMatch; the platform only quotes their published numbers.
 *
 * Rules (PROP-0006):
 * - Every number below was read off the source page by the CEO on `checkedDate`. Nothing is estimated.
 * - `null` = the source does not state it; the UI shows 「來源未揭露」.
 * - The source pages do not name the company, only a case number; we keep it that way.
 * - Units on the source: 節省電力 in 千度, 節省費用 in 仟元/年, 投資金額 in 仟元. Converted to kWh / NTD here.
 *   Where the page body states a more exact kWh figure than the rounded 千度 headline, the exact one is used
 *   and `section` says so.
 * - Titles and equipment notes are our own short wording, not copied report text.
 */
import type { PublicCase } from '../core/types'

export const PUBLIC_CASES_CHECKED_DATE = '2026-11-14'

const SOURCE_BASE = {
  publisher: '經濟部能源署 節能標竿網',
  collection: '114 年度節能標竿獎・標竿案例',
  checkedDate: PUBLIC_CASES_CHECKED_DATE,
} as const

const detail = (id: string) => `https://top.energypark.org.tw/topfirm/Case/Detail/${id}`

/** Where the four headline numbers sit on every source page. */
const HEADLINE = '頁首數據欄（節省電力、節省費用、投資金額、回收年限）'

export const PUBLIC_CASES: readonly PublicCase[] = [
  {
    id: 'pc01',
    title: '辦公室 T8 燈管汰換 LED',
    industry: '電子零組件製造業',
    equip: 'lighting',
    equipmentNote: 'T8 傳統燈管 1,200 支換成 LED 燈具（7–11 樓辦公室）',
    beforeKwhPerYear: 91_200,
    afterKwhPerYear: 28_800,
    savedKwhPerYear: 62_400,
    savedNtdPerYear: 250_000,
    investmentNtd: 950_000,
    subsidyNtd: null,
    reportedPaybackYears: 3.8,
    source: {
      ...SOURCE_BASE,
      caseNo: '114-D04-111-LS01',
      url: detail('8C7023D5-0534-492A-9CFB-24DEC4D7FA87'),
      section: `${HEADLINE}；「成效說明」的改善前、改善後年耗電量（節電量取兩者之差 62,400 度，頁首顯示 62 千度）`,
    },
  },
  {
    id: 'pc02',
    title: '廠區螢光燈具汰換 LED',
    industry: '其他運輸工具及其零件製造業',
    equip: 'lighting',
    equipmentNote: '螢光燈座 780 盞（每盞 2 支 40 W 燈管）換成 20 W LED 燈管',
    beforeKwhPerYear: null,
    afterKwhPerYear: null,
    savedKwhPerYear: 107_000,
    savedNtdPerYear: 418_000,
    investmentNtd: 468_000,
    subsidyNtd: null,
    reportedPaybackYears: 1.1,
    source: { ...SOURCE_BASE, caseNo: '114-B03-112-LS02', url: detail('D0AF0A98-C338-4FB1-80CD-913B046BA551'), section: `${HEADLINE}；「案例說明」的燈管瓦數與盞數` },
  },
  {
    id: 'pc03',
    title: '空壓機汰換一級能效永磁變頻機',
    industry: '其他運輸工具及其零件製造業',
    equip: 'air_compressor',
    equipmentNote: '無修復價值的舊空壓機換成一級能源效率永磁馬達變頻空壓機',
    beforeKwhPerYear: null,
    afterKwhPerYear: null,
    savedKwhPerYear: 168_000,
    savedNtdPerYear: 656_000,
    investmentNtd: 2_350_000,
    subsidyNtd: null,
    reportedPaybackYears: 3.6,
    source: { ...SOURCE_BASE, caseNo: '114-B03-112-UT02', url: detail('35453CBB-42D5-4596-8B8E-8ECD02886A44'), section: HEADLINE },
    note: '來源提到配合政府節能補助計畫，但沒有寫補助金額。',
  },
  {
    id: 'pc04',
    title: '空壓機馬達改永磁變頻（2 台 50 hp）',
    industry: '其他運輸工具及其零件製造業',
    equip: 'air_compressor',
    equipmentNote: '螺旋式空壓機 2 台 50 hp，IE2 定速馬達換成 IE4 永磁變頻馬達',
    beforeKwhPerYear: null,
    afterKwhPerYear: null,
    savedKwhPerYear: 47_000,
    savedNtdPerYear: 193_000,
    investmentNtd: 292_000,
    subsidyNtd: null,
    reportedPaybackYears: 1.5,
    source: { ...SOURCE_BASE, caseNo: '114-B03-113-UT01', url: detail('D1967238-83BD-4F1F-9591-D42E32C0DA10'), section: `${HEADLINE}；「案例說明」的馬達等級` },
  },
  {
    id: 'pc05',
    title: '40RT 冰水主機汰換',
    industry: '其他運輸工具及其零件製造業',
    equip: 'chiller',
    equipmentNote: '使用 36 年的往復式 40RT 冰水機（1.68 kW/RT）換成螺旋式變頻機（0.766 kW/RT）',
    beforeKwhPerYear: 83_328,
    afterKwhPerYear: 37_993,
    savedKwhPerYear: 45_334,
    savedNtdPerYear: 182_000,
    investmentNtd: 750_000,
    subsidyNtd: null,
    reportedPaybackYears: 4.1,
    source: {
      ...SOURCE_BASE,
      caseNo: '114-B01-113-AC02',
      url: detail('0D85EA46-E60E-4C95-B04C-CCAFAF40E360'),
      section: `${HEADLINE}；「設計理念或改善流程」第 1–3 點的更新前、更新後年用電與年節電量 45.334 千度（前後值來源已取整，相減差 1 度）`,
    },
    note: '來源註明有綠基會性能檢測與實測用電曲線。',
  },
  {
    id: 'pc06',
    title: '90RT 冰水主機汰換（節能績效保證）',
    industry: '其他運輸工具及其零件製造業',
    equip: 'chiller',
    equipmentNote: '使用近 30 年的 90RT 冰水機（1.207 kW/RT）換成 0.635 kW/RT 新機',
    beforeKwhPerYear: 293_301,
    afterKwhPerYear: 154_305,
    savedKwhPerYear: 138_996,
    savedNtdPerYear: 557_000,
    investmentNtd: 2_300_000,
    subsidyNtd: null,
    reportedPaybackYears: 4.1,
    source: {
      ...SOURCE_BASE,
      caseNo: '114-B01-113-AC01',
      url: detail('741CEA69-2D7E-4F03-A128-EF930BDC2C70'),
      section: `${HEADLINE}；「設計理念或改善流程」第 1–3 點的更新前、更新後年用電與年節電量`,
    },
    note: '來源註明屬節能績效保證計畫，改善前後各掛表量測 1 個月；補助金額未揭露。',
  },
  {
    id: 'pc07',
    title: '箱型冷氣 16 台汰換',
    industry: '其他運輸工具及其零件製造業',
    equip: 'hvac',
    equipmentNote: '使用 20–30 年的箱型冷氣：10RT 13 台、15RT 1 台、5RT 2 台',
    beforeKwhPerYear: null,
    afterKwhPerYear: null,
    savedKwhPerYear: 180_512,
    savedNtdPerYear: 723_000,
    investmentNtd: 2_651_000,
    subsidyNtd: null,
    reportedPaybackYears: 3.7,
    source: {
      ...SOURCE_BASE,
      caseNo: '114-B01-113-AC05',
      url: detail('A029C03C-AAF5-426C-9095-15218FF6E839'),
      section: `${HEADLINE}；「設計理念或改善流程」逐台電流差計算表的合計 180.512 千度`,
    },
  },
  {
    id: 'pc08',
    title: '排氣風車馬達換 IE3 加變頻（50 hp）',
    industry: '其他運輸工具及其零件製造業',
    equip: 'motor_vfd',
    equipmentNote: '50 hp 排氣風車 IE2 馬達換成 IE3 並加變頻器，運轉功率 37.5 kW 降到 28.7 kW',
    beforeKwhPerYear: null,
    afterKwhPerYear: null,
    savedKwhPerYear: 51_000,
    savedNtdPerYear: 197_000,
    investmentNtd: 965_000,
    subsidyNtd: null,
    reportedPaybackYears: 4.9,
    source: { ...SOURCE_BASE, caseNo: '114-B03-112-PE04', url: detail('0E6EB7A3-243C-4D8E-9DB2-5F6181FDD2CB'), section: `${HEADLINE}；「設計理念或改善流程」第 1–2 點的運轉功率` },
  },
  {
    id: 'pc09',
    title: '廢水廠 60 HP 鼓風機加裝變頻',
    industry: '食品及飼品製造業',
    equip: 'pump_fan',
    equipmentNote: '全年 24 小時運轉的 60 HP 鼓風機加變頻，60 Hz 降到 40 Hz，41.94 kW 降到 24.51 kW',
    beforeKwhPerYear: null,
    afterKwhPerYear: null,
    savedKwhPerYear: 152_686,
    savedNtdPerYear: 519_000,
    investmentNtd: 130_000,
    subsidyNtd: null,
    reportedPaybackYears: 0.3,
    source: {
      ...SOURCE_BASE,
      caseNo: '114-B02-113-UT01',
      url: detail('5105C637-0E39-4D23-8E7C-CEDB6ECF305B'),
      section: `${HEADLINE}；「案例說明」的年度節能量 152,686 kWh（頁首顯示 153 千度）`,
    },
  },
  {
    id: 'pc10',
    title: '軟水供水馬達 75 hp 換 IE3 60 hp',
    industry: '食品及飼品製造業',
    equip: 'pump_fan',
    equipmentNote: '水處理軟水供水馬達 75 hp 換成高效率 IE3 60 hp',
    beforeKwhPerYear: null,
    afterKwhPerYear: null,
    savedKwhPerYear: 97_000,
    savedNtdPerYear: 336_000,
    investmentNtd: 426_000,
    subsidyNtd: null,
    reportedPaybackYears: 1.3,
    source: { ...SOURCE_BASE, caseNo: '114-B04-113-UT02', url: detail('4076CB9D-6D2B-490F-A1CC-0ED190FE7C84'), section: `${HEADLINE}；「設計理念或改善流程」的改善前、改善後說明` },
  },
]
