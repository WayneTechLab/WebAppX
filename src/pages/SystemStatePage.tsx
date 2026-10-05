import { AppLink } from '@/components/navigation/AppLink'

export type SystemStateKey = 'forbidden' | 'server-error' | 'offline'

const systemStateContent: Record<
  SystemStateKey,
  { eyebrow: string; title: string; description: string; action: string }
> = {
  forbidden: {
    eyebrow: '403 · Access restricted',
    title: 'This page is not available for this account.',
    description:
      'The route exists, but the current account does not have the required authorization. Sign in with the correct account or return to a public page.',
    action: 'Return home',
  },
  'server-error': {
    eyebrow: '500 · Application error',
    title: 'The application could not complete that request.',
    description:
      'Try again, review the local diagnostics, and record the route and action if the problem continues. Do not include secrets in an issue or support request.',
    action: 'Return home',
  },
  offline: {
    eyebrow: 'Offline · Connection unavailable',
    title: 'The application is waiting for a connection.',
    description:
      'Check the local Vite, Firebase emulator, or network connection, then retry. The SYSTEMX LAN control surface can help inspect local development state.',
    action: 'Open documentation',
  },
}

type SystemStatePageProps = {
  state: SystemStateKey
}

export function SystemStatePage({ state }: SystemStatePageProps) {
  const content = systemStateContent[state]
  const actionPath = state === 'offline' ? '/docs' : '/'

  return (
    <section data-snap-label={content.eyebrow} className="mx-auto max-w-3xl px-4 py-24 text-center sm:py-32">
      <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {content.eyebrow}
      </p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
        {content.title}
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-neutral-600">
        {content.description}
      </p>
      <AppLink
        to={actionPath}
        className="mt-8 inline-flex rounded-md bg-neutral-950 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
      >
        {content.action}
      </AppLink>
    </section>
  )
}
