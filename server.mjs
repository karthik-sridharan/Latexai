import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { mkdtemp, writeFile, readFile, rm, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, normalize, basename, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const STAGE = 'latex-stage16c-web-search-required-competitive-review-backend-20260521-1';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const PROVIDERS = new Set(['openai', 'anthropic', 'gemini']);
const ENGINES = new Set(['pdflatex', 'xelatex', 'lualatex', 'latexmk']);
const MAX_PROJECT_BYTES = Number(process.env.MAX_PROJECT_BYTES || 4_000_000);
const COMPILE_TIMEOUT_MS = Number(process.env.COMPILE_TIMEOUT_MS || 25_000);
const JOB_TTL_MS = Number(process.env.COMPILE_JOB_TTL_MS || 15 * 60_000);
const MAX_LOG_BYTES = Number(process.env.MAX_COMPILE_LOG_BYTES || 160_000);
const ALLOW_SHELL_ESCAPE = String(process.env.ALLOW_SHELL_ESCAPE || 'false').toLowerCase() === 'true';
const RETURN_RAW = String(process.env.RETURN_RAW_PROVIDER_RESPONSE || 'false').toLowerCase() === 'true';
const OPENAI_WEB_SEARCH_ENABLED = String(process.env.OPENAI_WEB_SEARCH_ENABLED || 'true').toLowerCase() !== 'false';
const OPENAI_WEB_SEARCH_TOOL = process.env.OPENAI_WEB_SEARCH_TOOL || 'web_search';
const PROJECTS = new Map();
const JOBS = new Map();

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

app.use(express.json({ limit: '8mb' }));
app.use('/api/lumina/ai', rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 20), standardHeaders: true, legacyHeaders: false }));
app.use('/api/lumina/latex/compile', rateLimit({ windowMs: 60_000, limit: Number(process.env.COMPILE_RATE_LIMIT_PER_MINUTE || 10), standardHeaders: true, legacyHeaders: false }));

function requireProxyToken(req, res, next) {
  const token = process.env.LUMINA_PROXY_TOKEN || '';
  if (!token) return next();
  if (req.headers.authorization !== `Bearer ${token}`) return res.status(401).json({ ok: false, error: { message: 'Unauthorized proxy request.' } });
  return next();
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'lumina-latex-backend',
    stage: STAGE,
    compileJobs: true,
    jobCount: JOBS.size,
    aiProxy: true,
    imageInputsForwarded: true,
    visionForwardingFix: true,
    documentAiPromptsInBackend: true
  });
});

app.get('/api/lumina/models', (_req, res) => {
  res.json({
    ok: true,
    providers: Object.fromEntries(Object.entries(ALLOWED_MODELS).map(([provider, set]) => [provider, Array.from(set).map((model) => ({ model }))]))
  });
});

app.get('/api/lumina/ai/status', requireProxyToken, (_req, res) => {
  res.json({
    ok: true,
    stage: STAGE,
    providerDefaults: DEFAULT_MODELS,
    providers: Object.fromEntries([...PROVIDERS].map((p) => [p, hasProviderKey(p)])),
    imageInputsForwarded: true,
    openaiVisionForwarding: true,
    documentAiPromptsInBackend: true,
    documentAiPromptDirectory: process.env.LATEXAI_PROMPT_DIR || join(__dirname, 'prompt'),
    acceptedImagePayloads: ['responses-input_image', 'chat-image_url', 'legacy-image-dataUrl'],
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
    }
  });
});

app.post('/api/lumina/projects/:projectId', requireProxyToken, async (req, res) => {
  try {
    const projectId = safeProjectId(req.params.projectId);
    const project = normalizeProjectPayload(req.body?.project || req.body || {});
    if ((project.projectId || project.id) && String(project.projectId || project.id) !== projectId) {
      project.projectId = projectId;
      project.id = project.id || projectId;
    }
    const savedAt = new Date().toISOString();
    PROJECTS.set(projectId, { project, settings: req.body?.settings || project.settings || {}, savedAt });
    res.json({ ok: true, schema: 'lumina-latex-project-save-response-v1', projectId, savedAt });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: { message: err.message || String(err) } });
  }
});

