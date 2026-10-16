#!/usr/bin/env python3
"""Validate reusable seeds, provenance, snapshots and optional mirror parity."""
import argparse
import hashlib
import json
import os
import re
import stat
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {'.json', '.md', '.ps1', '.py', '.sh'}
TEXT_NAMES = {'.gitattributes', '.gitignore', 'LICENSE', 'VERSION'}
BOOTSTRAP_FILES = ('manager.py', 'lifecycle.py', 'versions.py', 'systemx_paths.py',
                   'SYSTEMX.sh', 'SYSTEMX.ps1', 'INSTALL.sh', 'INSTALL.ps1')


def digest(path, upstream=False, *, name=None, schema=1):
    data = path.read_bytes()
    if upstream:
        # Historical schema 1 normalized every file. Schema 2 retains that
        # equivalence only for reviewed UTF-8 text; media/unknown types are exact.
        if schema not in (1, 2):
            raise ValueError('Unsupported distribution manifest schema')
        text = schema == 1 or name in TEXT_NAMES or Path(name or '').suffix in TEXT_SUFFIXES
        if text:
            if schema == 2:
                data.decode('utf-8')
                if b'\x00' in data:
                    raise ValueError('Distribution text contains NUL bytes: ' + str(name))
            data = data.replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def _validate_integrity(root):
    root = Path(root)
    errors = []
    system = root / '.SYSTEMX'
    seeds = json.loads((system / 'config/template-records.json').read_text())['sha256']
    for rel, expected in seeds.items():
        path = system / rel
        if not path.is_file() or digest(path, upstream=True) != expected:
            errors.append('Reusable seed differs: ' + rel)
    state = json.loads((system / 'INSTALLATION.json').read_text())
    version = state['activeVersion']
    release = system / '.systemx/releases' / version
    for retained, fingerprint in state['releases'].items():
        snapshot = system / '.systemx/releases' / retained
        manifest_path = snapshot / 'config/distribution.json'
        manifest = json.loads(manifest_path.read_text())
        if digest(manifest_path, upstream=True) != fingerprint or manifest['version'] != retained:
            errors.append('Release manifest fingerprint differs: ' + retained)
        for rel, expected in manifest['files'].items():
            path = snapshot / rel
            try:
                valid = (path.is_file() and not path.is_symlink() and
                         digest(path, upstream=True, name=rel, schema=manifest['schemaVersion']) == expected)
            except (ValueError, UnicodeError):
                valid = False
            if not valid:
                errors.append('Immutable upstream file differs: ' + rel + ' (' + retained + ')')
        listed = set(manifest['files']) | {'config/distribution.json'}
        for path in snapshot.rglob('*'):
            if path.is_symlink() or (path.is_file() and path.relative_to(snapshot).as_posix() not in listed):
                errors.append('Unexpected immutable upstream path: ' + str(path.relative_to(snapshot)))
    # Refreshed stock launchers must operate the selected manifest format.
    if tuple(int(part) for part in version.split('-')[0].split('.')) >= (1, 8, 7):
        selected_manifest = json.loads((release / 'config/distribution.json').read_text())
        for rel in BOOTSTRAP_FILES:
            path = system / rel
            if (not path.is_file() or path.is_symlink() or
                    digest(path, upstream=True, name=rel, schema=selected_manifest['schemaVersion']) !=
                    selected_manifest['files'][rel]):
                errors.append('Root bootstrap differs from selected release: ' + rel)
    if state['pinnedVersion'] != version or state['autoUpdate'] != 'manual':
        errors.append('Upstream defaults must be pinned with manual updates')
    for package in ('LAN-Builder', 'Webflow'):
        folder = system / 'LAN/Research' / package
        for line in (folder / 'RESEARCH-PACKAGE-SHA256SUMS.txt').read_text().splitlines():
            if not line.strip():
                continue
            expected, rel = line.split('  ', 1)
            path = root / rel if rel.startswith('.SYSTEMX/') else folder / rel
            if not path.is_file() or digest(path) != expected:
                errors.append('Research checksum differs: ' + str(path.relative_to(root)))
    package = json.loads((root / 'package.json').read_text())
    version = package['version']
    for rel in ('package-lock.json', '.SYSTEMX/Template/starter/package.json',
                '.SYSTEMX/Template/starter/package-lock.json'):
        data = json.loads((root / rel).read_text())
        if (data['version'], data['name']) != (version, package['name']):
            errors.append('Package identity/version differs: ' + rel)
    app = json.loads((system / 'webapp-version/version.json').read_text())['app']
    if app['version'] != version or (system / 'webapp-version/app-version.txt').read_text().strip() != version:
        errors.append('Webapp version files differ')
    if (system / 'version').is_dir():
        errors.append('Legacy version directory collides with standalone VERSION')
    tasks = json.loads((system / 'WORK/TASKS.json').read_text())
    projects = json.loads((system / 'Projects/REGISTRY.json').read_text())
    if tasks['tasks'] or projects['projects']:
        errors.append('Reusable template must not carry active tasks or registered projects')
    for name in ('DELIVERY-3.0.0.md', 'VALIDATION-3.0.0.md'):
        if (system / 'imports' / name).exists():
            errors.append('Historical private receipt must stay in private history: ' + name)
    return errors



