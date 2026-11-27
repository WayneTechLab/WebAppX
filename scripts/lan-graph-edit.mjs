#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { createCommandProposal } from '../.SYSTEMX/LAN/Builder/command-proposal.mjs'
import { exportGraphDocument } from '../.SYSTEMX/LAN/Builder/graph-evolution.mjs'
import { publicDiagnosticId } from '../.SYSTEMX/LAN/Builder/graph-core.mjs'
import { isGraphOrigin, openGraphConnection } from './lan-graph-connection.mjs'
import { parsePublicJson } from './package-script-discovery.mjs'

const help = `LAN graph metadata editor
  node scripts/lan-graph-edit.mjs --origin http://127.0.0.1:PORT

Enter one JSON object per line. Start with {"action":"list"} to see accepted
documents and revisions. Choose IDs from the selected graph export.

  {"action":"select","documentId":"example","expectedRevision":"SHA256","target":{"kind":"node","id":"title"}}
  {"action":"draft","operation":"node.setLabel","value":"Welcome"}
  {"action":"review"}
  {"action":"confirm","confirmation":"ENTER THE EXACT TEXT FROM THIS REVIEW"}

To review several edits together, select a document revision and enter a batch:
  {"action":"draftBatch","edits":[{"operation":"node.setLabel","target":{"kind":"node","id":"title"},"expectedValue":"Old title","value":"Welcome"}]}
  {"action":"review"}

Each batch contains 1–16 explicit edits in the selected document. expectedValue
is optional on metadata edits. Review shows individual targets, changes including
linked references, unaffected counts, checked source hashes, and prior-value checks.
node.planSourceReplacement checks mapped
source ranges for conflicts. Source replacement cannot be committed by this editor.
Use {"action":"cancel"} in review to return to your selection and draft.
Use {"action":"context"} to see your selection, draft, and current mode.
Selecting a newer revision of the same target keeps its draft.
Edit a page with page.setRoute, a node with node.setLabel, or a component
with component.setVersion. Each edit requires a source-owned mapping at the
accepted revision. Confirming updates graph metadata in the running LAN service.
Start the LAN host with SYSTEMX_LAN_GRAPH_EDIT_CAPABILITIES to restrict editing.
Use comma-separated exact IDs, e.g. lan.page.setRoute@1,lan.node.setLabel@1.
An unset variable enables all installed operations. An empty or malformed list disables all.
End input (Ctrl-D) to close the editor and release the current proposal.
`

const operations = ['page.setRoute', 'node.setLabel', 'component.setVersion', 'node.planSourceReplacement']
const sourceOperation = 'node.planSourceReplacement'
const editField = { 'node.setLabel': 'label', 'page.setRoute': 'route', 'component.setVersion': 'version' }
const tables = { page: 'pages', node: 'nodes', component: 'components', reference: 'references', collection: 'collections' }
const id = /^[A-Za-z][A-Za-z0-9_-]{0,95}$/
const hash = /^[a-f0-9]{64}$/
const is = (pattern, value) => typeof value === 'string' && pattern.test(value)
const publicId = value => publicDiagnosticId(value) ?? 'redacted:' + createHash('sha256').update(value).digest('hex')
const exact = (obj, keys) => obj && typeof obj === 'object' && !Array.isArray(obj)
  && Object.keys(obj).length === keys.length && keys.every(k => Object.hasOwn(obj, k))
class Refusal extends Error {
  constructor(code, message, extras = {}) { super(message); this.code = code; this.extras = extras }
}
const refuse = (code, message, extras) => { throw new Refusal(code, message, extras) }
const shape = () => refuse('EDITOR_INPUT', 'Use the fields and actions shown in --help.')
const invalidReply = () => refuse('EDITOR_RESPONSE', 'The LAN reply did not match this command. Check the current graph and proposal before continuing.')

