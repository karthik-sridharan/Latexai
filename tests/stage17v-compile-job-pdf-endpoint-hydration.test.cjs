const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const providerJs = fs.readFileSync(path.join(root, 'js/compiler-provider.js'), 'utf8');
const preloadJs = fs.readFileSync(path.join(root, 'js/compiler-provider-preload.js'), 'utf8');

assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17v-compile-job-pdf-endpoint-hydration-20260521-1'"), 'index should expose Stage 17V');
assert(index.includes('js/compiler-provider.js?v=stage17v-compile-job-pdf-endpoint-hydration-1'), 'compiler provider should be cache-busted for Stage 17V');
for (const src of [providerJs, preloadJs]) {
  assert(src.includes("var STAGE = 'stage17v-compile-job-pdf-endpoint-hydration-1'"), 'provider should expose Stage 17V');
  assert(src.includes('function buildJobPdfUrl'), 'provider should build /compile/jobs/{jobId}/pdf URLs');
  assert(src.includes('function tryHydratePdfFromJobEndpoint'), 'provider should hydrate missing PDFs from the job PDF endpoint');
  assert(src.includes('collectPdfHints'), 'provider should search nested PDF fields');
  assert(src.includes('/compile/jobs/{jobId}/pdf'), 'no-PDF error message should mention the job PDF endpoint');
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
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    fetch: fetchImpl
  };
  const sandbox = { window: win, globalThis: win, URL, Blob, Uint8Array, setTimeout, console: win.console, Buffer };
  vm.createContext(sandbox);
  vm.runInContext(providerJs, sandbox, { filename: 'compiler-provider.js' });
  return win;
}

const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
const rootPayload = {
  rootFile: 'main.tex',
  activePath: 'main.tex',
  files: { 'main.tex': '\\documentclass{article}\n\\begin{document}Hi\\end{document}' }
};

(async () => {
  const calls = [];
  const win = loadProvider(async (url, init) => {
    calls.push(String(url));
    if (String(url).endsWith('/compile/jobs')) {
      return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'completed', jobId: 'latex-abc123', progress: 100, message: 'done' }) };
    }
    if (String(url).endsWith('/compile/jobs/latex-abc123')) {
      return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'completed', jobId: 'latex-abc123', progress: 100, message: 'done' }) };
    }
    if (String(url).endsWith('/compile/jobs/latex-abc123/pdf')) {
      return {
        ok: true,
        headers: { get: () => 'application/pdf' },
        arrayBuffer: async () => pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
      };
    }
    throw new Error('unexpected URL ' + url);
  });
  const result = await win.LuminaLatex.CompilerProvider.compile(rootPayload, {
    compileUrl: 'https://latex.example.com/api/lumina/latex/compile',
    compileStatusUrl: 'https://latex.example.com/api/lumina/latex/compile/jobs',
    backendStatusUrl: 'https://latex.example.com/api/lumina/latex/status',
    useCompileJobs: true
  });
  assert.strictEqual(result.ok, true, 'job PDF endpoint hydration should produce an ok result');
  assert.strictEqual(result.status, 'success');
  assert.strictEqual(result.pdfBytesLength, pdfBytes.byteLength);
  assert.strictEqual(result.pdfEndpointUrl, 'https://latex.example.com/api/lumina/latex/compile/jobs/latex-abc123/pdf');
  assert(result.pdfUrl || result.pdfBase64, 'hydrated result should expose a previewable PDF URL or base64 payload');
  assert.deepStrictEqual(calls, [
    'https://latex.example.com/api/lumina/latex/compile/jobs',
    'https://latex.example.com/api/lumina/latex/compile/jobs/latex-abc123',
    'https://latex.example.com/api/lumina/latex/compile/jobs/latex-abc123/pdf'
  ]);

  const nestedB64 = pdfBytes.toString('base64');
  const win2 = loadProvider(async (url, init) => {
    return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'succeeded', artifacts: { pdf: { base64: nestedB64 } } }) };
  });
  const nested = await win2.LuminaLatex.CompilerProvider.compile(rootPayload, {
    compileUrl: 'https://latex.example.com/api/lumina/latex/compile',
    useCompileJobs: false
  });
  assert.strictEqual(nested.ok, true, 'nested PDF base64 should be recognized');
  assert.strictEqual(nested.pdfBase64, nestedB64);

  const win3 = loadProvider(async (url, init) => {
    if (String(url).endsWith('/compile/jobs')) {
      return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'completed', jobId: 'latex-missing', progress: 100 }) };
    }
    if (String(url).endsWith('/compile/jobs/latex-missing')) {
      return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'completed', jobId: 'latex-missing', progress: 100 }) };
    }
    if (String(url).endsWith('/compile/jobs/latex-missing/pdf')) {
      return { ok: false, text: async () => 'PDF not available', headers: { get: () => 'text/plain' } };
    }
    return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'succeeded' }) };
  });
  const missing = await win3.LuminaLatex.CompilerProvider.compile(rootPayload, {
    compileUrl: 'https://latex.example.com/api/lumina/latex/compile',
    compileStatusUrl: 'https://latex.example.com/api/lumina/latex/compile/jobs',
    useCompileJobs: true
  });
  assert.strictEqual(missing.ok, false, 'missing PDF should still be a real failure');
  assert(/nested PDF fields|job PDF endpoint|without returning or exposing a PDF/i.test(missing.message), 'failure should explain all PDF extraction attempts');

  console.log('Stage 17V compile job PDF endpoint hydration tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
