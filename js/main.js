(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});

  function init() {
    bindRightTabs();
    NS.State.load();
    NS.Editor.init();
    NS.FileTree.bind();
    NS.FileTree.render();
    NS.Preview.init();
    NS.ImportExport.init();
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
    const buttons = Array.from(document.querySelectorAll('[data-right-tab]'));
    const panels = {
      preview: document.getElementById('previewTab'),
      logs: document.getElementById('logsTab'),
      copilot: document.getElementById('copilotTab'),
      settings: document.getElementById('settingsTab')
    };
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.rightTab;
        buttons.forEach((b) => b.classList.toggle('active', b === button));
        Object.entries(panels).forEach(([key, panel]) => panel?.classList.toggle('active', key === id));
      });
    });
  }

  function bindTopActions() {
    document.getElementById('newProjectBtn')?.addEventListener('click', () => {
      if (!confirm('Start a new LaTeX project? Current local changes should already be autosaved, but this will replace the active project.')) return;
      NS.State.resetProject(NS.State.defaultProject());
      toast('New project created.');
    });
    document.getElementById('saveProjectBtn')?.addEventListener('click', () => {
      NS.State.save();
      toast('Saved locally.');
    });
  }

  function renderStage() {
    const badge = document.getElementById('stageBadge');
    if (badge) badge.textContent = (W.LUMINA_LATEX_STAGE || 'latex-stage1a').replace('-20260427-1', '');
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
