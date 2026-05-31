/* Latexai Stage 19T2W LaiSafeEditPipelineService
 * Stage: stage19t2w-raw-patch-all-paper-ai-features-20260531-1
 *
 * Shared frontend bridge for all paper-editing AI features:
 * - AI agents return human-readable text plus LATEXAI_BLOCK_PATCH markup, not JSON edit payloads.
 * - The backend Safe Edit Compiler validates targets and creates visible \lai{...}/\laiold{...} wrappers.
 * - The frontend applies only compiler-produced full-source drafts; raw AI text is never inserted directly.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19t2w-raw-patch-all-paper-ai-features-20260531-1';

  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }
  function State() { return NS.State; }
  function normalizePath(path) {
    try { return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    catch (_err) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
  }
  function project() { return State()?.state?.project || {}; }
  function files() { return project().files || []; }
  function fileText(file) { return String(file?.text ?? file?.content ?? file?.source ?? file?.value ?? ''); }
  function textFile(file) { try { return !!State()?.textFile?.(file); } catch (_err) { return file && !file.base64 && !['asset', 'binary'].includes(file.kind); } }
  function getFile(path) {
    const normalized = normalizePath(path);
    try { const f = State()?.getFile?.(normalized); if (f) return f; } catch (_err) {}
    return (files() || []).find((f) => normalizePath(f.path) === normalized) || null;
  }
  function rootPath() {
    const p = project();
    if (p.rootFile) return normalizePath(p.rootFile);
    const root = (files() || []).find((f) => /\.tex$/i.test(f.path || '') && /\\documentclass/.test(fileText(f)));
    return normalizePath(root?.path || (files() || []).find((f) => /\.tex$/i.test(f.path || ''))?.path || 'main.tex');
  }
  function activePath() {
    const candidates = [State()?.state?.activePath, State()?.state?.activeFilePath, State()?.state?.currentPath, project()?.activePath, project()?.activeFilePath, rootPath()];
    return normalizePath(candidates.find(Boolean) || 'main.tex');
  }
  function activeSource(preferRoot = true) {
    let path = preferRoot ? rootPath() : activePath();
    let file = getFile(path);
    if (!file || !textFile(file)) { path = rootPath(); file = getFile(path); }
    return { path, file, text: fileText(file) };
  }
  function getStored(key, fallback = '') {
    try { const v = W.localStorage?.getItem?.(key); return v == null || v === '' ? fallback : v; } catch (_err) { return fallback; }
  }
  function backendRoot() {
    const fromSettings = clean(NS.BackendUrlSettingsService?.getMemoryApiBaseUrl?.() || '');
    const raw = clean(el('branchWorkflowBackendUrl')?.value) || clean(el('memoryBackendUrl')?.value) || fromSettings || clean(getStored('latexai:memory-backend-url', ''));
    const base = raw.replace(/\/+$/, '');
    if (!base) return '';
    if (/\/api\/lumina\/memory$/i.test(base)) return base.replace(/\/api\/lumina\/memory$/i, '/api/lumina');
    if (/\/api\/lumina$/i.test(base)) return base;
    if (/\/api\/lumina\/latex\/compile$/i.test(base)) return base.replace(/\/api\/lumina\/latex\/compile$/i, '/api/lumina');
    return base + '/api/lumina';
  }
  function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const token = clean(NS.BackendUrlSettingsService?.getMemoryProxyToken?.() || '') || clean(el('memoryProxyToken')?.value) || clean(getStored('latexai:memory-proxy-token', ''));
    if (token) { h.Authorization = 'Bearer ' + token; h['X-Lumina-Token'] = token; }
    return h;
  }
  async function postBackend(path, body, options = {}) {
    const root = backendRoot();
    if (!root) throw new Error('Missing Memory/backend URL. Set the Cloud Run backend URL in Settings.');
    const res = await fetch(root + path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body || {}) });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : {}; } catch (_err) { data = { raw: text }; }
    if (!res.ok || (data?.ok === false && !options.allowOkFalse)) {
      const message = data?.error?.message || data?.detail || data?.message || ('HTTP ' + res.status + ': ' + text);
      throw new Error(message);
    }
    if (data && typeof data === 'object') data.httpStatus = res.status;
    return data;
  }
  function currentProviderModel() {
    const provider = clean(el('aiProvider')?.value || 'openai');
    const model = clean(el('aiModel')?.value || '');
    return { provider, model };
  }
  function safePatchId(prefix = 'edit') {
    return String(prefix || 'edit').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 28) + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }
  function stripUnsafeFullDocument(text) {
    let s = String(text || '').trim();
    s = s.replace(/^```(?:latex|tex|text)?\s*/i, '').replace(/```$/i, '').trim();
    s = s.replace(/\\documentclass[\s\S]*?\\begin\s*\{document\}/i, '').replace(/\\end\s*\{document\}\s*$/i, '').trim();
    return s;
  }
  function rawPatchBlock(options = {}) {
    const operation = clean(options.operation || 'append_before_end_document');
    const targetBlockId = clean(options.targetBlockId || options.target_block_id || '');
    const targetSection = clean(options.targetSection || options.target_section || '');
    const rationale = clean(options.rationale || 'Converted by Latexai app into a safe raw patch for deterministic insertion.');
    const latex = String(options.latex ?? options.newLatex ?? options.body ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const lines = [
      'LATEXAI_BLOCK_PATCH_BEGIN',
      'PATCH_ID: ' + clean(options.patchId || safePatchId('edit')),
      'OPERATION: ' + operation,
    ];
    if (targetBlockId) lines.push('TARGET_BLOCK_ID: ' + targetBlockId);
    if (targetSection) lines.push('TARGET_SECTION: ' + targetSection);
    lines.push('RATIONALE: ' + rationale);
    lines.push('BEGIN_NEW_LATEX');
    lines.push(latex);
    lines.push('END_NEW_LATEX');
    lines.push('LATEXAI_BLOCK_PATCH_END');
    return lines.join('\n');
  }
  function rawPatchProtocolInstructions(options = {}) {
    const goal = clean(options.goal || 'produce safe paper edits');
    const extra = clean(options.extra || '');
    return [
      'Latexai edit protocol requirement:',
      '- You may write normal Markdown/prose for the report, but every source edit must be expressed as one or more LATEXAI_BLOCK_PATCH blocks.',
      '- Do not return JSON edit schemas for source edits.',
      '- Do not output \\lai, \\laiold, BEGIN LAI-ACTIONABLE-EDIT, or any internal change-markup wrapper. The app/backend owns all visible old/new markup.',
      '- Do not output a full LaTeX document or preamble commands. The patch body must be body-safe LaTeX only.',
      '- Use this exact block format:',
      '',
      'LATEXAI_BLOCK_PATCH_BEGIN',
      'PATCH_ID: edit-1',
      'OPERATION: replace_block | insert_after_block | insert_before_block | insert_before_section | append_before_end_document | no_edit',
      'TARGET_BLOCK_ID: use a listed safe block id when available; omit for append_before_end_document',
      'TARGET_SECTION: optional exact section title',
      'RATIONALE: short reason',
      'BEGIN_NEW_LATEX',
      'Raw visible LaTeX/prose body content goes here. Use real backslashes and real line breaks.',
      'END_NEW_LATEX',
      'LATEXAI_BLOCK_PATCH_END',
      '',
      'Goal for this call: ' + goal,
      extra
    ].filter(Boolean).join('\n');
  }
  async function compileRawPatch(options = {}) {
    const active = activeSource(options.preferRoot !== false);
    const source = String(options.latexSource ?? active.text ?? '');
    const finalOutput = String(options.finalOutput ?? options.rawPatchText ?? options.text ?? '');
    const pm = currentProviderModel();
    const body = {
      latexSource: source,
      finalOutput,
      text: finalOutput,
      allowAiRepair: options.allowAiRepair !== false,
      safeEditRepairRequested: options.safeEditRepairRequested !== false,
      insertionMode: options.insertionMode || 'targeted',
      workflow: options.workflow || 'generic-paper-ai',
      targetSectionOverride: options.targetSectionOverride || '',
      provider: options.provider || pm.provider,
      model: options.model || pm.model,
      safeEditRepairRoute: options.safeEditRepairRoute || (pm.model ? { provider: pm.provider, model: pm.model } : undefined),
      metadata: { frontendStage: STAGE, activePath: active.path, ...(options.metadata || {}) }
    };
    const data = await postBackend('/lai/compile-or-repair-edits', body, { allowOkFalse: true });
    if (data && typeof data === 'object') {
      data.safeCompiler = { enabled: true, client: 'LaiSafeEditPipelineService', frontendStage: STAGE };
      data.frontendStage = STAGE;
      data.workflow = body.workflow;
      data.activePath = active.path;
    }
    return data;
  }
  function updateSource(path, text) {
    const normalized = normalizePath(path || rootPath());
    try {
      if (State()?.updateFile) State().updateFile(normalized, text);
      else {
        const f = getFile(normalized);
        if (f) f.text = text;
      }
    } catch (_err) {
      const f = getFile(normalized);
      if (f) f.text = text;
    }
    try { State()?.setActivePath?.(normalized); } catch (_err) {}
    const ed = el('sourceEditor');
    if (ed && normalizePath(activePath()) === normalized) {
      try { ed.value = text; ed.dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    }
    try { NS.Editor?.setText?.(text); } catch (_err) {}
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}
    return { ok: true, path: normalized, sourceLength: String(text || '').length };
  }
  function compiledDraftText(data, kind = 'targeted') {
    if (!data || data.safeToInsert !== true) return '';
    return String(kind === 'append' ? (data.appendOnlyDraft || data.targetedInsertionDraft || data.insertableLatexDraft || '') : (data.targetedInsertionDraft || data.insertableLatexDraft || data.appendOnlyDraft || ''));
  }
  function applyCompiledDraft(data, options = {}) {
    if (!data || data.safeToInsert !== true) {
      return { ok: false, error: 'Safe Edit Compiler did not mark this insertion safe.', data };
    }
    const active = activeSource(options.preferRoot !== false);
    const draft = compiledDraftText(data, options.kind || 'targeted');
    if (!draft.trim()) return { ok: false, error: 'Safe Edit Compiler returned no insertion draft.', data };
    return { ...updateSource(options.path || data.activePath || active.path, draft), safeToInsert: true, blockCount: data.blockCount || data.compiledEditCount || 0, data };
  }
  async function compileAndApply(options = {}) {
    const data = await compileRawPatch(options);
    if (data.safeToInsert !== true) return { ok: false, data, error: (data.validationErrors || data.warnings || []).join('; ') || 'Safe compiler blocked insertion.' };
    return applyCompiledDraft(data, options);
  }

  NS.LaiSafeEditPipelineService = {
    STAGE,
    backendRoot,
    activePath,
    rootPath,
    activeSource,
    rawPatchBlock,
    rawPatchProtocolInstructions,
    compileRawPatch,
    applyCompiledDraft,
    compileAndApply,
    compiledDraftText,
    updateSource,
    stripUnsafeFullDocument
  };
})();
