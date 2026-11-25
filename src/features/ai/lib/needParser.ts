/**
 * Rule-based 需求整理: turns a factory's own words into the standard need form.
 * Pure and deterministic. It is both the offline demo and the fallback when Claude fails.
 */
import { EQUIP_INFO, EQUIPS, SPECIALTIES, SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { POWER_SUBTYPES, hpToKw } from '../../../core/subsidies'
import type { Equip, NeedForm, NeedItem, PowerSubtype, Specialty } from '../../../core/types'
import { CN_NUM, normalizeText, toNumber } from './numbers'

const CARBON_KEYWORDS = ['碳盤查', '盤查', '碳排', 'ISO 14064', 'ISO14064', '14064', '溫室氣體', '碳足跡']
const UNIT = '[台部座組盞支顆]'
const NUM = `(?:\\d+|${CN_NUM})`
const STOP_RE = /[，,。；;！？!?\n]/

interface Hit {
  equip: Specialty
  start: number
  end: number
}

function findHits(text: string): Hit[] {
  const candidates: Hit[] = []
  const lower = text.toLowerCase()
  const add = (equip: Specialty, kw: string) => {
    const k = kw.toLowerCase()
    for (let i = lower.indexOf(k); i >= 0; i = lower.indexOf(k, i + 1)) candidates.push({ equip, start: i, end: i + kw.length })
  }
  for (const e of EQUIPS) for (const kw of EQUIP_INFO[e].keywords) add(e, kw)
  // Longest match wins where keywords overlap (「冷氣機」 over 「冷氣」, 「加熱爐」 over 「加熱」).
  candidates.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start)
  const taken: Hit[] = []
  for (const c of candidates) if (!taken.some((t) => c.start < t.end && t.start < c.end)) taken.push(c)
  taken.sort((a, b) => a.start - b.start)
  // A bare 「變頻」 next to other equipment is how the factory wants that machine improved
  // (「空壓機…想換變頻的」), not a separate motor/drive item (OBS-0004 §2-4). Keep it only when it is
  // the sole equipment mentioned. 「變頻器」「馬達」 are always real items.
  const otherEquip = taken.some((h) => h.equip !== 'motor_vfd' && h.equip !== 'carbon_consulting')
  const realMotor = taken.some((h) => h.equip === 'motor_vfd' && text.slice(h.start, h.end) !== '變頻')
  return taken.filter((h, i) => {
    if (h.equip !== 'motor_vfd') return true
    const bare = text.slice(h.start, h.end) === '變頻'
    if (bare && (otherEquip || realMotor)) return false
    // 「變頻空壓機」 is an air compressor, not a motor drive: drop a 變頻 that directly modifies another item.
    const next = taken[i + 1]
    return !(next && next.equip !== 'motor_vfd' && next.start - h.end <= 2)
  })
}

interface Span {
  start: number
  end: number
}

/** The quantity bound to the hit: 「3 台空壓機」 first, then 「空壓機有 3 台」. Each number is used once. */
function findQuantity(text: string, hit: Hit, prevEnd: number, nextStart: number, used: Span[]): { qty: number; span: Span } | null {
  const free = (s: Span) => !used.some((u) => s.start < u.end && u.start < s.end)
  const re = new RegExp(`(${NUM})\\s*${UNIT}`, 'g')
  const before = text.slice(prevEnd, hit.start)
  let best: { qty: number; span: Span } | null = null
  for (const m of before.matchAll(re)) {
    const span = { start: prevEnd + m.index, end: prevEnd + m.index + m[0].length }
    const gap = before.slice(m.index + m[0].length)
    if (!free(span) || STOP_RE.test(gap) || gap.length > 16) continue
    const qty = toNumber(m[1])
    if (Number.isFinite(qty) && qty > 0) best = { qty, span }
  }
  if (best) return best
  const after = text.slice(hit.end, nextStart)
  for (const m of after.matchAll(re)) {
    const span = { start: hit.end + m.index, end: hit.end + m.index + m[0].length }
    const gap = after.slice(0, m.index)
    if (STOP_RE.test(gap) || gap.length > 16) break
    if (!free(span)) continue
    const qty = toNumber(m[1])
    if (Number.isFinite(qty) && qty > 0) return { qty, span }
  }
  return null
}

const THIS_YEAR = 2026

