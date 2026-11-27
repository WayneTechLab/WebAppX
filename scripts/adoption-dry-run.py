#!/usr/bin/env python3
"""Rehearse finite public identity substitutions in an owned disposable copy."""
import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import tempfile
import threading
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
MAX_SPEC = 8192
MAX_FILES = 10000
MAX_BYTES = 256 * 1024 * 1024
MAX_FILE = 32 * 1024 * 1024
MAX_LIST = 8 * 1024 * 1024
MAX_FIELD_FILE = 2 * 1024 * 1024
FIELD_FILES = ('package.json', 'package-lock.json', 'index.html', '.SYSTEMX/project.json')
ENV_EXAMPLES = {'.env.example', '.SYSTEMX/Template/starter/.env.example'}
OMITTED = ['ignored/untracked files', '.git', 'dependencies', 'live environment files',
           'local runtime/private state']


class Refusal(ValueError):
    """Public diagnostic codes never contain source paths or subprocess output."""


def _sha(data):
    return hashlib.sha256(data).hexdigest()


def _encoded(value):
    return (json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2) + '\n').encode('utf-8')


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise Refusal('duplicate-json-key')
        result[key] = value
    return result


def _json(data):
    try:
        value = json.loads(data.decode('utf-8'), object_pairs_hook=_pairs,
                           parse_constant=lambda _: (_ for _ in ()).throw(Refusal('nonfinite-json')))
        pending, nodes = [(value, 0)], 0
        while pending:
            item, depth = pending.pop()
            nodes += 1
            if depth > 64 or nodes > 100000 or type(item) is float and not math.isfinite(item):
                raise Refusal('json-format-budget')
            if type(item) is dict:
                pending.extend((child, depth + 1) for child in item.values())
            elif type(item) is list:
                pending.extend((child, depth + 1) for child in item)
        return value
    except (UnicodeError, ValueError, RecursionError):
        raise Refusal('invalid-or-duplicate-json') from None


def _keys(value, required, optional=()):
    if type(value) is not dict or not set(required) <= value.keys() or value.keys() - set(required) - set(optional):
        raise Refusal('identity-shape-invalid')


def _text(value, maximum):
    if (type(value) is not str or not 1 <= len(value) <= maximum or value != value.strip()
            or any(unicodedata.category(c).startswith('C') for c in value)):
        raise Refusal('identity-text-invalid')
    return value


def validate_identity(value):
    """Closed public input; no URLs, arbitrary paths, hooks or credentials."""
    _keys(value, ('schemaVersion', 'repository', 'packageName', 'site', 'project'), ('projectPlaceholder',))
    if type(value['schemaVersion']) is not int or value['schemaVersion'] != 1:
        raise Refusal('identity-version-invalid')
    _keys(value['repository'], ('owner', 'name'))
    owner, name = value['repository']['owner'], value['repository']['name']
    if (type(owner) is not str or not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?', owner)
            or type(name) is not str or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,99}', name)
            or name.endswith('.git') or '..' in name):
        raise Refusal('repository-identity-invalid')
    package = value['packageName']
    if type(package) is not str or not re.fullmatch(r'[a-z0-9][a-z0-9._-]{0,63}', package):
        raise Refusal('package-name-invalid')
    _keys(value['site'], ('title', 'description', 'openGraphTitle', 'openGraphDescription'))
    _keys(value['project'], ('name', 'description'))
    for key in value['site']:
        _text(value['site'][key], 160 if key in ('title', 'openGraphTitle') else 500)
    _text(value['project']['name'], 160)
    _text(value['project']['description'], 500)
    if 'projectPlaceholder' in value:
        marker = value['projectPlaceholder']
        if (type(marker) is not str or len(marker) > 63
                or not re.fullmatch(r'your-[a-z0-9]+(?:-[a-z0-9]+){0,4}-project-id', marker)):
            raise Refusal('inert-project-placeholder-required')
    # Detached output also proves UTF-8 encodability within the whole input cap.
    result = _json(_encoded(value))
    if len(_encoded(result)) > MAX_SPEC:
        raise Refusal('identity-spec-too-large')
    return result


