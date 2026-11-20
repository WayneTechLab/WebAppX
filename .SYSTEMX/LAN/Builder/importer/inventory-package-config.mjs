const dependencyGroups = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
const toolNames = ['node', 'npm', 'pnpm', 'yarn', 'bun']
const packageLimit = 256
const exactVersion = /^(?:0|[1-9]\d{0,7})(?:\.(?:0|[1-9]\d{0,7})){2}(?:-(?:alpha|beta|rc|next|dev|canary|preview)(?:\.\d{1,8})*)?$/
const privateMarker = /private|secret|credential|password|api[._-]?key|access[._-]?token|(?:^|[^a-z])(?:tokens?|keys?)(?:[^a-z]|$)|npm_[A-Za-z0-9]{20}|gh[pousr]_|github_pat_|sk_live_|AKIA[0-9A-Z]/i
const plain = object => object !== null && typeof object === 'object' && !Array.isArray(object)
const keys = (obj, names) => plain(obj) && Object.keys(obj).length === names.length && names.every(key => Object.hasOwn(obj, key))

function safeName(name) {
  return typeof name === 'string' && name.length <= 214 && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)
    && !privateMarker.test(name)
}

// Restrict public ranges to numeric npm selectors and known prerelease labels.
// URLs, local links, aliases, arbitrary tags and build metadata can carry
// private registry locations or credentials and are never copied to a report.
const versionComponent = '(?:0|[1-9]\\d{0,7}|[Xx*])'
const versionSelector = 'v?' + versionComponent + '(?:\\.' + versionComponent + '){0,2}(?:-(?:alpha|beta|rc|next|dev|canary|preview)(?:\\.\\d{1,8})*)?'
const selector = new RegExp('^' + versionSelector + '$')
const comparator = new RegExp('^(?:>=|<=|>|<|=|~|\\^)?' + versionSelector + '$')
function safeRange(value) {
  if (typeof value !== 'string' || !value.length || value.length > 96 || value.trim() !== value || /[\r\n\t]/.test(value)) return false
  return value.split('||').every(group => {
    const clause = group.trim()
    const interval = clause.split(' - ')
    if (interval.length > 1) return interval.length === 2 && interval.every(part => selector.test(part))
    return clause.replace(/(>=|<=|[><=~^]) +/g, '$1').split(/ +/).every(part => comparator.test(part))
  })
}

export function inspectPackageConfig({ ts, manifest, inputs, issue }) {
  const dependencies = [], runtimePins = []
  const evidence = inputs.get('package.json')?.evidence
  const range = value => safeRange(value) && ts.VersionRange.tryParse(value) !== undefined
  const addPin = (tool, field, value, sourceEvidence) => {
    const canonical = typeof value === 'string' ? value.replace(/^v(?=\d)/, '') : null
    if (!range(canonical)) { issue('unsupported-runtime-declaration', sourceEvidence.path); return }
    runtimePins.push({ state: 'declared', tool, field, value: canonical, evidence: sourceEvidence })
  }
  if (manifest) {
    for (const group of dependencyGroups) {
      if (!Object.hasOwn(manifest, group)) continue
      const declaration = manifest[group]
      if (!plain(declaration)) { issue('invalid-dependency-section', 'package.json'); continue }
      const names = Object.keys(declaration).sort()
      if (names.length + dependencies.length > packageLimit) { issue('dependency-declaration-limit', 'package.json'); continue }
      for (const name of names) {
        const value = declaration[name]
        if (!safeName(name) || !range(value)) { issue('unsupported-dependency-declaration', 'package.json'); continue }
        dependencies.push({ state: 'declared', group, name, range: value, evidence })
      }
    }
    for (const field of ['engines', 'volta']) {
      if (!Object.hasOwn(manifest, field)) continue
      if (!plain(manifest[field])) { issue('invalid-runtime-section', 'package.json'); continue }
      for (const tool of toolNames) {
        if (Object.hasOwn(manifest[field], tool)) addPin(tool, field, manifest[field][tool], evidence)
      }
      if (field === 'volta' && Object.hasOwn(manifest.volta, 'extends')) issue('unresolved-runtime-inheritance', 'package.json')
    }
    if (Object.hasOwn(manifest, 'packageManager')) {
      // Corepack optionally appends an integrity hash. It is not a version.
      const manager = typeof manifest.packageManager === 'string' && manifest.packageManager.length <= 200
        && /^(npm|pnpm|yarn|bun)@([^+]+)(?:\+sha(?:224|256|384|512)\.[a-f\d]{32,128})?$/.exec(manifest.packageManager)
      if (manager && exactVersion.test(manager[2])) addPin(manager[1], 'packageManager', manager[2], evidence)
      else issue('unsupported-package-manager-pin', 'package.json')
    }
  }
  for (const path of ['.node-version', '.nvmrc']) {
    const input = inputs.get(path)
    if (input) addPin('node', 'version-file', input.source.trim(), input.evidence)
  }

  for (const tool of toolNames) {
    const rows = runtimePins.filter(row => row.tool === tool)
    for (const pin of rows.filter(row => row.field !== 'engines' && exactVersion.test(row.value))) {
      const version = new ts.Version(pin.value)
      for (const other of rows) {
        if (other !== pin && !ts.VersionRange.tryParse(other.value).test(version)) {
          issue(other.field === 'engines' ? 'runtime-pin-outside-engine' : 'conflicting-runtime-pins', pin.evidence.path)
        }
      }
    }
    // Complex ranges can overlap. Do not invent a conflict or silently choose
    // one when independent selectors have no exact pin to compare against.
    if (new Set(rows.map(row => row.value)).size > 1 && rows.every(row => !exactVersion.test(row.value))) {
      issue('runtime-selector-comparison-unresolved', rows[0].evidence.path)
    }
  }
  return { dependencies, runtimePins }
}

export function validPackageConfig(dependencies, runtimePins, validEvidence) {
  if (!Array.isArray(dependencies) || dependencies.length > packageLimit || !Array.isArray(runtimePins) || runtimePins.length > 13) return false
  const validDependency = row => keys(row, ['state', 'group', 'name', 'range', 'evidence'])
    && row.state === 'declared' && dependencyGroups.includes(row.group) && safeName(row.name) && safeRange(row.range)
    && validEvidence(row.evidence) && row.evidence.path === 'package.json'
  const validPin = row => {
    if (!keys(row, ['state', 'tool', 'field', 'value', 'evidence']) || row.state !== 'declared' || !toolNames.includes(row.tool)
        || !safeRange(row.value) || !validEvidence(row.evidence)) return false
    if (row.field === 'version-file') return row.tool === 'node' && ['.node-version', '.nvmrc'].includes(row.evidence.path)
    if (row.evidence.path !== 'package.json') return false
    if (row.field === 'packageManager') return row.tool !== 'node' && exactVersion.test(row.value)
    return row.field === 'engines' || row.field === 'volta'
  }
  return dependencies.every(validDependency) && runtimePins.every(validPin)
}
