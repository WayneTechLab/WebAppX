#!/usr/bin/env python3
"""Read-only ownership and retained-default inventory for a managed host.

Only the manager's local read/verification helpers are used. Equality describes
content; it never authorizes an import, refresh, overwrite, or role activation.
"""
import argparse
from collections import Counter
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = 1
POLICY_VERSION = 1
MAX_ENTRIES = 20000
MAX_RELEASES = 64
MAX_DEPTH = 64
MAX_TOTAL_BYTES = 128 * 1024 * 1024
MAX_PAGE = 1000
DEFAULT_PAGE = 200
BOOTSTRAP_FILES = frozenset({
    'manager.py', 'lifecycle.py', 'versions.py', 'systemx_paths.py',
    'SYSTEMX.sh', 'SYSTEMX.ps1', 'INSTALL.sh', 'INSTALL.ps1',
})
RECORD_ROOTS = frozenset({'GLOBAL', 'PLAN', 'WORK', 'MEMORY', 'AGENTS', 'Projects'})
EXTENSION_ROOTS = frozenset({
    'LAN', 'KIT', 'Template', 'GUSTO', 'deploy', 'hooks',
    'Unified-Setup-Process', 'Standard-MD-Files', 'Stock-Setup-Files',
    'Setup-Input_MD', 'tooling',
})
ENTRYPOINTS = frozenset({
    'README.md', 'WSG-MENU.sh', 'wsg-agi.sh', 'AGENTS.md', 'STANDARD.md',
    'START-HERE.md', 'FORMAT.md', 'USER-INGEST-AND-PRODUCTION-SETUP.md',
    'WEBAPPX-ROADMAP.md',
})
HOST_SCRIPTS = frozenset({
    'bootstrap.sh',
    'import-setup-packet.sh', 'validate-setup-packet.mjs',
    'validate-markdown-links.mjs', 'export-standard-md-packet.sh',
    'account-level-check.mjs', 'agent-standard-check.mjs', 'env-data.mjs',
    'install-command.sh', 'assert-lan-isolation.mjs',
    'verify-template-structure.mjs', 'security-check.mjs',
    'auth-mfa-readiness-check.mjs', 'start-production.sh', 'system-audit.sh',
    'ingest-setup-md.sh', 'version-bump.sh',
})
EXCLUDED_ROOTS = frozenset({'local', 'logs', 'state', 'cache'})
EXCLUDED_ANYWHERE = frozenset({'__pycache__', '.cache', 'node_modules'})
EXCLUDED_EXACT = frozenset({
    'Template/interview.answers', 'status/setup-state.env',
    'webapp-version/deploy-count.txt', '.systemx/update.lock', '.systemx/last-check.json',
})
_MANAGER = None


class ProvenanceError(ValueError):
    """A safe diagnostic containing only a logical path and fixed explanation."""
    def __init__(self, code, path, message):
        self.code, self.path, self.message = code, path, message
        super().__init__(message + (' [' + path + ']' if path else ''))

    def diagnostic(self):
        return {'code': self.code, 'path': self.path, 'message': self.message}


def _relative(value):
    """Accept only exact portable paths relative to the outer .SYSTEMX."""
    if not isinstance(value, str) or not value or len(value) > 1024:
        raise ProvenanceError('invalid-path', '', 'Use a bounded relative .SYSTEMX path')
    parts = value.split('/')
    reserved = {'CON', 'PRN', 'AUX', 'NUL', *(f'COM{n}' for n in range(1, 10)),
                *(f'LPT{n}' for n in range(1, 10))}
    if ('\\' in value or ':' in value or any(
            p in {'', '.', '..'} or p.endswith((' ', '.')) or
            re.search(r'[<>"|?*\x00-\x1f]', p) or p.split('.')[0].upper() in reserved
            for p in parts)):
        raise ProvenanceError('invalid-path', '', 'Use an exact portable relative .SYSTEMX path')
    return value