def read_identity(path):
    try:
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > MAX_SPEC:
            raise Refusal('identity-spec-not-bounded-regular-file')
        descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_BINARY', 0) | getattr(os, 'O_NOFOLLOW', 0))
        with os.fdopen(descriptor, 'rb') as stream:
            if os.fstat(stream.fileno()) != info:
                raise Refusal('identity-spec-changed')
            data = stream.read(MAX_SPEC + 1)
        if len(data) > MAX_SPEC:
            raise Refusal('identity-spec-too-large')
        return validate_identity(_json(data))
    except OSError:
        raise Refusal('identity-spec-unavailable') from None


def _environment():
    # Do not inherit Git overrides, credentials, filters or project env values.
    environment = {key: os.environ[key] for key in ('PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP')
                   if key in os.environ}
    environment.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_SYSTEM=os.devnull,
                       GIT_CONFIG_GLOBAL=os.devnull, GIT_TERMINAL_PROMPT='0',
                       GIT_OPTIONAL_LOCKS='0', GIT_NO_REPLACE_OBJECTS='1',
                       GIT_GRAFT_FILE=os.devnull, GIT_NO_LAZY_FETCH='1')
    return environment


def _start(source, args, seconds=30):
    try:
        process = subprocess.Popen(['git', '-C', str(source), *args], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=_environment())
    except OSError:
        raise Refusal('git-unavailable') from None
    timer = threading.Timer(seconds, process.kill)
    timer.daemon = True
    timer.start()
    return process, timer


def _stop(process, timer):
    timer.cancel()
    if process.poll() is None:
        process.kill()
    process.wait(timeout=5)
    process.stdin.close()
    process.stdout.close()


def _git(source, args, limit):
    process, timer = _start(source, args)
    try:
        process.stdin.close()
        data = process.stdout.read(limit + 1)
        if len(data) > limit:
            raise Refusal('git-output-limit')
        if process.wait(timeout=5) != 0:
            raise Refusal('committed-source-unavailable')
        return data
    finally:
        _stop(process, timer)


def _portable_path(name):
    if (not name or len(name.encode('utf-8')) > 1024 or '\\' in name or name.startswith('/')
            or len(name.split('/')) > 64):
        raise Refusal('unsafe-committed-path')
    for part in name.split('/'):
        if (part in ('', '.', '..') or part[-1] in '. ' or len(part.encode('utf-8')) > 255
                or any(c in '<>:"|?*' or ord(c) < 32 or ord(c) == 127 for c in part)
                or part.casefold().split('.')[0] in {'con', 'prn', 'aux', 'nul',
                    'com¹', 'com²', 'com³', 'lpt¹', 'lpt²', 'lpt³',
                    *(f'com{i}' for i in range(1, 10)), *(f'lpt{i}' for i in range(1, 10))}):
            raise Refusal('unsafe-committed-path')
    parts = [part.casefold() for part in name.split('/')]
    if (any(part in {'.git', 'node_modules', '.firebase', '.cache', '.ssh', '.aws',
                     'dist', 'coverage', '.npmrc', '.netrc', '.pypirc'} for part in parts)
            or any(part.startswith('.env') for part in parts) and name not in ENV_EXAMPLES
            or name.casefold().startswith(('.systemx/.systemx/state/', '.systemx/.systemx/history/'))):
        raise Refusal('nonpublic-committed-path')
    return PurePosixPath(name)


