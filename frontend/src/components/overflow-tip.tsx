// Reveals the full text of a field that is visually cut off.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    const onChange = (event: MediaQueryListEvent) => setCoarse(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return coarse
}

/**
 * Two strategies, because hover does not exist on touch.
 *
 * Fine pointer: a tooltip on hover or focus, portalled to `document.body`. Fact
 * rows sit inside an `overflow-hidden` card, and the row itself is a
 * `motion.div` whose transform creates a containing block — so neither absolute
 * nor fixed positioning escapes on its own.
 *
 * Coarse pointer: no tooltip. The full value is rendered wrapped beneath the
 * field whenever it overflows, so it needs no interaction and never fights the
 * on-screen keyboard.
 */
export function useOverflowTip<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null)
  const id = useId()
  const coarse = useCoarsePointer()
  const [overflows, setOverflows] = useState(false)
  const [box, setBox] = useState<{
    top: number
    left: number
    width: number
    above: boolean
  } | null>(null)

  // Measured continuously so the coarse-pointer fallback knows when to appear.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])

  const open = useCallback(() => {
    const el = ref.current
    if (!el || !text || coarse) return
    if (el.scrollWidth <= el.clientWidth + 1) return
    const rect = el.getBoundingClientRect()
    const above = rect.bottom + 120 > window.innerHeight
    setBox({
      top: above ? rect.top - 6 : rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      above,
    })
  }, [text, coarse])

  const close = useCallback(() => setBox(null), [])

  useEffect(() => {
    if (!box) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [box, close])

  const showInline = coarse && overflows && !!text

  const triggerProps = {
    ref,
    onMouseEnter: open,
    onMouseLeave: close,
    onFocus: open,
    onBlur: close,
    'aria-describedby': box || showInline ? id : undefined,
  }

  const tip =
    box && !coarse
      ? createPortal(
          <div
            id={id}
            role="tooltip"
            style={{
              top: box.top,
              left: box.left,
              maxWidth: Math.max(box.width, 280),
              transform: box.above ? 'translateY(-100%)' : undefined,
            }}
            className="pointer-events-none fixed z-50 rounded border border-line-firm bg-ground px-2.5 py-1.5 text-[12.5px] leading-relaxed break-words text-ink shadow-[0_4px_14px_rgba(35,32,25,0.14)]"
          >
            {text}
          </div>,
          document.body,
        )
      : null

  const inline = showInline ? (
    <p
      id={id}
      className="mt-1.5 rounded bg-panel px-2.5 py-1.5 text-[12.5px] leading-relaxed break-words text-ink-2"
    >
      {text}
    </p>
  ) : null

  return { triggerProps, tip, inline, overflows }
}
