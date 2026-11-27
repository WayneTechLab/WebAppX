/** A finite rendered reference for the native portal vocabulary. No workspace
 * provider, router, persistence, model or theme selection is involved. */
export function PortalDesignTokens() {
  return <section aria-label="Portal design token sample" className="portal-surface-base portal-space-panel portal-section-stack mt-8 min-w-0 rounded-xl border border-neutral-200">
    <header>
      <h2 id="portal-design-token-heading" className="portal-emphasis-primary text-2xl font-semibold">Portal design tokens</h2>
      <p className="portal-emphasis-secondary mt-2 max-w-3xl text-sm leading-6">The three native workspaces share these surfaces, spacing and text priorities. Domain status labels retain their own meaning. This reference changes no fictional records or saves.</p>
    </header>
    <div className="portal-space-section grid min-w-0 sm:grid-cols-3">
      <article className="portal-surface-base portal-space-panel min-w-0 rounded-lg border border-neutral-300"><h3 className="portal-emphasis-primary font-semibold">Base surface</h3><code className="portal-emphasis-secondary mt-2 block break-all text-xs">--portal-surface-base</code><p className="portal-emphasis-quiet mt-2 text-sm">Workspace canvas · #fafafa</p></article>
      <article className="portal-surface-raised portal-space-panel min-w-0 rounded-lg border border-neutral-200"><h3 className="portal-emphasis-primary font-semibold">Raised surface</h3><code className="portal-emphasis-secondary mt-2 block break-all text-xs">--portal-surface-raised</code><p className="portal-emphasis-quiet mt-2 text-sm">Record panels · #ffffff</p></article>
      <article className="portal-surface-muted portal-space-panel min-w-0 rounded-lg border border-neutral-200"><h3 className="portal-emphasis-primary font-semibold">Muted surface</h3><code className="portal-emphasis-secondary mt-2 block break-all text-xs">--portal-surface-muted</code><p className="portal-emphasis-quiet mt-2 text-sm">Supporting context · #f5f5f5</p></article>
    </div>
    <div className="portal-space-section grid min-w-0 lg:grid-cols-2">
      <section aria-label="Portal spacing examples" className="portal-surface-raised portal-space-panel min-w-0 rounded-lg border border-neutral-200">
        <h3 className="portal-emphasis-primary text-lg font-semibold">Control, panel and section spacing</h3>
        <div className="portal-space-control mt-4 flex flex-wrap"><span className="portal-surface-muted rounded-md border border-neutral-200 p-2 text-sm">Control one</span><span className="portal-surface-muted rounded-md border border-neutral-200 p-2 text-sm">Control two</span></div>
        <dl className="portal-emphasis-secondary mt-4 space-y-3 text-sm">
          <div><dt className="break-all font-semibold">--portal-space-control</dt><dd>0.75rem between the two control examples.</dd></div>
          <div><dt className="break-all font-semibold">--portal-space-panel</dt><dd>1.25rem inside panels; 1.5rem from a 40rem viewport.</dd></div>
          <div><dt className="break-all font-semibold">--portal-space-section</dt><dd>1.5rem between sample sections and columns.</dd></div>
        </dl>
      </section>
      <section aria-label="Portal emphasis examples" className="portal-surface-raised portal-space-panel min-w-0 rounded-lg border border-neutral-200">
        <h3 className="portal-emphasis-primary text-lg font-semibold">Text emphasis</h3>
        <p className="portal-emphasis-primary mt-4 text-sm font-semibold">Primary: the panel’s main statement.</p><code className="portal-emphasis-primary block break-all text-xs">--portal-emphasis-primary · #171717</code>
        <p className="portal-emphasis-secondary mt-4 text-sm">Secondary: explanation and supporting instructions.</p><code className="portal-emphasis-secondary block break-all text-xs">--portal-emphasis-secondary · #525252</code>
        <p className="portal-emphasis-quiet mt-4 text-sm">Quiet: additional metadata, with a readable label.</p><code className="portal-emphasis-quiet block break-all text-xs">--portal-emphasis-quiet · #666666</code>
      </section>
    </div>
    <section aria-label="Portal keyboard focus example" className="portal-surface-raised portal-space-panel min-w-0 rounded-lg border border-neutral-200">
      <h3 className="portal-emphasis-primary text-lg font-semibold">Visible keyboard focus</h3>
      <label className="portal-emphasis-secondary mt-4 block max-w-xl text-sm font-medium">Focus sample field<input readOnly value="Fictional focus sample" aria-describedby="portal-token-focus-help" className="portal-focus portal-surface-raised portal-emphasis-primary mt-2 block min-h-11 w-full min-w-0 rounded-md border border-neutral-400 px-3 py-2" /></label>
      <p id="portal-token-focus-help" className="portal-emphasis-secondary mt-3 max-w-3xl text-sm leading-6">Tab to the read-only field to inspect its outline. The sample uses the neutral focus color; HR, CMS and CRM use their existing emerald, indigo and sky accents. The high-contrast preference keeps its stronger outline.</p>
      <ul className="portal-emphasis-quiet mt-3 space-y-2 text-sm"><li><code className="break-all">--portal-focus-ring-color</code>: #171717 in this sample.</li><li><code className="break-all">--portal-focus-ring-width</code>: 2px.</li><li><code className="break-all">--portal-focus-ring-offset</code>: 3px.</li></ul>
    </section>
  </section>
}
