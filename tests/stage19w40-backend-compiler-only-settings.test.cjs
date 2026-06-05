const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const preview = fs.readFileSync('js/preview.js', 'utf8');
const provider = fs.readFileSync('js/compiler-provider.js', 'utf8');
const diagnostics = fs.readFileSync('js/diagnostics.js', 'utf8');
const organizer = fs.readFileSync('js/right-panel-organizer-service.js', 'utf8');

assert(index.includes("stage19w40-backend-compiler-only-settings-20260605-1"), 'index stage was not bumped');
assert(index.includes('Backend compiler only'), 'backend-only settings note missing');
assert(!index.includes('Browser WASM: SwiftLaTeX experimental'), 'SwiftLaTeX option should be removed from UI');
assert(!index.includes('Browser WASM: TeXlyre BusyTeX experimental'), 'TeXlyre option should be removed from UI');
assert(!index.includes('Mock draft check'), 'mock-draft provider option should be removed from UI');
assert(!index.includes('browser-wasm-provider.js'), 'browser wasm provider script should not be loaded');
assert(!index.includes('texlyre-busytex-provider.js'), 'TeXlyre provider script should not be loaded');
assert(!index.includes('openOverleafBtn'), 'Overleaf compile/export button should not appear in compile settings');
assert(index.includes('id="compilerModeSelect" type="hidden" value="backend-texlive"'), 'backend compiler hidden mode sentinel missing');

assert(preview.includes("DEFAULT_COMPILE_URL = 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/latex/compile'"), 'preview default compile URL not updated');
assert(preview.includes('function normalizeCompileUrl'), 'preview should normalize base/status/jobs URLs into /compile');
assert(preview.includes("State().setSetting('compileJobsUserEnabled'"), 'compile jobs checkbox should persist explicit user intent');
assert(preview.includes('settings.compileJobsUserEnabled === true && settings.useCompileJobs === true'), 'old hidden useCompileJobs=true should not auto-enable jobs after cleanup');

assert(provider.includes("BACKEND_BASE = 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app'"), 'provider backend default not updated');
assert(provider.includes("compilerMode = 'backend-texlive'"), 'provider should force backend texlive');
assert(provider.includes('next.compileStatusUrl = deriveCompileJobsUrl(next.compileUrl)'), 'jobs URL should be derived from compile URL');
assert(provider.includes('next.backendStatusUrl = deriveBackendStatusUrl(next.compileUrl)'), 'status URL should be derived from compile URL');
assert(provider.includes('next.useCompileJobs = next.compileJobsUserEnabled === true && next.useCompileJobs === true'), 'old job setting should be migrated off by default');

assert(!diagnostics.includes('BrowserWasmProvider'), 'diagnostics should not require BrowserWasmProvider');
assert(!diagnostics.includes('TexlyreBusyTexProvider'), 'diagnostics should not require TexlyreBusyTexProvider');
assert(!diagnostics.includes('browserWasmStatus'), 'diagnostics should not report browser wasm status');
assert(!diagnostics.includes('texlyreBusyTexStatus'), 'diagnostics should not report texlyre status');
assert(!organizer.includes('wasmStatusCard'), 'settings organizer should not group wasm controls');
assert(!organizer.includes('texlyreStatusCard'), 'settings organizer should not group texlyre controls');

console.log('stage19w40 backend compiler-only settings cleanup checks passed');
