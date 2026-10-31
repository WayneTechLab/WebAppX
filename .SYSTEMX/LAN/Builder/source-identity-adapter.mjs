import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { createIdentityMap } from './identity-core.mjs'

// The compiler parses syntax only. No imported module, JSX expression, or
// component is evaluated or resolved while building this source read model.
const require = createRequire(import.meta.url)
const ts = require('typescript')
const adapter = Object.freeze({ id: 'tsx-static-v1', version: 1, supportedOperations: ['literal'], unsupportedOperations: ['style', 'structure', 'generated'] })
const tsxPath = /^(?:src\/pages\/[A-Za-z0-9][A-Za-z0-9._-]*\.tsx|src\/components\/(?:layout|navigation|shell)\/[A-Za-z0-9][A-Za-z0-9._-]*\.tsx|src\/router\.tsx)$/
const anchorSyntax = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/
const revisionSyntax = /^[a-f0-9]{64}$/
const identityProps = new Set(['id', 'name', 'role', 'type', 'href', 'to', 'key', 'aria-label', 'data-snap-label', 'data-testid', 'alt', 'title'])
const maxNodes = 1_000
const maxDiagnostics = 1_000

function fail(code, message) {
  const error = new Error(message)
  error.code = code
  throw error
}

function sha(value) { return createHash('sha256').update(value).digest('hex') }
function digest(value) { return sha(JSON.stringify(value)) }
function normalizedText(value) { return value.replace(/\p{Cc}/gu, ' ').replace(/\s+/gu, ' ').trim() }
function shortLabel(value) {
  const normalized = normalizedText(value)
  let result = normalized.slice(0, 120)
  if (/[\uD800-\uDBFF]$/.test(result)) result = result.slice(0, -1)
  return result
}

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('SOURCE_IDENTITY_INPUT_INVALID', 'Source identity input must be an object.')
  const own = (key, fallback) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)
    if (!descriptor) return fallback
    if (!Object.hasOwn(descriptor, 'value')) fail('SOURCE_IDENTITY_INPUT_INVALID', 'Source identity input must use data properties.')
    return descriptor.value
  }
  const path = own('path'), content = own('content'), sourceRevision = own('sourceRevision')
  const workspaceId = own('workspaceId'), route = own('route', '/'), label = own('label', '')
  if (typeof path !== 'string' || !tsxPath.test(path) || path.length > 512) fail('SOURCE_IDENTITY_PATH_INVALID', 'Select a direct eligible TSX source path.')
  if (typeof content !== 'string' || content.includes('\0') || content.length > 500_000) {
    fail('SOURCE_IDENTITY_SOURCE_LIMIT', 'TSX source exceeds the supported text or byte limit.')
  }
  const bytes = Buffer.from(content, 'utf8')
  if (bytes.length > 1_000_000) fail('SOURCE_IDENTITY_SOURCE_LIMIT', 'TSX source exceeds the supported text or byte limit.')
  if (bytes.toString('utf8') !== content) fail('SOURCE_IDENTITY_ENCODING_INVALID', 'TSX source must be exact valid UTF-8 text.')
  if (typeof sourceRevision !== 'string' || !revisionSyntax.test(sourceRevision) || sha(content) !== sourceRevision) {
    fail('SOURCE_IDENTITY_REVISION_INVALID', 'Source revision must match the exact UTF-8 source bytes.')
  }
  if (typeof workspaceId !== 'string' || !revisionSyntax.test(workspaceId)) fail('SOURCE_IDENTITY_WORKSPACE_INVALID', 'Workspace identity is invalid.')
  if (typeof route !== 'string' || route.length > 512 || !route.startsWith('/') || /[\p{Cc}\\]/u.test(route)) {
    fail('SOURCE_IDENTITY_ROUTE_INVALID', 'Route context is invalid.')
  }
  if (typeof label !== 'string' || label.length > 120 || /\p{Cc}/u.test(label)) fail('SOURCE_IDENTITY_LABEL_INVALID', 'Document label is invalid.')
  return { path, content, sourceRevision, workspaceId, route, label }
}

