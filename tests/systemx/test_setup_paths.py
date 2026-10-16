"""Real read-only setup CLIs in owned space/Unicode copies; never installs services."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[2]
MAX_FILES = 1200
MAX_BYTES = 64 * 1024 * 1024
MAX_FILE_BYTES = 2 * 1024 * 1024
OUTPUT_BYTES = 1024 * 1024
CHILD_SECONDS = 20
BOOTSTRAPS = ('manager.py', 'lifecycle.py', 'versions.py', 'systemx_paths.py',
              'SYSTEMX.sh', 'SYSTEMX.ps1', 'INSTALL.sh', 'INSTALL.ps1')
PUBLIC_FILES = (
    'package.json', '.nvmrc', '.node-version',
    'scripts/developer-prerequisites.mjs', 'scripts/package-script-discovery.mjs',
    'scripts/package-script-purposes.json', 'scripts/check-doc-commands.mjs',
    'scripts/doc-command-contexts.json', 'scripts/fixture-inventory.mjs',
    'scripts/fixture-inventory.json', '.SYSTEMX/INSTALLATION.json', '.SYSTEMX/VERSION',
    '.SYSTEMX/config/project.example.json', '.SYSTEMX/Template/starter/package.json',
    '.SYSTEMX/Template/starter/README.md', 'integrations/gusto/functions/package.json',
    '.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', 'src/hr/persistence.ts',
    'src/hr/mock-workflows.ts', 'src/hr/people-operations.ts', 'src/hr/service-desk.ts',
    'src/hr/recruiting.ts', 'src/hr/performance.ts', 'src/hr/surveys.ts',
    'src/cms/model.ts', 'src/crm/model.ts', 'src/portals/workspaces.ts',
    'src/portals/PortalWorkspaceProvider.tsx', 'src/portals/DemoWorkspaceReset.tsx',
    'src/portals/registry.ts', 'src/portals/useDemoPersistence.ts',
    'src/portals/replacement-recovery.ts', 'integrations/gusto/sdk-employees.fixture.json',
    'integrations/gusto/sdk-onboarding.mjs', 'integrations/gusto/sdk-payroll.fixture.json',
    'integrations/gusto/sdk-payroll.mjs', 'integrations/gusto/mock-api.mjs',
    'src/hr/gusto/GustoSdkPreview.tsx', 'tests/browser/fixtures/portal-smoke-v1.json',
    'tests/browser/fixtures/portal-smoke-v1.sha256', 'tests/browser/seed-contract.mjs',
    'tests/browser/generate-seed.mjs', 'tests/fixtures/hr-capability-examples.json',
    'scripts/hr-role-examples.mjs', '.SYSTEMX/GUSTO/mock/fixtures/synthetic-sdk-employee-list.json',
    '.SYSTEMX/GUSTO/mock/fixtures/synthetic-sdk-employee-list-notes.json', 'README.md',
)
SENTINELS = ('.env.local', '.emulator-data/keep', '.SYSTEMX/local/keep',
             '.SYSTEMX/state/keep', '.SYSTEMX/.systemx/history/keep')


class OwnedChildError(RuntimeError):
    def __init__(self, label, kind, pid, returncode):
        super().__init__(label + ': owned child ' + kind)
        self.pid, self.returncode, self.kind = pid, returncode, kind


def owned_child(arguments, *, cwd, env, label, seconds=CHILD_SECONDS, limit=OUTPUT_BYTES):
    """Bound both pipes while owning one process group, including failure cleanup."""
    if not isinstance(arguments, list) or not arguments or any(not isinstance(item, str) or '\0' in item for item in arguments):
        raise ValueError('Child requires a nonempty argument array.')
    group = {'start_new_session': True} if os.name != 'nt' else {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP}
    child = subprocess.Popen(arguments, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False, **group)
    buffers, count, exceeded, lock = [bytearray(), bytearray()], [0], threading.Event(), threading.Lock()

    def terminate():
        try:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(child.pid), '/T', '/F'], shell=False,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
            else:
                os.killpg(child.pid, signal.SIGKILL)
        except (ProcessLookupError, OSError, subprocess.SubprocessError):
            if child.poll() is None:
                child.kill()

    def read_pipe(stream, target):
        try:
            while True:
                data = stream.read(8192)
                if not data:
                    return
                with lock:
                    count[0] += len(data)
                    target.extend(data[:max(0, limit + 1 - len(target))])
                    if count[0] > limit:
                        exceeded.set()
                        terminate()
                        return
        finally:
            stream.close()

    readers = [threading.Thread(target=read_pipe, args=(pipe, buffers[index]), daemon=True)
               for index, pipe in enumerate((child.stdout, child.stderr))]
    for reader in readers:
        reader.start()
    kind = None
    try:
        try:
            child.wait(timeout=seconds)
        except subprocess.TimeoutExpired:
            kind = 'timeout'; terminate(); child.wait(timeout=5)
        for reader in readers:
            reader.join(timeout=2)
        if any(reader.is_alive() for reader in readers):
            kind = kind or 'pipe-cleanup-failed'; terminate()
            for reader in readers:
                reader.join(timeout=2)
        if exceeded.is_set():
            kind = 'output-limit'
        if kind or child.returncode != 0:
            raise OwnedChildError(label, kind or 'failed', child.pid, child.returncode)
        return {'pid': child.pid, 'returncode': child.returncode,
                'stdout': buffers[0].decode('utf-8'), 'stderr': buffers[1].decode('utf-8')}
    finally:
        if child.poll() is None:
            terminate(); child.wait(timeout=5)
        for reader in readers:
            reader.join(timeout=2)


def public_file(root, relative):
    parts = PurePosixPath(relative).parts
    if not parts or any(part in ('', '.', '..') for part in parts) or PurePosixPath(relative).is_absolute() or '\\' in relative:
        raise ValueError('Public copy path escaped its allowlist.')
    candidate = root
    for part in parts:
        candidate /= part
        if candidate.is_symlink():
            raise ValueError('Public copy refuses symbolic links.')
    if not candidate.is_file() or candidate.stat().st_size > MAX_FILE_BYTES:
        raise ValueError('Public copy file is missing or oversized.')
    return candidate


def copy_allowlist(source):
    """Explicit public files, maintained Markdown and exact installed manifests."""
    names = set(PUBLIC_FILES)
    names.update('.SYSTEMX/' + name for name in BOOTSTRAPS)
    for directory in ('docs', 'wiki'):
        folder = source / directory
        if folder.is_symlink():
            raise ValueError('Documentation root is a symlink.')
        for current, directories, files in os.walk(folder, followlinks=False):
            if any((Path(current) / name).is_symlink() for name in directories):
                raise ValueError('Documentation traversal refuses symbolic links.')
            for name in files:
                if name.endswith('.md'):
                    names.add((Path(current) / name).relative_to(source).as_posix())
                    if len(names) > MAX_FILES:
                        raise ValueError('Public copy exceeds its file bound.')
    installation = json.loads(public_file(source, '.SYSTEMX/INSTALLATION.json').read_text())
    if installation['activeVersion'] != '1.9.0-alpha.6' or installation['pinnedVersion'] != '1.9.0-alpha.6' or installation['autoUpdate'] != 'manual':
        raise ValueError('Review the new selected installation before path smoke.')
    # Preserve every retained manifest-listed byte; no stub status/doctor and no
    # wholesale copy of ignored state. Research assets are included only where
    # an exact immutable release manifest requires them for genuine integrity.
    for version in installation['releases']:
        if not isinstance(version, str) or not version.replace('.', '').replace('-', '').isalnum():
            raise ValueError('Invalid retained release identity.')
        prefix = '.SYSTEMX/.systemx/releases/' + version + '/'
        manifest = json.loads(public_file(source, prefix + 'config/distribution.json').read_text())
        if manifest['version'] != version or not isinstance(manifest['files'], dict):
            raise ValueError('Invalid retained release manifest.')
        names.add(prefix + 'config/distribution.json')
        for name in manifest['files']:
            public_file(source, prefix + name)
            names.add(prefix + name)
    if len(names) > MAX_FILES:
        raise ValueError('Public copy exceeds its file bound.')
    total = sum(public_file(source, name).stat().st_size for name in names)
    if total > MAX_BYTES:
        raise ValueError('Public copy exceeds its byte bound.')
    return sorted(names), installation


def snapshot(root):
    files, directories = {}, []
    for current, children, names in os.walk(root, followlinks=False):
        for name in children:
            path = Path(current) / name
            if path.is_symlink():
                raise ValueError('Unexpected symlink in owned copy.')
            directories.append(path.relative_to(root).as_posix())
        for name in names:
            path = Path(current) / name
            if path.is_symlink():
                raise ValueError('Unexpected symlink in owned copy.')
            files[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return {'files': files, 'directories': sorted(directories)}


def child_environment(owned, npm_config):
    result = {key: value for key, value in os.environ.items()
              if key not in {'NODE_OPTIONS', 'NODE_PATH', 'PYTHONPATH', 'PYLAUNCHER_ALLOW_INSTALL',
                             'PYLAUNCHER_ALWAYS_INSTALL', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'}
              and not key.upper().startswith('GIT_CONFIG_')}
    result.update(PYTHONDONTWRITEBYTECODE='1', PYTHON_MANAGER_AUTOMATIC_INSTALL='false',
                  npm_config_update_notifier='false', npm_config_audit='false', npm_config_fund='false',
                  npm_config_userconfig=str(npm_config), npm_config_globalconfig=str(owned / 'read-only-npm-global-config'),
                  npm_config_cache=str(owned / 'npm-cache'), GIT_OPTIONAL_LOCKS='0',
                  GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=str(npm_config))
    return result


def npm_cli(node):
    candidates = []
    inherited = os.environ.get('npm_execpath')
    if inherited and inherited.replace('\\', '/').endswith('/npm/bin/npm-cli.js'):
        candidates.append(Path(inherited))
    candidates += [node.parent / 'node_modules/npm/bin/npm-cli.js', node.parent.parent / 'lib/node_modules/npm/bin/npm-cli.js']
    # Homebrew keeps Node in Cellar and npm in the prefix. Resolve only an
    # installed filesystem entry with the same strict standard CLI suffix.
    installed = shutil.which('npm')
    if installed:
        resolved = Path(installed).resolve()
        if resolved.as_posix().endswith('/npm/bin/npm-cli.js'):
            candidates.append(resolved)
    return next((path for path in candidates if path.is_file()), None)


class SetupPathSmoke(unittest.TestCase):
    def exercise(self, directory_name):
        node_value = shutil.which('node')
        self.assertIsNotNone(node_value, 'An installed Node executable is required; no install fallback.')
        node = Path(node_value).resolve()
        npm = npm_cli(node)
        self.assertIsNotNone(npm, 'An installed standard npm CLI is required; no shell/download fallback.')
        names, installation = copy_allowlist(ROOT)
        parent_before = {name: hashlib.sha256(public_file(ROOT, name).read_bytes()).hexdigest() for name in names}
        with tempfile.TemporaryDirectory(prefix='webappx-owned-setup-') as temporary:
            owned = Path(temporary).resolve(); copied = owned / directory_name; copied.mkdir()
            for name in names:
                target = copied / name; target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(public_file(ROOT, name), target)
            for name in SENTINELS:
                path = copied / name; path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b'Fictional path smoke preservation sentinel.\n')
            config_path = owned / 'read-only-npm-config'
            config_path.write_text('', encoding='utf-8')
            (owned / 'read-only-npm-global-config').write_text('', encoding='utf-8')
            env = child_environment(owned, config_path)
            manager = str(copied / '.SYSTEMX/manager.py')
            initial = snapshot(copied)
            config = {'schemaVersion': 1, 'project': {'name': 'WebAppX Café 東京 fixture', 'description': 'Owned read-only setup fixture'},
                      'checks': [{'name': 'do-not-execute', 'command': [sys.executable, '-I', '-B', '-c', "from pathlib import Path; Path('configured-check-executed').write_text('TRAP')"]}],
                      'commands': {'dev': [], 'build': [], 'deploy': []}}
            (copied / '.SYSTEMX/project.json').write_text(json.dumps(config, ensure_ascii=False) + '\n', encoding='utf-8')
            before = snapshot(copied)
            self.assertEqual(set(before['files']) - set(initial['files']), {'.SYSTEMX/project.json'})
            self.assertEqual({key: value for key, value in before['files'].items() if key != '.SYSTEMX/project.json'}, initial['files'])
            receipts = []

            def run(args, label):
                result = owned_child(args, cwd=copied, env=env, label=label)
                receipts.append({'label': label, 'pid': result['pid'], 'exit': result['returncode']})
                self.assertEqual(snapshot(copied), before, label + ' must preserve every byte and directory')
                return result['stdout']

            report = json.loads(run([str(node), str(copied / 'scripts/developer-prerequisites.mjs'), '--json'], 'developer doctor'))
            self.assertTrue(report['ok']); self.assertEqual({item['id'] for item in report['checks']}, {'node', 'npm', 'git', 'python'})
            discovery = json.loads(run([str(node), str(copied / 'scripts/package-script-discovery.mjs'), '--check', '--json'], 'script discovery'))
            self.assertTrue(discovery['ok']); self.assertEqual([group['purpose'] for group in discovery['groups']], ['setup', 'app', 'portal', 'SYSTEMX', 'wiki', 'release'])
            npm_discovery = json.loads(run([str(node), str(npm), 'run', '--silent', 'scripts:list', '--', '--json'], 'actual npm script discovery'))
            self.assertEqual(npm_discovery, discovery)
            fixtures = json.loads(run([str(node), str(copied / 'scripts/fixture-inventory.mjs'), '--check', '--json'], 'fixture inventory'))
            self.assertEqual(fixtures['schemaVersion'], 1); self.assertEqual(fixtures['intent'], 'fictional-fixture-source-inventory')
            self.assertEqual(fixtures['counts'], {'groups': 8, 'sourceFiles': 30})
            self.assertEqual({group['id'] for group in fixtures['groups']}, {'native-hr', 'native-cms', 'native-crm', 'sdk-onboarding', 'sdk-payroll', 'browser-baseline', 'role-examples', 'sdk-reference'})
            status = json.loads(run([sys.executable, '-I', '-B', manager, 'status', '--target', str(copied)], 'managed status'))
            self.assertEqual(status['target'], str(copied)); self.assertEqual(status['defaults'], str(copied / '.SYSTEMX/.systemx/releases/1.9.0-alpha.6'))
            for key in ('activeVersion', 'pinnedVersion', 'autoUpdate'):
                self.assertEqual(status[key], installation[key])
            self.assertEqual(status['retainedVersions'], sorted(installation['releases']))
            self.assertEqual(status['integrity'], 'verified')
            doctor = run([sys.executable, '-I', '-B', manager, 'run', '--target', str(copied), '--offline', '--', 'doctor'], 'configured offline doctor')
            self.assertIn('Project: WebAppX Café 東京 fixture', doctor); self.assertIn('Configured checks: 1', doctor)
            self.assertIn('check:do-not-execute: executable available', doctor)
            self.assertIn('Diagnostics only;', doctor); self.assertNotIn('TRAP', doctor)
            docs = json.loads(run([str(node), str(copied / 'scripts/check-doc-commands.mjs'), '--json'], 'documentation commands'))
            self.assertTrue(docs['ok']); self.assertGreater(docs['documentCount'], 10); self.assertGreater(docs['referenceCount'], 10)
            self.assertFalse((copied / 'configured-check-executed').exists())
            self.assertFalse((copied / 'node_modules').exists()); self.assertFalse((copied / '.git').exists())
            self.assertEqual(len(receipts), 7)
            self.assertEqual(snapshot(copied), before)
        self.assertFalse(owned.exists(), 'Only the owned temporary directory must be cleaned')
        self.assertEqual({name: hashlib.sha256(public_file(ROOT, name).read_bytes()).hexdigest() for name in names}, parent_before)
        print(json.dumps({'fixture': directory_name, 'platform': sys.platform, 'copiedFiles': len(names), 'copiedBytes': sum(public_file(ROOT, name).stat().st_size for name in names), 'commands': receipts, 'ownedCopyRemoved': True, 'sourceBytesPreserved': True}, ensure_ascii=False))

    def test_space_path_actual_read_only_setup(self):
        self.exercise('WebAppX setup spaces')

    def test_unicode_and_spaces_actual_read_only_setup(self):
        self.exercise('WebAppX Café 東京 setup')

    def test_owned_child_failure_timeout_and_output_bounds_cleanup(self):
        with tempfile.TemporaryDirectory(prefix='webappx-setup-child-') as temporary:
            root = Path(temporary); config = root / 'config'; config.write_text('')
            (root / 'read-only-npm-global-config').write_text('')
            env = child_environment(root, config)
            for code, kind, timeout, limit in [('raise SystemExit(7)', 'failed', 2, 1024),
                                               ('import time; time.sleep(10)', 'timeout', 0.1, 1024),
                                               ("import sys; sys.stdout.write('x'*200000); sys.stdout.flush()", 'output-limit', 2, 1024)]:
                with self.subTest(kind=kind), self.assertRaises(OwnedChildError) as caught:
                    owned_child([sys.executable, '-I', '-B', '-c', code], cwd=root, env=env, label='bounded fixture', seconds=timeout, limit=limit)
                self.assertEqual(caught.exception.kind, kind)
                self.assertIsNotNone(caught.exception.returncode)
                if os.name != 'nt':
                    with self.assertRaises(ProcessLookupError):
                        os.kill(caught.exception.pid, 0)

    def test_copy_rejects_path_escape_symlink_and_no_private_glob(self):
        with tempfile.TemporaryDirectory(prefix='webappx-setup-fence-') as temporary:
            root = Path(temporary); (root / 'public.txt').write_text('public')
            with self.assertRaises(ValueError):
                public_file(root, '../outside')
            if hasattr(os, 'symlink'):
                try:
                    (root / 'linked.txt').symlink_to(root / 'public.txt')
                except OSError:
                    self.skipTest('Symlink creation unavailable on this test host')
                with self.assertRaises(ValueError):
                    public_file(root, 'linked.txt')
        self.assertNotIn('.env.local', PUBLIC_FILES)
        self.assertFalse(any(name == '.git' or name.startswith('node_modules/') for name in PUBLIC_FILES))


if __name__ == '__main__':
    unittest.main()
