/* Latexai Stage 16D DevilsAdvocateDebateService
 * Stage: stage16d-devils-advocate-paper-debate-1
 *
 * Devil's advocate paper debate workflow:
 * - one AI agent argues for the current draft;
 * - one AI agent critiques the current draft;
 * - the user controls the number of back-and-forth rounds;
 * - a final synthesis agent turns the debate into a balanced improvement plan;
 * - each agent can use its own provider/model, with defaults copied from the current AI controls.
 *
 * This workflow calls AI. It does not compile.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage16d-devils-advocate-paper-debate-1';
  const PROMPT_PATH = 'prompt/ai-devils-advocate-debate.txt';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('devils-advocate-debate-service')) {
    NS.DevilsAdvocateDebateService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  let promptCache = '';
  let lastTranscript = null;
  let lastSynthesis = '';
  let lastPayload = null;
  let cancelled = false;

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

  function updateActiveSource(path, text) {
    const normalized = normalizePath(path);
    try {
      if (State()?.updateFile) State().updateFile(normalized, text);
      else {
        const file = getFile(normalized);
        if (file) file.text = text;
      }
    } catch (_err) {
      const file = getFile(normalized);
      if (file) file.text = text;
    }

    const editor = el('sourceEditor');
    if (editor) {
      editor.value = text;
      try { editor.dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    }

    try { NS.Editor?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
  }

  function currentProviderModel() {
    return {
      provider: clean(el('aiProvider')?.value || 'openai'),
      model: clean(el('aiModel')?.value || 'gpt-4.1-mini')
    };
  }

  function setProviderModel(route) {
    const provider = clean(route?.provider);
    const model = clean(route?.model);
    const providerEl = el('aiProvider');
    const modelEl = el('aiModel');

    if (providerEl && provider) {
      providerEl.value = provider;
      try { providerEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
    }

    if (modelEl && model) {
      let option = Array.from(modelEl.options || []).find((opt) => opt.value === model);
      if (!option && modelEl.tagName === 'SELECT') {
        option = D.createElement('option');
        option.value = model;
        option.textContent = model;
        option.dataset.stage16d = 'custom-agent-model';
        modelEl.appendChild(option);
      }
      modelEl.value = model;
      try { modelEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
    }
  }

  async function askAsAgent(agent, payload, meta) {
    if (!NS.AIProvider?.ask) throw new Error('AIProvider is not loaded. Check feature flags and safe mode.');

    const before = currentProviderModel();
    try {
      setProviderModel(agent);
      const response = await NS.AIProvider.ask(payload, {
        task: meta.task || 'latex-paper-debate',
        context: {
          workflow: 'devils-advocate-paper-debate',
          agentRole: agent.role,
          promptFile: PROMPT_PATH,
          ...meta.context
        }
      });
      return NS.AIProvider.extractText ? NS.AIProvider.extractText(response) : String(response || '');
    } finally {
      setProviderModel(before);
    }
  }

  function draftExcerpt(text, maxChars = 45000) {
    const s = String(text || '');
    if (s.length <= maxChars) return s;
    const head = s.slice(0, Math.floor(maxChars * 0.65));
    const tail = s.slice(-Math.floor(maxChars * 0.35));
    return `${head}\n\n% ... [middle omitted for debate prompt] ...\n\n${tail}`;
  }

  function clampRounds(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 2;
    return Math.max(1, Math.min(Math.round(n), 6));
  }

  function agentFromUi(prefix, role) {
    return {
      role,
      provider: clean(el(`${prefix}Provider`)?.value || currentProviderModel().provider),
      model: clean(el(`${prefix}Model`)?.value || currentProviderModel().model)
    };
  }

  function buildPayload() {
    const active = activeSource();
    const rounds = clampRounds(el('debateRounds')?.value);
    const topic = clean(el('debateTopic')?.value) || 'overall paper quality and acceptance chances';
    const venue = clean(el('debateTargetVenue')?.value);
    const audience = clean(el('debateTargetAudience')?.value);
    const instructions = clean(el('debateExtraInstructions')?.value);
    const agents = {
      advocate: agentFromUi('advocateAgent', 'advocate'),
      critic: agentFromUi('criticAgent', 'critic'),
      synthesizer: agentFromUi('synthAgent', 'synthesizer')
    };

    return {
      schema: 'latexai-devils-advocate-debate-request-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      activePath: active.path,
      rootPath: rootPath(),
      rounds,
      topic,
      targetVenue: venue,
      targetAudience: audience,
      extraInstructions: instructions,
      agents,
      draftExcerpt: draftExcerpt(active.text)
    };
  }

  function validatePayload(payload) {
    const errors = [];
    if (!payload.draftExcerpt.trim()) errors.push('Active source file is empty.');
    if (!payload.agents.advocate.model) errors.push('Advocate model is empty.');
    if (!payload.agents.critic.model) errors.push('Critic model is empty.');
    if (!payload.agents.synthesizer.model) errors.push('Synthesizer model is empty.');
    return errors;
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
      "You are running a devil\'s advocate debate about a LaTeX research paper.",
      'Advocate: make the strongest case for the current draft.',
      'Critic: make the strongest critical case against the current draft.',
      'Synthesizer: produce a balanced improvement plan using both sides.',
      'Be concrete, section-specific, and constructive.'
    ].join('\n');
  }

  function transcriptToMarkdown(transcript) {
    const lines = ['# Devil’s advocate debate transcript', ''];
    for (const turn of transcript || []) {
      lines.push(`## Round ${turn.round}: ${turn.role}`);
      lines.push('');
      lines.push(turn.text || '');
      lines.push('');
    }
    return lines.join('\n');
  }

  function currentDebateContext(payload, transcript) {
    return [
      '--- Debate setup ---',
      JSON.stringify({
        topic: payload.topic,
        targetVenue: payload.targetVenue,
        targetAudience: payload.targetAudience,
        extraInstructions: payload.extraInstructions,
        roundCount: payload.rounds
      }, null, 2),
      '',
      '--- Draft excerpt ---',
      payload.draftExcerpt,
      '',
      '--- Transcript so far ---',
      transcriptToMarkdown(transcript)
    ].join('\n');
  }

  async function runDebate() {
    cancelled = false;
    lastSynthesis = '';
    lastTranscript = [];
    const payload = buildPayload();
    const errors = validatePayload(payload);
    if (errors.length) {
      setStatus(errors.join(' '));
      setOutput(`Cannot run debate:\n\n${errors.map((e) => `- ${e}`).join('\n')}`);
      return { ok: false, errors };
    }

    lastPayload = payload;
    const developerPrompt = await loadPrompt();

    setStatus(`Starting ${payload.rounds}-round paper debate...`);
    renderTranscript();

    try {
      for (let round = 1; round <= payload.rounds; round += 1) {
        if (cancelled) throw new Error('Debate cancelled.');

        setStatus(`Round ${round}/${payload.rounds}: advocate is arguing for the draft...`);
        const advocateText = await askAsAgent(payload.agents.advocate, {
          instructions: [
            developerPrompt,
            '',
            'You are the ADVOCATE agent. Argue in favor of the current draft.',
            'Defend novelty, technical value, clarity, positioning, and acceptance chances.',
            'Acknowledge weaknesses only when it strengthens the defense.',
            'Return Markdown. No JSON.'
          ].join('\n'),
          input: currentDebateContext(payload, lastTranscript),
          temperature: 0.35,
          maxOutputTokens: 3500,
          debateAgent: { role: 'advocate', round, totalRounds: payload.rounds }
        }, { task: 'latex-paper-debate-advocate' });

        lastTranscript.push({ round, role: 'advocate', provider: payload.agents.advocate.provider, model: payload.agents.advocate.model, text: advocateText.trim() });
        renderTranscript();

        if (cancelled) throw new Error('Debate cancelled.');

        setStatus(`Round ${round}/${payload.rounds}: critic is challenging the draft...`);
        const criticText = await askAsAgent(payload.agents.critic, {
          instructions: [
            developerPrompt,
            '',
            'You are the CRITIC agent. Act as a very critical reviewer.',
            'Find weaknesses in novelty, correctness, assumptions, related work, clarity, and positioning.',
            'Respond directly to the advocate when useful.',
            'Return Markdown. No JSON.'
          ].join('\n'),
          input: currentDebateContext(payload, lastTranscript),
          temperature: 0.35,
          maxOutputTokens: 3500,
          debateAgent: { role: 'critic', round, totalRounds: payload.rounds }
        }, { task: 'latex-paper-debate-critic' });

        lastTranscript.push({ round, role: 'critic', provider: payload.agents.critic.provider, model: payload.agents.critic.model, text: criticText.trim() });
        renderTranscript();
      }

      if (cancelled) throw new Error('Debate cancelled.');

      setStatus('Synthesizer is producing the balanced improvement plan...');
      lastSynthesis = await askAsAgent(payload.agents.synthesizer, {
        instructions: [
          developerPrompt,
          '',
          'You are the SYNTHESIZER agent.',
          'Use both the advocate and critic arguments to produce a balanced, constructive improvement plan.',
          'Return Markdown with: summary, strongest positives, most serious risks, prioritized edits, citation/related-work fixes, theorem/proof fixes, predicted acceptance impact, and suggested \\laiold{...}\\lai{...} edit blocks.',
          'No JSON.'
        ].join('\n'),
        input: currentDebateContext(payload, lastTranscript),
        temperature: 0.2,
        maxOutputTokens: 5500,
        debateAgent: { role: 'synthesizer', round: 'final', totalRounds: payload.rounds }
      }, { task: 'latex-paper-debate-synthesizer' });

      setOutput(formatFullReport());
      setStatus('Devil’s advocate debate complete.');
      return { ok: true, transcript: lastTranscript, synthesis: lastSynthesis, payload };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Debate stopped: ${message}`);
      setOutput(formatFullReport() || `Debate stopped:\n\n${message}`);
      return { ok: false, error: message, transcript: lastTranscript, synthesis: lastSynthesis, payload };
    }
  }

  function cancelDebate() {
    cancelled = true;
    setStatus('Cancel requested. The current AI call may finish before stopping.');
  }

  function formatFullReport() {
    if (!lastPayload && !lastTranscript?.length && !lastSynthesis) return '';
    const payload = lastPayload || buildPayload();
    return [
      '# Devil’s advocate paper debate',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Stage: ${STAGE}`,
      `Active file: ${payload.activePath}`,
      `Target venue: ${payload.targetVenue || '(not specified)'}`,
      `Target audience: ${payload.targetAudience || '(not specified)'}`,
      `Topic: ${payload.topic}`,
      `Rounds: ${payload.rounds}`,
      '',
      '## Agents',
      '',
      `- Advocate: ${payload.agents.advocate.provider} / ${payload.agents.advocate.model}`,
      `- Critic: ${payload.agents.critic.provider} / ${payload.agents.critic.model}`,
      `- Synthesizer: ${payload.agents.synthesizer.provider} / ${payload.agents.synthesizer.model}`,
      '',
      '## Final synthesis',
      '',
      lastSynthesis || '(not generated yet)',
      '',
      '## Debate transcript',
      '',
      transcriptToMarkdown(lastTranscript)
    ].join('\n');
  }

  function reportFilename() {
    const date = new Date().toISOString().slice(0, 10);
    const venue = clean(el('debateTargetVenue')?.value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const suffix = venue ? `-${venue}` : '';
    return normalizePath(`reviews/devils-advocate-debate-${date}${suffix}.md`);
  }

  function addReportToProject() {
    const report = formatFullReport();
    if (!report.trim()) {
      setStatus('Run a debate first.');
      return { ok: false, error: 'No debate report' };
    }
    const path = writeProjectFile(reportFilename(), report + '\n');
    setStatus(`Added debate report to ${path}.`);
    return { ok: true, path };
  }

  function insertImprovementPlan() {
    if (!lastSynthesis.trim()) {
      setStatus('Run a debate and synthesis first.');
      return { ok: false, error: 'No synthesis' };
    }

    const active = activeSource();
    const marker = [
      '',
      '% --- Latexai devil\'s advocate improvement plan ---',
      ...lastSynthesis.split(/\r?\n/).slice(0, 100).map((line) => `% ${line}`),
      '% --- End Latexai devil\'s advocate improvement plan ---',
      ''
    ].join('\n');

    const next = `${active.text}\n${marker}`;
    updateActiveSource(active.path, next);
    setStatus('Inserted debate improvement plan as LaTeX comments at the end of the active file.');
    return { ok: true, path: active.path };
  }

  async function copyReport() {
    const text = formatFullReport();
    if (!text.trim()) {
      setStatus('No debate report to copy.');
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Debate report copied.');
      return true;
    } catch (_err) {
      setOutput(text);
      setStatus('Could not copy automatically. Report shown below.');
      return false;
    }
  }

  function renderTranscript() {
    setOutput(formatFullReport() || 'Debate started...');
  }

  function setStatus(message) {
    const node = el('devilsDebateStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const out = el('devilsDebateOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = String(text || '');
    }
  }

  function providerOptions(selected) {
    const source = el('aiProvider');
    const values = Array.from(source?.options || []).map((opt) => opt.value).filter(Boolean);
    const fallback = values.length ? values : ['openai', 'anthropic', 'gemini'];
    return fallback.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function agentRow(prefix, title, current) {
    return [
      `<div class="devils-agent-row">`,
      `  <div class="devils-agent-title">${escapeHtml(title)}</div>`,
      '  <label>Provider',
      `    <select id="${prefix}Provider">${providerOptions(current.provider)}</select>`,
      '  </label>',
      '  <label>Model',
      `    <input id="${prefix}Model" type="text" value="${escapeHtml(current.model)}" placeholder="model name" />`,
      '  </label>',
      '</div>'
    ].join('');
  }

  function createCard() {
    const panel = el('copilotTab') || el('settingsTab') || D.querySelector('.right-panel');
    if (!panel || el('devilsDebateCard')) return false;

    const current = currentProviderModel();
    const card = D.createElement('div');
    card.id = 'devilsDebateCard';
    card.className = 'devils-debate-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Paper AI</div>',
      '    <h2>Devil’s advocate paper debate</h2>',
      '  </div>',
      '</div>',
      '<p class="devils-help">Run a structured debate: one AI agent defends the draft, one critiques it, and a final agent synthesizes a balanced improvement plan.</p>',
      '<div class="field-grid two">',
      '  <label class="field">Debate rounds',
      '    <input id="debateRounds" type="number" min="1" max="6" step="1" value="2" />',
      '  </label>',
      '  <label class="field">Target venue',
      '    <input id="debateTargetVenue" type="text" placeholder="e.g. COLT, NeurIPS, ICML" />',
      '  </label>',
      '</div>',
      '<label class="field">Target audience',
      '  <input id="debateTargetAudience" type="text" placeholder="e.g. ML theory, optimization, algorithms" />',
      '</label>',
      '<label class="field">Debate topic',
      '  <input id="debateTopic" type="text" value="overall paper quality and acceptance chances" />',
      '</label>',
      '<label class="field">Extra instructions',
      '  <textarea id="debateExtraInstructions" rows="3" placeholder="Optional: focus on novelty, theorem clarity, proof gaps, experimental claims, related work, etc."></textarea>',
      '</label>',
      '<div class="devils-agent-grid">',
      agentRow('advocateAgent', 'Advocate agent', current),
      agentRow('criticAgent', 'Critic agent', current),
      agentRow('synthAgent', 'Synthesizer agent', current),
      '</div>',
      '<div class="devils-actions">',
      '  <button id="runDevilsDebateBtn" class="btn mini primary" type="button">Run debate</button>',
      '  <button id="cancelDevilsDebateBtn" class="btn mini" type="button">Cancel</button>',
      '  <button id="copyDevilsDebateBtn" class="btn mini" type="button">Copy report</button>',
      '  <button id="addDevilsDebateBtn" class="btn mini" type="button">Add report to /reviews</button>',
      '  <button id="insertDevilsPlanBtn" class="btn mini" type="button">Insert improvement plan</button>',
      '</div>',
      '<div id="devilsDebateStatus" class="settings-note">Devil’s advocate debate ready.</div>',
      '<pre id="devilsDebateOutput" class="devils-output"></pre>'
    ].join('');

    panel.appendChild(card);

    el('runDevilsDebateBtn')?.addEventListener('click', runDebate, true);
    el('cancelDevilsDebateBtn')?.addEventListener('click', cancelDebate, true);
    el('copyDevilsDebateBtn')?.addEventListener('click', copyReport, true);
    el('addDevilsDebateBtn')?.addEventListener('click', addReportToProject, true);
    el('insertDevilsPlanBtn')?.addEventListener('click', insertImprovementPlan, true);

    return true;
  }

  function init() {
    createCard();
  }

  NS.DevilsAdvocateDebateService = {
    STAGE,
    init,
    buildPayload,
    validatePayload,
    runDebate,
    cancelDebate,
    addReportToProject,
    insertImprovementPlan,
    formatFullReport,
    getLastTranscript: () => lastTranscript,
    getLastSynthesis: () => lastSynthesis,
    getLastPayload: () => lastPayload
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  setTimeout(createCard, 950);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
