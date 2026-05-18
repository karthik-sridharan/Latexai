(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const Model = () => NS.ProjectModel;

  const STORAGE_KEY = 'lumina-latex-editor.project.v1';
  const SETTINGS_KEY = 'lumina-latex-editor.settings.v1';
  const SNAPSHOT_PREFIX = 'lumina-latex-editor.snapshot.';
  const FULL_PROJECT_CACHE_KEY = 'lumina-latex-editor.full-project-cache.v1';



  function githubKey(project) {
    const gh = project?.github || project?.meta?.github || null;
    if (!gh) return '';
    return [gh.owner || '', gh.repo || '', gh.branch || 'main', gh.rootPath || ''].map((x) => String(x || '').trim()).join('/');
  }

  function loadFullProjectCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FULL_PROJECT_CACHE_KEY) || 'null');
      return parsed?.project ? Model().normalizeProject(parsed.project) : null;
    } catch (_err) {
      return null;
    }
  }

  function rememberFullProject(project, label = 'store') {
    try {
      const normalized = Model().normalizeProject(project);
      if (!normalized.github && normalized.files.length <= 1) return;
      localStorage.setItem(FULL_PROJECT_CACHE_KEY, JSON.stringify({
        schema: 'lumina-latex-full-project-cache-v1',
        label,
        savedAt: Model().nowIso(),
        githubKey: githubKey(normalized),
        fileCount: normalized.files.length,
        paths: normalized.files.map((f) => f.path),
        project: normalized
      }));
    } catch (_err) {}
  }

  function mergeWithFullProjectCache(project, reason = 'store') {
    let normalized = Model().normalizeProject(project);
    const cached = loadFullProjectCache();
    if (!cached || cached.files.length <= normalized.files.length || cached.files.length <= 1) {
      rememberFullProject(normalized, reason);
      return normalized;
    }
    const sameGithub = githubKey(normalized) && githubKey(cached) && githubKey(normalized) === githubKey(cached);
    const currentPath = normalized.files[0]?.path || normalized.activePath || normalized.rootFile;
    const cachedHasCurrent = cached.files.some((f) => f.path === currentPath || f.path === normalized.activePath || f.path === normalized.rootFile);
    if (!(sameGithub || normalized.github || cached.github || (normalized.files.length <= 1 && cachedHasCurrent))) {
      rememberFullProject(normalized, reason);
      return normalized;
    }
    const byPath = new Map(cached.files.map((f) => [f.path, f]));
    for (const file of normalized.files) byPath.set(file.path, file);
    normalized = Model().normalizeProject(Object.assign({}, cached, normalized, {
      files: Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path)),
      github: normalized.github || cached.github || null,
      meta: Object.assign({}, cached.meta || {}, normalized.meta || {}, { architectureStage: 'stage3j-full-project-guard' })
    }));
    rememberFullProject(normalized, reason + ':restored');
    return normalized;
  }

  function saveLocal(project, settings) {
    const normalized = mergeWithFullProjectCache(project, 'save-local');
    const mergedSettings = Object.assign(Model().defaultSettings(), normalized.settings || {}, settings || {});
    normalized.settings = mergedSettings;
    normalized.updatedAt = Model().nowIso();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(mergedSettings));
    return { ok: true, savedAt: normalized.updatedAt, project: normalized, settings: mergedSettings };
  }

  function loadLocal() {
    let project = null;
    let settings = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) project = mergeWithFullProjectCache(JSON.parse(raw), 'load-local');
    } catch (err) {
      console.warn('Lumina project load failed', err);
    }
    try {
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) settings = Object.assign(Model().defaultSettings(), JSON.parse(rawSettings));
    } catch (err) {
      console.warn('Lumina settings load failed', err);
    }
    if (!project) project = mergeWithFullProjectCache(Model().defaultProject(), 'load-default');
    project.settings = Object.assign(Model().defaultSettings(), project.settings || {}, settings || {});
    return { project, settings: project.settings, loaded: !!localStorage.getItem(STORAGE_KEY) };
  }

  function clearLocal() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  }

  function saveSnapshot(project, label = 'manual') {
    const normalized = mergeWithFullProjectCache(project, 'snapshot');
    const key = `${SNAPSHOT_PREFIX}${normalized.projectId}.${Date.now()}`;
    const snapshot = {
      schema: 'lumina-latex-project-snapshot-v1',
      label,
      savedAt: Model().nowIso(),
      project: normalized
    };
    localStorage.setItem(key, JSON.stringify(snapshot));
    return key;
  }

  function listSnapshots(projectId) {
    const prefix = projectId ? `${SNAPSHOT_PREFIX}${projectId}.` : SNAPSHOT_PREFIX;
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .map((key) => {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || '{}');
          return { key, label: parsed.label || 'snapshot', savedAt: parsed.savedAt || '', name: parsed.project?.name || '' };
        } catch (_err) {
          return { key, label: 'corrupt snapshot', savedAt: '', name: '' };
        }
      })
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
  }

  NS.ProjectStore = {
    STORAGE_KEY,
    FULL_PROJECT_CACHE_KEY,
    SETTINGS_KEY,
    SNAPSHOT_PREFIX,
    saveLocal,
    loadLocal,
    clearLocal,
    saveSnapshot,
    listSnapshots
  };
})();
