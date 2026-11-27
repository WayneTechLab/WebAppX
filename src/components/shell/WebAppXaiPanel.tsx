import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import type { User } from 'firebase/auth'
import { createPilotWorker } from '@waynetechlab/webappxai'
import { useFirebaseAuth } from '@/auth/useFirebaseAuth'
import { auth } from '@/config/firebase'
import { AppLink } from '@/components/navigation/AppLink'

type Message = { role: 'user' | 'assistant'; content: string }
type Phase = 'idle' | 'loading' | 'ready' | 'generating' | 'stopping' | 'deleting'
type Session = { controller: AbortController; worker?: Worker }
type WorkerReply =
  | { type: 'ready' }
  | { type: 'chunk' | 'done'; text: string; stopped?: boolean }
  | { type: 'error'; message: string }

const button = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50'
const primaryButton = 'inline-flex min-h-10 items-center justify-center rounded-lg bg-neutral-950 px-3 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50'
const secondaryButton = 'min-h-10 rounded px-1 text-sm text-neutral-700 underline underline-offset-2 focus-visible:outline-2 disabled:opacity-50'

function release(sessionRef: RefObject<Session | null>) {
  const session = sessionRef.current
  sessionRef.current = null
  session?.controller.abort()
  session?.worker?.terminate()
}

async function loadWasm(signal: AbortSignal) {
  const response = await fetch('/webappxai/runtime/ort-wasm-simd-threaded.wasm', {
    mode: 'same-origin', redirect: 'error', signal,
  })
  if (!response.ok) throw new Error('Runtime unavailable')
  return response.arrayBuffer()
}

