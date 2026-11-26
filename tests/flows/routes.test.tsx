import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { routes } from '../../src/app/routes'
import { setCapabilityOverride } from '../../src/core/runtime'
import { fixtureData } from '../../src/test/fixtures'
import { renderApp } from '../../src/test/renderPage'

vi.setConfig({ testTimeout: 20_000 })

/** 每個路由的具體網址（動態段用示範資料的 id）。 */
const URLS = [
  '/',
  '/register',
  '/register?role=factory',
  '/register?role=vendor',
  '/needs',
  '/needs/n01',
  '/vendors',
  '/vendors?specialty=hvac',
  '/vendors/v01',
  '/factories/f01',
  '/me',
  '/me/profile',
  '/new-need',
  '/cases/c01',
  '/cases/c08/match',
  '/cases/c01/quotes',
  '/cases/c01/quote/new',
  '/carbon',
  '/carbon/entry',
  '/bill-checkup',
  '/feedback',
  '/public-cases',
  '/no/such/page',
]

const COMPANIES = [null, 'f01', 'v01']

/** 頁面出錯時 RouteError 會顯示這行字。 */
const CRASH = '這個頁面出了問題'

describe('空資料（data: {}）：每個路由都能載入', () => {
  for (const url of URLS) {
    for (const companyId of COMPANIES) {
      it(`${url}（${companyId ?? '未登入'}）不丟錯`, async () => {
        const { container } = renderApp(routes, { url, data: {}, companyId })
        // 空資料時 companyId 對不到公司；等載入完成（骨架消失）
        await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull(), { timeout: 3000 })
        expect(screen.queryByText(CRASH)).toBeNull()
        expect(container.textContent!.trim().length).toBeGreaterThan(0)
      })
    }
  }

  const EMPTY_STATES: [string, string][] = [
    ['/needs', '目前沒有開放中的需求'],
    ['/vendors', '名錄裡還沒有廠商'],
    ['/needs/n01', '這筆需求不存在或已被移除'],
    ['/vendors/v01', '這家廠商不存在或已被移除'],
    ['/factories/f01', '這家工廠不存在或已被移除'],
    ['/me', '登入後才看得到你的案件'],
    ['/new-need', '請先以工廠身分登入'],
    ['/cases/c01/match', '找不到這個案件'],
  ]
  for (const [url, text] of EMPTY_STATES) {
    it(`${url} 空資料顯示空狀態「${text}」`, async () => {
      renderApp(routes, { url, data: {}, companyId: null })
      expect(await screen.findByText(text)).toBeTruthy()
    })
  }

  it('載入中顯示骨架，不是空白或錯誤', async () => {
    const { container } = renderApp(routes, { url: '/needs', companyId: null })
    // 第一個 frame 之前不應有錯誤畫面
    expect(screen.queryByText(CRASH)).toBeNull()
    await screen.findByRole('heading', { name: '需求市集' })
    expect(container.textContent).toBeTruthy()
  })
})

describe('載入頁面時不會呼叫 Claude', () => {
  afterEach(() => setCapabilityOverride('sample', undefined))

  for (const url of URLS) {
    it(`${url}（有資料）載入 0 次呼叫`, async () => {
      const sample = vi.fn(async () => ({ text: '{}' }))
      setCapabilityOverride('sample', sample as never)
      const { container } = renderApp(routes, { url, companyId: 'f01' })
      await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull(), { timeout: 3000 })
      // 讓載入後的 effect 跑完
      await new Promise((r) => setTimeout(r, 50))
      expect(sample).not.toHaveBeenCalled()
    })
  }
})

