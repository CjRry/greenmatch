import { Link, useParams, useSearchParams } from 'react-router'
import { paths } from '../core/paths'
import { useSession } from '../core/session'
import { useCollection, useDoc } from '../core/store/StoreProvider'
import { DemoBadge, PageHeader, Tabs } from '../ui'
import MatchResult from '../features/ai/pages/MatchResult'
import QuoteCompare from '../features/ai/pages/QuoteCompare'
import CaseTracker from '../features/workspace/pages/CaseTracker'
import { mayView } from '../features/workspace/lib/views'

type CaseTab = 'progress' | 'match' | 'quotes'

function parseTab(raw: string | null): CaseTab {
  return raw === 'match' || raw === 'quotes' ? raw : 'progress'
}

/**
 * Unified single-page Case Center (`/cases/:id`) that brings Progress, AI Recommendations,
 * and Quote Comparison + ROI together in Tabs without losing direct deep-link routes.
 */
export default function CaseCenter() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { company, role } = useSession()
  const c = useDoc('cases', id)
  const factory = useDoc('companies', c?.factoryId ?? null)
  const quotes = useCollection('quotes')

  if (company === undefined || c === undefined || !company || !role || !c || !mayView(c, role, company.id)) {
    return <CaseTracker />
  }

  const tab = parseTab(params.get('tab'))
  const setTab = (next: CaseTab) => {
    setParams(
      (prev) => {
        const copy = new URLSearchParams(prev)
        if (next === 'progress') copy.delete('tab')
        else copy.set('tab', next)
        return copy
      },
      { replace: true },
    )
  }

  const isOwner = role === 'factory' && company.id === c.factoryId
  const visibleQuotes = (quotes ?? []).filter((q) => q.caseId === c.id && (isOwner || q.vendorId === company.id))

  return (
    <>
      <PageHeader
        eyebrow="案件進度"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {c.title}
            {c.isDemo ? <DemoBadge /> : null}
          </span>
        }
        breadcrumbs={[{ label: '我的', to: paths.me() }, { label: c.title }]}
        description={
          factory ? (
            <>
              工廠：
              <Link to={paths.factory(factory.id)} className="text-brand-strong hover:underline">
                {factory.name}
              </Link>
            </>
          ) : undefined
        }
      />

      <div className="mb-5">
        <Tabs<CaseTab>
          label="案件中心分頁"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'progress', label: '進度追蹤' },
            { key: 'match', label: '推薦廠商', count: c.recommendations.length || undefined },
            { key: 'quotes', label: '報價比較與 ROI', count: visibleQuotes.length || undefined },
          ]}
        />
      </div>

      {tab === 'progress' ? <CaseTracker embedded /> : null}
      {tab === 'match' ? <MatchResult embedded /> : null}
      {tab === 'quotes' ? <QuoteCompare embedded /> : null}
    </>
  )
}
