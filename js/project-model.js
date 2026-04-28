(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = W.LUMINA_LATEX_STAGE || 'latex-stage1g-texlyre-pdf-status-hotfix-20260428-1';
  const SCHEMA = 'lumina-latex-project-v1';
  const FILE_SCHEMA = 'lumina-latex-file-v1';

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
This Stage 1E keeps the Lumina provider foundation and adds a real backend compile runner with TeX Live, isolated temporary workspaces, backend health checks, status polling, structured logs, and click-to-line diagnostics.
\end{abstract}

\section{Architecture}
The browser stores a canonical project object and sends that object to a trusted backend for compilation or AI assistance. The editor, compiler, preview, sync, and AI pieces communicate through provider contracts instead of direct cross-module calls.

\section{A Result}
\begin{theorem}[Foundation seam]
If each subsystem is hidden behind a provider interface, then browser-only mode, backend compile mode, and later real-time collaboration can share the same project format.
\end{theorem}

\begin{proof}
The project is represented by stable file paths and ids. UI events update the project state, and providers consume snapshots of that state. Replacing a provider changes implementation details but not the document model.
\end{proof}

\section{Next steps}
\begin{itemize}
  \item Stage 1E: real backend PDF compilation, backend health checks, and safer temporary workspaces.
  \item Stage 1E: structured Copilot fix-error workflows with patch preview.
  \item Stage 1F: CodeMirror editor upgrade, source/PDF sync hooks, and import polish.
\end{itemize}

\bibliographystyle{plain}
\bibliography{refs}
\end{document}
`;

  const DEFAULT_BIB = String.raw`@book{knuth1984texbook,
  title={The TeXbook},
  author={Knuth, Donald E.},
  year={1984},
  publisher={Addison-Wesley}
}
`;

  function uid(prefix = 'id') {
    const random = Math.random().toString(36).slice(2, 10);
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
    if (lower.endsWith('.md')) return 'markdown';
    if (lower.endsWith('.txt')) return 'text';
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.pdf') || lower.endsWith('.eps')) return 'asset';
    return 'text';
  }

  function textFile(pathOrFile) {
    const kind = typeof pathOrFile === 'object' ? pathOrFile.kind : fileKind(pathOrFile);
    return !['asset', 'binary'].includes(kind);
  }

  function defaultSettings() {
    return {
      schema: 'lumina-latex-settings-v1',
      compilerMode: 'backend-texlive',
      compileUrl: '/api/lumina/latex/compile',
      compileStatusUrl: '/api/lumina/latex/compile/jobs',
      useCompileJobs: true,
      compilePollMs: 1000,
      compileTimeoutMs: 90000,
      engine: 'pdflatex',
      bibliography: 'bibtex',
      shellEscape: false,
      browserWasmAssetBase: 'vendor/swiftlatex/pdftex/',
      browserWasmTexliveEndpoint: 'https://texlive.swiftlatex.com/',
      browserWasmReuseEngine: true,
      texlyreModuleUrl: 'https://cdn.jsdelivr.net/npm/texlyre-busytex@1.1.1/dist/index.js',
      texlyreBusytexBase: 'vendor/texlyre/core/busytex',
      texlyreReuseRunner: true,
      texlyreUseWorker: false,
      previewMode: 'draft',
      syncMode: 'local-only',
      httpProjectUrl: '/api/lumina/projects',
      websocketUrl: '/ws/lumina/projects',
      aiUrl: '/api/lumina/ai',
      aiProvider: 'openai',
      aiModel: '',
      autosaveMs: 900
    };
  }

  function defaultProject() {
    const t = nowIso();
    return normalizeProject({
      schema: SCHEMA,
      id: uid('project'),
      projectId: uid('project'),
      stage: STAGE,
      name: 'Untitled Lumina LaTeX Project',
      title: 'Untitled Lumina LaTeX Project',
      rootFile: 'main.tex',
      mainFile: 'main.tex',
      activePath: 'main.tex',
      createdAt: t,
      updatedAt: t,
      settings: defaultSettings(),
      meta: {
        app: 'lumina-latex-editor',
        architectureStage: 'stage1g-texlyre-direct-mode-startup-hotfix',
        collaborationReady: true,
        websocketReady: true
      },
      files: [
        makeFile('main.tex', DEFAULT_MAIN_TEX, t),
        makeFile('refs.bib', DEFAULT_BIB, t),
        makeFile('notes/todo.tex', String.raw`% Notes for this project
% TODO: Add related work notes here.
`, t)
      ]
    });
  }

  function makeFile(path, text = '', updatedAt = nowIso()) {
    const normalized = normalizePath(path);
    return {
      schema: FILE_SCHEMA,
      id: uid('file'),
      path: normalized,
      kind: fileKind(normalized),
      text: String(text ?? ''),
      encoding: 'utf8',
      updatedAt,
      version: 1
    };
  }

  function normalizeProject(input) {
    const t = nowIso();
    const project = input && typeof input === 'object' ? clone(input) : {};
    const files = Array.isArray(project.files) ? project.files : [];
    project.schema = project.schema || SCHEMA;
    project.id = project.id || project.projectId || uid('project');
    project.projectId = project.projectId || project.id;
    project.stage = project.stage || STAGE;
    project.name = String(project.name || project.title || 'Untitled Lumina LaTeX Project');
    project.title = String(project.title || project.name);
    project.createdAt = project.createdAt || t;
    project.updatedAt = project.updatedAt || t;
    project.settings = Object.assign(defaultSettings(), project.settings || {});
    project.meta = Object.assign({ app: 'lumina-latex-editor', architectureStage: 'stage1g-texlyre-direct-mode-startup-hotfix' }, project.meta || {});
    project.files = files.map((file) => normalizeFile(file)).filter(Boolean);
    if (!project.files.length) project.files = defaultProject().files;
    project.files.sort((a, b) => a.path.localeCompare(b.path));
    project.rootFile = normalizePath(project.rootFile || project.mainFile || firstTexPath(project.files) || project.files[0]?.path || 'main.tex');
    project.mainFile = project.rootFile;
    project.activePath = normalizePath(project.activePath || project.rootFile || project.files[0]?.path);
    if (!project.files.some((file) => file.path === project.activePath)) project.activePath = project.files[0]?.path || project.rootFile;
    if (!project.files.some((file) => file.path === project.rootFile && file.kind === 'tex')) project.rootFile = firstTexPath(project.files) || project.files[0]?.path || 'main.tex';
    project.mainFile = project.rootFile;
    return project;
  }

  function normalizeFile(file) {
    if (!file || typeof file !== 'object') return null;
    const path = normalizePath(file.path || file.name || 'untitled.tex');
    if (!path) return null;
    const t = file.updatedAt || nowIso();
    const kind = file.kind || fileKind(path);
    const encoding = file.encoding || (file.base64 ? 'base64' : 'utf8');
    return {
      schema: file.schema || FILE_SCHEMA,
      id: file.id || uid('file'),
      path,
      kind,
      text: encoding === 'base64' ? '' : String(file.text ?? file.content ?? ''),
      base64: encoding === 'base64' ? String(file.base64 ?? file.content ?? file.text ?? '') : '',
      encoding,
      updatedAt: t,
      version: Number(file.version || 1)
    };
  }

  function firstTexPath(files) {
    return (files || []).find((file) => file.kind === 'tex')?.path || null;
  }

  function toCompilePayload(project, settings = {}) {
    const normalized = normalizeProject(project);
    const mergedSettings = Object.assign(defaultSettings(), normalized.settings || {}, settings || {});
    return {
      schema: 'lumina-latex-compile-request-v1',
      projectId: normalized.projectId || normalized.id,
      projectName: normalized.name,
      rootFile: normalized.rootFile,
      mainFile: normalized.rootFile,
      engine: mergedSettings.engine || 'pdflatex',
      bibliography: mergedSettings.bibliography || 'bibtex',
      shellEscape: !!mergedSettings.shellEscape,
      compilerMode: mergedSettings.compilerMode || 'backend-texlive',
      files: normalized.files.map((file) => ({
        id: file.id,
        path: file.path,
        kind: file.kind,
        text: textFile(file) ? file.text || '' : '',
        base64: textFile(file) ? '' : (file.base64 || ''),
        encoding: textFile(file) ? 'utf8' : (file.encoding === 'base64' ? 'base64' : 'utf8')
      })),
      client: {
        app: 'lumina-latex-editor',
        stage: STAGE,
        sentAt: nowIso()
      }
    };
  }

  function summarize(project) {
    const normalized = normalizeProject(project);
    return {
      schema: normalized.schema,
      projectId: normalized.projectId,
      name: normalized.name,
      rootFile: normalized.rootFile,
      activePath: normalized.activePath,
      fileCount: normalized.files.length,
      texFiles: normalized.files.filter((f) => f.kind === 'tex').length,
      assetFiles: normalized.files.filter((f) => !textFile(f)).length,
      updatedAt: normalized.updatedAt
    };
  }

  NS.ProjectModel = {
    STAGE,
    SCHEMA,
    FILE_SCHEMA,
    DEFAULT_MAIN_TEX,
    DEFAULT_BIB,
    uid,
    nowIso,
    clone,
    normalizePath,
    fileKind,
    textFile,
    defaultSettings,
    defaultProject,
    makeFile,
    normalizeProject,
    normalizeFile,
    toCompilePayload,
    summarize
  };
})();
