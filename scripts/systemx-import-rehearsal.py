#!/usr/bin/env python3
"""Rehearse a real import in owned fictional fixtures, never a live adopted app."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import stat
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT
MAX_FILES = 2500
MAX_BYTES = 64 * 1024 * 1024
MAX_PAGE = 100
MAX_OFFSET = 100000
STAMP = '2026-01-01T00:00:00Z'
SHA = re.compile(r'[0-9a-f]{64}')


def encoded(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n').encode()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def _module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    exec(compile(path.read_bytes(), str(path), 'exec'), module.__dict__)
    return module


provenance = _module('rehearsal_provenance', ROOT / 'scripts/systemx-provenance.py')


class RehearsalError(ValueError):
    def __init__(self, code, phase='inspection'):
        self.code, self.phase = code, phase
        super().__init__(code)


def _fixtures():
    task = {'id': 'TASK-001', 'title': 'Fictional rehearsal record', 'owner': 'agent.0',
            'status': 'todo', 'milestone': '', 'scope': ['fictional/'],
            'acceptance': ['Retain this fictional record during the fixture import'],
            'dependsOn': [], 'nextAction': 'Review the fictional result', 'blocker': '',
            'evidence': [], 'reviewedBy': '', 'createdAt': STAMP, 'updatedAt': STAMP,
            'history': [{'at': STAMP, 'status': 'todo', 'owner': 'agent.0', 'evidence': [], 'reviewedBy': '',
                         'note': 'Fictional intake; no execution authority'}]}
    return {
        'GLOBAL/CONTEXT.md': b'# Fictional rehearsal context\n\nPublic invented example only.\n',
        'GLOBAL/ACCESS-MATRIX.md': b'# Fictional access references\n\nNo access granted.\n',
        'PLAN/MASTER-PLAN.md': b'# Fictional rehearsal plan\n\nPreserve the example records.\n',
        'PLAN/MAP.md': b'# Fictional source map\n\nFixture source only.\n',
        'MEMORY/PROJECT.md': b'# Fictional memory\n\nNo real project facts.\n',
        'AGENTS/agent.0/MEMORY.md': b'# Fictional Agent 0 memory\n\nReview fixture preservation.\n',
        'WORK/TASKS.json': encoded({'schemaVersion': 1, 'tasks': [task]}),
        'WORK/FOCUS.json': encoded({'schemaVersion': 1, 'objective': 'Fictional preservation rehearsal',
                                   'taskIds': ['TASK-001'], 'checkpoint': '', 'updatedAt': STAMP}),
        'project.json': encoded({'schemaVersion': 1,
                                'project': {'name': 'Fictional Import Rehearsal', 'description': 'Public synthetic fixture'},
                                'checks': [], 'commands': {'dev': [], 'build': [], 'deploy': []}}),
        'LAN/rehearsal-notes.md': b'Fictional host-only LAN extension.\n',
        'KIT/rehearsal-brand.json': encoded({'brand': 'Fictional fixture'}),
        'Template/rehearsal-setup.md': b'Fictional host-only setup notes.\n',
        'docs/REHEARSAL-HOST.md': b'Fictional reconciled host guidance.\n',
        'WSG-MENU.sh': b'#!/usr/bin/env bash\n# Fictional host menu; never executed.\n',
        'hooks/rehearsal-hook.sh': b'# Fictional hook; never installed or executed.\n',
        'deploy/rehearsal-deploy.md': b'Fictional deployment notes; no deployment.\n',
        'config/rehearsal-host.json': encoded({'fixture': True, 'enabled': False}),
        'status/REHEARSAL.md': b'Fictional historical host note.\n',
        'webapp-version/rehearsal.json': encoded({'fixture': True, 'deployCount': 0}),
        'GUSTO/rehearsal.json': encoded({'fixture': True, 'providerConnected': False}),
    }


FIXTURE_FILES = _fixtures()


def _safe_file(root, name, manager, *, missing=False):
    provenance._relative(name)
    try:
        path = manager.safe_path(root, name)
        if not path.exists() and missing:
            return None
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise ValueError('nonregular file')
        return path
    except (OSError, ValueError):
        raise RehearsalError('unsafe-or-unreadable-allowlisted-file') from None


def _public_bundle(root, state, version, manager):
    """Bound the entire immutable structure before the manager's complete walk."""
    try:
        snapshot = manager.release_path(root, version)
        if manager.is_link(snapshot) or not snapshot.is_dir():
            raise ValueError('invalid snapshot')
        manifest_path = _safe_file(snapshot, manager.MANIFEST, manager)
        manifest = manager.decode(manager.regular_bytes(manifest_path))
        names = manifest['files']
        if not isinstance(names, dict) or not 1 <= len(names) <= manager.MAX_FILES:
            raise ValueError('invalid manifest')
        files = {manager.MANIFEST}
        for name in names:
            files.add(manager.portable_path(name))
        directories = {str(parent) for name in files for parent in PurePosixPath(name).parents if str(parent) != '.'}
        pending, count, size = [(snapshot, '')], 0, 0
        seen = set()
        while pending:
            folder, prefix = pending.pop()
            if len(PurePosixPath(prefix).parts) > 64:
                raise ValueError('snapshot depth')
            manager.safe_path(snapshot, prefix) if prefix else None
            with os.scandir(folder) as entries:
                for entry in entries:
                    count += 1
                    if count > MAX_FILES:
                        raise ValueError('snapshot entries')
                    name = prefix + '/' + entry.name if prefix else entry.name
                    info = entry.stat(follow_symlinks=False)
                    if entry.is_symlink() or manager.is_link(Path(entry.path)):
                        raise ValueError('snapshot link')
                    if stat.S_ISDIR(info.st_mode) and name in directories:
                        pending.append((Path(entry.path), name))
                    elif stat.S_ISREG(info.st_mode) and name in files and info.st_nlink == 1:
                        size += info.st_size
                        if size > MAX_BYTES or info.st_size > manager.MAX_FILE:
                            raise ValueError('snapshot bytes')
                        seen.add(name)
                    else:
                        raise ValueError('unexpected snapshot entry')
        if seen != files:
            raise ValueError('incomplete snapshot')
        bundle = manager.read_bundle(snapshot, exact=True)
        if (manager.snapshot_issues(snapshot, bundle, complete=True) or bundle['version'] != version or
                bundle['manifestSha256'] != state['releases'][version]):
            raise ValueError('snapshot integrity')
        manager.require_isolated_release(bundle)
        return bundle
    except (OSError, ValueError, UnicodeError, KeyError, TypeError):
        raise RehearsalError('public-snapshot-invalid', 'source-distribution') from None


