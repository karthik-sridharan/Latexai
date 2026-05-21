/* Latexai Stage 15I ReleaseVerifyService
 * Stage: stage15i-release-deploy-verifier-1
 *
 * In-app release/deployment verifier.
 *
 * Purpose:
 * - make it obvious which stage is actually loaded;
 * - detect stale GitHub Pages/browser cache issues;
 * - verify that recently added JS/CSS files are reachable;
 * - generate a copyable deploy report.
 *
 * This does not compile and does not call AI.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage15i-release-deploy-verifier-1';

  let lastReport = null;

  const EXPECTED_FILES = [
    'js/safe-mode-service.js',
    'js/backend-diagnostics-service.js',
    'js/model-provider-service.js',
    'js/regression-checklist-service.js',
    'js/ui-cleanup-service.js',
    'css/lai-stage15e-safe-mode.css',
    'css/lai-stage15f-backend-diagnostics.css',
    'css/lai-stage15g-model-routing.css',
    'css/lai-stage15h-regression-checklist.css'
  ];

  function el(id) { return D.getElementById(id); }

  function cacheBustUrl(path) {
    const url = new URL(path, W.location.href);
    url.searchParams.set('_verify', Date.now().toString());
    return url.href;
  }

  function currentAssetRefs() {
    const scripts = Array.from(D.scripts || []).map((script) => script.getAttribute('src')).filter(Boolean);
    const css = Array.from(D.querySelectorAll('link[rel="stylesheet"]')).map((link) => link.getAttribute('href')).filter(Boolean);
    return { scripts, css };
  }

  function versionParam(ref) {
    try {
      const url = new URL(ref, W.location.href);
      return url.searchParams.get('v') || '';
    } catch (_err) {
      return '';
    }
  }

  function stageMarkersFromDom() {
    const html = D.documentElement?.outerHTML || '';
    const markers = [];
    const re = /LATEXAI_STAGE[0-9A-Z_]+/g;
    let match;
    while ((match = re.exec(html))) markers.push(match[0]);
    return [...new Set(markers)];
  }

  async function fetchText(path, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();
    try {
      const response = await fetch(cacheBustUrl(path), {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      const text = await response.text().catch(() => '');
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Math.round(performance.now() - started),
        path,
        text
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        statusText: err?.name === 'AbortError' ? 'timeout' : (err?.message || String(err)),
        elapsedMs: Math.round(performance.now() - started),
        path,
        text: ''
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function probeFile(path) {
    const result = await fetchText(path, 8000);
    return {
      path,
      ok: result.ok,
      status: result.status,
      statusText: result.statusText,
      elapsedMs: result.elapsedMs,
      bytes: result.text.length,
      stageMentions: [...new Set((result.text.match(/stage[0-9a-z-]+/gi) || []).slice(0, 20))]
    };
  }

  function indexExpectedRefs(indexText) {
    const missing = [];
    for (const file of EXPECTED_FILES) {
      if (!indexText.includes(file)) missing.push(file);
    }
    return missing;
  }

  function loadedExpectedRefs() {
    const refs = currentAssetRefs();
    const all = [...refs.scripts, ...refs.css].join('\n');
    const missing = [];
    for (const file of EXPECTED_FILES) {
      if (!all.includes(file)) missing.push(file);
    }
    return missing;
  }

  async function runReleaseVerification() {
    setStatus('Verifying deployed release and cache state...');

    const refs = currentAssetRefs();
    const indexResult = await fetchText('index.html', 10000);

    const fileProbes = [];
    for (const file of EXPECTED_FILES) {
      setStatus(`Checking ${file}...`);
      fileProbes.push(await probeFile(file));
    }

    const loadedMissing = loadedExpectedRefs();
    const indexMissing = indexResult.ok ? indexExpectedRefs(indexResult.text) : EXPECTED_FILES.slice();
    const failedFiles = fileProbes.filter((p) => !p.ok);

    lastReport = {
      schema: 'latexai-release-verification-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      location: W.location.href,
      appStage: W.LUMINA_LATEX_STAGE || '',
      queryVersion: new URLSearchParams(W.location.search).get('v') || '',
      safeMode: Boolean(W.LatexaiSafeMode?.isSafeMode?.()),
      stageMarkers: stageMarkersFromDom(),
      assetRefs: {
        scripts: refs.scripts.map((src) => ({ src, v: versionParam(src) })),
        css: refs.css.map((href) => ({ href, v: versionParam(href) }))
      },
      currentIndex: {
        ok: indexResult.ok,
        status: indexResult.status,
        elapsedMs: indexResult.elapsedMs,
        bytes: indexResult.text.length,
        stageMarkers: [...new Set((indexResult.text.match(/LATEXAI_STAGE[0-9A-Z_]+/g) || []))],
        missingExpectedRefs: indexMissing
      },
      loadedMissingExpectedRefs: loadedMissing,
      fileProbes,
      summary: {
        failedFileCount: failedFiles.length,
        loadedMissingCount: loadedMissing.length,
        indexMissingCount: indexMissing.length,
        ok: failedFiles.length === 0 && loadedMissing.length === 0 && indexMissing.length === 0
      }
    };

    renderReport(lastReport);
    setStatus(lastReport.summary.ok
      ? 'Release verification passed.'
      : `Release verification found ${lastReport.summary.failedFileCount} failed file(s), ${lastReport.summary.loadedMissingCount} missing loaded ref(s), ${lastReport.summary.indexMissingCount} missing index ref(s).`);

    return lastReport;
  }

  function formatReport(report = lastReport) {
    if (!report) return 'No release verification report yet.';
    const lines = [
      'Latexai release/deployment verification',
      '=======================================',
      '',
      `Generated: ${report.generatedAt}`,
      `URL: ${report.location}`,
      `App stage: ${report.appStage || '(unknown)'}`,
      `Query v: ${report.queryVersion || '(none)'}`,
      `Safe mode: ${report.safeMode ? 'ON' : 'off'}`,
      `Overall: ${report.summary.ok ? 'PASS' : 'CHECK'}`,
      '',
      'DOM stage markers',
      '-----------------',
      ...(report.stageMarkers.length ? report.stageMarkers.map((m) => `- ${m}`) : ['- (none)']),
      '',
      'Current deployed index.html',
      '---------------------------',
      `Status: ${report.currentIndex.ok ? 'OK' : 'FAIL'} HTTP ${report.currentIndex.status} (${report.currentIndex.elapsedMs} ms)`,
      `Bytes: ${report.currentIndex.bytes}`,
      `Stage markers: ${report.currentIndex.stageMarkers.join(', ') || '(none)'}`,
      `Missing expected refs in fetched index: ${report.currentIndex.missingExpectedRefs.join(', ') || '(none)'}`,
      '',
      'Missing expected refs in loaded DOM',
      '-----------------------------------',
      ...(report.loadedMissingExpectedRefs.length ? report.loadedMissingExpectedRefs.map((m) => `- ${m}`) : ['- (none)']),
      '',
      'File probes',
      '-----------'
    ];

    for (const probe of report.fileProbes || []) {
      lines.push(`- ${probe.ok ? 'OK' : 'FAIL'} ${probe.path} — HTTP ${probe.status} ${probe.statusText} (${probe.elapsedMs} ms, ${probe.bytes} bytes)`);
    }

    lines.push('', 'Loaded script versions', '----------------------');
    for (const script of report.assetRefs.scripts || []) {
      lines.push(`- ${script.src}${script.v ? ` [v=${script.v}]` : ''}`);
    }

    lines.push('', 'Loaded CSS versions', '-------------------');
    for (const css of report.assetRefs.css || []) {
      lines.push(`- ${css.href}${css.v ? ` [v=${css.v}]` : ''}`);
    }

    lines.push('', 'Recovery URLs', '-------------');
    const base = new URL(W.location.href);
    base.searchParams.set('safe', '1');
    lines.push(`- Safe mode: ${base.href}`);
    base.searchParams.set('resetUi', '1');
    lines.push(`- Reset UI + safe: ${base.href}`);

    return lines.join('\n');
  }

  function renderReport(report) {
    const out = el('releaseVerifyOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = formatReport(report);
    }

    const summary = el('releaseVerifySummary');
    if (summary) {
      summary.textContent = report.summary.ok
        ? 'Release verification passed.'
        : `Check deployment/cache: ${report.summary.failedFileCount} failed file(s), ${report.summary.loadedMissingCount} missing loaded ref(s), ${report.summary.indexMissingCount} missing index ref(s).`;
      summary.classList.toggle('has-fails', !report.summary.ok);
    }
  }

  function setStatus(message) {
    const node = el('releaseVerifyStatus');
    if (node) node.textContent = message;
  }

  async function copyReport() {
    const text = formatReport(lastReport || await runReleaseVerification());
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Release verification report copied.');
    } catch (_err) {
      setStatus('Could not copy automatically. Select the report text manually.');
    }
  }

  function openCacheBusted() {
    const url = new URL(W.location.href);
    url.searchParams.set('v', `manual-${Date.now()}`);
    W.location.href = url.href;
  }

  function openSafeMode() {
    const url = new URL(W.location.href);
    url.searchParams.set('safe', '1');
    W.location.href = url.href;
  }

  function createCard() {
    const settings = el('settingsTab') || el('logsTab') || D.querySelector('.right-panel');
    if (!settings || el('releaseVerifyCard')) return false;

    const card = D.createElement('div');
    card.id = 'releaseVerifyCard';
    card.className = 'release-verify-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Release</div>',
      '    <h2>Release/deploy verifier</h2>',
      '  </div>',
      '</div>',
      '<p class="release-verify-help">Checks which stage and files are actually loaded, and probes deployed JS/CSS with cache bypass. No compile job and no AI call.</p>',
      '<div id="releaseVerifySummary" class="release-verify-summary">Release verification not run yet.</div>',
      '<div class="release-verify-actions">',
      '  <button id="runReleaseVerifyBtn" class="btn mini primary" type="button">Verify deployment</button>',
      '  <button id="copyReleaseVerifyBtn" class="btn mini" type="button">Copy report</button>',
      '  <button id="openCacheBustedBtn" class="btn mini" type="button">Reload cache-busted</button>',
      '  <button id="openSafeModeBtn" class="btn mini" type="button">Open safe mode</button>',
      '</div>',
      '<div id="releaseVerifyStatus" class="settings-note">Release verifier ready.</div>',
      '<pre id="releaseVerifyOutput" class="release-verify-output"></pre>'
    ].join('');

    const regression = el('regressionChecklistCard');
    if (regression?.parentElement === settings) settings.insertBefore(card, regression.nextSibling);
    else settings.appendChild(card);

    el('runReleaseVerifyBtn')?.addEventListener('click', runReleaseVerification, true);
    el('copyReleaseVerifyBtn')?.addEventListener('click', copyReport, true);
    el('openCacheBustedBtn')?.addEventListener('click', openCacheBusted, true);
    el('openSafeModeBtn')?.addEventListener('click', openSafeMode, true);

    return true;
  }

  function init() {
    createCard();
  }

  NS.ReleaseVerifyService = {
    STAGE,
    init,
    runReleaseVerification,
    formatReport,
    currentAssetRefs,
    getLastReport: () => lastReport
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  // One delayed attempt only. No intervals/observers.
  setTimeout(createCard, 900);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
