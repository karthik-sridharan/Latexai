/*
 * Latexai / Lumina LaTeX Stage 1I Step 1 CompilerProvider bootstrap.
 *
 * Load this BEFORE the main app scripts. It guarantees that all historical
 * namespaces have a CompilerProvider with a compile(...) method, and it keeps
 * re-attaching the provider if a later script overwrites window.NS or
 * window.LuminaLatex.
 *
 * Backend target:
 *   https://lumina-latex-backend-y4piylmfja-ue.a.run.app
 */
(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : globalThis;
  var BACKEND_BASE = 'https://lumina-latex-backend-y4piylmfja-ue.a.run.app';
  var STAGE = 'latex-stage1i-step1-compilerprovider-bootstrap-20260518-1';
  var SETTINGS_SCHEMA = 'lumina-latex-settings-v1';

  function isObject(x) {
    return x !== null && typeof x === 'object';
  }

  function shallowClone(x) {
    if (!isObject(x)) return {};
    var out = {};
    Object.keys(x).forEach(function (k) { out[k] = x[k]; });
    return out;
  }

  function absoluteBackendUrl(url, fallbackPath) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) return url;
    return BACKEND_BASE + fallbackPath;
  }

  function findSettingsInLocalStorage() {
    try {
      if (!root.localStorage) return {};
      for (var i = 0; i < root.localStorage.length; i++) {
        var key = root.localStorage.key(i);
        var raw = root.localStorage.getItem(key);
        if (!raw) continue;
        var obj;
        try { obj = JSON.parse(raw); } catch (err) { continue; }
        if (isObject(obj) && (
          obj.schema === SETTINGS_SCHEMA ||
          Object.prototype.hasOwnProperty.call(obj, 'compileUrl') ||
          Object.prototype.hasOwnProperty.call(obj, 'compileStatusUrl') ||
          Object.prototype.hasOwnProperty.call(obj, 'compilerMode')
        )) {
          return obj;
        }
      }
    } catch (err2) {}
    return {};
  }

  function getNamespaceCandidate() {
    return root.LuminaLatex || root.Lumina || root.NS || root.luminaLatex || {};
  }

  function getGlobalSettings() {
    var ns = getNamespaceCandidate();
    try {
      if (ns.Settings && typeof ns.Settings.get === 'function') return ns.Settings.get() || {};
      if (ns.Settings && typeof ns.Settings.getSettings === 'function') return ns.Settings.getSettings() || {};
      if (ns.State && typeof ns.State.getSettings === 'function') return ns.State.getSettings() || {};
      if (ns.State && ns.State.settings) return ns.State.settings;
      if (ns.settings) return ns.settings;
      if (root.luminaLatexSettings) return root.luminaLatexSettings;
    } catch (err) {}
    return findSettingsInLocalStorage();
  }

  function normalizeSettings(settings) {
    var next = shallowClone(settings || getGlobalSettings());
    next.schema = next.schema || SETTINGS_SCHEMA;
    next.compilerMode = 'backend-texlive';
    next.compileUrl = absoluteBackendUrl(next.compileUrl, '/api/lumina/latex/compile');
    next.compileStatusUrl = absoluteBackendUrl(next.compileStatusUrl, '/api/lumina/latex/compile/jobs');
    next.backendStatusUrl = absoluteBackendUrl(next.backendStatusUrl, '/api/lumina/latex/status');
    next.useCompileJobs = next.useCompileJobs !== false;
    next.engine = next.engine || 'pdflatex';
    next.bibliography = next.bibliography || 'bibtex';
    next.shellEscape = false;
    persistSettingsBestEffort(next);
    return next;
  }

  function persistSettingsBestEffort(settings) {
    try {
      if (!root.localStorage) return;
      var wrote = false;
      for (var i = 0; i < root.localStorage.length; i++) {
        var key = root.localStorage.key(i);
        var raw = root.localStorage.getItem(key);
        if (!raw) continue;
        var obj;
        try { obj = JSON.parse(raw); } catch (err) { continue; }
        if (isObject(obj) && (
          obj.schema === SETTINGS_SCHEMA ||
          Object.prototype.hasOwnProperty.call(obj, 'compileUrl') ||
          Object.prototype.hasOwnProperty.call(obj, 'compileStatusUrl') ||
          Object.prototype.hasOwnProperty.call(obj, 'compilerMode')
        )) {
          root.localStorage.setItem(key, JSON.stringify(Object.assign({}, obj, settings)));
          wrote = true;
        }
      }
      if (!wrote) {
        root.localStorage.setItem(SETTINGS_SCHEMA, JSON.stringify(settings));
      }
    } catch (err2) {}
  }

  function getGlobalProject() {
    var ns = getNamespaceCandidate();
    try {
      if (ns.ProjectStore && typeof ns.ProjectStore.getProject === 'function') return ns.ProjectStore.getProject() || {};
      if (ns.Project && typeof ns.Project.get === 'function') return ns.Project.get() || {};
      if (ns.State && typeof ns.State.getProject === 'function') return ns.State.getProject() || {};
      if (ns.State && ns.State.project) return ns.State.project;
      if (ns.project) return ns.project;
      if (root.luminaLatexProject) return root.luminaLatexProject;
    } catch (err) {}
    return {};
  }

  function bestTextFromDom() {
    if (typeof document === 'undefined') return '';
    var candidates = [];
    try {
      Array.prototype.slice.call(document.querySelectorAll('textarea')).forEach(function (ta) {
        if (ta && typeof ta.value === 'string') candidates.push(ta.value);
      });
    } catch (err) {}
    try {
      Array.prototype.slice.call(document.querySelectorAll('.cm-content, [contenteditable="true"]')).forEach(function (el) {
        var text = el.innerText || el.textContent || '';
        if (text) candidates.push(text);
      });
    } catch (err2) {}
    candidates = candidates.filter(function (s) { return typeof s === 'string' && s.trim(); });
    candidates.sort(function (a, b) {
      function score(s) {
        return (/\\documentclass/.test(s) ? 1000000 : 0) +
               (/\\begin\{document\}/.test(s) ? 500000 : 0) +
               (/\\end\{document\}/.test(s) ? 250000 : 0) + s.length;
      }
      return score(b) - score(a);
    });
    return candidates[0] || '';
  }

  function getEditorText() {
    var ns = getNamespaceCandidate();
    var candidates = [];
    function maybePush(x) { if (typeof x === 'string' && x.trim()) candidates.push(x); }
    try { if (ns.Editor && typeof ns.Editor.getValue === 'function') maybePush(ns.Editor.getValue()); } catch (err) {}
    try { if (ns.Editor && typeof ns.Editor.getText === 'function') maybePush(ns.Editor.getText()); } catch (err2) {}
    try { if (ns.EditorAdapter && typeof ns.EditorAdapter.getValue === 'function') maybePush(ns.EditorAdapter.getValue()); } catch (err3) {}
    try { if (root.editor && typeof root.editor.getValue === 'function') maybePush(root.editor.getValue()); } catch (err4) {}
    try { if (root.cmEditor && typeof root.cmEditor.getValue === 'function') maybePush(root.cmEditor.getValue()); } catch (err5) {}
    maybePush(bestTextFromDom());
    candidates.sort(function (a, b) {
      function score(s) {
        return (/\\documentclass/.test(s) ? 1000000 : 0) +
               (/\\begin\{document\}/.test(s) ? 500000 : 0) +
               s.length;
      }
      return score(b) - score(a);
    });
    return candidates[0] || '';
  }

  function valueToString(value) {
    if (typeof value === 'string') return value;
    if (!isObject(value)) return '';
    var keys = ['content', 'text', 'source', 'value', 'data', 'body', 'tex'];
    for (var i = 0; i < keys.length; i++) {
      if (typeof value[keys[i]] === 'string') return value[keys[i]];
    }
    return '';
  }

  function addFilesFromObject(files, obj) {
    if (!isObject(obj) || Array.isArray(obj)) return;
    Object.keys(obj).forEach(function (path) {
      var text = valueToString(obj[path]);
      if (typeof path === 'string' && path && text !== '') files[path] = text;
    });
  }

  function addFilesFromArray(files, arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(function (file) {
      if (!isObject(file)) return;
      var path = file.path || file.name || file.filename || file.fullPath;
      if (!path) return;
      files[path] = valueToString(file);
    });
  }

  function collectFiles(project, settings) {
    project = isObject(project) ? project : {};
    settings = settings || normalizeSettings();
    var rootFile = project.rootFile || project.mainFile || project.activePath || settings.rootFile || 'main.tex';
    var activePath = project.activePath || rootFile;
    var files = {};

    addFilesFromObject(files, project.files);
    addFilesFromArray(files, project.files);
    addFilesFromObject(files, project.fileMap);
    addFilesFromObject(files, project.documents);
    addFilesFromArray(files, project.documents);
    addFilesFromObject(files, project.additionalFiles);
    addFilesFromArray(files, project.additionalFiles);

    if (typeof project.source === 'string') files[rootFile] = project.source;
    if (typeof project.tex === 'string') files[rootFile] = project.tex;
    if (typeof project.content === 'string') files[rootFile] = project.content;

    var editorText = getEditorText();
    if (editorText && (
      /\\documentclass/.test(editorText) ||
      /\\begin\{document\}/.test(editorText) ||
      !String(files[activePath] || '').trim()
    )) {
      files[activePath] = editorText;
      if (activePath === rootFile || !String(files[rootFile] || '').trim()) files[rootFile] = editorText;
    }

    if (!String(files[rootFile] || '').trim() && String(files[activePath] || '').trim()) {
      files[rootFile] = files[activePath];
    }

    return { rootFile: rootFile, activePath: activePath, files: files };
  }

  function summarizePayload(rootFile, files) {
    files = files || {};
    var rootText = String(files[rootFile] || '');
    return {
      rootFile: rootFile,
      fileCount: Object.keys(files).length,
      paths: Object.keys(files),
      rootLength: rootText.length,
      rootHead: rootText.slice(0, 500),
      hasDocumentClass: /\\documentclass/.test(rootText),
      hasBeginDocument: /\\begin\{document\}/.test(rootText),
      hasEndDocument: /\\end\{document\}/.test(rootText)
    };
  }

  function buildCompileRequest(project, settings) {
    settings = normalizeSettings(settings || getGlobalSettings());
    project = isObject(project) && (project.project || project.settings) ? (project.project || project) : (project || getGlobalProject());
    var collected = collectFiles(project, settings);
    var summary = summarizePayload(collected.rootFile, collected.files);

    if (!summary.rootLength) {
      throw new Error('Root file ' + collected.rootFile + ' is empty before compile. Frontend did not provide actual LaTeX source.');
    }

    return {
      schema: 'lumina-latex-compile-request-v1',
      stage: STAGE,
      rootFile: collected.rootFile,
      mainFile: collected.rootFile,
      activePath: collected.activePath,
      engine: settings.engine || 'pdflatex',
      bibliography: settings.bibliography || 'bibtex',
      shellEscape: false,
      rerun: true,
      files: collected.files,
      compileInputSummary: summary
    };
  }

  function tryMakePdfUrls(result) {
    var b64 = result.pdfBase64 || result.pdfBytesBase64 || null;
    if (!b64 && typeof result.pdf === 'string' && result.pdf.indexOf('data:application/pdf;base64,') === 0) {
      b64 = result.pdf.split(',', 2)[1];
    }
    if (!b64) return result;
    result.pdfBase64 = result.pdfBase64 || b64;
    result.pdfBytesBase64 = result.pdfBytesBase64 || b64;
    result.pdf = result.pdf || ('data:application/pdf;base64,' + b64);
    result.pdfDataUrl = result.pdfDataUrl || result.pdf;
    if (!result.pdfUrl && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof atob === 'function') {
      try {
        var binary = atob(b64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        result.pdfUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        result.pdfBlobUrl = result.pdfUrl;
      } catch (err) {}
    }
    return result;
  }

  function normalizeCompileResult(raw, payload) {
    raw = isObject(raw) ? raw : {};
    var result = Object.assign({}, isObject(raw.result) ? raw.result : {}, raw);
    if (raw.result && isObject(raw.result)) {
      result.jobId = result.jobId || raw.jobId;
      result.progress = result.progress == null ? raw.progress : result.progress;
    }
    result.success = Boolean(result.success || result.ok || result.status === 'success' || result.status === 'completed');
    result.ok = result.success;
    result.status = result.success ? 'success' : (result.status || 'failed');
    result.provider = result.provider || 'cloudrun-texlive-latexmk';
    result.stage = result.stage || STAGE;
    result.message = result.message || (result.success ? 'Compile succeeded.' : 'Compile failed.');
    result.compileInputSummary = result.compileInputSummary || (payload && payload.compileInputSummary);
    return tryMakePdfUrls(result);
  }

  async function fetchJson(url, init) {
    var response = await root.fetch(url, init || {});
    var text = await response.text();
    var data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (err) { data = { rawText: text }; }
    if (!response.ok) {
      throw new Error((data && (data.detail || data.message)) || ('HTTP ' + response.status));
    }
    return data;
  }

  function pickProjectSettings(args) {
    args = Array.prototype.slice.call(args || []);
    var project = null;
    var settings = null;
    args.forEach(function (arg) {
      if (!isObject(arg)) return;
      if (arg.project) project = arg.project;
      if (arg.settings) settings = arg.settings;
      if (!project && (arg.rootFile || arg.mainFile || arg.activePath || arg.files || arg.fileMap || arg.documents)) project = arg;
      if (!settings && (arg.compileUrl || arg.compileStatusUrl || arg.backendStatusUrl || arg.compilerMode || arg.engine)) settings = arg;
    });
    return { project: project || getGlobalProject(), settings: normalizeSettings(settings || getGlobalSettings()) };
  }

  async function compile() {
    var picked = pickProjectSettings(arguments);
    var settings = picked.settings;
    var payload = buildCompileRequest(picked.project, settings);
    if (root.console && console.log) console.log('[Latexai Stage1 Step1] compile payload', payload.compileInputSummary);

    var raw;
    if (settings.useCompileJobs) {
      raw = await fetchJson(settings.compileStatusUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // The current Cloud Run backend returns the result directly in the create-job response.
      if (raw && raw.result) return normalizeCompileResult(raw, payload);
      // Fallback for a backend that returns only a job id.
      if (raw && raw.jobId) {
        var statusUrl = settings.compileStatusUrl.replace(/\/+$/, '') + '/' + encodeURIComponent(raw.jobId);
        var deadline = Date.now() + 90000;
        while (Date.now() < deadline) {
          var job = await fetchJson(statusUrl, { method: 'GET' });
          if (job && (job.result || job.status === 'completed' || job.status === 'failed')) return normalizeCompileResult(job, payload);
          await new Promise(function (resolve) { setTimeout(resolve, Number(settings.compilePollMs || 1000)); });
        }
        throw new Error('Compile job timed out while polling backend.');
      }
      return normalizeCompileResult(raw, payload);
    }

    raw = await fetchJson(settings.compileUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return normalizeCompileResult(raw, payload);
  }

  async function checkAvailability(settings) {
    settings = normalizeSettings(settings || getGlobalSettings());
    try {
      var raw = await fetchJson(settings.backendStatusUrl, { method: 'GET' });
      return {
        ok: true,
        status: 'online',
        checkedAt: new Date().toISOString(),
        httpStatus: 200,
        stage: raw.stage || STAGE,
        tex: raw.tex || {
          ok: true,
          provider: raw.provider || 'cloudrun-texlive-latexmk',
          engines: raw.engines || ['pdflatex', 'xelatex', 'lualatex']
        },
        policy: raw.policy || { shellEscape: false },
        raw: raw,
        availability: {
          compileUrl: settings.compileUrl,
          jobsUrl: settings.compileStatusUrl,
          statusUrl: settings.backendStatusUrl,
          staticHost: typeof location !== 'undefined' ? /github\.io$/i.test(location.hostname) : false,
          defaultRelativeCompileUrl: false,
          staticDraftFallbackActive: false,
          shellEscapeEffective: false,
          note: 'Backend URL is configured; compile attempts are sent to Cloud Run TeX Live.'
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
    compileProject: compile,
    runCompile: compile,
    buildCompileRequest: buildCompileRequest,
    collectFiles: collectFiles,
    summarizePayload: summarizePayload,
    normalizeSettings: normalizeSettings,
    checkAvailability: checkAvailability,
    getBackendAvailability: checkAvailability,
    testBackend: checkAvailability,
    probe: checkAvailability,
    status: checkAvailability
  };

  function attachToNamespace(ns, label) {
    if (!isObject(ns)) return ns;
    if (!ns.CompilerProvider || typeof ns.CompilerProvider.compile !== 'function') {
      ns.CompilerProvider = Provider;
    }
    ns.modules = ns.modules || {};
    ns.modules.CompilerProvider = Provider;
    ns.Modules = ns.Modules || {};
    ns.Modules.CompilerProvider = Provider;
    ns.providers = ns.providers || {};
    ns.providers.CompilerProvider = Provider;
    ns.__compilerProviderStage = STAGE;
    return ns;
  }

  function installWatchedGlobal(name) {
    var current = root[name];
    attachToNamespace(current, name);
    try {
      var desc = Object.getOwnPropertyDescriptor(root, name);
      if (desc && desc.configurable === false) return;
      Object.defineProperty(root, name, {
        configurable: true,
        enumerable: true,
        get: function () {
          return current;
        },
        set: function (next) {
          current = attachToNamespace(next || {}, name);
        }
      });
      root[name] = current || {};
    } catch (err) {
      root[name] = attachToNamespace(root[name] || {}, name);
    }
  }

  function registerEverywhere() {
    root.CompilerProvider = Provider;
    root.__LatexaiCompilerProvider = Provider;
    installWatchedGlobal('LuminaLatex');
    installWatchedGlobal('Lumina');
    installWatchedGlobal('NS');
    // Also make all three names refer to an object that already has the provider
    // unless the host app intentionally separates them later; the setters above
    // will re-patch on separation.
    root.LuminaLatex = attachToNamespace(root.LuminaLatex || root.Lumina || root.NS || {}, 'LuminaLatex');
    root.Lumina = attachToNamespace(root.Lumina || root.LuminaLatex, 'Lumina');
    root.NS = attachToNamespace(root.NS || root.LuminaLatex, 'NS');
  }

  registerEverywhere();
  normalizeSettings(getGlobalSettings());

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      registerEverywhere();
      normalizeSettings(getGlobalSettings());
    });
  }

  // Re-attach for a few seconds in case the Stage 1G app overwrites namespaces
  // after this preload script runs.
  var ticks = 0;
  var interval = root.setInterval ? root.setInterval(function () {
    ticks += 1;
    registerEverywhere();
    if (ticks >= 20 && root.clearInterval) root.clearInterval(interval);
  }, 250) : null;

  if (root.console && console.log) {
    console.log('[Latexai Stage1 Step1] CompilerProvider bootstrap installed', {
      stage: STAGE,
      compileUrl: normalizeSettings().compileUrl,
      jobsUrl: normalizeSettings().compileStatusUrl,
      hasNSCompile: !!(root.NS && root.NS.CompilerProvider && root.NS.CompilerProvider.compile)
    });
  }
})();
