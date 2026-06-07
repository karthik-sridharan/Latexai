import json, subprocess, time, urllib.request, websocket, tempfile, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
styles = '\n'.join((ROOT / p).read_text() for p in ['css/styles.css', 'css/lai-stage5e-layout.css', 'css/lai-stage17j-right-panel-sections.css'])
service = (ROOT / 'js/right-panel-organizer-service.js').read_text()

settings_children = '''<div class="section-head compact"><h2>Compile settings</h2></div>
<label class="field">Compile backend URL <input id="compileProxyUrl" value="https://example.invalid/api/lumina/compile"></label>
<div id="backendStatusCard" class="backend-status-card"><div><div class="smallcaps">Backend status</div><strong>Not checked</strong><p>Use Test backend after setting a compile URL.</p></div><button class="btn mini">Test backend</button></div>
<label class="field">Compile proxy token <input id="compileProxyToken"></label>
<label class="field">Compiler mode <select id="compilerModeSelect"><option>Backend TeX Live</option></select></label>
<div id="wasmStatusCard" class="backend-status-card"><div><div class="smallcaps">Browser engine status</div><strong>Not checked</strong><p>Browser-WASM compile uses SwiftLaTeX-compatible assets in the browser.</p></div><button class="btn mini">Test browser engine</button></div>
<label class="field">Asset folder <input id="browserWasmAssetBase"></label>
<label class="field">Endpoint <input id="browserWasmTexliveEndpoint"></label>
<label class="field checkbox-field"><input id="browserWasmReuseCheck" type="checkbox"> Reuse SwiftLaTeX engine</label>
<div id="texlyreStatusCard" class="backend-status-card"><div><div class="smallcaps">TeXlyre status</div><strong>Not checked</strong><p>TeXlyre BusyTeX can compile in the browser.</p></div><button class="btn mini">Test TeXlyre</button></div>
<label class="field">TeXlyre module URL <input id="texlyreModuleUrl"></label>
<label class="field">TeXlyre asset base <input id="texlyreBusytexBase"></label>
<label class="field checkbox-field"><input id="texlyreReuseCheck" type="checkbox"> Reuse TeXlyre runner</label>
<label class="field checkbox-field"><input id="texlyreUseWorkerCheck" type="checkbox"> Use worker</label>
<button id="resetTexlyreDirectModeBtn" class="btn mini">Reset TeXlyre</button>
<label class="field">Root file <select id="rootFileSelect"><option>main.tex</option></select></label>
<label class="field">Engine <select id="engineSelect"><option>pdfLaTeX</option></select></label>
<label class="field checkbox-field"><input id="shellEscapeCheck" type="checkbox"> Allow shell escape</label>
<label class="field checkbox-field"><input id="compileJobsCheck" type="checkbox"> Use job pipeline</label>
<label class="field">Compile poll interval <select id="compilePollSelect"><option>Normal</option></select></label>
<p class="settings-note">Static GitHub Pages can run the editor and draft preview. This is long enough to make the settings panel overflow.</p>
<button id="openOverleafBtn" class="btn ghost">Open root in Overleaf</button>
<button id="runAppDiagnosticsBtn" class="btn ghost">Run app diagnostics</button>
'''

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
'''

html = f'''<!doctype html><html><head><meta charset="utf-8"><style>{styles}</style></head><body class="stage15d-freeze-hotfix"><div class="app-shell"><header class="topbar"><h1>Test</h1></header><main class="workspace"><aside class="left-panel panel"></aside><section class="editor-panel panel"></section><aside class="right-panel panel"><div class="right-tabs"><button class="right-tab" data-tab="copilot">Copilot</button><button class="right-tab active" data-tab="settings">Settings</button></div><section id="copilotTab" class="right-tab-panel copilot-panel">{copilot_children}</section><section id="settingsTab" class="right-tab-panel active">{settings_children}<div id="aiRoutingInspectorCard" class="panel-section"><h2>AI model routing inspector</h2><p>diagnostics</p></div><div id="modelRoutingCard" class="panel-section"><h2>Model routing</h2></div></section></aside></main></div></body></html>'''

fixture_dir = tempfile.mkdtemp(prefix='stage17k-fixture-')
fixture_path = Path(fixture_dir) / 'fixture.html'
fixture_path.write_text(html)

port = 9231
profile = tempfile.mkdtemp(prefix='chrome-prof-stage17k-')
cmd = ['/usr/bin/chromium', '--headless=new', '--no-sandbox', '--remote-allow-origins=*', f'--remote-debugging-port={port}', f'--user-data-dir={profile}', '--disable-gpu', '--window-size=1600,1000', 'about:blank']
proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    for _ in range(100):
        try:
            tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list', timeout=1))
            break
        except Exception:
            time.sleep(.1)
    else:
        raise RuntimeError('Chromium did not expose a debugging endpoint')
    ws = websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=5)
    counter = 0
    def send(method, params=None):
        nonlocal_counter = None
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
    ev("window.__LATEXAI_RPO_STORAGE.setItem('latexai:right-panel-sections:v5', JSON.stringify({'settings:compile-settings':false}));")
    ev(service)
    time.sleep(.45)

    ev("window.LuminaLatex.RightPanelOrganizerService.organize('settings');")
    time.sleep(.12)
    migrated_closed = ev("document.querySelector('#rightPanelGroup-settings-compile-settings').dataset.rpoOpen === 'false'")

    ev("window.LatexaiRightPanelExpandAll('settings'); window.LatexaiRightPanelExpandAll('copilot');")
    time.sleep(.2)
    ev("document.querySelector('#settingsTab').scrollTop = 10000;")
    time.sleep(.08)
    expanded_scrollable = ev("""(()=>{
      const panel=document.querySelector('#settingsTab');
      const body=document.querySelector('#rightPanelGroupBody-settings-compile-settings');
      return panel.scrollHeight > panel.clientHeight && panel.scrollTop > 0 && body.clientHeight >= body.scrollHeight - 2;
    })()""")

    ev('document.querySelector("#rightPanelOrganizerToolbar-settings [data-rpo-action=\\"collapse\\"]").click();')
    time.sleep(.2)
    collapsed_after_button = ev("""(()=>{
      const compile=document.querySelector('#rightPanelGroup-settings-compile-settings');
      const body=document.querySelector('#rightPanelGroupBody-settings-compile-settings');
      return compile.dataset.rpoOpen === 'false' && body.hidden;
    })()""")
    persisted_after_collapse = ev("JSON.parse(window.__LATEXAI_RPO_STORAGE.getItem('latexai:right-panel-sections:v6')||'{}')['settings:compile-settings'] === false")

    ev("document.querySelector('#rightPanelGroupSummary-settings-compile-settings').click();")
    time.sleep(.14)
    individual_toggle_open = ev("""(()=>{
      const compile=document.querySelector('#rightPanelGroup-settings-compile-settings');
      const body=document.querySelector('#rightPanelGroupBody-settings-compile-settings');
      return compile.dataset.rpoOpen === 'true' && !body.hidden;
    })()""")

    ev("window.LuminaLatex.RightPanelOrganizerService.organize('settings');")
    time.sleep(.14)
    persisted_open_after_organize = ev("document.querySelector('#rightPanelGroup-settings-compile-settings').dataset.rpoOpen === 'true'")

    result = ev(r'''(() => {
      const svc = window.LuminaLatex.RightPanelOrganizerService;
      const report = svc.currentReport();
      const panel = document.querySelector('#settingsTab');
      const toolbarStyle = getComputedStyle(document.querySelector('#rightPanelOrganizerToolbar-settings'));
      const actionStyle = getComputedStyle(document.querySelector('#rightPanelOrganizerToolbar-settings .right-panel-organizer-actions'));
      const bootOverlayAbsent = !document.querySelector('.boot-error-box');
      const directUngrouped = Array.from(panel.children).filter(n => !n.classList.contains('right-panel-group') && !n.classList.contains('right-panel-organizer-toolbar') && n.getClientRects().length).length;
      return {
        stage: svc.STAGE,
        reportHasDiagnostics: report.includes('Active right tab:') && report.includes('Boot overlay:') && report.includes('Panel scroll / hit-test: settings:') && report.includes('visible ungrouped='),
        toolbarDisplay: toolbarStyle.display,
        actionsDisplay: actionStyle.display,
        actionsGrid: actionStyle.gridTemplateColumns,
        bootOverlayAbsent,
        directUngrouped,
        reportSaysNoOverlay: report.includes('Boot overlay: absent')
      };
    })()''')
    result.update({
        'migratedClosed': migrated_closed,
        'expandedScrollable': expanded_scrollable,
        'collapsedAfterButton': collapsed_after_button,
        'persistedAfterCollapse': persisted_after_collapse,
        'individualToggleOpen': individual_toggle_open,
        'persistedOpenAfterOrganize': persisted_open_after_organize,
    })
    result['pass'] = (
        result.get('stage') == 'stage17k-right-panel-polish-regression-lock-1'
        and migrated_closed and expanded_scrollable and collapsed_after_button
        and persisted_after_collapse and individual_toggle_open and persisted_open_after_organize
        and result.get('bootOverlayAbsent') and result.get('directUngrouped') == 0
        and result.get('reportHasDiagnostics') and result.get('reportSaysNoOverlay')
    )
    print(json.dumps(result, indent=2))
    if not result.get('pass'):
        sys.exit(1)
finally:
    try:
        proc.terminate(); proc.wait(timeout=2)
    except Exception:
        proc.kill()
