/**
 * Playwright test suite for Chuvadi LaTeX Editor
 * Serves static files locally, mocks all external API/backend calls.
 *
 * Layout (after JS init):
 *   LEFT panel  — project/files/outline + dynamic left-tool tabs: Audit AI, Paper AI, Literature, Settings
 *   CENTRE      — LaTeX source editor
 *   RIGHT panel — Preview | Logs (only two native tabs)
 *
 * Run: node tests/test.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

// ── Config ─────────────────────────────────────────────────────────────────
const PORT       = 4747;
const BASE       = `http://localhost:${PORT}`;
const AI_BACKEND = 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app';
const GH_BACKEND = 'https://lumina-github-sync-backend-y4piylmfja-ue.a.run.app';
const TIMEOUT    = 8000;

// ── Result tracking ─────────────────────────────────────────────────────────
const results = [];
const pass = (name) => { results.push({ status: '✅ PASS', name }); console.log(`  ✅ ${name}`); };
const fail = (name, reason) => { results.push({ status: '❌ FAIL', name, reason }); console.log(`  ❌ ${name}\n     ${reason}`); };
const warn = (name, reason) => { results.push({ status: '⚠️  WARN', name, reason }); console.log(`  ⚠️  ${name}\n     ${reason}`); };

// ── Static file server ───────────────────────────────────────────────────────
const cwd = new URL('..', import.meta.url).pathname;
const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd, stdio: 'pipe' });

// Poll until server is ready (up to 10s)
let serverReady = false;
for (let i = 0; i < 20; i++) {
  await sleep(500);
  try {
    const r = await fetch(BASE);
    if (r.status < 600) { serverReady = true; break; }
  } catch { /* not ready yet */ }
}
if (!serverReady) { console.error('HTTP server failed to start'); server.kill(); process.exit(1); }

// ── Mock helpers ─────────────────────────────────────────────────────────────
const AI_SSE_RESPONSE =
  'data: {"id":"mock","choices":[{"delta":{"role":"assistant","content":"Mock AI: This is a test response simulating a real AI reply."}}]}\n\n' +
  'data: {"id":"mock","choices":[{"delta":{"content":" Additional content."}}]}\n\n' +
  'data: {"id":"mock","choices":[{"delta":{"content":""},"finish_reason":"stop"}]}\n\n' +
  'data: [DONE]\n\n';

