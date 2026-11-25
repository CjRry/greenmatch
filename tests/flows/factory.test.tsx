import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { routes } from '../../src/app/routes'
import type { CaseEvent } from '../../src/core/types'
import { renderApp } from '../../src/test/renderPage'

vi.setConfig({ testTimeout: 20_000 })

const EXAMPLE = '我們工廠空壓機有 3 台，都用了十幾年，最近電費越來越高，夏天冷氣也很耗電'

describe('工廠 f10：登記需求 → 推薦 → 邀請 → 場勘', () => {
  it('走完整條流程，案件進入 survey 並邀請 2 家', async () => {
    const { store, router } = renderApp(routes, { url: '/new-need', companyId: 'f10' })

    // 1. 描述需求，走規則式整理（本機沒有 Claude）
    fireEvent.change(await screen.findByLabelText(/需求描述/), { target: { value: EXAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: /整理需求/ }))
    expect(await screen.findByText('整理的結果需要你確認，確認後才會送出。')).toBeTruthy()
    expect((screen.getByLabelText('第 1 列數量') as HTMLInputElement).value).toBe('3')

    // 2. 確認送出 → 推薦頁
    fireEvent.click(screen.getByRole('button', { name: '下一步：確認送出' }))
    fireEvent.click(await screen.findByRole('button', { name: '確認送出' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/cases\/[^/]+\/match$/))
    const caseId = router.state.location.pathname.split('/')[2]

    // 3. 推薦頁顯示 2 家
    expect(await screen.findByText(/推薦分數 = Σ/)).toBeTruthy()
    expect((await screen.findAllByText(/^推薦第 \d 名$/)).length).toBe(2)
    const made = (await store.get('cases', caseId))!
    expect(made.factoryId).toBe('f10')
    expect(made.stage).toBe('assess')
    expect(made.recommendations).toHaveLength(2)
    for (const r of made.recommendations) expect(r.reasonText.trim()).not.toBe('')

    // 4. 邀請 → survey
    fireEvent.click(screen.getByRole('button', { name: /邀請這 2 家場勘/ }))
    fireEvent.click(await screen.findByRole('button', { name: '邀請場勘' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/cases/${caseId}`))

    const after = (await store.get('cases', caseId))!
    expect(after.stage).toBe('survey')
    expect([...after.shortlist].sort()).toEqual(made.recommendations.map((r) => r.vendorId).sort())
    expect((await store.get('needs', after.needId))!.status).toBe('matched')

    // 5. 歷史只增不改：有登記與邀請事件
    const all = await new Promise<readonly CaseEvent[]>((resolve) => {
      const off = store.subscribe('caseEvents', (docs) => {
        off()
        resolve(docs)
      })
    })
    const events = all.filter((e) => e.caseId === caseId)
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events.some((e) => e.stage === 'assess')).toBe(true)

    // 6. 案件追蹤頁看得到階段
    expect((await screen.findAllByText('現場場勘')).length).toBeGreaterThan(0)
  }, 20_000)

  it('廠商身分進不了登記需求', async () => {
    renderApp(routes, { url: '/new-need', companyId: 'v01' })
    expect(await screen.findByText('節能廠商無法登記需求')).toBeTruthy()
  })

  it('工廠「我的」看得到自己的案件、碳盤查入口', async () => {
    renderApp(routes, { url: '/me', companyId: 'f01' })
    expect(await screen.findByRole('button', { name: /場勘報價/ })).toBeTruthy()
    const link = screen.getByRole('link', { name: '查看碳盤查' })
    expect(within(link.parentElement as HTMLElement)).toBeTruthy()
  })
})
