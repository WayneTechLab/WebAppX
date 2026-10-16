import importlib.util
import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import sys
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
        mapping = json.loads((ROOT / 'scripts/starter-parity.json').read_text())
        public = ['scripts/starter-parity.json'] + [
            item['root'] for item in mapping['files'] if item['relation'] != 'starter-only']
        for name in public:
            destination = root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, destination)

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


class StarterParity(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.mapping = json.loads((ROOT / 'scripts/starter-parity.json').read_text())
        for row in self.mapping['files']:
            names = [validation.STARTER_DIRECTORY + '/' + row['starter']]
            if row['relation'] != 'starter-only':
                names.append(row['root'])
            for name in names:
                destination = self.root / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT / name, destination)
            # This owned synthetic fixture declares its own public baseline.
            # The production map is untouched: test_reusable_release_is_valid
            # independently refuses any unreviewed real-root fingerprint drift.
            if row['relation'] == 'intentional':
                data = (self.root / row['root']).read_bytes()
                if row['hashMode'] == 'utf8-lf-sha256':
                    data = data.replace(b'\r\n', b'\n')
                row['rootSha256'] = hashlib.sha256(data).hexdigest()
        path = self.root / 'scripts/starter-parity.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.mapping))

    def tearDown(self):
        self.temporary.cleanup()

    def report(self, mapping=None):
        return validation.starter_parity(self.root, mapping)

    def row(self, report, group, name):
        section = next(item for item in report['groups'] if item['id'] == group)
        return next(item for item in section['entries'] if item['starter'] == name)

    def test_literal_complete_groups_and_reviewed_difference_kinds(self):
        with patch.object(validation.subprocess, 'check_output', side_effect=AssertionError('A starter report must execute no command')):
            report = self.report()
        self.assertTrue(report['ok'], report['errors'])
        self.assertEqual([item['id'] for item in report['groups']],
                         ['app', 'dependency', 'asset', 'configuration'])
        self.assertEqual({item['id']: len(item['entries']) for item in report['groups']},
                         {'app': 22, 'dependency': 2, 'asset': 2, 'configuration': 17})
        self.assertEqual(report['counts'], {'mapped': 43, 'inventoried': 43,
                         'matched': 19, 'intentional': 22, 'starterOnly': 2, 'differences': 0})
        self.assertEqual(self.row(report, 'app', 'src/main.tsx')['status'], 'matched')
        self.assertEqual(self.row(report, 'dependency', 'package.json')['status'], 'intentional')
        self.assertEqual(self.row(report, 'configuration', '.github/workflows/ci.yml')['status'], 'starter-only')
        self.assertEqual(self.row(report, 'app', 'src/components/shell/SiteControls.tsx')['status'], 'starter-only')

    def test_four_independent_literal_group_changes_are_located(self):
        for group, name in [('app', 'src/main.tsx'), ('dependency', 'package.json'),
                            ('asset', 'public/favicon.svg'), ('configuration', '.firebaserc')]:
            with self.subTest(group=group):
                path = self.root / name
                before = path.read_bytes()
                if group == 'dependency':
                    value = json.loads(before)
                    value['dependencies']['react'] = '0.0.0-fictional'
                    path.write_text(json.dumps(value))
                else:
                    path.write_bytes(before + b'\nIndependent fictional drift.\n')
                report = self.report()
                self.assertFalse(report['ok'])
                self.assertEqual(self.row(report, group, name)['status'], 'changed')
                changed = [(section['id'], row['starter']) for section in report['groups']
                           for row in section['entries'] if row['change'] is not None]
                self.assertEqual(changed, [(group, name)])
                if group == 'dependency':
                    errors = next(x for x in report['groups'] if x['id'] == group)['diagnostics']
                    self.assertTrue(any('Shared dependencies differ' in error for error in errors))
                path.write_bytes(before)

    def test_variants_and_starter_only_bytes_need_explicit_review(self):
        for group, name in [('configuration', 'README.md'),
                            ('app', 'src/components/shell/SiteControls.tsx')]:
            with self.subTest(path=name):
                path = self.root / validation.STARTER_DIRECTORY / name
                original = path.read_bytes()
                path.write_bytes(original + b'\nUnreviewed starter extension.\n')
                report = self.report()
                self.assertEqual(self.row(report, group, name)['status'], 'changed')
                self.assertFalse(report['ok'])
                path.write_bytes(original)
        path = self.root / 'README.md'
        path.write_bytes(path.read_bytes() + b'\nUnreviewed root guide.\n')
        self.assertEqual(self.row(self.report(), 'configuration', 'README.md')['status'], 'changed')

    def test_missing_sides_and_new_root_for_starter_only_are_explicit(self):
        source = self.root / 'src/main.tsx'
        source.unlink()
        row = self.row(self.report(), 'app', 'src/main.tsx')
        self.assertEqual((row['status'], row['missingSides']), ('missing-root', ['root']))
        (self.root / validation.STARTER_DIRECTORY / 'src/main.tsx').unlink()
        row = self.row(self.report(), 'app', 'src/main.tsx')
        self.assertEqual((row['status'], row['missingSides']), ('missing-starter', ['starter', 'root']))
        added = self.root / 'src/components/shell/SiteControls.tsx'
        added.parent.mkdir(parents=True, exist_ok=True)
        added.write_text('Fictional unexpected root counterpart')
        self.assertEqual(self.row(self.report(), 'app', 'src/components/shell/SiteControls.tsx')['status'], 'unexpected-root')

    def test_unlisted_public_file_is_not_read_or_hidden_by_root_scope(self):
        relative = validation.STARTER_DIRECTORY + '/src/pages/Unlisted.tsx'
        path = self.root / relative
        path.write_text('throw new Error("This source must never execute or be read.")')
        original = validation._public_bytes
        reads = []
        def reading(root, name, *args):
            reads.append(name)
            return original(root, name, *args)
        with patch.object(validation, '_public_bytes', side_effect=reading):
            report = self.report()
        self.assertFalse(report['ok'])
        self.assertNotIn(relative, reads)
        self.assertEqual(self.row(report, 'app', 'src/pages/Unlisted.tsx')['status'], 'unlisted-starter')
        self.assertEqual(report['counts']['inventoried'], 44)

    def test_duplicate_case_collision_traversal_and_wrong_group_maps_refuse(self):
        for kind in ['duplicate', 'case', 'prefix', 'traversal', 'group', 'asset-policy', 'pair-alias']:
            with self.subTest(kind=kind):
                mapping = copy.deepcopy(self.mapping)
                first = mapping['files'][0]
                if kind == 'duplicate':
                    mapping['files'][1] = copy.deepcopy(first)
                elif kind == 'case':
                    entry = next(x for x in mapping['files'] if x['starter'] == 'src/pages/ContactPage.tsx')
                    entry.update(starter='src/Pages/ContactPage.tsx', root='src/Pages/ContactPage.tsx')
                elif kind == 'prefix':
                    entry = next(x for x in mapping['files'] if x['starter'] == 'src/pages/ContactPage.tsx')
                    entry.update(starter='src/pages/AboutPage.tsx/child.ts', root='src/pages/AboutPage.tsx/child.ts')
                elif kind == 'traversal':
                    first.update(starter='../outside.json', root='../outside.json')
                elif kind == 'group':
                    first['group'] = 'asset'
                elif kind == 'asset-policy':
                    next(x for x in mapping['files'] if x['starter'] == 'public/favicon.svg')['hashMode'] = 'utf8-lf-sha256'
                else:
                    first['root'] = 'package.json'
                report = self.report(mapping)
                self.assertFalse(report['ok'])
                self.assertFalse(report['inventoryComplete'])
                self.assertTrue(report['errors'])
                if kind == 'case':
                    self.assertTrue(any('Case collision' in error for error in report['errors']))

    def test_text_crlf_is_portable_while_assets_remain_byte_exact(self):
        path = self.root / 'src/main.tsx'
        path.write_bytes(path.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))
        report = self.report()
        self.assertTrue(report['ok'], report['errors'])
        self.assertEqual(self.row(report, 'app', 'src/main.tsx')['pairedContent'], 'lf-equivalent')
        asset = self.root / 'public/robots.txt'
        asset.write_bytes(asset.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))
        report = self.report()
        self.assertFalse(report['ok'])
        self.assertEqual(self.row(report, 'asset', 'public/robots.txt')['status'], 'changed')

    def test_dependency_lock_metadata_and_runtime_invariants_are_independent(self):
        for name, mutate, expected in [
                ('package-lock.json', lambda value: value['packages'][''].update(name='unreviewed'), 'lock root metadata'),
                ('package.json', lambda value: value['dependencies'].update({'unreviewed-package': '1.0.0'}), 'unreviewed root-only dependency')]:
            with self.subTest(path=name):
                path = self.root / name; before = path.read_bytes(); value = json.loads(before)
                mutate(value); path.write_text(json.dumps(value))
                report = self.report()
                errors = next(x for x in report['groups'] if x['id'] == 'dependency')['diagnostics']
                self.assertTrue(any(expected in error for error in errors), errors)
                path.write_bytes(before)
        (self.root / '.nvmrc').write_text('22.0.0\n')
        errors = next(x for x in self.report()['groups'] if x['id'] == 'dependency')['diagnostics']
        self.assertIn('Root/starter runtime pins must select one exact stable version.', errors)
        for prefix in ('', validation.STARTER_DIRECTORY + '/'):
            for name in ('.nvmrc', '.node-version'):
                (self.root / (prefix + name)).write_text('22.0.0\n')
        errors = next(x for x in self.report()['groups'] if x['id'] == 'dependency')['diagnostics']
        self.assertIn('Root/starter runtime pin is older than the declared Node minimum.', errors)

    def test_closed_private_runtime_exclusions_do_not_read_payload(self):
        starter = self.root / validation.STARTER_DIRECTORY
        (starter / '.env.local').write_text('FICTIONAL_ONLY_DO_NOT_READ=example')
        (starter / 'node_modules').mkdir()
        (starter / 'node_modules/payload').write_text('Fictional dependency payload')
        report = self.report()
        self.assertTrue(report['ok'], report['errors'])
        self.assertEqual(report['counts']['inventoried'], 43)
        self.assertEqual(report['excludedRuntimeScope'], ['node_modules', 'private-environment'])
        (starter / '.environment-public.json').write_text('{}')
        self.assertFalse(self.report()['ok'], 'A new public name must not be hidden by an env prefix')

    def test_root_and_starter_links_are_refused_without_external_reads(self):
        with tempfile.TemporaryDirectory() as outside:
            external = Path(outside) / 'payload'
            external.write_text('FICTIONAL_PRIVATE_MARKER_NEVER_REPORT')
            original_read = Path.read_bytes
            original_open = validation.os.open
            for location in [self.root / 'src/main.tsx', self.root / validation.STARTER_DIRECTORY / 'src/main.tsx']:
                with self.subTest(location=location.name):
                    saved = location.read_bytes(); location.unlink()
                    try: location.symlink_to(external)
                    except OSError as error: self.skipTest('Platform does not permit owned symlink fixture: ' + type(error).__name__)
                    def reading(path):
                        self.assertNotEqual(path.resolve(), external, 'External payload must not be opened')
                        return original_read(path)
                    def opening(path, flags, *args, **kwargs):
                        self.assertNotEqual(Path(path).resolve(), external, 'External descriptor must not be opened')
                        return original_open(path, flags, *args, **kwargs)
                    with patch.object(Path, 'read_bytes', reading), patch.object(validation.os, 'open', side_effect=opening):
                        report = self.report()
                    self.assertFalse(report['ok'])
                    self.assertNotIn('FICTIONAL_PRIVATE_MARKER', json.dumps(report))
                    location.unlink(); location.write_bytes(saved)

    def test_limits_and_unknown_directory_fail_with_incomplete_inventory(self):
        starter = self.root / validation.STARTER_DIRECTORY
        (starter / 'unknown-public-tree').mkdir()
        report = self.report()
        self.assertFalse(report['ok']); self.assertFalse(report['inventoryComplete'])
        (starter / 'unknown-public-tree').rmdir()
        for number in range(90):
            (starter / 'src' / ('extra-%03d.ts' % number)).write_text('')
        report = self.report()
        self.assertFalse(report['ok']); self.assertFalse(report['inventoryComplete'])
        self.assertTrue(any('limit exceeded' in error for error in report['errors']))

    def test_actual_nonexact_case_and_nonregular_counterpart_are_refused(self):
        pages = self.root / validation.STARTER_DIRECTORY / 'src/pages'
        renamed = pages.with_name('PAGES')
        pages.rename(renamed)
        report = self.report()
        self.assertFalse(report['ok'])
        self.assertEqual(self.row(report, 'app', 'src/pages/AboutPage.tsx')['status'], 'invalid-public-path')
        renamed.rename(pages)
        path = self.root / 'src/main.tsx'
        path.unlink(); path.mkdir()
        self.assertEqual(self.row(self.report(), 'app', 'src/main.tsx')['status'], 'invalid-root-type')

    def test_unsafe_required_integrity_input_never_becomes_available(self):
        with tempfile.TemporaryDirectory() as outside:
            payload = Path(outside) / 'package.json'
            payload.write_text('{"fictional-private": "NEVER_READ"}')
            path = self.root / 'package.json'; path.unlink()
            try: path.symlink_to(payload)
            except OSError as error: self.skipTest('Platform does not permit owned link fixture: ' + type(error).__name__)
            with patch.object(validation, '_validate_integrity', side_effect=AssertionError('Legacy reads must not cross this unsafe boundary')):
                report = validation.template_report(self.root)
            self.assertFalse(report['ok'])
            self.assertFalse(report['integrityChecksAvailable'])
            self.assertIn('Template integrity checks unavailable', report['integrityErrors'][0])
            self.assertNotIn('NEVER_READ', json.dumps(report))

    def test_read_only_report_and_cli_include_old_integrity_errors(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            TemplateRelease().copy_template(root)
            (root / 'src/main.tsx').write_text('Fictional changed app entry')
            (root / '.SYSTEMX/WORK/TASKS.json').write_text(json.dumps({'tasks': [{'id': 'TASK-001'}]}))
            selected = [path for path in root.rglob('*') if path.is_file()]
            before = {path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
                      for path in selected}
            result = subprocess.run([sys.executable, '-B', str(ROOT / 'scripts/validate-template.py'),
                                     '--root', str(root), '--json'], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stderr)
            report = json.loads(result.stdout)
            self.assertTrue(report['integrityChecksAvailable'])
            self.assertTrue(any('Reusable seed differs: WORK/TASKS.json' in error for error in report['integrityErrors']))
            self.assertTrue(any('src/main.tsx' in error for error in report['starterParity']['errors']))
            self.assertEqual(validation.validate(root), report['errors'])
            after = {path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
                     for path in root.rglob('*') if path.is_file()}
            self.assertEqual(after, before)


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
