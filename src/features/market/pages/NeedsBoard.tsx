import { useMemo, useState } from 'react'
import { ClipboardList, Search } from 'lucide-react'
import { REGIONS, type Region } from '../../../core/constants/geo'
import { SCALE_SHORT, SPECIALTIES, SPECIALTY_LABEL } from '../../../core/constants/equipment'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection } from '../../../core/store/StoreProvider'
import type { ScaleTier, Specialty } from '../../../core/types'
import { Button, ButtonLink, ChipGroup, EmptyState, PageHeader, Select, SkeletonList, Tabs, TextInput } from '../../../ui'
import { NeedCard } from '../components/NeedCard'
import { EMPTY_NEED_FILTER, filterNeeds, isVendor, matchesVendor, openNeeds, sortByFit, type NeedFilter } from '../lib/filters'

const equipOptions = SPECIALTIES.map((s) => ({ value: s, label: SPECIALTY_LABEL[s] }))

export default function NeedsBoard() {
  const needs = useCollection('needs')
  const companies = useCollection('companies')
  const { company } = useSession()
  const [f, setF] = useState<NeedFilter>(EMPTY_NEED_FILTER)
  const [sort, setSort] = useState<'latest' | 'fit'>('latest')
  const vendor = isVendor(company) ? company : null

  const names = useMemo(() => new Map((companies ?? []).map((c) => [c.id, c.name])), [companies])
  const byId = useMemo(() => new Map((companies ?? []).map((c) => [c.id, c])), [companies])
  const open = useMemo(() => openNeeds(needs ?? []), [needs])
  const shown = useMemo(() => {
    const list = filterNeeds(open, names, f)
    return vendor && sort === 'fit' ? sortByFit(list, vendor) : list
  }, [open, names, f, vendor, sort])

  const filtered = f.equips.length > 0 || !!f.region || !!f.scale || !!f.q.trim()

  return (
    <div>
      <PageHeader title="需求市集" description="目前開放中的節能需求。平台依需求推薦 2 家廠商，不開放競標；表達興趣可讓工廠看到你。" />

      {needs === undefined || companies === undefined ? (
        <SkeletonList rows={4} />
      ) : open.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" aria-hidden />}
          title="目前沒有開放中的需求"
          body="工廠登記節能需求並送出後，就會出現在這裡。還沒有公司？先登錄工廠，再用口語描述需求，AI 會幫你整理成標準需求表。"
          action={<ButtonLink to={paths.register('factory')}>登錄工廠</ButtonLink>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <section aria-label="篩選" className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
              <label className="relative block">
                <span className="sr-only">搜尋需求</span>
                <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted" aria-hidden />
                <TextInput className="pl-9" placeholder="搜尋標題、工廠名稱或問題" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
              </label>
              <label>
                <span className="sr-only">地區</span>
                <Select value={f.region} onChange={(e) => setF({ ...f, region: e.target.value as Region | '' })}>
                  <option value="">全部地區</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                <span className="sr-only">工廠規模</span>
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
            <ChipGroup label="設備或服務" options={equipOptions} value={f.equips} onChange={(v: Specialty[]) => setF({ ...f, equips: v })} />
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft" aria-live="polite">
              符合 <span className="tabular font-mono font-medium text-ink">{shown.length}</span> 筆開放需求
              {filtered ? (
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => setF(EMPTY_NEED_FILTER)}>
                  清除篩選
                </Button>
              ) : null}
            </p>
            {vendor ? (
              <Tabs
                label="排序"
                value={sort}
                onChange={setSort}
                items={[
                  { key: 'latest', label: '最新刊登' },
                  { key: 'fit', label: '最符合我的專長' },
                ]}
              />
            ) : null}
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={<Search className="size-6" aria-hidden />} title="沒有符合條件的需求" body="放寬設備、地區或規模條件再試一次。" action={<Button variant="secondary" onClick={() => setF(EMPTY_NEED_FILTER)}>清除篩選</Button>} />
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((n) => (
                <li key={n.id}>
                  <NeedCard
                    need={n}
                    factoryName={names.get(n.factoryId)}
                    factoryDoc={byId.get(n.factoryId)}
                    fit={matchesVendor(n, vendor)}
                    inServiceArea={!vendor || vendor.vendor.serviceCities.includes(n.city)}
                    vendorId={vendor?.id}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
