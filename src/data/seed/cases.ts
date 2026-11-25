/**
 * Demo cases at every stage, with timelines, quotes and saved AI comparisons.
 * Recommendations come from the real matching engine so seed and live results agree.
 */
import { rankVendors } from '../../core/domain/matching'
import { STAGE_KEYS, stageIndex } from '../../core/constants/stages'
import type {
  Case,
  CaseEvent,
  Company,
  Factory,
  Need,
  Quote,
  QuoteComparison,
  QuoteFields,
  Review,
  StageKey,
  UsagePoint,
  Vendor,
} from '../../core/types'
import { needSeeds } from './needs'
import { at } from './util'

const PRICE_PER_KWH = 4.6

export function shortName(name: string): string {
  return name.replace(/(股份)?有限公司$|工程行$|企業社$/, '')
}

interface CaseSeed {
  id: string
  needId: string
  stage: StageKey
  completed?: boolean
  /** When each finished stage was completed (Taiwan time). */
  done: Partial<Record<StageKey, string>>
  /** Preferred vendor to sign with, if it is among the 2 recommended. */
  prefer?: string
  surveyDate?: string
  contract?: { ntd: number; start: string; end: string }
  /** Expected monthly saving the quotes promise, kWh. */
  saveKwh?: number
  usage?: { before: [string, number][]; after: [string, number][] }
  notes?: { stage: StageKey; actor: 'factory' | 'vendor' | 'platform'; kind: CaseEvent['kind']; text: string; at: string; who?: 'a' | 'b' }[]
}

