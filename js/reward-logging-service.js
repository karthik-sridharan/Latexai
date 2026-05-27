/* Latexai Stage 19K RewardLoggingService
 * Stage: stage19k-memory-feedback-loop-frontend-20260526-1
 *
 * Hidden frontend reward/outcome logger. It records lightweight training signals
 * for future AlphaGo-style debate/context-policy learning without adding UI.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19k-memory-feedback-loop-frontend-20260526-1';
  const LAST_ACTION_KEY = 'latexai:stage19g:last-ai-action';

  function memoryEnabled() {
    try { return W.localStorage?.getItem?.('latexai:memory-enabled') !== 'false'; } catch (_err) { return true; }
  }

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

  function getProject() { return NS.State?.state?.project || {}; }
  function getActiveFile() { try { return NS.State?.getActiveFile?.() || null; } catch (_err) { return null; } }

  function projectIdentity() {
    const project = getProject();
    const active = getActiveFile();
    const github = project.github || project.meta?.github || {};
    const owner = clean(github.owner);
    const repo = clean(github.repo);
    const branch = clean(github.branch || 'main') || 'main';
    const rootPath = clean(github.rootPath || '');
    const activePath = clean(active?.path || project.activePath || project.rootFile || 'main.tex');
    const title = clean(project.name || project.title || `${owner}/${repo}` || 'Latexai project');
    const seed = owner && repo ? `github:${owner}/${repo}:${branch}:${rootPath}:${project.rootFile || activePath}` : `local:${project.projectId || project.id || stableHash(title + activePath)}`;
    const projectId = project.projectId || project.id || `project_${stableHash(seed)}`;
    const paperId = project.paperId || project.meta?.paperId || `paper_${stableHash(seed + ':' + (project.rootFile || activePath))}`;
    return {
      userId: 'local-user',
      projectId,
      paperId,
      sectionId: activePath,
      sessionId: `session_${stableHash(String(W.location?.href || '') + ':' + projectId)}`,
      identityMetadata: { owner, repo, branch, rootPath, activePath, title, stage: STAGE }
    };
  }

  function memoryBase() {
    return NS.BackendUrlSettings?.getMemoryApiBaseUrl?.()
      || (clean(W.localStorage?.getItem?.('lumina-latex.memory.backendUrl')) || 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app').replace(/\/$/, '') + '/api/lumina/memory';
  }

  function memoryHeaders(body) {
    const headers = {};
    const token = NS.BackendUrlSettings?.getMemoryProxyToken?.() || '';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return headers;
  }

  async function memoryPost(path, payload) {
    if (!memoryEnabled()) return null;
    const base = memoryBase().replace(/\/$/, '');
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: memoryHeaders(payload),
      body: JSON.stringify(payload || {})
    });
    const text = await response.text().catch(() => '');
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_err) { json = { raw: text }; }
    if (!response.ok || json.ok === false) throw new Error(json.detail || json.message || json.raw || `HTTP ${response.status}`);
    return json;
  }

  function normalizeMemoryIds(value) {
    const ids = [];
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') ids.push(item);
        else if (item?.id) ids.push(String(item.id));
        else if (item?.memoryId) ids.push(String(item.memoryId));
      });
    }
    return Array.from(new Set(ids.filter(Boolean)));
  }

  function memoryIdsFromContext(ctx) {
    return normalizeMemoryIds(ctx?.memoryIds || ctx?.memory_ids || ctx?.facts || []);
  }

  function mergeMemoryIds(...values) {
    const out = [];
    values.forEach((value) => normalizeMemoryIds(value).forEach((id) => out.push(id)));
    return Array.from(new Set(out.filter(Boolean)));
  }

  function lastAgentRun(maxAgeMs = 30 * 60 * 1000) {
    try { return NS.AIWorkflowMemoryService?.getLastAgentRun?.(maxAgeMs) || null; } catch (_err) { return null; }
  }

  function outcomeFromReward({ accepted, rewardValue, status }) {
    if (accepted === true) return 'success';
    if (accepted === false) return 'failure';
    const text = clean(status).toLowerCase();
    if (/^(success|succeeded|accepted|applied|saved|completed|ok|positive)$/.test(text)) return 'success';
    if (/^(failure|failed|rejected|discarded|error|negative)$/.test(text)) return 'failure';
    if (Number(rewardValue) >= 0.20) return 'success';
    if (Number(rewardValue) <= -0.20) return 'failure';
    return 'neutral';
  }

  async function logContextFeedback(options = {}) {
    if (!memoryEnabled()) return null;
    try {
      const ids = projectIdentity();
      const run = options.agentRun || lastAgentRun();
      const memoryIds = mergeMemoryIds(options.memoryIds, memoryIdsFromContext(options.memoryContext), run?.memoryIds);
      const contextBundleId = options.contextBundleId || run?.contextBundleId || '';
      const agentRunId = options.agentRunId || run?.runId || run?.id || '';
      if (!memoryIds.length && !contextBundleId && !agentRunId) return null;
      const rewardValue = typeof options.rewardValue === 'number' ? options.rewardValue : 0;
      const payload = {
        scope: options.scope || 'paper',
        userId: ids.userId,
        projectId: ids.projectId,
        paperId: ids.paperId,
        sectionId: options.sectionId || options.path || ids.sectionId,
        sessionId: ids.sessionId,
        workflow: options.workflow || run?.workflow || '',
        stepName: options.stepName || options.actionType || run?.taskType || '',
        agentRole: options.agentRole || run?.agentRole || 'editor',
        taskType: options.taskType || run?.taskType || options.stepName || '',
        agentRunId,
        contextBundleId,
        memoryIds,
        accepted: options.accepted,
        rewardValue,
        rewardLabel: options.rewardLabel || (rewardValue > 0 ? 'positive' : rewardValue < 0 ? 'negative' : 'neutral'),
        outcome: options.outcome || outcomeFromReward({ accepted: options.accepted, rewardValue, status: options.rewardLabel || options.status }),
        sourceEventId: options.sourceEventId || options.editOutcomeId || options.rewardEventId || options.actionId || '',
        note: options.note || '',
        metadata: { stage: STAGE, memoryFeedbackLoop: true, ...(ids.identityMetadata || {}), ...(options.metadata || {}) }
      };
      return await memoryPost('/context-feedback', payload);
    } catch (err) {
      try { console.warn('[Latexai 19K context feedback] update failed', err); } catch (_ignored) {}
      return null;
    }
  }

  function rewardForValidation(validation, base = 0) {
    if (!validation) return base;
    const errors = validation.errors?.length || 0;
    const warnings = validation.warnings?.length || 0;
    if (errors > 0) return Math.min(base, -1.0 - 0.2 * errors);
    return base + 0.4 - Math.min(0.3, warnings * 0.05);
  }

  function rememberAction(action) {
    try {
      W.sessionStorage?.setItem?.(LAST_ACTION_KEY, JSON.stringify({ ...(action || {}), at: Date.now(), stage: STAGE }));
    } catch (_err) {}
  }

  function lastAction(maxAgeMs = 2 * 60 * 60 * 1000) {
    try {
      const parsed = JSON.parse(W.sessionStorage?.getItem?.(LAST_ACTION_KEY) || 'null');
      if (!parsed || !parsed.at || Date.now() - parsed.at > maxAgeMs) return null;
      return parsed;
    } catch (_err) { return null; }
  }

  async function logReward(eventType, rewardValue, options = {}) {
    if (!memoryEnabled()) return null;
    try {
      const ids = projectIdentity();
      const payload = {
        scope: options.scope || 'paper',
        userId: ids.userId,
        projectId: ids.projectId,
        paperId: ids.paperId,
        sectionId: options.sectionId || ids.sectionId,
        sessionId: ids.sessionId,
        workflow: options.workflow || '',
        stepName: options.stepName || '',
        eventType,
        rewardValue,
        rewardLabel: options.rewardLabel || (rewardValue > 0 ? 'positive' : rewardValue < 0 ? 'negative' : 'neutral'),
        relatedActionId: options.relatedActionId || options.actionId || '',
        relatedAgentRunId: options.relatedAgentRunId || options.agentRunId || '',
        contextBundleId: options.contextBundleId || '',
        memoryIds: mergeMemoryIds(options.memoryIds, memoryIdsFromContext(options.memoryContext)),
        note: options.note || '',
        metadata: { stage: STAGE, ...(ids.identityMetadata || {}), ...(options.metadata || {}) }
      };
      return await memoryPost('/reward', payload);
    } catch (err) {
      try { console.warn('[Latexai reward logging] reward failed', err); } catch (_ignored) {}
      return null;
    }
  }

  async function logEditOutcome(actionType, outcome = {}) {
    if (!memoryEnabled()) return null;
    try {
      const ids = projectIdentity();
      const rewardValue = typeof outcome.rewardValue === 'number'
        ? outcome.rewardValue
        : rewardForValidation(outcome.validation, outcome.ok === false ? -0.6 : 0.5);
      const actionId = outcome.actionId || `${actionType}:${Date.now().toString(36)}:${stableHash(JSON.stringify(outcome).slice(0, 2000))}`;
      const run = lastAgentRun();
      const memoryIds = mergeMemoryIds(outcome.memoryIds, memoryIdsFromContext(outcome.memoryContext), run?.memoryIds);
      const agentRunId = outcome.agentRunId || run?.runId || run?.id || '';
      const contextBundleId = outcome.contextBundleId || run?.contextBundleId || '';
      const payload = {
        scope: outcome.scope || 'paper',
        userId: ids.userId,
        projectId: ids.projectId,
        paperId: ids.paperId,
        sectionId: outcome.sectionId || outcome.path || ids.sectionId,
        sessionId: ids.sessionId,
        workflow: outcome.workflow || 'paper-edit',
        stepName: outcome.stepName || actionType,
        actionType,
        actionId,
        agentRunId,
        contextBundleId,
        source: outcome.source || 'latexai-frontend',
        editMode: outcome.editMode || outcome.mode || '',
        path: outcome.path || (Array.isArray(outcome.paths) ? outcome.paths.join(',') : ''),
        validationStatus: outcome.validation ? (outcome.validation.ok ? 'passed' : 'failed') : (outcome.validationStatus || ''),
        compileStatus: outcome.compileStatus || '',
        githubStatus: outcome.githubStatus || '',
        accepted: outcome.accepted,
        rewardValue,
        rewardLabel: outcome.rewardLabel || (rewardValue > 0 ? 'positive' : rewardValue < 0 ? 'negative' : 'neutral'),
        note: outcome.note || '',
        memoryIds,
        metadata: { stage: STAGE, memoryFeedbackLoop: true, ...(ids.identityMetadata || {}), ...(outcome.metadata || {}) }
      };
      const saved = await memoryPost('/edit-outcome', payload);
      await logReward(`${actionType}:${payload.rewardLabel}`, rewardValue, {
        workflow: payload.workflow,
        stepName: payload.stepName,
        relatedActionId: actionId,
        relatedAgentRunId: payload.agentRunId,
        contextBundleId: payload.contextBundleId,
        memoryIds,
        memoryContext: outcome.memoryContext,
        note: outcome.note || '',
        metadata: { actionType, validationStatus: payload.validationStatus, compileStatus: payload.compileStatus, githubStatus: payload.githubStatus }
      });
      await logContextFeedback({
        actionType,
        actionId,
        sourceEventId: saved?.id || actionId,
        editOutcomeId: saved?.id || '',
        workflow: payload.workflow,
        stepName: payload.stepName,
        agentRole: outcome.agentRole || run?.agentRole || '',
        taskType: outcome.taskType || run?.taskType || payload.stepName,
        agentRunId: payload.agentRunId,
        contextBundleId: payload.contextBundleId,
        memoryIds,
        accepted: payload.accepted,
        rewardValue,
        rewardLabel: payload.rewardLabel,
        note: outcome.note || '',
        path: payload.path,
        metadata: { actionType, validationStatus: payload.validationStatus, compileStatus: payload.compileStatus, githubStatus: payload.githubStatus }
      });
      rememberAction({ actionType, actionId, workflow: payload.workflow, stepName: payload.stepName, rewardValue, path: payload.path });
      return saved;
    } catch (err) {
      try { console.warn('[Latexai reward logging] edit outcome failed', err); } catch (_ignored) {}
      return null;
    }
  }

  async function logGithubOutcome(kind, result = {}, options = {}) {
    const ok = !(result?.ok === false || result?.error);
    const rewardValue = typeof options.rewardValue === 'number' ? options.rewardValue : (ok ? 0.45 : -0.75);
    return logEditOutcome(`github_${kind}`, {
      ok,
      workflow: 'github-project-lifecycle',
      stepName: kind,
      githubStatus: ok ? 'success' : 'failure',
      rewardValue,
      rewardLabel: ok ? 'positive' : 'negative',
      accepted: ok,
      note: ok ? `GitHub ${kind} succeeded.` : `GitHub ${kind} failed: ${result?.error || result?.message || 'unknown'}`,
      metadata: { result: { commitSha: result?.commitSha || result?.result?.commitSha || '', fileCount: result?.fileCount || result?.result?.fileCount || 0 }, ...(options.metadata || {}) }
    });
  }

  async function logCompileOutcome(status, options = {}) {
    const value = /succeed|success|ok/i.test(status) ? 0.55 : /fail|error/i.test(status) ? -0.75 : 0.0;
    const action = lastAction();
    return logReward(`compile_${status || 'unknown'}`, value, {
      workflow: options.workflow || action?.workflow || 'compile',
      stepName: options.stepName || 'compile',
      relatedActionId: options.relatedActionId || action?.actionId || '',
      rewardLabel: value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral',
      note: `Compile status after recent action: ${status || 'unknown'}`,
      metadata: { recentAction: action || null, ...(options.metadata || {}) }
    });
  }

  function bindCompileStatusListener() {
    if (!NS.State?.subscribe || NS.__stage19gCompileRewardListener) return;
    NS.__stage19gCompileRewardListener = true;
    let lastStatus = '';
    NS.State.subscribe((snapshot, reason) => {
      const status = clean(snapshot?.compile?.status || snapshot?.state?.compile?.status || '');
      if (!status || status === lastStatus) return;
      lastStatus = status;
      if (!/succeeded|failed|error|success/i.test(status)) return;
      logCompileOutcome(status, { metadata: { reason } });
    });
  }

  function init() {
    bindCompileStatusListener();
  }

  NS.RewardLoggingService = {
    STAGE,
    projectIdentity,
    logReward,
    logEditOutcome,
    logGithubOutcome,
    logCompileOutcome,
    logContextFeedback,
    rememberAction,
    lastAction,
    init
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
