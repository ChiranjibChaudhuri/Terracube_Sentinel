import { formatDistanceStrict } from 'date-fns'
import { Activity, ArrowUpRight, Clock } from 'lucide-react'
import { KICKER_CLASS } from './constants'
import type { PipelineExecution } from '../../lib/types'

const REFERENCE_NOW = new Date()

function formatRelativeTime(timestamp: string) {
  return formatDistanceStrict(new Date(timestamp), REFERENCE_NOW, { addSuffix: true })
}

export function PipelineRow({
  pipeline,
  duration,
  tone,
}: {
  pipeline: PipelineExecution
  duration: string
  tone: { bg: string; text: string; border: string }
}) {
  const outputSummary = pipeline.nodeResults
    ? Object.entries(pipeline.nodeResults)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ')
    : 'No node telemetry available yet'

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-black/20 px-4 py-4 transition-all duration-200 hover:scale-[1.01]">
      <span className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ background: tone.text }} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,0.8fr))]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">{pipeline.pipelineName}</p>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ background: tone.bg, color: tone.text, border: `1px solid ${tone.border}` }}
            >
              {pipeline.status}
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">{outputSummary}</p>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-3.5 w-3.5 text-slate-500" />
            <div>
              <p className={KICKER_CLASS}>Started</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatRelativeTime(pipeline.startedAt)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-start gap-2">
            <Activity className="mt-0.5 h-3.5 w-3.5 text-cyan-300" />
            <div>
              <p className={KICKER_CLASS}>Duration</p>
              <p className="mt-2 text-sm font-semibold text-white">{duration}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-start gap-2">
            <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 text-emerald-300" />
            <div>
              <p className={KICKER_CLASS}>Triggered by</p>
              <p className="mt-2 text-sm font-semibold capitalize text-white">{pipeline.triggeredBy}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
