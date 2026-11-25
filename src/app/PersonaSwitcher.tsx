import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronDown, LogOut, Plus } from 'lucide-react'
import { paths } from '../core/paths'
import { useSession } from '../core/session'
import { useCollection } from '../core/store/StoreProvider'
import type { Company } from '../core/types'
import { Button, CompanyAvatar, DemoBadge, Dialog, TextInput, useToast } from '../ui'

/** Demo sign-in: act as any registered company. */
export function PersonaSwitcher() {
  const { company, signInAs, signOut } = useSession()
  const companies = useCollection('companies')
  const navigate = useNavigate()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const list = [...(companies ?? [])]
      .filter((c) => !q || c.name.includes(q) || c.city.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
    return {
      factory: list.filter((c) => c.role === 'factory'),
      vendor: list.filter((c) => c.role === 'vendor'),
    }
  }, [companies, q])

  const choose = (c: Company) => {
    signInAs(c.id)
    setOpen(false)
    toast({ title: `已切換為「${c.name}」`, tone: 'info' })
    navigate(paths.me())
  }

  return (
    <>
      {company ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex max-w-[10.5rem] min-w-0 items-center gap-2 rounded-sm border border-line px-2 py-1 text-left hover:bg-sunken sm:max-w-[16rem]"
          aria-label={`目前身分：${company.name}，切換身分`}
        >
          <CompanyAvatar name={company.name} id={company.id} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{company.name}</span>
            <span className="block text-[11px] text-muted">{company.role === 'factory' ? '工廠' : '節能廠商'}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          示範登入
        </Button>
      )}

      <Dialog
        open={open}
        title="選擇示範身分"
        onClose={() => setOpen(false)}
        footer={
          <>
            {company ? (
              <Button
                variant="ghost"
                icon={<LogOut className="size-4" aria-hidden />}
                onClick={() => {
                  signOut()
                  setOpen(false)
                  navigate(paths.home())
                }}
              >
                登出
              </Button>
            ) : null}
            <Button
              variant="secondary"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => {
                setOpen(false)
                navigate(`${paths.register()}?mode=quick`)
              }}
            >
              從零建立空白公司
            </Button>
          </>
        }
      >
        <p className="text-sm">Demo 不需要密碼。選一家公司，就能用它的角度操作平台。</p>
        <TextInput className="mt-3" placeholder="搜尋公司名稱或縣市" value={q} onChange={(e) => setQ(e.target.value)} aria-label="搜尋公司" />
        {(['factory', 'vendor'] as const).map((role) => (
          <section key={role} className="mt-4">
            <h3 className="mb-1 text-xs font-bold tracking-wide text-muted">{role === 'factory' ? '工廠' : '節能廠商'}</h3>
            <ul className="flex flex-col">
              {groups[role].map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => choose(c)}
                    className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left hover:bg-sunken"
                    aria-current={company?.id === c.id || undefined}
                  >
                    <CompanyAvatar name={c.name} id={c.id} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{c.name}</span>
                      <span className="block text-xs text-muted">{c.city}</span>
                    </span>
                    {c.isDemo ? <DemoBadge /> : null}
                  </button>
                </li>
              ))}
              {groups[role].length === 0 ? <li className="px-2 py-2 text-sm text-muted">沒有符合的公司</li> : null}
            </ul>
          </section>
        ))}
      </Dialog>
    </>
  )
}
