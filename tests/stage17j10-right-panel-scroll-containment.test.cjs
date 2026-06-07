const fs = require('fs');
const assert = require('assert');

const organizer = fs.readFileSync('js/right-panel-organizer-service.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/lai-stage17j-right-panel-sections.css', 'utf8');

assert(index.includes('latex-stage17j10-right-panel-organizer-scroll-containment-20260521-1'), 'index should advertise Stage 17J10');
assert(index.includes('right-panel-organizer-service.js?v=stage17j10-right-panel-organizer-scroll-containment-1'), 'index should cache-bust organizer service with Stage 17J10');
assert(index.includes('lai-stage17j-right-panel-sections.css?v=stage17j10-right-panel-organizer-scroll-containment-1'), 'index should cache-bust organizer CSS with Stage 17J10');
assert(index.includes('</body>') && index.includes('</html>'), 'index must be complete');

assert(organizer.includes("const STAGE = 'stage17j10-right-panel-organizer-scroll-containment-1'"), 'service should expose Stage 17J10');
assert(organizer.includes("const STORAGE_KEY = 'latexai:right-panel-sections:v5'"), 'new state key should be v5');
assert(organizer.includes("const STAGE17J9_STORAGE_KEY = 'latexai:right-panel-sections:v4'"), 'service should preserve J9 section state');
assert(organizer.includes('function ensurePanelScrollContainment'), 'service should install scroll containment inline fallback');
assert(organizer.includes("panel.style.height = '0px'"), 'tab scrollport should force height 0 in flex layout');
assert(organizer.includes("panel.style.flex = '1 1 0px'"), 'tab scrollport should use zero flex basis');
assert(organizer.includes("panel.style.overflowY = 'auto'"), 'tab scrollport should scroll vertically');
assert(organizer.includes('function ensureGroupNaturalHeight'), 'service should keep groups at natural height');
assert(organizer.includes("shell.style.flex = '0 0 auto'"), 'groups should not shrink in the tab scrollport');
assert(organizer.includes("body.style.maxHeight = 'none'"), 'expanded bodies should not be height capped');
assert(organizer.includes("target.style.overflow = desired ? 'visible' : 'hidden'"), 'open groups should not clip expanded content');

assert(css.includes('#copilotTab.right-tab-panel.active,\n#settingsTab.right-tab-panel.active'), 'CSS should target organizer tab panels');
assert(css.includes('display: block !important'), 'organizer tabs should be block scrollports, not flex columns');
assert(css.includes('flex: 1 1 0 !important'), 'organizer tabs should use zero flex basis');
assert(css.includes('height: 0 !important'), 'organizer tabs should have height 0 in flex layout');
assert(css.includes('overflow-y: auto !important'), 'organizer tabs should allow vertical scroll');
assert(css.includes('#settingsTab > .right-panel-group'), 'settings groups should receive natural-height rules');
assert(css.includes('flex: 0 0 auto !important'), 'groups should not flex-shrink and clip their body');
assert(css.includes('overflow: visible !important'), 'open groups/body should not clip contents');

console.log('stage17j10 right-panel scroll containment checks passed');
