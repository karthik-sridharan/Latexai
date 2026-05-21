/* Latexai Stage 16A PaperAiPolishService
 * Stage: stage16a-paper-ai-workflow-polish-1
 *
 * Paper-level AI workflow polish:
 * - scans \lai{...} and \laiold{...} markup;
 * - previews structured edit reports before applying;
 * - applies only selected edits;
 * - rejects selected edits;
 * - accepts all new \lai content;
 * - rejects all new \lai content and keeps \laiold;
 * - optionally runs the in-app regression checklist after applying.
 *
 * This service is local-only: no compile jobs and no AI calls.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage16a-paper-ai-workflow-polish-1';

  if (W.LatexaiSafeMode?.shouldDisableOptionalScript?.('paper-ai-polish-service')) {
    NS.PaperAiPolishService = {
      STAGE,
      disabledBySafeMode: true,
      init: () => false,
      scan: () => ({ edits: [] })
    };
    try { console.log('[Latexai]', STAGE, 'disabled by safe mode'); } catch (_err) {}
    return;
  }

  let lastScan = null;
  let lastReport = null;

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

  function activePath() {
    const candidates = [
      State()?.state?.activePath,
      State()?.state?.activeFilePath,
      State()?.state?.currentPath,
      project()?.activePath,
      project()?.activeFilePath,
      project()?.rootFile
    ];
    for (const candidate of candidates) {
      if (candidate && getFile(candidate)) return normalizePath(candidate);
    }

    const pill = clean(el('activeFilePill')?.textContent);
    if (pill && getFile(pill)) return normalizePath(pill);

    const match = files().find((file) => /\.tex$/i.test(file.path || '') && fileText(file) === String(el('sourceEditor')?.value || ''));
    if (match) return normalizePath(match.path);

    return normalizePath(pill || project()?.rootFile || 'main.tex');
  }

  function activeSource() {
    const path = activePath();
    const editorText = String(el('sourceEditor')?.value || '');
    const file = getFile(path);
    const text = editorText || fileText(file);
    return { path, file, text };
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

  function isMacroBoundary(text, index, macro) {
    if (!text.startsWith(`\\${macro}`, index)) return false;
    const next = text[index + macro.length + 1] || '';
    return !/[A-Za-z@]/.test(next);
  }

  function skipSpaces(text, index) {
    let i = index;
    while (i < text.length && /\s/.test(text[i])) i += 1;
    return i;
  }

  function parseBrace(text, openIndex) {
    if (text[openIndex] !== '{') return null;
    let depth = 0;
    let escaped = false;
    for (let i = openIndex; i < text.length; i += 1) {
      const ch = text[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          return {
            start: openIndex,
            end: i + 1,
            content: text.slice(openIndex + 1, i)
          };
        }
      }
    }
    return null;
  }

  function parseMacroAt(text, index, macro) {
    if (!isMacroBoundary(text, index, macro)) return null;
    const afterName = index + macro.length + 1;
    const open = skipSpaces(text, afterName);
    const parsed = parseBrace(text, open);
    if (!parsed) return null;
    return {
      macro,
      start: index,
      end: parsed.end,
      content: parsed.content,
      raw: text.slice(index, parsed.end)
    };
  }

  function lineOf(text, index) {
    return text.slice(0, index).split(/\n/).length;
  }

  function sectionAt(text, index) {
    const before = text.slice(0, index);
    const matches = [...before.matchAll(/\\(part|chapter|section|subsection|subsubsection)\*?\{([^{}]+)\}/g)];
    if (!matches.length) return '(preamble / unknown section)';
    const last = matches[matches.length - 1];
    return `\\${last[1]}{${last[2]}}`;
  }

  function extractCites(value) {
    const keys = new Set();
    const re = /\\cite[a-zA-Z*]*(?:\[[^\]]*\]){0,2}\{([^{}]+)\}/g;
    let match;
    while ((match = re.exec(String(value || '')))) {
      match[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((k) => keys.add(k));
    }
    return [...keys];
  }

  function short(value, n = 180) {
    const s = String(value || '').replace(/\s+/g, ' ').trim();
    return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
  }

  function scanText(text) {
    const edits = [];
    let i = 0;

    while (i < text.length) {
      const oldMacro = parseMacroAt(text, i, 'laiold');
      if (oldMacro) {
        const afterOld = skipSpaces(text, oldMacro.end);
        const newMacro = parseMacroAt(text, afterOld, 'lai');
        if (newMacro) {
          const fullEnd = newMacro.end;
          edits.push({
            id: `edit-${edits.length + 1}`,
            kind: 'replace-old-with-new',
            start: oldMacro.start,
            end: fullEnd,
            oldText: oldMacro.content,
            newText: newMacro.content,
            raw: text.slice(oldMacro.start, fullEnd),
            line: lineOf(text, oldMacro.start),
            section: sectionAt(text, oldMacro.start),
            citations: [...new Set([...extractCites(oldMacro.content), ...extractCites(newMacro.content)])]
          });
          i = fullEnd;
          continue;
        }

        edits.push({
          id: `edit-${edits.length + 1}`,
          kind: 'old-only',
          start: oldMacro.start,
          end: oldMacro.end,
          oldText: oldMacro.content,
          newText: '',
          raw: oldMacro.raw,
          line: lineOf(text, oldMacro.start),
          section: sectionAt(text, oldMacro.start),
          citations: extractCites(oldMacro.content)
        });
        i = oldMacro.end;
        continue;
      }

      const newMacro = parseMacroAt(text, i, 'lai');
      if (newMacro) {
        edits.push({
          id: `edit-${edits.length + 1}`,
          kind: 'new-only',
          start: newMacro.start,
          end: newMacro.end,
          oldText: '',
          newText: newMacro.content,
          raw: newMacro.raw,
          line: lineOf(text, newMacro.start),
          section: sectionAt(text, newMacro.start),
          citations: extractCites(newMacro.content)
        });
        i = newMacro.end;
        continue;
      }

      i += 1;
    }

    return edits;
  }

  function compileRisks(text, edits) {
    const risks = [];
    const remainingMarkup = (text.match(/\\lai(old)?\s*\{/g) || []).length;
    if (remainingMarkup) risks.push(`${remainingMarkup} \\lai / \\laiold markup block(s) currently present.`);

    const editedMath = edits.filter((edit) => /\\\[|\\\]|\\\(|\\\)|\$\$|\\begin\{equation|\\begin\{align/.test(`${edit.oldText}\n${edit.newText}`)).length;
    if (editedMath) risks.push(`${editedMath} edit(s) touch displayed or inline math.`);

    const labelEdits = edits.filter((edit) => /\\label\{/.test(`${edit.oldText}\n${edit.newText}`)).length;
    if (labelEdits) risks.push(`${labelEdits} edit(s) touch labels; cross references may need recompilation.`);

    const citationEdits = edits.filter((edit) => edit.citations.length).length;
    if (citationEdits) risks.push(`${citationEdits} edit(s) touch citations; run citation verifier after applying.`);

    return risks;
  }

  function structuredReport(scan = lastScan) {
    if (!scan) return null;
    const bySection = new Map();
    for (const edit of scan.edits) {
      if (!bySection.has(edit.section)) bySection.set(edit.section, []);
      bySection.get(edit.section).push(edit);
    }

    const citations = [...new Set(scan.edits.flatMap((edit) => edit.citations))].sort();
    const risks = compileRisks(scan.text, scan.edits);

    return {
      schema: 'latexai-paper-ai-edit-report-v1',
      stage: STAGE,
      generatedAt: new Date().toISOString(),
      path: scan.path,
      summary: {
        editCount: scan.edits.length,
        pairedEdits: scan.edits.filter((e) => e.kind === 'replace-old-with-new').length,
        newOnlyEdits: scan.edits.filter((e) => e.kind === 'new-only').length,
        oldOnlyEdits: scan.edits.filter((e) => e.kind === 'old-only').length,
        sectionsTouched: bySection.size,
        citationsTouched: citations.length
      },
      changedSections: [...bySection.entries()].map(([section, edits]) => ({
        section,
        editIds: edits.map((edit) => edit.id),
        count: edits.length
      })),
      citationsAffected: citations,
      compileRisks: risks,
      edits: scan.edits.map((edit) => ({
        id: edit.id,
        kind: edit.kind,
        line: edit.line,
        section: edit.section,
        citations: edit.citations,
        oldPreview: short(edit.oldText),
        newPreview: short(edit.newText)
      }))
    };
  }

  function formatReport(report = lastReport) {
    if (!report) return 'No paper AI edit report yet.';
    const lines = [
      'Paper-level AI edit report',
      '==========================',
      '',
      `Generated: ${report.generatedAt}`,
      `File: ${report.path}`,
      '',
      'Summary',
      '-------',
      `Edits: ${report.summary.editCount}`,
      `Paired old/new edits: ${report.summary.pairedEdits}`,
      `New-only edits: ${report.summary.newOnlyEdits}`,
      `Old-only edits: ${report.summary.oldOnlyEdits}`,
      `Sections touched: ${report.summary.sectionsTouched}`,
      `Citations touched: ${report.summary.citationsTouched}`,
      '',
      'Changed sections',
      '----------------'
    ];

    if (report.changedSections.length) {
      for (const item of report.changedSections) lines.push(`- ${item.section}: ${item.count} edit(s)`);
    } else lines.push('- none');

    lines.push('', 'Citations affected', '------------------');
    if (report.citationsAffected.length) report.citationsAffected.forEach((key) => lines.push(`- ${key}`));
    else lines.push('- none');

    lines.push('', 'Compile risks', '-------------');
    if (report.compileRisks.length) report.compileRisks.forEach((risk) => lines.push(`- ${risk}`));
    else lines.push('- none detected locally');

    lines.push('', 'Edits', '-----');
    for (const edit of report.edits) {
      lines.push(`- ${edit.id} · line ${edit.line} · ${edit.kind} · ${edit.section}`);
      if (edit.oldPreview) lines.push(`  old: ${edit.oldPreview}`);
      if (edit.newPreview) lines.push(`  new: ${edit.newPreview}`);
      if (edit.citations.length) lines.push(`  citations: ${edit.citations.join(', ')}`);
    }

    return lines.join('\n');
  }

  function scan() {
    const active = activeSource();
    const edits = scanText(active.text);
    lastScan = {
      path: active.path,
      text: active.text,
      edits
    };
    lastReport = structuredReport(lastScan);
    renderScan(lastScan, lastReport);
    setStatus(edits.length ? `Found ${edits.length} AI edit block(s).` : 'No \\lai / \\laiold edit blocks found.');
    return lastScan;
  }

  function replacementFor(edit, choice) {
    if (choice === 'old') return edit.oldText || '';
    if (choice === 'new') return edit.newText || '';
    return edit.raw;
  }

  function applyChoices(choices, onlySelected = true) {
    const current = lastScan || scan();
    if (!current?.edits?.length) {
      setStatus('No AI edit blocks to apply.');
      return { ok: true, changed: 0 };
    }

    let next = current.text;
    let changed = 0;
    const edits = [...current.edits].sort((a, b) => b.start - a.start);
    for (const edit of edits) {
      const choice = choices[edit.id];
      if (!choice && onlySelected) continue;
      if (!choice) continue;
      next = next.slice(0, edit.start) + replacementFor(edit, choice) + next.slice(edit.end);
      changed += 1;
    }

    updateActiveSource(current.path, next);
    const after = scan();
    if (el('paperAiRunRegressionAfterApply')?.checked) runRegressionChecklist();
    setStatus(`Applied ${changed} selected AI edit decision(s). Remaining AI markup blocks: ${after.edits.length}.`);
    return { ok: true, changed, remaining: after.edits.length };
  }

  function selectedChoices(defaultChoiceForChecked = null) {
    const choices = {};
    D.querySelectorAll('[data-paper-ai-edit-check]').forEach((box) => {
      if (!box.checked) return;
      const id = box.dataset.paperAiEditCheck;
      if (defaultChoiceForChecked) {
        choices[id] = defaultChoiceForChecked;
        return;
      }
      const selected = D.querySelector(`[name="paper-ai-choice-${CSS.escape(id)}"]:checked`);
      choices[id] = selected?.value || 'new';
    });
    return choices;
  }

  function applySelected() {
    return applyChoices(selectedChoices(), true);
  }

  function rejectSelected() {
    return applyChoices(selectedChoices('old'), true);
  }

  function acceptAllNew() {
    const current = lastScan || scan();
    const choices = {};
    for (const edit of current.edits || []) choices[edit.id] = 'new';
    return applyChoices(choices, false);
  }

  function rejectAllKeepOld() {
    const current = lastScan || scan();
    const choices = {};
    for (const edit of current.edits || []) choices[edit.id] = 'old';
    return applyChoices(choices, false);
  }

  function previewSelected() {
    const current = lastScan || scan();
    const choices = selectedChoices();
    const chosen = current.edits.filter((edit) => choices[edit.id]);
    const lines = [
      'Selected paper-level AI edits preview',
      '====================================',
      '',
      `Selected edits: ${chosen.length}`,
      ''
    ];

    for (const edit of chosen) {
      lines.push(`${edit.id} · line ${edit.line} · keep ${choices[edit.id]}`);
      if (choices[edit.id] === 'old') lines.push(short(edit.oldText, 300));
      else lines.push(short(edit.newText, 300));
      lines.push('');
    }

    setOutput(lines.join('\n'));
    setStatus(`Previewing ${chosen.length} selected edit(s).`);
  }

  function runRegressionChecklist() {
    try {
      if (NS.RegressionChecklistService?.runChecklist) {
        NS.RegressionChecklistService.runChecklist();
        return true;
      }
    } catch (_err) {}
    return false;
  }

  async function copyReport() {
    if (!lastReport) scan();
    const text = formatReport(lastReport);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Paper AI edit report copied.');
    } catch (_err) {
      setOutput(text);
      setStatus('Could not copy automatically. Report shown below.');
    }
  }

  function setStatus(message) {
    const node = el('paperAiPolishStatus');
    if (node) node.textContent = message;
  }

  function setOutput(text) {
    const out = el('paperAiPolishOutput');
    if (out) {
      out.classList.add('active');
      out.textContent = String(text || '');
    }
  }

  function editRowsHtml(scanResult) {
    if (!scanResult.edits.length) {
      return '<div class="paper-ai-empty">No \\lai / \\laiold edit blocks found in the active file.</div>';
    }

    return scanResult.edits.map((edit) => [
      `<div class="paper-ai-edit-row" data-paper-ai-edit="${escapeHtml(edit.id)}">`,
      '  <div class="paper-ai-edit-head">',
      `    <label><input type="checkbox" data-paper-ai-edit-check="${escapeHtml(edit.id)}" checked /> ${escapeHtml(edit.id)} · line ${edit.line}</label>`,
      `    <span>${escapeHtml(edit.kind)}</span>`,
      '  </div>',
      `  <div class="paper-ai-edit-section">${escapeHtml(edit.section)}</div>`,
      '  <div class="paper-ai-choice-row">',
      `    <label><input type="radio" name="paper-ai-choice-${escapeHtml(edit.id)}" value="new" checked /> keep new</label>`,
      `    <label><input type="radio" name="paper-ai-choice-${escapeHtml(edit.id)}" value="old" /> keep old</label>`,
      '  </div>',
      '  <div class="paper-ai-preview-grid">',
      `    <div><strong>Old</strong><pre>${escapeHtml(short(edit.oldText || '(empty)', 500))}</pre></div>`,
      `    <div><strong>New</strong><pre>${escapeHtml(short(edit.newText || '(empty)', 500))}</pre></div>`,
      '  </div>',
      edit.citations.length ? `<div class="paper-ai-cites">Citations: ${escapeHtml(edit.citations.join(', '))}</div>` : '',
      '</div>'
    ].join('')).join('');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function renderScan(scanResult, report) {
    const list = el('paperAiEditList');
    if (list) list.innerHTML = editRowsHtml(scanResult);

    const summary = el('paperAiPolishSummary');
    if (summary && report) {
      summary.textContent = `${report.summary.editCount} edit(s), ${report.summary.sectionsTouched} section(s), ${report.summary.citationsTouched} citation key(s), ${report.compileRisks.length} compile-risk note(s).`;
      summary.classList.toggle('has-edits', report.summary.editCount > 0);
    }

    setOutput(formatReport(report));
  }

  function createCard() {
    const panel = el('copilotTab') || el('settingsTab') || D.querySelector('.right-panel');
    if (!panel || el('paperAiPolishCard')) return false;

    const card = D.createElement('div');
    card.id = 'paperAiPolishCard';
    card.className = 'paper-ai-polish-card';
    card.innerHTML = [
      '<div class="section-head compact">',
      '  <div>',
      '    <div class="smallcaps">Paper AI</div>',
      '    <h2>Paper-level edit review</h2>',
      '  </div>',
      '</div>',
      '<p class="paper-ai-help">Review and resolve \\lai / \\laiold paper-level AI edits before compiling or committing.</p>',
      '<div id="paperAiPolishSummary" class="paper-ai-summary">No scan run yet.</div>',
      '<div class="paper-ai-actions">',
      '  <button id="paperAiScanBtn" class="btn mini primary" type="button">Scan AI edits</button>',
      '  <button id="paperAiPreviewSelectedBtn" class="btn mini" type="button">Preview selected</button>',
      '  <button id="paperAiApplySelectedBtn" class="btn mini primary" type="button">Apply selected edits</button>',
      '  <button id="paperAiRejectSelectedBtn" class="btn mini" type="button">Reject selected edits</button>',
      '</div>',
      '<div class="paper-ai-actions">',
      '  <button id="paperAiAcceptAllNewBtn" class="btn mini primary" type="button">Accept all new \\lai</button>',
      '  <button id="paperAiRejectAllBtn" class="btn mini" type="button">Reject all; keep \\laiold</button>',
      '  <button id="paperAiCopyReportBtn" class="btn mini" type="button">Copy report</button>',
      '</div>',
      '<label class="paper-ai-check"><input id="paperAiRunRegressionAfterApply" type="checkbox" checked /> Run regression checklist after applying</label>',
      '<div id="paperAiPolishStatus" class="settings-note">Paper AI edit review ready.</div>',
      '<div id="paperAiEditList" class="paper-ai-edit-list"></div>',
      '<pre id="paperAiPolishOutput" class="paper-ai-output"></pre>'
    ].join('');

    panel.appendChild(card);

    el('paperAiScanBtn')?.addEventListener('click', scan, true);
    el('paperAiPreviewSelectedBtn')?.addEventListener('click', previewSelected, true);
    el('paperAiApplySelectedBtn')?.addEventListener('click', applySelected, true);
    el('paperAiRejectSelectedBtn')?.addEventListener('click', rejectSelected, true);
    el('paperAiAcceptAllNewBtn')?.addEventListener('click', acceptAllNew, true);
    el('paperAiRejectAllBtn')?.addEventListener('click', rejectAllKeepOld, true);
    el('paperAiCopyReportBtn')?.addEventListener('click', copyReport, true);

    return true;
  }

  function init() {
    createCard();
  }

  NS.PaperAiPolishService = {
    STAGE,
    init,
    scan,
    scanText,
    structuredReport,
    formatReport,
    applyChoices,
    acceptAllNew,
    rejectAllKeepOld,
    getLastScan: () => lastScan,
    getLastReport: () => lastReport
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  setTimeout(createCard, 800);

  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
