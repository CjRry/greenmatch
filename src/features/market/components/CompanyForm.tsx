import { useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { CITIES, CITY_INFO, REGIONS, type City } from '../../../core/constants/geo'
import { EQUIPS, EQUIP_INFO, INDUSTRIES, PRESSURE_LABEL, SCALE_LABEL, SCALE_SHORT, SPECIALTIES, SPECIALTY_LABEL, scaleFromEmployees } from '../../../core/constants/equipment'
import { resolveFactoryFacts } from '../../../core/domain/factoryFacts'
import { formatNumber } from '../../../core/format'
import type { Equip, FactSourceKind, Factory, FactoryFactKey, Pressure, Role, ScaleTier, Specialty } from '../../../core/types'
import { Badge, Button, Card, ChipGroup, FactSourceBadge, Field, Select, TextArea, TextInput, cx } from '../../../ui'
import {
  validateAll,
  validateBasic,
  validateRole,
  type CompanyDraft,
  type DraftErrors,
  type EquipRow,
  type PortfolioRow,
} from '../lib/companyForm'
import { TagListInput } from './TagListInput'

const STEPS = ['基本資料', '專屬資料', '確認送出'] as const

const cityOptions = CITIES.map((c) => ({ value: c, label: c }))
const industryOptions = INDUSTRIES.map((i) => ({ value: i, label: i }))
const pressureOptions = (Object.keys(PRESSURE_LABEL) as Pressure[]).map((p) => ({ value: p, label: PRESSURE_LABEL[p] }))
const specialtyOptions = SPECIALTIES.map((s) => ({ value: s, label: SPECIALTY_LABEL[s] }))
const scaleOptions = (['S', 'M', 'L'] as ScaleTier[]).map((s) => ({ value: s, label: SCALE_LABEL[s] }))

function FieldError({ message }: { message?: string | null }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null
}

function OptionalSection({
  stepped,
  forceOpen,
  summary,
  children,
}: {
  stepped: boolean
  forceOpen: boolean
  summary: string
  children: ReactNode
}) {
  if (!stepped) return <>{children}</>
  return (
    <details open={forceOpen || undefined} className="rounded-md border border-line bg-sunken p-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">{summary}</summary>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </details>
  )
}

function Group({ label, badge, required, error, hint, children }: { label: string; badge?: ReactNode; required?: boolean; error?: string | null; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </span>
        {badge}
      </div>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      {children}
      <FieldError message={error} />
    </div>
  )
}

/**
 * Company form shared by registration (3 steps) and the edit page (one page).
 * The parent validates nothing: onSubmit only runs with a draft that passed validateAll.
 */
export function CompanyForm({
  role,
  initial,
  existingFactory,
  stepped,
  submitLabel,
  readOnly,
  readOnlyReason,
  onSubmit,
  onCancel,
}: {
  role: Role
  initial: CompanyDraft
  existingFactory?: Factory | null
  stepped: boolean
  submitLabel: string
  readOnly: boolean
  readOnlyReason?: string
  onSubmit: (draft: CompanyDraft, confirmedFactKeys?: FactoryFactKey[]) => Promise<void>
  onCancel?: () => void
}) {
  const [d, setD] = useState<CompanyDraft>(initial)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [confirmedKeys, setConfirmedKeys] = useState<FactoryFactKey[]>([])
  const set = <K extends keyof CompanyDraft>(k: K, v: CompanyDraft[K]) => setD((cur) => ({ ...cur, [k]: v }))
  const err = (k: string) => errors[k] ?? null

  const resolvedFacts = role === 'factory' ? resolveFactoryFacts(existingFactory ?? null) : null
  const updateConfirmedKey = (key: FactoryFactKey, active: boolean) => {
    setConfirmedKeys((cur) => {
      if (active) return cur.includes(key) ? cur : [...cur, key]
      return cur.filter((k) => k !== key)
    })
  }
  type NumericFactDraftKey =
    | 'monthlyKwh'
    | 'monthlyElectricBillNtd'
    | 'avgElectricityPriceNtd'
    | 'contractKw'
    | 'dailyHours'
    | 'annualDays'
  const setFactField = (key: NumericFactDraftKey, value: string) => {
    set(key, value)
    updateConfirmedKey(key, value.trim() !== '')
  }
  const factFieldSource = (key: NumericFactDraftKey): FactSourceKind => {
    const val = d[key].trim()
    if (!val) return 'estimate'
    if (confirmedKeys.includes(key)) return 'user'
    if (!existingFactory) return 'user'
    return resolvedFacts?.byKey[key].source ?? 'estimate'
  }
  const factHint = (key: NumericFactDraftKey, defaultHint: string) => {
    const src = factFieldSource(key)
    const note = !d[key].trim() || src === 'estimate' ? resolvedFacts?.byKey[key].note ?? defaultHint : defaultHint
    const canConfirmExisting = Boolean(existingFactory && d[key].trim() && src === 'estimate' && !readOnly)
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <FactSourceBadge source={src} variant="field" />
        <span>{note}</span>
        {canConfirmExisting ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => updateConfirmedKey(key, true)}
          >
            確認這是實際數字 → 轉為你填的
          </Button>
        ) : null}
      </span>
    )
  }
  const equipSource: FactSourceKind = (() => {
    if (d.equipment.length === 0) return 'estimate'
    if (confirmedKeys.includes('equipment')) return 'user'
    if (!existingFactory) return 'user'
    return resolvedFacts?.equipment.source ?? 'estimate'
  })()

  function next() {
    const e = step === 0 ? validateBasic(d, role) : validateRole(d, role)
    setErrors(e)
    if (!Object.keys(e).length) setStep(step + 1)
  }

  async function submit() {
    const e = validateAll(d, role)
    setErrors(e)
    if (Object.keys(e).length) {
      if (stepped) setStep(Object.keys(validateBasic(d, role)).length ? 0 : 1)
      return
    }
    setBusy(true)
    try {
      await onSubmit(d, confirmedKeys)
    } finally {
      setBusy(false)
    }
  }

  const showBasic = !stepped || step === 0
  const showRole = !stepped || step === 1
  const showConfirm = stepped && step === 2
  const errorCount = Object.keys(errors).length
  const hasBasicOptErr = Boolean(err('taxId') || err('district') || err('contactTitle') || err('phone') || err('email'))
  const hasFactoryOptErr = Boolean(
    err('monthlyKwh') ||
      err('monthlyElectricBillNtd') ||
      err('avgElectricityPriceNtd') ||
      err('contractKw') ||
      err('dailyHours') ||
      err('annualDays') ||
      Object.keys(errors).some((k) => k.startsWith('equipment.')),
  )
  const employees = Number(d.employees.trim())
  const scale = /^\d+$/.test(d.employees.trim()) && employees > 0 ? scaleFromEmployees(employees) : null

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault()
        if (stepped && step < 2) next()
        else void submit()
      }}
    >
      {stepped ? (
        <ol className="flex gap-2" aria-label="登錄步驟">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? 'step' : undefined}
              className={cx(
                'flex min-w-0 flex-1 items-center gap-2 border-b-2 pb-2 text-sm',
                i === step ? 'border-brand font-bold text-ink' : i < step ? 'border-brand text-ink-soft' : 'border-line text-muted',
              )}
            >
              <span
                className={cx(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  i < step ? 'bg-brand text-on-brand' : i === step ? 'border-2 border-brand text-brand' : 'border border-line-strong',
                )}
              >
                {i < step ? <Check className="size-3" aria-hidden /> : i + 1}
              </span>
              <span className="truncate">{s}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {errorCount ? (
        <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">
          有 {errorCount} 個欄位需要修正，請看各欄位下方的紅字說明。
        </p>
      ) : null}

      {showBasic ? (
        <section className="flex flex-col gap-4" aria-label="基本資料">
          {!stepped ? <h2 className="font-display text-lg font-bold text-ink">基本資料</h2> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="公司名稱" required error={err('name')}>
              {(p) => <TextInput {...p} value={d.name} onChange={(e) => set('name', e.target.value)} autoComplete="organization" />}
            </Field>
            <Field label="縣市" required error={err('city')}>
              {(p) => (
                <Select {...p} value={d.city} onChange={(e) => set('city', e.target.value as City | '')}>
                  <option value="">請選擇縣市</option>
                  {cityOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="聯絡人"
              required={role !== 'factory'}
              hint={role === 'factory' ? '選填，廠商報價時會看到' : undefined}
              error={err('contactName')}
            >
              {(p) => <TextInput {...p} value={d.contactName} onChange={(e) => set('contactName', e.target.value)} autoComplete="name" />}
            </Field>
          </div>
          <Field
            label="公司簡介"
            required={role !== 'factory'}
            hint={role === 'factory' ? '選填。一兩句話：做什麼、規模或特色' : '一兩句話：做什麼、規模或特色'}
            error={err('intro')}
          >
            {(p) => <TextArea {...p} rows={3} value={d.intro} onChange={(e) => set('intro', e.target.value)} />}
          </Field>
          <OptionalSection stepped={stepped} forceOpen={hasBasicOptErr} summary="進階聯絡與統編資訊（選填，可登錄後再補）">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="統一編號" hint="8 位數字，可不填" error={err('taxId')}>
                {(p) => <TextInput {...p} value={d.taxId} inputMode="numeric" maxLength={8} onChange={(e) => set('taxId', e.target.value)} />}
              </Field>
              <Field label="區" hint="例如：安南區" error={err('district')}>
                {(p) => <TextInput {...p} value={d.district} onChange={(e) => set('district', e.target.value)} />}
              </Field>
              <Field label="職稱" error={err('contactTitle')}>
                {(p) => <TextInput {...p} value={d.contactTitle} onChange={(e) => set('contactTitle', e.target.value)} />}
              </Field>
              <Field label="電話" error={err('phone')}>
                {(p) => <TextInput {...p} type="tel" value={d.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" />}
              </Field>
              <Field label="Email" error={err('email')}>
                {(p) => <TextInput {...p} type="email" value={d.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />}
              </Field>
            </div>
          </OptionalSection>
        </section>
      ) : null}

      {showRole && role === 'factory' ? (
        <section className="flex flex-col gap-4" aria-label="工廠資料">
          {!stepped ? <h2 className="font-display text-lg font-bold text-ink">工廠資料</h2> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="產業" required error={err('industry')}>
              {(p) => (
                <Select {...p} value={d.industry} onChange={(e) => set('industry', e.target.value)}>
                  <option value="">請選擇產業</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="主要產品" hint="選填，例如「汽車螺絲」" error={err('products')}>
              {(p) => <TextInput {...p} value={d.products} onChange={(e) => set('products', e.target.value)} />}
            </Field>
            <Field
              label="員工人數"
              required
              error={err('employees')}
              hint={scale ? `平台會歸為「${SCALE_LABEL[scale]}」` : '填完會自動換算工廠規模'}
            >
              {(p) => <TextInput {...p} inputMode="numeric" value={d.employees} onChange={(e) => set('employees', e.target.value)} />}
            </Field>
          </div>
          <Group label="推動減碳的原因" required error={err('pressures')} hint="可複選，至少 1 項">
            <ChipGroup label="推動減碳的原因" options={pressureOptions} value={d.pressures} onChange={(v) => set('pressures', v)} />
          </Group>
          <OptionalSection stepped={stepped} forceOpen={hasFactoryOptErr} summary="用電度數、電費、運轉時數、補助資格與設備清單（選填，可登錄後再補）">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="平均每月用電度數" hint={factHint('monthlyKwh', '看電費單的「度」，可不填')} error={err('monthlyKwh')}>
                {(p) => <TextInput {...p} inputMode="decimal" placeholder="例如 45000" value={d.monthlyKwh} onChange={(e) => setFactField('monthlyKwh', e.target.value)} />}
              </Field>
              <Field label="每月電費（元，選填）" hint={factHint('monthlyElectricBillNtd', '沒有度數時，可填電費金額換算')} error={err('monthlyElectricBillNtd')}>
                {(p) => <TextInput {...p} inputMode="decimal" placeholder="例如 189000" value={d.monthlyElectricBillNtd} onChange={(e) => setFactField('monthlyElectricBillNtd', e.target.value)} />}
              </Field>
              <Field label="平均電價（元／度，選填）" hint={factHint('avgElectricityPriceNtd', '未填時暫用平台預設 4.2 元／度')} error={err('avgElectricityPriceNtd')}>
                {(p) => <TextInput {...p} inputMode="decimal" placeholder="例如 4.2" value={d.avgElectricityPriceNtd} onChange={(e) => setFactField('avgElectricityPriceNtd', e.target.value)} />}
              </Field>
              <Field label="契約容量（kW，選填）" hint={factHint('contractKw', '用來判斷 ESCO 補助資格（須 100 kW 以上）')} error={err('contractKw')}>
                {(p) => <TextInput {...p} inputMode="decimal" placeholder="例如 150" value={d.contractKw} onChange={(e) => setFactField('contractKw', e.target.value)} />}
              </Field>
              <Field label="每日運轉時數（小時，選填）" hint={factHint('dailyHours', '用來試算設備年節電與回本')} error={err('dailyHours')}>
                {(p) => <TextInput {...p} inputMode="decimal" placeholder="例如 16" value={d.dailyHours} onChange={(e) => setFactField('dailyHours', e.target.value)} />}
              </Field>
              <Field label="年運轉天數（天，選填）" hint={factHint('annualDays', '未填時暫用平台預設 300 天')} error={err('annualDays')}>
                {(p) => <TextInput {...p} inputMode="numeric" placeholder="例如 300" value={d.annualDays} onChange={(e) => setFactField('annualDays', e.target.value)} />}
              </Field>
              <Field label="年營業額級距（選填）" hint="影響動力設備補助每年上限（500 萬／1,500 萬）">
                {(p) => (
                  <Select {...p} value={d.revenueOver100M} onChange={(e) => set('revenueOver100M', e.target.value as '' | 'yes' | 'no')}>
                    <option value="">不確定／略過</option>
                    <option value="no">未達 1 億元</option>
                    <option value="yes">1 億元以上</option>
                  </Select>
                )}
              </Field>
              <Field label="是否有工廠登記（選填）" hint="經濟部低碳輔導與查證補助需要工廠登記">
                {(p) => (
                  <Select {...p} value={d.hasFactoryReg} onChange={(e) => set('hasFactoryReg', e.target.value as '' | 'yes' | 'no')}>
                    <option value="">不確定／略過</option>
                    <option value="yes">有工廠登記</option>
                    <option value="no">無工廠登記</option>
                  </Select>
                )}
              </Field>
            </div>
            <Group label="主要客戶" hint="輸入後按 Enter 或「新增」，可加多筆">
              <TagListInput value={d.mainCustomers} onChange={(v) => set('mainCustomers', v)} label="主要客戶" placeholder="例如：國內汽車零件供應商" />
            </Group>
            <Group
              label="主要設備清單"
              badge={<FactSourceBadge source={equipSource} variant="field" />}
              hint={
                <span className="flex flex-wrap items-center gap-1.5">
                  <span>
                    {d.equipment.length === 0
                      ? resolvedFacts?.equipment.note ?? '有填的話，推薦與熱點估算會更準；可不填'
                      : '每項設備可填台數、額定 kW、啟用年份與每日運轉時數'}
                  </span>
                  {existingFactory && d.equipment.length > 0 && equipSource === 'estimate' && !readOnly ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => updateConfirmedKey('equipment', true)}
                    >
                      確認這是實際數字 → 轉為你填的
                    </Button>
                  ) : null}
                </span>
              }
            >
              <EquipmentRows
                rows={d.equipment}
                onChange={(v) => {
                  set('equipment', v)
                  // Editing one row doesn't confirm the others (OBS-0004 §2-2): buildCompany marks the
                  // rows the factory changed as 'user'; only the confirm button upgrades the whole list.
                  if (v.length === 0) updateConfirmedKey('equipment', false)
                }}
                errors={errors}
              />
            </Group>
          </OptionalSection>
        </section>
      ) : null}

      {showRole && role === 'vendor' ? (
        <section className="flex flex-col gap-4" aria-label="廠商資料">
          {!stepped ? <h2 className="font-display text-lg font-bold text-ink">廠商資料</h2> : null}
          <Field label="一句話介紹" required hint="工廠在名錄第一眼看到的文字" error={err('tagline')}>
            {(p) => <TextInput {...p} value={d.tagline} onChange={(e) => set('tagline', e.target.value)} />}
          </Field>
          <Group label="服務項目" required error={err('specialties')} hint="可複選，至少 1 項">
            <ChipGroup label="服務項目" options={specialtyOptions} value={d.specialties} onChange={(v: Specialty[]) => set('specialties', v)} />
          </Group>
          <Group label="服務縣市" required error={err('serviceCities')} hint="可一鍵選整區，至少 1 個縣市">
            <CityPicker value={d.serviceCities} onChange={(v) => set('serviceCities', v)} />
          </Group>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="成立年份" required error={err('foundedYear')} hint="西元年，例如 2008">
              {(p) => <TextInput {...p} inputMode="numeric" maxLength={4} value={d.foundedYear} onChange={(e) => set('foundedYear', e.target.value)} />}
            </Field>
            <Field label="員工人數" required error={err('employees')}>
              {(p) => <TextInput {...p} inputMode="numeric" value={d.employees} onChange={(e) => set('employees', e.target.value)} />}
            </Field>
            <Field label="完成案件數" hint="可不填" error={err('completedCases')}>
              {(p) => <TextInput {...p} inputMode="numeric" value={d.completedCases} onChange={(e) => set('completedCases', e.target.value)} />}
            </Field>
            <Field label="平均回覆時間（小時）" hint="可不填；未填時顯示 24 小時" error={err('responseHours')}>
              {(p) => <TextInput {...p} inputMode="decimal" value={d.responseHours} onChange={(e) => set('responseHours', e.target.value)} />}
            </Field>
          </div>
          <Group label="適合的客戶規模" required error={err('sizeFit')} hint="可複選">
            <ChipGroup label="適合的客戶規模" options={scaleOptions} value={d.sizeFit} onChange={(v) => set('sizeFit', v)} />
          </Group>
          <Group label="曾合作產業（同業經驗）" hint="可複選；工廠在瀏覽與媒合時會優先看見有同業經驗的廠商">
            <ChipGroup label="曾合作產業" options={industryOptions} value={d.servedIndustries} onChange={(v) => set('servedIndustries', v)} />
          </Group>
          <Group label="認證" hint="例如 ISO 50001、能源技術服務業登記，可加多筆">
            <TagListInput value={d.certifications} onChange={(v) => set('certifications', v)} label="認證" placeholder="輸入認證名稱" />
          </Group>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-4 accent-brand"
              checked={d.assistsSubsidy}
              onChange={(e) => set('assistsSubsidy', e.target.checked)}
            />
            <span>可協助工廠申請政府節能補助（選填）</span>
          </label>
          <Group label="實績案例" hint="可不填；有實績更容易被工廠看見">
            <PortfolioRows rows={d.portfolio} onChange={(v) => set('portfolio', v)} errors={errors} />
          </Group>
        </section>
      ) : null}

      {showConfirm ? <Summary d={d} role={role} /> : null}

      {readOnly && (!stepped || step === 2) ? (
        <p className="rounded-sm bg-warn-soft px-3 py-2 text-sm text-warn">{readOnlyReason ?? '目前是唯讀模式，資料無法儲存。'}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {stepped && step > 0 ? (
            <Button variant="ghost" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => setStep(step - 1)}>
              上一步
            </Button>
          ) : onCancel ? (
            <Button variant="ghost" onClick={onCancel}>
              取消
            </Button>
          ) : null}
        </div>
        {stepped && step < 2 ? (
          <Button type="submit" icon={<ArrowRight className="size-4" aria-hidden />}>
            下一步
          </Button>
        ) : (
          <Button type="submit" busy={busy} disabled={readOnly}>
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  )
}

function CityPicker({ value, onChange }: { value: readonly City[]; onChange: (v: City[]) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {REGIONS.map((region) => {
        const cities = CITIES.filter((c) => CITY_INFO[c].region === region)
        const all = cities.every((c) => value.includes(c))
        return (
          <div key={region} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink-soft">{region}</span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={all ? `取消選取${region}全部縣市` : `選取${region}全部縣市`}
                onClick={() => onChange(all ? value.filter((c) => !cities.includes(c)) : Array.from(new Set([...value, ...cities])))}
              >
                {all ? '取消整區' : '選整區'}
              </Button>
            </div>
            <ChipGroup label={`${region}服務縣市`} options={cities.map((c) => ({ value: c, label: c }))} value={value} onChange={(picked) => {
              const others = value.filter((c) => !cities.includes(c))
              onChange([...others, ...picked.filter((c) => cities.includes(c))])
            }} />
          </div>
        )
      })}
    </div>
  )
}

function EquipmentRows({ rows, onChange, errors }: { rows: EquipRow[]; onChange: (v: EquipRow[]) => void; errors: DraftErrors }) {
  const patch = (i: number, p: Partial<EquipRow>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, estimated: false, ...p } : r)))
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-sm border border-line p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          <Field label="設備類型" error={errors[`equipment.${i}.type`]} className="col-span-1">
            {(p) => (
              <Select {...p} value={r.type} onChange={(e) => patch(i, { type: e.target.value as Equip | '' })}>
                <option value="">請選擇</option>
                {EQUIPS.map((e) => (
                  <option key={e} value={e}>
                    {EQUIP_INFO[e].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button variant="ghost" className="mt-6 sm:order-last" aria-label={`刪除第 ${i + 1} 列設備`} icon={<Trash2 className="size-4" aria-hidden />} onClick={() => onChange(rows.filter((_, j) => j !== i))} />
          <Field
            label="數量"
            hint={r.estimated ? '平台暫填，請改成實際台數' : undefined}
            error={errors[`equipment.${i}.quantity`]}
          >
            {(p) => <TextInput {...p} inputMode="numeric" value={r.quantity} onChange={(e) => patch(i, { quantity: e.target.value, estimated: false })} />}
          </Field>
          <Field label="每台 kW（選填）" error={errors[`equipment.${i}.kw`]}>
            {(p) => <TextInput {...p} inputMode="decimal" placeholder="例如 37" value={r.kw ?? ''} onChange={(e) => patch(i, { kw: e.target.value })} />}
          </Field>
          <Field label="啟用年份" error={errors[`equipment.${i}.year`]}>
            {(p) => <TextInput {...p} inputMode="numeric" maxLength={4} value={r.year} placeholder="例如 2012" onChange={(e) => patch(i, { year: e.target.value })} />}
          </Field>
          <Field label="每日運轉（小時，選填）" error={errors[`equipment.${i}.dailyHours`]}>
            {(p) => <TextInput {...p} inputMode="decimal" placeholder="例如 16" value={r.dailyHours ?? ''} onChange={(e) => patch(i, { dailyHours: e.target.value })} />}
          </Field>
        </div>
      ))}
      <div>
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => onChange([...rows, { type: '', quantity: '', year: '', kw: '', dailyHours: '' }])}>
          新增設備
        </Button>
      </div>
    </div>
  )
}

function PortfolioRows({ rows, onChange, errors }: { rows: PortfolioRow[]; onChange: (v: PortfolioRow[]) => void; errors: DraftErrors }) {
  const patch = (i: number, p: Partial<PortfolioRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)))
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 rounded-sm border border-line p-3 sm:grid-cols-2">
          <Field label="案例名稱" error={errors[`portfolio.${i}.title`]}>
            {(p) => <TextInput {...p} value={r.title} onChange={(e) => patch(i, { title: e.target.value })} />}
          </Field>
          <Field label="客戶產業" hint="選填；可提高同業媒合曝光" error={errors[`portfolio.${i}.industry`]}>
            {(p) => (
              <Select {...p} value={r.industry ?? ''} onChange={(e) => patch(i, { industry: e.target.value })}>
                <option value="">未指定</option>
                {industryOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="縣市" error={errors[`portfolio.${i}.city`]}>
            {(p) => (
              <Select {...p} value={r.city} onChange={(e) => patch(i, { city: e.target.value as City | '' })}>
                <option value="">請選擇</option>
                {cityOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="項目" error={errors[`portfolio.${i}.equip`]}>
            {(p) => (
              <Select {...p} value={r.equip} onChange={(e) => patch(i, { equip: e.target.value as Specialty | '' })}>
                <option value="">請選擇</option>
                {specialtyOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="節電 %" hint="可不填" error={errors[`portfolio.${i}.savingPct`]}>
            {(p) => <TextInput {...p} inputMode="decimal" value={r.savingPct} onChange={(e) => patch(i, { savingPct: e.target.value })} />}
          </Field>
          <Field label="年份" error={errors[`portfolio.${i}.year`]}>
            {(p) => <TextInput {...p} inputMode="numeric" maxLength={4} value={r.year} onChange={(e) => patch(i, { year: e.target.value })} />}
          </Field>
          <div className="sm:col-span-2">
            <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              刪除這筆案例
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => onChange([...rows, { title: '', industry: '', city: '', equip: '', savingPct: '', year: '' }])}>
          新增實績案例
        </Button>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-ink [overflow-wrap:anywhere]">{children || '—'}</dd>
    </div>
  )
}

function Summary({ d, role }: { d: CompanyDraft; role: Role }) {
  const n = Number(d.employees)
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-bold text-ink">請確認以下資料</h2>
        <Badge tone="navy">{role === 'factory' ? '工廠' : '節能廠商'}</Badge>
      </div>
      <dl className="flex flex-col gap-2">
        <Row label="公司名稱">{d.name}</Row>
        <Row label="所在地">{`${d.city}${d.district}`}</Row>
        <Row label="聯絡人">{[d.contactName, d.contactTitle].filter(Boolean).join('　') || '尚未填寫'}</Row>
        <Row label="電話／Email">{[d.phone, d.email].filter(Boolean).join('　')}</Row>
        <Row label="公司簡介">{d.intro || '尚未填寫'}</Row>
        {role === 'factory' ? (
          <>
            <Row label="產業">{d.industry}</Row>
            <Row label="主要產品">{d.products || '尚未填寫'}</Row>
            <Row label="員工人數">{`${formatNumber(n)} 人（${SCALE_SHORT[scaleFromEmployees(n)]}工廠）`}</Row>
            {d.contractKw.trim() ? <Row label="契約容量">{`${d.contractKw.trim()} kW`}</Row> : null}
            <Row label="推動減碳原因">{d.pressures.map((p) => PRESSURE_LABEL[p]).join('、')}</Row>
            <Row label="主要設備">{d.equipment.filter((e) => e.type).map((e) => `${EQUIP_INFO[e.type as Equip].label} ${e.quantity} 台${e.kw ? `（${e.kw} kW）` : ''}`).join('、')}</Row>
          </>
        ) : (
          <>
            <Row label="一句話介紹">{d.tagline}</Row>
            <Row label="服務項目">{d.specialties.map((s) => SPECIALTY_LABEL[s]).join('、')}</Row>
            <Row label="服務縣市">{d.serviceCities.join('、')}</Row>
            <Row label="成立／員工">{`${d.foundedYear} 年成立，${formatNumber(n)} 人`}</Row>
            <Row label="適合規模">{d.sizeFit.map((s) => SCALE_SHORT[s]).join('、')}</Row>
            <Row label="曾合作產業">{d.servedIndustries.length ? d.servedIndustries.join('、') : '—'}</Row>
            <Row label="認證">{d.certifications.join('、')}</Row>
            {d.assistsSubsidy ? <Row label="補助協助">可協助工廠申請政府節能補助</Row> : null}
          </>
        )}
      </dl>
    </Card>
  )
}
