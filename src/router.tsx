import { useEffect, useState } from 'react'
import { Layout } from '@/components/layout/Layout'
import { NAVIGATION_EVENT, normalizePath } from '@/lib/navigation'
import { HomePage } from '@/pages/HomePage'
import { AboutPage } from '@/pages/AboutPage'
import { ServicesPage } from '@/pages/ServicesPage'
import { DocsPage } from '@/pages/DocsPage'
import { ContactPage } from '@/pages/ContactPage'
import { SocialPage } from '@/pages/SocialPage'
import { LoginPage } from '@/pages/LoginPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { StandardPage, type StandardPageKey } from '@/pages/StandardPage'
import { SystemStatePage } from '@/pages/SystemStatePage'
import { HrPage } from '@/pages/HrPage'
import { TemplatePortalsPage } from '@/pages/TemplatePortalsPage'
import { resolvePortalRoute } from '@/portals/routes'
import { hrRoutes } from '@/hr/catalog'
import { UnsavedWorkProvider } from '@/portals/unsaved-work'

function getPathname() {
  return normalizePath(window.location.pathname)
}

function renderPage(pathname: string) {
  if (resolvePortalRoute(pathname, hrRoutes).kind !== 'outside') return <TemplatePortalsPage pathname={pathname} />
  if (pathname === '/hr' || pathname === '/admin/hr' || pathname.startsWith('/admin/hr/') || pathname === '/employee' || pathname.startsWith('/employee/') || pathname === '/manager/hr' || pathname.startsWith('/manager/hr/') || pathname === '/contractor' || pathname.startsWith('/contractor/')) {
    return <HrPage pathname={pathname} />
  }
  switch (pathname) {
    case '/':
      return <HomePage />
    case '/about':
      return <AboutPage />
    case '/services':
      return <ServicesPage />
    case '/docs':
      return <DocsPage />
    case '/login':
      return <LoginPage />
    case '/admin':
      return <AdminDashboardPage />
    case '/contact':
      return <ContactPage />
    case '/social':
      return <SocialPage />
    case '/features':
    case '/faq':
    case '/support':
    case '/security':
    case '/accessibility':
    case '/privacy':
    case '/terms':
    case '/changelog':
      return <StandardPage page={pathname.slice(1) as StandardPageKey} />
    case '/403':
      return <SystemStatePage state="forbidden" />
    case '/500':
      return <SystemStatePage state="server-error" />
    case '/offline':
      return <SystemStatePage state="offline" />
    default:
      return <NotFoundPage />
  }
}

function RoutedContent() {
  const [pathname, setPathname] = useState(getPathname)

  useEffect(() => {
    const handleNavigation = () => setPathname(getPathname())

    window.addEventListener(NAVIGATION_EVENT, handleNavigation)

    return () => {
      window.removeEventListener(NAVIGATION_EVENT, handleNavigation)
    }
  }, [])

  return (
    <Layout currentPath={pathname}>
      {renderPage(pathname)}
    </Layout>
  )
}

export function AppRouter() {
  return <UnsavedWorkProvider><RoutedContent /></UnsavedWorkProvider>
}
