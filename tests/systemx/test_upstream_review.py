"""Bounded import reviews use real temporary distributions, never a live source."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('wtl_upstream_review_tests', ROOT / 'scripts/sync-systemx.py')
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


def files(root):
    return {path.relative_to(root).as_posix(): path.read_bytes()
            for path in root.rglob('*') if path.is_file() and not path.is_symlink()}


class UpstreamReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.TemporaryDirectory(prefix='webappx-review-source-')
        cls.source = Path(cls.scratch.name) / 'source'
        cls.source.mkdir()
        cls.version = json.loads((ROOT / '.SYSTEMX/INSTALLATION.json').read_text())['activeVersion']
        shutil.copytree(ROOT / '.SYSTEMX/.systemx/releases' / cls.version, cls.source / '.SYSTEMX')
        for args in (['init', '-q'], ['config', 'user.name', 'Review Fixture'],
                     ['config', 'user.email', 'review@example.invalid'],
                     ['remote', 'add', 'origin', importer.UPSTREAM],
                     ['add', '.SYSTEMX'], ['commit', '-qm', 'Exact source fixture']):
            subprocess.run(['git', '-C', str(cls.source), *args], check=True)
        cls.commit = importer.git(cls.source, 'rev-parse', 'HEAD')

    @classmethod
    def tearDownClass(cls):
        cls.scratch.cleanup()

    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix='webappx-review-target-')
        self.addCleanup(self.scratch.cleanup)
        self.target = Path(self.scratch.name)
        original_git = importer.git

        def fixture_git(source, *args):
            if args == ('ls-remote', 'origin', 'refs/heads/main'):
                return self.commit + '\trefs/heads/main'
            return original_git(source, *args)

        self.git_patch = patch.object(importer, 'git', side_effect=fixture_git)
        self.git_patch.start()
        self.addCleanup(self.git_patch.stop)

    def install(self):
        importer.sync(self.target, self.source, True)
        return self.target / '.SYSTEMX'

    def test_initial_preview_binds_source_and_pages_complete_additions_without_writes(self):
        source_index = (self.source / '.git/index').read_bytes()
        result = importer.upstream_review(self.target, self.source, self.commit, limit=2)
        self.assertEqual(result['kind'], 'webappx-systemx-upstream-review')
        self.assertEqual(result['status'], 'ready')
        self.assertFalse(result['applied'])
        self.assertEqual(result['selection'], {'currentVersion': None, 'pinnedVersion': None,
                                               'incomingVersion': self.version})
        self.assertEqual(result['source']['commit'], self.commit)
        self.assertEqual(result['source']['publicMain'], self.commit)
        self.assertEqual(result['source']['liveVerification'], 'verified-current-public-main')
        manifest = (self.source / '.SYSTEMX/config/distribution.json').read_bytes()
        self.assertEqual(result['source']['manifestSha256'], hashlib.sha256(manifest.replace(b'\r\n', b'\n')).hexdigest())
        self.assertEqual(result['outer']['add']['returned'], 2)
        self.assertGreater(result['outer']['add']['total'], 2)
        self.assertEqual(result['outer']['add']['nextOffset'], 2)
        self.assertTrue(result['outer']['add']['truncated'])
        self.assertEqual(result['bootstrap']['state'], 'not-applicable')
        self.assertEqual(result['blocking'], {'blocked': False, 'total': 0})
        self.assertEqual(list(self.target.iterdir()), [])
        self.assertEqual((self.source / '.git/index').read_bytes(), source_index)
        self.assertNotIn(str(self.source), json.dumps(result))
        self.assertNotIn(str(self.target), json.dumps(result))

    def test_host_only_preservation_is_separate_from_incoming_overlap(self):
        outer = self.install()
        (outer / 'LAN').mkdir()
        (outer / 'LAN/host-only.txt').write_text('A host extension, not an incoming default\n')
        before = files(self.target)
        result = importer.upstream_review(self.target, self.source, limit=100)
        self.assertEqual(result['status'], 'ready')
        host = result['outer']['preserveHostOwned']
        all_host = []
        offset = 0
        while True:
            page = importer.upstream_review(self.target, self.source, limit=100, offset=offset)['outer']['preserveHostOwned']
            all_host.extend(page['items'])
            if page['nextOffset'] is None:
                break
            offset = page['nextOffset']
        self.assertIn('LAN/host-only.txt', all_host)
        self.assertIn('WORK/TASKS.json', all_host)
        self.assertNotIn('LAN/host-only.txt', result['outer']['preserveOverlap']['items'])
        self.assertGreaterEqual(host['total'], len(host['items']))
        self.assertEqual(result['selection']['pinnedVersion'], self.version)
        self.assertEqual(result['receipt'], {'state': 'verified', 'originalCommit': self.commit,
                                           'identicalSourceTree': True, 'proof': 'same-commit',
                                           'firstReceiptPreserved': True})
        self.assertEqual(files(self.target), before)

    def test_hidden_bootstrap_conflicts_still_block_and_all_pages_are_inspectable(self):
        outer = self.install()
        for name in ('SYSTEMX.sh', 'SYSTEMX.ps1', 'INSTALL.sh'):
            path = outer / name
            path.write_bytes(path.read_bytes() + b'\n# adopted customization\n')
        before = files(self.target)
        result = importer.upstream_review(self.target, self.source, limit=1)
        self.assertEqual(result['status'], 'blocked')
        self.assertEqual(result['bootstrap']['conflicts']['total'], 3)
        self.assertEqual(result['bootstrap']['conflicts']['returned'], 1)
        self.assertTrue(result['bootstrap']['conflicts']['truncated'])
        self.assertEqual(result['blocking'], {'blocked': True, 'total': 3})
        last = importer.upstream_review(self.target, self.source, limit=1, offset=2)
        self.assertEqual(last['bootstrap']['conflicts']['returned'], 1)
        self.assertIsNone(last['bootstrap']['conflicts']['nextOffset'])
        self.assertTrue(last['blocking']['blocked'])
        hidden = importer.upstream_review(self.target, self.source, limit=1, offset=500)
        self.assertEqual(hidden['bootstrap']['conflicts']['items'], [])
        self.assertEqual(hidden['blocking']['total'], 3)
        self.assertEqual(files(self.target), before)
        with self.assertRaisesRegex(ValueError, 'Customized|unrecognized bootstrap'):
            importer.sync(self.target, self.source, True)

    def test_initial_executable_conflict_is_structured_without_installing(self):
        outer = self.target / '.SYSTEMX'
        outer.mkdir()
        (outer / 'SYSTEMX.sh').write_text('# retained adopted executable\n')
        before = files(self.target)
        result = importer.upstream_review(self.target, self.source)
        self.assertEqual(result['status'], 'blocked')
        self.assertEqual(result['outer']['conflicts']['total'], 1)
        self.assertIn('Existing executable default differs', result['outer']['conflicts']['items'][0])
        self.assertEqual(files(self.target), before)

    def test_receipt_conflict_remains_blocking_without_rewriting_provenance(self):
        outer = self.install()
        receipt = outer / 'imports' / (self.version + '.json')
        data = json.loads(receipt.read_text())
        data['manifestSha256'] = '0' * 64
        receipt.write_text(json.dumps(data))
        before = files(self.target)
        result = importer.upstream_review(self.target, self.source)
        self.assertEqual(result['status'], 'blocked')
        self.assertEqual(result['receipt']['state'], 'conflict')
        self.assertIn('existing-import-receipt-provenance-conflict', result['diagnostics']['items'])
        self.assertEqual(files(self.target), before)

    def test_later_docs_commit_retains_first_receipt_and_proves_complete_tree_equality(self):
        outer = self.install()
        receipt = outer / 'imports' / (self.version + '.json')
        first = receipt.read_bytes()
        original_commit = self.commit
        with tempfile.TemporaryDirectory(prefix='webappx-review-later-') as scratch:
            source = Path(scratch) / 'later-source'
            subprocess.run(['git', 'clone', '-q', '--no-hardlinks', str(self.source), str(source)], check=True)
            for args in (['remote', 'set-url', 'origin', importer.UPSTREAM],
                         ['config', 'user.name', 'Later Fixture'],
                         ['config', 'user.email', 'later@example.invalid']):
                subprocess.run(['git', '-C', str(source), *args], check=True)
            (source / 'README.md').write_text('Only public documentation changed\n')
            subprocess.run(['git', '-C', str(source), 'add', 'README.md'], check=True)
            subprocess.run(['git', '-C', str(source), 'commit', '-qm', 'Docs only'], check=True)
            self.commit = importer.git(source, 'rev-parse', 'HEAD')
            result = importer.upstream_review(self.target, source, self.commit)
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(result['source']['commit'], self.commit)
        self.assertNotEqual(self.commit, original_commit)
        self.assertEqual(result['receipt'], {'state': 'verified', 'originalCommit': original_commit,
                                           'identicalSourceTree': True, 'proof': 'identical-source-tree',
                                           'firstReceiptPreserved': True})
        self.assertEqual(receipt.read_bytes(), first)

    def test_invalid_source_observations_never_claim_current_public_main(self):
        for response in ('', 'not-an-oid\trefs/heads/main', '0' * 40 + '\trefs/heads/main'):
            original = importer.git

            def altered(source, *args):
                return response if args == ('ls-remote', 'origin', 'refs/heads/main') else original(source, *args)

            with self.subTest(response=response), patch.object(importer, 'git', side_effect=altered):
                result = importer.upstream_review(self.target, self.source)
            self.assertEqual(result['status'], 'invalid')
            self.assertEqual(result['source']['liveVerification'], 'unverified')
            self.assertTrue(result['blocking']['blocked'])
            self.assertEqual(list(self.target.iterdir()), [])

    def test_expected_revision_mismatch_has_known_observation_but_no_verified_selection(self):
        result = importer.upstream_review(self.target, self.source, '0' * 40)
        self.assertEqual(result['status'], 'invalid')
        self.assertEqual(result['source']['publicMain'], self.commit)
        self.assertEqual(result['source']['liveVerification'], 'unverified')
        self.assertIsNone(result['selection']['incomingVersion'])

    def test_archive_uses_the_same_captured_repository_without_inherited_git_overrides(self):
        with patch.dict(os.environ, {'GIT_DIR': str(self.target / 'wrong-git-directory'),
                                    'GIT_WORK_TREE': str(self.target / 'wrong-tree'),
                                    'GIT_CONFIG_COUNT': '1', 'GIT_CONFIG_KEY_0': 'protocol.allow',
                                    'GIT_CONFIG_VALUE_0': 'never'}):
            result = importer.upstream_review(self.target, self.source, self.commit)
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(result['source']['commit'], self.commit)
        self.assertEqual(list(self.target.iterdir()), [])

    def test_safe_path_failure_is_redacted_and_unknown_facts_stay_null(self):
        outer = self.install()
        (outer / 'imports' / (self.version + '.json')).unlink()
        external = self.target / 'private-receipt.json'
        external.write_text('REDACTION-FIXTURE-NOT-FOR-OUTPUT')
        (outer / 'imports' / (self.version + '.json')).symlink_to(external)
        result = importer.upstream_review(self.target, self.source)
        serialized = json.dumps(result)
        self.assertEqual(result['status'], 'invalid')
        self.assertNotIn(str(self.target), serialized)
        self.assertNotIn('REDACTION-FIXTURE-NOT-FOR-OUTPUT', serialized)
        self.assertEqual(result['receipt']['state'], 'unverified')
        self.assertEqual(external.read_text(), 'REDACTION-FIXTURE-NOT-FOR-OUTPUT')

    def test_pagination_and_revision_validation_fail_before_any_git_observation(self):
        with patch.object(importer, 'git', side_effect=AssertionError('must not probe')):
            for kwargs in ({'limit': 0}, {'limit': 101}, {'limit': True}, {'offset': -1},
                           {'offset': 100001}, {'expected_commit': 'HEAD'}):
                with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                    importer.upstream_review(self.target, self.source, **kwargs)

    def test_cli_invalid_preview_is_bounded_json_with_failure_exit_and_no_target_write(self):
        missing = self.target / 'nonexistent-source'
        result = subprocess.run([sys.executable, '-B', str(ROOT / 'scripts/sync-systemx.py'),
                                 '--source', str(missing), '--target', str(self.target)],
                                text=True, capture_output=True, timeout=20)
        self.assertEqual(result.returncode, 1)
        report = json.loads(result.stdout)
        self.assertEqual(report['status'], 'invalid')
        self.assertIsNone(report['source']['commit'])
        self.assertNotIn(str(self.target), result.stdout)
        self.assertEqual(result.stderr, '')
        self.assertEqual(list(self.target.iterdir()), [])

    def test_direct_public_query_is_canonical_isolated_and_bounded(self):
        # This tests command construction only; no network request is made.
        self.git_patch.stop()
        with patch.dict(os.environ, {'GIT_DIR': '/unrelated', 'GIT_CONFIG_COUNT': '1'}), \
                patch.object(importer.subprocess, 'check_output', return_value=self.commit + '\trefs/heads/main\n') as probe:
            result = importer.git(self.source, 'ls-remote', 'origin', 'refs/heads/main')
        self.git_patch.start()
        self.assertEqual(result, self.commit + '\trefs/heads/main')
        args, kwargs = probe.call_args
        self.assertEqual(args[0][-3:], ['ls-remote', importer.UPSTREAM, 'refs/heads/main'])
        self.assertNotIn('-C', args[0])
        self.assertIn('--git-dir=' + os.devnull, args[0])
        self.assertIn('credential.helper=', args[0])
        self.assertEqual(kwargs['timeout'], 15)
        self.assertNotIn('GIT_DIR', kwargs['env'])
        self.assertNotIn('GIT_CONFIG_COUNT', kwargs['env'])
        self.assertEqual(kwargs['env']['GIT_CONFIG_GLOBAL'], os.devnull)
        self.assertEqual(kwargs['env']['GIT_CONFIG_NOSYSTEM'], '1')


if __name__ == '__main__':
    unittest.main()
