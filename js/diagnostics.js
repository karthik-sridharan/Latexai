(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

  const REQUIRED_IDS = [
    'sourceEditor','lineGutter','fileTree','outlineList','draftPreview','pdfPreview','logPanel','problemList',
    'compileBtn','cancelCompileBtn','exportZipBtn','importFileInput','aiProvider','aiModel','aiProxyUrl','compileProxyUrl','compileProxyToken','backendStatusCard','backendStatusText','backendStatusDetail','testCompileBackendBtn','compileJobsCheck','compilePollSelect','compilerModeSelect','wasmStatusCard','wasmStatusText','wasmStatusDetail','testBrowserWasmBtn','browserWasmAssetBase','browserWasmTexliveEndpoint','browserWasmReuseCheck','texlyreStatusCard','texlyreStatusText','texlyreStatusDetail','testTexlyreBtn','texlyreModuleUrl','texlyreBusytexBase','texlyreReuseCheck','texlyreUseWorkerCheck','openOverleafBtn','rootFileSelect','compileStatusCard','compileProgressBar','copilotContextChips','patchReview','patchMeta','patchSummary','patchDiff','previewCopilotPatchBtn','applyCopilotPatchBtn','discardCopilotPatchBtn'
  ];

  function run() {
    const missingDomIds = REQUIRED_IDS.filter((id) => !document.getElementById(id));
    const modules = ['Kernel','ProjectModel','ProjectStore','SyncProvider','EditorAdapter','PreviewAdapter','BrowserWasmProvider','TexlyreBusyTexProvider','CompilerProvider','AIProvider','PatchManager','State','Editor','FileTree','Preview','ImportExport','Copilot','Diagnostics','Main'];
    const missingModules = modules.filter((name) => !NS[name]);
    let localStorageWorks = false;
    try {
      const key = 'lumina-latex-diagnostic-test';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      localStorageWorks = true;
    } catch (_err) {}
    const state = State?.().state;
    const compilerAvailability = NS.CompilerProvider?.backendAvailability?.() || null;
    const backendProbe = NS.CompilerProvider?.getLastBackendProbe?.() || null;
    const compileProxyValue = document.getElementById('compileProxyUrl')?.value || '';
    const report = {
      stage: W.LUMINA_LATEX_STAGE || 'latex-stage1g-texlyre-worker-mode-hotfix-20260428-1',
      checkedAt: new Date().toISOString(),
      url: location.href,
      userAgent: navigator.userAgent,
      missingDomIds,
      missingModules,
      localStorageWorks,
      projectName: state?.project?.name || null,
      rootFile: state?.project?.rootFile || null,
      activePath: state?.project?.activePath || null,
      fileCount: state?.project?.files?.length || 0,
      draftPreviewPresent: !!document.getElementById('draftPreview')?.textContent?.trim(),
      aiProxyConfigured: !!document.getElementById('aiProxyUrl')?.value,
      compileProxyConfigured: !!compileProxyValue,
      compileJobsEnabled: !!document.getElementById('compileJobsCheck')?.checked,
      compileBackendAvailability: compilerAvailability,
      browserWasmStatus: NS.BrowserWasmProvider?.status?.() || null,
      texlyreBusyTexStatus: NS.TexlyreBusyTexProvider?.status?.() || null,
      backendProbe,
      shellEscapeRequested: !!state?.settings?.shellEscape,
      shellEscapeEffective: !!compilerAvailability?.shellEscapeEffective,
      shellEscapeSafety: compilerAvailability?.shellEscapeEffective
        ? 'enabled-for-configured-backend'
        : 'disabled-or-ignored-until-real-backend-permits-it',
      copilotPatchActive: !!NS.PatchManager?.getActivePatch?.(),
      copilotWorkflow: document.getElementById('copilotTask')?.value || null,
      staticBackendFallbackActive: !!compilerAvailability?.staticDraftFallbackActive,
      compileStatus: state?.compile || null,
      lastProblemCount: state?.lastProblems?.length || 0,
      architecture: NS.Kernel?.getArchitectureReport?.() || null,
      pass: missingDomIds.length === 0 && missingModules.length === 0 && localStorageWorks && !!state?.project?.files?.length
    };
    W.LUMINA_LATEX_LAST_DIAGNOSTIC = report;
    return report;
  }

  async function copy() {
    const report = run();
    const text = JSON.stringify(report, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      W.LuminaLatex.Main?.toast?.('Diagnostics copied.');
    } catch (_err) {
      const log = document.getElementById('logPanel');
      if (log) log.textContent = text;
    }
    return report;
  }

  function init() {
    document.getElementById('copyDiagnosticsBtn')?.addEventListener('click', copy);
    document.getElementById('runAppDiagnosticsBtn')?.addEventListener('click', () => {
      const report = run();
      const statusMessage = report.staticBackendFallbackActive
        ? 'App diagnostics passed. Static deployment detected; compile falls back to draft validation until a backend URL is configured.'
        : 'App diagnostics passed.';
      State().setLog(JSON.stringify(report, null, 2), report.pass ? [{ level: 'ok', message: statusMessage, line: null }] : [{ level: 'error', message: 'App diagnostics found missing pieces.', line: null }]);
      document.querySelector('[data-right-tab="logs"]')?.click();
    });
  }

  NS.Diagnostics = { init, run, copy, REQUIRED_IDS };
})();
