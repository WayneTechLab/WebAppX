#!/usr/bin/env node
/** Static review aid: parse maintained script source, never execute/import it. */
import ts from 'typescript'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
export const childProcessLimits = Object.freeze({ files: 256, fileBytes: 1_048_576, totalBytes: 16_777_216, baselineBytes: 262_144, findings: 2048, timeout: 10_000, outputBytes: 1_048_576, depth: 10 })
const childMethods = new Set(['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork'])
const extensions = new Set(['.mjs', '.cjs', '.js', '.ts', '.py'])
const unknown = Symbol('unknown')
const help = 'docs/COMMAND-SAFETY.md#argument-arrays'
const sha = text => createHash('sha256').update(text).digest('hex')
const safePath = value => typeof value === 'string' && /^scripts\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:mjs|cjs|js|ts|py)$/.test(value) && !value.split('/').includes('..')
const shells = new Map([['sh', ['-c']], ['bash', ['-c']], ['zsh', ['-c']], ['ksh', ['-c']], ['dash', ['-c']], ['cmd', ['/c', '/k']], ['powershell', ['-command', '-encodedcommand', '-c']], ['pwsh', ['-command', '-encodedcommand', '-c']], ['python', ['-c']], ['python3', ['-c']], ['node', ['-e', '--eval', '-p', '--print']]])
const plain = node => { while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression; return node }

function fingerprint(node) {
  const tokens = []
  function walk(value) { tokens.push([value.kind, ts.isIdentifier(value) || ts.isStringLiteralLike(value) || ts.isNumericLiteral(value) || ts.isRegularExpressionLiteral(value) ? value.text : null]); ts.forEachChild(value, walk) }
  walk(node); return sha(JSON.stringify(tokens))
}

