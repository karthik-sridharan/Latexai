const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const competitive = fs.readFileSync('js/competitive-paper-review-service.js', 'utf8');
const devils = fs.readFileSync('js/devils-advocate-debate-service.js', 'utf8');
const revision = fs.readFileSync('js/ai-revision-history-service.js', 'utf8');
const readme = fs.readFileSync('README_STAGE17N_ACTIONABLE_LAI_EDITS.md', 'utf8');

assert(index.includes('LATEXAI_STAGE17N_ACTIONABLE_DEVILS_COMPETITIVE_LAI_EDITS'), 'index should advertise Stage 17N');
assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17n-actionable-devils-competitive-lai-edits-20260521-1'"), 'boot stage should be Stage 17N');
assert(index.includes('competitive-paper-review-service.js?v=stage17n-actionable-devils-competitive-lai-edits-1'), 'competitive service should use Stage 17N cache busting');
assert(index.includes('devils-advocate-debate-service.js?v=stage17n-actionable-devils-competitive-lai-edits-1'), 'devils service should use Stage 17N cache busting');

for (const [name, source] of [['competitive', competitive], ['devils', devils]]) {
  assert(source.includes("const STAGE = 'stage17n-actionable-devils-competitive-lai-edits-1'"), `${name} should expose Stage 17N`);
  assert(source.includes('latexai_actionable_edits'), `${name} should request/parse actionable edit JSON`);
  assert(source.includes('Insert \\\\lai edits at matches'), `${name} UI should expose inline LAI insertion`);
  assert(source.includes('Append \\\\lai plan'), `${name} UI should expose append LAI plan insertion`);
  assert(source.includes('function appendLaiImprovementPlan()'), `${name} should append visible LAI plans`);
  assert(source.includes('function insertActionableEditsAtMatches()'), `${name} should insert localized LAI edits`);
  assert(source.includes('function extractActionableEdits(text)'), `${name} should parse actionable edits`);
  assert(source.includes('\\\\laiold{'), `${name} should insert old content with \\laiold`);
  assert(source.includes('\\\\lai{'), `${name} should insert new content with \\lai`);
  assert(!source.includes('Inserted competitive roadmap as LaTeX comments'), `${name} should not use old competitive comment status`);
  assert(!source.includes('Inserted debate improvement plan as LaTeX comments'), `${name} should not use old debate comment status`);
}

assert(competitive.includes('appendPlan') && devils.includes('appendPlan'), 'both workflows should support appendPlan fallback');
assert(revision.includes('Before inserting competitive \\lai plan/edits'), 'revision history should label competitive LAI insertion');
assert(revision.includes('Before inserting devil’s advocate \\lai plan/edits'), 'revision history should label devils LAI insertion');
assert(readme.includes('comment-only append blocks to visible LaTeX AI edit markup'), 'README should document behavior change');

console.log('stage17n actionable LAI edits static checks passed');
