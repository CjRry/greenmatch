import { useNavigate } from 'react-router'
import { UserRound } from 'lucide-react'
import { nowIso } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useSession } from '../../../core/session'
import { useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import type { FactoryFactKey } from '../../../core/types'
import { ButtonLink, Card, EmptyState, PageHeader, SkeletonList, useToast } from '../../../ui'
import { CompanyForm } from '../components/CompanyForm'
import { buildCompany, draftFromCompany, type CompanyDraft } from '../lib/companyForm'

export default function EditProfile() {
  const { company } = useSession()
  const store = useStore()
  const { readOnly } = useStoreInfo()
  const navigate = useNavigate()
  const toast = useToast()

  if (company === undefined) return <SkeletonList rows={4} />
  if (company === null) {
    return (
      <div>
        <PageHeader title="編輯公司資料" />
        <EmptyState
          icon={<UserRound className="size-6" aria-hidden />}
          title="還沒有登入身分"
          body="先登錄你的公司，或用頁首的「示範登入」切換成示範公司，才能編輯資料。"
          action={<ButtonLink to={paths.register()}>登錄公司</ButtonLink>}
        />
      </div>
    )
  }

  const isFactory = company.role === 'factory'
  const title = isFactory ? '我的工廠數據' : '編輯公司資料'

  async function save(draft: CompanyDraft, confirmedFactKeys?: FactoryFactKey[]) {
    if (!company) return
    try {
      const next = buildCompany(draft, company.role, {
        id: company.id,
        now: nowIso(),
        existing: company,
        confirmedFactKeys,
      })
      await store.update('companies', company.id, next)
      toast({ title: isFactory ? '已儲存工廠數據' : '已儲存公司資料', tone: 'success' })
      navigate(paths.me())
    } catch {
      toast({ title: '沒有儲存成功', body: '修改沒有送出，請稍後再按一次「儲存變更」。', tone: 'error' })
    }
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={isFactory ? `${company.name} — 所有補助資格、回本與碳排試算都以此為單一來源` : company.name}
        back={{ to: paths.me(), label: '回到我的工作台' }}
      />
      <Card className="max-w-3xl">
        <CompanyForm
          key={company.id}
          role={company.role}
          initial={draftFromCompany(company)}
          existingFactory={isFactory ? company : null}
          stepped={false}
          submitLabel="儲存變更"
          readOnly={readOnly}
          readOnlyReason="目前是唯讀模式，修改無法儲存。"
          onSubmit={save}
          onCancel={() => navigate(paths.me())}
        />
      </Card>
    </div>
  )
}
