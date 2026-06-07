import json, subprocess, time, urllib.request, websocket, tempfile, sys
from pathlib import Path
ROOT=Path('/mnt/data/work17j10')
styles = '\n'.join((ROOT/p).read_text() for p in ['css/styles.css','css/lai-stage5e-layout.css','css/lai-stage17j-right-panel-sections.css'])
service = (ROOT/'js/right-panel-organizer-service.js').read_text()
# Create enough direct children that the compile group must exceed the right tab height.
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
html=f'''<!doctype html><html><head><meta charset="utf-8"><style>{styles}</style></head><body class="stage15d-freeze-hotfix"><div class="app-shell"><header class="topbar"><h1>Test</h1></header><main class="workspace"><aside class="left-panel panel"></aside><section class="editor-panel panel"></section><aside class="right-panel panel"><div class="right-tabs"><button class="right-tab" data-tab="copilot">Copilot</button><button class="right-tab active" data-tab="settings">Settings</button></div><section id="copilotTab" class="right-tab-panel copilot-panel"><div class="section-head compact"><h2>LaTeX Copilot</h2></div><textarea id="copilotPrompt"></textarea><button id="askCopilotBtn">Ask</button><pre id="copilotOutput"></pre></section><section id="settingsTab" class="right-tab-panel active">{settings_children}<div id="aiRoutingInspectorCard" class="panel-section"><h2>AI model routing inspector</h2><p>diagnostics</p></div><div id="modelRoutingCard" class="panel-section"><h2>Model routing</h2></div></section></aside></main></div></body></html>'''
port=9225
profile=tempfile.mkdtemp(prefix='chrome-prof-')
cmd=['/usr/bin/chromium','--headless=new','--no-sandbox','--remote-allow-origins=*',f'--remote-debugging-port={port}',f'--user-data-dir={profile}','--disable-gpu','--window-size=1600,1000','about:blank']
proc=subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
try:
    for _ in range(100):
        try:
            tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list', timeout=1)); break
        except Exception: time.sleep(.1)
    ws=websocket.create_connection(tabs[0]['webSocketDebuggerUrl'], timeout=5)
    c=0
    def send(m,p=None):
        nonlocal_c=None
        global c
        c+=1
        ws.send(json.dumps({'id':c,'method':m,'params':p or {}}))
        while True:
            msg=json.loads(ws.recv())
            if msg.get('id')==c: return msg
    def ev(expr, awaitp=False):
        r=send('Runtime.evaluate', {'expression':expr, 'awaitPromise':awaitp, 'returnByValue':True})
        if 'exceptionDetails' in r:
            raise RuntimeError(json.dumps(r['exceptionDetails'], indent=2))
        return r['result']['result'].get('value')
    send('Runtime.enable')
    ev('document.open(); document.write('+json.dumps(html)+'); document.close();')
    ev(service)
    time.sleep(.5)
    res=ev('''(async()=>{\nwindow.LuminaLatex.RightPanelOrganizerService.organize('settings');\nwindow.LatexaiRightPanelExpandAll('settings');\nawait new Promise(r=>setTimeout(r,180));\nconst panel=document.querySelector('#settingsTab');\nconst group=document.querySelector('#rightPanelGroup-settings-compile-settings');\nconst body=group.querySelector('.right-panel-group-body');\npanel.scrollTop = 10000;\nawait new Promise(r=>setTimeout(r,50));\nconst csPanel=getComputedStyle(panel), csGroup=getComputedStyle(group), csBody=getComputedStyle(body);\nreturn {\n  stage: window.LuminaLatex.RightPanelOrganizerService.STAGE,\n  panelDisplay: csPanel.display, panelOverflowY: csPanel.overflowY, panelFlex: csPanel.flex, panelHeightStyle: csPanel.height,\n  panelClientHeight: panel.clientHeight, panelScrollHeight: panel.scrollHeight, panelScrollTopAfter: panel.scrollTop,\n  groupOpen: group.dataset.rpoOpen, groupFlex: csGroup.flex, groupOverflowY: csGroup.overflowY, groupClientHeight: group.clientHeight, groupScrollHeight: group.scrollHeight,\n  bodyDisplay: csBody.display, bodyOverflowY: csBody.overflowY, bodyClientHeight: body.clientHeight, bodyScrollHeight: body.scrollHeight,\n  pass: csPanel.display === 'block' && csPanel.overflowY === 'auto' && panel.scrollHeight > panel.clientHeight && panel.scrollTop > 0 && group.clientHeight >= group.scrollHeight - 2 && body.clientHeight >= body.scrollHeight - 2\n};\n})()''', True)
    print(json.dumps(res, indent=2))
    if not res.get('pass'):
        sys.exit(1)
finally:
    try: proc.terminate(); proc.wait(timeout=2)
    except Exception: proc.kill()
