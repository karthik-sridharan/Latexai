/* Latexai Stage 17O DevilsAdvocateDebateService
 * Stage: stage17s-lai-insertion-safety-1
 *
 * Devil's advocate paper debate workflow:
 * - one AI agent argues for the current draft;
 * - one AI agent critiques the current draft;
 * - the user controls the number of back-and-forth rounds;
 * - a final synthesis agent turns the debate into a balanced improvement plan;
 * - each agent can use its own provider/model, with defaults copied from the current AI controls.
 *
 * This workflow calls AI. It does not compile.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage17s-lai-insertion-safety-1';
  const PROMPT_PATH = 'prompt/ai-devils-advocate-debate.txt';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('devils-advocate-debate-service')) {
    NS.DevilsAdvocateDebateService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  let promptCache = '';
  let lastTranscript = null;
  let lastSynthesis = '';
  let lastPayload = null;
  let cancelled = false;

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

  function updateActiveSource(path, text) {
    const normalized = normalizePath(path);
    try {
      if (State()?.updateFile) State().updateFile(normalized, text);
      else {
        const file = getFile(normalized);
        if (file) file.text = text;
      }
    } catch (_err) {
      const file = getFile(normalized);
      if (file) file.text = text;
    }

    const editor = el('sourceEditor');
    if (editor) {
      editor.value = text;
      try { editor.dispatchEvent(new Event('input', { bubbles: true })); } catch (_err) {}
    }

    try { NS.Editor?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
  }

  function currentProviderModel() {
    return {
      provider: clean(el('aiProvider')?.value || 'openai'),
      model: clean(el('aiModel')?.value || 'gpt-4.1-mini')
    };
  }

  function setProviderModel(route) {
    const provider = clean(route?.provider);
    const model = clean(route?.model);
    const providerEl = el('aiProvider');
    const modelEl = el('aiModel');

    if (providerEl && provider) {
      providerEl.value = provider;
      try { providerEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
    }

    if (modelEl && model) {
      let option = Array.from(modelEl.options || []).find((opt) => opt.value === model);
      if (!option && modelEl.tagName === 'SELECT') {
        option = D.createElement('option');
        option.value = model;
        option.textContent = model;
        option.dataset.stage16d = 'custom-agent-model';
        modelEl.appendChild(option);
      }
      modelEl.value = model;
      try { modelEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (_err) {}
    }
  }

  async function askAsAgent(agent, payload, meta) {
    if (!NS.AIProvider?.ask) throw new Error('AIProvider is not loaded. Check feature flags and safe mode.');

    const before = currentProviderModel();
    try {
      setProviderModel(agent);
      const explicitPayload = {
        ...(payload || {}),
        provider: agent.provider,
        model: agent.model,
        agentProvider: agent.provider,
        agentModel: agent.model,
        modelRoutingBypass: true,
        agentModelRoutingBypass: true,
        modelRoutingBypassReason: 'Stage 17H devil debate uses the visible per-agent provider/model row.'
      };
      const response = await NS.AIProvider.ask(explicitPayload, {
        task: meta.task || 'latex-paper-debate',
        provider: agent.provider,
        model: agent.model,
        modelRoutingBypass: true,
        context: {
          workflow: 'devils-advocate-paper-debate',
          agentRole: agent.role,
          promptFile: PROMPT_PATH,
          provider: agent.provider,
          model: agent.model,
          modelRoutingBypass: true,
          modelRoutingBypassReason: 'Stage 17H devil debate uses the visible per-agent provider/model row.',
          ...meta.context
        }
      });
      return NS.AIProvider.extractText ? NS.AIProvider.extractText(response) : String(response || '');
    } finally {
      setProviderModel(before);
    }
  }

  function draftExcerpt(text, maxChars = 45000) {
    const s = String(text || '');
    if (s.length <= maxChars) return s;
    const head = s.slice(0, Math.floor(maxChars * 0.65));
    const tail = s.slice(-Math.floor(maxChars * 0.35));
    return `${head}\n\n% ... [middle omitted for debate prompt] ...\n\n${tail}`;
  }

  function clampRounds(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 2;
    return Math.max(1, Math.min(Math.round(n), 6));
  }

  function agentFromUi(prefix, role) {
    return {
      role,
      provider: clean(el(`${prefix}Provider`)?.value || currentProviderModel().provider),
      model: clean(el(`${prefix}Model`)?.value || currentProviderModel().model)
    };
  }

  function buildPayload() {
    const active = activeSource();
    const rounds = clampRounds(el('debateRounds')?.value);
    const topic = clean(el('debateTopic')?.value) || 'overall paper quality and acceptance chances';
    const venue = clean(el('debateTargetVenue')?.value);
    const audience = clean(el('debateTargetAudience')?.value);
    const instructions = clean(el('debateExtraInstructions')?.value);
    const agents = {
      advocate: agentFromUi('advocateAgent', 'advocate'),
      critic: agentFromUi('criticAgent', 'critic'),
      synthesizer: agentFromUi('synthAgent', 'synthesizer')
    };

    return {
      schema: 'latexai-devils-advocate-debate-request-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      activePath: active.path,
      rootPath: rootPath(),
      rounds,
      topic,
      targetVenue: venue,
      targetAudience: audience,
      extraInstructions: instructions,
      agents,
      draftExcerpt: draftExcerpt(active.text)
    };
  }

  function validatePayload(payload) {
    const errors = [];
    if (!payload.draftExcerpt.trim()) errors.push('Active source file is empty.');
    if (!payload.agents.advocate.model) errors.push('Advocate model is empty.');
    if (!payload.agents.critic.model) errors.push('Critic model is empty.');
    if (!payload.agents.synthesizer.model) errors.push('Synthesizer model is empty.');
    return errors;
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
      "You are running a devil\'s advocate debate about a LaTeX research paper.",
      'Advocate: make the strongest case for the current draft.',
      'Critic: make the strongest critical case against the current draft.',
      'Synthesizer: produce a balanced improvement plan using both sides.',
      'Be concrete, section-specific, and constructive.',
      'The final synthesis should include a fenced latexai_actionable_edits JSON block with exact oldText/newText edits for \\laiold/\\lai insertion.'
    ].join('\n');
  }

  function transcriptToMarkdown(transcript) {
    const lines = ['# Devil’s advocate debate transcript', ''];
    for (const turn of transcript || []) {
      lines.push(`## Round ${turn.round}: ${turn.role}`);
      lines.push('');
      lines.push(turn.text || '');
      lines.push('');
    }
    return lines.join('\n');
  }

  function currentDebateContext(payload, transcript) {
    return [
      '--- Debate setup ---',
      JSON.stringify({
        topic: payload.topic,
        targetVenue: payload.targetVenue,
        targetAudience: payload.targetAudience,
        extraInstructions: payload.extraInstructions,
        roundCount: payload.rounds
      }, null, 2),
      '',
      '--- Draft excerpt ---',
      payload.draftExcerpt,
      '',
      '--- Transcript so far ---',
      transcriptToMarkdown(transcript)
    ].join('\n');
  }

  async function runDebate() {
    cancelled = false;
    lastSynthesis = '';
    lastTranscript = [];
    const payload = buildPayload();
    const errors = validatePayload(payload);
    if (errors.length) {
      setStatus(errors.join(' '));
      setOutput(`Cannot run debate:\n\n${errors.map((e) => `- ${e}`).join('\n')}`);
      return { ok: false, errors };
    }

    lastPayload = payload;
    const developerPrompt = await loadPrompt();

    setStatus(`Starting ${payload.rounds}-round paper debate...`);
    renderTranscript();

    try {
      for (let round = 1; round <= payload.rounds; round += 1) {
        if (cancelled) throw new Error('Debate cancelled.');

        setStatus(`Round ${round}/${payload.rounds}: advocate is arguing for the draft using ${payload.agents.advocate.provider}/${payload.agents.advocate.model}...`);
        const advocateText = await askAsAgent(payload.agents.advocate, {
          instructions: [
            developerPrompt,
            '',
            'You are the ADVOCATE agent. Argue in favor of the current draft.',
            'Defend novelty, technical value, clarity, positioning, and acceptance chances.',
            'Acknowledge weaknesses only when it strengthens the defense.',
            'Return Markdown. No JSON.'
          ].join('\n'),
          input: currentDebateContext(payload, lastTranscript),
          temperature: 0.35,
          maxOutputTokens: 3500,
          debateAgent: { role: 'advocate', round, totalRounds: payload.rounds }
        }, { task: 'latex-paper-debate-advocate' });

        lastTranscript.push({ round, role: 'advocate', provider: payload.agents.advocate.provider, model: payload.agents.advocate.model, text: advocateText.trim() });
        renderTranscript();

        if (cancelled) throw new Error('Debate cancelled.');

        setStatus(`Round ${round}/${payload.rounds}: critic is challenging the draft using ${payload.agents.critic.provider}/${payload.agents.critic.model}...`);
        const criticText = await askAsAgent(payload.agents.critic, {
          instructions: [
            developerPrompt,
            '',
            'You are the CRITIC agent. Act as a very critical reviewer.',
            'Find weaknesses in novelty, correctness, assumptions, related work, clarity, and positioning.',
            'Respond directly to the advocate when useful.',
            'Return Markdown. No JSON.'
          ].join('\n'),
          input: currentDebateContext(payload, lastTranscript),
          temperature: 0.35,
          maxOutputTokens: 3500,
          debateAgent: { role: 'critic', round, totalRounds: payload.rounds }
        }, { task: 'latex-paper-debate-critic' });

        lastTranscript.push({ round, role: 'critic', provider: payload.agents.critic.provider, model: payload.agents.critic.model, text: criticText.trim() });
        renderTranscript();
      }

      if (cancelled) throw new Error('Debate cancelled.');

      setStatus(`Synthesizer is producing the balanced improvement plan using ${payload.agents.synthesizer.provider}/${payload.agents.synthesizer.model}...`);
      lastSynthesis = await askAsAgent(payload.agents.synthesizer, {
        instructions: [
          developerPrompt,
          '',
          'You are the SYNTHESIZER agent.',
          'Use both the advocate and critic arguments to produce a balanced, constructive improvement plan.',
          'Return Markdown with: summary, strongest positives, most serious risks, prioritized edits, citation/related-work fixes, theorem/proof fixes, predicted acceptance impact, and suggested visible \\lai edits.',
          'Also include one fenced code block labelled latexai_actionable_edits.',
          'That block must be JSON with schema {\"actionableEdits\":[{\"mode\":\"replace|insert_after|insert_before\",\"path\":\"optional tex path\",\"targetHint\":\"section or paragraph hint\",\"oldText\":\"exact source substring for replace/anchor\",\"newText\":\"LaTeX replacement or insertion\",\"confidence\":0.0}],\"appendPlan\":\"optional high-level LaTeX plan\"}.',
          'For replace edits, oldText must be copied exactly from the draft excerpt when possible so Latexai can insert \\laiold{oldText} and \\lai{newText} at the right location.',
          'newText must be a compile-safe LaTeX body fragment: no Markdown fences, no preamble commands, no \\begin{document}/\\end{document}, balanced braces/environments, and text-mode special characters escaped.',
          'Do not target the document preamble; if a suggestion cannot be localized in the document body safely, put it in appendPlan rather than inventing an oldText.'
        ].join('\n'),
        input: currentDebateContext(payload, lastTranscript),
        temperature: 0.2,
        maxOutputTokens: 5500,
        debateAgent: { role: 'synthesizer', round: 'final', totalRounds: payload.rounds }
      }, { task: 'latex-paper-debate-synthesizer' });

      setOutput(formatFullReport());
      setStatus('Devil’s advocate debate complete.');
      return { ok: true, transcript: lastTranscript, synthesis: lastSynthesis, payload };
    } catch (err) {
      const message = err?.message || String(err);
      setStatus(`Debate stopped: ${message}`);
      setOutput(formatFullReport() || `Debate stopped:\n\n${message}`);
      return { ok: false, error: message, transcript: lastTranscript, synthesis: lastSynthesis, payload };
    }
  }

  function cancelDebate() {
    cancelled = true;
    setStatus('Cancel requested. The current AI call may finish before stopping.');
  }

  function formatFullReport() {
    if (!lastPayload && !lastTranscript?.length && !lastSynthesis) return '';
    const payload = lastPayload || buildPayload();
    return [
      '# Devil’s advocate paper debate',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Stage: ${STAGE}`,
      `Active file: ${payload.activePath}`,
      `Target venue: ${payload.targetVenue || '(not specified)'}`,
      `Target audience: ${payload.targetAudience || '(not specified)'}`,
      `Topic: ${payload.topic}`,
      `Rounds: ${payload.rounds}`,
      '',
      '## Agents',
      '',
      `- Advocate: ${payload.agents.advocate.provider} / ${payload.agents.advocate.model}`,
      `- Critic: ${payload.agents.critic.provider} / ${payload.agents.critic.model}`,
      `- Synthesizer: ${payload.agents.synthesizer.provider} / ${payload.agents.synthesizer.model}`,
      '',
      '## Final synthesis',
      '',
      lastSynthesis || '(not generated yet)',
      '',
      '## Debate transcript',
      '',
      transcriptToMarkdown(lastTranscript)
    ].join('\n');
  }

  function reportFilename() {
    const date = new Date().toISOString().slice(0, 10);
    const venue = clean(el('debateTargetVenue')?.value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const suffix = venue ? `-${venue}` : '';
    return normalizePath(`reviews/devils-advocate-debate-${date}${suffix}.md`);
  }

  function addReportToProject() {
    const report = formatFullReport();
    if (!report.trim()) {
      setStatus('Run a debate first.');
      return { ok: false, error: 'No debate report' };
    }
    const path = writeProjectFile(reportFilename(), report + '\n');
    setStatus(`Added debate report to ${path}.`);
    return { ok: true, path };
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
    if (next !== text) updateActiveOrProjectSource(rootPath(), next);
    return true;
  }

  function updateActiveOrProjectSource(path, text) {
    const normalized = normalizePath(path);
    if (normalized === normalizePath(activePath())) updateActiveSource(normalized, text);
    else {
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
      try { NS.Editor?.render?.(); } catch (_err) {}
      try { NS.FileTree?.render?.(); } catch (_err) {}
      try { State()?.save?.(); } catch (_err) {}
      try { NS.Preview?.scheduleDraftPreview?.(); } catch (_err) {}
    }
  }

  function insertBeforeEndDocument(tex, insertion) {
    const s = String(tex || '');
    const marker = '\\end{document}';
    const at = s.lastIndexOf(marker);
    const block = `\n\n${String(insertion || '').trim()}\n\n`;
    if (at >= 0) return s.slice(0, at).replace(/\s*$/, '') + block + s.slice(at);
    return s.replace(/\s*$/, '') + block;
  }


  function refreshPaperAiReview(paths, source = "Devil's Advocate") {
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
      try { console.warn('[Latexai] could not refresh paper AI review after devil’s advocate insertion', err); } catch (_err) {}
    }
    return null;
  }

  function workflowBlockHeader(id, path, extra = '') {
    return `% BEGIN LAI-ACTIONABLE-EDIT id=${safeMetaValue(id)} workflow=devils-advocate path=${safeMetaValue(path)}${extra ? ` ${latexCommentText(extra, 120)}` : ''}`;
  }

  function workflowBlockFooter(id) {
    return `% END LAI-ACTIONABLE-EDIT id=${id}`;
  }

  function wrapLaiPlanBlock(laiBlock, path) {
    const id = `lai-devils-plan-${Date.now().toString(36)}`;
    return [workflowBlockHeader(id, normalizePath(path), 'mode=append-plan'), "% LAI target: end-of-paper devil's advocate improvement plan", String(laiBlock || '').trim(), workflowBlockFooter(id)].join('\n');
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
    const fenceRe = /```(?:json|latexai_actionable_edits)?\s*([\s\S]*?)```/gi;
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
    return { mode, path, oldText, newText, targetHint, confidence: Number.isFinite(confidence) ? confidence : null };
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
    const id = `lai-devils-${Date.now().toString(36)}-${index}`;
    const oldText = String(edit.oldText || '').trim();
    const oldIssue = edit.mode === 'replace' ? validateMacroArgument(oldText, 'oldText') : '';
    if (oldIssue) return { ok: false, reason: oldIssue, text: '' };
    const prepared = prepareActionableNewLatex(edit.newText || '');
    if (!prepared.ok) return prepared;
    const header = workflowBlockHeader(id, edit.path, `mode=${edit.mode}`);
    const hint = edit.targetHint ? `% LAI target: ${latexCommentText(edit.targetHint)}` : '';
    const footer = workflowBlockFooter(id);
    if (edit.mode === 'replace') {
      return { ok: true, reason: '', text: [header, hint, '\\laiold{', oldText, '}', '\\lai{', prepared.text, '}', footer].filter(Boolean).join('\n') };
    }
    return { ok: true, reason: '', text: [header, hint, '\\lai{', prepared.text, '}', footer].filter(Boolean).join('\n') };
  }

  function insertActionableEditsAtMatches() {
    if (!lastSynthesis.trim()) {
      setStatus('Run a debate and synthesis first.');
      return { ok: false, error: 'No synthesis' };
    }

    ensureRootLaiMacros();
    const parsed = extractActionableEdits(lastSynthesis);
    if (!parsed.edits.length) {
      setStatus('No exact actionable edit JSON or \\laiold/\\lai pairs found. Use Append \\lai plan instead.');
      return { ok: false, applied: 0, skipped: 0, source: parsed.source };
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
      const start = at;
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
      updateActiveOrProjectSource(path, text);
    }

    const modifiedPaths = [...queued.keys()];
    refreshPaperAiReview(modifiedPaths, "Devil's Advocate");
    setStatus(`Inserted ${applied} devil’s advocate \\lai edit(s) at exact matches; skipped ${skipped}. Paper-level edit review refreshed.`);
    setOutput([formatFullReport(), '', '--- Latexai actionable edit insertion report ---', `Source: ${parsed.source}`, `Applied: ${applied}`, `Skipped: ${skipped}`, ...messages].join('\n'));
    return { ok: applied > 0, applied, skipped, messages, source: parsed.source, paths: [...queued.keys()] };
  }

  function appendLaiImprovementPlan() {
    if (!lastSynthesis.trim()) {
      setStatus('Run a debate and synthesis first.');
      return { ok: false, error: 'No synthesis' };
    }

    ensureRootLaiMacros();
    const root = getFile(rootPath());
    const active = root ? { path: rootPath(), file: root, text: fileText(root) } : activeSource();
    const parsed = extractActionableEdits(lastSynthesis);
    const planText = parsed.appendPlan && parsed.appendPlan.trim() ? parsed.appendPlan : lastSynthesis;
    const insertion = wrapLaiPlanBlock(markdownToLaiPlan(planText, 'Latexai Devil\'s Advocate Improvement Plan'), active.path);
    const next = insertBeforeEndDocument(active.text, insertion);
    updateActiveOrProjectSource(active.path, next);
    refreshPaperAiReview([active.path], "Devil's Advocate");
    setStatus(`Appended devil’s advocate improvement plan as visible \\lai markup to ${active.path}. Paper-level edit review refreshed.`);
    return { ok: true, path: active.path, mode: 'append-lai-plan' };
  }

  function insertImprovementPlan() {
    return appendLaiImprovementPlan();
  }

  async function copyReport() {
    const text = formatFullReport();
    if (!text.trim()) {
      setStatus('No debate report to copy.');
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Debate report copied.');
      return true;
    } catch (_err) {
      setOutput(text);
      setStatus('Could not copy automatically. Report shown below.');
      return false;
    }
  }

  function renderTranscript() {
    setOutput(formatFullReport() || 'Debate started...');
  }

  function setStatus(message) {
    const node = el('devilsDebateStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const out = el('devilsDebateOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = String(text || '');
    }
  }

  function providerOptions(selected) {
    const source = el('aiProvider');
    const values = Array.from(source?.options || []).map((opt) => opt.value).filter(Boolean);
    const fallback = values.length ? values : ['openai', 'anthropic', 'gemini'];
    return fallback.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function agentRow(prefix, title, current) {
    return [
      `<div class="devils-agent-row">`,
      `  <div class="devils-agent-title">${escapeHtml(title)}</div>`,
      '  <label>Provider',
      `    <select id="${prefix}Provider">${providerOptions(current.provider)}</select>`,
      '  </label>',
      '  <label>Model',
      `    <input id="${prefix}Model" type="text" value="${escapeHtml(current.model)}" placeholder="model name" />`,
      '  </label>',
      '</div>'
    ].join('');
  }

  function createCard() {
    const panel = el('copilotTab') || el('settingsTab') || D.querySelector('.right-panel');
    if (!panel || el('devilsDebateCard')) return false;

    const current = currentProviderModel();
    const card = D.createElement('div');
    card.id = 'devilsDebateCard';
    card.className = 'devils-debate-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Paper AI</div>',
      '    <h2>Devil’s advocate paper debate</h2>',
      '  </div>',
      '</div>',
      '<p class="devils-help">Run a structured debate: one AI agent defends the draft, one critiques it, and a final agent synthesizes a balanced improvement plan.</p>',
      '<div class="field-grid two">',
      '  <label class="field">Debate rounds',
      '    <input id="debateRounds" type="number" min="1" max="6" step="1" value="2" />',
      '  </label>',
      '  <label class="field">Target venue',
      '    <input id="debateTargetVenue" type="text" placeholder="e.g. COLT, NeurIPS, ICML" />',
      '  </label>',
      '</div>',
      '<label class="field">Target audience',
      '  <input id="debateTargetAudience" type="text" placeholder="e.g. ML theory, optimization, algorithms" />',
      '</label>',
      '<label class="field">Debate topic',
      '  <input id="debateTopic" type="text" value="overall paper quality and acceptance chances" />',
      '</label>',
      '<label class="field">Extra instructions',
      '  <textarea id="debateExtraInstructions" rows="3" placeholder="Optional: focus on novelty, theorem clarity, proof gaps, experimental claims, related work, etc."></textarea>',
      '</label>',
      '<div class="devils-agent-grid">',
      agentRow('advocateAgent', 'Advocate agent', current),
      agentRow('criticAgent', 'Critic agent', current),
      agentRow('synthAgent', 'Synthesizer agent', current),
      '</div>',
      '<div class="devils-actions">',
      '  <button id="runDevilsDebateBtn" class="btn mini primary" type="button">Run debate</button>',
      '  <button id="cancelDevilsDebateBtn" class="btn mini" type="button">Cancel</button>',
      '  <button id="copyDevilsDebateBtn" class="btn mini" type="button">Copy report</button>',
      '  <button id="addDevilsDebateBtn" class="btn mini" type="button">Add report to /reviews</button>',
      '  <button id="insertDevilsInlineLaiBtn" class="btn mini" type="button">Insert \\lai edits at matches</button>',
      '  <button id="insertDevilsPlanBtn" class="btn mini" type="button">Append \\lai plan</button>',
      '</div>',
      '<div class="settings-note">Stage 17S saves the debate report to <code>/reviews</code>, and inserted <code>\\lai</code>/<code>\\laiold</code> blocks are automatically scanned by Paper-level edit review.</div>',
      '<div id="devilsDebateStatus" class="settings-note">Devil’s advocate debate ready.</div>',
      '<pre id="devilsDebateOutput" class="devils-output"></pre>'
    ].join('');

    panel.appendChild(card);

    el('runDevilsDebateBtn')?.addEventListener('click', runDebate, true);
    el('cancelDevilsDebateBtn')?.addEventListener('click', cancelDebate, true);
    el('copyDevilsDebateBtn')?.addEventListener('click', copyReport, true);
    el('addDevilsDebateBtn')?.addEventListener('click', addReportToProject, true);
    el('insertDevilsInlineLaiBtn')?.addEventListener('click', insertActionableEditsAtMatches, true);
    el('insertDevilsPlanBtn')?.addEventListener('click', appendLaiImprovementPlan, true);

    return true;
  }

  function init() {
    createCard();
  }

  NS.DevilsAdvocateDebateService = {
    STAGE,
    init,
    buildPayload,
    validatePayload,
    runDebate,
    cancelDebate,
    addReportToProject,
    insertImprovementPlan,
    appendLaiImprovementPlan,
    insertActionableEditsAtMatches,
    extractActionableEdits,
    formatFullReport,
    getLastTranscript: () => lastTranscript,
    getLastSynthesis: () => lastSynthesis,
    getLastPayload: () => lastPayload
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  setTimeout(createCard, 950);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
