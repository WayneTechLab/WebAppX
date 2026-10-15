import { portalById } from './registry'
import { previewRestoreBudget } from './restore-budget'

type Budget = ReturnType<typeof previewRestoreBudget>
const characters = (value: number) => `${value.toLocaleString('en-US')} serialized characters`

export function RestoreBudgetPreview({ budget, onRefresh }: { budget: Budget | null; onRefresh: () => void }) {
  return <section aria-label="Storage budget preview" className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><h4 className="text-base font-semibold text-neutral-950">Storage budget preview</h4><button type="button" className="inline-flex min-h-11 items-center rounded-md border border-neutral-300 px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50" onClick={onRefresh}>Refresh storage preview</button></div>
    {!budget && <p className="mt-2 text-sm leading-6 text-neutral-600">Select at least one workspace to preview its saved size and the recovery history.</p>}
    {budget && !budget.ok && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm leading-6 text-red-900">{budget.message}</p>}
    {budget?.ok && <>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[28rem] text-left text-sm"><caption className="sr-only">Selected workspace browser saves</caption><thead><tr className="border-b border-neutral-200 text-neutral-500"><th scope="col" className="py-2 pr-4 font-medium">Portal</th><th scope="col" className="px-3 py-2 font-medium">Serialized save size</th><th scope="col" className="py-2 pl-3 font-medium">Per-portal limit</th></tr></thead><tbody>{budget.selected.map(item => <tr key={item.module} className="border-b border-neutral-100"><th scope="row" className="py-3 pr-4 font-semibold text-neutral-950">{portalById[item.module].label}</th><td className="px-3 py-3 tabular-nums text-neutral-700">{characters(item.characters)}</td><td className="py-3 pl-3 tabular-nums text-neutral-700">{characters(item.limit)}</td></tr>)}</tbody></table></div>
      <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-medium text-neutral-700">Selected workspace total</dt><dd className="tabular-nums text-neutral-950"><output aria-label="Selected workspace total">{characters(budget.selectedCharacters)}</output></dd>
        <dt className="font-medium text-neutral-700">New restore point</dt><dd className="tabular-nums text-neutral-950"><output aria-label="New restore point size">{characters(budget.newPointCharacters)}</output></dd>
        <dt className="font-medium text-neutral-700">Current restore history</dt><dd className="tabular-nums text-neutral-950"><output aria-label="Current restore history size">{characters(budget.currentHistoryCharacters)}</output></dd>
        <dt className="font-medium text-neutral-700">Projected restore history</dt><dd className="tabular-nums text-neutral-950"><output aria-label="Projected restore history size">{characters(budget.projectedHistoryCharacters)} of {characters(budget.historyLimit)}</output></dd>
        <dt className="font-medium text-neutral-700">Restore points retained</dt><dd className="tabular-nums text-neutral-950"><output aria-label="Restore points retained">{budget.retainedPoints}</output></dd>
        <dt className="font-medium text-neutral-700">Older restore points removed</dt><dd className="tabular-nums text-neutral-950"><output aria-label="Older restore points removed">{budget.prunedPoints}</output></dd>
      </dl>
      {!budget.canRestore && <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm leading-6 text-red-900">{budget.reason || 'This restore exceeds a template storage limit.'} Restore is unavailable until the selected workspaces fit.</p>}
    </>}
    <p className="mt-3 text-xs leading-5 text-neutral-500">Sizes count serialized characters, including save envelopes. Current history is measured as compact recovery data; projected history includes retention pruning. Browser quota and other site data are unknown. This preview writes or reserves nothing. Confirmation rechecks the records and saves a restore point before replacing selected portals.</p>
  </section>
}
