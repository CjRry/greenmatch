import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderPage } from '../../../test/renderPage'
import Hub from './Hub'

describe('Hub', () => {
  it('shows the factory status bar, factory facts summary, carbon card and cases', async () => {
    const { store } = renderPage(<Hub />, { path: '/me', companyId: 'f01' })
    expect(await screen.findByRole('button', { name: /場勘報價/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /媒合中/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /待驗收/ })).toBeTruthy()
    expect(screen.getByText('登記新需求')).toBeTruthy()
    expect(screen.getByText('我的工廠數據')).toBeTruthy()
    expect(screen.getByText('每日運轉（小時／日）')).toBeTruthy()
    expect(screen.getByText('年運轉天數（天／年）')).toBeTruthy()
    expect(screen.getAllByText('含平台估算').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('link', { name: '查看碳盤查' })).toBeTruthy()
    expect(screen.getByText('盤查進度')).toBeTruthy()
    expect(screen.getByText('我的補助')).toBeTruthy()
    expect(screen.getAllByText('方案與報價').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /工廠數據明細與來源/ }))
    const editButtons = screen.getAllByRole('button', { name: /改成我的數字/ })
    fireEvent.click(editButtons[0])
    fireEvent.change(screen.getByLabelText('修改月平均用電度數'), { target: { value: '52000' } })
    fireEvent.click(screen.getByRole('button', { name: '套用並重算' }))
    await waitFor(async () => {
      const updated = await store.get('companies', 'f01')
      expect(updated?.role).toBe('factory')
      if (updated?.role === 'factory') {
        expect(updated.factory.monthlyKwh).toBe(52000)
        expect(updated.factory.dataSources?.monthlyKwh?.source).toBe('user')
      }
    })
  })

  it('shows the vendor status bar', async () => {
    renderPage(<Hub />, { path: '/me', companyId: 'v01' })
    expect(await screen.findByRole('button', { name: /新推薦/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /待報價/ })).toBeTruthy()
    expect(screen.getByText('瀏覽需求市集')).toBeTruthy()
    expect(screen.getByText('我的評價')).toBeTruthy()
  })

  it('asks a signed-out visitor to sign in', async () => {
    renderPage(<Hub />, { path: '/me', companyId: null })
    expect(await screen.findByText('登入後才看得到你的案件')).toBeTruthy()
  })

  it('invites a new factory to register its first need', async () => {
    renderPage(<Hub />, {
      path: '/me',
      companyId: 'fx',
      data: {
        companies: [
          {
            id: 'fx',
            role: 'factory',
            name: '新工廠',
            city: '台南市',
            contactName: '王',
            intro: '',
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
            factory: { industry: '金屬', products: '零件', employees: 30, scale: 'S', mainCustomers: [], pressures: [], equipment: [] },
          },
        ],
      },
    })
    expect(await screen.findByText('還沒有案件')).toBeTruthy()
    expect(screen.getByText('我的補助')).toBeTruthy()
    expect(screen.getByText('開始碳盤查')).toBeTruthy()
  })
})
