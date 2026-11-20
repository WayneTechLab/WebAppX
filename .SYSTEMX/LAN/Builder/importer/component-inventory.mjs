import { inspectComponentModule } from './component-declarations.mjs'
import { publicPattern } from './declared-routes.mjs'

const limits = { exports: 600, shells: 300, roles: 100, uses: 900, trace: 18, visits: 75_000 }
const scope = 'tracked-src-jsx-tsx-and-route-modules'
const names = value => typeof value === 'string' && /^[A-Za-z_$][A-Za-z_$0-9]{0,79}$/.test(value)
  && !/gh[pousr]_|github_pat_|sk_live_|AKIA[A-Z0-9]|password|credential|secret/i.test(value)
const roles = new Set(['header', 'footer', 'navigation'])
const relations = new Set(['page-render', 'route-wrapper', 'route-sibling', 'router-markup'])
const key = (path, name) => path + '\0' + name

export function inspectComponents({ ts, sources, entryPoints, routes, read, resolveImport, revisionOf, unresolved, componentDeclaration }) {
  const modules = new Map()
  const exports = []
  for (const path of sources) {
    const source = read(path)
    if (source === null) { unresolved('component-module-unavailable', path); continue }
    function record(name, exportLine) {
      if (names(name)) componentDeclaration?.({ source:path, name, exportLine })
    }
    const metadata = inspectComponentModule({ ts, path, source, ambiguousBinding:record })
    const issues = new Map()
    for (const issue of metadata.findings) {
      const group = issues.get(issue.code)
      if (group) group.occurrences++
      else issues.set(issue.code, { ...issue, occurrences: 1 })
    }
    for (const issue of issues.values()) unresolved(issue.code, path, issue.line, issue.occurrences)
    const definitions = new Map(metadata.components.map(row => [row.name, row]))
    const exported = new Map(), repeatedExports = new Set()
    for (const row of metadata.exports) {
      if (!names(row.name) || !names(row.local) || !definitions.has(row.local)) continue
      if (exported.has(row.name)) repeatedExports.add(row.name)
      exported.set(row.name,definitions.get(row.local))
    }
    for (const name of repeatedExports) exported.delete(name)
    for (const row of metadata.exports) {
      const definition = definitions.get(row.local)
      if (!definition) continue
      if (!names(row.name) || !names(row.local)) { unresolved('unsupported-component-name', path, row.line); continue }
      if (row.name !== 'default' && !/^[A-Z]/.test(row.name)) continue
      record(row.name,row.line)
      if (repeatedExports.has(row.name)) {
        unresolved('ambiguous-component-export',path,row.line)
        continue
      }
      if (exports.length >= limits.exports) { unresolved('component-export-budget', path); break }
      exports.push({ source: path, name: row.name, declarationLine: definition.line, exportLine: row.line, kind: definition.kind, sourceRevision: revisionOf(path) })
    }
    modules.set(path, { definitions, exported, imports: new Map(metadata.imports.map(row => [row.local, row])), roots: metadata.roots })
  }

  const reported = new Set()
  function issueOnce(code, path, line) {
    const id = key(path, code + line)
    if (!reported.has(id)) { reported.add(id); unresolved(code, path, line) }
  }
  function resolveRef(path, ref) {
    const mod = modules.get(path)
    const local = mod?.definitions.get(ref.name)
    if (local) return { path, definition: local }
    const imported = mod?.imports.get(ref.name)
    if (!imported || !/^(?:\.|@\/)/.test(imported.specifier)) return null
    const target = resolveImport(path, imported.specifier)
    const found = modules.get(target)?.exported.get(imported.imported)
    if (!found) { issueOnce('unresolved-component-reference', path, ref.line); return null }
    return { path: target, definition: found }
  }
  const byPage = new Map()
  for (const route of routes) {
    if (!names(route.exportName)) { issueOnce('unsupported-page-component-name', route.declaredIn, route.line); continue }
    const id = key(route.source, route.exportName)
    if (!byPage.has(id)) byPage.set(id, [])
    byPage.get(id).push(route)
  }

  const shells = new Map()
  let visits = 0, uses = 0
  function walk(starts, visit) {
    const seen = new Set(starts.map(item => key(item.path, item.definition.name)))
    const queue = [...starts]
    for (let i = 0; i < queue.length; i++) {
      const { path, definition, trace } = queue[i]
      if (++visits > limits.visits) { issueOnce('component-traversal-budget', path); return }
      if (visit(path, definition, trace) === false) continue
      for (const ref of definition.refs) {
        const next = resolveRef(path, ref)
        if (!next || seen.has(key(next.path, next.definition.name))) continue
        if (trace.length >= limits.trace) { issueOnce('component-trace-depth', path, ref.line); continue }
        seen.add(key(next.path, next.definition.name))
        queue.push({ ...next, trace: [...trace, { source: path, line: ref.line }] })
      }
    }
  }

  function attribute(start, pageRoutes, via, trace) {
    if (!start || !pageRoutes.length) return
    const page = pageRoutes[0]
    walk([{ ...start, trace }], (path, definition, steps) => {
      // A router delegates to its declared pages. Following a second dispatcher
      // from a shell would incorrectly attribute another route's own content.
      if (definition.name === 'renderPage' || definition.dispatches.length) return false
      if (!definition.roles.length || !names(definition.name)) return
      if (definition.roles.length > limits.roles) { issueOnce('shell-role-budget', path); return }
      const id = key(path, definition.name)
      let shell = shells.get(id)
      if (!shell) {
        if (shells.size >= limits.shells) { issueOnce('shell-source-budget', path); return }
        shell = { source: path, component: definition.name, declarationLine: definition.line, sourceRevision: revisionOf(path), roles: [], usedBy: new Map() }
        shells.set(id, shell)
      }
      for (const occurrence of definition.roles) {
        if (!shell.roles.some(r => r.role === occurrence.role && r.line === occurrence.line)) {
          if (shell.roles.length >= limits.roles) { issueOnce('shell-role-budget', path); return }
          shell.roles.push(occurrence)
        }
      }
      const usageId = key(page.source, page.exportName + '\0' + via)
      let usage = shell.usedBy.get(usageId)
      if (!usage) {
        if (uses >= limits.uses) { issueOnce('shell-attribution-budget', path); return }
        uses++
        usage = { pageSource: page.source, pageExport: page.exportName, via, patterns: new Set(), trace: steps }
        shell.usedBy.set(usageId, usage)
      }
      for (const item of pageRoutes) usage.patterns.add(item.pattern)
    })
  }

  for (const pageRoutes of byPage.values()) {
    const page = pageRoutes[0]
    const definition = modules.get(page.source)?.exported.get(page.exportName)
    if (definition) attribute({ path: page.source, definition }, pageRoutes, 'page-render', [])
    else issueOnce('unresolved-page-component', page.declaredIn, page.line)
  }

  const starts = []
  for (const { source } of entryPoints) {
    for (const ref of modules.get(source)?.roots ?? []) {
      const next = resolveRef(source, ref)
      if (next) starts.push({ ...next, trace: [{ source, line: ref.line }] })
    }
  }
  walk(starts, (path, definition) => {
    for (const [via, refs] of [['route-wrapper', definition.wrappers], ['route-sibling', definition.neighbors], ['router-markup', definition.neighborRoles]]) {
      for (const ref of refs) {
        const imported = modules.get(path)?.imports.get('renderPage')
        const dispatcherPath = ref.dispatch === 'renderPage' && imported ? resolveImport(path, imported.specifier) : path
        const target = via === 'router-markup' ? { path, definition: { ...definition, dispatches: [], refs: [], roles: [{ role: ref.role, line: ref.line }] } } : resolveRef(path, ref)
        if (!target) continue
        for (const pageRoutes of byPage.values()) {
          const bound = pageRoutes.filter(r => r.declaredIn === dispatcherPath && r.dispatch.kind === ref.dispatch
            && (ref.dispatch === 'renderPage' || r.dispatch.line === ref.dispatchLine))
          attribute(target, bound, via, [{ source: path, line: ref.line }])
        }
      }
    }
  })
  const shellSources = [...shells.values()].map(shell => ({
    ...shell, usedBy: [...shell.usedBy.values()].map(use => ({ ...use, patterns: [...use.patterns] })),
  }))
  return { scope, exports, shellSources }
}

