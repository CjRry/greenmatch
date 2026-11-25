import { describe, expect, it } from 'vitest'
import { evaluateQuoteAlerts, extractStandardQuoteFields } from './quoteStandard'

describe('quoteStandard (PROP-0007 4c)', () => {
  it('能從貼上的文字抽出 9 項標準報價欄位，並準確偵測高宣稱卻未實測與未確認補助的風險', () => {
    const raw = [
      '報價機型：SAV-37V 永磁變頻空壓機 37kW，效率等級 IE4 一級能效',
      '設備費 NT$ 620,000，施工安裝配管 NT$ 65,000，合計 NT$ 685,000',
      '主機保固 3 年。宣稱可省 40%，預估每月省 9,500 度（預估依據：假設，尚未掛表實測）。',
    ].join('\n')

    const f = extractStandardQuoteFields(raw)
    expect(f.equipmentModel).toContain('SAV-37V')
    expect(f.ratedKw).toBe(37)
    expect(f.efficiencyGrade).toContain('IE4')
    expect(f.equipmentNtd).toBe(620_000)
    expect(f.installNtd).toBe(65_000)
    expect(f.warrantyYears).toBe(3)
    expect(f.monthlySaveKwh).toBe(9_500)
    expect(f.savePct).toBe(40)
    expect(f.savingsBasis).toBe('assumed')
    expect(f.subsidyRegistered).toBeUndefined()

    const alerts = evaluateQuoteAlerts(f, { hasAirCompressor: true })
    expect(alerts.some((a) => a.tone === 'danger' && a.message.includes('宣稱省 40%') && a.message.includes('沒有實測風量'))).toBe(true)
    expect(alerts.some((a) => a.message.includes('機型未確認是否登錄補助產品系統'))).toBe(true)
    expect(alerts.some((a) => a.message.includes('量測驗證（M&V）'))).toBe(true)
  })

  it('已實測、已登錄補助、載明 M&V 與保固時不誤報風險提醒', () => {
    const raw = [
      '機型：FS-37PM，37 kW，效率等級：一級能效 IE4',
      '已登錄動力設備補助產品系統（mdss.org.tw）',
      '設備費 58 萬元、施工費 6 萬元、保固 3 年',
      '預估每月省 8,200 度（約省 22%，預估依據：實測一週電流與風量曲線）',
      '量測驗證方式：完工前後各掛表量測一週確認比功率與度數',
    ].join('\n')

    const f = extractStandardQuoteFields(raw)
    expect(f.subsidyRegistered).toBe(true)
    expect(f.savingsBasis).toBe('metered')
    expect(f.mvMethod).toContain('掛表量測')

    const alerts = evaluateQuoteAlerts(f, { hasAirCompressor: true })
    expect(alerts).toEqual([])
  })

  it('OBS-0005 回歸：SAMPLE_RISKY_QUOTE 分離設備費（1,450,000）與安裝費用（180,000（含配管試車））', () => {
    const sample = [
      '報價單',
      '廠商：範例機電工程',
      '機型：ABC-37V 永磁變頻空壓機 37kW（2 台）｜一級能效 IE4',
      '設備費：NT$ 1,450,000（2 台合計，未稅）',
      '安裝費用：NT$ 180,000（含配管試車）',
      '主機保固：3 年',
      '預估效益：節電率可達 45%，預估每月節電約 14,500 度（約 NT$ 66,700／月）',
    ].join('\n')

    const f = extractStandardQuoteFields(sample)
    expect(f.equipmentNtd).toBe(1_450_000)
    expect(f.installNtd).toBe(180_000)
    expect(f.warrantyYears).toBe(3)
    expect(f.savePct).toBe(45)
  })
})