function PilotChat({ user }: { user: User }) {
  const sessionRef = useRef<Session | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState('')
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [partial, setPartial] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const followLatest = useRef(true)
  const streaming = phase === 'generating' || phase === 'stopping'
  const loaded = phase === 'ready' || streaming

  useEffect(() => () => release(sessionRef), [])

  useEffect(() => {
    const log = logRef.current
    if (log && followLatest.current) log.scrollTop = log.scrollHeight
  }, [messages, partial])

  function isCurrent(session: Session) {
    return sessionRef.current === session && auth?.currentUser?.uid === user.uid
  }

  function clearChat() {
    setMessages([])
    setPartial('')
    setPrompt('')
  }

  function unload(notice: string) {
    release(sessionRef)
    clearChat()
    setPhase('idle')
    setStatus(notice)
  }

  async function loadModel() {
    if (sessionRef.current || auth?.currentUser?.uid !== user.uid) return
    if (!window.isSecureContext || !window.crypto.subtle || typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') {
      setStatus('This browser needs a secure connection, Web Workers and WebAssembly to run the pilot.')
      return
    }
    const session: Session = { controller: new AbortController() }
    sessionRef.current = session
    setPhase('loading')
    setStatus('Loading and verifying the model…')
    try {
      const { loadPilotAssets } = await import('@/webappxai/assets')
      if (!isCurrent(session)) return
      const [{ model, tokenizer }, wasm] = await Promise.all([
        loadPilotAssets(user, session.controller.signal),
        loadWasm(session.controller.signal),
      ])
      if (!isCurrent(session)) return
      const worker = createPilotWorker()
      session.worker = worker
      const failed = () => {
        if (isCurrent(session)) unload('The local model stopped. Load it again or use the FAQ.')
      }
      worker.onerror = failed
      worker.onmessageerror = failed
      worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
        if (!isCurrent(session)) return
        switch (data.type) {
          case 'ready':
            setPhase('ready')
            setStatus('Ready on this device.')
            break
          case 'chunk':
            setPartial(data.text)
            break
          case 'done':
            if (data.text) setMessages(previous => [...previous, { role: 'assistant', content: data.text }])
            setPartial('')
            setPhase('ready')
            setStatus(data.stopped ? 'Reply stopped.' : data.text ? 'Reply complete.' : 'The pilot returned an empty reply.')
            break
          case 'error':
            failed()
            break
        }
      }
      worker.postMessage({ type: 'load', model, tokenizer, wasm }, [model, wasm])
    } catch {
      if (isCurrent(session)) unload('Could not load the pilot. Check your connection and model access, then try again.')
    }
  }

  async function deleteModel() {
    if (auth?.currentUser?.uid !== user.uid || phase === 'deleting') return
    unload('Deleting the saved model…')
    setPhase('deleting')
    const session: Session = { controller: new AbortController() }
    sessionRef.current = session
    try {
      const { deletePilotAssets } = await import('@/webappxai/assets')
      if (!isCurrent(session)) return
      await deletePilotAssets()
      if (isCurrent(session)) unload('Downloaded model deleted.')
    } catch {
      if (isCurrent(session)) unload('Could not delete the saved model. Please try again.')
    }
  }

  function send(event: FormEvent) {
    event.preventDefault()
    const session = sessionRef.current
    const content = prompt.trim()
    if (phase !== 'ready' || !content || !session?.worker || !isCurrent(session)) return
    const next: Message[] = [...messages, { role: 'user', content }]
    followLatest.current = true
    setMessages(next)
    setPrompt('')
    setPartial('')
    setPhase('generating')
    setStatus('Generating on this device…')
    session.worker.postMessage({ type: 'generate', messages: next.slice(-8) })
  }

  function stop() {
    const session = sessionRef.current
    if (phase !== 'generating' || !session?.worker || !isCurrent(session)) return
    session.worker.postMessage({ type: 'stop' })
    setPhase('stopping')
    setStatus('Stopping reply…')
  }

  return (
    <>
      {!loaded && (
        <>
          <p className="text-xs leading-relaxed text-neutral-600">
            First load uses 20.85 MB for the model, 0.27 MB for its tokenizer and about 15 MB for the browser runtime.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {phase === 'loading'
              ? <button type="button" className={button} onClick={() => unload('Loading canceled.')}>Cancel load</button>
              : <button type="button" className={primaryButton} disabled={phase === 'deleting'} onClick={loadModel}>Load model</button>}
            {phase !== 'loading' && <button type="button" className={secondaryButton} disabled={phase === 'deleting'} onClick={deleteModel}>Delete downloaded model</button>}
          </div>
        </>
      )}
      {loaded && (
        <>
          <p className="text-xs text-neutral-600">Messages stay on this device. Closing Help desk clears this conversation.</p>
          <div
            role="log"
            aria-label="Local conversation"
            ref={logRef}
            onScroll={({ currentTarget: log }) => {
              followLatest.current = log.scrollHeight - log.clientHeight - log.scrollTop < 12
            }}
            className="max-h-44 space-y-2 overflow-y-auto break-words text-sm"
          >
            {messages.map((message, index) => (
              <p key={index} className="whitespace-pre-wrap">
                <strong>{message.role === 'user' ? 'You' : 'WebAppXai'}</strong>{' · '}{message.content}
              </p>
            ))}
            {partial && <p aria-hidden="true" className="whitespace-pre-wrap"><strong>WebAppXai</strong>{' · '}{partial}</p>}
          </div>
          <form onSubmit={send} className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="wtl-pilot-prompt">Message</label>
            <textarea
              id="wtl-pilot-prompt"
              rows={2}
              maxLength={2000}
              autoComplete="off"
              spellCheck={false}
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              className="block w-full resize-y rounded-lg border border-neutral-300 bg-white p-2 text-base focus-visible:outline-2"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={phase !== 'ready' || !prompt.trim()} className={primaryButton}>Send locally</button>
              {streaming && <button type="button" className={button} disabled={phase === 'stopping'} onClick={stop}>Stop</button>}
              <button type="button" className={secondaryButton} disabled={streaming || (!prompt && !messages.length)} onClick={clearChat}>Clear chat</button>
            </div>
          </form>
          <div className="flex flex-wrap gap-x-3">
            <button type="button" className={secondaryButton} onClick={() => unload('Model unloaded. Conversation cleared.')}>Unload model</button>
            <button type="button" className={secondaryButton} onClick={deleteModel}>Delete downloaded model</button>
          </div>
        </>
      )}
      <p role="status" className="text-xs font-medium text-neutral-700 empty:hidden">{status}</p>
    </>
  )
}

export function WebAppXaiPanel({ closeHelp }: { closeHelp: () => void }) {
  const { user, loading } = useFirebaseAuth()
  return (
    <section aria-label="WebAppXai" className="mt-3 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-neutral-950">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="font-semibold">WebAppXai</h3>
        <span className="text-xs font-semibold text-neutral-600">Research pilot</span>
      </div>
      <p className="text-sm text-neutral-700">This local model matched 2 of 10 reference answers in testing. Replies can be incorrect.</p>
      {loading
        ? <p role="status" className="text-sm">Checking sign-in…</p>
        : user && !user.isAnonymous
          ? <PilotChat key={user.uid} user={user} />
          : <AppLink to="/login" onClick={closeHelp} className={button}>Sign in to load model</AppLink>}
    </section>
  )
}
