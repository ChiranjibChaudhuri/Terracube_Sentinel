import { motion } from 'framer-motion'
import { cn, clamp, slugify, describeArc } from './utils'

export function RadialGauge({
  id,
  value,
  display,
  size = 132,
  compact = false,
}: {
  id: string
  value: number
  display: string
  size?: number
  compact?: boolean
}) {
  const progress = clamp(value) / 100
  const center = size / 2
  const radius = center - (compact ? 14 : 16)
  const strokeWidth = compact ? 8 : 10
  const gaugeId = slugify(id)
  const fullArc = describeArc(center, center, radius, 135, 405)
  const zones = [
    { start: 135, end: 265, color: '#22c55e' },
    { start: 265, end: 340, color: '#eab308' },
    { start: 340, end: 405, color: '#ef4444' },
  ]

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={cn(compact ? 'h-28 w-28' : 'h-32 w-32', 'overflow-visible')}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`gauge-progress-${gaugeId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="62%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>

      <path d={fullArc} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} strokeLinecap="round" />
      {zones.map((zone) => (
        <path
          key={`${zone.start}-${zone.end}`}
          d={describeArc(center, center, radius, zone.start, zone.end)}
          fill="none"
          stroke={zone.color}
          strokeOpacity={0.36}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      ))}
      <motion.path
        d={fullArc}
        fill="none"
        stroke={`url(#gauge-progress-${gaugeId})`}
        strokeWidth={strokeWidth + 1}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: progress }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{ filter: 'drop-shadow(0 0 12px rgba(103, 200, 255, 0.3))' }}
      />
      <circle
        cx={center}
        cy={center}
        r={radius - strokeWidth * 1.65}
        fill="rgba(8,14,28,0.9)"
        stroke="rgba(255,255,255,0.06)"
      />
      <text
        x={center}
        y={center + 2}
        textAnchor="middle"
        className={cn(compact ? 'fill-white text-[20px]' : 'fill-white text-[24px]', 'font-bold')}
      >
        {display}
      </text>
    </svg>
  )
}
