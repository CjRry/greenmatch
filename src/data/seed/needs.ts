/** Demo needs in the factories' own words, with the confirmed standard form. */
import type { Need, NeedForm, ScaleTier, Source } from '../../core/types'
import type { City } from '../../core/constants/geo'
import { at } from './util'

interface NeedSeed {
  id: string
  factoryId: string
  city: City
  scale: ScaleTier
  title: string
  rawText: string
  form: NeedForm
  createdAt: string
  source?: Source
  budgetNtd?: number | null
  timeline?: string | null
  interestedVendorIds?: string[]
}

function need(n: NeedSeed): Omit<Need, 'status' | 'caseId'> {
  const t = at(n.createdAt)
  return {
    id: n.id,
    factoryId: n.factoryId,
    title: n.title,
    rawText: n.rawText,
    form: n.form,
    source: n.source ?? 'claude',
    city: n.city,
    scale: n.scale,
    budgetNtd: n.budgetNtd ?? null,
    timeline: n.timeline ?? null,
    interestedVendorIds: n.interestedVendorIds ?? [],
    confirmedAt: t,
    createdAt: t,
    updatedAt: t,
    isDemo: true,
  }
}

export const needSeeds = [
  need({
    id: 'n01',
    factoryId: 'f01',
    city: '台南市',
    scale: 'M',
    title: '空壓機 3 台汰換與空調節能',
    rawText: '我們工廠空壓機有 3 台，都用了十幾年，最近電費越來越高，夏天冷氣也很耗電',
    form: {
      items: [
        { equip: 'air_compressor', quantity: 3, ratedKw: 37, ageYears: 10, ageText: '10 年以上' },
        { equip: 'hvac', quantity: null, ageYears: null, ageText: null },
      ],
      mainProblems: ['電費上升', '夏季空調耗電'],
      directions: ['空壓機汰換', '空調效率改善'],
      openQuestions: [],
    },
    createdAt: '2026-11-01 10:20',
    budgetNtd: 2500000,
    timeline: '年底前完成',
  }),
  need({
    id: 'n02',
    factoryId: 'f02',
    city: '台南市',
    scale: 'S',
    title: '射出機馬達變頻與冰水機汰換評估',
    rawText: '射出機都是十幾年前的油壓機，馬達一直在空轉，冰水機兩台夏天常常跳機，想知道換變頻划不划算',
    form: {
      items: [
        { equip: 'motor_vfd', quantity: 14, ratedKw: 15, ageYears: 15, ageText: '十幾年' },
        { equip: 'chiller', quantity: 2, ratedKw: 45, ageYears: 13, ageText: '2013 年' },
      ],
      mainProblems: ['射出機馬達空轉耗電', '冰水機夏季跳機'],
      directions: ['射出機加裝變頻器', '冰水主機汰換'],
      openQuestions: ['射出機的噸數與每日運轉時數？'],
    },
    createdAt: '2026-11-08 14:05',
    timeline: '想先知道回本時間再決定',
  }),
  need({
    id: 'n03',
    factoryId: 'f03',
    city: '高雄市',
    scale: 'M',
    title: '冷凍庫冰水主機汰換與鍋爐廢熱回收',
    rawText: '冷凍庫的冰水主機是 2009 年的，蒸煮線鍋爐燒重油，客戶一直在問我們的碳排，想先從最耗電的地方改',
    form: {
      items: [
        { equip: 'chiller', quantity: 3, ageYears: 17, ageText: '2009 年' },
        { equip: 'boiler', quantity: 1, ageYears: 18, ageText: '燒重油' },
      ],
      mainProblems: ['冰水主機老舊耗電', '客戶要求碳排資料'],
      directions: ['冰水主機汰換', '鍋爐廢熱回收'],
      openQuestions: [],
    },
    createdAt: '2026-07-01 09:40',
    budgetNtd: 4000000,
  }),
  need({
    id: 'n04',
    factoryId: 'f04',
    city: '彰化縣',
    scale: 'M',
    title: '染整熱水廢熱回收與鍋爐燃料轉換',
    rawText: '染整機排出來的熱水還有 60 度就直接排掉很可惜，鍋爐兩台也想評估改燒天然氣',
    form: {
      items: [
        { equip: 'boiler', quantity: 2, ageYears: 16, ageText: '2010 年' },
        { equip: 'pump_fan', quantity: 18, ratedKw: 15, ageYears: 14, ageText: null },
      ],
      mainProblems: ['廢熱水直接排放', '燃油成本與排放'],
      directions: ['廢熱回收', '鍋爐燃料轉換（燃油改天然氣）'],
      openQuestions: [],
    },
    createdAt: '2026-08-05 11:10',
  }),
  need({
    id: 'n05',
    factoryId: 'f05',
    city: '台中市',
    scale: 'M',
    title: '無塵室冰水系統群控',
    rawText: '無塵室空調 24 小時開，冰水主機兩台輪流跑，想做群控把用電降下來',
    form: {
      items: [
        { equip: 'chiller', quantity: 2, ageYears: 12, ageText: '2014 年' },
        { equip: 'hvac', quantity: 8, ageYears: 12, ageText: null },
      ],
      mainProblems: ['無塵室空調全天運轉'],
      directions: ['冰水系統群控', '溫度與排程控制'],
      openQuestions: [],
    },
    createdAt: '2026-06-02 15:30',
  }),
  need({
    id: 'n06',
    factoryId: 'f06',
    city: '台中市',
    scale: 'M',
    title: '廠房水銀燈全面汰換 LED',
    rawText: '廠房挑高 12 米還在用水銀燈，燈很暗又熱，想全部換成 LED',
    form: {
      items: [{ equip: 'lighting', quantity: 220, ageYears: 18, ageText: '2008 年' }],
      mainProblems: ['照度不足', '照明耗電與發熱'],
      directions: ['LED 照明汰換', '照明分區與感應控制'],
      openQuestions: [],
    },
    createdAt: '2026-03-10 10:00',
  }),
  need({
    id: 'n07',
    factoryId: 'f08',
    city: '桃園市',
    scale: 'M',
    title: '沖壓線馬達變頻與用電監測',
    rawText: '沖壓線 45 台馬達大多是定頻，客戶要我們每年減碳 4%，想裝變頻和用電監測',
    form: {
      items: [
        { equip: 'motor_vfd', quantity: 45, ageYears: 14, ageText: null },
        { equip: 'ems', quantity: null, ageYears: null, ageText: null },
      ],
      mainProblems: ['客戶要求每年減碳 4%', '馬達定頻運轉'],
      directions: ['加裝變頻器', '建置能源管理系統（EMS）'],
      openQuestions: [],
    },
    createdAt: '2026-04-08 09:15',
  }),
  need({
    id: 'n08',
    factoryId: 'f12',
    city: '新竹縣',
    scale: 'M',
    title: '屋頂太陽能自發自用與產線用電監測',
    rawText: '屋頂大約 3,000 平方公尺，想裝太陽能自發自用，也想知道每條產線各用多少電',
    form: {
      items: [
        { equip: 'solar_pv', quantity: 1, ratedKw: 300, ageYears: null, ageText: null, note: '屋頂約 3,000 平方公尺（約 300 kWp）' },
        { equip: 'ems', quantity: 1, ageYears: null, ageText: null },
      ],
      mainProblems: ['客戶要求使用綠電', '不清楚各產線用電'],
      directions: ['屋頂太陽光電', '分區電表監測'],
      openQuestions: ['屋頂結構與防水狀況？', '契約容量多少？'],
    },
    createdAt: '2026-11-11 10:40',
    interestedVendorIds: ['v06'],
  }),
  need({
    id: 'n09',
    factoryId: 'f07',
    city: '新北市',
    scale: 'S',
    title: '印刷機房冷氣與照明節能',
    rawText: '印刷機房冷氣 9 台，夏天電費一個月多 3 萬，燈也都是舊的日光燈',
    form: {
      items: [
        { equip: 'hvac', quantity: 9, ratedKw: 7.5, ageYears: 15, ageText: '2011 年' },
        { equip: 'lighting', quantity: 90, ageYears: 14, ageText: '舊日光燈' },
      ],
      mainProblems: ['夏季電費每月多約 3 萬元'],
      directions: ['老舊冷氣汰換為高效率機種', 'LED 照明汰換'],
      openQuestions: [],
    },
    createdAt: '2026-11-11 13:20',
  }),
  need({
    id: 'n10',
    factoryId: 'f10',
    city: '高雄市',
    scale: 'S',
    title: '老舊空壓機汰換',
    rawText: '只有一台空壓機，用了快 20 年，聲音很大，想換一台省電的',
    form: {
      items: [{ equip: 'air_compressor', quantity: 1, ageYears: 20, ageText: '快 20 年', note: '現況約 30–50 馬力（待現場確認銘牌）' }],
      mainProblems: ['空壓機老舊、噪音大'],
      directions: ['空壓機汰換為變頻機種'],
      openQuestions: ['空壓機馬力與每日使用時數？'],
    },
    createdAt: '2026-11-11 16:50',
    budgetNtd: 500000,
    interestedVendorIds: ['v11'],
  }),
  need({
    id: 'n11',
    factoryId: 'f11',
    city: '台南市',
    scale: 'S',
    title: '電熱水改熱泵',
    rawText: '洗烤盤的熱水用電熱水器燒，電費很可觀，聽說熱泵比較省',
    form: {
      items: [{ equip: 'heat_pump', quantity: 2, ratedKw: 15, ageYears: null, ageText: null, note: '取代電熱水器' }],
      mainProblems: ['電熱水耗電'],
      directions: ['以熱泵取代電熱或燃油加熱'],
      openQuestions: ['每日熱水用量與溫度？'],
    },
    createdAt: '2026-11-12 08:30',
  }),
  need({
    id: 'n13',
    factoryId: 'f09',
    city: '嘉義縣',
    scale: 'M',
    title: '燃油鍋爐改天然氣或熱泵評估',
    rawText: '反應槽加熱用燃油鍋爐，油價高又要開始申報排放，想評估換天然氣或熱泵',
    form: {
      items: [
        { equip: 'boiler', quantity: 1, ageYears: 19, ageText: '2007 年' },
        { equip: 'heat_pump', quantity: null, ageYears: null, ageText: null },
      ],
      mainProblems: ['燃油成本高', '排放申報'],
      directions: ['鍋爐燃料轉換（燃油改天然氣）', '以熱泵取代燃油加熱'],
      openQuestions: [],
    },
    createdAt: '2026-11-09 11:00',
  }),
  need({
    id: 'n14',
    factoryId: 'f06',
    city: '台中市',
    scale: 'M',
    title: 'CNC 產線空壓機 2 台汰換與管路抓漏',
    rawText: '廠內兩台 50 馬力（37 kW）定頻空壓機用了 13 年，CNC 加工線每天兩班制運轉 16 小時，管路常有漏氣聲，想換一級能效永磁變頻空壓機並順便申請能源署動力設備補助。',
    form: {
      items: [
        { equip: 'air_compressor', quantity: 2, ratedKw: 37, ageYears: 13, ageText: '13 年（約 50 馬力）', note: '每日兩班制運轉約 16 小時' },
        { equip: 'ems', quantity: 1, ageYears: null, ageText: null, note: '空壓機房比功率與壓力監測' },
      ],
      mainProblems: ['定頻空壓機空載耗電高', '管路接頭漏氣導致壓力不足'],
      directions: ['空壓機汰換為 IE4 永磁變頻機種', '全廠空壓管路超音波抓漏與修補'],
      openQuestions: ['現有空壓機房散熱通風條件與乾燥機型式？'],
    },
    createdAt: '2026-11-12 11:30',
    budgetNtd: 1600000,
    timeline: '希望 12 月底前完成購買以申請 115 年度補助',
    interestedVendorIds: ['v01'],
  }),
  need({
    id: 'n15',
    factoryId: 'f04',
    city: '彰化縣',
    scale: 'M',
    title: '染整廠冷卻水塔泵浦與排風機變頻改善',
    rawText: '染整車間有 6 台 30 馬力（22 kW）循環水泵跟排風機都是全速定頻跑，想加裝變頻器與溫差控制，評估能省多少電跟補助金額。',
    form: {
      items: [
        { equip: 'pump_fan', quantity: 6, ratedKw: 22, ageYears: 11, ageText: '11 年（30 馬力）', note: '全年連續運轉' },
        { equip: 'motor_vfd', quantity: 6, ratedKw: 22, ageYears: 11, ageText: null },
      ],
      mainProblems: ['泵浦與風機全速運轉耗電', '隨季節水溫變化無自動降頻'],
      directions: ['汰換高效率泵浦或加裝變頻器（VFD）', '建立溫差自動調速控制'],
      openQuestions: ['現場控制盤空間是否足夠安裝變頻器？'],
    },
    createdAt: '2026-11-12 14:20',
    budgetNtd: 1200000,
    timeline: '年前停機歲修期間施工',
  }),
]
