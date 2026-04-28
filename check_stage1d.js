#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = __dirname;
const stage = 'latex-stage1d-backend-compile-runner-20260428-1';
const requiredFiles = [
  'index.html', 'css/styles.css',
  'js/app-kernel.js', 'js/project-model.js', 'js/compiler-provider.js', 'js/diagnostics.js',
  'backend/server.mjs', 'backend/providers/compile-texlive.mjs',
  'backend/security/validate-project.mjs', 'backend/security/sandbox-policy.mjs',
  'backend/Dockerfile', 'backend/package.json', 'backend/.env.example',
  'README_DEPLOY_STAGE1D.md', 'ARCHITECTURE_CONTRACTS_STAGE1D.json'
];
const requiredIndexStrings = [stage, 'backendStatusCard', 'testCompileBackendBtn', 'Compile backend URL', 'Compile PDF'];
const requiredBackendStrings = ['/api/lumina/latex/status', '/api/lumina/latex/compile/jobs', 'compileWithTexLive', 'validateCompilePayload'];
const requiredFrontendStrings = ['probeBackend', 'backendAvailability', 'staticBackendFallback', 'backendStatusText'];

const missingFiles = requiredFiles.filter((f) => !fs.existsSync(path.join(root, f)));
const index = read('index.html');
const backend = read('backend/server.mjs');
const compiler = read('js/compiler-provider.js');
const missingIndexStrings = requiredIndexStrings.filter((s) => !index.includes(s));
const missingBackendContracts = requiredBackendStrings.filter((s) => !backend.includes(s));
const missingFrontendContracts = requiredFrontendStrings.filter((s) => !compiler.includes(s));
const report = {
  stage,
  checkedAt: new Date().toISOString(),
  missingFiles,
  missingIndexStrings,
  missingBackendContracts,
  missingFrontendContracts,
  pass: missingFiles.length === 0 && missingIndexStrings.length === 0 && missingBackendContracts.length === 0 && missingFrontendContracts.length === 0
};
fs.writeFileSync(path.join(root, 'INTERNAL_DIAGNOSTIC_STAGE1D.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
