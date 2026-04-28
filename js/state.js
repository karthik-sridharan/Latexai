(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = W.LUMINA_LATEX_STAGE || 'latex-stage1a-20260427-1';
  const STORAGE_KEY = 'lumina-latex-editor.project.v1';
  const SETTINGS_KEY = 'lumina-latex-editor.settings.v1';

  const DEFAULT_MAIN_TEX = String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{graphicx}
\usepackage{hyperref}

\title{A Lumina LaTeX Project}
\author{Karthik Sridharan}
\date{\today}

\newtheorem{theorem}{Theorem}
\newtheorem{lemma}{Lemma}

\begin{document}
\maketitle

\begin{abstract}
This is the first stage of a Lumina-style web LaTeX editor. The draft preview is local and approximate; real PDF compilation is routed through the optional backend included in this package.
\end{abstract}

\section{Introduction}
Write your paper here. Inline math such as $E = mc^2$ appears in the draft preview, and display math is preserved:
\[
  \nabla f(x_t)^\top (x_t - x^*) \leq \frac{1}{2\eta}\left(\|x_t-x^*\|^2 - \|x_{t+1}-x^*\|^2\right) + \frac{\eta}{2}\|\nabla f(x_t)\|^2.
\]

\section{A Result}
\begin{theorem}[Example]
If the compile backend is configured, this project can be compiled into a PDF while keeping API keys and TeX execution out of the browser.
\end{theorem}

\begin{proof}
The browser sends source files to a trusted backend. The backend runs TeX in an isolated temporary directory and returns the resulting PDF and log.
\end{proof}

\section{Next steps}
\begin{itemize}
  \item Add files from the left rail.
  \item Use the Copilot tab to draft or fix LaTeX through your backend AI proxy.
  \item Export the project as a zip for storage.
\end{itemize}

\bibliographystyle{plain}
\bibliography{refs}
\end{document}
`;

  const DEFAULT_BIB = String.raw`@article{knuth1984tex,
  title={The TeXbook},
  author={Knuth, Donald E.},
  year={1984},
  publisher={Addison-Wesley}
}
`;

  function uid(prefix = 'id') {
    const random = Math.random().toString(36).slice(2, 9);
    return `${prefix}-${Date.now().toString(36)}-${random}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizePath(path) {
    return String(path || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/')
      .trim();
  }

  function fileKind(path) {
    const lower = String(path || '').toLowerCase();
    if (lower.endsWith('.tex')) return 'tex';
    if (lower.endsWith('.bib')) return 'bib';
    if (lower.endsWith('.sty')) return 'sty';
    if (lower.endsWith('.cls')) return 'cls';
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.pdf')) return 'asset';
    return 'text';
  }

  function textFile(path) {
    const kind = fileKind(path);
    return kind !== 'asset';
  }

  function defaultProject() {
    const t = nowIso();
    return {
      id: uid('project'),
      stage: STAGE,
      name: 'Untitled Lumina LaTeX Project',
      rootFile: 'main.tex',
      activePath: 'main.tex',
      updatedAt: t,
      files: [
        { id: uid('file'), path: 'main.tex', kind: 'tex', text: DEFAULT_MAIN_TEX, updatedAt: t },
        { id: uid('file'), path: 'refs.bib', kind: 'bib', text: DEFAULT_BIB, updatedAt: t },
        { id: uid('file'), path: 'notes/todo.tex', kind: 'tex', text: String.raw`% Notes for this project
% TODO: Add related work notes here.
`, updatedAt: t }
      ]
    };
  }

  const state = {
    project: defaultProject(),
    settings: {
      compileUrl: '/api/lumina/latex/compile',
      engine: 'pdflatex',
      shellEscape: false,
      previewMode: 'draft'
    },
    dirty: false,
    lastSavedAt: null,
    lastLog: 'No compile has been run yet.',
    lastProblems: []
  };

  const listeners = new Set();

  function emit(reason) {
    for (const fn of listeners) {
      try { fn(clone(state), reason || 'state'); } catch (err) { console.error(err); }
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function save() {
    try {
      state.project.updatedAt = nowIso();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
      state.dirty = false;
      state.lastSavedAt = nowIso();
      emit('save');
      return true;
    } catch (err) {
      state.lastLog = `Local save failed: ${err.message || err}`;
      emit('save-error');
      return false;
    }
  }

  function load() {
    let loaded = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.files) && parsed.files.length) {
          state.project = parsed;
          loaded = true;
        }
      }
    } catch (err) {
      console.warn('Could not load saved project', err);
    }
    try {
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) state.settings = Object.assign({}, state.settings, JSON.parse(rawSettings));
    } catch (err) {
      console.warn('Could not load saved settings', err);
    }
    ensureValidActiveFile();
    state.lastSavedAt = loaded ? nowIso() : null;
    emit('load');
    return loaded;
  }

  function resetProject(project) {
    state.project = project || defaultProject();
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
  }

  function getFile(path) {
    const target = path || state.project.activePath;
    return state.project.files.find((file) => file.path === target) || null;
  }

  function getActiveFile() {
    return getFile(state.project.activePath);
  }

  function setActivePath(path) {
    const normalized = normalizePath(path);
    if (!getFile(normalized)) return false;
    state.project.activePath = normalized;
    emit('active-file');
    return true;
  }

  function touch(file) {
    file.updatedAt = nowIso();
    state.project.updatedAt = file.updatedAt;
    state.dirty = true;
  }

  function updateFile(path, text) {
    const file = getFile(path);
    if (!file || !textFile(file.path)) return false;
    file.text = String(text ?? '');
    touch(file);
    emit('file-change');
    return true;
  }

  function updateActiveText(text) {
    return updateFile(state.project.activePath, text);
  }

  function createFile(path, text = '') {
    const normalized = normalizePath(path || 'untitled.tex');
    if (!normalized) return null;
    if (getFile(normalized)) return null;
    const file = { id: uid('file'), path: normalized, kind: fileKind(normalized), text: String(text ?? ''), updatedAt: nowIso() };
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
      existing.text = String(text ?? '');
      existing.kind = fileKind(normalized);
      touch(existing);
      emit('file-import-overwrite');
      return existing;
    }
    return createFile(normalized, text);
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
    if (state.project.rootFile === oldNormalized) state.project.rootFile = newNormalized;
    state.project.files.sort((a, b) => a.path.localeCompare(b.path));
    emit('file-rename');
    return true;
  }

  function renameProject(name) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    state.project.name = clean;
    state.dirty = true;
    emit('project-rename');
    return true;
  }

  function setRootFile(path) {
    const file = getFile(path);
    if (!file || file.kind !== 'tex') return false;
    state.project.rootFile = file.path;
    state.dirty = true;
    emit('settings');
    return true;
  }

  function setSetting(key, value) {
    state.settings[key] = value;
    state.dirty = true;
    emit('settings');
  }

  function setLog(log, problems) {
    state.lastLog = String(log || '');
    state.lastProblems = Array.isArray(problems) ? problems : [];
    emit('logs');
  }

  NS.State = {
    STAGE,
    STORAGE_KEY,
    SETTINGS_KEY,
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
    setLog
  };
})();
