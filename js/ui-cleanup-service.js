/* Latexai Stage 15C UiCleanupService
 * Stage: stage15c-disable-copilot-card-collapse-1
 *
 * Emergency fix for Stage 15A/15B Copilot blank bars:
 * - completely disables Copilot card collapsing/wrapping;
 * - unwraps any old Stage 15A/15B collapsible card wrappers already in the DOM;
 * - forces all Copilot tool content visible;
 * - keeps only safe parts of UI cleanup: right-tab stabilization, compact mode,
 *   left/right panel scrolling.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage15c-disable-copilot-card-collapse-1';

  const STORAGE_COMPACT = 'latexai:stage15c:compact-mode';
  let rightObserver = null;
  let copilotObserver = null;

  function el(id) { return D.getElementById(id); }

  function storageGet(key, fallback = '') {
    try { return localStorage.getItem(key) || fallback; } catch (_err) { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_err) {}
  }

  function tabPanelForName(name) {
    return el(`${name}Tab`);
  }

  function activeRightTabName() {
    const tab = D.querySelector('.right-tab.active[data-right-tab]');
    return tab?.dataset?.rightTab || 'preview';
  }

  function activateRightTab(name = activeRightTabName()) {
    const tabs = Array.from(D.querySelectorAll('.right-tab[data-right-tab]'));
    const panels = Array.from(D.querySelectorAll('.right-tab-panel'));
    const targetTab = tabs.find((tab) => tab.dataset.rightTab === name) || tabs[0];
    const targetName = targetTab?.dataset?.rightTab || 'preview';
    const targetPanel = tabPanelForName(targetName);

    tabs.forEach((tab) => {
      const active = tab === targetTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel) => {
      const active = panel === targetPanel;
      panel.classList.toggle('active', active);
      panel.classList.toggle('stage15c-hidden-panel', !active);
      if (!active) panel.setAttribute('aria-hidden', 'true');
      else panel.removeAttribute('aria-hidden');
    });

    return targetName;
  }

  function bindRightTabs() {
    D.querySelectorAll('.right-tab[data-right-tab]').forEach((tab) => {
      if (tab.dataset.stage15cBound === '1') return;
      tab.dataset.stage15cBound = '1';
      tab.addEventListener('click', () => {
        setTimeout(() => activateRightTab(tab.dataset.rightTab), 0);
      }, true);
    });
  }

  function observeRightPanel() {
    const panel = D.querySelector('.right-panel');
    if (!panel || rightObserver) return;
    rightObserver = new MutationObserver(() => {
      const activePanels = D.querySelectorAll('.right-tab-panel.active');
      if (activePanels.length !== 1) activateRightTab(activeRightTabName());
    });
    rightObserver.observe(panel, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
  }

  function unwrapOneCard(card) {
    if (!card || card.dataset.stage15cUnwrapped === '1') return false;

    const header = card.querySelector(':scope > .stage15a-card-header, :scope > .stage15b-card-header');
    const body = card.querySelector(':scope > .stage15a-card-body, :scope > .stage15b-card-body');

    if (!header && !body && !card.classList.contains('stage15a-collapsible-card') && !card.classList.contains('stage15b-collapsible-card')) {
      return false;
    }

    if (body) {
      body.hidden = false;
      body.style.display = '';
      while (body.firstChild) {
        card.insertBefore(body.firstChild, body);
      }
      body.remove();
    }

    if (header) header.remove();

    card.classList.remove(
      'stage15a-collapsible-card',
      'stage15a-expanded',
      'stage15a-collapsed',
      'stage15b-collapsible-card',
      'stage15b-expanded',
      'stage15b-collapsed'
    );
    card.removeAttribute('data-stage15a-collapsible');
    card.removeAttribute('data-stage15b-collapsible');
    card.removeAttribute('data-stage15a-key');
    card.removeAttribute('data-stage15b-key');
    card.dataset.stage15cUnwrapped = '1';

    return true;
  }

  function unwrapLegacyCopilotCards() {
    const panel = el('copilotTab');
    if (!panel) return 0;

    let changed = 0;
    panel.querySelectorAll('.stage15a-collapsible-card, .stage15b-collapsible-card').forEach((card) => {
      if (unwrapOneCard(card)) changed += 1;
    });

    // Also recover orphaned card bodies if an older wrapper left them hidden.
    panel.querySelectorAll('.stage15a-card-body, .stage15b-card-body').forEach((body) => {
      body.hidden = false;
      body.style.display = '';
      body.classList.remove('stage15a-card-body', 'stage15b-card-body');
    });

    // Hide any leftover blank card headers from old stages.
    panel.querySelectorAll('.stage15a-card-header, .stage15b-card-header').forEach((header) => {
      header.remove();
      changed += 1;
    });

    return changed;
  }

  function forceCopilotContentVisible() {
    const panel = el('copilotTab');
    if (!panel) return false;

    panel.classList.add('stage15c-copilot-stable');

    // Do not collapse anything inside Copilot in Stage 15C.
    panel.querySelectorAll('[hidden]').forEach((node) => {
      if (node.id === 'patchReview' && node.classList.contains('hidden')) return;
      node.hidden = false;
    });

    panel.querySelectorAll('.stage15a-collapsed, .stage15b-collapsed').forEach((node) => {
      node.classList.remove('stage15a-collapsed', 'stage15b-collapsed');
    });

    return true;
  }

  function observeCopilotPanel() {
    const panel = el('copilotTab');
    if (!panel || copilotObserver) return;

    copilotObserver = new MutationObserver(() => {
      unwrapLegacyCopilotCards();
      forceCopilotContentVisible();
    });
    copilotObserver.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  }

  function addCleanupControls() {
    if (el('stage15cUiControls')) return true;

    const tabs = D.querySelector('.right-tabs');
    if (!tabs) return false;

    // Remove Stage 15A/15B controls if they exist.
    el('stage15aCompactToggle')?.closest?.('.stage15a-compact-toggle-wrap')?.remove();
    el('stage15bUiControls')?.remove();

    const wrap = D.createElement('div');
    wrap.id = 'stage15cUiControls';
    wrap.className = 'stage15c-ui-controls';
    wrap.innerHTML = [
      '<label class="stage15c-toggle">',
      '  <input id="stage15cCompactToggle" type="checkbox" />',
      '  Compact',
      '</label>',
      '<button id="stage15cRestoreCopilotBtn" class="btn mini" type="button">Restore Copilot tools</button>'
    ].join('');
    tabs.insertAdjacentElement('afterend', wrap);

    const compact = el('stage15cCompactToggle');
    const storedCompact = storageGet(STORAGE_COMPACT, '');
    const compactEnabled = storedCompact ? storedCompact === '1' : W.matchMedia?.('(max-width: 980px)')?.matches;
    compact.checked = Boolean(compactEnabled);
    D.body.classList.toggle('stage15c-compact', Boolean(compactEnabled));
    compact.addEventListener('change', () => {
      D.body.classList.toggle('stage15c-compact', compact.checked);
      storageSet(STORAGE_COMPACT, compact.checked ? '1' : '0');
    }, true);

    el('stage15cRestoreCopilotBtn')?.addEventListener('click', () => {
      unwrapLegacyCopilotCards();
      forceCopilotContentVisible();
    }, true);

    return true;
  }

  function addPanelClasses() {
    D.body.classList.add('stage15c-ui-cleanup');
    D.body.classList.remove(
      'stage15a-ui-cleanup',
      'stage15a-compact',
      'stage15b-ui-cleanup',
      'stage15b-compact',
      'stage15b-focus-mode'
    );

    D.querySelector('.left-panel')?.classList.add('stage15c-left-stable');
    D.querySelector('.right-panel')?.classList.add('stage15c-right-stable');
    el('fileTree')?.classList.add('stage15c-scroll-region');
    el('outlineList')?.classList.add('stage15c-scroll-region');
    el('copilotTab')?.classList.add('stage15c-copilot-stable');
    el('settingsTab')?.classList.add('stage15c-settings-stable');
  }

  function restoreCopilotTools() {
    const changed = unwrapLegacyCopilotCards();
    forceCopilotContentVisible();
    return changed;
  }

  function init() {
    addPanelClasses();
    bindRightTabs();
    activateRightTab(activeRightTabName());
    observeRightPanel();
    addCleanupControls();
    restoreCopilotTools();
    observeCopilotPanel();
  }

  NS.UiCleanupService = {
    STAGE,
    init,
    activateRightTab,
    unwrapLegacyCopilotCards,
    forceCopilotContentVisible,
    restoreCopilotTools
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    init();
    tries += 1;
    if (tries > 80) clearInterval(interval);
  }, 350);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
