/* Latexai Stage 12F CitationVerifierService
 * Stage: stage12f-clickable-link-panel-fix-1
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
  const STAGE = 'stage12f-clickable-link-panel-fix-1';
  const MISSING_BIB_PROMPT_PATH = 'prompt/ai-missing-bibtex-repair.txt';
  const CITATION_AUDIT_PROMPT_PATH = 'prompt/ai-citation-audit.txt';

  let lastReport = null;
  let missingBibPromptCache = '';
  let citationAuditPromptCache = '';
  let lastAudit = null;

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

  function setOutputHtml(html) {
    const node = el('citationVerifierOutput');
    if (!node) return;
    node.classList.add('active');
    node.innerHTML = String(html || '');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function safeHttpUrl(url) {
    const s = String(url || '').trim();
    if (!/^https?:\/\//i.test(s)) return '';
    try {
      const parsed = new URL(s);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      return parsed.href;
    } catch (_err) {
      return '';
    }
  }

  function anchor(url, label = url) {
    const safe = safeHttpUrl(url);
    if (!safe) return escapeHtml(label || url || '');
    return `<a class="citation-click-link" href="${escapeHtml(safe)}" data-url="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label || safe)}</a>`;
  }

  function handleVerifierLinkClick(event) {
    const link = event.target?.closest?.('a.citation-click-link');
    if (!link) return;
    const url = safeHttpUrl(link.getAttribute('data-url') || link.getAttribute('href'));
    if (!url) return;

    // Stage 12F: some app/panel click handlers can swallow anchor navigation.
    // Stop propagation and explicitly open the URL so citation links work.
    event.preventDefault();
    event.stopPropagation();
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) window.location.href = url;
    } catch (_err) {
      window.location.href = url;
    }
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


  function stripOuterBraces(value) {
    let s = String(value || '').trim();
    while (s.startsWith('{') && s.endsWith('}')) s = s.slice(1, -1).trim();
    return s;
  }

  function normalizeDoi(doi) {
    return stripOuterBraces(doi)
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
      .replace(/^doi:\s*/i, '')
      .trim();
  }

  function normalizeArxiv(value) {
    return stripOuterBraces(value)
      .replace(/^arxiv:/i, '')
      .replace(/^https?:\/\/arxiv\.org\/(?:abs|pdf)\//i, '')
      .replace(/\.pdf$/i, '')
      .trim();
  }

  function entryOnlineLinks(entry) {
    const f = entry?.fields || {};
    const links = [];
    const doi = normalizeDoi(f.doi || '');
    if (doi) links.push({ type: 'doi', url: `https://doi.org/${encodeURIComponent(doi).replace(/%2F/g, '/')}`, label: doi });

    const archive = String(f.archiveprefix || f.eprinttype || '').toLowerCase();
    const eprint = normalizeArxiv(f.eprint || f.arxiv || '');
    if (eprint && (archive.includes('arxiv') || /^\d{4}\.\d{4,5}/.test(eprint) || /^[a-z-]+\/\d{7}/i.test(eprint))) {
      links.push({ type: 'arxiv', url: `https://arxiv.org/abs/${encodeURIComponent(eprint)}`, label: eprint });
    }

    const url = stripOuterBraces(f.url || '');
    if (url && /^https?:\/\//i.test(url)) links.push({ type: 'url', url, label: url });
    return links;
  }

  function fallbackSearchUrl(entry) {
    const f = entry?.fields || {};
    const title = stripOuterBraces(f.title || '');
    const author = stripOuterBraces(f.author || f.editor || '').split(/\s+and\s+/i)[0] || '';
    const year = stripOuterBraces(f.year || f.date || '');
    const query = [title, author, year].filter(Boolean).join(' ');
    if (!query.trim()) return '';
    return `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;
  }

  function citationLinkReport(report = lastReport || buildCitationReport()) {
    const entries = report?.entries || [];
    const lines = [
      'Citation online-link helper',
      '===========================',
      '',
      'This is a local link helper. It builds links from DOI, arXiv/eprint, and URL fields.',
      'If no direct link exists, it provides a Google Scholar search URL.',
      ''
    ];
    if (!entries.length) {
      lines.push('No BibTeX entries found.');
      return lines.join('\n');
    }
    for (const entry of entries) {
      const links = entryOnlineLinks(entry);
      const search = fallbackSearchUrl(entry);
      lines.push(`${entry.key || '(missing key)'} in ${entry.path}`);
      if (links.length) for (const link of links) lines.push(`  ${link.type}: ${link.url}`);
      else if (search) lines.push(`  search: ${search}`);
      else lines.push('  no DOI/arXiv/URL/searchable title found');
    }
    return lines.join('\n');
  }

  function citationLinkReportHtml(report = lastReport || buildCitationReport()) {
    const entries = report?.entries || [];
    const html = [
      '<div class="citation-link-report">',
      '<h4>Citation online-link helper</h4>',
      '<p>This is a local link helper. It builds clickable links from DOI, arXiv/eprint, and URL fields. If no direct link exists, it provides a Google Scholar search link.</p>'
    ];
    if (!entries.length) {
      html.push('<p>No BibTeX entries found.</p>', '</div>');
      return html.join('');
    }

    html.push('<ul>');
    for (const entry of entries) {
      const links = entryOnlineLinks(entry);
      const search = fallbackSearchUrl(entry);
      html.push(`<li><strong>${escapeHtml(entry.key || '(missing key)')}</strong> <span class="muted">in ${escapeHtml(entry.path)}</span>`);
      if (links.length) {
        html.push('<ul>');
        for (const link of links) html.push(`<li>${escapeHtml(link.type)}: ${anchor(link.url, link.label || link.url)}</li>`);
        html.push('</ul>');
      } else if (search) {
        html.push(`<ul><li>search: ${anchor(search, 'Google Scholar search')}</li></ul>`);
      } else {
        html.push('<ul><li>no DOI/arXiv/URL/searchable title found</li></ul>');
      }
      html.push('</li>');
    }
    html.push('</ul>', '</div>');
    return html.join('');
  }

  function showCitationLinks() {
    const report = buildCitationReport();
    renderSummary(report);
    setOutputHtml(citationLinkReportHtml(report));
    setStatus('Built clickable local online links from BibTeX DOI/arXiv/URL fields.');
    return report;
  }

  function citationAuditPromptUrl() {
    const stage = encodeURIComponent(W.LUMINA_LATEX_STAGE || STAGE);
    return `${CITATION_AUDIT_PROMPT_PATH}?v=${stage}`;
  }

  async function loadCitationAuditPrompt() {
    if (citationAuditPromptCache) return citationAuditPromptCache;
    try {
      const response = await fetch(citationAuditPromptUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      citationAuditPromptCache = text.trim() || 'Audit the citation and BibTeX report. Return JSON only.';
    } catch (_err) {
      citationAuditPromptCache = 'Return JSON only with items describing citation/BibTeX issues and suggested fixes.';
    }
    return citationAuditPromptCache;
  }

  function compactEntryForAudit(entry) {
    const f = entry.fields || {};
    return {
      path: entry.path,
      type: entry.type,
      key: entry.key,
      title: stripOuterBraces(f.title || ''),
      author: stripOuterBraces(f.author || f.editor || ''),
      year: stripOuterBraces(f.year || f.date || ''),
      venue: stripOuterBraces(f.journal || f.booktitle || f.publisher || f.institution || f.school || ''),
      doi: normalizeDoi(f.doi || ''),
      eprint: normalizeArxiv(f.eprint || f.arxiv || ''),
      archiveprefix: stripOuterBraces(f.archiveprefix || f.eprinttype || ''),
      url: stripOuterBraces(f.url || ''),
      links: entryOnlineLinks(entry),
      warnings: entryQualityWarnings(entry)
    };
  }

  function citationAuditPayload(report = lastReport || buildCitationReport()) {
    return {
      summary: report.summary,
      missingKeys: report.missingKeys.map((item) => ({ key: item.key, locations: item.citations.map((citation) => `${citation.path}: \\${citation.command}{${citation.key}}`) })),
      duplicateKeys: report.duplicateEntries.map((item) => ({ key: item.key, locations: item.entries.map((entry) => `${entry.path}: @${entry.type}`) })),
      unusedEntries: report.unusedEntries.map((item) => item.key),
      weakEntries: report.weakEntries.map((item) => ({ key: item.entry.key, path: item.entry.path, warnings: item.warnings, entry: compactEntryForAudit(item.entry) })),
      entries: report.entries.map(compactEntryForAudit),
      linkReport: citationLinkReport(report)
    };
  }

  function parseCitationAudit(raw) {
    let data;
    try { data = JSON.parse(stripJsonFence(raw)); }
    catch (err) { return { ok: false, error: `Could not parse citation audit JSON: ${err.message}`, items: [], summary: '' }; }
    const items = (Array.isArray(data.items) ? data.items : []).map((item) => ({
      severity: String(item.severity || 'info'),
      key: String(item.key || ''),
      issue: String(item.issue || ''),
      suggestion: String(item.suggestion || ''),
      link: String(item.link || ''),
      confidence: String(item.confidence || '')
    })).filter((item) => item.issue || item.suggestion || item.key);
    return { ok: true, items, summary: String(data.summary || ''), raw: data };
  }

  function formatCitationAudit(audit = lastAudit) {
    if (!audit) return 'No AI citation audit yet.';
    if (!audit.ok) return `AI citation audit failed\n========================\n\n${audit.error || 'Unknown error'}`;
    const lines = ['AI citation audit', '=================', '', audit.summary || `Audit items: ${audit.items.length}`, ''];
    audit.items.forEach((item, index) => {
      lines.push(`${index + 1}. [${item.severity || 'info'}] ${item.key || '(general)'}`);
      lines.push(`Issue: ${item.issue || '(none)'}`);
      lines.push(`Suggestion: ${item.suggestion || '(none)'}`);
      if (item.link) lines.push(`Link: ${item.link}`);
      if (item.confidence) lines.push(`Confidence: ${item.confidence}`);
      lines.push('');
    });
    return lines.join('\n');
  }

  function formatCitationAuditHtml(audit = lastAudit) {
    if (!audit) return '<p>No AI citation audit yet.</p>';
    if (!audit.ok) return `<h4>AI citation audit failed</h4><p>${escapeHtml(audit.error || 'Unknown error')}</p>`;
    const html = [
      '<div class="citation-audit-report">',
      '<h4>AI citation audit</h4>',
      `<p>${escapeHtml(audit.summary || `Audit items: ${audit.items.length}`)}</p>`,
      '<ol>'
    ];
    audit.items.forEach((item) => {
      html.push('<li>');
      html.push(`<strong>[${escapeHtml(item.severity || 'info')}] ${escapeHtml(item.key || '(general)')}</strong>`);
      html.push(`<div><span class="muted">Issue:</span> ${escapeHtml(item.issue || '(none)')}</div>`);
      html.push(`<div><span class="muted">Suggestion:</span> ${escapeHtml(item.suggestion || '(none)')}</div>`);
      if (item.link) html.push(`<div><span class="muted">Link:</span> ${anchor(item.link, item.link)}</div>`);
      if (item.confidence) html.push(`<div><span class="muted">Confidence:</span> ${escapeHtml(item.confidence)}</div>`);
      html.push('</li>');
    });
    html.push('</ol>', '</div>');
    return html.join('');
  }

  async function runCitationAudit() {
    const report = buildCitationReport();
    renderSummary(report);
    if (!NS.AIProvider?.ask) { setStatus('AIProvider is not loaded.'); return null; }
    setStatus('Running AI citation audit from local verifier report...');
    try {
      const prompt = await loadCitationAuditPrompt();
      const input = [prompt, '', '--- Local citation verifier report ---', formatReport(report), '', '--- Structured citation audit payload ---', JSON.stringify(citationAuditPayload(report), null, 2)].join('\n');
      const response = await NS.AIProvider.ask({
        instructions: 'Return JSON only. No markdown fences. No prose outside JSON.',
        input,
        temperature: 0.05,
        maxOutputTokens: 7000,
        citationAudit: { promptFile: CITATION_AUDIT_PROMPT_PATH, summary: report.summary }
      }, { task: 'latex-citation-ai-audit', context: { workflow: 'citation-ai-audit', promptFile: CITATION_AUDIT_PROMPT_PATH } });
      const raw = NS.AIProvider.extractText(response);
      lastAudit = parseCitationAudit(raw);
      setOutputHtml(formatCitationAuditHtml(lastAudit));
      setStatus(lastAudit.ok ? `AI citation audit returned ${lastAudit.items.length} item(s).` : lastAudit.error);
      return lastAudit;
    } catch (err) {
      setStatus(`AI citation audit failed: ${err?.message || err}`);
      return null;
    }
  }

  async function verifyLinksAndAudit() {
    verifyCitations();
    showCitationLinks();
    return runCitationAudit();
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
      '    <button id="showCitationLinksBtn" class="btn mini" type="button">Show online links</button>',
      '    <button id="runCitationAuditBtn" class="btn mini primary" type="button">Run AI audit</button>',
      '    <button id="verifyLinksAuditBtn" class="btn mini" type="button">Verify + links + audit</button>',
      '    <button id="copyCitationVerifierBtn" class="btn mini" type="button">Copy report</button>',
      '  </div>',
      '  <div id="citationVerifierStatus" class="citation-verifier-status">Local citation verifier ready.</div>',
      '  <div id="citationVerifierSummary" class="citation-verifier-summary"></div>',
      '  <div id="citationVerifierOutput" class="citation-verifier-output" role="region" aria-label="Citation verifier output"></div>',
      '</div>'
    ].join('');

    const citationCard = el('citationAiCard');
    if (citationCard?.parentElement === panel && citationCard.nextSibling) panel.insertBefore(card, citationCard.nextSibling);
    else panel.appendChild(card);

    bindControls();
    return true;
  }

  function bindControls() {
    el('verifyCitationsBtn')?.addEventListener('click', verifyCitations, true);
    el('repairMissingBibtexBtn')?.addEventListener('click', repairMissingBibtex, true);
    el('verifyRepairMissingBibtexBtn')?.addEventListener('click', verifyAndRepairMissingBibtex, true);
    el('showCitationLinksBtn')?.addEventListener('click', showCitationLinks, true);
    el('runCitationAuditBtn')?.addEventListener('click', runCitationAudit, true);
    el('verifyLinksAuditBtn')?.addEventListener('click', verifyLinksAndAudit, true);
    el('copyCitationVerifierBtn')?.addEventListener('click', copyVerifierReport, true);
    el('citationVerifierOutput')?.addEventListener('click', handleVerifierLinkClick, true);
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
    entryOnlineLinks,
    fallbackSearchUrl,
    citationLinkReport,
    citationLinkReportHtml,
    showCitationLinks,
    citationAuditPayload,
    parseCitationAudit,
    formatCitationAuditHtml,
    handleVerifierLinkClick,
    runCitationAudit,
    verifyLinksAndAudit,
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
