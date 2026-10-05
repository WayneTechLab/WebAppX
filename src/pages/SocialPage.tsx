import { ArrowUpRight, BookOpen, Github, Globe2, Share2 } from 'lucide-react'

const publicLinks = [
  {
    label: 'WayneTechLab.com',
    description: 'Company and product home for Wayne Tech Lab LLC.',
    href: 'https://WayneTechLab.com',
    icon: Globe2,
  },
  {
    label: 'GitHub template',
    description: 'Source repository for the public WebAppX.',
    href: 'https://github.com/WayneTechLab/WebAppX',
    icon: Github,
  },
  {
    label: 'Template Wiki',
    description: 'Detailed setup, SYSTEMX, LAN, and contribution documentation.',
    href: 'https://github.com/WayneTechLab/WebAppX/wiki',
    icon: BookOpen,
  },
]

export function SocialPage() {
  return (
    <section data-snap-label="Social" className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <div className="max-w-3xl">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Social and public links
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 sm:text-5xl">
          Follow the public project trail.
        </h1>
        <p className="mt-5 text-lg leading-8 text-neutral-600">
          Use these public destinations for the company, source repository, and
          living documentation. Projects created from this template can replace
          or extend this list with their own approved links.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {publicLinks.map((link) => {
          const Icon = link.icon
          return (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="group flex min-h-48 flex-col justify-between border border-neutral-200 bg-white p-6 transition hover:border-neutral-950 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              <div>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-neutral-950 text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-6 text-xl font-semibold text-neutral-950">{link.label}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{link.description}</p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-950">
                Open public link
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </a>
          )
        })}
      </div>

      <aside className="mt-10 border border-neutral-200 bg-neutral-50 p-6 text-sm leading-6 text-neutral-600">
        <strong className="text-neutral-950">Template note:</strong> Social links
        are public destinations only. Private staff channels, customer data,
        provider credentials, and Level 4/5 operations remain behind the
        authenticated Login Portal and local SYSTEMX controls.
      </aside>
    </section>
  )
}
