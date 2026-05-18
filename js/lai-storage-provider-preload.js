/*
 * Latexai Step 2 storage provider preload.
 * Stage: latex-stage2a-storage-foundation-20260518-1
 *
 * Adds a storage abstraction for Latexai projects:
 *   - localStorage autosave: always available
 *   - native folder sync: available when showDirectoryPicker is supported
 *   - GitHub sync placeholder: capability advertised as unavailable until Step 3 backend
 *
 * This is intentionally an additive preload. It registers itself under several namespaces
 * and re-attaches if the app replaces window.NS during boot.
 */
(function () {
  'use strict';

  var STAGE = 'latex-stage2a-storage-foundation-20260518-1';
  var ROOT = typeof window !== 'undefined' ? window : globalThis;
  var LS_PROJECT_KEY = 'lumina-latex-active-project-v1';
  var LS_STORAGE_SETTINGS_KEY = 'lumina-latex-storage-settings-v1';
  var LS_AUTOSAVE_KEY = 'lumina-latex-storage-autosave-v1';
  var HANDLE_DB = 'lumina-latex-file-handles-v1';
  var HANDLE_STORE = 'handles';
  var HANDLE_KEY = 'active-directory';

  var TEXT_EXTENSIONS = {
    '.tex': true, '.bib': true, '.sty': true, '.cls': true, '.bst': true,
    '.bbx': true, '.cbx': true, '.txt': true, '.md': true, '.json': true,
    '.tikz': true, '.pgf': true, '.def': true, '.cfg': true, '.toc': true,
    '.aux': true, '.bbl': true
  };
  var ASSET_EXTENSIONS = {
    '.png': true, '.jpg': true, '.jpeg': true, '.pdf': true, '.svg': true,
    '.eps': true, '.gif': true, '.webp': true
  };
  var SKIP_DIRS = {
    '.git': true, 'node_modules': true, '.DS_Store': true,
    '__pycache__': true, '.latexai-cache': true
  };

  var state = {
    mode: 'localStorage',
    folderHandle: null,
    fileHandles: {},
    project: null,
    dirty: false,
    lastSavedAt: null,
    lastLoadedAt: null,
    lastError: null,
    autosaveTimer: null,
    autosaveMs: 1500,
    installed: false,
    statusMessage: 'Storage provider loaded.'
  };

  function nowIso() {
    try { return new Date().toISOString(); } catch (_) { return String(Date.now()); }
  }

  function log() {
    if (!ROOT.console || !ROOT.console.log) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Latexai Storage]');
    ROOT.console.log.apply(ROOT.console, args);
  }

  function warn() {
    if (!ROOT.console || !ROOT.console.warn) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Latexai Storage]');
    ROOT.console.warn.apply(ROOT.console, args);
  }

  function emit(name, detail) {
    try {
      if (typeof ROOT.CustomEvent === 'function' && ROOT.dispatchEvent) {
        ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
      }
    } catch (_) {}
  }

  function safeJsonParse(raw, fallback) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function getLocalStorage() {
    try {
      if (ROOT.localStorage) return ROOT.localStorage;
    } catch (_) {}
    return null;
  }

  function readLs(key, fallback) {
    var ls = getLocalStorage();
    if (!ls) return fallback;
    return safeJsonParse(ls.getItem(key), fallback);
  }

  function writeLs(key, value) {
    var ls = getLocalStorage();
    if (!ls) return false;
    try {
      ls.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      state.lastError = String(err && err.message || err);
      return false;
    }
  }

  function normalizePath(path) {
    return String(path || '').replace(/\\+/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  }

  function extname(path) {
    var clean = normalizePath(path).toLowerCase();
    var i = clean.lastIndexOf('.');
    return i >= 0 ? clean.slice(i) : '';
  }

  function isProjectFile(path) {
    var clean = normalizePath(path);
    if (!clean) return false;
    var parts = clean.split('/');
    for (var i = 0; i < parts.length; i++) {
      if (SKIP_DIRS[parts[i]]) return false;
    }
    var ext = extname(clean);
    return !!(TEXT_EXTENSIONS[ext] || ASSET_EXTENSIONS[ext]);
  }

  function isTextFile(path) {
    return !!TEXT_EXTENSIONS[extname(path)];
  }

  function valueToContent(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    if (typeof value.content === 'string') return value.content;
    if (typeof value.text === 'string') return value.text;
    if (typeof value.source === 'string') return value.source;
    if (typeof value.value === 'string') return value.value;
    if (typeof value.data === 'string') return value.data;
    if (typeof value.contentBase64 === 'string') return value.contentBase64;
    return '';
  }

  function isBinaryFileValue(value) {
    return !!(value && typeof value === 'object' && (value.encoding === 'base64' || value.contentBase64 || value.dataBase64 || value.base64));
  }

  function normalizeProject(project) {
    project = project && typeof project === 'object' ? project : {};
    var rootFile = project.rootFile || project.mainFile || project.activePath || 'main.tex';
    var activePath = project.activePath || rootFile;
    var files = {};

    if (project.files && !Array.isArray(project.files)) {
      Object.keys(project.files).forEach(function (path) {
        if (!path) return;
        var clean = normalizePath(path);
        var value = project.files[path];
        if (isBinaryFileValue(value)) {
          files[clean] = value;
        } else {
          files[clean] = valueToContent(value);
        }
      });
    }

    if (Array.isArray(project.files)) {
      project.files.forEach(function (file) {
        if (!file || typeof file !== 'object') return;
        var path = file.path || file.name || file.filename;
        if (!path) return;
        var clean = normalizePath(path);
        if (isBinaryFileValue(file)) {
          files[clean] = file;
        } else {
          files[clean] = valueToContent(file);
        }
      });
    }

    if (!files[rootFile] && typeof project.source === 'string') {
      files[rootFile] = project.source;
    }

    return Object.assign({}, project, {
      schema: project.schema || 'lumina-latex-project-v1',
      projectId: project.projectId || ('project-' + Math.random().toString(36).slice(2)),
      name: project.name || 'Untitled Lumina LaTeX Project',
      rootFile: normalizePath(rootFile),
      activePath: normalizePath(activePath),
      files: files,
      updatedAt: nowIso()
    });
  }

  function getEditorText() {
    try {
      if (ROOT.NS && ROOT.NS.EditorProvider && typeof ROOT.NS.EditorProvider.getValue === 'function') {
        var v = ROOT.NS.EditorProvider.getValue();
        if (typeof v === 'string') return v;
      }
    } catch (_) {}

    try {
      if (ROOT.LuminaLatex && ROOT.LuminaLatex.EditorProvider && typeof ROOT.LuminaLatex.EditorProvider.getValue === 'function') {
        var v2 = ROOT.LuminaLatex.EditorProvider.getValue();
        if (typeof v2 === 'string') return v2;
      }
    } catch (_) {}

    try {
      var doc = ROOT.document;
      if (!doc || !doc.querySelector) return null;
      var el = doc.querySelector('#sourceEditor, #latexEditor, #editor, textarea[data-lumina-editor], textarea');
      if (el && typeof el.value === 'string') return el.value;
    } catch (_) {}

    return null;
  }

  function getActiveProjectFromGlobals() {
    var candidates = [];
    try { candidates.push(ROOT.NS && ROOT.NS.project); } catch (_) {}
    try { candidates.push(ROOT.NS && ROOT.NS.Project); } catch (_) {}
    try { candidates.push(ROOT.NS && ROOT.NS.AppState && ROOT.NS.AppState.project); } catch (_) {}
    try { candidates.push(ROOT.LuminaLatex && ROOT.LuminaLatex.project); } catch (_) {}
    try { candidates.push(ROOT.LuminaLatex && ROOT.LuminaLatex.Project); } catch (_) {}
    try { candidates.push(ROOT.LuminaLatex && ROOT.LuminaLatex.AppState && ROOT.LuminaLatex.AppState.project); } catch (_) {}
    try { candidates.push(ROOT.luminaLatexProject); } catch (_) {}

    for (var i = 0; i < candidates.length; i++) {
      var p = candidates[i];
      if (p && typeof p === 'object' && (p.rootFile || p.files || p.activePath)) {
        return p;
      }
    }

    var lsProject = readLs(LS_PROJECT_KEY, null);
    if (lsProject && typeof lsProject === 'object') return lsProject;

    var ls = getLocalStorage();
    if (ls) {
      try {
        for (var j = 0; j < ls.length; j++) {
          var key = ls.key(j);
          if (!key || !/lumina|latex|project/i.test(key)) continue;
          var obj = safeJsonParse(ls.getItem(key), null);
          if (obj && typeof obj === 'object' && (obj.rootFile || obj.files || obj.activePath)) return obj;
        }
      } catch (_) {}
    }

    return null;
  }

  function getActiveProject() {
    var p = state.project || getActiveProjectFromGlobals() || {
      schema: 'lumina-latex-project-v1',
      projectId: 'project-local-' + Math.random().toString(36).slice(2),
      name: 'Untitled Lumina LaTeX Project',
      rootFile: 'main.tex',
      activePath: 'main.tex',
      files: {
        'main.tex': '\\documentclass{article}\n\\begin{document}\nHello from Latexai.\n\\end{document}\n'
      }
    };

    p = normalizeProject(p);

    var editorText = getEditorText();
    if (typeof editorText === 'string') {
      var activePath = normalizePath(p.activePath || p.rootFile || 'main.tex');
      p.files[activePath] = editorText;
      p.updatedAt = nowIso();
    }

    return p;
  }

  function setActiveProject(project, opts) {
    opts = opts || {};
    var p = normalizeProject(project);
    state.project = p;
    writeLs(LS_PROJECT_KEY, p);

    try { ROOT.luminaLatexProject = p; } catch (_) {}
    try {
      if (ROOT.LuminaLatex) ROOT.LuminaLatex.project = p;
      if (ROOT.NS) ROOT.NS.project = p;
    } catch (_) {}

    emit('lumina:project-loaded', { project: p, source: opts.source || 'storage-provider' });
    emit('latexai:project-loaded', { project: p, source: opts.source || 'storage-provider' });
    return p;
  }

  function getSettings() {
    var defaults = {
      schema: 'lumina-latex-storage-settings-v1',
      stage: STAGE,
      storageMode: 'localStorage',
      autosave: true,
      autosaveMs: 1500,
      gitAutosave: false,
      nativeFolderSync: false,
      githubSync: false,
      updatedAt: nowIso()
    };
    var existing = readLs(LS_STORAGE_SETTINGS_KEY, {});
    return Object.assign({}, defaults, existing || {});
  }

  function saveSettings(next) {
    var settings = Object.assign({}, getSettings(), next || {}, {
      schema: 'lumina-latex-storage-settings-v1',
      stage: STAGE,
      updatedAt: nowIso()
    });
    writeLs(LS_STORAGE_SETTINGS_KEY, settings);
    state.mode = settings.storageMode || 'localStorage';
    state.autosaveMs = Number(settings.autosaveMs || 1500);
    emit('latexai:storage-settings-changed', { settings: settings });
    return settings;
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!ROOT.indexedDB) return reject(new Error('IndexedDB is not available.'));
      var req = ROOT.indexedDB.open(HANDLE_DB, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(HANDLE_STORE)) {
          db.createObjectStore(HANDLE_STORE);
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB open failed.')); };
    });
  }

  function idbSet(key, value) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(HANDLE_STORE, 'readwrite');
        tx.objectStore(HANDLE_STORE).put(value, key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB write failed.')); };
      });
    });
  }

  function idbGet(key) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(HANDLE_STORE, 'readonly');
        var req = tx.objectStore(HANDLE_STORE).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error || new Error('IndexedDB read failed.')); };
      });
    });
  }

  async function verifyPermission(handle, mode) {
    if (!handle || typeof handle.queryPermission !== 'function') return false;
    var opts = { mode: mode || 'readwrite' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if (typeof handle.requestPermission === 'function') {
      return (await handle.requestPermission(opts)) === 'granted';
    }
    return false;
  }

  async function readFileHandle(fileHandle, path) {
    var file = await fileHandle.getFile();
    if (isTextFile(path)) {
      return await file.text();
    }
    var buffer = await file.arrayBuffer();
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return {
      contentBase64: btoa(binary),
      encoding: 'base64',
      mimeType: file.type || 'application/octet-stream',
      size: file.size
    };
  }

  async function walkDirectory(dirHandle, prefix, outFiles, outHandles, limits) {
    limits = limits || { maxFiles: 300, maxBytes: 50000000 };
    prefix = prefix || '';
    outFiles = outFiles || {};
    outHandles = outHandles || {};

    for await (var entry of dirHandle.values()) {
      if (SKIP_DIRS[entry.name]) continue;
      var path = normalizePath(prefix ? prefix + '/' + entry.name : entry.name);
      if (entry.kind === 'directory') {
        await walkDirectory(entry, path, outFiles, outHandles, limits);
      } else if (entry.kind === 'file' && isProjectFile(path)) {
        if (Object.keys(outFiles).length >= limits.maxFiles) continue;
        try {
          var value = await readFileHandle(entry, path);
          outFiles[path] = value;
          outHandles[path] = entry;
        } catch (err) {
          warn('Could not read file', path, err);
        }
      }
    }

    return { files: outFiles, handles: outHandles };
  }

  function chooseRootFile(files) {
    var keys = Object.keys(files || {}).sort();
    if (files['main.tex']) return 'main.tex';
    for (var i = 0; i < keys.length; i++) {
      if (/main\.tex$/i.test(keys[i])) return keys[i];
    }
    for (var j = 0; j < keys.length; j++) {
      if (/\.tex$/i.test(keys[j])) return keys[j];
    }
    return keys[0] || 'main.tex';
  }

  async function openNativeFolder() {
    if (typeof ROOT.showDirectoryPicker !== 'function') {
      throw new Error('Native folder sync is not available in this browser. Use Chrome/Edge desktop or GitHub sync when available.');
    }

    var handle = await ROOT.showDirectoryPicker({ mode: 'readwrite' });
    var ok = await verifyPermission(handle, 'readwrite');
    if (!ok) throw new Error('Permission to read/write this folder was not granted.');

    state.folderHandle = handle;
    try { await idbSet(HANDLE_KEY, handle); } catch (err) { warn('Could not persist folder handle', err); }

    var walked = await walkDirectory(handle, '', {}, {}, { maxFiles: 300, maxBytes: 50000000 });
    state.fileHandles = walked.handles;

    var rootFile = chooseRootFile(walked.files);
    var project = setActiveProject({
      schema: 'lumina-latex-project-v1',
      projectId: 'native-folder-' + Math.random().toString(36).slice(2),
      name: handle.name || 'Native Folder Project',
      rootFile: rootFile,
      activePath: rootFile,
      files: walked.files,
      storage: {
        mode: 'nativeFolder',
        folderName: handle.name || '',
        openedAt: nowIso()
      }
    }, { source: 'native-folder' });

    saveSettings({ storageMode: 'nativeFolder', nativeFolderSync: true });
    state.lastLoadedAt = nowIso();
    state.statusMessage = 'Loaded local folder: ' + (handle.name || 'folder');
    emit('latexai:storage-status', getStatus());
    return project;
  }

  async function restoreNativeFolderHandle() {
    try {
      var handle = await idbGet(HANDLE_KEY);
      if (!handle) return null;
      var ok = await verifyPermission(handle, 'readwrite');
      if (!ok) return null;
      state.folderHandle = handle;
      return handle;
    } catch (err) {
      warn('Could not restore folder handle', err);
      return null;
    }
  }

  async function getFileHandleForPath(path, create) {
    path = normalizePath(path);
    if (state.fileHandles[path]) return state.fileHandles[path];
    var dir = state.folderHandle;
    if (!dir) return null;
    var parts = path.split('/');
    for (var i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: !!create });
    }
    var fh = await dir.getFileHandle(parts[parts.length - 1], { create: !!create });
    state.fileHandles[path] = fh;
    return fh;
  }

  async function writeNativeFile(path, value) {
    if (!state.folderHandle) throw new Error('No native folder is open.');
    if (!isTextFile(path)) return false;
    var fh = await getFileHandleForPath(path, true);
    var writable = await fh.createWritable();
    await writable.write(typeof value === 'string' ? value : valueToContent(value));
    await writable.close();
    return true;
  }

  async function saveNativeFolder(project) {
    if (!state.folderHandle) {
      var restored = await restoreNativeFolderHandle();
      if (!restored) throw new Error('No native folder is open. Click Open Local Folder first.');
    }
    project = normalizeProject(project || getActiveProject());
    var files = project.files || {};
    var paths = Object.keys(files);
    var savedPaths = [];
    for (var i = 0; i < paths.length; i++) {
      var path = normalizePath(paths[i]);
      if (!isTextFile(path)) continue;
      await writeNativeFile(path, files[paths[i]]);
      savedPaths.push(path);
    }
    state.lastSavedAt = nowIso();
    state.statusMessage = 'Saved ' + savedPaths.length + ' files to local folder.';
    emit('latexai:storage-status', getStatus());
    return { ok: true, mode: 'nativeFolder', savedPaths: savedPaths, savedAt: state.lastSavedAt };
  }

  async function saveLocalStorage(project) {
    project = normalizeProject(project || getActiveProject());
    setActiveProject(project, { source: 'localStorage-save' });
    var snapshot = {
      schema: 'lumina-latex-autosave-v1',
      stage: STAGE,
      project: project,
      savedAt: nowIso()
    };
    writeLs(LS_AUTOSAVE_KEY, snapshot);
    state.lastSavedAt = snapshot.savedAt;
    state.statusMessage = 'Saved to browser storage.';
    emit('latexai:storage-status', getStatus());
    return { ok: true, mode: 'localStorage', savedAt: state.lastSavedAt };
  }

  async function saveProject(project, opts) {
    opts = opts || {};
    var settings = getSettings();
    var mode = opts.mode || settings.storageMode || state.mode || 'localStorage';
    project = normalizeProject(project || getActiveProject());
    state.project = project;

    if (mode === 'nativeFolder') {
      try {
        var out = await saveNativeFolder(project);
        await saveLocalStorage(project);
        return out;
      } catch (err) {
        state.lastError = String(err && err.message || err);
        warn('Native folder save failed; falling back to localStorage.', err);
        return await saveLocalStorage(project);
      }
    }

    if (mode === 'github') {
      state.lastError = 'GitHub autosave backend is not enabled until Step 3.';
      await saveLocalStorage(project);
      throw new Error(state.lastError);
    }

    return await saveLocalStorage(project);
  }

  function loadProject() {
    var autosave = readLs(LS_AUTOSAVE_KEY, null);
    var project = (autosave && autosave.project) || readLs(LS_PROJECT_KEY, null) || getActiveProjectFromGlobals();
    if (!project) return null;
    project = setActiveProject(project, { source: 'storage-load' });
    state.lastLoadedAt = nowIso();
    state.statusMessage = 'Loaded project from browser storage.';
    return project;
  }

  function projectFingerprint(project) {
    project = normalizeProject(project || getActiveProject());
    var files = project.files || {};
    var paths = Object.keys(files).sort();
    var parts = [project.rootFile || '', project.activePath || '', String(paths.length)];
    paths.forEach(function (p) {
      var value = files[p];
      if (typeof value === 'string') parts.push(p + ':' + value.length + ':' + value.slice(0, 64));
      else parts.push(p + ':obj:' + JSON.stringify(value).length);
    });
    return parts.join('|');
  }

  var lastAutosaveFingerprint = '';
  async function autosaveNow(reason) {
    var settings = getSettings();
    if (settings.autosave === false) return { ok: false, skipped: true, reason: 'autosave disabled' };
    var project = getActiveProject();
    var fp = projectFingerprint(project);
    if (fp === lastAutosaveFingerprint && reason !== 'manual') {
      return { ok: true, skipped: true, reason: 'unchanged' };
    }
    lastAutosaveFingerprint = fp;
    var result = await saveProject(project, { reason: reason || 'autosave' });
    emit('latexai:autosaved', { result: result, project: project });
    return result;
  }

  function startAutosave() {
    stopAutosave();
    var settings = getSettings();
    if (settings.autosave === false) return;
    state.autosaveMs = Number(settings.autosaveMs || 1500);
    state.autosaveTimer = ROOT.setInterval(function () {
      autosaveNow('timer').catch(function (err) {
        state.lastError = String(err && err.message || err);
        emit('latexai:storage-status', getStatus());
      });
    }, state.autosaveMs);
    state.statusMessage = 'Autosave started.';
  }

  function stopAutosave() {
    if (state.autosaveTimer) {
      ROOT.clearInterval(state.autosaveTimer);
      state.autosaveTimer = null;
    }
  }

  function capabilities() {
    return {
      stage: STAGE,
      localStorage: !!getLocalStorage(),
      nativeFolder: typeof ROOT.showDirectoryPicker === 'function',
      nativeFolderHandlesPersistable: !!ROOT.indexedDB,
      github: false,
      githubReason: 'GitHub autosave backend will be added in Step 3.'
    };
  }

  function getStatus() {
    var settings = getSettings();
    return {
      ok: true,
      stage: STAGE,
      mode: settings.storageMode || state.mode,
      autosave: settings.autosave !== false,
      autosaveMs: Number(settings.autosaveMs || state.autosaveMs || 1500),
      nativeFolderOpen: !!state.folderHandle,
      nativeFolderName: state.folderHandle && state.folderHandle.name || '',
      fileHandleCount: Object.keys(state.fileHandles || {}).length,
      lastSavedAt: state.lastSavedAt,
      lastLoadedAt: state.lastLoadedAt,
      lastError: state.lastError,
      message: state.statusMessage,
      capabilities: capabilities()
    };
  }

  function diagnostics() {
    var project = getActiveProject();
    var files = project.files || {};
    var root = files[project.rootFile] || '';
    return {
      ok: true,
      stage: STAGE,
      status: getStatus(),
      projectSummary: {
        name: project.name,
        rootFile: project.rootFile,
        activePath: project.activePath,
        fileCount: Object.keys(files).length,
        rootLength: typeof root === 'string' ? root.length : JSON.stringify(root || {}).length,
        rootHead: typeof root === 'string' ? root.slice(0, 300) : '[non-text root value]'
      },
      settings: getSettings()
    };
  }

  function installAutosaveBridge() {
    if (state.installed) return;
    state.installed = true;
    loadProject();
    startAutosave();

    try {
      ROOT.addEventListener('beforeunload', function () {
        try {
          var project = getActiveProject();
          writeLs(LS_AUTOSAVE_KEY, {
            schema: 'lumina-latex-autosave-v1',
            stage: STAGE,
            project: project,
            savedAt: nowIso(),
            reason: 'beforeunload'
          });
        } catch (_) {}
      });
    } catch (_) {}

    emit('latexai:storage-ready', getStatus());
  }

  var StorageProvider = {
    stage: STAGE,
    capabilities: capabilities,
    detectCapabilities: capabilities,
    getStatus: getStatus,
    status: getStatus,
    diagnostics: diagnostics,
    getSettings: getSettings,
    saveSettings: saveSettings,
    configure: saveSettings,
    getActiveProject: getActiveProject,
    setActiveProject: setActiveProject,
    loadProject: loadProject,
    saveProject: saveProject,
    autosaveNow: autosaveNow,
    startAutosave: startAutosave,
    stopAutosave: stopAutosave,
    openNativeFolder: openNativeFolder,
    restoreNativeFolderHandle: restoreNativeFolderHandle,
    saveNativeFolder: saveNativeFolder,
    normalizeProject: normalizeProject,
    installAutosaveBridge: installAutosaveBridge,
    _state: state
  };

  function attachOnce() {
    ROOT.LuminaLatex = ROOT.LuminaLatex || {};
    ROOT.Lumina = ROOT.Lumina || {};
    ROOT.NS = ROOT.NS || ROOT.LuminaLatex;

    ROOT.LuminaLatex.StorageProvider = StorageProvider;
    ROOT.LuminaLatex.StorageManager = StorageProvider;
    ROOT.Lumina.StorageProvider = StorageProvider;
    ROOT.Lumina.StorageManager = StorageProvider;
    ROOT.NS.StorageProvider = StorageProvider;
    ROOT.NS.StorageManager = StorageProvider;
    ROOT.StorageProvider = StorageProvider;
    ROOT.LatexaiStorageProvider = StorageProvider;
    ROOT.LAI_STORAGE = StorageProvider;

    // Make diagnostics easy for the existing app to find.
    ROOT.LuminaLatex.storageDiagnostics = diagnostics;
    ROOT.NS.storageDiagnostics = diagnostics;
  }

  attachOnce();

  // Re-attach during app boot because Stage 1G may replace NS after preload scripts run.
  var attachCount = 0;
  var attachTimer = ROOT.setInterval ? ROOT.setInterval(function () {
    attachOnce();
    attachCount += 1;
    if (attachCount > 80) ROOT.clearInterval(attachTimer);
  }, 100) : null;

  if (ROOT.document && ROOT.document.addEventListener) {
    ROOT.document.addEventListener('DOMContentLoaded', function () {
      attachOnce();
      installAutosaveBridge();
    });
  } else {
    installAutosaveBridge();
  }

  log('loaded', STAGE, capabilities());
})();
