import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderPage } from '../../../test/renderPage'
import { fixtureData } from '../../../test/fixtures'
import NeedWizard from './NeedWizard'

const EXAMPLE = '我們工廠空壓機有 3 台，都用了十幾年，最近電費越來越高，夏天冷氣也很耗電'

describe('NeedWizard', () => {
  it('asks signed-out visitors to sign in', async () => {
    renderPage(<NeedWizard />, { path: '/new-need', companyId: null })
    expect(await screen.findByText('請先以工廠身分登入')).toBeTruthy()
  })

  it('works with an empty store (no company)', async () => {
    renderPage(<NeedWizard />, { path: '/new-need', data: {} })
    expect(await screen.findByText('請先以工廠身分登入')).toBeTruthy()
  })

  it('tells vendors they cannot register needs', async () => {
    renderPage(<NeedWizard />, { path: '/new-need', companyId: 'v01' })
    expect(await screen.findByText('節能廠商無法登記需求')).toBeTruthy()
  })

  it('updates the title when a row is deleted, until the factory types its own (OBS-0004 §2-4)', async () => {
    renderPage(<NeedWizard />, { path: '/new-need', companyId: 'f01' })
    fireEvent.change(await screen.findByLabelText(/需求描述/), { target: { value: '空壓機 2 台用了十二年，冷氣也很耗電' } })
    fireEvent.click(screen.getByRole('button', { name: /整理需求/ }))
    const titleInput = (await screen.findByLabelText('需求標題')) as HTMLInputElement
    expect(titleInput.value).toContain('空調')
    fireEvent.click(screen.getByRole('button', { name: '刪除第 2 列' }))
    expect(titleInput.value).not.toContain('空調')
    expect(titleInput.value).toContain('空壓機')

    fireEvent.change(titleInput, { target: { value: '我自己的標題' } })
    fireEvent.click(screen.getByRole('button', { name: '刪除第 1 列' }))
    expect(titleInput.value).toBe('我自己的標題')
  })

  it('organises, confirms, then creates a need and an assess case', async () => {
    const { store } = renderPage(<NeedWizard />, { path: '/new-need', companyId: 'f01' })
    fireEvent.change(await screen.findByLabelText(/需求描述/), { target: { value: EXAMPLE } })
    fireEvent.click(screen.getByRole('button', { name: /整理需求/ }))
    expect(await screen.findByText('整理的結果需要你確認，確認後才會送出。')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('第 1 列數量'), { target: { value: '4' } })
    expect(screen.getByText('已手動調整')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '還原 AI 初稿' }))
    expect((screen.getByLabelText('第 1 列數量') as HTMLInputElement).value).toBe('3')
    expect(screen.queryByText('已手動調整')).toBeNull()
    fireEvent.change(screen.getByLabelText('第 1 列數量'), { target: { value: '4' } })
    expect(screen.getByText('已手動調整')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '下一步：確認送出' }))
    fireEvent.click(await screen.findByRole('button', { name: '確認送出' }))
    const loc = await screen.findByTestId('location')
    expect(loc.textContent).toMatch(/^\/cases\/.+\/match$/)
    const caseId = loc.textContent!.split('/')[2]
    await waitFor(async () => {
      const made = await store.get('cases', caseId)
      expect(made?.stage).toBe('assess')
      expect(made?.recommendations.length).toBeGreaterThan(0)
      const need = await store.get('needs', made!.needId)
      expect(need?.form.items[0].quantity).toBe(4)
      expect(need?.caseId).toBe(made!.id)
    })
  })

  it('pre-fills factory equipment details, syncs monthly bill & equipment back to factory facts when confirmed, and shows compact subsidy summary bar', async () => {
    const fx = fixtureData()
    const base = fx.companies!.find((c) => c.id === 'f01')!
    const customFactory =
      base.role === 'factory'
        ? {
            ...base,
            factory: {
              ...base.factory,
              equipment: [{ type: 'air_compressor' as const, quantity: 2, ratedKw: 37, yearInstalled: 2014, dailyHours: 16 }],
            },
          }
        : base

    const { store } = renderPage(<NeedWizard />, {
      path: '/new-need',
      companyId: 'f01',
      data: { ...fx, companies: fx.companies!.map((c) => (c.id === 'f01' ? customFactory : c)) },
    })

    fireEvent.change(await screen.findByLabelText(/需求描述/), {
      target: { value: '2 台 50 馬力的空壓機，用了 12 年，漏氣嚴重，每月電費大概 27 萬' },
    })
    fireEvent.click(screen.getByRole('button', { name: /整理需求/ }))

    expect(await screen.findByText('整理的結果需要你確認，確認後才會送出。')).toBeTruthy()
    expect((screen.getByLabelText('第 1 列數量') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('第 1 列每台 kW') as HTMLInputElement).value).toBe('37')
    expect((screen.getByLabelText('每月電費（元，選填）') as HTMLInputElement).value).toBe('270000')

    fireEvent.click(screen.getByRole('button', { name: '下一步：確認送出' }))
    expect(await screen.findByText(/把這次填寫的設備與每月電費更新到「我的工廠數據」嗎？/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '看明細' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '查看全部方案與不適用說明' })).toBeNull()

    // Write-back is opt-in: unticked by default (OBS-0004 D1).
    const syncBox = screen.getByLabelText('把這次填寫的設備與每月電費更新到「我的工廠數據」') as HTMLInputElement
    expect(syncBox.checked).toBe(false)
    fireEvent.click(syncBox)

    fireEvent.click(screen.getByRole('button', { name: '確認送出' }))
    await waitFor(async () => {
      const updated = await store.get('companies', 'f01')
      expect(updated?.role).toBe('factory')
      if (updated?.role === 'factory') {
        expect(updated.factory.monthlyElectricBillNtd).toBe(270000)
        expect(updated.factory.dataSources?.monthlyElectricBillNtd?.source).toBe('user')
        expect(updated.factory.dataSources?.equipment?.source).toBe('user')
        expect(updated.factory.equipment.some((e) => e.type === 'air_compressor' && e.ratedKw === 37)).toBe(true)
      }
    })
  })
})
