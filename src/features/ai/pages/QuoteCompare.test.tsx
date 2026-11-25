import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderPage } from '../../../test/renderPage'
import QuoteCompare from './QuoteCompare'

describe('QuoteCompare', () => {
  it('explains the two quotes of c01 and saves the comparison', async () => {
    const { store } = renderPage(<QuoteCompare />, { path: '/cases/:id/quotes', url: '/cases/c01/quotes', companyId: 'f01' })
    const breadcrumb = await screen.findByRole('navigation', { name: '麵包屑' })
    expect(breadcrumb.textContent).toContain('我的')
    expect(breadcrumb.textContent).toContain('報價解說')
    fireEvent.click(await screen.findByRole('button', { name: /解說報價/ }))
    expect(await screen.findByText('建議向廠商確認的問題')).toBeTruthy()
    expect(screen.getByText('估計補助')).toBeTruthy()
    expect(screen.getByText('扣除補助後')).toBeTruthy()
    expect(screen.getByText('另可抵稅（產創 10-1）')).toBeTruthy()
    expect(screen.queryByText('經銷商參考區間')).toBeNull()
    expect(screen.getAllByText(/另可抵稅，上限約 NT\$/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toContain('約 約')
    expect(screen.getByText('報價的機型是否已登錄動力設備補助產品系統？')).toBeTruthy()
    expect(screen.getAllByText('未載明').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/以原始報價單為準/).length).toBeGreaterThan(0)
    await waitFor(async () => {
      const saved = await store.get('quoteComparisons', 'c01')
      expect(saved?.rows.length).toBe(2)
    })

    expect(screen.getByText('回本試算（依貴廠電價與運轉時數）')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('平均電價（元／度）'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('每日運轉時數（小時）'), { target: { value: '24' } })
    expect(screen.getAllByText('運轉時數是平台基準的 1.5 倍').length).toBe(2)
    // One vendor, one payback: the table cell and the card show the same years, no 個月.
    expect(screen.queryAllByText(/個月回本/).filter((el) => el.tagName !== 'PRE')).toHaveLength(0)
    expect(screen.getAllByText(/回本（依貴廠電價試算）/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /回本試算用了哪些工廠數據/ }))
    fireEvent.click(screen.getAllByRole('button', { name: /改成我的數字/ })[0])
    fireEvent.change(screen.getByLabelText('修改平均電價'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: '套用並重算' }))
    await waitFor(async () => {
      const updated = await store.get('companies', 'f01')
      expect(updated?.role).toBe('factory')
      if (updated?.role === 'factory') {
        expect(updated.factory.avgElectricityPriceNtd).toBe(5)
        expect(updated.factory.dataSources?.avgElectricityPriceNtd?.source).toBe('user')
      }
    })
  })

  it('initializes interactive ROI rate from factoryFacts custom avgElectricityPriceNtd (3.8)', async () => {
    const { store } = renderPage(<QuoteCompare />, { path: '/cases/:id/quotes', url: '/cases/c01/quotes', companyId: 'f01' })
    const f01 = await store.get('companies', 'f01')
    if (f01?.role === 'factory') {
      await store.update('companies', 'f01', {
        factory: {
          ...f01.factory,
          avgElectricityPriceNtd: 3.8,
          dataSources: { ...f01.factory.dataSources, avgElectricityPriceNtd: { source: 'user' } },
        },
      })
    }
    fireEvent.click(await screen.findByRole('button', { name: /解說報價/ }))
    const input = (await screen.findByLabelText('平均電價（元／度）')) as HTMLInputElement
    await waitFor(() => expect(input.value).toBe('3.8'))
    fireEvent.click(screen.getByRole('button', { name: /回本試算用了哪些工廠數據/ }))
    expect(screen.getAllByText(/3.8 元／度/).length).toBeGreaterThan(0)
  })

  it('shows the empty state without a case', async () => {
    renderPage(<QuoteCompare />, { path: '/cases/:id/quotes', url: '/cases/c01/quotes', data: {} })
    expect(await screen.findByText('找不到這個案件')).toBeTruthy()
  })
})