def _inputs(manager):
    try:
        root = manager.project_root(SOURCE_ROOT)
        state = manager.load_state(root)
        if not 1 <= len(state['releases']) <= 64:
            raise ValueError('release count')
        incoming = state['activeVersion']
        older = [version for version in state['releases']
                 if manager.version_key(manager.ISOLATED_RUNNER_FLOOR) <= manager.version_key(version) < manager.version_key(incoming)]
        baseline = max(older, key=manager.version_key) if older else incoming
        bundles = {version: _public_bundle(root, state, version, manager) for version in dict.fromkeys((baseline, incoming))}
        return root, state, baseline, incoming, bundles
    except RehearsalError:
        raise
    except (OSError, ValueError, UnicodeError, KeyError, TypeError):
        raise RehearsalError('source-selection-invalid', 'source-selection') from None


def _environment():
    environment = {key: value for key, value in os.environ.items()
                   if not key.upper().startswith('GIT_') and key.upper() not in {'TAR_OPTIONS', 'TAPE'}}
    environment.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull,
                       GIT_TERMINAL_PROMPT='0', GIT_ASKPASS='', SSH_ASKPASS='',
                       GIT_OPTIONAL_LOCKS='0', GIT_NO_REPLACE_OBJECTS='1',
                       GIT_GRAFT_FILE=os.devnull, GIT_NO_LAZY_FETCH='1',
                       GIT_AUTHOR_NAME='SYSTEMX Rehearsal Fixture', GIT_AUTHOR_EMAIL='fixture@example.invalid',
                       GIT_COMMITTER_NAME='SYSTEMX Rehearsal Fixture', GIT_COMMITTER_EMAIL='fixture@example.invalid',
                       GIT_AUTHOR_DATE=STAMP, GIT_COMMITTER_DATE=STAMP)
    return environment


