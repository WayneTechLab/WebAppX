import { type FormEvent, useState } from 'react'
import { AppLink } from '@/components/navigation/AppLink'
import { LocalStackStatus } from '@/components/systemx/LocalStackStatus'
import { AUTH_PROVIDER_REGISTRY } from '@/auth/authProviders'
import {
  createLocalEmailPasswordAccount,
  formatFirebaseAuthError,
  signInWithEmailPassword,
} from '@/auth/firebaseAuth'
import { useFirebaseAuth } from '@/auth/useFirebaseAuth'
import { useSystemxLocalStatus } from '@/systemx/localStatus'

export function LoginPage() {
  const { user, loading, level, definition, capabilities, firebaseRuntime, signOut } = useFirebaseAuth()
  const localStatus = useSystemxLocalStatus(import.meta.env.DEV)
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'create') {
        await createLocalEmailPasswordAccount(email, password)
        setMessage('Local Firebase account created and signed in.')
      } else {
        await signInWithEmailPassword(email, password)
        setMessage('Signed in through the local Firebase Auth emulator.')
      }
      setPassword('')
    } catch (nextError) {
      setError(formatFirebaseAuthError(nextError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignOut() {
    setError('')
    setMessage('')
    await signOut()
    setMessage('Signed out of the local Firebase session.')
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div className="max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Unified Login · Firebase Auth
        </p>
        <h1 className="mt-4 text-3xl font-bold text-neutral-950 sm:text-5xl">
          One identity boundary for the WebApp and SYSTEMX LAN.
        </h1>
        <p className="mt-5 text-base leading-7 text-neutral-600">
          Day one uses Firebase Auth email and password against the local emulator.
          The provider contract remains visible here so a project can enable Google,
          passwordless email, trusted custom tokens, or approved SSO later without
          pretending those providers are ready in the local lane.
        </p>
      </div>

      {firebaseRuntime.useEmulators && (
        <div className="mt-8 border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-950">
          <p className="font-semibold">Local development lane</p>
          <p className="mt-2 leading-6">
            Project <code>{firebaseRuntime.projectId}</code> · Auth emulator{' '}
            <code>{localStatus.status?.auth?.emulatorUrl ?? firebaseRuntime.authEmulatorUrl}</code>. Only Email + password is
            enabled locally. Start the owned session with <code>npm run dev:systemx</code>;
            no production account or credential is used here.
          </p>
        </div>
      )}

      {import.meta.env.DEV && (
        <div className="mt-6">
          <LocalStackStatus {...localStatus} compact />
        </div>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          {loading ? (
            <p className="text-sm text-neutral-600">Checking Firebase session…</p>
          ) : user ? (
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Authenticated session
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-neutral-950">
                Welcome back.
              </h2>
              <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-neutral-500">Email</dt>
                  <dd className="mt-1 break-all text-neutral-950">{user.email ?? 'verified Firebase user'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-neutral-500">Account level</dt>
                  <dd className="mt-1 text-neutral-950">Level {level} · {definition.label}</dd>
                </div>
              </dl>
              <p className="mt-6 text-sm leading-6 text-neutral-600">
                Client state is only a convenience display. Firestore, Storage, Cloud
                Functions, and production admin routes must enforce claims and rules
                on the server.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                {capabilities.canAccessAdmin && (
                  <AppLink to="/admin" className="rounded-md bg-neutral-950 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800">
                    Open admin dashboard
                  </AppLink>
                )}
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="rounded-md border border-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={(event) => void handleSubmit(event)}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                    {mode === 'create' ? 'Create local account' : 'Sign in'}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-neutral-950">
                    Firebase email + password
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'create' ? 'sign-in' : 'create')
                    setError('')
                    setMessage('')
                  }}
                  className="text-sm font-semibold text-neutral-700 underline underline-offset-4 hover:text-neutral-950"
                >
                  {mode === 'create' ? 'I already have an account' : 'Create local account'}
                </button>
              </div>

              <div className="mt-7 grid gap-5">
                <label className="grid gap-2 text-sm font-medium text-neutral-800">
                  Email
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="min-h-12 rounded-md border border-neutral-300 px-3 text-base text-neutral-950 outline-none focus:border-neutral-950 focus:ring-2 focus:ring-neutral-200"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-neutral-800">
                  Password
                  <input
                    required
                    minLength={6}
                    type="password"
                    autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-h-12 rounded-md border border-neutral-300 px-3 text-base text-neutral-950 outline-none focus:border-neutral-950 focus:ring-2 focus:ring-neutral-200"
                  />
                </label>
              </div>

              {error && <p className="mt-5 border border-red-300 bg-red-50 p-3 text-sm leading-6 text-red-900" role="alert">{error}</p>}
              {message && <p className="mt-5 border border-emerald-300 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900" role="status">{message}</p>}

              <button
                type="submit"
                disabled={submitting || !firebaseRuntime.authAvailable}
                className="mt-7 min-h-12 rounded-md bg-neutral-950 px-5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {submitting ? 'Working…' : mode === 'create' ? 'Create local account' : 'Sign in'}
              </button>
              {!firebaseRuntime.authAvailable && (
                <p className="mt-3 text-sm text-neutral-600">Configure a Firebase project in <code>.env.local</code> to enable this form outside local development.</p>
              )}
            </form>
          )}
        </div>

        <aside className="border border-neutral-200 bg-neutral-50 p-5">
          <h2 className="text-lg font-semibold text-neutral-950">Provider readiness</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            This matrix is shared with the local management surface and is the
            source for its provider readiness view.
          </p>
          <div className="mt-5 grid gap-3">
            {AUTH_PROVIDER_REGISTRY.providers.map((provider) => {
              const liveLocalProvider = localStatus.status?.auth?.localAllowedProviders?.includes(provider.id)
              const enabledLocally = localStatus.status
                ? Boolean(localStatus.status.auth?.emulatorOnline && liveLocalProvider)
                : firebaseRuntime.useEmulators && provider.localState === 'enabled'
              return (
                <article key={provider.id} className="border border-neutral-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-neutral-950">{provider.label}</h3>
                    <span className={`rounded-full px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-wide ${enabledLocally ? 'bg-emerald-100 text-emerald-900' : 'bg-neutral-100 text-neutral-600'}`}>
                      {enabledLocally ? 'local ready' : provider.localState}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-neutral-600">
                    {firebaseRuntime.useEmulators ? provider.localNote : provider.productionNote}
                  </p>
                </article>
              )
            })}
          </div>
        </aside>
      </div>

      <div className="mt-8 border border-neutral-200 bg-white p-5 text-sm leading-6 text-neutral-600">
        <strong className="text-neutral-950">Admin and builder boundary:</strong>{' '}
        Level 4/5 access is claim- and rule-controlled. Once authenticated, an
        authorized operator can use the local admin shell and open the SYSTEMX LAN
        builder. The LAN remains loopback-only and its local fixture records are not
        Firebase production data.
      </div>
    </section>
  )
}
