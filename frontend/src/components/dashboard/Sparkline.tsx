import { motion } from 'framer-motion'
import { cn, slugify, linePath, areaPath, getPoints } from './utils'

export function Sparkline({
  id,
  values,
  color,
  height = 58,
}: {
  id: string
  values: number[]
  color: string
  height?: number
}) {
  const width = 220
  const padding = { top: 8, right: 4, bottom: 8, left: 4 }
  const points = getPoints(values, width, height, padding)
  const path = linePath(points)
  const fill = areaPath(points, height - padding.bottom)
  const gradientId = `spark-fill-${slugify(id)}`
  const delta = values[values.length - 1] - values[0]

  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Trend</p>
        <span className={cn('text-[11px] font-semibold uppercase tracking-[0.22em]', delta >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
          {delta >= 0 ? '+' : ''}
          {delta.toFixed(0)} pts
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-14 w-full">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.38" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fill} fill={`url(#${gradientId})`} />
        <motion.path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
    </div>
  )
}
