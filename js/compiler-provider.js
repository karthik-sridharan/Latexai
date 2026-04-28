(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;
  const Model = () => NS.ProjectModel;

  function currentSettings() {
    const settings = Object.assign(Model().defaultSettings(), State()?.state?.settings || {});
    const compileUrl = document.getElementById('compileProxyUrl')?.value?.trim();
    const mode = document.getElementById('compilerModeSelect')?.value;
    const engine = document.getElementById('engineSelect')?.value;
    const shellEscape = document.getElementById('shellEscapeCheck')?.checked;
    if (compileUrl) settings.compileUrl = compileUrl;
    if (mode) settings.compilerMode = mode;
    if (engine) settings.engine = engine;
    if (typeof shellEscape === 'boolean') settings.shellEscape = shellEscape;
    return settings;
  }

  async function compile(project = State().state.project, overrides = {}) {
    const settings = Object.assign(currentSettings(), overrides || {});
    const mode = settings.compilerMode || 'backend-texlive';
    if (mode === 'mock-draft') return mockCompile(project, settings);
    if (mode === 'browser-wasm') return browserWasmPlaceholder(project, settings);
    return backendCompile(project, settings);
  }

  async function backendCompile(project, settings) {
    const payload = Model().toCompilePayload(project, settings);
    const url = settings.compileUrl || '/api/lumina/latex/compile';
    const token = document.getElementById('compileProxyToken')?.value?.trim() || settings.compileProxyToken || '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const message = data?.error?.message || data?.message || `Compile request failed with HTTP ${response.status}.`;
      return {
        ok: false,
        schema: 'lumina-latex-compile-response-v1',
        mode: 'backend-texlive',
        log: `${message}\n\n${data.log || ''}`,
        problems: [{ level: 'error', message, line: null }],
        raw: data
      };
    }
    const problems = parseCompileLog(data.log || 'Compile completed.');
    return {
      ok: true,
      schema: 'lumina-latex-compile-response-v1',
      mode: 'backend-texlive',
      jobId: data.jobId || null,
      pdfBase64: data.pdfBase64 || null,
      log: data.log || 'Compile completed.',
      problems: problems.length ? problems : [{ level: 'ok', message: 'PDF compile completed.', line: null }],
      raw: data
    };
  }

  async function mockCompile(project, settings) {
    const payload = Model().toCompilePayload(project, settings);
    const root = payload.files.find((file) => file.path === payload.rootFile) || payload.files[0];
    const analysis = NS.Preview?.analyzeTex?.(root?.text || '', payload.files.map((f) => ({ path: f.path, kind: f.kind, text: f.text }))) || { problems: [] };
    return {
      ok: !analysis.problems.some((p) => p.level === 'error'),
      schema: 'lumina-latex-compile-response-v1',
      mode: 'mock-draft',
      pdfBase64: null,
      log: `Mock compile completed for ${payload.rootFile}. This validates draft structure only; no TeX engine was run.`,
      problems: analysis.problems,
      raw: { payloadSummary: { rootFile: payload.rootFile, engine: payload.engine, fileCount: payload.files.length } }
    };
  }

  async function browserWasmPlaceholder(project, settings) {
    const payload = Model().toCompilePayload(project, settings);
    return {
      ok: false,
      schema: 'lumina-latex-compile-response-v1',
      mode: 'browser-wasm',
      pdfBase64: null,
      log: `Browser-WASM compile is reserved but not bundled in Stage 1B. Root file: ${payload.rootFile}. Use backend-texlive or mock-draft for now.`,
      problems: [{ level: 'warn', message: 'Browser-WASM provider is a placeholder in Stage 1B.', line: null }],
      raw: { payloadSummary: { rootFile: payload.rootFile, engine: payload.engine, fileCount: payload.files.length } }
    };
  }

  function parseCompileLog(logText) {
    const problems = [];
    const lines = String(logText || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^! /.test(line)) problems.push({ level: 'error', message: line.replace(/^!\s*/, '').trim(), line: nearbyLine(lines, i) });
      else if (/LaTeX Warning:/.test(line)) problems.push({ level: 'warn', message: line.trim(), line: nearbyLine(lines, i) });
      else if (/Package .* Warning:/.test(line)) problems.push({ level: 'warn', message: line.trim(), line: nearbyLine(lines, i) });
    }
    return problems.slice(0, 60);
  }

  function nearbyLine(lines, index) {
    for (let j = index; j < Math.min(lines.length, index + 7); j++) {
      const m = /l\.(\d+)/.exec(lines[j]);
      if (m) return Number(m[1]);
    }
    return null;
  }

  NS.CompilerProvider = { currentSettings, compile, backendCompile, mockCompile, browserWasmPlaceholder, parseCompileLog };
})();
