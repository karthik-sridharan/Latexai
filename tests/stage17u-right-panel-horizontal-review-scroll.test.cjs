const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const paperCss = fs.readFileSync(path.join(root, 'css/lai-stage16a-paper-ai-polish.css'), 'utf8');
const rpoCss = fs.readFileSync(path.join(root, 'css/lai-stage17j-right-panel-sections.css'), 'utf8');

assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17u-right-panel-horizontal-review-scroll-20260521-1'"), 'boot stage should be Stage 17U');
assert(index.includes('css/lai-stage16a-paper-ai-polish.css?v=stage17u-right-panel-horizontal-review-scroll-1'), 'paper AI polish CSS should be cache-busted for Stage 17U');
assert(index.includes('css/lai-stage17j-right-panel-sections.css?v=stage17u-right-panel-horizontal-review-scroll-1'), 'right-panel sections CSS should be cache-busted for Stage 17U');
assert(index.includes('data-stage="latex-stage17u-right-panel-horizontal-review-scroll-20260521-1"'), 'body shell should expose Stage 17U');

assert(paperCss.includes('Stage 17U: Paper-level edit review horizontal scroll containment'), 'paper AI CSS should include Stage 17U comment');
assert(/\.paper-ai-polish-card\s*\{[\s\S]*overflow-x:\s*auto/.test(paperCss), 'paper AI card should allow horizontal scrolling');
assert(/\.paper-ai-edit-row\s*\{[\s\S]*overflow-x:\s*auto/.test(paperCss), 'paper AI edit row should allow horizontal scrolling');
assert(/\.paper-ai-preview-grid\s*\{[\s\S]*min-width:\s*640px/.test(paperCss), 'old/new preview grid should have a reachable two-column width');
assert(paperCss.includes('grid-template-columns: minmax(300px, 1fr) minmax(300px, 1fr);'), 'old/new preview grid should keep two minmax columns');
assert(paperCss.includes('overflow-wrap: anywhere;'), 'long AI text should wrap inside preview blocks');

assert(rpoCss.includes('Stage 17U: allow deliberate horizontal scrolling for review widgets'), 'right panel CSS should include Stage 17U comment');
assert(/#copilotTab\.right-tab-panel\.active,[\s\S]*#settingsTab\.right-tab-panel\.active,[\s\S]*#assetsTab\.right-tab-panel\.active\s*\{[\s\S]*overflow-x:\s*auto\s*!important/.test(rpoCss), 'active right tab panels should allow horizontal scrolling');
assert(/#copilotTab \.right-panel-group-body,[\s\S]*#settingsTab \.right-panel-group-body\s*\{[\s\S]*overflow-x:\s*auto\s*!important/.test(rpoCss), 'organized group bodies should allow horizontal scrolling');

console.log('Stage 17U right-panel horizontal review scroll static checks passed.');
