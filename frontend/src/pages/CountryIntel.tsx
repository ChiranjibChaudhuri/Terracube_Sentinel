import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, TrendingUp, TrendingDown, Minus, AlertTriangle, Globe, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { mockGSERegions, mockHazardEvents, mockFinancialIndicators } from '../lib/mock-data'

const THREAT_STYLES: Record<string, { bg: string; text: string }> = {
  STABLE:     { bg: 'rgba(52,211,153,0.08)', text: '#34d399' },
  ELEVATED:   { bg: 'rgba(251,191,36,0.08)', text: '#fbbf24' },
  HEIGHTENED: { bg: 'rgba(249,115,22,0.08)', text: '#f97316' },
  CRITICAL:   { bg: 'rgba(244,63,94,0.08)',  text: '#f43f5e' },
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, stable: Minus }

const COUNTRIES = [
  { code: 'US', name: 'United States', region: 'north-america' },
  { code: 'GB', name: 'United Kingdom', region: 'europe' },
  { code: 'JP', name: 'Japan', region: 'east-asia' },
  { code: 'DE', name: 'Germany', region: 'europe' },
  { code: 'IN', name: 'India', region: 'south-asia' },
  { code: 'CN', name: 'China', region: 'east-asia' },
  { code: 'BR', name: 'Brazil', region: 'south-america' },
  { code: 'AU', name: 'Australia', region: 'oceania' },
  { code: 'NG', name: 'Nigeria', region: 'africa' },
  { code: 'EG', name: 'Egypt', region: 'middle-east' },
  { code: 'TR', name: 'Turkey', region: 'middle-east' },
  { code: 'SA', name: 'Saudi Arabia', region: 'middle-east' },
  { code: 'UA', name: 'Ukraine', region: 'europe' },
  { code: 'PK', name: 'Pakistan', region: 'south-asia' },
]

const CATEGORIES = [
  'conflict', 'terrorism', 'natural_disaster', 'cyber', 'political', 'health',
  'economic', 'energy', 'migration', 'environmental', 'space', 'technology',
]

function getCategoryScores(regionId: string): Array<{ category: string; score: number }> {
  const seedMap: Record<string, number[]> = {
    'middle-east': [85, 70, 30, 25, 65, 20, 45, 60, 55, 15, 5, 10],
    'south-asia': [40, 55, 80, 15, 50, 45, 35, 30, 40, 50, 5, 8],
    'europe': [15, 10, 20, 35, 55, 15, 40, 50, 40, 30, 15, 25],
    'east-asia': [10, 5, 50, 30, 25, 20, 45, 20, 10, 35, 20, 40],
    'north-america': [5, 8, 30, 40, 30, 15, 50, 25, 15, 25, 25, 35],
    'africa': [55, 40, 45, 10, 50, 65, 40, 30, 50, 40, 2, 5],
    'south-america': [20, 15, 35, 10, 40, 20, 35, 20, 25, 30, 3, 8],
    'oceania': [2, 2, 25, 10, 10, 5, 15, 10, 5, 20, 5, 15],
  }
  const scores = seedMap[regionId] ?? CATEGORIES.map(() => 10)
  return CATEGORIES.map((c, i) => ({ category: c, score: scores[i] ?? 10 }))
}

function getGSEHistory(baseScore: number) {
  const data = []
  for (let i = 30; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    data.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      gse: Math.max(0, baseScore + (Math.random() - 0.5) * 20 - i * 0.2),
    })
  }
  return data
}

