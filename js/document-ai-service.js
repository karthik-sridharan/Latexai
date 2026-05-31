/* Latexai Stage 19T3C DocumentAIService
 * Stage: stage19t2o-resolver-macro-unwrapper-hard-fix-20260530-1
 *
 * Stage 19T3A: paper-level AI uses raw LATEXAI_BLOCK_PATCH text for in-place edits.
 * The app/backend, not the AI model, validates patches and inserts \lai{...}.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19u4-hybrid-literature-retrieval-ranking-20260531-1';
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
    [INPLACE_PROMPT_PATH]: 'Return the LATEXAI_BLOCK_PATCH protocol only for paper source edits. Do not return JSON and do not emit \\lai or \\laiold. Use replace_block, insert_after_block, insert_before_block, insert_before_section, or append_before_end_document as appropriate.',
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
  let suppressResolverEditorSyncUntil = 0;

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


  function cleanString(value) {
    return String(value ?? '').trim();
  }

  function getStored(key, fallback = '') {
    try {
      const value = W.localStorage?.getItem?.(key);
      return value == null || value === '' ? fallback : value;
    } catch (_err) {
      return fallback;
    }
  }

  function resolverFeedbackStatus(message, kind = '') {
    const node = el('documentAiResolveFeedbackStatus');
    if (node) {
      node.textContent = String(message || '');
      node.dataset.kind = kind || '';
    }
  }

  function resolverBackendRoot() {
    const fromSettings = cleanString(NS.BackendUrlSettingsService?.getMemoryApiBaseUrl?.() || '');
    const raw = cleanString(el('memoryBackendUrl')?.value) || fromSettings || cleanString(getStored('latexai:memory-backend-url', ''));
    const base = raw.replace(/\/+$/, '');
    if (!base) return '';
    if (/\/api\/lumina\/memory$/i.test(base)) return base.replace(/\/api\/lumina\/memory$/i, '/api/lumina');
    if (/\/api\/lumina$/i.test(base)) return base;
    if (/\/api\/lumina\/latex\/compile$/i.test(base)) return base.replace(/\/api\/lumina\/latex\/compile$/i, '/api/lumina');
    return base + '/api/lumina';
  }

  function resolverAuthHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const token = cleanString(NS.BackendUrlSettingsService?.getMemoryProxyToken?.() || '') || cleanString(el('memoryProxyToken')?.value) || cleanString(getStored('latexai:memory-proxy-token', ''));
    if (token) {
      h.Authorization = 'Bearer ' + token;
      h['X-Lumina-Token'] = token;
    }
    return h;
  }

  function compactPreview(value, limit = 700) {
    const s = String(value || '').replace(/\s+/g, ' ').trim();
    return s.length > limit ? s.slice(0, limit) + '…' : s;
  }

  function resolverOutcomeTypeFor(pair, keep) {
    // Keep red/new accepts the AI proposal for standalone insertions, replacements,
    // and old-only deletion markers. Keep blue/old rejects the AI proposal.
    return keep === 'new' ? 'accepted' : 'rejected';
  }

  function resolverRewardValueFor(pair, keep) {
    if (keep === 'new') {
      if (pair?.type === 'old-new-pair') return 1.05;
      if (pair?.type === 'standalone-new') return 0.85;
      if (pair?.type === 'standalone-old') return 0.75;
      return 0.8;
    }
    if (pair?.type === 'old-new-pair') return -0.65;
    if (pair?.type === 'standalone-new') return -0.55;
    if (pair?.type === 'standalone-old') return -0.45;
    return -0.5;
  }

  function resolverFeedbackPayload(pair, keep, keptText) {
    const p = project();
    const outcomeType = resolverOutcomeTypeFor(pair, keep);
    const rewardValue = resolverRewardValueFor(pair, keep);
    const accepted = outcomeType === 'accepted';
    const editType = pair?.type || 'unknown';
    const path = pair?.path || '';
    const actionType = `resolver_${outcomeType}_${editType}`;
    const rewardLabel = accepted ? 'positive' : 'negative';
    const base = {
      outcomeType,
      rewardValue,
      rewardLabel,
      accepted,
      workflow: 'latexai-source-scanned-ai-edit-resolver',
      stepName: 'resolve-ai-edit',
      actionType,
      eventType: 'resolver_ai_edit_outcome',
      insertionMode: 'resolver',
      editMode: editType,
      source: 'document-ai-resolver',
      path,
      compileStatus: 'not_checked',
      validationStatus: 'resolved',
      githubStatus: '',
      actionId: pair?.id || '',
      relatedActionId: pair?.id || '',
      sectionId: path,
      projectId: p?.id || p?.projectId || '',
      paperId: p?.paperId || p?.rootFile || rootPath(),
      note: `Stage 19N1P2 resolver outcome: ${outcomeType}; kept=${keep}; type=${editType}; path=${path}; line=${pair?.line || '?'}`,
    };
    return {
      ...base,
      metadata: {
        frontendStage: STAGE,
        resolverVersion: 'stage19n1p2-v1',
        source: base.source,
        editId: pair?.id || '',
        editType,
        command: pair?.command || '',
        kept: keep,
        outcomeType,
        accepted,
        path,
        line: pair?.line || null,
        rangeStart: pair?.rangeStart || 0,
        rangeEnd: pair?.rangeEnd || 0,
        oldLength: String(pair?.oldText || '').length,
        newLength: String(pair?.newText || '').length,
        keptLength: String(keptText || '').length,
        oldPreview: compactPreview(pair?.oldText || pair?.oldPreview || ''),
        newPreview: compactPreview(pair?.newText || pair?.newPreview || ''),
        keptPreview: compactPreview(keptText || ''),
      }
    };
  }

  async function postJsonForResolverFeedback(url, payload) {
    const res = await fetch(url, {
      method: 'POST',
      headers: resolverAuthHeaders(),
      body: JSON.stringify(payload || {}),
      keepalive: true
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : {}; } catch (_err) { data = { raw: text }; }
    if (!res.ok || data?.ok === false) throw new Error(data?.error?.message || data?.detail || data?.message || ('HTTP ' + res.status));
    return data || {};
  }

  async function postResolverFeedback(payload) {
    const root = resolverBackendRoot();
    if (!root) {
      resolverFeedbackStatus('Resolver outcome not recorded: no Memory/backend URL configured.', 'warn');
      return { ok: false, skipped: true, reason: 'missing-backend-url' };
    }

    // Stage 19N1P2 writes directly to the canonical memory reward endpoints.
    // 19N1P used /debate/record-branch-outcome, which may not populate edit_outcomes.
    const editOutcome = await postJsonForResolverFeedback(root + '/memory/edit-outcome', payload);
    let rewardEvent = null;
    try {
      rewardEvent = await postJsonForResolverFeedback(root + '/memory/reward', {
        ...payload,
        id: undefined,
        eventType: 'resolver_ai_edit_outcome',
        relatedActionId: payload?.actionId || payload?.relatedActionId || '',
        relatedAgentRunId: payload?.agentRunId || payload?.relatedAgentRunId || '',
      });
    } catch (rewardErr) {
      // Keep the edit_outcomes write as success; reward_events is useful but not required.
      console.warn('[Latexai] Resolver reward event logging failed after edit outcome succeeded', rewardErr);
      rewardEvent = { ok: false, warning: String(rewardErr?.message || rewardErr) };
    }
    return {
      ok: true,
      stage: STAGE,
      editOutcome,
      rewardEvent,
      rewardValue: editOutcome?.rewardValue ?? payload?.rewardValue,
    };
  }

  function recordResolverFeedback(pair, keep, keptText) {
    const payload = resolverFeedbackPayload(pair, keep, keptText);
    resolverFeedbackStatus('Recording resolver outcome feedback…', 'pending');
    postResolverFeedback(payload)
      .then((data) => {
        if (data?.skipped) return;
        resolverFeedbackStatus(`Recorded resolver outcome: ${payload.outcomeType}, reward=${data?.rewardValue ?? payload.rewardValue}.`, 'good');
      })
      .catch((err) => {
        // Never block the user from resolving source edits because reward logging failed.
        console.warn('[Latexai] Resolver outcome feedback recording failed', err);
        resolverFeedbackStatus(`Resolver outcome resolved locally; reward feedback not recorded (${err?.message || err}).`, 'warn');
      });
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


  function rawPatchPipeline() {
    return NS.LaiSafeEditPipelineService || null;
  }

  function knowledgeService() { return NS.KnowledgeContextService || null; }
  function knowledgePromptBlock(data) {
    return knowledgeService()?.promptBlock?.(data) || 'Knowledge/literature context unavailable.';
  }
  async function retrieveDocumentKnowledge(workflow, userInstructions, context) {
    const svc = knowledgeService();
    if (!svc?.retrieve) return null;
    return await svc.retrieve({
      feature: 'documentAi',
      workflow: 'document-ai-' + (workflow || 'review'),
      query: [workflowLabel(workflow), userInstructions || ''].filter(Boolean).join('\n'),
      focus: userInstructions || '',
      latexSource: context,
      metadata: { documentAiStage: STAGE, workflow: workflow || 'review' }
    });
  }

  function rawPatchProtocolInstructions(goal) {
    return rawPatchPipeline()?.rawPatchProtocolInstructions?.({
      goal: goal || 'document-level paper improvement',
      extra: 'For document AI in-place mode, return actionable source-edit patch blocks containing final paper-ready LaTeX, not a meta-plan. Never use append_review_note. For total-remake in-place mode, do not insert a "Remake Plan" section unless the user explicitly asks for a plan; instead produce actual rewritten sections/paragraphs. For append/review mode, the app may wrap the review as append_before_end_document; do not emit Latexai internal change macros yourself. Split large generated sections into smaller blocks.'
    }) || [
      'Return source edits using LATEXAI_BLOCK_PATCH blocks, not JSON.',
      'Do not output \\lai or \\laiold; Latexai will add visible change markup after safe validation.'
    ].join('\n');
  }

  function rawPatchBlock(options) {
    return rawPatchPipeline()?.rawPatchBlock?.(options) || String(options?.latex || '');
  }

  async function compileDocumentAiOutput(rawText, workflow, mode) {
    const pipe = rawPatchPipeline();
    if (!pipe?.compileRawPatch) return { ok: false, safeToInsert: false, error: 'LaiSafeEditPipelineService is not loaded.' };
    return await pipe.compileRawPatch({
      finalOutput: rawText,
      workflow: 'document-ai-' + (workflow || 'review') + '-' + (mode || 'append'),
      insertionMode: 'targeted',
      allowAiRepair: true,
      metadata: { documentAiStage: STAGE, mode: mode || 'append', workflow: workflow || 'review' }
    });
  }

  async function applyCompiledDocumentAiPatch(compiled, mode) {
    const pipe = rawPatchPipeline();
    if (!pipe?.applyCompiledDraft) return { ok: false, error: 'LaiSafeEditPipelineService is not loaded.' };
    return pipe.applyCompiledDraft(compiled, { kind: mode === 'append' ? 'append' : 'targeted', preferRoot: true });
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
    const knowledgeData = await retrieveDocumentKnowledge(workflow, userInstructions, context);
    const knowledgeBlock = knowledgeData ? knowledgePromptBlock(knowledgeData) : '';

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
      pieces.push('', '--- In-place raw patch protocol prompt file ---', templateFill(inplacePrompt, values), '', rawPatchProtocolInstructions('in-place document-level paper rewrite/edit'));
    }

    if (knowledgeBlock) {
      pieces.push('', '--- Retrieved literature / knowledge context ---', knowledgeBlock, '', 'Use the retrieved literature to improve positioning, identify missing comparisons/citations, and make concrete paper edits. Do not invent claims beyond the retrieved snippets.');
    }

    pieces.push('', '--- Project context follows ---', context);

    return {
      instructions: mode === 'inplace'
        ? 'Return LATEXAI_BLOCK_PATCH markup for source edits. No JSON. No \\lai or \\laiold; the app will add change markup after safe validation.'
        : 'Return LaTeX/prose only. No markdown fences. No JSON. The app will wrap append output safely.',
      input: pieces.join('\n'),
      promptSource: {
        kind: 'frontend-static-files',
        commonPrompt: COMMON_PROMPT_PATH,
        workflowPrompt: workflowPath,
        inplacePrompt: mode === 'inplace' ? INPLACE_PROMPT_PATH : '',
        knowledgeContext: knowledgeData ? { enabled: true, resultCount: knowledgeData.resultCount || 0, topK: knowledgeData.topK || 0 } : { enabled: false }
      },
      temperature: mode === 'inplace' ? 0 : 0.2,
      maxOutputTokens: mode === 'inplace' ? 10000 : 5000
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

  async function applyInplacePatch(patch = lastPatch) {
    if (!patch) {
      setStatus('No in-place raw-patch output to apply. Run paper AI in in-place mode first.');
      return { ok: false };
    }
    const result = await applyCompiledDocumentAiPatch(patch, 'targeted');
    if (!result.ok) {
      setStatus('Safe Edit Compiler did not allow applying this Document AI patch: ' + (result.error || 'blocked'));
      setOutput([
        'Document AI safe apply blocked',
        '==============================',
        '',
        result.error || 'Safe compiler blocked insertion.',
        '',
        'Compiler diagnostics:',
        JSON.stringify(patch, null, 2).slice(0, 8000)
      ].join('\n'));
      return result;
    }
    setStatus(`Applied ${result.blockCount || 0} compiler-managed Document AI edit block(s). Use Resolve AI edits to accept/reject.`);
    toast('Document AI safe edits inserted.');
    return result;
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
        lastSection = '';
        lastPatch = await compileDocumentAiOutput(lastRaw, workflow, mode);
        setOutput([
          'Document AI raw-patch output',
          '============================',
          '',
          `Workflow: ${workflowLabel(workflow)}`,
          `Mode: ${mode}`,
          `Prompt source: frontend /prompt/ files`,
          `Workflow prompt: ${payload.promptSource.workflowPrompt}`,
          `In-place prompt: ${payload.promptSource.inplacePrompt}`,
          `Context: ${lastContextSummary}`,
          '',
          `Safe compiler: safeToInsert=${Boolean(lastPatch.safeToInsert)}, blocks=${lastPatch.blockCount || lastPatch.compiledEditCount || 0}`,
          lastPatch.repairAttempted ? `Repair: ${lastPatch.repairStatus || 'attempted'}` : '',
          (lastPatch.validationErrors || []).length ? `Validation errors: ${(lastPatch.validationErrors || []).join('; ')}` : '',
          (lastPatch.warnings || []).length ? `Warnings: ${(lastPatch.warnings || []).slice(0, 6).join('; ')}` : '',
          '',
          'Raw AI output:',
          lastRaw
        ].filter(Boolean).join('\n'));
        setStatus(lastPatch.safeToInsert
          ? `Document AI produced ${lastPatch.blockCount || lastPatch.compiledEditCount || 0} safe raw-patch edit(s). Click Apply to paper to insert app-managed \lai markup.`
          : 'Document AI output was blocked by the Safe Edit Compiler. No source changes made.');
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

  async function appendLastToPaper() {
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
    const body = cleanAiLatex(lastSection);
    const rawPatch = rawPatchBlock({
      operation: 'append_before_end_document',
      targetSection: 'Document AI Review',
      rationale: 'Append document-level AI output using app-managed Latexai change markup.',
      latex: body,
      patchId: 'document-ai-append'
    });
    lastPatch = await compileDocumentAiOutput(rawPatch, workflow, 'append');
    const result = await applyCompiledDocumentAiPatch(lastPatch, 'append');
    if (!result.ok) {
      setStatus('Safe Edit Compiler blocked Document AI append. No source changes were made.');
      setOutput([
        lastSection,
        '',
        '--- Safe compiler blocked Document AI append ---',
        JSON.stringify(lastPatch, null, 2).slice(0, 8000)
      ].join('\n'));
      return result;
    }
    setStatus(`Appended Document AI output through Safe Edit Compiler to ${normalizePath(root.path)}.`);
    toast('Document AI safe append inserted.');
    return result;
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

  function syncActiveEditorToStateForResolve() {
    try {
      if (Date.now() < suppressResolverEditorSyncUntil) return false;
      const editor = NS.Editor?.editor || document.getElementById('sourceEditor');
      const path = normalizePath(project().activePath || rootPath());
      if (!editor || !path) return false;
      const file = State()?.getFile?.(path);
      if (!file || !textFile(file)) return false;
      const liveText = String(editor.value ?? '');
      if (liveText && liveText !== fileText(file)) {
        State()?.updateFile?.(path, liveText);
        return true;
      }
    } catch (_err) {}
    return false;
  }

  function braceBlockAt(text, command, cmdAt) {
    const s = String(text || '');
    const needle = `\\${command}`;
    if (!s.startsWith(needle, cmdAt)) return null;
    if (command === 'lai' && s.startsWith('\\laiold', cmdAt)) return null;

    const afterCommand = cmdAt + needle.length;
    const nextChar = s[afterCommand] || '';
    if (/[A-Za-z@]/.test(nextChar)) return null;

    let cursor = afterCommand;
    while (/\s/.test(s[cursor] || '')) cursor += 1;
    if (s[cursor] !== '{') return null;

    const openAt = cursor;
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

  function findNextLaiBlock(text, searchFrom = 0) {
    const s = String(text || '');
    let best = null;
    for (const command of ['laiold', 'lai']) {
      const needle = `\\${command}`;
      let cursor = Math.max(0, Number(searchFrom) || 0);
      while (cursor < s.length) {
        const at = s.indexOf(needle, cursor);
        if (at < 0) break;
        if (command === 'lai' && s.startsWith('\\laiold', at)) {
          cursor = at + 4;
          continue;
        }
        const block = braceBlockAt(s, command, at);
        if (block) {
          if (!best || block.start < best.start) best = block;
          break;
        }
        cursor = at + needle.length;
      }
    }
    return best;
  }

  function lineNumberAt(text, index) {
    return String(text || '').slice(0, Math.max(0, index || 0)).split('\n').length;
  }

  function stableEditId(path, type, start, index) {
    const base = `${normalizePath(path || rootPath())}:${type}:${start}:${index}`;
    let h = 2166136261;
    for (let i = 0; i < base.length; i += 1) {
      h ^= base.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `lai-src-${(h >>> 0).toString(36)}-${index}`;
  }

  function expandResolveStartForOldMarker(text, oldBlock) {
    const s = String(text || '');
    const start = oldBlock?.start || 0;
    const before = s.slice(Math.max(0, start - 700), start);
    const marker = before.match(/% BEGIN LAI-OLD id=([^\s]+)\s+path=([^\n]+)\n\s*$/);
    if (!marker) return { rangeStart: start, markerId: '', markerPath: '' };
    return {
      rangeStart: start - marker[0].length,
      markerId: marker[1] || '',
      markerPath: normalizePath(marker[2] || '')
    };
  }

  function expandResolveEnd(text, end) {
    const s = String(text || '');
    let out = Math.max(0, Number(end) || 0);
    while (out < s.length && /[ \t]/.test(s[out])) out += 1;
    if (s[out] === '\r') out += 1;
    if (s[out] === '\n') out += 1;
    return out;
  }

  function safeCompiledEditStartLine(text, blockStart) {
    const s = String(text || '');
    const lineStart = s.lastIndexOf('\n', Math.max(0, Number(blockStart) || 0) - 1) + 1;
    if (lineStart <= 0) return null;
    const prevStart = s.lastIndexOf('\n', lineStart - 2) + 1;
    const prevLine = s.slice(prevStart, lineStart).replace(/\r?\n$/, '');
    if (/^\s*%\s*---\s*Latexai\s+safe\s+compiled\s+edit\b.*---\s*$/i.test(prevLine)) {
      return prevStart;
    }
    return null;
  }

  function safeCompiledEditEndLine(text, rangeEnd) {
    const s = String(text || '');
    let cursor = Math.max(0, Number(rangeEnd) || 0);
    while (cursor < s.length && /[ \t]/.test(s[cursor])) cursor += 1;
    const lineEndAt = s.indexOf('\n', cursor);
    const lineEnd = lineEndAt >= 0 ? lineEndAt + 1 : s.length;
    const line = s.slice(cursor, lineEnd).replace(/\r?\n$/, '');
    if (/^\s*%\s*---\s*end\s+Latexai\s+safe\s+compiled\s+edit\s*---\s*$/i.test(line)) {
      return lineEnd;
    }
    return rangeEnd;
  }

  function expandStandaloneNewRange(text, block) {
    const baseEnd = expandResolveEnd(text, block?.end || 0);
    const startWithWrapper = safeCompiledEditStartLine(text, block?.start || 0);
    const endWithWrapper = safeCompiledEditEndLine(text, baseEnd);
    return {
      rangeStart: startWithWrapper == null ? (block?.start || 0) : startWithWrapper,
      rangeEnd: endWithWrapper
    };
  }

  function normalizeResolverPath(path) {
    return normalizePath(path || rootPath());
  }

  function activeResolverPath() {
    try { return normalizeResolverPath(project().activePath || rootPath()); }
    catch (_err) { return normalizeResolverPath(rootPath()); }
  }

  function forceEditorSourceForResolvedPath(path, text, cursorAt) {
    const normalized = normalizeResolverPath(path);
    let active = activeResolverPath();
    try {
      if (State()?.getFile?.(normalized) && active !== normalized) {
        State()?.setActivePath?.(normalized);
        active = activeResolverPath();
      }
    } catch (_err) {}

    if (active !== normalized) return false;
    const editor = NS.Editor?.editor || document.getElementById('sourceEditor');
    if (!editor) return false;

    const nextText = String(text ?? '');
    const oldScrollTop = Number(editor.scrollTop || 0);

    // Prefer the public editor API when available. In deployed stages the visible
    // textarea and project state can otherwise get out of sync after resolver edits.
    try { NS.Editor?.setText?.(nextText); } catch (_err) {}

    editor.value = nextText;
    try {
      const cursor = Math.max(0, Math.min(Number(cursorAt) || 0, editor.value.length));
      editor.setSelectionRange(cursor, cursor);
    } catch (_err) {}
    try { editor.dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    try { editor.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
    try { editor.scrollTop = oldScrollTop; } catch (_err) {}
    return true;
  }

  function applyResolvedSource(path, text, cursorAt) {
    const normalized = normalizeResolverPath(path);
    let ok = false;
    try { ok = !!State()?.updateFile?.(normalized, text); } catch (_err) { ok = false; }
    if (!ok) {
      const file = State()?.getFile?.(normalized);
      if (file && textFile(file)) {
        file.text = String(text ?? '');
        try { file.updatedAt = new Date().toISOString(); } catch (_err) {}
        ok = true;
      }
    }

    // Do not let resolver refresh immediately re-import stale visible text after
    // accepting/rejecting an edit.
    suppressResolverEditorSyncUntil = Date.now() + 1500;

    forceEditorSourceForResolvedPath(normalized, text, cursorAt);
    try { NS.Editor?.render?.(); } catch (_err) {}
    forceEditorSourceForResolvedPath(normalized, text, cursorAt);
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}
    return ok;
  }

  function unwrapResolverMacroInner(value) {
    let s = String(value ?? '');
    // Most safe insertions are emitted as \lai{%\n...\n}; the leading percent
    // is a TeX whitespace guard and should not survive as accepted content.
    s = s.replace(/^\s*%\s*(?:\r?\n|$)/, '');
    // Also tolerate a trailing standalone whitespace-guard percent before the
    // closing brace in older generated blocks.
    s = s.replace(/(?:\r?\n)?\s*%\s*$/, '');
    return s.trim();
  }

  function resolveReplacementTextForKeep(pair, keep) {
    if (!pair || !['new', 'old'].includes(keep)) return '';
    if (pair.type === 'standalone-new') return keep === 'new' ? unwrapResolverMacroInner(pair.newText) : '';
    if (pair.type === 'standalone-old') return keep === 'old' ? unwrapResolverMacroInner(pair.oldText) : '';
    return keep === 'new' ? unwrapResolverMacroInner(pair.newText) : unwrapResolverMacroInner(pair.oldText);
  }

  function scanResolvedPairsInText(text, path) {
    const s = String(text || '');
    const pairs = [];
    let cursor = 0;
    let index = 0;

    while (cursor < s.length) {
      const block = findNextLaiBlock(s, cursor);
      if (!block) break;

      if (block.command === 'laiold') {
        const expanded = expandResolveStartForOldMarker(s, block);
        const next = findNextLaiBlock(s, block.end);
        if (next && next.command === 'lai') {
          const id = expanded.markerId || stableEditId(path, 'pair', expanded.rangeStart, index);
          const markerPath = expanded.markerPath || normalizePath(path || rootPath());
          pairs.push({
            id,
            type: 'old-new-pair',
            path: normalizePath(path || markerPath),
            markerPath,
            rangeStart: expanded.rangeStart,
            rangeEnd: expandResolveEnd(s, next.end),
            oldText: unwrapResolverMacroInner(block.inner),
            newText: unwrapResolverMacroInner(next.inner),
            oldPreview: unwrapResolverMacroInner(block.inner).slice(0, 180),
            newPreview: unwrapResolverMacroInner(next.inner).slice(0, 180),
            line: lineNumberAt(s, expanded.rangeStart),
            command: '\\laiold + \\lai'
          });
          cursor = next.end;
          index += 1;
          continue;
        }

        const id = expanded.markerId || stableEditId(path, 'old', expanded.rangeStart, index);
        pairs.push({
          id,
          type: 'standalone-old',
          path: normalizePath(path || rootPath()),
          markerPath: expanded.markerPath || normalizePath(path || rootPath()),
          rangeStart: expanded.rangeStart,
          rangeEnd: expandResolveEnd(s, block.end),
          oldText: unwrapResolverMacroInner(block.inner),
          newText: '',
          oldPreview: unwrapResolverMacroInner(block.inner).slice(0, 180),
          newPreview: '(no paired \\lai new content; keep red/new will remove this old-only marker)',
          line: lineNumberAt(s, expanded.rangeStart),
          command: '\\laiold'
        });
        cursor = block.end;
        index += 1;
        continue;
      }

      if (block.command === 'lai') {
        const id = stableEditId(path, 'new', block.start, index);
        const expandedNew = expandStandaloneNewRange(s, block);
        pairs.push({
          id,
          type: 'standalone-new',
          path: normalizePath(path || rootPath()),
          markerPath: normalizePath(path || rootPath()),
          rangeStart: expandedNew.rangeStart,
          rangeEnd: expandedNew.rangeEnd,
          oldText: '',
          newText: unwrapResolverMacroInner(block.inner),
          oldPreview: '(no blue \\laiold content; keep blue/old will reject/remove this insertion)',
          newPreview: unwrapResolverMacroInner(block.inner).slice(0, 180),
          line: lineNumberAt(s, expandedNew.rangeStart),
          command: '\\lai'
        });
        cursor = Math.max(block.end, expandedNew.rangeEnd);
        index += 1;
        continue;
      }

      cursor = block.end || (cursor + 1);
    }

    return pairs;
  }

  function scanResolvableEdits() {
    syncActiveEditorToStateForResolve();
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
      option.textContent = 'No unresolved \\lai / \\laiold edits found in current .tex source';
      select.appendChild(option);
      setResolvePreview(null);
      return pairs;
    }

    pairs.forEach((pair, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${index + 1}. ${pair.path}:${pair.line || '?'} · ${pair.command || pair.type} · ${pair.id}`;
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
    const help = pair.type === 'standalone-new'
      ? 'Standalone \\lai insertion: Keep red/new accepts it as normal text; Keep blue/old rejects/removes it.'
      : pair.type === 'standalone-old'
        ? 'Standalone \\laiold block: Keep blue/old restores it as normal text; Keep red/new removes it.'
        : 'Replacement pair: Keep red/new accepts the proposed replacement; Keep blue/old restores the original.';
    node.textContent = [
      'Selected source-scanned AI edit',
      '===============================',
      '',
      `File: ${pair.path}`,
      `Line: ${pair.line || '?'}`,
      `Type: ${pair.type || 'unknown'}`,
      `ID: ${pair.id}`,
      '',
      help,
      '',
      'BLUE old content (\\laiold):',
      pair.oldPreview || '(empty / not present)',
      '',
      'RED new content (\\lai):',
      pair.newPreview || '(empty / not present)'
    ].join('\n');
  }

  function containsResolverUnsafeControlCharacters(text) {
    const s = String(text || '');
    // Stage 19T2P: resolver acceptance is a LOCAL unwrapping operation. At this
    // point the source already contains visible \lai / \laiold markup; the user is
    // explicitly choosing which side to keep. Do not reject normal LaTeX/prose
    // simply because it contains words like "newtheorem" or "title" at line start.
    // That older heuristic repeatedly blocked legitimate Keep red/new clicks.
    // Only reject impossible source-level control bytes; ordinary tabs/newlines are fine.
    return new RegExp('[\x00-\x08\x0b\x0c\x0e-\x1f]').test(s);
  }

  function validateResolverNextSource(before, after, kept) {
    const b = String(before || '');
    const a = String(after || '');
    const k = String(kept || '');
    if (containsResolverUnsafeControlCharacters(k)) {
      return 'Blocked resolver accept/reject: kept text contains unsafe control characters.';
    }
    // Keep only the structural-command preservation guard. This catches a truly
    // bad range parse that would delete the preamble or document boundary, while
    // allowing normal \lai unwrapping to proceed.
    const structural = ['\\documentclass', '\\begin{document}', '\\end{document}', '\\title', '\\author', '\\date', '\\newtheorem'];
    for (const cmd of structural) {
      if (b.includes(cmd) && !a.includes(cmd)) return 'Blocked resolver: accepting this edit would remove structural command ' + cmd + '.';
    }
    return '';
  }

  function resolvePair(pair, keep) {
    if (!pair || !['new', 'old'].includes(keep)) {
      setStatus('Choose an unresolved AI edit first.');
      return { ok: false, reason: 'missing-pair' };
    }

    syncActiveEditorToStateForResolve();
    const file = State()?.getFile?.(pair.path);
    if (!file || !textFile(file)) {
      setStatus(`Could not resolve edit: file not found: ${pair.path}`);
      return { ok: false, reason: 'file-not-found' };
    }

    const text = fileText(file);
    const current = scanResolvedPairsInText(text, pair.path).find((candidate) => candidate.id === pair.id)
      || scanResolvedPairsInText(text, pair.path).find((candidate) => Number(candidate.rangeStart) === Number(pair.rangeStart) && candidate.type === pair.type);
    if (!current) {
      setStatus('Could not find that unresolved edit anymore. Refresh the list.');
      refreshResolveSelect();
      return { ok: false, reason: 'not-found' };
    }

    const kept = resolveReplacementTextForKeep(current, keep);
    const next = text.slice(0, current.rangeStart) + kept + text.slice(current.rangeEnd);
    const resolverSafetyProblem = validateResolverNextSource(text, next, kept);
    if (resolverSafetyProblem) {
      setStatus(resolverSafetyProblem);
      toast(resolverSafetyProblem);
      return { ok: false, reason: 'json-backslash-damage-guard', message: resolverSafetyProblem };
    }
    const applied = applyResolvedSource(current.path || pair.path, next, current.rangeStart + String(kept || '').length);
    if (!applied) {
      setStatus(`Could not resolve edit: failed to update ${current.path || pair.path}.`);
      return { ok: false, reason: 'update-failed' };
    }

    const actionLabel = current.type === 'standalone-new' && keep === 'old' ? 'rejected standalone red \\lai insertion'
      : current.type === 'standalone-old' && keep === 'new' ? 'removed standalone blue \\laiold block'
      : `kept ${keep === 'new' ? 'new red \\lai content' : 'old blue \\laiold content'} as normal black LaTeX`;
    setStatus(`Resolved ${current.id}: ${actionLabel}.`);
    toast(`Resolved AI edit: ${actionLabel}.`);
    recordResolverFeedback(current, keep, kept);
    refreshResolveSelect();
    return { ok: true, path: pair.path, id: current.id, kept: keep, type: current.type };
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
      '  <div class="document-ai-help">Stage 19T2X uses developer-managed static frontend prompt files in <code>/prompt/</code>. In-place mode now asks for raw <code>LATEXAI_BLOCK_PATCH</code> text, and append mode is compiled through the Safe Edit Compiler; the app/backend, not the AI, creates <code>\\lai{...}</code> markup.</div>',
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
      (NS.KnowledgeContextService?.controlHtml?.('documentAi', 'Use knowledge/literature context for Paper-level AI', 5) || ''),
      '  <label>Extra one-off instructions',
      '    <textarea id="documentAiPrompt" placeholder="Example: focus on theorem statement clarity, missing citations, and how to improve the narrative. Frontend /prompt/ files provide the base prompt."></textarea>',
      '  </label>',
      '  <div class="document-ai-actions">',
      '    <button id="runDocumentAiBtn" class="btn mini primary" type="button">Run paper AI</button>',
      '    <button id="appendDocumentAiBtn" class="btn mini" type="button">Append to paper</button>',
      '    <button id="runAppendDocumentAiBtn" class="btn mini primary" type="button">Run + append</button>',
      '    <button id="copyDocumentAiBtn" class="btn mini" type="button">Copy output</button>',
      '  </div>',
      '  <div id="documentAiStatus" class="document-ai-status">Paper-level AI ready. Source edits use raw block-patch protocol plus Safe Edit Compiler.</div>',
      '  <pre id="documentAiOutput" class="document-ai-output"></pre>',
      '  <div class="document-ai-resolver">',
      '    <h4>Resolve AI edits</h4>',
      '    <div class="document-ai-help">Refresh scans the current .tex source for every <code>\\lai{...}</code>, <code>\\laiold{...}</code>, or paired replacement block. The kept content becomes normal black LaTeX and Latexai markup is removed. For standalone red <code>\\lai</code> insertions, Keep blue/old rejects/removes the insertion.</div>',
      '    <label>Unresolved edit <select id="documentAiResolveSelect"></select></label>',
      '    <div class="document-ai-actions">',
      '      <button id="refreshDocumentAiResolveBtn" class="btn mini" type="button">Refresh edits</button>',
      '      <button id="keepNewDocumentAiBtn" class="btn mini primary" type="button">Keep red/new</button>',
      '      <button id="keepOldDocumentAiBtn" class="btn mini" type="button">Keep blue/old</button>',
      '      <button id="keepAllNewDocumentAiBtn" class="btn mini" type="button">Keep all red/new</button>',
      '      <button id="keepAllOldDocumentAiBtn" class="btn mini" type="button">Keep all blue/old</button>',
      '    </div>',
      '    <div id="documentAiResolveFeedbackStatus" class="document-ai-status">Resolver reward feedback ready.</div>',
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
