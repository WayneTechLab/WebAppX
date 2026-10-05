import { useEffect, useState } from 'react'

export type TextScale = 'default' | 'large' | 'x-large'
export type Spacing = 'default' | 'relaxed'
export type Contrast = 'default' | 'high'
export type Motion = 'system' | 'reduced'

export type AccessibilityPreferences = {
  textScale: TextScale
  lineSpacing: Spacing
  letterSpacing: Spacing
  contrast: Contrast
  motion: Motion
}

const STORAGE_KEY = 'sfwa-wtl:accessibility-preferences'

export const defaultAccessibilityPreferences: AccessibilityPreferences = {
  textScale: 'default',
  lineSpacing: 'default',
  letterSpacing: 'default',
  contrast: 'default',
  motion: 'system',
}

function readPreferences(): AccessibilityPreferences {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return defaultAccessibilityPreferences

    const parsed = JSON.parse(saved) as Partial<AccessibilityPreferences>
    return { ...defaultAccessibilityPreferences, ...parsed }
  } catch {
    return defaultAccessibilityPreferences
  }
}

function applyPreferences(preferences: AccessibilityPreferences) {
  const root = document.documentElement
  root.dataset.wtlTextScale = preferences.textScale
  root.dataset.wtlLineSpacing = preferences.lineSpacing
  root.dataset.wtlLetterSpacing = preferences.letterSpacing
  root.dataset.wtlContrast = preferences.contrast
  root.dataset.wtlMotion = preferences.motion
}

export function useAccessibilityPreferences() {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(readPreferences)

  useEffect(() => {
    applyPreferences(preferences)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      // Private browsing or a locked-down browser can reject local storage.
      // The preferences still apply for the active session.
    }
  }, [preferences])

  function updatePreference<Key extends keyof AccessibilityPreferences>(
    key: Key,
    value: AccessibilityPreferences[Key],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  function resetPreferences() {
    setPreferences(defaultAccessibilityPreferences)
  }

  return { preferences, resetPreferences, updatePreference }
}
