import type { ExactHireCreation } from '../recruiting-lifecycle-types'

/** Only the explicitly authorized hire creation DTO is accepted here. */
function Facts({ value }: { value: unknown }) {
  if (value === null) return <span>Not recorded (null)</span>
  if (Array.isArray(value)) return value.length ? <ol className="list-inside list-decimal space-y-2">{value.map((item, index) => <li key={index} className="min-w-0 break-words"><Facts value={item} /></li>)}</ol> : <span>No entries</span>
  if (typeof value === 'object') return <dl className="grid min-w-0 grid-cols-1 gap-2">{Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key} className="min-w-0 rounded border border-neutral-200 bg-white p-2"><dt className="font-semibold break-words">{key}</dt><dd className="mt-1 min-w-0 break-words"><Facts value={item} /></dd></div>)}</dl>
  return <span className="break-words">{String(value)}</span>
}

export function HrRecruitingHireSummary({ creation }: { creation: ExactHireCreation }) {
  return <section aria-label="Exact fictional hire records" className="min-w-0 space-y-5">
    <h4 className="font-semibold">Review every new hire record</h4>
    <p className="text-sm leading-6">Confirmation creates these fictional local records together. Review the retained person identity, new employee ID, checklist, profile, status and opening leave balances before accepting.</p>
    {([
      ['Employee identity, assignment and captured checklist', creation.employee],
      ['Initial onboarding requirements', creation.onboarding],
      ['Initial directory profile', creation.profile],
      ['Initial employee status', creation.status],
      ['Initial leave balances in hours', creation.balance],
    ] as const).map(([title, value]) => <section key={title} aria-label={title} className="min-w-0 space-y-3 rounded-lg border border-neutral-200 p-3 text-sm"><h5 className="font-semibold">{title}</h5><Facts value={value} /></section>)}
    <section aria-label="Employment records created by this hire" className="min-w-0 space-y-3 rounded-lg border border-neutral-200 p-3 text-sm"><h5 className="font-semibold">Employment records created by this hire</h5>{creation.employment ? <Facts value={creation.employment} /> : <p>No employment instance or employment event will be created by this hire. Employment history is absent in this workspace; recruiting adoption does not create it.</p>}</section>
  </section>
}
