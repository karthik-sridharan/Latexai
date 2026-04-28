(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const Model = () => NS.ProjectModel;

  const STORAGE_KEY = 'lumina-latex-editor.project.v1';
  const SETTINGS_KEY = 'lumina-latex-editor.settings.v1';
  const SNAPSHOT_PREFIX = 'lumina-latex-editor.snapshot.';

  function saveLocal(project, settings) {
    const normalized = Model().normalizeProject(project);
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
      if (raw) project = Model().normalizeProject(JSON.parse(raw));
    } catch (err) {
      console.warn('Lumina project load failed', err);
    }
    try {
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) settings = Object.assign(Model().defaultSettings(), JSON.parse(rawSettings));
    } catch (err) {
      console.warn('Lumina settings load failed', err);
    }
    if (!project) project = Model().defaultProject();
    project.settings = Object.assign(Model().defaultSettings(), project.settings || {}, settings || {});
    return { project, settings: project.settings, loaded: !!localStorage.getItem(STORAGE_KEY) };
  }

  function clearLocal() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  }

  function saveSnapshot(project, label = 'manual') {
    const normalized = Model().normalizeProject(project);
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
    SETTINGS_KEY,
    SNAPSHOT_PREFIX,
    saveLocal,
    loadLocal,
    clearLocal,
    saveSnapshot,
    listSnapshots
  };
})();
