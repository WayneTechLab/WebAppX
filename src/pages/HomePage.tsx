import { AppLink } from '@/components/navigation/AppLink'

const sections = [
  'Reusable starter pages',
  'Firebase-ready configuration',
  'Unified account levels',
  'Documented setup process',
]

export function HomePage() {
  return (
    <>
      <section data-snap-label="Overview" className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Basic template
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-neutral-950 sm:text-6xl">
          WebAppX
        </h1>
        <p className="mt-6 text-lg leading-8 text-neutral-600">
          Template Provided by Wayne Tech Lab LLC. This is a clean, generic
          starting point for a simple web app with a small page set, neutral
          styling, and setup documentation ready to customize.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <AppLink
            to="/docs"
            className="rounded-md bg-neutral-950 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Read docs
          </AppLink>
          <AppLink
            to="/about"
            className="rounded-md border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-100"
          >
            About template
          </AppLink>
          <AppLink
            to="/login"
            className="rounded-md border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-100"
          >
            Unified Login
          </AppLink>
        </div>
        </div>
      </section>

      <section data-snap-label="Included" className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="border-y border-neutral-200 py-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Included</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">A clean, adaptable foundation.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sections.map((item) => (
              <div key={item} className="border border-neutral-200 bg-white p-6">
                <h3 className="text-base font-semibold text-neutral-950">{item}</h3>
                <p className="mt-3 text-sm leading-6 text-neutral-600">
                  Replace this text with project-specific copy when generating a new
                  app from the stack.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section data-snap-label="Start here" className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="max-w-3xl border-l-4 border-neutral-950 pl-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Start here</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Build your project with a consistent operating standard.
          </h2>
          <p className="mt-4 leading-7 text-neutral-600">
            Use the top-left control to move through this page, the top-right menu
            for site navigation, and the lower controls for help, accessibility,
            and page travel.
          </p>
        </div>
      </section>
    </>
  )
}
