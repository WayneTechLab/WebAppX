import { AppLink } from '@/components/navigation/AppLink'

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer
      className="border-t border-neutral-200 bg-neutral-50"
      {...(import.meta.env.DEV
        ? {
            'data-systemx-component': 'Site Footer',
            'data-systemx-source': 'src/components/layout/Footer.tsx',
            'data-systemx-reusable': 'global',
          }
        : {})}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-neutral-500 sm:flex-row">
        <p>&copy; {year} WebAppX. Template provided by Wayne Tech Lab LLC.</p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 sm:justify-end">
          <AppLink to="/about" className="hover:text-neutral-950">
            About
          </AppLink>
          <AppLink to="/services" className="hover:text-neutral-950">
            Services
          </AppLink>
          <AppLink to="/docs" className="hover:text-neutral-950">
            Docs
          </AppLink>
          <AppLink to="/contact" className="hover:text-neutral-950">
            Contact
          </AppLink>
          <AppLink to="/security" className="hover:text-neutral-950">
            Security
          </AppLink>
          <AppLink to="/accessibility" className="hover:text-neutral-950">
            Accessibility
          </AppLink>
          <AppLink to="/privacy" className="hover:text-neutral-950">
            Privacy
          </AppLink>
          <AppLink to="/terms" className="hover:text-neutral-950">
            Terms
          </AppLink>
          <AppLink to="/changelog" className="hover:text-neutral-950">
            Changelog
          </AppLink>
        </div>
      </div>
    </footer>
  )
}
