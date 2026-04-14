import { useState } from 'react'
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
import { getCountries, getCountry, type CountryIntelResponse, type CountrySummaryResponse } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const THREAT_STYLES: Record<string, { bg: string; text: string }> = {
  STABLE: { bg: 'rgba(52,211,153,0.08)', text: '#34d399' },
  ELEVATED: { bg: 'rgba(251,191,36,0.08)', text: '#fbbf24' },
  HEIGHTENED: { bg: 'rgba(249,115,22,0.08)', text: '#f97316' },
  CRITICAL: { bg: 'rgba(244,63,94,0.08)', text: '#f43f5e' },
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: 'rgba(244,63,94,0.08)', text: '#f43f5e' },
  HIGH: { bg: 'rgba(249,115,22,0.08)', text: '#f97316' },
  MODERATE: { bg: 'rgba(251,191,36,0.08)', text: '#fbbf24' },
  LOW: { bg: 'rgba(52,211,153,0.08)', text: '#34d399' },
}

const TREND_ICON = { up: TrendingUp, down: TrendingDown, stable: Minus }

const CATEGORIES = [
  'conflict', 'terrorism', 'natural_disaster', 'cyber', 'political',
  'health', 'economic', 'energy', 'migration', 'environmental', 'space', 'technology',
]

