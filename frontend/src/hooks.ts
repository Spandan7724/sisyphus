// Query hooks and the live event stream that keeps them fresh.

import { createContext, useContext, useEffect, useRef, useState } from 'react'
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

export type UploadStep = 'reading' | 'interpreting' | 'saving'

export type LiveEvent = {
  event_type: string
  actor: string
  reason: string | null
  aggregate_type: string
  aggregate_id: string
  workflow_id: string | null
  created_at?: string
  transient?: boolean
  payload?: { step?: UploadStep; [key: string]: unknown } | null
}

export type LiveStream = {
  connected: boolean
  latest: LiveEvent | null
  uploadStep: UploadStep | null
}

export const LiveContext = createContext<LiveStream>({
  connected: false,
  latest: null,
  uploadStep: null,
})

export const useLive = () => useContext(LiveContext)

export function useLiveEvents(): LiveStream {
  const [connected, setConnected] = useState(false)
  const [latest, setLatest] = useState<LiveEvent | null>(null)
  const [uploadStep, setUploadStep] = useState<UploadStep | null>(null)
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
        const event = JSON.parse(message.data) as LiveEvent
        setLatest(event)
        const type = event.event_type ?? ''
        // Progress is in-flight UI signal: show it, but nothing has changed to refetch.
        if (event.transient) {
          if (type === 'resume.progress') setUploadStep(event.payload?.step ?? null)
          return
        }
        if (type === 'resume.ingested') setUploadStep(null)
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

  return { connected, latest, uploadStep }
}
