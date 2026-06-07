import json, subprocess, time, urllib.request, websocket, tempfile, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
service = (ROOT / 'js/editor-enhancement-service.js').read_text()
css = (ROOT / 'css/lai-stage18f-editor-enhancements.css').read_text()
html = f'''<!doctype html><html><head><meta charset="utf-8"><style>
:root {{--mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; --muted:#64748b; --ink:#0f172a;}}
.btn{{font:12px sans-serif}} .field{{display:block}}
.source-shell{{width:640px;height:320px;display:grid;grid-template-columns:3.45rem minmax(0,1fr);background:#0f172a;overflow:hidden;}}
.line-gutter{{grid-column:1;grid-row:1;margin:0;padding:1rem .65rem;background:#111827;color:#64748b;font:13px/1.55 var(--mono);}}
#sourceEditor{{grid-column:2;grid-row:1;width:100%;height:100%;resize:none;border:0;outline:0;padding:1rem 1.1rem;background:#0f172a;color:#e5e7eb;font:14px/1.55 var(--mono);white-space:pre;overflow:auto;}}
{css}
</style></head><body>
<script>window.LuminaLatex = {{}}; window.__stateSubscribers = []; window.LuminaLatex.State = {{ subscribe(fn) {{ window.__stateSubscribers.push(fn); }} }};</script>
<div class="source-shell"><pre id="lineGutter" class="line-gutter">1</pre><textarea id="sourceEditor" spellcheck="false">\\begin{{theorem}}\nBody\n\\end{{theorem}}</textarea></div>
<section id="settingsTab"></section>
<script>{service}</script>
</body></html>'''
port = 9287
profile = tempfile.mkdtemp(prefix='chrome-prof-stage18g-')
cmd = ['/usr/bin/chromium', '--headless=new', '--no-sandbox', '--remote-allow-origins=*', f'--remote-debugging-port={port}', f'--user-data-dir={profile}', '--disable-gpu', '--window-size=900,800', 'about:blank']
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    for _ in range(120):
        try:
            tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list', timeout=1))
            if tabs: break
        except Exception:
            time.sleep(.1)
    else:
        raise RuntimeError('Chromium did not expose debugging endpoint')
    ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=5)
    counter = [0]
    def send(method, params=None):
        counter[0] += 1
        ws.send(json.dumps({'id': counter[0], 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == counter[0]: return msg
    def ev(expr):
        res = send('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
        if 'exceptionDetails' in res:
            raise RuntimeError(json.dumps(res['exceptionDetails'], indent=2))
        return res['result']['result'].get('value')
    send('Runtime.enable')
    ev('document.open(); document.write(' + json.dumps(html) + '); document.close();')
    time.sleep(.5)
    result = ev(r'''(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const ed = document.getElementById('sourceEditor');
      const svc = window.LuminaLatex.EditorEnhancementService;
      const overlay = document.getElementById('latexSyntaxOverlay');
      const initialHasTokens = !!overlay && overlay.innerHTML.includes('latex-token-command') && overlay.innerHTML.includes('latex-token-env');
      const cs = getComputedStyle(ed);
      const stableTextColor = cs.color !== 'rgba(0, 0, 0, 0)' && cs.webkitTextFillColor !== 'rgba(0, 0, 0, 0)' && cs.color !== 'transparent';
      svc.installHighlighter();
      svc.installHighlighter();
      const overlayCount = document.querySelectorAll('#latexSyntaxOverlay').length;

      ed.value = '\\begin{proof}';
      ed.focus();
      ed.setSelectionRange(ed.value.length, ed.value.length);
      ed.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
      await sleep(80);
      const smartEnterValue = ed.value;
      const smartEnterOverlay = overlay.textContent;

      ed.value = '\\section{Fresh State File}\nText';
      ed.dispatchEvent(new Event('input', { bubbles:true }));
      await sleep(80);
      const inputSynced = overlay.textContent.includes('Fresh State File');

      ed.value = '\\subsection{State Sync File}\nMore';
      for (const fn of window.__stateSubscribers) fn({}, 'active-file');
      await sleep(120);
      const stateSynced = overlay.textContent.includes('State Sync File');

      ed.value = 'lemma';
      ed.setSelectionRange(0, 5);
      ed.dispatchEvent(new KeyboardEvent('keydown', { key:'b', metaKey:true, bubbles:true, cancelable:true }));
      await sleep(80);
      const shortcutStillWorks = ed.value === '\\begin{lemma}\n  \n\\end{lemma}' && overlay.textContent.includes('begin{lemma}');

      return {
        initialHasTokens,
        stableTextColor,
        overlayCount,
        smartEnterValue,
        smartEnterOverlayIncludesProof: smartEnterOverlay.includes('begin{proof}'),
        inputSynced,
        stateSynced,
        shortcutStillWorks,
        pass: initialHasTokens && stableTextColor && overlayCount === 1 && smartEnterValue === '\\begin{proof}\n  ' && smartEnterOverlay.includes('begin{proof}') && inputSynced && stateSynced && shortcutStillWorks
      };
    })()''')
    print(json.dumps(result, indent=2))
    if not result.get('pass'):
        sys.exit(1)
finally:
    try: proc.terminate()
    except Exception: pass
