#!/usr/bin/env python3
"""Validate reusable seeds, provenance, snapshots and optional mirror parity."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def digest(path, upstream=False):
    data = path.read_bytes()
    # Follow the upstream manager manifest contract, including binary normalization.
    if upstream:
        data = data.replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def validate(root):
    root = Path(root)
    errors = []
    system = root / '.SYSTEMX'
    seeds = json.loads((system / 'config/template-records.json').read_text())['sha256']
    for rel, expected in seeds.items():
        path = system / rel
        if not path.is_file() or digest(path) != expected:
            errors.append('Reusable seed differs: ' + rel)
    state = json.loads((system / 'INSTALLATION.json').read_text())
    version = state['activeVersion']
    release = system / '.systemx/releases' / version
    manifest_path = release / 'config/distribution.json'
    manifest = json.loads(manifest_path.read_text())
    if digest(manifest_path, upstream=True) != state['releases'][version]:
        errors.append('Selected release manifest fingerprint differs')
    for rel, expected in manifest['files'].items():
        path = release / rel
        if not path.is_file() or digest(path, upstream=True) != expected:
            errors.append('Immutable upstream file differs: ' + rel)
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


def tree(root):
    return subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD^{tree}'], text=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--against', type=Path)
    args = parser.parse_args()
    errors = validate(args.root)
    if args.against:
        for root in (args.root, args.against):
            if subprocess.check_output(['git', '-C', str(root), 'status', '--porcelain'], text=True).strip():
                errors.append('Parity requires a clean committed checkout: ' + str(root))
        if tree(args.root) != tree(args.against):
            errors.append('Committed mirror trees differ')
        else:
            print('Identical committed tree: ' + tree(args.root))
    for error in errors:
        print('FAIL: ' + error)
    if not errors:
        print('Template seeds, immutable release, research and versions verified.')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
