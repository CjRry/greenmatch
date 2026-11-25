/**
 * Rule-based 報價解說: pulls the unified fields out of a vendor's free-form quote.
 * Anything it cannot read stays null, is listed in `unreadable`, and becomes a question for the vendor.
 * Pure and deterministic. It is both the offline demo and the fallback when Claude fails.
 */
import { totalNtd } from '../../../core/domain/roi'
import { extractStandardQuoteFields } from '../../../core/domain/quoteStandard'
import { formatNtd, formatNumber } from '../../../core/format'
import type { Quote, QuoteComparison, QuoteComparisonRow, QuoteFields, Source } from '../../../core/types'
import { CN_NUM, normalizeText, toNumber } from './numbers'

export const FIELD_KEYS: readonly (keyof QuoteFields)[] = [
  'equipmentNtd',
  'installNtd',
  'warrantyYears',
  'monthlySaveKwh',
  'monthlySaveNtd',
  'savePct',
  'paybackMonths',
  'baseline',
]

export function emptyFields(): QuoteFields {
  return {
    equipmentNtd: null,
    installNtd: null,
    warrantyYears: null,
    monthlySaveKwh: null,
    monthlySaveNtd: null,
    savePct: null,
    paybackMonths: null,
    baseline: null,
  }
}

export interface ParsedQuote {
  fields: QuoteFields
  unreadable: (keyof QuoteFields)[]
  notes: Partial<Record<keyof QuoteFields, string>>
  /** Questions to put to this vendor, without the vendor's name. */
  questions: string[]
}

const NUM = `(?:\\d+(?:\\.\\d+)?|${CN_NUM})`
const SKIP_SEGMENT = /省|節|回本|電價|電費|每度|保固|有效|效益|估算|折舊|補助|稅率|訂金|頭期|尾款|付款/
const INSTALL_WORD = /安裝|施工|工資|工程費|配管|配電|試運轉|人工|工費|調整/
const TOTAL_WORD = /合計|總計|總價|小計|共計/

/** The first money amount in a segment: NT$ 1,860,000 / 58 萬元 / 4 萬 5 千元 / 8500 元. */
function amountIn(seg: string): number | null {
  const nt = seg.match(/(?:NT\$|NTD|新台幣|\$)\s*(\d+(?:\.\d+)?)\s*(萬)?/i)
  if (nt) return Math.round(Number(nt[1]) * (nt[2] ? 10000 : 1))
  const wan = seg.match(/(\d+(?:\.\d+)?)\s*萬(?:\s*(\d+(?:\.\d+)?)\s*千)?/)
  if (wan) return Math.round(Number(wan[1]) * 10000 + (wan[2] ? Number(wan[2]) * 1000 : 0))
  const qian = seg.match(/(\d+(?:\.\d+)?)\s*千\s*元?/)
  if (qian) return Math.round(Number(qian[1]) * 1000)
  const yuan = seg.match(/(?<![\d.])(\d+)\s*元/)
  if (yuan) return Number(yuan[1])
  return null
}

function parseCosts(text: string): { equipment: number | null; install: number | null; total: number | null } {
  let equipment: number | null = null
  let install: number | null = null
  let total: number | null = null
  for (const seg of text.split(/[\n，,；;。]/)) {
    const amount = amountIn(seg)
    if (amount == null) continue
    const explicitEquipLine =
      /^\s*(?:[\d.)、]*\s*)?(?:設備|主機|機器|機台|硬體)(?:費|費用|價|價格)?(?:\s*[：:]|$)/.test(seg)
    const explicitInstallLine =
      /^\s*(?:[\d.)、]*\s*)?(?:安裝|施工|工資|工程費|配管|配電|吊裝|試運轉|試車)(?:費|費用|工資|工程)?(?:\s*[：:]|$)/.test(seg)
    if (TOTAL_WORD.test(seg) && !explicitEquipLine && !explicitInstallLine) {
      total ??= amount
      continue
    }
    if (SKIP_SEGMENT.test(seg)) continue
    let value = amount
    const each = /每\s*(?:台|部|組|座|套)/.test(seg) ? seg.match(new RegExp(`(${NUM})\\s*[台部組座套]`)) : null
    if (each) {
      const n = toNumber(each[1])
      if (Number.isFinite(n) && n > 0) value = amount * n
    }
    const bundledWithEquip = /含\s*(?:安裝|施工|配管)/.test(seg) && !explicitInstallLine
    if (INSTALL_WORD.test(seg) && !bundledWithEquip) install = (install ?? 0) + value
    else equipment = (equipment ?? 0) + value
  }
  if (total != null && equipment == null && install == null) equipment = total
  else if (total != null && install != null && equipment != null && equipment + install !== total) equipment = Math.max(0, total - install)
  else if (total != null && equipment != null && install == null && total > equipment) install = total - equipment
  return { equipment, install, total }
}

