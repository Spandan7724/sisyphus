// Resume upload and draft review: confirm, edit, or discard extracted facts.

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, FileUp, Quote, Trash2 } from 'lucide-react'
import {
  api,
  getErrorMessage,
  type Draft,
  type DraftFact,
  type Fact,
  type Question,
} from '../api'
import { useDraft, useLive, useResumes, useStories, type UploadStep } from '../hooks'
import { factLabel, sectionLabel } from '../presentation'
import { StoryCard } from '../components/story'
import {
  Button,
  Card,
  Confidence,
  EmptyState,
  InlineError,
  QueryError,
  SectionHeading,
  SkeletonRows,
} from '../components/ui'
import { useOverflowTip } from '../components/overflow-tip'

function invalidateResumeData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['resumes'] })
  queryClient.invalidateQueries({ queryKey: ['draft'] })
  queryClient.invalidateQueries({ queryKey: ['facts'] })
  queryClient.invalidateQueries({ queryKey: ['stories'] })
  queryClient.invalidateQueries({ queryKey: ['questions'] })
}

const UPLOAD_STEPS: { id: UploadStep; label: string }[] = [
  { id: 'reading', label: 'Reading the file' },
  { id: 'interpreting', label: 'Interpreting your career history' },
  { id: 'saving', label: 'Drafting facts and stories' },
]

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const total = Math.max(0, Math.round((now - since) / 1000))
  return (
    <span className="font-mono tabular-nums">
      {Math.floor(total / 60)}:{String(total % 60).padStart(2, '0')}
    </span>
  )
}

// Stages come from the agent's own progress events, so nothing here is invented.
function UploadProgress({ compact = false, startedAt }: { compact?: boolean; startedAt: number }) {
  const { uploadStep, latest } = useLive()
  const reached = uploadStep ? UPLOAD_STEPS.findIndex((step) => step.id === uploadStep) : 0
  const detail = latest?.event_type === 'resume.progress' ? latest.reason : null

  if (compact) {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-2 text-[13px] text-ink">
        <FileUp className="h-4 w-4 shrink-0 text-work" aria-hidden="true" />
        <span>{UPLOAD_STEPS[Math.max(reached, 0)].label}…</span>
        <span className="text-[11.5px] text-ink-3">
          <Elapsed since={startedAt} />
        </span>
      </div>
    )
  }

  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-sm text-left">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <span className="text-[13px] font-medium text-ink">Reading your resume</span>
        <span className="text-[11.5px] text-ink-3">
          <Elapsed since={startedAt} />
        </span>
      </div>

      <ol className="mt-3 flex flex-col gap-2.5">
        {UPLOAD_STEPS.map((step, index) => {
          const done = index < reached
          const active = index === reached
          return (
            <li key={step.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden="true">
                {done ? (
                  <Check className="h-3.5 w-3.5 text-work" strokeWidth={2.5} />
                ) : active ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-work motion-safe:animate-pulse" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-line" />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[12.5px] leading-snug ${
                    done ? 'text-ink-3' : active ? 'text-ink' : 'text-ink-3'
                  }`}
                >
                  {step.label}
                </span>
                {active && detail && (
                  <span className="mt-0.5 block font-mono text-[11px] leading-snug text-ink-3">
                    {detail}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>

      <p className="mt-3 border-t border-line pt-2 text-[11.5px] leading-relaxed text-ink-3">
        Interpreting takes the longest. Nothing is saved to your profile until you confirm it.
      </p>
    </div>
  )
}

function UploadCard() {
  const input = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const upload = useMutation({
    mutationFn: api.uploadResume,
    onSuccess: () => invalidateResumeData(queryClient),
  })

  return (
    <Card className="p-6 text-center sm:p-10">
      {upload.isPending ? (
        <UploadProgress startedAt={upload.submittedAt} />
      ) : (
        <div className="space-y-4">
          <FileUp className="mx-auto h-8 w-8 text-ink-3" strokeWidth={1.25} aria-hidden="true" />
          <div>
            <p className="text-xl">Start with your resume</p>
            <p className="mt-1 text-[13px] text-ink-3">
              Choose a PDF or DOCX. Every extracted detail stays a draft until you confirm it.
            </p>
          </div>
          <Button onClick={() => input.current?.click()}>Choose resume</Button>
          <InlineError
            message={
              upload.isError
                ? `We couldn't read that resume. ${getErrorMessage(upload.error)}`
                : undefined
            }
          />
          <input
            ref={input}
            type="file"
            accept=".pdf,.docx"
            hidden
            aria-label="Choose a resume to upload"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) upload.mutate(file)
              event.currentTarget.value = ''
            }}
          />
        </div>
      )}
    </Card>
  )
}

