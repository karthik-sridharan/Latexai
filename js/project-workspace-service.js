/* Latexai Stage 19W41 Project Workspace Service
 *
 * A project is now treated as more than the currently loaded TeX files.
 * This service computes a stable GitHub/project/paper identity, scans repo-local
 * artifacts such as /reviews and /.latexai, and asks the memory backend for a
 * scoped restore summary whenever a GitHub project is opened or created.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19w42-project-actions-workspace-ui-20260605-1';
  const LAST_RESTORE_KEY = 'lumina-latex.project-workspace.last-restore.v1';

  let initialized = false;
  let restoring = false;
  let lastStatus = 'Not restored yet.';

  function State() { return NS.State; }
  function clean(value) { return String(value || '').trim(); }
  function normalizePath(path) { return NS.ProjectModel?.normalizePath?.(path) || clean(path).replace(/^\/+/, '').replace(/\/+/g, '/'); }
  function nowIso() { return new Date().toISOString(); }

  function stableHash(value) {
    const text = String(value || '');
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function fileText(file) {
    return String(file?.text ?? file?.content ?? '');
  }

  function guessTitle(project) {
    const root = normalizePath(project?.rootFile || project?.activePath || 'main.tex');
    const files = Array.isArray(project?.files) ? project.files : [];
    const rootFile = files.find((file) => normalizePath(file.path) === root) || files.find((file) => /\.tex$/i.test(file.path || ''));
    const text = fileText(rootFile);
    const match = text.match(/\\title\s*(?:\[[^\]]*\])?\s*\{([\s\S]{0,500}?)\}/);
    if (match) return clean(match[1].replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, '').replace(/[{}]/g, ''));
    return clean(project?.title || project?.name || 'LatexAI Project');
  }

  function githubInfo(project) {
    const gh = project?.github || project?.meta?.github || {};
    return {
      owner: clean(gh.owner),
      repo: clean(gh.repo),
      branch: clean(gh.branch || 'main') || 'main',
      rootPath: normalizePath(gh.rootPath || ''),
      headSha: clean(gh.headSha || gh.commitSha || ''),
      htmlUrl: clean(gh.htmlUrl || gh.repoUrl || '')
    };
  }

  function computeIdentity(projectInput) {
    const project = projectInput || State()?.state?.project || {};
    const gh = githubInfo(project);
    const rootFile = normalizePath(project.rootFile || project.mainFile || project.activePath || 'main.tex');
    const titleGuess = guessTitle(project);
    const activePath = normalizePath(project.activePath || rootFile);
    const fileCount = Array.isArray(project.files) ? project.files.length : 0;
    let projectId = clean(project.projectId || project.id || '');
    let paperId = clean(project.paperId || project.meta?.paperId || '');
    let projectKey = '';
    let paperKey = '';
    if (gh.owner && gh.repo) {
      projectKey = `github:${gh.owner.toLowerCase()}/${gh.repo.toLowerCase()}:${gh.rootPath}`;
      paperKey = `github:${gh.owner.toLowerCase()}/${gh.repo.toLowerCase()}:${gh.branch}:${gh.rootPath}:${rootFile}:${titleGuess}`;
      projectId = projectId || `github-project-${stableHash(projectKey)}`;
      paperId = paperId || `github-paper-${stableHash(paperKey)}`;
    } else {
      projectKey = `local:${projectId || project.name || titleGuess}`;
      paperKey = `${projectKey}:${rootFile}:${titleGuess}`;
      projectId = projectId || `local-project-${stableHash(projectKey)}`;
      paperId = paperId || `local-paper-${stableHash(paperKey)}`;
    }
    const sessionId = `session_${stableHash(`${W.location?.origin || ''}:${projectId}:${paperId}`)}`;
    return { project, github: gh, projectId, paperId, projectKey, paperKey, sessionId, rootFile, activePath, titleGuess, fileCount, stage: STAGE };
  }

  function reportArtifacts(projectInput) {
    const project = projectInput || State()?.state?.project || {};
    const files = Array.isArray(project.files) ? project.files : [];
    const reviewFiles = [];
    const workflowFiles = [];
    const checkpointFiles = [];
    const metadataFiles = [];
    for (const file of files) {
      const path = normalizePath(file.path || '');
      const lower = path.toLowerCase();
      if (!path) continue;
      if (/^(reviews|review|reports)\//.test(lower) || /(^|\/)reviews\//.test(lower)) reviewFiles.push(path);
      if (/^(\.latexai|latexai)\//.test(lower) || /(^|\/)(workflow|workflows|agent-runs|ai-runs)\//.test(lower)) workflowFiles.push(path);
      if (/^(checkpoints|\.latexai\/checkpoints|latexai\/checkpoints)\//.test(lower)) checkpointFiles.push(path);
      if (/^(\.latexai|latexai)\/project\.(json|md|yaml|yml)$/i.test(path)) metadataFiles.push(path);
    }
    reviewFiles.sort(); workflowFiles.sort(); checkpointFiles.sort(); metadataFiles.sort();
    return {
      reviews: reviewFiles,
      workflows: workflowFiles,
      checkpoints: checkpointFiles,
      metadata: metadataFiles,
      counts: {
        reviews: reviewFiles.length,
        workflows: workflowFiles.length,
        checkpoints: checkpointFiles.length,
        metadata: metadataFiles.length
      }
    };
  }

  function memoryBase() {
    const fromSettings = NS.BackendUrlSettings?.getMemoryApiBaseUrl?.();
    if (fromSettings) return String(fromSettings).replace(/\/$/, '');
    return 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/memory';
  }

  function memoryHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = NS.BackendUrlSettings?.getMemoryProxyToken?.() || '';
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async function memoryPost(path, payload) {
    const url = `${memoryBase()}${path}`;
    const response = await fetch(url, { method: 'POST', headers: memoryHeaders(), body: JSON.stringify(payload || {}) });
    const text = await response.text().catch(() => '');
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (_err) { json = { raw: text }; }
    if (!response.ok || json.ok === false) throw new Error(json.detail || json.message || json.raw || `HTTP ${response.status}`);
    return json;
  }

  function summarizeRestore(restore) {
    const ws = restore?.workspace || restore || {};
    const counts = ws.counts || {};
    const artifacts = ws.artifacts?.counts || ws.artifactCounts || {};
    return {
      ok: restore?.ok !== false,
      stage: restore?.stage || ws.stage || '',
      restoredAt: restore?.restoredAt || ws.restoredAt || nowIso(),
      memory: {
        facts: Number(counts.facts || 0),
        events: Number(counts.events || 0),
        summaries: Number(counts.summaries || 0),
        agentRuns: Number(counts.agentRuns || 0),
        contextBundles: Number(counts.contextBundles || 0),
        debateTrajectories: Number(counts.debateTrajectories || 0),
        editOutcomes: Number(counts.editOutcomes || 0),
        rewardEvents: Number(counts.rewardEvents || 0)
      },
      artifacts: {
        reviews: Number(artifacts.reviews || 0),
        workflows: Number(artifacts.workflows || 0),
        checkpoints: Number(artifacts.checkpoints || 0),
        metadata: Number(artifacts.metadata || 0)
      },
      recent: ws.recent || {},
      scopeKeys: ws.scopeKeys || []
    };
  }

  function persistRestore(identity, artifacts, restore, statusText) {
    const state = State();
    const project = state?.state?.project;
    if (!project) return null;
    const summary = summarizeRestore(restore || {});
    const record = {
      schema: 'lumina-latex-project-workspace-v1',
      stage: STAGE,
      restoredAt: nowIso(),
      status: statusText || (summary.ok ? 'restored' : 'restore-unavailable'),
      identity: {
        projectId: identity.projectId,
        paperId: identity.paperId,
        projectKey: identity.projectKey,
        paperKey: identity.paperKey,
        sessionId: identity.sessionId,
        rootFile: identity.rootFile,
        activePath: identity.activePath,
        titleGuess: identity.titleGuess,
        fileCount: identity.fileCount,
        github: identity.github
      },
      artifacts,
      restore: summary
    };
    project.projectId = identity.projectId;
    project.id = identity.projectId;
    project.paperId = identity.paperId;
    project.meta = Object.assign({}, project.meta || {}, {
      paperId: identity.paperId,
      projectWorkspace: record,
      projectWorkspaceStage: STAGE
    });
    try { W.sessionStorage?.setItem?.(LAST_RESTORE_KEY, JSON.stringify(record)); } catch (_err) {}
    try { state.save?.(); } catch (_err) {}
    return record;
  }

  async function restoreForProject(projectInput = null, options = {}) {
    const stateProject = projectInput || State()?.state?.project || null;
    if (!stateProject) return { ok: false, error: 'No active project' };
    const identity = computeIdentity(stateProject);
    const artifacts = reportArtifacts(stateProject);
    const payload = {
      userId: options.userId || 'local-user',
      projectId: identity.projectId,
      paperId: identity.paperId,
      sessionId: identity.sessionId,
      scope: 'paper',
      titleGuess: identity.titleGuess,
      rootFile: identity.rootFile,
      activePath: identity.activePath,
      fileCount: identity.fileCount,
      github: identity.github,
      projectKey: identity.projectKey,
      paperKey: identity.paperKey,
      artifacts: {
        counts: artifacts.counts,
        reviews: artifacts.reviews.slice(0, 80),
        workflows: artifacts.workflows.slice(0, 80),
        checkpoints: artifacts.checkpoints.slice(0, 80),
        metadata: artifacts.metadata.slice(0, 80)
      },
      metadata: { stage: STAGE, source: options.source || options.reason || 'project-workspace-restore' }
    };

    restoring = true;
    lastStatus = 'Restoring project memory…';
    render(stateProject);
    try {
      const restored = await memoryPost('/project-restore', payload);
      const record = persistRestore(identity, artifacts, restored, 'restored');
      lastStatus = 'Project memory restored.';
      render(State()?.state?.project || stateProject);
      return { ok: true, identity, artifacts, restored, record };
    } catch (err) {
      const fallback = { ok: false, error: err?.message || String(err), workspace: { counts: {}, artifacts } };
      const record = persistRestore(identity, artifacts, fallback, 'memory-backend-unavailable');
      lastStatus = `Memory restore unavailable: ${err?.message || err}`;
      render(State()?.state?.project || stateProject);
      if (!options.silent) console.warn('[Latexai project workspace] restore failed', err);
      return { ok: false, identity, artifacts, error: err?.message || String(err), record };
    } finally {
      restoring = false;
    }
  }

  function shortId(value) {
    const s = clean(value);
    if (!s) return '—';
    if (s.length <= 22) return s;
    return `${s.slice(0, 15)}…${s.slice(-5)}`;
  }

  function ensureCard() {
    let card = D.getElementById('projectWorkspaceCard');
    if (card) return card;
    const host = D.querySelector('.project-card') || D.getElementById('projectTitleDisplay')?.closest?.('section');
    if (!host) return null;
    card = D.createElement('div');
    card.id = 'projectWorkspaceCard';
    host.appendChild(card);
    return card;
  }

  function setText(el, text) { if (el) el.textContent = text; }

  function render(projectInput = null) {
    const card = ensureCard();
    if (!card) return;
    const project = projectInput || State()?.state?.project || {};
    const identity = computeIdentity(project);
    const artifacts = reportArtifacts(project);
    const record = project.meta?.projectWorkspace || null;
    const restore = record?.restore || {};
    const memory = restore.memory || {};
    const gh = identity.github;
    const repo = gh.owner && gh.repo ? `${gh.owner}/${gh.repo}${gh.rootPath ? '/' + gh.rootPath : ''} @ ${gh.branch || 'main'}` : 'Local project';
    const status = restoring ? 'Restoring…' : (record?.status === 'restored' ? 'Restored' : (record?.status === 'memory-backend-unavailable' ? 'Files loaded; memory unavailable' : 'Ready'));
    const statusClass = record?.status === 'restored' ? '#047857' : (record?.status === 'memory-backend-unavailable' ? '#92400e' : '#475569');
    card.style.cssText = 'margin-top:.65rem;border:1px solid rgba(59,130,246,.22);background:linear-gradient(180deg,rgba(239,246,255,.92),rgba(255,255,255,.82));border-radius:14px;padding:.7rem .75rem;font:12px system-ui;line-height:1.35;box-shadow:0 6px 18px rgba(15,23,42,.04);';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;">
        <div>
          <div class="smallcaps">Project workspace</div>
          <strong style="display:block;margin-top:2px;color:${statusClass}">${status}</strong>
        </div>
        <button id="projectWorkspaceRestoreBtn" class="btn mini" type="button">Restore</button>
      </div>
      <div style="margin-top:.45rem;color:#334155;word-break:break-word;">
        <div><strong>GitHub:</strong> <span id="projectWorkspaceRepo"></span></div>
        <div><strong>Root:</strong> <span id="projectWorkspaceRoot"></span></div>
        <div><strong>Project:</strong> <span id="projectWorkspaceProjectId"></span></div>
        <div><strong>Paper:</strong> <span id="projectWorkspacePaperId"></span></div>
      </div>
      <div style="margin-top:.45rem;display:grid;grid-template-columns:1fr 1fr;gap:.35rem;">
        <div style="background:rgba(255,255,255,.7);border-radius:10px;padding:.4rem;"><strong>${artifacts.counts.reviews}</strong><br><span>review/report files</span></div>
        <div style="background:rgba(255,255,255,.7);border-radius:10px;padding:.4rem;"><strong>${artifacts.counts.workflows}</strong><br><span>workflow/state files</span></div>
        <div style="background:rgba(255,255,255,.7);border-radius:10px;padding:.4rem;"><strong>${Number(memory.facts || 0)}</strong><br><span>memory facts</span></div>
        <div style="background:rgba(255,255,255,.7);border-radius:10px;padding:.4rem;"><strong>${Number(memory.agentRuns || 0)}</strong><br><span>agent runs</span></div>
      </div>
      <div style="margin-top:.45rem;color:#64748b;font-size:11px;white-space:pre-wrap;" id="projectWorkspaceStatus"></div>
      <div class="micro-actions" style="margin-top:.45rem;">
        <button id="projectWorkspaceCopyIdsBtn" class="btn mini" type="button">Copy IDs</button>
      </div>`;
    setText(D.getElementById('projectWorkspaceRepo'), repo);
    setText(D.getElementById('projectWorkspaceRoot'), identity.rootFile);
    setText(D.getElementById('projectWorkspaceProjectId'), shortId(identity.projectId));
    setText(D.getElementById('projectWorkspacePaperId'), shortId(identity.paperId));
    const recent = [];
    if (record?.restoredAt) recent.push(`Last restored: ${record.restoredAt}`);
    if (memory.debateTrajectories) recent.push(`Debate/review trajectories: ${memory.debateTrajectories}`);
    if (memory.summaries) recent.push(`Summaries: ${memory.summaries}`);
    if (!recent.length) recent.push(lastStatus || 'Workspace identity is ready. Press Restore to refresh memory counts.');
    setText(D.getElementById('projectWorkspaceStatus'), recent.join('\n'));
    D.getElementById('projectWorkspaceRestoreBtn')?.addEventListener('click', () => restoreForProject(State()?.state?.project, { source: 'manual-project-workspace-restore' }));
    D.getElementById('projectWorkspaceCopyIdsBtn')?.addEventListener('click', async () => {
      const data = { stage: STAGE, identity, artifacts: artifacts.counts, restore: record?.restore || null };
      const text = JSON.stringify(data, null, 2);
      try { await navigator.clipboard.writeText(text); NS.Main?.toast?.('Project workspace IDs copied.'); }
      catch (_err) { alert(text); }
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    render();
    try {
      State()?.subscribe?.((snapshot, reason) => {
        if (/^(load|reset|save|github|open-existing-github-project|github-project-opened|project-rename|active-file|file-)/.test(String(reason || ''))) {
          render(snapshot?.project || State()?.state?.project);
        }
      });
    } catch (_err) {}
  }

  function currentSummary() {
    const project = State()?.state?.project || {};
    return project.meta?.projectWorkspace || { identity: computeIdentity(project), artifacts: reportArtifacts(project) };
  }

  NS.ProjectWorkspaceService = {
    STAGE,
    init,
    render,
    restoreForProject,
    computeIdentity,
    reportArtifacts,
    currentSummary
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
})();
