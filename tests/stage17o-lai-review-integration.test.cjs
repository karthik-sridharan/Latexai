const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const paper = fs.readFileSync('js/paper-ai-polish-service.js', 'utf8');
const competitive = fs.readFileSync('js/competitive-paper-review-service.js', 'utf8');
const devils = fs.readFileSync('js/devils-advocate-debate-service.js', 'utf8');
const revision = fs.readFileSync('js/ai-revision-history-service.js', 'utf8');
const readme = fs.readFileSync('README_STAGE17O_LAI_REVIEW_INTEGRATION.md', 'utf8');

assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17o-lai-review-integration-for-devils-competitive-20260521-1'"), 'boot stage should be Stage 17O');
assert(index.includes('competitive-paper-review-service.js?v=stage17o-lai-review-integration-for-devils-competitive-1'), 'competitive service should use Stage 17O cache busting');
assert(index.includes('devils-advocate-debate-service.js?v=stage17o-lai-review-integration-for-devils-competitive-1'), 'devils service should use Stage 17O cache busting');

assert(paper.includes("const STAGE = 'stage17o-lai-review-integration-for-devils-competitive-1'"), 'paper-level review service should expose Stage 17O');
assert(paper.includes('function scanProject(options = {})'), 'paper-level review should support project scans');
assert(paper.includes('function editMetadataAt(text, start)'), 'paper-level review should parse LAI actionable metadata');
assert(paper.includes('sourceLabelFor'), 'paper-level review should label edit source workflow');
assert(paper.includes('data-paper-ai-open-path'), 'paper-level rows should offer file navigation');
assert(paper.includes('Scan project AI edits'), 'paper-level UI should expose project scan');

for (const [name, source, workflow] of [
  ['competitive', competitive, 'competitive-review'],
  ['devils', devils, 'devils-advocate']
]) {
  assert(source.includes("const STAGE = 'stage17o-lai-review-integration-for-devils-competitive-1'"), `${name} should expose Stage 17O`);
  assert(source.includes('function refreshPaperAiReview(paths'), `${name} should refresh paper-level edit review after insertion`);
  assert(source.includes('NS.PaperAiPolishService.scanProject'), `${name} should use the project-level scan when available`);
  assert(source.includes(`workflow=${workflow}`), `${name} inserted LAI blocks should carry workflow metadata`);
  assert(source.includes('wrapLaiPlanBlock'), `${name} append plan should be wrapped with actionable metadata`);
  assert(source.includes('Paper-level edit review refreshed'), `${name} status should tell the user the review queue updated`);
  assert(source.includes('inserted <code>\\\\lai</code>/<code>\\\\laiold</code> blocks are automatically scanned'), `${name} UI note should explain paper-level review integration`);
}

assert(revision.includes("insertActionableEditsAtMatches', 'Before inserting competitive inline"), 'revision history should wrap competitive inline insertion');
assert(revision.includes("appendLaiImprovementPlan', 'Before appending competitive"), 'revision history should wrap competitive append insertion');
assert(revision.includes("insertActionableEditsAtMatches', 'Before inserting devil"), 'revision history should wrap devil inline insertion');
assert(revision.includes("appendLaiImprovementPlan', 'Before appending devil"), 'revision history should wrap devil append insertion');
assert(readme.includes('Paper-level edit review'), 'README should document review integration');

console.log('stage17o LAI review integration static checks passed');
