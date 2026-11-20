#!/usr/bin/env node
import { constants } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { GraphError } from '../.SYSTEMX/LAN/Builder/graph-core.mjs'
import { isRelationalFinding } from '../.SYSTEMX/LAN/Builder/graph-validation.mjs'
import { exportGraphDocument } from '../.SYSTEMX/LAN/Builder/graph-evolution.mjs'
import { createCommandProposal, inspectCommandProposal } from '../.SYSTEMX/LAN/Builder/command-proposal.mjs'
import { GraphConnectionError, isGraphOrigin, openGraphConnection } from './lan-graph-connection.mjs'
import { parsePublicJson } from './package-script-discovery.mjs'

const help = `Read-only LAN graph command proposals

  node scripts/lan-command-proposal.mjs create --baseline BASELINE_EXPORT --candidate CANDIDATE_JSON --expected-revision SHA
  node scripts/lan-command-proposal.mjs inspect --baseline CURRENT_EXPORT --candidate CANDIDATE_JSON --proposal PROPOSAL_JSON

Use the builder's “Download selected graph export” for the baseline. Supply the
edited schema-1 graph document as the candidate. For create, SHA is the exact
64-character lowercase revision in the baseline. For inspect, provide the
current accepted baseline and the proposal produced by create.

Replace --baseline FILE with --origin http://127.0.0.1:PORT --document ID to
read the accepted graph from the direct LAN service. The tool obtains the local
dashboard session and reads graph status and document metadata. It only reviews
proposals. The JSON output includes the child IDs before and after a structural
change, zero-based placements, and affected source owners. The full review must
fit within 128000 bytes. Split larger edits and rerun create. Older saved reviews
with incomplete structural details need to be created again.

Use - for one JSON input from stdin. Inputs must be UTF-8 JSON, at most 2 MB
each, with unique object keys and regular file paths free of symbolic links.
Exit 0 indicates successful review, 1 a refused input or read, and 2 bad usage.
`
const maxBytes = 2_000_000
const actionableCodes = new Set([
  'COMMAND_EXPECTED_REVISION', 'COMMAND_BASELINE_STALE', 'COMMAND_TARGET_MISMATCH', 'COMMAND_SOURCE_CHANGED',
  'COMMAND_NO_EFFECT', 'COMMAND_EFFECT_LIMIT', 'COMMAND_PROPOSAL_INVALID', 'COMMAND_CANDIDATE_REPLACED', 'COMMAND_PROPOSAL_MISMATCH',
])
class InputError extends Error {}
class UsageError extends Error {}
const invalid = message => { throw new InputError(message) }
const usage = () => { throw new UsageError() }

function argumentsFor(args) {
  const [mode, ...rest] = args
  if (!['create', 'inspect'].includes(mode) || rest.length % 2) usage()
  const allowed = ['--baseline', '--origin', '--document', '--candidate', mode === 'create' ? '--expected-revision' : '--proposal']
  const values = new Map()
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i], value = rest[i + 1]
    if (!allowed.includes(key) || values.has(key) || !value || value.startsWith('--')) usage()
    values.set(key, value)
  }
  const baseline = values.get('--baseline'), origin = values.get('--origin'), documentId = values.get('--document')
  const candidate = values.get('--candidate'), proposal = values.get('--proposal'), expectedRevision = values.get('--expected-revision')
  if (!candidate || (!!baseline === !!origin) || (!!origin !== !!documentId)) usage()
  if ([baseline, candidate, proposal].filter(value => value === '-').length > 1) usage()
  if (mode === 'create' ? !/^[a-f0-9]{64}$/.test(expectedRevision ?? '') : !proposal) usage()
  if (origin && (!isGraphOrigin(origin)
    || !/^[A-Za-z][A-Za-z0-9_-]{0,95}$/.test(documentId))) usage()
  return { mode, baseline, origin, documentId, candidate, expectedRevision, proposal }
}

function decode(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { invalid('Input must be valid UTF-8.') }
}

function parse(text) {
  try { return parsePublicJson(text) }
  catch { invalid('Expected bounded JSON with unique object keys.') }
}

async function limitedStream(stream) {
  const parts = []
  let size = 0
  for await (const part of stream) {
    size += part.length
    if (size > maxBytes) invalid('Input exceeds the 2 MB limit.')
    parts.push(part)
  }
  return decode(Buffer.concat(parts, size))
}