const SEEDS: CaseSeed[] = [
  {
    id: 'c01',
    needId: 'n01',
    stage: 'quote',
    done: { register: '2026-11-01 10:20', assess: '2026-11-02 09:30', survey: '2026-11-09 16:00' },
    surveyDate: '2026-11-06 09:30',
    notes: [
      { stage: 'survey', actor: 'vendor', kind: 'schedule', text: '預約 11/6 上午到廠場勘', at: '2026-11-03 11:00', who: 'a' },
      { stage: 'survey', actor: 'vendor', kind: 'schedule', text: '預約 11/9 下午到廠場勘', at: '2026-11-04 15:20', who: 'b' },
    ],
  },
  {
    id: 'c02',
    needId: 'n02',
    stage: 'survey',
    done: { register: '2026-11-08 14:05', assess: '2026-11-10 10:10' },
    surveyDate: '2026-11-16 10:00',
    notes: [{ stage: 'survey', actor: 'vendor', kind: 'schedule', text: '預約 11/16 上午到廠，量測射出機負載', at: '2026-11-11 09:40', who: 'a' }],
  },
  {
    id: 'c13',
    needId: 'n13',
    stage: 'survey',
    done: { register: '2026-11-09 11:00', assess: '2026-11-11 14:30' },
    surveyDate: '2026-11-17 14:00',
  },
  {
    id: 'c04',
    needId: 'n04',
    stage: 'contract',
    prefer: 'v08',
    done: {
      register: '2026-08-05 11:10',
      assess: '2026-08-06 10:00',
      survey: '2026-08-21 17:00',
      quote: '2026-10-08 16:30',
    },
    contract: { ntd: 2650000, start: '2026-11-16', end: '2026-12-20' },
    saveKwh: 9800,
  },
  {
    id: 'c03',
    needId: 'n03',
    stage: 'construction',
    prefer: 'v02',
    done: {
      register: '2026-07-01 09:40',
      assess: '2026-07-02 11:00',
      survey: '2026-07-15 15:00',
      quote: '2026-08-12 10:00',
      contract: '2026-08-20 14:00',
    },
    contract: { ntd: 3280000, start: '2026-09-15', end: '2026-11-10' },
    saveKwh: 21000,
    notes: [
      { stage: 'construction', actor: 'vendor', kind: 'progress', text: '完成 1 號冰水主機拆除與新機定位', at: '2026-09-26 18:00', who: 'a' },
      { stage: 'construction', actor: 'vendor', kind: 'progress', text: '2 號機配管完成，預計 11/3 停機切換', at: '2026-10-21 17:30', who: 'a' },
    ],
  },
  {
    id: 'c05',
    needId: 'n05',
    stage: 'acceptance',
    prefer: 'v07',
    done: {
      register: '2026-06-02 15:30',
      assess: '2026-06-03 09:00',
      survey: '2026-06-18 16:00',
      quote: '2026-07-10 11:00',
      contract: '2026-07-24 15:00',
      construction: '2026-10-19 17:00',
    },
    contract: { ntd: 1880000, start: '2026-09-01', end: '2026-10-15' },
    saveKwh: 14500,
    notes: [{ stage: 'acceptance', actor: 'vendor', kind: 'note', text: '已上傳試運轉紀錄與群控設定說明', at: '2026-10-20 10:00', who: 'a' }],
  },
  {
    id: 'c06',
    needId: 'n06',
    stage: 'compare',
    completed: true,
    prefer: 'v03',
    done: {
      register: '2026-03-10 10:00',
      assess: '2026-03-11 09:00',
      survey: '2026-03-20 15:00',
      quote: '2026-04-02 11:00',
      contract: '2026-04-15 14:00',
      construction: '2026-05-20 17:00',
      acceptance: '2026-05-23 11:00',
      compare: '2026-09-05 10:00',
    },
    contract: { ntd: 1320000, start: '2026-05-05', end: '2026-05-20' },
    saveKwh: 6200,
    usage: {
      before: [
        ['2025-12', 68900],
        ['2026-01', 66800],
        ['2026-02', 69700],
        ['2026-03', 70400],
        ['2026-04', 72100],
        ['2026-05', 72600],
      ],
      after: [
        ['2026-06', 63500],
        ['2026-07', 64200],
        ['2026-08', 62900],
      ],
    },
  },
  {
    id: 'c07',
    needId: 'n07',
    stage: 'compare',
    prefer: 'v09',
    done: {
      register: '2026-04-08 09:15',
      assess: '2026-04-09 10:00',
      survey: '2026-04-24 16:00',
      quote: '2026-05-20 10:30',
      contract: '2026-06-03 14:00',
      construction: '2026-07-25 17:00',
      acceptance: '2026-07-31 11:00',
    },
    contract: { ntd: 2960000, start: '2026-06-15', end: '2026-07-25' },
    saveKwh: 22000,
    usage: {
      before: [
        ['2026-02', 255000],
        ['2026-03', 258400],
        ['2026-04', 262100],
        ['2026-05', 264800],
        ['2026-06', 268900],
        ['2026-07', 263200],
      ],
      after: [
        ['2026-08', 242300],
        ['2026-09', 239800],
      ],
    },
  },
  { id: 'c08', needId: 'n08', stage: 'assess', done: { register: '2026-11-11 10:40' } },
  { id: 'c09', needId: 'n09', stage: 'assess', done: { register: '2026-11-11 13:20' } },
  { id: 'c10', needId: 'n10', stage: 'assess', done: { register: '2026-11-11 16:50' } },
  { id: 'c11', needId: 'n11', stage: 'assess', done: { register: '2026-11-12 08:30' } },
]

/** The two hand-written quotes for c01, in the different formats the deck describes. */
const C01_QUOTES: Record<string, string> = {
  v01: `綠能節電工程股份有限公司　報價單 No. GE-2026-1018
客戶：永豐金屬工業股份有限公司（台南市安南區）

項目
1. 37kW 永磁變頻螺旋式空壓機 ×3（含舊機拆除）　NT$ 1,860,000
2. 空壓管路洩漏檢測與修補　NT$ 85,000
3. 安裝、配管、配電工資　NT$ 210,000
4. 空調溫控與排程控制器 ×6　NT$ 96,000
合計（未稅）NT$ 2,251,000

保固：空壓機主機 3 年，施工 1 年
預估效益：改善後空壓系統可省電約 20%，每月約節省 11,000 度，以平均電價每度 4.6 元計，每月約省 NT$ 50,600，約 45 個月回本。
報價有效期限：30 天`,
  v11: `永豐金屬 李課長您好：

感謝貴廠安排 10/14 場勘。經量測，現有三台 2012 年定頻空壓機（各 50HP）加載率偏低，建議以兩台 37kW 變頻機搭配一台既有機台作為備援，可降低初期投資。

費用說明
- 變頻空壓機兩台：每台 58 萬元
- 安裝與管路調整：16 萬元
- 冷氣部分建議先做排程控制：4 萬 5 千元
以上金額未稅。

節能估算：以 2026 年 7 月至 9 月電費單為基準，空壓系統用電可下降約 15%，每月約 8,200 度。
保固依原廠規定。

府城機電工程有限公司　陳志明`,
}

