// Story card and the full-text popout dialog shared by Review and Profile.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, X } from 'lucide-react'
import type { Story } from '../api'
import { getErrorMessage } from '../api'
import { sourceLabel } from '../presentation'
import { Button, Card, Chip, InlineError, SectionLabel } from './ui'

const FIELDS: { key: keyof Story; label: string }[] = [
  { key: 'context', label: 'Context' },
  { key: 'problem', label: 'Problem' },
  { key: 'role', label: 'My role' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'actions', label: 'Actions' },
  { key: 'obstacles', label: 'Obstacles' },
  { key: 'result', label: 'Result' },
  { key: 'learned', label: 'What I learned' },
  { key: 'motivation', label: 'Why it mattered' },
]

function StoryDialog({
  story,
  onClose,
  onConfirm,
  confirming,
  confirmError,
}: {
  story: Story
  onClose: () => void
  onConfirm?: () => Promise<boolean>
  confirming: boolean
  confirmError: string | null
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))

    ;(focusable()[0] ?? dialog).focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus()
    }
  }, [onClose])

  const filled = FIELDS.filter(({ key }) => story[key])

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: reduceMotion ? 0 : 0.16 }}
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-ground shadow-xl focus:outline-none"
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-line bg-ground px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-xl leading-snug">
              {story.title}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Chip tone={story.confirmed ? 'done' : 'draft'}>
                {story.confirmed ? 'Confirmed' : 'Draft'}
              </Chip>
              <Chip>{sourceLabel(story.source_type)}</Chip>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!story.confirmed && onConfirm && (
              <Button
                className="!text-[12px]"
                disabled={confirming}
                onClick={async () => {
                  if (await onConfirm()) onClose()
                }}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {confirming ? 'Confirming…' : 'Confirm story'}
              </Button>
            )}
            <Button variant="quiet" className="!px-2" onClick={onClose} aria-label="Close story">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-6">
          <InlineError message={confirmError ?? undefined} />
          {filled.length === 0 && (
            <p className="text-[13px] text-ink-3 italic">
              This story only has a title so far. The interview can help complete it.
            </p>
          )}
          {filled.map(({ key, label }) => (
            <div key={key}>
              <SectionLabel as="h3">{label}</SectionLabel>
              <p className="mt-1 break-words whitespace-pre-wrap text-[14px] leading-relaxed">
                {story[key] as string}
              </p>
            </div>
          ))}
          {(story.skills.length > 0 || story.themes.length > 0) && (
            <div className="border-t border-line pt-4">
              <div className="flex flex-wrap gap-1.5">
                {story.skills.map((skill) => (
                  <Chip key={`s-${skill}`}>{skill}</Chip>
                ))}
                {story.themes.map((theme) => (
                  <Chip key={`t-${theme}`} tone="learned">
                    {theme}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export function StoryCard({
  story,
  onConfirm,
}: {
  story: Story
  onConfirm?: () => Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const preview = story.result ?? story.actions ?? story.context
  const close = useCallback(() => setOpen(false), [])

  const confirm = useCallback(async () => {
    if (!onConfirm || confirming) return false
    setConfirmError(null)
    setConfirming(true)
    try {
      await onConfirm()
      return true
    } catch (error) {
      setConfirmError(getErrorMessage(error, "The story couldn't be confirmed. Try again."))
      return false
    } finally {
      setConfirming(false)
    }
  }, [confirming, onConfirm])

  return (
    <>
      <Card
        fill
        className={`overflow-hidden transition-all duration-150 hover:border-line-firm hover:shadow-[0_2px_8px_rgba(35,32,25,0.08)] focus-within:border-line-firm focus-within:shadow-[0_2px_8px_rgba(35,32,25,0.08)] ${story.confirmed ? '' : 'border-draft-mark/30'}`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full flex-1 cursor-pointer flex-col p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-work-mark/30"
          aria-label={`Read story: ${story.title}`}
        >
          <h3 className="break-words text-[15px] font-medium leading-snug">{story.title}</h3>
          {preview && (
            <p className="mt-1.5 line-clamp-2 break-words text-[12.5px] text-ink-3">
              {preview}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between gap-3 pt-3">
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {story.skills.slice(0, 3).map((skill) => (
                <Chip key={skill}>{skill}</Chip>
              ))}
            </div>
            <span className="shrink-0 text-[11px] text-ink-3 transition-colors group-hover:text-work">Read →</span>
          </div>
        </button>
        {!story.confirmed && onConfirm && (
          <div className="border-t border-line bg-panel px-4 py-3">
            <div className="flex justify-end">
              <Button variant="ghost" className="!text-[12px]" onClick={confirm} disabled={confirming}>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {confirming ? 'Confirming…' : 'Confirm story'}
              </Button>
            </div>
            {confirmError && <div className="mt-2"><InlineError message={confirmError} /></div>}
          </div>
        )}
      </Card>
      <AnimatePresence>
        {open && (
          <StoryDialog
            story={story}
            onClose={close}
            onConfirm={onConfirm ? confirm : undefined}
            confirming={confirming}
            confirmError={confirmError}
          />
        )}
      </AnimatePresence>
    </>
  )
}