function definitionAt(node, previous) {
  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) return node.name?.text || previous
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text
  if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) return previous === '<module>' ? node.name.text : previous
  return previous
}

function literalAttributes(opening, sourceFile) {
  const values = new Map()
  const evidence = []
  let anchor = null
  let expressionAttribute = false
  for (const attribute of opening.attributes.properties) {
    if (ts.isJsxSpreadAttribute(attribute)) { expressionAttribute = true; continue }
    const name = attribute.name.getText(sourceFile)
    const initializer = attribute.initializer
    if (name === 'data-systemx-id') {
      anchor = initializer.text
    }
    if (initializer && ts.isStringLiteral(initializer)) {
      values.set(name, initializer.text)
      if (identityProps.has(name)) evidence.push([name, sha(initializer.text)])
    } else if (initializer && ts.isJsxExpression(initializer)) {
      expressionAttribute = true
    }
  }
  evidence.sort(([left], [right]) => left.localeCompare(right))
  return { values, evidence, anchor, expressionAttribute }
}

function sourceSpan(content, sourceRevision, path, start, end) {
  return { path, start, end, sourceRevision, fingerprint: sha(content.slice(start, end)) }
}

/**
 * A compiler AST is used only to identify authored, direct JSX. JSX nested in
 * an expression or an external component remains opaque: one syntax occurrence
 * cannot safely stand for an unknown number of rendered instances.
 */
