#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const index = read('index.html');
const organizer = read('js/right-panel-organizer-service.js');
const fileTree = read('js/file-tree.js');
const css = read('css/lai-stage17j-right-panel-sections.css');

assert(index.includes('stage19w30-github-load-branch-fallback-20260605-1'), 'index should cache-bust changed stage 19W29 files');
assert(index.includes('id="settingsBackendIntroNote"'), 'settings intro note needs a stable selector');
assert(index.includes('id="githubBackendSettingsNote"'), 'GitHub explanatory note needs a stable selector');
assert(index.includes('id="compileBackendSettingsNote"'), 'compile backend note needs a stable selector');
assert(index.includes('id="compileContractSettingsNote"'), 'compile contract note needs a stable selector');

assert(organizer.includes("key: 'ai-memory-backends'"), 'Settings should have an AI/memory drawer');
assert(organizer.includes("key: 'github-sync'"), 'Settings should have a dedicated GitHub drawer');
assert(organizer.includes("key: 'compile-engines'"), 'Settings should have a compile/engines drawer');
assert(organizer.includes("title: 'Other settings / advanced'"), 'Catch-all drawer should be renamed and demoted');
assert(!organizer.includes("'#settingsTab > .settings-note'"), 'Settings drawers must not sweep every note into one drawer');
assert(!/function init\(\) \{[\s\S]{0,220}unwrapOrganizerGroups\('settings'\)/.test(organizer), 'init should not immediately unwrap Settings drawers');
assert(organizer.includes("if (tab === 'settings') return ['settings'];"), 'bulk actions should still work on Settings drawers');
assert(organizer.includes("organize('settings')"), 'init should organize Settings drawers');

assert(fileTree.includes('actionableGithubErrorMessage'), 'GitHub errors should be humanized');
assert(fileTree.includes('GitHub could not find'), '404 load failures should explain repo/branch/folder/token checks');
assert(fileTree.includes('owner/repo spelling, branch name, GitHub token access'), 'GitHub load failure should include actionable checks');
assert(fileTree.includes('githubLoadFallbackBranches'), 'GitHub load should retry likely default branches after a branch 404');
assert(fileTree.includes('fetchGithubProjectWithFallback'), 'GitHub load should route through branch fallback helper');
assert(fileTree.includes("button('Detach', detachGithubProject"), 'Source tree should expose Detach for stale local GitHub attachments');
assert(fileTree.includes('Settings → Test GitHub backend only confirms'), 'GitHub load errors should distinguish backend health from repo lookup');
assert(!fileTree.includes("throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));"), 'raw JSON GitHub error throw should not remain');

assert(css.includes('[data-group-key="github-sync"]'), 'CSS should polish the dedicated GitHub settings drawer');
assert(css.includes('#githubBackendStatusCard.github-status-card.bad'), 'GitHub status card should have bad-state styling');
assert(index.includes('repository loading still requires the exact owner/repo'), 'Settings text should clarify backend test vs repository load');

console.log('stage19w30 GitHub load branch fallback checks passed');
