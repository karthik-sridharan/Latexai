/* Latexai Stage 17O AiRevisionHistoryService
 * Stage: stage17o-lai-review-integration-for-devils-competitive-1
 *
 * AI revision history + revert/compare.
 *
 * Local snapshot store:
 * - creates snapshots of the current project before AI-applied edits;
 * - compares active/current project against a selected snapshot;
 * - restores selected snapshot;
 * - writes/copies revision reports.
 *
 * This service is local-only: no AI calls and no compile jobs.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage17o-lai-review-integration-for-devils-competitive-1';
  const STORAGE_KEY = 'latexai:ai-revision-history:v1';
  const MAX_SNAPSHOTS = 25;
  const MAX_FILE_CHARS = 250000;

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('ai-revision-history-service')) {
    NS.AiRevisionHistoryService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false,
      createSnapshot: () => null
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  let lastReport = '';
  let wrapped = false;

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

  function projectFiles() {
    return Array.isArray(project().files) ? project().files : [];
  }

  function fileText(file) {
    if (!file) return '';
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function fileKind(file) {
    if (!file) return 'text';
    return file.kind || file.type || (/\.(png|jpe?g|gif|webp|pdf|svg|eps)$/i.test(file.path || '') ? 'asset' : 'text');
  }

  function activePath() {
    const candidates = [
      State()?.state?.activePath,
      State()?.state?.activeFilePath,
      State()?.state?.currentPath,
      project()?.activePath,
      project()?.activeFilePath,
      project()?.rootFile,
      clean(el('activeFilePill')?.textContent)
    ];
    for (const candidate of candidates) if (candidate) return normalizePath(candidate);
    return 'main.tex';
  }

  function rootPath() {
    return normalizePath(project()?.rootFile || projectFiles().find((f) => /main\.tex$/i.test(f.path || ''))?.path || 'main.tex');
  }

  function readStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        schema: 'latexai-ai-revision-history-store-v1',
        snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : []
      };
    } catch (_err) {
      return { schema: 'latexai-ai-revision-history-store-v1', snapshots: [] };
    }
  }

  function writeStore(store) {
    const snapshots = (store.snapshots || []).slice(0, MAX_SNAPSHOTS);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ schema: 'latexai-ai-revision-history-store-v1', snapshots })); } catch (_err) {}
    return { schema: 'latexai-ai-revision-history-store-v1', snapshots };
  }

  function snapshotFiles() {
    return projectFiles()
      .filter((file) => file?.path)
      .map((file) => {
        const text = fileText(file);
        return {
          path: normalizePath(file.path),
          kind: fileKind(file),
          text: text.length > MAX_FILE_CHARS ? text.slice(0, MAX_FILE_CHARS) : text,
          truncated: text.length > MAX_FILE_CHARS,
          length: text.length
        };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  function createSnapshot(label = 'Manual snapshot', reason = 'manual') {
    const files = snapshotFiles();
    const snapshot = {
      schema: 'latexai-ai-revision-snapshot-v1',
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      stage: STAGE,
      appStage: W.LUMINA_LATEX_STAGE || '',
      createdAt: new Date().toISOString(),
      label: clean(label) || 'Snapshot',
      reason: clean(reason) || 'manual',
      rootPath: rootPath(),
      activePath: activePath(),
      fileCount: files.length,
      files
    };

    const store = readStore();
    store.snapshots.unshift(snapshot);
    writeStore(store);
    renderSnapshotList();
    setStatus(`Snapshot created: ${snapshot.label}`);
    return snapshot;
  }

  function getSnapshot(id) {
    return readStore().snapshots.find((snapshot) => snapshot.id === id) || null;
  }

  function selectedSnapshot() {
    const id = el('aiRevisionSnapshotSelect')?.value || '';
    return getSnapshot(id);
  }

  function currentFileMap() {
    return new Map(snapshotFiles().map((file) => [file.path, file]));
  }

  function snapshotFileMap(snapshot) {
    return new Map((snapshot?.files || []).map((file) => [normalizePath(file.path), file]));
  }

  function lineCount(text) {
    return String(text || '').split(/\r?\n/).length;
  }

  function changedLineEstimate(a, b) {
    const aa = String(a || '').split(/\r?\n/);
    const bb = String(b || '').split(/\r?\n/);
    const max = Math.max(aa.length, bb.length);
    let changed = 0;
    for (let i = 0; i < max; i += 1) {
      if ((aa[i] || '') !== (bb[i] || '')) changed += 1;
    }
    return changed;
  }

  function diffSnapshot(snapshot = selectedSnapshot()) {
    if (!snapshot) return { ok: false, error: 'No snapshot selected.' };

    const before = snapshotFileMap(snapshot);
    const after = currentFileMap();
    const paths = [...new Set([...before.keys(), ...after.keys()])].sort();

    const changed = [];
    const added = [];
    const removed = [];
    const unchanged = [];

    for (const path of paths) {
      const oldFile = before.get(path);
      const newFile = after.get(path);
      if (oldFile && !newFile) {
        removed.push({ path, beforeLines: lineCount(oldFile.text), afterLines: 0 });
      } else if (!oldFile && newFile) {
        added.push({ path, beforeLines: 0, afterLines: lineCount(newFile.text) });
      } else if (oldFile.text !== newFile.text) {
        changed.push({
          path,
          beforeLines: lineCount(oldFile.text),
          afterLines: lineCount(newFile.text),
          changedLineEstimate: changedLineEstimate(oldFile.text, newFile.text)
        });
      } else {
        unchanged.push({ path, lines: lineCount(oldFile.text) });
      }
    }

    return {
      ok: true,
      schema: 'latexai-ai-revision-diff-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      snapshot: {
        id: snapshot.id,
        label: snapshot.label,
        reason: snapshot.reason,
        createdAt: snapshot.createdAt,
        fileCount: snapshot.fileCount
      },
      current: {
        rootPath: rootPath(),
        activePath: activePath(),
        fileCount: after.size
      },
      summary: {
        changed: changed.length,
        added: added.length,
        removed: removed.length,
        unchanged: unchanged.length
      },
      changed,
      added,
      removed,
      unchanged
    };
  }

  function formatDiffReport(diff) {
    if (!diff?.ok) return diff?.error || 'No diff available.';
    const lines = [
      'Latexai AI revision diff',
      '========================',
      '',
      `Generated: ${diff.generatedAt}`,
      `Snapshot: ${diff.snapshot.label}`,
      `Snapshot ID: ${diff.snapshot.id}`,
      `Snapshot time: ${diff.snapshot.createdAt}`,
      `Reason: ${diff.snapshot.reason}`,
      '',
      'Summary',
      '-------',
      `Changed files: ${diff.summary.changed}`,
      `Added files: ${diff.summary.added}`,
      `Removed files: ${diff.summary.removed}`,
      `Unchanged files: ${diff.summary.unchanged}`,
      '',
      'Changed files',
      '-------------'
    ];

    if (diff.changed.length) {
      for (const item of diff.changed) {
        lines.push(`- ${item.path}: ${item.beforeLines} → ${item.afterLines} lines; approx changed lines: ${item.changedLineEstimate}`);
      }
    } else lines.push('- none');

    lines.push('', 'Added files', '-----------');
    if (diff.added.length) diff.added.forEach((item) => lines.push(`- ${item.path}: ${item.afterLines} lines`));
    else lines.push('- none');

    lines.push('', 'Removed files', '-------------');
    if (diff.removed.length) diff.removed.forEach((item) => lines.push(`- ${item.path}: ${item.beforeLines} lines`));
    else lines.push('- none');

    return lines.join('\n');
  }

  function compareSelectedSnapshot() {
    const diff = diffSnapshot(selectedSnapshot());
    lastReport = formatDiffReport(diff);
    setOutput(lastReport);
    setStatus(diff.ok ? `Compared against ${diff.snapshot.label}.` : diff.error);
    return diff;
  }

  function restoreSnapshot(snapshot = selectedSnapshot()) {
    if (!snapshot) {
      setStatus('No snapshot selected.');
      return { ok: false, error: 'No snapshot selected.' };
    }

    const p = project();
    p.files = (snapshot.files || []).map((file) => ({
      path: file.path,
      text: file.text,
      kind: file.kind || 'text'
    }));
    p.rootFile = snapshot.rootPath || p.rootFile || 'main.tex';
    p.activePath = snapshot.activePath || p.rootFile;

    try { State()?.save?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}

    const active = (snapshot.files || []).find((file) => normalizePath(file.path) === normalizePath(snapshot.activePath)) || snapshot.files?.[0];
    const editor = el('sourceEditor');
    if (editor && active) {
      editor.value = active.text || '';
      try { editor.dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    }

    renderSnapshotList();
    setStatus(`Restored snapshot: ${snapshot.label}`);
    return { ok: true, snapshotId: snapshot.id };
  }

  function deleteSnapshot(id = el('aiRevisionSnapshotSelect')?.value) {
    if (!id) {
      setStatus('No snapshot selected.');
      return false;
    }
    const store = readStore();
    const before = store.snapshots.length;
    store.snapshots = store.snapshots.filter((snapshot) => snapshot.id !== id);
    writeStore(store);
    renderSnapshotList();
    setStatus(before === store.snapshots.length ? 'Snapshot not found.' : 'Snapshot deleted.');
    return before !== store.snapshots.length;
  }

  function snapshotReport() {
    const store = readStore();
    const lines = [
      'Latexai AI revision history',
      '===========================',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Snapshots: ${store.snapshots.length}`,
      ''
    ];

    for (const snapshot of store.snapshots) {
      lines.push(`- ${snapshot.createdAt} · ${snapshot.label} · ${snapshot.reason} · ${snapshot.fileCount} file(s) · ${snapshot.id}`);
    }

    return lines.join('\n');
  }

  function createManualSnapshot() {
    const label = clean(el('aiRevisionSnapshotLabel')?.value) || 'Manual snapshot';
    return createSnapshot(label, 'manual');
  }

  async function copyRevisionReport() {
    const text = lastReport || snapshotReport();
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Revision report copied.');
    } catch (_err) {
      setOutput(text);
      setStatus('Could not copy automatically. Report shown below.');
    }
  }

  function writeRevisionReportToProject() {
    const text = lastReport || snapshotReport();
    const date = new Date().toISOString().slice(0, 10);
    const path = normalizePath(`reviews/ai-revision-history-${date}.md`);
    const p = project();
    p.files = p.files || [];
    const existing = p.files.find((file) => normalizePath(file.path) === path);
    if (existing) existing.text = text + '\n';
    else p.files.push({ path, text: text + '\n', kind: 'text' });
    try { State()?.save?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    setStatus(`Added revision report to ${path}.`);
    return path;
  }

  function beforeAiMutation(label, reason) {
    return createSnapshot(label, reason);
  }

  function afterAiMutation(label, reason) {
    const snapshot = createSnapshot(label, reason);
    const diff = diffSnapshot(snapshot);
    return { snapshot, diff };
  }

  function wrapMethod(serviceName, methodName, beforeLabel, beforeReason) {
    const service = NS[serviceName];
    if (!service || typeof service[methodName] !== 'function') return false;
    const original = service[methodName];
    if (original.stage16eWrapped) return true;

    const wrappedMethod = function (...args) {
      beforeAiMutation(beforeLabel, beforeReason);
      const result = original.apply(this, args);
      if (result && typeof result.then === 'function') {
        return result.then((value) => {
          renderSnapshotList();
          return value;
        });
      }
      renderSnapshotList();
      return result;
    };
    wrappedMethod.stage16eWrapped = true;
    service[methodName] = wrappedMethod;
    return true;
  }

  function installAiMutationHooks() {
    if (wrapped) return true;
    const hooks = [
      ['PaperAiPolishService', 'applyChoices', 'Before applying paper AI selected edits', 'paper-ai-apply-selected'],
      ['PaperAiPolishService', 'acceptAllNew', 'Before accepting all paper AI new content', 'paper-ai-accept-all-new'],
      ['PaperAiPolishService', 'rejectAllKeepOld', 'Before rejecting all paper AI new content', 'paper-ai-reject-all-keep-old'],
      ['CompetitivePaperReviewService', 'insertRoadmapComment', 'Before appending competitive \\lai plan', 'competitive-lai-plan-append'],
      ['CompetitivePaperReviewService', 'appendLaiImprovementPlan', 'Before appending competitive \\lai plan', 'competitive-lai-plan-append'],
      ['CompetitivePaperReviewService', 'insertActionableEditsAtMatches', 'Before inserting competitive inline \\lai edits', 'competitive-lai-inline-insert'],
      ['CompetitivePaperReviewService', 'addReportToProject', 'Before adding competitive review report', 'competitive-review-report-add'],
      ['RealAgentBranchWorkflowService', 'insertImprovementPlan', 'Before appending devil’s advocate \\lai plan', 'devils-lai-plan-append'],
      ['RealAgentBranchWorkflowService', 'appendLaiImprovementPlan', 'Before appending devil’s advocate \\lai plan', 'devils-lai-plan-append'],
      ['RealAgentBranchWorkflowService', 'insertActionableEditsAtMatches', 'Before inserting devil’s advocate inline \\lai edits', 'devils-lai-inline-insert'],
      ['RealAgentBranchWorkflowService', 'addReportToProject', 'Before adding Devil’s Advocate branch-runner report', 'devils-report-add']
    ];

    let any = false;
    for (const hook of hooks) {
      if (wrapMethod(...hook)) any = true;
    }
    wrapped = any;
    return any;
  }

  function renderSnapshotList() {
    const select = el('aiRevisionSnapshotSelect');
    if (select) {
      const current = select.value;
      const snapshots = readStore().snapshots;
      select.innerHTML = snapshots.length
        ? snapshots.map((snapshot) => `<option value="${escapeHtml(snapshot.id)}">${escapeHtml(snapshot.createdAt.slice(0, 19).replace('T', ' '))} · ${escapeHtml(snapshot.label)}</option>`).join('')
        : '<option value="">No snapshots yet</option>';
      if (current && snapshots.some((snapshot) => snapshot.id === current)) select.value = current;
    }

    const count = el('aiRevisionSnapshotCount');
    if (count) count.textContent = `${readStore().snapshots.length} snapshot(s)`;

    installAiMutationHooks();
  }

  function setStatus(message) {
    const node = el('aiRevisionStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const out = el('aiRevisionOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = String(text || '');
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function createCard() {
    const settings = el('settingsTab') || el('copilotTab') || D.querySelector('.right-panel');
    if (!settings || el('aiRevisionCard')) return false;

    const card = D.createElement('div');
    card.id = 'aiRevisionCard';
    card.className = 'ai-revision-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Revisions</div>',
      '    <h2>AI revision history</h2>',
      '  </div>',
      '</div>',
      '<p class="ai-revision-help">Create local snapshots before AI edits, compare against snapshots, and restore if an AI change goes wrong.</p>',
      '<div class="ai-revision-grid">',
      '  <label class="field">Snapshot label',
      '    <input id="aiRevisionSnapshotLabel" type="text" placeholder="e.g. Before competitive rewrite" />',
      '  </label>',
      '  <label class="field">Saved snapshots',
      '    <select id="aiRevisionSnapshotSelect"></select>',
      '  </label>',
      '</div>',
      '<div id="aiRevisionSnapshotCount" class="ai-revision-count">0 snapshot(s)</div>',
      '<div class="ai-revision-actions">',
      '  <button id="createAiSnapshotBtn" class="btn mini primary" type="button">Create snapshot</button>',
      '  <button id="refreshAiSnapshotsBtn" class="btn mini" type="button">View snapshots</button>',
      '  <button id="compareAiSnapshotBtn" class="btn mini" type="button">Compare selected snapshot</button>',
      '  <button id="restoreAiSnapshotBtn" class="btn mini" type="button">Restore selected snapshot</button>',
      '  <button id="deleteAiSnapshotBtn" class="btn mini" type="button">Delete snapshot</button>',
      '</div>',
      '<div class="ai-revision-actions">',
      '  <button id="copyAiRevisionReportBtn" class="btn mini" type="button">Copy revision report</button>',
      '  <button id="addAiRevisionReportBtn" class="btn mini" type="button">Add report to /reviews</button>',
      '</div>',
      '<div id="aiRevisionStatus" class="settings-note">AI revision history ready.</div>',
      '<pre id="aiRevisionOutput" class="ai-revision-output"></pre>'
    ].join('');

    const featureCard = el('featureFlagCard');
    if (featureCard?.parentElement === settings) settings.insertBefore(card, featureCard.nextSibling);
    else settings.appendChild(card);

    el('createAiSnapshotBtn')?.addEventListener('click', createManualSnapshot, true);
    el('refreshAiSnapshotsBtn')?.addEventListener('click', () => {
      renderSnapshotList();
      setOutput(snapshotReport());
      setStatus('Snapshot list refreshed.');
    }, true);
    el('compareAiSnapshotBtn')?.addEventListener('click', compareSelectedSnapshot, true);
    el('restoreAiSnapshotBtn')?.addEventListener('click', () => restoreSnapshot(selectedSnapshot()), true);
    el('deleteAiSnapshotBtn')?.addEventListener('click', () => deleteSnapshot(), true);
    el('copyAiRevisionReportBtn')?.addEventListener('click', copyRevisionReport, true);
    el('addAiRevisionReportBtn')?.addEventListener('click', writeRevisionReportToProject, true);

    renderSnapshotList();
    return true;
  }

  function init() {
    createCard();
    installAiMutationHooks();
  }

  NS.AiRevisionHistoryService = {
    STAGE,
    init,
    createSnapshot,
    beforeAiMutation,
    afterAiMutation,
    diffSnapshot,
    compareSelectedSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    snapshotReport,
    installAiMutationHooks,
    getSnapshots: () => readStore().snapshots,
    getLastReport: () => lastReport
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  setTimeout(init, 1000);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
