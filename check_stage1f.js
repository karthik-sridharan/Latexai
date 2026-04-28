#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = __dirname;
const stage = 'latex-stage1f-easy-compile-modes-20260428-1';
const requiredFiles = [
  'index.html', 'css/styles.css',
  'js/app-kernel.js', 'js/project-model.js', 'js/browser-wasm-provider.js', 'js/compiler-provider.js', 'js/ai-provider.js',
  'js/copilot.js', 'js/patch-manager.js', 'js/diagnostics.js', 'js/import-export.js',
  'backend/server.mjs', 'backend/providers/compile-texlive.mjs',
  'backend/security/validate-project.mjs', 'backend/security/sandbox-policy.mjs',
  'backend/Dockerfile', 'backend/package.json', 'backend/.env.example',
  'vendor/swiftlatex/pdftex/README.md',
  'README_DEPLOY_STAGE1F.md', 'ARCHITECTURE_CONTRACTS_STAGE1F.json'
];
const requiredIndexStrings = [
  stage, 'wasmStatusCard', 'testBrowserWasmBtn', 'browserWasmAssetBase', 'browserWasmTexliveEndpoint',
  'Browser WASM experimental', 'openOverleafBtn', 'browser-wasm-provider.js', 'Compile backend URL', 'Compile PDF',
  'copilotContextChips', 'patchReview', 'previewCopilotPatchBtn', 'applyCopilotPatchBtn'
];
const requiredBackendStrings = [
  '/api/lumina/latex/status', '/api/lumina/latex/compile/jobs', 'compileWithTexLive', 'validateCompilePayload',
  '/api/lumina/ai/status', '/api/lumina/ai/workflows', 'COPILOT_WORKFLOWS', 'lumina-latex-ai-response-v1'
];
const requiredFrontendStrings = ['BrowserWasmProvider', 'browser-wasm-swiftlatex-experimental', 'ensureEngineClass', 'PdfTeXEngine.js', 'swiftlatexpdftex.js'];
const requiredCopilotStrings = ['captureContext', 'lumina-latex-copilot-context-v1', 'fix-error-patch', 'proposeFromText'];
const requiredPatchStrings = ['lumina-latex-ai-patch-v1', 'applyActivePatch', 'replace-selection', 'find-replace'];
const requiredImportStrings = ['openRootInOverleaf', 'https://www.overleaf.com/docs', 'encoded_snip'];

const missingFiles = requiredFiles.filter((f) => !fs.existsSync(path.join(root, f)));
const index = read('index.html');
const backend = read('backend/server.mjs');
const compiler = read('js/compiler-provider.js') + '\n' + read('js/browser-wasm-provider.js');
const copilot = read('js/copilot.js');
const patch = read('js/patch-manager.js');
const importExport = read('js/import-export.js');
const missingIndexStrings = requiredIndexStrings.filter((s) => !index.includes(s));
const missingBackendContracts = requiredBackendStrings.filter((s) => !backend.includes(s));
const missingFrontendContracts = requiredFrontendStrings.filter((s) => !compiler.includes(s));
const missingCopilotContracts = requiredCopilotStrings.filter((s) => !copilot.includes(s));
const missingPatchContracts = requiredPatchStrings.filter((s) => !patch.includes(s));
const missingImportContracts = requiredImportStrings.filter((s) => !importExport.includes(s));
const syntax = [];
for (const rel of fs.readdirSync(path.join(root, 'js')).filter((name) => name.endsWith('.js')).map((name) => `js/${name}`)) {
  try { new Function(fs.readFileSync(path.join(root, rel), 'utf8')); }
  catch (err) { syntax.push({ file: rel, error: err.message }); }
}
const report = {
  stage,
  checkedAt: new Date().toISOString(),
  missingFiles,
  missingIndexStrings,
  missingBackendContracts,
  missingFrontendContracts,
  missingCopilotContracts,
  missingPatchContracts,
  missingImportContracts,
  syntax,
  pass: missingFiles.length === 0 &&
    missingIndexStrings.length === 0 &&
    missingBackendContracts.length === 0 &&
    missingFrontendContracts.length === 0 &&
    missingCopilotContracts.length === 0 &&
    missingPatchContracts.length === 0 &&
    missingImportContracts.length === 0 &&
    syntax.length === 0
};
fs.writeFileSync(path.join(root, 'INTERNAL_DIAGNOSTIC_STAGE1F.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