PARITY_GROUPS = ('app', 'dependency', 'asset', 'configuration')
PARITY_COUNTS = {'app': 22, 'dependency': 2, 'asset': 2, 'configuration': 17}
STARTER_DIRECTORY = '.SYSTEMX/Template/starter'
PARITY_MAPPING = 'scripts/starter-parity.json'
PUBLIC_ROOTS = ('.github', 'public', 'scripts', 'src')
PRIVATE_DIRECTORIES = frozenset({'.git', 'node_modules', 'dist', 'dist-ssr',
                                  '.firebase', '.emulator-data', '.auth'})
PARITY_FILE_LIMIT = 2_000_000
PARITY_INVENTORY_LIMIT = 128
PARITY_DIRECTORY_LIMIT = 64
PARITY_TEXT_SUFFIXES = frozenset({'.json', '.md', '.js', '.mjs', '.ts', '.tsx',
                                   '.css', '.html', '.sh', '.yml', '.yaml', '.rules'})
PARITY_TEXT_NAMES = frozenset({'.env.example', '.firebaserc', '.gitignore',
                               '.node-version', '.nvmrc'})


class StarterParityError(ValueError):
    """A bounded public-input diagnostic, never source content or host paths."""


def _portable_path(value):
    if (not isinstance(value, str) or not value or len(value) > 240 or
            not re.fullmatch(r'[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*', value)):
        return False
    parts = value.split('/')
    return len(parts) <= 12 and all(
        part not in ('.', '..') and not part.endswith('.') and
        not re.fullmatch(r'(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?', part, re.I)
        for part in parts)


def _public_path(root, relative):
    if not _portable_path(relative):
        raise StarterParityError('Unsupported portable public path.')
    root = Path(root)
    if root.is_symlink() or getattr(root, 'is_junction', lambda: False)():
        raise StarterParityError('Public root must not be a link.')
    current = root
    for part in relative.split('/'):
        if current.exists() and not current.is_dir():
            raise StarterParityError('Non-directory component in public path: ' + relative)
        if current.is_dir():
            matches = [entry.name for entry in current.iterdir()
                       if entry.name.casefold() == part.casefold()]
            if matches and matches != [part]:
                raise StarterParityError('Case collision or nonexact case: ' + relative)
        current = current / part
        if current.is_symlink() or getattr(current, 'is_junction', lambda: False)():
            raise StarterParityError('Symbolic link or junction in public path: ' + relative)
        if not current.exists():
            break
    destination = root.joinpath(*relative.split('/'))
    if not destination.resolve().is_relative_to(root.resolve()):
        raise StarterParityError('Public path escapes its root.')
    return destination


def _public_bytes(root, relative, limit=PARITY_FILE_LIMIT):
    path = _public_path(root, relative)
    info = path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
        raise StarterParityError('Expected bounded regular public file: ' + relative)
    # O_NOFOLLOW closes the leaf-link race where supported; parent components
    # were checked above. Windows also receives the component/junction checks.
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    with os.fdopen(descriptor, 'rb') as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode):
            raise StarterParityError('Expected regular public file: ' + relative)
        data = handle.read(limit + 1)
    if len(data) > limit:
        raise StarterParityError('Public file exceeds byte limit: ' + relative)
    return data


def portable_fingerprint(data, mode):
    """Pure reviewed-text equivalence, separate from byte-exact asset hashes."""
    if mode == 'utf8-lf-sha256':
        data.decode('utf-8')
        if b'\x00' in data:
            raise StarterParityError('Reviewed text contains NUL bytes.')
        data = data.replace(b'\r\n', b'\n')
    elif mode != 'sha256':
        raise StarterParityError('Unsupported public fingerprint mode.')
    return hashlib.sha256(data).hexdigest()


