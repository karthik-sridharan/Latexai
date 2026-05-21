/* Latexai Stage 15B UiCleanupService
 * Stage: stage15b-copilot-card-visibility-fix-1
 *
 * Fixes Stage 15A over-aggressive Copilot card collapsing.
 *
 * Stage 15B keeps the useful layout stabilization but changes Copilot behavior:
 * - only known major tool cards are made collapsible;
 * - cards are expanded by default, so tools do not disappear into blank bars;
 * - card headers always get a readable title;
 * - "focus one tool" accordion behavior is optional and OFF by default;
 * - right-panel tab stabilization remains, but inactive tabs are not made inert.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage15b-copilot-card-visibility-fix-1';

  const STORAGE_COMPACT = 'latexai:stage15b:compact-mode';
  const STORAGE_FOCUS = 'latexai:stage15b:focus-mode';
  const STORAGE_COLLAPSED = 'latexai:stage15b:collapsed-cards';

  let rightObserver = null;
  let copilotObserver = null;

  const FRIENDLY_TITLES = {
    presentationExportCard: 'Paper → Presentation exporter',
    citationVerifierCard: 'Local citation verifier',
    citationAiCard: 'Citation AI',
    documentAiCard: 'Paper-level AI',
    tikzFigureCard: 'TikZ figure maker',
    imageToTikzCard: 'Image → TikZ',
    figureToolsCard: 'Figure tools',
    aiFigureCard: 'AI figure tools'
  };

  const KNOWN_CARD_SELECTORS = [
    '#presentationExportCard',
    '#citationVerifierCard',
    '#citationAiCard',
    '#documentAiCard',
    '#tikzFigureCard',
    '#imageToTikzCard',
    '#figureToolsCard',
    '#aiFigureCard',
    '.presentation-export-card',
    '.citation-verifier-card',
    '.citation-ai-card',
    '.document-ai-card',
    '.tikz-figure-card',
    '.image-to-tikz-card'
  ].join(',');

  function el(id) { return D.getElementById(id); }

  function storageGet(key, fallback = '') {
    try { return localStorage.getItem(key) || fallback; } catch (_err) { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_err) {}
  }

  function collapsedSet() {
    const raw = storageGet(STORAGE_COLLAPSED, '');
    return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  }

  function saveCollapsedSet(set) {
    storageSet(STORAGE_COLLAPSED, [...set].join(','));
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
      panel.classList.toggle('stage15b-hidden-panel', !active);
      if (!active) panel.setAttribute('aria-hidden', 'true');
      else panel.removeAttribute('aria-hidden');
    });

    return targetName;
  }

  function bindRightTabs() {
    D.querySelectorAll('.right-tab[data-right-tab]').forEach((tab) => {
      if (tab.dataset.stage15bBound === '1') return;
      tab.dataset.stage15bBound = '1';
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

  function cardKey(card) {
    return card.id || card.dataset.stage15bKey || '';
  }

  function cardTitle(card) {
    if (!card) return 'Tool';
    if (card.id && FRIENDLY_TITLES[card.id]) return FRIENDLY_TITLES[card.id];

    const heading = card.querySelector(':scope > h3, :scope > h2, :scope .section-head h2, :scope .smallcaps, :scope strong');
    const text = String(heading?.textContent || '').trim().replace(/\s+/g, ' ');
    if (text) return text;

    const id = card.id || '';
    if (id) {
      return id
        .replace(/Card$/, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase());
    }

    const cls = String(card.className || '').split(/\s+/).find((c) => /card/i.test(c)) || 'Tool';
    return cls.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function isKnownCopilotCard(node) {
    if (!node || node.nodeType !== 1) return false;
    const panel = el('copilotTab');
    if (!panel || !panel.contains(node)) return false;
    if (node.closest('.stage15b-card-body')) return false;
    if (!node.matches?.(KNOWN_CARD_SELECTORS)) return false;
    return true;
  }

  function focusModeEnabled() {
    const box = el('stage15bFocusModeToggle');
    if (box) return box.checked;
    return storageGet(STORAGE_FOCUS, '0') === '1';
  }

  function setCardExpanded(card, expanded, persist = true) {
    const body = card.querySelector(':scope > .stage15b-card-body');
    const button = card.querySelector(':scope > .stage15b-card-header .stage15b-card-toggle');
    const meta = card.querySelector(':scope > .stage15b-card-header .stage15b-card-meta');
    if (!body || !button) return;

    card.classList.toggle('stage15b-expanded', expanded);
    card.classList.toggle('stage15b-collapsed', !expanded);
    body.hidden = !expanded;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    const caret = button.querySelector('.stage15b-card-caret');
    if (caret) caret.textContent = expanded ? '▾' : '▸';
    if (meta) meta.textContent = expanded ? 'Open' : 'Collapsed';

    if (persist) {
      const set = collapsedSet();
      const key = cardKey(card);
      if (key) {
        if (expanded) set.delete(key);
        else set.add(key);
        saveCollapsedSet(set);
      }
    }
  }

  function collapseSiblingCards(card) {
    if (!focusModeEnabled()) return;
    const panel = el('copilotTab');
    if (!panel) return;
    panel.querySelectorAll(':scope > .stage15b-collapsible-card').forEach((other) => {
      if (other !== card) setCardExpanded(other, false, true);
    });
  }

  function makeCardCollapsible(card) {
    if (!card || card.dataset.stage15bCollapsible === '1') return false;
    if (!isKnownCopilotCard(card)) return false;

    card.dataset.stage15bCollapsible = '1';
    card.classList.add('stage15b-collapsible-card');

    const title = cardTitle(card);
    const key = card.id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    card.dataset.stage15bKey = key;

    const header = D.createElement('div');
    header.className = 'stage15b-card-header';

    const button = D.createElement('button');
    button.type = 'button';
    button.className = 'stage15b-card-toggle';
    button.innerHTML = '<span class="stage15b-card-caret" aria-hidden="true">▾</span><span class="stage15b-card-title"></span>';
    button.querySelector('.stage15b-card-title').textContent = title;

    const meta = D.createElement('span');
    meta.className = 'stage15b-card-meta';
    meta.textContent = 'Open';

    header.append(button, meta);

    const body = D.createElement('div');
    body.className = 'stage15b-card-body';

    while (card.firstChild) body.appendChild(card.firstChild);
    card.append(header, body);

    button.addEventListener('click', () => {
      const expanded = !card.classList.contains('stage15b-expanded');
      if (expanded) collapseSiblingCards(card);
      setCardExpanded(card, expanded);
    }, true);

    const collapsed = collapsedSet();
    const shouldExpand = !collapsed.has(key); // expanded by default
    setCardExpanded(card, shouldExpand, false);

    return true;
  }

  function processCopilotCards() {
    const panel = el('copilotTab');
    if (!panel) return false;
    Array.from(panel.children).forEach((child) => {
      if (child.matches?.(KNOWN_CARD_SELECTORS)) makeCardCollapsible(child);
    });
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

  function addCleanupControls() {
    if (el('stage15bUiControls')) return true;

    const tabs = D.querySelector('.right-tabs');
    if (!tabs) return false;

    const wrap = D.createElement('div');
    wrap.id = 'stage15bUiControls';
    wrap.className = 'stage15b-ui-controls';
    wrap.innerHTML = [
      '<label class="stage15b-toggle">',
      '  <input id="stage15bCompactToggle" type="checkbox" />',
      '  Compact',
      '</label>',
      '<label class="stage15b-toggle">',
      '  <input id="stage15bFocusModeToggle" type="checkbox" />',
      '  Focus one tool',
      '</label>',
      '<button id="stage15bExpandToolsBtn" class="btn mini" type="button">Expand tools</button>'
    ].join('');
    tabs.insertAdjacentElement('afterend', wrap);

    const compact = el('stage15bCompactToggle');
    const storedCompact = storageGet(STORAGE_COMPACT, '');
    const compactEnabled = storedCompact ? storedCompact === '1' : W.matchMedia?.('(max-width: 980px)')?.matches;
    compact.checked = Boolean(compactEnabled);
    D.body.classList.toggle('stage15b-compact', Boolean(compactEnabled));
    compact.addEventListener('change', () => {
      D.body.classList.toggle('stage15b-compact', compact.checked);
      storageSet(STORAGE_COMPACT, compact.checked ? '1' : '0');
    }, true);

    const focus = el('stage15bFocusModeToggle');
    focus.checked = storageGet(STORAGE_FOCUS, '0') === '1';
    D.body.classList.toggle('stage15b-focus-mode', focus.checked);
    focus.addEventListener('change', () => {
      storageSet(STORAGE_FOCUS, focus.checked ? '1' : '0');
      D.body.classList.toggle('stage15b-focus-mode', focus.checked);
    }, true);

    el('stage15bExpandToolsBtn')?.addEventListener('click', expandAllCards, true);

    return true;
  }

  function addPanelClasses() {
    D.body.classList.add('stage15b-ui-cleanup');
    // Remove old Stage 15A class effects if both files are cached.
    D.body.classList.remove('stage15a-ui-cleanup', 'stage15a-compact');

    D.querySelector('.left-panel')?.classList.add('stage15b-left-stable');
    D.querySelector('.right-panel')?.classList.add('stage15b-right-stable');
    el('fileTree')?.classList.add('stage15b-scroll-region');
    el('outlineList')?.classList.add('stage15b-scroll-region');
    el('copilotTab')?.classList.add('stage15b-copilot-stable');
    el('settingsTab')?.classList.add('stage15b-settings-stable');
  }

  function expandCardById(id) {
    const card = el(id);
    if (!card) return false;
    makeCardCollapsible(card);
    collapseSiblingCards(card);
    setCardExpanded(card, true);
    activateRightTab('copilot');
    return true;
  }

  function expandAllCards() {
    const panel = el('copilotTab');
    panel?.querySelectorAll(':scope > .stage15b-collapsible-card').forEach((card) => setCardExpanded(card, true, true));
    saveCollapsedSet(new Set());
  }

  function collapseAllCards() {
    const panel = el('copilotTab');
    panel?.querySelectorAll(':scope > .stage15b-collapsible-card').forEach((card) => setCardExpanded(card, false, true));
  }

  function init() {
    addPanelClasses();
    bindRightTabs();
    activateRightTab(activeRightTabName());
    observeRightPanel();
    addCleanupControls();
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
    expandAllCards,
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
