import { Award, Calculator, CheckCircle2, Database, ExternalLink, Lock, ShieldCheck, XCircle } from 'lucide-react'
import { DEFAULT_WEIGHTS, FACTOR_KEYS, FACTOR_LABEL } from '../core/domain/matching'
import { summarizeBacktest } from '../core/domain/publicCaseBacktest'
import { formatNumber } from '../core/format'
import { paths } from '../core/paths'
import { SUBSIDIES, SUBSIDY_CHECKED_DATE, SUBSIDY_DISCLAIMER } from '../core/subsidies'
import { PUBLIC_CASES } from '../data/publicCases'
import { PUBLIC_VENDORS, PUBLIC_VENDORS_CHECKED_DATE } from '../data/publicVendors'
import {
  BILL_INDUSTRY_DISCOUNT_CAVEAT,
  INDUSTRY_EMISSION_FACTOR,
  OVER_CONTRACT_RULES,
  POWER_FACTOR_RULES,
  TARIFF_CHECKED_DATE,
  TARIFF_SOURCES,
} from '../data/taipowerTariffs'
import { Badge, ButtonLink, Card, PageHeader, SectionTitle } from '../ui'

const DOES_LIST = [
  '免費電費單健檢：依台電公告電價與營業規則，算清契約容量、功率因數、分時電價與用電排碳量。',
  '空壓機與公開案例實績對照：呈現 10 筆經濟部能源署節能標竿公開案例的實績與換算誤差，不對未知設備硬猜省電比例。',
  '整理公開廠商資料與詢價工具包：協助你把電費與設備現況整理成標準場勘詢價單，並列出 9 個報價必核對欄位與常見風險。',
  '補助資格初篩：依設備功率 kW 與官方最新公告門檻試算補助上限與產創 10-1 抵稅空間。',
]

const DOES_NOT_LIST = [
  '不收工廠使用費、不向廠商收費或抽成、不賣廣告版位。',
  '不做付費排名：廠商排序完全依規則（設備專長符合度、距離、實績、評價與規模適配）。',
  '不代為聯絡或偷寄信：我們不會幫你把工廠資料或電話傳給任何廠商；找哪家廠商完全由你自己依公開電話／官網接洽。',
  '不假裝預測節電量：在沒有進廠掛表實測一週與檢視 12 個月電費單前，不喊「保證省 X%」。',
  '不媒合碳盤查顧問：碳盤查由工廠在碳盤查頁用表單自行填報，平台只負責計算與整理。',
]

