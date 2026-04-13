import { LIVE_BADGE_STYLES } from './constants'
import { cn } from './utils'

export function LiveBadge({
  label = 'LIVE',
  tone = 'green',
}: {
  label?: string
  tone?: keyof typeof LIVE_BADGE_STYLES
}) {
  const style = LIVE_BADGE_STYLES[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.32em]',
        style.badge,
      )}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        <span className={cn('absolute inset-0 rounded-full opacity-70 animate-pulse', style.dot)} />
        <span className={cn('relative h-2 w-2 rounded-full', style.dot)} />
      </span>
      {label}
    </span>
  )
}
