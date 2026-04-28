(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

  let activePatch = null;

  function init() {
    document.getElementById('previewCopilotPatchBtn')?.addEventListener('click', () => {
      const text = document.getElementById('copilotOutput')?.textContent || '';
      const task = document.getElementById('copilotTask')?.value || 'raw-advice';
      proposeFromText(text, { task, source: 'manual-preview' });
    });
    document.getElementById('applyCopilotPatchBtn')?.addEventListener('click', applyActivePatch);
    document.getElementById('discardCopilotPatchBtn')?.addEventListener('click', discardPatch);
  }

  function isPatchWorkflow(task) {
    return /patch$/.test(String(task || '')) || ['fix-error-patch','rewrite-selection-patch','insert-section-patch','beamer-outline-patch','table-helper-patch'].includes(task);
  }

  function proposeFromText(rawText, meta = {}) {
    const task = meta.task || document.getElementById('copilotTask')?.value || 'raw-advice';
    const file = State().getActiveFile();
    const selection = NS.Editor?.getSelection?.() || { text: '', start: 0, end: 0 };
    const parsed = parseAiPatch(rawText);
    const candidate = normalizeCandidate(parsed, rawText, { task, file, selection, meta });
    activePatch = candidate;
    renderPatch(candidate);
    return candidate;
  }

  function parseAiPatch(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return null;
    const candidates = [];
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) candidates.push(fence[1].trim());
    candidates.push(text);
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(text.slice(firstBrace, lastBrace + 1));
    for (const item of candidates) {
      try {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (_err) {}
    }
    return null;
  }

  function normalizeCandidate(parsed, rawText, context) {
    const file = context.file || {};
    const selection = context.selection || { text: '', start: 0, end: 0 };
    const task = context.task || 'raw-advice';
    let summary = parsed?.summary || parsed?.explanation || '';
    let patch = parsed?.patch || (Array.isArray(parsed?.patches) ? parsed.patches[0] : null);
    if (patch && typeof patch === 'string') patch = { text: patch };
    if (!patch && parsed?.path && parsed?.text) patch = parsed;
    if (!patch) {
      patch = fallbackPatch(rawText, { task, file, selection });
      summary = summary || fallbackSummary(task, selection);
    }
    patch = Object.assign({}, patch);
    patch.path = State().normalizePath(patch.path || file.path || State().state.project.activePath || 'main.tex');
    patch.operation = normalizeOperation(patch.operation || patch.op || taskToOperation(task, selection));
    patch.text = cleanCopilotText(patch.text ?? patch.replacement ?? patch.content ?? rawText);
    if (patch.operation === 'find-replace') {
      patch.find = String(patch.find || selection.text || '');
      patch.replace = String(patch.replace ?? patch.text ?? '');
    }
    if (patch.operation === 'replace-selection') {
      patch.start = Number.isFinite(patch.start) ? patch.start : selection.start;
      patch.end = Number.isFinite(patch.end) ? patch.end : selection.end;
      patch.selectionText = selection.text || '';
    }
    return {
      schema: 'lumina-latex-ai-patch-v1',
      summary: summary || 'Copilot proposed a source edit.',
      task,
      path: patch.path,
      operation: patch.operation,
      patch,
      createdAt: new Date().toISOString()
    };
  }

  function fallbackPatch(rawText, { task, file, selection }) {
    const text = cleanCopilotText(rawText);
    if (task === 'raw-advice' || task === 'explain-log') {
      return { path: file?.path || 'main.tex', operation: 'insert-at-cursor', text: `% Copilot note:\n% ${text.split('\n').join('\n% ')}\n` };
    }
    if (selection.text) return { path: file?.path || 'main.tex', operation: 'replace-selection', text, start: selection.start, end: selection.end };
    return { path: file?.path || 'main.tex', operation: 'insert-at-cursor', text: '\n' + text + '\n' };
  }

  function fallbackSummary(task, selection) {
    if (task === 'fix-error-patch') return 'Patch inferred from Copilot response for the current compile diagnostic.';
    if (task === 'rewrite-selection-patch') return selection.text ? 'Patch will replace the current selection.' : 'No selection was active; patch will insert at cursor.';
    if (task === 'insert-section-patch') return 'Patch will insert a drafted section at the cursor.';
    if (task === 'beamer-outline-patch') return 'Patch will insert Beamer frame source.';
    if (task === 'table-helper-patch') return 'Patch will insert table or alignment LaTeX.';
    return 'Patch inferred from Copilot text.';
  }

  function normalizeOperation(value) {
    const op = String(value || '').toLowerCase().replace(/_/g, '-');
    if (['replace-selection','replace-file','insert-at-cursor','find-replace'].includes(op)) return op;
    if (op === 'insert') return 'insert-at-cursor';
    if (op === 'replace') return 'replace-selection';
    return 'insert-at-cursor';
  }

  function taskToOperation(task, selection) {
    if (task === 'rewrite-selection-patch') return selection.text ? 'replace-selection' : 'insert-at-cursor';
    if (task === 'fix-error-patch') return selection.text ? 'replace-selection' : 'insert-at-cursor';
    return 'insert-at-cursor';
  }

  function cleanCopilotText(text) {
    let out = String(text || '').trim();
    out = out.replace(/^```(?:latex|tex)?\s*/i, '').replace(/```$/i, '').trim();
    return out;
  }

  function renderPatch(candidate) {
    const review = document.getElementById('patchReview');
    const meta = document.getElementById('patchMeta');
    const summary = document.getElementById('patchSummary');
    const diff = document.getElementById('patchDiff');
    if (!review) return;
    review.classList.remove('hidden');
    if (meta) meta.textContent = `${candidate.operation} · ${candidate.path}`;
    if (summary) summary.textContent = candidate.summary || 'Review this patch before applying it.';
    if (diff) diff.textContent = buildPreview(candidate);
  }

  function buildPreview(candidate) {
    const file = State().getFile(candidate.path) || State().getActiveFile();
    const current = String(file?.text || '');
    const patch = candidate.patch || {};
    let before = '';
    let after = '';
    if (candidate.operation === 'replace-file') {
      before = current;
      after = patch.text || '';
    } else if (candidate.operation === 'find-replace') {
      before = patch.find || '';
      after = patch.replace ?? patch.text ?? '';
    } else if (candidate.operation === 'replace-selection') {
      const start = clamp(Number(patch.start ?? 0), 0, current.length);
      const end = clamp(Number(patch.end ?? start), start, current.length);
      before = current.slice(start, end) || patch.selectionText || '(empty selection)';
      after = patch.text || '';
    } else {
      before = '(insert at cursor)';
      after = patch.text || '';
    }
    return simpleDiff(before, after);
  }

  function simpleDiff(before, after) {
    const a = String(before || '').split('\n');
    const b = String(after || '').split('\n');
    const out = ['--- current', '+++ proposed'];
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      if (a[i] === b[i]) {
        if (a[i] !== undefined) out.push('  ' + a[i]);
      } else {
        if (a[i] !== undefined) out.push('- ' + a[i]);
        if (b[i] !== undefined) out.push('+ ' + b[i]);
      }
      if (out.length > 180) {
        out.push('… diff truncated …');
        break;
      }
    }
    return out.join('\n');
  }

  function applyActivePatch() {
    if (!activePatch) return false;
    const candidate = activePatch;
    const file = State().getFile(candidate.path);
    if (!file) {
      State().setLog(`Copilot patch target not found: ${candidate.path}`, [{ level: 'error', message: `Patch target not found: ${candidate.path}`, line: null }]);
      return false;
    }
    const patch = candidate.patch || {};
    if (State().state.project.activePath !== file.path) {
      State().setActivePath(file.path);
      NS.Editor?.render?.();
    }
    if (candidate.operation === 'replace-file') {
      State().updateFile(file.path, patch.text || '');
      NS.Editor?.render?.();
    } else if (candidate.operation === 'find-replace') {
      const current = String(file.text || '');
      const find = String(patch.find || '');
      if (!find || !current.includes(find)) {
        State().setLog('Copilot patch could not find the requested source text.', [{ level: 'error', message: 'Patch find text not found.', file: file.path, line: null }]);
        return false;
      }
      State().updateFile(file.path, current.replace(find, String(patch.replace ?? patch.text ?? '')));
      NS.Editor?.render?.();
    } else if (candidate.operation === 'replace-selection') {
      NS.Editor?.replaceRange?.(Number(patch.start || 0), Number(patch.end || 0), patch.text || '', true);
    } else {
      NS.Editor?.insertText?.('\n' + (patch.text || '') + '\n');
    }
    State().save();
    NS.Preview?.scheduleDraftPreview?.();
    NS.Main?.toast?.('Copilot patch applied.');
    discardPatch();
    return true;
  }

  function discardPatch() {
    activePatch = null;
    document.getElementById('patchReview')?.classList.add('hidden');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  NS.PatchManager = {
    init,
    isPatchWorkflow,
    proposeFromText,
    parseAiPatch,
    normalizeCandidate,
    applyActivePatch,
    discardPatch,
    getActivePatch: () => activePatch
  };
})();
