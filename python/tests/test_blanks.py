"""Substitute each reference answer into its blank and run the exercise checks with real pytest."""
import importlib
import json
import sys
from pathlib import Path

import pytest

BLANKS = Path(__file__).resolve().parent.parent / "blanks"
ANSWERS = json.loads((BLANKS / "answers.json").read_text())


@pytest.mark.parametrize("name", sorted(ANSWERS))
def test_reference_answer_passes_checks(name, tmp_path, monkeypatch):
    source = (BLANKS / f"{name}.py").read_text()
    assert source.count("____") == 1, "exactly one blank per exercise"
    (tmp_path / "blank.py").write_text(source.replace("____", ANSWERS[name]))
    (tmp_path / "check.py").write_text((BLANKS / f"{name}_check.py").read_text())
    monkeypatch.syspath_prepend(str(tmp_path))
    for mod in ("blank", "check"):
        sys.modules.pop(mod, None)
    check = importlib.import_module("check")
    tests = [getattr(check, n) for n in dir(check) if n.startswith("test_")]
    assert tests
    for t in tests:
        t()


@pytest.mark.parametrize("name", sorted(ANSWERS))
def test_wrong_answer_fails_checks(name, tmp_path, monkeypatch):
    """A blank that is always False must fail at least one check (the checks are meaningful)."""
    source = (BLANKS / f"{name}.py").read_text()
    (tmp_path / "blank.py").write_text(source.replace("____", "False"))
    (tmp_path / "check.py").write_text((BLANKS / f"{name}_check.py").read_text())
    monkeypatch.syspath_prepend(str(tmp_path))
    for mod in ("blank", "check"):
        sys.modules.pop(mod, None)
    check = importlib.import_module("check")
    failures = 0
    for n in dir(check):
        if n.startswith("test_"):
            try:
                getattr(check, n)()
            except AssertionError:
                failures += 1
    assert failures > 0
