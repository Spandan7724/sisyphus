// The confirmed profile: sectioned facts and stories with add, edit, delete.

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { api, type Fact } from '../api'
import { useFacts, useStories } from '../hooks'
import { StoryCard } from '../components/story'
import { Button, Card, Chip, EmptyState, SectionLabel, Spinner } from '../components/ui'

const SOURCE_TONE: Record<string, 'neutral' | 'moss' | 'amber'> = {
  resume: 'neutral',
  onboarding: 'moss',
  manual: 'neutral',
  application_learned: 'amber',
}

function FactLine({ fact }: { fact: Fact }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(fact.value.text ?? '')

  const update = useMutation({
    mutationFn: () =>
      api.updateFact(fact.id, {
        section: fact.section,
        key: fact.key,
        value: { text },
        sensitivity: fact.sensitivity,
        reuse_permitted: fact.reuse_permitted,
      }),
    onSuccess: () => {
      setEditing(false)
      queryClient.invalidateQueries()
    },
  })
  const remove = useMutation({
    mutationFn: () => api.deleteFact(fact.id),
    onSuccess: () => queryClient.invalidateQueries(),
  })

  return (
    <div className="group flex items-center gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0">
      <div className="w-44 shrink-0 truncate text-[12px] text-ink-soft" title={fact.key}>
        {fact.key}
      </div>
      {editing ? (
        <>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-[13px] outline-none focus:border-moss"
          />
          <Button className="!px-2.5" onClick={() => update.mutate()} disabled={update.isPending}>
            Save
          </Button>
          <Button variant="quiet" className="!px-2" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1 truncate text-[13px]">{fact.value.text ?? '—'}</div>
          <Chip tone={SOURCE_TONE[fact.source_type] ?? 'neutral'}>{fact.source_type}</Chip>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="quiet" className="!px-2" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="danger" className="!px-2" onClick={() => remove.mutate()}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function AddFact() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState('other')
  const [key, setKey] = useState('')
  const [text, setText] = useState('')
  const create = useMutation({
    mutationFn: () => api.createFact({ section, key, value: { text } }),
    onSuccess: () => {
      setOpen(false)
      setKey('')
      setText('')
      queryClient.invalidateQueries()
    },
  })

  if (!open)
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add fact
      </Button>
    )
  return (
    <Card className="flex flex-wrap items-center gap-2 p-3">
      <select
        value={section}
        onChange={(e) => setSection(e.target.value)}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-[13px]"
      >
        {['identity', 'contact', 'eligibility', 'employment', 'education', 'skills',
          'projects', 'motivations', 'interests', 'logistics', 'writing', 'other'].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <input
        placeholder="key (e.g. portfolio_url)"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        className="w-48 rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-moss"
      />
      <input
        placeholder="value"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] outline-none focus:border-moss"
      />
      <Button disabled={!key.trim() || !text.trim()} onClick={() => create.mutate()}>
        Save
      </Button>
      <Button variant="quiet" className="!px-2" onClick={() => setOpen(false)}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </Card>
  )
}

export function ProfileView() {
  const facts = useFacts()
  const stories = useStories()

  const confirmed = useMemo(
    () => (facts.data ?? []).filter((f) => f.confirmed),
    [facts.data],
  )
  const bySection = useMemo(() => {
    const groups = new Map<string, Fact[]>()
    for (const fact of confirmed) {
      groups.set(fact.section, [...(groups.get(fact.section) ?? []), fact])
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [confirmed])
  const confirmedStories = (stories.data ?? []).filter((s) => s.confirmed)

  if (facts.isLoading) return <Spinner label="Loading…" />

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl">Your profile</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            The confirmed memory the agent represents you with — {confirmed.length} facts,{' '}
            {confirmedStories.length} stories.
          </p>
        </div>
        <AddFact />
      </header>

      {confirmed.length === 0 && (
        <EmptyState title="Nothing confirmed yet.">
          Upload a resume and review the draft to build your profile.
        </EmptyState>
      )}

      {bySection.map(([section, sectionFacts]) => (
        <section key={section}>
          <SectionLabel>{section}</SectionLabel>
          <Card className="mt-2">
            {sectionFacts.map((fact) => (
              <FactLine key={fact.id} fact={fact} />
            ))}
          </Card>
        </section>
      ))}

      {confirmedStories.length > 0 && (
        <section>
          <SectionLabel>Stories</SectionLabel>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {confirmedStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
