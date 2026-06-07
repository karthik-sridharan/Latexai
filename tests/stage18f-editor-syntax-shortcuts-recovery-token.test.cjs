const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const index = read('index.html');
const editor = read('js/editor-enhancement-service.js');
const css = read('css/lai-stage18f-editor-enhancements.css');
const safe = read('js/safe-mode-service.js');

assert(index.includes('latex-stage18f-editor-syntax-shortcuts-recovery-token-20260522-1'), 'index stage marker missing');
assert(index.includes('css/lai-stage18f-editor-enhancements.css?v=stage18f-editor-syntax-shortcuts-recovery-token-1'), 'editor enhancement css missing');
assert(index.includes('js/editor-enhancement-service.js?v=stage18f-editor-syntax-shortcuts-recovery-token-1'), 'editor enhancement script missing');
assert(index.includes('js/safe-mode-service.js?v=stage18f-editor-syntax-shortcuts-recovery-token-1'), 'safe-mode cachebuster not updated');

assert(editor.includes("const STAGE = 'stage18f-editor-syntax-shortcuts-recovery-token-1'"), 'editor enhancement stage constant missing');
assert(editor.includes("SHORTCUT_KEY = 'latexai:editor-shortcuts:v1'"), 'shortcut storage key missing');
assert(editor.includes("HIGHLIGHT_KEY = 'latexai:editor-syntax-highlight:v1'"), 'highlight storage key missing');
assert(editor.includes("key: 'mod+b'"), 'Cmd/Ctrl+B default shortcut missing');
assert(editor.includes("key: 'mod+['"), 'Cmd/Ctrl+[ default shortcut missing');
assert(editor.includes("key: 'mod+]'"), 'Cmd/Ctrl+] default shortcut missing');
assert(editor.includes('function renderHighlightedHtml'), 'syntax highlighter renderer missing');
assert(editor.includes('latex-token-command'), 'command token class missing');
assert(editor.includes('latex-token-env'), 'environment token class missing');
assert(editor.includes('function handleSmartEnter'), 'smart indentation handler missing');
assert(editor.includes('editorShortcutSettingsCard'), 'settings shortcut card missing');
assert(editor.includes('Custom shortcuts JSON'), 'custom shortcut UI missing');
assert(editor.includes('mode: \'environmentFromSelection\''), 'environmentFromSelection mode missing');
assert(editor.includes('mode: \'commentSelection\''), 'commentSelection mode missing');
assert(editor.includes('mode: \'uncommentSelection\''), 'uncommentSelection mode missing');

assert(css.includes('.latex-syntax-overlay'), 'syntax overlay css missing');
assert(css.includes('#sourceEditor.latexai-syntax-textarea'), 'transparent textarea css missing');
assert(css.includes('.latex-token-command'), 'command token css missing');
assert(css.includes('.latex-token-env'), 'environment token css missing');
assert(css.includes('.editor-shortcut-settings-card'), 'shortcut settings css missing');

assert(safe.includes("const STAGE = 'stage18f-editor-syntax-shortcuts-recovery-token-1'"), 'safe mode stage constant missing');
assert(safe.includes('recoveryTokenRequested'), 'recovery token guard missing');
assert(safe.includes('shouldShowRecoveryBar'), 'safe mode bar visibility guard missing');
assert(safe.includes('if (!shouldShowRecoveryBar()) return;'), 'recovery bar should not inject by default');
assert(safe.includes('params.has(\'safe\')'), 'safe query token missing');
assert(safe.includes('params.get(\'recovery\')'), 'recovery query token missing');

console.log('stage18f editor syntax/shortcuts/recovery-token static checks passed');
