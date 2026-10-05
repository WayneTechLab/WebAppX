import { useCallback, useEffect, useRef, useState } from 'react'
import { List, X } from 'lucide-react'

type SnapPoint = {
  id: string
  label: string
}

type PageSnapMenuProps = {
  pathname: string
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** A discoverable, hash-addressable table of contents for the current page. */
export function PageSnapMenu({ pathname }: PageSnapMenuProps) {
  const [open, setOpen] = useState(false)
  const [points, setPoints] = useState<SnapPoint[]>([])
  const [activeId, setActiveId] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  const scanSections = useCallback(() => {
    const content = document.getElementById('content')
    if (!content) return

    const usedIds = new Set<string>()
    const nextPoints: SnapPoint[] = []

    content.querySelectorAll<HTMLElement>('section').forEach((section, index) => {
      const heading = section.querySelector<HTMLElement>('h1, h2, h3')
      const rawLabel = section.dataset.snapLabel?.trim() || heading?.textContent?.trim()
      if (!rawLabel) return

      const baseId = section.id || slugify(rawLabel) || `section-${index + 1}`
      let id = baseId
      let counter = 2
      while (usedIds.has(id)) {
        id = `${baseId}-${counter}`
        counter += 1
      }
      usedIds.add(id)

      if (!section.id) section.id = id
      section.style.scrollMarginTop = '6rem'
      nextPoints.push({ id, label: rawLabel.length > 52 ? `${rawLabel.slice(0, 52)}…` : rawLabel })
    })

    setPoints(nextPoints)

    const requestedId = window.location.hash.slice(1)
    if (requestedId && nextPoints.some((point) => point.id === requestedId)) {
      window.setTimeout(() => {
        document.getElementById(requestedId)?.scrollIntoView({ block: 'start' })
      }, 0)
    }
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(scanSections)
    const delayedScan = window.setTimeout(scanSections, 300)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(delayedScan)
    }
  }, [pathname, scanSections])

  useEffect(() => {
    if (points.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-16% 0px -72% 0px', threshold: 0 },
    )

    points.forEach((point) => {
      const section = document.getElementById(point.id)
      if (section) observer.observe(section)
    })
    return () => observer.disconnect()
  }, [points])

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function jumpTo(id: string) {
    const section = document.getElementById(id)
    if (!section) return

    const reducedMotion = document.documentElement.dataset.wtlMotion === 'reduced'
    section.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    window.history.replaceState(null, '', `${pathname}#${id}`)
    setActiveId(id)
    setOpen(false)
  }

  if (points.length < 2) return null

  return (
    <div
      ref={menuRef}
      className="fixed left-3 top-20 z-40 sm:left-4"
      data-wtl-control="page-snap"
      {...(import.meta.env.DEV
        ? {
            'data-systemx-component': 'Page Snap Menu',
            'data-systemx-source': 'src/components/shell/PageSnapMenu.tsx',
            'data-systemx-reusable': 'shell',
          }
        : {})}
    >
      <button
        type="button"
        aria-controls="wtl-page-snap-panel"
        aria-expanded={open}
        aria-label={open ? 'Close page sections menu' : 'Open page sections menu'}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-0 overflow-hidden rounded-full border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-900 shadow-lg transition hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <List className="h-5 w-5" aria-hidden="true" />}
        <span
          className={`max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ${
            open ? 'ml-2 max-w-24 opacity-100' : ''
          }`}
        >
          On this page
        </span>
      </button>

      {open && (
        <nav
          id="wtl-page-snap-panel"
          aria-label="On this page"
          className="mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl"
        >
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Jump to section
          </p>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {points.map((point) => (
              <li key={point.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(point.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 ${
                    activeId === point.id
                      ? 'bg-neutral-950 font-semibold text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {point.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
