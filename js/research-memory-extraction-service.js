/* Latexai Stage 18Y ResearchMemoryExtractionService
 * Stage: stage18y-notation-citation-memory-extraction-20260524-1
 *
 * Hidden research-specific memory extraction for Latexai.
 * No UI: extracts notation, citation, reviewer concern, and negative-memory facts
 * from LaTeX source plus review/rebuttal/edit outputs, then writes them to the
 * configured memory backend through caller-provided memoryPost().
 */
(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage18y-notation-citation-memory-extraction-20260524-1';

  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function compact(value, max = 700) { return clean(value).slice(0, max); }
  function asArray(value) { return Array.isArray(value) ? value : []; }

  function defaultHash(value) {
    const s = String(value || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  function stripLatexComments(text) {
    return String(text || '').replace(/(^|[^\\])%.*$/gm, '$1');
  }

  function pushUnique(list, seen, item) {
    const value = compact(item && item.value, 1200);
    if (!value) return;
    const type = clean(item.factType || item.type || 'research_memory');
    const key = `${type}|${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({
      scope: item.scope || 'paper',
      factType: type,
      keySeed: item.keySeed || key,
      value,
      confidence: Number.isFinite(item.confidence) ? item.confidence : 0.72,
      importance: Number.isFinite(item.importance) ? item.importance : 0.68,
      status: item.status || 'active',
      metadata: item.metadata || {}
    });
  }

  function splitCsvKeys(value) {
    return String(value || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => /^[A-Za-z0-9_:\-.\/]+$/.test(x));
  }

  function extractCitationKeys(sourceText) {
    const text = stripLatexComments(sourceText);
    const keys = [];
    const seen = new Set();
    const citeRe = /\\(?:cite|citet|citep|citealp|citealt|citeauthor|citeyear|parencite|textcite|autocite|footcite|supercite)\*?(?:\[[^\]]*\])*\s*\{([^{}]{1,800})\}/g;
    let match;
    while ((match = citeRe.exec(text))) {
      for (const key of splitCsvKeys(match[1])) {
        if (seen.has(key)) continue;
        seen.add(key);
        keys.push(key);
      }
    }
    const bibitemRe = /\\bibitem(?:\[[^\]]*\])?\s*\{([^{}]{1,160})\}/g;
    while ((match = bibitemRe.exec(text))) {
      const key = clean(match[1]);
      if (key && !seen.has(key)) { seen.add(key); keys.push(key); }
    }
    return keys.slice(0, 160);
  }

  function extractBibliographyFiles(sourceText) {
    const text = stripLatexComments(sourceText);
    const files = [];
    const seen = new Set();
    const re = /\\(?:bibliography|addbibresource)\s*(?:\[[^\]]*\])?\s*\{([^{}]{1,500})\}/g;
    let match;
    while ((match = re.exec(text))) {
      for (const raw of String(match[1] || '').split(',')) {
        const file = clean(raw).replace(/\.bib$/i, '');
        if (!file || seen.has(file)) continue;
        seen.add(file); files.push(file);
      }
    }
    return files.slice(0, 40);
  }

  function extractTheoremEnvironments(sourceText) {
    const text = stripLatexComments(sourceText);
    const out = [];
    const seen = new Set();
    const re = /\\newtheorem\s*\{([^{}]{1,80})\}\s*(?:\[[^\]]*\])?\s*\{([^{}]{1,120})\}/g;
    let match;
    while ((match = re.exec(text))) {
      const env = clean(match[1]);
      const label = clean(match[2]);
      const key = `${env}|${label}`;
      if (!env || seen.has(key)) continue;
      seen.add(key);
      out.push({ env, label });
    }
    return out.slice(0, 40);
  }

  function extractMacroDefinitions(sourceText) {
    const text = stripLatexComments(sourceText);
    const macros = [];
    const seen = new Set();
    const patterns = [
      /\\(?:newcommand|renewcommand|providecommand)\s*\{?\\([A-Za-z@]+)\}?\s*(?:\[[^\]]*\]){0,2}\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*){0,2})\}/g,
      /\\DeclareMathOperator\*?\s*\{\\([A-Za-z@]+)\}\s*\{([^{}]{0,200})\}/g,
      /\\def\s*\\([A-Za-z@]+)(?:#[0-9])?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*){0,2})\}/g
    ];
    for (const re of patterns) {
      let match;
      while ((match = re.exec(text))) {
        const name = clean(match[1]);
        const def = clean(match[2]);
        if (!name || name.length > 60) continue;
        const key = `${name}|${def}`;
        if (seen.has(key)) continue;
        seen.add(key);
        macros.push({ name: `\\${name}`, definition: def.slice(0, 220) });
      }
    }
    return macros.slice(0, 60);
  }

  function extractLabelSummary(sourceText) {
    const text = stripLatexComments(sourceText);
    const counts = {};
    const examples = {};
    const re = /\\label\s*\{([^{}]{1,180})\}/g;
    let match;
    while ((match = re.exec(text))) {
      const label = clean(match[1]);
      if (!label) continue;
      const prefix = label.includes(':') ? label.split(':')[0] : 'unprefixed';
      counts[prefix] = (counts[prefix] || 0) + 1;
      if (!examples[prefix]) examples[prefix] = [];
      if (examples[prefix].length < 5) examples[prefix].push(label);
    }
    return { counts, examples, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  }

  function extractNotationLikeSentences(sourceText) {
    const raw = stripLatexComments(sourceText).replace(/\r/g, '\n');
    const candidates = [];
    const re = /([^.!?\n]{0,180}(?:denote|denotes|where|let|notation|write|defined as|is defined)[^.!?\n]{10,260}[.!?]?)/gi;
    let match;
    while ((match = re.exec(raw))) {
      const s = clean(match[1]);
      if (s.length < 35) continue;
      if (!/[\\$][A-Za-z0-9\\{}_^\-+\s]+[\\$]?/.test(s) && !/\\[A-Za-z]+/.test(s)) continue;
      candidates.push(s);
      if (candidates.length >= 16) break;
    }
    return candidates;
  }

  function extractLatexFacts(sourceText, options = {}) {
    const list = [];
    const seen = new Set();
    const source = String(sourceText || '');
    if (!source.trim()) return list;

    const citationKeys = extractCitationKeys(source);
    if (citationKeys.length) {
      const chunks = [];
      for (let i = 0; i < citationKeys.length; i += 45) chunks.push(citationKeys.slice(i, i + 45));
      chunks.slice(0, 4).forEach((chunk, index) => pushUnique(list, seen, {
        factType: 'citation_keys_used',
        value: `Citation keys already used in the LaTeX source${chunks.length > 1 ? `, chunk ${index + 1}` : ''}: ${chunk.join(', ')}`,
        confidence: 0.92,
        importance: 0.72,
        metadata: { extractor: 'latex-cite-regex', count: chunk.length, total: citationKeys.length }
      }));
    }

    const bibFiles = extractBibliographyFiles(source);
    if (bibFiles.length) pushUnique(list, seen, {
      factType: 'bibliography_files_used',
      value: `Bibliography files/resources used by this paper: ${bibFiles.join(', ')}`,
      confidence: 0.92,
      importance: 0.68,
      metadata: { extractor: 'latex-bibliography-regex', count: bibFiles.length }
    });

    extractTheoremEnvironments(source).forEach((env) => pushUnique(list, seen, {
      factType: 'theorem_environment',
      value: `The paper defines theorem-like environment ${env.env}${env.label ? ` displayed as “${env.label}”` : ''}.`,
      confidence: 0.9,
      importance: 0.72,
      metadata: { extractor: 'newtheorem-regex', env: env.env, label: env.label }
    }));

    extractMacroDefinitions(source).forEach((macro) => pushUnique(list, seen, {
      factType: 'notation_macro_definition',
      value: `Notation/macro definition: ${macro.name}${macro.definition ? ` := ${macro.definition}` : ''}`,
      confidence: 0.86,
      importance: 0.78,
      metadata: { extractor: 'macro-definition-regex', macro: macro.name }
    }));

    extractNotationLikeSentences(source).forEach((sentence, index) => pushUnique(list, seen, {
      factType: 'notation_sentence',
      value: `Potential notation convention from source: ${sentence}`,
      confidence: 0.62,
      importance: 0.58,
      metadata: { extractor: 'notation-sentence-heuristic', index }
    }));

    const labels = extractLabelSummary(source);
    if (labels.total) pushUnique(list, seen, {
      factType: 'latex_label_inventory',
      value: `LaTeX label inventory: ${Object.entries(labels.counts).map(([k, v]) => `${k}:${v}`).join(', ')}. Examples: ${Object.entries(labels.examples).slice(0, 8).map(([k, vals]) => `${k}=[${vals.join(', ')}]`).join('; ')}`,
      confidence: 0.88,
      importance: 0.58,
      metadata: { extractor: 'label-regex', total: labels.total, counts: labels.counts }
    });

    if (options.targetVenue) pushUnique(list, seen, {
      factType: 'target_venue_memory',
      value: `Current target venue/context mentioned for this workflow: ${compact(options.targetVenue, 180)}`,
      confidence: 0.84,
      importance: 0.7,
      metadata: { extractor: 'payload-target-venue' }
    });

    return list;
  }

  function meaningfulReportLines(reportText) {
    const text = String(reportText || '').replace(/```[\s\S]*?```/g, ' ');
    return text
      .split(/\r?\n+/)
      .map((line) => line.replace(/^\s*(?:[-*+]|\d+\.|#{1,6}|>)+\s*/, '').replace(/^\s*\|?\s*/, '').trim())
      .map((line) => line.replace(/\s*\|\s*/g, ' | '))
      .filter((line) => line.length >= 32 && line.length <= 650)
      .filter((line) => !/^[-:|\s]+$/.test(line))
      .filter((line) => !/^\{/.test(line) && !/^\[/.test(line));
  }

  function scoreLine(line, pattern) {
    const text = String(line || '').toLowerCase();
    return pattern.test(text);
  }

  function extractReportFacts(reportText, options = {}) {
    const list = [];
    const seen = new Set();
    const lines = meaningfulReportLines(reportText);
    const addLimited = (type, pattern, prefix, confidence, importance, limit, metadata = {}) => {
      let count = 0;
      for (const line of lines) {
        if (!scoreLine(line, pattern)) continue;
        pushUnique(list, seen, {
          factType: type,
          value: `${prefix}: ${line}`,
          confidence,
          importance,
          metadata: { extractor: 'report-line-heuristic', ...metadata }
        });
        count += 1;
        if (count >= limit) break;
      }
    };

    addLimited(
      'recurring_reviewer_concern',
      /\b(weakness|concern|limitation|unclear|missing|insufficient|needs?|should|must|risk|critic|problem|gap|lack|unsupported|overclaim|unconvincing)\b/,
      'Reviewer/report concern worth remembering',
      0.7,
      0.78,
      12,
      { workflow: options.stepName || '' }
    );

    addLimited(
      'citation_gap_or_related_work_memory',
      /\b(citation|cite|cited|reference|related work|prior work|baseline|compare|comparison|literature|missing paper|competitor|source id|\[s\d+\])\b/,
      'Citation/related-work memory',
      0.72,
      0.82,
      10,
      { workflow: options.stepName || '' }
    );

    addLimited(
      'notation_or_symbol_concern',
      /\b(notation|symbol|ambiguous|conflict|overload|reuse|defined|definition|denote|denotes|macro|variable)\b/,
      'Notation/symbol issue or convention',
      0.69,
      0.78,
      8,
      { workflow: options.stepName || '' }
    );

    addLimited(
      'proof_or_theorem_concern',
      /\b(theorem|lemma|proposition|corollary|proof|assumption|condition|bound|rate|constant|claim|derivation|step)\b/,
      'Proof/theorem concern',
      0.68,
      0.8,
      10,
      { workflow: options.stepName || '' }
    );

    addLimited(
      'negative_memory_candidate',
      /\b(do not|don't|avoid|should not|must not|not recommend|rejected|failed|fails|abandoned|not useful|too aggressive|do not repeat|should avoid)\b/,
      'Potential negative memory / avoid repeating this direction',
      0.66,
      0.86,
      8,
      { workflow: options.stepName || '' }
    );

    const urls = asArray(options.competitorUrls).map(clean).filter(Boolean).slice(0, 20);
    if (urls.length) pushUnique(list, seen, {
      factType: 'competitor_reference_seeds',
      value: `Competitor/reference URL seeds used for this paper: ${urls.join(' ; ')}`,
      confidence: 0.9,
      importance: 0.76,
      metadata: { extractor: 'payload-competitor-urls', count: urls.length }
    });

    if (options.targetVenue) pushUnique(list, seen, {
      factType: 'target_venue_memory',
      value: `Target venue/context used in this workflow: ${compact(options.targetVenue, 180)}`,
      confidence: 0.86,
      importance: 0.7,
      metadata: { extractor: 'payload-target-venue' }
    });

    return list;
  }

  function summarizeFactCounts(facts) {
    const counts = {};
    for (const f of facts || []) counts[f.factType] = (counts[f.factType] || 0) + 1;
    return Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(', ');
  }

  async function saveResearchMemories(config = {}) {
    const memoryPost = config.memoryPost;
    const ids = config.ids || {};
    if (typeof memoryPost !== 'function' || !ids.projectId || !ids.paperId) return { ok: false, skipped: 'missing memoryPost or identity' };
    const hash = typeof config.stableHash === 'function' ? config.stableHash : defaultHash;
    const sourceText = String(config.sourceText || '');
    const reportText = String(config.reportText || '');
    const payload = config.payload || {};
    const stepName = clean(config.stepName || 'research-memory-extraction');
    const source = clean(config.source || 'research-memory-extraction-service');
    const baseMetadata = { stage: STAGE, callerStage: config.stage || '', stepName, ...(config.metadata || {}) };
    const options = {
      stepName,
      targetVenue: payload.targetVenue || payload.venue || payload.target || config.targetVenue || '',
      competitorUrls: payload.competitorUrls || payload.urls || config.competitorUrls || []
    };

    const facts = [];
    const seen = new Set();
    [...extractLatexFacts(sourceText, options), ...extractReportFacts(reportText, options)].forEach((item) => pushUnique(facts, seen, item));
    const limited = facts.slice(0, Number(config.maxFacts || 36));
    const created = [];

    for (const fact of limited) {
      const key = `research:${fact.factType}:${hash([ids.projectId, ids.paperId, stepName, fact.keySeed || fact.value].join('\n'))}`;
      const saved = await memoryPost('/fact', {
        userId: ids.userId || 'local-user',
        projectId: ids.projectId,
        paperId: ids.paperId,
        sectionId: ids.sectionId,
        sessionId: ids.sessionId,
        source,
        scope: fact.scope || 'paper',
        factType: fact.factType,
        key,
        value: fact.value,
        confidence: fact.confidence,
        importance: fact.importance,
        status: fact.status || 'active',
        metadata: { ...baseMetadata, ...(fact.metadata || {}) }
      });
      if (saved?.id) created.push({ ...fact, id: saved.id });
    }

    const parentFactId = config.parentFactId || '';
    if (parentFactId && created.length) {
      await Promise.all(created.slice(0, 18).map((fact) => memoryPost('/edge', {
        fromMemoryId: fact.id,
        toMemoryId: parentFactId,
        relation: 'extracted_from_workflow_memory',
        weight: fact.factType === 'negative_memory_candidate' ? 0.86 : fact.factType === 'citation_gap_or_related_work_memory' ? 0.82 : 0.76,
        evidence: `Stage 18Y extracted ${fact.factType} during ${stepName}.`,
        metadata: baseMetadata
      })));
    }

    if (created.length) {
      await memoryPost('/summary', {
        userId: ids.userId || 'local-user',
        projectId: ids.projectId,
        paperId: ids.paperId,
        sessionId: ids.sessionId,
        source,
        scope: 'paper',
        summaryType: 'research_memory_extraction_state',
        content: `Stage 18Y extracted ${created.length} research-specific memory fact(s) during ${stepName}. Fact types: ${summarizeFactCounts(created)}.`,
        metadata: baseMetadata
      });
    }

    return { ok: true, createdCount: created.length, attemptedCount: limited.length, factTypes: summarizeFactCounts(created), facts: created };
  }

  NS.ResearchMemoryExtractionService = {
    STAGE,
    extractLatexFacts,
    extractReportFacts,
    saveResearchMemories,
    extractCitationKeys,
    extractMacroDefinitions,
    extractTheoremEnvironments,
    extractLabelSummary
  };

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
