import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Archive, ChevronLeft, ChevronRight, CircleHelp, FilePlus2, FileSpreadsheet, Search, SearchX, Store, X } from 'lucide-react'
import { SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection } from '../../../core/store/StoreProvider'
import type { Company, Specialty } from '../../../core/types'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CompanyAvatar,
  DemoBadge,
  EmptyState,
  FilterChips,
  InstallCard,
  ProcessGlyph,
  RatingStars,
  SectionTitle,
  Skeleton,
  SpecialtyIcon,
  Tabs,
  VendorCollectionCard,
  coverTone,
  cx,
} from '../../../ui'
import { buildCollections, filterCollections, type CollectionSort, type VendorCollection } from '../lib/collections'

const SORT_TABS: { key: CollectionSort; label: string }[] = [
  { key: 'installs', label: '安裝最多' },
  { key: 'saving', label: '節電最高' },
  { key: 'rating', label: '評價最高' },
]

function isSort(v: string | null): v is CollectionSort {
  return v === 'installs' || v === 'saving' || v === 'rating'
}

/**
 * Home, laid out as a marketplace / directory: search first, then categories, featured, ranking,
 * latest items and every collection. Filters live in the URL so Back and shared links keep them.
 * The walkthroughs and samples live in 案例儲存庫.
 */
