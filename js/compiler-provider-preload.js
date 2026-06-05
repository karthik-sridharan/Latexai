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
  var STAGE = 'stage19w39-compile-jobs-load-fallback-20260605-1';
  var SETTINGS_SCHEMA = 'lumina-latex-settings-v1';
  var DEFAULT_COMPILE_URL = BACKEND_BASE + '/api/lumina/latex/compile';
  var DEFAULT_JOBS_URL = BACKEND_BASE + '/api/lumina/latex/compile/jobs';
  var DEFAULT_STATUS_URL = BACKEND_BASE + '/api/lumina/latex/status';

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

  function deriveCompileJobsUrl(compileUrl) {
    var fallback = BACKEND_BASE + '/api/lumina/latex/compile/jobs';
    try {
      var base = (root.location && root.location.href) || BACKEND_BASE + '/';
      var u = new URL(String(compileUrl || ''), base);
      u.hash = '';
      u.search = '';
      u.pathname = u.pathname.replace(/\/+$/, '').replace(/\/compile$/, '/compile/jobs');
      if (!/\/compile\/jobs$/i.test(u.pathname)) {
        u.pathname = '/api/lumina/latex/compile/jobs';
      }
      return u.href;
    } catch (err) {
      return fallback;
    }
  }

  function stringifyHttpDetail(detail) {
    if (detail == null) return '';
    if (typeof detail === 'string') return detail;
    try { return JSON.stringify(detail); } catch (err) { return String(detail); }
  }

  function looksLikeGenericLuminaBackend(url) {
    try {
      var u = new URL(String(url || ''), (root.location && root.location.href) || BACKEND_BASE + '/');
      var host = String(u.hostname || '').toLowerCase();
      return /^lumina-backend-[a-z0-9-]+\.us-east1\.run\.app$/.test(host) && host.indexOf('latex') === -1;
    } catch (err) {
      return false;
    }
  }

  function deriveCompileUrlFromStatusUrl(statusUrl) {
    try {
      var u = new URL(String(statusUrl || ''), (root.location && root.location.href) || BACKEND_BASE + '/');
      u.hash = '';
      u.search = '';
      if (/\/api\/lumina\/latex\/status\/?$/i.test(u.pathname)) {
        u.pathname = u.pathname.replace(/\/status\/?$/i, '/compile');
        return u.href;
      }
    } catch (err) {}
    return '';
  }

  function deriveCompileUrlFromJobsUrl(jobsUrl) {
    try {
      var u = new URL(String(jobsUrl || ''), (root.location && root.location.href) || BACKEND_BASE + '/');
      u.hash = '';
      u.search = '';
      if (/\/api\/lumina\/latex\/compile\/jobs\/?$/i.test(u.pathname)) {
        u.pathname = u.pathname.replace(/\/compile\/jobs\/?$/i, '/compile');
        return u.href;
      }
    } catch (err) {}
    return '';
  }

  function uniqueUrls(urls) {
    var seen = {};
    var out = [];
    (urls || []).forEach(function (url) {
      if (!url) return;
      var key = String(url).replace(/\/+$/, '');
      if (seen[key]) return;
      seen[key] = true;
      out.push(String(url));
    });
    return out;
  }

  function buildDirectCompileUrlCandidates(settings) {
    settings = settings || {};
    return uniqueUrls([
      settings.compileUrl,
      deriveCompileUrlFromJobsUrl(settings.compileStatusUrl),
      deriveCompileUrlFromStatusUrl(settings.backendStatusUrl),
      DEFAULT_COMPILE_URL
    ]);
  }

  function buildJobCompileUrlCandidates(settings) {
    settings = settings || {};
    var directCandidates = buildDirectCompileUrlCandidates(settings);
    return uniqueUrls([
      settings.compileStatusUrl,
      deriveCompileJobsUrl(settings.compileUrl)
    ].concat(directCandidates.map(deriveCompileJobsUrl)).concat([DEFAULT_JOBS_URL]));
  }

  function shouldSyncJobsUrlWithCompileUrl(compileUrl, jobsUrl) {
    try {
      var c = new URL(String(compileUrl || ''), (root.location && root.location.href) || BACKEND_BASE + '/');
      var j = new URL(String(jobsUrl || ''), (root.location && root.location.href) || BACKEND_BASE + '/');
      var compileLooksStandard = /\/api\/lumina\/latex\/compile\/?$/i.test(c.pathname);
      var jobsLooksStandard = /\/api\/lumina\/latex\/compile\/jobs\/?$/i.test(j.pathname);
      return compileLooksStandard && jobsLooksStandard && c.origin !== j.origin;
    } catch (err) {
      return false;
    }
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

    // Stage 17T: repair stale settings created by the Stage 17Q auto-sync.
    // Some browsers had compileUrl pointing at the generic Lumina backend
    // (lumina-backend-*.run.app) while backendStatusUrl still pointed at the
    // real LaTeX compiler. Sending LaTeX compile payloads to the generic backend
    // causes HTTP 400 before TeX even runs. Prefer the status-derived LaTeX
    // compiler endpoint in that case, and keep the direct/jobs endpoints paired.
    var statusDerivedCompileUrl = deriveCompileUrlFromStatusUrl(next.backendStatusUrl);
    if (looksLikeGenericLuminaBackend(next.compileUrl) && statusDerivedCompileUrl) {
      next.compileUrl = statusDerivedCompileUrl;
      next.compileStatusUrl = deriveCompileJobsUrl(statusDerivedCompileUrl);
      next.compileEndpointRepair = 'stage17t-repaired-generic-backend-compile-url-from-backendStatusUrl';
      next.compileStatusUrlAutoDerived = false;
    } else {
      var derivedJobsUrl = deriveCompileJobsUrl(next.compileUrl);
      if (shouldSyncJobsUrlWithCompileUrl(next.compileUrl, next.compileStatusUrl)) {
        next.compileStatusUrl = derivedJobsUrl;
        next.compileStatusUrlAutoDerived = true;
      }
    }
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

  function arrayBufferToBase64(buffer) {
    try {
      if (typeof Buffer !== 'undefined') return Buffer.from(buffer).toString('base64');
    } catch (err) {}
    var bytes = new Uint8Array(buffer || []);
    var chunkSize = 0x8000;
    var binary = '';
    for (var i = 0; i < bytes.length; i += chunkSize) {
      var chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.prototype.slice.call(chunk));
    }
    if (typeof btoa === 'function') return btoa(binary);
    return '';
  }

  function normalizeMaybePdfUrl(url, baseUrl) {
    if (typeof url !== 'string' || !url.trim()) return '';
    var raw = url.trim();
    if (raw.indexOf('data:application/pdf;base64,') === 0) return raw;
    try {
      return new URL(raw, baseUrl || (root.location && root.location.href) || BACKEND_BASE + '/').href;
    } catch (err) {
      return raw;
    }
  }

  function mergePdfHint(target, key, value, baseUrl) {
    if (typeof value !== 'string' || !value) return;
    var lower = String(key || '').toLowerCase();
    if (/^(jobpdfendpointurl|jobpdfendpointerror|compileendpointurl|compilestatusurl|backendstatusurl)$/i.test(String(key || ''))) return;
    var v = value.trim();
    if (!v) return;
    if (v.indexOf('data:application/pdf;base64,') === 0) {
      target.dataUrl = target.dataUrl || v;
      target.b64 = target.b64 || v.split(',', 2)[1];
      return;
    }
    if (/^(pdfbase64|pdfbytesbase64|pdfb64|base64|bytesbase64|dataBase64)$/i.test(String(key || '')) || /pdf.*base64/i.test(lower)) {
      if (/^[A-Za-z0-9+/=\s]+$/.test(v) && v.length > 20) target.b64 = target.b64 || v.replace(/\s+/g, '');
      return;
    }
    if (/^(pdfurl|pdfbloburl|outputurl|downloadurl|artifacturl|url)$/i.test(String(key || '')) || /pdf.*url/i.test(lower)) {
      if (/\.pdf(?:[?#]|$)/i.test(v) || /\/pdf(?:[?#]|$)/i.test(v) || /^blob:/i.test(v) || /^https?:/i.test(v) || v.charAt(0) === '/') {
        target.url = target.url || normalizeMaybePdfUrl(v, baseUrl);
      }
    }
  }

  function collectPdfHints(obj, baseUrl, depth, seen) {
    var out = { b64: '', dataUrl: '', url: '' };
    if (!isObject(obj) || depth > 5) return out;
    seen = seen || [];
    if (seen.indexOf(obj) >= 0) return out;
    seen.push(obj);
    Object.keys(obj).forEach(function (key) {
      var value = obj[key];
      if (typeof value === 'string') mergePdfHint(out, key, value, baseUrl);
      else if (isObject(value)) {
        var nested = collectPdfHints(value, baseUrl, depth + 1, seen);
        out.b64 = out.b64 || nested.b64;
        out.dataUrl = out.dataUrl || nested.dataUrl;
        out.url = out.url || nested.url;
      }
    });
    return out;
  }

  function tryMakePdfUrls(result, baseUrl) {
    result = isObject(result) ? result : {};
    var hints = collectPdfHints(result, baseUrl || result.compileEndpointUrl || result.compileStatusUrl || result.pdfBaseUrl || '', 0);
    var b64 = result.pdfBase64 || result.pdfBytesBase64 || hints.b64 || null;
    if (!b64 && typeof result.pdf === 'string' && result.pdf.indexOf('data:application/pdf;base64,') === 0) {
      b64 = result.pdf.split(',', 2)[1];
    }
    if (!b64 && typeof result.pdfDataUrl === 'string' && result.pdfDataUrl.indexOf('data:application/pdf;base64,') === 0) {
      b64 = result.pdfDataUrl.split(',', 2)[1];
    }
    if (b64) {
      result.pdfBase64 = result.pdfBase64 || b64;
      result.pdfBytesBase64 = result.pdfBytesBase64 || b64;
      result.pdf = result.pdf || ('data:application/pdf;base64,' + b64);
      result.pdfDataUrl = result.pdfDataUrl || result.pdf;
      result.pdfExtracted = result.pdfExtracted !== false;
      if (!result.pdfUrl && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof atob === 'function') {
        try {
          var binary = atob(b64);
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          result.pdfUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
          result.pdfBlobUrl = result.pdfUrl;
        } catch (err) {}
      }
    }
    var hintedUrl = result.pdfUrl || result.pdfBlobUrl || result.outputUrl || hints.url || '';
    if (hintedUrl) {
      var normalized = normalizeMaybePdfUrl(hintedUrl, baseUrl || result.compileEndpointUrl || result.compileStatusUrl || '');
      if (normalized.indexOf('data:application/pdf;base64,') === 0) {
        var hintedB64 = normalized.split(',', 2)[1];
        result.pdfBase64 = result.pdfBase64 || hintedB64;
        result.pdfBytesBase64 = result.pdfBytesBase64 || hintedB64;
        result.pdf = result.pdf || normalized;
        result.pdfDataUrl = result.pdfDataUrl || normalized;
      } else {
        result.pdfUrl = result.pdfUrl || normalized;
        result.pdfBlobUrl = result.pdfBlobUrl || (/^blob:/i.test(normalized) ? normalized : result.pdfBlobUrl);
        result.outputUrl = result.outputUrl || normalized;
      }
      result.pdfExtracted = result.pdfExtracted !== false;
    }
    return result;
  }

  function hasPdfPayload(result) {
    if (!result) return false;
    result = tryMakePdfUrls(result);
    if (result.pdfBase64 || result.pdfBytesBase64) return true;
    if (typeof result.pdf === 'string' && result.pdf.indexOf('data:application/pdf;base64,') === 0) return true;
    if (typeof result.pdfDataUrl === 'string' && result.pdfDataUrl.indexOf('data:application/pdf;base64,') === 0) return true;
    if (typeof result.pdfUrl === 'string' && result.pdfUrl) return true;
    if (typeof result.pdfBlobUrl === 'string' && result.pdfBlobUrl) return true;
    if (typeof result.outputUrl === 'string' && result.outputUrl) return true;
    return false;
  }


  function stage17xIsBase64ish(value) {
    value = String(value || '');
    return value.length > 2000 && /^[A-Za-z0-9+/=\r\n]+$/.test(value.slice(0, 2000));
  }

  function stage17xStringValue(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(stage17xStringValue).filter(Boolean).join('\n');
    if (isObject(value)) {
      if (typeof value.message === 'string') return value.message;
      if (typeof value.text === 'string') return value.text;
      if (typeof value.value === 'string') return value.value;
    }
    return '';
  }

  function stage17xCollectLogText() {
    var chunks = [];
    var seen = [];
    var keys = {
      log: true,
      logs: true,
      logText: true,
      latexLog: true,
      texLog: true,
      compileLog: true,
      buildLog: true,
      output: true,
      stdout: true,
      stderr: true,
      error: true,
      detail: true
    };
    function add(label, value) {
      var text = stage17xStringValue(value);
      if (!text || stage17xIsBase64ish(text) || text.indexOf('data:application/pdf;base64,') === 0) return;
      if (seen.indexOf(text) >= 0) return;
      seen.push(text);
      chunks.push(label ? (label + ':\n' + text) : text);
    }
    function walk(obj, depth) {
      if (!isObject(obj) || depth > 4) return;
      Object.keys(obj).forEach(function (key) {
        if (/pdf|synctex|base64|bytes/i.test(key)) return;
        var value = obj[key];
        if (keys[key] || /(?:^|_)(?:log|stderr|stdout|output|error|detail|message)$/i.test(key)) add(key, value);
        else if (isObject(value)) walk(value, depth + 1);
      });
    }
    for (var i = 0; i < arguments.length; i++) walk(arguments[i], 0);
    return chunks.join('\n\n').slice(-220000);
  }

  function stage17xNormalizeProblemMessage(message) {
    return String(message || '').replace(/^!\s*/, '').replace(/\s+/g, ' ').trim();
  }

  function stage17xProblemKey(problem) {
    return [problem.file || '', problem.line || '', problem.level || '', stage17xNormalizeProblemMessage(problem.message)].join('|');
  }

  function stage17xParseLatexProblems(logText) {
    var problems = [];
    var lines = String(logText || '').split(/\r?\n/);
    var lastFile = '';
    function add(problem) {
      if (!problem || !problem.message) return;
      problem.level = problem.level || 'error';
      problem.message = stage17xNormalizeProblemMessage(problem.message);
      if (!problem.message) return;
      var key = stage17xProblemKey(problem);
      for (var i = 0; i < problems.length; i++) {
        if (stage17xProblemKey(problems[i]) === key) return;
      }
      problems.push(problem);
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i] || '';
      var fileLine = line.match(/(?:^|\s)([^\s:()]+\.tex):(\d+):\s*(.+)$/i);
      if (fileLine) {
        lastFile = fileLine[1].replace(/^\.\//, '');
        add({ level: /^warning/i.test(fileLine[3]) ? 'warn' : 'error', file: lastFile, line: Number(fileLine[2]) || null, message: fileLine[3] });
        continue;
      }
      var bang = line.match(/^!\s*(.+)$/);
      if (bang) {
        var msg = bang[1];
        var texLine = null;
        var nearFile = lastFile || '';
        for (var j = i + 1; j < Math.min(lines.length, i + 8); j++) {
          var l = String(lines[j] || '').match(/^l\.(\d+)\s*(.*)$/);
          if (l) {
            texLine = Number(l[1]) || null;
            if (l[2]) msg += ' near: ' + l[2].trim();
            break;
          }
          var fl = String(lines[j] || '').match(/(?:^|\s)([^\s:()]+\.tex):(\d+):/i);
          if (fl) {
            nearFile = fl[1].replace(/^\.\//, '');
            texLine = Number(fl[2]) || texLine;
          }
        }
        add({ level: 'error', file: nearFile || null, line: texLine, message: msg });
        continue;
      }
      var latexErr = line.match(/(?:LaTeX|Package\s+[^\s]+)\s+(Error|Warning):\s*(.+)$/i);
      if (latexErr) {
        add({ level: /warning/i.test(latexErr[1]) ? 'warn' : 'error', file: lastFile || null, line: null, message: latexErr[2] });
        continue;
      }
      var warn = line.match(/(?:LaTeX|Package\s+[^\s]+)\s+Warning:\s*(.+)$/i);
      if (warn) add({ level: 'warn', file: lastFile || null, line: null, message: warn[1] });
    }
    return problems.slice(0, 40);
  }

  function stage17xMergeProblems(existing, parsed) {
    var out = Array.isArray(existing) ? existing.slice() : [];
    var seen = {};
    out.forEach(function (p) { if (p) seen[stage17xProblemKey(p)] = true; });
    (parsed || []).forEach(function (p) {
      var key = stage17xProblemKey(p);
      if (!seen[key]) {
        seen[key] = true;
        out.push(p);
      }
    });
    return out;
  }

  function stage17xIsGenericCompileMessage(message) {
    return /^(Compile failed\.? See log|Compile finished with diagnostics\.?|Compile completed\.?|Compile failed\.?$)/i.test(String(message || '').trim());
  }

  function stage17xShortFailureMessage(result) {
    var problems = Array.isArray(result && result.problems) ? result.problems : [];
    var first = problems.filter(function (p) { return p && p.level !== 'warn'; })[0] || problems[0];
    if (first && first.message) {
      var loc = first.file ? (first.file + (first.line ? ':' + first.line : '')) : (first.line ? ('line ' + first.line) : '');
      return 'LaTeX error' + (loc ? ' at ' + loc : '') + ': ' + first.message;
    }
    var log = String(result && result.log || '');
    var bang = log.match(/^!\s*(.+)$/m);
    if (bang) return 'LaTeX error: ' + stage17xNormalizeProblemMessage(bang[1]);
    if (result && result.exitCode != null) return 'Compile failed with exit code ' + result.exitCode + '. See Logs for details.';
    return 'Compile failed. See Logs for details.';
  }

  function markMissingPdf(result, payload, note) {
    result = isObject(result) ? Object.assign({}, result) : {};
    result.success = false;
    result.ok = false;
    result.status = 'failed';
    result.stage = result.stage || STAGE;
    result.message = note || 'Compile backend reported success but did not return a PDF payload.';
    result.compileInputSummary = result.compileInputSummary || (payload && payload.compileInputSummary);
    var problem = {
      level: 'error',
      message: result.message,
      line: null
    };
    result.problems = Array.isArray(result.problems) ? result.problems.slice() : [];
    if (!result.problems.some(function (p) { return p && p.message === problem.message; })) result.problems.unshift(problem);
    return result;
  }

  function isCompileSuccessStatus(status) {
    return /^(success|completed|succeeded|ok|done)$/i.test(String(status || '').trim());
  }

  function isCompileFailureStatus(status) {
    return /^(failed|failure|error|errored|timeout|timedout|timed_out|cancelled|canceled)$/i.test(String(status || '').trim());
  }

  function normalizeCompileResult(raw, payload) {
    raw = isObject(raw) ? raw : {};

    // Stage 17X: a job-create response is a wrapper: { ok:true, status:"completed", result:{...} }.
    // The wrapper's ok/status only means the job API request completed; it does
    // NOT mean TeX succeeded. The nested result must own success/failure, logs,
    // and PDF fields. Previous stages let wrapper ok:true overwrite result.ok:false,
    // causing real LaTeX errors to be misreported as "success without PDF".
    var hasNestedResult = raw.result && isObject(raw.result);
    var wrapper = Object.assign({}, raw);
    if (hasNestedResult) delete wrapper.result;
    var result = hasNestedResult ? Object.assign({}, wrapper, raw.result) : Object.assign({}, raw);

    if (hasNestedResult) {
      result.jobId = result.jobId || raw.jobId;
      result.compileJobId = result.compileJobId || raw.jobId;
      result.progress = result.progress == null ? raw.progress : result.progress;
      result.jobStatus = raw.status || result.jobStatus;
      result.jobOk = raw.ok;
      result.jobMessage = raw.message || result.jobMessage;
    }

    var consolidatedLog = stage17xCollectLogText(result, raw);
    if (consolidatedLog) result.log = consolidatedLog;
    var parsedProblems = stage17xParseLatexProblems(result.log || result.stderr || result.stdout || result.message || '');
    result.problems = stage17xMergeProblems(result.problems, parsedProblems);

    var status = String(result.status || '').toLowerCase();
    var explicitFailure = result.success === false || result.ok === false || isCompileFailureStatus(status) || Number(result.exitCode) > 0 || result.timedOut === true;
    var explicitSuccess = result.success === true || result.ok === true || isCompileSuccessStatus(status) || Number(result.exitCode) === 0 || result.pdfExtracted === true;

    result.success = Boolean(!explicitFailure && explicitSuccess);
    result.ok = result.success;
    result.status = result.success ? 'success' : (result.status || 'failed');
    result.provider = result.provider || 'cloudrun-texlive-latexmk';
    result.stage = result.stage || STAGE;
    result.message = result.message || (result.success ? 'Compile succeeded.' : 'Compile failed. See log/stderr for details.');
    if (!result.success && stage17xIsGenericCompileMessage(result.message)) {
      result.message = stage17xShortFailureMessage(result);
    }
    result.compileInputSummary = result.compileInputSummary || (payload && payload.compileInputSummary);
    return tryMakePdfUrls(result, result.compileEndpointUrl || result.compileStatusUrl || result.pdfBaseUrl || '');
  }

  async function fetchJson(url, init) {
    var response = await root.fetch(url, init || {});
    var contentType = String(response.headers && response.headers.get && response.headers.get('content-type') || '').toLowerCase();
    if (response.ok && /application\/pdf|application\/octet-stream/.test(contentType) && typeof response.arrayBuffer === 'function') {
      var buffer = await response.arrayBuffer();
      var b64 = arrayBufferToBase64(buffer);
      return {
        ok: true,
        success: true,
        status: 'success',
        pdfExtracted: Boolean(b64),
        pdfBytesLength: buffer && buffer.byteLength || 0,
        pdfBase64: b64,
        pdfBytesBase64: b64,
        pdf: b64 ? ('data:application/pdf;base64,' + b64) : null,
        message: 'Compile succeeded; endpoint returned raw PDF bytes.'
      };
    }
    var text = await response.text();
    var data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (err) { data = { rawText: text }; }
    if (response.ok && typeof text === 'string' && /^%PDF-/i.test(text.slice(0, 16))) {
      var rawB64 = arrayBufferToBase64(new TextEncoder().encode(text).buffer);
      data = { ok: true, success: true, status: 'success', pdfBase64: rawB64, pdfBytesBase64: rawB64, pdf: 'data:application/pdf;base64,' + rawB64, message: 'Compile succeeded; endpoint returned raw PDF text.' };
    }
    if (!response.ok) {
      var detail = data && (data.detail || data.message || data.error || data.rawText);
      var detailText = stringifyHttpDetail(detail);
      var msg = detailText ? ('HTTP ' + response.status + ': ' + detailText.slice(0, 1600)) : ('HTTP ' + response.status);
      var httpErr = new Error(msg);
      httpErr.httpStatus = response.status;
      httpErr.url = String(url || '');
      httpErr.responseBody = data;
      httpErr.responseText = text;
      throw httpErr;
    }
    return data;
  }


  function buildJobPdfUrl(settings, jobId) {
    if (!jobId) return '';
    var jobsUrl = (settings && settings.compileStatusUrl) || DEFAULT_JOBS_URL;
    return String(jobsUrl || DEFAULT_JOBS_URL).replace(/\/+$/, '') + '/' + encodeURIComponent(String(jobId)) + '/pdf';
  }

  async function fetchPdfBlobResult(url, payload, baseResult, label) {
    var response = await root.fetch(url, { method: 'GET' });
    if (!response.ok) {
      var text = '';
      try { text = await response.text(); } catch (err) {}
      throw new Error('HTTP ' + (response.status || 0) + (text ? ': ' + text.slice(0, 1000) : ''));
    }
    var contentType = String(response.headers && response.headers.get && response.headers.get('content-type') || '').toLowerCase();
    var buffer = await response.arrayBuffer();
    if (!buffer || !buffer.byteLength) throw new Error('PDF endpoint returned an empty response.');
    var result = Object.assign({}, isObject(baseResult) ? baseResult : {});
    result.ok = true;
    result.success = true;
    result.status = 'success';
    result.stage = result.stage || STAGE;
    result.provider = result.provider || 'cloudrun-texlive-latexmk';
    result.message = label || 'Compile succeeded; PDF was loaded from the job PDF endpoint.';
    result.pdfExtracted = true;
    result.pdfBytesLength = buffer.byteLength;
    result.pdfEndpointUrl = url;
    result.compileInputSummary = result.compileInputSummary || (payload && payload.compileInputSummary);
    try {
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        result.pdfUrl = URL.createObjectURL(new Blob([buffer], { type: contentType || 'application/pdf' }));
        result.pdfBlobUrl = result.pdfUrl;
      }
    } catch (blobErr) {}
    if (!result.pdfUrl) {
      var b64 = arrayBufferToBase64(buffer);
      if (b64) {
        result.pdfBase64 = b64;
        result.pdfBytesBase64 = b64;
        result.pdf = 'data:application/pdf;base64,' + b64;
        result.pdfDataUrl = result.pdf;
      }
    }
    return tryMakePdfUrls(result, url);
  }

  async function tryHydratePdfFromJobEndpoint(result, payload, settings) {
    result = normalizeCompileResult(result, payload);
    if (!result.ok) return result;
    if (hasPdfPayload(result)) return result;
    var jobId = result.jobId || result.id || result.compileJobId;
    if (!jobId) return result;
    var pdfUrl = buildJobPdfUrl(settings, jobId);
    if (!pdfUrl) return result;
    try {
      return await fetchPdfBlobResult(pdfUrl, payload, result, 'Compile succeeded; PDF was retrieved from /compile/jobs/' + jobId + '/pdf.');
    } catch (err) {
      result.jobPdfEndpointUrl = pdfUrl;
      result.jobPdfEndpointError = (err && err.message) || String(err);
      // If browser fetch is blocked by CORS/network policy, the iframe may still
      // be able to display the PDF URL directly. Do not expose known HTTP errors
      // such as 404 as successful PDF payloads.
      if (!/^HTTP\s+\d+/i.test(result.jobPdfEndpointError)) {
        result.pdfUrl = result.pdfUrl || pdfUrl;
        result.outputUrl = result.outputUrl || pdfUrl;
        result.pdfEndpointFallbackExposed = true;
      }
      return tryMakePdfUrls(result, pdfUrl);
    }
  }

  function isJobEndpointFailure(err) {
    var status = Number(err && err.httpStatus);
    if (status === 400 || status === 404 || status === 405 || status === 501) return true;
    var msg = String((err && err.message) || err || '');
    // Safari/iPad often reports CORS/network failures simply as "Load failed".
    // When this happens while creating/polling /compile/jobs, treat it as a
    // job-endpoint transport failure and fall back to the direct /compile route
    // instead of surfacing a useless provider error.
    if (/load failed|failed to fetch|networkerror|network error|cors|cancelled|cancelled/i.test(msg)) return true;
    return /HTTP\s+(400|404|405|501)\b/i.test(msg) || /compile\/jobs/i.test(String(err && err.url || '')) && /not found|unsupported|bad request|method/i.test(msg);
  }

  async function fallbackToDirectAfterJobError(err, payload, settings, phase) {
    var reason = (phase || 'compile job endpoint') + ' failed: ' + ((err && err.message) || String(err));
    try {
      var directResult = await tryDirectCompileCandidates(payload, settings);
      directResult.jobCompileFallbackReason = reason;
      return requirePdfOrFallback(directResult, payload, settings, 'direct');
    } catch (directErr) {
      var directMsg = (directErr && directErr.message) || String(directErr);
      var out = markMissingPdf({}, payload, reason + '; direct compile fallback failed: ' + directMsg);
      out.originalJobError = reason;
      out.directFallbackError = directMsg;
      return out;
    }
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

  async function compileDirectToUrl(payload, url) {
    var directRaw = await fetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var directResult = normalizeCompileResult(directRaw, payload);
    directResult.usedDirectCompileEndpoint = true;
    directResult.compileEndpointUrl = url;
    return directResult;
  }

  async function compileDirect(payload, settings) {
    return compileDirectToUrl(payload, settings.compileUrl);
  }

  async function tryDirectCompileCandidates(payload, settings) {
    var urls = buildDirectCompileUrlCandidates(settings);
    var errors = [];
    for (var i = 0; i < urls.length; i++) {
      try {
        var result = await compileDirectToUrl(payload, urls[i]);
        result.compileEndpointAttempts = urls.slice(0, i + 1);
        return result;
      } catch (err) {
        errors.push(urls[i] + ' -> ' + ((err && err.message) || String(err)));
      }
    }
    var finalErr = new Error(errors.join(' | ') || 'No direct compile endpoints were available.');
    finalErr.compileEndpointErrors = errors;
    throw finalErr;
  }

  async function requirePdfOrFallback(result, payload, settings, source) {
    result = normalizeCompileResult(result, payload);
    result = await tryHydratePdfFromJobEndpoint(result, payload, settings || {});
    if (hasPdfPayload(result) || result.mode === 'static-draft-fallback' || result.mode === 'mock-draft') return result;
    if (result.ok && settings && settings.useCompileJobs && source !== 'direct') {
      try {
        var directResult = await tryDirectCompileCandidates(payload, settings);
        directResult.jobCompileFallbackReason = 'job result had status success but no PDF payload';
        directResult = await tryHydratePdfFromJobEndpoint(directResult, payload, settings || {});
        if (!directResult.ok) return directResult;
        if (hasPdfPayload(directResult)) return directResult;
        return markMissingPdf(directResult, payload, 'Compile job and direct compile endpoint completed without returning or exposing a PDF. The frontend tried pdfBase64/pdfBytesBase64/pdf data URL, nested PDF fields, pdfUrl/outputUrl, and /compile/jobs/{jobId}/pdf.');
      } catch (err) {
        return markMissingPdf(result, payload, 'Compile job completed without a PDF, and direct compile fallback failed: ' + (err && err.message ? err.message : String(err)));
      }
    }
    if (result.ok && !hasPdfPayload(result)) {
      return markMissingPdf(result, payload, 'Compile backend reported success but did not return or expose a PDF payload. The frontend checked direct PDF fields, nested PDF fields, URL fields, and the job PDF endpoint.');
    }
    return result;
  }

  async function compile() {
    var picked = pickProjectSettings(arguments);
    var settings = picked.settings;
    var payload = buildCompileRequest(picked.project, settings);
    if (root.console && console.log) console.log('[Latexai Stage17W] compile payload', payload.compileInputSummary);

    var raw;
    if (settings.useCompileJobs) {
      var jobUrls = buildJobCompileUrlCandidates(settings);
      var jobCreateErrors = [];
      for (var jobUrlIndex = 0; jobUrlIndex < jobUrls.length; jobUrlIndex++) {
        try {
          raw = await fetchJson(jobUrls[jobUrlIndex], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          settings.compileStatusUrl = jobUrls[jobUrlIndex];
          break;
        } catch (jobCreateErr) {
          jobCreateErrors.push(jobUrls[jobUrlIndex] + ' -> ' + ((jobCreateErr && jobCreateErr.message) || String(jobCreateErr)));
          if (!isJobEndpointFailure(jobCreateErr)) throw jobCreateErr;
        }
      }
      if (!raw) {
        return fallbackToDirectAfterJobError(new Error(jobCreateErrors.join(' | ')), payload, settings, 'compile job creation endpoint');
      }
      // The current Cloud Run backend may return the result directly in the create-job response.
      if (raw && raw.result) return requirePdfOrFallback(raw, payload, settings, 'job-create');
      // Fallback for a backend that returns only a job id.
      if (raw && raw.jobId) {
        var statusUrl = settings.compileStatusUrl.replace(/\/+$/, '') + '/' + encodeURIComponent(raw.jobId);
        var deadline = Date.now() + Number(settings.compileTimeoutMs || 90000);
        while (Date.now() < deadline) {
          var job;
          try {
            job = await fetchJson(statusUrl, { method: 'GET' });
          } catch (jobPollErr) {
            if (isJobEndpointFailure(jobPollErr)) {
              return fallbackToDirectAfterJobError(jobPollErr, payload, settings, 'compile job polling endpoint');
            }
            throw jobPollErr;
          }
          if (job && (job.result || job.status === 'completed' || job.status === 'succeeded' || job.status === 'failed')) {
            return requirePdfOrFallback(job, payload, settings, 'job-poll');
          }
          await new Promise(function (resolve) { setTimeout(resolve, Number(settings.compilePollMs || 1000)); });
        }
        return fallbackToDirectAfterJobError(new Error('Compile job timed out while polling backend.'), payload, settings, 'compile job polling endpoint');
      }
      return requirePdfOrFallback(raw, payload, settings, 'job-create');
    }

    raw = await tryDirectCompileCandidates(payload, settings);
    return requirePdfOrFallback(raw, payload, settings, 'direct');
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
    parseLatexProblemsForDiagnostics: stage17xParseLatexProblems,
    collectCompileLogForDiagnostics: stage17xCollectLogText,
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
