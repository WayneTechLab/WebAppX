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

function validSnapshot(value, checkoutId) {
  const keys = (record, names) => record && typeof record === 'object' && Object.keys(record).length === names.length && names.every(key => Object.hasOwn(record, key))
  const digest = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value)
  const oid = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)
  const line = number => Number.isInteger(number) && number > 0 && number <= inventoryLimits.sourceBytes
  const rows = (list, max, verify) => Array.isArray(list) && list.length <= max && list.every(verify)
  const exportKeys = ['schemaVersion','checkoutId','commit','indexRevision','supportedStack','complete','entryPoints','routes','findings','omittedFindings','exclusions','evidence','revision']
  if (!keys(value, exportKeys) || value.schemaVersion !== 1 || value.checkoutId !== checkoutId || !oid(value.commit)
    || !digest(value.indexRevision) || value.supportedStack !== 'vite' || value.complete !== true || value.omittedFindings !== 0
    || !Array.isArray(value.findings) || value.findings.length !== 0 || !digest(value.revision)) return false
  const provenance = entry => keys(entry, ['state','source','declaredIn','line'])
    || (keys(entry, ['state','source','declaredIn','line','configuration']) && keys(entry.configuration, ['path','line']) && viteConfigs.includes(entry.configuration.path) && line(entry.configuration.line))
  if (!rows(value.entryPoints, 32, e => (provenance(e) && e.state === 'explicit' && (safeHtml(e.declaredIn) || viteConfigs.includes(e.declaredIn)) && line(e.line) && safeModule(e.source))
    || (keys(e, ['state','source','basis']) && e.state === 'inferred' && e.basis === 'vite-entry-convention' && entryCandidates.includes(e.source)))) return false
  if (!rows(value.routes, inventoryLimits.routes, r => keys(r, ['state','pattern','source','declaredIn','line']) && r.state === 'explicit' && publicPattern(r.pattern) && safeModule(r.source) && safeModule(r.declaredIn) && line(r.line))) return false
  if (!rows(value.evidence, inventoryLimits.files, e => keys(e, ['path','sha256','indexOid','matchesIndex']) && safeEvidence(e.path) && digest(e.sha256) && oid(e.indexOid) && typeof e.matchesIndex === 'boolean')) return false
  if (!keys(value.exclusions, ['outsideSourceScope','privateOrNoncanonical','nonregularIndex']) || Object.values(value.exclusions).some(n => !Number.isInteger(n) || n < 0 || n > inventoryLimits.records)) return false
  const { revision, ...report } = value
  return revision === hash(JSON.stringify(report))
}

function git(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')))
  Object.assign(env, { GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' })
  try {
    return utf8.decode(execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args], {
      cwd: root, env, timeout: 6000, maxBuffer: inventoryLimits.indexBytes, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    }))
  } catch { fail('git-inventory-unavailable') }
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

function repository(rootPath) {
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
  if (realpathSync(git(root, ['rev-parse', '--show-toplevel']).trim()) !== root
    || realpathSync(git(root, ['rev-parse', '--absolute-git-dir']).trim()) !== gitDir) fail('unverified-git-directory')
  return { root, gitDir, checkoutId: hash(`repository-inventory-v1\0${root}`) }
}

function loadIndex(root) {
  const head = git(root, ['rev-parse', '--verify', 'HEAD']).trim()
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(head)) fail('missing-commit')
  const raw = git(root, ['ls-files', '--stage', '-z'])
  const index = new Map()
  const exclusions = { outsideSourceScope: 0, privateOrNoncanonical: 0, nonregularIndex: 0 }
  const records = raw.split('\0')
  if (records.pop() !== '' || records.length > inventoryLimits.records) fail('index-budget')
  for (const record of records) {
    const match = /^(\d{6}) ([a-f0-9]{40}|[a-f0-9]{64}) ([0-3])\t([\s\S]+)$/.exec(record)
    if (!match) fail('invalid-index')
    const [,mode,oid,stage,path] = match
    if (!isCanonicalSourcePath(path) || privateName.test(path)) { exclusions.privateOrNoncanonical++; continue }
    if (!safeEvidence(path)) { exclusions.outsideSourceScope++; continue }
    if (stage !== '0') fail('unmerged-source')
    if (!['100644','100755'].includes(mode)) { exclusions.nonregularIndex++; index.set(path, null); continue }
    index.set(path, oid)
  }
  return { head, index, exclusions, indexRevision: hash(raw) }
}

