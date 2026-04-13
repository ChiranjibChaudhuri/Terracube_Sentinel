import { GLASS_PANEL, KICKER_CLASS } from './constants'
import { cn } from './utils'
import { RadialGauge } from './RadialGauge'
import { Sparkline } from './Sparkline'

export type GaugeMetricProps = {
  label: string
  value: number
  display: string
  detail: string
  accent: string
  series: number[]
  compact?: boolean
}

export function GaugeMetricCard({
  label,
  value,
  display,
  detail,
  accent,
  series,
  compact = false,
}: GaugeMetricProps) {
  return (
    <div className={cn(GLASS_PANEL, compact ? 'p-4' : 'p-5')}>
      <div className="flex items-center justify-between gap-3">
        <p className={KICKER_CLASS}>{compact ? 'Quality Channel' : 'Command Metric'}</p>
        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">
          {compact ? 'Audit' : 'Telemetry'}
        </span>
      </div>

      <div className={cn('mt-4 grid items-center gap-4', compact ? 'sm:grid-cols-[112px_1fr]' : 'sm:grid-cols-[136px_1fr]')}>
        <div className="flex flex-col items-center">
          <RadialGauge id={label} value={value} display={display} compact={compact} />
          <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">{label}</p>
        </div>

        <div className="min-w-0">
          <p className={cn(compact ? 'text-2xl' : 'text-[30px]', 'font-bold leading-none text-white')}>{display}</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">{detail}</p>
          <div className="mt-5">
            <Sparkline id={label} values={series} color={accent} />
          </div>
        </div>
      </div>
    </div>
  )
}
