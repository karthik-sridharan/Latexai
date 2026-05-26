/* Latexai Stage 19H DebateTrajectoryLoggingService
 * Stage: stage19h-debate-trajectory-logging-20260526-1
 *
 * Hidden logger that links agent runs, contexts, memory ids, edit outcomes,
 * and rewards into full debate/revision trajectories.  This is the first
 * trajectory dataset for future AlphaGo-style debate tree search.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19h-debate-trajectory-logging-20260526-1';

  function clean(value) { return String(value || '').trim(); }

  function memoryEnabled() {
    try { return W.localStorage?.getItem?.('latexai:memory-enabled') !== 'false'; } catch (_err) { return true; }
  }

  function stableHash(text) {
    let h = 2166136261;
    const s = String(text || '');
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function projectIdentity() {
    if (NS.RewardLoggingService?.projectIdentity) return NS.RewardLoggingService.projectIdentity();
    const project = NS.State?.state?.project || {};
    const active = NS.State?.getActiveFile?.() || null;
    const github = project.github || project.meta?.github || {};
    const owner = clean(github.owner);
    const repo = clean(github.repo);
    const branch = clean(github.branch || 'main') || 'main';
    const activePath = clean(active?.path || project.activePath || project.rootFile || 'main.tex');
    const seed = owner && repo ? `github:${owner}/${repo}:${branch}:${project.rootFile || activePath}` : `local:${project.id || project.projectId || activePath}`;
    const projectId = project.projectId || project.id || `project_${stableHash(seed)}`;
    const paperId = project.paperId || project.meta?.paperId || `paper_${stableHash(seed + ':' + (project.rootFile || activePath))}`;
    return {
      userId: 'local-user', projectId, paperId, sectionId: activePath,
      sessionId: `session_${stableHash(String(W.location?.href || '') + ':' + projectId)}`,
      identityMetadata: { owner, repo, branch, activePath, stage: STAGE }
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

  function normalizeIds(value) {
    const ids = [];
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') ids.push(item);
        else if (item?.id) ids.push(String(item.id));
        else if (item?.memoryId) ids.push(String(item.memoryId));
        else if (item?.runId) ids.push(String(item.runId));
        else if (item?.contextBundleId) ids.push(String(item.contextBundleId));
      });
    }
    return Array.from(new Set(ids.filter(Boolean)));
  }

  function memoryIdsFromContexts(contexts) {
    const out = [];
    (Array.isArray(contexts) ? contexts : [contexts]).forEach((ctx) => {
      (ctx?.facts || []).forEach((fact) => { if (fact?.id) out.push(String(fact.id)); });
      normalizeIds(ctx?.memoryIds || ctx?.memory_ids).forEach((id) => out.push(id));
    });
    return Array.from(new Set(out));
  }

  function summarize(text, max = 1200) {
    return String(text || '').replace(/```[\s\S]*?```/g, '[structured block omitted]').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  async function logTrajectory(payload = {}) {
    if (!memoryEnabled()) return null;
    try {
      const ids = projectIdentity();
      const steps = Array.isArray(payload.steps) ? payload.steps : [];
      const outcomes = Array.isArray(payload.outcomes) ? payload.outcomes : [];
      const agentRunIds = normalizeIds(payload.agentRunIds || steps.map((s) => s?.agentRunId));
      const contextBundleIds = normalizeIds(payload.contextBundleIds || steps.map((s) => s?.contextBundleId));
      const memoryIds = normalizeIds(payload.memoryIds).concat(memoryIdsFromContexts(payload.memoryContexts || []));
      const body = {
        scope: payload.scope || 'paper',
        userId: ids.userId,
        projectId: ids.projectId,
        paperId: ids.paperId,
        sectionId: payload.sectionId || ids.sectionId,
        sessionId: ids.sessionId,
        workflow: payload.workflow || 'debate-trajectory',
        trajectoryType: payload.trajectoryType || payload.type || payload.workflow || 'debate-trajectory',
        title: payload.title || payload.trajectoryType || payload.workflow || 'Debate trajectory',
        status: payload.status || 'unknown',
        branchLabel: payload.branchLabel || '',
        rootStateText: payload.rootStateText || '',
        finalScore: payload.finalScore,
        agentRunIds,
        contextBundleIds,
        rewardEventIds: normalizeIds(payload.rewardEventIds),
        editOutcomeIds: normalizeIds(payload.editOutcomeIds),
        memoryIds: Array.from(new Set(memoryIds.filter(Boolean))),
        steps: steps.map((step, i) => ({
          stepIndex: typeof step.stepIndex === 'number' ? step.stepIndex : i,
          stepName: step.stepName || step.name || `step_${i + 1}`,
          agentRole: step.agentRole || step.role || '',
          actionType: step.actionType || step.taskType || '',
          agentRunId: step.agentRunId || '',
          contextBundleId: step.contextBundleId || '',
          score: step.score,
          status: step.status || 'unknown',
          summary: step.summary || summarize(step.output || step.text || '', 1400),
          memoryIds: normalizeIds(step.memoryIds),
          metadata: { stage: STAGE, ...(step.metadata || {}) }
        })),
        outcomes: outcomes.map((outcome) => ({
          outcomeType: outcome.outcomeType || outcome.type || 'debate_outcome',
          status: outcome.status || 'unknown',
          score: outcome.score,
          rewardValue: typeof outcome.rewardValue === 'number' ? outcome.rewardValue : 0,
          rewardLabel: outcome.rewardLabel || '',
          editOutcomeId: outcome.editOutcomeId || '',
          rewardEventId: outcome.rewardEventId || '',
          summary: outcome.summary || outcome.note || '',
          memoryIds: normalizeIds(outcome.memoryIds),
          metadata: { stage: STAGE, ...(outcome.metadata || {}) }
        })),
        metadata: { stage: STAGE, ...(ids.identityMetadata || {}), ...(payload.metadata || {}) }
      };
      return await memoryPost('/debate-trajectory', body);
    } catch (err) {
      try { console.warn('[Latexai debate trajectory logging] failed', err); } catch (_ignored) {}
      return null;
    }
  }

  NS.DebateTrajectoryLoggingService = {
    STAGE,
    logTrajectory,
    memoryIdsFromContexts,
    summarize,
    projectIdentity
  };
})();