export function validComponentInventory(value, evidence, routes) {
  const proof = new Map(evidence.filter(e => /^src\/.*\.(?:[jt]sx?|mjs)$/.test(e.path)).map(e => [e.path, e.sha256]))
  const paths = new Map()
  for (const r of routes) {
    if (!paths.has(r.source)) paths.set(r.source, new Set())
    paths.get(r.source).add(r.pattern)
  }
  const exact = (object, fields) => object && typeof object === 'object' && Object.keys(object).length === fields.length && fields.every(f => Object.hasOwn(object, f))
  const line = n => Number.isInteger(n) && n > 0 && n <= 256_000
  const list = (a, max, fn) => Array.isArray(a) && a.length <= max && a.every(fn)
  const proved = row => typeof row.sourceRevision === 'string' && proof.get(row.source) === row.sourceRevision
  return exact(value, ['scope','exports','shellSources']) && value.scope === scope
    && list(value.exports, limits.exports, row => exact(row, ['source','name','declarationLine','exportLine','kind','sourceRevision'])
      && proved(row) && names(row.name) && ['function','arrow','class'].includes(row.kind) && line(row.declarationLine) && line(row.exportLine))
    && list(value.shellSources, limits.shells, row => exact(row, ['source','component','declarationLine','sourceRevision','roles','usedBy'])
      && proved(row) && names(row.component) && line(row.declarationLine)
      && list(row.roles, limits.roles, r => exact(r, ['role','line']) && roles.has(r.role) && line(r.line))
      && list(row.usedBy, limits.uses, u => exact(u, ['pageSource','pageExport','via','patterns','trace']) && paths.has(u.pageSource)
        && names(u.pageExport) && relations.has(u.via) && list(u.patterns, 300, p => publicPattern(p) && paths.get(u.pageSource).has(p))
        && list(u.trace, limits.trace, step => exact(step, ['source','line']) && proof.has(step.source) && line(step.line))))
}
