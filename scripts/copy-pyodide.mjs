// Copies the self-hosted Pyodide runtime into public/pyodide so learners can run Python
// in the browser without any third-party CDN. Runs before dev and build.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
const src = 'node_modules/pyodide';
const dst = 'public/pyodide';
mkdirSync(dst, { recursive: true });
for (const f of ['pyodide.js', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  if (!existsSync(`${src}/${f}`)) throw new Error(`Missing ${src}/${f}; run npm install`);
  cpSync(`${src}/${f}`, `${dst}/${f}`);
}
console.log('Pyodide copied to public/pyodide');
