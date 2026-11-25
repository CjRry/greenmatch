import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { resolveFactoryFacts } from '../../../core/domain/factoryFacts'
import { LocalStore } from '../../../core/store/local'
import type { Company } from '../../../core/types'
import { renderPage } from '../../../test/renderPage'
import Landing from './Landing'
import Register from './Register'
import EditProfile from './EditProfile'
import NeedsBoard from './NeedsBoard'
import NeedDetail from './NeedDetail'
import VendorDirectory from './VendorDirectory'
import VendorProfile from './VendorProfile'
import InstallDetail from './InstallDetail'
import CaseLibrary from './CaseLibrary'
import FactoryProfile from './FactoryProfile'
import Feedback, { buildFeedbackMail, computeWeightedScore } from './Feedback'

/** Links to single installs inside a region (skips any help links). */
function installLinks(region: HTMLElement): HTMLElement[] {
  return within(region)
    .getAllByRole('link')
    .filter((a) => a.getAttribute('href')?.includes('/installs/'))
}

describe('market pages with seed data', () => {
  it('Landing lists vendors as collections with their latest installs, and keeps the samples out of the first screen', async () => {
    renderPage(<Landing />)
    expect(await screen.findByRole('heading', { level: 1, name: '找節能廠商' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '免費做電費單健檢' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '精選廠商' })).toBeTruthy()
    const ranking = screen.getByRole('region', { name: '熱門節能廠商' })
    expect(within(ranking).getAllByRole('link', { name: /有限公司|工程行/ }).length).toBeGreaterThanOrEqual(9)
    const latest = screen.getByRole('region', { name: '最新安裝紀錄' })
    expect(within(latest).getAllByRole('link').filter((a) => a.getAttribute('href')?.includes('/installs/')).length).toBe(8)
    expect(screen.getByRole('link', { name: /案例儲存庫/ }).getAttribute('href')).toBe('/library')
    expect(screen.getByRole('link', { name: '如何使用' }).getAttribute('href')).toBe('/library?tab=howto')
    // Explanations and samples moved to 案例儲存庫.
    expect(screen.queryByLabelText('電費單 4 欄變成健檢報告 3 行結果')).toBeNull()
    expect(screen.queryByText('真實公開案例：電費與回本換算準不準')).toBeNull()
    expect(screen.queryByLabelText('平台原則')).toBeNull()
    expect(screen.queryByText(/每家廠商是一個系列/)).toBeNull()
  })
  it('Landing gives a signed-in vendor their own workspace, without other vendors', async () => {
    renderPage(<Landing />, { companyId: 'v01' })
    expect(await screen.findByRole('heading', { level: 1, name: '廠商工作台' })).toBeTruthy()
    for (const name of ['輪到你處理', '適合你的新需求', '我的系列', '成效與評價']) expect(screen.getByRole('region', { name })).toBeTruthy()
    expect(screen.queryByRole('region', { name: '精選廠商' })).toBeNull()
    expect(screen.queryByRole('region', { name: '熱門節能廠商' })).toBeNull()
    expect(screen.queryByRole('search')).toBeNull()
    expect(screen.queryByText('冷力空調技術有限公司')).toBeNull()
    const todo = screen.getByRole('region', { name: '輪到你處理' })
    expect(within(todo).getAllByRole('link').length).toBeGreaterThan(0)
    expect(within(screen.getByRole('region', { name: '我的系列' })).getByRole('link', { name: '預覽工廠看到的頁面' }).getAttribute('href')).toBe('/vendors/v01')
    expect(screen.getByText('比較只用匿名中位數，不列出其他廠商。')).toBeTruthy()
  })
  it('Landing filters collections by equipment category', async () => {
    renderPage(<Landing />)
    const chips = await screen.findByRole('group', { name: '依設備類別篩選' })
    expect(within(chips).queryByRole('button', { name: /碳盤查/ })).toBeNull()
    fireEvent.click(within(chips).getByRole('button', { name: /冰水主機/ }))
    expect(within(chips).getByRole('button', { name: /冰水主機/ }).getAttribute('aria-pressed')).toBe('true')
    const all = screen.getByRole('region', { name: '全部廠商系列' })
    const names = within(all).getAllByRole('link').map((a) => a.textContent ?? '')
    expect(names.some((n) => n.includes('北辰能源技術服務'))).toBe(true)
    expect(names.some((n) => n.includes('亮點 LED'))).toBe(false)
    expect(names.some((n) => n.includes('顧問'))).toBe(false)
  })
  it('Register asks for a role first', async () => {
    renderPage(<Register />, { path: '/register' })
    expect(await screen.findByText('登錄公司')).toBeTruthy()
  })
  it('Register blocks an empty step with Chinese errors', async () => {
    renderPage(<Register />, { path: '/register', url: '/register?role=factory' })
    fireEvent.click(await screen.findByRole('button', { name: /下一步/ }))
    expect((await screen.findAllByText(/必填|請/)).length).toBeGreaterThan(0)
  })
  it('EditProfile loads factory as 我的工廠數據 and saves user fact updates', async () => {
    const { store } = renderPage(<EditProfile />, { path: '/me/profile', companyId: 'f01' })
    expect((await screen.findAllByText('我的工廠數據')).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('平均電價（元／度，選填）'), { target: { value: '4.6' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))
    await waitFor(async () => {
      const saved = await store.get('companies', 'f01')
      expect(saved?.role).toBe('factory')
      if (saved?.role === 'factory') {
        expect(saved.factory.avgElectricityPriceNtd).toBe(4.6)
        expect(saved.factory.dataSources?.avgElectricityPriceNtd?.source).toBe('user')
      }
    })
  })
  it('EditProfile loads vendor as 編輯公司資料', async () => {
    renderPage(<EditProfile />, { path: '/me/profile', companyId: 'v01' })
    expect((await screen.findAllByText('編輯公司資料')).length).toBeGreaterThan(0)
  })
  it('editing one equipment row in /me/profile leaves the other quick-register row an estimate (OBS-0004 §2-2)', async () => {
    const store = new LocalStore({ seed: () => ({}), persist: false })
    let latest: readonly Company[] = []
    const unsub = store.subscribe('companies', (docs) => {
      latest = docs
    })
    const reg = renderPage(<Register />, { path: '/register', url: '/register?role=factory&mode=quick', store })
    fireEvent.change(await screen.findByLabelText(/公司名稱/), { target: { value: '驗收測試五金' } })
    fireEvent.change(screen.getByLabelText(/所在縣市/), { target: { value: '台南市' } })
    fireEvent.change(screen.getByLabelText(/員工人數/), { target: { value: '48' } })
    fireEvent.click(screen.getByRole('button', { name: '照明' }))
    fireEvent.click(screen.getByRole('button', { name: '建立空白工作台並開始使用' }))
    await waitFor(() => expect(latest).toHaveLength(1))
    const id = latest[0].id
    if (latest[0].role === 'factory') {
      expect(latest[0].contactName).toBe('')
      expect(latest[0].factory.products).toBe('')
    }
    unsub()
    reg.unmount()

    renderPage(<EditProfile />, { path: '/me/profile', store, companyId: id })
    const qty = await screen.findAllByLabelText('數量')
    expect(qty).toHaveLength(2)
    expect(screen.getAllByText('平台暫填，請改成實際台數')).toHaveLength(2)
    fireEvent.change(qty[0], { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))
    await waitFor(async () => {
      const saved = await store.get('companies', id)
      if (saved?.role !== 'factory') throw new Error('factory expected')
      expect(saved.factory.equipment.map((e) => [e.type, e.quantity, e.source])).toEqual([
        ['air_compressor', 2, 'user'],
        ['lighting', 1, 'estimate'],
      ])
      expect(saved.factory.dataSources?.equipment?.source).toBe('estimate')
    })
  })

  it('quick registers with custom 65000 kWh and keeps monthlyKwh user after editing other fields in /me/profile', async () => {
    const store = new LocalStore({ seed: () => ({}), persist: false })
    let latestCompanies: readonly Company[] = []
    const unsub = store.subscribe('companies', (docs) => {
      latestCompanies = docs
    })
    const reg = renderPage(<Register />, { path: '/register', url: '/register?role=factory&mode=quick', store })
    fireEvent.change(await screen.findByLabelText(/公司名稱/), { target: { value: '實測精密工業' } })
    fireEvent.change(screen.getByLabelText(/所在縣市/), { target: { value: '台中市' } })
    fireEvent.change(screen.getByLabelText(/員工人數/), { target: { value: '40' } })
    fireEvent.change(screen.getByLabelText('或直接輸入每月平均用電（度，選填）'), { target: { value: '65000' } })
    fireEvent.click(screen.getByRole('button', { name: '建立空白工作台並開始使用' }))

    let createdId = ''
    await waitFor(() => {
      expect(latestCompanies).toHaveLength(1)
      createdId = latestCompanies[0].id
      expect(latestCompanies[0].role).toBe('factory')
      if (latestCompanies[0].role === 'factory') {
        expect(latestCompanies[0].factory.monthlyKwh).toBe(65000)
        expect(latestCompanies[0].factory.dataSources?.monthlyKwh?.source).toBe('user')
        expect(latestCompanies[0].factory.dataSources?.monthlyKwh?.note).toBe('註冊時自行輸入每月平均用電度數')
      }
    })
    unsub()
    reg.unmount()

    renderPage(<EditProfile />, { path: '/me/profile', store, companyId: createdId })
    expect((await screen.findAllByText('我的工廠數據')).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('平均電價（元／度，選填）'), { target: { value: '3.8' } })
    fireEvent.change(screen.getByLabelText('契約容量（kW，選填）'), { target: { value: '180' } })
    fireEvent.change(screen.getByLabelText('數量'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('每台 kW（選填）'), { target: { value: '37' } })
    fireEvent.change(screen.getByLabelText('每日運轉（小時，選填）'), { target: { value: '16' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))

    await waitFor(async () => {
      const saved = await store.get('companies', createdId)
      expect(saved?.role).toBe('factory')
      if (saved?.role === 'factory') {
        expect(saved.factory.monthlyKwh).toBe(65000)
        expect(saved.factory.dataSources?.monthlyKwh?.source).toBe('user')
        expect(saved.factory.dataSources?.avgElectricityPriceNtd?.source).toBe('user')
        expect(saved.factory.dataSources?.contractKw?.source).toBe('user')
        expect(saved.factory.dataSources?.equipment?.source).toBe('user')
        expect(saved.factory.equipment[0]).toMatchObject({ quantity: 2, ratedKw: 37, dailyHours: 16 })
        const facts = resolveFactoryFacts(saved)
        expect(facts.monthlyKwh.note).not.toContain('依既有資料或電費區間估算')
      }
    })
  })
  it('EditProfile lets user confirm legacy unannotated factory facts as user source', async () => {
    const { store } = renderPage(<EditProfile />, {
      path: '/me/profile',
      companyId: 'f_legacy',
      data: {
        companies: [
          {
            id: 'f_legacy',
            role: 'factory',
            name: '既有工廠',
            city: '彰化縣',
            contactName: '林廠長',
            intro: '既有工廠無 dataSources',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            factory: {
              industry: '金屬加工',
              products: '螺絲',
              employees: 30,
              scale: 'S',
              mainCustomers: [],
              pressures: ['cost'],
              monthlyKwh: 55000,
              equipment: [],
            },
          },
        ],
      },
    })
    const confirmBtn = await screen.findByRole('button', { name: '確認這是實際數字 → 轉為你填的' })
    fireEvent.click(confirmBtn)
    fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))
    await waitFor(async () => {
      const saved = await store.get('companies', 'f_legacy')
      expect(saved?.role).toBe('factory')
      if (saved?.role === 'factory') {
        expect(saved.factory.dataSources?.monthlyKwh?.source).toBe('user')
      }
    })
  })
  it('NeedsBoard lists needs', async () => {
    renderPage(<NeedsBoard />, { path: '/needs' })
    expect(await screen.findByText('需求市集')).toBeTruthy()
  })
  it('NeedDetail renders n01', async () => {
    renderPage(<NeedDetail />, { path: '/needs/:id', url: '/needs/n01' })
    expect(await screen.findByText(/工廠原話/)).toBeTruthy()
  })
  it('VendorDirectory renders with collapsible mobile filter toggle', async () => {
    renderPage(<VendorDirectory />, { path: '/vendors' })
    expect(await screen.findByText('廠商名錄')).toBeTruthy()
    const toggle = screen.getByRole('button', { name: /篩選/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.change(screen.getByLabelText('服務項目'), { target: { value: 'hvac' } })
    expect(screen.getByRole('button', { name: /篩選 \(1\)/ })).toBeTruthy()
  })
  it('VendorDirectory lets signed-in factory quick-filter same-industry vendors', async () => {
    renderPage(<VendorDirectory />, { path: '/vendors', companyId: 'f01' })
    const btn = await screen.findByRole('button', { name: /只看合作過本廠同業（金屬加工）/ })
    fireEvent.click(btn)
    expect(screen.getByText(/已篩選本廠同業（金屬加工）/)).toBeTruthy()
    expect(screen.getByText('綠能節電工程股份有限公司')).toBeTruthy()
    expect(screen.queryByText('熱力循環工程有限公司')).toBeNull()
  })
  it('VendorDirectory shows curated real public vendors and opens copy-only inquiry dialog', async () => {
    renderPage(<VendorDirectory />, { path: '/vendors', companyId: 'f01' })
    expect(await screen.findByText('真實廠商公開名單（找廠商工具包）')).toBeTruthy()
    expect(screen.getByText('復盛股份有限公司（FUSHENG）')).toBeTruthy()
    expect(screen.getAllByText('依公開資料整理，非平台合作廠商、未經對方確認').length).toBeGreaterThanOrEqual(6)
    const buttons = screen.getAllByRole('button', { name: '想請這家來場勘' })
    expect(buttons).toHaveLength(6)
    fireEvent.click(buttons[0])
    expect(await screen.findByText(/整理場勘詢價訊息｜復盛股份有限公司/)).toBeTruthy()
    expect(screen.getAllByText('平台不會代你聯絡，請依公開資訊自行洽詢').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('button', { name: '一鍵複製詢價內容' })).toBeTruthy()
  })
  it('VendorDirectory StandardQuoteTool extracts 9 fields and alerts un-metered high savings claim', async () => {
    renderPage(<VendorDirectory />, { path: '/vendors' })
    const pasteBox = await screen.findByLabelText(/貼上廠商報價內容/)
    fireEvent.change(pasteBox, {
      target: { value: '機型 PMV-50 37kW IE4，設備費 120 萬、施工費 15 萬，宣稱省 40%（經驗估算，尚未實測風量），不確定是否登錄補助系統' },
    })
    fireEvent.click(screen.getByRole('button', { name: /整理成 9 個標準欄位/ }))
    expect(await screen.findByText(/宣稱省 40%，但沒有實測風量/)).toBeTruthy()
    expect(screen.getByText(/機型未確認是否登錄補助產品系統/)).toBeTruthy()
  })
  it('VendorProfile renders v01 and highlights same-industry experience for signed-in factory', async () => {
    renderPage(<VendorProfile />, { path: '/vendors/:id', url: '/vendors/v01', companyId: 'f01' })
    expect(await screen.findByText('廠商介紹')).toBeTruthy()
    expect(screen.getByText('可協助申請補助')).toBeTruthy()
    expect(screen.getByText(/與貴廠同業：金屬加工/)).toBeTruthy()
    const gallery = screen.getByRole('region', { name: '安裝紀錄' })
    const items = installLinks(gallery)
    expect(items.length).toBeGreaterThanOrEqual(5)
    expect(items.every((a) => a.getAttribute('href')?.startsWith('/vendors/v01/installs/'))).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: /關於廠商/ }))
    expect(await screen.findByText('服務項目')).toBeTruthy()
  })
  it('Landing search narrows vendors by install text and offers a way back', async () => {
    renderPage(<Landing />)
    const box = await screen.findByRole('searchbox', { name: '搜尋廠商、設備或產業' })
    fireEvent.change(box, { target: { value: '鍋爐' } })
    fireEvent.click(screen.getByRole('button', { name: '搜尋廠商' }))
    const all = await screen.findByRole('region', { name: '全部廠商系列' })
    const names = within(all).getAllByRole('link').map((a) => a.textContent ?? '')
    expect(names.some((n) => n.includes('熱力循環工程'))).toBe(true)
    expect(names.some((n) => n.includes('亮點 LED'))).toBe(false)
    fireEvent.change(box, { target: { value: '完全不存在的關鍵字' } })
    fireEvent.click(screen.getByRole('button', { name: '搜尋廠商' }))
    expect(await screen.findByText('找不到符合的廠商')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: '清除篩選' })[0])
    expect(await screen.findByRole('region', { name: '全部廠商系列' })).toBeTruthy()
  })
  it('VendorProfile filters installs by equipment', async () => {
    renderPage(<VendorProfile />, { path: '/vendors/:id', url: '/vendors/v01' })
    const gallery = await screen.findByRole('region', { name: '安裝紀錄' })
    const total = installLinks(gallery).length
    fireEvent.click(within(gallery).getByRole('button', { name: /能源管理系統/ }))
    const filtered = installLinks(gallery)
    expect(filtered.length).toBeLessThan(total)
    expect(filtered.every((a) => a.textContent?.includes('能源管理系統'))).toBe(true)
  })
  it('InstallDetail shows the vendor emblem, traits with shares, and all 8 stages', async () => {
    renderPage(<InstallDetail />, { path: '/vendors/:id/installs/:installId', url: '/vendors/v01/installs/v01-1' })
    expect(await screen.findByRole('heading', { level: 1, name: '鋼鐵加工廠空壓系統整合' })).toBeTruthy()
    expect(document.querySelectorAll('svg circle[r="46"]')).toHaveLength(0)
    const gauges = screen.getAllByRole('img', { name: /^節電 \d+%，刻度 0 到 50%$/ })
    expect(gauges[0].getAttribute('aria-label')).toBe('節電 24%，刻度 0 到 50%')
    const traits = screen.getByRole('region', { name: '流程特徵' })
    expect(within(traits).getAllByText(/% 有此特徵/).length).toBe(9)
    const flow = screen.getByRole('region', { name: '安裝流程' })
    expect(within(flow).getAllByRole('listitem').length).toBe(8)
    expect(screen.getByRole('region', { name: '同廠商其他安裝' })).toBeTruthy()
  })
  it('CaseLibrary opens on 如何使用, then keeps the bill sample, stages and demo walkthrough', async () => {
    renderPage(<CaseLibrary />, { path: '/library' })
    expect(await screen.findByRole('heading', { level: 1, name: '案例儲存庫' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '如何使用' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('看節能廠商做過的每一件案子')).toBeTruthy()
    expect(screen.queryByRole('region', { name: '怎麼看封面' })).toBeNull()
    expect(within(screen.getByRole('region', { name: '平台原則' })).getAllByRole('listitem')).toHaveLength(3)
    fireEvent.click(screen.getByRole('tab', { name: '電費單健檢範例' }))
    expect(await screen.findByLabelText('電費單 4 欄變成健檢報告 3 行結果')).toBeTruthy()
    expect(screen.getByText(/NT\$ 19,006/)).toBeTruthy()
    expect(screen.getByText(/447\.4 tCO2e/)).toBeTruthy()
    expect(screen.getByText(/能源署 114 年 0\.466 係數/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '8 階段流程' }))
    expect(await screen.findByText('每個案件走 8 個標準階段')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '示範體驗' }))
    expect(await screen.findByText(/送出需求就幫你比對 7 項製造業政府補助/)).toBeTruthy()
    expect(screen.getByText(/12–43 萬/)).toBeTruthy()
  })
  it('FactoryProfile renders f01', async () => {
    renderPage(<FactoryProfile />, { path: '/factories/:id', url: '/factories/f01' })
    expect(await screen.findByText('工廠介紹')).toBeTruthy()
  })
  it('Feedback page renders rubric items with unselected defaults, NPS, and prefilled mailto link after selection', async () => {
    renderPage(<Feedback />, { path: '/feedback', companyId: 'f01' })
    expect(await screen.findByRole('heading', { level: 1, name: '試用回饋' })).toBeTruthy()
    expect(screen.getByText('完成任務容易度')).toBeTruthy()
    expect(screen.getByText('看得懂（用語、流程、下一步）')).toBeTruthy()
    expect(screen.getByText('信任感（來源、金額標示、廠商可信度）')).toBeTruthy()
    expect(screen.getByText('對工作有用（省時、省錢、補助）')).toBeTruthy()
    expect(screen.getByText('視覺與順暢度（含手機）')).toBeTruthy()
    expect(screen.getByText(/已評 0 \/ 5 題/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: '完成任務容易度 4 分' }))
    fireEvent.click(screen.getByRole('radio', { name: '看得懂（用語、流程、下一步） 5 分' }))
    fireEvent.click(screen.getByRole('radio', { name: '信任感（來源、金額標示、廠商可信度） 5 分' }))
    fireEvent.click(screen.getByRole('radio', { name: '對工作有用（省時、省錢、補助） 5 分' }))
    fireEvent.click(screen.getByRole('radio', { name: '視覺與順暢度（含手機） 5 分' }))
    fireEvent.click(screen.getByRole('radio', { name: '推薦意願 10 分' }))
    const mailLink = screen.getByRole('link', { name: '開啟信箱送出回饋' })
    const href = mailLink.getAttribute('href') ?? ''
    expect(href).toContain('mailto:chris0308.lee@gmail.com')
    expect(decodeURIComponent(href)).toContain('[GreenMatch 試用回饋]')
    expect(decodeURIComponent(href)).toContain('95 / 100')
    expect(decodeURIComponent(href)).toContain('10 / 10')
  })
  it('buildFeedbackMail and computeWeightedScore calculate weights accurately', () => {
    const w = computeWeightedScore({ ease: 4, clarity: 5, trust: 4, usefulness: 5, visual: 3 })
    expect(w.total).toBe(20 + 20 + 16 + 20 + 9)
    const mail = buildFeedbackMail({
      feedbackRole: 'vendor',
      orgName: '台中機電',
      scores: { ease: 4, clarity: 5, trust: 4, usefulness: 5, visual: 3 },
      nps: 8,
      liked: '需求表清楚',
      improve: '希望能匯出報表',
    })
    expect(mail.subject).toMatch(/^\[GreenMatch 試用回饋\] 廠商（台中機電）｜總分 85\/100｜NPS 8\/10$/)
    expect(mail.body).toContain('需求表清楚')
    expect(mail.body).toContain('希望能匯出報表')
  })
})

