/* LaI Diff Viewer — Stage: stage19w57-diff-viewer-3
 *
 * Adds a "Visual diff view" toggle inside the Audit AI → Audit AI Edits
 * subtab (#stage19w19AuditEditsPanel).  When enabled it hides the tabular
 * #paperAiPolishCard and shows a per-block card view with Accept / Reject.
 *
 * Parsing:  reuses NS.PaperAiPolishService.scanText() — same logic, same
 *           format (\laiold{OLD}\lai{NEW} as well as lone \lai or \laiold).
 * Applying: writes directly to #sourceEditor.value + fires 'input' event
 *           (same pattern as paper-ai-polish-service updateProjectSource),
 *           so the editor, state, and autosave all see the change.
 * Bulk:     delegates to NS.PaperAiPolishService.acceptAllNew() /
 *           rejectAllKeepOld() which already work correctly.
 */
(function () {
  'use strict';

  const W = window;
  const D = document;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'stage19w57-diff-viewer-3';
  const LS_KEY = 'latexai:laiDiffViewer:enabled';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function el(id) { return D.getElementById(id); }
  function svc()  { return NS.PaperAiPolishService; }
  function ta()   { return el('sourceEditor'); }

  // ── Persistence ───────────────────────────────────────────────────────────────

  function isEnabled() {
    try { return localStorage.getItem(LS_KEY) === 'true'; } catch (_) { return false; }
  }
  function setEnabled(v) {
    try { localStorage.setItem(LS_KEY, v ? 'true' : 'false'); } catch (_) {}
  }

  // ── Current edits cache ───────────────────────────────────────────────────────
  // Populated by render(); used by applyOne() so positions stay in sync with
  // what the user is seeing.

  let _edits = [];

  // ── Apply helpers ─────────────────────────────────────────────────────────────

  function applyOne(editId, keepNew) {
    const edit = _edits.find((e) => e.id === editId);
    if (!edit) return;
    const textarea = ta();
    if (!textarea) return;

    const text = textarea.value;
    const replacement = keepNew ? (edit.newText || '') : (edit.oldText || '');

    let newText;
    // Prefer position-based splice (fast, exact) if the raw still matches
    if (
      typeof edit.start === 'number' &&
      typeof edit.end === 'number' &&
      edit.end > edit.start &&
      text.slice(edit.start, edit.end) === edit.raw
    ) {
      newText = text.slice(0, edit.start) + replacement + text.slice(edit.end);
    } else {
      // Fall back to first-occurrence string match
      const idx = text.indexOf(edit.raw);
      if (idx === -1) { scheduleRender(); return; }
      newText = text.slice(0, idx) + replacement + text.slice(idx + edit.raw.length);
    }

    // Update the textarea and fire input so the editor + state pick it up
    textarea.value = newText;
    try { textarea.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    // Belt-and-suspenders: also update state directly
    try { NS.State?.updateActiveText?.(newText); } catch (_) {}
    // Re-render the diff view after a tick
    scheduleRender();
  }

  function applyAll(keepNew) {
    const ps = svc();
    if (!ps) return;
    if (keepNew) ps.acceptAllNew?.();
    else ps.rejectAllKeepOld?.();
    scheduleRender();
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const S_CARD    = 'border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:10px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.05);';
  const S_HDR     = 'font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start;gap:6px;';
  const S_BTNS    = 'display:flex;align-items:center;flex-shrink:0;gap:4px;';
  const S_ACCEPT  = 'border:none;border-radius:4px;padding:3px 9px;font-size:12px;cursor:pointer;font-weight:500;background:#16a34a;color:#fff;';
  const S_REJECT  = 'border:none;border-radius:4px;padding:3px 9px;font-size:12px;cursor:pointer;font-weight:500;background:#dc2626;color:#fff;';
  // Math-safe: no strikethrough. Left border + background conveys old/new.
  const S_LBL_OLD = 'font-size:10px;font-weight:700;color:#b91c1c;letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px;display:block;';
  const S_LBL_NEW = 'font-size:10px;font-weight:700;color:#15803d;letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px;display:block;';
  const S_PRE_OLD = 'background:#fff1f2;border-left:3px solid #f87171;padding:6px 10px;font-family:"SF Mono","Fira Code","Cascadia Code",monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;display:block;margin:0 0 6px;color:#374151;border-radius:0 4px 4px 0;';
  const S_PRE_NEW = 'background:#f0fdf4;border-left:3px solid #4ade80;padding:6px 10px;font-family:"SF Mono","Fira Code","Cascadia Code",monospace;font-size:12px;white-space:pre-wrap;word-break:break-all;display:block;margin:0;color:#374151;border-radius:0 4px 4px 0;';

  function kindLabel(kind) {
    if (kind === 'replace-old-with-new') return 'Replace';
    if (kind === 'new-only')             return 'Insert';
    if (kind === 'old-only')             return 'Delete';
    return kind || 'Edit';
  }

  function makeCard(edit, idx) {
    const card = D.createElement('div');
    card.style.cssText = S_CARD;
    card.dataset.laiEditId = edit.id;

    // ── Header ──
    const hdr = D.createElement('div');
    hdr.style.cssText = S_HDR;

    const titleEl = D.createElement('span');
    const sec = edit.section ? ` · ${String(edit.section).replace(/^[^:]+:\s*/, '').slice(0, 50)}` : '';
    titleEl.textContent = `Edit ${idx + 1} — ${kindLabel(edit.kind)}${sec}  (line ${edit.line || '?'})`;

    const btns = D.createElement('span');
    btns.style.cssText = S_BTNS;

    // Accept button (not for delete-only edits: nothing "new" to keep)
    if (edit.kind !== 'old-only') {
      const ab = D.createElement('button');
      ab.type = 'button';
      ab.textContent = 'Accept ✓';
      ab.style.cssText = S_ACCEPT;
      ab.addEventListener('click', (e) => { e.stopPropagation(); applyOne(edit.id, true); });
      btns.appendChild(ab);
    }

    // Reject / Remove button
    const rb = D.createElement('button');
    rb.type = 'button';
    rb.textContent = edit.kind === 'new-only' ? 'Remove ✗' : 'Reject ✗';
    rb.style.cssText = S_REJECT;
    rb.addEventListener('click', (e) => { e.stopPropagation(); applyOne(edit.id, false); });
    btns.appendChild(rb);

    hdr.appendChild(titleEl);
    hdr.appendChild(btns);
    card.appendChild(hdr);

    // ── Old text block ──
    if (edit.oldText) {
      const lbl = D.createElement('span');
      lbl.style.cssText = S_LBL_OLD;
      lbl.textContent = 'Old';
      card.appendChild(lbl);
      const pre = D.createElement('pre');
      pre.style.cssText = S_PRE_OLD;
      pre.textContent = edit.oldText;
      card.appendChild(pre);
    }

    // ── New text block ──
    if (edit.newText) {
      const lbl = D.createElement('span');
      lbl.style.cssText = S_LBL_NEW;
      lbl.textContent = 'New';
      card.appendChild(lbl);
      const pre = D.createElement('pre');
      pre.style.cssText = S_PRE_NEW;
      pre.textContent = edit.newText;
      card.appendChild(pre);
    }

    return card;
  }

  function render() {
    const list    = el('laiDiffViewerList');
    const bulkBar = el('laiDiffViewerBulkBar');
    if (!list || !isEnabled()) return;

    const ps = svc();
    if (!ps?.scanText) {
      list.innerHTML = '<p style="color:#6b7280;font-size:13px;">Audit AI service not ready yet.</p>';
      return;
    }

    // Read from the live textarea (same source as paper-ai-polish-service)
    const textarea = ta();
    const text = textarea ? textarea.value : '';

    _edits = ps.scanText(text);

    if (bulkBar) bulkBar.style.display = _edits.length ? 'flex' : 'none';

    if (!_edits.length) {
      list.innerHTML = '<p style="color:#6b7280;font-size:13px;padding:8px 0;">No \\lai / \\laiold edit blocks found in the active file.</p>';
      return;
    }

    const frag = D.createDocumentFragment();
    _edits.forEach((edit, idx) => frag.appendChild(makeCard(edit, idx)));
    list.innerHTML = '';
    list.appendChild(frag);
  }

  let _renderTimer = null;
  function scheduleRender() {
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(render, 120);
  }

  // ── View toggle ───────────────────────────────────────────────────────────────

  function applyViewMode(enabled) {
    const polishCard = el('paperAiPolishCard');
    const pane       = el('laiDiffViewerPane');
    if (polishCard) polishCard.style.display = enabled ? 'none' : '';
    if (pane) pane.style.display = enabled ? 'block' : 'none';
    if (enabled) render();
  }

  // ── DOM injection ─────────────────────────────────────────────────────────────

  function injectUI() {
    const panel = el('stage19w19AuditEditsPanel');
    if (!panel || el('laiDiffViewerToggle')) return;

    // ── Toggle strip ──
    const strip = D.createElement('div');
    strip.id = 'laiDiffViewerStrip';
    strip.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 4px 8px;border-bottom:1px solid #f1f5f9;margin-bottom:6px;';

    const chk = D.createElement('input');
    chk.type = 'checkbox';
    chk.id = 'laiDiffViewerToggle';
    chk.style.cssText = 'margin:0;cursor:pointer;accent-color:#2563eb;';
    chk.checked = isEnabled();
    chk.addEventListener('change', () => {
      setEnabled(chk.checked);
      applyViewMode(chk.checked);
    });

    const lbl = D.createElement('label');
    lbl.htmlFor = 'laiDiffViewerToggle';
    lbl.style.cssText = 'font-size:12px;color:#374151;cursor:pointer;user-select:none;';
    lbl.textContent = 'Visual diff view';

    strip.appendChild(chk);
    strip.appendChild(lbl);

    // ── Diff pane ──
    const pane = D.createElement('div');
    pane.id = 'laiDiffViewerPane';
    pane.style.display = 'none';

    // Bulk bar
    const bulkBar = D.createElement('div');
    bulkBar.id = 'laiDiffViewerBulkBar';
    bulkBar.style.cssText = 'display:none;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px;';

    const aAll = D.createElement('button');
    aAll.type = 'button';
    aAll.className = 'btn mini primary';
    aAll.textContent = 'Accept all new \\lai';
    aAll.addEventListener('click', () => applyAll(true));

    const rAll = D.createElement('button');
    rAll.type = 'button';
    rAll.className = 'btn mini';
    rAll.textContent = 'Reject all; keep \\laiold';
    rAll.addEventListener('click', () => applyAll(false));

    bulkBar.appendChild(aAll);
    bulkBar.appendChild(rAll);

    const list = D.createElement('div');
    list.id = 'laiDiffViewerList';

    pane.appendChild(bulkBar);
    pane.appendChild(list);

    // Insert at very top of the audit edits panel
    panel.insertBefore(pane, panel.firstChild);
    panel.insertBefore(strip, panel.firstChild);

    applyViewMode(isEnabled());
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────────

  let _subscribed = false;

  function subscribe() {
    if (_subscribed) return;

    // State changes
    if (NS.State?.subscribe) {
      _subscribed = true;
      NS.State.subscribe((_snap, reason) => {
        if (isEnabled() && [
          'load', 'reset', 'active-file', 'update-active-text',
          'patch-apply', 'file-update', 'file-change'
        ].includes(reason)) {
          scheduleRender();
        }
      });
    }

    // Textarea input (polish service reads textarea directly)
    const textarea = ta();
    if (textarea && !textarea.dataset.laiDiffViewerBound) {
      textarea.dataset.laiDiffViewerBound = 'true';
      textarea.addEventListener('input', () => {
        if (isEnabled()) scheduleRender();
      });
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────────

  function boot() {
    injectUI();
    subscribe();
    if (isEnabled()) render();
  }

  // Retry until both #stage19w19AuditEditsPanel and PaperAiPolishService exist.
  // The audit panel is created by stage19w16 reconcile (fires at 250ms+).
  // PaperAiPolishService is initialized on DOMContentLoaded.
  function tryBoot(attempts) {
    const ready = el('stage19w19AuditEditsPanel') && NS.PaperAiPolishService;
    if (ready) {
      boot();
    } else if (attempts < 40) {
      setTimeout(() => tryBoot(attempts + 1), 250);
    }
  }

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', () => tryBoot(0));
  } else {
    tryBoot(0);
  }

  NS.LaiDiffViewerService = { STAGE, render: scheduleRender, boot };
})();
