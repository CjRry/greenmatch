import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SAVING_GAUGE_MAX, SavingGauge, VendorEmblem, savingGaugeRatio } from './Installs'
import { companyMonogram } from './Domain'

describe('savingGaugeRatio', () => {
  it('maps 0 to 50% onto the dial and clamps above the top of the scale', () => {
    expect(savingGaugeRatio(0)).toBe(0)
    expect(savingGaugeRatio(25)).toBe(0.5)
    expect(savingGaugeRatio(SAVING_GAUGE_MAX)).toBe(1)
    expect(savingGaugeRatio(80)).toBe(1)
    expect(savingGaugeRatio(-5)).toBe(0)
  })
  it('returns null when the install has no saving rate', () => {
    expect(savingGaugeRatio(null)).toBeNull()
    expect(savingGaugeRatio(undefined)).toBeNull()
    expect(savingGaugeRatio(Number.NaN)).toBeNull()
  })
})

describe('SavingGauge', () => {
  it('names the value and draws a needle', () => {
    const { container } = render(<SavingGauge pct={19} />)
    expect(screen.getByRole('img', { name: '節電 19%，刻度 0 到 50%' })).toBeTruthy()
    expect(container.querySelector('line')).toBeTruthy()
  })
  it('shows an empty dial without a needle when not measured', () => {
    const { container } = render(<SavingGauge pct={null} />)
    expect(screen.getByRole('img', { name: '不計節電率' })).toBeTruthy()
    expect(container.querySelector('line')).toBeNull()
  })
})

describe('VendorEmblem', () => {
  it('shows the vendor monogram without company suffixes', () => {
    expect(companyMonogram('綠能節電工程股份有限公司')).toBe('綠能')
    render(<VendorEmblem name="府城機電工程有限公司" id="v04" />)
    expect(screen.getByText('府城')).toBeTruthy()
  })
})
