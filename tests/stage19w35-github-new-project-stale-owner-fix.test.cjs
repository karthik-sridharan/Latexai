const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fileTree = fs.readFileSync(path.join(root, 'js', 'file-tree.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(fileTree.includes("stage19w35-github-new-project-stale-owner-fix-20260605-1"), 'file-tree stage marker should be stage19w35');
assert(fileTree.includes("const explicitOwner = Object.prototype.hasOwnProperty.call(options, 'owner')"), 'new project create should derive owner only from explicit options.owner');
assert(!fileTree.includes("owner: options.owner || git.owner || ''"), 'new project create must not inherit stale git.owner');
assert(fileTree.includes("rootPath: normalizeRepoPath(options.rootPath || '')"), 'new project create must not inherit stale git.rootPath');
assert(fileTree.includes("branch: String(git.branch || '').trim()"), 'saved GitHub branch should preserve a deliberately blank branch');
assert(index.includes('js/file-tree.js?v=stage19w35-github-new-project-stale-owner-fix-20260605-1'), 'index should cache-bust file-tree.js with stage19w35');
assert(index.includes('js/main.js?v=stage19w35-github-new-project-stale-owner-fix-20260605-1'), 'index should cache-bust main.js with stage19w35');
console.log('stage19w35 github new-project stale owner regression checks passed');