describe('market pages with an empty store', () => {
  it('Landing still renders', async () => {
    renderPage(<Landing />, { data: {} })
    expect(await screen.findByRole('heading', { level: 1, name: '找節能廠商' })).toBeTruthy()
    expect(await screen.findByText('名錄裡還沒有節能廠商')).toBeTruthy()
  })
  it('InstallDetail shows not-found', async () => {
    renderPage(<InstallDetail />, { path: '/vendors/:id/installs/:installId', url: '/vendors/v01/installs/zz' })
    expect(await screen.findByText('這件安裝紀錄不存在或已被移除')).toBeTruthy()
  })
  it('NeedsBoard shows the empty state', async () => {
    renderPage(<NeedsBoard />, { path: '/needs', data: {} })
    expect(await screen.findByText('目前沒有開放中的需求')).toBeTruthy()
  })
  it('VendorDirectory shows the empty state', async () => {
    renderPage(<VendorDirectory />, { path: '/vendors', data: {} })
    expect(await screen.findByText('名錄裡還沒有廠商')).toBeTruthy()
  })
  it('NeedDetail shows not-found', async () => {
    renderPage(<NeedDetail />, { path: '/needs/:id', url: '/needs/zz', data: {} })
    expect(await screen.findByText('這筆需求不存在或已被移除')).toBeTruthy()
  })
  it('VendorProfile shows not-found', async () => {
    renderPage(<VendorProfile />, { path: '/vendors/:id', url: '/vendors/zz', data: {} })
    expect(await screen.findByText('這家廠商不存在或已被移除')).toBeTruthy()
  })
  it('FactoryProfile shows not-found', async () => {
    renderPage(<FactoryProfile />, { path: '/factories/:id', url: '/factories/zz', data: {} })
    expect(await screen.findByText('這家工廠不存在或已被移除')).toBeTruthy()
  })
  it('EditProfile signed out shows the empty state', async () => {
    renderPage(<EditProfile />, { path: '/me/profile', data: {} })
    expect(await screen.findByText('還沒有登入身分')).toBeTruthy()
  })
  it('Landing shows personal workspace summary when signed in', async () => {
    renderPage(<Landing />, { path: '/', companyId: 'f01' })
    const strip = await screen.findByLabelText('專屬工作台摘要')
    expect(within(strip).getByText(/永豐金屬/)).toBeTruthy()
    expect(within(strip).getByRole('link', { name: '前往我的工作台' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: '找節能廠商' })).toBeTruthy()
  })
  it('Register quick wizard creates a clean non-demo factory and seeds carbon', async () => {
    const { store } = renderPage(<Register />, { path: '/register', url: '/register?role=factory&mode=quick' })
    fireEvent.change(await screen.findByLabelText(/公司名稱/), { target: { value: '新創精密' } })
    fireEvent.change(screen.getByLabelText(/所在縣市/), { target: { value: '台中市' } })
    fireEvent.change(screen.getByLabelText(/員工人數/), { target: { value: '35' } })
    fireEvent.change(screen.getByLabelText(/或直接輸入每月平均用電/), { target: { value: '50000' } })
    fireEvent.click(screen.getByRole('button', { name: '建立空白工作台並開始使用' }))
    await waitFor(async () => {
      expect(screen.getByTestId('location').textContent).toBe('/me')
    })
    const companies = await new Promise<readonly { name: string; isDemo?: boolean }[]>((resolve) => {
      const off = store.subscribe('companies', (docs) => {
        off()
        resolve(docs)
      })
    })
    expect(companies.some((c) => c.name === '新創精密' && c.isDemo === false)).toBe(true)
  })
})
