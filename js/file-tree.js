(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

  const GIT_SETTINGS_KEY = 'lumina-latex-editor.github-sync.v1';
  const FULL_PROJECT_CACHE_KEY = 'lumina-latex-editor.full-project-cache.v1';
  const DEFAULT_GITHUB_BACKEND = 'https://lumina-github-sync-backend-y4piylmfja-ue.a.run.app/api/lumina/github';

  const git = {
    setupOpen: false,
    backendBase: DEFAULT_GITHUB_BACKEND,
    owner: '',
    repo: '',
    branch: 'main',
    rootPath: '',
    headSha: null,
    commitMessage: '',
    status: 'GitHub sync ready.'
  };

  function loadGitSettings() {
    const keys = [
      GIT_SETTINGS_KEY,
      'latexai.step3g.github.settings.v1',
      'latexai.step3f.github.settings.v1',
      'latexai.step3e.directGithub.settings.v1',
      'latexai.step3.github.settings.v1'
    ];
    for (const key of keys) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        if (parsed && typeof parsed === 'object') {
          Object.assign(git, {
            backendBase: parsed.backendBase || git.backendBase,
            owner: parsed.owner || git.owner,
            repo: parsed.repo || git.repo,
            branch: parsed.branch || git.branch || 'main',
            rootPath: normalizeRepoPath(parsed.rootPath || git.rootPath || ''),
            headSha: parsed.headSha || parsed.lastCommitSha || git.headSha || null,
            commitMessage: String(parsed.commitMessage || git.commitMessage || ''),
            setupOpen: !!parsed.setupOpen
          });
          break;
        }
      } catch (_err) {}
    }
  }

  function saveGitSettings() {
    localStorage.setItem(GIT_SETTINGS_KEY, JSON.stringify({
      backendBase: git.backendBase || DEFAULT_GITHUB_BACKEND,
      owner: git.owner || '',
      repo: git.repo || '',
      branch: git.branch || 'main',
      rootPath: normalizeRepoPath(git.rootPath || ''),
      headSha: git.headSha || null,
      commitMessage: String(git.commitMessage || ''),
      setupOpen: !!git.setupOpen,
      savedAt: new Date().toISOString()
    }));
  }

  function iconFor(file) {
    if (!file) return '·';
    if (file.path.endsWith('.tex')) return 'T';
    if (file.path.endsWith('.bib')) return 'B';
    if (file.path.endsWith('.sty')) return 'S';
    if (file.kind === 'asset') return '▧';
    return '•';
  }

  function render() {
    const tree = document.getElementById('fileTree');
    if (!tree) return;
    const { project } = State().state;
    tree.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'file-tree-git-header';
    header.style.marginBottom = '0.45rem';

    const title = document.createElement('div');
    title.style.display = 'flex';
    title.style.justifyContent = 'space-between';
    title.style.alignItems = 'center';
    title.style.gap = '0.5rem';

    const titleText = document.createElement('div');
    titleText.innerHTML = `<strong>Project files</strong><br><span style="font-size:11px;opacity:.72">${project.files.length} files${State().state.dirty ? ' • unsaved' : ''} • Stage 6D</span>`;

    const gitToggle = button(git.setupOpen ? 'Hide Git' : 'Git', () => {
      git.setupOpen = !git.setupOpen;
      saveGitSettings();
      render();
    }, 'btn mini');

    title.append(titleText, gitToggle);
    header.appendChild(title);

    if (git.setupOpen) header.appendChild(renderGitSetup());

    header.appendChild(renderCommitMessageBox());

    const actions = document.createElement('div');
    actions.className = 'git-actions';
    actions.style.display = 'flex';
    actions.style.flexWrap = 'wrap';
    actions.style.gap = '0.25rem';
    actions.style.marginTop = '0.4rem';
    actions.append(
      button('Check', checkGithubBackend, 'btn mini'),
      button('Load', loadFromGithub, 'btn mini'),
      button('Commit', commitAllToGithub, 'btn mini')
    );
    header.appendChild(actions);

    const status = document.createElement('div');
    status.className = 'git-status';
    status.style.cssText = 'white-space:pre-wrap;font-size:11px;line-height:1.25;background:rgba(255,255,255,.62);border-radius:9px;padding:6px;margin-top:6px;max-height:78px;overflow:auto;';
    status.textContent = git.status || 'GitHub sync ready.';
    header.appendChild(status);

    tree.appendChild(header);

    const sorted = [...project.files].sort((a, b) => a.path.localeCompare(b.path));
    let lastFolder = '';
    for (const file of sorted) {
      const folder = folderOf(file.path);
      if (folder && folder !== lastFolder) {
        const folderRow = document.createElement('div');
        folderRow.className = 'file-folder-row';
        folderRow.textContent = `▾ ${folder}`;
        folderRow.style.cssText = 'font:700 11px system-ui;color:#526070;margin-top:6px;padding:3px 6px;';
        tree.appendChild(folderRow);
        lastFolder = folder;
      }

      const row = document.createElement('div');
      row.className = `file-row${file.path === project.activePath ? ' active' : ''}`;
      row.dataset.path = file.path;

      const main = document.createElement('button');
      main.className = 'file-main';
      main.type = 'button';
      main.title = file.path;
      const displayName = folder ? basename(file.path) : file.path;
      main.innerHTML = `<span class="file-icon">${escapeHtml(iconFor(file))}</span><span class="file-name">${escapeHtml(displayName)}</span>`;
      main.addEventListener('click', () => State().setActivePath(file.path));

      const actions = document.createElement('div');
      actions.className = 'file-actions';

      const rename = document.createElement('button');
      rename.type = 'button';
      rename.title = 'Rename file';
      rename.textContent = '✎';
      rename.addEventListener('click', (event) => {
        event.stopPropagation();
        const next = prompt('Rename file', file.path);
        if (!next) return;
        if (!State().renameFile(file.path, next)) alert('Could not rename file. Check for duplicates or invalid path.');
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.title = 'Delete file';
      remove.textContent = '×';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        if (confirm(`Delete ${file.path}?`)) State().removeFile(file.path);
      });

      actions.append(rename, remove);
      row.append(main, actions);
      tree.appendChild(row);
    }

    renderRootSelect();
  }

  function defaultCommitMessage(date = new Date()) {
    return `Latexai save: ${date.toISOString()}`;
  }

  function commitMessageForGithub(date = new Date()) {
    const custom = String(git.commitMessage || '').trim();
    return custom || defaultCommitMessage(date);
  }

  function renderCommitMessageBox() {
    const wrap = document.createElement('label');
    wrap.className = 'git-commit-message-wrap';
    wrap.style.cssText = 'display:block;font-size:11px;font-weight:700;margin-top:7px;';
    const caption = document.createElement('div');
    caption.textContent = 'Commit message (optional)';
    const input = document.createElement('input');
    input.id = 'gitCommitMessageInput';
    input.type = 'text';
    input.value = git.commitMessage || '';
    input.placeholder = 'Default: Latexai save: current timestamp';
    input.autocomplete = 'off';
    input.style.cssText = 'width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.18);border-radius:9px;padding:6px;margin-top:3px;font-size:12px;background:rgba(255,255,255,.86);';
    wrap.append(caption, input);
    setTimeout(bindGitCommitMessageInput, 0);
    return wrap;
  }

  function bindGitCommitMessageInput() {
    const input = document.getElementById('gitCommitMessageInput');
    if (!input || input.__gitCommitMessageBound) return;
    const update = () => {
      git.commitMessage = String(input.value || '');
      saveGitSettings();
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    input.addEventListener('blur', update);
    input.__gitCommitMessageBound = true;
  }

  function renderGitSetup() {
    const box = document.createElement('div');
    box.className = 'git-setup';
    box.style.cssText = 'display:grid;gap:4px;margin-top:8px;';
    box.append(
      labeledInput('GitHub backend URL', 'gitBackendInput', git.backendBase || DEFAULT_GITHUB_BACKEND),
      labeledInput('Owner / org', 'gitOwnerInput', git.owner || ''),
      labeledInput('Repo', 'gitRepoInput', git.repo || ''),
      labeledInput('Branch', 'gitBranchInput', git.branch || 'main'),
      labeledInput('Folder path in repo', 'gitRootPathInput', git.rootPath || '')
    );
    setTimeout(bindGitSetupInputs, 0);
    return box;
  }

  function labeledInput(label, id, value) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:block;font-size:11px;font-weight:700;';
    const input = document.createElement('input');
    input.id = id;
    input.type = 'text';
    input.value = value || '';
    input.style.cssText = 'width:100%;box-sizing:border-box;border:1px solid rgba(0,0,0,.18);border-radius:7px;padding:5px;margin-top:2px;';
    wrap.append(document.createTextNode(label), input);
    return wrap;
  }

  function bindGitSetupInputs() {
    const fields = {
      gitBackendInput: 'backendBase',
      gitOwnerInput: 'owner',
      gitRepoInput: 'repo',
      gitBranchInput: 'branch',
      gitRootPathInput: 'rootPath'
    };
    Object.entries(fields).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el || el.__gitBound) return;
      const update = () => {
        git[key] = key === 'rootPath' ? normalizeRepoPath(el.value) : String(el.value || '').trim();
        if (key === 'branch' && !git[key]) git[key] = 'main';
        saveGitSettings();
      };
      el.addEventListener('change', update);
      el.addEventListener('blur', update);
      el.__gitBound = true;
    });
  }

  function renderRootSelect() {
    const root = document.getElementById('rootFileSelect');
    if (!root) return;
    const { project } = State().state;
    const texFiles = project.files.filter((f) => f.kind === 'tex');
    root.innerHTML = texFiles.map((f) => `<option value="${escapeHtml(f.path)}">${escapeHtml(f.path)}</option>`).join('');
    if (texFiles.some((f) => f.path === project.rootFile)) root.value = project.rootFile;
  }

  function bind() {
    loadGitSettings();

    document.getElementById('newFileBtn')?.addEventListener('click', () => {
      const path = prompt('New file path', 'sections/new-section.tex');
      if (!path) return;
      const ext = path.toLowerCase().split('.').pop();
      let starter = '';
      if (ext === 'tex') starter = '% New LaTeX file\n';
      if (ext === 'bib') starter = '@article{key,\n  title={},\n  author={},\n  year={}\n}\n';
      if (!State().createFile(path, starter)) alert('Could not create file. It may already exist.');
      else {
        State().save();
        W.LuminaLatex.Main?.toast?.('File added.');
      }
    });

    document.getElementById('addTemplateBtn')?.addEventListener('click', () => {
      const template = prompt('Add template: article, beamer, homework, theorem-envs', 'beamer');
      if (!template) return;
      addTemplate(template.trim().toLowerCase());
      State().save();
    });

    document.getElementById('renameProjectBtn')?.addEventListener('click', () => {
      const name = prompt('Project name', State().state.project.name);
      if (name) State().renameProject(name);
    });

    document.getElementById('rootFileSelect')?.addEventListener('change', (event) => {
      State().setRootFile(event.target.value);
      State().save();
    });

    State().subscribe((snapshot, reason) => {
      if (['load','reset','active-file','file-change','file-create','file-remove','file-rename','file-import-overwrite','project-rename','settings','save'].includes(reason)) {
        render();
        updateProjectTitle();
      }
    });
  }

  async function checkGithubBackend() {
    try {
      pullGitSetup();
      git.status = 'Checking GitHub backend...';
      render();
      const status = await gitFetch('/status');
      git.status = `Backend: ${status.ok ? 'online' : 'not ok'}\nToken: ${status.githubTokenConfigured ? 'configured' : 'missing'}\nStage: ${status.stage || ''}`;
      render();
    } catch (err) {
      git.status = `Backend check failed:\n${err.message || err}`;
      render();
    }
  }

  async function loadFromGithub() {
    try {
      pullGitSetup();
      if (!git.owner || !git.repo) throw new Error('Owner and repo are required.');
      git.status = 'Loading from GitHub...';
      render();

      const result = await gitFetch('/load-project', {
        owner: git.owner,
        repo: git.repo,
        branch: git.branch || 'main',
        rootPath: normalizeRepoPath(git.rootPath || '')
      });

      if (!result.project || !result.project.files) throw new Error('Backend returned no project.files.');

      const nextProject = Object.assign({}, result.project, {
        github: {
          owner: git.owner,
          repo: git.repo,
          branch: git.branch || 'main',
          rootPath: normalizeRepoPath(git.rootPath || ''),
          headSha: result.headSha || null
        }
      });

      git.headSha = result.headSha || null;
      git.status = `Loaded ${result.fileCount || Object.keys(result.project.files || {}).length} files from GitHub.`;
      saveGitSettings();
      State().resetProject(nextProject);
      State().rememberFullProject?.(State().state.project, 'github-load');
      State().save();
      W.LuminaLatex.Preview?.renderDraftPreview?.();
      W.LuminaLatex.Main?.toast?.('GitHub project loaded.');
    } catch (err) {
      git.status = `Load failed:\n${err.message || err}`;
      render();
    }
  }

  async function commitAllToGithub() {
    try {
      pullGitSetup();
      if (!git.owner || !git.repo) throw new Error('Owner and repo are required.');
      State().mergeFullProjectCacheIntoCurrent?.('pre-github-commit');
      State().save();

      const project = State().state.project;
      const files = {};
      for (const file of project.files) files[file.path] = fileContentForGithub(file);

      const paths = Object.keys(files).sort();
      if (!paths.length) throw new Error('No files to commit.');

      const message = commitMessageForGithub();
      git.status = `Committing ${paths.length} files...\nMessage: ${message}`;
      render();

      const result = await gitFetch('/autosave-commit', {
        owner: git.owner,
        repo: git.repo,
        branch: git.branch || 'main',
        rootPath: normalizeRepoPath(git.rootPath || ''),
        expectedHeadSha: git.headSha || project.github?.headSha || null,
        message,
        project,
        files
      });

      git.headSha = result.commitSha || git.headSha;
      git.status = `Committed ${result.fileCount || paths.length} files.\nMessage: ${message}\nCommit: ${result.commitSha || 'unknown'}`;
      saveGitSettings();
      State().state.project.github = Object.assign({}, project.github || {}, {
        owner: git.owner,
        repo: git.repo,
        branch: git.branch || 'main',
        rootPath: normalizeRepoPath(git.rootPath || ''),
        headSha: git.headSha
      });
      State().save();
      W.LuminaLatex.Main?.toast?.('Committed to GitHub.');
    } catch (err) {
      git.status = `Commit failed:\n${err.message || err}`;
      render();
    }
  }

  function pullGitSetup() {
    const backend = document.getElementById('gitBackendInput');
    const owner = document.getElementById('gitOwnerInput');
    const repo = document.getElementById('gitRepoInput');
    const branch = document.getElementById('gitBranchInput');
    const rootPath = document.getElementById('gitRootPathInput');
    const commitMessage = document.getElementById('gitCommitMessageInput');
    if (backend) git.backendBase = String(backend.value || '').trim() || DEFAULT_GITHUB_BACKEND;
    if (owner) git.owner = String(owner.value || '').trim();
    if (repo) git.repo = String(repo.value || '').trim();
    if (branch) git.branch = String(branch.value || '').trim() || 'main';
    if (rootPath) git.rootPath = normalizeRepoPath(rootPath.value);
    if (commitMessage) git.commitMessage = String(commitMessage.value || '');
    saveGitSettings();
  }

  async function gitFetch(path, body) {
    const url = String(git.backendBase || DEFAULT_GITHUB_BACKEND).replace(/\/$/, '') + path;
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_err) { data = { raw: text }; }
    if (!response.ok) {
      const detail = data.detail || data.message || data.raw || `HTTP ${response.status}`;
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    return data;
  }

  function fileContentForGithub(file) {
    if (file.encoding === 'base64' && file.base64) {
      return `data:${mimeForPath(file.path)};base64,${file.base64}`;
    }
    return file.text || '';
  }

  function mimeForPath(path) {
    const lower = String(path || '').toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.eps')) return 'application/postscript';
    return 'application/octet-stream';
  }

  function button(label, action, className) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className || 'btn mini';
    b.textContent = label;
    b.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      action();
    });
    return b;
  }

  function addTemplate(kind) {
    if (kind === 'beamer') {
      State().createFile('beamer-talk.tex', String.raw`\documentclass{beamer}
\usetheme{Madrid}
\title{Lumina Beamer Talk}
\author{Karthik Sridharan}
\date{\today}
\begin{document}
\begin{frame}
  \titlepage
\end{frame}
\begin{frame}{Main idea}
  \begin{itemize}
    \item First point
    \item Second point
  \end{itemize}
\end{frame}
\end{document}
`);
      return;
    }
    if (kind === 'homework') {
      State().createFile('homework.tex', String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath,amssymb}
\title{Homework}
\author{}
\date{}
\begin{document}
\maketitle
\section*{Problem 1}
Solution.
\end{document}
`);
      return;
    }
    if (kind === 'theorem-envs') {
      State().createFile('preamble/theorems.sty', String.raw`\NeedsTeXFormat{LaTeX2e}
\ProvidesPackage{theorems}
\RequirePackage{amsthm}
\newtheorem{theorem}{Theorem}
\newtheorem{lemma}{Lemma}
\newtheorem{corollary}{Corollary}
\theoremstyle{definition}
\newtheorem{definition}{Definition}
`);
      return;
    }
    State().createFile('article-template.tex', State().defaultProject().files[0].text);
  }

  function updateProjectTitle() {
    const title = document.getElementById('projectTitleDisplay');
    if (title) title.textContent = State().state.project.name || 'Untitled LaTeX Project';
  }

  function basename(path) {
    return String(path || '').split('/').pop() || path;
  }

  function folderOf(path) {
    const parts = String(path || '').split('/');
    parts.pop();
    return parts.join('/');
  }

  function normalizeRepoPath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  NS.FileTree = { bind, render, renderRootSelect, addTemplate, loadFromGithub, commitAllToGithub, checkGithubBackend, defaultCommitMessage, commitMessageForGithub };
})();
