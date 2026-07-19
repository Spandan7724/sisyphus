// The interview: one focused question at a time, plus agent-suggested follow-ups.

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Sparkles } from 'lucide-react'
import { api } from '../api'
import { useQuestions } from '../hooks'
import { Button, Card, Chip, EmptyState, SectionLabel, Spinner } from '../components/ui'

export function OnboardingView() {
  const questions = useQuestions()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')

  const answer = useMutation({
    mutationFn: api.answer,
    onSuccess: () => {
      setText('')
      queryClient.invalidateQueries()
    },
  })
  const generate = useMutation({
    mutationFn: api.generateQuestions,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  if (questions.isLoading) return <Spinner label="Loading…" />
  const pending = questions.data ?? []
  const current = pending[0]
  const required = pending.filter((q) => !q.optional).length

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl">The interview</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            Only what your resume didn't answer. Come back anytime — it picks up where you left.
          </p>
        </div>
        {pending.length > 0 && (
          <Chip tone={required ? 'amber' : 'neutral'}>
            {pending.length} left{required ? ` · ${required} required` : ''}
          </Chip>
        )}
      </header>

      {!current && (
        <EmptyState title="Nothing left to ask.">
          The agent can look over your profile and suggest deeper questions.
        </EmptyState>
      )}

      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={`${current.section}.${current.key}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Card className="p-6">
              <div className="mb-3 flex items-center gap-2">
                <SectionLabel>{current.section}</SectionLabel>
                {current.origin === 'generated' && (
                  <Chip tone="moss">
                    <Sparkles className="mr-1 h-3 w-3" /> suggested by the agent
                  </Chip>
                )}
                {current.optional && <Chip>optional</Chip>}
                {current.sensitivity !== 'normal' && (
                  <Chip tone="amber">{current.sensitivity}</Chip>
                )}
              </div>
              <p className="font-display text-xl leading-snug">{current.question}</p>
              {current.rationale && (
                <p className="mt-2 text-[12.5px] text-ink-soft italic">
                  why: {current.rationale}
                </p>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                autoFocus
                placeholder="Answer in your own words…"
                className="mt-4 w-full resize-y rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] leading-relaxed outline-none focus:border-moss"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12px] text-ink-faint">
                  Saved as a confirmed fact — reused across applications.
                </span>
                <div className="flex gap-2">
                  {current.optional && (
                    <Button
                      variant="quiet"
                      onClick={() =>
                        answer.mutate({ section: current.section, key: current.key, skip: true })
                      }
                    >
                      Skip
                    </Button>
                  )}
                  <Button
                    disabled={!text.trim() || answer.isPending}
                    onClick={() =>
                      answer.mutate({
                        section: current.section,
                        key: current.key,
                        value: { text: text.trim() },
                      })
                    }
                  >
                    Save answer <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {pending.length > 1 && (
        <div className="text-[12px] text-ink-faint">
          Up next:{' '}
          {pending
            .slice(1, 4)
            .map((q) => q.question)
            .join('  ·  ')}
          {pending.length > 4 && '  …'}
        </div>
      )}

      <div className="border-t border-line-soft pt-5">
        <Button variant="ghost" onClick={() => generate.mutate()} disabled={generate.isPending}>
          <Sparkles className="h-3.5 w-3.5" />
          {generate.isPending ? 'Reading your profile…' : 'Ask the agent for deeper questions'}
        </Button>
        {generate.isSuccess && generate.data.length === 0 && (
          <span className="ml-3 text-[12px] text-ink-faint">
            No new gaps found right now.
          </span>
        )}
      </div>
    </div>
  )
}
