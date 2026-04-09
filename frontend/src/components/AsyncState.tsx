import type { ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export function SkeletonBlock({
  className = '',
}: {
  className?: string
}) {
  return <div className={`animate-pulse rounded-2xl bg-white/6 ${className}`.trim()} />
}

export function SkeletonText({
  lines = 3,
}: {
  lines?: number
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonBlock
          key={index}
          className={index === lines - 1 ? 'h-3 w-2/3' : 'h-3 w-full'}
        />
      ))}
    </div>
  )
}

export function PageErrorBanner({
  title = 'Unable to load live data',
  message,
  onRetry,
  actionLabel = 'Retry',
  children,
}: {
  title?: string
  message: string
  onRetry?: () => void
  actionLabel?: string
  children?: ReactNode
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm"
      style={{
        background: 'rgba(127, 29, 29, 0.18)',
        borderColor: 'rgba(248, 113, 113, 0.24)',
        color: 'var(--text-secondary)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-300" />
          <div>
            <p className="font-semibold text-white">{title}</p>
            <p className="mt-1 leading-6">{message}</p>
          </div>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: 'rgba(56, 189, 248, 0.18)',
              border: '1px solid rgba(56, 189, 248, 0.28)',
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {actionLabel}
          </button>
        ) : null}
      </div>
      {children}
    </div>
  )
}
