const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const index = read('index.html');
const competitive = read('js/competitive-paper-review-service.js');
const css = read('css/lai-stage16b-competitive-review.css');
const prompt = read('prompt/ai-competitive-paper-review.txt');

assert(index.includes('latex-stage18m-competitive-review-ranking-to-lai-edit-impact-map-20260522-1'), 'index stage marker missing');
assert(index.includes('js/competitive-paper-review-service.js?v=stage18m-competitive-review-ranking-to-lai-edit-impact-map-1'), 'competitive service cachebuster missing');
assert(index.includes('css/lai-stage16b-competitive-review.css?v=stage18m-competitive-review-ranking-to-lai-edit-impact-map-1'), 'competitive css cachebuster missing');
assert(competitive.includes("const STAGE = 'stage18m-competitive-review-ranking-to-lai-edit-impact-map-1'"), 'stage constant missing');

assert(competitive.includes('let lastEditImpactMap = []'), 'last edit impact state missing');
assert(competitive.includes('function normalizeRankingEffect'), 'ranking effect normalizer missing');
assert(competitive.includes('function buildEditImpactMap'), 'edit impact map builder missing');
assert(competitive.includes('function renderEditImpactMap'), 'edit impact map renderer missing');
assert(competitive.includes('function editImpactMarkdown'), 'edit impact markdown missing');
assert(competitive.includes('competitiveEditImpactMap'), 'edit impact map DOM missing');
assert(competitive.includes('rankingEffect object with competitors, gap, sourceIds, before, after, expectedImpact, and insertionMode'), 'prompt contract for rankingEffect object missing');
assert(competitive.includes('LAI ranking impact'), 'inserted lai block ranking impact metadata missing');
assert(competitive.includes('LAI evidence'), 'inserted lai block evidence metadata missing');
assert(competitive.includes('getLastEditImpactMap'), 'exported impact map getter missing');
assert(competitive.includes('renderEditImpactMap'), 'render impact map export/call missing');
assert(competitive.includes('editImpactMarkdown(buildEditImpactMap(lastReport))'), 'saved report impact map missing');

assert(css.includes('Stage 18M: ranking-to-lai edit impact map'), 'stage 18M css comment missing');
assert(css.includes('.competitive-edit-impact-map'), 'impact map css missing');
assert(css.includes('.competitive-impact-card'), 'impact card css missing');
assert(css.includes('.competitive-impact-badge.good'), 'impact readiness badge css missing');

assert(prompt.includes('Stage 18M workflow expectation'), 'prompt stage 18M missing');
assert(prompt.includes('edit impact map'), 'prompt should mention edit impact map');
assert(prompt.includes('"rankingEffect": {'), 'prompt rankingEffect object schema missing');
assert(prompt.includes('"sourceIds": ["S1", "S4"]'), 'prompt source IDs in rankingEffect missing');
assert(prompt.includes('inline \\\\laiold/\\\\lai'), 'prompt insertion mode missing');

assert(competitive.includes('requiredTools: [\'web_search\']'), 'web search tool requirement must be preserved');
assert(competitive.includes('insertActionableEditsAtMatches'), 'actionable lai insertion must be preserved');
assert(!competitive.includes('PDF found'), 'PDF extraction status should not exist');
assert(!competitive.includes('Text extracted'), 'text extraction status should not exist');

console.log('stage18m competitive review ranking-to-lai edit impact map static checks passed');
