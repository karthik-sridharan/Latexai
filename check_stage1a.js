#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = __dirname;
const required = [
  'index.html',
  'css/styles.css',
  'js/state.js',
  'js/editor.js',
  'js/file-tree.js',
  'js/preview.js',
  'js/import-export.js',
  'js/copilot.js',
  'js/diagnostics.js',
  'js/main.js',
  'backend/server.mjs',
  'backend/package.json',
  'backend/.env.example'
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const requiredIds = ['sourceEditor','fileTree','draftPreview','pdfPreview','logPanel','copilotOutput','compileProxyUrl','aiProvider','rootFileSelect'];
const missingIds = requiredIds.filter((id) => !index.includes(`id="${id}"`));
const scripts = Array.from(index.matchAll(/src="([^"]+\.js)[^"]*"/g)).map((m) => m[1].split('?')[0]);
const missingScripts = scripts.filter((src) => !fs.existsSync(path.join(root, src)));
const pass = missing.length === 0 && missingIds.length === 0 && missingScripts.length === 0;
const report = {
  stage: 'latex-stage1a-20260427-1',
  checkedAt: new Date().toISOString(),
  requiredCount: required.length,
  scripts,
  missing,
  missingIds,
  missingScripts,
  hasBackendCompileRoute: fs.readFileSync(path.join(root, 'backend/server.mjs'), 'utf8').includes('/api/lumina/latex/compile'),
  hasAiProxyRoute: fs.readFileSync(path.join(root, 'backend/server.mjs'), 'utf8').includes('/api/lumina/ai'),
  pass
};
console.log(JSON.stringify(report, null, 2));
process.exit(pass ? 0 : 1);
