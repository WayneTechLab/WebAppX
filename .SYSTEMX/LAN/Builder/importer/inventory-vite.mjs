// Inspect the authored build configuration without loading Vite or its plugins.
export function readViteInputs({ ts, sourcePath, source }) {
  if (typeof source !== 'string' || source.length > 256_000) return { unresolved: { code: 'vite-config-limit', line: 1 } }
  let file
  try {
    file = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  } catch {
    return { unresolved: { code: 'invalid-vite-config', line: 1 } }
  }
  const line = offset => file.getLineAndCharacterOfPosition(offset).line + 1
  if (file.parseDiagnostics.length) return { unresolved: { code: 'invalid-vite-config', line: line(file.parseDiagnostics[0].start ?? 0) } }

  const helpers = new Set(), defaults = []
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
      && statement.moduleSpecifier.text === 'vite' && !statement.importClause?.isTypeOnly) {
      const bindings = statement.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const item of bindings.elements) {
          if (!item.isTypeOnly && (item.propertyName ?? item.name).text === 'defineConfig') helpers.add(item.name.text)
        }
      }
    }
    if ((ts.isExportAssignment(statement) && !statement.isExportEquals)
      || statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)) defaults.push(statement)
    else if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)
      && statement.exportClause.elements.some(item => item.name.text === 'default')) defaults.push(statement)
  }
  const refuse = (code, node) => ({ unresolved: { code, line: node ? line(node.getStart(file)) : 1 } })
  if (defaults.length !== 1 || !ts.isExportAssignment(defaults[0])) return refuse('dynamic-vite-config', defaults.at(-1))
  function unwrap(node) {
    while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression
    return node
  }
  let config = unwrap(defaults[0].expression)
  if (ts.isCallExpression(config) && ts.isIdentifier(config.expression) && helpers.has(config.expression.text) && config.arguments.length === 1) {
    config = unwrap(config.arguments[0])
  }
  function fields(expression) {
    if (!ts.isObjectLiteralExpression(expression)) return refuse('dynamic-vite-config', expression)
    const values = new Map()
    for (const prop of expression.properties) {
      if (!prop.name || !(ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name))) {
        return refuse('dynamic-vite-config', prop)
      }
      if (values.has(prop.name.text)) return refuse('duplicate-vite-declaration', prop)
      values.set(prop.name.text, prop)
    }
    return { values }
  }
  const literal = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
  const get = prop => ts.isPropertyAssignment(prop) ? unwrap(prop.initializer) : prop
  let section = fields(config)
  if (section.unresolved) return section
  const root = section.values.get('root')
  if (root && !(literal(get(root)) && ['.', './'].includes(get(root).text))) return refuse('unsupported-vite-root', root)
  for (const key of ['environments', 'builder']) {
    if (section.values.has(key)) return refuse('unsupported-vite-build-mode', section.values.get(key))
  }
  for (const key of ['build', 'rollupOptions']) {
    const prop = section.values.get(key)
    if (!prop) return { inputs: null }
    section = fields(get(prop))
    if (section.unresolved) return section
    if (key === 'build') {
      for (const mode of ['lib', 'ssr', 'rolldownOptions']) {
        const alternative = section.values.get(mode)
        if (alternative && get(alternative).kind !== ts.SyntaxKind.FalseKeyword) return refuse('unsupported-vite-build-mode', alternative)
      }
    }
  }
  const input = section.values.get('input')
  if (!input) return { inputs: null }
  const node = get(input)
  let entries
  if (ts.isArrayLiteralExpression(node)) entries = node.elements
  else if (ts.isObjectLiteralExpression(node)) {
    const named = fields(node)
    if (named.unresolved) return named
    entries = [...named.values.values()].map(get)
  } else entries = [node]
  if (entries.length === 0 || entries.length > 32) return refuse('vite-input-count', node)
  const inputs = [], seen = new Set()
  for (const entry of entries) {
    const value = unwrap(entry)
    if (!literal(value) || !value.text || value.text.length > 250 || /[\x00-\x1f\x7f]/.test(value.text)) return refuse('dynamic-vite-input', value)
    if (seen.has(value.text)) return refuse('duplicate-vite-declaration', value)
    seen.add(value.text)
    inputs.push({ specifier: value.text, line: line(value.getStart(file)) })
  }
  return { inputs }
}
