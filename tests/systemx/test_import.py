import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
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
        result = importer.sync(self.target, self.source)
        self.assertFalse(result['applied'])
        self.assertEqual(list(self.target.rglob('*')), before)

    def test_apply_reimport_preserves_records_extensions_and_receipt(self):
        outer = self.target / '.SYSTEMX'
        (outer / 'WORK').mkdir(parents=True)
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

    def test_new_version_keeps_old_defaults_and_host_records(self):
        importer.sync(self.target, self.source, True)
        outer = self.target / '.SYSTEMX'
        memory = outer / 'MEMORY/PROJECT.md'
        memory.write_text('Accepted private project facts\n')
        defaults = self.source / '.SYSTEMX'
        old_commit = self.commit
        next_version = '1.8.7-alpha.1'
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

    def test_receipt_conflict_is_rejected_before_installation(self):
        receipt = self.target / '.SYSTEMX/imports' / (self.version + '.json')
        receipt.parent.mkdir(parents=True)
        receipt.write_text(json.dumps({'commit': 'different', 'manifestSha256': 'invalid'}))
        with self.assertRaisesRegex(ValueError, 'Version receipt differs'):
            importer.sync(self.target, self.source, True)
        self.assertFalse((self.target / '.SYSTEMX/INSTALLATION.json').exists())


if __name__ == '__main__':
    unittest.main()