describe('試用導覽列對自行註冊公司不會撞牆 (OBS-0002 #3)', () => {
  it('無案件的自行註冊工廠：②–④ 留在自己的工作台，不切換身分、不撞無權限', async () => {
    const base = fixtureData()
    const companies = base.companies ?? []
    const newFactory = { ...companies.find((c) => c.id === 'f01')!, id: 'f_self', name: '自註工廠', isDemo: false }
    renderApp(routes, {
      url: '/cases/c01',
      companyId: 'f_self',
      data: { ...base, companies: [...companies, newFactory] },
    })
    const guide = await screen.findByRole('region', { name: '3 分鐘試用導覽' })
    for (const name of ['② 推薦與補助試算', '③ 報價比價與回本', '④ 8 階段追蹤']) {
      const link = within(guide).getByRole('link', { name })
      expect(link.getAttribute('href')).toBe('/me')
    }
    expect(within(guide).queryByRole('button')).toBeNull()
  })

  it('有案件但還沒有報價的工廠點「③ 報價比價與回本」仍是自己，打開自己案件的報價頁', async () => {
    renderApp(routes, { url: '/new-need', companyId: 'f02' })
    const guide = await screen.findByRole('region', { name: '3 分鐘試用導覽' })
    const link = within(guide).getByRole('link', { name: '③ 報價比價與回本' })
    expect(link.getAttribute('href')).toMatch(/^\/cases\/[^/]+\/quotes$/)
    fireEvent.click(link)
    expect(await screen.findByText('旭東塑膠射出有限公司')).toBeTruthy()
    expect(screen.queryByText('永豐金屬工業股份有限公司')).toBeNull()
  })

  it('「⑤ 驗收」：有驗收案件的工廠直接連到自己的案件', async () => {
    renderApp(routes, { url: '/new-need', companyId: 'f05' })
    const guide = await screen.findByRole('region', { name: '3 分鐘試用導覽' })
    expect(within(guide).getByRole('link', { name: '⑤ 驗收與節電成效' }).getAttribute('href')).toBe('/cases/c05')
  })

  it('「⑤ 驗收」：其他示範工廠看到寫明要切換的按鈕，按下後以明德精密打開驗收案件', async () => {
    renderApp(routes, { url: '/new-need', companyId: 'f02' })
    const guide = await screen.findByRole('region', { name: '3 分鐘試用導覽' })
    fireEvent.click(within(guide).getByRole('button', { name: '⑤ 驗收示範（切換為明德精密電子）' }))
    expect(await screen.findByText('已切換為明德精密電子有限公司')).toBeTruthy()
    expect(await screen.findByRole('button', { name: '驗收通過' })).toBeTruthy()
  })
})

describe('案件中心單頁 Tabs (/cases/:id)', () => {
  it('可在單頁內切換 進度追蹤｜推薦廠商｜報價比較與 ROI', async () => {
    renderApp(routes, { url: '/cases/c01', companyId: 'f01' })
    expect(await screen.findByRole('tab', { name: '進度追蹤' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /^推薦廠商/ }))
    expect(await screen.findByText(/媒合偏好切換與推薦分數說明/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /報價比較與 ROI/ }))
    expect(await screen.findByText('AI 報價解說')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /AI 解說報價/ }))
    expect(await screen.findByText('回本試算（依貴廠電價與運轉時數）')).toBeTruthy()
  })
})

describe('示範導覽列（OBS-0004 §2-6）', () => {
  it('③ 報價比價與回本 opens the newest case that actually has quotes, not an empty one', async () => {
    const data = fixtureData()
    const quoted = new Set((data.quotes ?? []).map((q) => q.caseId))
    // A newer f01 case with no quotes yet: the link must skip it.
    const base = (data.cases ?? []).find((c) => c.factoryId === 'f01')!
    data.cases = [...(data.cases ?? []), { ...base, id: 'c-noquotes', stage: 'assess', updatedAt: '2099-01-01 00:00' }]
    const f01Cases = (data.cases ?? []).filter((c) => c.factoryId === 'f01').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const expected = f01Cases.find((c) => quoted.has(c.id))?.id ?? 'c01'
    const { router } = renderApp(routes, { url: '/needs', companyId: 'f01', data })
    fireEvent.click(await screen.findByRole('link', { name: '③ 報價比價與回本' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/cases/${expected}/quotes`))
    expect(quoted.has(expected)).toBe(true)
    // The newest case has no quotes; that is what the old link opened.
    expect(f01Cases[0].id).not.toBe(expected)
  })
})

