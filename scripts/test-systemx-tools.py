#!/usr/bin/env python3
"""Test the selected immutable distribution, separately from host extensions."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

root = Path(__file__).resolve().parents[1]
state = json.loads((root / '.SYSTEMX/INSTALLATION.json').read_text())
release = root / '.SYSTEMX/.systemx/releases' / state['activeVersion']
os.chdir(root)
suite = unittest.defaultTestLoader.discover(str(release / 'tests'))

# The selected distribution is immutable. Apply host capability annotations to
# fixture tests in memory, without changing its files or production behavior.
def windows_symlinks_available():
    if os.name != 'nt':
        return True
    with tempfile.TemporaryDirectory() as temporary:
        folder = Path(temporary)
        target = folder / 'target'
        target.write_text('capability probe')
        try:
            (folder / 'link').symlink_to(target)
        except OSError as error:
            if getattr(error, 'winerror', None) == 1314:
                return False
            raise
    return True


requires_links = {
    'test_lifecycle.LifecycleTests.test_archive_does_not_follow_content_symlinks',
    'test_manager.ManagerTests.test_symlinks_conflicts_and_locks_preserve_user_content',
    'test_project_memory.ProjectMemoryTests.test_symlinked_worker_memory_cannot_escape_the_project',
    'test_project_memory.ProjectMemoryTests.test_checkpoint_pointer_is_contained_and_clear_preserves_history',
    'test_systemx.SystemxTests.test_symlink_and_outside_project_link_are_rejected',
}


def annotate(tests):
    for item in tests:
        if isinstance(item, unittest.TestSuite):
            annotate(item)
        elif item.id() in requires_links:
            method = getattr(type(item), item._testMethodName)
            setattr(type(item), item._testMethodName,
                    unittest.skip('Windows symlink creation privilege unavailable')(method))


if not windows_symlinks_available():
    annotate(suite)
raise SystemExit(0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1)
