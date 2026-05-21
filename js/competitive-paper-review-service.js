/* Latexai Stage 17O CompetitivePaperReviewService
 * Stage: stage17o-lai-review-integration-for-devils-competitive-1
 *
 * Competitive paper comparison workflow.
 *
 * Web-search-required version:
 * - competitor URLs are expected to be opened/searched by the selected AI backend;
 * - the workflow refuses to run unless /api/lumina/ai/status reports web search;
 * - no Latexai PDF downloader/extractor is used.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage17o-lai-review-integration-for-devils-competitive-1';
  const PROMPT_PATH = 'prompt/ai-competitive-paper-review.txt';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('competitive-paper-review-service')) {
    NS.CompetitivePaperReviewService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  let promptCache = '';
  let lastReport = '';
  let lastPayload = null;

  function State() { return NS.State; }
  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }

  function normalizePath(path) {
    try { return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    catch (_err) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
  }

  function project() {
    return State()?.state?.project || {};
  }

  function files() {
    return project().files || [];
  }

  function fileText(file) {
    if (!file) return '';
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function getFile(path) {
    const normalized = normalizePath(path);
    try {
      const found = State()?.getFile?.(normalized);
      if (found) return found;
    } catch (_err) {}
    return files().find((file) => normalizePath(file.path) === normalized) || null;
  }

  function rootPath() {
    const p = project();
    return normalizePath(p.rootFile || files().find((file) => /main\.tex$/i.test(file.path || ''))?.path || 'main.tex');
  }

  function activePath() {
    const candidates = [
      State()?.state?.activePath,
      State()?.state?.activeFilePath,
      State()?.state?.currentPath,
      project()?.activePath,
      project()?.activeFilePath,
      rootPath()
    ];
    for (const candidate of candidates) {
      if (candidate && getFile(candidate)) return normalizePath(candidate);
    }
    const pill = clean(el('activeFilePill')?.textContent);
    return normalizePath(pill || rootPath());
  }

  function activeSource() {
    const path = activePath();
    const editorText = String(el('sourceEditor')?.value || '');
    const file = getFile(path);
    const text = editorText || fileText(file);
    return { path, file, text };
  }

  function writeProjectFile(path, content) {
    const normalized = normalizePath(path);
    try {
      if (State()?.upsertFile) State().upsertFile(normalized, content);
      else if (State()?.updateFile && getFile(normalized)) State().updateFile(normalized, content);
      else {
        const p = project();
        p.files = p.files || [];
        const existing = p.files.find((file) => normalizePath(file.path) === normalized);
        if (existing) existing.text = content;
        else p.files.push({ path: normalized, text: content, kind: 'text' });
      }
    } catch (_err) {
      const p = project();
      p.files = p.files || [];
      const existing = p.files.find((file) => normalizePath(file.path) === normalized);
      if (existing) existing.text = content;
      else p.files.push({ path: normalized, text: content, kind: 'text' });
    }

    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    return normalized;
  }

  function readLines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function parseCompetitorInputs() {
    const urls = readLines(el('competitivePaperUrls')?.value);
    const notesRaw = String(el('competitivePaperNotes')?.value || '');
    const notes = notesRaw.trim();
    return { urls, notes };
  }

  function targetModes() {
    return Array.from(D.querySelectorAll('[data-competitive-mode]:checked')).map((box) => box.dataset.competitiveMode);
  }

  function draftExcerpt(text, maxChars = 45000) {
    const s = String(text || '');
    if (s.length <= maxChars) return s;
    const head = s.slice(0, Math.floor(maxChars * 0.65));
    const tail = s.slice(-Math.floor(maxChars * 0.35));
    return `${head}\n\n% ... [middle omitted for competitive review prompt] ...\n\n${tail}`;
  }

  function promptUrl() {
    const stage = encodeURIComponent(W.LUMINA_LATEX_STAGE || STAGE);
    return `${PROMPT_PATH}?v=${stage}`;
  }

  async function loadPrompt() {
    if (promptCache) return promptCache;
    try {
      const response = await fetch(promptUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      promptCache = text.trim() || fallbackPrompt();
    } catch (_err) {
      promptCache = fallbackPrompt();
    }
    return promptCache;
  }

  function fallbackPrompt() {
    return [
      'You are Latexai Competitive Paper Reviewer.',
      'Rank competitor papers from the supplied URLs/notes, compare the current draft, and produce a concrete improvement roadmap.',
      'Do not claim to have read URLs unless their content is provided in notes.',
      'Return Markdown with: ranked competitors, current draft position, weaknesses, concrete edits, predicted rank shift, and suggested lai/laiold edits.',
      'Also include a fenced latexai_actionable_edits JSON block with exact oldText/newText edits that can be inserted using \\laiold and \\lai.'
    ].join('\n');
  }

  function aiStatusUrl() {
    const raw = clean(el('aiProxyUrl')?.value) || '/api/lumina/ai';
    try {
      const url = new URL(raw, W.location.href);
      if (/\/api\/lumina\/ai\/?$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/?$/, '/status');
        url.search = '';
        return url.href;
      }
      if (/\/api\/lumina\/ai\/status\/?$/i.test(url.pathname)) return url.href;
    } catch (_err) {}
    return raw.replace(/\/api\/lumina\/ai\/?$/i, '/api/lumina/ai/status');
  }

  function currentAiProvider() {
    return clean(el('aiProvider')?.value || 'openai');
  }

  function currentAiModel() {
    return clean(el('aiModel')?.value || '');
  }

  function requireWebSearch() {
    // Stage 16C policy: competitive review must use web-search-capable AI.
    return true;
  }

  function webSearchAvailableFromStatus(status) {
    const provider = currentAiProvider();
    const web = status?.webSearch || status?.capabilities?.webSearch || {};
    if (web.available === true || web.supported === true && web.enabled !== false) {
      if (!web.providers) return true;
    }
    const providerInfo = web.providers?.[provider] || status?.providers?.[provider]?.webSearch || {};
    if (providerInfo === true) return true;
    if (providerInfo?.available === true) return true;
    if (providerInfo?.supported === true && providerInfo?.enabled !== false && providerInfo?.configured !== false) return true;
    return false;
  }

  async function checkWebSearchCapability() {
    const statusNode = el('competitiveWebSearchStatus');
    if (statusNode) statusNode.textContent = 'Checking AI backend web-search capability...';

    try {
      let status;
      if (NS.AIProvider?.getStatus) status = await NS.AIProvider.getStatus();
      else {
        const headers = {};
        const token = clean(el('aiProxyToken')?.value);
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(aiStatusUrl(), { headers, cache: 'no-store' });
        status = await response.json().catch(() => ({}));
        if (!response.ok || status.ok === false) throw new Error(status?.error?.message || `AI status HTTP ${response.status}`);
      }

      const available = webSearchAvailableFromStatus(status);
      const provider = currentAiProvider();
      const model = currentAiModel();
      const message = available
        ? `Web search available for ${provider}${model ? ` / ${model}` : ''}.`
        : `Web search unavailable for ${provider}${model ? ` / ${model}` : ''}. Choose a web-search-capable backend/model.`;

      if (statusNode) {
        statusNode.textContent = message;
        statusNode.classList.toggle('ok', available);
        statusNode.classList.toggle('bad', !available);
      }

      return { ok: available, status, message };
    } catch (err) {
      const message = `Could not verify web search: ${err?.message || err}`;
      if (statusNode) {
        statusNode.textContent = message;
        statusNode.classList.remove('ok');
        statusNode.classList.add('bad');
      }
      return { ok: false, error: message };
    }
  }

  function buildPayload() {
    const active = activeSource();
    const competitors = parseCompetitorInputs();
    const modes = targetModes();
    const venue = clean(el('competitiveTargetVenue')?.value);
    const audience = clean(el('competitiveTargetAudience')?.value);
    const instructions = clean(el('competitiveExtraInstructions')?.value);

    return {
      schema: 'latexai-competitive-paper-review-request-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      activePath: active.path,
      rootPath: rootPath(),
      targetVenue: venue,
      targetAudience: audience,
      comparisonModes: modes.length ? modes : ['overall competitiveness'],
      competitorUrls: competitors.urls,
      competitorNotes: competitors.notes,
      extraInstructions: instructions,
      requireWebSearch: requireWebSearch(),
      webSearchPolicy: {
        required: true,
        provider: currentAiProvider(),
        model: currentAiModel(),
        expectation: 'AI backend must use a web_search tool to inspect/search competitor URLs.'
      },
      draftExcerpt: draftExcerpt(active.text)
    };
  }

  function validatePayload(payload) {
    const errors = [];
    if (!payload.draftExcerpt.trim()) errors.push('Active source file is empty.');
    if (!payload.competitorUrls.length && !payload.competitorNotes.trim()) {
      errors.push('Add at least one competitor URL or competitor note/abstract.');
    }
    return errors;
  }

  async function runCompetitiveReview() {
    if (!NS.AIProvider?.ask) {
      setStatus('AIProvider is not loaded. Check feature flags and safe mode.');
      return { ok: false, error: 'AIProvider missing' };
    }

    const payload = buildPayload();
    const errors = validatePayload(payload);
    if (errors.length) {
      setStatus(errors.join(' '));
      setOutput(`Cannot run competitive review:\n\n${errors.map((e) => `- ${e}`).join('\n')}`);
      return { ok: false, errors };
    }

    if (requireWebSearch()) {
      const capability = await checkWebSearchCapability();
      if (!capability.ok) {
        const message = capability.message || capability.error || 'Choose a web-search-capable AI backend/model.';
        setStatus(message);
        setOutput([
          'Competitive review requires web search.',
          '',
          message,
          '',
          'Use an AI backend that reports webSearch.available=true from /api/lumina/ai/status.'
        ].join('\n'));
        return { ok: false, error: message, capability, payload };
      }
    }

    lastPayload = payload;
    setStatus('Running competitive paper review...');

    const prompt = await loadPrompt();
    const input = [
      prompt,
      '',
      '--- Request JSON ---',
      JSON.stringify(payload, null, 2),
      '',
      '--- Important limitation ---',
      'You only know competitor content from provided URLs, titles, abstracts, notes, or snippets in the request. Do not pretend that you downloaded/read URLs if no content is provided.'
    ].join('\n');

    try {
      const response = await NS.AIProvider.ask({
        instructions: [
          'Return a structured Markdown competitive review report. Be critical, concrete, and action-oriented.',
          'In addition to the prose report, include one fenced code block labelled latexai_actionable_edits.',
          'That block must be JSON with schema {\"actionableEdits\":[{\"mode\":\"replace|insert_after|insert_before\",\"path\":\"optional tex path\",\"targetHint\":\"section or paragraph hint\",\"oldText\":\"exact source substring for replace/anchor\",\"newText\":\"LaTeX replacement or insertion\",\"confidence\":0.0}],\"appendPlan\":\"optional high-level LaTeX plan\"}.',
          'For replace edits, oldText must be copied exactly from the draft excerpt when possible so Latexai can insert \\laiold{oldText} and \\lai{newText} at the right location.',
          'If you cannot localize a suggestion safely, put it in appendPlan rather than inventing an oldText.'
        ].join('\n'),
        input,
        temperature: 0.2,
        maxOutputTokens: 7000,
        webSearchRequired: true,
        requireWebSearch: true,
        requiredTools: ['web_search'],
        competitiveReview: {
          targetVenue: payload.targetVenue,
          comparisonModes: payload.comparisonModes,
          competitorUrlCount: payload.competitorUrls.length,
          requireWebSearch: true,
          webSearchEvidenceRequired: true
        }
      }, {
        task: 'latex-competitive-paper-review',
        context: {
          workflow: 'competitive-paper-review-web-search',
          promptFile: PROMPT_PATH,
          targetVenue: payload.targetVenue,
          comparisonModes: payload.comparisonModes,
          requireWebSearch: true
        }
      });

      const raw = NS.AIProvider.extractText ? NS.AIProvider.extractText(response) : String(response || '');
      lastReport = raw.trim();
      setOutput(lastReport || '(AI returned empty report.)');
      setStatus(lastReport ? 'Competitive review complete.' : 'Competitive review returned an empty report.');
      return { ok: Boolean(lastReport), report: lastReport, payload };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Competitive review failed: ${message}`);
      setOutput(`Competitive review failed:\n\n${message}`);
      return { ok: false, error: message, payload };
    }
  }

  function reportFilename() {
    const date = new Date().toISOString().slice(0, 10);
    const venue = clean(el('competitiveTargetVenue')?.value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const suffix = venue ? `-${venue}` : '';
    return normalizePath(`reviews/competitive-review-${date}${suffix}.md`);
  }

  function addReportToProject() {
    if (!lastReport) {
      setStatus('Run competitive review first.');
      return { ok: false, error: 'No report' };
    }

    const payload = lastPayload || buildPayload();
    const content = [
      '# Competitive paper review',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Stage: ${STAGE}`,
      `Target venue: ${payload.targetVenue || '(not specified)'}`,
      `Target audience: ${payload.targetAudience || '(not specified)'}`,
      `Comparison modes: ${payload.comparisonModes.join(', ')}`,
      '',
      '## Competitor URLs',
      '',
      ...(payload.competitorUrls.length ? payload.competitorUrls.map((url) => `- ${url}`) : ['- (none provided)']),
      '',
      '## Report',
      '',
      lastReport,
      ''
    ].join('\n');

    const path = writeProjectFile(reportFilename(), content);
    setStatus(`Added competitive review to ${path}.`);
    return { ok: true, path };
  }

  function updateProjectSource(path, text) {
    const normalized = normalizePath(path);
    try {
      if (State()?.updateFile) State().updateFile(normalized, text);
      else {
        const file = getFile(normalized);
        if (file) file.text = text;
        else writeProjectFile(normalized, text);
      }
    } catch (_err) {
      const file = getFile(normalized);
      if (file) file.text = text;
      else writeProjectFile(normalized, text);
    }

    if (normalizePath(activePath()) === normalized && el('sourceEditor')) {
      el('sourceEditor').value = text;
      try { el('sourceEditor').dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    }

    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}
  }

  function ensurePackageInPreamble(tex, packageName) {
    const s = String(tex || '');
    const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pkgRe = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{[^}]*\\b${escaped}\\b[^}]*\\}`);
    if (pkgRe.test(s)) return s;
    const line = `\\usepackage{${packageName}}\n`;
    const docIdx = s.indexOf('\\begin{document}');
    if (docIdx >= 0) return s.slice(0, docIdx) + line + s.slice(docIdx);
    const classMatch = s.match(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}\s*/);
    if (classMatch?.index !== undefined) {
      const at = classMatch.index + classMatch[0].length;
      return s.slice(0, at) + '\n' + line + s.slice(at);
    }
    return line + s;
  }

  function hasLaiMacro(tex) {
    const s = String(tex || '');
    return /\\newif\\iflaishowchanges/.test(s) && /\\(?:long\\def|def|newcommand)\s*\\lai\b/.test(s);
  }

  function ensureLaiMacroLocal(rootText) {
    let s = String(rootText || '');
    if (hasLaiMacro(s)) return s;
    s = ensurePackageInPreamble(s, 'xcolor');
    const macro = [
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
      '% --- end Latexai AI-change highlighting macro ---',
      ''
    ].join('\n');
    const docIdx = s.indexOf('\\begin{document}');
    if (docIdx >= 0) return s.slice(0, docIdx) + macro + '\n' + s.slice(docIdx);
    return macro + '\n' + s;
  }

  function ensureLaiOldMacro(rootText) {
    let s = String(rootText || '');
    s = ensurePackageInPreamble(s, 'xcolor');
    if (/\\(?:long\s*)?\\?def\s*\\laiold\b|\\newcommand\s*\{\\laiold\}|\\providecommand\s*\{\\laiold\}/.test(s)) return s;
    const macro = [
      '',
      '% --- Latexai old-content highlighting macro ---',
      '% Old source preserved by actionable AI edits.',
      '\\long\\def\\laiold#1{{\\color{blue}#1}}',
      '% --- end Latexai old-content highlighting macro ---',
      ''
    ].join('\n');
    const laiIdx = s.search(/% --- Latexai AI-change highlighting macro ---|\\long\\def\\lai#1|\\newcommand\s*\{\\lai\}/);
    if (laiIdx >= 0) return s.slice(0, laiIdx) + macro + s.slice(laiIdx);
    const docIdx = s.indexOf('\\begin{document}');
    if (docIdx >= 0) return s.slice(0, docIdx) + macro + s.slice(docIdx);
    return macro + s;
  }

  function ensureRootLaiMacros() {
    const root = getFile(rootPath());
    if (!root) return false;
    let text = fileText(root);
    let next = NS.ProjectModel?.ensureLaiMacro ? NS.ProjectModel.ensureLaiMacro(text) : text;
    next = ensureLaiMacroLocal(next);
    next = ensureLaiOldMacro(next);
    if (next !== text) updateProjectSource(rootPath(), next);
    return true;
  }

  function insertBeforeEndDocument(tex, insertion) {
    const s = String(tex || '');
    const marker = '\\end{document}';
    const at = s.lastIndexOf(marker);
    const block = `\n\n${String(insertion || '').trim()}\n\n`;
    if (at >= 0) return s.slice(0, at).replace(/\s*$/, '') + block + s.slice(at);
    return s.replace(/\s*$/, '') + block;
  }


  function refreshPaperAiReview(paths, source = 'Competitive Review') {
    const normalized = [...new Set((paths || []).map(normalizePath).filter(Boolean))];
    try {
      if (NS.PaperAiPolishService?.scanProject) {
        return NS.PaperAiPolishService.scanProject({ paths: normalized });
      }
      if (normalized[0] && NS.PaperAiPolishService?.scanPath) {
        return NS.PaperAiPolishService.scanPath(normalized[0], { open: false });
      }
      if (NS.PaperAiPolishService?.scan) return NS.PaperAiPolishService.scan();
    } catch (err) {
      try { console.warn('[Latexai] could not refresh paper AI review after competitive insertion', err); } catch (_err) {}
    }
    return null;
  }

  function workflowBlockHeader(id, path, extra = '') {
    return `% BEGIN LAI-ACTIONABLE-EDIT id=${id} workflow=competitive-review path=${path}${extra ? ` ${extra}` : ''}`;
  }

  function workflowBlockFooter(id) {
    return `% END LAI-ACTIONABLE-EDIT id=${id}`;
  }

  function wrapLaiPlanBlock(laiBlock, path) {
    const id = `lai-competitive-plan-${Date.now().toString(36)}`;
    return [workflowBlockHeader(id, normalizePath(path), 'mode=append-plan'), '% LAI target: end-of-paper competitive improvement plan', String(laiBlock || '').trim(), workflowBlockFooter(id)].join('\n');
  }

  function escapeLatexText(value) {
    return String(value || '')
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([#$%&_{}])/g, '\\$1')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }

  function markdownToLaiPlan(markdown, title, maxLines = 140) {
    const lines = String(markdown || '').split(/\r?\n/).slice(0, maxLines);
    const out = ['\\lai{', `\\section*{${escapeLatexText(title)}}`];
    let inItems = false;
    const closeItems = () => { if (inItems) { out.push('\\end{itemize}'); inItems = false; } };
    for (const raw of lines) {
      const line = String(raw || '').trim();
      if (!line) { closeItems(); out.push(''); continue; }
      const heading = line.match(/^#{1,4}\s+(.+)$/);
      if (heading) { closeItems(); out.push(`\\paragraph{${escapeLatexText(heading[1]).replace(/\.$/, '')}.}`); continue; }
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        if (!inItems) { out.push('\\begin{itemize}'); inItems = true; }
        out.push(`\\item ${escapeLatexText(bullet[1])}`);
        continue;
      }
      closeItems();
      out.push(`${escapeLatexText(line)}\\par`);
    }
    closeItems();
    out.push('}');
    return out.join('\n');
  }

  function parseJsonCandidates(text) {
    const s = String(text || '');
    const candidates = [];
    const fenceRe = /```(?:json|latexai_actionable_edits)?\s*([\s\S]*?)```/gi;
    let match;
    while ((match = fenceRe.exec(s))) candidates.push(match[1].trim());
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) candidates.push(s.slice(first, last + 1));
    return candidates;
  }

  function normalizeActionableEdit(edit, index) {
    const modeRaw = clean(edit?.mode || edit?.operation || edit?.type || (edit?.oldText ? 'replace' : 'insert_after')).toLowerCase();
    const mode = /insert[_ -]?before/.test(modeRaw) ? 'insert_before' : /insert[_ -]?after|append/.test(modeRaw) ? 'insert_after' : 'replace';
    const oldText = String(edit?.oldText ?? edit?.old ?? edit?.before ?? edit?.sourceText ?? edit?.anchorText ?? edit?.insertAfter ?? '');
    const newText = String(edit?.newText ?? edit?.new ?? edit?.after ?? edit?.replacement ?? edit?.text ?? edit?.lai ?? '');
    const path = normalizePath(edit?.path || edit?.file || edit?.texPath || activePath());
    const targetHint = String(edit?.targetHint || edit?.location || edit?.section || edit?.reason || `actionable edit ${index + 1}`);
    const confidence = Number(edit?.confidence);
    if (!newText.trim()) return null;
    if (mode === 'replace' && !oldText.trim()) return null;
    if (mode !== 'replace' && !oldText.trim()) return null;
    return { mode, path, oldText, newText, targetHint, confidence: Number.isFinite(confidence) ? confidence : null };
  }

  function extractActionableEdits(text) {
    for (const candidate of parseJsonCandidates(text)) {
      try {
        const data = JSON.parse(candidate);
        const list = Array.isArray(data) ? data : Array.isArray(data?.actionableEdits) ? data.actionableEdits : Array.isArray(data?.edits) ? data.edits : [];
        const edits = list.map(normalizeActionableEdit).filter(Boolean);
        if (edits.length) return { source: 'latexai_actionable_edits_json', edits, appendPlan: String(data?.appendPlan || '') };
      } catch (_err) {}
    }

    const pairs = [];
    const re = /\\laiold\s*\{([\s\S]*?)\}\s*\\lai\s*\{([\s\S]*?)\}/g;
    let match;
    while ((match = re.exec(String(text || '')))) {
      const edit = normalizeActionableEdit({ mode: 'replace', oldText: match[1], newText: match[2], targetHint: 'AI-provided \\laiold/\\lai pair' }, pairs.length);
      if (edit) pairs.push(edit);
    }
    return { source: pairs.length ? 'laiold_lai_pairs' : 'none', edits: pairs, appendPlan: '' };
  }

  function wrapActionableReplacement(edit, index) {
    const id = `lai-competitive-${Date.now().toString(36)}-${index}`;
    const header = workflowBlockHeader(id, edit.path, `mode=${edit.mode}`);
    const hint = edit.targetHint ? `% LAI target: ${edit.targetHint}` : '';
    const footer = workflowBlockFooter(id);
    if (edit.mode === 'replace') {
      return [header, hint, '\\laiold{', String(edit.oldText || '').trim(), '}', '\\lai{', String(edit.newText || '').trim(), '}', footer].filter(Boolean).join('\n');
    }
    return [header, hint, '\\lai{', String(edit.newText || '').trim(), '}', footer].filter(Boolean).join('\n');
  }

  function insertActionableEditsAtMatches() {
    if (!lastReport) {
      setStatus('Run competitive review first.');
      return { ok: false, error: 'No report' };
    }

    ensureRootLaiMacros();
    const parsed = extractActionableEdits(lastReport);
    if (!parsed.edits.length) {
      setStatus('No exact actionable edit JSON or \\laiold/\\lai pairs found. Use Append \\lai plan instead.');
      return { ok: false, applied: 0, skipped: 0, source: parsed.source };
    }

    const queued = new Map();
    const messages = [];
    let skipped = 0;

    parsed.edits.forEach((edit, index) => {
      const path = normalizePath(edit.path || activePath());
      const file = getFile(path);
      if (!file) { skipped += 1; messages.push(`SKIP ${path}: file not found for ${edit.targetHint}.`); return; }
      const text = fileText(file);
      const anchor = String(edit.oldText || '');
      const at = text.indexOf(anchor);
      if (at < 0) { skipped += 1; messages.push(`SKIP ${path}: exact oldText/anchor not found for ${edit.targetHint}.`); return; }
      const replacement = wrapActionableReplacement({ ...edit, path }, index);
      const start = edit.mode === 'insert_before' ? at : at;
      const end = edit.mode === 'replace' ? at + anchor.length : edit.mode === 'insert_after' ? at + anchor.length : at;
      const insert = edit.mode === 'replace' ? replacement : edit.mode === 'insert_after' ? `${anchor}\n\n${replacement}` : `${replacement}\n\n${anchor}`;
      if (!queued.has(path)) queued.set(path, []);
      queued.get(path).push({ start, end, insert, targetHint: edit.targetHint });
    });

    let applied = 0;
    for (const [path, ops] of queued.entries()) {
      const file = getFile(path);
      let text = fileText(file);
      ops.sort((a, b) => b.start - a.start);
      for (const op of ops) {
        text = text.slice(0, op.start) + op.insert + text.slice(op.end);
        applied += 1;
        messages.push(`APPLY ${path}: ${op.targetHint}`);
      }
      updateProjectSource(path, text);
    }

    const modifiedPaths = [...queued.keys()];
    refreshPaperAiReview(modifiedPaths, 'Competitive Review');
    setStatus(`Inserted ${applied} competitive \\lai edit(s) at exact matches; skipped ${skipped}. Paper-level edit review refreshed.`);
    setOutput([lastReport, '', '--- Latexai actionable edit insertion report ---', `Source: ${parsed.source}`, `Applied: ${applied}`, `Skipped: ${skipped}`, ...messages].join('\n'));
    return { ok: applied > 0, applied, skipped, messages, source: parsed.source, paths: [...queued.keys()] };
  }

  function appendLaiImprovementPlan() {
    if (!lastReport) {
      setStatus('Run competitive review first.');
      return { ok: false, error: 'No report' };
    }

    ensureRootLaiMacros();
    const root = getFile(rootPath());
    const active = root ? { path: rootPath(), file: root, text: fileText(root) } : activeSource();
    const parsed = extractActionableEdits(lastReport);
    const planText = parsed.appendPlan && parsed.appendPlan.trim() ? parsed.appendPlan : lastReport;
    const insertion = wrapLaiPlanBlock(markdownToLaiPlan(planText, 'Latexai Competitive Review Improvement Plan'), active.path);
    const next = insertBeforeEndDocument(active.text, insertion);
    updateProjectSource(active.path, next);
    refreshPaperAiReview([active.path], 'Competitive Review');
    setStatus(`Appended competitive improvement plan as visible \\lai markup to ${active.path}. Paper-level edit review refreshed.`);
    return { ok: true, path: active.path, mode: 'append-lai-plan' };
  }

  function insertRoadmapComment() {
    return appendLaiImprovementPlan();
  }

  async function copyReport() {
    const text = lastReport || el('competitiveReviewOutput')?.textContent || '';
    if (!text.trim()) {
      setStatus('No competitive review report to copy.');
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Competitive review copied.');
      return true;
    } catch (_err) {
      setStatus('Could not copy automatically. Select the report text manually.');
      return false;
    }
  }

  function setStatus(message) {
    const node = el('competitiveReviewStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const out = el('competitiveReviewOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = String(text || '');
    }
  }

  function createCard() {
    const panel = el('copilotTab') || el('settingsTab') || D.querySelector('.right-panel');
    if (!panel || el('competitiveReviewCard')) return false;

    const card = D.createElement('div');
    card.id = 'competitiveReviewCard';
    card.className = 'competitive-review-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Paper AI</div>',
      '    <h2>Competitive paper review</h2>',
      '  </div>',
      '</div>',
      '<p class="competitive-review-help">Compare the current draft against competitor paper URLs using a web-search-capable AI backend. Latexai does not download papers itself; the selected AI/backend must report web search support.</p>',
      '<label class="competitive-web-required"><input id="competitiveRequireWebSearch" type="checkbox" checked disabled /> Require web-search-capable AI for this workflow</label>',
      '<div id="competitiveWebSearchStatus" class="competitive-web-status">Web search not checked yet.</div>',
      '<label class="field">Competitor paper URLs',
      '  <textarea id="competitivePaperUrls" rows="4" placeholder="One URL per line. The AI backend must search/open these URLs."></textarea>',
      '</label>',
      '<label class="field">Competitor notes / abstracts / titles',
      '  <textarea id="competitivePaperNotes" rows="5" placeholder="Paste titles, abstracts, claims, strengths, or notes for the competitor papers."></textarea>',
      '</label>',
      '<div class="field-grid two">',
      '  <label class="field">Target venue',
      '    <input id="competitiveTargetVenue" type="text" placeholder="e.g. COLT, NeurIPS, ICML, STOC" />',
      '  </label>',
      '  <label class="field">Target audience',
      '    <input id="competitiveTargetAudience" type="text" placeholder="e.g. ML theory, optimization, algorithms" />',
      '  </label>',
      '</div>',
      '<div class="competitive-mode-box">',
      '  <div class="competitive-mode-title">Comparison mode</div>',
      '  <label><input data-competitive-mode="novelty" type="checkbox" checked /> novelty</label>',
      '  <label><input data-competitive-mode="clarity" type="checkbox" checked /> clarity</label>',
      '  <label><input data-competitive-mode="technical depth" type="checkbox" checked /> technical depth</label>',
      '  <label><input data-competitive-mode="positioning" type="checkbox" checked /> positioning</label>',
      '  <label><input data-competitive-mode="related work" type="checkbox" checked /> related work</label>',
      '  <label><input data-competitive-mode="overall competitiveness" type="checkbox" checked /> overall competitiveness</label>',
      '</div>',
      '<label class="field">Extra instructions',
      '  <textarea id="competitiveExtraInstructions" rows="3" placeholder="Optional: be extremely critical, focus on theorem statement, improve intro, etc."></textarea>',
      '</label>',
      '<div class="competitive-review-actions">',
      '  <button id="checkCompetitiveWebSearchBtn" class="btn mini" type="button">Check web search</button>',
      '  <button id="runCompetitiveReviewBtn" class="btn mini primary" type="button">Run competitive review</button>',
      '  <button id="copyCompetitiveReviewBtn" class="btn mini" type="button">Copy report</button>',
      '  <button id="addCompetitiveReviewBtn" class="btn mini" type="button">Add report to /reviews</button>',
      '  <button id="insertCompetitiveInlineLaiBtn" class="btn mini" type="button">Insert \\lai edits at matches</button>',
      '  <button id="insertCompetitiveRoadmapBtn" class="btn mini" type="button">Append \\lai plan</button>',
      '</div>',
      '<div class="settings-note">Stage 17O writes review artifacts to <code>/reviews</code>, and inserted <code>\\lai</code>/<code>\\laiold</code> blocks are automatically scanned by Paper-level edit review.</div>',
      '<div id="competitiveReviewStatus" class="settings-note">Competitive review ready.</div>',
      '<pre id="competitiveReviewOutput" class="competitive-review-output"></pre>'
    ].join('');

    panel.appendChild(card);

    el('checkCompetitiveWebSearchBtn')?.addEventListener('click', checkWebSearchCapability, true);
    el('runCompetitiveReviewBtn')?.addEventListener('click', runCompetitiveReview, true);
    el('copyCompetitiveReviewBtn')?.addEventListener('click', copyReport, true);
    el('addCompetitiveReviewBtn')?.addEventListener('click', addReportToProject, true);
    el('insertCompetitiveInlineLaiBtn')?.addEventListener('click', insertActionableEditsAtMatches, true);
    el('insertCompetitiveRoadmapBtn')?.addEventListener('click', appendLaiImprovementPlan, true);

    return true;
  }

  function init() {
    createCard();
  }

  NS.CompetitivePaperReviewService = {
    STAGE,
    init,
    buildPayload,
    validatePayload,
    checkWebSearchCapability,
    requireWebSearch,
    runCompetitiveReview,
    addReportToProject,
    insertRoadmapComment,
    appendLaiImprovementPlan,
    insertActionableEditsAtMatches,
    extractActionableEdits,
    getLastReport: () => lastReport,
    getLastPayload: () => lastPayload
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  setTimeout(createCard, 900);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