function quoteA(v: Vendor, f: Factory, n: Need, ntd: number, saveKwh: number, code: string): { text: string; fields: QuoteFields } {
  const eq = Math.round((ntd * 0.84) / 1000) * 1000
  const inst = ntd - eq
  const save = Math.round(saveKwh * PRICE_PER_KWH)
  const payback = Math.round(ntd / save)
  const pct = Math.round((saveKwh / Math.max(1, f.factory.monthlyKwh ?? saveKwh * 5)) * 100)
  const item = n.form.directions[0] ?? n.title
  const baseline = '2026 年 4–6 月'
  const text = `${v.name}　報價單 No. ${code}
客戶：${f.name}（${f.city}${f.district ?? ''}）

項目
1. ${item}（設備與材料）　NT$ ${eq.toLocaleString('en-US')}
2. 安裝、配管、配電與試運轉　NT$ ${inst.toLocaleString('en-US')}
合計（未稅）NT$ ${ntd.toLocaleString('en-US')}

保固：主要設備 3 年，施工 1 年
預估效益：以${baseline}用電為基準，全廠用電約可下降 ${pct}%，每月約節省 ${saveKwh.toLocaleString('en-US')} 度（約 NT$ ${save.toLocaleString('en-US')}），約 ${payback} 個月回本。`
  return {
    text,
    fields: { equipmentNtd: eq, installNtd: inst, warrantyYears: 3, monthlySaveKwh: saveKwh, monthlySaveNtd: save, savePct: pct, paybackMonths: payback, baseline },
  }
}

function quoteB(v: Vendor, f: Factory, n: Need, ntd: number, saveKwh: number): { text: string; fields: QuoteFields } {
  const total = Math.round((ntd * 1.06) / 10000) * 10000
  const eq = Math.round((total * 0.78) / 10000) * 10000
  const inst = total - eq
  const kwh = Math.round((saveKwh * 0.85) / 100) * 100
  const text = `${f.name} ${f.contactName}${f.contactTitle ?? ''}您好：

感謝貴廠安排場勘。依現場狀況，我們建議${n.form.directions.join('，並')}。

費用：設備約 ${eq / 10000} 萬元，施工約 ${inst / 10000} 萬元（未稅）。
節能估算：改善後每月約可省 ${kwh.toLocaleString('en-US')} 度。
保固 2 年。

${v.name}　${v.contactName}`
  return {
    text,
    fields: { equipmentNtd: eq, installNtd: inst, warrantyYears: 2, monthlySaveKwh: kwh, monthlySaveNtd: null, savePct: null, paybackMonths: null, baseline: null },
  }
}

export interface CaseBundle {
  needs: Need[]
  cases: Case[]
  caseEvents: CaseEvent[]
  quotes: Quote[]
  quoteComparisons: QuoteComparison[]
}

