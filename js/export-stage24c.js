/* Stage 11 migration note:
   Export, standalone deck, JSON save, and printable/PDF helpers live here.
   This is intentionally a classic browser script, not an ES module yet.
*/
(function(){
  function createApi(deps){
    const {
      escapeHtml,
      clone,
      normalizeSlide,
      fields,
      getSlides,
      currentThemeFromFields,
      currentPresentationOptions,
      currentDraftSlide,
      buildSlideStyle,
      buildSlideInner,
      fitFiguresIn,
      showToast,
      slideForSnippet
    } = deps;

    if(typeof window !== 'undefined'){
      window.LuminaExportPdfStatus = {
        stage: 'stage41j-custom-html-pdf-visible-snapshot-20260429-1',
        skipCustomSlides: false,
        customHtmlVisibleSnapshot: true,
        note: 'PDF export includes custom HTML slides and snapshots the visible custom-frame area when possible.'
      };
    }

function buildStandaloneViewer(payload){
  const deckJson = JSON.stringify(payload).replace(/<\/script>/gi, '<\\/script>');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(payload.deckTitle || 'HTML Presentation')}</title>
<script id="deck-source" type="application/json">${deckJson}<\/script>
<style>
:root{--deck-bg:#060a16;--deck-panel:rgba(10,16,32,.82);--deck-text:#eef3ff}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:radial-gradient(circle at top left,#17214a 0%,var(--deck-bg) 45%,#070b17 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
body{color:var(--deck-text);overflow:hidden}
.deck{position:relative;width:100vw;height:100svh}
.deck-slide{display:none;position:absolute;inset:0;overflow:auto;padding:3.2rem 3.5rem 5rem;background:#fff;color:#111}
.deck-slide.active{display:block}
.deck-slide h1,.deck-slide h2{margin:0;line-height:1.05}
.deck-slide h1{font-size:calc(3.4rem * var(--title-scale,1));max-width:15ch}.deck-slide h2{font-size:calc(2.3rem * var(--title-scale,1));}
.kicker{margin-top:.8rem;color:rgba(17,17,17,.72);font-size:1.05rem;line-height:1.45;max-width:70ch}
.lede{margin-top:.9rem;color:rgba(17,17,17,.72);font-size:1.18rem;line-height:1.5;max-width:70ch}
.slide-body{margin-top:1.35rem}.deck-slide.single .slide-body{display:block}.deck-slide.two-col .slide-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.35rem;align-items:start}
.col{min-width:0}.col-stack{display:grid;gap:1rem}
.rich{display:grid;gap:1rem}
.rich p,.rich ul,.rich ol,.rich h3,.display-math,.bullet-card,.placeholder,.diag,.pseudo-block,.pseudo-latex-block,.custom-frame-wrap{margin:0;border:1px solid rgba(17,17,17,.12);border-radius:var(--radius,22px);background:rgba(127,127,127,.045);box-shadow:0 8px 24px rgba(0,0,0,.04)}
.rich p{color:rgba(17,17,17,.85);font-size:1.26rem;line-height:1.62;padding:1rem 1.15rem}
.rich ul,.rich ol{color:rgba(17,17,17,.85);font-size:1.22rem;line-height:1.58;padding:1rem 1.2rem 1rem 2.3rem}
.rich li{margin:.5rem 0;color:rgba(17,17,17,.85);font-size:1.22rem;line-height:1.58}
.rich h3{font-size:1.3rem;color:inherit;padding:.95rem 1.15rem}
.display-math{font-size:1.2rem;padding:1rem 1.15rem;overflow-x:auto}
.pseudo-block,.pseudo-latex-block{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace;font-size:1.08rem;line-height:1.62;white-space:pre-wrap;tab-size:2;padding:1rem 1.15rem;overflow-x:auto;color:rgba(17,17,17,.9)}
.pseudo-latex-block mjx-container{font-size:100% !important}
.bullet-card{padding:1rem 1.15rem;background:rgba(127,127,127,.045)}.bullet-card b{display:block;margin-bottom:.35rem;font-size:1.12rem}.preview-block{position:relative;border-radius:18px;--block-font-scale:1;--block-font-family:inherit;--block-font-color:inherit;--block-bullet-type:disc}.preview-block .rich p,.preview-block .rich ul,.preview-block .rich ol,.preview-block .rich li,.preview-block .rich h3,.preview-block .display-math,.preview-block .pseudo-block,.preview-block .pseudo-latex-block,.preview-block .bullet-card,.preview-block .placeholder{font-family:var(--block-font-family,inherit);color:var(--block-font-color,inherit)}.preview-block .rich p{font-size:var(--block-font-size,calc(1.26rem * var(--block-font-scale,1))) !important}.preview-block .rich ul,.preview-block .rich ol,.preview-block .rich li{font-size:var(--block-font-size,calc(1.22rem * var(--block-font-scale,1))) !important}.preview-block .rich h3{font-size:var(--block-font-size,calc(1.3rem * var(--block-font-scale,1))) !important}.preview-block .display-math,.preview-block .pseudo-block,.preview-block .pseudo-latex-block,.preview-block .bullet-card{font-size:var(--block-font-size,calc(1.08rem * var(--block-font-scale,1))) !important}.preview-block .rich ul{list-style-type:var(--block-bullet-type,disc)}.preview-block .rich ol{list-style-type:var(--block-bullet-type,decimal)}.preview-title{position:relative;border-radius:18px;--block-font-scale:1;--block-font-family:inherit;--block-font-color:inherit}.preview-title > h1,.preview-title > h2,.preview-title > h3,.preview-title > h4,.preview-title > h5,.preview-title > h6{font-family:var(--block-font-family,inherit);color:var(--block-font-color,inherit);font-size:var(--block-font-size,calc(var(--title-base-size,1em) * var(--block-font-scale,1))) !important}
.placeholder{min-height:220px;display:grid;place-items:center;color:rgba(17,17,17,.72);padding:1rem 1.15rem;text-align:center}
.deck-slide .figure-embed{padding:0 !important;background:transparent !important;border:0 !important;box-shadow:none !important;overflow:visible !important;display:block;min-height:0;position:relative;width:fit-content;max-width:100%;margin:.2rem auto}
.deck-slide .figure-embed figure{margin:0;width:auto;height:auto;display:inline-flex;align-items:center;justify-content:center;overflow:visible;max-width:100%}
.deck-slide .figure-embed img,.deck-slide .figure-embed svg,.deck-slide .figure-embed canvas,.deck-slide .figure-embed iframe{display:block;max-width:100%;max-height:100%;width:auto;height:auto;margin:0 auto;object-fit:contain;pointer-events:none}
.deck-slide .figure-embed svg{overflow:visible}
.deck-slide .figure-embed svg *,.deck-slide .figure-embed figure *{pointer-events:none}
.deck-slide .figure-box{position:relative;display:inline-block;overflow:visible;padding:10px;background:#fff;border:1px solid rgba(17,17,17,.18);border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,.08);touch-action:none;cursor:grab}
.deck-slide .figure-box.selected{outline:2px solid #61b4ff;outline-offset:2px}
.deck-slide .figure-box > img,.deck-slide .figure-box > svg,.deck-slide .figure-box > canvas,.deck-slide .figure-box > iframe,.deck-slide .figure-box > figure{display:block;width:100%;height:100%;max-width:100%;max-height:100%;pointer-events:none}
.deck-slide .figure-resize-handle{position:absolute;right:-8px;bottom:-8px;width:18px;height:18px;border-radius:50%;background:#61b4ff;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.18);cursor:nwse-resize;pointer-events:auto}
.custom-frame-wrap{overflow:hidden;background:#fff}.custom-frame{width:100%;height:720px;border:0;display:block;background:#fff}
.diag{display:grid;place-items:center;padding:.9rem}.diagram{width:100%;max-width:680px;height:auto}.diagram .edge{stroke:currentColor;stroke-opacity:.32;stroke-width:6;stroke-linecap:round}.diagram .node{fill:none;stroke:currentColor;stroke-width:6}.diagram .label{fill:currentColor;font:700 28px Inter,system-ui,sans-serif}
.layout-two-callouts .col-stack > *:first-child,.layout-figure-explanation .col-stack > *:first-child,.layout-image-left-text-right .col-stack > *:first-child,.layout-comparison .col-stack > *:first-child{border-left:8px solid var(--accent,#2f6fed)}.theorem-proof-wrap,.algorithm-wrap,.full-figure-wrap{display:grid;gap:1rem}.named-box{border:1px solid var(--line,rgba(17,17,17,.12));border-radius:var(--radius,22px);background:rgba(127,127,127,.045);box-shadow:0 8px 24px rgba(0,0,0,.04);overflow:hidden}.named-box .named-box-head{padding:.8rem 1rem;font-weight:800;border-bottom:1px solid var(--line,rgba(17,17,17,.12));background:color-mix(in srgb, var(--accent,#2f6fed) 12%, white)}.named-box .named-box-body{padding:1rem 1.1rem}.section-divider-wrap{min-height:720px;display:grid;place-items:center;text-align:center}.section-divider-wrap .divider-kicker{color:var(--accent,#2f6fed);font-weight:800;letter-spacing:.18em;text-transform:uppercase;margin-bottom:1rem}.section-divider-wrap .divider-line{width:220px;height:6px;background:var(--accent,#2f6fed);border-radius:999px;margin:1.2rem auto}.section-divider-wrap .divider-lede{max-width:24ch;color:var(--muted);font-size:1.2rem;line-height:1.5}.comparison-head{font-size:1.2rem;font-weight:800;margin:0 0 .6rem 0;color:var(--accent,#2f6fed)}.figure-caption{font-size:1rem;color:var(--muted);text-align:center}.title-center{min-height:720px;display:grid;place-items:center;text-align:center;padding:3rem}.title-center h1,.title-center h2{font-size:clamp(3.2rem,8vw,5.6rem);max-width:16ch}
.slide h1,.slide h2,.deck-slide h1,.deck-slide h2{text-transform:var(--title-transform,none);letter-spacing:var(--title-letter-spacing,normal)}
.slide.style-berkeley,.deck-slide.style-berkeley{padding-left:calc(3.3rem + var(--sidebar-width,118px))}.slide.style-berkeley::before,.deck-slide.style-berkeley::before{content:'';position:absolute;left:0;top:0;bottom:0;width:var(--sidebar-width,118px);background:var(--chrome-fill,#17365d)}.slide.style-berkeley::after,.deck-slide.style-berkeley::after{content:'';position:absolute;left:var(--sidebar-width,118px);top:0;right:0;height:18px;background:var(--accent,#d4a017)}.slide.style-berkeley h1,.slide.style-berkeley h2,.deck-slide.style-berkeley h1,.deck-slide.style-berkeley h2{color:var(--chrome-fill,#17365d)}
.slide.style-madrid,.deck-slide.style-madrid{padding-top:5rem;padding-bottom:5.2rem}.slide.style-madrid::before,.deck-slide.style-madrid::before{content:'';position:absolute;left:0;top:0;right:0;height:58px;background:var(--chrome-fill,#1f4e79)}.slide.style-madrid::after,.deck-slide.style-madrid::after{content:'';position:absolute;left:0;right:0;bottom:0;height:24px;background:var(--accent,#2f6fed)}.slide.style-madrid h1,.slide.style-madrid h2,.deck-slide.style-madrid h1,.deck-slide.style-madrid h2{color:var(--chrome-fill,#1f4e79)}
.slide.style-annarbor,.deck-slide.style-annarbor{padding-top:4.8rem;padding-bottom:5rem}.slide.style-annarbor::before,.deck-slide.style-annarbor::before{content:'';position:absolute;left:0;top:0;right:0;height:64px;background:var(--chrome-fill,#c99a06)}.slide.style-annarbor::after,.deck-slide.style-annarbor::after{content:'';position:absolute;left:0;right:0;bottom:0;height:18px;background:var(--accent,#7a4f01)}.slide.style-annarbor h1,.slide.style-annarbor h2,.deck-slide.style-annarbor h1,.deck-slide.style-annarbor h2{color:#5b3c00}
.slide.style-cambridgeus,.deck-slide.style-cambridgeus{padding-top:4.7rem;padding-bottom:5rem}.slide.style-cambridgeus::before,.deck-slide.style-cambridgeus::before{content:'';position:absolute;left:0;top:0;right:0;height:56px;background:linear-gradient(90deg,var(--accent,#c53030) 0 18px,var(--chrome-fill,#0f4c81) 18px 100%)}.slide.style-cambridgeus::after,.deck-slide.style-cambridgeus::after{content:'';position:absolute;left:0;right:0;bottom:0;height:18px;background:var(--chrome-fill,#0f4c81)}.slide.style-cambridgeus h1,.slide.style-cambridgeus h2,.deck-slide.style-cambridgeus h1,.deck-slide.style-cambridgeus h2{color:var(--chrome-fill,#0f4c81)}
.slide.style-pittsburgh,.deck-slide.style-pittsburgh{padding-top:4.2rem}.slide.style-pittsburgh::before,.deck-slide.style-pittsburgh::before{content:'';position:absolute;left:0;top:0;right:0;height:16px;background:var(--chrome-fill,#2f6fed)}.slide.style-pittsburgh h1,.slide.style-pittsburgh h2,.deck-slide.style-pittsburgh h1,.deck-slide.style-pittsburgh h2{color:var(--chrome-fill,#2f6fed)}.slide.style-notebook,.deck-slide.style-notebook{font-family:"Comic Sans MS","Comic Sans","Comic Neue",cursive;background-color:#fffdf3;background-image:repeating-linear-gradient(180deg, transparent 0 42px, rgba(55,125,210,.32) 42px 44px, transparent 44px 64px)}.slide.style-notebook h1,.slide.style-notebook h2,.deck-slide.style-notebook h1,.deck-slide.style-notebook h2{color:#1d4f91}.slide.style-notebook .rich p,.slide.style-notebook .rich ul,.slide.style-notebook .rich ol,.slide.style-notebook .rich h3,.slide.style-notebook .display-math,.slide.style-notebook .bullet-card,.slide.style-notebook .placeholder,.slide.style-notebook .diag,.slide.style-notebook .pseudo-block,.slide.style-notebook .pseudo-latex-block,.slide.style-notebook .custom-frame-wrap,.deck-slide.style-notebook .rich p,.deck-slide.style-notebook .rich ul,.deck-slide.style-notebook .rich ol,.deck-slide.style-notebook .rich h3,.deck-slide.style-notebook .display-math,.deck-slide.style-notebook .bullet-card,.deck-slide.style-notebook .placeholder,.deck-slide.style-notebook .diag,.deck-slide.style-notebook .pseudo-block,.deck-slide.style-notebook .pseudo-latex-block,.deck-slide.style-notebook .custom-frame-wrap{background:rgba(255,253,243,.72);border-color:rgba(55,125,210,.24)}.slide.style-chalkboard,.deck-slide.style-chalkboard{font-family:"Chalkboard SE","Comic Sans MS","Marker Felt",cursive;background-color:#050807!important;background-image:radial-gradient(circle at 20% 15%, rgba(255,255,255,.055), transparent 25%),radial-gradient(circle at 80% 75%, rgba(255,255,255,.04), transparent 30%),linear-gradient(135deg, rgba(255,255,255,.025), transparent 45%, rgba(255,255,255,.018));text-shadow:0 0 1px rgba(255,255,255,.36)}.slide.style-chalkboard h1,.slide.style-chalkboard h2,.deck-slide.style-chalkboard h1,.deck-slide.style-chalkboard h2{color:#f8fafc;text-shadow:0 1px 2px rgba(255,255,255,.18)}.slide.style-chalkboard .kicker,.slide.style-chalkboard .lede,.deck-slide.style-chalkboard .kicker,.deck-slide.style-chalkboard .lede{color:rgba(248,250,252,.78)}.slide.style-chalkboard .rich p,.slide.style-chalkboard .rich ul,.slide.style-chalkboard .rich ol,.slide.style-chalkboard .rich li,.slide.style-chalkboard .rich h3,.slide.style-chalkboard .display-math,.slide.style-chalkboard .bullet-card,.slide.style-chalkboard .placeholder,.slide.style-chalkboard .diag,.slide.style-chalkboard .pseudo-block,.slide.style-chalkboard .pseudo-latex-block,.slide.style-chalkboard .custom-frame-wrap,.deck-slide.style-chalkboard .rich p,.deck-slide.style-chalkboard .rich ul,.deck-slide.style-chalkboard .rich ol,.deck-slide.style-chalkboard .rich li,.deck-slide.style-chalkboard .rich h3,.deck-slide.style-chalkboard .display-math,.deck-slide.style-chalkboard .bullet-card,.deck-slide.style-chalkboard .placeholder,.deck-slide.style-chalkboard .diag,.deck-slide.style-chalkboard .pseudo-block,.deck-slide.style-chalkboard .pseudo-latex-block,.deck-slide.style-chalkboard .custom-frame-wrap{color:rgba(248,250,252,.92)!important;background:rgba(255,255,255,.045);border-color:rgba(248,250,252,.22);box-shadow:none}
.anim-frag{transition:opacity .35s ease,transform .35s ease,visibility .35s ease}.anim-hidden{opacity:0 !important;visibility:hidden !important;transform:translateY(8px)}
.slide-actions{position:fixed;top:1rem;left:8.8rem;right:1rem;display:flex;gap:.55rem;z-index:34;flex-wrap:nowrap;justify-content:flex-end;align-items:center;max-width:calc(100vw - 9.8rem);overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:none;padding-bottom:.08rem;pointer-events:auto}
.slide-actions::-webkit-scrollbar{display:none}
.slide-actions > *{flex:0 0 auto}
@media (max-width:720px){.slide-actions{top:4.85rem;left:1rem;right:1rem;max-width:calc(100vw - 2rem);justify-content:flex-end}}
.slides-button,.draw-button,.export-annotated-button,.pdf-button{border:1px solid rgba(17,17,17,.18);background:rgba(255,255,255,.88);color:#111;border-radius:999px;padding:.55rem .95rem;font:inherit;font-weight:700;cursor:pointer;backdrop-filter:blur(10px);white-space:nowrap}
.laser-control{display:flex;align-items:center;gap:.4rem;border:1px solid rgba(17,17,17,.18);background:rgba(255,255,255,.88);color:#111;border-radius:999px;padding:.42rem .55rem .42rem .85rem;font:inherit;font-weight:700;backdrop-filter:blur(10px)}
.laser-select{font:inherit;border:1px solid rgba(17,17,17,.18);border-radius:999px;background:#fff;color:#111;padding:.28rem .48rem;cursor:pointer;max-width:8.5rem}
.laser-select:focus{outline:2px solid rgba(47,111,237,.35);outline-offset:2px}
.slide-number{position:absolute;bottom:1.15rem;right:1.4rem;font-size:1rem;color:rgba(17,17,17,.62)}
.pdf-modal[hidden]{display:none !important}
.pdf-modal{position:fixed;inset:0;background:rgba(7,11,23,.46);display:grid;place-items:center;z-index:58;padding:1rem}
.pdf-dialog{width:min(420px,92vw);background:#fff;color:#111;border-radius:18px;border:1px solid rgba(17,17,17,.14);box-shadow:0 24px 70px rgba(0,0,0,.28);padding:1rem;display:grid;gap:.85rem}
.pdf-dialog h3{margin:0;font-size:1.2rem;color:#111}
.pdf-dialog p{margin:0;color:rgba(17,17,17,.72);font-size:.95rem;line-height:1.45}
.pdf-dialog select{font:inherit;padding:.55rem .7rem;border-radius:10px;border:1px solid rgba(17,17,17,.18);background:#fff}
.pdf-dialog .row{display:flex;gap:.6rem;justify-content:flex-end}
.pdf-dialog button{border:1px solid rgba(17,17,17,.16);background:#fff;color:#111;border-radius:10px;padding:.58rem .85rem;font:inherit;font-weight:700;cursor:pointer}
.pdf-dialog button.primary{background:#17365d;color:#fff;border-color:#17365d}
.pdf-status{min-height:1.2rem;font-size:.9rem;color:rgba(17,17,17,.7)}
.slide-annotation-layer{position:absolute;inset:0;pointer-events:none;z-index:9}
.slide-draw-surface{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;touch-action:none}
.slide-draw-surface.active{pointer-events:auto;cursor:crosshair}
.slide-draw-surface [data-draw-shape]{vector-effect:non-scaling-stroke}
.draw-session-toolbar[hidden]{display:none !important}
.draw-session-toolbar{position:fixed;top:1rem;right:1rem;display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;padding:.75rem .9rem;background:rgba(255,255,255,.96);color:#111;border:1px solid rgba(17,17,17,.16);border-radius:16px;box-shadow:0 18px 45px rgba(0,0,0,.18);z-index:55;backdrop-filter:blur(12px)}
.draw-session-toolbar label{display:flex;align-items:center;gap:.35rem;font-weight:600}
.draw-session-toolbar input,.draw-session-toolbar select,.draw-session-toolbar button{font:inherit}
.draw-session-toolbar button{border:1px solid rgba(17,17,17,.16);background:#fff;border-radius:10px;padding:.48rem .7rem;cursor:pointer}
.draw-session-toolbar .primary{background:#17365d;color:#fff;border-color:#17365d}
.laser-pointer{position:fixed;left:0;top:0;width:26px;height:26px;margin-left:-13px;margin-top:-13px;border-radius:999px;pointer-events:none;z-index:70;display:none;--laser-rgb:255,59,48;--laser-border-rgb:120,0,0;
  background:radial-gradient(circle, #ffffff 0 12%, rgb(var(--laser-rgb)) 13% 34%, rgba(var(--laser-rgb),.95) 35% 50%, rgba(var(--laser-rgb),.38) 51% 72%, rgba(var(--laser-rgb),0) 73% 100%);
  border:1px solid rgba(var(--laser-border-rgb),.55);
  box-shadow:0 0 0 2px rgba(255,255,255,.92), 0 0 8px rgba(var(--laser-border-rgb),.45), 0 0 18px rgba(var(--laser-rgb),.42), 0 0 34px rgba(var(--laser-rgb),.22);
}
.laser-pointer[data-pointer-color="red"]{--laser-rgb:255,59,48;--laser-border-rgb:120,0,0}
.laser-pointer[data-pointer-color="blue"]{--laser-rgb:37,99,235;--laser-border-rgb:15,52,130}
.laser-pointer[data-pointer-color="green"]{--laser-rgb:22,163,74;--laser-border-rgb:12,94,43}
.laser-pointer[data-pointer-color="pointer"]{width:24px;height:34px;margin-left:0;margin-top:0;border-radius:0;background:transparent;border:0;box-shadow:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}
.laser-pointer[data-pointer-color="pointer"]::before{content:"";position:absolute;left:0;top:0;width:24px;height:34px;background:#fff;clip-path:polygon(0 0,0 28px,7px 21px,11px 32px,16px 30px,12px 19px,22px 19px)}
.laser-pointer[data-pointer-color="pointer"]::after{content:"";position:absolute;left:2px;top:3px;width:18px;height:26px;background:#111;clip-path:polygon(0 0,0 22px,6px 16px,10px 25px,13px 24px,9px 15px,18px 15px)}

.deck-slide.laser-active{cursor:none}
.deck-toolbar{position:fixed;left:1rem;top:1rem;display:flex;gap:.65rem;z-index:40;align-items:center;flex-wrap:nowrap}.nav-fullscreen-btn{min-width:max-content}
.deck-toolbar,.slide-actions,.draw-session-toolbar{transition:opacity .24s ease,transform .24s ease}
body.controls-hidden .deck-toolbar,body.controls-hidden .slide-actions,body.controls-hidden .draw-session-toolbar{opacity:0;pointer-events:none;transform:translateY(-8px)}
.deck-toolbar button,.slide-map button,.nav-btn{border:1px solid rgba(255,255,255,.14);background:rgba(10,16,32,.82);color:#eef3ff;border-radius:14px;padding:.78rem .95rem;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 18px 45px rgba(0,0,0,.25)}
.slide-map{position:fixed;top:0;right:0;height:100svh;width:min(420px,92vw);background:rgba(7,11,23,.96);border-left:1px solid rgba(255,255,255,.10);padding:1rem;display:none;z-index:35;overflow:auto}
.slide-map.open{display:block}.slide-map h3{margin:.2rem 0 1rem 0;font-size:1.2rem}.slide-map-list{display:grid;gap:.6rem}.slide-map-item{display:flex;gap:.6rem;align-items:flex-start;text-align:left}.slide-map-item span:first-child{opacity:.7;min-width:2.2rem}
@media (max-width:900px){.deck-slide{padding:1.5rem 1.2rem 4.2rem}.deck-slide.two-col .slide-body{grid-template-columns:1fr}.deck-slide h1{font-size:2.3rem}.deck-slide h2{font-size:1.9rem}}
</style>
<script>
window.MathJax={tex:{inlineMath:[['$','$'],['\\\\(','\\\\)']],displayMath:[['$$','$$'],['\\\\[','\\\\]']]},svg:{fontCache:'global'}};
<\/script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"><\/script>
<script defer src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>
<script defer src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"><\/script>
</head>
<body>
<div class="deck-toolbar"><button class="nav-btn" id="prevBtn" title="Previous slide" aria-label="Previous slide">◀</button><button class="nav-btn" id="nextBtn" title="Next slide" aria-label="Next slide">▶</button><button class="nav-btn nav-fullscreen-btn" id="fullscreenBtn" title="Full screen (⌘F)" aria-label="Full screen">Full screen</button></div>
<div class="slide-actions" id="deckActions" hidden></div>
<div class="slide-map" id="slideMap"><button id="closeMapBtn" style="float:right;">Close</button><h3 id="deckTitle"></h3><div class="slide-map-list" id="slideMapList"></div></div>
<div class="draw-session-toolbar" id="drawSessionToolbar" hidden>
  <label>Tool
    <select id="drawTool">
      <option value="pen">Pen</option>
      <option value="line">Line</option>
      <option value="rect">Rectangle</option>
      <option value="ellipse">Ellipse</option>
      <option value="erase">Erase</option>
    </select>
  </label>
  <label>Color <input id="drawColor" type="color" value="#111111" /></label>
  <label>Width <input id="drawWidth" type="range" min="1" max="16" value="3" /></label>
  <button type="button" id="drawClearBtn">Clear slide</button>
  <button type="button" class="primary" id="drawExitBtn">Exit drawing</button>
</div>
<div class="pdf-modal" id="pdfModal" hidden>
  <div class="pdf-dialog">
    <h3>Generate PDF</h3>
    <p>Choose how many slides to place on each page. Custom HTML blocks are included as visible-area snapshots when possible.</p>
    <label>
      <div style="font-weight:700;margin-bottom:.35rem">Slides per page</div>
      <select id="pdfSlidesPerPage">
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="4" selected>4</option>
        <option value="6">6</option>
      </select>
    </label>
    <div class="pdf-status" id="pdfStatus">Ready.</div>
    <div class="row">
      <button type="button" id="pdfCancelBtn">Cancel</button>
      <button type="button" class="primary" id="pdfGenerateBtn">Generate PDF</button>
    </div>
  </div>
</div>
<div class="laser-pointer" id="laserPointer" aria-hidden="true"></div>
<div class="deck" id="deck"></div>
<script>
const deckPayload=JSON.parse(document.getElementById('deck-source').textContent);
window.luminaStandalonePdfStatus={stage:'stage41j-custom-html-pdf-visible-snapshot-20260429-1', skipCustomSlides:false, customHtmlVisibleSnapshot:true, customHtmlSnapshotCount:0, lastRenderedSlideCount:0, lastError:''};
function normalizeExportControls(options){const src=(options&&options.exportControls)||{};const legacy=!!(options&&options.enableLiveDraw);return {slides:src.slides!==false,draw:legacy||!!src.draw,exportAnnotated:legacy||!!src.exportAnnotated,pointerMenu:src.pointerMenu!==false,generatePdf:src.generatePdf!==false};}
const exportControls=normalizeExportControls(deckPayload.presentationOptions||{});
const liveDrawEnabled=!!(exportControls.draw||exportControls.exportAnnotated);
const annotationStorageKey='liveDrawInk:' + encodeURIComponent((deckPayload.deckTitle||'deck') + '|' + (Array.isArray(deckPayload.slides)?deckPayload.slides.length:0));
let liveDrawAnnotations=loadLiveDrawAnnotations();
function loadLiveDrawAnnotations(){
  try{
    const raw=localStorage.getItem(annotationStorageKey);
    if(raw) return JSON.parse(raw);
  }catch(err){console.error(err);}
  const seed=(deckPayload.presentationOptions&&deckPayload.presentationOptions.seedAnnotations)||{};
  return JSON.parse(JSON.stringify(seed||{}));
}
function persistLiveDrawAnnotations(){try{localStorage.setItem(annotationStorageKey, JSON.stringify(liveDrawAnnotations));}catch(err){console.error(err);}}
function escapeHtml(str){return String(str??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function escapeAttr(str){return escapeHtml(str).replace(/\\n/g,'&#10;');}
function preserveMathTokens(str){const tokens=[];let out=String(str??'');const patterns=[/\\$\\$[\\s\\S]+?\\$\\$/g,/\\\\\\[[\\s\\S]+?\\\\\\]/g,/\\\\\\([\\s\\S]+?\\\\\\)/g,/\\$(?!\\s)[^$\\n]+?\\$/g];patterns.forEach(pattern=>{out=out.replace(pattern,m=>{const key='@@MATH'+tokens.length+'@@';tokens.push(m);return key;});});return {out,tokens};}
function restoreMathTokens(str,tokens){return String(str).replace(/@@MATH(\\d+)@@/g,(_,i)=>tokens[Number(i)]??'');}
function hexToRgb(hex){const clean=String(hex||'').trim().replace('#','');if(!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(clean)) return null;const full=clean.length===3?clean.split('').map(c=>c+c).join(''):clean;const num=parseInt(full,16);return {r:(num>>16)&255,g:(num>>8)&255,b:num&255};}
function rgbaFromHex(hex,alpha){const rgb=hexToRgb(hex);if(!rgb) return 'rgba(0,0,0,'+alpha+')';return 'rgba('+rgb.r+','+rgb.g+','+rgb.b+','+alpha+')';}
function normalizeTheme(theme){const t=theme||{};return {name:t.name||'Default theme',bgColor:t.bgColor||'#ffffff',fontColor:t.fontColor||'#111111',accentColor:t.accentColor||'#2f6fed',panelRadius:Number.isFinite(Number(t.panelRadius))?Number(t.panelRadius):22,titleScale:Number.isFinite(Number(t.titleScale))?Number(t.titleScale):1,beamerStyle:t.beamerStyle||'classic',chromeColor:t.chromeColor||'#17365d',chromeTextColor:t.chromeTextColor||'#ffffff',sidebarWidth:Number.isFinite(Number(t.sidebarWidth))?Number(t.sidebarWidth):118,titleCaps:String(t.titleCaps||'0')};}function isTwoColType(type){return ['two-col','title-two-callouts','title-figure-explanation','comparison','image-left-text-right'].includes(type);}function buildSlideStyle(slide,theme=deckPayload.theme){const t=normalizeTheme(theme);const useTheme=slide.inheritTheme!==false;let bg=useTheme?t.bgColor:(slide.bgColor||t.bgColor);let font=useTheme?t.fontColor:(slide.fontColor||t.fontColor);const styleId=String(t.beamerStyle||'classic').toLowerCase();if(styleId==='chalkboard'){bg=t.bgColor||'#050807';font=t.fontColor||'#f8fafc';}else if(styleId==='notebook'){bg=t.bgColor||'#fffdf3';font=t.fontColor||'#1f2937';}const muted=rgbaFromHex(font,0.72);const line=rgbaFromHex(font,0.14);const titleTransform=String(t.titleCaps)==='1'?'uppercase':'none';const titleLetterSpacing=String(t.titleCaps)==='1'?'.04em':'normal';let extra='';if(styleId==='berkeley'){extra+='padding-left:calc(3.3rem + '+t.sidebarWidth+'px);';extra+='background-image:linear-gradient(90deg,'+t.chromeColor+' 0 '+t.sidebarWidth+'px, transparent '+t.sidebarWidth+'px 100%),linear-gradient(180deg,'+t.accentColor+' 0 18px, transparent 18px 100%);background-repeat:no-repeat;';}else if(styleId==='madrid'){extra+='padding-top:5rem;padding-bottom:5.2rem;';extra+='background-image:linear-gradient(180deg,'+t.chromeColor+' 0 58px, transparent 58px calc(100% - 24px),'+t.accentColor+' calc(100% - 24px) 100%);background-repeat:no-repeat;';}else if(styleId==='annarbor'){extra+='padding-top:4.8rem;padding-bottom:5rem;';extra+='background-image:linear-gradient(180deg,'+t.chromeColor+' 0 64px, transparent 64px calc(100% - 18px),'+t.accentColor+' calc(100% - 18px) 100%);background-repeat:no-repeat;';}else if(styleId==='cambridgeus'){extra+='padding-top:4.7rem;padding-bottom:5rem;';extra+='background-image:linear-gradient(180deg,transparent 0 56px, transparent 56px calc(100% - 18px),'+t.chromeColor+' calc(100% - 18px) 100%),linear-gradient(90deg,'+t.accentColor+' 0 18px,'+t.chromeColor+' 18px 100%);background-size:100% 100%,100% 56px;background-repeat:no-repeat;';}else if(styleId==='pittsburgh'){extra+='padding-top:4.2rem;';extra+='background-image:linear-gradient(180deg,'+t.chromeColor+' 0 16px, transparent 16px 100%);background-repeat:no-repeat;';}else if(styleId==='notebook'){extra+='font-family:"Comic Sans MS","Comic Sans","Comic Neue",cursive;';extra+='background-image:repeating-linear-gradient(180deg, transparent 0 42px, rgba(55,125,210,.32) 42px 44px, transparent 44px 64px);background-repeat:repeat;';}else if(styleId==='chalkboard'){extra+='font-family:"Chalkboard SE","Comic Sans MS","Marker Felt",cursive;';extra+='background-image:radial-gradient(circle at 20% 15%, rgba(255,255,255,.055), transparent 25%),radial-gradient(circle at 80% 75%, rgba(255,255,255,.04), transparent 30%),linear-gradient(135deg, rgba(255,255,255,.025), transparent 45%, rgba(255,255,255,.018));text-shadow:0 0 1px rgba(255,255,255,.36);';}return 'background-color:'+bg+';color:'+font+';--text:'+font+';--muted:'+muted+';--line:'+line+';--accent:'+t.accentColor+';--radius:'+t.panelRadius+'px;--title-scale:'+t.titleScale+';--chrome-fill:'+t.chromeColor+';--chrome-text:'+t.chromeTextColor+';--sidebar-width:'+t.sidebarWidth+'px;--title-transform:'+titleTransform+';--title-letter-spacing:'+titleLetterSpacing+';'+extra;}
function parseStructuredText(raw){const text=String(raw??'').replace(/\\r\\n/g,'\\n').trim();if(!text)return '';function safeWithMath(str){const p=preserveMathTokens(str);return restoreMathTokens(escapeHtml(p.out),p.tokens);}const lines=text.split('\\n');const parts=[];let paragraph=[];let listType=null;let listItems=[];function flushParagraph(){if(!paragraph.length)return;const joined=paragraph.join(' ').trim();if(joined)parts.push('<p>'+safeWithMath(joined)+'</p>');paragraph=[];}function flushList(){if(!listItems.length)return;const tag=listType==='enumerate'?'ol':'ul';parts.push('<'+tag+'>'+listItems.map(item=>'<li>'+safeWithMath(item)+'</li>').join('')+'</'+tag+'>');listItems=[];listType=null;}function collectUntil(endPattern,startIndex){const chunk=[];let i=startIndex;while(i<lines.length&&!endPattern.test(lines[i].trim())){chunk.push(lines[i]);i+=1;}return {body:chunk.join('\\n').trim(),endIndex:i};}function simpleCardBody(body){const trimmed=body.trim();if(!trimmed)return '';return trimmed.split(/\\n\\s*\\n/).map(block=>'<p>'+safeWithMath(block.replace(/\\s*\\n\\s*/g,' ').trim())+'</p>').join('');}
for(let i=0;i<lines.length;i+=1){const line=lines[i].trim();if(!line){flushParagraph();flushList();continue;}const paragraphMatch=line.match(/^\\\\paragraph\\{([\\s\\S]*)\\}$/);if(paragraphMatch){flushParagraph();flushList();parts.push('<p>'+safeWithMath(paragraphMatch[1].trim())+'</p>');continue;}if(/^\\\\begin\\{itemize\\}$/i.test(line)){flushParagraph();flushList();const items=[];i+=1;while(i<lines.length&&!/^\\\\end\\{itemize\\}$/i.test(lines[i].trim())){const itemLine=lines[i].trim();if(itemLine){const itemMatch=itemLine.match(/^\\\\item\\s+([\\s\\S]*)$/);if(itemMatch)items.push(itemMatch[1].trim());}i+=1;}parts.push('<ul>'+items.map(item=>'<li>'+safeWithMath(item)+'</li>').join('')+'</ul>');continue;}if(/^\\\\begin\\{enumerate\\}$/i.test(line)){flushParagraph();flushList();const items=[];i+=1;while(i<lines.length&&!/^\\\\end\\{enumerate\\}$/i.test(lines[i].trim())){const itemLine=lines[i].trim();if(itemLine){const itemMatch=itemLine.match(/^\\\\item\\s+([\\s\\S]*)$/);if(itemMatch)items.push(itemMatch[1].trim());}i+=1;}parts.push('<ol>'+items.map(item=>'<li>'+safeWithMath(item)+'</li>').join('')+'</ol>');continue;}if(/^\\\\begin\\{equation\\}$/i.test(line)){flushParagraph();flushList();const collected=collectUntil(/^\\\\end\\{equation\\}$/i,i+1);parts.push('<div class="display-math">\\\\[\\\\begin{aligned}'+escapeHtml(collected.body)+'\\\\end{aligned}\\\\]</div>');i=collected.endIndex;continue;}const cardBegin=line.match(/^\\\\begin\\{card\\}\\{([\\s\\S]*)\\}$/i);if(cardBegin){flushParagraph();flushList();const collected=collectUntil(/^\\\\end\\{card\\}$/i,i+1);parts.push('<div class="bullet-card"><b>'+safeWithMath(cardBegin[1].trim())+'</b><div>'+simpleCardBody(collected.body)+'</div></div>');i=collected.endIndex;continue;}if(/^\\\\begin\\{figurehtml\\}$/i.test(line)){flushParagraph();flushList();const collected=collectUntil(/^\\\\end\\{figurehtml\\}$/i,i+1);parts.push('<div class="figure-embed">'+collected.body+'</div>');i=collected.endIndex;continue;}if(/^UL:/i.test(line)){flushParagraph();if(listType&&listType!=='itemize')flushList();listType='itemize';listItems.push(line.replace(/^UL:/i,'').trim());continue;}if(line.startsWith('- ')){flushParagraph();if(listType&&listType!=='itemize')flushList();listType='itemize';listItems.push(line.slice(2).trim());continue;}flushList();if(line.startsWith('### ')){flushParagraph();parts.push('<h3>'+safeWithMath(line.slice(4).trim())+'</h3>');continue;}if(/^P:/i.test(line)){flushParagraph();parts.push('<p>'+safeWithMath(line.replace(/^P:/i,'').trim())+'</p>');continue;}if(/^EQ:/i.test(line)){flushParagraph();parts.push('<div class="display-math">'+safeWithMath(line.replace(/^EQ:/i,'').trim())+'</div>');continue;}if(/^CARD:/i.test(line)){flushParagraph();const payload=line.replace(/^CARD:/i,'').trim();const pieces=payload.split('|');const cardTitle=pieces.shift()||'';const cardBody=pieces.join('|');parts.push('<div class="bullet-card"><b>'+safeWithMath(cardTitle)+'</b><div><p>'+safeWithMath(cardBody)+'</p></div></div>');continue;}paragraph.push(line);}flushParagraph();flushList();return parts.join('\\n');}
function diagramMarkup(){return '<div class="diag"><svg class="diagram" viewBox="0 0 760 430" role="img" aria-label="Tiny neural network diagram placeholder"><line x1="145" y1="145" x2="355" y2="125" class="edge"/><line x1="145" y1="145" x2="355" y2="295" class="edge"/><line x1="145" y1="285" x2="355" y2="125" class="edge"/><line x1="145" y1="285" x2="355" y2="295" class="edge"/><line x1="405" y1="125" x2="615" y2="215" class="edge"/><line x1="405" y1="295" x2="615" y2="215" class="edge"/><circle cx="115" cy="145" r="34" class="node"/><circle cx="115" cy="285" r="34" class="node"/><circle cx="375" cy="125" r="34" class="node"/><circle cx="375" cy="295" r="34" class="node"/><circle cx="645" cy="215" r="34" class="node"/><text x="88" y="153" class="label">x₁</text><text x="88" y="293" class="label">x₂</text><text x="350" y="133" class="label">h₁</text><text x="350" y="303" class="label">h₂</text><text x="632" y="223" class="label">ŷ</text></svg></div>';}
function customFrameMarkup(raw){const html=String(raw||'').trim();if(!html)return '<div class="placeholder">Paste custom HTML here.</div>';return '<div class="custom-frame-wrap"><iframe class="custom-frame" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads" referrerpolicy="no-referrer" srcdoc="'+escapeAttr(html)+'"></iframe></div>';}
function normalizeFontSize(value){if(value===undefined||value===null||value==='')return '';const raw=String(value).trim();const n=Number(raw.replace(/px$/i,''));if(Number.isFinite(n))return Math.max(8,Math.min(120,n))+'px';if(/^\d+(?:\.\d+)?(?:px|rem|em|pt)$/i.test(raw))return raw;return '';}function normalizeBlockStyle(style){const s=style||{};const fontScale=Number.isFinite(Number(s.fontScale))?Number(s.fontScale):1;return {fontScale:Math.max(.6,Math.min(2.5,fontScale)),fontSize:normalizeFontSize(s.fontSize),fontFamily:s.fontFamily||'inherit',fontColor:s.fontColor||'#111111',bulletType:s.bulletType||'disc'};}function normalizeAnimation(anim){const a=anim||{};const buildIn=['none','appear','fade'].includes(a.buildIn)?a.buildIn:'none';const buildOut=['none','disappear','fade'].includes(a.buildOut)?a.buildOut:'none';const stepMode=['all','by-item'].includes(a.stepMode)?a.stepMode:'all';const order=Number.isFinite(Number(a.order))?Number(a.order):0;return {buildIn,buildOut,stepMode,order};}function animationDataAttrs(anim){const a=normalizeAnimation(anim);return ' data-build-in="'+escapeAttr(a.buildIn)+'" data-build-out="'+escapeAttr(a.buildOut)+'" data-step-mode="'+escapeAttr(a.stepMode)+'" data-anim-order="'+escapeAttr(String(a.order))+'"';}function blockWrapperStyle(block){const s=normalizeBlockStyle((block&&block.style)||{});return '--block-font-scale:'+s.fontScale+';'+(s.fontSize?'--block-font-size:'+escapeAttr(s.fontSize)+';font-size:'+escapeAttr(s.fontSize)+';':'')+'--block-font-family:'+escapeAttr(s.fontFamily)+';--block-font-color:'+s.fontColor+';--block-bullet-type:'+s.bulletType+';';}function titleWrapperStyle(style,heading){const s=normalizeBlockStyle(style||{});const baseMap={h1:'5.6rem',h2:'3.1rem',h3:'2.45rem',h4:'2.1rem',h5:'1.8rem',h6:'1.55rem'};return '--block-font-scale:'+s.fontScale+';'+(s.fontSize?'--block-font-size:'+escapeAttr(s.fontSize)+';font-size:'+escapeAttr(s.fontSize)+';':'')+'--block-font-family:'+escapeAttr(s.fontFamily)+';--block-font-color:'+s.fontColor+';--title-base-size:'+(baseMap[String(heading||'h2').toLowerCase()]||'3.1rem')+';';}function normalizeBlock(block){const mode=block.mode||'panel';if(mode==='diagram'){return {mode:'custom',title:block.title||'Legacy diagram',content:'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style>html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Inter,Arial,sans-serif}*{box-sizing:border-box}.diag{display:grid;place-items:center;padding:.9rem}.diagram{width:100%;max-width:680px;height:auto}.diagram .edge{stroke:currentColor;stroke-opacity:.32;stroke-width:6;stroke-linecap:round}.diagram .node{fill:none;stroke:currentColor;stroke-width:6}.diagram .label{fill:currentColor;font:700 28px Inter,system-ui,sans-serif}</style></head><body>'+(block.content||diagramMarkup())+'</body></html>',style:normalizeBlockStyle(block.style),animation:normalizeAnimation(block.animation)};}return {mode:mode,title:block.title||'',content:block.content||'',style:normalizeBlockStyle(block.style),animation:normalizeAnimation(block.animation)};}
function normalizeSlide(slide){const out=JSON.parse(JSON.stringify(slide||{}));let leftBlocks=Array.isArray(out.leftBlocks)?out.leftBlocks.map(normalizeBlock):null;let rightBlocks=Array.isArray(out.rightBlocks)?out.rightBlocks.map(normalizeBlock):null;if(!leftBlocks){leftBlocks=[{mode:out.leftMode||'panel',title:'',content:out.leftHtml||''}];}if(!rightBlocks){rightBlocks=isTwoColType(out.slideType)?[{mode:out.rightMode||'panel',title:'',content:out.rightHtml||''}]:[];}out.leftBlocks=leftBlocks;out.rightBlocks=rightBlocks;out.titleStyle=normalizeBlockStyle(out.titleStyle);out.titleAnimation=normalizeAnimation(out.titleAnimation);out.inheritTheme=out.inheritTheme!==false;return out;}
function renderBlock(block,placeholderText){const resolvedMode=block.mode||'panel';const raw=block.content||'';let inner='';if(resolvedMode==='diagram')inner=diagramMarkup();else if(resolvedMode==='custom')inner=customFrameMarkup(raw);else if(resolvedMode==='placeholder')inner='<div class="placeholder">'+escapeHtml(raw||placeholderText||'Placeholder')+'</div>';else if(resolvedMode==='pseudocode')inner='<pre class="pseudo-block">'+escapeHtml(raw)+'</pre>';else if(resolvedMode==='pseudocode-latex'){const p=preserveMathTokens(raw);inner='<div class="pseudo-latex-block">'+restoreMathTokens(escapeHtml(p.out),p.tokens)+'</div>';}else inner='<div class="rich">'+parseStructuredText(raw)+'</div>';return '<div class="preview-block"'+animationDataAttrs(block.animation)+' style="'+blockWrapperStyle(block)+'">'+inner+'</div>';}
function renderBlocks(blocks,placeholder){const list=blocks&&blocks.length?blocks:[{mode:'placeholder',content:placeholder||'Add a block'}];return '<div class="col-stack">'+list.map(block=>renderBlock(block,placeholder)).join('')+'</div>';}
function buildSlideInner(slide){const heading=slide.headingLevel||'h2';const titleHtml='<div class="preview-title" data-preview-role="title"'+animationDataAttrs(slide.titleAnimation)+' style="'+titleWrapperStyle(slide.titleStyle,heading)+'"><'+heading+'>'+escapeHtml(slide.title||'Untitled slide').replace(/\\n/g,'<br>')+'</'+heading+'></div>';const kickerHtml=slide.kicker?'<div class="kicker">'+escapeHtml(slide.kicker)+'</div>':'';const ledeHtml=slide.lede?'<div class="lede">'+escapeHtml(slide.lede)+'</div>':'';const s=normalizeSlide(slide);if(s.slideType==='title-center')return '<div class="title-center">'+titleHtml+kickerHtml+'</div>';if(s.slideType==='section-divider')return '<div class="section-divider-wrap"><div><div class="divider-kicker">'+escapeHtml(s.kicker||'Section')+'</div>'+titleHtml+'<div class="divider-line"></div><div class="divider-lede">'+escapeHtml(s.lede||'')+'</div></div></div>';if(['two-col','title-two-callouts','title-figure-explanation','comparison','image-left-text-right'].includes(s.slideType)){const layoutClass={ 'two-col':'layout-two-col','title-two-callouts':'layout-two-callouts','title-figure-explanation':'layout-figure-explanation','comparison':'layout-comparison','image-left-text-right':'layout-image-left-text-right'}[s.slideType]||'layout-two-col';const leftHead=s.slideType==='comparison'?'<div class="comparison-head">'+escapeHtml((s.leftBlocks[0]&&s.leftBlocks[0].title)||'Left')+'</div>':'';const rightHead=s.slideType==='comparison'?'<div class="comparison-head">'+escapeHtml((s.rightBlocks[0]&&s.rightBlocks[0].title)||'Right')+'</div>':'';return titleHtml+kickerHtml+ledeHtml+'<div class="slide-body '+layoutClass+'"><div class="col">'+leftHead+renderBlocks(s.leftBlocks,'Left column')+'</div><div class="col">'+rightHead+renderBlocks(s.rightBlocks,'Right column')+'</div></div>';}if(s.slideType==='theorem-proof'){const theorem=s.leftBlocks[0]||{mode:'panel',content:'\\paragraph{Theorem} State the result here.'};const proof=s.leftBlocks[1]||{mode:'panel',content:'\\paragraph{Proof sketch} Add the argument here.'};return titleHtml+kickerHtml+ledeHtml+'<div class="slide-body"><div class="col theorem-proof-wrap"><div class="named-box"><div class="named-box-head">'+escapeHtml(theorem.title||'Theorem')+'</div><div class="named-box-body">'+renderBlock({...theorem,title:''},'Theorem')+'</div></div><div class="named-box"><div class="named-box-head">'+escapeHtml(proof.title||'Proof')+'</div><div class="named-box-body">'+renderBlock({...proof,title:''},'Proof')+'</div></div></div></div>';}if(s.slideType==='algorithm-layout'){const algo=s.leftBlocks[0]||{mode:'pseudocode',content:'Algorithm goes here'};const notes=s.leftBlocks.slice(1);return titleHtml+kickerHtml+ledeHtml+'<div class="slide-body"><div class="col algorithm-wrap">'+renderBlock(algo,'Algorithm')+(notes.length?renderBlocks(notes,'Notes'):'')+'</div></div>';}if(s.slideType==='full-width-figure-caption'){const fig=s.leftBlocks[0]||{mode:'placeholder',content:'Add a figure block'};const captionBlocks=s.leftBlocks.slice(1);return titleHtml+kickerHtml+ledeHtml+'<div class="slide-body"><div class="col full-figure-wrap">'+renderBlock(fig,'Figure')+(captionBlocks.length?'<div class="figure-caption">'+renderBlocks(captionBlocks,'Caption')+'</div>':'')+'</div></div>';}return titleHtml+kickerHtml+ledeHtml+'<div class="slide-body"><div class="col">'+renderBlocks(s.leftBlocks,'Main content')+'</div></div>';}
const deck=document.getElementById('deck');const slideMap=document.getElementById('slideMap');const slideMapList=document.getElementById('slideMapList');const laserPointer=document.getElementById('laserPointer');document.getElementById('deckTitle').textContent=deckPayload.deckTitle||'Slides';
const deckActions=document.getElementById('deckActions');
function buildDeckActionControls(){const laserControl='<label class="laser-control">Pointer <select class="laser-select" aria-label="Laser pointer color"><option value="red" selected>Red</option><option value="blue">Blue</option><option value="green">Green</option><option value="pointer">Pointer</option><option value="none">None</option></select></label>';const actions=[];if(exportControls.slides)actions.push('<button class="slides-button" type="button">Slides</button>');if(exportControls.draw)actions.push('<button class="draw-button" type="button">Draw</button>');if(exportControls.exportAnnotated)actions.push('<button class="export-annotated-button" type="button">Export annotated slides</button>');if(exportControls.generatePdf)actions.push('<button class="pdf-button" type="button">Generate PDF</button>');if(exportControls.pointerMenu)actions.push(laserControl);return actions.join('');}
if(deckActions){const actionHtml=buildDeckActionControls();deckActions.innerHTML=actionHtml;deckActions.hidden=!actionHtml;}
deck.innerHTML=deckPayload.slides.map((slide,idx)=>{const cls=slide.slideType==='title-center'?'deck-slide title-center':(slide.slideType==='two-col'?'deck-slide two-col':'deck-slide single');const styleCls=' style-'+String((deckPayload.theme&&deckPayload.theme.beamerStyle)||'classic').replace(/[^a-z0-9_-]/gi,'').toLowerCase();return '<section class="'+cls+styleCls+'" data-index="'+idx+'" style="'+buildSlideStyle(slide)+'"><div class="slide-number">'+(idx+1)+' / '+deckPayload.slides.length+'</div>'+buildSlideInner(slide).trim()+'<div class="slide-annotation-layer" data-annotation-layer="'+idx+'"><svg class="slide-draw-surface" data-draw-surface="'+idx+'" viewBox="0 0 1000 640" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" aria-label="Slide annotation layer"></svg></div></section>';}).join('\\n');
slideMapList.innerHTML=deckPayload.slides.map((slide,idx)=>'<button type="button" class="slide-map-item" data-go="'+idx+'"><span>'+(idx+1)+'.</span><span>'+escapeHtml(slide.title||('Slide '+(idx+1)))+'</span></button>').join('\\n');
let active=0;
let drawingMode=false;
let drawingSlideIndex=-1;
let drawingState={tool:'pen',drawing:false,start:null,el:null};
const slideEls=Array.from(document.querySelectorAll('.deck-slide'));
const laserSelects=Array.from(document.querySelectorAll('.laser-select'));
let laserPointerMode=exportControls.pointerMenu?'red':'none';
function setLaserPointerMode(mode){if(mode==='black') mode='pointer';mode=['red','blue','green','pointer','none'].includes(mode)?mode:'red';laserPointerMode=mode;if(laserPointer){laserPointer.dataset.pointerColor=mode;if(mode==='none') hideLaserPointer();}laserSelects.forEach(sel=>{if(sel.value!==mode) sel.value=mode;});}
laserSelects.forEach(sel=>sel.addEventListener('change',()=>setLaserPointerMode(sel.value)));
setLaserPointerMode(exportControls.pointerMenu?'red':'none');
const drawSessionToolbar=document.getElementById('drawSessionToolbar');
const drawTool=document.getElementById('drawTool');
const drawColor=document.getElementById('drawColor');
const drawWidth=document.getElementById('drawWidth');
const drawClearBtn=document.getElementById('drawClearBtn');
const drawExitBtn=document.getElementById('drawExitBtn');
const pdfModal=document.getElementById('pdfModal');
const pdfSlidesPerPage=document.getElementById('pdfSlidesPerPage');
const pdfCancelBtn=document.getElementById('pdfCancelBtn');
const pdfGenerateBtn=document.getElementById('pdfGenerateBtn');
const pdfStatus=document.getElementById('pdfStatus');
let controlsFadeTimer=0;
let lastControlsPointerX=null,lastControlsPointerY=null;
function controlsShouldStayVisible(){return !!(drawingMode||(slideMap&&slideMap.classList.contains('open'))||(pdfModal&&!pdfModal.hidden));}
function showPresentationControls(){document.body.classList.remove('controls-hidden');}
function hidePresentationControls(){if(!controlsShouldStayVisible()) document.body.classList.add('controls-hidden');}
function armPresentationControlsFade(){window.clearTimeout(controlsFadeTimer);controlsFadeTimer=window.setTimeout(hidePresentationControls,2000);}
function schedulePresentationControlsFade(){showPresentationControls();armPresentationControlsFade();}
function releasePresentationControls(){if(document.body.classList.contains('controls-hidden')) return; armPresentationControlsFade();}
function holdPresentationControlsVisible(){showPresentationControls();window.clearTimeout(controlsFadeTimer);}
function notePointerControlsActivity(evt){
  if(evt&&typeof evt.clientX==='number'&&typeof evt.clientY==='number'){
    const x=Math.round(evt.clientX), y=Math.round(evt.clientY);
    if(lastControlsPointerX!==null&&Math.abs(x-lastControlsPointerX)<1&&Math.abs(y-lastControlsPointerY)<1) return false;
    lastControlsPointerX=x; lastControlsPointerY=y;
  }
  schedulePresentationControlsFade();
  return true;
}
function togglePresentationFullscreen(){const doc=document;const root=doc.documentElement;const current=doc.fullscreenElement||doc.webkitFullscreenElement||doc.mozFullScreenElement||doc.msFullscreenElement;try{if(current){const exit=doc.exitFullscreen||doc.webkitExitFullscreen||doc.mozCancelFullScreen||doc.msExitFullscreen;if(exit) exit.call(doc);return;}const request=root.requestFullscreen||root.webkitRequestFullscreen||root.mozRequestFullScreen||root.msRequestFullscreen;if(request) request.call(root);}catch(err){console.error(err);}}
function isFullscreenShortcut(evt){return !!(evt&&evt.metaKey&&!evt.ctrlKey&&!evt.altKey&&!evt.shiftKey&&String(evt.key||'').toLowerCase()==='f');}
function fitFiguresInSlide(slideEl){if(!slideEl)return;const figures=Array.from(slideEl.querySelectorAll('.figure-embed'));if(!figures.length)return;const isManual=embed=>{const box=embed&&embed.querySelector('.figure-box');return !!(box&&(box.dataset.userMoved==='1'||box.dataset.userSized==='1'));};figures.forEach(embed=>{if(isManual(embed))return;embed.style.maxHeight='';embed.style.maxWidth='';embed.style.height='';embed.style.width='';const media=embed.querySelector('img,svg,canvas,iframe');if(media){media.style.maxHeight='';media.style.maxWidth='';media.style.height='';media.style.width='';}});const maxHeight=slideEl.clientHeight||window.innerHeight||900;let guard=0;while(slideEl.scrollHeight>maxHeight+2&&guard<16){const overflow=slideEl.scrollHeight-maxHeight;const candidates=figures.map(embed=>{if(isManual(embed))return null;const media=embed.querySelector('img,svg,canvas,iframe');const rect=(media||embed).getBoundingClientRect();return {embed,media,h:rect.height||0};}).filter(x=>x&&x.h>40).sort((a,b)=>b.h-a.h);if(!candidates.length)break;const c=candidates[0];const current=parseFloat((c.media&&c.media.style.maxHeight)||c.h);const reduce=Math.min(Math.max(overflow+8,24),current*0.35);const next=Math.max(70,current-reduce);c.embed.style.maxHeight=(next+12)+'px';if(c.media)c.media.style.maxHeight=next+'px';guard+=1;}}
function fitFiguresIn(root){(root||document).querySelectorAll('.deck-slide.active,.print-cell .slide,.slide').forEach(fitFiguresInSlide);}
function getDrawSurface(slideIndex){return document.querySelector('.slide-draw-surface[data-draw-surface="'+slideIndex+'"]');}
function renderLiveDrawAnnotations(){slideEls.forEach((slideEl,idx)=>{const svg=getDrawSurface(idx);if(!svg)return;svg.innerHTML=String(liveDrawAnnotations[idx]||'');svg.classList.toggle('active', drawingMode && drawingSlideIndex===idx);});}
function saveSurface(slideIndex){const svg=getDrawSurface(slideIndex);if(!svg)return;liveDrawAnnotations[slideIndex]=svg.innerHTML||'';persistLiveDrawAnnotations();}function collectAnimationFragments(target, stepMode){
  if(stepMode!=='by-item') return [target];
  const items=Array.from(target.querySelectorAll('.rich li, .rich p, .rich h3, .bullet-card, .display-math, .pseudo-block, .pseudo-latex-block, .placeholder'));
  return items.length ? items : [target];
}
function setAnimHidden(el, hidden){
  if(!el) return;
  el.classList.add('anim-frag');
  el.classList.toggle('anim-hidden', !!hidden);
}
function initializeSlideAnimations(slideEl){
  if(!slideEl) return;
  const targets=Array.from(slideEl.querySelectorAll('.preview-title, .preview-block, .figure-box, .figure-embed figure[data-figure-kind="image"]')).filter(el=>{
    const buildIn=el.dataset.buildIn || 'none';
    const buildOut=el.dataset.buildOut || 'none';
    const stepMode=el.dataset.stepMode || 'all';
    return buildIn !== 'none' || buildOut !== 'none' || stepMode === 'by-item';
  });
  const steps=[];
  targets.forEach((target, idx)=>{
    const buildIn=target.dataset.buildIn || 'none';
    const buildOut=target.dataset.buildOut || 'none';
    const stepMode=target.dataset.stepMode || 'all';
    const order=Number(target.dataset.animOrder || '0') || 0;
    const fragments=collectAnimationFragments(target, stepMode);
    if(stepMode==='by-item' || buildIn !== 'none'){
      fragments.forEach(f=>setAnimHidden(f, true));
      fragments.forEach((fragment, fragIdx)=>{
        steps.push({phase:'in', order, dom:idx, frag:fragIdx, target, fragment, kind:buildIn || 'appear'});
      });
    } else {
      fragments.forEach(f=>setAnimHidden(f, false));
    }
    if(buildOut !== 'none'){
      steps.push({phase:'out', order, dom:idx, frag:9999, target, kind:buildOut});
    }
  });
  steps.sort((a,b)=> (a.order-b.order) || ((a.phase==='in'?0:1)-(b.phase==='in'?0:1)) || (a.dom-b.dom) || (a.frag-b.frag));
  slideEl.__animSteps=steps;
  slideEl.__animIndex=0;
}
function advanceSlideAnimation(slideEl){
  if(!slideEl || !Array.isArray(slideEl.__animSteps)) return false;
  if(slideEl.__animIndex >= slideEl.__animSteps.length) return false;
  const step=slideEl.__animSteps[slideEl.__animIndex++];
  if(step.phase==='in'){
    setAnimHidden(step.fragment, false);
  }else if(step.phase==='out'){
    const frags=collectAnimationFragments(step.target, step.target.dataset.stepMode || 'all');
    frags.forEach(f=>setAnimHidden(f, true));
  }
  return true;
}
function activeSlideHasPendingAnimations(){
  const slide=slideEls[active];
  return !!(slide && Array.isArray(slide.__animSteps) && slide.__animIndex < slide.__animSteps.length);
}

function slidePoint(evt, svg){const pt=svg.createSVGPoint();pt.x=evt.clientX;pt.y=evt.clientY;const m=svg.getScreenCTM();return m?pt.matrixTransform(m.inverse()):{x:0,y:0};}
function beginShape(evt){if(!drawingMode || drawingSlideIndex!==active) return;const svg=getDrawSurface(active); if(!svg) return;const tool=drawTool.value;if(tool==='erase'){const hit=evt.target.closest('[data-draw-shape]');if(hit && svg.contains(hit)){ hit.remove(); saveSurface(active); }return;}evt.preventDefault();const p=slidePoint(evt, svg);drawingState.tool=tool; drawingState.drawing=true; drawingState.start=p; drawingState.el=null;let el=null;if(tool==='pen'){el=document.createElementNS('http://www.w3.org/2000/svg','polyline');el.setAttribute('fill','none');el.setAttribute('stroke',drawColor.value);el.setAttribute('stroke-width',drawWidth.value);el.setAttribute('stroke-linecap','round');el.setAttribute('stroke-linejoin','round');el.setAttribute('points',p.x+','+p.y);}else if(tool==='line'){el=document.createElementNS('http://www.w3.org/2000/svg','line');el.setAttribute('x1',p.x);el.setAttribute('y1',p.y);el.setAttribute('x2',p.x);el.setAttribute('y2',p.y);el.setAttribute('stroke',drawColor.value);el.setAttribute('stroke-width',drawWidth.value);el.setAttribute('stroke-linecap','round');}else if(tool==='rect'){el=document.createElementNS('http://www.w3.org/2000/svg','rect');el.setAttribute('x',p.x);el.setAttribute('y',p.y);el.setAttribute('width',1);el.setAttribute('height',1);el.setAttribute('fill','none');el.setAttribute('stroke',drawColor.value);el.setAttribute('stroke-width',drawWidth.value);}else if(tool==='ellipse'){el=document.createElementNS('http://www.w3.org/2000/svg','ellipse');el.setAttribute('cx',p.x);el.setAttribute('cy',p.y);el.setAttribute('rx',1);el.setAttribute('ry',1);el.setAttribute('fill','none');el.setAttribute('stroke',drawColor.value);el.setAttribute('stroke-width',drawWidth.value);}if(!el) return;el.setAttribute('data-draw-shape','1');svg.appendChild(el);drawingState.el=el;}
function updateShape(evt){if(!drawingState.drawing || drawingSlideIndex!==active) return;const svg=getDrawSurface(active); if(!svg || !drawingState.el) return;const p=slidePoint(evt, svg);const el=drawingState.el;if(drawingState.tool==='pen'){el.setAttribute('points',(el.getAttribute('points')||'')+' '+p.x+','+p.y);}else if(drawingState.tool==='line'){el.setAttribute('x2',p.x);el.setAttribute('y2',p.y);}else if(drawingState.tool==='rect'){const x=Math.min(drawingState.start.x,p.x),y=Math.min(drawingState.start.y,p.y),w=Math.abs(p.x-drawingState.start.x),h=Math.abs(p.y-drawingState.start.y);el.setAttribute('x',x);el.setAttribute('y',y);el.setAttribute('width',w);el.setAttribute('height',h);}else if(drawingState.tool==='ellipse'){el.setAttribute('cx',(drawingState.start.x+p.x)/2);el.setAttribute('cy',(drawingState.start.y+p.y)/2);el.setAttribute('rx',Math.abs(p.x-drawingState.start.x)/2);el.setAttribute('ry',Math.abs(p.y-drawingState.start.y)/2);}saveSurface(active);}
function endShape(){if(!drawingState.drawing) return; drawingState.drawing=false; drawingState.start=null; drawingState.el=null; saveSurface(active);}
function enterDrawingMode(slideIndex){if(!liveDrawEnabled) return; drawingMode=true; drawingSlideIndex=slideIndex; if(drawSessionToolbar) drawSessionToolbar.hidden=false; render(); hideLaserPointer();}
function exitDrawingMode(){drawingMode=false; drawingSlideIndex=-1; drawingState.drawing=false; drawingState.start=null; drawingState.el=null; if(drawSessionToolbar) drawSessionToolbar.hidden=true; render();}

function slideHasCustomHtml(slide){
  const s = normalizeSlide(slide);
  const all = [].concat(s.leftBlocks || [], s.rightBlocks || []);
  return all.some(block => String((block && block.mode) || 'panel') === 'custom');
}
function getEligiblePdfSlideIndices(){
  return (deckPayload.slides || []).map((slide, idx) => idx).filter(idx => idx !== null);
}
function decodeHtmlEntitiesForPdfSnapshot(value){
  const textarea = document.createElement('textarea');
  textarea.innerHTML = String(value || '');
  return textarea.value;
}
function stripUnsafeCustomSnapshotNodes(root){
  if(!root) return;
  root.querySelectorAll('script, iframe, frame, object, embed').forEach(el => el.remove());
  root.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes || []).forEach(attr => {
      const name = String(attr.name || '').toLowerCase();
      const val = String(attr.value || '');
      if(name.startsWith('on')) el.removeAttribute(attr.name);
      if((name === 'src' || name === 'href' || name === 'xlink:href') && /^javascript:/i.test(val.trim())) el.removeAttribute(attr.name);
    });
  });
}
function prepareCustomHtmlVisibleSnapshots(clone, slideIndex){
  const frames = Array.from(clone.querySelectorAll('.custom-frame-wrap'));
  if(!frames.length) return 0;
  let snapshotCount = 0;
  frames.forEach((wrap, frameIndex) => {
    const iframe = wrap.querySelector('iframe.custom-frame');
    const rawSrcdoc = iframe ? (iframe.getAttribute('srcdoc') || iframe.srcdoc || '') : '';
    const snapshot = document.createElement('div');
    snapshot.className = 'custom-frame custom-frame-pdf-snapshot';
    snapshot.setAttribute('data-pdf-custom-snapshot', '1');
    snapshot.setAttribute('data-slide-index', String(slideIndex));
    snapshot.setAttribute('data-custom-frame-index', String(frameIndex));
    snapshot.style.width = '100%';
    snapshot.style.height = '100%';
    snapshot.style.minHeight = '260px';
    snapshot.style.overflow = 'hidden';
    snapshot.style.background = '#fff';
    snapshot.style.position = 'relative';
    const decoded = decodeHtmlEntitiesForPdfSnapshot(rawSrcdoc);
    if(decoded.trim()){
      snapshot.innerHTML = decoded;
      stripUnsafeCustomSnapshotNodes(snapshot);
    } else {
      snapshot.innerHTML = '<div style="display:grid;place-items:center;width:100%;height:100%;min-height:260px;color:#555;font:16px system-ui,sans-serif;text-align:center;padding:1rem;">Custom HTML block</div>';
    }
    wrap.innerHTML = '';
    wrap.appendChild(snapshot);
    wrap.setAttribute('data-pdf-custom-visible-snapshot', '1');
    snapshotCount += 1;
  });
  if(window.luminaStandalonePdfStatus) window.luminaStandalonePdfStatus.customHtmlSnapshotCount += snapshotCount;
  return snapshotCount;
}
function getPdfLayout(slidesPerPage){
  const n = Number(slidesPerPage) || 1;
  if(n === 2) return { rows: 1, cols: 2 };
  if(n === 4) return { rows: 2, cols: 2 };
  if(n === 6) return { rows: 2, cols: 3 };
  return { rows: 1, cols: 1 };
}
function setPdfStatus(msg){ if(pdfStatus) pdfStatus.textContent = msg; }
function openPdfModal(){ if(pdfModal){ setPdfStatus('Ready.'); pdfModal.hidden = false; } }
function closePdfModal(){ if(pdfModal){ pdfModal.hidden = true; setPdfStatus('Ready.'); } }
async function ensurePdfLibraries(){
  const start = Date.now();
  while(Date.now() - start < 8000){
    if(window.html2canvas && window.jspdf && window.jspdf.jsPDF) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}
async function generatePdfFromSlides(slidesPerPage){
  if(drawingMode) exitDrawingMode();
  closePdfModal();
  const ok = await ensurePdfLibraries();
  if(!ok){ alert('PDF libraries did not load. Check your internet connection and try again.'); return; }

  const eligible = getEligiblePdfSlideIndices();
  if(!eligible.length){ alert('No slides are available for PDF export.'); return; }

  renderLiveDrawAnnotations();
  if(window.MathJax && typeof window.MathJax.typesetPromise === 'function'){
    try{
      if(typeof window.MathJax.typesetClear === 'function') window.MathJax.typesetClear(slideEls);
      await window.MathJax.typesetPromise(slideEls);
    }catch(err){ console.error(err); }
  }

  const stage = document.createElement('div');
  stage.style.position = 'fixed';
  stage.style.left = '-20000px';
  stage.style.top = '0';
  stage.style.width = '1600px';
  stage.style.pointerEvents = 'none';
  stage.style.zIndex = '-1';
  document.body.appendChild(stage);

  const canvases = [];
  try{
    for(let i = 0; i < eligible.length; i += 1){
      const slideIndex = eligible[i];
      setPdfStatus('Rendering slide ' + (i + 1) + ' of ' + eligible.length + '…');
      const clone = slideEls[slideIndex].cloneNode(true);
      clone.classList.add('active');
      clone.style.display = 'block';
      clone.style.position = 'relative';
      clone.style.inset = 'auto';
      clone.style.width = '1600px';
      clone.style.height = '900px';
      clone.style.minHeight = '900px';
      clone.style.overflow = 'hidden';
      clone.querySelectorAll('.slide-actions,.slide-map,.deck-toolbar,.laser-pointer,.draw-session-toolbar,.pdf-modal').forEach(el => el.remove());
      clone.querySelectorAll('.slide-draw-surface').forEach(el => el.classList.remove('active'));
      prepareCustomHtmlVisibleSnapshots(clone, slideIndex);
      stage.innerHTML = '';
      stage.appendChild(clone);
      if(window.MathJax && typeof window.MathJax.typesetPromise === 'function'){
        try{
          if(typeof window.MathJax.typesetClear === 'function') window.MathJax.typesetClear([clone]);
          await window.MathJax.typesetPromise([clone]);
        }catch(err){ console.error(err); }
      }
      const canvas = await window.html2canvas(clone, {backgroundColor:'#ffffff', scale:2, useCORS:true, allowTaint:true});
      canvases.push(canvas);
    }
  } finally {
    stage.remove();
  }

  if(window.luminaStandalonePdfStatus) window.luminaStandalonePdfStatus.lastRenderedSlideCount = canvases.length;
  setPdfStatus('Building PDF…');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'landscape', unit:'pt', format:'letter', compress:true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const gap = 12;
  const layout = getPdfLayout(slidesPerPage);
  const cellW = (pageW - 2 * margin - (layout.cols - 1) * gap) / layout.cols;
  const cellH = (pageH - 2 * margin - (layout.rows - 1) * gap) / layout.rows;

  canvases.forEach((canvas, idx) => {
    if(idx > 0 && idx % (Number(slidesPerPage) || 1) === 0) doc.addPage('letter', 'landscape');
    const slot = idx % (Number(slidesPerPage) || 1);
    const row = Math.floor(slot / layout.cols);
    const col = slot % layout.cols;
    let drawW = cellW;
    let drawH = drawW * 9 / 16;
    if(drawH > cellH){
      drawH = cellH;
      drawW = drawH * 16 / 9;
    }
    const x = margin + col * (cellW + gap) + (cellW - drawW) / 2;
    const y = margin + row * (cellH + gap) + (cellH - drawH) / 2;
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, drawW, drawH, undefined, 'FAST');
  });

  const filename = ((deckPayload.deckTitle || 'presentation').replace(/[^\w\-]+/g,'_') || 'presentation') + '_' + String(slidesPerPage || 1) + 'up.pdf';
  doc.save(filename);
}
async function downloadAnnotatedSlides(){
  const payload=JSON.parse(document.getElementById('deck-source').textContent);
  payload.presentationOptions=payload.presentationOptions||{};
  payload.presentationOptions.exportControls=Object.assign({}, exportControls, { exportAnnotated:true });
  payload.presentationOptions.enableLiveDraw=!!(payload.presentationOptions.exportControls.draw||payload.presentationOptions.exportControls.exportAnnotated);
  payload.presentationOptions.seedAnnotations=JSON.parse(JSON.stringify(liveDrawAnnotations||{}));

  const escapedJson=JSON.stringify(payload).replace(/<\\/script>/gi,'<\\/script>');

  const clone=document.documentElement.cloneNode(true);
  const sourceNode=clone.querySelector('#deck-source');
  if(sourceNode) sourceNode.textContent=escapedJson;

  const liveToolbar=clone.querySelector('#drawSessionToolbar');
  if(liveToolbar) liveToolbar.hidden=true;

  clone.querySelectorAll('.slide-draw-surface').forEach((svg, idx)=>{
    const key=String(idx);
    const markup=(liveDrawAnnotations && (liveDrawAnnotations[key] ?? liveDrawAnnotations[idx])) || '';
    svg.innerHTML=String(markup || '');
    svg.classList.remove('active');
  });

  const text='<!DOCTYPE html>\\n'+clone.outerHTML;
  const blob=new Blob([text],{type:'text/html;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=((payload.deckTitle||'annotated_presentation').replace(/[^\w\-]+/g,'_')||'annotated_presentation')+'_annotated.html';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function hideLaserPointer(){if(laserPointer)laserPointer.style.display='none';slideEls.forEach(el=>el.classList.remove('laser-active'));}
function updateLaserPointer(evt){if(!laserPointer || !slideEls[active] || laserPointerMode==='none'){ hideLaserPointer(); return; }const slide = slideEls[active];const mapOpen = !!(slideMap && slideMap.classList.contains('open'));if(drawingMode || mapOpen){ hideLaserPointer(); return; }const r = slide.getBoundingClientRect();const inside = evt.clientX >= r.left && evt.clientX <= r.right && evt.clientY >= r.top && evt.clientY <= r.bottom;if(!inside){ hideLaserPointer(); return; }slide.classList.add('laser-active');laserPointer.style.display='block';laserPointer.style.transform='translate('+evt.clientX+'px,'+evt.clientY+'px)';}
function setVisibleSlideState(){
  if(!slideEls.length) return;
  active=Math.max(0,Math.min(slideEls.length-1,Number(active)||0));
  slideEls.forEach((el,i)=>{
    const isActive=i===active;
    el.classList.toggle('active',isActive);
    el.hidden=!isActive;
    el.setAttribute('aria-hidden',isActive?'false':'true');
    el.style.display=isActive?'block':'none';
    if(!isActive) el.classList.remove('laser-active');
  });
  document.querySelectorAll('[data-go]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.go)===active));
}
function render(){setVisibleSlideState();renderLiveDrawAnnotations();const initActive=()=>{initializeSlideAnimations(slideEls[active]);hideLaserPointer();fitFiguresIn(slideEls[active]||document);};if(window.MathJax&&typeof window.MathJax.typesetPromise==='function'){if(typeof window.MathJax.typesetClear==='function')window.MathJax.typesetClear(slideEls);window.MathJax.typesetPromise(slideEls.filter(el=>el.classList.contains('active'))).then(initActive).catch(initActive);}else{initActive();}}
function go(i){const target=Number(i);if(!Number.isFinite(target)||target<0||target>=slideEls.length)return;active=target;if(drawingMode) drawingSlideIndex=active;render();if(slideEls[active]){try{slideEls[active].scrollTop=0;}catch(_){}}if(slideMap)slideMap.classList.remove('open');}
function advanceOrGoNext(){ if(activeSlideHasPendingAnimations()){ advanceSlideAnimation(slideEls[active]); return; } go(active+1); }
window.LuminaStandaloneDeckGo=go;
document.getElementById('prevBtn').addEventListener('click',()=>go(active-1));
document.getElementById('nextBtn').addEventListener('click',()=>advanceOrGoNext());
document.getElementById('fullscreenBtn').addEventListener('click',()=>{schedulePresentationControlsFade();togglePresentationFullscreen();});
document.getElementById('closeMapBtn').addEventListener('click',()=>{slideMap.classList.remove('open');schedulePresentationControlsFade();});
document.querySelectorAll('.slides-button').forEach(btn=>btn.addEventListener('click',()=>{slideMap.classList.add('open');holdPresentationControlsVisible();}));
if(exportControls.draw){
  document.querySelectorAll('.draw-button').forEach(btn=>btn.addEventListener('click',()=>{ if(drawingMode && drawingSlideIndex===active) exitDrawingMode(); else { enterDrawingMode(active); } }));
}
if(exportControls.exportAnnotated){
  document.querySelectorAll('.export-annotated-button').forEach(btn=>btn.addEventListener('click',downloadAnnotatedSlides));
}
document.querySelectorAll('.pdf-button').forEach(btn=>btn.addEventListener('click',openPdfModal));
if(pdfCancelBtn) pdfCancelBtn.addEventListener('click',closePdfModal);
if(pdfGenerateBtn) pdfGenerateBtn.addEventListener('click',()=>generatePdfFromSlides(Number(pdfSlidesPerPage && pdfSlidesPerPage.value || 4)));
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>go(Number(btn.dataset.go))));
if(slideMapList){slideMapList.addEventListener('click',evt=>{const btn=evt.target&&evt.target.closest?evt.target.closest('[data-go]'):null;if(btn){evt.preventDefault();go(Number(btn.dataset.go));}});}
if(drawClearBtn) drawClearBtn.addEventListener('click',()=>{ const svg=getDrawSurface(active); if(svg){ svg.innerHTML=''; saveSurface(active); } });
if(drawExitBtn) drawExitBtn.addEventListener('click',()=>exitDrawingMode());
const touchAdvanceTap={time:0,x:0,y:0,slide:-1};
function isTouchSlideAdvanceEvent(evt){
  if(!evt) return false;
  if(evt.pointerType==='touch' || evt.pointerType==='pen') return true;
  if(evt.pointerType==='mouse') return false;
  return !!(navigator.maxTouchPoints>0 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}
function maybeAdvanceFromSlidePointer(evt, activeSlide){
  if(!activeSlide || !activeSlide.contains(evt.target)) return;
  if(isTouchSlideAdvanceEvent(evt)){
    evt.preventDefault();
    updateLaserPointer(evt);
    const now=Date.now();
    const dx=evt.clientX-touchAdvanceTap.x;
    const dy=evt.clientY-touchAdvanceTap.y;
    const isDoubleTap=touchAdvanceTap.slide===active && (now-touchAdvanceTap.time)<520 && Math.sqrt(dx*dx+dy*dy)<48;
    touchAdvanceTap.time=now;
    touchAdvanceTap.x=evt.clientX;
    touchAdvanceTap.y=evt.clientY;
    touchAdvanceTap.slide=active;
    if(isDoubleTap){ touchAdvanceTap.time=0; advanceOrGoNext(); }
    return;
  }
  advanceOrGoNext();
}
deck.addEventListener('pointerdown',evt=>{
  schedulePresentationControlsFade();
  if(pdfModal && !pdfModal.hidden && evt.target===pdfModal) closePdfModal();
  if(drawingMode){
    const svg=getDrawSurface(active);
    if(!svg) return;
    const hitShape=evt.target.closest('[data-draw-shape]');
    if(drawTool.value==='erase' && hitShape){ beginShape(evt); return; }
    if(evt.target===svg) beginShape(evt);
    return;
  }
  if(slideMap.classList.contains('open')) return;
  if(evt.target.closest('.slide-actions') || evt.target.closest('.deck-toolbar') || evt.target.closest('.pdf-modal')) return;
  maybeAdvanceFromSlidePointer(evt, slideEls[active]);
});
window.addEventListener('pointermove',evt=>{ notePointerControlsActivity(evt); if(drawingMode && drawingState.drawing){ updateShape(evt); return; } updateLaserPointer(evt); });
window.addEventListener('pointerup',()=>endShape());
window.addEventListener('pointercancel',()=>endShape());
window.addEventListener('mousemove', evt=>{ notePointerControlsActivity(evt); updateLaserPointer(evt); });
window.addEventListener('mouseleave', hideLaserPointer);
window.addEventListener('blur', ()=>{ endShape(); hideLaserPointer(); });
slideMap.addEventListener('mouseenter', hideLaserPointer);
document.querySelectorAll('.deck-slide').forEach(slide=>slide.addEventListener('mouseleave', ()=>{ if(!drawingMode) hideLaserPointer(); }));
window.addEventListener('keydown',e=>{schedulePresentationControlsFade();if(isFullscreenShortcut(e)){e.preventDefault();togglePresentationFullscreen();return;}if(e.key==='Escape' && drawingMode){ e.preventDefault(); exitDrawingMode(); return; }if(e.key==='Escape' && pdfModal && !pdfModal.hidden){ e.preventDefault(); closePdfModal(); return; }if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();advanceOrGoNext();}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();go(active-1);}if(e.key==='Escape'){ slideMap.classList.remove('open');releasePresentationControls();}});['.deck-toolbar','.slide-actions','.draw-session-toolbar'].forEach(sel=>{const el=document.querySelector(sel);if(!el)return;el.addEventListener('mouseenter',holdPresentationControlsVisible);el.addEventListener('mouseleave',releasePresentationControls);el.addEventListener('focusin',holdPresentationControlsVisible);el.addEventListener('focusout',releasePresentationControls);});render();schedulePresentationControlsFade();
<\/script>
</body>
</html>`;
}

function downloadTextFile(filename, text){
  const blob = new Blob([text], {type:'text/html;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
async function saveBlobWithDialog(defaultName, blob){
  if(window.showSaveFilePicker){
    const parts = String(defaultName || 'file.txt').split('.');
    const ext = parts.length > 1 ? parts.pop() : 'txt';
    const handle = await window.showSaveFilePicker({
      suggestedName: defaultName || ('file.' + ext),
      types: [{
        description: ext.toUpperCase() + ' file',
        accept: {
          [blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'application/octet-stream']: ['.' + ext]
        }
      }]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  const suggested = defaultName || 'file.txt';
  const filename = prompt('Save as', suggested) || suggested;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
async function saveTextFileAs(defaultName, text, mime='text/plain;charset=utf-8'){
  const blob = new Blob([text], {type:mime});
  await saveBlobWithDialog(defaultName, blob);
}

function normalizeEditorExportControls(options){
  const src=(options&&options.exportControls)||{};
  const legacy=!!(options&&options.enableLiveDraw);
  return {
    slides:src.slides!==false,
    draw:legacy||!!src.draw,
    exportAnnotated:legacy||!!src.exportAnnotated,
    pointerMenu:src.pointerMenu!==false,
    generatePdf:src.generatePdf!==false
  };
}
function readExportControlsFromDom(){
  const doc=(typeof document!=='undefined')?document:null;
  if(!doc) return null;
  const ids={slides:'exportControlSlides',draw:'exportControlDraw',exportAnnotated:'exportControlExportAnnotated',pointerMenu:'exportControlPointerMenu',generatePdf:'exportControlGeneratePdf'};
  const controls={slides:true,draw:false,exportAnnotated:false,pointerMenu:true,generatePdf:true};
  let found=false;
  Object.keys(ids).forEach(key=>{
    let el=null;
    if(doc.getElementById) el=doc.getElementById(ids[key]);
    if(!el && doc.querySelector) el=doc.querySelector('[data-export-control="'+key+'"]');
    if(el){ found=true; controls[key]=!!el.checked; }
  });
  return found?controls:null;
}
function currentPresentationOptionsForExport(){
  let base={};
  try{ base=currentPresentationOptions()||{}; }catch(err){ base={}; }
  const controls=readExportControlsFromDom()||normalizeEditorExportControls(base);
  return Object.assign({},base,{enableLiveDraw:!!(controls.draw||controls.exportAnnotated),exportControls:controls});
}

function currentPayload(){
  return {
    deckTitle: fields.deckTitle.value || 'My HTML Presentation',
    theme: currentThemeFromFields(),
    presentationOptions: currentPresentationOptionsForExport(),
    slides: (getSlides().length ? getSlides() : [currentDraftSlide()])
  };
}

function sanitizeBlockForPdf(block){
  // Stage 41J: keep custom HTML blocks for PDF/export rendering instead of replacing them.
  // The rasterizer will snapshot the visible custom-frame area when possible.
  return clone(block || {});
}

function sanitizeSlideForPdf(slide){
  const s = normalizeSlide(clone(slide || {}));
  s.leftBlocks = (s.leftBlocks || []).map(sanitizeBlockForPdf);
  s.rightBlocks = (s.rightBlocks || []).map(sanitizeBlockForPdf);
  return s;
}

function getPrintLayout(slidesPerPage){
  const n = Number(slidesPerPage) || 1;
  if(n === 2) return { rows: 2, cols: 1, className: 'layout-2' };
  if(n === 4) return { rows: 2, cols: 2, className: 'layout-4' };
  if(n === 6) return { rows: 3, cols: 2, className: 'layout-6' };
  return { rows: 1, cols: 1, className: 'layout-1' };
}



function buildPrintableViewer(payload, slidesPerPage){
  const layout = getPrintLayout(slidesPerPage);
  const slidesNormalized = (payload.slides || []).map(normalizeSlide);
  const perPage = Number(slidesPerPage) || 1;
  const pages = [];
  for(let i = 0; i < slidesNormalized.length; i += perPage){
    const chunk = slidesNormalized.slice(i, i + perPage);
    const cells = chunk.map(slide => {
      const cls = slide.slideType === 'title-center' ? 'slide title-center' : (slide.slideType === 'two-col' ? 'slide two-col' : 'slide single');
      const styleCls = ' style-' + String(currentThemeFromFields().beamerStyle || 'classic').replace(/[^a-z0-9_-]/gi,'').toLowerCase();
      return '<div class="print-cell"><div class="print-shell"><section class="' + cls + styleCls + '" style="' + buildSlideStyle(slide) + '">' + buildSlideInner(slide).trim() + '</section></div></div>';
    });
    while(cells.length < perPage) cells.push('<div class="print-cell empty"></div>');
    pages.push('<section class="print-page ' + layout.className + '" style="--cols:' + layout.cols + ';--rows:' + layout.rows + '">' + cells.join('') + '</section>');
  }
  const pagesHtml = pages.join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(payload.deckTitle || 'Printable presentation')}</title>
<style>
  :root{
    --paper-w:11in;
    --paper-h:8.5in;
    --margin:0.35in;
    --gap:0.18in;
    --usable-w:calc(var(--paper-w) - 2 * var(--margin));
    --usable-h:calc(var(--paper-h) - 2 * var(--margin));
    --sheet:#ececec;
    --ink:#111111;
  }
  *{box-sizing:border-box}
  html,body{
    margin:0;padding:0;background:var(--sheet);color:var(--ink);
    font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif
  }
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .print-toolbar{
    position:sticky;top:0;z-index:20;background:rgba(255,255,255,.95);backdrop-filter:blur(8px);
    border-bottom:1px solid rgba(17,17,17,.10);padding:.75rem 1rem;display:flex;justify-content:space-between;gap:1rem;align-items:center
  }
  .print-toolbar button{
    border:1px solid rgba(17,17,17,.16);background:#fff;color:#111;border-radius:12px;padding:.7rem .95rem;font:inherit;font-weight:700;cursor:pointer
  }
  .print-deck{display:grid;justify-content:center;gap:.22in;padding:.22in 0}
  .print-page{
    width:var(--usable-w);
    height:var(--usable-h);
    display:grid;
    grid-template-columns:repeat(var(--cols), minmax(0,1fr));
    grid-template-rows:repeat(var(--rows), minmax(0,1fr));
    gap:var(--gap);
    overflow:hidden;
    page-break-after:always;
    break-after:page;
    break-inside:avoid;
  }
  .print-page:last-child{page-break-after:auto;break-after:auto}
  .print-cell{
    min-width:0;min-height:0;width:100%;height:100%;
    overflow:hidden;position:relative;
    break-inside:avoid;
  }
  .print-cell.empty{visibility:hidden}
  .print-shell{
    position:relative;
    width:100%;
    height:100%;
    overflow:hidden;
  }
  .slide{
    position:absolute;
    left:0; top:0;
    width:1600px;
    height:900px;
    min-height:900px;
    border:1px solid rgba(17,17,17,.12);
    border-radius:28px;
    padding:3rem 3.3rem 4.8rem;
    background:#fff;
    color:#111;
    overflow:hidden;
    transform-origin:top left;
  }
  .slide h1,.slide h2{margin:0;line-height:1.05}
  .slide h1{font-size:3.4rem;max-width:15ch}
  .slide h2{font-size:2.3rem}
  .kicker{margin-top:.8rem;color:rgba(17,17,17,.72);font-size:1.05rem;line-height:1.45;max-width:70ch}
  .lede{margin-top:.9rem;color:rgba(17,17,17,.72);font-size:1.18rem;line-height:1.5;max-width:70ch}
  .slide-body{margin-top:1.35rem}
  .slide.single .slide-body{display:block}
  .slide.two-col .slide-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.35rem;align-items:start}
  .col{min-width:0}
  .col-stack{display:grid;gap:1rem}
  .rich{display:grid;gap:1rem}
  .rich p,.rich ul,.rich ol,.rich h3,.display-math,.bullet-card,.placeholder,.diag,.pseudo-block,.pseudo-latex-block,.custom-frame-wrap,.figure-embed{
    margin:0;border:1px solid rgba(17,17,17,.12);border-radius:var(--radius,22px);background:rgba(127,127,127,.045);box-shadow:0 8px 24px rgba(0,0,0,.04)
  }
  .rich p{color:rgba(17,17,17,.85);font-size:1.26rem;line-height:1.62;padding:1rem 1.15rem}
  .rich ul,.rich ol{color:rgba(17,17,17,.85);font-size:1.22rem;line-height:1.58;padding:1rem 1.2rem 1rem 2.3rem}
  .rich li{margin:.5rem 0;color:rgba(17,17,17,.85);font-size:1.22rem;line-height:1.58}
  .rich h3{font-size:1.3rem;color:inherit;padding:.95rem 1.15rem}
  .display-math{font-size:1.18rem;padding:1rem 1.15rem;overflow:hidden}
  .pseudo-block,.pseudo-latex-block{
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    font-size:1.08rem;line-height:1.62;white-space:pre-wrap;tab-size:2;padding:1rem 1.15rem;overflow:hidden;color:rgba(17,17,17,.92)
  }
  .pseudo-latex-block mjx-container{font-size:100% !important}
  .bullet-card{padding:1rem 1.15rem;background:rgba(127,127,127,.045)}
  .bullet-card b{display:block;margin-bottom:.35rem;font-size:1.12rem}
  .placeholder{min-height:220px;display:grid;place-items:center;color:rgba(17,17,17,.72);padding:1rem 1.15rem;text-align:center}
  .custom-frame-wrap{overflow:hidden;background:#fff}
  .custom-frame{width:100%;height:100%;min-height:260px;border:0;display:block;background:#fff}
  .diag{display:grid;place-items:center;padding:.9rem}
  .diagram{width:100%;max-width:680px;height:auto}
  .diagram .edge{stroke:currentColor;stroke-opacity:.32;stroke-width:6;stroke-linecap:round}
  .diagram .node{fill:none;stroke:currentColor;stroke-width:6}
  .diagram .label{fill:currentColor;font:700 28px Inter,system-ui,sans-serif}
  .title-center{width:1600px;height:900px;min-height:900px;display:grid;place-items:center;text-align:center;padding:3rem}
  .title-center h1,.title-center h2{font-size:clamp(3.2rem,8vw,5.6rem);max-width:16ch}
  @page{size:11in 8.5in landscape;margin:0.35in}
  @media print{
    html,body{background:#fff}
    .print-toolbar{display:none}
    .print-deck{padding:0;gap:0}
    .print-page{page-break-after:always;break-after:page}
  }
</style>
<script>
window.MathJax={tex:{inlineMath:[['$','$'],['\\(','\\)']],displayMath:[['$$','$$'],['\\[','\\]']]},svg:{fontCache:'global'}};
<\/script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"><\/script>
</head>
<body>
<div class="print-toolbar">
  <div><strong>${escapeHtml(payload.deckTitle || 'Printable presentation')}</strong> · ${Number(slidesPerPage) || 1} slide(s) per page</div>
  <button id="printNowBtn">Print / Save as PDF</button>
</div>
<div class="print-deck">${pagesHtml}</div>
<script>
function fitPrintSlides(){
  document.querySelectorAll('.print-shell').forEach(shell=>{
    const slide=shell.querySelector('.slide');
    if(!slide) return;
    const scale=Math.min(shell.clientWidth / 1600, shell.clientHeight / 900);
    const w=1600*scale;
    const h=900*scale;
    const x=Math.max(0,(shell.clientWidth-w)/2);
    const y=Math.max(0,(shell.clientHeight-h)/2);
    slide.style.transform='translate('+x+'px,'+y+'px) scale('+scale+')';
  });
}
function doPrint(){
  fitPrintSlides();
  setTimeout(()=>window.print(), 350);
}
window.addEventListener('load', ()=>{
  if(window.MathJax && typeof window.MathJax.typesetPromise==='function'){
    window.MathJax.typesetPromise().then(()=>requestAnimationFrame(()=>requestAnimationFrame(doPrint))).catch(doPrint);
  }else{
    requestAnimationFrame(()=>requestAnimationFrame(doPrint));
  }
});
window.addEventListener('resize', fitPrintSlides);
document.getElementById('printNowBtn').addEventListener('click', ()=>{fitPrintSlides(); window.print();});
<\/script>
</body>
</html>`;
}


function parseSlideSelection(selectionText, total){
  const raw = String(selectionText || '').trim();
  if(!raw || raw.toLowerCase() === 'all') return Array.from({length: total}, (_, i) => i);
  const picks = new Set();
  raw.split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if(m){
      let a = Number(m[1]), b = Number(m[2]);
      if(!Number.isFinite(a) || !Number.isFinite(b)) return;
      if(a > b){ const t = a; a = b; b = t; }
      for(let i = a; i <= b; i += 1){
        if(i >= 1 && i <= total) picks.add(i - 1);
      }
      return;
    }
    if(/^\d+$/.test(part)){
      const i = Number(part);
      if(i >= 1 && i <= total) picks.add(i - 1);
    }
  });
  return Array.from(picks).sort((a,b) => a - b);
}

function waitFrames(count=2){
  return new Promise(resolve=>{
    function step(n){
      if(n<=0) resolve();
      else requestAnimationFrame(()=>step(n-1));
    }
    step(count);
  });
}

function makeFallbackSlideImage(slide, width=1600, height=900, message='Slide could not be rasterized in-browser'){
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(17,17,17,.14)';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, width - 48, height - 48);
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 52px Arial, Helvetica, sans-serif';
  const title = String((slide && slide.title) || 'Untitled slide');
  wrapCanvasText(ctx, title, 64, 120, width - 128, 64);
  ctx.fillStyle = '#555555';
  ctx.font = '28px Arial, Helvetica, sans-serif';
  wrapCanvasText(ctx, message, 64, 230, width - 128, 38);
  ctx.fillStyle = '#777777';
  ctx.font = '24px Arial, Helvetica, sans-serif';
  wrapCanvasText(ctx, 'Tip: save the presentation HTML and upload it here if you need exact server-side PDF output.', 64, 310, width - 128, 34);
  return canvas.toDataURL('image/jpeg', 0.88);
}
function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight){
  const words = String(text || '').split(/\s+/);
  let line = '';
  let yy = y;
  for(const word of words){
    const test = line ? line + ' ' + word : word;
    if(ctx.measureText(test).width > maxWidth && line){
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if(line) ctx.fillText(line, x, yy);
}
function withTimeout(promise, ms, label){
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label || 'Timed out')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
async function renderSlideForPdf(slide, rasterScale){
  const root = document.createElement('div');
  root.className = 'pdf-render-root';
  const cls = slide.slideType === 'title-center' ? 'slide title-center' : (slide.slideType === 'two-col' ? 'slide two-col' : 'slide single');
  const styleCls = ' style-' + String(currentThemeFromFields().beamerStyle || 'classic').replace(/[^a-z0-9_-]/gi,'').toLowerCase();
  root.innerHTML = `<section class="${cls}${styleCls}" style="${buildSlideStyle(slide)}">${buildSlideInner(slide).trim()}</section>`;
  document.body.appendChild(root);
  try{
    const raw = JSON.stringify(slide || {});
    const hasMath = /\\\(|\\\[|\$/.test(raw);
    if(hasMath && window.MathJax && typeof window.MathJax.typesetPromise === 'function'){
      await withTimeout(window.MathJax.typesetPromise([root]).catch(()=>{}), 2500, 'Math rendering timed out');
    }
    if(typeof fitFiguresIn === 'function') fitFiguresIn(root);

    // Stage 41J: preserve custom HTML blocks by replacing sandboxed srcdoc iframes
    // with a static visible-area snapshot before rasterization.
    root.querySelectorAll('.custom-frame-wrap').forEach((wrap, frameIndex)=>{
      const frame = wrap.querySelector('iframe.custom-frame');
      if(!frame) return;
      const rawSrcdoc = frame.getAttribute('srcdoc') || frame.srcdoc || '';
      const snapshot = document.createElement('div');
      snapshot.className = 'custom-frame custom-frame-pdf-snapshot';
      snapshot.setAttribute('data-pdf-custom-snapshot', '1');
      snapshot.setAttribute('data-custom-frame-index', String(frameIndex));
      snapshot.style.cssText = 'width:100%;height:100%;min-height:260px;overflow:hidden;background:#fff;position:relative;';
      const textarea = document.createElement('textarea');
      textarea.innerHTML = rawSrcdoc;
      const decoded = textarea.value;
      if(decoded.trim()){
        snapshot.innerHTML = decoded;
        snapshot.querySelectorAll('script, iframe, frame, object, embed').forEach(el => el.remove());
        snapshot.querySelectorAll('*').forEach(el => {
          Array.from(el.attributes || []).forEach(attr => {
            const name = String(attr.name || '').toLowerCase();
            const val = String(attr.value || '');
            if(name.startsWith('on')) el.removeAttribute(attr.name);
            if((name === 'src' || name === 'href' || name === 'xlink:href') && /^javascript:/i.test(val.trim())) el.removeAttribute(attr.name);
          });
        });
      }else{
        snapshot.innerHTML = '<div style="display:grid;place-items:center;width:100%;height:100%;min-height:260px;color:#555;font:16px system-ui,sans-serif;text-align:center;padding:1rem;">Custom HTML block</div>';
      }
      wrap.innerHTML = '';
      wrap.appendChild(snapshot);
      wrap.setAttribute('data-pdf-custom-visible-snapshot', '1');
    });
    root.querySelectorAll('iframe:not(.custom-frame)').forEach((frame)=>{
      const ph = document.createElement('div');
      ph.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:180px;border:1px solid rgba(17,17,17,.14);border-radius:14px;background:#fff;color:#555;font:600 18px Inter,Arial,sans-serif;';
      ph.textContent = 'Embedded HTML block';
      frame.replaceWith(ph);
    });
    root.querySelectorAll('.figure-resize-handle').forEach(el => el.remove());
    root.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    root.querySelectorAll('*').forEach(el => {
      el.style.animation = 'none';
      el.style.transition = 'none';
      if(el.tagName === 'VIDEO') {
        const ph = document.createElement('div');
        ph.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:180px;border:1px solid rgba(17,17,17,.14);border-radius:14px;background:#fff;color:#555;font:600 18px Inter,Arial,sans-serif;';
        ph.textContent = 'Video block';
        el.replaceWith(ph);
      }
    });

    await waitFrames(1);
    const slideEl = root.firstElementChild;
    const canvas = await withTimeout(window.html2canvas(slideEl, {
      backgroundColor: '#ffffff',
      scale: rasterScale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 600,
      width: 1600,
      height: 900,
      windowWidth: 1600,
      windowHeight: 900,
      scrollX: 0,
      scrollY: 0
    }), 5000, 'Slide rasterization timed out');
    const data = canvas.toDataURL('image/jpeg', 0.86);
    canvas.width = 1;
    canvas.height = 1;
    return data;
  } catch(err){
    console.warn('PDF fallback for slide:', slide && slide.title, err);
    return makeFallbackSlideImage(slide, 1600, 900, err && err.message ? err.message : 'Slide could not be rasterized in-browser');
  } finally {
    root.remove();
  }
}

async function openPrintablePdf(){
  const payload = currentPayload();
  const perPage = Number(document.getElementById('printSlidesPerPage').value || '1');
  const selectionText = (document.getElementById('printSlideSelection') || {}).value || 'all';
  const selected = parseSlideSelection(selectionText, payload.slides.length);
  if(!selected.length){
    alert('No slides matched the selected range. Use all or a range like 1-3,5,8-10.');
    return;
  }
  if(!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF){
    alert('PDF libraries are still loading. Please wait a moment and try again.');
    return;
  }

  const win = window.open('', '_blank');
  if(!win){
    alert('Please allow pop-ups to open the generated PDF.');
    return;
  }
  win.document.open();
  win.document.write('<!DOCTYPE html><html><head><title>Generating PDF…</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:2rem;color:#111} .muted{color:#555}</style></head><body><h2>Generating PDF…</h2><p class="muted">Rendering slide images and packing them into a PDF.</p></body></html>');
  win.document.close();

  const filteredSlides = selected.map(i => sanitizeSlideForPdf(payload.slides[i]));
  const layout = getPrintLayout(perPage);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation:'landscape', unit:'pt', format:'letter', compress:true });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const gap = 12;
  const usableW = pageW - 2 * margin;
  const usableH = pageH - 2 * margin;
  const cellW = (usableW - gap * (layout.cols - 1)) / layout.cols;
  const cellH = (usableH - gap * (layout.rows - 1)) / layout.rows;

  // Lower rasterization for multi-up handouts to keep it fast on iPad/Safari.
  const rasterScale =
    perPage === 1 ? 0.72 :
    perPage === 2 ? 0.58 :
    perPage === 4 ? 0.46 : 0.38;

  const origBtn = document.getElementById('printPdfBtn');
  const oldLabel = origBtn ? origBtn.textContent : '';
  if(origBtn) origBtn.textContent = 'Generating PDF…';
  showToast('Generating PDF…');

  try{
    for(let idx = 0; idx < filteredSlides.length; idx += 1){
      if(idx > 0 && idx % perPage === 0) pdf.addPage();

      const slide = filteredSlides[idx];
      const img = await renderSlideForPdf(slide, rasterScale);

      const slot = idx % perPage;
      const row = Math.floor(slot / layout.cols);
      const col = slot % layout.cols;

      const fit = Math.min(cellW / 1600, cellH / 900);
      const drawW = 1600 * fit;
      const drawH = 900 * fit;
      const x = margin + col * (cellW + gap) + (cellW - drawW) / 2;
      const y = margin + row * (cellH + gap) + (cellH - drawH) / 2;

      pdf.addImage(img, 'JPEG', x, y, drawW, drawH, undefined, 'FAST');

      if(win && win.document && win.document.body){
        win.document.body.innerHTML =
          '<h2>Generating PDF…</h2><p class="muted">Rendered ' +
          (idx + 1) + ' of ' + filteredSlides.length +
          ' slides.</p>';
      }

      await waitFrames(1);
    }

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    win.location.href = url;
    showToast('Opened PDF in a new tab.');
  } catch(err){
    console.error(err);
    if(win && win.document && win.document.body){
      win.document.body.innerHTML =
        '<h2>Could not generate PDF</h2><pre style="white-space:pre-wrap;color:#900;">' +
        escapeHtml(err && (err.stack || err.message) || String(err)) +
        '</pre>';
    }
    alert('Could not generate the PDF. ' + (err && err.message ? err.message : ''));
  } finally {
    if(origBtn) origBtn.textContent = oldLabel || 'Direct PDF (image-first)';
  }
}

async function exportPdfReadyHtml(){
  const payload = currentPayload();
  const perPage = Number(document.getElementById('printSlidesPerPage').value || '1');
  const selectionText = (document.getElementById('printSlideSelection') || {}).value || 'all';
  const selected = parseSlideSelection(selectionText, payload.slides.length);
  if(!selected.length){
    alert('No slides matched the selected range. Use all or a range like 1-3,5,8-10.');
    return;
  }
  const filteredPayload = {
    deckTitle: (payload.deckTitle || 'Printable presentation') + ' handout',
    slides: selected.map(i => sanitizeSlideForPdf(payload.slides[i]))
  };
  const html = buildPrintableViewer(filteredPayload, perPage);
  const base = (payload.deckTitle || 'presentation').replace(/[^\w\-]+/g,'_') || 'presentation';
  await saveTextFileAs(base + '_'+ perPage + 'up_handout.html', html, 'text/html;charset=utf-8');
  showToast('Saved PDF-ready HTML.');
}

async function downloadStandalone(){

  const slide = currentDraftSlide();
  const payload = { deckTitle: slide.title || 'Standalone slide', theme: currentThemeFromFields(), presentationOptions: currentPresentationOptionsForExport(), slides:[slide] };
  await saveTextFileAs(((slide.title || 'slide').replace(/[^\w\-]+/g,'_') || 'slide') + '.html', buildStandaloneViewer(payload), 'text/html;charset=utf-8');
  showToast('Saved current slide.');
}
async function downloadDeck(){
  const payload = currentPayload();
  await saveTextFileAs(((payload.deckTitle || 'presentation').replace(/[^\w\-]+/g,'_') || 'presentation') + '.html', buildStandaloneViewer(payload), 'text/html;charset=utf-8');
  showToast('Saved full presentation.');
}
async function saveCurrentSlideJson(){
  const slide = slideForSnippet(currentDraftSlide());
  await saveTextFileAs(((slide.title || 'slide').replace(/[^\w\-]+/g,'_') || 'slide') + '.json', JSON.stringify(slide, null, 2), 'application/json;charset=utf-8');
  showToast('Saved current slide JSON.');
}
async function savePresentationJson(){
  const payload = currentPayload();
  await saveTextFileAs(((payload.deckTitle || 'presentation').replace(/[^\w\-]+/g,'_') || 'presentation') + '.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  showToast('Saved presentation JSON.');
}



    return {
      buildStandaloneViewer,
      downloadTextFile,
      saveBlobWithDialog,
      saveTextFileAs,
      currentPayload,
      sanitizeBlockForPdf,
      sanitizeSlideForPdf,
      getPrintLayout,
      buildPrintableViewer,
      parseSlideSelection,
      waitFrames,
      makeFallbackSlideImage,
      wrapCanvasText,
      withTimeout,
      renderSlideForPdf,
      openPrintablePdf,
      exportPdfReadyHtml,
      downloadStandalone,
      downloadDeck,
      saveCurrentSlideJson,
      savePresentationJson
    };
  }

  window.LuminaExport = { createApi };
})();