/** Pure AST scan. Results contain only locations, fixed kinds/rules and hashes. */
export function scanJavaScriptSource({ path, source }) {
  if (!safePath(path) || typeof source !== 'string' || Buffer.byteLength(source) > childProcessLimits.fileBytes) throw new Error('Script source exceeds the public input boundary.')
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, extname(path) === '.ts' ? ts.ScriptKind.TS : ts.ScriptKind.JS)
  const finding = (node, kind, rules, hash = fingerprint(node)) => { const at = file.getLineAndCharacterOfPosition(node.getStart(file)); return { path, line: at.line + 1, column: at.character + 1, kind, rules: [...new Set(rules)].sort(), fingerprint: hash } }
  if (file.parseDiagnostics.length) return file.parseDiagnostics.map(value => { const at = file.getLineAndCharacterOfPosition(value.start ?? 0); return { path, line: at.line + 1, column: at.character + 1, kind: 'javascript-parser', rules: ['parse-error'], fingerprint: null } })
  const scopes = new Map(), nodeScope = new Map(), calls = [], mutations = []
  function bind(scope, name, entry) { if (!name) return; const bindings = scopes.get(scope).bindings; if (bindings.has(name)) bindings.get(name).modified = true; else bindings.set(name, entry) }
  function names(scope, name, expression) {
    if (ts.isIdentifier(name)) bind(scope, name.text, { expression })
    else if (ts.isObjectBindingPattern(name)) for (const element of name.elements) if (ts.isIdentifier(element.name)) bind(scope, element.name.text, element.initializer ? { expression: element.initializer } : { expression, member: element.propertyName?.text ?? element.name.text })
  }
  function collect(node, parentScope) {
    const creates = node === file || ts.isFunctionLike(node) || ts.isBlock(node) || ts.isCatchClause(node)
    const scope = creates ? node : parentScope
    if (creates) scopes.set(scope, { parent: parentScope, bindings: new Map() })
    nodeScope.set(node, scope)
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const module = node.moduleSpecifier.text.replace(/^node:/, ''), clause = node.importClause
      if (clause?.name) bind(scope, clause.name.text, { module })
      const imported = clause?.namedBindings
      if (imported && ts.isNamespaceImport(imported)) bind(scope, imported.name.text, { module })
      else if (imported) for (const element of imported.elements) bind(scope, element.name.text, { module, member: element.propertyName?.text ?? element.name.text })
    }
    if (ts.isFunctionDeclaration(node) && node.name) bind(parentScope, node.name.text, {})
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) names(scope, node.name, node.initializer)
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) mutations.push(node.left)
    if (ts.isCallExpression(node)) calls.push(node)
    ts.forEachChild(node, child => collect(child, scope))
  }
  collect(file, null)
  function lookup(name, at) { let scope = nodeScope.get(at); while (scope) { const entry = scopes.get(scope); if (entry.bindings.has(name)) return entry.bindings.get(name); scope = entry.parent } return null }
  function rootName(node) { node = plain(node); while (node && (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) node = node.expression; return node && ts.isIdentifier(node) ? node : null }
  function markMutation(id, at, seen = new Set()) {
    const entry = id && lookup(id.text, at)
    if (!entry || seen.has(entry)) return
    seen.add(entry); entry.modified = true
    // const alias = options preserves object identity. Mutating either name
    // invalidates the originating object, not only the spelling at the write.
    const expression = plain(entry.expression)
    if (expression && ts.isIdentifier(expression)) markMutation(expression, expression, seen)
  }
  for (const left of mutations) markMutation(rootName(left), left)
  for (const call of calls) {
    const expression = plain(call.expression)
    if (ts.isPropertyAccessExpression(expression) && ['assign', 'defineProperty', 'defineProperties'].includes(expression.name.text) && ts.isIdentifier(expression.expression) && expression.expression.text === 'Object') markMutation(rootName(call.arguments[0]), call)
    if (ts.isPropertyAccessExpression(expression) && ['push', 'pop', 'splice', 'shift', 'unshift', 'sort', 'reverse', 'fill', 'copyWithin'].includes(expression.name.text)) markMutation(rootName(expression.expression), call)
  }
  function value(input, depth = 0, seen = new Set()) {
    const node = plain(input); if (!node || depth > 24) return unknown
    if (ts.isStringLiteralLike(node)) return node.text
    if (ts.isConditionalExpression(node)) { const yes = value(node.whenTrue, depth + 1, seen), no = value(node.whenFalse, depth + 1, seen); return typeof yes === 'string' && typeof no === 'string' ? { executables: [yes, no] } : unknown }
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false
    if (ts.isIdentifier(node)) {
      const binding = lookup(node.text, node); if (!binding || seen.has(binding)) return unknown
      const next = new Set(seen).add(binding)
      const base = binding.module ? { module: binding.module } : value(binding.expression, depth + 1, next)
      if (binding.modified) return base?.module === 'child_process' ? { module: base.module, member: 'unresolved', altered: true } : unknown
      return binding.member ? base?.module ? { module: base.module, member: binding.member } : unknown : base
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const base = value(node.expression, depth + 1, seen), member = ts.isPropertyAccessExpression(node) ? node.name.text : value(node.argumentExpression, depth + 1, seen)
      return base?.module ? { module: base.module, member: base.altered ? 'unresolved' : typeof member === 'string' ? member : 'unresolved' } : unknown
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require' && !lookup('require', node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) return { module: node.arguments[0].text.replace(/^node:/, '') }
      const callee = value(node.expression, depth + 1, seen)
      if (callee?.module === 'util' && callee.member === 'promisify' && node.arguments.length === 1) return value(node.arguments[0], depth + 1, seen)
      if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'Object' && node.expression.name.text === 'freeze') return value(node.arguments[0], depth + 1, seen)
    }
    if (ts.isArrayLiteralExpression(node)) {
      const array = []
      for (const element of node.elements) { if (ts.isSpreadElement(element)) { const items = value(element.expression, depth + 1, seen); if (!Array.isArray(items)) array.push(unknown); else array.push(...items) } else array.push(value(element, depth + 1, seen)) }
      return array
    }
    if (ts.isObjectLiteralExpression(node)) {
      let shell = false, shellPresent = false
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) { const options = value(property.expression, depth + 1, seen); if (options?.options === true) { if (options.shellPresent) { shell = options.shell; shellPresent = true } } else { shell = unknown; shellPresent = true } }
        else if ((ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) && (property.name?.text === 'shell' || ts.isComputedPropertyName(property.name) && value(property.name.expression, depth + 1, seen) === 'shell')) { shell = value(ts.isPropertyAssignment(property) ? property.initializer : property.name, depth + 1, seen); shellPresent = true }
        else if (property.name && (property.name.text === 'shell' || ts.isComputedPropertyName(property.name))) { shell = unknown; shellPresent = true }
      }
      return { options: true, shell, shellPresent }
    }
    return unknown
  }
  const results = []
  for (const call of calls) {
    const callee = value(call.expression)
    if (callee?.module !== 'child_process') continue
    const kind = childMethods.has(callee.member) ? callee.member : 'unresolved', rules = kind === 'unresolved' ? ['callee-indeterminate'] : [], args = call.arguments
    if (kind === 'exec' || kind === 'execSync') rules.push('implicit-shell')
    let argv = args.length < 2 ? [] : value(args[1]), options
    if (argv?.options === true) { options = argv; argv = [] } else options = args.length > 2 && !ts.isArrowFunction(args[2]) && !ts.isFunctionExpression(args[2]) ? value(args[2]) : { options: true, shell: false }
    if (options?.options !== true || options.shell !== false) rules.push(options?.shell === true ? 'shell-enabled' : 'options-indeterminate')
    if (!Array.isArray(argv)) rules.push(typeof argv === 'string' ? 'argv-string' : 'argv-indeterminate')
    const executable = value(args[0])
    const executables = typeof executable === 'string' ? [executable] : executable?.executables
    if (!executables) rules.push('executable-indeterminate')
    else for (const executable of executables) {
      const name = executable.replaceAll('\\', '/').split('/').at(-1).toLowerCase().replace(/\.exe$/, '')
      if (Array.isArray(argv) && shells.has(name) && argv.some(arg => typeof arg === 'string' && shells.get(name).includes(arg.toLowerCase()))) rules.push('interpreter-string')
    }
    if (rules.length) results.push(finding(call, `javascript:${kind}`, rules))
  }
  return results
}

