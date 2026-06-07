const fs = require('fs');
const assert = require('assert');

const organizer = fs.readFileSync('js/right-panel-organizer-service.js', 'utf8');
const asset = fs.readFileSync('js/asset-service.js', 'utf8');
const figure = fs.readFileSync('js/figure-editor-service.js', 'utf8');
const css = fs.readFileSync('css/lai-stage17j-right-panel-sections.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert(index.includes('LATEXAI_STAGE17L_RESTORE_FIGURE_DRAWING_TAB'), 'index should advertise Stage 17L');
assert(index.includes("window.LUMINA_LATEX_STAGE='latex-stage17l-restore-figure-drawing-tab-20260521-1'"), 'boot stage should be Stage 17L');
assert(index.includes('right-panel-organizer-service.js?v=stage17l-restore-figure-drawing-tab-1'), 'organizer should use Stage 17L cache busting');
assert(index.includes('lai-stage17j-right-panel-sections.css?v=stage17l-restore-figure-drawing-tab-1'), 'right-panel CSS should use Stage 17L cache busting');
assert(index.includes('stage17l-right-panel-organizer-fallback'), 'fallback loader should be Stage 17L named');

assert(organizer.includes("const STAGE = 'stage17l-restore-figure-drawing-tab-1'"), 'organizer should expose Stage 17L');
assert(organizer.includes('Stage 17L is careful not'), 'organizer should document cross-tab card protection');
assert(organizer.includes('if (!panel.contains(node)) continue;'), 'organizer must not move cards from another right tab');
assert(organizer.includes('figureEditorCard'), 'organizer still knows legacy figure card IDs for diagnostics/grouping when in panel');

assert(css.includes('#assetsTab.right-tab-panel.active'), 'Figures tab must be included in scroll containment');
assert(css.includes('#assetsTab > .asset-panel'), 'Figures tab asset panel should not shrink');
assert(css.includes('#assetsTab .figure-editor-card'), 'Draw figure card should be natural height in Figures tab');
assert(css.includes('#assetsTab .tikz-maker-card'), 'AI TikZ card should be natural height in Figures tab');
assert(css.includes('#assetsTab .image-tikz-card'), 'Image-to-TikZ card should be natural height in Figures tab');

assert(asset.includes('Stage 17L: the Figures tab contains tall drawing/TikZ tools'), 'asset service should apply Figures scroll inline fallback');
assert(asset.includes('ensureAssetTab: createAssetTab'), 'AssetService should expose ensureAssetTab for dependent figure tools');
assert(asset.includes("panel.style.overflowY = 'auto'"), 'Figures tab should receive inline overflow-y auto fallback');

assert(figure.includes('NS.AssetService?.ensureAssetTab?.()'), 'figure editor should ask AssetService to create Figures tab before mounting');
assert(figure.includes("card.id = 'figureEditorCard'"), 'figure editor should still create Draw figure card');
assert(figure.includes("'<h3>Draw figure</h3>'"), 'Draw figure card title should remain present');

console.log('stage17l restore figure drawing tab checks passed');
