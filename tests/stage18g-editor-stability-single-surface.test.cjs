const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const index = read('index.html');
const editor = read('js/editor-enhancement-service.js');
const css = read('css/lai-stage18f-editor-enhancements.css');

assert(index.includes('latex-stage18g-editor-stability-single-surface-20260522-1'), 'index stage marker missing');
assert(index.includes('css/lai-stage18f-editor-enhancements.css?v=stage18g-editor-stability-single-surface-1'), 'editor CSS cachebuster missing');
assert(index.includes('js/editor-enhancement-service.js?v=stage18g-editor-stability-single-surface-1'), 'editor service cachebuster missing');
assert(editor.includes("const STAGE = 'stage18g-editor-stability-single-surface-1'"), 'stage constant missing');
assert(editor.includes('function bindStateSync'), 'State sync binder missing');
assert(editor.includes('scheduleHighlightAfterEditorMutation'), 'mutation highlight scheduler missing');
assert(editor.includes('lastRenderedValue'), 'render dedupe missing');
assert(editor.includes('compositionstart'), 'composition guard missing');
assert(editor.includes('removeDuplicateSyntaxOverlays'), 'duplicate overlay guard missing');
assert(editor.includes('latexai-syntax-stable-single-surface'), 'stable editor class missing');
assert(editor.includes('scheduleHighlight({ force: true, immediate: true })'), 'immediate render path missing');
assert(css.includes('rgba(229, 231, 235, .018)'), 'textarea should be nearly transparent, not fully transparent');
assert(!css.includes('color: transparent !important'), 'textarea must not use fully transparent text color');
assert(!css.includes('-webkit-text-fill-color: transparent'), 'Safari text fill must not be fully transparent');
assert(css.includes('contain: paint'), 'syntax overlay should isolate painting');

console.log('stage18g editor stability static checks passed');
