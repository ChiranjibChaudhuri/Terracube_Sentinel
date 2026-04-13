import { useQuery } from '@tanstack/react-query'
import { fetchObjects } from '../lib/api-client'
import type { PipelineExecution } from '../lib/types'

export function usePipelines() {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: () => fetchObjects<PipelineExecution>('PipelineExecution'),
    retry: false,
  })
}
