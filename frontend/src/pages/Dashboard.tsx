import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle, Activity, Zap, Shield, TrendingUp, TrendingDown,
  Minus, Plane, Ship, DollarSign, Globe,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  mockHazardEvents, mockAlerts, mockSensors, mockPipelineExecutions,
  mockGSERegions, mockAircraft, mockVessels, mockFinancialIndicators,
} from '../lib/mock-data'

const SEVERITY_COLOR: Record<string, string> = {
  GREEN: 'bg-green-500/20 text-green-400',
  YELLOW: 'bg-yellow-500/20 text-yellow-400',
  ORANGE: 'bg-orange-500/20 text-orange-400',
  RED: 'bg-red-500/20 text-red-400',
}

const THREAT_BG: Record<string, string> = {
  STABLE: 'bg-green-500/20 text-green-400',
  ELEVATED: 'bg-yellow-500/20 text-yellow-400',
  HEIGHTENED: 'bg-orange-500/20 text-orange-400',
  CRITICAL: 'bg-red-500/20 text-red-400',
}

const THREAT_BAR: Record<string, string> = {
  STABLE: '#22c55e', ELEVATED: '#eab308', HEIGHTENED: '#f97316', CRITICAL: '#ef4444',
}

const STATUS_DOT: Record<string, string> = {
  SUCCEEDED: 'bg-green-400', FAILED: 'bg-red-400', RUNNING: 'bg-blue-400 animate-pulse',
  PENDING: 'bg-slate-400', CANCELLED: 'bg-slate-500',
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, stable: Minus }

// Synthetic global GSE history for sparkline
const globalGSEHistory = Array.from({ length: 24 }, (_, i) => ({
  hour: `${23 - i}h`,
  gse: 55 + Math.sin(i * 0.5) * 15 + (Math.random() - 0.5) * 8,
})).reverse()

