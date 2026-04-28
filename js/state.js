(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const Model = () => NS.ProjectModel;
  const Store = () => NS.ProjectStore;
  const STAGE = W.LUMINA_LATEX_STAGE || 'latex-stage1g-texlyre-log-tail-hotfix-20260428-1';

  const state = {
    project: Model().defaultProject(),
    settings: Model().defaultSettings(),
    dirty: false,
    lastSavedAt: null,
    lastLog: 'No compile has been run yet.',
    lastProblems: [],
    compile: {
      status: 'idle',
      jobId: null,
      progress: 0,
      message: 'No compile job has run yet.',
      startedAt: null,
      finishedAt: null
    },
    sync: {
      provider: 'local-only',
      status: 'offline',
      lastEvent: null
    }
  };

  const listeners = new Set();

  function clone(value) { return Model().clone(value); }
  function nowIso() { return Model().nowIso(); }
  function normalizePath(path) { return Model().normalizePath(path); }
  function fileKind(path) { return Model().fileKind(path); }
  function textFile(pathOrFile) { return Model().textFile(pathOrFile); }
  function defaultProject() { return Model().defaultProject(); }


  function forceTeXlyreDirectMode() {
    const ua = String(W.navigator?.userAgent || '');
    const vendor = String(W.navigator?.vendor || '');
    const isIOS = /iPad|iPhone|iPod/i.test(ua) || (W.navigator?.platform === 'MacIntel' && W.navigator?.maxTouchPoints > 1);
    const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg\//i.test(ua) && /Apple/i.test(vendor || 'Apple');
    return isIOS || isSafari;
  }

  function enforceSafetySettings() {
    if (forceTeXlyreDirectMode() && state.settings?.texlyreUseWorker === true) {
      state.settings.texlyreUseWorker = false;
    }
    if (forceTeXlyreDirectMode() && state.project?.settings?.texlyreUseWorker === true) {
      state.project.settings.texlyreUseWorker = false;
    }
  }

  function emit(reason) {
    const snapshot = clone(state);
    for (const fn of listeners) {
      try { fn(snapshot, reason || 'state'); } catch (err) { console.error(err); }
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function normalizeState() {
    state.project = Model().normalizeProject(state.project);
    state.settings = Object.assign(Model().defaultSettings(), state.project.settings || {}, state.settings || {});
    enforceSafetySettings();
    state.project.settings = Object.assign({}, state.settings);
    ensureValidActiveFile();
  }

  function save() {
    try {
      normalizeState();
      const syncProvider = NS.SyncProvider?.providerForSettings?.(state.settings);
      // Local save remains the guaranteed path in Stage 1E. Other sync providers are explicit future implementations.
      const result = Store().saveLocal(state.project, state.settings);
      state.project = result.project;
      state.settings = result.settings;
      state.dirty = false;
      state.lastSavedAt = result.savedAt;
      state.sync = { provider: syncProvider?.name || 'local-only', status: 'saved-local', lastEvent: result.savedAt };
      emit('save');
      return true;
    } catch (err) {
      state.lastLog = `Local save failed: ${err.message || err}`;
      state.sync = { provider: 'local-only', status: 'error', lastEvent: state.lastLog };
      emit('save-error');
      return false;
    }
  }

  function load() {
    try {
      const result = Store().loadLocal();
      state.project = result.project;
      state.settings = Object.assign(Model().defaultSettings(), result.settings || {});
      enforceSafetySettings();
      state.project.settings = Object.assign({}, state.settings);
      state.lastSavedAt = result.loaded ? nowIso() : null;
      state.sync = { provider: 'local-only', status: result.loaded ? 'loaded-local' : 'default-project', lastEvent: state.lastSavedAt };
      normalizeState();
      emit('load');
      return result.loaded;
    } catch (err) {
      console.warn('Could not load saved project', err);
      state.project = Model().defaultProject();
      state.settings = Object.assign(Model().defaultSettings(), state.project.settings || {});
      enforceSafetySettings();
      state.project.settings = Object.assign({}, state.settings);
      ensureValidActiveFile();
      emit('load-error');
      return false;
    }
  }

  function resetProject(project) {
    state.project = Model().normalizeProject(project || Model().defaultProject());
    state.settings = Object.assign(Model().defaultSettings(), state.project.settings || {});
    enforceSafetySettings();
    state.project.settings = Object.assign({}, state.settings);
    state.dirty = true;
    ensureValidActiveFile();
    save();
    emit('reset');
  }

  function ensureValidActiveFile() {
    const p = state.project;
    if (!p.files.some((file) => file.path === p.activePath)) p.activePath = p.files[0]?.path || 'main.tex';
    if (!p.files.some((file) => file.path === p.rootFile && file.kind === 'tex')) {
      const firstTex = p.files.find((file) => file.kind === 'tex');
      p.rootFile = firstTex?.path || p.files[0]?.path || 'main.tex';
    }
    p.mainFile = p.rootFile;
  }

  function getFile(path) {
    const target = normalizePath(path || state.project.activePath);
    return state.project.files.find((file) => file.path === target) || null;
  }

  function getActiveFile() { return getFile(state.project.activePath); }

  function setActivePath(path) {
    const normalized = normalizePath(path);
    if (!getFile(normalized)) return false;
    state.project.activePath = normalized;
    emit('active-file');
    return true;
  }

  function touch(file) {
    file.updatedAt = nowIso();
    file.version = Number(file.version || 1) + 1;
    state.project.updatedAt = file.updatedAt;
    state.project.settings = Object.assign({}, state.settings);
    state.dirty = true;
  }

  function updateFile(path, text) {
    const file = getFile(path);
    if (!file || !textFile(file)) return false;
    file.text = String(text ?? '');
    touch(file);
    emit('file-change');
    return true;
  }

  function updateActiveText(text) { return updateFile(state.project.activePath, text); }

  function createFile(path, text = '', options = {}) {
    const normalized = normalizePath(path || 'untitled.tex');
    if (!normalized || getFile(normalized)) return null;
    const file = Model().makeFile(normalized, text);
    if (options.base64) { file.text = ''; file.base64 = String(options.base64 || ''); file.encoding = 'base64'; }
    state.project.files.push(file);
    state.project.files.sort((a, b) => a.path.localeCompare(b.path));
    state.project.activePath = normalized;
    if (!state.project.rootFile && file.kind === 'tex') state.project.rootFile = normalized;
    state.dirty = true;
    emit('file-create');
    return file;
  }

  function importFile(path, text, options = {}) {
    const normalized = normalizePath(path);
    if (!normalized) return null;
    const existing = getFile(normalized);
    if (existing) {
      if (!options.overwrite) return null;
      existing.kind = fileKind(normalized);
      if (options.base64) { existing.text = ''; existing.base64 = String(options.base64 || ''); existing.encoding = 'base64'; }
      else { existing.text = String(text ?? ''); existing.base64 = ''; existing.encoding = 'utf8'; }
      touch(existing);
      emit('file-import-overwrite');
      return existing;
    }
    return createFile(normalized, text, options);
  }

  function removeFile(path) {
    const normalized = normalizePath(path);
    if (state.project.files.length <= 1) return false;
    const idx = state.project.files.findIndex((file) => file.path === normalized);
    if (idx < 0) return false;
    state.project.files.splice(idx, 1);
    if (state.project.activePath === normalized) state.project.activePath = state.project.files[0].path;
    if (state.project.rootFile === normalized) {
      const firstTex = state.project.files.find((file) => file.kind === 'tex');
      state.project.rootFile = firstTex?.path || state.project.files[0].path;
      state.project.mainFile = state.project.rootFile;
    }
    state.dirty = true;
    emit('file-remove');
    return true;
  }

  function renameFile(oldPath, newPath) {
    const oldNormalized = normalizePath(oldPath);
    const newNormalized = normalizePath(newPath);
    if (!newNormalized || getFile(newNormalized)) return false;
    const file = getFile(oldNormalized);
    if (!file) return false;
    file.path = newNormalized;
    file.kind = fileKind(newNormalized);
    touch(file);
    if (state.project.activePath === oldNormalized) state.project.activePath = newNormalized;
    if (state.project.rootFile === oldNormalized) {
      state.project.rootFile = newNormalized;
      state.project.mainFile = newNormalized;
    }
    state.project.files.sort((a, b) => a.path.localeCompare(b.path));
    emit('file-rename');
    return true;
  }

  function renameProject(name) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    state.project.name = clean;
    state.project.title = clean;
    state.dirty = true;
    emit('project-rename');
    return true;
  }

  function setRootFile(path) {
    const file = getFile(path);
    if (!file || file.kind !== 'tex') return false;
    state.project.rootFile = file.path;
    state.project.mainFile = file.path;
    state.dirty = true;
    emit('settings');
    return true;
  }

  function setSetting(key, value) {
    if (key === 'texlyreUseWorker' && value === true && forceTeXlyreDirectMode()) value = false;
    state.settings[key] = value;
    state.project.settings = Object.assign({}, state.settings);
    state.dirty = true;
    emit('settings');
  }

  function setLog(log, problems) {
    state.lastLog = String(log || '');
    state.lastProblems = Array.isArray(problems) ? problems : [];
    emit('logs');
  }

  function setCompileStatus(update = {}) {
    state.compile = Object.assign({}, state.compile || {}, update || {});
    if (update.status && ['succeeded','failed','canceled','error'].includes(update.status)) {
      state.compile.finishedAt = state.compile.finishedAt || nowIso();
    }
    emit('compile-status');
  }

  function snapshot(label = 'manual') {
    const key = Store().saveSnapshot(state.project, label);
    emit('snapshot');
    return key;
  }

  NS.State = {
    STAGE,
    STORAGE_KEY: Store().STORAGE_KEY,
    SETTINGS_KEY: Store().SETTINGS_KEY,
    state,
    defaultProject,
    clone,
    normalizePath,
    fileKind,
    textFile,
    subscribe,
    emit,
    save,
    load,
    resetProject,
    ensureValidActiveFile,
    forceTeXlyreDirectMode,
    getFile,
    getActiveFile,
    setActivePath,
    updateFile,
    updateActiveText,
    createFile,
    importFile,
    removeFile,
    renameFile,
    renameProject,
    setRootFile,
    setSetting,
    setLog,
    setCompileStatus,
    snapshot
  };
})();
