import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, Eye, FileSpreadsheet, LayoutList, Layers, ShieldCheck, Tag, Timer } from 'lucide-react'
import { ETA_NOTE, STAGES } from '../../../core/constants/stages'
import { analyzeBillCheckup } from '../../../core/domain/billCheckup'
import type { InstallStep } from '../../../core/domain/installs'
import { summarizeBacktest } from '../../../core/domain/publicCaseBacktest'
import { formatNtd, formatNumber, formatTons } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection } from '../../../core/store/StoreProvider'
import { PUBLIC_CASES } from '../../../data/publicCases'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  DemoBadge,
  PageHeader,
  ProcessGlyph,
  PUBLIC_CASE_DISCLAIMER,
  PublicCaseBadge,
  PublicCaseCard,
  PublicCaseStats,
  SectionTitle,
  Skeleton,
  Stat,
  Tabs,
} from '../../../ui'
import { NeedCard } from '../components/NeedCard'
import { isFactory, isVendor, openNeeds } from '../lib/filters'

type LibraryTab = 'howto' | 'bill' | 'public' | 'stages' | 'about' | 'demo'

const TABS: { key: LibraryTab; label: string }[] = [
  { key: 'howto', label: '如何使用' },
  { key: 'bill', label: '電費單健檢範例' },
  { key: 'public', label: '真實公開案例' },
  { key: 'stages', label: '8 階段流程' },
  { key: 'about', label: '平台介紹' },
  { key: 'demo', label: '示範體驗' },
]

/** One lighting, one compressor, one chiller (ESCO) case. */
const FEATURED_PUBLIC_CASES = ['pc01', 'pc04', 'pc06']

const SAMPLE_REPORT = analyzeBillCheckup({
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

function isTab(v: string | null): v is LibraryTab {
  return TABS.some((t) => t.key === v)
}

/** 案例儲存庫: the walkthroughs and samples that used to fill the home page. */
export default function CaseLibrary() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: LibraryTab = isTab(raw) ? raw : 'howto'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="案例儲存庫"
        breadcrumbs={[{ label: '首頁', to: paths.home() }, { label: '案例儲存庫' }]}
        description="使用說明、電費單試算範例、有出處的公開節能案例、8 階段流程與示範帳號，都收在這裡。"
      />
      <Tabs label="案例儲存庫分類" items={TABS} value={tab} onChange={(k) => setParams({ tab: k }, { replace: true })} />
      {tab === 'howto' ? <HowTo /> : null}
      {tab === 'bill' ? <BillSample /> : null}
      {tab === 'public' ? <PublicCasesSection /> : null}
      {tab === 'stages' ? <StagesSection /> : null}
      {tab === 'about' ? <AboutSection /> : null}
      {tab === 'demo' ? <DemoSection /> : null}
    </div>
  )
}

/** A made-up install, only to explain how to read a cover. */
const SAMPLE_STEPS: InstallStep[] = STAGES.map((s) => ({
  stage: s.key,
  n: s.n,
  label: s.label,
  days: ({ register: 1, assess: 2, survey: 12, quote: 8, contract: 21, construction: 4, acceptance: 3, compare: 30 } as const)[s.key],
  note: '',
  extra: s.key === 'survey' || s.key === 'contract' ? '示意' : undefined,
}))

const PRINCIPLES = [
  { icon: Layers, title: '每件案子都走同樣 8 個階段', body: '從需求登記到用電比對，各廠商的每件安裝都用同一把尺記錄，做法不同的地方逐項標出。' },
  { icon: ShieldCheck, title: '每案只推薦 2 家並附理由', body: '工廠登記需求後，平台依專長、距離、實績、評價與規模推薦 2 家，不開放十幾家殺價競標。' },
  { icon: Tag, title: '示範資料一律標「示範」', body: '目前平台上的公司、案件與安裝紀錄都是虛構示範資料，卡片與頁首都會標出。' },
] as const

