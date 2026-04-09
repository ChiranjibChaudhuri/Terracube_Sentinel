import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Globe,
  Minus,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageErrorBanner, SkeletonBlock, SkeletonText } from '../components/AsyncState'
import {
  getCountries,
  getCountry,
  type CountryIntelResponse,
  type CountrySummaryResponse,
} from '../lib/api'

const THREAT_STYLES: Record<string, { bg: string; text: string }> = {
  STABLE: { bg: 'rgba(52,211,153,0.08)', text: '#34d399' },
  ELEVATED: { bg: 'rgba(251,191,36,0.08)', text: '#fbbf24' },
  HEIGHTENED: { bg: 'rgba(249,115,22,0.08)', text: '#f97316' },
  CRITICAL: { bg: 'rgba(244,63,94,0.08)', text: '#f43f5e' },
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, stable: Minus }

const CATEGORIES = [
  'conflict',
  'terrorism',
  'natural_disaster',
  'cyber',
  'political',
  'health',
  'economic',
  'energy',
  'migration',
  'environmental',
  'space',
  'technology',
]

function formatRegionLabel(regionId: string) {
  return regionId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function flattenRecord(value: Record<string, unknown>) {
  const properties = asRecord(value.properties)
  return { ...value, ...properties }
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toStringValue(value: unknown, fallback = 'Unknown') {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function deriveTrend(profile: CountryIntelResponse) {
  if (profile.escalationAlert) return 'up' as const
  if (profile.gseHistory.length >= 2) {
    const first = profile.gseHistory[0]?.gse_score ?? 0
    const last = profile.gseHistory.at(-1)?.gse_score ?? 0
    if (last - first >= 4) return 'up' as const
    if (first - last >= 4) return 'down' as const
  }
  return 'stable' as const
}

function normalizeCategoryScores(profile: CountryIntelResponse) {
  return CATEGORIES.map((category) => ({
    category,
    score: profile.categories[category]?.score ?? 0,
  }))
}

function normalizeHistory(profile: CountryIntelResponse) {
  return profile.gseHistory.map((point) => ({
    date: new Date(point.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    gse: point.gse_score,
  }))
}

function normalizeFinancialIndicators(profile: CountryIntelResponse) {
  return profile.financialIndicators.slice(0, 6).map((item, index) => {
    const record = flattenRecord(asRecord(item))
    const value = toNumber(record.value) ?? 0
    const changePct = toNumber(record.changePct ?? record.change_percent)

    return {
      id: toStringValue(record.id, `${profile.countryCode}-financial-${index}`),
      name: toStringValue(record.name, toStringValue(record.symbol, 'Unnamed indicator')),
      value,
      changePct,
    }
  })
}

function normalizeEvents(profile: CountryIntelResponse) {
  return profile.activeEvents.slice(0, 5).map((item, index) => {
    const record = flattenRecord(asRecord(item))

    return {
      id: toStringValue(record.id, `${profile.countryCode}-event-${index}`),
      type: toStringValue(record.hazardType ?? record.type, 'UNKNOWN'),
      severity: toStringValue(record.severity, 'MODERATE'),
      timestamp: toStringValue(record.startTime ?? record.timestamp ?? record.date, new Date().toISOString()),
    }
  })
}

function CountryIntelSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <SkeletonBlock className="h-4 w-28" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 8 }, (_, index) => (
            <SkeletonBlock key={index} className="h-11 w-full" />
          ))}
        </div>
      </div>

      <div className="space-y-6 lg:col-span-3">
        <div className="glass-card p-6">
          <SkeletonBlock className="h-7 w-52" />
          <div className="mt-4 flex gap-3">
            <SkeletonBlock className="h-10 w-24" />
            <SkeletonBlock className="h-6 w-28" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="glass-card p-5">
              <SkeletonBlock className="h-5 w-40" />
              <div className="mt-4">
                <SkeletonBlock className="h-64 w-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card p-5">
          <SkeletonBlock className="h-5 w-44" />
          <div className="mt-4">
            <SkeletonText lines={6} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CountryIntel() {
  const [search, setSearch] = useState('')
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('')

  const countriesQuery = useQuery({
    queryKey: ['countries'],
    queryFn: ({ signal }) => getCountries(signal),
    refetchInterval: 60_000,
  })

  const countries = countriesQuery.data ?? []

  useEffect(() => {
    if (!selectedCountryCode && countries.length > 0) {
      setSelectedCountryCode(countries[0].countryCode)
    }
  }, [countries, selectedCountryCode])

  const countryQuery = useQuery({
    queryKey: ['country-intel', selectedCountryCode],
    queryFn: ({ signal }) => getCountry(selectedCountryCode, signal),
    enabled: selectedCountryCode.length > 0,
    refetchInterval: 60_000,
  })

  const filteredCountries = search
    ? countries.filter((country) =>
        country.countryName.toLowerCase().includes(search.toLowerCase())
        || country.countryCode.toLowerCase().includes(search.toLowerCase()),
      )
    : countries

  const selectedCountry = countries.find((country) => country.countryCode === selectedCountryCode) ?? countries[0]
  const profile = countryQuery.data
  const trend = profile ? deriveTrend(profile) : 'stable'
  const TrendIcon = TREND_ICON[trend]
  const threatLevel = profile?.threatLevel ?? selectedCountry?.threatLevel ?? 'STABLE'
  const threatStyle = THREAT_STYLES[threatLevel] ?? THREAT_STYLES.STABLE
  const categoryScores = profile ? normalizeCategoryScores(profile) : []
  const gseHistory = profile ? normalizeHistory(profile) : []
  const financialIndicators = profile ? normalizeFinancialIndicators(profile) : []
  const activeEvents = profile ? normalizeEvents(profile) : []

  const handleRetry = () => {
    void countriesQuery.refetch()
    if (selectedCountryCode) {
      void countryQuery.refetch()
    }
  }

  const isInitialLoading = countriesQuery.isLoading || (selectedCountryCode.length > 0 && countryQuery.isLoading && !profile)

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Globe className="h-5 w-5 text-cyan-400" />
          <h1 className="text-lg font-bold text-white">Country Intelligence</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search country..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="focus-ring w-60 rounded-lg py-2 pl-9 pr-4 text-sm text-white placeholder-[var(--text-muted)] focus:outline-none"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
          />
        </div>
      </div>

      {countriesQuery.isError || countryQuery.isError ? (
        <PageErrorBanner
          title="Country intelligence refresh failed"
          message="The page is retrying automatically. Retry now to request a fresh country profile from the backend."
          onRetry={handleRetry}
        />
      ) : null}

      {isInitialLoading ? (
        <CountryIntelSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="glass-card overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Countries by Risk
              </h2>
            </div>
            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
              {filteredCountries.map((country) => {
                const active = selectedCountryCode === country.countryCode
                const tone = THREAT_STYLES[country.threatLevel] ?? THREAT_STYLES.STABLE

                return (
                  <button
                    key={country.countryCode}
                    type="button"
                    onClick={() => {
                      setSelectedCountryCode(country.countryCode)
                      setSearch('')
                    }}
                    className="w-full px-4 py-3 text-sm transition-all"
                    style={{
                      background: active ? 'rgba(56,189,248,0.06)' : 'transparent',
                      borderBottom: '1px solid var(--border-subtle)',
                      borderLeft: active ? '2px solid #38bdf8' : '2px solid transparent',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5 text-left">
                        <span className="w-6 text-[10px] font-bold font-mono" style={{ color: 'var(--text-muted)' }}>
                          {country.countryCode}
                        </span>
                        <span className={active ? 'font-medium text-cyan-400' : 'text-white'}>
                          {country.countryName}
                        </span>
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: tone.bg, color: tone.text }}
                      >
                        {country.gseScore.toFixed(0)}
                      </span>
                    </div>
                  </button>
                )
              })}
              {filteredCountries.length === 0 ? (
                <p className="px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                  No countries matched your search.
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-3">
            <div className="glass-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{profile?.countryName ?? selectedCountry?.countryName ?? 'Country'}</h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Region: {formatRegionLabel(profile?.regionId ?? selectedCountry?.regionId ?? 'unknown')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <div className="flex items-center gap-2">
                    <span className={`text-3xl font-bold ${profile && profile.gseScore >= 60 ? 'gradient-text-rose' : profile && profile.gseScore >= 30 ? 'gradient-text-amber' : 'gradient-text-emerald'}`}>
                      {(profile?.gseScore ?? selectedCountry?.gseScore ?? 0).toFixed(1)}
                    </span>
                    <TrendIcon className={`h-5 w-5 ${trend === 'up' ? 'text-rose-400' : trend === 'down' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                    style={{ background: threatStyle.bg, color: threatStyle.text, border: `1px solid ${threatStyle.text}22` }}
                  >
                    {threatLevel}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="glass-card p-5">
                <h3 className="mb-3 text-sm font-semibold text-white">Risk Category Breakdown</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={categoryScores} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="var(--border-subtle)" />
                    <PolarAngleAxis dataKey="category" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 8 }} />
                    <Radar name="Risk" dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card p-5">
                <h3 className="mb-3 text-sm font-semibold text-white">GSE Trend (30 days)</h3>
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

              <div className="glass-card overflow-hidden">
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <h3 className="text-sm font-semibold text-white">Economic Indicators</h3>
                </div>
                <div>
                  {financialIndicators.map((indicator, index) => {
                    const isUp = (indicator.changePct ?? 0) >= 0
                    return (
                      <div
                        key={indicator.id}
                        className="table-row-hover flex items-center justify-between px-5 py-3"
                        style={{ borderBottom: index < financialIndicators.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                      >
                        <span className="text-sm text-white">{indicator.name}</span>
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold font-mono text-white">
                            {indicator.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                          <span className={`flex items-center gap-0.5 text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {indicator.changePct === null ? 'n/a' : `${isUp ? '+' : ''}${indicator.changePct.toFixed(2)}%`}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  {financialIndicators.length === 0 ? (
                    <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                      No financial indicators were returned for this country.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="glass-card overflow-hidden">
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <h3 className="text-sm font-semibold text-white">Active Events</h3>
                </div>
                <div>
                  {activeEvents.map((event, index) => (
                    <div
                      key={event.id}
                      className="table-row-hover flex items-center gap-3 px-5 py-3 text-sm"
                      style={{ borderBottom: index < activeEvents.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                    >
                      <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${event.severity === 'CRITICAL' ? 'text-rose-400' : event.severity === 'HIGH' ? 'text-orange-400' : 'text-yellow-400'}`} />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-white">{event.type}</span>
                        <span
                          className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: event.severity === 'CRITICAL' ? 'rgba(244,63,94,0.08)' : event.severity === 'HIGH' ? 'rgba(249,115,22,0.08)' : 'rgba(251,191,36,0.08)',
                            color: event.severity === 'CRITICAL' ? '#f43f5e' : event.severity === 'HIGH' ? '#f97316' : '#fbbf24',
                          }}
                        >
                          {event.severity}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(event.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {activeEvents.length === 0 ? (
                    <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                      No active events were returned for this country.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 className="text-sm font-semibold text-white">Country Comparison</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th className="px-5 py-3 text-left font-semibold">Country</th>
                      <th className="px-5 py-3 text-left font-semibold">Region</th>
                      <th className="px-5 py-3 text-left font-semibold">GSE Score</th>
                      <th className="px-5 py-3 text-left font-semibold">Threat Level</th>
                      <th className="px-5 py-3 text-left font-semibold">Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countries.map((country: CountrySummaryResponse) => {
                      const tone = THREAT_STYLES[country.threatLevel] ?? THREAT_STYLES.STABLE

                      return (
                        <tr key={country.countryCode} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="px-5 py-3 font-medium text-white">{country.countryName}</td>
                          <td className="px-5 py-3 capitalize" style={{ color: 'var(--text-secondary)' }}>
                            {formatRegionLabel(country.regionId)}
                          </td>
                          <td className="px-5 py-3 font-semibold font-mono text-white">{country.gseScore.toFixed(1)}</td>
                          <td className="px-5 py-3">
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: tone.bg, color: tone.text }}>
                              {country.threatLevel}
                            </span>
                          </td>
                          <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                            {country.eventCount}
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
      )}
    </motion.div>
  )
}
