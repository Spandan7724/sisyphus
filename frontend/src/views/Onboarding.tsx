// The interview: one focused question at a time, plus agent-suggested follow-ups.

import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BookOpen, Search } from 'lucide-react'
import { api, getErrorMessage } from '../api'
import { useQuestions } from '../hooks'
import { sectionLabel, sensitivityLabel } from '../presentation'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  InlineError,
  QueryError,
  SectionLabel,
  SkeletonRows,
} from '../components/ui'

export function OnboardingView() {
  const questions = useQuestions()
  const queryClient = useQueryClient()
  const answerId = useId()
  const helpId = useId()
  const reduceMotion = useReducedMotion()
  const [text, setText] = useState('')

  const answer = useMutation({
    mutationFn: api.answer,
    onSuccess: () => {
      setText('')
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      queryClient.invalidateQueries({ queryKey: ['facts'] })
    },
  })
  const generate = useMutation({
    mutationFn: api.generateQuestions,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  })

  if (questions.isLoading) return <SkeletonRows label="Loading the interview" rows={2} />
  if (questions.isError) {
    return (
      <QueryError
        error={questions.error}
        title="We couldn't load the interview."
        onRetry={() => questions.refetch()}
      />
    )
  }

  const pending = questions.data ?? []
  const current = pending[0]
  const required = pending.filter((question) => !question.optional).length
  const queuedQuestions = pending.slice(1, 4)

  const saveAnswer = () => {
    if (!current || !text.trim() || answer.isPending) return
    answer.mutate({
      section: current.section,
      key: current.key,
      value: { text: text.trim() },
    })
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl">The interview</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            Only what your resume did not answer. Come back anytime; it picks up where you left off.
          </p>
        </div>
        {pending.length > 0 && (
          <Chip tone={required ? 'held' : 'neutral'}>
            {required ? `${required} required` : `${pending.length} optional`}
          </Chip>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        <div className="min-w-0">
          {!current && (
            <EmptyState title="Nothing left to ask.">
              The agent can review your profile and suggest deeper questions.
            </EmptyState>
          )}

          <AnimatePresence mode="wait">
            {current && (
              <motion.div
                key={`${current.section}.${current.key}`}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
              >
                <Card className="overflow-hidden">
                  <div className="p-5 sm:p-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <SectionLabel>{sectionLabel(current.section)}</SectionLabel>
                      {current.origin === 'generated' && (
                        <Chip tone="learned">
                          <BookOpen className="mr-1 h-3 w-3" aria-hidden="true" /> Suggested from your profile
                        </Chip>
                      )}
                      {current.optional && <Chip>Optional</Chip>}
                      {current.sensitivity !== 'normal' && (
                        <Chip tone="held">{sensitivityLabel(current.sensitivity)}</Chip>
                      )}
                    </div>
                    <h2 className="max-w-[32ch] text-wrap-pretty text-xl leading-snug">
                      {current.question}
                    </h2>
                    {current.rationale && (
                      <p className="mt-2 max-w-[65ch] text-[12.5px] text-ink-3 italic">
                        Why this helps: {current.rationale}
                      </p>
                    )}
                  </div>
                  <form
                    className="border-t border-line bg-panel p-5 sm:p-6"
                    onSubmit={(event) => {
                      event.preventDefault()
                      saveAnswer()
                    }}
                  >
                    <label htmlFor={answerId} className="sr-only">Your answer</label>
                    <textarea
                      id={answerId}
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                          event.preventDefault()
                          saveAnswer()
                        }
                      }}
                      rows={5}
                      autoFocus
                      aria-describedby={helpId}
                      placeholder="Answer in your own words…"
                      className="w-full resize-y rounded-lg border border-line bg-ground px-3 py-2.5 text-[14px] leading-relaxed outline-none placeholder:text-ink-3 focus-visible:border-work-mark focus-visible:ring-1 focus-visible:ring-work-mark/30"
                    />
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <span id={helpId} className="max-w-[52ch] text-[12px] leading-relaxed text-ink-3">
                        {current.optional
                          ? 'Skip leaves this detail out of your profile. You can add it later.'
                          : 'Saved as a confirmed fact and reused where relevant. Press Ctrl or Command + Enter to save.'}
                      </span>
                      <div className="flex shrink-0 justify-end gap-2">
                        {current.optional && (
                          <Button
                            type="button"
                            variant="quiet"
                            disabled={answer.isPending}
                            onClick={() =>
                              answer.mutate({ section: current.section, key: current.key, skip: true })
                            }
                          >
                            Skip this question
                          </Button>
                        )}
                        <Button type="submit" disabled={!text.trim() || answer.isPending}>
                          {answer.isPending ? 'Saving…' : 'Save answer'}
                          {!answer.isPending && <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
                        </Button>
                      </div>
                    </div>
                    {answer.isError && (
                      <div className="mt-3">
                        <InlineError
                          message={`Your answer wasn't saved. ${getErrorMessage(answer.error)}`}
                        />
                      </div>
                    )}
                  </form>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="border-y border-line py-5 lg:sticky lg:top-8" aria-label="Question queue">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-medium">Question queue</h2>
            <span className="text-[11px] tabular-nums text-ink-3">
              {Math.max(pending.length - 1, 0)} waiting
            </span>
          </div>
          {queuedQuestions.length > 0 ? (
            <ol className="mt-3">
              {queuedQuestions.map((question, index) => (
                <li key={`${question.section}.${question.key}`} className="flex gap-3 border-t border-line py-3 first:border-t-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-panel text-[10.5px] font-semibold tabular-nums text-ink-3">
                    {index + 2}
                  </span>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[12.5px] leading-relaxed text-ink">
                      {question.question}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-ink-3">
                      {sectionLabel(question.section)}{question.optional ? ' · Optional' : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
              No queued questions. Ask the agent to check for useful gaps.
            </p>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <Button className="w-full" variant="ghost" onClick={() => generate.mutate()} disabled={generate.isPending}>
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              {generate.isPending ? 'Reviewing your profile…' : 'Find deeper questions'}
            </Button>
            {generate.isSuccess && generate.data.length === 0 && (
              <span role="status" className="mt-2 block text-[12px] text-ink-3">
                No new gaps found right now.
              </span>
            )}
            {generate.isError && (
              <div className="mt-2">
                <InlineError
                  message={`The profile review couldn't finish. ${getErrorMessage(generate.error)}`}
                />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
