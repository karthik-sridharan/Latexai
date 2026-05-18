/*
 * Lumina / Latexai CompilerProvider hotfix
 * Stage: latex-stage1h-compilerprovider-namespace-fix-20260518-1
 *
 * Purpose:
 * - Restore the global namespace object expected by the existing Latexai frontend:
 *     NS.CompilerProvider.compile(...)
 * - Force the Cloud Run TeX Live backend URLs.
 * - Send actual file contents to the backend.
 * - Keep browser-WASM diagnostics irrelevant while compilerMode is backend-texlive.
 */
(function installLuminaCompilerProvider(global) {
  "use strict";

  var STAGE = "latex-stage1h-compilerprovider-namespace-fix-20260518-1";
  var BACKEND_BASE = "https://lumina-latex-backend-y4piylmfja-ue.a.run.app";

  function asObject(value) {
    return value && typeof value === "object" ? value : {};
  }

  function normalizeSettings(settings) {
    var s = Object.assign({}, asObject(settings));

    s.schema = s.schema || "lumina-latex-settings-v1";
    s.compilerMode = "backend-texlive";
    s.compileUrl = BACKEND_BASE + "/api/lumina/latex/compile";
    s.compileStatusUrl = BACKEND_BASE + "/api/lumina/latex/compile/jobs";
    s.backendStatusUrl = BACKEND_BASE + "/api/lumina/latex/status";
    s.useCompileJobs = s.useCompileJobs !== false;
    s.engine = s.engine || "pdflatex";
    s.bibliography = s.bibliography || "bibtex";
    s.shellEscape = false;

    return s;
  }

  function isBinaryPath(path) {
    return /\.(png|jpe?g|gif|webp|svg|pdf|eps|bmp|ico|zip|tar|gz|ttf|otf|woff2?)$/i.test(String(path || ""));
  }

  function dataUrlToBase64(value) {
    if (typeof value !== "string") return null;
    var marker = ";base64,";
    var idx = value.indexOf(marker);
    if (value.indexOf("data:") === 0 && idx >= 0) return value.slice(idx + marker.length);
    return null;
  }

  function getContentFromFileRecord(record) {
    if (typeof record === "string") return record;
    if (!record || typeof record !== "object") return "";

    var textKeys = [
      "content",
      "text",
      "source",
      "value",
      "data",
      "body",
      "raw",
      "latex",
      "tex"
    ];

    for (var i = 0; i < textKeys.length; i++) {
      var k = textKeys[i];
      if (typeof record[k] === "string") return record[k];
    }

    var base64Keys = ["contentBase64", "dataBase64", "base64"];
    for (var j = 0; j < base64Keys.length; j++) {
      var b = base64Keys[j];
      if (typeof record[b] === "string") {
        return {
          contentBase64: dataUrlToBase64(record[b]) || record[b],
          encoding: "base64"
        };
      }
    }

    return "";
  }

  function maybeGetActiveEditorText() {
    try {
      if (typeof global.getEditorText === "function") {
        var v0 = global.getEditorText();
        if (typeof v0 === "string") return v0;
      }
    } catch (_) {}

    try {
      if (global.LuminaEditor && typeof global.LuminaEditor.getText === "function") {
        var v1 = global.LuminaEditor.getText();
        if (typeof v1 === "string") return v1;
      }
    } catch (_) {}

    try {
      if (global.editor && typeof global.editor.getValue === "function") {
        var v2 = global.editor.getValue();
        if (typeof v2 === "string") return v2;
      }
    } catch (_) {}

    try {
      if (global.cm && typeof global.cm.getValue === "function") {
        var v3 = global.cm.getValue();
        if (typeof v3 === "string") return v3;
      }
    } catch (_) {}

    try {
      var cm = document.querySelector(".cm-content");
      if (cm && cm.innerText && cm.innerText.trim()) return cm.innerText;
    } catch (_) {}

    try {
      var selectors = [
        "textarea[data-role='latex-editor']",
        "textarea[data-testid='latex-editor']",
        "#latex-editor",
        "#editor",
        "textarea"
      ];
      for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (el && typeof el.value === "string" && el.value.trim()) return el.value;
      }
    } catch (_) {}

    return "";
  }

  function collectProjectFiles(project) {
    project = asObject(project);

    var files = {};
    var rawFiles = project.files;

    if (rawFiles && !Array.isArray(rawFiles) && typeof rawFiles === "object") {
      Object.keys(rawFiles).forEach(function (path) {
        files[path] = getContentFromFileRecord(rawFiles[path]);
      });
    }

    if (Array.isArray(rawFiles)) {
      rawFiles.forEach(function (item) {
        if (!item || typeof item !== "object") return;
        var path = item.path || item.name || item.filename || item.fileName;
        if (!path) return;
        files[path] = getContentFromFileRecord(item);
      });
    }

    var additional = project.additionalFiles;
    if (additional && !Array.isArray(additional) && typeof additional === "object") {
      Object.keys(additional).forEach(function (path) {
        if (files[path] === undefined) files[path] = getContentFromFileRecord(additional[path]);
      });
    }

    if (Array.isArray(additional)) {
      additional.forEach(function (item) {
        if (!item || typeof item !== "object") return;
        var path = item.path || item.name || item.filename || item.fileName;
        if (!path || files[path] !== undefined) return;
        files[path] = getContentFromFileRecord(item);
      });
    }

    return files;
  }

  function looksLikeCompilePayload(value) {
    return !!(
      value &&
      typeof value === "object" &&
      (value.rootFile || value.mainFile || value.activePath) &&
      value.files
    );
  }

  function summarizePayload(payload) {
    payload = asObject(payload);
    var files = asObject(payload.files);
    var rootFile = payload.rootFile || payload.mainFile || payload.activePath || "main.tex";
    var root = files[rootFile];

    var rootString = typeof root === "string" ? root : "";
    if (!rootString && root && typeof root === "object") {
      rootString = JSON.stringify(root).slice(0, 500);
    }

    return {
      rootFile: rootFile,
      fileCount: Object.keys(files).length,
      paths: Object.keys(files),
      rootLength: rootString.length,
      rootHead: rootString.slice(0, 500),
      hasDocumentClass: /\\documentclass/.test(rootString),
      hasBeginDocument: /\\begin\{document\}/.test(rootString),
      hasEndDocument: /\\end\{document\}/.test(rootString)
    };
  }

  function buildCompileRequest(arg0, arg1, arg2) {
    var settings;
    var project;
    var payload;

    if (looksLikeCompilePayload(arg0)) {
      payload = Object.assign({}, arg0);
      settings = normalizeSettings(arg1 || payload.settings || {});
    } else if (arg0 && typeof arg0 === "object" && arg0.project) {
      project = asObject(arg0.project);
      settings = normalizeSettings(arg0.settings || arg1 || {});
    } else {
      project = asObject(arg0);
      settings = normalizeSettings(arg1 || {});
    }

    if (!payload) {
      var rootFile =
        project.rootFile ||
        project.mainFile ||
        project.activePath ||
        "main.tex";

      var activePath = project.activePath || rootFile;
      var files = collectProjectFiles(project);

      var activeEditorText = maybeGetActiveEditorText();
      if (activeEditorText && activeEditorText.trim()) {
        files[activePath] = activeEditorText;
        if (!files[rootFile] || !String(files[rootFile]).trim()) {
          files[rootFile] = activeEditorText;
        }
      }

      if (!files[rootFile] && typeof project.source === "string") files[rootFile] = project.source;
      if (!files[rootFile] && typeof project.content === "string") files[rootFile] = project.content;
      if (!files[rootFile] && typeof project.tex === "string") files[rootFile] = project.tex;
      if (!files[rootFile] && typeof project.mainTex === "string") files[rootFile] = project.mainTex;

      payload = {
        schema: "lumina-latex-compile-request-v1",
        rootFile: rootFile,
        mainFile: rootFile,
        activePath: activePath,
        engine: settings.engine || "pdflatex",
        bibliography: settings.bibliography || "bibtex",
        shellEscape: false,
        rerun: true,
        files: files
      };
    } else {
      settings = normalizeSettings(settings || {});
      payload.rootFile = payload.rootFile || payload.mainFile || payload.activePath || "main.tex";
      payload.mainFile = payload.mainFile || payload.rootFile;
      payload.activePath = payload.activePath || payload.rootFile;
      payload.engine = payload.engine || settings.engine || "pdflatex";
      payload.bibliography = payload.bibliography || settings.bibliography || "bibtex";
      payload.shellEscape = false;

      var existingFiles = collectProjectFiles(payload);
      if (Object.keys(existingFiles).length > 0) payload.files = existingFiles;
    }

    payload.compileInputSummary = summarizePayload(payload);

    var rootContent = payload.files && payload.files[payload.rootFile];
    var rootText = typeof rootContent === "string" ? rootContent : "";
    if (!rootText.trim()) {
      throw new Error(
        "Root file " + payload.rootFile + " is empty before compile. " +
        "The frontend did not find actual LaTeX source content. " +
        "Payload summary: " + JSON.stringify(payload.compileInputSummary)
      );
    }

    return { settings: settings, payload: payload };
  }

  function getAuthHeaders(settings) {
    var headers = { "Content-Type": "application/json" };
    settings = asObject(settings);

    var token =
      settings.luminaProxyToken ||
      settings.proxyToken ||
      settings.compileToken ||
      "";

    if (!token) {
      try {
        token =
          localStorage.getItem("LUMINA_PROXY_TOKEN") ||
          localStorage.getItem("luminaProxyToken") ||
          localStorage.getItem("lumina-latex-proxy-token") ||
          "";
      } catch (_) {}
    }

    if (token) {
      headers.Authorization = "Bearer " + token;
      headers["X-Lumina-Token"] = token;
    }

    return headers;
  }

  function flattenCompileResult(result) {
    result = asObject(result);
    var inner = asObject(result.result);
    var merged = Object.assign({}, result, inner);

    if (inner && Object.keys(inner).length) {
      merged.result = inner;
      if (result.jobId && !merged.jobId) merged.jobId = result.jobId;
      if (result.progress !== undefined && merged.progress === undefined) merged.progress = result.progress;
    }

    merged.ok = !!(merged.ok || merged.success);
    merged.success = !!(merged.success || merged.ok);
    merged.stage = merged.stage || STAGE;
    merged.provider = merged.provider || "frontend-compilerprovider-cloudrun-texlive";
    return merged;
  }

  async function fetchJson(url, options) {
    var response = await fetch(url, options || {});
    var text = await response.text();
    var data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      data = { ok: false, success: false, status: "error", message: text || String(err), rawText: text };
    }

    if (!response.ok) {
      data.ok = false;
      data.success = false;
      data.status = data.status || "error";
      data.httpStatus = response.status;
      data.message = data.message || data.detail || ("HTTP " + response.status);
    }

    return data;
  }

  async function checkAvailability(settings) {
    settings = normalizeSettings(settings || readSettingsFromLocalStorage());
    var raw = null;
    var httpStatus = null;
    var ok = false;

    try {
      var response = await fetch(settings.backendStatusUrl, { method: "GET", cache: "no-store" });
      httpStatus = response.status;
      raw = await response.json();
      ok = !!(response.ok && raw && raw.ok);
    } catch (err) {
      raw = { ok: false, message: String(err) };
    }

    return {
      ok: ok,
      status: ok ? "online" : "offline",
      checkedAt: new Date().toISOString(),
      httpStatus: httpStatus,
      compileUrl: settings.compileUrl,
      jobsUrl: settings.compileStatusUrl,
      statusUrl: settings.backendStatusUrl,
      provider: "cloudrun-texlive-latexmk",
      stage: raw && raw.stage ? raw.stage : STAGE,
      raw: raw,
      message: ok ? "Backend reachable." : ((raw && raw.message) || "Backend not reachable.")
    };
  }

  async function compile(arg0, arg1, arg2) {
    var options = asObject(arg2);
    var built = buildCompileRequest(arg0, arg1, arg2);
    var settings = built.settings;
    var payload = built.payload;

    if (options.onProgress) {
      try {
        options.onProgress({
          status: "running",
          progress: 5,
          message: "Sending compile request to Cloud Run TeX Live backend.",
          compileInputSummary: payload.compileInputSummary
        });
      } catch (_) {}
    }

    console.log("[CompilerProvider] compile request", payload.compileInputSummary);

    var result;

    if (settings.useCompileJobs) {
      var created = await fetchJson(settings.compileStatusUrl, {
        method: "POST",
        headers: getAuthHeaders(settings),
        body: JSON.stringify(payload)
      });

      if (options.onProgress) {
        try {
          options.onProgress({
            status: created.status || "running",
            progress: created.progress || 100,
            jobId: created.jobId || null,
            message: created.message || "Compile job finished."
          });
        } catch (_) {}
      }

      result = flattenCompileResult(created);

      // The current Cloud Run backend completes synchronously inside the job create response.
      // If a future async backend returns only a jobId, poll once as compatibility.
      if (!result.pdfExtracted && !result.log && created.jobId && !created.result) {
        var pollUrl = settings.compileStatusUrl.replace(/\/+$/, "") + "/" + encodeURIComponent(created.jobId);
        var job = await fetchJson(pollUrl, { method: "GET", headers: getAuthHeaders(settings) });
        result = flattenCompileResult(job);
      }
    } else {
      result = await fetchJson(settings.compileUrl, {
        method: "POST",
        headers: getAuthHeaders(settings),
        body: JSON.stringify(payload)
      });
      result = flattenCompileResult(result);
    }

    result.compileInputSummary = result.compileInputSummary || payload.compileInputSummary;
    result.settingsSummary = {
      compilerMode: settings.compilerMode,
      compileUrl: settings.compileUrl,
      compileStatusUrl: settings.compileStatusUrl,
      backendStatusUrl: settings.backendStatusUrl,
      useCompileJobs: settings.useCompileJobs,
      engine: settings.engine
    };

    console.log("[CompilerProvider] compile result", {
      success: result.success,
      status: result.status,
      exitCode: result.exitCode,
      jobId: result.jobId,
      pdfExtracted: result.pdfExtracted,
      pdfBytesLength: result.pdfBytesLength,
      message: result.message
    });

    return result;
  }

  function readSettingsFromLocalStorage() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var raw = localStorage.getItem(key);
        if (!raw) continue;
        var obj;
        try { obj = JSON.parse(raw); } catch (_) { continue; }
        if (
          obj &&
          typeof obj === "object" &&
          (
            obj.schema === "lumina-latex-settings-v1" ||
            "compileUrl" in obj ||
            "compileStatusUrl" in obj ||
            "compilerMode" in obj
          )
        ) {
          return obj;
        }
      }
    } catch (_) {}
    return {};
  }

  function writeSettingsToLocalStorage(settings) {
    settings = normalizeSettings(settings || readSettingsFromLocalStorage());
    var wrote = false;

    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var raw = localStorage.getItem(key);
        if (!raw) continue;
        var obj;
        try { obj = JSON.parse(raw); } catch (_) { continue; }
        if (
          obj &&
          typeof obj === "object" &&
          (
            obj.schema === "lumina-latex-settings-v1" ||
            "compileUrl" in obj ||
            "compileStatusUrl" in obj ||
            "compilerMode" in obj
          )
        ) {
          localStorage.setItem(key, JSON.stringify(Object.assign({}, obj, settings)));
          wrote = true;
        }
      }

      if (!wrote) {
        localStorage.setItem("lumina-latex-settings-v1", JSON.stringify(settings));
      }
    } catch (err) {
      console.warn("[CompilerProvider] Could not persist settings", err);
    }

    return settings;
  }

  var Provider = {
    stage: STAGE,
    provider: "frontend-compilerprovider-cloudrun-texlive",
    BACKEND_BASE: BACKEND_BASE,
    normalizeSettings: normalizeSettings,
    buildCompileRequest: buildCompileRequest,
    summarizePayload: summarizePayload,
    checkAvailability: checkAvailability,
    getAvailability: checkAvailability,
    availability: checkAvailability,
    diagnose: checkAvailability,
    status: checkAvailability,
    compile: compile,
    compileJob: compile,
    runCompile: compile,
    compileProject: compile,
    saveSettings: writeSettingsToLocalStorage
  };

  function namespaceObjects() {
    var names = [
      "LuminaLatex",
      "LuminaLaTeX",
      "Lumina",
      "LatexAI",
      "Latexai",
      "LatexaiApp",
      "LuminaLatexApp",
      "NS"
    ];

    var objects = [];

    names.forEach(function (name) {
      if (!global[name] || typeof global[name] !== "object") global[name] = {};
      objects.push(global[name]);
    });

    // Some builds put everything under window.Lumina.Namespace or window.Lumina.NS.
    try {
      if (global.Lumina) {
        global.Lumina.NS = global.Lumina.NS || global.Lumina;
        objects.push(global.Lumina.NS);
      }
    } catch (_) {}

    return objects;
  }

  namespaceObjects().forEach(function (ns) {
    ns.CompilerProvider = Provider;
    ns.compilerProvider = Provider;
    ns.BackendCompilerProvider = Provider;

    ns.__modules = ns.__modules || {};
    ns.__modules.CompilerProvider = true;

    ns.modules = ns.modules || {};
    ns.modules.CompilerProvider = true;

    if (typeof ns.registerModule === "function") {
      try { ns.registerModule("CompilerProvider", Provider); } catch (_) {}
    }
  });

  writeSettingsToLocalStorage(readSettingsFromLocalStorage());

  global.CompilerProvider = Provider;

  console.info("[CompilerProvider] installed", {
    stage: STAGE,
    compileUrl: normalizeSettings({}).compileUrl,
    compileStatusUrl: normalizeSettings({}).compileStatusUrl,
    backendStatusUrl: normalizeSettings({}).backendStatusUrl
  });
})(typeof window !== "undefined" ? window : globalThis);
