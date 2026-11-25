import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronDown, Search, SlidersHorizontal, Store } from 'lucide-react'
import { CITIES, CITY_INFO, REGIONS, type Region } from '../../../core/constants/geo'
import { INDUSTRIES, SCALE_SHORT, SPECIALTIES, SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { sameIndustrySummary } from '../../../core/domain/matching'
import { vendorStats } from '../../../core/domain/vendorStats'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection } from '../../../core/store/StoreProvider'
import type { PublicVendor, ScaleTier, Specialty } from '../../../core/types'
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  PageHeader,
  PublicVendorCard,
  SectionTitle,
  Select,
  SkeletonList,
  StandardQuoteTool,
  SurveyInquiryDialog,
  TextInput,
  type InquiryFactoryContext,
} from '../../../ui'
import { PUBLIC_VENDOR_DISCLAIMER, PUBLIC_VENDORS, PUBLIC_VENDORS_CHECKED_DATE } from '../../../data/publicVendors'
import { VendorCard } from '../components/VendorCard'
import { EMPTY_VENDOR_FILTER, filterVendors, isFactory, isVendor, type VendorFilter, type VendorSort } from '../lib/filters'

function initialSpecialty(raw: string | null): Specialty | '' {
  return raw && (SPECIALTIES as readonly string[]).includes(raw) ? (raw as Specialty) : ''
}