async function readJson(filename) {
  if (filename === '-') {
    if (process.stdin.isTTY) invalid('Pipe one JSON document into standard input.')
    return parse(await limitedStream(process.stdin))
  }
  // Darwin's system-owned /tmp and /var aliases refer to their /private
  // counterparts. Every selected directory and file beneath them must be exact.
  let path = resolve(filename)
  if (process.platform === 'darwin') path = path.replace(/^\/(tmp|var)(?=\/)/, '/private/$1')
  let handle
  try {
    const before = await lstat(path, { bigint: true })
    if (!before.isFile() || relative(path, await realpath(path)) !== '') invalid('Choose a regular file without symbolic links.')
    handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
    const opened = await handle.stat({ bigint: true })
    if (!opened.isFile() || before.dev !== opened.dev || before.ino !== opened.ino) invalid('The selected file changed during review.')
    if (opened.size > BigInt(maxBytes)) invalid('Input exceeds the 2 MB limit.')
    const bytes = Buffer.alloc(Number(opened.size) + 1)
    let offset = 0
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset)
      if (!bytesRead) break
      offset += bytesRead
    }
    const after = await handle.stat({ bigint: true })
    if (BigInt(offset) !== opened.size || opened.ctimeNs !== after.ctimeNs || opened.mtimeNs !== after.mtimeNs) invalid('The selected file changed during review.')
    return parse(decode(bytes.subarray(0, offset)))
  } finally { await handle?.close() }
}

async function liveBaseline(origin, documentId) {
  const { workspace, query } = await openGraphConnection(origin)
  async function current() {
    const status = await query('graph.status', {})
    const matches = status.documents.filter(row => row.documentId === documentId)
    if (status.workspaceId !== workspace || matches.length !== 1) invalid('The selected workspace or accepted graph is unavailable.')
    return matches[0]
  }
  const before = await current()
  const selected = await query('graph.document', { documentId, revision: before.revision })
  const exported = exportGraphDocument(selected.document)
  const after = await current()
  if (selected.document.workspaceId !== workspace || selected.document.documentId !== documentId
    || exported.revision !== selected.revision || selected.revision !== before.revision || selected.revision !== after.revision
    || selected.document.sourceRevision !== before.sourceRevision || selected.document.sourceRevision !== after.sourceRevision) {
    invalid('The accepted graph changed or did not match the selected workspace and revision.')
  }
  return exported
}

async function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { process.stdout.write(help); return }
  const options = argumentsFor(args)
  const candidate = await readJson(options.candidate)
  const proposal = options.mode === 'inspect' ? await readJson(options.proposal) : null
  const baseline = options.origin ? await liveBaseline(options.origin, options.documentId) : await readJson(options.baseline)
  const result = options.mode === 'create'
    ? createCommandProposal({ baseline, candidate, expectedRevision: options.expectedRevision })
    : inspectCommandProposal({ baseline, candidate, proposal })
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
}

function graphRepair(error) {
  if (actionableCodes.has(error.code)) return error.message
  const fallback = 'Check the graph export and candidate schema.'
  if (error.code !== 'GRAPH_VALIDATION_FAILED') return fallback
  // Emit verified validator reason codes only. Dynamic object IDs, values,
  // paths and messages from the submitted graph never become CLI diagnostics.
  const codes = [...new Set(error.findings.filter(finding => isRelationalFinding(finding) && finding.severity === 'error')
    .map(finding => finding.code))].sort()
  const guidance = {
    GRAPH_ROOT_MISSING: 'Point each page and component root at an existing node.',
    NODE_CHILD_DUPLICATE: 'List each child only once in its parent.',
  }
  const reasons = codes.slice(0, 4).map(code => guidance[code] ? code + ' — ' + guidance[code] : code)
  const remainder = codes.length > 4 || error.omittedCount > 0 ? ' Additional findings were omitted.' : ''
  return [fallback, ...reasons].join(' ') + remainder
}

try { await main(process.argv.slice(2)) }
catch (error) {
  if (error instanceof UsageError) {
    process.stderr.write('Invalid arguments. Use --help for the supported commands.\n')
    process.exitCode = 2
  } else {
    let detail = 'Cannot read the requested input or local service.'
    if (error instanceof InputError || error instanceof GraphConnectionError) detail = error.message
    if (error instanceof GraphError && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code)) {
      detail = error.code + '. ' + graphRepair(error)
    }
    process.stderr.write(`Proposal review refused: ${detail}\n`)
    process.exitCode = 1
  }
}
