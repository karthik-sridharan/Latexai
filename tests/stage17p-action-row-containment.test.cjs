const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const comp = fs.readFileSync(path.join(root, 'css/lai-stage16b-competitive-review.css'), 'utf8');
const dev = fs.readFileSync(path.join(root, 'css/lai-stage16d-devils-debate.css'), 'utf8');
const rpo = fs.readFileSync(path.join(root, 'css/lai-stage17j-right-panel-sections.css'), 'utf8');
const compJs = fs.readFileSync(path.join(root, 'js/competitive-paper-review-service.js'), 'utf8');
const devJs = fs.readFileSync(path.join(root, 'js/devils-advocate-debate-service.js'), 'utf8');

assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17p-right-panel-action-row-containment-20260521-1'"), 'boot stage should be Stage 17P');
assert(index.includes('css/lai-stage16d-devils-debate.css?v=stage17p-right-panel-action-row-containment-1'), 'devils CSS should be cache-busted for Stage 17P');
assert(index.includes('css/lai-stage16b-competitive-review.css?v=stage17p-right-panel-action-row-containment-1'), 'competitive CSS should be cache-busted for Stage 17P');
assert(index.includes('js/devils-advocate-debate-service.js?v=stage17p-right-panel-action-row-containment-1'), 'devils JS should be cache-busted for Stage 17P');
assert(index.includes('js/competitive-paper-review-service.js?v=stage17p-right-panel-action-row-containment-1'), 'competitive JS should be cache-busted for Stage 17P');

for (const [name, css, selector] of [
  ['devils', dev, '.devils-actions'],
  ['competitive', comp, '.competitive-review-actions'],
]) {
  assert(css.includes(`${selector} {`), `${name} action selector should exist`);
  assert(css.includes('display: grid;'), `${name} actions should use grid containment`);
  assert(css.includes('repeat(auto-fit'), `${name} actions should auto-fit columns`);
  assert(css.includes('white-space: normal;'), `${name} buttons should allow labels to wrap`);
  assert(css.includes('overflow-wrap: anywhere;'), `${name} buttons should be able to wrap long labels`);
  assert(css.includes('min-width: 0;'), `${name} controls should permit shrinking inside the panel`);
}

assert(rpo.includes('Stage 17P: containment guard'), 'right-panel organizer CSS should include Stage 17P containment guard');
assert(rpo.includes('overflow-x: hidden !important;'), 'organized group bodies should not allow feature cards to widen the panel');
assert(compJs.includes("const STAGE = 'stage17p-right-panel-action-row-containment-1'"), 'competitive service should expose Stage 17P');
assert(devJs.includes("const STAGE = 'stage17p-right-panel-action-row-containment-1'"), 'devils service should expose Stage 17P');
assert(/Insert \\\\lai edits at matches/.test(devJs), 'devils insert-at-matches action should remain present');
assert(/Append \\\\lai plan/.test(devJs), 'devils append-plan action should remain present');
assert(/Insert \\\\lai edits at matches/.test(compJs), 'competitive insert-at-matches action should remain present');
assert(/Append \\\\lai plan/.test(compJs), 'competitive append-plan action should remain present');
console.log('Stage 17P action-row containment static checks passed.');
