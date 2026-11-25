/**
 * Generates a copy-paste-ready inquiry message for a factory to contact a real public vendor
 * on its own using public phone/website. Platform never sends emails or submits vendor forms.
 */
export interface SurveyInquiryInput {
  vendorName: string
  factoryName?: string | null
  city?: string | null
  industry?: string | null
  equipmentSummary?: string | null
  dailyHours?: number | null
  monthlyElectricBillNtd?: number | null
  contractKw?: number | null
  subsidyInterest?: string | null
  airFlowNote?: string | null
}

export function buildSurveyInquiryMessage(input: SurveyInquiryInput): string {
  const sender = input.factoryName?.trim() || '〔請填公司名稱〕'
  const loc = [input.city?.trim(), input.industry?.trim()].filter(Boolean).join('｜')
  const equip = input.equipmentSummary?.trim() || '空壓機／動力設備節能改善'
  const hours = input.dailyHours != null && Number.isFinite(input.dailyHours) ? `每日約 ${input.dailyHours} 小時` : '待現場確認'
  const bill =
    input.monthlyElectricBillNtd != null && Number.isFinite(input.monthlyElectricBillNtd)
      ? `約 NT$ ${Math.round(input.monthlyElectricBillNtd).toLocaleString('zh-TW')}／月`
      : '待整理 12 個月電費單提供'
  const contract =
    input.contractKw != null && Number.isFinite(input.contractKw) ? `約 ${input.contractKw} kW` : '待確認電費單契約容量'
  const subsidy = input.subsidyInterest?.trim() || '經濟部能源署動力與公用設備補助（確認擬報價機型是否已登錄補助產品系統）'
  const flowLine = input.airFlowNote?.trim() ? `\n- 目前風量參考：${input.airFlowNote.trim()}` : ''

  return [
    `${input.vendorName} 業務／技術團隊您好：`,
    '',
    `我們是${sender}${loc ? `（${loc}）` : ''}，近期做過電費與節能初步檢視，想預約貴司前來現場勘查與評估改善方案：`,
    `- 欲評估設備／改善項目：${equip}`,
    `- 廠內運轉時數：${hours}`,
    `- 目前電費規模：${bill}（台電契約容量：${contract}）${flowLine}`,
    `- 想了解補助方案：${subsidy}`,
    '',
    '預約場勘時，我們會備妥近 12 個月電費單、設備銘牌照片與實際工作壓力需求；也想事先確認以下三點：',
    '1. 建議更換／改善之機型是否已登錄經濟部能源署「動力與公用設備補助產品系統（mdss.org.tw）」？',
    '2. 報價前是否可協助掛表實測一週風量、壓力與電流曲線，再據實提出節電估計？',
    '3. 報價單能否載明預估節電依據（實測或假設）、保固年限與完工量測驗證（M&V）方式？',
    '',
    '煩請協助安排可場勘之聯繫窗口與時間，謝謝！',
  ].join('\n')
}
