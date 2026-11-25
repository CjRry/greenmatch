import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Mail, MessageSquareHeart, Star } from 'lucide-react'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  Field,
  PageHeader,
  SectionTitle,
  TextArea,
  TextInput,
  cx,
  useToast,
} from '../../../ui'

export type FeedbackRole = 'factory' | 'vendor' | 'other'

export interface RubricItem {
  key: 'ease' | 'clarity' | 'trust' | 'usefulness' | 'visual'
  label: string
  weight: number
  hint: string
}

export const RUBRIC_ITEMS: readonly RubricItem[] = [
  {
    key: 'ease',
    label: '完成任務容易度',
    weight: 25,
    hint: '從首頁進入、登記需求／找案源、看推薦或報價是否順暢好操作？',
  },
  {
    key: 'clarity',
    label: '看得懂（用語、流程、下一步）',
    weight: 20,
    hint: '網站用語夠白話嗎？8 個標準階段與下一步該做什麼清不清楚？',
  },
  {
    key: 'trust',
    label: '信任感（來源、金額標示、廠商可信度）',
    weight: 20,
    hint: '政府補助官方來源與查核日、報價明細標示、廠商實績與認證讓人放心嗎？',
  },
  {
    key: 'usefulness',
    label: '對工作有用（省時、省錢、補助）',
    weight: 20,
    hint: '口語轉標準需求表、自動算政府補助、AI 報價比價對實際工作有幫助嗎？',
  },
  {
    key: 'visual',
    label: '視覺與順暢度（含手機）',
    weight: 15,
    hint: '版面清楚度、字體大小、手機與電腦瀏覽的順暢度是否舒適？',
  },
] as const

const ROLE_OPTIONS: { value: FeedbackRole; label: string; sub: string }[] = [
  { value: 'factory', label: '工廠', sub: '製造業負責人、廠務、環安衛或採購' },
  { value: 'vendor', label: '廠商', sub: '節能工程、空壓／空調設備商、ESCO 或顧問' },
  { value: 'other', label: '其他', sub: '學界、公協會、研究人員或一般訪客' },
]

const SCORE_LABELS: Record<number, string> = {
  1: '1 很不滿意',
  2: '2 尚待加強',
  3: '3 普通尚可',
  4: '4 滿意好用',
  5: '5 非常滿意',
}

const QUICK_PROS: Record<FeedbackRole, readonly string[]> = {
  factory: [
    '口語描述自動整理成標準需求表',
    '自動比對 7 項政府補助與估算金額',
    '只推薦 2 家合適廠商、附上推薦理由',
    'AI 統一報價表格並算出扣補助回本時間',
    '8 階段進度像包裹一樣清楚好追蹤',
  ],
  vendor: [
    '需求表已整理好設備規格與問題，省去盲目場勘',
    '平台只推薦 2 家，不陷入低價競標',
    '可標示「可協助申請補助」提升工廠信任',
    '場勘、報價、驗收 8 階段雙方同步留紀錄',
    '貼上現有報價單文字就能自動整理欄位',
  ],
  other: [
    '把政府補助直接嵌進媒合與報價流程',
    '雙向 8 階段追蹤設計清楚透明',
    '介面乾淨、在手機上好讀好點',
  ],
}

const RECIPIENT = 'chris0308.lee@gmail.com'

export type RubricScores = Record<RubricItem['key'], number | null>

export function computeWeightedScore(scores: RubricScores): {
  perItem: Record<RubricItem['key'], number | null>
  total: number | null
  answeredCount: number
} {
  const perItem: Record<RubricItem['key'], number | null> = {
    ease: scores.ease != null ? Math.round((scores.ease / 5) * 25) : null,
    clarity: scores.clarity != null ? Math.round((scores.clarity / 5) * 20) : null,
    trust: scores.trust != null ? Math.round((scores.trust / 5) * 20) : null,
    usefulness: scores.usefulness != null ? Math.round((scores.usefulness / 5) * 20) : null,
    visual: scores.visual != null ? Math.round((scores.visual / 5) * 15) : null,
  }
  const vals = Object.values(perItem)
  const answeredCount = vals.filter((v) => v != null).length
  const total =
    answeredCount === 5
      ? (perItem.ease ?? 0) + (perItem.clarity ?? 0) + (perItem.trust ?? 0) + (perItem.usefulness ?? 0) + (perItem.visual ?? 0)
      : null
  return { perItem, total, answeredCount }
}

