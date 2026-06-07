import json, subprocess, time, urllib.request, websocket, tempfile, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
project_model = (ROOT / 'js/project-model.js').read_text()
competitive = (ROOT / 'js/competitive-paper-review-service.js').read_text()
devils = (ROOT / 'js/devils-advocate-debate-service.js').read_text()
html = '''<!doctype html><html><head><meta charset="utf-8"></head><body>
<select id="aiProvider"><option value="openai">openai</option></select>
<select id="aiModel"><option value="gpt-4.1-mini">gpt-4.1-mini</option></select>
<input id="aiProxyUrl" value="/api/lumina/ai">
<input id="aiProxyToken" value="">
<div id="activeFilePill">main.tex</div>
<textarea id="sourceEditor"></textarea>
<section id="copilotTab"></section>
<section id="settingsTab"></section>
</body></html>'''
port = 9234
profile = tempfile.mkdtemp(prefix='chrome-prof-stage17n-')
cmd = ['/usr/bin/chromium', '--headless=new', '--no-sandbox', '--remote-allow-origins=*', f'--remote-debugging-port={port}', f'--user-data-dir={profile}', '--disable-gpu', '--window-size=1400,900', 'about:blank']
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
    counter = 0
    def send(method, params=None):
        nonlocal_counter[0] += 1
        ws.send(json.dumps({'id': nonlocal_counter[0], 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == nonlocal_counter[0]:
                return msg
    nonlocal_counter = [0]
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
    ev(project_model)
    ev(r'''window.LuminaLatex.State = (() => {
      const project = {
        rootFile: 'main.tex',
        activePath: 'main.tex',
        files: [{ path: 'main.tex', kind: 'tex', text: String.raw`\documentclass{article}
\begin{document}
\section{Intro}
Our result is good.
This paper is clear.
\end{document}` }]
      };
      const norm = (p) => String(p || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
      return {
        state: { project },
        normalizePath: norm,
        getFile: (path) => project.files.find((f) => norm(f.path) === norm(path)) || null,
        updateFile: (path, text) => {
          const n = norm(path); let file = project.files.find((f) => norm(f.path) === n);
          if (!file) { file = { path: n, kind: 'tex', text: '' }; project.files.push(file); }
          file.text = String(text || '');
        },
        upsertFile: (path, text) => {
          const n = norm(path); let file = project.files.find((f) => norm(f.path) === n);
          if (!file) { file = { path: n, kind: 'tex', text: '' }; project.files.push(file); }
          file.text = String(text || '');
        },
        save: () => true,
        setActivePath: (path) => { project.activePath = norm(path); }
      };
    })();
    window.LuminaLatex.Editor = { render: () => true };
    window.LuminaLatex.FileTree = { render: () => true };
    window.LuminaLatex.Preview = { scheduleDraftPreview: () => true };
    ''')
    ev(competitive)
    ev(devils)
    time.sleep(.2)

    result = ev(r'''(async () => {
      const NS = window.LuminaLatex;
      const compReport = `# Competitive review

The draft needs sharper positioning.

` + '```latexai_actionable_edits\n' + JSON.stringify({
        actionableEdits: [{ mode: 'replace', path: 'main.tex', targetHint: 'intro claim', oldText: 'Our result is good.', newText: 'Our result is sharp and explicitly improves the prior bound.', confidence: 0.91 }],
        appendPlan: 'Add a clearer comparison paragraph and tighten the theorem statement.'
      }) + '\n```';
      const synthReport = `# Synthesis

Use the strongest criticism constructively.

` + '```latexai_actionable_edits\n' + JSON.stringify({
        actionableEdits: [{ mode: 'replace', path: 'main.tex', targetHint: 'clarity sentence', oldText: 'This paper is clear.', newText: 'The exposition should first state the main technical bottleneck and then explain how the proof resolves it.', confidence: 0.88 }],
        appendPlan: 'Add a balanced improvement plan after the main text.'
      }) + '\n```';
      let askCount = 0;
      NS.AIProvider = {
        getStatus: async () => ({ ok: true, webSearch: { available: true }, providers: { openai: { webSearch: { available: true } } } }),
        ask: async (payload) => {
          askCount += 1;
          if (payload && payload.debateAgent && payload.debateAgent.role === 'synthesizer') return synthReport;
          if (payload && payload.debateAgent) return `agent ${payload.debateAgent.role} response`;
          return compReport;
        },
        extractText: (x) => String(x || '')
      };
      document.getElementById('competitivePaperUrls').value = 'https://example.test/paper.pdf';
      await NS.CompetitivePaperReviewService.runCompetitiveReview();
      const compParsed = NS.CompetitivePaperReviewService.extractActionableEdits(compReport);
      const compInline = NS.CompetitivePaperReviewService.insertActionableEditsAtMatches();
      const afterCompInline = NS.State.getFile('main.tex').text;
      const compAppend = NS.CompetitivePaperReviewService.appendLaiImprovementPlan();
      const afterCompAppend = NS.State.getFile('main.tex').text;

      document.getElementById('debateRounds').value = '1';
      await NS.DevilsAdvocateDebateService.runDebate();
      const devParsed = NS.DevilsAdvocateDebateService.extractActionableEdits(synthReport);
      const devInline = NS.DevilsAdvocateDebateService.insertActionableEditsAtMatches();
      const afterDevInline = NS.State.getFile('main.tex').text;
      const devAppend = NS.DevilsAdvocateDebateService.appendLaiImprovementPlan();
      const afterDevAppend = NS.State.getFile('main.tex').text;

      return {
        compStage: NS.CompetitivePaperReviewService.STAGE,
        devStage: NS.DevilsAdvocateDebateService.STAGE,
        buttons: {
          compInline: !!document.getElementById('insertCompetitiveInlineLaiBtn'),
          compAppend: document.getElementById('insertCompetitiveRoadmapBtn')?.textContent,
          devInline: !!document.getElementById('insertDevilsInlineLaiBtn'),
          devAppend: document.getElementById('insertDevilsPlanBtn')?.textContent
        },
        compParsed: compParsed.edits.length,
        devParsed: devParsed.edits.length,
        compInlineOk: compInline.ok && compInline.applied === 1 && afterCompInline.includes('\\laiold{') && afterCompInline.includes('Our result is sharp'),
        compAppendOk: compAppend.ok && afterCompAppend.includes('\\section*{Latexai Competitive Review Improvement Plan}') && afterCompAppend.indexOf('\\section*{Latexai Competitive Review Improvement Plan}') < afterCompAppend.indexOf('\\end{document}'),
        devInlineOk: devInline.ok && devInline.applied === 1 && afterDevInline.includes('The exposition should first state'),
        devAppendOk: devAppend.ok && afterDevAppend.includes("\\section*{Latexai Devil's Advocate Improvement Plan}"),
        noOldComments: !afterDevAppend.includes('Latexai competitive review roadmap') && !afterDevAppend.includes("Latexai devil's advocate improvement plan ---"),
        hasLaiMacro: afterDevAppend.includes('\\long\\def\\lai#1') || afterDevAppend.includes('\\newif\\iflaishowchanges'),
        hasLaiOldMacro: afterDevAppend.includes('\\long\\def\\laiold#1'),
        askCount
      };
    })()''', True)
    result['pass'] = (
      result.get('compStage') == 'stage17n-actionable-devils-competitive-lai-edits-1' and
      result.get('devStage') == 'stage17n-actionable-devils-competitive-lai-edits-1' and
      result.get('buttons', {}).get('compInline') and result.get('buttons', {}).get('compAppend') == 'Append \\lai plan' and
      result.get('buttons', {}).get('devInline') and result.get('buttons', {}).get('devAppend') == 'Append \\lai plan' and
      result.get('compParsed') == 1 and result.get('devParsed') == 1 and
      result.get('compInlineOk') and result.get('compAppendOk') and result.get('devInlineOk') and result.get('devAppendOk') and
      result.get('noOldComments') and result.get('hasLaiMacro') and result.get('hasLaiOldMacro') and result.get('askCount') >= 4
    )
    print(json.dumps(result, indent=2))
    if not result.get('pass'):
      sys.exit(1)
finally:
    try:
        proc.terminate()
    except Exception:
        pass
