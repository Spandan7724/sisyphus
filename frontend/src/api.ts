// Typed client for the job-appli API.

export interface Fact {
  id: string
  section: string
  key: string
  value: { text?: string } & Record<string, unknown>
  sensitivity: string
  reuse_permitted: boolean
  source_type: string
  confidence: number | null
  confirmed: boolean
}

export interface DraftFact {
  id: string
  section: string
  key: string
  value: { text?: string } & Record<string, unknown>
  confidence: number | null
  confirmed: boolean
  evidence: string | null
}

export interface DraftStory {
  id: string
  title: string
  confirmed: boolean
}

export interface Draft {
  facts: DraftFact[]
  stories: DraftStory[]
}

export interface Story {
  id: string
  title: string
  context: string | null
  problem: string | null
  role: string | null
  decisions: string | null
  actions: string | null
  obstacles: string | null
  result: string | null
  learned: string | null
  motivation: string | null
  skills: string[]
  themes: string[]
  source_type: string
  confirmed: boolean
}

export interface ResumeItem {
  id: string
  label: string
  is_default: boolean
  artifact_id: string
}

export interface Question {
  section: string
  key: string
  question: string
  sensitivity: string
  optional: boolean
  origin: 'checklist' | 'generated'
  rationale: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  resumes: () => request<ResumeItem[]>('/api/resumes'),
  uploadResume: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ resume_id: string; fact_count: number; story_count: number }>(
      '/api/resumes',
      { method: 'POST', body: form },
    )
  },
  draft: (resumeId: string) => request<Draft>(`/api/resumes/${resumeId}/draft`),

  facts: () => request<Fact[]>('/api/profile/facts'),
  createFact: (body: object) => request<Fact>('/api/profile/facts', json(body)),
  updateFact: (id: string, body: object) =>
    request<Fact>(`/api/profile/facts/${id}`, { ...json(body), method: 'PUT' }),
  confirmFact: (id: string, value?: object) =>
    request<Fact>(`/api/profile/facts/${id}/confirm`, json(value ?? null)),
  deleteFact: (id: string) =>
    request<{ deleted: string }>(`/api/profile/facts/${id}`, { method: 'DELETE' }),

  stories: () => request<Story[]>('/api/profile/stories'),
  confirmStory: (id: string) =>
    request<Story>(`/api/profile/stories/${id}/confirm`, { method: 'POST' }),

  nextQuestions: (limit = 50) => request<Question[]>(`/api/onboarding/next?limit=${limit}`),
  generateQuestions: () =>
    request<Question[]>('/api/onboarding/generate', { method: 'POST' }),
  answer: (body: { section: string; key: string; value?: object; skip?: boolean }) =>
    request<{ fact_id: string | null; remaining: number }>(
      '/api/onboarding/answer',
      json(body),
    ),
}