export default function Landing() {
  const companies = useCollection('companies')
  const reviews = useCollection('reviews')
  const cases = useCollection('cases')
  const { company } = useSession()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const specialty = (params.get('cat') ?? '') as Specialty | ''
  const sortParam = params.get('sort')
  const sort: CollectionSort = isSort(sortParam) ? sortParam : 'installs'
  const [draft, setDraft] = useState(q)
  // Keep the box in step with the URL (Back, a shared link, 清除篩選).
  useEffect(() => setDraft(q), [q])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const all = useMemo(() => (companies && reviews ? buildCollections(companies, reviews, sort) : undefined), [companies, reviews, sort])
  const byText = useMemo(() => (all ? filterCollections(all, '', q) : undefined), [all, q])
  const shown = useMemo(() => (byText ? filterCollections(byText, specialty) : undefined), [byText, specialty])
  const categories = useMemo(() => {
    const count = new Map<Specialty, number>()
    for (const c of byText ?? []) for (const s of c.vendor.vendor.specialties) count.set(s, (count.get(s) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1])
  }, [byText])
  const latest = useMemo(
    () =>
      (shown ?? [])
        .flatMap((c) => c.installs.filter((i) => !specialty || i.equip === specialty).map((i) => ({ install: i, collection: c })))
        .sort((a, b) => b.install.year * 100 + b.install.month - (a.install.year * 100 + a.install.month))
        .slice(0, 8),
    [shown, specialty],
  )

  const activeCases = useMemo(() => {
    if (!company || !cases) return 0
    return cases.filter(
      (c) =>
        c.status === 'active' &&
        (company.role === 'factory' ? c.factoryId === company.id : c.shortlist.includes(company.id) || c.selectedVendorId === company.id),
    ).length
  }, [company, cases])

  const loading = shown === undefined
  const filtering = Boolean(q || specialty)
  const clearFilters = () => {
    setDraft('')
    setParams({}, { replace: true })
  }

  return (
    <div className="flex flex-col gap-10">
      {company ? <WorkspaceStrip company={company} activeCases={activeCases} /> : null}

      <section className="flex flex-col gap-3" aria-label="搜尋節能廠商">
        <h1 className="sr-only">找節能廠商</h1>

        <form
          role="search"
          className="flex max-w-3xl flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            setParam('q', draft.trim())
          }}
        >
          <label htmlFor="home-search" className="sr-only">
            搜尋廠商、設備或產業
          </label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="home-search"
              type="search"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                if (!e.target.value) setParam('q', '')
              }}
              placeholder="例如：空壓機、食品加工、台南"
              enterKeyHint="search"
              className="h-12 w-full rounded-sm border border-line-strong bg-surface pr-3 pl-11 text-base text-ink placeholder:text-muted focus:border-brand"
            />
          </div>
          <Button type="submit" size="lg">
            搜尋廠商
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {company?.role !== 'vendor' ? (
            <>
              <Link to={paths.billCheckup()} className="inline-flex min-h-11 items-center gap-1.5 font-medium text-brand-strong hover:underline">
                <FileSpreadsheet className="size-4" aria-hidden />
                免費做電費單健檢
              </Link>
              <Link
                to={company ? paths.newNeed() : `${paths.register('factory')}&mode=quick`}
                className="inline-flex min-h-11 items-center gap-1.5 font-medium text-brand-strong hover:underline"
              >
                <FilePlus2 className="size-4" aria-hidden />
                登記節能需求
              </Link>
            </>
          ) : null}
          <Link to={paths.library('howto')} className="inline-flex min-h-11 items-center gap-1.5 text-muted hover:text-ink hover:underline">
            <CircleHelp className="size-4" aria-hidden />
            如何使用
          </Link>
        </div>
      </section>

      {categories.length ? (
        <FilterChips
          label="依設備類別篩選"
          items={[
            { key: '' as Specialty | '', label: '全部', count: byText?.length },
            ...categories.map(([s, n]) => ({ key: s as Specialty | '', label: SPECIALTY_LABEL[s], count: n, icon: s })),
          ]}
          value={specialty}
          onChange={(k) => setParam('cat', k)}
        />
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="載入中">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : shown.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={<SearchX className="size-6" aria-hidden />}
            title="找不到符合的廠商"
            body={`沒有廠商符合${q ? `「${q}」` : ''}${specialty ? `與「${SPECIALTY_LABEL[specialty]}」` : ''}。換個關鍵字，或清除篩選看全部廠商。`}
            action={
              <Button variant="secondary" onClick={clearFilters} icon={<X className="size-4" aria-hidden />}>
                清除篩選
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Store className="size-6" aria-hidden />}
            title="名錄裡還沒有節能廠商"
            body="節能廠商登錄公司並填寫實績案例後，就會以系列的形式出現在這裡。"
            action={<ButtonLink to={paths.register('vendor')}>登錄節能廠商</ButtonLink>}
          />
        )
      ) : (
        <>
          {filtering ? (
            <p className="-mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-soft" aria-live="polite">
              找到 <span className="tabular font-mono font-semibold text-ink">{shown.length}</span> 家廠商
              <button type="button" onClick={clearFilters} className="inline-flex min-h-11 items-center gap-1 px-1 font-medium text-brand-strong hover:underline">
                <X className="size-4" aria-hidden />
                清除篩選
              </button>
            </p>
          ) : null}

          <FeaturedCarousel key={`${q}|${specialty}|${sort}`} collections={shown.slice(0, 4)} />

          <section className="flex flex-col gap-3" aria-label="熱門節能廠商">
            <SectionTitle
              title="熱門節能廠商"
              action={
                <Link to={paths.vendors()} className="inline-flex min-h-11 items-center text-sm font-medium text-brand-strong hover:underline">
                  看廠商名錄
                </Link>
              }
            />
            <Tabs label="排序方式" items={SORT_TABS} value={sort} onChange={(k) => setParam('sort', k === 'installs' ? '' : k)} />
            <RankingTable collections={shown.slice(0, 10)} />
          </section>

          <section className="flex flex-col gap-3" aria-label="最新安裝紀錄">
            <SectionTitle
              title="最新安裝紀錄"
              action={
                <Link to={paths.library('howto')} className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink hover:underline">
                  <CircleHelp className="size-4" aria-hidden />
                  怎麼看封面
                </Link>
              }
            />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {latest.map(({ install, collection }) => (
                <li key={install.id}>
                  <InstallCard install={install} vendorName={collection.vendor.name} isDemo={collection.vendor.isDemo} />
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3" aria-label="全部廠商系列">
            <SectionTitle title="全部廠商系列" hint={`共 ${shown.length} 家`} />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((c) => (
                <li key={c.vendor.id}>
                  <VendorCollectionCard vendor={c.vendor} installs={c.installs} stats={c.stats} rating={c.rating} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Link to={paths.library()} className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-4 transition-colors duration-200 hover:border-brand">
          <span className="flex min-w-0 items-center gap-3">
            <Archive className="size-5 shrink-0 text-navy" aria-hidden />
            <span className="min-w-0">
              <span className="block font-display font-bold text-ink">案例儲存庫</span>
              <span className="block text-sm text-muted">電費單試算範例、真實公開案例、8 階段流程與示範帳號</span>
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
        </Link>
        {!company ? (
          <Link
            to={paths.register('vendor')}
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-4 transition-colors duration-200 hover:border-brand"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Store className="size-5 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0">
                <span className="block font-display font-bold text-ink">你是節能廠商？</span>
                <span className="block text-sm text-muted">登錄公司、填寫實績，建立你自己的安裝系列</span>
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function WorkspaceStrip({ company, activeCases }: { company: Company; activeCases: number }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-brand bg-brand-soft" aria-label="專屬工作台摘要">
      <div className="flex min-w-0 items-center gap-3">
        <CompanyAvatar name={company.name} id={company.id} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            {company.role === 'factory' ? '工廠工作台' : '節能廠商工作台'}
            {company.isDemo ? <DemoBadge /> : null}
          </p>
          <p className="font-display font-bold text-ink [overflow-wrap:anywhere]">{company.name}</p>
          <p className="text-xs text-ink-soft">
            進行中案件 <span className="tabular font-mono font-semibold text-ink">{activeCases}</span> 件
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <ButtonLink to={paths.me()}>前往我的工作台</ButtonLink>
        {company.role === 'vendor' ? (
          <ButtonLink to={paths.needs()} variant="secondary">
            逛需求市集
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  )
}

/** The spotlight: one collection at a time, its newest install large. Controls are 44 px. */
function FeaturedCarousel({ collections }: { collections: VendorCollection[] }) {
  const [i, setI] = useState(0)
  const idx = Math.min(i, collections.length - 1)
  const c = collections[idx]
  if (!c) return null
  const hero = c.installs[0]
  const go = (d: number) => setI((idx + d + collections.length) % collections.length)

  return (
    <section
      className="overflow-hidden rounded-md border border-line bg-surface shadow-[var(--gm-shadow)]"
      aria-label="精選廠商"
      aria-roledescription="輪播"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
    >
      <div className="grid md:grid-cols-[1.1fr_1fr]">
        <Link to={paths.vendor(c.vendor.id)} tabIndex={-1} aria-hidden className="grid h-56 grid-cols-3 grid-rows-2 gap-px bg-line sm:h-72">
          <div className={cx('col-span-2 row-span-2', hero ? coverTone(hero.equip) : 'bg-sunken')}>
            {hero ? <ProcessGlyph steps={hero.steps} savingPct={hero.savingPct} className="mx-auto size-full p-4" /> : null}
          </div>
          {[1, 2].map((k) => (
            <div key={k} className={c.installs[k] ? coverTone(c.installs[k].equip) : 'bg-sunken'}>
              {c.installs[k] ? <ProcessGlyph steps={c.installs[k].steps} savingPct={c.installs[k].savingPct} className="mx-auto size-full p-2" /> : null}
            </div>
          ))}
        </Link>
        <div className="flex min-w-0 flex-col gap-4 p-5" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="navy">
              精選廠商 <span className="tabular font-mono">{idx + 1}/{collections.length}</span>
            </Badge>
            {c.vendor.isDemo ? <DemoBadge /> : null}
          </div>
          <div className="flex items-center gap-3">
            <CompanyAvatar name={c.vendor.name} id={c.vendor.id} size="lg" />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-extrabold text-ink [overflow-wrap:anywhere] sm:text-2xl">{c.vendor.name}</h2>
              <p className="text-sm text-ink-soft">{c.vendor.vendor.tagline}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {c.stats.topEquips.slice(0, 4).map((e) => (
              <Badge key={e} tone="outline" icon={<SpecialtyIcon equip={e} className="size-3" />}>
                {SPECIALTY_LABEL[e]}
              </Badge>
            ))}
          </div>
          <dl className="grid grid-cols-3 gap-3 rounded-sm border border-line bg-sunken p-3">
            <div>
              <dt className="text-xs text-muted">安裝紀錄</dt>
              <dd className="tabular font-mono text-lg font-bold text-ink">{c.stats.count} 件</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">平均節電</dt>
              <dd className="tabular font-mono text-lg font-bold text-brand-strong">{c.stats.avgSavingPct != null ? `${c.stats.avgSavingPct}%` : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">中位工期</dt>
              <dd className="tabular font-mono text-lg font-bold text-ink">{c.stats.medianDays != null ? `${c.stats.medianDays} 天` : '—'}</dd>
            </div>
          </dl>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
            <ButtonLink to={paths.vendor(c.vendor.id)}>看 {c.stats.count} 件安裝紀錄</ButtonLink>
            {collections.length > 1 ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="inline-flex size-11 items-center justify-center rounded-sm border border-line bg-surface text-ink-soft transition-colors duration-150 hover:bg-sunken hover:text-ink"
                  aria-label="上一家精選廠商"
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <div className="flex">
                  {collections.map((x, k) => (
                    <button
                      key={x.vendor.id}
                      type="button"
                      onClick={() => setI(k)}
                      aria-label={`第 ${k + 1} 家：${x.vendor.name}`}
                      aria-current={k === idx ? 'true' : undefined}
                      className="inline-flex h-11 w-6 items-center justify-center"
                    >
                      <span className={cx('h-1.5 rounded-full transition-[width,background-color] duration-200', k === idx ? 'w-4 bg-navy' : 'w-1.5 bg-line-strong')} />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="inline-flex size-11 items-center justify-center rounded-sm border border-line bg-surface text-ink-soft transition-colors duration-150 hover:bg-sunken hover:text-ink"
                  aria-label="下一家精選廠商"
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

/** OpenSea-style ranking: two columns on wide screens (1–5, 6–10). Rows are 56 px links. */
function RankingTable({ collections }: { collections: VendorCollection[] }) {
  const half = Math.ceil(collections.length / 2)
  const cols = [collections.slice(0, half), collections.slice(half)].filter((c) => c.length)
  return (
    <div className="grid gap-x-8 lg:grid-cols-2">
      {cols.map((col, ci) => (
        <div key={ci} className={ci > 0 ? 'lg:block' : undefined}>
          <div className={cx('grid-cols-[2rem_1fr_4rem_4.5rem] gap-3 border-b border-line px-2 pb-2 text-xs text-muted', ci > 0 ? 'hidden lg:grid' : 'hidden sm:grid')} aria-hidden>
            <span>#</span>
            <span>廠商</span>
            <span className="text-right">安裝</span>
            <span className="text-right">平均節電</span>
          </div>
          <ol className="flex flex-col">
            {col.map((c, k) => (
              <li key={c.vendor.id}>
                <Link
                  to={paths.vendor(c.vendor.id)}
                  className="grid min-h-14 grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-sm px-2 py-2 transition-colors duration-150 hover:bg-sunken sm:grid-cols-[2rem_1fr_4rem_4.5rem]"
                >
                  <span className="tabular font-mono text-sm font-bold text-muted">{ci * half + k + 1}</span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <CompanyAvatar name={c.vendor.name} id={c.vendor.id} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink" title={c.vendor.name}>
                        {c.vendor.name}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <RatingStars avg={c.rating.avg} count={c.rating.count} showCount={false} className="text-xs" />
                        <span className="sm:hidden">
                          安裝 <span className="tabular font-mono">{c.stats.count}</span> 件
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className="tabular hidden text-right font-mono text-sm text-ink sm:block">{c.stats.count}</span>
                  <span className="tabular text-right font-mono text-sm font-semibold text-brand-strong">
                    {c.stats.avgSavingPct != null ? `${c.stats.avgSavingPct}%` : '—'}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}
