/* Latexai Stage 11G DocumentAIService
 * Stage: stage11g-resolve-laiold-lai-edits-1
 *
 * Extends Stage 11D with a safe in-place mode for paper-level AI:
 * - prompts remain developer-managed static frontend files under /prompt/
 * - append mode behaves like Stage 11D/11A
 * - in-place mode asks AI for exact JSON edits
 * - each applied edit comments old content and inserts \lai{...}
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage11g-resolve-laiold-lai-edits-1';
  // Stage 11G behavior: preserving old content in blue via \\laiold{...}.

  const PROMPT_BASE = 'prompt/';
  const COMMON_PROMPT_PATH = 'prompt/ai-document-common.txt';
  const INPLACE_PROMPT_PATH = 'prompt/ai-inplace-rewrite-format.txt';
  const WORKFLOW_PROMPTS = {
    review: 'prompt/ai-review-and-suggestions.txt',
    remake: 'prompt/ai-total-remake-plan.txt',
    ranking: 'prompt/ai-ranking-acceptance-improver.txt',
    competitive: 'prompt/ai-competitive-agent-improver.txt'
  };

  const FALLBACK_PROMPTS = {
    [COMMON_PROMPT_PATH]: 'You are Latexai document-level AI. Return useful paper-level output. User instructions: {{USER_INSTRUCTIONS}}. Mode: {{MODE}}. Workflow: {{WORKFLOW}}.',
    [INPLACE_PROMPT_PATH]: 'Return JSON only with {"edits":[{"path":"main.tex","oldText":"exact existing text","newText":"replacement LaTeX","reason":"why"}],"summary":"..."}',
    [WORKFLOW_PROMPTS.review]: 'Workflow: Review and suggested improvements. Critically review the paper and return prioritized actionable suggestions.',
    [WORKFLOW_PROMPTS.remake]: 'Workflow: Total remake plan. Propose a large-scale paper remake plan.',
    [WORKFLOW_PROMPTS.ranking]: 'Workflow: Ranking / acceptance improver. Return ranked recommendations that would improve acceptance odds.',
    [WORKFLOW_PROMPTS.competitive]: 'Workflow: Competitive agent improver. Simulate critic, improver, mathematical clarity checker, and strategist agents.'
  };

  let lastRaw = '';
  let lastSection = '';
  let lastPatch = null;
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
    return [COMMON_PROMPT_PATH, INPLACE_PROMPT_PATH, ...Object.values(WORKFLOW_PROMPTS)];
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

  async function loadWorkflowPrompts(workflow, mode) {
    const workflowPath = WORKFLOW_PROMPTS[workflow] || WORKFLOW_PROMPTS.review;
    const paths = [COMMON_PROMPT_PATH, workflowPath];
    if (mode === 'inplace') paths.push(INPLACE_PROMPT_PATH);
    const loaded = await Promise.all(paths.map((path) => loadFrontendPrompt(path)));
    return {
      common: loaded[0],
      workflowPrompt: loaded[1],
      inplacePrompt: mode === 'inplace' ? loaded[2] : '',
      workflowPath
    };
  }

  function templateFill(template, values) {
    let out = String(template || '');
    for (const [key, value] of Object.entries(values || {})) {
      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      out = out.replace(pattern, String(value ?? ''));
    }
    return out;
  }

  function collectProjectContext(maxChars = 90000) {
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
      `% BEGIN LATEXAI-DOCUMENT-AI stage=11G workflow=${workflow || 'review'} generated=${stamp}`,
      '\\clearpage',
      '\\lai{',
      body,
      '}',
      `% END LATEXAI-DOCUMENT-AI stage=11G workflow=${workflow || 'review'}`,
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
    const { common, workflowPrompt, inplacePrompt, workflowPath } = await loadWorkflowPrompts(workflow, mode);

    const values = {
      USER_INSTRUCTIONS: userInstructions || '(none)',
      MODE: mode || 'append',
      WORKFLOW: workflowLabel(workflow),
      WORKFLOW_KEY: workflow || 'review',
      ROOT_FILE: rootPath(),
      PROMPT_FILE: workflowPath
    };

    const pieces = [
      templateFill(common, values),
      '',
      '--- Workflow-specific frontend prompt file ---',
      templateFill(workflowPrompt, values)
    ];

    if (mode === 'inplace') {
      pieces.push('', '--- In-place edit JSON format prompt file ---', templateFill(inplacePrompt, values));
    }

    pieces.push('', '--- Project context follows ---', context);

    return {
      instructions: mode === 'inplace'
        ? 'Return JSON only. No markdown fences. No prose outside JSON.'
        : 'Return LaTeX only. No markdown fences. No JSON.',
      input: pieces.join('\n'),
      promptSource: {
        kind: 'frontend-static-files',
        commonPrompt: COMMON_PROMPT_PATH,
        workflowPrompt: workflowPath,
        inplacePrompt: mode === 'inplace' ? INPLACE_PROMPT_PATH : ''
      },
      temperature: mode === 'inplace' ? 0.05 : 0.2,
      maxOutputTokens: mode === 'inplace' ? 7000 : 5000
    };
  }

  function stripJsonFence(raw) {
    let s = String(raw || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
    return s;
  }

  function parseInplacePatch(raw) {
    const s = stripJsonFence(raw);
    let data;
    try {
      data = JSON.parse(s);
    } catch (err) {
      return { ok: false, error: `Could not parse AI JSON patch: ${err.message}`, edits: [], summary: '' };
    }

    const edits = Array.isArray(data?.edits) ? data.edits : [];
    const normalized = [];
    for (const edit of edits) {
      const path = normalizePath(edit?.path || rootPath());
      const oldText = String(edit?.oldText || '');
      const newText = String(edit?.newText || '');
      const reason = String(edit?.reason || '');
      if (!path || !oldText.trim() || !newText.trim()) continue;
      normalized.push({ path, oldText, newText, reason });
    }

    return {
      ok: true,
      edits: normalized,
      summary: String(data?.summary || ''),
      raw: data
    };
  }

  function ensurePackageInPreamble(tex, packageName) {
    const s = String(tex || '');
    const pkgRe = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`);
    if (pkgRe.test(s)) return s;

    const docIdx = s.indexOf('\\begin{document}');
    const line = `\\usepackage{${packageName}}\n`;
    if (docIdx >= 0) return s.slice(0, docIdx) + line + s.slice(docIdx);

    const classMatch = s.match(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}\s*/);
    if (classMatch?.index !== undefined) {
      const at = classMatch.index + classMatch[0].length;
      return s.slice(0, at) + '\n' + line + s.slice(at);
    }

    return line + s;
  }

  function ensureLaiOldMacro(rootText) {
    let s = String(rootText || '');
    s = ensurePackageInPreamble(s, 'xcolor');

    if (/\\(?:long\\s*)?\\def\\s*\\laiold\b|\\newcommand\s*\\{\\laiold\\}|\\providecommand\s*\\{\\laiold\\}/.test(s)) {
      return s;
    }

    const macro = [
      '',
      '% --- Latexai old-content highlighting macro ---',
      '% Old paper content preserved by paper-level AI in-place edits.',
      '\\long\\def\\laiold#1{{\\color{blue}#1}}',
      '% --- end Latexai old-content highlighting macro ---',
      ''
    ].join('\n');

    const laiIdx = s.search(/% --- Latexai AI-change highlighting macro ---|\\long\\def\\lai#1|\\newcommand\s*\\{\\lai\\}/);
    if (laiIdx >= 0) {
      return s.slice(0, laiIdx) + macro + s.slice(laiIdx);
    }

    const docIdx = s.indexOf('\\begin{document}');
    if (docIdx >= 0) return s.slice(0, docIdx) + macro + s.slice(docIdx);

    return macro + s;
  }

  function oldTextBlock(oldText, id, path) {
    return [
      `% BEGIN LAI-OLD id=${id} path=${path}`,
      '\\laiold{',
      String(oldText || '').trim(),
      '}',
      `% END LAI-OLD id=${id}`
    ].join('\n');
  }

  function wrapInplaceReplacement(edit, index) {
    const id = `lai-doc-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`;
    const reason = edit.reason ? `% LAI reason: ${edit.reason}\n` : '';
    return [
      oldTextBlock(edit.oldText, id, edit.path),
      '',
      reason + '\\lai{',
      String(edit.newText || '').trim(),
      '}'
    ].join('\n');
  }

  function ensureRootLaiMacro() {
    const root = rootFile();
    if (!root || !textFile(root)) return false;
    let next = ensureLai(fileText(root));
    next = ensureLaiOldMacro(next);
    if (next !== fileText(root)) {
      State()?.updateFile?.(normalizePath(root.path), next);
    }
    return true;
  }

  function applyInplacePatch(patch = lastPatch) {
    if (!patch || !Array.isArray(patch.edits)) {
      setStatus('No in-place AI patch to apply. Run paper AI in in-place mode first.');
      return { ok: false, applied: 0, skipped: 0 };
    }

    ensureRootLaiMacro();

    let applied = 0;
    let skipped = 0;
    const messages = [];

    patch.edits.forEach((edit, index) => {
      const path = normalizePath(edit.path || rootPath());
      const file = State()?.getFile?.(path);
      if (!file || !textFile(file)) {
        skipped += 1;
        messages.push(`SKIP ${path}: file not found or not text.`);
        return;
      }

      const text = fileText(file);
      const oldText = String(edit.oldText || '');
      const at = text.indexOf(oldText);
      if (at < 0) {
        skipped += 1;
        messages.push(`SKIP ${path}: oldText was not an exact substring.`);
        return;
      }

      const replacement = wrapInplaceReplacement({ ...edit, path }, index);
      const next = text.slice(0, at) + replacement + text.slice(at + oldText.length);
      State()?.updateFile?.(path, next);
      applied += 1;
      messages.push(`APPLY ${path}: ${edit.reason || 'AI edit applied.'}`);
    });

    try { State()?.setActivePath?.(rootPath()); } catch (_err) {}
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}

    const report = [
      'In-place AI patch apply report',
      '==============================',
      '',
      `Applied: ${applied}`,
      `Skipped: ${skipped}`,
      '',
      ...messages
    ].join('\n');

    setOutput(report);
    setStatus(`Applied ${applied} in-place edit(s); skipped ${skipped}.`);
    if (applied) toast(`Applied ${applied} paper-level AI edit(s).`);
    return { ok: applied > 0, applied, skipped, messages };
  }

  async function runDocumentAi() {
    const workflow = el('documentAiWorkflow')?.value || 'review';
    const mode = el('documentAiMode')?.value || 'append';
    const instructions = String(el('documentAiPrompt')?.value || '').trim();

    if (!NS.AIProvider?.ask) {
      setStatus('AIProvider is not loaded.');
      return null;
    }

    setStatus(`Running document-level AI (${mode}) using frontend /prompt/ file for: ${workflowLabel(workflow)}.`);
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
          workflowPromptFile: payload.promptSource.workflowPrompt,
          inplacePromptFile: payload.promptSource.inplacePrompt
        }
      });
      lastRaw = NS.AIProvider.extractText(response);

      if (mode === 'inplace') {
        lastPatch = parseInplacePatch(lastRaw);
        lastSection = '';
        setOutput([
          'Document AI in-place patch output',
          '=================================',
          '',
          `Workflow: ${workflowLabel(workflow)}`,
          `Mode: ${mode}`,
          `Prompt source: frontend /prompt/ files`,
          `Workflow prompt: ${payload.promptSource.workflowPrompt}`,
          `In-place prompt: ${payload.promptSource.inplacePrompt}`,
          `Context: ${lastContextSummary}`,
          '',
          lastPatch.ok ? `Parsed edits: ${lastPatch.edits.length}` : lastPatch.error,
          lastPatch.summary ? `Summary: ${lastPatch.summary}` : '',
          '',
          'Raw AI output:',
          lastRaw
        ].join('\n'));
        setStatus(lastPatch.ok
          ? `Document AI returned ${lastPatch.edits.length} exact in-place edit(s). Click Apply to paper to insert with LAI comments.`
          : `Document AI did not return parseable JSON. ${lastPatch.error}`);
        return lastPatch;
      }

      lastPatch = null;
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
    const mode = el('documentAiMode')?.value || 'append';
    if (mode === 'inplace') return applyInplacePatch(lastPatch);

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
    const result = await runDocumentAi();
    if (!result) return null;
    return appendLastToPaper();
  }

  async function copyDocumentAiOutput() {
    const text = lastSection || (lastPatch ? JSON.stringify(lastPatch.raw || lastPatch, null, 2) : '') || lastRaw || el('documentAiOutput')?.textContent || '';
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

  function updateActionLabels() {
    const mode = el('documentAiMode')?.value || 'append';
    const apply = el('appendDocumentAiBtn');
    const runApply = el('runAppendDocumentAiBtn');
    if (apply) apply.textContent = mode === 'inplace' ? 'Apply to paper' : 'Append to paper';
    if (runApply) runApply.textContent = mode === 'inplace' ? 'Run + apply' : 'Run + append';
  }


  function findBraceBlock(text, command, searchFrom = 0) {
    const s = String(text || '');
    const needle = `\\${command}`;
    const cmdAt = s.indexOf(needle, searchFrom);
    if (cmdAt < 0) return null;

    let openAt = s.indexOf('{', cmdAt + needle.length);
    if (openAt < 0) return null;

    let depth = 0;
    for (let i = openAt; i < s.length; i += 1) {
      const ch = s[i];
      const prev = i > 0 ? s[i - 1] : '';
      if (ch === '{' && prev !== '\\') depth += 1;
      else if (ch === '}' && prev !== '\\') {
        depth -= 1;
        if (depth === 0) {
          return {
            command,
            cmdAt,
            openAt,
            closeAt: i,
            start: cmdAt,
            end: i + 1,
            inner: s.slice(openAt + 1, i)
          };
        }
      }
    }
    return null;
  }

  function scanResolvedPairsInText(text, path) {
    const s = String(text || '');
    const pairs = [];
    const markerRe = /% BEGIN LAI-OLD id=([^\s]+)\s+path=([^\n]+)\n/g;
    let match;

    while ((match = markerRe.exec(s))) {
      const markerStart = match.index;
      const id = match[1] || `lai-old-${pairs.length}`;
      const markerPath = normalizePath(match[2] || path || rootPath());

      const oldBlock = findBraceBlock(s, 'laiold', markerRe.lastIndex);
      if (!oldBlock) continue;

      const endMarker = `% END LAI-OLD id=${id}`;
      const endMarkerAt = s.indexOf(endMarker, oldBlock.end);
      if (endMarkerAt < 0) continue;
      const endMarkerEnd = s.indexOf('\n', endMarkerAt);
      const afterOld = endMarkerEnd >= 0 ? endMarkerEnd + 1 : endMarkerAt + endMarker.length;

      const nextOldAt = s.indexOf('% BEGIN LAI-OLD', afterOld);
      const nextLai = findBraceBlock(s, 'lai', afterOld);
      if (!nextLai) continue;
      if (nextOldAt >= 0 && nextOldAt < nextLai.start) continue;

      pairs.push({
        id,
        path: normalizePath(path || markerPath),
        markerPath,
        rangeStart: markerStart,
        rangeEnd: nextLai.end,
        oldText: oldBlock.inner.trim(),
        newText: nextLai.inner.trim(),
        oldPreview: oldBlock.inner.trim().slice(0, 180),
        newPreview: nextLai.inner.trim().slice(0, 180)
      });

      markerRe.lastIndex = nextLai.end;
    }

    return pairs;
  }

  function scanResolvableEdits() {
    const p = project();
    const files = (p.files || [])
      .filter((file) => textFile(file))
      .filter((file) => /\.tex$/i.test(file.path || ''));

    const pairs = [];
    for (const file of files) {
      const path = normalizePath(file.path);
      const found = scanResolvedPairsInText(fileText(file), path);
      pairs.push(...found);
    }
    return pairs;
  }

  function refreshResolveSelect() {
    const select = el('documentAiResolveSelect');
    if (!select) return [];
    const pairs = scanResolvableEdits();
    select.innerHTML = '';

    if (!pairs.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No unresolved \\laiold{...} / \\lai{...} edits found';
      select.appendChild(option);
      setResolvePreview(null);
      return pairs;
    }

    pairs.forEach((pair, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${index + 1}. ${pair.path} · ${pair.id}`;
      select.appendChild(option);
    });

    setResolvePreview(pairs[0]);
    return pairs;
  }

  function selectedResolvePair() {
    const pairs = scanResolvableEdits();
    const index = Number(el('documentAiResolveSelect')?.value || 0);
    return pairs[index] || null;
  }

  function setResolvePreview(pair) {
    const node = el('documentAiResolvePreview');
    if (!node) return;
    if (!pair) {
      node.classList.remove('active');
      node.textContent = '';
      return;
    }
    node.classList.add('active');
    node.textContent = [
      'Selected paper-level AI edit',
      '============================',
      '',
      `File: ${pair.path}`,
      `ID: ${pair.id}`,
      '',
      'BLUE old content (\\laiold):',
      pair.oldPreview || '(empty)',
      '',
      'RED new content (\\lai):',
      pair.newPreview || '(empty)'
    ].join('\n');
  }

  function resolvePair(pair, keep) {
    if (!pair || !['new', 'old'].includes(keep)) {
      setStatus('Choose an unresolved AI edit first.');
      return { ok: false, reason: 'missing-pair' };
    }

    const file = State()?.getFile?.(pair.path);
    if (!file || !textFile(file)) {
      setStatus(`Could not resolve edit: file not found: ${pair.path}`);
      return { ok: false, reason: 'file-not-found' };
    }

    const text = fileText(file);
    const current = scanResolvedPairsInText(text, pair.path).find((candidate) => candidate.id === pair.id);
    if (!current) {
      setStatus('Could not find that unresolved edit anymore. Refresh the list.');
      refreshResolveSelect();
      return { ok: false, reason: 'not-found' };
    }

    const kept = keep === 'new' ? current.newText : current.oldText;
    const next = text.slice(0, current.rangeStart) + kept + text.slice(current.rangeEnd);
    State()?.updateFile?.(pair.path, next);

    try { State()?.setActivePath?.(pair.path); } catch (_err) {}
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}

    setStatus(`Resolved ${current.id}: kept ${keep === 'new' ? 'new red \\lai content' : 'old blue \\laiold content'} as normal black LaTeX.`);
    toast(`Kept ${keep === 'new' ? 'new' : 'old'} content and removed Latexai markup.`);
    refreshResolveSelect();
    return { ok: true, path: pair.path, id: current.id, kept: keep };
  }

  function resolveSelectedKeepNew() {
    return resolvePair(selectedResolvePair(), 'new');
  }

  function resolveSelectedKeepOld() {
    return resolvePair(selectedResolvePair(), 'old');
  }

  function resolveAll(keep) {
    if (!['new', 'old'].includes(keep)) return { ok: false };
    let applied = 0;
    let guard = 0;

    while (guard < 500) {
      const pair = scanResolvableEdits()[0];
      if (!pair) break;
      const result = resolvePair(pair, keep);
      if (!result?.ok) break;
      applied += 1;
      guard += 1;
    }

    setStatus(`Resolved ${applied} paper-level AI edit(s), keeping ${keep === 'new' ? 'new red content' : 'old blue content'} as normal black LaTeX.`);
    refreshResolveSelect();
    return { ok: applied > 0, applied, kept: keep };
  }

  function resolveAllKeepNew() {
    return resolveAll('new');
  }

  function resolveAllKeepOld() {
    return resolveAll('old');
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
      '  <div class="document-ai-help">Stage 11G uses developer-managed static frontend prompt files in <code>/prompt/</code>. Append mode adds a final AI section. In-place mode applies exact AI JSON edits by commenting old content and inserting <code>\\lai{...}</code>.</div>',
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
      '        <option value="inplace">In-place with LAI comments</option>',
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
      '  <div class="document-ai-resolver">',
      '    <h4>Resolve AI edits</h4>',
      '    <div class="document-ai-help">Choose whether to keep the red new content or blue old content. The kept content becomes normal black LaTeX and the <code>\\lai</code>/<code>\\laiold</code> markup is removed.</div>',
      '    <label>Unresolved edit <select id="documentAiResolveSelect"></select></label>',
      '    <div class="document-ai-actions">',
      '      <button id="refreshDocumentAiResolveBtn" class="btn mini" type="button">Refresh edits</button>',
      '      <button id="keepNewDocumentAiBtn" class="btn mini primary" type="button">Keep red/new</button>',
      '      <button id="keepOldDocumentAiBtn" class="btn mini" type="button">Keep blue/old</button>',
      '      <button id="keepAllNewDocumentAiBtn" class="btn mini" type="button">Keep all red/new</button>',
      '      <button id="keepAllOldDocumentAiBtn" class="btn mini" type="button">Keep all blue/old</button>',
      '    </div>',
      '    <pre id="documentAiResolvePreview" class="document-ai-output"></pre>',
      '  </div>',
      '</div>'
    ].join('');

    const copilotOutput = el('copilotOutput');
    if (copilotOutput?.parentElement === panel && copilotOutput.nextSibling) panel.insertBefore(card, copilotOutput.nextSibling);
    else panel.appendChild(card);

    bindControls();
    updateActionLabels();
    refreshResolveSelect();
    return true;
  }

  function bindControls() {
    el('documentAiMode')?.addEventListener('change', updateActionLabels, true);
    el('runDocumentAiBtn')?.addEventListener('click', runDocumentAi, true);
    el('appendDocumentAiBtn')?.addEventListener('click', appendLastToPaper, true);
    el('runAppendDocumentAiBtn')?.addEventListener('click', runAndAppendDocumentAi, true);
    el('copyDocumentAiBtn')?.addEventListener('click', copyDocumentAiOutput, true);
    el('refreshDocumentAiResolveBtn')?.addEventListener('click', refreshResolveSelect, true);
    el('keepNewDocumentAiBtn')?.addEventListener('click', resolveSelectedKeepNew, true);
    el('keepOldDocumentAiBtn')?.addEventListener('click', resolveSelectedKeepOld, true);
    el('keepAllNewDocumentAiBtn')?.addEventListener('click', resolveAllKeepNew, true);
    el('keepAllOldDocumentAiBtn')?.addEventListener('click', resolveAllKeepOld, true);
    el('documentAiResolveSelect')?.addEventListener('change', () => setResolvePreview(selectedResolvePair()), true);
  }

  function init() {
    createCard();
  }

  NS.DocumentAIService = {
    STAGE,
    PROMPT_BASE,
    COMMON_PROMPT_PATH,
    INPLACE_PROMPT_PATH,
    WORKFLOW_PROMPTS,
    init,
    allPromptPaths,
    promptUrl,
    loadFrontendPrompt,
    loadWorkflowPrompts,
    collectProjectContext,
    buildPromptPayload,
    cleanAiLatex,
    parseInplacePatch,
    applyInplacePatch,
    wrapInplaceReplacement,
    wrapAppendixSection,
    insertBeforeEndDocument,
    runDocumentAi,
    appendLastToPaper,
    runAndAppendDocumentAi,
    copyDocumentAiOutput,
    scanResolvedPairsInText,
    scanResolvableEdits,
    refreshResolveSelect,
    resolvePair,
    resolveSelectedKeepNew,
    resolveSelectedKeepOld,
    resolveAllKeepNew,
    resolveAllKeepOld,
    getLastSection: () => lastSection,
    getLastRaw: () => lastRaw,
    getLastPatch: () => lastPatch
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
