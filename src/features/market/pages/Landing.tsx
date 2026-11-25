import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, ChevronDown, Eye, FilePlus2, FileSpreadsheet, LayoutList, Leaf, Plus, Timer } from 'lucide-react'
import { ETA_NOTE, STAGE_BY_KEY, STAGES } from '../../../core/constants/stages'
import { analyzeBillCheckup } from '../../../core/domain/billCheckup'
import { latestInventory } from '../../../core/domain/carbon'
import { resolveAnnualCarbonSummary, resolveFactoryFacts } from '../../../core/domain/factoryFacts'
import { formatNtd, formatNumber, formatTons } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection, useDoc } from '../../../core/store/StoreProvider'
import { vendorStats } from '../../../core/domain/vendorStats'
import { summarizeBacktest } from '../../../core/domain/publicCaseBacktest'
import { PUBLIC_CASES } from '../../../data/publicCases'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DemoBadge,
  FactSourceBadge,
  PUBLIC_CASE_DISCLAIMER,
  PublicCaseBadge,
  PublicCaseCard,
  PublicCaseStats,
  SectionTitle,
  Skeleton,
  StageBadge,
  Stat,
} from '../../../ui'
import { NeedCard } from '../components/NeedCard'
import { VendorCard } from '../components/VendorCard'
import { isFactory, isVendor, openNeeds } from '../lib/filters'

/** One lighting, one compressor, one chiller (ESCO) case on the first screen. */
const FEATURED_PUBLIC_CASES = ['pc01', 'pc04', 'pc06']

const HERO_SAMPLE_REPORT = analyzeBillCheckup({
  planId: 'hv_2stage',
  periods: [
    {
      label: '2026-08（夏月示範）',
      season: 'summer',
      contractKw: 200,
      maxDemandKw: 235,
      powerFactorPct: 74,
      totalKwh: 80_000,
      billAmountNtd: 419_006,
    },
  ],
})

const PILLARS = [
  { icon: LayoutList, title: '介面直覺', problem: '問題：找不到合適的節能廠商', body: '用口語說明設備與困擾，AI 整理成標準需求表，你只要確認。' },
  { icon: Eye, title: '流程透明', problem: '問題：不會選，流程也看不清楚', body: '平台推薦 2 家廠商並附理由；案件走 8 個標準階段，像包裹一樣隨時追蹤。' },
  { icon: Timer, title: '減少媒合時間', problem: '問題：來回詢價、比價很耗時', body: '報價由 AI 統一格式、白話解說，省下逐家對照的時間。' },
] as const

