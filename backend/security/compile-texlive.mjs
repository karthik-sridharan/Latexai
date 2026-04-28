import { mkdtemp, writeFile, readFile, rm, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, extname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileToBuffer, httpError } from '../security/validate-project.mjs';
import { validateCompileSettings, commandPlan } from '../security/sandbox-policy.mjs';

export async function detectTeXLive(policy = {}) {
  const engines = ['pdflatex', 'xelatex', 'lualatex', 'latexmk', 'bibtex'];
  const checks = await Promise.all(engines.map(async (cmd) => [cmd, await commandExists(cmd)]));
  return {
    ok: checks.some(([cmd, available]) => ['pdflatex', 'xelatex', 'lualatex', 'latexmk'].includes(cmd) && available),
    runner: policy.runner || 'native-texlive',
    engines: Object.fromEntries(checks),
    shellEscapeAllowed: !!policy.allowShellEscape,
    timeoutMs: policy.compileTimeoutMs,
    maxProjectBytes: policy.maxProjectBytes,
    maxFileCount: policy.maxFileCount
  };
}

export async function compileWithTexLive(payload, options = {}) {
  const policy = options.policy || {};
  const onEvent = options.onEvent || (() => {});
  const job = options.job || null;
  const settings = validateCompileSettings(payload, policy);
  let workspace = null;
  const startedAt = new Date().toISOString();
  try {
    workspace = await mkdtemp(join(tmpdir(), 'lumina-latex-'));
    onEvent({ progress: 24, message: 'Created isolated temporary workspace.' });
    await writeProjectFiles(workspace, payload.files || []);
    onEvent({ progress: 34, message: `Running ${settings.engine} through TeX Live.` });
    const result = await runCompileCommands({ workspace, payload, settings, policy, onEvent, job });
    const pdfPath = join(workspace, replaceExt(payload.rootFile, '.pdf'));
    let pdfBase64 = null;
    let pdfBytes = 0;
    try {
      const st = await stat(pdfPath);
      if (st.isFile() && st.size > 0) {
        pdfBytes = st.size;
        if (policy.maxPdfBytes && st.size > policy.maxPdfBytes) {
          throw httpError(413, `Compiled PDF is larger than MAX_PDF_BYTES=${policy.maxPdfBytes}.`);
        }
        pdfBase64 = (await readFile(pdfPath)).toString('base64');
      }
    } catch (err) {
      if (err.status) throw err;
    }
    const ok = !!pdfBase64 && result.exitCode === 0;
    const log = trimLog(result.log, policy.maxLogBytes);
    return {
      ok,
      schema: 'lumina-latex-compile-response-v1',
      stage: options.stage || 'latex-stage1e-safety-guard-20260428-1',
      runner: policy.runner || 'native-texlive',
      jobId: job?.jobId || null,
      projectId: payload.projectId || null,
      projectName: payload.projectName || '',
      rootFile: payload.rootFile,
      engine: settings.engine,
      bibliography: payload.bibliography || 'bibtex',
      shellEscape: settings.shellEscape,
      pdfBase64,
      pdfBytes,
      log,
      exitCode: result.exitCode,
      problems: parseCompileLog(log),
      startedAt,
      finishedAt: new Date().toISOString()
    };
  } finally {
    if (workspace && policy.cleanupWorkspaces !== false) {
      rm(workspace, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function writeProjectFiles(workspace, files) {
  for (const file of files) {
    const absolute = resolve(workspace, file.path);
    if (!absolute.startsWith(resolve(workspace))) throw httpError(400, `Unsafe file path after resolution: ${file.path}`);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, fileToBuffer(file));
  }
}

async function runCompileCommands({ workspace, payload, settings, policy, onEvent, job }) {
  const plan = commandPlan({ engine: settings.engine, bibliography: payload.bibliography || 'bibtex', rootFile: payload.rootFile, shellEscape: settings.shellEscape });
  const cwd = plan.cwdSubdir ? join(workspace, plan.cwdSubdir) : workspace;
  let log = '';
  let finalExitCode = 0;
  for (let idx = 0; idx < plan.commands.length; idx++) {
    if (job?.cancelRequested) return { exitCode: 130, log: `${log}\n[canceled] Compile canceled before command ${idx + 1}.` };
    const [cmd, args, commandOptions = {}] = plan.commands[idx];
    const progress = Math.min(92, 40 + Math.round((idx / Math.max(plan.commands.length, 1)) * 45));
    const commandLine = `$ ${cmd} ${args.join(' ')}`;
    onEvent({ progress, message: `Running ${cmd} pass ${idx + 1}/${plan.commands.length}.`, logChunk: `\n${commandLine}\n` });
    const result = await runCommand(cmd, args, cwd, policy.compileTimeoutMs, commandOptions, job);
    log = trimLog(`${log}\n${commandLine}\n${result.output}\n`, policy.maxLogBytes);
    onEvent({ progress: Math.min(progress + 8, 95), message: `${cmd} pass complete.`, logChunk: trimLog(result.output + '\n', policy.maxLogBytes) });
    if (result.exitCode !== 0 && !commandOptions.optional) {
      finalExitCode = result.exitCode;
      break;
    }
  }
  return { exitCode: finalExitCode, log };
}

function runCommand(cmd, args, cwd, timeoutMs = 30_000, options = {}, job = null) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: safeTeXEnv(process.env) });
    if (job) job.child = child;
    let output = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      output += `\n[timeout] Killed ${cmd} after ${timeoutMs}ms.\n`;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { output = trimLog(output + chunk.toString(), 220_000); });
    child.stderr.on('data', (chunk) => { output = trimLog(output + chunk.toString(), 220_000); });
    child.on('error', (err) => {
      clearTimeout(timer);
      if (job && job.child === child) job.child = null;
      const missingOptional = options.optional && err.code === 'ENOENT';
      const message = missingOptional ? `[optional] ${cmd} not found; skipped.\n` : `[error] ${cmd}: ${err.message}\n`;
      resolve({ exitCode: missingOptional ? 0 : 127, output: message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (job && job.child === child) job.child = null;
      resolve({ exitCode: timedOut ? 124 : (code ?? 0), output });
    });
  });
}

