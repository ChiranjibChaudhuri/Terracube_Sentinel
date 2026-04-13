import { useQuery } from '@tanstack/react-query'
import { fetchObjects } from '../lib/api-client'

export function useObjects(objectType: string, filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['objects', objectType, filters],
    queryFn: () => fetchObjects(objectType, filters),
    retry: false,
  })
}