function NewResumeButton() {
  const input = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const upload = useMutation({
    mutationFn: api.uploadResume,
    onSuccess: () => invalidateResumeData(queryClient),
  })
  return (
    <div className="flex flex-col items-end gap-1.5">
      {upload.isPending ? (
        <UploadProgress compact startedAt={upload.submittedAt} />
      ) : (
        <Button variant="ghost" onClick={() => input.current?.click()}>
          <FileUp className="h-3.5 w-3.5" aria-hidden="true" /> New resume
        </Button>
      )}
      <InlineError
        message={
          upload.isError ? `We couldn't read that resume. ${getErrorMessage(upload.error)}` : undefined
        }
      />
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx"
        hidden
        aria-label="Choose a new resume to upload"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) upload.mutate(file)
          event.currentTarget.value = ''
        }}
      />
    </div>
  )
}

function FactRow({
  fact,
  confirmError,
  onConfirmError,
}: {
  fact: DraftFact
  confirmError?: string
  onConfirmError: (message: string | null) => void
}) {
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion()
  const serverText = useRef(fact.value.text ?? '')
  const discardTimer = useRef<number | undefined>(undefined)
  const [text, setText] = useState(serverText.current)
  const [showEvidence, setShowEvidence] = useState(false)
  const tip = useOverflowTip<HTMLInputElement>(text)
  const [discardQueued, setDiscardQueued] = useState(false)
  const edited = text !== serverText.current
  const label = factLabel(fact.key)

  useEffect(() => {
    const incoming = fact.value.text ?? ''
    setText((current) => (current === serverText.current ? incoming : current))
    serverText.current = incoming
  }, [fact.id, fact.value.text])

  const confirm = useMutation({
    mutationFn: () => api.confirmFact(fact.id, edited ? { text: text.trim() } : undefined),
    onMutate: async () => {
      onConfirmError(null)
      await queryClient.cancelQueries({ queryKey: ['draft'] })
      const drafts = queryClient.getQueriesData<Draft>({ queryKey: ['draft'] })
      const optimisticValue = edited ? { text: text.trim() } : fact.value
      queryClient.setQueriesData<Draft>({ queryKey: ['draft'] }, (current) =>
        current
          ? {
              ...current,
              facts: current.facts.map((candidate) =>
                candidate.id === fact.id
                  ? { ...candidate, value: optimisticValue, confirmed: true }
                  : candidate,
              ),
            }
          : current,
      )
      return { drafts }
    },
    onSuccess: (confirmedFact) => {
      queryClient.setQueriesData<Draft>({ queryKey: ['draft'] }, (current) =>
        current
          ? {
              ...current,
              facts: current.facts.map((candidate) =>
                candidate.id === confirmedFact.id
                  ? { ...candidate, value: confirmedFact.value, confirmed: true }
                  : candidate,
              ),
            }
          : current,
      )
      queryClient.setQueryData<Fact[]>(['facts'], (current) =>
        current?.map((candidate) =>
          candidate.id === confirmedFact.id ? confirmedFact : candidate,
        ),
      )
      queryClient.setQueryData<Question[]>(['questions'], (current) =>
        current?.filter(
          (question) =>
            question.section !== confirmedFact.section || question.key !== confirmedFact.key,
        ),
      )
    },
    onError: (error, _variables, context) => {
      for (const [queryKey, data] of context?.drafts ?? []) {
        queryClient.setQueryData(queryKey, data)
      }
      onConfirmError(`“${label}” wasn't confirmed. ${getErrorMessage(error)}`)
    },
  })
  const discard = useMutation({
    mutationFn: () => api.deleteFact(fact.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft'] })
      queryClient.invalidateQueries({ queryKey: ['facts'] })
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
    onError: () => setDiscardQueued(false),
  })
  const lowConfidence = (fact.confidence ?? 1) < 0.8

  const queueDiscard = () => {
    if (discardQueued || discard.isPending) return
    discard.reset()
    setDiscardQueued(true)
    discardTimer.current = window.setTimeout(() => discard.mutate(), 5000)
  }

  const undoDiscard = () => {
    window.clearTimeout(discardTimer.current)
    setDiscardQueued(false)
  }

  if (discardQueued) {
    return (
      <motion.div
        layout
        initial={reduceMotion ? false : { opacity: 0.7 }}
        animate={{ opacity: 1 }}
        className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-fail-soft/45 px-4 py-2.5 last:border-b-0"
        role="status"
        aria-live="polite"
      >
        <span className="text-[13px] text-ink">Discarded “{label}”.</span>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-ink-3">Deleting in 5 seconds</span>
          <Button variant="quiet" onClick={undoDiscard}>Undo</Button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout={!reduceMotion}
      exit={reduceMotion ? undefined : { opacity: 0, x: 16, transition: { duration: 0.12 } }}
      className={`group border-b border-line px-4 py-3 transition-colors last:border-b-0 ${lowConfidence ? 'bg-draft-soft/40 hover:bg-draft-soft/65' : 'hover:bg-panel/45'}`}
    >
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
        <div className="w-full min-w-0 text-[13px] text-ink-3 sm:w-36 sm:shrink-0" title={label}>
          {label}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
          <input
            {...tip.triggerProps}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && text.trim() && !confirm.isPending) {
                event.preventDefault()
                confirm.mutate()
              }
            }}
            aria-label={`${label} value`}
            className="min-w-0 basis-full rounded-md border border-transparent bg-transparent px-2 py-1 text-[13.5px] font-medium outline-none focus-visible:border-work-mark focus-visible:bg-ground focus-visible:ring-1 focus-visible:ring-work-mark/30 sm:basis-auto sm:flex-1"
          />
          {tip.tip}
          <Confidence value={fact.confidence} />
          {fact.evidence && (
            <button
              type="button"
              onClick={() => setShowEvidence((visible) => !visible)}
              className={`cursor-pointer rounded-md p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-work-mark/30 ${showEvidence ? 'bg-done-soft text-done' : 'text-ink-3 hover:bg-panel hover:text-ink'}`}
              aria-label={`${showEvidence ? 'Hide' : 'Show'} resume evidence for ${label}`}
              aria-expanded={showEvidence}
            >
              <Quote className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="danger"
              className="!px-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
              onClick={queueDiscard}
              aria-label={`Discard ${label}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="confirm"
              className="!px-2.5 !text-[12px]"
              onClick={() => confirm.mutate()}
              disabled={!text.trim() || confirm.isPending}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {confirm.isPending ? 'Confirming…' : edited ? 'Confirm edit' : 'Confirm'}
            </Button>
          </div>
        </div>
      </div>
      {tip.inline}
      {showEvidence && fact.evidence && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-panel px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink-3">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-done" aria-hidden="true" />
          <span className="min-w-0 break-words">“{fact.evidence}”</span>
        </div>
      )}
      {(confirmError || discard.isError) && (
        <div className="mt-2">
          <InlineError
            error={discard.error}
            message={
              confirmError ?? `“${label}” wasn't discarded. ${getErrorMessage(discard.error)}`
            }
          />
        </div>
      )}
    </motion.div>
  )
}

