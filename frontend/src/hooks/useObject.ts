import { useQuery } from '@tanstack/react-query'
import { fetchObject } from '../lib/api-client'

export function useObject(objectId: string) {
  return useQuery({
    queryKey: ['object', objectId],
    queryFn: () => fetchObject(objectId),
    enabled: !!objectId,
  })
}
