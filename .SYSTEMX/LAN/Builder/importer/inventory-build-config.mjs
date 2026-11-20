// Describe reviewed literals in Vite's authored configuration. Never load Vite,
// its plugins, the project's modules or the environment named in that file.
const configName = /^vite\.config\.(?:js|cjs|mjs|ts|cts|mts)$/
const loopbackHosts = ['127.0.0.1', 'localhost', '::1']
const defaults = { 'build.outDir': 'dist', 'build.assetsDir': 'assets', publicDir: 'public' }
const directoryWords = new Set('app asset assets build bundle client compiled deploy dist distribution frontend generated html media out output public release resources site static web website www wwwroot'.split(' '))
export function publicDirectory(value) {
  return typeof value === 'string' && value.length <= 100 && value.split('/').length <= 4
    && value.split('/').every(part => part.split('-').every(word => directoryWords.has(word)))
}
const exact = (row, keys) => row && typeof row === 'object' && !Array.isArray(row)
  && Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key))
const bridgeFields = ['field', 'route', 'state', 'listener', 'target', 'portSource', 'rewrite', 'preview', 'line', 'evidence']
export function validBuildConfig(buildTargets, bridges, validEvidence) {
  const located = row => Number.isSafeInteger(row.line) && row.line >= 1 && row.line <= 256_001
    && row.evidence && typeof row.evidence.path === 'string' && configName.test(row.evidence.path) && validEvidence(row.evidence)
  if (!Array.isArray(buildTargets) || buildTargets.length > 3 || !Array.isArray(bridges) || bridges.length > 1) return false
  const seen = new Set()
  for (const row of buildTargets) {
    if (!row || typeof row.field !== 'string' || !Object.hasOwn(defaults, row.field) || seen.has(row.field) || !located(row)) return false
    seen.add(row.field)
    if (row.state === 'unresolved' || row.state === 'disabled') {
      if (!exact(row, ['state', 'field', 'evidence', 'line']) || row.state === 'disabled' && row.field !== 'publicDir') return false
    } else if (!exact(row, ['state', 'field', 'directory', 'evidence', 'line']) || !publicDirectory(row.directory)
      || !(row.state === 'declared' || row.state === 'inferred' && row.directory === defaults[row.field])) return false
  }
  return bridges.every(row => exact(row, bridgeFields) && located(row) && row.field === 'server.proxy' && row.route === '/__systemx'
    && ['declared', 'unresolved'].includes(row.state) && ['loopback-literal', 'not-declared', 'unresolved', 'non-loopback'].includes(row.listener)
    && ['loopback-literal', 'loopback-prefix', 'unresolved'].includes(row.target)
    && ['literal', 'http-default', 'environment-fallback', 'unresolved'].includes(row.portSource)
    && ['strip-prefix', 'not-declared', 'unresolved'].includes(row.rewrite)
    && ['inherits-server-proxy', 'explicit-empty-proxy', 'unresolved'].includes(row.preview)
    && (row.target === 'loopback-literal' ? ['literal', 'http-default'].includes(row.portSource)
      : row.target === 'loopback-prefix' ? row.portSource === 'environment-fallback' : row.portSource === 'unresolved')
    && (row.state === 'unresolved' || ![row.target, row.listener, row.preview, row.rewrite].includes('unresolved')))
}

