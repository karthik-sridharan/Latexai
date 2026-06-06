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


  const STAGE19H2 = 'stage19i-agent-role-specific-context-policy-20260526-1';
  const LOCAL_STORAGE_SOFT_LIMIT_BYTES = 4_000_000;
  const LOCAL_STORAGE_HARD_LIMIT_BYTES = 4_800_000;
  const LOCAL_STORAGE_LARGE_FILE_BYTES = 750_000;
  const LOCAL_STORAGE_TEXT_EXTENSIONS = new Set(['tex', 'bib', 'sty', 'cls', 'bst', 'md', 'txt', 'json', 'yml', 'yaml']);

  function roughBytes(value) {
    try { return new Blob([String(value || '')]).size; } catch (_err) { return String(value || '').length * 2; }
  }

  function fileExtension(path = '') {
    const clean = String(path || '').split('?')[0].split('#')[0];
    const idx = clean.lastIndexOf('.');
    return idx >= 0 ? clean.slice(idx + 1).toLowerCase() : '';
  }

  function isTextLikeFile(file = {}) {
    const ext = fileExtension(file.path || file.name || file.filename || '');
    return file.kind === 'tex' || file.kind === 'bib' || file.kind === 'source' || LOCAL_STORAGE_TEXT_EXTENSIONS.has(ext);
  }

  function compactFileForLocalStorage(file = {}, options = {}) {
    const out = Object.assign({}, file);
    const content = String(out.content ?? out.text ?? '');
    const contentBytes = roughBytes(content);
    const textLike = isTextLikeFile(out);
    const preserveContent = !!options.preserveAllText || (textLike && contentBytes <= LOCAL_STORAGE_LARGE_FILE_BYTES);

    if (!preserveContent) {
      delete out.content;
      delete out.text;
      delete out.data;
      delete out.base64;
      delete out.blob;
      out.localStorageOmittedContent = true;
      out.localStorageOmittedBytes = contentBytes;
      out.placeholder = out.placeholder || `[Large or binary file omitted from browser autosave: ${out.path || out.name || 'file'}]`;
      if (!out.kind) out.kind = textLike ? 'source' : 'asset';
    }
    return out;
  }

  function compactProjectForLocalStorage(project, options = {}) {
    const normalized = Model().normalizeProject(project);
    const files = Array.isArray(normalized.files) ? normalized.files : [];
    let compact = Object.assign({}, normalized, {
      files: files.map((file) => compactFileForLocalStorage(file, options)),
      meta: Object.assign({}, normalized.meta || {}, {
        localStorageCompacted: true,
        localStorageCompactedAt: Model().nowIso(),
        localStorageCompactedStage: STAGE19H2,
        originalFileCount: files.length
      })
    });

    let json = JSON.stringify(compact);
    if (roughBytes(json) <= LOCAL_STORAGE_SOFT_LIMIT_BYTES) return compact;

    // If still too large, keep only source-like files and metadata for assets.
    compact = Object.assign({}, compact, {
      files: files.map((file) => {
        const textLike = isTextLikeFile(file);
        return compactFileForLocalStorage(file, { preserveAllText: textLike && roughBytes(String(file.content ?? file.text ?? '')) <= 350_000 });
      }),
      meta: Object.assign({}, compact.meta || {}, { localStorageAggressivelyCompacted: true })
    });
    json = JSON.stringify(compact);
    if (roughBytes(json) <= LOCAL_STORAGE_HARD_LIMIT_BYTES) return compact;

    // Final fallback: store only main/root text files plus metadata. The live in-memory
    // project remains complete; this fallback only affects browser reload autosave.
    const root = normalized.rootFile || normalized.activePath || 'main.tex';
    const minimalFiles = files
      .filter((file) => file.path === root || file.path === normalized.activePath || /(^|\/)(main|refs|references|bibliography)\.(tex|bib)$/i.test(file.path || ''))
      .map((file) => compactFileForLocalStorage(file, { preserveAllText: true }));
    if (!minimalFiles.length && files[0]) minimalFiles.push(compactFileForLocalStorage(files[0], { preserveAllText: true }));
    return Object.assign({}, compact, {
      files: minimalFiles,
      meta: Object.assign({}, compact.meta || {}, {
        localStorageMinimalFallback: true,
        omittedFileCount: Math.max(0, files.length - minimalFiles.length)
      })
    });
  }

  function safeSetJson(key, value, fallbackValue = null) {
    const primaryText = JSON.stringify(value);
    try {
      localStorage.setItem(key, primaryText);
      return { ok: true, compacted: false, bytes: roughBytes(primaryText) };
    } catch (err) {
      if (!fallbackValue) throw err;
      const fallbackText = JSON.stringify(fallbackValue);
      localStorage.setItem(key, fallbackText);
      return { ok: true, compacted: true, bytes: roughBytes(fallbackText), originalError: err?.message || String(err) };
    }
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
      const compact = compactProjectForLocalStorage(normalized);
      safeSetJson(FULL_PROJECT_CACHE_KEY, {
        schema: 'lumina-latex-full-project-cache-v1',
        stage: STAGE19H2,
        label,
        savedAt: Model().nowIso(),
        githubKey: githubKey(normalized),
        fileCount: normalized.files.length,
        paths: normalized.files.map((f) => f.path),
        compacted: !!compact.meta?.localStorageCompacted,
        project: compact
      });
    } catch (err) {
      console.warn('Chuvadi full-project browser cache skipped because storage quota was reached.', err);
    }
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

    const compact = compactProjectForLocalStorage(normalized);
    try {
      safeSetJson(STORAGE_KEY, normalized, compact);
    } catch (err) {
      console.warn('Chuvadi local project autosave skipped because browser storage quota was reached.', err);
      try { localStorage.removeItem(STORAGE_KEY); } catch (_err) {}
    }
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(mergedSettings)); } catch (_err) {}

    // Return the full in-memory project even if the browser autosave had to be compacted.
    return { ok: true, savedAt: normalized.updatedAt, project: normalized, settings: mergedSettings };
  }

  function loadLocal() {
    let project = null;
    let settings = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) project = mergeWithFullProjectCache(JSON.parse(raw), 'load-local');
    } catch (err) {
      console.warn('Chuvadi project load failed', err);
    }
    try {
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) settings = Object.assign(Model().defaultSettings(), JSON.parse(rawSettings));
    } catch (err) {
      console.warn('Chuvadi settings load failed', err);
    }
    if (!project) project = mergeWithFullProjectCache(Model().defaultProject(), 'load-default');
    project.settings = Object.assign(Model().defaultSettings(), project.settings || {}, settings || {});
    return { project, settings: project.settings, loaded: !!localStorage.getItem(STORAGE_KEY) };
  }

  function clearFullProjectCache() {
    localStorage.removeItem(FULL_PROJECT_CACHE_KEY);
  }

  function clearLocal() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    clearFullProjectCache();
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
    clearFullProjectCache,
    saveSnapshot,
    listSnapshots
  };
})();
