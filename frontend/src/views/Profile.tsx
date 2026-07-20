// The confirmed profile: sectioned facts and stories with add, edit, delete.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { api, getErrorMessage, type Fact } from '../api'
import { useFacts, useStories } from '../hooks'
import { factKey, factLabel, sectionLabel, sourceLabel } from '../presentation'
import { StoryCard } from '../components/story'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  InlineError,
  QueryError,
  SectionHeading,
  SkeletonRows,
} from '../components/ui'

const SOURCE_TONE: Record<string, 'neutral' | 'moss' | 'amber'> = {
  resume: 'neutral',
  onboarding: 'moss',
  manual: 'neutral',
  application_learned: 'amber',
}

const SECTIONS = [
  'identity',
  'contact',
  'eligibility',
  'employment',
  'education',
  'skills',
  'projects',
  'motivations',
  'interests',
  'logistics',
  'writing',
  'other',
]

function FactLine({ fact }: { fact: Fact }) {
  const queryClient = useQueryClient()
  const serverText = useRef(fact.value.text ?? '')
  const deleteTimer = useRef<number | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(serverText.current)
  const [deleteQueued, setDeleteQueued] = useState(false)
  const label = factLabel(fact.key)

  useEffect(() => {
    const incoming = fact.value.text ?? ''
    setText((current) => (current === serverText.current ? incoming : current))
    serverText.current = incoming
  }, [fact.id, fact.value.text])

  const update = useMutation({
    mutationFn: () =>
      api.updateFact(fact.id, {
        section: fact.section,
        key: fact.key,
        value: { text: text.trim() },
        sensitivity: fact.sensitivity,
        reuse_permitted: fact.reuse_permitted,
      }),
    onSuccess: () => {
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['facts'] })
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
  })
  const remove = useMutation({
    mutationFn: () => api.deleteFact(fact.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facts'] })
      queryClient.invalidateQueries({ queryKey: ['draft'] })
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
    onError: () => setDeleteQueued(false),
  })

  const cancelEdit = () => {
    setText(serverText.current)
    setEditing(false)
    update.reset()
  }

  const queueDelete = () => {
    if (deleteQueued || remove.isPending) return
    remove.reset()
    setDeleteQueued(true)
    deleteTimer.current = window.setTimeout(() => remove.mutate(), 5000)
  }

  const undoDelete = () => {
    window.clearTimeout(deleteTimer.current)
    setDeleteQueued(false)
  }

  if (deleteQueued) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-clay-soft/45 px-4 py-2.5 last:border-b-0"
        role="status"
        aria-live="polite"
      >
        <span className="text-[13px]">Removed “{label}” from your profile.</span>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-ink-soft">Deleting in 5 seconds</span>
          <Button variant="quiet" onClick={undoDelete}>Undo</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group border-b border-line-soft px-4 py-3 transition-colors last:border-b-0 hover:bg-line-soft/45">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
        <div className="w-full text-[12px] text-ink-soft sm:w-40 sm:shrink-0" title={label}>
          {label}
        </div>
        {editing ? (
          <>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && text.trim() && !update.isPending) {
                  event.preventDefault()
                  update.mutate()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelEdit()
                }
              }}
              autoFocus
              aria-label={`Edit ${label}`}
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-[12px] outline-none focus-visible:border-moss focus-visible:ring-1 focus-visible:ring-moss"
            />
            <Button
              className="!px-2.5"
              onClick={() => update.mutate()}
              disabled={!text.trim() || update.isPending}
            >
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="quiet" className="!px-2" onClick={cancelEdit} aria-label={`Cancel editing ${label}`}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1 break-words text-[12px] font-medium leading-relaxed">
              {fact.value.text ?? 'Not provided'}
            </div>
            <Chip tone={SOURCE_TONE[fact.source_type] ?? 'neutral'}>
              {sourceLabel(fact.source_type)}
            </Chip>
            <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <Button
                variant="quiet"
                className="!px-2"
                onClick={() => setEditing(true)}
                aria-label={`Edit ${label}`}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="danger"
                className="!px-2"
                onClick={queueDelete}
                aria-label={`Delete ${label}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </div>
      {(update.isError || remove.isError) && (
        <div className="mt-2">
          <InlineError
            message={
              update.isError
                ? `“${label}” wasn't saved. ${getErrorMessage(update.error)}`
                : `“${label}” wasn't deleted. ${getErrorMessage(remove.error)}`
            }
          />
        </div>
      )}
    </div>
  )
}

