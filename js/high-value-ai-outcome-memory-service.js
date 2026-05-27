/* Latexai Stage 19I12 HighValueAIOutcomeMemoryService
 * Stage: stage19i12-high-value-ai-outcome-memory-wiring-20260526-1
 *
 * Stage 19I11 records generic AI calls.  This stage records the next critical
 * training signal: whether users actually applied, saved, inserted, accepted,
 * rejected, or resolved the high-value AI result afterward.
 *
 * It is intentionally hidden and UI-neutral.  It uses existing Stage 19G/19H
 * endpoints only: /edit-outcome, /reward, and /debate-trajectory.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19i12-high-value-ai-outcome-memory-wiring-20260526-1';
  const PENDING_KEY = 'latexai:stage19i12:pending-ai-outcome-action';
  const DEFAULT_TTL_MS = 45 * 1000;
  const LONG_TTL_MS = 8 * 60 * 1000;
  const AFTER_MUTATION_TTL_MS = 2200;

  let pendingAction = null;
  let suppressMutationDepth = 0;
  const wrapped = new Set();
  const loggedKeys = [];

  function clean(value) { return String(value || '').trim(); }

  function stableHash(text) {
    let h = 2166136261;
    const s = String(text || '');
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function now() { return Date.now(); }

  function memoryEnabled() {
    try { return W.localStorage?.getItem?.('latexai:memory-enabled') !== 'false'; } catch (_err) { return true; }
  }

  function activeFilePath() {
    try { return NS.State?.getActiveFile?.()?.path || NS.State?.state?.project?.activePath || NS.State?.state?.project?.rootFile || 'main.tex'; }
    catch (_err) { return 'main.tex'; }
  }

  function compileStatus() {
    try {
      const status = NS.State?.state?.compile?.status || NS.State?.state?.compileStatus || '';
      return clean(status);
    } catch (_err) { return ''; }
  }

  function currentAiRun(maxAgeMs = 12 * 60 * 1000) {
    try {
      const fromSvc = NS.AIWorkflowMemoryService?.getLastAgentRun?.(maxAgeMs);
      if (fromSvc) return fromSvc;
    } catch (_err) {}
    try {
      const parsed = JSON.parse(W.sessionStorage?.getItem?.('latexai:stage19i12:last-generic-agent-run') || W.sessionStorage?.getItem?.('latexai:stage19i11:last-generic-agent-run') || 'null');
      if (!parsed || !parsed.at || now() - parsed.at > maxAgeMs) return null;
      return parsed;
    } catch (_err) { return null; }
  }

  function normalizeIds(value) {
    const ids = [];
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') ids.push(item);
        else if (item?.memoryId) ids.push(String(item.memoryId));
        else if (item?.id) ids.push(String(item.id));
      });
    }
    return Array.from(new Set(ids.filter(Boolean)));
  }

  function rememberPending(action) {
    pendingAction = action || null;
    try {
      if (pendingAction) W.sessionStorage?.setItem?.(PENDING_KEY, JSON.stringify(pendingAction));
      else W.sessionStorage?.removeItem?.(PENDING_KEY);
    } catch (_err) {}
    return pendingAction;
  }

  function loadPending() {
    if (pendingAction && pendingAction.expiresAt > now()) return pendingAction;
    try {
      const parsed = JSON.parse(W.sessionStorage?.getItem?.(PENDING_KEY) || 'null');
      if (parsed && parsed.expiresAt > now()) {
        pendingAction = parsed;
        return pendingAction;
      }
    } catch (_err) {}
    rememberPending(null);
    return null;
  }

  function actionIdFor(config) {
    return `stage19i12:${clean(config.actionType || config.stepName || 'ai_outcome')}:${now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  }

  function beginAction(config = {}, extra = {}) {
    if (!memoryEnabled()) return null;
    const previous = loadPending();
    if (previous && previous.expiresAt > now() && extra.reuseExisting !== false) return previous;
    const ttl = Number(config.ttlMs || extra.ttlMs || DEFAULT_TTL_MS);
    const action = {
      stage: STAGE,
      actionId: extra.actionId || actionIdFor(config),
      workflow: clean(config.workflow || extra.workflow || 'high-value-ai-workflow'),
      stepName: clean(config.stepName || extra.stepName || config.actionType || 'apply-ai-output'),
      actionType: clean(config.actionType || extra.actionType || config.stepName || 'ai_output_applied'),
      source: clean(config.source || extra.source || 'stage19i12'),
      editMode: clean(config.editMode || extra.editMode || ''),
      buttonId: clean(extra.buttonId || config.buttonId || ''),
      startedAt: now(),
      expiresAt: now() + Math.max(3000, ttl),
      mutationCount: 0,
      metadata: { ...(config.metadata || {}), ...(extra.metadata || {}) }
    };
    return rememberPending(action);
  }

  function shortenActionAfterMutation(action) {
    if (!action) return;
    action.mutationCount = Number(action.mutationCount || 0) + 1;
    action.expiresAt = Math.min(action.expiresAt || now(), now() + AFTER_MUTATION_TTL_MS);
    rememberPending(action);
  }

  function dedupe(key) {
    if (!key) return false;
    if (loggedKeys.includes(key)) return true;
    loggedKeys.push(key);
    while (loggedKeys.length > 120) loggedKeys.shift();
    return false;
  }

  function outputSummaryForPath(path, oldText, newText) {
    const oldLen = String(oldText || '').length;
    const newLen = String(newText || '').length;
    const delta = newLen - oldLen;
    return `${path || activeFilePath()} changed by ${delta >= 0 ? '+' : ''}${delta} chars (${oldLen} -> ${newLen}).`;
  }

  async function logOutcome(config = {}, result = {}, context = {}) {
    if (!memoryEnabled() || !NS.RewardLoggingService?.logEditOutcome) return null;
    const action = context.action || loadPending() || beginAction(config, { reuseExisting: false });
    if (!action) return null;

    const ok = !(result?.ok === false || result?.error || result?.failed);
    const path = clean(result?.path || context.path || activeFilePath());
    const oldText = context.oldText;
    const newText = context.newText;
    const oldHash = oldText !== undefined ? stableHash(oldText) : '';
    const newHash = newText !== undefined ? stableHash(newText) : '';
    const dedupeKey = [action.actionId, action.actionType, path, oldHash, newHash, result?.operation || result?.mode || ''].join('|');
    if (dedupe(dedupeKey)) return null;

    const aiRun = currentAiRun();
    const memoryIds = normalizeIds(context.memoryIds || aiRun?.memoryIds || []);
    const rewardValue = typeof result?.rewardValue === 'number'
      ? result.rewardValue
      : (ok ? (config.rewardValue ?? 0.65) : (config.failureRewardValue ?? -0.8));
    const note = clean(result?.message || result?.note || context.note || outputSummaryForPath(path, oldText, newText));
    const payload = {
      ok,
      actionId: `${action.actionId}:${stableHash(dedupeKey).slice(0, 10)}`,
      workflow: clean(config.workflow || action.workflow || 'high-value-ai-workflow'),
      stepName: clean(config.stepName || action.stepName || action.actionType),
      source: clean(config.source || action.source || 'stage19i12'),
      editMode: clean(config.editMode || action.editMode || result?.operation || result?.mode || ''),
      path,
      compileStatus: compileStatus(),
      githubStatus: clean(result?.githubStatus || ''),
      validationStatus: clean(result?.validationStatus || ''),
      accepted: config.accepted !== undefined ? config.accepted : (ok ? true : false),
      rewardValue,
      rewardLabel: rewardValue > 0 ? 'positive' : rewardValue < 0 ? 'negative' : 'neutral',
      agentRunId: clean(context.agentRunId || aiRun?.runId || aiRun?.id || ''),
      contextBundleId: clean(context.contextBundleId || aiRun?.contextBundleId || ''),
      memoryIds,
      note,
      metadata: {
        stage: STAGE,
        highValueOutcomeWiring: true,
        action,
        resultSummary: {
          ok,
          operation: result?.operation || result?.mode || '',
          start: result?.start,
          end: result?.end,
          path
        },
        oldHash,
        newHash,
        oldChars: oldText !== undefined ? String(oldText || '').length : undefined,
        newChars: newText !== undefined ? String(newText || '').length : undefined,
        relatedAiRun: aiRun ? {
          runId: aiRun.runId || aiRun.id || '',
          workflow: aiRun.workflow || '',
          taskType: aiRun.taskType || '',
          agentRole: aiRun.agentRole || ''
        } : null,
        ...(context.metadata || {}),
        ...(config.metadata || {})
      }
    };

    try {
      const saved = await NS.RewardLoggingService.logEditOutcome(action.actionType, payload);
      await maybeLogTrajectory(action, payload, saved, aiRun);
      return saved;
    } catch (err) {
      try { console.warn('[Latexai 19I12 outcome memory] log outcome failed', err); } catch (_ignored) {}
      return null;
    }
  }

  async function maybeLogTrajectory(action, payload, savedOutcome, aiRun) {
    if (!NS.DebateTrajectoryLoggingService?.logTrajectory) return null;
    const highValue = /copilot|document|citation|tikz|image|paper-ai|presentation|final|synthesis|rewrite|polish|review/i.test(`${payload.workflow} ${payload.stepName} ${action.actionType}`);
    if (!highValue) return null;
    try {
      return await NS.DebateTrajectoryLoggingService.logTrajectory({
        workflow: payload.workflow,
        trajectoryType: 'high-value-ai-outcome',
        title: `Outcome: ${payload.workflow}/${payload.stepName}`,
        status: payload.accepted === false || payload.rewardValue < 0 ? 'needs_review' : 'completed',
        rootStateText: payload.note || '',
        finalScore: payload.rewardValue,
        agentRunIds: aiRun?.runId || aiRun?.id ? [aiRun.runId || aiRun.id] : [],
        contextBundleIds: aiRun?.contextBundleId ? [aiRun.contextBundleId] : [],
        editOutcomeIds: savedOutcome?.id ? [savedOutcome.id] : [],
        memoryIds: payload.memoryIds || [],
        steps: [{
          stepName: payload.stepName,
          agentRole: aiRun?.agentRole || 'editor',
          actionType: action.actionType,
          agentRunId: aiRun?.runId || aiRun?.id || '',
          contextBundleId: aiRun?.contextBundleId || '',
          status: payload.rewardValue < 0 ? 'failed' : 'success',
          score: payload.rewardValue,
          summary: payload.note || '',
          memoryIds: payload.memoryIds || [],
          metadata: { stage: STAGE, source: payload.source }
        }],
        outcomes: [{
          outcomeType: action.actionType,
          status: payload.rewardValue < 0 ? 'negative' : 'positive',
          score: payload.rewardValue,
          rewardValue: payload.rewardValue,
          rewardLabel: payload.rewardLabel,
          editOutcomeId: savedOutcome?.id || '',
          summary: payload.note || '',
          memoryIds: payload.memoryIds || [],
          metadata: { stage: STAGE, path: payload.path }
        }],
        metadata: { stage: STAGE, actionId: action.actionId, source: action.source }
      });
    } catch (err) {
      try { console.warn('[Latexai 19I12 outcome memory] trajectory failed', err); } catch (_ignored) {}
      return null;
    }
  }

  const BUTTON_ACTIONS = {
    insertCopilotBtn: { workflow: 'latex-copilot', stepName: 'insert-copilot-output', actionType: 'copilot_insert_output', editMode: 'insert-at-cursor', source: 'copilot-button' },
    replaceCopilotBtn: { workflow: 'latex-copilot', stepName: 'replace-with-copilot-output', actionType: 'copilot_replace_with_lai', editMode: 'replace-selection-lai', source: 'copilot-button' },
    applyCopilotPatchBtn: { workflow: 'latex-copilot', stepName: 'apply-copilot-patch', actionType: 'copilot_apply_patch', editMode: 'patch', source: 'patch-manager-button' },

    appendDocumentAiBtn: { workflow: 'document-ai', stepName: 'append-document-ai-section', actionType: 'document_ai_append_section', editMode: 'append-lai-section', source: 'document-ai-button' },
    runAppendDocumentAiBtn: { workflow: 'document-ai', stepName: 'run-and-append-document-ai', actionType: 'document_ai_run_and_append', editMode: 'append-or-apply', source: 'document-ai-button', ttlMs: LONG_TTL_MS },
    keepNewDocumentAiBtn: { workflow: 'document-ai', stepName: 'resolve-selected-keep-new', actionType: 'document_ai_resolve_keep_new', editMode: 'resolve-lai', source: 'document-ai-resolver-button' },
    keepOldDocumentAiBtn: { workflow: 'document-ai', stepName: 'resolve-selected-keep-old', actionType: 'document_ai_resolve_keep_old', editMode: 'resolve-laiold', source: 'document-ai-resolver-button', accepted: true },
    keepAllNewDocumentAiBtn: { workflow: 'document-ai', stepName: 'resolve-all-keep-new', actionType: 'document_ai_resolve_all_keep_new', editMode: 'resolve-lai', source: 'document-ai-resolver-button' },
    keepAllOldDocumentAiBtn: { workflow: 'document-ai', stepName: 'resolve-all-keep-old', actionType: 'document_ai_resolve_all_keep_old', editMode: 'resolve-laiold', source: 'document-ai-resolver-button', accepted: true },

    applyCitationAiBtn: { workflow: 'citation-ai', stepName: 'apply-citation-plan', actionType: 'citation_ai_apply_plan', editMode: 'replace-citeai-and-append-bibtex', source: 'citation-ai-button' },
    runApplyCitationAiBtn: { workflow: 'citation-ai', stepName: 'run-and-apply-citation-plan', actionType: 'citation_ai_run_and_apply_plan', editMode: 'replace-citeai-and-append-bibtex', source: 'citation-ai-button', ttlMs: LONG_TTL_MS },
    repairMissingBibtexBtn: { workflow: 'citation-verifier', stepName: 'repair-missing-bibtex', actionType: 'citation_verifier_repair_missing_bibtex', editMode: 'append-bibtex', source: 'citation-verifier-button', ttlMs: LONG_TTL_MS },
    verifyRepairMissingBibtexBtn: { workflow: 'citation-verifier', stepName: 'verify-and-repair-missing-bibtex', actionType: 'citation_verifier_verify_and_repair_missing_bibtex', editMode: 'append-bibtex', source: 'citation-verifier-button', ttlMs: LONG_TTL_MS },

    imageTikzRemakeInsertBtn: { workflow: 'image-to-tikz', stepName: 'remake-and-insert-tikz', actionType: 'image_to_tikz_remake_and_insert', editMode: 'insert-direct-tikz', source: 'image-to-tikz-button', ttlMs: LONG_TTL_MS },
    imageTikzInsertReturnedBtn: { workflow: 'image-to-tikz', stepName: 'insert-returned-tikz', actionType: 'image_to_tikz_insert_returned', editMode: 'insert-direct-tikz', source: 'image-to-tikz-button' },
    tikzSaveBtn: { workflow: 'tikz-maker', stepName: 'save-tikz-asset', actionType: 'tikz_maker_save_asset', editMode: 'save-tex-asset', source: 'tikz-maker-button' },
    tikzDirectInsertBtn: { workflow: 'tikz-maker', stepName: 'insert-tikz-directly', actionType: 'tikz_maker_direct_insert', editMode: 'insert-direct-tikz', source: 'tikz-maker-button' },
    tikzSaveInsertBtn: { workflow: 'tikz-maker', stepName: 'save-and-insert-tikz-input', actionType: 'tikz_maker_save_and_insert', editMode: 'save-tex-asset-and-input', source: 'tikz-maker-button' },

    paperAiApplySelectedBtn: { workflow: 'paper-ai-polish', stepName: 'apply-selected-paper-ai-edits', actionType: 'paper_ai_apply_selected_edits', editMode: 'resolve-lai', source: 'paper-ai-polish-button' },
    paperAiRejectSelectedBtn: { workflow: 'paper-ai-polish', stepName: 'reject-selected-paper-ai-edits', actionType: 'paper_ai_reject_selected_edits', editMode: 'resolve-laiold', source: 'paper-ai-polish-button', accepted: true },
    paperAiAcceptAllNewBtn: { workflow: 'paper-ai-polish', stepName: 'accept-all-paper-ai-new', actionType: 'paper_ai_accept_all_new', editMode: 'resolve-all-lai', source: 'paper-ai-polish-button' },
    paperAiRejectAllBtn: { workflow: 'paper-ai-polish', stepName: 'reject-all-paper-ai-keep-old', actionType: 'paper_ai_reject_all_keep_old', editMode: 'resolve-all-laiold', source: 'paper-ai-polish-button', accepted: true },
    paperAiRepairUnsafeBtn: { workflow: 'paper-ai-polish', stepName: 'repair-unsafe-paper-ai-edits', actionType: 'paper_ai_repair_unsafe_edits', editMode: 'repair-lai-markup', source: 'paper-ai-polish-button', ttlMs: LONG_TTL_MS },

    validateSavePresentationExportBtn: { workflow: 'presentation-export', stepName: 'validate-and-save-deck', actionType: 'presentation_export_validate_and_save_deck', editMode: 'save-json', source: 'presentation-export-button' },
    savePresentationExportBtn: { workflow: 'presentation-export', stepName: 'save-deck-json', actionType: 'presentation_export_save_deck_json', editMode: 'save-json', source: 'presentation-export-button' },
    runSavePresentationExportBtn: { workflow: 'presentation-export', stepName: 'run-and-save-deck-json', actionType: 'presentation_export_run_and_save_deck_json', editMode: 'save-json', source: 'presentation-export-button', ttlMs: LONG_TTL_MS },
    addTalkExportsBtn: { workflow: 'presentation-export', stepName: 'add-talk-exports-to-project', actionType: 'presentation_export_add_talk_exports_to_project', editMode: 'create-export-files', source: 'presentation-export-button' },
    runAddTalkExportsBtn: { workflow: 'presentation-export', stepName: 'run-and-add-talk-exports-to-project', actionType: 'presentation_export_run_and_add_talk_exports_to_project', editMode: 'create-export-files', source: 'presentation-export-button', ttlMs: LONG_TTL_MS }
  };

  function installClickCapture() {
    if (NS.__stage19i12ClickCaptureInstalled) return;
    NS.__stage19i12ClickCaptureInstalled = true;
    D.addEventListener('click', (event) => {
      const target = event.target?.closest?.('button, [role="button"]');
      const id = target?.id || '';
      const config = BUTTON_ACTIONS[id];
      if (!config) return;
      beginAction(config, { buttonId: id, reuseExisting: false });
    }, true);
  }

  function wrapStateUpdateFile() {
    const State = NS.State;
    if (!State?.updateFile || wrapped.has('State.updateFile')) return false;
    const original = State.updateFile.bind(State);
    State.updateFile = function stage19i12UpdateFileWithOutcome(path, text) {
      const action = loadPending();
      let oldText;
      try { oldText = NS.State?.getFile?.(path)?.text; } catch (_err) {}
      const result = original(path, text);
      if (action && !suppressMutationDepth && result) {
        let newText;
        try { newText = NS.State?.getFile?.(path)?.text; } catch (_err) {}
        shortenActionAfterMutation(action);
        const config = { workflow: action.workflow, stepName: action.stepName, actionType: action.actionType, editMode: action.editMode, source: action.source, accepted: action.accepted, metadata: action.metadata };
        logOutcome(config, { ok: true, path, operation: action.editMode || 'update-file' }, { action, path, oldText, newText, metadata: { trigger: 'State.updateFile' } });
      }
      return result;
    };
    State.updateFile.__stage19i12OutcomeWrapped = true;
    wrapped.add('State.updateFile');
    return true;
  }

  function wrapEditorInsertText() {
    const Editor = NS.Editor;
    if (!Editor?.insertText || wrapped.has('Editor.insertText')) return false;
    const original = Editor.insertText.bind(Editor);
    Editor.insertText = function stage19i12InsertTextWithOutcome(text) {
      const action = loadPending();
      const path = activeFilePath();
      let oldText;
      try { oldText = NS.State?.getFile?.(path)?.text; } catch (_err) {}
      const result = original(text);
      if (action && !suppressMutationDepth) {
        let newText;
        try { newText = NS.State?.getFile?.(path)?.text; } catch (_err) {}
        shortenActionAfterMutation(action);
        logOutcome({ workflow: action.workflow, stepName: action.stepName, actionType: action.actionType, editMode: action.editMode || 'insert-text', source: action.source, metadata: action.metadata }, { ok: true, path, operation: 'insert-text' }, { action, path, oldText, newText, metadata: { trigger: 'Editor.insertText' } });
      }
      return result;
    };
    wrapped.add('Editor.insertText');
    return true;
  }

  function wrapPatchService() {
    const svc = NS.PatchService;
    if (!svc || wrapped.has('PatchService')) return false;
    if (typeof svc.applyRewrite === 'function') {
      const originalRewrite = svc.applyRewrite.bind(svc);
      svc.applyRewrite = function stage19i12ApplyRewriteWithOutcome(input = {}) {
        const action = loadPending() || beginAction({ workflow: 'latex-copilot', stepName: 'apply-lai-rewrite', actionType: 'ai_lai_rewrite_applied', editMode: 'replace-selection-lai', source: input.source || 'patch-service' }, { reuseExisting: false });
        suppressMutationDepth += 1;
        let result;
        try { result = originalRewrite(input); }
        finally { suppressMutationDepth -= 1; }
        let newText;
        try { newText = NS.State?.getFile?.(result?.path || input.path || activeFilePath())?.text; } catch (_err) {}
        logOutcome({ workflow: action?.workflow || 'latex-copilot', stepName: action?.stepName || 'apply-lai-rewrite', actionType: action?.actionType || 'ai_lai_rewrite_applied', editMode: 'replace-selection-lai', source: input.source || action?.source || 'patch-service' }, result || { ok: false, message: 'PatchService.applyRewrite returned no result.' }, { action, path: result?.path || input.path, oldText: result?.oldText || input.oldText, newText, metadata: { trigger: 'PatchService.applyRewrite' } });
        return result;
      };
    }
    if (typeof svc.applyPlainPatch === 'function') {
      const originalPlain = svc.applyPlainPatch.bind(svc);
      svc.applyPlainPatch = function stage19i12ApplyPlainPatchWithOutcome(candidate = {}) {
        const action = loadPending() || beginAction({ workflow: 'latex-copilot', stepName: 'apply-plain-ai-patch', actionType: 'ai_plain_patch_applied', editMode: candidate?.patch?.operation || candidate?.operation || 'plain-patch', source: 'patch-service' }, { reuseExisting: false });
        const path = candidate?.patch?.path || candidate?.path || activeFilePath();
        let oldText;
        try { oldText = NS.State?.getFile?.(path)?.text; } catch (_err) {}
        suppressMutationDepth += 1;
        let result;
        try { result = originalPlain(candidate); }
        finally { suppressMutationDepth -= 1; }
        let newText;
        try { newText = NS.State?.getFile?.(result?.path || path)?.text; } catch (_err) {}
        logOutcome({ workflow: action?.workflow || 'latex-copilot', stepName: action?.stepName || 'apply-plain-ai-patch', actionType: action?.actionType || 'ai_plain_patch_applied', editMode: result?.operation || candidate?.patch?.operation || candidate?.operation || 'plain-patch', source: action?.source || 'patch-service' }, result || { ok: false, message: 'PatchService.applyPlainPatch returned no result.' }, { action, path: result?.path || path, oldText, newText, metadata: { trigger: 'PatchService.applyPlainPatch' } });
        return result;
      };
    }
    wrapped.add('PatchService');
    return true;
  }

  function wrapAssetService() {
    const svc = NS.AssetService;
    if (!svc || wrapped.has('AssetService')) return false;
    function wrapAssetMethod(name, defaults) {
      if (typeof svc[name] !== 'function' || svc[name].__stage19i12OutcomeWrapped) return;
      const original = svc[name].bind(svc);
      svc[name] = function stage19i12AssetOutcomeWrapper(...args) {
        const action = loadPending() || beginAction(defaults, { reuseExisting: false });
        const targetPath = args?.[0]?.insertPath || args?.[0]?.path || activeFilePath();
        let oldText;
        try { oldText = NS.State?.getFile?.(targetPath)?.text; } catch (_err) {}
        suppressMutationDepth += 1;
        let result;
        try { result = original(...args); }
        finally { suppressMutationDepth -= 1; }
        let newText;
        try { newText = NS.State?.getFile?.(result?.path || targetPath)?.text; } catch (_err) {}
        logOutcome({ ...defaults, workflow: action?.workflow || defaults.workflow, stepName: action?.stepName || defaults.stepName, actionType: action?.actionType || defaults.actionType, source: action?.source || defaults.source }, result || { ok: false, message: `${name} returned no result.` }, { action, path: result?.path || targetPath, oldText, newText, metadata: { trigger: `AssetService.${name}` } });
        return result;
      };
      svc[name].__stage19i12OutcomeWrapped = true;
    }
    wrapAssetMethod('addTextAsset', { workflow: 'tikz-maker', stepName: 'save-ai-text-asset', actionType: 'ai_text_asset_saved', editMode: 'create-text-asset', source: 'asset-service' });
    wrapAssetMethod('insertDirectTikzFigure', { workflow: 'tikz-maker', stepName: 'insert-direct-tikz-figure', actionType: 'ai_tikz_direct_figure_inserted', editMode: 'insert-direct-tikz', source: 'asset-service' });
    wrapAssetMethod('insertInputFigureSnippet', { workflow: 'tikz-maker', stepName: 'insert-input-figure-snippet', actionType: 'ai_tikz_input_snippet_inserted', editMode: 'insert-input-figure', source: 'asset-service' });
    wrapped.add('AssetService');
    return true;
  }

  const METHOD_ACTIONS = [
    ['DocumentAIService', 'appendLastToPaper', { workflow: 'document-ai', stepName: 'append-document-ai-section', actionType: 'document_ai_append_section', editMode: 'append-lai-section', source: 'document-ai-method' }],
    ['DocumentAIService', 'runAndAppendDocumentAi', { workflow: 'document-ai', stepName: 'run-and-append-document-ai', actionType: 'document_ai_run_and_append', editMode: 'append-or-apply', source: 'document-ai-method', ttlMs: LONG_TTL_MS }],
    ['DocumentAIService', 'resolveSelectedKeepNew', { workflow: 'document-ai', stepName: 'resolve-selected-keep-new', actionType: 'document_ai_resolve_keep_new', editMode: 'resolve-lai', source: 'document-ai-method' }],
    ['DocumentAIService', 'resolveSelectedKeepOld', { workflow: 'document-ai', stepName: 'resolve-selected-keep-old', actionType: 'document_ai_resolve_keep_old', editMode: 'resolve-laiold', source: 'document-ai-method', accepted: true }],
    ['DocumentAIService', 'resolveAllKeepNew', { workflow: 'document-ai', stepName: 'resolve-all-keep-new', actionType: 'document_ai_resolve_all_keep_new', editMode: 'resolve-lai', source: 'document-ai-method' }],
    ['DocumentAIService', 'resolveAllKeepOld', { workflow: 'document-ai', stepName: 'resolve-all-keep-old', actionType: 'document_ai_resolve_all_keep_old', editMode: 'resolve-laiold', source: 'document-ai-method', accepted: true }],
    ['CitationAIService', 'applyCitationPlan', { workflow: 'citation-ai', stepName: 'apply-citation-plan', actionType: 'citation_ai_apply_plan', editMode: 'replace-citeai-and-append-bibtex', source: 'citation-ai-method' }],
    ['CitationAIService', 'runAndApplyCitationAi', { workflow: 'citation-ai', stepName: 'run-and-apply-citation-plan', actionType: 'citation_ai_run_and_apply_plan', editMode: 'replace-citeai-and-append-bibtex', source: 'citation-ai-method', ttlMs: LONG_TTL_MS }],
    ['CitationVerifierService', 'repairMissingBibtex', { workflow: 'citation-verifier', stepName: 'repair-missing-bibtex', actionType: 'citation_verifier_repair_missing_bibtex', editMode: 'append-bibtex', source: 'citation-verifier-method', ttlMs: LONG_TTL_MS }],
    ['CitationVerifierService', 'verifyAndRepairMissingBibtex', { workflow: 'citation-verifier', stepName: 'verify-and-repair-missing-bibtex', actionType: 'citation_verifier_verify_and_repair_missing_bibtex', editMode: 'append-bibtex', source: 'citation-verifier-method', ttlMs: LONG_TTL_MS }],
    ['ImageToTikzService', 'insertTikzFigureDirect', { workflow: 'image-to-tikz', stepName: 'insert-returned-tikz', actionType: 'image_to_tikz_insert_returned', editMode: 'insert-direct-tikz', source: 'image-to-tikz-method' }],
    ['ImageToTikzService', 'insertReturnedTikzAnyway', { workflow: 'image-to-tikz', stepName: 'insert-returned-tikz', actionType: 'image_to_tikz_insert_returned', editMode: 'insert-direct-tikz', source: 'image-to-tikz-method' }],
    ['ImageToTikzService', 'remakeAndInsert', { workflow: 'image-to-tikz', stepName: 'remake-and-insert-tikz', actionType: 'image_to_tikz_remake_and_insert', editMode: 'insert-direct-tikz', source: 'image-to-tikz-method', ttlMs: LONG_TTL_MS }],
    ['TikzMakerService', 'saveTikz', { workflow: 'tikz-maker', stepName: 'save-or-insert-tikz', actionType: 'tikz_maker_save_or_insert', editMode: 'save-or-insert', source: 'tikz-maker-method' }],
    ['PaperAiPolishService', 'acceptAllNew', { workflow: 'paper-ai-polish', stepName: 'accept-all-paper-ai-new', actionType: 'paper_ai_accept_all_new', editMode: 'resolve-all-lai', source: 'paper-ai-polish-method' }],
    ['PaperAiPolishService', 'rejectAllKeepOld', { workflow: 'paper-ai-polish', stepName: 'reject-all-paper-ai-keep-old', actionType: 'paper_ai_reject_all_keep_old', editMode: 'resolve-all-laiold', source: 'paper-ai-polish-method', accepted: true }],
    ['PaperAiPolishService', 'repairUnsafeAiEditBlocks', { workflow: 'paper-ai-polish', stepName: 'repair-unsafe-paper-ai-edits', actionType: 'paper_ai_repair_unsafe_edits', editMode: 'repair-lai-markup', source: 'paper-ai-polish-method', ttlMs: LONG_TTL_MS }],
    ['PresentationExportService', 'saveDeckToProject', { workflow: 'presentation-export', stepName: 'save-deck-json', actionType: 'presentation_export_save_deck_json', editMode: 'save-json', source: 'presentation-export-method' }],
    ['PresentationExportService', 'validateAndSaveDeck', { workflow: 'presentation-export', stepName: 'validate-and-save-deck', actionType: 'presentation_export_validate_and_save_deck', editMode: 'save-json', source: 'presentation-export-method' }],
    ['PresentationExportService', 'runAndSavePresentationExport', { workflow: 'presentation-export', stepName: 'run-and-save-deck-json', actionType: 'presentation_export_run_and_save_deck_json', editMode: 'save-json', source: 'presentation-export-method', ttlMs: LONG_TTL_MS }],
    ['PresentationExportService', 'addSelectedExportsToGit', { workflow: 'presentation-export', stepName: 'add-talk-exports-to-project', actionType: 'presentation_export_add_talk_exports_to_project', editMode: 'create-export-files', source: 'presentation-export-method' }],
    ['PresentationExportService', 'runAndAddSelectedExportsToGit', { workflow: 'presentation-export', stepName: 'run-and-add-talk-exports-to-project', actionType: 'presentation_export_run_and_add_talk_exports_to_project', editMode: 'create-export-files', source: 'presentation-export-method', ttlMs: LONG_TTL_MS }]
  ];

  function wrapProgrammaticMethod([serviceName, methodName, config]) {
    const svc = NS[serviceName];
    const key = `${serviceName}.${methodName}`;
    if (!svc || typeof svc[methodName] !== 'function' || wrapped.has(key)) return false;
    const original = svc[methodName].bind(svc);
    svc[methodName] = function stage19i12ProgrammaticAiOutcomeMarker(...args) {
      const action = beginAction(config, { reuseExisting: false });
      try {
        const result = original(...args);
        if (result && typeof result.then === 'function') {
          return result.then((value) => {
            if (value?.ok === false && action?.mutationCount === 0) logOutcome(config, value, { action, metadata: { trigger: key, noMutation: true } });
            return value;
          }).catch((err) => {
            logOutcome(config, { ok: false, message: err?.message || String(err || '') }, { action, metadata: { trigger: key, exception: true } });
            throw err;
          });
        }
        if (result?.ok === false && action?.mutationCount === 0) logOutcome(config, result, { action, metadata: { trigger: key, noMutation: true } });
        return result;
      } catch (err) {
        logOutcome(config, { ok: false, message: err?.message || String(err || '') }, { action, metadata: { trigger: key, exception: true } });
        throw err;
      }
    };
    wrapped.add(key);
    return true;
  }

  function installWrappers() {
    wrapStateUpdateFile();
    wrapEditorInsertText();
    wrapPatchService();
    wrapAssetService();
    METHOD_ACTIONS.forEach(wrapProgrammaticMethod);
  }

  function init() {
    installClickCapture();
    installWrappers();
    if (NS.__stage19i12OutcomeInterval) return;
    let ticks = 0;
    NS.__stage19i12OutcomeInterval = W.setInterval(() => {
      ticks += 1;
      installWrappers();
      if (ticks > 240) W.clearInterval(NS.__stage19i12OutcomeInterval);
    }, 500);
  }

  NS.HighValueAIOutcomeMemoryService = {
    STAGE,
    init,
    beginAction,
    currentAction: loadPending,
    logOutcome,
    buttonActions: BUTTON_ACTIONS,
    wrapped: () => Array.from(wrapped)
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
