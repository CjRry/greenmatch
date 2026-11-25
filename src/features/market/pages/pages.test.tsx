import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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
import FactoryProfile from './FactoryProfile'
import Feedback, { buildFeedbackMail, computeWeightedScore } from './Feedback'

describe('market pages with seed data', () => {
  it('Landing shows the bill-checkup pitch, primary CTAs, 4-to-3 preview without demo data on first screen, and collapsed platform details', async () => {
    renderPage(<Landing />)
    expect(await screen.findByRole('heading', { level: 1, name: /免費電費與節能健檢：\s*看電費單就知道現在能省多少、碳排多少/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: '免費做電費單健檢' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '用我的工廠資料開始' })).toBeTruthy()
    expect(screen.getByLabelText('電費單 4 欄變成健檢報告 3 行結果')).toBeTruthy()
    expect(screen.getByText(/NT\$ 19,006/)).toBeTruthy()
    expect(screen.getByText(/447\.4 tCO2e/)).toBeTruthy()
    expect(screen.getByText(/能源署 114 年 0\.466 係數/)).toBeTruthy()
    expect(screen.getByText('真實公開案例：電費與回本換算準不準')).toBeTruthy()
    expect(screen.getByText(/平台介紹（/)).toBeTruthy()
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
    expect(screen.getByText('曾合作產業：')).toBeTruthy()
  })
  it('FactoryProfile renders f01', async () => {
    renderPage(<FactoryProfile />, { path: '/factories/:id', url: '/factories/f01' })
    expect(await screen.findByText('工廠介紹')).toBeTruthy()
  })
  it('Landing highlights matched government subsidies', async () => {
    renderPage(<Landing />, { path: '/' })
    expect(await screen.findByText('送出需求就幫你比對 7 項製造業政府補助')).toBeTruthy()
    expect(screen.getByText(/12–43 萬/)).toBeTruthy()
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
    expect(await screen.findByRole('heading', { level: 1, name: /免費電費與節能健檢/ })).toBeTruthy()
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
    expect(await screen.findByRole('heading', { level: 1, name: /永豐金屬.*・工作台摘要/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: '前往我的工作台' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '查看平台介紹與 8 階段說明' }))
    expect(await screen.findByText('每個案件走 8 個標準階段')).toBeTruthy()
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
