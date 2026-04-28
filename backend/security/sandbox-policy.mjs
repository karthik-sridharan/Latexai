import { dirname, basename } from 'node:path';
import { httpError } from './validate-project.mjs';

export const ALLOWED_ENGINES = new Set(['pdflatex', 'xelatex', 'lualatex', 'latexmk']);
export const ALLOWED_BIBLIOGRAPHY = new Set(['bibtex', 'none']);

export function sandboxPolicyFromEnv(env = process.env) {
  return {
    runner: String(env.LUMINA_COMPILE_RUNNER || 'native-texlive').trim(),
    allowShellEscape: String(env.ALLOW_SHELL_ESCAPE || 'false').toLowerCase() === 'true',
    compileTimeoutMs: Number(env.COMPILE_TIMEOUT_MS || 30_000),
    maxProjectBytes: Number(env.MAX_PROJECT_BYTES || 4_000_000),
    maxFileCount: Number(env.MAX_PROJECT_FILES || 120),
    maxLogBytes: Number(env.MAX_COMPILE_LOG_BYTES || 180_000),
    maxPdfBytes: Number(env.MAX_PDF_BYTES || 16_000_000),
    cleanupWorkspaces: String(env.CLEANUP_WORKSPACES || 'true').toLowerCase() !== 'false',
    texmfOutputDirectory: String(env.TEXMF_OUTPUT_DIRECTORY || '').trim()
  };
}

export function validateCompileSettings(payload, policy) {
  const engine = String(payload.engine || 'pdflatex').trim();
  if (!ALLOWED_ENGINES.has(engine)) throw httpError(400, `Unsupported engine: ${engine}`);
  const bibliography = String(payload.bibliography || 'bibtex').trim();
  if (!ALLOWED_BIBLIOGRAPHY.has(bibliography)) throw httpError(400, `Unsupported bibliography setting: ${bibliography}`);
  if (payload.shellEscape && !policy.allowShellEscape) throw httpError(400, 'Shell escape requested but backend ALLOW_SHELL_ESCAPE=false.');
  return { engine, bibliography, shellEscape: !!payload.shellEscape && policy.allowShellEscape };
}

export function commandPlan({ engine, bibliography, rootFile, shellEscape }) {
  const rootBase = basename(rootFile, '.tex');
  const rootName = basename(rootFile);
  const cwdSubdir = dirname(rootFile) === '.' ? '' : dirname(rootFile);
  const shellArgs = shellEscape ? ['-shell-escape'] : ['-no-shell-escape'];
  if (engine === 'latexmk') {
    return {
      cwdSubdir,
      commands: [['latexmk', ['-pdf', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', ...shellArgs, rootName]]]
    };
  }
  const commands = [
    [engine, ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', ...shellArgs, rootName]],
  ];
  if (bibliography !== 'none') commands.push(['bibtex', [rootBase], { optional: true }]);
  commands.push(
    [engine, ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', ...shellArgs, rootName]]
  );
  return { cwdSubdir, commands };
}
