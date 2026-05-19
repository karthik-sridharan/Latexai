/* Latexai Stage 6C PatchService
 * Stage: stage6abc-modular-selection-patchservice-1
 *
 * Single owner for source edits that comment old content and insert \lai{...}.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;
  const STAGE = 'stage6abc-modular-selection-patchservice-1';

  function normalizePath(path) {
    return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  }

  function fileText(file) {
    if (!file) return '';
    if (typeof file === 'string') return file;
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function stripFence(text) {
    let s = String(text ?? '').trim();
    const fence = s.match(/^```(?:json|latex|tex)?\s*([\s\S]*?)\s*```$/i);
    if (fence) s = fence[1].trim();
    return s;
  }

  function extractReplacement(rawText) {
    let s = stripFence(rawText);
    if (/^\s*\{[\s\S]*\}\s*$/.test(s)) {
      try {
        const obj = JSON.parse(s);
        const patch = obj.patch || (Array.isArray(obj.patches) ? obj.patches[0] : null) || {};
        s = obj.replacementLatex ??
          obj.replacement ??
          obj.text ??
          obj.content ??
          patch.replacementLatex ??
          patch.replacement ??
          patch.replace ??
          patch.text ??
          patch.content ??
          s;
      } catch (_err) {}
    }
    s = stripFence(s);
    const lai = s.match(/^\\lai\s*\{([\s\S]*)\}\s*$/);
    if (lai) s = lai[1].trim();
    return String(s ?? '').trim();
  }

  function commentOldSource(text) {
    return String(text ?? '').split('\n').map((line) => `% ${line}`).join('\n');
  }

  function laiRewriteBlock(oldText, replacement, path) {
    const id = `lai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const newText = extractReplacement(replacement);
    return `\n% BEGIN LAI-OLD id=${id} path=${path || 'main.tex'}\n${commentOldSource(oldText)}\n% END LAI-OLD id=${id}\n\n\\lai{\n${newText}\n}\n`;
  }

  function ensureLaiMacro(rootPath) {
    try {
      const project = State().state.project;
      const path = normalizePath(rootPath || project.rootFile || project.activePath || 'main.tex');
      const file = State().getFile(path);
      const ensure = NS.ProjectModel?.ensureLaiMacro;
      if (!file || !State().textFile(file.path) || typeof ensure !== 'function') return false;
      const next = ensure(fileText(file));
      if (next !== file.text) {
        State().updateFile(file.path, next);
        return true;
      }
    } catch (_err) {}
    return false;
  }

  function resolveRange(path, start, end, oldText) {
    const file = State().getFile(path);
    const current = fileText(file);
    start = Number(start);
    end = Number(end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      start = 0;
      end = 0;
    }
    start = Math.max(0, Math.min(start, current.length));
    end = Math.max(start, Math.min(end, current.length));

    oldText = String(oldText ?? '');
    if (oldText && current.slice(start, end) !== oldText) {
      const idx = current.indexOf(oldText);
      if (idx >= 0) {
        start = idx;
        end = idx + oldText.length;
      }
    }
    const selected = current.slice(start, end) || oldText;
    return { file, current, start, end, oldText: selected };
  }

  function applyRewrite(input = {}) {
    const selection = input.selection || NS.SelectionService?.getSourceSelection?.({ allowStale: true }) || {};
    const path = normalizePath(input.path || selection.path || State().state.project.activePath || State().state.project.rootFile || 'main.tex');
    const replacement = extractReplacement(input.replacement ?? input.text ?? input.rawText ?? '');
    if (!replacement.trim()) return { ok: false, message: 'Replacement is empty.' };

    let start = input.start ?? selection.start;
    let end = input.end ?? selection.end;
    let oldText = input.oldText ?? selection.text ?? '';

    const resolved = resolveRange(path, start, end, oldText);
    if (!resolved.file) return { ok: false, message: `Target file not found: ${path}` };
    if (!State().textFile(resolved.file.path)) return { ok: false, message: `Target file is not editable text: ${path}` };
    if (!(resolved.end > resolved.start) || !String(resolved.oldText || '').trim()) {
      return { ok: false, message: 'No source selection found. Select source text first.' };
    }

    const block = laiRewriteBlock(resolved.oldText, replacement, path);
    if (!/\\lai\s*\{/.test(block) || !/%\s*BEGIN\s+LAI-OLD/i.test(block)) {
      return { ok: false, message: 'Internal error: rewrite block missing LAI markers.' };
    }

    const next = resolved.current.slice(0, resolved.start) + block + resolved.current.slice(resolved.end);
    State().updateFile(path, next);
    ensureLaiMacro(State().state.project.rootFile);

    if (State().state.project.activePath !== path) State().setActivePath(path);
    NS.Editor?.render?.();

    const newEnd = resolved.start + block.length;
    NS.SelectionService?.setSourceSelection?.(path, resolved.start, newEnd, {
      freeze: true,
      source: input.source || 'patch-service',
      method: 'applied-rewrite'
    });

    try { State().save(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}
    try { NS.Main?.toast?.('Applied AI rewrite with \\lai{...}.'); } catch (_err) {}

    return {
      ok: true,
      path,
      start: resolved.start,
      end: newEnd,
      oldText: resolved.oldText,
      replacement,
      block
    };
  }

  function applyPlainPatch(candidate = {}) {
    const patch = candidate.patch || candidate;
    const path = normalizePath(patch.path || candidate.path || State().state.project.activePath || 'main.tex');
    const file = State().getFile(path);
    if (!file || !State().textFile(file.path)) return { ok: false, message: `Target text file not found: ${path}` };
    const current = fileText(file);
    const op = patch.operation || candidate.operation || 'insert-at-cursor';

    if (op === 'replace-file') {
      State().updateFile(path, String(patch.text ?? ''));
      if (State().state.project.activePath === path) NS.Editor?.render?.();
      return { ok: true, path, operation: op };
    }

    if (op === 'find-replace') {
      const find = String(patch.find || '');
      const replace = String(patch.replace ?? patch.text ?? '');
      if (!find) return { ok: false, message: 'Find-replace patch had no find text.' };
      const idx = current.indexOf(find);
      if (idx < 0) return { ok: false, message: 'Find text was not found in target file.' };
      State().updateFile(path, current.slice(0, idx) + replace + current.slice(idx + find.length));
      if (State().state.project.activePath === path) NS.Editor?.render?.();
      return { ok: true, path, operation: op };
    }

    if (op === 'replace-selection') {
      const sel = NS.SelectionService?.getSourceSelection?.({ allowStale: true }) || {};
      return applyRewrite({
        path,
        start: patch.start ?? sel.start,
        end: patch.end ?? sel.end,
        oldText: patch.selectionText ?? sel.text,
        replacement: patch.text ?? patch.replacement ?? patch.content ?? '',
        source: 'plain-replace-selection-promoted-to-lai'
      });
    }

    const insert = String(patch.text ?? '');
    const sel = NS.SelectionService?.getSourceSelection?.({ allowStale: true }) || {};
    const pos = Number.isFinite(Number(sel.start)) ? Number(sel.start) : current.length;
    const safe = Math.max(0, Math.min(pos, current.length));
    State().updateFile(path, current.slice(0, safe) + insert + current.slice(safe));
    if (State().state.project.activePath === path) NS.Editor?.render?.();
    return { ok: true, path, operation: op };
  }

  function invertLaiBlock(text) {
    // Utility for later repair tools; not used automatically in Stage 6.
    return String(text || '');
  }

  NS.PatchService = {
    STAGE,
    stripFence,
    extractReplacement,
    commentOldSource,
    laiRewriteBlock,
    ensureLaiMacro,
    resolveRange,
    applyRewrite,
    applyPlainPatch,
    invertLaiBlock
  };

  try { console.log('[Latexai]', STAGE, 'PatchService active'); } catch (_err) {}
})();
