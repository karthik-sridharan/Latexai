const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const providerPath = path.join(rootDir, 'js', 'compiler-provider.js');
const preloadPath = path.join(rootDir, 'js', 'compiler-provider-preload.js');
const indexPath = path.join(rootDir, 'index.html');

for (const p of [providerPath, preloadPath]) {
  const src = fs.readFileSync(p, 'utf8');
  assert(src.includes("var STAGE = 'stage17t-compile-endpoint-repair-1'"), path.basename(p) + ' should expose Stage 17T');
  assert(src.includes('looksLikeGenericLuminaBackend'), path.basename(p) + ' should detect generic backend URLs');
  assert(src.includes('stage17t-repaired-generic-backend-compile-url-from-backendStatusUrl'), path.basename(p) + ' should mark repaired endpoints');
  assert(src.includes('JSON.stringify(detail)'), path.basename(p) + ' should stringify HTTP object details');
  assert(src.includes('buildDirectCompileUrlCandidates'), path.basename(p) + ' should try paired direct compile endpoints');
  assert(src.includes('buildJobCompileUrlCandidates'), path.basename(p) + ' should try paired job compile endpoints');
}

const index = fs.readFileSync(indexPath, 'utf8');
assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17t-compile-endpoint-repair-20260521-1'"), 'index should expose Stage 17T');

function loadProvider() {
  const src = fs.readFileSync(providerPath, 'utf8');
  const storage = new Map();
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    location: { href: 'https://karthik-sridharan.github.io/Latexai/', hostname: 'karthik-sridharan.github.io' },
    localStorage: {
      get length() { return storage.size; },
      key(i) { return Array.from(storage.keys())[i] || null; },
      getItem(k) { return storage.has(k) ? storage.get(k) : null; },
      setItem(k, v) { storage.set(k, String(v)); },
      removeItem(k) { storage.delete(k); }
    },
    URL,
    fetch: async () => ({ ok: true, text: async () => '{}' })
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'compiler-provider.js' });
  return sandbox.CompilerProvider;
}

const provider = loadProvider();
const repaired = provider.normalizeSettings({
  schema: 'lumina-latex-settings-v1',
  compileUrl: 'https://lumina-backend-107996116179.us-east1.run.app/api/lumina/latex/compile',
  compileStatusUrl: 'https://lumina-backend-107996116179.us-east1.run.app/api/lumina/latex/compile/jobs',
  compileStatusUrlAutoDerived: true,
  backendStatusUrl: 'https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/status'
});
assert.strictEqual(repaired.compileUrl, 'https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/compile');
assert.strictEqual(repaired.compileStatusUrl, 'https://lumina-latex-backend-y4piylmfja-ue.a.run.app/api/lumina/latex/compile/jobs');
assert.strictEqual(repaired.compileEndpointRepair, 'stage17t-repaired-generic-backend-compile-url-from-backendStatusUrl');

console.log('Stage 17T compile endpoint repair checks passed.');