function HowTo() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-3xl flex-col gap-2" aria-label="平台在做什麼">
        <h2 className="font-display text-xl font-bold text-ink">看節能廠商做過的每一件案子</h2>
        <p className="text-ink-soft">
          首頁每家節能廠商是一個系列，裡面是他的歷史安裝紀錄。同一家廠商的案子都走同樣的 8 個階段，但補助、場勘、施工方式各有不同，點進去就能逐件比較。
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-label="怎麼找廠商">
        <SectionTitle title="怎麼找廠商" />
        <ol className="grid gap-3 md:grid-cols-3">
          {[
            { n: 1, t: '搜尋或選類別', b: '在首頁搜尋列輸入設備、產業或地區（例如「空壓機」「食品加工」「台南」），或點設備類別縮小範圍。' },
            { n: 2, t: '進廠商頁看安裝紀錄', b: '每家廠商的安裝紀錄可依設備篩選，並依完成時間、節電率或工期排序。' },
            { n: 3, t: '點一件看完整流程', b: '單件頁列出 8 個階段各花幾天、這件和標準不同的地方，以及和同廠商其他案子比較的特徵。' },
          ].map((s) => (
            <li key={s.n} className="flex gap-3 rounded-md border border-line bg-surface p-4">
              <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft font-mono text-sm font-bold text-brand-strong">{s.n}</span>
              <div className="min-w-0">
                <p className="font-medium text-ink">{s.t}</p>
                <p className="mt-1 text-sm text-ink-soft">{s.b}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3" aria-label="怎麼看封面">
        <SectionTitle title="怎麼看安裝紀錄的封面" />
        <div className="grid items-center gap-6 md:grid-cols-[16rem_1fr]">
          <div className="mx-auto w-full max-w-64 rounded-md border border-line bg-brand-soft">
            <ProcessGlyph steps={SAMPLE_STEPS} savingPct={24} numbered className="aspect-square w-full p-4" title="封面示意圖" />
          </div>
          <ul className="flex flex-col gap-3 text-sm text-ink-soft">
            <li>
              <span className="font-medium text-ink">8 片花瓣＝8 個階段。</span>從 12 點鐘方向順時針是 1 需求登記到 8 用電比對，花瓣越長，那個階段花的天數越多。
            </li>
            <li>
              <span className="font-medium text-ink">黑點＝做法與標準不同。</span>例如多一次複勘、先申請補助再簽約、夜間施工。點進單件頁會寫出是哪裡不同。
            </li>
            <li>
              <span className="font-medium text-ink">外圈綠弧＝節電率。</span>繞一整圈是 100%；碳盤查等不計節電率的案子沒有綠弧。
            </li>
            <li>
              <span className="font-medium text-ink">底色＝工程類別。</span>綠底是電力設備（空壓、馬達、照明、泵浦），藍底是冷熱設備（空調、冰水、鍋爐、熱泵），黃底是管理與顧問（能源管理、太陽能、碳盤查）。
            </li>
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-label="平台原則">
        <SectionTitle title="平台原則" />
        <ul className="grid gap-3 md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <li key={p.title} className="flex gap-3 rounded-md border border-line bg-surface p-4">
              <p.icon className="mt-0.5 size-5 shrink-0 text-navy" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium text-ink">{p.title}</p>
                <p className="mt-1 text-sm text-ink-soft">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function BillSample() {
  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start" aria-label="電費單健檢範例">
      <div className="flex min-w-0 flex-col gap-3">
        <Badge tone="brand" className="w-fit">免費電費與節能健檢・每個數字都有出處</Badge>
        <h2 className="font-display text-xl font-bold text-ink">看電費單就知道現在能省多少、碳排多少</h2>
        <p className="text-sm text-ink-soft">
          每個數字都有台電／能源署出處；先算清契約容量、功因與適用政府補助，確定有空間時再整理需求找節能廠商。
        </p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={paths.billCheckup()} icon={<FileSpreadsheet className="size-4" aria-hidden />}>
            免費做電費單健檢
          </ButtonLink>
          <ButtonLink to={paths.methodology()} variant="secondary">
            公式與法源出處
          </ButtonLink>
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
              <span className="tabular font-mono font-bold text-danger">NT$ {SAMPLE_REPORT.totalOverContractPenaltyNtd.toLocaleString('zh-TW')}</span>
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
              74% 低於 80% 門檻（當期多繳 {formatNtd(SAMPLE_REPORT.totalPfAdjustmentNtd ?? 0)}），升至 95% 享 1.5% 減收
            </dd>
          </div>
          <div className="rounded-sm border border-line bg-surface px-3 py-2">
            <dt className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted">
              <span>3. 電力範疇二排碳</span>
              <Link to={`${paths.methodology()}#carbon`} className="font-medium text-brand-strong hover:underline">
                能源署 114 年 {SAMPLE_REPORT.emissionFactorKgPerKwh} 係數 ↗
              </Link>
            </dt>
            <dd className="mt-0.5 font-medium text-ink">
              換算年外購電力排放約{' '}
              <span className="tabular font-mono font-bold text-ink">
                {SAMPLE_REPORT.annualScope2T != null ? formatTons(SAMPLE_REPORT.annualScope2T) : '—'}
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
  )
}

/** Real, sourced cases (PROP-0006). Static data, so no loading state. */
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
              <p className="mt-1 text-xs text-ink-soft">{s.what}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function AboutSection() {
  const companies = useCollection('companies')
  const needs = useCollection('needs')
  const cases = useCollection('cases')
  const loading = companies === undefined || needs === undefined || cases === undefined
  return (
    <div className="flex flex-col gap-8">
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
              <Stat label="工廠（示範）" value={formatNumber(companies.filter(isFactory).length)} unit="家" />
              <Stat label="節能廠商（示範）" value={formatNumber(companies.filter(isVendor).length)} unit="家" />
              <Stat label="開放中需求（示範）" value={formatNumber(openNeeds(needs).length)} unit="筆" />
              <Stat label="已完成案件（示範）" value={formatNumber(cases.filter((c) => c.status === 'completed').length)} unit="件" />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function DemoSection() {
  const companies = useCollection('companies')
  const needs = useCollection('needs')
  const { signInAs } = useSession()
  const navigate = useNavigate()
  const names = useMemo(() => new Map((companies ?? []).map((c) => [c.id, c.name])), [companies])
  const open = useMemo(() => openNeeds(needs ?? []), [needs])
  const hasFactory = (companies ?? []).some((c) => c.id === 'f01' && isFactory(c))
  const hasVendor = (companies ?? []).some((c) => c.id === 'v01' && isVendor(c))
  const tryAs = (id: string, to: string) => {
    signInAs(id)
    navigate(to)
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" aria-label="示範帳號">
        <SectionTitle title="用示範帳號走一遍" hint="示範工廠與廠商都標有「示範」徽章，資料只存在這個瀏覽器。" />
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="flex flex-col gap-2 bg-brand-soft">
            <p className="font-display font-bold text-brand-strong">工廠視角：送出需求就幫你比對 7 項製造業政府補助</p>
            <p className="text-sm text-ink-soft">
              以 3 台 37 kW 空壓機（85 人工廠）為例，動力與公用設備補助依能源署 115 年基準估計約{' '}
              <span className="tabular font-mono font-semibold text-ink">NT$ 12–43 萬</span>，報價滿 100 萬另可試算營所稅 5% 投資抵減（估算，以官方公告為準）。
            </p>
            {hasFactory ? (
              <Button size="sm" className="w-fit" onClick={() => tryAs('f01', paths.caseMatch('c01'))}>
                以示範工廠看推薦與補助
              </Button>
            ) : null}
          </Card>
          <Card className="flex flex-col gap-2 bg-sunken">
            <p className="font-display font-bold text-navy">廠商視角：不搶標、不白跑、免平台抽成</p>
            <p className="text-sm text-ink-soft">
              每案最多推薦 2 家合適廠商；需求表預先整理設備馬力、月用電與場勘前追問；試用期間免費刊登，可標示「可協助申請補助」。
            </p>
            {hasVendor ? (
              <Button size="sm" variant="navy" className="w-fit" onClick={() => tryAs('v01', paths.needs())}>
                以示範廠商看開放案源
              </Button>
            ) : null}
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-label="最新需求">
        <SectionTitle
          title="最新開放需求"
          action={
            <Link to={paths.needs()} className="text-sm font-medium text-brand-strong hover:underline">
              看全部需求
            </Link>
          }
        />
        {needs === undefined || companies === undefined ? (
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
    </div>
  )
}
