/* Latexai Stage 15A UiCleanupService
 * Stage: stage15a-ui-cleanup-panel-stabilization-1
 *
 * UI cleanup and panel stabilization:
 * - ensures only one right-panel tab is active at a time;
 * - prevents Preview/Logs/Copilot/Settings panels from being open together;
 * - makes Copilot-added tool cards collapsible;
 * - keeps only one major AI/export card expanded at once;
 * - adds compact mode for iPad/small screens;
 * - applies left/right panel scrolling/layout stabilization classes.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage15a-ui-cleanup-panel-stabilization-1';

  const STORAGE_COMPACT = 'latexai:stage15a:compact-mode';
  const STORAGE_EXPANDED = 'latexai:stage15a:expanded-card';

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
      panel.classList.toggle('stage15a-hidden-panel', !active);
      if (!active) {
        panel.setAttribute('aria-hidden', 'true');
        try { panel.inert = true; } catch (_err) {}
      } else {
        panel.removeAttribute('aria-hidden');
        try { panel.inert = false; } catch (_err) {}
      }
    });

    return targetName;
  }

  function bindRightTabs() {
    D.querySelectorAll('.right-tab[data-right-tab]').forEach((tab) => {
      if (tab.dataset.stage15aBound === '1') return;
      tab.dataset.stage15aBound = '1';
      tab.addEventListener('click', () => {
        // Run after legacy handlers too, so Stage 15A is the final arbiter.
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

  function cardTitle(card) {
    const explicit = card.dataset.stage15aTitle;
    if (explicit) return explicit;

    const heading = card.querySelector('h3, h2, .section-head h2, .smallcaps, strong');
    const text = String(heading?.textContent || '').trim().replace(/\s+/g, ' ');
    if (text) return text;

    const id = card.id || '';
    if (id) return id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

    return 'Tool';
  }

  function isMajorCopilotCard(node) {
    if (!node || node.nodeType !== 1) return false;
    if (!el('copilotTab')?.contains(node)) return false;
    if (node.closest('.stage15a-card-body')) return false;
    if (node.classList?.contains('section-head')) return false;
    if (node.classList?.contains('field-grid')) return false;
    if (node.matches?.('label.field, textarea, pre, select, input, button')) return false;

    const id = node.id || '';
    const cls = node.className || '';
    if (/Card$/.test(id)) return true;
    if (/(document-ai-card|citation-ai-card|citation-verifier-card|presentation-export-card|tikz|figure|image-to-tikz|review|export-card)/i.test(cls)) return true;

    return false;
  }

  function setCardExpanded(card, expanded, persist = true) {
    const body = card.querySelector(':scope > .stage15a-card-body');
    const button = card.querySelector(':scope > .stage15a-card-header .stage15a-card-toggle');
    if (!body || !button) return;

    card.classList.toggle('stage15a-expanded', expanded);
    card.classList.toggle('stage15a-collapsed', !expanded);
    body.hidden = !expanded;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.querySelector('.stage15a-card-caret').textContent = expanded ? '▾' : '▸';

    if (expanded && persist) storageSet(STORAGE_EXPANDED, card.id || card.dataset.stage15aKey || '');
  }

  function collapseSiblingCards(card) {
    const panel = el('copilotTab');
    if (!panel) return;
    panel.querySelectorAll(':scope > .stage15a-collapsible-card').forEach((other) => {
      if (other !== card) setCardExpanded(other, false, false);
    });
  }

  function makeCardCollapsible(card) {
    if (!card || card.dataset.stage15aCollapsible === '1') return false;
    if (!isMajorCopilotCard(card)) return false;

    card.dataset.stage15aCollapsible = '1';
    card.classList.add('stage15a-collapsible-card');

    const title = cardTitle(card);
    const key = card.id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    card.dataset.stage15aKey = key;

    const header = D.createElement('div');
    header.className = 'stage15a-card-header';

    const button = D.createElement('button');
    button.type = 'button';
    button.className = 'stage15a-card-toggle';
    button.innerHTML = `<span class="stage15a-card-caret" aria-hidden="true">▸</span><span class="stage15a-card-title"></span>`;
    button.querySelector('.stage15a-card-title').textContent = title;

    const meta = D.createElement('span');
    meta.className = 'stage15a-card-meta';
    meta.textContent = 'Expand';

    header.append(button, meta);

    const body = D.createElement('div');
    body.className = 'stage15a-card-body';

    while (card.firstChild) body.appendChild(card.firstChild);
    card.append(header, body);

    button.addEventListener('click', () => {
      const expanded = !card.classList.contains('stage15a-expanded');
      if (expanded) collapseSiblingCards(card);
      setCardExpanded(card, expanded);
    }, true);

    const saved = storageGet(STORAGE_EXPANDED, '');
    const shouldExpand = saved ? saved === key : false;
    setCardExpanded(card, shouldExpand, false);

    return true;
  }

  function processCopilotCards() {
    const panel = el('copilotTab');
    if (!panel) return false;

    Array.from(panel.children).forEach((child) => makeCardCollapsible(child));

    // If no saved card is open, keep everything collapsed to reduce clutter.
    const saved = storageGet(STORAGE_EXPANDED, '');
    if (saved) {
      const savedCard = panel.querySelector(`:scope > .stage15a-collapsible-card[id="${CSS.escape(saved)}"], :scope > .stage15a-collapsible-card[data-stage15a-key="${CSS.escape(saved)}"]`);
      if (savedCard) {
        collapseSiblingCards(savedCard);
        setCardExpanded(savedCard, true, false);
      }
    }

    return true;
  }

  function observeCopilotPanel() {
    const panel = el('copilotTab');
    if (!panel || copilotObserver) return;

    copilotObserver = new MutationObserver(() => {
      processCopilotCards();
    });
    copilotObserver.observe(panel, { childList: true, subtree: false });
  }

  function addCompactToggle() {
    if (el('stage15aCompactToggle')) return true;

    const tabs = D.querySelector('.right-tabs');
    if (!tabs) return false;

    const wrap = D.createElement('div');
    wrap.className = 'stage15a-compact-toggle-wrap';
    wrap.innerHTML = [
      '<label class="stage15a-compact-toggle">',
      '  <input id="stage15aCompactToggle" type="checkbox" />',
      '  Compact',
      '</label>'
    ].join('');
    tabs.insertAdjacentElement('afterend', wrap);

    const checkbox = el('stage15aCompactToggle');
    const stored = storageGet(STORAGE_COMPACT, '');
    const enabled = stored ? stored === '1' : W.matchMedia?.('(max-width: 980px)')?.matches;
    checkbox.checked = Boolean(enabled);
    D.body.classList.toggle('stage15a-compact', Boolean(enabled));

    checkbox.addEventListener('change', () => {
      D.body.classList.toggle('stage15a-compact', checkbox.checked);
      storageSet(STORAGE_COMPACT, checkbox.checked ? '1' : '0');
    }, true);

    return true;
  }

  function addPanelClasses() {
    D.body.classList.add('stage15a-ui-cleanup');
    D.querySelector('.left-panel')?.classList.add('stage15a-left-stable');
    D.querySelector('.right-panel')?.classList.add('stage15a-right-stable');
    el('fileTree')?.classList.add('stage15a-scroll-region');
    el('outlineList')?.classList.add('stage15a-scroll-region');
    el('copilotTab')?.classList.add('stage15a-copilot-stable');
    el('settingsTab')?.classList.add('stage15a-settings-stable');
  }

  function expandCardById(id) {
    const card = el(id);
    if (!card) return false;
    makeCardCollapsible(card);
    collapseSiblingCards(card);
    setCardExpanded(card, true);
    const copilotTab = D.querySelector('.right-tab[data-right-tab="copilot"]');
    if (copilotTab) activateRightTab('copilot');
    return true;
  }

  function collapseAllCards() {
    el('copilotTab')?.querySelectorAll(':scope > .stage15a-collapsible-card').forEach((card) => setCardExpanded(card, false, false));
    storageSet(STORAGE_EXPANDED, '');
  }

  function init() {
    addPanelClasses();
    bindRightTabs();
    activateRightTab(activeRightTabName());
    observeRightPanel();
    addCompactToggle();
    processCopilotCards();
    observeCopilotPanel();
  }

  NS.UiCleanupService = {
    STAGE,
    init,
    activateRightTab,
    processCopilotCards,
    makeCardCollapsible,
    expandCardById,
    collapseAllCards
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    init();
    tries += 1;
    if (tries > 60) clearInterval(interval);
  }, 500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
