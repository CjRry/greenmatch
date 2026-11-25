import { describe, expect, it } from 'vitest'
import { buildSurveyInquiryMessage } from './vendorInquiry'

describe('buildSurveyInquiryMessage', () => {
  it('帶入設備、運轉時數、每月電費與補助詢問項目，產生完整可貼上的詢價訊息', () => {
    const msg = buildSurveyInquiryMessage({
      vendorName: '復盛股份有限公司',
      factoryName: '大成塑膠廠',
      city: '台南市',
      industry: '塑膠射出',
      equipmentSummary: '空壓機 2 台 37 kW（使用 12 年）',
      dailyHours: 16,
      monthlyElectricBillNtd: 270_000,
      contractKw: 300,
      subsidyInterest: '動力設備一級能效補助（預估 NT$ 12–43 萬）',
    })
    expect(msg).toContain('復盛股份有限公司')
    expect(msg).toContain('大成塑膠廠（台南市｜塑膠射出）')
    expect(msg).toContain('空壓機 2 台 37 kW')
    expect(msg).toContain('每日約 16 小時')
    expect(msg).toContain('NT$ 270,000／月')
    expect(msg).toContain('約 300 kW')
    expect(msg).toContain('動力設備一級能效補助')
    expect(msg).toContain('掛表實測一週')
    expect(msg).toContain('量測驗證（M&V）')
  })

  it('空白工廠缺少參數時也完整不噴錯，以待確認補齊', () => {
    const msg = buildSurveyInquiryMessage({ vendorName: '東正鐵工廠股份有限公司' })
    expect(msg).toContain('東正鐵工廠股份有限公司')
    expect(msg).toContain('我們是〔請填公司名稱〕')
    expect(msg).toContain('待現場確認')
    expect(msg).toContain('待整理 12 個月電費單提供')
  })
})