function inspect(repo, ts) {
  const { root, checkoutId } = repo
  const { head, index, exclusions, indexRevision } = loadIndex(root)
  const entries = [], routes = [], findings = [], evidence = new Map()
  const names = new Map()
  let totalBytes = 0, omittedFindings = 0
  function exactFile(path) {
    const candidate = confinedFile(root, join(root, path))
    if (!candidate) return null
    let parent = root
    for (const part of path.split('/')) {
      if (!names.has(parent)) {
        const listing = new Map(), handle = opendirSync(parent)
        try {
          let item
          while ((item = handle.readSync())) {
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
  function unresolved(code, path, line) {
    if (findings.length >= inventoryLimits.findings) { omittedFindings++; return }
    findings.push({ state: 'unresolved', code, ...(path ? { path } : {}), ...(line ? { line } : {}) })
  }
  function read(path) {
    if (!index.get(path)) fail('module-unavailable')
    const file = exactFile(path)
    if (!file) fail('module-unavailable')
    const bytes = readBounded(file, inventoryLimits.sourceBytes)
    if (!evidence.has(path)) totalBytes += bytes.length
    if (evidence.size >= inventoryLimits.files || totalBytes > inventoryLimits.totalBytes) fail('source-budget')
    const sha256 = hash(bytes)
    if (evidence.has(path) && evidence.get(path).sha256 !== sha256) fail('file-changed')
    const indexOid = index.get(path)
    const blob = createHash(indexOid.length === 40 ? 'sha1' : 'sha256').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
    evidence.set(path, { path, sha256, indexOid, matchesIndex: blob === indexOid })
    const source = utf8.decode(bytes)
    if (source.includes('\0')) fail('non-text-source')
    return source
  }
  const pkg = JSON.parse(read('package.json'))
  if (!(pkg?.dependencies?.vite || pkg?.devDependencies?.vite)) fail('unsupported-stack')
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
      route: row => {
        if (routes.length >= inventoryLimits.routes) fail('route-budget')
        if (seenRoutes.has(row.pattern)) { duplicates.add(row.pattern); unresolved('duplicate-route-pattern', path, row.line); return }
        // Read only selected targets and bind their actual working bytes to the inventory.
        if (!evidence.has(row.source)) read(row.source)
        seenRoutes.set(row.pattern, true)
        routes.push({ state: 'explicit', pattern: row.pattern, source: row.source, declaredIn: path, line: row.line })
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
  names.clear()
  for (const item of evidence.values()) {
    const target = exactFile(item.path)
    if (!target || hash(readBounded(target, inventoryLimits.sourceBytes)) !== item.sha256) fail('file-changed')
  }
  const finished = loadIndex(root)
  if (finished.head !== head || finished.indexRevision !== indexRevision) fail('index-changed')
  const report = { schemaVersion: 1, checkoutId, commit: head, indexRevision, supportedStack: 'vite', complete: !findings.length && !omittedFindings,
    entryPoints: entries, routes: routes.filter(row => !duplicates.has(row.pattern)), findings, omittedFindings, exclusions, evidence: [...evidence.values()].sort((a,b) => a.path.localeCompare(b.path)) }
  return { ...report, revision: hash(JSON.stringify(report)) }
}

export function trackedInventory(root, action = 'scan') {
  let lastGood = null
  let dir, repo
  try {
    if (!['scan', 'last-good'].includes(action)) fail('invalid-action')
    repo = repository(root)
    dir = join(repo.gitDir, 'systemx-repository-inventory')
    if (action === 'scan') confinedDirectory(repo.gitDir, dir)
    else if (!lstatSync(dir, { throwIfNoEntry: false })) return { status: 'empty', checkoutId: repo.checkoutId, lastGood: null }
    if (realpathSync(dir) !== dir) fail('linked-state-directory')
    const cache = join(dir, cacheFile)
    if (lstatSync(cache, { throwIfNoEntry: false })) {
      const value = JSON.parse(utf8.decode(readBounded(cache, inventoryLimits.stateBytes)))
      if (!validSnapshot(value, repo.checkoutId)) fail('invalid-retained-inventory')
      lastGood = value
    }
    if (action === 'last-good') return { status: lastGood ? 'retained' : 'empty', checkoutId: repo.checkoutId, lastGood }
    const inventory = inspect(repo, require('typescript'))
    if (!inventory.complete) return { status: 'incomplete', inventory, lastGoodRevision: lastGood?.revision ?? null }
    const data = JSON.stringify(inventory) + '\n'
    if (Buffer.byteLength(data) > inventoryLimits.stateBytes) fail('snapshot-budget')
    const temp = join(dir, `${randomUUID()}.tmp`)
    const fd = openSync(temp, 'wx', 0o600)
    try {
      try { writeFileSync(fd, data); fsyncSync(fd) } finally { closeSync(fd) }
      renameSync(temp, cache)
    } finally { try { unlinkSync(temp) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    return { status: 'accepted', inventory, lastGoodRevision: inventory.revision }
  } catch (error) {
    return { status: 'refused', code: error.inventoryCode ?? (error.code === 'MODULE_NOT_FOUND' ? 'parser-unavailable' : 'inventory-unavailable'),
      checkoutId: repo?.checkoutId ?? null, lastGoodRevision: lastGood?.revision ?? null }
  }
}
