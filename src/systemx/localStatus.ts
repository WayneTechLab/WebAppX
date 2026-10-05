import { useCallback, useEffect, useState } from 'react'

export type SystemxTool = {
  command: string
  installed: boolean
  executable: string | null
  version: string
}

export type SystemxProvider = {
  name: string
  label: string
  state: 'ok' | 'warn' | 'muted' | 'planned' | string
  detail: string
}

export type SystemxStatus = {
  repository?: {
    branch?: string
    clean?: boolean
    changedFiles?: number
  }
  vite?: {
    listening?: boolean
    url?: string
  }
  session?: {
    id?: string
    lanUrl?: string
    appUrl?: string
    bridgeUrl?: string
    ownerPid?: number | null
    portPolicy?: string
    firebase?: {
      auth?: number
      firestore?: number
      storage?: number
    }
  }
  builder?: {
    mode?: string
    writable?: boolean
    currentTemplate?: boolean
    writePolicy?: string
    waves?: Array<{ title: string; detail: string }>
  }
  auth?: {
    mode?: string
    environment?: string
    projectId?: string
    emulatorUrl?: string
    ports?: {
      auth?: number
      firestore?: number
      storage?: number
    }
    emulatorOnline?: boolean
    defaultLocalProvider?: string
    localAllowedProviders?: string[]
    productionProviderCount?: number
    policy?: string
  }
  data?: {
    collections?: number
    users?: number
    pages?: number
    environment?: string
  }
  tooling?: SystemxTool[]
  providers?: SystemxProvider[]
  routes?: Array<{ path: string; source: string; kind: string; url: string }>
  workspace?: {
    pages?: Array<{ id: string; name: string; route: string | null; source: string; state: string }>
    components?: Array<{ id: string; name: string; source: string; status: string }>
  }
}

export type SystemxLocalStatusState = {
  status: SystemxStatus | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const LOCAL_STATUS_PATH = '/__systemx/api/status'

export async function fetchSystemxStatus(signal?: AbortSignal): Promise<SystemxStatus | null> {
  if (!import.meta.env.DEV) return null

  const response = await fetch(LOCAL_STATUS_PATH, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new Error(`SYSTEMX status request failed with HTTP ${response.status}`)
  }

  return (await response.json()) as SystemxStatus
}

export function useSystemxLocalStatus(enabled = true): SystemxLocalStatusState {
  const [status, setStatus] = useState<SystemxStatus | null>(null)
  const [loading, setLoading] = useState(enabled && import.meta.env.DEV)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled || !import.meta.env.DEV) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const nextStatus = await fetchSystemxStatus()
      setStatus(nextStatus)
      setError(null)
    } catch {
      setStatus(null)
      setError('SYSTEMX LAN status is unavailable. Start the owned local session to reconnect.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !import.meta.env.DEV) {
      return undefined
    }

    const initialLoad = window.setTimeout(() => void refresh(), 0)
    const interval = window.setInterval(() => void refresh(), 8000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
  }, [enabled, refresh])

  return { status, loading, error, refresh }
}

export function findSystemxTool(status: SystemxStatus | null, command: string) {
  return status?.tooling?.find((tool) => tool.command === command) ?? null
}

export function findSystemxProvider(status: SystemxStatus | null, name: string) {
  return status?.providers?.find((provider) => provider.name === name) ?? null
}

export function getSystemxBridgeUrl(status: SystemxStatus | null) {
  return status?.session?.bridgeUrl ?? '/__systemx/'
}
