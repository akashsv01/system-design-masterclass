/* Python runner worker. Loads self-hosted Pyodide and runs learner code against pytest-style tests.
 * Messages in:  { id, files: { "sdm/lru_cache.py": "...", "tests/test_x.py": "..." }, tests: ["tests/test_x.py"] }
 * Messages out: { id, ok, results: [{ name, outcome, message, line }], stdout, error }
 */
/* global importScripts, loadPyodide */
importScripts('/pyodide/pyodide.js');

let pyReady = null;

const PYTEST_SHIM = String.raw`
"""Minimal pytest compatibility layer for in-browser exercises.
Supports: plain assert tests, pytest.raises, @pytest.fixture (incl. params), @pytest.mark.parametrize."""
import contextlib

class _Raises:
    def __init__(self, exc, match=None):
        self.exc, self.match, self.value = exc, match, None
    def __enter__(self):
        return self
    def __exit__(self, et, ev, tb):
        if et is None:
            raise AssertionError(f"DID NOT RAISE {self.exc.__name__}")
        if not issubclass(et, self.exc):
            return False
        if self.match is not None:
            import re
            if not re.search(self.match, str(ev)):
                raise AssertionError(f"Raised {et.__name__}({ev!r}) but message did not match {self.match!r}")
        self.value = ev
        return True

def raises(exc, match=None):
    return _Raises(exc, match)

class _FixtureRequest:
    def __init__(self, param=None):
        self.param = param

def fixture(fn=None, *, params=None, ids=None):
    def wrap(f):
        f._sdm_fixture = True
        f._sdm_params = params
        f._sdm_ids = ids
        return f
    return wrap(fn) if fn is not None else wrap

class _Mark:
    def parametrize(self, names, values, ids=None):
        def wrap(f):
            f._sdm_parametrize = getattr(f, "_sdm_parametrize", []) + [(names, values)]
            return f
        return wrap
    def __getattr__(self, name):
        return lambda *a, **k: (lambda f: f)
mark = _Mark()

def approx(expected, rel=1e-6, abs=1e-12):
    class _A:
        def __eq__(self, other):
            return abs_(other - expected) <= max(rel * abs_(expected), abs)
        def __repr__(self):
            return f"approx({expected!r})"
    abs_ = __builtins__["abs"] if isinstance(__builtins__, dict) else __builtins__.abs
    return _A()
`;

