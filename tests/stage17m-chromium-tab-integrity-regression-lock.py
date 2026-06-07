import json, subprocess, time, urllib.request, websocket, tempfile, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
styles = '\n'.join((ROOT / p).read_text() for p in ['css/styles.css', 'css/lai-stage5e-layout.css', 'css/lai-stage17j-right-panel-sections.css', 'css/lai-stage8a-assets.css', 'css/lai-stage8e-figure-editor.css', 'css/lai-stage9a-tikz-maker.css', 'css/lai-stage10a-image-to-tikz.css'])
service = (ROOT / 'js/right-panel-organizer-service.js').read_text()

copilot_children = '''<div class="section-head compact"><h2>LaTeX Copilot</h2></div>
<label class="field">AI provider <select id="aiProvider"><option>OpenAI</option></select></label>
<label class="field">AI model <input id="aiModel" value="gpt-4.1-mini"></label>
<label class="field">Proxy URL <input id="aiProxyUrl"></label>
<label class="field">Token <input id="aiProxyToken"></label>
<label class="field">Task <select id="copilotTask"><option>Improve writing</option></select></label>
<textarea id="copilotPrompt"></textarea>
<button id="askCopilotBtn">Ask</button><button id="previewCopilotPatchBtn">Preview</button>
<button id="insertCopilotBtn">Insert</button><button id="replaceCopilotBtn">Replace</button>
<pre id="copilotOutput"></pre>
<div id="documentAiCard" class="panel-section"><h2>Paper-level AI</h2><p>Card body</p></div>
<div id="citationAiCard" class="panel-section"><h2>Citation filler</h2><p>Card body</p></div>
<div id="presentationExportCard" class="panel-section"><h2>Presentation exporter</h2><p>Card body</p></div>
'''
settings_children = '''<div class="section-head compact"><h2>Compile settings</h2></div>
<label class="field">Compile backend URL <input id="compileProxyUrl" value="https://example.invalid/api/lumina/compile"></label>
<div id="backendStatusCard" class="backend-status-card"><div><div class="smallcaps">Backend status</div><strong>Not checked</strong><p>Use Test backend.</p></div><button class="btn mini">Test backend</button></div>
<label class="field">Compile proxy token <input id="compileProxyToken"></label>
<label class="field">Compiler mode <select id="compilerModeSelect"><option>Backend TeX Live</option></select></label>
<label class="field">Root file <select id="rootFileSelect"><option>main.tex</option></select></label>
<label class="field">Engine <select id="engineSelect"><option>pdfLaTeX</option></select></label>
<label class="field checkbox-field"><input id="shellEscapeCheck" type="checkbox"> Allow shell escape</label>
<label class="field checkbox-field"><input id="compileJobsCheck" type="checkbox"> Use job pipeline</label>
<label class="field">Compile poll interval <select id="compilePollSelect"><option>Normal</option></select></label>
<p class="settings-note">Static GitHub Pages can run the editor and draft preview.</p>
<button id="openOverleafBtn" class="btn ghost">Open root in Overleaf</button>
<button id="runAppDiagnosticsBtn" class="btn ghost">Run app diagnostics</button>
<div id="aiReportBrowserCard" class="panel-section"><h2>Unified AI reports / reviews browser</h2><p>Reports</p></div>
<div id="aiRoutingInspectorCard" class="panel-section"><h2>AI model routing inspector</h2><p>diagnostics</p></div>
<div id="modelRoutingCard" class="panel-section"><h2>Model routing</h2></div>
'''
assets_children = '''<div class="asset-panel">
  <div class="figure-editor-card" id="figureEditorCard"><h3>Draw figure</h3><div class="figure-editor-canvas-wrap"><canvas id="figureEditorCanvas" width="800" height="420"></canvas></div></div>
  <div class="tikz-maker-card" id="tikzMakerCard"><h3>AI TikZ maker</h3><textarea id="tikzCodeOutput"></textarea></div>
  <div class="image-tikz-card" id="imageToTikzCard"><h3>Image → TikZ remaker</h3><select id="imageTikzAssetSelect"></select></div>
  <div class="asset-card"><h3>Image assets</h3><input id="assetFileInput" type="file"></div>
  <div class="asset-card"><h3>Snippet preview</h3><pre id="assetSnippetPreview">preview</pre></div>
  <div class="asset-card"><h3>Project images</h3><div id="assetList"></div></div>
</div>'''

html = f'''<!doctype html><html><head><meta charset="utf-8"><style>{styles}</style></head><body><div class="app-shell"><main class="workspace"><aside class="right-panel panel"><div class="right-tabs"><button class="right-tab active" data-tab="copilot" data-right-tab="copilot">Copilot</button><button class="right-tab" data-tab="settings" data-right-tab="settings">Settings</button><button class="right-tab" data-tab="assets" data-right-tab="assets">Figures</button></div><section id="copilotTab" class="right-tab-panel copilot-panel active">{copilot_children}</section><section id="settingsTab" class="right-tab-panel">{settings_children}</section><section id="assetsTab" class="right-tab-panel">{assets_children}</section></aside></main></div><script>document.querySelectorAll('.right-tab').forEach(btn => btn.addEventListener('click', () => {{ const tab=btn.dataset.rightTab||btn.dataset.tab; document.querySelectorAll('.right-tab').forEach(b=>b.classList.toggle('active', b===btn)); document.querySelectorAll('.right-tab-panel').forEach(p=>p.classList.toggle('active', p.id === tab+'Tab' || (tab==='assets' && p.id==='assetsTab'))); }}));</script></body></html>'''