export function parseSourceIdentity(input) {
  const { path, content, sourceRevision, workspaceId, route, label } = validateInput(input)
  let sourceFile
  try { sourceFile = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) }
  catch { fail('SOURCE_IDENTITY_TSX_SYNTAX', 'TSX source could not be parsed safely.') }
  if (sourceFile.parseDiagnostics.length) fail('SOURCE_IDENTITY_TSX_SYNTAX', 'TSX source contains syntax errors.')

  const diagnostics = []
  const addDiagnostic = (code, start, end) => {
    if (diagnostics.length < maxDiagnostics) diagnostics.push({ code, start, end })
  }
  const anchors = new Set()
  const rootsByDefinition = new Map()
  let candidateCount = 0

  // Include JSX hidden behind expressions and component boundaries in the
  // uniqueness check, even though those objects are not imported as nodes.
  function checkAnchors(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      let seenOnElement = false
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || attribute.name.getText(sourceFile) !== 'data-systemx-id') continue
        const initializer = attribute.initializer
        if (seenOnElement || !initializer || !ts.isStringLiteral(initializer) || !anchorSyntax.test(initializer.text)) {
          fail('SOURCE_IDENTITY_ANCHOR_INVALID', 'Authored source identity must be one static valid string per element.')
        }
        seenOnElement = true
        if (anchors.has(initializer.text)) fail('SOURCE_IDENTITY_ANCHOR_DUPLICATE', 'Authored source identity is duplicated in this document.')
        anchors.add(initializer.text)
      }
    }
    ts.forEachChild(node, checkAnchors)
  }
  try { checkAnchors(sourceFile) }
  catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('SOURCE_IDENTITY_')) throw error
    fail('SOURCE_IDENTITY_TSX_SYNTAX', 'TSX source could not be traversed safely.')
  }

  function parseChildren(children, definition) {
    const records = []
    for (const child of children) {
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) {
        records.push(...parseJsx(child, definition))
      }
    }
    return records
  }

  function parseJsx(node, definition) {
    if (ts.isJsxFragment(node)) return parseChildren(node.children, definition)
    candidateCount += 1
    if (candidateCount > maxNodes) fail('SOURCE_IDENTITY_NODE_LIMIT', 'TSX document exceeds the node limit.')
    const opening = ts.isJsxElement(node) ? node.openingElement : node
    const tag = opening.tagName.getText(sourceFile)
    if (tag.length > 120) fail('SOURCE_IDENTITY_TAG_INVALID', 'JSX tag exceeds the supported length.')
    const external = !/^[a-z][A-Za-z0-9_-]*$/.test(tag)
    const { values, evidence, anchor, expressionAttribute } = literalAttributes(opening, sourceFile)
    const children = ts.isJsxElement(node) ? node.children : []
    const expressionChild = children.some(child => ts.isJsxExpression(child))
    const opaque = external || expressionAttribute || expressionChild
    const start = node.getStart(sourceFile)
    const end = node.end
    if (opaque) addDiagnostic(external ? 'SOURCE_COMPONENT_EXTERNAL' : 'SOURCE_EXPRESSION_OPAQUE', start, end)
    const directText = children.filter(child => ts.isJsxText(child))
    const textEvidence = normalizedText(directText.map(child => content.slice(child.pos, child.end)).join(' '))
    const scalarText = !opaque && children.length === 1 && directText.length === 1 && textEvidence
      ? directText[0] : null
    const fields = scalarText ? { text: {
      start: scalarText.pos, end: scalarText.end,
      fingerprint: sha(content.slice(scalarText.pos, scalarText.end)),
    } } : {}
    const preferredLabel = textEvidence || values.get('aria-label') || values.get('data-snap-label') || values.get('title') || values.get('alt') || tag
    const record = {
      tag, anchor, label: shortLabel(preferredLabel), source: sourceSpan(content, sourceRevision, path, start, end), fields,
      opaque, external, definition: { name: definition, sourcePath: path },
      evidence, textDigest: textEvidence ? sha(textEvidence) : null,
      children: external ? [] : parseChildren(children, definition),
    }
    return [record]
  }

  function visit(node, definition) {
    const owner = definitionAt(node, definition)
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      const roots = rootsByDefinition.get(owner) ?? []
      roots.push(...parseJsx(node, owner))
      rootsByDefinition.set(owner, roots)
      return
    }
    ts.forEachChild(node, child => visit(child, owner))
  }
  try { visit(sourceFile, '<module>') }
  catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('SOURCE_IDENTITY_')) throw error
    fail('SOURCE_IDENTITY_TSX_SYNTAX', 'TSX source could not be traversed safely.')
  }

  function calculateEvidence(record) {
    record.children.forEach(calculateEvidence)
    record.ownDigest = digest({ tag: record.tag, anchor: record.anchor, props: record.evidence, text: record.textDigest, opaque: record.opaque, external: record.external })
    record.subtreeDigest = digest({ own: record.ownDigest, children: record.children.map(child => child.subtreeDigest).sort() })
  }
  const candidates = []
  function assignSiblings(siblings, parentKey, parentSignature) {
    const ownCounts = new Map(), subtreeCounts = new Map()
    for (const record of siblings) {
      ownCounts.set(record.ownDigest, (ownCounts.get(record.ownDigest) ?? 0) + 1)
      subtreeCounts.set(record.subtreeDigest, (subtreeCounts.get(record.subtreeDigest) ?? 0) + 1)
    }
    for (const record of siblings) {
      const discriminator = ownCounts.get(record.ownDigest) === 1 || subtreeCounts.get(record.subtreeDigest) !== 1
        ? record.ownDigest : record.subtreeDigest
      const signature = digest({ parent: parentSignature, discriminator })
      const key = `node_${candidates.length + 1}`
      candidates.push({
        key, parentKey, tag: record.tag, anchor: record.anchor, signature, label: record.label,
        source: record.source, fields: record.fields, opaque: record.opaque, external: record.external,
        definition: record.definition,
      })
      assignSiblings(record.children, key, signature)
    }
  }
  for (const [definition, roots] of rootsByDefinition) {
    roots.forEach(calculateEvidence)
    assignSiblings(roots, null, digest({ definition }))
  }
  const map = createIdentityMap({ workspaceId, sourcePath: path, sourceRevision, route, label, nodes: candidates })
  return { map, adapter: { ...adapter, supportedOperations: [...adapter.supportedOperations], unsupportedOperations: [...adapter.unsupportedOperations] }, diagnostics,
    shared: /^src\/components\/(?:layout|navigation|shell)\//.test(path) }
}
