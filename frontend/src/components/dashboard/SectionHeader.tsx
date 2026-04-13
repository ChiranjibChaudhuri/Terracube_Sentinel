import type { ReactNode } from 'react'
import { KICKER_CLASS } from './constants'

export function SectionHeader({
  title,
  subtitle,
  aside,
}: {
  title: string
  subtitle: string
  aside?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className={KICKER_CLASS}>{subtitle}</p>
        <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  )
}
