import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderPage } from '../test/renderPage'
import { PUBLIC_CASES } from '../data/publicCases'
import Landing from '../features/market/pages/Landing'
import PublicCases from './PublicCases'
import { SimilarCasePayback } from '../ui'

describe('PublicCases page', () => {
  it('lists every sourced case with its source link, the 「公開案例」 label and the backtest error', async () => {
    renderPage(<PublicCases />, { path: '/public-cases' })
    expect(await screen.findByRole('heading', { name: '公開節能案例與回本回測' })).toBeTruthy()
    expect(screen.getAllByText('公開案例').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/這些企業沒有使用本平台/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/只驗證「節電量 → 電費 → 回本」的換算，未驗證節電量預測/).length).toBeGreaterThan(0)
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(PUBLIC_CASES.length + 1)
    for (const c of PUBLIC_CASES) {
      const link = within(table).getByRole('link', { name: new RegExp(c.source.caseNo) })
      expect(link.getAttribute('href')).toBe(c.source.url)
    }
    // Values the source does not state are marked, never filled in.
    expect(within(table).getAllByText('來源未揭露').length).toBeGreaterThan(0)
    expect(screen.getByText('有出處的公開案例')).toBeTruthy()
    expect(screen.getByText('已知節電量時，電費與回本換算誤差')).toBeTruthy()
    expect(screen.getAllByText(/本回測只驗證「節電量 → 電費 → 回本」的換算，未驗證節電量預測/).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText('示範')).toBeNull()
  })

  it('shows an empty state when no case has been verified yet', async () => {
    renderPage(<PublicCases cases={[]} />, { path: '/public-cases' })
    expect(await screen.findByText('還沒有查證完成的公開案例')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('SimilarCasePayback', () => {
  it('lists same-equipment cases with the payback re-run at the factory rate', async () => {
    renderPage(<SimilarCasePayback equips={['air_compressor']} electricityRate={4.2} rateSource="estimate" cases={PUBLIC_CASES} allCasesTo="/public-cases" />)
    const block = await screen.findByRole('region', { name: '回本參考' })
    const n = PUBLIC_CASES.filter((c) => c.equip === 'air_compressor').length
    expect(n).toBeGreaterThan(0)
    expect(within(block).getAllByRole('listitem')).toHaveLength(n)
    expect(within(block).getAllByText('用貴廠電價').length).toBe(n)
    expect(within(block).getByText('平台估算')).toBeTruthy()
  })

  it('says so when no public case shares the equipment, without a dead end', async () => {
    renderPage(<SimilarCasePayback equips={['boiler']} electricityRate={4.2} rateSource="user" cases={PUBLIC_CASES} allCasesTo="/public-cases" />)
    const block = await screen.findByRole('region', { name: '回本參考' })
    expect(within(block).getByText(/目前還沒有同設備的公開案例/)).toBeTruthy()
    expect(within(block).getByRole('link', { name: '看全部公開案例與回測誤差' })).toBeTruthy()
  })
})

describe('Landing public cases', () => {
  it('shows sourced cases on the first screen, apart from the demo data', async () => {
    renderPage(<Landing />, { data: {} })
    const section = await screen.findByRole('region', { name: '公開節能案例' })
    expect(within(section).getByText(`看全部 ${PUBLIC_CASES.length} 筆與回測表`)).toBeTruthy()
    expect(within(section).getAllByRole('link', { name: /114-/ }).length).toBe(3)
    expect(within(section).queryByText('示範')).toBeNull()
  })
})
