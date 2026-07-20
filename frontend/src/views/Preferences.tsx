// Search guardrails and fit signals, edited as normalized rules.

import { useId, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import {
  api,
  getErrorMessage,
  type PreferenceCategory,
  type PreferenceOperator,
  type PreferenceRule,
  type PreferenceRuleInput,
  type PreferenceStrength,
} from '../api'
import { usePreferences } from '../hooks'
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

const CATEGORIES: { value: PreferenceCategory; label: string }[] = [
  { value: 'location', label: 'Location' },
  { value: 'work_arrangement', label: 'Remote, hybrid, or onsite' },
  { value: 'work_authorization', label: 'Work authorization' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'employment_type', label: 'Employment type' },
  { value: 'company', label: 'Company' },
  { value: 'industry', label: 'Industry' },
  { value: 'role', label: 'Role' },
  { value: 'seniority', label: 'Seniority' },
  { value: 'technology', label: 'Technology' },
  { value: 'growth', label: 'Growth and ownership' },
  { value: 'work_environment', label: 'Work environment' },
]

const OPERATORS: Record<PreferenceStrength, { value: PreferenceOperator; label: string }[]> = {
  hard: [
    { value: 'allow_any', label: 'Allow any of' },
    { value: 'require_all', label: 'Require all of' },
    { value: 'exclude', label: 'Exclude' },
    { value: 'minimum', label: 'Minimum' },
    { value: 'maximum', label: 'Maximum' },
  ],
  soft: [
    { value: 'prefer', label: 'Prefer' },
    { value: 'avoid', label: 'Prefer to avoid' },
  ],
}

const categoryLabel = (category: PreferenceCategory) =>
  CATEGORIES.find((item) => item.value === category)?.label ?? category

const operatorLabel = (strength: PreferenceStrength, operator: PreferenceOperator) =>
  OPERATORS[strength].find((item) => item.value === operator)?.label ?? operator

const valuesFromText = (text: string) =>
  text
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)

