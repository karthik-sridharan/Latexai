const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const provider = fs.readFileSync(path.join(root, 'js', 'compiler-provider.js'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'js', 'preview.js'), 'utf8');
const diagnostics = fs.readFileSync(path.join(root, 'js', 'diagnostics.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17x-compile-log-diagnostics-surfacing-20260521-1'"), 'index should expose Stage 17X');
assert(index.includes('js/compiler-provider.js?v=stage17x-compile-log-diagnostics-surfacing-1'), 'compiler provider should be cache-busted for Stage 17X');
assert(provider.includes("var STAGE = 'stage17x-compile-log-diagnostics-surfacing-1'"), 'provider should expose Stage 17X');
assert(provider.includes('function stage17xCollectLogText'), 'provider should collect nested compile logs');
assert(provider.includes('function stage17xParseLatexProblems'), 'provider should parse LaTeX problems from logs');
assert(provider.includes('main.tex') || provider.includes('\\.tex'), 'provider should recognize file-line-error .tex diagnostics');
assert(provider.includes('result.problems = stage17xMergeProblems(result.problems, parsedProblems);'), 'provider should attach parsed problems');
assert(provider.includes('result.message = stage17xShortFailureMessage(result);'), 'provider should replace generic failed message with first LaTeX error');
assert(preview.includes('function compileLogText'), 'preview should preserve full compile log text');
assert(preview.includes('normalizeCompileProblems(result, logText)'), 'preview should use parsed problems from provider/log');
assert(diagnostics.includes('compileLogTail'), 'diagnostics report should include compile log tail');
assert(diagnostics.includes('lastProblems'), 'diagnostics report should include problem details');
console.log('stage17x compile-log diagnostics surfacing static checks passed');
