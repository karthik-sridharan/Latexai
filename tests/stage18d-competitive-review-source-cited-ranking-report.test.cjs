const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const index = read('index.html');
const competitive = read('js/competitive-paper-review-service.js');
const prompt = read('prompt/ai-competitive-paper-review.txt');

assert(index.includes('latex-stage18d-competitive-review-source-cited-ranking-report-20260521-1'), 'index stage marker missing');
assert(index.includes('js/competitive-paper-review-service.js?v=stage18d-competitive-review-source-cited-ranking-report-1'), 'competitive service cachebuster missing');
assert(competitive.includes("const STAGE = 'stage18d-competitive-review-source-cited-ranking-report-1'"), 'stage constant missing');
assert(competitive.includes("URL_CACHE_KEY = 'latexai:competitive-web-research-profile-cache:v2'"), 'v2 web research cache key missing');
assert(competitive.includes('let lastSourceLedger = []'), 'source ledger state missing');
assert(competitive.includes('function buildSourceLedger'), 'source ledger builder missing');
assert(competitive.includes('function sourceCoverage'), 'source coverage function missing');
assert(competitive.includes('function sourcesMarkdown'), 'source markdown function missing');
assert(competitive.includes('function refreshEvidenceState'), 'evidence dashboard refresh missing');
assert(competitive.includes('competitorSourceLedger: lastSourceLedger'), 'payload source ledger missing');
assert(competitive.includes('evidenceCoverage: lastEvidenceCoverage'), 'payload evidence coverage missing');
assert(competitive.includes('Every substantive claim in the ranking rationale must cite one or more source IDs like [S1]'), 'ranking source-id instruction missing');
assert(competitive.includes('--- Numbered source ledger; cite these IDs in the ranking ---'), 'ranking input source ledger missing');
assert(competitive.includes('Source evidence ledger'), 'saved report source ledger section missing');
assert(competitive.includes('Evidence coverage'), 'saved report evidence coverage section missing');
assert(competitive.includes('competitiveEvidenceStatus'), 'evidence status UI missing');
assert(competitive.includes('Generate source-cited roadmap'), 'source-cited roadmap button label missing');
assert(competitive.includes('Run full cited review'), 'full cited review button label missing');
assert(competitive.includes('sourceRecords'), 'structured sourceRecords contract missing');
assert(competitive.includes('requiredTools: [\'web_search\']'), 'web search tool requirement must be preserved');
assert(competitive.includes('insertActionableEditsAtMatches'), 'actionable lai insertion must be preserved');
assert(!competitive.includes('PDF found'), 'PDF extraction status should not exist');
assert(!competitive.includes('Text extracted'), 'text extraction status should not exist');

assert(prompt.includes('Source-Cited Web Research Agent'), 'prompt source-cited role missing');
assert(prompt.includes('Stage 18D workflow expectation'), 'prompt stage 18D expectation missing');
assert(prompt.includes('source ledger with stable source IDs'), 'prompt source ledger requirement missing');
assert(prompt.includes('cite source IDs like [S1]'), 'prompt source ID citation instruction missing');
assert(prompt.includes('Evidence coverage and limitations'), 'prompt evidence coverage section missing');
assert(prompt.includes('latexai_actionable_edits'), 'actionable edit JSON prompt must be preserved');

console.log('stage18d competitive review source-cited ranking report static checks passed');
