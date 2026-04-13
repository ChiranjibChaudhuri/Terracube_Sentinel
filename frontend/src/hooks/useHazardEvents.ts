import { useQuery } from '@tanstack/react-query'
import { fetchObjects } from '../lib/api-client'
import type { HazardEvent } from '../lib/types'

export function useHazardEvents() {
  return useQuery({
    queryKey: ['hazardEvents'],
    queryFn: () => fetchObjects<HazardEvent>('HazardEvent'),
    retry: false,
  })
}
