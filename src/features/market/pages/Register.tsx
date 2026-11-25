import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Compass, Factory as FactoryIcon, Sparkles, Wrench } from 'lucide-react'
import { CITIES, type City } from '../../../core/constants/geo'
import { EQUIPS, EQUIP_INFO, INDUSTRIES, SPECIALTIES, SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { nowIso } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import type { Equip, FactoryFactKey, Specialty } from '../../../core/types'
import { Badge, Button, Card, ChipGroup, Field, PageHeader, Select, TextInput, cx, useToast } from '../../../ui'
import { CompanyForm } from '../components/CompanyForm'
import { buildCompany, emptyDraft, parseRole, type CompanyDraft } from '../lib/companyForm'
import {
  buildInitialCarbonFromQuick,
  buildQuickFactory,
  buildQuickVendor,
  ELECTRICITY_TIERS,
  validateQuickCompany,
} from '../lib/quickRegister'

const equipOptions = EQUIPS.map((e) => ({ value: e, label: EQUIP_INFO[e].label }))
const specialtyOptions = SPECIALTIES.map((s) => ({ value: s, label: SPECIALTY_LABEL[s] }))

export default function Register() {
  const [params, setParams] = useSearchParams()
  const role = parseRole(params.get('role'))
  const isQuick = params.get('mode') === 'quick'
  const store = useStore()
  const { readOnly } = useStoreInfo()
  const { viewerId, signInAs } = useSession()
  const navigate = useNavigate()
  const toast = useToast()

  const quickTry = (companyId: string, to: string) => {
    signInAs(companyId)
    navigate(to)
  }

  const switchMode = (nextMode: 'quick' | 'full', targetRole?: 'factory' | 'vendor') => {
    setParams((prev) => {
      const copy = new URLSearchParams(prev)
      if (targetRole) copy.set('role', targetRole)
      if (nextMode === 'quick') copy.set('mode', 'quick')
      else copy.delete('mode')
      return copy
    })
  }

  if (!role) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="登錄公司"
          description="選擇「從零開始 30 秒快速建立」自己的乾淨工作台，或使用示範公司一鍵體驗。"
        />
        <Card className="flex flex-col gap-3 border-brand bg-brand-soft" aria-label="從零開始建立空白公司">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">不使用範本資料</Badge>
            <h2 className="font-display text-base font-bold text-brand-strong">30 秒從零建立我的專屬工作台</h2>
          </div>
          <p className="text-sm text-ink-soft">
            只想用自己工廠或廠商的真實數據？只要填寫公司名稱、縣市、規模與主要設備／專長，立刻啟用乾淨工作台與碳排即時試算。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={<Sparkles className="size-4" aria-hidden />}
              onClick={() => navigate(`${paths.register('factory')}&mode=quick`)}
            >
              快速建立空白工廠（30 秒）
            </Button>
            <Button
              size="sm"
              variant="navy"
              icon={<Wrench className="size-4" aria-hidden />}
              onClick={() => navigate(`${paths.register('vendor')}&mode=quick`)}
            >
              快速建立節能廠商（30 秒）
            </Button>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <RoleCard
            to={paths.register('factory')}
            icon={<FactoryIcon className="size-6" aria-hidden />}
            title="我是工廠（完整 3 步驟登錄）"
            body="填寫完整廠區資料、契約容量與設備清單，讓補助試算更精準。"
          />
          <RoleCard
            to={paths.register('vendor')}
            icon={<Wrench className="size-6" aria-hidden />}
            title="我是節能廠商（完整 3 步驟登錄）"
            body="建立服務專長、認證與實績案例，瀏覽工廠需求並表達興趣。"
          />
        </div>

        <Card className="flex flex-wrap items-center justify-between gap-3 bg-sunken">
          <div className="flex items-center gap-2 text-sm text-ink-soft">
            <Compass className="size-4 shrink-0 text-brand-strong" aria-hidden />
            <span className="font-medium">只想先逛逛示範環境？可免填表一鍵體驗：</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => quickTry('f01', paths.newNeed())}>
              以示範工廠試用（永豐金屬）
            </Button>
            <Button size="sm" variant="secondary" onClick={() => quickTry('v01', paths.needs())}>
              以示範廠商試用（綠能節電）
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  async function submitFull(draft: CompanyDraft, confirmedFactKeys?: FactoryFactKey[]) {
    if (!role) return
    try {
      const id = store.newId(role === 'factory' ? 'f' : 'v')
      await store.set('companies', buildCompany(draft, role, { id, now: nowIso(), ownerId: viewerId, confirmedFactKeys }))
      signInAs(id)
      toast({
        title: '已完成登錄',
        body: role === 'factory' ? '接著用口語描述貴廠的節能需求' : '接著瀏覽開放中的工廠需求',
        tone: 'success',
      })
      navigate(role === 'factory' ? paths.newNeed() : paths.needs())
    } catch {
      toast({ title: '沒有登錄成功', body: '資料沒有儲存，請稍後再按一次「完成登錄」。', tone: 'error' })
    }
  }

  return (
    <div>
      <PageHeader
        title={isQuick ? (role === 'factory' ? '30 秒建立我的空白工廠' : '30 秒建立我的節能廠商') : role === 'factory' ? '登錄工廠' : '登錄節能廠商'}
        description={
          isQuick
            ? '不使用範本資料：填寫規模、電費區間與主要項目，立即啟用乾淨專屬工作台。'
            : role === 'factory'
              ? '填完基本資料，就能登記節能需求。'
              : '填完資料，工廠就能在名錄找到你。'
        }
        back={{ to: paths.register(), label: '重新選擇身分' }}
      />
      <Card className="mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 border-brand bg-brand-soft">
        <span className="text-sm font-medium text-brand-strong">
          {isQuick ? '需要一次填寫統一編號、聯絡電話與歷史實績？' : '想先 30 秒快速建立空白工作台（不填繁瑣欄位、不使用示範資料）？'}
        </span>
        <Button size="sm" variant="secondary" onClick={() => switchMode(isQuick ? 'full' : 'quick')}>
          {isQuick ? '改用完整 3 步驟表單' : '切換至 30 秒快速精靈'}
        </Button>
      </Card>

      {isQuick ? (
        <QuickWizard role={role} readOnly={readOnly} />
      ) : (
        <Card className="max-w-3xl">
          <CompanyForm
            key={role}
            role={role}
            initial={emptyDraft()}
            stepped
            submitLabel="完成登錄"
            readOnly={readOnly}
            readOnlyReason="目前是唯讀模式，無法儲存新公司。請在可編輯的環境登錄。"
            onSubmit={submitFull}
          />
        </Card>
      )}
    </div>
  )
}