/** Only the fixed owned stdlib parser is executed; its stdin is source data. */
export function scanPythonSources(files, { run = spawnSync, python = process.platform === 'win32' ? 'python' : 'python3' } = {}) {
  const request = JSON.stringify({ files })
  if (files.some(file => !safePath(file.path) || typeof file.source !== 'string' || Buffer.byteLength(file.source) > childProcessLimits.fileBytes) || Buffer.byteLength(request) > childProcessLimits.totalBytes || files.length > childProcessLimits.files) throw new Error('Python source exceeds the public input boundary.')
  const environment = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHON_MANAGER_AUTOMATIC_INSTALL: 'false' }
  delete environment.PYLAUNCHER_ALLOW_INSTALL; delete environment.PYLAUNCHER_ALWAYS_INSTALL
  const result = run(python, ['-I', '-B', fileURLToPath(new URL('./child-process-python.py', import.meta.url))], { shell: false, timeout: childProcessLimits.timeout, maxBuffer: childProcessLimits.outputBytes, input: request, encoding: 'utf8', windowsHide: true, env: environment })
  if (result.error || result.status !== 0 || result.signal) throw new Error('The bounded Python AST parser is unavailable or failed.')
  let response; try { response = JSON.parse(result.stdout) } catch { throw new Error('The bounded Python AST parser returned invalid data.') }
  if (response.parser !== 'python-ast-v1' || !Array.isArray(response.findings) || response.findings.length > childProcessLimits.findings) throw new Error('The bounded Python AST parser returned invalid data.')
  return response.findings
}

