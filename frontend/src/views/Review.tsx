// Resume upload and draft review: confirm, edit, or discard extracted facts.

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, FileUp, Quote, Trash2 } from 'lucide-react'
import { api, getErrorMessage, type DraftFact } from '../api'
import { useDraft, useResumes, useStories } from '../hooks'
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

function invalidateResumeData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['resumes'] })
  queryClient.invalidateQueries({ queryKey: ['draft'] })
  queryClient.invalidateQueries({ queryKey: ['facts'] })
  queryClient.invalidateQueries({ queryKey: ['stories'] })
  queryClient.invalidateQueries({ queryKey: ['questions'] })
}

function UploadProgress({ compact = false }: { compact?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={compact ? '' : 'space-y-4'}>
      <div className="flex items-center justify-center gap-2 text-[13px] font-medium text-ink">
        <FileUp className="h-4 w-4 text-moss" aria-hidden="true" />
        Reading your resume…
      </div>
      {!compact && (
        <>
          <div className="mx-auto max-w-sm space-y-2" aria-hidden="true">
            <div className="h-2.5 w-full rounded bg-line motion-safe:animate-pulse" />
            <div className="h-2.5 w-5/6 rounded bg-line-soft motion-safe:animate-pulse" />
            <div className="h-2.5 w-2/3 rounded bg-line-soft motion-safe:animate-pulse" />
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            Extracting career details and drafting your profile. This usually takes about a minute.
          </p>
        </>
      )}
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
        <UploadProgress />
      ) : (
        <div className="space-y-4">
          <FileUp className="mx-auto h-8 w-8 text-ink-soft" strokeWidth={1.25} aria-hidden="true" />
          <div>
            <p className="font-display text-xl">Start with your resume</p>
            <p className="mt-1 text-[13px] text-ink-soft">
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
        <UploadProgress compact />
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

function FactRow({ fact }: { fact: DraftFact }) {
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion()
  const serverText = useRef(fact.value.text ?? '')
  const discardTimer = useRef<number | undefined>(undefined)
  const [text, setText] = useState(serverText.current)
  const [showEvidence, setShowEvidence] = useState(false)
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft'] })
      queryClient.invalidateQueries({ queryKey: ['facts'] })
      queryClient.invalidateQueries({ queryKey: ['questions'] })
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
        className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-clay-soft/45 px-4 py-2.5 last:border-b-0"
        role="status"
        aria-live="polite"
      >
        <span className="text-[13px] text-ink">Discarded “{label}”.</span>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-ink-soft">Deleting in 5 seconds</span>
          <Button variant="quiet" onClick={undoDiscard}>Undo</Button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout={!reduceMotion}
      exit={reduceMotion ? undefined : { opacity: 0, x: 24 }}
      className={`group border-b border-line-soft px-4 py-3 transition-colors last:border-b-0 ${lowConfidence ? 'bg-amber-soft/40 hover:bg-amber-soft/65' : 'hover:bg-line-soft/45'}`}
    >
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
        <div className="w-full min-w-0 text-[12px] text-ink-soft sm:w-36 sm:shrink-0" title={label}>
          {label}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && text.trim() && !confirm.isPending) {
                event.preventDefault()
                confirm.mutate()
              }
            }}
            aria-label={`${label} value`}
            className="min-w-0 basis-full rounded-md border border-transparent bg-transparent px-2 py-1 text-[12px] font-medium outline-none focus-visible:border-moss focus-visible:bg-surface focus-visible:ring-1 focus-visible:ring-moss sm:basis-auto sm:flex-1"
          />
          <Confidence value={fact.confidence} />
          {fact.evidence && (
            <button
              type="button"
              onClick={() => setShowEvidence((visible) => !visible)}
              className={`cursor-pointer rounded-md p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss ${showEvidence ? 'bg-moss-soft text-moss-deep' : 'text-ink-soft hover:bg-line-soft hover:text-ink'}`}
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
      {showEvidence && fact.evidence && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-line-soft px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink-soft">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" aria-hidden="true" />
          <span className="min-w-0 break-words">“{fact.evidence}”</span>
        </div>
      )}
      {(confirm.isError || discard.isError) && (
        <div className="mt-2">
          <InlineError
            error={confirm.error ?? discard.error}
            message={
              confirm.isError
                ? `“${label}” wasn't confirmed. ${getErrorMessage(confirm.error)}`
                : `“${label}” wasn't discarded. ${getErrorMessage(discard.error)}`
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
          <h1 className="font-display text-2xl">Review the draft</h1>
          <p className="mt-1 break-words text-[13px] text-ink-soft">
            From <span className="text-ink">{defaultResume.label}</span> — nothing is used in
            applications until you confirm it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <NewResumeButton />
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${remainingItems ? 'bg-amber' : 'bg-moss'}`}
            aria-hidden="true"
          />
          <p className="min-w-0 text-[13px]">
            <span className="font-semibold">
              {remainingItems ? `${remainingItems} items need your decision` : 'Your draft is fully reviewed'}
            </span>
            <span className="text-ink-soft"> · {confirmedCount} facts confirmed</span>
          </p>
        </div>
        <div className="flex items-center gap-3 sm:w-64">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <span className="block h-full rounded-full bg-moss" style={{ width: `${reviewProgress}%` }} />
          </span>
          <span className="text-[11px] font-medium tabular-nums text-ink-soft">{reviewProgress}%</span>
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
                <FactRow key={fact.id} fact={fact} />
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
