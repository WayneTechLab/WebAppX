#!/usr/bin/env python3
"""Import reviewed standalone defaults without replacing host-owned files."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = 'https://github.com/WayneTechLab/dotSYSTEMX.git'


def git(source, *args):
    return subprocess.check_output(['git', '-C', str(source), *args], text=True).strip()


def sync(target, source, apply=False):
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
    # Execute and import only tracked content from the exact verified revision.
    with tempfile.TemporaryDirectory(prefix='wtl-systemx-') as scratch:
        archive = subprocess.check_output(['git', '-C', str(source), 'archive', commit, '.SYSTEMX'])
        subprocess.run(['tar', '-xf', '-', '-C', scratch], input=archive, check=True)
        defaults = Path(scratch) / '.SYSTEMX'
        sys.path.insert(0, str(defaults))
        spec = importlib.util.spec_from_file_location('systemx_import_manager', defaults / 'manager.py')
        manager = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(manager)
        bundle = manager.read_bundle(defaults)
        version = bundle['version']
        installed = target / '.SYSTEMX' / 'INSTALLATION.json'
        state = manager.load_state(target) if installed.exists() else None
        if state and manager.version_key(version) < manager.version_key(state['activeVersion']):
            raise ValueError('Refusing to downgrade selected defaults')
        plan = manager.prepare(target, bundle)
        if plan['conflicts']:
            raise ValueError('; '.join(plan['conflicts']))
        report = {
            'repository': UPSTREAM, 'commit': commit, 'version': version,
            'manifestSha256': bundle['manifestSha256'], 'applied': False,
            'add': plan['add'], 'preserve': plan['preserve'],
            'currentVersion': state['activeVersion'] if state else None,
        }
        receipt = target / '.SYSTEMX' / 'imports' / (version + '.json')
        if receipt.exists():
            existing = json.loads(receipt.read_text())
            if (existing['commit'], existing['manifestSha256']) != (commit, bundle['manifestSha256']):
                raise ValueError('Version receipt differs; publish a new upstream version')
        if apply:
            if state:
                manager.set_policy(target, pin='none')
                try:
                    manager.update(target, source=defaults, version=version)
                finally:
                    manager.set_policy(target, pin='current')
            else:
                manager.install(target, source=defaults, repository='WayneTechLab/dotSYSTEMX')
            report['applied'] = True
            report['importedAt'] = datetime.now(timezone.utc).isoformat()
            receipt.parent.mkdir(parents=True, exist_ok=True)
            # Identical reimports retain their first receipt and timestamp.
            if receipt.exists():
                existing = json.loads(receipt.read_text())
                if (existing['commit'], existing['manifestSha256']) != (commit, bundle['manifestSha256']):
                    raise ValueError('Version receipt differs; publish a new upstream version')
            else:
                temporary = receipt.with_suffix('.tmp')
                temporary.write_text(json.dumps(report, indent=2) + '\n')
                os.replace(temporary, receipt)
        return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(os.environ.get('WTL_SYSTEMX_SOURCE', Path.home() / 'Documents/ChatGPT/dotSYSTEMX')))
    parser.add_argument('--target', type=Path, default=ROOT)
    parser.add_argument('--apply', action='store_true', help='append verified defaults, select and pin them, record provenance')
    args = parser.parse_args()
    try:
        print(json.dumps(sync(args.target.resolve(), args.source, args.apply), indent=2))
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print('SYSTEMX import failed: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
