// Read authored syntax only. Module resolution and path confinement belong to
// the tracked inventory caller; this module never opens or imports app files.
const maxSyntaxNodes = 32_000
const maxFindings = 512

export function publicPattern(value) {
  if (value === '*') return true
  if (typeof value !== 'string' || value.length > 200 || !value.startsWith('/')) return false
  if (value === '/') return true
  if (/^\/(?:Users|Volumes|private|home|mnt|tmp)(?:\/|$)/.test(value)) return false
  return value.slice(1).split('/').every((part, index, segments) =>
    (part === '*' || part === '') ? index === segments.length - 1
      : /^(?:[A-Za-z0-9_-]{1,64}|:[A-Za-z_][A-Za-z0-9_]{0,40}\??)$/.test(part)
        && !/^(?:gh[pousr]_|github_pat_|sk-|AKIA[A-Z0-9])/i.test(part))
}

export function inspectDeclaredRoutes({ sourcePath, source, ts, resolveImport, route, unresolved }) {
  const unsupported = (code, line = 1) => unresolved({ code, line })
  let file
  try {
    file = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  } catch {
    unsupported('invalid-route-syntax')
    return { recognized: false }
  }
  if (file.parseDiagnostics.length) {
    unsupported('invalid-route-syntax')
    return { recognized: false }
  }

  const nodes = []
  const stack = [file]
  while (stack.length) {
    const node = stack.pop()
    nodes.push(node)
    if (nodes.length > maxSyntaxNodes) {
      unsupported('route-syntax-limit')
      return { recognized: false }
    }
    ts.forEachChild(node, child => { stack.push(child) })
  }
  const imports = new Map()
  const routers = new Set()
  const routes = new Set()
  const shadowed = new Set()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const clause = statement.importClause
    if (!clause || clause.isTypeOnly) continue
    const specifier = statement.moduleSpecifier.text
    const add = (name, imported) => {
      if (imports.has(name)) shadowed.add(name)
      imports.set(name, specifier)
      if (specifier !== 'react-router' && specifier !== 'react-router-dom') return
      if (imported === 'Routes') routers.add(name)
      if (imported === 'Route') routes.add(name)
    }
    if (clause.name) add(clause.name.text, 'default')
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const item of clause.namedBindings.elements) {
        if (!item.isTypeOnly) add(item.name.text, (item.propertyName ?? item.name).text)
      }
    }
  }
  for (const node of nodes) {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)
      || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name
      && ts.isIdentifier(node.name) && imports.has(node.name.text)) shadowed.add(node.name.text)
  }

  const findings = []
  const candidates = []
  let overflow = false
  let recognized = false
  const lineOf = node => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
  function addFinding(list, item) {
    if (findings.length + candidates.length >= maxFindings) overflow = true
    else list.push(item)
  }
  const issue = (node, code) => addFinding(findings, { line: lineOf(node), code })
  function unwrap(node) {
    while (node && ts.isParenthesizedExpression(node)) node = node.expression
    return node
  }
  function tagOf(node) {
    if (!node) return null
    const opening = ts.isJsxElement(node) ? node.openingElement : node
    return (ts.isJsxOpeningElement(opening) || ts.isJsxSelfClosingElement(opening))
      && ts.isIdentifier(opening.tagName) ? opening.tagName.text : null
  }
  function record(node, pattern, expression) {
    if (!publicPattern(pattern)) return issue(node, 'dynamic-route-pattern')
    const tag = tagOf(unwrap(expression))
    const specifier = imports.get(tag)
    const path = specifier && !shadowed.has(tag) ? resolveImport(specifier) : null
    if (!path) return issue(node, 'unresolved-route-module')
    addFinding(candidates, { pattern, source: path, line: lineOf(node) })
  }
  function directReturn(statement) {
    if (ts.isBlock(statement) && statement.statements.length === 1) statement = statement.statements[0]
    return ts.isReturnStatement(statement) ? statement.expression : null
  }
  function inspectSwitch(statement) {
    let pending = []
    for (const clause of statement.caseBlock.clauses) {
      pending.push(clause)
      if (!clause.statements.length) continue
      const target = clause.statements.length === 1 && directReturn(clause.statements[0])
      for (const item of pending) {
        if (!target) issue(item, 'ambiguous-route-branch')
        else if (ts.isDefaultClause(item)) record(item, '*', target)
        else record(item, ts.isStringLiteral(item.expression) ? item.expression.text : null, target)
      }
      pending = []
    }
    for (const item of pending) issue(item, 'ambiguous-route-branch')
  }
  function ifPatterns(expression, parameter) {
    const todo = [expression], result = []
    const isPathname = node => ts.isIdentifier(node) && node.text === parameter
    while (todo.length) {
      const node = unwrap(todo.pop())
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        todo.push(node.right, node.left)
      } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
        && isPathname(node.left) && ts.isStringLiteral(node.right)) result.push({ node, pattern: node.right.text })
      else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && isPathname(node.expression.expression) && node.expression.name.text === 'startsWith' && node.arguments.length === 1
        && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.endsWith('/')) result.push({ node, pattern: node.arguments[0].text + '*' })
      else return null
    }
    return result
  }
  for (const fn of file.statements) {
    if (!ts.isFunctionDeclaration(fn) || fn.name?.text !== 'renderPage' || !fn.body) continue
    recognized = true
    const parameter = fn.parameters[0]?.name
    if (!parameter || !ts.isIdentifier(parameter) || parameter.text !== 'pathname') { issue(fn, 'dynamic-route-dispatch'); continue }
    for (const statement of fn.body.statements) {
      if (ts.isSwitchStatement(statement) && ts.isIdentifier(statement.expression) && statement.expression.text === parameter.text) {
        inspectSwitch(statement)
      } else if (ts.isIfStatement(statement) && !statement.elseStatement) {
        const paths = ifPatterns(statement.expression, parameter.text)
        const target = directReturn(statement.thenStatement)
        if (paths && target) for (const { node, pattern } of paths) record(node, pattern, target)
        else issue(statement, 'dynamic-route-dispatch')
      } else {
        issue(statement, 'dynamic-route-dispatch')
        // Subsequent statements may be unreachable or use a redefined pathname.
        break
      }
    }
  }

  for (const router of nodes) {
    if (!ts.isJsxElement(router)) continue
    const routerName = tagOf(router)
    if (!routers.has(routerName)) continue
    recognized = true
    if (shadowed.has(routerName)) { issue(router, 'ambiguous-route-branch'); continue }
    let nested = false
    for (let ancestor = router.parent; ancestor; ancestor = ancestor.parent) {
      if (routers.has(tagOf(ancestor)) || routes.has(tagOf(ancestor)) || ts.isJsxExpression(ancestor)
        || ts.isConditionalExpression(ancestor) || ts.isIfStatement(ancestor) || ts.isCallExpression(ancestor)) {
        nested = true
        break
      }
    }
    if (nested) { issue(router, 'nested-route-declaration'); continue }
    for (const child of router.children) {
      if (ts.isJsxText(child) && !child.text.trim() || ts.isJsxExpression(child) && !child.expression) continue
      const tag = tagOf(child)
      if (!routes.has(tag) || shadowed.has(tag)) { issue(child, 'dynamic-route-dispatch'); continue }
      if (!ts.isJsxSelfClosingElement(child)) { issue(child, 'nested-route-declaration'); continue }
      const attrs = child.attributes.properties
      const fields = new Map()
      for (const attr of attrs) {
        if (!ts.isJsxAttribute(attr) || fields.has(attr.name.getText(file))) break
        fields.set(attr.name.getText(file), attr.initializer)
      }
      const path = fields.get('path'), element = fields.get('element')
      if (fields.size !== attrs.length) { issue(child, 'ambiguous-route-branch'); continue }
      record(child, path && ts.isStringLiteral(path) ? path.text : null,
        element && ts.isJsxExpression(element) ? element.expression : null)
    }
  }
  if (overflow) {
    unsupported('route-finding-limit')
    return { recognized }
  }
  const counts = new Map()
  for (const { pattern } of candidates) counts.set(pattern, (counts.get(pattern) ?? 0) + 1)
  for (const item of candidates) {
    if (counts.get(item.pattern) === 1) route(item)
    else unsupported('ambiguous-route-pattern', item.line)
  }
  for (const item of findings) unresolved(item)
  return { recognized }
}
