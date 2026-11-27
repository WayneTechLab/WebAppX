import { ownedMockStorageDescriptors } from './owned-mock-storage'

/** This inventory describes effects; it never opens or changes browser storage. */
export function MockStoragePreview() {
  return <section aria-label="WebAppX mock storage preview" className="mt-8 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6">
    <details>
      <summary className="min-h-11 cursor-pointer content-center rounded-sm text-base font-semibold text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">Preview mock storage reset effects</summary>
      <p className="mt-3 text-sm leading-6 text-neutral-600">These are the five storage keys owned by the native WebAppX mock workspaces. This preview reads no saved values and deletes nothing. The effects below describe a separate, deliberate removal of a key, followed by the next load or read. Open records stay open.</p>
      <dl className="mt-4 divide-y divide-neutral-200">
        {ownedMockStorageDescriptors.map(item => <div key={item.key} className="py-4 first:pt-0 last:pb-0">
          <dt className="text-sm font-semibold text-neutral-950">{item.label}<code className="mt-1 block break-all font-mono text-xs font-normal text-neutral-600">{item.key}</code></dt>
          <dd className="mt-2 space-y-2 text-sm leading-6 text-neutral-700"><p>{item.nextLoadEffect}</p><p>{item.preserved}</p></dd>
        </div>)}
      </dl>
      <p className="mt-4 text-xs leading-5 text-neutral-500">Accessibility preferences, account previews, Firebase data, the separate development SDK session and other applications’ keys are outside this inventory. Walkthrough sessions keep these five slots in memory; their existing browser versions remain untouched.</p>
    </details>
  </section>
}
