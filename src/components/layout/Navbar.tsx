import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BookOpen,
  BriefcaseBusiness,
  CircleHelp,
  Home,
  Info,
  LifeBuoy,
  LockKeyhole,
  LogIn,
  Mail,
  Menu,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { AppLink } from '@/components/navigation/AppLink'
import { isActivePath } from '@/lib/navigation'
import { siteControls } from '@/config/siteControls'

type NavigationItem = {
  to: string
  label: string
  description: string
  icon: LucideIcon
  end?: boolean
}

const primaryLinks: NavigationItem[] = [
  { to: '/', label: 'Home', description: 'Template overview', icon: Home, end: true },
  { to: '/about', label: 'About', description: 'About this template', icon: Info },
  { to: '/contact', label: 'Contact', description: 'Contact and support', icon: Mail },
  { to: '/social', label: 'Social', description: 'Public project links', icon: Share2 },
]

const publicPageLinks: NavigationItem[] = [
  { to: '/portals', label: 'Template Portals', description: 'Account-free HR, CMS and CRM workspaces', icon: BriefcaseBusiness },
  { to: '/hr', label: 'People & HR', description: 'Standard portals and synthetic Gusto preview', icon: Users },
  { to: '/services', label: 'Services', description: 'Template services and capabilities', icon: BriefcaseBusiness },
  { to: '/features', label: 'Features', description: 'Template capabilities', icon: Sparkles },
  { to: '/docs', label: 'Docs', description: 'Setup and operating guides', icon: BookOpen },
  { to: '/faq', label: 'FAQ', description: 'Common template questions', icon: CircleHelp },
  { to: '/support', label: 'Support', description: 'Help and troubleshooting', icon: LifeBuoy },
  { to: '/security', label: 'Security', description: 'Security starting points', icon: LockKeyhole },
]

const staffLinks: NavigationItem[] = [
  { to: '/admin/hr', label: 'HR Management', description: 'Protected HR adoption and provider boundary', icon: Users },
  { to: '/employee', label: 'Employee Portal', description: 'Authenticated employee self-service boundary', icon: Users },
  { to: '/manager/hr', label: 'Manager Portal', description: 'Authenticated team management boundary', icon: Users },
  { to: '/contractor', label: 'Contractor Portal', description: 'Authenticated contractor self-service boundary', icon: Users },
  {
    to: '/admin',
    label: 'Admin Dashboard',
    description: 'Protected Level 4 / 5 staff area',
    icon: ShieldCheck,
  },
]

type NavbarProps = {
  currentPath: string
}

