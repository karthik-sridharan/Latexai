/*
 * Latexai Step 2 storage UI.
 * Adds a small non-invasive storage panel for localStorage/native folder sync.
 */
(function () {
  'use strict';

  var ROOT = typeof window !== 'undefined' ? window : globalThis;
  var STAGE = 'latex-stage2a-storage-ui-20260518-1';

  function getProvider() {
    return ROOT.LAI_STORAGE ||
      (ROOT.NS && ROOT.NS.StorageProvider) ||
      (ROOT.LuminaLatex && ROOT.LuminaLatex.StorageProvider) ||
      ROOT.StorageProvider || null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function ensureStyle() {
    if (document.getElementById('lai-storage-style')) return;
    var style = document.createElement('style');
    style.id = 'lai-storage-style';
    style.textContent = [
      '#lai-storage-panel{position:fixed;right:16px;bottom:16px;z-index:99999;font:13px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#111;border:1px solid #d0d0d0;border-radius:10px;box-shadow:0 6px 22px rgba(0,0,0,.16);width:320px;max-width:calc(100vw - 32px);overflow:hidden}',
      '#lai-storage-panel.lai-collapsed .lai-storage-body{display:none}',
      '#lai-storage-panel .lai-storage-head{display:flex;align-items:center;justify-content:space-between;padding:9px 10px;background:#f5f5f5;border-bottom:1px solid #e0e0e0;font-weight:650}',
      '#lai-storage-panel .lai-storage-body{padding:10px}',
      '#lai-storage-panel button,#lai-storage-panel select{font:inherit}',
      '#lai-storage-panel button{border:1px solid #bbb;border-radius:6px;background:#fafafa;padding:5px 8px;cursor:pointer}',
      '#lai-storage-panel button:hover{background:#eee}',
      '#lai-storage-panel .lai-row{display:flex;gap:8px;align-items:center;margin:8px 0;flex-wrap:wrap}',
      '#lai-storage-panel .lai-row label{font-weight:600}',
      '#lai-storage-panel .lai-status{font-size:12px;background:#f8f8f8;border:1px solid #eee;border-radius:6px;padding:6px;white-space:pre-wrap;max-height:96px;overflow:auto}',
      '#lai-storage-panel .lai-muted{color:#666;font-size:12px}',
      '#lai-storage-panel .lai-error{color:#9b1c1c}',
      '#lai-storage-panel .lai-ok{color:#145a1f}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function panelHtml(status) {
    var cap = status.capabilities || {};
    var nativeLabel = cap.nativeFolder ? 'Local folder available' : 'Local folder unavailable in this browser';
    return [
      '<div class="lai-storage-head"><span>Latexai Storage</span><button type="button" data-lai-storage-toggle>–</button></div>',
      '<div class="lai-storage-body">',
      '  <div class="lai-row"><label>Mode</label><select data-lai-storage-mode>',
      '    <option value="localStorage">Browser local storage</option>',
      '    <option value="nativeFolder">Local folder sync</option>',
      '    <option value="github">GitHub autosave (Step 3)</option>',
      '  </select></div>',
      '  <div class="lai-row">',
      '    <button type="button" data-lai-open-folder>Open Local Folder</button>',
      '    <button type="button" data-lai-save-now>Save Now</button>',
      '    <button type="button" data-lai-load-local>Load Autosave</button>',
      '  </div>',
      '  <div class="lai-row lai-muted">', esc(nativeLabel), '</div>',
      '  <div class="lai-status" data-lai-storage-status></div>',
      '</div>'
    ].join('');
  }

  function formatStatus(status) {
    var lines = [];
    lines.push('stage: ' + (status.stage || STAGE));
    lines.push('mode: ' + (status.mode || 'localStorage'));
    lines.push('autosave: ' + (status.autosave ? 'on' : 'off'));
    lines.push('native folder: ' + (status.nativeFolderOpen ? (status.nativeFolderName || 'open') : 'not open'));
    if (status.lastSavedAt) lines.push('last saved: ' + status.lastSavedAt);
    if (status.message) lines.push('message: ' + status.message);
    if (status.lastError) lines.push('error: ' + status.lastError);
    return lines.join('\n');
  }

  function refreshPanel() {
    var p = getProvider();
    var panel = document.getElementById('lai-storage-panel');
    if (!p || !panel) return;
    var status = p.getStatus ? p.getStatus() : {};
    var mode = panel.querySelector('[data-lai-storage-mode]');
    if (mode) mode.value = status.mode || 'localStorage';
    var statusEl = panel.querySelector('[data-lai-storage-status]');
    if (statusEl) {
      statusEl.textContent = formatStatus(status);
      statusEl.className = 'lai-status' + (status.lastError ? ' lai-error' : ' lai-ok');
    }
  }

  function createPanel() {
    if (!document.body || document.getElementById('lai-storage-panel')) return;
    var p = getProvider();
    if (!p) return;
    ensureStyle();
    var panel = document.createElement('div');
    panel.id = 'lai-storage-panel';
    panel.innerHTML = panelHtml(p.getStatus ? p.getStatus() : {});
    document.body.appendChild(panel);

    panel.addEventListener('click', async function (ev) {
      var target = ev.target;
      var provider = getProvider();
      if (!provider) return;

      if (target && target.matches('[data-lai-storage-toggle]')) {
        panel.classList.toggle('lai-collapsed');
        target.textContent = panel.classList.contains('lai-collapsed') ? '+' : '–';
      }

      if (target && target.matches('[data-lai-open-folder]')) {
        try {
          await provider.openNativeFolder();
        } catch (err) {
          alert(String(err && err.message || err));
        }
        refreshPanel();
      }

      if (target && target.matches('[data-lai-save-now]')) {
        try {
          await provider.autosaveNow('manual');
        } catch (err2) {
          alert(String(err2 && err2.message || err2));
        }
        refreshPanel();
      }

      if (target && target.matches('[data-lai-load-local]')) {
        provider.loadProject();
        refreshPanel();
      }
    });

    panel.addEventListener('change', function (ev) {
      var target = ev.target;
      var provider = getProvider();
      if (!provider) return;
      if (target && target.matches('[data-lai-storage-mode]')) {
        provider.saveSettings({ storageMode: target.value });
        if (target.value === 'nativeFolder' && !(provider.capabilities && provider.capabilities().nativeFolder)) {
          alert('Native folder sync is not available in this browser. Browser local storage will still be used as a fallback.');
        }
        refreshPanel();
      }
    });

    refreshPanel();
    setInterval(refreshPanel, 1500);
  }

  function installWhenReady() {
    if (getProvider() && document.body) {
      createPanel();
      return;
    }
    setTimeout(installWhenReady, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWhenReady);
  } else {
    installWhenReady();
  }

  ROOT.LatexaiStorageUI = { stage: STAGE, refresh: refreshPanel, install: createPanel };
})();
