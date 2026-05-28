/* Latexai Stage 19N0 RealAgentBranchWorkflowService
 * Stage: stage19n0-main-editor-real-agent-branch-workflow-20260528-1
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
  const STAGE = 'stage19n0b-main-editor-branch-runner-scroll-preview-fix-20260528-1';

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
  function setActiveSource(text, label) {
    const value = String(text ?? '');
    try { state()?.updateActiveText?.(value); } catch (_err) {}
    const editor = $('sourceEditor');
    if (editor) {
      editor.value = value;
      try { editor.dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    }
    try { state()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}
    toast(label || 'LaTeX source updated.');
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

  async function callAiForStep(step, priorOutputs, runPayload) {
    const mode = inputValue('branchWorkflowRunMode', 'dry_run_no_model_calls');
    const dry = mode !== 'call_ai_proxy_expensive';
    const role = step.agentRole || 'agent';
    const prompt = step.promptSeed || ('Execute branch step for ' + role);
    if (dry) {
      const isFinal = /editor|final|synth/i.test(role) && priorOutputs.length > 0;
      return {
        stepIndex: step.stepIndex,
        agentRole: role,
        taskType: step.taskType,
        provider: 'dry-run',
        model: 'dry-run',
        promptSeed: prompt,
        dryRun: true,
        latencyMs: 0,
        outputText: isFinal ? '[DRY RUN] Final visible edit draft for ' + (runPayload?.selectedBranch?.title || 'selected branch') + '.\n\n\\lai{Add the selected branch improvement here after reviewing real agent outputs.}' : '[DRY RUN] ' + role + ' would analyze this branch and pass concise findings to the next agent.'
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
      '<details open><summary>Agent outputs</summary><ol>' + outputs.map((o) => '<li><strong>' + esc(o.agentRole) + '</strong> (' + esc(o.provider) + '/' + esc(o.model) + ')<br><span class="small">' + esc(String(o.outputText || '').slice(0, 800)) + '</span></li>').join('') + '</ol></details>' +
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
    const steps = runPayload.executionPlan.steps;
    const mode = inputValue('branchWorkflowRunMode', 'dry_run_no_model_calls');
    const dry = mode !== 'call_ai_proxy_expensive';
    if (!dry && !W.confirm('This will call the configured AI proxy for ' + steps.length + ' agent steps. Continue?')) return null;
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
      realAgentRunPayload: runPayload,
      executionPlan: runPayload.executionPlan,
      selectedBranch: runPayload.selectedBranch,
      latexSource: getActiveSource(),
      reviewText: inputValue('branchWorkflowReviewText', ''),
      paperSummary: inputValue('branchWorkflowPaperSummary', ''),
      query: inputValue('branchWorkflowQuery', ''),
      agentOutputs: outputs,
      metadata: { frontendStage: STAGE, activePath: activePath() }
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
      metadata: { frontendStage: STAGE, activePath: activePath() }
    };
  }

  function renderInsertion(data) {
    const diff = data?.diffSummary || {};
    const targetedDraft = data?.targetedInsertionDraft || data?.insertableLatexDraft || '';
    const appendDraft = data?.appendOnlyDraft || '';
    const body =
      '<div class="settings-note"><strong>safeToInsert:</strong> ' + esc(data?.safeToInsert) + ' · safeToAutoApply=' + esc(data?.safeToAutoApply) + ' · blocks=' + esc(data?.blockCount || 0) + '</div>' +
      '<div class="settings-note">Target: ' + esc(diff.targetSection || data?.targetSection || 'append/end') + ' · mode: ' + esc(data?.insertionMode || '') + '</div>' +
      (Array.isArray(data?.warnings) && data.warnings.length ? '<div class="settings-note warn">Warnings: ' + esc(data.warnings.join('; ')) + '</div>' : '') +
      '<details open><summary>Targeted insertion draft</summary><pre>' + esc(targetedDraft) + '</pre></details>' +
      '<details><summary>Append-only draft</summary><pre>' + esc(appendDraft) + '</pre></details>';
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
    if (!W.confirm('Replace the active editor source with the ' + kind + ' LAI draft?')) return;
    setActiveSource(text, 'Applied ' + kind + ' LAI draft.');
    await recordOutcome(kind === 'append' ? 'inserted_append' : 'inserted_targeted');
  }

  async function copyDraft(kind) {
    if (!lastInsertionData) await prepareInsertion();
    const text = kind === 'append' ? lastInsertionData?.appendOnlyDraft : (lastInsertionData?.targetedInsertionDraft || lastInsertionData?.insertableLatexDraft);
    if (!text) throw new Error('No ' + kind + ' draft available.');
    await navigator.clipboard.writeText(text);
    await recordOutcome('copied');
    status('Copied ' + kind + ' draft and recorded copied outcome.', 'good');
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
      '<div class="section-head compact"><div><div class="smallcaps">Paper AI · Stage 19N0</div><h2>Devil’s Advocate branch runner</h2></div></div>',
      '<p class="devils-help">Run the verified branch planning → real-agent → clean LAI → insertion preview → reward feedback workflow using the active editor source.</p>',
      '<label class="field">Focus / query <input id="branchWorkflowQuery" type="text" value="novelty theorem assumptions citation coverage clarity limitations" /></label>',
      '<label class="field">Review signal <textarea id="branchWorkflowReviewText" rows="2" placeholder="Reviewer complaint, concern, or improvement goal"></textarea></label>',
      '<label class="field">Paper summary <textarea id="branchWorkflowPaperSummary" rows="2" placeholder="Optional short paper summary"></textarea></label>',
      '<div class="field-grid two">',
      '<label class="field">Run mode <select id="branchWorkflowRunMode"><option value="dry_run_no_model_calls" selected>dry_run_no_model_calls</option><option value="call_ai_proxy_expensive">call_ai_proxy_expensive</option></select></label>',
      '<label class="field">Insertion mode <select id="branchWorkflowInsertMode"><option value="targeted" selected>targeted section insertion</option><option value="append">append at end</option></select></label>',
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
      '<div id="branchWorkflowStatus" class="settings-note branch-workflow-status">Stage 19N0b ready. Dry run is selected by default.</div>',
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
    getLastOutcome: () => lastOutcomeData
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
