import { useState } from 'react'
import { Heart } from 'lucide-react'
import { useStore, useStoreInfo } from '../../../core/store/StoreProvider'
import { nowIso } from '../../../core/format'
import type { Need } from '../../../core/types'
import { Button, useToast } from '../../../ui'

/** 「我有興趣」 toggle for a vendor. Only records interest; no quote, no bid. */
export function InterestButton({ need, vendorId, size = 'sm' }: { need: Need; vendorId: string; size?: 'sm' | 'md' }) {
  const store = useStore()
  const { readOnly } = useStoreInfo()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const on = need.interestedVendorIds.includes(vendorId)

  async function toggle() {
    setBusy(true)
    try {
      const next = on ? need.interestedVendorIds.filter((id) => id !== vendorId) : [...need.interestedVendorIds, vendorId]
      await store.update('needs', need.id, { interestedVendorIds: next, updatedAt: nowIso() })
      toast({ title: on ? '已取消興趣' : '已表達興趣', body: on ? undefined : '工廠可以在需求頁看到你。', tone: 'success' })
    } catch {
      toast({ title: '沒有儲存成功', body: '請稍後再按一次「我有興趣」。', tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant={on ? 'primary' : 'secondary'}
      size={size}
      busy={busy}
      disabled={readOnly}
      aria-pressed={on}
      title={readOnly ? '目前是唯讀模式，無法儲存' : undefined}
      icon={<Heart className={on ? 'size-4 fill-current' : 'size-4'} aria-hidden />}
      onClick={toggle}
    >
      {on ? '已表達興趣' : '我有興趣'}
    </Button>
  )
}