export default function Dashboard() {
  const last24h = mockHazardEvents.filter(
    (e) => new Date(e.startTime).getTime() > Date.now() - 86400000,
  )
  const activeAlerts = mockAlerts.filter((a) => !a.expiresAt || new Date(a.expiresAt) > new Date())
  const activeSensors = mockSensors.filter((s) => s.status === 'ACTIVE')
  const recentPipelines = mockPipelineExecutions.slice(0, 5)
  const pipelineHealth = recentPipelines.filter((p) => p.status === 'SUCCEEDED').length / recentPipelines.length

  const maxGSE = Math.max(...mockGSERegions.map((r) => r.gseScore))
  const globalThreat = maxGSE >= 90 ? 'CRITICAL' : maxGSE >= 60 ? 'HEIGHTENED' : maxGSE >= 30 ? 'ELEVATED' : 'STABLE'
  const hasEscalation = mockGSERegions.some((r) => r.trend === 'up' && r.gseScore > 60)

  const stats = [
    { label: 'Global Threat', value: globalThreat, sub: `Peak GSE: ${maxGSE.toFixed(1)}`, icon: Shield, color: maxGSE >= 60 ? 'text-orange-400' : 'text-green-400' },
    { label: 'Hazard Events (24h)', value: last24h.length, sub: `${activeAlerts.length} alerts`, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Live Tracking', value: `${mockAircraft.length}/${mockVessels.length}`, sub: 'Aircraft / Vessels', icon: Plane, color: 'text-sky-400' },
    { label: 'Pipeline Health', value: `${Math.round(pipelineHealth * 100)}%`, sub: `${activeSensors.length} sensors`, icon: Activity, color: 'text-green-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Escalation banner */}
      {hasEscalation && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-2 flex items-center gap-3">
          <Zap className="w-4 h-4 text-orange-400 animate-pulse" />
          <span className="text-sm text-orange-300">
            Escalation detected in {mockGSERegions.filter((r) => r.trend === 'up' && r.gseScore > 60).map((r) => r.regionName).join(', ')}
          </span>
        </div>
      )}

      {/* 1. Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#1e293b] rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 uppercase tracking-wide">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* 2. GSE Overview + Global Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GSE Sparkline */}
        <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Global Stability Index (24h)</h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={globalGSEHistory}>
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} interval={5} />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="gse" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Country Risk Table (compact) */}
        <div className="lg:col-span-2 bg-[#1e293b] rounded-lg border border-slate-700/50">
          <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Regional Threat Assessment</h2>
            <Globe className="w-4 h-4 text-slate-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs border-b border-slate-700/30">
                  <th className="text-left px-4 py-2">Region</th>
                  <th className="text-left px-4 py-2">GSE</th>
                  <th className="text-left px-4 py-2">Level</th>
                  <th className="text-left px-4 py-2">Events</th>
                  <th className="text-left px-4 py-2">Driver</th>
                  <th className="text-left px-4 py-2">Trend</th>
                </tr>
              </thead>
              <tbody>
                {mockGSERegions.map((r) => {
                  const T = TREND_ICON[r.trend]
                  return (
                    <tr key={r.regionId} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                      <td className="px-4 py-2 text-slate-200 text-xs">{r.regionName}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(100, r.gseScore)}%`, backgroundColor: THREAT_BAR[r.threatLevel] }}
                            />
                          </div>
                          <span className="text-xs text-white font-mono">{r.gseScore.toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${THREAT_BG[r.threatLevel]}`}>{r.threatLevel}</span>
                      </td>
                      <td className="px-4 py-2 text-slate-400 text-xs">{r.eventCount}</td>
                      <td className="px-4 py-2 text-slate-400 text-xs capitalize">{r.topCategory.replace('_', ' ')}</td>
                      <td className="px-4 py-2">
                        <T className={`w-3.5 h-3.5 ${r.trend === 'up' ? 'text-red-400' : r.trend === 'down' ? 'text-green-400' : 'text-slate-400'}`} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. Priority Signals + Active Threats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent hazard events */}
        <div className="bg-[#1e293b] rounded-lg border border-slate-700/50">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <h2 className="text-sm font-semibold text-white">Active Threats</h2>
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
                    <td className="px-4 py-2 text-slate-200 text-xs">{e.type}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${SEVERITY_COLOR[e.alertLevel]}`}>{e.severity}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-400 text-xs font-mono">
                      {(e.geometry as { type: string; coordinates: [number, number] }).coordinates[1].toFixed(2)},{' '}
                      {(e.geometry as { type: string; coordinates: [number, number] }).coordinates[0].toFixed(2)}
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
            <h2 className="text-sm font-semibold text-white">Priority Signals</h2>
          </div>
          <div className="divide-y divide-slate-700/30">
            {mockAlerts.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLOR[a.severity === 'CRITICAL' ? 'RED' : a.severity === 'HIGH' ? 'ORANGE' : a.severity === 'MODERATE' ? 'YELLOW' : 'GREEN']}`}>
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

      {/* 4. Economic Indicators + Movement Tracking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Economic indicators */}
        <div className="bg-[#1e293b] rounded-lg border border-slate-700/50">
          <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Economic Indicators</h2>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <div className="divide-y divide-slate-700/20">
            {mockFinancialIndicators.map((fi) => (
              <div key={fi.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-200">{fi.name}</span>
                  <span className="text-xs text-slate-500 ml-2">{fi.symbol}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-white font-mono">
                    {fi.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  <span className={`ml-2 text-xs ${(fi.changePct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(fi.changePct ?? 0) >= 0 ? '+' : ''}{fi.changePct?.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Movement tracking */}
        <div className="bg-[#1e293b] rounded-lg border border-slate-700/50">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <h2 className="text-sm font-semibold text-white">Movement Tracking</h2>
          </div>
          <div className="divide-y divide-slate-700/20">
            <div className="px-4 py-2">
              <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Plane className="w-3 h-3" /> Aircraft</h3>
              {mockAircraft.slice(0, 3).map((a) => (
                <div key={a.id} className="flex justify-between py-1 text-xs">
                  <span className="text-sky-400 font-mono">{a.callsign || a.icao24}</span>
                  <span className="text-slate-400">Alt: {a.altitude?.toLocaleString()}m | {a.velocity}m/s</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2">
              <h3 className="text-xs text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Ship className="w-3 h-3" /> Vessels</h3>
              {mockVessels.map((v) => (
                <div key={v.id} className="flex justify-between py-1 text-xs">
                  <span className="text-blue-400">{v.name || v.mmsi}</span>
                  <span className="text-slate-400">{v.shipType} | {v.speed}kn → {v.destination}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Pipeline Health */}
      <div className="bg-[#1e293b] rounded-lg border border-slate-700/50">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h2 className="text-sm font-semibold text-white">Pipeline Health</h2>
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
                const duration = p.completedAt && p.startedAt
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
