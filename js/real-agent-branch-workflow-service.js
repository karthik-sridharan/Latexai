/* Latexai Stage 19N1 RealAgentBranchWorkflowService
 * Stage: stage19n1-configurable-debate-rounds-20260528-1
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
  const STAGE = 'stage19n1-configurable-debate-rounds-20260528-1';

  let lastSelectionData = null;
  let lastRealRunData = null;
  let lastCleanerData = null;
  let lastInsertionData = null;
  let lastOutcomeData = null;
  let mounted = false;

  function $(id) { return D.getElementById(id); }
  function clean(v) { return String(v == null ? '' : v).trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function getStored(key, fallback = '') { try { return W.localStorage?.getItem?.(key) || fallback; } catch (_err) { return fallback; } }
  function setStored(key, value) { try { W.localStorage?.setItem?.(key, String(value ?? '')); } catch (_err) {} }

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
    return /\\lai(?:old)?\s*\{/.test(String(text || ''));
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

  function planPayload() {
    const latexSource = getActiveSource();
    const query = inputValue('branchWorkflowQuery', 'novelty theorem assumptions citation coverage clarity limitations');
    const reviewText = inputValue('branchWorkflowReviewText', query);
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
      metadata: { frontendStage: STAGE, activePath: activePath(), source: 'main-editor' }
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
    node.innerHTML = '<div class="branch-workflow-summary-title">' + esc(title) + '</div>' + html;
    try { node.dataset.branchWorkflowLastTitle = String(title || ''); } catch (_err) {}
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

  function baseBranchPromptContext(step, runPayload) {
    const branch = runPayload?.selectedBranch || {};
    const plan = runPayload?.executionPlan || {};
    const memoryIds = Array.from(new Set([...(branch.memoryIdsUsed || []), ...(plan.memoryIdsToUse || [])].filter(Boolean)));
    return [
      'Branch title: ' + (branch.title || 'selected branch'),
      'Branch type: ' + (branch.branchType || ''),
      'Target sections: ' + ((branch.targetSections || plan.targetSections || []).join(', ') || 'none'),
      'Rationale: ' + (branch.rationale || ''),
      'Latex edit hint: ' + (branch.latexEditHint || ''),
      'Memory ids to use: ' + (memoryIds.join(', ') || 'none'),
      '',
      'Paper summary:',
      inputValue('branchWorkflowPaperSummary', 'Current Latexai editor source.'),
      '',
      'Review/report signal:',
      inputValue('branchWorkflowReviewText', inputValue('branchWorkflowQuery', '')),
      '',
      'Relevant LaTeX excerpt:',
      getActiveSource().slice(0, 12000)
    ].join('\n');
  }

  function buildDebatePrompt(step, priorOutputs, runPayload) {
    const role = String(step?.agentRole || 'agent');
    const round = Number(step?.debateRound || 0);
    const base = baseBranchPromptContext(step, runPayload);
    const transcript = transcriptText(priorOutputs);
    const totalRounds = debateRoundCount();
    const previousInstruction = priorOutputs?.length
      ? 'You MUST use the prior debate transcript below. Do not restart from scratch; respond to the strongest unresolved points, concessions, and proposed edits from previous turns.'
      : 'This is the first substantive debate turn. Establish the strongest position for your role.';

    if (/citation-reviewer|reviewer/.test(role) && !/critic|advocate/.test(role)) {
      return [
        'You are the citation/reviewer setup agent for a Latexai Devil\'s Advocate branch run.',
        base,
        '',
        'Task: identify the concrete citation, related-work, novelty, assumption, or clarity weaknesses that the critic/advocate debate should focus on.',
        'Return concise analysis and concrete search/BibTeX targets when relevant. Do not produce final edits unless they are clearly marked as candidate \\lai blocks.'
      ].join('\n');
    }

    if (/critic/.test(role)) {
      return [
        'You are the CRITIC agent in a multi-round Latexai Devil\'s Advocate debate.',
        'Debate round: ' + (round || 1) + ' of ' + totalRounds + '.',
        base,
        '',
        'Prior debate transcript:',
        transcript,
        '',
        previousInstruction,
        round > 1
          ? 'Round-' + round + ' critic task: attack the advocate\'s previous defense, identify what remains unproven or weak, sharpen failure modes, and point to specific places where the paper still needs visible \\lai edits. Avoid merely repeating round 1.'
          : 'Round-1 critic task: make the strongest critique of this branch issue. Identify concrete weaknesses, missing assumptions/citations, or places where reviewers would object.',
        'Return concise but actionable critique. Use bullet points. Do not write the final paper edit yet.'
      ].join('\n');
    }

    if (/advocate|defender|for/.test(role)) {
      return [
        'You are the ADVOCATE / FOR-THE-PAPER agent in a multi-round Latexai Devil\'s Advocate debate.',
        'Debate round: ' + (round || 1) + ' of ' + totalRounds + '.',
        base,
        '',
        'Prior debate transcript:',
        transcript,
        '',
        previousInstruction,
        round > 1
          ? 'Round-' + round + ' advocate task: respond directly to the latest critic points. Defend what is defensible, concede what should be fixed, and propose precise revisions that preserve the paper\'s strongest claims.'
          : 'Round-1 advocate task: defend the current draft where reasonable, identify the best interpretation of its contribution, and propose minimal edits that address the critique without overstating claims.',
        'Return a concise defense plus a list of concrete revision directions. Do not write the final paper edit yet.'
      ].join('\n');
    }

    if (/synthesizer/.test(role)) {
      return [
        'You are the SYNTHESIZER agent after a multi-round Latexai Devil\'s Advocate debate.',
        'Total completed debate rounds: ' + totalRounds + '.',
        base,
        '',
        'Full prior debate transcript:',
        transcript,
        '',
        'Task: synthesize the strongest critic and advocate points into a balanced improvement plan. Separate: (1) must-fix issues, (2) defensible claims, (3) edits to make now, (4) points needing human/citation verification.',
        'Prepare the editor agent to produce visible \\lai edits. Do not invent citations; mark uncertain citations as search/BibTeX targets.'
      ].join('\n');
    }

    if (/editor|final/.test(role)) {
      return [
        'You are the EDITOR agent. Produce the final actionable LaTeX edits after a multi-round Latexai Devil\'s Advocate debate.',
        'Total completed debate rounds: ' + totalRounds + '.',
        base,
        '',
        'Full prior debate transcript:',
        transcript,
        '',
        'Task: produce visible LaTeX edit blocks using \\lai{...}. Use \\laiold{...} only when you are explicitly replacing existing text. For pure additions, use only \\lai{...}.',
        'Do not put final edits after \\end{document}. Do not invent citations; use placeholder/search-target notes for unverified references. Avoid unescaped author-list ampersands; write \\& in text.'
      ].join('\n');
    }

    return [step?.promptSeed || ('Execute branch step for ' + role), '', 'Prior debate transcript:', transcript].join('\n');
  }

  function findTemplateStep(steps, roleRegex, fallbackRole) {
    const found = (Array.isArray(steps) ? steps : []).find((s) => roleRegex.test(String(s.agentRole || '')));
    return found || { agentRole: fallbackRole, taskType: 'execute ' + fallbackRole + ' debate step', expectedOutput: 'analysis' };
  }

  function buildConfigurableDebateSteps(runPayload) {
    const planSteps = runPayload?.executionPlan?.steps || [];
    const rounds = debateRoundCount();
    const out = [];
    const branchType = runPayload?.selectedBranch?.branchType || 'branch';
    const targetSections = runPayload?.executionPlan?.targetSections || runPayload?.selectedBranch?.targetSections || [];
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
    const prompt = buildDebatePrompt(step, priorOutputs, runPayload);
    if (dry) {
      const isFinal = /editor|final|synth/i.test(role) && priorOutputs.length > 0;
      return {
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
        outputText: isFinal ? '[DRY RUN] Final visible edit draft after ' + debateRoundCount() + ' debate round(s) for ' + (runPayload?.selectedBranch?.title || 'selected branch') + '.\n\n\\lai{Add the selected branch improvement here after reviewing real agent outputs.}' : '[DRY RUN] ' + role + (step.debateRound ? ' round ' + step.debateRound : '') + ' would analyze this branch using the prior transcript and pass concise findings to the next agent.'
      };
    }

    if (!NS.AIProvider?.ask) throw new Error('AIProvider is not loaded.');
    const provider = inputValue('branchWorkflowProvider', $('aiProvider')?.value || 'openai');
    const model = inputValue('branchWorkflowModel', $('aiModel')?.value || 'gpt-4.1-mini');
    const start = Date.now();
    const raw = await NS.AIProvider.ask({
      prompt,
      provider,
      model,
      branch: runPayload?.selectedBranch,
      executionPlan: runPayload?.executionPlan,
      priorOutputs,
      latexSource: getActiveSource(),
      reviewText: inputValue('branchWorkflowReviewText', ''),
      paperSummary: inputValue('branchWorkflowPaperSummary', '')
    }, {
      task: 'latex-paper-debate-real-agent-branch-run',
      provider,
      model,
      context: { workflow: 'latex-paper-debate-real-agent-run', agentRole: role, stage: STAGE }
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
      outputText: NS.AIProvider.extractText ? NS.AIProvider.extractText(raw) : extractAiText(raw),
      rawResponse: raw
    };
  }

  async function planBranch() {
    clearInlinePreview();
    setStored('latexai:memory-backend-url', ($('memoryBackendUrl')?.value || '').trim() || getStored('latexai:memory-backend-url', ''));
    status('Planning selected branch with backend policy/value/rollout/selector...', 'warn');
    const data = await backendPost('/debate/select-branch', planPayload());
    lastSelectionData = data;
    renderSelection(data);
    status('Selected branch: ' + (data?.selectedBranch?.title || 'ready') + '. No LLM call was made.', 'good');
    return data;
  }

  function renderRealRun(data) {
    const outputs = Array.isArray(data?.agentOutputs) ? data.agentOutputs : [];
    const finalText = data?.finalOutput || outputs[outputs.length - 1]?.outputText || '';
    const blocks = Array.isArray(data?.insertableLaiBlocks) ? data.insertableLaiBlocks : (Array.isArray(data?.visibleLaiBlocks) ? data.visibleLaiBlocks : []);
    renderSummary('Real-agent branch result',
      '<div class="settings-note"><strong>Run:</strong> ' + esc(data?.runId || '') + ' · dryRun=' + esc(data?.dryRun) + ' · outputs=' + esc(outputs.length) + '</div>' +
      '<details open><summary>Agent outputs</summary><ol>' + outputs.map((o) => '<li><strong>' + esc(o.agentRole) + (o.debateRound ? ' r' + esc(o.debateRound) : '') + '</strong> (' + esc(o.provider) + '/' + esc(o.model) + ')<br><span class="small">' + esc(String(o.outputText || '').slice(0, 800)) + '</span></li>').join('') + '</ol></details>' +
      (blocks.length ? '<details open><summary>Visible \\lai candidates</summary><pre>' + esc(blocks.join('\n\n')) + '</pre></details>' : '') +
      '<details><summary>Final output</summary><pre>' + esc(finalText) + '</pre></details>'
    );
  }

  async function runSelectedBranch() {
    let runPayload = selectedRealPayload();
    if (!runPayload) {
      await planBranch();
      runPayload = selectedRealPayload();
    }
    if (!runPayload?.executionPlan?.steps?.length) throw new Error('No selected execution plan available.');
    const steps = buildConfigurableDebateSteps(runPayload);
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
      provider: inputValue('branchWorkflowProvider', $('aiProvider')?.value || 'openai'),
      model: inputValue('branchWorkflowModel', $('aiModel')?.value || 'gpt-4.1-mini'),
      realAgentRunPayload: { ...runPayload, executionPlan: { ...(runPayload.executionPlan || {}), steps, debateRoundCount: debateRoundCount(), debateMode: 'critic-advocate-rounds' }, debateRoundCount: debateRoundCount(), debateMode: 'critic-advocate-rounds' },
      executionPlan: { ...(runPayload.executionPlan || {}), steps, debateRoundCount: debateRoundCount(), debateMode: 'critic-advocate-rounds' },
      selectedBranch: runPayload.selectedBranch,
      latexSource: getActiveSource(),
      reviewText: inputValue('branchWorkflowReviewText', ''),
      paperSummary: inputValue('branchWorkflowPaperSummary', ''),
      query: inputValue('branchWorkflowQuery', ''),
      agentOutputs: outputs,
      metadata: { frontendStage: STAGE, activePath: activePath(), debateRoundCount: debateRoundCount(), debateMode: 'critic-advocate-rounds' }
    };
    const data = await backendPost('/debate/run-real-agent-branch', body);
    lastRealRunData = data;
    lastCleanerData = data.laiValidation || null;
    renderRealRun(data);
    status((dry ? 'Dry run' : 'Real-agent run') + ' completed and recorded.', 'good');
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
    if (!lastRealRunData) throw new Error('No real-agent result yet.');
    status('Cleaning and validating real-agent \\lai output...', 'warn');
    const data = await backendPost('/debate/clean-real-agent-output', lastRealRunData);
    lastCleanerData = data;
    renderCleaner(data);
    status('Cleaner validated ' + (data.validBlockCount || 0) + ' block(s), insertable=' + (data.insertableBlockCount || 0) + '.', 'good');
    return data;
  }

  function insertionPayload() {
    const selected = lastSelectionData?.selectedBranch || lastRealRunData?.selectedBranch || selectedRealPayload()?.selectedBranch || {};
    const executionPlan = lastSelectionData?.executionPlan || lastRealRunData?.executionPlan || selectedRealPayload()?.executionPlan || {};
    return {
      latexSource: getActiveSource(),
      targetSectionOverride: inputValue('branchWorkflowTargetSection', ''),
      insertionMode: inputValue('branchWorkflowInsertMode', 'targeted'),
      selectedBranch: selected,
      executionPlan,
      realAgentRunResult: lastRealRunData || null,
      cleanerResult: lastCleanerData || null,
      cleanedLaiBlocks: lastCleanerData?.insertableLaiBlocks || lastCleanerData?.validVisibleLaiBlocks || lastRealRunData?.insertableLaiBlocks || lastRealRunData?.visibleLaiBlocks || [],
      metadata: { frontendStage: STAGE, activePath: activePath(), debateRoundCount: debateRoundCount(), debateMode: 'critic-advocate-rounds' }
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
      '<div class="settings-note">Target: ' + esc(diff.targetSection || data?.targetSection || 'append/end') + ' · mode: ' + esc(data?.insertionMode || '') + '</div>' +
      '<div class="settings-note warn">The source editor shows raw <code>\\lai</code> markup. The visual preview below shows intended colors; the PDF shows colors after Compile PDF. <code>\\laiold</code> appears only for old/new replacement edits, not for pure inserted additions.</div>' +
      (Array.isArray(data?.warnings) && data.warnings.length ? '<div class="settings-note warn">Warnings: ' + esc(data.warnings.join('; ')) + '</div>' : '') +
      '<details open><summary>Visual colored LAI preview</summary>' + renderLaiColorPreviewHtml(chosenDraft || targetedDraft || appendDraft) + '</details>' +
      '<details open><summary>Targeted insertion draft source</summary><pre>' + esc(targetedDraft) + '</pre></details>' +
      '<details><summary>Append-only draft source</summary><pre>' + esc(appendDraft) + '</pre></details>' +
      (rawAppendDraft && rawAppendDraft !== appendDraft ? '<div class="settings-note good">Append preview was normalized: any \\lai blocks after <code>\\end{document}</code> were moved before <code>\\end{document}</code> so they compile.</div>' : '');
    renderSummary('Preview cleaned LAI insertion', body);
    renderInlinePreview('Insertion preview ready', body);
    revealWorkflowPreview();
  }

  async function prepareInsertion() {
    if (!lastCleanerData && lastRealRunData) await cleanLastRealRun();
    if (!lastCleanerData && !lastRealRunData) throw new Error('Run agents and clean result before previewing insertion.');
    status('Preparing targeted/append insertion preview...', 'warn');
    const data = await backendPost('/debate/prepare-lai-insertion', insertionPayload());
    lastInsertionData = data;
    renderInsertion(data);
    status('Prepared insertion preview: blocks=' + (data.blockCount || 0) + ', safe=' + data.safeToInsert + '. Preview is shown in the dock above and in the output box below.', 'good');
    revealWorkflowPreview();
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
      latexSource: getActiveSource(),
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
      await planBranch();
      await runSelectedBranch();
      await cleanLastRealRun();
      await prepareInsertion();
    } catch (err) {
      status('Branch workflow failed: ' + (err?.message || err), 'bad');
      throw err;
    }
  }

  async function applyDraft(kind) {
    if (!lastInsertionData) await prepareInsertion();
    const text = kind === 'append' ? lastInsertionData?.appendOnlyDraft : (lastInsertionData?.targetedInsertionDraft || lastInsertionData?.insertableLatexDraft);
    if (!text) throw new Error('No ' + kind + ' draft available.');
    const beforeSource = getActiveSource();
    let visualText = normalizeLaiDraftForCompilation(text, kind);
    visualText = sanitizeLatexChangedRegionForCompile(beforeSource, visualText);
    if (!W.confirm('Replace the active editor source with the ' + kind + ' LAI draft?')) return;
    setActiveSource(visualText, 'Applied ' + kind + ' LAI draft with visible red/blue LAI macros. Unescaped AI-generated & characters were converted to \& in the inserted region.', { kind });
    await recordOutcome(kind === 'append' ? 'inserted_append' : 'inserted_targeted');
  }

  async function copyDraft(kind) {
    if (!lastInsertionData) await prepareInsertion();
    const text = kind === 'append' ? lastInsertionData?.appendOnlyDraft : (lastInsertionData?.targetedInsertionDraft || lastInsertionData?.insertableLatexDraft);
    if (!text) throw new Error('No ' + kind + ' draft available.');
    const beforeSource = getActiveSource();
    const copiedText = sanitizeLatexChangedRegionForCompile(beforeSource, normalizeLaiDraftForCompilation(text, kind));
    await navigator.clipboard.writeText(copiedText);
    await recordOutcome('copied');
    status('Copied ' + kind + ' draft and recorded copied outcome. AI-generated unescaped & was sanitized to \& in the copied draft.', 'good');
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

  function createCard() {
    if (mounted || $('realAgentBranchCard')) return true;
    const host = $('copilotTab') || D.querySelector('.copilot-panel') || D.querySelector('.right-panel');
    if (!host) return false;
    const card = D.createElement('div');
    card.id = 'realAgentBranchCard';
    card.className = 'devils-debate-card real-agent-branch-card';
    card.innerHTML = [
      '<div class="section-head compact"><div><div class="smallcaps">Paper AI · Stage 19N1</div><h2>Devil’s Advocate branch runner</h2></div></div>',
      '<p class="devils-help">Run branch planning → configurable critic/advocate debate rounds → synthesize/edit → clean LAI → insertion preview → reward feedback using the active editor source.</p>',
      '<label class="field">Focus / query <input id="branchWorkflowQuery" type="text" value="novelty theorem assumptions citation coverage clarity limitations" /></label>',
      '<label class="field">Review signal <textarea id="branchWorkflowReviewText" rows="2" placeholder="Reviewer complaint, concern, or improvement goal"></textarea></label>',
      '<label class="field">Paper summary <textarea id="branchWorkflowPaperSummary" rows="2" placeholder="Optional short paper summary"></textarea></label>',
      '<div class="field-grid two">',
      '<label class="field">Run mode <select id="branchWorkflowRunMode"><option value="dry_run_no_model_calls" selected>dry_run_no_model_calls</option><option value="call_ai_proxy_expensive">call_ai_proxy_expensive</option></select></label>',
      '<label class="field">Insertion mode <select id="branchWorkflowInsertMode"><option value="targeted" selected>targeted section insertion</option><option value="append">append at end</option></select></label>',
      '</div>',
      '<div class="field-grid two">',
      '<label class="field">Debate rounds <input id="branchWorkflowDebateRounds" type="number" min="1" max="5" step="1" value="1" /></label>',
      '<div class="settings-note compact">Each round runs <strong>critic → advocate</strong>. Round 2+ prompts include the prior debate transcript, reviewer setup, and all earlier critic/advocate outputs.</div>',
      '</div>',
      '<div class="field-grid two">',
      '<label class="field">Provider <input id="branchWorkflowProvider" type="text" value="openai" /></label>',
      '<label class="field">Model <input id="branchWorkflowModel" type="text" value="gpt-4.1-mini" /></label>',
      '</div>',
      '<div class="field-grid two">',
      '<label class="field">Target section override <input id="branchWorkflowTargetSection" type="text" placeholder="optional, e.g. Introduction" /></label>',
      '<label class="field">Outcome note <input id="branchWorkflowOutcomeNote" type="text" placeholder="optional note for reward feedback" /></label>',
      '</div>',
      '<div class="micro-actions stretch devils-actions">',
      '<button id="branchWorkflowPlanBtn" class="btn mini" type="button">Plan branch</button>',
      '<button id="branchWorkflowRunBtn" class="btn mini primary" type="button">Run selected branch</button>',
      '<button id="branchWorkflowFullBtn" class="btn mini" type="button">Run full preview</button>',
      '<button id="branchWorkflowCleanBtn" class="btn mini" type="button">Clean LAI</button>',
      '<button id="branchWorkflowPreviewBtn" class="btn mini" type="button">Preview insertion</button>',
      '<button id="branchWorkflowApplyTargetedBtn" class="btn mini" type="button">Apply targeted</button>',
      '<button id="branchWorkflowApplyAppendBtn" class="btn mini" type="button">Apply append</button>',
      '<button id="branchWorkflowCopyTargetedBtn" class="btn mini" type="button">Copy targeted</button>',
      '<button id="branchWorkflowRejectBtn" class="btn mini" type="button">Reject result</button>',
      '</div>',
      '<div id="branchWorkflowPreviewDock" class="branch-workflow-preview-dock" aria-live="polite"></div>',
      '<div id="branchWorkflowStatus" class="settings-note branch-workflow-status">Stage 19N1 ready. Configure debate rounds; round 2+ agents receive the prior debate transcript.</div>',
      '<div id="branchWorkflowOutput" class="devils-output branch-workflow-output">Branch workflow output will appear here.</div>'
    ].join('\n');
    const before = $('copilotOutput');
    if (before && before.parentNode === host) host.insertBefore(card, before);
    else host.appendChild(card);
    mounted = true;
    bindButton('branchWorkflowPlanBtn', planBranch);
    bindButton('branchWorkflowRunBtn', runSelectedBranch);
    bindButton('branchWorkflowFullBtn', runFullPreview);
    bindButton('branchWorkflowCleanBtn', cleanLastRealRun);
    bindButton('branchWorkflowPreviewBtn', prepareInsertion);
    bindButton('branchWorkflowApplyTargetedBtn', () => applyDraft('targeted'));
    bindButton('branchWorkflowApplyAppendBtn', () => applyDraft('append'));
    bindButton('branchWorkflowCopyTargetedBtn', () => copyDraft('targeted'));
    bindButton('branchWorkflowRejectBtn', () => recordOutcome('rejected'));
    return true;
  }

  function init() {
    createCard();
    setTimeout(createCard, 800);
    setTimeout(createCard, 1800);
  }

  NS.RealAgentBranchWorkflowService = {
    STAGE,
    init,
    planBranch,
    runSelectedBranch,
    cleanLastRealRun,
    prepareInsertion,
    recordOutcome,
    runFullPreview,
    getLastSelection: () => lastSelectionData,
    getLastRealRun: () => lastRealRunData,
    getLastCleaner: () => lastCleanerData,
    getLastInsertion: () => lastInsertionData,
    getLastOutcome: () => lastOutcomeData,
    buildConfigurableDebateSteps,
    buildDebatePrompt
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
