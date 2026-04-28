export const sandboxPolicy = {
  compileWorkspace: 'temporary isolated directory per request',
  deletion: 'workspace removed after response',
  shellEscape: 'disabled unless ALLOW_SHELL_ESCAPE=true',
  timeouts: 'COMPILE_TIMEOUT_MS per command',
  outputs: ['pdfBase64', 'log', 'exitCode'],
  futureStage: 'containerized compile jobs with streamed progress over WebSocket/SSE'
};
