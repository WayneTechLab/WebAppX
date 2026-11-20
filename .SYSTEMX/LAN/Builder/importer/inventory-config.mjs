import { createHash } from 'node:crypto'
import { inspectBuildConfig, validBuildConfig } from './inventory-build-config.mjs'
import { inspectPackageConfig, validPackageConfig } from './inventory-package-config.mjs'

const vitePaths = ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts'].map(ext => 'vite.config.' + ext)
export const configurationInputPaths = Object.freeze(['package.json', '.node-version', '.nvmrc', 'firebase.json', ...vitePaths])
const providers = ['apphosting', 'auth', 'database', 'dataconnect', 'extensions', 'firestore', 'functions', 'hosting', 'remoteconfig', 'storage']
const emulators = ['apphosting', 'auth', 'database', 'dataconnect', 'eventarc', 'firestore', 'functions', 'hosting', 'pubsub', 'storage', 'tasks', 'ui']
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const exact = (value, fields) => object(value) && Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key))
const digest = value => typeof value === 'string' && /^[a-f\d]{64}$/.test(value)
const publicRoot = value => typeof value === 'string' && /^(?:(?:build|dist|web|site)\/)?(?:assets|build|dist|out|public|site|static|web|www)$/.test(value)

// JSON.parse accepts duplicate keys. A later declaration must not silently
// replace an earlier pin, proxy setting, or service. Check the bounded syntax
// tree as well as strict JSON syntax, without importing package code.
function manifest(input, ts, issue) {
  if (!input) return
  try {
    const data = JSON.parse(input.source)
    if (!object(data)) throw new Error()
    const tree = ts.parseJsonText(input.evidence.path, input.source)
    if (tree.parseDiagnostics.length) throw new Error()
    const pending = [tree.statements[0].expression]
    let count = 0
    while (pending.length) {
      const node = pending.pop()
      if (++count > 24_000) { issue('config-json-node-limit', input.evidence.path); return }
      if (ts.isObjectLiteralExpression(node)) {
        const names = new Set()
        for (const field of node.properties) {
          if (names.has(field.name.text)) { issue('duplicate-config-field', input.evidence.path); return }
          names.add(field.name.text)
          pending.push(field.initializer)
        }
      } else if (ts.isArrayLiteralExpression(node)) {
        for (const child of node.elements) pending.push(child)
      }
    }
    return data
  } catch {
    issue('invalid-configuration-json', input.evidence.path)
  }
}

function firebaseDeclarations(config, evidence, issue) {
  const rows = []
  if (!config) return rows
  const finding = code => issue(code, evidence.path)
  for (const service of providers) {
    if (!Object.hasOwn(config, service)) continue
    const declarations = Array.isArray(config[service]) ? config[service] : [config[service]]
    if (!declarations.length || declarations.length > 16 || !declarations.every(object)) {
      finding('unsupported-firebase-declaration'); continue
    }
    const row = { state: 'declared', kind: 'provider', service, observation: 'not-observed', evidence }
    if (service === 'hosting') {
      const roots = new Set()
      for (const item of declarations) {
        if (!Object.hasOwn(item, 'public')) continue
        if (publicRoot(item.public)) roots.add(item.public)
        else finding('unsupported-hosting-public-root')
      }
      row.publicRoots = [...roots].sort()
    }
    rows.push(row)
  }
  if (!Object.hasOwn(config, 'emulators')) return rows
  if (!object(config.emulators)) { finding('invalid-emulator-declarations'); return rows }
  for (const service of emulators) {
    if (!Object.hasOwn(config.emulators, service)) continue
    const item = config.emulators[service]
    if (!object(item)) { finding('invalid-emulator-declaration'); continue }
    const row = { state: 'declared', kind: 'emulator', service, observation: 'not-observed', evidence }
    if (Object.hasOwn(item, 'port')) {
      if (Number.isInteger(item.port) && item.port >= 1 && item.port <= 65535) row.port = item.port
      else finding('invalid-emulator-port')
    }
    if (Object.hasOwn(item, 'enabled')) {
      if (typeof item.enabled === 'boolean') row.enabled = item.enabled
      else finding('invalid-emulator-enabled')
    }
    if (Object.hasOwn(item, 'host')) {
      if (typeof item.host !== 'string' || !item.host.length) finding('invalid-emulator-host')
      else row.binding = ['127.0.0.1', 'localhost', '::1'].includes(item.host) ? 'loopback'
        : ['0.0.0.0', '::'].includes(item.host) ? 'wildcard' : 'other-declared-host'
    }
    rows.push(row)
  }
  if (Object.keys(config.emulators).some(key => key !== 'singleProjectMode' && !emulators.includes(key))) finding('unreviewed-emulator-kind')
  return rows
}

