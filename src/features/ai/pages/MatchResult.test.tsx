import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderPage } from '../../../test/renderPage'
import MatchResult from './MatchResult'

describe('MatchResult', () => {
  it('shows two recommendations and invites them to a survey', async () => {
    const { store } = renderPage(<MatchResult />, { path: '/cases/:id/match', url: '/cases/c08/match', companyId: 'f12' })
    expect(await screen.findByText(/推薦分數 = Σ/)).toBeTruthy()
    expect(screen.getAllByText(/^推薦第 \d 名$/).length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: /邀請這 2 家場勘/ }))
    fireEvent.click(await screen.findByRole('button', { name: '邀請場勘' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/cases/c08'))
    const c = (await store.get('cases', 'c08'))!
    expect(c.stage).toBe('survey')
    expect(c.shortlist.length).toBe(2)
    expect((await store.get('needs', c.needId))!.status).toBe('matched')
  })

  it('is read-only past the assess stage', async () => {
    renderPage(<MatchResult />, { path: '/cases/:id/match', url: '/cases/c04/match', companyId: 'f04' })
    expect(await screen.findByText(/當時平台的推薦結果/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /邀請這/ })).toBeNull()
  })

  it('shows matched subsidies summary bar, vendor subsidy badge, same-industry highlight, and opens subsidy dialog with collapsed other schemes', async () => {
    renderPage(<MatchResult />, { path: '/cases/:id/match', url: '/cases/c01/match', companyId: 'f01' })
    expect(await screen.findByText(/可能適用 \d+ 項補助/)).toBeTruthy()
    expect(screen.getAllByText(/12–43 萬/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('可協助申請補助').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/同業實績：金屬加工/).length).toBeGreaterThan(0)
    expect(screen.getByText(/同業案例：鋼鐵加工廠空壓系統整合/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '看明細' }))
    expect(await screen.findByText(/其他方案（/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: '規則與來源' })[0])
    expect(await screen.findByText('資格條件')).toBeTruthy()
  })

  it('handles an empty store', async () => {
    renderPage(<MatchResult />, { path: '/cases/:id/match', url: '/cases/c08/match', data: {} })
    expect(await screen.findByText('找不到這個案件')).toBeTruthy()
  })

  it('recalculates vendor rankings when opening collapsed preference panel and switching weight presets', async () => {
    renderPage(<MatchResult />, { path: '/cases/:id/match', url: '/cases/c08/match', companyId: 'f12' })
    fireEvent.click(await screen.findByText(/媒合偏好切換與推薦分數說明/))
    fireEvent.click(screen.getByRole('button', { name: '距離最近' }))
    expect(await screen.findByText('已依自訂權重即時重算推薦排序。')).toBeTruthy()
    expect(screen.getAllByText(/距離（權重 45%）/).length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: '重設標準權重' }))
    expect(screen.queryByText('已依自訂權重即時重算推薦排序。')).toBeNull()
  })
})