export function buildFeedbackMail({
  feedbackRole,
  orgName,
  scores,
  nps,
  liked,
  improve,
}: {
  feedbackRole: FeedbackRole
  orgName: string
  scores: RubricScores
  nps: number | null
  liked: string
  improve: string
}): { subject: string; body: string; mailtoHref: string; gmailHref: string } {
  const roleLabel = feedbackRole === 'factory' ? '工廠' : feedbackRole === 'vendor' ? '廠商' : '其他'
  const { perItem, total } = computeWeightedScore(scores)
  const cleanOrg = orgName.trim()
  const totalText = total != null ? `${total}/100` : '未完成評分'
  const npsText = nps != null ? `${nps}/10` : '未填'
  const subject = `[GreenMatch 試用回饋] ${roleLabel}${cleanOrg ? `（${cleanOrg}）` : ''}｜總分 ${totalText}｜NPS ${npsText}`

  const fmtItem = (raw: number | null, weighted: number | null, maxW: number) =>
    raw != null && weighted != null ? `${raw} / 5（換算 ${weighted} / ${maxW}）` : '（尚未評分）'

  const lines = [
    '[GreenMatch 試用回饋]',
    `填寫身分：${roleLabel}`,
    `公司或產業簡稱：${cleanOrg || '（未填寫）'}`,
    '',
    '【五項體驗評分（1–5 分）與配分換算】',
    `1. 完成任務容易度：${fmtItem(scores.ease, perItem.ease, 25)}`,
    `2. 看得懂（用語、流程、下一步）：${fmtItem(scores.clarity, perItem.clarity, 20)}`,
    `3. 信任感（來源、金額標示、廠商可信度）：${fmtItem(scores.trust, perItem.trust, 20)}`,
    `4. 對工作有用（省時、省錢、補助）：${fmtItem(scores.usefulness, perItem.usefulness, 20)}`,
    `5. 視覺與順暢度（含手機）：${fmtItem(scores.visual, perItem.visual, 15)}`,
    `合計總分：${total != null ? `${total} / 100` : '（尚未完成全部 5 題）'}`,
    `推薦給同業意願（NPS 0–10）：${nps != null ? `${nps} / 10` : '（尚未選擇）'}`,
    '',
    '【開放問題回饋】',
    `1. 最有幫助或印象深刻的地方：${liked.trim() || '（未填寫）'}`,
    `2. 最想改進或看不懂的地方：${improve.trim() || '（未填寫）'}`,
  ]
  const body = lines.join('\n')
  const mailtoHref = `mailto:${RECIPIENT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(RECIPIENT)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  return { subject, body, mailtoHref, gmailHref }
}

export default function Feedback() {
  const { company, role } = useSession()
  const toast = useToast()

  const initialRole: FeedbackRole = role === 'factory' ? 'factory' : role === 'vendor' ? 'vendor' : 'factory'
  const [feedbackRole, setFeedbackRole] = useState<FeedbackRole>(initialRole)
  const [orgName, setOrgName] = useState(() => (company && !company.isDemo ? company.name : ''))
  const [scores, setScores] = useState<RubricScores>({
    ease: null,
    clarity: null,
    trust: null,
    usefulness: null,
    visual: null,
  })
  const [nps, setNps] = useState<number | null>(null)
  const [liked, setLiked] = useState('')
  const [improve, setImprove] = useState('')
  const [sent, setSent] = useState(false)
  const [submittedWeb, setSubmittedWeb] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const { perItem, total, answeredCount } = useMemo(() => computeWeightedScore(scores), [scores])
  const isComplete = answeredCount === 5 && nps != null
  const mail = useMemo(
    () => buildFeedbackMail({ feedbackRole, orgName, scores, nps, liked, improve }),
    [feedbackRole, orgName, scores, nps, liked, improve],
  )

  const toggleQuickPro = (chip: string) => {
    if (liked.includes(chip)) return
    setLiked((prev) => (prev.trim() ? `${prev.trim()}；${chip}` : chip))
  }

  const checkReady = (): boolean => {
    const missingItems = RUBRIC_ITEMS.filter((it) => scores[it.key] == null)
    const missingRubric = missingItems.map((it) => it.label)
    if (missingRubric.length > 0 || nps == null) {
      const msg =
        missingRubric.length > 0
          ? `請先點選五項體驗評分（尚缺：${missingRubric.join('、')}）${nps == null ? '及推薦意願（0–10 分）' : ''}`
          : '請先點選第 3 題「推薦給同業的意願（0–10 分）」'
      setValidationError(msg)
      toast({ title: '還有評分項目尚未點選', body: msg, tone: 'error' })
      const targetId = missingItems[0] ? `rubric-${missingItems[0].key}` : 'feedback-nps'
      const el = typeof document !== 'undefined' ? document.getElementById(targetId) : null
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      return false
    }
    setValidationError(null)
    return true
  }

  const submitDirect = async () => {
    if (!checkReady() || submitting) return
    setSubmitting(true)
    const roleLabel = feedbackRole === 'factory' ? '工廠' : feedbackRole === 'vendor' ? '廠商' : '其他'
    const payload = {
      source: 'web-form',
      feedbackRole,
      roleLabel,
      orgName: orgName.trim(),
      scores,
      perItem,
      total,
      nps,
      liked: liked.trim(),
      improve: improve.trim(),
      subject: mail.subject,
      body: mail.body,
    }
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setSubmittedWeb(true)
        setSent(true)
        toast({ title: '已收到你的試用回饋，感謝協助成大團隊改進！', tone: 'success' })
        setSubmitting(false)
        return
      }
    } catch {
      // Offline or local dev without /api/feedback: fall back to mailto / preview
    }
    setSubmitting(false)
    setSent(true)
    toast({
      title: '已整理好回饋內容',
      body: '可點選下方「開啟信箱送出回饋」或「複製回饋內容」寄給團隊。',
      tone: 'info',
    })
  }

  const handleOpenMail = (e?: React.MouseEvent) => {
    if (!checkReady()) {
      e?.preventDefault()
      return false
    }
    setSent(true)
    toast({ title: '已產生回饋信件草稿', body: '請在開啟的郵件視窗按「傳送」即可完成回饋。', tone: 'success' })
    return true
  }

  const handleCopy = async () => {
    if (!checkReady()) return
    const fullText = `收件人：${RECIPIENT}\n主旨：${mail.subject}\n\n${mail.body}`
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      toast({ title: '已複製回饋內容', body: '可直接貼上並回覆邀請信。', tone: 'success' })
    } catch {
      setCopied(true)
      toast({ title: '請從下方預覽框複製文字', tone: 'info' })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="試用回饋"
        description="感謝撥冗體驗「綠媒 GreenMatch」（國立成功大學 2026 全國 AI 專題創意競賽作品）。填寫約需 30 秒，點選分數即可直接線上送出。"
        back={{ to: paths.home(), label: '回首頁' }}
      />

      <Card className="flex flex-wrap items-center justify-between gap-3 bg-sunken">
        <div className="flex items-start gap-2.5">
          <MessageSquareHeart className="mt-0.5 size-5 shrink-0 text-brand-strong" aria-hidden />
          <div className="text-sm text-ink-soft">
            <p className="font-medium text-ink">還沒看過完整功能嗎？可先點選 3 分鐘快速導覽：</p>
            <p className="mt-0.5 text-xs text-muted">
              工廠推薦看「推薦與政府補助」「AI 報價比較」；節能廠商推薦看「需求市集」「受邀案件工作台」。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={paths.caseMatch('c01')} variant="secondary" size="sm">
            看推薦與補助示範
          </ButtonLink>
          <ButtonLink to={paths.caseQuotes('c01')} variant="secondary" size="sm">
            看 AI 報價解說示範
          </ButtonLink>
          <ButtonLink to={paths.needs()} variant="secondary" size="sm">
            看需求市集
          </ButtonLink>
        </div>
      </Card>

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          void submitDirect()
        }}
      >
        <Card className="flex flex-col gap-4">
          <SectionTitle title="1. 您的身分" hint="請選擇最接近您日常工作的角色；公開統計時將完全匿名。" />
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="填寫身分">
            {ROLE_OPTIONS.map((opt) => {
              const active = feedbackRole === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFeedbackRole(opt.value)}
                  className={cx(
                    'flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors',
                    active ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-brand',
                  )}
                >
                  <span className="font-display text-base font-bold text-ink">{opt.label}</span>
                  <span className="text-xs text-ink-soft">{opt.sub}</span>
                </button>
              )
            })}
          </div>
          <Field label="公司或產業簡稱（選填，統計時會匿名處理）">
            {(p) => (
              <TextInput
                {...p}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={feedbackRole === 'vendor' ? '例如：台中空壓機工程、北部 ESCO 廠商' : '例如：台南金屬加工廠、桃園塑膠射出廠'}
              />
            )}
          </Field>
        </Card>

        <Card className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle title="2. 五項體驗評分（1–5 分）" hint="請依您的真實體驗點選（1 分＝很不滿意，5 分＝非常滿意）。" />
            <Badge tone={total != null ? 'brand' : 'navy'}>
              {total != null ? `目前換算總分：${total} / 100` : `已評 ${answeredCount} / 5 題（請點選 1–5 分）`}
            </Badge>
          </div>

          <div className="flex flex-col divide-y divide-line">
            {RUBRIC_ITEMS.map((item) => {
              const val = scores[item.key]
              return (
                <div key={item.key} id={`rubric-${item.key}`} className="flex flex-col gap-2.5 py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-bold text-ink">
                        {item.label}
                        <span className="ml-2 text-xs font-normal text-muted">（佔 {item.weight} 分）</span>
                      </h3>
                      <p className="mt-0.5 text-sm text-ink-soft">{item.hint}</p>
                    </div>
                    <span className={cx('font-mono text-sm font-bold tabular', val != null ? 'text-brand-strong' : 'text-muted')}>
                      {val != null ? `${val} / 5（${perItem[item.key]} / ${item.weight} 分）` : '尚未選擇'}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={item.label}>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const selected = val === n
                      return (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={`${item.label} ${n} 分`}
                          onClick={() => {
                            setScores((prev) => ({ ...prev, [item.key]: n }))
                            setValidationError(null)
                          }}
                          className={cx(
                            'flex flex-col items-center justify-center gap-0.5 rounded-sm border py-2 text-center transition-colors',
                            selected
                              ? 'border-brand bg-brand text-on-brand font-bold'
                              : 'border-line-strong bg-surface text-ink hover:border-brand',
                          )}
                        >
                          <span className="flex items-center gap-1 font-mono text-base tabular">
                            <Star className="size-3.5 fill-current" aria-hidden />
                            {n}
                          </span>
                          <span className="hidden text-[11px] sm:inline">{SCORE_LABELS[n].slice(2)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card id="feedback-nps" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionTitle
              title="3. 推薦給同業的意願（NPS 0–10 分）"
              hint="如果這套平台正式上線，您有多大意願推薦給同業或客戶？（0＝完全不會，10＝一定會推薦）"
            />
            <span className={cx('font-mono text-base font-bold tabular', nps != null ? 'text-brand-strong' : 'text-muted')}>
              {nps != null ? `${nps} / 10 分` : '尚未選擇'}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11" role="radiogroup" aria-label="推薦給同業的意願">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
              const selected = nps === n
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`推薦意願 ${n} 分`}
                  onClick={() => {
                    setNps(n)
                    setValidationError(null)
                  }}
                  className={cx(
                    'rounded-sm border py-2.5 font-mono text-sm tabular transition-colors',
                    selected
                      ? 'border-brand bg-brand text-on-brand font-bold'
                      : 'border-line-strong bg-surface text-ink hover:border-brand',
                  )}
                >
                  {n}
                </button>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>0 完全不會推薦</span>
            <span>5 中立</span>
            <span>10 一定會推薦給同業</span>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <SectionTitle title="4. 簡短意見（選填，一句話即可）" />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">試用時覺得最有幫助的功能（可點選快速帶入，或直接填寫）：</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROS[feedbackRole].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleQuickPro(chip)}
                  className="rounded-sm border border-line-strong bg-surface px-2.5 py-1 text-left text-xs text-ink-soft hover:border-brand hover:text-ink"
                >
                  + {chip}
                </button>
              ))}
            </div>
            <Field label="最有幫助或印象深刻的地方（選填）">
              {(p) => (
                <TextArea
                  {...p}
                  rows={2}
                  value={liked}
                  onChange={(e) => setLiked(e.target.value)}
                  placeholder="例如：直接算出空壓機補助區間很實用、報價單統一欄位省很多比對時間"
                />
              )}
            </Field>
          </div>

          <Field label="最想改進、看不懂，或實際工作還希望補上的功能（選填，一句話即可）">
            {(p) => (
              <TextArea
                {...p}
                rows={3}
                value={improve}
                onChange={(e) => setImprove(e.target.value)}
                placeholder="例如：希望增加某縣市地方補助、希望能匯出 PDF 給老闆簽核、某個名詞看不懂…"
              />
            )}
          </Field>
        </Card>

        <Card className="flex flex-col gap-4 border-brand bg-brand-soft">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-bold text-brand-strong">5. 送出回饋給成大研究團隊</h2>
            <p className="text-sm text-ink-soft">
              點擊「送出回饋（免開信箱）」即可直接線上送出；您也可以改用信箱寄出（收件人：<span className="font-mono text-ink">{RECIPIENT}</span>，主旨開頭為{' '}
              <span className="font-mono text-ink">[GreenMatch 試用回饋]</span>）或複製文字回信。
            </p>
            <p className="rounded-sm border border-line bg-surface px-3 py-2 text-xs text-ink-soft">
              資料傳送說明：線上送出時，系統會將您填寫的身分／公司簡稱、各項評分與意見文字，連同瀏覽器類型與連線 IP 傳送至成大研究團隊伺服器儲存，僅供專題研究統計與防濫用查核使用；請勿填入機密商業資訊。聯絡信箱：
              <span className="font-mono text-ink">{RECIPIENT}</span>。
            </p>
          </div>

          {submittedWeb ? (
            <div role="status" className="rounded-md border border-brand bg-surface p-4 text-sm text-ink">
              <p className="flex items-center gap-2 font-display text-base font-bold text-brand-strong">
                <Check className="size-5 shrink-0" aria-hidden />
                已收到你的試用回饋，感謝協助成大團隊改進！
              </p>
              <p className="mt-1 text-ink-soft">
                您的評分（總分 <span className="font-mono font-bold text-ink">{total} / 100</span>・推薦意願 <span className="font-mono font-bold text-ink">{nps} / 10</span>）已直接記錄至研究團隊系統。
              </p>
            </div>
          ) : null}

          {validationError ? (
            <p role="alert" className="rounded-sm bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {validationError}
            </p>
          ) : !isComplete ? (
            <p className="rounded-sm bg-warn-soft px-3 py-2 text-xs text-warn">
              請先完成上方「2. 五項體驗評分」與「3. 推薦意願（0–10 分）」，即可一鍵送出回饋。
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" busy={submitting} icon={submittedWeb ? <Check className="size-4" aria-hidden /> : undefined}>
              {submittedWeb ? '已送出回饋（可再次更新）' : '送出回饋（免開信箱）'}
            </Button>
            <a
              href={mail.mailtoHref}
              onClick={(e) => handleOpenMail(e)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-sunken"
            >
              <Mail className="size-4" aria-hidden />
              開啟信箱送出回饋
            </a>
            <a
              href={mail.gmailHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => handleOpenMail(e)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-sunken"
            >
              <ExternalLink className="size-4" aria-hidden />
              用 Gmail 網頁版寄出
            </a>
            <Button
              type="button"
              variant="secondary"
              icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              onClick={() => void handleCopy()}
            >
              {copied ? '已複製回饋文字' : '複製回饋內容（可直接貼上回信）'}
            </Button>
          </div>

          {sent || copied ? (
            <div className="rounded-md border border-line bg-surface p-3 text-xs text-ink-soft">
              <p className="mb-1.5 font-medium text-ink">
                信件預覽（收件人：{RECIPIENT}｜主旨：{mail.subject}）
              </p>
              <pre className="whitespace-pre-wrap break-words font-mono text-xs text-ink-soft">{mail.body}</pre>
            </div>
          ) : null}
        </Card>
      </form>
    </div>
  )
}
