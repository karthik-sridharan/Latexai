
(function(){
'use strict';
const STAGE='latex-stage19u7d-semantic-scholar-author-url-parser-fix-20260531-1';
const $=(id)=>document.getElementById(id);
const esc=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compact=(s,n=650)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length<=n?s:s.slice(0,n-1).trimEnd()+'…'};
const LS_API='luminaLiteratureApiBase';
const LS_TOKEN='luminaIngestToken';
function scanForApi(){
  const p=new URLSearchParams(location.search); if(p.get('api')) return normalizeApi(p.get('api'));
  const stored=localStorage.getItem(LS_API); if(stored) return normalizeApi(stored);
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i); const v=String(localStorage.getItem(k)||'');
    const m=v.match(/https:\/\/[^"'\s]+\.run\.app(?:\/api\/lumina(?:\/[A-Za-z0-9_\-/]+)?)?/);
    if(m) return normalizeApi(m[0]);
  }
  return location.origin.includes('github.io') ? '' : normalizeApi(location.origin+'/api/lumina');
}
function normalizeApi(v){
  v=String(v||'').trim().replace(/\/+$/,'');
  if(!v) return '';
  if(v.endsWith('/api/lumina')) return v;
  const idx=v.indexOf('/api/lumina/');
  if(idx>=0) return v.slice(0,idx)+'/api/lumina';
  if(v.includes('/api/lumina')) return v.slice(0,v.indexOf('/api/lumina'))+'/api/lumina';
  return v+'/api/lumina';
}
function api(){return normalizeApi($('apiBase').value)}
function token(){return $('token').value.trim()}
function headers(json=true){const h={}; if(json) h['Content-Type']='application/json'; const t=token(); if(t){h.Authorization='Bearer '+t; h['x-lumina-ingest-token']=t;} return h;}
function raw(obj){$('rawOut').textContent=typeof obj==='string'?obj:JSON.stringify(obj,null,2)}
function setBox(id,msg,cls='note'){const el=$(id); el.className=cls; el.innerHTML=msg;}
function parseSemanticScholarAuthorInput(value){
  const raw=String(value||'').trim().replace(/^[\"'`<>]+|[\"'`<>]+$/g,'');
  const out={raw,authorId:'',nameQuery:'',detected:false};
  if(!raw) return out;
  let decoded=raw;
  try{decoded=decodeURIComponent(raw)}catch(e){}
  const idMatch=decoded.match(/(?:authorId|author_id|S2AUTHOR)[:=]\s*([0-9A-Za-z_-]{2,80})/i);
  if(idMatch){out.authorId=idMatch[1];out.detected=true;}
  let probe=decoded;
  if(probe.includes('semanticscholar.org')&&!/^[a-z]+:\/\//i.test(probe)) probe='https://'+probe.replace(/^\/+/, '');
  try{
    const u=new URL(probe);
    if(u.hostname.toLowerCase().includes('semanticscholar.org')){
      const parts=u.pathname.split('/').filter(Boolean);
      const ix=parts.findIndex(p=>p.toLowerCase()==='author');
      if(ix>=0){
        const tail=parts.slice(ix+1);
        for(let i=tail.length-1;i>=0;i--){if(/^[0-9]{2,40}$/.test(tail[i])){out.authorId=tail[i];out.detected=true;break;}}
        const slug=tail.find(p=>!/^[0-9]{2,40}$/.test(p));
        if(slug){out.nameQuery=slug.replace(/[-_]+/g,' ').replace(/[.]+/g,' ').replace(/\s+/g,' ').trim();}
      }
    }
  }catch(e){/* not a URL */}
  if(!out.authorId){
    const m=decoded.match(/(?:^|\/)author\/[^\s]*\/([0-9]{2,40})(?:$|[/?#])/i)||decoded.match(/\/([0-9]{2,40})(?:$|[/?#])/);
    if(m&&decoded.toLowerCase().includes('semanticscholar')){out.authorId=m[1];out.detected=true;}
  }
  if(!out.authorId && /^[0-9A-Za-z_-]{3,80}$/.test(decoded) && !/\s/.test(decoded)){out.authorId=decoded;out.detected=true;}
  if(!out.nameQuery && !decoded.toLowerCase().includes('semanticscholar.org') && !decoded.startsWith('http')) out.nameQuery=decoded;
  return out;
}
async function fetchJson(path, opts={}, cfg={}){
  const base=api(); if(!base) throw new Error('Missing API base. Paste your Cloud Run backend URL or /api/lumina URL.');
  const res=await fetch(base+path, opts);
  const text=await res.text();
  let data;
  try{data=JSON.parse(text)}catch(e){throw new Error('Non-JSON HTTP '+res.status+': '+text.slice(0,300));}
  if(!res.ok) throw new Error((data.detail||data.error||data.message||('HTTP '+res.status)));
  if(data && data.ok===false && !cfg.allowApplicationError){
    const resultErrors=Array.isArray(data.results)?data.results.filter(r=>r&&r.ok===false).map(r=>r.error||r.detail||r.url).filter(Boolean).slice(0,3):[];
    const detail=resultErrors.length?resultErrors.join(' | '):(data.detail||data.error||data.message||('HTTP '+res.status));
    throw new Error(detail);
  }
  return data;
}
function saveSettings(){localStorage.setItem(LS_API, api()); localStorage.setItem(LS_TOKEN, token()); setBox('statusBox','Saved settings for this browser.','note good');}
async function status(){try{const data=await fetchJson('/latex/status',{headers:headers(false)}); raw(data); const storage=data.knowledgeStorage||data.storage||{}; setBox('statusBox',`<strong>Connected.</strong><br>stage=${esc(data.stage||'')}<br>searchSchema=${esc(data.searchSchema||'')} · hybrid=${esc(data.hybridRanking)} · pgvector=${esc(storage.pgvectorReady||storage.pgvector_enabled||'')}`,'note good');}catch(e){setBox('statusBox','Connection failed: '+esc(e.message),'note bad'); raw(String(e.stack||e));}}
function urlsFromText(t){return Array.from(new Set((String(t||'').match(/https?:\/\/[^\s,;<>"]+/g)||[]).map(u=>u.replace(/[).,;\]}]+$/,''))));}
function ingestSummary(data){
  const succeeded=Number(data.succeeded||0), failed=Number(data.failed||0), ready=Number(data.embeddingReady||0), requested=Number(data.requested||0);
  const retryable=Array.isArray(data.retryableFailedUrls)?data.retryableFailedUrls.length:0;
  let msg=`Batch finished: ${esc(succeeded)} succeeded, ${esc(failed)} failed, ${esc(ready)} embedding-ready.`;
  if(retryable) msg+=`<br>${esc(retryable)} retryable arXiv/upstream failure(s).`;
  if(failed && requested && failed===requested) msg+='<br><strong>No papers were ingested; see per-URL errors below.</strong>';
  return msg;
}
async function ingest(){
  const urls=urlsFromText($('urlList').value);
  if(!urls.length){setBox('ingestStatus','Enter at least one URL.','note warn');return;}
  setBox('ingestStatus','Ingesting '+urls.length+' URL(s)...','note');
  try{
    const data=await fetchJson('/ingest/batch',{method:'POST',headers:headers(),body:JSON.stringify({urls})},{allowApplicationError:true});
    raw(data);
    const cls=Number(data.failed||0)?(Number(data.succeeded||0)?'note warn':'note bad'):'note good';
    setBox('ingestStatus',ingestSummary(data),cls);
    $('results').innerHTML=renderBatch(data);
  }catch(e){
    setBox('ingestStatus','Ingestion request failed: '+esc(e.message),'note bad');
    raw(String(e.stack||e));
  }
}
async function lookup(){setBox('searchStatus','Looking up metadata...','note'); const body={title:$('lookupTitle').value,url:$('lookupUrl').value,doi:$('lookupDoi').value,arxivId:$('lookupArxiv').value,abstract:$('lookupAbstract').value}; try{const data=await fetchJson('/research/metadata/lookup',{method:'POST',headers:headers(),body:JSON.stringify(body)}); raw(data); $('lookupResults').innerHTML=renderWorkCard(data.work||{}, {lookup:true});}catch(e){$('lookupResults').innerHTML='<div class="note bad">Lookup failed: '+esc(e.message)+'</div>'; raw(String(e.stack||e));}}
async function loadLibrary(){setBox('libraryStatus','Loading library...','note'); try{const data=await fetchJson('/research/works',{headers:headers(false)}); raw(data); const works=data.works||[]; setBox('libraryStatus',`Loaded ${works.length} work(s).`,'note good'); $('libraryResults').innerHTML=works.map(w=>renderWorkCard(w,{library:true})).join('')||'<div class="note">No works found.</div>'; }catch(e){setBox('libraryStatus','Library load failed: '+esc(e.message),'note bad'); raw(String(e.stack||e));}}
async function enrichAll(){setBox('libraryStatus','Enriching library metadata...','note'); try{const data=await fetchJson('/research/enrich',{method:'POST',headers:headers(),body:JSON.stringify({all:true,limit:50})}); raw(data); setBox('libraryStatus',`Enrichment complete: requested=${esc(data.requested)}, changed=${esc(data.changed)}.`,'note good'); loadLibrary();}catch(e){setBox('libraryStatus','Enrich failed: '+esc(e.message),'note bad'); raw(String(e.stack||e));}}
async function enrichWork(id){try{const data=await fetchJson('/research/works/'+encodeURIComponent(id)+'/enrich',{method:'POST',headers:headers()}); raw(data); loadLibrary();}catch(e){raw('Enrich work failed: '+e.message);}}
async function search(){const query=$('searchQuery').value.trim(); if(!query){setBox('searchStatus','Enter a query.','note warn');return;} const topK=Math.max(1,Math.min(25,parseInt($('topK').value||'8',10))); setBox('searchStatus','Searching with hybrid retrieval...','note'); try{const data=await fetchJson('/research/search',{method:'POST',headers:headers(),body:JSON.stringify({query,topK,pinnedPapers:pinnedResults(feature())})}); raw(data); setBox('searchStatus',`Found ${esc(data.resultCount||0)} result(s). schema=${esc(data.schema||'')} hybrid=${esc(data.hybridRanking)} authorGraph=${esc(data.authorGraphRanking)}`,'note good'); renderResults(data.results||[]);}catch(e){setBox('searchStatus','Search failed: '+esc(e.message),'note bad'); raw(String(e.stack||e));}}
async function context(){const focus=$('searchQuery').value.trim(); if(!focus){setBox('searchStatus','Enter a focus/search query.','note warn');return;} const body={title:$('contextTitle').value,abstract:$('contextAbstract').value,focus,topK:Math.max(1,Math.min(12,parseInt($('topK').value||'8',10))),pinnedPapers:pinnedResults(feature())}; setBox('searchStatus','Building paper knowledge context...','note'); try{const data=await fetchJson('/knowledge/context-for-paper',{method:'POST',headers:headers(),body:JSON.stringify(body)}); raw(data); setBox('searchStatus',`Context ready: ${esc(data.resultCount||0)} result(s). schema=${esc(data.searchSchema||'')}`,'note good'); renderResults(data.results||[]); if(data.promptContext){$('results').insertAdjacentHTML('beforeend','<h3>Prompt context preview</h3><div class="output">'+esc(data.promptContext)+'</div>');}}catch(e){setBox('searchStatus','Context retrieval failed: '+esc(e.message),'note bad'); raw(String(e.stack||e));}}
let authorPreview=null;
async function authorLookup(){
  const query=$('authorQuery').value.trim();
  if(!query){setBox('authorStatus','Enter an author name, Semantic Scholar author URL, or author id.','note warn');return;}
  const parsed=parseSemanticScholarAuthorInput(query);
  const body={authorUrl:query,authorId:parsed.authorId||'',authorName:parsed.nameQuery||query,maxPapers:Math.max(1,Math.min(100,parseInt($('authorMaxPapers').value||'25',10))),sortBy:$('authorSortBy').value,keywordFilter:$('authorKeywordFilter').value};
  const detected=[];
  if(parsed.authorId) detected.push('Semantic Scholar author id '+parsed.authorId);
  if(parsed.nameQuery && parsed.nameQuery!==query) detected.push('name fallback "'+parsed.nameQuery+'"');
  setBox('authorStatus','Looking up Semantic Scholar author papers...'+(detected.length?' Detected: '+esc(detected.join(' · '))+'.':''),'note');
  try{
    const data=await fetchJson('/research/authors/lookup',{method:'POST',headers:headers(),body:JSON.stringify(body)},{allowApplicationError:true});
    raw(data); authorPreview=data;
    if(!data.ok){setBox('authorStatus','Author lookup did not find a match: '+esc(data.error||'')+(data.parsedAuthorId?' Parsed id='+esc(data.parsedAuthorId)+'.':'')+(data.parsedAuthorQuery?' Name fallback='+esc(data.parsedAuthorQuery)+'.':''),'note bad'); $('authorResults').innerHTML=renderAuthorCandidates(data.authorCandidates||[]); return;}
    const a=data.author||{};
    const parsedLine=(data.parsedAuthorId||data.parsedAuthorQuery)?` Parsed id=${esc(data.parsedAuthorId||'')} ${data.parsedAuthorQuery?'· name fallback='+esc(data.parsedAuthorQuery):''}.`:'';
    setBox('authorStatus',`Found ${esc(data.paperCount||0)} candidate paper(s) for ${esc(a.name||a.authorId||query)}.${parsedLine} Select the papers to import.`, 'note good');
    $('authorResults').innerHTML=renderAuthorPreview(data);
  }catch(e){setBox('authorStatus','Author lookup failed: '+esc(e.message),'note bad'); raw(String(e.stack||e));}
}
function renderAuthorCandidates(cands){
  if(!cands.length) return '<div class="note bad">No author candidates returned.</div>';
  return cands.map(a=>`<div class="result"><div class="title">${esc(a.name||'Unknown author')}</div><div class="muted">Semantic Scholar authorId: ${esc(a.authorId||'')} · papers=${esc(a.paperCount||'')} · citations=${esc(a.citationCount||'')}</div>${a.url?'<a class="btn mini" target="_blank" href="'+esc(a.url)+'">Open</a>':''}</div>`).join('');
}
function renderAuthorPreview(data){
  const a=data.author||{}; const papers=data.papers||[];
  const head=`<div class="result"><div class="title">${esc(a.name||'Semantic Scholar author')}</div><div class="muted">authorId=${esc(a.authorId||'')} · papers=${esc(a.paperCount||'')} · citations=${esc(a.citationCount||'')} · h=${esc(a.hIndex||'')}</div>${a.url?'<a class="btn mini" target="_blank" href="'+esc(a.url)+'">Open author page</a>':''}</div>`;
  const rows=papers.map((p,i)=>renderAuthorPaperRow(p,i)).join('') || '<div class="note">No papers matched this filter.</div>';
  return head+'<h3>Candidate papers</h3>'+rows;
}
function renderAuthorPaperRow(p,i){
  const id=esc(p.paperId||p.importCandidateKey||('paper-'+i));
  const authors=Array.isArray(p.authors)?p.authors.map(a=>a&&a.name?a.name:a).filter(Boolean).slice(0,8).join(', '):'';
  const ext=p.externalIds||{};
  const badges=[];
  if(p.alreadyIngested) badges.push('<span class="badge gold">already ingested</span>');
  if(ext.ArXiv) badges.push('<span class="badge gold">arXiv '+esc(ext.ArXiv)+'</span>');
  if(ext.DOI) badges.push('<span class="badge gold">DOI</span>');
  if(p.citationCount!=null) badges.push('<span class="badge blue">citations '+esc(p.citationCount)+'</span>');
  if(p.year) badges.push('<span class="badge blue">'+esc(p.year)+'</span>');
  return `<div class="paper-row"><input type="checkbox" class="author-paper-check" data-paper-id="${id}" ${p.alreadyIngested?'':'checked'} /><div><div class="title">${i+1}. ${esc(p.title||'Untitled paper')}</div><div class="paper-meta">${esc(authors)} ${p.venue?' · '+esc(p.venue):''}</div><div class="badges">${badges.join('')}</div><div class="snippet">${esc(compact(p.abstract||'',480))}</div><div class="paper-actions">${p.url?'<a class="btn mini" target="_blank" href="'+esc(p.url)+'">Open</a>':''}${p.existingWorkId?'<span class="badge">existing '+esc(p.existingWorkId)+'</span>':''}</div></div></div>`;
}
function authorSelectedPapers(allShown=false){
  const papers=(authorPreview&&authorPreview.papers)||[];
  if(allShown) return papers;
  const checked=new Set(Array.from(document.querySelectorAll('.author-paper-check:checked')).map(x=>String(x.dataset.paperId||'')));
  return papers.filter(p=>checked.has(String(p.paperId||p.importCandidateKey||'')));
}
function authorSelectAll(v=true){document.querySelectorAll('.author-paper-check').forEach(x=>{x.checked=!!v;});}
async function authorImport(allShown=false){
  if(!authorPreview||!authorPreview.ok){setBox('authorStatus','Preview an author first.','note warn');return;}
  const papers=authorSelectedPapers(allShown);
  if(!papers.length){setBox('authorStatus','Select at least one paper to import.','note warn');return;}
  const body={author:authorPreview.author,papers,enrichExisting:$('authorEnrichExisting').checked,embed:true};
  setBox('authorStatus','Importing '+papers.length+' author paper(s)...','note');
  try{
    const data=await fetchJson('/research/authors/import',{method:'POST',headers:headers(),body:JSON.stringify(body)},{allowApplicationError:true});
    raw(data);
    const cls=(data.results||[]).some(r=>r&&r.ok===false)?'note warn':'note good';
    setBox('authorStatus',`Author import finished: imported=${esc(data.imported||0)}, skipped=${esc(data.skipped||0)}, embeddingReady=${esc(data.embeddingReady||0)}.`,cls);
    $('authorResults').insertAdjacentHTML('afterbegin','<div class="note good">Import finished. Refresh library or search by title/author.</div>');
  }catch(e){setBox('authorStatus','Author import failed: '+esc(e.message),'note bad'); raw(String(e.stack||e));}
}
function feature(){return $('pinFeature').value||'paper-ai'}
function keyOf(r){return String(r.paper_id||r.paperId||r.id||r.workId||r.url||r.source_url||r.arxiv_id||r.doi||r.title||'').toLowerCase().slice(0,500)}
function pinKey(f){return 'latexai:knowledge-pinned:'+f} function exKey(f){return 'latexai:knowledge-excluded:'+f}
function getJson(k,d){try{return JSON.parse(localStorage.getItem(k)||'')||d}catch(e){return d}}
function setJson(k,v){localStorage.setItem(k,JSON.stringify(v))}
function normalizePin(r){const m=r.metadata||{}; const chunk=r.bestChunk||{}; return {key:keyOf(r),title:r.title||'Untitled paper',authors:Array.isArray(r.authors)?r.authors:[],year:r.year||'',url:r.url||r.source_url||'',score:r.score,hybridScore:r.hybridScore||r.score,semanticScore:r.semanticScore||null,snippet:(chunk.snippet||r.snippet||r.abstract||'').slice(0,900),scoreBreakdown:r.scoreBreakdown||{},retrievalReasons:Array.isArray(r.retrievalReasons)?r.retrievalReasons:[],metadata:m,raw:r};}
function pinnedResults(f=feature()){return (getJson(pinKey(f),[])||[]).filter(x=>x&&x.key)}
function excludedSet(f=feature()){return new Set(getJson(exKey(f),[])||[])}
function pin(r, all=false){const targets=all?['paper-ai','competitive-review','reviewer-rebuttal','devils-advocate','knowledge']:[feature()]; targets.forEach(f=>{const nr=normalizePin(r); if(!nr.key)return; const list=pinnedResults(f).filter(x=>x.key!==nr.key); list.unshift(nr); setJson(pinKey(f),list.slice(0,20));}); setBox('pinStatus','Pinned to '+(all?'all workflows':feature())+'.','note good');}
function exclude(r){const k=keyOf(r); const set=excludedSet(); set.add(k); setJson(exKey(feature()),Array.from(set)); setBox('pinStatus','Excluded from '+feature()+'.','note warn');}
function clearPins(){setJson(pinKey(feature()),[]);setBox('pinStatus','Cleared pins for '+feature()+'.','note')} function clearEx(){setJson(exKey(feature()),[]);setBox('pinStatus','Cleared exclusions for '+feature()+'.','note')}
function showPins(){const list=pinnedResults(); $('results').innerHTML='<h3>Pinned for '+esc(feature())+'</h3>'+(list.map((p,i)=>renderResultCard(p.raw||p,i)).join('')||'<div class="note">No pins.</div>'); setBox('pinStatus','Showing pins for '+feature()+'.','note')}
function renderBatch(data){const rs=data.results||[]; return rs.map(r=>`<div class="result"><div class="title">${r.ok?'✓':'✗'} ${esc(r.title||r.url||r.workId||'item')}</div><div class="muted">${esc(r.url||'')}</div><div class="badges"><span class="badge ${r.ok?'good':'bad'}">${r.ok?'ingested':'failed'}</span><span class="badge blue">chunks=${esc(r.chunkCount||0)}</span><span class="badge blue">embedded=${esc(r.embeddedChunkCount||0)}</span></div>${r.error?'<div class="note bad">'+esc(r.error)+'</div>':''}</div>`).join('')||'<div class="note">No results.</div>'}
function renderWorkCard(w,opts={}){const m=w.metadata||{}; const enr=m.metadataEnrichment||{}; const ids=m.externalIds||{}; const keys=m.canonicalAuthorKeys||[]; const title=w.title||'Untitled paper'; const authors=Array.isArray(w.authors)?w.authors.join(', '):(w.authors_json||''); const id=w.id||w.workId||''; return `<div class="result"><div class="title">${esc(title)}</div><div class="muted">${esc(authors)} ${w.year?' · '+esc(w.year):''}</div><div class="badges"><span class="badge blue">${esc(m.embeddingStatus||'embedding?')}</span>${m.embeddingModel?'<span class="badge">'+esc(m.embeddingModel)+'</span>':''}${w.arxiv_id?'<span class="badge gold">arXiv '+esc(w.arxiv_id)+'</span>':''}${w.doi?'<span class="badge gold">DOI</span>':''}${ids.SemanticScholar||m.semanticScholar?.paperId?'<span class="badge gold">Semantic Scholar</span>':''}${m.dblp?'<span class="badge gold">DBLP</span>':''}</div>${keys.length?'<div class="muted"><strong>Canonical authors:</strong> '+esc(keys.join(', '))+'</div>':''}${enr.matched?'<div class="note good">Enrichment matched: '+esc(JSON.stringify(enr.matched))+'</div>':''}<div class="snippet">${esc(compact(w.abstract||m.abstract||''))}</div><div class="row" style="margin-top:8px">${w.url?'<a class="btn mini" target="_blank" href="'+esc(w.url)+'">Open source</a>':''}${id?'<button class="btn mini" data-enrich-work="'+esc(id)+'">Enrich this work</button>':''}</div></div>`}
function renderResults(results){$('results').innerHTML=(results||[]).map(renderResultCard).join('')||'<div class="note">No results.</div>'}
function renderResultCard(r,i){const m=r.metadata||{}; const chunk=r.bestChunk||{}; const reasons=Array.isArray(r.retrievalReasons)?r.retrievalReasons:[]; const breakdown=r.scoreBreakdown||{}; const authors=Array.isArray(r.authors)?r.authors.join(', '):''; const score=(r.hybridScore??r.score); const sem=r.semanticScore; const id='r'+Math.random().toString(36).slice(2); window.__litResults=window.__litResults||{}; window.__litResults[id]=r; return `<div class="result"><div class="title">${i+1}. ${esc(r.title||'Untitled paper')}</div><div class="muted">${esc(authors)} ${r.year?' · '+esc(r.year):''}</div><div class="badges"><span class="badge good">hybrid=${num(score)}</span>${sem!=null?'<span class="badge blue">semantic='+num(sem)+'</span>':''}${m.semanticScholar?.paperId?'<span class="badge gold">S2</span>':''}${m.dblp?'<span class="badge gold">DBLP</span>':''}${(m.canonicalAuthorKeys||[]).length?'<span class="badge gold">author keys</span>':''}</div>${reasons.length?'<div class="note"><strong>Why retrieved:</strong> '+esc(reasons.join('; '))+'</div>':''}<div class="scorebox">${esc(Object.keys(breakdown).length?JSON.stringify(breakdown,null,2):'No score breakdown returned.')}</div><div class="snippet">${esc(compact(chunk.snippet||r.snippet||r.abstract||''))}</div><div class="row" style="margin-top:8px"><button class="btn mini primary" data-pin="${id}">Pin to selected workflow</button><button class="btn mini" data-pin-all="${id}">Pin all workflows</button><button class="btn mini danger" data-exclude="${id}">Exclude selected workflow</button>${r.url?'<a class="btn mini" target="_blank" href="'+esc(r.url)+'">Open</a>':''}</div></div>`}
function num(v){const n=Number(v);return Number.isFinite(n)?n.toFixed(3):esc(v||'')}
function copyDebug(){navigator.clipboard?.writeText($('rawOut').textContent||''); setBox('pinStatus','Copied diagnostics/output.','note good')}
function bind(){
  $('apiBase').value=scanForApi(); $('token').value=localStorage.getItem(LS_TOKEN)||'';
  $('saveSettingsBtn').onclick=saveSettings; $('statusBtn').onclick=status; $('ingestBtn').onclick=ingest; $('resetIngestBtn').onclick=()=>{$('urlList').value=''}; $('lookupBtn').onclick=lookup; $('authorLookupBtn').onclick=authorLookup; $('authorSelectAllBtn').onclick=()=>authorSelectAll(true); $('authorClearSelectionBtn').onclick=()=>authorSelectAll(false); $('authorImportSelectedBtn').onclick=()=>authorImport(false); $('authorImportTopBtn').onclick=()=>authorImport(true); $('loadLibraryBtn').onclick=()=>{activate('library');loadLibrary()}; $('libraryRefreshBtn').onclick=loadLibrary; $('enrichAllBtn').onclick=enrichAll; $('libraryEnrichSelectedBtn').onclick=enrichAll; $('searchBtn').onclick=search; $('contextBtn').onclick=context; $('clearResultsBtn').onclick=()=>{$('results').innerHTML='';}; $('clearPinsBtn').onclick=clearPins; $('clearExclusionsBtn').onclick=clearEx; $('showPinsBtn').onclick=showPins; $('copyDebugBtn').onclick=copyDebug;
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>activate(t.dataset.tab));
  document.body.addEventListener('click',ev=>{const b=ev.target.closest('button'); if(!b)return; const id=b.dataset.pin||b.dataset.pinAll||b.dataset.exclude||''; if(id&&window.__litResults&&window.__litResults[id]){if(b.dataset.pin)pin(window.__litResults[id]); if(b.dataset.pinAll)pin(window.__litResults[id],true); if(b.dataset.exclude)exclude(window.__litResults[id]);} if(b.dataset.enrichWork) enrichWork(b.dataset.enrichWork);});
  if($('apiBase').value) status();
}
function activate(name){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));}
bind();
})();