export function Navbar({ currentPath }: NavbarProps) {
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === currentPath
  const drawerRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const firstLink = drawerRef.current?.querySelector<HTMLAnchorElement>('a')
    firstLink?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpenPath(null)
      triggerRef.current?.focus()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const linkClass = (isActive: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-neutral-950 text-white'
        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950'
    }`

  const activePrimaryLink = primaryLinks.find((link) =>
    isActivePath(currentPath, link.to, link.end),
  )

  const navigationOverlay =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[70] isolate" role="presentation">
            <button
              type="button"
              aria-label="Dismiss site navigation overlay"
              className="absolute inset-0 cursor-pointer bg-neutral-950/45 backdrop-blur-sm"
              onClick={() => setOpenPath(null)}
            />
            <aside
              ref={drawerRef}
              id="wtl-site-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              className="fixed right-0 top-0 z-[71] flex h-dvh w-full max-w-sm flex-col overflow-y-auto border-l border-neutral-200 bg-white px-5 pb-6 pt-20 shadow-2xl"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Site navigation</p>
              <div className="flex min-h-0 flex-1 flex-col">
                <nav aria-label="Primary navigation" className="mt-4">
                  <div className="flex items-center gap-2" role="list">
                    {primaryLinks.map((link) => {
                      const active = isActivePath(currentPath, link.to, link.end)
                      const Icon = link.icon
                      return (
                        <AppLink
                          key={link.to}
                          to={link.to}
                          aria-current={active ? 'page' : undefined}
                          aria-label={`${link.label}: ${link.description}`}
                          title={link.label}
                          role="listitem"
                          className={`group relative flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 ${
                            active
                              ? 'bg-neutral-950 text-white'
                              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950'
                          }`}
                          onClick={() => setOpenPath(null)}
                        >
                          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                            {link.label}
                          </span>
                        </AppLink>
                      )
                    })}
                  </div>
                  {activePrimaryLink && (
                    <p className="mt-3 text-sm text-neutral-600">
                      <span className="font-semibold text-neutral-950">{activePrimaryLink.label}</span>
                      <span aria-hidden="true"> · </span>
                      {activePrimaryLink.description}
                    </p>
                  )}
                </nav>

                <section aria-labelledby="public-pages-heading" className="mt-6 border-t border-neutral-200 pt-5">
                  <p id="public-pages-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Public pages
                  </p>
                  <nav aria-label="Public pages" className="mt-3 grid gap-1">
                    {publicPageLinks.map((link) => {
                      const active = isActivePath(currentPath, link.to, link.end)
                      const Icon = link.icon
                      return (
                        <AppLink
                          key={link.to}
                          to={link.to}
                          aria-current={active ? 'page' : undefined}
                          className={linkClass(active) + ' flex items-center gap-3'}
                          onClick={() => setOpenPath(null)}
                        >
                          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block">{link.label}</span>
                            <span className={active ? 'block text-xs font-normal text-neutral-300' : 'block text-xs font-normal text-neutral-500'}>
                              {link.description}
                            </span>
                          </span>
                        </AppLink>
                      )
                    })}
                  </nav>
                </section>

                <section aria-labelledby="staff-navigation-heading" className="mt-8 border-t border-neutral-200 pt-5">
                  <p id="staff-navigation-heading" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Staff administration
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    Level 4 / 5 access is claim-gated.
                  </p>
                  <nav aria-label="Level 4 and 5 administration" className="mt-3 grid gap-1">
                    {staffLinks.map((link) => {
                      const active = isActivePath(currentPath, link.to, link.end)
                      const Icon = link.icon
                      return (
                        <AppLink
                          key={link.to}
                          to={link.to}
                          aria-current={active ? 'page' : undefined}
                          className={linkClass(active) + ' flex items-center gap-3'}
                          onClick={() => setOpenPath(null)}
                        >
                          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block">{link.label}</span>
                            <span className={active ? 'block text-xs font-normal text-neutral-300' : 'block text-xs font-normal text-neutral-500'}>
                              {link.description}
                            </span>
                          </span>
                        </AppLink>
                      )
                    })}
                  </nav>
                </section>

                <div className="mt-auto pt-8">
                  <div className="border-t border-neutral-200 pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Portal</p>
                    <AppLink
                      to="/login"
                      aria-current={isActivePath(currentPath, '/login') ? 'page' : undefined}
                      className={linkClass(isActivePath(currentPath, '/login')) + ' mt-3 flex min-h-14 w-full items-center gap-3 border border-neutral-200 px-4'}
                      onClick={() => setOpenPath(null)}
                    >
                      <LogIn className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block">Login Portal</span>
                        <span className={isActivePath(currentPath, '/login') ? 'block text-xs font-normal text-neutral-300' : 'block text-xs font-normal text-neutral-500'}>
                          Unified Login
                        </span>
                      </span>
                    </AppLink>
                  </div>
                  <p className="mt-6 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500">
                    WebAppX · .SYSTEMX Forever WebApp<br />
                    Provided by Wayne Tech Lab LLC.
                  </p>
                </div>
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur"
        {...(import.meta.env.DEV
          ? {
              'data-systemx-component': 'Site Header',
              'data-systemx-source': 'src/components/layout/Navbar.tsx',
              'data-systemx-reusable': 'global',
            }
          : {})}
      >
        <nav aria-label="Brand" className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 pr-18 sm:pr-20">
          <AppLink to="/" className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded border border-neutral-950 bg-neutral-950 text-xs font-semibold text-white">
              W
            </span>
            <span className="truncate">WebAppX</span>
          </AppLink>
        </nav>
      </header>

      {siteControls.siteNavigation && (
        <button
          ref={triggerRef}
          type="button"
          className="fixed right-3 top-3 z-[72] inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-neutral-950 text-white shadow-lg transition hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 sm:right-4 sm:top-4"
          aria-controls="wtl-site-navigation"
          aria-expanded={open}
          aria-label={open ? 'Close site navigation' : 'Open site navigation'}
          onClick={() => setOpenPath(open ? null : currentPath)}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      )}

      {navigationOverlay}
    </>
  )
}
