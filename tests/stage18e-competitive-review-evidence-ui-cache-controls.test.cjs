const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const index = read('index.html');
const competitive = read('js/competitive-paper-review-service.js');
const css = read('css/lai-stage16b-competitive-review.css');
const prompt = read('prompt/ai-competitive-paper-review.txt');

assert(index.includes('latex-stage18e-competitive-review-evidence-ui-cache-controls-20260521-1'), 'index stage marker missing');
assert(index.includes('js/competitive-paper-review-service.js?v=stage18e-competitive-review-evidence-ui-cache-controls-1'), 'competitive service cachebuster missing');
assert(competitive.includes("const STAGE = 'stage18e-competitive-review-evidence-ui-cache-controls-1'"), 'stage constant missing');
assert(competitive.includes("URL_CACHE_KEY = 'latexai:competitive-web-research-profile-cache:v3'"), 'v3 web research cache key missing');
assert(competitive.includes('LEGACY_URL_CACHE_KEYS'), 'legacy cache migration missing');
assert(competitive.includes('function renderEvidenceDashboard'), 'evidence dashboard renderer missing');
assert(competitive.includes('function renderRankingPreview'), 'ranking preview renderer missing');
assert(competitive.includes('function parseRankingEntries'), 'ranking JSON parser missing');
assert(competitive.includes('function clearResearchCacheForCurrentUrls'), 'current URL cache clear missing');
assert(competitive.includes('async function rerunAllCompetitorResearch'), 'rerun all research control missing');
assert(competitive.includes('async function rerunSingleCompetitorResearch'), 'rerun selected competitor control missing');
assert(competitive.includes('handleEvidenceDashboardClick'), 'evidence card delegated click handler missing');
assert(competitive.includes('competitiveEvidenceDashboard'), 'evidence dashboard DOM missing');
assert(competitive.includes('competitiveRankingPreview'), 'ranking preview DOM missing');
assert(competitive.includes('Rerun all web research'), 'rerun all button missing');
assert(competitive.includes('Clear research cache'), 'clear cache button missing');
assert(competitive.includes('View sources'), 'view sources button missing');
assert(competitive.includes('Cache: '), 'cache hit/miss UI missing');
assert(competitive.includes('Only seed or one source found'), 'evidence warning missing');
assert(competitive.includes('requiredTools: [\'web_search\']'), 'web search tool requirement must be preserved');
assert(competitive.includes('insertActionableEditsAtMatches'), 'actionable lai insertion must be preserved');
assert(!competitive.includes('PDF found'), 'PDF extraction status should not exist');
assert(!competitive.includes('Text extracted'), 'text extraction status should not exist');

assert(css.includes('Stage 18E: evidence UI cards'), 'stage 18E css missing');
assert(css.includes('.competitive-evidence-card'), 'evidence card CSS missing');
assert(css.includes('.competitive-ranking-table'), 'ranking table CSS missing');
assert(css.includes('overflow-x: auto'), 'ranking table horizontal scroll missing');

assert(prompt.includes('Evidence UI Support'), 'prompt role update missing');
assert(prompt.includes('Stage 18E workflow expectation'), 'prompt stage 18E expectation missing');
assert(prompt.includes('frontend should warn'), 'prompt evidence warning instruction missing');
assert(prompt.includes('latexai_actionable_edits'), 'actionable edit JSON prompt must be preserved');

console.log('stage18e competitive review evidence UI/cache controls static checks passed');