function AddFact() {
  const queryClient = useQueryClient()
  const sectionId = useId()
  const nameId = useId()
  const valueId = useId()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState('other')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const create = useMutation({
    mutationFn: () =>
      api.createFact({ section, key: factKey(name), value: { text: text.trim() } }),
    onSuccess: () => {
      setOpen(false)
      setName('')
      setText('')
      queryClient.invalidateQueries({ queryKey: ['facts'] })
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    },
  })

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add fact
      </Button>
    )
  }

  return (
    <Card className="p-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (factKey(name) && text.trim() && !create.isPending) create.mutate()
        }}
      >
        <div>
          <label htmlFor={sectionId} className="sr-only">Profile section</label>
          <select
            id={sectionId}
            value={section}
            onChange={(event) => setSection(event.target.value)}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] focus-visible:border-moss focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-moss"
          >
            {SECTIONS.map((item) => (
              <option key={item} value={item}>{sectionLabel(item)}</option>
            ))}
          </select>
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor={nameId} className="sr-only">Fact name</label>
          <input
            id={nameId}
            placeholder="Fact name, e.g. Portfolio"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] outline-none placeholder:text-ink-soft focus-visible:border-moss focus-visible:ring-1 focus-visible:ring-moss"
          />
        </div>
        <div className="min-w-48 flex-[2]">
          <label htmlFor={valueId} className="sr-only">Fact value</label>
          <input
            id={valueId}
            placeholder="Value"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] outline-none placeholder:text-ink-soft focus-visible:border-moss focus-visible:ring-1 focus-visible:ring-moss"
          />
        </div>
        <Button type="submit" disabled={!factKey(name) || !text.trim() || create.isPending}>
          {create.isPending ? 'Saving…' : 'Save fact'}
        </Button>
        <Button
          type="button"
          variant="quiet"
          className="!px-2"
          onClick={() => setOpen(false)}
          aria-label="Cancel adding a fact"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </form>
      {create.isError && (
        <div className="mt-2">
          <InlineError
            message={`That fact wasn't saved. ${getErrorMessage(create.error)}`}
          />
        </div>
      )}
    </Card>
  )
}

export function ProfileView() {
  const facts = useFacts()
  const stories = useStories()

  const confirmed = useMemo(
    () => (facts.data ?? []).filter((fact) => fact.confirmed),
    [facts.data],
  )
  const bySection = useMemo(() => {
    const groups = new Map<string, Fact[]>()
    for (const fact of confirmed) {
      groups.set(fact.section, [...(groups.get(fact.section) ?? []), fact])
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [confirmed])
  const confirmedStories = (stories.data ?? []).filter((story) => story.confirmed)

  if (facts.isLoading || stories.isLoading) {
    return <SkeletonRows label="Loading your confirmed profile" rows={4} />
  }
  if (facts.isError || stories.isError) {
    return (
      <QueryError
        error={facts.error ?? stories.error}
        title="We couldn't load your profile."
        onRetry={() => {
          facts.refetch()
          stories.refetch()
        }}
      />
    )
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl">Your profile</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            The confirmed record the agent uses to represent you accurately.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="moss">{confirmed.length} facts</Chip>
          <Chip>{confirmedStories.length} stories</Chip>
          <AddFact />
        </div>
      </header>

      {confirmed.length === 0 && (
        <EmptyState title="Nothing confirmed yet.">
          Upload a resume and review the draft to build your profile.
        </EmptyState>
      )}

      {bySection.map(([section, sectionFacts]) => (
        <section key={section}>
          <SectionHeading meta={`${sectionFacts.length} facts`}>{sectionLabel(section)}</SectionHeading>
          <Card className="overflow-hidden">
            {sectionFacts.map((fact) => (
              <FactLine key={fact.id} fact={fact} />
            ))}
          </Card>
        </section>
      ))}

      {confirmedStories.length > 0 && (
        <section>
          <SectionHeading meta={`${confirmedStories.length} stories`}>Stories</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {confirmedStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