def _excluded(path):
    parts = path.split('/')
    # Registered release payloads have their own immutable manifest contract;
    # outer runtime/name exclusions cannot hide or reclassify snapshot files.
    if parts[:2] == ['.systemx', 'releases']:
        return False
    if path in EXCLUDED_EXACT or parts[0] in EXCLUDED_ROOTS or any(p in EXCLUDED_ANYWHERE for p in parts):
        return True
    if any(parts[n] == '.SYSTEMXP' and parts[n + 1] in EXCLUDED_ROOTS for n in range(len(parts) - 1)):
        return True
    if parts[0] == '.systemx' and len(parts) > 1 and parts[1] != 'releases':
        return True
    if parts[:2] in (['LAN', 'Temp'], ['LAN', 'Backup'], ['LAN', 'Files']):
        return True
    leaf = parts[-1]
    if leaf in {'.DS_Store', '.env', '.pnp', '.pnp.js'}:
        return True
    if leaf.startswith('.env.') and leaf != '.env.example':
        return True
    if leaf.endswith(('.pyc', '.pyo', '.pid', '.token', '.local.json', '.log', '.bak', '.secret')):
        return True
    if leaf.endswith('.secrets.env') or leaf == 'secrets.env':
        return True
    return parts[0] == 'Setup-Input_MD' and len(parts) > 1 and leaf not in {'.gitkeep', 'README.md'}


def classify_path(path, known_default=False):
    """Return the documented host policy independently of content equality.

    ``known_default`` means that the same logical path occurs in a verified
    retained bundle. It is a provenance hint, never replacement authority.
    """
    path = _relative(path)
    parts = path.split('/')
    top = parts[0]
    if parts[:2] == ['.systemx', 'releases']:
        return {'ownership': 'upstream', 'role': 'immutable-release', 'updatePolicy': 'immutable-retain'}
    if _excluded(path):
        return {'ownership': 'local', 'role': 'excluded-local-state', 'updatePolicy': 'exclude-without-reading'}
    if path == 'INSTALLATION.json':
        return {'ownership': 'manager', 'role': 'installation-metadata', 'updatePolicy': 'manager-selection-only'}
    if top == 'imports':
        return {'ownership': 'manager', 'role': 'import-metadata', 'updatePolicy': 'retain-first-import-receipt'}
    if top in RECORD_ROOTS or path in {'CURRENT.md', 'project.json'}:
        return {'ownership': 'host', 'role': 'project-record', 'updatePolicy': 'preserve-host-record'}
    if top == 'config':
        return {'ownership': 'host', 'role': 'host-configuration', 'updatePolicy': 'preserve-host-configuration'}
    if top == 'status':
        return {'ownership': 'host', 'role': 'host-history', 'updatePolicy': 'preserve-host-history'}
    if top == 'webapp-version':
        return {'ownership': 'host', 'role': 'host-version', 'updatePolicy': 'maintain-host-version-separately'}
    if path in {'VERSION', 'SOURCE.json'}:
        return {'ownership': 'host', 'role': 'initial-provenance', 'updatePolicy': 'preserve-initial-provenance'}
    if path in ENTRYPOINTS or top in {'docs', 'AI'}:
        return {'ownership': 'host', 'role': 'reconciled-entrypoint', 'updatePolicy': 'explicit-host-reconciliation'}
    if (top in EXTENSION_ROOTS or (top == 'scripts' and len(parts) == 2 and
            (parts[1] in HOST_SCRIPTS or parts[1].startswith(('deploy', 'setup', 'firebase-', 'first-time-', 'build-setup-'))))):
        return {'ownership': 'host', 'role': 'host-extension', 'updatePolicy': 'preserve-host-extension'}
    if path in BOOTSTRAP_FILES:
        return {'ownership': 'manager', 'role': 'bootstrap', 'updatePolicy': 'explicit-byte-exact-bootstrap-review'}
    if known_default:
        return {'ownership': 'imported-default', 'role': 'outer-default', 'updatePolicy': 'preserve-existing-review-before-reconcile'}
    return {'ownership': 'undetermined', 'role': 'unrecognized-outer-file', 'updatePolicy': 'preserve-and-review'}


def is_host_owned(path):
    """Whether the explicit host policy protects this path, including host-only paths."""
    return classify_path(path)['ownership'] == 'host'


def _manager():
    global _MANAGER
    if _MANAGER is None:
        # The trusted helper comes from this tool's checkout, never --target.
        source = ROOT / '.SYSTEMX/manager.py'
        spec = importlib.util.spec_from_file_location('webappx_provenance_manager', source)
        module = importlib.util.module_from_spec(spec)
        exec(compile(source.read_bytes(), str(source), 'exec'), module.__dict__)
        _MANAGER = module
    return _MANAGER


def _checked_path(outer, relative, manager):
    try:
        return manager.safe_path(outer, relative)
    except (OSError, ValueError):
        raise ProvenanceError('unsafe-path', relative, 'Refusing a link, path escape, or invalid parent type') from None


def _regular(path, relative, manager):
    try:
        return manager.regular_bytes(path)
    except (OSError, ValueError):
        raise ProvenanceError('unreadable-file', relative, 'Expected a stable bounded regular file') from None


