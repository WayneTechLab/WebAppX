import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { constants, closeSync, fstatSync, fsyncSync, lstatSync, openSync, opendirSync, readSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, posix, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { confinedDirectory, confinedFile } from '../runtime/file-boundary.mjs'
import { isCanonicalSourcePath } from '../source-policy.mjs'
import { readModuleScripts } from './inventory-html.mjs'
import { readViteInputs } from './inventory-vite.mjs'
import { inspectDeclaredRoutes, publicPattern } from './declared-routes.mjs'
import { inspectComponents, validComponentInventory } from './component-inventory.mjs'
import { configurationInputPaths, inspectInventoryConfig, validInventoryConfig } from './inventory-config.mjs'
import { inspectInventoryMetadata, inventoryResourceStatsMatch, isInventoryMetadataPath, validInventoryMetadata } from './inventory-metadata.mjs'
import { compareInventories } from './inventory-comparison.mjs'
import { prunedNames, stagedSources, untrackedSources, workBudget } from './inventory-working-state.mjs'

const require = createRequire(import.meta.url)
export const inventoryLimits = Object.freeze({ indexBytes: 4_000_000, records: 16_000, sourceBytes: 256_000, totalBytes: 3_000_000, files: 160, routes: 300, findings: 100, stateBytes: 750_000 })
const suffixes = ['.tsx', '.jsx', '.ts', '.js', '.mjs']
const viteConfigs = ['js','mjs','cjs','ts','mts','cts'].map(ext => `vite.config.${ext}`)
const entryCandidates = ['src/main', 'src/index'].flatMap(base => suffixes.map(ext => base + ext))
const cacheFile = 'last-good.json'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const utf8 = new TextDecoder('utf-8', { fatal: true })
const fail = code => { throw Object.assign(new Error(code), { inventoryCode: code }) }
const privateName = /private|secret|credential|password|api[._-]?key|access[._-]?token|(?:^|[^a-z])(?:tokens?|keys?)(?:[^a-z]|$)|gh[pousr]_|github_pat_|sk_live_|AKIA[0-9A-Z]/i
const safeModule = path => isCanonicalSourcePath(path) && path.startsWith('src/') && suffixes.some(ext => path.endsWith(ext)) && !privateName.test(path)
const safeHtml = path => isCanonicalSourcePath(path) && (!path.includes('/') || path.startsWith('src/')) && path.endsWith('.html') && !privateName.test(path)
const safeEvidence = path => safeModule(path) || safeHtml(path) || viteConfigs.includes(path) || ['package.json', 'tsconfig.json'].includes(path)
const safeConfigEvidence = path => configurationInputPaths.includes(path)
const eligible = path => (safeEvidence(path) || safeConfigEvidence(path)) && !path.split('/').some(part => prunedNames.test(part))

function validSnapshot(value, checkoutId) {
  const keys = (record, names) => record && typeof record === 'object' && Object.keys(record).length === names.length && names.every(key => Object.hasOwn(record, key))
  const digest = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value)
  const oid = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)
  const line = number => Number.isInteger(number) && number > 0 && number <= inventoryLimits.sourceBytes
  const rows = (list, max, verify) => Array.isArray(list) && list.length <= max && list.every(verify)
  const exportKeys = ['schemaVersion','checkoutId','commit','indexRevision','supportedStack','complete','entryPoints','routes','findings','omittedFindings','exclusions','evidence','revision']
  if (value?.schemaVersion >= 2) exportKeys.push('components')
  if (value?.schemaVersion >= 3) exportKeys.push('configuration')
  if (value?.schemaVersion === 4) exportKeys.push('metadata')
  if (!keys(value, exportKeys) || ![1, 2, 3, 4].includes(value.schemaVersion) || value.checkoutId !== checkoutId || !oid(value.commit)
    || !digest(value.indexRevision) || value.supportedStack !== 'vite' || value.complete !== true || value.omittedFindings !== 0
    || !Array.isArray(value.findings) || value.findings.length !== 0 || !digest(value.revision)) return false
  const provenance = entry => keys(entry, ['state','source','declaredIn','line'])
    || (keys(entry, ['state','source','declaredIn','line','configuration']) && keys(entry.configuration, ['path','line']) && viteConfigs.includes(entry.configuration.path) && line(entry.configuration.line))
  if (!rows(value.entryPoints, 32, e => (provenance(e) && e.state === 'explicit' && (safeHtml(e.declaredIn) || viteConfigs.includes(e.declaredIn)) && line(e.line) && safeModule(e.source))
    || (keys(e, ['state','source','basis']) && e.state === 'inferred' && e.basis === 'vite-entry-convention' && entryCandidates.includes(e.source)))) return false
  if (!rows(value.routes, inventoryLimits.routes, r => keys(r, ['state','pattern','source','declaredIn','line']) && r.state === 'explicit' && publicPattern(r.pattern) && safeModule(r.source) && safeModule(r.declaredIn) && line(r.line))) return false
  if (!rows(value.evidence, inventoryLimits.files, e => keys(e, ['path','sha256','indexOid','matchesIndex']) && (safeEvidence(e.path) || (value.schemaVersion >= 3 && safeConfigEvidence(e.path))) && digest(e.sha256) && oid(e.indexOid) && typeof e.matchesIndex === 'boolean')) return false
  if (value.schemaVersion >= 2 && !validComponentInventory(value.components, value.evidence, value.routes)) return false
  if (value.schemaVersion >= 3 && !validInventoryConfig(value.configuration, value.evidence)) return false
  if (value.schemaVersion === 4 && !validInventoryMetadata(value.metadata,value)) return false
  if (!keys(value.exclusions, ['outsideSourceScope','privateOrNoncanonical','nonregularIndex']) || Object.values(value.exclusions).some(n => !Number.isInteger(n) || n < 0 || n > inventoryLimits.records)) return false
  const { revision, ...report } = value
  return revision === hash(JSON.stringify(report))
}

