#!/usr/bin/env python3
"""Preview or explicitly apply an identical tracked template tree to a mirror."""
import argparse
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('template_validation', ROOT / 'scripts/validate-template.py')
validation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validation)


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])


def names(root, *args):
    return set(filter(None, git(root, *args).decode().split('\0')))


def reject_links(root, paths):
    for name in paths:
        current = root
        for part in Path(name).parts:
            current = current / part
            if current.is_symlink():
                raise ValueError('Symbolic link in template path: ' + str(current))


def sync(source, target, apply=False):
    source, target = Path(source).resolve(), Path(target).resolve()
    if source == target:
        raise ValueError('Source and mirror must be different repositories')
    for root in (source, target):
        if git(root, 'rev-parse', '--show-toplevel').decode().strip() != str(root):
            raise ValueError('Expected a repository root: ' + str(root))
        if git(root, 'status', '--porcelain', '--untracked-files=all').strip():
            raise ValueError('Commit or preserve local changes before sync: ' + str(root))
    source_names = names(source, 'ls-tree', '-r', '--name-only', '-z', 'HEAD')
    target_names = names(target, 'ls-tree', '-r', '--name-only', '-z', 'HEAD')
    reject_links(source, source_names)
    reject_links(target, target_names | source_names)
    transitions = sorted(p for p in source_names if (target / p).is_dir()
                         or any(p.startswith(q + '/') for q in target_names))
    if transitions:
        raise ValueError('Review file/directory transitions before sync: ' + ', '.join(transitions))
    # Include ignored files: secrets/build state must never be overwritten either.
    local = names(target, 'ls-files', '--others', '-z')
    collisions = sorted(p for p in local if any(
        p == q or p.startswith(q + '/') or q.startswith(p + '/') for q in source_names))
    if collisions:
        raise ValueError('Local-only collision(s): ' + ', '.join(collisions))
    report = {'source': str(source), 'target': str(target),
              'sourceCommit': git(source, 'rev-parse', 'HEAD').decode().strip(),
              'sourceTree': validation.tree(source),
              'add': sorted(source_names - target_names),
              'remove': sorted(target_names - source_names), 'applied': False}
    with tempfile.TemporaryDirectory(prefix='wtl-template-') as temporary:
        stage = Path(temporary)
        with tarfile.open(fileobj=io.BytesIO(git(source, 'archive', 'HEAD'))) as archive:
            archive.extractall(stage, filter='data')
        errors = validation.validate(stage)
        if errors:
            raise ValueError('; '.join(errors))
        report['changed'] = sorted(p for p in source_names & target_names
                                  if (stage / p).read_bytes() != (target / p).read_bytes()
                                  or (stage / p).stat().st_mode & 0o111 != (target / p).stat().st_mode & 0o111)
        if apply:
            # Private history remains in .git; this changes only tracked release files.
            for rel in report['remove']:
                (target / rel).unlink()
            for rel in source_names:
                destination = target / rel
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(stage / rel, destination)
            report['applied'] = True
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT)
    parser.add_argument('--target', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(sync(args.source, args.target, args.apply), indent=2))
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, 'Template sync refused: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
