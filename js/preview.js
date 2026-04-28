(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

  let previewTimer = null;
  let lastPdfObjectUrl = null;

  function init() {
    document.getElementById('togglePreviewBtn')?.addEventListener('click', renderDraftPreview);
    document.getElementById('compileBtn')?.addEventListener('click', compile);
    document.getElementById('cancelCompileBtn')?.addEventListener('click', () => NS.CompilerProvider?.cancelActiveJob?.());
    document.getElementById('showDraftPreviewBtn')?.addEventListener('click', () => setPreviewMode('draft'));
    document.getElementById('showPdfPreviewBtn')?.addEventListener('click', () => setPreviewMode('pdf'));
    document.getElementById('engineSelect')?.addEventListener('change', (event) => State().setSetting('engine', event.target.value));
    document.getElementById('compilerModeSelect')?.addEventListener('change', (event) => {
      State().setSetting('compilerMode', event.target.value);
      NS.BrowserWasmProvider?.renderStatus?.();
      NS.TexlyreBusyTexProvider?.renderStatus?.();
    });
    document.getElementById('compileProxyUrl')?.addEventListener('change', (event) => State().setSetting('compileUrl', event.target.value.trim() || '/api/lumina/latex/compile'));
    document.getElementById('compileJobsCheck')?.addEventListener('change', (event) => State().setSetting('useCompileJobs', !!event.target.checked));
    document.getElementById('compilePollSelect')?.addEventListener('change', (event) => State().setSetting('compilePollMs', Number(event.target.value) || 1000));
    document.getElementById('shellEscapeCheck')?.addEventListener('change', (event) => {
      const allowed = shellEscapeUiAllowed();
      if (!allowed && event.target.checked) {
        event.target.checked = false;
        State().setSetting('shellEscape', false);
        NS.Main?.toast?.('Shell escape is disabled until a real backend explicitly permits it.');
        return;
      }
      State().setSetting('shellEscape', allowed && !!event.target.checked);
    });

    State().subscribe((snapshot, reason) => {
      if (['load','reset','active-file','file-create','file-remove','file-rename','file-import-overwrite'].includes(reason)) {
        syncSettingsUi();
        renderDraftPreview();
      }
      if (reason === 'logs') renderLogs();
      if (reason === 'compile-status') renderCompileStatus();
    });

    syncSettingsUi();
    renderDraftPreview();
    renderLogs();
  }

  function syncSettingsUi() {
    const { settings } = State().state;
    const compileUrl = document.getElementById('compileProxyUrl');
    const engine = document.getElementById('engineSelect');
    const shellEscape = document.getElementById('shellEscapeCheck');
    const compileJobs = document.getElementById('compileJobsCheck');
    const compilePoll = document.getElementById('compilePollSelect');
    const compilerMode = document.getElementById('compilerModeSelect');
    const wasmAssetBase = document.getElementById('browserWasmAssetBase');
    const wasmEndpoint = document.getElementById('browserWasmTexliveEndpoint');
    const wasmReuse = document.getElementById('browserWasmReuseCheck');
    const texlyreModule = document.getElementById('texlyreModuleUrl');
    const texlyreBase = document.getElementById('texlyreBusytexBase');
    const texlyreReuse = document.getElementById('texlyreReuseCheck');
    const texlyreUseWorker = document.getElementById('texlyreUseWorkerCheck');
    if (compileUrl) compileUrl.value = settings.compileUrl || '/api/lumina/latex/compile';
    if (engine) engine.value = settings.engine || 'pdflatex';
    if (compilerMode) compilerMode.value = settings.compilerMode || 'backend-texlive';
    if (compileJobs) compileJobs.checked = settings.useCompileJobs !== false;
    if (compilePoll) compilePoll.value = String(settings.compilePollMs || 1000);
    if (wasmAssetBase) wasmAssetBase.value = settings.browserWasmAssetBase || 'vendor/swiftlatex/pdftex/';
    if (wasmEndpoint) wasmEndpoint.value = settings.browserWasmTexliveEndpoint || 'https://texlive.swiftlatex.com/';
    if (wasmReuse) wasmReuse.checked = settings.browserWasmReuseEngine !== false;
    if (texlyreModule) texlyreModule.value = settings.texlyreModuleUrl || 'https://esm.sh/texlyre-busytex?bundle';
    if (texlyreBase) texlyreBase.value = settings.texlyreBusytexBase || 'vendor/texlyre/core/busytex';
    if (texlyreReuse) texlyreReuse.checked = settings.texlyreReuseRunner !== false;
    if (texlyreUseWorker) texlyreUseWorker.checked = settings.texlyreUseWorker === true;
    const shellAllowed = shellEscapeUiAllowed();
    if (shellEscape) {
      shellEscape.checked = shellAllowed && !!settings.shellEscape;
      shellEscape.disabled = !shellAllowed;
      shellEscape.title = shellAllowed
        ? 'Only enable if your backend is configured with ALLOW_SHELL_ESCAPE=true.'
        : 'Disabled on static/default backend deployments. Configure and test a real backend before enabling.';
    }
    if (!shellAllowed && settings.shellEscape) {
      State().setSetting('shellEscape', false);
    }
  }

  function shellEscapeUiAllowed() {
    const settings = Object.assign({}, State().state.settings || {});
    const compileUrl = document.getElementById('compileProxyUrl')?.value?.trim();
    if (compileUrl) settings.compileUrl = compileUrl;
    const availability = NS.CompilerProvider?.backendAvailability?.(settings);
    if (!availability || availability.staticDraftFallbackActive) return false;
    const probe = NS.CompilerProvider?.getLastBackendProbe?.();
    if (probe?.policy && probe.policy.allowShellEscape === false) return false;
    return true;
  }

  function scheduleDraftPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderDraftPreview, 450);
  }

  function activeRootText() {
    const state = State().state;
    const root = State().getFile(state.project.rootFile) || State().getActiveFile();
    return root?.text || '';
  }

  function renderDraftPreview() {
    const preview = document.getElementById('draftPreview');
    if (!preview) return;
    const state = State().state;
    const rootText = activeRootText();
    const analysis = analyzeTex(rootText, state.project.files);
    preview.innerHTML = draftHtml(rootText, analysis);
    renderOutline(analysis.outline);
    State().setLog(State().state.lastLog, analysis.problems);
  }

  function analyzeTex(tex, files) {
    const problems = [];
    const outline = [];
    const text = String(tex || '');
    if (!/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/.test(text)) {
      problems.push({ level: 'warn', message: 'Root file does not contain \\documentclass{...}.', line: 1 });
    }
    if (!/\\begin\{document\}/.test(text)) {
      problems.push({ level: 'warn', message: 'Root file does not contain \\begin{document}.', line: 1 });
    }
    if (!/\\end\{document\}/.test(text)) {
      problems.push({ level: 'warn', message: 'Root file does not contain \\end{document}.', line: countLines(text) });
    }

    const stack = [];
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      const lineNo = index + 1;
      let m;
      const sectionRe = /\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]*)\}/g;
      while ((m = sectionRe.exec(line))) {
        outline.push({ kind: m[1], title: stripLatex(m[2]), line: lineNo });
      }
      const beginRe = /\\begin\{([^}]+)\}/g;
      while ((m = beginRe.exec(line))) stack.push({ env: m[1], line: lineNo });
      const endRe = /\\end\{([^}]+)\}/g;
      while ((m = endRe.exec(line))) {
        const top = stack.pop();
        if (!top || top.env !== m[1]) problems.push({ level: 'error', message: `Environment mismatch near \\end{${m[1]}}.`, line: lineNo });
      }
    });
    for (const item of stack.reverse()) problems.push({ level: 'error', message: `Unclosed environment \\begin{${item.env}}.`, line: item.line });

    const citations = Array.from(text.matchAll(/\\cite(?:[a-zA-Z*]*)?(?:\[[^\]]*\])?\{([^}]+)\}/g)).flatMap((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean));
    const bibText = files.filter((f) => f.path.endsWith('.bib')).map((f) => f.text || '').join('\n');
    for (const key of citations) {
      const re = new RegExp('@\\w+\\s*\\{\\s*' + escapeRegExp(key) + '\\s*,');
      if (!re.test(bibText)) problems.push({ level: 'warn', message: `Citation key not found in .bib files: ${key}`, line: findLine(text, key) });
    }

    if (!problems.length) problems.push({ level: 'ok', message: 'Draft checks passed. Real TeX errors require backend compilation.', line: null });
    return { problems, outline };
  }

  function draftHtml(tex, analysis) {
    let body = extractDocumentBody(tex);
    const title = matchCommand(tex, 'title') || 'Untitled document';
    const author = matchCommand(tex, 'author') || '';
    const date = matchCommand(tex, 'date') || '';

    body = removeComments(body);
    body = body.replace(/\\maketitle/g, `<h1>${escapeHtml(stripLatex(title))}</h1>${author ? `<p><strong>${escapeHtml(stripLatex(author))}</strong></p>` : ''}${date ? `<p class="muted">${escapeHtml(stripLatex(date))}</p>` : ''}`);
    body = convertEnvironment(body, 'abstract', (content) => `<div class="abstract"><strong>Abstract.</strong> ${inlineLatex(content)}</div>`);
    body = convertList(body, 'itemize', 'ul');
    body = convertList(body, 'enumerate', 'ol');
    body = convertEnvironment(body, 'theorem', (content) => `<div class="abstract"><strong>Theorem.</strong> ${inlineLatex(content)}</div>`);
    body = convertEnvironment(body, 'lemma', (content) => `<div class="abstract"><strong>Lemma.</strong> ${inlineLatex(content)}</div>`);
    body = convertEnvironment(body, 'proof', (content) => `<p><em>Proof.</em> ${inlineLatex(content)} <span>□</span></p>`);
    body = body.replace(/\\\[((.|\n)*?)\\\]/g, (_, math) => `<span class="math-block">${escapeHtml(math.trim())}</span>`);
    body = body.replace(/\$\$((.|\n)*?)\$\$/g, (_, math) => `<span class="math-block">${escapeHtml(math.trim())}</span>`);
    body = body.replace(/\\section\*?\{([^}]*)\}/g, (_, s) => `<h2>${escapeHtml(stripLatex(s))}</h2>`);
    body = body.replace(/\\subsection\*?\{([^}]*)\}/g, (_, s) => `<h3>${escapeHtml(stripLatex(s))}</h3>`);
    body = body.replace(/\\subsubsection\*?\{([^}]*)\}/g, (_, s) => `<h3>${escapeHtml(stripLatex(s))}</h3>`);
    body = body.replace(/\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g, (_, path) => `<div class="math-block">[figure: ${escapeHtml(path)}]</div>`);
    body = body.replace(/\\bibliography\{([^}]*)\}/g, (_, refs) => `<h2>References</h2><p>Bibliography file(s): ${escapeHtml(refs)}</p>`);
    body = inlineLatex(body);
    body = paragraphs(body);

    const problemHtml = (analysis.problems || [])
      .filter((p) => p.level !== 'ok')
      .slice(0, 4)
      .map((p) => `<div class="problem ${escapeHtml(p.level)}">${p.line ? `Line ${p.line}: ` : ''}${escapeHtml(p.message)}</div>`)
      .join('');

    return `${problemHtml}<article>${body}</article>`;
  }

  function renderOutline(outline) {
    const list = document.getElementById('outlineList');
    if (!list) return;
    if (!outline || !outline.length) {
      list.innerHTML = '<div class="outline-empty">No sections found yet.</div>';
      return;
    }
    list.innerHTML = '';
    for (const item of outline) {
      const div = document.createElement('div');
      div.className = `outline-item ${item.kind || ''}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<span class="label">${escapeHtml(item.kind)} · line ${item.line}</span><span class="title">${escapeHtml(item.title)}</span>`;
      button.addEventListener('click', () => NS.Editor?.goToLine?.(item.line));
      div.appendChild(button);
      list.appendChild(div);
    }
  }

  function renderLogs() {
    const problems = document.getElementById('problemList');
    const log = document.getElementById('logPanel');
    const state = State().state;
    if (problems) {
      problems.innerHTML = '';
      const items = state.lastProblems || [];
      if (!items.length) {
        problems.innerHTML = '<div class="problem ok">No diagnostics yet.</div>';
      } else {
        for (const p of items) {
          const div = document.createElement('div');
          div.className = `problem ${escapeHtml(p.level || 'warn')}`;
          const where = p.line ? `${p.file ? p.file + ':' : 'Line '}${p.line}: ` : (p.file ? p.file + ': ' : '');
          div.textContent = where + String(p.message || p);
          if (p.line) {
            div.classList.add('clickable');
            div.title = 'Jump to diagnostic line';
            div.tabIndex = 0;
            div.addEventListener('click', () => jumpToProblem(p));
            div.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') jumpToProblem(p); });
          }
          problems.appendChild(div);
        }
      }
    }
    if (log) log.textContent = state.lastLog || 'No compile has been run yet.';
    renderCompileStatus();
  }

  function jumpToProblem(problem) {
    if (problem.file && State().getFile(problem.file)) State().setActivePath(problem.file);
    NS.Editor?.goToLine?.(problem.line || 1);
  }

  function renderCompileStatus() {
    const compile = State().state.compile || {};
    const text = document.getElementById('compileStatusText');
    const job = document.getElementById('compileJobIdText');
    const bar = document.getElementById('compileProgressBar');
    const cancel = document.getElementById('cancelCompileBtn');
    const status = compile.status || 'idle';
    if (text) text.textContent = `Compile: ${status}${compile.message ? ' · ' + compile.message : ''}`;
    if (job) job.textContent = compile.jobId ? `Job ${compile.jobId}` : 'No compile job';
    if (bar) bar.style.width = Math.max(0, Math.min(Number(compile.progress || 0), 100)) + '%';
    if (cancel) cancel.classList.toggle('hidden', !['submitting','queued','running'].includes(status));
  }

  function setPreviewMode(mode) {
    const draft = document.getElementById('draftPreview');
    const pdf = document.getElementById('pdfPreview');
    const draftBtn = document.getElementById('showDraftPreviewBtn');
    const pdfBtn = document.getElementById('showPdfPreviewBtn');
    const isPdf = mode === 'pdf';
    draft?.classList.toggle('hidden', isPdf);
    pdf?.classList.toggle('hidden', !isPdf);
    draftBtn?.classList.toggle('active', !isPdf);
    pdfBtn?.classList.toggle('active', isPdf);
    State().setSetting('previewMode', isPdf ? 'pdf' : 'draft');
  }

  async function compile() {
    State().save();
    const compileBtn = document.getElementById('compileBtn');
    if (compileBtn) compileBtn.disabled = true;
    document.getElementById('cancelCompileBtn')?.classList.remove('hidden');
    try {
      const { project } = State().state;
      const settings = NS.CompilerProvider?.currentSettings?.() || State().state.settings;
      State().setCompileStatus({ status: 'submitting', jobId: null, progress: 5, message: `Preparing ${project.rootFile}...`, startedAt: new Date().toISOString(), finishedAt: null });
      State().setLog(`Compiling ${project.rootFile} with ${settings.engine || 'pdflatex'} via ${settings.compilerMode || 'backend-texlive'}...`, []);
      renderLogs();
      const result = await NS.CompilerProvider.compile(project, settings);
      State().setLog(result.log || 'Compile completed.', result.problems || []);
      if (result.pdfBase64) {
        showPdf(result.pdfBase64);
        setPreviewMode('pdf');
      } else {
        setPreviewMode('draft');
      }
      const finalMessage = compileResultMessage(result);
      State().setCompileStatus({ status: result.ok ? 'succeeded' : 'failed', jobId: result.jobId || State().state.compile?.jobId || null, progress: 100, message: finalMessage });
      if (!result.ok || result.mode === 'static-draft-fallback') showLogsTab();
    } catch (err) {
      const message = `Compile provider error: ${err.message || err}`;
      State().setCompileStatus({ status: 'error', progress: 100, message });
      State().setLog(message, [{ level: 'error', message, line: null }]);
      showLogsTab();
    } finally {
      if (compileBtn) compileBtn.disabled = false;
      document.getElementById('cancelCompileBtn')?.classList.add('hidden');
      renderLogs();
    }
  }

  function showPdf(base64) {
    lastPdfObjectUrl = NS.PreviewAdapter?.showPdf?.(base64) || lastPdfObjectUrl;
  }
  function compileResultMessage(result) {
    if (result?.mode === 'static-draft-fallback') {
      return result.ok
        ? 'Draft preview ready; configure a backend URL for real PDF compilation.'
        : 'Draft checks found diagnostics; configure a backend URL for real PDF compilation.';
    }
    if (result?.mode === 'mock-draft') {
      return result.ok ? 'Draft checks completed.' : 'Draft checks found diagnostics.';
    }
    if (result?.pdfBase64) return result.ok ? 'PDF compile completed.' : 'Compile finished with diagnostics.';
    return result.ok ? 'Compile provider completed without a PDF.' : 'Compile finished with diagnostics.';
  }

  function parseCompileLog(logText) {
    const problems = [];
    const lines = String(logText || '').split('\n');
    lines.forEach((line, index) => {
      if (/^! /.test(line)) problems.push({ level: 'error', message: line.replace(/^!\s*/, ''), line: index + 1 });
      else if (/warning/i.test(line)) problems.push({ level: 'warn', message: line.trim(), line: index + 1 });
    });
    return problems.slice(0, 20);
  }

  function showLogsTab() {
    document.querySelector('[data-right-tab="logs"]')?.click();
  }

  function extractDocumentBody(tex) {
    const m = String(tex || '').match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    return m ? m[1] : String(tex || '');
  }

  function matchCommand(tex, command) {
    const re = new RegExp('\\\\' + command + '\\{([^}]*)\\}');
    const m = String(tex || '').match(re);
    return m ? m[1] : '';
  }

  function removeComments(text) {
    return String(text || '').split('\n').map((line) => {
      let escaped = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '\\') escaped = !escaped;
        else {
          if (line[i] === '%' && !escaped) return line.slice(0, i);
          escaped = false;
        }
      }
      return line;
    }).join('\n');
  }

  function convertEnvironment(body, env, renderer) {
    const re = new RegExp('\\\\begin\\{' + env + '\\}([\\s\\S]*?)\\\\end\\{' + env + '\\}', 'g');
    return body.replace(re, (_, content) => renderer(content.trim()));
  }

  function convertList(body, env, tag) {
    return convertEnvironment(body, env, (content) => {
      const items = content.split(/\\item/g).map((s) => s.trim()).filter(Boolean);
      return `<${tag}>${items.map((item) => `<li>${inlineLatex(item)}</li>`).join('')}</${tag}>`;
    });
  }

  function inlineLatex(text) {
    // Preserve HTML tags that the draft renderer has already created, then
    // escape and lightly translate the remaining LaTeX-ish inline source.
    const tags = [];
    let out = String(text || '').replace(/<\/?[a-zA-Z][^>]*>/g, (tag) => {
      const token = `@@LUMINA_HTML_${tags.length}@@`;
      tags.push(tag);
      return token;
    });
    out = escapeHtmlNoDouble(out);
    out = out.replace(/\$([^$\n]+)\$/g, '<span class="inline-math">$1</span>');
    out = out.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>');
    out = out.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
    out = out.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
    out = out.replace(/\\cite(?:[a-zA-Z*]*)?(?:\[[^\]]*\])?\{([^}]*)\}/g, '<span class="inline-math">[$1]</span>');
    out = out.replace(/\\ref\{([^}]*)\}/g, '<span class="inline-math">ref:$1</span>');
    out = out.replace(/\\label\{([^}]*)\}/g, '');
    out = out.replace(/\\(newpage|clearpage|noindent|medskip|smallskip|bigskip)/g, '');
    out = out.replace(/@@LUMINA_HTML_(\d+)@@/g, (_, i) => tags[Number(i)] || '');
    return out;
  }

  function paragraphs(html) {
    const protectedTags = /^(<h\d|<ul|<ol|<li|<div|<span class="math-block"|<article|<\/|\s*$)/;
    return html.split(/\n{2,}/).map((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed) return '';
      if (protectedTags.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
  }

  function stripLatex(text) {
    return String(text || '')
      .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^}]*)\}/g, '$1')
      .replace(/[{}]/g, '')
      .trim();
  }

  function countLines(text) { return String(text || '').split('\n').length; }
  function findLine(text, needle) {
    const lines = String(text || '').split('\n');
    const idx = lines.findIndex((line) => line.includes(needle));
    return idx >= 0 ? idx + 1 : null;
  }
  function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function escapeHtmlNoDouble(value) {
    return String(value || '')
      .replace(/&(?!(amp|lt|gt|quot|#39);)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  NS.Preview = { init, renderDraftPreview, scheduleDraftPreview, analyzeTex, compile, setPreviewMode };
})();
