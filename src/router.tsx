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

function getPathname() {
  return normalizePath(window.location.pathname)
}

function renderPage(pathname: string) {
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

export function AppRouter() {
  const [pathname, setPathname] = useState(getPathname)

  useEffect(() => {
    const handleNavigation = () => setPathname(getPathname())

    window.addEventListener('popstate', handleNavigation)
    window.addEventListener(NAVIGATION_EVENT, handleNavigation)

    return () => {
      window.removeEventListener('popstate', handleNavigation)
      window.removeEventListener(NAVIGATION_EVENT, handleNavigation)
    }
  }, [])

  return (
    <Layout currentPath={pathname}>
      {renderPage(pathname)}
    </Layout>
  )
}
