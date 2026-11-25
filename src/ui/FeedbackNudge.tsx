import { useEffect, useState } from 'react'
import { MessageSquareHeart, X } from 'lucide-react'
import { paths } from '../core/paths'
import { ButtonLink } from './Button'
import { Card } from './Card'

const NUDGE_STORAGE_KEY = 'gm_feedback_nudge_seen'

function canShowNudge(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(NUDGE_STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}

function markNudgeSeen(): void {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(NUDGE_STORAGE_KEY, '1')
  } catch {
    // Ignore storage unavailability
  }
}

/**
 * Gentle prompt shown at most once per session after the visitor completes a first workflow step
 * so trial visitors can jump to the 30-second feedback form without cluttering every page footer.
 */
export function FeedbackNudge({
  context,
  nextStep,
}: {
  context: string
  nextStep?: { to: string; label: string }
}) {
  const [visible, setVisible] = useState<boolean>(() => canShowNudge())

  useEffect(() => {
    if (visible) markNudgeSeen()
  }, [visible])

  if (!visible) return null

  return (
    <Card className="flex flex-col gap-3 border-brand bg-brand-soft sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <MessageSquareHeart className="mt-0.5 size-5 shrink-0 text-brand-strong" aria-hidden />
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-brand-strong">試用體驗如何？給成大團隊 30 秒回饋</p>
          <p className="mt-0.5 text-xs text-ink-soft">{context}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {nextStep ? (
          <ButtonLink to={nextStep.to} variant="secondary" size="sm">
            {nextStep.label}
          </ButtonLink>
        ) : null}
        <ButtonLink to={paths.feedback()} size="sm">
          填寫試用回饋
        </ButtonLink>
        <button
          type="button"
          aria-label="關閉試用回饋提醒"
          onClick={() => {
            markNudgeSeen()
            setVisible(false)
          }}
          className="rounded-sm p-1.5 text-brand-strong hover:bg-surface"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </Card>
  )
}
