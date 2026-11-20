#!/usr/bin/env node
import { createHash } from 'node:crypto'
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

Use {"action":"cancel"} in review to return to your selection and draft.
Use {"action":"context"} to see your selection, draft, and current mode.
Selecting a newer revision of the same target keeps its draft.
Edit a page with page.setRoute, a node with node.setLabel, or a component
with component.setVersion. Each edit requires a source-owned mapping at the
accepted revision. Confirming updates graph metadata in the running LAN service.
Start the LAN host with SYSTEMX_LAN_GRAPH_EDIT_CAPABILITIES to restrict editing.
Use comma-separated exact IDs, e.g. lan.page.setRoute@1,lan.node.setLabel@1.
An unset variable enables all three. An empty or malformed list disables all.
End input (Ctrl-D) to close the editor and release the current proposal.
`

const operations = ['page.setRoute', 'node.setLabel', 'component.setVersion']
const id = /^[A-Za-z][A-Za-z0-9_-]{0,95}$/
const hash = /^[a-f0-9]{64}$/
const is = (pattern, value) => typeof value === 'string' && pattern.test(value)
const publicId = value => publicDiagnosticId(value) ?? 'redacted:' + createHash('sha256').update(value).digest('hex')
const exact = (obj, keys) => obj && typeof obj === 'object' && !Array.isArray(obj)
  && Object.keys(obj).length === keys.length && keys.every(k => Object.hasOwn(obj, k))
class Refusal extends Error {
  constructor(code, message) { super(message); this.code = code }
}
const refuse = (code, message) => { throw new Refusal(code, message) }
const shape = () => refuse('EDITOR_INPUT', 'Use the fields and actions shown in --help.')
const invalidReply = () => refuse('EDITOR_RESPONSE', 'The LAN reply did not match this command. Check the current graph and proposal before continuing.')

const guidance = {
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

function operatorSession(connection) {
  let selection = null, draft = null, pending = null
  const context = () => ({ mode: pending ? 'review' : 'edit', selection, draft, proposalId: pending?.proposalId ?? null })

  async function send(body) {
    const { status, data } = await connection.command(body)
    if (data?.ok === false && status >= 400) {
      const code = data.error?.code
      if (code === 'SCOPED_DISABLED' && draft) refuse(code, 'Required capability lan.' + draft.operation + '@1. ' + guidance[code])
      if (Object.hasOwn(guidance, code)) refuse(code, guidance[code])
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
        if (e.code === 'SCOPED_PROPOSAL_MISSING') pending = null
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
        || !['page','node','component'].includes(input.target.kind)) shape()
      if (selection?.documentId !== input.documentId || selection.target.kind !== input.target.kind || selection.target.id !== input.target.id) draft = null
      selection = { documentId: input.documentId, expectedRevision: input.expectedRevision, target: input.target }
      return { selected: true }
    }
    if (!selection) refuse('EDITOR_NO_SELECTION', 'Select a document revision and target.')
    if (action === 'draft') {
      if (!exact(input, ['action','operation','value']) || !operations.includes(input.operation)
        || typeof input.value !== 'string' || input.value.length > 512) shape()
      draft = { operation: input.operation, value: input.value }
      return { drafted: true }
    }
    if (action !== 'review' || !exact(input, ['action'])) shape()
    if (!draft) refuse('EDITOR_NO_DRAFT', 'Enter a draft value for the selected operation.')
    const capabilityId = 'lan.' + draft.operation + '@1'
    const result = await send({ action, ...selection, ...draft, capabilityId })
    const { proposalId, confirmationText, expiresAt, operation, documentId, target, targetRevision,
      candidateRevision, effects, owners } = result
    if (!is(hash, proposalId) || !Number.isSafeInteger(expiresAt) || operation !== draft.operation || result.capabilityId !== capabilityId
      || documentId !== publicId(selection.documentId) || !exact(target, ['kind','id']) || target.kind !== selection.target.kind || target.id !== publicId(selection.target.id)
      || targetRevision !== selection.expectedRevision || !is(hash, candidateRevision) || candidateRevision === targetRevision
      || confirmationText !== 'APPLY ' + operation + ' ' + proposalId + ' AT ' + targetRevision
      || result.sourceWrites !== false) invalidReply()
    validateImpact(effects, owners, target)
    pending = { proposalId, targetRevision, candidateRevision, confirmationText, uncertain: false }
    return { mode: 'review', proposalId, confirmationText, expiresAt, operation, capabilityId, documentId,
      target, targetRevision, candidateRevision, sourceWrites: false, effects, owners }
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
      if (prefix.length + end - start > 8192) refuse('EDITOR_LINE_LIMIT', 'Keep each command line within 8192 bytes.')
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
    message: known ? error.message : 'The local LAN connection failed. Check the service and current graph revision.' } })
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
