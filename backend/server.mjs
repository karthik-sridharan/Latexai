import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, normalize, basename, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PROVIDERS = new Set(['openai', 'anthropic', 'gemini']);
const ENGINES = new Set(['pdflatex', 'xelatex', 'lualatex', 'latexmk']);
const MAX_PROJECT_BYTES = Number(process.env.MAX_PROJECT_BYTES || 4_000_000);
const COMPILE_TIMEOUT_MS = Number(process.env.COMPILE_TIMEOUT_MS || 25_000);
const ALLOW_SHELL_ESCAPE = String(process.env.ALLOW_SHELL_ESCAPE || 'false').toLowerCase() === 'true';
const RETURN_RAW = String(process.env.RETURN_RAW_PROVIDER_RESPONSE || 'false').toLowerCase() === 'true';

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
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '6mb' }));
app.use('/api/lumina/ai', rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 20), standardHeaders: true, legacyHeaders: false }));
app.use('/api/lumina/latex/compile', rateLimit({ windowMs: 60_000, limit: Number(process.env.COMPILE_RATE_LIMIT_PER_MINUTE || 8), standardHeaders: true, legacyHeaders: false }));

function requireProxyToken(req, res, next) {
  const token = process.env.LUMINA_PROXY_TOKEN || '';
  if (!token) return next();
  if (req.headers.authorization !== `Bearer ${token}`) return res.status(401).json({ ok: false, error: { message: 'Unauthorized proxy request.' } });
  return next();
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'lumina-latex-backend', stage: 'latex-stage1a-20260427-1' });
});

app.get('/api/lumina/models', (_req, res) => {
  res.json({
    ok: true,
    providers: Object.fromEntries(Object.entries(ALLOWED_MODELS).map(([provider, set]) => [provider, Array.from(set).map((model) => ({ model }))]))
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
  let workdir = null;
  try {
    const body = req.body || {};
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
    for (const file of files) {
      const out = join(workdir, file.path);
      if (!out.startsWith(workdir)) throw httpError(400, `Unsafe file path: ${file.path}`);
      await mkdirp(dirname(out));
      await writeFile(out, file.text ?? '', 'utf8');
    }

    const compileResult = await runCompile({ workdir, rootFile, engine, shellEscape: wantsShellEscape });
    const pdfPath = join(workdir, replaceExt(rootFile, '.pdf'));
    let pdfBase64 = null;
    try {
      const st = await stat(pdfPath);
      if (st.isFile() && st.size > 0) pdfBase64 = (await readFile(pdfPath)).toString('base64');
    } catch (_err) {}

    const ok = !!pdfBase64 && compileResult.code === 0;
    res.status(ok ? 200 : 422).json({
      ok,
      projectName: body.projectName || '',
      rootFile,
      engine,
      pdfBase64,
      log: compileResult.log.slice(-120_000),
      exitCode: compileResult.code
    });
  } catch (err) {
    res.status(err.status || 500).json({ ok: false, error: { message: err.message || String(err) } });
  } finally {
    if (workdir) rm(workdir, { recursive: true, force: true }).catch(() => {});
  }
});

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

function validateFiles(files) {
  if (!Array.isArray(files) || !files.length) throw httpError(400, 'No files supplied.');
  let bytes = 0;
  const out = [];
  for (const item of files) {
    const path = safeRelativePath(item.path);
    const text = String(item.text ?? item.content ?? '');
    bytes += Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_PROJECT_BYTES) throw httpError(413, `Project is larger than MAX_PROJECT_BYTES=${MAX_PROJECT_BYTES}.`);
    out.push({ path, text });
  }
  return out;
}

function safeRelativePath(path) {
  const p = normalize(String(path || '').replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!p || p === '.' || p.includes('..') || p.startsWith('/') || /^[a-zA-Z]:/.test(p)) throw httpError(400, `Unsafe or empty path: ${path}`);
  if (!/\.(tex|bib|sty|cls|txt|md|png|jpg|jpeg|pdf|eps)$/i.test(p)) throw httpError(400, `Unsupported file extension: ${p}`);
  return p;
}

async function mkdirp(path) {
  await import('node:fs/promises').then(({ mkdir }) => mkdir(path, { recursive: true }));
}

function replaceExt(path, ext) {
  return path.slice(0, path.length - extname(path).length) + ext;
}

async function runCompile({ workdir, rootFile, engine, shellEscape }) {
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
  for (const [cmd, args, options = {}] of commands) {
    const result = await runCommand(cmd, args, dir, COMPILE_TIMEOUT_MS, options.optional);
    log += `\n$ ${cmd} ${args.join(' ')}\n${result.output}\n`;
    if (result.code !== 0 && !options.optional) {
      finalCode = result.code;
      break;
    }
  }
  return { code: finalCode, log };
}

function runCommand(cmd, args, cwd, timeoutMs, optional = false) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => {
      output += `\n[timeout] Killed ${cmd} after ${timeoutMs}ms.\n`;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', (err) => {
      clearTimeout(timer);
      const message = optional && err.code === 'ENOENT' ? `[optional] ${cmd} not found.\n` : `[error] ${cmd}: ${err.message}\n`;
      resolve({ code: optional ? 0 : 127, output: message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 0, output });
    });
  });
}

app.use((err, _req, res, _next) => {
  res.status(500).json({ ok: false, error: { message: err.message || String(err) } });
});

app.listen(PORT, () => {
  console.log(`Lumina LaTeX backend listening on http://localhost:${PORT}`);
});
