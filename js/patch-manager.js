/* Latexai Stage 6C PatchManager
 * Thin UI wrapper around PatchService. PatchService owns all source mutation.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;
  const STAGE = 'stage6abc-modular-selection-patchservice-1';

  let activePatch = null;

  function init() {
    document.getElementById('previewCopilotPatchBtn')?.addEventListener('click', () => {
      const text = document.getElementById('copilotOutput')?.textContent || '';
      const task = document.getElementById('copilotTask')?.value || 'raw-advice';
      proposeFromText(text, { task, source: 'manual-preview' });
    });
    document.getElementById('applyCopilotPatchBtn')?.addEventListener('click', () => applyActivePatch({ source: 'apply-button' }));
    document.getElementById('discardCopilotPatchBtn')?.addEventListener('click', discardPatch);
  }

  function isPatchWorkflow(task) {
    return /patch$/.test(String(task || '')) || ['fix-error-patch','rewrite-selection-patch','insert-section-patch','beamer-outline-patch','table-helper-patch'].includes(task);
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

  function cleanCopilotText(text) {
    return NS.PatchService?.extractReplacement?.(text) || String(text || '').trim();
  }

  function normalizeCandidate(parsed, rawText, context = {}) {
    const task = context.task || document.getElementById('copilotTask')?.value || 'raw-advice';
    const file = context.file || State().getActiveFile() || {};
    const selection = context.selection || NS.SelectionService?.getSourceSelection?.({ allowStale: true }) || NS.Editor?.getSelection?.() || {};
    let summary = parsed?.summary || parsed?.explanation || '';

    let patch = parsed?.patch || (Array.isArray(parsed?.patches) ? parsed.patches[0] : null);
    if (patch && typeof patch === 'string') patch = { text: patch };
    if (!patch && (parsed?.replacementLatex || parsed?.replacement || parsed?.text || parsed?.content)) {
      patch = {
        path: parsed?.targetPath || parsed?.path || selection.path || file.path || State().state.project.activePath || 'main.tex',
        operation: 'replace-selection',
        text: parsed.replacementLatex ?? parsed.replacement ?? parsed.text ?? parsed.content,
        start: parsed.start ?? selection.start,
        end: parsed.end ?? selection.end,
        selectionText: selection.text || ''
      };
    }
    if (!patch) {
      patch = fallbackPatch(rawText, { task, file, selection });
      summary = summary || fallbackSummary(task, selection);
    }

    patch = Object.assign({}, patch);
    patch.path = State().normalizePath(patch.path || selection.path || file.path || State().state.project.activePath || 'main.tex');
    patch.operation = normalizeOperation(patch.operation || patch.op || taskToOperation(task, selection));
    patch.text = cleanCopilotText(patch.text ?? patch.replacementLatex ?? patch.replacement ?? patch.content ?? rawText);

    if (patch.operation === 'replace-selection') {
      patch.start = Number.isFinite(Number(patch.start)) ? Number(patch.start) : Number(selection.start || 0);
      patch.end = Number.isFinite(Number(patch.end)) ? Number(patch.end) : Number(selection.end || 0);
      patch.selectionText = patch.selectionText || selection.text || '';
      patch.laiWrap = true;
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
      return { path: file?.path || 'main.tex', operation: 'insert-at-cursor', text: `% Copilot note:\n% ${String(text).split('\n').join('\n% ')}\n` };
    }
    if (selection?.text) {
      return { path: selection.path || file?.path || 'main.tex', operation: 'replace-selection', text, start: selection.start, end: selection.end, selectionText: selection.text, laiWrap: true };
    }
    return { path: file?.path || 'main.tex', operation: 'insert-at-cursor', text: '\n' + text + '\n' };
  }

  function fallbackSummary(task, selection) {
    if (task === 'fix-error-patch') return 'Patch inferred from Copilot response for the current compile diagnostic.';
    if (task === 'rewrite-selection-patch') return selection?.text ? 'Patch will replace the current selected source.' : 'No source selection was active; patch will insert at cursor.';
    return 'Patch inferred from Copilot response.';
  }

  function normalizeOperation(op) {
    const value = String(op || '').toLowerCase().replace(/_/g, '-');
    if (['replace-file','find-replace','replace-selection','insert-at-cursor'].includes(value)) return value;
    if (value === 'replace') return 'replace-selection';
    if (value === 'insert') return 'insert-at-cursor';
    return 'insert-at-cursor';
  }

  function taskToOperation(task, selection) {
    if (task === 'fix-error-patch') return 'find-replace';
    if (selection?.text) return 'replace-selection';
    return 'insert-at-cursor';
  }

  function proposeFromText(rawText, meta = {}) {
    const task = meta.task || document.getElementById('copilotTask')?.value || 'raw-advice';
    const file = State().getActiveFile();
    const selection = NS.SelectionService?.getSourceSelection?.({ allowStale: true }) || NS.Editor?.getSelection?.() || { text: '', start: 0, end: 0 };
    const parsed = parseAiPatch(rawText);
    const candidate = normalizeCandidate(parsed, rawText, { task, file, selection, meta });
    activePatch = candidate;
    renderPatch(candidate);
    return candidate;
  }

  function applyActivePatch(_options = {}) {
    if (!activePatch) return false;
    const candidate = activePatch;
    const patch = candidate.patch || {};

    let result;
    if (candidate.task === 'rewrite-selection-patch' || patch.laiWrap || patch.operation === 'replace-selection') {
      result = NS.PatchService?.applyRewrite?.({
        path: patch.path || candidate.path,
        start: patch.start,
        end: patch.end,
        oldText: patch.selectionText,
        replacement: patch.text,
        source: 'patch-manager'
      });
    } else {
      result = NS.PatchService?.applyPlainPatch?.(candidate);
    }

    if (!result?.ok) {
      State().setLog(result?.message || 'Patch failed.', [{ level: 'error', message: result?.message || 'Patch failed.', line: null }]);
      NS.Main?.toast?.(result?.message || 'Patch failed.');
      return false;
    }

    NS.Main?.toast?.(candidate.task === 'rewrite-selection-patch' || patch.laiWrap ? 'AI rewrite applied in \\lai{...}.' : 'Copilot patch applied.');
    discardPatch();
    return true;
  }

  function discardPatch() {
    activePatch = null;
    const review = document.getElementById('patchReview');
    if (review) review.classList.add('hidden');
  }

  function renderPatch(candidate) {
    const review = document.getElementById('patchReview');
    const meta = document.getElementById('patchMeta');
    const summary = document.getElementById('patchSummary');
    const diff = document.getElementById('patchDiff');
    if (!review || !candidate) return;
    review.classList.remove('hidden');
    if (meta) meta.textContent = `${candidate.task} · ${candidate.operation} · ${candidate.path}`;
    if (summary) summary.textContent = candidate.summary || 'Copilot proposed a source edit.';
    if (diff) diff.textContent = formatPatchPreview(candidate);
  }

  function formatPatchPreview(candidate) {
    const patch = candidate.patch || {};
    const lines = [
      `Path: ${patch.path || candidate.path}`,
      `Operation: ${patch.operation || candidate.operation}`,
    ];
    if (patch.operation === 'replace-selection') {
      lines.push(`Range: ${patch.start ?? '?'}-${patch.end ?? '?'}`);
      lines.push('');
      lines.push('Old source will be commented and new source will be wrapped in \\lai{...}.');
    }
    if (patch.find) {
      lines.push('');
      lines.push('Find:');
      lines.push(String(patch.find));
    }
    lines.push('');
    lines.push('Text:');
    lines.push(String(patch.text || '').slice(0, 6000));
    return lines.join('\n');
  }

  NS.PatchManager = {
    STAGE,
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