def _root(target, manager):
    try:
        raw = Path(os.path.abspath(os.path.expanduser(os.fspath(target))))
        if manager.is_link(raw):
            raise ValueError('linked target')
        root = manager.project_root(raw)
        manager.inspect_layout(root)
        return root
    except (OSError, ValueError, TypeError):
        raise ProvenanceError('invalid-target', '', 'Select a real local project with one canonical .SYSTEMX directory') from None


def _preflight_snapshot(snapshot, relative, manager, budget):
    """Enforce a total byte bound before asking the manager to load a bundle."""
    raw = _regular(_checked_path(snapshot, manager.MANIFEST, manager), relative + '/' + manager.MANIFEST, manager)
    try:
        manifest = manager.decode(raw)
        names = manifest['files']
        if not isinstance(names, dict) or not 1 <= len(names) <= manager.MAX_FILES:
            raise ValueError('invalid manifest')
        size = len(raw)
        for name in names:
            path = _checked_path(snapshot, manager.portable_path(name), manager)
            info = path.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_size > manager.MAX_FILE:
                raise ValueError('invalid file type or size')
            size += info.st_size
        budget['bytes'] += size
        if budget['bytes'] > MAX_TOTAL_BYTES:
            raise ProvenanceError('byte-limit', relative, 'Inspection exceeds the total byte-read limit')
    except ProvenanceError:
        raise
    except (OSError, ValueError, UnicodeError, KeyError, TypeError):
        raise ProvenanceError('invalid-retained-release', relative, 'Retained release manifest or file boundaries are invalid') from None


def _retained(root, state, manager, budget):
    if not 1 <= len(state['releases']) <= MAX_RELEASES:
        raise ProvenanceError('release-limit', 'INSTALLATION.json', 'Retained release count exceeds the inspection limit')
    bundles = {}
    for version in sorted(state['releases'], key=manager.version_key):
        relative = '.systemx/releases/' + version
        snapshot = _checked_path(root / '.SYSTEMX', relative, manager)
        _preflight_snapshot(snapshot, relative, manager, budget)
        try:
            bundle = manager.read_bundle(snapshot, exact=True)
            issues = manager.snapshot_issues(snapshot, bundle, complete=True)
            if (issues or bundle['version'] != version or
                    bundle['manifestSha256'] != state['releases'][version]):
                raise ValueError('retained fingerprint mismatch')
        except (OSError, ValueError, UnicodeError, KeyError, TypeError):
            raise ProvenanceError('invalid-retained-release', relative,
                                  'Retained release integrity failed; restore the reviewed snapshot before inspection') from None
        bundles[version] = bundle
    return bundles


def _scan(outer, manager):
    """List file/type boundaries and excluded roots without reading file content."""
    rows = []
    visited = 0
    pending = [(outer, '')]
    while pending:
        folder, prefix = pending.pop()
        if prefix:
            _checked_path(outer, prefix, manager)
        if len(PurePosixPath(prefix).parts) > MAX_DEPTH:
            raise ProvenanceError('depth-limit', prefix, 'Inspection exceeds the directory-depth limit')
        try:
            with os.scandir(folder) as stream:
                children = []
                for child in stream:
                    visited += 1
                    if visited > MAX_ENTRIES:
                        raise ProvenanceError('entry-limit', prefix, 'Inspection exceeds the bounded entry limit')
                    children.append(child)
            children.sort(key=lambda e: e.name)
        except OSError:
            raise ProvenanceError('unreadable-directory', prefix, 'Cannot inspect directory entries') from None
        folded = set()
        for child in children:
            relative = child.name if not prefix else prefix + '/' + child.name
            _relative(relative)
            if child.name.casefold() in folded:
                raise ProvenanceError('case-collision', prefix, 'Directory entries have conflicting case spellings')
            folded.add(child.name.casefold())
            try:
                info = child.stat(follow_symlinks=False)
                linked = child.is_symlink() or manager.is_link(Path(child.path))
            except OSError:
                raise ProvenanceError('unreadable-entry', relative, 'Cannot inspect entry type') from None
            if linked:
                raise ProvenanceError('unsafe-path', relative, 'Refusing a symlink or junction')
            if _excluded(relative):
                rows.append((relative, 'excluded'))
            elif stat.S_ISDIR(info.st_mode):
                pending.append((Path(child.path), relative))
                # Include directories only when they block known file paths;
                # empty directories otherwise have no import-content provenance.
                rows.append((relative, 'directory'))
            elif stat.S_ISREG(info.st_mode):
                rows.append((relative, 'file'))
            else:
                raise ProvenanceError('special-entry', relative, 'Refusing a nonregular filesystem entry')
    return sorted(rows)


