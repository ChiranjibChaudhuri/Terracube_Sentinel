const GRAPHQL_URL = '/graphql'
const API_URL = '/api/v1'

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('foundry_token')
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export async function query<T = unknown>(
  gql: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ query: gql, variables }),
  })
  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}`)
  }
  const json: GraphQLResponse<T> = await res.json()
  if (json.errors?.length) throw new Error(json.errors[0].message)
  if (json.data === undefined) throw new Error('No data returned from GraphQL query')
  return json.data
}

export async function mutate<T = unknown>(
  gql: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return query<T>(gql, variables)
}

export async function fetchObjects(
  objectType: string,
  filters?: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ objectType })
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v != null) {
        params.set(k, String(v))
      }
    }
  }
  const res = await fetch(`${API_URL}/objects?${params}`)
  if (!res.ok) {
    throw new Error(`Fetch objects failed: ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  return json.data ?? []
}

export async function fetchObject(objectId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}/objects/${objectId}`)
  if (!res.ok) {
    throw new Error(`Fetch object failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// ── Agents API (proxied via /agents or direct to :8001) ──────────────

const AGENTS_URL = '/agents'

export async function fetchGSERegions(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${AGENTS_URL}/gse/regions`)
  if (!res.ok) throw new Error(`GSE regions fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchPendingAlerts(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${AGENTS_URL}/alerts/pending`)
  if (!res.ok) throw new Error(`Pending alerts fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchDailyBriefing(): Promise<Record<string, unknown>> {
  const res = await fetch(`${AGENTS_URL}/briefing/daily`)
  if (!res.ok) throw new Error(`Daily briefing fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchCountryIntel(code: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${AGENTS_URL}/country/${encodeURIComponent(code)}`)
  if (!res.ok) throw new Error(`Country intel fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchAIStatus(): Promise<Record<string, unknown>> {
  const res = await fetch(`${AGENTS_URL}/ai/status`)
  if (!res.ok) throw new Error(`AI status fetch failed: ${res.status}`)
  return res.json()
}
