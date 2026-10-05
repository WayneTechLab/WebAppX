const services = [
  'Template setup',
  'Page scaffolding',
  'Firebase configuration',
  'Deployment preparation',
]

export function ServicesPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Services
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        Generic service placeholders.
      </h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-neutral-600">
        Use this page to describe what a generated app or business offers. The
        content below is intentionally plain and replaceable.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {services.map((service) => (
          <div key={service} className="border border-neutral-200 p-5">
            <h2 className="font-semibold">{service}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Add project-specific details, pricing, process, or supporting
              links here.
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
