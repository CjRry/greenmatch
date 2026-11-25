import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { clearBillDraft } from '../core/billDraft'
import { routes } from './routes'
import { renderApp } from '../test/renderPage'

describe('/bill-checkup（電費單健檢頁面）', () => {
  beforeEach(() => {
    clearBillDraft()
    window.localStorage.clear()
  })
  it('未登入空白起步也能填電費單，並提供台電／能源署官方出處連結', async () => {
    renderApp(routes, { url: '/bill-checkup', data: {}, companyId: null })
    expect(await screen.findByRole('heading', { level: 1, name: /電費單健檢/ })).toBeTruthy()
    expect(screen.getByText('填完上面任一格，報告會立刻出現在這裡')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('契約容量（kW）'), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText('最高需量（kW）'), { target: { value: '235' } })
    fireEvent.change(screen.getByLabelText('功率因數（%）'), { target: { value: '74' } })
    fireEvent.change(screen.getByLabelText('總用電度數（kWh／度）'), { target: { value: '80000' } })
    fireEvent.change(screen.getByLabelText('本期電費總金額（元）'), { target: { value: '419006' } })

    expect((await screen.findAllByText('已超約（加倍計收）')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('未達 80%（加收調整費）')).toBeTruthy()
    expect(screen.queryByText(/最划算契約試算：235 kW/)).toBeNull()
    expect(screen.getByText('契約容量最佳化需至少 3 期帳單')).toBeTruthy()
    expect(screen.getAllByText('規則待原文 PDF 複核').length).toBe(2)
    expect(screen.getByRole('button', { name: /依據：台電 114\/10 ×2／×3 倍規則/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /列印／存成 PDF 健檢報告/ })).toBeTruthy()
    expect(screen.getByText('綠媒 GreenMatch 電費單健檢試算摘要')).toBeTruthy()
    expect(screen.getAllByText(/單月年化約/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/單季不推估年省/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/NT\$ 1\.9 萬/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/447\.4 tCO2e/).length).toBeGreaterThanOrEqual(1)

    // 沒有填分時度數時，不硬算方案比較
    expect(screen.getByText('待填分時度數')).toBeTruthy()
    expect(screen.getByText(/平台不硬猜分時比例/)).toBeTruthy()

    // 每條公式出處皆有可點擊的官方連結
    const tariffLink = screen.getByRole('link', { name: /台灣電力公司《114年10月電價公告》/ })
    expect(tariffLink.getAttribute('href')).toContain('moeaea.gov.tw')
  })

  it('已登入工廠可一鍵帶入範例並將契約容量與平均電價存回工廠數據', async () => {
    const { store } = renderApp(routes, { url: '/bill-checkup', companyId: 'f01' })
    const sampleBtn = await screen.findByRole('button', { name: /試填高壓電範例/ })
    fireEvent.click(sampleBtn)

    expect(await screen.findByText(/已依分時度數試算/)).toBeTruthy()
    const saveBtn = screen.getByRole('button', { name: '將結果存回我的工廠數據' })
    fireEvent.click(saveBtn)

    await waitFor(async () => {
      const f01 = await store.get('companies', 'f01')
      expect(f01?.role === 'factory' && f01.factory.contractKw).toBe(200)
      expect(f01?.role === 'factory' && f01.factory.monthlyKwh).toBe(80_000)
    })
  })

  it('填滿 3 期且契約偏高（300／250 kW）時標籤改為契約容量偏高，且勾選有空壓機時不填風量也能顯示誠實區間與場勘前清單', async () => {
    renderApp(routes, { url: '/bill-checkup', data: {}, companyId: null })
    const addPeriodBtn = await screen.findByRole('button', { name: /再加一期/ })
    fireEvent.click(addPeriodBtn)
    fireEvent.click(addPeriodBtn)

    fireEvent.change(screen.getByLabelText('期別 3 夏月或非夏月'), { target: { value: 'non_summer' } })

    const contractInputs = screen.getAllByLabelText('契約容量（kW）')
    const demandInputs = screen.getAllByLabelText('最高需量（kW）')
    const pfInputs = screen.getAllByLabelText('功率因數（%）')
    const kwhInputs = screen.getAllByLabelText('總用電度數（kWh／度）')
    const billInputs = screen.getAllByLabelText('本期電費總金額（元）')

    for (let i = 0; i < 3; i++) {
      fireEvent.change(contractInputs[i], { target: { value: '300' } })
      fireEvent.change(demandInputs[i], { target: { value: '250' } })
      fireEvent.change(pfInputs[i], { target: { value: '92' } })
      fireEvent.change(kwhInputs[i], { target: { value: '90000' } })
      fireEvent.change(billInputs[i], { target: { value: '420000' } })
    }

    expect((await screen.findAllByText('契約容量偏高，可評估調降')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/正式向台電申請調降前，請預留尖峰生產與夏月氣溫波動的需量餘裕/)).toBeTruthy()

    const compressorCheckbox = screen.getByRole('checkbox', { name: /廠內有空壓機/ })
    fireEvent.click(compressorCheckbox)

    expect(await screen.findByText('5. 適用政府補助初篩（依目前契約容量與設備）')).toBeTruthy()
    expect(screen.getByText('動力與公用設備補助')).toBeTruthy()
    expect(await screen.findByText(/你的實際數字要場勘量測才知道/)).toBeTruthy()
    expect(screen.getByText('風量 m³/min 未填（選填・不卡報告）')).toBeTruthy()
    expect(screen.getByText('12 個月電費單')).toBeTruthy()
    expect(screen.getByText('銘牌照片')).toBeTruthy()
    expect(screen.getByText('運轉時數')).toBeTruthy()
    expect(screen.getByText('需要的壓力')).toBeTruthy()
    expect(screen.getByText('機型是否已登錄補助產品系統？')).toBeTruthy()
    expect(screen.getByText('會不會實測一週風量與壓力？')).toBeTruthy()
    expect(screen.getByText('有沒有節能績效保證？')).toBeTruthy()
    expect(screen.queryByText(/本機示範模式/)).toBeNull()
    expect(screen.getByText('查看診斷說明、候選容量試算與各期超約明細')).toBeTruthy()
    expect(screen.getByText('查看功因加減計算法與年省推估說明')).toBeTruthy()
    expect(screen.getByText('查看分時方案試算細節與計算前提')).toBeTruthy()
    expect(screen.getByText('查看係數出處與 2.5 萬噸碳費門檻說明')).toBeTruthy()
  })

  it('OBS-0005：電費單健檢草稿在切換路由或重開元件後保留，且可一鍵帶入未登入碳盤查頁', async () => {
    const first = renderApp(routes, { url: '/bill-checkup', data: {}, companyId: null })
    fireEvent.change(await screen.findByLabelText('契約容量（kW）'), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText('總用電度數（kWh／度）'), { target: { value: '100000' } })
    fireEvent.change(screen.getByLabelText('本期電費總金額（元）'), { target: { value: '400000' } })
    first.unmount()

    renderApp(routes, { url: '/bill-checkup', data: {}, companyId: null })
    expect((await screen.findByLabelText<HTMLInputElement>('契約容量（kW）')).value).toBe('300')
    expect((screen.getByLabelText<HTMLInputElement>('總用電度數（kWh／度）')).value).toBe('100000')
    expect((screen.getByRole('link', { name: /帶入電費單開啟碳盤查/ })).getAttribute('href')).toBe('/carbon')
  })
})
