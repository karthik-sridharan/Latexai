const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const index = read('index.html');
const editor = read('js/editor-enhancement-service.js');
const css = read('css/lai-stage18f-editor-enhancements.css');
const readme = read('README_STAGE18K_EDITOR_SHORTCUT_LIVE_TEMPLATE_FIX.md');

assert(index.includes('latex-stage18k-editor-shortcut-live-template-fix-20260522-1'), 'index stage marker missing');
assert(index.includes('css/lai-stage18f-editor-enhancements.css?v=stage18k-editor-shortcut-live-template-fix-1'), 'editor CSS cachebuster missing');
assert(index.includes('js/editor-enhancement-service.js?v=stage18k-editor-shortcut-live-template-fix-1'), 'editor service cachebuster missing');
assert(editor.includes("const STAGE = 'stage18k-editor-shortcut-live-template-fix-1'"), 'stage constant missing');
assert(editor.includes('function liveManagerShortcuts'), 'live manager shortcut reader missing');
assert(editor.includes('function activeCustomShortcuts'), 'active shortcut source missing');
assert(editor.includes('concat(activeCustomShortcuts()'), 'key handler must use live custom shortcuts');
assert(editor.includes('function normalizeTemplatePlaceholders'), 'template placeholder normalization missing');
assert(editor.includes('\\\\mathcal{{{selection}}}'), 'mathcal example/default missing');
assert(editor.includes("'mod+c'") && editor.includes("'mod+v'") && editor.includes("'mod+x'"), 'browser-reserved shortcut warnings missing');
assert(editor.includes('active in this page') && editor.includes('Save shortcuts to persist'), 'status must explain live vs persistent shortcuts');
assert(editor.includes('latexai-direct-editor-surface'), 'Stage 18H stable textarea surface must remain');
assert(editor.includes('return lsGet(EXPERIMENTAL_OVERLAY_KEY, \'0\') === \'1\''), 'syntax overlay must remain opt-in');
assert(css.includes('Stage 18K') && css.includes('.editor-shortcut-status:not(.warning)'), 'Stage 18K shortcut status CSS missing');
assert(readme.includes('stage18k-editor-shortcut-live-template-fix-1'), 'README stage marker missing');
assert(readme.includes('\\mathcal{{{selection}}}') && readme.includes('\\mathcal{F}'), 'README should document mathcal template');
assert(!css.includes('color: transparent !important'), 'textarea must not use transparent text');
assert(!css.includes('-webkit-text-fill-color: transparent'), 'Safari text fill must not be transparent');
console.log('stage18k editor shortcut live template fix checks passed');
