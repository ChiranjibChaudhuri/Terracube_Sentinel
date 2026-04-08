import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, Radio, Activity, Zap } from 'lucide-react'
import { mockHazardEvents, mockAlerts, mockSensors, mockPipelineExecutions } from '../lib/mock-data'

const SEVERITY_COLOR: Record<string, string> = {
  GREEN: 'bg-green-500/20 text-green-400',
  YELLOW: 'bg-yellow-500/20 text-yellow-400',
  ORANGE: 'bg-orange-500/20 text-orange-400',
  RED: 'bg-red-500/20 text-red-400',
}

const STATUS_DOT: Record<string, string> = {
  SUCCEEDED: 'bg-green-400',
  FAILED: 'bg-red-400',
  RUNNING: 'bg-blue-400 animate-pulse',
  PENDING: 'bg-slate-400',
  CANCELLED: 'bg-slate-500',
}

export default function Dashboard() {
  const last24h = mockHazardEvents.filter(
    (e) => new Date(e.startTime).getTime() > Date.now() - 86400000,
  )
  const activeAlerts = mockAlerts.filter((a) => !a.expiresAt || new Date(a.expiresAt) > new Date())
  const activeSensors = mockSensors.filter((s) => s.status === 'ACTIVE')
  const recentPipelines = mockPipelineExecutions.slice(0, 5)
  const pipelineHealth =
    recentPipelines.filter((p) => p.status === 'SUCCEEDED').length / recentPipelines.length

  const stats = [
    { label: 'Hazard Events (24h)', value: last24h.length, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Active Alerts', value: activeAlerts.length, icon: Zap, color: 'text-orange-400' },
    { label: 'Active Sensors', value: activeSensors.length, icon: Radio, color: 'text-cyan-400' },
    { label: 'Pipeline Health', value: `${Math.round(pipelineHealth * 100)}%`, icon: Activity, color: 'text-green-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#1e293b] rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 uppercase tracking-wide">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent hazard events */}
        <div className="bg-[#1e293b] rounded-lg border border-slate-700/50">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <h2 className="text-sm font-semibold text-white">Recent Hazard Events</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs border-b border-slate-700/30">
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Severity</th>
                  <th className="text-left px-4 py-2">Location</th>
                  <th className="text-left px-4 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {mockHazardEvents.slice(0, 6).map((e) => (
                  <tr key={e.id} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-200">{e.type}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${SEVERITY_COLOR[e.alertLevel]}`}>
                        {e.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs font-mono">
                      {(e.geometry as { coordinates: number[] }).coordinates[1].toFixed(2)},{' '}
                      {(e.geometry as { coordinates: number[] }).coordinates[0].toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs">
                      {formatDistanceToNow(new Date(e.startTime), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active alerts */}
        <div className="bg-[#1e293b] rounded-lg border border-slate-700/50">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <h2 className="text-sm font-semibold text-white">Active Alerts</h2>
          </div>
          <div className="divide-y divide-slate-700/30">
            {mockAlerts.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLOR[a.severity === 'CRITICAL' ? 'RED' : a.severity === 'HIGH' ? 'ORANGE' : a.severity === 'MODERATE' ? 'YELLOW' : 'GREEN']}`}
                  >
                    {a.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 leading-snug">{a.message}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDistanceToNow(new Date(a.issuedAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline executions */}
      <div className="bg-[#1e293b] rounded-lg border border-slate-700/50">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h2 className="text-sm font-semibold text-white">Recent Pipeline Runs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-slate-700/30">
                <th className="text-left px-4 py-2">Pipeline</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Triggered By</th>
                <th className="text-left px-4 py-2">Started</th>
                <th className="text-left px-4 py-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {recentPipelines.map((p) => {
                const duration =
                  p.completedAt && p.startedAt
                    ? `${((new Date(p.completedAt).getTime() - new Date(p.startedAt).getTime()) / 1000).toFixed(0)}s`
                    : '...'
                return (
                  <tr key={p.id} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-200 font-mono text-xs">{p.pipelineName}</td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[p.status]}`} />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs">{p.triggeredBy}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs">
                      {formatDistanceToNow(new Date(p.startedAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs">{duration}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
