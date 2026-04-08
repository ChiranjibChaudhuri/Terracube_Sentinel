import { useState } from 'react'
import { Search, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { mockGSERegions, mockHazardEvents, mockFinancialIndicators } from '../lib/mock-data'

const THREAT_BG: Record<string, string> = {
  STABLE: 'bg-green-500/20 text-green-400',
  ELEVATED: 'bg-yellow-500/20 text-yellow-400',
  HEIGHTENED: 'bg-orange-500/20 text-orange-400',
  CRITICAL: 'bg-red-500/20 text-red-400',
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

// Synthetic category data for radar chart
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

// Synthetic GSE history (30 days)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Country Intelligence</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 bg-[#1e293b] border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-60"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Country list */}
        <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <h2 className="text-xs font-semibold text-slate-400 uppercase">Countries by Risk</h2>
          </div>
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto divide-y divide-slate-700/20">
            {filtered.map((country) => {
              const rd = mockGSERegions.find((r) => r.regionId === country.region)
              const active = selectedCountry.code === country.code
              return (
                <button
                  key={country.code}
                  onClick={() => { setSelectedCountry(country); setSearch('') }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${active ? 'bg-cyan-500/10' : 'hover:bg-slate-800/50'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs font-mono w-6">{country.code}</span>
                    <span className={active ? 'text-cyan-400' : 'text-slate-200'}>{country.name}</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${THREAT_BG[rd?.threatLevel ?? 'STABLE']}`}>
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
          <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedCountry.name}</h2>
                <p className="text-sm text-slate-400 mt-1">Region: {selectedCountry.region.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-bold ${gseScore >= 60 ? 'text-orange-400' : gseScore >= 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {gseScore.toFixed(1)}
                  </span>
                  <TrendIcon className={`w-5 h-5 ${trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : 'text-slate-400'}`} />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${THREAT_BG[threatLevel]}`}>{threatLevel}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar chart — category breakdown */}
            <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Risk Category Breakdown</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={categoryScores} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 8 }} />
                  <Radar name="Risk" dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* GSE trend chart */}
            <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-4">
              <h3 className="text-sm font-semibold text-white mb-2">GSE Trend (30 days)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={gseHistory}>
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="gse" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Economic indicators */}
            <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Economic Indicators</h3>
              <div className="space-y-2">
                {mockFinancialIndicators.slice(0, 6).map((fi) => (
                  <div key={fi.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{fi.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono">{fi.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      <span className={`text-xs ${(fi.changePct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(fi.changePct ?? 0) >= 0 ? '+' : ''}{fi.changePct?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active events */}
            <div className="bg-[#1e293b] rounded-lg border border-slate-700/50 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Active Events</h3>
              <div className="space-y-2">
                {mockHazardEvents.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center gap-3 text-sm">
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${e.severity === 'CRITICAL' ? 'text-red-400' : e.severity === 'HIGH' ? 'text-orange-400' : 'text-yellow-400'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-200">{e.type}</span>
                      <span className="text-slate-500 text-xs ml-2">{e.severity}</span>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(e.startTime).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Country comparison table */}
          <div className="bg-[#1e293b] rounded-lg border border-slate-700/50">
            <div className="px-4 py-3 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-white">Region Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-slate-700/30">
                    <th className="text-left px-4 py-2">Region</th>
                    <th className="text-left px-4 py-2">GSE Score</th>
                    <th className="text-left px-4 py-2">Threat Level</th>
                    <th className="text-left px-4 py-2">Events</th>
                    <th className="text-left px-4 py-2">Top Category</th>
                    <th className="text-left px-4 py-2">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {mockGSERegions.map((r) => {
                    const T = TREND_ICON[r.trend]
                    return (
                      <tr key={r.regionId} className="border-b border-slate-700/20 hover:bg-slate-800/30">
                        <td className="px-4 py-2 text-slate-200">{r.regionName}</td>
                        <td className="px-4 py-2 font-mono text-white">{r.gseScore.toFixed(1)}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${THREAT_BG[r.threatLevel]}`}>{r.threatLevel}</span>
                        </td>
                        <td className="px-4 py-2 text-slate-400">{r.eventCount}</td>
                        <td className="px-4 py-2 text-slate-400 capitalize">{r.topCategory.replace('_', ' ')}</td>
                        <td className="px-4 py-2">
                          <T className={`w-4 h-4 ${r.trend === 'up' ? 'text-red-400' : r.trend === 'down' ? 'text-green-400' : 'text-slate-400'}`} />
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
    </div>
  )
}
