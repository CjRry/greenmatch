import { Hammer } from 'lucide-react'
import { EmptyState, PageHeader } from '../ui'

/** Placeholder the CEO puts in every route. The owning agent replaces the page file's body. */
export function StubPage({ title, owner }: { title: string; owner: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState icon={<Hammer className="size-6" aria-hidden />} title="此頁面建置中" body={`負責團隊：${owner}`} />
    </div>
  )
}
