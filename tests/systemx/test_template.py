import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def module(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


validation = module('template_validation_test', 'scripts/validate-template.py')
mirror = module('template_mirror_test', 'scripts/sync-template.py')


class TemplateRelease(unittest.TestCase):
    def test_reusable_release_is_valid(self):
        self.assertEqual(validation.validate(ROOT), [])

    def test_populated_records_and_mutated_defaults_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for name in ['.SYSTEMX', 'package.json', 'package-lock.json']:
                source = ROOT / name
                if source.is_dir():
                    shutil.copytree(source, root / name, ignore=shutil.ignore_patterns('__pycache__', 'Temp', 'Backup'))
                else:
                    shutil.copy2(source, root / name)
            tasks = root / '.SYSTEMX/WORK/TASKS.json'
            tasks.write_text(json.dumps({'schemaVersion': 1, 'tasks': [{'id': 'TASK-001'}]}))
            self.assertTrue(any('seed differs: WORK/TASKS' in error for error in validation.validate(root)))
            state = json.loads((root / '.SYSTEMX/INSTALLATION.json').read_text())
            default = root / '.SYSTEMX/.systemx/releases' / state['activeVersion'] / 'STANDARD.md'
            default.write_text('Unreviewed replacement')
            self.assertTrue(any('Immutable upstream file differs: STANDARD.md' in error for error in validation.validate(root)))


class MirrorSafety(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.base = Path(self.temporary.name)
        self.source = self.base / 'source'
        self.target = self.base / 'target'
        for root in (self.source, self.target):
            root.mkdir()
            for args in [('init', '-q'), ('config', 'user.name', 'Mirror Test'),
                         ('config', 'user.email', 'test@example.com')]:
                subprocess.run(['git', '-C', str(root), *args], check=True)
            (root / '.gitignore').write_text('local-only.txt\ncollision.txt\n')
        (self.source / 'new.txt').write_text('reviewed addition\n')
        (self.target / 'old.txt').write_text('old tracked template file\n')
        self.commit(self.source)
        self.commit(self.target)
        self.validator = patch.object(mirror.validation, 'validate', return_value=[])
        self.validator.start()

    def tearDown(self):
        self.validator.stop()
        self.temporary.cleanup()

    def commit(self, root):
        subprocess.run(['git', '-C', str(root), 'add', '-A'], check=True)
        subprocess.run(['git', '-C', str(root), 'commit', '-qm', 'Fixture'], check=True)

    def test_preview_is_read_only_and_apply_preserves_history_and_local_state(self):
        before = mirror.git(self.target, 'rev-parse', 'HEAD')
        (self.target / 'local-only.txt').write_text('private local state\n')
        report = mirror.sync(self.source, self.target)
        self.assertEqual(report['remove'], ['old.txt'])
        self.assertFalse((self.target / 'new.txt').exists())
        mirror.sync(self.source, self.target, True)
        self.assertEqual((self.target / 'local-only.txt').read_text(), 'private local state\n')
        self.assertEqual(mirror.git(self.target, 'rev-parse', 'HEAD'), before)
        self.assertFalse((self.target / 'old.txt').exists())
        self.assertEqual((self.target / 'new.txt').read_text(), 'reviewed addition\n')

    def test_ignored_collision_is_refused_without_changes(self):
        (self.source / 'collision.txt').write_text('public addition\n')
        subprocess.run(['git', '-C', str(self.source), 'add', '-f', 'collision.txt'], check=True)
        self.commit(self.source)
        (self.target / 'collision.txt').write_text('private ignored file\n')
        with self.assertRaisesRegex(ValueError, 'Local-only collision'):
            mirror.sync(self.source, self.target, True)
        self.assertEqual((self.target / 'collision.txt').read_text(), 'private ignored file\n')
        self.assertTrue((self.target / 'old.txt').exists())

    def test_dirty_target_is_refused_without_changes(self):
        (self.target / 'old.txt').write_text('uncommitted work\n')
        with self.assertRaisesRegex(ValueError, 'local changes'):
            mirror.sync(self.source, self.target, True)
        self.assertEqual((self.target / 'old.txt').read_text(), 'uncommitted work\n')

    def test_tracked_target_link_is_refused_before_preview_or_apply(self):
        outside = self.base / 'outside.txt'
        outside.write_text('private fixture\n')
        (self.target / 'new.txt').symlink_to(outside)
        self.commit(self.target)
        for apply in (False, True):
            with self.assertRaisesRegex(ValueError, 'Symbolic link'):
                mirror.sync(self.source, self.target, apply)
        self.assertEqual(outside.read_text(), 'private fixture\n')
        self.assertTrue((self.target / 'new.txt').is_symlink())

    def test_invalid_public_source_is_refused_without_changes(self):
        with patch.object(mirror.validation, 'validate', return_value=['Nonblank seed']):
            with self.assertRaisesRegex(ValueError, 'Nonblank seed'):
                mirror.sync(self.source, self.target, True)
        self.assertTrue((self.target / 'old.txt').exists())


if __name__ == '__main__':
    unittest.main()
