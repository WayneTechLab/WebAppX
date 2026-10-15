import type { DemoModule } from './persistence'
import type { DemoWorkspaces } from './workspaces'
import { compareWorkspaces, inspectWorkspaces, type InspectionKind, type StructuredRecordMetadata, type WorkspaceCollectionDifference, type WorkspaceRecordDifference } from './workspace-inspection'

const labels: Record<DemoModule, string> = { hr: 'HR', cms: 'CMS', crm: 'CRM' }
const kinds: Record<InspectionKind, string> = { primary: 'Primary records', nested: 'Nested records', metadata: 'Saved metadata' }
const number = (value: number) => value.toLocaleString('en-US')
const tableClass = 'w-full min-w-[42rem] text-left text-sm'
const cellClass = 'border-b border-neutral-100 px-3 py-3 align-top'
const redactionNote = 'Names, email values, titles, content, comments, answers, amounts and reasons are not displayed. Inspection neither applies a restore nor writes saves, history or activity.'
const commonNote = `Identifiers and counts only. ${redactionNote}`

function Identifiers({ values, omitted }: { values: string[]; omitted: number }) {
  return <>
    {values.length ? <ul className="space-y-1 text-xs leading-5 text-neutral-700">{values.map(value => <li key={value}><code className="break-all">{value}</code></li>)}</ul> : <span className="text-xs text-neutral-500">None</span>}
    {omitted > 0 && <p className="mt-1 text-xs leading-5 text-neutral-500">{number(omitted)} more identifiers omitted</p>}
  </>
}

type InspectionProps = { states: Partial<DemoWorkspaces>; modules: readonly DemoModule[]; title?: string }

/** Presentation of captured states only; no storage or mutation callbacks. */
export function WorkspaceInspection({ states, modules, title = 'Captured workspace records' }: InspectionProps) {
  let report
  try { report = inspectWorkspaces(states, modules) } catch {
    return <section role="region" aria-label={title} className="mt-4 rounded-lg border border-neutral-200 bg-white p-4"><h4 className="text-base font-semibold text-neutral-950">{title}</h4><p role="alert" className="mt-3 text-sm text-red-900">Record inspection is unavailable because the selected snapshots contain unsupported or duplicate identifiers. Current workspaces are unchanged.</p></section>
  }
  return <section role="region" aria-label={title} className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
    <h4 className="text-base font-semibold text-neutral-950">{title}</h4>
    <p className="mt-2 text-xs leading-5 text-neutral-600">{commonNote}</p>
    {!report.modules.length && <p className="mt-3 text-sm text-neutral-600">Select at least one workspace to inspect its records.</p>}
    {report.modules.map(module => <div key={module.module} className="mt-5" role="group" aria-label={`${labels[module.module]} captured collection counts`}>
      <h5 className="font-semibold text-neutral-950">{labels[module.module]} · <output aria-label={`${labels[module.module]} primary record count`}>{number(module.primaryRecordCount)}</output> primary records</h5>
      <p className="mt-1 text-xs leading-5 text-neutral-500">Counts describe stored record instances, not distinct people. Nested rows describe contained records and collection containers and are excluded from the primary total. Saved preview selections, checklist flags and sequence counters are metadata. The current payroll snapshot counts once even when idle; maps count one record per key. Static fixture directories are not captured records.</p>
      <div className="mt-3 overflow-x-auto"><table className={tableClass}>
        <caption className="sr-only">{labels[module.module]} complete captured collection breakdown</caption>
        <thead><tr className="border-b border-neutral-200 text-neutral-600"><th scope="col" className="px-3 py-2 font-medium">Collection</th><th scope="col" className="px-3 py-2 font-medium">Category</th><th scope="col" className="px-3 py-2 font-medium">Count</th><th scope="col" className="px-3 py-2 font-medium">Bounded identifiers</th></tr></thead>
        <tbody>{module.collections.map(collection => <tr key={collection.key} data-collection={collection.key}>
          <th scope="row" className={`${cellClass} font-medium text-neutral-900`}>{collection.label}<span className="mt-1 block text-xs font-normal leading-5 text-neutral-500">{collection.identityRule}</span></th>
          <td className={`${cellClass} text-xs text-neutral-600`}>{kinds[collection.kind]}</td>
          <td className={`${cellClass} tabular-nums text-neutral-950`}><output aria-label={`${labels[module.module]} ${collection.key} count`}>{number(collection.count)}</output></td>
          <td className={cellClass}><Identifiers values={collection.identifiers} omitted={collection.omittedIdentifiers} /></td>
        </tr>)}</tbody>
      </table></div>
    </div>)}
  </section>
}

