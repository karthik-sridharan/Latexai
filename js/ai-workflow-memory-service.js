/* Latexai Stage 19I11 AIWorkflowMemoryService
 * Stage: stage19i11-ai-workflow-memory-wiring-completion-20260526-1
 *
 * Generic hidden memory/Neon wiring for AI workflows that were not explicitly
 * wired in stages 19F--19I10. This wraps LuminaLatex.AIProvider.ask and logs
 * role-specific context calls + agent runs for non-specialized workflows such as
 * default Copilot, Document AI, Citation AI, Citation Verifier, Image-to-TikZ,
 * TikZ maker, Presentation export, Paper AI polish, diagnostics, etc.
 *
 * Specialized workflows are intentionally skipped because they already have
 * their own richer wiring:
 *   - competitive-review
 *   - reviewer-rebuttal-simulator
 *   - devils-advocate-paper-debate
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19i11-ai-workflow-memory-wiring-completion-20260526-1';
  const LAST_AGENT_RUN_KEY = 'latexai:stage19i11:last-generic-agent-run';
  const STAGE19I12_LAST_AGENT_RUN_KEY = 'latexai:stage19i12:last-generic-agent-run';
  const WIRED_WORKFLOW_RE = /(competitive[-_ ]review|competitive[-_ ]web[-_ ]review|reviewer[-_ ]rebuttal|devils?[-_ ]advocate)/i;

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

  function memoryEnabled() {
    try { return W.localStorage?.getItem?.('latexai:memory-enabled') !== 'false'; } catch (_err) { return true; }
  }

  function memoryBase() {
    const fromSettings = NS.BackendUrlSettings?.getMemoryApiBaseUrl?.();
    if (fromSettings) return String(fromSettings).replace(/\/$/, '');
    const raw = clean(W.localStorage?.getItem?.('lumina-latex.memory.backendUrl')) || 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app';
    return raw.replace(/\/$/, '').replace(/\/api\/lumina\/memory\/?$/, '') + '/api/lumina/memory';
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
    const response = await fetch(`${memoryBase()}${path}`, {
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

  function getProject() { return NS.State?.state?.project || {}; }
  function getActiveFile() { try { return NS.State?.getActiveFile?.() || null; } catch (_err) { return null; } }

  function projectIdentity() {
    const fromReward = NS.RewardLoggingService?.projectIdentity?.();
    if (fromReward?.projectId && fromReward?.paperId) return fromReward;
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
    return {
      userId: 'local-user',
      projectId: project.projectId || project.id || `project_${stableHash(seed)}`,
      paperId: project.paperId || project.meta?.paperId || `paper_${stableHash(seed + ':' + (project.rootFile || activePath))}`,
      sectionId: activePath,
      sessionId: `session_${stableHash(String(W.location?.href || '') + ':' + seed)}`,
      identityMetadata: { owner, repo, branch, rootPath, activePath, title, stage: STAGE }
    };
  }

  function inferWorkflow(payload = {}, meta = {}) {
    return clean(meta.context?.workflow)
      || clean(payload.workflow)
      || clean(payload.citationWorkflow)
      || clean(payload.documentWorkflow)
      || clean(payload.presentationWorkflow)
      || clean(payload.imageWorkflow)
      || clean(payload.tikzWorkflow)
      || clean(meta.task)
      || clean(payload.task)
      || 'latex-copilot';
  }

  function inferTaskType(payload = {}, meta = {}) {
    return clean(meta.context?.taskType)
      || clean(meta.context?.stepName)
      || clean(payload.taskType)
      || clean(payload.stepName)
      || clean(payload.action)
      || clean(payload.mode)
      || clean(meta.task)
      || clean(payload.task)
      || 'ai_call';
  }

  function inferAgentRole(payload = {}, meta = {}) {
    const explicit = clean(meta.context?.agentRole || payload.agentRole || payload.role);
    if (explicit) return explicit;
    const haystack = [
      inferWorkflow(payload, meta),
      inferTaskType(payload, meta),
      meta.task,
      payload.task,
      payload.kind,
      payload.mode,
      payload.action,
      payload.prompt,
      payload.instruction,
      payload.question
    ].map((v) => String(v || '').toLowerCase()).join(' ');

    if (/citation|bibtex|bibliography|reference/.test(haystack)) return 'citation_auditor';
    if (/notation|symbol|macro|theorem|lemma|proof/.test(haystack)) return 'notation_auditor';
    if (/verify|verifier|validate|diagnostic|audit|check|compile|error/.test(haystack)) return 'evaluator';
    if (/review|critic|critique|weakness|risk|gap/.test(haystack)) return 'critic';
    if (/rebuttal|defend|response|author response/.test(haystack)) return 'defender';
    if (/synthesis|synthesizer|final plan|final revision/.test(haystack)) return 'editor';
    if (/rewrite|edit|polish|copilot|document|paper|tikz|figure|image|presentation|talk|slide/.test(haystack)) return 'editor';
    return 'editor';
  }

  function shouldSkipGenericLogging(payload = {}, meta = {}) {
    const workflow = inferWorkflow(payload, meta);
    const task = inferTaskType(payload, meta);
    const role = inferAgentRole(payload, meta);
    const haystack = `${workflow} ${task} ${role} ${meta.task || ''} ${payload.task || ''}`;
    return WIRED_WORKFLOW_RE.test(haystack);
  }

  function outputTextFromResponse(data) {
    try {
      if (typeof NS.AIProvider?.extractText === 'function') return NS.AIProvider.extractText(data || {}).slice(0, 12000);
    } catch (_err) {}
    if (typeof data?.text === 'string') return data.text.slice(0, 12000);
    if (typeof data?.output_text === 'string') return data.output_text.slice(0, 12000);
    try { return JSON.stringify(data || {}, null, 2).slice(0, 12000); } catch (_err) { return ''; }
  }

  function summarizeInput(payload = {}, meta = {}) {
    const pieces = [];
    const workflow = inferWorkflow(payload, meta);
    const taskType = inferTaskType(payload, meta);
    if (workflow) pieces.push(`workflow=${workflow}`);
    if (taskType) pieces.push(`task=${taskType}`);
    const textish = clean(payload.prompt || payload.question || payload.instruction || payload.text || payload.latex || payload.source || '');
    if (textish) pieces.push(textish.slice(0, 900));
    return pieces.join('\n').slice(0, 1600);
  }

  function memoryIdsFromAgentContext(contextJson) {
    const items = [];
    const buckets = [contextJson?.items, contextJson?.facts, contextJson?.memories, contextJson?.selectedFacts, contextJson?.contextItems];
    buckets.forEach((bucket) => {
      if (!Array.isArray(bucket)) return;
      bucket.forEach((item) => {
        if (typeof item === 'string') items.push(item);
        else if (item?.memoryId) items.push(String(item.memoryId));
        else if (item?.id) items.push(String(item.id));
      });
    });
    return Array.from(new Set(items.filter(Boolean)));
  }

  function rememberLastAgentRun(saved, inferred, contextJson, memoryIds) {
    if (!saved) return null;
    const record = {
      at: Date.now(),
      stage: STAGE,
      runId: saved.runId || saved.id || '',
      id: saved.id || saved.runId || '',
      contextBundleId: saved.contextBundleId || contextJson?.contextBundleId || contextJson?.bundleId || '',
      outputId: saved.outputId || '',
      workflow: inferred.workflow,
      taskType: inferred.taskType,
      agentRole: inferred.agentRole,
      memoryIds: Array.from(new Set((memoryIds || []).filter(Boolean))),
      status: saved.status || 'success'
    };
    try {
      W.sessionStorage?.setItem?.(LAST_AGENT_RUN_KEY, JSON.stringify(record));
      W.sessionStorage?.setItem?.(STAGE19I12_LAST_AGENT_RUN_KEY, JSON.stringify(record));
    } catch (_err) {}
    NS.__stage19i11LastGenericAgentRun = record;
    return record;
  }

  function getLastAgentRun(maxAgeMs = 12 * 60 * 1000) {
    const current = NS.__stage19i11LastGenericAgentRun;
    if (current?.at && Date.now() - current.at <= maxAgeMs) return current;
    try {
      const parsed = JSON.parse(W.sessionStorage?.getItem?.(LAST_AGENT_RUN_KEY) || W.sessionStorage?.getItem?.(STAGE19I12_LAST_AGENT_RUN_KEY) || 'null');
      if (parsed?.at && Date.now() - parsed.at <= maxAgeMs) return parsed;
    } catch (_err) {}
    return null;
  }

  async function requestRoleContext(payload, meta, inferred) {
    try {
      const ids = projectIdentity();
      const query = summarizeInput(payload, meta) || `${inferred.workflow} ${inferred.taskType}`;
      const req = {
        scope: 'paper',
        userId: ids.userId,
        projectId: ids.projectId,
        paperId: ids.paperId,
        sectionId: ids.sectionId,
        sessionId: ids.sessionId,
        workflow: inferred.workflow,
        taskType: inferred.taskType,
        agentRole: inferred.agentRole,
        query,
        limit: 6,
        metadata: { stage: STAGE, genericAiWorkflowMemoryWiring: true, ...(ids.identityMetadata || {}) }
      };
      const json = await memoryPost('/agent-context', req);
      return json || null;
    } catch (err) {
      try { console.warn('[Latexai 19I11 AI workflow memory] agent-context failed', err); } catch (_ignored) {}
      return null;
    }
  }

  async function logGenericAgentRun(payload, meta, inferred, result, contextJson, status, errorMessage, startedAt) {
    try {
      const ids = projectIdentity();
      const outputText = status === 'success' ? outputTextFromResponse(result) : '';
      const memoryIds = memoryIdsFromAgentContext(contextJson);
      const req = {
        scope: 'paper',
        userId: ids.userId,
        projectId: ids.projectId,
        paperId: ids.paperId,
        sectionId: ids.sectionId,
        sessionId: ids.sessionId,
        workflow: inferred.workflow,
        agentRole: inferred.agentRole,
        taskType: inferred.taskType,
        stepName: inferred.taskType,
        promptTemplateId: `generic-ai-workflow:${inferred.workflow}:${inferred.agentRole}`,
        promptTemplateVersion: STAGE,
        modelProvider: meta.provider || payload.provider || '',
        modelName: meta.model || payload.model || '',
        status,
        inputSummary: summarizeInput(payload, meta),
        outputSummary: outputText.slice(0, 1200),
        outputText,
        errorMessage: errorMessage || '',
        latencyMs: Date.now() - startedAt,
        tokenEstimate: Math.round((summarizeInput(payload, meta).length + outputText.length) / 4),
        contextBundle: {
          source: 'stage19i11-generic-wrapper',
          agentContextResponse: contextJson || null,
          memoryIds,
          items: Array.isArray(contextJson?.items) ? contextJson.items : []
        },
        memoryIds,
        metadata: {
          stage: STAGE,
          genericAiWorkflowMemoryWiring: true,
          payloadKeys: Object.keys(payload || {}).slice(0, 80),
          metaTask: meta.task || '',
          ...(ids.identityMetadata || {})
        }
      };
      const saved = await memoryPost('/agent-run', req);
      if (status === 'success') rememberLastAgentRun(saved, inferred, contextJson, memoryIds);
      if (status === 'success') {
        try {
          await NS.RewardLoggingService?.logReward?.('generic_ai_workflow_success', 0.15, {
            workflow: inferred.workflow,
            stepName: inferred.taskType,
            relatedAgentRunId: saved?.runId || saved?.id || '',
            memoryIds,
            metadata: { stage: STAGE, agentRole: inferred.agentRole }
          });
        } catch (_err) {}
      }
      return saved;
    } catch (err) {
      try { console.warn('[Latexai 19I11 AI workflow memory] agent-run failed', err); } catch (_ignored) {}
      return null;
    }
  }

  function augmentMetaWithContext(meta, contextJson, inferred) {
    if (!contextJson) return meta;
    const memoryIds = memoryIdsFromAgentContext(contextJson);
    return {
      ...(meta || {}),
      context: {
        ...((meta || {}).context || {}),
        workflow: ((meta || {}).context || {}).workflow || inferred.workflow,
        taskType: ((meta || {}).context || {}).taskType || inferred.taskType,
        agentRole: ((meta || {}).context || {}).agentRole || inferred.agentRole,
        stage19i11MemoryContext: {
          source: 'ai-workflow-memory-service',
          stage: STAGE,
          memoryIds,
          contextBundleId: contextJson.contextBundleId || contextJson.bundleId || '',
          selectedCount: memoryIds.length,
          items: Array.isArray(contextJson.items) ? contextJson.items.slice(0, 6) : []
        }
      }
    };
  }

  function installWrapper() {
    if (!NS.AIProvider?.ask || NS.AIProvider.__stage19i11MemoryWrapped) return false;
    const originalAsk = NS.AIProvider.ask.bind(NS.AIProvider);
    NS.AIProvider.ask = async function stage19i11MemoryAwareAsk(payload = {}, meta = {}) {
      if (!memoryEnabled() || shouldSkipGenericLogging(payload, meta)) {
        return originalAsk(payload, meta);
      }
      const startedAt = Date.now();
      const inferred = {
        workflow: inferWorkflow(payload, meta),
        taskType: inferTaskType(payload, meta),
        agentRole: inferAgentRole(payload, meta)
      };
      const contextJson = await requestRoleContext(payload, meta, inferred);
      const augmentedMeta = augmentMetaWithContext(meta, contextJson, inferred);
      try {
        const result = await originalAsk(payload, augmentedMeta);
        await logGenericAgentRun(payload, augmentedMeta, inferred, result, contextJson, 'success', '', startedAt);
        return result;
      } catch (err) {
        await logGenericAgentRun(payload, augmentedMeta, inferred, null, contextJson, 'failed', err?.message || String(err || ''), startedAt);
        throw err;
      }
    };
    NS.AIProvider.__stage19i11MemoryWrapped = true;
    return true;
  }

  function init() {
    if (installWrapper()) return;
    let tries = 0;
    const timer = W.setInterval(() => {
      tries += 1;
      if (installWrapper() || tries > 50) W.clearInterval(timer);
    }, 100);
  }

  NS.AIWorkflowMemoryService = {
    STAGE,
    init,
    inferWorkflow,
    inferTaskType,
    inferAgentRole,
    shouldSkipGenericLogging,
    requestRoleContext,
    getLastAgentRun
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
