import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { FactProvenance, FactSourceBadge, type ProvenanceItem } from './FactProvenance'

const ITEMS: ProvenanceItem[] = [
  {
    key: 'avgElectricityPriceNtd',
    label: '平均電價',
    displayValue: '4.2 元/度',
    source: 'estimate',
    note: '未填寫，暫用平台平均工業電價 4.2 元/度估算',
    editable: {
      factKey: 'avgElectricityPriceNtd',
      initialValue: 4.2,
      unit: '元/度',
      placeholder: '例如 3.8',
    },
  },
  {
    key: 'monthlyKwh',
    label: '月平均用電度數',
    displayValue: '65,000 度',
    source: 'user',
    note: '依貴廠填寫之月平均用電度數',
  },
]

describe('FactSourceBadge', () => {
  it('renders user and estimate labels for field and derived variants', () => {
    render(
      <div>
        <FactSourceBadge source="user" />
        <FactSourceBadge source="estimate" />
        <FactSourceBadge source="user" variant="derived" />
        <FactSourceBadge source="estimate" variant="derived" />
      </div>,
    )
    expect(screen.getByText('你填的')).toBeTruthy()
    expect(screen.getByText('平台估算')).toBeTruthy()
    expect(screen.getByText('依你填的資料')).toBeTruthy()
    expect(screen.getByText('含平台估算')).toBeTruthy()
  })
})

describe('FactProvenance', () => {
  it('expands, shows source notes, and applies inline edit', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined)
    render(
      <MemoryRouter>
        <FactProvenance items={ITEMS} onApply={onApply} profileHref="/me/profile" />
      </MemoryRouter>,
    )

    const toggle = screen.getByRole('button', { name: /這個數字用了哪些資料/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('未填寫，暫用平台平均工業電價 4.2 元/度估算')).toBeTruthy()
    expect(screen.getByText('你填的')).toBeTruthy()
    expect(screen.getByText('平台估算')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '改成我的數字' }))
    fireEvent.change(screen.getByLabelText('修改平均電價'), { target: { value: '3.8' } })
    fireEvent.click(screen.getByRole('button', { name: '套用並重算' }))

    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ avgElectricityPriceNtd: 3.8 }))
  })

  it('rejects invalid input and does not call onApply', () => {
    const onApply = vi.fn()
    render(
      <MemoryRouter>
        <FactProvenance items={ITEMS} onApply={onApply} defaultOpen />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: '改成我的數字' }))
    fireEvent.change(screen.getByLabelText('修改平均電價'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: '套用並重算' }))
    expect(screen.getByText(/請輸入大於 0 的有效數字/)).toBeTruthy()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('disables editing and displays notice in readOnly mode', () => {
    render(
      <MemoryRouter>
        <FactProvenance items={ITEMS} onApply={vi.fn()} readOnly readOnlyReason="目前為唯讀示範模式" defaultOpen />
      </MemoryRouter>,
    )
    expect(screen.getByText('目前為唯讀示範模式')).toBeTruthy()
    const editBtn = screen.getByRole('button', { name: '改成我的數字' }) as HTMLButtonElement
    expect(editBtn.disabled).toBe(true)
  })

  it('shows 均依你填的資料計算 when no item is estimated', () => {
    render(
      <MemoryRouter>
        <FactProvenance items={[ITEMS[1]]} />
      </MemoryRouter>,
    )
    expect(screen.getByText('均依你填的資料計算')).toBeTruthy()
  })
})
