// Story card and the full-text popout dialog shared by Review and Profile.

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, X } from 'lucide-react'
import type { Story } from '../api'
import { Button, Card, Chip, SectionLabel } from './ui'

const FIELDS: { key: keyof Story; label: string }[] = [
  { key: 'context', label: 'Context' },
  { key: 'problem', label: 'Problem' },
  { key: 'role', label: 'My role' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'actions', label: 'Actions' },
  { key: 'obstacles', label: 'Obstacles' },
  { key: 'result', label: 'Result' },
  { key: 'learned', label: 'Learned' },
  { key: 'motivation', label: 'Why it mattered' },
]

function StoryDialog({
  story,
  onClose,
  onConfirm,
}: {
  story: Story
  onClose: () => void
  onConfirm?: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filled = FIELDS.filter(({ key }) => story[key])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.16 }}
        className="max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-line-soft bg-surface/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="font-display text-xl leading-snug">{story.title}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Chip tone={story.confirmed ? 'moss' : 'amber'}>
                {story.confirmed ? 'confirmed' : 'draft'}
              </Chip>
              <Chip>{story.source_type}</Chip>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!story.confirmed && onConfirm && (
              <Button
                onClick={() => {
                  onConfirm()
                  onClose()
                }}
              >
                <Check className="h-3.5 w-3.5" /> Confirm
              </Button>
            )}
            <Button variant="quiet" className="!px-2" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          {filled.length === 0 && (
            <p className="text-[13px] text-ink-soft italic">
              This story only has a title so far — the interview can help flesh it out.
            </p>
          )}
          {filled.map(({ key, label }) => (
            <div key={key}>
              <SectionLabel>{label}</SectionLabel>
              <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap">
                {story[key] as string}
              </p>
            </div>
          ))}
          {(story.skills.length > 0 || story.themes.length > 0) && (
            <div className="border-t border-line-soft pt-4">
              <div className="flex flex-wrap gap-1.5">
                {story.skills.map((s) => (
                  <Chip key={`s-${s}`}>{s}</Chip>
                ))}
                {story.themes.map((t) => (
                  <Chip key={`t-${t}`} tone="moss">
                    {t}
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
  onConfirm?: () => void
}) {
  const [open, setOpen] = useState(false)
  const preview = story.result ?? story.actions ?? story.context

  return (
    <>
      <Card
        className="cursor-pointer p-4 transition-shadow hover:shadow-[0_2px_8px_rgba(35,32,25,0.08)]"
      >
        <div onClick={() => setOpen(true)}>
          <p className="font-display text-[15px] leading-snug">{story.title}</p>
          {preview && (
            <p className="mt-1.5 line-clamp-2 text-[12.5px] text-ink-soft">{preview}</p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {story.skills.slice(0, 3).map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
            <span className="text-[11px] text-ink-faint">read →</span>
          </div>
        </div>
        {!story.confirmed && onConfirm && (
          <div className="mt-3 border-t border-line-soft pt-3 text-right">
            <Button
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onConfirm()
              }}
            >
              <Check className="h-3.5 w-3.5" /> Confirm
            </Button>
          </div>
        )}
      </Card>
      <AnimatePresence>
        {open && (
          <StoryDialog story={story} onClose={() => setOpen(false)} onConfirm={onConfirm} />
        )}
      </AnimatePresence>
    </>
  )
}
