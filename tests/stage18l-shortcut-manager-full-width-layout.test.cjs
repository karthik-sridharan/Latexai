#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');

const css = fs.readFileSync('css/lai-stage18f-editor-enhancements.css', 'utf8');
const js = fs.readFileSync('js/editor-enhancement-service.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert(css.includes('Stage 18L: shortcut manager full-width responsive layout'), 'CSS should document Stage 18L layout fix');
assert(css.includes('#editorShortcutSettingsCard.editor-shortcut-settings-card'), 'CSS should scope the fix to shortcut settings card');
assert(css.includes('display: block !important'), 'Shortcut settings card should override backend flex layout');
assert(css.includes('grid-template-columns: repeat(auto-fit'), 'Action buttons should wrap across the full card width');
assert(css.includes('Stage 18L final override'), 'Shortcut table should have the stacked full-width final override');
assert(css.includes('#editorShortcutSettingsCard .editor-shortcut-table thead') && css.includes('display: none !important'), 'Narrow right-panel shortcut table header should be hidden for stacked cards');
assert(css.includes('Template / environment'), 'Stacked fields should label the template/environment area');
assert(js.includes("const STAGE = 'stage18l-shortcut-manager-full-width-layout-1';"), 'Editor enhancement service should expose Stage 18L');
assert(html.includes('stage18l-shortcut-manager-full-width-layout-1'), 'index should cache-bust Stage 18L assets');

console.log('stage18l-shortcut-manager-full-width-layout test passed');
