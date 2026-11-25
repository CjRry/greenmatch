import { useMemo, useState, type ReactNode } from 'react'
import { Factory } from 'lucide-react'
import { emptyInventory } from '../../../core/domain/carbon'
import { nowIso } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useCollection, useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import type { CarbonInventory } from '../../../core/types'
import { Button, EmptyState, Field, PageHeader, Select, Skeleton, useToast } from '../../../ui'
import { EntryForm } from '../components/EntryForm'

const START_YEAR = 2026

export default function CarbonEntry() {
  const { company, role } = useSession()
  const all = useCollection('carbon')
  const header = (
    <PageHeader
      title="填寫活動數據"
      description="照電費單與燃料紀錄，逐月填入用電度數與燃料用量。"
      breadcrumbs={[{ label: '碳盤查', to: paths.carbon() }, { label: '填寫活動數據' }]}
      back={{ to: paths.carbon(), label: '碳盤查' }}
    />
  )

  if (company === undefined || all === undefined) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="載入中">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }
  if (role !== 'factory' || !company) {
    return (
      <>
        {header}
        <EmptyState
          icon={<Factory className="size-8" aria-hidden />}
          title="只有工廠可以填寫活動數據"
          body="請用工廠身分登入。可以從頁首的「示範登入」切換成示範工廠。"
        />
      </>
    )
  }
  return <YearPicker factoryId={company.id} inventories={all.filter((c) => c.factoryId === company.id)} header={header} />
}

function YearPicker({ factoryId, inventories, header }: { factoryId: string; inventories: CarbonInventory[]; header: ReactNode }) {
  const store = useStore()
  const { readOnly } = useStoreInfo()
  const toast = useToast()
  const latest = [...inventories].sort((a, b) => b.year - a.year)[0]?.year ?? START_YEAR
  const [year, setYear] = useState(latest)
  const years = useMemo(() => {
    const set = new Set<number>([START_YEAR, START_YEAR - 1, ...inventories.map((i) => i.year)])
    return [...set].sort((a, b) => b - a)
  }, [inventories])
  const inv = inventories.find((i) => i.year === year) ?? null

  async function create() {
    try {
      await store.set('carbon', emptyInventory(factoryId, year, nowIso()))
    } catch {
      toast({ title: '無法建立盤查', body: '資料沒有寫入，請稍後再試一次。', tone: 'error' })
    }
  }

  return (
    <>
      {header}
      <div className="flex flex-col gap-6">
        <div className="max-w-xs">
          <Field label="盤查年度">
            {(p) => (
              <Select {...p} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y} 年{inventories.some((i) => i.year === y) ? '' : '（尚未建立）'}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {inv ? (
          <EntryForm key={inv.id} inv={inv} />
        ) : (
          <EmptyState
            title={`${year} 年還沒有盤查資料`}
            body="建立後就能逐月填入用電度數與燃料用量。"
            action={
              <Button onClick={create} disabled={readOnly}>
                建立 {year} 年盤查
              </Button>
            }
          />
        )}
      </div>
    </>
  )
}