def _validate_parity_mapping(mapping):
    if (not isinstance(mapping, dict) or set(mapping) !=
            {'schemaVersion', 'kind', 'review', 'starterDirectory', 'publicRoots',
             'rootOnlyScope', 'rootOnlyDependencies', 'files'} or
            mapping['schemaVersion'] != 1 or mapping['kind'] != 'reviewed-starter-parity' or
            mapping['starterDirectory'] != STARTER_DIRECTORY or
            mapping['publicRoots'] != list(PUBLIC_ROOTS) or
            not isinstance(mapping['files'], list) or len(mapping['files']) != 43):
        raise StarterParityError('Starter mapping requires the exact versioned 43-file public contract.')
    review = mapping['review']
    if (not isinstance(review, dict) or set(review) != {'sourceBase', 'reviewedOn'} or
            not re.fullmatch(r'[a-f0-9]{40}', str(review['sourceBase'])) or
            not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(review['reviewedOn']))):
        raise StarterParityError('Starter mapping requires explicit source review metadata.')
    scope = mapping['rootOnlyScope']
    if (not isinstance(scope, list) or not 1 <= len(scope) <= 12 or
            any(not isinstance(item, dict) or set(item) != {'paths', 'reason'} or
                not isinstance(item['paths'], list) or not item['paths'] or
                len(item['paths']) > 16 or len(set(item['paths'])) != len(item['paths']) or
                not all(_portable_path(path) for path in item['paths']) or
                not isinstance(item['reason'], str) or not 20 <= len(item['reason']) <= 300
                or any(ord(char) < 32 for char in item['reason'])
                for item in scope)):
        raise StarterParityError('Root-only features require explicit paths and concrete reasons.')
    if mapping['rootOnlyDependencies'] != {
            'dependencies': ['@gusto/embedded-react-sdk', '@tanstack/react-query'],
            'devDependencies': ['@playwright/test']}:
        raise StarterParityError('Root-only dependencies require the finite reviewed SDK/query/browser set.')
    counts = dict.fromkeys(PARITY_GROUPS, 0)
    seen = {}; leaves = set()
    for entry in mapping['files']:
        if not isinstance(entry, dict):
            raise StarterParityError('Starter mapping entries must be objects.')
        keys = {'group', 'starter', 'root', 'relation', 'hashMode'}
        if entry.get('relation') in ('intentional', 'starter-only'):
            keys |= {'reason', 'rootSha256', 'starterSha256'}
        if (set(entry) != keys or entry.get('group') not in PARITY_GROUPS or
                entry.get('relation') not in ('equal', 'intentional', 'starter-only') or
                not _portable_path(entry.get('starter')) or entry.get('root') != entry['starter']):
            raise StarterParityError('Unsupported starter mapping entry or paired path.')
        path = entry['starter']; expected_group = ('app' if path.startswith('src/') else
            'asset' if path.startswith('public/') else
            'dependency' if path in ('package.json', 'package-lock.json') else 'configuration')
        if entry['group'] != expected_group:
            raise StarterParityError('Starter path has an incorrect feature group: ' + path)
        reviewed_text = Path(path).suffix in PARITY_TEXT_SUFFIXES or path in PARITY_TEXT_NAMES
        expected_mode = 'sha256' if entry['group'] == 'asset' or not reviewed_text else 'utf8-lf-sha256'
        if entry['hashMode'] != expected_mode:
            raise StarterParityError('Starter path has an unsupported fingerprint policy: ' + path)
        if path in leaves:
            raise StarterParityError('Duplicate starter mapping path: ' + path)
        if any(path.startswith(leaf + '/') or leaf.startswith(path + '/') for leaf in leaves):
            raise StarterParityError('File/directory collision in starter mapping.')
        leaves.add(path)
        for index in range(1, len(path.split('/')) + 1):
            prefix = '/'.join(path.split('/')[:index]); folded = prefix.casefold()
            if folded in seen and seen[folded] != prefix:
                raise StarterParityError('Case collision in starter mapping.')
            seen[folded] = prefix
        if entry['relation'] != 'equal':
            if (not isinstance(entry['reason'], str) or not 20 <= len(entry['reason']) <= 300 or
                    any(ord(char) < 32 for char in entry['reason']) or
                    not re.fullmatch(r'[a-f0-9]{64}', str(entry['starterSha256'])) or
                    (entry['relation'] == 'intentional' and
                     not re.fullmatch(r'[a-f0-9]{64}', str(entry['rootSha256']))) or
                    (entry['relation'] == 'starter-only' and entry['rootSha256'] is not None)):
                raise StarterParityError('Intentional differences require concrete reasons and separate reviewed fingerprints.')
        counts[entry['group']] += 1
    if counts != PARITY_COUNTS:
        raise StarterParityError('Starter mapping must retain 22 app, 2 dependency, 2 asset and 17 configuration files.')


