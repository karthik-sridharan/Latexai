/* Latexai Stage 4F rewrite enforcer
 * Stage: stage4f-capture-ask-force-lai-1
 *
 * Purpose: make “Rewrite selected LaTeX as patch” impossible to apply without
 * inserting \lai{...}. This handler captures the Ask button before the older
 * Copilot handler and directly edits #sourceEditor for this one workflow.
 */
(function () {
  'use strict';

  const STAGE = 'stage4f-capture-ask-force-lai-1';
  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

  let lastSelection = { text: '', start: 0, end: 0, path: 'main.tex', value: '' };
  let applying = false;

  function editor() {
    return document.getElementById('sourceEditor') || document.querySelector('textarea');
  }

  function activePath() {
    try { return State()?.state?.project?.activePath || State()?.state?.project?.rootFile || 'main.tex'; }
    catch (_err) { return document.getElementById('activeFilePill')?.textContent?.trim() || 'main.tex'; }
  }

  function updateLastSelection() {
    const el = editor();
    if (!el) return;
    const start = Number(el.selectionStart || 0);
    const end = Number(el.selectionEnd || 0);
    if (end > start) {
      lastSelection = {
        text: el.value.slice(start, end),
        start,
        end,
        path: activePath(),
        value: el.value
      };
    }
  }

  function getSelectionForRewrite() {
    updateLastSelection();
    const el = editor();
    if (!el) return null;
    const start = Number(el.selectionStart || 0);
    const end = Number(el.selectionEnd || 0);
    if (end > start) {
      return { text: el.value.slice(start, end), start, end, path: activePath(), value: el.value };
    }
    if (lastSelection && lastSelection.text && lastSelection.value === el.value) return lastSelection;
    if (lastSelection && lastSelection.text && lastSelection.path === activePath()) {
      const idx = el.value.indexOf(lastSelection.text);
      if (idx >= 0) return { text: lastSelection.text, start: idx, end: idx + lastSelection.text.length, path: activePath(), value: el.value };
    }
    return null;
  }

  function stripFence(text) {
    let s = String(text ?? '').trim();
    const fence = s.match(/^```(?:json|latex|tex)?\s*([\s\S]*?)\s*```$/i);
    if (fence) s = fence[1].trim();
    return s;
  }

  function extractText(data) {
    try { return NS.Copilot?.extractText?.(data) || NS.AIProvider?.extractText?.(data) || JSON.stringify(data, null, 2); }
    catch (_err) { return String(data ?? ''); }
  }

  function replacementFromAi(raw) {
    let s = stripFence(raw);
    if (/^\s*\{[\s\S]*\}\s*$/.test(s)) {
      try {
        const obj = JSON.parse(s);
        const patch = obj.patch || (Array.isArray(obj.patches) ? obj.patches[0] : null) || {};
        s = obj.replacementLatex ?? obj.replacement ?? obj.text ?? obj.content ?? patch.replacementLatex ?? patch.replacement ?? patch.text ?? patch.content ?? s;
      } catch (_err) {}
    }
    s = stripFence(s);
    const lai = s.match(/^\\lai\s*\{([\s\S]*)\}\s*$/);
    if (lai) s = lai[1].trim();
    // Avoid applying a full JSON blob if the model nested it in a string.
    if (/^\s*\{[\s\S]*\}\s*$/.test(s)) {
      try {
        const obj = JSON.parse(s);
        s = obj.replacementLatex ?? obj.replacement ?? obj.text ?? obj.patch?.text ?? s;
      } catch (_err) {}
    }
    return String(s ?? '').trim();
  }

  function commentOld(text) {
    return String(text ?? '').split('\n').map((line) => `% ${line}`).join('\n');
  }

  function laiBlock(oldText, replacement, path) {
    const id = `lai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return `\n% BEGIN LAI-OLD id=${id} path=${path || 'main.tex'}\n${commentOld(oldText)}\n% END LAI-OLD id=${id}\n\n\\lai{\n${replacement}\n}\n`;
  }

  function ensureLaiMacroForRoot(activeFileWasRoot = false) {
    const S = State();
    if (!S) return;
    const PM = NS.ProjectModel;
    if (!PM || typeof PM.ensureLaiMacro !== 'function') return;
    const project = S.state.project;
    const rootPath = project.rootFile || project.activePath || activePath();
    const rootFile = S.getFile?.(rootPath);
    if (!rootFile || !S.textFile?.(rootFile)) return;
    const next = PM.ensureLaiMacro(String(rootFile.text || ''));
    if (next !== rootFile.text) {
      S.updateFile(rootPath, next);
      if (activeFileWasRoot) {
        const el = editor();
        if (el) el.value = next;
      }
    }
  }

  function updateGutter() {
    const el = editor();
    const gutter = document.getElementById('lineGutter');
    if (!el || !gutter) return;
    const n = Math.max(1, el.value.split('\n').length);
    gutter.textContent = Array.from({ length: n }, (_v, i) => String(i + 1)).join('\n');
  }

  function applyRewrite(selection, replacementRaw) {
    const el = editor();
    if (!el || !selection || !selection.text) return false;
    const replacement = replacementFromAi(replacementRaw);
    if (!replacement.trim()) return false;

    let current = el.value;
    let start = Number(selection.start);
    let end = Number(selection.end);
    if (!(end > start) || current.slice(start, end) !== selection.text) {
      const idx = current.indexOf(selection.text);
      if (idx < 0) return false;
      start = idx;
      end = idx + selection.text.length;
    }

    const path = selection.path || activePath();
    const oldText = current.slice(start, end);
    const block = laiBlock(oldText, replacement, path);
    const next = current.slice(0, start) + block + current.slice(end);

    el.value = next;
    el.focus();
    const newEnd = start + block.length;
    try { el.setSelectionRange(start, newEnd); } catch (_err) {}
    updateGutter();

    const S = State();
    if (S) {
      if (typeof S.updateFile === 'function') S.updateFile(path, next);
      else if (typeof S.updateActiveText === 'function') S.updateActiveText(next);
      ensureLaiMacroForRoot(path === (S.state.project.rootFile || S.state.project.activePath));
      if (typeof S.save === 'function') S.save();
    }
    NS.Preview?.scheduleDraftPreview?.();
    NS.Main?.toast?.('Stage 4F applied rewrite with \\lai{...}.');
    lastSelection = { text: '', start: 0, end: 0, path, value: next };
    return true;
  }

  function buildPrompt(userPrompt, context, selection) {
    const projectSource = context?.fullProjectSource || '';
    const activeFileText = context?.activeFile?.text || editor()?.value || '';
    return [
      'Workflow: rewrite-selection-patch',
      'Return ONLY valid JSON. Do not include markdown fences.',
      'JSON shape:',
      '{"summary":"short summary","replacementLatex":"replacement LaTeX only"}',
      'Do not include the old selected text. Do not wrap in \\lai. Latexai will add \\lai.',
      `User instruction:\n${userPrompt || '(rewrite clearly while preserving math and LaTeX structure)'}`,
      `Active path: ${selection.path}`,
      `Selected LaTeX:\n${selection.text}`,
      `Full project source for context:\n${projectSource || '(unavailable)'}`,
      `Active file source:\n${activeFileText || '(unavailable)'}`
    ].join('\n\n---\n\n');
  }

  async function handleRewriteAsk(ev) {
    const task = document.getElementById('copilotTask')?.value || '';
    if (task !== 'rewrite-selection-patch') return;
    if (applying) {
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.();
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation?.();

    const output = document.getElementById('copilotOutput');
    const button = document.getElementById('askCopilotBtn');
    const prompt = document.getElementById('copilotPrompt')?.value || '';
    const selection = getSelectionForRewrite();
    if (!selection || !selection.text.trim()) {
      if (output) output.textContent = 'Stage 4F: select source text in the editor before using Rewrite selected LaTeX as patch.';
      return;
    }

    applying = true;
    if (button) button.disabled = true;
    if (output) output.textContent = `Stage 4F: rewriting selected source from ${selection.path} and will force \\lai{...}.`;
    try {
      const context = NS.Copilot?.captureContext?.() || { activeFile: { path: selection.path, text: selection.value }, fullProjectSource: '' };
      context.selection = { text: selection.text, start: selection.start, end: selection.end };
      const user = buildPrompt(prompt, context, selection);
      let result;
      if (typeof NS.Copilot?.callProxy === 'function') {
        result = await NS.Copilot.callProxy(
          { instructions: 'You are a LaTeX rewriting assistant. Return only JSON with replacementLatex.', input: user, temperature: 0.15, maxOutputTokens: 5200 },
          { task: 'rewrite-selection-patch', stage: STAGE, forcedLai: true }
        );
      } else {
        result = { text: JSON.stringify({ replacementLatex: prompt || selection.text }) };
      }
      const raw = extractText(result);
      const ok = applyRewrite(selection, raw);
      if (output) {
        output.textContent = ok
          ? `Stage 4F applied rewrite to ${selection.path}. The old text was commented and the replacement was wrapped in \\lai{...}.`
          : `Stage 4F got an AI response but could not apply it. Response:\n${raw}`;
      }
    } catch (err) {
      const fallback = prompt || selection.text;
      const ok = applyRewrite(selection, JSON.stringify({ replacementLatex: fallback }));
      if (output) {
        output.textContent = ok
          ? `Stage 4F fallback applied with \\lai{...}. AI call failed: ${err?.message || err}`
          : `Stage 4F failed before applying rewrite: ${err?.message || err}`;
      }
    } finally {
      applying = false;
      if (button) button.disabled = false;
      NS.Copilot?.renderContextChips?.();
    }
  }

  function handleRewriteReplace(ev) {
    const task = document.getElementById('copilotTask')?.value || '';
    if (task !== 'rewrite-selection-patch') return;
    const output = document.getElementById('copilotOutput')?.textContent || '';
    if (!output.trim()) return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.();
    const sel = getSelectionForRewrite();
    const ok = applyRewrite(sel, output);
    const out = document.getElementById('copilotOutput');
    if (out) out.textContent = ok ? 'Stage 4F applied existing Copilot output with \\lai{...}.' : 'Stage 4F could not apply existing output; select source text first.';
  }

  function install() {
    document.addEventListener('selectionchange', updateLastSelection);
    const el = editor();
    if (el && !el.__stage4fSelectionCache) {
      ['select', 'keyup', 'mouseup', 'touchend', 'blur'].forEach((name) => el.addEventListener(name, updateLastSelection, true));
      el.__stage4fSelectionCache = true;
    }
    const ask = document.getElementById('askCopilotBtn');
    if (ask && !ask.__stage4fAskCapture) {
      ask.addEventListener('click', handleRewriteAsk, true);
      ask.__stage4fAskCapture = true;
    }
    const replace = document.getElementById('replaceCopilotBtn');
    if (replace && !replace.__stage4fReplaceCapture) {
      replace.addEventListener('click', handleRewriteReplace, true);
      replace.__stage4fReplaceCapture = true;
    }
    console.log('[Latexai Stage 4F] rewrite enforcer installed');
  }

  W.LAI_REWRITE_ENFORCER = { STAGE, install, applyRewrite, getSelectionForRewrite, replacementFromAi };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