function parseWarranty(text: string): { years: number | null; note?: string; phrase?: string } {
  const line = text.match(/保固[:：]?\s*([^\n。]*)/)
  if (line) {
    const body = line[1]
    const first = body.match(new RegExp(`(${NUM})\\s*(年|個月|個月)`))
    if (first) {
      const n = toNumber(first[1])
      if (Number.isFinite(n)) {
        const years = first[2] === '年' ? n : Math.round((n / 12) * 10) / 10
        const multiple = (body.match(new RegExp(`${NUM}\\s*年`, 'g')) ?? []).length > 1
        return { years, note: multiple ? `原文：保固${line[1].trim()}` : undefined }
      }
    }
    if (body.trim()) return { years: null, phrase: body.trim() }
  }
  const after = text.match(new RegExp(`(${NUM})\\s*年(?:原廠)?保固`))
  if (after) {
    const n = toNumber(after[1])
    if (Number.isFinite(n)) return { years: n }
  }
  return { years: null }
}

function num(s: string): number {
  return Number(s.replace(/,/g, ''))
}

function parseSaveKwh(text: string): { kwh: number | null; note?: string } {
  const m = text.match(/每月(?:約|可|平均)?(?:可)?(?:節省|節電|省電|省|減少用電)?(?:約)?\s*(\d+(?:\.\d+)?)\s*(萬)?\s*度/)
  if (m) return { kwh: Math.round(num(m[1]) * (m[2] ? 10000 : 1)) }
  const monthly = text.match(/月(?:均)?(?:節電|省電)(?:約)?\s*(\d+(?:\.\d+)?)\s*(萬)?\s*度/)
  if (monthly) return { kwh: Math.round(num(monthly[1]) * (monthly[2] ? 10000 : 1)) }
  const yearly = text.match(/(?:每年|年)(?:約|可)*(?:節省|節電|省電|省)(?:約)?\s*(\d[\d,]*(?:\.\d+)?)\s*(萬)?\s*度/)
  if (yearly) {
    const y = Math.round(num(yearly[1]) * (yearly[2] ? 10000 : 1))
    return { kwh: Math.round(y / 12), note: `原報價為每年省 ${formatNumber(y)} 度，已換算為每月` }
  }
  return { kwh: null }
}

function parseSaveNtd(text: string): number | null {
  for (const sentence of text.split(/[。\n]/)) {
    if (!/每月|月/.test(sentence) || !/省|節/.test(sentence)) continue
    const nt = sentence.match(/(?:NT\$|NTD|新台幣)\s*(\d+(?:\.\d+)?)\s*(萬)?/i)
    if (nt) return Math.round(num(nt[1]) * (nt[2] ? 10000 : 1))
    const yuan = sentence.match(/(?<![\d.])(\d+)\s*元/)
    if (yuan && !/每度\s*$/.test(sentence.slice(0, yuan.index))) return Number(yuan[1])
  }
  return null
}

function parseSavePct(text: string): number | null {
  for (const sentence of text.split(/[。\n]/)) {
    if (!/省|節|下降|降低|減少/.test(sentence) || /稅|折扣|訂金|頭期|尾款|付款/.test(sentence)) continue
    const p = sentence.match(/(\d+(?:\.\d+)?)\s*%/) ?? sentence.match(/百分之\s*(\d+(?:\.\d+)?)/)
    if (p) return Number(p[1])
  }
  return null
}

