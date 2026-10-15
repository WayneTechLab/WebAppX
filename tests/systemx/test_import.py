import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('wtl_import', ROOT / 'scripts/sync-systemx.py')
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class ImportIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.TemporaryDirectory()
        cls.source = Path(cls.scratch.name) / 'upstream'
        cls.source.mkdir()
        state = json.loads((ROOT / '.SYSTEMX/INSTALLATION.json').read_text())
        cls.version = state['activeVersion']
        defaults = ROOT / '.SYSTEMX/.systemx/releases' / cls.version
        shutil.copytree(defaults, cls.source / '.SYSTEMX')
        for args in [
            ['init', '-q'], ['config', 'user.name', 'Import Test'],
            ['config', 'user.email', 'test@example.com'],
            ['remote', 'add', 'origin', importer.UPSTREAM], ['add', '.SYSTEMX'],
            ['commit', '-qm', 'Reviewed release fixture'],
        ]:
            subprocess.run(['git', '-C', str(cls.source), *args], check=True)
        cls.commit = importer.git(cls.source, 'rev-parse', 'HEAD')

    @classmethod
    def tearDownClass(cls):
        cls.scratch.cleanup()

    def setUp(self):
        self.destination = tempfile.TemporaryDirectory()
        self.target = Path(self.destination.name)
        original_git = importer.git

        def fixture_git(source, *args):
            if args == ('ls-remote', 'origin', 'refs/heads/main'):
                return self.commit + '\trefs/heads/main'
            return original_git(source, *args)

        self.mock = patch.object(importer, 'git', side_effect=fixture_git)
        self.mock.start()

    def tearDown(self):
        self.mock.stop()
        self.destination.cleanup()

    def test_committed_paths_have_no_case_insensitive_file_directory_collision(self):
        names = subprocess.check_output(['git', '-C', str(ROOT), 'ls-files'], text=True).splitlines()
        files = {name.casefold() for name in names}
        directories = {str(parent).casefold() for name in names for parent in Path(name).parents if str(parent) != '.'}
        self.assertEqual(files & directories, set(), 'Tracked files must clone onto case-insensitive macOS/Windows filesystems')

    def test_preview_is_read_only(self):
        before = list(self.target.rglob('*'))
        search_path = list(sys.path)
        result = importer.sync(self.target, self.source, expected_commit=self.commit)
        self.assertFalse(result['applied'])
        self.assertEqual(list(self.target.rglob('*')), before)
        self.assertEqual(sys.path, search_path)

    def test_apply_reimport_preserves_records_extensions_and_receipt(self):
        importer.sync(self.target, self.source, True)
        outer = self.target / '.SYSTEMX'
        custom = {
            'WORK/TASKS.json': '{"schemaVersion": 1, "tasks": []}\n',
            'project.json': 'custom configuration retained verbatim\n',
            'WSG-MENU.sh': '# private WTL menu\n',
            'LAN/custom.txt': 'host extension\n',
        }
        for name, value in custom.items():
            path = outer / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(value)
        importer.sync(self.target, self.source, True)
        receipt = outer / 'imports' / (self.version + '.json')
        first = receipt.read_bytes()
        importer.sync(self.target, self.source, True)
        self.assertEqual(first, receipt.read_bytes())
        for name, value in custom.items():
            self.assertEqual((outer / name).read_text(), value)
        state = json.loads((outer / 'INSTALLATION.json').read_text())
        self.assertEqual(state['activeVersion'], self.version)
        self.assertEqual(state['pinnedVersion'], self.version)
        self.assertEqual(state['autoUpdate'], 'manual')
        check = subprocess.run(['python3', '-B', str(outer / 'manager.py'), 'status', '--target', str(self.target)], capture_output=True, text=True)
        self.assertEqual(check.returncode, 0, check.stderr)
        self.assertEqual(json.loads(check.stdout)['integrity'], 'verified')

    def test_initial_executable_collision_is_rejected_before_any_write(self):
        outer = self.target / '.SYSTEMX'
        outer.mkdir()
        (outer / 'WSG-MENU.sh').write_text('# Unreviewed occupied host menu\n')
        before = self.file_bytes(outer)
        for apply in (False, True):
            with self.subTest(apply=apply):
                with self.assertRaisesRegex(ValueError, 'Existing executable default differs'):
                    importer.sync(self.target, self.source, apply)
                self.assertEqual(self.file_bytes(outer), before)

    def install_legacy(self):
        legacy = ROOT / '.SYSTEMX/.systemx/releases/1.8.6-alpha.1'
        result = subprocess.run([
            sys.executable, '-B', str(legacy / 'manager.py'), 'install',
            '--target', str(self.target), '--source', str(legacy),
        ], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return legacy

    def file_bytes(self, root):
        return {path.relative_to(root).as_posix(): path.read_bytes()
                for path in root.rglob('*') if path.is_file()}

    def clone_source(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        source = Path(scratch.name) / 'upstream'
        subprocess.run(['git', 'clone', '-q', '--no-hardlinks', str(self.source), str(source)], check=True)
        for args in [
            ['remote', 'set-url', 'origin', importer.UPSTREAM],
            ['config', 'user.name', 'Import Test'],
            ['config', 'user.email', 'test@example.com'],
        ]:
            subprocess.run(['git', '-C', str(source), *args], check=True)
        return source

    def commit_source(self, source, message):
        subprocess.run(['git', '-C', str(source), 'add', '.'], check=True)
        subprocess.run(['git', '-C', str(source), 'commit', '-qm', message], check=True)
        self.commit = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
        return self.commit

    def test_docs_only_revision_preserves_first_receipt_and_reports_current_source(self):
        source = self.clone_source()
        original_commit = self.commit
        importer.sync(self.target, source, True, expected_commit=original_commit)
        receipt = self.target / '.SYSTEMX/imports' / (self.version + '.json')
        original_receipt = receipt.read_bytes()
        (source / 'README.md').write_text('Reviewed standalone documentation update\n')
        current_commit = self.commit_source(source, 'Documentation only')
        before = self.file_bytes(self.target)
        preview = importer.sync(self.target, source, expected_commit=current_commit)
        self.assertFalse(preview['applied'])
        self.assertEqual(self.file_bytes(self.target), before)
        self.assertEqual(preview['commit'], current_commit)
        self.assertEqual(preview['receiptCommit'], original_commit)
        self.assertIs(preview['identicalSourceTree'], True)
        self.assertEqual(preview['add'], [])
        self.assertEqual(preview['bootstrap']['replace'], [])
        result = importer.sync(self.target, source, True, expected_commit=current_commit)
        self.assertTrue(result['applied'])
        self.assertEqual(result['commit'], current_commit)
        self.assertEqual(result['receiptCommit'], original_commit)
        self.assertIs(result['identicalSourceTree'], True)
        self.assertEqual(receipt.read_bytes(), original_receipt)
        self.assertEqual(json.loads(receipt.read_text())['commit'], original_commit)

    def test_unlisted_systemx_change_is_rejected_even_with_identical_manifest(self):
        source = self.clone_source()
        importer.sync(self.target, source, True)
        manifest = (source / '.SYSTEMX/config/distribution.json').read_bytes()
        (source / '.SYSTEMX/unlisted-source.md').write_text('This change requires a new version\n')
        self.commit_source(source, 'Unlisted source change')
        self.assertEqual((source / '.SYSTEMX/config/distribution.json').read_bytes(), manifest)
        before = self.file_bytes(self.target)
        for apply in (False, True):
            with self.subTest(apply=apply):
                with self.assertRaisesRegex(ValueError, r'Version receipt differs;.*source tree changed'):
                    importer.sync(self.target, source, apply, expected_commit=self.commit)
                self.assertEqual(self.file_bytes(self.target), before)

    def test_changed_managed_tree_with_valid_same_version_manifest_is_rejected(self):
        source = self.clone_source()
        importer.sync(self.target, source, True)
        defaults = source / '.SYSTEMX'
        readme = defaults / 'README.md'
        readme.write_bytes(readme.read_bytes() + b'\nChanged same-version managed default\n')
        manifest_path = defaults / 'config/distribution.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['files']['README.md'] = hashlib.sha256(readme.read_bytes()).hexdigest()
        manifest_path.write_text(json.dumps(manifest) + '\n')
        self.commit_source(source, 'Changed same-version distribution')
        before = self.file_bytes(self.target)
        for apply in (False, True):
            with self.subTest(apply=apply):
                with self.assertRaises(ValueError):
                    importer.sync(self.target, source, apply, expected_commit=self.commit)
                self.assertEqual(self.file_bytes(self.target), before)

    def test_invalid_receipt_identity_is_rejected_before_any_write(self):
        importer.sync(self.target, self.source, True)
        receipt = self.target / '.SYSTEMX/imports' / (self.version + '.json')
        original = json.loads(receipt.read_text())
        changes = [
            {'commit': 'different'}, {'commit': self.commit[:12]}, {'commit': None},
            {'repository': 'https://github.com/other/dotSYSTEMX.git'},
            {'version': '0.0.0'}, {'manifestSha256': '0' * 64},
        ]
        for change in changes:
            receipt.write_text(json.dumps({**original, **change}) + '\n')
            before = self.file_bytes(self.target)
            for apply in (False, True):
                with self.subTest(change=change, apply=apply):
                    with self.assertRaisesRegex(ValueError, 'Version receipt differs'):
                        importer.sync(self.target, self.source, apply)
                    self.assertEqual(self.file_bytes(self.target), before)

    def test_unavailable_receipt_commit_is_rejected_before_any_write(self):
        importer.sync(self.target, self.source, True)
        receipt = self.target / '.SYSTEMX/imports' / (self.version + '.json')
        original = json.loads(receipt.read_text())
        receipt.write_text(json.dumps({**original, 'commit': 'f' * 40}) + '\n')
        before = self.file_bytes(self.target)
        for apply in (False, True):
            with self.subTest(apply=apply):
                with self.assertRaisesRegex(ValueError, 'original receipt commit is unavailable'):
                    importer.sync(self.target, self.source, apply)
                self.assertEqual(self.file_bytes(self.target), before)

    def test_docs_only_revision_still_requires_the_reviewed_expected_commit(self):
        source = self.clone_source()
        original_commit = self.commit
        importer.sync(self.target, source, True)
        (source / 'README.md').write_text('Reviewed documentation update\n')
        self.commit_source(source, 'Documentation only')
        before = self.file_bytes(self.target)
        for apply in (False, True):
            with self.subTest(apply=apply):
                with self.assertRaisesRegex(ValueError, 'reviewed expected commit'):
                    importer.sync(self.target, source, apply, expected_commit=original_commit)
                self.assertEqual(self.file_bytes(self.target), before)

    def test_legacy_upgrade_refreshes_stock_bootstraps_with_exact_backups(self):
        legacy = self.install_legacy()
        outer = self.target / '.SYSTEMX'
        retained = outer / '.systemx/releases/1.8.6-alpha.1'
        old_snapshot = self.file_bytes(retained)
        records = {
            'MEMORY/PROJECT.md': b'Accepted private project facts\n',
            'GLOBAL/ACCESS-MATRIX.md': b'Previously reviewed project access\n',
            'PLAN/MAP.md': b'Previously reviewed project boundaries\n',
            'LAN/custom.txt': b'Private host extension\n',
        }
        for name, data in records.items():
            path = outer / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        before_preview = self.file_bytes(outer)
        preview = importer.sync(self.target, self.source)
        self.assertFalse(preview['bootstrap']['applied'])
        self.assertIn('manager.py', preview['bootstrap']['replace'])
        self.assertEqual(self.file_bytes(outer), before_preview)

        result = importer.sync(self.target, self.source, True)
        self.assertTrue(result['bootstrap']['applied'])
        backups = list((outer / '.systemx/history').glob('bootstrap-*'))
        self.assertEqual(len(backups), 1)
        defaults = self.source / '.SYSTEMX'
        for name in result['bootstrap']['replace']:
            self.assertEqual((backups[0] / name).read_bytes(), (legacy / name).read_bytes())
            self.assertEqual((outer / name).read_bytes(), (defaults / name).read_bytes())
        for name in result['bootstrap']['add']:
            self.assertEqual((outer / name).read_bytes(), (defaults / name).read_bytes())
        self.assertEqual(self.file_bytes(retained), old_snapshot)
        for name, data in records.items():
            self.assertEqual((outer / name).read_bytes(), data)
        state = json.loads((outer / 'INSTALLATION.json').read_text())
        self.assertEqual(state['activeVersion'], self.version)
        self.assertEqual(state['pinnedVersion'], self.version)
        self.assertEqual(state['autoUpdate'], 'manual')
        receipt = json.loads((outer / 'imports' / (self.version + '.json')).read_text())
        self.assertEqual(set(receipt['bootstrap']), {'add', 'replace', 'applied'})
        self.assertNotIn(str(self.target), json.dumps(receipt))
        check = subprocess.run([
            sys.executable, '-B', str(outer / 'manager.py'), 'status',
            '--target', str(self.target),
        ], capture_output=True, text=True)
        self.assertEqual(check.returncode, 0, check.stderr)
        self.assertEqual(json.loads(check.stdout)['integrity'], 'verified')

    def test_customized_legacy_bootstrap_is_rejected_before_any_write(self):
        self.install_legacy()
        outer = self.target / '.SYSTEMX'
        launcher = outer / 'SYSTEMX.sh'
        launcher.write_bytes(launcher.read_bytes() + b'\n# Reviewed project customization\n')
        before = self.file_bytes(outer)
        for apply in (False, True):
            with self.subTest(apply=apply):
                with self.assertRaisesRegex(ValueError, 'Customized|unrecognized bootstrap'):
                    importer.sync(self.target, self.source, apply)
                self.assertEqual(self.file_bytes(outer), before)

    def test_new_version_keeps_old_defaults_and_host_records(self):
        importer.sync(self.target, self.source, True)
        outer = self.target / '.SYSTEMX'
        memory = outer / 'MEMORY/PROJECT.md'
        memory.write_text('Accepted private project facts\n')
        defaults = self.source / '.SYSTEMX'
        old_commit = self.commit
        major, minor, patch = map(int, self.version.split('-', 1)[0].split('.'))
        next_version = f'{major}.{minor}.{patch + 1}-alpha.1'
        try:
            (defaults / 'VERSION').write_text(next_version + '\n')
            source_record = json.loads((defaults / 'SOURCE.json').read_text())
            source_record['templateVersion'] = next_version
            (defaults / 'SOURCE.json').write_text(json.dumps(source_record) + '\n')
            manifest_path = defaults / 'config/distribution.json'
            manifest = json.loads(manifest_path.read_text())
            manifest['version'] = next_version
            for name in ['VERSION', 'SOURCE.json']:
                manifest['files'][name] = hashlib.sha256((defaults / name).read_bytes()).hexdigest()
            (defaults / 'docs/new-example.md').write_text('New upstream example\n')
            manifest['files']['docs/new-example.md'] = hashlib.sha256((defaults / 'docs/new-example.md').read_bytes()).hexdigest()
            manifest_path.write_text(json.dumps(manifest) + '\n')
            subprocess.run(['git', '-C', str(self.source), 'add', '.SYSTEMX'], check=True)
            subprocess.run(['git', '-C', str(self.source), 'commit', '-qm', 'Next release fixture'], check=True)
            self.commit = subprocess.check_output(['git', '-C', str(self.source), 'rev-parse', 'HEAD'], text=True).strip()
            importer.sync(self.target, self.source, True)
            state = json.loads((outer / 'INSTALLATION.json').read_text())
            self.assertEqual(state['activeVersion'], next_version)
            self.assertEqual(state['pinnedVersion'], next_version)
            self.assertEqual(memory.read_text(), 'Accepted private project facts\n')
            self.assertTrue((outer / '.systemx/releases' / self.version / 'VERSION').exists())
            self.assertTrue((outer / 'docs/new-example.md').exists())
        finally:
            subprocess.run(['git', '-C', str(self.source), 'reset', '--hard', '-q', old_commit], check=True)
            self.commit = old_commit
        with self.assertRaisesRegex(ValueError, 'downgrade'):
            importer.sync(self.target, self.source, True)

    def test_source_revision_mismatch_is_rejected_before_writes(self):
        with patch.object(importer, 'git', side_effect=lambda source, *args: 'different\trefs/heads/main' if args == ('ls-remote', 'origin', 'refs/heads/main') else subprocess.check_output(['git', '-C', str(source), *args], text=True).strip()):
            with self.assertRaisesRegex(ValueError, 'differs from public main'):
                importer.sync(self.target, self.source, True)
        self.assertEqual(list(self.target.iterdir()), [])

    def test_reviewed_commit_mismatch_is_rejected_before_writes(self):
        for apply in (False, True):
            with self.subTest(apply=apply):
                with self.assertRaisesRegex(ValueError, 'reviewed expected commit'):
                    importer.sync(self.target, self.source, apply, expected_commit='0' * 40)
                self.assertEqual(list(self.target.iterdir()), [])

    def test_receipt_conflict_is_rejected_before_installation(self):
        receipt = self.target / '.SYSTEMX/imports' / (self.version + '.json')
        receipt.parent.mkdir(parents=True)
        receipt.write_text(json.dumps({'commit': 'different', 'manifestSha256': 'invalid'}))
        with self.assertRaisesRegex(ValueError, 'Version receipt differs'):
            importer.sync(self.target, self.source, True)
        self.assertFalse((self.target / '.SYSTEMX/INSTALLATION.json').exists())

    def test_symlinked_receipt_is_rejected_before_any_write(self):
        receipt = self.target / '.SYSTEMX/imports' / (self.version + '.json')
        receipt.parent.mkdir(parents=True)
        manifest = self.source / '.SYSTEMX/config/distribution.json'
        fingerprint = hashlib.sha256(manifest.read_bytes().replace(b'\r\n', b'\n')).hexdigest()
        with tempfile.TemporaryDirectory() as outside:
            external = Path(outside) / 'existing-receipt.json'
            external.write_text(json.dumps({'commit': self.commit, 'manifestSha256': fingerprint}))
            receipt.symlink_to(external)
            before = self.file_bytes(self.target)
            original = external.read_bytes()
            for apply in (False, True):
                with self.subTest(apply=apply):
                    with self.assertRaisesRegex(ValueError, '[Ss]ymlink|[Ll]ink'):
                        importer.sync(self.target, self.source, apply)
                    self.assertEqual(self.file_bytes(self.target), before)
                    self.assertEqual(external.read_bytes(), original)
                    self.assertTrue(receipt.is_symlink())

    def test_symlinked_imports_parent_is_rejected_before_any_write(self):
        imports = self.target / '.SYSTEMX/imports'
        imports.parent.mkdir()
        with tempfile.TemporaryDirectory() as outside:
            external = Path(outside)
            (external / 'private.txt').write_text('Keep unrelated external contents\n')
            imports.symlink_to(external, target_is_directory=True)
            before = self.file_bytes(self.target)
            outside_before = self.file_bytes(external)
            for apply in (False, True):
                with self.subTest(apply=apply):
                    with self.assertRaisesRegex(ValueError, '[Ss]ymlink|[Ll]ink'):
                        importer.sync(self.target, self.source, apply)
                    self.assertEqual(self.file_bytes(self.target), before)
                    self.assertEqual(self.file_bytes(external), outside_before)
                    self.assertTrue(imports.is_symlink())

    def test_legacy_fixed_temporary_receipt_symlink_is_never_touched(self):
        imports = self.target / '.SYSTEMX/imports'
        imports.mkdir(parents=True)
        legacy_temporary = imports / (self.version + '.tmp')
        with tempfile.TemporaryDirectory() as outside:
            external = Path(outside) / 'private.txt'
            original = b'Keep unrelated external contents\n'
            external.write_bytes(original)
            legacy_temporary.symlink_to(external)
            result = importer.sync(self.target, self.source, True)
            self.assertTrue(result['applied'])
            self.assertTrue(legacy_temporary.is_symlink())
            self.assertEqual(external.read_bytes(), original)
            receipt = imports / (self.version + '.json')
            self.assertFalse(receipt.is_symlink())
            self.assertEqual(json.loads(receipt.read_text())['commit'], self.commit)
            self.assertEqual({path.name for path in imports.iterdir()},
                             {self.version + '.tmp', self.version + '.json'})


if __name__ == '__main__':
    unittest.main()
