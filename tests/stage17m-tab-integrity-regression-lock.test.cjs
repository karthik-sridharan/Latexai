const fs = require('fs');
const assert = require('assert');

const organizer = fs.readFileSync('js/right-panel-organizer-service.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/lai-stage17j-right-panel-sections.css', 'utf8');

assert(index.includes('LATEXAI_STAGE17M_TAB_INTEGRITY_REGRESSION_LOCK'), 'index should advertise Stage 17M');
assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17m-tab-integrity-regression-lock-20260521-1'"), 'boot stage should be Stage 17M');
assert(index.includes('right-panel-organizer-service.js?v=stage17m-tab-integrity-regression-lock-1'), 'organizer should use Stage 17M cache busting');
assert(index.includes('lai-stage17j-right-panel-sections.css?v=stage17m-tab-integrity-regression-lock-1'), 'right-panel CSS should use Stage 17M cache busting');
assert(index.includes('stage17m-right-panel-organizer-fallback'), 'fallback loader should be Stage 17M named');

assert(organizer.includes("const STAGE = 'stage17m-tab-integrity-regression-lock-1'"), 'organizer should expose Stage 17M');
assert(organizer.includes("const STORAGE_KEY = 'latexai:right-panel-sections:v7'"), 'organizer should use new Stage 17M state key');
assert(organizer.includes('const STAGE17L_STORAGE_KEY'), 'organizer should migrate Stage 17L section state');
assert(organizer.includes('KNOWN_CARD_OWNERS'), 'organizer should define a known-card ownership map');
assert(organizer.includes("figureEditorCard: ['assets']"), 'Draw figure card should be owned by Figures/assets tab');
assert(organizer.includes("tikzMakerCard: ['assets']"), 'AI TikZ card should be owned by Figures/assets tab');
assert(organizer.includes("imageToTikzCard: ['assets']"), 'Image-to-TikZ card should be owned by Figures/assets tab');
assert(organizer.includes('nodeAllowedForTab'), 'organizer should gate all card moves by tab ownership');
assert(organizer.includes('beforePanel !== panel'), 'organizer should refuse cross-panel moves before appending');
assert(organizer.includes('isCardMisplaced(card)'), 'organizer should not move known cards already detected in the wrong tab');
assert(organizer.includes('tabIntegritySummary'), 'organizer should expose/report tab integrity diagnostics');
assert(organizer.includes('Figures tab tools:'), 'copy report should include Figures tab tool health');
assert(organizer.includes('Misplaced known cards:'), 'copy report should include misplaced known-card diagnostics');
assert(organizer.includes('Tab card count:'), 'copy report should include per-tab card counts');

assert(css.includes('#assetsTab.right-tab-panel.active'), 'Figures tab scroll containment should remain present');
assert(css.includes('#assetsTab .figure-editor-card'), 'Draw figure natural-height CSS should remain present');

console.log('stage17m tab integrity regression lock static checks passed');
