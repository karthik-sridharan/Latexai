/* Latexai Stage 16B CompetitivePaperReviewService
 * Stage: stage16b-competitive-paper-review-1
 *
 * Competitive paper comparison workflow.
 *
 * First version intentionally does not download or parse competitor URLs.
 * The developer/user provides competitor URLs plus optional notes/abstracts.
 * The service asks the configured AI backend for a structured comparison and
 * can save the report under /reviews.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage16b-competitive-paper-review-1';
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
      'Return Markdown with: ranked competitors, current draft position, weaknesses, concrete edits, predicted rank shift, and suggested lai/laiold edits.'
    ].join('\n');
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
        instructions: 'Return a structured Markdown competitive review report. Be critical, concrete, and action-oriented.',
        input,
        temperature: 0.2,
        maxOutputTokens: 7000,
        competitiveReview: {
          targetVenue: payload.targetVenue,
          comparisonModes: payload.comparisonModes,
          competitorUrlCount: payload.competitorUrls.length
        }
      }, {
        task: 'latex-competitive-paper-review',
        context: {
          workflow: 'competitive-paper-review',
          promptFile: PROMPT_PATH,
          targetVenue: payload.targetVenue,
          comparisonModes: payload.comparisonModes
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

  function insertRoadmapComment() {
    if (!lastReport) {
      setStatus('Run competitive review first.');
      return { ok: false, error: 'No report' };
    }

    const active = activeSource();
    const marker = [
      '',
      '% --- Latexai competitive review roadmap ---',
      ...lastReport.split(/\r?\n/).slice(0, 80).map((line) => `% ${line}`),
      '% --- End Latexai competitive review roadmap ---',
      ''
    ].join('\n');

    const next = `${active.text}\n${marker}`;
    try {
      if (State()?.updateFile) State().updateFile(active.path, next);
      else if (active.file) active.file.text = next;
    } catch (_err) {
      if (active.file) active.file.text = next;
    }

    if (el('sourceEditor')) {
      el('sourceEditor').value = next;
      try { el('sourceEditor').dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    }

    try { NS.Editor?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}

    setStatus('Inserted competitive roadmap as LaTeX comments at the end of the active file.');
    return { ok: true, path: active.path };
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
      '<p class="competitive-review-help">Compare the current draft against competitor paper URLs/notes and generate a concrete improvement roadmap. This first version does not download papers automatically.</p>',
      '<label class="field">Competitor paper URLs',
      '  <textarea id="competitivePaperUrls" rows="4" placeholder="One URL per line, e.g. arXiv/OpenReview/proceedings links"></textarea>',
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
      '  <button id="runCompetitiveReviewBtn" class="btn mini primary" type="button">Run competitive review</button>',
      '  <button id="copyCompetitiveReviewBtn" class="btn mini" type="button">Copy report</button>',
      '  <button id="addCompetitiveReviewBtn" class="btn mini" type="button">Add report to /reviews</button>',
      '  <button id="insertCompetitiveRoadmapBtn" class="btn mini" type="button">Insert roadmap comments</button>',
      '</div>',
      '<div id="competitiveReviewStatus" class="settings-note">Competitive review ready.</div>',
      '<pre id="competitiveReviewOutput" class="competitive-review-output"></pre>'
    ].join('');

    panel.appendChild(card);

    el('runCompetitiveReviewBtn')?.addEventListener('click', runCompetitiveReview, true);
    el('copyCompetitiveReviewBtn')?.addEventListener('click', copyReport, true);
    el('addCompetitiveReviewBtn')?.addEventListener('click', addReportToProject, true);
    el('insertCompetitiveRoadmapBtn')?.addEventListener('click', insertRoadmapComment, true);

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
    runCompetitiveReview,
    addReportToProject,
    insertRoadmapComment,
    getLastReport: () => lastReport,
    getLastPayload: () => lastPayload
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  setTimeout(createCard, 900);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
