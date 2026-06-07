const fs = require('fs');
const assert = require('assert');

const organizer = fs.readFileSync('js/right-panel-organizer-service.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/lai-stage17j-right-panel-sections.css', 'utf8');
const citationAi = fs.readFileSync('js/citation-ai-service.js', 'utf8');
const citationVerifier = fs.readFileSync('js/citation-verifier-service.js', 'utf8');
const presentation = fs.readFileSync('js/presentation-export-service.js', 'utf8');
const documentAi = fs.readFileSync('js/document-ai-service.js', 'utf8');

assert(organizer.includes("stage17j9-right-panel-organizer-visible-catchall-1"), 'stage string should be 17J9');
assert(organizer.includes("const STORAGE_KEY = 'latexai:right-panel-sections:v4'"), 'new state key should be v4');
assert(organizer.includes("'documentAiCard'"), 'document AI card should be grouped into Paper AI');
assert(organizer.includes("'#copilotContextChips'"), 'copilot context chips should be grouped');
assert(organizer.includes("key: 'other-copilot'"), 'Copilot catch-all group should exist');
assert(organizer.includes("key: 'other-settings'"), 'Settings catch-all group should exist');
assert(organizer.includes('group.catchAll'), 'catch-all logic should exist');
assert(organizer.includes('group headers must toggle exactly once') || organizer.includes('Group headers must toggle exactly once'), 'single-toggle event guard should be documented');
assert(organizer.includes("event.type !== 'click' && event.type !== 'keydown'"), 'group headers should not toggle on pointerdown/mousedown/touchend');
assert(organizer.includes("!event?.target?.closest?.('.right-panel-group-body')"), 'shell hit-test fallback should avoid body clicks');
assert(css.includes('.right-panel-group.is-catchall.empty'), 'empty catch-all groups should be hidden');

const posOrganizer = index.indexOf('data-feature="right-panel-organizer"');
const posCitation = index.indexOf('data-feature="citation-ai"');
const posRelease = index.indexOf('data-feature="release-verifier"');
assert(posOrganizer > posCitation, 'organizer should load after citation cards are created');
assert(posOrganizer > posRelease, 'organizer should load after release verifier to avoid moving anchors before later inserts');

assert(citationAi.includes('docAiCard?.parentElement === panel'), 'citation AI insertBefore should check parent');
assert(citationVerifier.includes('citationCard?.parentElement === panel'), 'citation verifier insertBefore should check parent');
assert(presentation.includes('anchor?.parentElement === panel'), 'presentation exporter insertBefore should check parent');
assert(documentAi.includes('copilotOutput?.parentElement === panel'), 'document AI insertBefore should check parent');

console.log('stage17j9 visible catch-all organizer tests passed');