const guidance = {
  SCOPED_SHAPE: 'Use the declared fields for every edit.',
  SCOPED_OPERATION: 'Choose an installed operation.',
  SCOPED_TARGET_ID: 'Select a qualified document and target.',
  SCOPED_BATCH_LIMIT: 'Use between 1 and 16 explicit edits.',
  SCOPED_PRECONDITION: 'Check the current value of the indicated target field.',
  SCOPED_SOURCE_STALE: 'A mapped source changed. Refresh the graph mapping and review the draft again.',
  SCOPED_SOURCE_UNAVAILABLE: 'Restore the unavailable mapped source and review the draft again.',
  SCOPED_WRITE_CONFLICT: 'Two edits write the same document field or overlapping source ranges. Separate the conflicting edits.',
  SCOPED_SOURCE_PROMOTION_UNAVAILABLE: 'Source write ranges were checked. Only graph metadata can be committed.',
  SCOPED_CAPABILITY: 'Use the capability for the selected operation.',
  SCOPED_DISABLED: 'This LAN host disabled the selected capability. Choose an enabled operation or contact the local operator.',
  SCOPED_TARGET_KIND: 'Choose a page for page.setRoute, a node for node.setLabel, or a component for component.setVersion.',
  SCOPED_OWNER_REQUIRED: 'Choose a target with a source-owned editable mapping at the accepted source revision.',
  SCOPED_STALE: 'Read the current document revision and create a new review.',
  SCOPED_ROUTE_USED: 'Choose a route unused by another page.',
  SCOPED_ROUTE: 'Use a local route beginning with / and simple path segments.',
  SCOPED_OVERLAP: 'Another proposal holds this revision. Cancel that proposal or wait for expiry.',
  SCOPED_CAPACITY: 'Cancel an open proposal or wait for expiry.',
  SCOPED_CONFIRMATION: 'Enter the exact confirmation from the current review.',
  SCOPED_PROPOSAL_MISSING: 'The proposal is no longer active. Check the graph revision before reviewing the draft again.',
  SCOPED_DOCUMENT_MISSING: 'Select an accepted document from list.',
  SCOPED_TARGET_MISSING: 'Select a target present in the accepted document.',
  SCOPED_VALUE: 'Use a valid, bounded value for the selected field.',
  SCOPED_NO_EFFECT: 'The target already has this value.',
  SCOPED_EFFECT_LIMIT: 'The change exceeds the complete review limit.',
  SCOPED_REVISION: 'Use the full revision in the selected review.',
}

function validateImpact(effects, owners, target) {
  if (!exact(effects, ['added','removed','changed','reordered']) || !Array.isArray(owners)
    || !['added','removed','reordered'].every(kind => Array.isArray(effects[kind]) && effects[kind].length === 0)
    || !Array.isArray(effects.changed) || !effects.changed.length || effects.changed.length > 50) invalidReply()
  const ownerIds = new Set()
  for (const owner of owners) {
    if (!exact(owner, ['id','kind','path']) || ownerIds.has(owner.id)) invalidReply()
    if (owner.kind === 'document') {
      if (owner.id !== 'document' || owner.path !== null) invalidReply()
    } else {
      if (owner.kind !== 'source' || !is(/^source:[a-f0-9]{64}$/, owner.id)) invalidReply()
      if (owner.path !== null && (typeof owner.path !== 'string' || !owner.path.startsWith('src/')
        || !owner.path.split('/').every(part => part.split('.').every(word => publicDiagnosticId(word)))
        || owner.id !== 'source:' + createHash('sha256').update(owner.path).digest('hex'))) invalidReply()
    }
    ownerIds.add(owner.id)
  }
  const fields = { page: 'route', node: 'label', component: 'version', reference: 'expectedVersion' }
  let matched = false
  for (const row of effects.changed) {
    if (!exact(row, ['kind','id','fields','ownersBefore','ownersAfter']) || !Object.hasOwn(fields, row.kind)
      || !Array.isArray(row.fields) || row.fields.length !== 1 || row.fields[0] !== fields[row.kind]
      || ![row.ownersBefore, row.ownersAfter].every(list => Array.isArray(list) && list.length && list.every(v => ownerIds.has(v)))) invalidReply()
    if (row.kind === target.kind && row.id === target.id && !matched) matched = true
    else if (target.kind !== 'component' || row.kind !== 'reference' || !(publicDiagnosticId(row.id) || is(/^redacted:[a-f0-9]{64}$/, row.id))) invalidReply()
  }
  if (!matched) invalidReply()
}

