import { useMemo } from 'react'
import { useParams } from 'react-router'
import { SearchX } from 'lucide-react'
import { PRESSURE_LABEL, SCALE_LABEL } from '../../../core/constants/equipment'
import { EQUIP_INFO } from '../../../core/constants/equipment'
import { formatKwh } from '../../../core/format'
import { paths } from '../../../core/paths'
import { useCollection, useDoc } from '../../../core/store/StoreProvider'
import { Badge, ButtonLink, Card, CompanyAvatar, DemoBadge, EmptyState, PageHeader, ScrollX, SectionTitle, SkeletonList } from '../../../ui'
import { NeedCard } from '../components/NeedCard'
import { isFactory, openNeeds } from '../lib/filters'

export default function FactoryProfile() {
  const { id } = useParams()
  const company = useDoc('companies', id)
  const needs = useCollection('needs')
  const mine = useMemo(() => openNeeds((needs ?? []).filter((n) => n.factoryId === id)), [needs, id])

  if (company === undefined || needs === undefined) return <SkeletonList rows={4} />
  if (!isFactory(company)) {
    return (
      <div>
        <PageHeader title="找不到這家工廠" back={{ to: paths.needs(), label: '需求市集' }} />
        <EmptyState
          icon={<SearchX className="size-6" aria-hidden />}
          title="這家工廠不存在或已被移除"
          body="可能是連結有誤。回到需求市集，從開放中的需求進入工廠頁。"
          action={<ButtonLink to={paths.needs()}>回到需求市集</ButtonLink>}
        />
      </div>
    )
  }

  const f = company.factory
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ to: paths.needs(), label: '需求市集' }} title="工廠介紹" />
      <Card className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <CompanyAvatar name={company.name} id={company.id} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-extrabold text-ink">{company.name}</h2>
              {company.isDemo ? <DemoBadge /> : null}
            </div>
            <p className="mt-1 text-sm text-muted">
              {company.city}{company.district ?? ''}・{f.industry}・{SCALE_LABEL[f.scale]}
            </p>
          </div>
        </div>
        {company.intro ? <p className="text-ink-soft">{company.intro}</p> : null}
        <dl className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">主要產品</dt>
            <dd className={f.products ? 'text-ink' : 'text-muted'}>{f.products || '尚未填寫'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">員工人數</dt>
            <dd className="tabular font-mono text-ink">{f.employees} 人</dd>
          </div>
          {f.monthlyKwh ? (
            <div>
              <dt className="text-sm text-muted">平均每月用電</dt>
              <dd className="tabular font-mono text-ink">{formatKwh(f.monthlyKwh)}</dd>
            </div>
          ) : null}
          {f.contractKw ? (
            <div>
              <dt className="text-sm text-muted">契約容量</dt>
              <dd className="tabular font-mono text-ink">{f.contractKw} kW</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <section className="flex flex-col gap-2">
        <SectionTitle title="推動減碳的原因" />
        {f.pressures.length ? (
          <ul className="flex flex-wrap gap-2">
            {f.pressures.map((p) => (
              <li key={p}>
                <Badge tone="navy">{PRESSURE_LABEL[p]}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">尚未填寫。</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle title="主要設備" />
        {f.equipment.length ? (
          <ScrollX>
            <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line-strong text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">設備類型</th>
                  <th scope="col" className="py-2 pr-3 font-medium">數量</th>
                  <th scope="col" className="py-2 pr-3 font-medium">額定功率</th>
                  <th scope="col" className="py-2 font-medium">啟用年份</th>
                </tr>
              </thead>
              <tbody>
                {f.equipment.map((e, i) => (
                  <tr key={i} className="border-b border-line">
                    <th scope="row" className="py-2 pr-3 font-medium text-ink">{EQUIP_INFO[e.type].label}</th>
                    <td className="tabular py-2 pr-3 font-mono">{e.quantity}</td>
                    <td className="tabular py-2 pr-3 font-mono">{e.ratedKw != null ? `${e.ratedKw} kW` : '—'}</td>
                    <td className="tabular py-2 font-mono">{e.yearInstalled ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        ) : (
          <p className="text-sm text-muted">尚未填寫設備清單。</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle title="開放中的需求" hint="碳盤查資料不公開" />
        {mine.length ? (
          <ul className="flex flex-col gap-3">
            {mine.map((n) => (
              <li key={n.id}>
                <NeedCard need={n} compact />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">這家工廠目前沒有開放中的需求。</p>
        )}
      </section>
    </div>
  )
}