/** Age from words like 「十幾年」「快 20 年」「2012 年」「8 年」. */
export function parseAge(s: string): { ageYears: number; ageText: string } | null {
  const t = normalizeText(s)
  const decade = t.match(new RegExp(`(${NUM})\\s*幾\\s*年`))
  if (decade) {
    const n = toNumber(decade[1])
    if (Number.isFinite(n) && n > 0) return { ageYears: n, ageText: `${n} 年以上` }
  }
  const almost = t.match(new RegExp(`快\\s*(${NUM})\\s*年`))
  if (almost) {
    const n = toNumber(almost[1])
    if (Number.isFinite(n) && n > 0) return { ageYears: n, ageText: `快 ${n} 年` }
  }
  const year = t.match(/(19[89]\d|20[0-2]\d)\s*年(?!\s*(?:底|度|前|後|內))/)
  if (year) {
    const age = THIS_YEAR - Number(year[1])
    if (age >= 0) return { ageYears: age, ageText: `${year[1]} 年購置` }
  }
  const plain = t.match(new RegExp(`(${NUM})\\s*年(\\s*以上)?(?!\\s*(?:底|度|前|後|內|保固))`))
  if (plain) {
    const n = toNumber(plain[1])
    if (Number.isFinite(n) && n > 0 && n <= 60) return { ageYears: n, ageText: `${n} 年${plain[2] ? '以上' : ''}` }
  }
  return null
}

/** Extract rated power in kW from phrases like 「37kW」「37 kW」「50HP」「50 馬力」. */
export function parseRatedKw(s: string): number | null {
  const t = normalizeText(s)
  const kw = t.match(/(\d+(?:\.\d+)?)\s*(?:kw|瓩)/i)
  if (kw) {
    const n = Number(kw[1])
    if (Number.isFinite(n) && n > 0 && n <= 10000) return Math.round(n * 10) / 10
  }
  const hp = t.match(/(\d+(?:\.\d+)?)\s*(?:hp|馬力)/i)
  if (hp) {
    const n = Number(hp[1])
    if (Number.isFinite(n) && n > 0 && n <= 10000) return hpToKw(n)
  }
  return null
}

/** Extract monthly electricity bill in NTD (e.g. 「每月電費大概 27 萬」→ 270000, 「每月電費 180000 元」→ 180000). */
export function parseMonthlyBillNtd(raw: string): number | null {
  const t = normalizeText(raw)
  const m = t.match(/(?:每?月電費|月均電費|電費)\s*(?:大概|約|大約|差不多|約在|大概在|落在|為|是)?\s*([\d,]+(?:\.\d+)?)\s*(萬元?|元|塊)?/)
  if (!m) return null
  const num = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(num) || num <= 0) return null
  const unit = m[2] ?? ''
  if (unit.startsWith('萬')) {
    const val = Math.round(num * 10000)
    return val > 0 && val <= 100_000_000 ? val : null
  }
  if (unit === '元' || unit === '塊' || num >= 1000) {
    const val = Math.round(num)
    return val >= 500 && val <= 100_000_000 ? val : null
  }
  return null
}

const PROBLEM_RULES: { test: RegExp; text: (t: string) => string }[] = [
  { test: /電費|電價|用電成本/, text: (t) => (/越來越|上漲|漲|增加|變高|升高|愈來愈|高|貴/.test(t) ? '電費上升' : '電費負擔大') },
  { test: /耗電|吃電|用電量大|用電高|電力消耗/, text: () => '設備耗電高' },
  { test: /跳機|當機|故障|常壞|壞掉|維修頻繁|停機/, text: () => '設備常跳機或故障' },
  { test: /噪音|很吵|太吵|吵雜/, text: () => '噪音過大' },
  { test: /老舊|很舊|太舊|老化/, text: () => '設備老舊' },
  { test: /漏氣|洩漏|漏水|漏風/, text: () => '管路洩漏' },
  { test: /客戶要求|客戶要|客戶希望|品牌客戶|供應鏈|RE100/i, text: () => '客戶要求減碳或提供碳排數據' },
  { test: /法規|碳費|碳稅|碳邊境|CBAM/i, text: () => '因應碳費與法規' },
  { test: /散熱|過熱|溫度太高|悶熱/, text: () => '廠區過熱' },
]

