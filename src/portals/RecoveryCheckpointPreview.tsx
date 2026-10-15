import type { RecoveryReplacementPreview } from './recovery-preferences'

export function RecoveryCheckpointPreview({ preview }: { preview: RecoveryReplacementPreview }) {
  return <div role="region" aria-label="Required checkpoint preview" className="mt-3 rounded-lg border border-neutral-200 bg-white p-3">
    <p role={!preview.ok || !preview.canReplace ? 'alert' : undefined} className="text-sm leading-6 text-neutral-800">{preview.message}</p>
    {preview.ok && preview.required && <>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]"><dt>New checkpoint</dt><dd>{preview.newPointCharacters?.toLocaleString('en-US')} serialized characters</dd><dt>Projected history</dt><dd>{preview.projectedHistoryCharacters?.toLocaleString('en-US')} / {preview.historyLimit?.toLocaleString('en-US')} serialized characters</dd><dt>Retained points</dt><dd>{preview.retainedPoints} / 5</dd><dt>Oldest points removed on success</dt><dd>{preview.prunedPoints}</dd></dl>
      <p className="mt-2 text-xs leading-5 text-neutral-500">Preview writes nothing and does not reserve browser quota. Confirmation rechecks current records, settings, history and storage. Changed review facts refuse replacement and require a refreshed review. A required checkpoint must save before replacement.</p>
    </>}
  </div>
}
