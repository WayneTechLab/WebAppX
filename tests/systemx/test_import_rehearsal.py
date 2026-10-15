"""Actual importer applies and fingerprint failures in owned temporary fixtures."""
import importlib.util
from contextlib import redirect_stdout
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('import_rehearsal_subject', ROOT / 'scripts/systemx-import-rehearsal.py')
rehearsal = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(rehearsal)
MANAGER = rehearsal.provenance._manager()


class ImportRehearsal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        state = MANAGER.load_state(ROOT)
        cls.incoming = state['activeVersion']
        older = [v for v in state['releases'] if MANAGER.version_key(MANAGER.ISOLATED_RUNNER_FLOOR)
                 <= MANAGER.version_key(v) < MANAGER.version_key(cls.incoming)]
        if not older:
            raise AssertionError('The reviewed rehearsal baseline requires an intact older supported release')
        cls.baseline = max(older, key=MANAGER.version_key)
        cls.bundles = {v: rehearsal._public_bundle(ROOT, state, v, MANAGER)
                       for v in (cls.baseline, cls.incoming)}

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.source = Path(self.temporary.name).resolve() / 'public-source-fixture'
        outer = self.source / '.SYSTEMX'
        for version, bundle in self.bundles.items():
            for name, data in bundle['files'].items():
                path = outer / '.systemx/releases' / version / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
        self.state = {'schemaVersion': 2, 'profile': 'project', 'repository': 'WayneTechLab/dotSYSTEMX',
                      'activeVersion': self.incoming, 'pinnedVersion': self.incoming, 'autoUpdate': 'manual',
                      'installedAt': rehearsal.STAMP, 'updatedAt': rehearsal.STAMP,
                      'releases': {v: bundle['manifestSha256'] for v, bundle in self.bundles.items()},
                      'archiveDigests': {v: None for v in self.bundles}}
        (outer / 'INSTALLATION.json').write_bytes(rehearsal.encoded(self.state))
        self.patch_root = patch.object(rehearsal, 'SOURCE_ROOT', self.source)
        self.patch_root.start()
        self.addCleanup(self.patch_root.stop)

    def public_bytes(self):
        outer = self.source / '.SYSTEMX'
        result = {'INSTALLATION.json': (outer / 'INSTALLATION.json').read_bytes()}
        for version, bundle in self.bundles.items():
            for name in bundle['files']:
                path = '.systemx/releases/' + version + '/' + name
                result[path] = (outer / path).read_bytes()
        return result

    def test_actual_two_apply_upgrade_preserves_nontrivial_host_paths_and_immutable_receipts(self):
        before = self.public_bytes()
        original = rehearsal._apply
        applies = []
        def actual_apply(workspace, commit):
            result = original(workspace, commit)
            self.assertTrue((workspace.target / '.SYSTEMX/imports' / (result['version'] + '.json')).is_file())
            applies.append((workspace.root, commit, result))
            return result
        with patch.object(rehearsal, '_apply', side_effect=actual_apply):
            report = rehearsal.run_rehearsal()
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(len(applies), 2)
        self.assertEqual([item[2]['version'] for item in applies], [self.baseline, self.incoming])
        self.assertTrue(all(not root.exists() for root, _, _ in applies))
        self.assertTrue(all(report['checks'].values()))
        self.assertEqual(report['fixture']['hostPathCount'], 20)
        self.assertEqual(report['fictionalHostFingerprints']['returned'], 20)
        self.assertFalse(report['fictionalHostFingerprints']['truncated'])
        self.assertIn('project-record', {row['role'] for row in report['fictionalHostFingerprints']['items']})
        self.assertIn('host-extension', {row['role'] for row in report['fictionalHostFingerprints']['items']})
        self.assertTrue(all(row['beforeSha256'] == row['afterSha256'] for row in report['fictionalHostFingerprints']['items']))
        self.assertEqual(report['source']['transition'], 'retained-release-upgrade')
        self.assertEqual(report['source']['publicMain'], {'state': 'not-queried-fixture-observation', 'commit': None})
        self.assertEqual(report['blocking']['total'], 0)
        self.assertEqual(report['counts']['missing'], 0)
        self.assertGreater(report['counts']['added'], 0)
        self.assertEqual(report['cleanup'], 'owned-temporary-workspace-removed')
        self.assertEqual([r['fixtureCommit'] for r in report['receipts']],
                         [report['fixture']['baselineCommit'], report['fixture']['incomingCommit']])
        self.assertEqual(self.public_bytes(), before)
        text = json.dumps(report)
        for value in rehearsal.FIXTURE_FILES.values():
            self.assertNotIn(value.decode().strip(), text)
        self.assertNotIn(str(self.source), text)
        self.assertNotIn(rehearsal.STAMP, text)
        self.assertNotIn('importedAt', text)
        self.assertNotIn('bootstrapBackup', text)

    def test_actual_apply_host_corruption_is_detected_even_beyond_output_offset(self):
        original = rehearsal._apply
        calls = 0
        observed_roots = []
        def corrupt_after_apply(workspace, commit):
            nonlocal calls
            result = original(workspace, commit)
            calls += 1
            observed_roots.append(workspace.root)
            if calls == 2:
                (workspace.target / '.SYSTEMX/LAN/rehearsal-notes.md').write_bytes(b'INTENTIONAL CORRUPTION\n')
            return result
        with patch.object(rehearsal, '_apply', side_effect=corrupt_after_apply):
            report = rehearsal.run_rehearsal(limit=1, offset=100000)
        self.assertEqual(calls, 2)
        self.assertEqual(report['status'], 'failed')
        self.assertFalse(report['checks']['fictionalHostPathsPreserved'])
        self.assertTrue(report['blocking']['blocked'])
        self.assertEqual(report['blocking']['fingerprintConflicts']['total'], 1)
        self.assertEqual(report['blocking']['fingerprintConflicts']['returned'], 0)
        self.assertTrue(all(not root.exists() for root in observed_roots))
        self.assertNotIn('INTENTIONAL CORRUPTION', json.dumps(report))

    def test_comparison_has_independent_literal_fingerprint_entries(self):
        a, b = 'a' * 64, 'b' * 64
        result = rehearsal.compare_fingerprints({'GLOBAL/CONTEXT.md': a, 'LAN/removed.md': a},
                                                {'GLOBAL/CONTEXT.md': a, 'KIT/added.md': b}, expected_added={'KIT/added.md'})
        self.assertEqual(result['groups']['preserved']['items'], [{
            'path': 'GLOBAL/CONTEXT.md', 'ownership': 'host', 'role': 'project-record',
            'updatePolicy': 'preserve-host-record', 'beforeSha256': a, 'afterSha256': a, 'expected': True}])
        self.assertEqual(result['counts'], {'preserved': 1, 'changed': 0, 'missing': 1, 'added': 1})
        self.assertEqual(result['blocking']['items'], [{'path': 'LAN/removed.md', 'code': 'unexpected-missing'}])
        self.assertEqual(result['blocking']['total'], 1)

    def test_expected_bootstrap_change_cannot_hide_after_apply_corruption(self):
        original = rehearsal._apply
        calls = 0
        def corrupt(workspace, commit):
            nonlocal calls
            result = original(workspace, commit)
            calls += 1
            if calls == 2:
                (workspace.target / '.SYSTEMX/SYSTEMX.sh').write_bytes(b'# corrupted bootstrap\n')
            return result
        with patch.object(rehearsal, '_apply', side_effect=corrupt):
            report = rehearsal.run_rehearsal(limit=1, offset=100000)
        self.assertEqual(report['status'], 'failed')
        self.assertFalse(report['checks']['bootstrapBytesMatchIncoming'])
        self.assertTrue(report['blocking']['blocked'])

    def test_added_receipt_must_match_actual_fixture_commit_and_manifest(self):
        original = rehearsal._apply
        calls = 0
        def corrupt(workspace, commit):
            nonlocal calls
            result = original(workspace, commit)
            calls += 1
            if calls == 2:
                path = workspace.target / '.SYSTEMX/imports' / (self.incoming + '.json')
                receipt = json.loads(path.read_bytes())
                receipt['commit'] = '0' * 40
                path.write_bytes(rehearsal.encoded(receipt))
            return result
        with patch.object(rehearsal, '_apply', side_effect=corrupt):
            report = rehearsal.run_rehearsal()
        self.assertEqual(report['status'], 'failed')
        self.assertFalse(report['checks']['fixtureReceiptsBoundToCommitsAndManifests'])

    def test_comparison_pages_keep_complete_counts_and_hidden_changed_missing_added_blockers(self):
        a, b = 'a' * 64, 'b' * 64
        before = {'LAN/' + str(n) + '.md': a for n in range(5)}
        after = {'LAN/' + str(n) + '.md': b for n in range(4)}
        after['KIT/new.md'] = a
        report = rehearsal.compare_fingerprints(before, after, limit=1, offset=1)
        self.assertEqual(report['counts'], {'preserved': 0, 'changed': 4, 'missing': 1, 'added': 1})
        self.assertEqual(report['blocking']['total'], 6)
        self.assertEqual(report['blocking']['returned'], 1)
        self.assertTrue(report['blocking']['truncated'])
        self.assertEqual(report['blocking']['nextOffset'], 2)
        self.assertEqual(report['groups']['changed']['total'], 4)

    def test_same_version_fallback_is_explicit_and_preserves_first_receipt(self):
        self.state['releases'].pop(self.baseline)
        self.state['archiveDigests'].pop(self.baseline)
        (self.source / '.SYSTEMX/INSTALLATION.json').write_bytes(rehearsal.encoded(self.state))
        report = rehearsal.run_rehearsal(limit=1)
        self.assertEqual(report['status'], 'passed')
        self.assertEqual(report['source']['transition'], 'same-version-reimport')
        self.assertEqual(report['source']['baselineVersion'], self.incoming)
        self.assertEqual(report['counts']['added'], 0)
        self.assertTrue(report['checks']['firstReceiptPreserved'])
        self.assertEqual(report['receipts'][0]['fixtureCommit'], report['fixture']['baselineCommit'])

    def test_valid_crlf_public_snapshots_keep_exact_bytes_through_fixture_git_archive(self):
        for version, bundle in self.bundles.items():
            snapshot = self.source / '.SYSTEMX/.systemx/releases' / version
            for name in bundle['files']:
                if name in MANAGER.DISTRIBUTION_TEXT_NAMES or Path(name).suffix in MANAGER.DISTRIBUTION_TEXT_SUFFIXES:
                    path = snapshot / name
                    path.write_bytes(path.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))
        before = self.public_bytes()
        report = rehearsal.run_rehearsal(limit=1)
        self.assertEqual(report['status'], 'passed')
        self.assertTrue(report['checks']['fixtureImmutableReleasesExact'])
        self.assertEqual(self.public_bytes(), before)

    def test_nonobject_receipt_payloads_have_fixed_failure_diagnostics(self):
        with rehearsal._Workspace() as workspace:
            path = workspace.target / '.SYSTEMX/imports' / (self.incoming + '.json')
            path.parent.mkdir(parents=True)
            for value in ([], 4, None, 'PRIVATE-RECEIPT-PAYLOAD'):
                path.write_bytes(rehearsal.encoded(value))
                with self.subTest(value=value), self.assertRaisesRegex(rehearsal.RehearsalError, 'fixture-receipt-invalid') as caught:
                    rehearsal._receipt(workspace, self.incoming, MANAGER)
                self.assertNotIn(str(workspace.root), str(caught.exception))
                self.assertNotIn('PRIVATE-RECEIPT-PAYLOAD', str(caught.exception))

    def test_live_outer_private_and_runtime_files_are_never_opened(self):
        outer = self.source / '.SYSTEMX'
        for name in ('GLOBAL/CONTEXT.md', 'project.json', 'LAN/private.txt',
                     '.systemx/history/private.json', 'local/private.json', 'secrets.env'):
            path = outer / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'PRIVATE-SENTINEL-NOT-TO-READ')
        allowed = {outer / 'INSTALLATION.json'} | {
            outer / '.systemx/releases' / version / name
            for version, bundle in self.bundles.items() for name in bundle['files']}
        original = MANAGER.regular_bytes
        reads = []
        def observe(path, *args, **kwargs):
            resolved = path.resolve()
            if resolved.is_relative_to(outer):
                self.assertIn(resolved, allowed)
            reads.append(resolved)
            return original(path, *args, **kwargs)
        before = self.public_bytes()
        with patch.object(MANAGER, 'regular_bytes', side_effect=observe):
            report = rehearsal.run_rehearsal(limit=1)
        self.assertEqual(report['status'], 'passed')
        self.assertFalse(report['privacy']['liveOuterRecordsRead'])
        self.assertFalse(report['privacy']['runtimePayloadsRead'])
        self.assertNotIn('PRIVATE-SENTINEL-NOT-TO-READ', json.dumps(report))
        self.assertEqual(self.public_bytes(), before)
        self.assertTrue(reads)

    def test_no_unknown_or_excluded_path_can_be_added_to_fixture_hash_selection(self):
        with rehearsal._Workspace() as workspace:
            workspace.allowed_paths = frozenset({'GLOBAL/CONTEXT.md'})
            with self.assertRaisesRegex(rehearsal.RehearsalError, 'unreviewed-fingerprint-path'):
                rehearsal._capture(workspace, {'LAN/arbitrary.txt'}, MANAGER)
            workspace.allowed_paths = frozenset({'local/private.json'})
            with self.assertRaisesRegex(rehearsal.RehearsalError, 'excluded-fingerprint-path'):
                rehearsal._capture(workspace, {'local/private.json'}, MANAGER)

    @unittest.skipUnless(hasattr(os, 'symlink'), 'requires symlink support')
    def test_linked_fixture_host_file_and_linked_public_snapshot_are_refused(self):
        with rehearsal._Workspace() as workspace:
            outer = workspace.target / '.SYSTEMX'
            outer.mkdir()
            external = workspace.root / 'external.md'
            external.write_bytes(b'not selected')
            (outer / 'GLOBAL').symlink_to(workspace.root, target_is_directory=True)
            workspace.allowed_paths = frozenset({'GLOBAL/external.md'})
            with self.assertRaises(rehearsal.RehearsalError):
                rehearsal._capture(workspace, {'GLOBAL/external.md'}, MANAGER)
        path = self.source / '.SYSTEMX/.systemx/releases' / self.incoming / 'STANDARD.md'
        path.unlink()
        path.symlink_to(self.source / '.SYSTEMX/INSTALLATION.json')
        with self.assertRaisesRegex(rehearsal.RehearsalError, 'public-snapshot-invalid'):
            rehearsal.run_rehearsal()

    def test_source_mutation_refused_before_temp_fixture_or_git_is_created(self):
        path = self.source / '.SYSTEMX/.systemx/releases' / self.incoming / 'STANDARD.md'
        path.write_bytes(path.read_bytes() + b'unreviewed modification\n')
        with patch.object(rehearsal, '_Workspace', side_effect=AssertionError('fixture started before validation')):
            with self.assertRaisesRegex(rehearsal.RehearsalError, 'public-snapshot-invalid'):
                rehearsal.run_rehearsal()

    def test_invalid_pagination_and_fingerprint_inputs_refused(self):
        for kwargs in ({'limit': 0}, {'limit': 101}, {'limit': True}, {'offset': -1}, {'offset': 100001}):
            with self.subTest(kwargs=kwargs), self.assertRaisesRegex(rehearsal.RehearsalError, 'invalid-pagination'):
                rehearsal.run_rehearsal(**kwargs)
        for before in ({'../private': 'a' * 64}, {'GLOBAL/CONTEXT.md': None}, {'GLOBAL/CONTEXT.md': 'not-a-digest'}):
            with self.subTest(before=before), self.assertRaises(ValueError):
                rehearsal.compare_fingerprints(before, {})

    def test_fixture_and_public_bounds_refuse_without_success(self):
        with patch.object(rehearsal, 'MAX_FILES', 2):
            with self.assertRaisesRegex(rehearsal.RehearsalError, 'public-snapshot-invalid'):
                rehearsal.run_rehearsal()
        with patch.object(rehearsal, 'MAX_BYTES', 2):
            with self.assertRaisesRegex(rehearsal.RehearsalError, 'public-snapshot-invalid'):
                rehearsal.run_rehearsal()

    def test_inherited_git_hooks_signing_templates_and_transport_overrides_are_isolated(self):
        poison = self.source.parent / 'poison-hook'
        poison.write_text('must not execute')
        with patch.dict(os.environ, {'GIT_DIR': str(self.source.parent / 'wrong'),
                                     'GIT_CONFIG_GLOBAL': str(poison), 'GIT_TEMPLATE_DIR': str(poison),
                                     'GIT_CONFIG_COUNT': '1', 'GIT_CONFIG_KEY_0': 'core.hooksPath',
                                     'GIT_CONFIG_VALUE_0': str(poison), 'TAR_OPTIONS': '--invalid-option'}):
            report = rehearsal.run_rehearsal(limit=1)
        self.assertEqual(report['status'], 'passed')
        environment = rehearsal._environment()
        self.assertNotIn('GIT_DIR', environment)
        self.assertNotIn('GIT_TEMPLATE_DIR', environment)
        self.assertNotIn('TAR_OPTIONS', environment)
        self.assertEqual(environment['GIT_CONFIG_GLOBAL'], os.devnull)

    def test_apply_failure_cleans_owned_fixture(self):
        original = rehearsal._apply
        owned = []
        def fail_second(workspace, commit):
            owned.append(workspace.root)
            if len(owned) == 2:
                raise rehearsal.RehearsalError('actual-fixture-import-failed', 'fixture-apply')
            return original(workspace, commit)
        with patch.object(rehearsal, '_apply', side_effect=fail_second):
            with self.assertRaisesRegex(rehearsal.RehearsalError, 'actual-fixture-import-failed'):
                rehearsal.run_rehearsal()
        self.assertTrue(all(not root.exists() for root in owned))

    @unittest.skipIf(os.name == 'nt', 'POSIX descendant teardown proof; native Windows remains a separate runtime boundary')
    def test_real_worker_timeout_kills_owned_descendant_and_removes_owned_extraction_tree(self):
        code = r'''
import json,subprocess,sys,tempfile,time
from pathlib import Path
temporary=tempfile.mkdtemp(prefix='worker-extraction-')
child=subprocess.Popen([sys.executable,'-I','-B','-c','import time;time.sleep(30)'])
Path(sys.argv[1]).write_text(json.dumps({'pid':child.pid,'temporary':temporary}))
time.sleep(30)
'''
        with rehearsal._Workspace() as workspace:
            root = workspace.root
            observed = workspace.worker_temp / 'observed.json'
            with self.assertRaisesRegex(rehearsal.RehearsalError, 'owned-worker-timeout'):
                rehearsal._run_worker(workspace, code, [str(observed)], timeout=1, output_limit=1024)
            info = json.loads(observed.read_bytes())
            extracted = Path(info['temporary'])
            self.assertTrue(extracted.is_relative_to(workspace.worker_temp))
            process = subprocess.run(['ps', '-o', 'stat=', '-p', str(info['pid'])],
                                     capture_output=True, text=True, timeout=3)
            self.assertTrue(process.returncode != 0 or process.stdout.strip().startswith('Z'),
                            'Owned descendant remained running after worker timeout')
        self.assertFalse(root.exists())
        self.assertFalse(extracted.exists())

    @unittest.skipIf(os.name == 'nt', 'POSIX process-session interruption proof')
    def test_parent_interruption_stops_isolated_worker_tree_before_workspace_cleanup(self):
        code = r'''
import json,subprocess,sys,time
from pathlib import Path
child=subprocess.Popen([sys.executable,'-I','-B','-c','import time;time.sleep(30)'])
Path(sys.argv[1]).write_text(json.dumps({'pid':child.pid}))
time.sleep(30)
'''
        with rehearsal._Workspace() as workspace:
            root = workspace.root
            observed = workspace.worker_temp / 'interrupted-child.json'
            original = subprocess.Popen.communicate
            interrupted = False
            def interrupt_once(child, *args, **kwargs):
                nonlocal interrupted
                if not interrupted:
                    deadline = time.monotonic() + 3
                    while not observed.exists() and time.monotonic() < deadline:
                        time.sleep(0.02)
                    self.assertTrue(observed.exists(), 'Owned worker did not reach the interruption checkpoint')
                    interrupted = True
                    raise KeyboardInterrupt
                return original(child, *args, **kwargs)
            with patch.object(subprocess.Popen, 'communicate', new=interrupt_once):
                with self.assertRaises(KeyboardInterrupt):
                    rehearsal._run_worker(workspace, code, [str(observed)], timeout=10, output_limit=1024)
            info = json.loads(observed.read_bytes())
            process = subprocess.run(['ps', '-o', 'stat=', '-p', str(info['pid'])],
                                     capture_output=True, text=True, timeout=3)
            self.assertTrue(process.returncode != 0 or process.stdout.strip().startswith('Z'))
        self.assertTrue(interrupted)
        self.assertFalse(root.exists())

    def test_cli_interruption_returns_fixed_json_and_conventional_exit_status(self):
        output = io.StringIO()
        with patch.object(rehearsal, 'run_rehearsal', side_effect=KeyboardInterrupt), \
                patch.object(sys, 'argv', ['systemx-import-rehearsal.py']), redirect_stdout(output):
            status = rehearsal.main()
        self.assertEqual(status, 130)
        self.assertEqual(json.loads(output.getvalue())['diagnostics'], [
            {'code': 'rehearsal-interrupted', 'phase': 'fixture-worker'}])

    def test_worker_scope_and_transport_injection_are_narrow_at_runtime(self):
        stub_code = r'''
from pathlib import Path
def git(source,*args):
    raise AssertionError('A forbidden observation reached the original Git function')
def sync(target,source,apply,expected_commit):
    if apply is not True: raise AssertionError('apply was not selected')
    expected=expected_commit+'\trefs/heads/main'
    if git(source,'ls-remote','origin','refs/heads/main')!=expected:
        raise AssertionError('fixture observation mismatch')
    for selected,args in [(source.parent/'foreign',('ls-remote','origin','refs/heads/main')),
                          (source,('fetch','origin')),(source,('ls-remote','other','refs/heads/main'))]:
        try: git(selected,*args)
        except ValueError: pass
        else: raise AssertionError('Unexpected source or transport was allowed')
    return {'applied':True,'version':'1.0.0','commit':expected_commit,'manifestSha256':'a'*64}
'''
        with rehearsal._Workspace() as workspace:
            stub = workspace.root / 'stub_importer.py'
            stub.write_text(stub_code)
            result = subprocess.run([sys.executable, '-I', '-B', '-c', rehearsal._IMPORT_WORKER,
                                     str(stub), str(workspace.source), str(workspace.target), '1' * 40],
                                    env=rehearsal._environment(), timeout=10, capture_output=True, text=True, check=True)
        self.assertTrue(json.loads(result.stdout)['applied'])

    def test_cli_has_no_live_target_operand_and_emits_sanitized_failures(self):
        command = [sys.executable, '-B', str(ROOT / 'scripts/systemx-import-rehearsal.py')]
        result = subprocess.run([*command, '--limit', '0'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        failure = json.loads(result.stdout)
        self.assertEqual(failure['status'], 'failed')
        self.assertEqual(failure['diagnostics'], [{'code': 'invalid-pagination', 'phase': 'arguments'}])
        self.assertNotIn(str(ROOT), result.stdout + result.stderr)
        help_text = subprocess.run([*command, '--help'], capture_output=True, text=True, check=True).stdout
        self.assertNotIn('--target', help_text)
        self.assertNotIn('--source', help_text)


if __name__ == '__main__':
    unittest.main()
