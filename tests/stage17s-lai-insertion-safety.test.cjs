const fs = require('fs');
const assert = require('assert');

const competitive = fs.readFileSync('js/competitive-paper-review-service.js', 'utf8');
const devils = fs.readFileSync('js/devils-advocate-debate-service.js', 'utf8');
const compiler = fs.readFileSync('js/compiler-provider.js', 'utf8');
const preload = fs.readFileSync('js/compiler-provider-preload.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const paperPolish = fs.readFileSync('js/paper-ai-polish-service.js', 'utf8');

for (const [name, src, workflow] of [
  ['competitive', competitive, 'competitive-review'],
  ['devils', devils, 'devils-advocate'],
]) {
  assert(src.includes("const STAGE = 'stage17s-lai-insertion-safety-1'"), `${name}: stage string should be 17S`);
  assert(src.includes('function prepareActionableNewLatex'), `${name}: should sanitize/validate AI newText before wrapping in \\lai`);
  assert(src.includes('function unsafeInsertionLocationReason'), `${name}: should reject preamble/existing-edit insertion locations`);
  assert(src.includes('validateMacroArgument(oldText'), `${name}: should validate oldText before putting it in \\laiold`);
  assert(src.includes('const wrapped = wrapActionableReplacement'), `${name}: insertion path should inspect wrapped result`);
  assert(src.includes('if (!wrapped.ok)'), `${name}: insertion path should skip unsafe snippets`);
  assert(!src.includes("'\\\\lai{', String(edit.newText || '').trim(), '}'"), `${name}: should not directly inject raw AI newText`);
  assert(src.includes(`workflow=${workflow}`), `${name}: workflow metadata should remain present`);
  assert(src.includes('safeMetaValue(id)'), `${name}: metadata should be encoded for comment safety`);
  assert(src.includes('latexCommentText(edit.targetHint)'), `${name}: target hints should be one-line comments`);
  assert(src.includes('newText must be a compile-safe LaTeX body fragment'), `${name}: prompt should request compile-safe LaTeX`);
  assert(src.includes('no \\\\begin{document}/\\\\end{document}'), `${name}: prompt should escape begin/end document literally`);
}

for (const src of [compiler, preload]) {
  assert(src.includes("stage17s-lai-insertion-safety-1"), 'compiler providers should expose 17S stage string');
  assert(src.includes('jobCompileFallbackReason'), 'compiler provider should preserve job fallback reason');
  assert(src.includes('compile job creation endpoint'), 'compiler provider should fallback when job endpoint returns 400/404/405/etc.');
}

assert(paperPolish.includes('function repairUnsafeAiEditBlocks'), 'paper-level review should include a recovery path for already inserted unsafe AI edits');
assert(paperPolish.includes('paperAiRepairUnsafeBtn'), 'paper-level review should expose a Repair unsafe AI edits button');
assert(paperPolish.includes('textModeLatexRisk'), 'paper-level review should detect common compile-risk text-mode characters in existing edits');
assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17s-lai-insertion-safety-20260521-1'"), 'index should expose Stage 17S');
console.log('stage17s lai insertion safety tests passed');
