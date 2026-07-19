// Small shared design-system primitives for the dossier look.

import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
      {children}
    </div>
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
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger'
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles = {
    primary:
      'bg-moss text-white hover:bg-moss-deep disabled:bg-ink-faint border border-transparent',
    ghost:
      'bg-transparent text-ink border border-line hover:border-ink-faint hover:bg-line-soft',
    quiet: 'bg-transparent text-ink-soft hover:text-ink border border-transparent',
    danger: 'bg-transparent text-clay border border-transparent hover:bg-clay-soft',
  }[variant]
  return (
    <button
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
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
    <span className="inline-flex items-center gap-1.5" title={`confidence ${pct}%`}>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-line">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[11px] tabular-nums text-ink-faint">{pct}</span>
    </span>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-ink-soft">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-line border-t-moss" />
      {label}
    </span>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-16 text-center">
      <p className="font-display text-lg text-ink-soft italic">{title}</p>
      {children && <div className="mt-3 text-[13px] text-ink-faint">{children}</div>}
    </div>
  )
}
