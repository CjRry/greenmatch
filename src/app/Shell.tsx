import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { Archive, BookOpen, Building2, ClipboardList, Compass, FilePlus2, FileSpreadsheet, House, Leaf, MessageSquareHeart, MoreHorizontal, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { paths } from '../core/paths'
import { useSession } from '../core/session'
import { useCollection } from '../core/store/StoreProvider'
import type { Role } from '../core/types'
import { cx } from '../ui'
import { ModeBanner } from './ModeBanner'
import { PersonaSwitcher } from './PersonaSwitcher'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

function navFor(role: Role | null): { top: NavItem[]; bottom: NavItem[] } {
  const home: NavItem = { to: paths.home(), label: '首頁', icon: <House className="size-5" aria-hidden />, end: true }
  const vendors: NavItem = { to: paths.vendors(), label: '廠商名錄', icon: <Building2 className="size-5" aria-hidden /> }
  const needs: NavItem = { to: paths.needs(), label: '需求市集', icon: <ClipboardList className="size-5" aria-hidden /> }
  const me: NavItem = { to: paths.me(), label: '我的資料', icon: <UserRound className="size-5" aria-hidden />, end: true }
  const feedback: NavItem = {
    to: paths.feedback(),
    label: '試用回饋',
    icon: <MessageSquareHeart className="size-5" aria-hidden />,
    end: true,
  }
  if (role === 'factory') {
    const factoryFacts: NavItem = { to: paths.profile(), label: '工廠數據', icon: <SlidersHorizontal className="size-5" aria-hidden />, end: true }
    const newNeed: NavItem = { to: paths.newNeed(), label: '登記需求', icon: <FilePlus2 className="size-5" aria-hidden /> }
    const billCheckup: NavItem = { to: paths.billCheckup(), label: '電費單健檢', icon: <FileSpreadsheet className="size-5" aria-hidden />, end: true }
    const carbon: NavItem = { to: paths.carbon(), label: '碳盤查', icon: <Leaf className="size-5" aria-hidden /> }
    return { top: [me, billCheckup, factoryFacts, newNeed, carbon, vendors], bottom: [home, billCheckup, factoryFacts, newNeed, me] }
  }
  const library: NavItem = { to: paths.library(), label: '案例儲存庫', icon: <Archive className="size-5" aria-hidden />, end: true }
  if (role === 'vendor') return { top: [me, needs, vendors, library], bottom: [home, needs, vendors, me, feedback] }
  const billCheckup: NavItem = { to: paths.billCheckup(), label: '電費單健檢', icon: <FileSpreadsheet className="size-5" aria-hidden />, end: true }
  const about: NavItem = { to: paths.about(), label: '關於我們', icon: <ShieldCheck className="size-5" aria-hidden />, end: true }
  return { top: [billCheckup, library, vendors, needs, about], bottom: [home, billCheckup, library, vendors] }
}

/** The deck's hub diagram as a mark: the platform in the middle, a factory and a vendor on each side. */
function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <line x1="6" y1="16" x2="26" y2="16" className="stroke-brand" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="7" className="fill-brand" />
      <circle cx="5" cy="16" r="4" className="fill-navy" />
      <circle cx="27" cy="16" r="4" className="fill-navy" />
      <path d="M13 17.5c0-3 2-5 5.5-5.2-.2 3.4-2.3 5.6-5.5 5.2Z" className="fill-on-brand" />
    </svg>
  )
}

interface GuideStep {
  to: string
  label: string
  /** If set and the viewer does not own this demo record, switch to this demo persona first. */
  demoPersonaId?: string
}

