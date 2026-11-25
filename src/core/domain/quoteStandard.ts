/**
 * Deterministic extractor and risk-alert evaluator for PROP-0007 4c simplified standard quotes.
 * Covers all 9 standard fields:
 * 1) 機型 (equipmentModel)
 * 2) kW (ratedKw)
 * 3) 效率等級 (efficiencyGrade)
 * 4) 是否登錄補助產品 (subsidyRegistered)
 * 5) 預估節電與依據（實測或假設）(monthlySaveKwh / savePct + savingsBasis)
 * 6) 保固 (warrantyYears)
 * 7) 價格 (equipmentNtd)
 * 8) 安裝 (installNtd)
 * 9) 量測驗證方式 (mvMethod)
 */
import type { QuoteFields } from '../types'

export interface QuoteRiskAlert {
  id: string
  tone: 'danger' | 'warn'
  message: string
}

function parseMoneySeg(seg: string): number | null {
  const nt = seg.match(/(?:NT\$|NTD|新台幣|\$)\s*([\d,]+(?:\.\d+)?)\s*(萬)?/i)
  if (nt) return Math.round(Number(nt[1].replace(/,/g, '')) * (nt[2] ? 10_000 : 1))
  const wan = seg.match(/([\d,]+(?:\.\d+)?)\s*萬(?:\s*(\d+(?:\.\d+)?)\s*千)?/)
  if (wan) return Math.round(Number(wan[1].replace(/,/g, '')) * 10_000 + (wan[2] ? Number(wan[2]) * 1_000 : 0))
  const qian = seg.match(/([\d,]+(?:\.\d+)?)\s*千\s*元?/)
  if (qian) return Math.round(Number(qian[1].replace(/,/g, '')) * 1_000)
  const yuan = seg.match(/(?<![\d.])([\d,]+)\s*元/)
  if (yuan) return Number(yuan[1].replace(/,/g, ''))
  return null
}

