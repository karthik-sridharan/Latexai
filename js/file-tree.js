(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

  const GIT_SETTINGS_KEY = 'lumina-latex-editor.github-sync.v1';
  const FULL_PROJECT_CACHE_KEY = 'lumina-latex-editor.full-project-cache.v1';
  const DEFAULT_GITHUB_BACKEND = 'https://lumina-github-sync-backend-y4piylmfja-ue.a.run.app/api/lumina/github';
  const STAGE = 'stage19w34-github-load-default-branch-probe-20260605-1';

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


  function logGithubReward(kind, result, options = {}) {
    try { return NS.RewardLoggingService?.logGithubOutcome?.(kind, result || {}, { metadata: { stage: STAGE, ...(options.metadata || {}) }, ...options }); }
    catch (_err) { return null; }
  }


  function settingsGithubBackend() {
    return NS.BackendUrlSettings?.getGithubBackendUrl?.() || '';
  }

  function activeGithubBackend() {
    const fromSettings = String(settingsGithubBackend() || '').trim();
    return fromSettings || git.backendBase || DEFAULT_GITHUB_BACKEND;
  }


  function githubTrace(event, detail = {}) {
    try {
      const root = W.LuminaLatex = W.LuminaLatex || {};
      const trace = root.__githubOpenTrace = Array.isArray(root.__githubOpenTrace) ? root.__githubOpenTrace : [];
      const entry = Object.assign({
        time: new Date().toISOString(),
        stage: STAGE,
        event
      }, detail || {});
      trace.push(entry);
      while (trace.length > 40) trace.shift();
      try { console.info('[Latexai GitHub trace]', entry); } catch (_err) {}
      return entry;
    } catch (_err) {
      return null;
    }
  }

  function summarizeGithubBody(body) {
    if (!body || typeof body !== 'object') return body || null;
    const out = {
      owner: body.owner || '',
      repo: body.repo || '',
      branch: body.branch || '',
      rootPath: body.rootPath || ''
    };
    if (body.message) out.message = String(body.message || '').slice(0, 160);
    if (body.private !== undefined) out.private = !!body.private;
    if (body.expectedHeadSha !== undefined) out.expectedHeadSha = body.expectedHeadSha || null;
    if (body.project) out.project = {
      name: body.project.name || body.project.title || '',
      rootFile: body.project.rootFile || body.project.activePath || '',
      fileCount: Array.isArray(body.project.files) ? body.project.files.length : undefined
    };
    if (body.files && typeof body.files === 'object') {
      const paths = Object.keys(body.files).sort();
      out.files = { count: paths.length, samplePaths: paths.slice(0, 12) };
    }
    return out;
  }

  function shortGithubTraceForAlert(extra = null) {
    const lines = [];
    if (extra?.request) {
      lines.push(`Request: ${extra.request.method || 'POST'} ${extra.request.url || ''}`);
      lines.push(`Payload: ${JSON.stringify(extra.request.body || {})}`);
    }
    const trace = (W.LuminaLatex.__githubOpenTrace || []).slice(-8);
    if (trace.length) {
      lines.push('Recent frontend GitHub trace:');
      trace.forEach((entry) => {
        const body = entry.body ? ` body=${JSON.stringify(entry.body)}` : '';
        const status = entry.status ? ` status=${entry.status}` : '';
        const msg = entry.message ? ` message=${String(entry.message).slice(0, 180)}` : '';
        lines.push(`- ${entry.event}${status}${msg}${body}`);
      });
    }
    return lines.join('\n');
  }

  function syncGitFromProject(project = null) {
    try {
      const gh = (project || State().state.project || {}).github || {};
      if (!gh || typeof gh !== 'object') return false;
      if (gh.owner && !git.owner) git.owner = String(gh.owner || '').trim();
      if (gh.repo && !git.repo) git.repo = String(gh.repo || '').trim();
      if (gh.branch && (!git.branch || git.branch === 'main')) git.branch = String(gh.branch || 'main').trim() || 'main';
      if (gh.rootPath && !git.rootPath) git.rootPath = normalizeRepoPath(gh.rootPath || '');
      if (gh.headSha && !git.headSha) git.headSha = String(gh.headSha || '').trim();
      if (gh.owner || gh.repo) {
        git.backendBase = activeGithubBackend();
        return true;
      }
    } catch (_err) {}
    return false;
  }

  function isGithubAttached() {
    syncGitFromProject();
    return Boolean((git.owner || '').trim() && (git.repo || '').trim());
  }

  function attachedRepoLabel() {
    syncGitFromProject();
    if (!git.owner || !git.repo) return 'not attached';
    const folder = normalizeRepoPath(git.rootPath || '');
    const branch = git.branch || 'main';
    return `${git.owner}/${git.repo}${folder ? '/' + folder : ''} @ ${branch}`;
  }

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
    syncGitFromProject();
    const fromSettings = settingsGithubBackend();
    if (fromSettings) git.backendBase = fromSettings;
  }

  function saveGitSettings() {
    localStorage.setItem(GIT_SETTINGS_KEY, JSON.stringify({
      backendBase: activeGithubBackend(),
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
    syncGitFromProject(project);
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
    titleText.innerHTML = `<strong>Project files</strong><br><span style="font-size:11px;opacity:.72">${project.files.length} files${State().state.dirty ? ' • unsaved' : ''} • GitHub: ${escapeHtml(attachedRepoLabel())} • Stage 19W34</span>`;

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
      button('Load attached', () => loadFromGithub({ source: 'load-attached-github-project' }), 'btn mini'),
      button('Open GitHub', promptOpenGithubProject, 'btn mini'),
      button('Save GitHub', commitAllToGithub, 'btn mini'),
      button('Checkpoint', promptCheckpointToGithub, 'btn mini')
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
      labeledInput('GitHub backend URL', 'gitBackendInput', activeGithubBackend()),
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

  function parseGithubRepoSpec(input) {
    let value = String(input || '').trim();
    if (!value) return null;
    value = value.replace(/^https?:\/\/github\.com\//i, '').replace(/^git@github\.com:/i, '').replace(/\.git$/i, '');
    value = value.replace(/^\/+|\/+$/g, '');
    const parts = value.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  }

  function stableHash(value) {
    const text = String(value || '');
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function githubIdentitySeed(gh = {}, rootFile = 'main.tex', titleGuess = '') {
    return [
      'github',
      String(gh.owner || '').trim().toLowerCase(),
      String(gh.repo || '').trim().toLowerCase(),
      String(gh.branch || 'main').trim() || 'main',
      normalizeRepoPath(gh.rootPath || ''),
      String(rootFile || 'main.tex').trim(),
      String(titleGuess || '').trim().slice(0, 180)
    ].join('\n');
  }

  function githubScopedIds(gh = {}, rootFile = 'main.tex', titleGuess = '') {
    const seed = githubIdentitySeed(gh, rootFile, titleGuess);
    const projectSeed = [String(gh.owner || '').trim().toLowerCase(), String(gh.repo || '').trim().toLowerCase(), normalizeRepoPath(gh.rootPath || '')].join('/');
    return {
      projectId: `github-project-${stableHash(projectSeed)}`,
      paperId: `github-paper-${stableHash(seed)}`,
      identitySeed: seed
    };
  }

  function guessTitleFromFiles(files = {}, rootFile = 'main.tex') {
    try {
      const text = String(files[rootFile] || Object.entries(files).find(([path]) => /\.tex$/i.test(path))?.[1] || '');
      const match = text.match(/\\title\s*(?:\[[^\]]*\])?\s*\{([\s\S]{0,500}?)\}/);
      return match ? String(match[1] || '').replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, '').replace(/[{}]/g, '').trim().slice(0, 180) : '';
    } catch (_err) { return ''; }
  }

  function applyGithubIdentity(project, gh) {
    if (!project || !gh?.owner || !gh?.repo) return project;
    const filesObj = Array.isArray(project.files)
      ? Object.fromEntries(project.files.map((file) => [file.path, file.text || '']))
      : (project.files || {});
    const rootFile = project.rootFile || 'main.tex';
    const titleGuess = guessTitleFromFiles(filesObj, rootFile) || project.name || `${gh.owner}/${gh.repo}`;
    const ids = githubScopedIds(gh, rootFile, titleGuess);
    project.projectId = ids.projectId;
    project.id = ids.projectId;
    project.paperId = ids.paperId;
    project.github = Object.assign({}, project.github || {}, gh);
    project.meta = Object.assign({}, project.meta || {}, {
      github: Object.assign({}, gh),
      githubIdentityStage: STAGE,
      githubIdentitySeed: ids.identitySeed,
      paperId: ids.paperId,
      openedFromGithubAt: new Date().toISOString()
    });
    return project;
  }

  async function promptOpenGithubProject() {
    loadGitSettings();
    syncGitFromProject();
    const existing = git.owner && git.repo ? `${git.owner}/${git.repo}` : '';
    const spec = prompt('Open GitHub project (owner/repo or GitHub URL)', existing || 'owner/repo');
    if (!spec || !String(spec).trim()) return { ok: false, cancelled: true };
    const parsed = parseGithubRepoSpec(spec);
    if (!parsed) {
      alert('Please enter a GitHub repository as owner/repo, or paste a https://github.com/owner/repo URL.');
      return { ok: false, error: 'invalid repo spec' };
    }
    const branch = prompt('Branch (leave blank to let backend use repository default)', git.branch || 'main');
    if (branch === null) return { ok: false, cancelled: true };
    const rootPath = prompt('Folder path inside repo (blank for repo root)', git.rootPath || '');
    if (rootPath === null) return { ok: false, cancelled: true };
    const currentName = State().state.project?.name || 'current local project';
    const message = [
      `Open ${parsed.owner}/${parsed.repo}${rootPath ? '/' + normalizeRepoPath(rootPath) : ''} @ ${branch || 'main'}?`,
      '',
      `This will replace the active local project “${currentName}”.`,
      'Backend/API settings will be kept.',
      'If the current project is important, use Save GitHub or Export zip first.'
    ].join('\n');
    if (!confirm(message)) return { ok: false, cancelled: true };
    git.owner = parsed.owner;
    git.repo = parsed.repo;
    git.branch = String(branch || '').trim();
    git.rootPath = normalizeRepoPath(rootPath || '');
    saveGitSettings();
    return loadFromGithub({ source: 'open-existing-github-project', preserveSettings: true, fromPrompt: true, alertSuccess: true });
  }

  function countProjectFiles(project) {
    const files = project?.files;
    if (Array.isArray(files)) return files.length;
    if (files && typeof files === 'object') return Object.keys(files).length;
    return 0;
  }

  function coerceGithubProjectResult(result, github) {
    if (!result || typeof result !== 'object') throw new Error('GitHub backend returned an empty response.');
    const rawProject = result.project || result.latexProject || result.data?.project || null;
    const rawFiles = rawProject?.files || result.files || result.fileMap || result.projectFiles || null;
    if (!rawFiles || countProjectFiles({ files: rawFiles }) < 1) {
      throw new Error('GitHub backend returned no project files. Check the repository branch/folder path and supported file types.');
    }
    const project = Object.assign({}, rawProject || {}, {
      schema: rawProject?.schema || 'lumina-latex-project-v1',
      name: rawProject?.name || `${github.owner}/${github.repo}${github.rootPath ? '/' + github.rootPath : ''}`,
      rootFile: rawProject?.rootFile || rawProject?.mainFile || result.rootFile || ('main.tex' in rawFiles ? 'main.tex' : ''),
      activePath: rawProject?.activePath || rawProject?.rootFile || result.rootFile || ('main.tex' in rawFiles ? 'main.tex' : ''),
      files: rawFiles,
      github
    });
    return W.LuminaLatex.ProjectModel?.normalizeProject?.(project) || project;
  }

  function refreshGithubProjectPanes(project, reason) {
    const state = State();
    const current = project || state?.state?.project || null;
    if (!current) return;
    try { W.LuminaLatex.Editor?.render?.(state.state); } catch (_err) {}
    try { render(); } catch (_err) {}
    try { renderRootSelect(); } catch (_err) {}
    try { W.LuminaLatex.Preview?.renderDraftPreview?.(); } catch (_err) {}
    try { W.LuminaLatex.CompileRootService?.render?.(); } catch (_err) {}
    try {
      const title = document.getElementById('projectTitleDisplay');
      if (title) title.textContent = current.name || current.title || 'GitHub project';
    } catch (_err) {}
    try {
      const active = state?.getActiveFile?.();
      const pill = document.getElementById('activeFilePill');
      if (pill) pill.textContent = active?.path || current.activePath || current.rootFile || 'main.tex';
    } catch (_err) {}
    try {
      // Some older GitHub helper panels wrote their own file list below the native
      // Source tree. They are not the source of truth after Stage 19E5, so mark
      // them stale to avoid confusing the user after opening a different repo.
      document.querySelectorAll('[data-lai-stable-github-file-list], .lai-stable-github-file-list, .lai-github-workspace, .lai-integrated-github-filetree')
        .forEach((el) => { el.dataset.stage19e4Stale = 'true'; el.style.display = 'none'; });
    } catch (_err) {}
    try { W.LuminaLatex.Main?.toast?.(`Loaded GitHub project: ${attachedRepoLabel()}`); } catch (_err) {}
    try { console.info('[Latexai Stage19E4] refreshed GitHub project panes', { reason, files: current.files?.map?.((f) => f.path) || [] }); } catch (_err) {}
  }

  function forceGithubProjectIntoUi(nextProject, reason) {
    const state = State();
    if (!state) throw new Error('State service is not ready.');
    const replace = state.replaceProjectFromExternalSource || state.resetProjectClean;
    if (typeof replace !== 'function') {
      throw new Error('Clean GitHub project replacement API is missing. Upload Stage 19E5 js/state.js.');
    }
    const loaded = replace.call(state, nextProject, { preserveSettings: true, reason: reason || 'github-open' });
    const project = loaded || state.state.project;
    const rootPath = project.rootFile || project.activePath || 'main.tex';
    state.setActivePath?.(rootPath);
    state.rememberFullProject?.(state.state.project, reason || 'github-open');
    try { document.getElementById('fileTree')?.replaceChildren(); } catch (_err) {}
    refreshGithubProjectPanes(state.state.project, reason || 'github-open');
    [0, 80, 250, 700, 1500].forEach((delay) => setTimeout(() => refreshGithubProjectPanes(State().state.project, `${reason || 'github-open'}:${delay}`), delay));
    try { document.getElementById('sourceEditor')?.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
    W.LuminaLatex.__lastOpenedGithubProject = state.state.project;
    return state.state.project;
  }

  async function loadFromGithub(options = {}) {
    try {
      const hasExplicitRepoSelection = !!(options.fromPrompt || options.owner || options.repo || options.branch || options.rootPath !== undefined);
      pullGitSetup({ keepRepoSelection: hasExplicitRepoSelection });
      if (options.owner) git.owner = String(options.owner || '').trim();
      if (options.repo) git.repo = String(options.repo || '').trim();
      if (options.branch) git.branch = String(options.branch || 'main').trim() || 'main';
      if (options.rootPath !== undefined) git.rootPath = normalizeRepoPath(options.rootPath || '');
      if (!git.owner || !git.repo) {
        if (!options.fromPrompt) return promptOpenGithubProject();
        throw new Error('Owner and repo are required. Enter owner/repo or paste a GitHub URL.');
      }
      git.status = `Loading from GitHub...
Repo: ${git.owner}/${git.repo}
Branch: ${git.branch || 'main'}${git.rootPath ? `
Folder: ${git.rootPath}` : ''}`;
      render();

      const rootPath = normalizeRepoPath(git.rootPath || '');
      const preferredBranch = String(git.branch || '').trim();
      const branchCandidates = [];
      const seenBranches = new Set();
      function pushCandidate(branch, label) {
        const key = branch ? `branch:${branch}` : 'backend-default';
        if (seenBranches.has(key)) return;
        seenBranches.add(key);
        const body = { owner: git.owner, repo: git.repo, rootPath };
        if (branch) body.branch = branch;
        branchCandidates.push({ label, branch, body });
      }
      pushCandidate(preferredBranch, preferredBranch ? `selected branch ${preferredBranch}` : 'backend/default branch');
      // Important diagnostic/probe path: old working flows could rely on the
      // backend/default branch. If the browser forces "main" and the repo uses a
      // different default branch, the backend's GitHub refs lookup returns 404.
      pushCandidate('', 'backend/default branch');
      ['main', 'master', 'gh-pages'].forEach((fallback) => pushCandidate(fallback, `fallback branch ${fallback}`));

      let result = null;
      let usedCandidate = null;
      const failures = [];
      for (const candidate of branchCandidates) {
        githubTrace('loadFromGithub-request-body', { candidate: candidate.label, body: summarizeGithubBody(candidate.body) });
        try {
          result = await gitFetch('/load-project', candidate.body);
          usedCandidate = candidate;
          break;
        } catch (candidateErr) {
          const message = candidateErr?.message || String(candidateErr);
          failures.push(`${candidate.label}: ${message}`);
          githubTrace('loadFromGithub-candidate-failed', { candidate: candidate.label, message: message.slice(0, 260) });
        }
      }
      if (!result) {
        const err = new Error(failures.join('\n') || 'All GitHub load candidates failed.');
        err.githubLoadFailures = failures;
        throw err;
      }

      const resolvedBranch = result.branch || result.project?.github?.branch || usedCandidate?.branch || preferredBranch || 'main';
      const github = {
        owner: git.owner,
        repo: git.repo,
        branch: resolvedBranch,
        rootPath,
        headSha: result.headSha || result.commitSha || result.project?.github?.headSha || null,
        openedAt: new Date().toISOString(),
        openStage: STAGE
      };

      const nextProject = applyGithubIdentity(coerceGithubProjectResult(result, github), github);
      const loadedProject = forceGithubProjectIntoUi(nextProject, options.source || 'github-open');

      git.branch = github.branch || git.branch || 'main';
      git.headSha = github.headSha || null;
      const fileCount = loadedProject.files?.length || result.fileCount || countProjectFiles(result.project || {});
      const rootFile = loadedProject.rootFile || loadedProject.activePath || 'main.tex';
      git.status = `Loaded ${fileCount} files from GitHub.
Repo: ${attachedRepoLabel()}
Root: ${rootFile}`;
      saveGitSettings();
      render();
      W.LuminaLatex.Main?.toast?.(`GitHub project opened: ${git.owner}/${git.repo}`);
      if (options.alertSuccess) alert(`GitHub project opened.

Repo: ${git.owner}/${git.repo}
Files: ${fileCount}
Root: ${rootFile}`);
      logGithubReward('open_project', { ok: true, fileCount, commitSha: github.headSha || '' }, { rewardValue: 0.35, metadata: { owner: git.owner, repo: git.repo, branch: git.branch || 'main', rootPath: git.rootPath || '' } });
      return { ok: true, project: loadedProject, result };
    } catch (err) {
      const message = err?.message || String(err);
      git.status = `Load failed:
${message}`;
      render();
      const traceText = shortGithubTraceForAlert({
        request: { method: 'POST', url: String(activeGithubBackend()).replace(/\/$/, '') + '/load-project', body: summarizeGithubBody(Object.assign({ owner: git.owner, repo: git.repo, rootPath: normalizeRepoPath(git.rootPath || '') }, git.branch ? { branch: git.branch } : {})) }
      });
      alert(`GitHub load failed:
${message}${traceText ? `\n\nFrontend trace:\n${traceText}` : ''}`);
      logGithubReward('open_project', { ok: false, error: message }, { rewardValue: -0.55, metadata: { owner: git.owner, repo: git.repo, branch: git.branch || 'main', rootPath: git.rootPath || '' } });
      return { ok: false, error: message };
    }
  }

  function projectFilesForGithub(project) {
    const files = {};
    for (const file of project.files || []) files[file.path] = fileContentForGithub(file);
    return files;
  }

  async function commitProjectToGithub(options = {}) {
    pullGitSetup();
    syncGitFromProject();
    if (!git.owner || !git.repo) {
      throw new Error('No GitHub repository is attached. Create a GitHub-backed project or load a project from GitHub first.');
    }
    State().mergeFullProjectCacheIntoCurrent?.(options.reason || 'pre-github-save');
    State().save();

    const project = State().state.project;
    const files = projectFilesForGithub(project);
    const paths = Object.keys(files).sort();
    if (!paths.length) throw new Error('No files to commit.');

    const message = String(options.message || '').trim() || commitMessageForGithub();
    if (options.updateStatus !== false) {
      git.status = `${options.statusPrefix || 'Saving'} ${paths.length} files to GitHub...\nRepo: ${attachedRepoLabel()}\nMessage: ${message}`;
      render();
    }

    const result = await gitFetch('/autosave-commit', {
      owner: git.owner,
      repo: git.repo,
      branch: git.branch || 'main',
      rootPath: normalizeRepoPath(git.rootPath || ''),
      expectedHeadSha: options.skipExpectedHead ? null : (options.expectedHeadSha || git.headSha || project.github?.headSha || null),
      message,
      project,
      files
    });

    git.headSha = result.commitSha || git.headSha;
    const github = Object.assign({}, project.github || {}, {
      owner: git.owner,
      repo: git.repo,
      branch: git.branch || 'main',
      rootPath: normalizeRepoPath(git.rootPath || ''),
      headSha: git.headSha,
      lastSavedAt: new Date().toISOString(),
      lastSaveMessage: message
    });
    State().state.project.github = github;
    State().state.project.meta = Object.assign({}, State().state.project.meta || {}, { github, lastGithubSaveStage: STAGE });
    saveGitSettings();
    State().save();
    if (options.updateStatus !== false) {
      git.status = `${options.donePrefix || 'Saved'} ${result.fileCount || paths.length} files to GitHub.\nRepo: ${attachedRepoLabel()}\nMessage: ${message}\nCommit: ${result.commitSha || 'unknown'}`;
      render();
    }
    return result;
  }

  async function commitAllToGithub() {
    try {
      const result = await commitProjectToGithub({
        reason: 'manual-github-save',
        statusPrefix: 'Saving',
        donePrefix: 'Saved'
      });
      W.LuminaLatex.Main?.toast?.(`Saved to GitHub: ${(result.commitSha || '').slice(0, 7) || 'commit created'}`);
      logGithubReward('save_github', result, { rewardValue: 0.65, metadata: { owner: git.owner, repo: git.repo, branch: git.branch || 'main' } });
      return result;
    } catch (err) {
      git.status = `GitHub save failed:\n${err.message || err}`;
      render();
      return { ok: false, error: err?.message || String(err) };
    }
  }

  function checkpointMessage(label = '') {
    const clean = String(label || '').trim();
    const suffix = clean ? clean.replace(/^checkpoint:\s*/i, '') : 'manual checkpoint';
    return `checkpoint: ${suffix} (${new Date().toISOString()})`;
  }

  async function createCheckpointToGithub(labelOrOptions = {}) {
    const options = typeof labelOrOptions === 'string' ? { label: labelOrOptions } : Object.assign({}, labelOrOptions || {});
    const message = options.message || checkpointMessage(options.label || options.reason || 'manual checkpoint');
    return commitProjectToGithub({
      reason: options.reason || 'github-checkpoint',
      message,
      statusPrefix: options.statusPrefix || 'Creating checkpoint for',
      donePrefix: options.donePrefix || 'Checkpointed',
      updateStatus: options.updateStatus !== false
    });
  }

  async function promptCheckpointToGithub() {
    try {
      const label = prompt('Checkpoint name', 'before major AI edit');
      if (label === null) return { ok: false, cancelled: true };
      const result = await createCheckpointToGithub({ label: label || 'manual checkpoint' });
      W.LuminaLatex.Main?.toast?.(`Checkpoint saved: ${(result.commitSha || '').slice(0, 7) || 'commit created'}`);
      logGithubReward('checkpoint', result, { rewardValue: 0.7, metadata: { owner: git.owner, repo: git.repo, branch: git.branch || 'main', checkpointLabel: label || '' } });
      return result;
    } catch (err) {
      git.status = `Checkpoint failed:\n${err.message || err}`;
      render();
      return { ok: false, error: err?.message || String(err) };
    }
  }

  async function autoCheckpointBeforeRiskyAction(reason = 'risky AI action', options = {}) {
    try {
      loadGitSettings();
      syncGitFromProject();
      if (!isGithubAttached()) {
        return { ok: false, skipped: true, reason: 'No GitHub repository attached.' };
      }
      const message = options.message || checkpointMessage(`before ${reason}`);
      const result = await createCheckpointToGithub({
        reason: `auto-checkpoint:${reason}`,
        message,
        statusPrefix: 'Auto-checkpointing before',
        donePrefix: 'Auto-checkpoint created for',
        updateStatus: options.updateStatus !== false
      });
      logGithubReward('auto_checkpoint', result, { rewardValue: 0.55, metadata: { reason } });
      return { ok: true, result, commitSha: result.commitSha || '' };
    } catch (err) {
      const message = err?.message || String(err);
      git.status = `Auto-checkpoint failed before ${reason}:\n${message}`;
      render();
      return { ok: false, error: message };
    }
  }


  async function createProjectRepository(project, options = {}) {
    loadGitSettings();
    pullGitSetup();
    const normalizedProject = State().defaultProject ? W.LuminaLatex.ProjectModel.normalizeProject(project) : project;
    const repoName = sanitizeRepoName(options.repoName || normalizedProject?.name || 'latexai-project');
    if (!repoName) throw new Error('Could not derive a GitHub repository name from the project name.');
    const branch = String(options.branch || git.branch || 'main').trim() || 'main';
    const files = {};
    for (const file of normalizedProject.files || []) files[file.path] = fileContentForGithub(file);
    const createBody = {
      owner: options.owner || git.owner || '',
      repo: repoName,
      branch,
      rootPath: normalizeRepoPath(options.rootPath || git.rootPath || ''),
      private: options.private !== false,
      description: options.description || `Latexai project: ${normalizedProject.name || repoName}`,
      project: normalizedProject,
      files,
      message: options.message || `Latexai new project: ${normalizedProject.name || repoName}`
    };
    githubTrace('createProjectRepository-request-body', { body: summarizeGithubBody(createBody) });
    const result = await gitFetch('/create-project-repo', createBody);
    git.owner = result.owner || result.repoOwner || git.owner || '';
    git.repo = result.repo || repoName;
    git.branch = result.branch || branch;
    git.rootPath = normalizeRepoPath(result.rootPath || options.rootPath || git.rootPath || '');
    git.headSha = result.commitSha || result.headSha || git.headSha || null;
    git.status = `Created GitHub repository ${git.owner}/${git.repo}.\nInitial commit: ${git.headSha || 'created'}`;
    saveGitSettings();
    render();
    return {
      ok: true,
      result,
      github: {
        owner: git.owner,
        repo: git.repo,
        branch: git.branch,
        rootPath: git.rootPath,
        headSha: git.headSha,
        htmlUrl: result.htmlUrl || result.repoUrl || ''
      }
    };
  }

  function getGithubSettings() {
    loadGitSettings();
    syncGitFromProject();
    pullGitSetup();
    return {
      backendBase: activeGithubBackend(),
      owner: git.owner || '',
      repo: git.repo || '',
      branch: git.branch || 'main',
      rootPath: normalizeRepoPath(git.rootPath || ''),
      headSha: git.headSha || null
    };
  }

  function sanitizeRepoName(value) {
    let repo = String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/\.{2,}/g, '.')
      .slice(0, 90);
    if (!repo) repo = 'latexai-project';
    if (!/^[A-Za-z0-9]/.test(repo)) repo = 'latexai-' + repo;
    return repo;
  }

  function pullGitSetup(options = {}) {
    const keepRepoSelection = !!options.keepRepoSelection;
    const backend = document.getElementById('gitBackendInput');
    const owner = document.getElementById('gitOwnerInput');
    const repo = document.getElementById('gitRepoInput');
    const branch = document.getElementById('gitBranchInput');
    const rootPath = document.getElementById('gitRootPathInput');
    const commitMessage = document.getElementById('gitCommitMessageInput');
    if (backend) {
      git.backendBase = String(backend.value || '').trim() || DEFAULT_GITHUB_BACKEND;
      NS.BackendUrlSettings?.mirrorGithubBackendToGitSettings?.(git.backendBase);
    } else if (settingsGithubBackend()) {
      git.backendBase = settingsGithubBackend();
    }
    // Stage 19E3: when Open GitHub has just prompted for a specific repo,
    // do not let stale hidden Git panel inputs overwrite that explicit choice.
    // The previous 19E2 path called pullGitSetup() inside loadFromGithub(),
    // which could reset git.owner/git.repo back to the recently attached repo.
    if (!keepRepoSelection) {
      if (owner) git.owner = String(owner.value || '').trim();
      if (repo) git.repo = String(repo.value || '').trim();
      if (branch) git.branch = String(branch.value || '').trim() || 'main';
      if (rootPath) git.rootPath = normalizeRepoPath(rootPath.value);
    }
    if (commitMessage) git.commitMessage = String(commitMessage.value || '');
    saveGitSettings();
  }

  async function gitFetch(path, body) {
    const url = String(activeGithubBackend()).replace(/\/$/, '') + path;
    const method = body ? 'POST' : 'GET';
    const traceBody = summarizeGithubBody(body);
    githubTrace('gitFetch-request', { path, method, url, body: traceBody });
    let response;
    let text = '';
    let data = {};
    try {
      response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      text = await response.text();
      try { data = text ? JSON.parse(text) : {}; } catch (_err) { data = { raw: text }; }
      const detail = data.detail || data.error || data.message || data.raw || '';
      githubTrace('gitFetch-response', {
        path,
        method,
        url,
        status: response.status,
        ok: response.ok,
        message: typeof detail === 'string' ? detail.slice(0, 260) : JSON.stringify(detail).slice(0, 260),
        keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 12) : []
      });
      if (!response.ok) {
        const rendered = typeof detail === 'string' ? detail : JSON.stringify(detail);
        const err = new Error(rendered || `HTTP ${response.status}`);
        err.githubRequest = { path, method, url, body: traceBody };
        err.githubStatus = response.status;
        err.githubResponse = data;
        throw err;
      }
      return data;
    } catch (err) {
      if (!response) {
        githubTrace('gitFetch-network-error', { path, method, url, body: traceBody, message: err?.message || String(err) });
      }
      throw err;
    }
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

  NS.FileTree = { STAGE, getGithubTrace: () => (W.LuminaLatex.__githubOpenTrace || []).slice(), bind, render, renderRootSelect, addTemplate, loadFromGithub, promptOpenGithubProject, commitAllToGithub, commitProjectToGithub, promptCheckpointToGithub, createCheckpointToGithub, autoCheckpointBeforeRiskyAction, checkGithubBackend, createProjectRepository, getGithubSettings, sanitizeRepoName, defaultCommitMessage, commitMessageForGithub, isGithubAttached, githubScopedIds, applyGithubIdentity, parseGithubRepoSpec, forceGithubProjectIntoUi, refreshGithubProjectPanes };
})();