class _Workspace:
    """Own all mutation destinations; callers cannot provide a target directory."""
    def __enter__(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='systemx-import-rehearsal-')
        self.root = Path(self.temporary.name).resolve()
        self.source, self.target = self.root / 'source', self.root / 'adopted'
        self.hooks, self.template = self.root / 'empty-hooks', self.root / 'empty-template'
        self.worker_temp = self.root / 'worker-temp'
        for path in (self.source, self.target, self.hooks, self.template, self.worker_temp):
            path.mkdir()
        self.open = True
        return self

    def __exit__(self, *args):
        self.open = False
        self.temporary.cleanup()

    def require(self, path):
        if (not self.open or not path.resolve().is_relative_to(self.root) or
                path == self.root or path.is_symlink()):
            raise RehearsalError('non-owned-fixture-path')


def _git(workspace, *args):
    workspace.require(workspace.source)
    try:
        result = subprocess.run(['git', '-c', 'protocol.allow=never', '-c', 'commit.gpgSign=false',
                                 '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=' + str(workspace.hooks),
                                 '-C', str(workspace.source), *args], env=_environment(), timeout=20,
                                check=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        if len(result.stdout) > 4096:
            raise ValueError('oversized Git result')
        return result.stdout.decode('utf-8').strip()
    except (OSError, ValueError, subprocess.SubprocessError):
        raise RehearsalError('fixture-git-failed', 'fixture-source') from None


def _copy_distribution(workspace, bundle):
    folder = workspace.source / '.SYSTEMX'
    workspace.require(folder)
    if folder.exists():
        shutil.rmtree(folder)  # Always an owned exact public fixture copy.
    for name, data in bundle['files'].items():
        path = folder / name
        workspace.require(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def _source_commit(workspace, bundle, *, initial):
    _copy_distribution(workspace, bundle)
    if initial:
        _git(workspace, 'init', '-q', '--template=' + str(workspace.template))
        for key, value in (('core.autocrlf', 'false'), ('core.fsmonitor', 'false'),
                           ('core.hooksPath', str(workspace.hooks)), ('commit.gpgSign', 'false')):
            _git(workspace, 'config', key, value)
        # The published * text=auto attributes otherwise normalize a valid CRLF
        # snapshot while staging it. This highest-priority untracked override
        # preserves the verified public bytes in the synthetic fixture commit.
        (workspace.source / '.git/info').mkdir(exist_ok=True)
        (workspace.source / '.git/info/attributes').write_bytes(b'* -text\n')
        _git(workspace, 'remote', 'add', 'origin', 'https://github.com/WayneTechLab/dotSYSTEMX.git')
    _git(workspace, 'add', '--all', '--', '.SYSTEMX')
    _git(workspace, 'commit', '-qm', 'Synthetic local distribution fixture', '--allow-empty')
    commit = _git(workspace, 'rev-parse', 'HEAD')
    if not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})', commit):
        raise RehearsalError('fixture-commit-invalid')
    return commit


# A separate isolated interpreter bounds the complete actual importer call and
# prevents fixture-only observation injection from affecting another caller.
_IMPORT_WORKER = r'''
import importlib.util,json,os,sys
from pathlib import Path
sys.dont_write_bytecode=True
try:
    tool,source,target,expected=map(str,sys.argv[1:])
    source=Path(source).resolve(); target=Path(target).resolve()
    if source.parent != target.parent or source.name != 'source' or target.name != 'adopted':
        raise ValueError('not an owned source/target pair')
    spec=importlib.util.spec_from_file_location('actual_fixture_importer',tool)
    importer=importlib.util.module_from_spec(spec); spec.loader.exec_module(importer)
    original=importer.git
    environment=dict(os.environ)
    importer.git_environment=lambda:dict(environment)
    def fixture_git(selected,*args):
        if Path(selected).resolve()!=source:
            raise ValueError('fixture observation scope mismatch')
        if args==('ls-remote','origin','refs/heads/main'):
            return expected+'\trefs/heads/main'
        if args and args[0] in {'ls-remote','fetch','pull','push','clone'}:
            raise ValueError('unexpected transport request')
        return original(selected,*args)
    importer.git=fixture_git
    result=importer.sync(target,source,True,expected_commit=expected)
    print(json.dumps({'applied':result['applied'],'version':result['version'],
                      'fixtureCommit':result['commit'],'manifestSha256':result['manifestSha256'],
                      'bootstrapAdd':result.get('bootstrap',{}).get('add',[]),
                      'bootstrapReplace':result.get('bootstrap',{}).get('replace',[])}))
except Exception:
    print(json.dumps({'error':'actual-fixture-import-refused'}));sys.exit(1)
'''