const HARNESS = String.raw`
import importlib, inspect, sys, traceback, itertools, json, io, contextlib

def _run(test_paths):
    results = []
    for path in test_paths:
        modname = path[:-3].replace("/", ".")
        for m in list(sys.modules):
            if m == modname or m.startswith("sdm") or m.startswith("tests"):
                del sys.modules[m]
        try:
            mod = importlib.import_module(modname)
        except Exception as e:
            tb = traceback.extract_tb(e.__traceback__)
            user = [f for f in tb if f.filename.startswith("/work/")]
            fr = user[-1] if user else (tb[-1] if tb else None)
            results.append({"name": f"import {path}", "outcome": "error",
                            "message": f"{type(e).__name__}: {e}",
                            "line": f"{fr.filename.replace('/work/','')}:{fr.lineno}: {fr.line}" if fr else ""})
            continue
        fixtures = {n: f for n, f in vars(mod).items() if callable(f) and getattr(f, "_sdm_fixture", False)}
        for name, fn in list(vars(mod).items()):
            if not (name.startswith("test_") and callable(fn)):
                continue
            params = list(inspect.signature(fn).parameters)
            # Expand parametrize marks.
            cases = [({}, "")]
            for names, values in reversed(getattr(fn, "_sdm_parametrize", [])):
                keys = [n.strip() for n in names.split(",")] if isinstance(names, str) else list(names)
                new = []
                for base, label in cases:
                    for v in values:
                        vals = v if len(keys) > 1 else (v,)
                        d = dict(base); d.update(zip(keys, vals))
                        new.append((d, (label + "-" if label else "") + "-".join(map(str, vals))))
                cases = new
            # Expand parametrized fixtures.
            fx_options = []
            for p in params:
                f = fixtures.get(p)
                if f is not None and f._sdm_params:
                    ids = f._sdm_ids or [str(i) for i in range(len(f._sdm_params))]
                    fx_options.append([(p, prm, i) for prm, i in zip(f._sdm_params, ids)])
            for combo in itertools.product(*fx_options) if fx_options else [()]:
                for args, label in cases:
                    call = dict(args)
                    tags = [label] if label else []
                    for p, prm, i in combo:
                        from pytest import _FixtureRequest
                        call[p] = fixtures[p](_FixtureRequest(prm)); tags.append(str(i))
                    for p in params:
                        if p not in call and p in fixtures:
                            f = fixtures[p]
                            call[p] = f() if not inspect.signature(f).parameters else f(None)
                    tname = name + (f"[{'-'.join(t for t in tags if t)}]" if any(tags) else "")
                    try:
                        fn(**call)
                        results.append({"name": tname, "outcome": "passed", "message": "", "line": ""})
                    except AssertionError as e:
                        results.append(_failure(tname, e, "failed"))
                    except Exception as e:
                        results.append(_failure(tname, e, "error"))
    return results

def _failure(name, e, outcome):
    tb = traceback.extract_tb(e.__traceback__)
    frames = [f for f in tb if f.filename.startswith("/work/")]
    fr = frames[-1] if frames else (tb[-1] if tb else None)
    test_fr = next((f for f in reversed(frames) if "/tests/" in f.filename), fr)
    msg = str(e) or ""
    # Show local values at the failing assert for a plain "assert x == y".
    if not msg and isinstance(e, AssertionError):
        tbo = e.__traceback__
        while tbo.tb_next is not None:
            tbo = tbo.tb_next
        loc = {k: v for k, v in tbo.tb_frame.f_locals.items() if not k.startswith("_") and not inspect.ismodule(v) and not callable(v)}
        shown = ", ".join(f"{k} = {v!r}"[:120] for k, v in list(loc.items())[:6])
        msg = "assertion failed" + (f" (locals: {shown})" if shown else "")
    where = f"{test_fr.filename.replace('/work/','')}:{test_fr.lineno}: {test_fr.line}" if test_fr else ""
    if fr is not None and fr is not test_fr:
        where += f"\n  raised at {fr.filename.replace('/work/','')}:{fr.lineno}: {fr.line}"
    return {"name": name, "outcome": outcome, "message": f"{type(e).__name__}: {msg}" if outcome == "error" or not str(e) == msg else msg, "line": where}
`;

async function ready() {
  if (!pyReady) {
    pyReady = (async () => {
      const py = await loadPyodide({ indexURL: '/pyodide/' });
      py.FS.mkdirTree('/work');
      py.FS.writeFile('/work/pytest.py', PYTEST_SHIM);
      py.FS.writeFile('/work/_sdm_harness.py', HARNESS);
      py.runPython("import sys; sys.path.insert(0, '/work')");
      return py;
    })();
  }
  return pyReady;
}

function writeTree(py, files) {
  for (const [path, text] of Object.entries(files)) {
    const full = '/work/' + path;
    const dir = full.slice(0, full.lastIndexOf('/'));
    py.FS.mkdirTree(dir);
    py.FS.writeFile(full, text);
  }
  // Make every directory a package.
  for (const path of Object.keys(files)) {
    const parts = path.split('/').slice(0, -1);
    let acc = '/work';
    for (const p of parts) {
      acc += '/' + p;
      try { py.FS.stat(acc + '/__init__.py'); } catch { py.FS.writeFile(acc + '/__init__.py', ''); }
    }
  }
}

self.onmessage = async (ev) => {
  const { id, files, tests, timeoutMs } = ev.data;
  let out = '';
  try {
    const py = await ready();
    py.setStdout({ batched: (s) => { if (out.length < 20000) out += s + '\n'; } });
    py.setStderr({ batched: (s) => { if (out.length < 20000) out += s + '\n'; } });
    writeTree(py, files);
    py.globals.set('_tests', py.toPy(tests));
    const json = py.runPython("import json, importlib, _sdm_harness; importlib.reload(_sdm_harness); json.dumps(_sdm_harness._run(list(_tests)))");
    self.postMessage({ id, ok: true, results: JSON.parse(json), stdout: out });
  } catch (e) {
    self.postMessage({ id, ok: false, results: [], stdout: out, error: String(e && e.message ? e.message : e).slice(-2000) });
  }
  void timeoutMs;
};
