import { PIPELINE_STATUS_STYLES } from './constants'

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

export function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

export function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ')
}

export function linePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

export function areaPath(points: Array<{ x: number; y: number }>, baseline: number) {
  if (points.length === 0) return ''
  return `${linePath(points)} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
}

export function getPoints(
  values: number[],
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
  domain?: [number, number],
) {
  const [min, max] = domain ?? [Math.min(...values), Math.max(...values)]
  const range = max - min || 1
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  return values.map((value, index) => {
    const x = padding.left + (index / Math.max(values.length - 1, 1)) * plotWidth
    const normalized = (clamp(value, min, max) - min) / range
    const y = padding.top + plotHeight - normalized * plotHeight
    return { x, y }
  })
}

export function getStatusTone(status: string) {
  const pipelineTone = PIPELINE_STATUS_STYLES[status]
  if (pipelineTone) return pipelineTone

  switch (status) {
    case 'CRITICAL':
    case 'HIGH':
      return PIPELINE_STATUS_STYLES.FAILED
    case 'MODERATE':
      return { bg: 'rgba(251, 146, 60, 0.12)', text: '#fb923c', border: 'rgba(251, 146, 60, 0.24)' }
    case 'LOW':
    case 'GREEN':
      return PIPELINE_STATUS_STYLES.SUCCEEDED
    case 'LIVE':
      return PIPELINE_STATUS_STYLES.RUNNING
    case 'MONITOR':
      return { bg: 'rgba(148, 163, 184, 0.12)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.2)' }
    default:
      return { bg: 'rgba(148, 163, 184, 0.12)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.22)' }
  }
}
