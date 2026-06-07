import json, subprocess, time, urllib.request, websocket, tempfile, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
css = '\n'.join((ROOT / p).read_text() for p in [
  'css/styles.css',
  'css/lai-stage17j-right-panel-sections.css',
  'css/lai-stage16a-paper-ai-polish.css',
])
long_old = r"""\section{Setup and goals}
We consider a multivariate concentration argument with many details that should remain visible in the OLD column."""
long_new = r"""% Removed incomplete and unexplained equation referencing an undefined rate.
Instead, add a brief paragraph on standard assumptions for the multivariate concentration result and explain each term before displaying the final bound."""
html = f'''<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>
<div class="right-panel panel" style="width:410px;height:760px;padding:12px;display:flex;flex-direction:column;overflow:hidden;">
<section id="copilotTab" class="right-tab-panel active">
  <div class="right-panel-group is-open" data-rpo-open="true">
    <button class="right-panel-group-summary"><span class="right-panel-group-title">Paper AI</span><span class="right-panel-group-count">1</span></button>
    <div class="right-panel-group-body">
      <div id="paperAiPolishCard" class="paper-ai-polish-card">
        <div id="paperAiEditList" class="paper-ai-edit-list">
          <div class="paper-ai-edit-row" data-paper-ai-edit="main-tex-edit-1">
            <div class="paper-ai-edit-head"><label><input type="checkbox" checked /> main-tex-edit-1 · main.tex · line 42</label><span>replace-old-new</span></div>
            <div class="paper-ai-choice-row"><label><input type="radio" checked /> keep new</label><label><input type="radio" /> keep old</label></div>
            <div class="paper-ai-preview-grid">
              <div><strong>Old</strong><pre>{long_old}</pre></div>
              <div><strong>New</strong><pre>{long_new}</pre></div>
            </div>
          </div>
        </div>
        <pre id="paperAiPolishOutput" class="paper-ai-output active">Paper-level AI edit report\n==========================</pre>
      </div>
    </div>
  </div>
</section>
</div></body></html>'''
port = 9271
profile = tempfile.mkdtemp(prefix='chrome-prof-stage17u-')
cmd = ['/usr/bin/chromium', '--headless=new', '--no-sandbox', '--remote-allow-origins=*', f'--remote-debugging-port={port}', f'--user-data-dir={profile}', '--disable-gpu', '--window-size=900,800', 'about:blank']
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    for _ in range(120):
        try:
            tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list', timeout=1))
            if tabs:
                break
        except Exception:
            time.sleep(.1)
    else:
        raise RuntimeError('Chromium did not expose a debugging endpoint')
    ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=5)
    counter = [0]
    def send(method, params=None):
        counter[0] += 1
        ws.send(json.dumps({'id': counter[0], 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == counter[0]:
                return msg
    def ev(expr):
        res = send('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
        if 'exceptionDetails' in res:
            raise RuntimeError(json.dumps(res['exceptionDetails'], indent=2))
        r = res['result']['result']
        return r.get('value')
    send('Runtime.enable')
    ev('document.open(); document.write(' + json.dumps(html) + '); document.close();')
    time.sleep(.2)
    result = ev(r'''(() => {
      const panel = document.getElementById('copilotTab');
      const body = document.querySelector('.right-panel-group-body');
      const card = document.getElementById('paperAiPolishCard');
      const row = document.querySelector('.paper-ai-edit-row');
      const grid = document.querySelector('.paper-ai-preview-grid');
      const newColumn = grid.children[1];
      const first = row.scrollLeft;
      row.scrollLeft = 9999;
      const rowScrolled = row.scrollLeft > first;
      card.scrollLeft = 9999;
      const cardScrolled = card.scrollLeft > 0;
      const pr = panel.getBoundingClientRect();
      const nr = newColumn.getBoundingClientRect();
      return {
        panelOverflowX: getComputedStyle(panel).overflowX,
        bodyOverflowX: getComputedStyle(body).overflowX,
        cardOverflowX: getComputedStyle(card).overflowX,
        rowOverflowX: getComputedStyle(row).overflowX,
        gridWidth: grid.getBoundingClientRect().width,
        rowClientWidth: row.clientWidth,
        rowScrollWidth: row.scrollWidth,
        cardClientWidth: card.clientWidth,
        cardScrollWidth: card.scrollWidth,
        rowScrolled,
        cardScrolled,
        newColumnInitiallyExtendsPastPanel: nr.right > pr.right,
        pass: getComputedStyle(panel).overflowX === 'auto' &&
              getComputedStyle(body).overflowX === 'auto' &&
              getComputedStyle(card).overflowX === 'auto' &&
              getComputedStyle(row).overflowX === 'auto' &&
              grid.getBoundingClientRect().width >= 630 &&
              row.scrollWidth > row.clientWidth &&
              (rowScrolled || cardScrolled)
      };
    })()''')
    print(json.dumps(result, indent=2))
    if not result.get('pass'):
        sys.exit(1)
finally:
    try:
        proc.terminate()
    except Exception:
        pass
