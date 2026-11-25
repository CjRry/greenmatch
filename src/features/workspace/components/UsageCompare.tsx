import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatKwh, formatNumber, formatPct, monthLabel } from '../../../core/format'
import type { UsagePoint } from '../../../core/types'
import { ScrollX, Stat } from '../../../ui'
import type { UsageSaving } from '../lib/transitions'

/** Before/after monthly electricity bars with the saving figures beside them. */
export function UsageCompare({ usage, saving }: { usage: readonly UsagePoint[]; saving: UsageSaving | null }) {
  const data = [...usage]
    .sort((a, b) => (a.month === b.month ? (a.phase < b.phase ? -1 : 1) : a.month < b.month ? -1 : 1))
    .map((u) => ({
      name: u.month.slice(2),
      kwh: u.kwh,
      phase: u.phase,
      label: `${monthLabel(u.month)}${u.phase === 'after' ? '（改善後）' : '（改善前）'}`,
    }))
  return (
    <div className="flex flex-col gap-4">
      {saving ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="改善前平均" value={formatNumber(saving.beforeKwh)} unit="度／月" />
          <Stat label="改善後平均" value={formatNumber(saving.afterKwh)} unit="度／月" tone="navy" />
          <Stat label="節電" value={formatPct(saving.savedPct, 1)} note={`每月少用 ${formatKwh(saving.savedKwh)}`} tone="brand" />
          <Stat label="估計每月減碳" value={formatNumber(saving.savedKgCo2e)} unit="kgCO2e" tone="brand" />
        </div>
      ) : (
        <p className="text-sm text-muted">改善前、改善後各登錄至少一個月，才能算出節電百分比與減碳量。</p>
      )}
      {data.length ? (
        <ScrollX>
          <div role="img" aria-label="改善前後每月用電長條圖" className="h-56 min-w-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--gm-line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--gm-muted)', fontSize: 12 }} />
                <YAxis width={56} tick={{ fill: 'var(--gm-muted)', fontSize: 12 }} />
                <Tooltip formatter={(v) => [formatKwh(Number(v)), '用電']} labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ''} />
                <Bar isAnimationActive={false} dataKey="kwh" radius={[2, 2, 0, 0]}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.phase === 'after' ? 'var(--gm-chart-1)' : 'var(--gm-chart-2)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ScrollX>
      ) : null}
      <p className="text-sm text-muted">
        <span className="mr-1 inline-block size-2.5 rounded-sm align-middle" style={{ background: 'var(--gm-chart-2)' }} />
        改善前
        <span className="mr-1 ml-3 inline-block size-2.5 rounded-sm align-middle" style={{ background: 'var(--gm-chart-1)' }} />
        改善後
      </p>
    </div>
  )
}
