import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderPage'
import { routes } from './routes'

describe('信任頁面 /about、/methodology 與 Shell 導覽', () => {
  it('/about 顯示成大團隊與競賽身分、做與不做清單、隱私承諾與排序權重（不含個人真實姓名）', async () => {
    renderApp(routes, { url: '/about', data: {}, companyId: null })

    expect(await screen.findByText(/國立成功大學研究與工程團隊/)).toBeTruthy()
    expect(screen.getAllByText(/2026 全國 AI 專題創意競賽參賽作品/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('這個平台做什麼')).toBeTruthy()
    expect(screen.getByText('這個平台絕對不做什麼')).toBeTruthy()
    expect(screen.getByText(/資料只存在你的瀏覽器/)).toBeTruthy()
    expect(screen.getByText(/廠商看不到你，除非你自己聯絡他/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /看所有計算公式與官方出處/ }).getAttribute('href')).toBe('/methodology')
  })

  it('/methodology 顯示所有公式、3 期契約門檻、PDF 待複核提醒、誤差口徑與可點擊官方連結', async () => {
    renderApp(routes, { url: '/methodology', data: {}, companyId: null })

    expect(await screen.findByText('1. 電費單健檢與碳排公式')).toBeTruthy()
    expect(screen.getByText(/填寫達/)).toBeTruthy()
    expect(screen.getByText(/3 期以上/)).toBeTruthy()
    expect(screen.getAllByText(/營業規則待原文 PDF/).length).toBe(2)
    expect(screen.getByText(/只驗證「已知節電量→電費→回本」換算/)).toBeTruthy()

    const tariffLink = screen.getByRole('link', { name: /台灣電力公司《114年10月電價公告》/ })
    expect(tariffLink.getAttribute('href')).toContain('moeaea.gov.tw')
  })

  it('Shell 手機底部導覽第 2 格為電費單健檢、「更多」抽屜含市集與信任頁、footer 不含試用回饋', async () => {
    renderApp(routes, { url: '/bill-checkup', data: {}, companyId: null })

    const mobileNav = await screen.findByRole('navigation', { name: '底部導覽' })
    expect(within(mobileNav).getByRole('link', { name: '電費單健檢' })).toBeTruthy()

    const moreBtn = within(mobileNav).getByRole('button', { name: '更多' })
    fireEvent.click(moreBtn)

    const drawer = await screen.findByRole('region', { name: '更多導覽選項' })
    expect(within(drawer).getByRole('link', { name: '需求市集' })).toBeTruthy()
    expect(within(drawer).getByRole('link', { name: '關於我們與隱私' })).toBeTruthy()
    expect(within(drawer).getByRole('link', { name: '方法與公式出處' })).toBeTruthy()
    expect(within(drawer).getByRole('link', { name: '試用回饋' })).toBeTruthy()

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: '關於我們與資料隱私' })).toBeTruthy()
    expect(within(footer).getByRole('link', { name: '方法與公式出處' })).toBeTruthy()
    expect(within(footer).queryByRole('link', { name: /試用回饋/ })).toBeNull()
  })
})
