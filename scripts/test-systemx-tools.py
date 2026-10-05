#!/usr/bin/env python3
"""Test the selected immutable distribution, separately from host extensions."""
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
state = json.loads((root / '.SYSTEMX/INSTALLATION.json').read_text())
release = root / '.SYSTEMX/.systemx/releases' / state['activeVersion']
raise SystemExit(subprocess.run([sys.executable, '-B', '-m', 'unittest', 'discover',
                                '-s', str(release / 'tests'), '-v'], cwd=root).returncode)
