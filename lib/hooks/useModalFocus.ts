'use client'

import { useEffect, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useModalFocus(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  initialFocusRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const container = containerRef.current
    const focusables = () =>
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true'
      )

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      const target = initialFocusRef?.current ?? focusables()[0] ?? container
      target?.focus()
    }, 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        container?.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const activeEl = document.activeElement

      if (event.shiftKey) {
        if (activeEl === first || !container?.contains(activeEl)) {
          event.preventDefault()
          last.focus()
        }
      } else {
        if (activeEl === last || !container?.contains(activeEl)) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    container?.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.clearTimeout(focusTimer)
      container?.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [containerRef, initialFocusRef, open])
}
