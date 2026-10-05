import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Settings2, X } from 'lucide-react'
import {
  type AccessibilityPreferences,
  useAccessibilityPreferences,
} from '@/hooks/useAccessibilityPreferences'

type PreferenceOption<Key extends keyof AccessibilityPreferences> = {
  label: string
  value: AccessibilityPreferences[Key]
}

const textScaleOptions: PreferenceOption<'textScale'>[] = [
  { label: 'Default', value: 'default' },
  { label: 'Large', value: 'large' },
  { label: 'Extra large', value: 'x-large' },
]

const spacingOptions: PreferenceOption<'lineSpacing'>[] = [
  { label: 'Default', value: 'default' },
  { label: 'Relaxed', value: 'relaxed' },
]

const contrastOptions: PreferenceOption<'contrast'>[] = [
  { label: 'Default', value: 'default' },
  { label: 'High contrast', value: 'high' },
]

const motionOptions: PreferenceOption<'motion'>[] = [
  { label: 'System', value: 'system' },
  { label: 'Reduce motion', value: 'reduced' },
]

function PreferenceGroup<Key extends keyof AccessibilityPreferences>({
  label,
  options,
  preferenceKey,
  preferences,
  updatePreference,
}: {
  label: string
  options: PreferenceOption<Key>[]
  preferenceKey: Key
  preferences: AccessibilityPreferences
  updatePreference: <PreferenceKey extends keyof AccessibilityPreferences>(
    key: PreferenceKey,
    value: AccessibilityPreferences[PreferenceKey],
  ) => void
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-neutral-900">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = preferences[preferenceKey] === option.value
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={selected}
              onClick={() => updatePreference(preferenceKey, option.value)}
              className={`min-h-10 rounded-md border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 ${
                selected
                  ? 'border-neutral-950 bg-neutral-950 text-white'
                  : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function AccessibilityPageControl({ showPageTravel }: { showPageTravel: boolean }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { preferences, resetPreferences, updatePreference } = useAccessibilityPreferences()

  // Vite preserves component state during a hot update. Reset this purely
  // visual dock when its module refreshes so the local preview shows the
  // default single-cog state after a control-layout change.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOpen(false))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function scrollToPosition(position: 'top' | 'bottom') {
    const reducedMotion = document.documentElement.dataset.wtlMotion === 'reduced'
    window.scrollTo({
      top: position === 'top' ? 0 : document.documentElement.scrollHeight,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <div
      ref={panelRef}
      className="fixed bottom-3 right-3 z-40 flex flex-col items-end gap-2 sm:bottom-4 sm:right-4"
      data-wtl-control="accessibility"
      {...(import.meta.env.DEV
        ? {
            'data-systemx-component': 'Accessibility Controls',
            'data-systemx-source': 'src/components/shell/AccessibilityPageControl.tsx',
            'data-systemx-reusable': 'shell',
          }
        : {})}
    >
      {open && (
        <section
          id="wtl-accessibility-panel"
          aria-label="Accessibility and page controls"
          className="w-[min(23rem,calc(100vw-1.5rem))] rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-neutral-950">Accessibility</h2>
              <p className="mt-1 text-sm leading-5 text-neutral-600">
                Save reading preferences on this device.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close accessibility controls"
              className="grid min-h-10 min-w-10 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <PreferenceGroup
              label="Text size"
              options={textScaleOptions}
              preferenceKey="textScale"
              preferences={preferences}
              updatePreference={updatePreference}
            />
            <PreferenceGroup
              label="Line spacing"
              options={spacingOptions}
              preferenceKey="lineSpacing"
              preferences={preferences}
              updatePreference={updatePreference}
            />
            <PreferenceGroup
              label="Letter spacing"
              options={spacingOptions}
              preferenceKey="letterSpacing"
              preferences={preferences}
              updatePreference={updatePreference}
            />
            <PreferenceGroup
              label="Contrast"
              options={contrastOptions}
              preferenceKey="contrast"
              preferences={preferences}
              updatePreference={updatePreference}
            />
            <PreferenceGroup
              label="Motion"
              options={motionOptions}
              preferenceKey="motion"
              preferences={preferences}
              updatePreference={updatePreference}
            />
          </div>

          <button
            type="button"
            onClick={resetPreferences}
            className="mt-4 min-h-10 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            Reset preferences
          </button>
        </section>
      )}

      <div className="flex items-center gap-2">
        {showPageTravel && (
          <div
            className={`flex min-w-0 items-center gap-2 overflow-hidden transition-all duration-200 ${
              open
                ? 'w-24 opacity-100'
                : 'pointer-events-none w-0 opacity-0'
            }`}
          >
            <button
              type="button"
              onClick={() => scrollToPosition('top')}
              aria-label="Scroll to top of page"
              className="grid min-h-11 min-w-11 place-items-center rounded-full border border-neutral-300 bg-white text-neutral-900 shadow-lg transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              <ArrowUp className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollToPosition('bottom')}
              aria-label="Scroll to bottom of page"
              className="grid min-h-11 min-w-11 place-items-center rounded-full border border-neutral-300 bg-white text-neutral-900 shadow-lg transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              <ArrowDown className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
        <button
          type="button"
          aria-controls="wtl-accessibility-panel"
          aria-expanded={open}
          aria-label={open ? 'Close accessibility controls' : 'Open accessibility controls'}
          onClick={() => setOpen((current) => !current)}
          className="grid min-h-11 min-w-11 place-items-center rounded-full bg-neutral-950 text-white shadow-lg transition hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          <Settings2 className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