const targetMatches = (a, b) => exact(a, ['kind','id']) && a.kind === b.kind && a.id === b.id
const publishedTarget = target => ({ kind: target.kind, id: publicId(target.id) })

function validatedEdit(input, single) {
  const keys = ['operation','value', single ? 'action' : 'target']
  if (Object.hasOwn(input ?? {}, 'expectedValue')) keys.push('expectedValue')
  if (!exact(input, keys) || !operations.includes(input.operation) || typeof input.value !== 'string' || input.value.length > 512
    || (Object.hasOwn(input, 'expectedValue') && input.expectedValue !== null &&
      (typeof input.expectedValue !== 'string' || input.expectedValue.length > 512))) shape()
  if (!single && (!exact(input.target, ['kind','id']) || !['page','node','component'].includes(input.target.kind) || !is(id, input.target.id))) shape()
  const { action: _action, ...edit } = input
  return edit
}

async function pinnedDocument(connection, selection) {
  const result = await connection.query('graph.document', { documentId: selection.documentId, revision: selection.expectedRevision })
  const baseline = exportGraphDocument(result.document)
  if (baseline.document.workspaceId !== connection.workspace || baseline.document.documentId !== selection.documentId ||
    baseline.revision !== selection.expectedRevision || result.revision !== baseline.revision) invalidReply()
  return baseline
}

async function conflictFor(connection, selection, edits, details, value) {
  const keys = ['kind','firstEditIndex','secondEditIndex','firstTarget','secondTarget']
  const source = value?.kind === 'source'
  if (!exact(value, keys.concat(source ? ['ownerId','firstRange','secondRange'] : ['field'])) || !edits ||
    !Number.isInteger(value.firstEditIndex) || !Number.isInteger(value.secondEditIndex) ||
    value.firstEditIndex < 0 || value.secondEditIndex >= edits.length || value.firstEditIndex >= value.secondEditIndex ||
    details?.editIndex !== value.secondEditIndex) invalidReply()
  const first = edits[value.firstEditIndex], second = edits[value.secondEditIndex]
  if (!targetMatches(value.firstTarget, publishedTarget(first.target)) || !targetMatches(value.secondTarget, publishedTarget(second.target))) invalidReply()
  if (source) {
    if (first.operation !== sourceOperation || second.operation !== sourceOperation) invalidReply()
    const baseline = await pinnedDocument(connection, selection)
    const mappings = [first, second].map(edit => baseline.document.nodes.find(node => node.id === edit.target.id)?.source)
    if (mappings.some(mapping => !mapping) || mappings[0].path !== mappings[1].path ||
      value.ownerId !== 'source:' + createHash('sha256').update(mappings[0].path).digest('hex')) invalidReply()
    for (const [i, range] of [value.firstRange, value.secondRange].entries()) {
      if (!isDeepStrictEqual(range, { start: mappings[i].start, end: mappings[i].end })) invalidReply()
    }
  } else if (value.kind !== 'document' || first.operation !== second.operation ||
    (editField[first.operation] !== value.field && !(first.operation === 'component.setVersion' && value.field === 'expectedVersion')) ||
    first.target.kind !== second.target.kind || first.target.id !== second.target.id) invalidReply()
  return value
}

