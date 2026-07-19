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
  const pendingKeys = useRef(new Set<string>())

  useEffect(() => {
    const source = new EventSource('/api/events?cursor=0')
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    source.onmessage = (message) => {
      let keys: string[]
      try {
        const event = JSON.parse(message.data) as { event_type?: string }
        const type = event.event_type ?? ''
        if (type.startsWith('resume.')) {
          keys = ['resumes', 'draft', 'facts', 'stories', 'questions']
        } else if (type.startsWith('profile.fact.')) {
          keys = ['facts', 'draft', 'questions']
        } else if (type.startsWith('profile.story.')) {
          keys = ['stories', 'draft']
        } else if (type.startsWith('onboarding.')) {
          keys = ['questions', 'facts']
        } else {
          keys = ['resumes', 'draft', 'facts', 'stories', 'questions']
        }
      } catch {
        keys = ['resumes', 'draft', 'facts', 'stories', 'questions']
      }
      keys.forEach((key) => pendingKeys.current.add(key))
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        for (const key of pendingKeys.current) {
          queryClient.invalidateQueries({ queryKey: [key] })
        }
        pendingKeys.current.clear()
      }, 400)
    }
    return () => {
      window.clearTimeout(timer.current)
      source.close()
    }
  }, [queryClient])

  return connected
}
