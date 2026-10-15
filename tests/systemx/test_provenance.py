"""Provenance contracts using synthetic intact releases, never adopted records."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('provenance_test_subject', ROOT / 'scripts/systemx-provenance.py')
provenance = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(provenance)
MANAGER = provenance._manager()
V1, V2 = '1.9.0-alpha.6', '1.9.1-alpha.1'


def encoded(value):
    return (json.dumps(value, sort_keys=True) + '\n').encode()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def synthetic_release(version, *, extra=None, schema=2):
    """Build minimal real-manager-valid bytes without copying a release tree."""
    files = {name: ('# synthetic ' + name + '\n').encode() for name in (
        'LICENSE', 'STANDARD.md', 'START-HERE.md', 'README.md', 'CHANGELOG.md',
        'manager.py', 'lifecycle.py', 'versions.py', 'systemx_paths.py',
        'SYSTEMX.sh', 'SYSTEMX.ps1', 'INSTALL.sh', 'INSTALL.ps1',
        'scripts/systemx.py', 'scripts/project_memory.py', 'scripts/project_workspaces.py',
        'scripts/agent_standards.py', 'scripts/agent_x.py', 'scripts/agent_z.py',
        'scripts/agent_y.py', 'AGENTS/agent.y/README.md', 'docs/AGENT-Y.md',
        'tests/test_agent_y.py', 'templates/AGENT-X-MEMORY.md',
        'templates/AGENT-Z-MEMORY.md', 'templates/AGENT-Y-MEMORY.md',
        'GLOBAL/CONTEXT.md', 'PLAN/MASTER-PLAN.md', 'MEMORY/PROJECT.md',
        'AGENTS/agent.0/MEMORY.md', 'GLOBAL/ACCESS-MATRIX.md', 'PLAN/MAP.md',
        'templates/project/GLOBAL/ACCESS-MATRIX.md', 'templates/project/PLAN/MAP.md',
    )}
    files['VERSION'] = (version + '\n').encode()
    files['SOURCE.json'] = encoded({'synthetic': True})
    files['WORK/TASKS.json'] = encoded({'schemaVersion': 1, 'tasks': []})
    files['WORK/FOCUS.json'] = encoded({'schemaVersion': 1, 'objective': '', 'taskIds': [], 'checkpoint': '', 'updatedAt': ''})
    files['AGENTS/REGISTRY.json'] = encoded({'schemaVersion': 1, 'agents': [
        {'id': 'agent.0', 'role': 'coordinator', 'memory': 'AGENTS/agent.0/MEMORY.md'}]})
    files['config/project.example.json'] = encoded({'schemaVersion': 1, 'project': {'name': '', 'description': ''},
                                                  'checks': [], 'commands': {'dev': [], 'build': [], 'deploy': []}})
    files['config/agent-z-policy.json'] = encoded({'synthetic': True})
    files['Projects/REGISTRY.json'] = encoded({'schemaVersion': 1, 'projects': []})
    for name in ('WORK/TASKS.json', 'WORK/FOCUS.json', 'AGENTS/REGISTRY.json'):
        files['templates/project/' + name] = files[name]
    files['templates/project/project.json'] = files['config/project.example.json']
    seeds = (
        'GLOBAL/CONTEXT.md', 'PLAN/MASTER-PLAN.md', 'MEMORY/PROJECT.md',
        'AGENTS/agent.0/MEMORY.md', 'AGENTS/REGISTRY.json', 'WORK/TASKS.json',
        'WORK/FOCUS.json', 'config/project.example.json', 'GLOBAL/ACCESS-MATRIX.md',
        'PLAN/MAP.md', 'templates/project/GLOBAL/ACCESS-MATRIX.md',
        'templates/project/PLAN/MAP.md',
    )
    if tuple(map(int, version.split('-', 1)[0].split('.'))) < (1, 8, 9):
        seeds = seeds[:8]
    files['config/template-records.json'] = encoded({'schemaVersion': 1, 'sha256': {
        name: sha(files[name].replace(b'\r\n', b'\n')) for name in seeds}})
    files.update(extra or {})
    files['config/distribution.json'] = encoded({'schemaVersion': schema, 'version': version, 'files': {
        name: MANAGER.distribution_digest(name, data, schema) for name, data in files.items()}})
    # This is the actual production verifier, not a fixture-only mock.
    MANAGER.verified_bundle(files)
    return files


def write_files(root, files):
    for name, data in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def tree_bytes(root):
    """Observe bytes/types including ignored files without following links."""
    result = {}
    for folder, directories, files in os.walk(root, followlinks=False):
        for name in directories + files:
            path = Path(folder) / name
            relative = path.relative_to(root).as_posix()
            info = path.lstat()
            if path.is_symlink():
                result[relative] = ('link', os.readlink(path))
            elif stat.S_ISREG(info.st_mode):
                result[relative] = ('file', path.read_bytes(), stat.S_IMODE(info.st_mode))
            elif stat.S_ISDIR(info.st_mode):
                result[relative] = ('directory', stat.S_IMODE(info.st_mode))
            else:
                result[relative] = ('special', stat.S_IFMT(info.st_mode))
    return result


class ProvenanceInventory(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name) / 'host'
        self.root.mkdir()
        self.outer = self.root / '.SYSTEMX'
        self.files = synthetic_release(V1, extra={'MEDIA/asset.bin': b'\x00\r\n\xff'})
        self.install({V1: self.files})

    def install(self, versions):
        write_files(self.outer, next(iter(versions.values())))
        for version, files in versions.items():
            write_files(self.outer / '.systemx/releases' / version, files)
        active = list(versions)[-1]
        self.state = {'schemaVersion': 2, 'profile': 'project', 'repository': 'WayneTechLab/dotSYSTEMX',
                      'activeVersion': active, 'pinnedVersion': active, 'autoUpdate': 'manual',
                      'installedAt': '2026-01-01T00:00:00Z', 'updatedAt': '2026-01-01T00:00:00Z',
                      'releases': {v: sha(f['config/distribution.json']) for v, f in versions.items()},
                      'archiveDigests': {v: None for v in versions}}
        (self.outer / 'INSTALLATION.json').write_bytes(encoded(self.state))

    def entry(self, name):
        report = provenance.inventory(self.root, path=name)
        self.assertTrue(report['found'])
        self.assertEqual(report['returned'], 1)
        return report['entries'][0]

    def test_blank_record_has_literal_host_ownership_separate_from_stock_equality(self):
        before = tree_bytes(self.root)
        self.assertEqual(self.entry('GLOBAL/CONTEXT.md'), {
            'path': 'GLOBAL/CONTEXT.md', 'type': 'file', 'ownership': 'host',
            'role': 'project-record', 'updatePolicy': 'preserve-host-record',
            'contentRelation': 'exact', 'matchingRetainedVersions': [{'version': V1, 'relation': 'exact'}],
            'bootstrapExactMatch': False,
        })
        for name in ('WORK/TASKS.json', 'WORK/FOCUS.json', 'AGENTS/REGISTRY.json',
                     'PLAN/MASTER-PLAN.md', 'MEMORY/PROJECT.md', 'config/project.example.json'):
            with self.subTest(name=name):
                entry = self.entry(name)
                self.assertEqual(entry['ownership'], 'host')
                self.assertEqual(entry['contentRelation'], 'exact')
                self.assertFalse(entry['bootstrapExactMatch'])
        self.assertEqual(tree_bytes(self.root), before)

    def test_host_only_extensions_configuration_and_entrypoints_are_preserved(self):
        paths = [
            'LAN/Builder/custom.mjs', 'KIT/brand.css', 'Template/setup.sh',
            'deploy/local.sh', 'hooks/pre-push', 'scripts/setup-state.sh',
            'scripts/deploy-functions.sh', 'scripts/firebase-setup.sh',
            'scripts/bootstrap.sh', 'Unified-Setup-Process/standards/custom.md',
            'GUSTO/custom.json', 'status/TODO.md', 'webapp-version/version.json',
            'project.json', 'config/host.json', 'docs/custom.md', 'AI/custom.md',
            'Projects/child/.SYSTEMXP/MEMORY/PROJECT.md', 'WSG-MENU.sh',
            'LAN/Builder/state/model.mjs', 'LAN/Builder/local/editor.mjs',
        ]
        write_files(self.outer, {name: b'private host value must not appear\n' for name in paths})
        report = provenance.collect_inventory(self.root)
        entries = {entry['path']: entry for entry in report['entries']}
        for name in paths:
            with self.subTest(name=name):
                self.assertTrue(provenance.is_host_owned(name))
                self.assertEqual(entries[name]['ownership'], 'host')
                self.assertEqual(entries[name]['matchingRetainedVersions'], [])
        self.assertNotIn('private host value', json.dumps(report))
        self.assertNotIn(str(self.root), json.dumps(report))

    def test_other_outer_defaults_modified_and_unrecognized_content_are_distinct(self):
        write_files(self.outer, {'CHANGELOG.md': b'customized\n', 'custom/unknown.json': b'{"secret":"value"}'})
        self.assertEqual(self.entry('scripts/systemx.py')['contentRelation'], 'exact')
        modified = self.entry('CHANGELOG.md')
        self.assertEqual((modified['ownership'], modified['contentRelation']), ('imported-default', 'modified'))
        self.assertEqual(modified['updatePolicy'], 'preserve-existing-review-before-reconcile')
        unknown = self.entry('custom/unknown.json')
        self.assertEqual((unknown['ownership'], unknown['contentRelation']), ('undetermined', 'unrecognized-unread'))
        self.assertEqual(unknown['matchingRetainedVersions'], [])

    def test_manifest_equivalence_is_distinct_from_byte_exact_bootstrap(self):
        path = self.outer / 'manager.py'
        path.write_bytes(path.read_bytes().replace(b'\n', b'\r\n'))
        entry = self.entry('manager.py')
        self.assertEqual(entry['contentRelation'], 'manifest-equivalent')
        self.assertEqual(entry['matchingRetainedVersions'], [{'version': V1, 'relation': 'manifest-equivalent'}])
        self.assertFalse(entry['bootstrapExactMatch'])
        self.assertEqual(entry['updatePolicy'], 'explicit-byte-exact-bootstrap-review')
        self.assertTrue(self.entry('SYSTEMX.sh')['bootstrapExactMatch'])

    def test_schema_two_binary_and_unknown_formats_remain_byte_exact(self):
        files = synthetic_release(V2, extra={'MEDIA/payload.dat': b'raw\r\ndata\n'})
        self.install({V1: self.files, V2: files})
        write_files(self.outer, {'MEDIA/asset.bin': b'\x00\n\xff', 'MEDIA/payload.dat': b'raw\ndata\n'})
        self.assertEqual(self.entry('MEDIA/asset.bin')['contentRelation'], 'modified')
        self.assertEqual(self.entry('MEDIA/payload.dat')['contentRelation'], 'modified')

    def test_historical_schema_one_uses_its_original_binary_equivalence(self):
        legacy_version = '1.8.6-alpha.1'
        legacy = synthetic_release(legacy_version, extra={'MEDIA/legacy.bin': b'\x00\r\n\xff'}, schema=1)
        self.install({legacy_version: legacy, V1: self.files})
        write_files(self.outer, {'MEDIA/legacy.bin': b'\x00\n\xff'})
        entry = self.entry('MEDIA/legacy.bin')
        self.assertEqual(entry['contentRelation'], 'manifest-equivalent')
        self.assertEqual(entry['matchingRetainedVersions'], [
            {'version': legacy_version, 'relation': 'manifest-equivalent'}])

    def test_retained_runtime_named_files_remain_immutable_and_manifest_checked(self):
        newer = synthetic_release(V2, extra={
            'MEDIA/example.log': b'published documentation artifact\n',
            '__pycache__/asset.dat': b'published opaque fixture\n',
        })
        self.install({V1: self.files, V2: newer})
        for name in ('MEDIA/example.log', '__pycache__/asset.dat'):
            entry = self.entry('.systemx/releases/' + V2 + '/' + name)
            self.assertEqual((entry['ownership'], entry['role'], entry['updatePolicy'], entry['contentRelation']),
                             ('upstream', 'immutable-release', 'immutable-retain', 'verified-retained'))

    def test_all_matching_retained_versions_are_reported_in_version_order(self):
        newer = synthetic_release(V2)
        self.install({V1: self.files, V2: newer})
        report = provenance.inventory(self.root, path='GLOBAL/CONTEXT.md')
        self.assertEqual(report['retainedVersions'], [V1, V2])
        self.assertEqual(report['selectedVersion'], V2)
        self.assertEqual(report['pinnedVersion'], V2)
        self.assertEqual(report['entries'][0]['matchingRetainedVersions'], [
            {'version': V1, 'relation': 'exact'}, {'version': V2, 'relation': 'exact'}])
        immutable = self.entry('.systemx/releases/' + V1 + '/GLOBAL/CONTEXT.md')
        self.assertEqual((immutable['ownership'], immutable['role'], immutable['contentRelation']),
                         ('upstream', 'immutable-release', 'verified-retained'))
        self.assertEqual(immutable['updatePolicy'], 'immutable-retain')

    def test_metadata_subtypes_are_unread_and_no_receipt_values_escape(self):
        write_files(self.outer, {'imports/' + V1 + '.json': b'{"token":"DO-NOT-EMIT","local":"/machine/private"}'})
        state = self.entry('INSTALLATION.json')
        receipt = self.entry('imports/' + V1 + '.json')
        self.assertEqual((state['ownership'], state['role'], state['contentRelation']),
                         ('manager', 'installation-metadata', 'metadata-unread'))
        self.assertEqual((receipt['ownership'], receipt['role'], receipt['contentRelation']),
                         ('manager', 'import-metadata', 'metadata-unread'))
        report = json.dumps(provenance.collect_inventory(self.root))
        self.assertNotIn('DO-NOT-EMIT', report)
        self.assertNotIn('/machine/private', report)

    def test_runtime_history_cache_and_secret_payloads_are_never_read(self):
        paths = [
            '.systemx/history/private.json', '.systemx/operations/private.json',
            '.systemx/cache/private.bin', 'local/private.json', 'logs/private.log',
            'state/private.json', 'LAN/Temp/private.json', 'LAN/Backup/private.json',
            'LAN/Files/private.json', 'LAN/local.token', '__pycache__/private.pyc',
            'Projects/child/.SYSTEMXP/local/private.json', 'secrets.env',
            'Template/interview.answers', 'status/setup-state.env',
            'Setup-Input_MD/private.md', '.env.production',
        ]
        write_files(self.outer, {name: b'SECRET\x00\r\n' for name in paths})
        original = MANAGER.regular_bytes
        reads = []
        def bounded_read(path, *args, **kwargs):
            reads.append(path.resolve().relative_to(self.outer.resolve()).as_posix())
            return original(path, *args, **kwargs)
        before = tree_bytes(self.root)
        with patch.object(MANAGER, 'regular_bytes', side_effect=bounded_read):
            report = provenance.collect_inventory(self.root)
        self.assertTrue(set(paths).isdisjoint(reads))
        entries = {entry['path']: entry for entry in report['entries']}
        for name in ('.systemx/history', 'local', 'LAN/Temp', 'secrets.env', 'Template/interview.answers'):
            self.assertEqual(entries[name]['contentRelation'], 'excluded-unread')
        self.assertNotIn('.systemx/history/private.json', entries)
        self.assertNotIn('SECRET', json.dumps(report))
        self.assertEqual(tree_bytes(self.root), before)

    def test_paging_and_exact_path_lookup_are_deterministic_and_complete(self):
        before = tree_bytes(self.root)
        complete = provenance.collect_inventory(self.root)
        paths = []
        after = None
        while True:
            report = provenance.inventory(self.root, limit=7, after=after)
            self.assertEqual(report['total'], complete['total'])
            self.assertEqual(report['returned'], len(report['entries']))
            self.assertEqual(report['counts'], complete['counts'])
            self.assertLessEqual(report['returned'], 7)
            paths.extend(entry['path'] for entry in report['entries'])
            if not report['truncated']:
                self.assertIsNone(report['continuation'])
                break
            self.assertEqual(report['continuation'], report['entries'][-1]['path'])
            after = report['continuation']
        self.assertEqual(paths, [entry['path'] for entry in complete['entries']])
        self.assertEqual(len(paths), len(set(paths)))
        self.assertEqual(provenance.inventory(self.root, limit=7), provenance.inventory(self.root, limit=7))
        missing = provenance.inventory(self.root, path='GLOBAL/CONTEXT')
        self.assertFalse(missing['found'])
        self.assertEqual(missing['entries'], [])
        self.assertFalse(missing['truncated'])
        self.assertEqual(tree_bytes(self.root), before)

    def test_invalid_queries_are_refused_without_changes(self):
        before = tree_bytes(self.root)
        for kwargs in ({'limit': 0}, {'limit': 1001}, {'limit': True},
                       {'path': '../private'}, {'path': '/private'}, {'path': 'GLOBAL\\CONTEXT.md'},
                       {'path': 'C:/private'}, {'path': 'GLOBAL/CONTEXT.md', 'after': 'LICENSE'},
                       {'after': 'nonexistent'}):
            with self.subTest(kwargs=kwargs), self.assertRaises(provenance.ProvenanceError):
                provenance.inventory(self.root, **kwargs)
        self.assertEqual(tree_bytes(self.root), before)

    def test_invalid_active_or_inactive_snapshot_is_never_reported_verified(self):
        newer = synthetic_release(V2)
        self.install({V1: self.files, V2: newer})
        for version in (V1, V2):
            snapshot = self.outer / '.systemx/releases' / version / 'STANDARD.md'
            original = snapshot.read_bytes()
            snapshot.write_bytes(original + b'changed\n')
            before = tree_bytes(self.root)
            with self.subTest(version=version), self.assertRaisesRegex(provenance.ProvenanceError, 'integrity failed'):
                provenance.inventory(self.root, path='GLOBAL/CONTEXT.md')
            self.assertEqual(tree_bytes(self.root), before)
            snapshot.write_bytes(original)

    def test_modified_manifest_and_state_fingerprint_and_unexpected_snapshot_files_refused(self):
        snapshot = self.outer / '.systemx/releases' / V1
        unexpected = snapshot / 'unlisted.md'
        unexpected.write_bytes(b'not in manifest\n')
        with self.assertRaises(provenance.ProvenanceError):
            provenance.collect_inventory(self.root)
        unexpected.unlink()
        state_path = self.outer / 'INSTALLATION.json'
        self.state['releases'][V1] = '0' * 64
        state_path.write_bytes(encoded(self.state))
        before = tree_bytes(self.root)
        with self.assertRaisesRegex(provenance.ProvenanceError, 'integrity failed'):
            provenance.collect_inventory(self.root)
        self.assertEqual(tree_bytes(self.root), before)

    def test_outer_directory_type_conflict_is_explicit_diagnostic(self):
        path = self.outer / 'README.md'
        path.unlink()
        path.mkdir()
        write_files(path, {'child.md': b'preserve\n'})
        report = provenance.inventory(self.root, path='README.md')
        self.assertEqual(report['entries'][0]['type'], 'directory')
        self.assertEqual(report['entries'][0]['contentRelation'], 'type-conflict')
        self.assertEqual(report['entries'][0]['ownership'], 'host')
        self.assertEqual(report['diagnostics'], [{'code': 'outer-type-conflict', 'path': 'README.md',
                                                'message': 'A directory occupies a retained default file path; preserve and review'}])

    def test_unmanaged_and_missing_installations_remain_unverified_without_file_reads(self):
        missing = self.root / 'new-host'
        missing.mkdir()
        report = provenance.collect_inventory(missing)
        self.assertEqual((report['installationStatus'], report['integrity'], report['total']),
                         ('not-installed', 'not-installed', 0))
        outer = missing / '.SYSTEMX'
        write_files(outer, {'GLOBAL/CONTEXT.md': b'private', 'custom.txt': b'private'})
        with patch.object(MANAGER, 'regular_bytes', side_effect=AssertionError('unmanaged content read')):
            report = provenance.collect_inventory(missing)
        self.assertEqual((report['installationStatus'], report['integrity'], report['contentComparison']),
                         ('unmanaged', 'unmanaged', 'unavailable'))
        self.assertIsNone(report['selectedVersion'])
        self.assertIsNone(report['pinnedVersion'])
        self.assertEqual(report['retainedVersions'], [])
        entries = {entry['path']: entry for entry in report['entries']}
        self.assertEqual(entries['GLOBAL/CONTEXT.md']['ownership'], 'host')
        self.assertEqual(entries['GLOBAL/CONTEXT.md']['contentRelation'], 'unavailable-unmanaged')
        self.assertEqual(entries['custom.txt']['ownership'], 'undetermined')

    def test_invalid_installation_is_sanitized_and_preserved(self):
        (self.outer / 'INSTALLATION.json').write_bytes(b'{"secret":"/private/local/location"}')
        before = tree_bytes(self.root)
        with self.assertRaises(provenance.ProvenanceError) as caught:
            provenance.collect_inventory(self.root)
        self.assertEqual(caught.exception.code, 'invalid-installation')
        self.assertNotIn('/private/local/location', str(caught.exception))
        self.assertNotIn(str(self.root), str(caught.exception))
        self.assertEqual(tree_bytes(self.root), before)

    @unittest.skipUnless(hasattr(os, 'symlink'), 'requires symbolic link support')
    def test_symlinked_outer_file_parent_metadata_and_snapshot_are_refused(self):
        outside = self.root / 'external'
        outside.mkdir()
        (outside / 'private.txt').write_bytes(b'SECRET')
        for name, directory in (('unknown-link', False), ('host-parent', True),
                                ('imports', True), ('.systemx/releases/' + V2, True)):
            path = self.outer / name
            path.symlink_to(outside if directory else outside / 'private.txt', target_is_directory=directory)
            before = tree_bytes(self.root)
            with self.subTest(name=name), self.assertRaises(provenance.ProvenanceError):
                provenance.collect_inventory(self.root)
            self.assertEqual(tree_bytes(self.root), before)
            path.unlink()
        metadata = self.outer / 'INSTALLATION.json'
        original = metadata.read_bytes()
        metadata.unlink()
        metadata.symlink_to(outside / 'private.txt')
        before = tree_bytes(self.root)
        with self.assertRaises(provenance.ProvenanceError):
            provenance.collect_inventory(self.root)
        self.assertEqual(tree_bytes(self.root), before)
        metadata.unlink()
        metadata.write_bytes(original)

    @unittest.skipUnless(hasattr(os, 'mkfifo'), 'requires FIFO support')
    def test_special_file_is_refused_without_opening_or_changing_it(self):
        os.mkfifo(self.outer / 'unrecognized-pipe')
        before = tree_bytes(self.root)
        with self.assertRaisesRegex(provenance.ProvenanceError, 'nonregular'):
            provenance.collect_inventory(self.root)
        self.assertEqual(tree_bytes(self.root), before)

    def test_caps_fail_instead_of_claiming_complete_verified_inventory(self):
        before = tree_bytes(self.root)
        for constant, value, code in (('MAX_ENTRIES', 3, 'entry-limit'),
                                      ('MAX_TOTAL_BYTES', 20, 'byte-limit'),
                                      ('MAX_DEPTH', 1, 'depth-limit'),
                                      ('MAX_RELEASES', 0, 'release-limit')):
            with self.subTest(constant=constant), patch.object(provenance, constant, value):
                with self.assertRaises(provenance.ProvenanceError) as caught:
                    provenance.collect_inventory(self.root)
                self.assertEqual(caught.exception.code, code)
                self.assertEqual(tree_bytes(self.root), before)

    def test_structural_cap_precedes_managers_complete_snapshot_walk(self):
        before = tree_bytes(self.root)
        with patch.object(provenance, 'MAX_ENTRIES', 3), patch.object(
                MANAGER, 'snapshot_issues', side_effect=AssertionError('unbounded walk called first')):
            with self.assertRaises(provenance.ProvenanceError) as caught:
                provenance.collect_inventory(self.root)
        self.assertEqual(caught.exception.code, 'entry-limit')
        self.assertEqual(tree_bytes(self.root), before)

    def test_unregistered_snapshot_is_refused(self):
        write_files(self.outer / '.systemx/releases/unregistered', {'README.md': b'unknown'})
        before = tree_bytes(self.root)
        with self.assertRaisesRegex(provenance.ProvenanceError, 'absent from installation'):
            provenance.collect_inventory(self.root)
        self.assertEqual(tree_bytes(self.root), before)

    def test_cli_json_text_and_failure_are_portable_and_read_only(self):
        before = tree_bytes(self.root)
        command = [sys.executable, '-B', str(ROOT / 'scripts/systemx-provenance.py'), '--target', str(self.root)]
        result = subprocess.run([*command, '--path', 'GLOBAL/CONTEXT.md'], capture_output=True, text=True, check=True)
        report = json.loads(result.stdout)
        self.assertTrue(report['valid'])
        self.assertEqual(report['returned'], 1)
        text = subprocess.run([*command, '--format', 'text', '--limit', '2'], capture_output=True, text=True, check=True).stdout
        self.assertIn('SYSTEMX provenance schema 1 / policy 1', text)
        self.assertIn('Continuation (--after):', text)
        self.assertNotIn(str(self.root), text + result.stdout)
        failed = subprocess.run([*command, '--path', '../private'], capture_output=True, text=True)
        self.assertEqual(failed.returncode, 1)
        error = json.loads(failed.stdout)
        self.assertFalse(error['valid'])
        self.assertEqual(error['integrity'], 'unverified')
        self.assertEqual(error['entries'], [])
        self.assertEqual(error['diagnostics'][0]['code'], 'invalid-path')
        self.assertNotIn(str(self.root), failed.stdout + failed.stderr)
        self.assertEqual(tree_bytes(self.root), before)


if __name__ == '__main__':
    unittest.main()
