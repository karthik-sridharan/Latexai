(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;
  const Model = () => NS.ProjectModel;

  let activeJobAbort = null;
  let lastBackendProbe = null;

  function currentSettings() {
    const settings = Object.assign(Model().defaultSettings(), State()?.state?.settings || {});
    const compileUrl = document.getElementById('compileProxyUrl')?.value?.trim();
    const token = document.getElementById('compileProxyToken')?.value?.trim();
    const mode = document.getElementById('compilerModeSelect')?.value;
    const engine = document.getElementById('engineSelect')?.value;
    const shellEscape = document.getElementById('shellEscapeCheck')?.checked;
    const compileJobs = document.getElementById('compileJobsCheck')?.checked;
    const wasmAssetBase = document.getElementById('browserWasmAssetBase')?.value?.trim();
    const wasmTexliveEndpoint = document.getElementById('browserWasmTexliveEndpoint')?.value?.trim();
    const wasmReuse = document.getElementById('browserWasmReuseCheck')?.checked;
    const texlyreModuleUrl = document.getElementById('texlyreModuleUrl')?.value?.trim();
    const texlyreBusytexBase = document.getElementById('texlyreBusytexBase')?.value?.trim();
    const texlyreReuse = document.getElementById('texlyreReuseCheck')?.checked;
    const texlyreUseWorker = document.getElementById('texlyreUseWorkerCheck')?.checked;
    const pollMs = Number(document.getElementById('compilePollSelect')?.value || settings.compilePollMs || 1000);
    if (compileUrl) settings.compileUrl = compileUrl;
    if (token) settings.compileProxyToken = token;
    if (mode) settings.compilerMode = mode;
    if (engine) settings.engine = engine;
    if (typeof shellEscape === 'boolean') settings.shellEscape = shellEscape;
    if (shouldUseStaticFallback(settings)) settings.shellEscape = false;
    if (typeof compileJobs === 'boolean') settings.useCompileJobs = compileJobs;
    if (wasmAssetBase) settings.browserWasmAssetBase = wasmAssetBase;
    if (wasmTexliveEndpoint) settings.browserWasmTexliveEndpoint = wasmTexliveEndpoint;
    if (typeof wasmReuse === 'boolean') settings.browserWasmReuseEngine = wasmReuse;
    if (texlyreModuleUrl) settings.texlyreModuleUrl = texlyreModuleUrl;
    if (texlyreBusytexBase) settings.texlyreBusytexBase = texlyreBusytexBase;
    if (typeof texlyreReuse === 'boolean') settings.texlyreReuseRunner = texlyreReuse;
    if (typeof texlyreUseWorker === 'boolean') settings.texlyreUseWorker = texlyreUseWorker;
    settings.compilePollMs = Math.max(300, Math.min(pollMs || 1000, 5000));
    return settings;
  }

  async function compile(project = State().state.project, overrides = {}) {
    const settings = Object.assign(currentSettings(), overrides || {});
    const mode = settings.compilerMode || 'backend-texlive';
    if (mode === 'mock-draft') return mockCompile(project, settings);
    if (mode === 'browser-wasm') return NS.BrowserWasmProvider?.compile
      ? NS.BrowserWasmProvider.compile(project, settings)
      : browserWasmPlaceholder(project, settings);
    if (mode === 'browser-wasm-texlyre') return NS.TexlyreBusyTexProvider?.compile
      ? NS.TexlyreBusyTexProvider.compile(project, settings)
      : texlyrePlaceholder(project, settings);

    if (shouldUseStaticFallback(settings)) {
      return staticBackendFallback(project, settings, 'Static deployment detected with the default relative compile endpoint.');
    }

    try {
      if (settings.useCompileJobs !== false) {
        try {
          return await backendCompileJob(project, settings);
        } catch (err) {
          if (err && err.staticFallback) return staticBackendFallback(project, settings, err.message);
          if (err && err.allowFallback) {
            State().setCompileStatus({ status: 'running', message: 'Job endpoint unavailable; falling back to synchronous compile.', progress: 30 });
            return await backendCompile(project, settings);
          }
          throw err;
        }
      }
      return await backendCompile(project, settings);
    } catch (err) {
      if (shouldUseStaticFallback(settings) || isRelativeBackendMiss(err, settings)) {
        return staticBackendFallback(project, settings, err?.message || 'Compile backend is unavailable.');
      }
      throw err;
    }
  }

  function authHeaders(settings, json = true) {
    const token = document.getElementById('compileProxyToken')?.value?.trim() || settings.compileProxyToken || '';
    const headers = json ? { 'Content-Type': 'application/json' } : {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  function compileBaseUrl(settings) {
    return (settings.compileUrl || '/api/lumina/latex/compile').replace(/\/+$/, '');
  }

  function compileApiRoot(settings) {
    const base = compileBaseUrl(settings);
    if (/\/compile\/jobs$/i.test(base)) return base.replace(/\/compile\/jobs$/i, '');
    if (/\/compile$/i.test(base)) return base.replace(/\/compile$/i, '');
    return base.replace(/\/+$/, '');
  }

  function statusUrl(settings) {
    return compileApiRoot(settings) + '/status';
  }

  function jobsUrl(settings) {
    const base = compileBaseUrl(settings);
    return base.endsWith('/jobs') ? base : `${base}/jobs`;
  }

  function jobStatusUrl(settings, jobId, explicitUrl) {
    if (explicitUrl) {
      try {
        return new URL(explicitUrl, compileBaseUrl(settings)).toString();
      } catch (_err) {
        return explicitUrl;
      }
    }
    return `${jobsUrl(settings)}/${encodeURIComponent(jobId)}`;
  }

  function isRelativeUrl(url) {
    return !!url && !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('//');
  }

  function isDefaultRelativeCompileUrl(settings) {
    const url = compileBaseUrl(settings);
    return isRelativeUrl(url) && /(^|\/)api\/lumina\/latex\/compile$/.test(url);
  }

  function isStaticHost() {
    const host = String(location.hostname || '').toLowerCase();
    return location.protocol === 'file:' || host.endsWith('.github.io') || host.includes('githubusercontent.com') || host === '';
  }

  function shouldUseStaticFallback(settings) {
    if (settings.forceBackendOnStatic) return false;
    return isStaticHost() && isDefaultRelativeCompileUrl(settings);
  }

  function isRelativeBackendMiss(err, settings) {
    const message = String(err?.message || err || '');
    return isDefaultRelativeCompileUrl(settings) && /(404|405|501|not found|failed to fetch|unexpected token|html|endpoint is unavailable)/i.test(message);
  }

  function backendAvailability(settings = currentSettings()) {
    const staticDraftFallbackActive = shouldUseStaticFallback(settings);
    return {
      compileUrl: compileBaseUrl(settings),
      jobsUrl: jobsUrl(settings),
      statusUrl: statusUrl(settings),
      staticHost: isStaticHost(),
      defaultRelativeCompileUrl: isDefaultRelativeCompileUrl(settings),
      staticDraftFallbackActive,
      browserWasm: NS.BrowserWasmProvider?.status?.() || null,
      texlyreBusyTex: NS.TexlyreBusyTexProvider?.status?.() || null,
      shellEscapeUiAllowed: !staticDraftFallbackActive,
      shellEscapeEffective: !staticDraftFallbackActive && !!settings.shellEscape,
      note: staticDraftFallbackActive
        ? 'Static deployment using default /api compile URL; compile button will run draft validation until a backend URL is configured.'
        : 'Backend URL is treated as configured; compile attempts will be sent to that endpoint.'
    };
  }

  async function probeBackend(settings = currentSettings()) {
    const availability = backendAvailability(settings);
    const startedAt = new Date().toISOString();
    if (availability.staticDraftFallbackActive) {
      lastBackendProbe = { ok: false, status: 'static-fallback', checkedAt: startedAt, availability, message: availability.note };
      renderBackendStatus();
      return lastBackendProbe;
    }
    try {
      const response = await fetch(availability.statusUrl, { method: 'GET', headers: authHeaders(settings, false) });
      const data = await response.json().catch(() => ({}));
      lastBackendProbe = {
        ok: response.ok && data.ok !== false,
        status: response.ok && data.ok !== false ? 'online' : 'degraded',
        checkedAt: new Date().toISOString(),
        httpStatus: response.status,
        availability,
        stage: data.stage || null,
        tex: data.tex || null,
        policy: data.policy || null,
        message: data?.tex?.ok ? 'Backend reachable; TeX Live engines detected.' : (data?.error?.message || data?.message || 'Backend reachable; TeX availability may be limited.'),
        raw: data
      };
    } catch (err) {
      lastBackendProbe = { ok: false, status: 'offline', checkedAt: new Date().toISOString(), availability, message: err.message || String(err) };
    }
    renderBackendStatus();
    return lastBackendProbe;
  }

  function renderBackendStatus() {
    const text = document.getElementById('backendStatusText');
    const detail = document.getElementById('backendStatusDetail');
    const card = document.getElementById('backendStatusCard');
    const probe = lastBackendProbe || { status: 'unknown', message: 'Backend has not been checked yet.' };
    if (text) text.textContent = probe.status === 'online' ? 'Online' : probe.status === 'static-fallback' ? 'Static fallback' : probe.status === 'offline' ? 'Offline' : probe.status === 'degraded' ? 'Degraded' : 'Not checked';
    if (detail) detail.textContent = probe.message || 'No backend status detail.';
    if (card) {
      card.classList.toggle('ok', probe.status === 'online');
      card.classList.toggle('warn', probe.status === 'static-fallback' || probe.status === 'degraded');
      card.classList.toggle('error', probe.status === 'offline');
    }
  }

  function init() {
    const button = document.getElementById('testCompileBackendBtn');
    button?.addEventListener('click', async () => {
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'Checking...';
      try {
        const result = await probeBackend();
        NS.Main?.toast?.(result.ok ? 'Compile backend is reachable.' : 'Compile backend is not ready.');
      } finally {
        button.disabled = false;
        button.textContent = original || 'Test backend';
      }
    });
    document.getElementById('compileProxyUrl')?.addEventListener('change', () => { lastBackendProbe = null; renderBackendStatus(); });
    NS.BrowserWasmProvider?.init?.();
    NS.TexlyreBusyTexProvider?.init?.();
    renderBackendStatus();
  }

  async function backendCompileJob(project, settings) {
    const payload = Model().toCompilePayload(project, settings);
    const url = jobsUrl(settings);
    activeJobAbort = new AbortController();
    State().setCompileStatus({ status: 'submitting', jobId: null, progress: 8, message: 'Submitting compile job...', startedAt: new Date().toISOString(), finishedAt: null });
    let response;
    try {
      response = await fetch(url, { method: 'POST', headers: authHeaders(settings), body: JSON.stringify(payload), signal: activeJobAbort.signal });
    } catch (err) {
      if (shouldUseStaticFallback(settings)) {
        err.staticFallback = true;
      }
      throw err;
    }
    const data = await response.json().catch(() => ({}));
    if (response.status === 404 || response.status === 405 || response.status === 501) {
      const err = new Error(`Compile jobs endpoint is unavailable at ${url} (HTTP ${response.status}).`);
      if (shouldUseStaticFallback(settings)) err.staticFallback = true;
      else err.allowFallback = true;
      throw err;
    }
    if (!response.ok || data.ok === false) {
      const message = data?.error?.message || data?.message || `Compile job request failed with HTTP ${response.status}.`;
      return normalizeCompileResult({ ok: false, mode: 'backend-texlive-job', log: `${message}\n\n${data.log || ''}`, problems: [{ level: 'error', message, line: null }], raw: data });
    }
    const jobId = data.jobId || data.id;
    if (!jobId) throw new Error('Compile job endpoint did not return a jobId.');
    const statusUrl = jobStatusUrl(settings, jobId, data.statusUrl || response.headers.get('Location'));
    State().setCompileStatus({ status: data.status || 'queued', jobId, progress: data.progress ?? 15, message: data.message || 'Compile job queued.' });
    return pollJob(settings, jobId, statusUrl);
  }

  async function pollJob(settings, jobId, statusUrl) {
    const pollMs = settings.compilePollMs || 1000;
    const maxPolls = Math.max(10, Math.ceil((Number(settings.compileTimeoutMs || 90000) + 30000) / pollMs));
    let lastLog = '';
    for (let attempt = 0; attempt < maxPolls; attempt++) {
      if (activeJobAbort?.signal?.aborted) {
        return normalizeCompileResult({ ok: false, mode: 'backend-texlive-job', jobId, log: 'Compile canceled by user.', problems: [{ level: 'warn', message: 'Compile canceled by user.', line: null }], raw: { jobId, status: 'canceled' } });
      }
      await sleep(attempt === 0 ? 250 : pollMs);
      const response = await fetch(statusUrl, { method: 'GET', headers: authHeaders(settings, false), signal: activeJobAbort?.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        const message = data?.error?.message || data?.message || `Compile job status failed with HTTP ${response.status}.`;
        return normalizeCompileResult({ ok: false, mode: 'backend-texlive-job', jobId, log: `${message}\n\n${data.log || lastLog || ''}`, problems: [{ level: 'error', message, line: null }], raw: data });
      }
      const status = data.status || 'running';
      const progress = typeof data.progress === 'number' ? data.progress : status === 'queued' ? 20 : status === 'running' ? Math.min(90, 35 + attempt * 4) : 100;
      lastLog = data.log || data.result?.log || lastLog;
      State().setCompileStatus({ status, jobId, progress, message: data.message || statusLabel(status) });
      if (['succeeded', 'failed', 'canceled', 'error'].includes(status)) {
        const result = data.result || data;
        return normalizeCompileResult(Object.assign({}, result, { jobId, mode: 'backend-texlive-job', raw: data }));
      }
    }
    return normalizeCompileResult({ ok: false, mode: 'backend-texlive-job', jobId, log: `Compile job ${jobId} timed out while polling.\n\n${lastLog}`, problems: [{ level: 'error', message: 'Compile job timed out while polling.', line: null }], raw: { jobId, status: 'timeout' } });
  }

  async function cancelActiveJob(settings = currentSettings()) {
    const jobId = State().state.compile?.jobId;
    if (!jobId) return false;
    activeJobAbort?.abort?.();
    try {
      await fetch(jobStatusUrl(settings, jobId), { method: 'DELETE', headers: authHeaders(settings, false) });
    } catch (_err) {}
    State().setCompileStatus({ status: 'canceled', jobId, progress: 100, message: 'Compile canceled.' });
    return true;
  }

  async function backendCompile(project, settings) {
    const payload = Model().toCompilePayload(project, settings);
    const url = compileBaseUrl(settings).replace(/\/jobs$/, '');
    State().setCompileStatus({ status: 'running', jobId: null, progress: 25, message: 'Running synchronous backend compile...', startedAt: new Date().toISOString(), finishedAt: null });
    let response;
    try {
      response = await fetch(url, { method: 'POST', headers: authHeaders(settings), body: JSON.stringify(payload) });
    } catch (err) {
      if (shouldUseStaticFallback(settings)) return staticBackendFallback(project, settings, err?.message || 'Synchronous compile endpoint unavailable.');
      throw err;
    }
    const data = await response.json().catch(() => ({}));
    if ((response.status === 404 || response.status === 405 || response.status === 501) && shouldUseStaticFallback(settings)) {
      return staticBackendFallback(project, settings, `Synchronous compile endpoint unavailable at ${url} (HTTP ${response.status}).`);
    }
    if (!response.ok || data.ok === false) {
      const message = data?.error?.message || data?.message || `Compile request failed with HTTP ${response.status}.`;
      State().setCompileStatus({ status: 'failed', progress: 100, message });
      return normalizeCompileResult({ ok: false, mode: 'backend-texlive', log: `${message}\n\n${data.log || ''}`, problems: [{ level: 'error', message, line: null }], raw: data });
    }
    State().setCompileStatus({ status: 'succeeded', progress: 100, message: 'PDF compile completed.' });
    return normalizeCompileResult(Object.assign({}, data, { mode: 'backend-texlive', raw: data }));
  }

  async function mockCompile(project, settings) {
    const payload = Model().toCompilePayload(project, settings);
    const root = payload.files.find((file) => file.path === payload.rootFile) || payload.files[0];
    const analysis = NS.Preview?.analyzeTex?.(root?.text || '', payload.files.map((f) => ({ path: f.path, kind: f.kind, text: f.text }))) || { problems: [] };
    const ok = !analysis.problems.some((p) => p.level === 'error');
    State().setCompileStatus({ status: ok ? 'succeeded' : 'failed', jobId: 'mock-draft', progress: 100, message: ok ? 'Mock draft checks passed.' : 'Mock draft checks found errors.' });
    return normalizeCompileResult({
      ok,
      schema: 'lumina-latex-compile-response-v1',
      mode: 'mock-draft',
      pdfBase64: null,
      log: `Mock compile completed for ${payload.rootFile}. This validates draft structure only; no TeX engine was run.`,
      problems: analysis.problems,
      raw: { payloadSummary: { rootFile: payload.rootFile, engine: payload.engine, fileCount: payload.files.length } }
    });
  }

  async function staticBackendFallback(project, settings, reason) {
    const payload = Model().toCompilePayload(project, settings);
    const root = payload.files.find((file) => file.path === payload.rootFile) || payload.files[0];
    const analysis = NS.Preview?.analyzeTex?.(root?.text || '', payload.files.map((f) => ({ path: f.path, kind: f.kind, text: f.text }))) || { problems: [] };
    const ok = !analysis.problems.some((p) => p.level === 'error');
    const note = `Static draft fallback for ${payload.rootFile}. ${reason || 'No backend compile service was reached.'} Real PDF compilation needs the included backend, a hosted compile proxy, or the Stage 1F browser-WASM provider.`;
    State().setCompileStatus({
      status: ok ? 'succeeded' : 'failed',
      jobId: null,
      progress: 100,
      message: ok ? 'Draft preview ready; backend compile unavailable on this static deployment.' : 'Draft checks found diagnostics; backend compile unavailable.'
    });
    return normalizeCompileResult({
      ok,
      schema: 'lumina-latex-compile-response-v1',
      mode: 'static-draft-fallback',
      pdfBase64: null,
      log: note,
      problems: analysis.problems,
      raw: {
        staticFallback: true,
        reason,
        availability: backendAvailability(settings),
        payloadSummary: { rootFile: payload.rootFile, engine: payload.engine, fileCount: payload.files.length }
      }
    });
  }

  async function browserWasmPlaceholder(project, settings) {
    const payload = Model().toCompilePayload(project, settings);
    State().setCompileStatus({ status: 'failed', jobId: 'browser-wasm-placeholder', progress: 100, message: 'Browser-WASM provider could not initialize.' });
    return normalizeCompileResult({
      ok: false,
      schema: 'lumina-latex-compile-response-v1',
      mode: 'browser-wasm',
      pdfBase64: null,
      log: `Browser-WASM compile provider is not initialized. Root file: ${payload.rootFile}. Check that js/browser-wasm-provider.js is loaded and that SwiftLaTeX assets are configured.`,
      problems: [{ level: 'warn', message: 'Browser-WASM provider is not initialized or assets are missing.', line: null }],
      raw: { payloadSummary: { rootFile: payload.rootFile, engine: payload.engine, fileCount: payload.files.length } }
    });
  }

  async function texlyrePlaceholder(project, settings) {
    const payload = Model().toCompilePayload(project, settings);
    State().setCompileStatus({ status: 'failed', jobId: 'browser-wasm-texlyre-placeholder', progress: 100, message: 'TeXlyre BusyTeX provider could not initialize.' });
    return normalizeCompileResult({
      ok: false,
      schema: 'lumina-latex-compile-response-v1',
      mode: 'browser-wasm-texlyre-busytex-experimental',
      pdfBase64: null,
      log: `TeXlyre BusyTeX provider is not initialized. Root file: ${payload.rootFile}. Check that js/texlyre-busytex-provider.js is loaded and that TeXlyre assets are configured.`,
      problems: [{ level: 'warn', message: 'TeXlyre BusyTeX provider is not initialized or assets are missing.', line: null }],
      raw: { payloadSummary: { rootFile: payload.rootFile, engine: payload.engine, fileCount: payload.files.length } }
    });
  }

  function normalizeCompileResult(data) {
    const log = data.log || data.result?.log || 'Compile completed.';
    const parsed = parseCompileLog(log);
    const supplied = Array.isArray(data.problems) ? data.problems : [];
    const problems = supplied.length ? supplied : parsed;
    const draftOnly = data.mode === 'mock-draft' || data.mode === 'static-draft-fallback';
    const ok = data.ok !== false && !problems.some((p) => p.level === 'error') && (data.pdfBase64 || draftOnly);
    return {
      ok: !!ok,
      schema: data.schema || 'lumina-latex-compile-response-v1',
      mode: data.mode || 'backend-texlive',
      jobId: data.jobId || null,
      pdfBase64: data.pdfBase64 || null,
      log,
      problems: problems.length ? problems : [],
      raw: data.raw || data
    };
  }

  function parseCompileLog(logText) {
    const problems = [];
    const lines = String(logText || '').split('\n');
    let currentFile = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fileHint = line.match(/(?:^|\()((?:\.\/)?[^\s()]+\.(?:tex|bib|sty|cls))/i);
      if (fileHint) currentFile = fileHint[1].replace(/^\.\//, '');

      let m = line.match(/^(.+?\.(?:tex|bib|sty|cls)):(\d+):\s*(.*)$/i);
      if (m) {
        problems.push({ level: /warning/i.test(m[3]) ? 'warn' : 'error', file: m[1].replace(/^\.\//, ''), line: Number(m[2]), message: cleanMessage(m[3] || line) });
        continue;
      }
      if (/^! /.test(line)) {
        const near = nearbyLine(lines, i);
        problems.push({ level: 'error', file: near.file || currentFile, line: near.line, message: cleanMessage(line.replace(/^!\s*/, '').trim()) });
      } else if (/LaTeX Warning:|Package .* Warning:|Overfull \\hbox|Underfull \\hbox/.test(line)) {
        const near = nearbyLine(lines, i);
        problems.push({ level: 'warn', file: near.file || currentFile, line: near.line, message: cleanMessage(line.trim()) });
      } else if (/LaTeX Error:|Package .* Error:/.test(line)) {
        const near = nearbyLine(lines, i);
        problems.push({ level: 'error', file: near.file || currentFile, line: near.line, message: cleanMessage(line.trim()) });
      }
    }
    return dedupeProblems(problems).slice(0, 80);
  }

  function nearbyLine(lines, index) {
    let file = null;
    for (let j = Math.max(0, index - 3); j < Math.min(lines.length, index + 10); j++) {
      const fh = /(?:^|\()((?:\.\/)?[^\s()]+\.(?:tex|bib|sty|cls))/i.exec(lines[j]);
      if (fh) file = fh[1].replace(/^\.\//, '');
      const m = /l\.(\d+)/.exec(lines[j]) || /line\s+(\d+)/i.exec(lines[j]);
      if (m) return { file, line: Number(m[1]) };
    }
    return { file, line: null };
  }

  function cleanMessage(message) {
    return String(message || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  }

  function dedupeProblems(problems) {
    const seen = new Set();
    return problems.filter((p) => {
      const key = `${p.level}|${p.file || ''}|${p.line || ''}|${p.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function statusLabel(status) {
    return ({ queued: 'Compile job queued.', running: 'Compile running...', succeeded: 'PDF compile completed.', failed: 'Compile failed.', canceled: 'Compile canceled.' })[status] || String(status || 'Compile status updated.');
  }

  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  NS.CompilerProvider = {
    currentSettings,
    compile,
    backendCompile,
    backendCompileJob,
    mockCompile,
    staticBackendFallback,
    browserWasmPlaceholder,
    parseCompileLog,
    cancelActiveJob,
    backendAvailability,
    probeBackend,
    renderBackendStatus,
    getLastBackendProbe: () => lastBackendProbe,
    shouldUseStaticFallback,
    init
  };
})();
