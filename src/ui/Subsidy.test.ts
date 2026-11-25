import { describe, expect, it } from 'vitest'
import { SUBSIDIES, SUBSIDY_BY_ID } from '../core/subsidies'
import { relayedLabel } from './Subsidy'

describe('relayedLabel（轉述來源的標籤）', () => {
  it('投資抵減已施行：顯示「政策參考」，不顯示「待開辦」', () => {
    expect(relayedLabel('tax-credit')).toBe('政策參考')
    expect(relayedLabel('tax-credit')).not.toContain('待開辦')
  })

  it('動力設備補助已完成 115/01/29 官方核對（reliability: official）', () => {
    expect(SUBSIDY_BY_ID['power-equipment'].reliability).toBe('official')
  })

  it('其餘轉述來源（尚待官方公告者）維持「政策參考／待開辦」', () => {
    const others = SUBSIDIES.filter((s) => s.reliability === 'relayed' && s.id !== 'tax-credit')
    expect(others.length).toBeGreaterThan(0)
    for (const s of others) expect(relayedLabel(s.id)).toBe('政策參考／待開辦')
  })
})
