import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderPage } from '../../../test/renderPage'
import { fixtureData } from '../../../test/fixtures'
import QuoteSubmit, { extractCommercialTerms, extractFromRawText } from './QuoteSubmit'

const url = '/cases/c01/quote/new'
const path = '/cases/:id/quote/new'

describe('QuoteSubmit', () => {
  it('lets a shortlisted vendor update their quote and records an event', async () => {
    const data = fixtureData()
    const c = data.cases!.find((x) => x.id === 'c01')!
    const quote = data.quotes!.find((q) => q.caseId === 'c01')!
    const { store } = renderPage(<QuoteSubmit />, { path, url, companyId: quote.vendorId })
    expect(c.shortlist).toContain(quote.vendorId)
    const box = (await screen.findByLabelText(/報價內容/)) as HTMLTextAreaElement
    await waitFor(() => expect(box.value).toBe(quote.rawText))
    fireEvent.change(box, { target: { value: '更新後的報價：設備費 100 萬' } })
    fireEvent.click(screen.getByRole('button', { name: '更新報價' }))
    expect((await screen.findByTestId('location')).textContent).toBe('/cases/c01')
    const saved = (await store.get('quotes', quote.id))!
    expect(saved.rawText).toContain('更新後')
  })

  it('requires quote text', async () => {
    renderPage(<QuoteSubmit />, { path, url, companyId: seedCase().shortlist.find((id) => !quotedIds().includes(id)) ?? seedCase().shortlist[0] })
    const box = (await screen.findByLabelText(/報價內容/)) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /送出報價|更新報價/ }))
    expect(await screen.findByText('請貼上或寫下報價內容')).toBeTruthy()
  })

  it('refuses a vendor who is not on the shortlist', async () => {
    const outsider = fixtureData().companies!.find((x) => x.role === 'vendor' && !seedCase().shortlist.includes(x.id))!
    renderPage(<QuoteSubmit />, { path, url, companyId: outsider.id })
    expect(await screen.findByText('目前不能提交報價')).toBeTruthy()
    expect(screen.queryByLabelText(/報價內容/)).toBeNull()
  })

  it('asks a signed-out visitor to sign in, also with an empty store', async () => {
    renderPage(<QuoteSubmit />, { path, url, companyId: null, data: {} })
    expect(await screen.findByText('請先以廠商身分登入')).toBeTruthy()
  })

  it('re-extracts comma-formatted amounts cleanly from the quote text button', async () => {
    const data = fixtureData()
    const quote = data.quotes!.find((q) => q.caseId === 'c01')!
    renderPage(<QuoteSubmit />, { path, url, companyId: quote.vendorId })
    const box = (await screen.findByLabelText(/報價內容/)) as HTMLTextAreaElement
    const sample = [
      '1. 37kW 變頻空壓機主機 2 台',
      '2. 冷凍式乾燥機與精密過濾器',
      '3. 安裝、配管、配電工資 NT$ 210,000',
      '合計（未稅）NT$ 2,251,000',
      '約 45 個月回本',
    ].join('\n')
    fireEvent.change(box, { target: { value: sample } })
    fireEvent.click(screen.getByRole('button', { name: '從上方文字重新擷取數字' }))
    expect(((await screen.findByLabelText(/設備費/)) as HTMLInputElement).value).toBe('2041000')
    expect(((screen.getByLabelText(/施工費/)) as HTMLInputElement).value).toBe('210000')
    expect(((screen.getByLabelText(/回本月數/)) as HTMLInputElement).value).toBe('45')
  })
})

describe('extractFromRawText', () => {
  it('preserves comma-separated thousands across multi-line and inline quotes', () => {
    expect(
      extractFromRawText(
        '3. 安裝、配管、配電工資 NT$ 210,000\n合計（未稅）NT$ 2,251,000\n約 45 個月回本',
      ),
    ).toEqual({
      equipmentNtd: 2041000,
      installNtd: 210000,
      paybackMonths: 45,
    })

    expect(
      extractFromRawText(
        '安裝配管配電工資 NT$ 160,000\n合計（未稅）NT$ 1,260,000\n約 38 個月回本\n基準期：2025年6-8月',
      ),
    ).toEqual({
      equipmentNtd: 1100000,
      installNtd: 160000,
      paybackMonths: 38,
      baseline: '2025年6-8月',
    })

    expect(extractFromRawText('主機設備 NT$ 1,680,000，施工費 NT$ 210,000')).toEqual({
      equipmentNtd: 1680000,
      installNtd: 210000,
    })
  })

  it('extracts commercial validity days, downtime and payment terms', () => {
    expect(
      extractCommercialTerms(
        '報價有效期限：30 天\n預估停機施工：週末 2 天\n付款條件：訂金 30% / 交貨 40% / 驗收 30%。',
      ),
    ).toEqual({
      validityDays: '30',
      downtimeDays: '週末 2 天',
      paymentTerms: '訂金 30% / 交貨 40% / 驗收 30%',
    })
  })
})

function seedCase() {
  return fixtureData().cases!.find((x) => x.id === 'c01')!
}
function quotedIds() {
  return fixtureData().quotes!.filter((q) => q.caseId === 'c01').map((q) => q.vendorId)
}
