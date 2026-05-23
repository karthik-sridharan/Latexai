/* Latexai Stage 18M CompetitivePaperReviewService
 * Stage: stage18u-memory-aware-paper-edits-20260523-1
 *
 * Competitive paper comparison workflow.
 *
 * Source-cited web-research-agent version:
 * - competitor URLs are treated as web-research seeds, not PDFs to download/extract;
 * - the selected AI backend must expose a web_search/open capability;
 * - Latexai caches structured research profiles and source ledgers only, never raw PDF text.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage18u-memory-aware-paper-edits-20260523-1';
  const PROMPT_PATH = 'prompt/ai-competitive-paper-review.txt';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('competitive-paper-review-service')) {
    NS.CompetitivePaperReviewService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  let promptCache = '';
  let lastReport = '';
  let lastPayload = null;
  let lastCompetitorSummaries = [];
  let lastRankingReport = '';
  let lastComparisonReport = '';
  let lastRoadmapReport = '';
  let lastSourceLedger = [];
  let lastEvidenceCoverage = null;
  let lastEditImpactMap = [];
  const URL_CACHE_KEY = 'latexai:competitive-web-research-profile-cache:v3';
  const LEGACY_URL_CACHE_KEYS = ['latexai:competitive-web-research-profile-cache:v2', 'latexai:competitive-web-research-profile-cache:v1'];

  function State() { return NS.State; }
  function el(id) { return D.getElementById(id); }
  function clean(value) { return String(value || '').trim(); }

  function normalizePath(path) {
    try { return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    catch (_err) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
  }

  function project() {
    return State()?.state?.project || {};
  }

  function files() {
    return project().files || [];
  }

  function fileText(file) {
    if (!file) return '';
    return String(file.text ?? file.content ?? file.source ?? file.value ?? '');
  }

  function getFile(path) {
    const normalized = normalizePath(path);
    try {
      const found = State()?.getFile?.(normalized);
      if (found) return found;
    } catch (_err) {}
    return files().find((file) => normalizePath(file.path) === normalized) || null;
  }

  function rootPath() {
    const p = project();
    return normalizePath(p.rootFile || files().find((file) => /main\.tex$/i.test(file.path || ''))?.path || 'main.tex');
  }

  function activePath() {
    const candidates = [
      State()?.state?.activePath,
      State()?.state?.activeFilePath,
      State()?.state?.currentPath,
      project()?.activePath,
      project()?.activeFilePath,
      rootPath()
    ];
    for (const candidate of candidates) {
      if (candidate && getFile(candidate)) return normalizePath(candidate);
    }
    const pill = clean(el('activeFilePill')?.textContent);
    return normalizePath(pill || rootPath());
  }

  function activeSource() {
    const path = activePath();
    const editorText = String(el('sourceEditor')?.value || '');
    const file = getFile(path);
    const text = editorText || fileText(file);
    return { path, file, text };
  }

  function writeProjectFile(path, content) {
    const normalized = normalizePath(path);
    try {
      if (State()?.upsertFile) State().upsertFile(normalized, content);
      else if (State()?.updateFile && getFile(normalized)) State().updateFile(normalized, content);
      else {
        const p = project();
        p.files = p.files || [];
        const existing = p.files.find((file) => normalizePath(file.path) === normalized);
        if (existing) existing.text = content;
        else p.files.push({ path: normalized, text: content, kind: 'text' });
      }
    } catch (_err) {
      const p = project();
      p.files = p.files || [];
      const existing = p.files.find((file) => normalizePath(file.path) === normalized);
      if (existing) existing.text = content;
      else p.files.push({ path: normalized, text: content, kind: 'text' });
    }

    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    return normalized;
  }

  function readLines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function uniqueLines(lines) {
    const seen = new Set();
    const out = [];
    for (const line of lines || []) {
      const value = clean(line);
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out;
  }

  function normalizeUrlForCache(url) {
    const raw = clean(url);
    if (!raw) return '';
    try {
      const u = new URL(raw, W.location.href);
      u.hash = '';
      return u.href.replace(/\/$/, '');
    } catch (_err) {
      return raw.replace(/\s+/g, '').replace(/\/$/, '');
    }
  }

  function readJsonStorageObject(key) {
    try {
      const raw = W.localStorage?.getItem?.(key);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function readUrlCache() {
    const current = readJsonStorageObject(URL_CACHE_KEY);
    const out = { ...current };
    for (const legacyKey of LEGACY_URL_CACHE_KEYS || []) {
      const legacy = readJsonStorageObject(legacyKey);
      for (const [key, value] of Object.entries(legacy || {})) {
        if (!out[key]) out[key] = { ...value, migratedFrom: legacyKey };
      }
    }
    return out;
  }

  function writeUrlCache(cache) {
    try { W.localStorage?.setItem?.(URL_CACHE_KEY, JSON.stringify(cache || {})); return true; }
    catch (_err) { return false; }
  }

  function removeUrlCacheEntries(urls) {
    const keys = (urls || []).map(normalizeUrlForCache).filter(Boolean);
    if (!keys.length) return 0;
    let removed = 0;
    const cache = readUrlCache();
    for (const key of keys) {
      if (cache[key]) { delete cache[key]; removed += 1; }
    }
    writeUrlCache(cache);
    try {
      for (const legacyKey of LEGACY_URL_CACHE_KEYS || []) {
        const legacy = readJsonStorageObject(legacyKey);
        let changed = false;
        for (const key of keys) {
          if (legacy[key]) { delete legacy[key]; changed = true; }
        }
        if (changed) W.localStorage?.setItem?.(legacyKey, JSON.stringify(legacy));
      }
    } catch (_err) {}
    return removed;
  }

  function clearAllUrlCache() {
    try { W.localStorage?.removeItem?.(URL_CACHE_KEY); } catch (_err) {}
    try { (LEGACY_URL_CACHE_KEYS || []).forEach((key) => W.localStorage?.removeItem?.(key)); } catch (_err) {}
    return true;
  }

  function cachedPaperForUrl(url) {
    const key = normalizeUrlForCache(url);
    const entry = readUrlCache()[key];
    return entry && typeof entry === 'object' ? { ...entry, url: entry.url || url, cacheKey: key, cached: true } : null;
  }

  function savePaperSummariesToCache(papers) {
    const cache = readUrlCache();
    for (const paper of papers || []) {
      const key = normalizeUrlForCache(paper?.url || paper?.sourceUrl || '');
      if (!key) continue;
      cache[key] = {
        ...paper,
        url: paper.url || key,
        cachedAt: new Date().toISOString(),
        stage: STAGE
      };
    }
    writeUrlCache(cache);
    return cache;
  }

  function appendCompetitorUrlFromInput() {
    const input = el('competitiveAddUrlInput');
    const area = el('competitivePaperUrls');
    if (!input || !area) return false;
    const value = clean(input.value);
    if (!value) { setStatus('Enter a competitor URL first.'); return false; }
    const lines = uniqueLines([...readLines(area.value), value]);
    area.value = lines.join('\n');
    input.value = '';
    try { area.dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    updateWorkflowStatus('urls', `Added ${lines.length} competitor URL(s).`);
    setStatus(`Added competitor URL. Total URLs: ${lines.length}.`);
    return true;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>\"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function sourceLabel(value, fallback = '') {
    const raw = clean(value || fallback);
    return raw.replace(/\s+/g, ' ').slice(0, 260);
  }

  function normalizeSourceRecord(source, competitorUrl = '', paperTitle = '') {
    if (!source) return null;
    if (typeof source === 'string') {
      const label = sourceLabel(source);
      if (!label) return null;
      return { url: /^https?:\/\//i.test(label) ? label : '', title: label, kind: 'web-source', competitorUrl, paperTitle };
    }
    const url = clean(source.url || source.href || source.link || source.sourceUrl || '');
    const title = sourceLabel(source.title || source.name || source.label || source.description || url || competitorUrl);
    const kind = sourceLabel(source.kind || source.type || source.sourceType || 'web-source');
    const evidence = sourceLabel(source.evidence || source.snippet || source.quote || source.summary || source.rationale || '');
    if (!url && !title && !evidence) return null;
    return { url, title, kind, evidence, competitorUrl, paperTitle };
  }

  function sourceRecordsFromPaper(paper) {
    const sources = [];
    const url = clean(paper?.url || paper?.sourceUrl || '');
    const title = clean(paper?.title || '');
    const push = (src) => {
      const rec = normalizeSourceRecord(src, url, title);
      if (rec) sources.push(rec);
    };
    const raw = paper?.sourceRecords || paper?.sources || paper?.sourcesConsulted || paper?.evidenceSources || [];
    if (Array.isArray(raw)) raw.forEach(push);
    else readLines(raw).forEach(push);
    if (url) push({ url, title: title || url, kind: 'seed-url', evidence: 'User-provided competitor URL seed.' });
    return sources;
  }

  function buildSourceLedger(papers) {
    const seen = new Set();
    const ledger = [];
    for (const paper of papers || []) {
      for (const source of sourceRecordsFromPaper(paper)) {
        const key = `${(source.url || '').toLowerCase()}|${(source.title || '').toLowerCase()}|${(source.evidence || '').toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        ledger.push({ ...source, id: `S${ledger.length + 1}` });
      }
    }
    return ledger;
  }

  function sourceCoverage(papers, ledger) {
    const list = papers || [];
    const perPaper = list.map((paper) => {
      const url = clean(paper?.url || paper?.sourceUrl || '');
      const title = clean(paper?.title || url || 'competitor');
      const sourceCount = (ledger || []).filter((src) => clean(src.competitorUrl) === url || clean(src.paperTitle) === clean(paper?.title || '')).length;
      const accessed = paper?.accessed === true || sourceCount > 1;
      const evidenceStrength = sourceCount >= 3 ? 'strong' : sourceCount >= 2 ? 'moderate' : sourceCount >= 1 ? 'seed-only/limited' : 'missing';
      return { url, title, sourceCount, accessed, evidenceStrength };
    });
    return {
      competitorCount: list.length,
      sourceCount: (ledger || []).length,
      competitorsWithEvidence: perPaper.filter((x) => x.sourceCount > 1 || x.accessed).length,
      perPaper
    };
  }

  function sourcesMarkdown(ledger = lastSourceLedger) {
    const list = ledger && ledger.length ? ledger : buildSourceLedger(lastCompetitorSummaries);
    if (!list.length) return '(no source ledger available yet)';
    return list.map((src) => {
      const bits = [`[${src.id || 'S?'}] ${src.title || src.url || 'Untitled source'}`];
      if (src.url) bits.push(`URL: ${src.url}`);
      if (src.kind) bits.push(`Type: ${src.kind}`);
      if (src.paperTitle || src.competitorUrl) bits.push(`For: ${src.paperTitle || src.competitorUrl}`);
      if (src.evidence) bits.push(`Evidence: ${src.evidence}`);
      return `- ${bits.join(' | ')}`;
    }).join('\n');
  }

  function evidenceCoverageMarkdown(coverage = lastEvidenceCoverage) {
    const c = coverage || sourceCoverage(lastCompetitorSummaries, lastSourceLedger);
    const rows = [`Competitors: ${c.competitorCount || 0}`, `Sources: ${c.sourceCount || 0}`, `Competitors with non-seed evidence: ${c.competitorsWithEvidence || 0}`];
    for (const paper of c.perPaper || []) {
      rows.push(`- ${paper.title || paper.url}: ${paper.sourceCount} source(s), evidence=${paper.evidenceStrength}`);
    }
    return rows.join('\n');
  }

  function refreshEvidenceState(papers = lastCompetitorSummaries) {
    lastSourceLedger = buildSourceLedger(papers || []);
    lastEvidenceCoverage = sourceCoverage(papers || [], lastSourceLedger);
    const node = el('competitiveEvidenceStatus');
    if (node) {
      const c = lastEvidenceCoverage;
      node.innerHTML = [
        '<strong>Evidence ledger:</strong> ',
        `${c.sourceCount || 0} source(s) for ${c.competitorCount || 0} competitor(s); `,
        `${c.competitorsWithEvidence || 0} competitor(s) have non-seed evidence.`,
        '<br><span class="muted">Reports and ranking prompts should cite source IDs like [S1], [S2].</span>'
      ].join('');
    }
    renderEvidenceDashboard();
    return { ledger: lastSourceLedger, coverage: lastEvidenceCoverage };
  }

  function cacheAgeLabel(value) {
    const raw = clean(value);
    if (!raw) return '';
    const t = Date.parse(raw);
    if (!Number.isFinite(t)) return raw;
    const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `${hours} hr ago`;
    return `${Math.round(hours / 24)} day(s) ago`;
  }

  function sourceIdsForPaper(paper, ledger = lastSourceLedger) {
    const url = clean(paper?.url || paper?.sourceUrl || '');
    const title = clean(paper?.title || '');
    return (ledger || [])
      .filter((src) => (url && clean(src.competitorUrl) === url) || (title && clean(src.paperTitle) === title))
      .map((src) => src.id)
      .filter(Boolean);
  }

  function paperCoverageInfo(paper) {
    const url = clean(paper?.url || paper?.sourceUrl || '');
    const title = clean(paper?.title || url || 'competitor');
    const row = (lastEvidenceCoverage?.perPaper || []).find((x) => clean(x.url) === url || clean(x.title) === title) || {};
    const sourceCount = Number.isFinite(row.sourceCount) ? row.sourceCount : sourceIdsForPaper(paper).length;
    const accessed = paper?.accessed === true || row.accessed === true;
    const strength = row.evidenceStrength || (sourceCount >= 3 ? 'strong' : sourceCount >= 2 ? 'moderate' : sourceCount >= 1 ? 'seed-only/limited' : 'missing');
    const warnings = [];
    if (sourceCount <= 1) warnings.push('Only seed or one source found');
    if (!clean(paper?.abstract || '')) warnings.push('No abstract/summary captured');
    if (!accessed && sourceCount <= 1) warnings.push('Ranking evidence may be weak');
    return { title, url, sourceCount, accessed, strength, warnings, sourceIds: sourceIdsForPaper(paper) };
  }

  function parseRankingEntries(report = lastRankingReport) {
    const text = String(report || '');
    for (const candidate of parseJsonCandidates(text)) {
      try {
        const data = JSON.parse(candidate);
        const list = Array.isArray(data) ? data
          : Array.isArray(data?.ranking) ? data.ranking
          : Array.isArray(data?.competitorRanking) ? data.competitorRanking
          : Array.isArray(data?.rankedCompetitors) ? data.rankedCompetitors
          : [];
        const rows = list.map((item, index) => ({
          rank: Number(item?.rank) || index + 1,
          title: clean(item?.title || item?.paper || item?.name || item?.url || `Competitor ${index + 1}`),
          url: clean(item?.url || item?.sourceUrl || ''),
          mainStrength: clean(item?.mainStrength || item?.strength || item?.rationale || ''),
          relevance: clean(item?.relevance || item?.relevanceToDraft || item?.draftRelevance || ''),
          sourceIds: Array.isArray(item?.sourceIds) ? item.sourceIds.map(clean).filter(Boolean) : readLines(item?.sourceIds || item?.evidence || '')
        })).filter((row) => row.title || row.url);
        if (rows.length) return rows.sort((a, b) => a.rank - b.rank);
      } catch (_err) {}
    }
    const mdRows = [];
    const rowRe = /^\s*\|\s*(\d+)\s*\|\s*([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)\|/gm;
    let match;
    while ((match = rowRe.exec(text))) {
      mdRows.push({ rank: Number(match[1]), title: clean(match[2]), mainStrength: clean(match[3]), sourceIds: (match[4].match(/S\d+/g) || []), relevance: clean(match[5]), url: '' });
    }
    return mdRows.sort((a, b) => a.rank - b.rank);
  }

  function renderRankingPreview() {
    const node = el('competitiveRankingPreview');
    if (!node) return;
    const rows = parseRankingEntries(lastRankingReport);
    if (!rows.length) {
      node.innerHTML = '<div class="competitive-ranking-empty">Ranking table will appear here after <strong>Rank competitors</strong>.</div>';
      renderEditImpactMap();
      return;
    }
    node.innerHTML = [
      '<div class="competitive-ui-title">Ranking preview</div>',
      '<div class="competitive-ranking-scroll"><table class="competitive-ranking-table">',
      '<thead><tr><th>Rank</th><th>Paper</th><th>Main strength</th><th>Evidence</th><th>Relevance</th></tr></thead>',
      '<tbody>',
      ...rows.map((row) => [
        '<tr>',
        `<td>#${escapeHtml(row.rank)}</td>`,
        `<td>${escapeHtml(row.title || row.url || 'Untitled')}</td>`,
        `<td>${escapeHtml(row.mainStrength || '(not stated)')}</td>`,
        `<td>${escapeHtml((row.sourceIds || []).join(', ') || 'weak/uncited')}</td>`,
        `<td>${escapeHtml(row.relevance || '(not stated)')}</td>`,
        '</tr>'
      ].join('')),
      '</tbody></table></div>'
    ].join('');
    renderEditImpactMap();
  }

  function splitValueList(value) {
    if (Array.isArray(value)) return value.map(clean).filter(Boolean);
    if (value && typeof value === 'object') return Object.values(value).flatMap(splitValueList).map(clean).filter(Boolean);
    return String(value || '')
      .split(/\r?\n|[,;]+/)
      .map((x) => clean(x.replace(/^[-*•]\s*/, '')))
      .filter(Boolean);
  }

  function sourceIdsFromAny(value) {
    const out = [];
    const push = (v) => {
      const ids = String(v || '').match(/\bS\d+\b/gi) || [];
      ids.forEach((id) => out.push(id.toUpperCase()));
    };
    if (Array.isArray(value)) value.forEach(push);
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => Array.isArray(v) ? v.forEach(push) : push(v));
    else push(value);
    return Array.from(new Set(out));
  }

  function normalizeRankingEffect(effect, edit = {}, index = 0) {
    const e = effect && typeof effect === 'object' ? effect : { expectedImpact: String(effect || '') };
    const before = clean(e.before || e.currentPosition || e.currentRank || e.rankBefore || edit.currentPosition || '');
    const after = clean(e.after || e.projectedPosition || e.expectedPosition || e.rankAfter || edit.expectedPosition || '');
    const expectedImpact = clean(e.expectedImpact || e.impact || e.rankingEffect || e.effect || (before || after ? `${before || '?'} → ${after || '?'}` : ''));
    const competitors = splitValueList(e.competitors || e.addressesCompetitors || e.competitorGaps || e.against || edit.addressesCompetitors || edit.competitors);
    const gap = clean(e.gap || e.competitiveGap || e.addressesGap || edit.gap || edit.reason || '');
    const sourceIds = sourceIdsFromAny(e.sourceIds || e.evidence || e.evidenceIds || e.sources || edit.sourceIds || edit.evidence || edit.rankingEffect || expectedImpact);
    const evidence = clean(e.evidence || e.evidenceSummary || e.sourceEvidence || '');
    const insertionMode = clean(e.insertionMode || e.insertMode || edit.insertionMode || '') || (edit.mode === 'replace' ? 'inline \\laiold/\\lai' : 'inline \\lai insert');
    return {
      editIndex: index + 1,
      competitors,
      gap,
      sourceIds,
      evidence,
      before,
      after,
      expectedImpact,
      insertionMode
    };
  }

  function insertionReadiness(edit) {
    const path = normalizePath(edit?.path || activePath());
    const file = getFile(path);
    if (!file) return { label: 'file missing', ok: false, path };
    const text = fileText(file);
    const anchor = String(edit?.oldText || '');
    if (!anchor.trim()) return { label: 'append/manual only', ok: false, path };
    const at = text.indexOf(anchor);
    if (at < 0) return { label: 'anchor not found; append/manual fallback', ok: false, path };
    const issue = unsafeInsertionLocationReason(text, at);
    if (issue) return { label: issue, ok: false, path };
    return { label: edit.mode === 'replace' ? 'inline exact match' : 'inline anchor match', ok: true, path };
  }

  function buildEditImpactMap(report = lastReport) {
    const parsed = extractActionableEdits(report || '');
    const rows = (parsed.edits || []).map((edit, index) => {
      const effect = normalizeRankingEffect(edit.rankingEffect || edit.impact || edit.rankImpact || edit.expectedRankingEffect || edit, edit, index);
      const ready = insertionReadiness(edit);
      return {
        index: index + 1,
        title: clean(edit.title || edit.label || edit.targetHint || `Edit ${index + 1}`),
        targetHint: clean(edit.targetHint || ''),
        path: normalizePath(edit.path || activePath()),
        mode: edit.mode,
        confidence: edit.confidence,
        readiness: ready,
        rankingEffect: effect,
        sourceIds: Array.from(new Set([...(effect.sourceIds || []), ...sourceIdsFromAny(edit.sourceIds || edit.evidence || '')]))
      };
    });
    lastEditImpactMap = rows;
    return rows;
  }

  function editImpactMarkdown(rows = lastEditImpactMap) {
    const list = rows && rows.length ? rows : buildEditImpactMap(lastReport);
    if (!list.length) return '(no actionable edit impact map available yet)';
    return list.map((row) => {
      const effect = row.rankingEffect || {};
      return [
        `### Edit ${row.index}: ${row.title || row.targetHint || 'Untitled edit'}`,
        `Target: ${row.path}${row.targetHint ? ` — ${row.targetHint}` : ''}`,
        effect.competitors?.length ? `Addresses gap with: ${effect.competitors.join(', ')}` : '',
        effect.gap ? `Gap addressed: ${effect.gap}` : '',
        (row.sourceIds?.length || effect.sourceIds?.length) ? `Evidence: ${(row.sourceIds?.length ? row.sourceIds : effect.sourceIds).join(', ')}` : 'Evidence: not specified',
        effect.expectedImpact ? `Expected ranking effect: ${effect.expectedImpact}` : (effect.before || effect.after ? `Expected ranking effect: ${effect.before || '?'} → ${effect.after || '?'}` : 'Expected ranking effect: not specified'),
        `Insertion: ${effect.insertionMode || row.mode || 'not specified'}; readiness=${row.readiness?.label || 'unknown'}`
      ].filter(Boolean).join('\n');
    }).join('\n\n');
  }

  function renderEditImpactMap() {
    const node = el('competitiveEditImpactMap');
    if (!node) return;
    const rows = buildEditImpactMap(lastReport);
    if (!rows.length) {
      node.innerHTML = '<div class="competitive-impact-empty">Edit impact map will appear after <strong>Generate source-cited roadmap</strong> or <strong>Run full cited review</strong>. Each row will connect a proposed <code>\\lai</code> edit to competitor gaps, evidence IDs, and expected rank movement.</div>';
      return;
    }
    node.innerHTML = [
      '<div class="competitive-ui-title">Edit impact map</div>',
      '<div class="competitive-impact-list">',
      ...rows.map((row) => {
        const effect = row.rankingEffect || {};
        const evidence = row.sourceIds?.length ? row.sourceIds : (effect.sourceIds || []);
        const impact = effect.expectedImpact || (effect.before || effect.after ? `${effect.before || '?'} → ${effect.after || '?'}` : 'Not specified');
        return [
          '<article class="competitive-impact-card">',
          '<div class="competitive-impact-head">',
          `<strong>Edit ${escapeHtml(row.index)}: ${escapeHtml(row.title || row.targetHint || 'Untitled edit')}</strong>`,
          `<span class="competitive-impact-badge ${row.readiness?.ok ? 'good' : 'weak'}">${escapeHtml(row.readiness?.ok ? 'inline ready' : 'needs fallback')}</span>`,
          '</div>',
          `<div class="competitive-impact-meta"><b>Target:</b> ${escapeHtml(row.path)}${row.targetHint ? ` · ${escapeHtml(row.targetHint)}` : ''}</div>`,
          effect.competitors?.length ? `<div class="competitive-impact-meta"><b>Addresses gap with:</b> ${escapeHtml(effect.competitors.join(', '))}</div>` : '',
          effect.gap ? `<div class="competitive-impact-meta"><b>Gap:</b> ${escapeHtml(effect.gap)}</div>` : '',
          `<div class="competitive-impact-meta"><b>Evidence:</b> ${escapeHtml(evidence.join(', ') || 'not specified')}</div>`,
          `<div class="competitive-impact-meta"><b>Expected effect:</b> ${escapeHtml(impact)}</div>`,
          `<div class="competitive-impact-meta"><b>Insertion:</b> ${escapeHtml(effect.insertionMode || row.mode || 'not specified')} · ${escapeHtml(row.readiness?.label || 'unknown')}</div>`,
          '</article>'
        ].join('');
      }),
      '</div>'
    ].join('');
  }

  function renderEvidenceDashboard() {
    const node = el('competitiveEvidenceDashboard');
    if (!node) { renderRankingPreview(); return; }
    const papers = lastCompetitorSummaries || [];
    if (!papers.length) {
      node.innerHTML = '<div class="competitive-evidence-empty">No competitor research profiles yet. Add URLs and click <strong>Research competitor papers</strong>.</div>';
      renderRankingPreview();
      return;
    }
    node.innerHTML = [
      '<div class="competitive-ui-title">Competitor evidence cards</div>',
      '<div class="competitive-evidence-card-grid">',
      ...papers.map((paper, index) => {
        const info = paperCoverageInfo(paper);
        const cache = paper?.cached ? `hit${paper.cachedAt ? ` · ${cacheAgeLabel(paper.cachedAt)}` : ''}` : 'miss/current run';
        const badgeClass = info.strength === 'strong' ? 'good' : info.strength === 'moderate' ? 'moderate' : 'weak';
        const sources = (lastSourceLedger || []).filter((src) => info.sourceIds.includes(src.id));
        return [
          `<article class="competitive-evidence-card" data-competitive-url="${escapeHtml(info.url)}">`,
          '<div class="competitive-evidence-card-head">',
          `<div><div class="competitive-card-kicker">Competitor ${index + 1}</div><strong>${escapeHtml(info.title || info.url || 'Untitled')}</strong></div>`,
          `<span class="competitive-evidence-badge ${badgeClass}">${escapeHtml(info.strength)}</span>`,
          '</div>',
          info.url ? `<div class="competitive-card-url">${escapeHtml(info.url)}</div>` : '',
          `<div class="competitive-card-meta">Sources: ${info.sourceCount} · Cache: ${escapeHtml(cache)} · IDs: ${escapeHtml(info.sourceIds.join(', ') || 'none')}</div>`,
          info.warnings.length ? `<div class="competitive-card-warning">${escapeHtml(info.warnings.join('; '))}</div>` : '<div class="competitive-card-ok">Evidence coverage looks usable.</div>',
          '<div class="competitive-card-actions">',
          '<button class="btn mini competitive-toggle-sources" type="button">View sources</button>',
          '<button class="btn mini competitive-rerun-url" type="button">Rerun research</button>',
          '<button class="btn mini competitive-clear-url-cache" type="button">Clear cache</button>',
          '</div>',
          '<div class="competitive-card-sources" hidden>',
          sources.length ? sources.map((src) => `<div><strong>[${escapeHtml(src.id)}]</strong> ${escapeHtml(src.title || src.url || 'Source')} ${src.url ? `<span class="competitive-card-url">${escapeHtml(src.url)}</span>` : ''}</div>`).join('') : '<div>No sources in ledger for this competitor yet.</div>',
          '</div>',
          '</article>'
        ].join('');
      }),
      '</div>'
    ].join('');
    renderRankingPreview();
  }

  function clearResearchCacheForCurrentUrls() {
    const urls = parseCompetitorInputs().urls;
    if (!urls.length) { setStatus('No competitor URLs to clear from cache.'); return { ok: false, removed: 0 }; }
    const removed = removeUrlCacheEntries(urls);
    lastCompetitorSummaries = lastCompetitorSummaries.map((paper) => ({ ...paper, cached: false, cachedAt: '' }));
    refreshEvidenceState(lastCompetitorSummaries);
    setStatus(`Cleared ${removed} cached competitor research profile(s) for current URLs.`);
    return { ok: true, removed };
  }

  async function rerunAllCompetitorResearch() {
    const urls = parseCompetitorInputs().urls;
    if (!urls.length) { setStatus('Add competitor URLs before rerunning research.'); return { ok: false }; }
    removeUrlCacheEntries(urls);
    lastCompetitorSummaries = [];
    lastSourceLedger = [];
    lastEvidenceCoverage = null;
    lastRankingReport = '';
    lastComparisonReport = '';
    lastRoadmapReport = '';
    lastEditImpactMap = [];
    refreshEvidenceState([]);
    renderEditImpactMap();
    setStatus('Cleared current competitor research cache; rerunning web research...');
    return researchCompetitorPapers();
  }

  async function rerunSingleCompetitorResearch(url) {
    const target = clean(url);
    if (!target) return { ok: false };
    removeUrlCacheEntries([target]);
    lastCompetitorSummaries = (lastCompetitorSummaries || []).filter((paper) => normalizeUrlForCache(paper?.url || paper?.sourceUrl || '') !== normalizeUrlForCache(target));
    refreshEvidenceState(lastCompetitorSummaries);
    setStatus(`Cleared cache for ${target}; rerunning web research for current URL set...`);
    return researchCompetitorPapers();
  }

  function handleEvidenceDashboardClick(event) {
    const target = event.target?.closest?.('button');
    if (!target) return;
    const card = target.closest('[data-competitive-url]');
    const url = card?.getAttribute('data-competitive-url') || '';
    if (target.classList.contains('competitive-toggle-sources')) {
      event.preventDefault();
      const panel = card?.querySelector?.('.competitive-card-sources');
      if (panel) {
        panel.hidden = !panel.hidden;
        target.textContent = panel.hidden ? 'View sources' : 'Hide sources';
      }
    }
    if (target.classList.contains('competitive-clear-url-cache')) {
      event.preventDefault();
      const removed = removeUrlCacheEntries([url]);
      setStatus(`Cleared ${removed} cache entr${removed === 1 ? 'y' : 'ies'} for selected competitor.`);
      const paper = (lastCompetitorSummaries || []).find((p) => normalizeUrlForCache(p.url || p.sourceUrl || '') === normalizeUrlForCache(url));
      if (paper) { paper.cached = false; paper.cachedAt = ''; }
      refreshEvidenceState(lastCompetitorSummaries);
    }
    if (target.classList.contains('competitive-rerun-url')) {
      event.preventDefault();
      rerunSingleCompetitorResearch(url);
    }
  }

  function updateWorkflowStatus(step, message) {
    const node = el('competitiveWorkflowStatus');
    if (!node) return;
    const labels = {
      urls: '1. URLs',
      fetch: '2. Web research',
      rank: '3. Rank competitors',
      compare: '4. Compare draft',
      roadmap: '5. Improvement roadmap',
      insert: '6. Insert edits'
    };
    const rows = Array.from(node.querySelectorAll('[data-competitive-step]'));
    if (!rows.length) {
      node.innerHTML = Object.keys(labels).map((key) => [
        `<div class="competitive-step-row${key === step ? ' active' : ''}" data-competitive-step="${key}">`,
        `<span class="competitive-step-label">${labels[key]}</span>`,
        `<span class="competitive-step-message">${key === step ? escapeHtml(message || 'ready') : 'pending'}</span>`,
        '</div>'
      ].join('')).join('');
      return;
    }
    for (const row of rows) {
      const key = row.dataset.competitiveStep;
      if (key === step) {
        row.classList.add('active');
        const msg = row.querySelector('.competitive-step-message');
        if (msg) msg.textContent = message || 'done';
      }
    }
  }

  function parseCompetitorInputs() {
    const urls = uniqueLines(readLines(el('competitivePaperUrls')?.value));
    const notesRaw = String(el('competitivePaperNotes')?.value || '');
    const notes = notesRaw.trim();
    return { urls, notes };
  }

  function targetModes() {
    return Array.from(D.querySelectorAll('[data-competitive-mode]:checked')).map((box) => box.dataset.competitiveMode);
  }

  function draftExcerpt(text, maxChars = 45000) {
    const s = String(text || '');
    if (s.length <= maxChars) return s;
    const head = s.slice(0, Math.floor(maxChars * 0.65));
    const tail = s.slice(-Math.floor(maxChars * 0.35));
    return `${head}\n\n% ... [middle omitted for competitive review prompt] ...\n\n${tail}`;
  }

  function promptUrl() {
    const stage = encodeURIComponent(W.LUMINA_LATEX_STAGE || STAGE);
    return `${PROMPT_PATH}?v=${stage}`;
  }

  async function loadPrompt() {
    if (promptCache) return promptCache;
    try {
      const response = await fetch(promptUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      promptCache = text.trim() || fallbackPrompt();
    } catch (_err) {
      promptCache = fallbackPrompt();
    }
    return promptCache;
  }

  function fallbackPrompt() {
    return [
      'You are Latexai Competitive Paper Reviewer.',
      'Rank competitor papers from the supplied URLs/notes, compare the current draft, and produce a concrete improvement roadmap.',
      'Do not claim to have read URLs unless their content is provided in notes.',
      'Return Markdown with: ranked competitors, current draft position, weaknesses, concrete edits, predicted rank shift, and suggested lai/laiold edits.',
      'Also include a fenced latexai_actionable_edits JSON block with exact oldText/newText edits that can be inserted using \\laiold and \\lai.'
    ].join('\n');
  }

  function aiStatusUrl() {
    const raw = clean(el('aiProxyUrl')?.value) || '/api/lumina/ai';
    try {
      const url = new URL(raw, W.location.href);
      if (/\/api\/lumina\/ai\/?$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(/\/?$/, '/status');
        url.search = '';
        return url.href;
      }
      if (/\/api\/lumina\/ai\/status\/?$/i.test(url.pathname)) return url.href;
    } catch (_err) {}
    return raw.replace(/\/api\/lumina\/ai\/?$/i, '/api/lumina/ai/status');
  }

  function currentAiProvider() {
    return clean(el('aiProvider')?.value || 'openai');
  }

  function currentAiModel() {
    return clean(el('aiModel')?.value || '');
  }

  function requireWebSearch() {
    // Stage 16C policy: competitive review must use web-search-capable AI.
    return true;
  }


  const MEMORY_ENABLED_KEY = 'latexai:memory-enabled';
  let lastMemoryContextByStep = {};

  function memoryEnabled() {
    return String(W.localStorage?.getItem?.(MEMORY_ENABLED_KEY) || 'true') !== 'false';
  }

  function stableHash(value) {
    const s = String(value || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  function memoryBaseUrl() {
    const raw = clean(el('compileProxyUrl')?.value) || clean(el('aiProxyUrl')?.value) || '/api/lumina/latex/compile';
    try {
      const url = new URL(raw, W.location.href);
      url.search = '';
      url.hash = '';
      url.pathname = url.pathname
        .replace(/\/api\/lumina\/latex\/compile(?:\/jobs)?\/?$/i, '/api/lumina/memory')
        .replace(/\/api\/lumina\/ai(?:\/status|\/workflows|\/models)?\/?$/i, '/api/lumina/memory');
      if (!/\/api\/lumina\/memory\/?$/i.test(url.pathname)) url.pathname = '/api/lumina/memory';
      return url.href.replace(/\/$/, '');
    } catch (_err) {
      return raw.replace(/\/api\/lumina\/latex\/compile(?:\/jobs)?\/?$/i, '/api/lumina/memory')
        .replace(/\/api\/lumina\/ai(?:\/status|\/workflows|\/models)?\/?$/i, '/api/lumina/memory')
        .replace(/\/$/, '');
    }
  }

  function memoryHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = clean(el('compileProxyToken')?.value) || clean(el('aiProxyToken')?.value);
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  function projectIdentity() {
    const p = project() || {};
    const root = rootPath();
    const source = activeSource();
    const projectKey = p.id || p.projectId || p.name || p.title || root || 'default-project';
    const paperKey = `${projectKey}:${root}`;
    let sessionId = '';
    try {
      sessionId = W.sessionStorage?.getItem?.('latexai:memory-session-id') || '';
      if (!sessionId) {
        sessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        W.sessionStorage?.setItem?.('latexai:memory-session-id', sessionId);
      }
    } catch (_err) { sessionId = `sess-${stableHash(String(Date.now()))}`; }
    return {
      userId: 'local-user',
      projectId: `project-${stableHash(projectKey)}`,
      paperId: `paper-${stableHash(paperKey)}`,
      sectionId: source?.path ? `section-${stableHash(source.path)}` : undefined,
      sessionId,
      rootPath: root,
      activePath: source?.path || activePath()
    };
  }

  async function memoryFetch(path, options = {}) {
    if (!memoryEnabled()) return null;
    try {
      const response = await fetch(`${memoryBaseUrl()}${path}`, { ...options, headers: { ...memoryHeaders(), ...(options.headers || {}) }, cache: 'no-store' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.ok === false) throw new Error(json?.detail || json?.error?.message || `HTTP ${response.status}`);
      return json;
    } catch (err) {
      try { console.warn('[Latexai memory] non-blocking request failed', path, err); } catch (_err) {}
      return null;
    }
  }

  async function memoryPost(path, payload) {
    return memoryFetch(path, { method: 'POST', body: JSON.stringify(payload || {}) });
  }

  function memorySemanticQuery(stepName, extraText = '') {
    const src = activeSource();
    const excerpt = String(src?.text || src?.content || '').slice(0, 8000);
    return [stepName, activePath(), extraText, excerpt].filter(Boolean).join('\n');
  }

  async function loadCompetitiveMemoryContext(stepName, limit = 10, queryText = '') {
    const ids = projectIdentity();
    const qs = new URLSearchParams({ userId: ids.userId, projectId: ids.projectId, paperId: ids.paperId, sessionId: ids.sessionId, task: stepName, limit: String(limit) });
    const q = memorySemanticQuery(stepName, queryText);
    if (q) qs.set('q', q.slice(0, 12000));
    if (ids.sectionId) qs.set('sectionId', ids.sectionId);
    const json = await memoryFetch(`/context?${qs.toString()}`);
    const ctx = json?.context || { facts: [], summaries: [], graphEdges: [] };
    lastMemoryContextByStep[stepName] = ctx;
    return ctx;
  }

  function memoryContextMarkdown(ctx) {
    const facts = Array.isArray(ctx?.facts) ? ctx.facts.slice(0, 10) : [];
    const summaries = Array.isArray(ctx?.summaries) ? ctx.summaries.slice(0, 3) : [];
    const graphEdges = Array.isArray(ctx?.graphEdges) ? ctx.graphEdges.slice(0, 8) : [];
    if (!facts.length && !summaries.length && !graphEdges.length) return '';
    const lines = [
      '--- Hidden Latexai project memory context ---',
      'Use these backend memories silently to improve the review. Treat them as project context, not as user-facing content. Do not mention the memory system in the report unless explicitly asked.',
      'Respect stable preferences, avoid repeated rejected directions, and use prior reviewer concerns only when relevant to the current draft.'
    ];
    summaries.forEach((s) => {
      const content = String(s.content || '').replace(/\s+/g, ' ').trim();
      if (content) lines.push(`Project ${s.summary_type || s.summaryType || 'summary'}: ${content.slice(0, 1200)}`);
    });
    facts.forEach((f, i) => {
      const kind = f.fact_type || f.factType || f.key || 'memory';
      const value = String(f.value || f.content || '').replace(/\s+/g, ' ').trim();
      const score = f.retrievalScore != null ? `; score=${Number(f.retrievalScore).toFixed(3)}` : '';
      const uses = f.use_count || f.useCount || 0;
      const success = f.successful_use_count || f.successfulUseCount || 0;
      if (value) lines.push(`M${i + 1} [${kind}; uses=${uses}; success=${success}${score}]: ${value.slice(0, 700)}`);
    });
    if (graphEdges.length) {
      lines.push('Related memory graph edges:');
      graphEdges.forEach((e, i) => {
        const rel = e.relation || 'related_to';
        const weight = e.weight != null ? Number(e.weight).toFixed(2) : '0.50';
        const evidence = String(e.evidence || '').replace(/\s+/g, ' ').trim();
        lines.push(`G${i + 1} [${rel}; weight=${weight}]: ${e.from_memory_id || e.fromMemoryId || '?'} -> ${e.to_memory_id || e.toMemoryId || '?'}${evidence ? `; ${evidence.slice(0, 220)}` : ''}`);
      });
    }
    return lines.join('\n');
  }

  async function markMemoryUse(stepName, outcome, note = '') {
    const facts = Array.isArray(lastMemoryContextByStep[stepName]?.facts) ? lastMemoryContextByStep[stepName].facts : [];
    await Promise.all(facts.slice(0, 8).map((fact) => memoryPost('/use', { memoryId: fact.id, taskType: stepName, agentId: 'competitive-review-agent', outcome: outcome || 'used', note, metadata: { stage: STAGE } })));
  }

  function summarizeMemoryText(text, max = 1400) {
    return String(text || '').replace(/```[\s\S]*?```/g, '[structured block omitted]').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  async function saveCompetitiveMemory(stepName, report, payload = null, extra = {}) {
    if (!memoryEnabled() || !String(report || '').trim()) return null;
    const ids = projectIdentity();
    const base = {
      userId: ids.userId, projectId: ids.projectId, paperId: ids.paperId, sessionId: ids.sessionId,
      source: 'competitive-paper-review-service',
      metadata: {
        stage: STAGE,
        stepName,
        rootPath: ids.rootPath,
        activePath: ids.activePath,
        targetVenue: payload?.targetVenue || clean(el('competitiveTargetVenue')?.value),
        targetAudience: payload?.targetAudience || clean(el('competitiveTargetAudience')?.value),
        comparisonModes: payload?.comparisonModes || targetModes(),
        competitorUrls: payload?.competitorUrls || parseCompetitorInputs().urls,
        ...extra
      }
    };
    const event = await memoryPost('/event', { ...base, eventType: `competitive_${stepName}`, content: summarizeMemoryText(report, 3000) });
    const fact = await memoryPost('/fact', {
      ...base,
      scope: 'paper',
      factType: `competitive_${stepName}`,
      key: `competitive:${stepName}:${stableHash(report)}`,
      value: summarizeMemoryText(report, 1800),
      confidence: 0.78,
      importance: stepName === 'final_review' ? 0.9 : 0.75,
      status: 'active'
    });
    await memoryPost('/summary', {
      ...base,
      scope: 'paper',
      summaryType: 'competitive_review_state',
      content: [`Latest competitive review step: ${stepName}.`, payload?.targetVenue ? `Target venue: ${payload.targetVenue}.` : '', payload?.targetAudience ? `Target audience: ${payload.targetAudience}.` : '', summarizeMemoryText(report, 1600)].filter(Boolean).join('\n')
    });
    if (event?.id && fact?.id) await memoryPost('/edge', { fromMemoryId: fact.id, toMemoryId: event.id, relation: 'derived_from_event', weight: 0.9, evidence: `Competitive review ${stepName}`, metadata: { stage: STAGE } });
    let workingFact = null;
    if (stepName === 'final_review') {
      workingFact = await memoryPost('/fact', {
        ...base,
        scope: 'working',
        factType: 'competitive_working_memory',
        key: `working:competitive:${stableHash(report)}`,
        value: summarizeMemoryText(report, 1200),
        confidence: 0.74,
        importance: 0.92,
        status: 'active'
      });
      if (workingFact?.id && fact?.id) await memoryPost('/edge', { fromMemoryId: workingFact.id, toMemoryId: fact.id, relation: 'working_cache_of', weight: 0.82, evidence: 'Promoted final competitive review into active working memory for later agent calls.', metadata: { stage: STAGE } });
    }
    return { event, fact, workingFact };
  }

  async function savePaperEditMemory(stepName, result = {}, extra = {}) {
    if (!memoryEnabled()) return null;
    const ids = projectIdentity();
    const status = result?.ok ? 'success' : (Number(result?.applied || 0) > 0 ? 'success' : 'failure');
    const applied = Number(result?.applied || (result?.ok ? 1 : 0));
    const skipped = Number(result?.skipped || 0);
    const paths = Array.isArray(result?.paths) ? result.paths : (result?.path ? [result.path] : []);
    const content = [
      `Paper edit operation: ${stepName}`,
      `Outcome: ${status}`,
      `Applied: ${applied}`,
      `Skipped: ${skipped}`,
      paths.length ? `Paths: ${paths.join(', ')}` : '',
      result?.source ? `Source: ${result.source}` : '',
      Array.isArray(result?.messages) ? result.messages.slice(0, 20).join('\n') : '',
      extra?.note || ''
    ].filter(Boolean).join('\n');
    const base = {
      userId: ids.userId,
      projectId: ids.projectId,
      paperId: ids.paperId,
      sectionId: ids.sectionId,
      sessionId: ids.sessionId,
      source: 'competitive-paper-review-service',
      metadata: { stage: STAGE, stepName, rootPath: ids.rootPath, activePath: ids.activePath, paths, applied, skipped, status, ...extra }
    };
    const event = await memoryPost('/event', { ...base, eventType: `competitive_paper_edit_${stepName}`, content });
    const fact = await memoryPost('/fact', {
      ...base,
      scope: applied > 0 ? 'working' : 'paper',
      factType: status === 'success' ? 'successful_paper_edit_pattern' : 'failed_paper_edit_attempt',
      key: `competitive-paper-edit:${stepName}:${stableHash(content)}`,
      value: content,
      confidence: status === 'success' ? 0.78 : 0.44,
      importance: status === 'success' ? 0.82 : 0.62,
      status: 'active'
    });
    if (event?.id && fact?.id) await memoryPost('/edge', {
      fromMemoryId: fact.id,
      toMemoryId: event.id,
      relation: 'derived_from_edit_event',
      weight: status === 'success' ? 0.88 : 0.62,
      evidence: `Competitive paper edit ${stepName}: ${status}`,
      metadata: { stage: STAGE }
    });
    return { event, fact };
  }

  function webSearchAvailableFromStatus(status) {
    const provider = currentAiProvider();
    const web = status?.webSearch || status?.capabilities?.webSearch || {};
    if (web.available === true || web.supported === true && web.enabled !== false) {
      if (!web.providers) return true;
    }
    const providerInfo = web.providers?.[provider] || status?.providers?.[provider]?.webSearch || {};
    if (providerInfo === true) return true;
    if (providerInfo?.available === true) return true;
    if (providerInfo?.supported === true && providerInfo?.enabled !== false && providerInfo?.configured !== false) return true;
    return false;
  }

  async function checkWebSearchCapability() {
    const statusNode = el('competitiveWebSearchStatus');
    if (statusNode) statusNode.textContent = 'Checking AI backend web-search capability...';

    try {
      let status;
      if (NS.AIProvider?.getStatus) status = await NS.AIProvider.getStatus();
      else {
        const headers = {};
        const token = clean(el('aiProxyToken')?.value);
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(aiStatusUrl(), { headers, cache: 'no-store' });
        status = await response.json().catch(() => ({}));
        if (!response.ok || status.ok === false) throw new Error(status?.error?.message || `AI status HTTP ${response.status}`);
      }

      const available = webSearchAvailableFromStatus(status);
      const provider = currentAiProvider();
      const model = currentAiModel();
      const message = available
        ? `Web search available for ${provider}${model ? ` / ${model}` : ''}.`
        : `Web search unavailable for ${provider}${model ? ` / ${model}` : ''}. Choose a web-search-capable backend/model.`;

      if (statusNode) {
        statusNode.textContent = message;
        statusNode.classList.toggle('ok', available);
        statusNode.classList.toggle('bad', !available);
      }

      return { ok: available, status, message };
    } catch (err) {
      const message = `Could not verify web search: ${err?.message || err}`;
      if (statusNode) {
        statusNode.textContent = message;
        statusNode.classList.remove('ok');
        statusNode.classList.add('bad');
      }
      return { ok: false, error: message };
    }
  }

  function buildPayload() {
    const active = activeSource();
    const competitors = parseCompetitorInputs();
    const modes = targetModes();
    const venue = clean(el('competitiveTargetVenue')?.value);
    const audience = clean(el('competitiveTargetAudience')?.value);
    const instructions = clean(el('competitiveExtraInstructions')?.value);

    return {
      schema: 'latexai-competitive-web-research-review-request-v1',
      workflow: 'competitive-web-review',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      activePath: active.path,
      rootPath: rootPath(),
      targetVenue: venue,
      targetAudience: audience,
      comparisonModes: modes.length ? modes : ['overall competitiveness'],
      competitorUrls: competitors.urls,
      competitorNotes: competitors.notes,
      competitorSummaries: lastCompetitorSummaries,
      competitorSourceLedger: lastSourceLedger,
      evidenceCoverage: lastEvidenceCoverage,
      competitorRankingReport: lastRankingReport,
      draftComparisonReport: lastComparisonReport,
      competitiveRoadmapReport: lastRoadmapReport,
      extraInstructions: instructions,
      requireWebSearch: requireWebSearch(),
      researchMode: 'web-search-agent-no-pdf-extraction',
      webSearchPolicy: {
        required: true,
        provider: currentAiProvider(),
        model: currentAiModel(),
        expectation: 'AI backend must use web search/open tools to research competitor URLs as source-discovery seeds; do not require PDF web research; every substantive ranking claim must be tied to source IDs from the source ledger.'
      },
      draftExcerpt: draftExcerpt(active.text)
    };
  }

  function validatePayload(payload) {
    const errors = [];
    if (!payload.draftExcerpt.trim()) errors.push('Active source file is empty.');
    if (!payload.competitorUrls.length && !payload.competitorNotes.trim()) {
      errors.push('Add at least one competitor URL or competitor note/abstract.');
    }
    return errors;
  }

  function normalizePaperSummary(paper, fallbackUrl = '') {
    const url = clean(paper?.url || paper?.sourceUrl || paper?.link || fallbackUrl);
    if (!url) return null;
    return {
      url,
      title: clean(paper?.title || paper?.name || ''),
      authors: Array.isArray(paper?.authors) ? paper.authors.map(clean).filter(Boolean) : clean(paper?.authors || ''),
      year: clean(paper?.year || paper?.date || ''),
      venue: clean(paper?.venue || paper?.conference || ''),
      abstract: clean(paper?.abstract || paper?.summary || ''),
      mainClaims: Array.isArray(paper?.mainClaims) ? paper.mainClaims.map(clean).filter(Boolean) : readLines(paper?.mainClaims || paper?.claims || ''),
      strengths: Array.isArray(paper?.strengths) ? paper.strengths.map(clean).filter(Boolean) : readLines(paper?.strengths || ''),
      limitations: Array.isArray(paper?.limitations) ? paper.limitations.map(clean).filter(Boolean) : readLines(paper?.limitations || paper?.weaknesses || ''),
      evidence: clean(paper?.evidence || paper?.webSearchEvidence || paper?.sourceEvidence || ''),
      sourceRecords: Array.isArray(paper?.sourceRecords || paper?.sources || paper?.sourcesConsulted) ? (paper.sourceRecords || paper.sources || paper.sourcesConsulted).map((src) => normalizeSourceRecord(src, url, clean(paper?.title || ''))).filter(Boolean) : readLines(paper?.sourceRecords || paper?.sourcesConsulted || paper?.sourceUrls || paper?.sources || '').map((src) => normalizeSourceRecord(src, url, clean(paper?.title || ''))).filter(Boolean),
      sourcesConsulted: Array.isArray(paper?.sourcesConsulted) ? paper.sourcesConsulted.map((src) => typeof src === 'string' ? clean(src) : clean(src?.url || src?.title || src?.evidence || '')).filter(Boolean) : readLines(paper?.sourcesConsulted || paper?.sourceUrls || paper?.sources || ''),
      accessed: paper?.accessed === true || paper?.webSearchAccessed === true || paper?.accessStatus === 'accessed',
      cached: Boolean(paper?.cached),
      cachedAt: paper?.cachedAt || ''
    };
  }

  function parsePaperSummariesFromAi(text, urls) {
    const wanted = uniqueLines(urls || []);
    for (const candidate of parseJsonCandidates(text)) {
      try {
        const data = JSON.parse(candidate);
        const list = Array.isArray(data) ? data
          : Array.isArray(data?.papers) ? data.papers
          : Array.isArray(data?.competitorPapers) ? data.competitorPapers
          : Array.isArray(data?.competitors) ? data.competitors
          : [];
        const papers = list.map((paper, i) => normalizePaperSummary(paper, wanted[i] || '')).filter(Boolean);
        if (papers.length) return papers;
      } catch (_err) {}
    }
    return wanted.map((url) => normalizePaperSummary({ url, evidence: 'No structured web-research JSON was returned; use the prose evidence in the report output.', accessed: false }, url)).filter(Boolean);
  }

  function summariesMarkdown(papers) {
    const list = papers && papers.length ? papers : lastCompetitorSummaries;
    if (!list?.length) return '(no competitor summaries available yet)';
    return list.map((paper, index) => {
      const claims = Array.isArray(paper.mainClaims) ? paper.mainClaims : readLines(paper.mainClaims || '');
      const strengths = Array.isArray(paper.strengths) ? paper.strengths : readLines(paper.strengths || '');
      return [
        `### Competitor ${index + 1}: ${paper.title || paper.url}`,
        `URL: ${paper.url}`,
        paper.authors ? `Authors: ${Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors}` : '',
        paper.venue || paper.year ? `Venue/year: ${[paper.venue, paper.year].filter(Boolean).join(', ')}` : '',
        paper.abstract ? `Abstract/summary: ${paper.abstract}` : '',
        claims.length ? `Main claims: ${claims.map((x) => `- ${x}`).join(' ')}` : '',
        strengths.length ? `Strengths: ${strengths.map((x) => `- ${x}`).join(' ')}` : '',
        paper.evidence ? `Evidence: ${paper.evidence}` : '',
        paper.sourcesConsulted?.length ? `Sources consulted: ${paper.sourcesConsulted.map((x) => `- ${x}`).join(' ')}` : '',
        paper.cached ? `Cache: reused from ${paper.cachedAt || 'local cache'}` : ''
      ].filter(Boolean).join('\n');
    }).join('\n\n');
  }

  function mergedSummariesFromCache(urls) {
    const out = [];
    const missing = [];
    for (const url of urls || []) {
      const cached = cachedPaperForUrl(url);
      if (cached) out.push(normalizePaperSummary(cached, url));
      else missing.push(url);
    }
    return { cached: out.filter(Boolean), missing };
  }

  async function askCompetitiveStep(stepName, instructions, input, routeKey = 'competitive-improvement', maxOutputTokens = 6000) {
    if (!NS.AIProvider?.ask) throw new Error('AIProvider missing');
    const provider = currentAiProvider();
    const model = currentAiModel();
    const modelDecision = NS.AIProvider?.validateRequestModel?.(
      provider,
      model,
      { workflow: stepName },
      { task: 'latex-competitive-paper-review', routeKey, context: { workflow: stepName } }
    );
    if (modelDecision?.repaired) setStatus(`Competitive review model repaired: ${modelDecision.reason}`);
    const memoryContext = await loadCompetitiveMemoryContext(stepName, 10, `${instructions}\n${input}`);
    const memoryBlock = memoryContextMarkdown(memoryContext);
    const response = await NS.AIProvider.ask({
      workflow: stepName,
      instructions: memoryBlock ? `${instructions}\n\n${memoryBlock}` : instructions,
      input: memoryBlock ? `${memoryBlock}\n\n${input}` : input,
      temperature: 0.2,
      maxOutputTokens,
      webSearchRequired: true,
      requireWebSearch: true,
      requiredTools: ['web_search'],
      competitiveReview: {
        step: stepName,
        requireWebSearch: true,
        webSearchEvidenceRequired: true
      }
    }, {
      task: 'latex-competitive-paper-review',
      routeKey,
      context: { workflow: stepName, requireWebSearch: true }
    });
    const text = NS.AIProvider.extractText ? NS.AIProvider.extractText(response) : String(response || '');
    await markMemoryUse(stepName, text && text.trim() ? 'success' : 'used', text && text.trim() ? 'AI step completed with memory context.' : 'AI step returned empty text.');
    return text;
  }

  async function ensureWebSearchReadyForWorkflow() {
    if (!requireWebSearch()) return { ok: true };
    const capability = await checkWebSearchCapability();
    if (!capability.ok) {
      const message = capability.message || capability.error || 'Choose a web-search-capable AI backend/model.';
      setStatus(message);
      setOutput([
        'Competitive review requires web search.',
        '',
        message,
        '',
        'Use an AI backend that reports webSearch.available=true from /api/lumina/ai/status.'
      ].join('\n'));
      return { ok: false, message, capability };
    }
    return { ok: true, capability };
  }

  async function researchCompetitorPapers() {
    const payload = buildPayload();
    const errors = [];
    if (!payload.competitorUrls.length) errors.push('Add at least one competitor URL to research.');
    if (errors.length) { setStatus(errors.join(' ')); setOutput(errors.join('\n')); return { ok: false, errors }; }
    const ready = await ensureWebSearchReadyForWorkflow();
    if (!ready.ok) return ready;

    updateWorkflowStatus('fetch', 'researching competitor papers with web search...');
    setStatus('Researching competitor papers with the AI web-search agent...');

    const { cached, missing } = mergedSummariesFromCache(payload.competitorUrls);
    if (!missing.length) {
      lastCompetitorSummaries = cached;
      refreshEvidenceState(cached);
      const report = ['# Competitor web research', '', 'All competitor research profiles were loaded from local cache.', '', summariesMarkdown(cached)].join('\n');
      setOutput(report);
      setStatus(`Loaded ${cached.length} competitor research profile(s) from cache.`);
      updateWorkflowStatus('fetch', `${cached.length} cached research profile(s) ready.`);
      return { ok: true, papers: cached, cached: true, report };
    }

    const instructions = [
      'Use web search/open tools to research each competitor URL as a seed and build concise paper metadata/profiles.',
      'Return a short Markdown web-research evidence report with sources consulted.',
      'Also include exactly one fenced code block labelled latexai_competitor_research_profiles containing JSON:',
      '{"papers":[{"url":"...","title":"...","authors":["..."],"year":"...","venue":"...","abstract":"...","mainClaims":["..."],"strengths":["..."],"limitations":["..."],"sourceRecords":[{"url":"...","title":"...","kind":"arxiv/openreview/project/semantic-scholar/other","evidence":"short snippet or fact supported by this source"}],"sourcesConsulted":["source URL/title consulted"],"evidence":"what web source/snippet supported this","accessed":true}]}',
      'If a URL or its related public sources cannot be accessed, include it with accessed=false and explain what evidence is missing.'
    ].join('\n');
    const input = [
      '--- Competitor URL seeds to research ---',
      missing.map((url, i) => `${i + 1}. ${url}`).join('\n'),
      '',
      payload.competitorNotes ? `--- User-provided notes/abstracts ---\n${payload.competitorNotes}` : '',
      '',
      'Use web search/opening tools where available. Treat URLs as seeds for source discovery; do not claim PDF/full-paper access unless the web evidence supports it.'
    ].filter(Boolean).join('\n');

    try {
      const raw = (await askCompetitiveStep('competitive-web-research', instructions, input, 'competitive-ranking', 5000)).trim();
      const researched = parsePaperSummariesFromAi(raw, missing);
      const merged = [...cached, ...researched];
      lastCompetitorSummaries = merged;
      refreshEvidenceState(merged);
      savePaperSummariesToCache(researched);
      const report = [raw || '# Competitor web research', '', '--- Latexai parsed competitor research profiles ---', summariesMarkdown(merged)].join('\n');
      setOutput(report);
      setStatus(`Researched ${researched.length} competitor research profile(s); ${cached.length} reused from cache.`);
      updateWorkflowStatus('fetch', `${merged.length} competitor research profile(s) ready.`);
      return { ok: true, papers: merged, report, cached: false };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Competitor web research failed: ${message}`);
      setOutput(`Competitor web research failed:\n\n${message}`);
      return { ok: false, error: message };
    }
  }

  async function rankCompetitorPapers() {
    const payload = buildPayload();
    if (!lastCompetitorSummaries.length) {
      const fetched = await researchCompetitorPapers();
      if (!fetched.ok) return fetched;
    }
    updateWorkflowStatus('rank', 'ranking competitor set...');
    setStatus('Ranking competitor paper set...');
    const instructions = [
      'Rank the competitor papers against each other before considering the user draft.',
      'Use the web-researched evidence, target venue, target audience, comparison modes, and the numbered source ledger.',
      'Return a Markdown ranking table with #, title, URL, main strength, weakness/risk, evidence/source IDs, and why it is above/below the next paper.',
      'Every substantive claim in the ranking rationale must cite one or more source IDs like [S1] from the source ledger. If evidence is seed-only or weak, say so.',
      'End with a concise JSON block labelled latexai_competitor_ranking with {"ranking":[{"rank":1,"url":"...","title":"...","sourceIds":["S1"],"rationale":"..."}]}.'
    ].join('\n');
    const input = [
      '--- Target venue/audience ---',
      `Venue: ${payload.targetVenue || '(not specified)'}`,
      `Audience: ${payload.targetAudience || '(not specified)'}`,
      `Modes: ${payload.comparisonModes.join(', ')}`,
      '',
      '--- Competitor paper summaries ---',
      summariesMarkdown(lastCompetitorSummaries),
      '',
      '--- Numbered source ledger; cite these IDs in the ranking ---',
      sourcesMarkdown(lastSourceLedger),
      '',
      '--- Evidence coverage summary ---',
      evidenceCoverageMarkdown(lastEvidenceCoverage),
      '',
      payload.competitorNotes ? `--- User notes ---\n${payload.competitorNotes}` : ''
    ].filter(Boolean).join('\n');
    try {
      lastRankingReport = (await askCompetitiveStep('competitive-competitor-ranking', instructions, input, 'competitive-ranking', 5000)).trim();
      lastReport = lastRankingReport;
      await saveCompetitiveMemory('competitor_ranking', lastRankingReport, payload, { sourceLedgerCount: lastSourceLedger.length });
      renderRankingPreview();
      setOutput(lastRankingReport || '(AI returned empty competitor ranking.)');
      setStatus(lastRankingReport ? 'Competitor ranking complete.' : 'Competitor ranking returned an empty report.');
      updateWorkflowStatus('rank', lastRankingReport ? 'ranking ready.' : 'ranking empty.');
      return { ok: Boolean(lastRankingReport), report: lastRankingReport, papers: lastCompetitorSummaries };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Competitor ranking failed: ${message}`);
      setOutput(`Competitor ranking failed:\n\n${message}`);
      return { ok: false, error: message };
    }
  }

  async function compareDraftAgainstRankedSet() {
    const payload = buildPayload();
    const errors = validatePayload(payload);
    if (errors.length) { setStatus(errors.join(' ')); setOutput(errors.join('\n')); return { ok: false, errors }; }
    if (!lastRankingReport) {
      const ranked = await rankCompetitorPapers();
      if (!ranked.ok) return ranked;
    }
    updateWorkflowStatus('compare', 'comparing draft against ranked set...');
    setStatus('Comparing current draft against ranked competitor set...');
    const instructions = [
      'Compare the current draft against the already-ranked competitor set.',
      'Estimate the current draft position relative to the competitor papers.',
      'For each competitor, list exactly what the current draft does worse, what it does better, and what must change to move up.',
      'Cite source IDs like [S1] for claims about competitor papers and explicitly mark weak/uncited evidence.',
      'Return Markdown only; do not produce actionable edit JSON in this step.'
    ].join('\n');
    const input = [
      '--- Competitor ranking report ---',
      lastRankingReport,
      '',
      '--- Competitor summaries ---',
      summariesMarkdown(lastCompetitorSummaries),
      '',
      '--- Source ledger for competitor claims ---',
      sourcesMarkdown(lastSourceLedger),
      '',
      '--- Evidence coverage summary ---',
      evidenceCoverageMarkdown(lastEvidenceCoverage),
      '',
      '--- Current draft excerpt ---',
      payload.draftExcerpt,
      '',
      payload.extraInstructions ? `--- User extra instructions ---\n${payload.extraInstructions}` : ''
    ].filter(Boolean).join('\n');
    try {
      lastComparisonReport = (await askCompetitiveStep('competitive-draft-comparison', instructions, input, 'competitive-improvement', 6000)).trim();
      lastReport = lastComparisonReport;
      await saveCompetitiveMemory('draft_comparison', lastComparisonReport, payload, { sourceLedgerCount: lastSourceLedger.length });
      setOutput(lastComparisonReport || '(AI returned empty draft comparison.)');
      setStatus(lastComparisonReport ? 'Draft comparison complete.' : 'Draft comparison returned an empty report.');
      updateWorkflowStatus('compare', lastComparisonReport ? 'comparison ready.' : 'comparison empty.');
      return { ok: Boolean(lastComparisonReport), report: lastComparisonReport };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Draft comparison failed: ${message}`);
      setOutput(`Draft comparison failed:\n\n${message}`);
      return { ok: false, error: message };
    }
  }

  async function generateImprovementRoadmap() {
    updateWorkflowStatus('roadmap', 'generating improvement roadmap and actionable edits...');
    const result = await runCompetitiveReview({ useExistingRoadmapContext: true });
    if (result?.ok) {
      lastRoadmapReport = result.report || lastReport;
      updateWorkflowStatus('roadmap', 'roadmap ready; insert or save report next.');
    }
    return result;
  }

  async function runCompetitiveReview(options = {}) {
    if (!NS.AIProvider?.ask) {
      setStatus('AIProvider is not loaded. Check feature flags and safe mode.');
      return { ok: false, error: 'AIProvider missing' };
    }

    const payload = buildPayload();
    const errors = validatePayload(payload);
    if (errors.length) {
      setStatus(errors.join(' '));
      setOutput(`Cannot run competitive review:\n\n${errors.map((e) => `- ${e}`).join('\n')}`);
      return { ok: false, errors };
    }

    if (requireWebSearch()) {
      const capability = await checkWebSearchCapability();
      if (!capability.ok) {
        const message = capability.message || capability.error || 'Choose a web-search-capable AI backend/model.';
        setStatus(message);
        setOutput([
          'Competitive review requires web search.',
          '',
          message,
          '',
          'Use an AI backend that reports webSearch.available=true from /api/lumina/ai/status.'
        ].join('\n'));
        return { ok: false, error: message, capability, payload };
      }
    }

    lastPayload = payload;
    setStatus('Running competitive paper review...');

    const prompt = await loadPrompt();
    const input = [
      prompt,
      '',
      '--- Request JSON ---',
      JSON.stringify(payload, null, 2),
      '',
      '--- Source-citation requirement ---',
      'For competitor claims and rankings, cite source IDs from this source ledger whenever available:',
      sourcesMarkdown(lastSourceLedger),
      '',
      '--- Evidence coverage summary ---',
      evidenceCoverageMarkdown(lastEvidenceCoverage),
      '',
      '--- Important limitation ---',
      'Use web search/open tools for competitor URLs whenever available. Treat URLs as source-discovery seeds. Do not use or request Latexai PDF extraction, and do not claim full-paper/PDF access unless the searched evidence supports it. Ranking claims must be evidence-cited; mark weak evidence explicitly.'
    ].join('\n');

    try {
      const modelDecision = NS.AIProvider?.validateRequestModel?.(
        currentAiProvider(),
        currentAiModel(),
        { workflow: 'competitive-web-review-improvement' },
        { task: 'latex-competitive-paper-review', routeKey: 'competitive-improvement', context: { workflow: 'competitive-web-review', requireWebSearch: true } }
      );
      if (modelDecision?.repaired) setStatus(`Competitive review model repaired: ${modelDecision.reason}`);

      const memoryContext = await loadCompetitiveMemoryContext('competitive-web-review-improvement', 12, `${urls.join(' ')}\n${sourceText.slice(0, 8000)}`);
      const memoryBlock = memoryContextMarkdown(memoryContext);
      const response = await NS.AIProvider.ask({
        workflow: 'competitive-web-review-improvement',
        instructions: [
          memoryBlock,
          'Return a structured Markdown competitive review report. Be critical, concrete, source-cited, and action-oriented.',
          'Include an Evidence-cited ranking table with source IDs, an evidence coverage summary, and a sources consulted ledger.',
          'Every substantive competitor claim must cite source IDs like [S1] when source evidence is available; if not, mark it as weak/uncited.',
          'In addition to the prose report, include one fenced code block labelled latexai_actionable_edits.',
          'That block must be JSON with schema {\"actionableEdits\":[{\"mode\":\"replace|insert_after|insert_before\",\"path\":\"optional tex path\",\"targetHint\":\"section or paragraph hint\",\"oldText\":\"exact source substring for replace/anchor\",\"newText\":\"LaTeX replacement or insertion\",\"confidence\":0.0,\"rankingEffect\":{\"competitors\":[\"#1 Paper A\"],\"gap\":\"which competitor weakness this edit addresses\",\"sourceIds\":[\"S1\"],\"before\":\"draft estimated #4 of 5\",\"after\":\"likely #3 of 5 after this edit\",\"expectedImpact\":\"one-sentence ranking movement rationale\",\"insertionMode\":\"inline \\laiold/\\lai or append \\lai plan\"}}],\"appendPlan\":\"optional high-level LaTeX plan\"}.',
          'For every edit, include a rankingEffect object with competitors, gap, sourceIds, before, after, expectedImpact, and insertionMode. This is used to render the Latexai Edit impact map. For replace edits, oldText must be copied exactly from the draft excerpt when possible so Latexai can insert \\laiold{oldText} and \\lai{newText} at the right location.',
          'newText must be a compile-safe LaTeX body fragment: no Markdown fences, no preamble commands, no \\begin{document}/\\end{document}, balanced braces/environments, and text-mode special characters escaped.',
          'Do not target the document preamble; if a suggestion cannot be localized in the document body safely, put it in appendPlan rather than inventing an oldText.'
        ].filter(Boolean).join('\n'),
        input: memoryBlock ? `${memoryBlock}\n\n${input}` : input,
        temperature: 0.2,
        maxOutputTokens: 7000,
        webSearchRequired: true,
        requireWebSearch: true,
        requiredTools: ['web_search'],
        competitiveReview: {
          targetVenue: payload.targetVenue,
          comparisonModes: payload.comparisonModes,
          competitorUrlCount: payload.competitorUrls.length,
          requireWebSearch: true,
          webSearchEvidenceRequired: true
        }
      }, {
        task: 'latex-competitive-paper-review',
        routeKey: 'competitive-improvement',
        context: {
          workflow: 'competitive-web-review',
          requireWebSearch: true,
          promptFile: PROMPT_PATH,
          targetVenue: payload.targetVenue,
          comparisonModes: payload.comparisonModes,
          requireWebSearch: true
        }
      });

      const raw = NS.AIProvider.extractText ? NS.AIProvider.extractText(response) : String(response || '');
      lastReport = raw.trim();
      await markMemoryUse('competitive-web-review-improvement', lastReport ? 'success' : 'used', lastReport ? 'Competitive review completed with memory context.' : 'Competitive review returned empty report.');
      await saveCompetitiveMemory('final_review', lastReport, payload, { sourceLedgerCount: lastSourceLedger.length, hasActionableEdits: /latexai_actionable_edits/i.test(lastReport) });
      buildEditImpactMap(lastReport);
      renderEditImpactMap();
      setOutput(lastReport || '(AI returned empty report.)');
      setStatus(lastReport ? 'Competitive review complete.' : 'Competitive review returned an empty report.');
      return { ok: Boolean(lastReport), report: lastReport, payload };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Competitive review failed: ${message}`);
      setOutput(`Competitive review failed:\n\n${message}`);
      return { ok: false, error: message, payload };
    }
  }

  function reportFilename() {
    const date = new Date().toISOString().slice(0, 10);
    const venue = clean(el('competitiveTargetVenue')?.value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const suffix = venue ? `-${venue}` : '';
    return normalizePath(`reviews/competitive-review-${date}${suffix}.md`);
  }

  function addReportToProject() {
    if (!lastReport) {
      setStatus('Run competitive review first.');
      return { ok: false, error: 'No report' };
    }

    const payload = lastPayload || buildPayload();
    const content = [
      '# Competitive paper review',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Stage: ${STAGE}`,
      `Target venue: ${payload.targetVenue || '(not specified)'}`,
      `Target audience: ${payload.targetAudience || '(not specified)'}`,
      `Comparison modes: ${payload.comparisonModes.join(', ')}`,
      '',
      '## Competitor URLs',
      '',
      ...(payload.competitorUrls.length ? payload.competitorUrls.map((url) => `- ${url}`) : ['- (none provided)']),
      '',
      '## Competitor web research profiles',
      '',
      summariesMarkdown(payload.competitorSummaries || lastCompetitorSummaries),
      '',
      '## Source evidence ledger',
      '',
      sourcesMarkdown(payload.competitorSourceLedger || lastSourceLedger),
      '',
      '## Evidence coverage',
      '',
      evidenceCoverageMarkdown(payload.evidenceCoverage || lastEvidenceCoverage),
      '',
      '## Competitor ranking prepass',
      '',
      payload.competitorRankingReport || lastRankingReport || '(not run separately)',
      '',
      '## Draft comparison prepass',
      '',
      payload.draftComparisonReport || lastComparisonReport || '(not run separately)',
      '',
      '## Edit impact map',
      '',
      editImpactMarkdown(buildEditImpactMap(lastReport)),
      '',
      '## Report',
      '',
      lastReport,
      ''
    ].join('\n');

    const path = writeProjectFile(reportFilename(), content);
    saveCompetitiveMemory('saved_report', content, payload, { savedPath: path });
    setStatus(`Added competitive review to ${path}.`);
    return { ok: true, path };
  }

  function updateProjectSource(path, text) {
    const normalized = normalizePath(path);
    try {
      if (State()?.updateFile) State().updateFile(normalized, text);
      else {
        const file = getFile(normalized);
        if (file) file.text = text;
        else writeProjectFile(normalized, text);
      }
    } catch (_err) {
      const file = getFile(normalized);
      if (file) file.text = text;
      else writeProjectFile(normalized, text);
    }

    if (normalizePath(activePath()) === normalized && el('sourceEditor')) {
      el('sourceEditor').value = text;
      try { el('sourceEditor').dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    }

    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}
  }

  function ensurePackageInPreamble(tex, packageName) {
    const s = String(tex || '');
    const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pkgRe = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{[^}]*\\b${escaped}\\b[^}]*\\}`);
    if (pkgRe.test(s)) return s;
    const line = `\\usepackage{${packageName}}\n`;
    const docIdx = s.indexOf('\\begin{document}');
    if (docIdx >= 0) return s.slice(0, docIdx) + line + s.slice(docIdx);
    const classMatch = s.match(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}\s*/);
    if (classMatch?.index !== undefined) {
      const at = classMatch.index + classMatch[0].length;
      return s.slice(0, at) + '\n' + line + s.slice(at);
    }
    return line + s;
  }

  function hasLaiMacro(tex) {
    const s = String(tex || '');
    return /\\newif\\iflaishowchanges/.test(s) && /\\(?:long\\def|def|newcommand)\s*\\lai\b/.test(s);
  }

  function ensureLaiMacroLocal(rootText) {
    let s = String(rootText || '');
    if (hasLaiMacro(s)) return s;
    s = ensurePackageInPreamble(s, 'xcolor');
    const macro = [
      '% --- Latexai AI-change highlighting macro ---',
      '% Set this to \\laishowchangesfalse to hide red AI markup.',
      '\\newif\\iflaishowchanges',
      '\\laishowchangestrue',
      '\\long\\def\\lai#1{%',
      '  \\iflaishowchanges',
      '    {\\color{red}#1}%',
      '  \\else',
      '    #1%',
      '  \\fi',
      '}',
      '% --- end Latexai AI-change highlighting macro ---',
      ''
    ].join('\n');
    const docIdx = s.indexOf('\\begin{document}');
    if (docIdx >= 0) return s.slice(0, docIdx) + macro + '\n' + s.slice(docIdx);
    return macro + '\n' + s;
  }

  function ensureLaiOldMacro(rootText) {
    let s = String(rootText || '');
    s = ensurePackageInPreamble(s, 'xcolor');
    if (/\\(?:long\s*)?\\?def\s*\\laiold\b|\\newcommand\s*\{\\laiold\}|\\providecommand\s*\{\\laiold\}/.test(s)) return s;
    const macro = [
      '',
      '% --- Latexai old-content highlighting macro ---',
      '% Old source preserved by actionable AI edits.',
      '\\long\\def\\laiold#1{{\\color{blue}#1}}',
      '% --- end Latexai old-content highlighting macro ---',
      ''
    ].join('\n');
    const laiIdx = s.search(/% --- Latexai AI-change highlighting macro ---|\\long\\def\\lai#1|\\newcommand\s*\{\\lai\}/);
    if (laiIdx >= 0) return s.slice(0, laiIdx) + macro + s.slice(laiIdx);
    const docIdx = s.indexOf('\\begin{document}');
    if (docIdx >= 0) return s.slice(0, docIdx) + macro + s.slice(docIdx);
    return macro + s;
  }

  function ensureRootLaiMacros() {
    const root = getFile(rootPath());
    if (!root) return false;
    let text = fileText(root);
    let next = NS.ProjectModel?.ensureLaiMacro ? NS.ProjectModel.ensureLaiMacro(text) : text;
    next = ensureLaiMacroLocal(next);
    next = ensureLaiOldMacro(next);
    if (next !== text) updateProjectSource(rootPath(), next);
    return true;
  }

  function insertBeforeEndDocument(tex, insertion) {
    const s = String(tex || '');
    const marker = '\\end{document}';
    const at = s.lastIndexOf(marker);
    const block = `\n\n${String(insertion || '').trim()}\n\n`;
    if (at >= 0) return s.slice(0, at).replace(/\s*$/, '') + block + s.slice(at);
    return s.replace(/\s*$/, '') + block;
  }


  function refreshPaperAiReview(paths, source = 'Competitive Review') {
    const normalized = [...new Set((paths || []).map(normalizePath).filter(Boolean))];
    try {
      if (NS.PaperAiPolishService?.scanProject) {
        return NS.PaperAiPolishService.scanProject({ paths: normalized });
      }
      if (normalized[0] && NS.PaperAiPolishService?.scanPath) {
        return NS.PaperAiPolishService.scanPath(normalized[0], { open: false });
      }
      if (NS.PaperAiPolishService?.scan) return NS.PaperAiPolishService.scan();
    } catch (err) {
      try { console.warn('[Latexai] could not refresh paper AI review after competitive insertion', err); } catch (_err) {}
    }
    return null;
  }

  function workflowBlockHeader(id, path, extra = '') {
    return `% BEGIN LAI-ACTIONABLE-EDIT id=${safeMetaValue(id)} workflow=competitive-review path=${safeMetaValue(path)}${extra ? ` ${latexCommentText(extra, 120)}` : ''}`;
  }

  function workflowBlockFooter(id) {
    return `% END LAI-ACTIONABLE-EDIT id=${id}`;
  }

  function wrapLaiPlanBlock(laiBlock, path) {
    const id = `lai-competitive-plan-${Date.now().toString(36)}`;
    return [workflowBlockHeader(id, normalizePath(path), 'mode=append-plan'), '% LAI target: end-of-paper competitive improvement plan', String(laiBlock || '').trim(), workflowBlockFooter(id)].join('\n');
  }

  function escapeLatexText(value) {
    return String(value || '')
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/([#$%&_{}])/g, '\\$1')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }

  function markdownToLaiPlan(markdown, title, maxLines = 140) {
    const lines = String(markdown || '').split(/\r?\n/).slice(0, maxLines);
    const out = ['\\lai{', `\\section*{${escapeLatexText(title)}}`];
    let inItems = false;
    const closeItems = () => { if (inItems) { out.push('\\end{itemize}'); inItems = false; } };
    for (const raw of lines) {
      const line = String(raw || '').trim();
      if (!line) { closeItems(); out.push(''); continue; }
      const heading = line.match(/^#{1,4}\s+(.+)$/);
      if (heading) { closeItems(); out.push(`\\paragraph{${escapeLatexText(heading[1]).replace(/\.$/, '')}.}`); continue; }
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        if (!inItems) { out.push('\\begin{itemize}'); inItems = true; }
        out.push(`\\item ${escapeLatexText(bullet[1])}`);
        continue;
      }
      closeItems();
      out.push(`${escapeLatexText(line)}\\par`);
    }
    closeItems();
    out.push('}');
    return out.join('\n');
  }


  function isEscapedAt(text, index) {
    let n = 0;
    for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) n += 1;
    return n % 2 === 1;
  }

  function stripLatexCommentsForBalance(value) {
    return String(value || '').split(/\r?\n/).map((line) => {
      for (let i = 0; i < line.length; i += 1) {
        if (line[i] === '%' && !isEscapedAt(line, i)) return line.slice(0, i);
      }
      return line;
    }).join('\n');
  }

  function latexCommentText(value, max = 220) {
    return String(value || '')
      .replace(/\r?\n+/g, ' ')
      .replace(/%/g, ' percent ')
      .replace(/[{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  function safeMetaValue(value) {
    return encodeURIComponent(String(value || '').replace(/\s+/g, '_')).slice(0, 220);
  }

  function bracesAreBalanced(value) {
    const s = stripLatexCommentsForBalance(value);
    let depth = 0;
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      if ((ch === '{' || ch === '}') && isEscapedAt(s, i)) continue;
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth < 0) return false;
      }
    }
    return depth === 0;
  }

  function environmentBalanceIssue(value) {
    const s = stripLatexCommentsForBalance(value);
    const stack = [];
    const re = /\\(begin|end)\s*\{([^}]+)\}/g;
    let match;
    while ((match = re.exec(s))) {
      const kind = match[1];
      const env = String(match[2] || '').trim();
      if (!env || env === 'document') continue;
      if (kind === 'begin') stack.push(env);
      else {
        const top = stack.pop();
        if (top !== env) return `environment mismatch: expected ${top || 'none'}, saw ${env}`;
      }
    }
    if (stack.length) return `unclosed environment: ${stack[stack.length - 1]}`;
    return '';
  }

  function unwrapSingleMacroArgument(text, macroName) {
    const s = String(text || '').trim();
    const prefix = `\\${macroName}`;
    if (!s.startsWith(prefix)) return null;
    let i = prefix.length;
    while (/\s/.test(s[i] || '')) i += 1;
    if (s[i] !== '{') return null;
    let depth = 0;
    for (let j = i; j < s.length; j += 1) {
      const ch = s[j];
      if ((ch === '{' || ch === '}') && isEscapedAt(s, j)) continue;
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const tail = s.slice(j + 1).trim();
          if (!tail) return s.slice(i + 1, j);
          return null;
        }
      }
    }
    return null;
  }

  function stripActionableWrappers(value) {
    let s = String(value || '').trim();
    const fence = s.match(/^```(?:latex|tex|latexai_actionable_edits)?\s*([\s\S]*?)\s*```$/i);
    if (fence) s = fence[1].trim();
    const asLai = unwrapSingleMacroArgument(s, 'lai');
    if (asLai !== null) s = asLai.trim();
    return s;
  }

  function escapeRiskyTextModeSpecials(value) {
    const s = String(value || '');
    const hasAlignmentEnv = /\\begin\s*\{(?:tabular\*?|array|align\*?|aligned|cases|matrix|pmatrix|bmatrix|smallmatrix)\}/.test(s);
    let out = '';
    let math = false;
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      const next = s[i + 1] || '';
      if (ch === '\\' && (next === '(' || next === '[')) { math = true; out += ch + next; i += 1; continue; }
      if (ch === '\\' && (next === ')' || next === ']')) { math = false; out += ch + next; i += 1; continue; }
      if (ch === '$' && !isEscapedAt(s, i)) { math = !math; out += ch; continue; }
      if (!math && !isEscapedAt(s, i)) {
        if (ch === '%') { out += '\\%'; continue; }
        if (ch === '_') { out += '\\_'; continue; }
        if (ch === '#') { out += '\\#'; continue; }
        if (ch === '&' && !hasAlignmentEnv) { out += '\\&'; continue; }
        if (ch === '^') { out += '\\textasciicircum{}'; continue; }
      }
      out += ch;
    }
    return out;
  }

  function validateMacroArgument(value, label) {
    const s = String(value || '');
    if (/\\verb\b|\\begin\s*\{verbatim\}|\\end\s*\{verbatim\}/.test(s)) {
      return `${label} contains verbatim/\\verb, which is unsafe inside \\lai`;
    }
    if (!bracesAreBalanced(s)) return `${label} has unbalanced braces`;
    const envIssue = environmentBalanceIssue(s);
    if (envIssue) return `${label} has ${envIssue}`;
    return '';
  }

  function prepareActionableNewLatex(value) {
    let s = stripActionableWrappers(value);
    s = s.replace(/\r\n?/g, '\n').trim();
    if (!s) return { ok: false, reason: 'empty newText', text: '' };
    if (/```/.test(s)) return { ok: false, reason: 'newText still contains Markdown code fences', text: '' };
    if (/\\(?:documentclass|usepackage)\b|\\begin\s*\{document\}|\\end\s*\{document\}/.test(s)) {
      return { ok: false, reason: 'newText contains document-level LaTeX commands', text: '' };
    }
    s = escapeRiskyTextModeSpecials(s);
    const issue = validateMacroArgument(s, 'newText');
    if (issue) return { ok: false, reason: issue, text: '' };
    return { ok: true, reason: '', text: s };
  }

  function unsafeInsertionLocationReason(sourceText, at) {
    const s = String(sourceText || '');
    const beginDoc = s.indexOf('\\begin{document}');
    if (beginDoc >= 0 && at >= 0 && at < beginDoc) return 'match is in the preamble; visible \\lai edits are only inserted in document body';
    const begin = s.lastIndexOf('% BEGIN LAI-ACTIONABLE-EDIT', at);
    const end = s.lastIndexOf('% END LAI-ACTIONABLE-EDIT', at);
    if (begin > end) return 'match is already inside an existing Latexai actionable edit block';
    return '';
  }

  function parseJsonCandidates(text) {
    const s = String(text || '');
    const candidates = [];
    const fenceRe = /```(?:json|latexai_actionable_edits|latexai_competitor_research_profiles|latexai_competitor_ranking)?\s*([\s\S]*?)```/gi;
    let match;
    while ((match = fenceRe.exec(s))) candidates.push(match[1].trim());
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) candidates.push(s.slice(first, last + 1));
    return candidates;
  }

  function normalizeActionableEdit(edit, index) {
    const modeRaw = clean(edit?.mode || edit?.operation || edit?.type || (edit?.oldText ? 'replace' : 'insert_after')).toLowerCase();
    const mode = /insert[_ -]?before/.test(modeRaw) ? 'insert_before' : /insert[_ -]?after|append/.test(modeRaw) ? 'insert_after' : 'replace';
    const oldText = String(edit?.oldText ?? edit?.old ?? edit?.before ?? edit?.sourceText ?? edit?.anchorText ?? edit?.insertAfter ?? '');
    const newText = String(edit?.newText ?? edit?.new ?? edit?.after ?? edit?.replacement ?? edit?.text ?? edit?.lai ?? '');
    const path = normalizePath(edit?.path || edit?.file || edit?.texPath || activePath());
    const targetHint = String(edit?.targetHint || edit?.location || edit?.section || edit?.reason || `actionable edit ${index + 1}`);
    const confidence = Number(edit?.confidence);
    if (!newText.trim()) return null;
    if (mode === 'replace' && !oldText.trim()) return null;
    if (mode !== 'replace' && !oldText.trim()) return null;
    const rankingEffect = normalizeRankingEffect(edit?.rankingEffect || edit?.rankImpact || edit?.impact || edit?.expectedRankingEffect || '', edit || {}, index);
    const sourceIds = Array.from(new Set([...(rankingEffect.sourceIds || []), ...sourceIdsFromAny(edit?.sourceIds || edit?.evidence || edit?.evidenceIds || '')]));
    const title = String(edit?.title || edit?.label || '');
    return { mode, path, oldText, newText, targetHint, confidence: Number.isFinite(confidence) ? confidence : null, rankingEffect, sourceIds, title }; 
  }

  function extractActionableEdits(text) {
    for (const candidate of parseJsonCandidates(text)) {
      try {
        const data = JSON.parse(candidate);
        const list = Array.isArray(data) ? data : Array.isArray(data?.actionableEdits) ? data.actionableEdits : Array.isArray(data?.edits) ? data.edits : [];
        const edits = list.map(normalizeActionableEdit).filter(Boolean);
        if (edits.length) return { source: 'latexai_actionable_edits_json', edits, appendPlan: String(data?.appendPlan || '') };
      } catch (_err) {}
    }

    const pairs = [];
    const re = /\\laiold\s*\{([\s\S]*?)\}\s*\\lai\s*\{([\s\S]*?)\}/g;
    let match;
    while ((match = re.exec(String(text || '')))) {
      const edit = normalizeActionableEdit({ mode: 'replace', oldText: match[1], newText: match[2], targetHint: 'AI-provided \\laiold/\\lai pair' }, pairs.length);
      if (edit) pairs.push(edit);
    }
    return { source: pairs.length ? 'laiold_lai_pairs' : 'none', edits: pairs, appendPlan: '' };
  }

  function wrapActionableReplacement(edit, index) {
    const id = `lai-competitive-${Date.now().toString(36)}-${index}`;
    const oldText = String(edit.oldText || '').trim();
    const oldIssue = edit.mode === 'replace' ? validateMacroArgument(oldText, 'oldText') : '';
    if (oldIssue) return { ok: false, reason: oldIssue, text: '' };
    const prepared = prepareActionableNewLatex(edit.newText || '');
    if (!prepared.ok) return prepared;
    const header = workflowBlockHeader(id, edit.path, `mode=${edit.mode}`);
    const hint = edit.targetHint ? `% LAI target: ${latexCommentText(edit.targetHint)}` : '';
    const impact = edit.rankingEffect?.expectedImpact || edit.rankingEffect?.gap || '';
    const impactLine = impact ? `% LAI ranking impact: ${latexCommentText(impact)}` : '';
    const evidenceLine = edit.sourceIds?.length ? `% LAI evidence: ${latexCommentText(edit.sourceIds.join(', '))}` : '';
    const footer = workflowBlockFooter(id);
    if (edit.mode === 'replace') {
      return { ok: true, reason: '', text: [header, hint, impactLine, evidenceLine, '\\laiold{', oldText, '}', '\\lai{', prepared.text, '}', footer].filter(Boolean).join('\n') };
    }
    return { ok: true, reason: '', text: [header, hint, impactLine, evidenceLine, '\\lai{', prepared.text, '}', footer].filter(Boolean).join('\n') };
  }

  async function insertActionableEditsAtMatches() {
    if (!lastReport) {
      setStatus('Run competitive review first.');
      return { ok: false, error: 'No report' };
    }

    const memoryContext = await loadCompetitiveMemoryContext('competitive-lai-insert', 12, lastReport.slice(0, 8000));
    ensureRootLaiMacros();
    const parsed = extractActionableEdits(lastReport);
    if (!parsed.edits.length) {
      setStatus('No exact actionable edit JSON or \\laiold/\\lai pairs found. Use Append \\lai plan instead.');
      const result = { ok: false, applied: 0, skipped: 0, source: parsed.source };
      await markMemoryUse('competitive-lai-insert', 'failure', 'No exact actionable edit JSON or laiold/lai pairs found for insertion.');
      await savePaperEditMemory('competitive-lai-insert', result, { reason: 'no_actionable_edits' });
      return result;
    }

    const queued = new Map();
    const messages = [];
    let skipped = 0;

    parsed.edits.forEach((edit, index) => {
      const path = normalizePath(edit.path || activePath());
      const file = getFile(path);
      if (!file) { skipped += 1; messages.push(`SKIP ${path}: file not found for ${edit.targetHint}.`); return; }
      const text = fileText(file);
      const anchor = String(edit.oldText || '');
      const at = text.indexOf(anchor);
      if (at < 0) { skipped += 1; messages.push(`SKIP ${path}: exact oldText/anchor not found for ${edit.targetHint}.`); return; }
      const locationIssue = unsafeInsertionLocationReason(text, at);
      if (locationIssue) { skipped += 1; messages.push(`SKIP ${path}: ${locationIssue} for ${edit.targetHint}.`); return; }
      const wrapped = wrapActionableReplacement({ ...edit, path }, index);
      if (!wrapped.ok) { skipped += 1; messages.push(`SKIP ${path}: unsafe LaTeX for ${edit.targetHint}: ${wrapped.reason}.`); return; }
      const replacement = wrapped.text;
      const start = edit.mode === 'insert_before' ? at : at;
      const end = edit.mode === 'replace' ? at + anchor.length : edit.mode === 'insert_after' ? at + anchor.length : at;
      const insert = edit.mode === 'replace' ? replacement : edit.mode === 'insert_after' ? `${anchor}\n\n${replacement}` : `${replacement}\n\n${anchor}`;
      if (!queued.has(path)) queued.set(path, []);
      queued.get(path).push({ start, end, insert, targetHint: edit.targetHint });
    });

    let applied = 0;
    for (const [path, ops] of queued.entries()) {
      const file = getFile(path);
      let text = fileText(file);
      ops.sort((a, b) => b.start - a.start);
      for (const op of ops) {
        text = text.slice(0, op.start) + op.insert + text.slice(op.end);
        applied += 1;
        messages.push(`APPLY ${path}: ${op.targetHint}`);
      }
      updateProjectSource(path, text);
    }

    const modifiedPaths = [...queued.keys()];
    refreshPaperAiReview(modifiedPaths, 'Competitive Review');
    updateWorkflowStatus('insert', `inserted ${applied}; skipped ${skipped}.`);
    renderEditImpactMap();
    setStatus(`Inserted ${applied} competitive \\lai edit(s) at exact matches; skipped ${skipped}. Paper-level edit review refreshed.`);
    setOutput([lastReport, '', '--- Latexai actionable edit insertion report ---', `Source: ${parsed.source}`, `Applied: ${applied}`, `Skipped: ${skipped}`, ...messages].join('\n'));
    const result = { ok: applied > 0, applied, skipped, messages, source: parsed.source, paths: [...queued.keys()] };
    await markMemoryUse('competitive-lai-insert', applied > 0 ? 'success' : 'failure', `Applied ${applied} competitive lai edits; skipped ${skipped}.`);
    await savePaperEditMemory('competitive-lai-insert', result, { memoryFactsUsed: Array.isArray(memoryContext?.facts) ? memoryContext.facts.length : 0 });
    return result;
  }

  async function appendLaiImprovementPlan() {
    if (!lastReport) {
      setStatus('Run competitive review first.');
      return { ok: false, error: 'No report' };
    }

    const memoryContext = await loadCompetitiveMemoryContext('competitive-lai-append-plan', 12, lastReport.slice(0, 8000));
    ensureRootLaiMacros();
    const root = getFile(rootPath());
    const active = root ? { path: rootPath(), file: root, text: fileText(root) } : activeSource();
    const parsed = extractActionableEdits(lastReport);
    const planText = parsed.appendPlan && parsed.appendPlan.trim() ? parsed.appendPlan : lastReport;
    const insertion = wrapLaiPlanBlock(markdownToLaiPlan(planText, 'Latexai Competitive Review Improvement Plan'), active.path);
    const next = insertBeforeEndDocument(active.text, insertion);
    updateProjectSource(active.path, next);
    refreshPaperAiReview([active.path], 'Competitive Review');
    updateWorkflowStatus('insert', `appended visible \\lai plan to ${active.path}.`);
    renderEditImpactMap();
    setStatus(`Appended competitive improvement plan as visible \\lai markup to ${active.path}. Paper-level edit review refreshed.`);
    const result = { ok: true, path: active.path, mode: 'append-lai-plan' };
    await markMemoryUse('competitive-lai-append-plan', 'success', `Appended competitive lai plan to ${active.path}.`);
    await savePaperEditMemory('competitive-lai-append-plan', result, { memoryFactsUsed: Array.isArray(memoryContext?.facts) ? memoryContext.facts.length : 0 });
    return result;
  }

  function insertRoadmapComment() {
    return appendLaiImprovementPlan();
  }

  async function copyReport() {
    const text = lastReport || el('competitiveReviewOutput')?.textContent || '';
    if (!text.trim()) {
      setStatus('No competitive review report to copy.');
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Competitive review copied.');
      return true;
    } catch (_err) {
      setStatus('Could not copy automatically. Select the report text manually.');
      return false;
    }
  }

  function setStatus(message) {
    const node = el('competitiveReviewStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const out = el('competitiveReviewOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = String(text || '');
    }
  }

  function createCard() {
    const panel = el('copilotTab') || el('settingsTab') || D.querySelector('.right-panel');
    if (!panel || el('competitiveReviewCard')) return false;

    const card = D.createElement('div');
    card.id = 'competitiveReviewCard';
    card.className = 'competitive-review-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Paper AI</div>',
      '    <h2>Competitive paper review</h2>',
      '  </div>',
      '</div>',
      '<p class="competitive-review-help">Competitor-driven review workflow: add URLs, research competitor papers with a web-search-capable AI backend, rank competitors, compare the draft, then generate a roadmap with actionable <code>\\lai</code> edits.</p>',
      '<label class="competitive-web-required"><input id="competitiveRequireWebSearch" type="checkbox" checked disabled /> Require web-search-capable AI for this workflow</label>',
      '<div id="competitiveWebSearchStatus" class="competitive-web-status">Web search not checked yet.</div>',
      '<div id="competitiveWorkflowStatus" class="competitive-workflow-status">',
      '  <div class="competitive-step-row active" data-competitive-step="urls"><span class="competitive-step-label">1. URLs</span><span class="competitive-step-message">Add competitor papers</span></div>',
      '  <div class="competitive-step-row" data-competitive-step="fetch"><span class="competitive-step-label">2. Web research</span><span class="competitive-step-message">pending</span></div>',
      '  <div class="competitive-step-row" data-competitive-step="rank"><span class="competitive-step-label">3. Rank competitors</span><span class="competitive-step-message">pending</span></div>',
      '  <div class="competitive-step-row" data-competitive-step="compare"><span class="competitive-step-label">4. Compare draft</span><span class="competitive-step-message">pending</span></div>',
      '  <div class="competitive-step-row" data-competitive-step="roadmap"><span class="competitive-step-label">5. Roadmap</span><span class="competitive-step-message">pending</span></div>',
      '  <div class="competitive-step-row" data-competitive-step="insert"><span class="competitive-step-label">6. Insert edits</span><span class="competitive-step-message">pending</span></div>',
      '</div>',
      '<div id="competitiveEvidenceStatus" class="competitive-web-status">Evidence ledger not built yet. Research competitors to generate source IDs.</div>',
      '<div id="competitiveEvidenceDashboard" class="competitive-evidence-dashboard"><div class="competitive-evidence-empty">No competitor research profiles yet.</div></div>',
      '<div id="competitiveRankingPreview" class="competitive-ranking-preview"><div class="competitive-ranking-empty">Ranking table will appear here after <strong>Rank competitors</strong>.</div></div>',
      '<div id="competitiveEditImpactMap" class="competitive-edit-impact-map"><div class="competitive-impact-empty">Edit impact map will appear after <strong>Generate source-cited roadmap</strong>.</div></div>',
      '<div class="competitive-url-add-row">',
      '  <input id="competitiveAddUrlInput" type="url" placeholder="Paste competitor paper URL" />',
      '  <button id="addCompetitiveUrlBtn" class="btn mini" type="button">+ Add URL</button>',
      '</div>',
      '<label class="field">Competitor paper URLs',
      '  <textarea id="competitivePaperUrls" rows="4" placeholder="One URL per line. The AI backend will use web-search/open tools to build cached competitor research profiles; Latexai will not extract PDFs itself."></textarea>',
      '</label>',
      '<label class="field">Competitor notes / abstracts / titles',
      '  <textarea id="competitivePaperNotes" rows="5" placeholder="Optional but useful: paste titles, abstracts, claims, strengths, or notes for the competitor papers."></textarea>',
      '</label>',
      '<div class="field-grid two">',
      '  <label class="field">Target venue',
      '    <input id="competitiveTargetVenue" type="text" placeholder="e.g. COLT, NeurIPS, ICML, STOC" />',
      '  </label>',
      '  <label class="field">Target audience',
      '    <input id="competitiveTargetAudience" type="text" placeholder="e.g. ML theory, optimization, algorithms" />',
      '  </label>',
      '</div>',
      '<div class="competitive-mode-box">',
      '  <div class="competitive-mode-title">Comparison mode</div>',
      '  <label><input data-competitive-mode="novelty" type="checkbox" checked /> novelty</label>',
      '  <label><input data-competitive-mode="clarity" type="checkbox" checked /> clarity</label>',
      '  <label><input data-competitive-mode="technical depth" type="checkbox" checked /> technical depth</label>',
      '  <label><input data-competitive-mode="positioning" type="checkbox" checked /> positioning</label>',
      '  <label><input data-competitive-mode="related work" type="checkbox" checked /> related work</label>',
      '  <label><input data-competitive-mode="overall competitiveness" type="checkbox" checked /> overall competitiveness</label>',
      '</div>',
      '<label class="field">Extra instructions',
      '  <textarea id="competitiveExtraInstructions" rows="3" placeholder="Optional: be extremely critical, focus on theorem statement, improve intro, etc."></textarea>',
      '</label>',
      '<div class="competitive-review-actions competitive-step-actions">',
      '  <button id="checkCompetitiveWebSearchBtn" class="btn mini" type="button">Check web search</button>',
      '  <button id="fetchCompetitivePapersBtn" class="btn mini" type="button">Research competitor papers</button>',
      '  <button id="rankCompetitivePapersBtn" class="btn mini" type="button">Rank competitors</button>',
      '  <button id="rerunCompetitiveResearchBtn" class="btn mini" type="button">Rerun all web research</button>',
      '  <button id="clearCompetitiveResearchCacheBtn" class="btn mini" type="button">Clear research cache</button>',
      '  <button id="compareCompetitiveDraftBtn" class="btn mini" type="button">Compare my draft</button>',
      '  <button id="generateCompetitiveRoadmapBtn" class="btn mini primary" type="button">Generate source-cited roadmap</button>',
      '  <button id="runCompetitiveReviewBtn" class="btn mini" type="button">Run full cited review</button>',
      '  <button id="copyCompetitiveReviewBtn" class="btn mini" type="button">Copy report</button>',
      '  <button id="addCompetitiveReviewBtn" class="btn mini" type="button">Add report to /reviews</button>',
      '  <button id="insertCompetitiveInlineLaiBtn" class="btn mini" type="button">Insert \lai edits at matches</button>',
      '  <button id="insertCompetitiveRoadmapBtn" class="btn mini" type="button">Append \lai plan</button>',
      '</div>',
      '<div class="settings-note">Stage 18M uses a source-cited AI web-research agent and adds an edit impact map: each actionable <code>\\lai</code> edit should identify the competitor gap, source IDs, and expected ranking effect. Reports stay in <code>/reviews</code>; actionable edits still use the Paper-level review queue.</div>',
      '<div id="competitiveReviewStatus" class="settings-note">Competitive review ready.</div>',
      '<pre id="competitiveReviewOutput" class="competitive-review-output"></pre>'
    ].join('');

    panel.appendChild(card);

    el('addCompetitiveUrlBtn')?.addEventListener('click', appendCompetitorUrlFromInput, true);
    el('competitiveAddUrlInput')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); appendCompetitorUrlFromInput(); } }, true);
    el('checkCompetitiveWebSearchBtn')?.addEventListener('click', checkWebSearchCapability, true);
    el('fetchCompetitivePapersBtn')?.addEventListener('click', researchCompetitorPapers, true);
    el('rankCompetitivePapersBtn')?.addEventListener('click', rankCompetitorPapers, true);
    el('rerunCompetitiveResearchBtn')?.addEventListener('click', rerunAllCompetitorResearch, true);
    el('clearCompetitiveResearchCacheBtn')?.addEventListener('click', clearResearchCacheForCurrentUrls, true);
    el('competitiveEvidenceDashboard')?.addEventListener('click', handleEvidenceDashboardClick, true);
    el('compareCompetitiveDraftBtn')?.addEventListener('click', compareDraftAgainstRankedSet, true);
    el('generateCompetitiveRoadmapBtn')?.addEventListener('click', generateImprovementRoadmap, true);
    el('runCompetitiveReviewBtn')?.addEventListener('click', runCompetitiveReview, true);
    el('copyCompetitiveReviewBtn')?.addEventListener('click', copyReport, true);
    el('addCompetitiveReviewBtn')?.addEventListener('click', addReportToProject, true);
    el('insertCompetitiveInlineLaiBtn')?.addEventListener('click', insertActionableEditsAtMatches, true);
    el('insertCompetitiveRoadmapBtn')?.addEventListener('click', appendLaiImprovementPlan, true);

    renderEvidenceDashboard();
    renderEditImpactMap();
    return true;
  }

  function init() {
    createCard();
  }

  NS.CompetitivePaperReviewService = {
    STAGE,
    init,
    buildPayload,
    validatePayload,
    checkWebSearchCapability,
    requireWebSearch,
    researchCompetitorPapers,
    rankCompetitorPapers,
    compareDraftAgainstRankedSet,
    generateImprovementRoadmap,
    runCompetitiveReview,
    addReportToProject,
    insertRoadmapComment,
    appendLaiImprovementPlan,
    insertActionableEditsAtMatches,
    extractActionableEdits,
    getLastReport: () => lastReport,
    getLastPayload: () => lastPayload,
    getLastCompetitorSummaries: () => lastCompetitorSummaries,
    getLastRankingReport: () => lastRankingReport,
    getLastComparisonReport: () => lastComparisonReport,
    getLastSourceLedger: () => lastSourceLedger,
    getLastEvidenceCoverage: () => lastEvidenceCoverage,
    getLastEditImpactMap: () => lastEditImpactMap,
    sourcesMarkdown,
    evidenceCoverageMarkdown,
    renderEvidenceDashboard,
    renderRankingPreview,
    renderEditImpactMap,
    buildEditImpactMap,
    editImpactMarkdown,
    parseRankingEntries,
    clearResearchCacheForCurrentUrls,
    rerunAllCompetitorResearch
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  setTimeout(createCard, 900);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