/** Extracts all base + 4c standard quote fields from pasted free-form quote text. */
export function extractStandardQuoteFields(raw: string): Partial<QuoteFields> {
  const SKIP = /省|節|回本|回收|電價|電費|每度|保固|有效|效益|估算|折舊|補助|稅率|訂金|頭期|尾款|付款/
  const INSTALL_WORD = /安裝|施工|工資|工程費|配管|配電|試運轉|人工|工費|調整/
  const TOTAL_WORD = /合計|總計|總價|小計|共計/

  let equipSum: number | null = null
  let installSum: number | null = null
  let totalAmt: number | null = null

  // Do not split inside comma-separated thousands (e.g. 210,000 or 2,251,000).
  for (const seg of raw.split(/[\n，；;。]|,(?!\d{3}(?!\d))/)) {
    const amount = parseMoneySeg(seg)
    if (amount == null) continue
    const explicitEquipLine =
      /^\s*(?:[\d.)、]*\s*)?(?:設備|主機|機器|機台|硬體)(?:費|費用|價|價格)?(?:\s*[：:]|$)/.test(seg)
    const explicitInstallLine =
      /^\s*(?:[\d.)、]*\s*)?(?:安裝|施工|工資|工程費|配管|配電|吊裝|試運轉|試車)(?:費|費用|工資|工程)?(?:\s*[：:]|$)/.test(seg)
    if (TOTAL_WORD.test(seg) && !explicitEquipLine && !explicitInstallLine) {
      totalAmt ??= amount
      continue
    }
    if (SKIP.test(seg)) continue
    let val = amount
    const each = /每\s*(?:台|部|組|座|套)/.test(seg) ? seg.match(/(\d+(?:\.\d+)?)\s*[台部組座套]/) : null
    if (each) {
      const cnt = Number(each[1])
      if (Number.isFinite(cnt) && cnt > 0 && !/\d+\s*[台部組座套]\s*[\d,]*\s*kW/i.test(seg)) val = amount * cnt
    }
    const bundledWithEquip = /含\s*(?:安裝|施工|配管)/.test(seg) && !explicitInstallLine
    if (INSTALL_WORD.test(seg) && !bundledWithEquip) installSum = (installSum ?? 0) + val
    else equipSum = (equipSum ?? 0) + val
  }

  let equipmentNtd = equipSum
  let installNtd = installSum
  if (totalAmt != null && equipmentNtd == null && installNtd == null) equipmentNtd = totalAmt
  else if (totalAmt != null && installNtd != null && equipmentNtd != null && equipmentNtd + installNtd !== totalAmt) {
    equipmentNtd = Math.max(0, totalAmt - installNtd)
  } else if (totalAmt != null && installNtd != null && equipmentNtd == null && totalAmt > installNtd) {
    equipmentNtd = totalAmt - installNtd
  } else if (totalAmt != null && equipmentNtd != null && installNtd == null && totalAmt > equipmentNtd) {
    installNtd = totalAmt - equipmentNtd
  }

  const wMatch = raw.match(/保固[^\n\d]{0,10}?(\d+(?:\.\d+)?)\s*年/) ?? raw.match(/(\d+(?:\.\d+)?)\s*年(?:原廠)?保固/)
  const kwhMatch = raw.match(/每\s*月[^\n\d]{0,10}?([\d,]+)\s*(?:度|kWh)/i)
  const pctMatch = raw.match(/(?:節電率?|省電率?|節能率?|省|節電)[^\n\d]{0,8}?(?:\d+\s*[~～-]\s*)?(\d+(?:\.\d+)?)\s*%/)
  const pbMatch =
    raw.match(/(\d+(?:\.\d+)?)\s*個?月\s*(?:內)?(?:即可)?回本/) ??
    raw.match(/(?:回本|回收)(?:期|時間)?[^\n\d]{0,8}?(\d+(?:\.\d+)?)\s*個?月/)
  const pbYear = !pbMatch
    ? raw.match(/(\d+(?:\.\d+)?)\s*年\s*(?:內)?(?:即可)?回本/) ?? raw.match(/(?:回本|回收)(?:期|時間)?[^\n\d]{0,8}?(\d+(?:\.\d+)?)\s*年/)
    : null
  const baseMatch = raw.match(/(?:比較基準|基準期間|基準)[^\n：:]*[：:]\s*([^\n。]+)/)

  // PROP-0007 4c extended fields
  const modelMatch =
    raw.match(/(?:機型|型號|機種)[：:\s]*([^\n，,；;]+)/) ??
    raw.match(/([A-Z]{2,}[A-Z0-9-]*\d[A-Z0-9-]*)/)
  const kwMatch = raw.match(/(\d+(?:\.\d+)?)\s*kW\b/i)
  const hpMatch = !kwMatch ? raw.match(/(\d+(?:\.\d+)?)\s*(?:hp|馬力)\b/i) : null
  const ratedKw = kwMatch
    ? Number(kwMatch[1])
    : hpMatch
      ? Math.round(Number(hpMatch[1]) * 0.746 * 10) / 10
      : null

  const effMatch =
    raw.match(/(?:效率等級|能效等級|能效)[：:\s]*([^\n，,；;]+)/) ??
    raw.match(/(IE[1-5]|一級能效|二級能效|1\s*級能效|永磁變頻一級)/i)

  let subsidyRegistered: boolean | null = null
  const uncertainSubsidy = /(?:不確定|待確認|未確認|尚待確認)\s*(?:是否)?\s*登錄/.test(raw)
  if (!uncertainSubsidy && (/(?:尚未|未)\s*登錄[^\n。]*補助/.test(raw) || /無補助登錄/.test(raw))) {
    subsidyRegistered = false
  } else if (!uncertainSubsidy && (/(?:已|完成|符合)\s*登錄[^\n。]*(?:補助|mdss)/.test(raw) || /登錄補助產品[：:\s]*是/.test(raw))) {
    subsidyRegistered = true
  }

  let savingsBasis: 'metered' | 'assumed' | null = null
  if (/(?:無|沒有|未)\s*(?:實測|掛表|量測)/.test(raw) || /(?:假設|推估|經驗估算|口頭預估|預估依據[：:\s]*假設)/.test(raw)) {
    savingsBasis = 'assumed'
  } else if (/(?:實測|掛表量測|一週實測|現場量測|預估依據[：:\s]*實測)/.test(raw)) {
    savingsBasis = 'metered'
  }

  const mvLine = raw.match(/(?:量測驗證(?:方式)?|M\s*&\s*V|驗收方式)[：:\s]*([^\n。]+)/i)

  return {
    ...(equipmentNtd != null ? { equipmentNtd } : {}),
    ...(installNtd != null ? { installNtd } : {}),
    ...(wMatch ? { warrantyYears: Number(wMatch[1]) } : {}),
    ...(kwhMatch ? { monthlySaveKwh: Number(kwhMatch[1].replace(/,/g, '')) } : {}),
    ...(pctMatch ? { savePct: Number(pctMatch[1]) } : {}),
    ...(pbMatch ? { paybackMonths: Math.round(Number(pbMatch[1])) } : pbYear ? { paybackMonths: Math.round(Number(pbYear[1]) * 12) } : {}),
    ...(baseMatch ? { baseline: baseMatch[1].trim() } : {}),
    ...(modelMatch ? { equipmentModel: modelMatch[1].trim() } : {}),
    ...(ratedKw != null && Number.isFinite(ratedKw) ? { ratedKw } : {}),
    ...(effMatch ? { efficiencyGrade: effMatch[1].trim() } : {}),
    ...(subsidyRegistered !== null ? { subsidyRegistered } : {}),
    ...(savingsBasis !== null ? { savingsBasis } : {}),
    ...(mvLine ? { mvMethod: mvLine[1].trim() } : {}),
  }
}

