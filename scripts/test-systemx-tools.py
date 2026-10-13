#!/usr/bin/env python3
"""Run unchanged upstream tests with exact source packaging metadata in a temp copy."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]


def main():
    spec = importlib.util.spec_from_file_location('systemx_test_validation', ROOT / 'scripts/validate-template.py')
    validation = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(validation)
    errors = validation.validate(ROOT)
    if errors:
        raise ValueError('; '.join(errors))
    state = json.loads((ROOT / '.SYSTEMX/INSTALLATION.json').read_text())
    version = state['activeVersion']
    release = ROOT / '.SYSTEMX/.systemx/releases' / version
    fixture = ROOT / 'tests/systemx/fixtures' / version
    receipt = json.loads((ROOT / '.SYSTEMX/imports' / (version + '.json')).read_text())
    provenance = json.loads((fixture / 'source.json').read_text())
    if any(provenance[key] != receipt[key] for key in ('repository', 'commit', 'version')):
        raise ValueError('Upstream test-support provenance differs from the selected import')
    if set(provenance['files']) != {'pyproject.toml'}:
        raise ValueError('Upstream test support must contain only reviewed packaging metadata')
    metadata = fixture / 'pyproject.toml'
    metadata_bytes = metadata.read_bytes()
    if metadata.is_symlink() or hashlib.sha256(metadata_bytes).hexdigest() != provenance['files']['pyproject.toml']:
        raise ValueError('Upstream packaging metadata fingerprint differs')
    with tempfile.TemporaryDirectory(prefix='webappx-systemx-tests-') as temporary:
        working = Path(temporary)
        staged = working / '.SYSTEMX'
        shutil.copytree(release, staged)
        manifest_path = staged / 'config/distribution.json'
        if validation.digest(manifest_path, upstream=True) != state['releases'][version]:
            raise ValueError('Staged release manifest fingerprint differs')
        manifest = json.loads(manifest_path.read_text())
        listed = set(manifest['files']) | {'config/distribution.json'}
        staged_paths = list(staged.rglob('*'))
        if any(path.is_symlink() for path in staged_paths) or {
            path.relative_to(staged).as_posix() for path in staged_paths if path.is_file()
        } != listed:
            raise ValueError('Staged release inventory differs')
        for name, expected in manifest['files'].items():
            if validation.digest(staged / name, upstream=True, name=name, schema=manifest['schemaVersion']) != expected:
                raise ValueError('Staged upstream file differs: ' + name)
        (working / 'pyproject.toml').write_bytes(metadata_bytes)
        return subprocess.run([sys.executable, '-B', '-m', 'unittest', 'discover',
                               '-s', str(staged / 'tests'), '-v'], cwd=working).returncode


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as error:
        print('SYSTEMX tests failed: ' + str(error), file=sys.stderr)
        raise SystemExit(1)