// Verify the reviewed result against the precise accepted revision. In
// particular, a component version may affect linked references outside the
// selected IDs. The operator must see those changes and accurate remaining counts.
async function verifyBatch(connection, selection, edits, review) {
  const targets = edits.map(edit => publishedTarget(edit.target))
  if (!isDeepStrictEqual(review.targets, targets) || edits.some(edit => edit.operation === sourceOperation)) invalidReply()
  const baseline = await pinnedDocument(connection, selection)
  const candidate = structuredClone(baseline.document)
  const nodes = new Map(candidate.nodes.map(node => [node.id, node]))
  const sources = new Map()
  const preconditions = edits.map((edit, index) => ({ target: targets[index], capabilityId: 'lan.' + edit.operation + '@1',
    expectedValueChecked: Object.hasOwn(edit, 'expectedValue') }))
  if (!isDeepStrictEqual(review.preconditions, preconditions)) invalidReply()
  for (const edit of edits) {
    const target = candidate[tables[edit.target.kind]].find(row => row.id === edit.target.id)
    const field = editField[edit.operation]
    if (!target || !Object.hasOwn(target, field) || (Object.hasOwn(edit, 'expectedValue') && edit.expectedValue !== target[field])) invalidReply()
    const mapped = [edit.target.kind === 'node' ? target : nodes.get(target.rootId)]
    while (mapped.length) {
      const node = mapped.pop()
      if (node.source) {
        const ownerId = 'source:' + createHash('sha256').update(node.source.path).digest('hex')
        sources.set(ownerId, node.source.sourceRevision)
      }
      if (edit.target.kind !== 'node') for (const child of node.childIds) mapped.push(nodes.get(child))
    }
    if (edit.operation === 'component.setVersion') {
      for (const ref of candidate.references) {
        if (ref.kind === 'component' && ref.documentId === candidate.documentId && ref.targetId === target.id && ref.expectedVersion === target.version) {
          ref.expectedVersion = edit.value
        }
      }
    }
    target[field] = edit.value
  }
  const sourceChecks = [...sources].map(([ownerId, revision]) => ({ ownerId, revision }))
  if (!isDeepStrictEqual(review.sourceChecks, sourceChecks)) invalidReply()
  let expected
  try { expected = createCommandProposal({ baseline, candidate, expectedRevision: baseline.revision }) }
  catch { invalidReply() }
  const affected = expected.effects.changed.map(({ kind, id }) => ({ kind, id }))
  const unaffected = Object.fromEntries(Object.entries(tables).map(([kind, table]) => [
    table, baseline.document[table].length - affected.filter(row => row.kind === kind).length,
  ]))
  const scope = { affected, unaffected, outsideSelection: 'all-other-objects-and-documents-unchanged', sourceWrites: false }
  if (review.candidateRevision !== expected.candidateRevision || !isDeepStrictEqual(review.effects, expected.effects) ||
    !isDeepStrictEqual(review.owners, expected.owners) || !isDeepStrictEqual(review.scope, scope)) invalidReply()
}

