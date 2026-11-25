import { useState } from 'react'
import { Database, HardDrive, FlaskConical } from 'lucide-react'
import { useStoreInfo } from '../core/store/StoreProvider'
import { ConfirmDialog, useToast } from '../ui'

/** One quiet line telling the viewer where their data goes. */
export function ModeBanner() {
  const { mode, readOnly, resetDemo } = useStoreInfo()
  const toast = useToast()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  const icon =
    mode === 'db' ? <Database className="size-3.5" aria-hidden /> : mode === 'fakedb' ? <FlaskConical className="size-3.5" aria-hidden /> : <HardDrive className="size-3.5" aria-hidden />
  const text =
    mode === 'db'
      ? readOnly
        ? '共享資料・你目前只能瀏覽，無法修改'
        : '共享資料・所有試用者看到同一份資料'
      : mode === 'fakedb'
        ? '測試模式・資料只在這次開啟期間有效'
        : '本機示範模式・資料只存在這個瀏覽器'

  return (
    <div className="bg-sunken text-xs text-muted">
      <div className="gutter mx-auto flex max-w-6xl items-center gap-2 py-1.5">
        {icon}
        <span>{text}</span>
        {resetDemo ? (
          <button type="button" className="ml-auto underline underline-offset-2 hover:text-ink" onClick={() => setAsking(true)}>
            重設示範資料
          </button>
        ) : null}
      </div>
      {resetDemo ? (
        <ConfirmDialog
          open={asking}
          title="重設示範資料？"
          body="你在這個瀏覽器新增或修改的公司、需求與案件都會清除，回到原本的示範內容。"
          confirmLabel="重設"
          variant="danger"
          busy={busy}
          onCancel={() => setAsking(false)}
          onConfirm={async () => {
            setBusy(true)
            await resetDemo()
            setBusy(false)
            setAsking(false)
            toast({ title: '已重設示範資料' })
          }}
        />
      ) : null}
    </div>
  )
}
