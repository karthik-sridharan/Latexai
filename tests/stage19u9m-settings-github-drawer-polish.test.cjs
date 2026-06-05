const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const organizer = fs.readFileSync('js/right-panel-organizer-service.js', 'utf8');
const backendSettings = fs.readFileSync('js/backend-url-settings-service.js', 'utf8');
const fileTree = fs.readFileSync('js/file-tree.js', 'utf8');
const css = fs.readFileSync('css/lai-stage17j-right-panel-sections.css', 'utf8');

assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage19u9m-settings-github-drawer-polish-20260604-1'"), 'index should advertise Stage 19U9M');
assert(index.includes('right-panel-organizer-service.js?v=stage19u9m-settings-github-drawer-polish-1'), 'organizer cache bust should be updated');
assert(index.includes('backend-url-settings-service.js?v=stage19u9m-settings-github-drawer-polish-1'), 'backend settings cache bust should be updated');
assert(index.includes('file-tree.js?v=stage19u9m-settings-github-drawer-polish-1'), 'file tree cache bust should be updated');
assert(index.includes('id="githubBackendStatusCard"'), 'Settings should expose a GitHub backend status card');
assert(index.includes('id="githubBackendSettingsNote"'), 'GitHub explanatory note should have a stable selector');
assert(index.includes('id="compileBackendSettingsNote"'), 'Compile explanatory note should have a stable selector');

assert(organizer.includes("const STORAGE_KEY = 'latexai:right-panel-sections:v8'"), 'new organizer state key should isolate the new drawer layout');
assert(organizer.includes("key: 'ai-memory-backends'"), 'AI/memory settings drawer should exist');
assert(organizer.includes("key: 'github-sync'"), 'GitHub sync settings drawer should exist');
assert(organizer.includes("key: 'compile-engines'"), 'Compile engines settings drawer should exist');
assert(organizer.includes("'#githubBackendUrl'"), 'GitHub URL field should be explicitly grouped');
assert(organizer.includes("'#githubBackendStatusCard'"), 'GitHub status card should be explicitly grouped');
assert(!organizer.includes("'#settingsTab > .settings-note'"), 'Settings grouping must not sweep all notes into one drawer');
assert(organizer.includes("title: 'Other Settings controls',\n      defaultOpen: false"), 'catch-all Settings drawer should be collapsed by default');

assert(backendSettings.includes('function setGithubStatus'), 'BackendUrlSettingsService should render GitHub status');
assert(backendSettings.includes('async function testGithubBackend'), 'BackendUrlSettingsService should test GitHub backend');
assert(backendSettings.includes("el('testGithubBackendBtn')"), 'GitHub test button should be bound');
assert(fileTree.includes('function formatGithubLoadError'), 'FileTree should rewrite raw GitHub 404 errors');
assert(fileTree.includes('GitHub could not find'), 'GitHub 404 message should be actionable');
assert(css.includes('Stage 19U9M'), 'CSS should include Stage 19U9M settings drawer polish');
assert(css.includes('[data-group-key="github-sync"]'), 'CSS should style the GitHub settings drawer');

console.log('stage19u9m settings GitHub drawer polish checks passed');
