import express from 'express';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { compileWithTexLive, detectTeXLive } from './providers/compile-texlive.mjs';
import { sandboxPolicyFromEnv } from './security/sandbox-policy.mjs';
import { validateCompilePayload, normalizeProjectPayload, safeProjectId, httpError } from './security/validate-project.mjs';

const STAGE = 'latex-stage18a-model-routing-audit-validation-lock-backend-20260521-1';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const PROVIDERS = new Set(['openai', 'anthropic', 'gemini']);
const PROJECTS = new Map();
const JOBS = new Map();
const JOB_TTL_MS = Number(process.env.COMPILE_JOB_TTL_MS || 15 * 60_000);
const RETURN_RAW = String(process.env.RETURN_RAW_PROVIDER_RESPONSE || 'false').toLowerCase() === 'true';
const OPENAI_WEB_SEARCH_ENABLED = String(process.env.OPENAI_WEB_SEARCH_ENABLED || 'true').toLowerCase() !== 'false';
const OPENAI_WEB_SEARCH_TOOL = process.env.OPENAI_WEB_SEARCH_TOOL || 'web_search';
const POLICY = sandboxPolicyFromEnv(process.env);

function envList(name, fallback = '') {
  return String(process.env[name] || fallback || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function hasProviderKey(provider) {
  if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  if (provider === 'anthropic') return Boolean(process.env.ANTHROPIC_API_KEY);
  if (provider === 'gemini') return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return false;
}

const DEFAULT_MODELS = {
  openai: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4.1-mini',
  anthropic: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-5',
  gemini: process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash'
};
const ALLOWED_MODELS = {
  openai: new Set(envList('OPENAI_ALLOWED_MODELS', DEFAULT_MODELS.openai)),
  anthropic: new Set(envList('ANTHROPIC_ALLOWED_MODELS', DEFAULT_MODELS.anthropic)),
  gemini: new Set(envList('GEMINI_ALLOWED_MODELS', DEFAULT_MODELS.gemini))
};
for (const provider of Object.keys(DEFAULT_MODELS)) ALLOWED_MODELS[provider].add(DEFAULT_MODELS[provider]);

const MODEL_CAPABILITY_HINTS = {
  openai: {
    'gpt-4.1-mini': { tier: 'fast', structuredJson: true, longContext: true, recommendedFor: ['default', 'paper', 'citation', 'presentation', 'figure', 'slide-repair', 'diagnostic', 'competitive-ranking', 'competitive-improvement', 'debate-advocate', 'debate-critic', 'debate-synthesizer'] },
    'gpt-4.1': { tier: 'strong', structuredJson: true, longContext: true, recommendedFor: ['paper', 'competitive-ranking', 'competitive-improvement', 'debate-critic', 'debate-synthesizer'] }
  },
  anthropic: {
    'claude-haiku-4-5': { tier: 'fast', structuredJson: true, longContext: true, recommendedFor: ['default', 'citation', 'diagnostic', 'debate-advocate'] },
    'claude-sonnet-4-5': { tier: 'strong', structuredJson: true, longContext: true, recommendedFor: ['paper', 'competitive-improvement', 'debate-critic', 'debate-synthesizer'] }
  },
  gemini: {
    'gemini-2.5-flash': { tier: 'fast', structuredJson: true, longContext: true, recommendedFor: ['default', 'citation', 'presentation', 'figure', 'slide-repair', 'diagnostic'] },
    'gemini-2.5-pro': { tier: 'strong', structuredJson: true, longContext: true, recommendedFor: ['paper', 'competitive-improvement', 'debate-critic', 'debate-synthesizer'] }
  }
};

const TASK_MODEL_ROUTES = {
  default: { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' },
  paper: { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' },
  citation: { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' },
  presentation: { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' },
  figure: { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' },
  'slide-repair': { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' },
  diagnostic: { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' },
  'competitive-ranking': { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' },
  'competitive-improvement': { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' },
  'debate-advocate': { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' },
  'debate-critic': { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' },
  'debate-synthesizer': { provider: 'openai', model: DEFAULT_MODELS.openai, preferredTier: 'fast' }
};

const MODEL_ALIASES = {
  openai: {
    'gpt-4.1 mini': 'gpt-4.1-mini',
    'gpt 4.1 mini': 'gpt-4.1-mini',
    'gpt-4o-mini': 'gpt-4.1-mini',
    'gpt-4.1-nano': 'gpt-4.1-mini'
  },
  anthropic: {
    'claude-sonnet': 'claude-sonnet-4-5',
    'claude-haiku': 'claude-haiku-4-5'
  },
  gemini: {
    'gemini-flash': 'gemini-2.5-flash',
    'gemini-pro': 'gemini-2.5-pro'
  }
};

function modelRegistryForProvider(provider) {
  return Array.from(ALLOWED_MODELS[provider] || []).map((model) => ({
    model,
    ...(MODEL_CAPABILITY_HINTS[provider]?.[model] || { tier: /mini|flash|haiku|small|lite/i.test(model) ? 'fast' : 'standard', structuredJson: true, longContext: null, recommendedFor: [] })
  }));
}

function modelRegistryStatus() {
  return {
    stage: 'stage18a-model-routing-audit-validation-lock-1',
    taskModelRoutes: TASK_MODEL_ROUTES,
    providerDefaults: DEFAULT_MODELS,
    providers: Object.fromEntries([...PROVIDERS].map((provider) => [provider, {
      configured: hasProviderKey(provider),
      defaultModel: DEFAULT_MODELS[provider],
      allowedModels: Array.from(ALLOWED_MODELS[provider] || []),
      models: modelRegistryForProvider(provider)
    }]))
  };
}

function normalizeAllowedModel(provider, model) {
  const allowed = ALLOWED_MODELS[provider] || new Set();
  const raw = String(model || DEFAULT_MODELS[provider] || '').trim();
  const alias = MODEL_ALIASES[provider]?.[raw.toLowerCase()];
  const candidate = alias || raw;
  if (candidate && allowed.has(candidate)) return { model: candidate, repaired: candidate !== raw, requestedModel: raw, reason: candidate !== raw ? `Alias ${raw} mapped to ${candidate}.` : '' };
  const fallback = allowed.has(DEFAULT_MODELS[provider]) ? DEFAULT_MODELS[provider] : Array.from(allowed)[0];
  if (!fallback) throw httpError(400, `No allowed models configured for ${provider}.`);
  if (raw && !allowed.has(raw)) return { model: fallback, repaired: true, requestedModel: raw, reason: `Unsupported model for ${provider}: ${raw}; using ${fallback}.` };
  return { model: fallback, repaired: Boolean(raw !== fallback), requestedModel: raw, reason: raw ? `Using ${fallback}.` : `No model supplied; using ${fallback}.` };
}

const COPILOT_WORKFLOWS = [
  { id: 'fix-error-patch', label: 'Fix current compile error as patch', output: 'lumina-latex-ai-patch-v1' },
  { id: 'explain-log', label: 'Explain compile log', output: 'text' },
  { id: 'rewrite-selection-patch', label: 'Rewrite selected LaTeX as patch', output: 'lumina-latex-ai-patch-v1' },
  { id: 'insert-section-patch', label: 'Draft section and insert', output: 'lumina-latex-ai-patch-v1' },
  { id: 'beamer-outline-patch', label: 'Create Beamer outline', output: 'lumina-latex-ai-patch-v1' },
  { id: 'table-helper-patch', label: 'Create table / align environment', output: 'lumina-latex-ai-patch-v1' },
  { id: 'raw-advice', label: 'General LaTeX advice', output: 'text' }
];

const ALLOWED_ORIGINS = envList('ALLOWED_ORIGINS', '');

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed: ${origin}`));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb' }));
function memoryRateLimit({ windowMs = 60_000, limit = 20 } = {}) {
  const hits = new Map();
  return function luminaMemoryRateLimit(req, res, next) {
    const now = Date.now();
    const key = String(req.ip || req.socket?.remoteAddress || 'unknown') + ':' + String(req.baseUrl || req.path || '');
    const entry = hits.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count += 1;
    hits.set(key, entry);
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > limit) {
      return res.status(429).json({
        ok: false,
        error: {
          message: 'Too many requests. Please wait before trying again.',
          retryAfterMs: Math.max(0, entry.resetAt - now)
        }
      });
    }
    return next();
  };
}

app.use('/api/lumina/ai', memoryRateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 20) }));
app.use('/api/lumina/latex/compile', memoryRateLimit({ windowMs: 60_000, limit: Number(process.env.COMPILE_RATE_LIMIT_PER_MINUTE || 10) }));

function requireProxyToken(req, res, next) {
  const token = process.env.LUMINA_PROXY_TOKEN || '';
  if (!token) return next();
  if (req.headers.authorization !== `Bearer ${token}`) return res.status(401).json({ ok: false, error: { message: 'Unauthorized proxy request.' } });
  return next();
}

app.get('/health', async (_req, res) => {
  const tex = await detectTeXLive(POLICY).catch((err) => ({ ok: false, error: err.message }));
  res.json({ ok: true, service: 'lumina-latex-backend', stage: STAGE, compileJobs: true, jobCount: JOBS.size, tex });
});

app.get('/api/lumina/latex/status', requireProxyToken, async (_req, res) => {
  const tex = await detectTeXLive(POLICY).catch((err) => ({ ok: false, error: err.message }));
  res.json({
    ok: !!tex.ok,
    schema: 'lumina-latex-backend-status-v1',
    stage: STAGE,
    service: 'lumina-latex-backend',
    compileJobs: true,
    synchronousCompile: true,
    events: 'sse',
    activeJobs: JOBS.size,
    policy: {
      runner: POLICY.runner,
      allowShellEscape: POLICY.allowShellEscape,
      compileTimeoutMs: POLICY.compileTimeoutMs,
      maxProjectBytes: POLICY.maxProjectBytes,
      maxFileCount: POLICY.maxFileCount,
      cleanupWorkspaces: POLICY.cleanupWorkspaces
    },
    tex
  });
});

app.get('/api/lumina/models', (_req, res) => {
  res.json({ ok: true, providers: Object.fromEntries(Object.entries(ALLOWED_MODELS).map(([provider, set]) => [provider, Array.from(set).map((model) => ({ model, ...(MODEL_CAPABILITY_HINTS[provider]?.[model] || {}) }))])) });
});

app.get('/api/lumina/ai/status', requireProxyToken, (_req, res) => {
  res.json({
    ok: true,
    schema: 'lumina-latex-ai-status-v1',
    stage: STAGE,
    taskModelRoutes: TASK_MODEL_ROUTES,
    modelRegistry: modelRegistryStatus(),
    allowedModels: Object.fromEntries(Object.entries(ALLOWED_MODELS).map(([provider, set]) => [provider, Array.from(set)])),
    providers: {
      openai: { configured: !!process.env.OPENAI_API_KEY, defaultModel: DEFAULT_MODELS.openai, allowedModels: Array.from(ALLOWED_MODELS.openai) },
      anthropic: { configured: !!process.env.ANTHROPIC_API_KEY, defaultModel: DEFAULT_MODELS.anthropic, allowedModels: Array.from(ALLOWED_MODELS.anthropic) },
      gemini: { configured: !!process.env.GEMINI_API_KEY, defaultModel: DEFAULT_MODELS.gemini, allowedModels: Array.from(ALLOWED_MODELS.gemini) }
    },
    workflows: COPILOT_WORKFLOWS,
    patchSchema: 'lumina-latex-ai-patch-v1',
    imageInputsForwarded: true,
    webSearch: {
      supported: true,
      enabled: OPENAI_WEB_SEARCH_ENABLED,
      defaultRequiredForCompetitiveReview: true,
      providers: {
        openai: {
          configured: !!process.env.OPENAI_API_KEY,
          supported: true,
          enabled: OPENAI_WEB_SEARCH_ENABLED,
          available: !!process.env.OPENAI_API_KEY && OPENAI_WEB_SEARCH_ENABLED,
          endpoint: 'responses',
          toolType: OPENAI_WEB_SEARCH_TOOL
        },
        anthropic: { supported: false, available: false },
        gemini: { supported: false, available: false }
      }
    },
    note: 'API keys remain backend-only. Browser requests must go through this proxy. Stage 10E preserves image inputs for vision-capable models.'
  });
});

app.get('/api/lumina/ai/workflows', requireProxyToken, (_req, res) => {
  res.json({ ok: true, schema: 'lumina-latex-ai-workflows-v1', stage: STAGE, workflows: COPILOT_WORKFLOWS });
});

app.post('/api/lumina/projects/:projectId', requireProxyToken, async (req, res) => {
  try {
    const projectId = safeProjectId(req.params.projectId);
    const project = normalizeProjectPayload(req.body?.project || req.body || {});
    project.projectId = projectId;
    project.id = project.id || projectId;
    const savedAt = new Date().toISOString();
    PROJECTS.set(projectId, { project, settings: req.body?.settings || project.settings || {}, savedAt });
    res.json({ ok: true, schema: 'lumina-latex-project-save-response-v1', projectId, savedAt });
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/lumina/projects/:projectId', requireProxyToken, async (req, res) => {
  try {
    const projectId = safeProjectId(req.params.projectId);
    const entry = PROJECTS.get(projectId);
    if (!entry) throw httpError(404, `Project not found in memory store: ${projectId}`);
    res.json({ ok: true, schema: 'lumina-latex-project-load-response-v1', projectId, ...entry });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/lumina/latex/compile/jobs', requireProxyToken, async (req, res) => {
  try {
    const payload = validateCompilePayload(req.body || {}, { maxProjectBytes: POLICY.maxProjectBytes, maxFileCount: POLICY.maxFileCount });
    const job = createJob(payload);
    res.status(202)
      .location(`/api/lumina/latex/compile/jobs/${job.jobId}`)
      .json(jobPublic(job, { includeResult: false, message: 'Compile job accepted.' }));
    queueMicrotask(() => runCompileJob(job).catch((err) => failJob(job, err)));
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/lumina/latex/compile/jobs/:jobId', requireProxyToken, (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    res.json(jobPublic(job, { includeResult: true }));
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/lumina/latex/compile/jobs/:jobId/events', requireProxyToken, (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const send = (event) => res.write(`event: ${event.type || 'status'}\ndata: ${JSON.stringify(jobPublic(job, { includeResult: event.final }))}\n\n`);
    send({ type: 'status', final: isFinalStatus(job.status) });
    const listener = (event) => send(event);
    job.listeners.add(listener);
    req.on('close', () => job.listeners.delete(listener));
  } catch (err) {
    sendError(res, err);
  }
});

app.delete('/api/lumina/latex/compile/jobs/:jobId', requireProxyToken, (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    job.cancelRequested = true;
    if (job.child) job.child.kill('SIGKILL');
    updateJob(job, { status: 'canceled', progress: 100, message: 'Compile canceled by user.', finishedAt: new Date().toISOString() }, true);
    res.json(jobPublic(job, { includeResult: true }));
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/lumina/latex/compile', requireProxyToken, async (req, res) => {
  try {
    const payload = validateCompilePayload(req.body || {}, { maxProjectBytes: POLICY.maxProjectBytes, maxFileCount: POLICY.maxFileCount });
    const result = await compileWithTexLive(payload, { policy: POLICY, stage: STAGE, onEvent: () => {} });
    res.status(result.ok ? 200 : 422).json(result);
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/ws/lumina/projects/:projectId', (_req, res) => {
  res.status(426).json({
    ok: false,
    schema: 'lumina-latex-sync-event-v1',
    stage: STAGE,
    message: 'WebSocket project sync remains reserved. Stage 1E uses HTTP project sync plus SSE compile job events; this endpoint is reserved for Stage 2 collaboration.'
  });
});

app.post('/api/lumina/ai', requireProxyToken, async (req, res) => {
  try {
    const requestBody = req.body || {};
    const { provider, model, modelFallback } = pickProviderAndModel(requestBody);
    const payload = (requestBody.task === 'latex-document-ai' || requestBody.payload?.documentAi)
      ? await normalizeDocumentAiPayload(requestBody)
      : normalizeAiPayload(requestBody);
    if (payload.webSearchRequired && provider !== 'openai') {
      throw httpError(400, 'Web search is required for this workflow. Choose an OpenAI backend/model with web search enabled.');
    }
    if (payload.webSearchRequired && !OPENAI_WEB_SEARCH_ENABLED) {
      throw httpError(400, 'Web search is required for this workflow, but OPENAI_WEB_SEARCH_ENABLED is false on the backend.');
    }

    let result;
    if (provider === 'openai') result = await callOpenAi(model, payload);
    else if (provider === 'anthropic') result = await callAnthropic(model, payload);
    else result = await callGemini(model, payload);
    res.json({
      ok: true,
      schema: 'lumina-latex-ai-response-v1',
      stage: STAGE,
      provider,
      model,
      task: requestBody.task || 'latex-copilot',
      documentAi: payload.documentAi,
      text: result.text,
      webSearchRequired: payload.webSearchRequired,
      webSearchEnabled: !!result.webSearchEnabled,
      modelFallback,
      raw: RETURN_RAW ? result.raw : undefined
    });
  } catch (err) {
    sendError(res, err);
  }
});

function createJob(payload) {
  const now = new Date().toISOString();
  const job = {
    ok: true,
    schema: 'lumina-latex-compile-job-response-v1',
    jobId: `compile-${randomUUID()}`,
    status: 'queued',
    progress: 10,
    message: 'Compile job queued.',
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
    payload,
    log: '',
    result: null,
    child: null,
    cancelRequested: false,
    listeners: new Set()
  };
  JOBS.set(job.jobId, job);
  return job;
}

async function runCompileJob(job) {
  updateJob(job, { status: 'running', progress: 18, message: 'Preparing compile runner.' });
  const result = await compileWithTexLive(job.payload, {
    policy: POLICY,
    stage: STAGE,
    job,
    onEvent(event = {}) {
      if (event.logChunk) job.log = trimLog(job.log + event.logChunk);
      updateJob(job, { status: 'running', progress: event.progress ?? job.progress, message: event.message || job.message });
    }
  });
  job.result = result;
  job.log = trimLog(result.log || job.log || '');
  updateJob(job, { status: result.ok ? 'succeeded' : 'failed', progress: 100, message: result.ok ? 'PDF compile completed.' : 'Compile failed. Review diagnostics.', finishedAt: new Date().toISOString() }, true);
}

function failJob(job, err) {
  const message = err.message || String(err);
  job.result = { ok: false, schema: 'lumina-latex-compile-response-v1', stage: STAGE, jobId: job.jobId, log: `${job.log || ''}\n[backend error] ${message}`, problems: [{ level: 'error', message, line: null }] };
  job.log = trimLog(job.result.log);
  updateJob(job, { status: 'error', progress: 100, message, finishedAt: new Date().toISOString() }, true);
}

function jobPublic(job, options = {}) {
  return {
    ok: true,
    schema: 'lumina-latex-compile-job-response-v1',
    stage: STAGE,
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    message: options.message || job.message,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt,
    rootFile: job.payload?.rootFile,
    engine: job.payload?.engine,
    log: trimLog(job.log || job.result?.log || ''),
    result: options.includeResult && job.result ? { ...job.result, log: trimLog(job.result.log || '') } : undefined,
    statusUrl: `/api/lumina/latex/compile/jobs/${job.jobId}`,
    eventsUrl: `/api/lumina/latex/compile/jobs/${job.jobId}/events`
  };
}

function getJob(jobId) {
  const id = String(jobId || '').trim();
  const job = JOBS.get(id);
  if (!job) throw httpError(404, `Compile job not found: ${id}`);
  return job;
}

function updateJob(job, patch, final = false) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  for (const listener of Array.from(job.listeners)) {
    try { listener({ type: final ? 'final' : 'status', final }); } catch (_err) { job.listeners.delete(listener); }
  }
}

function isFinalStatus(status) {
  return ['succeeded', 'failed', 'canceled', 'error'].includes(status);
}

function trimLog(value) {
  const text = String(value || '');
  const maxBytes = POLICY.maxLogBytes || 180_000;
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  return text.slice(-maxBytes);
}

function pickProviderAndModel(body) {
  const provider = String(body.provider || 'openai').trim().toLowerCase();
  if (!PROVIDERS.has(provider)) throw httpError(400, `Unsupported provider: ${provider}`);
  const decision = normalizeAllowedModel(provider, body.model || DEFAULT_MODELS[provider]);
  return { provider, model: decision.model, modelFallback: decision.repaired ? decision : null };
}

function hasImageContent(value) {
  if (!value) return false;
  if (typeof value === 'string') return value.startsWith('data:image/');
  if (Array.isArray(value)) return value.some(hasImageContent);
  if (typeof value === 'object') {
    if (value.type === 'input_image' || value.type === 'image_url') return true;
    if (typeof value.image_url === 'string' && value.image_url.startsWith('data:image/')) return true;
    if (typeof value.image_url?.url === 'string' && value.image_url.url.startsWith('data:image/')) return true;
    if (typeof value.dataUrl === 'string' && value.dataUrl.startsWith('data:image/')) return true;
    return Object.values(value).some(hasImageContent);
  }
  return false;
}

function aiInputToText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(aiInputToText).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.input_text === 'string') return value.input_text;
    if (Array.isArray(value.content)) return aiInputToText(value.content);
    if (Array.isArray(value.parts)) return aiInputToText(value.parts);
  }
  return '';
}

function chatMessagesToResponsesInput(messages) {
  if (!Array.isArray(messages)) return null;
  return messages.map((message) => {
    const role = message.role || 'user';
    const rawContent = Array.isArray(message.content) ? message.content : [{ type: 'text', text: String(message.content || '') }];
    const content = rawContent.map((part) => {
      if (part.type === 'image_url') {
        const url = typeof part.image_url === 'string' ? part.image_url : part.image_url?.url;
        return { type: 'input_image', image_url: url };
      }
      if (part.type === 'text') return { type: 'input_text', text: String(part.text || '') };
      if (part.type === 'input_text' || part.type === 'input_image') return part;
      return typeof part.text === 'string' ? { type: 'input_text', text: part.text } : part;
    }).filter((part) => part && (part.type !== 'input_image' || part.image_url));
    return { role, content };
  });
}


const DOCUMENT_AI_PROMPT_FILES = {
  common: 'ai-document-common.txt',
  review: 'ai-review-and-suggestions.txt',
  remake: 'ai-total-remake-plan.txt',
  ranking: 'ai-ranking-acceptance-improver.txt',
  competitive: 'ai-competitive-agent-improver.txt'
};

const DOCUMENT_AI_DEFAULT_PROMPTS = {
  common: `You are Latexai document-level AI.

Operate on the full LaTeX paper context provided by the frontend.

Current implementation mode:
- Stage 11C is append-only.
- Do not rewrite the paper in place.
- Return LaTeX content for a final appendix/review section only.

Output rules:
- Return LaTeX only.
- Do not use Markdown fences.
- Do not return JSON.
- Do not include \\documentclass, \\begin{document}, or \\end{document}.
- Use concrete section/subsection headings, bullet lists, and actionable suggestions.

User instructions:
{{USER_INSTRUCTIONS}}

Requested mode:
{{MODE}}

Selected workflow:
{{WORKFLOW}}

Root file:
{{ROOT_FILE}}`,

  review: `Workflow: Review and suggested improvements.

Critically review the paper as a strong technical reviewer.
Focus on clarity, correctness, missing definitions, proof gaps, citation gaps, organization, notation, and concrete edits.
Return a LaTeX section with prioritized, actionable suggestions.`,

  remake: `Workflow: Total remake plan.

Propose a large-scale remake of the paper: ideal narrative, reordered sections, what to merge/split/expand, how to frame the main result, and a step-by-step rewrite plan.
Return a LaTeX section that is a complete remake plan, not a direct rewrite of the paper.`,

  ranking: `Workflow: Ranking / acceptance improver.

Improve the paper's chance at a strong venue.
Focus on likely reviewer objections, low-score risks, claims needing evidence, presentation changes, missing experiments/examples/comparisons/citations, and the highest-impact fixes.
Return a LaTeX section with ranked recommendations.`,

  competitive: `Workflow: Competitive agent improver.

Simulate a committee of agents:
1. A critic attacks the paper.
2. An improver proposes fixes.
3. A mathematical clarity checker reviews definitions, assumptions, statements, and proofs.
4. A strategist summarizes the highest-impact changes.
Return a LaTeX section organized by these agents, followed by a consolidated action plan.`
};

function workflowLabel(workflow) {
  return {
    review: 'Review and suggested improvements',
    remake: 'Total remake plan',
    ranking: 'Ranking / acceptance improver',
    competitive: 'Competitive agent improver'
  }[workflow] || 'Review and suggested improvements';
}

function templateFill(template, values = {}) {
  let out = String(template || '');
  for (const [key, value] of Object.entries(values)) {
    out = out.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'gi'), String(value ?? ''));
  }
  return out;
}

async function readDeveloperPrompt(kind) {
  const key = DOCUMENT_AI_PROMPT_FILES[kind] ? kind : 'review';
  const filename = DOCUMENT_AI_PROMPT_FILES[key];
  const promptDir = process.env.LATEXAI_PROMPT_DIR || join(__dirname, 'prompt');
  try {
    const text = await readFile(join(promptDir, filename), 'utf8');
    return text.trim() ? text : DOCUMENT_AI_DEFAULT_PROMPTS[key];
  } catch (_err) {
    return DOCUMENT_AI_DEFAULT_PROMPTS[key];
  }
}

async function normalizeDocumentAiPayload(body) {
  const payload = body.payload || {};
  const doc = payload.documentAi || {};
  const workflow = DOCUMENT_AI_PROMPT_FILES[doc.workflow] ? doc.workflow : 'review';
  const mode = String(doc.mode || 'append');
  const userInstructions = String(doc.userInstructions || '');
  const rootPath = String(doc.rootPath || 'main.tex');
  const projectContext = String(doc.projectContext || payload.input || payload.textInput || '');
  if (!projectContext.trim()) throw httpError(400, 'Missing document AI project context.');

  const values = {
    USER_INSTRUCTIONS: userInstructions || '(none)',
    MODE: mode,
    WORKFLOW: workflowLabel(workflow),
    WORKFLOW_KEY: workflow,
    ROOT_FILE: rootPath,
    PROMPT_FILE: DOCUMENT_AI_PROMPT_FILES[workflow]
  };

  const common = templateFill(await readDeveloperPrompt('common'), values);
  const workflowPrompt = templateFill(await readDeveloperPrompt(workflow), values);

  const input = [
    common,
    '',
    '--- Workflow-specific developer prompt ---',
    workflowPrompt,
    '',
    '--- Project context follows ---',
    projectContext
  ].join('\n');

  const maxOutputTokens = Math.max(256, Math.min(Number(payload.maxOutputTokens || payload.max_output_tokens || 5000), 64000));
  const temperature = typeof payload.temperature === 'number' && Number.isFinite(payload.temperature) ? Math.max(0, Math.min(payload.temperature, 2)) : 0.2;
  return {
    system: String(payload.instructions || 'Return LaTeX only. No markdown fences. No JSON.'),
    input,
    textInput: input,
    hasImages: false,
    maxOutputTokens,
    temperature,
    documentAi: {
      workflow,
      mode,
      promptDirectory: process.env.LATEXAI_PROMPT_DIR || join(__dirname, 'prompt'),
      commonPromptFile: DOCUMENT_AI_PROMPT_FILES.common,
      workflowPromptFile: DOCUMENT_AI_PROMPT_FILES[workflow]
    }
  };
}

function normalizeAiPayload(body) {
  const payload = body.payload || {};
  const system = String(payload.instructions || payload.system || 'You are Lumina LaTeX Copilot. Return directly usable LaTeX or concise advice.');

  // Stage 10E: preserve multimodal input arrays. The old code did
  // String(payload.input), turning image payloads into "[object Object]" and
  // causing the model to report that no image was provided.
  let input = payload.input;
  if (input === undefined || input === null || input === '') {
    input = chatMessagesToResponsesInput(payload.messages) || payload.textInput || payload.prompt || payload.userPrompt || '';
  }
  if (!Array.isArray(input) && payload.messages && hasImageContent(payload.messages)) {
    input = chatMessagesToResponsesInput(payload.messages) || input;
  }

  const textInput = aiInputToText(input) || String(payload.textInput || payload.prompt || payload.userPrompt || '');
  const hasImages = hasImageContent(input) || hasImageContent(payload.messages) || hasImageContent(payload.image);
  if (!textInput.trim() && !hasImages) throw httpError(400, 'Missing AI input prompt.');

  const maxOutputTokens = Math.max(256, Math.min(Number(payload.maxOutputTokens || payload.max_output_tokens || 3500), 64000));
  const temperature = typeof payload.temperature === 'number' && Number.isFinite(payload.temperature) ? Math.max(0, Math.min(payload.temperature, 2)) : 0.25;
  const webSearchRequired = Boolean(
    body.webSearchRequired ||
    body.context?.requireWebSearch ||
    body.context?.workflow === 'competitive-paper-review-web-search' ||
    payload.webSearchRequired ||
    payload.requireWebSearch ||
    payload.competitiveReview?.requireWebSearch ||
    (Array.isArray(payload.requiredTools) && payload.requiredTools.includes('web_search'))
  );
  return { system, input, textInput, hasImages, maxOutputTokens, temperature, webSearchRequired };
}

async function callOpenAi(model, payload) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw httpError(500, 'OPENAI_API_KEY is not set on backend.');
  const requestBody = {
    model,
    instructions: payload.system,
    input: payload.input,
    temperature: payload.temperature,
    max_output_tokens: payload.maxOutputTokens
  };
  if (payload.webSearchRequired) {
    requestBody.tools = [{ type: OPENAI_WEB_SEARCH_TOOL }];
    requestBody.tool_choice = 'auto';
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(requestBody)
  });
  const data = await response.json();
  if (!response.ok) throw httpError(response.status, data?.error?.message || 'OpenAI request failed.');
  return { text: extractOpenAiText(data), raw: data, webSearchEnabled: !!payload.webSearchRequired };
}

async function callAnthropic(model, payload) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw httpError(500, 'ANTHROPIC_API_KEY is not set on backend.');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, system: payload.system, messages: [{ role: 'user', content: payload.textInput || aiInputToText(payload.input) }], temperature: payload.temperature, max_tokens: payload.maxOutputTokens })
  });
  const data = await response.json();
  if (!response.ok) throw httpError(response.status, data?.error?.message || 'Anthropic request failed.');
  return { text: extractAnthropicText(data), raw: data };
}

async function callGemini(model, payload) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw httpError(500, 'GEMINI_API_KEY is not set on backend.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: payload.system }] }, contents: [{ role: 'user', parts: [{ text: payload.textInput || aiInputToText(payload.input) }] }], generationConfig: { temperature: payload.temperature, maxOutputTokens: payload.maxOutputTokens } })
  });
  const data = await response.json();
  if (!response.ok) throw httpError(response.status, data?.error?.message || 'Gemini request failed.');
  return { text: extractGeminiText(data), raw: data };
}

function extractOpenAiText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  return (data?.output || []).flatMap((item) => item?.content || []).map((c) => c?.text || '').filter(Boolean).join('\n').trim();
}
function extractAnthropicText(data) {
  return (data?.content || []).map((item) => item?.text || '').filter(Boolean).join('\n').trim();
}
function extractGeminiText(data) {
  return (data?.candidates || []).flatMap((c) => c?.content?.parts || []).map((p) => p?.text || '').filter(Boolean).join('\n').trim();
}

function sendError(res, err) {
  const status = err.status || 500;
  res.status(status).json({ ok: false, stage: STAGE, error: { message: err.message || String(err) } });
}

setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of JOBS) {
    if (isFinalStatus(job.status) && now - Date.parse(job.updatedAt || job.createdAt) > JOB_TTL_MS) JOBS.delete(jobId);
  }
}, Math.min(JOB_TTL_MS, 60_000)).unref?.();

app.use((err, _req, res, _next) => sendError(res, err));

app.listen(PORT, () => {
  console.log(`Lumina LaTeX backend ${STAGE} listening on http://localhost:${PORT}`);
  console.log(`Compile runner=${POLICY.runner}; shellEscape=${POLICY.allowShellEscape}; timeoutMs=${POLICY.compileTimeoutMs}`);
});
