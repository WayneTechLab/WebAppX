#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { lstat, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertPublicData, parsePublicJson, readPublicText } from './package-script-discovery.mjs'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const docCommandLimits = Object.freeze({ documents: 500, characters: 10_000_000, references: 20_000, contexts: 300 })
export const documentationScope = Object.freeze(['README.md', 'docs/**/*.md', 'wiki/**/*.md', '.SYSTEMX/Template/starter/README.md'])
const contextsAllowed = ['root', 'starter', 'functions']
const prefixContexts = new Map([['.', 'root'], ['./', 'root'], ['.SYSTEMX/Template/starter', 'starter'], ['./.SYSTEMX/Template/starter', 'starter'], ['integrations/gusto/functions', 'functions'], ['./integrations/gusto/functions', 'functions']])
const resolveContext = (prefix, inherited) => ['.', './'].includes(prefix) ? inherited : inherited === 'root' ? prefixContexts.get(prefix) ?? null : null
const scriptName = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,99}$/
// LF-normalized text keeps exact reviewed context portable across CRLF checkouts.
const sha = value => createHash('sha256').update(value.replace(/\r\n/g, '\n')).digest('hex')
const hasControl = value => [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
const invalid = () => { throw new Error('Invalid or oversized documentation command inputs. Inspect the public context schema.') }
const safePath = path => typeof path === 'string' && path.length <= 240 && /^(?:README\.md|docs\/[A-Za-z0-9_./ -]+\.md|wiki\/[A-Za-z0-9_./ -]+\.md|\.SYSTEMX\/Template\/starter\/README\.md)$/.test(path) && !path.split('/').some(part => ['.', '..', ''].includes(part))
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
const exact = (value, fields) => plain(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field))