function QuickWizard({ role, readOnly }: { role: 'factory' | 'vendor'; readOnly: boolean }) {
  const store = useStore()
  const { viewerId, signInAs } = useSession()
  const navigate = useNavigate()
  const toast = useToast()

  const [name, setName] = useState('')
  const [city, setCity] = useState<City | ''>('')
  const [employees, setEmployees] = useState('')
  const [industry, setIndustry] = useState<string>(INDUSTRIES[0])
  const [tierKey, setTierKey] = useState('')
  const [customKwh, setCustomKwh] = useState('')
  const [equips, setEquips] = useState<Equip[]>(['air_compressor'])
  const [specialties, setSpecialties] = useState<Specialty[]>(['air_compressor'])
  const [assistsSubsidy, setAssistsSubsidy] = useState(true)
  const [errors, setErrors] = useState<Partial<Record<'name' | 'city' | 'employees' | 'items', string>>>({})
  const [busy, setBusy] = useState(false)

  async function submitQuick(e: React.FormEvent) {
    e.preventDefault()
    const input = {
      role,
      name,
      city,
      employees: Number(employees),
      industry,
      electricityTierKey: tierKey,
      customMonthlyKwh: customKwh,
      equips,
      specialties,
      assistsSubsidy,
    }
    const errs = validateQuickCompany(input)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setBusy(true)
    try {
      const now = nowIso()
      const id = store.newId(role === 'factory' ? 'f' : 'v')
      if (role === 'factory') {
        const company = buildQuickFactory(input, { id, now, ownerId: viewerId })
        await store.set('companies', company)
        const inv = buildInitialCarbonFromQuick(id, company.factory.monthlyKwh ?? null, equips, now)
        if (inv) await store.set('carbon', inv)
      } else {
        const company = buildQuickVendor(input, { id, now, ownerId: viewerId })
        await store.set('companies', company)
      }
      signInAs(id)
      toast({
        title: '已建立專屬空白工作台',
        body: role === 'factory' ? '已同步初始化年度碳排試算，無任何示範假資料' : '可立即瀏覽開放中的工廠需求',
        tone: 'success',
      })
      navigate(paths.me())
    } catch {
      toast({ title: '建立失敗，請稍後再試一次', tone: 'error' })
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-3xl">
      <form className="flex flex-col gap-5" noValidate onSubmit={(e) => void submitQuick(e)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="公司名稱" required error={errors.name}>
            {(p) => <TextInput {...p} placeholder={role === 'factory' ? '例如：明光精密工業' : '例如：智節科技工程'} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="所在縣市" required error={errors.city}>
            {(p) => (
              <Select {...p} value={city} onChange={(e) => setCity(e.target.value as City | '')}>
                <option value="">請選擇縣市</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="員工人數（用於判定廠區規模）" required error={errors.employees}>
            {(p) => <TextInput {...p} inputMode="numeric" value={employees} onChange={(e) => setEmployees(e.target.value)} className="tabular font-mono" />}
          </Field>
          {role === 'factory' ? (
            <Field label="產業別">
              {(p) => (
                <Select {...p} value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : null}
        </div>

        {role === 'factory' ? (
          <>
            <div className="flex flex-col gap-2">
              <span id="quick-bill-tier" className="text-sm font-medium text-ink">每月電費區間（自動換算預估度數與初始碳盤查）</span>
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-labelledby="quick-bill-tier">
                {ELECTRICITY_TIERS.map((t) => {
                  const active = tierKey === t.key && !customKwh.trim()
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setTierKey(t.key)
                        setCustomKwh('')
                      }}
                      className={cx(
                        'rounded-sm border px-3 py-2 text-left transition-colors',
                        active ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line-strong bg-surface text-ink-soft hover:border-brand',
                      )}
                    >
                      <span className="block text-sm font-semibold">{t.label}</span>
                      <span className="block text-xs text-muted">{t.hint}</span>
                    </button>
                  )
                })}
              </div>
              <Field label="或直接輸入每月平均用電（度，選填）">
                {(p) => <TextInput {...p} inputMode="numeric" placeholder="例如 65000" value={customKwh} onChange={(e) => setCustomKwh(e.target.value)} className="tabular font-mono max-w-xs" />}
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink">
                主要耗能設備 <span className="text-danger">*</span>
              </span>
              <ChipGroup
                label="主要耗能設備"
                value={equips}
                onChange={(v) => setEquips(v as Equip[])}
                options={equipOptions}
              />
              {errors.items ? <p className="text-sm text-danger">{errors.items}</p> : null}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink">
                服務專長 <span className="text-danger">*</span>
              </span>
              <ChipGroup
                label="服務專長"
                value={specialties}
                onChange={(v) => setSpecialties(v as Specialty[])}
                options={specialtyOptions}
              />
              {errors.items ? <p className="text-sm text-danger">{errors.items}</p> : null}
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={assistsSubsidy} onChange={(e) => setAssistsSubsidy(e.target.checked)} className="size-4 accent-brand" />
              <span>可協助工廠申請政府節能補助</span>
            </label>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button type="submit" busy={busy} disabled={readOnly}>
            建立空白工作台並開始使用
          </Button>
          {readOnly ? <span className="text-sm text-muted">目前是唯讀模式，無法建立公司。</span> : null}
        </div>
      </form>
    </Card>
  )
}

function RoleCard({ to, icon, title, body }: { to: string; icon: ReactNode; title: string; body: string }) {
  return (
    <Link to={to} className="group block rounded-md focus-visible:outline-2 focus-visible:outline-brand">
      <Card className="flex h-full flex-col gap-2 transition-colors group-hover:border-brand">
        <span className="text-brand">{icon}</span>
        <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
        <p className="text-ink-soft">{body}</p>
        <span className="mt-1 text-sm font-medium text-brand-strong">開始登錄</span>
      </Card>
    </Link>
  )
}