function parsePayback(text: string): number | null {
  const months =
    text.match(/(\d+(?:\.\d+)?)\s*個月\s*(?:內)?\s*(?:即可)?回本/) ?? text.match(/(?:回本|回收)(?:期|時間)?(?:約|為|[:：])?\s*(\d+(?:\.\d+)?)\s*個月/)
  if (months) return Math.round(Number(months[1]))
  const years = text.match(/(\d+(?:\.\d+)?)\s*年\s*(?:內)?(?:即可)?回本/) ?? text.match(/(?:回本|回收)(?:期|時間)?(?:約|為|[:：])?\s*(\d+(?:\.\d+)?)\s*年/)
  if (years) return Math.round(Number(years[1]) * 12)
  return null
}

function cleanBaseline(s: string): string {
  return s
    .replace(/(?:的)?(?:電費單|電費帳單|用電量|用電資料|用電度數|用電|電費|電表資料|電表)+$/, '')
    .replace(/\s*(?:至|~|～|到)\s*/g, (m) => (m.trim() === '至' ? ' 至 ' : '–'))
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBaseline(text: string): string | null {
  const labeled = text.match(/(?:基準期間|比較基準|基準期|基期)[:：]?\s*([^\n，。；]+)/)
  if (labeled) return cleanBaseline(labeled[1]) || null
  const based = text.match(/以\s*([^，。；\n]{2,30}?)\s*為\s*(?:比較|計算)?基準/)
  if (based) return cleanBaseline(based[1]) || null
  const against = text.match(/(?:相較於|相比於|對比)\s*([^，。；\n]{2,24}?)(?:的)?(?:用電|電費)/)
  if (against && /\d|去年|前一年|同期/.test(against[1])) return cleanBaseline(against[1]) || null
  return null
}

const FIELD_QUESTION: Partial<Record<keyof QuoteFields, string>> = {
  equipmentNtd: '報價未載明設備費，請廠商列出設備與材料的金額',
  installNtd: '報價未載明施工費，請廠商列出安裝、配管、配電等施工金額',
  monthlySaveKwh: '報價未載明預估每月省電度數，請廠商說明預估節電量與算法',
  paybackMonths: '報價未載明預估回本時間，請廠商說明回本如何計算',
}

/** Read one quote. `declared` are fields the vendor typed into the submit form; they fill gaps only. */
export function parseQuote(raw: string, declared?: Partial<QuoteFields>): ParsedQuote {
  const text = normalizeText(raw)
  const fields = emptyFields()
  const notes: ParsedQuote['notes'] = {}

  const costs = parseCosts(text)
  fields.equipmentNtd = costs.equipment
  fields.installNtd = costs.install
  if (costs.total != null && costs.install == null && costs.equipment === costs.total) notes.equipmentNtd = '報價單只列合計，未拆分設備與施工'

  const warranty = parseWarranty(text)
  fields.warrantyYears = warranty.years
  if (warranty.note) notes.warrantyYears = warranty.note

  const kwh = parseSaveKwh(text)
  fields.monthlySaveKwh = kwh.kwh
  if (kwh.note) notes.monthlySaveKwh = kwh.note
  fields.monthlySaveNtd = parseSaveNtd(text)
  fields.savePct = parseSavePct(text)
  fields.paybackMonths = parsePayback(text)
  fields.baseline = parseBaseline(text)

  if (declared) {
    for (const k of FIELD_KEYS) {
      const d = declared[k]
      if (fields[k] == null && d != null) (fields as unknown as Record<string, unknown>)[k] = d
    }
  }

  // PROP-0007 4c optional standard fields (extracted from raw text, with declared filling gaps).
  const std = extractStandardQuoteFields(raw)
  const equipmentModel = std.equipmentModel ?? declared?.equipmentModel ?? null
  const ratedKw = std.ratedKw ?? declared?.ratedKw ?? null
  const efficiencyGrade = std.efficiencyGrade ?? declared?.efficiencyGrade ?? null
  const subsidyRegistered = std.subsidyRegistered ?? declared?.subsidyRegistered ?? null
  const savingsBasis = std.savingsBasis ?? declared?.savingsBasis ?? null
  const mvMethod = std.mvMethod ?? declared?.mvMethod ?? null
  if (equipmentModel != null) fields.equipmentModel = equipmentModel
  if (ratedKw != null) fields.ratedKw = ratedKw
  if (efficiencyGrade != null) fields.efficiencyGrade = efficiencyGrade
  if (subsidyRegistered !== null) fields.subsidyRegistered = subsidyRegistered
  if (savingsBasis != null) fields.savingsBasis = savingsBasis
  if (mvMethod != null) fields.mvMethod = mvMethod

  return finishRow(fields, notes, warranty.phrase)
}

/** unreadable list and vendor questions derived from filled fields (also used for Claude's rows). */
export function finishRow(fields: QuoteFields, notes: ParsedQuote['notes'] = {}, warrantyPhrase?: string): ParsedQuote {
  const unreadable = FIELD_KEYS.filter((k) => fields[k] == null)
  const questions: string[] = []
  for (const k of ['equipmentNtd', 'installNtd'] as const) if (fields[k] == null) questions.push(FIELD_QUESTION[k]!)
  if (fields.warrantyYears == null) {
    questions.push(
      warrantyPhrase
        ? `保固年限未載明具體年數（報價寫「${warrantyPhrase}」），請廠商以書面確認年限與保固範圍`
        : '報價未載明保固年限，請廠商補充主機與施工的保固年數',
    )
  }
  const claimsSaving = fields.savePct != null || fields.monthlySaveKwh != null || fields.monthlySaveNtd != null
  if (!claimsSaving) questions.push('報價未載明任何節電效益估算，請廠商提供預估節電量與依據')
  else {
    if (fields.monthlySaveKwh == null && fields.savePct == null) questions.push(FIELD_QUESTION.monthlySaveKwh!)
    if (fields.baseline == null) {
      const what =
        fields.savePct != null
          ? `預估省電 ${formatNumber(fields.savePct, Number.isInteger(fields.savePct) ? 0 : 1)}%`
          : fields.monthlySaveKwh != null
            ? `預估每月省電 ${formatNumber(fields.monthlySaveKwh)} 度`
            : '預估節省電費'
      questions.push(`${what}，但未說明比較基準期間，請廠商說明是以哪一段期間的用電量計算`)
    }
  }
  if (fields.paybackMonths == null) questions.push(FIELD_QUESTION.paybackMonths!)
  return { fields, unreadable, notes, questions }
}

// The ROI math lives in src/core/domain/roi.ts so the public-case backtest runs the same code.
export {
  BASE_ANNUAL_OPERATING_HOURS,
  DEFAULT_ROI_DAILY_HOURS,
  DEFAULT_ROI_DAYS_PER_YEAR,
  DEFAULT_ROI_RATE_NTD,
  computeInteractiveRoi,
  totalNtd,
  type InteractiveRoiInput,
  type InteractiveRoiResult,
} from '../../../core/domain/roi'

export interface QuoteEntry {
  vendorId: string
  vendorName: string
  rawText: string
  declared?: Partial<QuoteFields>
}

export function entriesFromQuotes(quotes: readonly Quote[], nameOf: (vendorId: string) => string): QuoteEntry[] {
  return quotes.map((q) => ({ vendorId: q.vendorId, vendorName: nameOf(q.vendorId), rawText: q.rawText, declared: q.declared }))
}

/** A short plain-language summary of what the rows show, without recommending a winner. */
export function summarize(rows: { vendorName: string; fields: QuoteFields }[], questionCount: number): string {
  if (!rows.length) return ''
  const parts: string[] = []
  const totals = rows.map((r) => ({ name: r.vendorName, total: totalNtd(r.fields) }))
  const known = totals.filter((t) => t.total != null)
  if (known.length) parts.push(`合計金額：${known.map((t) => `${t.name} ${formatNtd(t.total)}`).join('、')}。`)
  const saves = rows.filter((r) => r.fields.monthlySaveKwh != null)
  if (saves.length) parts.push(`預估每月省電：${saves.map((r) => `${r.vendorName}約 ${formatNumber(r.fields.monthlySaveKwh)} 度`).join('、')}。`)
  const baselines = rows.filter((r) => r.fields.baseline != null).length
  if (rows.length > 1 && baselines < rows.length) parts.push('各家的比較基準不一致或未載明，省電數字不能直接相比。')
  parts.push(questionCount ? `共有 ${questionCount} 項建議向廠商確認，確認後再做決定。` : '各項欄位都已載明。')
  return parts.join('')
}

/** Rule-based comparison for every quote of a case. */
export function buildComparison(caseId: string, entries: readonly QuoteEntry[], source: Source = 'rules', generatedAt = new Date().toISOString()): QuoteComparison {
  const rows: QuoteComparisonRow[] = []
  const questions: QuoteComparison['questions'] = []
  const named: { vendorName: string; fields: QuoteFields }[] = []
  for (const e of entries) {
    const p = parseQuote(e.rawText, e.declared)
    rows.push({ vendorId: e.vendorId, fields: p.fields, unreadable: p.unreadable, notes: Object.keys(p.notes).length ? p.notes : undefined })
    for (const text of p.questions) questions.push({ vendorId: e.vendorId, text })
    named.push({ vendorName: e.vendorName, fields: p.fields })
  }
  return { id: caseId, caseId, source, generatedAt, rows, questions, summary: summarize(named, questions.length) }
}

const isNumOrNull = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0)