function formatRegionLabel(regionId: string) {
  return regionId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function flattenRecord(value: Record<string, unknown>) {
  return { ...value, ...(asRecord(value.properties)) }
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
  return CATEGORIES.map((category) => ({ category, score: profile.categories[category]?.score ?? 0 }))
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
    return {
      id: toStringValue(record.id, `${profile.countryCode}-financial-${index}`),
      name: toStringValue(record.name, toStringValue(record.symbol, 'Unnamed')),
      value: toNumber(record.value) ?? 0,
      changePct: toNumber(record.changePct ?? record.change_percent),
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

function ThreatBadge({ level }: { level: string }) {
  const style = THREAT_STYLES[level] ?? THREAT_STYLES.STABLE
  return (
    <Badge variant="outline" className="text-[10px] font-bold" style={{ background: style.bg, color: style.text, borderColor: `${style.text}22` }}>
      {level}
    </Badge>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.LOW
  return (
    <Badge variant="outline" className="text-[10px] font-semibold" style={{ background: style.bg, color: style.text, borderColor: `${style.text}22` }}>
      {severity}
    </Badge>
  )
}

function CountryIntelSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-3"><SkeletonBlock className="h-4 w-28" /></CardHeader>
        <CardContent className="space-y-3 p-0">
          {Array.from({ length: 8 }, (_, i) => <SkeletonBlock key={i} className="h-11 w-full" />)}
        </CardContent>
      </Card>
      <div className="space-y-6 lg:col-span-3">
        <Card><CardContent className="p-6"><SkeletonBlock className="h-7 w-52" /></CardContent></Card>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i}><CardContent className="p-5"><SkeletonBlock className="h-64 w-full" /></CardContent></Card>
          ))}
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
  const effectiveCountryCode = selectedCountryCode || countries[0]?.countryCode || ''

  const countryQuery = useQuery({
    queryKey: ['country-intel', effectiveCountryCode],
    queryFn: ({ signal }) => getCountry(effectiveCountryCode, signal),
    enabled: effectiveCountryCode.length > 0,
    refetchInterval: 60_000,
  })

  const filteredCountries = search
    ? countries.filter((c) => c.countryName.toLowerCase().includes(search.toLowerCase()) || c.countryCode.toLowerCase().includes(search.toLowerCase()))
    : countries

  const selectedCountry = countries.find((c) => c.countryCode === effectiveCountryCode) ?? countries[0]
  const profile = countryQuery.data
  const trend = profile ? deriveTrend(profile) : 'stable'
  const TrendIcon = TREND_ICON[trend]
  const threatLevel = profile?.threatLevel ?? selectedCountry?.threatLevel ?? 'STABLE'
  const categoryScores = profile ? normalizeCategoryScores(profile) : []
  const gseHistory = profile ? normalizeHistory(profile) : []
  const financialIndicators = profile ? normalizeFinancialIndicators(profile) : []
  const activeEvents = profile ? normalizeEvents(profile) : []

  const handleRetry = () => {
    void countriesQuery.refetch()
    if (effectiveCountryCode) void countryQuery.refetch()
  }

  const isInitialLoading = countriesQuery.isLoading || (effectiveCountryCode.length > 0 && countryQuery.isLoading && !profile)

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Globe className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Country Intelligence</h1>
        </div>
        <div className="relative w-60">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search country..."
            aria-label="Search countries"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {(countriesQuery.isError || countryQuery.isError) && (
        <PageErrorBanner title="Country intelligence refresh failed" message="The page is retrying automatically." onRetry={handleRetry} />
      )}

      {isInitialLoading ? (
        <CountryIntelSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Country sidebar */}
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Countries by Risk</p>
            </CardHeader>
            <Separator />
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="p-1">
                {filteredCountries.map((country) => {
                  const active = effectiveCountryCode === country.countryCode
                  return (
                    <button
                      key={country.countryCode}
                      type="button"
                      onClick={() => { setSelectedCountryCode(country.countryCode); setSearch('') }}
                      className={cn(
                        'w-full rounded-md px-3 py-2.5 text-sm transition-all text-left',
                        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="w-6 text-[10px] font-bold font-mono text-muted-foreground">{country.countryCode}</span>
                          <span className={cn('truncate', active ? 'font-medium' : '')}>{country.countryName}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-bold">{country.gseScore.toFixed(0)}</Badge>
                      </div>
                    </button>
                  )
                })}
                {filteredCountries.length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted-foreground">No countries matched your search.</p>
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Main content */}
          <div className="space-y-6 lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{profile?.countryName ?? selectedCountry?.countryName ?? 'Country'}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Region: {formatRegionLabel(profile?.regionId ?? selectedCountry?.regionId ?? 'unknown')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-3xl font-bold',
                        profile && profile.gseScore >= 60 ? 'gradient-text-rose' : profile && profile.gseScore >= 30 ? 'gradient-text-amber' : 'gradient-text-emerald',
                      )}>
                        {(profile?.gseScore ?? selectedCountry?.gseScore ?? 0).toFixed(1)}
                      </span>
                      <TrendIcon className={cn('h-5 w-5', trend === 'up' ? 'text-rose-400' : trend === 'down' ? 'text-emerald-400' : 'text-slate-500')} />
                    </div>
                    <ThreatBadge level={threatLevel} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Risk Category Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={categoryScores} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="var(--border-subtle)" />
                      <PolarAngleAxis dataKey="category" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 8 }} />
                      <Radar name="Risk" dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">GSE Trend (30 days)</CardTitle></CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Economic Indicators</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {financialIndicators.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-muted-foreground">No financial indicators returned for this country.</p>
                  ) : (
                    <Table>
                      <TableBody>
                        {financialIndicators.map((indicator, index) => {
                          const isUp = (indicator.changePct ?? 0) >= 0
                          return (
                            <TableRow key={indicator.id}>
                              <TableCell className="font-medium">{indicator.name}</TableCell>
                              <TableCell className="text-right font-mono">{indicator.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right w-28">
                                <span className={cn('flex items-center justify-end gap-0.5 text-xs font-semibold', isUp ? 'text-emerald-400' : 'text-rose-400')}>
                                  {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                  {indicator.changePct === null ? 'n/a' : `${isUp ? '+' : ''}${indicator.changePct.toFixed(2)}%`}
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Active Events</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {activeEvents.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-muted-foreground">No active events returned for this country.</p>
                  ) : (
                    <Table>
                      <TableBody>
                        {activeEvents.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <AlertTriangle className={cn('h-4 w-4 shrink-0', event.severity === 'CRITICAL' ? 'text-rose-400' : event.severity === 'HIGH' ? 'text-orange-400' : 'text-yellow-400')} />
                                <span className="font-medium">{event.type}</span>
                                <SeverityBadge severity={event.severity} />
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {new Date(event.timestamp).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-sm">Country Comparison</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Country</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>GSE Score</TableHead>
                      <TableHead>Threat Level</TableHead>
                      <TableHead>Events</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {countries.map((country: CountrySummaryResponse) => (
                      <TableRow key={country.countryCode}>
                        <TableCell className="font-medium">{country.countryName}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{formatRegionLabel(country.regionId)}</TableCell>
                        <TableCell className="font-mono font-semibold">{country.gseScore.toFixed(1)}</TableCell>
                        <TableCell><ThreatBadge level={country.threatLevel} /></TableCell>
                        <TableCell className="text-muted-foreground">{country.eventCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </motion.div>
  )
}
