import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { MessageSquarePlus, SearchX } from 'lucide-react'
import { STAGE_BY_KEY } from '../../../core/constants/stages'
import { itemLabel } from '../../../core/domain/matching'
import { SCALE_LABEL } from '../../../core/constants/equipment'
import { formatNtd, formatNumber, nowIso, relativeTime } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useDoc, useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import { Badge, Button, ButtonLink, Card, CompanyAvatar, DemoBadge, EmptyState, FeedbackNudge, PageHeader, ScrollX, SectionTitle, SkeletonList, SourceTag, StageProgress, TextInput, useToast } from '../../../ui'
import { InterestButton } from '../components/InterestButton'
import { isVendor, matchesVendor } from '../lib/filters'

const VENDOR_QUESTION_TEMPLATES = [
  '請問設備銘牌上的額定功率（kW 或馬力 HP）與製造年份？',
  '請問該設備每日平均運轉時數（單班 8h／兩班 16h／24h 連續）？',
  '請問廠區夏月電費單上的契約容量（kW）是多少？',
] as const

export default function NeedDetail() {
  const { id } = useParams()
  const need = useDoc('needs', id)
  const factory = useDoc('companies', need?.factoryId)
  const kase = useDoc('cases', need?.caseId)
  const { company } = useSession()
  const store = useStore()
  const { readOnly } = useStoreInfo()
  const toast = useToast()
  const [qDraft, setQDraft] = useState('')
  const [qBusy, setQBusy] = useState(false)

  if (need === undefined) return <SkeletonList rows={4} />
  if (need === null) {
    return (
      <div>
        <PageHeader title="找不到這筆需求" back={{ to: paths.needs(), label: '回到需求市集' }} />
        <EmptyState
          icon={<SearchX className="size-6" aria-hidden />}
          title="這筆需求不存在或已被移除"
          body="可能是連結有誤。回到需求市集，從開放中的需求挑選。"
          action={<ButtonLink to={paths.needs()}>回到需求市集</ButtonLink>}
        />
      </div>
    )
  }

  const vendor = isVendor(company) ? company : null
  const isOwner = !!company && company.id === need.factoryId
  const open = need.status === 'open'
  const inServiceArea = !vendor || vendor.vendor.serviceCities.includes(need.city)

  const addQuestion = async (text: string) => {
    const clean = text.trim()
    if (!clean || qBusy || readOnly) return
    const tag = vendor ? `${ clean }（${ vendor.name } 提問）` : clean
    if (need.form.openQuestions.includes(tag) || need.form.openQuestions.includes(clean)) {
      toast({ title: '這個問題已經在待確認清單中', tone: 'info' })
      return
    }
    setQBusy(true)
    try {
      await store.update('needs', need.id, {
        form: { ...need.form, openQuestions: [...need.form.openQuestions, tag] },
        updatedAt: nowIso(),
      })
      setQDraft('')
      toast({ title: '已送出場勘前提問', body: '工廠與場勘人員皆可在待確認問題中看到', tone: 'success' })
    } catch {
      toast({ title: '提問送出失敗，請再試一次', tone: 'error' })
    } finally {
      setQBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        back={{ to: paths.needs(), label: '需求市集' }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {need.title}
            {need.isDemo ? <DemoBadge /> : null}
          </span>
        }
        description={`${need.city}・${SCALE_LABEL[need.scale]}・${relativeTime(need.createdAt)}刊登`}
        actions={
          <>
            {isOwner && need.caseId ? <ButtonLink to={paths.case(need.caseId)}>查看案件進度</ButtonLink> : null}
            {vendor && open ? <InterestButton need={need} vendorId={vendor.id} size="md" /> : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {vendor && matchesVendor(need, vendor) ? (
            <p className="flex flex-wrap items-center gap-2">
              {inServiceArea ? (
                <Badge tone="brand">符合你的專長與服務地區</Badge>
              ) : (
                <Badge tone="navy">符合你的專長（跨區案源：{need.city}）</Badge>
              )}
            </p>
          ) : null}
          {!open ? <p className="rounded-sm bg-sunken px-3 py-2 text-sm text-ink-soft">這筆需求已不開放，不能再表達興趣。</p> : null}

          <section className="flex flex-col gap-2">
            <SectionTitle title="工廠原話" />
            <blockquote className="rounded-sm border-l-4 border-brand bg-sunken px-4 py-3 text-ink [overflow-wrap:anywhere]">{need.rawText}</blockquote>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle title="標準需求表" action={<SourceTag source={need.source} />} />
            <ScrollX>
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line-strong text-muted">
                    <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">設備類型</th>
                    <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">數量</th>
                    <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">功率／規格</th>
                    <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">設備年份</th>
                    <th scope="col" className="py-2 pr-3 font-medium whitespace-nowrap">主要問題</th>
                    <th scope="col" className="py-2 font-medium whitespace-nowrap">可能改善方向</th>
                  </tr>
                </thead>
                <tbody>
                  {need.form.items.map((it, i) => (
                    <tr key={i} className="border-b border-line align-top">
                      <th scope="row" className="py-2 pr-3 font-medium text-ink">{itemLabel(it.equip)}</th>
                      <td className="tabular py-2 pr-3 font-mono">{it.quantity ?? '—'}</td>
                      <td className="py-2 pr-3 text-ink-soft">
                        {it.ratedKw ? (
                          <span className="tabular font-mono text-ink">
                            {it.ratedKw} kW（約 {Math.round(it.ratedKw / 0.746)} HP）
                          </span>
                        ) : (
                          it.note ?? '待場勘確認'
                        )}
                      </td>
                      <td className="py-2 pr-3">{it.ageText ?? (it.ageYears != null ? `${it.ageYears} 年` : '—')}</td>
                      {i === 0 ? (
                        <>
                          <td rowSpan={need.form.items.length} className="py-2 pr-3 text-ink-soft">
                            {need.form.mainProblems.length ? (
                              <ul className="list-disc pl-4">{need.form.mainProblems.map((p) => <li key={p}>{p}</li>)}</ul>
                            ) : '—'}
                          </td>
                          <td rowSpan={need.form.items.length} className="py-2 text-ink-soft">
                            {need.form.directions.length ? (
                              <ul className="list-disc pl-4">{need.form.directions.map((p) => <li key={p}>{p}</li>)}</ul>
                            ) : '—'}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle title="待確認問題與場勘前追問" hint="工廠還沒回答或廠商想先確認的規格，到廠場勘前可先同步" />
            {need.form.openQuestions.length ? (
              <ul className="list-disc pl-5 text-ink-soft">
                {need.form.openQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">目前尚無待確認問題。</p>
            )}
            {vendor && open ? (
              <Card className="flex flex-col gap-2.5 bg-sunken">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <MessageSquarePlus className="size-4 text-brand" aria-hidden />
                  場勘前向工廠提問（避免白跑一趟，請工廠先補拍銘牌或確認時數）：
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {VENDOR_QUESTION_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      disabled={qBusy || readOnly}
                      onClick={() => void addQuestion(tpl)}
                      className="rounded-sm border border-line-strong bg-surface px-2.5 py-1 text-left text-xs text-ink-soft hover:border-brand hover:text-ink"
                    >
                      + {tpl}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <TextInput
                    aria-label="場勘前向工廠提問"
                    placeholder="輸入想請工廠補充的規格（例如：空壓機排氣壓力與乾燥機型式）"
                    value={qDraft}
                    onChange={(e) => setQDraft(e.target.value)}
                    className="min-w-0 flex-1"
                  />
                  <Button size="sm" variant="secondary" busy={qBusy} disabled={!qDraft.trim() || readOnly} onClick={() => void addQuestion(qDraft)}>
                    送出提問
                  </Button>
                </div>
              </Card>
            ) : null}
          </section>

          <section className="flex flex-col gap-2">
            <SectionTitle title="預算與時程" />
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted">預算</dt>
                <dd className="tabular font-mono text-ink">{need.budgetNtd ? formatNtd(need.budgetNtd) : '未提供'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">時程</dt>
                <dd className="text-ink">{need.timeline || '未提供'}</dd>
              </div>
            </dl>
          </section>

          {kase ? (
            <section className="flex flex-col gap-3">
              <SectionTitle title="案件進度" hint={`目前：第 ${STAGE_BY_KEY[kase.stage].n} 階段「${STAGE_BY_KEY[kase.stage].label}」`} />
              <ScrollX>
                <div className="min-w-[32rem]">
                  <StageProgress stage={kase.stage} completed={kase.status === 'completed'} showLabels />
                </div>
              </ScrollX>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-3">
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-base font-bold text-ink">刊登工廠</h2>
            {factory ? (
              <>
                <div className="flex items-center gap-3">
                  <CompanyAvatar name={factory.name} id={factory.id} />
                  <div className="min-w-0">
                    <Link to={paths.factory(factory.id)} className="font-medium text-navy hover:underline">
                      {factory.name}
                    </Link>
                    <p className="text-sm text-muted">{factory.city}{factory.role === 'factory' ? `・${factory.factory.industry}` : ''}</p>
                  </div>
                </div>
                {factory.intro ? <p className="text-sm text-ink-soft">{factory.intro}</p> : null}
                {factory.role === 'factory' ? (
                  <dl className="grid grid-cols-2 gap-2 border-t border-line pt-2 text-xs">
                    <div>
                      <dt className="text-muted">契約容量</dt>
                      <dd className="tabular font-mono font-medium text-ink">
                        {factory.factory.contractKw ? `${formatNumber(factory.factory.contractKw)} kW` : '待確認'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">月均用電</dt>
                      <dd className="tabular font-mono font-medium text-ink">
                        {factory.factory.monthlyKwh ? `${formatNumber(factory.factory.monthlyKwh)} 度` : '待確認'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">員工人數</dt>
                      <dd className="tabular font-mono text-ink">{formatNumber(factory.factory.employees)} 人</dd>
                    </div>
                    <div>
                      <dt className="text-muted">工廠登記</dt>
                      <dd className="text-ink">
                        {factory.factory.hasFactoryReg === true ? '有工廠登記' : factory.factory.hasFactoryReg === false ? '無' : '已驗證法人'}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted">{factory === undefined ? '載入中…' : '找不到這家工廠的資料。'}</p>
            )}
            <p className="text-sm text-muted">
              <span className="tabular font-mono">{need.interestedVendorIds.length}</span> 家廠商有興趣
            </p>
          </Card>
          <p className="text-sm text-muted">平台依需求推薦 2 家廠商，不開放競標；表達興趣只會讓工廠看到你。</p>
          <FeedbackNudge context="這種把工廠口語轉成標準需求表、只推薦 2 家不削價競標的機制，對您開發案源有幫助嗎？" />
        </aside>
      </div>
    </div>
  )
}