def parse_tree(data):
    """Validate all committed paths and declared budgets before copying a blob."""
    entries, folded, total = [], {}, 0
    try:
        for row in data.split(b'\0'):
            if not row:
                continue
            meta, raw_name = row.split(b'\t', 1)
            mode, kind, oid, raw_size = meta.split()
            name = raw_name.decode('utf-8')
            path = _portable_path(name)
            if mode not in (b'100644', b'100755') or kind != b'blob':
                raise Refusal('committed-links-or-special-files-refused')
            if not re.fullmatch(rb'[0-9a-f]{40}', oid):
                raise Refusal('committed-object-invalid')
            size = int(raw_size)
            total += size
            if size < 0 or size > MAX_FILE or total > MAX_BYTES or len(entries) >= MAX_FILES:
                raise Refusal('committed-copy-budget-exceeded')
            for prefix in [*path.parents, path]:
                if str(prefix) == '.':
                    continue
                key = unicodedata.normalize('NFC', str(prefix)).casefold()
                if key in folded and folded[key] != str(prefix):
                    raise Refusal('case-or-normalization-collision')
                folded[key] = str(prefix)
            entries.append({'path': name, 'gitMode': mode.decode(), 'object': oid.decode(), 'bytes': size})
    except Refusal:
        raise
    except (ValueError, UnicodeError):
        raise Refusal('invalid-committed-tree') from None
    names = {entry['path'] for entry in entries}
    if len(names) != len(entries) or not entries:
        raise Refusal('empty-or-duplicate-committed-tree')
    if any(str(parent) in names for name in names for parent in PurePosixPath(name).parents):
        raise Refusal('committed-file-directory-collision')
    return sorted(entries, key=lambda entry: entry['path'])


def _copy_committed(source, revision, destination):
    entries = parse_tree(_git(source, ['ls-tree', '-r', '-l', '-z', revision], MAX_LIST))
    process, timer = _start(source, ['cat-file', '--batch'], seconds=120)
    try:
        for entry in entries:
            process.stdin.write((entry['object'] + '\n').encode('ascii'))
            process.stdin.flush()
            header = process.stdout.readline(160)
            expected = f"{entry['object']} blob {entry['bytes']}\n".encode()
            if header != expected:
                raise Refusal('committed-blob-mismatch')
            path = destination.joinpath(*PurePosixPath(entry['path']).parts)
            path.parent.mkdir(parents=True, exist_ok=True)
            sha = hashlib.sha256()
            git_sha = hashlib.sha1(f"blob {entry['bytes']}\0".encode(), usedforsecurity=False)
            remaining = entry['bytes']
            with path.open('xb') as target:
                while remaining:
                    chunk = process.stdout.read(min(65536, remaining))
                    if not chunk:
                        raise Refusal('committed-blob-incomplete')
                    target.write(chunk)
                    sha.update(chunk)
                    git_sha.update(chunk)
                    remaining -= len(chunk)
            if process.stdout.read(1) != b'\n' or git_sha.hexdigest() != entry['object']:
                raise Refusal('committed-blob-mismatch')
            path.chmod(0o755 if entry['gitMode'] == '100755' else 0o644)
            entry['sha256'] = sha.hexdigest()
        process.stdin.close()
        if process.wait(timeout=5) != 0 or process.stdout.read(1):
            raise Refusal('committed-copy-incomplete')
    except (OSError, BrokenPipeError, subprocess.TimeoutExpired):
        raise Refusal('committed-copy-unavailable') from None
    finally:
        _stop(process, timer)
    return entries


class IdentityHTML(HTMLParser):
    """Locate four existing fields without rewriting unrelated HTML."""
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text, self.fields, self.title_start = text, {}, None
        self.offsets = [0]
        for line in text.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))

    def position(self):
        line, column = self.getpos()
        return self.offsets[line - 1] + column

    def add(self, key, start, end):
        if key in self.fields:
            raise Refusal('duplicate-html-identity-field')
        self.fields[key] = (start, end, html.unescape(self.text[start:end]))

    def handle_starttag(self, tag, attrs):
        if self.title_start is not None:
            raise Refusal('nested-html-title')
        if tag == 'title':
            if 'title' in self.fields:
                raise Refusal('duplicate-html-identity-field')
            self.title_start = self.position() + len(self.get_starttag_text())
        if tag != 'meta':
            return
        values = dict(attrs)
        key = ('description' if values.get('name') == 'description' else
               'openGraphTitle' if values.get('property') == 'og:title' else
               'openGraphDescription' if values.get('property') == 'og:description' else None)
        if key:
            if len(values) != len(attrs) or 'content' not in values:
                raise Refusal('duplicate-html-attribute')
            matches = list(re.finditer(r'(?<![\w:-])content\s*=\s*([\'"])(.*?)\1', self.get_starttag_text(), re.I | re.S))
            if len(matches) != 1:
                raise Refusal('html-content-attribute-invalid')
            match = matches[0]
            self.add(key, self.position() + match.start(2), self.position() + match.end(2))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == 'title':
            if self.title_start is None:
                raise Refusal('html-title-invalid')
            self.add('title', self.title_start, self.position())
            self.title_start = None


