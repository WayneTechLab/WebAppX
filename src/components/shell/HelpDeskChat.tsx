import { useEffect, useRef, useState } from 'react'
import { CircleHelp, ExternalLink, MessageCircle, ShieldCheck, X } from 'lucide-react'
import { AppLink } from '@/components/navigation/AppLink'
import type { HelpDeskMode } from '@/config/siteControls'

const quickAnswers = [
  {
    question: 'What is this template?',
    answer: 'A Firebase-ready React, TypeScript, and Vite starting point with SYSTEMX setup guidance.',
  },
  {
    question: 'Where do I start?',
    answer: 'Open the docs page, then follow the SYSTEMX guided setup process before connecting production services.',
  },
  {
    question: 'Can I get project help?',
    answer: 'Use the contact route for a human handoff. A generated project can connect this panel to an approved support workflow later.',
  },
]

export function HelpDeskChat({ mode }: { mode: HelpDeskMode }) {
  const [open, setOpen] = useState(false)
  const [answer, setAnswer] = useState(quickAnswers[0])
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false)
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

  if (mode === 'off') return null

  return (
    <div
      ref={panelRef}
      className="group fixed bottom-3 left-3 z-40 sm:bottom-4 sm:left-4"
      data-wtl-control="help-desk"
      {...(import.meta.env.DEV
        ? {
            'data-systemx-component': 'Help Desk',
            'data-systemx-source': 'src/components/shell/HelpDeskChat.tsx',
            'data-systemx-reusable': 'shell',
          }
        : {})}
    >
      {open && (
        <section
          id="wtl-help-desk-panel"
          aria-label="Self-service help desk"
          className="mb-2 w-[min(25rem,calc(100vw-1.5rem))] rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-950 text-white">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-bold text-neutral-950">Help desk</h2>
                <p className="mt-0.5 text-sm text-neutral-600">Self-service help for this site.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help desk"
              className="grid min-h-10 min-w-10 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 rounded-xl bg-neutral-50 p-3">
            <p className="text-sm font-semibold text-neutral-900">{answer.question}</p>
            <p className="mt-1 text-sm leading-6 text-neutral-700">{answer.answer}</p>
          </div>

          <div className="mt-3 grid gap-2">
            {quickAnswers.map((item) => (
              <button
                key={item.question}
                type="button"
                onClick={() => setAnswer(item)}
                className="min-h-11 rounded-lg border border-neutral-200 px-3 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
              >
                {item.question}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-3">
            <AppLink
              to="/contact"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-neutral-950 px-3 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
            >
              Contact support <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </AppLink>
            <span className="inline-flex items-center gap-1 text-xs leading-5 text-neutral-500">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Approved help content only
            </span>
          </div>
        </section>
      )}

      <button
        type="button"
        aria-controls="wtl-help-desk-panel"
        aria-expanded={open}
        aria-label={open ? 'Close help desk' : 'Open help desk'}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-11 items-center justify-center gap-0 overflow-hidden rounded-full bg-neutral-950 px-3 text-sm font-semibold text-white shadow-lg transition hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 group-hover:gap-2 group-focus-within:gap-2"
      >
        <CircleHelp className="h-5 w-5" aria-hidden="true" />
        <span className={`max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-12 group-hover:opacity-100 group-focus-within:max-w-12 group-focus-within:opacity-100 ${open ? 'max-w-12 opacity-100' : ''}`}>
          Help
        </span>
      </button>
    </div>
  )
}
