import { useQuery } from '@tanstack/react-query'
import { fetchObjects } from '../lib/api-client'
import { mockPipelineExecutions } from '../lib/mock-data'
import type { PipelineExecution } from '../lib/types'

export function usePipelines() {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: () => fetchObjects('PipelineExecution') as Promise<unknown> as Promise<PipelineExecution[]>,
    placeholderData: () => mockPipelineExecutions,
    retry: false,
  })
}
