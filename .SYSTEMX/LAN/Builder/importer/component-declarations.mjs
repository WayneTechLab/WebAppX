// Static syntax evidence. Import specifiers are internal resolution inputs;
// the inventory caller decides which tracked paths may be read or reported.
const safeName = value => typeof value === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/.test(value)
  && !/(?:gh[pousr]_|github_pat_|sk_live_|AKIA[A-Z0-9])/i.test(value)
const componentName = value => value === 'default' || value === 'renderPage' || safeName(value) && /^[A-Z]/.test(value)
const roleByTag = new Map([['header', 'header'], ['footer', 'footer'], ['nav', 'navigation']])

export function inspectComponentModule({ ts, path, source }) {
  const result = { imports: [], exports: [], components: [], roots: [], findings: [] }
  let file, count = 0, visits = 0
  const limit = {}
  function add(list, item) {
    if (++count > 3_000) throw limit
    list.push(item)
  }
  const line = node => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
  const report = (code, node) => add(result.findings, { code, line: line(node) })
  const unwrap = node => {
    while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
      || ts.isNonNullExpression(node))) node = node.expression
    return node
  }
  const imports = new Map(), definitions = new Map(), aliases = new Map(), variables = new Map(), pendingExports = []
  const bound = new Set(), duplicates = new Set()
  function bind(name, node) {
    if (!safeName(name)) return false
    if (bound.has(name)) { duplicates.add(name); report('ambiguous-component-binding', node); return false }
    bound.add(name)
    return true
  }
  function addImport(local, imported, specifier, node) {
    if (!bind(local, node) || !(imported === '*' || safeName(imported))) return
    if (!/^[A-Za-z0-9@._/-]{1,200}$/.test(specifier)) return
    const row = { local, imported, specifier, line: line(node) }
    imports.set(local, row)
    add(result.imports, row)
  }
  function packageMember(expr, packages, member) {
    if (!expr) return false
    const name = ts.isIdentifier(expr) ? expr.text
      : ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && expr.name.text === member
        ? expr.expression.text : null
    const entry = imports.get(name)
    return entry && !duplicates.has(name) && packages.includes(entry.specifier)
      && (ts.isIdentifier(expr) ? entry.imported === member : ['*', 'default'].includes(entry.imported))
  }
  function exported(name, local, node) {
    if (safeName(name) && safeName(local) && (componentName(name) || componentName(local))) pendingExports.push({ name, local, node })
  }
  const modifiers = (node, kind) => node.modifiers?.some(modifier => modifier.kind === kind)
  function declare(name, node, kind, statement) {
    if (!bind(name, node)) return
    definitions.set(name, { node, kind })
    if (statement && modifiers(statement, ts.SyntaxKind.ExportKeyword)) {
      exported(modifiers(statement, ts.SyntaxKind.DefaultKeyword) ? 'default' : name, name, statement)
    }
  }

  function collect(statement) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause, specifier = statement.moduleSpecifier.text
      if (!clause || clause.isTypeOnly) return
      if (clause.name) addImport(clause.name.text, 'default', specifier, clause.name)
      const bindings = clause.namedBindings
      if (bindings && ts.isNamespaceImport(bindings)) addImport(bindings.name.text, '*', specifier, bindings)
      if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) {
        if (!item.isTypeOnly) addImport(item.name.text, (item.propertyName ?? item.name).text, specifier, item)
      }
    } else if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      const name = statement.name?.text ?? (modifiers(statement, ts.SyntaxKind.DefaultKeyword) ? 'default' : null)
      if (name) declare(name, statement, ts.isClassDeclaration(statement) ? 'class' : 'function', statement)
    } else if (ts.isVariableStatement(statement)) {
      for (const variable of statement.declarationList.declarations) {
        if (!ts.isIdentifier(variable.name)) continue
        const name = variable.name.text, expr = unwrap(variable.initializer)
        if (!(statement.declarationList.flags & ts.NodeFlags.Const) || !expr) {
          bind(name, variable)
          if (componentName(name) && modifiers(statement, ts.SyntaxKind.ExportKeyword)) report('dynamic-component-export', variable)
          continue
        }
        if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) declare(name, expr, ts.isArrowFunction(expr) ? 'arrow' : 'function', statement)
        else if (bind(name, variable)) {
          variables.set(name, expr)
          if (ts.isIdentifier(expr)) aliases.set(name, expr.text)
          if (modifiers(statement, ts.SyntaxKind.ExportKeyword)) exported(name, name, variable)
        }
      }
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const expr = unwrap(statement.expression)
      if (ts.isIdentifier(expr)) exported('default', expr.text, statement)
      else if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
        declare('default', expr, ts.isArrowFunction(expr) ? 'arrow' : 'function')
        exported('default', 'default', statement)
      } else if (!ts.isObjectLiteralExpression(expr) && !ts.isLiteralExpression(expr)) report('dynamic-component-export', statement)
    } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const clause = statement.exportClause
      if (!clause || !ts.isNamedExports(clause)) { report('unresolved-component-reexport', statement); return }
      for (const item of clause.elements) {
        if (item.isTypeOnly) continue
        if (statement.moduleSpecifier) {
          if (componentName(item.name.text) || componentName(item.propertyName?.text)) report('unresolved-component-reexport', item)
        } else exported(item.name.text, (item.propertyName ?? item.name).text, item)
      }
    }
  }

  function resolveAlias(name) {
    const seen = new Set()
    while (aliases.has(name) && !duplicates.has(name) && !seen.has(name)) { seen.add(name); name = aliases.get(name) }
    return duplicates.has(name) || seen.has(name) ? null : name
  }
  function inspect(name, info, rootExpression) {
    const { node, kind } = info
    let body = node.body, parameters = node.parameters ?? []
    if (kind === 'class') {
      const base = node.heritageClauses?.find(c => c.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression
      if (!['Component', 'PureComponent'].some(member => packageMember(base, ['react'], member))) return null
      const render = node.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(file) === 'render' && !modifiers(member, ts.SyntaxKind.StaticKeyword))
      body = render?.body
      parameters = render?.parameters ?? []
    }
    if (!body && !rootExpression) return null
    const model = { name, kind, line: line(node), refs: [], roles: [], wrappers: [], neighbors: [], neighborRoles: [], dispatches: [] }
    const importedPage = imports.get('renderPage')
    const knownDispatcher = definitions.has('renderPage') || importedPage?.imported === 'renderPage' && /^(?:\.\.?\/|@\/)/.test(importedPage.specifier)
    const locals = new Set(), localValues = new Map()
    function local(binding) {
      if (!binding) return
      if (ts.isIdentifier(binding)) locals.add(binding.text)
      else if (ts.isObjectBindingPattern(binding) || ts.isArrayBindingPattern(binding)) {
        for (const element of binding.elements) if (ts.isBindingElement(element)) local(element.name)
      }
    }
    for (const param of parameters) local(param.name)
    if (body && ts.isBlock(body)) {
      const pending = [body]
      while (pending.length) {
        if (++visits > 64_000) throw limit
        const n = pending.pop()
        if (ts.isFunctionLike(n) || ts.isClassLike(n)) { if (n.name && (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n))) local(n.name); continue }
        if (ts.isVariableDeclaration(n)) {
          const alreadyBound = ts.isIdentifier(n.name) && locals.has(n.name.text)
          local(n.name)
          if (ts.isIdentifier(n.name)) {
            if (!alreadyBound && n.parent.parent.parent === body && (n.parent.flags & ts.NodeFlags.Const)) localValues.set(n.name.text, n.initializer)
            else localValues.delete(n.name.text)
          }
        }
        ts.forEachChild(n, child => { pending.push(child) })
      }
    }
    let renders = false
    const expanding = new Set()
    function dispatch(kind, n, ancestors, neighbors) {
      const dispatchLine = line(n)
      add(model.dispatches, { kind, line: dispatchLine })
      for (const ancestor of ancestors) add(ancestor.role ? model.neighborRoles : model.wrappers, { ...ancestor, dispatch: kind, dispatchLine })
      for (const group of neighbors) for (const sibling of group.rows) {
        if (sibling.node !== group.child) add(sibling.ref.role ? model.neighborRoles : model.neighbors, { ...sibling.ref, dispatch: kind, dispatchLine })
      }
    }
    function visit(expression, ancestors = [], depth = 0, direct = false, neighbors = []) {
      const n = unwrap(expression)
      if (!n) return
      if (depth > 96 || ++visits > 64_000) throw limit
      const child = value => visit(value, ancestors, depth + 1, direct, neighbors)
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
        renders = true
        let nested = ancestors
        if (!ts.isJsxFragment(n)) {
          const tag = (ts.isJsxElement(n) ? n.openingElement : n).tagName
          if (ts.isIdentifier(tag)) {
            const label = tag.text, role = roleByTag.get(label)
            if (role) {
              const occurrence = { role, line: line(tag) }
              add(model.roles, occurrence)
              nested = [...ancestors, occurrence]
            }
            if (componentName(label)) {
              const localName = resolveAlias(label)
              if (locals.has(label) || !localName || !(imports.has(localName) || definitions.has(localName))) report('dynamic-component-target', tag)
              else {
                const ref = { name: localName, line: line(tag) }
                add(model.refs, ref)
                if (packageMember(tag, ['react-router', 'react-router-dom'], 'Routes')) dispatch('Routes', tag, ancestors, neighbors)
                nested = [...ancestors, ref]
              }
            }
          } else report('dynamic-component-target', tag)
        }
        if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
          const rows = []
          for (const content of n.children) {
            const opening = ts.isJsxElement(content) ? content.openingElement : content
            if (!(ts.isJsxOpeningElement(opening) || ts.isJsxSelfClosingElement(opening)) || !ts.isIdentifier(opening.tagName)) continue
            const tag = opening.tagName, label = resolveAlias(tag.text)
            const role = roleByTag.get(tag.text)
            if (role) { rows.push({ node: content, ref: { role, line: line(tag) } }); continue }
            if (!label || !componentName(tag.text) || locals.has(tag.text) || !(imports.has(label) || definitions.has(label))) continue
            if (['Route','Routes'].some(member => packageMember(tag, ['react-router','react-router-dom'], member))) continue
            rows.push({ node: content, ref: { name: label, line: line(tag) } })
          }
          for (const content of n.children) {
            if (!ts.isJsxText(content)) visit(content, nested, depth + 1, false, rows.length ? [...neighbors, { rows, child: content }] : neighbors)
          }
        }
      } else if (ts.isJsxExpression(n)) child(n.expression)
      else if (ts.isConditionalExpression(n)) {
        if (n.condition.kind !== ts.SyntaxKind.FalseKeyword) child(n.whenTrue)
        if (n.condition.kind !== ts.SyntaxKind.TrueKeyword) child(n.whenFalse)
      } else if (ts.isBinaryExpression(n)) {
        if (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && n.left.kind !== ts.SyntaxKind.FalseKeyword) child(n.right)
        if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)) { child(n.left); child(n.right) }
      } else if (ts.isIdentifier(n) && localValues.has(n.text) && !expanding.has(n.text)) {
        expanding.add(n.text); child(localValues.get(n.text)); expanding.delete(n.text)
      } else if (ts.isArrayLiteralExpression(n)) {
        for (const element of n.elements) child(element)
      } else if (ts.isCallExpression(n)) {
        if (ts.isIdentifier(n.expression) && n.expression.text === 'renderPage' && !locals.has('renderPage')
          && knownDispatcher && !duplicates.has('renderPage') && n.arguments.length === 1
          && ts.isIdentifier(n.arguments[0]) && n.arguments[0].text === 'pathname') {
          renders = true
          add(model.refs, { name: 'renderPage', line: line(n) })
          dispatch('renderPage', n, ancestors, neighbors)
        } else if (ts.isIdentifier(n.expression) && !locals.has(n.expression.text) && packageMember(n.expression, ['react-dom'], 'createPortal')) {
          child(n.arguments[0])
        } else if (direct || ts.isIdentifier(n.expression) && /^render[A-Z]/.test(n.expression.text) ||
          n.arguments.some(arg => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg))) report('dynamic-component-render', n)
      }
    }
    function statements(n, depth = 0) {
      if (depth > 96) throw limit
      if (ts.isReturnStatement(n)) { visit(n.expression, [], 0, true); return true }
      if (ts.isThrowStatement(n)) return true
      if (ts.isBlock(n)) return n.statements.some(s => statements(s, depth + 1))
      if (ts.isIfStatement(n)) {
        const thenStops = n.expression.kind !== ts.SyntaxKind.FalseKeyword && statements(n.thenStatement, depth + 1)
        const elseStops = n.expression.kind !== ts.SyntaxKind.TrueKeyword && n.elseStatement && statements(n.elseStatement, depth + 1)
        return n.expression.kind === ts.SyntaxKind.TrueKeyword ? thenStops : n.expression.kind === ts.SyntaxKind.FalseKeyword ? elseStops : thenStops && elseStops
      }
      if (ts.isSwitchStatement(n)) {
        for (const clause of n.caseBlock.clauses) clause.statements.some(s => statements(s, depth + 1))
      } else if (ts.isTryStatement(n) || ts.isIterationStatement(n, false)) report('dynamic-component-control-flow', n)
      return false
    }
    if (rootExpression) visit(rootExpression, [], 0, true)
    else if (ts.isBlock(body)) statements(body)
    else visit(body, [], 0, true)
    return renders ? model : null
  }
  try {
    if (typeof source !== 'string' || source.length > 256_000) throw limit
    file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    if (file.parseDiagnostics.length) return { ...result, findings: [{ code: 'invalid-component-syntax', line: 1 }] }
    file.statements.forEach(collect)
    const candidates = new Set()
    const exportedLocals = new Set(pendingExports.filter(e => componentName(e.name)).map(e => resolveAlias(e.local)))
    for (const [name, info] of definitions) {
      if (duplicates.has(name) || !componentName(name) && !exportedLocals.has(name)) continue
      const model = inspect(name, info)
      if (model) { candidates.add(name); add(result.components, model) }
    }
    for (const item of pendingExports) {
      const local = resolveAlias(item.local)
      const value = variables.get(local)
      const data = value && (ts.isLiteralExpression(value) || ts.isArrayLiteralExpression(value) || ts.isObjectLiteralExpression(value)
        || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(value.kind))
      if (candidates.has(local)) add(result.exports, { name: item.name, local, line: line(item.node) })
      else if (!definitions.has(local) && !data) report('dynamic-component-export', item.node)
    }
    for (const statement of file.statements) {
      if (!ts.isExpressionStatement(statement)) continue
      const call = unwrap(statement.expression)
      if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== 'render' || call.arguments.length !== 1) continue
      let root = unwrap(call.expression.expression)
      if (ts.isIdentifier(root)) root = variables.get(root.text)
      if (!root || !ts.isCallExpression(root) || !packageMember(root.expression, ['react-dom/client'], 'createRoot')) continue
      const model = inspect('default', { kind: 'root', node: statement }, call.arguments[0])
      if (model) result.roots.push(...model.refs)
    }
    return result
  } catch (error) {
    if (error !== limit && !(error instanceof RangeError)) throw error
    return { imports: [], exports: [], components: [], roots: [], findings: [{ code: 'component-syntax-limit', line: 1 }] }
  }
}