export function inspectBuildConfig({ ts, path, source, evidence, issue }) {
  const buildTargets = [], bridges = []
  const result = { buildTargets, bridges }
  if (typeof path !== 'string' || !configName.test(path)) { issue('unsupported-vite-config-name'); return result }
  if (!exact(evidence, ['path', 'sha256']) || evidence.path !== path || typeof evidence.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(evidence.sha256)) {
    issue('invalid-vite-config-evidence', path, 1); return result
  }
  if (typeof source !== 'string' || Buffer.byteLength(source) > 256_000) { issue('vite-config-limit', path, 1); return result }
  let file
  try { file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS) }
  catch { issue('invalid-vite-config', path, 1); return result }
  if (file.parseDiagnostics.length) { issue('invalid-vite-config', path, 1); return result }
  const line = node => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
  const finding = (code, node) => issue(code, path, node ? line(node) : 1)
  const literal = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null
  const unwrap = node => {
    while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression
    return node
  }
  // An unknown spread/computed name can override a literal on the same object.
  function properties(node) {
    if (!node || !ts.isObjectLiteralExpression(node) || node.properties.length > 128) return null
    const map = new Map()
    for (const prop of node.properties) {
      const key = prop.name
      if (!key || !(ts.isIdentifier(key) || ts.isStringLiteral(key)) || key.text === '__proto__' || map.has(key.text)) return null
      map.set(key.text, ts.isPropertyAssignment(prop) ? unwrap(prop.initializer) : prop)
    }
    return map
  }

  const helpers = new Set(), constValues = new Map(), exported = []
  for (const stmt of file.statements) {
    if (ts.isImportDeclaration(stmt) && literal(stmt.moduleSpecifier) === 'vite' && !stmt.importClause?.isTypeOnly) {
      const bindings = stmt.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) {
        if (!item.isTypeOnly && (item.propertyName ?? item.name).text === 'defineConfig') helpers.add(item.name.text)
      }
    }
    if (ts.isVariableStatement(stmt) && stmt.declarationList.flags & ts.NodeFlags.Const) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) constValues.set(decl.name.text, constValues.has(decl.name.text) ? null : unwrap(decl.initializer))
      }
    }
    if (ts.isExportAssignment(stmt) || stmt.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)
      || (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)
        && stmt.exportClause.elements.some(element => element.name.text === 'default'))) exported.push(stmt)
  }
  const def = exported.length === 1 && exported[0]
  let node = def && ts.isExportAssignment(def) && !def.isExportEquals ? unwrap(def.expression) : undefined
  if (node && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && helpers.has(node.expression.text) && node.arguments.length === 1) node = unwrap(node.arguments[0])
  const config = properties(node)
  if (!config) { finding('dynamic-vite-workspace-config', def); return result }
  if (config.has('root') && !['.', './'].includes(literal(config.get('root')))) {
    finding('unsupported-vite-directory-root', config.get('root')); return result
  }

  function directory(field, parts, key, parent) {
    const value = parts?.get(key)
    const row = { field, evidence, line: line(value ?? parent) }
    if (parts && !value) buildTargets.push({ ...row, state: 'inferred', directory: defaults[field] })
    else if (field === 'publicDir' && value?.kind === ts.SyntaxKind.FalseKeyword) buildTargets.push({ ...row, state: 'disabled' })
    else {
      const relative = literal(value)?.replace(/^\.\//, '').replace(/\/$/, '')
      if (publicDirectory(relative)) buildTargets.push({ ...row, state: 'declared', directory: relative })
      else {
        buildTargets.push({ ...row, state: 'unresolved' })
        finding('unsupported-vite-directory-declaration', value ?? parent)
      }
    }
  }

  const buildNode = config.get('build')
  let build = buildNode ? properties(buildNode) : new Map()
  const rollup = build?.has('rollupOptions') ? properties(build.get('rollupOptions')) : new Map()
  const output = rollup?.has('output') ? properties(rollup.get('output')) : new Map()
  if (config.has('environments') || config.has('builder') || build?.has('rolldownOptions')
    || ['lib', 'ssr'].some(key => build?.has(key) && build.get(key).kind !== ts.SyntaxKind.FalseKeyword)
    || !rollup || !output || output.has('dir') || output.has('file')) {
    finding('unsupported-vite-build-mode', buildNode ?? node)
    build = null
  }
  directory('build.outDir', build, 'outDir', buildNode ?? node)
  directory('build.assetsDir', build, 'assetsDir', buildNode ?? node)
  directory('publicDir', config, 'publicDir', node)

  // Preview can declare a proxy even when there is no development server proxy.
  let preview = 'inherits-server-proxy'
  const previewNode = config.get('preview')
  const settings = properties(previewNode)
  if (previewNode) {
    if (!settings || settings.has('proxy')) {
      const previewProxy = settings?.get('proxy')
      const routes = properties(previewProxy)
      preview = routes?.size === 0 ? 'explicit-empty-proxy' : 'unresolved'
      if (preview === 'unresolved') {
        const bridge = routes?.get('/__systemx')
        finding(bridge ? 'unsupported-vite-preview-bridge' : 'unsupported-vite-preview-proxy', bridge ?? previewProxy ?? previewNode)
      }
    }
  }

  const serverNode = config.get('server')
  if (!serverNode) return result
  const server = properties(serverNode)
  if (!server) { finding('unsupported-vite-server-config', serverNode); return result }
  const proxyNode = server.get('proxy')
  if (!proxyNode) return result
  const proxy = properties(proxyNode)
  if (!proxy) { finding('unsupported-vite-proxy-config', proxyNode); return result }
  const otherRoutes = [...proxy.keys()].some(key => key !== '/__systemx')
  if (otherRoutes) finding('unsupported-vite-proxy-route', proxyNode)
  const bridgeNode = proxy.get('/__systemx')
  if (!bridgeNode) return result
  const previewHost = settings?.get('host')
  if (preview === 'inherits-server-proxy' && previewHost && !loopbackHosts.includes(literal(previewHost))) {
    preview = 'unresolved'
    finding('unsupported-vite-preview-host', previewHost)
  }
  const options = properties(bridgeNode)
  const target = options?.get('target') ?? bridgeNode
  let targetKind = 'unresolved', portSource = 'unresolved'
  const raw = literal(target)
  const address = raw?.match(/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::([1-9]\d{0,4}))?\/?$/)
  if (address && (!address[1] || Number(address[1]) <= 65535)) {
    targetKind = 'loopback-literal'; portSource = address[1] ? 'literal' : 'http-default'
  } else if (ts.isTemplateExpression(target) && /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):$/.test(target.head.text)
    && target.templateSpans.length === 1 && ['', '/'].includes(target.templateSpans[0].literal.text)) {
    const port = unwrap(target.templateSpans[0].expression)
    const def = port && ts.isIdentifier(port) && constValues.get(port.text)
    if (def && ts.isBinaryExpression(def) && def.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      && ts.isPropertyAccessExpression(def.left) && ts.isPropertyAccessExpression(def.left.expression)
      && ts.isIdentifier(def.left.expression.expression) && def.left.expression.expression.text === 'process'
      && def.left.expression.name.text === 'env' && def.left.name.text === 'SYSTEMX_LAN_PORT'
      && /^[1-9]\d{0,4}$/.test(literal(def.right) ?? '') && Number(literal(def.right)) <= 65535) {
      targetKind = 'loopback-prefix'; portSource = 'environment-fallback'
    }
  }
  const host = server.get('host')
  const listener = !host ? 'not-declared' : loopbackHosts.includes(literal(host)) ? 'loopback-literal'
    : literal(host) !== null || host.kind === ts.SyntaxKind.TrueKeyword ? 'non-loopback' : 'unresolved'
  let rewrite = 'not-declared'
  const replacement = options?.get('rewrite')
  if (replacement) {
    rewrite = 'unresolved'
    if (ts.isArrowFunction(replacement) && replacement.parameters.length === 1 && ts.isIdentifier(replacement.parameters[0].name)) {
      const param = replacement.parameters[0].name.text, call = unwrap(replacement.body)
      if (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression)
        && ts.isIdentifier(call.expression.expression) && call.expression.expression.text === param && call.expression.name.text === 'replace'
        && call.arguments.length === 2 && call.arguments[0].kind === ts.SyntaxKind.RegularExpressionLiteral
        && call.arguments[0].text === '/^\\/__systemx\\/?/' && literal(call.arguments[1]) === '/') rewrite = 'strip-prefix'
    }
  }
  const changeOrigin = options?.get('changeOrigin')
  const ambiguous = otherRoutes || options && ([...options.keys()].some(key => !['target', 'changeOrigin', 'rewrite'].includes(key))
    || changeOrigin && ![ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(changeOrigin.kind))
  const state = ambiguous || [targetKind, listener, rewrite, preview].includes('unresolved') ? 'unresolved' : 'declared'
  if (state === 'unresolved') finding('unsupported-vite-bridge-declaration', bridgeNode)
  bridges.push({ field: 'server.proxy', route: '/__systemx', state, listener, target: targetKind, portSource, rewrite, preview,
    line: line(bridgeNode), evidence })
  return result
}
