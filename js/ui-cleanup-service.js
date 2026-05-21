/* Latexai Stage 15D UiCleanupService
 * Stage: stage15d-freeze-hotfix-disable-ui-cleanup-1
 *
 * Emergency freeze hotfix.
 *
 * Stage 15A/15B/15C tried to stabilize/collapse/unwrap Copilot panels using
 * MutationObservers. On Safari/iPad this can cause repeated DOM mutations and
 * make the page appear frozen.
 *
 * Stage 15D intentionally disables all Copilot card rewriting and observers.
 * It only:
 * - exposes a tiny UiCleanupService API for compatibility;
 * - removes old Stage 15 body classes if present;
 * - makes the right tabs clickable without observing/mutating in loops.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage15d-freeze-hotfix-disable-ui-cleanup-1';

  // Stage 15E safe-mode gate. Optional UI cleanup must not run in safe mode.
  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('ui-cleanup-service')) {
    NS.UiCleanupService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false,
      activateRightTab: () => '',
      restoreCopilotTools: () => 0
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  function el(id) { return D.getElementById(id); }

  function clearOldUiCleanupClasses() {
    D.body.classList.remove(
      'stage15a-ui-cleanup',
      'stage15a-compact',
      'stage15b-ui-cleanup',
      'stage15b-compact',
      'stage15b-focus-mode',
      'stage15c-ui-cleanup',
      'stage15c-compact'
    );
    D.body.classList.add('stage15d-freeze-hotfix');

    // Remove old UI-control rows if they were inserted by stale cached scripts.
    el('stage15aCompactToggle')?.closest?.('.stage15a-compact-toggle-wrap')?.remove();
    el('stage15bUiControls')?.remove();
    el('stage15cUiControls')?.remove();
  }

  function activateRightTab(name) {
    const tabs = Array.from(D.querySelectorAll('.right-tab[data-right-tab]'));
    if (!tabs.length) return '';

    const targetTab = tabs.find((tab) => tab.dataset.rightTab === name) || D.querySelector('.right-tab.active[data-right-tab]') || tabs[0];
    const targetName = targetTab.dataset.rightTab;

    tabs.forEach((tab) => {
      const active = tab === targetTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    D.querySelectorAll('.right-tab-panel').forEach((panel) => {
      const active = panel.id === `${targetName}Tab`;
      panel.classList.toggle('active', active);
      if (active) panel.removeAttribute('aria-hidden');
      else panel.setAttribute('aria-hidden', 'true');
    });

    return targetName;
  }

  function bindRightTabsOnce() {
    D.querySelectorAll('.right-tab[data-right-tab]').forEach((tab) => {
      if (tab.dataset.stage15dBound === '1') return;
      tab.dataset.stage15dBound = '1';
      tab.addEventListener('click', () => {
        activateRightTab(tab.dataset.rightTab);
      }, false);
    });
  }

  function restoreCopilotTools() {
    // One-time cleanup only. No observers. No repeated mutation loops.
    const panel = el('copilotTab');
    if (!panel) return 0;

    let changed = 0;

    panel.querySelectorAll('.stage15a-card-header, .stage15b-card-header').forEach((header) => {
      header.remove();
      changed += 1;
    });

    panel.querySelectorAll('.stage15a-card-body, .stage15b-card-body').forEach((body) => {
      body.hidden = false;
      body.style.display = '';
      while (body.firstChild) body.parentElement.insertBefore(body.firstChild, body);
      body.remove();
      changed += 1;
    });

    panel.querySelectorAll('.stage15a-collapsible-card, .stage15b-collapsible-card').forEach((card) => {
      card.classList.remove(
        'stage15a-collapsible-card',
        'stage15a-expanded',
        'stage15a-collapsed',
        'stage15b-collapsible-card',
        'stage15b-expanded',
        'stage15b-collapsed'
      );
      changed += 1;
    });

    return changed;
  }

  function init() {
    clearOldUiCleanupClasses();
    bindRightTabsOnce();
    activateRightTab();
    restoreCopilotTools();
  }

  NS.UiCleanupService = {
    STAGE,
    init,
    activateRightTab,
    restoreCopilotTools,
    // Compatibility stubs for older calls:
    processCopilotCards: () => true,
    makeCardCollapsible: () => false,
    expandCardById: () => false,
    expandAllCards: () => true,
    collapseAllCards: () => true
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
