/* Latexai Step 3 Storage Provider - GitHub sync foundation
 * Stage: latex-stage3-github-sync-foundation-20260518-1
 *
 * Drop this file at: js/lai-storage-provider-preload.js
 *
 * Features:
 * - Browser localStorage autosave works on iPad Safari.
 * - Native folder sync is enabled only when showDirectoryPicker is available.
 * - Exposes applyProject/discoverProject for GitHub sync UI.
 */
(function () {
  "use strict";

  var STAGE = "latex-stage3-github-sync-foundation-20260518-1";
  var AUTOSAVE_KEY = "latexai.step3.autosave.project.v1";
  var STATUS_KEY = "latexai.step3.storage.status.v1";
  var SETTINGS_KEY = "latexai.step3.storage.settings.v1";

  var root = typeof window !== "undefined" ? window : globalThis;
  root.LuminaLatex = root.LuminaLatex || {};
  root.NS = root.NS || root.LuminaLatex;

  var state = {
    mode: "localStorage",
    autosave: true,
    autosaveMs: 2500,
    lastSavedAt: null,
    lastLoadedAt: null,
    lastError: null,
    folderHandle: null,
    nativeFolderSupported: !!root.showDirectoryPicker,
    githubSupported: true,
    dirty: false,
    timer: null,
    filesKnown: {},
    rootFile: "main.tex",
    activePath: "main.tex"
  };

  function nowIso() { return new Date().toISOString(); }

  function safeJsonParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function saveStatus() {
    try {
      localStorage.setItem(STATUS_KEY, JSON.stringify({
        stage: STAGE,
        mode: state.mode,
        autosave: state.autosave,
        autosaveMs: state.autosaveMs,
        lastSavedAt: state.lastSavedAt,
        lastLoadedAt: state.lastLoadedAt,
        lastError: state.lastError,
        nativeFolderSupported: state.nativeFolderSupported,
        githubSupported: state.githubSupported,
        rootFile: state.rootFile,
        activePath: state.activePath
      }));
    } catch (_) {}
  }

  function loadSettings() {
    var s = safeJsonParse(localStorage.getItem(SETTINGS_KEY), {});
    if (s && typeof s === "object") {
      if (s.mode) state.mode = s.mode;
      if (typeof s.autosave === "boolean") state.autosave = s.autosave;
      if (Number.isFinite(Number(s.autosaveMs))) state.autosaveMs = Math.max(1000, Number(s.autosaveMs));
    }
  }

  function persistSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        stage: STAGE,
        mode: state.mode,
        autosave: state.autosave,
        autosaveMs: state.autosaveMs
      }));
    } catch (_) {}
  }

  function getTextAreaCandidate() {
    var active = document.activeElement;
    if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) return active;

    var selectors = [
      "#sourceEditor",
      "#editor textarea",
      "#latex-editor textarea",
      "#source-editor textarea",
      "textarea[data-latex-editor]",
      "textarea"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && typeof el.value === "string") return el;
    }
    return null;
  }

  function getEditorText() {
    try {
      if (typeof root.getEditorText === "function") return String(root.getEditorText());
      if (root.EditorProvider && typeof root.EditorProvider.getText === "function") return String(root.EditorProvider.getText());
      if (root.NS && root.NS.EditorProvider && typeof root.NS.EditorProvider.getText === "function") return String(root.NS.EditorProvider.getText());
      if (root.LuminaLatex && root.LuminaLatex.EditorProvider && typeof root.LuminaLatex.EditorProvider.getText === "function") {
        return String(root.LuminaLatex.EditorProvider.getText());
      }
      var ta = getTextAreaCandidate();
      if (ta) return String(ta.value || "");
    } catch (err) {
      state.lastError = "getEditorText failed: " + (err && err.message ? err.message : String(err));
    }
    return "";
  }

  function setEditorText(text) {
    text = String(text || "");
    try {
      if (typeof root.setEditorText === "function") {
        root.setEditorText(text);
        return true;
      }
      if (root.EditorProvider && typeof root.EditorProvider.setText === "function") {
        root.EditorProvider.setText(text);
        return true;
      }
      if (root.NS && root.NS.EditorProvider && typeof root.NS.EditorProvider.setText === "function") {
        root.NS.EditorProvider.setText(text);
        return true;
      }
      if (root.LuminaLatex && root.LuminaLatex.EditorProvider && typeof root.LuminaLatex.EditorProvider.setText === "function") {
        root.LuminaLatex.EditorProvider.setText(text);
        return true;
      }
      var ta = getTextAreaCandidate();
      if (ta) {
        ta.value = text;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        ta.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    } catch (err) {
      state.lastError = "setEditorText failed: " + (err && err.message ? err.message : String(err));
    }
    return false;
  }

  function normalizeFilesObject(files) {
    var out = {};
    if (!files) return out;

    if (Array.isArray(files)) {
      files.forEach(function (f) {
        if (!f || typeof f !== "object") return;
        var path = f.path || f.name || f.filename;
        if (!path) return;
        var content = "";
        if (typeof f.content === "string") content = f.content;
        else if (typeof f.text === "string") content = f.text;
        else if (typeof f.source === "string") content = f.source;
        else if (typeof f.value === "string") content = f.value;
        else if (typeof f.data === "string") content = f.data;
        out[path] = content;
      });
      return out;
    }

    if (typeof files === "object") {
      Object.keys(files).forEach(function (path) {
        var v = files[path];
        if (typeof v === "string") out[path] = v;
        else if (v && typeof v === "object") {
          if (typeof v.content === "string") out[path] = v.content;
          else if (typeof v.text === "string") out[path] = v.text;
          else if (typeof v.source === "string") out[path] = v.source;
          else if (typeof v.value === "string") out[path] = v.value;
          else if (typeof v.data === "string") out[path] = v.data;
        }
      });
    }
    return out;
  }

  function discoverProject() {
    var candidates = [
      root.currentProject,
      root.project,
      root.LuminaLatex && root.LuminaLatex.project,
      root.LuminaLatex && root.LuminaLatex.currentProject,
      root.NS && root.NS.project,
      root.NS && root.NS.currentProject,
      root.AppState && root.AppState.project,
      root.LatexaiProject
    ].filter(Boolean);

    var project = candidates[0] || {};
    var rootFile = project.rootFile || project.mainFile || project.activePath || state.rootFile || "main.tex";
    var activePath = project.activePath || rootFile;
    var files = normalizeFilesObject(project.files);

    var editorText = getEditorText();
    if (editorText && editorText.trim()) {
      files[activePath] = editorText;
    }

    if (!files[rootFile] && files[activePath]) {
      files[rootFile] = files[activePath];
    }

    if (!Object.keys(files).length && editorText) {
      files[rootFile] = editorText;
    }

    state.rootFile = rootFile;
    state.activePath = activePath;
    state.filesKnown = Object.assign({}, state.filesKnown, files);

    return {
      schema: "lumina-latex-project-v1",
      storageStage: STAGE,
      name: project.name || project.projectName || "Project",
      projectId: project.projectId || project.id || null,
      rootFile: rootFile,
      activePath: activePath,
      files: Object.assign({}, state.filesKnown, files),
      savedAt: nowIso()
    };
  }

  function applyProject(project) {
    if (!project || typeof project !== "object") return false;
    var files = normalizeFilesObject(project.files);
    var rootFile = project.rootFile || project.mainFile || project.activePath || "main.tex";
    var activePath = project.activePath || rootFile;
    var text = files[activePath] || files[rootFile] || "";

    state.rootFile = rootFile;
    state.activePath = activePath;
    state.filesKnown = files;

    var ok = false;
    if (text) ok = setEditorText(text);

    try {
      if (root.LuminaLatex) root.LuminaLatex.storageProject = project;
      if (root.NS) root.NS.storageProject = project;
      // Some app builds discover global project fields; set cautiously.
      root.currentProject = Object.assign({}, root.currentProject || {}, {
        name: project.name,
        projectId: project.projectId,
        rootFile: rootFile,
        activePath: activePath,
        files: files
      });
    } catch (_) {}

    emit("latexai:storage-project-applied", { project: project, applied: ok });
    return ok;
  }

  async function saveLocalStorage() {
    var project = discoverProject();
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
      state.lastSavedAt = nowIso();
      state.lastError = null;
      state.dirty = false;
      saveStatus();
      emit("latexai:storage-saved", { mode: "localStorage", project: project });
      return { ok: true, mode: "localStorage", project: project, savedAt: state.lastSavedAt };
    } catch (err) {
      state.lastError = "Browser autosave skipped because storage quota was exceeded. Use Save GitHub/Checkpoint for durable storage.";
      saveStatus();
      emit("latexai:storage-save-skipped", { mode: "localStorage", error: state.lastError });
      return { ok: false, mode: "localStorage", project: project, message: state.lastError };
    }
  }

  async function loadLocalStorage() {
    var project = safeJsonParse(localStorage.getItem(AUTOSAVE_KEY), null);
    if (!project) return { ok: false, message: "No browser autosave found." };
    var applied = applyProject(project);
    state.lastLoadedAt = nowIso();
    saveStatus();
    emit("latexai:storage-loaded", { mode: "localStorage", project: project, applied: applied });
    return { ok: true, mode: "localStorage", project: project, applied: applied };
  }

  async function readFileHandle(fileHandle) {
    var file = await fileHandle.getFile();
    var lower = file.name.toLowerCase();
    var textLike = /\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst)$/.test(lower);
    if (textLike) return await file.text();
    var buf = await file.arrayBuffer();
    var bytes = new Uint8Array(buf);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return "data:" + (file.type || "application/octet-stream") + ";base64," + btoa(binary);
  }

  async function walkDirectory(dirHandle, prefix, out) {
    prefix = prefix || "";
    out = out || {};
    for await (var entry of dirHandle.values()) {
      var path = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.kind === "file") {
        if (/\.(tex|bib|sty|cls|md|txt|tikz|cfg|def|bst|png|jpg|jpeg|pdf|svg)$/i.test(entry.name)) {
          out[path] = await readFileHandle(entry);
        }
      } else if (entry.kind === "directory") {
        if (!/^(\.git|node_modules|dist|build|_minted)/.test(entry.name)) {
          await walkDirectory(entry, path, out);
        }
      }
    }
    return out;
  }

  async function openNativeFolder() {
    if (!root.showDirectoryPicker) {
      state.lastError = "Native folder sync is unavailable in this browser.";
      saveStatus();
      return { ok: false, unavailable: true, message: state.lastError };
    }

    var dir = await root.showDirectoryPicker({ mode: "readwrite" });
    state.folderHandle = dir;
    state.mode = "nativeFolder";
    persistSettings();

    var files = await walkDirectory(dir, "", {});
    var rootFile = files["main.tex"] ? "main.tex" : (Object.keys(files).find(function (p) { return /\.tex$/i.test(p); }) || "main.tex");

    var project = {
      schema: "lumina-latex-project-v1",
      storageStage: STAGE,
      name: dir.name || "Local Folder Project",
      rootFile: rootFile,
      activePath: rootFile,
      files: files,
      loadedAt: nowIso()
    };

    applyProject(project);
    await saveLocalStorage();
    state.lastLoadedAt = nowIso();
    saveStatus();
    emit("latexai:storage-folder-opened", { project: project });
    return { ok: true, mode: "nativeFolder", project: project };
  }

  async function writeNativeFolderFile(dirHandle, relPath, content) {
    var parts = relPath.split("/").filter(Boolean);
    var filename = parts.pop();
    var current = dirHandle;
    for (var i = 0; i < parts.length; i++) current = await current.getDirectoryHandle(parts[i], { create: true });
    var fileHandle = await current.getFileHandle(filename, { create: true });
    var writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async function saveNativeFolder() {
    if (!state.folderHandle) return { ok: false, message: "No native folder is open." };
    var project = discoverProject();
    var files = normalizeFilesObject(project.files);
    for (var path in files) {
      if (!Object.prototype.hasOwnProperty.call(files, path)) continue;
      if (files[path].startsWith && files[path].startsWith("data:")) continue;
      await writeNativeFolderFile(state.folderHandle, path, files[path]);
    }
    await saveLocalStorage();
    state.lastSavedAt = nowIso();
    state.lastError = null;
    state.dirty = false;
    saveStatus();
    emit("latexai:storage-saved", { mode: "nativeFolder", project: project });
    return { ok: true, mode: "nativeFolder", project: project, savedAt: state.lastSavedAt };
  }

  async function saveNow() {
    try {
      if (state.mode === "nativeFolder" && state.folderHandle) return await saveNativeFolder();
      return await saveLocalStorage();
    } catch (err) {
      state.lastError = err && err.message ? err.message : String(err);
      saveStatus();
      return { ok: false, message: state.lastError };
    }
  }

  function markDirty() {
    state.dirty = true;
    emit("latexai:storage-dirty", getStatus());
  }

  function startAutosave() {
    stopAutosave();
    state.timer = setInterval(function () {
      if (!state.autosave) return;
      var txt = getEditorText();
      if (txt && txt !== state.filesKnown[state.activePath]) {
        state.filesKnown[state.activePath] = txt;
        state.dirty = true;
      }
      if (state.dirty) saveNow();
    }, state.autosaveMs);
    return true;
  }

  function stopAutosave() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function setMode(mode) {
    if (!mode) return getStatus();
    if (mode === "nativeFolder" && !state.nativeFolderSupported) {
      state.lastError = "Native folder sync is not supported by this browser.";
      saveStatus();
      return getStatus();
    }
    state.mode = mode;
    persistSettings();
    saveStatus();
    return getStatus();
  }

  function setAutosave(on) {
    state.autosave = !!on;
    persistSettings();
    saveStatus();
    return getStatus();
  }

  function getStatus() {
    return {
      stage: STAGE,
      mode: state.mode,
      autosave: state.autosave,
      autosaveMs: state.autosaveMs,
      dirty: state.dirty,
      lastSavedAt: state.lastSavedAt,
      lastLoadedAt: state.lastLoadedAt,
      lastError: state.lastError,
      nativeFolderSupported: state.nativeFolderSupported,
      githubSupported: state.githubSupported,
      rootFile: state.rootFile,
      activePath: state.activePath,
      knownFileCount: Object.keys(state.filesKnown || {}).length
    };
  }

  function diagnostics() {
    var p = discoverProject();
    return {
      ok: true,
      stage: STAGE,
      status: getStatus(),
      projectSummary: {
        name: p.name,
        rootFile: p.rootFile,
        activePath: p.activePath,
        fileCount: Object.keys(p.files || {}).length,
        paths: Object.keys(p.files || {}),
        rootLength: (p.files && p.files[p.rootFile] || "").length,
        rootHead: (p.files && p.files[p.rootFile] || "").slice(0, 300)
      }
    };
  }

  function emit(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (_) {}
  }

  var api = {
    STAGE: STAGE,
    getStatus: getStatus,
    diagnostics: diagnostics,
    saveNow: saveNow,
    loadAutosave: loadLocalStorage,
    openNativeFolder: openNativeFolder,
    setMode: setMode,
    setAutosave: setAutosave,
    startAutosave: startAutosave,
    stopAutosave: stopAutosave,
    discoverProject: discoverProject,
    applyProject: applyProject,
    markDirty: markDirty
  };

  loadSettings();
  saveStatus();

  root.LAI_STORAGE = api;
  root.LuminaLatex.StorageProvider = api;
  root.NS.StorageProvider = api;

  document.addEventListener("input", function (ev) {
    var t = ev && ev.target;
    if (t && (t.tagName === "TEXTAREA" || (t.matches && t.matches("[contenteditable=true]")))) markDirty();
  }, true);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startAutosave, { once: true });
  else startAutosave();

  console.log("[Latexai Storage]", STAGE, getStatus());
})();
