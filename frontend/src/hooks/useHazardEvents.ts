import { useQuery } from '@tanstack/react-query'
import { fetchObjects } from '../lib/api-client'
import { mockHazardEvents } from '../lib/mock-data'
import type { HazardEvent } from '../lib/types'

export function useHazardEvents() {
  return useQuery({
    queryKey: ['hazardEvents'],
    queryFn: () => fetchObjects('HazardEvent') as Promise<unknown> as Promise<HazardEvent[]>,
    placeholderData: () => mockHazardEvents,
    retry: false,
  })
}
