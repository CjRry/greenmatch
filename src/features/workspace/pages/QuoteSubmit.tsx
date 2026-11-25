import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Lock, LogIn } from 'lucide-react'
import { STAGE_BY_KEY } from '../../../core/constants/stages'
import { extractStandardQuoteFields } from '../../../core/domain/quoteStandard'
import { nowIso } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection, useDoc, useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import type { Quote, QuoteFields } from '../../../core/types'
import { Button, ButtonLink, Card, EmptyState, Field, PageHeader, Select, SkeletonList, TextArea, TextInput, useToast } from '../../../ui'
import { isError, transition } from '../lib/transitions'

type NumKey = 'equipmentNtd' | 'installNtd' | 'warrantyYears' | 'monthlySaveKwh' | 'savePct' | 'paybackMonths'

const NUM_FIELDS: { key: NumKey; label: string; unit: string; hint?: string }[] = [
  { key: 'equipmentNtd', label: '設備費', unit: '未稅・元', hint: '建議填未稅金額，與施工費合計為未稅總價' },
  { key: 'installNtd', label: '施工費', unit: '未稅・元', hint: '含配管配線、吊裝、試車或EMS整合（未稅）' },
  { key: 'warrantyYears', label: '保固年限', unit: '年', hint: '主機或全機保固年限' },
  { key: 'monthlySaveKwh', label: '預估每月省電', unit: '度', hint: '改善後每月預估節省度數' },
  { key: 'savePct', label: '節電百分比', unit: '%', hint: '預估節電率（%）' },
  { key: 'paybackMonths', label: '回本月數', unit: '個月', hint: '預估投資回收期（月）' },
]

function parseMoneySeg(seg: string): number | null {
  const nt = seg.match(/(?:NT\$|NTD|新台幣|\$)\s*([\d,]+(?:\.\d+)?)\s*(萬)?/i)
  if (nt) return Math.round(Number(nt[1].replace(/,/g, '')) * (nt[2] ? 10_000 : 1))
  const wan = seg.match(/([\d,]+(?:\.\d+)?)\s*萬(?:\s*(\d+(?:\.\d+)?)\s*千)?/)
  if (wan) return Math.round(Number(wan[1].replace(/,/g, '')) * 10_000 + (wan[2] ? Number(wan[2]) * 1_000 : 0))
  const qian = seg.match(/([\d,]+(?:\.\d+)?)\s*千\s*元?/)
  if (qian) return Math.round(Number(qian[1].replace(/,/g, '')) * 1_000)
  const yuan = seg.match(/(?<![\d.])([\d,]+)\s*元/)
  if (yuan) return Number(yuan[1].replace(/,/g, ''))
  return null
}

