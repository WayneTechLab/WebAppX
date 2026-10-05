import { AppLink } from '@/components/navigation/AppLink'

export type StandardPageKey =
  | 'features'
  | 'faq'
  | 'support'
  | 'security'
  | 'accessibility'
  | 'privacy'
  | 'terms'
  | 'changelog'

type StandardPageSection = {
  heading: string
  body: string
  bullets?: string[]
}

type StandardPageContent = {
  eyebrow: string
  title: string
  description: string
  sections: StandardPageSection[]
}

const standardPageContent: Record<StandardPageKey, StandardPageContent> = {
  features: {
    eyebrow: 'Features',
    title: 'A standard foundation for project delivery.',
    description:
      'Use the template as a practical starting point for a Firebase-ready web application, then replace or extend each capability for the project you are building.',
    sections: [
      {
        heading: 'Product shell',
        body: 'The starter shell includes responsive layout, route-aware navigation, page controls, help access, and reusable content sections.',
      },
      {
        heading: 'Firebase-ready integration',
        body: 'Authentication, emulator-friendly configuration, Firestore, Storage, and deployment boundaries are structured for safe project-specific setup.',
      },
      {
        heading: 'SYSTEMX operating layer',
        body: 'The local SYSTEMX and LAN tooling provides setup, diagnostics, source inspection, quality gates, and evidence without becoming part of the public application build.',
      },
    ],
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Common questions before you start.',
    description:
      'These answers describe the generic template contract. Replace them with project-specific guidance as your application becomes defined.',
    sections: [
      {
        heading: 'Is this a finished product?',
        body: 'No. It is a reusable starting point. Each project owner is responsible for completing configuration, security, content, testing, legal review, and deployment decisions.',
      },
      {
        heading: 'Where should I begin?',
        body: 'Start with the repository README, the GitHub Wiki, and the ordered .SYSTEMX setup process. Run local checks before connecting production services.',
      },
      {
        heading: 'Can I use a different backend?',
        body: 'Yes. Firebase is the supported baseline, but the application boundary should keep provider-specific code replaceable and documented.',
      },
      {
        heading: 'Does SYSTEMX deploy with my website?',
        body: 'The local SYSTEMX LAN control surface is intentionally isolated from the production build. Only the public application output should be deployed.',
      },
    ],
  },
  support: {
    eyebrow: 'Support',
    title: 'A clear path when you need help.',
    description:
      'Use the project documentation and local diagnostics first, then record enough context for another person or agent to reproduce the issue.',
    sections: [
      {
        heading: 'Start with local evidence',
        body: 'Capture the command, route, platform, browser, error message, current branch, and the last passing quality check. Avoid including secrets or private environment values.',
        bullets: [
          'Run the SYSTEMX doctor and relevant quality gate.',
          'Check the local Vite, Firebase emulator, and LAN status.',
          'Record the smallest reproducible steps.',
        ],
      },
      {
        heading: 'Use the project knowledge base',
        body: 'Read the README, Wiki, .SYSTEMX documentation, and setup packets before changing provider or deployment configuration.',
      },
      {
        heading: 'Escalate responsibly',
        body: 'Use the project contribution or support process for unresolved issues. Never attach tokens, passwords, private keys, or complete environment files.',
      },
    ],
  },
  security: {
    eyebrow: 'Security',
    title: 'Security is part of the build, not a final checkbox.',
    description:
      'This page is a starter security overview. It does not certify an application and must be updated for the deployed project, data, users, providers, and applicable laws.',
    sections: [
      {
        heading: 'Protect secrets',
        body: 'Keep credentials in ignored local files, managed provider secret stores, or approved CI identity systems. Never commit API secrets, service-account keys, passwords, or tokens.',
      },
      {
        heading: 'Protect access',
        body: 'Use Firebase Authentication and server-side authorization checks for protected data and staff functions. A hidden menu item is not an authorization boundary.',
      },
      {
        heading: 'Protect deployment',
        body: 'Run quality, dependency, build-isolation, and deployment preflight checks before publishing. Verify the target project and account every time.',
      },
      {
        heading: 'Report responsibly',
        body: 'Do not publish sensitive vulnerability details in a public issue. Follow the repository SECURITY.md process when available.',
      },
    ],
  },
  accessibility: {
    eyebrow: 'Accessibility',
    title: 'A usable interface for more people.',
    description:
      'The template provides an accessibility starting point, but every project owner must test the final content, interactions, contrast, keyboard flow, and assistive-technology experience.',
    sections: [
      {
        heading: 'Keyboard and focus',
        body: 'Interactive controls should be reachable, visibly focused, logically ordered, and usable without a pointer.',
      },
      {
        heading: 'Content and structure',
        body: 'Use meaningful headings, labels, link text, alternative text, error messages, and landmarks. Do not use color as the only way to communicate state.',
      },
      {
        heading: 'User controls',
        body: 'The template includes controls for text scale, spacing, contrast, motion, and page travel. Confirm that project-specific components respect those settings.',
      },
      {
        heading: 'Project responsibility',
        body: 'Review the accessibility requirements that apply to your organization, jurisdiction, audience, and service before launch.',
      },
    ],
  },
  privacy: {
    eyebrow: 'Legal starter',
    title: 'Privacy notice placeholder.',
    description:
      'This is a template starting point, not a completed privacy policy or legal advice. Replace it with a reviewed notice that accurately describes your project.',
    sections: [
      {
        heading: 'Describe your data practices',
        body: 'Document what information the project collects, why it is collected, how long it is retained, who can access it, and which providers process it.',
      },
      {
        heading: 'Document user choices',
        body: 'Explain applicable access, correction, deletion, consent, communication, and account-control choices in language your users can understand.',
      },
      {
        heading: 'Complete before launch',
        body: 'Have the final notice reviewed for the project, jurisdictions, users, data categories, analytics, cookies, authentication, payments, and external providers.',
      },
    ],
  },
  terms: {
    eyebrow: 'Legal starter',
    title: 'Terms of use placeholder.',
    description:
      'This starter page is not a finished agreement. Replace it with terms reviewed for the project, service, users, jurisdiction, and risk profile.',
    sections: [
      {
        heading: 'Define the service',
        body: 'Describe what the project provides, who may use it, account responsibilities, acceptable use, and any service limitations.',
      },
      {
        heading: 'Define ownership and responsibility',
        body: 'Address intellectual property, user content, third-party services, warranties, liability, termination, and dispute provisions as applicable.',
      },
      {
        heading: 'Complete before launch',
        body: 'Obtain appropriate legal review. Wayne Tech Lab LLC provides the template as a tool base and does not provide legal, security, or compliance advice through this page.',
      },
    ],
  },
  changelog: {
    eyebrow: 'Changelog',
    title: 'A place for project-visible change history.',
    description:
      'Keep release notes and meaningful user-facing changes here. Use the repository CHANGELOG.md and Wiki update log for the authoritative project history.',
    sections: [
      {
        heading: 'Template baseline',
        body: 'The G1 template includes a public application shell, Firebase-ready boundaries, unified navigation, local SYSTEMX tooling, and a LAN control surface.',
      },
      {
        heading: 'Project releases',
        body: 'Replace this section with dated releases, migration notes, compatibility changes, known issues, and links to the relevant documentation.',
      },
      {
        heading: 'Daily-change notice',
        body: 'The template and its tooling may change frequently. Review the repository history and update log before adopting a new revision.',
      },
    ],
  },
}

type StandardPageProps = {
  page: StandardPageKey
}

export function StandardPage({ page }: StandardPageProps) {
  const content = standardPageContent[page]

  return (
    <section data-snap-label={content.eyebrow} className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {content.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
          {content.title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-neutral-600">
          {content.description}
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {content.sections.map((section) => (
          <article key={section.heading} className="border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-950">{section.heading}</h2>
            <p className="mt-3 text-sm leading-7 text-neutral-600">{section.body}</p>
            {section.bullets && (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-neutral-600">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <AppLink
          to="/docs"
          className="rounded-md bg-neutral-950 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Read documentation
        </AppLink>
        <AppLink
          to="/contact"
          className="rounded-md border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-100"
        >
          Contact the project
        </AppLink>
      </div>
    </section>
  )
}
