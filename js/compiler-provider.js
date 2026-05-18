/*
 * Lumina / Latexai compiler-provider.js
 * Stage: latex-stage1h-frontend-cloudrun-texlive-hotfix-20260518-1
 *
 * Drop-in frontend hotfix for GitHub Pages + Cloud Run TeX Live backend.
 * - Forces backend-texlive mode.
 * - Persists absolute Cloud Run compile/jobs/status URLs.
 * - Rewrites stale relative /api/lumina/latex/... fetches to Cloud Run.
 * - Builds compile payloads with actual file contents, not metadata-only summaries.
 * - Adds diagnostics: rootLength/rootHead/paths before compile.
 */
(function () {
  "use strict";

  const STAGE = "latex-stage1h-frontend-cloudrun-texlive-hotfix-20260518-1";
  const BACKEND_BASE = "https://lumina-latex-backend-y4piylmfja-ue.a.run.app";
  const COMPILE_URL = `${BACKEND_BASE}/api/lumina/latex/compile`;
  const JOBS_URL = `${BACKEND_BASE}/api/lumina/latex/compile/jobs`;
  const STATUS_URL = `${BACKEND_BASE}/api/lumina/latex/status`;

  function isPlainObject(x) {
    return !!x && typeof x === "object" && !Array.isArray(x);
  }

  function readJsonMaybe(raw) {
    if (!raw || typeof raw !== "string") return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function get(obj, path) {
    let cur = obj;
    for (const part of path) {
      if (!cur || typeof cur !== "object") return undefined;
      cur = cur[part];
    }
    return cur;
  }

  function firstDefined(...values) {
    for (const v of values) {
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  }

  function normalizeLatexCompileSettings(settings) {
    const next = isPlainObject(settings) ? { ...settings } : {};

    next.schema = next.schema || "lumina-latex-settings-v1";
    next.compilerMode = "backend-texlive";
    next.compileUrl = COMPILE_URL;
    next.compileStatusUrl = JOBS_URL;
    next.backendStatusUrl = STATUS_URL;
    next.useCompileJobs = true;
    next.compilePollMs = next.compilePollMs || 1000;
    next.compileTimeoutMs = Math.max(Number(next.compileTimeoutMs || 0), 90000);
    next.engine = next.engine || "pdflatex";
    next.bibliography = next.bibliography || "bibtex";
    next.shellEscape = false;

    return next;
  }

  function patchLocalStorageSettings() {
    let changed = 0;
    const candidates = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const obj = readJsonMaybe(localStorage.getItem(key));
        if (!isPlainObject(obj)) continue;

        const looksLikeSettings =
          obj.schema === "lumina-latex-settings-v1" ||
          Object.prototype.hasOwnProperty.call(obj, "compileUrl") ||
          Object.prototype.hasOwnProperty.call(obj, "compileStatusUrl") ||
          Object.prototype.hasOwnProperty.call(obj, "compilerMode") ||
          key.toLowerCase().includes("latex") ||
          key.toLowerCase().includes("lumina");

        if (looksLikeSettings) candidates.push([key, obj]);
      }

      for (const [key, obj] of candidates) {
        const next = normalizeLatexCompileSettings(obj);
        localStorage.setItem(key, JSON.stringify(next));
        changed++;
      }

      if (changed === 0) {
        localStorage.setItem(
          "lumina-latex-settings-v1",
          JSON.stringify(normalizeLatexCompileSettings({}))
        );
        changed++;
      }
    } catch (err) {
      console.warn(`[${STAGE}] Could not patch localStorage settings:`, err);
    }

    return changed;
  }

  function findCurrentProject() {
    const candidates = [
      window.LuminaLatexProject,
      window.luminaLatexProject,
      window.currentProject,
      window.project,
      get(window, ["LuminaState", "project"]),
      get(window, ["luminaState", "project"]),
      get(window, ["AppState", "project"]),
      get(window, ["appState", "project"]),
      get(window, ["Lumina", "project"]),
      get(window, ["Lumina", "state", "project"]),
      get(window, ["LuminaLatex", "project"]),
      get(window, ["LuminaLatex", "state", "project"]),
      get(window, ["state", "project"]),
    ];

    for (const p of candidates) {
      if (p && typeof p === "object") return p;
    }

    return null;
  }

  function getEditorText() {
    const functionCandidates = [
      get(window, ["getEditorText"]),
      get(window, ["getActiveEditorText"]),
      get(window, ["LuminaEditor", "getText"]),
      get(window, ["LuminaLatexEditor", "getText"]),
      get(window, ["editor", "getValue"]),
      get(window, ["cm", "getValue"]),
      get(window, ["codeMirror", "getValue"]),
    ];

    for (const fn of functionCandidates) {
      if (typeof fn !== "function") continue;
      try {
        const value = fn.call(window.editor || window.cm || window.codeMirror || window);
        if (typeof value === "string") return value;
      } catch {
        // Try next source.
      }
    }

    const selectors = [
      "textarea#editor",
      "textarea#latex-editor",
      "textarea#source-editor",
      "textarea[data-role='latex-editor']",
      "textarea",
      "#editor textarea",
      "#latex-editor textarea",
      "[contenteditable='true']",
      ".cm-content",
      ".CodeMirror-code",
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;

      if (typeof el.value === "string") return el.value;
      if (typeof el.innerText === "string") return el.innerText;
      if (typeof el.textContent === "string") return el.textContent;
    }

    return "";
  }

  function getFileContent(value) {
    if (value === undefined || value === null) return "";

    if (typeof value === "string") return value;

    if (value instanceof Uint8Array) {
      try {
        return new TextDecoder("utf-8").decode(value);
      } catch {
        return "";
      }
    }

    if (isPlainObject(value)) {
      const content = firstDefined(
        value.content,
        value.text,
        value.source,
        value.value,
        value.data,
        value.body,
        value.tex
      );

      if (typeof content === "string") return content;

      // Metadata-only records often look like {path,type,length}; these are not source.
      return "";
    }

    return "";
  }

  function addFilesFromObject(filesOut, rawFiles) {
    if (!isPlainObject(rawFiles)) return;

    for (const [path, value] of Object.entries(rawFiles)) {
      if (!path) continue;
      const content = getFileContent(value);
      if (content !== "") filesOut[path] = content;
    }
  }

  function addFilesFromArray(filesOut, rawFiles) {
    if (!Array.isArray(rawFiles)) return;

    for (const file of rawFiles) {
      if (!isPlainObject(file)) continue;
      const path = file.path || file.name || file.filename || file.fileName;
      if (!path) continue;
      const content = getFileContent(file);
      if (content !== "") filesOut[path] = content;
    }
  }

  function inferRootFile(project, payload) {
    return (
      payload?.rootFile ||
      payload?.mainFile ||
      payload?.main ||
      payload?.activePath ||
      project?.rootFile ||
      project?.mainFile ||
      project?.main ||
      project?.activePath ||
      "main.tex"
    );
  }

  function collectProjectFiles(project, payload) {
    const files = {};

    // Payload files first.
    if (isPlainObject(payload?.files)) addFilesFromObject(files, payload.files);
    if (Array.isArray(payload?.files)) addFilesFromArray(files, payload.files);

    if (isPlainObject(payload?.additionalFiles)) addFilesFromObject(files, payload.additionalFiles);
    if (Array.isArray(payload?.additionalFiles)) addFilesFromArray(files, payload.additionalFiles);

    // Common single-source fields.
    const rootFile = inferRootFile(project, payload);
    const singleSource = firstDefined(
      payload?.tex,
      payload?.source,
      payload?.input,
      payload?.mainTex,
      payload?.content
    );
    if (typeof singleSource === "string" && singleSource.trim()) {
      files[rootFile] = singleSource;
    }

    // Project files next. These fill gaps and rescue metadata-only payloads.
    if (isPlainObject(project?.files)) addFilesFromObject(files, project.files);
    if (Array.isArray(project?.files)) addFilesFromArray(files, project.files);

    if (isPlainObject(project?.additionalFiles)) addFilesFromObject(files, project.additionalFiles);
    if (Array.isArray(project?.additionalFiles)) addFilesFromArray(files, project.additionalFiles);

    // Try common nested stores.
    const nestedStores = [
      project?.project?.files,
      project?.data?.files,
      project?.state?.files,
      get(window, ["LuminaState", "files"]),
      get(window, ["luminaState", "files"]),
      get(window, ["AppState", "files"]),
      get(window, ["appState", "files"]),
      get(window, ["state", "files"]),
    ];

    for (const store of nestedStores) {
      if (isPlainObject(store)) addFilesFromObject(files, store);
      if (Array.isArray(store)) addFilesFromArray(files, store);
    }

    // Active editor text is authoritative for the active file.
    const editorText = getEditorText();
    const activePath = payload?.activePath || project?.activePath || rootFile;
    if (typeof editorText === "string" && editorText.trim()) {
      files[activePath] = editorText;
      if (!files[rootFile] && activePath === rootFile) files[rootFile] = editorText;
    }

    return files;
  }

  function summarizeCompilePayload(payload) {
    const rootFile = payload.rootFile || payload.mainFile || payload.main || "main.tex";
    const files = payload.files || {};
    const root = getFileContent(files[rootFile]);
    const paths = isPlainObject(files) ? Object.keys(files) : [];

    return {
      stage: STAGE,
      rootFile,
      fileCount: paths.length,
      paths,
      rootLength: root.length,
      rootHead: root.slice(0, 500),
      hasDocumentClass: /\\documentclass/.test(root),
      hasBeginDocument: /\\begin\{document\}/.test(root),
      hasEndDocument: /\\end\{document\}/.test(root),
    };
  }

  function buildLatexCompileRequest(projectArg, settingsArg, payloadArg) {
    const project = projectArg || findCurrentProject() || {};
    const settings = normalizeLatexCompileSettings(settingsArg || {});
    const payload = isPlainObject(payloadArg) ? { ...payloadArg } : {};
    const rootFile = inferRootFile(project, payload);
    const files = collectProjectFiles(project, payload);

    // If root is still empty but we have exactly one tex file, use it as root.
    if (!getFileContent(files[rootFile]).trim()) {
      const texPaths = Object.keys(files).filter((p) => /\.tex$/i.test(p));
      if (texPaths.length === 1) {
        files[rootFile] = files[texPaths[0]];
      }
    }

    const rootContent = getFileContent(files[rootFile]);
    if (!rootContent.trim()) {
      const paths = Object.keys(files);
      throw new Error(
        `Root file ${rootFile} is empty before compile. ` +
          `Frontend must send actual LaTeX source, not only metadata. ` +
          `Collected paths: ${paths.join(", ") || "none"}`
      );
    }

    const request = {
      schema: "lumina-latex-compile-request-v1",
      rootFile,
      mainFile: rootFile,
      activePath: payload.activePath || project.activePath || rootFile,
      engine: payload.engine || settings.engine || "pdflatex",
      bibliography: payload.bibliography || settings.bibliography || "bibtex",
      shellEscape: false,
      rerun: payload.rerun !== false,
      files,
    };

    request.compileInputSummary = summarizeCompilePayload(request);
    return request;
  }

  function normalizeCompileResult(result) {
    const next = isPlainObject(result) ? { ...result } : { success: false, ok: false, message: "Invalid compile result" };

    next.ok = Boolean(next.ok || next.success);
    next.success = Boolean(next.success || next.ok);

    const pdfBase64 = next.pdfBase64 || next.pdfBytesBase64 || null;
    if (pdfBase64 && !next.pdf) {
      next.pdf = `data:application/pdf;base64,${pdfBase64}`;
    }

    if (next.pdf && typeof next.pdf === "string" && next.pdf.startsWith("data:application/pdf;base64,")) {
      next.pdfExtracted = true;
      next.pdfBase64 = next.pdfBase64 || next.pdf.split(",", 2)[1];
    }

    return next;
  }

  async function fetchJson(url, init) {
    const response = await fetch(url, init);
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 1000)}`);
    }

    if (!response.ok) {
      const msg = data?.detail || data?.message || response.statusText || `HTTP ${response.status}`;
      const e = new Error(msg);
      e.response = response;
      e.data = data;
      throw e;
    }

    return data;
  }

  async function checkCompileBackendAvailability(settingsArg) {
    const settings = normalizeLatexCompileSettings(settingsArg || {});
    try {
      const raw = await fetchJson(settings.backendStatusUrl || STATUS_URL, { method: "GET" });
      return {
        ok: Boolean(raw.ok),
        status: raw.ok ? "online" : "unavailable",
        checkedAt: new Date().toISOString(),
        httpStatus: 200,
        availability: {
          compileUrl: settings.compileUrl,
          jobsUrl: settings.compileStatusUrl,
          statusUrl: settings.backendStatusUrl,
          defaultRelativeCompileUrl: false,
          staticDraftFallbackActive: false,
        },
        ...raw,
        raw,
      };
    } catch (err) {
      return {
        ok: false,
        status: "offline",
        checkedAt: new Date().toISOString(),
        message: err.message || String(err),
        availability: {
          compileUrl: settings.compileUrl,
          jobsUrl: settings.compileStatusUrl,
          statusUrl: settings.backendStatusUrl,
        },
      };
    }
  }

  async function runBackendLatexCompile(projectArg, settingsArg, payloadArg) {
    const settings = normalizeLatexCompileSettings(settingsArg || {});
    const body = buildLatexCompileRequest(projectArg, settings, payloadArg);

    console.info(`[${STAGE}] compile request`, body.compileInputSummary);

    const result = await fetchJson(settings.compileUrl || COMPILE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const normalized = normalizeCompileResult(result);
    console.info(`[${STAGE}] compile result`, {
      success: normalized.success,
      status: normalized.status,
      exitCode: normalized.exitCode,
      pdfExtracted: normalized.pdfExtracted,
      pdfBytesLength: normalized.pdfBytesLength,
      message: normalized.message,
    });
    return normalized;
  }

  async function runBackendLatexCompileJob(projectArg, settingsArg, payloadArg) {
    const settings = normalizeLatexCompileSettings(settingsArg || {});
    const body = buildLatexCompileRequest(projectArg, settings, payloadArg);

    console.info(`[${STAGE}] compile job request`, body.compileInputSummary);

    const created = await fetchJson(settings.compileStatusUrl || JOBS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = normalizeCompileResult(created.result || created);
    return result;
  }

  async function compileLatexProject(projectArg, settingsArg, payloadArg) {
    const settings = normalizeLatexCompileSettings(settingsArg || {});
    if (settings.useCompileJobs) {
      return runBackendLatexCompileJob(projectArg, settings, payloadArg);
    }
    return runBackendLatexCompile(projectArg, settings, payloadArg);
  }

  function rewriteLatexBackendUrl(url) {
    if (typeof url !== "string") return url;

    // Relative or stale GitHub Pages API paths.
    if (url === "/api/lumina/latex/compile" || /\/api\/lumina\/latex\/compile$/.test(url)) {
      return COMPILE_URL;
    }
    if (url === "/api/lumina/latex/compile/jobs" || /\/api\/lumina\/latex\/compile\/jobs$/.test(url)) {
      return JOBS_URL;
    }
    if (url === "/api/lumina/latex/status" || /\/api\/lumina\/latex\/status$/.test(url)) {
      return STATUS_URL;
    }

    return url;
  }

  function maybePatchCompileRequestBody(url, init) {
    const rewrittenUrl = rewriteLatexBackendUrl(url);
    const isCompilePost =
      init &&
      String(init.method || "GET").toUpperCase() === "POST" &&
      (rewrittenUrl === COMPILE_URL || rewrittenUrl === JOBS_URL);

    if (!isCompilePost || !init.body || typeof init.body !== "string") {
      return init;
    }

    const parsed = readJsonMaybe(init.body);
    if (!isPlainObject(parsed)) return init;

    try {
      const project = findCurrentProject() || {};
      const settings = normalizeLatexCompileSettings({});
      const patched = buildLatexCompileRequest(project, settings, parsed);
      return {
        ...init,
        headers: { ...(init.headers || {}), "Content-Type": "application/json" },
        body: JSON.stringify(patched),
      };
    } catch (err) {
      console.warn(`[${STAGE}] Could not patch compile request body:`, err);
      return init;
    }
  }

  function installFetchRewrite() {
    if (window.__luminaLatexCloudrunFetchRewriteInstalled) return;
    if (typeof window.fetch !== "function") return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = function patchedLuminaFetch(input, init) {
      let url = input;
      let nextInput = input;
      let nextInit = init ? { ...init } : init;

      if (typeof input === "string") {
        url = input;
        const rewritten = rewriteLatexBackendUrl(input);
        if (rewritten !== input) {
          nextInput = rewritten;
          nextInit = maybePatchCompileRequestBody(rewritten, nextInit || {});
        }
      } else if (input && typeof input.url === "string") {
        url = input.url;
        const rewritten = rewriteLatexBackendUrl(input.url);
        if (rewritten !== input.url) {
          nextInput = rewritten;
          nextInit = maybePatchCompileRequestBody(rewritten, nextInit || {});
        }
      }

      return originalFetch(nextInput, nextInit);
    };

    window.__luminaLatexCloudrunFetchRewriteInstalled = true;
  }

  class CompilerProvider {
    constructor(settings) {
      this.settings = normalizeLatexCompileSettings(settings || {});
      this.stage = STAGE;
      this.provider = "backend-texlive";
    }

    normalizeSettings(settings) {
      this.settings = normalizeLatexCompileSettings(settings || this.settings || {});
      return this.settings;
    }

    async checkAvailability(settings) {
      return checkCompileBackendAvailability(settings || this.settings);
    }

    async compile(project, options) {
      return compileLatexProject(project || findCurrentProject(), this.settings, options || {});
    }

    async compileJob(project, options) {
      return runBackendLatexCompileJob(project || findCurrentProject(), this.settings, options || {});
    }

    buildRequest(project, options) {
      return buildLatexCompileRequest(project || findCurrentProject(), this.settings, options || {});
    }
  }

  function createCompilerProvider(settings) {
    return new CompilerProvider(settings);
  }

  function install() {
    const patchedSettingsCount = patchLocalStorageSettings();
    installFetchRewrite();

    console.info(`[${STAGE}] installed`, {
      backendBase: BACKEND_BASE,
      compileUrl: COMPILE_URL,
      jobsUrl: JOBS_URL,
      statusUrl: STATUS_URL,
      patchedSettingsCount,
    });
  }

  const api = {
    STAGE,
    BACKEND_BASE,
    COMPILE_URL,
    JOBS_URL,
    STATUS_URL,
    CompilerProvider,
    createCompilerProvider,
    normalizeLatexCompileSettings,
    patchLocalStorageSettings,
    buildLatexCompileRequest,
    summarizeCompilePayload,
    checkCompileBackendAvailability,
    runBackendLatexCompile,
    runBackendLatexCompileJob,
    compileLatexProject,
    installFetchRewrite,
    install,
  };

  // Global compatibility names used across earlier Latexai stages.
  window.LuminaLatexCompilerProvider = api;
  window.LuminaCompilerProvider = api;
  window.luminaCompilerProvider = api;
  window.CompilerProvider = window.CompilerProvider || CompilerProvider;
  window.createCompilerProvider = window.createCompilerProvider || createCompilerProvider;
  window.normalizeLatexCompileSettings = normalizeLatexCompileSettings;
  window.buildLatexCompileRequest = buildLatexCompileRequest;
  window.summarizeCompilePayload = summarizeCompilePayload;
  window.checkCompileBackendAvailability = checkCompileBackendAvailability;
  window.runBackendLatexCompile = runBackendLatexCompile;
  window.runBackendLatexCompileJob = runBackendLatexCompileJob;
  window.compileLatexProject = compileLatexProject;

  install();
})();
