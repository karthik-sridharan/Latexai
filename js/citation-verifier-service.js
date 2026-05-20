/* Latexai Stage 12C CitationVerifierService
 * Stage: stage12c-missing-bibtex-repair-1
 *
 * Deterministic local verifier for LaTeX citations and BibTeX:
 * - parse \cite-like commands in .tex files
 * - parse .bib entries
 * - report missing keys, unused entries, duplicate keys, malformed entries
 * - report weak entries missing title/author/year/venue/link fields
 *
 * No online verification yet. This is intentionally local and frontend-only.
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage12c-missing-bibtex-repair-1';
  const MISSING_BIB_PROMPT_PATH = 'prompt/ai-missing-bibtex-repair.txt';

  let lastReport = null;
  let missingBibPromptCache = '';

  function State() { return NS.State; }
  function el(id) { return document.getElementById(id); }

  function setStatus(message) {
    const node = el('citationVerifierStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const node = el('citationVerifierOutput');
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

  function stripLatexComments(text) {
    const lines = String(text || '').split('\n');
    return lines.map((line) => {
      let escaped = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '\\') {
          escaped = !escaped;
          continue;
        }
        if (ch === '%' && !escaped) return line.slice(0, i);
        escaped = false;
      }
      return line;
    }).join('\n');
  }

  function splitCitationKeys(raw) {
    return String(raw || '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
  }

  function findCitationCommandsInText(text, path) {
    const clean = stripLatexComments(text);
    const citations = [];

    // Covers common natbib/biblatex/base commands:
    // \cite{a,b}, \citep[see][p. 3]{a}, \citet{a}, \autocite{a}, \parencite{a}, etc.
    const citeRe = /\\(cite|citep|citet|citealp|citealt|citeauthor|citeyear|citeyearpar|autocite|parencite|textcite|footcite|supercite|Cite|Citep|Citet)\s*(?:\[[^\]]*\]\s*){0,2}\{([^{}]+)\}/g;
    let match;
    while ((match = citeRe.exec(clean))) {
      const command = match[1];
      const rawKeys = match[2];
      for (const key of splitCitationKeys(rawKeys)) {
        citations.push({
          path: normalizePath(path),
          command,
          key,
          raw: match[0],
          index: match.index
        });
      }
    }

    return citations;
  }

  function scanCitations() {
    const files = (project().files || [])
      .filter((file) => textFile(file))
      .filter((file) => /\.tex$/i.test(file.path || ''));

    const citations = [];
    for (const file of files) {
      citations.push(...findCitationCommandsInText(fileText(file), file.path));
    }
    return citations;
  }

  function findMatchingBrace(text, openAt) {
    const s = String(text || '');
    let depth = 0;
    for (let i = openAt; i < s.length; i += 1) {
      const ch = s[i];
      const prev = i > 0 ? s[i - 1] : '';
      if (ch === '{' && prev !== '\\') depth += 1;
      else if (ch === '}' && prev !== '\\') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function parseBibFields(body) {
    const fields = {};
    let i = 0;
    const s = String(body || '');

    while (i < s.length) {
      const nameMatch = s.slice(i).match(/^\s*,?\s*([A-Za-z][A-Za-z0-9_-]*)\s*=/);
      if (!nameMatch) {
        i += 1;
        continue;
      }
      const name = nameMatch[1].toLowerCase();
      i += nameMatch[0].length;

      while (i < s.length && /\s/.test(s[i])) i += 1;

      let value = '';
      if (s[i] === '{') {
        const close = findMatchingBrace(s, i);
        if (close < 0) {
          value = s.slice(i + 1).trim();
          i = s.length;
        } else {
          value = s.slice(i + 1, close).trim();
          i = close + 1;
        }
      } else if (s[i] === '"') {
        let j = i + 1;
        while (j < s.length) {
          if (s[j] === '"' && s[j - 1] !== '\\') break;
          j += 1;
        }
        value = s.slice(i + 1, j).trim();
        i = j + 1;
      } else {
        let j = i;
        while (j < s.length && s[j] !== ',') j += 1;
        value = s.slice(i, j).trim();
        i = j;
      }

      fields[name] = value;
    }

    return fields;
  }

  function parseBibEntriesInText(text, path) {
    const s = String(text || '');
    const entries = [];
    const entryRe = /@([A-Za-z]+)\s*\{\s*([^,\s]+)\s*,/g;
    let match;

    while ((match = entryRe.exec(s))) {
      const type = match[1].toLowerCase();
      const key = String(match[2] || '').trim();
      const openAt = s.indexOf('{', match.index);
      const closeAt = findMatchingBrace(s, openAt);
      if (closeAt < 0) {
        entries.push({
          path: normalizePath(path),
          type,
          key,
          fields: {},
          raw: s.slice(match.index),
          malformed: true,
          reason: 'unclosed-entry'
        });
        break;
      }

      const raw = s.slice(match.index, closeAt + 1);
      const bodyStart = s.indexOf(',', match.index) + 1;
      const body = s.slice(bodyStart, closeAt);
      entries.push({
        path: normalizePath(path),
        type,
        key,
        fields: parseBibFields(body),
        raw,
        malformed: false,
        reason: ''
      });

      entryRe.lastIndex = closeAt + 1;
    }

    return entries;
  }

  function scanBibEntries() {
    const files = (project().files || [])
      .filter((file) => textFile(file))
      .filter((file) => /\.bib$/i.test(file.path || ''));

    const entries = [];
    for (const file of files) entries.push(...parseBibEntriesInText(fileText(file), file.path));
    return entries;
  }

  function entryHasVenue(entry) {
    const f = entry.fields || {};
    return Boolean(f.journal || f.booktitle || f.publisher || f.institution || f.school || f.archiveprefix || f.eprinttype);
  }

  function entryHasLink(entry) {
    const f = entry.fields || {};
    return Boolean(f.doi || f.url || f.eprint || f.arxiv || f.archiveprefix);
  }

  function entryQualityWarnings(entry) {
    const f = entry.fields || {};
    const warnings = [];
    if (entry.malformed) warnings.push(entry.reason || 'malformed-entry');
    if (!entry.key) warnings.push('missing-key');
    if (!f.title) warnings.push('missing-title');
    if (!f.author && !f.editor) warnings.push('missing-author-or-editor');
    if (!f.year && !f.date) warnings.push('missing-year-or-date');
    if (!entryHasVenue(entry)) warnings.push('missing-venue-field');
    if (!entryHasLink(entry)) warnings.push('missing-doi-url-or-eprint');
    return warnings;
  }

  function buildCitationReport() {
    const citations = scanCitations();
    const entries = scanBibEntries();

    const citationKeys = new Set(citations.map((c) => c.key));
    const entryMap = new Map();
    const duplicateEntries = [];

    for (const entry of entries) {
      if (!entryMap.has(entry.key)) entryMap.set(entry.key, []);
      entryMap.get(entry.key).push(entry);
    }

    for (const [key, list] of entryMap.entries()) {
      if (key && list.length > 1) duplicateEntries.push({ key, entries: list });
    }

    const missingKeys = [...citationKeys]
      .filter((key) => !entryMap.has(key))
      .map((key) => ({
        key,
        citations: citations.filter((c) => c.key === key)
      }));

    const unusedEntries = entries
      .filter((entry) => entry.key && !citationKeys.has(entry.key))
      .map((entry) => ({ key: entry.key, entry }));

    const weakEntries = entries
      .map((entry) => ({ entry, warnings: entryQualityWarnings(entry) }))
      .filter((item) => item.warnings.length);

    const citeaiLeftovers = (project().files || [])
      .filter((file) => textFile(file))
      .filter((file) => /\.tex$/i.test(file.path || ''))
      .flatMap((file) => {
        const text = stripLatexComments(fileText(file));
        const matches = [...text.matchAll(/\\citeai\s*\{[^{}]*\}/g)];
        return matches.map((m) => ({ path: normalizePath(file.path), raw: m[0], index: m.index }));
      });

    const report = {
      ok: missingKeys.length === 0 && duplicateEntries.length === 0 && citeaiLeftovers.length === 0,
      citations,
      entries,
      summary: {
        citationUses: citations.length,
        uniqueCitationKeys: citationKeys.size,
        bibEntries: entries.length,
        missingKeys: missingKeys.length,
        duplicateKeys: duplicateEntries.length,
        unusedEntries: unusedEntries.length,
        weakEntries: weakEntries.length,
        citeaiLeftovers: citeaiLeftovers.length
      },
      missingKeys,
      duplicateEntries,
      unusedEntries,
      weakEntries,
      citeaiLeftovers
    };

    lastReport = report;
    return report;
  }

  function formatCitationLocation(citation) {
    return `${citation.path} · \\${citation.command}{${citation.key}}`;
  }

  function formatReport(report = lastReport) {
    if (!report) return 'No citation verification report yet.';

    const lines = [
      'Local citation verifier report',
      '==============================',
      '',
      `Citation uses: ${report.summary.citationUses}`,
      `Unique citation keys: ${report.summary.uniqueCitationKeys}`,
      `BibTeX entries: ${report.summary.bibEntries}`,
      `Missing keys: ${report.summary.missingKeys}`,
      `Duplicate keys: ${report.summary.duplicateKeys}`,
      `Unused entries: ${report.summary.unusedEntries}`,
      `Weak entries: ${report.summary.weakEntries}`,
      `Remaining \\citeai placeholders: ${report.summary.citeaiLeftovers}`,
      ''
    ];

    if (report.missingKeys.length) {
      lines.push('Missing citation keys', '---------------------');
      for (const item of report.missingKeys) {
        lines.push(`- ${item.key}`);
        item.citations.slice(0, 6).forEach((citation) => lines.push(`  at ${formatCitationLocation(citation)}`));
      }
      lines.push('');
    }

    if (report.duplicateEntries.length) {
      lines.push('Duplicate BibTeX keys', '---------------------');
      for (const item of report.duplicateEntries) {
        lines.push(`- ${item.key}`);
        item.entries.forEach((entry) => lines.push(`  in ${entry.path} (@${entry.type})`));
      }
      lines.push('');
    }

    if (report.citeaiLeftovers.length) {
      lines.push('Remaining \\citeai placeholders', '-------------------------------');
      report.citeaiLeftovers.forEach((item) => lines.push(`- ${item.path}: ${item.raw}`));
      lines.push('');
    }

    if (report.weakEntries.length) {
      lines.push('Weak / incomplete BibTeX entries', '--------------------------------');
      for (const item of report.weakEntries) {
        lines.push(`- ${item.entry.key || '(missing key)'} in ${item.entry.path}: ${item.warnings.join(', ')}`);
      }
      lines.push('');
    }

    if (report.unusedEntries.length) {
      lines.push('Unused BibTeX entries', '---------------------');
      report.unusedEntries.slice(0, 80).forEach((item) => lines.push(`- ${item.key} in ${item.entry.path}`));
      if (report.unusedEntries.length > 80) lines.push(`... ${report.unusedEntries.length - 80} more`);
      lines.push('');
    }

    if (report.ok) {
      lines.push('No missing keys, duplicate keys, or leftover \\citeai placeholders were found.');
    } else {
      lines.push('Review the issues above. This verifier is local only; it does not confirm online existence.');
    }

    return lines.join('\n');
  }

  function renderSummary(report) {
    const node = el('citationVerifierSummary');
    if (!node) return;
    node.innerHTML = '';

    const pills = [
      ['Uses', report.summary.citationUses, 'ok'],
      ['Bib entries', report.summary.bibEntries, 'ok'],
      ['Missing', report.summary.missingKeys, report.summary.missingKeys ? 'error' : 'ok'],
      ['Duplicates', report.summary.duplicateKeys, report.summary.duplicateKeys ? 'error' : 'ok'],
      ['Weak', report.summary.weakEntries, report.summary.weakEntries ? 'warn' : 'ok'],
      ['Leftover citeai', report.summary.citeaiLeftovers, report.summary.citeaiLeftovers ? 'warn' : 'ok']
    ];

    for (const [label, value, cls] of pills) {
      const span = document.createElement('span');
      span.className = `citation-verifier-pill ${cls}`;
      span.textContent = `${label}: ${value}`;
      node.appendChild(span);
    }
  }

  function verifyCitations() {
    const report = buildCitationReport();
    renderSummary(report);
    setOutput(formatReport(report));
    setStatus(report.ok
      ? 'Local citation verification passed basic checks.'
      : 'Local citation verification found issues. Review the report.');
    return report;
  }

  async function copyVerifierReport() {
    const text = formatReport(lastReport);
    if (!String(text).trim()) {
      setStatus('No verifier report to copy yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Citation verifier report copied.');
    } catch (_err) {
      setStatus('Could not copy automatically. Select the report text manually.');
    }
  }


  function sanitizeCitationKey(key) {
    return String(key || '').trim().replace(/[^A-Za-z0-9:_-]+/g, '');
  }

  function bibEntryKey(bibtex) {
    const m = String(bibtex || '').match(/@\w+\s*\{\s*([^,\s]+)\s*,/);
    return sanitizeCitationKey(m?.[1] || '');
  }

  function bibPath() {
    const files = project().files || [];
    const existing = files.find((file) => /\.bib$/i.test(file.path || ''));
    return normalizePath(existing?.path || 'references.bib');
  }

  function getOrCreateBibFile(path) {
    const normalized = normalizePath(path || bibPath());
    let file = State()?.getFile?.(normalized);
    if (!file) {
      State()?.createFile?.(normalized, '');
      file = State()?.getFile?.(normalized);
    }
    return file;
  }

  function missingBibPromptUrl() {
    const stage = encodeURIComponent(W.LUMINA_LATEX_STAGE || STAGE);
    return `${MISSING_BIB_PROMPT_PATH}?v=${stage}`;
  }

  async function loadMissingBibPrompt() {
    if (missingBibPromptCache) return missingBibPromptCache;
    try {
      const response = await fetch(missingBibPromptUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      missingBibPromptCache = text.trim() || 'Return JSON BibTeX entries for missing citation keys.';
    } catch (_err) {
      missingBibPromptCache = 'Return JSON only: {"items":[{"citationKey":"key","bibtex":"@article{key,...}","confidence":"low","note":"..."}],"summary":"..."}';
    }
    return missingBibPromptCache;
  }

  function collectMissingBibContext(maxChars = 60000) {
    const files = (project().files || [])
      .filter((file) => textFile(file))
      .filter((file) => /\.(tex|bib|bbl|md|txt)$/i.test(file.path || ''))
      .filter((file) => !/^prompt\//i.test(normalizePath(file.path || '')))
      .sort((a, b) => normalizePath(a.path).localeCompare(normalizePath(b.path)));

    let used = 0;
    const parts = [];
    for (const file of files) {
      const path = normalizePath(file.path);
      let text = fileText(file);
      const header = `\n\n%%%% FILE: ${path}\n`;
      const remaining = maxChars - used - header.length;
      if (remaining <= 0) break;
      if (text.length > remaining) text = text.slice(0, Math.max(0, remaining)) + '\n% [truncated]\n';
      parts.push(header + text);
      used += header.length + text.length;
    }
    return parts.join('');
  }

  function stripJsonFence(raw) {
    let s = String(raw || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
    return s;
  }

  function parseMissingBibPlan(raw) {
    let data;
    try {
      data = JSON.parse(stripJsonFence(raw));
    } catch (err) {
      return { ok: false, error: `Could not parse missing-BibTeX JSON: ${err.message}`, items: [], summary: '' };
    }

    const items = (Array.isArray(data.items) ? data.items : []).map((item) => ({
      citationKey: sanitizeCitationKey(item.citationKey || ''),
      bibtex: String(item.bibtex || '').trim(),
      confidence: String(item.confidence || ''),
      note: String(item.note || '')
    })).filter((item) => item.citationKey && item.bibtex);

    return { ok: true, items, summary: String(data.summary || ''), raw: data };
  }

  function normalizeBibtexItem(item) {
    const key = sanitizeCitationKey(item.citationKey) || bibEntryKey(item.bibtex);
    let bibtex = String(item.bibtex || '').trim();
    const existing = bibEntryKey(bibtex);
    if (key && existing && key !== existing) {
      bibtex = bibtex.replace(/(@\w+\s*\{\s*)[^,\s]+(\s*,)/, `$1${key}$2`);
    }
    return { ...item, citationKey: key || existing, bibtex };
  }

  function appendBibtexItems(items = []) {
    const bib = getOrCreateBibFile(bibPath());
    const bpath = normalizePath(bib?.path || bibPath());
    let bibText = fileText(bib);
    let added = 0;
    const messages = [];

    for (const raw of items) {
      const item = normalizeBibtexItem(raw);
      const key = sanitizeCitationKey(item.citationKey) || bibEntryKey(item.bibtex);
      if (!key || !item.bibtex) continue;

      const keyRe = new RegExp(`@\\w+\\s*\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*,`, 'i');
      if (keyRe.test(bibText)) {
        messages.push(`Already present: ${key}`);
        continue;
      }

      bibText = `${bibText.trimEnd()}\n\n${item.bibtex.trim()}\n`;
      added += 1;
      messages.push(`Added ${key} to ${bpath}${item.confidence ? ` (${item.confidence})` : ''}`);
    }

    State()?.updateFile?.(bpath, bibText);
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { NS.FileTree?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}

    return { ok: true, added, path: bpath, messages };
  }

  async function repairMissingBibtex() {
    const report = buildCitationReport();
    renderSummary(report);
    if (!report.missingKeys.length) {
      setOutput(formatReport(report));
      setStatus('No missing citation keys to repair.');
      return { ok: true, added: 0 };
    }

    if (!NS.AIProvider?.ask) {
      setStatus('AIProvider is not loaded.');
      return { ok: false, added: 0 };
    }

    const missing = report.missingKeys.map((item) => ({
      citationKey: item.key,
      occurrences: item.citations.map((citation) => ({
        path: citation.path,
        command: citation.command,
        raw: citation.raw
      }))
    }));

    setStatus(`Asking AI for BibTeX entries for ${missing.length} missing key(s)...`);

    try {
      const prompt = await loadMissingBibPrompt();
      const input = [
        prompt,
        '',
        '--- Missing citation keys ---',
        JSON.stringify(missing, null, 2),
        '',
        '--- Local verifier report ---',
        formatReport(report),
        '',
        '--- Paper/project context ---',
        collectMissingBibContext()
      ].join('\n');

      const response = await NS.AIProvider.ask({
        instructions: 'Return JSON only. No markdown fences. No prose outside JSON.',
        input,
        temperature: 0.05,
        maxOutputTokens: 7000,
        citationVerifierRepair: {
          missing,
          promptFile: MISSING_BIB_PROMPT_PATH,
          rootPath: (project().rootFile || 'main.tex')
        }
      }, {
        task: 'latex-citation-missing-bibtex-repair',
        context: {
          workflow: 'citation-verifier-missing-bibtex-repair',
          missingCount: missing.length,
          promptFile: MISSING_BIB_PROMPT_PATH
        }
      });

      const raw = NS.AIProvider.extractText(response);
      const plan = parseMissingBibPlan(raw);
      if (!plan.ok) {
        setOutput([
          'Missing BibTeX repair failed',
          '============================',
          '',
          plan.error,
          '',
          'Raw AI output:',
          raw
        ].join('\n'));
        setStatus(plan.error);
        return { ok: false, added: 0, error: plan.error };
      }

      const result = appendBibtexItems(plan.items);
      const after = buildCitationReport();
      renderSummary(after);
      setOutput([
        'Missing BibTeX repair report',
        '============================',
        '',
        `Requested missing keys: ${missing.length}`,
        `AI BibTeX items: ${plan.items.length}`,
        `Entries added: ${result.added}`,
        plan.summary ? `Summary: ${plan.summary}` : '',
        '',
        ...result.messages,
        '',
        'Updated verifier report',
        '-----------------------',
        formatReport(after)
      ].join('\n'));
      setStatus(`Added ${result.added} missing BibTeX entr${result.added === 1 ? 'y' : 'ies'}.`);
      return { ok: true, added: result.added, plan, result, report: after };
    } catch (err) {
      setStatus(`Missing BibTeX repair failed: ${err?.message || err}`);
      return { ok: false, added: 0, error: err?.message || String(err) };
    }
  }

  async function verifyAndRepairMissingBibtex() {
    verifyCitations();
    return repairMissingBibtex();
  }

  function createCard() {
    const panel = el('copilotTab');
    if (!panel || el('citationVerifierCard')) return false;

    const card = document.createElement('div');
    card.className = 'citation-verifier-card';
    card.id = 'citationVerifierCard';
    card.innerHTML = [
      '<h3>Local citation verifier</h3>',
      '<div class="citation-verifier-grid">',
      '  <div class="citation-verifier-help">Stage 12B checks citations locally: missing keys, duplicate BibTeX keys, unused entries, weak BibTeX fields, and leftover <code>\\citeai{...}</code>. It does not verify online existence yet.</div>',
      '  <div class="citation-verifier-actions">',
      '    <button id="verifyCitationsBtn" class="btn mini primary" type="button">Verify citations</button>',
      '    <button id="repairMissingBibtexBtn" class="btn mini primary" type="button">Add missing BibTeX with AI</button>',
      '    <button id="verifyRepairMissingBibtexBtn" class="btn mini" type="button">Verify + add missing BibTeX</button>',
      '    <button id="copyCitationVerifierBtn" class="btn mini" type="button">Copy report</button>',
      '  </div>',
      '  <div id="citationVerifierStatus" class="citation-verifier-status">Local citation verifier ready.</div>',
      '  <div id="citationVerifierSummary" class="citation-verifier-summary"></div>',
      '  <pre id="citationVerifierOutput" class="citation-verifier-output"></pre>',
      '</div>'
    ].join('');

    const citationCard = el('citationAiCard');
    if (citationCard?.nextSibling) panel.insertBefore(card, citationCard.nextSibling);
    else panel.appendChild(card);

    bindControls();
    return true;
  }

  function bindControls() {
    el('verifyCitationsBtn')?.addEventListener('click', verifyCitations, true);
    el('repairMissingBibtexBtn')?.addEventListener('click', repairMissingBibtex, true);
    el('verifyRepairMissingBibtexBtn')?.addEventListener('click', verifyAndRepairMissingBibtex, true);
    el('copyCitationVerifierBtn')?.addEventListener('click', copyVerifierReport, true);
  }

  function init() {
    createCard();
  }

  NS.CitationVerifierService = {
    STAGE,
    init,
    stripLatexComments,
    splitCitationKeys,
    findCitationCommandsInText,
    scanCitations,
    parseBibFields,
    parseBibEntriesInText,
    scanBibEntries,
    entryQualityWarnings,
    buildCitationReport,
    formatReport,
    verifyCitations,
    repairMissingBibtex,
    verifyAndRepairMissingBibtex,
    parseMissingBibPlan,
    appendBibtexItems,
    copyVerifierReport,
    getLastReport: () => lastReport
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