type DifferenceProps = { current: Partial<DemoWorkspaces>; target: Partial<DemoWorkspaces>; modules: readonly DemoModule[]; title?: string }

const metadataLabels: Record<string, string> = {
  collectionId: 'Collection ID', draftRevision: 'Draft revision', workflowStatus: 'Workflow status',
  approvalRevision: 'Approval revision', approvalReviewerId: 'Reviewer ID', approvalReceiptId: 'Approval receipt ID',
  publicationRevision: 'Published revision', publicationReceiptId: 'Publication receipt ID',
  ownerId: 'Owner ID', companyId: 'Company ID', contactId: 'Contact ID', opportunityId: 'Opportunity ID',
  leadState: 'Lead state', opportunityStage: 'Opportunity stage', leadId: 'Lead ID',
  employeeId: 'Employee ID', instanceId: 'Employment instance ID', previousInstanceId: 'Previous employment instance ID',
  managerId: 'Manager ID', startDate: 'Start date', endDate: 'End date', templateVersion: 'Captured template version', taskCount: 'Captured task count',
  employmentStatus: 'Employment status', sequence: 'Saved sequence', effectiveDate: 'Effective date', eventKind: 'Lifecycle event kind',
  actorId: 'Acting preview ID', actorRole: 'Acting preview role', actorEmployeeId: 'Acting employee ID', actorContractorId: 'Acting contractor ID',
  correctionId: 'Correction request ID', origin: 'Directory change origin', field: 'Directory field', correctionStatus: 'Correction request status',
  transitionId: 'Lifecycle transition ID', assignmentKind: 'Offboarding assignment kind', assignmentStatus: 'Assignment status',
  employmentInstanceId: 'Employment instance ID', sourceId: 'Source assignment ID', lifecycleTransitionId: 'Lifecycle transition ID', offboardingKind: 'Offboarding task kind',
  entryId: 'Content entry ID', authorId: 'Author ID', createdBy: 'Release creator ID', preparedAtSequence: 'Prepared at sequence', activatedAtSequence: 'Activated at sequence',
  memberCount: 'Captured member count', activatedPublicationCount: 'Activated publication count',
  fromOwnerId: 'Previous owner ID', toOwnerId: 'Target owner ID', recordId: 'Ownership source record ID',
  affectedCompanies: 'Affected company ID references', affectedContacts: 'Affected contact ID references', affectedLeads: 'Affected lead ID references',
  affectedOpportunities: 'Affected opportunity ID references', affectedTasks: 'Affected task ID references',
}
function RecordMetadata({ metadata, side, identifier }: { metadata: StructuredRecordMetadata | null; side: string; identifier: string }) {
  return <div className="min-w-0 rounded-md bg-neutral-50 p-3">
    <p className="text-xs font-semibold text-neutral-900">{side}</p>
    {metadata === null ? <p className="mt-2 text-xs text-neutral-500">Record absent</p> : <dl aria-label={`${side} ${identifier} metadata`} className="mt-2 space-y-2 text-xs leading-5">{Object.entries(metadata).map(([key, value]) => <div key={key}><dt className="text-neutral-500">{metadataLabels[key]}</dt><dd className="break-all font-medium text-neutral-800">{value === null ? 'None' : value}</dd></div>)}</dl>}
  </div>
}
function RecordDifferences({ records, omitted, kind }: { records: WorkspaceRecordDifference[]; omitted: number; kind: string }) {
  return <>
    {records.length ? <ul className="space-y-3">{records.map(record => <li key={record.identifier} data-record-id={record.identifier} data-record-difference={kind} className="rounded-md border border-neutral-200 p-3">
      <h6 className="break-all text-xs font-semibold text-neutral-950"><code>{record.identifier}</code></h6>
      {record.projections && <dl aria-label={`CMS ${record.identifier} projection changes`} className="mt-2 space-y-1 text-xs">{Object.entries(record.projections).map(([key, value]) => <div key={key} className="flex flex-wrap justify-between gap-2"><dt className="text-neutral-600">{{ draft: 'Draft projection', approval: 'Approval projection', publication: 'Published projection' }[key]}</dt><dd className="font-semibold text-neutral-900">{value}</dd></div>)}</dl>}
      <div className="mt-3 grid gap-2 xl:grid-cols-2"><RecordMetadata metadata={record.before} side="Current" identifier={record.identifier} /><RecordMetadata metadata={record.after} side="Target" identifier={record.identifier} /></div>
    </li>)}</ul> : <span className="text-xs text-neutral-500">None</span>}
    {omitted > 0 && <p className="mt-1 text-xs leading-5 text-neutral-500">{number(omitted)} more record details omitted</p>}
  </>
}
function ChangeIdentifiers({ collection }: { collection: WorkspaceCollectionDifference }) {
  return <div className="space-y-3">{(['added', 'removed', 'changed'] as const).map(kind => <div key={kind}><p className="mb-1 text-xs font-semibold capitalize text-neutral-700">{kind}</p>{collection.recordDetails ? <RecordDifferences records={collection.recordDetails[kind]} omitted={collection.omittedIdentifiers[kind]} kind={kind} /> : <Identifiers values={collection.identifiers[kind]} omitted={collection.omittedIdentifiers[kind]} />}</div>)}</div>
}