function operatorSession(connection) {
  let selection = null, draft = null, pending = null
  const context = () => ({ mode: pending ? 'review' : 'edit', selection, draft, proposalId: pending?.proposalId ?? null })

  async function send(body) {
    const { status, data } = await connection.command(body)
    if (data?.ok === false && status >= 400) {
      const code = data.error?.code
      if (Object.hasOwn(guidance, code)) {
        let edit, details
        if (Object.hasOwn(data.error, 'details')) {
          const d = data.error.details
          if (!exact(d, ['editIndex','condition','target']) || d.condition !== code) invalidReply()
          if (d.editIndex === null) {
            if (!targetMatches(d.target, { kind: 'document', id: publicId(selection.documentId) })) invalidReply()
          } else {
            const edits = draft?.edits ?? [{ ...draft, target: selection.target }]
            if (!Number.isInteger(d.editIndex) || d.editIndex < 0 || d.editIndex >= edits.length) invalidReply()
            edit = edits[d.editIndex]
            if (!targetMatches(d.target, publishedTarget(edit.target))) invalidReply()
          }
          details = d
        }
        const op = edit?.operation ?? draft?.operation
        const message = code === 'SCOPED_DISABLED' && op ? 'Required capability lan.' + op + '@1. ' + guidance[code] : guidance[code]
        const conflict = code === 'SCOPED_WRITE_CONFLICT' ? await conflictFor(connection, selection, draft?.edits, details, data.error.conflict) : undefined
        const reason = data.error.reason
        const retired = code === 'SCOPED_PROPOSAL_MISSING' && ['expired','canceled','confirmed','document-changed','source-changed','precondition-failed'].includes(reason)
        refuse(code, message, { ...(details && { details }), ...(conflict && { conflict }), ...(retired && { reason }) })
      }
      refuse('EDITOR_REFUSED', 'The LAN service refused the command. Check its session, target and command fields.')
    }
    if (status !== 200 || data?.ok !== true || !data.result) invalidReply()
    return data.result
  }

  async function run(input) {
    const action = input?.action
    if (action === 'list' && exact(input, ['action'])) {
      const status = await connection.query('graph.status')
      if (status.workspaceId !== connection.workspace) invalidReply()
      return { documents: status.documents.map(({ documentId, revision }) => ({ documentId, revision })) }
    }
    if (action === 'context' && exact(input, ['action'])) return context()
    if (action === 'confirm' || action === 'cancel') {
      if (!exact(input, action === 'confirm' ? ['action','confirmation'] : ['action'])) shape()
      if (!pending) refuse('EDITOR_NO_REVIEW', 'Review a draft before making a decision.')
      if (action === 'confirm' && input.confirmation !== pending.confirmationText) {
        refuse('SCOPED_CONFIRMATION', guidance.SCOPED_CONFIRMATION)
      }
      if (action === 'confirm' && pending.uncertain) {
        refuse('EDITOR_UNCERTAIN', 'The previous confirmation has an unknown outcome. List the current graph revision and cancel this review before starting another.')
      }
      const { proposalId, targetRevision, candidateRevision } = pending
      // Once dispatched, a lost confirmation reply cannot be retried safely.
      // An explicit server refusal is conclusive. A timeout or malformed reply is not.
      if (action === 'confirm') pending.uncertain = true
      let result
      try {
        result = await send({ ...input, proposalId, expectedRevision: targetRevision })
      } catch (e) {
        if (['SCOPED_PROPOSAL_MISSING', 'SCOPED_SOURCE_STALE', 'SCOPED_SOURCE_UNAVAILABLE', 'SCOPED_STALE'].includes(e.code)) pending = null
        else if (pending && Object.hasOwn(guidance, e.code) && action === 'confirm') pending.uncertain = false
        throw e
      }
      if (result.proposalId !== proposalId || result.documentId !== publicId(selection.documentId)) invalidReply()
      if (action === 'cancel') {
        if (result.canceled !== true || result.targetRevision !== targetRevision) invalidReply()
      } else {
        if (result.revision !== candidateRevision) invalidReply()
        selection = { ...selection, expectedRevision: candidateRevision }
        draft = null
      }
      pending = null
      return { decision: action, ...context() }
    }

    if (pending) refuse('EDITOR_REVIEW_OPEN', 'Confirm or cancel the open review before changing selection or draft.')
    if (action === 'select') {
      if (!exact(input, ['action','documentId','expectedRevision','target']) || !exact(input.target, ['kind','id'])
        || !is(id, input.documentId) || !is(hash, input.expectedRevision) || !is(id, input.target.id)
        || !['page','node','component','document'].includes(input.target.kind)
        || (input.target.kind === 'document' && input.target.id !== input.documentId)) shape()
      if (selection?.documentId !== input.documentId || selection.target.kind !== input.target.kind || selection.target.id !== input.target.id) draft = null
      selection = { documentId: input.documentId, expectedRevision: input.expectedRevision, target: input.target }
      return { selected: true }
    }
    if (!selection) refuse('EDITOR_NO_SELECTION', 'Select a document revision and target.')
    if (action === 'draftBatch') {
      if (!exact(input, ['action','edits']) || !Array.isArray(input.edits)) shape()
      if (!input.edits.length || input.edits.length > 16) refuse('SCOPED_BATCH_LIMIT', guidance.SCOPED_BATCH_LIMIT)
      draft = { edits: input.edits.map(edit => validatedEdit(edit, false)) }
      return { drafted: true }
    }
    if (action === 'draft') {
      if (selection.target.kind === 'document') refuse('EDITOR_INPUT', 'Choose a page, node or component for a single edit, or enter a batch.')
      draft = validatedEdit(input, true)
      return { drafted: true }
    }
    if (action !== 'review' || !exact(input, ['action'])) shape()
    if (!draft) refuse('EDITOR_NO_DRAFT', 'Enter a draft value for the selected operation.')
    const batch = Boolean(draft.edits)
    const selectedOperation = batch ? 'graph.batch' : draft.operation
    const capabilityId = 'lan.' + selectedOperation + '@1'
    const request = batch ? { action: 'reviewBatch', documentId: selection.documentId, expectedRevision: selection.expectedRevision,
      edits: draft.edits.map(edit => ({ ...edit, capabilityId: 'lan.' + edit.operation + '@1' })) } : { action, ...selection, ...draft, capabilityId }
    const result = await send(request)
    const { proposalId, confirmationText, expiresAt, operation, documentId, target, targetRevision,
      candidateRevision, effects, owners } = result
    const expectedTarget = batch ? { kind: 'document', id: publicId(selection.documentId) } : publishedTarget(selection.target)
    if (!is(hash, proposalId) || !Number.isSafeInteger(expiresAt) || operation !== selectedOperation || result.capabilityId !== capabilityId
      || documentId !== publicId(selection.documentId) || !targetMatches(target, expectedTarget)
      || targetRevision !== selection.expectedRevision || !is(hash, candidateRevision) || candidateRevision === targetRevision
      || confirmationText !== 'APPLY ' + operation + ' ' + proposalId + ' AT ' + targetRevision
      || result.sourceWrites !== false || result.domainEffect !== 'accept-local-memory') invalidReply()
    try {
      if (batch) await verifyBatch(connection, selection, draft.edits, result)
      else if (operation === sourceOperation) invalidReply()
      else validateImpact(effects, owners, target)
    } catch (error) {
      // Release only the receipt already correlated to this workspace, command
      // and revision. No confirmation may be sent for a failed local review.
      await send({ action: 'cancel', proposalId, expectedRevision: targetRevision }).catch(() => {})
      throw error
    }
    pending = { proposalId, targetRevision, candidateRevision, confirmationText, uncertain: false }
    return { mode: 'review', proposalId, confirmationText, expiresAt, operation, capabilityId, documentId,
      target, ...(batch && { targets: result.targets, scope: result.scope, sourceChecks: result.sourceChecks, preconditions: result.preconditions }), targetRevision, candidateRevision, sourceWrites: false, effects, owners }
  }
  return { run, hasPending: () => Boolean(pending) }
}

