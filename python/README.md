# Learner code (Python 3)

Every runnable example, starter, and worked solution shown on the site lives here, and the site imports
these files directly so what learners read is exactly what is tested.

```bash
cd python
python3 -m pytest -q
```

Requires Python 3.11+ and pytest. No other dependencies.

- `sdm/` — worked solutions and lesson examples (one module per lesson or case).
- `starters/` — starter code for exercises (intentionally incomplete; not imported by tests).
- `tests/` — pytest suites. Exercise solutions are checked by the same tests learners run.
