import { ACCOUNT_LEVELS, TEST_ACCOUNTS } from '@/auth/accountLevels'
import { useAccountLevel } from '@/auth/useAccountLevel'

export function LoginPage() {
  const { level, definition, capabilities, setLevel } = useAccountLevel()

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Unified Login
        </p>
        <h1 className="mt-4 text-3xl font-bold text-neutral-950 sm:text-5xl">
          Account levels for Firebase, Playwright, and setup checks.
        </h1>
        <p className="mt-5 text-base leading-7 text-neutral-600">
          This template starts with a local demo selector so projects can wire
          routes, menus, rules, and tests before live auth is connected. Replace
          the demo resolver with Firebase Auth custom claims during project setup.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-3">
          {ACCOUNT_LEVELS.map((item) => (
            <button
              key={item.level}
              type="button"
              onClick={() => setLevel(item.level)}
              className={`border p-5 text-left transition-colors ${
                level === item.level
                  ? 'border-neutral-950 bg-neutral-950 text-white'
                  : 'border-neutral-200 bg-white text-neutral-950 hover:bg-neutral-100'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  Level {item.level} - {item.label}
                </h2>
                <span className="text-sm font-medium">{item.account}</span>
              </div>
              <p className={`mt-3 text-sm leading-6 ${level === item.level ? 'text-neutral-200' : 'text-neutral-600'}`}>
                {item.description}
              </p>
            </button>
          ))}
        </div>

        <aside className="border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-neutral-950">Current state</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-neutral-500">Level</dt>
              <dd className="text-neutral-950">{level}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Label</dt>
              <dd className="text-neutral-950">{definition.label}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Login</dt>
              <dd className="text-neutral-950">{definition.loginState}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">MFA guidance</dt>
              <dd className="text-neutral-950">{capabilities.requiresMfa ? 'Required' : 'Optional'}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="mt-10 border border-neutral-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-neutral-950">Standard test accounts</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEST_ACCOUNTS.map((account) => (
            <div key={account.email} className="border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-950">{account.email}</p>
              <p className="mt-2 text-sm text-neutral-600">
                Level {account.level} / {account.role}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
