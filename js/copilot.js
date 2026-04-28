(function () {
  'use strict';

  const W = window;
  const NS = (W.LuminaLatex = W.LuminaLatex || {});
  const State = () => NS.State;

  const FALLBACK_MODELS = {
    openai: [
      { value: 'gpt-4.1-mini', label: 'OpenAI · gpt-4.1-mini' },
      { value: 'gpt-4.1', label: 'OpenAI · gpt-4.1' }
    ],
    anthropic: [
      { value: 'claude-sonnet-4-5', label: 'Claude · claude-sonnet-4-5' },
      { value: 'claude-haiku-4-5', label: 'Claude · claude-haiku-4-5' }
    ],
    gemini: [
      { value: 'gemini-2.5-flash', label: 'Gemini · gemini-2.5-flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini · gemini-2.5-pro' }
    ]
  };

  const LS_PROVIDER = 'lumina-latex.ai.provider';
  const LS_MODEL_PREFIX = 'lumina-latex.ai.model.';
  const LS_PROXY_URL = 'lumina-latex.ai.proxyUrl';
  const LS_PROXY_TOKEN = 'lumina-latex.ai.proxyToken';

  function init() {
    bindProviderPicker();
    document.getElementById('askCopilotBtn')?.addEventListener('click', askCopilot);
    document.getElementById('insertCopilotBtn')?.addEventListener('click', insertCopilotResult);
    document.getElementById('replaceCopilotBtn')?.addEventListener('click', replaceWithCopilotResult);
  }

  function bindProviderPicker() {
    const providerEl = document.getElementById('aiProvider');
    const modelEl = document.getElementById('aiModel');
    const proxyUrlEl = document.getElementById('aiProxyUrl');
    const proxyTokenEl = document.getElementById('aiProxyToken');
    if (!providerEl || !modelEl) return;

    providerEl.value = localStorage.getItem(LS_PROVIDER) || 'openai';
    if (proxyUrlEl) proxyUrlEl.value = localStorage.getItem(LS_PROXY_URL) || proxyUrlEl.value || '/api/lumina/ai';
    if (proxyTokenEl) proxyTokenEl.value = localStorage.getItem(LS_PROXY_TOKEN) || '';

    renderModels();
    loadModelsFromProxy();

    providerEl.addEventListener('change', () => {
      localStorage.setItem(LS_PROVIDER, providerEl.value);
      renderModels();
    });
    modelEl.addEventListener('change', () => localStorage.setItem(`${LS_MODEL_PREFIX}${providerEl.value}`, modelEl.value));
    proxyUrlEl?.addEventListener('change', () => {
      localStorage.setItem(LS_PROXY_URL, proxyUrlEl.value.trim() || '/api/lumina/ai');
      loadModelsFromProxy();
    });
    proxyTokenEl?.addEventListener('change', () => localStorage.setItem(LS_PROXY_TOKEN, proxyTokenEl.value.trim()));
  }

  function modelsFor(provider) {
    return (NS.Copilot.models && NS.Copilot.models[provider]) || FALLBACK_MODELS[provider] || [];
  }

  function renderModels() {
    const providerEl = document.getElementById('aiProvider');
    const modelEl = document.getElementById('aiModel');
    if (!providerEl || !modelEl) return;
    const provider = providerEl.value || 'openai';
    const models = modelsFor(provider);
    modelEl.innerHTML = models.map((m) => `<option value="${escapeHtml(m.value)}">${escapeHtml(m.label || m.value)}</option>`).join('');
    const saved = localStorage.getItem(`${LS_MODEL_PREFIX}${provider}`);
    if (saved && models.some((m) => m.value === saved)) modelEl.value = saved;
  }

  async function loadModelsFromProxy() {
    const proxyUrl = getProxyUrl();
    const modelsUrl = proxyUrl.replace(/\/api\/lumina\/ai\/?$/, '/api/lumina/models');
    try {
      const response = await fetch(modelsUrl);
      const data = await response.json();
      if (!response.ok || !data?.ok || !data?.providers) return false;
      const mapped = {};
      for (const [provider, list] of Object.entries(data.providers)) {
        mapped[provider] = (list || []).map((item) => ({ value: item.model, label: `${provider} · ${item.model}` }));
      }
      NS.Copilot.models = mapped;
      renderModels();
      return true;
    } catch (_err) {
      return false;
    }
  }

  function getProxyUrl() {
    return document.getElementById('aiProxyUrl')?.value?.trim() || localStorage.getItem(LS_PROXY_URL) || '/api/lumina/ai';
  }

  function getConfig() {
    return {
      provider: document.getElementById('aiProvider')?.value || localStorage.getItem(LS_PROVIDER) || 'openai',
      model: document.getElementById('aiModel')?.value || '',
      proxyUrl: getProxyUrl(),
      proxyToken: document.getElementById('aiProxyToken')?.value?.trim() || localStorage.getItem(LS_PROXY_TOKEN) || ''
    };
  }

  async function callProxy(payload, meta = {}) {
    const config = getConfig();
    const headers = { 'Content-Type': 'application/json' };
    if (config.proxyToken) headers.Authorization = `Bearer ${config.proxyToken}`;
    const response = await fetch(config.proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ provider: config.provider, model: config.model, task: meta.task || 'latex-copilot', payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data?.error?.message || data?.message || `AI proxy failed with HTTP ${response.status}.`);
    return data;
  }

  function extractText(data) {
    if (typeof data?.text === 'string') return data.text;
    if (typeof data?.output_text === 'string') return data.output_text;
    if (Array.isArray(data?.output)) {
      return data.output.flatMap((item) => item.content || []).map((c) => c.text || '').join('\n').trim();
    }
    return JSON.stringify(data, null, 2);
  }

  async function askCopilot() {
    const button = document.getElementById('askCopilotBtn');
    const output = document.getElementById('copilotOutput');
    const prompt = document.getElementById('copilotPrompt')?.value || '';
    const task = document.getElementById('copilotTask')?.value || 'latex-copilot';
    const file = State().getActiveFile();
    const selection = NS.Editor?.getSelection?.() || { text: '' };
    if (!prompt.trim() && !selection.text.trim() && task !== 'fix-error' && task !== 'explain-log') {
      output.textContent = 'Add a prompt or select LaTeX in the editor first.';
      return;
    }
    if (button) button.disabled = true;
    output.textContent = 'Calling AI proxy…';
    try {
      const system = systemPromptFor(task);
      const user = [
        `Task: ${task}`,
        `Project: ${State().state.project.name}`,
        `Active file: ${file?.path || 'none'}`,
        selection.text ? `Selected LaTeX:\n${selection.text}` : '',
        `User prompt:\n${prompt}`,
        `Current compile/draft diagnostics:\n${State().state.lastProblems.map((p) => `${p.level}: ${p.message}`).join('\n')}`,
        `Compile log:\n${State().state.lastLog.slice(-4000)}`,
        `Active file content:\n${(file?.text || '').slice(0, 12000)}`
      ].filter(Boolean).join('\n\n---\n\n');
      const result = await callProxy({ instructions: system, input: user, temperature: 0.25, maxOutputTokens: 4500 }, { task });
      output.textContent = extractText(result) || 'No text returned by proxy.';
    } catch (err) {
      output.textContent = `AI proxy error: ${err.message || err}\n\nMake sure backend/server.mjs is running and the proxy URL is correct. Provider API keys should live only on the backend.`;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function systemPromptFor(task) {
    const base = 'You are Lumina LaTeX Copilot. Help edit LaTeX source. Prefer concise, directly usable LaTeX. Do not wrap the answer in Markdown fences unless explicitly asked.';
    if (task === 'fix-error') return `${base} Diagnose the compile issue and return the corrected LaTeX snippet or concrete patch.`;
    if (task === 'rewrite-selection') return `${base} Rewrite the selected LaTeX while preserving mathematical meaning.`;
    if (task === 'new-section') return `${base} Draft a polished LaTeX section or subsection that can be inserted directly.`;
    if (task === 'beamer-outline') return `${base} Return a Beamer-compatible outline with frames and concise bullets.`;
    if (task === 'explain-log') return `${base} Explain the LaTeX compile log and give a fix-first checklist.`;
    return base;
  }

  function copilotText() {
    return document.getElementById('copilotOutput')?.textContent || '';
  }

  function insertCopilotResult() {
    const text = copilotText();
    if (!text.trim() || text.startsWith('Copilot responses')) return;
    NS.Editor?.insertText?.('\n' + text + '\n');
  }

  function replaceWithCopilotResult() {
    const text = copilotText();
    if (!text.trim() || text.startsWith('Copilot responses')) return;
    NS.Editor?.replaceSelection?.(text, true);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  NS.Copilot = { init, models: null, getConfig, callProxy, extractText, askCopilot };
})();
