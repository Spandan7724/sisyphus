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

export class ApiError extends Error {
  status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function messageForStatus(status: number): string {
  if (status === 400 || status === 422) {
    return "That information couldn't be accepted. Check it and try again."
  }
  if (status === 401) return 'Your session has ended. Refresh the page and try again.'
  if (status === 403) return "You don't have permission to make that change."
  if (status === 404) return "That item couldn't be found. It may have changed elsewhere."
  if (status === 409) return 'This changed elsewhere before your update finished. Refresh and try again.'
  if (status === 413) return 'That file is too large. Choose a smaller PDF or DOCX file.'
  if (status === 415) return 'That file type is not supported. Choose a PDF or DOCX file.'
  if (status === 429) return 'The service is busy right now. Wait a moment, then try again.'
  if (status >= 500) return "The service couldn't finish that request. Try again in a moment."
  return "That request couldn't be completed. Try again."
}

export function getErrorMessage(
  error: unknown,
  fallback = "That didn't work. Try again.",
): string {
  return error instanceof Error && error.message ? error.message : fallback
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiError("We couldn't reach the service. Check your connection and try again.")
  }
  if (!res.ok) {
    throw new ApiError(messageForStatus(res.status), res.status)
  }
  try {
    return (await res.json()) as T
  } catch {
    throw new ApiError("The service returned an unreadable response. Refresh and try again.")
  }
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