async function setupMocks(page) {
  await page.route(`${AI_BACKEND}/**`, async (route) => {
    const url = route.request().url();
    if (url.includes('/health'))
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, service: 'lumina-latex-backend', aiProxy: true, compileJobs: true }) });
    if (url.includes('/api/lumina/models'))
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, providers: {
          openai:    [{ model: 'gpt-4o-mini', tier: 'fast' }, { model: 'gpt-4o', tier: 'strong' }],
          anthropic: [{ model: 'claude-haiku-4-5', tier: 'fast' }, { model: 'claude-sonnet-4-5', tier: 'strong' }],
          gemini:    [{ model: 'gemini-2.0-flash', tier: 'fast' }]
        }}) });
    if (url.includes('/api/lumina/ai/status'))
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, configuredProviders: { openai: true, anthropic: true, gemini: false } }) });
    if (url.includes('/api/lumina/ai'))
      return route.fulfill({ status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' },
        body: AI_SSE_RESPONSE });
    if (url.includes('/api/lumina/latex/compile/jobs') && route.request().method() === 'POST')
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, jobId: 'mock-job-001', status: 'queued' }) });
    if (url.includes('/api/lumina/latex/compile/jobs'))
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, jobId: 'mock-job-001', status: 'done',
          log: '! LaTeX Error (mock): No TeX engine in test mode.', errors: 1 }) });
    if (url.includes('/api/lumina/latex/compile'))
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: false, log: 'Mock compile: No TeX engine in test mode.', errors: 1 }) });
    if (url.includes('/api/lumina/projects'))
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, content: '' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.route(`${GH_BACKEND}/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, message: 'Mock GitHub backend' }) }));

  await page.route('**/api/lumina/memory/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
}

// ── Utility ───────────────────────────────────────────────────────────────────
async function expectVisible(page, selector, name) {
  try {
    await page.waitForSelector(selector, { timeout: TIMEOUT, state: 'visible' });
    pass(name);
    return true;
  } catch {
    fail(name, `Not visible: ${selector}`);
    return false;
  }
}

async function expectText(page, selector, expected, name) {
  try {
    const el = page.locator(selector);
    await el.waitFor({ timeout: TIMEOUT });
    const text = await el.textContent();
    if (text && text.includes(expected)) { pass(name); return true; }
    warn(name, `Expected "${expected}" in "${text?.slice(0, 80)}"`);
    return false;
  } catch {
    fail(name, `Element not found: ${selector}`);
    return false;
  }
}

async function clickLeftTab(page, tabName) {
  const btn = page.locator(`.stage19w16-left-tab[data-left-tool-tab="${tabName}"]`);
  if (await btn.count()) { await btn.click(); await sleep(400); return true; }
  warn(`Click left tab "${tabName}"`, 'Tab button not found');
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// BROWSER SETUP
// ─────────────────────────────────────────────────────────────────────────────
const browser  = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page     = await context.newPage();

const consoleErrors = [];
const pageErrors    = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => pageErrors.push(err.message));

await setupMocks(page);

// ── 1. Page Load ──────────────────────────────────────────────────────────────
console.log('\n── 1. Page Load ─────────────────────────────────────────────');
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
// Wait for dynamic services to initialise (stage19w16 delays: 150, 500, 1200, 2600ms)
await sleep(3000);

const title = await page.title();
if (title.includes('Chuvadi') || title.includes('LaTeX')) pass('Page title correct');
else fail('Page title correct', `Got: "${title}"`);

await expectVisible(page, '.topbar',       'Topbar renders');
await expectVisible(page, '.left-panel',   'Left panel renders');
await expectVisible(page, '.editor-panel', 'Editor panel renders');
await expectVisible(page, '.right-panel',  'Right panel renders');
await expectVisible(page, '#sourceEditor', 'Source editor present');

const bootErrorBox = await page.$('.boot-error-box');
if (bootErrorBox) fail('No boot errors on load', (await bootErrorBox.textContent())?.slice(0, 200));
else pass('No boot errors on load');

await page.screenshot({ path: 'tests/screenshots/01-page-load.png' });

// ── 2. Brand & Topbar ─────────────────────────────────────────────────────────
console.log('\n── 2. Brand & Topbar ────────────────────────────────────────');
await expectText(page, '.brand-block .smallcaps', 'Chuvadi', 'Brand name shows "Chuvadi"');
await expectVisible(page, '#compileBtn',             'Compile PDF button present');
await expectVisible(page, '#literatureAssistantBtn', 'Literature Assistant link present');
await expectVisible(page, '#reviewCorpusTopBtn',     'Review Corpus link present');
await expectVisible(page, '#valActLabTopBtn',         'Value/Action Lab link present');
await expectVisible(page, '#helpTopBtn',              'Help link present');

// ── 3. Left Panel — Project controls ──────────────────────────────────────────
console.log('\n── 3. Left Panel — Project Controls ─────────────────────────');
await expectVisible(page, '#newProjectBtn',         'New Project button present');
await expectVisible(page, '#openGithubProjectBtn',  'Open Project button present');
await expectVisible(page, '#saveProjectBtn',         'Save Project button present');
await expectVisible(page, '#importFilesBtn',         'Import Project button present');
await expectVisible(page, '#exportZipBtn',           'Export zip button present');
await expectVisible(page, '#projectTitleDisplay',   'Project title display present');
await expectVisible(page, '#fileTree',              'File tree container present');
await expectVisible(page, '#outlineList',           'Outline list present');
const autosaveText = await page.locator('#autosaveStatus').textContent().catch(() => '');
if (autosaveText) pass(`Autosave status shows: "${autosaveText}"`);
else warn('Autosave status', 'No text');

// ── 4. Left-panel tool tabs (stage19w16) ───────────────────────────────────────
console.log('\n── 4. Left-Panel Tool Tabs ──────────────────────────────────');
const leftTabs = await page.locator('.stage19w16-left-tab').allTextContents();
if (leftTabs.length >= 3) pass(`Left-panel tool tabs found: ${leftTabs.join(', ')}`);
else fail('Left-panel tool tabs found', `Only ${leftTabs.length} tabs — services may not have initialised`);

for (const tab of ['Audit AI', 'Paper AI', 'Settings']) {
  const btn = page.locator(`.stage19w16-left-tab`).filter({ hasText: tab });
  if (await btn.count()) pass(`"${tab}" left-panel tab exists`);
  else fail(`"${tab}" left-panel tab exists`, 'Button not found');
}

// ── 5. Editor ─────────────────────────────────────────────────────────────────
console.log('\n── 5. Editor ────────────────────────────────────────────────');
const editor = page.locator('#sourceEditor');
await editor.click();
await editor.fill('\\documentclass{article}\n\\begin{document}\nHello, world!\n\\end{document}');
await sleep(300);

const editorVal = await editor.inputValue();
if (editorVal.includes('\\documentclass')) pass('Editor accepts LaTeX input');
else fail('Editor accepts LaTeX input', 'Content not set');

const cursorStatus = await page.locator('#cursorStatus').textContent().catch(() => '');
if (cursorStatus && cursorStatus !== 'Ln 1, Col 1') pass(`Cursor position updates: ${cursorStatus}`);
else warn('Cursor position updates', `Shows: "${cursorStatus}"`);

const filePill = await page.locator('#activeFilePill').textContent().catch(() => '');
if (filePill) pass(`Active file pill shows: "${filePill}"`);
else warn('Active file pill', 'No text');

await expectVisible(page, '#liteIndentBtn',         'Indent button visible');
await expectVisible(page, '#liteOutdentBtn',         'Outdent button visible');
await expectVisible(page, '#liteFormatSelectionBtn', 'Format selection button visible');
await expectVisible(page, '#wrapSelectionBtn',       'Wrap selection button visible');

try {
  await page.locator('#liteIndentBtn').click();
  await sleep(200);
  pass('Indent button clickable without error');
} catch (e) { fail('Indent button clickable without error', String(e)); }

try {
  await page.locator('#liteOutdentBtn').click();
  await sleep(200);
  pass('Outdent button clickable without error');
} catch (e) { fail('Outdent button clickable without error', String(e)); }

await page.screenshot({ path: 'tests/screenshots/05-editor.png' });

// ── 6. Right panel — Preview / Logs tabs ──────────────────────────────────────
console.log('\n── 6. Right Panel — Preview / Logs ──────────────────────────');
const rightTabs = await page.locator('.right-tab').allTextContents();
if (rightTabs.length >= 2) pass(`Right-panel tabs: ${rightTabs.join(', ')}`);
else fail('Right-panel tabs', `Only ${rightTabs.length}`);

await expectVisible(page, '#previewTab', 'Preview tab panel present');
const previewActive = await page.locator('#previewTab').getAttribute('class');
if (previewActive?.includes('active')) pass('Preview tab active by default');
else warn('Preview tab active by default', 'Class: ' + previewActive);

// Switch Preview mode Draft ↔ PDF
await expectVisible(page, '#showDraftPreviewBtn', 'Draft button present');
await expectVisible(page, '#showPdfPreviewBtn',   'PDF button present');
await page.locator('#showPdfPreviewBtn').click();
await sleep(300);
const pdfClass = await page.locator('#pdfPreview').getAttribute('class');
// Bug 2 fix: PDF pane must stay hidden when no PDF has been compiled yet.
if (pdfClass && pdfClass.includes('hidden')) pass('PDF preview guarded: stays hidden with no compiled PDF');
else warn('PDF preview guard', 'PDF pane shown without a compiled PDF — guard may be missing');
await page.locator('#showDraftPreviewBtn').click();
await sleep(200);
pass('Draft/PDF toggle works without crash');

// Logs tab
await page.locator('.right-tab:has-text("Logs")').click();
await sleep(300);
await expectVisible(page, '#logPanel',        'Log panel present');
await expectVisible(page, '#copyDiagnosticsBtn', 'Copy diagnostics button present');
const compileStatus = await page.locator('#compileStatusText').textContent().catch(() => '');
if (compileStatus) pass(`Compile status present: "${compileStatus}"`);
else warn('Compile status', 'No text found');

await page.screenshot({ path: 'tests/screenshots/06-logs-tab.png' });

// ── 7. Audit AI (left-panel Copilot tab) ──────────────────────────────────────
// NOTE: stage19w18 hides old copilot prompt controls (#aiProvider, #copilotPrompt, etc.)
// by design — the raw prompt UI was replaced by Paper AI with rounds=-1.
// The Audit AI tab now shows: audit sub-tabs, reviewer/rebuttal simulator.
console.log('\n── 7. Audit AI ──────────────────────────────────────────────');
await clickLeftTab(page, 'copilot');
await sleep(800);

// Sub-tab structure created by stage19w19
const auditSubtabEdits   = page.locator('[data-audit-subtab="edits"]');
const auditSubtabHistory = page.locator('[data-audit-subtab="history"]');
if (await auditSubtabEdits.count())   pass('Audit AI "Audit AI Edits" sub-tab present');
else fail('Audit AI "Audit AI Edits" sub-tab present', 'Not found');
if (await auditSubtabHistory.count()) pass('Audit AI "History / Comments" sub-tab present');
else fail('Audit AI "History / Comments" sub-tab present', 'Not found');

// Sub-tab panels
if (await page.locator('#stage19w19AuditEditsPanel').count())   pass('Audit edits panel present');
else fail('Audit edits panel present', '#stage19w19AuditEditsPanel not found');
if (await page.locator('#stage19w19AuditHistoryPanel').count()) pass('Audit history panel present');
else fail('Audit history panel present', '#stage19w19AuditHistoryPanel not found');

// Click sub-tab and verify active class toggles
try {
  await auditSubtabHistory.click();
  await sleep(300);
  const histActive = await auditSubtabHistory.getAttribute('class');
  if (histActive?.includes('active')) pass('History sub-tab becomes active on click');
  else warn('History sub-tab becomes active on click', `class: ${histActive}`);
  await auditSubtabEdits.click();
  await sleep(200);
  pass('Audit sub-tab navigation works without crash');
} catch (e) { fail('Audit sub-tab navigation', String(e).slice(0, 100)); }

// NOTE: stage19w10-workflow-tabs-service.js moves #reviewerRebuttalCard from
// copilotTab to #paperWorkflowUnifiedPane (inside Paper AI). It also adds
// stage19w10-local-copilot-only to copilotTab which CSS-hides the card there.
// The card is tested in Section 9 after navigating to the Paper AI tab.

await page.screenshot({ path: 'tests/screenshots/07-audit-ai.png' });

// ── 8. Paper AI (left-panel Paper AI tab) ─────────────────────────────────────
console.log('\n── 8. Paper AI ──────────────────────────────────────────────');
await clickLeftTab(page, 'paperAi');
await sleep(600);

await expectVisible(page, '#stage19w14Objective',   'Objective selector present');
await expectVisible(page, '#stage19w14Scope',       'Scope selector present');
await expectVisible(page, '#stage19w14Rounds',      'Rounds selector present');
await expectVisible(page, '#stage19w14OutputMode',  'Output mode selector present');
await expectVisible(page, '#stage19w14RunBtn',      'Run Paper AI button present');
await expectVisible(page, '#stage19w14PreviewBtn',  'Preview/sync button present');
await expectVisible(page, '#stage19w14ApplyBtn',    'Apply edits button present');

const objectives = await page.locator('#stage19w14Objective option').allTextContents();
const expectedObjs = ['quality', 'ranking', 'stress', 'remake', 'combined'];
// Case-insensitive match against option text content
const foundObjs = expectedObjs.filter(o => objectives.some(opt => opt.toLowerCase().includes(o)));
if (foundObjs.length === expectedObjs.length) pass('All 5 Paper AI objectives present');
else warn('Paper AI objectives', `Found: ${foundObjs.join(', ')}, Missing: ${expectedObjs.filter(o => !foundObjs.includes(o)).join(', ')}`);

// Change objective (select by value attribute, not label text)
try {
  await page.locator('#stage19w14Objective').selectOption({ value: 'stress' });
  await sleep(300);
  const selectedObj = await page.locator('#stage19w14Objective').inputValue();
  if (selectedObj === 'stress') pass('Objective selector changes correctly');
  else warn('Objective selector changes correctly', `Got: ${selectedObj} — JS may reset it`);
} catch (e) { fail('Objective selector changes correctly', String(e).slice(0, 100)); }

// Budget and focus selectors
const focus  = await page.locator('#stage19w14Focus option').allTextContents();
if (focus.length >= 4) pass(`Improvement focus options: ${focus.length}`);
else warn('Improvement focus options', `Only ${focus.length}`);

const statusMsg = await page.locator('#stage19w14Status').textContent().catch(() => '');
if (statusMsg) pass(`Paper AI status: "${statusMsg.slice(0, 80)}"`);
else warn('Paper AI status', 'Empty');

await page.screenshot({ path: 'tests/screenshots/08-paper-ai.png' });

// ── 9. Reviewer / Rebuttal (lives in Paper AI tab after stage19w10 moves it) ──
console.log('\n── 9. Reviewer / Rebuttal ───────────────────────────────────');
// The card is in Paper AI tab (stage19w10 moves it there from copilotTab).
// It is hidden by default via updateVisibleEngineCards() unless the debug
// "Show internal legacy engine cards" checkbox is enabled.
const reviewerCard = page.locator('#reviewerRebuttalCard');
if (await reviewerCard.count()) {
  // Verify stage19w10 moved the card out of copilotTab
  const parentId = await reviewerCard.evaluate(n => n.parentElement?.closest('[id]')?.id || n.closest('[id]')?.id || '');
  if (parentId && parentId !== 'copilotTab') pass(`Reviewer card moved to Paper AI panel (parent: #${parentId})`);
  else warn('Reviewer card location', `Expected to be moved out of copilotTab; parent: #${parentId}`);

  // Enable the debug checkbox programmatically (may be below fold).
  // Reviewer card only shows for objective=quality; set it first.
  const hasChk = await page.evaluate(() => !!document.getElementById('stage19w14ShowEngineCards'));
  if (hasChk) {
    await page.evaluate(() => {
      const obj = document.getElementById('stage19w14Objective');
      if (obj) { obj.value = 'quality'; obj.dispatchEvent(new Event('change', { bubbles: true })); }
      const chk = document.getElementById('stage19w14ShowEngineCards');
      if (chk && !chk.checked) {
        chk.checked = true;
        chk.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(400);
    const isVisible = await reviewerCard.isVisible().catch(() => false);
    if (isVisible) {
      pass('Reviewer/rebuttal card visible after enabling engine cards');
      await expectVisible(page, '#runReviewerSimBtn',           'Run reviews button present');
      await expectVisible(page, '#reviewerSimCount',            'Reviewer count selector present');
      await expectVisible(page, '#reviewerSimVenue',            'Target venue input present');
      await expectVisible(page, '#generateReviewerRebuttalBtn', 'Generate rebuttal button present');
      try {
        await page.locator('#reviewerSimVenue').fill('NeurIPS');
        await sleep(200);
        const venueVal = await page.locator('#reviewerSimVenue').inputValue();
        if (venueVal === 'NeurIPS') pass('Reviewer venue input accepts text');
        else fail('Reviewer venue input accepts text', `Got: "${venueVal}"`);
      } catch (e) { fail('Reviewer venue input', String(e).slice(0, 100)); }
      // Restore defaults
      await page.evaluate(() => {
        const chk = document.getElementById('stage19w14ShowEngineCards');
        if (chk) { chk.checked = false; chk.dispatchEvent(new Event('change', { bubbles: true })); }
        const obj = document.getElementById('stage19w14Objective');
        if (obj) { obj.value = 'quality'; obj.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      await sleep(200);
    } else {
      warn('Reviewer/rebuttal card visibility', 'Still hidden after enabling show-engine-cards checkbox');
    }
  } else {
    warn('Show engine cards checkbox', 'Not found in DOM');
  }
} else {
  warn('Reviewer/rebuttal card', 'Not found in DOM — stage19w10 may not have loaded');
}

// ── 10. Settings (left-panel Settings tab) ────────────────────────────────────
console.log('\n── 10. Settings ─────────────────────────────────────────────');
await clickLeftTab(page, 'settings');
await sleep(600);

await expectVisible(page, '#aiProxyUrl',          'AI proxy URL field');
await expectVisible(page, '#aiProxyToken',        'AI proxy token field');
await expectVisible(page, '#memoryBackendUrl',    'Memory backend URL field');
await expectVisible(page, '#githubBackendUrl',    'GitHub backend URL field');
await expectVisible(page, '#compileProxyUrl',     'Compile endpoint URL field');
await expectVisible(page, '#engineSelect',        'TeX engine selector');
await expectVisible(page, '#testCompileBackendBtn', 'Test compile backend button');
await expectVisible(page, '#testGithubBackendBtn',  'Test GitHub backend button');
await expectVisible(page, '#testMemoryBackendBtn',  'Test memory backend button');

// Verify default URLs are set
const aiProxyVal = await page.locator('#aiProxyUrl').inputValue();
if (aiProxyVal?.includes('lumina')) pass(`AI proxy URL default: "${aiProxyVal.slice(0, 50)}..."`);
else warn('AI proxy URL default', `Got: "${aiProxyVal}"`);

const ghVal = await page.locator('#githubBackendUrl').inputValue();
if (ghVal?.includes('lumina')) pass(`GitHub backend URL default: "${ghVal.slice(0, 50)}..."`);
else warn('GitHub backend URL default', `Got: "${ghVal}"`);

// Engine options
const engines = await page.locator('#engineSelect option').allTextContents();
if (engines.some(e => e.includes('pdfLaTeX'))) pass('pdfLaTeX engine option present');
else fail('pdfLaTeX engine option present', engines.join(', '));
if (engines.some(e => e.includes('XeLaTeX')))  pass('XeLaTeX engine option present');
else warn('XeLaTeX engine option present', engines.join(', '));

// Test backend button (mocked)
await page.locator('#testCompileBackendBtn').click();
await sleep(1500);
const backendStatusText = await page.locator('#backendStatusText').textContent().catch(() => '');
if (backendStatusText && backendStatusText !== 'Not checked')
  pass(`Backend test returns result: "${backendStatusText}"`);
else warn('Backend test result', `Status: "${backendStatusText}"`);

await page.screenshot({ path: 'tests/screenshots/10-settings.png' });

// ── 11. Compile button ────────────────────────────────────────────────────────
console.log('\n── 11. Compile Button ───────────────────────────────────────');
// Click back to editor, fill LaTeX, then compile
await page.locator('#sourceEditor').click();
await sleep(200);

// Point compile URL to the mocked backend
await clickLeftTab(page, 'settings');
await sleep(400);
const compileUrlField = page.locator('#compileProxyUrl');
await compileUrlField.fill(`${AI_BACKEND}/api/lumina/latex/compile`);
await sleep(200);

await page.locator('#compileBtn').click();
await sleep(2500);

const compileStatusAfter = await page.locator('#compileStatusText').textContent().catch(() => '');
if (compileStatusAfter && !compileStatusAfter.toLowerCase().includes('idle'))
  pass(`Compile triggered: "${compileStatusAfter}"`);
else warn('Compile triggered', `Status: "${compileStatusAfter}" — backend URL mismatch or no source`);

await page.screenshot({ path: 'tests/screenshots/11-compile.png' });

// ── 12. New Project ───────────────────────────────────────────────────────────
// Project panel buttons are inside the Project left-panel tab — navigate there first.
console.log('\n── 12. New Project ──────────────────────────────────────────');
await clickLeftTab(page, 'project');
await sleep(500);
try {
  page.once('dialog', dialog => dialog.dismiss().catch(() => {}));
  await page.locator('#newProjectBtn').click();
  await sleep(800);
  pass('New Project button clickable without crash');
} catch (e) { fail('New Project button', String(e)); }

// ── 13. Rename project ────────────────────────────────────────────────────────
console.log('\n── 13. Rename Project ───────────────────────────────────────');
try {
  page.once('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept('My Test Paper');
    else await dialog.dismiss();
  });
  await page.locator('#renameProjectBtn').click();
  await sleep(600);
  const newTitle = await page.locator('#projectTitleDisplay').textContent().catch(() => '');
  if (newTitle?.includes('My Test Paper')) pass(`Project renamed: "${newTitle}"`);
  else warn('Rename project', `Title: "${newTitle}"`);
} catch (e) { warn('Rename project', String(e)); }

// ── 14. File tree actions ─────────────────────────────────────────────────────
console.log('\n── 14. File Tree Actions ────────────────────────────────────');
try {
  page.once('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept('section.tex');
    else await dialog.dismiss();
  });
  await page.locator('#newFileBtn').click();
  await sleep(500);
  pass('New file button clickable');
} catch (e) { warn('New file button', String(e)); }

await expectVisible(page, '#insertFileBtn',          'Insert file button present');
await expectVisible(page, '#insertFolderBtn',        'Insert folder button present');
await expectVisible(page, '#revertProjectVersionBtn','Revert version button present');
await expectVisible(page, '#addTemplateBtn',         'Add template button present');
// #importFileInput is intentionally class="hidden" — triggered programmatically by importFilesBtn
const importInput = await page.locator('#importFileInput').count();
if (importInput) pass('Import file input exists in DOM (hidden by design)');
else fail('Import file input exists in DOM', 'Element not found');

// ── 15. Export zip ────────────────────────────────────────────────────────────
console.log('\n── 15. Export Zip ───────────────────────────────────────────');
try {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 3000 }).catch(() => null),
    page.locator('#exportZipBtn').click()
  ]);
  if (download) pass(`Export zip triggers download: "${download.suggestedFilename()}"`);
  else warn('Export zip', 'No download event — project may be empty');
} catch (e) { warn('Export zip', String(e)); }

// ── 16. Copy diagnostics ──────────────────────────────────────────────────────
console.log('\n── 16. Diagnostics ──────────────────────────────────────────');
await page.locator('.right-tab:has-text("Logs")').click();
await sleep(300);
try {
  await page.locator('#copyDiagnosticsBtn').click();
  await sleep(300);
  pass('Copy diagnostics button clickable');
} catch (e) { warn('Copy diagnostics', String(e)); }

// ── 17. Literature tab ────────────────────────────────────────────────────────
console.log('\n── 17. Literature Tab ───────────────────────────────────────');
const litTab = await clickLeftTab(page, 'literature');
if (litTab) {
  await sleep(400);
  const litPanel = page.locator('[data-left-tool-panel="literature"]');
  if (await litPanel.count()) {
    pass('Literature panel present');
    // Check for links to literature assistant
    const litLinks = await page.locator('[href="literature.html"]').count();
    if (litLinks > 0) pass('Link to Literature Assistant present');
    else warn('Link to Literature Assistant', 'Not found');
  } else {
    warn('Literature panel', 'Panel not found');
  }
}

// ── 18. JS errors audit ───────────────────────────────────────────────────────
console.log('\n── 18. JS / Console Errors ──────────────────────────────────');
if (pageErrors.length === 0) pass('No uncaught JS errors');
else fail('No uncaught JS errors', pageErrors.slice(0, 5).join('\n  '));

// Filter out expected network-mock-related errors
const significantErrors = consoleErrors.filter(e =>
  !e.includes('net::ERR') &&
  !e.includes('Failed to load resource') &&
  !e.includes('favicon') &&
  !e.includes('CORS')
);
if (significantErrors.length === 0) pass('No significant console errors');
else warn('Console errors', `${significantErrors.length} error(s):\n  ` + significantErrors.slice(0, 5).map(e => e.slice(0, 120)).join('\n  '));

if (consoleErrors.length > 0) {
  console.log(`\n  All console errors (${consoleErrors.length}):`);
  consoleErrors.slice(0, 20).forEach(e => console.log(`    • ${e.slice(0, 150)}`));
}

// ── 19. Auxiliary pages ───────────────────────────────────────────────────────
console.log('\n── 19. Other Pages ──────────────────────────────────────────');
for (const file of ['literature.html', 'review.html', 'help.html', 'val-act.html']) {
  try {
    const p2 = await context.newPage();
    await setupMocks(p2);
    const p2Errors = [];
    p2.on('pageerror', e => p2Errors.push(e.message));
    await p2.goto(`${BASE}/${file}`, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await sleep(800);
    const bootErr = await p2.$('.boot-error-box');
    const t = await p2.title().catch(() => '');
    if (bootErr)          fail(`${file} — no boot errors`, (await bootErr.textContent())?.slice(0, 100));
    else if (p2Errors.length > 0) warn(`${file} — no JS errors`, p2Errors[0].slice(0, 100));
    else                  pass(`${file} loads cleanly (title: "${t}")`);
    await p2.screenshot({ path: `tests/screenshots/19-${file.replace('.html', '')}.png` });
    await p2.close();
  } catch (e) { fail(`${file} loads`, String(e).slice(0, 100)); }
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────
await browser.close();
server.kill();

const passed = results.filter(r => r.status.includes('PASS')).length;
const failed = results.filter(r => r.status.includes('FAIL')).length;
const warned  = results.filter(r => r.status.includes('WARN')).length;

console.log('\n' + '═'.repeat(62));
console.log('  CHUVADI PLAYWRIGHT TEST REPORT');
console.log('═'.repeat(62));
console.log(`  Total: ${results.length}   ✅ ${passed} passed   ❌ ${failed} failed   ⚠️  ${warned} warnings`);
console.log('');

if (failed > 0) {
  console.log('  FAILURES:');
  results.filter(r => r.status.includes('FAIL')).forEach(r => {
    console.log(`    ❌ ${r.name}`);
    if (r.reason) console.log(`       → ${r.reason}`);
  });
  console.log('');
}
if (warned > 0) {
  console.log('  WARNINGS:');
  results.filter(r => r.status.includes('WARN')).forEach(r => {
    console.log(`    ⚠️  ${r.name}`);
    if (r.reason) console.log(`       → ${r.reason}`);
  });
  console.log('');
}
console.log('  Screenshots → tests/screenshots/');
console.log('═'.repeat(62));

process.exit(failed > 0 ? 1 : 0);