const unique = <T,>(xs: T[]) => [...new Set(xs)]

/**
 * The machine type the subsidy rate depends on, read from the words around the equipment
 * (「想換變頻空壓機」→ variable-speed, 「活塞式」→ piston, 「多段泵浦」→ multi-stage). Null when unclear.
 */
export function detectPowerSubtype(equip: Specialty, keyword: string, clause: string): PowerSubtype | null {
  if (equip === 'air_compressor') {
    if (/活塞/.test(clause)) return 'compressor_piston'
    if (/變頻|可變轉速|VSD/i.test(clause)) return 'compressor_vsd'
    if (/定頻|定速|固定轉速/.test(clause)) return 'compressor_fixed'
    return null
  }
  if (equip === 'pump_fan') {
    if (/多段/.test(clause)) return 'pump_multi'
    if (/單段/.test(clause)) return 'pump_single'
    if (/風機|風扇|排風|送風|鼓風/.test(keyword) && !/泵/.test(clause)) return 'fan'
    return null
  }
  return null
}

/** 空壓機 3 台… → the standard form. Never throws; empty text gives an empty form with questions. */
export function parseNeed(raw: string): NeedForm {
  const text = normalizeText(raw)
  const hits = findHits(text)
  const used: Span[] = []
  const items: NeedItem[] = []

  hits.forEach((hit, i) => {
    const prevEnd = i > 0 ? hits[i - 1].end : 0
    const nextStart = i + 1 < hits.length ? hits[i + 1].start : text.length
    const isCarbon = hit.equip === 'carbon_consulting'
    let quantity: number | null = null
    let age: { ageYears: number; ageText: string } | null = null
    let ratedKw: number | null = null
    let subtype: PowerSubtype | null = null
    if (!isCarbon) {
      const q = findQuantity(text, hit, prevEnd, nextStart, used)
      if (q) {
        quantity = q.qty
        used.push(q.span)
      }
      // Age & rated power: after the keyword up to the next item or sentence end, otherwise in the clause before it.
      const afterRaw = text.slice(hit.end, nextStart)
      const sentenceEnd = afterRaw.search(/[。！？!?\n]/)
      const after = sentenceEnd >= 0 ? afterRaw.slice(0, sentenceEnd) : afterRaw
      const beforeRaw = text.slice(prevEnd, hit.start)
      const before = beforeRaw.slice(Math.max(beforeRaw.lastIndexOf('，'), beforeRaw.lastIndexOf(','), beforeRaw.lastIndexOf('。')) + 1)
      age = parseAge(after) ?? parseAge(before)
      ratedKw = parseRatedKw(after) ?? parseRatedKw(before)
      subtype = detectPowerSubtype(hit.equip, text.slice(hit.start, hit.end), before + text.slice(hit.start, hit.end) + after)
    }
    const existing = items.find((x) => x.equip === hit.equip)
    if (existing) {
      if (existing.quantity == null && quantity != null) existing.quantity = quantity
      if (existing.ratedKw == null && ratedKw != null) existing.ratedKw = ratedKw
      if (existing.subtype == null && subtype != null) existing.subtype = subtype
      if (existing.ageYears == null && age) Object.assign(existing, age)
      return
    }
    items.push({
      equip: hit.equip,
      quantity,
      ...(subtype != null ? { subtype } : {}),
      ...(ratedKw != null ? { ratedKw } : {}),
      ageYears: age?.ageYears ?? null,
      ageText: age?.ageText ?? null,
      note: null,
    })
  })

  const mainProblems = unique(PROBLEM_RULES.filter((r) => r.test.test(text)).map((r) => r.text(text)))
  if (!mainProblems.includes('設備老舊') && items.some((it) => it.ageYears != null && it.ageYears >= 10)) mainProblems.push('設備老舊')

  const directions: string[] = []
  for (const it of items) {
    if (it.equip === 'carbon_consulting') directions.push('辦理組織型溫室氣體盤查（ISO 14064-1）')
    else {
      const dirs = EQUIP_INFO[it.equip as Equip].directions
      directions.push(dirs[0])
      if (it.equip === 'air_compressor' && /漏氣|洩漏/.test(text) && dirs[1]) directions.push(dirs[1])
    }
  }

  const openQuestions: string[] = []
  for (const it of items) {
    if (it.equip === 'carbon_consulting') continue
    const label = SPECIALTY_LABEL[it.equip]
    if (it.quantity == null) openQuestions.push(`${label}共有幾台（組）？`)
    if (it.ageYears == null) openQuestions.push(`${label}大約用了幾年，或哪一年購置？`)
  }
  if (!items.length) openQuestions.push('想改善哪一類設備？例如空壓機、空調、照明、鍋爐。')
  if (items.length && !mainProblems.length) openQuestions.push('目前最困擾的是電費、故障、噪音，還是客戶要求？')

  const monthlyElectricBillNtd = parseMonthlyBillNtd(text)
  return {
    items,
    ...(monthlyElectricBillNtd != null ? { monthlyElectricBillNtd } : {}),
    mainProblems,
    directions: unique(directions),
    openQuestions,
  }
}

