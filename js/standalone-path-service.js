/* Latexai Stage 14B StandalonePathService
 * Stage: stage14b-standalone-path-fixer-1
 *
 * Root-aware path checker/fixer for active standalone files.
 * It scans input/include/includegraphics/bibliography/addbibresource paths,
 * verifies project files exist, and fixes common talk/../figures path issues.
 */
(function () {
  'use strict';
  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage14b-standalone-path-fixer-1';
  let lastReport = null;

  function State() { return NS.State; }
  function el(id) { return document.getElementById(id); }
  function normalizePath(path) {
    try { return State()?.normalizePath?.(path) || String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
    catch (_err) { return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/'); }
  }
  function dirname(path) { const p = normalizePath(path); const i = p.lastIndexOf('/'); return i >= 0 ? p.slice(0, i) : ''; }
  function joinPath(base, rel) {
    const raw = normalizePath(base ? `${base}/${rel}` : rel);
    const parts = [];
    for (const part of raw.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') parts.pop(); else parts.push(part);
    }
    return parts.join('/');
  }
  function project() { return State()?.state?.project || {}; }
  function files() { return project().files || []; }
  function fileText(file) { return String(file?.text ?? file?.content ?? file?.source ?? file?.value ?? ''); }
  function textFile(file) { try { return !!State()?.textFile?.(file); } catch (_err) {} return file && !file.base64 && !['asset','binary'].includes(file.kind); }
  function getFile(path) {
    const normalized = normalizePath(path);
    try { const found = State()?.getFile?.(normalized); if (found) return found; } catch (_err) {}
    return files().find((file) => normalizePath(file.path) === normalized) || null;
  }
  function fileExists(path) { return Boolean(getFile(path)); }

  function activeTexFile() {
    try { const fromCompileRoot = NS.CompileRootService?.activeTexFile?.(); if (fromCompileRoot?.path) return fromCompileRoot; } catch (_err) {}
    const pill = String(el('activeFilePill')?.textContent || '').trim();
    if (pill) {
      const direct = getFile(pill);
      if (direct && /\.tex$/i.test(direct.path || '')) return { path: normalizePath(direct.path), file: direct, text: fileText(direct) };
      const matches = files().filter((file) => /\.tex$/i.test(file.path || '')).filter((file) => normalizePath(file.path).endsWith(`/${pill}`) || normalizePath(file.path) === pill);
      if (matches.length === 1) return { path: normalizePath(matches[0].path), file: matches[0], text: fileText(matches[0]) };
    }
    return null;
  }
  function isStandaloneTex(text) {
    try { return NS.CompileRootService?.isStandaloneTex?.(text); } catch (_err) {}
    const s = String(text || '');
    return /\\documentclass(?:\s*\[[^\]]*\])?\s*\{[^}]+\}/.test(s) && /\\begin\{document\}/.test(s) && /\\end\{document\}/.test(s);
  }
  function stripComments(text) {
    return String(text || '').split('\n').map((line) => {
      let escaped = false;
      for (let i=0;i<line.length;i+=1) {
        const ch=line[i];
        if (ch === '\\') { escaped = !escaped; continue; }
        if (ch === '%' && !escaped) return line.slice(0,i);
        escaped = false;
      }
      return line;
    }).join('\n');
  }
  function splitCommaPaths(value) { return String(value || '').split(',').map((s)=>s.trim()).filter(Boolean); }
  function extensionCandidates(raw, command) {
    const p = normalizePath(String(raw || '').trim());
    if (!p) return [];
    if (/\.[A-Za-z0-9]+$/.test(p)) return [p];
    if (command === 'includegraphics') return [p, `${p}.pdf`, `${p}.png`, `${p}.jpg`, `${p}.jpeg`, `${p}.svg`];
    if (command === 'bibliography' || command === 'addbibresource') return [p, `${p}.bib`];
    if (command === 'include') return [p, `${p}.tex`];
    return [p, `${p}.tex`, `${p}.tikz.tex`];
  }
  function parseReferences(text) {
    const clean = stripComments(text);
    const refs = [];
    const patterns = [
      { command:'input', re:/\\input\s*\{([^{}]+)\}/g },
      { command:'include', re:/\\include\s*\{([^{}]+)\}/g },
      { command:'includegraphics', re:/\\includegraphics\s*(?:\[[^\]]*\]\s*)?\{([^{}]+)\}/g },
      { command:'bibliography', re:/\\bibliography\s*\{([^{}]+)\}/g },
      { command:'addbibresource', re:/\\addbibresource\s*(?:\[[^\]]*\]\s*)?\{([^{}]+)\}/g }
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.re.exec(clean))) {
        const raws = pattern.command === 'bibliography' ? splitCommaPaths(match[1]) : [match[1].trim()];
        for (const raw of raws) {
          if (/^(https?:|data:|mailto:)/i.test(raw)) continue;
          refs.push({ command:pattern.command, raw, fullMatch:match[0], index:match.index });
        }
      }
    }
    return refs;
  }
  function unique(list) { return [...new Set(list.filter(Boolean))]; }
  function resolveReference(ref, sourcePath) {
    const dir = dirname(sourcePath);
    const candidates = [];
    for (const candidate of extensionCandidates(ref.raw, ref.command)) {
      candidates.push(normalizePath(candidate));
      candidates.push(joinPath(dir, candidate));
    }
    const existing = unique(candidates).find(fileExists);
    return { existing: existing || '', candidates: unique(candidates) };
  }
  function suggestedPath(ref, sourcePath) {
    const raw = normalizePath(ref.raw);
    const dir = dirname(sourcePath);
    if (dir === 'talk' && raw.startsWith('../figures/')) {
      const projectPath = normalizePath(raw.replace(/^\.\.\//, ''));
      if (fileExists(projectPath)) return projectPath;
    }
    if (dir === 'talk' && raw.startsWith('figures/')) {
      const talkRelative = normalizePath(`../${raw}`);
      if (fileExists(raw)) return talkRelative;
    }
    const sourceRelative = joinPath(dir, raw);
    if (!fileExists(raw) && fileExists(sourceRelative)) return sourceRelative.startsWith(`${dir}/`) ? sourceRelative.slice(dir.length + 1) : raw;
    if (!fileExists(sourceRelative) && fileExists(raw)) return raw;
    for (const candidate of extensionCandidates(raw, ref.command)) {
      if (fileExists(candidate)) return candidate;
      const relCandidate = joinPath(dir, candidate);
      if (fileExists(relCandidate)) return candidate;
    }
    return '';
  }
  function pathRisk(ref, sourcePath) {
    const raw = normalizePath(ref.raw);
    const dir = dirname(sourcePath);
    if (dir === 'talk' && raw.startsWith('../figures/')) return 'talk file uses ../figures path; project-root compilers may fail';
    if (raw.startsWith('../') && !fileExists(joinPath(dir, raw))) return 'path climbs above source directory and target was not found';
    return '';
  }
  function checkStandalonePaths() {
    const active = activeTexFile();
    if (!active) return { ok:true, sourcePath:'', standalone:false, references:[], missing:[], risky:[], fixes:[], message:'No active .tex file found.' };
    const standalone = isStandaloneTex(active.text);
    const refs = parseReferences(active.text);
    const checked = refs.map((ref) => {
      const resolved = resolveReference(ref, active.path);
      const suggestion = suggestedPath(ref, active.path);
      const risk = pathRisk(ref, active.path);
      return { ...ref, sourcePath:active.path, resolvedPath:resolved.existing, candidates:resolved.candidates, missing:!resolved.existing, risky:Boolean(risk), risk, suggestion, fixable:Boolean(suggestion && suggestion !== normalizePath(ref.raw)) };
    });
    const missing = checked.filter((item)=>item.missing);
    const risky = checked.filter((item)=>item.risky);
    const fixes = checked.filter((item)=>item.fixable);
    return { ok: missing.length===0 && fixes.length===0, sourcePath:active.path, standalone, references:checked, missing, risky, fixes, message: standalone ? 'Active file is standalone.' : 'Active .tex file is not standalone.' };
  }
  function formatReport(report) {
    const lines = ['Standalone compile path report','==============================','',`Source file: ${report.sourcePath || '(none)'}`,`Standalone: ${report.standalone ? 'yes' : 'no'}`,`References: ${report.references.length}`,`Missing: ${report.missing.length}`,`Risky: ${report.risky.length}`,`Fixable: ${report.fixes.length}`,''];
    if (report.references.length) {
      lines.push('References','----------');
      for (const ref of report.references) {
        const status = ref.resolvedPath ? `FOUND ${ref.resolvedPath}` : 'MISSING';
        lines.push(`- \\${ref.command}{${ref.raw}} → ${status}`);
        if (ref.risk) lines.push(`  risk: ${ref.risk}`);
        if (ref.fixable) lines.push(`  suggested: ${ref.suggestion}`);
      }
      lines.push('');
    }
    lines.push(report.ok ? 'No required path fixes were found.' : 'Review missing/risky paths, or click Fix active standalone paths.');
    return lines.join('\n');
  }
  function setStatus(message) { const node=el('standalonePathStatus'); if (node) node.textContent = message; }
  function setOutput(text) { const log=el('compileLog'); if (log) log.textContent = String(text || ''); }
  function showPathReport() { const report=checkStandalonePaths(); lastReport=report; setOutput(formatReport(report)); setStatus(report.ok ? 'Standalone paths look OK.' : `Found ${report.fixes.length} fixable path issue(s).`); return report; }
  function replaceReferenceRaw(text, ref, replacement) {
    const escaped = ref.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (ref.command === 'includegraphics') return text.replace(new RegExp(`(\\\\includegraphics\\s*(?:\\[[^\\]]*\\]\\s*)?\\{)${escaped}(\\})`, 'g'), `$1${replacement}$2`);
    if (ref.command === 'addbibresource') return text.replace(new RegExp(`(\\\\addbibresource\\s*(?:\\[[^\\]]*\\]\\s*)?\\{)${escaped}(\\})`, 'g'), `$1${replacement}$2`);
    return text.replace(new RegExp(`(\\\\${ref.command}\\s*\\{)${escaped}(\\})`, 'g'), `$1${replacement}$2`);
  }
  function fixActiveStandalonePaths() {
    const active = activeTexFile();
    if (!active) { setStatus('No active .tex file to fix.'); return { ok:false, error:'No active .tex file.' }; }
    const report = checkStandalonePaths();
    if (!report.fixes.length) { lastReport=report; setOutput(formatReport(report)); setStatus('No fixable standalone path issues found.'); return { ok:true, changed:0, report }; }
    let text = active.text;
    let changed = 0;
    for (const ref of report.fixes) { text = replaceReferenceRaw(text, ref, ref.suggestion); changed += 1; }
    try { State()?.updateFile?.(active.path, text); } catch (_err) { const file = getFile(active.path); if (file) file.text = text; }
    if (el('sourceEditor') && String(el('sourceEditor').value || '') === active.text) el('sourceEditor').value = text;
    try { NS.Editor?.render?.(); } catch (_err) {}
    try { State()?.save?.(); } catch (_err) {}
    const after = checkStandalonePaths(); lastReport = after;
    setOutput([`Applied ${changed} standalone path fix(es) to ${active.path}.`, '', formatReport(after)].join('\n'));
    setStatus(`Applied ${changed} path fix(es).`);
    return { ok:after.ok, changed, before:report, after };
  }
  function autoFixBeforeCompileEnabled() { const box=el('autoFixStandalonePathsBeforeCompileCheck'); return box ? box.checked : true; }
  function onCompileClick(_event) {
    const report = checkStandalonePaths(); lastReport = report;
    if (report.fixes.length && autoFixBeforeCompileEnabled()) fixActiveStandalonePaths();
    else setStatus(report.ok ? 'Standalone path check passed before compile.' : `Standalone path check found ${report.fixes.length} fixable issue(s).`);
  }
  function ensureUi() {
    if (el('standalonePathFixerBox')) return true;
    const rootSelect = el('rootFileSelect'); if (!rootSelect) return false;
    const box = document.createElement('div');
    box.id = 'standalonePathFixerBox';
    box.className = 'stage14b-path-fixer-box';
    box.innerHTML = ['<div class="smallcaps">Standalone path fixer</div>','<label class="field checkbox-field stage14b-path-check">','  <input id="autoFixStandalonePathsBeforeCompileCheck" type="checkbox" checked />','  Auto-fix active standalone figure/input paths before compile','</label>','<div class="stage14b-path-actions">','  <button id="checkStandalonePathsBtn" class="btn mini" type="button">Check standalone paths</button>','  <button id="fixStandalonePathsBtn" class="btn mini" type="button">Fix active standalone paths</button>','</div>','<div id="standalonePathStatus" class="settings-note stage14b-path-status">Standalone path fixer ready.</div>'].join('');
    const anchor = el('compileActiveStandaloneStatus')?.parentElement || rootSelect.closest?.('label') || rootSelect.parentElement;
    if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', box); else rootSelect.insertAdjacentElement('afterend', box);
    el('checkStandalonePathsBtn')?.addEventListener('click', showPathReport, true);
    el('fixStandalonePathsBtn')?.addEventListener('click', fixActiveStandalonePaths, true);
    return true;
  }
  function bindCompileHook() { const btn=el('compileBtn'); if (!btn || btn.dataset.stage14bPathFixerBound === '1') return false; btn.dataset.stage14bPathFixerBound = '1'; btn.addEventListener('click', onCompileClick, true); return true; }
  function init() { ensureUi(); bindCompileHook(); }
  NS.StandalonePathService = { STAGE, init, parseReferences, resolveReference, suggestedPath, checkStandalonePaths, formatReport, fixActiveStandalonePaths, showPathReport, getLastReport: () => lastReport };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
  let tries=0; const interval=setInterval(()=>{ init(); tries+=1; if ((el('compileBtn') && el('rootFileSelect')) || tries>60) clearInterval(interval); }, 400);
  try { console.log('[Latexai]', STAGE, 'active'); } catch (_err) {}
})();
