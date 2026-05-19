/* Latexai Stage 4L always-visible LAI rewrite guard
 * Stage: stage4l-pages-safe-lai-guard-1
 *
 * Purpose:
 * - Make it visually obvious that the guard loaded: fixed badge at top-right.
 * - Do not depend on Copilot DOM/chips existing.
 * - For workflow "Rewrite selected LaTeX as patch", force every replacement into:
 *
 *   % BEGIN LAI-OLD ...
 *   % old selected source
 *   % END LAI-OLD ...
 *
 *   \lai{
 *   new source
 *   }
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage4l-pages-safe-lai-guard-1';

  let pending = null;
  let lastNonEmptySelection = null;
  let applying = false;

  function editor() {
    return document.getElementById('sourceEditor') || document.querySelector('textarea');
  }

  function task() {
    return document.getElementById('copilotTask')?.value || '';
  }

  function isRewriteTask() {
    return task() === 'rewrite-selection-patch' || /rewrite/i.test(task());
  }

  function outputText() {
    return document.getElementById('copilotOutput')?.textContent || '';
  }

  function activePath() {
    return NS.State?.state?.project?.activePath ||
      document.getElementById('activeFilePill')?.textContent?.trim() ||
      'main.tex';
  }

  function rootPath() {
    return NS.State?.state?.project?.rootFile || 'main.tex';
  }

  function setBadge(text, color) {
    let badge = document.getElementById('laiStage4lBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'laiStage4lBadge';
      badge.style.cssText = [
        'position:fixed',
        'right:12px',
        'top:12px',
        'z-index:2147483647',
        'padding:7px 10px',
        'border-radius:999px',
        'background:#fee',
        'color:#900',
        'border:2px solid #e66',
        'font:700 12px system-ui,-apple-system,BlinkMacSystemFont,sans-serif',
        'box-shadow:0 3px 14px rgba(0,0,0,0.2)',
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(badge);
    }
    badge.textContent = text || 'LAI Guard Stage 4L active';
    if (color === 'green') {
      badge.style.background = '#e8ffe8';
      badge.style.color = '#064';
      badge.style.borderColor = '#5b5';
    } else if (color === 'blue') {
      badge.style.background = '#eaf2ff';
      badge.style.color = '#024';
      badge.style.borderColor = '#69f';
    } else {
      badge.style.background = '#fee';
      badge.style.color = '#900';
      badge.style.borderColor = '#e66';
    }
  }

  function captureSelection(source) {
    const el = editor();
    if (!el) return null;
    const start = Number(el.selectionStart || 0);
    const end = Number(el.selectionEnd || 0);
    if (!(end > start)) return null;
    const text = el.value.slice(start, end);
    if (!text.trim()) return null;
    const cap = {
      source,
      path: activePath(),
      start,
      end,
      oldText: text,
      beforeValue: el.value,
      at: Date.now()
    };
    lastNonEmptySelection = cap;
    return cap;
  }

  function rememberSelection(source) {
    const cap = captureSelection(source);
    if (cap) {
      pending = cap;
      setBadge('LAI Guard 4L: selection captured', 'blue');
    }
    return cap;
  }

  function latexCommentBlock(text) {
    return String(text || '').split('\n').map(line => `% ${line}`).join('\n');
  }

  function stripFence(text) {
    let s = String(text ?? '').trim();
    const fence = s.match(/^```(?:json|latex|tex)?\s*([\s\S]*?)\s*```$/i);
    if (fence) s = fence[1].trim();
    return s;
  }

  function parseReplacement(raw) {
    let s = stripFence(raw);

    // Remove status prose produced by previous handlers.
    s = s.replace(/^Stage\s+4[A-Z][^\n]*\n*/i, '').trim();
    s = s.replace(/^Applied[^\n]*\n*/i, '').trim();

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

    const embedded = s.match(/\\lai\s*\{([\s\S]*)\}\s*$/);
    if (embedded) s = embedded[1].trim();

    return String(s || '').trim();
  }

  function buildBlock(oldText, newText, path) {
    const id = `lai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return `\n% BEGIN LAI-OLD id=${id} path=${path || activePath()}\n${latexCommentBlock(oldText)}\n% END LAI-OLD id=${id}\n\n\\lai{\n${newText}\n}\n`;
  }

  function hasLaiMacro(tex) {
    const s = String(tex || '');
    return /\\newif\\iflaishowchanges/.test(s) && /\\(?:long\\def|def|newcommand)\\lai/.test(s);
  }

  function ensureMacroText(tex) {
    let s = String(tex || '');
    if (hasLaiMacro(s)) return s;

    if (!/\\usepackage(?:\[[^\]]*\])?\{[^}]*\bxcolor\b[^}]*\}/.test(s)) {
      const dc = s.match(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}\s*/);
      if (dc) s = s.slice(0, dc.index + dc[0].length) + '\\usepackage{xcolor}\n' + s.slice(dc.index + dc[0].length);
      else s = '\\usepackage{xcolor}\n' + s;
    }

    const macro =
`% --- Latexai AI-change highlighting macro ---
% Set this to \\laishowchangesfalse to hide red AI markup.
\\newif\\iflaishowchanges
\\laishowchangestrue
\\long\\def\\lai#1{%
  \\iflaishowchanges
    {\\color{red}#1}%
  \\else
    #1%
  \\fi
}
% --- end Latexai AI-change highlighting macro ---

`;

    const begin = s.indexOf('\\begin{document}');
    if (begin >= 0) return s.slice(0, begin) + macro + s.slice(begin);
    return macro + s;
  }

  function ensureLaiMacro() {
    try {
      const state = NS.State;
      if (state?.getFile && state?.updateFile) {
        const rp = rootPath();
        const root = state.getFile(rp);
        if (root && typeof root.text === 'string') {
          const next = ensureMacroText(root.text);
          if (next !== root.text) state.updateFile(rp, next);
          return true;
        }
      }

      const el = editor();
      if (el && /\\begin\{document\}/.test(el.value)) {
        const next = ensureMacroText(el.value);
        if (next !== el.value) {
          el.value = next;
          NS.State?.updateActiveText?.(next);
        }
        return true;
      }
    } catch (_err) {}
    return false;
  }

  function commonDiff(oldValue, newValue) {
    let prefix = 0;
    const minLen = Math.min(oldValue.length, newValue.length);
    while (prefix < minLen && oldValue[prefix] === newValue[prefix]) prefix++;

    let oldSuffix = oldValue.length;
    let newSuffix = newValue.length;
    while (oldSuffix > prefix && newSuffix > prefix && oldValue[oldSuffix - 1] === newValue[newSuffix - 1]) {
      oldSuffix--;
      newSuffix--;
    }

    return {
      oldStart: prefix,
      oldEnd: oldSuffix,
      newStart: prefix,
      newEnd: newSuffix,
      oldChunk: oldValue.slice(prefix, oldSuffix),
      newChunk: newValue.slice(prefix, newSuffix)
    };
  }

  function applyBlock(cap, replacement, reason) {
    const el = editor();
    if (!el || !cap || applying) return false;

    const newText = parseReplacement(replacement);
    if (!newText.trim()) return false;

    applying = true;
    try {
      ensureLaiMacro();

      let current = String(el.value || '');
      let start = Number(cap.start);
      let end = Number(cap.end);
      let oldText = cap.oldText;

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        start = 0;
        end = 0;
      }

      // If the source has already changed without LAI, convert the changed diff.
      if (cap.beforeValue && current !== cap.beforeValue) {
        const d = commonDiff(cap.beforeValue, current);
        if (d.newChunk && !/\\lai\s*\{/.test(d.newChunk)) {
          start = d.newStart;
          end = d.newEnd;
          oldText = d.oldChunk || oldText;
        }
      } else {
        const selectedNow = current.slice(start, end);
        if (oldText && selectedNow !== oldText) {
          const idx = current.indexOf(oldText);
          if (idx >= 0) {
            start = idx;
            end = idx + oldText.length;
          }
        }
      }

      oldText = oldText || current.slice(start, end) || cap.oldText || '';
      if (!oldText.trim()) return false;

      const block = buildBlock(oldText, newText, cap.path);
      current = String(el.value || '');
      const next = current.slice(0, start) + block + current.slice(end);

      el.value = next;
      el.focus();
      el.setSelectionRange(start, start + block.length);

      if (NS.State?.setActivePath && NS.State?.state?.project?.activePath !== cap.path) {
        try { NS.State.setActivePath(cap.path); } catch (_err) {}
      }

      NS.State?.updateActiveText?.(next);
      NS.Editor?.setText?.(next);
      NS.Preview?.scheduleDraftPreview?.();
      NS.State?.save?.();

      const out = document.getElementById('copilotOutput');
      if (out) out.textContent = `Stage 4L applied with \\lai{...} (${reason}). Old source was commented and replacement was wrapped.`;

      setBadge('Stage 4L applied \\lai{...}', 'green');
      NS.Main?.toast?.('Stage 4L applied rewrite with \\lai{...}.');
      pending = null;
      return true;
    } finally {
      applying = false;
    }
  }

  function enforceFromOutput(reason) {
    if (!isRewriteTask()) return false;
    const cap = pending || lastNonEmptySelection;
    if (!cap) return false;
    const out = outputText();
    if (!out.trim() || /^Calling AI proxy/i.test(out) || /^Copilot responses/i.test(out)) return false;
    return applyBlock(cap, out, reason);
  }

  function enforceFromEditorMutation(reason) {
    if (!isRewriteTask()) return false;
    const cap = pending || lastNonEmptySelection;
    if (!cap) return false;
    const el = editor();
    if (!el) return false;
    const current = String(el.value || '');
    if (current === cap.beforeValue) return false;
    if (/\\lai\s*\{/.test(current) && /%\s*BEGIN\s+LAI-OLD/i.test(current)) return true;
    const d = commonDiff(cap.beforeValue, current);
    if (!d.newChunk || /\\lai\s*\{/.test(d.newChunk)) return false;
    return applyBlock(cap, d.newChunk, reason);
  }

  function installEditorPatches() {
    if (!NS.Editor || NS.Editor.__stage4lPatched) return;

    const oldReplaceSelection = NS.Editor.replaceSelection?.bind(NS.Editor);
    const oldReplaceRange = NS.Editor.replaceRange?.bind(NS.Editor);
    const oldInsertText = NS.Editor.insertText?.bind(NS.Editor);

    if (oldReplaceSelection) {
      NS.Editor.replaceSelection = function (text, selectInserted = true) {
        const cap = isRewriteTask() ? (captureSelection('editor.replaceSelection') || pending || lastNonEmptySelection) : null;
        if (cap) return applyBlock(cap, text, 'editor.replaceSelection');
        return oldReplaceSelection(text, selectInserted);
      };
    }

    if (oldReplaceRange) {
      NS.Editor.replaceRange = function (start, end, text, selectInserted = true) {
        if (isRewriteTask()) {
          const el = editor();
          const cap = pending || lastNonEmptySelection || {
            path: activePath(),
            start: Number(start) || 0,
            end: Number(end) || 0,
            oldText: el ? el.value.slice(Number(start) || 0, Number(end) || 0) : '',
            beforeValue: el ? el.value : '',
            at: Date.now()
          };
          if (cap.oldText && String(text || '').trim()) return applyBlock(cap, text, 'editor.replaceRange');
        }
        return oldReplaceRange(start, end, text, selectInserted);
      };
    }

    if (oldInsertText) {
      NS.Editor.insertText = function (text) {
        if (isRewriteTask()) {
          const cap = pending || lastNonEmptySelection || captureSelection('editor.insertText');
          if (cap) return applyBlock(cap, text, 'editor.insertText');
        }
        return oldInsertText(text);
      };
    }

    NS.Editor.__stage4lPatched = true;
  }

  function installCopilotPatch() {
    if (!NS.Copilot || NS.Copilot.__stage4lPatched) return;
    const oldAsk = NS.Copilot.askCopilot?.bind(NS.Copilot);
    if (oldAsk) {
      NS.Copilot.askCopilot = async function () {
        if (isRewriteTask()) rememberSelection('copilot.ask');
        const result = await oldAsk();
        setTimeout(() => enforceFromOutput('after NS.Copilot.askCopilot'), 50);
        setTimeout(() => enforceFromEditorMutation('after NS.Copilot.askCopilot mutation'), 120);
        return result;
      };
    }
    NS.Copilot.__stage4lPatched = true;
  }

  function installDomHandlers() {
    const el = editor();
    if (el && !el.__stage4lSelectionHandlers) {
      ['select', 'mouseup', 'keyup', 'touchend', 'blur', 'selectionchange'].forEach((evt) => {
        el.addEventListener(evt, () => {
          const cap = captureSelection(`editor.${evt}`);
          if (cap) lastNonEmptySelection = cap;
        }, true);
      });
      el.__stage4lSelectionHandlers = true;
    }

    const ask = document.getElementById('askCopilotBtn');
    if (ask && !ask.__stage4lAsk) {
      ask.addEventListener('click', () => {
        if (!isRewriteTask()) return;
        rememberSelection('ask-click');
        setTimeout(() => enforceFromOutput('ask-click output 1'), 1000);
        setTimeout(() => enforceFromOutput('ask-click output 2'), 2500);
        setTimeout(() => enforceFromEditorMutation('ask-click mutation'), 1300);
      }, true);
      ask.__stage4lAsk = true;
    }

    ['insertCopilotBtn', 'replaceCopilotBtn', 'applyCopilotPatchBtn'].forEach((id) => {
      const b = document.getElementById(id);
      if (b && !b.__stage4lButton) {
        b.addEventListener('click', (ev) => {
          if (!isRewriteTask()) return;
          const cap = pending || lastNonEmptySelection || captureSelection(id);
          const out = outputText();
          if (cap && out.trim()) {
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
            applyBlock(cap, out, id);
          }
        }, true);
        b.__stage4lButton = true;
      }
    });
  }

  function installOutputObserver() {
    const out = document.getElementById('copilotOutput');
    if (!out || out.__stage4lObserver) return;
    const obs = new MutationObserver(() => {
      if (!isRewriteTask()) return;
      setTimeout(() => enforceFromOutput('copilot output observer'), 50);
    });
    obs.observe(out, { childList: true, subtree: true, characterData: true });
    out.__stage4lObserver = obs;
  }

  function boot() {
    if (document.body) setBadge('LAI Guard Stage 4L active', 'red');
    W.__LATEXAI_STAGE4L_LAI_GUARD_ACTIVE = true;
    installEditorPatches();
    installCopilotPatch();
    installDomHandlers();
    installOutputObserver();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  let count = 0;
  const id = setInterval(() => {
    boot();
    count += 1;
    if (count > 40) clearInterval(id);
  }, 250);

  W.LAI_STAGE4L_GUARD = {
    STAGE,
    captureSelection,
    enforceFromOutput,
    enforceFromEditorMutation,
    applyBlock,
    getPending: () => pending || lastNonEmptySelection
  };

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
