import json, subprocess, time, urllib.request, websocket, tempfile, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
paper = (ROOT / 'js/paper-ai-polish-service.js').read_text()
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
port = 9251
profile = tempfile.mkdtemp(prefix='chrome-prof-stage17o-')
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
    counter = [0]
    def send(method, params=None):
        counter[0] += 1
        ws.send(json.dumps({'id': counter[0], 'method': method, 'params': params or {}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get('id') == counter[0]:
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
    ev(r'''window.LuminaLatex = window.LuminaLatex || {};
    window.LuminaLatex.State = (() => {
      const project = {
        rootFile: 'main.tex',
        activePath: 'main.tex',
        files: [
          { path: 'main.tex', kind: 'tex', text: String.raw`\documentclass{article}
\begin{document}
\section{Intro}
Our result is good.
This paper is clear.
\end{document}` },
          { path: 'sections/related.tex', kind: 'tex', text: 'Related work is thin.' }
        ]
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
        openFile: (path) => { project.activePath = norm(path); }
      };
    })();
    window.LuminaLatex.Editor = { render: () => true };
    window.LuminaLatex.FileTree = { render: () => true };
    window.LuminaLatex.Preview = { scheduleDraftPreview: () => true };
    window.LuminaLatex.RegressionChecklistService = { runChecklist: () => true };
    ''')
    ev(paper)
    ev(competitive)
    ev(devils)
    time.sleep(.2)

    result = ev(r'''(async () => {
      const NS = window.LuminaLatex;
      const compReport = `# Competitive review\n\n` + '```latexai_actionable_edits\n' + JSON.stringify({
        actionableEdits: [{ mode: 'replace', path: 'main.tex', targetHint: 'intro claim', oldText: 'Our result is good.', newText: 'Our result is sharp and explicitly improves the prior bound.', confidence: 0.91 }],
        appendPlan: 'Add a clearer comparison paragraph and tighten the theorem statement.'
      }) + '\n```';
      const synthReport = `# Synthesis\n\n` + '```latexai_actionable_edits\n' + JSON.stringify({
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
      const compInline = NS.CompetitivePaperReviewService.insertActionableEditsAtMatches();
      const compScan = NS.PaperAiPolishService.getLastScan();
      const compRows = document.getElementById('paperAiEditList').textContent;
      const compAppend = NS.CompetitivePaperReviewService.appendLaiImprovementPlan();
      const compAppendScan = NS.PaperAiPolishService.getLastScan();

      document.getElementById('debateRounds').value = '1';
      await NS.DevilsAdvocateDebateService.runDebate();
      const devInline = NS.DevilsAdvocateDebateService.insertActionableEditsAtMatches();
      const devScan = NS.PaperAiPolishService.getLastScan();
      const devRows = document.getElementById('paperAiEditList').textContent;
      const devAppend = NS.DevilsAdvocateDebateService.appendLaiImprovementPlan();
      const finalScan = NS.PaperAiPolishService.getLastScan();
      const finalText = NS.State.getFile('main.tex').text;
      const finalReport = NS.PaperAiPolishService.formatReport(NS.PaperAiPolishService.getLastReport());

      return {
        paperStage: NS.PaperAiPolishService.STAGE,
        compStage: NS.CompetitivePaperReviewService.STAGE,
        devStage: NS.DevilsAdvocateDebateService.STAGE,
        compInlineOk: compInline.ok && compInline.applied === 1,
        compScanProject: compScan && compScan.scanKind === 'project' && compScan.edits.length === 1,
        compRowsLabeled: compRows.includes('Competitive Review') && compRows.includes('intro claim'),
        compAppendOk: compAppend.ok && compAppendScan.edits.length >= 2,
        compAppendMeta: finalText.includes('workflow=competitive-review') && finalText.includes('mode=append-plan'),
        devInlineOk: devInline.ok && devInline.applied === 1,
        devRowsLabeled: devRows.includes("Devil's Advocate") && devRows.includes('clarity sentence'),
        devAppendOk: devAppend.ok && finalScan.edits.length >= 4,
        devAppendMeta: finalText.includes('workflow=devils-advocate') && finalText.includes("Devil's Advocate Improvement Plan"),
        reportSources: finalReport.includes('Sources:') && (finalReport.includes('Competitive Review') || finalReport.includes("Devil's Advocate")),
        hasReviewButtons: !!document.getElementById('paperAiScanProjectBtn') && document.getElementById('paperAiPolishSummary').textContent.includes('file'),
        noOldCommentRoadmap: !finalText.includes('Latexai competitive review roadmap') && !finalText.includes('Latexai devil'),
        askCount
      };
    })()''', True)
    result['pass'] = (
      result.get('paperStage') == 'stage17o-lai-review-integration-for-devils-competitive-1' and
      result.get('compStage') == 'stage17o-lai-review-integration-for-devils-competitive-1' and
      result.get('devStage') == 'stage17o-lai-review-integration-for-devils-competitive-1' and
      result.get('compInlineOk') and result.get('compScanProject') and result.get('compRowsLabeled') and
      result.get('compAppendOk') and result.get('compAppendMeta') and result.get('devInlineOk') and
      result.get('devRowsLabeled') and result.get('devAppendOk') and result.get('devAppendMeta') and
      result.get('reportSources') and result.get('hasReviewButtons') and result.get('noOldCommentRoadmap') and result.get('askCount') >= 4
    )
    print(json.dumps(result, indent=2))
    if not result.get('pass'):
      sys.exit(1)
finally:
    try:
        proc.terminate()
    except Exception:
        pass
