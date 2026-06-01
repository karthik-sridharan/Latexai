/* Latexai Stage 19U9K
 * Moves collection synthesis out of standalone literature.html and into paper-level AI workflows.
 * Each Paper AI card can select a literature collection, generate a workflow-specific
 * synthesis, attach that synthesis to the next knowledge-aware prompt, append/copy
 * the generated \lai block, and, in Stage 19U9K, automatically inject the
 * selected collection context into the actual AIProvider.ask payload for supported
 * paper-level AI workflows.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19u9k-paper-ai-collection-context-wiring-20260601-1';
  const COLLECTIONS_KEY = 'latexai:literature-collections:v1';
  const SELECTED_COLLECTION_KEY = 'latexai:literature-selected-collection:v1';
  const ATTACH_PREFIX = 'latexai:paper-ai-collection-synthesis-attached:';
  const LAST_PREFIX = 'latexai:paper-ai-collection-synthesis-last:';
  const STRICT_NO_COLLECTION_MIGRATION_KEY = 'latexai:stage19u9j4-strict-no-collection-defaults-applied:v1';

  function applyStrictNoCollectionDefaultMigration() {
    try {
      if (W.localStorage?.getItem?.(STRICT_NO_COLLECTION_MIGRATION_KEY) === 'true') return;
      const keys = [];
      for (let i = 0; i < W.localStorage.length; i += 1) {
        const key = String(W.localStorage.key(i) || '');
        if (key.startsWith('latexai:paper-ai-synthesis-selected-collection:') ||
            key.startsWith('latexai:knowledge-selected-collection:')) {
          keys.push(key);
        }
        if (key.startsWith('latexai:knowledge-mode:')) {
          keys.push(key);
        }
      }
      keys.forEach((key) => {
        if (key.startsWith('latexai:knowledge-mode:')) W.localStorage.setItem(key, 'automatic_pinned');
        else W.localStorage.setItem(key, '');
      });
      W.localStorage.setItem(STRICT_NO_COLLECTION_MIGRATION_KEY, 'true');
    } catch (_err) {}
  }
  applyStrictNoCollectionDefaultMigration();

  const FEATURES = [
    { feature: 'documentAi', cardId: 'documentAiCard', label: 'Paper-level AI', insertBefore: '#documentAiPrompt' },
    { feature: 'paperAiPolish', cardId: 'paperAiPolishCard', label: 'Paper AI polish / review' },
    { feature: 'competitive', cardId: 'competitiveReviewCard', label: 'Competitive review / improvement', insertBefore: '#competitiveExtraInstructions' },
    { feature: 'reviewerSim', cardId: 'reviewerRebuttalCard', label: 'Reviewer / rebuttal simulator', insertAfter: '#reviewerSimInstructions' },
    { feature: 'devilsDebate', cardId: 'devilsDebateCard', label: "Devil's advocate debate" },
    { feature: 'branchWorkflow', cardId: 'realAgentBranchWorkflowCard', label: "Devil's advocate branch runner", insertAfter: '#branchWorkflowQuery' },
    { feature: 'citationAi', cardId: 'citationAiCard', label: 'Citation AI' }
  ];

  let patchedPromptBlock = false;
  const memory = {};

  function el(id) { return D.getElementById(id); }
  function qs(sel, root) { try { return (root || D).querySelector(sel); } catch (_err) { return null; } }
  function clean(v) { return String(v == null ? '' : v).trim(); }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function compactText(v, max) {
    const s = String(v || '').replace(/\s+/g, ' ').trim();
    const n = Number(max) || 900;
    return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)).trimEnd() + '…';
  }
  function getStored(key, fallback) {
    try { const v = W.localStorage?.getItem?.(key); return v == null || v === '' ? fallback : v; } catch (_err) { return fallback; }
  }
  function rawStored(key) {
    try {
      const v = W.localStorage?.getItem?.(key);
      return v == null ? null : String(v);
    } catch (_err) { return null; }
  }
  function setStored(key, value) { try { W.localStorage?.setItem?.(key, String(value)); } catch (_err) {} }
  function jsonStored(key, fallback) {
    try {
      const raw = W.localStorage?.getItem?.(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (_err) { return fallback; }
  }
  function setJsonStored(key, value) { try { W.localStorage?.setItem?.(key, JSON.stringify(value)); } catch (_err) {} }
  function collectionItemsKey(id) { return 'latexai:literature-collection-items:' + String(id || ''); }
  function collections() {
    const fromSvc = NS.KnowledgeContextService?.collections?.();
    if (Array.isArray(fromSvc) && fromSvc.length) return fromSvc.filter((c) => c && c.id);
    const arr = jsonStored(COLLECTIONS_KEY, []);
    return Array.isArray(arr) ? arr.filter((c) => c && c.id) : [];
  }
  function collectionItems(id) {
    if (!id) return [];
    const fromSvc = NS.KnowledgeContextService?.collectionItems?.(id);
    if (Array.isArray(fromSvc) && fromSvc.length) return fromSvc.filter((x) => x && x.key);
    const arr = jsonStored(collectionItemsKey(id), []);
    return Array.isArray(arr) ? arr.filter((x) => x && x.key) : [];
  }
  function projectContextKey() {
    try { return NS.KnowledgeContextService?.projectContextKey?.() || 'local-project/main.tex'; }
    catch (_err) { return 'local-project/main.tex'; }
  }
  function scopedKey(prefix, feature) { return prefix + projectContextKey() + ':' + String(feature || 'paper-ai'); }
  function selectedCollectionId(feature) {
    const node = el(idFor(feature, 'Collection'));
    // Important: an empty select value is an explicit user choice: "No collection".
    // Default Paper AI collection context should start as "No collection", even if
    // the standalone literature page has a global/default collection.
    if (node) return clean(node.value || '');
    // Stage 19U9K: Paper-level AI has two collection surfaces. If the newer
    // collection-synthesis selector has not been mounted yet, respect the older
    // Knowledge/literature context selector for the same feature.
    const kcsNode = el(String(feature || 'knowledge') + 'KnowledgeCollection');
    if (kcsNode) return clean(kcsNode.value || '');
    try {
      const fromKnowledge = NS.KnowledgeContextService?.selectedCollectionId?.(feature);
      if (fromKnowledge != null) return clean(fromKnowledge);
    } catch (_err) {}
    const saved = rawStored(scopedKey('latexai:paper-ai-synthesis-selected-collection:', feature));
    if (saved !== null) return clean(saved);
    return '';
  }
  function collectionPayload(feature) {
    const id = selectedCollectionId(feature);
    const c = collections().find((x) => x.id === id) || {};
    return {
      id,
      collectionId: id,
      name: clean(c.name || id || 'Selected collection'),
      description: clean(c.description || ''),
      items: collectionItems(id),
      metadata: {
        stage: STAGE,
        source: 'latexai-paper-level-ai-feature',
        feature,
        projectContextKey: projectContextKey()
      }
    };
  }
  function normalizeMode(v) {
    const raw = clean(v || 'related_work').replace(/-/g, '_');
    return ['annotated_bibliography', 'ranking', 'gap_analysis', 'related_work', 'citation_suggestions', 'compare'].includes(raw) ? raw : 'related_work';
  }
  function idFor(feature, suffix) {
    const safe = String(feature || 'paperAi').replace(/[^A-Za-z0-9_-]/g, '');
    return safe + 'CollectionSynthesis' + suffix;
  }
  function backendRoot() {
    const kcs = clean(NS.KnowledgeContextService?.backendRoot?.() || '');
    if (kcs) return kcs.replace(/\/+$/, '');
    const fromSettings = clean(NS.BackendUrlSettingsService?.getMemoryApiBaseUrl?.() || NS.BackendUrlSettings?.getMemoryApiBaseUrl?.() || '');
    const raw = clean(el('memoryBackendUrl')?.value) || fromSettings || clean(getStored('latexai:memory-backend-url', '')) || clean(getStored('lumina-latex.memory.backendUrl', ''));
    const base = raw.replace(/\/+$/, '');
    if (!base) return '';
    if (/\/api\/lumina\/memory$/i.test(base)) return base.replace(/\/api\/lumina\/memory$/i, '/api/lumina');
    if (/\/api\/lumina$/i.test(base)) return base;
    if (/\/api\/lumina\/latex\/compile(?:\/jobs)?$/i.test(base)) return base.replace(/\/api\/lumina\/latex\/compile(?:\/jobs)?$/i, '/api/lumina');
    if (/\/api\/lumina\/ai(?:\/status|\/models|\/workflows)?$/i.test(base)) return base.replace(/\/api\/lumina\/ai(?:\/status|\/models|\/workflows)?$/i, '/api/lumina');
    return base + '/api/lumina';
  }
  function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const token = clean(NS.BackendUrlSettingsService?.getMemoryProxyToken?.() || NS.BackendUrlSettings?.getMemoryProxyToken?.() || '') || clean(el('memoryProxyToken')?.value) || clean(getStored('latexai:memory-proxy-token', '')) || clean(getStored('lumina-latex.memory.proxyToken', ''));
    if (token) { h.Authorization = 'Bearer ' + token; h['X-Lumina-Token'] = token; h['X-Lumina-Ingest-Token'] = token; }
    return h;
  }
  async function fetchBackend(path, body) {
    const root = backendRoot();
    if (!root) throw new Error('Missing knowledge/memory backend URL. Set the Cloud Run backend URL in Settings.');
    const res = await fetch(root + path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body || {}) });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_err) { data = { raw: text }; }
    if (!res.ok || data?.ok === false) throw new Error(data?.detail || data?.error?.message || data?.message || ('HTTP ' + res.status + ': ' + text));
    data.httpStatus = res.status;
    return data;
  }
  function activeLatexSource(maxChars) {
    try {
      const active = NS.KnowledgeContextService?.activeSource?.(true);
      if (active && active.text) return String(active.text || '').slice(0, maxChars || 24000);
    } catch (_err) {}
    const ed = NS.Editor?.editor || el('sourceEditor');
    return String(ed?.value || '').slice(0, maxChars || 24000);
  }
  function modeLabel(mode) {
    return ({
      annotated_bibliography: 'annotated bibliography',
      ranking: 'ranking',
      gap_analysis: 'gap / open problems',
      related_work: 'related work draft',
      citation_suggestions: 'citation suggestions',
      compare: 'paper comparison'
    })[mode] || mode;
  }
  function featureByName(feature) { return FEATURES.find((x) => x.feature === feature) || { feature, label: feature }; }
  function featureOutput(feature) {
    const map = {
      documentAi: 'documentAiOutput',
      paperAiPolish: 'paperAiPolishOutput',
      competitive: 'competitiveReviewOutput',
      reviewerSim: 'reviewerRebuttalOutput',
      devilsDebate: 'devilsDebateOutput',
      branchWorkflow: 'realAgentBranchWorkflowOutput',
      citationAi: 'citationAiOutput'
    };
    return el(map[feature] || '') || qs('[data-collection-synthesis-feature="' + CSS.escape(feature) + '"] .collection-synthesis-preview');
  }
  function setStatus(feature, message, kind) {
    const node = el(idFor(feature, 'Status'));
    if (!node) return;
    node.textContent = String(message || '');
    node.dataset.kind = kind || '';
  }
  function writePreview(feature, text) {
    const node = el(idFor(feature, 'Preview'));
    if (node) node.textContent = String(text || '');
  }
  function collectionOptionsHtml(selected) {
    const list = collections();
    const opts = ['<option value="">No collection</option>'];
    for (const c of list) {
      const count = collectionItems(c.id).length;
      opts.push('<option value="' + esc(c.id) + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(c.name || c.id) + ' (' + count + ')</option>');
    }
    return opts.join('');
  }
  function surfaceHtml(feature, label) {
    const selected = selectedCollectionId(feature);
    const storedAttach = getStored(scopedKey(ATTACH_PREFIX, feature), 'true') !== 'false';
    const mode = getStored(scopedKey('latexai:paper-ai-synthesis-mode:', feature), feature === 'citationAi' ? 'citation_suggestions' : 'related_work');
    return [
      '<div class="settings-card-subtle collection-synthesis-context" data-collection-synthesis-feature="' + esc(feature) + '">',
      '  <div class="smallcaps">Literature collection context</div>',
      '  <div class="settings-note compact">Generate a collection-level synthesis inside <strong>' + esc(label) + '</strong>. When attached, the synthesis is appended to this workflow\'s knowledge-context prompt.</div>',
      '  <div class="field-grid two">',
      '    <label class="field">Project collection <select id="' + idFor(feature, 'Collection') + '">' + collectionOptionsHtml(selected) + '</select></label>',
      '    <label class="field">Synthesis mode <select id="' + idFor(feature, 'Mode') + '">',
      option('annotated_bibliography', 'annotated bibliography', mode),
      option('ranking', 'rank papers by relevance', mode),
      option('gap_analysis', 'gap / open-problem analysis', mode),
      option('related_work', 'related work draft', mode),
      option('citation_suggestions', 'citation suggestions', mode),
      option('compare', 'compare selected papers', mode),
      '    </select></label>',
      '  </div>',
      '  <label class="field">Focus / instructions for this Paper AI feature',
      '    <textarea id="' + idFor(feature, 'Prompt') + '" rows="2" placeholder="Optional: e.g. synthesize only papers relevant to the current theorem/related work/novelty positioning."></textarea>',
      '  </label>',
      '  <label class="field checkbox-field"><input id="' + idFor(feature, 'Attach') + '" type="checkbox"' + (storedAttach ? ' checked' : '') + ' /> Attach generated synthesis to the next AI run for this feature</label>',
      '  <div class="document-ai-actions collection-synthesis-actions">',
      '    <button class="btn mini primary" type="button" data-collection-synthesis-action="run" data-collection-synthesis-feature="' + esc(feature) + '">Generate for this feature</button>',
      '    <button class="btn mini" type="button" data-collection-synthesis-action="copy" data-collection-synthesis-feature="' + esc(feature) + '">Copy report</button>',
      '    <button class="btn mini" type="button" data-collection-synthesis-action="copy-lai" data-collection-synthesis-feature="' + esc(feature) + '">Copy \\lai block</button>',
      '    <button class="btn mini" type="button" data-collection-synthesis-action="append-lai" data-collection-synthesis-feature="' + esc(feature) + '">Append \\lai to paper</button>',
      '  </div>',
      '  <div id="' + idFor(feature, 'Status') + '" class="settings-note compact">No collection selected. This Paper AI feature starts without collection synthesis context.</div>',
      '  <pre id="' + idFor(feature, 'Preview') + '" class="collection-synthesis-preview" aria-live="polite"></pre>',
      '</div>'
    ].join('');
  }
  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (normalizeMode(selected) === value ? ' selected' : '') + '>' + esc(label) + '</option>';
  }
  function injectStyle() {
    if (el('collectionSynthesisPaperAiStyle')) return;
    const style = D.createElement('style');
    style.id = 'collectionSynthesisPaperAiStyle';
    style.textContent = [
      '.collection-synthesis-context{margin:12px 0;border:1px solid rgba(37,99,235,.20);}',
      '.collection-synthesis-context .settings-note[data-kind="good"], .collection-synthesis-context [data-kind="good"]{border-color:#bbf7d0;background:#f0fdf4;color:#166534;}',
      '.collection-synthesis-context .settings-note[data-kind="warn"], .collection-synthesis-context [data-kind="warn"]{border-color:#fde68a;background:#fffbeb;color:#92400e;}',
      '.collection-synthesis-context .settings-note[data-kind="bad"], .collection-synthesis-context [data-kind="bad"]{border-color:#fecaca;background:#fff1f2;color:#991b1b;}',
      '.collection-synthesis-preview{white-space:pre-wrap;max-height:260px;overflow:auto;background:#0f172a;color:#e2e8f0;border-radius:14px;padding:10px;font-size:.78rem;margin-top:8px;}',
      '.collection-synthesis-actions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;}'
    ].join('\n');
    D.head.appendChild(style);
  }
  function installOne(def) {
    const card = el(def.cardId);
    if (!card || qs('[data-collection-synthesis-feature="' + CSS.escape(def.feature) + '"]', card)) return false;
    const holder = D.createElement('div');
    holder.innerHTML = surfaceHtml(def.feature, def.label);
    const surface = holder.firstElementChild;
    if (!surface) return false;
    const afterKnowledge = qs('.knowledge-context-controls[data-knowledge-feature="' + CSS.escape(def.feature) + '"]', card);
    const before = def.insertBefore ? qs(def.insertBefore, card) : null;
    const after = def.insertAfter ? qs(def.insertAfter, card) : null;
    if (afterKnowledge && afterKnowledge.parentNode) afterKnowledge.parentNode.insertBefore(surface, afterKnowledge.nextSibling);
    else if (before && before.parentNode) before.parentNode.insertBefore(surface, before);
    else if (after && after.parentNode) after.parentNode.insertBefore(surface, after.nextSibling);
    else {
      const actionRow = qs('.paper-ai-actions,.competitive-review-actions,.devils-actions,.document-ai-actions,.citation-ai-actions', card);
      if (actionRow && actionRow.parentNode) actionRow.parentNode.insertBefore(surface, actionRow);
      else card.appendChild(surface);
    }
    bindSurface(def.feature);
    restoreLast(def.feature);
    return true;
  }
  function bindSurface(feature) {
    const c = el(idFor(feature, 'Collection'));
    const m = el(idFor(feature, 'Mode'));
    const a = el(idFor(feature, 'Attach'));
    if (c && !c.__collectionSynthesisBound) {
      c.__collectionSynthesisBound = true;
      if (rawStored(scopedKey('latexai:paper-ai-synthesis-selected-collection:', feature)) === null) {
        setStored(scopedKey('latexai:paper-ai-synthesis-selected-collection:', feature), '');
      }
      c.addEventListener('change', () => {
        const value = clean(c.value || '');
        // Persist even the empty string so "No collection" survives the watchdog refresh loop.
        setStored(scopedKey('latexai:paper-ai-synthesis-selected-collection:', feature), value);
        const kcsSelect = el(String(feature) + 'KnowledgeCollection');
        if (kcsSelect) {
          kcsSelect.value = value;
          try { kcsSelect.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
        }
        if (!value) setStatus(feature, 'No collection selected. This Paper AI feature will run without collection synthesis context.', '');
      });
    }
    if (m && !m.__collectionSynthesisBound) {
      m.__collectionSynthesisBound = true;
      m.addEventListener('change', () => setStored(scopedKey('latexai:paper-ai-synthesis-mode:', feature), normalizeMode(m.value)));
    }
    if (a && !a.__collectionSynthesisBound) {
      a.__collectionSynthesisBound = true;
      a.addEventListener('change', () => setStored(scopedKey(ATTACH_PREFIX, feature), a.checked ? 'true' : 'false'));
    }
  }
  function refreshSelectors() {
    for (const def of FEATURES) {
      const sel = el(idFor(def.feature, 'Collection'));
      if (!sel) continue;
      // Preserve the DOM value exactly. Empty string means the explicit "No collection" option.
      const previous = clean(sel.value || '');
      sel.innerHTML = collectionOptionsHtml(previous);
      if (previous && Array.from(sel.options).some((o) => o.value === previous)) sel.value = previous;
      else sel.value = '';
    }
  }
  function ensureSurfaces() {
    injectStyle();
    try { NS.KnowledgeContextService?.ensureGlobalKnowledgeControlSurfaces?.(); } catch (_err) {}
    FEATURES.forEach(installOne);
    refreshSelectors();
  }
  function activeBodyForFeature(feature) {
    const out = featureOutput(feature);
    const existing = clean(out?.textContent || '');
    if (existing && existing !== 'Copilot responses will appear here.') return existing.slice(0, 7000);
    return '';
  }
  function buildPrompt(feature) {
    const mode = normalizeMode(el(idFor(feature, 'Mode'))?.value || 'related_work');
    const focus = clean(el(idFor(feature, 'Prompt'))?.value || '');
    const def = featureByName(feature);
    const source = activeLatexSource(22000);
    const existing = activeBodyForFeature(feature);
    return [
      'This collection synthesis is being generated inside the LatexAI paper-level feature: ' + (def.label || feature) + '.',
      'Mode: ' + modeLabel(mode) + '.',
      focus ? 'User focus: ' + focus : '',
      existing ? 'Existing output from this feature, for continuity:\n' + existing : '',
      source ? 'Current LaTeX draft excerpt, for paper-specific positioning and citation suggestions:\n' + source : ''
    ].filter(Boolean).join('\n\n').slice(0, 30000);
  }
  async function runSynthesis(feature) {
    const id = selectedCollectionId(feature);
    if (!id) { setStatus(feature, 'Select a collection first. Create/populate collections in the Literature Assistant.', 'warn'); return null; }
    const count = collectionItems(id).filter((x) => String(x.role || '') !== 'excluded').length;
    if (!count) { setStatus(feature, 'The selected collection has no non-excluded papers.', 'warn'); return null; }
    const body = {
      mode: normalizeMode(el(idFor(feature, 'Mode'))?.value || 'related_work'),
      prompt: buildPrompt(feature),
      useAi: true,
      includeExcluded: false,
      maxItems: 60,
      collection: collectionPayload(feature),
      metadata: { stage: STAGE, feature, projectContextKey: projectContextKey() }
    };
    setStatus(feature, 'Generating ' + modeLabel(body.mode) + ' from ' + count + ' paper(s) for this Paper AI feature...', 'warn');
    try {
      const data = await fetchBackend('/research/collections/' + encodeURIComponent(id) + '/synthesize', body);
      memory[feature] = data;
      setJsonStored(scopedKey(LAST_PREFIX, feature), data);
      const attach = !!el(idFor(feature, 'Attach'))?.checked;
      setStored(scopedKey(ATTACH_PREFIX, feature), attach ? 'true' : 'false');
      writePreview(feature, formatPreview(data));
      setStatus(feature, 'Collection synthesis ready for ' + (featureByName(feature).label || feature) + (attach ? '; it will be attached to the next AI run.' : '.'), data.fallbackUsed ? 'warn' : 'good');
      return data;
    } catch (err) {
      setStatus(feature, 'Collection synthesis failed: ' + (err?.message || err), 'bad');
      return null;
    }
  }
  function formatPreview(data) {
    if (!data) return '';
    const refs = Array.isArray(data.references) ? data.references : [];
    const refLine = refs.length ? '\n\nReferences: ' + refs.slice(0, 10).map((r) => '[' + r.index + '] ' + (r.title || 'Untitled')).join('; ') : '';
    return [
      (data.modeLabel || data.mode || 'Collection synthesis') + ' · ' + (data.collectionName || data.collectionId || 'collection'),
      (data.usedAi ? 'AI synthesis' : 'metadata fallback') + ' · ' + (data.itemCount || 0) + ' paper(s)',
      '',
      String(data.report || data.markdown || data.text || '').trim(),
      refLine
    ].join('\n').trim();
  }
  function report(feature) {
    const data = memory[feature] || jsonStored(scopedKey(LAST_PREFIX, feature), null);
    return clean(data?.report || data?.markdown || data?.text || '');
  }
  function laiBlock(feature) {
    const data = memory[feature] || jsonStored(scopedKey(LAST_PREFIX, feature), null);
    const block = clean(data?.laiBlock || '');
    if (block) return block;
    const r = report(feature);
    return r ? '\\lai{\n' + r.replace(/\\end\{document\}/g, '') + '\n}' : '';
  }
  function restoreLast(feature) {
    const selected = selectedCollectionId(feature);
    // Avoid restoring stale synthesis when this workflow starts as No collection.
    if (!selected) return;
    const data = jsonStored(scopedKey(LAST_PREFIX, feature), null);
    if (!data) return;
    const dataId = clean(data.collectionId || data.collection?.id || data.collection?.collectionId || '');
    if (dataId && dataId !== selected) return;
    memory[feature] = data;
    writePreview(feature, formatPreview(data));
    const attached = getStored(scopedKey(ATTACH_PREFIX, feature), 'true') !== 'false';
    setStatus(feature, 'Restored last collection synthesis' + (attached ? '; attached to next AI run.' : '.'), attached ? 'good' : '');
  }
  async function copyText(feature, asLai) {
    const text = asLai ? laiBlock(feature) : report(feature);
    if (!text) { setStatus(feature, 'Generate a collection synthesis first.', 'warn'); return; }
    try {
      await navigator.clipboard?.writeText(text);
      setStatus(feature, 'Copied ' + (asLai ? '\\lai block' : 'collection synthesis report') + '.', 'good');
    } catch (_err) {
      writePreview(feature, text);
      setStatus(feature, 'Clipboard unavailable; text is shown in the preview box.', 'warn');
    }
  }
  function appendToPaper(feature) {
    const block = laiBlock(feature);
    if (!block) { setStatus(feature, 'Generate a collection synthesis first.', 'warn'); return false; }
    const editor = NS.Editor?.editor || el('sourceEditor');
    if (!editor) { setStatus(feature, 'No open source editor found.', 'bad'); return false; }
    const add = '\n\n% LatexAI collection synthesis from ' + (featureByName(feature).label || feature) + '\n' + block + '\n';
    const next = String(editor.value || '') + add;
    try { NS.Editor?.setText?.(next); } catch (_err) { editor.value = next; }
    try { editor.value = next; editor.dispatchEvent(new Event('input', { bubbles: true })); editor.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
    setStatus(feature, 'Appended collection synthesis as a \\lai block to the current paper.', 'good');
    return true;
  }
  function attachedBlockForFeature(feature) {
    const selected = selectedCollectionId(feature);
    if (!selected) return '';
    const attachNode = el(idFor(feature, 'Attach'));
    const attach = attachNode ? !!attachNode.checked : getStored(scopedKey(ATTACH_PREFIX, feature), 'true') !== 'false';
    if (!attach) return '';
    const data = memory[feature] || jsonStored(scopedKey(LAST_PREFIX, feature), null) || {};
    const dataId = clean(data.collectionId || data.collection?.id || data.collection?.collectionId || '');
    if (dataId && dataId !== selected) return '';
    const r = report(feature);
    if (!r) return '';
    return [
      '=== ATTACHED COLLECTION SYNTHESIS FOR THIS PAPER-AI FEATURE ===',
      'Collection: ' + clean(data.collectionName || data.collectionId || selectedCollectionId(feature) || 'selected collection'),
      'Mode: ' + clean(data.modeLabel || data.mode || 'collection synthesis'),
      'This synthesis was generated inside LatexAI for the current paper-level workflow. Use it as high-level literature context, but do not paste it verbatim into source edits unless explicitly asked.',
      '',
      r,
      '=== END ATTACHED COLLECTION SYNTHESIS ==='
    ].join('\n');
  }
  function itemTitle(item) {
    const raw = item?.raw || item || {};
    return clean(raw.title || item?.title || raw.paperTitle || raw.name || 'Untitled paper');
  }
  function itemAuthors(item) {
    const raw = item?.raw || item || {};
    const authors = Array.isArray(raw.authors) ? raw.authors : (Array.isArray(item?.authors) ? item.authors : []);
    return authors.slice(0, 8).map((a) => typeof a === 'string' ? a : clean(a?.name || a?.authorName || a?.displayName || '')).filter(Boolean).join(', ');
  }
  function itemYear(item) {
    const raw = item?.raw || item || {};
    return clean(raw.year || raw.publicationYear || raw.published || raw.date || item?.year || '');
  }
  function itemUrl(item) {
    const raw = item?.raw || item || {};
    return clean(raw.url || raw.pdfUrl || raw.openAccessPdf?.url || raw.externalUrl || item?.url || '');
  }
  function itemSnippet(item) {
    const raw = item?.raw || item || {};
    return compactText(raw.abstract || raw.snippet || raw.summary || raw.tldr?.text || item?.abstract || item?.snippet || item?.notes || '', 900);
  }
  function collectionRecordBlock(feature) {
    const id = selectedCollectionId(feature);
    if (!id) return '';
    const c = collections().find((x) => x.id === id) || {};
    const items = collectionItems(id).filter((x) => x && String(x.role || '') !== 'excluded');
    if (!items.length) return '';
    const mode = normalizeMode(el(idFor(feature, 'Mode'))?.value || (feature === 'citationAi' ? 'citation_suggestions' : 'related_work'));
    const focus = clean(el(idFor(feature, 'Prompt'))?.value || '');
    const def = featureByName(feature);
    const lines = [
      '=== SELECTED LITERATURE COLLECTION CONTEXT FOR THIS AI RUN ===',
      'Feature: ' + clean(def.label || feature),
      'Collection: ' + clean(c.name || id) + ' [' + id + ']',
      'Synthesis mode requested for this workflow: ' + modeLabel(mode),
      focus ? 'Feature-specific focus: ' + focus : '',
      'Papers provided from selected collection: ' + items.length + '.',
      'Use these papers as scoped literature evidence for the current Paper AI run. Prefer concrete citation, related-work, novelty-positioning, and rebuttal suggestions tied to these records. Do not invent claims beyond the titles/abstract snippets/metadata shown here. If none are relevant, say so briefly.',
      ''
    ].filter(Boolean);
    items.slice(0, 40).forEach((item, idx) => {
      const raw = item?.raw || item || {};
      const bits = [];
      const yr = itemYear(item);
      const authors = itemAuthors(item);
      const url = itemUrl(item);
      const doi = clean(raw.doi || raw.externalIds?.DOI || raw.externalIds?.doi || '');
      const arxiv = clean(raw.arxiv_id || raw.arxivId || raw.externalIds?.ArXiv || raw.externalIds?.arXiv || '');
      const s2 = clean(raw.semanticScholarId || raw.paperId || raw.externalIds?.SemanticScholar || raw.externalIds?.S2 || '');
      bits.push('[' + (idx + 1) + '] ' + itemTitle(item) + (yr ? ' (' + yr + ')' : ''));
      if (authors) bits.push('Authors: ' + authors);
      if (item.role) bits.push('Collection role: ' + item.role);
      if (url) bits.push('URL: ' + url);
      if (arxiv) bits.push('arXiv: ' + arxiv);
      if (doi) bits.push('DOI: ' + doi);
      if (s2) bits.push('Semantic Scholar: ' + s2);
      const snip = itemSnippet(item);
      bits.push('Evidence snippet: ' + (snip || '(no abstract/snippet stored)'));
      lines.push(bits.join('\n'));
    });
    if (items.length > 40) lines.push('\nAdditional collection papers omitted from prompt for length: ' + (items.length - 40) + '.');
    lines.push('=== END SELECTED LITERATURE COLLECTION CONTEXT ===');
    return lines.join('\n');
  }
  function runContextBlockForFeature(feature) {
    if (!selectedCollectionId(feature)) return '';
    const blocks = [];
    const attached = attachedBlockForFeature(feature);
    if (attached) blocks.push(attached);
    const records = collectionRecordBlock(feature);
    if (records) blocks.push(records);
    return blocks.join('\n\n').slice(0, 18000);
  }
  function inferFeatureFromAsk(payload, meta) {
    const ctx = meta?.context || {};
    const haystack = [
      meta?.task, meta?.routeKey, ctx.workflow, ctx.agentRole, ctx.promptFile,
      payload?.workflow, payload?.task, payload?.citationWorkflow, payload?.documentWorkflow,
      payload?.debateAgent?.role, payload?.competitiveReview?.step
    ].map((v) => String(v || '').toLowerCase()).join(' ');
    if (/citation-ai|citation|bibtex|cite/.test(haystack)) return 'citationAi';
    if (/reviewer-rebuttal|reviewer|rebuttal/.test(haystack)) return 'reviewerSim';
    if (/devils-advocate|paper-debate|debate-advocate|debate-critic|debate-synthesizer/.test(haystack)) return 'devilsDebate';
    if (/branchworkflow|branch-workflow|realagentbranch|branch runner/.test(haystack)) return 'branchWorkflow';
    if (/competitive|competitor/.test(haystack)) return 'competitive';
    if (/paper-ai-polish|paper polish|polish/.test(haystack)) return 'paperAiPolish';
    if (/document-ai|documentai|paper-level-ai/.test(haystack)) return 'documentAi';
    return '';
  }
  function appendUniqueText(base, addition) {
    const b = String(base || '');
    const a = String(addition || '').trim();
    if (!a) return b;
    if (b.includes('=== SELECTED LITERATURE COLLECTION CONTEXT FOR THIS AI RUN ===') || b.includes('=== ATTACHED COLLECTION SYNTHESIS FOR THIS PAPER-AI FEATURE ===')) return b;
    return [a, b].filter((x) => clean(x)).join('\n\n');
  }
  function augmentAskPayloadWithCollectionContext(payload, meta, feature, block) {
    const nextPayload = payload && typeof payload === 'object' ? { ...payload } : {};
    const nextMeta = meta && typeof meta === 'object' ? { ...meta, context: { ...(meta.context || {}) } } : { context: {} };
    const id = selectedCollectionId(feature);
    const c = collections().find((x) => x.id === id) || {};
    const itemCount = collectionItems(id).filter((x) => x && String(x.role || '') !== 'excluded').length;
    const audit = {
      stage: STAGE,
      feature,
      collectionId: id,
      collectionName: clean(c.name || id),
      itemCount,
      injectedIntoAiProviderAsk: true,
      hasGeneratedSynthesis: !!attachedBlockForFeature(feature),
      mode: normalizeMode(el(idFor(feature, 'Mode'))?.value || (feature === 'citationAi' ? 'citation_suggestions' : 'related_work'))
    };
    if (typeof nextPayload.input === 'string') nextPayload.input = appendUniqueText(nextPayload.input, block);
    else if (typeof nextPayload.prompt === 'string') nextPayload.prompt = appendUniqueText(nextPayload.prompt, block);
    else if (typeof nextPayload.messages === 'string') nextPayload.messages = appendUniqueText(nextPayload.messages, block);
    else nextPayload.collectionContextBlock = block;
    if (typeof nextPayload.instructions === 'string') {
      nextPayload.instructions = appendUniqueText(nextPayload.instructions, 'Use the selected literature collection context for this run when it is relevant. Mention the collection papers used in any evidence audit; do not fabricate citations or claims.');
    }
    nextPayload.latexaiCollectionContext = audit;
    nextMeta.context.collectionContext = audit;
    nextMeta.context.selectedLiteratureCollectionId = id;
    return { payload: nextPayload, meta: nextMeta };
  }
  function patchAiProviderAsk() {
    const provider = NS.AIProvider;
    if (!provider || typeof provider.ask !== 'function') return false;
    if (provider.__stage19u9kCollectionContextPatched) return true;
    const originalAsk = provider.ask.bind(provider);
    provider.ask = async function askWithSelectedCollectionContext(payload, meta) {
      try {
        const feature = inferFeatureFromAsk(payload || {}, meta || {});
        const block = feature ? runContextBlockForFeature(feature) : '';
        if (block) {
          const augmented = augmentAskPayloadWithCollectionContext(payload || {}, meta || {}, feature, block);
          payload = augmented.payload;
          meta = augmented.meta;
        }
      } catch (err) {
        try { console.warn('[Latexai]', STAGE, 'collection context injection skipped', err); } catch (_ignored) {}
      }
      return originalAsk(payload, meta);
    };
    provider.__stage19u9kCollectionContextPatched = true;
    return true;
  }

  function inferFeatureFromData(data) {
    for (const def of FEATURES) {
      try { if (NS.KnowledgeContextService?.getLast?.(def.feature) === data) return def.feature; } catch (_err) {}
    }
    return '';
  }
  function patchKnowledgePromptBlock() {
    const svc = NS.KnowledgeContextService;
    if (!svc || patchedPromptBlock || !svc.promptBlock) return false;
    const original = svc.promptBlock.bind(svc);
    svc.promptBlock = function patchedPromptBlock19u9i(data) {
      const base = original(data);
      const feature = inferFeatureFromData(data);
      const extra = feature ? attachedBlockForFeature(feature) : '';
      return [base, extra].filter((x) => clean(x)).join('\n\n');
    };
    patchedPromptBlock = true;
    return true;
  }
  function bindGlobalEvents() {
    if (D.__collectionSynthesisPaperAiBound) return;
    D.__collectionSynthesisPaperAiBound = true;
    D.addEventListener('click', (event) => {
      const btn = event.target?.closest?.('[data-collection-synthesis-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-collection-synthesis-action') || '';
      const feature = btn.getAttribute('data-collection-synthesis-feature') || 'documentAi';
      event.preventDefault();
      event.stopPropagation();
      if (action === 'run') { runSynthesis(feature); return; }
      if (action === 'copy') { copyText(feature, false); return; }
      if (action === 'copy-lai') { copyText(feature, true); return; }
      if (action === 'append-lai') { appendToPaper(feature); return; }
    }, true);
  }
  function installWatchdog() {
    bindGlobalEvents();
    let ticks = 0;
    const run = () => {
      ticks += 1;
      try { patchKnowledgePromptBlock(); } catch (_err) {}
      try { patchAiProviderAsk(); } catch (_err) {}
      try { ensureSurfaces(); } catch (_err) {}
      if (ticks < 60) setTimeout(run, ticks < 10 ? 350 : 1200);
    };
    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  NS.CollectionSynthesisPaperAiService = {
    STAGE,
    ensureSurfaces,
    runSynthesis,
    attachedBlockForFeature,
    report,
    laiBlock,
    appendToPaper,
    runContextBlockForFeature,
    inferFeatureFromAsk
  };
  installWatchdog();
  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
