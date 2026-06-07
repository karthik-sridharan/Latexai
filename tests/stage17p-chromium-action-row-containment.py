import json, subprocess, time, urllib.request, websocket, tempfile, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
css = '\n'.join((ROOT / p).read_text() for p in [
  'css/styles.css',
  'css/lai-stage17j-right-panel-sections.css',
  'css/lai-stage16d-devils-debate.css',
  'css/lai-stage16b-competitive-review.css',
])
html = f'''<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>
<div class="right-panel panel" style="width:410px;height:760px;padding:12px;">
<section id="copilotTab" class="right-tab-panel active" style="display:block;height:720px;overflow-y:auto;overflow-x:hidden;">
  <div class="right-panel-group is-open" data-rpo-open="true">
    <button class="right-panel-group-summary"><span class="right-panel-group-title">Paper AI</span><span class="right-panel-group-count">4</span></button>
    <div class="right-panel-group-body">
      <div id="devilsDebateCard" class="devils-debate-card">
        <div class="devils-actions">
          <button class="btn mini primary">Run debate</button>
          <button class="btn mini">Cancel</button>
          <button class="btn mini">Copy report</button>
          <button class="btn mini">Add report to /reviews</button>
          <button class="btn mini">Insert \\lai edits at matches</button>
          <button class="btn mini">Append \\lai plan</button>
        </div>
        <pre class="devils-output active"># Devil's advocate report\nThis long output should wrap and not widen the card: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA</pre>
      </div>
      <div id="competitiveReviewCard" class="competitive-review-card">
        <div class="competitive-review-actions">
          <button class="btn mini">Check web search</button>
          <button class="btn mini primary">Run competitive review</button>
          <button class="btn mini">Copy report</button>
          <button class="btn mini">Add report to /reviews</button>
          <button class="btn mini">Insert \\lai edits at matches</button>
          <button class="btn mini">Append \\lai plan</button>
        </div>
        <pre class="competitive-review-output active"># Competitive report\nBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB</pre>
      </div>
    </div>
  </div>
</section>
</div></body></html>'''
port = 9267
profile = tempfile.mkdtemp(prefix='chrome-prof-stage17p-')
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
      function inspect(cardSel, actionsSel) {
        const panel = document.getElementById('copilotTab');
        const card = document.querySelector(cardSel);
        const actions = document.querySelector(actionsSel);
        const panelRect = panel.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const actionRect = actions.getBoundingClientRect();
        const buttons = Array.from(actions.querySelectorAll('button')).map((button) => {
          const r = button.getBoundingClientRect();
          return {
            text: button.textContent.trim(),
            left: r.left,
            right: r.right,
            width: r.width,
            visibleHoriz: r.left >= cardRect.left - 1 && r.right <= cardRect.right + 1,
            display: getComputedStyle(button).display,
            whiteSpace: getComputedStyle(button).whiteSpace,
            overflowWrap: getComputedStyle(button).overflowWrap
          };
        });
        return {
          cardSel,
          panelClientWidth: panel.clientWidth,
          panelScrollWidth: panel.scrollWidth,
          cardClientWidth: card.clientWidth,
          cardScrollWidth: card.scrollWidth,
          actionsDisplay: getComputedStyle(actions).display,
          actionsClientWidth: actions.clientWidth,
          actionsScrollWidth: actions.scrollWidth,
          actionWithinCard: actionRect.left >= cardRect.left - 1 && actionRect.right <= cardRect.right + 1,
          buttons
        };
      }
      const dev = inspect('#devilsDebateCard', '.devils-actions');
      const comp = inspect('#competitiveReviewCard', '.competitive-review-actions');
      const allButtonsVisible = [...dev.buttons, ...comp.buttons].every((b) => b.visibleHoriz && b.width > 0 && b.whiteSpace === 'normal');
      return {
        dev,
        comp,
        allButtonsVisible,
        noPanelHorizontalOverflow: document.getElementById('copilotTab').scrollWidth <= document.getElementById('copilotTab').clientWidth + 1,
        devNoCardOverflow: dev.cardScrollWidth <= dev.cardClientWidth + 1,
        compNoCardOverflow: comp.cardScrollWidth <= comp.cardClientWidth + 1,
        pass: allButtonsVisible && dev.actionsDisplay === 'grid' && comp.actionsDisplay === 'grid' &&
              dev.cardScrollWidth <= dev.cardClientWidth + 1 && comp.cardScrollWidth <= comp.cardClientWidth + 1 &&
              document.getElementById('copilotTab').scrollWidth <= document.getElementById('copilotTab').clientWidth + 1
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
