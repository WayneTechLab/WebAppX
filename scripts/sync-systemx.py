#!/usr/bin/env python3
"""Import reviewed standalone defaults without replacing host-owned files."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = 'https://github.com/WayneTechLab/dotSYSTEMX.git'


def git_environment():
    environment = {key: value for key, value in os.environ.items()
                   if not key.upper().startswith('GIT_')}
    environment.update(GIT_OPTIONAL_LOCKS='0', GIT_NO_REPLACE_OBJECTS='1',
                       GIT_GRAFT_FILE=os.devnull, GIT_NO_LAZY_FETCH='1')
    return environment


def git(source, *args):
    environment = git_environment()
    if args == ('ls-remote', 'origin', 'refs/heads/main'):
        # Query the canonical public destination independently of local URL
        # rewrites, credential helpers and cached remote-tracking references.
        environment.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull,
                           GIT_TERMINAL_PROMPT='0', GIT_ASKPASS='', SSH_ASKPASS='')
        output = subprocess.check_output([
            'git', '--git-dir=' + os.devnull,
            '-c', 'credential.helper=', '-c', 'protocol.allow=never',
            '-c', 'protocol.https.allow=always', '-c', 'http.followRedirects=false',
            'ls-remote', UPSTREAM, 'refs/heads/main',
        ], text=True, env=environment, timeout=15, stderr=subprocess.DEVNULL)
        if len(output) > 1024:
            raise ValueError('Public main response exceeds its observation limit')
        return output.strip()
    output = subprocess.check_output([
        'git', '-c', 'advice.graftFileDeprecated=false', '-c', 'protocol.allow=never',
        '-C', str(source), *args,
    ], text=True, env=environment, timeout=15, stderr=subprocess.DEVNULL)
    if len(output) > 2 * 1024 * 1024:
        raise ValueError('Source Git observation exceeds its output limit')
    return output.strip()


def bounded_rows(rows, limit, offset):
    """Page an already complete result without discarding hidden blockers."""
    rows = sorted(set(rows))
    selected = rows[offset:offset + limit]
    end = offset + len(selected)
    return {'total': len(rows), 'returned': len(selected), 'offset': offset,
            'truncated': len(selected) != len(rows),
            'nextOffset': end if end < len(rows) else None, 'items': selected}


def new_review(expected_commit, limit, offset):
    return {
        'schemaVersion': 1, 'kind': 'webappx-systemx-upstream-review',
        'status': 'invalid', 'applied': False, 'observationStage': 'source-repository',
        'selection': {'currentVersion': None, 'pinnedVersion': None, 'incomingVersion': None},
        'source': {'repository': UPSTREAM, 'commit': None, 'expectedCommit': expected_commit,
                   'publicMain': None, 'liveVerification': 'unverified', 'manifestSha256': None},
        'receipt': {'state': 'unverified', 'originalCommit': None,
                    'identicalSourceTree': None, 'proof': None, 'firstReceiptPreserved': None},
        'outer': {key: bounded_rows([], limit, offset) for key in
                  ('add', 'preserveOverlap', 'preserveHostOwned', 'conflicts')},
        'bootstrap': {'state': 'unverified', **{key: bounded_rows([], limit, offset)
                      for key in ('add', 'replace', 'conflicts')}},
        'diagnostics': bounded_rows([], limit, offset),
        'blocking': {'blocked': True, 'total': 0},
        'limits': {'perGroup': limit, 'offset': offset},
        'checklist': [
            'Bind this review and any separately authorized apply to the exact source commit.',
            'Review selected, pinned and incoming versions and the verified distribution fingerprint.',
            'Inspect every page of additions, preserved host paths and bootstrap changes.',
            'Resolve every conflict or unavailable observation before an import apply.',
            'Preserve first-import provenance, immutable releases and adopted project records.',
        ],
        'limitations': [
            'Read-only planning evidence; this checklist grants no apply, worker or deployment authority.',
            'Public-main equality is a time-bound observation; a later apply rechecks it.',
            'Each group is independently paged; totals and blocking include omitted rows.',
            'Host path ownership does not authorize replacement, even when bytes match stock.',
        ],
    }


def complete_review(review, target, manager, state, plan, bootstrap, diagnostics):
    limit, offset = review['limits']['perGroup'], review['limits']['offset']
    for output, source in (('add', 'add'), ('preserveOverlap', 'preserve'), ('conflicts', 'conflicts')):
        review['outer'][output] = bounded_rows(plan[source], limit, offset)
    if bootstrap is not None:
        review['bootstrap'] = {'state': 'available', **{
            name: bounded_rows(bootstrap[name], limit, offset) for name in ('add', 'replace', 'conflicts')}}
    elif not state:
        review['bootstrap']['state'] = 'not-applicable'
    try:
        spec = importlib.util.spec_from_file_location('wtl_provenance_review', ROOT / 'scripts/systemx-provenance.py')
        provenance = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(provenance)
        inventory = provenance.collect_inventory(target, manager=manager)
        if inventory.get('diagnostics'):
            diagnostics.append('host-provenance-inventory-has-diagnostics')
        # Use the complete inventory, never a truncated display page, so host-only
        # paths remain visible even when no incoming default overlaps them.
        host_paths = [entry['path'] for entry in inventory['entries'] if entry['ownership'] == 'host']
        review['outer']['preserveHostOwned'] = bounded_rows(host_paths, limit, offset)
    except (ValueError, OSError, KeyError, TypeError, ImportError, AttributeError):
        diagnostics.append('host-provenance-inventory-unavailable')
    review['diagnostics'] = bounded_rows(diagnostics, limit, offset)
    total = (len(set(plan['conflicts'])) + len(set(bootstrap['conflicts'] if bootstrap else []))
             + len(set(diagnostics)))
    review['blocking'] = {'blocked': total > 0, 'total': total}
    review['status'] = 'blocked' if total else 'ready'
    review['observationStage'] = 'complete'
    return review


def upstream_review(target, source, expected_commit=None, *, limit=25, offset=0):
    """Return bounded source-bound preview facts, including planning conflicts."""
    if type(limit) is not int or not 1 <= limit <= 100 or type(offset) is not int or not 0 <= offset <= 100_000:
        raise ValueError('Review limit must be 1..100 and offset 0..100000')
    if expected_commit is not None and not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})', expected_commit):
        raise ValueError('Expected commit must be a full lowercase Git object identifier')
    review = new_review(expected_commit, limit, offset)
    try:
        return sync(target, source, expected_commit=expected_commit, review=review)
    except (ValueError, OSError, subprocess.SubprocessError, IndexError):
        review['diagnostics'] = bounded_rows([
            'import-preview-unavailable-or-invalid:' + review['observationStage']], limit, offset)
        review['blocking'] = {'blocked': True, 'total': 1}
        return review


def verify_receipt(source, existing, commit, version, manifest_sha256):
    """Keep first-import provenance while proving a later source tree is identical."""
    conflict = 'Version receipt differs; publish a new upstream version'
    if not isinstance(existing, dict):
        raise ValueError(conflict)
    receipt_commit = existing.get('commit')
    if (existing.get('repository') != UPSTREAM
            or existing.get('version') != version
            or existing.get('manifestSha256') != manifest_sha256
            or not isinstance(receipt_commit, str)
            or not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})', receipt_commit)):
        raise ValueError(conflict)
    if receipt_commit == commit:
        return False
    try:
        historical_commit = git(source, 'rev-parse', '--verify', receipt_commit + '^{commit}')
        historical_tree = git(source, 'rev-parse', '--verify', receipt_commit + ':.SYSTEMX')
        reviewed_tree = git(source, 'rev-parse', '--verify', commit + ':.SYSTEMX')
    except subprocess.CalledProcessError as error:
        raise ValueError(conflict + '; original receipt commit is unavailable') from error
    if historical_commit != receipt_commit or historical_tree != reviewed_tree:
        raise ValueError(conflict + '; .SYSTEMX source tree changed')
    return True


def sync(target, source, apply=False, expected_commit=None, *, review=None):
    if apply and review is not None:
        raise ValueError('A review must not apply an import')
    source = source.resolve()
    if git(source, 'rev-parse', '--show-toplevel') != str(source):
        raise ValueError('Source must be the standalone dotSYSTEMX repository root')
    remote = git(source, 'remote', 'get-url', 'origin')
    if remote.rstrip('/').removesuffix('.git') not in {
        UPSTREAM.removesuffix('.git'), 'git@github.com:WayneTechLab/dotSYSTEMX'
    }:
        raise ValueError('Source origin must be WayneTechLab/dotSYSTEMX')
    if git(source, 'status', '--porcelain', '--untracked-files=all'):
        raise ValueError('Source has local changes; commit and review them before importing')
    commit = git(source, 'rev-parse', 'HEAD')
    if not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})', commit):
        raise ValueError('Source HEAD must resolve to an exact commit')
    if review is not None:
        review['source']['commit'] = commit
        review['observationStage'] = 'public-main'
    live_result = git(source, 'ls-remote', 'origin', 'refs/heads/main').split()
    if (len(live_result) != 2 or live_result[1] != 'refs/heads/main'
            or not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})', live_result[0])):
        raise ValueError('Public main observation is unavailable or malformed')
    live = live_result[0]
    if review is not None:
        review['source']['publicMain'] = live
    if commit != live:
        raise ValueError('Source HEAD differs from public main; sync the standalone source first')
    if expected_commit is not None and commit != expected_commit:
        raise ValueError('Source revision differs from the reviewed expected commit; preview the new revision first')
    if review is not None:
        review['source']['liveVerification'] = 'verified-current-public-main'
        review['observationStage'] = 'verified-source-archive'
    # Execute and import only tracked content from the exact verified revision.
    with tempfile.TemporaryDirectory(prefix='wtl-systemx-') as scratch:
        archive = subprocess.check_output([
            'git', '-c', 'advice.graftFileDeprecated=false', '-c', 'protocol.allow=never',
            '-C', str(source), 'archive', commit, '.SYSTEMX',
        ], env=git_environment(), timeout=30, stderr=subprocess.DEVNULL)
        if len(archive) > 128 * 1024 * 1024:
            raise ValueError('Source archive exceeds the import limit')
        subprocess.run(['tar', '-xf', '-', '-C', scratch], input=archive, check=True,
                       timeout=30, stderr=subprocess.DEVNULL)
        defaults = Path(scratch) / '.SYSTEMX'
        spec = importlib.util.spec_from_file_location('systemx_import_manager', defaults / 'manager.py')
        manager = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(manager)
        bundle = manager.read_bundle(defaults)
        if not hasattr(manager, 'bootstrap_refresh'):
            raise ValueError('Source predates supported isolated bootstrap migration; use a reviewed current release')
        version = bundle['version']
        if review is not None:
            review['observationStage'] = 'installation-state'
        installed = target / '.SYSTEMX' / 'INSTALLATION.json'
        state = manager.load_state(target) if installed.exists() else None
        diagnostics = []
        if review is not None:
            review['selection'] = {'currentVersion': state['activeVersion'] if state else None,
                                   'pinnedVersion': state['pinnedVersion'] if state else None,
                                   'incomingVersion': version}
            review['source']['manifestSha256'] = bundle['manifestSha256']
        if state and manager.version_key(version) < manager.version_key(state['activeVersion']):
            if review is None:
                raise ValueError('Refusing to downgrade selected defaults')
            diagnostics.append('incoming-version-would-downgrade-selected-defaults')
        if review is not None:
            review['observationStage'] = 'outer-plan'
        plan = manager.prepare(target, bundle, initial=state is None)
        if plan['conflicts'] and review is None:
            raise ValueError('; '.join(plan['conflicts']))
        if review is not None:
            review['observationStage'] = 'bootstrap-plan'
        try:
            bootstrap = manager.bootstrap_refresh(target, source=defaults, version=version) if state else None
        except (ValueError, OSError):
            if review is None:
                raise
            bootstrap = None
            diagnostics.append('bootstrap-plan-unavailable')
        if bootstrap and bootstrap['conflicts'] and review is None:
            raise ValueError('; '.join(bootstrap['conflicts']))
        report = {
            'repository': UPSTREAM, 'commit': commit, 'version': version,
            'manifestSha256': bundle['manifestSha256'], 'applied': False,
            'add': plan['add'], 'preserve': plan['preserve'],
            'currentVersion': state['activeVersion'] if state else None,
        }
        if bootstrap:
            # Keep machine paths and local backup identities out of provenance.
            report['bootstrap'] = {name: bootstrap[name] for name in ('add', 'replace', 'applied')}
        if review is not None:
            review['observationStage'] = 'receipt-provenance'
        imports = manager.safe_path(target / '.SYSTEMX', 'imports')
        receipt = manager.safe_path(target / '.SYSTEMX', 'imports/' + version + '.json')
        if imports.exists() and not imports.is_dir():
            raise ValueError('Import receipt parent must be a directory')
        if receipt.exists():
            existing = manager.decode(manager.regular_bytes(receipt))
            try:
                identical = verify_receipt(source, existing, commit, version, bundle['manifestSha256'])
            except ValueError:
                if review is None:
                    raise
                diagnostics.append('existing-import-receipt-provenance-conflict')
                review['receipt']['state'] = 'conflict'
            else:
                if identical:
                    report['receiptCommit'] = existing['commit']
                    report['identicalSourceTree'] = True
                if review is not None:
                    review['receipt'] = {'state': 'verified', 'originalCommit': existing['commit'],
                                         'identicalSourceTree': True,
                                         'proof': 'identical-source-tree' if identical else 'same-commit',
                                         'firstReceiptPreserved': True}
        elif review is not None:
            review['receipt'] = {'state': 'not-present', 'originalCommit': None,
                                 'identicalSourceTree': None, 'proof': None, 'firstReceiptPreserved': None}
        if review is not None:
            return complete_review(review, target, manager, state, plan, bootstrap, diagnostics)
        if apply:
            backup = None
            if state:
                refreshed = manager.bootstrap_refresh(target, source=defaults, version=version, apply=True)
                report['bootstrap']['applied'] = refreshed['applied']
                backup = refreshed.get('backup')
                manager.set_policy(target, pin='none', auto_update='manual')
                try:
                    manager.update(target, source=defaults, version=version)
                finally:
                    manager.set_policy(target, pin='current')
            else:
                manager.install(target, source=defaults, repository='WayneTechLab/dotSYSTEMX')
            report['applied'] = True
            report['importedAt'] = datetime.now(timezone.utc).isoformat()
            manager.safe_path(target / '.SYSTEMX', 'imports/' + version + '.json')
            imports.mkdir(parents=True, exist_ok=True)
            # Identical reimports retain their first receipt and timestamp.
            if receipt.exists():
                existing = manager.decode(manager.regular_bytes(receipt))
                verify_receipt(source, existing, commit, version, bundle['manifestSha256'])
            else:
                descriptor, temporary = tempfile.mkstemp(prefix=version + '-', suffix='.tmp', dir=imports)
                try:
                    with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
                        stream.write(json.dumps(report, indent=2) + '\n')
                        stream.flush()
                        os.fsync(stream.fileno())
                    manager.safe_path(target / '.SYSTEMX', 'imports/' + version + '.json')
                    os.replace(temporary, receipt)
                finally:
                    if os.path.exists(temporary):
                        os.unlink(temporary)
            if backup:
                # Returned for the operator; deliberately absent from the receipt.
                report['bootstrapBackup'] = backup
        return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(os.environ.get('WTL_SYSTEMX_SOURCE', Path.home() / 'Documents/ChatGPT/dotSYSTEMX')))
    parser.add_argument('--target', type=Path, default=ROOT)
    parser.add_argument('--apply', action='store_true', help='append verified defaults, select and pin them, record provenance')
    parser.add_argument('--expected-commit', help='require the exact public revision reviewed in the preview')
    parser.add_argument('--limit', type=int, default=25, help='preview rows per group, 1..100 (default 25)')
    parser.add_argument('--offset', type=int, default=0, help='preview offset applied independently to each group')
    args = parser.parse_args()
    try:
        if args.apply:
            if args.limit != 25 or args.offset != 0:
                parser.error('Preview pagination cannot be combined with --apply')
            report = sync(args.target.resolve(), args.source, True, args.expected_commit)
        else:
            report = upstream_review(args.target.resolve(), args.source, args.expected_commit,
                                     limit=args.limit, offset=args.offset)
        print(json.dumps(report, indent=2))
        return 0 if args.apply or report['status'] == 'ready' else 1
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print('SYSTEMX import failed: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
