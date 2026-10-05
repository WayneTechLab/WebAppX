export function AboutPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        About
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        A neutral baseline for generated web apps.
      </h1>
      <p className="mt-5 text-lg leading-8 text-neutral-600">
        WebAppX is a basic template shell provided by Wayne Tech
        Lab LLC. It keeps the first screen simple, readable, and easy to replace
        with the real purpose of a generated app.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="border border-neutral-200 p-5">
          <h2 className="font-semibold">Included</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            React, Vite, TypeScript, routing, Firebase-ready config, CI scripts,
            and .SYSTEMX setup documentation.
          </p>
        </div>
        <div className="border border-neutral-200 p-5">
          <h2 className="font-semibold">Style</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Black, white, and gray only. No brand color is assumed by the base
            template.
          </p>
        </div>
      </div>
    </section>
  )
}
