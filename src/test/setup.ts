import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  try {
    window.localStorage.clear()
  } catch {
    // happy-dom always has storage; real browsers may not.
  }
})
