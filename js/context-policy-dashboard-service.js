// Stage 19W9: context-policy logging dashboard for block/review/MCTS events.
(function(){
  'use strict';
  const W = window;
  const D = document;
  const NS = W.LuminaLatex = W.LuminaLatex || {};
  const STAGE = 'latex-stage19w9-context-policy-logging-dashboard-20260602-1';
  const state = { dashboard:null, status:null, selectedEvent:null };
  function el(id){ return D.getElementById(id); }
  function clean(s){ return String(s || '').trim(); }
  function backendRoot(){
    const raw = clean(NS.BackendUrlSettingsService?.getMemoryApiBaseUrl?.() || NS.BackendUrlSettings?.getMemoryApiBaseUrl?.() || el('memoryBackendUrl')?.value || localStorage.getItem('lumina-latex.memory.backendUrl') || localStorage.getItem('latexai:memory-backend-url') || '');
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
  async function request(path, opts){
    const root = backendRoot();
    if (!root) throw new Error('Set Memory backend URL in Settings first.');
    const res = await fetch(root + path, opts || {headers:headers()});
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : {}; } catch(_e){ data = {raw:text}; }
    if (!res.ok || data.ok === false) throw new Error(data.detail || data.message || data.error?.message || ('HTTP '+res.status+': '+text));
    return data;
  }
  async function get(path){ return request(path, {method:'GET', headers:headers()}); }
  async function post(path, body){ return request(path, {method:'POST', headers:headers(), body:JSON.stringify(body || {})}); }
  function setStatus(msg, kind){ const n=el('contextPolicyStatus'); if(n){ n.textContent=String(msg||''); n.dataset.kind=kind||''; } }
  function fmtTime(ms){
    const n = Number(ms || 0);
    if (!n) return '';
    try { return new Date(n).toLocaleString(); } catch(_e){ return String(n); }
  }
  function fmtReward(v){ return (v === null || v === undefined || v === '') ? '—' : Number(v).toFixed(3).replace(/\.000$/,''); }
  function pill(label, value){ return `${label}: ${value === undefined || value === null || value === '' ? '—' : value}`; }
  function summaryLine(arr){
    if (!Array.isArray(arr) || !arr.length) return '—';
    return arr.slice(0,8).map(x => `${x.key || 'unknown'} (${x.count || 0})`).join(' · ');
  }
  function filters(){
    return {
      source: clean(el('contextPolicySource')?.value || 'all'),
      workflow: clean(el('contextPolicyWorkflow')?.value),
      phase: clean(el('contextPolicyPhase')?.value),
      outcome: clean(el('contextPolicyOutcome')?.value),
      projectId: clean(el('contextPolicyProject')?.value),
      limit: Number(el('contextPolicyLimit')?.value || 120)
    };
  }
  function qs(obj){
    const p = new URLSearchParams();
    Object.entries(obj || {}).forEach(([k,v])=>{ if(v !== undefined && v !== null && String(v) !== '') p.set(k, String(v)); });
    return p.toString();
  }
  function render(){
    const out = el('contextPolicyOutput');
    if (!out) return;
    const data = state.dashboard;
    if (!data) { out.textContent = 'Context-policy events will appear here.'; return; }
    const s = data.summary || {};
    const lines = [];
    lines.push(`CONTEXT-POLICY DASHBOARD — ${data.filteredEventCount || 0}/${data.totalEventCount || 0} event(s)`);
    lines.push(`Stage: ${data.stage || ''}`);
    lines.push('');
    lines.push('SUMMARY');
    lines.push('  ' + pill('sources', summaryLine(s.bySource)));
    lines.push('  ' + pill('workflows', summaryLine(s.byWorkflow)));
    lines.push('  ' + pill('phases', summaryLine(s.byPhase)));
    lines.push('  ' + pill('outcomes', summaryLine(s.byOutcome)));
    if (s.rewardStats) lines.push(`  rewards: count=${s.rewardStats.count || 0}, mean=${fmtReward(s.rewardStats.mean)}, min=${fmtReward(s.rewardStats.min)}, max=${fmtReward(s.rewardStats.max)}`);
    lines.push('');
    lines.push('RECENT EVENTS');
    (data.recentEvents || []).slice(0, Number(el('contextPolicyRenderLimit')?.value || 30)).forEach((ev,i)=>{
      lines.push(`${i+1}. ${ev.id || ''}`);
      lines.push(`   ${fmtTime(ev.createdAtMs)} · source=${ev.source || ''} · workflow=${ev.workflow || ''} · phase=${ev.phase || ''}`);
      lines.push(`   project=${ev.projectId || '—'} · outcome=${ev.outcome || '—'} · reward=${fmtReward(ev.rewardValue)}`);
      if (ev.blockCount || (ev.blockIds||[]).length) lines.push(`   blocks=${ev.blockCount || (ev.blockIds||[]).length}: ${(ev.blockIds||[]).slice(0,5).join(', ')}`);
      if (ev.resultCount !== undefined) lines.push(`   review results=${ev.resultCount}, topK=${ev.topK || 0}, trajectory=${!!ev.includeTrajectory}, chunks=${!!ev.includeChunks}`);
      if (ev.rolloutCount !== undefined) lines.push(`   rollouts=${ev.rolloutCount}, best=${ev.bestBranchId || ''}, bestValue=${fmtReward(ev.bestValueScore)}`);
      if (ev.queryPreview) lines.push(`   query: ${String(ev.queryPreview).replace(/\s+/g,' ').slice(0,220)}`);
      const keys = ev.contextSummary?.keys;
      if (Array.isArray(keys) && keys.length) lines.push(`   context keys: ${keys.slice(0,8).join(', ')}`);
    });
    out.textContent = lines.join('\n');
  }
  async function refresh(){
    setStatus('Loading context-policy dashboard…');
    const data = await get('/context-policy/dashboard?' + qs(filters()));
    state.dashboard = data;
    setStatus(`Loaded ${data.filteredEventCount || 0} event(s).`, 'good');
    render();
    return data;
  }
  async function loadStatus(){
    const data = await get('/context-policy/status');
    state.status = data;
    setStatus(`Status: ${data.eventCounts?.total || 0} total event(s).`, 'good');
    return data;
  }
  async function seed(){
    setStatus('Writing test context-policy event…');
    const data = await post('/context-policy/log', {workflow:'context-policy-dashboard', phase:'manual_test', outcome:'seeded', projectId:clean(el('contextPolicyProject')?.value || 'default'), contextBundle:{dashboardSeed:true, stage:STAGE}, rewardValue:0.1, metadata:{source:'frontend-dashboard-seed'}});
    setStatus(`Seeded ${data.event?.id || 'event'}.`, 'good');
    await refresh();
  }
  function recentIds(){ return (state.dashboard?.recentEvents || []).map(ev => ev.id).filter(Boolean); }
  async function feedback(outcome, reward){
    const id = clean(el('contextPolicyFeedbackId')?.value) || recentIds()[0] || '';
    if (!id) throw new Error('No event id available. Refresh or paste an event id first.');
    setStatus(`Marking ${id} as ${outcome}…`);
    await post('/context-policy/feedback', {eventId:id, outcome, rewardValue:reward, note:clean(el('contextPolicyFeedbackNote')?.value)});
    setStatus(`Marked ${id} as ${outcome}.`, 'good');
    await refresh();
  }
  function copyJson(){
    const text = JSON.stringify(state.dashboard || {}, null, 2);
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(()=>{});
    setStatus('Copied dashboard JSON.', 'good');
  }
  function inject(){
    if (el('contextPolicyDashboardCard')) return;
    const parent = el('copilotTab') || D.querySelector('.right-tab-panel');
    if (!parent) return;
    const card = D.createElement('div');
    card.id = 'contextPolicyDashboardCard';
    card.className = 'settings-card-subtle context-policy-dashboard-card';
    card.innerHTML = `
      <div class="section-head compact"><div><div class="smallcaps">Stage 19W9</div><h3>Context-policy logging dashboard</h3></div></div>
      <div class="settings-note compact">Inspect block-context, OpenReview retrieval, and MCTS-lite events. Mark events as accepted/rejected so later learned context policies have clean rewards.</div>
      <div class="field-grid two compact">
        <label class="field">Source
          <select id="contextPolicySource">
            <option value="all">all</option>
            <option value="context_bundle">context bundle</option>
            <option value="review_corpus">review corpus</option>
            <option value="mcts_selfplay">MCTS self-play</option>
          </select>
        </label>
        <label class="field">Limit <input id="contextPolicyLimit" type="number" min="1" max="1000" value="160" /></label>
        <label class="field">Workflow filter <input id="contextPolicyWorkflow" type="text" placeholder="reviewer, project-block, mcts..." /></label>
        <label class="field">Phase filter <input id="contextPolicyPhase" type="text" placeholder="run, retrieval, match..." /></label>
        <label class="field">Outcome filter <input id="contextPolicyOutcome" type="text" placeholder="accepted, rejected, generated..." /></label>
        <label class="field">Project filter <input id="contextPolicyProject" type="text" placeholder="optional project id" /></label>
        <label class="field">Render recent <input id="contextPolicyRenderLimit" type="number" min="5" max="200" value="40" /></label>
        <label class="field">Feedback event id <input id="contextPolicyFeedbackId" type="text" placeholder="defaults to newest visible event" /></label>
      </div>
      <label class="field">Feedback note <input id="contextPolicyFeedbackNote" type="text" placeholder="optional: why accepted/rejected/useful" /></label>
      <div class="devils-actions">
        <button id="contextPolicyStatusBtn" class="btn mini" type="button">Status</button>
        <button id="contextPolicyRefreshBtn" class="btn mini primary" type="button">Refresh dashboard</button>
        <button id="contextPolicySeedBtn" class="btn mini" type="button">Seed test event</button>
        <button id="contextPolicyAcceptedBtn" class="btn mini" type="button">Mark accepted</button>
        <button id="contextPolicyRejectedBtn" class="btn mini" type="button">Mark rejected</button>
        <button id="contextPolicyCopiedBtn" class="btn mini" type="button">Mark copied/useful</button>
        <button id="contextPolicyCopyJsonBtn" class="btn mini" type="button">Copy JSON</button>
      </div>
      <div id="contextPolicyStatus" class="settings-note compact">Ready.</div>
      <pre id="contextPolicyOutput" class="devils-output">Context-policy events will appear here.</pre>`;
    const ref = el('projectBlockContextCard') || el('reviewerRebuttalSimulatorCard') || el('copilotOutput');
    if (ref && ref.parentNode === parent) parent.insertBefore(card, ref.nextSibling); else parent.appendChild(card);
    el('contextPolicyStatusBtn')?.addEventListener('click', ()=>loadStatus().catch(e=>setStatus(e.message||e,'bad')));
    el('contextPolicyRefreshBtn')?.addEventListener('click', ()=>refresh().catch(e=>{setStatus(e.message||e,'bad'); render();}));
    el('contextPolicySeedBtn')?.addEventListener('click', ()=>seed().catch(e=>setStatus(e.message||e,'bad')));
    el('contextPolicyAcceptedBtn')?.addEventListener('click', ()=>feedback('accepted', 1).catch(e=>setStatus(e.message||e,'bad')));
    el('contextPolicyRejectedBtn')?.addEventListener('click', ()=>feedback('rejected', -1).catch(e=>setStatus(e.message||e,'bad')));
    el('contextPolicyCopiedBtn')?.addEventListener('click', ()=>feedback('copied_useful', 0.5).catch(e=>setStatus(e.message||e,'bad')));
    el('contextPolicyCopyJsonBtn')?.addEventListener('click', copyJson);
  }
  NS.ContextPolicyDashboardService = {stage:STAGE, state, refresh, loadStatus, seed, feedback, inject};
  D.addEventListener('DOMContentLoaded', () => setTimeout(inject, 750));
})();