app.get('/api/lumina/projects/:projectId', requireProxyToken, async (req, res) => {
  try {
    const projectId = safeProjectId(req.params.projectId);
    const entry = PROJECTS.get(projectId);
    if (!entry) throw httpError(404, `Project not found in memory store: ${projectId}`);
    res.json({ ok: true, schema: 'lumina-latex-project-load-response-v1', projectId, ...entry });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: { message: err.message || String(err) } });
  }
});

app.post('/api/lumina/latex/compile/jobs', requireProxyToken, async (req, res) => {
  try {
    const payload = normalizeCompilePayload(req.body || {});
    const job = createJob(payload);
    res.status(202)
      .location(`/api/lumina/latex/compile/jobs/${job.jobId}`)
      .json(jobPublic(job, { includeResult: false, message: 'Compile job accepted.' }));
    queueMicrotask(() => runCompileJob(job).catch((err) => failJob(job, err)));
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: { message: err.message || String(err) } });
  }
});

app.get('/api/lumina/latex/compile/jobs/:jobId', requireProxyToken, (req, res) => {
  try {
    const job = getJob(req.params.jobId);
    res.json(jobPublic(job, { includeResult: true }));
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: { message: err.message || String(err) } });
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
    res.status(err.status || 500).json({ ok: false, error: { message: err.message || String(err) } });
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
    res.status(err.status || 500).json({ ok: false, error: { message: err.message || String(err) } });
  }
});

app.get('/ws/lumina/projects/:projectId', (_req, res) => {
  res.status(426).json({
    ok: false,
    schema: 'lumina-latex-sync-event-v1',
    stage: STAGE,
    message: 'WebSocket project sync remains reserved. Stage 1C uses HTTP/SSE compile job events and keeps the sync seam ready.'
  });
});

app.post('/api/lumina/ai', requireProxyToken, async (req, res) => {
  try {
    const requestBody = req.body || {};
    const { provider, model } = pickProviderAndModel(requestBody);
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
      provider,
      model,
      task: requestBody.task || 'latex-copilot',
      stage: STAGE,
      documentAi: payload.documentAi,
      text: result.text,
      webSearchRequired: payload.webSearchRequired,
      webSearchEnabled: !!result.webSearchEnabled,
      raw: RETURN_RAW ? result.raw : undefined
    });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: { message: err.message || String(err) } });
  }
});

app.post('/api/lumina/latex/compile', requireProxyToken, async (req, res) => {
  try {
    const payload = normalizeCompilePayload(req.body || {});
    const result = await compileProject(payload, () => {});
    res.status(result.ok ? 200 : 422).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: { message: err.message || String(err) } });
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
  updateJob(job, { status: 'running', progress: 18, message: 'Preparing isolated workspace.' });
  const result = await compileProject(job.payload, (event) => {
    if (event.logChunk) job.log = trimLog(job.log + event.logChunk);
    updateJob(job, { status: 'running', progress: event.progress ?? job.progress, message: event.message || job.message });
  }, job);
  job.result = result;
  job.log = trimLog(result.log || job.log || '');
  updateJob(job, { status: result.ok ? 'succeeded' : 'failed', progress: 100, message: result.ok ? 'PDF compile completed.' : 'Compile failed. Review diagnostics.', finishedAt: new Date().toISOString() }, true);
}

function updateJob(job, patch, final = false) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  for (const listener of Array.from(job.listeners)) {
    try { listener({ type: final ? 'final' : 'status', final }); } catch (_err) { job.listeners.delete(listener); }
  }
}

function failJob(job, err) {
  const message = err.message || String(err);
  job.result = { ok: false, schema: 'lumina-latex-compile-response-v1', jobId: job.jobId, log: `${job.log || ''}\n${message}`.trim(), problems: [{ level: 'error', message, line: null }], error: { message } };
  updateJob(job, { status: 'failed', progress: 100, message, finishedAt: new Date().toISOString() }, true);
}

