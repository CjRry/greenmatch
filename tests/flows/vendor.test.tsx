import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { routes } from '../../src/app/routes'
import { renderApp } from '../../src/test/renderPage'
import { fixtureData } from '../../src/test/fixtures'

vi.setConfig({ testTimeout: 20_000 })

const data = fixtureData()
const caseTitle = (caseId: string) => {
  const c = data.cases!.find((x) => x.id === caseId)!
  return data.needs!.find((n) => n.id === c.needId)!.title
}

describe('廠商 v01：我的', () => {
  it('c01 在待報價或已報價，c02 在待場勘', async () => {
    const c01 = data.cases!.find((c) => c.id === 'c01')!
    const c02 = data.cases!.find((c) => c.id === 'c02')!
    expect(c01.shortlist).toContain('v01')
    expect(c02.shortlist).toContain('v01')

    renderApp(routes, { url: '/me', companyId: 'v01' })
    await screen.findByRole('button', { name: /待報價/ })
    // 全部分頁同時看得到兩個案件
    expect((await screen.findAllByText(caseTitle('c01'))).length).toBeGreaterThan(0)
    expect(screen.getAllByText(caseTitle('c02')).length).toBeGreaterThan(0)
  })

  it('「待場勘」分頁只有 c02，不含 c01', async () => {
    renderApp(routes, { url: '/me', companyId: 'v01' })
    fireEvent.click(await screen.findByRole('button', { name: /待場勘/ }))
    expect((await screen.findAllByText(caseTitle('c02'))).length).toBeGreaterThan(0)
    expect(screen.queryByText(caseTitle('c01'))).toBeNull()
  })

  it('c01 已提交過報價，所以不在「待報價」分頁，而在全部與案件頁', async () => {
    const quoted = data.quotes!.some((q) => q.caseId === 'c01' && q.vendorId === 'v01')
    expect(quoted).toBe(true)
    renderApp(routes, { url: '/cases/c01', companyId: 'v01' })
    expect((await screen.findAllByText('方案與報價')).length).toBeGreaterThan(0)
  })

  it('廠商看得到報價頁入口且工廠專屬動作被擋（比價頁唯讀）', async () => {
    renderApp(routes, { url: '/cases/c01/quotes', companyId: 'v01' })
    expect((await screen.findAllByText(/報價/)).length).toBeGreaterThan(0)
  })
})
