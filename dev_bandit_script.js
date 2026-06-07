
  (function () {
    'use strict';
    const DEFAULT_BACKEND = 'https://lumina-latex-backend-zugntkn2la-ue.a.run.app/api/lumina/memory';
    const KEYS = {
      memoryEnabled: 'latexai:memory-enabled',
      backendUrl: 'lumina-latex.memory.backendUrl',
      proxyToken: 'lumina-latex.memory.proxyToken',
      policy: 'latexai:memory-selection-policy',
      epsilon: 'latexai:memory-bandit-epsilon',
      ucbBeta: 'latexai:memory-bandit-ucb-beta',
      thompsonAlpha: 'latexai:memory-bandit-thompson-alpha',
      softmaxTemp: 'latexai:memory-bandit-softmax-temperature',
      poolSize: 'latexai:memory-bandit-exploration-pool-size',
      topK: 'latexai:memory-bandit-top-k',
      queryLimit: 'latexai:memory-bandit-debug-limit'
    };
    const DEFAULTS = {
      memoryEnabled: 'true',
      policy: 'ucb',
      epsilon: '0.10',
      ucbBeta: '0.20',
      thompsonAlpha: '0.25',
      softmaxTemp: '0.25',
      poolSize: '24',
      topK: '6',
      queryLimit: '8'
    };

    const $ = (id) => document.getElementById(id);
    const clean = (value) => String(value == null ? '' : value).trim();
    function lsGet(key, fallback) {
      try { const value = localStorage.getItem(key); return value == null || value === '' ? fallback : value; } catch (_err) { return fallback; }
    }
    function lsSet(key, value) {
      try { localStorage.setItem(key, String(value)); } catch (_err) {}
    }
    function normalizeBase(value) {
      const raw = clean(value) || DEFAULT_BACKEND;
      try {
        const url = new URL(raw, window.location.href);
        url.hash = '';
        url.search = '';
        url.pathname = url.pathname
          .replace(/\/api\/lumina\/memory(?:\/.+)?\/?$/i, '/api/lumina/memory')
          .replace(/\/api\/lumina\/ai(?:\/.+)?\/?$/i, '/api/lumina/memory')
          .replace(/\/api\/lumina\/latex\/compile(?:\/.+)?\/?$/i, '/api/lumina/memory');
        if (!/\/api\/lumina\/memory\/?$/i.test(url.pathname)) url.pathname = url.pathname.replace(/\/+$/, '') + '/api/lumina/memory';
        return url.href.replace(/\/$/, '');
      } catch (_err) {
        return raw.replace(/\/api\/lumina\/memory(?:\/.+)?\/?$/i, '/api/lumina/memory').replace(/\/$/, '');
      }
    }
    function number(id, fallback, lo, hi) {
      const value = Number($(id).value);
      if (!Number.isFinite(value)) return fallback;
      return Math.max(lo, Math.min(hi, value));
    }
    function setStatus(id, text, kind) {
      const el = $(id);
      el.className = 'status' + (kind ? ' ' + kind : '');
      el.textContent = text;
    }
    function headers(hasBody) {
      const h = {};
      const token = clean($('proxyToken').value);
      if (token) h.Authorization = 'Bearer ' + token;
      if (hasBody) h['Content-Type'] = 'application/json';
      return h;
    }
    async function memoryFetch(path, options) {
      const base = normalizeBase($('backendUrl').value);
      const res = await fetch(base + path, { ...(options || {}), headers: { ...headers(Boolean(options && options.body)), ...((options || {}).headers || {}) } });
      const text = await res.text().catch(() => '');
      let json = {};
      try { json = text ? JSON.parse(text) : {}; } catch (_err) { json = { raw: text }; }
      if (!res.ok || json.ok === false) throw new Error(json.detail || json.message || json.raw || ('HTTP ' + res.status));
      return json;
    }
    function syncPair(rangeId, numId, valId) {
      const range = $(rangeId), num = $(numId), val = $(valId);
      const update = (source) => {
        const v = source.value;
        range.value = v;
        num.value = v;
        val.textContent = v;
      };
      range.addEventListener('input', () => update(range));
      num.addEventListener('input', () => update(num));
      update(range);
    }
    function load() {
      $('backendUrl').value = normalizeBase(lsGet(KEYS.backendUrl, DEFAULT_BACKEND));
      $('proxyToken').value = lsGet(KEYS.proxyToken, '');
      $('memoryEnabled').checked = lsGet(KEYS.memoryEnabled, DEFAULTS.memoryEnabled) !== 'false';
      $('policy').value = lsGet(KEYS.policy, DEFAULTS.policy).replace(/-/g, '_');
      $('topK').value = lsGet(KEYS.topK, DEFAULTS.topK);
      $('poolSize').value = lsGet(KEYS.poolSize, DEFAULTS.poolSize);
      $('queryLimit').value = lsGet(KEYS.queryLimit, DEFAULTS.queryLimit);
      $('epsilon').value = $('epsilonNum').value = lsGet(KEYS.epsilon, DEFAULTS.epsilon);
      $('ucbBeta').value = $('ucbBetaNum').value = lsGet(KEYS.ucbBeta, DEFAULTS.ucbBeta);
      $('thompsonAlpha').value = $('thompsonAlphaNum').value = lsGet(KEYS.thompsonAlpha, DEFAULTS.thompsonAlpha);
      $('softmaxTemp').value = $('softmaxTempNum').value = lsGet(KEYS.softmaxTemp, DEFAULTS.softmaxTemp);
      syncPair('epsilon', 'epsilonNum', 'epsilonVal');
      syncPair('ucbBeta', 'ucbBetaNum', 'ucbBetaVal');
      syncPair('thompsonAlpha', 'thompsonAlphaNum', 'thompsonAlphaVal');
      syncPair('softmaxTemp', 'softmaxTempNum', 'softmaxTempVal');
      refreshTable();
    }
    function saveBackend() {
      lsSet(KEYS.backendUrl, normalizeBase($('backendUrl').value));
      lsSet(KEYS.proxyToken, clean($('proxyToken').value));
      lsSet(KEYS.memoryEnabled, $('memoryEnabled').checked ? 'true' : 'false');
      setStatus('backendStatus', 'Saved backend settings. Main Latexai app will use these on the same origin.', 'good');
      refreshTable();
    }
    function savePolicy() {
      const policy = clean($('policy').value) || 'ucb';
      lsSet(KEYS.policy, policy);
      lsSet(KEYS.topK, Math.round(number('topK', 6, 1, 24)));
      lsSet(KEYS.poolSize, Math.round(number('poolSize', 24, 6, 200)));
      lsSet(KEYS.queryLimit, Math.round(number('queryLimit', 8, 1, 100)));
      lsSet(KEYS.epsilon, number('epsilonNum', 0.10, 0, 0.50).toFixed(2));
      lsSet(KEYS.ucbBeta, number('ucbBetaNum', 0.20, 0, 2).toFixed(2));
      lsSet(KEYS.thompsonAlpha, number('thompsonAlphaNum', 0.25, 0, 2).toFixed(2));
      lsSet(KEYS.softmaxTemp, number('softmaxTempNum', 0.25, 0.03, 5).toFixed(2));
      setStatus('policyStatus', 'Saved policy settings. The next main-app AI call will send these to /ranked-context.', 'good');
      refreshTable();
    }
    function resetDefaults() {
      Object.values(KEYS).forEach((key) => { try { localStorage.removeItem(key); } catch (_err) {} });
      load();
      setStatus('policyStatus', 'Reset to defaults: policy=ucb, topK=6, epsilon=0.10, ucbBeta=0.20.', 'warn');
      setStatus('backendStatus', 'Backend URL reset to default display value; click Save backend settings to persist.', 'warn');
    }
    async function testHealth() {
      saveBackend();
      setStatus('backendStatus', 'Testing memory backend health...', null);
      try {
        const json = await memoryFetch('/health');
        setStatus('backendStatus', 'Health OK:\n' + JSON.stringify(json, null, 2), 'good');
      } catch (err) {
        setStatus('backendStatus', 'Health failed: ' + (err && err.message ? err.message : err), 'bad');
      }
    }
    function currentParams() {
      return {
        memorySelectionPolicy: clean($('policy').value) || 'ucb',
        epsilon: number('epsilonNum', 0.10, 0, 0.50),
        ucbBeta: number('ucbBetaNum', 0.20, 0, 2),
        thompsonAlpha: number('thompsonAlphaNum', 0.25, 0, 2),
        softmaxTemperature: number('softmaxTempNum', 0.25, 0.03, 5),
        explorationPoolSize: Math.round(number('poolSize', 24, 6, 200)),
        limit: Math.round(number('queryLimit', 8, 1, 100)),
        agentRole: clean($('agentRole').value) || 'editor',
        taskType: clean($('taskType').value) || 'debug_context_scores',
        workflow: clean($('workflow').value) || 'debug',
        query: clean($('query').value) || 'clarity'
      };
    }
    function debugUrl() {
      const base = normalizeBase($('backendUrl').value);
      const params = new URLSearchParams();
      const p = currentParams();
      Object.keys(p).forEach((key) => params.set(key, p[key]));
      return base + '/debug/context-scores?' + params.toString();
    }
    async function runDebug() {
      saveBackend();
      savePolicy();
      const url = debugUrl();
      setStatus('debugStatus', 'Running debug request...\n' + url, null);
      try {
        const res = await fetch(url, { headers: headers(false) });
        const text = await res.text().catch(() => '');
        let json = {};
        try { json = text ? JSON.parse(text) : {}; } catch (_err) { json = { raw: text }; }
        if (!res.ok || json.ok === false) throw new Error(json.detail || json.message || json.raw || ('HTTP ' + res.status));
        renderResult(json);
        setStatus('debugStatus', 'Debug request OK. See selection result below.', 'good');
      } catch (err) {
        setStatus('debugStatus', 'Debug request failed: ' + (err && err.message ? err.message : err), 'bad');
      }
    }
    function pickArray(json) {
      const d = json && json.debug ? json.debug : json;
      return d.items || d.memories || d.selectedMemories || d.contextItems || d.candidateDebug || d.candidates || [];
    }
    function renderResult(json) {
      $('rawJson').textContent = JSON.stringify(json, null, 2);
      const d = json.debug || json;
      const audit = d.banditAudit || d.contextualBanditAudit || d.selectionAudit || d.audit || {};
      $('resultSummary').textContent = 'Policy: ' + (audit.policy || currentParams().memorySelectionPolicy) +
        ' | selected: ' + (audit.selectedCount == null ? '?' : audit.selectedCount) +
        ' | candidates: ' + (audit.candidateCount == null ? '?' : audit.candidateCount) +
        ' | exploration selected: ' + (audit.explorationSelectedCount == null ? '?' : audit.explorationSelectedCount);
      const items = pickArray(json);
      if (!Array.isArray(items) || !items.length) {
        $('resultTableWrap').innerHTML = '<p class="small">No candidate rows returned.</p>';
        return;
      }
      const rows = items.slice(0, 30).map((it) => {
        const pol = it.learnedContextPolicy || {};
        const b = pol.contextualBandit || it.contextualBandit || {};
        const id = it.memoryId || it.memory_id || it.id || '';
        const selected = b.selected || it.contextualBanditSelected || false;
        const title = it.key || it.title || it.summary || it.value || '';
        return '<tr>' +
          '<td>' + (selected ? '<span class="pill">selected</span>' : '') + '</td>' +
          '<td class="mono">' + esc(id).slice(0, 26) + '</td>' +
          '<td>' + esc(String(title).slice(0, 170)) + '</td>' +
          '<td>' + esc(b.baseScore ?? it.learnedContextScore ?? '') + '</td>' +
          '<td>' + esc(b.finalBanditScore ?? it.contextualBanditScore ?? '') + '</td>' +
          '<td>' + esc(b.explorationBonus ?? '') + '</td>' +
          '<td>' + esc(b.timesUsed ?? '') + '</td>' +
          '<td>' + esc(b.avgReward ?? '') + '</td>' +
          '<td>' + esc(b.wasExploration ?? '') + '</td>' +
        '</tr>';
      }).join('');
      $('resultTableWrap').innerHTML = '<table><thead><tr><th></th><th>memory</th><th>summary</th><th>base</th><th>bandit</th><th>explore bonus</th><th>used</th><th>avg reward</th><th>explore?</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
    function esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
    }
    function refreshTable() {
      const rows = Object.entries(KEYS).map(([name, key]) => '<tr><th>' + esc(name) + '</th><td class="mono">' + esc(key) + '</td><td>' + esc(lsGet(key, '')) + '</td></tr>').join('');
      $('settingsTable').innerHTML = rows;
    }
    function currentSimulationPayload() {
      const p = currentParams();
      const policies = clean($('simPolicies').value) || 'greedy,epsilon_greedy,ucb,thompson,softmax';
      return {
        policies,
        rounds: Math.round(number('simRounds', 250, 1, 5000)),
        memoryCount: Math.round(number('simMemoryCount', 80, 8, 1000)),
        initialMemoryCount: Math.round(number('simInitialMemoryCount', 30, 4, 1000)),
        growthEvery: Math.round(number('simGrowthEvery', 25, 0, 10000)),
        memoriesPerGrowth: Math.round(number('simMemoriesPerGrowth', 4, 0, 100)),
        seed: Math.round(number('simSeed', 12345, 0, 2147483647)),
        topK: Math.round(number('topK', 6, 1, 24)),
        explorationPoolSize: Math.round(number('poolSize', 24, 6, 200)),
        epsilon: p.epsilon,
        ucbBeta: p.ucbBeta,
        thompsonAlpha: p.thompsonAlpha,
        softmaxTemperature: p.softmaxTemperature,
        rewardNoise: number('simRewardNoise', 0.18, 0, 2),
        taskDrift: number('simTaskDrift', 0.08, 0, 1)
      };
    }
    async function runSimulation() {
      saveBackend();
      savePolicy();
      const payload = currentSimulationPayload();
      setStatus('simulationStatus', 'Running offline backend simulation...', null);
      try {
        const json = await memoryFetch('/debug/simulate-bandit', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        renderSimulation(json);
        const best = json && json.summary ? json.summary.bestPolicyByAvgReward : '?';
        setStatus('simulationStatus', 'Simulation OK. Best policy by average reward: ' + best + '.', 'good');
      } catch (err) {
        setStatus('simulationStatus', 'Simulation failed: ' + (err && err.message ? err.message : err), 'bad');
      }
    }
    function renderSimulation(json) {
      $('simulationRawJson').textContent = JSON.stringify(json, null, 2);
      const results = Array.isArray(json.results) ? json.results : [];
      const params = json.parameters || {};
      $('simulationSummary').textContent = 'Rounds: ' + (params.rounds || '?') +
        ' | memories: ' + (params.memoryCount || '?') +
        ' | growth: +' + (params.memoriesPerGrowth || 0) + ' every ' + (params.growthEvery || 0) +
        ' | best by reward: ' + ((json.summary || {}).bestPolicyByAvgReward || '?') +
        ' | best by regret: ' + ((json.summary || {}).bestPolicyByRegret || '?');
      if (!results.length) {
        $('simulationTableWrap').innerHTML = '<p class="small">No simulation rows returned.</p>';
        return;
      }
      const rows = results.map((r, idx) => '<tr>' +
        '<td>' + (idx + 1) + '</td>' +
        '<td><span class="pill">' + esc(r.policy) + '</span></td>' +
        '<td>' + esc(r.avgRewardPerRound) + '</td>' +
        '<td>' + esc(r.regret) + '</td>' +
        '<td>' + esc(r.successRate) + '</td>' +
        '<td>' + esc(r.failureRate) + '</td>' +
        '<td>' + esc(r.explorationRate) + '</td>' +
        '<td>' + esc(r.uniqueMemoriesSelected) + '</td>' +
        '<td>' + esc(r.finalActiveMemories) + '</td>' +
        '</tr>').join('');
      $('simulationTableWrap').innerHTML = '<table><thead><tr><th>#</th><th>policy</th><th>avg reward</th><th>regret</th><th>success</th><th>failure</th><th>explore</th><th>unique memories</th><th>final active</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
    async function copySimulationPayload() {
      const payload = currentSimulationPayload();
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        setStatus('simulationStatus', 'Copied simulation payload.', 'good');
      } catch (_err) {
        setStatus('simulationStatus', JSON.stringify(payload, null, 2), 'warn');
      }
    }
    async function copyDebugUrl() {
      const url = debugUrl();
      try {
        await navigator.clipboard.writeText(url);
        setStatus('debugStatus', 'Copied debug URL:\n' + url, 'good');
      } catch (_err) {
        setStatus('debugStatus', 'Debug URL:\n' + url, 'warn');
      }
    }
    $('saveBackend').addEventListener('click', saveBackend);
    $('testHealth').addEventListener('click', testHealth);
    $('savePolicy').addEventListener('click', savePolicy);
    $('resetDefaults').addEventListener('click', resetDefaults);
    $('runDebug').addEventListener('click', runDebug);
    $('copyCurl').addEventListener('click', copyDebugUrl);
    $('runSimulation').addEventListener('click', runSimulation);
    $('copySimulationPayload').addEventListener('click', copySimulationPayload);
    $('refreshTable').addEventListener('click', refreshTable);
    load();
  })();
  