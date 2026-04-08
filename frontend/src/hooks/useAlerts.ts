import { useQuery } from '@tanstack/react-query'
import { fetchObjects } from '../lib/api-client'
import { mockAlerts } from '../lib/mock-data'
import type { Alert } from '../lib/types'

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchObjects('Alert') as Promise<unknown> as Promise<Alert[]>,
    placeholderData: () => mockAlerts,
    retry: false,
  })
}
