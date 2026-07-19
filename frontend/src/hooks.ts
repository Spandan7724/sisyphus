// Query hooks and the live event stream that keeps them fresh.

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

export const useResumes = () => useQuery({ queryKey: ['resumes'], queryFn: api.resumes })
export const useDraft = (resumeId: string | null) =>
  useQuery({
    queryKey: ['draft', resumeId],
    queryFn: () => api.draft(resumeId!),
    enabled: !!resumeId,
  })
export const useFacts = () => useQuery({ queryKey: ['facts'], queryFn: api.facts })
export const useStories = () => useQuery({ queryKey: ['stories'], queryFn: api.stories })
export const useQuestions = () =>
  useQuery({ queryKey: ['questions'], queryFn: () => api.nextQuestions(50) })

export function useLiveEvents(): boolean {
  const [connected, setConnected] = useState(false)
  const queryClient = useQueryClient()
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const source = new EventSource('/api/events?cursor=0')
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        queryClient.invalidateQueries()
      }, 400)
    }
    return () => {
      window.clearTimeout(timer.current)
      source.close()
    }
  }, [queryClient])

  return connected
}