// Process lines consecutively, including data typed while a request is pending.
// Bound the incomplete line as it arrives, so a missing newline cannot grow memory.
async function* lines(stream) {
  let prefix = Buffer.alloc(0)
  for await (const chunk of stream) {
    let start = 0
    while (start < chunk.length) {
      const newline = chunk.indexOf(10, start)
      const end = newline < 0 ? chunk.length : newline
      if (prefix.length + end - start > 131072) refuse('EDITOR_LINE_LIMIT', 'Keep each command line within 131072 bytes.')
      prefix = Buffer.concat([prefix, chunk.subarray(start, end)])
      if (newline < 0) break
      yield prefix
      prefix = Buffer.alloc(0)
      start = end + 1
    }
  }
  if (prefix.length) yield prefix
}

const emit = value => process.stdout.write(JSON.stringify(value) + '\n')
function failure(error) {
  const known = error instanceof Refusal
  emit({ ok: false, error: { code: known ? error.code : 'EDITOR_CONNECTION',
    message: known ? error.message : 'The local LAN connection failed. Check the service and current graph revision.',
    ...(known && error.extras) } })
  process.exitCode = 1
}
async function main(args) {
  if (args.length === 1 && ['--help','-h'].includes(args[0])) { process.stdout.write(help); return }
  if (args.length !== 2 || args[0] !== '--origin' || !isGraphOrigin(args[1])) {
    process.stderr.write('Use --help or specify --origin http://127.0.0.1:PORT.\n')
    process.exitCode = 2
    return
  }
  const session = operatorSession(await openGraphConnection(args[1]))
  if (process.stdin.isTTY) process.stderr.write('LAN graph metadata editor. Enter JSON actions, starting with {"action":"list"}. Use Ctrl-D to close.\n')
  let interrupted = false
  const interrupt = () => { interrupted = true; process.stdin.destroy() }
  process.once('SIGINT', interrupt)
  try {
    for await (const line of lines(process.stdin)) {
      if (interrupted) break
      try {
        let input
        try { input = parsePublicJson(new TextDecoder('utf-8', { fatal: true }).decode(line)) }
        catch { shape() }
        emit({ ok: true, result: await session.run(input) })
      } catch (error) { failure(error) }
    }
  } catch (error) {
    if (!interrupted) throw error
  } finally {
    process.off('SIGINT', interrupt)
    if (session.hasPending()) {
      try { emit({ ok: true, result: await session.run({ action: 'cancel' }) }) }
      catch (error) { failure(error) }
    }
  }
}
main(process.argv.slice(2)).catch(failure)
