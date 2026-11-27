'use client'

// Keyboard rules for anything that sits over the page (dialogs, phone drawers): while `active`,
// focus moves inside on open (unless something inside already has it), Tab and Shift+Tab wrap
// inside, Escape calls `onEscape` (when given), and focus goes back to the opener on close.
import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

function focusables(box: HTMLElement) {
  return [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    el => !el.closest('[inert]') && el.getClientRects().length > 0,
  )
}

export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  const escape = useRef(onEscape)
  useEffect(() => {
    escape.current = onEscape
  })

  useEffect(() => {
    if (!active) return
    const box = ref.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (box && !box.contains(document.activeElement)) {
      // A container with tabIndex=-1 takes focus itself (a dialog sheet); otherwise its first control.
      if (box.tabIndex === -1 && box.hasAttribute('tabindex')) box.focus({ preventScroll: true })
      else focusables(box)[0]?.focus({ preventScroll: true })
    }

    const onKey = (e: KeyboardEvent) => {
      const el = ref.current
      if (!el) return
      if (e.key === 'Escape' && escape.current) {
        escape.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables(el)
      if (!items.length) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const at = document.activeElement
      if (!el.contains(at) || at === el) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && at === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && at === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [active, ref])
}
