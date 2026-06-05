const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const workspace = fs.readFileSync('js/project-workspace-service.js', 'utf8');
const fileTree = fs.readFileSync('js/file-tree.js', 'utf8');
const main = fs.readFileSync('js/main.js', 'utf8');
const diagnostics = fs.readFileSync('js/diagnostics.js', 'utf8');

assert(index.includes("stage19w41-project-workspace-restore-20260605-1"), 'index stage not bumped');
assert(index.includes('id="projectWorkspaceCard"'), 'project workspace card placeholder missing');
assert(index.includes('js/project-workspace-service.js?v=stage19w41-project-workspace-restore-20260605-1'), 'project workspace script missing/cache bust missing');

assert(workspace.includes('NS.ProjectWorkspaceService'), 'ProjectWorkspaceService export missing');
assert(workspace.includes("memoryPost('/project-restore'"), 'project restore endpoint not called');
assert(workspace.includes('reportArtifacts'), 'repo-local artifact scanner missing');
assert(workspace.includes('github-project-'), 'stable GitHub project identity missing');
assert(workspace.includes('github-paper-'), 'stable GitHub paper identity missing');
assert(workspace.includes('reviews'), 'reviews artifact count missing');
assert(workspace.includes('agentRuns'), 'agent run memory count missing');

assert(fileTree.includes('ProjectWorkspaceService?.restoreForProject'), 'GitHub load should trigger workspace restore');
assert(fileTree.includes('Stage 19W41'), 'file tree visible stage not updated');
assert(main.includes('NS.ProjectWorkspaceService?.init?.()'), 'main should initialize workspace service');
assert(main.includes("source: 'new-github-project-created'"), 'new GitHub project should trigger workspace restore');
assert(diagnostics.includes('ProjectWorkspaceService'), 'diagnostics should require workspace service');
assert(diagnostics.includes('projectWorkspace:'), 'diagnostics should include workspace summary');

console.log('stage19w41 project workspace restore frontend checks passed');
