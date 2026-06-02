/* Latexai Stage 19V legacy Devil's Advocate debate compatibility stub.
 * The old paper-debate card has been removed. Use RealAgentBranchWorkflowService
 * for Devil's Advocate branch-runner workflows with critic/advocate/synthesizer/editor roles.
 */
(function() {
  'use strict';
  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const STAGE = 'latex-stage19v-ai-workflow-ui-consolidation-20260602-1';
  NS.LegacyDevilsAdvocateDebateDisabled = {
    STAGE,
    disabledByStage19V: true,
    init: () => false,
    createCard: () => false,
    formatFullReport: () => 'Legacy Devil\'s Advocate paper debate was removed in Stage 19V. Use the Devil\'s Advocate branch runner.',
    getLastReport: () => 'Legacy Devil\'s Advocate paper debate was removed in Stage 19V. Use the Devil\'s Advocate branch runner.'
  };
})();
