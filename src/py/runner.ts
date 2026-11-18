/**
 * Client for public/py-worker.js. Each run has a timeout; a run that exceeds it (for example an
 * infinite loop) terminates the worker, and the next run starts a fresh one.
 */
export interface TestResult {
  name: string;
  outcome: 'passed' | 'failed' | 'error';
  message: string;
  line: string;
}
export interface RunResult {
  ok: boolean;
  results: TestResult[];
  stdout: string;
  error?: string;
  timedOut?: boolean;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: RunResult) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker('/py-worker.js');
    worker.onmessage = (ev: MessageEvent) => {
      const { id, ...rest } = ev.data as { id: number } & RunResult;
      pending.get(id)?.(rest);
      pending.delete(id);
    };
  }
  return worker;
}

/** Start loading Python in the background (about 12 MB, cached by the browser after the first time). */
export function warmUp() {
  getWorker().postMessage({ id: -1, files: {}, tests: [] });
}

export function runPython(files: Record<string, string>, tests: string[], timeoutMs = 20000): Promise<RunResult> {
  const id = ++seq;
  const w = getWorker();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      w.terminate();
      if (worker === w) worker = null;
      resolve({ ok: false, results: [], stdout: '', timedOut: true, error: `Stopped after ${timeoutMs / 1000} s. Check for a loop that never ends.` });
    }, timeoutMs);
    pending.set(id, (r) => {
      clearTimeout(timer);
      resolve(r);
    });
    w.postMessage({ id, files, tests });
  });
}
