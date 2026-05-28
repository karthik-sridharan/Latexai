/* Latexai Stage 19N1D-rev2 RealAgentBranchWorkflowService
 * Stage: stage19n1d-rev2-user-target-context-prompt-files-20260528-1
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
  const STAGE = 'stage19n1d-rev2-user-target-context-prompt-files-20260528-1';

  let lastSelectionData = null;
  let lastRealRunData = null;
  let lastCleanerData = null;
  let lastInsertionData = null;
  let lastOutcomeData = null;
  let mounted = false;
  const PROMPT_TEMPLATE_ROOT = 'prompt/devils-advocate-branch-runner/';
  const promptTemplateCache = {};


  function $(id) { return D.getElementById(id); }
  function clean(v) { return String(v == null ? '' : v).trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function getStored(key, fallback = '') { try { return W.localStorage?.getItem?.(key) || fallback; } catch (_err) { return fallback; } }
  function setStored(key, value) { try { W.localStorage?.setItem?.(key, String(value ?? '')); } catch (_err) {} }


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


  function normalizeSectionTitle(title) {
    return clean(String(title || '').replace(/\\[A-Za-z]+\s*/g, '').replace(/[{}]/g, ' ').replace(/\s+/g, ' '));
  }

  const LATEX_STRUCTURE_LEVELS = ['part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];
  function structureLevelRank(level) {
    const idx = LATEX_STRUCTURE_LEVELS.indexOf(String(level || '').toLowerCase());
    return idx >= 0 ? idx : LATEX_STRUCTURE_LEVELS.length;
  }

  function extractLatexSections(source) {
    const s = String(source || '');
    // Stage 19N1D: parse the document hierarchy broadly so the user can target
    // chapters, sections, subsections, subsubsections, and smaller paragraph-level units.
    const re = /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*\{([^{}]{1,180})\}/g;
    const found = [];
    let m = null;
    while ((m = re.exec(s))) {
      found.push({
        level: m[1],
        levelRank: structureLevelRank(m[1]),
        title: normalizeSectionTitle(m[2]),
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
    // Historical name retained for insertion and outline helpers. In Stage 19N1D it
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

  function payloadLatexSourceForAI() {
    const mode = payloadSourceMode();
    const src = getActiveSource();
    if (mode === 'omit_full_source') return '';
    if (mode === 'include_truncated_source') return truncateMiddle(src, 45000, '... [payload latexSource truncated by Latexai Stage 19N1D] ...');
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

  function buildSectionAwareExcerpt(runPayload) {
    const source = getActiveSource();
    const units = topLevelSections(source);
    const targets = desiredTargetSections(runPayload);
    const outline = units.length ? units.map((s, i) => String(i + 1) + '. ' + latexStructureLabel(s)).join('\n') : '(no LaTeX structural headings detected)';
    const mode = visibleContextMode();
    const contextParts = [];

    contextParts.push('Document section/chapter/subsection outline:\n' + outline);
    contextParts.push('Visible context mode: ' + mode + '.');

    if (mode === 'whole_truncated_selected_focus') {
      contextParts.push('===== WHOLE PAPER CONTEXT (TRUNCATED, VISIBLE TO MODEL) =====\n' + truncateMiddle(source, 38000, '% ... [whole paper middle truncated by Latexai Stage 19N1D] ...'));
    } else if (mode === 'full_source_if_safe') {
      if (source.length <= 65000) {
        contextParts.push('===== FULL PAPER CONTEXT (VISIBLE TO MODEL) =====\n' + source);
      } else {
        contextParts.push('===== WHOLE PAPER CONTEXT (TOO LARGE; TRUNCATED BUT VISIBLE TO MODEL) =====\n' + truncateMiddle(source, 65000, '% ... [full paper truncated by Latexai Stage 19N1D for prompt length] ...'));
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
      data.sectionCoverageOverride = { scope, targetSections: targets, frontendStage: STAGE };
    } catch (_err) {}
    return data;
  }

  function planPayload() {
    const latexSource = getActiveSource();
    const sectionTargets = desiredTargetSections(null);
    const sectionScope = targetSelectorMode();
    const queryBase = inputValue('branchWorkflowQuery', 'novelty theorem assumptions citation coverage clarity limitations');
    const coverageNote = sectionScope === 'branch' ? '' : ('\n\nSection coverage request: evaluate and propose edits across these sections, not only the Introduction: ' + sectionTargets.join(', '));
    const query = queryBase + (sectionScope === 'branch' ? '' : ' multi-section section-aware whole-paper revision');
    const reviewText = inputValue('branchWorkflowReviewText', queryBase) + coverageNote;
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

  async function baseBranchPromptContext(step, runPayload) {
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
      sectionCoverageInstruction: await sectionCoverageInstruction(runPayload),
      paperSummary: inputValue('branchWorkflowPaperSummary', 'Current Latexai editor source.'),
      reviewText: inputValue('branchWorkflowReviewText', inputValue('branchWorkflowQuery', '')),
      visibleContext: buildSectionAwareExcerpt(runPayload),
      stage: STAGE
    });
  }

  async function buildDebatePrompt(step, priorOutputs, runPayload) {
    const role = String(step?.agentRole || 'agent');
    const round = Number(step?.debateRound || 0);
    const baseContext = await baseBranchPromptContext(step, runPayload);
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
      latexSource: payloadLatexSourceForAI(),
      latexSourceMode: payloadSourceMode(),
      fullLatexSourceVisibleInPrompt: /whole_truncated|full_source/.test(visibleContextMode()),
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
    const data = applySectionScopeToSelection(await backendPost('/debate/select-branch', planPayload()));
    lastSelectionData = data;
    renderSelection(data);
    const scopeTargets = desiredTargetSections(data?.realAgentRunPayload || data || {});
    status('Selected branch: ' + (data?.selectedBranch?.title || 'ready') + '. Target sections: ' + (scopeTargets.join(', ') || 'backend default') + '. No LLM call was made.', 'good');
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
      aiPayloadLatexSourceMode: payloadSourceMode(),
      fullLatexSourceVisibleInPrompt: /whole_truncated|full_source/.test(visibleContextMode()),
      reviewText: inputValue('branchWorkflowReviewText', ''),
      paperSummary: inputValue('branchWorkflowPaperSummary', ''),
      query: inputValue('branchWorkflowQuery', ''),
      agentOutputs: outputs,
      metadata: { frontendStage: STAGE, activePath: activePath(), debateRoundCount: debateRoundCount(), debateMode: 'critic-advocate-rounds', visibleContextMode: visibleContextMode(), payloadSourceMode: payloadSourceMode(), targetSections: desiredTargetSections(runPayload) }
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


  function firstExistingSectionTitle(titles, source) {
    const sections = topLevelSections(source);
    for (const t of (titles || [])) {
      const hit = sections.find((sec) => sectionMatches(sec, t));
      if (hit) return hit.title;
    }
    return (sections[0] && sections[0].title) || '';
  }

  function laiBlocksForInsertion() {
    const blocks = [];
    const add = (arr) => { if (Array.isArray(arr)) arr.forEach((x) => { const v = String(x || '').trim(); if (v) blocks.push(v); }); };
    add(lastCleanerData?.insertableLaiBlocks);
    add(lastCleanerData?.validVisibleLaiBlocks);
    if (!blocks.length) add(lastRealRunData?.insertableLaiBlocks);
    if (!blocks.length) add(lastRealRunData?.visibleLaiBlocks);
    if (!blocks.length && lastRealRunData?.finalOutput) {
      const parsed = parseLatexMacroBlocks(lastRealRunData.finalOutput, 'lai').map((b) => b.raw);
      add(parsed);
    }
    return Array.from(new Set(blocks));
  }

  function inferTargetFromLaiBlock(block, fallback) {
    const s = String(block || '');
    const pats = [
      /Target\s+section\s*:\s*([^}\n\\]{2,120})/i,
      /Target\s*:\s*([^}\n\\]{2,120})/i,
      /section\s*[:=]\s*([^}\n\\]{2,120})/i
    ];
    for (const pat of pats) {
      const m = s.match(pat);
      if (m && m[1]) return normalizeSectionTitle(m[1].replace(/[.。]+$/g, ''));
    }
    return normalizeSectionTitle(fallback || '');
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

  function buildTargetedDraftFromBlocks(source, blocks, targets) {
    const s = String(source || '');
    const sections = topLevelSections(s);
    const safeBlocks = (blocks || []).map((b) => String(b || '').trim()).filter(Boolean);
    if (!safeBlocks.length || !sections.length) return buildAppendDraftFromBlocks(s, safeBlocks, targets);
    const groups = new Map();
    safeBlocks.forEach((block, idx) => {
      const fallback = targets && targets.length ? targets[Math.min(idx, targets.length - 1)] : '';
      let target = inferTargetFromLaiBlock(block, fallback);
      if (!target) target = firstExistingSectionTitle(targets, s) || sections[0].title;
      const hit = sections.find((sec) => sectionMatches(sec, target));
      const key = hit ? hit.title : target;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(block);
    });
    let out = s;
    const insertions = [];
    groups.forEach((bs, target) => {
      const sec = sections.find((x) => sectionMatches(x, target));
      const blockText = [
        '',
        '% --- Latexai targeted Devil\'s Advocate suggestion for section: ' + target + ' ---',
        ...bs,
        '% --- end Latexai targeted suggestion ---',
        ''
      ].join('\n');
      if (sec) insertions.push({ index: sec.headerEnd, text: blockText, target });
      else insertions.push({ index: findLastEndDocument(out)?.index ?? out.length, text: blockText, target });
    });
    insertions.sort((a, b) => b.index - a.index).forEach((ins) => { out = out.slice(0, ins.index) + ins.text + out.slice(ins.index); });
    return out;
  }

  function enhanceInsertionDataWithMultiSectionDrafts(data) {
    const source = getActiveSource();
    const targets = desiredTargetSections(selectedRealPayload() || lastRealRunData || lastSelectionData || {});
    const scope = targetSelectorMode();
    if (scope === 'branch' && targets.length <= 1) return data;
    const blocks = laiBlocksForInsertion();
    if (!blocks.length) return data;
    const targeted = normalizeLaiDraftForCompilation(buildTargetedDraftFromBlocks(source, blocks, targets), 'targeted');
    const append = normalizeLaiDraftForCompilation(buildAppendDraftFromBlocks(source, blocks, targets), 'append');
    const blockTargets = blocks.map((b, i) => inferTargetFromLaiBlock(b, targets[Math.min(i, Math.max(0, targets.length - 1))] || '')).filter(Boolean);
    return {
      ...(data || {}),
      targetedInsertionDraft: targeted,
      appendOnlyDraft: append,
      insertableLatexDraft: targeted,
      targetSections: targets,
      blockSectionTargets: blockTargets,
      blockCount: blocks.length,
      multiSectionFrontendInsertion: true,
      warnings: [
        ...((data && Array.isArray(data.warnings)) ? data.warnings : []),
        'Stage 19N1D frontend distributed cleaned \\lai blocks across user-selected/salient/whole-paper targets when labels were available.'
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
    let data = await backendPost('/debate/prepare-lai-insertion', insertionPayload());
    data = enhanceInsertionDataWithMultiSectionDrafts(data);
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
      '<div class="section-head compact"><div><div class="smallcaps">Paper AI · Stage 19N1D</div><h2>Devil’s Advocate branch runner</h2></div></div>',
      '<p class="devils-help">Run branch planning → configurable critic/advocate debate rounds → user-selected/whole-paper/salient targets → context-controlled prompts → clean LAI → insertion preview → reward feedback using the active editor source.</p>',
      '<label class="field">Focus / query <input id="branchWorkflowQuery" type="text" value="novelty theorem assumptions citation coverage clarity limitations" /></label>',
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
      '<div class="micro-actions stretch devils-actions compact"><button id="branchWorkflowRefreshTargetsBtn" class="btn mini" type="button">Refresh detected targets</button><span id="branchWorkflowTargetSummary" class="settings-note compact">Target list not loaded yet.</span></div>',
      '<div class="field-grid two">',
      '<label class="field">Visible prompt context <select id="branchWorkflowVisibleContextMode"><option value="outline_selected_excerpts" selected>outline + selected excerpts</option><option value="selected_excerpts_only">selected excerpts only</option><option value="whole_truncated_selected_focus">whole paper truncated + selected focus</option><option value="full_source_if_safe">full paper visible if within budget</option></select></label>',
      '<label class="field">AI payload full source <select id="branchWorkflowPayloadSourceMode"><option value="include_full_source" selected>include full latexSource in payload</option><option value="include_truncated_source">include truncated latexSource in payload</option><option value="omit_full_source">omit latexSource from AI payload</option></select></label>',
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
      '<div id="branchWorkflowStatus" class="settings-note branch-workflow-status">Stage 19N1D ready. Choose target sections/chapters/subsections or whole paper, then choose visible prompt and AI payload context modes. Final editor must return one \lai block or no-edit marker per target.</div>',
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
    bindButton('branchWorkflowRefreshTargetsBtn', async () => { refreshTargetPicker(); renderTargetModeNote(); status('Detected target list refreshed.', 'good'); });
    ['branchWorkflowSectionScope','branchWorkflowTargetPicker','branchWorkflowVisibleContextMode','branchWorkflowPayloadSourceMode'].forEach((id) => { const n = $(id); if (n) n.addEventListener('change', () => { renderTargetModeNote(); }, true); });
    refreshTargetPicker();
    renderTargetModeNote();
    return true;
  }

  function init() {
    createCard();
    setTimeout(createCard, 800);
    setTimeout(createCard, 1800);
    setTimeout(() => { try { refreshTargetPicker(); renderTargetModeNote(); } catch (_err) {} }, 2400);
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