export function buildCases(companies: readonly Company[], reviews: readonly Review[]): CaseBundle {
  const byId = new Map(companies.map((c) => [c.id, c]))
  const needs: Need[] = []
  const cases: Case[] = []
  const caseEvents: CaseEvent[] = []
  const quotes: Quote[] = []
  const quoteComparisons: QuoteComparison[] = []
  const caseByNeed = new Map(SEEDS.map((s) => [s.needId, s]))

  for (const base of needSeeds) {
    const seed = caseByNeed.get(base.id)
    const n: Need = { ...base, status: 'open', caseId: seed?.id ?? null }
    if (!seed) {
      needs.push(n)
      continue
    }
    const factory = byId.get(n.factoryId) as Factory
    const recs = rankVendors(n, factory, companies, reviews)
    const si = stageIndex(seed.stage)
    const pastAssess = si > stageIndex('assess')
    const shortlist = pastAssess ? recs.map((r) => r.vendorId) : []
    const selected =
      si > stageIndex('quote') ? (seed.prefer && shortlist.includes(seed.prefer) ? seed.prefer : shortlist[0]) : null
    const [a, b] = selected ? [selected, shortlist.find((x) => x !== selected)!] : [shortlist[0], shortlist[1]]
    const va = a ? (byId.get(a) as Vendor) : null
    const vb = b ? (byId.get(b) as Vendor) : null
    n.status = pastAssess ? 'matched' : 'open'
    needs.push(n)

    // Timeline: one entry per finished stage, plus scheduled notes and quote submissions.
    let ev = 0
    const push = (e: Omit<CaseEvent, 'id' | 'caseId' | 'isDemo'>) => caseEvents.push({ ...e, id: `${seed.id}_e${++ev}`, caseId: seed.id, isDemo: true })
    const names = shortlist.map((id) => shortName(byId.get(id)!.name)).join('、')
    const doneText: Record<StageKey, string> = {
      register: '送出需求表（AI 整理口語描述，工廠確認後送出）',
      assess: `平台推薦 ${names}，工廠邀請兩家場勘`,
      survey: `${names} 完成現場場勘`,
      quote: selected ? `工廠比較兩家報價後，選擇 ${shortName(byId.get(selected)!.name)}` : '報價完成',
      contract: '完成簽約',
      construction: va ? `${shortName(va.name)} 完工並完成試運轉` : '完工',
      acceptance: '工廠驗收通過',
      compare: '用電比較完成',
    }
    const doneActor: Record<StageKey, CaseEvent['actor']> = {
      register: 'factory',
      assess: 'platform',
      survey: 'vendor',
      quote: 'factory',
      contract: 'factory',
      construction: 'vendor',
      acceptance: 'factory',
      compare: 'platform',
    }
    const timeline: { at: string; e: Omit<CaseEvent, 'id' | 'caseId' | 'isDemo'> }[] = []
    for (const key of STAGE_KEYS) {
      const t = seed.done[key]
      if (!t) continue
      timeline.push({
        at: at(t),
        e: { stage: key, kind: key === 'quote' ? 'select' : 'stage_done', actor: doneActor[key], actorId: doneActor[key] === 'factory' ? factory.id : doneActor[key] === 'vendor' ? (va?.id ?? null) : null, text: doneText[key], at: at(t) },
      })
    }
    for (const note of seed.notes ?? []) {
      const vendorId = note.who === 'b' ? vb?.id : va?.id
      timeline.push({
        at: at(note.at),
        e: { stage: note.stage, kind: note.kind, actor: note.actor, actorId: note.actor === 'vendor' ? (vendorId ?? null) : note.actor === 'factory' ? factory.id : null, text: note.actor === 'vendor' && vendorId ? `${shortName(byId.get(vendorId)!.name)}：${note.text}` : note.text, at: at(note.at) },
      })
    }

    // Quotes: c01 has the two hand-written ones; later cases get one structured and one letter-style quote.
    if (si >= stageIndex('quote') && va && vb) {
      const quoteDay = seed.id === 'c01' ? ['2026-11-11 17:20', '2026-11-12 10:45'] : [seed.done.survey!, seed.done.survey!]
      const offset = (s: string, days: number) => {
        const d = new Date(at(s))
        d.setDate(d.getDate() + days)
        return d.toISOString()
      }
      if (seed.id === 'c01') {
        ;[va, vb].forEach((v, i) => {
          quotes.push({ id: `${seed.id}_q${i + 1}`, caseId: seed.id, vendorId: v.id, rawText: C01_QUOTES[v.id] ?? '', submittedAt: at(quoteDay[i]), isDemo: true })
          timeline.push({ at: at(quoteDay[i]), e: { stage: 'quote', kind: 'quote', actor: 'vendor', actorId: v.id, text: `${shortName(v.name)} 提交報價`, at: at(quoteDay[i]) } })
        })
      } else if (seed.contract && seed.saveKwh) {
        const qa = quoteA(va, factory, n, seed.contract.ntd, seed.saveKwh, `Q-${seed.id.toUpperCase()}-01`)
        const qb = quoteB(vb, factory, n, seed.contract.ntd, seed.saveKwh)
        const ta = offset(quoteDay[0], 7)
        const tb = offset(quoteDay[1], 10)
        quotes.push({ id: `${seed.id}_q1`, caseId: seed.id, vendorId: va.id, rawText: qa.text, submittedAt: ta, isDemo: true })
        quotes.push({ id: `${seed.id}_q2`, caseId: seed.id, vendorId: vb.id, rawText: qb.text, submittedAt: tb, isDemo: true })
        timeline.push({ at: ta, e: { stage: 'quote', kind: 'quote', actor: 'vendor', actorId: va.id, text: `${shortName(va.name)} 提交報價`, at: ta } })
        timeline.push({ at: tb, e: { stage: 'quote', kind: 'quote', actor: 'vendor', actorId: vb.id, text: `${shortName(vb.name)} 提交報價`, at: tb } })
        quoteComparisons.push({
          id: seed.id,
          caseId: seed.id,
          source: 'claude',
          generatedAt: offset(quoteDay[1], 11),
          rows: [
            { vendorId: va.id, fields: qa.fields, unreadable: [] },
            { vendorId: vb.id, fields: qb.fields, unreadable: ['monthlySaveNtd', 'savePct', 'paybackMonths', 'baseline'] },
          ],
          questions: [
            { vendorId: vb.id, text: `${shortName(vb.name)} 估計每月省 ${qb.fields.monthlySaveKwh?.toLocaleString('en-US')} 度，但未說明比較基準期間` },
            { vendorId: vb.id, text: `${shortName(vb.name)} 未列出回本時間，可請廠商依現行電價試算` },
            { vendorId: vb.id, text: '保固 2 年是否包含主要設備與施工？' },
          ],
          summary: `${shortName(va.name)} 報價較低且保固較長；${shortName(vb.name)} 的節能估算缺少比較基準，建議先確認。`,
          isDemo: true,
        })
      }
    }

    timeline.sort((x, y) => (x.at < y.at ? -1 : 1)).forEach((t) => push(t.e))

    const usage: UsagePoint[] | undefined = seed.usage
      ? [
          ...seed.usage.before.map(([month, kwh]) => ({ month, kwh, phase: 'before' as const })),
          ...seed.usage.after.map(([month, kwh]) => ({ month, kwh, phase: 'after' as const })),
        ]
      : undefined
    const avg = (xs: [string, number][]) => Math.round(xs.reduce((s, [, k]) => s + k, 0) / xs.length)

    const prevKey = STAGE_KEYS[si - 1]
    const stageStartedAt = at(seed.done[prevKey] ?? seed.done.register!)
    const lastTouch = [...Object.values(seed.done), ...(seed.notes ?? []).map((x) => x.at)].sort().at(-1)!
    cases.push({
      id: seed.id,
      needId: n.id,
      factoryId: factory.id,
      title: n.title,
      stage: seed.stage,
      stageStartedAt,
      status: seed.completed ? 'completed' : 'active',
      recommendations: recs,
      shortlist,
      selectedVendorId: selected,
      surveyDate: seed.surveyDate ? at(seed.surveyDate) : null,
      contractNtd: seed.contract?.ntd ?? null,
      startDate: seed.contract ? at(`${seed.contract.start} 08:00`) : null,
      endDate: seed.contract ? at(`${seed.contract.end} 17:00`) : null,
      baselineKwh: seed.usage ? avg(seed.usage.before) : null,
      afterKwh: seed.usage ? avg(seed.usage.after) : null,
      usage,
      createdAt: n.createdAt,
      updatedAt: at(lastTouch),
      completedAt: seed.completed ? at(seed.done.compare!) : null,
      isDemo: true,
    })
  }

  // The compare-stage summary needs the averages, so fill its text in afterwards.
  for (const c of cases) {
    if (c.status !== 'completed' || !c.baselineKwh || !c.afterKwh) continue
    const e = caseEvents.find((x) => x.caseId === c.id && x.stage === 'compare' && x.kind === 'stage_done')
    if (e) {
      const pct = ((c.baselineKwh - c.afterKwh) / c.baselineKwh) * 100
      e.text = `用電比較完成：改善後每月平均 ${c.afterKwh.toLocaleString('en-US')} 度，較改善前減少 ${pct.toFixed(1)}%`
    }
  }

  return { needs, cases, caseEvents, quotes, quoteComparisons }
}
