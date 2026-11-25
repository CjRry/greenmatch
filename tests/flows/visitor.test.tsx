import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { routes } from '../../src/app/routes'
import { renderApp } from '../../src/test/renderPage'
import { fixtureData } from '../../src/test/fixtures'

vi.setConfig({ testTimeout: 20_000 })

const data = fixtureData()
const needs = data.needs ?? []
const vendors = (data.companies ?? []).filter((c) => c.role === 'vendor')

describe('未登入訪客', () => {
  it('首頁顯示主張與主要入口', async () => {
    renderApp(routes, { url: '/', companyId: null })
    expect(await screen.findByRole('heading', { level: 1, name: /免費電費與節能健檢/ })).toBeTruthy()
    expect(within(screen.getByRole('banner')).getAllByRole('link', { name: /試用回饋/ })).toHaveLength(1)
    const guideBar = screen.queryByRole('region', { name: '3 分鐘試用導覽' })
    if (guideBar) expect(within(guideBar).queryByRole('link', { name: /試用回饋/ })).toBeNull()
    expect(within(screen.getByRole('contentinfo')).queryByRole('link', { name: /試用回饋/ })).toBeNull()
    expect(screen.queryByText('給 30 秒試用回饋')).toBeNull()
  })

  it('需求市集只列出開放中的需求', async () => {
    renderApp(routes, { url: '/needs', companyId: null })
    await screen.findByRole('heading', { name: '需求市集' })
    const open = needs.filter((n) => n.status === 'open')
    const closed = needs.filter((n) => n.status !== 'open')
    expect(open.length).toBeGreaterThan(0)
    expect(closed.length).toBeGreaterThan(0)
    // 開放需求的標題至少有一筆出現；非開放需求的標題一筆都不能出現
    await screen.findAllByText(open[0].title)
    for (const n of closed) expect(screen.queryByText(n.title), `${n.id} 不應出現在市集`).toBeNull()
  })

  it('廠商名錄列出廠商，依服務篩選後只剩有該專長的廠商', async () => {
    const { container } = renderApp(routes, { url: '/vendors', companyId: null })
    await screen.findByRole('heading', { name: '廠商名錄' })
    await screen.findByText(vendors[0].name)
    const withHvac = vendors.filter((v) => v.role === 'vendor' && v.vendor.specialties.includes('hvac'))
    const without = vendors.filter((v) => v.role === 'vendor' && !v.vendor.specialties.includes('hvac'))
    expect(withHvac.length).toBeGreaterThan(0)
    expect(without.length).toBeGreaterThan(0)

    const select = container.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'hvac' } })
    for (const v of withHvac) expect(await screen.findByText(v.name)).toBeTruthy()
    for (const v of without) expect(screen.queryByText(v.name), `${v.id} 沒有空調專長`).toBeNull()
  })

  it('網址帶 ?specialty= 時名錄直接套用篩選', async () => {
    renderApp(routes, { url: '/vendors?specialty=hvac', companyId: null })
    await screen.findByRole('heading', { name: '廠商名錄' })
    const without = vendors.filter((v) => v.role === 'vendor' && !v.vendor.specialties.includes('hvac'))
    await screen.findByText(vendors.find((v) => v.role === 'vendor' && v.vendor.specialties.includes('hvac'))!.name)
    for (const v of without) expect(screen.queryByText(v.name)).toBeNull()
  })

  it('未登入進入「我的」會請對方登入', async () => {
    renderApp(routes, { url: '/me', companyId: null })
    expect(await screen.findByText('登入後才看得到你的案件')).toBeTruthy()
  })

  it('未登入進入登記需求會請對方登入', async () => {
    renderApp(routes, { url: '/new-need', companyId: null })
    expect(await screen.findByText('請先以工廠身分登入')).toBeTruthy()
  })

  it('不存在的路徑顯示找不到頁面', async () => {
    renderApp(routes, { url: '/no/such/page', companyId: null })
    const el = await screen.findByText('找不到這個頁面')
    expect(within(el.parentElement as HTMLElement).getByRole('link', { name: '回到首頁' })).toBeTruthy()
  })
})
