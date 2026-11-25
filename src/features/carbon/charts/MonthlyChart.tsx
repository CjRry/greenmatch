import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatKwh, formatNumber } from '../../../core/format'
import type { MonthEmission } from '../../../core/domain/carbon'

export type ChartMetric = 'emission' | 'kwh'

const tick = { fill: 'var(--gm-muted)', fontSize: 12 }

/** Monthly stacked emissions (scope 1 / 2) or monthly kWh. Colors come from chart tokens. */
export default function MonthlyChart({ months, metric }: { months: readonly MonthEmission[]; metric: ChartMetric }) {
  const data = months.map((m) => ({
    name: `${m.m}月`,
    scope1: Number(m.scope1T.toFixed(2)),
    scope2: Number(m.scope2T.toFixed(2)),
    kwh: m.kwh ?? 0,
  }))
  return (
    <div className="h-64 w-full min-w-0" role="img" aria-label={metric === 'kwh' ? '每月用電度數長條圖' : '每月排放量堆疊長條圖'}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--gm-chart-grid)" vertical={false} />
          <XAxis dataKey="name" tick={tick} tickLine={false} axisLine={{ stroke: 'var(--gm-chart-grid)' }} interval={0} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => formatNumber(v)} />
          <Tooltip
            cursor={{ fill: 'var(--gm-sunken)' }}
            contentStyle={{ background: 'var(--gm-surface)', border: '1px solid var(--gm-line)', borderRadius: 4, color: 'var(--gm-ink)' }}
            labelStyle={{ color: 'var(--gm-ink)' }}
            formatter={(v) => (metric === 'kwh' ? formatKwh(Number(v)) : `${formatNumber(Number(v), 1)} tCO2e`)}
          />
          {metric === 'kwh' ? (
            <Bar isAnimationActive={false} dataKey="kwh" name="用電度數" fill="var(--gm-chart-2)" radius={[2, 2, 0, 0]} />
          ) : (
            <>
              <Legend wrapperStyle={{ color: 'var(--gm-ink-soft)', fontSize: 12 }} />
              <Bar isAnimationActive={false} dataKey="scope1" name="範疇一" stackId="e" fill="var(--gm-chart-1)" />
              <Bar isAnimationActive={false} dataKey="scope2" name="範疇二" stackId="e" fill="var(--gm-chart-2)" radius={[2, 2, 0, 0]} />
            </>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