_RECORD_WORKER = r'''
import importlib.util,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
try:
    outer=Path(sys.argv[1]); refresh=sys.argv[2]=='refresh'
    sys.path.insert(0,str(outer))
    spec=importlib.util.spec_from_file_location('fictional_record_tools',outer/'scripts/project_memory.py')
    memory=importlib.util.module_from_spec(spec);spec.loader.exec_module(memory)
    ledger,registry=memory.load(outer)
    if refresh: memory.refresh(outer,ledger)
    memory.validate_work(outer)
    print(json.dumps({'valid':True}))
except Exception:
    print(json.dumps({'error':'fictional-record-validation-failed'}));sys.exit(1)
'''


def _records(workspace, *, refresh=False):
    workspace.require(workspace.target)
    try:
        output = _run_worker(workspace, _RECORD_WORKER,
                             [str(workspace.target / '.SYSTEMX'), 'refresh' if refresh else 'validate'],
                             timeout=20, output_limit=1024)
        if json.loads(output).get('valid') is not True:
            raise ValueError('invalid record result')
    except (OSError, ValueError, subprocess.SubprocessError):
        raise RehearsalError('fictional-record-validation-failed', 'fixture-records') from None


def _apply(workspace, commit):
    workspace.require(workspace.source)
    workspace.require(workspace.target)
    try:
        output = _run_worker(workspace, _IMPORT_WORKER,
                             [str(ROOT / 'scripts/sync-systemx.py'), str(workspace.source),
                              str(workspace.target), commit], timeout=90, output_limit=32768)
        value = json.loads(output)
        if value.get('applied') is not True or value.get('fixtureCommit') != commit:
            raise ValueError('import apply not proved')
        return value
    except (OSError, ValueError, subprocess.SubprocessError):
        raise RehearsalError('actual-fixture-import-failed', 'fixture-apply') from None


def _run_worker(workspace, code, args, *, timeout, output_limit):
    """Own a worker process group and all temporary extraction destinations."""
    workspace.require(workspace.worker_temp)
    environment = _environment()
    environment.update(TMPDIR=str(workspace.worker_temp), TEMP=str(workspace.worker_temp), TMP=str(workspace.worker_temp))
    options = ({'start_new_session': True} if os.name != 'nt' else
               {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP})
    command = [sys.executable, '-I', '-B', '-c', code, *args]
    with subprocess.Popen(command, env=environment, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL, **options) as child:
        try:
            output, _ = child.communicate(timeout=timeout)
        except BaseException as error:
            # The fresh session isolates Ctrl+C too, so every abnormal parent
            # exit must stop the owned group before workspace cleanup begins.
            _stop_worker(child, environment)
            if isinstance(error, subprocess.TimeoutExpired):
                raise RehearsalError('owned-worker-timeout', 'fixture-worker') from None
            raise
        if child.returncode != 0 or len(output) > output_limit:
            raise RehearsalError('owned-worker-failed', 'fixture-worker')
        return output