/** Current -> target differences for selective restore or Undo; no application. */
export function WorkspaceDifferencePreview({ current, target, modules, title = 'Selected workspace differences' }: DifferenceProps) {
  let report
  try { report = compareWorkspaces(current, target, modules) } catch {
    return <section role="region" aria-label={title} className="mt-4 rounded-lg border border-neutral-200 bg-white p-4"><h4 className="text-base font-semibold text-neutral-950">{title}</h4><p role="alert" className="mt-3 text-sm text-red-900">Difference inspection is unavailable because the selected snapshots contain unsupported or duplicate identifiers. Current workspaces are unchanged.</p></section>
  }
  return <section role="region" aria-label={title} className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
    <h4 className="text-base font-semibold text-neutral-950">{title}</h4>
    <p className="mt-2 text-xs leading-5 text-neutral-600">Added means present only in the target; removed means present only in the current workspace. Changed means the same identifier has different saved fields, including hidden fields. CMS entry details separate draft, approval and frozen publication projections; CRM details show owner/link IDs and lead states or opportunity stages. The same bounded identifier limit applies to these structured details. Selected workspaces are replaced as a whole. {redactionNote}</p>
    {!report.modules.length && <p className="mt-3 text-sm text-neutral-600">Select at least one workspace to compare before restoring.</p>}
    {report.modules.map(module => <div key={module.module} className="mt-5" role="group" aria-label={`${labels[module.module]} difference counts`}>
      <h5 className="font-semibold text-neutral-950">{labels[module.module]} primary record differences</h5>
      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">{(['added', 'removed', 'changed', 'unchanged'] as const).map(kind => <div key={kind} className="flex gap-2"><dt className="capitalize text-neutral-600">{kind}</dt><dd className="font-semibold tabular-nums text-neutral-950"><output aria-label={`${labels[module.module]} ${kind} primary records`}>{number(module[kind])}</output></dd></div>)}</dl>
      <p className="mt-2 text-xs leading-5 text-neutral-500">Module totals count primary records only. A nested record change can also change its complete parent; nested rows are shown separately without adding them twice. Saved metadata is excluded from entity totals. Reordering identified collections alone is unchanged.</p>
      {!module.hasChanges && <p className="mt-2 text-sm text-neutral-600">No saved record or listed metadata differences in this selected workspace.</p>}
      <div className="mt-3 overflow-x-auto"><table className={tableClass}>
        <caption className="sr-only">{labels[module.module]} complete collection differences from current to target</caption>
        <thead><tr className="border-b border-neutral-200 text-neutral-600">{['Collection', 'Category', 'Current', 'Target', 'Added', 'Removed', 'Changed', 'Bounded identifiers and record details'].map(label => <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
        <tbody>{module.collections.map(collection => <tr key={collection.key} data-collection={collection.key}>
          <th scope="row" className={`${cellClass} font-medium text-neutral-900`}>{collection.label}<span className="mt-1 block text-xs font-normal leading-5 text-neutral-500">{collection.identityRule}</span></th>
          <td className={`${cellClass} text-xs text-neutral-600`}>{kinds[collection.kind]}</td>
          {(['beforeCount', 'afterCount', 'added', 'removed', 'changed'] as const).map(key => <td key={key} className={`${cellClass} tabular-nums text-neutral-950`}><output aria-label={`${labels[module.module]} ${collection.key} ${key}`}>{number(collection[key])}</output></td>)}
          <td className={cellClass}><ChangeIdentifiers collection={collection} /></td>
        </tr>)}</tbody>
      </table></div>
    </div>)}
  </section>
}