/** A starting title for the need, e.g. 「空壓機 3 台、空調節能改善」. The factory can edit it. */
export function suggestTitle(form: NeedForm): string {
  if (!form.items.length) return '節能改善需求'
  if (form.items.length === 1 && form.items[0].equip === 'carbon_consulting') return '碳盤查輔導需求'
  const parts = form.items.slice(0, 3).map((it) => {
    const label = SPECIALTY_LABEL[it.equip]
    return it.quantity ? `${label} ${it.quantity} 台` : label
  })
  return `${parts.join('、')}節能改善`
}

/**
 * Whether the factory's description talks about a carbon inventory. The platform does not match
 * consulting firms, so the wizard points these factories to the carbon page instead.
 */
export function mentionsCarbonInventory(text: string): boolean {
  const lower = text.toLowerCase()
  return CARBON_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const strList = (v: unknown, max = 8): string[] | null =>
  Array.isArray(v) ? v.filter(isStr).map((s) => s.trim()).filter(Boolean).slice(0, max) : null
const SPEC_SET = new Set<string>(SPECIALTIES)

/** Check Claude's JSON field by field. Items with an unknown code are dropped; a wrong shape returns null. */
export function guardNeedForm(v: unknown): NeedForm | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (!Array.isArray(o.items)) return null
  const items: NeedItem[] = []
  for (const x of o.items) {
    if (!x || typeof x !== 'object') continue
    const it = x as Record<string, unknown>
    if (!isStr(it.equip) || !SPEC_SET.has(it.equip)) continue
    if (items.some((p) => p.equip === it.equip)) continue
    const isCarbon = it.equip === 'carbon_consulting'
    const qty = typeof it.quantity === 'number' && Number.isFinite(it.quantity) && it.quantity > 0 ? Math.round(it.quantity) : null
    const ratedKw = typeof it.ratedKw === 'number' && Number.isFinite(it.ratedKw) && it.ratedKw > 0 ? Math.round(it.ratedKw * 10) / 10 : null
    const age = typeof it.ageYears === 'number' && Number.isFinite(it.ageYears) && it.ageYears >= 0 ? Math.round(it.ageYears) : null
    const subtypes = POWER_SUBTYPES[it.equip as Equip] as readonly string[] | undefined
    const subtype = isStr(it.subtype) && subtypes?.includes(it.subtype) ? (it.subtype as PowerSubtype) : null
    items.push({
      equip: it.equip as Specialty,
      ...(subtype ? { subtype } : {}),
      quantity: isCarbon ? null : qty,
      ...( !isCarbon && ratedKw != null ? { ratedKw } : {} ),
      ageYears: isCarbon ? null : age,
      ageText: isCarbon || !isStr(it.ageText) || !it.ageText.trim() ? null : it.ageText.trim(),
      note: isStr(it.note) && it.note.trim() ? it.note.trim() : null,
    })
  }
  const mainProblems = strList(o.mainProblems)
  const directions = strList(o.directions)
  const openQuestions = strList(o.openQuestions)
  if (!items.length || !mainProblems || !directions || !openQuestions) return null
  const bill = typeof o.monthlyElectricBillNtd === 'number' && Number.isFinite(o.monthlyElectricBillNtd) && o.monthlyElectricBillNtd > 0
    ? Math.round(o.monthlyElectricBillNtd)
    : null
  return {
    items,
    ...(bill != null ? { monthlyElectricBillNtd: bill } : {}),
    mainProblems,
    directions,
    openQuestions,
  }
}
