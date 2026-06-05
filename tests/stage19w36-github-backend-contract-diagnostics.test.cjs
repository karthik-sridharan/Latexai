const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fileTree = fs.readFileSync(path.join(root, 'js', 'file-tree.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(fileTree.includes('stage19w36-github-backend-contract-diagnostics-20260605-1'), 'stage constant updated');
assert(fileTree.includes('probeGithubBackendStatusForTrace'), 'backend status probe is present');
assert(fileTree.includes(": 'token-user'"), 'new-project primary create candidate uses token-user flow');
assert(fileTree.includes("label: 'legacy-empty-owner'"), 'legacy blank-owner retry is retained');
assert(fileTree.includes('delete next.owner'), 'blank owner is omitted in primary create request');
assert(fileTree.includes('Settings GitHub backend URL points at the Stage 19C+ GitHub sync backend'), 'diagnostic route guidance is present');
assert(index.includes('stage19w36-github-backend-contract-diagnostics-20260605-1'), 'index cache bust updated');
console.log('stage19w36 github backend contract diagnostics checks passed');