/**
 * Generates PROP-0007 4c comparison risk alerts for a parsed or declared quote.
 */
export function evaluateQuoteAlerts(
  fields: Partial<QuoteFields>,
  opts: { hasAirCompressor?: boolean } = {},
): QuoteRiskAlert[] {
  const alerts: QuoteRiskAlert[] = []
  const hasAir = opts.hasAirCompressor ?? true

  if (fields.savePct != null && fields.savingsBasis !== 'metered') {
    const tone = fields.savePct >= 30 ? 'danger' : 'warn'
    const basisNote =
      fields.savingsBasis === 'assumed'
        ? hasAir
          ? '但沒有實測風量（目前僅為假設或估算）'
          : '但缺乏掛表實測依據（僅為假設或估算）'
        : hasAir
          ? '但沒有實測風量或載明實測依據'
          : '但未說明是實測還是假設'
    alerts.push({
      id: 'pct-without-metering',
      tone,
      message: `宣稱省 ${fields.savePct}%，${basisNote}`,
    })
  } else if (fields.monthlySaveKwh != null && fields.savingsBasis == null) {
    alerts.push({
      id: 'kwh-basis-missing',
      tone: 'warn',
      message: '有寫預估省電度數，但未說明依據是「實測」還是「假設」',
    })
  }

  if (fields.subsidyRegistered !== true) {
    alerts.push({
      id: 'subsidy-unconfirmed',
      tone: fields.subsidyRegistered === false ? 'danger' : 'warn',
      message:
        fields.subsidyRegistered === false
          ? '機型尚未登錄補助產品系統（mdss.org.tw），可能無法申請政府每 kW 補助'
          : '機型未確認是否登錄補助產品系統，下訂前請先至 mdss.org.tw 核對型號',
    })
  }

  if (!fields.mvMethod?.trim()) {
    alerts.push({
      id: 'mv-missing',
      tone: 'warn',
      message: '未載明完工後量測驗證（M&V）方式（建議載明完工前後掛表實測條件）',
    })
  }

  if (fields.warrantyYears == null) {
    alerts.push({
      id: 'warranty-missing',
      tone: 'warn',
      message: '未載明保固年限',
    })
  }

  return alerts
}
