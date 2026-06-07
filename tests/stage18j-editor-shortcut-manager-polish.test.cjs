const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const index = read('index.html');
const editor = read('js/editor-enhancement-service.js');
const css = read('css/lai-stage18f-editor-enhancements.css');
const readme = read('README_STAGE18J_EDITOR_SHORTCUT_MANAGER_POLISH.md');

assert(index.includes('latex-stage18j-editor-shortcut-manager-polish-20260522-1'), 'index stage marker missing');
assert(index.includes('css/lai-stage18f-editor-enhancements.css?v=stage18j-editor-shortcut-manager-polish-1'), 'editor CSS cachebuster missing');
assert(index.includes('js/editor-enhancement-service.js?v=stage18j-editor-shortcut-manager-polish-1'), 'editor service cachebuster missing');
assert(editor.includes("const STAGE = 'stage18j-editor-shortcut-manager-polish-1'"), 'stage constant missing');
assert(editor.includes('function applyTemplate'), 'template shortcut handler missing');
assert(editor.includes('{{selection}}') && editor.includes('{{cursor}}'), 'template placeholders missing');
assert(editor.includes('SHORTCUT_EXAMPLES'), 'shortcut examples missing');
assert(editor.includes('RISKY_SHORTCUTS') && editor.includes('mod+s'), 'shortcut conflict warnings missing');
assert(editor.includes('editorShortcutRows'), 'shortcut manager table body missing');
assert(editor.includes('addEditorShortcutBtn'), 'add shortcut button missing');
assert(editor.includes('exportEditorShortcutsBtn') && editor.includes('importEditorShortcutsBtn'), 'import/export controls missing');
assert(editor.includes('safeParseShortcuts'), 'shortcut JSON parser missing for import/backwards compatibility');
assert(editor.includes('latexai-direct-editor-surface'), 'Stage 18H direct textarea surface must remain');
assert(editor.includes('return lsGet(EXPERIMENTAL_OVERLAY_KEY, \'0\') === \'1\''), 'syntax overlay must remain opt-in');
assert(css.includes('.editor-shortcut-table'), 'shortcut table CSS missing');
assert(css.includes('.editor-shortcut-table-scroll'), 'shortcut table scroll container missing');
assert(css.includes('.editor-shortcut-status.warning'), 'shortcut warning CSS missing');
assert(readme.includes('stage18j-editor-shortcut-manager-polish-1'), 'README stage marker missing');
assert(!editor.includes('Custom shortcuts JSON'), 'manual JSON-first UI should be replaced');
assert(!css.includes('color: transparent !important'), 'textarea must not use transparent text');
assert(!css.includes('-webkit-text-fill-color: transparent'), 'Safari text fill must not be transparent');
console.log('stage18j editor shortcut manager polish checks passed');
