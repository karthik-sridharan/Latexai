/*
 * Lumina LaTeX Stage 1H2 Cloud Run CompilerProvider preload shim.
 * Load this BEFORE the main app script.
 * Purpose: guarantee NS.CompilerProvider.compile exists even if the older
 * Stage 1G app did not load/register js/compiler-provider.js correctly.
 */
(function () {
  'use strict';

  var BACKEND_BASE = 'https://lumina-latex-backend-y4piylmfja-ue.a.run.app';
  var STAGE = 'latex-stage1h2-compilerprovider-preload-cloudrun-20260518-1';

  var root = window;
  var NS = root.LuminaLatex || root.Lumina || root.NS || {};
  root.LuminaLatex = NS;
  root.Lumina = NS;
  root.NS = NS;

  function asObject(x) {
    return x && typeof x === 'object' ? x : {};
  }

  function normalizeUrl(url, fallbackPath) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return url;
    return BACKEND_BASE + fallbackPath;
  }

  function normalizeSettings(settings) {
    settings = asObject(settings || getGlobalSettings());
    var next = Object.assign({}, settings);
    next.compilerMode = 'backend-texlive';
    next.compileUrl = normalizeUrl(next.compileUrl, '/api/lumina/latex/compile');
    next.compileStatusUrl = normalizeUrl(next.compileStatusUrl, '/api/lumina/latex/compile/jobs');
    next.backendStatusUrl = normalizeUrl(next.backendStatusUrl, '/api/lumina/latex/status');
    next.useCompileJobs = next.useCompileJobs !== false;
    next.engine = next.engine || 'pdflatex';
    next.bibliography = next.bibliography || 'bibtex';
    next.shellEscape = false;
    persistSettingsBestEffort(next);
    return next;
  }

  function getGlobalSettings() {
    try {
      if (NS.State && typeof NS.State.getSettings === 'function') return NS.State.getSettings();
      if (NS.State && NS.State.settings) return NS.State.settings;
      if (NS.settings) return NS.settings;
      if (root.luminaLatexSettings) return root.luminaLatexSettings;
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var raw = localStorage.getItem(key);
        if (!raw) continue;
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object' && (obj.schema === 'lumina-latex-settings-v1' || obj.compileUrl || obj.compilerMode)) return obj;
      }
    } catch (err) {}
    return {};
  }

  function persistSettingsBestEffort(settings) {
    try {
      var wrote = false;
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var raw = localStorage.getItem(key);
        if (!raw) continue;
        var obj;
        try { obj = JSON.parse(raw); } catch (err) { continue; }
        if (obj && typeof obj === 'object' && (obj.schema === 'lumina-latex-settings-v1' || obj.compileUrl || obj.compilerMode)) {
          localStorage.setItem(key, JSON.stringify(Object.assign({}, obj, settings, { schema: obj.schema || 'lumina-latex-settings-v1' })));
          wrote = true;
        }
      }
      if (!wrote) {
        localStorage.setItem('lumina-latex-settings-v1', JSON.stringify(Object.assign({ schema: 'lumina-latex-settings-v1' }, settings)));
      }
    } catch (err) {}
  }

  function getGlobalProject() {
    try {
      if (NS.State && typeof NS.State.getProject === 'function') return NS.State.getProject();
      if (NS.State && NS.State.project) return NS.State.project;
      if (NS.project) return NS.project;
      if (root.luminaLatexProject) return root.luminaLatexProject;
    } catch (err) {}
    return {};
  }

  function getEditorText() {
    var candidates = [];
    try {
      if (NS.Editor && typeof NS.Editor.getValue === 'function') candidates.push(NS.Editor.getValue());
      if (NS.EditorAdapter && typeof NS.EditorAdapter.getValue === 'function') candidates.push(NS.EditorAdapter.getValue());
      if (root.editor && typeof root.editor.getValue === 'function') candidates.push(root.editor.getValue());
      if (root.cmEditor && typeof root.cmEditor.getValue === 'function') candidates.push(root.cmEditor.getValue());
    } catch (err) {}

    try {
      var textareas = Array.prototype.slice.call(document.querySelectorAll('textarea'));
      textareas.forEach(function (ta) { candidates.push(ta.value || ''); });
    } catch (err2) {}

    try {
      var cm = document.querySelector('.cm-content');
      if (cm) candidates.push(cm.innerText || cm.textContent || '');
    } catch (err3) {}

    candidates = candidates.filter(function (x) { return typeof x === 'string' && x.trim(); });
    candidates.sort(function (a, b) {
      function score(s) {
        return (/\\documentclass/.test(s) ? 1000 : 0) + (/\\begin\{document\}/.test(s) ? 500 : 0) + s.length;
      }
      return score(b) - score(a);
    });
    return candidates[0] || '';
  }

  function valueToString(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    var keys = ['content', 'text', 'source', 'value', 'data', 'body'];
    for (var i = 0; i < keys.length; i++) {
      if (typeof value[keys[i]] === 'string') return value[keys[i]];
    }
    return '';
  }

  function collectFiles(project, settings) {
    project = asObject(project);
    var files = {};
    var rootFile = project.rootFile || project.mainFile || project.activePath || settings.rootFile || 'main.tex';
    var activePath = project.activePath || rootFile;

    if (project.files && !Array.isArray(project.files) && typeof project.files === 'object') {
      Object.keys(project.files).forEach(function (path) {
        files[path] = valueToString(project.files[path]);
      });
    }

    if (Array.isArray(project.files)) {
      project.files.forEach(function (file) {
        if (!file || typeof file !== 'object') return;
        var path = file.path || file.name || file.filename;
        if (!path) return;
        files[path] = valueToString(file);
      });
    }

    if (project.fileMap && typeof project.fileMap === 'object') {
      Object.keys(project.fileMap).forEach(function (path) {
        files[path] = valueToString(project.fileMap[path]);
      });
    }

    if (Array.isArray(project.additionalFiles)) {
      project.additionalFiles.forEach(function (file) {
        if (!file || typeof file !== 'object') return;
        var path = file.path || file.name || file.filename;
        if (!path) return;
        files[path] = valueToString(file);
      });
    }

    var editorText = getEditorText();
    if (editorText && (/\\documentclass/.test(editorText) || /\\begin\{document\}/.test(editorText) || !files[activePath])) {
      files[activePath] = editorText;
      if (!files[rootFile] || activePath === rootFile) files[rootFile] = editorText;
    }

    if (!files[rootFile] && files[activePath]) files[rootFile] = files[activePath];

    // Last-resort valid document so backend diagnostics don't produce a confusing TeX emergency stop.
    if (!String(files[rootFile] || '').trim()) {
      files[rootFile] = '\\documentclass{article}\n\\begin{document}\nFrontend did not provide editor contents.\\end{document}\n';
    }

    return { rootFile: rootFile, activePath: activePath, files: files };
  }

  function buildCompileRequest(project, settings) {
    settings = normalizeSettings(settings);
    project = asObject(project || getGlobalProject());
    var collected = collectFiles(project, settings);
    return {
      schema: 'lumina-latex-compile-request-v1',
      rootFile: collected.rootFile,
      mainFile: collected.rootFile,
      activePath: collected.activePath,
      engine: settings.engine || 'pdflatex',
      bibliography: settings.bibliography || 'bibtex',
      shellEscape: false,
      rerun: true,
      files: collected.files,
      compileInputSummary: summarizePayload(collected.rootFile, collected.files)
    };
  }

  function summarizePayload(rootFile, files) {
    files = files || {};
    var root = String(files[rootFile] || '');
    return {
      rootFile: rootFile,
      fileCount: Object.keys(files).length,
      paths: Object.keys(files),
      rootLength: root.length,
      rootHead: root.slice(0, 500),
      hasDocumentClass: /\\documentclass/.test(root),
      hasBeginDocument: /\\begin\{document\}/.test(root),
      hasEndDocument: /\\end\{document\}/.test(root)
    };
  }

  function b64ToBlobUrl(b64) {
    if (!b64) return null;
    try {
      var binary = atob(b64);
      var len = binary.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    } catch (err) {
      return null;
    }
  }

  function normalizeResult(result) {
    result = asObject(result);
    var out = Object.assign({}, result.result || {}, result);
    if (result.result && !out.pdfBase64) out.pdfBase64 = result.result.pdfBase64 || result.result.pdfBytesBase64;
    out.success = Boolean(out.success || out.ok || out.status === 'success' || out.status === 'completed');
    out.ok = out.success;
    out.status = out.success ? 'success' : (out.status || 'failed');
    out.pdfBase64 = out.pdfBase64 || out.pdfBytesBase64 || null;
    out.pdfBytesBase64 = out.pdfBytesBase64 || out.pdfBase64 || null;
    if (!out.pdf && out.pdfBase64) out.pdf = 'data:application/pdf;base64,' + out.pdfBase64;
    if (!out.pdfUrl && out.pdfBase64) out.pdfUrl = b64ToBlobUrl(out.pdfBase64) || out.pdf;
    if (!out.pdfBlobUrl && out.pdfUrl) out.pdfBlobUrl = out.pdfUrl;
    out.provider = out.provider || 'cloudrun-texlive-latexmk';
    out.stage = out.stage || STAGE;
    out.message = out.message || (out.success ? 'Compile succeeded.' : 'Compile failed.');
    return out;
  }

  async function fetchJson(url, init) {
    var response = await fetch(url, init);
    var text = await response.text();
    var data = null;
    try { data = text ? JSON.parse(text) : {}; } catch (err) { data = { rawText: text }; }
    if (!response.ok) {
      var msg = (data && (data.detail || data.message)) || ('HTTP ' + response.status);
      throw new Error(msg);
    }
    return data;
  }

  function pickProjectAndSettings(args) {
    args = Array.prototype.slice.call(args || []);
    var project = null;
    var settings = null;

    args.forEach(function (arg) {
      if (!arg || typeof arg !== 'object') return;
      if (arg.project) project = arg.project;
      if (arg.settings) settings = arg.settings;
      if (arg.rootFile || arg.files || arg.fileMap || arg.activePath) project = project || arg;
      if (arg.compileUrl || arg.compileStatusUrl || arg.compilerMode || arg.engine) settings = settings || arg;
    });

    return {
      project: project || getGlobalProject(),
      settings: normalizeSettings(settings || getGlobalSettings())
    };
  }

  async function compile() {
    var picked = pickProjectAndSettings(arguments);
    var settings = picked.settings;
    var payload = buildCompileRequest(picked.project, settings);

    console.log('[Lumina Stage1H2] compile payload summary', payload.compileInputSummary);

    if (settings.useCompileJobs) {
      var created = await fetchJson(settings.compileStatusUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var result = created.result ? created.result : created;
      return normalizeResult(Object.assign({}, result, {
        jobId: created.jobId || result.jobId,
        progress: created.progress == null ? 100 : created.progress,
        compileInputSummary: payload.compileInputSummary
      }));
    }

    var direct = await fetchJson(settings.compileUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    direct.compileInputSummary = payload.compileInputSummary;
    return normalizeResult(direct);
  }

  async function checkAvailability(settings) {
    settings = normalizeSettings(settings);
    try {
      var raw = await fetchJson(settings.backendStatusUrl, { method: 'GET' });
      return {
        ok: true,
        status: 'online',
        checkedAt: new Date().toISOString(),
        httpStatus: 200,
        stage: raw.stage || STAGE,
        raw: raw,
        availability: {
          compileUrl: settings.compileUrl,
          jobsUrl: settings.compileStatusUrl,
          statusUrl: settings.backendStatusUrl,
          staticHost: location.hostname.endsWith('github.io'),
          defaultRelativeCompileUrl: false,
          staticDraftFallbackActive: false,
          note: 'Backend URL is treated as configured; compile attempts will be sent to Cloud Run.'
        },
        message: 'Backend reachable.'
      };
    } catch (err) {
      return {
        ok: false,
        status: 'offline',
        checkedAt: new Date().toISOString(),
        stage: STAGE,
        message: err && err.message ? err.message : String(err),
        availability: {
          compileUrl: settings.compileUrl,
          jobsUrl: settings.compileStatusUrl,
          statusUrl: settings.backendStatusUrl
        }
      };
    }
  }

  var Provider = {
    stage: STAGE,
    provider: 'backend-texlive-real-runner',
    compile: compile,
    buildCompileRequest: buildCompileRequest,
    normalizeSettings: normalizeSettings,
    checkAvailability: checkAvailability,
    testBackend: checkAvailability,
    getBackendAvailability: checkAvailability,
    summarizePayload: summarizePayload
  };

  NS.CompilerProvider = Provider;
  root.CompilerProvider = Provider;

  // Some older diagnostics may look under a registry object.
  NS.modules = NS.modules || {};
  NS.modules.CompilerProvider = Provider;

  console.log('[Lumina Stage1H2] CompilerProvider preload registered', {
    stage: STAGE,
    hasCompile: !!(NS.CompilerProvider && NS.CompilerProvider.compile),
    compileUrl: normalizeSettings().compileUrl,
    jobsUrl: normalizeSettings().compileStatusUrl
  });
})();
