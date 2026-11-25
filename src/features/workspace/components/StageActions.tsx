import { useState, type ReactNode } from 'react'
import { CalendarClock, CheckCircle2, ClipboardCheck, FilePenLine, HardHat, Search, Sparkles, Star } from 'lucide-react'
import { formatDateTime } from '../../../core/format'
import { paths } from '../../../core/paths'
import type { Case, Company, Review, UsagePoint } from '../../../core/types'
import { Button, ButtonLink, ConfirmDialog, Field, Select, TextArea, TextInput, cx } from '../../../ui'
import { whyNot, type Actor, type ActionType, type CaseAction } from '../lib/transitions'

export interface ActionsProps {
  c: Case
  actor: Actor | null
  readOnly: boolean
  companies: ReadonlyMap<string, Company>
  /** Vendors who already submitted a quote. */
  quotedVendorIds: readonly string[]
  reviews: readonly Review[]
  /** Runs a transition and writes it. Resolves true when the write went through. */
  run: (action: CaseAction, after?: () => Promise<void>) => Promise<boolean>
  onReview: (rating: number, comment: string) => Promise<void>
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <span className="text-brand" aria-hidden>
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </div>
  )
}

/** Shows why a button is off, so a disabled control is never a mystery. */
function Note({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>
}

const toIso = (local: string) => {
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

export function StageActions(p: ActionsProps) {
  const { c } = p
  const isUnselectedVendor = p.actor?.role === 'vendor' && !!c.selectedVendorId && c.selectedVendorId !== p.actor.id
  if (isUnselectedVendor) {
    return (
      <Panel icon={<CheckCircle2 className="size-5" />} title="案件已由其他廠商承接">
        <Note>工廠已於報價比較後選擇其他合作廠商簽約，後續階段僅供得標廠商與工廠操作。</Note>
      </Panel>
    )
  }
  if (c.status === 'completed') {
    return (
      <Panel icon={<CheckCircle2 className="size-5" />} title="案件已完成">
        <Note>用電比較已完成，結果在下方「用電比較」。</Note>
      </Panel>
    )
  }
  if (c.status === 'cancelled') {
    return <Note>這個案件已取消。</Note>
  }
  switch (c.stage) {
    case 'register':
      return <Note>需求登記中，確認後會進入初步評估。</Note>
    case 'assess':
      return <AssessActions {...p} />
    case 'survey':
      return <SurveyActions {...p} />
    case 'quote':
      return <QuoteActions {...p} />
    case 'contract':
      return <ContractActions {...p} />
    case 'construction':
      return <ConstructionActions {...p} />
    case 'acceptance':
      return <AcceptanceActions {...p} />
    case 'compare':
      return <CompareActions {...p} />
  }
}

/** The reason an action is off, or null; read-only mode counts as a reason. */
function off(p: ActionsProps, type: ActionType): string | null {
  return whyNot(p.c, type, p.actor) ?? (p.readOnly ? '目前是唯讀模式，無法寫入' : null)
}

function AssessActions(p: ActionsProps) {
  const isOwner = p.actor?.role === 'factory' && p.actor.id === p.c.factoryId
  return (
    <Panel icon={<Search className="size-5" />} title="初步評估">
      {isOwner ? (
        <ButtonLink to={paths.caseMatch(p.c.id)} icon={<Sparkles className="size-4" aria-hidden />} className="w-fit">
          查看推薦廠商
        </ButtonLink>
      ) : (
        <div className="flex flex-col gap-2">
          <Note>你已被平台推薦給工廠，目前等待工廠確認邀請場勘（每案最多推薦 2 家，無須競標）。</Note>
          <ButtonLink to={paths.need(p.c.needId)} variant="secondary" size="sm" className="w-fit">
            先查看完整需求規格（可預先提問） →
          </ButtonLink>
        </div>
      )}
    </Panel>
  )
}

function SurveyActions(p: ActionsProps) {
  const [at, setAt] = useState('')
  const [busy, setBusy] = useState(false)
  const scheduleOff = off(p, 'schedule_survey')
  const finishOff = off(p, 'finish_survey')
  return (
    <Panel icon={<CalendarClock className="size-5" />} title="現場場勘">
      <p className="text-sm text-ink-soft">{p.c.surveyDate ? `已預約場勘：${formatDateTime(p.c.surveyDate)}` : '尚未預約場勘時間。'}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="場勘日期與時間" className="w-full sm:w-64">
          {(f) => <TextInput {...f} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} disabled={!!scheduleOff} />}
        </Field>
        <Button
          variant="secondary"
          disabled={!!scheduleOff || !at}
          busy={busy}
          onClick={async () => {
            setBusy(true)
            await p.run({ type: 'schedule_survey', at: toIso(at) })
            setBusy(false)
          }}
        >
          預約場勘時間
        </Button>
      </div>
      {scheduleOff && p.actor?.role !== 'vendor' ? <Note>{scheduleOff}</Note> : null}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <Button disabled={!!finishOff} onClick={() => p.run({ type: 'finish_survey' })}>
          場勘完成
        </Button>
        {finishOff ? <Note>{finishOff}</Note> : <Note>完成後進入「方案與報價」。</Note>}
      </div>
    </Panel>
  )
}

function QuoteActions(p: ActionsProps) {
  const [pick, setPick] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const isFactory = p.actor?.role === 'factory' && p.actor.id === p.c.factoryId
  const isInvited = p.actor?.role === 'vendor' && p.c.shortlist.includes(p.actor.id)
  const quoted = p.actor ? p.quotedVendorIds.includes(p.actor.id) : false
  const selectOff = pick ? off(p, 'select_vendor') : off(p, 'select_vendor') ?? '請先選擇一家廠商'
  const name = (id: string) => p.companies.get(id)?.name ?? id
  return (
    <Panel icon={<FilePenLine className="size-5" />} title="方案與報價">
      {isInvited ? (
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink to={paths.caseQuoteNew(p.c.id)} className={cx('w-fit', p.readOnly && 'pointer-events-none opacity-50')}>
            {quoted ? '更新報價' : '提交報價'}
          </ButtonLink>
          <Note>{quoted ? '你已提交報價，工廠決定前都可以更新。' : '貼上你的報價單，工廠與 AI 解說會用它比較。'}</Note>
        </div>
      ) : null}
      {isFactory ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink to={paths.caseQuotes(p.c.id)} variant="secondary" icon={<Sparkles className="size-4" aria-hidden />} className="w-fit">
              查看 AI 報價解說
            </ButtonLink>
            <Note>已收到 {p.quotedVendorIds.length} 份報價。</Note>
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <Field label="選擇廠商並進入簽約" hint="只能從已提交報價的廠商中選擇。">
              {(f) => (
                <Select {...f} value={pick} onChange={(e) => setPick(e.target.value)} disabled={!p.quotedVendorIds.length}>
                  <option value="">請選擇廠商</option>
                  {p.quotedVendorIds.map((id) => (
                    <option key={id} value={id}>
                      {name(id)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button disabled={!!selectOff} onClick={() => setConfirm(true)} className="w-fit">
              選擇廠商並進入簽約
            </Button>
            {!p.quotedVendorIds.length ? <Note>還沒有廠商提交報價，等廠商提交後才能選擇。</Note> : null}
          </div>
          <ConfirmDialog
            open={confirm}
            title="確認選擇這家廠商？"
            body={`選擇 ${pick ? name(pick) : ''} 後案件進入簽約，其他廠商將不再參與這個案件。`}
            confirmLabel="確認並進入簽約"
            busy={busy}
            onCancel={() => setConfirm(false)}
            onConfirm={async () => {
              setBusy(true)
              const ok = await p.run({ type: 'select_vendor', vendorId: pick })
              setBusy(false)
              if (ok) setConfirm(false)
            }}
          />
        </>
      ) : null}
      {!isFactory && !isInvited ? <Note>目前由廠商提交報價，工廠比較後選擇。</Note> : null}
    </Panel>
  )
}

function ContractActions(p: ActionsProps) {
  const [amount, setAmount] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const blocked = off(p, 'sign_contract')
  const result = () => ({
    type: 'sign_contract' as const,
    contractNtd: Number(amount),
    startDate: toIso(start),
    endDate: toIso(end),
  })
  return (
    <Panel icon={<ClipboardCheck className="size-5" />} title="簽約">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="合約金額（元）" required>
          {(f) => <TextInput {...f} type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!!blocked} />}
        </Field>
        <Field label="開工日" required>
          {(f) => <TextInput {...f} type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={!!blocked} />}
        </Field>
        <Field label="完工日" required>
          {(f) => <TextInput {...f} type="date" value={end} onChange={(e) => setEnd(e.target.value)} disabled={!!blocked} />}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!!blocked || !amount || !start || !end}
          busy={busy}
          onClick={async () => {
            setBusy(true)
            await p.run(result())
            setBusy(false)
          }}
        >
          完成簽約
        </Button>
        {blocked ? <Note>{blocked}</Note> : <Note>工廠與廠商任一方確認後，進入施工。</Note>}
      </div>
    </Panel>
  )
}

function ConstructionActions(p: ActionsProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const blocked = off(p, 'report_progress')
  const finishOff = off(p, 'finish_construction')
  return (
    <Panel icon={<HardHat className="size-5" />} title="施工">
      <Field label="施工進度" hint="寫下完成了什麼、接下來要做什麼，工廠會在活動紀錄看到。">
        {(f) => <TextArea {...f} rows={3} value={text} onChange={(e) => setText(e.target.value)} disabled={!!blocked} />}
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={!!blocked || !text.trim()}
          busy={busy}
          onClick={async () => {
            setBusy(true)
            if (await p.run({ type: 'report_progress', text })) setText('')
            setBusy(false)
          }}
        >
          回報進度
        </Button>
        <Button disabled={!!finishOff} onClick={() => p.run({ type: 'finish_construction' })}>
          完工
        </Button>
      </div>
      {blocked ? <Note>{blocked}</Note> : null}
    </Panel>
  )
}

function AcceptanceActions(p: ActionsProps) {
  const blocked = off(p, 'accept')
  const isVendor = p.actor?.role === 'vendor'
  return (
    <Panel icon={<ClipboardCheck className="size-5" />} title="驗收">
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!!blocked} onClick={() => p.run({ type: 'accept' })}>
          驗收通過
        </Button>
        <Note>{isVendor ? '你已回報完工，目前等待工廠對照合約驗收通過並留下評價。' : (blocked ?? '對照合約逐項檢查後再按，通過後進入用電比較。')}</Note>
      </div>
      {!isVendor ? <ReviewForm {...p} /> : null}
    </Panel>
  )
}

function ReviewForm(p: ActionsProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const done = p.reviews.some((r) => r.caseId === p.c.id)
  const blocked = off(p, 'review')
  if (done) return <Note>你已經為這個案件留下評價。</Note>
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <p className="text-sm font-medium text-ink">評價廠商（選填，驗收前後都可以留）</p>
      <div role="group" aria-label="評分" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={!!blocked}
            aria-label={`${n} 顆星`}
            aria-pressed={rating === n}
            onClick={() => setRating(n)}
            className="rounded-sm p-1 disabled:opacity-50"
          >
            <Star className={cx('size-6', n <= rating ? 'fill-current text-chart-3' : 'text-muted')} aria-hidden />
          </button>
        ))}
      </div>
      <TextArea rows={2} aria-label="評價內容" placeholder="施工品質、溝通與時程如何？" value={comment} onChange={(e) => setComment(e.target.value)} disabled={!!blocked} />
      <Button
        variant="secondary"
        className="w-fit"
        disabled={!!blocked || !rating}
        busy={busy}
        onClick={async () => {
          setBusy(true)
          await p.run({ type: 'review', rating }, () => p.onReview(rating, comment.trim()))
          setBusy(false)
        }}
      >
        送出評價
      </Button>
      {blocked ? <Note>{blocked}</Note> : null}
    </div>
  )
}

