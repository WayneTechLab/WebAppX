#!/usr/bin/env python3
"""Parse supplied Python source as data. Never import or execute scanned files."""
import ast
import hashlib
import json
import re
import sys

LIMIT = 1_048_576
METHODS = {'run', 'Popen', 'call', 'check_call', 'check_output', 'getoutput', 'getstatusoutput'}
SHELLS = {'sh': {'-c'}, 'bash': {'-c'}, 'zsh': {'-c'}, 'dash': {'-c'}, 'ksh': {'-c'},
          'cmd': {'/c', '/k'}, 'powershell': {'-command', '-encodedcommand', '-c'},
          'pwsh': {'-command', '-encodedcommand', '-c'}, 'python': {'-c'},
          'python3': {'-c'}, 'node': {'-e', '--eval', '-p', '--print'}}
UNKNOWN = object()


def analyze(path, source):
    findings = []
    try:
        tree = ast.parse(source, filename='scanned.py')
    except (SyntaxError, ValueError, RecursionError) as error:
        return [{'path': path, 'line': max(1, getattr(error, 'lineno', 1) or 1),
                 'column': max(1, getattr(error, 'offset', 1) or 1), 'kind': 'python-parser',
                 'rules': ['parse-error'], 'fingerprint': None}]
    scopes = [{}]

    def lookup(name):
        for scope in reversed(scopes):
            if name in scope:
                return scope[name]
        return UNKNOWN

    def invalidate(name, seen=None):
        seen = set() if seen is None else seen
        if name in seen:
            return
        seen.add(name)
        for scope in reversed(scopes):
            if name in scope:
                previous = scope[name]
                # Namespace attribute writes such as sys.dont_write_bytecode
                # do not replace the module object or its executable identity.
                if isinstance(previous, tuple):
                    return
                scope[name] = UNKNOWN
                if isinstance(previous, ast.Name):
                    invalidate(previous.id, seen)
                return

    def value(node, depth=0):
        if depth > 20 or node is None:
            return UNKNOWN
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.Name):
            result = lookup(node.id)
            return value(result, depth + 1) if isinstance(result, ast.AST) else result
        if isinstance(node, (ast.List, ast.Tuple)):
            return [UNKNOWN if isinstance(item, ast.Starred) else value(item, depth + 1) for item in node.elts]
        if isinstance(node, ast.Attribute):
            base = value(node.value, depth + 1)
            if base in [('module', 'subprocess'), ('module', 'os'), ('module', 'asyncio')]:
                return ('member', base[1], node.attr)
            if base == ('module', 'sys') and node.attr == 'executable':
                return '<python-executable>'
        return UNKNOWN

    class Visitor(ast.NodeVisitor):
        def visit_Import(self, node):
            for alias in node.names:
                if alias.name in {'subprocess', 'os', 'sys', 'asyncio'}:
                    scopes[-1][alias.asname or alias.name] = ('module', alias.name)

        def visit_ImportFrom(self, node):
            for alias in node.names:
                scopes[-1][alias.asname or alias.name] = ('member', node.module, alias.name)

        def visit_Assign(self, node):
            self.visit(node.value)
            for target in node.targets:
                if isinstance(target, ast.Name):
                    scopes[-1][target.id] = node.value if target.id not in scopes[-1] else UNKNOWN
                elif isinstance(target, (ast.Subscript, ast.Attribute)) and isinstance(target.value, ast.Name):
                    invalidate(target.value.id)

        def visit_AnnAssign(self, node):
            if isinstance(node.target, ast.Name):
                scopes[-1][node.target.id] = node.value
            if node.value:
                self.visit(node.value)

        def visit_FunctionDef(self, node):
            scopes[-1][node.name] = UNKNOWN
            defaults = dict(zip([item.arg for item in node.args.args][-len(node.args.defaults):], node.args.defaults)) if node.args.defaults else {}
            scope = {item.arg: defaults.get(item.arg, UNKNOWN) for item in node.args.posonlyargs + node.args.args + node.args.kwonlyargs}
            scopes.append(scope)
            for child in node.body:
                self.visit(child)
            scopes.pop()

        visit_AsyncFunctionDef = visit_FunctionDef

        def visit_Call(self, node):
            callee = value(node.func)
            if isinstance(node.func, ast.Attribute) and node.func.attr in {'update', 'setdefault', 'append', 'extend', 'insert'} and isinstance(node.func.value, ast.Name):
                invalidate(node.func.value.id)
            rules = []
            if isinstance(callee, tuple) and callee[0] == 'member':
                module, kind = callee[1:]
                recognized = module == 'subprocess' and kind in METHODS or module == 'os' and kind in {'system', 'popen'} or module == 'asyncio' and kind in {'create_subprocess_exec', 'create_subprocess_shell'}
                if recognized:
                    if kind in {'getoutput', 'getstatusoutput', 'system', 'popen', 'create_subprocess_shell'}:
                        rules.append('implicit-shell')
                    command = value(node.args[0]) if node.args else UNKNOWN
                    shell = False
                    for keyword in node.keywords:
                        if keyword.arg is None:
                            shell = UNKNOWN
                        elif keyword.arg == 'shell':
                            shell = value(keyword.value)
                    if shell is not False:
                        rules.append('shell-enabled' if shell is True else 'options-indeterminate')
                    if kind == 'create_subprocess_exec':
                        command = [value(item) for item in node.args]
                    if not isinstance(command, list):
                        rules.append('argv-string' if isinstance(command, str) else 'argv-indeterminate')
                    else:
                        executable = command[0] if command else UNKNOWN
                        if not isinstance(executable, str):
                            rules.append('executable-indeterminate')
                        else:
                            base = executable.replace('\\', '/').rsplit('/', 1)[-1].lower().removesuffix('.exe')
                            if executable == '<python-executable>':
                                base = 'python'
                            if base in SHELLS and any(isinstance(arg, str) and arg.lower() in SHELLS[base] for arg in command[1:]):
                                rules.append('interpreter-string')
                    if rules:
                        fingerprint = hashlib.sha256(ast.dump(node, annotate_fields=True, include_attributes=False).encode()).hexdigest()
                        findings.append({'path': path, 'line': node.lineno, 'column': node.col_offset + 1,
                                         'kind': 'python:' + module + '.' + kind,
                                         'rules': sorted(set(rules)), 'fingerprint': fingerprint})
            self.generic_visit(node)
    Visitor().visit(tree)
    return findings


def main():
    try:
        raw = sys.stdin.buffer.read(16 * LIMIT + 1)
        if len(raw) > 16 * LIMIT:
            raise ValueError()
        request = json.loads(raw)
        if not isinstance(request, dict) or set(request) != {'files'} or not isinstance(request['files'], list) or len(request['files']) > 256:
            raise ValueError()
        output = []
        for item in request['files']:
            if not isinstance(item, dict) or set(item) != {'path', 'source'} or not isinstance(item['path'], str) or not re.fullmatch(r'scripts/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_.-]+\.py', item['path']) or '..' in item['path'].split('/') or not isinstance(item['source'], str) or len(item['source'].encode()) > LIMIT:
                raise ValueError()
            output.extend(analyze(item['path'], item['source']))
        print(json.dumps({'parser': 'python-ast-v1', 'findings': output}, separators=(',', ':')))
        return 0
    except (ValueError, TypeError, UnicodeError, RecursionError):
        print('Python source parser refused bounded input.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