function RuleForm({
  strength,
  rule,
  onDone,
  embedded = false,
}: {
  strength: PreferenceStrength
  rule?: PreferenceRule
  onDone: () => void
  embedded?: boolean
}) {
  const queryClient = useQueryClient()
  const categoryId = useId()
  const operatorId = useId()
  const valuesId = useId()
  const [category, setCategory] = useState<PreferenceCategory>(rule?.category ?? 'role')
  const [operator, setOperator] = useState<PreferenceOperator>(
    rule?.operator ?? (strength === 'hard' ? 'allow_any' : 'prefer'),
  )
  const [valuesText, setValuesText] = useState(rule?.values.join('\n') ?? '')
  const values = valuesFromText(valuesText)
  const needsOneValue = operator === 'minimum' || operator === 'maximum'
  const valid = values.length > 0 && (!needsOneValue || values.length === 1)

  const save = useMutation({
    mutationFn: () => {
      const body: PreferenceRuleInput = {
        strength,
        category,
        operator,
        values,
        enabled: rule?.enabled ?? true,
      }
      return rule ? api.updatePreference(rule.id, body) : api.createPreference(body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      onDone()
    },
  })

  const form = (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (valid && !save.isPending) save.mutate()
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={categoryId} className="mb-1 block text-[12px] font-medium text-ink-2">
              Category
            </label>
            <select
              id={categoryId}
              value={category}
              onChange={(event) => setCategory(event.target.value as PreferenceCategory)}
              className="w-full rounded-md border border-line bg-ground px-2.5 py-2 text-[13px] outline-none focus-visible:border-work-mark focus-visible:ring-2 focus-visible:ring-work-mark/25"
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={operatorId} className="mb-1 block text-[12px] font-medium text-ink-2">
              Rule
            </label>
            <select
              id={operatorId}
              value={operator}
              onChange={(event) => setOperator(event.target.value as PreferenceOperator)}
              className="w-full rounded-md border border-line bg-ground px-2.5 py-2 text-[13px] outline-none focus-visible:border-work-mark focus-visible:ring-2 focus-visible:ring-work-mark/25"
            >
              {OPERATORS[strength].map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label htmlFor={valuesId} className="mb-1 block text-[12px] font-medium text-ink-2">
            {needsOneValue ? 'Value' : 'Values — one per line'}
          </label>
          <textarea
            id={valuesId}
            rows={needsOneValue ? 2 : 4}
            value={valuesText}
            onChange={(event) => setValuesText(event.target.value)}
            placeholder={
              category === 'location'
                ? 'London\nBristol\nRemote in the UK'
                : category === 'role'
                  ? 'Backend engineer\nPlatform engineer'
                  : 'Enter a value'
            }
            className="w-full resize-y rounded-md border border-line bg-ground px-2.5 py-2 text-[13px] leading-relaxed outline-none placeholder:text-ink-3 focus-visible:border-work-mark focus-visible:ring-2 focus-visible:ring-work-mark/25"
          />
          {needsOneValue && values.length > 1 && (
            <p className="mt-1 text-[11.5px] text-fail">Minimum and maximum rules accept one value.</p>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!valid || save.isPending}>
            {save.isPending ? 'Saving…' : rule ? 'Save rule' : 'Add rule'}
          </Button>
          <Button type="button" variant="quiet" onClick={onDone}>
            Cancel
          </Button>
        </div>
        {save.isError && (
          <div className="mt-3">
            <InlineError message={`That rule wasn't saved. ${getErrorMessage(save.error)}`} />
          </div>
        )}
      </form>
  )

  return embedded
    ? <div className="border-b border-line bg-panel/45 p-4 last:border-b-0">{form}</div>
    : <Card className="p-4">{form}</Card>
}

function RuleRow({ rule }: { rule: PreferenceRule }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const update = useMutation({
    mutationFn: () => api.updatePreference(rule.id, {
      strength: rule.strength,
      category: rule.category,
      operator: rule.operator,
      values: rule.values,
      enabled: !rule.enabled,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences'] }),
  })
  const remove = useMutation({
    mutationFn: () => api.deletePreference(rule.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences'] }),
  })

  if (editing) {
    return (
      <RuleForm
        strength={rule.strength}
        rule={rule}
        onDone={() => setEditing(false)}
        embedded
      />
    )
  }

  return (
    <div className={`border-b border-line px-4 py-3.5 last:border-b-0 ${rule.enabled ? '' : 'bg-panel/55'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-ink">{categoryLabel(rule.category)}</span>
            <Chip tone={rule.enabled ? (rule.strength === 'hard' ? 'held' : 'work') : 'neutral'}>
              {rule.enabled ? 'active' : 'paused'}
            </Chip>
          </div>
          <p className={`mt-1 text-[12.5px] leading-relaxed ${rule.enabled ? 'text-ink-2' : 'text-ink-3'}`}>
            {operatorLabel(rule.strength, rule.operator)} {rule.values.join(', ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <Button
            variant="quiet"
            onClick={() => update.mutate()}
            disabled={update.isPending}
            aria-label={`${rule.enabled ? 'Pause' : 'Enable'} ${categoryLabel(rule.category)} rule`}
          >
            {update.isPending ? 'Saving…' : rule.enabled ? 'Pause' : 'Enable'}
          </Button>
          <Button variant="quiet" className="!px-2" onClick={() => setEditing(true)} aria-label={`Edit ${categoryLabel(rule.category)} rule`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          {confirmingDelete ? (
            <div className="flex items-center gap-1" role="group" aria-label="Confirm rule deletion">
              <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
                {remove.isPending ? 'Removing…' : 'Remove'}
              </Button>
              <Button variant="quiet" className="!px-2" onClick={() => setConfirmingDelete(false)} aria-label="Cancel rule deletion">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <Button variant="danger" className="!px-2" onClick={() => setConfirmingDelete(true)} aria-label={`Delete ${categoryLabel(rule.category)} rule`}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      {(update.isError || remove.isError) && (
        <div className="mt-2">
          <InlineError
            message={`That rule wasn't changed. ${getErrorMessage(update.error ?? remove.error)}`}
          />
        </div>
      )}
    </div>
  )
}

function PreferenceSection({
  strength,
  rules,
}: {
  strength: PreferenceStrength
  rules: PreferenceRule[]
}) {
  const [adding, setAdding] = useState(false)
  const hard = strength === 'hard'

  return (
    <section>
      <SectionHeading meta={`${rules.filter((rule) => rule.enabled).length} active`}>
        {hard ? 'Hard constraints' : 'Soft preferences'}
      </SectionHeading>
      <div className="mb-3 flex items-start gap-3">
        {hard ? (
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-held" aria-hidden="true" />
        ) : (
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-work" aria-hidden="true" />
        )}
        <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-ink-3">
          {hard
            ? 'A job that violates an active rule is ineligible. The agent never silently relaxes these guardrails.'
            : 'These signals improve fit and ranking, but an imperfect match can still proceed for evaluation.'}
        </p>
      </div>

      {rules.length > 0 && (
        <Card className="mb-3 overflow-hidden">
          {rules.map((rule) => <RuleRow key={rule.id} rule={rule} />)}
        </Card>
      )}

      {rules.length === 0 && !adding && (
        <Card className="mb-3">
          <EmptyState title={hard ? 'No hard constraints yet.' : 'No soft preferences yet.'}>
            {hard
              ? 'Add the boundaries that make a job unacceptable.'
              : 'Add the qualities that make a suitable role more appealing.'}
          </EmptyState>
        </Card>
      )}

      {adding ? (
        <RuleForm strength={strength} onDone={() => setAdding(false)} />
      ) : (
        <Button variant="ghost" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add {hard ? 'hard constraint' : 'soft preference'}
        </Button>
      )}
    </section>
  )
}

export function PreferencesView() {
  const preferences = usePreferences()
  const grouped = useMemo(() => ({
    hard: (preferences.data ?? []).filter((rule) => rule.strength === 'hard'),
    soft: (preferences.data ?? []).filter((rule) => rule.strength === 'soft'),
  }), [preferences.data])

  if (preferences.isLoading) return <SkeletonRows label="Loading search preferences" rows={5} />
  if (preferences.isError) {
    return (
      <QueryError
        error={preferences.error}
        title="We couldn't load your search preferences."
        onRetry={() => preferences.refetch()}
      />
    )
  }

  return (
    <div className="space-y-10">
      <header className="border-b border-line pb-5">
        <h1 className="text-2xl">Search preferences</h1>
        <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-ink-3">
          Define what the agent must reject and what it should favor when evaluating jobs.
        </p>
      </header>
      <PreferenceSection strength="hard" rules={grouped.hard} />
      <PreferenceSection strength="soft" rules={grouped.soft} />
    </div>
  )
}
