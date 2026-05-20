/* Latexai Stage 14A CompileRootService
 * Stage: stage14a-active-standalone-compile-root-1
 *
 * Compile behavior:
 * - If the file currently shown in the source panel is a standalone .tex file,
 *   compile that file.
 * - Otherwise compile the normal project root/main.tex as before.
 *
 * This lets generated Beamer files such as talk/foo.beamer.tex compile through
 * the existing Compile PDF button without adding a separate Beamer preview.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage14a-active-standalone-compile-root-1';

  let lastDecision = null;

  function State() { return NS.State; }
  function el(id) { return document.getElementById(id); }

  function normalizePath(path) {
    try { return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    catch (_err) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
  }

  function project() {
    return State()?.state?.project || {};
  }

  function fileText(file) {
    if (!file) return '';
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function textFile(file) {
    try { return !!State()?.textFile?.(file); } catch (_err) {}
    return file && !file.base64 && !['asset', 'binary'].includes(file.kind);
  }

  function allFiles() {
    return project().files || [];
  }

  function getFile(path) {
    const normalized = normalizePath(path);
    try {
      const found = State()?.getFile?.(normalized);
      if (found) return found;
    } catch (_err) {}
    return allFiles().find((file) => normalizePath(file.path) === normalized) || null;
  }

  function rootPath() {
    const p = project();
    if (p.rootFile) return normalizePath(p.rootFile);
    const root = allFiles().find((f) => /\.tex$/i.test(f.path || '') && /\\documentclass/.test(fileText(f)));
    return normalizePath(root?.path || allFiles().find((f) => /\.tex$/i.test(f.path || ''))?.path || 'main.tex');
  }

  function sourceText() {
    return String(el('sourceEditor')?.value || '');
  }

  function activePathFromState() {
    const s = State();
    const p = project();
    const candidates = [
      s?.state?.activePath,
      s?.state?.activeFilePath,
      s?.state?.currentPath,
      s?.state?.selectedPath,
      p?.activePath,
      p?.activeFilePath,
      p?.currentPath,
      p?.selectedPath
    ];

    for (const candidate of candidates) {
      if (candidate && getFile(candidate)) return normalizePath(candidate);
    }

    try {
      const value = s?.getActivePath?.();
      if (value && getFile(value)) return normalizePath(value);
    } catch (_err) {}

    try {
      const file = s?.getActiveFile?.();
      if (file?.path) return normalizePath(file.path);
    } catch (_err) {}

    return '';
  }

  function activePathFromPill() {
    const pill = String(el('activeFilePill')?.textContent || '').trim();
    if (!pill) return '';

    if (getFile(pill)) return normalizePath(pill);

    const matches = allFiles()
      .filter((file) => /\.tex$/i.test(file.path || ''))
      .filter((file) => normalizePath(file.path).endsWith(`/${pill}`) || normalizePath(file.path) === pill);

    if (matches.length === 1) return normalizePath(matches[0].path);
    return '';
  }

  function activePathFromSourceText() {
    const text = sourceText();
    if (!text) return '';
    const matches = allFiles()
      .filter((file) => /\.tex$/i.test(file.path || '') && textFile(file))
      .filter((file) => fileText(file) === text);
    if (matches.length === 1) return normalizePath(matches[0].path);
    return '';
  }

  function activeTexFile() {
    const path = activePathFromState() || activePathFromPill() || activePathFromSourceText();
    if (!path || !/\.tex$/i.test(path)) return null;

    const file = getFile(path);
    if (!file || !textFile(file)) return null;

    return { path, file, text: fileText(file) || sourceText() };
  }

  function isStandaloneTex(text) {
    const s = String(text || '');
    if (!s.trim()) return false;
    if (!/\\documentclass(?:\s*\[[^\]]*\])?\s*\{[^}]+\}/.test(s)) return false;
    if (!/\\begin\{document\}/.test(s)) return false;
    if (!/\\end\{document\}/.test(s)) return false;
    return true;
  }

  function texDocumentClass(text) {
    const m = String(text || '').match(/\\documentclass(?:\s*\[[^\]]*\])?\s*\{([^}]+)\}/);
    return m?.[1] || '';
  }

  function shouldPreferActiveStandalone() {
    const checkbox = el('compileActiveStandaloneCheck');
    return checkbox ? checkbox.checked : true;
  }

  function setRootSelectValue(path) {
    const normalized = normalizePath(path);
    const select = el('rootFileSelect');
    if (select) {
      let option = Array.from(select.options || []).find((opt) => normalizePath(opt.value) === normalized);
      if (!option) {
        option = document.createElement('option');
        option.value = normalized;
        option.textContent = normalized;
        option.dataset.stage14a = 'active-standalone';
        select.appendChild(option);
      }
      select.value = normalized;
      try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
    }

    const p = project();
    if (p && typeof p === 'object') p.rootFile = normalized;

    try { State()?.save?.(); } catch (_err) {}
    return normalized;
  }

  function compileRootDecision() {
    const normalRoot = rootPath();
    const active = activeTexFile();

    if (shouldPreferActiveStandalone() && active && isStandaloneTex(active.text)) {
      return {
        root: active.path,
        reason: 'active-standalone',
        activePath: active.path,
        documentClass: texDocumentClass(active.text),
        fallbackRoot: normalRoot
      };
    }

    return {
      root: normalRoot,
      reason: active ? 'active-not-standalone' : 'no-active-tex',
      activePath: active?.path || '',
      documentClass: active ? texDocumentClass(active.text) : '',
      fallbackRoot: normalRoot
    };
  }

  function applyCompileRootDecision() {
    const decision = compileRootDecision();
    const applied = setRootSelectValue(decision.root);
    lastDecision = { ...decision, appliedRoot: applied, at: new Date().toISOString() };
    updateCompileRootStatus(lastDecision);
    return lastDecision;
  }

  function updateCompileRootStatus(decision = lastDecision) {
    const node = el('compileActiveStandaloneStatus');
    if (!node) return;
    if (!decision) {
      node.textContent = 'Compile root auto-selection ready.';
      return;
    }

    if (decision.reason === 'active-standalone') {
      const cls = decision.documentClass ? ` (${decision.documentClass})` : '';
      node.textContent = `Compile will use active standalone file: ${decision.root}${cls}`;
    } else if (decision.reason === 'active-not-standalone') {
      node.textContent = `Active file is not standalone; compile will use root: ${decision.root}`;
    } else {
      node.textContent = `No active standalone .tex detected; compile will use root: ${decision.root}`;
    }
  }

  function ensureSettingsUi() {
    if (el('compileActiveStandaloneCheck')) return true;

    const rootSelect = el('rootFileSelect');
    if (!rootSelect) return false;

    const rootLabel = rootSelect.closest?.('label') || rootSelect.parentElement;
    const container = document.createElement('div');
    container.className = 'stage14a-compile-root-box';
    container.innerHTML = [
      '<label class="field checkbox-field stage14a-compile-root-check">',
      '  <input id="compileActiveStandaloneCheck" type="checkbox" checked />',
      '  Compile active standalone .tex file when source panel shows one',
      '</label>',
      '<div id="compileActiveStandaloneStatus" class="settings-note stage14a-compile-root-status">Compile root auto-selection ready.</div>'
    ].join('');

    if (rootLabel?.parentElement) rootLabel.parentElement.insertAdjacentElement('afterend', container);
    else rootSelect.insertAdjacentElement('afterend', container);

    el('compileActiveStandaloneCheck')?.addEventListener('change', () => {
      applyCompileRootDecision();
    }, true);

    return true;
  }

  function onCompileClick(_event) {
    // Capture-phase hook. We do not stop the original Compile button handler.
    // We just choose the root early enough that the normal compile pipeline sees it.
    applyCompileRootDecision();
  }

  function bindCompileHook() {
    const button = el('compileBtn');
    if (!button || button.dataset.stage14aCompileRootBound === '1') return false;
    button.dataset.stage14aCompileRootBound = '1';
    button.addEventListener('click', onCompileClick, true);
    return true;
  }

  function observeActiveFile() {
    const editor = el('sourceEditor');
    if (editor && editor.dataset.stage14aCompileRootBound !== '1') {
      editor.dataset.stage14aCompileRootBound = '1';
      editor.addEventListener('input', () => {
        // Do not mutate root while typing; only refresh the explanatory status.
        const decision = compileRootDecision();
        updateCompileRootStatus(decision);
      }, false);
    }

    const pill = el('activeFilePill');
    if (pill && !pill.dataset.stage14aObserved) {
      pill.dataset.stage14aObserved = '1';
      try {
        const observer = new MutationObserver(() => updateCompileRootStatus(compileRootDecision()));
        observer.observe(pill, { childList: true, characterData: true, subtree: true });
      } catch (_err) {}
    }
  }

  function init() {
    ensureSettingsUi();
    bindCompileHook();
    observeActiveFile();
    updateCompileRootStatus(compileRootDecision());
  }

  NS.CompileRootService = {
    STAGE,
    init,
    activeTexFile,
    isStandaloneTex,
    compileRootDecision,
    applyCompileRootDecision,
    setRootSelectValue,
    getLastDecision: () => lastDecision
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    init();
    tries += 1;
    if ((el('compileBtn') && el('rootFileSelect')) || tries > 60) clearInterval(interval);
  }, 400);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
