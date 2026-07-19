// Small shared design-system primitives for the dossier look.

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
    <Tag className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
      {children}
    </Tag>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(35,32,25,0.04)] ${className}`}>
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
      'bg-moss text-white hover:bg-moss-deep active:bg-moss-deep disabled:border-line disabled:bg-line-soft disabled:text-ink-soft',
    confirm:
      'border-line bg-surface text-moss hover:border-moss hover:bg-moss hover:text-white active:bg-moss-deep group-hover:enabled:border-moss group-hover:enabled:bg-moss group-hover:enabled:text-white group-focus-within:enabled:border-moss group-focus-within:enabled:bg-moss group-focus-within:enabled:text-white disabled:border-line disabled:bg-line-soft disabled:text-ink-soft',
    ghost:
      'border-line bg-transparent text-ink hover:border-ink-soft hover:bg-line-soft active:bg-line',
    quiet:
      'border-transparent bg-transparent text-ink-soft hover:text-ink active:bg-line-soft disabled:text-ink-faint',
    danger:
      'border-transparent bg-transparent text-clay hover:bg-clay-soft active:bg-clay-soft disabled:text-ink-faint',
  }[variant]
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  )
}

export function Chip({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'moss' | 'amber' | 'clay'
  children: ReactNode
}) {
  const styles = {
    neutral: 'bg-line-soft text-ink-soft',
    moss: 'bg-moss-soft text-moss-deep',
    amber: 'bg-amber-soft text-amber',
    clay: 'bg-clay-soft text-clay',
  }[tone]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles}`}>
      {children}
    </span>
  )
}

export function Confidence({ value }: { value: number | null }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  const tone = value >= 0.8 ? 'bg-moss' : value >= 0.5 ? 'bg-amber' : 'bg-clay'
  return (
    <span className="inline-flex items-center gap-1.5" title={`Confidence: ${pct}%`}>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-line">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[11px] tabular-nums text-ink-soft">{pct}%</span>
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
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(35,32,25,0.04)]"
          aria-hidden="true"
        >
          <div className="h-3 w-28 rounded bg-line motion-safe:animate-pulse" />
          <div className="mt-3 h-3 w-full rounded bg-line-soft motion-safe:animate-pulse" />
          <div className="mt-2 h-3 w-2/3 rounded bg-line-soft motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export function InlineError({ error, message }: { error?: unknown; message?: string }) {
  if (!error && !message) return null
  return (
    <p role="alert" className="flex items-start gap-1.5 text-[12px] leading-relaxed text-clay">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message ?? getErrorMessage(error)}</span>
    </p>
  )
}

export function QueryError({
  error,
  onRetry,
  title = "We couldn't load this page.",
}: {
  error: unknown
  onRetry: () => void
  title?: string
}) {
  return (
    <Card className="p-5" >
      <div role="alert" className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-clay" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink">{title}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
            {getErrorMessage(error)}
          </p>
          <Button variant="ghost" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    </Card>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-16 text-center">
      <p className="font-display text-lg text-ink-soft italic">{title}</p>
      {children && <div className="mt-3 text-[13px] text-ink-soft">{children}</div>}
    </div>
  )
}
