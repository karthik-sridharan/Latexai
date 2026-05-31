/* Latexai Stage 19T3C LaiSafeEditPipelineService
 * Stage: stage19t3c-paper-remake-section-patch-hardening-20260531-1
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
  const STAGE = 'stage19t3c-paper-remake-section-patch-hardening-20260531-1';

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
  function hasLaiEditMarkup(text) {
    return /\\lai(?:old)?\s*\{/.test(String(text || ''));
  }
  function hasPackageInPreamble(source, names) {
    const s = String(source || '');
    const begin = s.search(/\\begin\s*\{document\}/);
    const preamble = begin >= 0 ? s.slice(0, begin) : s;
    const wanted = new Set((names || []).map((x) => String(x || '').toLowerCase()));
    const re = /\\usepackage(?:\s*\[[^\]]*\])?\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(preamble))) {
      const parts = String(m[1] || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
      if (parts.some((x) => wanted.has(x))) return true;
    }
    return false;
  }
  function hasCommandDefinition(source, name) {
    const s = String(source || '');
    const n = String(name || '').replace(/^\\/, '');
    if (!n) return false;
    const braced = new RegExp('\\\\(?:providecommand|newcommand|renewcommand|DeclareRobustCommand)\\s*\\{\\\\' + n + '\\}', 'm');
    const unbraced = new RegExp('\\\\(?:providecommand|newcommand|renewcommand|DeclareRobustCommand)\\s*\\\\' + n + '\\b', 'm');
    const defed = new RegExp('\\\\(?:long\\s*)?def\\s*\\\\' + n + '\\b|\\\\long\\\\def\\s*\\\\' + n + '\\b', 'm');
    return braced.test(s) || unbraced.test(s) || defed.test(s);
  }
  function laiMacroStatusForSource(source) {
    const s = String(source || '');
    const hasEditMarkup = hasLaiEditMarkup(s);
    const hasLai = hasCommandDefinition(s, 'lai');
    const hasLaiOld = hasCommandDefinition(s, 'laiold');
    const hasColorPackage = hasPackageInPreamble(s, ['xcolor', 'color']);
    const hasDocumentClass = /\\documentclass\b/.test(s);
    const docMatch = s.match(/\\documentclass(?:\s*\[[^\]]*\])?\s*\{[^}]+\}/);
    const begin = s.search(/\\begin\s*\{document\}/);
    const documentClassEnd = docMatch ? (docMatch.index + docMatch[0].length) : -1;
    return {
      hasEditMarkup,
      hasLai,
      hasLaiOld,
      hasColorPackage,
      hasDocumentClass,
      hasBeginDocument: begin >= 0,
      documentClassEnd,
      beginDocumentIndex: begin,
      missingMacroBlock: hasEditMarkup && (!hasLai || !hasLaiOld),
      safeInsertionPossible: !!docMatch && begin >= 0 && begin > documentClassEnd
    };
  }
  function ensureLaiMacrosInSource(source, options = {}) {
    const s = String(source || '');
    const status = laiMacroStatusForSource(s);
    if (!status.hasEditMarkup && !options.force) return { text: s, changed: false, status, note: 'no unresolved \\lai markup' };
    if (status.hasLai && status.hasLaiOld) return { text: s, changed: false, status, note: 'macros already defined' };
    if (!status.safeInsertionPossible) {
      return { text: s, changed: false, status, warning: 'Cannot auto-inject LatexAI macros because the root file does not have a normal \\documentclass ... \\begin{document} preamble order.' };
    }
    const missing = [];
    if (!status.hasColorPackage) missing.push('\\usepackage{xcolor}');
    if (!status.hasLaiOld) missing.push('\\providecommand{\\laiold}[1]{{\\color{blue}#1}}');
    if (!status.hasLai) missing.push('\\providecommand{\\lai}[1]{{\\color{red}#1}}');
    if (!missing.length) return { text: s, changed: false, status, note: 'nothing missing' };
    const block = ['% --- LatexAI visible edit macros ---', ...missing, '% --- end LatexAI visible edit macros ---'].join('\n') + '\n';
    const preamble = s.slice(status.documentClassEnd, status.beginDocumentIndex);
    const pkgRe = /\\usepackage(?:\s*\[[^\]]*\])?\s*\{[^}]+\}/g;
    let lastPackageEnd = -1;
    let m;
    while ((m = pkgRe.exec(preamble))) lastPackageEnd = status.documentClassEnd + m.index + m[0].length;
    const insertAt = lastPackageEnd >= 0 ? lastPackageEnd : status.documentClassEnd;
    // Critical invariant: never insert before \documentclass and never after \begin{document}.
    if (!(insertAt >= status.documentClassEnd && insertAt < status.beginDocumentIndex)) {
      return { text: s, changed: false, status, warning: 'Refused LatexAI macro insertion because insertion point was outside the preamble.' };
    }
    const next = s.slice(0, insertAt).trimEnd() + '\n' + block + s.slice(insertAt).replace(/^\s*\n?/, '\n');
    return { text: next, changed: next !== s, status: laiMacroStatusForSource(next), note: 'inserted LatexAI macros after \\documentclass and before \\begin{document}' };
  }
  function ensureLaiMacrosForRootIfNeeded(source, options = {}) {
    return ensureLaiMacrosInSource(source, options);
  }
  function fixLaiMacrosInRoot(options = {}) {
    const active = activeSource(true);
    const fixed = ensureLaiMacrosInSource(active.text, { force: !!options.force });
    if (fixed.changed) updateSource(active.path, fixed.text);
    return { ...fixed, path: active.path };
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
  function extractRawPatchProtocol(text) {
    const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = [];
    const re = /LATEXAI_BLOCK_PATCH_BEGIN[\s\S]*?LATEXAI_BLOCK_PATCH_END/gi;
    let m;
    while ((m = re.exec(raw))) blocks.push(m[0]);
    if (blocks.length) return blocks.join('\n\n');
    // Tolerate one malformed trailing patch in reports where the model forgot
    // LATEXAI_BLOCK_PATCH_END but clearly started a patch.  Send only the patch
    // tail, not the surrounding Markdown report.
    const start = raw.search(/LATEXAI_BLOCK_PATCH_BEGIN/i);
    if (start >= 0) return raw.slice(start).trim();
    return raw;
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
    const rawFinalOutput = String(options.finalOutput ?? options.rawPatchText ?? options.text ?? '');
    const finalOutput = extractRawPatchProtocol(rawFinalOutput);
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
      metadata: { frontendStage: STAGE, activePath: active.path, rawPatchExtractedByFrontend: finalOutput !== rawFinalOutput, originalOutputLength: rawFinalOutput.length, compilerOutputLength: finalOutput.length, ...(options.metadata || {}) }
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
  function updateSource(path, text, options = {}) {
    const normalized = normalizePath(path || rootPath());
    let nextText = String(text || '');
    if (options.ensureLaiMacros !== false && normalizePath(normalized) === normalizePath(rootPath())) {
      const fixed = ensureLaiMacrosInSource(nextText);
      if (fixed.changed) nextText = fixed.text;
    }
    try {
      if (State()?.updateFile) State().updateFile(normalized, nextText);
      else {
        const f = getFile(normalized);
        if (f) f.text = nextText;
      }
    } catch (_err) {
      const f = getFile(normalized);
      if (f) f.text = nextText;
    }
    try { State()?.setActivePath?.(normalized); } catch (_err) {}
    const ed = el('sourceEditor');
    if (ed && normalizePath(activePath()) === normalized) {
      try { ed.value = nextText; ed.dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    }
    try { NS.Editor?.setText?.(nextText); } catch (_err) {}
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}
    return { ok: true, path: normalized, sourceLength: String(nextText || '').length };
  }
  function looksLikeFullDocument(text) {
    const s = String(text || '');
    return /\\documentclass\b/.test(s) && /\\begin\s*\{document\}/.test(s);
  }
  function firstUsepackageIndex(text) {
    const m = String(text || '').match(/\\usepackage(?:\s*\[[^\]]*\])?\s*\{[^}]+\}/);
    return m ? m.index : -1;
  }
  function validateFullDocumentDraft(before, after) {
    const b = String(before || '');
    const a = String(after || '');
    if (/LATEXAI_BLOCK_PATCH_BEGIN|BEGIN_NEW_LATEX|END_NEW_LATEX|LATEXAI_BLOCK_PATCH_END/.test(a)) {
      return 'Blocked unsafe apply: raw patch protocol markers would be inserted into the .tex file.';
    }
    if (/\\documentclass\b/.test(b)) {
      const cls = a.search(/\\documentclass\b/);
      if (cls < 0) return 'Blocked unsafe apply: compiled draft would remove \\documentclass from the root file.';
      const begin = a.search(/\\begin\s*\{document\}/);
      if (begin >= 0 && begin < cls) return 'Blocked unsafe apply: compiled draft would put \\begin{document} before \\documentclass.';
      const pkg = firstUsepackageIndex(a);
      if (pkg >= 0 && pkg < cls) return 'Blocked unsafe apply: compiled draft would put \\usepackage before \\documentclass.';
      if (/\\begin\s*\{document\}/.test(b) && begin < 0) return 'Blocked unsafe apply: compiled draft would remove \\begin{document}.';
      if (/\\end\s*\{document\}/.test(b) && !/\\end\s*\{document\}/.test(a)) return 'Blocked unsafe apply: compiled draft would remove \\end{document}.';
    }
    return '';
  }
  function insertBeforeBeginDocument(source, line) {
    const s = String(source || '');
    const cleanLine = String(line || '').trim();
    if (!cleanLine) return s;
    const escaped = cleanLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { if (new RegExp(escaped.replace(/\\s\+/g, '\\s+')).test(s)) return s; } catch (_err) { if (s.includes(cleanLine)) return s; }
    const begin = s.search(/\\begin\s*\{document\}/);
    if (begin >= 0) return s.slice(0, begin).trimEnd() + '\n' + cleanLine + '\n' + s.slice(begin);
    const cls = s.match(/\\documentclass(?:\s*\[[^\]]*\])?\s*\{[^}]+\}\s*/);
    if (cls) return s.slice(0, cls.index + cls[0].length) + cleanLine + '\n' + s.slice(cls.index + cls[0].length);
    return cleanLine + '\n' + s;
  }
  function hoistPreambleLinesIntoSource(source, fragment) {
    let src = String(source || '');
    let body = String(fragment || '');
    const linesToHoist = [];
    body = body.replace(/^\s*\\usepackage(?:\s*\[[^\]]*\])?\s*\{[^}]+\}\s*$/gm, (m) => { linesToHoist.push(m.trim()); return ''; });
    body = body.replace(/^\s*\\newtheorem\s*\{[^}]+\}\s*\{[^}]+\}\s*$/gm, (m) => { linesToHoist.push(m.trim()); return ''; });
    for (const line of linesToHoist) src = insertBeforeBeginDocument(src, line);
    return { source: src, fragment: body };
  }
  function stripDocumentWrapperFromFragment(text) {
    let s = String(text || '').trim();
    s = s.replace(/^```(?:latex|tex|text)?\s*/i, '').replace(/```\s*$/i, '').trim();
    s = s.replace(/\\documentclass(?:\s*\[[^\]]*\])?\s*\{[^}]+\}\s*/gi, '');
    s = s.replace(/\\begin\s*\{document\}/gi, '');
    s = s.replace(/\\end\s*\{document\}/gi, '');
    return s.trim();
  }
  function insertBeforeEndDocument(source, insertion) {
    const s = String(source || '');
    const ins = String(insertion || '').trim();
    if (!ins) return s;
    const m = /\\end\s*\{document\}/g;
    let last = null;
    for (const match of s.matchAll(m)) last = match;
    if (last && Number.isFinite(last.index)) return s.slice(0, last.index).trimEnd() + '\n\n' + ins + '\n\n' + s.slice(last.index);
    return s.trimEnd() + '\n\n' + ins + '\n';
  }
  function draftCandidates(data, kind = 'targeted') {
    const values = [];
    const push = (v, label) => { const text = String(v || ''); if (text.trim()) values.push({ text, label }); };
    if (kind === 'append') {
      push(data?.targetedInsertionDraft, 'targetedInsertionDraft');
      push(data?.insertableLatexDraft, 'insertableLatexDraft');
      push(data?.appendOnlyDraft, 'appendOnlyDraft');
    } else {
      push(data?.targetedInsertionDraft, 'targetedInsertionDraft');
      push(data?.insertableLatexDraft, 'insertableLatexDraft');
      push(data?.appendOnlyDraft, 'appendOnlyDraft');
    }
    return values;
  }
  function compiledDraftText(data, kind = 'targeted', currentSource = '') {
    if (!data || data.safeToInsert !== true) return '';
    const candidates = draftCandidates(data, kind);
    const full = candidates.find((c) => looksLikeFullDocument(c.text));
    if (full) return full.text;
    return candidates[0]?.text || '';
  }
  function coerceCompiledDraftToFullSource(currentSource, draft, kind) {
    const source = String(currentSource || '');
    let d = String(draft || '');
    if (!d.trim()) return { ok: false, error: 'Safe Edit Compiler returned no insertion draft.' };
    if (looksLikeFullDocument(d)) {
      const fixed = ensureLaiMacrosInSource(d);
      d = fixed.text;
      const problem = validateFullDocumentDraft(source, d);
      return problem ? { ok: false, error: problem } : { ok: true, text: d, mode: fixed.changed ? 'full-document+lai-macros' : 'full-document' };
    }
    if (/\\documentclass\b/.test(source) && String(kind || '') === 'append') {
      let fragment = stripDocumentWrapperFromFragment(d);
      const hoisted = hoistPreambleLinesIntoSource(source, fragment);
      const next = insertBeforeEndDocument(hoisted.source, hoisted.fragment);
      const fixed = ensureLaiMacrosInSource(next);
      const problem = validateFullDocumentDraft(source, fixed.text);
      return problem ? { ok: false, error: problem } : { ok: true, text: fixed.text, mode: fixed.changed ? 'append-fragment-merged+lai-macros' : 'append-fragment-merged' };
    }
    const fixed = ensureLaiMacrosInSource(d);
    const problem = validateFullDocumentDraft(source, fixed.text);
    return problem ? { ok: false, error: problem } : { ok: true, text: fixed.text, mode: fixed.changed ? 'as-returned+lai-macros' : 'as-returned' };
  }
  function applyCompiledDraft(data, options = {}) {
    if (!data || data.safeToInsert !== true) {
      return { ok: false, error: 'Safe Edit Compiler did not mark this insertion safe.', data };
    }
    const active = activeSource(options.preferRoot !== false);
    const draft = compiledDraftText(data, options.kind || 'targeted', active.text);
    const coerced = coerceCompiledDraftToFullSource(active.text, draft, options.kind || 'targeted');
    if (!coerced.ok) return { ok: false, error: coerced.error, data };
    return { ...updateSource(options.path || data.activePath || active.path, coerced.text), safeToInsert: true, blockCount: data.blockCount || data.compiledEditCount || 0, data, draftMode: coerced.mode };
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
    stripUnsafeFullDocument,
    extractRawPatchProtocol,
    hasLaiEditMarkup,
    hasCommandDefinition,
    laiMacroStatusForSource,
    ensureLaiMacrosInSource,
    ensureLaiMacrosForRootIfNeeded,
    fixLaiMacrosInRoot
  };
})();
