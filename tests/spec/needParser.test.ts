import { describe, expect, it } from 'vitest'
import { parseNeed } from '../../src/features/ai/lib/needParser'

const EXAMPLE = '我們工廠空壓機有 3 台，都用了十幾年，最近電費越來越高，夏天冷氣也很耗電'

describe('parseNeed（簡報例句）', () => {
  const form = parseNeed(EXAMPLE)

  it('抓出空壓機 3 台、10 年以上', () => {
    const ac = form.items.find((i) => i.equip === 'air_compressor')
    expect(ac).toBeTruthy()
    expect(ac?.quantity).toBe(3)
    expect(ac?.ageYears).toBe(10)
    expect(ac?.ageText).toMatch(/10/)
  })

  it('抓出空調', () => {
    expect(form.items.map((i) => i.equip)).toEqual(['air_compressor', 'hvac'])
  })

  it('主要問題包含電費上升', () => {
    expect(form.mainProblems).toContain('電費上升')
  })

  it('空調數量未提，會列為待確認問題', () => {
    expect(form.openQuestions.some((q) => q.includes('空調'))).toBe(true)
  })

  it('空白文字不丟錯，且提示要補充', () => {
    const empty = parseNeed('')
    expect(empty.items).toEqual([])
    expect(empty.openQuestions.length).toBeGreaterThan(0)
  })
})
