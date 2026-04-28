(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = W.LUMINA_LATEX_STAGE || 'latex-stage1g-texlyre-worker-mode-hotfix-20260428-1';

  const contracts = {
    projectSchema: 'lumina-latex-project-v1',
    compileRequest: 'lumina-latex-compile-request-v1',
    compileResponse: 'lumina-latex-compile-response-v1',
    aiRequest: 'lumina-latex-ai-request-v1',
    aiPatch: 'lumina-latex-ai-patch-v1',
    copilotContext: 'lumina-latex-copilot-context-v1',
    syncEvent: 'lumina-latex-sync-event-v1',
    websocket: {
      reservedPath: '/ws/lumina/projects/:projectId',
      messageTypes: ['presence', 'file-patch', 'compile-progress', 'comment', 'ai-stream', 'project-notice'],
      status: 'reserved-for-stage2-collaboration'
    },
    http: {
      compile: 'POST /api/lumina/latex/compile',
      compileJob: 'POST /api/lumina/latex/compile/jobs',
      compileStatus: 'GET /api/lumina/latex/compile/jobs/:jobId',
      backendStatus: 'GET /api/lumina/latex/status',
      compileEvents: 'GET /api/lumina/latex/compile/jobs/:jobId/events',
      ai: 'POST /api/lumina/ai',
      aiStatus: 'GET /api/lumina/ai/status',
      aiWorkflows: 'GET /api/lumina/ai/workflows',
      saveProject: 'POST /api/lumina/projects/:projectId',
      loadProject: 'GET /api/lumina/projects/:projectId'
    }
  };

  const providers = {
    editor: 'textarea-adapter-now-codemirror-ready',
    compiler: 'backend-texlive-real-runner | browser-wasm-swiftlatex-experimental | browser-wasm-texlyre-busytex-experimental | mock-draft | overleaf-export',
    ai: 'backend-provider-proxy + structured-workflow-context',
    sync: 'local-only | http-project | websocket-placeholder',
    preview: 'draft-html | pdf-blob'
  };

  const boot = {
    startedAt: new Date().toISOString(),
    modules: [],
    errors: []
  };

  function mark(moduleName) {
    boot.modules.push({ module: moduleName, at: new Date().toISOString() });
  }

  function reportError(moduleName, err) {
    const item = { module: moduleName, message: err?.message || String(err), at: new Date().toISOString() };
    boot.errors.push(item);
    W.LUMINA_LATEX_BOOT_ERRORS?.push?.(`${moduleName}: ${item.message}`);
    console.error('Lumina kernel error', item, err);
  }

  function getArchitectureReport() {
    return {
      stage: STAGE,
      contracts,
      providers,
      boot,
      project: NS.State?.state?.project ? NS.ProjectModel?.summarize(NS.State.state.project) : null,
      settings: NS.State?.state?.settings || null
    };
  }

  NS.Kernel = { STAGE, contracts, providers, boot, mark, reportError, getArchitectureReport };
})();
