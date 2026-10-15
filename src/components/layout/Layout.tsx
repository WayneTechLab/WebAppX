import type { ReactNode } from 'react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { PageSnapMenu } from '@/components/shell/PageSnapMenu'
import { HelpDeskChat } from '@/components/shell/HelpDeskChat'
import { AccessibilityPageControl } from '@/components/shell/AccessibilityPageControl'
import { siteControls } from '@/config/siteControls'
import { FirebaseSetupNotice } from './FirebaseSetupNotice'
import { AppLink } from '@/components/navigation/AppLink'
import { useScopedPortalChrome } from '@/portals/ScopedPortalChrome'

type LayoutProps = {
  children: ReactNode
  currentPath: string
}

export function Layout({ children, currentPath }: LayoutProps) {
  const scopedPortalChrome = useScopedPortalChrome()
  if (scopedPortalChrome) {
    return (
      <div className="flex min-h-full min-w-0 flex-col bg-white text-neutral-950" data-scoped-portal-preview="true">
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-neutral-950 focus:shadow-lg">Skip to portal content</a>
        <header className="border-b border-neutral-200 bg-neutral-50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <p className="text-sm font-semibold text-neutral-900">Scoped portal preview</p>
            <AppLink to="/portals" className="inline-flex min-h-11 items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold">Portal directory</AppLink>
          </div>
        </header>
        <main id="content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">{children}</main>
        {siteControls.accessibility && <AccessibilityPageControl showPageTravel={siteControls.showPageTravel} />}
      </div>
    )
  }
  return (
    <div
      className="flex min-h-full flex-col bg-white text-neutral-950"
      {...(import.meta.env.DEV ? { 'data-systemx-name': 'App Layout' } : {})}
    >
      <Navbar key={`navbar:${currentPath}`} currentPath={currentPath} />
      <FirebaseSetupNotice />
      <main
        id="content"
        tabIndex={-1}
        className="flex-1 focus:outline-none"
        {...(import.meta.env.DEV ? { 'data-systemx-region': 'page-content' } : {})}
      >
        {children}
      </main>
      <Footer />
      {siteControls.pageSnap && <PageSnapMenu key={`page-snap:${currentPath}`} pathname={currentPath} />}
      {siteControls.helpDesk !== 'off' && <HelpDeskChat mode={siteControls.helpDesk} />}
      {siteControls.accessibility && (
        <AccessibilityPageControl showPageTravel={siteControls.showPageTravel} />
      )}
    </div>
  )
}
