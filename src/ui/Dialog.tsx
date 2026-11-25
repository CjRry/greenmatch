import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button, type ButtonVariant } from './Button'

/**
 * In-page modal. The claude.ai viewer ignores alert/confirm/prompt, so every confirmation step
 * uses this instead. Escape and the backdrop close it.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-overlay" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative m-0 max-h-[90%] w-full overflow-y-auto rounded-t-md border border-line bg-surface p-5 shadow-card outline-none sm:m-4 sm:max-w-lg sm:rounded-md"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))' }}
      >
        <h2 id={titleId} className="font-display text-lg font-bold text-ink">
          {title}
        </h2>
        <div className="mt-3 text-ink-soft">{children}</div>
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  )
}

/** A yes/no confirmation built on Dialog. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = '取消',
  variant = 'primary',
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: ReactNode
  body: ReactNode
  confirmLabel: string
  cancelLabel?: string
  variant?: ButtonVariant
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} busy={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  )
}
