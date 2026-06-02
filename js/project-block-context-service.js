// Stage 19W11: block-level paper state, context matching, MCTS-lite, and apply/feedback UI.
(function(){
  'use strict';
  const W = window;
  const D = document;
  const NS = W.LuminaLatex = W.LuminaLatex || {};
  const STAGE = 'latex-stage19w11-block-suggestion-apply-feedback-20260602-1';
  const state = { analysis:null, matches:null, citations:null, related:null, mcts:null, lastPromptContext:'', lastPreview:null, previews:{}, lastApplied:null };
  function el(id){ return D.getElementById(id); }
  function clean(s){ return String(s || '').trim(); }
  function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
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
  function setActiveSourceText(text){
    const src = activeSource();
    const ed = el('sourceEditor');
    if (ed) {
      ed.value = String(text || '');
      try { ed.dispatchEvent(new Event('input', {bubbles:true})); } catch(_e) {}
      try { ed.dispatchEvent(new Event('change', {bubbles:true})); } catch(_e) {}
    }
    try {
      const file = NS.State?.getFile?.(src.path);
      if (file) {
        if ('text' in file) file.text = String(text || '');
        else if ('content' in file) file.content = String(text || '');
        else file.text = String(text || '');
      }
    } catch(_e) {}
    try { NS.Editor?.render?.(); } catch(_e) {}
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
  function patchSnippet(s, n=700){ return String(s || '').length > n ? String(s || '').slice(0,n) + '…' : String(s || ''); }
  function renderButton(label, action, idx='', kind='', extra=''){
    return `<button class="btn mini ${extra}" type="button" data-project-block-action="${esc(action)}" data-kind="${esc(kind)}" data-index="${esc(idx)}">${esc(label)}</button>`;
  }
  function render(){
    const out = el('projectBlockOutput');
    if (!out) return;
    const parts=[];
    if (!state.analysis && !state.matches && !state.citations && !state.related && !state.mcts) {
      out.innerHTML = '<div class="settings-note compact">Project block/context results will appear here.</div>';
      return;
    }
    if (state.analysis) {
      const p = state.analysis.project || {};
      parts.push(`<section class="stage19w11-result-section"><h4>Analysis</h4><div class="settings-note compact">${esc(p.blockCount || 0)} block(s), embedding=${esc(p.metadata?.embeddingStatus || 'unknown')} (${esc(p.metadata?.embeddingProvider || '')}/${esc(p.metadata?.embeddingModel || '')})</div><ol>${(p.blocks || []).slice(0,14).map((b)=>`<li><b>${esc(briefBlock(b))}</b><br><span>${esc(String(b.summary || b.plainText || '').slice(0,220))}</span></li>`).join('')}</ol></section>`);
    }
    if (state.matches) {
      parts.push(`<section class="stage19w11-result-section"><h4>Block-local context matches</h4>${(state.matches.matches || []).slice(0, 8).map((row,i)=>{
        const b=row.block||{};
        const lit=(row.literatureMatches||[]).slice(0,2).map((m,j)=>`<li>L${j+1}: ${esc((m.title || '(untitled)').slice(0,140))} <span class="muted">score=${Number(m.score||0).toFixed(3)}</span></li>`).join('');
        const rev=(row.reviewMatches||[]).slice(0,2).map((m,j)=>`<li>R${j+1}: [${esc(m.itemType || m.kind || 'record')}] ${esc((m.title || m.itemTitle || '(review)').slice(0,140))} <span class="muted">score=${Number(m.score||0).toFixed(3)}</span></li>`).join('');
        return `<div class="stage19w11-suggestion-card"><b>${i+1}. ${esc(briefBlock(b))}</b><ul>${lit}${rev}</ul></div>`;
      }).join('')}</section>`);
    }
    if (state.citations) {
      const cards=(state.citations.suggestions || []).map((s,i)=>`<div class="stage19w11-suggestion-card"><div><b>${i+1}. Citation suggestion</b> <span class="muted">${esc(s.sectionPath || s.blockType || '')}</span></div><div>${esc(s.reason || '')}</div><pre>${esc(patchSnippet(s.patchPreview, 900))}</pre><div class="devils-actions">${renderButton('Preview', 'preview-citation', i, 'citation_suggestion')}${renderButton('Apply as \\lai edit', 'apply-citation', i, 'citation_suggestion', 'primary')}${renderButton('Reject', 'reject-citation', i, 'citation_suggestion')}${renderButton('Show evidence JSON', 'evidence-citation', i, 'citation_suggestion')}</div></div>`).join('') || '<div class="settings-note compact">No citation suggestions generated.</div>';
      parts.push(`<section class="stage19w11-result-section"><h4>Citation suggestions</h4>${cards}</section>`);
    }
    if (state.related) {
      const plan = state.related.plan || {};
      const themes=(plan.themes || []).map((t,i)=>`<li><b>${i+1}. ${esc(t.theme || 'Theme')}</b>: ${esc((t.papers || []).join('; '))}<br><span>${esc(t.rewriteGuidance || '')}</span></li>`).join('');
      parts.push(`<section class="stage19w11-result-section"><h4>Related-work rewrite plan</h4><ul>${themes}</ul><div class="settings-note compact">${esc(plan.instructions || '')}</div><div class="devils-actions">${renderButton('Preview related-work edit', 'preview-related', 0, 'related_work_plan')}${renderButton('Apply related-work plan as \\lai block', 'apply-related', 0, 'related_work_plan', 'primary')}${renderButton('Reject plan', 'reject-related', 0, 'related_work_plan')}</div></section>`);
    }
    if (state.mcts) {
      const run = state.mcts.run || {};
      const branches=(state.mcts.branches || []).slice(0,8).map((b,i)=>`<div class="stage19w11-suggestion-card"><div><b>${i+1}. ${esc(b.actionType || 'branch')}</b> <span class="muted">block=${esc(b.targetBlockId || '')}, value=${esc(b.valueScore || '')}</span></div><div>${esc(b.rationale || '')}</div><div class="devils-actions">${renderButton('Preview branch edit', 'preview-mcts', i, 'mcts_branch')}${renderButton(i===0?'Apply winning branch':'Apply branch', 'apply-mcts', i, 'mcts_branch', i===0?'primary':'')}${renderButton('Reject branch', 'reject-mcts', i, 'mcts_branch')}</div></div>`).join('');
      parts.push(`<section class="stage19w11-result-section"><h4>MCTS / self-play lite</h4><div class="settings-note compact">run=${esc(run.runId || '')}, branches=${esc(run.rolloutCount || 0)}, best=${esc(run.bestBranchId || '')}, score=${esc(run.bestValueScore || '')}</div>${branches}</section>`);
    }
    if (state.lastPreview) {
      const p=state.lastPreview;
      parts.push(`<section class="stage19w11-result-section"><h4>Latest apply preview</h4><div class="settings-note compact">preview=${esc(p.previewId)} · kind=${esc(p.kind)} · mode=${esc(p.mode)} · block=${esc(p.blockId || '')}</div><pre>${esc(patchSnippet(p.patchText, 1600))}</pre><div class="devils-actions">${renderButton('Apply latest preview', 'apply-latest', '', '')}${renderButton('Mark latest useful', 'useful-latest', '', '')}${renderButton('Reject latest', 'reject-latest', '', '')}</div></section>`);
    }
    if (state.lastApplied) {
      parts.push(`<div class="settings-note compact" data-kind="good">Last applied: ${esc(state.lastApplied)}</div>`);
    }
    out.innerHTML = parts.join('');
  }
  function payload(extra={}){ const src=activeSource(); return {projectId:projectId(), filePath:src.path, latexSource:src.text, ...extra}; }
  async function analyze(){ setStatus('Analyzing project blocks and embeddings…'); state.analysis = await post('/project-blocks/analyze', payload({embed: el('projectBlockEmbedCheck')?.checked !== false})); setStatus(`Analyzed ${(state.analysis.project||{}).blockCount || 0} block(s).`, 'good'); render(); return state.analysis; }
  async function ensureAnalysis(){ if (!state.analysis) await analyze(); }
  async function match(){ setStatus('Matching blocks to literature + OpenReview context…'); await ensureAnalysis(); state.matches = await post('/project-blocks/match', payload({topK:Number(el('projectBlockTopK')?.value||4), blockLimit:Number(el('projectBlockLimit')?.value||10), includeLiterature:el('projectBlockIncludeLiterature')?.checked !== false, includeReviews:el('projectBlockIncludeReviews')?.checked !== false})); state.lastPromptContext = promptContext(); setStatus(`Matched ${state.matches.resultCount || 0} block(s).`, 'good'); await logBundle('block_context_match', 'matched'); render(); return state.matches; }
  async function citations(){ setStatus('Generating block-local citation suggestions…'); await ensureAnalysis(); state.citations = await post('/project-blocks/citation-suggestions', payload({topK:Number(el('projectBlockTopK')?.value||4), blockLimit:Number(el('projectBlockLimit')?.value||12)})); setStatus(`Generated ${state.citations.suggestionCount || 0} citation suggestion(s).`, 'good'); await logBundle('citation_suggestions', 'generated'); render(); return state.citations; }
  async function related(){ setStatus('Building related-work rewrite plan…'); await ensureAnalysis(); state.related = await post('/project-blocks/related-work-rewrite', payload({topK:Number(el('projectBlockTopK')?.value||5), blockLimit:Number(el('projectBlockLimit')?.value||16), includeReviews:el('projectBlockIncludeReviews')?.checked !== false})); setStatus('Built related-work rewrite plan.', 'good'); await logBundle('related_work_rewrite', 'planned'); render(); return state.related; }
  async function mcts(){ setStatus('Running MCTS/self-play lite over paper blocks…'); await ensureAnalysis(); state.mcts = await post('/mcts/selfplay/run', payload({topK:Number(el('projectBlockTopK')?.value||4), blockLimit:Number(el('projectBlockLimit')?.value||10), rollouts:Number(el('projectBlockRollouts')?.value||6), goal:clean(el('projectBlockGoal')?.value)})); setStatus(`MCTS-lite run complete: ${state.mcts.run?.rolloutCount || 0} branch(es).`, 'good'); render(); return state.mcts; }
  async function logBundle(phase, outcome){
    try { await post('/context-bundles/log', {workflow:'project-block-context-ui', phase, outcome, projectId:projectId(), blockIds:((state.matches?.matches||[]).map(r=>r.block?.blockId).filter(Boolean)), contextBundle:{hasAnalysis:!!state.analysis, hasMatches:!!state.matches, hasCitations:!!state.citations, hasRelated:!!state.related, hasMcts:!!state.mcts}}); } catch(_e) {}
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
  function suggestionFor(kind, index){
    const i = Number(index || 0);
    if (kind === 'citation_suggestion') return (state.citations?.suggestions || [])[i] || {};
    if (kind === 'related_work_plan') return state.related?.plan || {};
    if (kind === 'mcts_branch') return (state.mcts?.branches || [])[i] || {};
    return {};
  }
  async function preview(kind, index, forceAppend=false){
    const src = activeSource();
    const body = payload({kind, forceAppend});
    if (kind === 'citation_suggestion') body.suggestion = suggestionFor(kind, index);
    else if (kind === 'related_work_plan') body.plan = suggestionFor(kind, index);
    else if (kind === 'mcts_branch') body.branch = suggestionFor(kind, index);
    const data = await post('/block-suggestions/apply-preview', body);
    state.lastPreview = data.preview || null;
    if (state.lastPreview) state.previews[state.lastPreview.previewId] = state.lastPreview;
    setStatus(`Prepared apply preview ${state.lastPreview?.previewId || ''}.`, 'good');
    render();
    return state.lastPreview;
  }
  function insertBeforeEndDocument(source, insertion){
    const s = String(source || '');
    const ins = '\n\n' + String(insertion || '').trim() + '\n';
    const m = s.match(/\\end\{document\}\s*$/);
    if (m && typeof m.index === 'number') return s.slice(0, m.index) + ins + s.slice(m.index);
    return s + ins;
  }
  async function feedback(previewOrId, outcome, rewardValue){
    const id = typeof previewOrId === 'string' ? previewOrId : previewOrId?.previewId;
    try { await post('/block-suggestions/feedback', {eventId:id, previewId:id, outcome, rewardValue, projectId:projectId(), workflow:'project-block-context-ui'}); } catch(_e) {}
  }
  async function applyPreview(p){
    if (!p) throw new Error('No apply preview available.');
    const src = activeSource();
    let text = src.text;
    const patch = String(p.patchText || '').trim();
    if (!patch) throw new Error('Preview did not contain patch text.');
    if (p.mode === 'localized_replace' && Number.isFinite(Number(p.replaceStart)) && Number(p.replaceStart) >= 0) {
      const a = Number(p.replaceStart), b = Number(p.replaceEnd);
      text = text.slice(0, a) + patch + text.slice(b);
    } else {
      text = insertBeforeEndDocument(text, patch);
    }
    setActiveSourceText(text);
    state.lastApplied = `${p.kind || 'suggestion'} ${p.previewId || ''} inserted as safe \\lai markup`;
    await feedback(p, 'applied', 1);
    setStatus('Applied safe \\lai / \\laiold edit to the active source.', 'good');
    render();
  }
  async function reject(kind, index){
    await post('/block-suggestions/feedback', {kind, outcome:'rejected', rewardValue:-1, projectId:projectId(), blockId:(suggestionFor(kind,index)||{}).blockId || (suggestionFor(kind,index)||{}).targetBlockId || '', workflow:'project-block-context-ui'});
    setStatus('Rejected suggestion and logged feedback.', 'good');
  }
  async function handleOutputClick(ev){
    const btn = ev.target?.closest?.('[data-project-block-action]');
    if (!btn) return;
    const action = btn.dataset.projectBlockAction;
    const kind = btn.dataset.kind || '';
    const index = btn.dataset.index || '0';
    try {
      if (action === 'preview-citation') await preview('citation_suggestion', index);
      else if (action === 'apply-citation') await applyPreview(await preview('citation_suggestion', index));
      else if (action === 'reject-citation') await reject('citation_suggestion', index);
      else if (action === 'evidence-citation') { state.lastPreview = {previewId:'evidence', kind:'citation_evidence', mode:'display', patchText:JSON.stringify(suggestionFor('citation_suggestion', index), null, 2)}; render(); }
      else if (action === 'preview-related') await preview('related_work_plan', index, true);
      else if (action === 'apply-related') await applyPreview(await preview('related_work_plan', index, true));
      else if (action === 'reject-related') await reject('related_work_plan', index);
      else if (action === 'preview-mcts') await preview('mcts_branch', index);
      else if (action === 'apply-mcts') await applyPreview(await preview('mcts_branch', index));
      else if (action === 'reject-mcts') await reject('mcts_branch', index);
      else if (action === 'apply-latest') await applyPreview(state.lastPreview);
      else if (action === 'useful-latest') { await feedback(state.lastPreview, 'useful', 1); setStatus('Marked latest preview useful.', 'good'); }
      else if (action === 'reject-latest') { await feedback(state.lastPreview, 'rejected', -1); setStatus('Rejected latest preview.', 'good'); }
      render();
    } catch(e) {
      setStatus(e.message || String(e), 'bad');
    }
  }
  function inject(){
    if (el('projectBlockContextCard')) return;
    const parent = el('projectContextPane') || el('copilotTab') || D.querySelector('.right-tab-panel');
    if (!parent) return;
    const card = D.createElement('div');
    card.id = 'projectBlockContextCard';
    card.className = 'settings-card-subtle project-block-context-card';
    card.innerHTML = `
      <div class="section-head compact"><div><div class="smallcaps">Stage 19W1-W11</div><h3>Project block context + MCTS-lite</h3></div></div>
      <div class="settings-note compact">Parse this LaTeX file into blocks, embed them, match each block to literature/OpenReview trajectories, run MCTS-lite, and apply/reject suggestions as safe <code>\\laiold</code>/<code>\\lai</code> edits.</div>
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
      <div id="projectBlockOutput" class="devils-output stage19w11-output"><div class="settings-note compact">Project block/context results will appear here.</div></div>`;
    const placeholders = Array.from(parent.querySelectorAll('.settings-note')).filter(n => /Project block context card will appear here/i.test(n.textContent || ''));
    placeholders.forEach(n => n.remove());
    parent.appendChild(card);
    el('projectBlockAnalyzeBtn')?.addEventListener('click', ()=>analyze().catch(e=>{setStatus(e.message||e,'bad'); render();}));
    el('projectBlockMatchBtn')?.addEventListener('click', ()=>match().catch(e=>{setStatus(e.message||e,'bad'); render();}));
    el('projectBlockCitationBtn')?.addEventListener('click', ()=>citations().catch(e=>{setStatus(e.message||e,'bad'); render();}));
    el('projectBlockRelatedBtn')?.addEventListener('click', ()=>related().catch(e=>{setStatus(e.message||e,'bad'); render();}));
    el('projectBlockMctsBtn')?.addEventListener('click', ()=>mcts().catch(e=>{setStatus(e.message||e,'bad'); render();}));
    el('projectBlockOutput')?.addEventListener('click', handleOutputClick);
  }
  NS.ProjectBlockContextService = { stage:STAGE, analyze, match, citations, related, mcts, preview, applyPreview, feedback, state, getLastPromptContext:()=>state.lastPromptContext || promptContext(), promptContext };
  D.addEventListener('DOMContentLoaded', () => setTimeout(inject, 500));
})();