function git(root, args, { budget, input, allowOne = false } = {}) {
  budget?.check()
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')))
  Object.assign(env, { GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' })
  try {
    return utf8.decode(execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args], {
      cwd: root, env, timeout: Math.min(6000, budget?.remaining() ?? 6000), maxBuffer: inventoryLimits.indexBytes, input,
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'], windowsHide: true,
    }))
  } catch (error) {
    budget?.check()
    if (allowOne && error.status === 1) return utf8.decode(error.stdout ?? Buffer.alloc(0))
    fail('git-inventory-unavailable')
  }
}

function readBounded(path, max) {
  const initial = lstatSync(path)
  if (!initial.isFile() || initial.nlink !== 1 || initial.size > max) fail('linked-or-oversized-file')
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
  try {
    const info = fstatSync(fd)
    if (info.ino !== initial.ino || info.dev !== initial.dev || !info.isFile()) fail('file-changed')
    const bytes = Buffer.alloc(initial.size + 1)
    let count = 0
    while (count < bytes.length) {
      const n = readSync(fd, bytes, count, bytes.length - count)
      if (!n) break
      count += n
    }
    const end = fstatSync(fd)
    if (count !== initial.size || end.ctimeMs !== initial.ctimeMs || end.mtimeMs !== initial.mtimeMs) fail('file-changed')
    return bytes.subarray(0, count)
  } finally { closeSync(fd) }
}

