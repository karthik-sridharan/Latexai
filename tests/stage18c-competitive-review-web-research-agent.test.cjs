const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const index = read('index.html');
const competitive = read('js/competitive-paper-review-service.js');
const prompt = read('prompt/ai-competitive-paper-review.txt');

assert(index.includes('latex-stage18c-competitive-review-web-research-agent-20260521-1'), 'index stage marker missing');
assert(index.includes('js/competitive-paper-review-service.js?v=stage18c-competitive-review-web-research-agent-1'), 'competitive service cachebuster missing');
assert(index.includes('css/lai-stage16b-competitive-review.css?v=stage18c-competitive-review-web-research-agent-1'), 'competitive CSS cachebuster missing');

assert(competitive.includes("const STAGE = 'stage18c-competitive-review-web-research-agent-1'"), 'service stage constant missing');
assert(competitive.includes("URL_CACHE_KEY = 'latexai:competitive-web-research-profile-cache:v1'"), 'web research cache key missing');
assert(competitive.includes("schema: 'latexai-competitive-web-research-review-request-v1'"), 'web research request schema missing');
assert(competitive.includes("workflow: 'competitive-web-review'"), 'competitive web-review workflow missing');
assert(competitive.includes("researchMode: 'web-search-agent-no-pdf-extraction'"), 'no-pdf-extraction research mode missing');
assert(competitive.includes('function researchCompetitorPapers'), 'research step missing');
assert(competitive.includes('Research competitor papers'), 'research button label missing');
assert(competitive.includes('2. Web research'), 'workflow web research label missing');
assert(competitive.includes('latexai_competitor_research_profiles'), 'research profile JSON contract missing');
assert(competitive.includes('requiredTools: [\'web_search\']'), 'web search tool requirement missing');
assert(competitive.includes('sourcesConsulted'), 'sources consulted field missing');
assert(competitive.includes('rankingEffect'), 'rankingEffect must be preserved');
assert(competitive.includes('insertActionableEditsAtMatches'), 'actionable lai insertion must be preserved');
assert(competitive.includes('refreshPaperAiReview'), 'paper-level review refresh must be preserved');

assert(!competitive.includes('Fetch / extract papers'), 'old fetch/extract button label remains');
assert(!competitive.includes('2. Fetch/extract'), 'old fetch/extract workflow label remains');
assert(!competitive.includes('PDF found'), 'PDF found status should not exist');
assert(!competitive.includes('Text extracted'), 'text extracted status should not exist');
assert(!competitive.includes('Pages extracted'), 'pages extracted status should not exist');

assert(prompt.includes('Stage 18C workflow expectation'), 'prompt stage 18C instructions missing');
assert(prompt.includes('Treat competitor URLs as seeds for web search and source discovery'), 'prompt seed policy missing');
assert(prompt.includes('Do not ask Latexai to download or extract PDFs'), 'prompt no-pdf-extraction policy missing');
assert(prompt.includes('Sources consulted'), 'prompt sources consulted requirement missing');
assert(prompt.includes('latexai_actionable_edits'), 'actionable edit JSON prompt missing');

console.log('stage18c competitive review web research agent static checks passed');
