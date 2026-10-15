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


def git(source, *args):
    return subprocess.check_output(['git', '-C', str(source), *args], text=True).strip()


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


def sync(target, source, apply=False, expected_commit=None):
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
    live = git(source, 'ls-remote', 'origin', 'refs/heads/main').split()[0]
    if commit != live:
        raise ValueError('Source HEAD differs from public main; sync the standalone source first')
    if expected_commit is not None and commit != expected_commit:
        raise ValueError('Source revision differs from the reviewed expected commit; preview the new revision first')
    # Execute and import only tracked content from the exact verified revision.
    with tempfile.TemporaryDirectory(prefix='wtl-systemx-') as scratch:
        archive = subprocess.check_output(['git', '-C', str(source), 'archive', commit, '.SYSTEMX'])
        subprocess.run(['tar', '-xf', '-', '-C', scratch], input=archive, check=True)
        defaults = Path(scratch) / '.SYSTEMX'
        spec = importlib.util.spec_from_file_location('systemx_import_manager', defaults / 'manager.py')
        manager = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(manager)
        bundle = manager.read_bundle(defaults)
        if not hasattr(manager, 'bootstrap_refresh'):
            raise ValueError('Source predates supported isolated bootstrap migration; use a reviewed current release')
        version = bundle['version']
        installed = target / '.SYSTEMX' / 'INSTALLATION.json'
        state = manager.load_state(target) if installed.exists() else None
        if state and manager.version_key(version) < manager.version_key(state['activeVersion']):
            raise ValueError('Refusing to downgrade selected defaults')
        plan = manager.prepare(target, bundle, initial=state is None)
        if plan['conflicts']:
            raise ValueError('; '.join(plan['conflicts']))
        bootstrap = manager.bootstrap_refresh(target, source=defaults, version=version) if state else None
        if bootstrap and bootstrap['conflicts']:
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
        imports = manager.safe_path(target / '.SYSTEMX', 'imports')
        receipt = manager.safe_path(target / '.SYSTEMX', 'imports/' + version + '.json')
        if imports.exists() and not imports.is_dir():
            raise ValueError('Import receipt parent must be a directory')
        if receipt.exists():
            existing = manager.decode(manager.regular_bytes(receipt))
            if verify_receipt(source, existing, commit, version, bundle['manifestSha256']):
                report['receiptCommit'] = existing['commit']
                report['identicalSourceTree'] = True
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
    args = parser.parse_args()
    try:
        print(json.dumps(sync(args.target.resolve(), args.source, args.apply, args.expected_commit), indent=2))
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print('SYSTEMX import failed: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
