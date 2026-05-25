(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});

  function init() {
    NS.Kernel?.mark?.('main:init');
    bindRightTabs();
    NS.State.load();
    NS.Editor.init();
    NS.FileTree.bind();
    NS.FileTree.render();
    NS.Preview.init();
    NS.CompilerProvider?.init?.();
    NS.ImportExport.init();
    NS.PatchManager?.init?.();
    NS.Copilot.init();
    NS.Diagnostics.init();
    bindTopActions();
    renderStage();
    updateProjectTitle();
    NS.State.subscribe((snapshot, reason) => {
      if (['project-rename','load','reset','save'].includes(reason)) updateProjectTitle();
      if (reason === 'settings') NS.State.save();
    });
    setTimeout(() => {
      const report = NS.Diagnostics.run();
      console.info('Lumina LaTeX diagnostics', report);
    }, 250);
  }

  function bindRightTabs() {
    // Stage 8D: dynamic tab handling. Later modules can add tabs such as
    // Figures/assets after startup; clicking any right tab must close all
    // other right-tab panels, not only the original four.
    document.addEventListener('click', (event) => {
      const button = event.target?.closest?.('[data-right-tab]');
      if (!button) return;
      const id = button.dataset.rightTab;
      document.querySelectorAll('[data-right-tab]').forEach((b) => b.classList.toggle('active', b === button));
      document.querySelectorAll('.right-tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `${id}Tab`));
    }, true);
  }

  function bindTopActions() {
    document.getElementById('newProjectBtn')?.addEventListener('click', createNewProjectWorkflow);
    document.getElementById('saveProjectBtn')?.addEventListener('click', () => {
      NS.State.save();
      toast('Saved locally.');
    });
  }


  async function createNewProjectWorkflow() {
    const currentName = NS.State.state.project?.name || 'Untitled Lumina LaTeX Project';
    const name = prompt('New project name', 'Untitled Latexai Project');
    if (!name || !String(name).trim()) return;
    const cleanName = String(name).trim();
    const suggestedRepo = NS.FileTree?.sanitizeRepoName?.(cleanName) || cleanName.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'latexai-project';
    const repoName = prompt('New GitHub repository name', suggestedRepo);
    if (!repoName || !String(repoName).trim()) return;

    const message = [
      `Create new project “${cleanName}”?`,
      '',
      `This will replace the active local project “${currentName}”.`,
      'Backend/API settings will be kept.',
      `A new GitHub repository named “${String(repoName).trim()}” will be created and used for this project.`
    ].join('\n');
    if (!confirm(message)) return;

    const btn = document.getElementById('newProjectBtn');
    const oldText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
    try {
      const settings = Object.assign({}, NS.State.state.settings || {}, NS.State.state.project?.settings || {});
      const project = NS.State.defaultProject();
      project.name = cleanName;
      project.title = cleanName;
      project.projectId = NS.ProjectModel?.uid?.('project') || project.projectId;
      project.id = project.projectId;
      project.createdAt = NS.ProjectModel?.nowIso?.() || new Date().toISOString();
      project.updatedAt = project.createdAt;
      project.settings = settings;
      project.meta = Object.assign({}, project.meta || {}, {
        architectureStage: 'stage19d-github-save-checkpoint-workflow',
        cleanNewProject: true,
        previousProjectName: currentName
      });
      project.files = (project.files || []).map((file) => {
        if (file.path !== 'main.tex') return file;
        return Object.assign({}, file, {
          text: String(file.text || '')
            .replace(/\title\{[^}]*\}/, `\\title{${escapeLatexTitle(cleanName)}}`)
        });
      });

      toast('Creating GitHub repository…');
      const gh = await NS.FileTree?.createProjectRepository?.(project, {
        repoName: String(repoName).trim(),
        private: true,
        message: `Latexai new project: ${cleanName}`
      });
      if (!gh?.github?.owner || !gh?.github?.repo) throw new Error('GitHub repository was not created.');
      project.github = Object.assign({}, gh.github);
      project.meta.github = Object.assign({}, gh.github);
      NS.State.resetProjectClean ? NS.State.resetProjectClean(project, { preserveSettings: true }) : NS.State.resetProject(project);
      NS.FileTree?.render?.();
      NS.Preview?.renderDraftPreview?.();
      toast(`New project created: ${gh.github.owner}/${gh.github.repo}`);
    } catch (err) {
      alert(`New project failed:\n${err?.message || err}\n\nNo local project reset was performed.`);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldText || 'New project'; }
    }
  }

  function escapeLatexTitle(value) {
    return String(value || '')
      .replace(/([#$%&_{}])/g, '\\$1')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }

  function renderStage() {
    const badge = document.getElementById('stageBadge');
    if (badge) badge.textContent = (W.LUMINA_LATEX_STAGE || 'latex-stage1f').replace('-foundation-20260427-1', '').replace('-20260427-1', '');
  }

  function updateProjectTitle() {
    const title = document.getElementById('projectTitleDisplay');
    if (title) title.textContent = NS.State.state.project.name || 'Untitled LaTeX Project';
  }

  let toastTimer = null;
  function toast(message) {
    clearTimeout(toastTimer);
    let el = document.getElementById('luminaToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'luminaToast';
      el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:9999;background:#0f172a;color:#fff;border-radius:999px;padding:.7rem 1rem;font:800 13px system-ui;box-shadow:0 18px 45px rgba(15,23,42,.22);';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
  }

  NS.Main = { init, toast };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
