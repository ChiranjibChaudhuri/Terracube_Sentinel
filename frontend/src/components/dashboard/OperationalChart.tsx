import { motion } from 'framer-motion'
import { getPoints, linePath, areaPath } from './utils'

export type ChartSeries = {
  key: string
  label: string
  color: string
  fillOpacity?: number
}

export function OperationalChart({
  id,
  data,
  series,
  domain,
}: {
  id: string
  data: Array<Record<string, number | string>>
  series: ChartSeries[]
  domain?: [number, number]
}) {
  const width = 640
  const height = 240
  const padding = { top: 16, right: 12, bottom: 34, left: 12 }
  const labels = data.map((entry) => String(entry.label))
  const seriesValues = series.map((item) => data.map((entry) => Number(entry[item.key])))
  const allValues = seriesValues.flat()
  const chartDomain: [number, number] = domain ?? [Math.min(...allValues), Math.max(...allValues)]
  const plotHeight = height - padding.top - padding.bottom
  const ticks = Array.from({ length: 4 }, (_, index) =>
    chartDomain[0] + ((chartDomain[1] - chartDomain[0]) * index) / 3,
  )

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[240px] w-full">
      <defs>
        {series.map((item) => (
          <linearGradient key={item.key} id={`${id}-${item.key}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={item.color} stopOpacity={item.fillOpacity ?? 0.2} />
            <stop offset="100%" stopColor={item.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      <rect x="0" y="0" width={width} height={height} rx="18" fill="rgba(5,10,19,0.22)" />

      {ticks.map((tick, index) => {
        const y = padding.top + plotHeight - (index / 3) * plotHeight
        return (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(148,163,184,0.12)" strokeDasharray="3 8" />
            <text
              x={width - padding.right}
              y={y - 6}
              textAnchor="end"
              className="fill-slate-500 text-[10px] uppercase tracking-[0.2em]"
            >
              {Math.round(tick)}
            </text>
          </g>
        )
      })}

      {series.map((item, index) => {
        const points = getPoints(seriesValues[index], width, height, padding, chartDomain)
        const shape = linePath(points)
        const fillShape = areaPath(points, height - padding.bottom)
        const lastPoint = points[points.length - 1]

        return (
          <g key={item.key}>
            {item.fillOpacity ? <path d={fillShape} fill={`url(#${id}-${item.key}-fill)`} /> : null}
            <motion.path
              d={shape}
              fill="none"
              stroke={item.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, delay: index * 0.08, ease: 'easeOut' }}
            />
            <circle cx={lastPoint.x} cy={lastPoint.y} r="4.5" fill={item.color} />
            <circle cx={lastPoint.x} cy={lastPoint.y} r="9" fill={item.color} fillOpacity="0.12" />
          </g>
        )
      })}

      {labels.map((label, index) => {
        const x = padding.left + (index / Math.max(labels.length - 1, 1)) * (width - padding.left - padding.right)
        return (
          <text
            key={label}
            x={x}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-500 text-[10px] font-semibold uppercase tracking-[0.2em]"
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}
