import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { FeedbackNudge } from './FeedbackNudge'

describe('FeedbackNudge', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('shows once per session and suppresses subsequent mounts', () => {
    const first = render(
      <MemoryRouter>
        <FeedbackNudge context="第一頁流程完成" />
      </MemoryRouter>,
    )
    expect(screen.getByText('試用體驗如何？給成大團隊 30 秒回饋')).toBeTruthy()
    first.unmount()

    render(
      <MemoryRouter>
        <FeedbackNudge context="第二頁流程" />
      </MemoryRouter>,
    )
    expect(screen.queryByText('試用體驗如何？給成大團隊 30 秒回饋')).toBeNull()
  })

  it('can be dismissed cleanly', () => {
    render(
      <MemoryRouter>
        <FeedbackNudge context="可關閉提示" />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: '關閉試用回饋提醒' }))
    expect(screen.queryByText('試用體驗如何？給成大團隊 30 秒回饋')).toBeNull()
  })
})
