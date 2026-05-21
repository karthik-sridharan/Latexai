/* Latexai Stage 15E SafeModeService
 * Stage: stage15e-safe-mode-recovery-1
 *
 * Recovery layer:
 * - ?safe=1 starts in safe mode;
 * - ?resetUi=1 clears Stage 15 UI state without touching project files;
 * - ?disableExperimentalUi=1 persists a disable flag for optional UI scripts;
 * - ?disableExperimentalUi=0 clears that flag;
 * - exposes window.LatexaiSafeMode for optional scripts to self-disable.
 *
 * Keep this script tiny and loaded before deferred feature scripts.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const STAGE = 'stage15e-safe-mode-recovery-1';
  const DISABLE_KEY = 'latexai:safe:disableExperimentalUi';
  const RESET_DONE_KEY = 'latexai:safe:lastResetAt';

  const params = new URLSearchParams(W.location.search);
  const requestedSafe = params.get('safe') === '1' || params.get('safe') === 'true';
  const requestedReset = params.get('resetUi') === '1' || params.get('resetUi') === 'true';
  const disableParam = params.get('disableExperimentalUi');

  function lsGet(key, fallback = '') {
    try { return localStorage.getItem(key) || fallback; } catch (_err) { return fallback; }
  }

  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_err) {}
  }

  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (_err) {}
  }

  function stage15Keys() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (/^latexai:stage15/i.test(key) || /^latexai:safe:/i.test(key) || /ui-cleanup|copilot-card|collapsed-cards|compact-mode|focus-mode/i.test(key)) {
          keys.push(key);
        }
      }
    } catch (_err) {}
    return keys;
  }

  function resetUiState() {
    const removed = [];
    for (const key of stage15Keys()) {
      if (key === RESET_DONE_KEY) continue;
      lsRemove(key);
      removed.push(key);
    }
    lsSet(RESET_DONE_KEY, new Date().toISOString());
    return removed;
  }

  if (disableParam === '1' || disableParam === 'true') lsSet(DISABLE_KEY, '1');
  if (disableParam === '0' || disableParam === 'false') lsRemove(DISABLE_KEY);

  const resetKeysRemoved = requestedReset ? resetUiState() : [];
  const experimentalDisabled = () => lsGet(DISABLE_KEY, '') === '1';
  const isSafeMode = () => requestedSafe || experimentalDisabled();

  function shouldDisableOptionalScript(name) {
    const n = String(name || '').toLowerCase();
    if (!isSafeMode()) return false;
    // Disable only optional UI-enhancement scripts, not core editor/compiler/app code.
    return /ui-cleanup|collapsible|panel-stabil|experimental-ui|stage15/.test(n);
  }

  function bootReport() {
    return {
      stage: STAGE,
      safeMode: isSafeMode(),
      requestedSafe,
      requestedReset,
      experimentalUiDisabled: experimentalDisabled(),
      resetKeysRemoved,
      url: W.location.href,
      userAgent: navigator.userAgent,
      loadedAt: new Date().toISOString(),
      activeAppStage: W.LUMINA_LATEX_STAGE || '',
      readyState: D.readyState
    };
  }

  function copyText(text) {
    try {
      return navigator.clipboard.writeText(text);
    } catch (_err) {
      return Promise.reject(_err);
    }
  }

  function injectRecoveryBar() {
    if (D.getElementById('safeModeRecoveryBar')) return;
    const bar = D.createElement('div');
    bar.id = 'safeModeRecoveryBar';
    bar.className = 'safe-mode-recovery-bar';
    bar.innerHTML = [
      '<div>',
      `  <strong>Latexai recovery</strong>`,
      `  <span id="safeModeRecoveryText">${isSafeMode() ? 'Safe mode is ON.' : 'Safe mode ready.'}</span>`,
      '</div>',
      '<div class="safe-mode-recovery-actions">',
      '  <button id="safeModeResetUiBtn" class="btn mini" type="button">Reset UI state</button>',
      `  <button id="safeModeToggleExperimentalBtn" class="btn mini" type="button">${experimentalDisabled() ? 'Enable experimental UI' : 'Disable experimental UI'}</button>`,
      '  <button id="safeModeCopyBootBtn" class="btn mini" type="button">Copy boot report</button>',
      '</div>'
    ].join('');

    const app = D.querySelector('.app-shell') || D.body;
    app.insertBefore(bar, app.firstChild);

    D.getElementById('safeModeResetUiBtn')?.addEventListener('click', () => {
      const removed = resetUiState();
      D.getElementById('safeModeRecoveryText').textContent = `Reset UI state (${removed.length} key(s) removed). Reloading...`;
      setTimeout(() => {
        const url = new URL(W.location.href);
        url.searchParams.set('safe', '1');
        url.searchParams.delete('resetUi');
        W.location.href = url.href;
      }, 250);
    });

    D.getElementById('safeModeToggleExperimentalBtn')?.addEventListener('click', () => {
      if (experimentalDisabled()) lsRemove(DISABLE_KEY);
      else lsSet(DISABLE_KEY, '1');
      const url = new URL(W.location.href);
      url.searchParams.set('safe', experimentalDisabled() ? '1' : '0');
      W.location.href = url.href;
    });

    D.getElementById('safeModeCopyBootBtn')?.addEventListener('click', async () => {
      const text = JSON.stringify(bootReport(), null, 2);
      try {
        await copyText(text);
        D.getElementById('safeModeRecoveryText').textContent = 'Boot report copied.';
      } catch (_err) {
        D.getElementById('safeModeRecoveryText').textContent = text;
      }
    });
  }

  W.LatexaiSafeMode = {
    STAGE,
    isSafeMode,
    requestedSafe,
    requestedReset,
    experimentalDisabled,
    shouldDisableOptionalScript,
    resetUiState,
    bootReport
  };

  const applyBodyClass = () => {
    D.body?.classList.toggle('latexai-safe-mode', isSafeMode());
    D.documentElement.classList.toggle('latexai-safe-mode', isSafeMode());
  };

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', () => {
      applyBodyClass();
      injectRecoveryBar();
    }, { once: true });
  } else {
    applyBodyClass();
    injectRecoveryBar();
  }

  try { console.log('[Latexai]', STAGE, bootReport()); } catch (_err) {}
})();