function codeSegments(text) {
  const output = []; let offset = 0, fence = null, block = null, paragraph = null
  function flushInline() {
    if (!paragraph) return
    const source = paragraph.text, runs = [], nextByLength = new Map()
    for (let cursor = 0; cursor < source.length;) {
      if (source[cursor] !== '`') { cursor++; continue }
      const start = cursor; while (source[cursor] === '`') cursor++
      runs.push({ start, end: cursor, length: cursor - start })
    }
    // Index matching runs once so unmatched delimiters cannot cause repeated
    // scans of the remaining public document.
    for (let index = runs.length - 1; index >= 0; index--) {
      runs[index].next = nextByLength.get(runs[index].length)
      nextByLength.set(runs[index].length, index)
    }
    for (let runIndex = 0; runIndex < runs.length;) {
      const open = runs[runIndex], closeIndex = open.next
      if (closeIndex === undefined) { runIndex++; continue }
      const close = runs[closeIndex].start
      let content = ''; const origins = []
      for (let index = open.end; index < close; index++) {
        const character = source[index]
        origins.push(paragraph.offset + index)
        content += /[\r\n]/.test(character) ? ' ' : character
        if (character === '\r' && source[index + 1] === '\n') index++
      }
      // CommonMark normalizes code-span line endings and removes one paired
      // surrounding space unless the entire span consists of spaces.
      if (content.startsWith(' ') && content.endsWith(' ') && /[^ ]/.test(content)) {
        content = content.slice(1, -1); origins.shift(); origins.pop()
      }
      output.push({ text: content, origins }); runIndex = closeIndex + 1
    }
    paragraph = null
  }
  for (const line of text.match(/[^\n]*(?:\n|$)/g).filter(Boolean)) {
    const marker = /^ {0,3}(`{3,}|~{3,})[^\n]*\r?\n?$/.exec(line)
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*\r?\n?$/.exec(line)
      if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) { output.push(block); fence = null; block = null }
      else block.text += line
    } else if (marker) { flushInline(); fence = { character: marker[1][0], length: marker[1].length }; block = { text: '', offset: offset + line.length } }
    else if (/^[ \t\r\n]*$/.test(line)) flushInline()
    else if (paragraph) paragraph.text += line
    else paragraph = { text: line, offset }
    offset += line.length
  }
  flushInline()
  if (block) output.push(block)
  return output
}

/** A token reader, not a shell evaluator. Expansions stay inert data. */
function tokens(text) {
  const output = []; let index = 0
  while (index < text.length) {
    if (output.length > 100_000) invalid()
    if (text[index] === '\\' && /[\r\n]/.test(text[index + 1] ?? '')) { index += text[index + 1] === '\r' && text[index + 2] === '\n' ? 3 : 2; continue }
    if (/[ \t\r]/.test(text[index])) { index++; continue }
    if (text[index] === '#') { while (index < text.length && text[index] !== '\n') index++; continue }
    if (/[\n;|&]/.test(text[index])) { output.push({ value: null, start: index, end: ++index }); continue }
    const start = index; let value = '', quote = null
    while (index < text.length) {
      const character = text[index]
      if (!quote && /[ \t\r\n;|&]/.test(character)) break
      if (character === quote) { quote = null; index++; continue }
      if (!quote && ['"', "'"].includes(character)) { quote = character; index++; continue }
      if (character === '\\' && text[index + 1] !== undefined && quote !== "'") { value += text[index + 1]; index += 2; continue }
      value += character; index++
    }
    output.push({ value, start, end: index, incomplete: quote !== null })
  }
  return output
}

const flagValues = new Set(['--loglevel', '--color', '--userconfig', '--cache', '--registry'])
function npmReference(command, inheritedContext) {
  let context = inheritedContext, badOptions = false, index = 1, verb
  const options = () => {
    while (index < command.length && command[index].value?.startsWith('-') && command[index].value !== '--') {
      const option = command[index++].value
      if (option === '--prefix' || option === '-C') {
        context = resolveContext(command[index++]?.value, context)
      } else if (option.startsWith('--prefix=')) context = resolveContext(option.slice(9), context)
      else if (/^(?:--workspace(?:=|$)|-w$)/.test(option)) { context = null; if (!option.includes('=')) index++ }
      else if (flagValues.has(option)) index++
      else if (!/^(?:--(?:silent|if-present|ignore-scripts|foreground-scripts|no-audit|no-fund|json|parseable|version|help)|-[svh]|--loglevel=\w+|--color=\w+)$/.test(option)) badOptions = true
    }
  }
  options(); verb = command[index++]?.value
  if (!verb) return { kind: 'ordinary', script: null, context }
  if (!['run', 'run-script', 'test', 't', 'tst', 'start', 'stop', 'restart'].includes(verb)) return { kind: 'ordinary', script: null, context }
  let name
  if (['run', 'run-script'].includes(verb)) { options(); name = command[index++]?.value }
  else name = ['t', 'tst'].includes(verb) ? 'test' : verb
  // npm options may follow the script until its argument separator.
  while (index < command.length && command[index].value !== '--') {
    if (command[index].value?.startsWith('-')) options()
    else index++
  }
  if (!name) return { kind: 'ordinary', script: null, context }
  if (/^<[^<>\r\n]{1,80}>$/.test(name)) return { kind: 'placeholder', script: null, context }
  return { kind: 'script', script: typeof name === 'string' && scriptName.test(name) ? name : null, context, invalid: badOptions || command.some(token => token.incomplete) || !scriptName.test(name) }
}

export function scanMarkdownCommands({ path, text, defaultContext = 'root' }) {
  if (!safePath(path) || typeof text !== 'string' || text.length > 2_000_000 || !contextsAllowed.includes(defaultContext)) invalid()
  const lines = [0]; for (let index = 0; index < text.length; index++) if (text[index] === '\n') lines.push(index + 1)
  const location = offset => { let low = 0, high = lines.length; while (low + 1 < high) { const middle = (low + high) >> 1; if (lines[middle] <= offset) low = middle; else high = middle } return { line: low + 1, column: offset - lines[low] + 1 } }
  const references = [], documentSha256 = sha(text)
  for (const segment of codeSegments(text)) {
    const parsed = tokens(segment.text); let context = defaultContext
    for (let index = 0; index < parsed.length; index++) {
      const token = parsed[index]
      if (token.value === 'cd' && (index === 0 || parsed[index - 1].value === null)) context = resolveContext(parsed[index + 1]?.value, context)
      if (!['npm', 'npm.cmd'].includes(token.value)) continue
      let end = index + 1; while (end < parsed.length && parsed[end].value !== null) end++
      const command = parsed.slice(index, end), source = segment.text.slice(token.start, command.at(-1).end)
      references.push({ path, ...location(segment.origins?.[token.start] ?? segment.offset + token.start), ...npmReference(command, context), commandSha256: sha(source), documentSha256 })
      if (references.length > docCommandLimits.references) invalid()
      index = end - 1
    }
  }
  return references
}

export function buildDocCommandReport({ documents, manifests, contexts = [] }) {
  assertPublicData(documents, docCommandLimits.characters); assertPublicData(manifests); assertPublicData(contexts)
  if (!Array.isArray(documents) || documents.length > docCommandLimits.documents || documents.reduce((sum, document) => sum + (document.text?.length ?? 0), 0) > docCommandLimits.characters || !Array.isArray(contexts) || contexts.length > docCommandLimits.contexts || !plain(manifests) || !contextsAllowed.every(context => plain(manifests[context]?.scripts))) invalid()
  for (const context of contextsAllowed) {
    const entries = Object.entries(manifests[context].scripts)
    if (entries.length > 500 || entries.some(([name, value]) => !scriptName.test(name) || typeof value !== 'string' || !value.trim() || value.length > 50_000 || hasControl(value))) invalid()
  }
  const identity = row => `${row.path}:${row.line}:${row.column}:${row.commandSha256}:${row.documentSha256}`
  const overrides = new Map(), used = new Set(), documentPaths = new Set()
  // sourceRevision names the reviewed source basis, not a claim that a current
  // working-tree line existed at that commit. Both text hashes bind this review.
  for (const row of contexts) {
    if (!exact(row, ['path', 'line', 'column', 'script', 'commandSha256', 'documentSha256', 'context', 'reason', 'sourceRevision']) || !safePath(row.path) || !Number.isSafeInteger(row.line) || row.line < 1 || !Number.isSafeInteger(row.column) || row.column < 1 || typeof row.script !== 'string' || !scriptName.test(row.script) || !/^[a-f0-9]{64}$/.test(row.commandSha256) || !/^[a-f0-9]{64}$/.test(row.documentSha256) || ![...contextsAllowed, 'historical', 'placeholder'].includes(row.context) || typeof row.reason !== 'string' || !row.reason.trim() || row.reason.length > 500 || hasControl(row.reason) || !(row.sourceRevision === null && row.context !== 'historical' || typeof row.sourceRevision === 'string' && /^[a-f0-9]{40}$/.test(row.sourceRevision)) || overrides.has(identity(row))) invalid()
    overrides.set(identity(row), row)
  }
  const references = [], errors = []
  for (const document of documents) {
    if (!exact(document, ['path', 'text', 'defaultContext']) || typeof document.path !== 'string' || documentPaths.has(document.path.toLowerCase())) invalid()
    documentPaths.add(document.path.toLowerCase())
    for (const reference of scanMarkdownCommands(document)) {
      const override = overrides.get(identity(reference))
      let context = reference.context
      if (override && override.script === reference.script) { context = override.context; used.add(identity(reference)) }
      const { invalid: unsupported, ...safe } = reference
      const result = { ...safe, context, ...(context === 'placeholder' ? { kind: 'placeholder' } : {}) }
      references.push(result)
      if (reference.kind !== 'script') continue
      const reason = unsupported ? 'unsupported-command-form' : !context ? 'unresolved-package-context' : ['historical', 'placeholder'].includes(context) ? null : !Object.hasOwn(manifests[context].scripts, reference.script) ? 'unknown-npm-script' : null
      if (reason) errors.push({ path: reference.path, line: reference.line, column: reference.column, script: reference.script, context, reason })
    }
  }
  if (references.length > docCommandLimits.references) invalid()
  for (const [key, row] of overrides) if (!used.has(key)) errors.push({ path: row.path, line: row.line, column: row.column, script: row.script, context: row.context, reason: 'stale-context-record' })
  return { schemaVersion: 1, ok: !errors.length, documentCount: documents.length, referenceCount: references.length, references, errors, scope: [...documentationScope], limitation: 'Public Markdown and reviewed manifests only. Examples are parsed as data; no command, environment expansion or shell was executed.' }
}

async function maintainedDocuments(root) {
  const paths = ['README.md', '.SYSTEMX/Template/starter/README.md'], folded = new Set(paths.map(path => path.toLowerCase()))
  async function walk(relative) {
    const directory = await lstat(resolve(root, relative))
    if (!directory.isDirectory() || directory.isSymbolicLink()) invalid()
    for (const entry of (await readdir(resolve(root, relative), { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1)) {
      if (entry.isSymbolicLink()) continue
      const path = `${relative}/${entry.name}`
      if (entry.isDirectory()) { if (!['node_modules', '.git', 'local', 'logs', 'state', 'vendor'].includes(entry.name)) await walk(path) }
      else if (entry.isFile() && /\.md$/i.test(entry.name)) {
        if (!safePath(path) || folded.has(path.toLowerCase())) invalid()
        folded.add(path.toLowerCase()); paths.push(path)
        if (paths.length > docCommandLimits.documents) invalid()
      }
    }
  }
  await walk('docs'); await walk('wiki')
  const documents = []; let characters = 0
  for (const path of paths.sort()) {
    const text = await readPublicText(root, path)
    characters += text.length
    if (characters > docCommandLimits.characters) invalid()
    documents.push({ path, text, defaultContext: path === '.SYSTEMX/Template/starter/README.md' ? 'starter' : 'root' })
  }
  return documents
}

export async function checkDocumentationCommands(root = repository) {
  const [documents, rootManifest, starter, functions, contextText] = await Promise.all([
    maintainedDocuments(root), readPublicText(root, 'package.json'), readPublicText(root, '.SYSTEMX/Template/starter/package.json'), readPublicText(root, 'integrations/gusto/functions/package.json'), readPublicText(root, 'scripts/doc-command-contexts.json'),
  ])
  const metadata = parsePublicJson(contextText)
  if (!exact(metadata, ['schemaVersion', 'contexts']) || metadata.schemaVersion !== 1) invalid()
  return buildDocCommandReport({ documents, manifests: { root: parsePublicJson(rootManifest), starter: parsePublicJson(starter), functions: parsePublicJson(functions) }, contexts: metadata.contexts })
}

export async function runDocCommandsCli(args = process.argv.slice(2), { root = repository, stdout = process.stdout, stderr = process.stderr } = {}) {
  if (args.length > 1 || args.some(arg => arg !== '--json')) { stderr.write('Usage: node scripts/check-doc-commands.mjs [--json]\n'); return 2 }
  try {
    const report = await checkDocumentationCommands(root)
    if (args.includes('--json')) stdout.write(JSON.stringify(report, null, 2) + '\n')
    else {
      stdout.write(`Documentation npm commands: ${report.documentCount} maintained files, ${report.referenceCount} examples; ${report.ok ? 'passed' : 'review required'}.\n`)
      for (const row of report.errors) stdout.write(`${row.path}:${row.line}:${row.column}: ${row.reason}${row.script ? ` (${row.script})` : ''}.\n`)
      stdout.write(report.limitation + '\n')
    }
    return report.ok ? 0 : 1
  } catch { stderr.write('Documentation command check unavailable: invalid or unreadable public inputs.\n'); return 1 }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await runDocCommandsCli()