def _starter_inventory(root):
    starter = _public_path(root, STARTER_DIRECTORY)
    if not starter.is_dir():
        raise StarterParityError('Starter public directory is missing.')
    files = []; excluded = []; seen = {}; directories = 0
    def walk(folder, prefix=''):
        nonlocal directories
        directories += 1
        if directories > PARITY_DIRECTORY_LIMIT:
            raise StarterParityError('Starter public directory limit exceeded; inventory is incomplete.')
        for path in sorted(folder.iterdir(), key=lambda item: item.name):
            relative = prefix + path.name
            private_environment = path.name == '.env' or path.name.startswith('.env.')
            if not prefix and (path.name in PRIVATE_DIRECTORIES or
                    (private_environment and path.name != '.env.example')):
                excluded.append('private-environment' if private_environment else path.name)
                continue
            if not _portable_path(relative):
                raise StarterParityError('Unsupported portable starter inventory path.')
            for index in range(1, len(relative.split('/')) + 1):
                part = '/'.join(relative.split('/')[:index]); folded = part.casefold()
                if folded in seen and seen[folded] != part:
                    raise StarterParityError('Case collision in starter public inventory.')
                seen[folded] = part
            if path.is_symlink() or getattr(path, 'is_junction', lambda: False)():
                raise StarterParityError('Symbolic link or junction in starter public inventory: ' + relative)
            if path.is_dir():
                if not prefix and path.name not in PUBLIC_ROOTS:
                    raise StarterParityError('Unlisted starter public directory: ' + relative)
                walk(path, relative + '/')
            elif path.is_file():
                files.append(relative)
                if len(files) > PARITY_INVENTORY_LIMIT:
                    raise StarterParityError('Starter public file limit exceeded; inventory is incomplete.')
            else:
                raise StarterParityError('Unsupported nonregular starter path: ' + relative)
    walk(starter)
    return files, sorted(set(excluded))


def _package_parity_errors(root, mapping):
    packages = []; locks = []
    try:
        for prefix in ('', STARTER_DIRECTORY + '/'):
            packages.append(json.loads(_public_bytes(root, prefix + 'package.json')))
            locks.append(json.loads(_public_bytes(root, prefix + 'package-lock.json')))
        errors = []
        for label, package, lock in zip(('root', 'starter'), packages, locks):
            if (not isinstance(package, dict) or not isinstance(lock, dict) or
                    not isinstance(package.get('name'), str) or not package['name'] or
                    not re.fullmatch(r'\d+\.\d+\.\d+', str(package.get('version'))) or
                    not isinstance(package.get('engines'), dict) or
                    not re.fullmatch(r'>=\d+\.\d+\.\d+', str(package['engines'].get('node'))) or
                    not re.fullmatch(r'npm@\d+\.\d+\.\d+', str(package.get('packageManager')))):
                errors.append(label + ' package identity/runtime declarations are invalid.')
            metadata = lock.get('packages', {}).get('')
            if not isinstance(metadata, dict) or any(metadata.get(key) != package.get(key)
                    for key in ('name', 'version', 'dependencies', 'devDependencies', 'engines')) or any(
                    lock.get(key) != package.get(key) for key in ('name', 'version')):
                errors.append(label + ' lock root metadata differs from its package manifest.')
        for key in ('name', 'version', 'engines', 'packageManager'):
            if packages[0].get(key) != packages[1].get(key):
                errors.append('Root/starter package ' + key + ' differs.')
        for field, root_only in mapping['rootOnlyDependencies'].items():
            left = packages[0].get(field, {}); right = packages[1].get(field, {})
            if (not isinstance(left, dict) or not isinstance(right, dict) or
                    set(left) != set(right) | set(root_only) or
                    any(left.get(key) != value for key, value in right.items())):
                errors.append('Shared ' + field + ' differ or an unreviewed root-only dependency exists.')
        pins = [_public_bytes(root, prefix + name).strip() for prefix in ('', STARTER_DIRECTORY + '/')
                for name in ('.nvmrc', '.node-version')]
        if len(set(pins)) != 1 or not re.fullmatch(rb'\d+\.\d+\.\d+', pins[0]):
            errors.append('Root/starter runtime pins must select one exact stable version.')
        elif re.fullmatch(r'>=\d+\.\d+\.\d+', str(packages[0].get('engines', {}).get('node'))):
            pin = tuple(map(int, pins[0].decode().split('.')))
            minimum = tuple(map(int, packages[0]['engines']['node'][2:].split('.')))
            if pin < minimum:
                errors.append('Root/starter runtime pin is older than the declared Node minimum.')
        return errors
    except (OSError, ValueError, TypeError, AttributeError, KeyError):
        return ['Package/runtime metadata is missing, unsafe or invalid; shared contracts are unverified.']


