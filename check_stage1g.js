#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = __dirname;
const stage = 'latex-stage1g-texlyre-log-tail-hotfix-20260428-1';
const requiredFiles = [
  'index.html', 'css/styles.css',
  'js/app-kernel.js', 'js/project-model.js', 'js/browser-wasm-provider.js', 'js/texlyre-busytex-provider.js', 'js/compiler-provider.js', 'js/ai-provider.js',
  'js/copilot.js', 'js/patch-manager.js', 'js/diagnostics.js', 'js/import-export.js',
  'backend/server.mjs', 'backend/providers/compile-texlive.mjs',
  'backend/security/validate-project.mjs', 'backend/security/sandbox-policy.mjs',
  'backend/Dockerfile', 'backend/package.json', 'backend/.env.example',
  'vendor/swiftlatex/pdftex/README.md', 'vendor/texlyre/core/busytex/README.md',
  'README_DEPLOY_STAGE1G.md', 'ARCHITECTURE_CONTRACTS_STAGE1G.json', 'TEXLYRE_INSTALL_STAGE1G.md'
];
const requiredIndexStrings = [
  stage, 'wasmStatusCard', 'testBrowserWasmBtn', 'browserWasmAssetBase', 'browserWasmTexliveEndpoint',
  'Browser WASM: SwiftLaTeX experimental', 'Browser WASM: TeXlyre BusyTeX experimental', 'texlyreStatusCard',
  'testTexlyreBtn', 'texlyreModuleUrl', 'texlyreBusytexBase', 'texlyre-busytex-provider.js',
  'openOverleafBtn', 'Compile backend URL', 'Compile PDF', 'copilotContextChips', 'patchReview'
];
const requiredBackendStrings = [
  '/api/lumina/latex/status', '/api/lumina/latex/compile/jobs', 'compileWithTexLive', 'validateCompilePayload',
  '/api/lumina/ai/status', '/api/lumina/ai/workflows', 'COPILOT_WORKFLOWS', 'lumina-latex-ai-response-v1'
];
const requiredFrontendStrings = ['BrowserWasmProvider', 'TexlyreBusyTexProvider', 'browser-wasm-texlyre-busytex-experimental', 'BusyTexRunner', 'texlyre-busytex'];
const requiredCopilotStrings = ['captureContext', 'lumina-latex-copilot-context-v1', 'fix-error-patch', 'proposeFromText'];
const requiredPatchStrings = ['lumina-latex-ai-patch-v1', 'applyActivePatch', 'replace-selection', 'find-replace'];
const requiredImportStrings = ['openRootInOverleaf', 'https://www.overleaf.com/docs', 'encoded_snip'];

const missingFiles = requiredFiles.filter((f) => !fs.existsSync(path.join(root, f)));
const index = read('index.html');
const backend = read('backend/server.mjs');
const compiler = read('js/compiler-provider.js') + '\n' + read('js/browser-wasm-provider.js') + '\n' + read('js/texlyre-busytex-provider.js');
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
fs.writeFileSync(path.join(root, 'INTERNAL_DIAGNOSTIC_STAGE1G.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);

function read(rel) { return fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : ''; }