export function ReviewView() {
  const resumes = useResumes()
  const defaultResume = resumes.data?.find((resume) => resume.is_default) ?? resumes.data?.[0]
  const draft = useDraft(defaultResume?.id ?? null)
  const stories = useStories()
  const queryClient = useQueryClient()
  const [confirmationErrors, setConfirmationErrors] = useState<Record<string, string>>({})
  const confirmStory = useMutation({
    mutationFn: api.confirmStory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] })
      queryClient.invalidateQueries({ queryKey: ['draft'] })
    },
  })

  const pending = useMemo(
    () => (draft.data?.facts ?? []).filter((fact) => !fact.confirmed),
    [draft.data],
  )
  const confirmedCount = (draft.data?.facts.length ?? 0) - pending.length
  const bySection = useMemo(() => {
    const groups = new Map<string, DraftFact[]>()
    for (const fact of pending) {
      groups.set(fact.section, [...(groups.get(fact.section) ?? []), fact])
    }
    return [...groups.entries()]
  }, [pending])

  if (resumes.isLoading) return <SkeletonRows label="Loading your resumes" rows={3} />
  if (resumes.isError) {
    return <QueryError error={resumes.error} onRetry={() => resumes.refetch()} />
  }
  if (!defaultResume) return <UploadCard />
  if (draft.isLoading || stories.isLoading) {
    return <SkeletonRows label="Loading the resume draft" rows={4} />
  }
  if (draft.isError || stories.isError) {
    return (
      <QueryError
        error={draft.error ?? stories.error}
        title="We couldn't load this resume draft."
        onRetry={() => {
          draft.refetch()
          stories.refetch()
        }}
      />
    )
  }

  const draftStories = (stories.data ?? []).filter((story) => !story.confirmed)
  const totalFacts = draft.data?.facts.length ?? 0
  const remainingItems = pending.length + draftStories.length
  const reviewProgress = totalFacts === 0 ? 100 : Math.round((confirmedCount / totalFacts) * 100)

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl">Review the draft</h1>
          <p className="mt-1 break-words text-[13px] text-ink-3">
            From <span className="text-ink">{defaultResume.label}</span> — nothing is used in
            applications until you confirm it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <NewResumeButton />
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-ground px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${remainingItems ? 'bg-attention' : 'bg-done-mark'}`}
            aria-hidden="true"
          />
          <p className="min-w-0 text-[13px]">
            <span className="font-semibold">
              {remainingItems ? `${remainingItems} items need your decision` : 'Your draft is fully reviewed'}
            </span>
            <span className="text-ink-3"> · {confirmedCount} facts confirmed</span>
          </p>
        </div>
        <div className="flex items-center gap-3 sm:w-64">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span className="block h-full rounded-full bg-done-mark" style={{ width: `${reviewProgress}%` }} />
          </span>
          <span className="text-[11px] font-medium tabular-nums text-ink-3">{reviewProgress}%</span>
        </div>
      </div>

      {pending.length === 0 && draftStories.length === 0 && (
        <EmptyState title={`All ${confirmedCount} facts confirmed.`}>
          Continue to the interview to fill in what the resume could not answer.
        </EmptyState>
      )}

      {bySection.map(([section, facts]) => (
        <section key={section}>
          <SectionHeading meta={`${facts.length} pending`}>{sectionLabel(section)}</SectionHeading>
          <Card className="overflow-hidden">
            <AnimatePresence initial={false}>
              {facts.map((fact) => (
                <FactRow
                  key={fact.id}
                  fact={fact}
                  confirmError={confirmationErrors[fact.id]}
                  onConfirmError={(message) =>
                    setConfirmationErrors((current) => {
                      if (message) return { ...current, [fact.id]: message }
                      if (!(fact.id in current)) return current
                      const next = { ...current }
                      delete next[fact.id]
                      return next
                    })
                  }
                />
              ))}
            </AnimatePresence>
          </Card>
        </section>
      ))}

      {draftStories.length > 0 && (
        <section>
          <SectionHeading meta={`${draftStories.length} pending`}>Stories</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {draftStories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onConfirm={() => confirmStory.mutateAsync(story.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
