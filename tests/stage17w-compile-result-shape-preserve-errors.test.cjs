const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const providerJs = fs.readFileSync(path.join(root, 'js/compiler-provider.js'), 'utf8');
const preloadJs = fs.readFileSync(path.join(root, 'js/compiler-provider-preload.js'), 'utf8');

assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17w-compile-result-shape-preserve-errors-20260521-1'"), 'index should expose Stage 17W');
assert(index.includes('js/compiler-provider.js?v=stage17w-compile-result-shape-preserve-errors-1'), 'compiler provider should be cache-busted for Stage 17W');

for (const src of [providerJs, preloadJs]) {
  assert(src.includes("var STAGE = 'stage17w-compile-result-shape-preserve-errors-1'"), 'provider should expose Stage 17W');
  assert(src.includes('The wrapper\'s ok/status only means the job API request completed'), 'provider should document job wrapper semantics');
  assert(src.includes('if (!result.ok) return result;'), 'provider should not hydrate PDFs for failed TeX results');
  assert(src.includes('if (!directResult.ok) return directResult;'), 'provider should preserve direct compile failure logs');
}

function makeLocalStorage(initial = {}) {
  const store = { ...initial };
  return {
    get length() { return Object.keys(store).length; },
    key(i) { return Object.keys(store)[i] || null; },
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    _store: store
  };
}

function loadProvider(fetchImpl) {
  const win = {
    console: { log() {}, warn() {}, error() {} },
    location: { href: 'https://karthik-sridharan.github.io/Latexai/', hostname: 'karthik-sridharan.github.io' },
    localStorage: makeLocalStorage(),
    setInterval(fn) { return 0; },
    clearInterval() {},
    setTimeout,
    URL,
    Blob,
    Uint8Array,
    TextEncoder,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    fetch: fetchImpl
  };
  const sandbox = { window: win, globalThis: win, URL, Blob, Uint8Array, TextEncoder, setTimeout, console: win.console, Buffer };
  vm.createContext(sandbox);
  vm.runInContext(providerJs, sandbox, { filename: 'compiler-provider.js' });
  return win;
}

const project = {
  rootFile: 'main.tex',
  activePath: 'main.tex',
  files: { 'main.tex': '\\documentclass{article}\n\\begin{document}Hi\\end{document}' }
};

(async () => {
  const failedCompileResult = {
    ok: false,
    success: false,
    status: 'failed',
    exitCode: 1,
    message: 'Compile failed. See log/stderr for details.',
    log: '! Undefined control sequence.\nl.42 \\badmacro',
    problems: [{ level: 'error', line: 42, message: 'Undefined control sequence' }]
  };

  const win = loadProvider(async (url, init) => {
    if (String(url).endsWith('/compile/jobs')) {
      return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'completed', jobId: 'latex-failed', progress: 100, message: 'job completed', result: failedCompileResult }) };
    }
    throw new Error('The frontend should not fetch PDF/direct fallback for a failed nested TeX result: ' + url);
  });

  const result = await win.LuminaLatex.CompilerProvider.compile(project, {
    compileUrl: 'https://latex.example.com/api/lumina/latex/compile',
    compileStatusUrl: 'https://latex.example.com/api/lumina/latex/compile/jobs',
    backendStatusUrl: 'https://latex.example.com/api/lumina/latex/status',
    useCompileJobs: true
  });

  assert.strictEqual(result.ok, false, 'nested compile failure should stay failed despite wrapper ok:true');
  assert.strictEqual(result.status, 'failed');
  assert.strictEqual(result.exitCode, 1);
  assert(/Undefined control sequence/.test(result.log), 'LaTeX log should be preserved');
  assert.strictEqual(result.jobId, 'latex-failed', 'job id should be retained for diagnostics');

  const directFailed = loadProvider(async (url, init) => {
    if (String(url).endsWith('/compile/jobs')) {
      return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'completed', jobId: 'latex-empty', progress: 100 }) };
    }
    if (String(url).endsWith('/compile/jobs/latex-empty')) {
      return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'completed', jobId: 'latex-empty', progress: 100 }) };
    }
    if (String(url).endsWith('/compile/jobs/latex-empty/pdf')) {
      return { ok: false, text: async () => 'PDF not available', headers: { get: () => 'text/plain' } };
    }
    if (String(url).endsWith('/compile')) {
      return { ok: true, text: async () => JSON.stringify(failedCompileResult) };
    }
    throw new Error('unexpected URL ' + url);
  });

  const result2 = await directFailed.LuminaLatex.CompilerProvider.compile(project, {
    compileUrl: 'https://latex.example.com/api/lumina/latex/compile',
    compileStatusUrl: 'https://latex.example.com/api/lumina/latex/compile/jobs',
    useCompileJobs: true
  });

  assert.strictEqual(result2.ok, false, 'failed direct fallback should stay a compile failure');
  assert(/Compile failed/.test(result2.message), 'real compile failure message should be preserved');
  assert(/Undefined control sequence/.test(result2.log), 'direct failure log should not be replaced by missing-PDF text');
  assert(!/without returning or exposing a PDF/.test(result2.message), 'failed TeX should not be reported as success-without-PDF');

  console.log('Stage 17W compile result shape/error preservation tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
