"""Identity rehearsal against committed fictional repositories, with no installs."""
import copy
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
SPEC = importlib.util.spec_from_file_location('identity_rehearsal', ROOT / 'scripts/adoption-dry-run.py')
subject = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(subject)
IDENTITY = {
    'schemaVersion': 1, 'repository': {'owner': 'Example-Org', 'name': 'sample-app'},
    'packageName': 'sample-app',
    'site': {'title': 'Sample Ω <Lab>', 'description': 'A public "sample" & preview.',
             'openGraphTitle': 'Sample Ω', 'openGraphDescription': 'Public fictional preview.'},
    'project': {'name': 'Sample Ω', 'description': 'A fictional local identity rehearsal.'},
    'projectPlaceholder': 'your-sample-project-id',
}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def snapshot(root):
    result = {}
    for path in root.rglob('*'):
        mode = path.lstat().st_mode
        if stat.S_ISREG(mode):
            result[path.relative_to(root).as_posix()] = (path.read_bytes(), stat.S_IMODE(mode))
        elif stat.S_ISLNK(mode):
            result[path.relative_to(root).as_posix()] = ('link:' + os.readlink(path), stat.S_IMODE(mode))
    return result


class AdoptionDryRun(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='identity rehearsal Ω ')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.source = self.base / 'source spaced ü'
        self.source.mkdir()
        self.git('init', '-q')
        self.git('config', 'user.name', 'Fictional Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.files = {
            'package.json': encoded({'name': 'webappx', 'version': '3.4.0', 'scripts': {'never': 'DO NOT EXECUTE'},
                                     'dependencies': {'fictional': '1.2.3'}}),
            'package-lock.json': encoded({'name': 'webappx', 'lockfileVersion': 3,
                                          'packages': {'': {'name': 'webappx', 'version': '3.4.0'},
                                                       'node_modules/fictional': {'version': '1.2.3'}}}),
            'index.html': b'<!doctype html>\n<html><head><title>WebAppX &amp; Template</title>\n'
                          b'<meta name="description" content="Old description" />\n'
                          b'<meta property="og:title" content="Old OG" />\n'
                          b'<meta property="og:description" content="Old OG description" />\n'
                          b'<meta name="robots" content="index,follow" /></head><body>Keep WebAppX</body></html>\n',
            '.firebaserc': encoded({'projects': {'default': 'your-firebase-project-id'}}),
            '.SYSTEMX/project.json': encoded({'schemaVersion': 1, 'project': {'name': 'WebAppX', 'description': 'Blank template'},
                                               'checks': [{'name': 'fixture', 'command': ['never-run']}],
                                               'commands': {'dev': ['never-run'], 'build': [], 'deploy': []}}),
            '.SYSTEMX/GLOBAL/CONTEXT.md': b'# Blank reusable context\n',
            '.SYSTEMX/PLAN/MASTER-PLAN.md': b'# Blank plan\n',
            '.SYSTEMX/WORK/TASKS.json': b'{"schemaVersion":1,"tasks":[]}\n',
            '.SYSTEMX/MEMORY/PROJECT.md': b'# Blank memory\n',
            '.SYSTEMX/AGENTS/agent.0/MEMORY.md': b'# Blank agent memory\n',
            '.SYSTEMX/.systemx/releases/1.9.0-alpha.6/manifest.json': b'{"immutable":"exact bytes"}\r\n',
            '.SYSTEMX/Research/sample.bin': bytes(range(256)),
            '.SYSTEMX/Research/CHECKSUMS.sha256': b'literal retained checksum\n',
            '.SYSTEMX/Template/starter/package.json': b'{"name":"independent-starter"}\n',
            'integrations/gusto/functions/package.json': b'{"name":"independent-functions"}\n',
            '.env.example': b'PUBLIC_PLACEHOLDER=\n',
            '.gitignore': b'.env.local\nnode_modules/\nprivate-state/\n',
            'scripts/never-run.py': b'raise RuntimeError("A copied script must never run")\n',
            'public/space Ω.txt': b'WebAppX branding intentionally remains for manual review\n',
        }
        for name, data in self.files.items():
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        (self.source / 'scripts/never-run.py').chmod(0o755)
        self.commit()

    def git(self, *args):
        result = subprocess.run(['git', '-C', str(self.source), *args], check=True,
                                capture_output=True, env=subject._environment())
        return result.stdout.decode().strip()

    def commit(self):
        self.git('add', '--all')
        self.git('commit', '-qm', 'Fictional committed fixture')
        self.revision = self.git('rev-parse', 'HEAD')

    def run_rehearsal(self, identity=None):
        return subject.rehearse(self.source, self.revision, copy.deepcopy(identity or IDENTITY))

    def test_actual_substitutions_complete_preservation_and_owned_cleanup_in_unicode_paths(self):
        # The source working tree differs intentionally; only committed bytes belong in the copy.
        (self.source / 'package.json').write_bytes(b'WORKING-ONLY-PRIVATE-SENTINEL\n')
        poison = b'IGNORED-PRIVATE-POISON-DO-NOT-COPY\n'
        for name in ('.env.local', 'node_modules/poison', 'private-state/notes', 'untracked-secret.txt'):
            path = self.source / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(poison)
        before = snapshot(self.source)
        original_apply = subject._apply_fields
        observed = []
        def inspect(stage, identity, entries):
            self.assertEqual(snapshot(stage).keys(), self.files.keys())
            self.assertEqual((stage / 'package.json').read_bytes(), self.files['package.json'])
            fields, replacements = original_apply(stage, identity, entries)
            public = json.loads((stage / 'package.json').read_text())
            self.assertEqual(public, {'name': 'sample-app', 'version': '3.4.0',
                                      'scripts': {'never': 'DO NOT EXECUTE'}, 'dependencies': {'fictional': '1.2.3'}})
            self.assertEqual(json.loads((stage / 'package-lock.json').read_text()), {
                'name': 'sample-app', 'lockfileVersion': 3,
                'packages': {'': {'name': 'sample-app', 'version': '3.4.0'}, 'node_modules/fictional': {'version': '1.2.3'}}})
            self.assertEqual(json.loads((stage / '.SYSTEMX/project.json').read_text()), {
                'schemaVersion': 1, 'project': {'name': 'Sample Ω', 'description': 'A fictional local identity rehearsal.'},
                'checks': [{'name': 'fixture', 'command': ['never-run']}],
                'commands': {'dev': ['never-run'], 'build': [], 'deploy': []}})
            self.assertEqual((stage / 'index.html').read_text(),
                             '<!doctype html>\n<html><head><title>Sample Ω &lt;Lab&gt;</title>\n'
                             '<meta name="description" content="A public &quot;sample&quot; &amp; preview." />\n'
                             '<meta property="og:title" content="Sample Ω" />\n'
                             '<meta property="og:description" content="Public fictional preview." />\n'
                             '<meta name="robots" content="index,follow" /></head><body>Keep WebAppX</body></html>\n')
            self.assertEqual(json.loads((stage / '.firebaserc').read_text()), {'projects': {'default': 'your-sample-project-id'}})
            self.assertEqual(set(replacements), {'package.json', 'package-lock.json', 'index.html',
                                                '.SYSTEMX/project.json', '.firebaserc'})
            for name, data in self.files.items():
                if name not in {'package.json', 'package-lock.json', 'index.html', '.SYSTEMX/project.json', '.firebaserc'}:
                    self.assertEqual((stage / name).read_bytes(), data, name)
            observed.append(stage.parent)
            return fields, replacements
        with patch.object(subject, '_apply_fields', side_effect=inspect):
            report = self.run_rehearsal()
        self.assertEqual(snapshot(self.source), before)
        self.assertTrue(observed and all(not path.exists() for path in observed))
        self.assertFalse(report['appliedToSource'])
        self.assertFalse(report['source']['workingFilesRead'])
        self.assertEqual(report['source']['commit'], self.revision)
        self.assertEqual(report['source']['files'], len(self.files))
        self.assertEqual(report['source']['bytes'], sum(map(len, self.files.values())))
        self.assertEqual({row['path'] for row in report['copy']['changedFiles']}, {
            'package.json', 'package-lock.json', 'index.html', '.SYSTEMX/project.json', '.firebaserc'})
        self.assertEqual(report['fields'], [
            {'path': '.SYSTEMX/project.json', 'field': '/project/description', 'before': 'Blank template',
             'after': 'A fictional local identity rehearsal.'},
            {'path': '.SYSTEMX/project.json', 'field': '/project/name', 'before': 'WebAppX', 'after': 'Sample Ω'},
            {'path': '.firebaserc', 'field': '/projects/default', 'before': 'your-firebase-project-id',
             'after': 'your-sample-project-id'},
            {'path': 'index.html', 'field': 'meta[name=description].content', 'before': 'Old description',
             'after': 'A public "sample" & preview.'},
            {'path': 'index.html', 'field': 'meta[property=og:description].content', 'before': 'Old OG description',
             'after': 'Public fictional preview.'},
            {'path': 'index.html', 'field': 'meta[property=og:title].content', 'before': 'Old OG', 'after': 'Sample Ω'},
            {'path': 'index.html', 'field': 'title', 'before': 'WebAppX & Template', 'after': 'Sample Ω <Lab>'},
            {'path': 'package-lock.json', 'field': '/name', 'before': 'webappx', 'after': 'sample-app'},
            {'path': 'package-lock.json', 'field': '/packages//name', 'before': 'webappx', 'after': 'sample-app'},
            {'path': 'package.json', 'field': '/name', 'before': 'webappx', 'after': 'sample-app'},
        ])
        for row in report['copy']['changedFiles']:
            self.assertEqual(row['beforeSha256'], hashlib.sha256(self.files[row['path']]).hexdigest())
            self.assertNotEqual(row['beforeSha256'], row['afterSha256'])
        self.assertEqual(report['cleanup'], 'owned-temporary-copy-removed')
        text = json.dumps(report)
        for forbidden in ('PRIVATE-SENTINEL', 'PRIVATE-POISON', str(self.source), str(self.base), 'DO NOT EXECUTE'):
            self.assertNotIn(forbidden, text)

    def test_optional_placeholder_is_not_required_and_never_selects_a_real_service(self):
        identity = copy.deepcopy(IDENTITY)
        identity.pop('projectPlaceholder')
        report = self.run_rehearsal(identity)
        self.assertEqual(len(report['fields']), 9)
        self.assertEqual(report['categories']['deployment'], 'unchanged-unconfigured-placeholder')
        self.assertNotIn('.firebaserc', [row['path'] for row in report['copy']['changedFiles']])
        identity['projectPlaceholder'] = 'an-actual-looking-project'
        with self.assertRaisesRegex(subject.Refusal, 'inert-project-placeholder-required'):
            self.run_rehearsal(identity)

    def test_closed_spec_rejects_unknowns_credentials_urls_coercion_and_oversize_before_git(self):
        variants = []
        for key, value in [('credential', 'private'), ('target', '/tmp/existing'), ('hooks', ['never'])]:
            candidate = copy.deepcopy(IDENTITY)
            candidate[key] = value
            variants.append(candidate)
        for key, value in [('schemaVersion', True), ('packageName', '../escape'), ('packageName', 'UpperCase'),
                           ('project', {'name': 'Only name'}), ('site', {**IDENTITY['site'], 'title': 'x' * 161}),
                           ('repository', {'owner': 'https://credential@host', 'name': 'sample'}),
                           ('project', {'name': 'bad\nline', 'description': 'public'})]:
            candidate = copy.deepcopy(IDENTITY)
            candidate[key] = value
            variants.append(candidate)
        with patch.object(subject, '_git', side_effect=AssertionError('No Git read before spec validation')):
            for candidate in variants:
                with self.subTest(candidate=candidate), self.assertRaises(subject.Refusal):
                    subject.rehearse(self.source, self.revision, candidate)
        spec = self.base / 'public identity.json'
        for data in (b'{"schemaVersion":1,"schemaVersion":1}', b' ' * (subject.MAX_SPEC + 1), b'[]', b'\xff'):
            spec.write_bytes(data)
            with self.assertRaises(subject.Refusal):
                subject.read_identity(spec)

    def test_exact_committed_selection_missing_objects_and_symlink_spec_are_refused(self):
        for revision in ('HEAD', '--help', 'A' * 40, '0' * 40):
            with self.subTest(revision=revision), self.assertRaises(subject.Refusal):
                subject.rehearse(self.source, revision, copy.deepcopy(IDENTITY))
        source_link = self.base / 'linked-source'
        source_link.symlink_to(self.source, target_is_directory=True)
        with self.assertRaises(subject.Refusal):
            subject.rehearse(source_link, self.revision, copy.deepcopy(IDENTITY))
        spec = self.base / 'public.json'
        spec.write_bytes(encoded(IDENTITY))
        link = self.base / 'spec-link.json'
        link.symlink_to(spec)
        with self.assertRaises(subject.Refusal):
            subject.read_identity(link)

    def test_path_links_traversal_case_normalization_and_runtime_inventories_refuse(self):
        def row(path, mode='100644', kind='blob', size='0'):
            return f'{mode} {kind} {"a" * 40} {size}\t{path}\0'.encode()
        for name in ('../outside', '/outside', 'C:/outside', 'a\\outside', 'a/../outside', 'a//b',
                     'a/NUL.txt', 'a/trailing.', 'node_modules/private', '.git/config', '.env.local',
                     '.SYSTEMX/.systemx/state/private.json'):
            with self.subTest(path=name), self.assertRaises(subject.Refusal):
                subject.parse_tree(row(name))
        for data in (row('A/file') + row('a/other'), row('caf\u00e9/a') + row('cafe\u0301/b'),
                     row('a') + row('a/b'), row('a') + row('a'),
                     row('link', '120000'), row('module', '160000', 'commit', '-')):
            with self.subTest(data=data), self.assertRaises(subject.Refusal):
                subject.parse_tree(data)
        # Literal Windows aliases, including extension/nested variants, refuse
        # during complete-tree preflight before a blob-copy process can start.
        for name in ('public/COM¹.txt', 'COM²', 'nested/COM³.csv', 'public/LPT¹.log', 'LPT²', 'nested/LPT³.log'):
            with self.subTest(reserved_alias=name), patch.object(subject, '_git', return_value=row(name)), \
                    patch.object(subject, '_start', side_effect=AssertionError('No blob process after invalid tree')):
                with self.assertRaisesRegex(subject.Refusal, 'unsafe-committed-path'):
                    subject._copy_committed(self.source, self.revision, self.base / 'never-created')
        (self.source / 'committed-link').symlink_to(self.base / 'never-read')
        self.commit()
        with patch.object(subject, '_start', wraps=subject._start) as calls, self.assertRaises(subject.Refusal):
            self.run_rehearsal()
        self.assertFalse(any(call.args[1] == ['cat-file', '--batch'] for call in calls.call_args_list))

    def test_copy_budgets_enforced_before_blob_copy_and_at_exact_small_fixture_limit(self):
        count, size = len(self.files), sum(map(len, self.files.values()))
        with patch.object(subject, 'MAX_FILES', count), patch.object(subject, 'MAX_BYTES', size):
            self.assertEqual(self.run_rehearsal()['source']['files'], count)
        for field, limit in [('MAX_FILES', count - 1), ('MAX_BYTES', size - 1), ('MAX_FILE', 10), ('MAX_LIST', 10)]:
            with self.subTest(field=field), patch.object(subject, field, limit), self.assertRaises(subject.Refusal):
                self.run_rehearsal()

    def test_missing_or_unsupported_field_shapes_refuse_without_source_mutation(self):
        variants = [
            ('package-lock.json', b'{"name":"other","lockfileVersion":3,"packages":{"":{"name":"other"}}}'),
            ('.SYSTEMX/project.json', b'{"schemaVersion":2,"project":{"name":"x","description":"y"}}'),
            ('.firebaserc', b'{"projects":{"default":"already-selected-target"}}'),
            ('index.html', self.files['index.html'].replace(b'</head>', b'<title>Duplicate</title></head>')),
            ('index.html', self.files['index.html'].replace(b'name="description" content=', b'name="description" data-content=')),
            ('index.html', self.files['index.html'].replace(b'Old description', b'x' * 501)),
            ('package.json', b'{"name":"webappx","name":"duplicate"}'),
        ]
        for name, data in variants:
            with self.subTest(name=name):
                (self.source / name).write_bytes(data)
                self.commit()
                before = snapshot(self.source)
                with self.assertRaises(subject.Refusal):
                    self.run_rehearsal()
                self.assertEqual(snapshot(self.source), before)
                (self.source / name).write_bytes(self.files[name])
        (self.source / 'index.html').unlink()
        self.commit()
        with self.assertRaises(subject.Refusal):
            self.run_rehearsal()
        for raw in (b'{"n":1e999}', b'{"n":NaN}'):
            with self.assertRaises(subject.Refusal):
                subject._json(raw)

    def test_copy_verification_detects_unmapped_corruption_and_failure_cleans_owned_root(self):
        original_apply = subject._apply_fields
        roots = []
        def corrupt(stage, identity, entries):
            roots.append(stage.parent)
            result = original_apply(stage, identity, entries)
            (stage / '.SYSTEMX/Research/sample.bin').write_bytes(b'corrupted')
            return result
        before = snapshot(self.source)
        with patch.object(subject, '_apply_fields', side_effect=corrupt), self.assertRaisesRegex(subject.Refusal, 'unmapped-file-preservation-failed'):
            self.run_rehearsal()
        self.assertTrue(roots and all(not root.exists() for root in roots))
        self.assertEqual(snapshot(self.source), before)

    def test_cli_from_unrelated_cwd_is_read_only_bounded_and_has_no_apply_or_target(self):
        spec = self.base / 'public identity Ω.json'
        spec.write_bytes(encoded(IDENTITY))
        before = snapshot(self.source)
        command = [sys.executable, '-B', str(ROOT / 'scripts/adoption-dry-run.py'), '--source', str(self.source),
                   '--revision', self.revision, '--identity', str(spec)]
        result = subprocess.run(command, cwd=self.base, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertFalse(report['appliedToSource'])
        self.assertEqual(report['cleanup'], 'owned-temporary-copy-removed')
        self.assertLess(len(result.stdout.encode()), 16000)
        for unsupported in ('--apply', '--target'):
            refused = subprocess.run(command + [unsupported], cwd=self.base, capture_output=True, timeout=10)
            self.assertNotEqual(refused.returncode, 0)
        self.assertEqual(snapshot(self.source), before)


if __name__ == '__main__':
    unittest.main()