/**
 * hasTracked/read/evidenceFor are supplied by the bounded Git inventory. Only
 * the fixed root files above are requested. Caller retains responsibility for
 * exact-case, link, index, snapshot, and cumulative filesystem budget checks.
 */
export function inspectInventoryConfig({ ts, hasTracked, read, evidenceFor, issue }) {
  const inputs = new Map(), reported = new Set()
  function finding(code, path, line) {
    const id = JSON.stringify([code, path, line])
    if (!reported.has(id)) { reported.add(id); issue(code, path, line) }
  }
  for (const path of configurationInputPaths) {
    if (!hasTracked(path)) continue
    const source = read(path)
    const limit = path.startsWith('.') ? 256 : 256_000
    if (typeof source !== 'string' || source.length > limit || Buffer.byteLength(source) > limit) {
      finding('configuration-byte-limit', path); continue
    }
    const sha256 = evidenceFor ? evidenceFor(path)?.sha256 : createHash('sha256').update(source).digest('hex')
    if (!digest(sha256)) { finding('unverified-configuration-source', path); continue }
    inputs.set(path, { source, evidence: { path, sha256 } })
  }
  const pkg = manifest(inputs.get('package.json'), ts, finding)
  const packageFields = inspectPackageConfig({ ts, inputs, manifest: pkg, issue: finding })
  const configs = vitePaths.filter(path => hasTracked(path))
  let build = { buildTargets: [], bridges: [] }
  if (configs.length > 1) {
    for (const path of configs) finding('ambiguous-vite-config', path)
  } else if (inputs.has(configs[0])) {
    const path = configs[0]
    build = inspectBuildConfig({ ts, path, ...inputs.get(path), issue: finding })
  }
  const fb = inputs.get('firebase.json')
  return { ...packageFields, ...build, firebase: firebaseDeclarations(manifest(fb, ts, finding), fb?.evidence, finding) }
}

function validFirebase(rows, validEvidence) {
  if (!Array.isArray(rows) || rows.length > providers.length + emulators.length) return false
  const seen = new Set()
  return rows.every(row => {
    if (!object(row) || typeof row.kind !== 'string' || typeof row.service !== 'string' || row.state !== 'declared' || row.observation !== 'not-observed'
      || !validEvidence(row.evidence) || row.evidence.path !== 'firebase.json') return false
    const key = row.kind + ':' + row.service
    if (seen.has(key)) return false
    seen.add(key)
    const fields = ['state', 'kind', 'service', 'observation', 'evidence']
    if (row.kind === 'provider' && providers.includes(row.service)) {
      if (row.service !== 'hosting') return exact(row, fields)
      return exact(row, [...fields, 'publicRoots']) && Array.isArray(row.publicRoots)
        && row.publicRoots.length <= 16 && row.publicRoots.every(publicRoot)
    }
    if (row.kind !== 'emulator' || !emulators.includes(row.service)) return false
    if (Object.hasOwn(row, 'port')) {
      if (!Number.isInteger(row.port) || row.port < 1 || row.port > 65535) return false
      fields.push('port')
    }
    if (Object.hasOwn(row, 'binding')) {
      if (!['loopback', 'wildcard', 'other-declared-host'].includes(row.binding)) return false
      fields.push('binding')
    }
    if (Object.hasOwn(row, 'enabled')) {
      if (typeof row.enabled !== 'boolean') return false
      fields.push('enabled')
    }
    return exact(row, fields)
  })
}

export function validInventoryConfig(config, evidence) {
  if (!exact(config, ['dependencies', 'runtimePins', 'buildTargets', 'bridges', 'firebase']) || !Array.isArray(evidence)) return false
  const revisions = new Map(evidence.filter(row => object(row) && configurationInputPaths.includes(row.path)).map(row => [row.path, row.sha256]))
  const validEvidence = ref => exact(ref, ['path', 'sha256']) && digest(ref.sha256) && revisions.get(ref.path) === ref.sha256
  return validPackageConfig(config.dependencies, config.runtimePins, validEvidence)
    && validBuildConfig(config.buildTargets, config.bridges, validEvidence) && validFirebase(config.firebase, validEvidence)
}
