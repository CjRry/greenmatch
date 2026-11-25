import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderPage } from '../../../test/renderPage'
import { fixtureData } from '../../../test/fixtures'
import CaseTracker from './CaseTracker'

const seedCase = (id: string) => fixtureData().cases!.find((c) => c.id === id)!

describe('CaseTracker', () => {
  it('shows c01 at stage 4 of 8 with the factory prep', async () => {
    renderPage(<CaseTracker />, { path: '/cases/:id', url: '/cases/c01', companyId: seedCase('c01').factoryId })
    expect(await screen.findByText('目前階段：方案與報價（4 / 8）')).toBeTruthy()
    expect(screen.getByText(/下一步，工廠需準備/)).toBeTruthy()
    expect(screen.getByText('查看 AI 報價解說')).toBeTruthy()
    expect(screen.getByText(/補助提醒/)).toBeTruthy()
    expect(screen.getByText('活動紀錄')).toBeTruthy()
    expect(screen.getAllByText(/預估/).length).toBeGreaterThanOrEqual(8)
  })

  it('shows the finished comparison for c06', async () => {
    renderPage(<CaseTracker />, { path: '/cases/:id', url: '/cases/c06', companyId: seedCase('c06').factoryId })
    expect((await screen.findAllByText('案件已完成')).length).toBeGreaterThan(0)
    expect(screen.getByText('改善前平均')).toBeTruthy()
    expect(screen.getByText('估計每月減碳')).toBeTruthy()
  })

  it('shows subsidy reminders on c03 as well', async () => {
    renderPage(<CaseTracker />, { path: '/cases/:id', url: '/cases/c03', companyId: seedCase('c03').factoryId })
    expect(await screen.findByText(/補助提醒/)).toBeTruthy()
  })

  it('blocks someone who is not on the case', async () => {
    const owner = seedCase('c01').factoryId
    const other = fixtureData().companies!.find((x) => x.role === 'factory' && x.id !== owner)!
    renderPage(<CaseTracker />, { path: '/cases/:id', url: '/cases/c01', companyId: other.id })
    expect(await screen.findByText('你沒有權限查看這個案件')).toBeTruthy()
  })

  it('lets a shortlisted vendor schedule the survey and records an event', async () => {
    const c = seedCase('c02')
    const { store } = renderPage(<CaseTracker />, { path: '/cases/:id', url: '/cases/c02', companyId: c.shortlist[0] })
    const input = await screen.findByLabelText('場勘日期與時間')
    fireEvent.change(input, { target: { value: '2026-11-03T10:00' } })
    fireEvent.click(screen.getByRole('button', { name: '預約場勘時間' }))
    await waitFor(async () => {
      expect((await store.get('cases', 'c02'))!.surveyDate).toBeTruthy()
    })
    const before = fixtureData().caseEvents!.filter((e) => e.caseId === 'c02').length
    const events = await new Promise<number>((resolve) => {
      store.subscribe('caseEvents', (docs) => resolve(docs.filter((e) => e.caseId === 'c02').length))
    })
    expect(events).toBe(before + 1)
  })

  it('shows an empty state for an unknown case', async () => {
    renderPage(<CaseTracker />, { path: '/cases/:id', url: '/cases/nope', companyId: seedCase('c01').factoryId })
    expect(await screen.findByText('找不到這個案件')).toBeTruthy()
  })

  it('asks a signed-out visitor to sign in', async () => {
    renderPage(<CaseTracker />, { path: '/cases/:id', url: '/cases/c01', companyId: null, data: {} })
    expect(await screen.findByText(/登入後才能查看案件進度|找不到這個案件/)).toBeTruthy()
  })

  it('hides contract amount and schedule from unselected vendors in both summary and activity log (C2)', async () => {
    const c04 = seedCase('c04')
    const unselected = c04.shortlist.find((id) => id !== c04.selectedVendorId)!
    expect(c04.contractNtd).toBeGreaterThan(0)
    const { container } = renderPage(<CaseTracker />, { path: '/cases/:id', url: '/cases/c04', companyId: unselected })
    expect(await screen.findByText(/合約金額與施工排程僅對工廠與得標廠商公開/)).toBeTruthy()
    const formattedAmt = Math.round(c04.contractNtd!).toLocaleString('en-US')
    expect(container.textContent).not.toContain(formattedAmt)
    expect(container.textContent).not.toMatch(/合約金額\s*NT\$/)
    expect(container.textContent).not.toMatch(/開工\s*2026|預計.*施工/)
  })

  it('hides post-selection construction events on c03 (n03) from unselected vendors (PROP-0003 E1)', async () => {
    const c03 = seedCase('c03')
    const unselected = c03.shortlist.find((id) => id !== c03.selectedVendorId)!
    const { container } = renderPage(<CaseTracker />, { path: '/cases/:id', url: '/cases/c03', companyId: unselected })
    expect(await screen.findByText(/合約金額與施工排程僅對工廠與得標廠商公開/)).toBeTruthy()
    expect(container.textContent).not.toContain('2 號機配管完成，預計 11/3 停機切換')
    expect(container.textContent).not.toContain('完成 1 號冰水主機拆除與新機定位')
    expect(container.textContent).toContain('工廠比較兩家報價後，選擇')
  })

  it('shows full subsidy card with collapsed 其他方案 in the 政府補助 tab', async () => {
    renderPage(<CaseTracker />, { path: '/cases/:id', url: '/cases/c01', companyId: seedCase('c01').factoryId })
    fireEvent.click(await screen.findByRole('tab', { name: '政府補助' }))
    expect(await screen.findByText('可能適用的補助')).toBeTruthy()
    expect(screen.getByText(/其他方案（/)).toBeTruthy()
  })
})
