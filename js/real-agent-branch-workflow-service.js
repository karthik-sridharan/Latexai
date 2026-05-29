/* Latexai Stage 19N1R RealAgentBranchWorkflowService
 * Stage: stage19n1r-branch-runner-settings-devils-routes-20260529-1
 *
 * Main-editor integration for the verified developer-page branch loop:
 * 19L3/L4/L5/L6 plan -> 19M real-agent run -> 19M1 clean -> 19M2 insertion preview -> 19M3 outcome feedback.
 * This frontend service uses the existing memory backend, AI proxy, and active LaTeX editor source.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19n1r7-accept-lai-no-duplicate-sections-20260529-1';

  let lastSelectionData = null;
  let lastRealRunData = null;
  let lastCleanerData = null;
  let lastInsertionData = null;
  let lastStructuredEditorData = null;
  let lastOutcomeData = null;
  let lastInsertionDedupeNotes = [];
  let mounted = false;
  const PROMPT_TEMPLATE_ROOT = 'prompt/devils-advocate-branch-runner/';
  const promptTemplateCache = {};
  let promptDebugWindow = null;
  let promptDebugRunId = '';
  let promptDebugEventCount = 0;
  const SAVED_BRANCH_RUNS_KEY = 'latexai:devils-advocate:saved-runs:v2';
  const SAVED_BRANCH_RUNS_LIMIT = 50;


  function $(id) { return D.getElementById(id); }
  function clean(v) { return String(v == null ? '' : v).trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function getStored(key, fallback = '') { try { return W.localStorage?.getItem?.(key) || fallback; } catch (_err) { return fallback; } }
  function setStored(key, value) { try { W.localStorage?.setItem?.(key, String(value ?? '')); } catch (_err) {} }

  function promptDebugEnabled() {
    try {
      const params = new URLSearchParams(W.location.search || '');
      return ['laiPromptDebug', 'debugDebatePrompts', 'promptDebug', 'showAgentPrompts'].some((k) => {
        const v = String(params.get(k) || '').toLowerCase();
        return v === '1' || v === 'true' || v === 'yes' || v === 'on';
      });
    } catch (_err) {
      return false;
    }
  }

  function promptDebugEsc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function promptDebugDownloadName() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return 'latexai-debate-agent-prompts-' + stamp + '.txt';
  }

  function promptDebugInitialHtml() {
    return `<!doctype html><html><head><meta charset="utf-8" />
<title>Latexai debate agent prompt debug</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0b1020;color:#e7ecff;}
header{position:sticky;top:0;z-index:2;background:#111936;border-bottom:1px solid #33406f;padding:12px 16px;}
h1{font-size:17px;margin:0 0 4px;} .sub{font-size:12px;color:#aeb8e8;line-height:1.35;}
button{margin:8px 8px 0 0;border:1px solid #6574b8;background:#18224a;color:#fff;border-radius:8px;padding:7px 10px;font-size:12px;}
#log{padding:14px 16px 60px;}
.event{border:1px solid #344274;background:#121936;border-radius:12px;margin:0 0 16px;padding:12px;box-shadow:0 4px 18px rgba(0,0,0,.18);}
.event h2{font-size:15px;margin:0 0 6px;color:#fff;}
.meta{font-size:12px;color:#b8c2f5;margin:0 0 10px;white-space:pre-wrap;}
details{margin:8px 0;} summary{cursor:pointer;color:#d8defd;font-weight:600;}
pre{white-space:pre-wrap;word-break:break-word;background:#080c19;color:#eef2ff;border:1px solid #26335f;border-radius:8px;padding:10px;max-height:none;overflow:auto;font-size:12px;line-height:1.38;}
.warn{color:#ffd78a}.good{color:#9ff7bd}.muted{color:#9ba8d7}
</style></head><body>
<header><h1>Latexai debate agent prompt debug</h1>
<div class="sub">Temporary debug mode. This tab shows the exact <code>payload.prompt</code> built by the frontend for each Devil's Advocate agent call, plus the AIProvider payload fields. It is enabled only when the main app URL includes <code>?laiPromptDebug=1</code> or <code>&amp;laiPromptDebug=1</code>.</div>
<button onclick="navigator.clipboard&&navigator.clipboard.writeText(Array.from(document.querySelectorAll('.prompt-pre')).map((p,i)=>'===== PROMPT '+(i+1)+' =====\\n'+p.textContent).join('\\n\\n'))">Copy all visible prompts</button>
<button onclick="document.getElementById('log').innerHTML=''">Clear</button>
<span id="status" class="sub"></span></header><main id="log"></main></body></html>`;
  }

  function ensurePromptDebugWindow(reason) {
    if (!promptDebugEnabled()) return null;
    try {
      if (promptDebugWindow && !promptDebugWindow.closed) return promptDebugWindow;
      promptDebugRunId = 'pdebug_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 8);
      promptDebugEventCount = 0;
      promptDebugWindow = W.open('', 'latexai_debate_prompt_debug_' + promptDebugRunId);
      if (!promptDebugWindow) {
        status('Prompt debug mode is enabled, but the browser blocked the prompt debug tab. Allow pop-ups for this site or open from a direct click.', 'warn');
        return null;
      }
      promptDebugWindow.document.open();
      promptDebugWindow.document.write(promptDebugInitialHtml());
      promptDebugWindow.document.close();
      try { promptDebugWindow.document.getElementById('status').textContent = 'Run id: ' + promptDebugRunId + (reason ? ' · ' + reason : ''); } catch (_err) {}
      return promptDebugWindow;
    } catch (err) {
      console.warn('[Latexai] prompt debug window failed', err);
      return null;
    }
  }

  function promptDebugPayloadText(payload, options) {
    const p = payload || {};
    const safe = {
      provider: p.provider,
      model: p.model,
      latexSourceMode: p.latexSourceMode,
      fullLatexSourceVisibleInPrompt: p.fullLatexSourceVisibleInPrompt,
      reviewText: p.reviewText,
      paperSummary: p.paperSummary,
      branchTitle: p.branch?.title,
      branchType: p.branch?.branchType,
      selectedTargets: p.branch?.targetSections || p.executionPlan?.targetSections,
      priorOutputCount: Array.isArray(p.priorOutputs) ? p.priorOutputs.length : 0,
      latexSourceChars: typeof p.latexSource === 'string' ? p.latexSource.length : 0,
      payloadContainsFullLatexSource: !!p.latexSource,
      note: 'The model definitely receives payload.prompt. Other payload fields are visible to the model only if AIProvider/proxy includes them in model messages.'
    };
    let text = JSON.stringify(safe, null, 2);
    if (options?.includeLatexSource && typeof p.latexSource === 'string' && p.latexSource) {
      text += '\n\n===== payload.latexSource =====\n' + p.latexSource;
    }
    return text;
  }

  function publishPromptDebugEvent(kind, step, prompt, payload, extra) {
    if (!promptDebugEnabled()) return;
    const win = ensurePromptDebugWindow('capturing prompts');
    const event = {
      runId: promptDebugRunId,
      eventIndex: ++promptDebugEventCount,
      kind,
      createdAt: new Date().toISOString(),
      stepIndex: step?.stepIndex,
      agentRole: step?.agentRole,
      debateRound: step?.debateRound || 0,
      debatePhase: step?.debatePhase || '',
      taskType: step?.taskType || '',
      prompt: String(prompt || ''),
      payloadSummary: promptDebugPayloadText(payload, { includeLatexSource: true }),
      extra: extra || null
    };
    try {
      const prev = JSON.parse(W.localStorage?.getItem?.('latexai:debatePromptDebugEvents') || '[]');
      prev.push(event);
      W.localStorage?.setItem?.('latexai:debatePromptDebugEvents', JSON.stringify(prev.slice(-100)));
    } catch (_err) {}
    if (!win || win.closed) return;
    try {
      const log = win.document.getElementById('log');
      const roleLine = (event.agentRole || 'agent') + (event.debateRound ? ' round ' + event.debateRound : '') + ' · step ' + (event.stepIndex || event.eventIndex);
      const html = '<section class="event">' +
        '<h2>' + promptDebugEsc(event.kind + ': ' + roleLine) + '</h2>' +
        '<div class="meta">' + promptDebugEsc(event.createdAt + '\nTask: ' + event.taskType + (extra?.status ? '\nStatus: ' + extra.status : '')) + '</div>' +
        '<details open><summary>Visible prompt sent as payload.prompt (' + promptDebugEsc(String(event.prompt.length)) + ' chars)</summary><pre class="prompt-pre">' + promptDebugEsc(event.prompt) + '</pre></details>' +
        '<details><summary>AIProvider payload summary and latexSource payload</summary><pre>' + promptDebugEsc(event.payloadSummary) + '</pre></details>' +
        (extra ? '<details><summary>Extra event data</summary><pre>' + promptDebugEsc(JSON.stringify(extra, null, 2)) + '</pre></details>' : '') +
        '</section>';
      log.insertAdjacentHTML('beforeend', html);
      win.document.getElementById('status').textContent = 'Captured ' + promptDebugEventCount + ' event(s). Latest: ' + roleLine;
      win.scrollTo(0, win.document.body.scrollHeight);
    } catch (err) {
      console.warn('[Latexai] prompt debug append failed', err);
    }
  }


  async function loadPromptTemplate(name) {
    const safeName = String(name || '').replace(/[^a-z0-9_.-]/gi, '');
    if (!safeName) throw new Error('Missing prompt template name.');
    if (promptTemplateCache[safeName]) return promptTemplateCache[safeName];
    const url = PROMPT_TEMPLATE_ROOT + safeName + '.txt?v=' + encodeURIComponent(STAGE);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load prompt template: ' + url + ' (' + res.status + ')');
    const text = await res.text();
    promptTemplateCache[safeName] = text;
    return text;
  }

  function fillPromptTemplate(template, values) {
    const bag = values || {};
    return String(template || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, key) => {
      const value = bag[key];
      if (Array.isArray(value)) return value.join(', ');
      return value == null ? '' : String(value);
    }).trim();
  }

  function toast(message) {
    try { NS.Main?.toast?.(message); } catch (_err) {}
  }

  function state() { return NS.State; }
  function activeFile() { try { return state()?.getActiveFile?.() || null; } catch (_err) { return null; } }
  function activePath() { return activeFile()?.path || state()?.state?.project?.activePath || 'main.tex'; }
  function getActiveSource() {
    const editor = $('sourceEditor');
    if (editor && typeof editor.value === 'string') return editor.value;
    const file = activeFile();
    return String(file?.text || file?.content || '');
  }
  function firstDiffRange(before, after) {
    const a = String(before || '');
    const b = String(after || '');
    let start = 0;
    const minLen = Math.min(a.length, b.length);
    while (start < minLen && a[start] === b[start]) start += 1;
    let aEnd = a.length;
    let bEnd = b.length;
    while (aEnd > start && bEnd > start && a[aEnd - 1] === b[bEnd - 1]) { aEnd -= 1; bEnd -= 1; }
    return { start, oldEnd: aEnd, newEnd: bEnd };
  }

  function lineColForOffset(text, offset) {
    const safe = Math.max(0, Math.min(Number(offset) || 0, String(text || '').length));
    const lines = String(text || '').slice(0, safe).split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
  }


  function hasLatexaiLaiMacro(text) {
    const s = String(text || '');
    return /\\newif\s*\\iflaishowchanges/.test(s) && /\\(?:long\s*)?\\def\s*\\lai\b|\\newcommand\s*\{\\lai\}|\\providecommand\s*\{\\lai\}/.test(s);
  }

  function hasLatexaiLaiOldMacro(text) {
    const s = String(text || '');
    return /\\(?:long\s*)?\\def\s*\\laiold\b|\\newcommand\s*\{\\laiold\}|\\providecommand\s*\{\\laiold\}/.test(s);
  }

  function ensureXcolorPackage(text) {
    let s = String(text || '');
    if (/\\usepackage(?:\[[^\]]*\])?\{[^}]*\b(?:xcolor|color)\b[^}]*\}/.test(s)) return s;
    const docClass = s.match(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/);
    if (docClass && typeof docClass.index === 'number') {
      const insertAt = docClass.index + docClass[0].length;
      return s.slice(0, insertAt) + '\n\\usepackage{xcolor}% added by Latexai for visible \\lai / \\laiold markup' + s.slice(insertAt);
    }
    const begin = s.search(/\\begin\s*\{document\}/);
    if (begin >= 0) return s.slice(0, begin) + '\\usepackage{xcolor}% added by Latexai for visible \\lai / \\laiold markup\n' + s.slice(begin);
    return '\\usepackage{xcolor}% added by Latexai for visible \\lai / \\laiold markup\n' + s;
  }

  function ensureLatexaiColorMacros(text) {
    let s = ensureXcolorPackage(text);
    const macroBlock = [
      '% --- Latexai AI-change highlighting macro ---',
      '% Set this to \\laishowchangesfalse to hide red AI markup.',
      '\\newif\\iflaishowchanges',
      '\\laishowchangestrue',
      '\\long\\def\\lai#1{%',
      '  \\iflaishowchanges',
      '    {\\color{red}#1}%',
      '  \\else',
      '    #1%',
      '  \\fi',
      '}',
      '\\long\\def\\laiold#1{{\\color{blue}#1}}',
      '% --- end Latexai AI-change highlighting macro ---',
      ''
    ].join('\n');
    if (!hasLatexaiLaiMacro(s)) {
      const begin = s.search(/\\begin\s*\{document\}/);
      if (begin >= 0) s = s.slice(0, begin) + macroBlock + '\n' + s.slice(begin);
      else s = macroBlock + '\n' + s;
    } else if (!hasLatexaiLaiOldMacro(s)) {
      const laiIdx = s.search(/% --- Latexai AI-change highlighting macro ---|\\(?:long\s*)?\\def\s*\\lai\b|\\newcommand\s*\{\\lai\}|\\providecommand\s*\{\\lai\}/);
      const insertAt = laiIdx >= 0 ? laiIdx : 0;
      s = s.slice(0, insertAt) + '\\long\\def\\laiold#1{{\\color{blue}#1}}\n' + s.slice(insertAt);
    }
    // Users expect the visible preview to show red new edits. If a previous test toggled
    // the switch off, turn it back on when applying a branch-run draft.
    s = s.replace(/\\laishowchangesfalse\b/, '\\laishowchangestrue');
    return s;
  }


  function findLastEndDocument(text) {
    const s = String(text || '');
    const re = /\\end\s*\{document\}/g;
    let match = null;
    let m = null;
    while ((m = re.exec(s))) match = { index: m.index, end: m.index + m[0].length, text: m[0] };
    return match;
  }

  function containsLaiMarkup(text) {
    return /\lai(?:old)?\s*\{/.test(String(text || ''));
  }

  function countVisibleLaiBlocks(text) {
    try {
      return parseLatexMacroBlocks(text, 'lai').length + parseLatexMacroBlocks(text, 'laiold').length;
    } catch (_err) {
      return 0;
    }
  }

  function latexPlainTextForLaiBody(text, maxChars) {
    let s = String(text || '')
      .replace(/LATEXAI_STRUCTURED_EDIT_JSON_BEGIN[\s\S]*?LATEXAI_STRUCTURED_EDIT_JSON_END/ig, ' ')
      .replace(/```(?:json|latex|tex)?/ig, ' ')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const max = Math.max(240, Number(maxChars) || 1800);
    if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '') + '…';
    // This is a last-resort visible note, so make it compile-safe plain text.
    return s
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([{}%&_#$])/g, '\\$1')
      .replace(/\^/g, '\\textasciicircum{}')
      .replace(/~/g, '\\textasciitilde{}');
  }

  function fallbackVisibleSuggestionText() {
    const structured = refreshStructuredEditorData();
    const parts = [];
    if (structured?.ok && Array.isArray(structured.edits) && structured.edits.length) {
      structured.edits.slice(0, 6).forEach((e, idx) => {
        const target = clean(e.targetSection || e.targetId || e.targetType || ('edit ' + (idx + 1)));
        const latex = clean(e.latex || e.oldLatex || e.explanation || e.text || e.content || '');
        if (latex) parts.push('Target ' + target + ': ' + latex);
      });
    }
    const finalText = finalEditorOutputText();
    if (!parts.length && finalText) parts.push(finalText);
    if (!parts.length && lastRealRunData?.finalOutput) parts.push(String(lastRealRunData.finalOutput || ''));
    if (!parts.length && lastSelectionData?.selectedBranch) {
      const b = lastSelectionData.selectedBranch;
      parts.push([b.title, b.rationale, b.summary].filter(Boolean).join('\n'));
    }
    return parts.join('\n\n').trim();
  }

  function buildFallbackVisibleLaiDraft(beforeSource, reason) {
    const before = String(beforeSource || '');
    const suggestionText = fallbackVisibleSuggestionText();
    if (!suggestionText.trim()) return before;
    const block = [
      '',
      '% --- Latexai fallback Devil\'s Advocate visible suggestion ---',
      '% Inserted because the targeted draft would otherwise make no visible source change.',
      reason ? ('% Reason: ' + String(reason).replace(/\n/g, ' ').slice(0, 240)) : '',
      '\\paragraph{Latexai Devil\'s Advocate suggestion}',
      '\\lai{%',
      latexPlainTextForLaiBody(suggestionText, 2200),
      '}',
      '% --- end Latexai fallback visible suggestion ---',
      ''
    ].filter((x) => x !== '').join('\n');
    return normalizeLaiDraftForCompilation(insertBeforeEndDocument(before, block), 'append');
  }

  function removeLatexaiEquationExplanationRegions(text) {
    // Stage 19N1M: equation-coverage apply should be replace-style by default.
    // If a previous run already placed explanatory \lai blocks below equations,
    // remove those wrapper regions before inserting the next recovered set.
    // This prevents stacking multiple variants under the same display equation.
    return String(text || '').replace(/\n?% --- Latexai equation explanation suggestion for:[\s\S]*?% --- end Latexai equation explanation suggestion ---\n?/g, '\n');
  }

  function removeLatexaiSuggestionCommentRegions(text) {
    let s = String(text || '');
    // Remove previously applied branch-run suggestion wrappers before constructing
    // the next model prompt. Otherwise the next debate sees old red edits as if
    // they were part of the original paper and often repeats them.
    s = s.replace(/\n?% --- Latexai targeted Devil's Advocate suggestion for section:[\s\S]*?% --- end Latexai targeted suggestion ---\n?/g, '\n');
    s = s.replace(/\n?% --- Latexai appended multi-section Devil's Advocate suggestions ---[\s\S]*?(?=\\end\s*\{document\}|$)/g, '\n');
    s = s.replace(/\n?% --- Latexai appended AI suggestions \(moved before \\end\{document\}\) ---[\s\S]*?(?=\\end\s*\{document\}|$)/g, '\n');
    // Stage 19N1L: previous equation-coverage runs insert wrappers around
    // equation explanations. Remove the whole wrapper before the next prompt
    // is built; otherwise the next equation inventory treats old AI
    // explanations as if they were original paper context/equations.
    s = removeLatexaiEquationExplanationRegions(s);
    return s;
  }

  function stripLatexaiVisibleEditBlocks(text) {
    let s = removeLatexaiSuggestionCommentRegions(text);
    // Remove visible AI edit blocks from prompt context. Keep macro definitions
    // because parseLatexMacroBlocks only catches actual \lai{...} calls.
    const blocks = parseLatexMacroBlocks(s, 'lai').concat(parseLatexMacroBlocks(s, 'laiold')).sort((a, b) => b.start - a.start);
    blocks.forEach((b) => {
      s = s.slice(0, b.start) + '\n% [Latexai previous visible AI edit omitted from debate context]\n' + s.slice(b.end);
    });
    return s;
  }

  function removeLooseTargetSectionSuggestionText(text) {
    // Stage 19N1H: earlier experiments could leave plain text advice such as
    // "Target section: X Add ..." outside \lai blocks. These are AI suggestion
    // artifacts, not paper structure. Remove them only in cleanup/prompt context.
    const lines = String(text || '').split('\n');
    const out = [];
    let skipping = false;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const trimmed = line.trim();
      const startsLooseTarget = /^Target\s+section\s*:/i.test(trimmed);
      const startsLatexHeading = /^\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*\{/i.test(trimmed);
      const startsCommentBoundary = /^%\s*---\s*Latexai/i.test(trimmed);
      if (startsLooseTarget) { skipping = true; continue; }
      if (skipping && (startsLatexHeading || startsCommentBoundary || trimmed === '' || /^\s*\\(?:begin|end)\s*\{/i.test(trimmed))) {
        skipping = false;
      }
      if (!skipping) out.push(line);
    }
    return out.join('\n').replace(/\n{4,}/g, '\n\n\n');
  }

  function sourceForAgentVisiblePrompt() {
    return removeLooseTargetSectionSuggestionText(stripLatexaiVisibleEditBlocks(getActiveSource()));
  }

  function removePreviousLaiBlocksFromSource(text) {
    let s = removeLatexaiSuggestionCommentRegions(String(text || ''));
    const blocks = parseLatexMacroBlocks(s, 'lai').concat(parseLatexMacroBlocks(s, 'laiold')).sort((a, b) => b.start - a.start);
    blocks.forEach((b) => {
      const before = s.slice(Math.max(0, b.start - 30), b.start);
      if (/\\(?:long\s*)?def\s*$|\\(?:newcommand|providecommand)\s*\{?\s*$/i.test(before)) return;
      s = s.slice(0, b.start) + '\n' + s.slice(b.end);
    });
    s = removeLooseTargetSectionSuggestionText(s);
    return s.replace(/\n{4,}/g, '\n\n\n').trimEnd() + '\n';
  }

  function repeatedHeadingWarnings(source) {
    const units = extractLatexSections(source || '');
    const seen = new Map();
    const dups = [];
    units.forEach((u) => {
      const key = titleKeyForMatch(u.title || '');
      if (!key) return;
      const prev = seen.get(key) || [];
      prev.push(u);
      seen.set(key, prev);
    });
    seen.forEach((arr) => {
      if (arr.length > 1) dups.push(arr[0].title + ' ×' + arr.length);
    });
    return dups;
  }

  function maybeWarnRepeatedHeadings(prefix) {
    const dups = repeatedHeadingWarnings(getActiveSource());
    if (dups.length) {
      status((prefix || 'Warning') + ': duplicate section headings detected: ' + dups.slice(0, 6).join(', ') + (dups.length > 6 ? ', ...' : '') + '. Consider cleaning/restoring source before debate.', 'warn');
      return true;
    }
    return false;
  }

  function cleanPreviousAiSuggestions() {
    const before = getActiveSource();
    const after = removePreviousLaiBlocksFromSource(before);
    if (after === before) {
      maybeWarnRepeatedHeadings('No previous \lai blocks removed');
      status('No previous visible \lai / \laiold suggestions found to remove. Duplicate headings, if any, may already be plain source text.', 'warn');
      return;
    }
    setActiveSource(after, 'Previous Latexai AI suggestions removed from active source.', { kind: 'cleanup' });
    const dups = repeatedHeadingWarnings(after);
    if (dups.length) status('Cleaned old \lai suggestions. Still found duplicate headings: ' + dups.slice(0, 6).join(', ') + '. These are now plain source text and should be manually reviewed or restored.', 'warn');
  }

  function movePostEndDocumentLaiBeforeEnd(text) {
    const s = String(text || '');
    const end = findLastEndDocument(s);
    if (!end) return s;
    const after = s.slice(end.end);
    const afterTrim = after.trim();
    if (!afterTrim || !containsLaiMarkup(afterTrim)) return s;
    const before = s.slice(0, end.index).replace(/\s+$/, '');
    const movedHeader = '% --- Latexai appended AI suggestions (moved before \\end{document}) ---';
    return [before, '', movedHeader, afterTrim, '', end.text, ''].join('\n');
  }

  function normalizeLaiDraftForCompilation(text, mode) {
    let s = ensureLatexaiColorMacros(String(text || ''));
    // Append-only drafts from Stage 19M2 may include \lai blocks after \end{document}.
    // LaTeX ignores anything after \end{document}, so move those suggestions just before it.
    if (mode === 'append' || containsLaiMarkup(s.slice((findLastEndDocument(s)?.end || s.length)))) {
      s = movePostEndDocumentLaiBeforeEnd(s);
    }
    return s;
  }



  function isEscapedAt(text, index) {
    let slashCount = 0;
    for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) slashCount += 1;
    return slashCount % 2 === 1;
  }

  function escapeUnescapedAlignmentTabs(text) {
    const s = String(text || '');
    // The real-agent branch output is prose/edit text, not a tabular/align environment.
    // A bare author-list ampersand such as "Newey, W. K., & McFadden" causes
    // "Misplaced alignment tab character &". Escape only unescaped ampersands.
    let out = '';
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      if (ch === '&' && !isEscapedAt(s, i)) out += '\\&';
      else out += ch;
    }
    return out;
  }

  function sanitizeLatexChangedRegionForCompile(before, after) {
    const original = String(before || '');
    const draft = String(after || '');
    if (!draft || original === draft) return draft;
    const diff = firstDiffRange(original, draft);
    let start = diff.start;
    let end = diff.newEnd;
    // Expand to line boundaries so an inserted author-list line is sanitized as a unit.
    while (start > 0 && draft[start - 1] !== '\n') start -= 1;
    while (end < draft.length && draft[end] !== '\n') end += 1;
    const changed = draft.slice(start, end);
    const sanitized = escapeUnescapedAlignmentTabs(changed);
    return draft.slice(0, start) + sanitized + draft.slice(end);
  }

  function parseLatexMacroBlocks(text, macroName) {
    const s = String(text || '');
    const needle = '\\' + macroName;
    const out = [];
    let i = 0;
    while ((i = s.indexOf(needle, i)) >= 0) {
      const nameEnd = i + needle.length;
      if (/[A-Za-z@]/.test(s[nameEnd] || '')) { i = nameEnd; continue; }
      let j = nameEnd;
      while (/\s/.test(s[j] || '')) j += 1;
      if (s[j] !== '{') { i = nameEnd; continue; }
      let depth = 0;
      let escaped = false;
      for (let k = j; k < s.length; k += 1) {
        const ch = s[k];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '{') depth += 1;
        else if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            out.push({ macro: macroName, start: i, end: k + 1, raw: s.slice(i, k + 1), body: s.slice(j + 1, k) });
            i = k + 1;
            break;
          }
        }
      }
      if (i < nameEnd) i = nameEnd;
    }
    return out;
  }

  function renderLaiColorPreviewHtml(draft) {
    const blocks = parseLatexMacroBlocks(draft, 'lai').concat(parseLatexMacroBlocks(draft, 'laiold')).sort((a, b) => a.start - b.start);
    if (!blocks.length) return '<div class="settings-note warn">No \\lai or \\laiold blocks found in this draft.</div>';
    return '<div class="lai-color-preview-note">Visual preview only: red = <code>\\lai{...}</code> new AI text; blue = <code>\\laiold{...}</code> preserved old text. The PDF will show these colors after Compile PDF if the macros are present and <code>\\laishowchangestrue</code> is active.</div>' +
      '<div class="lai-color-preview-list">' + blocks.map((b, idx) => {
        const cls = b.macro === 'laiold' ? 'old' : 'new';
        const label = b.macro === 'laiold' ? 'OLD / blue' : 'NEW / red';
        return '<div class="lai-color-preview-block ' + cls + '"><div class="lai-color-preview-label">' + esc(String(idx + 1)) + '. ' + esc(label) + '</div><pre>' + esc(b.body.trim() || b.raw) + '</pre></div>';
      }).join('') + '</div>';
  }

  function jumpEditorToOffset(offset, endOffset) {
    const editor = $('sourceEditor');
    const safeStart = Math.max(0, Math.min(Number(offset) || 0, String(editor?.value || '').length));
    const safeEnd = Math.max(safeStart, Math.min(Number(endOffset) || safeStart, String(editor?.value || '').length));
    try { NS.Editor?.focus?.(); } catch (_err) {}
    if (editor) {
      try { editor.focus(); } catch (_err) {}
      try { editor.setSelectionRange(safeStart, safeEnd || safeStart); } catch (_err) {}
      try {
        const lc = lineColForOffset(editor.value, safeStart);
        editor.scrollTop = Math.max(0, (lc.line - 5) * 22);
      } catch (_err) {}
      try { editor.dispatchEvent(new Event('keyup', { bubbles: true })); } catch (_err) {}
    }
  }

  function updateVisibleEditor(value) {
    const text = String(value ?? '');
    let usedEditorApi = false;
    try {
      if (NS.Editor && typeof NS.Editor.setText === 'function') {
        NS.Editor.setText(text);
        usedEditorApi = true;
      }
    } catch (_err) {}
    const editor = $('sourceEditor');
    if (editor && (!usedEditorApi || editor.value !== text)) {
      editor.value = text;
      try { editor.dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
      try { editor.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
    }
    try { state()?.updateActiveText?.(text); } catch (_err) {}
    try { state()?.save?.(); } catch (_err) {}
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}
  }

  function setActiveSource(text, label, options = {}) {
    const before = getActiveSource();
    const value = String(text ?? '');
    updateVisibleEditor(value);
    const diff = firstDiffRange(before, value);
    const firstLaiAfterChange = value.indexOf('\\lai', Math.max(0, diff.start - 20));
    const jumpStart = firstLaiAfterChange >= 0 ? firstLaiAfterChange : diff.start;
    const jumpEnd = firstLaiAfterChange >= 0 ? Math.min(value.length, firstLaiAfterChange + 80) : Math.min(value.length, diff.newEnd);
    jumpEditorToOffset(jumpStart, jumpEnd);
    const lc = lineColForOffset(value, jumpStart);
    const suffix = options?.kind ? ` Applied ${options.kind}; jumped to line ${lc.line}. Search for \\lai{ or copied citation keys if needed.` : '';
    toast((label || 'LaTeX source updated.') + suffix);
    status((label || 'LaTeX source updated.') + ' First changed area is around line ' + lc.line + '.', 'good');
  }

  function backendRoot() {
    const fromSettings = clean(NS.BackendUrlSettingsService?.getMemoryApiBaseUrl?.() || '');
    const raw = clean($('branchWorkflowBackendUrl')?.value) || clean($('memoryBackendUrl')?.value) || fromSettings || getStored('latexai:memory-backend-url', '');
    const base = raw.replace(/\/+$/, '');
    if (!base) return '';
    if (/\/api\/lumina\/memory$/i.test(base)) return base.replace(/\/api\/lumina\/memory$/i, '/api/lumina');
    if (/\/api\/lumina$/i.test(base)) return base;
    if (/\/api\/lumina\/latex\/compile$/i.test(base)) return base.replace(/\/api\/lumina\/latex\/compile$/i, '/api/lumina');
    return base + '/api/lumina';
  }

  function memoryToken() {
    return clean(NS.BackendUrlSettingsService?.getMemoryProxyToken?.() || '') || clean($('memoryProxyToken')?.value) || getStored('latexai:memory-proxy-token', '');
  }

  function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const token = memoryToken();
    if (token) { h.Authorization = 'Bearer ' + token; h['X-Lumina-Token'] = token; }
    return h;
  }

  async function backendPost(path, body) {
    const root = backendRoot();
    if (!root) throw new Error('Missing memory/backend URL. Set Memory backend URL in Settings.');
    const res = await fetch(root + path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body || {}) });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : {}; } catch (_err) { data = { raw: text }; }
    if (!res.ok || data?.ok === false) throw new Error(data?.error?.message || data?.detail || data?.message || ('HTTP ' + res.status + ': ' + text));
    return data;
  }

  async function backendGet(path) {
    const root = backendRoot();
    if (!root) throw new Error('Missing memory/backend URL. Set Memory backend URL in Settings.');
    const res = await fetch(root + path, { method: 'GET', headers: authHeaders() });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : {}; } catch (_err) { data = { raw: text }; }
    if (!res.ok || data?.ok === false) throw new Error(data?.error?.message || data?.detail || data?.message || ('HTTP ' + res.status + ': ' + text));
    return data;
  }


  function backendServiceRoot() {
    const root = backendRoot();
    if (!root) return '';
    return root.replace(/\/api\/lumina$/i, '');
  }

  async function fetchJsonWithStatus(url, options = {}) {
    const started = Date.now();
    try {
      const res = await fetch(url, { cache: 'no-store', ...options });
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : {}; } catch (_err) { json = { raw: text }; }
      return { ok: res.ok && json?.ok !== false, httpStatus: res.status, latencyMs: Date.now() - started, data: json, error: res.ok ? (json?.error?.message || json?.detail || '') : (json?.error?.message || json?.detail || text || ('HTTP ' + res.status)) };
    } catch (err) {
      return { ok: false, httpStatus: 0, latencyMs: Date.now() - started, data: null, error: String(err?.message || err) };
    }
  }

  function renderVerifierChecklist(results) {
    const items = Array.isArray(results) ? results : [];
    if (!items.length) return '<div class="settings-note warn">No verifier checks ran.</div>';
    return '<div class="branch-verifier-list">' + items.map((r) => {
      const cls = r.ok ? 'pass' : 'fail';
      const icon = r.ok ? '✓' : '✗';
      const detail = r.detail || r.error || '';
      return '<div class="branch-verifier-item ' + cls + '"><span class="branch-verifier-icon">' + icon + '</span><div><strong>' + esc(r.label || r.name || 'check') + '</strong><div class="small">' + esc(detail) + '</div></div></div>';
    }).join('') + '</div>';
  }

  async function verifyDevilsAdvocateSetup() {
    const root = backendRoot();
    const service = backendServiceRoot();
    if (!root || !service) throw new Error('Set Memory backend URL first. It should be the base Cloud Run URL, not /api/lumina/memory.');
    status('Verifying Devil’s Advocate backend, AI, saved-run, and model routes...', 'warn');
    const tokenHeaders = authHeaders();
    const get = (label, url) => fetchJsonWithStatus(url, { method: 'GET', headers: tokenHeaders }).then((r) => ({ label, ...r }));
    const post = (label, url, body) => fetchJsonWithStatus(url, { method: 'POST', headers: tokenHeaders, body: JSON.stringify(body || {}) }).then((r) => ({ label, ...r }));
    const checks = [];
    checks.push(await get('Backend /health', service + '/health'));
    checks.push(await get('Memory health', root + '/memory/health'));
    checks.push(await get('Branch route inventory', root + '/debate/debug/branches'));
    checks.push(await get('Saved-run list route', root + '/debate/saved-runs'));
    checks.push(await get('AI/key status', root + '/ai/status'));
    checks.push(await get('Live provider model list', root + '/models?refresh=1'));
    checks.push(await post('Learned selector route exists', root + '/debate/select-learned-branch', { branches: [{ title: 'Verifier branch', branchType: 'verifier', selectionScore: 0.5 }], selectedBranchLimit: 1, latexSource: getActiveSource().slice(0, 4000), query: 'verifier' }));
    const normalized = checks.map((c) => {
      let detail = '';
      if (c.data?.stage) detail += 'stage=' + c.data.stage + ' ';
      if (c.data?.routeStage) detail += 'routeStage=' + c.data.routeStage + ' ';
      if (c.data?.providers) {
        const p = c.data.providers;
        detail += 'openai=' + !!p.openai?.configured + ', gemini=' + !!p.gemini?.configured + ' ';
      }
      if (c.data?.metadata?.openai || c.data?.metadata?.gemini) {
        detail += 'openaiModels=' + (c.data.metadata.openai?.count ?? '?') + ', geminiModels=' + (c.data.metadata.gemini?.count ?? '?') + ' ';
      }
      if (!detail && c.data?.ok !== undefined) detail = 'ok=' + c.data.ok;
      if (c.httpStatus) detail = 'HTTP ' + c.httpStatus + ' · ' + detail;
      if (!c.ok && c.error) detail += ' ' + c.error;
      return { ...c, detail: detail.trim() };
    });
    const passed = normalized.filter((c) => c.ok).length;
    const body = '<div class="settings-note"><strong>Devil’s Advocate setup verifier:</strong> ' + passed + '/' + normalized.length + ' checks passed.</div>' + renderVerifierChecklist(normalized) + '<div class="settings-note compact">This verifier uses the corrected route <code>/api/lumina/debate/evaluate-branches</code> for real branch evaluation; the old debug/evaluate URL is no longer required.</div>';
    renderSummary('Devil’s Advocate setup verifier', body);
    status('Verifier complete: ' + passed + '/' + normalized.length + ' checks passed.', passed === normalized.length ? 'good' : 'warn');
    return normalized;
  }

  function selectedRealPayload() {
    return lastSelectionData?.realAgentRunPayload || lastSelectionData?.real_agent_run_payload || null;
  }

  function memorySelectionPolicy() {
    return clean(getStored('latexai:memory-selection-policy', 'ucb')) || 'ucb';
  }

  function inputValue(id, fallback = '') {
    const node = $(id);
    return clean(node?.value) || fallback;
  }


  function normalizeSectionTitle(title) {
    return clean(String(title || '').replace(/\\[A-Za-z]+\s*/g, '').replace(/[{}]/g, ' ').replace(/\s+/g, ' '));
  }

  const LATEX_STRUCTURE_LEVELS = ['part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];
  function structureLevelRank(level) {
    const idx = LATEX_STRUCTURE_LEVELS.indexOf(String(level || '').toLowerCase());
    return idx >= 0 ? idx : LATEX_STRUCTURE_LEVELS.length;
  }

  function addRegexRanges(out, text, regex) {
    const s = String(text || '');
    let m = null;
    regex.lastIndex = 0;
    while ((m = regex.exec(s))) out.push({ start: m.index, end: m.index + m[0].length });
  }

  function ignoredStructureRanges(text) {
    const s = String(text || '');
    const ranges = [];
    parseLatexMacroBlocks(s, 'lai').forEach((b) => ranges.push({ start: b.start, end: b.end }));
    parseLatexMacroBlocks(s, 'laiold').forEach((b) => ranges.push({ start: b.start, end: b.end }));
    addRegexRanges(ranges, s, /% --- Latexai targeted Devil's Advocate suggestion for section:[\s\S]*?% --- end Latexai targeted suggestion ---/g);
    addRegexRanges(ranges, s, /% --- Latexai appended multi-section Devil's Advocate suggestions ---[\s\S]*?(?=\\end\s*\{document\}|$)/g);
    addRegexRanges(ranges, s, /% --- Latexai appended AI suggestions \(moved before \\end\{document\}\) ---[\s\S]*?(?=\\end\s*\{document\}|$)/g);
    addRegexRanges(ranges, s, /% --- Latexai equation explanation suggestion for:[\s\S]*?% --- end Latexai equation explanation suggestion ---/g);
    return ranges.sort((a, b) => a.start - b.start);
  }

  function isInsideRange(index, ranges) {
    return (ranges || []).some((r) => index >= r.start && index < r.end);
  }

  function extractLatexSections(source) {
    const s = String(source || '');
    // Stage 19N1G: parse real document hierarchy broadly while ignoring headings
    // that appear inside prior \lai / \laiold suggestions. Otherwise reruns treat
    // old "Target section:" markers as new document sections and repeat edits.
    const ignoreRanges = ignoredStructureRanges(s);
    const re = /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*\{([^{}]{1,180})\}/g;
    const found = [];
    let m = null;
    while ((m = re.exec(s))) {
      if (isInsideRange(m.index, ignoreRanges)) continue;
      const normalizedTitle = normalizeSectionTitle(m[2]);
      if (/^target\s+section\s*:/i.test(normalizedTitle)) continue;
      found.push({
        level: m[1],
        levelRank: structureLevelRank(m[1]),
        title: normalizedTitle,
        rawTitle: m[2],
        command: m[0],
        start: m.index,
        headerEnd: m.index + m[0].length
      });
    }
    for (let i = 0; i < found.length; i += 1) {
      const cur = found[i];
      let end = s.length;
      for (let j = i + 1; j < found.length; j += 1) {
        // A structural unit ends at the next unit with the same or higher hierarchy.
        // Example: a subsection ends at the next subsection or section/chapter.
        if (found[j].levelRank <= cur.levelRank) { end = found[j].start; break; }
      }
      cur.end = end;
      cur.body = s.slice(cur.start, end);
      cur.key = cur.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      cur.displayTitle = cur.level + ': ' + cur.title;
    }
    return found.filter((x) => x.title);
  }

  function splitTargetSections(value) {
    return String(value || '').split(/[,;\n]+/).map((x) => normalizeSectionTitle(x)).filter(Boolean);
  }

  function documentTargetUnits(source) {
    return extractLatexSections(source);
  }

  function topLevelSections(source) {
    // Historical name retained for insertion and outline helpers. In Stage 19N1H it
    // intentionally returns all parsed targetable units, not only \section headings.
    const units = documentTargetUnits(source);
    if (units.length) return units;
    return [];
  }

  function selectedTargetPickerSections() {
    const node = $('branchWorkflowTargetPicker');
    if (!node) return [];
    return Array.from(node.selectedOptions || []).map((opt) => normalizeSectionTitle(opt.value || opt.textContent || '')).filter(Boolean);
  }

  function targetSelectorMode() {
    return inputValue('branchWorkflowSectionScope', 'salient') || 'salient';
  }

  function visibleContextMode() {
    return inputValue('branchWorkflowVisibleContextMode', 'outline_selected_excerpts') || 'outline_selected_excerpts';
  }

  function payloadSourceMode() {
    return inputValue('branchWorkflowPayloadSourceMode', 'include_full_source') || 'include_full_source';
  }

  function equationCoverageMode() {
    return inputValue('branchWorkflowEquationCoverageMode', 'auto') || 'auto';
  }

  function equationCoverageActive() {
    const mode = equationCoverageMode();
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    const signal = [
      inputValue('branchWorkflowQuery', ''),
      inputValue('branchWorkflowReviewText', ''),
      inputValue('branchWorkflowPaperSummary', '')
    ].join(' ');
    return /\b(?:math|mathematical|equation|equations|derivation|derive|proof\s+step|explain\s+all\s+math|every\s+equation|below\s+it)\b/i.test(signal);
  }

  function payloadLatexSourceForAI() {
    const mode = payloadSourceMode();
    const src = stripLatexaiVisibleEditBlocks(getActiveSource());
    if (mode === 'omit_full_source') return '';
    if (mode === 'include_truncated_source') return truncateMiddle(src, 45000, '... [payload latexSource truncated by Latexai Stage 19N1H] ...');
    return src;
  }

  function truncateMiddle(text, maxLen, markerText) {
    const s = String(text || '');
    const n = Number(maxLen) || 0;
    if (!n || s.length <= n) return s;
    const marker = '\n' + (markerText || '... [truncated] ...') + '\n';
    const keep = Math.max(1000, n - marker.length);
    const front = Math.floor(keep * 0.55);
    const back = keep - front;
    return s.slice(0, front) + marker + s.slice(-back);
  }

  function latexStructureLabel(unit) {
    if (!unit) return '';
    return (unit.level || 'section') + ': ' + unit.title;
  }

  function unitByTitle(units, title) {
    return (units || []).find((sec) => sectionMatches(sec, title));
  }

  function desiredTargetSections(runPayload) {
    const explicit = splitTargetSections(inputValue('branchWorkflowTargetSection', ''));
    if (explicit.length) return explicit.slice(0, 60);
    const scope = targetSelectorMode();
    const source = getActiveSource();
    const units = topLevelSections(source);
    if (scope === 'selected') {
      const selected = selectedTargetPickerSections();
      if (selected.length) return selected.slice(0, 60);
      return [];
    }
    if (scope === 'whole') return units.map((s) => s.title).slice(0, 120);
    if (scope === 'first6') return units.map((s) => s.title).slice(0, 6);
    if (scope === 'salient') {
      const preferred = [
        /abstract|intro|motivation/i,
        /contribution/i,
        /related|literature/i,
        /prelim|notation|background/i,
        /setup|problem|goal|assumption/i,
        /main|result|theorem|lemma|proposition/i,
        /proof|analysis|geometric|orthogonality|variance/i,
        /algorithm|method|sampler|estimator/i,
        /experiment|evaluation|application/i,
        /limitation|future|conclusion|discussion/i
      ];
      const chosen = [];
      preferred.forEach((pat) => {
        const hit = units.find((sec) => pat.test(sec.title) && !chosen.includes(sec.title));
        if (hit) chosen.push(hit.title);
      });
      units.forEach((sec) => { if (chosen.length < 8 && !chosen.includes(sec.title)) chosen.push(sec.title); });
      return chosen.slice(0, 12);
    }
    const branchTargets = runPayload?.executionPlan?.targetSections || runPayload?.selectedBranch?.targetSections || [];
    return Array.isArray(branchTargets) ? branchTargets.map(normalizeSectionTitle).filter(Boolean) : [];
  }

  async function sectionCoverageInstruction(runPayload) {
    const scope = targetSelectorMode();
    const targets = desiredTargetSections(runPayload);
    const modeName = scope === 'selected' ? 'user-selected document units' : scope;
    const explicitOverride = splitTargetSections(inputValue('branchWorkflowTargetSection', '')).length;
    const templateName = (scope === 'branch' && !explicitOverride) ? 'coverage-branch' : 'coverage-multisection';
    const tpl = await loadPromptTemplate(templateName);
    return fillPromptTemplate(tpl, {
      modeName,
      scope,
      requestedTargets: targets.join(', ') || 'none',
      targetCount: targets.length,
      wholePaperActive: scope === 'whole' ? 'true' : 'false'
    });
  }

  function sectionMatches(sec, title) {
    const a = normalizeSectionTitle(sec?.title).toLowerCase();
    const b = normalizeSectionTitle(title).toLowerCase();
    return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
  }

  function excerptForUnit(sec, perSectionBudget) {
    const body = String(sec?.body || '').trim();
    if (!body) return '';
    const budget = Math.max(700, Number(perSectionBudget) || 1600);
    if (body.length <= budget) return body;
    const chunks = [];
    const first = Math.floor(budget * 0.45);
    const last = Math.floor(budget * 0.20);
    chunks.push(body.slice(0, first));
    const importantRe = /(\\begin\s*\{(?:theorem|lemma|proposition|corollary|proof|assumption|definition|algorithm|equation|align)\}|\\\[|\\\(|\b(theorem|lemma|proof|assumption|definition|variance|orthogonality|influence function|efficient|GMM|limitation|future work)\b)/ig;
    let m = null;
    const seen = new Set();
    while ((m = importantRe.exec(body)) && chunks.join('\n').length < budget - last - 200) {
      const pos = Math.max(0, m.index - 300);
      const key = Math.floor(pos / 400);
      if (seen.has(key)) continue;
      seen.add(key);
      chunks.push('\n% ... [important excerpt from this section] ...\n' + body.slice(pos, Math.min(body.length, pos + 900)));
    }
    chunks.push('\n% ... [section ending excerpt] ...\n' + body.slice(-last));
    return truncateMiddle(chunks.join('\n'), budget + 700, '% ... [section excerpt truncated by Latexai] ...');
  }


  function sectionTitleAtOffset(units, offset) {
    const pos = Number(offset) || 0;
    let best = null;
    (units || []).forEach((u) => {
      if (pos >= u.start && pos < u.end) {
        if (!best || u.start >= best.start) best = u;
      }
    });
    return best?.title || '';
  }

  function rangesOverlap(a, b) {
    return a && b && a.start < b.end && b.start < a.end;
  }

  function extractDisplayEquationTargets(source, options) {
    const s = String(source || '');
    const opts = options || {};
    const units = topLevelSections(s);
    const ignoreRanges = ignoredStructureRanges(s);
    const candidates = [];
    const addPattern = (kind, re) => {
      let m = null;
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        const start = m.index;
        const end = m.index + m[0].length;
        if (ignoreRanges.some((r) => rangesOverlap({ start, end }, r))) continue;
        if (candidates.some((c) => rangesOverlap({ start, end }, c))) continue;
        const raw = m[0];
        const body = raw.length > 2200 ? truncateMiddle(raw, 2200, '% ... [equation truncated for prompt] ...') : raw;
        const before = s.slice(Math.max(0, start - 260), start).replace(/\s+/g, ' ').trim();
        const after = s.slice(end, Math.min(s.length, end + 260)).replace(/\s+/g, ' ').trim();
        candidates.push({ kind, start, end, raw, body, before, after, section: sectionTitleAtOffset(units, start) || 'Document' });
      }
    };
    addPattern('environment', /\\begin\s*\{(equation\*?|align\*?|alignat\*?|gather\*?|multline\*?|eqnarray\*?)\}[\s\S]*?\\end\s*\{\1\}/g);
    addPattern('bracket-display', /\\\[[\s\S]*?\\\]/g);
    addPattern('dollar-display', /\$\$[\s\S]*?\$\$/g);
    candidates.sort((a, b) => a.start - b.start);
    const maxCount = Math.max(1, Math.min(Number(opts.maxCount) || 80, 150));
    return candidates.slice(0, maxCount).map((c, idx) => ({
      ...c,
      id: 'eq_' + String(idx + 1).padStart(3, '0'),
      label: 'eq_' + String(idx + 1).padStart(3, '0') + ' · ' + c.section
    }));
  }

  function selectedEquationTargets(runPayload) {
    const source = sourceForAgentVisiblePrompt();
    const all = extractDisplayEquationTargets(source, { maxCount: 120 });
    if (!all.length) return [];
    const scope = targetSelectorMode();
    const targets = desiredTargetSections(runPayload).map((t) => titleKeyForMatch(t)).filter(Boolean);
    if (scope === 'whole' || !targets.length) return all;
    const filtered = all.filter((eq) => {
      const secKey = titleKeyForMatch(eq.section || '');
      return targets.some((t) => secKey === t || secKey.includes(t) || t.includes(secKey));
    });
    return filtered.length ? filtered : all;
  }

  function buildEquationCoverageContext(runPayload) {
    if (!equationCoverageActive()) return '';
    const eqs = selectedEquationTargets(runPayload);
    if (!eqs.length) {
      return 'MATH EQUATION COVERAGE MODE ACTIVE. No display equations were detected in the selected visible source. If the user asked for equation explanations, say that no display equations were found and do not substitute citation/related-work edits.';
    }
    const maxVisible = Math.min(eqs.length, 80);
    const items = eqs.slice(0, maxVisible).map((eq) => {
      return [
        'Equation id: ' + eq.id,
        'Containing section/unit: ' + eq.section,
        'Preceding context: ' + (eq.before || '(none)'),
        'Equation source:',
        eq.body,
        'Following context: ' + (eq.after || '(none)')
      ].join('\n');
    }).join('\n\n---\n\n');
    const omitted = eqs.length > maxVisible ? '\n\nNote: ' + (eqs.length - maxVisible) + ' additional equation(s) were omitted from the visible prompt by the safety budget.' : '';
    return [
      'MATH EQUATION COVERAGE MODE ACTIVE.',
      'The user specifically asked for mathematical equation / derivation explanations.',
      'The final editor must provide an explanatory edit below EACH listed equation id, not citation-only or introduction-only edits.',
      'Use this exact block form for each equation explanation:',
      '\\lai{%',
      '% Target equation id: <equation id>',
      '% Target section: <containing section/unit>',
      '<short LaTeX-ready explanatory text that should appear immediately below the equation>',
      '}',
      'Do not output "No edits recommended" for a listed equation unless the user explicitly asked to skip obvious equations. For this task, every listed equation should get an explanation.',
      'Detected display equations visible to the model:',
      items + omitted
    ].join('\n');
  }

  function buildSectionAwareExcerpt(runPayload) {
    const source = sourceForAgentVisiblePrompt();
    const units = topLevelSections(source);
    const targets = desiredTargetSections(runPayload);
    const outline = units.length ? units.map((s, i) => String(i + 1) + '. ' + latexStructureLabel(s)).join('\n') : '(no LaTeX structural headings detected)';
    const mode = visibleContextMode();
    const contextParts = [];

    contextParts.push('Document section/chapter/subsection outline:\n' + outline);
    contextParts.push('Visible context mode: ' + mode + '.');

    if (mode === 'whole_truncated_selected_focus') {
      contextParts.push('===== WHOLE PAPER CONTEXT (TRUNCATED, VISIBLE TO MODEL) =====\n' + truncateMiddle(source, 38000, '% ... [whole paper middle truncated by Latexai Stage 19N1H] ...'));
    } else if (mode === 'full_source_if_safe') {
      if (source.length <= 65000) {
        contextParts.push('===== FULL PAPER CONTEXT (VISIBLE TO MODEL) =====\n' + source);
      } else {
        contextParts.push('===== WHOLE PAPER CONTEXT (TOO LARGE; TRUNCATED BUT VISIBLE TO MODEL) =====\n' + truncateMiddle(source, 65000, '% ... [full paper truncated by Latexai Stage 19N1H for prompt length] ...'));
      }
    } else if (mode === 'selected_excerpts_only') {
      // No full outline beyond the compact outline above; selected excerpts follow below.
    }

    if (!units.length || !targets.length) {
      if (mode === 'selected_excerpts_only' || mode === 'outline_selected_excerpts') {
        contextParts.push('===== FALLBACK SOURCE EXCERPT =====\n' + source.slice(0, 16000));
      }
      return contextParts.join('\n\n');
    }

    const chosen = [];
    targets.forEach((t) => {
      const hit = unitByTitle(units, t);
      if (hit && !chosen.includes(hit)) chosen.push(hit);
    });
    if (!chosen.length) {
      contextParts.push('===== FALLBACK SOURCE EXCERPT =====\n' + source.slice(0, 16000));
      return contextParts.join('\n\n');
    }
    const perSectionBudget = Math.max(900, Math.floor(18000 / Math.max(1, chosen.length)));
    const chunks = chosen.map((sec) => {
      return '===== TARGET EXCERPT: ' + latexStructureLabel(sec) + ' =====\n' + excerptForUnit(sec, perSectionBudget);
    });
    contextParts.push('Requested target excerpts visible to model:\n' + chunks.join('\n\n'));
    return contextParts.join('\n\n');
  }

  function applySectionScopeToSelection(data) {
    const scope = targetSelectorMode();
    const explicit = splitTargetSections(inputValue('branchWorkflowTargetSection', ''));
    if (scope === 'branch' && !explicit.length) return data;
    const targets = desiredTargetSections(data?.realAgentRunPayload || data || {});
    if (!targets.length) return data;
    try {
      data.selectedBranch = { ...(data.selectedBranch || {}), targetSections: targets };
      data.executionPlan = { ...(data.executionPlan || {}), targetSections: targets };
      if (data.realAgentRunPayload) {
        data.realAgentRunPayload = {
          ...data.realAgentRunPayload,
          selectedBranch: { ...(data.realAgentRunPayload.selectedBranch || data.selectedBranch || {}), targetSections: targets },
          executionPlan: { ...(data.realAgentRunPayload.executionPlan || data.executionPlan || {}), targetSections: targets }
        };
        const steps = data.realAgentRunPayload.executionPlan.steps;
        if (Array.isArray(steps)) {
          data.realAgentRunPayload.executionPlan.steps = steps.map((st) => ({ ...st, targetSections: targets }));
        }
      }
      if (equationCoverageActive()) {
        const eqTargets = selectedEquationTargets(data?.realAgentRunPayload || data || {});
        const mathTitle = 'Explain mathematical equations and derivation steps';
        const mathHint = 'For every detected display equation in the requested scope, produce a short LaTeX-ready \\lai explanation immediately below that equation.';
        data.selectedBranch = { ...(data.selectedBranch || {}), title: mathTitle, branchType: 'math_equation_exposition', latexEditHint: mathHint, targetSections: targets };
        data.executionPlan = { ...(data.executionPlan || {}), title: mathTitle, selectedBranchType: 'math_equation_exposition', targetSections: targets, latexEditTargets: eqTargets.map((eq) => ({ equationId: eq.id, section: eq.section, mode: 'insert-below-equation' })) };
        if (data.realAgentRunPayload) {
          data.realAgentRunPayload.selectedBranch = { ...(data.realAgentRunPayload.selectedBranch || data.selectedBranch || {}), title: mathTitle, branchType: 'math_equation_exposition', latexEditHint: mathHint, targetSections: targets };
          data.realAgentRunPayload.executionPlan = { ...(data.realAgentRunPayload.executionPlan || data.executionPlan || {}), title: mathTitle, selectedBranchType: 'math_equation_exposition', targetSections: targets, latexEditTargets: eqTargets.map((eq) => ({ equationId: eq.id, section: eq.section, mode: 'insert-below-equation' })) };
        }
      }
      data.sectionCoverageOverride = { scope, targetSections: targets, equationCoverageActive: equationCoverageActive(), frontendStage: STAGE };
    } catch (_err) {}
    return data;
  }

  function planPayload() {
    const latexSource = sourceForAgentVisiblePrompt();
    const sectionTargets = desiredTargetSections(null);
    const sectionScope = targetSelectorMode();
    const queryBase = inputValue('branchWorkflowQuery', 'novelty theorem assumptions citation coverage clarity limitations');
    const coverageNote = sectionScope === 'branch' ? '' : ('\n\nSection coverage request: evaluate and propose edits across these sections, not only the Introduction: ' + sectionTargets.join(', '));
    const equationNote = equationCoverageActive() ? '\n\nEquation coverage request: explain every detected display equation in the requested scope and produce a visible \lai edit immediately below each equation. Do not substitute citation/related-work edits for this task.' : '';
    const query = queryBase + (sectionScope === 'branch' ? '' : ' multi-section section-aware whole-paper revision') + (equationCoverageActive() ? ' equation explanation derivation below each equation' : '');
    const reviewText = inputValue('branchWorkflowReviewText', queryBase) + coverageNote + equationNote;
    const paperSummary = inputValue('branchWorkflowPaperSummary', 'Current Latexai editor source.');
    return {
      workflow: 'latex-paper-debate',
      agentRole: 'synthesizer',
      taskType: 'main_editor_branch_workflow',
      latexSource,
      reviewText,
      paperSummary,
      query,
      limit: 5,
      selectionLimit: 3,
      rolloutDepth: 2,
      branchLimit: 5,
      contextLimit: 12,
      includeMemoryContext: true,
      recordContextSelection: false,
      recordTrajectory: false,
      memorySelectionPolicy: memorySelectionPolicy(),
      epsilon: Number(getStored('latexai:memory-bandit-epsilon', '0.10')),
      ucbBeta: Number(getStored('latexai:memory-bandit-ucb-beta', '0.20')),
      thompsonAlpha: Number(getStored('latexai:memory-bandit-thompson-alpha', '0.25')),
      softmaxTemperature: Number(getStored('latexai:memory-bandit-softmax-temperature', '0.25')),
      metadata: { frontendStage: STAGE, activePath: activePath(), source: 'main-editor', sectionScope, requestedTargetSections: sectionTargets, visibleContextMode: visibleContextMode(), payloadSourceMode: payloadSourceMode() }
    };
  }

  function status(text, cls = '') {
    const node = $('branchWorkflowStatus');
    if (!node) return;
    node.className = 'settings-note branch-workflow-status ' + (cls || '');
    node.textContent = text;
  }

  function renderSummary(title, html) {
    const node = $('branchWorkflowOutput');
    if (!node) return;
    // Stage 19N1R1: branchWorkflowOutput also has the legacy devils-output class,
    // which is display:none unless .active is present. Always reveal the run report
    // when any branch summary/result is rendered. This fixes iPad/Safari users seeing
    // only the green completion status with no visible output panel.
    node.className = 'devils-output active branch-workflow-output';
    node.setAttribute('aria-live', 'polite');
    node.innerHTML = '<div class="branch-workflow-summary-title">' + esc(title) + '</div>' + html;
    try { node.dataset.branchWorkflowLastTitle = String(title || ''); } catch (_err) {}
    try { node.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_err) {}
  }

  function renderInlinePreview(title, html) {
    const node = $('branchWorkflowPreviewDock');
    if (!node) return;
    node.className = 'branch-workflow-preview-dock is-visible';
    node.innerHTML = '<div class="branch-workflow-preview-dock-title">' + esc(title || 'Preview') + '</div>' + html;
  }

  function clearInlinePreview() {
    const node = $('branchWorkflowPreviewDock');
    if (!node) return;
    node.className = 'branch-workflow-preview-dock';
    node.innerHTML = '';
  }

  function revealWorkflowPreview() {
    const dock = $('branchWorkflowPreviewDock');
    const output = $('branchWorkflowOutput');
    const card = $('realAgentBranchCard');
    try {
      if (dock && dock.classList.contains('is-visible')) dock.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      else if (output) output.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch (_err) {}
    try { if (card) card.scrollTop = Math.max(0, card.scrollHeight - card.clientHeight); } catch (_err) {}
  }

  function renderSelection(data) {
    const b = data?.selectedBranch || data?.bestBranch || {};
    const plan = data?.executionPlan || data?.realAgentRunPayload?.executionPlan || {};
    const reasons = Array.isArray(b.selectionReason) ? b.selectionReason : [];
    const steps = Array.isArray(plan.steps) ? plan.steps : [];
    renderSummary('Selected Devil’s Advocate branch',
      '<div class="settings-note"><strong>' + esc(b.title || 'No branch title') + '</strong><br>' +
      'Type: ' + esc(b.branchType || '') + ' · score: ' + esc(b.selectionScore || b.valueScore || b.rankScore || '') + '<br>' +
      'Targets: ' + esc((b.targetSections || plan.targetSections || []).join(', ') || 'none') + '</div>' +
      (reasons.length ? '<ul class="branch-workflow-list">' + reasons.slice(0, 5).map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul>' : '') +
      (steps.length ? '<details open><summary>Agent sequence</summary><ol>' + steps.map((s) => '<li><strong>' + esc(s.agentRole) + '</strong>: ' + esc(s.taskType || '') + '</li>').join('') + '</ol></details>' : '')
    );
  }

  function extractAiText(data) {
    if (typeof data?.text === 'string') return data.text;
    if (typeof data?.output_text === 'string') return data.output_text;
    if (typeof data?.message === 'string') return data.message;
    if (Array.isArray(data?.output)) return data.output.flatMap((item) => item.content || []).map((c) => c.text || '').join('\n').trim();
    try { return JSON.stringify(data, null, 2); } catch (_err) { return String(data || ''); }
  }


  function clampNumber(value, min, max, fallback) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function debateRoundCount() {
    return clampNumber(inputValue('branchWorkflowDebateRounds', '1'), 1, 5, 1);
  }

  function summarizeOutputForTranscript(output, maxLen = 1800) {
    const text = String(output?.outputText || '').trim();
    if (!text) return '(no output text)';
    return text.length > maxLen ? text.slice(0, maxLen) + '\n...[truncated]' : text;
  }

  function transcriptText(priorOutputs) {
    const outs = Array.isArray(priorOutputs) ? priorOutputs : [];
    if (!outs.length) return 'No prior debate turns yet.';
    const chunks = outs.map((o, idx) => {
      const round = o.debateRound ? ' round ' + o.debateRound : '';
      return '[' + (idx + 1) + '] ' + (o.agentRole || 'agent') + round + ' — ' + (o.taskType || '') + '\n' + summarizeOutputForTranscript(o);
    });
    const joined = chunks.join('\n\n---\n\n');
    const maxTotal = 9000;
    if (joined.length <= maxTotal) return joined;
    return joined.slice(0, 2500) + '\n\n...[middle of transcript truncated for prompt length]...\n\n' + joined.slice(-6500);
  }

  function uniqueMemoryEvidenceItems(runPayload) {
    const branch = runPayload?.selectedBranch || {};
    const plan = runPayload?.executionPlan || {};
    const candidates = [];
    const arrays = [
      branch.memoryEvidence,
      branch.rankedMemoryEvidence,
      branch.selectedMemoryEvidence,
      branch.memoryContext,
      runPayload?.memoryEvidence,
      runPayload?.rankedMemoryEvidence,
      plan.memoryEvidence,
      plan.contextMemoryEvidence
    ];
    arrays.forEach((arr) => { if (Array.isArray(arr)) candidates.push(...arr); });
    const ids = Array.from(new Set([...(branch.memoryIdsUsed || []), ...(branch.memoryIds || []), ...(plan.memoryIdsToUse || [])].filter(Boolean)));
    ids.forEach((id) => {
      if (!candidates.some((m) => String(m?.memoryId || m?.id || '') === String(id))) candidates.push({ memoryId: id, summary: '', source: 'memory-id-only' });
    });
    const seen = new Set();
    const out = [];
    candidates.forEach((item) => {
      if (!item) return;
      const id = clean(item.memoryId || item.id || item.key || item.contextId || item.summary || '');
      const key = id || clean(item.summary || item.text || '').slice(0, 160);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    return out;
  }

  function memoryEvidenceText(item) {
    return clean(item?.summary || item?.text || item?.content || item?.description || item?.value || '');
  }

  function stepMemoryKeywords(step, priorOutputs) {
    const role = String(step?.agentRole || '').toLowerCase();
    const task = String(step?.taskType || '').toLowerCase();
    const query = inputValue('branchWorkflowQuery', '').toLowerCase();
    const words = [];
    function add(xs) { xs.forEach((x) => { if (!words.includes(x)) words.push(x); }); }
    if (/critic|reviewer|citation/.test(role + ' ' + task)) add(['weakness','risk','gap','missing','citation','assumption','limitation','failure','unclear','novelty','proof']);
    if (/advocate|defender|for/.test(role + ' ' + task)) add(['strength','defend','contribution','novelty','clarity','position','revision','scope','claim']);
    if (/synthesizer|synthesis/.test(role + ' ' + task)) add(['synthesis','balance','tradeoff','plan','priority','consensus','actionable']);
    if (/editor|final|edit/.test(role + ' ' + task)) add(['edit','patch','latex','lai','accepted','apply','insert','replace','compile','explanation']);
    if (equationCoverageActive() || /equation|math|derivation|formula/.test(query + ' ' + task)) add(['equation','math','derivation','symbol','formula','explain','below','display']);
    query.replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((w) => w.length >= 5).slice(0, 12).forEach((w) => { if (!words.includes(w)) words.push(w); });
    const transcriptTail = transcriptText(priorOutputs || []).slice(-1800).toLowerCase();
    transcriptTail.replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((w) => w.length >= 7).slice(0, 10).forEach((w) => { if (!words.includes(w)) words.push(w); });
    return words;
  }

  function memoryEvidenceScoreForStep(item, keywords) {
    const text = (memoryEvidenceText(item) + ' ' + clean(item?.key || '') + ' ' + clean(item?.memoryId || item?.id || '')).toLowerCase();
    const base = Number(item?.banditScore ?? item?.rankScore ?? item?.baseScore ?? item?.score ?? 0) || 0;
    let hits = 0;
    const matched = [];
    (keywords || []).forEach((kw) => {
      if (kw && text.includes(String(kw).toLowerCase())) { hits += 1; matched.push(kw); }
    });
    const summaryBonus = memoryEvidenceText(item) ? 0.15 : -0.05;
    const explorationBonus = item?.wasExploration ? 0.03 : 0;
    return { score: base + hits * 0.12 + summaryBonus + explorationBonus, hits, matched: matched.slice(0, 8) };
  }

  function buildPerRoundMemoryContext(step, priorOutputs, runPayload) {
    const memories = uniqueMemoryEvidenceItems(runPayload);
    const branch = runPayload?.selectedBranch || {};
    const plan = runPayload?.executionPlan || {};
    const ids = Array.from(new Set([...(branch.memoryIdsUsed || []), ...(branch.memoryIds || []), ...(plan.memoryIdsToUse || [])].filter(Boolean)));
    const role = clean(step?.agentRole || 'agent');
    const round = step?.debateRound ? String(step.debateRound) : '0';
    const policy = memorySelectionPolicy();
    const keywords = stepMemoryKeywords(step, priorOutputs || []);
    const scored = memories.map((m) => ({ item: m, ...memoryEvidenceScoreForStep(m, keywords) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    const lines = [];
    lines.push('=== BANDIT-SELECTED MEMORY CONTEXT FOR THIS AGENT ===');
    lines.push('Agent role: ' + role + (step?.debatePhase ? ' · phase: ' + step.debatePhase : '') + ' · round: ' + round + '.');
    lines.push('Memory policy used during branch planning: ' + policy + '.');
    lines.push('Frontend injection note: Stage 19N1J does not run a new backend bandit query per agent call. It takes the backend/bandit-selected memory evidence returned with the selected branch and re-ranks that evidence for this agent role/round before inserting it into the visible prompt.');
    if (!scored.length) {
      lines.push('No full memory summaries/evidence were available in the selected branch payload.');
      lines.push('Memory ids carried by the plan: ' + (ids.join(', ') || 'none') + '.');
      lines.push('The agent should proceed from the visible paper context and debate transcript.');
      return lines.join('\n');
    }
    lines.push('Role/query keywords used for frontend per-agent memory re-ranking: ' + (keywords.slice(0, 18).join(', ') || 'none') + '.');
    scored.forEach((entry, idx) => {
      const m = entry.item || {};
      const summary = memoryEvidenceText(m);
      const id = clean(m.memoryId || m.id || m.contextId || '') || '(no memory id)';
      const key = clean(m.key || m.type || m.label || '');
      lines.push('\nMemory ' + (idx + 1) + ': ' + id + (key ? ' · key=' + key : ''));
      lines.push('Why selected for this agent: backend-selected memory; frontend role/round score=' + entry.score.toFixed(3) + '; matched terms=' + (entry.matched.join(', ') || 'none') + '.');
      const scoreParts = [];
      ['baseScore','banditScore','rankScore','termHits','wasExploration'].forEach((k) => {
        if (m[k] !== undefined && m[k] !== null && m[k] !== '') scoreParts.push(k + '=' + m[k]);
      });
      if (scoreParts.length) lines.push('Backend evidence: ' + scoreParts.join(', ') + '.');
      lines.push('Summary: ' + (summary ? truncateMiddle(summary, 900, ' ... [memory summary truncated] ...') : '(summary not available; only the memory id was returned)'));
    });
    lines.push('\nInstruction: Use these memories as contextual hints only. Do not quote them as paper text. If a memory conflicts with the current paper context or user focus/query, prefer the current paper context and user focus/query.');
    return lines.join('\n');
  }


  async function baseBranchPromptContext(step, runPayload, priorOutputs = []) {
    const branch = runPayload?.selectedBranch || {};
    const plan = runPayload?.executionPlan || {};
    const memoryIds = Array.from(new Set([...(branch.memoryIdsUsed || []), ...(plan.memoryIdsToUse || [])].filter(Boolean)));
    const targets = desiredTargetSections(runPayload);
    const tpl = await loadPromptTemplate('base-context');
    return fillPromptTemplate(tpl, {
      branchTitle: branch.title || 'selected branch',
      branchType: branch.branchType || '',
      targetSections: targets.join(', ') || ((branch.targetSections || plan.targetSections || []).join(', ') || 'none'),
      rationale: branch.rationale || '',
      latexEditHint: branch.latexEditHint || '',
      memoryIds: memoryIds.join(', ') || 'none',
      memoryContext: buildPerRoundMemoryContext(step, priorOutputs, runPayload),
      sectionCoverageInstruction: await sectionCoverageInstruction(runPayload),
      equationCoverageContext: buildEquationCoverageContext(runPayload),
      equationCoverageActive: equationCoverageActive() ? 'true' : 'false',
      paperSummary: inputValue('branchWorkflowPaperSummary', 'Current Latexai editor source.'),
      reviewText: inputValue('branchWorkflowReviewText', inputValue('branchWorkflowQuery', '')),
      visibleContext: buildSectionAwareExcerpt(runPayload),
      stage: STAGE
    });
  }

  async function buildDebatePrompt(step, priorOutputs, runPayload) {
    const role = String(step?.agentRole || 'agent');
    const round = Number(step?.debateRound || 0);
    const baseContext = await baseBranchPromptContext(step, runPayload, priorOutputs);
    const transcript = transcriptText(priorOutputs);
    const totalRounds = debateRoundCount();
    const previousInstruction = priorOutputs?.length
      ? 'You MUST use the prior debate transcript below. Do not restart from scratch; respond to the strongest unresolved points, concessions, and proposed edits from previous turns.'
      : 'This is the first substantive debate turn. Establish the strongest position for your role.';

    let templateName = 'default-step';
    if (/citation-reviewer|reviewer/.test(role) && !/critic|advocate/.test(role)) templateName = 'citation-reviewer';
    else if (/critic/.test(role)) templateName = 'critic';
    else if (/advocate|defender|for/.test(role)) templateName = 'advocate';
    else if (/synthesizer/.test(role)) templateName = 'synthesizer';
    else if (/editor|final/.test(role)) templateName = 'editor';

    const tpl = await loadPromptTemplate(templateName);
    return fillPromptTemplate(tpl, {
      baseContext,
      transcript,
      totalRounds,
      round: round || 1,
      role,
      taskType: step?.taskType || '',
      previousInstruction,
      selectedBranchTitle: runPayload?.selectedBranch?.title || 'selected branch',
      requestedTargets: desiredTargetSections(runPayload).join(', ') || 'none',
      stage: STAGE
    });
  }

  function findTemplateStep(steps, roleRegex, fallbackRole) {
    const found = (Array.isArray(steps) ? steps : []).find((s) => roleRegex.test(String(s.agentRole || '')));
    return found || { agentRole: fallbackRole, taskType: 'execute ' + fallbackRole + ' debate step', expectedOutput: 'analysis' };
  }


  function debateRouteKeyForStep(step) {
    const hay = [step?.agentRole, step?.debatePhase, step?.taskType, step?.expectedOutput].map((v) => clean(v).toLowerCase()).join(' ');
    if (/critic|reviewer|citation-reviewer|theory-checker|detail-reviewer|attack|weakness/.test(hay)) return 'debate-critic';
    if (/advocate|supporter|defender|\bfor\b|defend/.test(hay)) return 'debate-advocate';
    if (/synthesizer|synthesis|synthesize|editor|final|implementation|visible-lai|balanced/.test(hay)) return 'debate-synthesizer';
    return 'debate-synthesizer';
  }

  function debateRouteTitle(routeKey) {
    if (routeKey === 'debate-critic') return 'Devil’s advocate · critic';
    if (routeKey === 'debate-advocate') return 'Devil’s advocate · supporter';
    if (routeKey === 'debate-synthesizer') return 'Devil’s advocate · synthesis';
    return routeKey || 'Devil’s advocate route';
  }

  function configuredDebateRoute(routeKey) {
    const key = clean(routeKey || 'debate-synthesizer') || 'debate-synthesizer';
    const routes = NS.ModelRoutingService?.getRoutes?.() || {};
    const defaults = NS.ModelRoutingService?.DEFAULTS || {};
    const source = routes[key] || defaults[key] || routes.paper || routes.default || defaults.default || { provider: 'openai', model: 'gpt-5.4-mini' };
    const provider = clean(source.provider || 'openai');
    const model = clean(source.model || 'gpt-5.4-mini');
    const validation = NS.ModelRegistryService?.validateProviderModel?.(provider, model, { routeKey: key });
    if (validation) return { routeKey: key, provider: validation.provider || provider, model: validation.model || model, repaired: Boolean(validation.repaired), reason: validation.reason || '' };
    return { routeKey: key, provider, model, repaired: false, reason: '' };
  }

  function configuredDebateRouteForStep(step) {
    return configuredDebateRoute(debateRouteKeyForStep(step));
  }

  function debateRouteSummaryObject() {
    return {
      critic: configuredDebateRoute('debate-critic'),
      advocate: configuredDebateRoute('debate-advocate'),
      synthesizer: configuredDebateRoute('debate-synthesizer')
    };
  }

  function debateRouteSummaryText() {
    const routes = debateRouteSummaryObject();
    return [
      'critic=' + routes.critic.provider + '/' + routes.critic.model,
      'advocate=' + routes.advocate.provider + '/' + routes.advocate.model,
      'synthesis=' + routes.synthesizer.provider + '/' + routes.synthesizer.model
    ].join('; ');
  }

  function refreshBranchRouteSummary() {
    const node = $('branchWorkflowRouteSummary');
    if (!node) return;
    const routes = debateRouteSummaryObject();
    node.innerHTML = '<strong>Model routing:</strong> inherited from <em>Settings → Model/provider routing</em> Devil’s advocate rows.<br>' +
      '<span>Critic/reviewer: <code>' + esc(routes.critic.provider + ' / ' + routes.critic.model) + '</code></span><br>' +
      '<span>Advocate/supporter: <code>' + esc(routes.advocate.provider + ' / ' + routes.advocate.model) + '</code></span><br>' +
      '<span>Synthesizer/editor: <code>' + esc(routes.synthesizer.provider + ' / ' + routes.synthesizer.model) + '</code></span>';
  }

  function buildConfigurableDebateSteps(runPayload) {
    const planSteps = runPayload?.executionPlan?.steps || [];
    const rounds = debateRoundCount();
    const out = [];
    const branchType = runPayload?.selectedBranch?.branchType || 'branch';
    const targetSections = desiredTargetSections(runPayload);
    const reviewer = planSteps.find((s) => /reviewer|citation-reviewer|theory-checker|detail-reviewer/i.test(String(s.agentRole || '')) && !/critic|advocate|synthesizer|editor/i.test(String(s.agentRole || '')));
    if (reviewer) {
      out.push({ ...reviewer, stepIndex: out.length + 1, debatePhase: 'setup', debateRound: 0, taskType: reviewer.taskType || ('setup review for ' + branchType), targetSections });
    }
    const criticT = findTemplateStep(planSteps, /critic/i, 'critic');
    const advocateT = findTemplateStep(planSteps, /advocate|defender|for/i, 'advocate');
    for (let r = 1; r <= rounds; r += 1) {
      out.push({ ...criticT, agentRole: 'critic', stepIndex: out.length + 1, debatePhase: 'critic', debateRound: r, taskType: 'critic round ' + r + ': attack and sharpen ' + branchType, targetSections, expectedOutput: 'analysis' });
      out.push({ ...advocateT, agentRole: 'advocate', stepIndex: out.length + 1, debatePhase: 'advocate', debateRound: r, taskType: 'advocate round ' + r + ': defend and refine ' + branchType, targetSections, expectedOutput: 'analysis' });
    }
    const synthT = findTemplateStep(planSteps, /synthesizer/i, 'synthesizer');
    const editorT = findTemplateStep(planSteps, /editor|final/i, 'editor');
    out.push({ ...synthT, agentRole: 'synthesizer', stepIndex: out.length + 1, debatePhase: 'synthesize', debateRound: rounds, taskType: 'synthesize ' + rounds + ' debate round(s) for ' + branchType, targetSections, expectedOutput: 'analysis' });
    out.push({ ...editorT, agentRole: 'editor', stepIndex: out.length + 1, debatePhase: 'editor', debateRound: rounds, taskType: 'produce visible \\lai edits after ' + rounds + ' debate round(s) for ' + branchType, targetSections, expectedOutput: 'visible-lai-edits-and-implementation-plan' });
    return out;
  }

  async function callAiForStep(step, priorOutputs, runPayload) {
    const mode = inputValue('branchWorkflowRunMode', 'dry_run_no_model_calls');
    const dry = mode !== 'call_ai_proxy_expensive';
    const role = step.agentRole || 'agent';
    const prompt = await buildDebatePrompt(step, priorOutputs, runPayload);
    const route = dry ? { routeKey: 'dry-run', provider: 'dry-run', model: 'dry-run' } : configuredDebateRouteForStep(step);
    const provider = route.provider;
    const model = route.model;
    const aiPayload = {
      prompt,
      provider,
      model,
      modelRouteKey: route.routeKey,
      modelRouteTitle: dry ? 'dry run' : debateRouteTitle(route.routeKey),
      branch: runPayload?.selectedBranch,
      executionPlan: runPayload?.executionPlan,
      priorOutputs,
      latexSource: payloadLatexSourceForAI(),
      latexSourceMode: payloadSourceMode(),
      fullLatexSourceVisibleInPrompt: /whole_truncated|full_source/.test(visibleContextMode()),
      visibleMemoryContext: buildPerRoundMemoryContext(step, priorOutputs, runPayload),
      reviewText: inputValue('branchWorkflowReviewText', ''),
      paperSummary: inputValue('branchWorkflowPaperSummary', '')
    };
    publishPromptDebugEvent(dry ? 'dry-run prompt built' : 'calling AI with prompt', step, prompt, aiPayload, {
      status: dry ? 'dry-run-no-model-call' : 'before-ai-call',
      visiblePromptChars: prompt.length,
      payloadLatexSourceChars: typeof aiPayload.latexSource === 'string' ? aiPayload.latexSource.length : 0,
      runMode: mode
    });

    if (dry) {
      const isFinal = /editor|final|synth/i.test(role) && priorOutputs.length > 0;
      const dryOutput = {
        stepIndex: step.stepIndex,
        agentRole: role,
        taskType: step.taskType,
        debateRound: step.debateRound || 0,
        debatePhase: step.debatePhase || '',
        provider: 'dry-run',
        model: 'dry-run',
        promptSeed: prompt,
        dryRun: true,
        latencyMs: 0,
        outputText: isFinal ? '[DRY RUN] Final structured edit draft after ' + debateRoundCount() + ' debate round(s) for ' + (runPayload?.selectedBranch?.title || 'selected branch') + '.\n\nLATEXAI_STRUCTURED_EDIT_JSON_BEGIN\n' + JSON.stringify({ ok: true, editMode: equationCoverageActive() ? 'equation_coverage' : 'section_coverage', edits: [{ targetType: equationCoverageActive() ? 'equation' : 'section', targetId: equationCoverageActive() ? 'eq_001' : '', targetSection: (desiredTargetSections(runPayload)[0] || 'Introduction'), action: 'insert_after', latex: equationCoverageActive() ? 'This equation states the key mathematical condition and should be read together with the surrounding definitions.' : 'This paragraph records the selected branch improvement after reviewing the debate transcript.' }], warnings: ['dry-run structured schema example'] }, null, 2) + '\nLATEXAI_STRUCTURED_EDIT_JSON_END\n\n\\lai{%\n% Target section: ' + (desiredTargetSections(runPayload)[0] || 'Introduction') + '\nThis paragraph records the selected branch improvement after reviewing real agent outputs.\n}' : '[DRY RUN] ' + role + (step.debateRound ? ' round ' + step.debateRound : '') + ' would analyze this branch using the prior transcript and pass concise findings to the next agent.'
      };
      publishPromptDebugEvent('dry-run output generated', step, prompt, aiPayload, { status: 'dry-run-output-generated', outputText: dryOutput.outputText });
      return dryOutput;
    }

    if (!NS.AIProvider?.ask) throw new Error('AIProvider is not loaded.');
    const start = Date.now();
    const raw = await NS.AIProvider.ask(aiPayload, {
      task: 'latex-paper-debate-real-agent-branch-run ' + route.routeKey,
      routeKey: route.routeKey,
      provider,
      model,
      context: { workflow: 'devils-advocate-paper-debate', agentRole: role, modelRouteKey: route.routeKey, modelRouteTitle: debateRouteTitle(route.routeKey), stage: STAGE }
    });
    const text = NS.AIProvider.extractText ? NS.AIProvider.extractText(raw) : extractAiText(raw);
    publishPromptDebugEvent('AI response received', step, prompt, aiPayload, {
      status: 'after-ai-call',
      latencyMs: Date.now() - start,
      outputTextPreview: String(text || '').slice(0, 4000)
    });
    return {
      stepIndex: step.stepIndex,
      agentRole: role,
      taskType: step.taskType,
      debateRound: step.debateRound || 0,
      debatePhase: step.debatePhase || '',
      provider,
      model,
      promptSeed: prompt,
      dryRun: false,
      latencyMs: Date.now() - start,
      outputText: text,
      rawResponse: raw
    };
  }


  function roleBucket(role) {
    const r = String(role || '').toLowerCase();
    if (/critic|reviewer|against|skeptic/.test(r)) return 'Critic';
    if (/advocate|supporter|defender|for/.test(r)) return 'Supporter';
    if (/synth|final|editor|revise/.test(r)) return 'Final synthesis / editor';
    return role || 'Agent';
  }

  function renderAgentTranscriptCards(outputs) {
    const list = Array.isArray(outputs) ? outputs : [];
    if (!list.length) return '<div class="settings-note compact">No agent transcript recorded yet.</div>';
    return '<div class="branch-transcript-grid">' + list.map((o, i) => {
      const bucket = roleBucket(o.agentRole || o.role || 'agent');
      const model = [o.provider, o.model].filter(Boolean).join(' / ');
      const round = o.debateRound ? ' · round ' + o.debateRound : '';
      return '<article class="branch-transcript-card"><div class="branch-transcript-title">' + esc(bucket) + '</div><div class="branch-transcript-meta">step ' + esc(o.stepIndex || i + 1) + round + (model ? ' · ' + esc(model) : '') + '</div><pre>' + esc(o.outputText || o.text || o.content || '') + '</pre></article>';
    }).join('') + '</div>';
  }

  function branchCandidateList(snapshot) {
    const snap = snapshot || currentBranchRunSnapshot('candidate_list');
    const candidates = [];
    const sources = [snap.selectionData?.branches, snap.selectionData?.selectedBranches, snap.selectionData?.rollouts, snap.realRunData?.branches, snap.realRunData?.selectedBranches];
    sources.forEach((arr) => { if (Array.isArray(arr)) arr.forEach((b) => { if (b && typeof b === 'object') candidates.push(b); }); });
    const seen = new Set();
    return candidates.filter((b) => { const key = b.branchId || b.id || b.title || b.branchType || JSON.stringify(b).slice(0,80); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 8);
  }

  function renderBranchCandidatesCards(snapshot) {
    const candidates = branchCandidateList(snapshot);
    const selected = snapshot?.realRunData?.selectedBranch || snapshot?.selectionData?.selectedBranch || {};
    const selectedKey = selected.branchId || selected.id || selected.title || selected.branchType || '';
    if (!candidates.length && !selected.title) return '<div class="settings-note compact">No branch candidates available yet. Click Plan branch or Learned select.</div>';
    const list = candidates.length ? candidates : [selected];
    return '<div class="branch-candidate-grid">' + list.map((b) => {
      const key = b.branchId || b.id || b.title || b.branchType || '';
      const isSelected = selectedKey && key === selectedKey;
      const score = b.learnedScore ?? b.ucbScore ?? b.selectionScore ?? b.rolloutScore ?? b.score ?? b.valueScore ?? '';
      const reasons = Array.isArray(b.selectionReason) ? b.selectionReason : (Array.isArray(b.reasons) ? b.reasons : []);
      return '<article class="branch-candidate-card' + (isSelected ? ' selected' : '') + '"><div class="branch-candidate-title">' + esc(isSelected ? 'Selected branch' : 'Branch candidate') + '</div><div><strong>' + esc(b.title || b.branchTitle || b.branchType || 'Untitled branch') + '</strong></div><div class="branch-transcript-meta">type=' + esc(b.branchType || '') + (score !== '' ? ' · score=' + esc(score) : '') + '</div>' + (reasons.length ? '<ul>' + reasons.slice(0,3).map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul>' : '') + '</article>';
    }).join('') + '</div>';
  }

  function renderRunDashboard(snapshot, extraHtml = '') {
    const snap = snapshot || currentBranchRunSnapshot('dashboard');
    const outputs = Array.isArray(snap.realRunData?.agentOutputs) ? snap.realRunData.agentOutputs : [];
    const structured = snap.structuredEditorData || lastStructuredEditorData || refreshStructuredEditorData();
    const finalText = snap.realRunData?.finalOutput || outputs[outputs.length - 1]?.outputText || '';
    return '<div class="branch-dashboard-tabs">' +
      '<section class="branch-dashboard-section"><h3>Transcript</h3><div class="settings-note compact">Critic, supporter, and final synthesis/editor outputs from the completed run.</div>' + renderAgentTranscriptCards(outputs) + '</section>' +
      '<section class="branch-dashboard-section"><h3>Branch candidates</h3>' + renderBranchCandidatesCards(snap) + '</section>' +
      '<section class="branch-dashboard-section"><h3>Structured LaTeX edits</h3>' + renderStructuredEditorPreviewHtml(structured) + '</section>' +
      (extraHtml ? '<section class="branch-dashboard-section"><h3>Insertion preview</h3>' + extraHtml + '</section>' : '') +
      '<section class="branch-dashboard-section"><h3>Saved run / model trace</h3><div class="settings-note compact">Run id: ' + esc(snap.runId || '') + ' · saved: ' + esc(snap.savedAt || '') + '</div><pre class="branch-workflow-latex-source-preview">' + esc(JSON.stringify(snap.routeSummary || {}, null, 2)) + '</pre></section>' +
      '<section class="branch-dashboard-section"><h3>Final synthesis text</h3><pre class="branch-workflow-latex-source-preview">' + esc(finalText || 'No final synthesis text recorded yet.') + '</pre></section>' +
    '</div>';
  }

  function reportFilePath(snapshot) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const id = String(snapshot?.runId || snapshot?.id || 'run').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 42);
    return 'reviews/devils-advocate-run-' + stamp + '-' + id + '.md';
  }

  function upsertProjectTextFile(path, text) {
    const S = state();
    const normalized = String(path || '').replace(/^\/+/, '');
    if (!S || !normalized) throw new Error('Project state is not available.');
    if (S.getFile?.(normalized)) S.updateFile?.(normalized, text);
    else if (S.createFile) S.createFile(normalized, text, { keepActive: true });
    else {
      S.state.project.files = S.state.project.files || [];
      S.state.project.files.push({ path: normalized, text: String(text || ''), kind: 'text' });
    }
    try { S.setActivePath?.(activePath()); } catch (_err) {}
    try { S.save?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    return normalized;
  }

  async function saveCurrentReportToReviews() {
    const snap = currentBranchRunSnapshot('save_reviews_artifact');
    const path = reportFilePath(snap);
    const report = snap.reportMarkdown || buildBranchRunReport(snap);
    const normalized = upsertProjectTextFile(path, report);
    status('Saved Devil’s Advocate review artifact to /' + normalized + '. Use Save GitHub to commit it.', 'good');
    renderSummary('Saved /reviews artifact', '<div class="settings-note good">Saved report file: <code>/' + esc(normalized) + '</code></div>' + renderRunDashboard(snap));
    return normalized;
  }

  function compileAfterInsertionCheck() {
    const btn = $('compileBtn') || $('compilePdfBtn');
    if (!btn) { status('Compile button not found. Click Compile PDF manually to verify inserted \lai markup.', 'warn'); return; }
    status('Starting Compile PDF after Devil’s Advocate insertion. Watch Logs/Preview for LaTeX errors.', 'warn');
    btn.click();
  }

  async function planBranch() {
    clearInlinePreview();
    setStored('latexai:memory-backend-url', ($('memoryBackendUrl')?.value || '').trim() || getStored('latexai:memory-backend-url', ''));
    status('Planning selected branch with backend policy/value/rollout/selector...', 'warn');
    const data = applySectionScopeToSelection(await backendPost('/debate/select-branch', planPayload()));
    lastSelectionData = data;
    renderSelection(data);
    const scopeTargets = desiredTargetSections(data?.realAgentRunPayload || data || {});
    status('Selected branch: ' + (data?.selectedBranch?.title || 'ready') + '. Target sections: ' + (scopeTargets.join(', ') || 'backend default') + '. No LLM call was made.', 'good');
    return data;
  }

  function renderRealRun(data) {
    const outputs = Array.isArray(data?.agentOutputs) ? data.agentOutputs : [];
    const blocks = Array.isArray(data?.insertableLaiBlocks) ? data.insertableLaiBlocks : (Array.isArray(data?.visibleLaiBlocks) ? data.visibleLaiBlocks : []);
    const snap = currentBranchRunSnapshot('render_report');
    const extra = blocks.length ? '<details open><summary>Visible \\lai candidates</summary><pre class="branch-workflow-latex-source-preview">' + esc(blocks.join('\n\n')) + '</pre></details>' : '<div class="settings-note compact">No visible \\lai candidates parsed yet. Click Clean LAI or Preview insertion.</div>';
    renderSummary('Real-agent branch result',
      '<div class="settings-note"><strong>Run:</strong> ' + esc(data?.runId || '') + ' · dryRun=' + esc(data?.dryRun) + ' · outputs=' + esc(outputs.length) + '</div>' +
      renderRunDashboard(snap, extra) +
      '<details><summary>Complete saved review artifact / report</summary><pre class="branch-workflow-latex-source-preview">' + esc(buildBranchRunReport(currentBranchRunSnapshot('render_report'))) + '</pre></details>'
    );
  }

  async function runSelectedBranch() {
    maybeWarnRepeatedHeadings('Pre-run warning');
    let runPayload = selectedRealPayload();
    if (!runPayload) {
      await planBranch();
      runPayload = selectedRealPayload();
    }
    if (!runPayload?.executionPlan?.steps?.length) throw new Error('No selected execution plan available.');
    const steps = buildConfigurableDebateSteps(runPayload);
    if (promptDebugEnabled()) {
      ensurePromptDebugWindow('debate run starting');
      publishPromptDebugEvent('debate run starting', { stepIndex: 0, agentRole: 'workflow', taskType: 'runSelectedBranch' }, 'Debate run starting. Prompts will appear below as each agent step is built and called.', {
        prompt: 'Debate run starting.',
        provider: 'settings-devils-advocate-routes',
        model: debateRouteSummaryText(),
        latexSource: payloadLatexSourceForAI(),
        latexSourceMode: payloadSourceMode(),
        fullLatexSourceVisibleInPrompt: /whole_truncated|full_source/.test(visibleContextMode()),
        branch: runPayload?.selectedBranch,
        executionPlan: runPayload?.executionPlan,
        priorOutputs: []
      }, { status: 'start', stepCount: steps.length, debugUrlArg: 'laiPromptDebug=1' });
    }
    const mode = inputValue('branchWorkflowRunMode', 'dry_run_no_model_calls');
    const dry = mode !== 'call_ai_proxy_expensive';
    if (!dry && !W.confirm('This will call the configured AI proxy for ' + steps.length + ' agent steps (' + debateRoundCount() + ' debate round(s) plus synthesis/editor). Continue?')) return null;
    const outputs = [];
    for (const step of steps) {
      status((dry ? 'Dry-running' : 'Calling AI for') + ' step ' + (step.stepIndex || outputs.length + 1) + '/' + steps.length + ': ' + (step.agentRole || 'agent'), 'warn');
      outputs.push(await callAiForStep(step, outputs, runPayload));
    }
    const body = {
      workflow: 'latex-paper-debate-real-agent-run',
      runMode: dry ? 'dry_run' : 'frontend_ai_proxy_outputs',
      dryRun: dry,
      recordTrajectory: true,
      provider: 'settings-devils-advocate-routes',
      model: debateRouteSummaryText(),
      realAgentRunPayload: { ...runPayload, executionPlan: { ...(runPayload.executionPlan || {}), steps, debateRoundCount: debateRoundCount(), debateMode: 'critic-advocate-rounds' }, debateRoundCount: debateRoundCount(), debateMode: 'critic-advocate-rounds' },
      executionPlan: { ...(runPayload.executionPlan || {}), steps, debateRoundCount: debateRoundCount(), debateMode: 'critic-advocate-rounds' },
      selectedBranch: runPayload.selectedBranch,
      latexSource: getActiveSource(),
      aiPayloadLatexSourceMode: payloadSourceMode(),
      fullLatexSourceVisibleInPrompt: /whole_truncated|full_source/.test(visibleContextMode()),
      reviewText: inputValue('branchWorkflowReviewText', ''),
      paperSummary: inputValue('branchWorkflowPaperSummary', ''),
      query: inputValue('branchWorkflowQuery', ''),
      agentOutputs: outputs,
      metadata: { frontendStage: STAGE, activePath: activePath(), debateRoundCount: debateRoundCount(), debateMode: 'critic-advocate-rounds', visibleContextMode: visibleContextMode(), payloadSourceMode: payloadSourceMode(), targetSections: desiredTargetSections(runPayload), modelRoutingSource: 'settings-devils-advocate-routes', devilAdvocateRoutes: debateRouteSummaryObject() }
    };
    const data = await backendPost('/debate/run-real-agent-branch', body);
    lastRealRunData = data;
    lastCleanerData = data.laiValidation || null;
    refreshStructuredEditorData();
    renderRealRun(data);
    try { await saveCurrentBranchRun('run_completed', { quiet: true }); } catch (_err) {}
    status((dry ? 'Dry run' : 'Real-agent run') + ' completed, recorded, and saved locally.', 'good');
    return data;
  }

  function renderCleaner(data) {
    const valid = Array.isArray(data?.validVisibleLaiBlocks) ? data.validVisibleLaiBlocks : (Array.isArray(data?.cleanVisibleLaiBlocks) ? data.cleanVisibleLaiBlocks : []);
    const insertable = Array.isArray(data?.insertableLaiBlocks) ? data.insertableLaiBlocks : [];
    const warnings = Array.isArray(data?.warnings) ? data.warnings : [];
    renderSummary('Cleaned LAI edits',
      '<div class="settings-note"><strong>Cleaner:</strong> valid=' + esc(valid.length) + ' · insertable=' + esc(insertable.length) + ' · rejected=' + esc(data?.rejectedCandidateCount || 0) + '</div>' +
      (warnings.length ? '<div class="settings-note warn">Warnings: ' + esc(warnings.join('; ')) + '</div>' : '') +
      '<details open><summary>Insertable \\lai blocks</summary><pre>' + esc((insertable.length ? insertable : valid).join('\n\n')) + '</pre></details>'
    );
  }

  async function cleanLastRealRun() {
    if (!lastRealRunData) {
      throw new Error('No real-agent result yet. Click Run selected branch or Run full preview first. If prompt debug is enabled, the debug tab can open before any backend-recorded agent result exists; cleaner/preview needs a completed run result.');
    }
    status('Cleaning and validating real-agent \\lai output...', 'warn');
    const data = await backendPost('/debate/clean-real-agent-output', lastRealRunData);
    lastCleanerData = data;
    renderCleaner(data);
    status('Cleaner validated ' + (data.validBlockCount || 0) + ' block(s), insertable=' + (data.insertableBlockCount || 0) + '.', 'good');
    return data;
  }


  function firstExistingSectionTitle(titles, source) {
    const sections = topLevelSections(source);
    for (const t of (titles || [])) {
      const hit = sections.find((sec) => sectionMatches(sec, t));
      if (hit) return hit.title;
    }
    return (sections[0] && sections[0].title) || '';
  }

  function finalEditorOutputText() {
    const outputs = Array.isArray(lastRealRunData?.agentOutputs) ? lastRealRunData.agentOutputs : [];
    const editorOutputs = outputs.filter((o) => /editor|final/i.test(String(o?.agentRole || '')) || /visible-lai|implementation-plan/i.test(String(o?.expectedOutput || o?.taskType || '')));
    const picked = editorOutputs.length ? editorOutputs[editorOutputs.length - 1] : null;
    return String(picked?.outputText || lastRealRunData?.finalOutput || '');
  }


  function findJsonObjectAfter(text, startIndex) {
    const s = String(text || '');
    const start = Math.max(0, Number(startIndex) || 0);
    const openObj = s.indexOf('{', start);
    const openArr = s.indexOf('[', start);
    let open = -1;
    let openChar = '';
    let closeChar = '';
    if (openObj >= 0 && (openArr < 0 || openObj < openArr)) { open = openObj; openChar = '{'; closeChar = '}'; }
    else if (openArr >= 0) { open = openArr; openChar = '['; closeChar = ']'; }
    if (open < 0) return '';
    const stack = [];
    let inString = false;
    let escNext = false;
    for (let i = open; i < s.length; i += 1) {
      const ch = s[i];
      if (inString) {
        if (escNext) escNext = false;
        else if (ch === '\\') escNext = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') {
        const top = stack[stack.length - 1];
        if ((top === '{' && ch === '}') || (top === '[' && ch === ']')) stack.pop();
        if (!stack.length) return s.slice(open, i + 1);
      }
    }
    // If the model omitted the closing LATEXAI marker but the JSON object is visibly unfinished,
    // return nothing rather than a partial object. The caller will show the raw output preview.
    return '';
  }

  function findJsonObjectBefore(text, endIndex) {
    const s = String(text || '');
    const end = Math.min(s.length, Math.max(0, Number(endIndex) || 0));
    const candidates = [];
    for (let i = Math.max(0, end - 16000); i < end; i += 1) {
      const ch = s[i];
      if (ch === '{' || ch === '[') candidates.push(i);
    }
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      const obj = findJsonObjectAfter(s, candidates[i]);
      if (obj && candidates[i] + obj.length >= end) return obj;
    }
    return '';
  }

  function extractStructuredEditorJsonText(text) {
    const s = String(text || '');
    // Stage 19N1L: accept the begin marker even if the model forgets the end marker.
    // This was the failure seen on iPad: the preview showed LATEXAI_STRUCTURED_EDIT_JSON_BEGIN
    // and a JSON object, but extraction returned "no schema" because the END marker was missing.
    const begin = s.search(/LATEXAI_STRUCTURED_EDIT_JSON_BEGIN/i);
    if (begin >= 0) {
      const afterBegin = begin + String('LATEXAI_STRUCTURED_EDIT_JSON_BEGIN').length;
      const obj = findJsonObjectAfter(s, afterBegin);
      if (obj) return obj;
    }
    const marker = s.match(/LATEXAI_STRUCTURED_EDIT_JSON_BEGIN([\s\S]*?)LATEXAI_STRUCTURED_EDIT_JSON_END/i);
    if (marker && marker[1]) {
      const obj = findJsonObjectAfter(marker[1], 0);
      if (obj) return obj;
    }
    const fence = s.match(/```(?:json)?\s*([\s\S]*?(?:"edits"|"sectionEdits"|"equationEdits"|"patches")[\s\S]*?)```/i);
    if (fence && fence[1]) {
      const obj = findJsonObjectAfter(fence[1], 0);
      if (obj) return obj;
    }
    const idx = s.search(/"(?:edits|sectionEdits|equationEdits|patches|items|results)"\s*:/i);
    if (idx >= 0) {
      const obj = findJsonObjectBefore(s, idx) || findJsonObjectAfter(s, Math.max(0, s.lastIndexOf('{', idx)));
      if (obj) return obj;
    }
    const arrIdx = s.search(/\[\s*\{\s*"(?:targetType|targetId|targetSection|action|latex)"/i);
    if (arrIdx >= 0) {
      const obj = findJsonObjectAfter(s, arrIdx);
      if (obj) return obj;
    }
    return '';
  }

  function escapeInvalidJsonBackslashesInStrings(text) {
    const s = String(text || '');
    let out = '';
    let inString = false;
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      if (!inString) {
        out += ch;
        if (ch === '"') inString = true;
        continue;
      }
      if (ch === '"') { out += ch; inString = false; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      if (ch === '\\') {
        const next = s[i + 1] || '';
        const next2 = s[i + 2] || '';
        const isLegalQuoteSlash = /^["\\/]$/.test(next);
        const isLikelyJsonControl = /^[bfnrt]$/.test(next) && !/[A-Za-z]/.test(next2);
        const isLegalUnicode = next === 'u' && /^[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 6));
        if (isLegalQuoteSlash || isLikelyJsonControl || isLegalUnicode) {
          out += '\\' + next;
          i += 1;
        } else {
          // Treat everything else as a literal LaTeX backslash. This catches
          // \theta, \Theta, \text, \[...\], \( ... \), \begin, etc.
          out += '\\\\';
        }
        continue;
      }
      out += ch;
    }
    return out;
  }

  function repairStructuredJsonText(jsonText) {
    let s = String(jsonText || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    s = s.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
    s = s.replace(/,\s*([}\]])/g, '$1');
    s = escapeInvalidJsonBackslashesInStrings(s);
    s = s.replace(/,\s*([}\]])/g, '$1');
    return s;
  }

  function normalizeStructuredTargetType(v) {
    const t = clean(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (/equation|math|formula/.test(t)) return 'equation';
    if (/section|subsection|chapter|unit|paragraph/.test(t)) return 'section';
    return t || 'section';
  }

  function normalizeStructuredAction(v) {
    const a = clean(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (/replace/.test(a)) return 'replace';
    if (/no.*edit|none|skip/.test(a)) return 'no_edit';
    if (/append/.test(a)) return 'append';
    if (/before/.test(a)) return 'insert_before';
    return 'insert_after';
  }

  function coerceStructuredEditArray(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (!parsed || typeof parsed !== 'object') return [];
    const candidates = [
      parsed.edits,
      parsed.sectionEdits,
      parsed.equationEdits,
      parsed.equations,
      parsed.patches,
      parsed.items,
      parsed.results
    ];
    for (const c of candidates) {
      if (Array.isArray(c)) return c;
      if (c && typeof c === 'object') return [c];
    }
    // Some models return a single edit object as the root.
    if (parsed.targetType || parsed.targetId || parsed.targetSection || parsed.latex || parsed.action) return [parsed];
    return [];
  }


  function looksLikeStructuredEditObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    return !!(obj.targetType || obj.type || obj.targetId || obj.target_id || obj.equationId || obj.equation_id || obj.targetSection || obj.section || obj.target || obj.action || obj.latex || obj.text || obj.content || obj.explanation);
  }

  function markerSegmentForStructuredOutput(text) {
    const s = String(text || '');
    const begin = s.search(/LATEXAI_STRUCTURED_EDIT_JSON_BEGIN/i);
    if (begin >= 0) return s.slice(begin + String('LATEXAI_STRUCTURED_EDIT_JSON_BEGIN').length);
    const fence = s.match(/```(?:json)?\s*([\s\S]*)/i);
    return fence && fence[1] ? fence[1] : s;
  }

  function salvageStructuredEditObjectsFromPartialJson(text) {
    const segment = markerSegmentForStructuredOutput(text);
    const hits = [];
    const seen = new Set();
    const startHints = [];
    const editsIdx = segment.search(/"(?:edits|sectionEdits|equationEdits|patches|items|results)"\s*:/i);
    if (editsIdx >= 0) startHints.push(editsIdx);
    startHints.push(0);
    startHints.forEach((hint) => {
      for (let i = Math.max(0, hint); i < segment.length; i += 1) {
        if (segment[i] !== '{') continue;
        const objText = findJsonObjectAfter(segment, i);
        if (!objText || objText.length < 8) continue;
        if (!/("targetType"|"targetId"|"targetSection"|"equationId"|"action"|"latex"|"explanation"|"text")\s*:/i.test(objText)) continue;
        let parsed = null;
        try { parsed = JSON.parse(objText); }
        catch (err1) {
          try { parsed = JSON.parse(repairStructuredJsonText(objText)); }
          catch (err2) { parsed = null; }
        }
        if (!looksLikeStructuredEditObject(parsed)) continue;
        const key = JSON.stringify(parsed).slice(0, 1000);
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push(parsed);
        i += Math.max(0, objText.length - 1);
      }
    });
    return hits;
  }


  function normalizeStructuredEditsFromArray(edits) {
    return (Array.isArray(edits) ? edits : []).map((e, idx) => {
      const targetType = normalizeStructuredTargetType(e?.targetType || e?.type || e?.target_kind || e?.targetKind || (e?.equationId || e?.equation_id ? 'equation' : 'section'));
      const action = normalizeStructuredAction(e?.action || e?.editAction || e?.mode || e?.operation || (e?.oldLatex || e?.oldText ? 'replace' : 'insert_after'));
      const targetId = clean(e?.targetId || e?.target_id || e?.equationId || e?.equation_id || e?.id || '');
      const targetSection = clean(e?.targetSection || e?.section || e?.target || e?.targetTitle || e?.sectionTitle || e?.unit || '');
      const latex = String(e?.latex || e?.latexPatch || e?.patch || e?.newLatex || e?.replacementLatex || e?.paperText || e?.explanationLatex || e?.explanation || e?.text || e?.content || '').trim();
      const oldLatex = String(e?.oldLatex || e?.oldText || e?.old || e?.originalLatex || '').trim();
      const note = clean(e?.note || e?.rationale || e?.reason || e?.why || '');
      return { index: idx + 1, targetType, targetId, targetSection, action, latex, oldLatex, note, raw: e };
    }).filter((e) => e.latex || e.oldLatex || e.action === 'no_edit');
  }

  function parseStructuredEditorOutputText(text) {
    const rawText = String(text || '');
    const jsonText = extractStructuredEditorJsonText(rawText);
    const result = { ok: false, source: 'none', editMode: '', edits: [], warnings: [] };
    if (!rawText.trim()) {
      result.warnings.push('Final editor output was empty; no structured edits can be inserted.');
      return result;
    }
    if (!jsonText) {
      const salvaged = salvageStructuredEditObjectsFromPartialJson(rawText);
      if (salvaged.length) {
        result.ok = true;
        result.source = 'partial-final-editor-json-salvage';
        result.editMode = equationCoverageActive() ? 'equation_coverage' : 'structured_edits';
        result.raw = { edits: salvaged };
        result.warnings.push('Stage 19N1L: recovered complete edit object(s) from a partial/truncated structured JSON response. The model likely omitted the closing JSON object or END marker.');
        result.edits = salvaged.map((e, idx) => {
          const targetType = normalizeStructuredTargetType(e?.targetType || e?.type || e?.target_kind || e?.targetKind || (e?.equationId || e?.equation_id ? 'equation' : 'section'));
          const action = normalizeStructuredAction(e?.action || e?.editAction || e?.mode || e?.operation || (e?.oldLatex || e?.oldText ? 'replace' : 'insert_after'));
          const targetId = clean(e?.targetId || e?.target_id || e?.equationId || e?.equation_id || e?.id || '');
          const targetSection = clean(e?.targetSection || e?.section || e?.target || e?.targetTitle || e?.sectionTitle || e?.unit || '');
          const latex = String(e?.latex || e?.latexPatch || e?.patch || e?.newLatex || e?.replacementLatex || e?.paperText || e?.explanationLatex || e?.explanation || e?.text || e?.content || '').trim();
          const oldLatex = String(e?.oldLatex || e?.oldText || e?.old || e?.originalLatex || '').trim();
          const note = clean(e?.note || e?.rationale || e?.reason || e?.why || '');
          return { index: idx + 1, targetType, targetId, targetSection, action, latex, oldLatex, note, raw: e };
        }).filter((e) => e.latex || e.oldLatex || e.action === 'no_edit');
        if (result.edits.length) return result;
      }
      result.warnings.push('No complete structured JSON edit schema was found in the final editor output. This usually means the final editor ignored the JSON contract or returned a truncated schema with no complete edit objects. Re-run with prompt debug enabled to inspect the editor prompt/output.');
      result.rawOutputPreview = rawText.slice(0, 4000);
      return result;
    }
    let parsed = null;
    let repairedJsonText = '';
    try { parsed = JSON.parse(jsonText); }
    catch (err1) {
      try {
        repairedJsonText = repairStructuredJsonText(jsonText);
        parsed = JSON.parse(repairedJsonText);
        result.warnings.push('Structured JSON needed Stage 19N1K4 loose repair before parsing. This usually means the model used raw LaTeX backslashes inside JSON strings.');
      } catch (err2) {
        const salvaged = salvageStructuredEditObjectsFromPartialJson(rawText);
        const normalized = normalizeStructuredEditsFromArray(salvaged);
        if (normalized.length) {
          result.ok = true;
          result.source = 'malformed-final-editor-json-salvage';
          result.editMode = equationCoverageActive() ? 'equation_coverage' : 'structured_edits';
          result.raw = { edits: salvaged };
          result.edits = normalized;
          result.warnings.push('Stage 19N1L: structured JSON root could not be parsed, but complete edit object(s) were recovered from the malformed response.');
          result.rawJsonText = jsonText.slice(0, 2000);
          result.repairedJsonText = repairedJsonText.slice(0, 2000);
          return result;
        }
        result.warnings.push('Structured editor JSON could not be parsed: ' + (err2 && err2.message ? err2.message : String(err2)) + '. Insertion was blocked instead of guessing from prose.');
        result.rawJsonText = jsonText;
        result.repairedJsonText = repairedJsonText;
        result.rawOutputPreview = rawText.slice(0, 4000);
        return result;
      }
    }
    const edits = coerceStructuredEditArray(parsed);
    result.ok = true;
    result.source = 'final-editor-json';
    result.editMode = clean(parsed?.editMode || parsed?.mode || (equationCoverageActive() ? 'equation_coverage' : 'structured_edits'));
    result.raw = parsed;
    result.warnings = Array.isArray(parsed?.warnings) ? parsed.warnings.map((x) => String(x || '')).filter(Boolean) : [];
    result.edits = edits.map((e, idx) => {
      const targetType = normalizeStructuredTargetType(e?.targetType || e?.type || e?.target_kind || e?.targetKind || (e?.equationId || e?.equation_id ? 'equation' : 'section'));
      const action = normalizeStructuredAction(e?.action || e?.editAction || e?.mode || e?.operation || (e?.oldLatex || e?.oldText ? 'replace' : 'insert_after'));
      const targetId = clean(e?.targetId || e?.target_id || e?.equationId || e?.equation_id || e?.id || '');
      const targetSection = clean(e?.targetSection || e?.section || e?.target || e?.targetTitle || e?.sectionTitle || e?.unit || '');
      const latex = String(e?.latex || e?.latexPatch || e?.patch || e?.newLatex || e?.replacementLatex || e?.paperText || e?.explanationLatex || e?.explanation || e?.text || e?.content || '').trim();
      const oldLatex = String(e?.oldLatex || e?.oldText || e?.old || e?.originalLatex || '').trim();
      const note = clean(e?.note || e?.rationale || e?.reason || e?.why || '');
      return { index: idx + 1, targetType, targetId, targetSection, action, latex, oldLatex, note, raw: e };
    }).filter((e) => e.latex || e.oldLatex || e.action === 'no_edit');
    if (!result.edits.length) {
      const salvaged = salvageStructuredEditObjectsFromPartialJson(rawText);
      const normalized = normalizeStructuredEditsFromArray(salvaged);
      if (normalized.length) {
        result.ok = true;
        result.source = 'empty-root-edits-salvage';
        result.raw = { edits: salvaged };
        result.edits = normalized;
        result.warnings.push('Stage 19N1L: parsed root schema had no usable edits, but complete edit object(s) were recovered from the final editor output.');
      } else {
        result.ok = false;
        result.warnings.push('Structured JSON was present, but it contained no usable edits. Expected non-empty `edits[]` with latex/explanation text or no_edit actions.');
        result.rawJsonText = jsonText;
        result.rawOutputPreview = rawText.slice(0, 4000);
      }
    }
    return result;
  }

  function refreshStructuredEditorData() {
    lastStructuredEditorData = parseStructuredEditorOutputText(finalEditorOutputText());
    return lastStructuredEditorData;
  }


  function toggleMathModeForStructuredSanitizer(state, delimiter) {
    const s = state || { inline: false, display: false };
    if (delimiter === '$') s.inline = !s.inline;
    else if (delimiter === '\\(') s.inline = true;
    else if (delimiter === '\\)') s.inline = false;
    else if (delimiter === '\\[') s.display = true;
    else if (delimiter === '\\]') s.display = false;
    return s;
  }

  function sanitizeStructuredLatexTextForCompile(text) {
    let s = String(text || '');
    if (!s) return s;
    // Stage 19N1L: structured JSON often contains pedagogical prose such as
    // "from eq_025". A raw underscore in text mode causes "Missing $ inserted".
    // Escape unescaped underscores only outside math spans and comments. This is
    // intentionally conservative: it does not rewrite math content or command names.
    let out = '';
    let state = { inline: false, display: false };
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      const next = s.slice(i, i + 2);
      if (!state.inline && !state.display && ch === '%') {
        const nl = s.indexOf('\n', i);
        if (nl < 0) { out += s.slice(i); break; }
        out += s.slice(i, nl + 1);
        i = nl;
        continue;
      }
      if (next === '\\(' || next === '\\)' || next === '\\[' || next === '\\]') {
        out += next;
        toggleMathModeForStructuredSanitizer(state, next);
        i += 1;
        continue;
      }
      if (ch === '$' && !isEscapedAt(s, i)) {
        // Treat $$ as display toggle and $ as inline toggle.
        if (s[i + 1] === '$') { out += '$$'; state.display = !state.display; i += 1; }
        else { out += '$'; state.inline = !state.inline; }
        continue;
      }
      if (!state.inline && !state.display && ch === '_' && !isEscapedAt(s, i)) {
        out += '\\_';
        continue;
      }
      out += ch;
    }
    return out;
  }

  function stripLeadingMatchingSectionCommand(text, targetSection) {
    let value = String(text || '').trim();
    const target = normalizeSectionTitle(targetSection || '').toLowerCase();
    if (!value || !target) return value;
    // Stage 19N1R7: final editor sometimes returns a whole regenerated
    // section even though the targeted insertion engine inserts inside the
    // existing section. If we keep the heading, accepting all \lai edits
    // duplicates \section{...}. Strip only a leading heading whose title
    // matches the intended target section.
    const re = /^\\(section|subsection|subsubsection|paragraph|subparagraph)\*?\s*\{([^{}]{1,180})\}\s*/;
    const m = value.match(re);
    if (!m) return value;
    const found = normalizeSectionTitle(m[2] || '').toLowerCase();
    if (!found || !(found === target || found.includes(target) || target.includes(found))) return value;
    return value.slice(m[0].length).replace(/^\s+/, '');
  }

  function structuredEditLatexBlock(edit) {
    const e = edit || {};
    const targetType = normalizeStructuredTargetType(e.targetType);
    const action = normalizeStructuredAction(e.action);
    const targetSection = clean(e.targetSection || '');
    const targetId = clean(e.targetId || '');
    let latex = sanitizeStructuredLatexTextForCompile(String(e.latex || '').trim());
    let oldLatex = sanitizeStructuredLatexTextForCompile(String(e.oldLatex || '').trim());
    if (targetSection) {
      latex = stripLeadingMatchingSectionCommand(latex, targetSection);
      oldLatex = stripLeadingMatchingSectionCommand(oldLatex, targetSection);
    }
    const hasLai = /\\lai(?:old)?\s*\{/.test(latex);
    if (hasLai && (!oldLatex || /\\laiold\s*\{/.test(latex))) return latex;
    const targetLines = [];
    if (targetType === 'equation' && targetId) targetLines.push('% Target equation id: ' + targetId);
    if (targetSection) targetLines.push('% Target section: ' + targetSection);
    if (action === 'no_edit') {
      return '\\lai{%\n' + targetLines.join('\n') + (targetLines.length ? '\n' : '') + '\\emph{No edits recommended.}\n}';
    }
    if (action === 'replace' && oldLatex) {
      return '\\laiold{' + oldLatex + '}\\lai{%\n' + targetLines.join('\n') + (targetLines.length ? '\n' : '') + (latex || '% TODO: missing replacement text') + '\n}';
    }
    return '\\lai{%\n' + targetLines.join('\n') + (targetLines.length ? '\n' : '') + (latex || '% TODO: missing inserted text') + '\n}';
  }

  function structuredEditorBlocksForInsertion() {
    const data = refreshStructuredEditorData();
    if (!data?.ok || !Array.isArray(data.edits) || !data.edits.length) return [];
    const warnings = data.warnings || [];
    const usableEdits = filterStructuredEditsForEquationCoverage(data.edits, warnings);
    if (!usableEdits.length) {
      const empty = [];
      empty._structuredNotes = warnings;
      return empty;
    }
    const blocks = usableEdits.map(structuredEditLatexBlock).filter(Boolean);
    blocks._structuredNotes = warnings;
    return blocks;
  }

  function renderStructuredEditorPreviewHtml(data) {
    const d = data || refreshStructuredEditorData();
    if (!d?.ok || !Array.isArray(d.edits) || !d.edits.length) {
      return '<div class="settings-note warn">No structured editor JSON was parsed. Legacy \\lai block extraction is being used.</div>' +
        (Array.isArray(d?.warnings) && d.warnings.length ? '<div class="settings-note warn">' + esc(d.warnings.join('; ')) + '</div>' : '');
    }
    const previewWarnings = d.warnings || [];
    const previewEdits = filterStructuredEditsForEquationCoverage(d.edits, previewWarnings);
    const cards = previewEdits.map((e, idx) => {
      const latex = String(e.latex || '').trim();
      const shownLatex = latex.length > 900 ? latex.slice(0, 900) + '…' : latex;
      return '<article class="branch-workflow-edit-card">' +
        '<div class="branch-workflow-edit-meta">' +
          '<span><strong>#</strong> ' + esc(e.index || idx + 1) + '</span>' +
          '<span><strong>target</strong> ' + esc(e.targetType || '') + (e.targetId ? ' · ' + esc(e.targetId) : '') + '</span>' +
          '<span><strong>section</strong> ' + esc(e.targetSection || '(not specified)') + '</span>' +
          '<span><strong>action</strong> ' + esc(e.action || '') + '</span>' +
        '</div>' +
        '<pre class="branch-workflow-edit-latex">' + esc(shownLatex || '(empty latex field)') + '</pre>' +
      '</article>';
    }).join('');
    return '<div class="settings-note good">Structured editor schema parsed: ' + esc(d.edits.length) + ' raw edit(s), ' + esc(previewEdits.length) + ' usable edit(s), mode=' + esc(d.editMode || '') + '.</div>' +
      (Array.isArray(previewWarnings) && previewWarnings.length ? '<div class="settings-note warn">Schema warnings: ' + esc(previewWarnings.join('; ')) + '</div>' : '') +
      '<div class="branch-workflow-edit-list">' + cards + '</div>';
  }

  function blockBodyForDuplicate(block) {
    const parsed = parseLatexMacroBlocks(block, 'lai')[0] || parseLatexMacroBlocks(block, 'laiold')[0];
    return String(parsed?.body || block || '');
  }

  function isNoEditLaiBlock(block) {
    return /\bno\s+edits?\s+recommended\b/i.test(blockBodyForDuplicate(block));
  }

  function canonicalizeLaiBlock(block) {
    return normalizeSectionTitle(blockBodyForDuplicate(block)
      .replace(/%.*$/gm, ' ')
      .replace(/\\paragraph\s*\{\s*Target\s+section\s*:[^}]+\}/ig, ' ')
      .replace(/Target\s+section\s*:[^\n.]{2,160}/ig, ' ')
      .replace(/\\cite\s*\{[^}]*\}/g, '\\cite{CITE}')
      .replace(/[?]+/g, '?')
      .replace(/\s+/g, ' ')).toLowerCase();
  }

  function likelyAlreadyAppliedToSource(block, source) {
    const src = String(source || '');
    const raw = String(block || '').trim();
    if (!raw) return false;
    if (src.includes(raw)) return true;
    const body = blockBodyForDuplicate(block).trim();
    if (body && body.length > 80 && src.includes(body.slice(0, Math.min(220, body.length)))) return true;
    return false;
  }

  function tokenSetForDedupe(text) {
    const stop = new Set(['the','and','for','with','this','that','from','into','onto','section','target','edit','edits','recommended','add','insert','revise','paragraph','cite','citation','citations','work','literature']);
    return new Set(String(text || '').toLowerCase().replace(/\\[a-z]+(?:\s*\{[^}]*\})?/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !stop.has(w)));
  }

  function jaccardSimilarity(a, b) {
    const A = tokenSetForDedupe(a);
    const B = tokenSetForDedupe(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    A.forEach((x) => { if (B.has(x)) inter += 1; });
    return inter / Math.max(1, A.size + B.size - inter);
  }

  function isNearDuplicateLaiBlock(block, existingBlocks) {
    const body = canonicalizeLaiBlock(block);
    return (existingBlocks || []).some((old) => {
      const oldBody = canonicalizeLaiBlock(old);
      if (!body || !oldBody) return false;
      if (body === oldBody) return true;
      if (body.length > 120 && oldBody.length > 120 && (body.includes(oldBody.slice(0, 180)) || oldBody.includes(body.slice(0, 180)))) return true;
      return jaccardSimilarity(body, oldBody) >= 0.52;
    });
  }

  function stripTargetCommentFromLaiBody(body) {
    return String(body || '')
      .replace(/^\s*%\s*\n?/, '')
      .replace(/^\s*%\s*Target\s+section\s*:[^\n]*\n?/i, '')
      .replace(/^\s*\\paragraph\s*\{\s*Target\s+section\s*:[^}]+\}\s*/i, '')
      .trim();
  }

  function isPatchStyleLaiBlock(block) {
    const parsed = parseLatexMacroBlocks(block, 'lai')[0];
    if (!parsed) return false;
    const body = stripTargetCommentFromLaiBody(parsed.body);
    if (/^\\emph\s*\{\s*No\s+edits?\s+recommended\.?\s*\}\s*\.?$/i.test(body)) return true;
    if (/^No\s+edits?\s+recommended\.?$/i.test(body)) return true;
    if (/\\laiold\s*\{/.test(block)) return true;
    const advisoryStart = /^(?:Target\s+section\s*:\s*)?(?:Add|Insert|Revise|Rewrite|Replace|Expand|Clarify|Enhance|Recommend|Consider|Suggest|Include|Mention)\b/i;
    if (advisoryStart.test(body)) return false;
    const advisoryPhrases = [
      /\b(?:Insert|Add|Replace|Revise|Rewrite|Expand|Clarify|Enhance)\s+(?:the|a|an|this|current|following)\b/i,
      /\b(?:paragraph|sentence|section)\s+(?:with|by|after|before)\b/i,
      /\bFor\s+example\s*,?\s+(?:revise|replace|insert|add)\b/i,
      /\bThis\s+(?:will|would)\s+(?:clarify|strengthen|situate|highlight)\b/i
    ];
    if (advisoryPhrases.some((re) => re.test(body))) return false;
    if (body.length < 16) return false;
    return true;
  }

  function filterPatchStyleLaiBlocks(blocks) {
    const kept = [];
    const skipped = [];
    (blocks || []).forEach((block) => {
      const b = String(block || '').trim();
      if (!b) return;
      if (isPatchStyleLaiBlock(b)) kept.push(b);
      else skipped.push('dropped advisory/non-patch block: ' + canonicalizeLaiBlock(b).slice(0, 90));
    });
    kept._patchNotes = skipped;
    return kept;
  }

  function dedupeLaiBlocksForInsertion(blocks, targets) {
    const active = getActiveSource();
    const seen = new Set();
    const byTarget = new Map();
    const skipped = [];
    (blocks || []).forEach((raw, idx) => {
      const block = String(raw || '').trim();
      if (!block || !/\\lai\s*\{/.test(block)) return;
      const fallback = targets && targets.length ? targets[Math.min(idx, targets.length - 1)] : '';
      const eqId = inferEquationTargetIdFromLaiBlock(block);
      const target = eqId ? ('Equation ' + eqId) : (inferTargetFromLaiBlock(block, fallback, targets) || fallback || 'untargeted');
      const targetKey = eqId ? ('equation::' + eqId) : (normalizeSectionTitle(target).toLowerCase() || 'untargeted');
      const bodyKey = canonicalizeLaiBlock(block);
      if (!bodyKey) return;
      const key = targetKey + '::' + bodyKey.slice(0, 900);
      if (seen.has(key)) { skipped.push('duplicate block for ' + target); return; }
      if (likelyAlreadyAppliedToSource(block, active)) { skipped.push('already applied block for ' + target); return; }
      if (!byTarget.has(targetKey)) byTarget.set(targetKey, { target, edits: [], noEdits: [] });
      const bucket = byTarget.get(targetKey);
      const list = isNoEditLaiBlock(block) ? bucket.noEdits : bucket.edits;
      if (isNearDuplicateLaiBlock(block, list)) { skipped.push('near-duplicate block for ' + target); return; }
      seen.add(key);
      list.push(block);
    });
    const out = [];
    byTarget.forEach((bucket) => {
      if (bucket.edits.length) {
        // If there are actual edits for a section, a simultaneous no-edit marker is contradictory.
        // Stage 19N1G caps excessive variants per target; the editor should consolidate, not
        // paste every phrasing from the debate transcript into the paper.
        if (bucket.edits.length > 2) skipped.push('kept first 2 non-overlapping edits for ' + bucket.target + ', dropped ' + (bucket.edits.length - 2) + ' extra variant(s)');
        out.push(...bucket.edits.slice(0, 2));
      } else if (bucket.noEdits.length) {
        out.push(bucket.noEdits[0]);
      }
    });
    out._dedupeNotes = skipped;
    return out;
  }

  function laiBlocksForInsertion() {
    const targets = desiredTargetSections(selectedRealPayload() || lastRealRunData || lastSelectionData || {});
    const addParsed = (text) => parseLatexMacroBlocks(text, 'lai').map((b) => b.raw).filter(Boolean);
    let blocks = [];

    // Stage 19N1K: prefer the final editor's structured JSON schema when present.
    // This avoids scraping random prose and gives the insertion engine targetType/targetId/action.
    const structuredBlocks = structuredEditorBlocksForInsertion();
    if (structuredBlocks.length) {
      const patchFilteredStructured = filterPatchStyleLaiBlocks(structuredBlocks);
      const dedupedStructured = dedupeLaiBlocksForInsertion(patchFilteredStructured, targets);
      lastInsertionDedupeNotes = [
        'Using Stage 19N1K structured editor schema instead of legacy free-form \\lai scraping.',
        ...((Array.isArray(structuredBlocks._structuredNotes) ? structuredBlocks._structuredNotes : [])),
        ...((Array.isArray(patchFilteredStructured._patchNotes) ? patchFilteredStructured._patchNotes : [])),
        ...((Array.isArray(dedupedStructured._dedupeNotes) ? dedupedStructured._dedupeNotes : []))
      ];
      return dedupedStructured;
    }

    // Stage 19N1H: insert only the final editor's curated answer by default.
    // Earlier critic/advocate/synthesizer outputs often contain candidate edits that the
    // final editor later repeats or rejects; using all outputs caused duplicated red text.
    blocks = addParsed(finalEditorOutputText());

    // Fall back only if the final editor failed to return parseable \lai blocks.
    if (!blocks.length) {
      const add = (arr) => { if (Array.isArray(arr)) arr.forEach((x) => { const v = String(x || '').trim(); if (v) blocks.push(v); }); };
      add(lastCleanerData?.insertableLaiBlocks);
      add(lastCleanerData?.validVisibleLaiBlocks);
      if (!blocks.length) add(lastRealRunData?.insertableLaiBlocks);
      if (!blocks.length) add(lastRealRunData?.visibleLaiBlocks);
      if (!blocks.length && lastRealRunData?.finalOutput) blocks = addParsed(lastRealRunData.finalOutput);
    }

    const patchFiltered = filterPatchStyleLaiBlocks(blocks);
    const deduped = dedupeLaiBlocksForInsertion(patchFiltered, targets);
    lastInsertionDedupeNotes = [
      ...(Array.isArray(patchFiltered._patchNotes) ? patchFiltered._patchNotes : []),
      ...(Array.isArray(deduped._dedupeNotes) ? deduped._dedupeNotes : [])
    ];
    return deduped;
  }


  function titleKeyForMatch(title) {
    return normalizeSectionTitle(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function matchKnownTargetTitle(candidate, knownTargets) {
    const c = titleKeyForMatch(candidate);
    if (!c) return '';
    const targets = (knownTargets || []).map((t) => normalizeSectionTitle(t)).filter(Boolean);
    let best = '';
    let bestLen = 0;
    targets.forEach((t) => {
      const k = titleKeyForMatch(t);
      if (!k) return;
      if ((c === k || c.startsWith(k + ' ') || c.includes(' ' + k + ' ') || k.includes(c)) && k.length > bestLen) {
        best = t;
        bestLen = k.length;
      }
    });
    return best;
  }

  function cleanTargetCandidate(candidate) {
    let c = normalizeSectionTitle(candidate || '');
    c = c.replace(/^\s*Target\s+section\s*:\s*/i, '');
    c = c.replace(/\s*(?:Add|Insert|Revise|Rewrite|Expand|Clarify|Enhance|Recommend|No\s+edits?\s+recommended|Covered\s+above|Similarly)\b[\s\S]*$/i, '').trim();
    c = c.replace(/[.。:;,-]+$/g, '').trim();
    return c;
  }

  function inferEquationTargetIdFromLaiBlock(block) {
    const s = String(block || '');
    const m = s.match(/%\s*Target\s+equation\s*(?:id)?\s*:\s*(eq[_-]?\d+)/i) || s.match(/Target\s+equation\s*(?:id)?\s*:\s*(eq[_-]?\d+)/i);
    return m && m[1] ? m[1].replace(/-/g, '_').toLowerCase() : '';
  }

  function equationTargetById(equations, id) {
    const key = String(id || '').replace(/-/g, '_').toLowerCase();
    return (equations || []).find((eq) => String(eq.id || '').toLowerCase() === key) || null;
  }

  function equationIdSetForCurrentSelection() {
    if (!equationCoverageActive()) return null;
    try {
      const payload = selectedRealPayload() || lastRealRunData || lastSelectionData || {};
      const ids = selectedEquationTargets(payload).map((eq) => String(eq.id || '').toLowerCase()).filter(Boolean);
      return new Set(ids);
    } catch (_err) {
      return new Set();
    }
  }

  function scoreEquationStructuredEditForDedup(edit) {
    const latex = String(edit?.latex || '').trim();
    const action = normalizeStructuredAction(edit?.action);
    if (!latex && action !== 'no_edit') return -1000;
    if (action === 'no_edit') return -500;
    // Prefer concise explanatory prose over empty or very long transcript-like text.
    const len = latex.length;
    let score = 0;
    score += Math.min(len, 650) / 10;
    if (len > 900) score -= (len - 900) / 20;
    if (/This equation|This identity|This expression|This formula|This derivation|Here,|The equation/i.test(latex)) score += 25;
    if (/Add a paragraph|Insert after|Replace the current|Consider citing|Target section:/i.test(latex)) score -= 60;
    if (/No edits recommended/i.test(latex)) score -= 100;
    return score;
  }

  function filterStructuredEditsForEquationCoverage(edits, warnings) {
    const arr = Array.isArray(edits) ? edits : [];
    if (!equationCoverageActive()) return arr;
    const validIds = equationIdSetForCurrentSelection();
    const byId = new Map();
    let dropped = 0;
    let duplicateDropped = 0;
    arr.forEach((e) => {
      const id = String(e?.targetId || '').replace(/-/g, '_').toLowerCase();
      const isEquation = normalizeStructuredTargetType(e?.targetType) === 'equation';
      const action = normalizeStructuredAction(e?.action);
      if (!isEquation || !id) { dropped += 1; return; }
      if (validIds && validIds.size && !validIds.has(id)) { dropped += 1; return; }
      if (action === 'no_edit') { dropped += 1; return; }
      const candidate = { ...e, targetType: 'equation', targetId: id, action: action || 'insert_after' };
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, candidate);
      } else {
        duplicateDropped += 1;
        if (scoreEquationStructuredEditForDedup(candidate) > scoreEquationStructuredEditForDedup(prev)) {
          byId.set(id, candidate);
        }
      }
    });
    const selectedIds = validIds ? Array.from(validIds) : [];
    const out = selectedIds.length ? selectedIds.map((id) => byId.get(id)).filter(Boolean) : Array.from(byId.values());
    if (dropped && Array.isArray(warnings)) {
      warnings.push('Stage 19N1M: dropped ' + dropped + ' non-equation, invalid-id, or no-edit structured item(s) because math/equation coverage mode is active.');
    }
    if (duplicateDropped && Array.isArray(warnings)) {
      warnings.push('Stage 19N1M: deduplicated ' + duplicateDropped + ' extra equation edit variant(s); kept at most one explanation per equation id.');
    }
    if (validIds && validIds.size && out.length < validIds.size && Array.isArray(warnings)) {
      warnings.push('Stage 19N1M: equation coverage is partial: ' + out.length + ' usable explanation(s) for ' + validIds.size + ' detected equation id(s).');
    }
    return out;
  }

  function isEquationExplanationBlock(block) {
    return !!inferEquationTargetIdFromLaiBlock(block);
  }

  function inferTargetFromLaiBlock(block, fallback, knownTargets) {
    const s = String(block || '');
    const pats = [
      /Target\s+section\s*:\s*([^}\n\\]{2,180})/i,
      /Target\s*:\s*([^}\n\\]{2,180})/i,
      /section\s*[:=]\s*([^}\n\\]{2,180})/i
    ];
    for (const pat of pats) {
      const m = s.match(pat);
      if (!m || !m[1]) continue;
      const rawCandidate = normalizeSectionTitle(m[1]);
      const known = matchKnownTargetTitle(rawCandidate, knownTargets);
      if (known) return known;
      const cleaned = cleanTargetCandidate(rawCandidate);
      const knownCleaned = matchKnownTargetTitle(cleaned, knownTargets);
      if (knownCleaned) return knownCleaned;
      if (cleaned) return cleaned;
    }
    const fallbackKnown = matchKnownTargetTitle(fallback || '', knownTargets);
    return fallbackKnown || normalizeSectionTitle(fallback || '');
  }

  function insertBeforeEndDocument(source, addition) {
    const s = String(source || '');
    const end = findLastEndDocument(s);
    const block = String(addition || '').trim();
    if (!block) return s;
    if (!end) return s.replace(/\s*$/, '') + '\n\n' + block + '\n';
    return s.slice(0, end.index).replace(/\s+$/, '') + '\n\n' + block + '\n\n' + s.slice(end.index);
  }

  function buildAppendDraftFromBlocks(source, blocks, targets) {
    const safeBlocks = (blocks || []).map((b) => String(b || '').trim()).filter(Boolean);
    if (!safeBlocks.length) return source;
    const header = [
      '% --- Latexai appended multi-section Devil\'s Advocate suggestions ---',
      '% These suggestions were inserted before \\end{document} so they compile.',
      '% Review citation placeholders before accepting.',
      ''
    ].join('\n');
    const targetNote = (targets && targets.length) ? '% Requested target sections: ' + targets.join(', ') + '\n' : '';
    return insertBeforeEndDocument(source, header + targetNote + safeBlocks.join('\n\n'));
  }

  function escapeRegExpForBranchWorkflow(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function findOldLatexRangeInWindow(source, oldText, start, end) {
    const s = String(source || '');
    const old = String(oldText || '').trim();
    if (!old || old.length < 12) return null;
    const lo = Math.max(0, Number(start) || 0);
    const hi = Math.max(lo, Math.min(s.length, Number(end) || s.length));
    const window = s.slice(lo, hi);
    let idx = window.indexOf(old);
    if (idx >= 0) return { start: lo + idx, end: lo + idx + old.length, exact: true };

    // Whitespace-tolerant fallback for copied section text whose line wrapping
    // changed between the prompt and source. Keep this bounded to the target
    // section/document window to avoid accidental global replacements.
    try {
      const pattern = old.split(/\s+/).filter(Boolean).map(escapeRegExpForBranchWorkflow).join('\\s+');
      if (pattern && pattern.length < 20000) {
        const re = new RegExp(pattern, 'm');
        const m = re.exec(window);
        if (m) return { start: lo + m.index, end: lo + m.index + m[0].length, exact: false };
      }
    } catch (_err) {}
    return null;
  }

  function replacementRangeForOldLaiBlock(source, block, target, sections) {
    const oldMacro = parseLatexMacroBlocks(block, 'laiold')[0];
    if (!oldMacro || !String(oldMacro.body || '').trim()) return null;
    const oldBody = stripLeadingMatchingSectionCommand(oldMacro.body, target);
    if (!oldBody || oldBody.trim().length < 12) return null;
    const sec = (sections || []).find((x) => sectionMatches(x, target));
    if (sec) {
      const hit = findOldLatexRangeInWindow(source, oldBody, sec.headerEnd, sec.end);
      if (hit) return { ...hit, target: sec.title, mode: 'section-old-text' };
    }
    const begin = String(source || '').search(/\\begin\s*\{document\}/);
    const endDoc = findLastEndDocument(source);
    const globalStart = begin >= 0 ? begin : 0;
    const globalEnd = endDoc ? endDoc.index : String(source || '').length;
    const hit = findOldLatexRangeInWindow(source, oldBody, globalStart, globalEnd);
    return hit ? { ...hit, target: target || '', mode: 'global-old-text' } : null;
  }

  function stripSectionCommandsFromAdditiveBlock(block, target) {
    // If the editor returned a whole \section{X}... in a new-only \lai block
    // and we cannot make an old-text replacement, strip the duplicate heading
    // before inserting inside the already-existing section X.
    let out = String(block || '');
    const laiBlocks = parseLatexMacroBlocks(out, 'lai').sort((a, b) => b.start - a.start);
    laiBlocks.forEach((b) => {
      const cleanBody = stripLeadingMatchingSectionCommand(b.body, target);
      if (cleanBody !== String(b.body || '').trim()) {
        out = out.slice(0, b.start) + '\\lai{%\n' + cleanBody + '\n}' + out.slice(b.end);
      }
    });
    return out;
  }

  function buildTargetedDraftFromBlocks(source, blocks, targets) {
    const rawSource = String(source || '');
    // Stage 19N1M: in equation coverage mode, applying a new preview should
    // replace old equation-explanation wrappers rather than stacking another
    // generation below the same display equations.
    const s = equationCoverageActive() ? removeLatexaiEquationExplanationRegions(rawSource) : rawSource;
    const sections = topLevelSections(s);
    const equations = extractDisplayEquationTargets(s, { maxCount: 160 });
    const safeBlocks = (blocks || []).map((b) => String(b || '').trim()).filter(Boolean);
    if (!safeBlocks.length) return s;
    const sectionGroups = new Map();
    const insertions = [];

    safeBlocks.forEach((block, idx) => {
      const eqId = inferEquationTargetIdFromLaiBlock(block);
      if (eqId) {
        const eq = equationTargetById(equations, eqId);
        const label = eq ? (eq.id + ' in ' + eq.section) : eqId;
        const blockText = [
          '',
          '% --- Latexai equation explanation suggestion for: ' + label + ' ---',
          block,
          '% --- end Latexai equation explanation suggestion ---',
          ''
        ].join('\n');
        if (eq) insertions.push({ index: eq.end, text: blockText, target: label });
        else insertions.push({ index: findLastEndDocument(s)?.index ?? s.length, text: blockText, target: label });
        return;
      }

      const fallback = targets && targets.length ? targets[Math.min(idx, targets.length - 1)] : '';
      let target = inferTargetFromLaiBlock(block, fallback, targets);
      if (!target) target = firstExistingSectionTitle(targets, s) || sections[0]?.title || '';
      const hit = sections.find((sec) => sectionMatches(sec, target));
      const key = hit ? hit.title : target;

      // Stage 19N1R7: replacement-style Devil's Advocate edits must wrap the
      // existing old text in-place. If we merely insert \laiold{old}\lai{new}
      // above a section, then accepting all new content keeps the untouched
      // original section and also inserts the regenerated section, creating
      // repeated sections. Use oldLatex as an anchor whenever possible.
      const replacementRange = replacementRangeForOldLaiBlock(s, block, key, sections);
      if (replacementRange) {
        const blockText = [
          '',
          '% --- Latexai targeted Devil\'s Advocate replacement for section: ' + (key || replacementRange.target || 'unknown') + ' ---',
          stripSectionCommandsFromAdditiveBlock(block, key || replacementRange.target || ''),
          '% --- end Latexai targeted replacement ---',
          ''
        ].join('\n');
        insertions.push({ index: replacementRange.start, end: replacementRange.end, text: blockText, target: key, replacement: true });
        return;
      }

      if (!sectionGroups.has(key)) sectionGroups.set(key, []);
      sectionGroups.get(key).push(stripSectionCommandsFromAdditiveBlock(block, key));
    });

    sectionGroups.forEach((bs, target) => {
      const sec = sections.find((x) => sectionMatches(x, target));
      const blockText = [
        '',
        '% --- Latexai targeted Devil\'s Advocate suggestion for section: ' + target + ' ---',
        ...bs,
        '% --- end Latexai targeted suggestion ---',
        ''
      ].join('\n');
      if (sec) insertions.push({ index: sec.headerEnd, text: blockText, target });
      else insertions.push({ index: findLastEndDocument(s)?.index ?? s.length, text: blockText, target });
    });

    if (!insertions.length) return buildAppendDraftFromBlocks(s, safeBlocks, targets);
    let out = s;
    insertions.sort((a, b) => b.index - a.index).forEach((ins) => {
      const end = Number.isFinite(Number(ins.end)) ? Number(ins.end) : ins.index;
      out = out.slice(0, ins.index) + ins.text + out.slice(end);
    });
    return out;
  }

  function structuredInsertionFailureWarnings() {
    const parsed = lastStructuredEditorData || refreshStructuredEditorData();
    const warnings = [];
    if (!parsed?.ok || !Array.isArray(parsed.edits) || !parsed.edits.length) {
      warnings.push('Stage 19N1L: no usable structured editor edits were available, so insertion was blocked instead of guessing from prose.');
      if (Array.isArray(parsed?.warnings) && parsed.warnings.length) warnings.push(...parsed.warnings);
      if (parsed?.rawJsonText) warnings.push('Raw structured JSON preview: ' + String(parsed.rawJsonText).slice(0, 600));
      else if (parsed?.rawOutputPreview) warnings.push('Final editor output preview: ' + String(parsed.rawOutputPreview).slice(0, 600));
    }
    return warnings;
  }

  function enhanceInsertionDataWithMultiSectionDrafts(data) {
    const source = getActiveSource();
    const targets = desiredTargetSections(selectedRealPayload() || lastRealRunData || lastSelectionData || {});
    const blocks = laiBlocksForInsertion();
    if (!blocks.length) {
      const extraWarnings = structuredInsertionFailureWarnings();
      if (!extraWarnings.length) return data;
      return {
        ...(data || {}),
        blockCount: data?.blockCount || 0,
        safeToInsert: false,
        safeToAutoApply: false,
        warnings: [
          ...((data && Array.isArray(data.warnings)) ? data.warnings : []),
          ...extraWarnings
        ]
      };
    }
    const targeted = normalizeLaiDraftForCompilation(buildTargetedDraftFromBlocks(source, blocks, targets), 'targeted');
    const append = normalizeLaiDraftForCompilation(buildAppendDraftFromBlocks(source, blocks, targets), 'append');
    const blockTargets = blocks.map((b, i) => inferEquationTargetIdFromLaiBlock(b) || inferTargetFromLaiBlock(b, targets[Math.min(i, Math.max(0, targets.length - 1))] || '', targets)).filter(Boolean);
    return {
      ...(data || {}),
      targetedInsertionDraft: targeted,
      appendOnlyDraft: append,
      insertableLatexDraft: targeted,
      targetSections: targets,
      blockSectionTargets: blockTargets,
      blockCount: blocks.length,
      safeToInsert: blocks.length > 0,
      safeToAutoApply: false,
      multiSectionFrontendInsertion: true,
      warnings: [
        ...((data && Array.isArray(data.warnings)) ? data.warnings : []),
        'Stage 19N1L inserted only final-editor \\lai blocks by default, removed duplicate repeated blocks, and dropped contradictory no-edit markers when edits exist for the same target.',
        ...(lastInsertionDedupeNotes.length ? ['Deduplication skipped: ' + lastInsertionDedupeNotes.slice(0, 8).join('; ') + (lastInsertionDedupeNotes.length > 8 ? '; ...' : '')] : [])
      ]
    };
  }

  function insertionPayload() {
    const selected = lastSelectionData?.selectedBranch || lastRealRunData?.selectedBranch || selectedRealPayload()?.selectedBranch || {};
    const executionPlan = lastSelectionData?.executionPlan || lastRealRunData?.executionPlan || selectedRealPayload()?.executionPlan || {};
    return {
      latexSource: getActiveSource(),
      targetSectionOverride: splitTargetSections(inputValue('branchWorkflowTargetSection', '')).join(', '),
      insertionMode: inputValue('branchWorkflowInsertMode', 'targeted'),
      selectedBranch: selected,
      executionPlan,
      realAgentRunResult: lastRealRunData || null,
      cleanerResult: lastCleanerData || null,
      cleanedLaiBlocks: lastCleanerData?.insertableLaiBlocks || lastCleanerData?.validVisibleLaiBlocks || lastRealRunData?.insertableLaiBlocks || lastRealRunData?.visibleLaiBlocks || [],
      metadata: { frontendStage: STAGE, activePath: activePath(), debateRoundCount: debateRoundCount(), debateMode: 'critic-advocate-rounds', visibleContextMode: visibleContextMode(), payloadSourceMode: payloadSourceMode(), targetSections: desiredTargetSections(selectedRealPayload() || lastSelectionData || lastRealRunData || {}) }
    };
  }

  function renderInsertion(data) {
    const diff = data?.diffSummary || {};
    const targetedDraft = data?.targetedInsertionDraft || data?.insertableLatexDraft || '';
    const rawAppendDraft = data?.appendOnlyDraft || '';
    const appendDraft = rawAppendDraft ? normalizeLaiDraftForCompilation(rawAppendDraft, 'append') : '';
    const chosenDraft = inputValue('branchWorkflowInsertMode', 'targeted') === 'append' ? appendDraft : normalizeLaiDraftForCompilation(targetedDraft, 'targeted');
    const body =
      '<div class="settings-note"><strong>safeToInsert:</strong> ' + esc(data?.safeToInsert) + ' · safeToAutoApply=' + esc(data?.safeToAutoApply) + ' · blocks=' + esc(data?.blockCount || 0) + '</div>' +
      '<div class="settings-note">Target: ' + esc(diff.targetSection || data?.targetSection || (Array.isArray(data?.targetSections) ? data.targetSections.join(', ') : 'append/end')) + ' · mode: ' + esc(data?.insertionMode || '') + '</div>' +
      (data?.multiSectionFrontendInsertion ? '<div class="settings-note good">Multi-section frontend insertion is active. Block targets: ' + esc((data.blockSectionTargets || []).join(', ') || 'none inferred') + '</div>' : '') +
      '<details open><summary>Structured edit schema preview</summary>' + renderStructuredEditorPreviewHtml(lastStructuredEditorData || refreshStructuredEditorData()) + '</details>' +
      '<div class="settings-note warn">The source editor shows raw <code>\\lai</code> markup. The visual preview below shows intended colors; the PDF shows colors after Compile PDF. <code>\\laiold</code> appears only for old/new replacement edits, not for pure inserted additions.</div>' +
      (Array.isArray(data?.warnings) && data.warnings.length ? '<div class="settings-note warn">Warnings: ' + esc(data.warnings.join('; ')) + '</div>' : '') +
      '<details open><summary>Visual colored LAI preview</summary>' + renderLaiColorPreviewHtml(chosenDraft || targetedDraft || appendDraft) + '</details>' +
      '<details><summary>Targeted insertion draft source</summary><pre class="branch-workflow-latex-source-preview">' + esc(targetedDraft) + '</pre></details>' +
      '<details><summary>Append-only draft source</summary><pre class="branch-workflow-latex-source-preview">' + esc(appendDraft) + '</pre></details>' +
      (rawAppendDraft && rawAppendDraft !== appendDraft ? '<div class="settings-note good">Append preview was normalized: any \\lai blocks after <code>\\end{document}</code> were moved before <code>\\end{document}</code> so they compile.</div>' : '');
    renderSummary('Preview cleaned LAI insertion', renderRunDashboard(currentBranchRunSnapshot('insertion_preview'), body));
    renderInlinePreview('Insertion preview ready', body);
    revealWorkflowPreview();
  }

  async function prepareInsertion() {
    if (!lastCleanerData && lastRealRunData) await cleanLastRealRun();
    if (!lastCleanerData && !lastRealRunData) throw new Error('Run agents and clean result before previewing insertion.');
    status('Preparing targeted/append insertion preview...', 'warn');
    let data = await backendPost('/debate/prepare-lai-insertion', insertionPayload());
    data = enhanceInsertionDataWithMultiSectionDrafts(data);
    lastInsertionData = data;
    renderInsertion(data);
    try { await saveCurrentBranchRun('insertion_preview_prepared', { quiet: true }); } catch (_err) {}
    status('Prepared insertion preview: blocks=' + (data.blockCount || 0) + ', safe=' + data.safeToInsert + '. Preview is shown in the dock above and in the output box below.', 'good');
    revealWorkflowPreview();
    return data;
  }


function compactHashText(value) {
  const s = String(value || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

function readSavedBranchRunsLocal() {
  try {
    const arr = JSON.parse(W.localStorage?.getItem?.(SAVED_BRANCH_RUNS_KEY) || '[]');
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch (_err) { return []; }
}

function writeSavedBranchRunsLocal(runs) {
  const list = Array.isArray(runs) ? runs.filter(Boolean).slice(0, SAVED_BRANCH_RUNS_LIMIT) : [];
  try { W.localStorage?.setItem?.(SAVED_BRANCH_RUNS_KEY, JSON.stringify(list)); } catch (_err) {}
  refreshSavedRunPicker(list);
  return list;
}

function branchRunTitle(snapshot) {
  const branch = snapshot?.realRunData?.selectedBranch || snapshot?.selectionData?.selectedBranch || snapshot?.selectedBranch || {};
  const title = branch.title || snapshot?.title || snapshot?.runId || 'Devil’s Advocate run';
  const when = snapshot?.savedAt ? new Date(snapshot.savedAt).toLocaleString() : '';
  return (when ? when + ' · ' : '') + title;
}

function currentBranchRunSnapshot(reason) {
  const selected = lastSelectionData?.selectedBranch || lastRealRunData?.selectedBranch || selectedRealPayload()?.selectedBranch || {};
  const runId = lastRealRunData?.runId || lastSelectionData?.runId || ('local-' + Date.now().toString(36) + '-' + Math.random().toString(16).slice(2, 8));
  const structured = lastStructuredEditorData || refreshStructuredEditorData();
  const snapshot = {
    ok: true,
    id: runId,
    runId,
    savedAt: new Date().toISOString(),
    savedReason: reason || 'manual',
    stage: STAGE,
    activePath: activePath(),
    sourceHash: compactHashText(getActiveSource()),
    title: selected?.title || 'Devil’s Advocate branch run',
    branchType: selected?.branchType || '',
    query: inputValue('branchWorkflowQuery', ''),
    reviewText: inputValue('branchWorkflowReviewText', ''),
    paperSummary: inputValue('branchWorkflowPaperSummary', ''),
    insertionMode: inputValue('branchWorkflowInsertMode', 'targeted'),
    debateRoundCount: debateRoundCount(),
    routeSummary: debateRouteSummaryObject(),
    targetSections: desiredTargetSections(selectedRealPayload() || lastSelectionData || lastRealRunData || {}),
    selectionData: lastSelectionData || null,
    realRunData: lastRealRunData || null,
    cleanerData: lastCleanerData || null,
    insertionData: lastInsertionData || null,
    structuredEditorData: structured || null,
    outcomeData: lastOutcomeData || null
  };
  snapshot.reportMarkdown = buildBranchRunReport(snapshot);
  return snapshot;
}

function summarizeStructuredEditsForReport(structured) {
  const edits = Array.isArray(structured?.edits) ? structured.edits : [];
  if (!edits.length) return '_No structured edits parsed yet._';
  return edits.map((e, i) => {
    const target = [e.targetType || 'section', e.targetId || '', e.targetSection || ''].filter(Boolean).join(' / ');
    return (i + 1) + '. **' + (e.action || 'edit') + '** → ' + target + '\n' +
      '   - Note: ' + (e.note || '') + '\n' +
      '   - LaTeX preview: `' + String(e.latex || '').replace(/`/g, '\\`').slice(0, 240) + (String(e.latex || '').length > 240 ? '…' : '') + '`';
  }).join('\n');
}

function buildBranchRunReport(snapshot) {
  const snap = snapshot || currentBranchRunSnapshot('report');
  const run = snap.realRunData || {};
  const selected = run.selectedBranch || snap.selectionData?.selectedBranch || snap.selectedBranch || {};
  const outputs = Array.isArray(run.agentOutputs) ? run.agentOutputs : [];
  const structured = snap.structuredEditorData || {};
  const insertion = snap.insertionData || {};
  const lines = [];
  lines.push('# Latexai Devil’s Advocate branch run report');
  lines.push('');
  lines.push('- Saved: ' + (snap.savedAt || new Date().toISOString()));
  lines.push('- Run id: `' + (snap.runId || '') + '`');
  lines.push('- Active file: `' + (snap.activePath || '') + '`');
  lines.push('- Source hash: `' + (snap.sourceHash || '') + '`');
  lines.push('- Branch: **' + (selected.title || snap.title || 'selected branch') + '**');
  lines.push('- Branch type: `' + (selected.branchType || snap.branchType || '') + '`');
  lines.push('- Debate rounds: ' + (snap.debateRoundCount || ''));
  lines.push('- Target sections: ' + ((snap.targetSections || selected.targetSections || []).join(', ') || 'none'));
  lines.push('');
  lines.push('## Model routes actually configured');
  lines.push('```json');
  lines.push(JSON.stringify(snap.routeSummary || {}, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Focus / review signal');
  lines.push('**Query:** ' + (snap.query || ''));
  lines.push('');
  lines.push('**Review signal:**');
  lines.push('');
  lines.push(snap.reviewText || '_No review signal supplied._');
  lines.push('');
  lines.push('## Agent transcript');
  if (!outputs.length) lines.push('_No agent outputs recorded._');
  outputs.forEach((o, i) => {
    lines.push('');
    lines.push('### ' + (i + 1) + '. ' + (o.agentRole || 'agent') + (o.debateRound ? ' round ' + o.debateRound : ''));
    lines.push('- Provider/model: `' + (o.provider || '') + '/' + (o.model || '') + '`');
    lines.push('- Task: ' + (o.taskType || ''));
    lines.push('');
    lines.push(String(o.outputText || '').trim() || '_Empty output._');
  });
  lines.push('');
  lines.push('## Final structured LaTeX edits');
  lines.push(summarizeStructuredEditsForReport(structured));
  lines.push('');
  lines.push('## Insertion preview');
  lines.push('- Safe to insert: `' + String(insertion.safeToInsert ?? '') + '`');
  lines.push('- Block count: `' + String(insertion.blockCount ?? '') + '`');
  lines.push('- Mode: `' + String(insertion.insertionMode || snap.insertionMode || '') + '`');
  if (insertion.targetedInsertionDraft || insertion.insertableLatexDraft) {
    lines.push('');
    lines.push('### Targeted draft');
    lines.push('```latex');
    lines.push(String(insertion.targetedInsertionDraft || insertion.insertableLatexDraft || '').slice(0, 20000));
    lines.push('```');
  }
  if (insertion.appendOnlyDraft) {
    lines.push('');
    lines.push('### Append draft');
    lines.push('```latex');
    lines.push(String(insertion.appendOnlyDraft || '').slice(0, 20000));
    lines.push('```');
  }
  lines.push('');
  lines.push('## Outcome / learning signal');
  lines.push('```json');
  lines.push(JSON.stringify(snap.outcomeData || {}, null, 2));
  lines.push('```');
  return lines.join('\n');
}

function upsertSavedBranchRunLocal(snapshot) {
  if (!snapshot) return null;
  const id = snapshot.id || snapshot.runId || ('local-' + Date.now().toString(36));
  snapshot.id = id;
  snapshot.runId = snapshot.runId || id;
  snapshot.reportMarkdown = snapshot.reportMarkdown || buildBranchRunReport(snapshot);
  const prev = readSavedBranchRunsLocal().filter((r) => (r.id || r.runId) !== id);
  prev.unshift(snapshot);
  writeSavedBranchRunsLocal(prev);
  return snapshot;
}

async function saveCurrentBranchRun(reason, options = {}) {
  if (!lastSelectionData && !lastRealRunData && !lastInsertionData) {
    if (!options.quiet) status('No branch run is available to save yet.', 'warn');
    return null;
  }
  const snapshot = currentBranchRunSnapshot(reason || 'manual');
  upsertSavedBranchRunLocal(snapshot);
  if (!options.localOnly) {
    try {
      const saved = await backendPost('/debate/save-run', { snapshot, reportMarkdown: snapshot.reportMarkdown, metadata: { frontendStage: STAGE, saveReason: reason || 'manual' } });
      snapshot.backendSaveId = saved.saveId || saved.trajectoryId || saved.id || '';
      snapshot.backendSavedAt = saved.savedAt || new Date().toISOString();
      upsertSavedBranchRunLocal(snapshot);
    } catch (err) {
      if (!options.quiet) status('Saved run locally. Backend save did not complete: ' + (err?.message || err), 'warn');
    }
  }
  if (!options.quiet) status('Saved Devil’s Advocate run: ' + branchRunTitle(snapshot), 'good');
  return snapshot;
}

function mergeSavedRuns(localRuns, backendRuns) {
  const map = new Map();
  [...(backendRuns || []), ...(localRuns || [])].forEach((r) => {
    const snap = r?.snapshot || r;
    const id = snap?.id || snap?.runId || r?.id || r?.saveId;
    if (!id) return;
    map.set(id, { ...(map.get(id) || {}), ...snap, id });
  });
  return Array.from(map.values()).sort((a, b) => String(b.savedAt || b.createdAt || '').localeCompare(String(a.savedAt || a.createdAt || ''))).slice(0, SAVED_BRANCH_RUNS_LIMIT);
}

async function refreshSavedRunsFromBackend() {
  const local = readSavedBranchRunsLocal();
  try {
    const data = await backendGet('/debate/saved-runs?limit=40');
    const merged = mergeSavedRuns(local, data.savedRuns || data.runs || []);
    writeSavedBranchRunsLocal(merged);
    status('Loaded saved Devil’s Advocate runs: local=' + local.length + ', merged=' + merged.length + '.', 'good');
    return merged;
  } catch (err) {
    refreshSavedRunPicker(local);
    status('Showing local saved runs only. Backend saved-run list failed: ' + (err?.message || err), 'warn');
    return local;
  }
}

function refreshSavedRunPicker(runs) {
  const picker = $('branchWorkflowSavedRunPicker');
  if (!picker) return;
  const list = Array.isArray(runs) ? runs : readSavedBranchRunsLocal();
  const prev = picker.value;
  picker.innerHTML = '';
  const empty = D.createElement('option');
  empty.value = '';
  empty.textContent = list.length ? 'Select a saved Devil’s Advocate run…' : 'No saved branch runs yet';
  picker.appendChild(empty);
  list.forEach((r) => {
    const opt = D.createElement('option');
    opt.value = r.id || r.runId || '';
    opt.textContent = branchRunTitle(r);
    picker.appendChild(opt);
  });
  if (prev && list.some((r) => (r.id || r.runId) === prev)) picker.value = prev;
}

function selectedSavedRunSnapshot() {
  const id = $('branchWorkflowSavedRunPicker')?.value || '';
  if (!id) return null;
  return readSavedBranchRunsLocal().find((r) => (r.id || r.runId) === id) || null;
}

function loadSavedBranchRunFromPicker() {
  const snap = selectedSavedRunSnapshot();
  if (!snap) throw new Error('Choose a saved branch run first.');
  lastSelectionData = snap.selectionData || null;
  lastRealRunData = snap.realRunData || null;
  lastCleanerData = snap.cleanerData || null;
  lastInsertionData = snap.insertionData || null;
  lastStructuredEditorData = snap.structuredEditorData || null;
  lastOutcomeData = snap.outcomeData || null;
  if (lastRealRunData) renderRealRun(lastRealRunData);
  else if (lastSelectionData) renderSelection(lastSelectionData);
  if (lastInsertionData) renderInlinePreview('Loaded saved insertion preview', '<details open><summary>Targeted draft</summary><pre>' + esc(lastInsertionData.targetedInsertionDraft || lastInsertionData.insertableLatexDraft || '') + '</pre></details>');
  status('Loaded saved Devil’s Advocate run: ' + branchRunTitle(snap), 'good');
  return snap;
}

async function copyCurrentBranchRunReport() {
  const snap = (lastRealRunData || lastSelectionData || lastInsertionData) ? currentBranchRunSnapshot('copy_report') : selectedSavedRunSnapshot();
  if (!snap) throw new Error('No current or selected saved run available.');
  const report = snap.reportMarkdown || buildBranchRunReport(snap);
  await navigator.clipboard.writeText(report);
  status('Copied complete Devil’s Advocate report to clipboard.', 'good');
}

function exportCurrentBranchRunReport() {
  const snap = (lastRealRunData || lastSelectionData || lastInsertionData) ? currentBranchRunSnapshot('export_report') : selectedSavedRunSnapshot();
  if (!snap) throw new Error('No current or selected saved run available.');
  const report = snap.reportMarkdown || buildBranchRunReport(snap);
  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
  const a = D.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'latexai-devils-advocate-run-' + (snap.runId || snap.id || Date.now()).replace(/[^a-z0-9_.-]+/gi, '-') + '.md';
  D.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  status('Exported complete Devil’s Advocate run report.', 'good');
}

function savedRunsForLearningPayload() {
  return readSavedBranchRunsLocal().slice(0, 40).map((r) => ({
    id: r.id || r.runId,
    savedAt: r.savedAt,
    branchType: r.branchType || r.realRunData?.selectedBranch?.branchType || r.selectionData?.selectedBranch?.branchType,
    selectedBranch: r.realRunData?.selectedBranch || r.selectionData?.selectedBranch || {},
    rewardValue: r.outcomeData?.rewardValue,
    outcomeType: r.outcomeData?.outcomeType,
    insertionMode: r.insertionMode,
    sourceHash: r.sourceHash,
    title: r.title
  }));
}

async function learnedSelectBranch() {
  clearInlinePreview();
  status('Running learned branch selection from saved outcomes and current paper context...', 'warn');
  const body = { ...planPayload(), savedRuns: savedRunsForLearningPayload(), policy: memorySelectionPolicy(), currentRoutes: debateRouteSummaryObject() };
  const data = applySectionScopeToSelection(await backendPost('/debate/select-learned-branch', body));
  lastSelectionData = data;
  renderSelection(data);
  const selected = data?.selectedBranch || {};
  status('Learned selector chose: ' + (selected.title || 'branch') + ' · learned score=' + (selected.learnedSelectionScore || selected.selectionScore || '') + '.', 'good');
  return data;
}

  function memoryIdsForFeedback() {
    const selected = lastSelectionData?.selectedBranch || lastRealRunData?.selectedBranch || selectedRealPayload()?.selectedBranch || {};
    const plan = lastSelectionData?.executionPlan || lastRealRunData?.executionPlan || selectedRealPayload()?.executionPlan || {};
    const ids = [];
    if (Array.isArray(selected.memoryIdsUsed)) ids.push(...selected.memoryIdsUsed);
    if (Array.isArray(selected.memoryIds)) ids.push(...selected.memoryIds);
    if (Array.isArray(plan.memoryIdsToUse)) ids.push(...plan.memoryIdsToUse);
    return Array.from(new Set(ids.filter(Boolean)));
  }

  function outcomePayload(outcome) {
    const insertMode = inputValue('branchWorkflowInsertMode', 'targeted');
    const outcomeType = outcome === 'applied' ? (insertMode === 'append' ? 'inserted_append' : 'inserted_targeted') : outcome;
    return {
      outcomeType,
      insertionMode: insertMode,
      compileStatus: 'not_checked',
      validationStatus: lastInsertionData?.safeToInsert ? 'valid' : 'not_checked',
      workflow: 'latex-paper-debate-real-agent-run',
      latexSource: payloadLatexSourceForAI(),
      latexSourceMode: payloadSourceMode(),
      fullLatexSourceVisibleInPrompt: /whole_truncated|full_source/.test(visibleContextMode()),
      reviewText: inputValue('branchWorkflowReviewText', ''),
      paperSummary: inputValue('branchWorkflowPaperSummary', ''),
      query: inputValue('branchWorkflowQuery', ''),
      memoryIds: memoryIdsForFeedback(),
      selectedBranch: lastSelectionData?.selectedBranch || lastRealRunData?.selectedBranch || selectedRealPayload()?.selectedBranch || {},
      executionPlan: lastSelectionData?.executionPlan || lastRealRunData?.executionPlan || selectedRealPayload()?.executionPlan || {},
      realAgentRunPayload: selectedRealPayload(),
      realAgentRunResult: lastRealRunData || null,
      cleanerResult: lastCleanerData || null,
      insertionPreview: lastInsertionData || null,
      note: inputValue('branchWorkflowOutcomeNote', 'Stage 19N0 main editor marked branch result as ' + outcomeType),
      metadata: { frontendStage: STAGE, activePath: activePath(), safeToInsert: lastInsertionData?.safeToInsert, safeToAutoApply: lastInsertionData?.safeToAutoApply }
    };
  }

  function renderOutcome(data) {
    lastOutcomeData = data;
    renderSummary('Recorded branch outcome',
      '<div class="settings-note"><strong>' + esc(data?.outcomeType) + '</strong> · reward=' + esc(data?.rewardValue) + ' · memoryCount=' + esc(data?.memoryCount) + ' · contextUpdates=' + esc(data?.contextFeedbackUpdateCount) + '</div>' +
      '<pre>' + esc(JSON.stringify({ outcomeId: data?.outcomeId, editOutcomeId: data?.editOutcomeId, rewardEventId: data?.rewardEventId, debateOutcomeId: data?.debateOutcomeId }, null, 2)) + '</pre>'
    );
  }

  async function recordOutcome(outcome) {
    const data = await backendPost('/debate/record-branch-outcome', outcomePayload(outcome));
    renderOutcome(data);
    status('Recorded branch outcome: ' + data.outcomeType + ', reward=' + data.rewardValue + '.', 'good');
    return data;
  }

  async function runFullPreview() {
    try {
      maybeWarnRepeatedHeadings('Pre-run warning');
      await planBranch();
      const runResult = await runSelectedBranch();
      if (!runResult || !lastRealRunData) {
        const msg = 'Prompt/debug run did not produce a backend-recorded real-agent result, so LAI cleaning and insertion preview were skipped. This usually means the real-AI confirmation was canceled, the backend recording call did not complete, or you only wanted to inspect prompts. Use dry_run_no_model_calls for a no-cost recorded dry result, or run selected branch again and allow the run to finish.';
        status(msg, promptDebugEnabled() ? 'warn' : 'bad');
        if (promptDebugEnabled()) {
          publishPromptDebugEvent('run stopped before cleaner', { stepIndex: 0, agentRole: 'workflow', taskType: 'runFullPreview' }, msg, { prompt: msg, provider: 'frontend', model: 'debug', latexSource: payloadLatexSourceForAI(), latexSourceMode: payloadSourceMode(), priorOutputs: [] }, { status: 'no-real-agent-result-cleaner-skipped' });
          return null;
        }
        throw new Error('No real-agent result was recorded.');
      }
      await cleanLastRealRun();
      await prepareInsertion();
      return lastInsertionData || lastCleanerData || lastRealRunData;
    } catch (err) {
      status('Branch workflow failed: ' + (err?.message || err), 'bad');
      throw err;
    }
  }

  function looksLikeCompleteLatexDocument(text) {
    const s = String(text || '');
    return /\\documentclass(?:\s*\[[^\]]*\])?\s*\{[^}]+\}/.test(s) && /\\begin\s*\{document\}/.test(s) && /\\end\s*\{document\}/.test(s);
  }

  function stripAccidentalPreambleFromFragment(text) {
    return String(text || '')
      .replace(/% --- Latexai AI-change highlighting macro ---[\s\S]*?% --- end Latexai AI-change highlighting macro ---\s*/g, '')
      .replace(/^\s*\\usepackage(?:\[[^\]]*\])?\{(?:xcolor|color)\}[^\n]*\n?/gm, '')
      .trim();
  }

  function laiBlocksFromDraftFragment(text) {
    const fragment = stripAccidentalPreambleFromFragment(text);
    const laiBlocks = parseLatexMacroBlocks(fragment, 'lai');
    const oldBlocks = parseLatexMacroBlocks(fragment, 'laiold');
    if (!laiBlocks.length) {
      const plain = fragment.trim();
      if (!plain) return [];
      return ['\\lai{%\n' + plain + '\n}'];
    }
    return laiBlocks.map((lai) => {
      const old = oldBlocks
        .filter((o) => o.end <= lai.start && /^[\s\r\n]*$/.test(fragment.slice(o.end, lai.start)))
        .sort((a, b) => b.end - a.end)[0];
      return old ? (old.raw + lai.raw) : lai.raw;
    }).filter(Boolean);
  }

  function normalizePreviewDraftAgainstCurrentSource(text, kind, beforeSource) {
    const before = String(beforeSource || '');
    let raw = String(text || '');
    if (!raw.trim()) return '';

    // Stage 19N1R5: Some backend/cleaner paths return only the LAI fragment,
    // not a complete .tex document. Older apply logic treated that fragment as
    // the entire source and overwrote main.tex, which moved \usepackage before
    // \documentclass and deleted the body. If the active editor is a complete
    // document and the draft is not, rebuild a complete document locally using
    // the existing multi-section insertion engine.
    if (looksLikeCompleteLatexDocument(before) && !looksLikeCompleteLatexDocument(raw)) {
      const targets = desiredTargetSections(selectedRealPayload() || lastRealRunData || lastSelectionData || {});
      const blocks = laiBlocksFromDraftFragment(raw);
      raw = kind === 'append'
        ? buildAppendDraftFromBlocks(before, blocks, targets)
        : buildTargetedDraftFromBlocks(before, blocks, targets);
    }

    let visualText = normalizeLaiDraftForCompilation(raw, kind);
    visualText = sanitizeLatexChangedRegionForCompile(before, visualText);

    if (looksLikeCompleteLatexDocument(before) && !looksLikeCompleteLatexDocument(visualText)) {
      throw new Error('Blocked unsafe Devil’s Advocate apply: the generated draft is not a complete LaTeX document. Use Preview insertion/Copy report and do not replace main.tex.');
    }
    if (/\\usepackage(?:\[[^\]]*\])?\{[^}]+\}/.test(visualText.slice(0, Math.max(0, visualText.search(/\\documentclass/) >= 0 ? visualText.search(/\\documentclass/) : 0)))) {
      throw new Error('Blocked unsafe Devil’s Advocate apply: a package command would be placed before \\documentclass.');
    }

    // Stage 19N1R7: never silently accept a no-op insertion. If the cleaned
    // draft equals the current paper, or adds no visible \lai/\laiold blocks,
    // build a conservative visible fallback from the final editor/schema text.
    if (looksLikeCompleteLatexDocument(before)) {
      const beforeTrim = before.trim();
      const afterTrim = visualText.trim();
      const beforeBlockCount = countVisibleLaiBlocks(before);
      const afterBlockCount = countVisibleLaiBlocks(visualText);
      const noTextChange = beforeTrim === afterTrim;
      const noNewVisibleEdit = afterBlockCount <= beforeBlockCount && !/\\lai(?:old)?\s*\{/.test(visualText.slice(Math.min(before.length, visualText.length)));
      if (noTextChange || noNewVisibleEdit) {
        const fallback = buildFallbackVisibleLaiDraft(before, noTextChange ? 'generated draft was identical to current source' : 'generated draft had no new visible \lai block');
        if (fallback.trim() !== beforeTrim && countVisibleLaiBlocks(fallback) > beforeBlockCount) {
          visualText = sanitizeLatexChangedRegionForCompile(before, fallback);
        } else {
          throw new Error('Blocked no-op Devil’s Advocate apply: no visible \lai/\laiold edits were produced. Re-run the branch or use Copy report; the source was not changed.');
        }
      }
    }
    return visualText;
  }

  async function applyDraft(kind) {
    if (!lastInsertionData) await prepareInsertion();
    const text = kind === 'append' ? lastInsertionData?.appendOnlyDraft : (lastInsertionData?.targetedInsertionDraft || lastInsertionData?.insertableLatexDraft);
    if (!text) throw new Error('No ' + kind + ' draft available.');
    const beforeSource = getActiveSource();
    const visualText = normalizePreviewDraftAgainstCurrentSource(text, kind, beforeSource);
    if (!W.confirm('Apply the ' + kind + ' LAI draft to the active editor source? A complete-document safety guard will block fragment-only or no-op overwrites.')) return;
    setActiveSource(visualText, 'Applied ' + kind + ' LAI draft with visible red/blue LAI macros. Stage 19N1R7 guarded against fragment-only and no-op source replacement.', { kind });
    await recordOutcome(kind === 'append' ? 'inserted_append' : 'inserted_targeted');
  }

  async function copyDraft(kind) {
    if (!lastInsertionData) await prepareInsertion();
    const text = kind === 'append' ? lastInsertionData?.appendOnlyDraft : (lastInsertionData?.targetedInsertionDraft || lastInsertionData?.insertableLatexDraft);
    if (!text) throw new Error('No ' + kind + ' draft available.');
    const beforeSource = getActiveSource();
    const copiedText = normalizePreviewDraftAgainstCurrentSource(text, kind, beforeSource);
    await navigator.clipboard.writeText(copiedText);
    await recordOutcome('copied');
    status('Copied ' + kind + ' draft and recorded copied outcome. Stage 19N1R7 guarded against fragment-only and no-op source replacement.', 'good');
  }

  function setBusy(on) {
    const card = $('realAgentBranchCard');
    if (card) card.classList.toggle('is-busy', !!on);
    D.querySelectorAll('#realAgentBranchCard button').forEach((b) => { b.disabled = !!on && !/Cancel/i.test(b.textContent || ''); });
  }

  function bindButton(id, fn) {
    const node = $(id);
    if (!node) return;
    node.addEventListener('click', async () => {
      try { setBusy(true); await fn(); }
      catch (err) { status(err?.message || String(err), 'bad'); }
      finally { setBusy(false); }
    }, true);
  }

  function refreshTargetPicker() {
    const picker = $('branchWorkflowTargetPicker');
    const summary = $('branchWorkflowTargetSummary');
    if (!picker) return;
    const prev = new Set(Array.from(picker.selectedOptions || []).map((o) => o.value));
    const units = topLevelSections(getActiveSource());
    picker.innerHTML = '';
    units.forEach((u, idx) => {
      const opt = D.createElement('option');
      opt.value = u.title;
      opt.textContent = String(idx + 1) + '. ' + latexStructureLabel(u);
      opt.dataset.level = u.level || '';
      opt.selected = prev.has(u.title);
      picker.appendChild(opt);
    });
    if (summary) summary.textContent = units.length ? (units.length + ' targetable document unit(s) detected. Hold Cmd/Ctrl or use touch selection to select multiple units.') : 'No section/chapter headings detected yet.';
  }

  function renderTargetModeNote() {
    const node = $('branchWorkflowTargetModeNote');
    if (!node) return;
    const mode = targetSelectorMode();
    const targets = desiredTargetSections(selectedRealPayload() || lastSelectionData || {});
    node.innerHTML = '<strong>Current target mode:</strong> ' + esc(mode) + '<br><strong>Targets:</strong> ' + esc(targets.join(', ') || 'none yet');
  }

  function createCard() {
    if (mounted || $('realAgentBranchCard')) return true;
    const host = $('copilotTab') || D.querySelector('.copilot-panel') || D.querySelector('.right-panel');
    if (!host) return false;
    const card = D.createElement('div');
    card.id = 'realAgentBranchCard';
    card.className = 'devils-debate-card real-agent-branch-card';
    card.innerHTML = [
      '<div class="section-head compact"><div><div class="smallcaps">Paper AI · Stage 19N1R4</div><h2>Devil’s Advocate branch runner</h2></div></div>',
      '<p class="devils-help">Run branch planning → configurable critic/advocate debate rounds → structured actionable LaTeX edits → saved/reloadable run artifacts → insertion preview → outcome reward → learned branch selection. Add ?laiPromptDebug=1 to index.html to open a live prompt-debug tab showing each agent prompt.</p>',
      '<div class="settings-note compact branch-workflow-action-map"><strong>Action labels:</strong> <em>Insert localized edits</em> inserts targeted <code>\\laiold</code>/<code>\\lai</code> edits near relevant sections. <em>Append final improvement plan</em> appends the final plan before <code>\\end{document}</code>. Use <em>Preview insertion</em> first to inspect what will be inserted.</div>',
      '<label class="field">Focus / query <input id="branchWorkflowQuery" type="text" value="novelty theorem assumptions citation coverage clarity limitations" /></label>',
      '<label class="field">Math/equation coverage <select id="branchWorkflowEquationCoverageMode"><option value="auto" selected>auto-detect from focus/query</option><option value="on">force equation-by-equation edits</option><option value="off">off</option></select></label>',
      '<label class="field">Review signal <textarea id="branchWorkflowReviewText" rows="2" placeholder="Reviewer complaint, concern, or improvement goal"></textarea></label>',
      '<label class="field">Paper summary <textarea id="branchWorkflowPaperSummary" rows="2" placeholder="Optional short paper summary"></textarea></label>',
      '<div class="field-grid two">',
      '<label class="field">Run mode <select id="branchWorkflowRunMode"><option value="dry_run_no_model_calls" selected>dry_run_no_model_calls</option><option value="call_ai_proxy_expensive">call_ai_proxy_expensive</option></select></label>',
      '<label class="field">Insertion mode <select id="branchWorkflowInsertMode"><option value="targeted" selected>targeted section insertion</option><option value="append">append at end</option></select></label>',
      '</div>',
      '<div class="field-grid two">',
      '<label class="field">Target mode <select id="branchWorkflowSectionScope"><option value="branch">selected branch target only</option><option value="selected">user-selected sections/subsections</option><option value="salient" selected>salient sections</option><option value="first6">first 6 detected units</option><option value="whole">whole paper: every detected unit</option></select></label>',
      '<div id="branchWorkflowTargetModeNote" class="settings-note compact">Choose target sections/chapters/subsections. Whole paper requires the editor to return an edit or <code>\lai{no edits recommended}</code> marker for every detected unit.</div>',
      '</div>',
      '<label class="field">Detected target sections / chapters / subsections <select id="branchWorkflowTargetPicker" multiple size="7" class="branch-target-picker"></select></label>',
      '<div class="micro-actions stretch devils-actions compact"><button id="branchWorkflowRefreshTargetsBtn" class="btn mini" type="button">Refresh detected targets</button><button id="branchWorkflowCleanPreviousAiBtn" class="btn mini warn" type="button">Clean previous AI suggestions</button><span id="branchWorkflowTargetSummary" class="settings-note compact">Target list not loaded yet.</span></div>',
      '<div class="field-grid two">',
      '<label class="field">Visible prompt context <select id="branchWorkflowVisibleContextMode"><option value="outline_selected_excerpts" selected>outline + selected excerpts</option><option value="selected_excerpts_only">selected excerpts only</option><option value="whole_truncated_selected_focus">whole paper truncated + selected focus</option><option value="full_source_if_safe">full paper visible if within budget</option></select></label>',
      '<label class="field">AI payload full source <select id="branchWorkflowPayloadSourceMode"><option value="include_full_source" selected>include full latexSource in payload</option><option value="include_truncated_source">include truncated latexSource in payload</option><option value="omit_full_source">omit latexSource from AI payload</option></select></label>',
      '</div>',
      '<div class="field-grid two">',
      '<label class="field">Debate rounds <input id="branchWorkflowDebateRounds" type="number" min="1" max="5" step="1" value="1" /></label>',
      '<div class="settings-note compact">Each round runs <strong>critic → advocate</strong>. Round 2+ prompts include the prior debate transcript, reviewer setup, and all earlier critic/advocate outputs.</div>',
      '</div>',
      '<div id="branchWorkflowRouteSummary" class="settings-note compact">Provider/model is inherited from Settings → Model/provider routing → Devil’s advocate rows.</div>',
      '<div class="field-grid two">',
      '<label class="field">Target section override <input id="branchWorkflowTargetSection" type="text" placeholder="optional, e.g. Introduction" /></label>',
      '<label class="field">Outcome note <input id="branchWorkflowOutcomeNote" type="text" placeholder="optional note for reward feedback" /></label>',
      '</div>',
      '<div class="branch-workflow-saved-runs settings-card-subtle">',
      '<label class="field">Saved Devil\'s Advocate runs <select id="branchWorkflowSavedRunPicker"><option value="">No saved branch runs loaded yet</option></select></label>',
      '<div class="micro-actions stretch devils-actions compact"><button id="branchWorkflowVerifySetupBtn" class="btn mini primary" type="button">Verify setup</button><button id="branchWorkflowRefreshSavedBtn" class="btn mini" type="button">Refresh saved</button><button id="branchWorkflowLoadSavedBtn" class="btn mini" type="button">Load saved</button><button id="branchWorkflowSaveCurrentBtn" class="btn mini" type="button">Save current</button><button id="branchWorkflowCopyReportBtn" class="btn mini" type="button">Copy report</button><button id="branchWorkflowExportReportBtn" class="btn mini" type="button">Export report</button><button id="branchWorkflowSaveReviewsBtn" class="btn mini" type="button">Save /reviews artifact</button></div>',
      '<div class="settings-note compact">Saved runs include transcript, selected branch, provider/model trace, structured edits, insertion preview, and outcome reward. They feed the learned branch selector.</div>',
      '</div>',
      '<div class="micro-actions stretch devils-actions">',
      '<button id="branchWorkflowPlanBtn" class="btn mini" type="button">Plan branch</button>',
      '<button id="branchWorkflowLearnedSelectBtn" class="btn mini" type="button">Learned select</button>',
      '<button id="branchWorkflowRunBtn" class="btn mini primary" type="button">Run selected branch</button>',
      '<button id="branchWorkflowFullBtn" class="btn mini" type="button">Run full preview</button>',
      '<button id="branchWorkflowCleanBtn" class="btn mini" type="button">Clean LAI</button>',
      '<button id="branchWorkflowPreviewBtn" class="btn mini" type="button">Preview insertion</button>',
      '<button id="branchWorkflowApplyTargetedBtn" class="btn mini primary" type="button">Insert localized edits</button>',
      '<button id="branchWorkflowApplyAppendBtn" class="btn mini" type="button">Append final improvement plan</button><button id="branchWorkflowCompileCheckBtn" class="btn mini" type="button">Compile after edit</button>',
      '<button id="branchWorkflowCopyTargetedBtn" class="btn mini" type="button">Copy localized edits</button>',
      '<button id="branchWorkflowRejectBtn" class="btn mini" type="button">Reject result</button>',
      '</div>',
      '<div id="branchWorkflowPreviewDock" class="branch-workflow-preview-dock" aria-live="polite"></div>',
      '<div id="branchWorkflowStatus" class="settings-note branch-workflow-status">Stage 19N1R7 ready. Preview insertion, then use Insert localized edits or Append final improvement plan. Saved runs and learned branch selection remain available. Provider/model is inherited from Settings → Model/provider routing.</div>',
      '<div id="branchWorkflowOutput" class="devils-output active branch-workflow-output" aria-live="polite"><div class="branch-workflow-summary-title">Latest branch workflow output</div><div class="settings-note compact">After you run or load a branch, the report, agent transcript, structured edit schema, and LaTeX insertion draft will appear here.</div></div>'
    ].join('\n');
    const before = $('copilotOutput');
    if (before && before.parentNode === host) host.insertBefore(card, before);
    else host.appendChild(card);
    mounted = true;
    if (promptDebugEnabled()) {
      const st = $('branchWorkflowStatus');
      if (st) st.textContent = 'Stage 19N1R prompt debug mode is ON. When you click Run selected branch or Run full preview, a new prompt-debug tab will open and show each agent prompt as it is called.';
    }
    bindButton('branchWorkflowVerifySetupBtn', verifyDevilsAdvocateSetup);
    bindButton('branchWorkflowPlanBtn', planBranch);
    bindButton('branchWorkflowLearnedSelectBtn', learnedSelectBranch);
    bindButton('branchWorkflowRunBtn', runSelectedBranch);
    bindButton('branchWorkflowFullBtn', runFullPreview);
    bindButton('branchWorkflowCleanBtn', cleanLastRealRun);
    bindButton('branchWorkflowPreviewBtn', prepareInsertion);
    bindButton('branchWorkflowApplyTargetedBtn', () => applyDraft('targeted'));
    bindButton('branchWorkflowApplyAppendBtn', () => applyDraft('append'));
    bindButton('branchWorkflowCopyTargetedBtn', () => copyDraft('targeted'));
    bindButton('branchWorkflowRejectBtn', () => recordOutcome('rejected'));
    bindButton('branchWorkflowRefreshSavedBtn', refreshSavedRunsFromBackend);
    bindButton('branchWorkflowLoadSavedBtn', loadSavedBranchRunFromPicker);
    bindButton('branchWorkflowSaveCurrentBtn', () => saveCurrentBranchRun('manual_save'));
    bindButton('branchWorkflowCopyReportBtn', copyCurrentBranchRunReport);
    bindButton('branchWorkflowExportReportBtn', exportCurrentBranchRunReport);
    bindButton('branchWorkflowSaveReviewsBtn', saveCurrentReportToReviews);
    bindButton('branchWorkflowCompileCheckBtn', compileAfterInsertionCheck);
    bindButton('branchWorkflowRefreshTargetsBtn', async () => { refreshTargetPicker(); renderTargetModeNote(); status('Detected target list refreshed.', 'good'); maybeWarnRepeatedHeadings('Target refresh warning'); });
    bindButton('branchWorkflowCleanPreviousAiBtn', cleanPreviousAiSuggestions);
    ['branchWorkflowSectionScope','branchWorkflowTargetPicker','branchWorkflowVisibleContextMode','branchWorkflowPayloadSourceMode'].forEach((id) => { const n = $(id); if (n) n.addEventListener('change', () => { renderTargetModeNote(); }, true); });
    if (D.documentElement.dataset.stage19n1rBranchRouteSummaryBound !== 'true') {
      D.documentElement.dataset.stage19n1rBranchRouteSummaryBound = 'true';
      D.addEventListener('change', (ev) => { if (ev.target?.matches?.('[data-route-provider],[data-route-model]')) refreshBranchRouteSummary(); }, true);
      D.addEventListener('latexai:model-registry-updated', refreshBranchRouteSummary, { passive: true });
    }
    refreshTargetPicker();
    renderTargetModeNote();
    refreshBranchRouteSummary();
    refreshSavedRunPicker();
    return true;
  }

  function init() {
    createCard();
    setTimeout(createCard, 800);
    setTimeout(createCard, 1800);
    setTimeout(() => { try { refreshTargetPicker(); renderTargetModeNote(); refreshBranchRouteSummary(); } catch (_err) {} }, 2400);
  }

  NS.RealAgentBranchWorkflowService = {
    STAGE,
    init,
    planBranch,
    runSelectedBranch,
    extractLatexSections,
    desiredTargetSections,
    refreshTargetPicker,
    visibleContextMode,
    payloadSourceMode,
    cleanLastRealRun,
    prepareInsertion,
    recordOutcome,
    runFullPreview,
    cleanPreviousAiSuggestions,
    removePreviousLaiBlocksFromSource,
    getLastSelection: () => lastSelectionData,
    getLastRealRun: () => lastRealRunData,
    getLastCleaner: () => lastCleanerData,
    getLastInsertion: () => lastInsertionData,
    getLastOutcome: () => lastOutcomeData,
    buildConfigurableDebateSteps,
    buildDebatePrompt,
    configuredDebateRouteForStep,
    debateRouteSummaryObject,
    saveCurrentBranchRun,
    refreshSavedRunsFromBackend,
    loadSavedBranchRunFromPicker,
    buildBranchRunReport,
    learnedSelectBranch
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
