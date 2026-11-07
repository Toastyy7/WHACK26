"""Backwards-compatible entry point for the expanded browser checks."""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name('check-browser.py')), run_name='__main__')
