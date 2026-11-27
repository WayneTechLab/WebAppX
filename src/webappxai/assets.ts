import type { User } from 'firebase/auth'
import { auth, firebaseRuntime } from '@/config/firebase'
import release from './release.json'

type PilotFile = keyof typeof release.assets
type CachedPair = { model: ArrayBuffer; tokenizer: ArrayBuffer }
const cacheName = 'webappxai-pilot-assets-v1'
const storeName = 'releases'
let deleteGeneration = 0

async function inCache<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
  signal?: AbortSignal,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const opening = indexedDB.open(cacheName, 1)
    opening.onupgradeneeded = () => opening.result.createObjectStore(storeName)
    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(opening.error)
  })
  try {
    signal?.throwIfAborted()
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const abort = () => {
        try { tx.abort() } catch { /* The transaction has already committed. */ }
      }
      signal?.addEventListener('abort', abort, { once: true })
      const request = operation(tx.objectStore(storeName))
      tx.oncomplete = () => {
        signal?.removeEventListener('abort', abort)
        resolve(request.result)
      }
      tx.onabort = () => {
        signal?.removeEventListener('abort', abort)
        reject(tx.error ?? new Error('Pilot cache operation cancelled.'))
      }
    })
  } finally {
    db.close()
  }
}

async function verify(name: PilotFile, value: unknown): Promise<ArrayBuffer> {
  const asset = release.assets[name]
  if (!(value instanceof ArrayBuffer) || value.byteLength !== asset.bytes) {
    throw new Error('The research pilot file has an unexpected size.')
  }
  const digest = await crypto.subtle.digest('SHA-256', value)
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  if (hex !== asset.sha256) throw new Error('The research pilot file failed its integrity check.')
  return value
}

async function download(name: PilotFile, token: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const url = `/api/webappxai/${release.revision}/${name}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store', credentials: 'omit', mode: 'same-origin', redirect: 'error', referrerPolicy: 'no-referrer', signal,
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('Sign in again to load WebAppXai.')
    throw new Error('The research pilot files are unavailable. Ask the site owner to configure model access.')
  }
  if (!response.body) throw new Error('The research pilot download was empty.')
  const bytes = new Uint8Array(release.assets[name].bytes)
  const reader = response.body.getReader()
  let length = 0
  let complete = false
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) {
        complete = true
        break
      }
      if (length + value.length > bytes.length) throw new Error('The research pilot download exceeded its expected size.')
      bytes.set(value, length)
      length += value.length
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  if (length !== bytes.length) throw new Error('The research pilot download was incomplete.')
  return verify(name, bytes.buffer)
}

function parseTokenizer(bytes: ArrayBuffer): unknown {
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}

export async function loadPilotAssets(user: User, signal: AbortSignal): Promise<{ model: ArrayBuffer; tokenizer: unknown }> {
  const generation = deleteGeneration
  function checkSession() {
    signal.throwIfAborted()
    if (generation !== deleteGeneration || !auth || auth.currentUser !== user || user.isAnonymous || user.tenantId) {
      throw new Error('Sign in again to load WebAppXai.')
    }
  }
  checkSession()
  const key = JSON.stringify([firebaseRuntime.projectId, firebaseRuntime.environment, user.uid, release.revision])
  // Only the two generic release files are cached, and a new local account fetches its own copy.
  let cached: CachedPair | undefined
  try {
    cached = await inCache('readonly', store => store.get(key), signal)
  } catch {
    // Private browsing or storage policy can disable IndexedDB. Inference still works in memory.
  }
  checkSession()
  if (cached) {
    try {
      const model = await verify('model.onnx', cached.model)
      const tokenizer = parseTokenizer(await verify('tokenizer.json', cached.tokenizer))
      checkSession()
      return { model, tokenizer }
    } catch {
      checkSession()
      // Re-fetch and replace a stale or damaged entry after this explicit Load model action.
    }
  }
  const token = await user.getIdToken()
  checkSession()
  const model = await download('model.onnx', token, signal)
  checkSession()
  const tokenizerBytes = await download('tokenizer.json', token, signal)
  const tokenizer = parseTokenizer(tokenizerBytes)
  checkSession()
  try {
    await inCache('readwrite', store => {
      checkSession()
      // Keep one verified pair per browser origin. Replacement and eviction commit together.
      store.clear()
      return store.put({ model, tokenizer: tokenizerBytes } satisfies CachedPair, key)
    }, signal)
  } catch {
    // Quota limits only affect offline reuse.
  }
  checkSession()
  return { model, tokenizer }
}

export async function deletePilotAssets(): Promise<void> {
  ++deleteGeneration
  if (typeof indexedDB === 'undefined') return
  await inCache('readwrite', store => store.clear())
}
