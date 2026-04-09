import type { PipelineExecution } from './types'

const DEFAULT_API_URL = 'http://localhost:8000'

type QueryValue = string | number | boolean | null | undefined
type QueryArrayValue = QueryValue | QueryValue[]
type QueryParams = Record<string, QueryArrayValue>

export class ApiError extends Error {
  status: number
  detail: unknown
  url: string

  constructor(message: string, status: number, detail: unknown, url: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.url = url
  }
}

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim()
  return (trimmed && trimmed.length > 0 ? trimmed : DEFAULT_API_URL).replace(/\/+$/, '')
}

function resolveBaseUrl() {
  return normalizeBaseUrl(import.meta.env.VITE_API_URL)
}

function buildUrl(path: string, params?: QueryParams) {
  const baseUrl = resolveBaseUrl()
  const base = baseUrl.startsWith('http://') || baseUrl.startsWith('https://')
    ? new URL(baseUrl)
    : new URL(baseUrl, window.location.origin)
  const url = new URL(path.startsWith('/') ? path : `/${path}`, `${base.toString()}/`)

  if (params) {
    for (const [key, rawValue] of Object.entries(params)) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue]
      for (const value of values) {
        if (value === null || value === undefined || value === '') continue
        url.searchParams.append(key, String(value))
      }
    }
  }

  return url
}

type RequestOptions = {
  method?: 'GET' | 'POST'
  params?: QueryParams
  body?: unknown
  headers?: HeadersInit
  parseAs?: 'json' | 'text'
  signal?: AbortSignal
}

interface ObjectCollectionResponse<T> {
  data?: T[]
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    params,
    body,
    headers,
    parseAs = 'json',
    signal,
  } = options

  const url = buildUrl(path, params)
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false
  const payload = parseAs === 'text'
    ? await response.text()
    : isJson
      ? await response.json().catch(() => null)
      : await response.text()

  if (!response.ok) {
    const detail =
      typeof payload === 'object' && payload !== null && 'detail' in payload
        ? payload.detail
        : payload
    const message = typeof detail === 'string'
      ? detail
      : `Request failed: ${response.status} ${response.statusText}`
    throw new ApiError(message, response.status, detail, url.toString())
  }

  return payload as T
}

export function getApiBaseUrl() {
  return resolveBaseUrl()
}

export function getAlertsWebSocketUrl() {
  const url = buildUrl('/ws/alerts')
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.search = ''
  return url.toString()
}

export interface HealthResponse {
  status: string
  agents: string[]
  version: string
}

export interface AiStatusResponse {
  llm: {
    available: boolean
    model: string
    base_url: string
    stats: Record<string, unknown>
  }
  features: {
    llm_classification: boolean
    anomaly_detection: boolean
    auto_mapping: boolean
  }
  quality_thresholds: {
    min_completeness: number
    min_overall_quality: number
    duplicate_similarity_threshold: number
  }
}

export interface GseContributingFactor {
  category: string
  eventCount: number
  pressure: number
  weight: number
  weightedPressure?: number
}

export interface GseRegionSummaryResponse {
  regionId: string
  gseScore: number
  threatLevel: string
  eventCount: number
  escalationAlert: boolean
  contributingFactors: GseContributingFactor[]
}

export interface GseHistoryPoint {
  timestamp: string
  gse_score: number
}

export interface GseRegionDetailResponse extends GseRegionSummaryResponse {
  history: GseHistoryPoint[]
}

export interface GsePatternResponse {
  type: string
  description: string
  severity: string
  regionId: string | null
  categories: string[]
  confidence: number
}

export interface BriefingSectionResponse {
  title: string
  content: string
  priority: number
}

export interface BriefingResponse {
  title: string
  briefingType: string
  generatedAt: string
  classification: string
  regionId: string | null
  timeWindow: string
  sections: BriefingSectionResponse[]
}

export interface BriefingMarkdownResponse {
  markdown: string
}

export interface CountrySummaryResponse {
  countryCode: string
  countryName: string
  regionId: string
  gseScore: number
  threatLevel: string
  eventCount: number
}

export interface CountryCategoryScore {
  pressure: number
  weight: number
  eventCount: number
  score: number
}

export interface CountryPattern {
  type: string
  description: string
  severity: string
  confidence: number
}

export interface CountryIntelResponse {
  countryCode: string
  countryName: string
  regionId: string
  coordinates: [number, number]
  gseScore: number
  threatLevel: string
  escalationAlert: boolean
  eventCount: number
  categories: Record<string, CountryCategoryScore>
  gseHistory: GseHistoryPoint[]
  patterns: CountryPattern[]
  financialIndicators: Array<Record<string, unknown>>
  activeEvents: Array<Record<string, unknown>>
}

export interface GeoJsonGeometry {
  type: string
  coordinates?: unknown
}

