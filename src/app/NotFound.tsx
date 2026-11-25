import { useRouteError } from 'react-router'
import { SearchX, TriangleAlert } from 'lucide-react'
import { paths } from '../core/paths'
import { ButtonLink, EmptyState } from '../ui'

export function NotFound() {
  return (
    <EmptyState
      icon={<SearchX className="size-6" aria-hidden />}
      title="找不到這個頁面"
      body="連結可能已失效，或資料已被移除。"
      action={<ButtonLink to={paths.home()}>回到首頁</ButtonLink>}
      className="mt-10"
    />
  )
}

/** Shown when a page throws while rendering. */
export function RouteError() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : String(error ?? '')
  return (
    <div className="gutter mx-auto max-w-xl py-16">
      <EmptyState
        icon={<TriangleAlert className="size-6" aria-hidden />}
        title="這個頁面出了問題"
        body={
          <>
            請回到首頁再試一次。
            {message ? <span className="mt-2 block font-mono text-xs break-all">{message}</span> : null}
          </>
        }
        action={<ButtonLink to={paths.home()}>回到首頁</ButtonLink>}
      />
    </div>
  )
}
