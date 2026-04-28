(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

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
    for (const file of project.files) {
      const row = document.createElement('div');
      row.className = `file-row${file.path === project.activePath ? ' active' : ''}`;
      row.dataset.path = file.path;

      const main = document.createElement('button');
      main.className = 'file-main';
      main.type = 'button';
      main.title = file.path;
      main.innerHTML = `<span class="file-icon">${escapeHtml(iconFor(file))}</span><span class="file-name">${escapeHtml(file.path)}</span>`;
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

  function renderRootSelect() {
    const root = document.getElementById('rootFileSelect');
    if (!root) return;
    const { project } = State().state;
    const texFiles = project.files.filter((f) => f.kind === 'tex');
    root.innerHTML = texFiles.map((f) => `<option value="${escapeHtml(f.path)}">${escapeHtml(f.path)}</option>`).join('');
    if (texFiles.some((f) => f.path === project.rootFile)) root.value = project.rootFile;
  }

  function bind() {
    document.getElementById('newFileBtn')?.addEventListener('click', () => {
      const path = prompt('New file path', 'sections/new-section.tex');
      if (!path) return;
      const ext = path.toLowerCase().split('.').pop();
      let starter = '';
      if (ext === 'tex') starter = '% New LaTeX file\n';
      if (ext === 'bib') starter = '@article{key,\n  title={},\n  author={},\n  year={}\n}\n';
      if (!State().createFile(path, starter)) alert('Could not create file. It may already exist.');
    });

    document.getElementById('addTemplateBtn')?.addEventListener('click', () => {
      const template = prompt('Add template: article, beamer, homework, theorem-envs', 'beamer');
      if (!template) return;
      addTemplate(template.trim().toLowerCase());
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

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  NS.FileTree = { bind, render, renderRootSelect, addTemplate };
})();
