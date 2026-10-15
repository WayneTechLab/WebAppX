import { useState } from 'react'
import { useUnsavedWork } from '@/portals/unsaved-work'

/** Match the native forms' surrounding-whitespace normalization, without
 * treating a filter, message or persisted domain record as temporary work. */
export function normalizeHrFormValue(value: unknown): string {
  function normalize(item: unknown): unknown {
    if (typeof item === 'string') return item.trim()
    if (Array.isArray(item)) return item.map(normalize)
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, normalize(nested)]))
    return item
  }
  return JSON.stringify(normalize(value))
}

/** The controller owns current and accepted values synchronously. A successful
 * in-memory action may clear a form before React renders or storage succeeds. */
export function createHrFormDraft<T>(initial: T, normalize: (value: T) => string = normalizeHrFormValue) {
  let current = initial
  let baseline = initial
  return {
    value: () => current,
    isDirty: () => normalize(current) !== normalize(baseline),
    change(next: T | ((previous: T) => T)) { current = typeof next === 'function' ? (next as (previous: T) => T)(current) : next; return current },
    accept(next: T = current) { baseline = next; current = next; return current },
    discard() { current = baseline; return current },
  }
}

export function focusHrForm(id: string) {
  const group = document.getElementById(id)
  if (!group) return
  for (let ancestor: HTMLElement | null = group; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'DETAILS') ancestor.setAttribute('open', '')
  }
  group.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])')?.focus()
}

export function useHrFormDraft<T>({ id, label, initial, normalize, enabled = true, reveal }: {
  id: string; label: string; initial: T; normalize?: (value: T) => string; enabled?: boolean; reveal?: () => void
}) {
  const [draft] = useState(() => createHrFormDraft(initial, normalize))
  const [value, render] = useState(initial)
  const setValue = (next: T | ((previous: T) => T)) => render(draft.change(next))
  const accept = (next: T = draft.value()) => render(draft.accept(next))
  const discard = () => render(draft.discard())
  useUnsavedWork({ id, portal: 'hr', label, isDirty: () => enabled && draft.isDirty(), discard, focus: () => {
    reveal?.()
    window.requestAnimationFrame(() => focusHrForm(id))
  } })
  return { id, value, setValue, accept, discard, dirty: enabled && draft.isDirty() }
}
