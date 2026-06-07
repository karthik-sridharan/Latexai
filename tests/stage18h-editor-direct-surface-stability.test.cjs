const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const index = read('index.html');
const editor = read('js/editor-enhancement-service.js');
const css = read('css/lai-stage18f-editor-enhancements.css');

assert(index.includes('latex-stage18h-editor-direct-surface-stability-20260522-1'), 'index stage marker missing');
assert(index.includes('css/lai-stage18f-editor-enhancements.css?v=stage18h-editor-direct-surface-stability-1'), 'editor CSS cachebuster missing');
assert(index.includes('js/editor-enhancement-service.js?v=stage18h-editor-direct-surface-stability-1'), 'editor service cachebuster missing');
assert(editor.includes("const STAGE = 'stage18h-editor-direct-surface-stability-1'"), 'stage constant missing');
assert(editor.includes('function enforceDirectEditorSurface'), 'direct surface enforcement missing');
assert(editor.includes('function isSafariLike'), 'Safari/iPad guard missing');
assert(editor.includes("return lsGet(EXPERIMENTAL_OVERLAY_KEY, '0') === '1'"), 'overlay should be opt-in, not default-on');
assert(editor.includes('latexai-direct-editor-surface'), 'direct surface shell class missing');
assert(editor.includes('ed.classList.remove(\'latexai-syntax-textarea\''), 'syntax class cleanup missing');
assert(editor.includes('ed.classList.remove(\'lai-source-selection-hidden-text\')'), 'selection hidden-text cleanup missing on focus');
assert(editor.includes('mod+[') && editor.includes('mod+]') && editor.includes('mod+b'), 'built-in shortcut keys missing');
assert(css.includes('.source-shell.latexai-direct-editor-surface #sourceEditor'), 'direct surface CSS missing');
assert(css.includes('-webkit-text-fill-color: #e5e7eb'), 'Safari visible text-fill override missing');
assert(css.includes('.latex-syntax-overlay[data-stage18h-enabled="0"]'), 'disabled overlay CSS missing');
assert(!css.includes('rgba(229, 231, 235, .018)'), 'old nearly-transparent text must be removed');
assert(!css.includes('color: transparent !important'), 'textarea must not use transparent text');
assert(!css.includes('-webkit-text-fill-color: transparent'), 'Safari text fill must not be transparent');
console.log('stage18h editor direct surface stability checks passed');