function CompareActions(p: ActionsProps) {
  const [month, setMonth] = useState('')
  const [kwh, setKwh] = useState('')
  const [phase, setPhase] = useState<UsagePoint['phase']>('after')
  const [busy, setBusy] = useState(false)
  const blocked = off(p, 'add_usage')
  const finishOff = off(p, 'complete_compare')
  return (
    <Panel icon={<Sparkles className="size-5" />} title="用電比較">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="月份" required>
          {(f) => <TextInput {...f} type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={!!blocked} />}
        </Field>
        <Field label="用電度數" required>
          {(f) => <TextInput {...f} type="number" inputMode="numeric" min={0} value={kwh} onChange={(e) => setKwh(e.target.value)} disabled={!!blocked} />}
        </Field>
        <Field label="期間">
          {(f) => (
            <Select {...f} value={phase} onChange={(e) => setPhase(e.target.value as UsagePoint['phase'])} disabled={!!blocked}>
              <option value="after">改善後</option>
              <option value="before">改善前</option>
            </Select>
          )}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={!!blocked || !month || !kwh}
          busy={busy}
          onClick={async () => {
            setBusy(true)
            if (await p.run({ type: 'add_usage', month, kwh: Number(kwh), phase })) {
              setMonth('')
              setKwh('')
            }
            setBusy(false)
          }}
        >
          登錄用電
        </Button>
        <Button disabled={!!finishOff} onClick={() => p.run({ type: 'complete_compare' })}>
          完成用電比較
        </Button>
      </div>
      {blocked ? <Note>{blocked}</Note> : null}
    </Panel>
  )
}
