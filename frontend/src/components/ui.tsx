// Shared primitives for the light-instrument system: rows on hairlines, state as vocabulary.

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { getErrorMessage } from '../api'

export function SectionLabel({
  children,
  as: Tag = 'div',
}: {
  children: ReactNode
  as?: 'div' | 'h2' | 'h3'
}) {
  return (
    <Tag className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
      {children}
    </Tag>
  )
}

export function SectionHeading({
  children,
  meta,
}: {
  children: ReactNode
  meta?: ReactNode
}) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <h2 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {children}
      </h2>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
      {meta && <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-ink-3">{meta}</span>}
    </div>
  )
}

/**
 * `fill` is required for any card inside a stretching parent (a grid row, an
 * `items-stretch` flex row). Without it the container grows to the row height
 * but its children stay at natural height, and the card's own background shows
 * through below a bottom-anchored footer. Pair it with `CardBody`.
 */
export function Card({
  children,
  className = '',
  fill = false,
}: {
  children: ReactNode
  className?: string
  fill?: boolean
}) {
  return (
    <div
      className={`rounded border border-line bg-ground ${fill ? 'flex h-full flex-col' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

/** The growing region of a `fill` card. Absorbs the slack so the footer sits flush. */
export function CardBody({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`flex min-h-0 flex-1 flex-col ${className}`}>{children}</div>
}

export function Row({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line py-2 last:border-b-0 ${className}`}>
      {children}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'confirm' | 'ghost' | 'quiet' | 'danger'
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles = {
    primary:
      'bg-work text-white hover:bg-work-deep active:bg-work-deep disabled:bg-panel disabled:text-ink-3',
    confirm:
      'border-line-firm bg-ground text-work hover:border-work-bright hover:bg-work-bright hover:text-white active:bg-work-deep group-hover:enabled:border-work-bright group-hover:enabled:bg-work-bright group-hover:enabled:text-white group-focus-within:enabled:border-work-bright group-focus-within:enabled:bg-work-bright group-focus-within:enabled:text-white disabled:border-transparent disabled:bg-panel disabled:text-ink-3',
    ghost:
      'border-line-firm bg-transparent text-ink hover:border-ink-3 hover:bg-panel active:bg-line',
    quiet:
      'border-transparent bg-transparent text-ink-3 hover:bg-panel hover:text-ink active:bg-line disabled:text-ink-3',
    danger:
      'border-transparent bg-transparent text-fail hover:bg-fail-soft active:bg-fail-soft disabled:text-ink-3',
  }[variant]
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-work-mark/30 disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  )
}

// Seven roles, each meaning exactly one thing. A hue never appears unless its state is true.
const CHIP_TONES = {
  neutral: 'bg-panel text-ink-3 ring-1 ring-inset ring-line',
  work: 'bg-work-soft text-work',
  done: 'bg-done-soft text-done',
  draft: 'bg-draft-soft text-draft',
  held: 'bg-held-soft text-held',
  fail: 'bg-fail-soft text-fail',
  learned: 'bg-learned-soft text-learned',
  // legacy aliases from the retired dossier palette
  moss: 'bg-done-soft text-done',
  amber: 'bg-draft-soft text-draft',
  clay: 'bg-fail-soft text-fail',
} as const

export type ChipTone = keyof typeof CHIP_TONES

export function Chip({
  tone = 'neutral',
  children,
}: {
  tone?: ChipTone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-px font-mono text-[10.5px] tracking-[0.02em] ${CHIP_TONES[tone]}`}
    >
      {children}
    </span>
  )
}

export function Confidence({ value }: { value: number | null }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  const tone = value >= 0.8 ? 'bg-done-mark' : value >= 0.5 ? 'bg-draft-mark' : 'bg-fail-mark'
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confidence: ${pct}%`}>
      <span className="h-1 w-10 overflow-hidden rounded-sm bg-line">
        <span className={`block h-full rounded-sm ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="font-mono text-[11px] tabular-nums text-ink-2">{(value).toFixed(2)}</span>
    </span>
  )
}

export function SkeletonRows({
  label = 'Loading content',
  rows = 4,
}: {
  label?: string
  rows?: number
}) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="border-b border-line py-3 last:border-b-0" aria-hidden="true">
          <div className="h-2.5 w-40 rounded-sm bg-line motion-safe:animate-pulse" />
          <div className="mt-2 h-2.5 w-2/3 rounded-sm bg-panel motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export function InlineError({
  error,
  message,
  recourse,
}: {
  error?: unknown
  message?: string
  recourse?: string
}) {
  if (!error && !message) return null
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[12px] leading-relaxed text-fail">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        {message ?? getErrorMessage(error)}
        {recourse && <span className="block text-ink-3">{recourse}</span>}
      </span>
    </p>
  )
}

export function QueryError({
  error,
  onRetry,
  title = "We couldn't load this page.",
  recourse = 'Nothing you entered was lost.',
}: {
  error: unknown
  onRetry: () => void
  title?: string
  recourse?: string
}) {
  return (
    <div role="alert" className="flex items-start gap-3 border-b border-line py-4">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-fail" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{title}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{getErrorMessage(error)}</p>
        <p className="text-[12.5px] leading-relaxed text-ink-3">{recourse}</p>
        <Button variant="ghost" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-14 text-center">
      <p className="text-[13.5px] text-ink">{title}</p>
      {children && <div className="mt-1.5 text-[12.5px] text-ink-3">{children}</div>}
    </div>
  )
}