def _html_fields(data):
    try:
        parser = IdentityHTML(data.decode('utf-8'))
        parser.feed(parser.text)
        parser.close()
        if set(parser.fields) != {'title', 'description', 'openGraphTitle', 'openGraphDescription'} or parser.title_start is not None:
            raise Refusal('html-identity-field-missing')
        return parser
    except (UnicodeError, RecursionError):
        raise Refusal('html-identity-invalid') from None


def _apply_fields(stage, identity, entries):
    names = {entry['path'] for entry in entries}
    required = {*FIELD_FILES, '.firebaserc'}
    if not required <= names:
        raise Refusal('required-committed-identity-file-missing')
    buffers = {name: (stage / name).read_bytes() for name in required}
    if any(len(value) > MAX_FIELD_FILE for value in buffers.values()):
        raise Refusal('identity-field-file-too-large')
    package, lock, project, firebase = [_json(buffers[name]) for name in
                                       ('package.json', 'package-lock.json', '.SYSTEMX/project.json', '.firebaserc')]
    try:
        old = package['name']
        if (type(old) is not str or not old or lock['name'] != old or lock['packages']['']['name'] != old
                or type(lock['lockfileVersion']) is not int or lock['lockfileVersion'] != 3
                or type(project['schemaVersion']) is not int or project['schemaVersion'] != 1
                or any(type(project['project'][key]) is not str for key in ('name', 'description'))
                or firebase['projects']['default'] != 'your-firebase-project-id'):
            raise Refusal('unsupported-identity-source-shape')
        if not re.fullmatch(r'[a-z0-9][a-z0-9._-]{0,63}', old):
            raise Refusal('unsupported-identity-source-shape')
        _text(project['project']['name'], 160)
        _text(project['project']['description'], 500)
    except (KeyError, TypeError):
        raise Refusal('unsupported-identity-source-shape') from None
    replacements, changes = {}, []
    def change(file, pointer, before, after):
        changes.append({'path': file, 'field': pointer, 'before': before, 'after': after})
    for file, pointer in [('package.json', '/name'), ('package-lock.json', '/name'), ('package-lock.json', '/packages//name')]:
        change(file, pointer, old, identity['packageName'])
    package['name'] = lock['name'] = lock['packages']['']['name'] = identity['packageName']
    replacements['package.json'], replacements['package-lock.json'] = _encoded(package), _encoded(lock)
    for key in ('name', 'description'):
        change('.SYSTEMX/project.json', '/project/' + key, project['project'][key], identity['project'][key])
        project['project'][key] = identity['project'][key]
    replacements['.SYSTEMX/project.json'] = _encoded(project)
    parser = _html_fields(buffers['index.html'])
    output = parser.text
    for key, (start, end, before) in sorted(parser.fields.items(), key=lambda pair: pair[1][0], reverse=True):
        _text(before, 160 if key in ('title', 'openGraphTitle') else 500)
        value = identity['site'][key]
        output = output[:start] + html.escape(value, quote=key != 'title') + output[end:]
        change('index.html', {'title': 'title', 'description': 'meta[name=description].content',
                             'openGraphTitle': 'meta[property=og:title].content',
                             'openGraphDescription': 'meta[property=og:description].content'}[key], before, value)
    replacements['index.html'] = output.encode('utf-8')
    if {key: row[2] for key, row in _html_fields(replacements['index.html']).fields.items()} != identity['site']:
        raise Refusal('html-substitution-verification-failed')
    if 'projectPlaceholder' in identity:
        change('.firebaserc', '/projects/default', firebase['projects']['default'], identity['projectPlaceholder'])
        firebase['projects']['default'] = identity['projectPlaceholder']
        replacements['.firebaserc'] = _encoded(firebase)
    for name, data in replacements.items():
        if name != 'index.html':
            _json(data)
        (stage / name).write_bytes(data)
    return changes, replacements


