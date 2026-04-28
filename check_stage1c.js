#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('.', import.meta.url).pathname;
const stage = 'latex-stage1c-compile-pipeline-20260427-1';
const requiredFiles = [
  'index.html',
  'css/styles.css',
  'js/app-kernel.js',
  'js/project-model.js',
  'js/project-store.js',
  'js/editor-adapter.js',
  'js/compiler-provider.js',
  'js/ai-provider.js',
  'js/sync-provider.js',
  'js/preview-adapter.js',
  'js/state.js',
  'js/editor.js',
  'js/file-tree.js',
  'js/preview.js',
  'js/import-export.js',
  'js/copilot.js',
  'js/diagnostics.js',
  'js/main.js',
  'backend/server.mjs',
  'backend/providers/compile-texlive.mjs',
  'backend/security/sandbox-policy.mjs',
  'ARCHITECTURE_CONTRACTS_STAGE1C.json'
];

const requiredIndexStrings = [
  stage,
  'compileStatusCard',
  'compileJobsCheck',
  'compileProxyToken',
  'compilerModeSelect',
  'js/app-kernel.js',
  'js/project-model.js',
  'js/compiler-provider.js',
  'js/ai-provider.js',
  'js/sync-provider.js'
];

const missingFiles = requiredFiles.filter((file) => !existsSync(join(root, file)));
const index = readFileSync(join(root, 'index.html'), 'utf8');
const missingIndexStrings = requiredIndexStrings.filter((text) => !index.includes(text));

const jsFiles = readdirSync(join(root, 'js')).filter((name) => name.endsWith('.js')).map((name) => join(root, 'js', name));
const syntax = [];
for (const file of [...jsFiles, join(root, 'backend/server.mjs')]) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 5000 });
  if (result.status !== 0) syntax.push({ file: file.replace(root, ''), status: result.status, stderr: result.stderr || result.stdout });
}

const server = readFileSync(join(root, 'backend/server.mjs'), 'utf8');
const backendContractChecks = [
  "app.post('/api/lumina/projects/:projectId'",
  "app.get('/api/lumina/projects/:projectId'",
  "app.post('/api/lumina/latex/compile/jobs'",
  "app.get('/api/lumina/latex/compile/jobs/:jobId'",
  "app.get('/api/lumina/latex/compile/jobs/:jobId/events'",
  "app.delete('/api/lumina/latex/compile/jobs/:jobId'",
  "app.post('/api/lumina/latex/compile'",
  "app.get('/ws/lumina/projects/:projectId'"
];
const missingBackendContracts = backendContractChecks.filter((text) => !server.includes(text));

const compiler = readFileSync(join(root, 'js/compiler-provider.js'), 'utf8');
const frontendContractChecks = [
  'backendCompileJob',
  'pollJob',
  'cancelActiveJob',
  'parseCompileLog',
  'useCompileJobs'
];
const missingFrontendContracts = frontendContractChecks.filter((text) => !compiler.includes(text));

const report = {
  stage,
  checkedAt: new Date().toISOString(),
  root,
  requiredFileCount: requiredFiles.length,
  missingFiles,
  missingIndexStrings,
  syntax,
  missingBackendContracts,
  missingFrontendContracts,
  pass: missingFiles.length === 0 && missingIndexStrings.length === 0 && syntax.length === 0 && missingBackendContracts.length === 0 && missingFrontendContracts.length === 0
};

writeFileSync(join(root, 'INTERNAL_DIAGNOSTIC_STAGE1C.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