port = 9232
profile = tempfile.mkdtemp(prefix='chrome-prof-stage17m-')
cmd = ['/usr/bin/chromium', '--headless=new', '--no-sandbox', '--remote-allow-origins=*', f'--remote-debugging-port={port}', f'--user-data-dir={profile}', '--disable-gpu', '--window-size=1600,1000', 'about:blank']
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    for _ in range(100):
        try:
            tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list', timeout=1))
            if tabs:
                break
        except Exception:
            time.sleep(.1)
    else:
        raise RuntimeError('Chromium did not expose a debugging endpoint')
    ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=5)
    counter = 0
    def send(method, params=None):
        global counter
        counter += 1
        ws.send(json.dumps({'id': counter, 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == counter:
                return msg
    def ev(expr, awaitp=False):
        res = send('Runtime.evaluate', {'expression': expr, 'awaitPromise': awaitp, 'returnByValue': True})
        if 'exceptionDetails' in res:
            raise RuntimeError(json.dumps(res['exceptionDetails'], indent=2))
        r = res['result']['result']
        if 'value' in r:
            return r.get('value')
        if r.get('type') == 'undefined':
            return None
        return r.get('unserializableValue') or r.get('description')

    send('Runtime.enable')
    ev('document.open(); document.write(' + json.dumps(html) + '); document.close();')
    ev(r'''window.__LATEXAI_RPO_STORAGE = (() => {
      const store = {};
      return {
        getItem: (key) => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        _dump: () => ({...store})
      };
    })();''')
    ev(service)
    time.sleep(.45)
    ev("window.LuminaLatex.RightPanelOrganizerService.organize();")
    time.sleep(.2)

    normal = ev(r'''(() => {
      const svc = window.LuminaLatex.RightPanelOrganizerService;
      window.LatexaiRightPanelCollapseAll('copilot');
      window.LatexaiRightPanelExpandAll('copilot');
      document.querySelector('[data-right-tab="settings"]').click();
      window.LatexaiRightPanelCollapseAll('settings');
      window.LatexaiRightPanelExpandAll('settings');
      document.querySelector('[data-right-tab="assets"]').click();
      const report = svc.currentReport();
      const integrity = svc.tabIntegritySummary();
      return {
        stage: svc.STAGE,
        integrityOk: integrity.ok,
        figuresOk: integrity.figures.ok,
        figureTab: document.getElementById('figureEditorCard').closest('.right-tab-panel')?.id,
        tikzTab: document.getElementById('tikzMakerCard').closest('.right-tab-panel')?.id,
        imageTikzTab: document.getElementById('imageToTikzCard').closest('.right-tab-panel')?.id,
        figureNotInCopilot: !document.querySelector('#copilotTab #figureEditorCard'),
        copilotGroupsWork: document.querySelector('#rightPanelGroup-copilot-core-copilot').dataset.rpoOpen === 'true',
        settingsGroupsWork: document.querySelector('#rightPanelGroup-settings-compile-settings').dataset.rpoOpen === 'true',
        activeFigures: document.getElementById('assetsTab').classList.contains('active'),
        reportHasIntegrity: report.includes('Tab integrity: ok') && report.includes('Figures tab tools: ok') && report.includes('Misplaced known cards: none') && report.includes('Tab card count: assets:'),
        report
      };
    })()''')

    rogue = ev(r'''(() => {
      const svc = window.LuminaLatex.RightPanelOrganizerService;
      const rogue = document.getElementById('figureEditorCard');
      document.getElementById('copilotTab').appendChild(rogue);
      svc.organize('copilot');
      const integrity = svc.tabIntegritySummary();
      const report = svc.currentReport();
      return {
        integrityProblem: !integrity.ok,
        misplacedCount: integrity.misplaced.length,
        notMovedIntoCopilotGroup: !document.querySelector('#rightPanelGroupBody-copilot-figures #figureEditorCard'),
        remainsDirectInCopilot: document.getElementById('figureEditorCard').parentElement.id === 'copilotTab',
        reportFlagsMisplaced: report.includes('Misplaced known card: #figureEditorCard expected assets, actual copilot')
      };
    })()''')

    result = {'normal': normal, 'rogue': rogue}
    result['pass'] = (
      normal.get('stage') == 'stage17m-tab-integrity-regression-lock-1'
      and normal.get('integrityOk') and normal.get('figuresOk')
      and normal.get('figureTab') == 'assetsTab'
      and normal.get('tikzTab') == 'assetsTab'
      and normal.get('imageTikzTab') == 'assetsTab'
      and normal.get('figureNotInCopilot')
      and normal.get('copilotGroupsWork') and normal.get('settingsGroupsWork')
      and normal.get('activeFigures') and normal.get('reportHasIntegrity')
      and rogue.get('integrityProblem') and rogue.get('misplacedCount') >= 1
      and rogue.get('notMovedIntoCopilotGroup') and rogue.get('remainsDirectInCopilot')
      and rogue.get('reportFlagsMisplaced')
    )
    print(json.dumps(result, indent=2))
    if not result.get('pass'):
        sys.exit(1)
finally:
    try:
        proc.terminate(); proc.wait(timeout=2)
    except Exception:
        proc.kill()