function repository(rootPath, budget) {
  let supplied = resolve(rootPath)
  if (lstatSync(supplied).isSymbolicLink()) fail('linked-repository')
  const root = realpathSync(supplied)
  // macOS publishes these system-owned aliases for its temporary directories.
  if (process.platform === 'darwin') supplied = supplied.replace(/^\/(var|tmp)\//, '/private/$1/')
  if (process.platform === 'win32' ? supplied.toLowerCase() !== root.toLowerCase() : supplied !== root) fail('linked-repository')
  const marker = join(root, '.git')
  const info = lstatSync(marker)
  let gitDir = marker
  if (info.isFile()) {
    const pointer = /^gitdir: ([^\r\n]+)\r?\n?$/.exec(utf8.decode(readBounded(marker, 4096)))
    if (!pointer) fail('unsupported-git-directory')
    gitDir = resolve(root, pointer[1])
    // Only genuine registered worktrees may refer to another metadata directory.
    if (basename(dirname(gitDir)) !== 'worktrees' || realpathSync(gitDir) !== gitDir
      || resolve(gitDir, utf8.decode(readBounded(join(gitDir, 'gitdir'), 4096)).trim()) !== marker) fail('unverified-git-directory')
  } else if (!info.isDirectory()) fail('linked-repository')
  if (realpathSync(git(root, ['rev-parse', '--show-toplevel'], {budget}).trim()) !== root
    || realpathSync(git(root, ['rev-parse', '--absolute-git-dir'], {budget}).trim()) !== gitDir) fail('unverified-git-directory')
  return { root, gitDir, checkoutId: hash(`repository-inventory-v1\0${root}`) }
}

function loadIndex(root, budget) {
  const head = git(root, ['rev-parse', '--verify', 'HEAD'], {budget}).trim()
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(head)) fail('missing-commit')
  const raw = git(root, ['ls-files', '--stage', '-z'], {budget})
  const index = new Map(), modes = new Map()
  const exclusions = { outsideSourceScope: 0, privateOrNoncanonical: 0, nonregularIndex: 0 }
  const records = raw.split('\0')
  if (records.pop() !== '' || records.length > inventoryLimits.records) fail('index-budget')
  for (const record of records) {
    const match = /^(\d{6}) ([a-f0-9]{40}|[a-f0-9]{64}) ([0-3])\t([\s\S]+)$/.exec(record)
    if (!match) fail('invalid-index')
    const [,mode,oid,stage,path] = match
    if ((!isInventoryMetadataPath(path) && !isCanonicalSourcePath(path) && !['.nvmrc', '.node-version'].includes(path)) || privateName.test(path)) { exclusions.privateOrNoncanonical++; continue }
    if (!eligible(path) && !isInventoryMetadataPath(path)) { exclusions.outsideSourceScope++; continue }
    if (stage !== '0') fail('unmerged-source')
    modes.set(path, mode)
    if (!['100644','100755'].includes(mode)) { exclusions.nonregularIndex++; index.set(path, null); continue }
    index.set(path, oid)
  }
  return { head, index, modes, exclusions, indexRevision: hash(raw) }
}

