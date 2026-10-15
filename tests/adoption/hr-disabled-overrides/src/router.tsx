import { useEffect, useState } from 'react'
import { NAVIGATION_EVENT, normalizePath } from './lib/navigation'
import { TemplatePortalsPage } from './pages/TemplatePortalsPage'

/** The adopted shell deliberately imports only the two supported modules. */
export function AppRouter() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname))
  useEffect(() => {
    const navigate = () => setPathname(normalizePath(window.location.pathname))
    window.addEventListener('popstate', navigate)
    window.addEventListener(NAVIGATION_EVENT, navigate)
    return () => { window.removeEventListener('popstate', navigate); window.removeEventListener(NAVIGATION_EVENT, navigate) }
  }, [])
  return <TemplatePortalsPage pathname={pathname} />
}
