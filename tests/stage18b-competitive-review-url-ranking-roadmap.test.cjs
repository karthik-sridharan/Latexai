const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const index = read('index.html');
const competitive = read('js/competitive-paper-review-service.js');
const css = read('css/lai-stage16b-competitive-review.css');
const prompt = read('prompt/ai-competitive-paper-review.txt');

assert(index.includes('latex-stage18b-competitive-review-url-ranking-roadmap-20260521-1'), 'index stage marker missing');
assert(index.includes('js/competitive-paper-review-service.js?v=stage18b-competitive-review-url-ranking-roadmap-1'), 'competitive service cachebuster missing');
assert(index.includes('css/lai-stage16b-competitive-review.css?v=stage18b-competitive-review-url-ranking-roadmap-1'), 'competitive CSS cachebuster missing');

assert(competitive.includes("const STAGE = 'stage18b-competitive-review-url-ranking-roadmap-1'"), 'service stage constant missing');
assert(competitive.includes("URL_CACHE_KEY = 'latexai:competitive-url-paper-cache:v1'"), 'competitor URL cache key missing');
assert(competitive.includes('function fetchCompetitorPapers'), 'fetch/extract step missing');
assert(competitive.includes('function rankCompetitorPapers'), 'rank competitors step missing');
assert(competitive.includes('function compareDraftAgainstRankedSet'), 'compare draft step missing');
assert(competitive.includes('function generateImprovementRoadmap'), 'roadmap generation step missing');
assert(competitive.includes('competitiveWorkflowStatus'), 'workflow status UI missing');
assert(competitive.includes('competitiveAddUrlInput'), 'add URL input missing');
assert(competitive.includes('fetchCompetitivePapersBtn'), 'fetch button missing');
assert(competitive.includes('rankCompetitivePapersBtn'), 'rank button missing');
assert(competitive.includes('compareCompetitiveDraftBtn'), 'compare button missing');
assert(competitive.includes('generateCompetitiveRoadmapBtn'), 'roadmap button missing');
assert(competitive.includes('latexai_competitor_papers'), 'competitor papers JSON contract missing');
assert(competitive.includes('latexai_competitor_ranking'), 'competitor ranking JSON contract missing');
assert(competitive.includes("routeKey, 'competitive-improvement'") || competitive.includes("'competitive-improvement'"), 'competitive improvement route missing');
assert(competitive.includes("'competitive-ranking'"), 'competitive ranking route missing');
assert(competitive.includes('rankingEffect'), 'ranking effect support missing');
assert(competitive.includes('insertActionableEditsAtMatches'), 'actionable lai insertion must be preserved');
assert(competitive.includes('refreshPaperAiReview'), 'paper-level edit review refresh must be preserved');

assert(css.includes('.competitive-workflow-status'), 'workflow status CSS missing');
assert(css.includes('.competitive-url-add-row'), 'URL add row CSS missing');
assert(css.includes('.competitive-step-actions'), 'step action CSS missing');

assert(prompt.includes('Stage 18B workflow expectation'), 'prompt stage 18B instructions missing');
assert(prompt.includes('current estimated position'), 'prompt current/after rank instruction missing');
assert(prompt.includes('latexai_actionable_edits'), 'actionable edit JSON prompt missing');
assert(prompt.includes('rankingEffect'), 'prompt rankingEffect field missing');

console.log('stage18b competitive review URL ranking roadmap static checks passed');
