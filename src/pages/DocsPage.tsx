const docs = [
  '.SYSTEMX/Unified-Setup-Process',
  '.SYSTEMX/Template/steps',
  'wiki/Setup-Playbook.md',
]

export function DocsPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Docs
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        Setup documentation lives with the template.
      </h1>
      <p className="mt-5 text-lg leading-8 text-neutral-600">
        Follow the .SYSTEMX setup process to configure tooling, Firebase,
        security, CI, deployment, and human/AI handoff.
      </p>
      <ul className="mt-10 divide-y divide-neutral-200 border-y border-neutral-200">
        {docs.map((doc) => (
          <li key={doc} className="py-4 font-mono text-sm text-neutral-700">
            {doc}
          </li>
        ))}
      </ul>
    </section>
  )
}