function parseOptionalPosNum(raw: string | null): number | null {
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function filterPublicVendors(items: readonly PublicVendor[], f: VendorFilter): PublicVendor[] {
  const q = f.q.trim().toLowerCase()
  return items.filter((pv) => {
    if (f.specialty && !pv.specialties.includes(f.specialty)) return false
    if (f.city && pv.city !== f.city && !pv.serviceRegions.includes(f.city.replace(/[市縣]$/, ''))) return false
    if (f.region && CITY_INFO[pv.city as keyof typeof CITY_INFO]?.region !== f.region && !pv.serviceRegions.includes(f.region.slice(0, 1))) return false
    if (q) {
      const hay = [pv.name, pv.shortDesc, pv.city, pv.serviceRegions, ...pv.registryTags].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export default function VendorDirectory() {
  const [params] = useSearchParams()
  const companies = useCollection('companies')
  const reviews = useCollection('reviews')
  const cases = useCollection('cases')
  const { company } = useSession()
  const [f, setF] = useState<VendorFilter>(() => ({ ...EMPTY_VENDOR_FILTER, specialty: initialSpecialty(params.get('specialty')) }))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [inquiryVendor, setInquiryVendor] = useState<PublicVendor | null>(null)

  const vendors = useMemo(() => (companies ?? []).filter(isVendor), [companies])
  const shown = useMemo(
    () => filterVendors(vendors, reviews ?? [], f, { companies: companies ?? [], cases: cases ?? [] }),
    [vendors, reviews, f, companies, cases],
  )
  const shownPublic = useMemo(() => filterPublicVendors(PUBLIC_VENDORS, f), [f])
  const activeSelectCount = [f.specialty, f.industry, f.region || f.city, f.scale].filter(Boolean).length
  const filtered = !!f.specialty || !!f.industry || !!f.region || !!f.city || !!f.scale || !!f.q.trim()
  const clear = () => setF({ ...EMPTY_VENDOR_FILTER, sort: f.sort })
  const targetIndustry = f.industry || (isFactory(company) ? company.factory.industry : '')

  const factoryContext = useMemo<InquiryFactoryContext>(() => {
    const paramKw = parseOptionalPosNum(params.get('kw'))
    const paramBill = parseOptionalPosNum(params.get('bill'))
    const paramFlow = parseOptionalPosNum(params.get('flow'))
    const paramHours = parseOptionalPosNum(params.get('hours'))
    const fInfo = isFactory(company) ? company.factory : null
    return {
      factoryName: isFactory(company) ? company.name : null,
      city: isFactory(company) ? company.city : null,
      industry: fInfo?.industry ?? null,
      equipmentSummary: f.specialty ? SPECIALTY_LABEL[f.specialty] : null,
      dailyHours: paramHours ?? fInfo?.dailyHours ?? null,
      monthlyElectricBillNtd: paramBill ?? fInfo?.monthlyElectricBillNtd ?? null,
      contractKw: paramKw ?? fInfo?.contractKw ?? null,
      airFlowNote: paramFlow ? `約 ${paramFlow} m³/min` : null,
    }
  }, [company, f.specialty, params])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="廠商名錄" description="先查經濟部能源署與 ESCO 公會公開廠商資料、複製標準場勘詢價單，或貼上報價比較 9 項重點。" />

      {isFactory(company) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-brand-soft px-4 py-3 text-brand-strong">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            不知道選哪家？登記需求，平台優先媒合合作過{company.factory.industry}同業的 2 家廠商
            <Link to={paths.newNeed()} className="font-bold underline">
              登記需求
            </Link>
          </p>
          <Button
            size="sm"
            variant={f.industry === company.factory.industry ? 'primary' : 'secondary'}
            onClick={() => setF({ ...f, industry: f.industry === company.factory.industry ? '' : company.factory.industry })}
          >
            {f.industry === company.factory.industry
              ? `已篩選本廠同業（${company.factory.industry}）`
              : `只看合作過本廠同業（${company.factory.industry}）`}
          </Button>
        </div>
      ) : null}

      <section aria-label="篩選" className="grid gap-3 rounded-md border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">搜尋廠商</span>
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted" aria-hidden />
            <TextInput className="pl-9" placeholder="搜尋廠商名稱、服務或認證" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          </label>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="vendor-filter-selects"
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-sunken sm:hidden"
          >
            <SlidersHorizontal className="size-4 text-muted" aria-hidden />
            <span>篩選{activeSelectCount > 0 ? ` (${activeSelectCount})` : ''}</span>
            <ChevronDown className={`size-4 text-muted transition-transform ${filtersOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        </div>
        <div
          id="vendor-filter-selects"
          className={filtersOpen ? 'grid gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-4' : 'hidden sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-3 lg:col-span-3 lg:grid-cols-4'}
        >
          <label>
            <span className="mb-1 block text-sm text-ink-soft">服務項目</span>
            <Select value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value as Specialty | '' })}>
              <option value="">全部服務</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {SPECIALTY_LABEL[s]}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="mb-1 block text-sm text-ink-soft">曾合作產業（平台廠商）</span>
            <Select value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })}>
              <option value="">全部產業</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="mb-1 block text-sm text-ink-soft">服務地區</span>
            <Select
              value={f.city || f.region}
              onChange={(e) => {
                const v = e.target.value
                setF({ ...f, region: (REGIONS as readonly string[]).includes(v) ? (v as Region) : '', city: (CITIES as readonly string[]).includes(v) ? v : '' })
              }}
            >
              <option value="">全部地區</option>
              <optgroup label="整區">
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </optgroup>
              <optgroup label="縣市">
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
            </Select>
          </label>
          <label>
            <span className="mb-1 block text-sm text-ink-soft">適合規模（平台廠商）</span>
            <Select value={f.scale} onChange={(e) => setF({ ...f, scale: e.target.value as ScaleTier | '' })}>
              <option value="">全部規模</option>
              {(['S', 'M', 'L'] as ScaleTier[]).map((s) => (
                <option key={s} value={s}>
                  {SCALE_SHORT[s]}工廠
                </option>
              ))}
            </Select>
          </label>
        </div>
      </section>

      {/* Real public vendor registry list (PROP-0007 4c) */}
      <section aria-label="真實廠商公開名單" className="flex flex-col gap-3">
        <SectionTitle
          title="真實廠商公開名單（找廠商工具包）"
          hint={`${PUBLIC_VENDOR_DISCLAIMER}・核對日期 ${PUBLIC_VENDORS_CHECKED_DATE}・依能源署補助產品系統與 ESCO 公會公開資訊整理，不顯示平台星等`}
          action={<Badge tone="outline">共 {shownPublic.length} 家公開廠商</Badge>}
        />
        {shownPublic.length === 0 ? (
          <EmptyState
            icon={<Search className="size-6" aria-hidden />}
            title="公開名單中沒有符合篩選的廠商"
            body="請清除關鍵字或放寬地區、設備類型篩選。"
            action={<Button variant="secondary" onClick={clear}>清除篩選</Button>}
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {shownPublic.map((pv) => (
              <li key={pv.id}>
                <PublicVendorCard vendor={pv} onSelectInquiry={setInquiryVendor} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Standalone 1-page simplified 9-field quote comparison & risk checker */}
      <section aria-label="簡化標準報價表工具" className="flex flex-col gap-3">
        <StandardQuoteTool />
      </section>

      {/* Platform / Demo vendor directory kept separated below */}
      <section aria-label="平台示範與已登錄廠商" className="flex flex-col gap-4 border-t border-line pt-6">
        <SectionTitle
          title="平台示範與已登錄廠商名錄"
          hint="下列名單包含示範廠商資料（供流程體驗），可看同業合作實績與平台流程；真實接洽請參考上方公開名單"
        />

        {companies === undefined || reviews === undefined ? (
          <SkeletonList rows={4} />
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={<Store className="size-6" aria-hidden />}
            title="名錄裡還沒有廠商"
            body="節能廠商登錄公司後會出現在這裡。如果你是廠商，先登錄你的公司並填寫服務項目與服務縣市。"
            action={<ButtonLink to={paths.register('vendor')}>登錄節能廠商</ButtonLink>}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-soft" aria-live="polite">
                符合 <span className="tabular font-mono font-medium text-ink">{shown.length}</span> 家平台廠商
                {filtered ? (
                  <Button variant="ghost" size="sm" className="ml-2" onClick={clear}>
                    清除篩選
                  </Button>
                ) : null}
              </p>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                排序
                <Select className="w-auto" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as VendorSort })}>
                  <option value="rating">評價高到低</option>
                  <option value="cases">實績多到少</option>
                  <option value="response">回覆最快</option>
                </Select>
              </label>
            </div>

            {shown.length === 0 ? (
              <EmptyState icon={<Search className="size-6" aria-hidden />} title="沒有符合條件的平台廠商" body="放寬服務項目、地區或規模再試一次。" action={<Button variant="secondary" onClick={clear}>清除篩選</Button>} />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {shown.map((v) => {
                  const sameCount = targetIndustry ? sameIndustrySummary(v, targetIndustry, companies ?? [], cases ?? []).caseCount : 0
                  return (
                    <li key={v.id}>
                      <VendorCard vendor={v} stats={vendorStats(v.id, reviews)} targetIndustry={targetIndustry} sameIndustryCount={sameCount} />
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </section>

      <SurveyInquiryDialog vendor={inquiryVendor} factoryContext={factoryContext} onClose={() => setInquiryVendor(null)} />
    </div>
  )
}