def _relations(path, data, bundles, manager):
    matches = []
    for version, bundle in bundles.items():
        reference = bundle['files'].get(path)
        if reference is None:
            continue
        relation = None
        if data == reference:
            relation = 'exact'
        else:
            schema = manager.decode(bundle['files'][manager.MANIFEST])['schemaVersion']
            try:
                if manager.distribution_digest(path, data, schema) == manager.distribution_digest(path, reference, schema):
                    relation = 'manifest-equivalent'
            except (ValueError, UnicodeError):
                pass  # A modified host text file may no longer satisfy a text manifest.
        if relation:
            matches.append({'version': version, 'relation': relation})
    return matches


def collect_inventory(target, *, manager=None):
    """Return the complete deterministic inventory under fixed inspection caps.

    This pure inspection API performs no writes or network/process operations.
    It raises ProvenanceError instead of returning partial or unverified results.
    The returned paths are relative to the outer .SYSTEMX. No file values, local
    absolute paths, credentials, import receipt contents, or timestamps appear.
    """
    manager = manager or _manager()
    root = _root(target, manager)
    outer = root / '.SYSTEMX'
    state = None
    budget = {'bytes': 0}
    if outer.exists():
        installation = _checked_path(outer, 'INSTALLATION.json', manager)
        if installation.exists():
            try:
                state = manager.load_state(root)
            except (OSError, ValueError, UnicodeError, KeyError, TypeError):
                raise ProvenanceError('invalid-installation', 'INSTALLATION.json', 'Installation metadata is invalid') from None
    status = 'managed' if state is not None else 'unmanaged' if outer.exists() else 'not-installed'
    # Bound structural inspection before the manager's complete snapshot walk,
    # including unlisted files/directories that its manifest read will not see.
    rows = _scan(outer, manager) if outer.exists() else []
    bundles = _retained(root, state, manager, budget) if state else {}
    known = {name for bundle in bundles.values() for name in bundle['files']}
    entries = []
    diagnostics = []
    for path, kind in rows:
        parts = path.split('/')
        if parts[:2] == ['.systemx', 'releases']:
            if len(parts) < 3:
                continue
            version = parts[2]
            if version not in bundles:
                raise ProvenanceError('unregistered-release', '.systemx/releases/' + version,
                                      'Release content is absent from installation metadata')
            if kind == 'directory':
                continue
            release_path = '/'.join(parts[3:])
            if release_path not in bundles[version]['files']:
                raise ProvenanceError('invalid-retained-release', path, 'Unexpected retained release content')
            entries.append({'path': path, 'type': kind, **classify_path(path),
                            'contentRelation': 'verified-retained',
                            'matchingRetainedVersions': [{'version': version, 'relation': 'exact'}],
                            'bootstrapExactMatch': False})
            continue
        if path == '.systemx':
            continue
        if kind == 'directory' and path not in known:
            continue
        policy = classify_path(path, path in known)
        matches = []
        if kind == 'excluded':
            relation = 'excluded-unread'
        elif kind == 'directory':
            relation = 'type-conflict'
            diagnostics.append({'code': 'outer-type-conflict', 'path': path,
                                'message': 'A directory occupies a retained default file path; preserve and review'})
        elif path in known:
            data = _regular(_checked_path(outer, path, manager), path, manager)
            budget['bytes'] += len(data)
            if budget['bytes'] > MAX_TOTAL_BYTES:
                raise ProvenanceError('byte-limit', path, 'Inspection exceeds the total byte-read limit')
            matches = _relations(path, data, bundles, manager)
            relation = ('exact' if any(m['relation'] == 'exact' for m in matches) else
                        'manifest-equivalent' if matches else 'modified')
        elif state is None:
            relation = 'unavailable-unmanaged'
        elif policy['ownership'] == 'manager':
            relation = 'metadata-unread'
        else:
            relation = 'unrecognized-unread'
        entries.append({'path': path, 'type': kind, **policy, 'contentRelation': relation,
                        'matchingRetainedVersions': matches,
                        'bootstrapExactMatch': path in BOOTSTRAP_FILES and any(
                            m['relation'] == 'exact' for m in matches)})
    entries.sort(key=lambda entry: entry['path'])
    counts = {field: dict(sorted(Counter(entry[field] for entry in entries).items()))
              for field in ('ownership', 'role', 'contentRelation')}
    return {'schemaVersion': SCHEMA_VERSION, 'policyVersion': POLICY_VERSION,
            'kind': 'systemx-provenance', 'valid': True,
            'installationStatus': status,
            'selectedVersion': state['activeVersion'] if state else None,
            'pinnedVersion': state['pinnedVersion'] if state else None,
            'autoUpdate': state['autoUpdate'] if state else None, 'retainedVersions': list(bundles),
            'contentComparison': 'verified-retained-releases' if state else 'unavailable',
            'integrity': 'verified-all-retained' if state else status, 'entries': entries, 'counts': counts,
            'diagnostics': diagnostics, 'total': len(entries), 'returned': len(entries),
            'truncated': False, 'continuation': None}