export default function CountryIntel() {
  const [search, setSearch] = useState('')
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0])

  const filtered = search
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES

  const regionData = mockGSERegions.find((r) => r.regionId === selectedCountry.region)
  const gseScore = regionData?.gseScore ?? 0
  const threatLevel = regionData?.threatLevel ?? 'STABLE'
  const trend = regionData?.trend ?? 'stable'

  const categoryScores = getCategoryScores(selectedCountry.region)
  const gseHistory = getGSEHistory(gseScore)
  const TrendIcon = TREND_ICON[trend]
  const threatStyle = THREAT_STYLES[threatLevel]

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Globe className="w-5 h-5 text-cyan-400" />
          <h1 className="text-lg font-bold text-white">Country Intelligence</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg text-sm text-white placeholder-[var(--text-muted)] focus:outline-none w-60 transition-colors focus-ring"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-active)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Country list */}
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Countries by Risk</h2>
          </div>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
            {filtered.map((country) => {
              const rd = mockGSERegions.find((r) => r.regionId === country.region)
              const active = selectedCountry.code === country.code
              const ts = THREAT_STYLES[rd?.threatLevel ?? 'STABLE']
              return (
                <button
                  key={country.code}
                  onClick={() => { setSelectedCountry(country); setSearch('') }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm transition-all"
                  style={{
                    background: active ? 'rgba(56,189,248,0.06)' : 'transparent',
                    borderBottom: '1px solid var(--border-subtle)',
                    borderLeft: active ? '2px solid #38bdf8' : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(99,130,191,0.04)' }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono font-bold w-6" style={{ color: 'var(--text-muted)' }}>{country.code}</span>
                    <span className={active ? 'text-cyan-400 font-medium' : 'text-white'}>{country.name}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: ts.bg, color: ts.text }}
                  >
                    {rd?.gseScore?.toFixed(0) ?? '0'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Country header */}
          <div className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedCountry.name}</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Region: {selectedCountry.region.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-bold ${gseScore >= 60 ? 'gradient-text-rose' : gseScore >= 30 ? 'gradient-text-amber' : 'gradient-text-emerald'}`}>
                    {gseScore.toFixed(1)}
                  </span>
                  <TrendIcon className={`w-5 h-5 ${trend === 'up' ? 'text-rose-400' : trend === 'down' ? 'text-emerald-400' : 'text-slate-500'}`} />
                </div>
                <span
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase"
                  style={{ background: threatStyle.bg, color: threatStyle.text, border: `1px solid ${threatStyle.text}22` }}
                >
                  {threatLevel}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar chart */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Risk Category Breakdown</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={categoryScores} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="var(--border-subtle)" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 8 }} />
                  <Radar name="Risk" dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* GSE trend chart */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-3">GSE Trend (30 days)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={gseHistory}>
                  <defs>
                    <linearGradient id="gseGradCountry" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }} />
                  <Area type="monotone" dataKey="gse" stroke="#f97316" strokeWidth={2} fill="url(#gseGradCountry)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Economic indicators */}
            <div className="glass-card overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 className="text-sm font-semibold text-white">Economic Indicators</h3>
              </div>
              <div>
                {mockFinancialIndicators.slice(0, 6).map((fi, idx) => {
                  const isUp = (fi.changePct ?? 0) >= 0
                  return (
                    <div
                      key={fi.id}
                      className="flex items-center justify-between px-5 py-3 table-row-hover"
                      style={{ borderBottom: idx < 5 ? '1px solid var(--border-subtle)' : 'none' }}
                    >
                      <span className="text-sm text-white">{fi.name}</span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm text-white font-mono font-semibold">{fi.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        <span className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {isUp ? '+' : ''}{fi.changePct?.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Active events */}
            <div className="glass-card overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 className="text-sm font-semibold text-white">Active Events</h3>
              </div>
              <div>
                {mockHazardEvents.slice(0, 5).map((e, idx) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 px-5 py-3 text-sm table-row-hover"
                    style={{ borderBottom: idx < 4 ? '1px solid var(--border-subtle)' : 'none' }}
                  >
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${e.severity === 'CRITICAL' ? 'text-rose-400' : e.severity === 'HIGH' ? 'text-orange-400' : 'text-yellow-400'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-medium">{e.type}</span>
                      <span
                        className="text-[10px] font-semibold ml-2 px-1.5 py-0.5 rounded-full"
                        style={{
                          background: e.severity === 'CRITICAL' ? 'rgba(244,63,94,0.08)' : e.severity === 'HIGH' ? 'rgba(249,115,22,0.08)' : 'rgba(251,191,36,0.08)',
                          color: e.severity === 'CRITICAL' ? '#f43f5e' : e.severity === 'HIGH' ? '#f97316' : '#fbbf24',
                        }}
                      >
                        {e.severity}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(e.startTime).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Region Comparison Table */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-semibold text-white">Region Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="text-left px-5 py-3 font-semibold">Region</th>
                    <th className="text-left px-5 py-3 font-semibold">GSE Score</th>
                    <th className="text-left px-5 py-3 font-semibold">Threat Level</th>
                    <th className="text-left px-5 py-3 font-semibold">Events</th>
                    <th className="text-left px-5 py-3 font-semibold">Top Category</th>
                    <th className="text-left px-5 py-3 font-semibold">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {mockGSERegions.map((r) => {
                    const T = TREND_ICON[r.trend]
                    const ts = THREAT_STYLES[r.threatLevel]
                    return (
                      <tr key={r.regionId} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-5 py-3 text-white font-medium">{r.regionName}</td>
                        <td className="px-5 py-3 font-mono font-semibold text-white">{r.gseScore.toFixed(1)}</td>
                        <td className="px-5 py-3">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                            style={{ background: ts.bg, color: ts.text }}
                          >
                            {r.threatLevel}
                          </span>
                        </td>
                        <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>{r.eventCount}</td>
                        <td className="px-5 py-3 capitalize" style={{ color: 'var(--text-secondary)' }}>{r.topCategory.replace('_', ' ')}</td>
                        <td className="px-5 py-3">
                          <T className={`w-4 h-4 ${r.trend === 'up' ? 'text-rose-400' : r.trend === 'down' ? 'text-emerald-400' : 'text-slate-500'}`} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
