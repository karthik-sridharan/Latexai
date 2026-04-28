(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;
  const Model = () => NS.ProjectModel;

  const DEFAULT_ASSET_BASE = 'vendor/swiftlatex/pdftex/';
  const DEFAULT_TEXLIVE_ENDPOINT = 'https://texlive.swiftlatex.com/';
  let lastProbe = null;
  let cachedEngine = null;
  let engineBaseForCache = '';
  let engineScriptLoaded = false;

  function currentSettings(base = State()?.state?.settings || {}) {
    const settings = Object.assign(Model()?.defaultSettings?.() || {}, base || {});
    const baseInput = document.getElementById('browserWasmAssetBase')?.value?.trim();
    const endpointInput = document.getElementById('browserWasmTexliveEndpoint')?.value?.trim();
    const cacheInput = document.getElementById('browserWasmReuseCheck')?.checked;
    if (baseInput) settings.browserWasmAssetBase = baseInput;
    if (endpointInput) settings.browserWasmTexliveEndpoint = endpointInput;
    if (typeof cacheInput === 'boolean') settings.browserWasmReuseEngine = cacheInput;
    return settings;
  }

  function assetBase(settings = currentSettings()) {
    let base = String(settings.browserWasmAssetBase || DEFAULT_ASSET_BASE).trim();
    if (!base) base = DEFAULT_ASSET_BASE;
    return base.endsWith('/') ? base : base + '/';
  }

  function endpoint(settings = currentSettings()) {
    return String(settings.browserWasmTexliveEndpoint || DEFAULT_TEXLIVE_ENDPOINT).trim();
  }

  function status() {
    return Object.assign({
      provider: 'browser-wasm-swiftlatex-experimental',
      stage: W.LUMINA_LATEX_STAGE || 'stage1f',
      assetBase: assetBase(),
      texliveEndpoint: endpoint(),
      cachedEngineReady: !!cachedEngine,
      scriptLoaded: engineScriptLoaded
    }, lastProbe || {});
  }

  function renderStatus() {
    const card = document.getElementById('wasmStatusCard');
    const text = document.getElementById('wasmStatusText');
    const detail = document.getElementById('wasmStatusDetail');
    const probe = status();
    const state = probe.status || 'not-checked';
    if (text) text.textContent = state === 'ready' ? 'Ready' : state === 'missing-assets' ? 'Assets missing' : state === 'loading' ? 'Loading' : state === 'error' ? 'Error' : 'Not checked';
    if (detail) detail.textContent = probe.message || 'Choose Browser WASM and click Test browser engine. It needs SwiftLaTeX-compatible assets under the configured asset folder.';
    if (card) {
      card.classList.toggle('ok', state === 'ready');
      card.classList.toggle('warn', state === 'not-checked' || state === 'missing-assets' || state === 'loading');
      card.classList.toggle('error', state === 'error');
    }
  }

  async function probe(settings = currentSettings()) {
    const base = assetBase(settings);
    lastProbe = { ok: false, status: 'loading', checkedAt: new Date().toISOString(), assetBase: base, message: 'Checking browser-WASM engine assets...' };
    renderStatus();
    try {
      await ensureEngineClass(settings, { probeOnly: true });
      lastProbe = { ok: true, status: 'ready', checkedAt: new Date().toISOString(), assetBase: base, texliveEndpoint: endpoint(settings), message: 'Browser-WASM engine script is reachable. Compile will run in this browser; first run can be slow.' };
    } catch (err) {
      lastProbe = classifyEngineError(err, base);
    }
    renderStatus();
    return lastProbe;
  }

  async function compile(project = State().state.project, settings = currentSettings()) {
    settings = currentSettings(settings);
    const payload = Model().toCompilePayload(project, Object.assign({}, settings, { compilerMode: 'browser-wasm' }));
    const root = payload.files.find((file) => file.path === payload.rootFile) || payload.files[0];
    const base = assetBase(settings);
    const start = Date.now();
    State().setCompileStatus({ status: 'running', jobId: 'browser-wasm', progress: 12, message: 'Loading browser-WASM LaTeX engine...', startedAt: new Date().toISOString(), finishedAt: null });

    try {
      const EngineClass = await ensureEngineClass(settings);
      const engine = await getEngine(EngineClass, settings);
      State().setCompileStatus({ status: 'running', jobId: 'browser-wasm', progress: 35, message: 'Writing project files into browser engine memory...' });
      await writeProjectToEngine(engine, payload);
      if (endpoint(settings) && typeof engine.setTexliveEndpoint === 'function') engine.setTexliveEndpoint(endpoint(settings));
      engine.setEngineMainFile(payload.rootFile);
      State().setCompileStatus({ status: 'running', jobId: 'browser-wasm', progress: 65, message: 'Running LaTeX in browser WebAssembly...' });
      const result = await withTimeout(engine.compileLaTeX(), Math.max(15000, Number(settings.compileTimeoutMs || 90000)));
      const pdfBytes = result?.pdf ? new Uint8Array(result.pdf) : null;
      const log = result?.log || 'Browser-WASM compile completed.';
      const problems = NS.CompilerProvider?.parseCompileLog?.(log) || [];
      const ok = !!pdfBytes && !problems.some((p) => p.level === 'error');
      if (!settings.browserWasmReuseEngine && typeof engine.closeWorker === 'function') {
        try { engine.closeWorker(); } catch (_err) {}
        cachedEngine = null;
      }
      State().setCompileStatus({ status: ok ? 'succeeded' : 'failed', jobId: 'browser-wasm', progress: 100, message: ok ? 'Browser-WASM PDF compile completed.' : 'Browser-WASM compile finished with diagnostics.' });
      lastProbe = { ok: true, status: 'ready', checkedAt: new Date().toISOString(), assetBase: base, message: `Browser-WASM compile completed in ${Math.round((Date.now() - start) / 100) / 10}s.` };
      renderStatus();
      return {
        ok,
        schema: 'lumina-latex-compile-response-v1',
        mode: 'browser-wasm-swiftlatex-experimental',
        jobId: 'browser-wasm',
        pdfBase64: pdfBytes ? bytesToBase64(pdfBytes) : null,
        log: decorateLog(log, payload, base),
        problems,
        raw: { status: result?.status, rootFile: payload.rootFile, fileCount: payload.files.length, assetBase: base, durationMs: Date.now() - start }
      };
    } catch (err) {
      const fallback = NS.Preview?.analyzeTex?.(root?.text || '', payload.files.map((f) => ({ path: f.path, kind: f.kind, text: f.text }))) || { problems: [] };
      const classified = classifyEngineError(err, base);
      lastProbe = classified;
      renderStatus();
      State().setCompileStatus({ status: 'failed', jobId: 'browser-wasm', progress: 100, message: 'Browser-WASM compile could not run.' });
      return {
        ok: false,
        schema: 'lumina-latex-compile-response-v1',
        mode: 'browser-wasm-swiftlatex-experimental',
        jobId: 'browser-wasm',
        pdfBase64: null,
        log: browserWasmHelpLog(classified, payload),
        problems: [{ level: 'warn', message: classified.message, line: null }].concat(fallback.problems || []),
        raw: { error: classified, payloadSummary: { rootFile: payload.rootFile, engine: payload.engine, fileCount: payload.files.length } }
      };
    }
  }

  async function ensureEngineClass(settings, options = {}) {
    const base = assetBase(settings);
    if (engineScriptLoaded && W.PdfTeXEngine) return W.PdfTeXEngine;
    if (engineScriptLoaded && W.exports?.PdfTeXEngine) return W.exports.PdfTeXEngine;
    const scriptUrl = new URL('PdfTeXEngine.js', new URL(base, location.href)).toString();
    const text = await fetchText(scriptUrl, options.probeOnly);
    const patched = patchSwiftLatexEngineScript(text, base);
    await loadScriptText(patched, scriptUrl);
    const EngineClass = W.PdfTeXEngine || W.exports?.PdfTeXEngine;
    if (!EngineClass) throw new Error('PdfTeXEngine.js loaded but did not expose PdfTeXEngine. Check that the asset folder contains SwiftLaTeX browser-engine files.');
    W.PdfTeXEngine = EngineClass;
    engineScriptLoaded = true;
    return EngineClass;
  }

  async function getEngine(EngineClass, settings) {
    const base = assetBase(settings);
    const reuse = settings.browserWasmReuseEngine !== false;
    if (reuse && cachedEngine && engineBaseForCache === base && cachedEngine.isReady?.()) {
      try { cachedEngine.flushCache?.(); } catch (_err) {}
      return cachedEngine;
    }
    const engine = new EngineClass();
    await engine.loadEngine();
    if (endpoint(settings) && typeof engine.setTexliveEndpoint === 'function') engine.setTexliveEndpoint(endpoint(settings));
    if (reuse) {
      cachedEngine = engine;
      engineBaseForCache = base;
    }
    return engine;
  }

  async function writeProjectToEngine(engine, payload) {
    const folders = new Set();
    for (const file of payload.files) {
      const path = String(file.path || '').replace(/^\/+/, '');
      if (!path) continue;
      const parts = path.split('/');
      if (parts.length > 1) {
        let acc = '';
        for (let i = 0; i < parts.length - 1; i++) {
          acc = acc ? acc + '/' + parts[i] : parts[i];
          folders.add(acc);
        }
      }
    }
    for (const folder of folders) engine.makeMemFSFolder?.(folder);
    for (const file of payload.files) {
      if (file.encoding === 'base64' && file.base64) engine.writeMemFSFile(file.path, base64ToBytes(file.base64));
      else engine.writeMemFSFile(file.path, file.text || '');
    }
  }

  async function fetchText(url, probeOnly = false) {
    const response = await fetch(url, { method: 'GET', cache: 'force-cache' });
    if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
    const text = await response.text();
    if (!/PdfTeXEngine/.test(text)) throw new Error(`Loaded ${url}, but it does not look like SwiftLaTeX PdfTeXEngine.js.`);
    return text;
  }

  function patchSwiftLatexEngineScript(text, base) {
    const workerUrl = new URL('swiftlatexpdftex.js', new URL(base, location.href)).toString();
    let patched = String(text);
    patched = patched.replace(/var\s+ENGINE_PATH\s*=\s*['\"][^'\"]+['\"]\s*;/, `var ENGINE_PATH = ${JSON.stringify(workerUrl)};`);
    patched += '\n;try{window.PdfTeXEngine = window.PdfTeXEngine || (window.exports && window.exports.PdfTeXEngine);}catch(_e){}\n';
    return patched;
  }

  function loadScriptText(text, sourceUrl) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([text + `\n//# sourceURL=${sourceUrl}`], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const script = document.createElement('script');
      script.onload = () => { URL.revokeObjectURL(url); resolve(); };
      script.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Failed to execute browser-WASM engine script from ${sourceUrl}.`)); };
      script.src = url;
      document.head.appendChild(script);
    });
  }

  function classifyEngineError(err, base) {
    const message = err?.message || String(err || 'Unknown browser-WASM error');
    const missingAssets = /(Could not load|404|Failed to fetch|NetworkError|PdfTeXEngine\.js)/i.test(message);
    return {
      ok: false,
      status: missingAssets ? 'missing-assets' : 'error',
      checkedAt: new Date().toISOString(),
      assetBase: base,
      message: missingAssets
        ? `Browser-WASM assets were not found at ${base}. Add SwiftLaTeX PdfTeXEngine.js, swiftlatexpdftex.js, and matching wasm/data files there, or set a different asset base URL.`
        : message,
      rawMessage: message
    };
  }

  function browserWasmHelpLog(classified, payload) {
    return [
      'Browser-WASM compile could not run.',
      '',
      classified.message,
      '',
      'How to test this provider:',
      '1. Put SwiftLaTeX pdfTeX browser-engine assets in vendor/swiftlatex/pdftex/.',
      '2. The folder must include PdfTeXEngine.js plus the worker/wasm files expected by that script, such as swiftlatexpdftex.js.',
      '3. In Settings, set Compiler provider = Browser WASM experimental.',
      '4. Click Test browser engine, then Compile.',
      '',
      `Root file: ${payload.rootFile}`,
      `Files: ${payload.files.length}`,
      '',
      'Draft validation still ran, but no real PDF was produced by the browser engine.'
    ].join('\n');
  }

  function decorateLog(log, payload, base) {
    return [
      `Browser-WASM experimental compile for ${payload.rootFile}`,
      `Engine assets: ${base}`,
      `Files: ${payload.files.length}`,
      '--- LaTeX log ---',
      log || ''
    ].join('\n');
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Browser-WASM compile timed out after ${ms}ms.`)), ms);
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
    const btn = document.getElementById('testBrowserWasmBtn');
    btn?.addEventListener('click', async () => {
      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Checking...';
      try {
        const result = await probe();
        NS.Main?.toast?.(result.ok ? 'Browser-WASM engine script is reachable.' : 'Browser-WASM assets are not ready.');
      } finally {
        btn.disabled = false;
        btn.textContent = old || 'Test browser engine';
      }
    });
    document.getElementById('browserWasmAssetBase')?.addEventListener('change', (event) => {
      engineScriptLoaded = false;
      cachedEngine = null;
      lastProbe = null;
      State()?.setSetting?.('browserWasmAssetBase', event.target.value.trim() || DEFAULT_ASSET_BASE);
      renderStatus();
    });
    document.getElementById('browserWasmTexliveEndpoint')?.addEventListener('change', (event) => {
      State()?.setSetting?.('browserWasmTexliveEndpoint', event.target.value.trim() || DEFAULT_TEXLIVE_ENDPOINT);
      renderStatus();
    });
    document.getElementById('browserWasmReuseCheck')?.addEventListener('change', (event) => State()?.setSetting?.('browserWasmReuseEngine', !!event.target.checked));
    renderStatus();
  }

  NS.BrowserWasmProvider = { DEFAULT_ASSET_BASE, DEFAULT_TEXLIVE_ENDPOINT, currentSettings, assetBase, endpoint, compile, probe, status, renderStatus, init };
})();
