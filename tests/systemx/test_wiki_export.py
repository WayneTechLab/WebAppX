import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('wiki_export_test', ROOT / 'scripts/render-wiki.py')
exporter = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(exporter)


class WikiExport(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.source = self.base / 'repo/wiki'
        self.target = self.base / 'cloned-wiki'
        self.source.mkdir(parents=True)
        self.target.mkdir()
        self.origin = 'https://github.com/FixtureOrg/Template.git'
        (self.source / 'Home.md').write_text('# Home\n')
        (self.source / 'Quick-Start.md').write_text('# Start\n')

    def test_export_converts_known_page_links_and_retains_source_history_and_code(self):
        (self.source / 'A Page.md').write_text('# A page\n')
        source = self.source / 'Home.md'
        contents = '''# Home
[Start](Quick-Start.md#install "Title")
[Angled](<A%20Page.md#next>)
[History](Historical.md#prior)
[Repository](../README.md)
[Unknown](Missing.md)
[External](https://example.com/Home.md)
[Section](#local-heading)
[reference]: ./Quick-Start.md#reference "Reference title"
`[Inline example](Quick-Start.md)`
``[Long inline example](Quick-Start.md)``
`A multiline example
[Sample](Quick-Start.md)`
```markdown
[Fenced example](Quick-Start.md)
```
~~~markdown
[Tilde example](Quick-Start.md)
~~~
    [Indented example](Quick-Start.md)
'''
        source.write_bytes(contents.encode())
        history = self.target / 'Historical.md'
        history.write_bytes(b'# Wiki-only historical page\n')
        (self.target / '.git').mkdir()
        git_history = self.target / '.git/kept-history'
        git_history.write_bytes(b'Existing repository history\n')
        original = {path.name: path.read_bytes() for path in self.source.glob('*.md')}
        result = subprocess.run([
            sys.executable, '-B', str(ROOT / 'scripts/render-wiki.py'),
            '--source', str(self.source), '--target', str(self.target), '--origin', self.origin,
        ], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        rendered = (self.target / 'Home.md').read_text()
        base = 'https://github.com/FixtureOrg/Template/wiki/'
        self.assertIn('[Start](' + base + 'Quick-Start#install "Title")', rendered)
        self.assertIn('[Angled](<' + base + 'A-Page#next>)', rendered)
        self.assertIn('[History](' + base + 'Historical#prior)', rendered)
        self.assertIn('[reference]: ' + base + 'Quick-Start#reference "Reference title"', rendered)
        for untouched in ('[Repository](../README.md)', '[Unknown](Missing.md)',
                          '[External](https://example.com/Home.md)', '[Section](#local-heading)',
                          '`[Inline example](Quick-Start.md)`',
                          '``[Long inline example](Quick-Start.md)``',
                          '`A multiline example\n[Sample](Quick-Start.md)`',
                          '```markdown\n[Fenced example](Quick-Start.md)\n```',
                          '~~~markdown\n[Tilde example](Quick-Start.md)\n~~~',
                          '    [Indented example](Quick-Start.md)'):
            self.assertIn(untouched, rendered)
        self.assertEqual({path.name: path.read_bytes() for path in self.source.glob('*.md')}, original)
        self.assertEqual(history.read_bytes(), b'# Wiki-only historical page\n')
        self.assertEqual(git_history.read_bytes(), b'Existing repository history\n')
        self.assertNotIn(str(self.base), rendered)

    def test_ssh_and_https_origins_use_the_same_rendered_repository_url(self):
        self.assertEqual(exporter.wiki_base(self.origin), 'https://github.com/FixtureOrg/Template/wiki')
        self.assertEqual(exporter.wiki_base('git@github.com:FixtureOrg/Template.git'),
                         exporter.wiki_base(self.origin))
        with self.assertRaises(ValueError):
            exporter.export(self.source, self.target, 'https://example.com/FixtureOrg/Template.git')
        self.assertEqual(list(self.target.iterdir()), [])

    def test_linked_source_or_destination_refuses_all_page_writes(self):
        outside = self.base / 'outside.md'
        outside.write_bytes(b'Private external page\n')
        existing = self.target / 'Home.md'
        existing.write_bytes(b'Prior published home\n')
        source_page = self.source / 'Quick-Start.md'
        original = source_page.read_bytes()
        source_page.unlink()
        source_page.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'linked or nonregular'):
            exporter.export(self.source, self.target, self.origin)
        self.assertEqual(existing.read_bytes(), b'Prior published home\n')
        self.assertFalse((self.target / 'Quick-Start.md').exists())
        source_page.unlink()
        source_page.write_bytes(original)
        existing.unlink()
        existing.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'linked or nonregular'):
            exporter.export(self.source, self.target, self.origin)
        self.assertTrue(existing.is_symlink())
        self.assertFalse((self.target / 'Quick-Start.md').exists())
        self.assertEqual(outside.read_bytes(), b'Private external page\n')


if __name__ == '__main__':
    unittest.main()
