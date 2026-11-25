import { EQUIP_INFO } from '../core/constants/equipment'
import { summarizeBacktest } from '../core/domain/publicCaseBacktest'
import { formatNumber } from '../core/format'
import { paths } from '../core/paths'
import type { PublicCase } from '../core/types'
import { PUBLIC_CASES, PUBLIC_CASES_CHECKED_DATE } from '../data/publicCases'
import { Card, PageHeader, PUBLIC_CASE_DISCLAIMER, PublicCaseBacktestTable, PublicCaseBadge, PublicCaseStats, SectionTitle } from '../ui'

/**
 * 公開案例與回本回測 (`/public-cases`, PROP-0006). Static, sourced data only — nothing from the
 * store, so it reads the same signed in or out and never mixes with `isDemo` records.
 * `cases` is a prop only so tests can render the empty state.
 */
export default function PublicCases({ cases = PUBLIC_CASES }: { cases?: readonly PublicCase[] }) {
  const summary = summarizeBacktest(cases)
  const equips = [...new Set(cases.map((c) => EQUIP_INFO[c.equip].label))]
  const industries = [...new Set(cases.map((c) => c.industry))]
  const price = summary.impliedPriceRange
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<PublicCaseBadge />}
        title="公開節能案例與回本回測"
        breadcrumbs={[{ label: '首頁', to: paths.home() }, { label: '公開案例' }]}
        description={`${PUBLIC_CASE_DISCLAIMER} 本回測只驗證「節電量 → 電費 → 回本」的換算，未驗證節電量預測。`}
      />

      <Card className="border-brand/40 bg-brand-soft" aria-label="回測驗證範圍聲明">
        <p className="font-display text-sm font-bold text-brand-strong">
          驗證範圍聲明：本回測只驗證「節電量 → 電費 → 回本」的換算，未驗證節電量預測
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          這份回測把公開案例已公布的「年節電度數」直接放進平台回本算式，檢查電費單價與回收年數的換算有沒有算錯；平台沒有從改善前設備直接預測「能省多少 %」的模型，工廠實際能省多少電與風量／壓力變化仍需場勘掛表實測一週才知道。
        </p>
      </Card>

      <section className="flex flex-col gap-3" aria-label="回測結果">
        <SectionTitle
          title="換算準度驗證（節電量 → 電費 → 回本）"
          hint={`把公開案例公布的投資金額與年節電量代入平台回本算式，與來源公布的回收年限比對（未驗證節電量預測）。${PUBLIC_CASES_CHECKED_DATE} 逐筆核對來源。`}
        />
        <PublicCaseStats cases={cases} summary={summary} />
      </section>

      <section className="flex flex-col gap-3" aria-label="逐筆回測">
        <SectionTitle title="逐筆數字與出處" hint="表格可左右捲動。來源沒寫的欄位標「來源未揭露」，平台不替它補數字。" />
        <PublicCaseBacktestTable cases={cases} summary={summary} />
      </section>

      {cases.length ? (
        <section className="grid gap-4 md:grid-cols-2" aria-label="怎麼算與誤差原因">
          <Card className="flex flex-col gap-2">
            <h2 className="font-display text-base font-bold text-ink">怎麼算</h2>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-soft">
              <li>用的是報價比價頁同一段回本程式，不是另寫一份。</li>
              <li>輸入：案例的投資金額與年節電度數；電價與運轉時數用工廠還沒填電費時的平台預設值（每度 {formatNumber(summary.platformRateNtd, 1)} 元、每天 16 小時、每年 300 天）。</li>
              <li>來源的回收年限＝投資÷年省電費，沒有扣補助，所以跟平台「扣補助前」的回本比。來源都沒寫補助金額。</li>
              <li>誤差＝平台試算−來源回本。負的代表平台算得比實際快回本。</li>
            </ul>
          </Card>
          <Card className="flex flex-col gap-2">
            <h2 className="font-display text-base font-bold text-ink">誤差從哪裡來</h2>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-soft">
              {price ? (
                <li>
                  案例的省電費÷節電度數，換算每度 {price.min.toFixed(2)}–{price.max.toFixed(2)} 元，都低於平台預設的 {formatNumber(summary.platformRateNtd, 1)} 元，所以平台全面偏樂觀。工廠在「工廠數據」填入自己的平均電價後，這部分誤差就會消失。
                </li>
              ) : null}
              <li>回本期很短時，電價差和 0.1 年的四捨五入在百分比上會被放大：回本 0.3 年的案例差 0.1 年就是 33%。</li>
              <li>
                這次只驗證「節電量→電費→回本」的換算。節電量本身取自案例（相當於廠商報價），平台目前沒有從改善前條件預測節電量的模型，這部分沒有被檢驗。
              </li>
              <li>
                案例只涵蓋 {equips.join('、')}，產業只有 {industries.join('、')}，數量也只有 {cases.length} 筆，而且多筆的案例編號前段相同、可能來自同一得獎單位，結論不能直接推到所有工廠。
              </li>
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  )
}
