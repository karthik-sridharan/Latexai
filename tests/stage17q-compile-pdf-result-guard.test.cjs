const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const providerJs = fs.readFileSync(path.join(root, 'js/compiler-provider.js'), 'utf8');
const preloadJs = fs.readFileSync(path.join(root, 'js/compiler-provider-preload.js'), 'utf8');
const previewJs = fs.readFileSync(path.join(root, 'js/preview.js'), 'utf8');

assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17q-compile-pdf-result-guard-20260521-1'"), 'index should expose Stage 17Q');
assert(providerJs.includes("var STAGE = 'stage17q-compile-pdf-result-guard-1'"), 'compiler provider should expose Stage 17Q');
assert(preloadJs.includes("var STAGE = 'stage17q-compile-pdf-result-guard-1'"), 'preload provider should expose Stage 17Q');
for (const src of [providerJs, preloadJs]) {
  assert(src.includes('function shouldSyncJobsUrlWithCompileUrl'), 'provider should sync stale job URL origin with compile URL origin');
  assert(src.includes("result.status === 'succeeded'"), 'provider should recognize status=succeeded');
  assert(src.includes('function requirePdfOrFallback'), 'provider should require PDF or use fallback');
  assert(src.includes('compileDirect(payload, settings)'), 'provider should fall back to direct compile endpoint');
  assert(src.includes('Compile backend reported success but did not return a PDF payload'), 'provider should mark no-PDF success as failure');
}
assert(previewJs.includes('State().setSetting(\'compileStatusUrl\', deriveCompileJobsUrl(compileUrl))'), 'preview should keep job URL synced when compile URL changes');
assert(previewJs.includes('function showPdfResult(result)'), 'preview should display multiple PDF payload shapes');
assert(previewJs.includes('const missingPdf = result?.ok && !displayedPdf'), 'preview should not call no-PDF success a successful compile');

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

(async () => {
  const calls = [];
  const win = {
    console: { log() {}, warn() {}, error() {} },
    location: { href: 'https://karthik-sridharan.github.io/Latexai/' },
    localStorage: makeLocalStorage({
      settings: JSON.stringify({
        schema: 'lumina-latex-settings-v1',
        compileUrl: 'https://new-backend.example.com/api/lumina/latex/compile',
        compileStatusUrl: 'https://old-backend.example.com/api/lumina/latex/compile/jobs',
        useCompileJobs: true,
        engine: 'pdflatex'
      })
    }),
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
        return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'succeeded', jobId: 'job-no-pdf', message: 'done but no pdf' }) };
      }
      return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'succeeded', pdfBase64: Buffer.from('%PDF-1.4\n%%EOF').toString('base64') }) };
    }
  };
  const sandbox = { window: win, globalThis: win, URL, Blob, Uint8Array, setTimeout, console: win.console };
  vm.createContext(sandbox);
  vm.runInContext(providerJs, sandbox);
  const result = await win.LuminaLatex.CompilerProvider.compile({
    rootFile: 'main.tex',
    activePath: 'main.tex',
    files: { 'main.tex': '\\documentclass{article}\n\\begin{document}Hi\\end{document}' }
  }, {
    compileUrl: 'https://new-backend.example.com/api/lumina/latex/compile',
    compileStatusUrl: 'https://old-backend.example.com/api/lumina/latex/compile/jobs',
    useCompileJobs: true,
    engine: 'pdflatex'
  });
  assert.strictEqual(calls[0], 'https://new-backend.example.com/api/lumina/latex/compile/jobs', 'job request should use compileUrl origin, not stale old origin');
  assert.strictEqual(calls[1], 'https://new-backend.example.com/api/lumina/latex/compile/jobs/job-no-pdf', 'job polling should stay on the compileUrl origin');
  assert.strictEqual(calls[2], 'https://new-backend.example.com/api/lumina/latex/compile', 'no-PDF job success should fall back to direct compile endpoint');
  assert.strictEqual(result.ok, true, 'direct fallback with PDF should succeed');
  assert(result.pdfBase64, 'direct fallback result should retain pdfBase64');
  assert.strictEqual(result.usedDirectCompileEndpoint, true, 'result should note direct fallback usage');

  const failCalls = [];
  win.fetch = async (url, init) => {
    failCalls.push(String(url));
    return { ok: true, text: async () => JSON.stringify({ ok: true, status: 'succeeded', jobId: 'job-no-pdf' }) };
  };
  const missing = await win.LuminaLatex.CompilerProvider.compile({
    rootFile: 'main.tex',
    files: { 'main.tex': '\\documentclass{article}\n\\begin{document}Hi\\end{document}' }
  }, {
    compileUrl: 'https://new-backend.example.com/api/lumina/latex/compile',
    compileStatusUrl: 'https://old-backend.example.com/api/lumina/latex/compile/jobs',
    useCompileJobs: true
  });
  assert.strictEqual(missing.ok, false, 'success-without-PDF should be converted to failure if fallback also lacks PDF');
  assert(/without returning a PDF payload|without a PDF/.test(missing.message), 'missing PDF failure should explain the real problem');
  console.log('Stage 17Q compile PDF result guard tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