export function AboutPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Badge tone="brand">關於我們・資料與隱私</Badge>}
        title="關於綠媒 GreenMatch：我們是誰、做什麼與資料如何保護"
        breadcrumbs={[{ label: '首頁', to: paths.home() }, { label: '關於我們與隱私' }]}
        description="中小製造廠在找節能改善方案時，最容易卡在「不知電費單哪裡在多繳錢」、「看不懂廠商報價差異」、「怕聯絡平台後資料被轉售」。這個工具把能先靠公開規則算清的事，做成免登入即可驗證的節能工具。"
      />

      <section className="grid gap-4 md:grid-cols-2" aria-label="團隊身分與參賽作品說明">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Award className="size-5 text-brand-strong" aria-hidden />
            <h2 className="font-display text-lg font-bold text-ink">團隊身分與開發背景</h2>
          </div>
          <p className="text-sm leading-relaxed text-ink-soft">
            綠媒 GreenMatch 由<strong className="text-ink">國立成功大學研究與工程團隊</strong>開發，為{' '}
            <strong className="text-ink">2026 全國 AI 專題創意競賽參賽作品</strong>。依成員隱私與公開規範，現階段以國立成功大學 GreenMatch 團隊名義公開展示與測試，不額外揭露個人真實姓名或私人聯繫方式。
          </p>
          <p className="text-xs text-muted">
            本平台為節能診斷與資訊整理工具，非政府機關官方網站；所有電價、補助與排碳數據皆附上經濟部能源署及台電官方出處連結，方便工廠與會計、廠商覆核。
          </p>
        </Card>

        <Card id="privacy" className="flex flex-col gap-3 border-brand/40 bg-brand-soft/30">
          <div className="flex items-center gap-2">
            <Lock className="size-5 text-brand-strong" aria-hidden />
            <h2 className="font-display text-lg font-bold text-ink">資料保存與隱私承諾</h2>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-ink-soft">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
              <span>
                <strong className="text-ink">資料只存在你的瀏覽器</strong>：你在電費單健檢、工廠數據與報價比較填入的數字，只儲存在你目前使用的瀏覽器本機儲存空間。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
              <span>
                <strong className="text-ink">廠商看不到你，除非你自己聯絡他</strong>：平台不會將你的電費金額、聯絡方式或設備現況主動推播或寄送給任何節能廠商。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
              <span>
                <strong className="text-ink">不採集未授權個資</strong>：公開廠商名單僅整理經濟部能源署及 ESCO 公會已公開的公司官網與公司總機／營業所電話，不含任何個人手機或私人信箱。
              </span>
            </li>
          </ul>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-label="平台定位與承諾">
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-ink">這個平台做什麼</h2>
          <ul className="flex flex-col gap-2.5 text-sm text-ink-soft">
            {DOES_LIST.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-strong" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-ink">這個平台絕對不做什麼</h2>
          <ul className="flex flex-col gap-2.5 text-sm text-ink-soft">
            {DOES_NOT_LIST.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <XCircle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-label="推薦排序邏輯說明" className="flex flex-col gap-3">
        <SectionTitle
          title="廠商推薦怎麼排序？"
          hint="公開名單不排序、不顯示星等；僅在使用者進入流程或使用平台媒合模擬時，依下列公開權重計分（總計 100%）"
        />
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">
            我們反對黑箱推薦或「誰付錢就排第一」。媒合排序依五項可解釋因子加權計算，且有合作過貴廠同產業的廠商可一鍵獨立篩選：
          </p>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FACTOR_KEYS.map((k) => (
              <div key={k} className="rounded-sm border border-line bg-sunken px-3 py-2.5">
                <dt className="text-xs font-medium text-muted">{FACTOR_LABEL[k]}</dt>
                <dd className="tabular mt-1 font-mono text-lg font-bold text-ink">{Math.round(DEFAULT_WEIGHTS[k] * 100)}%</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted">
            備註：公開廠商名錄頁的「真實廠商公開名單（目前 {PUBLIC_VENDORS.length} 家）」僅依設備專長、服務地區與關鍵字篩選，刻意不加評分星等與商業排名。
          </p>
        </Card>
      </section>

      <div className="flex flex-wrap gap-3">
        <ButtonLink to={paths.methodology()}>看所有計算公式與官方出處 →</ButtonLink>
        <ButtonLink to={paths.billCheckup()} variant="secondary">
          做免費電費單健檢
        </ButtonLink>
        <ButtonLink to={paths.vendors()} variant="secondary">
          開啟找廠商工具包
        </ButtonLink>
      </div>
    </div>
  )
}

export function MethodologyPage() {
  const summary = summarizeBacktest(PUBLIC_CASES)
  const emissionSource = TARIFF_SOURCES.find((s) => s.id === INDUSTRY_EMISSION_FACTOR.sourceId) ?? TARIFF_SOURCES[0]
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Badge tone="navy">方法與官方出處</Badge>}
        title="計算公式、政府法源依據與誤差驗證"
        breadcrumbs={[{ label: '首頁', to: paths.home() }, { label: '方法與出處' }]}
        description="綠媒把所有試算公式、公告版本、有效日期與回測誤差攤在陽光下，確保報告裡的每個數字都能追溯來源。"
      />

      {/* 1. 摘要看板 */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="方法與來源摘要">
        <Card>
          <p className="text-xs text-muted">台電電價與營業規則核對日</p>
          <p className="tabular mt-1 font-mono text-xl font-bold text-ink">{TARIFF_CHECKED_DATE}</p>
          <p className="mt-1 text-xs text-muted">採用 114/10 公告電價表</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">電力排碳係數（114 年度）</p>
          <p className="tabular mt-1 font-mono text-xl font-bold text-ink">
            {INDUSTRY_EMISSION_FACTOR.kgPerKwh} <span className="text-xs font-normal text-muted">kgCO₂e/度</span>
          </p>
          <p className="mt-1 text-xs text-muted">{emissionSource?.agency ?? '經濟部能源署'}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">公開案例電費／回本換算 MAE</p>
          <p className="tabular mt-1 font-mono text-xl font-bold text-brand-strong">
            {summary.maeYears != null ? `${formatNumber(summary.maeYears, 2)} 年` : '—'}
          </p>
          <p className="mt-1 text-xs text-muted">只驗證「已知節電量→電費→回本」換算</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">真實公開廠商與補助核對日</p>
          <p className="tabular mt-1 font-mono text-xl font-bold text-ink">{PUBLIC_VENDORS_CHECKED_DATE}</p>
          <p className="mt-1 text-xs text-muted">補助規則核對日 {SUBSIDY_CHECKED_DATE}</p>
        </Card>
      </section>

      {/* 2. 核心公式說明 */}
      <section id="formulas" className="flex flex-col gap-3" aria-label="核心計算規則">
        <SectionTitle title="1. 電費單健檢與碳排公式" hint="以下規則均為可單位測試之純函式運算，不靠 AI 猜數字" />
        <div className="grid gap-4 md:grid-cols-2">
          <Card id="contract" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-ink">契約容量與超約附加費</h3>
              <Badge tone="warn">營業規則待原文 PDF 逐條複核</Badge>
            </div>
            <p className="text-sm text-ink-soft">
              超約 {OVER_CONTRACT_RULES.within10PctThreshold * 100}% 以內部分按當月基本電費單價 ×{' '}
              {OVER_CONTRACT_RULES.within10PctMultiplier} 倍計收；超過 10% 以上部分按 ×{' '}
              {OVER_CONTRACT_RULES.over10PctMultiplier} 倍計收。填寫達 <strong className="text-ink">3 期以上</strong>{' '}
              需量紀錄後，平台才對候選契約 kW 計算年度「基本費＋超約費」最佳建議；少於 3 期僅顯示當期超約與需量現況。
            </p>
          </Card>

          <Card id="pf" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-ink">功率因數（PF）調整費</h3>
              <Badge tone="warn">營業規則待原文 PDF 複核</Badge>
            </div>
            <p className="text-sm text-ink-soft">
              以 {POWER_FACTOR_RULES.baselinePct}% 為基準：低於 80% 每少 1% 加收{' '}
              {POWER_FACTOR_RULES.stepRatePct}% 電費；高於 80% 至上限 {POWER_FACTOR_RULES.rewardCapPct}% 為止，每超過 1% 減收{' '}
              {POWER_FACTOR_RULES.stepRatePct}%（最高折減 1.5%）。低壓契約未達{' '}
              {POWER_FACTOR_RULES.minDemandContractKw} kW 者免計。
            </p>
          </Card>

          <Card id="carbon" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-brand-strong" aria-hidden />
              <h3 className="font-display text-base font-bold text-ink">範疇二電力排碳計算</h3>
            </div>
            <p className="text-sm text-ink-soft">
              採用{emissionSource?.agency ?? '經濟部能源署'}公告「{emissionSource?.title ?? '114 年度電力排碳係數'}」：年用電度數 ×{' '}
              <span className="tabular font-mono font-semibold text-ink">{INDUSTRY_EMISSION_FACTOR.kgPerKwh}</span> kgCO₂e／度 ÷ 1,000 ＝ 公噸 CO₂e（tCO₂e）。單期試算以 × 12 年化，並標示僅為估算。
            </p>
            <a
              href={emissionSource?.url ?? TARIFF_SOURCES[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline"
            >
              <span>開啟能源署公告來源</span>
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </Card>

          <Card id="backtest" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-brand-strong" aria-hidden />
              <h3 className="font-display text-base font-bold text-ink">公開案例回測與已知限制</h3>
            </div>
            <p className="text-sm text-ink-soft">
              以能源署節能標竿案例 {summary.comparedCount} 筆驗證：當已知改善節電度數時，平台「節電量 → 電費 → 回本」換算平均絕對誤差（MAE）為{' '}
              <strong className="text-ink">
                {summary.maeYears != null ? `${formatNumber(summary.maeYears, 2)} 年` : '—'}
              </strong>。
              <strong className="text-ink">已知缺口</strong>：目前無從設備規格直接預測節電量的模型，空壓機區間僅顯示公開案例實績範圍。
            </p>
            <div>
              <ButtonLink to={paths.publicCases()} size="sm" variant="secondary">
                查看 10 筆公開案例與完整回測表 →
              </ButtonLink>
            </div>
          </Card>
        </div>
        <p className="text-xs text-muted">{BILL_INDUSTRY_DISCOUNT_CAVEAT}</p>
      </section>

      {/* 3. 台電與能源署官方出處清單 */}
      <section id="tariff-sources" className="flex flex-col gap-3" aria-label="台電與能源署公式來源清單">
        <SectionTitle title="2. 台電電價與法源依據清單" hint="以下網址均可直接開啟核對原文" />
        <ul className="grid gap-3 md:grid-cols-2">
          {TARIFF_SOURCES.map((src) => (
            <li key={src.id}>
              <Card className="flex h-full flex-col justify-between gap-2 text-xs">
                <div>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-bold text-brand-strong hover:underline"
                  >
                    <span>{src.title}</span>
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  </a>
                  <p className="mt-1.5 text-ink-soft">{src.note}</p>
                </div>
                <p className="text-muted">
                  發布單位：{src.agency}・生效：{src.effectiveDate}・核對：{src.checkedDate}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. 政府補助項目與資料來源 */}
      <section id="subsidy" className="flex flex-col gap-3" aria-label="政府補助依據與可靠度分級">
        <SectionTitle
          title="3. 政府節能補助與稅務抵減來源"
          hint={`${SUBSIDY_DISCLAIMER}；核對日期 ${SUBSIDY_CHECKED_DATE}，明確區分官方條文與經銷商轉述參考區間`}
        />
        <ul className="grid gap-3 md:grid-cols-2">
          {SUBSIDIES.map((sub) => (
            <li key={sub.id}>
              <Card className="flex h-full flex-col justify-between gap-2 text-xs">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink">{sub.name}</span>
                    <Badge tone={sub.reliability === 'official' ? 'brand' : 'warn'}>
                      {sub.reliability === 'official'
                        ? '官方條文核對'
                        : sub.id === 'tax-credit' || sub.id === 'moenv-grant' || sub.id === 'moenv-loan'
                          ? '依新聞報導整理'
                          : '經銷商參考區間'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-ink-soft">{sub.plainDesc}（{sub.amountRule}）</p>
                  {sub.reliabilityNote ? <p className="mt-1 text-muted">{sub.reliabilityNote}</p> : null}
                </div>
                <a
                  href={sub.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-brand-strong hover:underline"
                >
                  <span>來源：{sub.agency}</span>
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <ButtonLink to={paths.billCheckup()}>前往電費單健檢（可列印報告）</ButtonLink>
        <ButtonLink to={paths.about()} variant="secondary">
          查看關於我們與資料隱私
        </ButtonLink>
      </div>
    </div>
  )
}
