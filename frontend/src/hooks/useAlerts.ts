import { useQuery } from '@tanstack/react-query'
import { fetchObjects } from '../lib/api-client'
import type { Alert } from '../lib/types'

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchObjects<Alert>('Alert'),
    retry: false,
  })
}
