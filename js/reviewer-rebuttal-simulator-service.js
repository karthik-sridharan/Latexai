/* Latexai Stage 18Q ReviewerRebuttalSimulatorService
 * Stage: stage18q2-reviewer-rebuttal-feature-registry-fix-20260523-1
 *
 * Foundation workflow:
 * - user chooses 2-4 configurable reviewers;
 * - each reviewer reviews all major aspects through their chosen style/expertise;
 * - user adds rebuttal guidance;
 * - AI generates a rebuttal;
 * - AI synthesizes a final revision plan / final paper rewrite proposal.
 *
 * No memory UI. No automatic source overwrite.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage18q2-reviewer-rebuttal-feature-registry-fix-20260523-1';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('reviewer-rebuttal-simulator-service')) {
    NS.ReviewerRebuttalSimulatorService = { STAGE, disabledBySafeMode: true, init: () => false };
    return;
  }

  let lastPayload = null;
  let lastReviews = [];
  let lastRebuttal = '';
  let lastSynthesis = '';
  let cancelled = false;

  function State() { return NS.State; }
  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function normalizePath(path) {
    try { return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    catch (_err) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
  }

  function project() { return State()?.state?.project || {}; }
  function files() { return project().files || []; }
  function fileText(file) { return String(file?.text ?? file?.content ?? file?.source ?? file?.value ?? ''); }
  function getFile(path) {
    const normalized = normalizePath(path);
    try { const found = State()?.getFile?.(normalized); if (found) return found; } catch (_err) {}
    return files().find((file) => normalizePath(file.path) === normalized) || null;
  }
  function rootPath() {
    const p = project();
    return normalizePath(p.rootFile || files().find((file) => /main\.tex$/i.test(file.path || ''))?.path || 'main.tex');
  }
  function activePath() {
    const candidates = [State()?.state?.activePath, State()?.state?.activeFilePath, State()?.state?.currentPath, project()?.activePath, project()?.activeFilePath, rootPath()];
    return normalizePath(candidates.find(Boolean) || 'main.tex');
  }
  function activeSource() {
    let path = activePath();
    let file = getFile(path);
    if (!file) { path = rootPath(); file = getFile(path); }
    return { path, text: fileText(file) };
  }
  function draftExcerpt(text, maxChars = 55000) {
    const s = String(text || '');
    if (s.length <= maxChars) return s;
    const head = s.slice(0, Math.floor(maxChars * 0.68));
    const tail = s.slice(-Math.floor(maxChars * 0.32));
    return `${head}\n\n% ... [middle omitted for reviewer/rebuttal simulator prompt] ...\n\n${tail}`;
  }

  function currentProviderModel() {
    return { provider: clean(el('aiProvider')?.value || 'openai'), model: clean(el('aiModel')?.value || 'gpt-4.1-mini') };
  }

  function setStatus(message) { const node = el('reviewerRebuttalStatus'); if (node) node.textContent = message; }
  function setOutput(text) { const node = el('reviewerRebuttalOutput'); if (node) node.textContent = text || ''; }

  async function askAI(instructions, input, maxOutputTokens = 5000, temperature = 0.25, task = 'latexai-reviewer-rebuttal-simulator') {
    if (!NS.AIProvider?.ask) throw new Error('AIProvider is not loaded. Check feature flags and safe mode.');
    const pm = currentProviderModel();
    const response = await NS.AIProvider.ask({
      instructions,
      input,
      provider: pm.provider,
      model: pm.model,
      maxOutputTokens,
      temperature,
      stage: STAGE
    }, {
      task,
      routeKey: 'paper-review-rebuttal',
      provider: pm.provider,
      model: pm.model,
      context: { workflow: 'reviewer-rebuttal-simulator', stage: STAGE }
    });
    return NS.AIProvider.extractText ? NS.AIProvider.extractText(response) : String(response || '');
  }

  function reviewerDefaults() {
    return [
      { name: 'Reviewer 1', style: 'Very critical mathematical/theoretical reviewer; checks correctness, assumptions, theorem statements, proof gaps, and novelty.' },
      { name: 'Reviewer 2', style: 'Broad ML/AI reviewer; checks novelty, positioning, clarity, related work, and significance.' },
      { name: 'Reviewer 3', style: 'Empirical/reproducibility reviewer; checks experiments, baselines, evaluation claims, and missing ablations.' },
      { name: 'Reviewer 4', style: 'Writing and venue-fit reviewer; checks narrative, readability, contribution framing, and acceptance risks.' }
    ];
  }

  function syncReviewerRows() {
    const count = Math.max(2, Math.min(4, Number(el('reviewerSimCount')?.value || 3)));
    const holder = el('reviewerSimRows');
    if (!holder) return;
    const defaults = reviewerDefaults();
    const existing = [];
    for (let i = 0; i < 4; i += 1) {
      existing.push({ name: clean(el(`reviewerSimName${i}`)?.value), style: clean(el(`reviewerSimStyle${i}`)?.value) });
    }
    holder.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
      const row = D.createElement('div');
      row.className = 'devils-agent-row reviewer-sim-row';
      row.innerHTML = [
        `<div class="devils-agent-title">Reviewer ${i + 1}</div>`,
        `<label>Name <input id="reviewerSimName${i}" type="text" value="${escapeHtml(existing[i]?.name || defaults[i].name)}" /></label>`,
        `<label>Reviewer style / expertise <textarea id="reviewerSimStyle${i}" rows="3">${escapeHtml(existing[i]?.style || defaults[i].style)}</textarea></label>`
      ].join('');
      holder.appendChild(row);
    }
  }

  function selectedReviewers() {
    const count = Math.max(2, Math.min(4, Number(el('reviewerSimCount')?.value || 3)));
    const defaults = reviewerDefaults();
    return Array.from({ length: count }, (_, i) => ({
      index: i + 1,
      name: clean(el(`reviewerSimName${i}`)?.value) || defaults[i].name,
      style: clean(el(`reviewerSimStyle${i}`)?.value) || defaults[i].style
    }));
  }

  function buildPayload() {
    const active = activeSource();
    return {
      schema: 'latexai-reviewer-rebuttal-simulator-request-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      activePath: active.path,
      rootPath: rootPath(),
      targetVenue: clean(el('reviewerSimVenue')?.value),
      paperGoal: clean(el('reviewerSimGoal')?.value),
      globalInstructions: clean(el('reviewerSimInstructions')?.value),
      rebuttalGuidance: clean(el('reviewerSimRebuttalGuidance')?.value),
      reviewers: selectedReviewers(),
      draftExcerpt: draftExcerpt(active.text)
    };
  }

  function validatePayload(payload) {
    const errors = [];
    if (!payload.draftExcerpt.trim()) errors.push('Active source file is empty.');
    if (payload.reviewers.length < 2 || payload.reviewers.length > 4) errors.push('Choose between 2 and 4 reviewers.');
    return errors;
  }

  function reviewsMarkdown() {
    const lines = [];
    for (const item of lastReviews || []) {
      lines.push(`## ${item.name}`);
      lines.push('');
      lines.push(item.text || '');
      lines.push('');
    }
    return lines.join('\n');
  }

  function fullReport() {
    const payload = lastPayload || buildPayload();
    return [
      '# Reviewer / rebuttal simulator',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Stage: ${STAGE}`,
      `Active file: ${payload.activePath}`,
      `Target venue: ${payload.targetVenue || '(not specified)'}`,
      `Paper goal: ${payload.paperGoal || '(not specified)'}`,
      '',
      '## Reviewers',
      '',
      ...(payload.reviewers || []).map((r) => `- ${r.name}: ${r.style}`),
      '',
      '## Reviews',
      '',
      reviewsMarkdown() || '(not generated yet)',
      '',
      '## User rebuttal guidance',
      '',
      clean(el('reviewerSimRebuttalGuidance')?.value) || payload.rebuttalGuidance || '(none)',
      '',
      '## AI rebuttal',
      '',
      lastRebuttal || '(not generated yet)',
      '',
      '## Final synthesis / revision proposal',
      '',
      lastSynthesis || '(not generated yet)'
    ].join('\n');
  }

  async function runReviews() {
    cancelled = false;
    lastReviews = [];
    lastRebuttal = '';
    lastSynthesis = '';
    const payload = buildPayload();
    const errors = validatePayload(payload);
    if (errors.length) { setStatus(errors.join(' ')); setOutput(`Cannot run reviews:\n\n${errors.map((e) => `- ${e}`).join('\n')}`); return { ok: false, errors }; }
    lastPayload = payload;
    setOutput(fullReport());

    try {
      for (const reviewer of payload.reviewers) {
        if (cancelled) throw new Error('Review simulation cancelled.');
        setStatus(`${reviewer.name} is reviewing the paper...`);
        const instructions = [
          'You are an AI reviewer in a simulated academic review panel for a LaTeX research paper.',
          'You must review all key dimensions: correctness, clarity, novelty, significance, related work, assumptions, experiments/evidence, presentation, and venue fit.',
          `Reviewer identity/style: ${reviewer.name}: ${reviewer.style}`,
          'Be specific and actionable. Refer to sections/theorems/equations when possible.',
          'Use a realistic academic-review structure: summary, strengths, weaknesses, questions for authors, required changes, minor issues, score/confidence.',
          'Do not produce a rebuttal. Do not rewrite the paper yet.',
          payload.globalInstructions ? `Extra global instructions: ${payload.globalInstructions}` : ''
        ].filter(Boolean).join('\n');
        const input = [
          '--- Paper metadata ---',
          JSON.stringify({ targetVenue: payload.targetVenue, paperGoal: payload.paperGoal, activePath: payload.activePath }, null, 2),
          '',
          '--- Draft excerpt ---',
          payload.draftExcerpt
        ].join('\n');
        const text = await askAI(instructions, input, 4500, 0.3, 'latexai-simulated-reviewer');
        lastReviews.push({ ...reviewer, text: text.trim() });
        setOutput(fullReport());
      }
      setStatus('Reviewer simulation complete. Add rebuttal guidance, then generate rebuttal.');
      return { ok: true, reviews: lastReviews, payload };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Reviewer simulation stopped: ${message}`);
      setOutput(fullReport());
      return { ok: false, error: message, reviews: lastReviews, payload };
    }
  }

  async function generateRebuttal() {
    const payload = lastPayload || buildPayload();
    if (!lastReviews.length) await runReviews();
    if (!lastReviews.length) return { ok: false, error: 'No reviews available.' };
    payload.rebuttalGuidance = clean(el('reviewerSimRebuttalGuidance')?.value);
    lastPayload = payload;
    setStatus('Generating AI rebuttal to simulated reviews...');
    const instructions = [
      'You are generating an author rebuttal to a set of simulated paper reviews.',
      'Be respectful, precise, and strategic. Defend the paper where appropriate, concede real weaknesses, and propose concrete revisions.',
      'Use the user rebuttal guidance when present, but do not make unsupported claims.',
      'Structure the rebuttal by major concern and by reviewer when useful.',
      'Include explicit commitments for paper revisions.'
    ].join('\n');
    const input = [
      '--- Paper metadata ---', JSON.stringify({ targetVenue: payload.targetVenue, paperGoal: payload.paperGoal }, null, 2), '',
      '--- User rebuttal guidance ---', payload.rebuttalGuidance || '(none)', '',
      '--- Reviews ---', reviewsMarkdown(), '',
      '--- Draft excerpt ---', payload.draftExcerpt
    ].join('\n');
    try {
      lastRebuttal = (await askAI(instructions, input, 5000, 0.2, 'latexai-review-rebuttal')).trim();
      setOutput(fullReport());
      setStatus('AI rebuttal complete.');
      return { ok: true, rebuttal: lastRebuttal };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Rebuttal failed: ${message}`);
      setOutput(fullReport());
      return { ok: false, error: message };
    }
  }

  async function synthesizeFinalRevision() {
    const payload = lastPayload || buildPayload();
    if (!lastReviews.length) await runReviews();
    if (!lastRebuttal) await generateRebuttal();
    setStatus('Synthesizing final revision plan and paper rewrite proposal...');
    const instructions = [
      'You are the final synthesis agent for a paper revision workflow.',
      'Use the simulated reviews, user guidance, and AI rebuttal to propose the strongest final revision.',
      'Return Markdown with: executive summary, accepted reviewer points, rejected/defended points, prioritized revision plan, and final revised-paper strategy.',
      'Also include a fenced code block labelled latexai_actionable_edits containing JSON:',
      '{"actionableEdits":[{"mode":"replace|insert_after|insert_before","path":"optional tex path","targetHint":"section/paragraph hint","oldText":"exact source substring or anchor","newText":"LaTeX replacement or insertion","confidence":0.0}],"appendPlan":"optional LaTeX plan"}.',
      'Use visible Latexai edit semantics: newText should be compatible with later \laiold/\lai insertion. Do not overwrite the entire source unless explicitly necessary.',
      'Avoid preamble edits, Markdown inside LaTeX, and invented exact oldText strings.'
    ].join('\n');
    const input = [
      '--- Paper metadata ---', JSON.stringify({ targetVenue: payload.targetVenue, paperGoal: payload.paperGoal, activePath: payload.activePath }, null, 2), '',
      '--- Reviews ---', reviewsMarkdown(), '',
      '--- User rebuttal guidance ---', clean(el('reviewerSimRebuttalGuidance')?.value) || '(none)', '',
      '--- AI rebuttal ---', lastRebuttal || '(none)', '',
      '--- Draft excerpt ---', payload.draftExcerpt
    ].join('\n');
    try {
      lastSynthesis = (await askAI(instructions, input, 6500, 0.2, 'latexai-final-review-synthesis')).trim();
      setOutput(fullReport());
      setStatus('Final synthesis complete.');
      return { ok: true, synthesis: lastSynthesis };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Final synthesis failed: ${message}`);
      setOutput(fullReport());
      return { ok: false, error: message };
    }
  }

  async function runFullLoop() {
    await runReviews();
    if (cancelled) return;
    await generateRebuttal();
    if (cancelled) return;
    await synthesizeFinalRevision();
  }

  function cancelLoop() { cancelled = true; setStatus('Cancel requested. Current AI call may finish before stopping.'); }

  async function copyReport() {
    const text = fullReport();
    try { await navigator.clipboard.writeText(text); setStatus('Reviewer/rebuttal report copied.'); }
    catch (_err) { setOutput(text); setStatus('Could not copy automatically; report is shown below.'); }
  }

  function createCard() {
    const panel = el('copilotTab') || el('settingsTab') || D.querySelector('.right-panel');
    if (!panel || el('reviewerRebuttalCard')) return false;
    const card = D.createElement('div');
    card.id = 'reviewerRebuttalCard';
    card.className = 'devils-debate-card reviewer-rebuttal-card';
    card.innerHTML = [
      '<div class="section-head compact"><div><div class="smallcaps">Paper AI</div><h2>Reviewer / rebuttal simulator</h2></div></div>',
      '<p class="devils-help">Simulate 2–4 configurable reviewers, write a rebuttal with your guidance, then synthesize a final revision plan.</p>',
      '<div class="field-grid two">',
      '  <label class="field">Reviewer count <select id="reviewerSimCount"><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option></select></label>',
      '  <label class="field">Target venue <input id="reviewerSimVenue" type="text" placeholder="e.g. NeurIPS, COLT, JMLR" /></label>',
      '</div>',
      '<label class="field">Paper goal / intended contribution <input id="reviewerSimGoal" type="text" placeholder="Optional: what the paper is trying to establish" /></label>',
      '<label class="field">Global review instructions <textarea id="reviewerSimInstructions" rows="2" placeholder="Optional: ask reviewers to be very critical, focus on theory, compare to a venue, etc."></textarea></label>',
      '<div id="reviewerSimRows" class="devils-agent-grid"></div>',
      '<label class="field">Your rebuttal guidance after reading reviews <textarea id="reviewerSimRebuttalGuidance" rows="3" placeholder="Optional: tell the rebuttal agent what to concede, defend, emphasize, or promise to revise."></textarea></label>',
      '<div class="devils-actions">',
      '  <button id="runReviewerSimBtn" class="btn mini primary" type="button">Run reviews</button>',
      '  <button id="generateReviewerRebuttalBtn" class="btn mini" type="button">Generate rebuttal</button>',
      '  <button id="synthesizeReviewerFinalBtn" class="btn mini" type="button">Synthesize final revision</button>',
      '  <button id="runReviewerFullLoopBtn" class="btn mini" type="button">Run full loop</button>',
      '  <button id="cancelReviewerSimBtn" class="btn mini" type="button">Cancel</button>',
      '  <button id="copyReviewerSimBtn" class="btn mini" type="button">Copy report</button>',
      '</div>',
      '<div class="settings-note">Stage 18Q is a foundation workflow. It produces reviews, rebuttal, and a final revision proposal; it does not overwrite source.</div>',
      '<div id="reviewerRebuttalStatus" class="settings-note">Reviewer/rebuttal simulator ready.</div>',
      '<pre id="reviewerRebuttalOutput" class="devils-output"></pre>'
    ].join('');
    panel.appendChild(card);
    syncReviewerRows();
    el('reviewerSimCount')?.addEventListener('change', syncReviewerRows, true);
    el('runReviewerSimBtn')?.addEventListener('click', runReviews, true);
    el('generateReviewerRebuttalBtn')?.addEventListener('click', generateRebuttal, true);
    el('synthesizeReviewerFinalBtn')?.addEventListener('click', synthesizeFinalRevision, true);
    el('runReviewerFullLoopBtn')?.addEventListener('click', runFullLoop, true);
    el('cancelReviewerSimBtn')?.addEventListener('click', cancelLoop, true);
    el('copyReviewerSimBtn')?.addEventListener('click', copyReport, true);
    return true;
  }

  function init() { createCard(); }

  NS.ReviewerRebuttalSimulatorService = {
    STAGE,
    init,
    runReviews,
    generateRebuttal,
    synthesizeFinalRevision,
    runFullLoop,
    cancelLoop,
    buildPayload,
    getLastReviews: () => lastReviews,
    getLastRebuttal: () => lastRebuttal,
    getLastSynthesis: () => lastSynthesis,
    getLastPayload: () => lastPayload
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  setTimeout(createCard, 1000);
  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
