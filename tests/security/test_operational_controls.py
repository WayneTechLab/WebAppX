import json
import os
from pathlib import Path
import shutil
import shlex
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
BASH = shutil.which('bash')


class OperationalControls(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.base = Path(self.temporary.name)
        self.root = self.base / "repo ' dollar $ and tick `"
        self.scripts = self.root / '.SYSTEMX/scripts'
        self.scripts.mkdir(parents=True)
        for name in ['deploy.sh', 'env-data.mjs', 'install-command.sh']:
            shutil.copy2(ROOT / '.SYSTEMX/scripts' / name, self.scripts / name)
        self.bin = self.base / 'bin'
        self.bin.mkdir()
        self.env = {**os.environ, 'PATH': str(self.bin) + os.pathsep + os.environ['PATH']}

    def tearDown(self):
        self.temporary.cleanup()

    def run_script(self, name, *args):
        return self.run_bash(self.scripts / name, *args)

    def run_bash(self, script, *args):
        # Git Bash prepends its own tool directories at startup. Put fixture
        # stubs first inside the shell after that initialization.
        return subprocess.run([BASH, '-c',
                               'export PATH="$(cd "$1" && pwd):$PATH"; shift; exec bash "$@"',
                               'fixture', str(self.bin), str(script), *args], env=self.env,
                              capture_output=True, text=True)

    def test_background_preserves_every_constraint_and_project_argument(self):
        capture = self.base / 'arguments.json'
        stub = self.bin / 'nohup'
        stub.write_bytes(('#!/usr/bin/env bash\nexec ' + shlex.quote(Path(sys.executable).as_posix()) + ' - "$@" <<\'PY\'\nimport json,sys\nfrom pathlib import Path\n'
                        + 'Path(' + repr(str(capture)) + ').write_text(json.dumps(sys.argv[1:]))\nPY\n').encode())
        stub.chmod(0o755)
        args = ['hosting', '--bg', '--preflight', '--project', 'demo-selected', '--skip-push', '--skip-build']
        result = self.run_script('deploy.sh', *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        import time
        for _ in range(50):
            if capture.exists():
                break
            time.sleep(0.02)
        logs = '\n'.join(path.read_text() for path in (self.root / '.SYSTEMX/logs').glob('deploy-bg-*.log'))
        self.assertTrue(capture.exists(), logs)
        self.assertEqual(json.loads(capture.read_text()),
                         ['bash', str(self.scripts / 'deploy.sh'), *[arg for arg in args if arg != '--bg']])

    def test_read_only_modes_refuse_mutation_and_unknown_flags(self):
        for args in [('--preflight', '--bump', 'patch'), ('--dry-run', '--fix'),
                     ('--unknown',), ('--project',)]:
            self.assertNotEqual(self.run_script('deploy.sh', *args).returncode, 0)
        self.assertFalse((self.root / '.SYSTEMX/webapp-version').exists())

    def test_installed_launcher_keeps_path_and_arguments_literal(self):
        menu = self.root / '.SYSTEMX/WSG-MENU.sh'
        capture = self.base / 'launcher.json'
        menu.write_bytes(('#!/usr/bin/env bash\n' + shlex.quote(Path(sys.executable).as_posix()) + ' - "$@" <<\'PY\'\nimport json,sys\nfrom pathlib import Path\n'
                        + 'Path(' + repr(str(capture)) + ').write_text(json.dumps(sys.argv[1:]))\nPY\n').encode())
        snippet = self.run_script('install-command.sh', '--print')
        self.assertEqual(snippet.returncode, 0)
        launcher = self.base / 'launcher.sh'
        launcher.write_bytes((snippet.stdout + '\nWSG-MENU "two words" "literal $ value"\n').encode())
        result = subprocess.run([BASH, str(launcher)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(capture.read_text()), ['two words', 'literal $ value'])

    def test_rule_distributions_are_identical(self):
        self.assertEqual((ROOT / 'firestore.rules').read_bytes(),
                         (ROOT / '.SYSTEMX/Template/starter/firestore.rules').read_bytes())

    def test_metadata_hooks_keep_checkout_path_and_branch_as_strings(self):
        hooks = self.root / '.SYSTEMX/hooks'
        hooks.mkdir()
        for name in ['post-merge', 'pre-push']:
            shutil.copy2(ROOT / '.SYSTEMX/hooks' / name, hooks / name)
        versions = self.root / '.SYSTEMX/webapp-version'
        versions.mkdir()
        (versions / 'version.json').write_text(json.dumps({'app': {'version': '3.1.0'}}))
        (self.root / 'package.json').write_text(json.dumps({'version': '3.1.0'}))
        for args in [('init', '-q'), ('-c', 'user.name=Fixture', '-c', 'user.email=test@example.test', 'commit', '--allow-empty', '-qm', 'Fixture'), ('checkout', '-qb', "feature/owner's-ui")]:
            subprocess.run(['git', '-C', str(self.root), *args], check=True)
        for name in ['post-merge', 'pre-push']:
            result = subprocess.run([BASH, str(hooks / name)], cwd=self.root, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads((versions / 'version.json').read_text())['app']['branch'], "feature/owner's-ui")

    def test_seeded_secret_values_round_trip_without_expansion(self):
        library = ROOT / '.SYSTEMX/Template/lib/firebase-config.sh'
        answers = self.base / 'answers'
        fixture = "Wayne's literal $ value & backtick `"
        answers.write_text('SMTP_PASSWORD=' + fixture + '\n')
        result = subprocess.run([BASH, '-c', 'source "$1"; wsg_seed_env_files "$2" "$3"',
                                 'fixture', str(library), str(answers), str(self.root)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        result = subprocess.run(['node', str(self.scripts / 'env-data.mjs'), str(self.root / '.secrets.env')],
                                capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        parsed = result.stdout.decode().split('\0')
        self.assertEqual(dict(zip(parsed[::2], parsed[1::2]))['SMTP_PASSWORD'], fixture)

    def test_wiki_preview_refuses_linked_destination_without_external_changes(self):
        if os.name == 'nt':
            try:
                (self.base / 'probe-link').symlink_to(self.root, target_is_directory=True)
            except OSError as error:
                if getattr(error, 'winerror', None) == 1314:
                    self.skipTest('Windows symlink creation privilege unavailable')
                raise
        scripts = self.root / 'scripts'
        scripts.mkdir()
        shutil.copy2(ROOT / 'scripts/sync-wiki.sh', scripts / 'sync-wiki.sh')
        wiki = self.root / 'wiki'
        wiki.mkdir()
        (wiki / 'Home.md').write_text('Public fixture\n')
        outside = self.base / 'outside.md'
        outside.write_text('Private fixture\n')
        stub = self.bin / 'git'
        stub.write_bytes(('#!/usr/bin/env bash\nexec ' + shlex.quote(Path(sys.executable).as_posix()) + ' - "$@" <<\'PY\'\nimport sys\nfrom pathlib import Path\n'
                        + "if 'clone' in sys.argv:\n    (Path(sys.argv[-1]) / 'Home.md').symlink_to(Path(" + repr(str(outside)) + "))\n"
                        + "else:\n    print('https://github.com/example/template.git')\nPY\n").encode())
        stub.chmod(0o755)
        result = self.run_bash(scripts / 'sync-wiki.sh', '--dry-run')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('refused a linked', result.stderr)
        self.assertEqual(outside.read_text(), 'Private fixture\n')


if __name__ == '__main__':
    unittest.main()