def _stop_worker(child, environment):
    if os.name == 'nt':
        if child.poll() is None:
            try:
                subprocess.run(['taskkill', '/PID', str(child.pid), '/T', '/F'],
                               env=environment, timeout=10, check=False,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except (OSError, subprocess.SubprocessError):
                pass
    else:
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    if child.poll() is None:
        child.kill()
    child.communicate(timeout=5)


def _capture(workspace, names, manager):
    """Hash reviewed public distribution/fictional fixture paths in owned target only."""
    workspace.require(workspace.target)
    if not set(names).issubset(workspace.allowed_paths):
        raise RehearsalError('unreviewed-fingerprint-path')
    if len(names) > MAX_FILES * 3:
        raise RehearsalError('fingerprint-count-limit')
    result, total = {}, 0
    outer = workspace.target / '.SYSTEMX'
    for name in sorted(names):
        # No runtime/history/cache or unknown host path can enter the selection.
        if provenance.classify_path(name)['ownership'] == 'local':
            raise RehearsalError('excluded-fingerprint-path')
        path = _safe_file(outer, name, manager, missing=True)
        if path is None:
            continue
        data = manager.regular_bytes(path)
        total += len(data)
        if total > MAX_BYTES * 3:
            raise RehearsalError('fingerprint-byte-limit')
        result[name] = digest(data)
    return result


def _page(rows, limit, offset):
    items = rows[offset:offset + limit]
    end = offset + len(items)
    return {'total': len(rows), 'returned': len(items), 'offset': offset,
            'truncated': len(items) != len(rows), 'nextOffset': end if end < len(rows) else None,
            'items': items}


def compare_fingerprints(before, after, *, expected_changed=(), expected_added=(), known_defaults=(), limit=25, offset=0):
    """Pure comparison. Complete blockers are computed before any display limit."""
    _query(limit, offset)
    if not isinstance(before, dict) or not isinstance(after, dict) or len(before) + len(after) > MAX_FILES * 6:
        raise RehearsalError('invalid-fingerprint-map')
    groups = {key: [] for key in ('preserved', 'changed', 'missing', 'added')}
    blockers = []
    for path in sorted(set(before) | set(after)):
        provenance._relative(path)
        if any(not isinstance(mapping[path], str) or not SHA.fullmatch(mapping[path])
               for mapping in (before, after) if path in mapping):
            raise RehearsalError('invalid-fingerprint')
        state = ('added' if path not in before else 'missing' if path not in after else
                 'preserved' if before[path] == after[path] else 'changed')
        policy = provenance.classify_path(path, known_default=path in known_defaults)
        allowed = (state == 'preserved' or state == 'changed' and path in expected_changed or
                   state == 'added' and path in expected_added)
        row = {'path': path, **policy, 'beforeSha256': before.get(path), 'afterSha256': after.get(path),
               'expected': bool(allowed)}
        groups[state].append(row)
        if not allowed:
            blockers.append({'path': path, 'code': 'unexpected-' + state})
    return {'groups': {key: _page(rows, limit, offset) for key, rows in groups.items()},
            'counts': {key: len(rows) for key, rows in groups.items()},
            'blocking': {'blocked': bool(blockers), 'total': len(blockers), **_page(blockers, limit, offset)}}


def _query(limit, offset):
    if type(limit) is not int or not 1 <= limit <= MAX_PAGE or type(offset) is not int or not 0 <= offset <= MAX_OFFSET:
        raise RehearsalError('invalid-pagination', 'arguments')


def _receipt(workspace, version, manager):
    path = _safe_file(workspace.target / '.SYSTEMX', 'imports/' + version + '.json', manager)
    data = manager.regular_bytes(path)
    value = manager.decode(data)
    if (not isinstance(value, dict) or value.get('version') != version or
            value.get('repository') != 'https://github.com/WayneTechLab/dotSYSTEMX.git' or
            not isinstance(value.get('commit'), str) or not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})', value['commit']) or
            not isinstance(value.get('manifestSha256'), str) or not SHA.fullmatch(value['manifestSha256'])):
        raise RehearsalError('fixture-receipt-invalid', 'fixture-receipt')
    return {'version': version, 'fixtureCommit': value['commit'],
            'manifestSha256': value['manifestSha256'], 'sha256': digest(data)}


def _aggregate(files):
    return digest(encoded({name: digest(data) for name, data in sorted(files.items())}))