const key = value => `${value.path}|${value.kind}|${value.fingerprint}`
export function buildChildProcessReport(findings, baseline) {
  if (!Array.isArray(findings) || findings.length > childProcessLimits.findings || findings.some(item => !item || !safePath(item.path) || !Number.isSafeInteger(item.line) || item.line < 1 || !Number.isSafeInteger(item.column) || item.column < 1 || !/^(?:javascript:(?:exec|execSync|execFile|execFileSync|spawn|spawnSync|fork|unresolved)|python:(?:subprocess|os|asyncio)\.[A-Za-z_]+|javascript-parser|python-parser)$/.test(item.kind) || !Array.isArray(item.rules) || !item.rules.length || item.rules.some(rule => !['implicit-shell','shell-enabled','options-indeterminate','argv-string','argv-indeterminate','executable-indeterminate','interpreter-string','callee-indeterminate','parse-error'].includes(rule)) || !(item.fingerprint === null && item.rules.includes('parse-error') || /^[a-f0-9]{64}$/.test(item.fingerprint)))) throw new Error('Child-process findings are invalid or exceed their bound.')
  const exact = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === keys.length && keys.every(name => Object.hasOwn(value, name))
  if (!exact(baseline, ['schemaVersion', 'fingerprintFormat', 'sourceRevision', 'exceptions']) || baseline.schemaVersion !== 1 || baseline.fingerprintFormat !== 'typescript-structure-v1+python-ast-v1' || !/^[a-f0-9]{40}$/.test(baseline.sourceRevision) || !Array.isArray(baseline.exceptions) || baseline.exceptions.length > 256) throw new Error('The reviewed child-process baseline is invalid.')
  const exceptions = new Map()
  for (const item of baseline.exceptions) {
    if (!exact(item, ['path', 'kind', 'fingerprint', 'count', 'reason']) || !safePath(item.path) || !/^(?:javascript:(?:exec|execSync|execFile|execFileSync|spawn|spawnSync|fork|unresolved)|python:(?:subprocess|os|asyncio)\.[A-Za-z_]+)$/.test(item.kind) || !/^[a-f0-9]{64}$/.test(item.fingerprint) || !Number.isSafeInteger(item.count) || item.count < 1 || item.count > 100 || typeof item.reason !== 'string' || item.reason.length < 12 || item.reason.length > 300 || /[\x00-\x1f\x7f]/.test(item.reason) || exceptions.has(key(item))) throw new Error('The reviewed child-process baseline is invalid.')
    exceptions.set(key(item), item)
  }
  const seen = new Map(), diagnostics = []
  for (const item of findings) {
    const id = key(item), count = (seen.get(id) ?? 0) + 1; seen.set(id, count)
    const allowed = item.fingerprint && exceptions.get(id)
    if (!allowed || count > allowed.count) diagnostics.push({ path: item.path, line: item.line, column: item.column, kind: item.kind, rules: item.rules, status: allowed ? 'baseline-count-exceeded' : 'review-required', help })
  }
  for (const [id, item] of exceptions) if ((seen.get(id) ?? 0) !== item.count) diagnostics.push({ path: item.path, line: 1, column: 1, kind: item.kind, rules: ['baseline-drift'], status: 'baseline-count-mismatch', help })
  return { schemaVersion: 1, ok: diagnostics.length === 0, scope: 'Maintained scripts JS/TS and Python AST call sites only; no scanned execution/import, shell-script parsing or complete security proof. Review unresolved construction; prefer executable plus argument arrays.', counts: { findings: findings.length, reviewedOccurrences: [...exceptions.values()].reduce((sum, item) => sum + item.count, 0), diagnostics: diagnostics.length }, diagnostics }
}

export function parseChildProcessBaseline(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > childProcessLimits.baselineBytes) throw new Error('The reviewed child-process baseline is invalid.')
  const syntax = ts.parseJsonText('baseline.json', text)
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const names = new Set()
      for (const property of node.properties) { const name = property.name?.text; if (names.has(name)) throw new Error('The reviewed child-process baseline is invalid.'); names.add(name) }
    }
    ts.forEachChild(node, visit)
  }
  visit(syntax)
  try { return JSON.parse(text) } catch { throw new Error('The reviewed child-process baseline is invalid.') }
}

