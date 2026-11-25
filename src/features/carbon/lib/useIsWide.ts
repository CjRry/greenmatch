import { useEffect, useState } from 'react'

const QUERY = '(min-width: 768px)'

/** True on tablet/desktop widths. Falls back to false (mobile layout) when matchMedia is missing. */
export function useIsWide(): boolean {
  const mq = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null)
  const [wide, setWide] = useState(() => mq()?.matches ?? false)
  useEffect(() => {
    const m = mq()
    if (!m) return
    const on = () => setWide(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}
