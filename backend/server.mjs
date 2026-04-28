import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { compileWithTexLive, detectTeXLive } from './providers/compile-texlive.mjs';
import { sandboxPolicyFromEnv } from './security/sandbox-policy.mjs';
import { validateCompilePayload, normalizeProjectPayload, safeProjectId, httpError } from './security/validate-project.mjs';

const STAGE = 'latex-stage1e-copilot-workflows-20260428-1';
const app = express();
const PORT = Number(process.env.PORT || 3000);
const PROVIDERS = new Set(['openai', 'anthropic', 'gemini']);
const PROJECTS = new Map();
const JOBS = new Map();
const JOB_TTL_MS = Number(process.env.COMPILE_JOB_TTL_MS || 15 * 60_000);
const RETURN_RAW = String(process.env.RETURN_RAW_PROVIDER_RESPONSE || 'false').toLowerCase() === 'true';
const POLICY = sandboxPolicyFromEnv(process.env);

function envList(name, fallback = '') {
  return String(process.env[name] || fallback || '').split(',').map((s) => s.trim()).filter(Boolean);
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
app.use('/api/lumina/ai', rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 20), standardHeaders: true, legacyHeaders: false }));
app.use('/api/lumina/latex/compile', rateLimit({ windowMs: 60_000, limit: Number(process.env.COMPILE_RATE_LIMIT_PER_MINUTE || 10), standardHeaders: true, legacyHeaders: false }));

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
  res.json({ ok: true, providers: Object.fromEntries(Object.entries(ALLOWED_MODELS).map(([provider, set]) => [provider, Array.from(set).map((model) => ({ model }))])) });
});

app.get('/api/lumina/ai/status', requireProxyToken, (_req, res) => {
  res.json({
    ok: true,
    schema: 'lumina-latex-ai-status-v1',
    stage: STAGE,
    providers: {
      openai: { configured: !!process.env.OPENAI_API_KEY, defaultModel: DEFAULT_MODELS.openai, allowedModels: Array.from(ALLOWED_MODELS.openai) },
      anthropic: { configured: !!process.env.ANTHROPIC_API_KEY, defaultModel: DEFAULT_MODELS.anthropic, allowedModels: Array.from(ALLOWED_MODELS.anthropic) },
      gemini: { configured: !!process.env.GEMINI_API_KEY, defaultModel: DEFAULT_MODELS.gemini, allowedModels: Array.from(ALLOWED_MODELS.gemini) }
    },
    workflows: COPILOT_WORKFLOWS,
    patchSchema: 'lumina-latex-ai-patch-v1',
    note: 'API keys remain backend-only. Browser requests must go through this proxy.'
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
    const { provider, model } = pickProviderAndModel(req.body || {});
    const payload = normalizeAiPayload(req.body || {});
    let result;
    if (provider === 'openai') result = await callOpenAi(model, payload);
    else if (provider === 'anthropic') result = await callAnthropic(model, payload);
    else result = await callGemini(model, payload);
    res.json({ ok: true, schema: 'lumina-latex-ai-response-v1', stage: STAGE, provider, model, task: req.body?.task || 'latex-copilot', text: result.text, raw: RETURN_RAW ? result.raw : undefined });
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
  const model = String(body.model || DEFAULT_MODELS[provider]).trim();
  if (!ALLOWED_MODELS[provider].has(model)) throw httpError(400, `Unsupported model for ${provider}: ${model}`);
  return { provider, model };
}

function normalizeAiPayload(body) {
  const payload = body.payload || {};
  const system = String(payload.instructions || payload.system || 'You are Lumina LaTeX Copilot. Return directly usable LaTeX or concise advice.');
  const input = String(payload.input || payload.prompt || payload.userPrompt || '');
  if (!input.trim()) throw httpError(400, 'Missing AI input prompt.');
  const maxOutputTokens = Math.max(256, Math.min(Number(payload.maxOutputTokens || payload.max_output_tokens || 3500), 64000));
  const temperature = typeof payload.temperature === 'number' && Number.isFinite(payload.temperature) ? Math.max(0, Math.min(payload.temperature, 2)) : 0.25;
  return { system, input, maxOutputTokens, temperature };
}

async function callOpenAi(model, payload) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw httpError(500, 'OPENAI_API_KEY is not set on backend.');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, instructions: payload.system, input: payload.input, temperature: payload.temperature, max_output_tokens: payload.maxOutputTokens })
  });
  const data = await response.json();
  if (!response.ok) throw httpError(response.status, data?.error?.message || 'OpenAI request failed.');
  return { text: extractOpenAiText(data), raw: data };
}

async function callAnthropic(model, payload) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw httpError(500, 'ANTHROPIC_API_KEY is not set on backend.');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, system: payload.system, messages: [{ role: 'user', content: payload.input }], temperature: payload.temperature, max_tokens: payload.maxOutputTokens })
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
    body: JSON.stringify({ system_instruction: { parts: [{ text: payload.system }] }, contents: [{ role: 'user', parts: [{ text: payload.input }] }], generationConfig: { temperature: payload.temperature, maxOutputTokens: payload.maxOutputTokens } })
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
