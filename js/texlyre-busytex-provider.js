(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;
  const Model = () => NS.ProjectModel;

  const DEFAULT_MODULE_URL = 'https://cdn.jsdelivr.net/npm/texlyre-busytex@1.1.1/dist/index.js';
  const FALLBACK_MODULE_URLS = [
    DEFAULT_MODULE_URL,
    'https://unpkg.com/texlyre-busytex@1.1.1/dist/index.js',
    'https://esm.sh/texlyre-busytex?bundle',
    'vendor/texlyre/texlyre-busytex/dist/index.js'
  ];
  const DEFAULT_ASSET_BASE = 'vendor/texlyre/core/busytex/';

  function forceDirectMode() {
    return State()?.forceTeXlyreDirectMode?.() === true;
  }

  function forcedDirectReason() {
    return forceDirectMode() ? 'Safari/iPad direct-mode guard: worker mode is disabled because BusyTeX worker initialization has been unreliable in this browser.' : '';
  }
  let lastProbe = null;
  let cachedRunner = null;
  let cachedModule = null;
  let cachedModuleUrlForCache = '';
  let cachedModuleLoadedFrom = '';
  let lastModuleImportAttempts = [];
  let lastAssetPreflight = null;
  let runnerBaseForCache = '';
  let runnerWorkerModeForCache = false;

  function currentSettings(base = State()?.state?.settings || {}) {
    const settings = Object.assign(Model()?.defaultSettings?.() || {}, base || {});
    const moduleInput = document.getElementById('texlyreModuleUrl')?.value?.trim();
    const baseInput = document.getElementById('texlyreBusytexBase')?.value?.trim();
    const cacheInput = document.getElementById('texlyreReuseCheck')?.checked;
    const workerInput = document.getElementById('texlyreUseWorkerCheck')?.checked;
    if (moduleInput) settings.texlyreModuleUrl = moduleInput;
    if (baseInput) settings.texlyreBusytexBase = baseInput;
    if (typeof cacheInput === 'boolean') settings.texlyreReuseRunner = cacheInput;
    if (typeof workerInput === 'boolean') settings.texlyreUseWorker = workerInput;
    if (forceDirectMode()) {
      settings.texlyreUseWorker = false;
      const box = document.getElementById('texlyreUseWorkerCheck');
      if (box) {
        box.checked = false;
        box.disabled = true;
        box.title = forcedDirectReason();
      }
    }
    return settings;
  }

  function moduleUrl(settings = currentSettings()) {
    return String(settings.texlyreModuleUrl || DEFAULT_MODULE_URL).trim() || DEFAULT_MODULE_URL;
  }

  function busytexBasePath(settings = currentSettings()) {
    let base = String(settings.texlyreBusytexBase || DEFAULT_ASSET_BASE).trim();
    if (!base) base = DEFAULT_ASSET_BASE;
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }

  function resolvedBusytexBasePath(settings = currentSettings()) {
    return String(settings.__texlyreResolvedBusytexBase || busytexBasePath(settings)).replace(/\/$/, '');
  }

  function status() {
    return Object.assign({
      provider: 'browser-wasm-texlyre-busytex-experimental',
      stage: W.LUMINA_LATEX_STAGE || 'stage1g',
      moduleUrl: moduleUrl(),
      moduleLoadedFrom: cachedModuleLoadedFrom || '',
      moduleFallbacks: moduleCandidates().filter((url) => url !== moduleUrl()),
      busytexBasePath: busytexBasePath(),
      cachedModuleReady: !!cachedModule,
      cachedRunnerReady: !!cachedRunner,
      useWorker: currentSettings().texlyreUseWorker === true,
      directModeForced: forceDirectMode(),
      directModeReason: forcedDirectReason(),
      assetPreflight: lastAssetPreflight
    }, lastProbe || {});
  }

  function renderStatus() {
    const card = document.getElementById('texlyreStatusCard');
    const text = document.getElementById('texlyreStatusText');
    const detail = document.getElementById('texlyreStatusDetail');
    const probe = status();
    const state = probe.status || 'not-checked';
    if (text) text.textContent = state === 'ready' ? 'Ready' : state === 'missing-assets' ? 'Assets missing' : state === 'loading' ? 'Loading' : state === 'error' ? 'Error' : 'Not checked';
    if (detail) detail.textContent = probe.message || (forceDirectMode() ? forcedDirectReason() : 'Choose TeXlyre BusyTeX and click Test TeXlyre. Direct mode is the safer default for Safari/iPad; Worker mode can be enabled after the assets are verified.');
    if (card) {
      card.classList.toggle('ok', state === 'ready');
      card.classList.toggle('warn', state === 'not-checked' || state === 'missing-assets' || state === 'loading');
      card.classList.toggle('error', state === 'error');
    }
  }

  async function probe(settings = currentSettings()) {
    settings = currentSettings(settings);
    const base = busytexBasePath(settings);
    lastProbe = { ok: false, status: 'loading', checkedAt: new Date().toISOString(), moduleUrl: moduleUrl(settings), busytexBasePath: base, useWorker: settings.texlyreUseWorker === true, directModeForced: forceDirectMode(), directModeReason: forcedDirectReason(), message: `Checking TeXlyre BusyTeX module and asset base (${settings.texlyreUseWorker === true ? 'worker' : 'direct'} mode)...` };
    renderStatus();
    try {
      const mod = await loadModule(settings);
      assertBusyTexModule(mod);
      const assetPreflight = await preflightAssets(settings);
      if (!assetPreflight.ok) {
        const error = new Error(`BusyTeX assets are not reachable from ${assetPreflight.requestedBase}.`);
        error.assetPreflight = assetPreflight;
        throw error;
      }
      if (assetPreflight.selectedBase) settings.__texlyreResolvedBusytexBase = assetPreflight.selectedBase;
      const runner = await getRunner(mod, settings, { forceNew: true, probe: true });
      if (settings.texlyreReuseRunner === false) await closeRunner(runner);
      lastProbe = {
        ok: true,
        status: 'ready',
        checkedAt: new Date().toISOString(),
        moduleUrl: moduleUrl(settings),
        moduleLoadedFrom: cachedModuleLoadedFrom || moduleUrl(settings),
        busytexBasePath: base,
        resolvedBusytexBasePath: resolvedBusytexBasePath(settings),
        assetPreflight,
        useWorker: settings.texlyreUseWorker === true,
        directModeForced: forceDirectMode(),
        directModeReason: forcedDirectReason(),
        message: `TeXlyre BusyTeX module loaded and runner initialized (${settings.texlyreUseWorker === true ? 'worker' : 'direct'} mode). First compile may still download/cache large TeX data in this browser.`
      };
    } catch (err) {
      lastProbe = classifyError(err, settings);
    }
    renderStatus();
    return lastProbe;
  }

  async function compile(project = State().state.project, settings = currentSettings()) {
    settings = currentSettings(settings);
    const payload = Model().toCompilePayload(project, Object.assign({}, settings, { compilerMode: 'browser-wasm-texlyre' }));
    const root = payload.files.find((file) => file.path === payload.rootFile) || payload.files[0];
    const start = Date.now();
    State().setCompileStatus({ status: 'running', jobId: 'browser-wasm-texlyre', progress: 10, message: 'Loading TeXlyre BusyTeX in browser...', startedAt: new Date().toISOString(), finishedAt: null });

    try {
      const mod = await loadModule(settings);
      assertBusyTexModule(mod);
      const assetPreflight = await preflightAssets(settings);
      if (!assetPreflight.ok) {
        const error = new Error(`BusyTeX assets are not reachable from ${assetPreflight.requestedBase}.`);
        error.assetPreflight = assetPreflight;
        throw error;
      }
      if (assetPreflight.selectedBase) settings.__texlyreResolvedBusytexBase = assetPreflight.selectedBase;
      const runner = await getRunner(mod, settings);
      State().setCompileStatus({ status: 'running', jobId: 'browser-wasm-texlyre', progress: 45, message: 'Preparing TeXlyre compile input...' });
      const EngineClass = selectEngineClass(mod, settings.engine || payload.engine || 'pdflatex');
      const engine = new EngineClass(runner);
      const compileInput = buildCompileInput(payload);
      State().setCompileStatus({ status: 'running', jobId: 'browser-wasm-texlyre', progress: 70, message: 'Running TeXlyre BusyTeX compile...' });
      const result = await withTimeout(runCompile(engine, compileInput), Math.max(15000, Number(settings.compileTimeoutMs || 90000)));
      const pdfBytes = extractPdfBytes(result);
      const log = extractLog(result);
      const problems = NS.CompilerProvider?.parseCompileLog?.(log) || [];
      const ok = !!pdfBytes && !problems.some((p) => p.level === 'error');
      if (settings.texlyreReuseRunner === false) {
        await closeRunner(runner);
        cachedRunner = null;
      }
      State().setCompileStatus({ status: ok ? 'succeeded' : 'failed', jobId: 'browser-wasm-texlyre', progress: 100, message: ok ? 'TeXlyre browser PDF compile completed.' : 'TeXlyre browser compile finished with diagnostics.' });
      lastProbe = { ok: true, status: 'ready', checkedAt: new Date().toISOString(), moduleUrl: moduleUrl(settings), moduleLoadedFrom: cachedModuleLoadedFrom || moduleUrl(settings), busytexBasePath: busytexBasePath(settings), resolvedBusytexBasePath: resolvedBusytexBasePath(settings), assetPreflight: lastAssetPreflight, message: `TeXlyre compile completed in ${Math.round((Date.now() - start) / 100) / 10}s.` };
      renderStatus();
      return {
        ok,
        schema: 'lumina-latex-compile-response-v1',
        mode: 'browser-wasm-texlyre-busytex-experimental',
        jobId: 'browser-wasm-texlyre',
        pdfBase64: pdfBytes ? bytesToBase64(pdfBytes) : null,
        log: decorateLog(log, payload, settings),
        problems,
        raw: summarizeRaw(result, payload, settings, Date.now() - start)
      };
    } catch (err) {
      const fallback = NS.Preview?.analyzeTex?.(root?.text || '', payload.files.map((f) => ({ path: f.path, kind: f.kind, text: f.text }))) || { problems: [] };
      const classified = classifyError(err, settings);
      lastProbe = classified;
      renderStatus();
      State().setCompileStatus({ status: 'failed', jobId: 'browser-wasm-texlyre', progress: 100, message: 'TeXlyre browser compile could not run.' });
      return {
        ok: false,
        schema: 'lumina-latex-compile-response-v1',
        mode: 'browser-wasm-texlyre-busytex-experimental',
        jobId: 'browser-wasm-texlyre',
        pdfBase64: null,
        log: helpLog(classified, payload),
        problems: [{ level: 'warn', message: classified.message, line: null }].concat(fallback.problems || []),
        raw: { error: classified, payloadSummary: { rootFile: payload.rootFile, engine: payload.engine, fileCount: payload.files.length } }
      };
    }
  }

  async function loadModule(settings) {
    const configuredUrl = moduleUrl(settings);
    if (cachedModule && cachedModuleUrlForCache === configuredUrl) return cachedModule;
    const attempts = [];
    for (const candidate of moduleCandidates(settings)) {
      try {
        const resolved = resolveUrl(candidate);
        const mod = await import(/* webpackIgnore: true */ resolved);
        cachedModule = mod;
        cachedModuleUrlForCache = configuredUrl;
        cachedModuleLoadedFrom = candidate;
        lastModuleImportAttempts = attempts.concat([{ url: candidate, resolved, ok: true }]);
        return mod;
      } catch (err) {
        attempts.push({ url: candidate, resolved: safeResolve(candidate), ok: false, message: err?.message || String(err) });
      }
    }
    cachedModule = null;
    cachedModuleLoadedFrom = '';
    lastModuleImportAttempts = attempts;
    const error = new Error('TeXlyre module import failed for all configured CDN/local candidates.');
    error.moduleImportAttempts = attempts;
    throw error;
  }

  function moduleCandidates(settings = currentSettings()) {
    const configured = String(settings.texlyreModuleUrl || DEFAULT_MODULE_URL).trim() || DEFAULT_MODULE_URL;
    return Array.from(new Set([configured].concat(FALLBACK_MODULE_URLS).filter(Boolean)));
  }

  function safeResolve(url) {
    try { return resolveUrl(url); } catch (_err) { return String(url || ''); }
  }

  function assertBusyTexModule(mod) {
    if (!mod || !mod.BusyTexRunner) throw new Error('TeXlyre module loaded but did not export BusyTexRunner. Check the Module URL or use a bundled ESM build of texlyre-busytex.');
    if (!mod.PdfLatex && !mod.PdfLaTeX && !mod.XeLatex && !mod.XeLaTeX && !mod.LuaLatex && !mod.LuaLaTeX) {
      throw new Error('TeXlyre module loaded but did not expose LaTeX engine classes such as PdfLatex, XeLatex, or LuaLatex.');
    }
  }

  async function getRunner(mod, settings, options = {}) {
    const base = resolvedBusytexBasePath(settings);
    const reuse = settings.texlyreReuseRunner !== false && !options.forceNew;
    const useWorker = settings.texlyreUseWorker === true;
    if (reuse && cachedRunner && runnerBaseForCache === base && runnerWorkerModeForCache === useWorker) return cachedRunner;
    const runner = new mod.BusyTexRunner({ busytexBasePath: base, assetBasePath: base, basePath: base, verbose: true });
    if (typeof runner.initialize === 'function') await runner.initialize(useWorker);
    else if (typeof runner.init === 'function') await runner.init();
    else throw new Error('BusyTexRunner exists but has no initialize() method. Check texlyre-busytex module version.');
    if (settings.texlyreReuseRunner !== false) {
      cachedRunner = runner;
      runnerBaseForCache = base;
      runnerWorkerModeForCache = useWorker;
    }
    return runner;
  }

  function selectEngineClass(mod, engineName) {
    const key = String(engineName || 'pdflatex').toLowerCase();
    if (key.includes('xelatex') || key === 'xetex') return mod.XeLatex || mod.XeLaTeX || mod.XeTex || mod.XeTeX || mod.PdfLatex || mod.PdfLaTeX;
    if (key.includes('lualatex') || key === 'luatex') return mod.LuaLatex || mod.LuaLaTeX || mod.LuaTex || mod.LuaTeX || mod.PdfLatex || mod.PdfLaTeX;
    return mod.PdfLatex || mod.PdfLaTeX || mod.PdfTex || mod.PdfTeX || mod.XeLatex || mod.XeLaTeX;
  }

  function buildCompileInput(payload) {
    const root = payload.files.find((file) => file.path === payload.rootFile) || payload.files[0];
    const additionalFiles = [];
    for (const file of payload.files || []) {
      if (!file.path || file.path === root?.path) continue;
      additionalFiles.push({
        path: file.path,
        content: file.encoding === 'base64' ? base64ToBytes(file.text || file.base64 || '') : String(file.text || '')
      });
    }
    return {
      input: root?.text || '',
      mainFile: payload.rootFile,
      rootFile: payload.rootFile,
      additionalFiles,
      bibtex: String(payload.bibliography || '').toLowerCase() === 'bibtex',
      makeindex: false,
      rerun: true,
      verbose: 'info',
      engine: payload.engine || 'pdflatex'
    };
  }

  async function runCompile(engine, compileInput) {
    if (!engine || typeof engine.compile !== 'function') throw new Error('TeXlyre engine class did not create an object with compile().');
    // TeXlyre BusyTeX expects CompileOptions: { input, additionalFiles, bibtex, makeindex, rerun, verbose }.
    return engine.compile(compileInput);
  }

  async function preflightAssets(settings) {
    const requestedBase = busytexBasePath(settings).replace(/\/$/, '');
    const required = settings.texlyreUseWorker === true
      ? ['busytex_worker.js', 'busytex.js', 'busytex.wasm']
      : ['busytex_pipeline.js', 'busytex.js', 'busytex.wasm'];
    const optional = ['texlive-basic.js', 'texlive-basic.data'];
    const bases = candidateAssetBases(requestedBase);
    const checkedBases = [];
    for (const base of bases) {
      const files = [];
      for (const file of Array.from(new Set(required.concat(optional)))) {
        files.push(await fetchAssetProbe(base, file, required.includes(file)));
      }
      const requiredOk = files.filter((f) => f.required).every((f) => f.ok);
      checkedBases.push({ base, requiredOk, files });
      if (requiredOk) {
        lastAssetPreflight = {
          ok: true,
          requestedBase,
          selectedBase: base,
          mode: settings.texlyreUseWorker === true ? 'worker' : 'direct',
          required,
          optional,
          checkedBases
        };
        return lastAssetPreflight;
      }
    }
    lastAssetPreflight = {
      ok: false,
      requestedBase,
      selectedBase: '',
      mode: settings.texlyreUseWorker === true ? 'worker' : 'direct',
      required,
      optional,
      checkedBases,
      message: 'No checked BusyTeX asset base contained all required direct/worker runtime files.'
    };
    return lastAssetPreflight;
  }

  function candidateAssetBases(requestedBase) {
    const base = String(requestedBase || DEFAULT_ASSET_BASE).replace(/\/$/, '');
    const candidates = [base];
    if (!/\/busytex$/.test(base)) candidates.push(base + '/busytex');
    if (/\/busytex$/.test(base)) candidates.push(base.replace(/\/busytex$/, ''));
    return Array.from(new Set(candidates.filter(Boolean)));
  }

  async function fetchAssetProbe(base, file, required) {
    const url = resolveUrl(base.replace(/\/$/, '') + '/' + file);
    const out = { file, required, url, ok: false, status: 0, contentType: '', contentLength: '', method: 'HEAD' };
    try {
      let res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      out.status = res.status;
      out.ok = res.ok;
      out.contentType = res.headers.get('content-type') || '';
      out.contentLength = res.headers.get('content-length') || '';
      if (!res.ok || (!out.contentType && !out.contentLength)) {
        res = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Range: 'bytes=0-0' } });
        out.method = 'GET range';
        out.status = res.status;
        out.ok = res.ok || res.status === 206;
        out.contentType = res.headers.get('content-type') || '';
        out.contentLength = res.headers.get('content-length') || res.headers.get('content-range') || '';
        try { await res.body?.cancel?.(); } catch (_err) {}
      }
    } catch (err) {
      out.error = err?.message || String(err);
    }
    return out;
  }

  async function closeRunner(runner) {
    try {
      if (!runner) return;
      if (typeof runner.terminate === 'function') await runner.terminate();
      else if (typeof runner.close === 'function') await runner.close();
      else if (typeof runner.dispose === 'function') await runner.dispose();
    } catch (_err) {}
  }

  function extractPdfBytes(result) {
    if (!result) return null;
    const candidates = [result.pdf, result.outputPdf, result.pdfBytes, result.output, result?.files?.['main.pdf'], result?.outputFiles?.['main.pdf']];
    for (const value of candidates) {
      if (!value) continue;
      if (value instanceof Uint8Array) return value;
      if (value instanceof ArrayBuffer) return new Uint8Array(value);
      if (Array.isArray(value)) return new Uint8Array(value);
      if (typeof value === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(value) && value.length > 100) {
        try { return base64ToBytes(value); } catch (_err) {}
      }
    }
    return null;
  }

  function extractLog(result) {
    if (!result) return 'TeXlyre compile returned no result.';
    return String(result.log || result.stdout || result.stderr || result.outputLog || result.message || JSON.stringify(stripLargeFields(result), null, 2));
  }

  function stripLargeFields(value) {
    try {
      return JSON.parse(JSON.stringify(value, (key, val) => {
        if (/pdf|data|bytes|buffer/i.test(key)) return '[binary omitted]';
        if (val instanceof Uint8Array || val instanceof ArrayBuffer) return '[binary omitted]';
        return val;
      }));
    } catch (_err) {
      return { resultType: typeof value };
    }
  }

  function summarizeRaw(result, payload, settings, durationMs) {
    return {
      rootFile: payload.rootFile,
      engine: payload.engine,
      fileCount: payload.files.length,
      moduleUrl: moduleUrl(settings),
      moduleLoadedFrom: cachedModuleLoadedFrom || moduleUrl(settings),
      busytexBasePath: busytexBasePath(settings),
      durationMs,
      resultKeys: result && typeof result === 'object' ? Object.keys(result) : []
    };
  }

  function classifyError(err, settings) {
    const message = err?.message || String(err || 'Unknown TeXlyre BusyTeX error');
    const base = busytexBasePath(settings);
    const module = moduleUrl(settings);
    const assetPreflight = err?.assetPreflight || lastAssetPreflight;
    const readonlyModule = /readonly property|read-only|Cannot assign to read only/i.test(message);
    const importAttempts = err?.moduleImportAttempts || lastModuleImportAttempts || [];
    const missingModule = /(Failed to fetch dynamically imported module|Importing a module script failed|Cannot find module|404|not found|module import failed)/i.test(message) && /texlyre|module|import|esm|cdn|candidate/i.test(message);
    const workerFailure = /Worker error|Timeout waiting for BusyTeX worker|Failed to initialize BusyTeX/i.test(message);
    const assetPreflightFailure = assetPreflight && assetPreflight.ok === false;
    const missingAssets = /(busytexBasePath|wasm|data|asset|404|Failed to fetch|NetworkError|not found|instantiate|WebAssembly)/i.test(message) && !missingModule && !readonlyModule;
    let friendly = message;
    if (readonlyModule) friendly = 'TeXlyre module loaded, but the provider hit a read-only ES module namespace. This Stage 1G hotfix caches module metadata separately and should remove that error.';
    else if (missingModule) friendly = `TeXlyre BusyTeX module could not be imported. The provider tried the configured URL plus fallbacks. Recommended testing URL: ${DEFAULT_MODULE_URL}. If CDN imports keep failing in Safari/iPad, copy the npm package dist/ folder into vendor/texlyre/texlyre-busytex/dist/ and use that local path.`;
    else if (assetPreflightFailure) friendly = `TeXlyre BusyTeX assets are not reachable from ${base}. Check assetPreflight.checkedBases for the exact missing URL/status. Required files in direct mode are busytex_pipeline.js, busytex.js, and busytex.wasm.`;
    else if (workerFailure) friendly = settings.texlyreUseWorker === true
      ? `TeXlyre BusyTeX worker failed to initialize from ${base}. Check assetPreflight.checkedBases; if assets are reachable, keep worker mode off on Safari/iPad.`
      : `TeXlyre BusyTeX direct runtime failed to initialize from ${base}. Check assetPreflight.checkedBases for exact asset URLs and HTTP statuses; direct mode requires busytex_pipeline.js, busytex.js, and busytex.wasm.`;
    else if (missingAssets) friendly = `TeXlyre BusyTeX assets could not be loaded from ${base}. Run npx texlyre-busytex download-assets vendor/texlyre/core so the app has vendor/texlyre/core/busytex/.`;
    return {
      ok: false,
      status: missingModule || missingAssets || workerFailure ? 'missing-assets' : 'error',
      checkedAt: new Date().toISOString(),
      moduleUrl: module,
      busytexBasePath: base,
      message: friendly,
      rawMessage: message,
      useWorker: settings.texlyreUseWorker === true,
      directModeForced: forceDirectMode(),
      directModeReason: forcedDirectReason(),
      moduleLoadedFrom: cachedModuleLoadedFrom || '',
      moduleImportAttempts: importAttempts,
      assetPreflight
    };
  }

  function helpLog(classified, payload) {
    return [
      'TeXlyre BusyTeX browser compile could not run.',
      '',
      classified.message,
      '',
      'How to test this provider:',
      '1. In Settings, choose Compiler provider = Browser WASM: TeXlyre BusyTeX.',
      '2. For quick testing, use Module URL: https://cdn.jsdelivr.net/npm/texlyre-busytex@1.1.1/dist/index.js. The provider will also try unpkg and esm.sh as fallbacks.',
      '3. Download BusyTeX assets with: npx texlyre-busytex download-assets vendor/texlyre/core',
      '4. Upload the resulting vendor/texlyre/core/busytex/ folder to the deployed GitHub Pages project.',
      '5. Set BusyTeX asset base to vendor/texlyre/core/busytex. On Safari/iPad, Web Worker mode is force-disabled by this hotfix so direct mode is tested first.',
      '6. Diagnostics now include assetPreflight.checkedBases with exact URL/status/content-type information for each required BusyTeX asset.',
      '6. Click Test TeXlyre, then Compile.',
      '',
      `Root file: ${payload.rootFile}`,
      `Files: ${payload.files.length}`,
      '',
      'Draft validation still ran, but no real PDF was produced by the TeXlyre browser engine.'
    ].join('\n');
  }

  function decorateLog(log, payload, settings) {
    return [
      `TeXlyre BusyTeX experimental compile for ${payload.rootFile}`,
      `Module: ${moduleUrl(settings)}`,
      `Assets: ${busytexBasePath(settings)}`,
      `Files: ${payload.files.length}`,
      '--- LaTeX log ---',
      log || ''
    ].join('\n');
  }

  function resolveUrl(url) {
    return new URL(url, location.href).toString();
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`TeXlyre browser compile timed out after ${ms}ms.`)), ms);
      Promise.resolve(promise).then((value) => { clearTimeout(timer); resolve(value); }, (err) => { clearTimeout(timer); reject(err); });
    });
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    const binary = atob(String(base64 || '').replace(/\s+/g, ''));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  function init() {
    const workerBox = document.getElementById('texlyreUseWorkerCheck');
    if (workerBox && forceDirectMode()) {
      workerBox.checked = false;
      workerBox.disabled = true;
      workerBox.title = forcedDirectReason();
      State()?.setSetting?.('texlyreUseWorker', false);
    }
    const resetBtn = document.getElementById('resetTexlyreDirectModeBtn');
    resetBtn?.addEventListener('click', () => {
      cachedRunner = null;
      lastProbe = null;
      if (workerBox) workerBox.checked = false;
      State()?.setSetting?.('texlyreUseWorker', false);
      renderStatus();
      NS.Main?.toast?.('TeXlyre reset to direct mode. Click Test TeXlyre again.');
    });
    const btn = document.getElementById('testTexlyreBtn');
    btn?.addEventListener('click', async () => {
      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Checking...';
      try {
        const result = await probe();
        NS.Main?.toast?.(result.ok ? 'TeXlyre BusyTeX is ready.' : 'TeXlyre BusyTeX is not ready.');
      } finally {
        btn.disabled = false;
        btn.textContent = old || 'Test TeXlyre';
      }
    });
    document.getElementById('texlyreModuleUrl')?.addEventListener('change', (event) => {
      cachedModule = null;
      cachedModuleUrlForCache = '';
      cachedModuleLoadedFrom = '';
      lastModuleImportAttempts = [];
      cachedRunner = null;
      lastProbe = null;
      State()?.setSetting?.('texlyreModuleUrl', event.target.value.trim() || DEFAULT_MODULE_URL);
      renderStatus();
    });
    document.getElementById('texlyreBusytexBase')?.addEventListener('change', (event) => {
      cachedRunner = null;
      lastProbe = null;
      State()?.setSetting?.('texlyreBusytexBase', event.target.value.trim() || DEFAULT_ASSET_BASE);
      renderStatus();
    });
    document.getElementById('texlyreReuseCheck')?.addEventListener('change', (event) => State()?.setSetting?.('texlyreReuseRunner', !!event.target.checked));
    document.getElementById('texlyreUseWorkerCheck')?.addEventListener('change', (event) => {
      cachedRunner = null;
      lastProbe = null;
      const value = forceDirectMode() ? false : !!event.target.checked;
      event.target.checked = value;
      State()?.setSetting?.('texlyreUseWorker', value);
      renderStatus();
    });
    renderStatus();
  }

  NS.TexlyreBusyTexProvider = { DEFAULT_MODULE_URL, FALLBACK_MODULE_URLS, DEFAULT_ASSET_BASE, moduleCandidates, forceDirectMode, forcedDirectReason, currentSettings, moduleUrl, busytexBasePath, resolvedBusytexBasePath, preflightAssets, compile, probe, status, renderStatus, init };
})();
