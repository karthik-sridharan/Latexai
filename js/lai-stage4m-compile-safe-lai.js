/* Latexai Stage 4M compile-safe LAI macro guard
 * Stage: stage5d-fix-lai-old-new-order-1
 *
 * Ensures \lai is defined before compile/preview whenever any project file
 * contains \lai{...}. This fixes the "rewrite inserted \lai but PDF fails"
 * problem when the root preamble did not get the macro.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage5d-fix-lai-old-new-order-1';

  function badge(_text, _color = '#064', _bg = '#e8ffe8', _border = '#5b5') {
    // Stage 4N: debug badge removed; macro guard still runs.
  }

  function editor() {
    return document.getElementById('sourceEditor') || document.querySelector('textarea');
  }

  function getState() {
    return NS.State?.state || null;
  }

  function rootPath() {
    const st = getState();
    return st?.project?.rootFile || 'main.tex';
  }

  function activePath() {
    const st = getState();
    return st?.project?.activePath ||
      document.getElementById('activeFilePill')?.textContent?.trim() ||
      rootPath();
  }

  function getFile(path) {
    try {
      if (NS.State?.getFile) return NS.State.getFile(path);
      const files = getState()?.project?.files || {};
      return files[path] || null;
    } catch (_err) {
      return null;
    }
  }

  function updateFile(path, text) {
    try {
      if (NS.State?.updateFile) {
        NS.State.updateFile(path, text);
        return true;
      }
      const st = getState();
      if (st?.project?.files?.[path]) {
        st.project.files[path].text = text;
        return true;
      }
    } catch (_err) {}
    return false;
  }

  function activeEditorText() {
    const el = editor();
    return el ? String(el.value || '') : '';
  }

  function setActiveEditorText(text) {
    const el = editor();
    if (!el) return false;
    el.value = String(text || '');
    NS.State?.updateActiveText?.(String(text || ''));
    NS.Editor?.render?.();
    return true;
  }

  function fileText(file) {
    if (!file) return '';
    if (typeof file === 'string') return file;
    return String(file.text ?? file.content ?? file.source ?? '');
  }

  function hasLaiUse(text) {
    return /\\lai\s*\{/.test(String(text || ''));
  }

  function hasLaiMacro(text) {
    const s = String(text || '');
    return /\\newif\s*\\iflaishowchanges/.test(s) &&
      /\\(?:long\s*)?\\def\s*\\lai|\\newcommand\s*\{\\lai\}|\\providecommand\s*\{\\lai\}/.test(s);
  }

  function hasXColor(text) {
    return /\\usepackage(?:\[[^\]]*\])?\{[^}]*\bxcolor\b[^}]*\}/.test(String(text || ''));
  }

  function macroBlock() {
    // Avoid the literal sequence "{%" in this file: GitHub Pages/Jekyll can parse it.
    const open = '{' + '%';
    return [
      '% --- Latexai AI-change highlighting macro ---',
      '% Set this to \\laishowchangesfalse to hide red AI markup.',
      '\\newif\\iflaishowchanges',
      '\\laishowchangestrue',
      '\\long\\def\\lai#1' + open,
      '  \\iflaishowchanges',
      '    {\\color{red}#1}%',
      '  \\else',
      '    #1%',
      '  \\fi',
      '}',
      '% --- end Latexai AI-change highlighting macro ---',
      ''
    ].join('\n');
  }

  function ensureMacroInText(tex) {
    let s = String(tex || '');
    if (hasLaiMacro(s)) return s;

    if (!hasXColor(s)) {
      const dc = s.match(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}\s*/);
      if (dc) s = s.slice(0, dc.index + dc[0].length) + '\\usepackage{xcolor}\n' + s.slice(dc.index + dc[0].length);
      else s = '\\usepackage{xcolor}\n' + s;
    }

    const macro = macroBlock();
    const begin = s.indexOf('\\begin{document}');
    if (begin >= 0) return s.slice(0, begin) + macro + '\n' + s.slice(begin);

    // If this is an included file without a document preamble, prepend a safe fallback.
    // This is not ideal for included files, but prevents undefined \lai during quick tests.
    return macro + '\n' + s;
  }

  function anyProjectFileUsesLai() {
    const files = getState()?.project?.files || {};
    for (const key of Object.keys(files)) {
      if (hasLaiUse(fileText(files[key]))) return true;
    }
    if (hasLaiUse(activeEditorText())) return true;
    return false;
  }

  function ensureLaiMacro(reason = 'manual') {
    const st = getState();
    const root = rootPath();
    let changed = false;

    // First ensure active editor is stored, otherwise State may not know about the freshly inserted \lai.
    const active = activePath();
    const edText = activeEditorText();
    if (edText && NS.State?.updateActiveText) {
      try { NS.State.updateActiveText(edText); } catch (_err) {}
    }

    if (!anyProjectFileUsesLai()) {
      badge('Stage 4M macro guard active');
      return false;
    }

    let rootFile = getFile(root);
    let rootText = fileText(rootFile);

    if (!rootFile && active === root) {
      rootText = edText;
    }

    if (rootText) {
      const next = ensureMacroInText(rootText);
      if (next !== rootText) {
        if (active === root) setActiveEditorText(next);
        updateFile(root, next);
        changed = true;
      }
    } else {
      // Last resort: active file gets the macro.
      const next = ensureMacroInText(edText);
      if (next !== edText) {
        setActiveEditorText(next);
        changed = true;
      }
    }

    // Persist so compile payload and Git commit both see it.
    try { NS.State?.save?.(); } catch (_err) {}

    if (changed) {
      badge('Stage 4M inserted \\lai macro', '#064', '#e8ffe8', '#5b5');
      try { NS.Main?.toast?.('Inserted \\lai macro into root preamble.'); } catch (_err) {}
    } else {
      badge('Stage 4M: \\lai macro present', '#064', '#e8ffe8', '#5b5');
    }

    return changed;
  }

  function patchCompile() {
    if (NS.CompilerProvider && !NS.CompilerProvider.__stage4mPatched) {
      const oldCompile = NS.CompilerProvider.compile?.bind(NS.CompilerProvider);
      if (oldCompile) {
        NS.CompilerProvider.compile = async function (...args) {
          ensureLaiMacro('before CompilerProvider.compile');
          return oldCompile(...args);
        };
      }
      NS.CompilerProvider.__stage4mPatched = true;
    }

    if (NS.Compiler && !NS.Compiler.__stage4mPatched) {
      const oldCompile = NS.Compiler.compile?.bind(NS.Compiler);
      if (oldCompile) {
        NS.Compiler.compile = async function (...args) {
          ensureLaiMacro('before Compiler.compile');
          return oldCompile(...args);
        };
      }
      NS.Compiler.__stage4mPatched = true;
    }

    const compileBtn = document.getElementById('compileBtn') || document.getElementById('compilePdfBtn');
    if (compileBtn && !compileBtn.__stage4mPatched) {
      compileBtn.addEventListener('click', () => ensureLaiMacro('compile button capture'), true);
      compileBtn.__stage4mPatched = true;
    }

    const refreshBtn = document.getElementById('refreshPreviewBtn');
    if (refreshBtn && !refreshBtn.__stage4mPatched) {
      refreshBtn.addEventListener('click', () => ensureLaiMacro('refresh preview capture'), true);
      refreshBtn.__stage4mPatched = true;
    }
  }

  function patchEditorMutation() {
    const el = editor();
    if (!el || el.__stage4mPatched) return;
    el.addEventListener('input', () => {
      if (hasLaiUse(el.value)) {
        setTimeout(() => ensureLaiMacro('editor input'), 50);
      }
    }, true);
    el.__stage4mPatched = true;
  }

  function boot() {
    window.__LATEXAI_STAGE4M_LAI_MACRO_GUARD_ACTIVE = true;
    if (document.body) badge('Stage 4M macro guard active');
    patchCompile();
    patchEditorMutation();
    setTimeout(() => ensureLaiMacro('boot'), 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  let count = 0;
  const id = setInterval(() => {
    boot();
    count += 1;
    if (count > 40) clearInterval(id);
  }, 250);

  window.LAI_STAGE4M_MACRO_GUARD = {
    STAGE,
    ensureLaiMacro,
    hasLaiMacro,
    hasLaiUse,
    ensureMacroInText
  };

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