def starter_parity(root, mapping=None):
    """Read-only finite starter comparison. Hash equality never updates review authority."""
    result = {'schemaVersion': 1, 'kind': 'starter-feature-parity', 'ok': False,
              'starterDirectory': STARTER_DIRECTORY,
              'scope': 'Finite reviewed starter public files; root-only scope is explanatory and never excludes starter additions.',
              'groups': [{'id': group, 'entries': [], 'diagnostics': []} for group in PARITY_GROUPS],
              'counts': {'mapped': 0, 'inventoried': None, 'matched': 0,
                         'intentional': 0, 'starterOnly': 0, 'differences': 0},
              'inventoryComplete': False, 'excludedRuntimeScope': [], 'rootOnlyScope': [], 'errors': []}
    result['excludedRuntimePolicy'] = sorted(PRIVATE_DIRECTORIES) + [
        '.env and .env.* except the reviewed .env.example']
    groups = {group['id']: group for group in result['groups']}
    try:
        if mapping is None:
            mapping = json.loads(_public_bytes(root, PARITY_MAPPING, 131_072))
        _validate_parity_mapping(mapping)
        result['counts']['mapped'] = len(mapping['files'])
        result['rootOnlyScope'] = mapping['rootOnlyScope']
        files, excluded = _starter_inventory(root)
        result['inventoryComplete'] = True; result['excludedRuntimeScope'] = excluded
        result['counts']['inventoried'] = len(files)
        listed = {entry['starter'] for entry in mapping['files']}
        for path in sorted(set(files) - listed):
            group = 'app' if path.startswith('src/') else 'asset' if path.startswith('public/') else 'configuration'
            groups[group]['entries'].append({'starter': path, 'root': None, 'relation': 'unlisted',
                                             'status': 'unlisted-starter', 'change': 'added'})
        for entry in sorted(mapping['files'], key=lambda item: item['starter']):
            row = {key: entry[key] for key in ('starter', 'root', 'relation', 'hashMode')}
            if 'reason' in entry: row['reason'] = entry['reason']
            row.update(status='changed', change='changed')
            try:
                starter = _public_path(root, STARTER_DIRECTORY + '/' + entry['starter'])
                host = _public_path(root, entry['root'])
                row['missingSides'] = ([] if starter.exists() else ['starter']) + (
                    ['root'] if not host.exists() and entry['relation'] != 'starter-only' else [])
                if not starter.exists(): row.update(status='missing-starter', change='removed')
                elif not starter.is_file(): row.update(status='invalid-starter-type', change='invalid')
                elif entry['relation'] == 'starter-only' and host.exists():
                    row.update(status='unexpected-root', change='added')
                elif entry['relation'] != 'starter-only' and not host.exists():
                    row.update(status='missing-root', change='missing')
                elif entry['relation'] != 'starter-only' and not host.is_file():
                    row.update(status='invalid-root-type', change='invalid')
                else:
                    starter_bytes = _public_bytes(root, STARTER_DIRECTORY + '/' + entry['starter'])
                    root_bytes = None if entry['relation'] == 'starter-only' else _public_bytes(root, entry['root'])
                    sh = portable_fingerprint(starter_bytes, entry['hashMode'])
                    rh = None if root_bytes is None else portable_fingerprint(root_bytes, entry['hashMode'])
                    relation = ('root-absent' if root_bytes is None else 'exact' if starter_bytes == root_bytes else
                                'lf-equivalent' if sh == rh else 'different')
                    row.update(actualStarterSha256=sh, actualRootSha256=rh, pairedContent=relation)
                    if entry['relation'] == 'equal':
                        if sh == rh: row.update(status='matched', change=None)
                    else:
                        row.update(expectedStarterSha256=entry['starterSha256'], expectedRootSha256=entry['rootSha256'])
                        if sh == entry['starterSha256'] and rh == entry['rootSha256']:
                            row.update(status=entry['relation'], change=None)
            except (OSError, ValueError, UnicodeError):
                row.update(status='invalid-public-path', change='invalid')
            groups[entry['group']]['entries'].append(row)
        groups['dependency']['diagnostics'] = _package_parity_errors(root, mapping)
        for group in result['groups']:
            group['entries'].sort(key=lambda entry: entry['starter'])
            group['counts'] = {'expected': PARITY_COUNTS[group['id']], 'matched': 0,
                               'intentional': 0, 'starterOnly': 0,
                               'added': 0, 'removed': 0, 'changed': 0, 'missing': 0, 'invalid': 0}
            for row in group['entries']:
                counter = {'matched': 'matched', 'intentional': 'intentional', 'starter-only': 'starterOnly'}.get(row['status'], 'differences')
                result['counts'][counter] += 1
                if counter != 'differences': group['counts'][counter] += 1
                if row['change'] is not None:
                    group['counts'][row['change']] += 1
                    result['errors'].append('Starter parity [' + group['id'] + ']: ' + row['status'] + ': ' + row['starter'])
            result['errors'].extend('Starter parity [dependency]: ' + error for error in group['diagnostics'])
        result['ok'] = not result['errors']
    except StarterParityError as error:
        result['errors'].append('Starter parity mapping/inventory: ' + str(error))
    except (OSError, ValueError, TypeError, KeyError, UnicodeError):
        result['errors'].append('Starter parity mapping/inventory is missing, unsafe, unsupported or invalid.')
    return result


