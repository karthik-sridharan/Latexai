const fs = require('fs');
const assert = require('assert');

const organizer = fs.readFileSync('js/right-panel-organizer-service.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/lai-stage17j-right-panel-sections.css', 'utf8');

assert(index.includes('LATEXAI_STAGE17K_RIGHT_PANEL_POLISH_REGRESSION_LOCK'), 'index should advertise Stage 17K');
assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17k-right-panel-polish-regression-lock-20260521-1'"), 'boot stage should be Stage 17K');
assert(index.includes('right-panel-organizer-service.js?v=stage17k-right-panel-polish-regression-lock-1'), 'organizer service should have Stage 17K cache busting');
assert(index.includes('lai-stage17j-right-panel-sections.css?v=stage17k-right-panel-polish-regression-lock-1'), 'organizer CSS should have Stage 17K cache busting');
assert(index.includes('stage17k-right-panel-organizer-fallback'), 'fallback loader should be Stage 17K named');
assert(index.includes('</body>') && index.includes('</html>'), 'index must be complete');

assert(organizer.includes("const STAGE = 'stage17k-right-panel-polish-regression-lock-1'"), 'service should expose Stage 17K');
assert(organizer.includes("const STORAGE_KEY = 'latexai:right-panel-sections:v6'"), 'fresh persisted state key should be v6');
assert(organizer.includes("const STAGE17J10_STORAGE_KEY = 'latexai:right-panel-sections:v5'"), 'service should migrate Stage 17J10 state');
assert(organizer.includes('function storageAdapter'), 'service should use a safe persisted-state storage adapter');
assert(organizer.includes('__LATEXAI_RPO_MEMORY_STORAGE'), 'service should fall back when localStorage is blocked');
assert(organizer.includes('function activeRightTabName'), 'report should include active right tab diagnostic');
assert(organizer.includes('function visibleUngroupedCards'), 'report should count visible ungrouped cards');
assert(organizer.includes('function overlayDiagnostics'), 'report should expose boot overlay diagnostics');
assert(organizer.includes('function toolbarHitTest'), 'report should include hit-test diagnostics');
assert(organizer.includes('function panelDiagnostics'), 'report should include panel scroll diagnostics');
assert(organizer.includes('Active right tab:'), 'report should print active tab');
assert(organizer.includes('Boot overlay:'), 'report should print boot overlay state');
assert(organizer.includes('Panel scroll / hit-test:'), 'report should print scroll and hit-test state');
assert(organizer.includes("btn.textContent = 'Report'"), 'copy report button should use compact label');
assert(organizer.includes('right-panel-organizer-label'), 'toolbar should have compact label markup');

assert(css.includes('Latexai Stage 17K'), 'CSS should advertise Stage 17K');
assert(css.includes('display: grid;'), 'toolbar should use compact grid layout');
assert(css.includes('grid-template-columns: repeat(2, minmax(66px, 1fr));'), 'toolbar actions should use a two-column compact grid');
assert(css.includes('grid-column: 1 / -1;'), 'toolbar status should sit below the compact action grid');
assert(css.includes('height: 0 !important'), 'scroll containment should remain locked');
assert(css.includes('overflow-y: auto !important'), 'tab scrollport should remain vertically scrollable');
assert(css.includes('flex: 0 0 auto !important'), 'groups should not shrink and clip expanded bodies');

console.log('stage17k right-panel polish/regression-lock checks passed');
