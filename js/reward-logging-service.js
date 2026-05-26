/* Latexai Stage 19G RewardLoggingService
 * Stage: stage19g-edit-outcome-reward-logging-20260526-1
 *
 * Hidden frontend reward/outcome logger. It records lightweight training signals
 * for future AlphaGo-style debate/context-policy learning without adding UI.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19g-edit-outcome-reward-logging-20260526-1';
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
        memoryIds: normalizeMemoryIds(options.memoryIds || memoryIdsFromContext(options.memoryContext)),
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
        agentRunId: outcome.agentRunId || '',
        contextBundleId: outcome.contextBundleId || '',
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
        metadata: { stage: STAGE, ...(ids.identityMetadata || {}), ...(outcome.metadata || {}) }
      };
      const saved = await memoryPost('/edit-outcome', payload);
      await logReward(`${actionType}:${payload.rewardLabel}`, rewardValue, {
        workflow: payload.workflow,
        stepName: payload.stepName,
        relatedActionId: actionId,
        relatedAgentRunId: payload.agentRunId,
        memoryIds: outcome.memoryIds,
        memoryContext: outcome.memoryContext,
        note: outcome.note || '',
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
    rememberAction,
    lastAction,
    init
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
