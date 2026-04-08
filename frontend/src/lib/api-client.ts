const GRAPHQL_URL = '/graphql'
const API_URL = '/api/v1'

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

export async function query<T = unknown>(
  gql: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      params.set(k, String(v))
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
