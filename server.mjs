import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { mkdtemp, writeFile, readFile, rm, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, normalize, basename, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const STAGE = 'latex-stage1c-compile-pipeline-20260427-1';
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
const PROJECTS = new Map();
const JOBS = new Map();

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
  res.json({ ok: true, service: 'lumina-latex-backend', stage: STAGE, compileJobs: true, jobCount: JOBS.size });
});

app.get('/api/lumina/models', (_req, res) => {
  res.json({
    ok: true,
    providers: Object.fromEntries(Object.entries(ALLOWED_MODELS).map(([provider, set]) => [provider, Array.from(set).map((model) => ({ model }))]))
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
    const { provider, model } = pickProviderAndModel(req.body || {});
    const payload = normalizeAiPayload(req.body || {});
    let result;
    if (provider === 'openai') result = await callOpenAi(model, payload);
    else if (provider === 'anthropic') result = await callAnthropic(model, payload);
    else result = await callGemini(model, payload);
    res.json({ ok: true, provider, model, text: result.text, raw: RETURN_RAW ? result.raw : undefined });
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
    body: JSON.stringify({
      system_instruction: { parts: [{ text: payload.system }] },
      contents: [{ role: 'user', parts: [{ text: payload.input }] }],
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