function jobPublic(job, options = {}) {
  return {
    ok: true,
    schema: job.schema,
    stage: STAGE,
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    message: options.message || job.message,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt,
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

function isFinalStatus(status) {
  return ['succeeded', 'failed', 'canceled', 'error'].includes(status);
}

async function compileProject(body, onEvent = () => {}, job = null) {
  let workdir = null;
  try {
    const files = validateFiles(body.files || []);
    const rootFile = safeRelativePath(body.rootFile || 'main.tex');
    const root = files.find((f) => f.path === rootFile);
    if (!root) throw httpError(400, `Root file not found in project: ${rootFile}`);
    if (!root.path.endsWith('.tex')) throw httpError(400, 'Root file must be a .tex file.');
    const engine = String(body.engine || 'pdflatex').trim();
    if (!ENGINES.has(engine)) throw httpError(400, `Unsupported engine: ${engine}`);
    const wantsShellEscape = !!body.shellEscape;
    if (wantsShellEscape && !ALLOW_SHELL_ESCAPE) throw httpError(400, 'Shell escape requested but backend ALLOW_SHELL_ESCAPE=false.');

    workdir = await mkdtemp(join(tmpdir(), 'lumina-latex-'));
    onEvent({ progress: 25, message: 'Writing project files.' });
    for (const file of files) {
      const out = join(workdir, file.path);
      if (!out.startsWith(workdir)) throw httpError(400, `Unsafe file path: ${file.path}`);
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, file.text ?? '', 'utf8');
    }

    onEvent({ progress: 35, message: `Running ${engine}.` });
    const compileResult = await runCompile({ workdir, rootFile, engine, shellEscape: wantsShellEscape, onEvent, job });
    const pdfPath = join(workdir, replaceExt(rootFile, '.pdf'));
    let pdfBase64 = null;
    try {
      const st = await stat(pdfPath);
      if (st.isFile() && st.size > 0) pdfBase64 = (await readFile(pdfPath)).toString('base64');
    } catch (_err) {}

    const ok = !!pdfBase64 && compileResult.code === 0;
    return {
      ok,
      schema: 'lumina-latex-compile-response-v1',
      stage: STAGE,
      jobId: job?.jobId || null,
      projectName: body.projectName || '',
      rootFile,
      engine,
      pdfBase64,
      log: trimLog(compileResult.log),
      exitCode: compileResult.code,
      problems: parseCompileLog(compileResult.log)
    };
  } finally {
    if (workdir) rm(workdir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runCompile({ workdir, rootFile, engine, shellEscape, onEvent, job }) {
  const rootBase = basename(rootFile, '.tex');
  const dir = dirname(rootFile) === '.' ? workdir : join(workdir, dirname(rootFile));
  const rootName = basename(rootFile);
  const argsShell = shellEscape ? ['-shell-escape'] : ['-no-shell-escape'];
  let commands;
  if (engine === 'latexmk') {
    commands = [['latexmk', ['-pdf', '-interaction=nonstopmode', '-halt-on-error', ...argsShell, rootName]]];
  } else {
    commands = [
      [engine, ['-interaction=nonstopmode', '-halt-on-error', ...argsShell, rootName]],
      ['bibtex', [rootBase], { optional: true }],
      [engine, ['-interaction=nonstopmode', '-halt-on-error', ...argsShell, rootName]],
      [engine, ['-interaction=nonstopmode', '-halt-on-error', ...argsShell, rootName]]
    ];
  }
  let log = '';
  let finalCode = 0;
  for (let idx = 0; idx < commands.length; idx++) {
    if (job?.cancelRequested) return { code: 130, log: `${log}\n[canceled] Compile canceled before ${commands[idx][0]}.` };
    const [cmd, args, options = {}] = commands[idx];
    const progress = 42 + Math.round((idx / Math.max(commands.length, 1)) * 45);
    onEvent?.({ progress, message: `Running ${cmd} pass ${idx + 1}/${commands.length}.`, logChunk: `\n$ ${cmd} ${args.join(' ')}\n` });
    const result = await runCommand(cmd, args, dir, COMPILE_TIMEOUT_MS, options.optional, job);
    log = trimLog(`${log}\n$ ${cmd} ${args.join(' ')}\n${result.output}\n`);
    onEvent?.({ progress: Math.min(progress + 8, 92), message: `${cmd} pass complete.`, logChunk: result.output + '\n' });
    if (result.code !== 0 && !options.optional) {
      finalCode = result.code;
      break;
    }
  }
  return { code: finalCode, log };
}

function runCommand(cmd, args, cwd, timeoutMs, optional = false, job = null) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    if (job) job.child = child;
    let output = '';
    const timer = setTimeout(() => {
      output += `\n[timeout] Killed ${cmd} after ${timeoutMs}ms.\n`;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output = trimLog(output + chunk.toString()); });
    child.stderr.on('data', (chunk) => { output = trimLog(output + chunk.toString()); });
    child.on('error', (err) => {
      clearTimeout(timer);
      if (job && job.child === child) job.child = null;
      const message = optional && err.code === 'ENOENT' ? `[optional] ${cmd} not found.\n` : `[error] ${cmd}: ${err.message}\n`;
      resolve({ code: optional ? 0 : 127, output: message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (job && job.child === child) job.child = null;
      resolve({ code: code ?? 0, output });
    });
  });
}

function normalizeCompilePayload(body) {
  const files = validateFiles(body.files || []);
  const rootFile = safeRelativePath(body.rootFile || body.mainFile || 'main.tex');
  return {
    ...body,
    schema: body.schema || 'lumina-latex-compile-request-v1',
    rootFile,
    mainFile: rootFile,
    engine: body.engine || 'pdflatex',
    files,
    receivedAt: new Date().toISOString()
  };
}

function validateFiles(files) {
  if (!Array.isArray(files) || !files.length) throw httpError(400, 'No files supplied.');
  let bytes = 0;
  const out = [];
  const seen = new Set();
  for (const item of files) {
    const path = safeRelativePath(item.path);
    if (seen.has(path)) throw httpError(400, `Duplicate file path: ${path}`);
    seen.add(path);
    const text = String(item.text ?? item.content ?? '');
    bytes += Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_PROJECT_BYTES) throw httpError(413, `Project is larger than MAX_PROJECT_BYTES=${MAX_PROJECT_BYTES}.`);
    out.push({ path, text, kind: item.kind || fileKind(path) });
  }
  return out;
}

function safeProjectId(value) {
  const id = String(value || '').trim();
  if (!id || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(id)) throw httpError(400, 'Unsafe or empty project id.');
  return id;
}

function normalizeProjectPayload(project) {
  const p = project && typeof project === 'object' ? project : {};
  if (!Array.isArray(p.files) || !p.files.length) throw httpError(400, 'Project must include files.');
  return { ...p, schema: p.schema || 'lumina-latex-project-v1', updatedAt: new Date().toISOString() };
}

function safeRelativePath(path) {
  const p = normalize(String(path || '').replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!p || p === '.' || p.includes('..') || p.startsWith('/') || /^[a-zA-Z]:/.test(p)) throw httpError(400, `Unsafe or empty path: ${path}`);
  if (!/\.(tex|bib|sty|cls|txt|md|png|jpg|jpeg|pdf|eps)$/i.test(p)) throw httpError(400, `Unsupported file extension: ${p}`);
  return p;
}

function fileKind(path) {
  const lower = String(path || '').toLowerCase();
  if (lower.endsWith('.tex')) return 'tex';
  if (lower.endsWith('.bib')) return 'bib';
  if (lower.endsWith('.sty')) return 'sty';
  if (lower.endsWith('.cls')) return 'cls';
  if (/\.(png|jpg|jpeg|pdf|eps)$/i.test(lower)) return 'asset';
  return 'text';
}

function replaceExt(path, ext) {
  return path.slice(0, path.length - extname(path).length) + ext;
}

function trimLog(log) {
  const text = String(log || '');
  if (Buffer.byteLength(text, 'utf8') <= MAX_LOG_BYTES) return text;
  return text.slice(-MAX_LOG_BYTES);
}

function parseCompileLog(logText) {
  const problems = [];
  const lines = String(logText || '').split('\n');
  let currentFile = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fileHint = line.match(/(?:^|\()((?:\.\/)?[^\s()]+\.(?:tex|bib|sty|cls))/i);
    if (fileHint) currentFile = fileHint[1].replace(/^\.\//, '');
    const direct = line.match(/^(.+?\.(?:tex|bib|sty|cls)):(\d+):\s*(.*)$/i);
    if (direct) {
      problems.push({ level: /warning/i.test(direct[3]) ? 'warn' : 'error', file: direct[1].replace(/^\.\//, ''), line: Number(direct[2]), message: cleanMessage(direct[3] || line) });
      continue;
    }
    if (/^! /.test(line)) {
      const near = nearbyLine(lines, i);
      problems.push({ level: 'error', file: near.file || currentFile, line: near.line, message: cleanMessage(line.replace(/^!\s*/, '').trim()) });
    } else if (/LaTeX Warning:|Package .* Warning:|Overfull \\hbox|Underfull \\hbox/.test(line)) {
      const near = nearbyLine(lines, i);
      problems.push({ level: 'warn', file: near.file || currentFile, line: near.line, message: cleanMessage(line.trim()) });
    } else if (/LaTeX Error:|Package .* Error:/.test(line)) {
      const near = nearbyLine(lines, i);
      problems.push({ level: 'error', file: near.file || currentFile, line: near.line, message: cleanMessage(line.trim()) });
    }
  }
  return dedupeProblems(problems).slice(0, 80);
}

function nearbyLine(lines, index) {
  let file = null;
  for (let j = Math.max(0, index - 3); j < Math.min(lines.length, index + 10); j++) {
    const fh = /(?:^|\()((?:\.\/)?[^\s()]+\.(?:tex|bib|sty|cls))/i.exec(lines[j]);
    if (fh) file = fh[1].replace(/^\.\//, '');
    const m = /l\.(\d+)/.exec(lines[j]) || /line\s+(\d+)/i.exec(lines[j]);
    if (m) return { file, line: Number(m[1]) };
  }
  return { file, line: null };
}

function cleanMessage(message) {
  return String(message || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function dedupeProblems(problems) {
  const seen = new Set();
  return problems.filter((p) => {
    const key = `${p.level}|${p.file || ''}|${p.line || ''}|${p.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function pickProviderAndModel(body) {
  const provider = String(body.provider || 'openai').trim().toLowerCase();
  if (!PROVIDERS.has(provider)) throw httpError(400, `Unsupported provider: ${provider}`);
  const model = String(body.model || DEFAULT_MODELS[provider]).trim();
  if (!ALLOWED_MODELS[provider].has(model)) throw httpError(400, `Unsupported model for ${provider}: ${model}`);
  return { provider, model };
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
    body: JSON.stringify({
      system_instruction: { parts: [{ text: payload.system }] },
      contents: [{ role: 'user', parts: [{ text: payload.textInput || aiInputToText(payload.input) }] }],
      generationConfig: { temperature: payload.temperature, maxOutputTokens: payload.maxOutputTokens }
    })
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

setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of JOBS) {
    if (isFinalStatus(job.status) && now - Date.parse(job.updatedAt || job.createdAt) > JOB_TTL_MS) JOBS.delete(jobId);
  }
}, Math.min(JOB_TTL_MS, 60_000)).unref?.();

app.use((err, _req, res, _next) => {
  res.status(500).json({ ok: false, error: { message: err.message || String(err) } });
});

app.listen(PORT, () => {
  console.log(`Lumina LaTeX backend ${STAGE} listening on http://localhost:${PORT}`);
});