/** Guard for Claude's reply. Only vendors in `vendorIds` are kept; every row must cover all of them. */
export function guardComparison(vendorIds: readonly string[]) {
  const allowed = new Set(vendorIds)
  return (v: unknown): Pick<QuoteComparison, 'rows' | 'questions' | 'summary'> | null => {
    if (!v || typeof v !== 'object') return null
    const o = v as Record<string, unknown>
    if (!Array.isArray(o.rows) || !Array.isArray(o.questions)) return null
    const rows: QuoteComparisonRow[] = []
    for (const x of o.rows) {
      if (!x || typeof x !== 'object') return null
      const r = x as Record<string, unknown>
      if (typeof r.vendorId !== 'string' || !allowed.has(r.vendorId) || rows.some((p) => p.vendorId === r.vendorId)) continue
      const f = r.fields
      if (!f || typeof f !== 'object') return null
      const fo = f as Record<string, unknown>
      const fields = emptyFields()
      for (const k of FIELD_KEYS) {
        const val = fo[k]
        if (k === 'baseline') {
          if (val !== null && val !== undefined && typeof val !== 'string') return null
          fields.baseline = typeof val === 'string' && val.trim() ? val.trim() : null
        } else {
          if (val !== undefined && !isNumOrNull(val)) return null
          ;(fields as unknown as Record<string, number | null>)[k] = (val as number | null | undefined) ?? null
        }
      }
      if (typeof fo.equipmentModel === 'string' && fo.equipmentModel.trim()) fields.equipmentModel = fo.equipmentModel.trim()
      if (typeof fo.ratedKw === 'number' && Number.isFinite(fo.ratedKw) && fo.ratedKw >= 0) fields.ratedKw = fo.ratedKw
      if (typeof fo.efficiencyGrade === 'string' && fo.efficiencyGrade.trim()) fields.efficiencyGrade = fo.efficiencyGrade.trim()
      if (typeof fo.subsidyRegistered === 'boolean') fields.subsidyRegistered = fo.subsidyRegistered
      if (fo.savingsBasis === 'metered' || fo.savingsBasis === 'assumed') fields.savingsBasis = fo.savingsBasis
      if (typeof fo.mvMethod === 'string' && fo.mvMethod.trim()) fields.mvMethod = fo.mvMethod.trim()
      const notes: ParsedQuote['notes'] = {}
      if (r.notes && typeof r.notes === 'object') {
        for (const k of FIELD_KEYS) {
          const n = (r.notes as Record<string, unknown>)[k]
          if (typeof n === 'string' && n.trim()) notes[k] = n.trim()
        }
      }
      rows.push({ vendorId: r.vendorId, fields, unreadable: FIELD_KEYS.filter((k) => fields[k] == null), notes: Object.keys(notes).length ? notes : undefined })
    }
    if (rows.length !== allowed.size) return null
    const questions: QuoteComparison['questions'] = []
    for (const q of o.questions) {
      if (!q || typeof q !== 'object') continue
      const qq = q as Record<string, unknown>
      if (typeof qq.text !== 'string' || !qq.text.trim()) continue
      const vid = typeof qq.vendorId === 'string' && allowed.has(qq.vendorId) ? qq.vendorId : null
      questions.push({ vendorId: vid, text: qq.text.trim() })
    }
    const summary = typeof o.summary === 'string' && o.summary.trim() ? o.summary.trim() : null
    return { rows, questions: questions.slice(0, 12), summary }
  }
}