function safeTeXEnv(env) {
  return {
    PATH: env.PATH,
    HOME: env.HOME || '/tmp',
    TMPDIR: env.TMPDIR || tmpdir(),
    TEXMFVAR: env.TEXMFVAR || '/tmp/texmf-var',
    TEXMFCONFIG: env.TEXMFCONFIG || '/tmp/texmf-config',
    TEXMFCACHE: env.TEXMFCACHE || '/tmp/texmf-cache'
  };
}

function commandExists(cmd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(false); }, 2500);
    child.on('error', () => { clearTimeout(timer); resolve(false); });
    child.on('close', (code) => { clearTimeout(timer); resolve(code === 0 || code === 1); });
  });
}

function replaceExt(path, ext) {
  return path.slice(0, path.length - extname(path).length) + ext;
}

function trimLog(value, maxBytes = 180_000) {
  const text = String(value || '');
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  return text.slice(-maxBytes);
}

export function parseCompileLog(logText) {
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
  return dedupeProblems(problems).slice(0, 100);
}

function nearbyLine(lines, index) {
  let file = null;
  for (let j = Math.max(0, index - 4); j < Math.min(lines.length, index + 12); j++) {
    const fh = /(?:^|\()((?:\.\/)?[^\s()]+\.(?:tex|bib|sty|cls))/i.exec(lines[j]);
    if (fh) file = fh[1].replace(/^\.\//, '');
    const m = /l\.(\d+)/.exec(lines[j]) || /line\s+(\d+)/i.exec(lines[j]);
    if (m) return { file, line: Number(m[1]) };
  }
  return { file, line: null };
}

function cleanMessage(message) {
  return String(message || '').replace(/\s+/g, ' ').trim().slice(0, 520);
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