export async function readChildProcessReport(repositoryRoot = root) {
  const files = [], sources = []; let total = 0, entries = 0
  async function visit(folder, depth) {
    if (depth > childProcessLimits.depth) throw new Error('Script inventory exceeds its public depth bound.')
    for (const item of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (++entries > 2048) throw new Error('Script inventory exceeds its entry bound.')
      if (['node_modules', '__pycache__', '.git', 'dist', 'coverage', 'local', 'logs', 'state', 'Temp', 'Backup'].includes(item.name)) continue
      const absolute = join(folder, item.name), info = await lstat(absolute)
      if (info.isSymbolicLink()) throw new Error('Script inventory refuses symbolic links.')
      if (info.isDirectory()) await visit(absolute, depth + 1)
      else if (info.isFile() && extensions.has(extname(item.name))) {
        const path = relative(repositoryRoot, absolute).replaceAll('\\', '/')
        if (!safePath(path) || info.size > childProcessLimits.fileBytes || files.length >= childProcessLimits.files) throw new Error('Script inventory exceeds its public input bounds.')
        const bytes = await readFile(absolute)
        if (bytes.length > childProcessLimits.fileBytes || (total += bytes.length) > childProcessLimits.totalBytes) throw new Error('Script inventory exceeds its public input bounds.')
        files.push(path); sources.push({ path, source: bytes.toString('utf8') })
      }
    }
  }
  const scripts = join(repositoryRoot, 'scripts'), scriptsInfo = await lstat(scripts)
  if (scriptsInfo.isSymbolicLink()) throw new Error('Script inventory refuses symbolic links.')
  if (!scriptsInfo.isDirectory()) throw new Error('Script inventory root is unavailable.')
  await visit(scripts, 0)
  const baselinePath = join(repositoryRoot, 'scripts/child-process-baseline.json'), stat = await lstat(baselinePath)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > childProcessLimits.baselineBytes) throw new Error('The reviewed child-process baseline is unavailable.')
  let baseline; try { baseline = parseChildProcessBaseline(await readFile(baselinePath, 'utf8')) } catch { throw new Error('The reviewed child-process baseline is invalid.') }
  const findings = sources.filter(file => extname(file.path) !== '.py').flatMap(scanJavaScriptSource)
  const python = sources.filter(file => extname(file.path) === '.py')
  if (python.length) findings.push(...scanPythonSources(python))
  return { ...buildChildProcessReport(findings, baseline), files, parsers: ['typescript-structure-v1', 'python-ast-v1'], excluded: ['.sh entry points', 'managed releases', 'vendor/research', 'generated/runtime/private files'] }
}

export async function runChildProcessCli(args, { stdout = process.stdout, stderr = process.stderr } = {}) {
  if (args.some(arg => !['--json', '--check', '--help'].includes(arg)) || new Set(args).size !== args.length) { stderr.write('Usage: node scripts/check-child-processes.mjs [--check] [--json]\n'); return 2 }
  if (args.includes('--help')) { stdout.write('Read-only maintained script AST review. Prefer executable plus argument arrays; see docs/COMMAND-SAFETY.md. No baseline-writing mode.\n'); return 0 }
  try {
    const report = await readChildProcessReport()
    stdout.write(args.includes('--json') ? JSON.stringify(report, null, 2) + '\n' : `Child-process source review: ${report.ok ? 'PASS' : 'REVIEW REQUIRED'}; ${report.files.length} files, ${report.counts.findings} bounded findings.\n${report.diagnostics.map(item => `${item.path}:${item.line}:${item.column} ${item.status} ${item.rules.join(',')} — ${item.help}`).join('\n')}\n${report.scope}\n`)
    return report.ok ? 0 : 1
  } catch { stderr.write('Child-process source review refused invalid, unavailable or over-bound public input.\n'); return 1 }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await runChildProcessCli(process.argv.slice(2))