export default function Landing() {
  const companies = useCollection('companies')
  const needs = useCollection('needs')
  const cases = useCollection('cases')
  const reviews = useCollection('reviews')
  const carbon = useCollection('carbon')
  const demoFactory = useDoc('companies', 'f01')
  const demoVendor = useDoc('companies', 'v01')
  const { company, signInAs } = useSession()
  const navigate = useNavigate()
  const [showPitch, setShowPitch] = useState(false)

  const names = useMemo(() => new Map((companies ?? []).map((c) => [c.id, c.name])), [companies])
  const open = useMemo(() => openNeeds(needs ?? []), [needs])
  const vendors = useMemo(() => (companies ?? []).filter(isVendor), [companies])
  const topVendors = useMemo(
    () => [...vendors].sort((a, b) => vendorStats(b.id, reviews ?? []).bayes - vendorStats(a.id, reviews ?? []).bayes).slice(0, 3),
    [vendors, reviews],
  )

  const loading = companies === undefined || needs === undefined || cases === undefined

  const tryAs = (id: string, destination: string = paths.me()) => {
    signInAs(id)
    navigate(destination)
  }

  const myCases = useMemo(() => {
    if (!company || !cases) return []
    return company.role === 'factory'
      ? cases.filter((c) => c.factoryId === company.id)
      : cases.filter((c) => c.shortlist.includes(company.id) || c.selectedVendorId === company.id || c.recommendations.some((r) => r.vendorId === company.id))
  }, [company, cases])
  const myActiveCases = useMemo(() => myCases.filter((c) => c.status === 'active'), [myCases])
  const myInv = useMemo(() => (company?.role === 'factory' && carbon ? latestInventory(carbon, company.id) : null), [company, carbon])
  const myCarbonSummary = useMemo(() => {
    if (!myInv || company?.role !== 'factory') return null
    return resolveAnnualCarbonSummary(myInv, resolveFactoryFacts(company, myInv))
  }, [myInv, company])

  if (company) {
    return (
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4 rounded-md border border-brand bg-brand-soft p-5" aria-label="專屬工作台摘要">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{company.role === 'factory' ? '工廠工作台' : '節能廠商工作台'}</Badge>
                {company.isDemo ? <DemoBadge /> : <Badge tone="navy">專屬空白工作台</Badge>}
              </div>
              <h1 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                {company.name}・工作台摘要
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                {company.role === 'factory'
                  ? '直接從這裡進入進行中案件、AI 報價比較，或即時試算貴廠碳排放。'
                  : '直接從這裡查看受邀案件、進度追蹤，或前往需求市集找新案源。'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink to={paths.me()}>前往我的工作台</ButtonLink>
              {company.role === 'factory' ? (
                <>
                  <ButtonLink to={paths.billCheckup()} variant="secondary" icon={<FileSpreadsheet className="size-4" aria-hidden />}>
                    電費單健檢
                  </ButtonLink>
                  <ButtonLink to={paths.newNeed()} variant="secondary" icon={<FilePlus2 className="size-4" aria-hidden />}>
                    登記節能需求
                  </ButtonLink>
                  <ButtonLink to={paths.carbon()} variant="secondary" icon={<Leaf className="size-4" aria-hidden />}>
                    碳盤查即時試算
                  </ButtonLink>
                </>
              ) : (
                <ButtonLink to={paths.needs()} variant="secondary">
                  逛需求市集
                </ButtonLink>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="flex flex-col gap-1 bg-surface">
              <span className="text-xs text-muted">進行中案件</span>
              <span className="tabular font-mono text-2xl font-bold text-ink">{myActiveCases.length} 件</span>
              <Link to={paths.me()} className="text-xs font-medium text-brand-strong hover:underline">
                進入工作台管理全部案件 →
              </Link>
            </Card>
            {company.role === 'factory' ? (
              <Card className="flex flex-col gap-1 bg-surface">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted">年度碳盤查試算</span>
                  {myCarbonSummary ? <FactSourceBadge source={myCarbonSummary.factSource} variant="derived" /> : null}
                </div>
                <span className="tabular font-mono text-2xl font-bold text-brand-strong">
                  {myCarbonSummary ? formatTons(myCarbonSummary.displayTotalT) : '尚未建立'}
                </span>
                <Link to={paths.carbon()} className="text-xs font-medium text-brand-strong hover:underline">
                  {myCarbonSummary ? '開啟碳排即時試算器 →' : '立即用試算器建立 →'}
                </Link>
              </Card>
            ) : (
              <Card className="flex flex-col gap-1 bg-surface">
                <span className="text-xs text-muted">目前開放中工廠需求</span>
                <span className="tabular font-mono text-2xl font-bold text-brand-strong">{open.length} 筆</span>
                <Link to={paths.needs()} className="text-xs font-medium text-brand-strong hover:underline">
                  前往需求市集篩選案源 →
                </Link>
              </Card>
            )}
            <Card className="flex flex-col justify-between gap-2 bg-surface">
              <div>
                <span className="text-xs text-muted">不用示範資料，重新設定？</span>
                <p className="mt-0.5 text-sm font-medium text-ink">30 秒建立自己的空白公司</p>
              </div>
              <Link to={`${paths.register()}?mode=quick`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline">
                <Plus className="size-3.5" aria-hidden />
                從零建立新公司工作台 →
              </Link>
            </Card>
          </div>
        </section>

        <section className="flex flex-col gap-3" aria-label="我的最近案件">
          <SectionTitle
            title="進行中案件快捷入口"
            action={
              <Link to={paths.me()} className="text-sm font-medium text-brand-strong hover:underline">
                看全部我的案件
              </Link>
            }
          />
          {myActiveCases.length === 0 ? (
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">
                {company.role === 'factory'
                  ? '目前沒有進行中的案件，用口語描述設備與困擾即可立即媒合 2 家節能廠商。'
                  : '目前沒有進行中的案件，先去需求市集看看適合的開放案源。'}
              </p>
              <ButtonLink to={company.role === 'factory' ? paths.newNeed() : paths.needs()} size="sm">
                {company.role === 'factory' ? '登記第一筆節能需求' : '瀏覽需求市集'}
              </ButtonLink>
            </Card>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {myActiveCases.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <Link to={paths.case(c.id)} className="block rounded-md focus-visible:outline-2 focus-visible:outline-brand">
                    <Card className="flex flex-col gap-2 transition-colors hover:border-brand">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-display font-bold text-ink">{c.title}</span>
                        <StageBadge stage={c.stage} />
                      </div>
                      <p className="text-xs text-muted">目前階段：{STAGE_BY_KEY[c.stage].label}・點此開啟單頁案件中心</p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <PublicCasesSection />

        <div className="border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setShowPitch((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          >
            <ChevronDown className={`size-4 transition-transform ${showPitch ? 'rotate-180' : ''}`} aria-hidden />
            {showPitch ? '收合平台介紹與 8 階段說明' : '查看平台介紹與 8 階段說明'}
          </button>
        </div>

        {showPitch ? (
          <div className="flex flex-col gap-8">
            <PillarsSection tryAs={tryAs} showActionCards={false} />
            <StagesSection />
            <PlatformStatsSection
              loading={loading}
              factoryCount={(companies ?? []).filter(isFactory).length}
              vendorCount={vendors.length}
              openCount={open.length}
              completedCount={(cases ?? []).filter((c) => c.status === 'completed').length}
            />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start" aria-label="平台主張">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">免費電費與節能健檢・每個數字都有出處</Badge>
            <p className="text-xs font-medium tracking-wide text-brand-strong">綠媒 GreenMatch・中小企業節能與顧問工具</p>
          </div>
          <h1 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
            <span className="inline-block">免費電費與節能健檢：</span>
            <span className="inline-block">看電費單就知道現在能省多少、碳排多少</span>
          </h1>
          <p className="max-w-xl text-sm text-ink-soft sm:text-base">
            每個數字都有台電／能源署出處；先算清契約容量、功因與適用政府補助，確定有空間時再整理需求找節能廠商。
          </p>

          <div className="flex flex-wrap items-center gap-3" aria-label="主要行動入口">
            <ButtonLink to={paths.billCheckup()} size="lg" icon={<FileSpreadsheet className="size-4" aria-hidden />}>
              免費做電費單健檢
            </ButtonLink>
            <ButtonLink to={`${paths.register('factory')}&mode=quick`} variant="secondary" size="lg">
              用我的工廠資料開始
            </ButtonLink>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <Link to={paths.publicCases()} className="font-medium text-brand-strong hover:underline">
              看 10 筆公開案例實測 →
            </Link>
            <Link to={paths.methodology()} className="hover:text-ink hover:underline">
              公式與法源出處
            </Link>
            <Link to={paths.about()} className="hover:text-ink hover:underline">
              關於我們・資料只留瀏覽器
            </Link>
          </div>
        </div>

        <Card className="flex min-w-0 flex-col gap-4" aria-label="電費單 4 欄變成健檢報告 3 行結果">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted">電費單 4 欄（高壓二段式・夏月試算例）</p>
              <Badge tone="outline">免登入本機換算</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-sm border border-line bg-sunken px-3 py-2.5 text-xs">
              <span>
                契約容量：<strong className="tabular font-mono text-ink">200 kW</strong>
              </span>
              <span>
                最高需量：<strong className="tabular font-mono text-ink">235 kW</strong>
              </span>
              <span>
                功率因數：<strong className="tabular font-mono text-ink">74%</strong>
              </span>
              <span>
                本月用電：<strong className="tabular font-mono text-ink">80,000 度</strong>
              </span>
            </div>
          </div>

          <p className="flex items-center gap-2 text-sm font-medium text-brand-strong">
            <ArrowRight className="size-4 rotate-90" aria-hidden />
            健檢報告 3 行結果（每行附台電／能源署出處）
          </p>

          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="rounded-sm border border-line bg-surface px-3 py-2">
              <dt className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted">
                <span>1. 超約附加費</span>
                <Link to={`${paths.methodology()}#contract`} className="font-medium text-brand-strong hover:underline">
                  台電 114/10 ×2／×3 倍規則 ↗
                </Link>
              </dt>
              <dd className="mt-0.5 font-medium text-ink">
                當期超約 35 kW → 加收{' '}
                <span className="tabular font-mono font-bold text-danger">
                  NT$ {HERO_SAMPLE_REPORT.totalOverContractPenaltyNtd.toLocaleString('zh-TW')}
                </span>
              </dd>
            </div>
            <div className="rounded-sm border border-line bg-surface px-3 py-2">
              <dt className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted">
                <span>2. 功率因數調整費</span>
                <Link to={`${paths.methodology()}#pf`} className="font-medium text-brand-strong hover:underline">
                  台電營業規則 80%–95% ↗
                </Link>
              </dt>
              <dd className="mt-0.5 font-medium text-ink">
                74% 低於 80% 門檻（當期多繳 {formatNtd(HERO_SAMPLE_REPORT.totalPfAdjustmentNtd ?? 0)}），升至 95% 享 1.5% 減收
              </dd>
            </div>
            <div className="rounded-sm border border-line bg-surface px-3 py-2">
              <dt className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted">
                <span>3. 電力範疇二排碳</span>
                <Link to={`${paths.methodology()}#carbon`} className="font-medium text-brand-strong hover:underline">
                  能源署 114 年 {HERO_SAMPLE_REPORT.emissionFactorKgPerKwh} 係數 ↗
                </Link>
              </dt>
              <dd className="mt-0.5 font-medium text-ink">
                換算年外購電力排放約{' '}
                <span className="tabular font-mono font-bold text-ink">
                  {HERO_SAMPLE_REPORT.annualScope2T != null ? formatTons(HERO_SAMPLE_REPORT.annualScope2T) : '—'}
                </span>
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5 text-xs">
            <span className="text-muted">資料只存在你的瀏覽器，不外流給廠商</span>
            <Link to={paths.billCheckup()} className="font-semibold text-brand-strong hover:underline">
              試填這張帳單 →
            </Link>
          </div>
        </Card>
      </section>

      <PublicCasesSection />

      <details className="rounded-md border border-line bg-surface p-4">
        <summary className="cursor-pointer font-display text-sm font-bold text-ink">
          平台介紹（示範案件體驗、8 階段流程、近期需求與節能廠商）
        </summary>
        <div className="mt-6 flex flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line bg-sunken px-4 py-3">
            <p className="text-sm text-ink-soft">
              想體驗完整的媒合、報價比較與 8 階段追蹤？可點此切換示範工廠或廠商帳號（標有「示範」徽章，僅供體驗）。
            </p>
            <div className="flex flex-wrap gap-2">
              {demoFactory && isFactory(demoFactory) ? (
                <Button size="sm" variant="secondary" onClick={() => tryAs('f01', paths.caseMatch('c01'))}>
                  看示範
                </Button>
              ) : null}
              {demoVendor && isVendor(demoVendor) ? (
                <Button size="sm" variant="ghost" onClick={() => tryAs('v01', paths.needs())}>
                  我是節能廠商，看開放案源
                </Button>
              ) : null}
            </div>
          </div>
          <StagesSection />
          <PillarsSection tryAs={tryAs} showActionCards />
          <PlatformStatsSection
            loading={loading}
            factoryCount={(companies ?? []).filter(isFactory).length}
            vendorCount={vendors.length}
            openCount={open.length}
            completedCount={(cases ?? []).filter((c) => c.status === 'completed').length}
          />

          <section className="flex flex-col gap-3" aria-label="最新需求">
            <SectionTitle
              title="最新開放需求"
              action={
                <Link to={paths.needs()} className="text-sm font-medium text-brand-strong hover:underline">
                  看全部需求
                </Link>
              }
            />
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : open.length === 0 ? (
              <p className="text-sm text-muted">目前沒有開放中的需求。工廠登錄後，用口語登記第一筆需求，就會出現在這裡。</p>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-3">
                {open.slice(0, 3).map((n) => (
                  <li key={n.id}>
                    <NeedCard need={n} factoryName={names.get(n.factoryId)} compact />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3" aria-label="廠商預覽">
            <SectionTitle
              title="節能廠商"
              action={
                <Link to={paths.vendors()} className="text-sm font-medium text-brand-strong hover:underline">
                  看廠商名錄
                </Link>
              }
            />
            {loading || reviews === undefined ? (
              <Skeleton className="h-28 w-full" />
            ) : topVendors.length === 0 ? (
              <p className="text-sm text-muted">名錄裡還沒有廠商。節能廠商登錄公司後，會出現在這裡。</p>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-3">
                {topVendors.map((v) => (
                  <li key={v.id}>
                    <VendorCard vendor={v} stats={vendorStats(v.id, reviews)} compact />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </details>
    </div>
  )
}

function PillarsSection({ tryAs, showActionCards }: { tryAs: (id: string, to: string) => void; showActionCards: boolean }) {
  return (
    <section className="flex flex-col gap-4" aria-label="三大主軸">
      <SectionTitle title="為什麼用綠媒" />
      <ul className="grid gap-3 md:grid-cols-3">
        {PILLARS.map((p) => (
          <li key={p.title}>
            <Card className="flex h-full flex-col gap-2">
              <p.icon className="size-6 text-brand" aria-hidden />
              <h3 className="font-display text-lg font-bold text-ink">{p.title}</h3>
              <p className="text-sm font-medium text-ink-soft">{p.problem}</p>
              <p className="text-sm text-ink-soft">{p.body}</p>
            </Card>
          </li>
        ))}
      </ul>
      {showActionCards ? (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3 bg-brand-soft">
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-brand-strong">送出需求就幫你比對 7 項製造業政府補助</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                以 3 台 37 kW 空壓機（85 人工廠）為例，動力與公用設備補助依能源署 115 年基準估計約 <span className="tabular font-mono font-semibold text-ink">NT$ 12–43 萬</span>，報價滿 100 萬另可試算營所稅 5% 投資抵減（估算，以官方公告為準）。
              </p>
            </div>
            <Button size="sm" onClick={() => tryAs('f01', paths.caseMatch('c01'))}>
              試算我的補助
            </Button>
          </Card>
          <Card className="flex flex-wrap items-center justify-between gap-3 bg-sunken">
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-navy">給節能廠商／ESCO 的三個承諾：不搶標、不白跑、免平台抽成</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                ① 每案最多推薦 2 家合適廠商，不開放十幾家殺價競標；② 需求表預先整理設備馬力、月用電與場勘前追問，業務不白跑；③ 試用期間免費刊登，廠商可自主標示「可協助申請補助」並於報價階段檢附登錄機型與證明。
              </p>
            </div>
            <Button size="sm" variant="navy" onClick={() => tryAs('v01', paths.needs())}>
              廠商看開放案源
            </Button>
          </Card>
        </>
      ) : null}
      <Card className="grid gap-3 bg-surface sm:grid-cols-3" aria-label="資料來源與驗收可信機制">
        <div>
          <p className="font-display text-sm font-bold text-ink">補助條文附官方出處</p>
          <p className="mt-0.5 text-xs text-ink-soft">每項補助註明機關與年度依據；動力與 ESCO 不重複灌水，合計自動取較高者。</p>
        </div>
        <div>
          <p className="font-display text-sm font-bold text-ink">未稅同基準拆解比價</p>
          <p className="mt-0.5 text-xs text-ink-soft">兩家報價固定拆出設備費、施工費、保固與回本月數，並標示價差可能原因。</p>
        </div>
        <div>
          <p className="font-display text-sm font-bold text-ink">驗收節電紀錄可追溯</p>
          <p className="mt-0.5 text-xs text-ink-soft">8 階段事件只增不改；試用示範資料皆清楚標示，正式上線將逐案累計完工電費實績。</p>
        </div>
      </Card>
    </section>
  )
}

function StagesSection() {
  return (
    <section className="flex flex-col gap-4" aria-label="八個階段">
      <SectionTitle title="每個案件走 8 個標準階段" hint={ETA_NOTE} />
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s) => (
          <li key={s.key} className="flex gap-3 rounded-md border border-line bg-surface p-3">
            <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft font-mono text-sm font-bold text-brand-strong">{s.n}</span>
            <div className="min-w-0">
              <p className="font-medium text-ink">{s.label}</p>
              <p className="text-sm text-muted">
                {s.ownerLabel}・{s.eta}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function PlatformStatsSection({
  loading,
  factoryCount,
  vendorCount,
  openCount,
  completedCount,
}: {
  loading: boolean
  factoryCount: number
  vendorCount: number
  openCount: number
  completedCount: number
}) {
  return (
    <section className="flex flex-col gap-4" aria-label="平台現況">
      <SectionTitle title="平台現況" />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PublicCaseBadge />
          <p className="text-sm text-ink-soft">有出處的真實案例與回本回測</p>
        </div>
        <PublicCaseStats cases={PUBLIC_CASES} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DemoBadge />
          <p className="text-sm text-ink-soft">平台上的公司與案件目前都是虛構示範資料，不是真實用戶</p>
        </div>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-4 rounded-md border border-dashed border-line-strong bg-surface p-4 sm:grid-cols-4">
            <Stat label="工廠（示範）" value={formatNumber(factoryCount)} unit="家" />
            <Stat label="節能廠商（示範）" value={formatNumber(vendorCount)} unit="家" />
            <Stat label="開放中需求（示範）" value={formatNumber(openCount)} unit="筆" />
            <Stat label="已完成案件（示範）" value={formatNumber(completedCount)} unit="件" />
          </div>
        )}
      </div>
    </section>
  )
}

/** Real, sourced cases on the first screen (PROP-0006). Static data, so no loading state. */
function PublicCasesSection() {
  const summary = useMemo(() => summarizeBacktest(PUBLIC_CASES), [])
  const rowOf = new Map(summary.rows.map((r) => [r.caseId, r]))
  const featured = FEATURED_PUBLIC_CASES.map((id) => PUBLIC_CASES.find((c) => c.id === id)).filter((c) => c != null)
  const shown = featured.length ? featured : PUBLIC_CASES.slice(0, 3)
  return (
    <section className="flex flex-col gap-4" aria-label="公開節能案例">
      <SectionTitle
        title="真實公開案例：電費與回本換算準不準"
        hint={PUBLIC_CASE_DISCLAIMER}
        action={
          PUBLIC_CASES.length ? (
            <Link to={paths.publicCases()} className="text-sm font-medium text-brand-strong hover:underline">
              看全部 {PUBLIC_CASES.length} 筆與回測表
            </Link>
          ) : null
        }
      />
      {PUBLIC_CASES.length === 0 ? (
        <p className="text-sm text-muted">公開案例查證完成後會列在這裡，每筆都附來源連結與回測誤差。</p>
      ) : (
        <>
          <PublicCaseStats cases={PUBLIC_CASES} summary={summary} />
          <ul className="grid gap-3 lg:grid-cols-3">
            {shown.map((c) => (
              <li key={c.id}>
                <PublicCaseCard c={c} row={rowOf.get(c.id)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
