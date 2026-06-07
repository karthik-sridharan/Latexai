const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const service = fs.readFileSync('js/right-panel-organizer-service.js', 'utf8');
const css = fs.readFileSync('css/lai-stage17j-right-panel-sections.css', 'utf8');

assert(index.includes('latex-stage17j8-right-panel-organizer-browser-verified-20260521-1'), 'index should advertise Stage 17J8');
assert(index.includes('right-panel-organizer-service.js?v=stage17j8-right-panel-organizer-browser-verified-1'), 'index should cache-bust organizer service with Stage 17J8');
assert(index.includes('stage17j8-right-panel-organizer-fallback'), 'index should use the Stage 17J8 fallback loader');
assert(index.includes('</body>') && index.includes('</html>'), 'index must be complete');
assert(!index.includes("s.src = 'js/right-panel-organizer-service.js?v=stage17j3-right-panel-organizer-buttons-hotfix-1"), 'index must not contain the truncated Stage 17J3 fallback string');

assert(service.includes("const STAGE = 'stage17j8-right-panel-organizer-browser-verified-1'"), 'service should expose Stage 17J8');
assert(service.includes("const STORAGE_KEY = 'latexai:right-panel-sections:v3'"), 'service should use the v3 state key');
assert(service.includes("const STAGE17J7_STORAGE_KEY = 'latexai:right-panel-sections:v2'"), 'service should be aware of Stage 17J7 state');
assert(service.includes("const LEGACY_FORCE_STATE_KEY = 'latexai:right-panel-sections:forced-tab-state:v1'"), 'service should know the old forced-state key');
assert(service.includes('localStorage.removeItem(LEGACY_FORCE_STATE_KEY)'), 'service should clear stale forced state');
assert(service.includes("D.createElement('div')"), 'groups should use controlled div shells');
assert(!service.includes("D.createElement('details')"), 'Stage 17J8 should not create native details groups');
assert(service.includes('data-rpo-group-toggle'), 'group headers should have explicit toggle buttons');
assert(service.includes('function bindControlEvents'), 'control buttons should get direct pointer/mouse/touch/key handlers');
assert(service.includes("['pointerdown', 'mousedown', 'touchend', 'click']"), 'controls should handle pointer, mouse, touch, and click events');
assert(service.includes('D.addEventListener(type, routePointerEvent, true)'), 'delegated fallback should run in capture phase');
assert(service.includes("title: 'Core Copilot prompt'"), 'core Copilot controls should be grouped');
assert(service.includes("title: 'Compile / backend settings'"), 'core Settings controls should be grouped');
assert(service.includes("if (tab === 'copilot' || tab === 'settings') return [tab];"), 'toolbar buttons should target their own tab');
assert(service.includes("return ['copilot', 'settings'];"), 'global fallbacks should still support all tabs');
assert(service.includes('directPanelItemFor'), 're-organize should keep nested inputs/labels intact');

assert(css.includes('.right-panel-group-summary {'), 'CSS should style the button summary');
assert(css.includes('appearance: none'), 'summary button should reset native button appearance');
assert(css.includes('.right-panel-group[data-rpo-open="false"] > .right-panel-group-body'), 'CSS should hide collapsed controlled shell bodies');
assert(!css.includes('details.right-panel-group'), 'CSS should not rely on details selectors');

console.log('Stage 17J8 right panel browser-verified organizer checks passed.');
