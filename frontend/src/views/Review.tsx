// Resume upload and draft review: confirm, edit, or discard extracted facts.

import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, FileUp, Quote, Trash2 } from 'lucide-react'
import { api, type DraftFact } from '../api'
import { useDraft, useResumes, useStories } from '../hooks'
import { StoryCard } from '../components/story'
import { Button, Card, Chip, Confidence, EmptyState, SectionLabel, Spinner } from '../components/ui'

function UploadCard() {
  const input = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const upload = useMutation({
    mutationFn: api.uploadResume,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  return (
    <Card className="p-10 text-center">
      {upload.isPending ? (
        <div className="space-y-3">
          <Spinner label="Interpreting your resume…" />
          <p className="text-[12px] text-ink-faint">
            The model reads the extracted text and drafts your profile. This can take a minute.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <FileUp className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.25} />
          <div>
            <p className="font-display text-xl">Start with your resume</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              PDF or DOCX. Everything extracted stays a draft until you confirm it.
            </p>
          </div>
          <Button onClick={() => input.current?.click()}>Choose file</Button>
          {upload.isError && (
            <p className="text-[12px] text-clay">{(upload.error as Error).message}</p>
          )}
          <input
            ref={input}
            type="file"
            accept=".pdf,.docx"
            hidden
            onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
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
    onSuccess: () => queryClient.invalidateQueries(),
  })
  return (
    <>
      {upload.isPending ? (
        <Spinner label="Interpreting…" />
      ) : (
        <Button variant="ghost" onClick={() => input.current?.click()}>
          <FileUp className="h-3.5 w-3.5" /> New resume
        </Button>
      )}
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx"
        hidden
        onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
      />
    </>
  )
}

function FactRow({ fact }: { fact: DraftFact }) {
  const queryClient = useQueryClient()
  const [text, setText] = useState(fact.value.text ?? '')
  const [showEvidence, setShowEvidence] = useState(false)
  const edited = text !== (fact.value.text ?? '')

  const confirm = useMutation({
    mutationFn: () => api.confirmFact(fact.id, edited ? { text } : undefined),
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const discard = useMutation({
    mutationFn: () => api.deleteFact(fact.id),
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const lowConfidence = (fact.confidence ?? 1) < 0.8

  return (
    <motion.div
      layout
      exit={{ opacity: 0, x: 24 }}
      className={`group border-b border-line-soft px-4 py-2.5 last:border-b-0 ${lowConfidence ? 'bg-amber-soft/40' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-44 shrink-0 truncate text-[12px] text-ink-soft" title={fact.key}>
          {fact.key}
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-[13px] outline-none focus:border-line focus:bg-surface"
        />
        <Confidence value={fact.confidence} />
        {fact.evidence && (
          <button
            onClick={() => setShowEvidence((v) => !v)}
            className={`cursor-pointer rounded p-1 ${showEvidence ? 'text-moss' : 'text-ink-faint hover:text-ink-soft'}`}
            title="show evidence from resume"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="danger" className="!px-2" onClick={() => discard.mutate()} title="discard">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button className="!px-2.5" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
            <Check className="h-3.5 w-3.5" />
            {edited ? 'Confirm edit' : 'Confirm'}
          </Button>
        </div>
      </div>
      {showEvidence && fact.evidence && (
        <p className="mt-1.5 ml-47 border-l-2 border-moss-soft pl-3 font-mono text-[11.5px] leading-relaxed text-ink-soft">
          “{fact.evidence}”
        </p>
      )}
    </motion.div>
  )
}

export function ReviewView() {
  const resumes = useResumes()
  const defaultResume = resumes.data?.find((r) => r.is_default) ?? resumes.data?.[0]
  const draft = useDraft(defaultResume?.id ?? null)
  const stories = useStories()
  const queryClient = useQueryClient()
  const confirmStory = useMutation({
    mutationFn: api.confirmStory,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  const pending = useMemo(
    () => (draft.data?.facts ?? []).filter((f) => !f.confirmed),
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

  if (resumes.isLoading) return <Spinner label="Loading…" />
  if (!defaultResume) return <UploadCard />

  const draftStories = (stories.data ?? []).filter((s) => !s.confirmed)

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl">Review the draft</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            From <span className="text-ink">{defaultResume.label}</span> — nothing is used in
            applications until you confirm it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NewResumeButton />
          <Chip tone={pending.length ? 'amber' : 'moss'}>
            {pending.length ? `${pending.length} to review` : 'all reviewed'}
          </Chip>
        </div>
      </header>

      {pending.length === 0 && draftStories.length === 0 && (
        <EmptyState title={`All ${confirmedCount} facts confirmed.`}>
          Continue to the interview to fill what the resume couldn't answer.
        </EmptyState>
      )}

      {bySection.map(([section, facts]) => (
        <section key={section}>
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel>{section}</SectionLabel>
            <span className="text-[11px] text-ink-faint">{facts.length} pending</span>
          </div>
          <Card>
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
          <SectionLabel>Stories</SectionLabel>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {draftStories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onConfirm={() => confirmStory.mutate(story.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
