import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderPage } from '../../../test/renderPage'
import { fixtureData } from '../../../test/fixtures'
import CarbonEntry from './CarbonEntry'

describe('CarbonEntry', () => {
  it('loads the factory inventory and saves edits once', async () => {
    const { store } = renderPage(<CarbonEntry />, { path: '/carbon/entry', companyId: 'f01' })
    const kwh = (await screen.findByLabelText('12 月用電（度）')) as HTMLInputElement
    expect(kwh.value).toBe('')
    fireEvent.change(kwh, { target: { value: '100000' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(await screen.findByRole('button', { name: '回到碳盤查儀表板' })).toBeTruthy()
    await waitFor(async () => {
      const inv = (await store.get('carbon', 'f01_2026'))!
      expect(inv.months.find((m) => m.m === 12)?.kwh).toBe(100000)
    })
  })

  it('shows field errors for negative and non-numeric input and does not save', async () => {
    const { store } = renderPage(<CarbonEntry />, { path: '/carbon/entry', companyId: 'f01' })
    const before = (await store.get('carbon', 'f01_2026'))!.updatedAt
    fireEvent.change(await screen.findByLabelText('12 月用電（度）'), { target: { value: '-5' } })
    fireEvent.change(screen.getByLabelText('11 月用電（度）'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))
    expect(await screen.findByText('不可為負數')).toBeTruthy()
    expect(screen.getByText('請輸入數字')).toBeTruthy()
    expect((await store.get('carbon', 'f01_2026'))!.updatedAt).toBe(before)
  })

  it('offers to create the inventory when the factory has none', async () => {
    const { store } = renderPage(<CarbonEntry />, { path: '/carbon/entry', companyId: 'f01', data: { ...fixtureData(), carbon: [] } })
    fireEvent.click(await screen.findByRole('button', { name: '建立 2026 年盤查' }))
    expect(await screen.findByLabelText('1 月用電（度）')).toBeTruthy()
    expect(await store.get('carbon', 'f01_2026')).not.toBeNull()
  })

  it('explains who can fill it in with an empty store', async () => {
    renderPage(<CarbonEntry />, { path: '/carbon/entry', data: {} })
    expect(await screen.findByText('只有工廠可以填寫活動數據')).toBeTruthy()
  })
})