function TrialGuideBar({ role, isDemo }: { role: Role | null; isDemo: boolean }) {
  const { companyId, signInAs } = useSession()
  const cases = useCollection('cases')
  const quotes = useCollection('quotes')
  const navigate = useNavigate()
  const location = useLocation()

  const factoryCases = (cases ?? [])
    .filter((c) => c.factoryId === companyId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const ownFactoryCaseId = factoryCases[0]?.id
  // Step ③ shows quotes, so it goes to the newest case that has any (OBS-0004 §2-6: the newest demo
  // case c12 has none). Falls back to the demo case c01.
  const quotedCaseIds = new Set((quotes ?? []).map((q) => q.caseId))
  const ownQuotedCaseId = factoryCases.find((c) => quotedCaseIds.has(c.id))?.id

  const vendorCases = (cases ?? [])
    .filter((c) => c.shortlist.includes(companyId ?? '') || c.selectedVendorId === companyId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const ownVendorCaseId = vendorCases[0]?.id

  // The home page is the marketplace only; the walkthrough lives in 案例儲存庫 → 如何使用 / 示範體驗.
  if (location.pathname === '/') return null
  if (!role && (location.pathname === '/bill-checkup' || location.pathname === '/about' || location.pathname === '/methodology')) return null
  if (role && !isDemo && ((role === 'factory' && factoryCases.length > 0) || (role === 'vendor' && vendorCases.length > 0))) {
    return null
  }

  const quickTry = (targetCompanyId: string, targetPath: string) => {
    signInAs(targetCompanyId)
    navigate(targetPath)
  }

  const factorySteps: GuideStep[] = [
    { to: paths.newNeed(), label: '① 口語登記需求' },
    {
      to: paths.caseMatch(ownFactoryCaseId ?? 'c01'),
      label: '② 推薦與補助試算',
      demoPersonaId: ownFactoryCaseId || companyId === 'f01' ? undefined : 'f01',
    },
    {
      to: paths.caseQuotes(ownQuotedCaseId ?? 'c01'),
      label: '③ 報價比價與回本',
      demoPersonaId: ownQuotedCaseId || companyId === 'f01' ? undefined : 'f01',
    },
    {
      to: paths.case(ownFactoryCaseId ?? 'c01'),
      label: '④ 8 階段追蹤',
      demoPersonaId: ownFactoryCaseId || companyId === 'f01' ? undefined : 'f01',
    },
  ]

  const vendorSteps: GuideStep[] = [
    { to: paths.needs(), label: '① 需求市集找案源' },
    { to: paths.need('n14'), label: '② 標準需求表規格' },
    {
      to: paths.case(ownVendorCaseId ?? 'c02'),
      label: '③ 受邀案件工作台',
      demoPersonaId: ownVendorCaseId || companyId === 'v01' ? undefined : 'v01',
    },
    { to: paths.vendor(companyId ?? 'v01'), label: '④ 實績與補助標章' },
  ]

  const renderSteps = (steps: GuideStep[]) =>
    steps.map((s) => {
      const active = location.pathname === s.to
      const cls = cx(
        'rounded-sm border px-2 py-0.5 transition-colors',
        active
          ? 'border-brand bg-brand font-bold text-on-brand'
          : 'border-line-strong bg-surface text-ink-soft hover:border-brand hover:text-ink',
      )
      if (s.demoPersonaId) {
        const personaId = s.demoPersonaId
        return (
          <button
            key={s.label}
            type="button"
            onClick={() => quickTry(personaId, s.to)}
            title="切換示範身分預覽此步驟"
            className={cls}
          >
            {s.label}
          </button>
        )
      }
      return (
        <Link key={s.label} to={s.to} className={cls}>
          {s.label}
        </Link>
      )
    })

  return (
    <div className="border-b border-line bg-brand-soft" role="region" aria-label="3 分鐘試用導覽">
      <div className="gutter mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 py-2 text-xs">
        {role === 'factory' ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 font-display font-bold text-brand-strong">
              <Compass className="size-3.5" aria-hidden />
              工廠 3 分鐘體驗：
            </span>
            {renderSteps(factorySteps)}
          </div>
        ) : role === 'vendor' ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 font-display font-bold text-brand-strong">
              <Compass className="size-3.5" aria-hidden />
              廠商 3 分鐘體驗：
            </span>
            {renderSteps(vendorSteps)}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 font-display font-bold text-brand-strong">
              <Compass className="size-3.5" aria-hidden />
              免註冊一鍵體驗：
            </span>
            <button
              type="button"
              onClick={() => quickTry('f01', paths.caseMatch('c01'))}
              className="rounded-sm border border-line-strong bg-surface px-2 py-0.5 font-medium text-ink hover:border-brand"
            >
              切換工廠視角（永豐金屬）
            </button>
            <button
              type="button"
              onClick={() => quickTry('v01', paths.needs())}
              className="rounded-sm border border-line-strong bg-surface px-2 py-0.5 font-medium text-ink hover:border-brand"
            >
              切換廠商視角（綠能節電）
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function Shell() {
  const { role, company } = useSession()
  const nav = navFor(role)
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  const visitorMoreItems: NavItem[] = [
    { to: paths.needs(), label: '需求市集', icon: <ClipboardList className="size-4" aria-hidden /> },
    { to: paths.about(), label: '關於我們與隱私', icon: <ShieldCheck className="size-4" aria-hidden />, end: true },
    { to: paths.methodology(), label: '方法與公式出處', icon: <BookOpen className="size-4" aria-hidden />, end: true },
    { to: paths.feedback(), label: '試用回饋', icon: <MessageSquareHeart className="size-4" aria-hidden />, end: true },
  ]

  const hideDemoBanner =
    !role &&
    (location.pathname === '/bill-checkup' || location.pathname === '/about' || location.pathname === '/methodology')

  return (
    <div className="flex min-h-dvh flex-col">
      {hideDemoBanner ? null : (
        <div className="print:hidden">
          <ModeBanner />
        </div>
      )}
      <header className="sticky z-40 border-b border-line bg-surface print:hidden" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="gutter mx-auto flex h-14 max-w-6xl items-center gap-2 sm:gap-5">
          <Link to={paths.home()} className="flex shrink-0 items-center gap-2" aria-label="綠媒 GreenMatch 首頁">
            <BrandMark />
            <span className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-ink">綠媒</span>
              <span className="hidden font-display text-sm font-bold tracking-tight text-brand-strong sm:inline">GreenMatch</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="主要導覽">
            {nav.top.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx('rounded-sm px-3 py-1.5 text-sm whitespace-nowrap transition-colors', isActive ? 'bg-brand-soft font-bold text-brand-strong' : 'text-ink-soft hover:bg-sunken hover:text-ink')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <NavLink
              to={paths.feedback()}
              className={({ isActive }) =>
                cx(
                  'inline-flex items-center gap-1 rounded-sm border px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors sm:px-2.5 sm:text-sm',
                  isActive
                    ? 'border-brand bg-brand text-on-brand'
                    : 'border-brand bg-brand-soft text-brand-strong hover:bg-brand hover:text-on-brand',
                )
              }
            >
              <MessageSquareHeart className="size-3.5 shrink-0" aria-hidden />
              <span>試用回饋</span>
            </NavLink>
            <PersonaSwitcher />
          </div>
        </div>
      </header>
      <div className="print:hidden">
        <TrialGuideBar role={role} isDemo={company?.isDemo ?? false} />
      </div>

      <main className="gutter mx-auto w-full max-w-6xl flex-1 pt-6 pb-28 md:pb-12 print:py-0">
        <Outlet />
      </main>

      <footer className="border-t border-line pb-20 md:pb-0 print:hidden">
        <div className="gutter mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 py-5 text-xs text-muted">
          <span>綠媒 GreenMatch・中小企業節能與顧問工具</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to={paths.about()} className="hover:text-ink hover:underline">
              關於我們與資料隱私
            </Link>
            <Link to={paths.methodology()} className="hover:text-ink hover:underline">
              方法與公式出處
            </Link>
            <Link to={paths.needs()} className="hover:text-ink hover:underline">
              需求市集
            </Link>
            <span>國立成功大學・2026 全國 AI 專題創意競賽參賽作品</span>
          </div>
        </div>
      </footer>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden print:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="底部導覽"
      >
        {moreOpen && role === null ? (
          <div className="gutter border-b border-line bg-sunken py-2" role="region" aria-label="更多導覽選項">
            <div className="grid grid-cols-2 gap-2">
              {visitorMoreItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2 text-xs font-medium',
                      isActive ? 'border-brand font-bold text-brand-strong' : 'text-ink-soft hover:text-ink',
                    )
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ) : null}
        <ul className="gutter flex">
          {nav.bottom.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx('flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'font-bold text-brand-strong' : 'text-muted')
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
          {role === null ? (
            <li className="flex-1">
              <button
                type="button"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
                className={cx(
                  'flex w-full flex-col items-center gap-0.5 py-2 text-[11px]',
                  moreOpen ? 'font-bold text-brand-strong' : 'text-muted',
                )}
              >
                <MoreHorizontal className="size-5" aria-hidden />
                <span>更多</span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>
      <ScrollRestoration />
    </div>
  )
}
