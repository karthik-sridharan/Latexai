const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const providerJs = fs.readFileSync(path.join(root, 'js/compiler-provider.js'), 'utf8');
const preloadJs = fs.readFileSync(path.join(root, 'js/compiler-provider-preload.js'), 'utf8');

assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17s-lai-insertion-safety-20260521-1'"), 'index should expose Stage 17S');
for (const src of [providerJs, preloadJs]) {
  assert(src.includes("var STAGE = 'stage17s-lai-insertion-safety-1'"), 'provider should expose Stage 17S');
  assert(src.includes('function isJobEndpointFailure'), 'provider should detect unsupported job endpoints');
  assert(src.includes('function fallbackToDirectAfterJobError'), 'provider should have direct fallback for job endpoint failures');
  assert(src.includes('compile job creation endpoint'), 'provider should identify job create fallback');
  assert(src.includes('compile job polling endpoint'), 'provider should identify job poll fallback');
}

function makeLocalStorage(initial) {
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

async function runProviderTest(source) {
  const calls = [];
  const pdfB64 = Buffer.from('%PDF-1.4\n%%EOF').toString('base64');
  const win = {
    console: { log() {}, warn() {}, error() {} },
    location: { href: 'https://karthik-sridharan.github.io/Latexai/' },
    localStorage: makeLocalStorage({}),
    setInterval(fn) { return 0; },
    clearInterval() {},
    setTimeout,
    URL,
    Blob,
    Uint8Array,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    fetch: async (url, init) => {
      calls.push(String(url));
      if (String(url).includes('/compile/jobs')) {
        return { ok: false, status: 400, text: async () => JSON.stringify({ message: 'job endpoint unsupported on this backend' }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, status: 'succeeded', pdfBase64: pdfB64 }) };
    }
  };
  const sandbox = { window: win, globalThis: win, URL, Blob, Uint8Array, setTimeout, console: win.console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const result = await win.LuminaLatex.CompilerProvider.compile({
    rootFile: 'main.tex',
    activePath: 'main.tex',
    files: { 'main.tex': '\\documentclass{article}\n\\begin{document}Hi\\end{document}' }
  }, {
    compileUrl: 'https://lumina-backend.example.com/api/lumina/latex/compile',
    compileStatusUrl: 'https://lumina-backend.example.com/api/lumina/latex/compile/jobs',
    useCompileJobs: true,
    engine: 'pdflatex'
  });
  assert.strictEqual(calls[0], 'https://lumina-backend.example.com/api/lumina/latex/compile/jobs', 'should try job endpoint first');
  assert.strictEqual(calls[1], 'https://lumina-backend.example.com/api/lumina/latex/compile', 'HTTP 400 job endpoint should fall back to direct compile');
  assert.strictEqual(result.ok, true, 'direct fallback with PDF should succeed');
  assert.strictEqual(result.usedDirectCompileEndpoint, true, 'result should note direct compile fallback');
  assert(/job creation endpoint failed/.test(result.jobCompileFallbackReason), 'result should report why direct fallback was used');
}

(async () => {
  await runProviderTest(providerJs);
  await runProviderTest(preloadJs);

  const calls = [];
  const win = {
    console: { log() {}, warn() {}, error() {} },
    location: { href: 'https://karthik-sridharan.github.io/Latexai/' },
    localStorage: makeLocalStorage({}),
    setInterval(fn) { return 0; },
    clearInterval() {},
    setTimeout,
    URL,
    Blob,
    Uint8Array,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    fetch: async (url, init) => {
      calls.push(String(url));
      return { ok: false, status: 400, text: async () => JSON.stringify({ detail: String(url).includes('/compile/jobs') ? 'jobs disabled' : 'direct compile rejected payload' }) };
    }
  };
  const sandbox = { window: win, globalThis: win, URL, Blob, Uint8Array, setTimeout, console: win.console };
  vm.createContext(sandbox);
  vm.runInContext(providerJs, sandbox);
  const failed = await win.LuminaLatex.CompilerProvider.compile({
    rootFile: 'main.tex',
    files: { 'main.tex': '\\documentclass{article}\n\\begin{document}Hi\\end{document}' }
  }, {
    compileUrl: 'https://lumina-backend.example.com/api/lumina/latex/compile',
    compileStatusUrl: 'https://lumina-backend.example.com/api/lumina/latex/compile/jobs',
    useCompileJobs: true
  });
  assert.strictEqual(failed.ok, false, 'job 400 plus direct 400 should become a clear failed compile result');
  assert(/direct compile fallback failed/.test(failed.message), 'combined failure should mention direct fallback failure');
  assert(/HTTP 400/.test(failed.message), 'combined failure should preserve HTTP status');
  console.log('Stage 17S compile job 400 direct fallback tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