export function extractFromRawText(raw: string): Partial<QuoteFields> {
  const SKIP = /省|節|回本|回收|電價|電費|每度|保固|有效|效益|估算|折舊|補助|稅率|訂金|頭期|尾款|付款/
  const INSTALL_WORD = /安裝|施工|工資|工程費|配管|配電|試運轉|人工|工費|調整/
  const TOTAL_WORD = /合計|總計|總價|小計|共計/

  let equipSum: number | null = null
  let installSum: number | null = null
  let totalAmt: number | null = null

  // Do not split inside comma-separated thousands (e.g. 210,000 or 2,251,000).
  for (const seg of raw.split(/[\n，；;。]|,(?!\d{3}(?!\d))/)) {
    const amount = parseMoneySeg(seg)
    if (amount == null) continue
    if (TOTAL_WORD.test(seg)) {
      totalAmt ??= amount
      continue
    }
    if (SKIP.test(seg)) continue
    let val = amount
    const each = /每\s*(?:台|部|組|座|套)/.test(seg) ? seg.match(/(\d+(?:\.\d+)?)\s*[台部組座套]/) : null
    if (each) {
      const cnt = Number(each[1])
      if (Number.isFinite(cnt) && cnt > 0 && !/\d+\s*[台部組座套]\s*[\d,]*\s*kW/i.test(seg)) val = amount * cnt
    }
    if (INSTALL_WORD.test(seg) && !/含\s*(?:安裝|施工|配管)/.test(seg)) installSum = (installSum ?? 0) + val
    else equipSum = (equipSum ?? 0) + val
  }

  let equipmentNtd = equipSum
  let installNtd = installSum
  if (totalAmt != null && equipmentNtd == null && installNtd == null) equipmentNtd = totalAmt
  else if (totalAmt != null && installNtd != null && equipmentNtd != null && equipmentNtd + installNtd !== totalAmt) {
    equipmentNtd = Math.max(0, totalAmt - installNtd)
  } else if (totalAmt != null && installNtd != null && equipmentNtd == null && totalAmt > installNtd) {
    equipmentNtd = totalAmt - installNtd
  } else if (totalAmt != null && equipmentNtd != null && installNtd == null && totalAmt > equipmentNtd) {
    installNtd = totalAmt - equipmentNtd
  }

  const wMatch = raw.match(/保固[^\n\d]{0,10}?(\d+(?:\.\d+)?)\s*年/) ?? raw.match(/(\d+(?:\.\d+)?)\s*年(?:原廠)?保固/)
  const kwhMatch = raw.match(/每\s*月[^\n\d]{0,10}?([\d,]+)\s*(?:度|kWh)/i)
  const pctMatch = raw.match(/(?:節電率?|省電率?|節能率?)[^\n\d]{0,8}?(?:\d+\s*[~～-]\s*)?(\d+(?:\.\d+)?)\s*%/)
  const pbMatch =
    raw.match(/(\d+(?:\.\d+)?)\s*個?月\s*(?:內)?(?:即可)?回本/) ??
    raw.match(/(?:回本|回收)(?:期|時間)?[^\n\d]{0,8}?(\d+(?:\.\d+)?)\s*個?月/)
  const pbYear = !pbMatch
    ? raw.match(/(\d+(?:\.\d+)?)\s*年\s*(?:內)?(?:即可)?回本/) ?? raw.match(/(?:回本|回收)(?:期|時間)?[^\n\d]{0,8}?(\d+(?:\.\d+)?)\s*年/)
    : null
  const baseMatch = raw.match(/(?:比較基準|基準期間|基準)[^\n：:]*[：:]\s*([^\n。]+)/)
  return {
    ...(equipmentNtd != null ? { equipmentNtd } : {}),
    ...(installNtd != null ? { installNtd } : {}),
    ...(wMatch ? { warrantyYears: Number(wMatch[1]) } : {}),
    ...(kwhMatch ? { monthlySaveKwh: Number(kwhMatch[1].replace(/,/g, '')) } : {}),
    ...(pctMatch ? { savePct: Number(pctMatch[1]) } : {}),
    ...(pbMatch ? { paybackMonths: Math.round(Number(pbMatch[1])) } : pbYear ? { paybackMonths: Math.round(Number(pbYear[1]) * 12) } : {}),
    ...(baseMatch ? { baseline: baseMatch[1].trim() } : {}),
  }
}

export function extractCommercialTerms(raw: string): {
  validityDays?: string
  downtimeDays?: string
  paymentTerms?: string
} {
  const validity = raw.match(/報價有效(?:期限|天數|期)?[：:\s]*(\d+)\s*天/)?.[1]
  const downtime = raw.match(/(?:預估)?停機(?:施工)?(?:天數|時間)?[：:\s約]*([^\n，,；;。]{1,24}?(?:天|小時|日))/)?.[1]?.trim()
  const payment = raw.match(/付款(?:條件|方式)(?:摘要)?[：:\s]*([^\n。]+)/)?.[1]?.trim()
  return {
    ...(validity ? { validityDays: validity } : {}),
    ...(downtime ? { downtimeDays: downtime } : {}),
    ...(payment ? { paymentTerms: payment } : {}),
  }
}