def template_report(root):
    parity = starter_parity(root)
    safe = True
    for relative in ('package.json', 'package-lock.json', STARTER_DIRECTORY + '/package.json',
                     STARTER_DIRECTORY + '/package-lock.json'):
        try: _public_path(root, relative)
        except (OSError, ValueError): safe = False
    try:
        if not safe: raise StarterParityError('Unsafe required integrity input.')
        integrity = _validate_integrity(root)
        available = True
    except (OSError, ValueError, KeyError, TypeError):
        integrity = ['Template integrity checks unavailable: required public input is missing, unsafe or invalid.']
        available = False
    return {'schemaVersion': 1, 'kind': 'template-validation',
            'ok': not integrity and parity['ok'], 'integrityChecksAvailable': available,
            'integrityErrors': integrity, 'starterParity': parity,
            'errors': integrity + parity['errors']}


def validate(root):
    return template_report(root)['errors']


def format_starter_parity(report):
    lines = []
    if not report['inventoryComplete']:
        return ['Starter public inventory is unavailable or incomplete; no grouped path counts are verified.']
    for group in report['groups']:
        entries = group['entries']; changed = [row for row in entries if row['change'] is not None]
        lines.append('Starter ' + group['id'] + ': ' + str(len(entries)) + ' paths; ' +
                     str(sum(row['status'] == 'matched' for row in entries)) + ' equal; ' +
                     str(sum(row['status'] in ('intentional', 'starter-only') for row in entries)) +
                     ' reviewed intentional; ' + str(len(changed)) + ' differences.')
        lines.extend('  ' + row['status'] + ': ' + row['starter'] for row in changed)
    return lines

def tree(root):
    return subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD^{tree}'], text=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--against', type=Path)
    parser.add_argument('--json', action='store_true', help='Emit integrity and grouped starter results without modifying files')
    args = parser.parse_args()
    report = template_report(args.root)
    errors = report['errors']
    if args.against:
        for root in (args.root, args.against):
            if subprocess.check_output(['git', '-C', str(root), 'status', '--porcelain'], text=True).strip():
                errors.append('Parity requires a clean committed checkout: ' + str(root))
        if tree(args.root) != tree(args.against):
            errors.append('Committed mirror trees differ')
        else:
            if not args.json:
                print('Identical committed tree: ' + tree(args.root))
    report['ok'] = not errors
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for line in format_starter_parity(report['starterParity']):
            print(line)
        for error in errors:
            print('FAIL: ' + error)
        if not errors:
            print('Template seeds, immutable release, research and versions verified.')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
