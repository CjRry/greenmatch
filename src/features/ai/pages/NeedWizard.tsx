import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import { askJson, aiAvailable } from '../../../core/ai/askJson'
import { EQUIP_INFO, EQUIPS, SPECIALTIES, SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { buildFactoryFactPatch } from '../../../core/domain/factoryFacts'
import { rankVendors } from '../../../core/domain/matching'
import { nowIso } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection, useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import { hpToKw, matchSubsidies } from '../../../core/subsidies'
import type { Equip, EquipmentItem, NeedForm, NeedItem, Source, Specialty } from '../../../core/types'
import { Badge, Button, ButtonLink, Card, EmptyState, Field, PageHeader, Select, SectionTitle, SkeletonList, SourceTag, SubsidySummaryBar, TextArea, TextInput, useToast } from '../../../ui'
import { guardNeedForm, mentionsCarbonInventory, parseNeed, suggestTitle } from '../lib/needParser'
import { needPrompt } from '../lib/prompts'

const HP_PRESETS = [
  { hp: 20, kw: 15 },
  { hp: 30, kw: 22 },
  { hp: 50, kw: 37 },
  { hp: 75, kw: 55 },
  { hp: 100, kw: 75 },
] as const

const EXAMPLES = [
  '我們工廠空壓機有 3 台，都用了十幾年，最近電費越來越高，夏天冷氣也很耗電',
  '廠區日光燈很舊，想換成 LED，另外客戶要求提供碳排數據，想做碳盤查',
  '鍋爐用了快 20 年，燃料費越來越高，蒸汽管線也常漏',
]

type Step = 1 | 2 | 3

function ListEditor({ label, items, onChange, suggestions, addLabel }: { label: string; items: string[]; onChange: (next: string[]) => void; suggestions?: string[]; addLabel: string }) {
  const [draft, setDraft] = useState('')
  const add = (t: string) => {
    const v = t.trim()
    if (v && !items.includes(v)) onChange([...items, v])
    setDraft('')
  }
  const hints = (suggestions ?? []).filter((s) => !items.includes(s))
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {items.map((t, i) => (
          <li key={`${t}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-sm bg-brand-soft py-1 pl-2.5 pr-1 text-sm text-brand-strong">
            <span className="min-w-0 break-words">{t}</span>
            <button type="button" aria-label={`移除「${t}」`} onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded-sm p-1 hover:bg-surface">
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
        {!items.length ? <li className="text-sm text-muted">尚未填寫</li> : null}
      </ul>
      <div className="flex gap-2">
        <TextInput
          aria-label={addLabel}
          placeholder={addLabel}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(draft)
            }
          }}
        />
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => add(draft)} disabled={!draft.trim()}>
          加入
        </Button>
      </div>
      {hints.length ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>建議：</span>
          {hints.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-sm border border-line-strong px-2 py-0.5 text-ink-soft hover:border-brand">
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function NeedWizard() {
  const { company, role } = useSession()
  const { readOnly } = useStoreInfo()
  const store = useStore()
  const companies = useCollection('companies')
  const reviews = useCollection('reviews')
  const navigate = useNavigate()
  const toast = useToast()

  const [searchParams] = useSearchParams()
  const equipParam = searchParams.get('equip')
  const initialEquipText =
    equipParam && (EQUIPS as readonly string[]).includes(equipParam)
      ? `我們廠區的${EQUIP_INFO[equipParam as Equip].label}用了十幾年，耗電量偏高，想評估節能改善方案與可申請的政府補助`
      : ''

  const [step, setStep] = useState<Step>(1)
  const [text, setText] = useState(initialEquipText)
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [form, setForm] = useState<NeedForm | null>(null)
  const [initialDraft, setInitialDraft] = useState<{ form: NeedForm; title: string } | null>(null)
  const [source, setSource] = useState<Source>('rules')
  const [edited, setEdited] = useState(false)
  const [title, setTitle] = useState('')
  // Until the factory types its own title, the title follows the rows (deleting a row updates it).
  const [titleTouched, setTitleTouched] = useState(false)
  const [syncToFactory, setSyncToFactory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [canAi, setCanAi] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    void aiAvailable().then(
      (ok) => {
        if (alive) setCanAi(ok)
      },
      () => {
        if (alive) setCanAi(false)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  if (company === undefined || companies === undefined || reviews === undefined) {
    return (
      <>
        <PageHeader title="登記節能需求" />
        <SkeletonList rows={2} />
      </>
    )
  }
  if (!company || company.role !== 'factory') {
    return (
      <>
        <PageHeader title="登記節能需求" description="用自己的話描述設備與問題，AI 幫你整理成標準需求表。" />
        <EmptyState
          title={role === 'vendor' ? '節能廠商無法登記需求' : '請先以工廠身分登入'}
          body={role === 'vendor' ? '登記需求是工廠的功能。你可以到需求看板，對有興趣的需求按「我有興趣」。' : '點右上角的「示範登入」選一家工廠，或先註冊工廠帳號。'}
          action={
            role === 'vendor' ? <ButtonLink to={paths.needs()}>前往需求看板</ButtonLink> : <ButtonLink to={paths.register('factory')}>註冊工廠</ButtonLink>
          }
        />
      </>
    )
  }
  const factory = company
  const aiOn = canAi === true

  const patch = (next: NeedForm) => {
    setForm(next)
    setEdited(true)
    if (!titleTouched) setTitle(suggestTitle(next))
  }
  const patchItem = (i: number, p: Partial<NeedItem>) => form && patch({ ...form, items: form.items.map((it, j) => (j === i ? { ...it, ...p } : it)) })

  const organise = async () => {
    if (!text.trim()) return
    setBusy(true)
    let result: NeedForm = parseNeed(text)
    let src: Source = 'rules'
    try {
      if (aiOn) {
        const res = await askJson(needPrompt(text), guardNeedForm, { tier: 'quick' })
        if (res.ok) {
          result = res.value
          src = 'claude'
        }
      }
    } catch {
      // Fallback to native GreenMatch parser silently
    }
    const baseItems: NeedItem[] =
      result.items.length > 0
        ? result.items
        : factory.factory.equipment.map((eq) => {
            const ageYears = eq.yearInstalled != null ? Math.max(0, 2026 - eq.yearInstalled) : null
            return {
              equip: eq.type,
              quantity: eq.quantity > 0 ? eq.quantity : null,
              ...(eq.ratedKw != null ? { ratedKw: eq.ratedKw } : {}),
              ageYears,
              ageText: ageYears != null ? `${ageYears} 年` : null,
              note: eq.dailyHours != null ? `每日運轉約 ${eq.dailyHours} 小時` : null,
            }
          })
    const enrichedItems = baseItems.map((it) => {
      if (it.equip === 'carbon_consulting') return it
      const matchEq = factory.factory.equipment.find((e) => e.type === it.equip)
      if (!matchEq) return it
      const nextQuantity = it.quantity ?? (matchEq.quantity > 0 ? matchEq.quantity : null)
      const nextRatedKw = it.ratedKw ?? matchEq.ratedKw ?? null
      const derivedAgeYears = it.ageYears ?? (matchEq.yearInstalled != null ? Math.max(0, 2026 - matchEq.yearInstalled) : null)
      const derivedAgeText = it.ageText ?? (derivedAgeYears != null ? `${derivedAgeYears} 年` : null)
      const factoryNote =
        it.note ??
        (matchEq.ratedKw != null && it.ratedKw == null
          ? `依貴廠檔案帶入 ${matchEq.ratedKw} kW（約 ${Math.round(matchEq.ratedKw / 0.746)} 馬力）`
          : matchEq.dailyHours != null
            ? `每日運轉約 ${matchEq.dailyHours} 小時`
            : null)
      return {
        ...it,
        quantity: nextQuantity,
        ...(nextRatedKw != null ? { ratedKw: nextRatedKw } : {}),
        ageYears: derivedAgeYears,
        ageText: derivedAgeText,
        note: factoryNote,
      }
    })
    const cleanedQuestions = result.openQuestions.filter((q) => {
      const filledAgeItem = enrichedItems.find((it) => it.equip !== 'carbon_consulting' && it.ageYears != null && q.includes(SPECIALTY_LABEL[it.equip]) && q.includes('幾年'))
      return !filledAgeItem
    })
    const billNtd = result.monthlyElectricBillNtd ?? factory.factory.monthlyElectricBillNtd ?? null
    const finalForm: NeedForm = {
      ...result,
      items: enrichedItems,
      openQuestions: cleanedQuestions,
      ...(billNtd != null && billNtd > 0 ? { monthlyElectricBillNtd: billNtd } : {}),
    }
    const suggested = suggestTitle(finalForm)
    setInitialDraft({ form: finalForm, title: suggested })
    setForm(finalForm)
    setSource(src)
    setEdited(false)
    setTitle(suggested)
    setTitleTouched(false)
    setBusy(false)
    setStep(2)
  }

  const resetToDraft = () => {
    if (!initialDraft) return
    setForm(initialDraft.form)
    setTitle(initialDraft.title)
    setTitleTouched(false)
    setEdited(false)
    toast({ title: '已還原 AI 初稿', tone: 'info' })
  }

  const submitNeed = async () => {
    if (!form || saving) return
    setSaving(true)
    try {
      const now = nowIso()
      const needId = store.newId('n')
      const caseId = store.newId('c')
      const budgetNtd = budget.trim() && Number.isFinite(Number(budget.replace(/,/g, ''))) ? Number(budget.replace(/,/g, '')) : null
      const need = {
        id: needId,
        factoryId: factory.id,
        title: title.trim() || suggestTitle(form),
        rawText: text.trim(),
        form,
        source,
        status: 'open' as const,
        city: factory.city,
        scale: factory.factory.scale,
        budgetNtd,
        timeline: timeline.trim() || null,
        interestedVendorIds: [] as string[],
        caseId,
        confirmedAt: now,
        createdAt: now,
        updatedAt: now,
        isDemo: false,
      }
      const recommendations = rankVendors(need, factory, companies, reviews)
      await store.set('needs', need)
      if (syncToFactory && !readOnly) {
        const equipItems = form.items.filter((it) => it.equip !== 'carbon_consulting')
        const mergedMap = new Map<Equip, EquipmentItem>()
        for (const existing of factory.factory.equipment) mergedMap.set(existing.type, existing)
        for (const it of equipItems) {
          const prev = mergedMap.get(it.equip as Equip)
          const quantity = it.quantity ?? prev?.quantity ?? 1
          mergedMap.set(it.equip as Equip, {
            ...(prev ?? {}),
            type: it.equip as Equip,
            quantity,
            ...(it.ratedKw != null ? { ratedKw: it.ratedKw } : prev?.ratedKw != null ? { ratedKw: prev.ratedKw } : {}),
            ...(it.ageYears != null
              ? { yearInstalled: Math.max(1950, 2026 - it.ageYears) }
              : prev?.yearInstalled != null
                ? { yearInstalled: prev.yearInstalled }
                : {}),
          })
        }
        const mergedEquipment = Array.from(mergedMap.values())
        const hasBill = form.monthlyElectricBillNtd != null && form.monthlyElectricBillNtd > 0
        if (equipItems.length > 0 || hasBill) {
          await store.update(
            'companies',
            factory.id,
            buildFactoryFactPatch(
              factory,
              {
                ...(equipItems.length > 0 ? { equipment: mergedEquipment } : {}),
                ...(hasBill ? { monthlyElectricBillNtd: form.monthlyElectricBillNtd } : {}),
              },
              now,
              {
                notes: {
                  ...(equipItems.length > 0 ? { equipment: '於登記需求確認送出時同步更新' } : {}),
                  ...(hasBill ? { monthlyElectricBillNtd: '於登記需求確認送出時同步更新' } : {}),
                },
              },
            ),
          )
        }
      }
      await store.set('cases', {
        id: caseId,
        needId,
        factoryId: factory.id,
        title: need.title,
        stage: 'assess' as const,
        stageStartedAt: now,
        status: 'active' as const,
        recommendations,
        shortlist: [] as string[],
        createdAt: now,
        updatedAt: now,
        isDemo: false,
      })
      await store.set('caseEvents', {
        id: store.newId('ev'),
        caseId,
        stage: 'register' as const,
        kind: 'stage_done' as const,
        actor: 'factory' as const,
        actorId: factory.id,
        text: `${factory.name}確認並送出需求「${need.title}」`,
        at: now,
      })
      toast({ title: '已送出需求', body: '接著看平台推薦的 2 家廠商', tone: 'success' })
      navigate(paths.caseMatch(caseId))
    } catch {
      toast({ title: '送出需求失敗，資料沒有儲存，請再按一次「確認送出」', tone: 'error' })
      setSaving(false)
    }
  }

  const stepLabels = ['1 描述需求', '2 確認需求表', '3 確認送出']

  return (
    <>
      <PageHeader
        title="登記節能需求"
        description={`用自己的話描述，${canAi ? 'AI ' : '平台'}整理成標準需求表，你確認後才會送出。`}
      />
      <ol className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="步驟">
        {stepLabels.map((l, i) => (
          <li key={l} aria-current={step === i + 1 ? 'step' : undefined}>
            <Badge tone={step === i + 1 ? 'brand' : 'neutral'}>{l}</Badge>
          </li>
        ))}
      </ol>
      {readOnly ? <p className="mb-3 rounded-sm bg-warn-soft px-3 py-2 text-sm text-warn">目前是唯讀模式，無法送出需求。</p> : null}

      {step === 1 ? (
        <Card className="flex flex-col gap-4">
          <SectionTitle title="用自己的話描述" hint="寫設備、數量、用了多久、遇到什麼問題都可以，不用管格式。" />
          <div className="flex flex-wrap gap-2" role="group" aria-label="範例">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setText(ex)} className="max-w-full rounded-sm border border-line-strong px-3 py-1.5 text-left text-sm text-ink-soft hover:border-brand">
                {ex.length > 24 ? `${ex.slice(0, 24)}…` : ex}
              </button>
            ))}
          </div>
          <Field label="需求描述" required>
            {(p) => <TextArea {...p} rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLES[0]} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="預算（元，選填）">{(p) => <TextInput {...p} inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="例如 3000000" />}</Field>
            <Field label="期望時程（選填）">{(p) => <TextInput {...p} value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="例如 年底前完成" />}</Field>
          </div>
          <div>
            <Button icon={<Sparkles className="size-4" aria-hidden />} busy={busy} disabled={!text.trim() || readOnly} onClick={() => void organise()}>
              {canAi ? 'AI 整理需求' : '整理需求'}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 2 && form ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand bg-brand-soft px-4 py-3 text-sm text-brand-strong">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{source === 'claude' ? 'AI 整理的結果需要你確認，確認後才會送出。' : '整理的結果需要你確認，確認後才會送出。'}</span>
              <SourceTag source={source} />
              {edited ? <Badge tone="outline">已手動調整</Badge> : null}
            </div>
            {edited && initialDraft ? (
              <Button variant="secondary" size="sm" icon={<RotateCcw className="size-3.5" aria-hidden />} onClick={resetToDraft}>
                還原 AI 初稿
              </Button>
            ) : null}
          </div>

          {mentionsCarbonInventory(text) ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-navy-soft px-4 py-3 text-sm text-navy">
              <p>平台不媒合碳盤查顧問。碳盤查請到碳盤查頁，用表單自行填報每月用電與燃料。</p>
              <ButtonLink to={paths.carbon()} variant="navy" size="sm">
                前往碳盤查表單
              </ButtonLink>
            </div>
          ) : null}

          <Card className="flex flex-col gap-3">
            <SectionTitle title="標準需求表" hint="設備、數量、每台功率（支援 kW 或馬力 HP 換算）與年份皆可直接修改。" />
            <div className="flex flex-col gap-3">
              {form.items.map((it, i) => (
                <div key={i} className="flex flex-col gap-2.5 rounded-sm border border-line bg-sunken p-3">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1.3fr_0.6fr_1.1fr_1fr_1.2fr_auto] sm:items-end">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="mb-1 block text-xs font-medium text-muted">設備／服務</label>
                      <Select aria-label={`第 ${i + 1} 列設備`} value={it.equip} onChange={(e) => patchItem(i, { equip: e.target.value as Specialty })}>
                        {SPECIALTIES.map((s) => (
                          <option key={s} value={s}>{SPECIALTY_LABEL[s]}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">數量（台）</label>
                      <TextInput
                        aria-label={`第 ${i + 1} 列數量`}
                        inputMode="numeric"
                        value={it.quantity ?? ''}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10)
                          patchItem(i, { quantity: Number.isFinite(n) && n > 0 ? n : null })
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">每台 kW（選填）</label>
                      {it.equip === 'carbon_consulting' ? (
                        <span className="inline-block py-2 text-muted">—</span>
                      ) : (
                        <TextInput
                          aria-label={`第 ${i + 1} 列每台 kW`}
                          inputMode="decimal"
                          placeholder="如 37（或輸入 50HP）"
                          value={it.ratedKw ?? ''}
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            const hpMatch = v.match(/^(\d+(?:\.\d+)?)\s*(?:hp|馬力)$/i)
                            if (hpMatch) {
                              patchItem(i, { ratedKw: hpToKw(Number(hpMatch[1])) })
                              return
                            }
                            const n = Number(v)
                            patchItem(i, { ratedKw: v && Number.isFinite(n) && n > 0 ? n : null })
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">設備年份或年數</label>
                      <TextInput
                        aria-label={`第 ${i + 1} 列設備年數`}
                        placeholder="如 10 年以上"
                        value={it.ageText ?? (it.ageYears != null ? `${it.ageYears} 年` : '')}
                        onChange={(e) => {
                          const v = e.target.value
                          const n = parseInt(v.replace(/[^\d]/g, ''), 10)
                          patchItem(i, { ageText: v || null, ageYears: Number.isFinite(n) ? n : null })
                        }}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="mb-1 block text-xs font-medium text-muted">備註</label>
                      <TextInput aria-label={`第 ${i + 1} 列備註`} value={it.note ?? ''} placeholder="如 每日運轉 16 小時" onChange={(e) => patchItem(i, { note: e.target.value || null })} />
                    </div>
                    <div className="col-span-2 flex justify-end sm:col-span-1">
                      <Button variant="ghost" size="sm" aria-label={`刪除第 ${i + 1} 列`} icon={<Trash2 className="size-4" aria-hidden />} onClick={() => patch({ ...form, items: form.items.filter((_, j) => j !== i) })} />
                    </div>
                  </div>
                  {it.equip === 'air_compressor' ? (
                    <p className="text-xs text-muted">
                      空壓機風量（m³/min）與實際管壓皆為選填，不知道可先留白、不卡需求送出；待廠商場勘時實測一週再確認。
                    </p>
                  ) : null}
                  {it.equip !== 'carbon_consulting' ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>常用馬力（HP）快速換算 kW：</span>
                      {HP_PRESETS.map((p) => (
                        <button
                          key={p.hp}
                          type="button"
                          onClick={() => patchItem(i, { ratedKw: p.kw })}
                          className="rounded-sm border border-line-strong bg-surface px-2 py-0.5 font-mono text-ink-soft hover:border-brand hover:text-ink"
                        >
                          {p.hp}HP = {p.kw}kW
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {!form.items.length ? <p className="text-sm text-muted">沒有辨識出設備，請按「新增一列」手動加入。</p> : null}
            <div>
              <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => patch({ ...form, items: [...form.items, { equip: 'air_compressor', quantity: null, ageYears: null, ageText: null, note: null }] })}>
                新增一列
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <SectionTitle title="主要問題" />
              <ListEditor label="主要問題" addLabel="新增主要問題" items={form.mainProblems} onChange={(mainProblems) => patch({ ...form, mainProblems })} />
            </div>
            <div className="flex flex-col gap-2">
              <SectionTitle title="可能改善方向" />
              <ListEditor
                label="可能改善方向"
                addLabel="新增改善方向"
                items={form.directions}
                onChange={(directions) => patch({ ...form, directions })}
                suggestions={form.items.flatMap((it) => (it.equip === 'carbon_consulting' ? [] : EQUIP_INFO[it.equip].directions))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <SectionTitle title="待確認問題" hint="描述裡看不出來的部分，可以補在上面的備註，或留給廠商場勘時確認。" />
              <ListEditor label="待確認問題" addLabel="新增待確認問題" items={form.openQuestions} onChange={(openQuestions) => patch({ ...form, openQuestions })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="需求標題">{(p) => <TextInput {...p} value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); setEdited(true) }} />}</Field>
              <Field label="每月電費（元，選填）" hint="可幫助補助、碳排與回本試算更貼近貴廠現況">
                {(p) => (
                  <TextInput
                    {...p}
                    inputMode="numeric"
                    placeholder="例如 270000"
                    value={form.monthlyElectricBillNtd ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, '').trim()
                      const n = Number(raw)
                      patch({
                        ...form,
                        monthlyElectricBillNtd: raw && Number.isFinite(n) && n > 0 ? Math.round(n) : null,
                      })
                    }}
                  />
                )}
              </Field>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>回上一步修改描述</Button>
            <Button disabled={!form.items.length} onClick={() => setStep(3)}>下一步：確認送出</Button>
          </div>
          {!form.items.length ? <p className="text-sm text-danger">至少要有一列設備或服務，才能進入下一步。</p> : null}
        </div>
      ) : null}

      {step === 3 && form ? (
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4">
            <SectionTitle title="確認送出" hint="送出後會建立案件，並由平台推薦 2 家廠商。" />
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold text-ink">{title.trim() || suggestTitle(form)}</h2>
              <SourceTag source={source} />
              {edited ? <Badge tone="outline">已手動調整</Badge> : null}
            </div>
            <ul className="flex flex-col gap-1 text-ink-soft">
              {form.items.map((it, i) => (
                <li key={i}>
                  {SPECIALTY_LABEL[it.equip]}
                  {it.quantity ? ` ${it.quantity} 台` : ''}
                  {it.ratedKw ? `・每台 ${it.ratedKw} kW` : ''}
                  {it.ageText ? `，${it.ageText}` : it.ageYears ? `，${it.ageYears} 年` : ''}
                  {it.note ? `（${it.note}）` : ''}
                </li>
              ))}
            </ul>
            {form.monthlyElectricBillNtd ? (
              <p className="text-sm text-ink-soft">每月電費：約 NT$ {form.monthlyElectricBillNtd.toLocaleString('en-US')}</p>
            ) : null}
            {form.mainProblems.length ? <p className="text-sm text-ink-soft">主要問題：{form.mainProblems.join('、')}</p> : null}
            {form.directions.length ? <p className="text-sm text-ink-soft">改善方向：{form.directions.join('、')}</p> : null}
            <label htmlFor="sync-to-factory" className="flex cursor-pointer items-start gap-2 rounded-sm border border-line bg-sunken px-3 py-2 text-sm text-ink">
              <input
                id="sync-to-factory"
                type="checkbox"
                checked={syncToFactory}
                onChange={(e) => setSyncToFactory(e.target.checked)}
                aria-label="把這次填寫的設備與每月電費更新到「我的工廠數據」"
                className="mt-1 accent-brand"
              />
              <span>
                把這次填寫的設備與每月電費更新到「我的工廠數據」嗎？（勾選後，送出時會同步寫入並標為你填寫的實際資料）
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setStep(2)} disabled={saving}>回上一步修改</Button>
              <Button busy={saving} disabled={readOnly} onClick={() => void submitNeed()}>確認送出</Button>
            </div>
          </Card>
          <SubsidySummaryBar
            summary={matchSubsidies({
              factory,
              need: {
                form,
                budgetNtd: budget.trim() && Number.isFinite(Number(budget.replace(/,/g, ''))) ? Number(budget.replace(/,/g, '')) : null,
              },
              context: 'match',
            })}
          />
        </div>
      ) : null}
    </>
  )
}