def _manifest(entries):
    fields = ('path', 'gitMode', 'bytes', 'sha256')
    rows = [{key: entry[key] for key in fields} for entry in entries]
    return _sha(json.dumps(rows, sort_keys=True, separators=(',', ':')).encode())


def rehearse(source, revision, identity):
    """Read committed Git blobs only; every write is under the owned temp root."""
    identity = validate_identity(identity)
    if type(revision) is not str or not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise Refusal('exact-commit-required')
    try:
        if source.is_symlink() or not source.is_dir():
            raise Refusal('repository-root-required')
        source = source.resolve()
        top = _git(source, ['rev-parse', '--show-toplevel'], 4096).decode('utf-8').strip()
        if Path(top).resolve() != source or _git(source, ['cat-file', '-t', revision], 32) != b'commit\n':
            raise Refusal('repository-root-and-commit-required')
        with tempfile.TemporaryDirectory(prefix='webappx-adoption-rehearsal-') as temporary:
            stage = Path(temporary) / 'copy'
            stage.mkdir()
            before = _copy_committed(source, revision, stage)
            changes, replacements = _apply_fields(stage, identity, before)
            after, changed = [], []
            for entry in before:
                path = stage / entry['path']
                data = path.read_bytes()
                actual = {**entry, 'bytes': len(data), 'sha256': _sha(data)}
                if (os.name != 'nt' and bool(path.stat().st_mode & 0o111) != (entry['gitMode'] == '100755')):
                    raise Refusal('copy-mode-preservation-failed')
                if entry['path'] not in replacements and actual != entry:
                    raise Refusal('unmapped-file-preservation-failed')
                if data != replacements.get(entry['path'], data):
                    raise Refusal('mapped-file-verification-failed')
                if actual['sha256'] != entry['sha256']:
                    changed.append({'path': entry['path'], 'beforeSha256': entry['sha256'], 'afterSha256': actual['sha256']})
                after.append(actual)
            report = {'schemaVersion': 1, 'status': 'rehearsed', 'appliedToSource': False,
                      'source': {'commit': revision, 'selection': 'committed-blobs-only',
                                 'files': len(before), 'bytes': sum(row['bytes'] for row in before),
                                 'manifestSha256': _manifest(before), 'workingFilesRead': False},
                      'copy': {'beforeManifestSha256': _manifest(before), 'afterManifestSha256': _manifest(after),
                               'changedFiles': changed, 'unmappedFilesByteExact': True,
                               'gitModeMetadataRetained': True, 'posixExecutableBitsVerified': os.name != 'nt'},
                      'categories': {'repository': {'state': 'proposed-only', **identity['repository']},
                                     'package': 'temporary-substitutions', 'site': 'temporary-substitutions',
                                     'deployment': 'inert-placeholder-only' if 'projectPlaceholder' in identity else 'unchanged-unconfigured-placeholder',
                                     'projectRecords': 'display-metadata-only; reusable work seeds unchanged'},
                      'fields': sorted(changes, key=lambda row: (row['path'], row['field'])),
                      'omitted': OMITTED,
                      'manualReview': ['rendered app branding, favicon and brand assets',
                                       'starter and optional Functions package identities',
                                       'real repository destination and remote', 'service/environment/Hosting selection',
                                       'adopted private context, plans, tasks and memory'],
                      'sourceWritesPerformed': False,
                      'validationScope': 'finite JSON/HTML substitutions and complete copy preservation; not template parity, install or runtime acceptance'}
        report['cleanup'] = 'owned-temporary-copy-removed'
        return report
    except (OSError, UnicodeError, subprocess.TimeoutExpired):
        raise Refusal('rehearsal-unavailable') from None


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT, help='Local repository root; working files are not copied')
    parser.add_argument('--revision', required=True, help='Exact reviewed public commit (40 lowercase hex characters)')
    parser.add_argument('--identity', required=True, type=Path, help='Bounded public identity JSON specification')
    args = parser.parse_args(argv)
    try:
        print(json.dumps(rehearse(args.source, args.revision, read_identity(args.identity)), ensure_ascii=False, indent=2))
        return 0
    except Refusal as error:
        print(json.dumps({'schemaVersion': 1, 'status': 'refused', 'code': str(error), 'appliedToSource': False}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
