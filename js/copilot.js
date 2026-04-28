(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

  const FALLBACK_MODELS = {
    openai: [
      { value: 'gpt-4.1-mini', label: 'OpenAI · gpt-4.1-mini' },
      { value: 'gpt-4.1', label: 'OpenAI · gpt-4.1' }
    ],
    anthropic: [
      { value: 'claude-sonnet-4-5', label: 'Claude · claude-sonnet-4-5' },
      { value: 'claude-haiku-4-5', label: 'Claude · claude-haiku-4-5' }
    ],
    gemini: [
      { value: 'gemini-2.5-flash', label: 'Gemini · gemini-2.5-flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini · gemini-2.5-pro' }
    ]
  };

  const LS_PROVIDER = 'lumina-latex.ai.provider';
  const LS_MODEL_PREFIX = 'lumina-latex.ai.model.';
  const LS_PROXY_URL = 'lumina-latex.ai.proxyUrl';
  const LS_PROXY_TOKEN = 'lumina-latex.ai.proxyToken';

  function init() {
    bindProviderControls();
    document.getElementById('askCopilotBtn')?.addEventListener('click', askCopilot);
    document.getElementById('insertCopilotBtn')?.addEventListener('click', insertCopilotResult);
    document.getElementById('replaceCopilotBtn')?.addEventListener('click', replaceWithCopilotResult);
    document.getElementById('copilotTask')?.addEventListener('change', renderContextChips);
    document.getElementById('copilotPrompt')?.addEventListener('input', renderContextChips);
    State().subscribe((_snapshot, reason) => {
      if (['load','active-file','file-change','logs','compile-status'].includes(reason)) renderContextChips();
    });
    renderContextChips();
  }

  function bindProviderControls() {
    const providerEl = document.getElementById('aiProvider');
    const modelEl = document.getElementById('aiModel');
    const proxyUrlEl = document.getElementById('aiProxyUrl');
    const proxyTokenEl = document.getElementById('aiProxyToken');
    if (!providerEl || !modelEl) return;

    providerEl.value = localStorage.getItem(LS_PROVIDER) || 'openai';
    if (proxyUrlEl) proxyUrlEl.value = localStorage.getItem(LS_PROXY_URL) || proxyUrlEl.value || '/api/lumina/ai';
    if (proxyTokenEl) proxyTokenEl.value = localStorage.getItem(LS_PROXY_TOKEN) || '';

    renderModels();
    loadModelsFromProxy();

    providerEl.addEventListener('change', () => {
      localStorage.setItem(LS_PROVIDER, providerEl.value);
      renderModels();
    });
    modelEl.addEventListener('change', () => localStorage.setItem(`${LS_MODEL_PREFIX}${providerEl.value}`, modelEl.value));
    proxyUrlEl?.addEventListener('change', () => {
      localStorage.setItem(LS_PROXY_URL, proxyUrlEl.value.trim() || '/api/lumina/ai');
      loadModelsFromProxy();
    });
    proxyTokenEl?.addEventListener('change', () => localStorage.setItem(LS_PROXY_TOKEN, proxyTokenEl.value.trim()));
  }

  function modelsFor(provider) {
    return NS.AIProvider?.modelsFor?.(provider) || FALLBACK_MODELS[provider] || [];
  }

  function renderModels() {
    const providerEl = document.getElementById('aiProvider');
    const modelEl = document.getElementById('aiModel');
    if (!providerEl || !modelEl) return;
    const provider = providerEl.value || 'openai';
    const models = modelsFor(provider);
    modelEl.innerHTML = models.map((m) => `<option value="${escapeHtml(m.value)}">${escapeHtml(m.label || m.value)}</option>`).join('');
    const saved = localStorage.getItem(`${LS_MODEL_PREFIX}${provider}`);
    if (saved && models.some((m) => m.value === saved)) modelEl.value = saved;
  }

  async function loadModelsFromProxy() {
    const ok = await NS.AIProvider?.loadModelsFromProxy?.();
    if (ok) renderModels();
    return !!ok;
  }

  function getConfig() {
    return NS.AIProvider?.getConfig?.() || { provider: 'openai', model: '', proxyUrl: getProxyUrl(), proxyToken: '' };
  }

  function getProxyUrl() {
    return document.getElementById('aiProxyUrl')?.value?.trim() || localStorage.getItem(LS_PROXY_URL) || '/api/lumina/ai';
  }

  async function callProxy(payload, meta = {}) {
    return NS.AIProvider.ask(payload, meta);
  }

  function extractText(data) {
    return NS.AIProvider?.extractText?.(data) || JSON.stringify(data, null, 2);
  }

  function captureContext() {
    const file = State().getActiveFile();
    const selection = NS.Editor?.getSelection?.() || { text: '', start: 0, end: 0 };
    const problems = State().state.lastProblems || [];
    const rootFile = State().state.project.rootFile;
    const root = State().getFile(rootFile);
    return {
      schema: 'lumina-latex-copilot-context-v1',
      project: {
        projectId: State().state.project.projectId,
        name: State().state.project.name,
        rootFile,
        activePath: file?.path || null,
        fileCount: State().state.project.files.length,
        files: State().state.project.files.map((f) => ({ path: f.path, kind: f.kind, bytes: (f.text || f.base64 || '').length }))
      },
      activeFile: {
        path: file?.path || null,
        kind: file?.kind || null,
        text: (file?.text || '').slice(0, 16000)
      },
      rootFile: {
        path: root?.path || null,
        text: (root?.text || '').slice(0, 12000)
      },
      selection,
      diagnostics: {
        problems: problems.slice(0, 12),
        compileStatus: State().state.compile,
        logTail: String(State().state.lastLog || '').slice(-7000)
      },
      settings: {
        engine: State().state.settings.engine,
        bibliography: State().state.settings.bibliography,
        shellEscape: !!State().state.settings.shellEscape
      }
    };
  }

  function renderContextChips() {
    const box = document.getElementById('copilotContextChips');
    if (!box) return;
    const ctx = captureContext();
    const task = document.getElementById('copilotTask')?.value || 'raw-advice';
    const errorCount = ctx.diagnostics.problems.filter((p) => p.level === 'error').length;
    const warnCount = ctx.diagnostics.problems.filter((p) => p.level === 'warn').length;
    const selLen = ctx.selection.text.length;
    const chips = [
      ['Task', labelForTask(task)],
      ['File', ctx.activeFile.path || 'none'],
      ['Selection', selLen ? `${selLen} chars` : 'none'],
      ['Diagnostics', `${errorCount} errors · ${warnCount} warnings`],
      ['Root', ctx.project.rootFile]
    ];
    box.innerHTML = chips.map(([k, v]) => `<span class="context-chip"><strong>${escapeHtml(k)}</strong>${escapeHtml(v)}</span>`).join('');
  }

  function labelForTask(task) {
    return ({
      'fix-error-patch': 'Fix error',
      'rewrite-selection-patch': 'Rewrite selection',
      'insert-section-patch': 'Insert section',
      'beamer-outline-patch': 'Beamer outline',
      'table-helper-patch': 'Table helper',
      'explain-log': 'Explain log',
      'raw-advice': 'Advice'
    })[task] || task;
  }

  async function askCopilot() {
    const button = document.getElementById('askCopilotBtn');
    const output = document.getElementById('copilotOutput');
    const prompt = document.getElementById('copilotPrompt')?.value || '';
    const task = document.getElementById('copilotTask')?.value || 'raw-advice';
    const context = captureContext();
    const needsInput = !prompt.trim() && !context.selection.text.trim() && !['fix-error-patch','explain-log'].includes(task);
    if (needsInput) {
      output.textContent = 'Add a prompt or select LaTeX in the editor first.';
      return;
    }
    if (button) button.disabled = true;
    NS.PatchManager?.discardPatch?.();
    output.textContent = 'Calling AI proxy with project context…';
    try {
      const system = systemPromptFor(task);
      const user = buildUserPrompt(task, prompt, context);
      const result = await callProxy(
        { instructions: system, input: user, temperature: task === 'raw-advice' || task === 'explain-log' ? 0.2 : 0.15, maxOutputTokens: 5200 },
        { task, context: summarizeContextForTransport(context) }
      );
      const text = extractText(result) || 'No text returned by proxy.';
      output.textContent = text;
      if (NS.PatchManager?.isPatchWorkflow?.(task)) NS.PatchManager.proposeFromText(text, { task, context });
    } catch (err) {
      const fallback = localFallback(task, prompt, context, err);
      output.textContent = fallback;
      if (NS.PatchManager?.isPatchWorkflow?.(task)) NS.PatchManager.proposeFromText(fallback, { task, context, fallback: true });
    } finally {
      if (button) button.disabled = false;
      renderContextChips();
    }
  }

  function buildUserPrompt(task, prompt, context) {
    const problemLines = context.diagnostics.problems.map((p, i) => `${i + 1}. ${p.level || 'info'} ${p.file || context.activeFile.path || ''}${p.line ? ':' + p.line : ''} — ${p.message}`).join('\n') || 'No diagnostics recorded.';
    const outputMode = NS.PatchManager?.isPatchWorkflow?.(task)
      ? `Return ONLY valid JSON using this shape:
{
  "summary": "short human-readable summary",
  "patch": {
    "path": "${context.activeFile.path || context.project.rootFile || 'main.tex'}",
    "operation": "replace-selection | insert-at-cursor | find-replace | replace-file",
    "text": "LaTeX source to apply",
    "find": "optional exact source to replace",
    "replace": "optional replacement"
  }
}
Prefer replace-selection when selected LaTeX is provided. Prefer find-replace when fixing a specific source span. Do not include Markdown fences.`
      : 'Return concise advice. Include exact LaTeX snippets only when useful.';
    return [
      `Workflow: ${task}`,
      outputMode,
      `User prompt:\n${prompt || '(none)'}`,
      `Project summary:\n${JSON.stringify(context.project, null, 2)}`,
      context.selection.text ? `Selected LaTeX from ${context.activeFile.path}, chars ${context.selection.start}-${context.selection.end}:\n${context.selection.text}` : 'Selected LaTeX: none',
      `Diagnostics:\n${problemLines}`,
      `Compile log tail:\n${context.diagnostics.logTail || '(none)'}`,
      `Active file content:\n${context.activeFile.text || '(none)'}`
    ].join('\n\n---\n\n');
  }

  function summarizeContextForTransport(context) {
    return {
      project: context.project,
      activePath: context.activeFile.path,
      selectionRange: { start: context.selection.start, end: context.selection.end, length: context.selection.text.length },
      diagnostics: context.diagnostics.problems.slice(0, 8),
      compileStatus: context.diagnostics.compileStatus
    };
  }

  function systemPromptFor(task) {
    const base = 'You are Lumina LaTeX Copilot inside a browser-based Overleaf-like editor. Be precise, preserve mathematical meaning, avoid unnecessary rewrites, and never invent packages unless needed.';
    if (task === 'fix-error-patch') return `${base} Fix the current LaTeX compile error. Return exactly one safe patch as valid JSON.`;
    if (task === 'rewrite-selection-patch') return `${base} Rewrite the selected LaTeX. Preserve notation and return exactly one patch as valid JSON.`;
    if (task === 'insert-section-patch') return `${base} Draft a polished LaTeX section or subsection to insert. Return valid JSON patch.`;
    if (task === 'beamer-outline-patch') return `${base} Return a Beamer-compatible outline with frames as a JSON patch.`;
    if (task === 'table-helper-patch') return `${base} Create a clean LaTeX table, tabular, align, or array environment as a JSON patch.`;
    if (task === 'explain-log') return `${base} Explain the compile log, prioritize the first root cause, and give a fix checklist.`;
    return `${base} Help with LaTeX authoring.`;
  }

  function localFallback(task, prompt, context, err) {
    const first = context.diagnostics.problems[0] || {};
    const message = `AI proxy error: ${err.message || err}`;
    if (task === 'explain-log') {
      return [
        message,
        '',
        'Local diagnostic fallback:',
        first.message ? `The first diagnostic is: ${first.message}${first.line ? ` near line ${first.line}` : ''}.` : 'No compile diagnostic is currently stored.',
        'Check unmatched braces, missing \\end{...}, missing packages, undefined citations/references, and the first error in the log before later cascading errors.'
      ].join('\n');
    }
    if (task === 'fix-error-patch') {
      const suggestion = heuristicFix(first, context);
      return JSON.stringify({
        summary: `${message}. Local fallback proposed a conservative edit; review before applying.`,
        patch: suggestion
      }, null, 2);
    }
    const insertion = prompt || context.selection.text || '% Add your LaTeX here.';
    return JSON.stringify({
      summary: `${message}. Local fallback will insert the available prompt/selection as a draft snippet.`,
      patch: { path: context.activeFile.path || context.project.rootFile || 'main.tex', operation: context.selection.text ? 'replace-selection' : 'insert-at-cursor', text: insertion }
    }, null, 2);
  }

  function heuristicFix(problem, context) {
    const path = problem.file || context.activeFile.path || context.project.rootFile || 'main.tex';
    const msg = String(problem.message || '').toLowerCase();
    if (msg.includes('undefined control sequence')) {
      return { path, operation: 'insert-at-cursor', text: '% TODO: Undefined control sequence. Check command spelling or add the package that defines it.\n' };
    }
    if (msg.includes('missing $') || msg.includes('math mode')) {
      return { path, operation: 'insert-at-cursor', text: '% TODO: Math mode issue. Wrap math in $...$, \\(...\\), or an equation environment.\n' };
    }
    if (msg.includes('runaway argument') || msg.includes('paragraph ended')) {
      return { path, operation: 'insert-at-cursor', text: '% TODO: Runaway argument. Check for a missing closing brace } before this line.\n' };
    }
    return { path, operation: 'insert-at-cursor', text: `% TODO: Review compile error${problem.line ? ` near line ${problem.line}` : ''}: ${problem.message || 'unknown'}\n` };
  }

  function copilotText() {
    return document.getElementById('copilotOutput')?.textContent || '';
  }

  function insertCopilotResult() {
    const text = copilotText();
    if (!text.trim() || text.startsWith('Copilot responses')) return;
    NS.Editor?.insertText?.('\n' + text + '\n');
  }

  function replaceWithCopilotResult() {
    const text = copilotText();
    if (!text.trim() || text.startsWith('Copilot responses')) return;
    NS.Editor?.replaceSelection?.(text, true);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  NS.Copilot = { init, models: null, getConfig, callProxy, extractText, askCopilot, captureContext, renderContextChips };
})();
