// Stage 19W1-W9: block-level paper state, context matching, and MCTS-lite UI.
(function(){
  'use strict';
  const W = window;
  const D = document;
  const NS = W.LuminaLatex = W.LuminaLatex || {};
  const STAGE = 'latex-stage19w9-context-policy-logging-dashboard-20260602-1';
  const state = { analysis:null, matches:null, citations:null, related:null, mcts:null, lastPromptContext:'' };
  function el(id){ return D.getElementById(id); }
  function clean(s){ return String(s || '').trim(); }
  function project(){ return NS.State?.state?.project || W.LuminaProject || W.project || {}; }
  function files(){ const p=project(); return Array.isArray(p.files)?p.files:[]; }
  function normalizePath(p){ return String(p || '').replace(/^\/+/, '') || 'main.tex'; }
  function rootPath(){ return normalizePath(project()?.rootFile || NS.State?.state?.rootFile || 'main.tex'); }
  function fileText(file){ return String(file?.text ?? file?.content ?? file?.source ?? ''); }
  function activeSource(){
    const ed = el('sourceEditor');
    const path = normalizePath(NS.State?.state?.activePath || NS.State?.state?.activeFilePath || project()?.activePath || rootPath());
    let file = null;
    try { file = NS.State?.getFile?.(path); } catch(_e) {}
    if (!file) file = files().find(f => normalizePath(f.path) === path) || null;
    const text = String(ed?.value || fileText(file));
    return { path, text };
  }
  function projectId(){
    const title = clean(el('projectTitleDisplay')?.textContent) || 'local-latexai-project';
    let h = 0; const src = title + '|' + rootPath();
    for (let i=0;i<src.length;i++) h = ((h<<5)-h+src.charCodeAt(i))|0;
    return 'project-' + Math.abs(h).toString(36);
  }
  function backendRoot(){
    const raw = clean(NS.BackendUrlSettingsService?.getMemoryApiBaseUrl?.() || NS.BackendUrlSettings?.getMemoryApiBaseUrl?.() || '') || clean(el('memoryBackendUrl')?.value) || clean(localStorage.getItem('lumina-latex.memory.backendUrl') || '') || clean(localStorage.getItem('latexai:memory-backend-url') || '');
    const base = raw.replace(/\/+$/, '');
    if (!base) return '';
    if (/\/api\/lumina\/memory$/i.test(base)) return base.replace(/\/api\/lumina\/memory$/i, '/api/lumina');
    if (/\/api\/lumina$/i.test(base)) return base;
    if (/\/api\/lumina\/latex\/compile(?:\/jobs)?$/i.test(base)) return base.replace(/\/api\/lumina\/latex\/compile(?:\/jobs)?$/i, '/api/lumina');
    if (/\/api\/lumina\/ai(?:\/status|\/models|\/workflows)?$/i.test(base)) return base.replace(/\/api\/lumina\/ai(?:\/status|\/models|\/workflows)?$/i, '/api/lumina');
    return base + '/api/lumina';
  }
  function headers(){
    const h = {'Content-Type':'application/json'};
    const tok = clean(NS.BackendUrlSettingsService?.getMemoryProxyToken?.() || NS.BackendUrlSettings?.getMemoryProxyToken?.() || el('memoryProxyToken')?.value || localStorage.getItem('lumina-latex.memory.proxyToken') || '');
    if (tok) { h.Authorization = 'Bearer ' + tok; h['X-Lumina-Token'] = tok; h['X-Lumina-Ingest-Token'] = tok; }
    return h;
  }
  async function post(path, body){
    const root = backendRoot();
    if (!root) throw new Error('Set Memory backend URL in Settings first.');
    const res = await fetch(root + path, {method:'POST', headers:headers(), body:JSON.stringify(body||{})});
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : {}; } catch(_e){ data = {raw:text}; }
    if (!res.ok || data.ok === false) throw new Error(data.detail || data.message || data.error?.message || ('HTTP '+res.status+': '+text));
    return data;
  }
  function setStatus(msg, kind=''){
    const n = el('projectBlockStatus');
    if (n) { n.textContent = String(msg || ''); n.dataset.kind = kind; }
  }
  function briefBlock(b){ return `${b.blockId || ''} · ${b.blockType || 'block'} · ${b.sectionPath || b.title || ''}`; }
  function render(){
    const out = el('projectBlockOutput');
    if (!out) return;
    const lines=[];
    if (state.analysis) {
      const p = state.analysis.project || {};
      lines.push(`ANALYSIS: ${p.blockCount || 0} block(s), embedding=${p.metadata?.embeddingStatus || 'unknown'} (${p.metadata?.embeddingProvider || ''}/${p.metadata?.embeddingModel || ''})`);
      (p.blocks || []).slice(0, 14).forEach((b,i)=> lines.push(`  ${i+1}. ${briefBlock(b)}\n     ${String(b.summary || b.plainText || '').slice(0,180)}`));
    }
    if (state.matches) {
      lines.push('\nBLOCK-LOCAL CONTEXT MATCHES:');
      (state.matches.matches || []).slice(0, 8).forEach((row,i)=>{
        const b = row.block || {};
        lines.push(`  ${i+1}. ${briefBlock(b)}`);
        (row.literatureMatches || []).slice(0,2).forEach((m,j)=> lines.push(`     L${j+1}: ${(m.title || '(untitled)').slice(0,120)} score=${Number(m.score||0).toFixed(3)}`));
        (row.reviewMatches || []).slice(0,2).forEach((m,j)=> lines.push(`     R${j+1}: [${m.itemType || m.kind || 'record'}] ${(m.title || m.itemTitle || '(review)').slice(0,120)} score=${Number(m.score||0).toFixed(3)}`));
      });
    }
    if (state.citations) {
      lines.push('\nCITATION SUGGESTIONS:');
      (state.citations.suggestions || []).forEach((s,i)=> lines.push(`  ${i+1}. ${s.sectionPath || s.blockType}: ${s.reason}\n${s.patchPreview}`));
    }
    if (state.related) {
      lines.push('\nRELATED WORK REWRITE PLAN:');
      const plan = state.related.plan || {};
      (plan.themes || []).forEach((t,i)=> lines.push(`  ${i+1}. ${t.theme}: ${(t.papers || []).join('; ')}`));
      if (plan.instructions) lines.push('  ' + plan.instructions);
    }
    if (state.mcts) {
      lines.push('\nMCTS / SELF-PLAY LITE:');
      const run = state.mcts.run || {};
      lines.push(`  run=${run.runId || ''}, branches=${run.rolloutCount || 0}, best=${run.bestBranchId || ''}, score=${run.bestValueScore || ''}`);
      (state.mcts.branches || []).slice(0,6).forEach((b,i)=> lines.push(`  ${i+1}. ${b.actionType} on ${b.targetBlockId}, value=${b.valueScore}: ${b.rationale}`));
    }
    out.textContent = lines.join('\n') || 'Project block/context results will appear here.';
  }
  function payload(extra={}){ const src=activeSource(); return {projectId:projectId(), filePath:src.path, latexSource:src.text, ...extra}; }
  async function analyze(){ setStatus('Analyzing project blocks and embeddings…'); state.analysis = await post('/project-blocks/analyze', payload({embed: el('projectBlockEmbedCheck')?.checked !== false})); setStatus(`Analyzed ${(state.analysis.project||{}).blockCount || 0} block(s).`, 'good'); render(); return state.analysis; }
  async function ensureAnalysis(){ if (!state.analysis) await analyze(); }
  async function match(){ setStatus('Matching blocks to literature + OpenReview context…'); await ensureAnalysis(); state.matches = await post('/project-blocks/match', payload({topK:Number(el('projectBlockTopK')?.value||4), blockLimit:Number(el('projectBlockLimit')?.value||10), includeLiterature:el('projectBlockIncludeLiterature')?.checked !== false, includeReviews:el('projectBlockIncludeReviews')?.checked !== false})); state.lastPromptContext = promptContext(); setStatus(`Matched ${state.matches.resultCount || 0} block(s).`, 'good'); await logBundle('block_context_match', 'matched'); render(); return state.matches; }
  async function citations(){ setStatus('Generating block-local citation suggestions…'); await ensureAnalysis(); state.citations = await post('/project-blocks/citation-suggestions', payload({topK:Number(el('projectBlockTopK')?.value||4), blockLimit:Number(el('projectBlockLimit')?.value||12)})); setStatus(`Generated ${state.citations.suggestionCount || 0} citation suggestion(s).`, 'good'); await logBundle('citation_suggestions', 'generated'); render(); return state.citations; }
  async function related(){ setStatus('Building related-work rewrite plan…'); await ensureAnalysis(); state.related = await post('/project-blocks/related-work-rewrite', payload({topK:Number(el('projectBlockTopK')?.value||5), blockLimit:Number(el('projectBlockLimit')?.value||16), includeReviews:el('projectBlockIncludeReviews')?.checked !== false})); setStatus('Built related-work rewrite plan.', 'good'); await logBundle('related_work_rewrite', 'planned'); render(); return state.related; }
  async function mcts(){ setStatus('Running MCTS/self-play lite over paper blocks…'); await ensureAnalysis(); state.mcts = await post('/mcts/selfplay/run', payload({topK:Number(el('projectBlockTopK')?.value||4), blockLimit:Number(el('projectBlockLimit')?.value||10), rollouts:Number(el('projectBlockRollouts')?.value||6), goal:clean(el('projectBlockGoal')?.value)})); setStatus(`MCTS-lite run complete: ${state.mcts.run?.rolloutCount || 0} branch(es).`, 'good'); render(); return state.mcts; }
  async function logBundle(phase, outcome){
    try { await post('/context-bundles/log', {workflow:'project-block-context-ui', phase, outcome, projectId:projectId(), blockIds:((state.matches?.matches||[]).map(r=>r.block?.blockId).filter(Boolean)), contextBundle:{hasAnalysis:!!state.analysis, hasMatches:!!state.matches, hasCitations:!!state.citations, hasRelated:!!state.related}}); } catch(_e) {}
  }
  function promptContext(){
    const rows = (state.matches?.matches || []).slice(0,6);
    if (!rows.length) return '';
    const lines = ['Block-local LatexAI context matches:'];
    rows.forEach((row,i)=>{
      const b=row.block||{}; lines.push(`[B${i+1}] ${briefBlock(b)} — ${String(b.summary || '').slice(0,240)}`);
      (row.literatureMatches||[]).slice(0,2).forEach((m,j)=>lines.push(`  literature L${j+1}: ${m.title || ''}`));
      (row.reviewMatches||[]).slice(0,2).forEach((m,j)=>lines.push(`  OpenReview R${j+1}: ${m.itemType || m.kind || ''} ${m.title || m.itemTitle || ''}`));
    });
    return lines.join('\n');
  }
  function inject(){
    if (el('projectBlockContextCard')) return;
    const parent = el('copilotTab') || D.querySelector('.right-tab-panel');
    if (!parent) return;
    const card = D.createElement('div');
    card.id = 'projectBlockContextCard';
    card.className = 'settings-card-subtle project-block-context-card';
    card.innerHTML = `
      <div class="section-head compact"><div><div class="smallcaps">Stage 19W1-W9</div><h3>Project block context + MCTS-lite</h3></div></div>
      <div class="settings-note compact">Parse this LaTeX file into blocks, embed them, match each block to literature/OpenReview trajectories, and run a first block-local MCTS/self-play prototype.</div>
      <div class="field-grid two compact">
        <label class="field checkbox-field"><input id="projectBlockEmbedCheck" type="checkbox" checked /> Embed blocks</label>
        <label class="field">TopK <input id="projectBlockTopK" type="number" min="1" max="12" value="4" /></label>
        <label class="field">Block limit <input id="projectBlockLimit" type="number" min="1" max="40" value="10" /></label>
        <label class="field">Rollouts <input id="projectBlockRollouts" type="number" min="1" max="24" value="6" /></label>
        <label class="field checkbox-field"><input id="projectBlockIncludeLiterature" type="checkbox" checked /> Literature matches</label>
        <label class="field checkbox-field"><input id="projectBlockIncludeReviews" type="checkbox" checked /> OpenReview matches</label>
      </div>
      <label class="field">MCTS goal <input id="projectBlockGoal" type="text" placeholder="e.g. improve reviewer-risk, citations, related work, proof clarity" /></label>
      <div class="devils-actions">
        <button id="projectBlockAnalyzeBtn" class="btn mini" type="button">Analyze blocks</button>
        <button id="projectBlockMatchBtn" class="btn mini" type="button">Match context</button>
        <button id="projectBlockCitationBtn" class="btn mini" type="button">Citation suggestions</button>
        <button id="projectBlockRelatedBtn" class="btn mini" type="button">Related-work plan</button>
        <button id="projectBlockMctsBtn" class="btn mini primary" type="button">Run MCTS-lite</button>
      </div>
      <div id="projectBlockStatus" class="settings-note compact">Ready.</div>
      <pre id="projectBlockOutput" class="devils-output">Project block/context results will appear here.</pre>`;
    const ref = el('reviewerRebuttalSimulatorCard') || el('copilotOutput');
    if (ref && ref.parentNode === parent) parent.insertBefore(card, ref.nextSibling); else parent.appendChild(card);
    el('projectBlockAnalyzeBtn')?.addEventListener('click', ()=>analyze().catch(e=>{setStatus(e.message||e,'bad'); render();}));
    el('projectBlockMatchBtn')?.addEventListener('click', ()=>match().catch(e=>{setStatus(e.message||e,'bad'); render();}));
    el('projectBlockCitationBtn')?.addEventListener('click', ()=>citations().catch(e=>{setStatus(e.message||e,'bad'); render();}));
    el('projectBlockRelatedBtn')?.addEventListener('click', ()=>related().catch(e=>{setStatus(e.message||e,'bad'); render();}));
    el('projectBlockMctsBtn')?.addEventListener('click', ()=>mcts().catch(e=>{setStatus(e.message||e,'bad'); render();}));
  }
  NS.ProjectBlockContextService = { stage:STAGE, analyze, match, citations, related, mcts, state, getLastPromptContext:()=>state.lastPromptContext || promptContext(), promptContext };
  D.addEventListener('DOMContentLoaded', () => setTimeout(inject, 500));
})();
