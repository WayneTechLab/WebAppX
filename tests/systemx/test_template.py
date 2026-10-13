import importlib.util
import hashlib
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
    def copy_template(self, root):
        for name in ['.SYSTEMX', 'package.json', 'package-lock.json']:
            source = ROOT / name
            if source.is_dir():
                shutil.copytree(source, root / name, ignore=shutil.ignore_patterns(
                    '__pycache__', 'Temp', 'Backup', 'history', 'operations'))
            else:
                shutil.copy2(source, root / name)

    def test_reusable_release_is_valid(self):
        self.assertEqual(validation.validate(ROOT), [])

    def test_populated_records_and_mutated_defaults_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.copy_template(root)
            tasks = root / '.SYSTEMX/WORK/TASKS.json'
            tasks.write_text(json.dumps({'schemaVersion': 1, 'tasks': [{'id': 'TASK-001'}]}))
            self.assertTrue(any('seed differs: WORK/TASKS' in error for error in validation.validate(root)))
            state = json.loads((root / '.SYSTEMX/INSTALLATION.json').read_text())
            default = root / '.SYSTEMX/.systemx/releases' / state['activeVersion'] / 'STANDARD.md'
            default.write_text('Unreviewed replacement')
            self.assertTrue(any('Immutable upstream file differs:' in error and 'STANDARD.md' in error
                                for error in validation.validate(root)))

    def test_new_access_and_map_records_must_remain_blank(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.copy_template(root)
            for name in ('GLOBAL/ACCESS-MATRIX.md', 'PLAN/MAP.md',
                         'templates/project/GLOBAL/ACCESS-MATRIX.md',
                         'templates/project/PLAN/MAP.md'):
                with self.subTest(record=name):
                    path = root / '.SYSTEMX' / name
                    original = path.read_bytes()
                    path.write_bytes(original + b'\nPrivate project scope must not ship.\n')
                    self.assertTrue(any('seed differs: ' + name in error
                                        for error in validation.validate(root)))
                    path.write_bytes(original)
            self.assertEqual(validation.validate(root), [])

    def test_blank_record_crlf_checkouts_remain_valid(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.copy_template(root)
            seeds = json.loads((root / '.SYSTEMX/config/template-records.json').read_text())['sha256']
            for name in seeds:
                path = root / '.SYSTEMX' / name
                path.write_bytes(path.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))
            self.assertEqual(validation.validate(root), [])

    def test_stock_python_and_powershell_bootstraps_allow_crlf_against_lf_cache(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.copy_template(root)
            system = root / '.SYSTEMX'
            state = json.loads((system / 'INSTALLATION.json').read_text())
            release = system / '.systemx/releases' / state['activeVersion']
            cached = {}
            for name in validation.BOOTSTRAP_FILES:
                if Path(name).suffix not in {'.py', '.ps1'}:
                    continue
                # Construct the LF cache even when this test is launched from
                # a Windows checkout; the verified text manifest accepts LF.
                cached[name] = (release / name).read_bytes().replace(b'\r\n', b'\n')
                (release / name).write_bytes(cached[name])
            self.assertEqual(validation.validate(root), [])
            for name, data in cached.items():
                converted = data.replace(b'\n', b'\r\n')
                self.assertNotEqual(converted, data)
                (system / name).write_bytes(converted)
            self.assertEqual(validation.validate(root), [])
            for name, data in cached.items():
                self.assertEqual((release / name).read_bytes(), data)

    def test_schema_two_binary_crlf_mutation_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.copy_template(root)
            self.assertEqual(validation.validate(root), [])
            state = json.loads((root / '.SYSTEMX/INSTALLATION.json').read_text())
            release = root / '.SYSTEMX/.systemx/releases' / state['activeVersion']
            manifest = json.loads((release / 'config/distribution.json').read_text())
            self.assertEqual(manifest['schemaVersion'], 2)
            name = 'MEDIA/Infographics/systemx-cli-projects-4k.jpg'
            path = release / name
            original = path.read_bytes()
            changed = original.replace(b'\r\n', b'\n')
            self.assertNotEqual(changed, original, 'Fixture must contain the binary bytes under test')
            path.write_bytes(changed)
            errors = validation.validate(root)
            self.assertTrue(any('Immutable upstream file differs:' in error and name in error for error in errors))

    def test_schema_two_keeps_unknown_bytes_exact_and_reviewed_text_portable(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'payload'
            payload = b'valid UTF-8\r\nwith CRLF\r\n'
            path.write_bytes(payload)
            exact = hashlib.sha256(payload).hexdigest()
            normalized = hashlib.sha256(payload.replace(b'\r\n', b'\n')).hexdigest()
            self.assertNotEqual(exact, normalized)
            self.assertEqual(validation.digest(path, upstream=True, name='payload.unknown', schema=2), exact)
            self.assertEqual(validation.digest(path, upstream=True, name='payload.jpg', schema=2), exact)
            self.assertEqual(validation.digest(path, upstream=True, name='payload.md', schema=2), normalized)
            self.assertEqual(validation.digest(path, upstream=True, name='payload.jpg', schema=1), normalized)

    def test_retained_release_and_outer_bootstrap_mutations_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.copy_template(root)
            retained = root / '.SYSTEMX/.systemx/releases/1.8.6-alpha.1/STANDARD.md'
            original = retained.read_bytes()
            retained.write_bytes(original + b'\nUnreviewed historical snapshot edit\n')
            self.assertTrue(any('Immutable upstream file differs:' in error and 'STANDARD.md' in error
                                for error in validation.validate(root)))
            retained.write_bytes(original)
            bootstrap = root / '.SYSTEMX/SYSTEMX.sh'
            bootstrap.write_bytes(bootstrap.read_bytes() + b'\n# Unreviewed launcher replacement\n')
            self.assertTrue(any('bootstrap' in error.lower() and 'SYSTEMX.sh' in error
                                for error in validation.validate(root)))


class MarkdownScanScope(unittest.TestCase):
    def test_runtime_and_symlink_docs_are_excluded_but_normal_links_are_checked(self):
        with tempfile.TemporaryDirectory() as temporary, tempfile.TemporaryDirectory() as outside:
            root = Path(temporary)
            scanner = root / '.SYSTEMX/scripts/validate-markdown-links.mjs'
            scanner.parent.mkdir(parents=True)
            shutil.copy2(ROOT / '.SYSTEMX/scripts/validate-markdown-links.mjs', scanner)
            (root / 'README.md').write_text('[Guide](.SYSTEMX/docs/guide.md)\n')
            normal = root / '.SYSTEMX/docs/guide.md'
            normal.parent.mkdir()
            normal.write_text('[Readme](../../README.md)\n')
            runtime_folders = (
                '.SYSTEMX/local', '.SYSTEMX/logs', '.SYSTEMX/state',
                '.SYSTEMX/.systemx/history', '.SYSTEMX/.systemx/operations',
                '.SYSTEMX/Projects/Project-A/.SYSTEMXP/local',
                '.SYSTEMX/Projects/Project-A/.SYSTEMXP/logs',
                '.SYSTEMX/Projects/Project-A/.SYSTEMXP/state',
            )
            for name in runtime_folders:
                folder = root / name
                folder.mkdir(parents=True)
                (folder / 'broken.md').write_text('[Missing runtime file](missing-runtime-target.md)\n')
            external = Path(outside) / 'broken.md'
            external.write_text('[Missing external file](missing-external-target.md)\n')
            (normal.parent / 'external.md').symlink_to(external)
            (normal.parent / 'external-directory').symlink_to(Path(outside), target_is_directory=True)

            result = subprocess.run(['node', str(scanner)], cwd=root,
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn('Markdown link check passed: 2 file(s)', result.stdout)

            normal.write_text('[Missing normal file](missing-normal-target.md)\n')
            result = subprocess.run(['node', str(scanner)], cwd=root,
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn('1 broken link(s)', result.stderr)
            self.assertIn('.SYSTEMX/docs/guide.md -> missing-normal-target.md', result.stderr)
            self.assertNotIn('missing-runtime-target.md', result.stderr)
            self.assertNotIn('missing-external-target.md', result.stderr)


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
