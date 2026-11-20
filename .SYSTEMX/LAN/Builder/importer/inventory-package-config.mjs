const dependencyGroups = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
const toolNames = ['node', 'npm', 'pnpm', 'yarn', 'bun']
const packageLimit = 256
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
const versionNumber = '(?:0|[1-9]\\d{0,7})'
const prerelease = '(?:-(?:alpha|beta|rc|next|dev|canary|preview)(?:\\.' + versionNumber + ')*)?'
const exactVersion = new RegExp('^' + versionNumber + '(?:\\.' + versionNumber + '){2}' + prerelease + '$')
const versionComponent = '(?:' + versionNumber + '|[Xx*])'
const versionSelector = 'v?' + versionComponent + '(?:\\.' + versionComponent + '){0,2}' + prerelease
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

// npm admits a prerelease only in an alternative that names a prerelease of
// that same major.minor.patch. Limit this proof to fully specified comparators;
// TypeScript alone also admits prereleases behind some wildcard boundaries.
function admitsPrerelease(ts, selector, version) {
  const prefix = version.split('-')[0] + '-'
  return selector.split('||').some(alternative => {
    const clause = alternative.trim()
    const versions = clause.split(/ +/).map(part => part.replace(/^[<>=]+/, ''))
    return versions.every(part => exactVersion.test(part)) && versions.some(part => part.startsWith(prefix))
      && ts.VersionRange.tryParse(clause).test(version)
  })
}

function checkRuntimeSelectors(ts, rows, issue) {
  if (!rows.length) return
  const declarations = rows.map(row => ({ ...row, range: ts.VersionRange.tryParse(row.value), exact: exactVersion.test(row.value) }))
  if (declarations.some(row => row.exact)) {
    for (const [index, left] of declarations.entries()) {
      for (const right of declarations.slice(index + 1)) {
        if ((!left.exact && !right.exact) || left.value === right.value) continue
        const pin = left.exact ? left : right
        const other = left.exact ? right : left
        const hasEngine = left.field === 'engines' || right.field === 'engines'
        const path = (left.field === 'engines' ? right : left).evidence.path
        if (!other.range.test(pin.value)) {
          issue(hasEngine ? 'runtime-pin-outside-engine' : 'conflicting-runtime-pins', path)
        } else if (pin.value.includes('-') && !admitsPrerelease(ts, other.value, pin.value)) {
          issue('runtime-selector-comparison-unresolved', path)
        }
      }
    }
    return
  }
  // A shared version proves overlap across every selector (including
  // alternatives). If no tested boundary supplies a witness, keep the scan partial.
  const candidates = new Set(['0.0.0'])
  for (const { value } of rows) {
    for (const [prereleaseVersion] of value.matchAll(/\d+\.\d+\.\d+-[a-z]+(?:\.\d+)*/g)) candidates.add(prereleaseVersion)
    for (const [, boundary] of value.matchAll(/(?:^|[<>=~^|\s])v?(\d+(?:\.\d+){0,2})/g)) {
      const version = new ts.Version(boundary)
      candidates.add(version.toString())
      for (const part of ['patch', 'minor', 'major']) candidates.add(version.increment(part).toString())
    }
  }
  if (![...candidates].some(version => declarations.every(row => version.includes('-')
    ? admitsPrerelease(ts, row.value, version) : row.range.test(version)))) {
    issue('runtime-selector-comparison-unresolved', rows[0].evidence.path)
  }
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

  for (const tool of toolNames) checkRuntimeSelectors(ts, runtimePins.filter(row => row.tool === tool), issue)
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