def run_rehearsal(*, limit=25, offset=0):
    """Run two real applies in a disposable fixture. No target/source-path argument exists."""
    _query(limit, offset)
    manager = provenance._manager()
    source_root, state, baseline, incoming, bundles = _inputs(manager)
    baseline_bundle, incoming_bundle = bundles[baseline], bundles[incoming]
    source_hashes = {version: _aggregate(bundle['files']) for version, bundle in bundles.items()}
    with _Workspace() as workspace:
        first_commit = _source_commit(workspace, baseline_bundle, initial=True)
        first_apply = _apply(workspace, first_commit)
        outer = workspace.target / '.SYSTEMX'
        for name, data in FIXTURE_FILES.items():
            if not provenance.is_host_owned(name):
                raise RehearsalError('fixture-ownership-policy-mismatch')
            path = outer / name
            workspace.require(path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        _records(workspace, refresh=True)
        root_paths = {name for name in set(baseline_bundle['files']) | set(incoming_bundle['files'])
                      if provenance.classify_path(name, known_default=True)['ownership'] != 'local'}
        snapshots = {'.systemx/releases/' + version + '/' + name
                     for version, bundle in bundles.items() for name in bundle['files']}
        receipts = {'imports/' + version + '.json' for version in bundles}
        selected_paths = root_paths | snapshots | receipts | set(FIXTURE_FILES) | {'INSTALLATION.json'}
        workspace.allowed_paths = frozenset(selected_paths)
        before = _capture(workspace, selected_paths, manager)
        first_receipt = _receipt(workspace, baseline, manager)
        second_commit = _source_commit(workspace, incoming_bundle, initial=False)
        second_apply = _apply(workspace, second_commit)
        _records(workspace)
        after = _capture(workspace, selected_paths, manager)
        target_state = manager.load_state(workspace.target)
        for version in bundles:
            fixture_bundle = _public_bundle(workspace.target, target_state, version, manager)
            if _aggregate(fixture_bundle['files']) != source_hashes[version]:
                raise RehearsalError('fixture-immutable-release-changed')
        final_receipts = {version: _receipt(workspace, version, manager) for version in bundles}
        expected_changed = {'INSTALLATION.json', *manager.BOOTSTRAP_FILES}
        expected_added = (set(incoming_bundle['files']) - set(baseline_bundle['files'])) | {
            '.systemx/releases/' + incoming + '/' + name for name in incoming_bundle['files']}
        if incoming != baseline:
            expected_added.add('imports/' + incoming + '.json')
        comparison = compare_fingerprints(before, after, expected_changed=expected_changed,
                                          expected_added=expected_added, known_defaults=root_paths,
                                          limit=limit, offset=offset)
        host_checks = all(before.get(name) == after.get(name) == digest(data) for name, data in FIXTURE_FILES.items())
        first_receipt_preserved = final_receipts[baseline] == first_receipt
        receipt_bound = all(receipt['manifestSha256'] == bundles[version]['manifestSha256'] and
                            receipt['fixtureCommit'] == (first_commit if version == baseline else second_commit)
                            for version, receipt in final_receipts.items())
        state_ok = (target_state['activeVersion'] == incoming and target_state['pinnedVersion'] == incoming and
                    target_state['autoUpdate'] == 'manual' and set(bundles).issubset(target_state['releases']))
        checks = {'fictionalHostPathsPreserved': host_checks, 'firstReceiptPreserved': first_receipt_preserved,
                  'fixtureImmutableReleasesExact': True, 'selectedPinnedManual': state_ok,
                  'fictionalCoordinationRecordsAndViewsValid': True,
                  'fixtureReceiptsBoundToCommitsAndManifests': receipt_bound,
                  'bootstrapBytesMatchIncoming': all(after.get(name) == digest(incoming_bundle['files'][name])
                                                     for name in manager.BOOTSTRAP_FILES),
                  'addedOuterDefaultsMatchIncoming': all(after.get(name) == digest(incoming_bundle['files'][name])
                      for name in set(incoming_bundle['files']) - set(baseline_bundle['files'])
                      if name in root_paths and name not in FIXTURE_FILES),
                  'realImporterApplyExecutedTwice': first_apply['applied'] is True and second_apply['applied'] is True}
        source_unchanged = all(_aggregate(_public_bundle(source_root, state, version, manager)['files']) == expected
                               for version, expected in source_hashes.items())
        checks['publicSourceSnapshotsAndBlankSeedsUnchanged'] = source_unchanged
        extra = [{'path': '', 'code': key} for key, passed in checks.items() if not passed]
        complete_blocking = comparison['blocking']['total'] + len(extra)
        host_rows = []
        for name in sorted(FIXTURE_FILES):
            before_hash, after_hash = before.get(name), after.get(name)
            relation = 'missing' if after_hash is None else 'changed' if before_hash != after_hash else 'preserved'
            host_rows.append({'path': name, **provenance.classify_path(name), 'state': relation,
                              'beforeSha256': before_hash, 'afterSha256': after_hash})
        report = {'schemaVersion': 1, 'kind': 'systemx-import-rehearsal',
                  'status': 'passed' if complete_blocking == 0 else 'failed',
                  'source': {'kind': 'local-verified-snapshot', 'baselineVersion': baseline, 'incomingVersion': incoming,
                             'transition': 'retained-release-upgrade' if baseline != incoming else 'same-version-reimport',
                             'distributions': [{'version': v, 'manifestSha256': bundles[v]['manifestSha256'],
                                                'exactFileMapSha256': source_hashes[v]} for v in bundles],
                             'publicMain': {'state': 'not-queried-fixture-observation', 'commit': None}},
                  'fixture': {'identity': 'public-fictional-adopted-records', 'hostPathCount': len(FIXTURE_FILES),
                              'baselineCommit': first_commit, 'incomingCommit': second_commit,
                              'commitsAreSynthetic': True, 'applyExecuted': True,
                              'bootstrapReplaced': second_apply['bootstrapReplace'],
                              'bootstrapAdded': second_apply['bootstrapAdd']},
                  'checks': checks, 'fingerprints': comparison['groups'], 'counts': comparison['counts'],
                  'fictionalHostFingerprints': _page(host_rows, limit, offset),
                  'blocking': {'blocked': complete_blocking > 0, 'total': complete_blocking,
                               'fingerprintConflicts': comparison['blocking'], 'checkFailures': _page(extra, limit, offset)},
                  'receipts': list(final_receipts.values()),
                  'privacy': {'liveAdoptedTargetRead': False, 'liveOuterRecordsRead': False,
                              'liveSourceWritesRequested': False, 'runtimePayloadsRead': False,
                              'hashSelection': 'manifest-listed-public-and-fixed-fictional-fixture-paths'},
                  'limitations': ['Synthetic owned fixture applies only; no live adopted app was copied or changed.',
                                  'The public-main observation is injected only for the owned source fixture; no network check occurred.',
                                  'Fingerprints disclose bytes only for reviewed public distribution and fictional fixture paths.',
                                  'Complete blocking counts precede output pagination; passed is limited to this rehearsal.',
                                  'No provider, worker execution, deployment or native Windows runtime acceptance is established.']}
    report['cleanup'] = 'owned-temporary-workspace-removed'
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit', type=int, default=25, help='Rows per fingerprint group, 1..100')
    parser.add_argument('--offset', type=int, default=0, help='Independent group offset, 0..100000')
    args = parser.parse_args()
    interrupted = False
    try:
        report = run_rehearsal(limit=args.limit, offset=args.offset)
    except KeyboardInterrupt:
        interrupted = True
        report = {'schemaVersion': 1, 'kind': 'systemx-import-rehearsal', 'status': 'failed',
                  'blocking': {'blocked': True, 'total': 1},
                  'diagnostics': [{'code': 'rehearsal-interrupted', 'phase': 'fixture-worker'}]}
    except (RehearsalError, OSError, ValueError, UnicodeError, KeyError, TypeError) as error:
        report = {'schemaVersion': 1, 'kind': 'systemx-import-rehearsal', 'status': 'failed',
                  'blocking': {'blocked': True, 'total': 1},
                  'diagnostics': [{'code': error.code if isinstance(error, RehearsalError) else 'rehearsal-incomplete',
                                   'phase': error.phase if isinstance(error, RehearsalError) else 'inspection'}]}
    print(json.dumps(report, indent=2))
    return 130 if interrupted else 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
