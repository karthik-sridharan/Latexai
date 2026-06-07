const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const index = read('index.html');
const aiProvider = read('js/ai-provider.js');
const registry = read('js/model-registry-service.js');
const routing = read('js/model-provider-service.js');
const inspector = read('js/ai-routing-inspector-service.js');
const competitive = read('js/competitive-paper-review-service.js');
const devils = read('js/devils-advocate-debate-service.js');
const backend = read('backend/server.mjs');

assert(index.includes('stage18a-model-routing-audit-validation-lock'), 'index stage marker missing');
assert(index.includes('js/model-registry-service.js?v=stage18a-model-routing-audit-validation-lock-1'), 'model registry script missing/cachebuster missing');
assert(index.includes('js/model-provider-service.js?v=stage18a-model-routing-audit-validation-lock-1'), 'model routing script missing/cachebuster missing');
assert(index.includes('css/lai-stage18a-model-registry.css?v=stage18a-model-routing-audit-validation-lock-1'), 'model registry CSS missing');

for (const key of ['competitive-ranking', 'competitive-improvement', 'debate-advocate', 'debate-critic', 'debate-synthesizer', 'slide-repair']) {
  assert(registry.includes(`key: '${key}'`) || registry.includes(`'${key}':`) || registry.includes(key), `registry missing route ${key}`);
  assert(routing.includes(`'${key}'`) || routing.includes(key), `routing missing route ${key}`);
  assert(inspector.includes(key), `inspector missing route/workflow ${key}`);
}

assert(aiProvider.includes('validateRequestModel'), 'AIProvider validateRequestModel missing');
assert(aiProvider.includes('modelRoutingAudit'), 'AIProvider request audit metadata missing');
assert(aiProvider.includes('routeKeyForAsk'), 'AIProvider route key resolver missing');
assert(aiProvider.includes('NS.ModelRegistryService?.validateProviderModel'), 'AIProvider not using registry validation');

assert(routing.includes('function routeForTask'), 'ModelRoutingService routeForTask missing');
assert(routing.includes('modelRoutingBypass'), 'ModelRoutingService bypass support missing');
assert(routing.includes('routingReport'), 'ModelRoutingService report missing');

assert(competitive.includes("routeKey: 'competitive-improvement'"), 'Competitive review ask does not carry competitive-improvement route key');
assert(competitive.includes('validateRequestModel?.(\n        currentAiProvider(),\n        currentAiModel(),'), 'Competitive review validation signature is not the safe provider/model/payload/meta call');

assert(devils.includes('routeKeyForRole'), 'Devils advocate routeKeyForRole missing');
assert(devils.includes("'debate-advocate'"), 'Devils advocate supporter route missing');
assert(devils.includes("'debate-critic'"), 'Devils advocate critic route missing');
assert(devils.includes("'debate-synthesizer'"), 'Devils advocate synthesizer route missing');
assert(devils.includes('modelRoutingBypass: true'), 'Devils advocate per-agent bypass missing');
assert(devils.includes('data-agent-model'), 'Devils advocate model select rows missing');

assert(backend.includes('normalizeAllowedModel'), 'Backend normalizeAllowedModel missing');
assert(backend.includes('/api/lumina/models'), 'Backend model listing endpoint missing');
assert(backend.includes('/api/lumina/ai/status'), 'Backend AI status endpoint missing');
assert(backend.includes('modelFallback'), 'Backend response does not expose modelFallback audit');
assert(backend.includes('Unsupported model for ${provider}: ${raw}; using ${fallback}'), 'Backend unsupported model repair message missing');

console.log('stage18a model routing audit validation lock static checks passed');
