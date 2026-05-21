/* Latexai Stage 15J FeatureFlagService
 * Stage: stage15j-feature-flag-registry-guarded-loader-1
 *
 * Central feature registry + guarded optional-script loader.
 *
 * This is intentionally small and core-loaded. Optional scripts are represented
 * in index.html as inert placeholders:
 *
 *   <script type="application/latexai-feature-script"
 *           data-feature="presentation-export"
 *           data-src="js/presentation-export-service.js?..."></script>
 *
 * This service decides which placeholders to load.
 *
 * No MutationObservers. No intervals. No compile jobs. No AI calls.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage15j-feature-flag-registry-guarded-loader-1';
  const STORAGE_KEY = 'latexai:feature-flags:v1';
  const LAST_ADDED_FEATURE = 'release-verifier';

  const REGISTRY = [
    { key: 'presentation-export', title: 'Presentation/talk export', tier: 'stable', defaultEnabled: true, description: 'Paper → presentation JSON/HTML/Beamer and talk package export.' },
    { key: 'paper-ai-polish', title: 'Paper AI edit review', tier: 'stable', defaultEnabled: true, description: 'Review and resolve \\lai / \\laiold paper-level AI edits before compile or commit.' },
    { key: 'citation-ai', title: 'Citation AI', tier: 'stable', defaultEnabled: true, description: 'Citation filler and missing BibTeX workflows.' },
    { key: 'citation-verifier', title: 'Citation verifier', tier: 'stable', defaultEnabled: true, description: 'Local citation report and BibTeX completeness checks.' },
    { key: 'compile-root-service', title: 'Active standalone compile root', tier: 'stable', defaultEnabled: true, description: 'Compile active standalone .tex files such as generated Beamer talks.' },
    { key: 'standalone-path-fixer', title: 'Standalone path fixer', tier: 'stable', defaultEnabled: true, description: 'Check/fix figure/input paths before standalone compile.' },
    { key: 'backend-diagnostics', title: 'Backend diagnostics', tier: 'stable', defaultEnabled: true, description: 'Backend health/status and boot diagnostics dashboard.' },
    { key: 'model-routing', title: 'Model/provider routing', tier: 'experimental', defaultEnabled: true, description: 'Developer workflow-to-model routing for AI calls.' },
    { key: 'regression-checklist', title: 'Regression checklist', tier: 'experimental', defaultEnabled: true, description: 'In-app local smoke checks and copyable report.' },
    { key: 'release-verifier', title: 'Release/deploy verifier', tier: 'experimental', defaultEnabled: true, description: 'Checks deployed files, cache busting, and loaded stage refs.' },
    { key: 'ui-cleanup', title: 'Experimental UI cleanup', tier: 'experimental', defaultEnabled: false, description: 'Optional UI cleanup. Disabled by default after Stage 15A–15C instability.' }
  ];

  const status = {};
  let loadStarted = false;
  let loadFinished = false;
  let lastReport = null;

  function el(id) { return D.getElementById(id); }

  function safeModeOn() {
    return Boolean(W.LatexaiSafeMode?.isSafeMode?.());
  }

  function defaultFlags() {
    const flags = {};
    for (const feature of REGISTRY) flags[feature.key] = Boolean(feature.defaultEnabled);
    return flags;
  }

  function stableDefaultFlags() {
    const flags = {};
    for (const feature of REGISTRY) flags[feature.key] = feature.tier === 'stable';
    return flags;
  }

  function readFlags() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...defaultFlags(), ...parsed };
    } catch (_err) {
      return defaultFlags();
    }
  }

  function writeFlags(flags) {
    const merged = { ...defaultFlags(), ...(flags || {}) };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch (_err) {}
    return merged;
  }

  function featureMeta(key) {
    return REGISTRY.find((feature) => feature.key === key) || { key, title: key, tier: 'unknown', defaultEnabled: true, description: '' };
  }

  function isEnabled(key) {
    if (safeModeOn()) return false;
    const flags = readFlags();
    return flags[key] !== false;
  }

  function shouldLoadFeature(key) {
    return isEnabled(key);
  }

  function shouldDisableFeature(key) {
    return !shouldLoadFeature(key);
  }

  function allPlaceholders() {
    return Array.from(D.querySelectorAll('script[type="application/latexai-feature-script"][data-feature][data-src]'));
  }

  function placeholdersForFeature(key) {
    return allPlaceholders().filter((node) => node.dataset.feature === key);
  }

  function setStatus(key, next) {
    status[key] = {
      ...(status[key] || {}),
      feature: key,
      title: featureMeta(key).title,
      ...next,
      updatedAt: new Date().toISOString()
    };
    renderStatuses();
  }

  function loadScriptPlaceholder(placeholder, timeoutMs = 12000) {
    const key = placeholder.dataset.feature;
    const src = placeholder.dataset.src;
    return new Promise((resolve) => {
      if (!key || !src) {
        resolve({ ok: false, key, src, error: 'missing feature key or data-src' });
        return;
      }

      const script = D.createElement('script');
      script.src = src;
      script.defer = true;
      script.dataset.feature = key;
      script.dataset.loadedBy = STAGE;

      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve({ ok: false, key, src, error: 'timeout' });
      }, timeoutMs);

      script.onload = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ ok: true, key, src });
      };

      script.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ ok: false, key, src, error: 'load error' });
      };

      D.body.appendChild(script);
    });
  }

  async function loadOptionalFeatures() {
    if (loadStarted) return getReport();
    loadStarted = true;

    for (const feature of REGISTRY) {
      const placeholders = placeholdersForFeature(feature.key);
      if (!placeholders.length) {
        setStatus(feature.key, {
          state: 'not-present',
          ok: true,
          details: 'No script placeholder found in this build.'
        });
        continue;
      }

      if (!shouldLoadFeature(feature.key)) {
        setStatus(feature.key, {
          state: safeModeOn() ? 'disabled-safe-mode' : 'disabled',
          ok: true,
          details: safeModeOn() ? 'Safe mode is active.' : 'Disabled by feature flag.',
          scripts: placeholders.map((p) => p.dataset.src)
        });
        continue;
      }

      setStatus(feature.key, {
        state: 'loading',
        ok: false,
        details: `Loading ${placeholders.length} script(s)...`,
        scripts: placeholders.map((p) => p.dataset.src)
      });

      const results = [];
      for (const placeholder of placeholders) {
        // Sequential loading keeps dependency order predictable.
        results.push(await loadScriptPlaceholder(placeholder));
      }

      const failed = results.filter((result) => !result.ok);
      setStatus(feature.key, {
        state: failed.length ? 'failed' : 'loaded',
        ok: failed.length === 0,
        details: failed.length ? failed.map((f) => `${f.src}: ${f.error}`).join('; ') : `Loaded ${results.length} script(s).`,
        scripts: results.map((r) => r.src),
        results
      });
    }

    loadFinished = true;
    lastReport = getReport();
    renderStatuses();
    return lastReport;
  }

  function registryRowsHtml(flags) {
    return REGISTRY.map((feature) => {
      const checked = flags[feature.key] !== false;
      return [
        `<div class="feature-flag-row" data-feature-row="${escapeHtml(feature.key)}">`,
        '  <label class="feature-flag-check">',
        `    <input type="checkbox" data-feature-toggle="${escapeHtml(feature.key)}"${checked ? ' checked' : ''} />`,
        '    <span>',
        `      <strong>${escapeHtml(feature.title)}</strong>`,
        `      <em>${escapeHtml(feature.tier)}</em>`,
        `      <small>${escapeHtml(feature.description)}</small>`,
        '    </span>',
        '  </label>',
        `  <span class="feature-flag-status" data-feature-status="${escapeHtml(feature.key)}">pending</span>`,
        '</div>'
      ].join('');
    }).join('');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function createCard() {
    const settings = el('settingsTab') || el('logsTab') || D.querySelector('.right-panel');
    if (!settings || el('featureFlagCard')) return false;

    const flags = readFlags();
    const card = D.createElement('div');
    card.id = 'featureFlagCard';
    card.className = 'feature-flag-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Features</div>',
      '    <h2>Feature flags / optional modules</h2>',
      '  </div>',
      '</div>',
      '<p class="feature-flag-help">Optional modules are loaded through this registry. Safe mode disables them before they execute.</p>',
      '<div id="featureFlagSafeModeNote" class="feature-flag-safe-note"></div>',
      '<div id="featureFlagRows" class="feature-flag-rows">',
      registryRowsHtml(flags),
      '</div>',
      '<div class="feature-flag-actions">',
      '  <button id="saveFeatureFlagsBtn" class="btn mini primary" type="button">Save flags</button>',
      '  <button id="disableExperimentalFeaturesBtn" class="btn mini" type="button">Disable experimental features</button>',
      '  <button id="stableFeatureDefaultsBtn" class="btn mini" type="button">Enable stable defaults</button>',
      '  <button id="disableLastFeatureBtn" class="btn mini" type="button">Disable last added stage</button>',
      '  <button id="copyFeatureReportBtn" class="btn mini" type="button">Copy feature report</button>',
      '</div>',
      '<div id="featureFlagStatus" class="settings-note">Feature flags ready.</div>',
      '<pre id="featureFlagOutput" class="feature-flag-output"></pre>'
    ].join('');

    const diagnostics = el('backendDiagnosticsCard');
    if (diagnostics?.parentElement === settings) settings.insertBefore(card, diagnostics);
    else settings.appendChild(card);

    bindCardControls();
    renderStatuses();
    return true;
  }

  function flagsFromUi() {
    const flags = readFlags();
    D.querySelectorAll('[data-feature-toggle]').forEach((input) => {
      flags[input.dataset.featureToggle] = Boolean(input.checked);
    });
    return flags;
  }

  function updateUiFromFlags(flags) {
    D.querySelectorAll('[data-feature-toggle]').forEach((input) => {
      input.checked = flags[input.dataset.featureToggle] !== false;
    });
  }

  function setCardStatus(message) {
    const node = el('featureFlagStatus');
    if (node) node.textContent = message;
  }

  function saveFromUi() {
    const flags = writeFlags(flagsFromUi());
    updateUiFromFlags(flags);
    setCardStatus('Feature flags saved. Reload to apply loading changes.');
    renderStatuses();
    return flags;
  }

  function disableExperimental() {
    const flags = readFlags();
    for (const feature of REGISTRY) {
      if (feature.tier === 'experimental') flags[feature.key] = false;
    }
    writeFlags(flags);
    updateUiFromFlags(flags);
    setCardStatus('Experimental features disabled. Reload to apply.');
  }

  function enableStableDefaults() {
    const flags = writeFlags(stableDefaultFlags());
    updateUiFromFlags(flags);
    setCardStatus('Stable defaults restored. Reload to apply.');
  }

  function disableLastAddedFeature() {
    const flags = readFlags();
    flags[LAST_ADDED_FEATURE] = false;
    writeFlags(flags);
    updateUiFromFlags(flags);
    setCardStatus(`Disabled last added feature: ${LAST_ADDED_FEATURE}. Reload to apply.`);
  }

  function getReport() {
    return {
      schema: 'latexai-feature-flag-report-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      safeMode: safeModeOn(),
      loadStarted,
      loadFinished,
      flags: readFlags(),
      registry: REGISTRY,
      status,
      placeholders: allPlaceholders().map((node) => ({
        feature: node.dataset.feature,
        src: node.dataset.src
      }))
    };
  }

  function formatReport(report = getReport()) {
    const lines = [
      'Latexai feature flag report',
      '===========================',
      '',
      `Generated: ${report.generatedAt}`,
      `Safe mode: ${report.safeMode ? 'ON' : 'off'}`,
      `Load started: ${report.loadStarted ? 'yes' : 'no'}`,
      `Load finished: ${report.loadFinished ? 'yes' : 'no'}`,
      '',
      'Features',
      '--------'
    ];

    for (const feature of REGISTRY) {
      const item = report.status[feature.key] || {};
      const flag = report.flags[feature.key] !== false ? 'enabled' : 'disabled';
      lines.push(`- ${feature.key}: ${flag}; ${item.state || 'pending'}${item.details ? ` — ${item.details}` : ''}`);
    }

    lines.push('', 'Placeholders', '------------');
    for (const placeholder of report.placeholders) lines.push(`- ${placeholder.feature}: ${placeholder.src}`);
    return lines.join('\n');
  }

  function renderStatuses() {
    const safeNote = el('featureFlagSafeModeNote');
    if (safeNote) {
      safeNote.textContent = safeModeOn()
        ? 'Safe mode is ON. Optional modules are not loaded.'
        : 'Safe mode is off. Enabled optional modules are loaded after core boot.';
      safeNote.classList.toggle('safe-active', safeModeOn());
    }

    for (const feature of REGISTRY) {
      const node = D.querySelector(`[data-feature-status="${CSS.escape(feature.key)}"]`);
      if (!node) continue;
      const item = status[feature.key];
      node.textContent = item?.state || 'pending';
      node.dataset.state = item?.state || 'pending';
    }

    const out = el('featureFlagOutput');
    if (out && out.classList.contains('active')) out.textContent = formatReport();
  }

  async function copyReport() {
    const text = formatReport(getReport());
    try {
      await navigator.clipboard.writeText(text);
      setCardStatus('Feature report copied.');
    } catch (_err) {
      const out = el('featureFlagOutput');
      if (out) {
        out.classList.add('active');
        out.textContent = text;
      }
      setCardStatus('Could not copy automatically. Report shown below.');
    }
  }

  function bindCardControls() {
    el('saveFeatureFlagsBtn')?.addEventListener('click', saveFromUi, true);
    el('disableExperimentalFeaturesBtn')?.addEventListener('click', disableExperimental, true);
    el('stableFeatureDefaultsBtn')?.addEventListener('click', enableStableDefaults, true);
    el('disableLastFeatureBtn')?.addEventListener('click', disableLastAddedFeature, true);
    el('copyFeatureReportBtn')?.addEventListener('click', copyReport, true);
  }

  function initCard() {
    createCard();
  }

  NS.FeatureFlagService = {
    STAGE,
    REGISTRY,
    defaultFlags,
    stableDefaultFlags,
    getFlags: readFlags,
    setFlags: writeFlags,
    isEnabled,
    shouldLoadFeature,
    shouldDisableFeature,
    loadOptionalFeatures,
    getReport,
    formatReport
  };

  W.LatexaiFeatureFlags = NS.FeatureFlagService;

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', () => {
      initCard();
      loadOptionalFeatures();
    }, { once: true });
  } else {
    initCard();
    loadOptionalFeatures();
  }

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