/** Empty input → null; otherwise a finite number (or NaN to flag a bad entry). */
function parseNum(s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

export default function QuoteSubmit() {
  const { id } = useParams()
  const { company, role } = useSession()
  const c = useDoc('cases', id)
  const quotes = useCollection('quotes')
  const companies = useCollection('companies')
  const back = { to: id ? paths.case(id) : paths.me(), label: '回案件進度' }

  if (company === undefined || c === undefined || quotes === undefined || companies === undefined) {
    return (
      <>
        <PageHeader title="提交報價" back={back} />
        <SkeletonList rows={3} />
      </>
    )
  }
  if (!company || !role) {
    return (
      <>
        <PageHeader title="提交報價" back={{ to: paths.home(), label: '回首頁' }} />
        <EmptyState
          icon={<LogIn className="size-8" aria-hidden />}
          title="請先以廠商身分登入"
          body="按右上角「示範登入」選一家廠商，或登錄你的公司。"
          action={<ButtonLink to={paths.register('vendor')}>登錄廠商</ButtonLink>}
        />
      </>
    )
  }
  if (!c) {
    return (
      <>
        <PageHeader title="提交報價" back={{ to: paths.me(), label: '回我的' }} />
        <EmptyState title="找不到這個案件" body="連結可能有誤。回「我的」看你的案件列表。" action={<ButtonLink to={paths.me()}>回我的</ButtonLink>} />
      </>
    )
  }
  const allowed = role === 'vendor' && c.shortlist.includes(company.id) && c.stage === 'quote' && c.status === 'active'
  if (!allowed) {
    const why =
      role !== 'vendor'
        ? '只有受邀的廠商可以提交報價，工廠請到案件頁查看報價。'
        : !c.shortlist.includes(company.id)
          ? '你不在這個案件邀請的廠商名單內。'
          : `案件目前在「${STAGE_BY_KEY[c.stage].label}」階段，只有「方案與報價」階段可以提交。`
    return (
      <>
        <PageHeader title="提交報價" back={back} />
        <EmptyState
          icon={<Lock className="size-8" aria-hidden />}
          title="目前不能提交報價"
          body={why}
          action={<ButtonLink to={paths.case(c.id)}>回案件進度</ButtonLink>}
        />
      </>
    )
  }
  const mine = quotes.find((q) => q.caseId === c.id && q.vendorId === company.id) ?? null
  const factoryName = companies.find((x) => x.id === c.factoryId)?.name
  return (
    <>
      <PageHeader
        title={mine ? '更新報價' : '提交報價'}
        description={`${c.title}${factoryName ? `・${factoryName}` : ''}`}
        breadcrumbs={[{ label: '我的', to: paths.me() }, { label: c.title, to: paths.case(c.id) }, { label: mine ? '更新報價' : '提交報價' }]}
        back={{ to: paths.case(c.id), label: '回案件進度' }}
      />
      <QuoteForm caseId={c.id} vendorId={company.id} vendorName={company.name} mine={mine} />
    </>
  )
}

function QuoteForm({ caseId, vendorId, vendorName, mine }: { caseId: string; vendorId: string; vendorName: string; mine: Quote | null }) {
  const store = useStore()
  const { readOnly } = useStoreInfo()
  const toast = useToast()
  const navigate = useNavigate()
  const caseDoc = useDoc('cases', caseId)

  const [rawText, setRawText] = useState(mine?.rawText ?? '')
  const [nums, setNums] = useState<Record<NumKey, string>>(() => {
    const d = { ...(mine?.rawText ? extractFromRawText(mine.rawText) : {}), ...mine?.declared }
    return Object.fromEntries(NUM_FIELDS.map((f) => [f.key, d?.[f.key] != null ? String(d[f.key]) : ''])) as Record<NumKey, string>
  })
  const [baseline, setBaseline] = useState(() => mine?.declared?.baseline ?? (mine?.rawText ? (extractFromRawText(mine.rawText).baseline ?? '') : ''))
  const [equipmentModel, setEquipmentModel] = useState(() => {
    const std = mine?.rawText ? extractStandardQuoteFields(mine.rawText) : {}
    return mine?.declared?.equipmentModel ?? std.equipmentModel ?? ''
  })
  const [ratedKw, setRatedKw] = useState(() => {
    const std = mine?.rawText ? extractStandardQuoteFields(mine.rawText) : {}
    const val = mine?.declared?.ratedKw ?? std.ratedKw
    return val != null ? String(val) : ''
  })
  const [efficiencyGrade, setEfficiencyGrade] = useState(() => {
    const std = mine?.rawText ? extractStandardQuoteFields(mine.rawText) : {}
    return mine?.declared?.efficiencyGrade ?? std.efficiencyGrade ?? ''
  })
  const [subsidyRegistered, setSubsidyRegistered] = useState<'' | 'yes' | 'no'>(() => {
    const std = mine?.rawText ? extractStandardQuoteFields(mine.rawText) : {}
    const v = mine?.declared?.subsidyRegistered ?? std.subsidyRegistered
    return v === true ? 'yes' : v === false ? 'no' : ''
  })
  const [savingsBasis, setSavingsBasis] = useState<'' | 'metered' | 'assumed'>(() => {
    const std = mine?.rawText ? extractStandardQuoteFields(mine.rawText) : {}
    const v = mine?.declared?.savingsBasis ?? std.savingsBasis
    return v === 'metered' || v === 'assumed' ? v : ''
  })
  const [mvMethod, setMvMethod] = useState(() => {
    const std = mine?.rawText ? extractStandardQuoteFields(mine.rawText) : {}
    return mine?.declared?.mvMethod ?? std.mvMethod ?? ''
  })
  const [validityDays, setValidityDays] = useState(() => (mine?.rawText ? (extractCommercialTerms(mine.rawText).validityDays ?? '') : ''))
  const [paymentTerms, setPaymentTerms] = useState(() => (mine?.rawText ? (extractCommercialTerms(mine.rawText).paymentTerms ?? '') : ''))
  const [downtimeDays, setDowntimeDays] = useState(() => (mine?.rawText ? (extractCommercialTerms(mine.rawText).downtimeDays ?? '') : ''))
  const [errors, setErrors] = useState<Partial<Record<NumKey | 'rawText', string>>>({})
  const [busy, setBusy] = useState(false)

  // The quote may arrive after first render (shared store); fill the form once.
  const [filled, setFilled] = useState(!!mine)
  useEffect(() => {
    if (!mine || filled) return
    const d = { ...extractFromRawText(mine.rawText), ...mine.declared }
    const std = { ...extractStandardQuoteFields(mine.rawText), ...mine.declared }
    const comm = extractCommercialTerms(mine.rawText)
    setRawText(mine.rawText)
    setBaseline(d.baseline ?? '')
    setEquipmentModel(std.equipmentModel ?? '')
    setRatedKw(std.ratedKw != null ? String(std.ratedKw) : '')
    setEfficiencyGrade(std.efficiencyGrade ?? '')
    setSubsidyRegistered(std.subsidyRegistered === true ? 'yes' : std.subsidyRegistered === false ? 'no' : '')
    setSavingsBasis(std.savingsBasis === 'metered' || std.savingsBasis === 'assumed' ? std.savingsBasis : '')
    setMvMethod(std.mvMethod ?? '')
    setValidityDays(comm.validityDays ?? '')
    setPaymentTerms(comm.paymentTerms ?? '')
    setDowntimeDays(comm.downtimeDays ?? '')
    setNums(Object.fromEntries(NUM_FIELDS.map((f) => [f.key, d[f.key] != null ? String(d[f.key]) : ''])) as Record<NumKey, string>)
    setFilled(true)
  }, [mine, filled])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!caseDoc) return
    const next: typeof errors = {}
    if (!rawText.trim()) next.rawText = '請貼上或寫下報價內容'
    const declared: Partial<QuoteFields> = {}
    for (const f of NUM_FIELDS) {
      const n = parseNum(nums[f.key])
      if (n !== null && (Number.isNaN(n) || n < 0)) next[f.key] = `${f.label}請填入 0 以上的數字`
      else if (n !== null) declared[f.key] = n
    }
    if (baseline.trim()) declared.baseline = baseline.trim()
    if (equipmentModel.trim()) declared.equipmentModel = equipmentModel.trim()
    const kwVal = parseNum(ratedKw)
    if (kwVal !== null && Number.isFinite(kwVal) && kwVal >= 0) declared.ratedKw = kwVal
    if (efficiencyGrade.trim()) declared.efficiencyGrade = efficiencyGrade.trim()
    if (subsidyRegistered === 'yes') declared.subsidyRegistered = true
    else if (subsidyRegistered === 'no') declared.subsidyRegistered = false
    if (savingsBasis === 'metered' || savingsBasis === 'assumed') declared.savingsBasis = savingsBasis
    if (mvMethod.trim()) declared.mvMethod = mvMethod.trim()
    setErrors(next)
    if (Object.keys(next).length) return

    const r = transition(caseDoc, { type: 'submit_quote', updated: !!mine }, { role: 'vendor', id: vendorId }, { nameOf: () => vendorName })
    if (isError(r)) {
      toast({ title: r.error, tone: 'error' })
      return
    }
    setBusy(true)
    try {
      const commercialNotes = [
        validityDays.trim() ? `報價有效天數：${validityDays.trim()} 天` : '',
        paymentTerms.trim() ? `付款條件：${paymentTerms.trim()}` : '',
        downtimeDays.trim() ? `預估停機施工天數：${downtimeDays.trim()} 天` : '',
      ].filter(Boolean)
      const finalRawText =
        commercialNotes.length > 0 && !rawText.includes('[商務條件補充]')
          ? `${rawText.trim()}\n\n[商務條件補充] ${commercialNotes.join('｜')}`
          : rawText.trim()
      const quote: Quote = {
        id: mine?.id ?? store.newId('q'),
        caseId,
        vendorId,
        rawText: finalRawText,
        declared,
        submittedAt: nowIso(),
        ...(mine?.isDemo ? { isDemo: true } : {}),
      }
      await store.set('quotes', quote)
      await store.update('cases', caseId, r.patch)
      await store.set('caseEvents', { id: store.newId('ev'), ...r.event })
      toast({ title: mine ? '已更新報價' : '已提交報價' })
      navigate(paths.case(caseId))
    } catch (err) {
      toast({ title: '儲存失敗', body: err instanceof Error ? err.message : '請稍後再試。', tone: 'error' })
      setBusy(false)
    }
  }

  const locked = readOnly

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <Card className="flex flex-col gap-4">
        <Field label="報價內容" required error={errors.rawText} hint="可直接貼上原本格式的報價單，不用改格式；AI 會幫工廠統一整理。">
          {(f) => <TextArea {...f} rows={10} value={rawText} onChange={(e) => setRawText(e.target.value)} disabled={locked} placeholder="例：三台 37kW 變頻空壓機，含安裝與試車，設備費…" />}
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-ink">重點數字（已自動從報價單擷取，可微調）</h2>
            <p className="text-sm text-muted">金額請填未稅新台幣（元），讓工廠與另一家報價在相同未稅基準比較。</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={locked || !rawText.trim()}
            onClick={() => {
              const ex = extractFromRawText(rawText)
              const std = extractStandardQuoteFields(rawText)
              const comm = extractCommercialTerms(rawText)
              setNums((prev) =>
                Object.fromEntries(NUM_FIELDS.map((f) => [f.key, ex[f.key] != null ? String(ex[f.key]) : prev[f.key]])) as Record<NumKey, string>,
              )
              if (ex.baseline) setBaseline(ex.baseline)
              if (std.equipmentModel) setEquipmentModel(std.equipmentModel)
              if (std.ratedKw != null) setRatedKw(String(std.ratedKw))
              if (std.efficiencyGrade) setEfficiencyGrade(std.efficiencyGrade)
              if (std.subsidyRegistered !== undefined && std.subsidyRegistered !== null) {
                setSubsidyRegistered(std.subsidyRegistered ? 'yes' : 'no')
              }
              if (std.savingsBasis) setSavingsBasis(std.savingsBasis)
              if (std.mvMethod) setMvMethod(std.mvMethod)
              if (comm.validityDays) setValidityDays(comm.validityDays)
              if (comm.downtimeDays) setDowntimeDays(comm.downtimeDays)
              if (comm.paymentTerms) setPaymentTerms(comm.paymentTerms)
              toast({ title: '已從報價內容擷取重點數字' })
            }}
          >
            從上方文字重新擷取數字
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {NUM_FIELDS.map((f) => (
            <Field key={f.key} label={`${f.label}（${f.unit}）`} hint={f.hint} error={errors[f.key]}>
              {(p) => (
                <TextInput {...p} type="number" inputMode="decimal" min={0} value={nums[f.key]} onChange={(e) => setNums({ ...nums, [f.key]: e.target.value })} disabled={locked} />
              )}
            </Field>
          ))}
          <Field label="比較基準期間" hint="節電估算是和哪段期間比，例：2025 年 7–9 月。" className="sm:col-span-2">
            {(p) => <TextInput {...p} value={baseline} onChange={(e) => setBaseline(e.target.value)} disabled={locked} />}
          </Field>
          <Field label="機型型號（標準比較欄）" hint="明確設備型號，方便工廠核對能源署補助產品系統">
            {(p) => <TextInput {...p} placeholder="例：PMV-37 / SAV-37AV" value={equipmentModel} onChange={(e) => setEquipmentModel(e.target.value)} disabled={locked} />}
          </Field>
          <Field label="功率 kW（標準比較欄）" hint="每台或系統額定功率 kW">
            {(p) => <TextInput {...p} type="number" inputMode="decimal" min={0} placeholder="例：37" value={ratedKw} onChange={(e) => setRatedKw(e.target.value)} disabled={locked} />}
          </Field>
          <Field label="效率等級（標準比較欄）" hint="例如 IE4 / 一級能效">
            {(p) => <TextInput {...p} placeholder="例：一級能效 / IE4" value={efficiencyGrade} onChange={(e) => setEfficiencyGrade(e.target.value)} disabled={locked} />}
          </Field>
          <Field label="是否登錄補助產品（mdss.org.tw）" hint="能源署動力與公用設備補助登錄狀態">
            {(p) => (
              <Select
                {...p}
                value={subsidyRegistered}
                onChange={(e) => setSubsidyRegistered(e.target.value as '' | 'yes' | 'no')}
                disabled={locked}
              >
                <option value="">未確認</option>
                <option value="yes">是，已登錄補助產品系統</option>
                <option value="no">否，未登錄補助產品系統</option>
              </Select>
            )}
          </Field>
          <Field label="節電依據（實測或假設）" hint="進廠掛表實測請選實測，經驗推估請選假設">
            {(p) => (
              <Select
                {...p}
                value={savingsBasis}
                onChange={(e) => setSavingsBasis(e.target.value as '' | 'metered' | 'assumed')}
                disabled={locked}
              >
                <option value="">未說明</option>
                <option value="metered">實測（現場掛表量測風量／電流）</option>
                <option value="assumed">假設／廠商經驗估算</option>
              </Select>
            )}
          </Field>
          <Field label="量測驗證方式（M&V）" hint="完工後如何驗收節電量">
            {(p) => <TextInput {...p} placeholder="例：完工前後各量測 7 天電表與風量" value={mvMethod} onChange={(e) => setMvMethod(e.target.value)} disabled={locked} />}
          </Field>
          <Field label="報價有效天數（選填）" hint="例如 30">
            {(p) => <TextInput {...p} inputMode="numeric" placeholder="如 30 天" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} disabled={locked} />}
          </Field>
          <Field label="預估停機施工天數（選填）" hint="方便工廠安排產線排休">
            {(p) => <TextInput {...p} placeholder="如 週末停機 2 天" value={downtimeDays} onChange={(e) => setDowntimeDays(e.target.value)} disabled={locked} />}
          </Field>
          <Field label="付款條件摘要（選填）" hint="例：訂金 30% / 設備到廠 40% / 驗收 30%" className="sm:col-span-2">
            {(p) => <TextInput {...p} placeholder="例：訂金 30%・交貨 40%・驗收 30%" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} disabled={locked} />}
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" busy={busy} disabled={locked}>
          {mine ? '更新報價' : '送出報價'}
        </Button>
        <ButtonLink to={paths.case(caseId)} variant="secondary">
          取消
        </ButtonLink>
        {locked ? <p className="text-sm text-muted">目前是唯讀模式，無法寫入。</p> : null}
      </div>
    </form>
  )
}
