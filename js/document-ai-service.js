/* Latexai Stage 11D DocumentAIService
 * Stage: stage11d-frontend-developer-prompts-1
 *
 * Paper-level AI prompts are developer-editable frontend files under /prompt/.
 * They are shipped with the static frontend and fetched at runtime. They are NOT
 * created inside the user's paper project and are NOT editable through the app UI.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage11d-frontend-developer-prompts-1';

  const PROMPT_BASE = 'prompt/';
  const COMMON_PROMPT_PATH = 'prompt/ai-document-common.txt';
  const WORKFLOW_PROMPTS = {
    review: 'prompt/ai-review-and-suggestions.txt',
    remake: 'prompt/ai-total-remake-plan.txt',
    ranking: 'prompt/ai-ranking-acceptance-improver.txt',
    competitive: 'prompt/ai-competitive-agent-improver.txt'
  };

  const FALLBACK_PROMPTS = {
    [COMMON_PROMPT_PATH]: [
      'You are Latexai document-level AI.',
      '',
      'Operate on the full LaTeX paper context provided by the frontend.',
      '',
      'Current implementation mode:',
      '- Append-only.',
      '- Do not rewrite the paper in place.',
      '- Return LaTeX content for a final appendix/review section only.',
      '',
      'Output rules:',
      '- Return LaTeX only.',
      '- Do not use Markdown fences.',
      '- Do not return JSON.',
      '- Do not include \\documentclass, \\begin{document}, or \\end{document}.',
      '- Use concrete section/subsection headings, bullet lists, and actionable suggestions.',
      '',
      'User instructions:',
      '{{USER_INSTRUCTIONS}}',
      '',
      'Requested mode:',
      '{{MODE}}',
      '',
      'Selected workflow:',
      '{{WORKFLOW}}',
      '',
      'Root file:',
      '{{ROOT_FILE}}'
    ].join('\n'),
    [WORKFLOW_PROMPTS.review]: 'Workflow: Review and suggested improvements. Critically review the paper and return prioritized actionable LaTeX suggestions.',
    [WORKFLOW_PROMPTS.remake]: 'Workflow: Total remake plan. Propose a large-scale paper remake plan in LaTeX.',
    [WORKFLOW_PROMPTS.ranking]: 'Workflow: Ranking / acceptance improver. Return ranked recommendations that would improve venue acceptance odds.',
    [WORKFLOW_PROMPTS.competitive]: 'Workflow: Competitive agent improver. Simulate critic, improver, mathematical clarity checker, and strategist agents.'
  };

  let lastRaw = '';
  let lastSection = '';
  let lastContextSummary = '';
  let promptCache = new Map();

  function State() { return NS.State; }
  function el(id) { return document.getElementById(id); }

  function toast(message) {
    try { NS.Main?.toast?.(message); } catch (_err) {}
  }

  function setStatus(message) {
    const node = el('documentAiStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const node = el('documentAiOutput');
    if (!node) return;
    node.classList.add('active');
    node.textContent = String(text || '');
  }

  function normalizePath(path) {
    return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
  }

  function fileText(file) {
    if (!file) return '';
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function textFile(file) {
    try { return !!State()?.textFile?.(file); } catch (_err) {}
    return file && !file.base64 && !['asset', 'binary'].includes(file.kind);
  }

  function project() {
    return State()?.state?.project || {};
  }

  function rootPath() {
    const p = project();
    if (p.rootFile) return normalizePath(p.rootFile);
    const files = p.files || [];
    const root = files.find((f) => /\.tex$/i.test(f.path || '') && /\\documentclass/.test(fileText(f)));
    return normalizePath(root?.path || files.find((f) => /\.tex$/i.test(f.path || ''))?.path || 'main.tex');
  }

  function rootFile() {
    return State()?.getFile?.(rootPath());
  }

  function allPromptPaths() {
    return [COMMON_PROMPT_PATH, ...Object.values(WORKFLOW_PROMPTS)];
  }

  function promptUrl(path) {
    const clean = String(path || '').replace(/^\/+/, '');
    const stage = encodeURIComponent(W.LUMINA_LATEX_STAGE || STAGE);
    return `${clean}?v=${stage}`;
  }

  async function loadFrontendPrompt(path) {
    const normalized = normalizePath(path);
    if (promptCache.has(normalized)) return promptCache.get(normalized);

    try {
      const response = await fetch(promptUrl(normalized), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const finalText = text.trim() ? text : (FALLBACK_PROMPTS[normalized] || '');
      promptCache.set(normalized, finalText);
      return finalText;
    } catch (err) {
      const fallback = FALLBACK_PROMPTS[normalized] || '';
      promptCache.set(normalized, fallback);
      setStatus(`Could not load frontend prompt ${normalized}; using bundled fallback. ${err?.message || err}`);
      return fallback;
    }
  }

  async function loadWorkflowPrompts(workflow) {
    const workflowPath = WORKFLOW_PROMPTS[workflow] || WORKFLOW_PROMPTS.review;
    const [common, workflowPrompt] = await Promise.all([
      loadFrontendPrompt(COMMON_PROMPT_PATH),
      loadFrontendPrompt(workflowPath)
    ]);
    return { common, workflowPrompt, workflowPath };
  }

  function templateFill(template, values) {
    let out = String(template || '');
    for (const [key, value] of Object.entries(values || {})) {
      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      out = out.replace(pattern, String(value ?? ''));
    }
    return out;
  }

  function collectProjectContext(maxChars = 70000) {
    const p = project();
    const files = (p.files || [])
      .filter((f) => textFile(f))
      .filter((f) => /\.(tex|bib|md|txt)$/i.test(f.path || ''))
      .filter((f) => !/^prompt\//i.test(normalizePath(f.path || ''))) // ignore legacy project prompt folders if present
      .sort((a, b) => {
        const ar = normalizePath(a.path) === rootPath() ? 0 : 1;
        const br = normalizePath(b.path) === rootPath() ? 0 : 1;
        return ar - br || normalizePath(a.path).localeCompare(normalizePath(b.path));
      });

    const parts = [];
    let used = 0;
    for (const file of files) {
      const path = normalizePath(file.path);
      let text = fileText(file);
      if (!text.trim()) continue;
      const header = `\n\n%%%% FILE: ${path}\n`;
      const remaining = maxChars - used - header.length;
      if (remaining <= 0) break;
      if (text.length > remaining) text = text.slice(0, Math.max(0, remaining)) + '\n% [truncated]\n';
      parts.push(header + text);
      used += header.length + text.length;
    }

    lastContextSummary = `${files.length} text files considered; ${used} chars included. Root: ${rootPath()}. Frontend /prompt/ files supply AI instructions.`;
    return parts.join('');
  }

  function cleanAiLatex(raw) {
    let s = String(raw || '').trim();
    s = s.replace(/^```(?:latex|tex)?\s*/i, '').replace(/```$/i, '').trim();

    // Avoid full-document replacement in Stage 11D. Keep only body-ish content.
    s = s.replace(/\\documentclass[\s\S]*?\\begin\{document\}/, '').replace(/\\end\{document\}\s*$/i, '').trim();

    if (!s) {
      s = [
        '\\section*{Latexai AI Review}',
        'The AI did not return content. Please rerun the document review with a more specific instruction.'
      ].join('\n');
    }

    if (!/\\(?:section|subsection|paragraph)\*?\{/.test(s.slice(0, 600))) {
      s = `\\section*{Latexai AI Review}\n${s}`;
    }

    return s;
  }

  function wrapAppendixSection(sectionLatex, workflow) {
    const stamp = new Date().toISOString();
    const body = cleanAiLatex(sectionLatex);
    return [
      '',
      `% BEGIN LATEXAI-DOCUMENT-AI stage=11D workflow=${workflow || 'review'} generated=${stamp}`,
      '\\clearpage',
      '\\lai{',
      body,
      '}',
      `% END LATEXAI-DOCUMENT-AI stage=11D workflow=${workflow || 'review'}`,
      ''
    ].join('\n');
  }

  function insertBeforeEndDocument(tex, insertion) {
    const s = String(tex || '');
    const idx = s.lastIndexOf('\\end{document}');
    if (idx >= 0) return `${s.slice(0, idx).trimEnd()}\n\n${insertion}\n\n${s.slice(idx)}`;
    return `${s.trimEnd()}\n\n${insertion}\n`;
  }

  function ensureLai(rootText) {
    if (NS.ProjectModel?.ensureLaiMacro) return NS.ProjectModel.ensureLaiMacro(rootText);
    return rootText;
  }

  function workflowLabel(workflow) {
    return {
      review: 'Review and suggested improvements',
      remake: 'Total remake plan',
      ranking: 'Ranking / acceptance improver',
      competitive: 'Competitive agent improver'
    }[workflow] || workflow || 'review';
  }

  async function buildPromptPayload(workflow, userInstructions, mode) {
    const context = collectProjectContext();
    const { common, workflowPrompt, workflowPath } = await loadWorkflowPrompts(workflow);

    const values = {
      USER_INSTRUCTIONS: userInstructions || '(none)',
      MODE: mode || 'append',
      WORKFLOW: workflowLabel(workflow),
      WORKFLOW_KEY: workflow || 'review',
      ROOT_FILE: rootPath(),
      PROMPT_FILE: workflowPath
    };

    const input = [
      templateFill(common, values),
      '',
      '--- Workflow-specific frontend prompt file ---',
      templateFill(workflowPrompt, values),
      '',
      '--- Project context follows ---',
      context
    ].join('\n');

    return {
      instructions: 'Return LaTeX only. No markdown fences. No JSON.',
      input,
      promptSource: {
        kind: 'frontend-static-files',
        commonPrompt: COMMON_PROMPT_PATH,
        workflowPrompt: workflowPath
      },
      temperature: 0.2,
      maxOutputTokens: 5000
    };
  }

  async function runDocumentAi() {
    const workflow = el('documentAiWorkflow')?.value || 'review';
    const mode = el('documentAiMode')?.value || 'append';
    const instructions = String(el('documentAiPrompt')?.value || '').trim();

    if (mode !== 'append') {
      setStatus('Stage 11D only implements append-only mode. In-place LAI rewrites will be added in a later stage.');
      return null;
    }

    if (!NS.AIProvider?.ask) {
      setStatus('AIProvider is not loaded.');
      return null;
    }

    setStatus(`Running document-level AI using frontend /prompt/ file for: ${workflowLabel(workflow)}.`);
    const payload = await buildPromptPayload(workflow, instructions, mode);

    try {
      const response = await NS.AIProvider.ask(payload, {
        task: 'latex-copilot',
        context: {
          workflow: `document-ai-${workflow}`,
          mode,
          rootPath: rootPath(),
          promptSource: 'frontend-static-files',
          commonPromptFile: COMMON_PROMPT_PATH,
          workflowPromptFile: payload.promptSource.workflowPrompt
        }
      });
      lastRaw = NS.AIProvider.extractText(response);
      lastSection = cleanAiLatex(lastRaw);
      setOutput([
        'Document AI output',
        '==================',
        '',
        `Workflow: ${workflowLabel(workflow)}`,
        `Mode: ${mode}`,
        `Prompt source: frontend /prompt/ files`,
        `Workflow prompt: ${payload.promptSource.workflowPrompt}`,
        `Common prompt: ${COMMON_PROMPT_PATH}`,
        `Context: ${lastContextSummary}`,
        '',
        lastSection
      ].join('\n'));
      setStatus('Document AI generated a review section from frontend /prompt/ files. Click Append to paper to insert it in \\lai{...}.');
      return lastSection;
    } catch (err) {
      setStatus(`Document AI failed: ${err?.message || err}`);
      return null;
    }
  }

  function appendLastToPaper() {
    const root = rootFile();
    if (!root || !textFile(root)) {
      setStatus('No root LaTeX file found.');
      return { ok: false };
    }

    if (!lastSection.trim()) {
      setStatus('No document AI section to append yet. Run document AI first.');
      return { ok: false };
    }

    const workflow = el('documentAiWorkflow')?.value || 'review';
    const insertion = wrapAppendixSection(lastSection, workflow);
    const withMacro = ensureLai(fileText(root));
    const next = insertBeforeEndDocument(withMacro, insertion);

    State()?.updateFile?.(normalizePath(root.path), next);
    try { State()?.setActivePath?.(normalizePath(root.path)); } catch (_err) {}
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}

    setStatus(`Appended document AI section to ${normalizePath(root.path)}.`);
    toast('Document AI section appended.');
    return { ok: true, path: normalizePath(root.path) };
  }

  async function runAndAppendDocumentAi() {
    const section = await runDocumentAi();
    if (!section) return null;
    return appendLastToPaper();
  }

  async function copyDocumentAiOutput() {
    const text = lastSection || lastRaw || el('documentAiOutput')?.textContent || '';
    if (!text.trim()) {
      setStatus('No document AI output to copy yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Document AI output copied.');
    } catch (_err) {
      setStatus('Could not copy automatically. Select the output text manually.');
    }
  }

  function createCard() {
    const panel = el('copilotTab');
    if (!panel || el('documentAiCard')) return false;

    const card = document.createElement('div');
    card.className = 'document-ai-card';
    card.id = 'documentAiCard';
    card.innerHTML = [
      '<h3>Paper-level AI</h3>',
      '<div class="document-ai-grid">',
      '  <div class="document-ai-help">Stage 11D uses developer-managed static frontend prompt files in <code>/prompt/</code>. End users do not edit these prompts from the paper project; they can only provide one-off extra instructions below.</div>',
      '  <div class="document-ai-two">',
      '    <label>Workflow',
      '      <select id="documentAiWorkflow">',
      '        <option value="review">Review and suggested improvements</option>',
      '        <option value="remake">Total remake plan</option>',
      '        <option value="ranking">Ranking / acceptance improver</option>',
      '        <option value="competitive">Competitive agent improver</option>',
      '      </select>',
      '    </label>',
      '    <label>Mode',
      '      <select id="documentAiMode">',
      '        <option value="append">Append as final AI section</option>',
      '        <option value="inplace" disabled>In-place with LAI comments (later)</option>',
      '      </select>',
      '    </label>',
      '  </div>',
      '  <label>Extra one-off instructions',
      '    <textarea id="documentAiPrompt" placeholder="Example: focus on theorem statement clarity, missing citations, and how to improve the narrative. Frontend /prompt/ files provide the base prompt."></textarea>',
      '  </label>',
      '  <div class="document-ai-actions">',
      '    <button id="runDocumentAiBtn" class="btn mini primary" type="button">Run paper AI</button>',
      '    <button id="appendDocumentAiBtn" class="btn mini" type="button">Append to paper</button>',
      '    <button id="runAppendDocumentAiBtn" class="btn mini primary" type="button">Run + append</button>',
      '    <button id="copyDocumentAiBtn" class="btn mini" type="button">Copy output</button>',
      '  </div>',
      '  <div id="documentAiStatus" class="document-ai-status">Paper-level AI ready. Base prompts are developer-managed frontend files in /prompt/.</div>',
      '  <pre id="documentAiOutput" class="document-ai-output"></pre>',
      '</div>'
    ].join('');

    const copilotOutput = el('copilotOutput');
    if (copilotOutput?.nextSibling) panel.insertBefore(card, copilotOutput.nextSibling);
    else panel.appendChild(card);

    bindControls();
    return true;
  }

  function bindControls() {
    el('runDocumentAiBtn')?.addEventListener('click', runDocumentAi, true);
    el('appendDocumentAiBtn')?.addEventListener('click', appendLastToPaper, true);
    el('runAppendDocumentAiBtn')?.addEventListener('click', runAndAppendDocumentAi, true);
    el('copyDocumentAiBtn')?.addEventListener('click', copyDocumentAiOutput, true);
  }

  function init() {
    createCard();
  }

  NS.DocumentAIService = {
    STAGE,
    PROMPT_BASE,
    COMMON_PROMPT_PATH,
    WORKFLOW_PROMPTS,
    init,
    allPromptPaths,
    promptUrl,
    loadFrontendPrompt,
    loadWorkflowPrompts,
    collectProjectContext,
    buildPromptPayload,
    cleanAiLatex,
    wrapAppendixSection,
    insertBeforeEndDocument,
    runDocumentAi,
    appendLastToPaper,
    runAndAppendDocumentAi,
    copyDocumentAiOutput,
    getLastSection: () => lastSection,
    getLastRaw: () => lastRaw
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  let tries = 0;
  const interval = setInterval(() => {
    if (createCard()) clearInterval(interval);
    tries += 1;
    if (tries > 40) clearInterval(interval);
  }, 500);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
