import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderPage } from '../../../test/renderPage'
import { fixtureData } from '../../../test/fixtures'
import { monthsUpToToday, summarizeInventory } from '../../../core/domain/carbon'
import { taipeiToday } from '../../../core/subsidies'
import { formatNumber } from '../../../core/format'
import { seedData } from '../../../data/seed'
import CarbonDashboard from './CarbonDashboard'

const f01 = (year: number) => seedData().carbon!.find((c) => c.id === `f01_${year}`)!

describe('CarbonDashboard', () => {
  it('shows scopes, totals, hotspots and 6 steps for f01, and switches to 2025', async () => {
    renderPage(<CarbonDashboard />, { path: '/carbon', companyId: 'f01' })
    const s26 = summarizeInventory(f01(2026))
    expect(await screen.findByText('範疇一（燃料）')).toBeTruthy()
    expect(screen.getByText('範疇二（用電）')).toBeTruthy()
    expect(screen.getByText(`${s26.filledMonths}/12`)).toBeTruthy()
    expect(screen.getAllByText('排放熱點').length).toBeGreaterThan(0)
    expect(screen.getAllByText('針對這項設備登記節能需求').length).toBeGreaterThan(0)
    expect(screen.getByText('邊界設定')).toBeTruthy()
    expect(screen.getByText('第三方查證')).toBeTruthy()
    expect(screen.queryByText('碳盤查政府輔導與工具')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: '看懂碳盤查' }))
    expect(await screen.findByText('碳盤查政府輔導與工具')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '總覽' }))

    fireEvent.click(screen.getByRole('tab', { name: '2025 年' }))
    const s25 = summarizeInventory(f01(2025))
    expect(await screen.findByText('12/12')).toBeTruthy()
    expect(screen.getAllByText(formatNumber(s25.totalT, 1)).length).toBeGreaterThan(0)
    expect(screen.getByText(`全年用電 ${new Intl.NumberFormat('zh-TW').format(Math.round(s25.totalKwh))} 度`)).toBeTruthy()
  })

  it('writes a step change to the store once per click', async () => {
    const { store } = renderPage(<CarbonDashboard />, { path: '/carbon', companyId: 'f01' })
    const group = await screen.findByRole('group', { name: '邊界設定狀態' })
    const before = (await store.get('carbon', 'f01_2026'))!.steps.boundary
    const target = before === 'done' ? '未開始' : '已完成'
    fireEvent.click(Array.from(group.querySelectorAll('button')).find((b) => b.textContent === target)!)
    await waitFor(async () => {
      const after = (await store.get('carbon', 'f01_2026'))!.steps.boundary
      expect(after).toBe(before === 'done' ? 'todo' : 'done')
    })
  })

  it('offers to start an inventory when the factory has none, then goes to the entry page', async () => {
    const { store } = renderPage(<CarbonDashboard />, { path: '/carbon', companyId: 'f01', data: { ...fixtureData(), carbon: [] } })
    expect(await screen.findByText('還沒有任何盤查資料')).toBeTruthy()
    expect(screen.queryByText('碳盤查政府輔導與工具')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: '開始 2026 年盤查' }))
    expect((await screen.findByTestId('location')).textContent).toBe('/carbon/entry')
    expect((await store.get('carbon', 'f01_2026'))?.months).toHaveLength(12)
  })

  it('explains who can see it when signed out or empty store (and no bill checkup draft)', async () => {
    window.localStorage.clear()
    renderPage(<CarbonDashboard />, { path: '/carbon', data: {} })
    expect(await screen.findByText('碳盤查只提供給工廠')).toBeTruthy()
    expect(screen.getByRole('link', { name: '先做電費單健檢' })).toBeTruthy()
  })

  it('OBS-0005：未登入但有電費單健檢草稿時，自動帶入年用電量開啟範疇二試算（標註你填的）', async () => {
    window.localStorage.setItem(
      'greenmatch:v1:bill-checkup-draft',
      JSON.stringify({
        planId: 'hv_2stage',
        periods: [
          {
            id: 'p1',
            label: '2026-08',
            season: 'summer',
            contractKw: '300',
            maxDemandKw: '345',
            powerFactorPct: '76',
            totalKwh: '120000',
            peakKwh: '',
            semiPeakKwh: '',
            satSemiPeakKwh: '',
            offPeakKwh: '',
            billAmountNtd: '480000',
          },
        ],
        showTouFields: false,
        hasAirCompressor: true,
        airFlowM3Min: '',
        pressureBar: '',
        compressorDailyHours: '',
        annualKwh: 1_000_000,
        avgMonthlyBillNtd: 400_000,
        avgPriceNtd: 4.1,
        latestContractKw: 300,
        monthsEntered: 3,
        updatedAt: '2026-11-15T05:00:00.000Z',
      }),
    )
    renderPage(<CarbonDashboard />, { path: '/carbon', data: {} })
    expect(await screen.findByText('已從電費單健檢帶入用電推估（無須登入即可試算）')).toBeTruthy()
    expect(screen.getByText('你填的')).toBeTruthy()
    expect(screen.getByText(/1,000,000 度/)).toBeTruthy()
    expect(screen.getByText(/474\.0 tCO2e/)).toBeTruthy()
    expect(screen.getByText('碳盤查與減碳補助參考')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('試算年用電量（度／年）'), { target: { value: '2000000' } })
    expect(screen.getByText(/948\.0 tCO2e/)).toBeTruthy()
    window.localStorage.clear()
  })

  it('shows a vendor the factory-only message', async () => {
    renderPage(<CarbonDashboard />, { path: '/carbon', companyId: 'v01' })
    expect(await screen.findByText('碳盤查只提供給工廠')).toBeTruthy()
  })

  it('calculates carbon live from electricity bill and supports inline 12-month editing tab', async () => {
    const { store } = renderPage(<CarbonDashboard />, { path: '/carbon', companyId: 'f01' })
    fireEvent.click(await screen.findByRole('tab', { name: '填數據' }))
    expect(await screen.findByText(/即時碳排與電費試算器/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '依每月電費金額（自動換算度數）' }))
    fireEvent.change(screen.getByLabelText('平均每月電費（元）'), { target: { value: '420000' } })
    expect(screen.getByText(/約換算 100,000 度／月/)).toBeTruthy()
    const before = (await store.get('carbon', 'f01_2026'))!
    fireEvent.click(screen.getByRole('button', { name: /以估算填入 2026 年空白月份/ }))
    const fillable = monthsUpToToday(2026, taipeiToday())
    await waitFor(async () => {
      const updated = (await store.get('carbon', 'f01_2026'))!
      // Months the factory typed stay untouched; only blank months up to today get the estimate.
      expect(updated.months[0]).toEqual(before.months[0])
      for (const mo of updated.months) {
        const was = before.months.find((b) => b.m === mo.m)!
        if (was.kwh != null) continue
        if (fillable.includes(mo.m)) expect(mo).toMatchObject({ kwh: 100000, kwhSource: 'estimate' })
        else expect(mo.kwh).toBeNull()
      }
      // Shares weren't moved, so their provenance is not upgraded.
      expect(updated.electricityShareSource ?? 'estimate').toBe(before.electricityShareSource ?? 'estimate')
    })

    expect(await screen.findByLabelText('12 月用電（度）')).toBeTruthy()
  })

  it('keeps filledMonths=0 annual estimate honest with 含平台估算 badge and guides empty hotspots to 填數據', async () => {
    const fx = fixtureData()
    const baseInv = fx.carbon!.find((c) => c.id === 'f01_2026')!
    const emptyInv = {
      ...baseInv,
      months: baseInv.months.map((m) => ({ ...m, kwh: null })),
      fuels: { naturalGasM3: null, dieselL: null, gasolineL: null },
      electricityShare: [],
      electricityShareSource: 'estimate' as const,
    }
    const baseFactory = fx.companies!.find((c) => c.id === 'f01')!
    const userFactory =
      baseFactory.role === 'factory'
        ? {
            ...baseFactory,
            factory: {
              ...baseFactory.factory,
              monthlyKwh: 65000,
              dataSources: {
                monthlyKwh: { source: 'user' as const, note: '註冊時自行輸入', updatedAt: '2026-11-13T00:00:00Z' },
                avgElectricityPriceNtd: { source: 'user' as const, note: '自填電價', updatedAt: '2026-11-13T00:00:00Z' },
              },
            },
          }
        : baseFactory

    renderPage(<CarbonDashboard />, {
      path: '/carbon',
      companyId: 'f01',
      data: {
        ...fx,
        companies: fx.companies!.map((c) => (c.id === 'f01' ? userFactory : c)),
        carbon: [emptyInv],
      },
    })

    expect(await screen.findByText(/已填 0\/12 月；依你給的月平均估算全年約/)).toBeTruthy()
    expect(screen.getAllByText('369.7').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('含平台估算').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('尚未設定設備用電占比')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '前往「填數據」設定' }))
    expect(await screen.findByText(/即時碳排與電費試算器/)).toBeTruthy()
  })

  it('shows provenance panels for carbon total and hotspots and updates factory facts in place', async () => {
    const { store } = renderPage(<CarbonDashboard />, { path: '/carbon', companyId: 'f01' })
    const totalToggle = await screen.findByRole('button', { name: /碳排總量用了哪些資料/ })
    expect(screen.getByRole('button', { name: /排放熱點用了哪些資料/ })).toBeTruthy()
    expect(screen.getAllByText('含平台估算').length).toBeGreaterThanOrEqual(2)
    fireEvent.click(totalToggle)
    fireEvent.click(screen.getAllByRole('button', { name: /改成我的數字/ })[0])
    fireEvent.change(screen.getByLabelText('修改月平均用電度數'), { target: { value: '62000' } })
    fireEvent.click(screen.getByRole('button', { name: '套用並重算' }))
    await waitFor(async () => {
      const updated = await store.get('companies', 'f01')
      expect(updated?.role).toBe('factory')
      if (updated?.role === 'factory') {
        expect(updated.factory.monthlyKwh).toBe(62000)
        expect(updated.factory.dataSources?.monthlyKwh?.source).toBe('user')
      }
    })
  })

  it('「以估算填入」on an empty factory keeps 0/12 filled, marks estimates, and lists only equipment it has (OBS-0004 §2-2)', async () => {
    const fx = fixtureData()
    const baseInv = fx.carbon!.find((c) => c.id === 'f01_2026')!
    const emptyInv = {
      ...baseInv,
      months: baseInv.months.map((m) => ({ m: m.m, kwh: null, fuels: [] })),
      electricityShare: [],
      electricityShareSource: 'estimate' as const,
    }
    const baseFactory = fx.companies!.find((c) => c.id === 'f01')!
    const onlyCompressor =
      baseFactory.role === 'factory'
        ? {
            ...baseFactory,
            factory: {
              ...baseFactory.factory,
              monthlyKwh: 52000,
              equipment: [{ type: 'air_compressor' as const, quantity: 2, ratedKw: 22 }],
              dataSources: { monthlyKwh: { source: 'user' as const, updatedAt: '2026-11-13T00:00:00Z' } },
            },
          }
        : baseFactory
    const { store } = renderPage(<CarbonDashboard />, {
      path: '/carbon',
      companyId: 'f01',
      data: { ...fx, companies: fx.companies!.map((c) => (c.id === 'f01' ? onlyCompressor : c)), carbon: [emptyInv] },
    })
    fireEvent.click(await screen.findByRole('tab', { name: '填數據' }))
    expect(await screen.findByLabelText('空壓機用電占比')).toBeTruthy()
    expect(screen.queryByLabelText('空調用電占比')).toBeNull()
    expect(screen.queryByLabelText('鍋爐用電占比')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /以估算填入 2026 年空白月份/ }))
    const fillable = monthsUpToToday(2026, taipeiToday())
    await waitFor(async () => {
      const updated = (await store.get('carbon', 'f01_2026'))!
      expect(updated.months.filter((m) => m.kwh != null).map((m) => m.m)).toEqual(fillable)
      expect(updated.months.every((m) => m.kwh == null || m.kwhSource === 'estimate')).toBe(true)
      expect(updated.electricityShare?.map((s) => s.equip)).toEqual(['air_compressor'])
      expect(updated.electricityShareSource).toBe('estimate')
      expect(summarizeInventory(updated).filledMonths).toBe(0)
    })

    fireEvent.click(screen.getByRole('tab', { name: '總覽' }))
    expect(await screen.findByText('0/12')).toBeTruthy()
    expect(screen.queryByText('12/12')).toBeNull()
    expect(screen.queryByText('均依你填的資料計算')).toBeNull()
    expect(screen.queryByText('空調')).toBeNull()
    expect(screen.getAllByText(/試算估計/).length).toBeGreaterThan(0)
  })
})