def inventory(target, *, limit=DEFAULT_PAGE, after=None, path=None, manager=None):
    """Inspect all retained content, then select one deterministic bounded page.

    after is the last logical path returned by the previous page. path selects
    one exact logical path independently of pagination. Neither accepts a prefix,
    wildcard, absolute path, or traversal. Re-run pages on a stable checkout.
    """
    if type(limit) is not int or not 1 <= limit <= MAX_PAGE:
        raise ProvenanceError('invalid-limit', '', f'Limit must be an integer from 1 to {MAX_PAGE}')
    if after is not None:
        _relative(after)
    if path is not None:
        _relative(path)
    if after is not None and path is not None:
        raise ProvenanceError('invalid-query', '', 'Use either an exact path or a continuation')
    report = collect_inventory(target, manager=manager)
    all_entries = report['entries']
    if path is not None:
        selected = [entry for entry in all_entries if entry['path'] == path]
        report.update({'query': {'path': path}, 'found': bool(selected), 'entries': selected,
                       'returned': len(selected)})
    else:
        if after is not None and after not in {entry['path'] for entry in all_entries}:
            raise ProvenanceError('invalid-continuation', after, 'Continuation path is absent; retry from the first page')
        remaining = [entry for entry in all_entries if after is None or entry['path'] > after]
        selected = remaining[:limit]
        truncated = len(remaining) > len(selected)
        report.update({'entries': selected, 'returned': len(selected), 'truncated': truncated,
                       'continuation': selected[-1]['path'] if truncated else None})
    # Diagnostics are bounded with the page too. Global counts retain the total.
    all_diagnostics = report['diagnostics']
    report['diagnosticsTotal'] = len(all_diagnostics)
    report['diagnostics'] = all_diagnostics[:limit]
    report['diagnosticsTruncated'] = len(all_diagnostics) > limit
    return report


def render_text(report):
    lines = [f"SYSTEMX provenance schema {report['schemaVersion']} / policy {report['policyVersion']}",
             f"Selected: {report['selectedVersion']}; pinned: {report['pinnedVersion'] or 'none'}; integrity: {report['integrity']}",
             f"Entries: {report['returned']}/{report['total']}; truncated: {str(report['truncated']).lower()}"]
    for entry in report['entries']:
        matches = ','.join(match['version'] + ':' + match['relation'] for match in entry['matchingRetainedVersions']) or '-'
        lines.append(f"{entry['path']} | {entry['ownership']} | {entry['role']} | {entry['contentRelation']} | {matches} | {entry['updatePolicy']}")
    if report['continuation']:
        lines.append('Continuation (--after): ' + report['continuation'])
    for diagnostic in report['diagnostics']:
        lines.append('Diagnostic: ' + diagnostic['code'] + ' [' + diagnostic['path'] + ']')
    if report.get('diagnosticsTruncated'):
        lines.append('Diagnostics truncated; total: ' + str(report['diagnosticsTotal']))
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', type=Path, default=ROOT, help='Containing host project directory')
    parser.add_argument('--format', choices=('json', 'text'), default='json')
    parser.add_argument('--limit', type=int, default=DEFAULT_PAGE)
    parser.add_argument('--after', help='Previous continuation path, relative to .SYSTEMX')
    parser.add_argument('--path', help='One exact path relative to .SYSTEMX')
    args = parser.parse_args()
    try:
        report = inventory(args.target, limit=args.limit, after=args.after, path=args.path)
    except ProvenanceError as error:
        failure = {'schemaVersion': SCHEMA_VERSION, 'policyVersion': POLICY_VERSION,
                   'kind': 'systemx-provenance', 'valid': False, 'integrity': 'unverified',
                   'entries': [], 'total': 0, 'returned': 0, 'truncated': False,
                   'continuation': None, 'diagnostics': [error.diagnostic()]}
        print(json.dumps(failure, indent=2) if args.format == 'json' else str(error), file=sys.stdout)
        return 1
    print(json.dumps(report, indent=2) if args.format == 'json' else render_text(report), end='\n' if args.format == 'json' else '')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
