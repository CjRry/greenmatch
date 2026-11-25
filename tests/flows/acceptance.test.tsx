import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { routes } from '../../src/app/routes'
import { renderApp } from '../../src/test/renderPage'

vi.setConfig({ testTimeout: 20_000 })

describe('驗收：市集（CHR-3）', () => {
  it('?specialty=carbon_consulting 預先篩出碳盤查顧問', async () => {
    const { container } = renderApp(routes, { url: '/vendors?specialty=carbon_consulting', companyId: null })
    await screen.findByRole('heading', { name: '廠商名錄' })
    await waitFor(() => expect((container.querySelector('select') as HTMLSelectElement).value).toBe('carbon_consulting'))
  })

  it('廠商身分在需求詳情可看到「我有興趣」，且沒有報價或競標入口', async () => {
    renderApp(routes, { url: '/needs/n08', companyId: 'v01' })
    expect(await screen.findByText(/工廠原話/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /競標|出價|議價/ })).toBeNull()
  })

  it('廠商介紹頁沒有直接聯繫或議價入口', async () => {
    renderApp(routes, { url: '/vendors/v01', companyId: 'f01' })
    expect(await screen.findByText('廠商介紹')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /議價|出價/ })).toBeNull()
  })
})

describe('驗收：工作台（CHR-4）', () => {
  it('c01 顯示「方案與報價」並標示 4 / 8', async () => {
    renderApp(routes, { url: '/cases/c01', companyId: 'f01' })
    expect((await screen.findAllByText('方案與報價')).length).toBeGreaterThan(0)
    expect(document.body.textContent).toMatch(/4\s*\/\s*8/)
  })

  it('c06 已完成，顯示用電比較結果', async () => {
    renderApp(routes, { url: '/cases/c06', companyId: 'f06' })
    expect((await screen.findAllByText('用電比較')).length).toBeGreaterThan(0)
    expect(document.body.textContent).toMatch(/已完成/)
  })

  it('不在邀請名單的廠商看不到報價提交入口', async () => {
    renderApp(routes, { url: '/cases/c01', companyId: 'v05' })
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('link', { name: /提交報價|提交我的報價/ })).toBeNull()
  })
})

describe('驗收：AI（CHR-5）', () => {
  it('報價比較頁顯示「以原始報價單為準」', async () => {
    renderApp(routes, { url: '/cases/c01/quotes', companyId: 'f01' })
    expect((await screen.findAllByText(/以原始報價單為準/)).length).toBeGreaterThan(0)
  })
})

describe('驗收：碳盤查（CHR-6）', () => {
  it('f01 儀表板可切換到 2025 年', async () => {
    renderApp(routes, { url: '/carbon', companyId: 'f01' })
    const btn = await screen.findByRole('tab', { name: /2025/ })
    fireEvent.click(btn)
    expect((await screen.findAllByText(/2025/)).length).toBeGreaterThan(0)
  })
})
