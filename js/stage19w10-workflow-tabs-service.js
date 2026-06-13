// Stage 19W16: right output panel is Preview/Logs only; tool tabs live in the left panel.
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'latex-stage19w56-total-remake-visible-lai-edits-20260607-1';
  const STORAGE_TAB = 'latexai:stage19w10:right-tab';
  const STORAGE_OBJECTIVE = 'latexai:stage19w14:paper-ai-objective';
  let unifiedRunInFlight = false;
  let unifiedRunSerial = 0;

  const PAPER_WORKFLOW_CARDS = {
    documentAiCard: 'paperWorkflowUnifiedPane',
    reviewerRebuttalCard: 'paperWorkflowUnifiedPane',
    realAgentBranchCard: 'paperWorkflowUnifiedPane',
    competitiveReviewCard: 'paperWorkflowUnifiedPane'
  };

  const LITERATURE_CARDS = {
    citationAiCard: 'literatureCitationPane',
    citationVerifierCard: 'literatureCitationPane'
  };

  const PROJECT_CARDS = {
    projectBlockContextCard: 'projectContextPane'
  };

  const DEBUG_CARD_IDS = [
    'paperAiDashboardCard',
    'regressionChecklistCard',
    'contextPolicyDashboardCard',
    'backendDiagnosticsCard',
    'releaseVerifyCard',
    'aiRoutingInspectorCard'
  ];

  function el(id) { return D.getElementById(id); }
  function q(sel, root) { return (root || D).querySelector(sel); }
  function qa(sel, root) { return Array.from((root || D).querySelectorAll(sel)); }
  function clean(s) { return String(s == null ? '' : s).trim(); }

  function params() {
    try { return new URLSearchParams(W.location.search || ''); } catch (_e) { return new URLSearchParams(); }
  }

  function isDebugMode() {
    const p = params();
    const values = [p.get('debug'), p.get('laiDebug'), p.get('luminaDebug'), p.get('diagnostics')].filter((x) => x !== null);
    return values.some((v) => /^(1|true|yes|on)$/i.test(String(v || '').trim()));
  }

  function applyDebugClass() {
    const debug = isDebugMode();
    D.body.classList.toggle('stage19w10-debug-mode', debug);
    D.body.classList.toggle('stage19w10-clean-mode', !debug);
    return debug;
  }

  function cssEscape(value) {
    if (W.CSS && typeof W.CSS.escape === 'function') return W.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function activateRightTab(name) {
    // Stage 19W16: the right panel owns only Preview and Logs.
    // Tool tabs live on the left and are handled by Stage19W16LeftToolTabsService.
    if (!name) return;
    if (!/^(preview|logs)$/.test(String(name))) {
      try { W.LuminaLatex?.Stage19W16LeftToolTabsService?.activateLeftTab?.(name); } catch (_e) {}
      return;
    }
    const right = D.querySelector('.right-panel') || D;
    const btn = q(`[data-right-tab="${cssEscape(name)}"]`, right);
    const panel = el(`${name}Tab`);
    if (!btn || !panel) return;
    qa('[data-right-tab]', right).forEach((b) => b.classList.toggle('active', b === btn));
    ['previewTab', 'logsTab'].forEach((id) => {
      const p = el(id);
      if (p) p.classList.toggle('active', p === panel);
    });
    try { localStorage.setItem(STORAGE_TAB, name); } catch (_e) {}
  }

  function stripPlaceholder(target) {
    if (!target) return;
    const placeholders = qa(':scope > .settings-note', target).filter((n) => /will appear here|Project block context card|Citation AI cards|Unified Paper AI controls|Total Paper Remake controls/i.test(n.textContent || ''));
    placeholders.forEach((n) => n.remove());
  }

  function moveCard(cardId, targetId) {
    const card = el(cardId);
    const target = el(targetId);
    if (!card || !target || card.parentElement === target) return false;
    stripPlaceholder(target);
    target.appendChild(card);
    card.dataset.stage19w10Home = targetId;
    return true;
  }

  function addDiagnosticLabel(card, text) {
    if (!card || card.dataset.stage19w10LabelAdded === 'true') return;
    const label = D.createElement('div');
    label.className = 'stage19w10-diagnostic-label';
    label.textContent = text || 'Developer diagnostic';
    card.insertBefore(label, card.firstChild);
    card.dataset.stage19w10LabelAdded = 'true';
  }

  function diagnosticsHost() {
    let host = el('developerDiagnosticsCards');
    if (host) return host;
    const settings = el('settingsTab') || D.querySelector('.right-panel');
    if (!settings) return null;
    let section = el('developerDiagnosticsSection');
    if (!section) {
      section = D.createElement('div');
      section.id = 'developerDiagnosticsSection';
      section.className = 'stage19w10-developer-diagnostics stage19w10-debug-only';
      section.innerHTML = '<div class="section-head compact"><div><div class="smallcaps">Developer</div><h2>Developer / diagnostics</h2></div></div><div class="settings-note compact">Hidden in normal mode. Add <code>?debug=1</code> to show diagnostic cards.</div><div id="developerDiagnosticsCards" class="stage19w10-debug-card-host"></div>';
      settings.appendChild(section);
    }
    return el('developerDiagnosticsCards');
  }

  function moveDiagnostics() {
    const host = diagnosticsHost();
    const debug = isDebugMode();
    DEBUG_CARD_IDS.forEach((id) => {
      const card = el(id);
      if (!card || !host) return;
      card.classList.add('stage19w10-debug-only');
      addDiagnosticLabel(card, 'Developer diagnostic · hidden unless debug=1');
      if (card.parentElement !== host) host.appendChild(card);
      card.classList.toggle('stage19w10-hidden-by-debug-policy', !debug);
    });
    qa('.branch-workflow-regression-card').forEach((node) => {
      node.classList.add('stage19w10-debug-only');
      node.classList.toggle('stage19w10-hidden-by-debug-policy', !debug);
    });
    const runApp = el('runAppDiagnosticsBtn');
    if (runApp) runApp.classList.add('stage19w10-debug-only');
  }

  function value(id, fallback) {
    const node = el(id);
    return clean(node && 'value' in node ? node.value : fallback);
  }

  function setValue(id, val) {
    const node = el(id);
    if (!node || !('value' in node)) return;
    const next = String(val == null ? '' : val);
    if (node.value !== next) {
      node.value = next;
      try { node.dispatchEvent(new Event('change', { bubbles: true })); } catch (_e) {}
    }
  }

  function setChecked(id, on) {
    const node = el(id);
    if (!node || !('checked' in node)) return;
    node.checked = !!on;
  }

  function setText(id, text) {
    const node = el(id);
    if (!node || !('value' in node)) return;
    if (!clean(node.value)) node.value = clean(text || '');
  }

  function outputMode() { return value('stage19w14OutputMode', 'report_and_edits'); }
  function objectiveMode() { return value('stage19w14Objective', 'quality'); }
  function scopeMode() { return value('stage19w14Scope', 'whole'); }
  function roundCount() { const raw = Number(value('stage19w14Rounds', '0')); return Math.max(-1, Math.min(5, Number.isFinite(raw) ? raw : 0)); }
  function focusMode() { return value('stage19w14Focus', 'balanced'); }
  function budgetMode() { return value('stage19w14Budget', 'balanced'); }

  function visibleCardsForObjective() {
    const obj = objectiveMode();
    if (obj === 'remake') return { document: true, reviewer: false, branch: false, competitive: false };
    if (obj === 'ranking') return { document: false, reviewer: false, branch: false, competitive: true };
    if (obj === 'stress') return { document: false, reviewer: false, branch: true, competitive: false };
    if (obj === 'combined') return { document: false, reviewer: true, branch: true, competitive: true };
    return { document: false, reviewer: true, branch: false, competitive: false };
  }

  function setHidden(id, hidden) {
    const node = el(id);
    if (!node) return;
    node.classList.toggle('stage19w14-engine-hidden', !!hidden);
    if (hidden) node.setAttribute('aria-hidden', 'true'); else node.removeAttribute('aria-hidden');
  }

  function requireFn(owner, fnName, label) {
    const fn = owner && owner[fnName];
    if (typeof fn !== 'function') {
      throw new Error(`${label || fnName} is not available. Reload the page with ?v=stage19w55 and check that the backend/AI modules loaded.`);
    }
    return fn.bind(owner);
  }

  function setRunButtonBusy(on) {
    const btn = el('stage19w14RunBtn');
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('is-busy', !!on);
    btn.textContent = on ? 'Running Paper AI…' : 'Run Paper AI';
  }

  function syncUnifiedControlsToEngines() {
    const obj = objectiveMode();
    const out = outputMode();
    const scope = scopeMode();
    const rounds = roundCount();
    const focus = focusMode();
    const budget = budgetMode();
    const venue = value('stage19w14TargetVenue', '');
    const audience = value('stage19w14TargetAudience', '');
    const instruction = value('stage19w14Instructions', '');
    const competitors = value('stage19w14Competitors', '');
    const useMemory = !!el('stage19w14UseProjectMemory')?.checked;
    const useCollections = !!el('stage19w14UseCollections')?.checked;
    const useReviewCorpus = !!el('stage19w14UseReviewCorpus')?.checked;
    const focusText = ({
      balanced: 'balanced improvement across novelty, clarity, math, positioning, and writing',
      ideas: 'ideas, novelty, contribution positioning, and conceptual framing',
      writing: 'writing quality, organization, clarity, and flow',
      math: 'mathematical rigor, assumptions, notation, theorem/proof clarity',
      citations: 'citations, related work, positioning against prior work'
    })[focus] || focus;

    // Total Paper Remake controls.
    if (el('documentAiOutputMode')) {
      const documentOutMode = out === 'report_only' ? 'plan_only' : out === 'edits_only' ? 'edits_only' : 'plan_and_edits';
      // Stage 19W56: source-changing whole-paper remake must use in-place safe edits.
      // The earlier mapping sent Whole paper -> append, which could append/replace output
      // without paired \laiold/\lai visible change markup. For any edit-producing mode,
      // force the Document AI engine into in-place safe-edit mode so the backend/compiler
      // returns app-managed LatexAI change blocks.
      const documentEditMode = documentOutMode === 'plan_only' ? 'append' : 'inplace';
      setValue('documentAiOutputMode', documentOutMode);
      setValue('documentAiMode', documentEditMode);
      setValue('documentAiTargetVenue', venue);
      setValue('documentAiTargetAudience', audience);
      setValue('documentAiStylePreferences', focusText);
      setChecked('documentAiUseProjectMemory', useMemory);
      setChecked('documentAiUseSelectedCollections', useCollections);
      setChecked('documentAiUseReferences', true);
      const defaultDocumentInstruction = instruction || `Goal: ${obj}. Scope: ${scope}. Focus: ${focusText}. Produce ${out.replace(/_/g, ' ')}. If this is an edit-producing whole-paper remake, return concrete LATEXAI_BLOCK_PATCH edits for the existing source, not a plain rewritten paper and not an appended prose report; the app must insert visible \\laiold/\\lai markup.`;
      setText('documentAiPrompt', defaultDocumentInstruction);
    }

    // Reviewer/Rebuttal controls. -1 rounds = direct prompt/edit through Total Remake; 0 rounds = reviews/critique only; 1+ rounds include rebuttal/revise.
    if (rounds >= 0 && el('reviewerSimWorkflowMode')) {
      const wantsEdits = out !== 'report_only';
      const mode = rounds <= 0 ? (wantsEdits ? 'quick_improvement' : 'review_only') : (wantsEdits ? 'review_rebuttal_revise' : 'review_rebuttal');
      setValue('reviewerSimWorkflowMode', mode);
      setValue('reviewerSimEditorOutputMode', out);
      setValue('reviewerSimVenue', venue);
      setValue('reviewerSimGoal', instruction || `Objective: ${obj}; focus: ${focusText}; scope: ${scope}.`);
      setValue('reviewerSimInstructions', `${instruction ? instruction + '\n' : ''}Use ${rounds} rebuttal/debate round(s). Focus on ${focusText}. Search budget: ${budget}. ${obj === 'ranking' ? 'Compare against supplied competitor papers.' : ''}`.trim());
      setChecked('reviewerSimUseKnowledge', useCollections);
      setChecked('reviewerSimUseReviewCorpus', useReviewCorpus);
      if (rounds <= 0) setValue('reviewerSimCount', value('stage19w14ReviewerCount', '3'));
    }

    // Devil's Advocate branch runner controls.
    if (el('branchWorkflowQuery')) {
      setValue('branchWorkflowQuery', `${obj} ${focusText}`.slice(0, 220));
      setValue('branchWorkflowTargetAudience', audience);
      setValue('branchWorkflowTargetVenue', venue);
      setValue('branchWorkflowImprovementGoal', instruction || `Improve ${focusText}.`);
      setValue('branchWorkflowReviewText', instruction || `Stress-test the paper for ${focusText}.`);
      setValue('branchWorkflowOutputMode', out);
      setValue('branchWorkflowDebateRounds', Math.max(1, rounds || 1));
      setValue('branchWorkflowSectionScope', scope === 'whole' ? 'whole' : scope === 'selected' ? 'selected' : 'salient');
      setValue('branchWorkflowRunMode', budget === 'deep' ? 'call_ai_proxy_expensive' : value('branchWorkflowRunMode', 'dry_run_no_model_calls'));
      setValue('branchWorkflowInsertMode', scope === 'whole' ? 'append' : 'targeted');
      setChecked('branchWorkflowUseKnowledge', useCollections);
    }

    // Competitive controls.
    if (el('competitivePaperUrls')) {
      setValue('competitiveTargetVenue', venue);
      setValue('competitiveTargetAudience', audience);
      if (competitors) setValue('competitivePaperUrls', competitors);
      setValue('competitiveExtraInstructions', `${instruction ? instruction + '\n' : ''}Objective: improve ranking against competitor papers. Focus: ${focusText}. Scope: ${scope}. Output: ${out.replace(/_/g, ' ')}.`.trim());
    }
  }

  function bindUnifiedPaperAiControls() {
    ['stage19w14Objective','stage19w14Scope','stage19w14Rounds','stage19w14OutputMode','stage19w14Focus','stage19w14Budget','stage19w14ReviewerCount','stage19w14TargetVenue','stage19w14TargetAudience','stage19w14Competitors','stage19w14Instructions','stage19w14UseProjectMemory','stage19w14UseCollections','stage19w14UseReviewCorpus','stage19w14ShowEngineCards'].forEach((id) => {
      const node = el(id);
      if (!node || node.dataset.stage19w14Bound === 'true') return;
      node.dataset.stage19w14Bound = 'true';
      const ev = node.tagName === 'INPUT' && node.type === 'checkbox' ? 'change' : 'input';
      node.addEventListener(ev, () => { applyObjectiveMode(); }, true);
      node.addEventListener('change', () => { applyObjectiveMode(); }, true);
    });
    // Sync unified reviewer count → reviewer service whenever it changes.
    const unifiedCount = el('stage19w14ReviewerCount');
    if (unifiedCount && !unifiedCount.dataset.stage19w14CountBound) {
      unifiedCount.dataset.stage19w14CountBound = 'true';
      unifiedCount.addEventListener('change', () => {
        const native = el('reviewerSimCount');
        if (native && native.value !== unifiedCount.value) {
          native.value = unifiedCount.value;
          try { native.dispatchEvent(new Event('change', { bubbles: true })); } catch (_e) {}
        }
      }, true);
    }
    const runBtn = el('stage19w14RunBtn');
    if (runBtn && runBtn.dataset.stage19w14Bound !== 'true') {
      runBtn.dataset.stage19w14Bound = 'true';
      runBtn.addEventListener('click', () => { void runUnifiedPaperAi(); }, true);
    }
    const previewBtn = el('stage19w14PreviewBtn');
    if (previewBtn && previewBtn.dataset.stage19w14Bound !== 'true') {
      previewBtn.dataset.stage19w14Bound = 'true';
      previewBtn.addEventListener('click', () => { syncUnifiedControlsToEngines(); setUnifiedStatus('Settings synced to underlying engine controls.'); }, true);
    }
    const applyBtn = el('stage19w14ApplyBtn');
    if (applyBtn && applyBtn.dataset.stage19w14Bound !== 'true') {
      applyBtn.dataset.stage19w14Bound = 'true';
      applyBtn.addEventListener('click', () => { void applyLatestUnifiedEdits(); }, true);
    }
    const objNode = el('stage19w14Objective');
    if (objNode && !objNode.dataset.stage19w14ObjectiveRestored) {
      objNode.dataset.stage19w14ObjectiveRestored = 'true';
      try {
        const saved = localStorage.getItem(STORAGE_OBJECTIVE);
        if (saved) objNode.value = saved;
      } catch (_e) {}
    }
  }

  function ensureUnifiedPaperAiControls() {
    const pane = el('paperWorkflowUnifiedPane') || el('paperWorkflowObjectivePane') || el('paperAiTab');
    if (!pane) return;
    if (el('stage19w14UnifiedPaperAiControls')) {
      bindUnifiedPaperAiControls();
      return;
    }
    stripPlaceholder(pane);
    const box = D.createElement('div');
    box.id = 'stage19w14UnifiedPaperAiControls';
    box.className = 'stage19w14-unified-paper-ai-card settings-card-subtle';
    box.innerHTML = [
      '<div class="section-head compact"><div><div class="smallcaps">Paper AI</div><h2>Goal-driven Paper AI</h2></div></div>',
      '<p class="settings-note compact">One unified Paper AI workflow. Choose an objective, scope, review/debate depth, and output mode. Report + edits and edits-only modes require safe <code>\\laiold</code>/<code>\\lai</code> edit proposals.</p>',
      '<div class="field-grid two compact">',
      '  <label class="field">Objective',
      '    <select id="stage19w14Objective">',
      '      <option value="quality" selected>Improve quality / acceptance probability</option>',
      '      <option value="ranking">Improve ranking against competitor papers</option>',
      '      <option value="stress">Stress-test with adversarial critique</option>',
      '      <option value="remake">Full remake / reorganization</option>',
      '      <option value="combined">Combined: review + adversarial + competitive</option>',
      '    </select>',
      '  </label>',
      '  <label class="field">Scope',
      '    <select id="stage19w14Scope">',
      '      <option value="whole" selected>Whole paper</option>',
      '      <option value="selected">Current section / selected text</option>',
      '      <option value="salient">Most salient weak blocks</option>',
      '    </select>',
      '  </label>',
      '</div>',
      '<div class="field-grid two compact">',
      '  <label class="field">Review/debate rounds',
      '    <select id="stage19w14Rounds">',
      '      <option value="-1">−1 — direct prompt/edit, no review</option>',
      '      <option value="0" selected>0 — critique/review only</option>',
      '      <option value="1">1 — review + response/revision</option>',
      '      <option value="2">2 — multi-round debate</option>',
      '      <option value="3">3 — deeper debate</option>',
      '    </select>',
      '  </label>',
      '  <label class="field">Output mode',
      '    <select id="stage19w14OutputMode">',
      '      <option value="report_only">Report only</option>',
      '      <option value="edits_only">Edits only</option>',
      '      <option value="report_and_edits" selected>Report + edits</option>',
      '    </select>',
      '  </label>',
      '</div>',
      '<div class="field-grid two compact">',
      '  <label class="field">Improvement focus',
      '    <select id="stage19w14Focus">',
      '      <option value="balanced" selected>Balanced</option>',
      '      <option value="ideas">Ideas / novelty / positioning</option>',
      '      <option value="writing">Writing / organization / clarity</option>',
      '      <option value="math">Math / assumptions / notation / proof clarity</option>',
      '      <option value="citations">Citations / related work</option>',
      '    </select>',
      '  </label>',
      '  <label class="field">Search budget',
      '    <select id="stage19w14Budget">',
      '      <option value="fast">Fast</option>',
      '      <option value="balanced" selected>Balanced</option>',
      '      <option value="deep">Deep / expensive</option>',
      '    </select>',
      '  </label>',
      '</div>',
      '<div class="field-grid two compact">',
      '  <label class="field">Reviewer / critic count <select id="stage19w14ReviewerCount"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option></select></label>',
      '  <label class="field">Target venue <input id="stage19w14TargetVenue" type="text" placeholder="e.g. COLT, NeurIPS, JMLR" /></label>',
      '</div>',
      '<label class="field">Target audience <input id="stage19w14TargetAudience" type="text" placeholder="e.g. ML theory reviewers, broad ML audience" /></label>',
      '<label class="field stage19w14-competitor-field">Competitor papers / URLs / notes <textarea id="stage19w14Competitors" rows="3" placeholder="One URL per line, or paste titles/abstracts/notes. Used only for ranking or combined objectives."></textarea></label>',
      '<label class="field">Instructions / focal request <textarea id="stage19w14Instructions" rows="3" placeholder="Example: strengthen novelty positioning, tighten proof assumptions, improve related work, preserve theorem statements."></textarea></label>',
      '<details class="stage19w14-advanced"><summary>Advanced context and engine settings</summary>',
      '  <div class="field-grid two compact">',
      '    <label class="field checkbox-field"><input id="stage19w14UseProjectMemory" type="checkbox" checked /> Use project memory</label>',
      '    <label class="field checkbox-field"><input id="stage19w14UseCollections" type="checkbox" checked /> Use selected collections / literature</label>',
      '    <label class="field checkbox-field"><input id="stage19w14UseReviewCorpus" type="checkbox" /> Use OpenReview examples</label>',
      '    <label class="field checkbox-field"><input id="stage19w14ShowEngineCards" type="checkbox" /> Show internal legacy engine cards (debug)</label>',
      '  </div>',
      '</details>',
      '<details id="stage19w14ReviewerDetails" class="stage19w14-reviewer-details stage19w14-engine-hidden">',
      '  <summary>Configure reviewers</summary>',
      '  <p class="settings-note compact">Customize the name and expertise focus for each simulated reviewer.</p>',
      '  <div id="stage19w14ReviewerRowsContainer" class="devils-agent-grid"></div>',
      '</details>',
      '<div id="stage19w14Status" class="settings-note compact">Unified Paper AI ready. Review/rebuttal and other engines are internal; choose an objective and click Run Paper AI.</div>',
      '<div class="micro-actions stretch devils-actions compact">',
      '  <button id="stage19w14RunBtn" class="btn mini primary" type="button">Run Paper AI</button>',
      '  <button id="stage19w14PreviewBtn" class="btn mini" type="button">Preview / sync settings</button>',
      '  <button id="stage19w14ApplyBtn" class="btn mini" type="button">Apply latest safe edits</button>',
      '</div>'
    ].join('');
    pane.insertBefore(box, pane.firstChild);
    bindUnifiedPaperAiControls();
  }

  function setUnifiedStatus(text) {
    const node = el('stage19w14Status');
    if (node) node.textContent = text;
  }

  function updateVisibleEngineCards() {
    const v = visibleCardsForObjective();
    const showEngine = !!el('stage19w14ShowEngineCards')?.checked;
    // Stage 19W14C: Reviewer/Rebuttal, Devil's Advocate, Competitive,
    // and Total Remake are internal engines.  They should not appear as
    // standalone Paper AI panels in normal use; the unified controls above
    // route to them.  Only reveal the selected internal engine cards when the
    // explicit debug/advanced checkbox is enabled.
    setHidden('documentAiCard', !(showEngine && v.document));
    setHidden('reviewerRebuttalCard', !(showEngine && v.reviewer));
    setHidden('realAgentBranchCard', !(showEngine && v.branch));
    setHidden('competitiveReviewCard', !(showEngine && v.competitive));
    D.body.classList.toggle('stage19w14-show-engine-cards', showEngine);
    const compField = q('.stage19w14-competitor-field');
    if (compField) compField.classList.toggle('stage19w14-engine-hidden', !(objectiveMode() === 'ranking' || objectiveMode() === 'combined'));
    // Show the inline reviewer config panel when objective involves reviewing.
    const reviewerDetails = el('stage19w14ReviewerDetails');
    if (reviewerDetails) reviewerDetails.classList.toggle('stage19w14-engine-hidden', !v.reviewer);
  }

  function hoistReviewerConfig() {
    const container = el('stage19w14ReviewerRowsContainer');
    const rows = el('reviewerSimRows');
    if (!container || !rows || container.contains(rows)) return;
    container.appendChild(rows);
    // Sync unified reviewer count → native reviewer service count and re-render rows.
    const unified = el('stage19w14ReviewerCount');
    const native = el('reviewerSimCount');
    if (unified && native && unified.value !== native.value) {
      native.value = unified.value;
      try { native.dispatchEvent(new Event('change', { bubbles: true })); } catch (_e) {}
    }
  }

  function applyObjectiveMode(options) {
    const opts = options || {};
    ensureUnifiedPaperAiControls();
    syncUnifiedControlsToEngines();
    updateVisibleEngineCards();
    try { localStorage.setItem(STORAGE_OBJECTIVE, objectiveMode()); } catch (_e) {}
    if (unifiedRunInFlight && !opts.forceStatus) return;
    const obj = objectiveMode();
    const out = outputMode();
    const rounds = roundCount();
    const labels = { quality: 'quality/acceptance', ranking: 'competitive ranking', stress: 'adversarial stress-test', remake: 'full remake', combined: 'combined objective' };
    setUnifiedStatus(`Objective: ${labels[obj] || obj}; rounds: ${rounds}; output: ${out.replace(/_/g, ' ')}. ${out === 'report_only' ? 'No source edits will be applied.' : 'Safe edits will be prepared with \laiold/\lai markup.'}`);
  }


  function editMarkerSummary() {
    const state = NS.State?.state || {};
    const project = state.project || {};
    const normalize = (p) => {
      try { return NS.State?.normalizePath?.(p) || String(p || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
      catch (_e) { return String(p || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    };
    const root = normalize(project.rootFile || 'main.tex');
    const files = Array.isArray(project.files) ? project.files : [];
    const file = files.find((f) => normalize(f.path) === root) || files.find((f) => /\.tex$/i.test(f.path || '')) || null;
    const text = String(file?.text ?? file?.content ?? file?.source ?? '');
    const matches = text.match(/\\laiold\s*\{|\\lai\s*\{/g) || [];
    return { path: normalize(file?.path || root), count: matches.length, hasMarkers: matches.length > 0 };
  }


  async function runUnifiedPaperAi() {
    if (unifiedRunInFlight) {
      setUnifiedStatus('Paper AI is already running. Please wait for the current run to finish.');
      return;
    }
    const runId = ++unifiedRunSerial;
    unifiedRunInFlight = true;
    setRunButtonBusy(true);
    applyObjectiveMode({ forceStatus: true });
    const obj = objectiveMode();
    const out = outputMode();
    const rounds = roundCount();
    setUnifiedStatus(`Running Paper AI objective: ${obj}; rounds: ${rounds}; output: ${out.replace(/_/g, ' ')}...`);
    try {
      if (rounds < 0) {
        const service = NS.DocumentAIService;
        const fn = out === 'report_only'
          ? requireFn(service, 'runDocumentAi', 'Direct Paper AI report runner')
          : requireFn(service, 'runAndAppendDocumentAi', 'Direct Paper AI edit runner');
        const result = await fn();
        if (runId === unifiedRunSerial) {
          const markerCheck = editMarkerSummary();
          setUnifiedStatus(out === 'report_only'
            ? 'Direct Paper AI report run complete.'
            : markerCheck.hasMarkers
              ? `Direct Paper AI inserted visible \\laiold/\\lai markup (${markerCheck.count} marker block(s)).`
              : `Direct Paper AI completed, but no visible \\laiold/\\lai markup was found in ${markerCheck.path}. Check the Total Paper Remake output; the safe compiler may have blocked or returned non-marked edits.`);
        }
        return result;
      }
      if (obj === 'remake') {
        const service = NS.DocumentAIService;
        const fn = out === 'report_only'
          ? requireFn(service, 'runDocumentAi', 'Total remake report runner')
          : requireFn(service, 'runAndAppendDocumentAi', 'Total remake edit runner');
        const result = await fn();
        if (runId === unifiedRunSerial) {
          const markerCheck = editMarkerSummary();
          setUnifiedStatus(out === 'report_only'
            ? 'Total remake report run complete.'
            : markerCheck.hasMarkers
              ? `Total remake inserted visible \\laiold/\\lai markup (${markerCheck.count} marker block(s)).`
              : `Total remake completed, but no visible \\laiold/\\lai markup was found in ${markerCheck.path}. Check Total Paper Remake output; no source-changing edit was applied.`);
        }
        return result;
      }
      if (obj === 'quality') {
        const service = NS.ReviewerRebuttalSimulatorService;
        const run = requireFn(service, 'runFullLoop', 'Reviewer/rebuttal Paper AI runner');
        const result = await run();
        if (out !== 'report_only') {
          const prep = requireFn(service, 'prepareReviewerFinalInsertion', 'Reviewer/rebuttal safe-edit preparer');
          await prep();
        }
        if (runId === unifiedRunSerial) {
          setUnifiedStatus(result?.ok === false
            ? `Reviewer/rebuttal run finished with warnings${result?.error ? ': ' + result.error : ''}.`
            : 'Reviewer/rebuttal run complete; safe edits are prepared when available.');
        }
        return;
      }
      if (obj === 'stress') {
        const service = NS.RealAgentBranchWorkflowService;
        const run = requireFn(service, 'runSelectedBranch', 'Adversarial branch Paper AI runner');
        await run();
        if (out !== 'report_only') {
          const prep = requireFn(service, 'prepareInsertion', 'Adversarial branch safe-edit preparer');
          await prep('targeted');
        }
        if (runId === unifiedRunSerial) setUnifiedStatus('Adversarial branch run complete; safe edits are prepared when available.');
        return;
      }
      if (obj === 'ranking') {
        const service = NS.CompetitivePaperReviewService;
        const run = requireFn(service, 'runCompetitiveReview', 'Competitive Paper AI runner');
        await run();
        if (out !== 'report_only') {
          const prep = requireFn(service, 'generateMemoryAwareFinalPaperRewrite', 'Competitive safe-edit preparer');
          await prep('inline');
        }
        if (runId === unifiedRunSerial) setUnifiedStatus('Competitive run complete; review/apply generated ranking-improvement edits.');
        return;
      }
      if (obj === 'combined') {
        await requireFn(NS.ReviewerRebuttalSimulatorService, 'runFullLoop', 'Reviewer/rebuttal Paper AI runner')();
        await requireFn(NS.RealAgentBranchWorkflowService, 'runSelectedBranch', 'Adversarial branch Paper AI runner')();
        await requireFn(NS.CompetitivePaperReviewService, 'runCompetitiveReview', 'Competitive Paper AI runner')();
        if (runId === unifiedRunSerial) setUnifiedStatus('Combined run complete. Underlying outputs are available in logs/reports.');
      }
    } catch (err) {
      const msg = err?.message || String(err);
      if (runId === unifiedRunSerial) setUnifiedStatus(`Unified Paper AI run failed: ${msg}`);
      try { console.warn('[Latexai Stage 19W55] unified run failed', err); } catch (_e) {}
    } finally {
      if (runId === unifiedRunSerial) {
        unifiedRunInFlight = false;
        setRunButtonBusy(false);
      }
    }
  }


  async function applyLatestUnifiedEdits() {
    const obj = objectiveMode();
    try {
      if (obj === 'quality') {
        await NS.ReviewerRebuttalSimulatorService?.applyReviewerFinalInsertion?.();
        setUnifiedStatus('Applied latest Reviewer/Rebuttal safe edits.');
      } else if (obj === 'stress') {
        const btn = el('branchWorkflowApplyTargetedBtn') || el('branchWorkflowApplyAppendBtn');
        if (btn) btn.click(); else setUnifiedStatus('No Devil’s Advocate apply button is available yet.');
      } else if (obj === 'ranking') {
        const btn = el('insertCompetitiveInlineLaiBtn') || el('insertCompetitiveRoadmapBtn');
        if (btn) btn.click(); else setUnifiedStatus('No Competitive apply button is available yet.');
      } else if (obj === 'remake') {
        await NS.DocumentAIService?.appendLastToPaper?.();
        setUnifiedStatus('Applied latest Total Remake output.');
      } else {
        setUnifiedStatus('Use the visible underlying engine apply buttons for combined runs.');
      }
    } catch (err) {
      setUnifiedStatus(`Apply failed: ${err?.message || String(err)}`);
    }
  }

  function moveWorkflowCards() {
    Object.entries(PAPER_WORKFLOW_CARDS).forEach(([card, target]) => moveCard(card, target));
    ensureUnifiedPaperAiControls();
    applyObjectiveMode();
    Object.entries(LITERATURE_CARDS).forEach(([card, target]) => moveCard(card, target));
    Object.entries(PROJECT_CARDS).forEach(([card, target]) => moveCard(card, target));
    el('copilotTab')?.classList.add('stage19w10-local-copilot-only');
    hoistReviewerConfig();
    document.dispatchEvent(new CustomEvent('stage19w10:cards-moved', { bubbles: false }));
  }

  function normalizePaperAiSurface() {
    const paper = el('paperAiTab');
    const card = el('stage19w14UnifiedPaperAiControls');
    if (paper) {
      const directHead = q(':scope > .section-head.compact', paper);
      const directNote = q(':scope > .settings-note.compact', paper);
      if (directHead) directHead.classList.add('stage19w19-paper-ai-shell-heading-hidden');
      if (directNote) directNote.classList.add('stage19w19-paper-ai-shell-note-hidden');
    }
    if (card) {
      const small = q(':scope > .section-head .smallcaps', card);
      const h2 = q(':scope > .section-head h2', card);
      if (small) small.textContent = 'Paper AI';
      if (h2) h2.textContent = 'Goal-driven Paper AI';
    }
  }

  function normalizeLabels() {
    const stageBadge = el('stageBadge');
    if (stageBadge) stageBadge.textContent = STAGE;

    // Stage 19W20: Copilot was renamed to Audit AI.  Older tab services used
    // to re-label this heading on refresh ticks as "Local editing assistant";
    // that caused the visible title to flicker.  Keep Audit AI stable and let
    // Paper AI rounds = -1 own direct prompt/edit behavior.
    const auditHeading = q('#copilotTab > .section-head.compact h2');
    if (auditHeading) auditHeading.textContent = 'Audit AI';
    const auditSmall = q('#copilotTab > .section-head.compact .smallcaps');
    if (auditSmall) auditSmall.textContent = 'Audit AI';

    const paperTab = el('paperAiTab');
    const paperHeading = paperTab ? q(':scope > .section-head h2', paperTab) : null;
    if (paperHeading) paperHeading.textContent = 'Paper AI';
    const paperSmall = paperTab ? q(':scope > .section-head .smallcaps', paperTab) : null;
    if (paperSmall) paperSmall.textContent = 'Paper AI';
    normalizePaperAiSurface();
  }

  function installPrimaryTabMemory() {
    const right = D.querySelector('.right-panel') || D;
    qa('[data-right-tab]', right).forEach((btn) => {
      if (btn.dataset.stage19w10PrimaryBound === 'true') return;
      btn.dataset.stage19w10PrimaryBound = 'true';
      btn.addEventListener('click', () => {
        const tab = btn.dataset.rightTab || 'preview';
        if (/^(preview|logs)$/.test(tab)) {
          try { localStorage.setItem(STORAGE_TAB, tab); } catch (_e) {}
        }
      }, true);
    });
  }

  function restoreTabs() {
    let saved = '';
    try { saved = localStorage.getItem(STORAGE_TAB) || ''; } catch (_e) {}
    if (saved && /^(preview|logs)$/.test(saved) && el(`${saved}Tab`)) activateRightTab(saved);
  }

  function reconcile() {
    applyDebugClass();
    installPrimaryTabMemory();
    normalizeLabels();
    moveWorkflowCards();
    normalizePaperAiSurface();
    moveDiagnostics();
  }

  function startObserver() {
    const root = D.querySelector('.workspace') || D.body;
    if (!root || root.dataset.stage19w10Observed === 'true') return;
    root.dataset.stage19w10Observed = 'true';
    let timer = null;
    const obs = new MutationObserver(() => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; reconcile(); }, 80);
    });
    obs.observe(root, {childList: true, subtree: true});
  }

  function jumpToWorkflow(_name) {
    try { W.LuminaLatex?.Stage19W16LeftToolTabsService?.activateLeftTab?.('paperAi'); } catch (_e) {}
    reconcile();
  }

  function activateWorkflow(_name) {
    try { W.LuminaLatex?.Stage19W16LeftToolTabsService?.activateLeftTab?.('paperAi'); } catch (_e) {}
    reconcile();
  }

  function init() {
    reconcile();
    restoreTabs();
    startObserver();
    [250, 800, 1600, 3000, 5500].forEach((ms) => setTimeout(reconcile, ms));
  }

  NS.Stage19W10WorkflowTabsService = {
    stage: STAGE,
    init,
    reconcile,
    activateRightTab,
    activateWorkflow,
    applyObjectiveMode,
    runUnifiedPaperAi,
    jumpToWorkflow,
    isDebugMode
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