function inspect(repo, ts, budget, observation) {
  const { root, checkoutId } = repo
  const { head, index, modes, exclusions, indexRevision } = loadIndex(root, budget)
  observation.indexExclusions = exclusions
  const entries = [], routes = [], routeDeclarations = [], routeBindings = [], findings = [], evidence = new Map()
  const names = new Map(), normalized = new Set()
  let totalBytes = 0, omittedFindings = 0
  function exactFile(path) {
    const candidate = confinedFile(root, join(root, path))
    if (!candidate) return null
    let parent = root
    for (const part of path.split('/')) {
      if (!names.has(parent)) {
        budget.add('directories')
        const listing = new Map(), handle = opendirSync(parent)
        try {
          let item
          while ((item = handle.readSync())) {
            budget.add('directoryEntries')
            if (listing.size >= 4000) fail('directory-budget')
            const key = item.name.toLowerCase()
            listing.set(key, listing.has(key) ? null : item.name)
          }
        } finally { handle.closeSync() }
        names.set(parent, listing)
      }
      if (names.get(parent).get(part.toLowerCase()) !== part) return null
      parent = join(parent, part)
    }
    return candidate
  }
  function unresolved(code, path, line, occurrences = 1) {
    if (findings.length >= inventoryLimits.findings) { omittedFindings += occurrences; return }
    findings.push({ state: 'unresolved', code, ...(path ? { path } : {}), ...(line ? { line } : {}), ...(occurrences > 1 ? { occurrences } : {}) })
  }
  function fileBytes(file) {
    budget.add('fileReads')
    const size = lstatSync(file).size
    if (size > inventoryLimits.sourceBytes) fail('linked-or-oversized-file')
    budget.add('bytesRead', size)
    const bytes = readBounded(file, size)
    if (bytes.length !== size) fail('file-changed')
    return bytes
  }
  function read(path) {
    if (!index.get(path)) fail('module-unavailable')
    const file = exactFile(path)
    if (!file) fail('module-unavailable')
    const bytes = fileBytes(file)
    if (!evidence.has(path)) totalBytes += bytes.length
    if ((!evidence.has(path) && evidence.size >= inventoryLimits.files) || totalBytes > inventoryLimits.totalBytes) fail('source-budget')
    const sha256 = hash(bytes)
    if (evidence.has(path) && evidence.get(path).sha256 !== sha256) fail('file-changed')
    const indexOid = index.get(path)
    const oidOf = data => createHash(indexOid.length === 40 ? 'sha1' : 'sha256').update(`blob ${data.length}\0`).update(data).digest('hex')
    const blob = oidOf(bytes)
    if (blob !== indexOid && bytes.includes('\r\n')) {
      const lf = Buffer.from(bytes.toString('binary').replace(/\r\n/g, '\n'), 'binary')
      if (oidOf(lf) === indexOid) normalized.add(path)
    }
    evidence.set(path, { path, sha256, indexOid, matchesIndex: blob === indexOid })
    const source = utf8.decode(bytes)
    if (source.includes('\0')) fail('non-text-source')
    return source
  }
  let pkg
  if (index.has('package.json')) {
    const manifest = read('package.json')
    try { pkg = JSON.parse(manifest) } catch { fail('invalid-package-manifest') }
  }
  if (!(pkg?.dependencies?.vite || pkg?.devDependencies?.vite)) {
    const declared = { ...pkg?.dependencies, ...pkg?.devDependencies }
    const stack = ['next','nuxt','astro','@angular/core','svelte','vue','react'].find(name => Object.hasOwn(declared, name)) ?? 'unknown'
    observation.capabilities = { stack, commit:head, indexRevision, eligibleTrackedCount:index.size,
      available: ['tracked-index', ...(pkg ? ['package-manifest-digest'] : []), 'last-good-readback'],
      missing: ['supported-entry-and-route-adapter', 'component-attribution-adapter'],
      evidence: [...evidence.values()] }
    fail('unsupported-stack')
  }
  let alias = false
  if (index.has('tsconfig.json')) {
    const parsed = ts.parseConfigFileTextToJson('tsconfig.json', read('tsconfig.json'))
    const opts = parsed.config?.compilerOptions
    if (parsed.error) unresolved('invalid-typescript-config', 'tsconfig.json')
    else alias = (opts?.baseUrl ?? '.') === '.' && JSON.stringify(opts?.paths?.['@/*']) === '["src/*"]'
  }
  function resolveModule(from, specifier) {
    if (typeof specifier !== 'string' || !/^[a-zA-Z\d@/_.-]{1,320}$/.test(specifier) || specifier.startsWith('//')) return null
    let base
    if (specifier.startsWith('@/') && alias) base = posix.join('src', specifier.slice(2))
    else if (specifier.startsWith('./') || specifier.startsWith('../')) base = posix.join(posix.dirname(from), specifier)
    else if (safeHtml(from)) base = specifier.startsWith('/') ? specifier.slice(1) : posix.join(posix.dirname(from), specifier)
    else return null
    const options = posix.extname(base) ? [base] : suffixes.flatMap(ext => [base + ext, `${base}/index${ext}`])
    const matches = options.filter(path => safeModule(path) && index.has(path))
    if (matches.length !== 1 || !index.get(matches[0]) || !exactFile(matches[0])) return null
    return matches[0]
  }
  function addEntry(source, declaredIn, line, configuration) {
    if (entries.length >= 32) fail('entry-budget')
    entries.push({ state: 'explicit', source, declaredIn, line, ...(configuration ? { configuration } : {}) })
  }
  function inspectHtml(htmlPath, configuration) {
    const html = read(htmlPath)
    const scripts = []
    let ambiguous = false
    readModuleScripts(html, (specifier, line) => {
      if (scripts.length >= 32) fail('entry-budget')
      scripts.push({ specifier, line })
    }, (code, line) => {
      ambiguous = true; unresolved(code, htmlPath, line)
    })
    if (!ambiguous) for (const { specifier, line } of scripts) {
      const source = resolveModule(htmlPath, specifier)
      if (source) addEntry(source, htmlPath, line, configuration)
      else unresolved('unresolved-module-script', htmlPath, line)
    }
    if (!scripts.length && !ambiguous) unresolved('no-declared-module-script', htmlPath)
  }
  const configs = viteConfigs.filter(path => index.has(path))
  let config = { inputs: null }
  if (configs.length > 1) unresolved('ambiguous-vite-config')
  else if (configs.length === 1) config = readViteInputs({ ts, sourcePath: configs[0], source: read(configs[0]) })
  if (config.unresolved) unresolved(config.unresolved.code, configs[0], config.unresolved.line)
  else if (configs.length <= 1 && config.inputs) {
    for (const { specifier, line } of config.inputs) {
      const target = specifier.replace(/^\.\//, '')
      if (index.get(target) && safeHtml(target)) inspectHtml(target, { path: configs[0], line })
      else if (index.get(target) && safeModule(target)) addEntry(target, configs[0], line)
      else unresolved('unresolved-vite-input', configs[0], line)
    }
  } else if (configs.length <= 1 && index.has('index.html')) inspectHtml('index.html')
  else if (configs.length <= 1) {
    if (lstatSync(join(root, 'index.html'), { throwIfNoEntry: false })) unresolved('untracked-entry-config')
    const candidates = entryCandidates.filter(path => index.has(path))
    if (candidates.length === 1 && index.get(candidates[0])) entries.push({ state: 'inferred', source: candidates[0], basis: 'vite-entry-convention' })
    else unresolved('ambiguous-or-missing-entry')
  }
  const visited = new Set(), seenRoutes = new Map(), duplicates = new Set()
  let recognized = false
  function inspectModule(path, depth) {
    if (visited.has(path)) return
    visited.add(path)
    if (depth > 6) { unresolved('router-traversal-limit', path); return }
    const source = read(path)
    const resolveImport = specifier => resolveModule(path, specifier)
    const parsed = inspectDeclaredRoutes({ sourcePath: path, source, ts, resolveImport,
      unresolved: finding => unresolved(finding.code, path, finding.line),
      declaration: row => {
        if (routeDeclarations.length >= inventoryLimits.routes) fail('route-budget')
        routeDeclarations.push({ pattern:row.pattern, source:row.source, declaredIn:path, line:row.line })
      },
      route: row => {
        if (routes.length >= inventoryLimits.routes) fail('route-budget')
        if (seenRoutes.has(row.pattern)) { duplicates.add(row.pattern); unresolved('duplicate-route-pattern', path, row.line); return }
        // Read only selected targets and bind their actual working bytes to the inventory.
        if (!evidence.has(row.source)) read(row.source)
        seenRoutes.set(row.pattern, true)
        routes.push({ state: 'explicit', pattern: row.pattern, source: row.source, declaredIn: path, line: row.line })
        routeBindings.push({ ...row, declaredIn: path })
      },
    })
    if (parsed?.recognized) { recognized = true; return }
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    if (file.parseDiagnostics.length) { unresolved('invalid-routing-source', path); return }
    // Follow locally imported JSX elements from the entry shell. Arbitrary
    // files named router or pages found elsewhere are not app declarations.
    const imports = new Map()
    for (const item of file.statements) {
      if (!ts.isImportDeclaration(item) || !ts.isStringLiteral(item.moduleSpecifier)) continue
      const name = item.moduleSpecifier.text
      if (!name.startsWith('.') && !name.startsWith('@/')) continue
      const target = resolveImport(name)
      if (item.importClause?.name) imports.set(item.importClause.name.text, target)
      for (const named of item.importClause?.namedBindings?.elements ?? []) imports.set(named.name.text, target)
    }
    const children = new Set()
    const stack = [file]
    let nodeCount = 0
    while (stack.length) {
      if (++nodeCount > 32_000) { unresolved('entry-syntax-limit', path); return }
      const node = stack.pop()
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName) && imports.has(node.tagName.text)) {
        const child = imports.get(node.tagName.text)
        if (child) children.add(child)
        else unresolved('unresolved-entry-import', path, file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1)
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) unresolved('dynamic-entry-import', path, file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1)
      ts.forEachChild(node, child => { stack.push(child) })
    }
    for (const child of children) inspectModule(child, depth + 1)
  }
  for (const entry of entries) inspectModule(entry.source, 0)
  if (!recognized) unresolved('no-supported-route-declarations')
  const componentSources = new Set([...index.keys()].filter(path => safeModule(path) && /\.[jt]sx$/.test(path)))
  for (const path of [...visited, ...routes.map(row => row.source)]) componentSources.add(path)
  const componentDeclarations = []
  const components = inspectComponents({
    componentDeclaration: row => {
      if (componentDeclarations.length >= 1200) fail('component-declaration-budget')
      componentDeclarations.push(row)
    },
    ts, sources: componentSources, entryPoints: entries, routes: routeBindings.filter(row => !duplicates.has(row.pattern)),
    read: path => index.get(path) && exactFile(path) ? read(path) : null,
    resolveImport: resolveModule, revisionOf: path => evidence.get(path).sha256, unresolved,
  })
  const configuration = inspectInventoryConfig({
    ts, hasTracked: path => index.has(path), read, evidenceFor: path => evidence.get(path), issue: unresolved,
  })
  // Observe eligible staged, working and untracked paths independently of HEAD.
  // Do not use git status or invoke checkout-provided clean/textconv filters.
  function inputFor(paths) { return Buffer.from(paths.join('\0') + '\0') }
  const staged = stagedSources(git(root, ['diff', '--cached', '--name-status', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', head, '--'], {budget}), eligible)
  const local = untrackedSources({root, index, eligible, budget,
    safeDirectory: path => isCanonicalSourcePath(path) && !privateName.test(path),
    ignored: paths => new Set(git(root, ['check-ignore', '-z', '--stdin'], {budget, allowOne:true, input:inputFor(paths)}).split('\0').filter(Boolean)) })
  const fileMode = git(root, ['config', '--bool', '--get', 'core.filemode'], {budget, allowOne:true}).trim() !== 'false'
  const unstaged = [], changedBytes = []
  for (const [path, indexOid] of index) {
    budget.check()
    if (!indexOid || !eligible(path)) continue // metadata-only resources are never opened
    const file = exactFile(path)
    if (!file) {
      // Only lstat a leaf if every ancestor still belongs to this checkout.
      let parent = root, status = 'deleted'
      for (const part of path.split('/')) {
        parent = join(parent, part)
        const entry = lstatSync(parent, {throwIfNoEntry:false})
        if (!entry) break
        if (entry.isSymbolicLink() || (!entry.isDirectory() && parent !== join(root,path))) { status = 'type-changed'; break }
        if (parent === join(root,path)) status = 'unavailable'
      }
      unstaged.push({path, status})
      unresolved('working-source-unavailable',path)
      continue
    }
    if (!evidence.has(path)) read(path)
    const modeChanged = fileMode && Boolean(lstatSync(file).mode & 0o100) !== (modes.get(path) === '100755')
    if (!evidence.get(path).matchesIndex) changedBytes.push({path, modeChanged})
    else if (modeChanged) unstaged.push({path, status:'mode-changed'})
  }
  if (changedBytes.length) {
    // Compare common line ending conversions without executing repository filters.
    const attrs = git(root, ['check-attr', '-z', '--stdin', 'text', 'eol', 'filter', 'working-tree-encoding', 'ident'],
      {budget, input:inputFor(changedBytes.map(row => row.path))}).split('\0')
    const byPath = new Map()
    for (let i=0; i+2<attrs.length; i+=3) {
      if (!byPath.has(attrs[i])) byPath.set(attrs[i],new Map())
      byPath.get(attrs[i]).set(attrs[i+1],attrs[i+2])
    }
    const auto = git(root, ['config', '--get', 'core.autocrlf'], {budget, allowOne:true}).trim()
    for (const {path,modeChanged} of changedBytes) {
      const attr = byPath.get(path)
      if (!attr) fail('unverified-working-source')
      const active = key => !['unset','unspecified'].includes(attr.get(key))
      if (['filter','working-tree-encoding','ident'].some(active)) {
        unstaged.push({path, status:'working-bytes-differ-filter-unverified'})
        continue
      }
      const eol = attr.get('text') !== 'unset' && (active('text') || active('eol') || ['true','input'].includes(auto))
      if (!eol || !normalized.has(path)) unstaged.push({path, status:'modified'})
      else if (modeChanged) unstaged.push({path, status:'mode-changed'})
    }
  }
  function bounded(rows) { return { total:rows.length, rows:rows.slice(0,128), omitted:Math.max(0,rows.length-128) } }
  unstaged.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  observation.workingState = { scope:'eligible-source-files', commit:head, indexRevision,
    staged:bounded(staged), unstaged:bounded(unstaged), untracked:bounded(local.paths), exclusions:local.exclusions }
  const declaredRoutes = routes.filter(row => !duplicates.has(row.pattern))
  const proofs = [...evidence.values()].sort((a, b) => a.path.localeCompare(b.path))
  if (!validInventoryConfig(configuration, proofs) || !validComponentInventory(components, proofs, declaredRoutes)) fail('unverified-inventory-metadata')
  function statFor(path) {
    if (!isInventoryMetadataPath(path)) return null
    const target = exactFile(path)
    if (!target) return null
    const stat = lstatSync(target,{bigint:true})
    return stat.isFile() && stat.nlink === 1n ? stat : null
  }
  const metadata = inspectInventoryMetadata({index, statFor, evidence, entryPoints:entries,
    routes:declaredRoutes, components, findings, routeDeclarations, componentDeclarations, issue:unresolved})
  if (findings.length) {
    const missing = new Set()
    for (const {code} of findings) {
      if (/config|proxy|pin|dependency|manifest|firebase|emulator|build-target/.test(code)) missing.add('static-configuration-resolution')
      if (/route|routing|entry|module-script|vite-input/.test(code)) missing.add('complete-entry-and-route-resolution')
      if (/component|shell/.test(code)) missing.add('complete-component-attribution')
      if (/working-source/.test(code)) missing.add('exact-working-source')
    }
    observation.capabilities = { stack:'vite', commit:head, indexRevision, eligibleTrackedCount:index.size,
      available:['tracked-index','verified-source-digests','partial-declarations','last-good-readback'],
      missing:[...missing].sort() }
  }
  names.clear()
  for (const item of evidence.values()) {
    const target = exactFile(item.path)
    if (!target || hash(fileBytes(target)) !== item.sha256) fail('file-changed')
  }
  if (!inventoryResourceStatsMatch(metadata,index,statFor)) fail('file-changed')
  const finished = loadIndex(root,budget)
  if (finished.head !== head || finished.indexRevision !== indexRevision) fail('index-changed')
  const report = { schemaVersion: 4, checkoutId, commit: head, indexRevision, supportedStack: 'vite', complete: !findings.length && !omittedFindings,
    entryPoints: entries, routes: declaredRoutes, components, configuration, metadata, findings, omittedFindings, exclusions, evidence: proofs }
  if (!validInventoryMetadata(metadata,report)) fail('unverified-inventory-metadata')
  if (Buffer.byteLength(JSON.stringify(report)) + 100 > inventoryLimits.stateBytes) fail('snapshot-budget')
  return { ...report, revision: hash(JSON.stringify(report)) }
}

export function trackedInventory(root, action = 'scan', options = {}) {
  let lastGood = null, baselineDigest = null, repo, budget
  const observation = {}
  try {
    if (!['scan', 'compare', 'last-good'].includes(action)) fail('invalid-action')
    // Resolve the retained baseline even when a tiny rescan budget expires.
    repo = repository(root)
    const dir = join(repo.gitDir, 'systemx-repository-inventory')
    const cache = join(dir, cacheFile)
    function readCache() {
      const info = lstatSync(dir, {throwIfNoEntry:false})
      if (!info) return null
      if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(dir) !== dir) fail('linked-state-directory')
      return lstatSync(cache, {throwIfNoEntry:false}) ? readBounded(cache,inventoryLimits.stateBytes) : null
    }
    function verifyBaseline() {
      const current = readCache()
      if ((current ? hash(current) : null) !== baselineDigest) fail('baseline-changed')
    }
    const retained = readCache()
    if (retained) {
      const value = JSON.parse(utf8.decode(retained))
      if (!validSnapshot(value, repo.checkoutId)) fail('invalid-retained-inventory')
      lastGood = value
      baselineDigest = hash(retained)
    }
    if (action === 'last-good') return { status: lastGood ? 'retained' : 'empty', checkoutId: repo.checkoutId, lastGood,
      ...(lastGood && lastGood.schemaVersion < 4 ? { missingCoverage:[
        ...(lastGood.schemaVersion === 1 ? ['component-exports','shared-shell-sources'] : []),
        ...(lastGood.schemaVersion < 3 ? ['configuration'] : []), 'resource-metadata'] } : {}) }
    budget = workBudget(options.elapsedMs)
    const inventory = inspect(repo, require('typescript'), budget, observation)
    budget.check()
    const comparison = compareInventories(lastGood,inventory)
    const result = { inventory, comparison, ...observation, lastGoodRevision:lastGood?.revision ?? null, lastGoodSchemaVersion:lastGood?.schemaVersion ?? null }
    budget.check()
    if (!inventory.complete) return {status:'incomplete', ...result, work:budget.report()}
    if (!validSnapshot(inventory,repo.checkoutId)) fail('unverified-inventory-metadata')
    if (action === 'compare') {
      verifyBaseline()
      return {status:'compared', ...result, work:budget.report()}
    }
    const data = JSON.stringify(inventory) + '\n'
    if (Buffer.byteLength(data) > inventoryLimits.stateBytes) fail('snapshot-budget')
    confinedDirectory(repo.gitDir,dir)
    // Serialize the short publication step so a concurrent accepted scan cannot
    // silently replace the exact baseline used for this comparison.
    const lock = join(dir, 'accept.lock')
    let lockFd
    try { lockFd = openSync(lock, 'wx', 0o600) } catch (error) { if (error.code === 'EEXIST') fail('accept-in-progress'); throw error }
    try {
      verifyBaseline()
      const temp = join(dir, `${randomUUID()}.tmp`)
      const fd = openSync(temp, 'wx', 0o600)
      try {
        try { writeFileSync(fd, data); fsyncSync(fd) } finally { closeSync(fd) }
        budget.check()
        renameSync(temp,cache)
      } finally { try { unlinkSync(temp) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    } finally { closeSync(lockFd); unlinkSync(lock) }
    return { ...result, status:'accepted', lastGoodRevision:inventory.revision, lastGoodSchemaVersion:inventory.schemaVersion, work:budget.report() }
  } catch (error) {
    return { status: 'refused', code: error.inventoryCode ?? (error.code === 'MODULE_NOT_FOUND' ? 'parser-unavailable' : 'inventory-unavailable'),
      checkoutId: repo?.checkoutId ?? null, lastGoodRevision: lastGood?.revision ?? null, ...observation, ...(budget ? {work:budget.report()} : {}) }
  }
}
