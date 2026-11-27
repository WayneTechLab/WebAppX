"""Discover the copied upstream suite inside its verified temporary workspace."""
import os
from pathlib import Path
import tempfile
import unittest


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


def run_staged_tests():
    suite = unittest.defaultTestLoader.discover(str(Path.cwd() / '.SYSTEMX/tests'))
    if not windows_symlinks_available():
        annotate(suite)
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1


if __name__ == '__main__':
    raise SystemExit(run_staged_tests())
