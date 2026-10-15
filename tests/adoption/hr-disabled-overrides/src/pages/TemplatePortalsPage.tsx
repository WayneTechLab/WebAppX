import { useRef, useState, type ChangeEvent } from 'react'
import { AppLink } from '../components/navigation/AppLink'
import { CmsDemo } from '../cms/CmsDemo'
import { CrmDemo } from '../crm/CrmDemo'
import { PortalWorkspaceProvider, usePortalWorkspaceBundle } from '../portals/PortalWorkspaceProvider'
import { createCombinedBackup, parseCombinedBackup, COMBINED_BACKUP_FILE_LIMIT, type CombinedBackup } from '../portals/combined-backup'
import { portalRegistry } from '../portals/registry'

const button = 'inline-flex min-h-11 rounded-md border border-neutral-300 px-4 py-2 font-semibold'
function AdoptedBackup() {
  const { states, restore } = usePortalWorkspaceBundle()
  const input = useRef<HTMLInputElement>(null)
  const token = useRef(0)
  const [pending, setPending] = useState<CombinedBackup | null>(null)
  const [feedback, setFeedback] = useState({ error: false, message: '' })
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    const current = ++token.current
    setPending(null)
    if (!file) return
    try {
      if (file.size > COMBINED_BACKUP_FILE_LIMIT) throw new Error('Adopted bundle file exceeds its size limit.')
      const parsed = parseCombinedBackup(await file.text())
      if (current === token.current) { setPending(parsed); setFeedback({ error: false, message: '' }) }
    } catch (error) {
      if (current === token.current) setFeedback({ error: true, message: `${error instanceof Error ? error.message : 'Could not read file.'} Current workspaces unchanged.` })
    }
  }
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([createCombinedBackup(states)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url; link.download = 'adopted-cms-crm-workspaces.json'; document.body.append(link)
      try { link.click() } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
    } catch (error) { setFeedback({ error: true, message: error instanceof Error ? error.message : 'Could not export bundle.' }) }
  }
  return <section aria-label="Adopted bundle backup" className="mt-8 space-y-4 rounded-xl border p-5">
    <h2 className="text-xl font-semibold">Adopted CMS and CRM bundle</h2>
    <p>This app accepts only its two-workspace bundle, version 1. Export current records before restoring. Recovery history and undo are not available in this adoption.</p>
    <button className={button} onClick={download}>Export adopted bundle</button>{' '}
    <button className={button} onClick={() => input.current?.click()}>Import adopted bundle</button>
    <input hidden ref={input} type="file" aria-label="Adopted bundle JSON file" accept=".json,application/json" onChange={choose} />
    {pending && <div className="space-y-3"><p>Ready to replace CMS and CRM records from {pending.exportedAt}.</p><button className={button} onClick={() => { const result = restore(pending.states); if (result.ok) setPending(null); setFeedback({ error: !result.ok, message: result.message }) }}>Replace adopted workspaces</button>{' '}<button className={button} onClick={() => { ++token.current; setPending(null) }}>Cancel adopted restore</button></div>}
    {feedback.message && <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
  </section>
}

function Content({ pathname }: { pathname: string }) {
  const { revision } = usePortalWorkspaceBundle()
  const directory = pathname === '/portals' || pathname === '/'
  return <main className="mx-auto max-w-7xl px-4 py-8">
    <nav aria-label="Template workspaces" className="flex flex-wrap gap-3"><AppLink className={button} to="/portals">Portal directory</AppLink>{portalRegistry.map(portal => <AppLink key={portal.id} className={button} to={portal.href}>{portal.title}</AppLink>)}</nav>
    {directory && <><h1 className="mt-8 text-3xl font-bold">CMS and CRM adopted example</h1><p className="mt-4">Two fictional workspaces with separate browser saves. Use only synthetic information.</p><div className="mt-6 grid gap-5 sm:grid-cols-2">{portalRegistry.map(portal => <article key={portal.id} className="rounded-xl border p-5"><h2 className="text-xl font-semibold">{portal.title}</h2><p>{portal.description}</p><AppLink className={button} to={portal.href}>Open {portal.workspaceLabel}</AppLink></article>)}</div><AdoptedBackup /></>}
    {!directory && !portalRegistry.some(portal => portal.href === pathname) && <><h1 className="mt-8 text-3xl font-bold">Page unavailable in this adopted app</h1><p>The supported modules are CMS and CRM.</p></>}
    <div hidden={pathname !== '/cms/demo'}><CmsDemo key={`cms:${revision}`} /></div>
    <div hidden={pathname !== '/crm/demo'}><CrmDemo key={`crm:${revision}`} /></div>
  </main>
}
export function TemplatePortalsPage({ pathname }: { pathname: string }) {
  return <PortalWorkspaceProvider><Content pathname={pathname} /></PortalWorkspaceProvider>
}