export interface AwarenessFeature<TProperties extends Record<string, unknown> = Record<string, unknown>> {
  type: 'Feature'
  geometry: GeoJsonGeometry | null
  properties: TProperties & { entityType?: string }
}

export interface AwarenessResponse {
  type: 'FeatureCollection'
  features: AwarenessFeature[]
  metadata: {
    totalFeatures: number
    entityTypes: string[]
    bbox: [number, number, number, number] | null
  }
}

export interface AwarenessQueryParams {
  min_lat?: number
  min_lng?: number
  max_lat?: number
  max_lng?: number
  entity_types?: string[]
}

export interface PendingAlertResponse {
  alertId: string
  rule: string
  priority: string
  title: string
  message: string
  regionId: string
  timestamp: string
}

export interface AlertHistoryResponse extends PendingAlertResponse {
  acknowledged: boolean
}

export interface AcknowledgeAlertResponse {
  acknowledged: boolean
  alertId: string
}

export interface ChatRequest {
  message: string
  context?: Record<string, unknown>
}

export interface ChatResponse {
  response: string
  agent: string
  tools_used: string[]
}

export interface AlertSocketPayload extends PendingAlertResponse {
  metadata?: Record<string, unknown>
}

export interface AlertSocketMessage {
  type: 'alert'
  data: AlertSocketPayload
}

export function getHealth(signal?: AbortSignal) {
  return request<HealthResponse>('/health', { signal })
}

export function getAiStatus(signal?: AbortSignal) {
  return request<AiStatusResponse>('/ai/status', { signal })
}

export function getGseRegions(signal?: AbortSignal) {
  return request<GseRegionSummaryResponse[]>('/gse/regions', { signal })
}

export function getGseRegion(regionId: string, signal?: AbortSignal) {
  return request<GseRegionDetailResponse>(`/gse/region/${encodeURIComponent(regionId)}`, { signal })
}

export function getGsePatterns(regionId?: string, signal?: AbortSignal) {
  return request<GsePatternResponse[]>('/gse/patterns', {
    params: regionId ? { region_id: regionId } : undefined,
    signal,
  })
}

export function getDailyBriefing(signal?: AbortSignal) {
  return request<BriefingResponse>('/briefing/daily', { signal })
}

export function getSitrep(regionId: string, timeWindow = '24h', signal?: AbortSignal) {
  return request<BriefingResponse>(`/briefing/sitrep/${encodeURIComponent(regionId)}`, {
    params: { time_window: timeWindow },
    signal,
  })
}

export function getThreatAdvisory(regionId: string, signal?: AbortSignal) {
  return request<BriefingResponse>(`/briefing/threat/${encodeURIComponent(regionId)}`, { signal })
}

export function getDailyBriefingMarkdown(signal?: AbortSignal) {
  return request<BriefingMarkdownResponse>('/briefing/daily/markdown', { signal })
}

export function getDailyBriefingHtml(signal?: AbortSignal) {
  return request<string>('/briefing/daily/html', { parseAs: 'text', signal })
}

export function getCountry(code: string, signal?: AbortSignal) {
  return request<CountryIntelResponse>(`/country/${encodeURIComponent(code)}`, { signal })
}

export function getCountries(signal?: AbortSignal) {
  return request<CountrySummaryResponse[]>('/countries', { signal })
}

export function getFusionAwareness(params?: AwarenessQueryParams, signal?: AbortSignal) {
  const normalizedParams = params
    ? {
        ...params,
        entity_types: params.entity_types?.join(','),
      }
    : undefined
  return request<AwarenessResponse>('/fusion/awareness', { params: normalizedParams, signal })
}

export function getPendingAlerts(signal?: AbortSignal) {
  return request<PendingAlertResponse[]>('/alerts/pending', { signal })
}

export function getAlertsPending(signal?: AbortSignal) {
  return getPendingAlerts(signal)
}

export function getPipelineExecutions(signal?: AbortSignal) {
  return request<ObjectCollectionResponse<PipelineExecution>>('/api/v1/objects', {
    params: {
      objectType: 'PipelineExecution',
      pageSize: 100,
    },
    signal,
  }).then((response) => response.data ?? [])
}

export function getAlertHistory(limit?: number, signal?: AbortSignal) {
  return request<AlertHistoryResponse[]>('/alerts/history', {
    params: limit ? { limit } : undefined,
    signal,
  })
}

export function acknowledgeAlert(alertId: string, signal?: AbortSignal) {
  return request<AcknowledgeAlertResponse>(`/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
    method: 'POST',
    signal,
  })
}

export function sendChat(body: ChatRequest, signal?: AbortSignal) {
  return request<ChatResponse>('/chat', {
    method: 'POST',
    body,
    signal,
  })
}
